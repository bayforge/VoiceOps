import { createServer } from "node:http";
import { createVoiceOpsApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createVoiceOpsApp(config);
const port = config.port ?? 8787;

createServer(app.handle).listen(port, () => {
  console.log(`Cursor VoiceOps API listening on http://127.0.0.1:${port}`);
});
