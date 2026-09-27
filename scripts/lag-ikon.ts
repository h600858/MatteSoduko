/**
 * Lager et nøytralt plassholderikon: build/icon.png.
 *
 *   npm run ikon
 *
 * Dette er ikke designarbeid. Ikonet er et sudokurutenett i de samme dempede
 * fargene som UI-et bruker midlertidig, slik at appen ikke ser ødelagt ut i
 * oppgavelinjen mens designet venter. electron-builder lager .ico og .icns ut
 * av denne filen.
 *
 * Skrevet som en generator, ikke som en binærfil noen må gjette opprinnelsen
 * til: da er det tydelig at ikonet er ment å byttes ut.
 */
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const SIZE = 512;
const MARGIN = 44;
const CELLS = 9;

type Rgb = readonly [number, number, number];

const BAKGRUNN: Rgb = [255, 255, 255];
const TYNN: Rgb = [196, 200, 205];
const TYKK: Rgb = [42, 46, 52];
const FYLL: Rgb = [216, 228, 240];

const pixels = new Uint8Array(SIZE * SIZE * 3);

function sett(x: number, y: number, farge: Rgb): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 3;
  pixels[i] = farge[0];
  pixels[i + 1] = farge[1];
  pixels[i + 2] = farge[2];
}

function rektangel(x0: number, y0: number, x1: number, y1: number, farge: Rgb): void {
  for (let y = Math.round(y0); y < Math.round(y1); y += 1) {
    for (let x = Math.round(x0); x < Math.round(x1); x += 1) {
      sett(x, y, farge);
    }
  }
}

rektangel(0, 0, SIZE, SIZE, BAKGRUNN);

const brett = SIZE - MARGIN * 2;
const celle = brett / CELLS;

// Noen fylte celler, så ikonet får form uten at vi må tegne tall.
const fylte: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [4, 0], [8, 0],
  [2, 2], [6, 2],
  [1, 4], [4, 4], [7, 4],
  [2, 6], [6, 6],
  [0, 8], [4, 8], [8, 8],
];

for (const [kol, rad] of fylte) {
  rektangel(
    MARGIN + kol * celle,
    MARGIN + rad * celle,
    MARGIN + (kol + 1) * celle,
    MARGIN + (rad + 1) * celle,
    FYLL,
  );
}

// Rutenettet. Hver tredje linje er tykk, slik blokkene skal vises.
// De tynne tegnes først, så de ikke lager hakk i de tykke der de krysser.
for (const tykk of [false, true]) {
  for (let i = 0; i <= CELLS; i += 1) {
    if ((i % 3 === 0) !== tykk) continue;
    const bredde = tykk ? 10 : 4;
    const farge = tykk ? TYKK : TYNN;
    const pos = MARGIN + i * celle - bredde / 2;

    rektangel(pos, MARGIN - bredde / 2, pos + bredde, MARGIN + brett + bredde / 2, farge);
    rektangel(MARGIN - bredde / 2, pos, MARGIN + brett + bredde / 2, pos + bredde, farge);
  }
}

// --- PNG-koding ---

const CRC_TABELL = (() => {
  const tabell = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabell[n] = c >>> 0;
  }
  return tabell;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) {
    c = (CRC_TABELL[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const lengde = Buffer.alloc(4);
  lengde.writeUInt32BE(data.length, 0);
  const typeOgData = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeOgData), 0);
  return Buffer.concat([lengde, typeOgData, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bitdybde
ihdr[9] = 2; // fargetype: truecolor
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// Hver rad innledes med filtertype 0.
const rader = Buffer.alloc(SIZE * (SIZE * 3 + 1));
for (let y = 0; y < SIZE; y += 1) {
  const fra = y * SIZE * 3;
  const til = y * (SIZE * 3 + 1);
  rader[til] = 0;
  Buffer.from(pixels.buffer, fra, SIZE * 3).copy(rader, til + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(rader, { level: 9 })),
  chunk('IEND', new Uint8Array(0)),
]);

const ut = path.join(process.cwd(), 'build', 'icon.png');
fs.mkdirSync(path.dirname(ut), { recursive: true });
fs.writeFileSync(ut, png);
console.log(`Skrev ${ut} (${SIZE}x${SIZE}, ${png.length} byte)`);
