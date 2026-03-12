import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  NotFoundException,
} from '@zxing/library';
import sharp from 'sharp';

export interface ScanResult {
  text: string;
  format: string;
}

const FORMAT_MAP = new Map<BarcodeFormat, string>([
  [BarcodeFormat.QR_CODE, 'QR_CODE'],
  [BarcodeFormat.CODE_128, 'CODE_128'],
  [BarcodeFormat.CODE_39, 'CODE_39'],
  [BarcodeFormat.EAN_13, 'EAN_13'],
  [BarcodeFormat.EAN_8, 'EAN_8'],
  [BarcodeFormat.UPC_A, 'UPC_A'],
]);

const SUPPORTED_FORMATS = Array.from(FORMAT_MAP.keys());

const hints = new Map<DecodeHintType, any>();
hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
hints.set(DecodeHintType.TRY_HARDER, true);

/**
 * Decode barcodes from a raw image buffer.
 * Uses ZXing-js to detect QR Code, Code 128, Code 39, EAN-13, EAN-8, UPC-A.
 * Returns empty array when no barcode is found.
 * Throws on unexpected decode errors.
 */
export async function decodeBarcode(imageBuffer: Buffer): Promise<ScanResult[]> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;

  // Convert RGBA to RGB for RGBLuminanceSource
  const rgbData = new Uint8ClampedArray(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    rgbData[i * 3] = data[i * 4];
    rgbData[i * 3 + 1] = data[i * 4 + 1];
    rgbData[i * 3 + 2] = data[i * 4 + 2];
  }

  const luminanceSource = new RGBLuminanceSource(rgbData, width, height);
  const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

  const reader = new MultiFormatReader();
  reader.setHints(hints);

  try {
    const result = reader.decode(binaryBitmap);
    const formatName = FORMAT_MAP.get(result.getBarcodeFormat()) ?? result.getBarcodeFormat().toString();
    return [{ text: result.getText(), format: formatName }];
  } catch (error) {
    if (error instanceof NotFoundException) {
      return [];
    }
    throw error;
  }
}
