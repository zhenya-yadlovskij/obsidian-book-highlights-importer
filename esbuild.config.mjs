import { cp, mkdir, rm } from "node:fs/promises";

import { build } from "esbuild";

const outputDirectory = "dist";

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  bundle: true,
  entryPoints: ["src/main.ts"],
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  format: "cjs",
  logLevel: "silent",
  minify: true,
  outfile: `${outputDirectory}/main.js`,
  platform: "browser",
  target: "es2022",
  treeShaking: true,
});

await Promise.all([
  cp("manifest.json", `${outputDirectory}/manifest.json`),
  cp("versions.json", `${outputDirectory}/versions.json`),
]);

console.log(`Built production release in ${outputDirectory}/`);
