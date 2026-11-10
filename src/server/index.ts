import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { app, db } = createApp(config);

const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`人间小剧场工作台已启动：http://127.0.0.1:${config.port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
