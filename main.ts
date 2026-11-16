import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Publish the bundled image unchanged so every run produces identical bytes.
const destination = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const source = new URL('./entry.png', import.meta.url);
mkdirSync(destination, { recursive: true });
copyFileSync(source, resolve(destination, 'entry.png'));
