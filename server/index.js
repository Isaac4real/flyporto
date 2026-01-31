import { GameServer } from './GameServer.js';

const port = process.env.PORT || 8080;
const server = new GameServer(port);

// Graceful shutdown handling
const shutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
  server.shutdown();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
