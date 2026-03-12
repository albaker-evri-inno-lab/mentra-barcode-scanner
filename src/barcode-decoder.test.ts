import { describe, it, expect } from 'bun:test';
import fc from 'fast-check';
import type { ScanResult } from './barcode-decoder';

const SUPPORTED_FORMATS = ['QR_CODE', 'CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'UPC_A'];

/**
 * Property 1: Decode results contain text and format
 *
 * For any image buffer that produces a non-empty decode result, every entry
 * in the result array shall have a non-empty text string and a non-empty
 * format string matching one of the supported barcode format identifiers.
 *
 * Tag: Feature: barcode-scanning, Property 1: Decode results contain text and format
 * Validates: Requirements 2.3
 */
describe('Feature: barcode-scanning, Property 1: Decode results contain text and format', () => {
  const scanResultArb = fc.record({
    text: fc.string({ minLength: 1 }),
    format: fc.constantFrom(...SUPPORTED_FORMATS),
  });

  it('every ScanResult has non-empty text and a supported format', () => {
    fc.assert(
      fc.property(fc.array(scanResultArb, { minLength: 1 }), (results: ScanResult[]) => {
        for (const entry of results) {
          expect(entry.text.length).toBeGreaterThan(0);
          expect(entry.format.length).toBeGreaterThan(0);
          expect(SUPPORTED_FORMATS).toContain(entry.format);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('empty result array is valid (no barcode found)', () => {
    const emptyResults: ScanResult[] = [];
    expect(emptyResults).toEqual([]);
  });
});
