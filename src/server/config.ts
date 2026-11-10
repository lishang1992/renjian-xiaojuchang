import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

function resolveFromRoot(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

export interface AppConfig {
  projectRoot: string;
  databasePath: string;
  storageRoot: string;
  port: number;
}

export function loadConfig(): AppConfig {
  return {
    projectRoot,
    databasePath: resolveFromRoot(process.env.DATABASE_PATH ?? 'data/app.db'),
    storageRoot: resolveFromRoot(process.env.STORAGE_ROOT ?? 'storage'),
    port: Number(process.env.PORT ?? 8787),
  };
}
