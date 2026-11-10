import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { assetKindForScope, assetUploadQuerySchema } from '../../shared/schemas.js';
import type { AppConfig } from '../config.js';
import type { AppDatabase } from '../db/database.js';
import { listAssets, mapAsset } from '../db/mappers.js';
import { HttpError } from '../errors.js';

const execFileAsync = promisify(execFile);

const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
};

interface ProbeResult {
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

async function probeMedia(filePath: string): Promise<ProbeResult> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration:stream=width,height,codec_type',
        '-of',
        'json',
        filePath,
      ],
      { maxBuffer: 1024 * 1024 },
    );
    const data = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ width?: number; height?: number; codec_type?: string }>;
    };
    const videoStream = data.streams?.find(
      (stream) => stream.codec_type === 'video' && stream.width && stream.height,
    );
    const duration = Number(data.format?.duration);
    return {
      width: videoStream?.width ?? null,
      height: videoStream?.height ?? null,
      durationMs: Number.isFinite(duration) ? Math.round(duration * 1000) : null,
    };
  } catch {
    throw new HttpError(400, '无法识别这个素材文件，请确认文件没有损坏', 'INVALID_MEDIA');
  }
}

function safeOriginalName(name: string) {
  return path.basename(name).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
}

function assertScopeExists(db: AppDatabase, scopeType: string, scopeId: string) {
  const table = scopeType === 'script' ? 'scripts' : scopeType === 'character' ? 'characters' : 'scenes';
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(scopeId);
  if (!row) {
    throw new HttpError(404, '素材关联的剧本、人物或镜头不存在', 'SCOPE_NOT_FOUND');
  }
}

export function createAssetsRouter(
  db: AppDatabase,
  config: AppConfig,
) {
  const router = Router();
  const tempDir = path.join(config.storageRoot, 'work', 'uploads');
  fs.mkdirSync(tempDir, { recursive: true });
  const upload = multer({
    dest: tempDir,
    limits: { fileSize: 1024 * 1024 * 1024, files: 1 },
  });

  router.get('/', (req, res) => {
    const scriptId = typeof req.query.scriptId === 'string' ? req.query.scriptId : undefined;
    res.json({ assets: listAssets(db, scriptId) });
  });

  router.post('/upload', upload.single('file'), async (req, res) => {
    const tempPath = req.file?.path;
    try {
      const query = assetUploadQuerySchema.parse(req.query);
      if (!req.file || !tempPath) {
        throw new HttpError(400, '请选择需要上传的文件', 'FILE_REQUIRED');
      }
      if (!extensions[req.file.mimetype]) {
        throw new HttpError(
          400,
          '仅支持 JPG、PNG、WebP 图片，MP4、MOV、WebM 视频，以及 MP3、WAV、M4A、AAC、OGG 音频',
          'UNSUPPORTED_MEDIA_TYPE',
        );
      }
      if (!assetKindForScope[query.scopeType].includes(query.kind)) {
        throw new HttpError(400, '素材类型与关联位置不匹配', 'INVALID_ASSET_SCOPE');
      }
      assertScopeExists(db, query.scopeType, query.scopeId);

      const probe = await probeMedia(tempPath);
      const id = randomUUID();
      const kindFolder =
        query.kind === 'character_reference'
          ? 'characters'
          : query.kind === 'scene_image'
            ? 'scenes'
            : query.kind === 'scene_video'
              ? 'clips'
              : query.kind === 'voice'
                ? 'voices'
                : query.kind === 'bgm' || query.kind === 'end_card'
                  ? 'music'
                  : 'other';
      const relativePath = path.posix.join(
        'uploads',
        kindFolder,
        `${id}${extensions[req.file.mimetype]}`,
      );
      const destination = path.join(config.storageRoot, relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.renameSync(tempPath, destination);

      const now = new Date().toISOString();
      db.transaction(() => {
        db.prepare(
          `INSERT INTO assets
            (id, kind, original_name, stored_name, relative_path, mime_type, size_bytes,
             duration_ms, width, height, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          query.kind,
          safeOriginalName(req.file!.originalname),
          path.basename(relativePath),
          relativePath,
          req.file!.mimetype,
          req.file!.size,
          probe.durationMs,
          probe.width,
          probe.height,
          now,
        );
        db.prepare(
          `INSERT INTO asset_links
            (id, asset_id, scope_type, scope_id, role, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(randomUUID(), id, query.scopeType, query.scopeId, query.role, now);
      })();

      const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as Record<
        string,
        unknown
      >;
      res.status(201).json({ asset: mapAsset(db, row) });
    } catch (error) {
      if (tempPath && fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { force: true });
      }
      throw error;
    }
  });

  router.delete('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new HttpError(404, '没有找到这个素材', 'ASSET_NOT_FOUND');
    const filePath = path.join(config.storageRoot, row.relative_path as string);
    const uploadsRoot = path.join(config.storageRoot, 'uploads');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(`${path.resolve(uploadsRoot)}${path.sep}`)) {
      throw new HttpError(400, '素材路径不合法', 'INVALID_ASSET_PATH');
    }
    db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    fs.rmSync(resolved, { force: true });
    res.status(204).end();
  });

  return router;
}
