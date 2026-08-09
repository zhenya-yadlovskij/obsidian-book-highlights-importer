import { access, readFile, stat } from "node:fs/promises";

const releaseDirectory = new URL("../dist/", import.meta.url);
const requiredFiles = ["main.js", "manifest.json", "versions.json"];

await Promise.all(
  requiredFiles.map((fileName) => access(new URL(fileName, releaseDirectory))),
);

const manifest = JSON.parse(
  await readFile(new URL("manifest.json", releaseDirectory), "utf8"),
);
const versions = JSON.parse(
  await readFile(new URL("versions.json", releaseDirectory), "utf8"),
);
const bundle = await stat(new URL("main.js", releaseDirectory));

if (manifest.id !== "book-highlights-importer") {
  throw new Error("Release manifest has an unexpected plugin ID.");
}
if (manifest.version !== "0.1.1") {
  throw new Error("Release manifest must declare version 0.1.1.");
}
if (manifest.minAppVersion !== "1.13.0") {
  throw new Error("Release manifest must require Obsidian 1.13.0.");
}
if (/obsidian/i.test(manifest.description)) {
  throw new Error("Release manifest description must not contain Obsidian.");
}
if (manifest.isDesktopOnly !== false) {
  throw new Error("Release manifest must support mobile.");
}
if (versions[manifest.version] !== manifest.minAppVersion) {
  throw new Error("Release version metadata does not match the manifest.");
}
if (!bundle.isFile() || bundle.size === 0) {
  throw new Error("Release main.js is missing or empty.");
}

console.log(`Verified release files: ${requiredFiles.join(", ")}`);
