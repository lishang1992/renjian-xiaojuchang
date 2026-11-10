import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { characterInputSchema } from '../../shared/schemas.js';
import type { AppDatabase } from '../db/database.js';
import { getCharacter, listCharacters } from '../db/mappers.js';
import { HttpError } from '../errors.js';

export function createCharactersRouter(db: AppDatabase) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ characters: listCharacters(db) });
  });

  router.post('/', (req, res) => {
    const input = characterInputSchema.parse(req.body);
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO characters
        (id, name, age, appearance, hairstyle, outfit, personality, voice, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.name,
      input.age ?? null,
      input.appearance,
      input.hairstyle,
      input.outfit,
      input.personality,
      input.voice,
      now,
      now,
    );
    res.status(201).json({ character: getCharacter(db, id) });
  });

  router.put('/:id', (req, res) => {
    const input = characterInputSchema.parse(req.body);
    const result = db
      .prepare(
        `UPDATE characters SET
           name = ?, age = ?, appearance = ?, hairstyle = ?, outfit = ?,
           personality = ?, voice = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.name,
        input.age ?? null,
        input.appearance,
        input.hairstyle,
        input.outfit,
        input.personality,
        input.voice,
        new Date().toISOString(),
        req.params.id,
      );
    if (result.changes === 0) {
      throw new HttpError(404, '没有找到这个人物', 'CHARACTER_NOT_FOUND');
    }
    res.json({ character: getCharacter(db, req.params.id) });
  });

  router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      throw new HttpError(404, '没有找到这个人物', 'CHARACTER_NOT_FOUND');
    }
    res.status(204).end();
  });

  return router;
}
