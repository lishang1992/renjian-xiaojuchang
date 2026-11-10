import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { scriptInputSchema } from '../../shared/schemas.js';
import type { AppDatabase } from '../db/database.js';
import { getScript, listScripts, mapScriptSummary } from '../db/mappers.js';
import { HttpError } from '../errors.js';

const publishSchema = z.object({ published: z.boolean() });

export function createScriptsRouter(db: AppDatabase) {
  const router = Router();

  router.get('/', (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    res.json({ scripts: listScripts(db, date) });
  });

  router.get('/:id', (req, res) => {
    const script = getScript(db, req.params.id);
    if (!script) throw new HttpError(404, '没有找到这个剧本', 'SCRIPT_NOT_FOUND');
    res.json({ script });
  });

  router.post('/', (req, res) => {
    const input = scriptInputSchema.parse(req.body);
    const id = randomUUID();
    const now = new Date().toISOString();

    try {
      db.transaction(() => {
        db.prepare(
          `INSERT INTO scripts
            (id, title, summary, narration, scheduled_date, daily_slot,
             production_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.title,
          input.summary,
          input.narration,
          input.scheduledDate ?? null,
          input.dailySlot ?? null,
          input.productionStatus,
          now,
          now,
        );
        const insertCharacter = db.prepare(
          `INSERT INTO script_characters (script_id, character_id, position)
           VALUES (?, ?, ?)`,
        );
        input.characterIds.forEach((characterId, index) => {
          insertCharacter.run(id, characterId, index);
        });
      })();
    } catch (error) {
      if (
        (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        String(error).includes('idx_scripts_daily_slot')
      ) {
        throw new HttpError(409, '这个日期和条次已经安排了剧本，请选择其他条次');
      }
      throw error;
    }

    const row = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({ script: mapScriptSummary(db, row) });
  });

  router.put('/:id', (req, res) => {
    if (!getScript(db, req.params.id)) {
      throw new HttpError(404, '没有找到这个剧本', 'SCRIPT_NOT_FOUND');
    }
    const input = scriptInputSchema.parse(req.body);
    const now = new Date().toISOString();

    try {
      db.transaction(() => {
        db.prepare(
          `UPDATE scripts SET
             title = ?, summary = ?, narration = ?, scheduled_date = ?,
             daily_slot = ?, production_status = ?, updated_at = ?
           WHERE id = ?`,
        ).run(
          input.title,
          input.summary,
          input.narration,
          input.scheduledDate ?? null,
          input.dailySlot ?? null,
          input.productionStatus,
          now,
          req.params.id,
        );
        db.prepare('DELETE FROM script_characters WHERE script_id = ?').run(req.params.id);
        const insertCharacter = db.prepare(
          `INSERT INTO script_characters (script_id, character_id, position)
           VALUES (?, ?, ?)`,
        );
        input.characterIds.forEach((characterId, index) => {
          insertCharacter.run(req.params.id, characterId, index);
        });
      })();
    } catch (error) {
      if (
        (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        String(error).includes('idx_scripts_daily_slot')
      ) {
        throw new HttpError(409, '这个日期和条次已经安排了剧本，请选择其他条次');
      }
      throw error;
    }

    res.json({ script: getScript(db, req.params.id) });
  });

  router.put('/:id/published', (req, res) => {
    const input = publishSchema.parse(req.body);
    const publishedAt = input.published ? new Date().toISOString() : null;
    const result = db
      .prepare('UPDATE scripts SET published_at = ?, updated_at = ? WHERE id = ?')
      .run(publishedAt, new Date().toISOString(), req.params.id);
    if (result.changes === 0) {
      throw new HttpError(404, '没有找到这个剧本', 'SCRIPT_NOT_FOUND');
    }
    res.json({ script: getScript(db, req.params.id) });
  });

  router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM scripts WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      throw new HttpError(404, '没有找到这个剧本', 'SCRIPT_NOT_FOUND');
    }
    res.status(204).end();
  });

  return router;
}
