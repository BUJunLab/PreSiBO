import { loadAppConfig } from "./config/env.js";
import { buildApp } from "./app.js";

const app = buildApp();
const { port } = loadAppConfig();

app.listen(port, () => {
  console.log(`PreSiBO Lite backend listening on http://localhost:${port}`);
});
