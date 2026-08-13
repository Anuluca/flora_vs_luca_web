import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const asset = (...segments) => path.join(root, "public", "assets", ...segments);
const output = path.join(root, "public", "og.png");
const WIDTH = 1200;
const HEIGHT = 630;

function svg(content, width = WIDTH, height = HEIGHT) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`);
}

/** 使用 EnemyModel 相同的透明部件和绘制顺序拼装路卡。 */
async function createLucaModel() {
  const prepare = async (name, width, height, angle = 0) => {
    let image = sharp(asset("enemies", "luca", name)).resize(width, height, { fit: "fill" });
    if (angle) image = image.rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    return image.png().toBuffer();
  };
  const [legLeft, legRight, tail, armBack, body, armFront, head] = await Promise.all([
    prepare("leg.webp", 38, 92, -5),
    prepare("leg.webp", 38, 92, 5),
    prepare("tail.webp", 112, 82, 8),
    prepare("hand.webp", 122, 55, -4),
    prepare("body.webp", 102, 206),
    prepare("hand.webp", 122, 55, 5),
    prepare("head.webp", 192, 158),
  ]);

  return sharp({
    create: { width: 260, height: 390, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: legRight, left: 129, top: 283 },
    { input: legLeft, left: 91, top: 279 },
    { input: tail, left: 136, top: 206 },
    { input: armBack, left: 22, top: 183 },
    { input: body, left: 84, top: 148 },
    { input: armFront, left: 7, top: 207 },
    { input: head, left: 38, top: 20 },
  ]).png().toBuffer();
}

const interfaceLayer = svg(`
  <defs>
    <pattern id="paper-lines" width="22" height="22" patternUnits="userSpaceOnUse">
      <path d="M0 21.5H22" stroke="#786b5e" stroke-opacity=".08"/>
    </pattern>
    <pattern id="orange-scan" width="1" height="14" patternUnits="userSpaceOnUse">
      <rect width="1" height="12.5" fill="#d47800"/>
    </pattern>
    <pattern id="blue-scan" width="1" height="14" patternUnits="userSpaceOnUse">
      <rect width="1" height="12.5" fill="#006989"/>
    </pattern>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="8" dy="10" stdDeviation="0" flood-color="#322a25" flood-opacity=".2"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="#8f7d6c"/>
  <path d="M38 47L1156 32L1172 581L48 599Z" fill="#eadfc5" filter="url(#shadow)"/>
  <path d="M38 47L1156 32L1172 581L48 599Z" fill="url(#paper-lines)" stroke="#51483f" stroke-opacity=".46" stroke-width="4" stroke-dasharray="13 10"/>

  <g transform="translate(456 68) rotate(-1)">
    <rect width="334" height="470" fill="#f3ead4" stroke="#51483f" stroke-opacity=".28" stroke-width="3" stroke-dasharray="10 8"/>
    <rect x="126" y="-13" width="82" height="31" fill="#d8bd78" fill-opacity=".68" transform="rotate(2 167 2)"/>

    <text x="167" y="139" text-anchor="middle" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="112" font-weight="900" fill="#fff">花花</text>
    <text x="162" y="134" text-anchor="middle" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="112" font-weight="900" fill="url(#orange-scan)">花花</text>

    <g transform="translate(105 174)">
      <rect width="124" height="72" fill="#ec6f86"/>
      <path d="M-6 8V64M130 8V64" stroke="#26201d" stroke-opacity=".41" stroke-width="12"/>
      <text x="62" y="54" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="49" font-style="italic" font-weight="900" fill="#fff4e4">VS</text>
    </g>

    <text x="167" y="360" text-anchor="middle" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="112" font-weight="900" fill="#fff">路卡</text>
    <text x="162" y="355" text-anchor="middle" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="112" font-weight="900" fill="url(#blue-scan)">路卡</text>

    <g transform="translate(67 398) rotate(-1)">
      <rect width="200" height="54" rx="8" fill="#e23456" stroke="#51483f" stroke-width="3"/>
      <path d="M26 15V39L45 27Z" fill="#fff4e4"/>
      <text x="121" y="36" text-anchor="middle" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="23" font-weight="900" fill="#fff4e4">开始游戏</text>
    </g>
  </g>

  <g transform="translate(75 80) rotate(-4)">
    <rect width="174" height="48" fill="#d4c892" stroke="#51483f" stroke-width="2" stroke-dasharray="8 6"/>
    <text x="87" y="32" text-anchor="middle" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="18" font-weight="900" fill="#51483f">像素纸片风网页游戏</text>
  </g>
  <text x="600" y="568" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="17" font-weight="700" fill="#51483f">© 2026 Anuluca · flora-ball.anuluca.com</text>
`);

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const [luca, hua, treat, scratcher] = await Promise.all([
  createLucaModel(),
  sharp(asset("cats", "ball-hua", "projectile-01.webp")).resize(360, 360, { fit: "contain" }).rotate(-11, { background: transparent }).png().toBuffer(),
  sharp(asset("treat.webp")).resize(76, 165, { fit: "contain" }).rotate(-10, { background: transparent }).png().toBuffer(),
  sharp(asset("scratcher-house.webp")).resize(155, 207, { fit: "contain" }).rotate(-88, { background: transparent }).png().toBuffer(),
]);

await sharp(interfaceLayer).composite([
  { input: hua, left: 80, top: 190 },
  { input: luca, left: 835, top: 138 },
  { input: treat, left: 20, top: 472 },
  { input: treat, left: 64, top: 474 },
  { input: treat, left: 108, top: 471 },
  { input: scratcher, left: 1050, top: 462 },
]).png({ compressionLevel: 9, palette: true, quality: 100 }).toFile(output);

console.log(`Generated public/og.png (${WIDTH}×${HEIGHT})`);
