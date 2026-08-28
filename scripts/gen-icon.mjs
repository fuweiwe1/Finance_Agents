// 生成应用图标：深蓝渐变底 + 白色 K 线蜡烛（256x256 PNG）
// 产出 electron/resources/icon.png（托盘 + 打包 M8-4 转 .ico 共用）
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 256;
const out = resolve(fileURLToPath(import.meta.url), '../../electron/resources/icon.png');

const buf = Buffer.alloc(SIZE * (SIZE * 3 + 1)); // 每行: filter(1) + RGB(3*SIZE)
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 3 + 1);
  buf[row] = 0; // filter none
  for (let x = 0; x < SIZE; x++) {
    const i = row + 1 + x * 3;
    // 深蓝渐变背景
    let r = Math.round(28 + (x / SIZE) * 12);
    let g = Math.round(38 + (y / SIZE) * 16);
    let b = Math.round(79 + (x / SIZE) * 30 + (y / SIZE) * 20);
    // 白色蜡烛线（中间区域）：一个实心矩形 + 上下影线
    const cx = 96, cw = 64; // 蜡烛身
    const top = 60, bottom = 196; // 影线范围
    const bodyTop = 92, bodyBottom = 160;
    const isBody = x >= cx && x < cx + cw && y >= bodyTop && y < bodyBottom;
    const isWick = Math.abs(x - (cx + cw / 2)) <= 3 && y >= top && y < bottom;
    if (isBody || isWick) {
      r = 245; g = 247; b = 250;
    }
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
  }
}

// PNG 打包
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(body);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, body, c]);
}
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colortype RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(buf)),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`icon written: ${out} (${png.length} bytes)`);