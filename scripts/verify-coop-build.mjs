import { readFile } from "node:fs/promises";
import path from "node:path";

const serviceWorkerPath = path.resolve("dist", "sw.js");
const serviceWorker = await readFile(serviceWorkerPath, "utf8");

if (
  !serviceWorker.includes("Cross-Origin-Opener-Policy")
  || !serviceWorker.includes("same-origin-allow-popups")
) {
  throw new Error("O service worker publicado não aplica o cabeçalho COOP exigido pelo login Google.");
}

if (serviceWorker.includes("__WB_MANIFEST")) {
  throw new Error("O manifesto de precache não foi injetado no service worker.");
}

console.log("COOP verificado: navegações controladas permitem o popup OAuth sem polling bloqueado.");
