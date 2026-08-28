// 把 icon.png 包装成 .ico（ICO 容器内嵌 PNG，256x256，Vista+ 支持）
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pngPath = resolve(fileURLToPath(import.meta.url), '../../electron/resources/icon.png');
const icoPath = resolve(fileURLToPath(import.meta.url), '../../electron/resources/icon.ico');
const png = readFileSync(pngPath);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count

const entry = Buffer.alloc(16);
entry[0] = 0; // width 256 → 0
entry[1] = 0; // height 256 → 0
entry[2] = 0; // color count
entry[3] = 0; // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bit count
entry.writeUInt32LE(png.length, 8); // bytes in res
entry.writeUInt32LE(22, 12); // image offset

const ico = Buffer.concat([header, entry, png]);
writeFileSync(icoPath, ico);
console.log(`icon.ico written: ${icoPath} (${ico.length} bytes)`);