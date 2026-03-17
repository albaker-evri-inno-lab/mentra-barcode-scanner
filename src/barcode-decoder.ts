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
  const { data, info } = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const results = await readBarcodesFromImageData(
    { data: new Uint8ClampedArray(data), width: info.width, height: info.height },
    readerOptions
  );
  return results.map(r => ({ text: r.text, format: r.format }));
}

export async function decodeBarcode(imageBuffer: Buffer): Promise<ScanResult[]> {
  const metadata = await sharp(imageBuffer).metadata();
  const w = metadata.width ?? 1920;
  console.log(`🔍 Image received: ${w}x${metadata.height}, ${imageBuffer.length} bytes`);

  // Attempt 1: greyscale + contrast stretch + sharpen at full resolution
  let results = await tryDecode(
    sharp(imageBuffer).greyscale().normalise().sharpen()
  );
  if (results.length > 0) {
    console.log('✅ Barcode found on attempt 1 (full res, preprocessed)');
    return results;
  }

  // Attempt 2: 50% size — helps when barcode is small in the frame
  results = await tryDecode(
    sharp(imageBuffer).resize({ width: Math.round(w / 2) }).greyscale().normalise()
  );
  if (results.length > 0) {
    console.log('✅ Barcode found on attempt 2 (50% resize)');
    return results;
  }

  // Attempt 3: 25% size
  results = await tryDecode(
    sharp(imageBuffer).resize({ width: Math.round(w / 4) }).greyscale().normalise()
  );
  if (results.length > 0) {
    console.log('✅ Barcode found on attempt 3 (25% resize)');
    return results;
  }

  // Attempt 4: high contrast threshold (helps with poor lighting)
  results = await tryDecode(
    sharp(imageBuffer).greyscale().linear(2.0, -(128 * 2.0) + 128).normalise()
  );
  if (results.length > 0) {
    console.log('✅ Barcode found on attempt 4 (high contrast)');
    return results;
  }

  console.log('❌ No barcode found after 4 attempts');
  return [];
}
