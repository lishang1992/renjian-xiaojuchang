import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import type { AppConfig } from './config.js';
import { createDatabase } from './db/database.js';
import { HttpError } from './errors.js';
import { createAssetsRouter } from './routes/assets.js';
import { createCharactersRouter } from './routes/characters.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createScenesRouter } from './routes/scenes.js';
import { createScriptsRouter } from './routes/scripts.js';

export function createApp(config: AppConfig) {
  const app = express();
  const db = createDatabase({ databasePath: config.databasePath });
  const uploadsDir = path.join(config.storageRoot, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ffmpegReady: true, storage: 'ready' });
  });
  app.use('/api/dashboard', createDashboardRouter(db));
  app.use('/api/scripts', createScriptsRouter(db));
  app.use('/api/characters', createCharactersRouter(db));
  app.use('/api', createScenesRouter(db));
  app.use('/api/assets', createAssetsRouter(db, config));
  app.use(
    '/media/uploads',
    express.static(uploadsDir, {
      dotfiles: 'deny',
      fallthrough: false,
      maxAge: '1h',
    }),
  );

  const clientDir = path.join(config.projectRoot, 'dist', 'client');
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir, { index: false }));
    app.get(/^(?!\/api|\/media).*/, (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { message: '接口不存在', code: 'API_NOT_FOUND' } });
  });

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof ZodError) {
        const message = error.issues[0]?.message ?? '提交的内容不完整';
        res.status(400).json({
          error: {
            message,
            code: 'VALIDATION_ERROR',
            fields: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        });
        return;
      }
      if (error instanceof HttpError) {
        res.status(error.status).json({
          error: { message: error.message, code: error.code },
        });
        return;
      }
      if (error instanceof multer.MulterError) {
        const message =
          error.code === 'LIMIT_FILE_SIZE'
            ? '文件过大，单个素材不能超过 1GB'
            : '上传失败，请重新选择文件';
        res.status(400).json({ error: { message, code: 'UPLOAD_ERROR' } });
        return;
      }
      console.error(error);
      res.status(500).json({
        error: {
          message: '操作没有完成，请稍后重试。详细错误已记录在服务端。',
          code: 'INTERNAL_ERROR',
        },
      });
    },
  );

  return { app, db };
}
