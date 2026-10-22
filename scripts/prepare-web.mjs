import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const source = dirname(require.resolve("stockfish/package.json"));
const target = new URL("../public/stockfish/", import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]) {
  await copyFile(join(source, "bin", file), new URL(file, target));
}
await copyFile(join(source, "Copying.txt"), new URL("COPYING.txt", target));
const { version } = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
await writeFile(
  new URL("SOURCES.txt", target),
  `Stockfish.js ${version}\nGPL-3.0\nCorresponding source, build scripts and modifications:\nhttps://github.com/nmrugg/stockfish.js/tree/v${version}\nhttps://registry.npmjs.org/stockfish/-/stockfish-${version}.tgz\nBuilt upstream with Emscripten; shipped unmodified (lite, single-threaded).\n`,
);
