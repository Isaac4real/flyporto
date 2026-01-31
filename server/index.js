import { GameServer } from './GameServer.js';

const port = process.env.PORT || 8080;
new GameServer(port);
