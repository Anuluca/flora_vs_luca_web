import path from "node:path";
import { fileURLToPath } from "node:url";
import { rename } from "node:fs/promises";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "public", "og.png");
const temporaryOutput = path.join(root, "public", "og.optimized.png");
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * OG 图由网页截图维护。该脚本只负责统一社交分享比例与压缩参数，
 * 不再用代码重新拼装旧版画面，避免覆盖人工选定的新截图。
 */
await sharp(input)
  .resize(WIDTH, HEIGHT, {
    fit: "cover",
    position: "centre",
    kernel: sharp.kernel.lanczos3,
  })
  .png({
    compressionLevel: 9,
    palette: true,
    quality: 82,
    effort: 10,
    colours: 256,
    dither: 0.7,
  })
  .toFile(temporaryOutput);

await rename(temporaryOutput, input);

console.log(`Optimized public/og.png (${WIDTH}×${HEIGHT})`);
