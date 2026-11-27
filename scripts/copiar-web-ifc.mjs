// Copia o motor de leitura de IFC (WebAssembly) para public/, de onde o navegador o carrega.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/web-ifc", { recursive: true });
copyFileSync("node_modules/web-ifc/web-ifc.wasm", "public/web-ifc/web-ifc.wasm");
