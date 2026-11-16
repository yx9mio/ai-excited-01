import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1_048_576;
const MAX_EDGE = 1024;

function dimensions(data: Buffer): { width: number; height: number } {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (data.subarray(0, 8).equals(pngSignature)) {
    if (data.length < 33 || data.readUInt32BE(8) !== 13 ||
        data.toString('ascii', 12, 16) !== 'IHDR') {
      throw new Error('PNG is missing a complete IHDR chunk');
    }
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length < 3 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) {
    throw new Error('entry.png must have a valid PNG or JPEG signature');
  }
  const frameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset < data.length) {
    if (data[offset++] !== 0xff) throw new Error('Invalid JPEG marker boundary');
    while (offset < data.length && data[offset] === 0xff) offset++;
    if (offset >= data.length) throw new Error('Truncated JPEG marker');
    const marker = data[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > data.length) throw new Error('Truncated JPEG segment length');
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) {
      throw new Error('Invalid or truncated JPEG segment');
    }
    if (frameMarkers.has(marker)) {
      if (length < 8) throw new Error('Truncated JPEG frame header');
      return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  throw new Error('JPEG has no supported SOF dimension marker');
}

function main(): void {
  const source = join(dirname(fileURLToPath(import.meta.url)), 'entry.png');
  const data = readFileSync(source);
  if (data.length > MAX_BYTES) {
    throw new Error(`entry.png is ${data.length} bytes; limit is ${MAX_BYTES}`);
  }
  const { width, height } = dimensions(data);
  if (width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE) {
    throw new Error(`Invalid image dimensions ${width}x${height}; allowed range is 1..${MAX_EDGE}`);
  }
  const outputDirectory = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
  const destination = join(outputDirectory, 'entry.png');
  mkdirSync(outputDirectory, { recursive: true });
  copyFileSync(source, destination);
  console.log(`entry.png: ${data.length} bytes, ${width}x${height} -> ${destination}`);
}

try {
  main();
} catch (error) {
  console.error(`Image validation/copy failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
