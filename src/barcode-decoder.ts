import { readBarcodesFromImageData, prepareZXingModule, type ReaderOptions } from 'zxing-wasm/reader';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const wasmBuffer = readFileSync(
  resolve(process.cwd(), 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm')
);
await prepareZXingModule({
  wasmBinary: wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  ) as ArrayBuffer,
});

export interface ScanResult {
  text: string;
  format: string;
}

const readerOptions: ReaderOptions = {
  formats: ['QRCode', 'Code128', 'Code39', 'EAN-13', 'EAN-8', 'UPCA'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
};

async function tryDecode(pipeline: sharp.Sharp): Promise<ScanResult[]> {
  // Must output RGBA (4 channels) — never use greyscale() before this
  const { data, info } = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`  → ${info.width}x${info.height} ${info.channels}ch`);

  const results = await readBarcodesFromImageData(
    { data: new Uint8ClampedArray(data), width: info.width, height: info.height },
    readerOptions
  );
  return results.map(r => ({ text: r.text, format: r.format }));
}

export async function decodeBarcode(imageBuffer: Buffer): Promise<ScanResult[]> {
  const metadata = await sharp(imageBuffer).metadata();
  const w = metadata.width ?? 1920;
  console.log(`🔍 Image: ${w}x${metadata.height}, ${imageBuffer.length} bytes`);

  // Attempt 1: normalise + sharpen, full resolution
  let results = await tryDecode(sharp(imageBuffer).normalise().sharpen());
  if (results.length > 0) { console.log('✅ Found on attempt 1'); return results; }

  // Attempt 2: 50% size
  results = await tryDecode(sharp(imageBuffer).resize({ width: Math.round(w / 2) }).normalise());
  if (results.length > 0) { console.log('✅ Found on attempt 2 (50%)'); return results; }

  // Attempt 3: 25% size
  results = await tryDecode(sharp(imageBuffer).resize({ width: Math.round(w / 4) }).normalise());
  if (results.length > 0) { console.log('✅ Found on attempt 3 (25%)'); return results; }

  // Attempt 4: boosted contrast
  results = await tryDecode(sharp(imageBuffer).linear(2.0, -(128 * 2.0) + 128).normalise());
  if (results.length > 0) { console.log('✅ Found on attempt 4 (contrast boost)'); return results; }

  console.log('❌ No barcode found after 4 attempts');
  return [];
}
