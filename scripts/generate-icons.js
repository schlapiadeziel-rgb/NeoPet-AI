const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

async function main() {
  const source = path.join(__dirname, "..", "mobile", "icon.svg");
  const output = path.join(__dirname, "..", "build");
  fs.mkdirSync(output, { recursive: true });
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = await Promise.all(sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()));
  const pngToIco = (await import("png-to-ico")).default;
  fs.writeFileSync(path.join(output, "icon.ico"), await pngToIco(pngs));
  fs.writeFileSync(path.join(output, "icon.png"), await sharp(source).resize(512, 512).png().toBuffer());
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
