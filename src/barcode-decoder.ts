import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import sharp from 'sharp';

export interface ScanResult {
  text: string;
  format: string;
}

const readerOptions: ReaderOptions = {
  formats: ['QRCode', 'Code128', 'Code39', 'EAN-13', 'EAN-8', 'UPCA'],
  tryHarder: true,
};

/**
 * Decode barcodes from a raw image buffer.
 * Uses zxing-wasm to detect QR Code, Code 128, Code 39, EAN-13, EAN-8, UPC-A.
 * Returns empty array when no barcode is found.
 * Throws on unexpected decode errors.
 */
export async function decodeBarcode(imageBuffer: Buffer): Promise<ScanResult[]> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const imageData: ImageData = {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
    colorSpace: 'srgb',
  };

  const results = await readBarcodes(imageData, readerOptions);

  return results.map(r => ({
    text: r.text,
    format: r.format,
  }));
}