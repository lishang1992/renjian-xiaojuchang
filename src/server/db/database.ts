import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE scripts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        narration TEXT NOT NULL DEFAULT '',
        scheduled_date TEXT,
        daily_slot INTEGER CHECK (daily_slot BETWEEN 1 AND 3),
        production_status TEXT NOT NULL DEFAULT 'draft'
          CHECK (production_status IN ('draft', 'ready', 'produced')),
        published_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX idx_scripts_daily_slot
        ON scripts(scheduled_date, daily_slot)
        WHERE scheduled_date IS NOT NULL AND daily_slot IS NOT NULL;

      CREATE TABLE characters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER,
        appearance TEXT NOT NULL DEFAULT '',
        hairstyle TEXT NOT NULL DEFAULT '',
        outfit TEXT NOT NULL DEFAULT '',
        personality TEXT NOT NULL DEFAULT '',
        voice TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE script_characters (
        script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
        character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (script_id, character_id)
      );

      CREATE TABLE scenes (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 8,
        location TEXT NOT NULL DEFAULT '',
        visual_description TEXT NOT NULL DEFAULT '',
        action TEXT NOT NULL DEFAULT '',
        shot_size TEXT NOT NULL DEFAULT '中景',
        narration TEXT NOT NULL DEFAULT '',
        image_prompt TEXT NOT NULL DEFAULT '',
        video_prompt TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_scenes_script_order ON scenes(script_id, order_index);

      CREATE TABLE scene_characters (
        scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
        character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (scene_id, character_id)
      );

      CREATE TABLE dialogues (
        id TEXT PRIMARY KEY,
        scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
        character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
        speaker TEXT NOT NULL DEFAULT '',
        text TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_dialogues_scene_order ON dialogues(scene_id, order_index);

      CREATE TABLE assets (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        relative_path TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        duration_ms INTEGER,
        width INTEGER,
        height INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE TABLE asset_links (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        scope_type TEXT NOT NULL CHECK (scope_type IN ('script', 'character', 'scene')),
        scope_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'attachment',
        created_at TEXT NOT NULL,
        UNIQUE(asset_id, scope_type, scope_id, role)
      );

      CREATE INDEX idx_asset_links_scope ON asset_links(scope_type, scope_id);

      -- 后续字幕阶段使用；第一阶段只建立结构，不提供字幕生成功能。
      CREATE TABLE subtitle_cues (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
        dialogue_id TEXT REFERENCES dialogues(id) ON DELETE SET NULL,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER NOT NULL,
        text TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- 后续视频合成阶段使用；第一阶段不创建渲染任务。
      CREATE TABLE render_jobs (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        output_path TEXT,
        config_json TEXT NOT NULL DEFAULT '{}',
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );

      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
] as const;

export interface DatabaseOptions {
  databasePath: string;
}

export function createDatabase(options: DatabaseOptions) {
  const isMemory = options.databasePath === ':memory:';
  if (!isMemory) {
    fs.mkdirSync(path.dirname(options.databasePath), { recursive: true });
  }

  const db = new Database(options.databasePath);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  if (!isMemory) {
    db.pragma('journal_mode = WAL');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version),
  );

  const applyMigration = db.transaction((migration: (typeof migrations)[number]) => {
    db.exec(migration.sql);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      migration.version,
      new Date().toISOString(),
    );
  });

  for (const migration of migrations) {
    if (!applied.has(migration.version)) {
      applyMigration(migration);
    }
  }

  return db;
}

export type AppDatabase = ReturnType<typeof createDatabase>;
