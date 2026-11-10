import { Router } from 'express';
import type { AppDatabase } from '../db/database.js';
import { listCharacters, listScripts } from '../db/mappers.js';

function shanghaiDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function createDashboardRouter(db: AppDatabase) {
  const router = Router();

  router.get('/', (req, res) => {
    const today =
      typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : shanghaiDate();
    const recentScripts = listScripts(db).slice(0, 5);
    res.json({
      today,
      todayScripts: listScripts(db, today),
      recentScripts,
      characters: listCharacters(db),
    });
  });

  return router;
}
