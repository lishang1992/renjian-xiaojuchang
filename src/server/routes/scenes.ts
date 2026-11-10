import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { sceneInputSchema, scenePatchSchema } from '../../shared/schemas.js';
import type { AppDatabase } from '../db/database.js';
import { mapScene, getScript } from '../db/mappers.js';
import { HttpError } from '../errors.js';
import { buildPrompts } from '../services/prompts.js';

const reorderSchema = z.object({ sceneIds: z.array(z.string().uuid()).min(1) });

type SceneValues = z.infer<typeof sceneInputSchema>;

function replaceSceneRelations(
  db: AppDatabase,
  sceneId: string,
  characterIds: string[],
  dialogues: SceneValues['dialogues'],
) {
  db.prepare('DELETE FROM scene_characters WHERE scene_id = ?').run(sceneId);
  const insertCharacter = db.prepare(
    'INSERT INTO scene_characters (scene_id, character_id, position) VALUES (?, ?, ?)',
  );
  characterIds.forEach((characterId, index) => {
    insertCharacter.run(sceneId, characterId, index);
  });

  const now = new Date().toISOString();
  const existingRows = db
    .prepare('SELECT id FROM dialogues WHERE scene_id = ?')
    .all(sceneId) as { id: string }[];
  const existingIds = new Set(existingRows.map((row) => row.id));
  const keptIds = new Set<string>();
  const updateDialogue = db.prepare(
    `UPDATE dialogues SET character_id = ?, speaker = ?, text = ?, order_index = ?, updated_at = ?
     WHERE id = ? AND scene_id = ?`,
  );
  const insertDialogue = db.prepare(
    `INSERT INTO dialogues
      (id, scene_id, character_id, speaker, text, order_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  dialogues.forEach((dialogue, index) => {
    if (dialogue.id && existingIds.has(dialogue.id)) {
      updateDialogue.run(
        dialogue.characterId ?? null,
        dialogue.speaker,
        dialogue.text,
        index,
        now,
        dialogue.id,
        sceneId,
      );
      keptIds.add(dialogue.id);
    } else {
      const id = randomUUID();
      insertDialogue.run(
        id,
        sceneId,
        dialogue.characterId ?? null,
        dialogue.speaker,
        dialogue.text,
        index,
        now,
        now,
      );
      keptIds.add(id);
    }
  });

  for (const id of existingIds) {
    if (!keptIds.has(id)) {
      db.prepare('DELETE FROM dialogues WHERE id = ?').run(id);
    }
  }
}

function readScene(db: AppDatabase, sceneId: string) {
  const row = db.prepare('SELECT * FROM scenes WHERE id = ?').get(sceneId) as
    | Record<string, unknown>
    | undefined;
  return row ? mapScene(db, row) : null;
}

export function createScenesRouter(db: AppDatabase) {
  const router = Router();

  router.post('/scripts/:scriptId/scenes', (req, res) => {
    if (!getScript(db, req.params.scriptId)) {
      throw new HttpError(404, '没有找到这个剧本', 'SCRIPT_NOT_FOUND');
    }
    const input = sceneInputSchema.parse(req.body);
    const id = randomUUID();
    const now = new Date().toISOString();
    const order = db
      .prepare('SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order FROM scenes WHERE script_id = ?')
      .get(req.params.scriptId) as { next_order: number };

    db.transaction(() => {
      db.prepare(
        `INSERT INTO scenes
          (id, script_id, order_index, duration_seconds, location, visual_description,
           action, shot_size, narration, image_prompt, video_prompt, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        req.params.scriptId,
        order.next_order,
        input.durationSeconds,
        input.location,
        input.visualDescription,
        input.action,
        input.shotSize,
        input.narration,
        input.imagePrompt,
        input.videoPrompt,
        now,
        now,
      );
      replaceSceneRelations(db, id, input.characterIds, input.dialogues);
    })();

    res.status(201).json({ scene: readScene(db, id) });
  });

  router.put('/scenes/:id', (req, res) => {
    const current = readScene(db, req.params.id);
    if (!current) throw new HttpError(404, '没有找到这个镜头', 'SCENE_NOT_FOUND');
    const patch = scenePatchSchema.parse(req.body);
    const merged = {
      durationSeconds: patch.durationSeconds ?? current.durationSeconds,
      location: patch.location ?? current.location,
      visualDescription: patch.visualDescription ?? current.visualDescription,
      action: patch.action ?? current.action,
      shotSize: patch.shotSize ?? current.shotSize,
      narration: patch.narration ?? current.narration,
      imagePrompt: patch.imagePrompt ?? current.imagePrompt,
      videoPrompt: patch.videoPrompt ?? current.videoPrompt,
      characterIds:
        patch.characterIds !== undefined
          ? patch.characterIds
          : current.characters.map((character) => character.id),
      dialogues:
        patch.dialogues !== undefined
          ? patch.dialogues
          : current.dialogueLines.map((line) => ({
              id: line.id,
              characterId: line.characterId,
              speaker: line.speaker,
              text: line.text,
            })),
    };

    db.transaction(() => {
      db.prepare(
        `UPDATE scenes SET
           duration_seconds = ?, location = ?, visual_description = ?, action = ?,
           shot_size = ?, narration = ?, image_prompt = ?, video_prompt = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        merged.durationSeconds,
        merged.location,
        merged.visualDescription,
        merged.action,
        merged.shotSize,
        merged.narration,
        merged.imagePrompt,
        merged.videoPrompt,
        new Date().toISOString(),
        req.params.id,
      );
      replaceSceneRelations(db, req.params.id, merged.characterIds, merged.dialogues);
    })();

    res.json({ scene: readScene(db, req.params.id) });
  });

  router.post('/scenes/:id/generate-prompts', (req, res) => {
    const scene = readScene(db, req.params.id);
    if (!scene) throw new HttpError(404, '没有找到这个镜头', 'SCENE_NOT_FOUND');
    const prompts = buildPrompts(scene);
    db.prepare(
      'UPDATE scenes SET image_prompt = ?, video_prompt = ?, updated_at = ? WHERE id = ?',
    ).run(prompts.imagePrompt, prompts.videoPrompt, new Date().toISOString(), req.params.id);
    res.json({ ...prompts, scene: readScene(db, req.params.id) });
  });

  router.put('/scripts/:scriptId/scenes/reorder', (req, res) => {
    const input = reorderSchema.parse(req.body);
    const existing = db
      .prepare('SELECT id FROM scenes WHERE script_id = ? ORDER BY order_index')
      .all(req.params.scriptId) as { id: string }[];
    const existingIds = new Set(existing.map((scene) => scene.id));
    if (
      existing.length !== input.sceneIds.length ||
      input.sceneIds.some((id) => !existingIds.has(id))
    ) {
      throw new HttpError(400, '镜头排序数据不完整，请刷新后重试', 'INVALID_SCENE_ORDER');
    }
    db.transaction(() => {
      const update = db.prepare(
        'UPDATE scenes SET order_index = ?, updated_at = ? WHERE id = ? AND script_id = ?',
      );
      input.sceneIds.forEach((id, index) => {
        update.run(index, new Date().toISOString(), id, req.params.scriptId);
      });
    })();
    res.json({ script: getScript(db, req.params.scriptId) });
  });

  router.delete('/scenes/:id', (req, res) => {
    const scene = readScene(db, req.params.id);
    if (!scene) throw new HttpError(404, '没有找到这个镜头', 'SCENE_NOT_FOUND');
    db.transaction(() => {
      db.prepare('DELETE FROM scenes WHERE id = ?').run(req.params.id);
      const remaining = db
        .prepare('SELECT id FROM scenes WHERE script_id = ? ORDER BY order_index')
        .all(scene.scriptId) as { id: string }[];
      const update = db.prepare('UPDATE scenes SET order_index = ? WHERE id = ?');
      remaining.forEach((item, index) => update.run(index, item.id));
    })();
    res.status(204).end();
  });

  return router;
}
