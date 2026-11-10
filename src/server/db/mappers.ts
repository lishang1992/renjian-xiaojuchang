import type {
  Asset,
  AssetKind,
  AssetScope,
  Character,
  CharacterSummary,
  DialogueLine,
  ScriptDetail,
  ScriptSummary,
  Scene,
} from '../../shared/types.js';
import type { AppDatabase } from './database.js';

type Row = Record<string, unknown>;

export function getAssetLinks(db: AppDatabase, assetId: string) {
  return db
    .prepare(
      `SELECT scope_type, scope_id, role
       FROM asset_links
       WHERE asset_id = ?
       ORDER BY created_at`,
    )
    .all(assetId)
    .map((row) => {
      const item = row as Row;
      return {
        scopeType: item.scope_type as AssetScope,
        scopeId: item.scope_id as string,
        role: item.role as string,
      };
    });
}

export function mapAsset(db: AppDatabase, row: Row): Asset {
  const id = row.id as string;
  const mediaUrl = (row.relative_path as string)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return {
    id,
    kind: row.kind as AssetKind,
    originalName: row.original_name as string,
    mimeType: row.mime_type as string,
    sizeBytes: row.size_bytes as number,
    durationMs: (row.duration_ms as number | null) ?? null,
    width: (row.width as number | null) ?? null,
    height: (row.height as number | null) ?? null,
    url: `/media/${mediaUrl}`,
    createdAt: row.created_at as string,
    links: getAssetLinks(db, id),
  };
}

export function getAssetsForScope(
  db: AppDatabase,
  scopeType: AssetScope,
  scopeId: string,
) {
  const rows = db
    .prepare(
      `SELECT a.*
       FROM assets a
       JOIN asset_links l ON l.asset_id = a.id
       WHERE l.scope_type = ? AND l.scope_id = ?
       ORDER BY a.created_at DESC`,
    )
    .all(scopeType, scopeId) as Row[];
  return rows.map((row) => mapAsset(db, row));
}

export function listAssets(db: AppDatabase, scriptId?: string) {
  const rows = (
    scriptId
      ? db
          .prepare(
            `SELECT DISTINCT a.*
             FROM assets a
             JOIN asset_links l ON l.asset_id = a.id
             LEFT JOIN scenes s ON l.scope_type = 'scene' AND s.id = l.scope_id
             LEFT JOIN script_characters sc
               ON l.scope_type = 'character' AND sc.character_id = l.scope_id
             WHERE (l.scope_type = 'script' AND l.scope_id = ?)
                OR (l.scope_type = 'scene' AND s.script_id = ?)
                OR (l.scope_type = 'character' AND sc.script_id = ?)
             ORDER BY a.created_at DESC`,
          )
          .all(scriptId, scriptId, scriptId)
      : db.prepare('SELECT * FROM assets ORDER BY created_at DESC').all()
  ) as Row[];
  return rows.map((row) => mapAsset(db, row));
}

export function getCharacterSummary(row: Row): CharacterSummary {
  return {
    id: row.id as string,
    name: row.name as string,
    age: (row.age as number | null) ?? null,
    appearance: row.appearance as string,
    hairstyle: row.hairstyle as string,
    outfit: row.outfit as string,
    personality: row.personality as string,
    voice: row.voice as string,
  };
}

export function mapCharacter(db: AppDatabase, row: Row): Character {
  return {
    ...getCharacterSummary(row),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    references: getAssetsForScope(db, 'character', row.id as string).filter(
      (asset) => asset.kind === 'character_reference',
    ),
    scriptCount: Number(row.script_count ?? 0),
  };
}

export function listCharacters(db: AppDatabase) {
  const rows = db
    .prepare(
      `SELECT c.*, COUNT(DISTINCT sc.script_id) AS script_count
       FROM characters c
       LEFT JOIN script_characters sc ON sc.character_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
    )
    .all() as Row[];
  return rows.map((row) => mapCharacter(db, row));
}

export function getCharacter(db: AppDatabase, id: string) {
  const row = db
    .prepare(
      `SELECT c.*, COUNT(DISTINCT sc.script_id) AS script_count
       FROM characters c
       LEFT JOIN script_characters sc ON sc.character_id = c.id
       WHERE c.id = ?
       GROUP BY c.id`,
    )
    .get(id) as Row | undefined;
  return row ? mapCharacter(db, row) : null;
}

function getScriptCharacters(db: AppDatabase, scriptId: string) {
  return db
    .prepare(
      `SELECT c.*
       FROM characters c
       JOIN script_characters sc ON sc.character_id = c.id
       WHERE sc.script_id = ?
       ORDER BY sc.position, c.created_at`,
    )
    .all(scriptId)
    .map((row) => getCharacterSummary(row as Row));
}

function getSceneCharacters(db: AppDatabase, sceneId: string) {
  return db
    .prepare(
      `SELECT c.*
       FROM characters c
       JOIN scene_characters sc ON sc.character_id = c.id
       WHERE sc.scene_id = ?
       ORDER BY sc.position, c.created_at`,
    )
    .all(sceneId)
    .map((row) => getCharacterSummary(row as Row));
}

function getSceneDialogues(db: AppDatabase, sceneId: string): DialogueLine[] {
  return db
    .prepare(
      `SELECT d.*, COALESCE(NULLIF(d.speaker, ''), c.name, '旁白') AS display_speaker
       FROM dialogues d
       LEFT JOIN characters c ON c.id = d.character_id
       WHERE d.scene_id = ?
       ORDER BY d.order_index, d.created_at`,
    )
    .all(sceneId)
    .map((row) => {
      const item = row as Row;
      return {
        id: item.id as string,
        sceneId: item.scene_id as string,
        characterId: (item.character_id as string | null) ?? null,
        speaker: item.display_speaker as string,
        text: item.text as string,
        orderIndex: item.order_index as number,
      };
    });
}

export function mapScene(db: AppDatabase, row: Row): Scene {
  const id = row.id as string;
  return {
    id,
    scriptId: row.script_id as string,
    orderIndex: row.order_index as number,
    durationSeconds: row.duration_seconds as number,
    location: row.location as string,
    visualDescription: row.visual_description as string,
    action: row.action as string,
    shotSize: row.shot_size as string,
    narration: row.narration as string,
    imagePrompt: row.image_prompt as string,
    videoPrompt: row.video_prompt as string,
    characters: getSceneCharacters(db, id),
    dialogueLines: getSceneDialogues(db, id),
    assets: getAssetsForScope(db, 'scene', id),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapScriptSummary(db: AppDatabase, row: Row): ScriptSummary {
  const sceneCount = db
    .prepare('SELECT COUNT(*) AS count FROM scenes WHERE script_id = ?')
    .get(row.id) as { count: number };
  return {
    id: row.id as string,
    title: row.title as string,
    summary: row.summary as string,
    narration: row.narration as string,
    scheduledDate: (row.scheduled_date as string | null) ?? null,
    dailySlot: (row.daily_slot as number | null) ?? null,
    productionStatus: row.production_status as ScriptSummary['productionStatus'],
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    sceneCount: sceneCount.count,
    characters: getScriptCharacters(db, row.id as string),
  };
}

export function getScript(db: AppDatabase, id: string): ScriptDetail | null {
  const row = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id) as Row | undefined;
  if (!row) return null;
  const scenes = db
    .prepare('SELECT * FROM scenes WHERE script_id = ? ORDER BY order_index')
    .all(id)
    .map((scene) => mapScene(db, scene as Row));
  return {
    ...mapScriptSummary(db, row),
    scenes,
    assets: getAssetsForScope(db, 'script', id),
  };
}

export function listScripts(db: AppDatabase, date?: string) {
  const rows = (
    date
      ? db
          .prepare(
            `SELECT * FROM scripts
             WHERE scheduled_date = ?
             ORDER BY daily_slot NULLS LAST, created_at`,
          )
          .all(date)
      : db
          .prepare(
            `SELECT * FROM scripts
             ORDER BY COALESCE(scheduled_date, created_at) DESC, updated_at DESC`,
          )
          .all()
  ) as Row[];
  return rows.map((row) => mapScriptSummary(db, row));
}
