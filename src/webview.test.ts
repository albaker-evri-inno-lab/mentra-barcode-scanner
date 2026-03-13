import { describe, it, expect } from 'bun:test';
import fc from 'fast-check';
import ejs from 'ejs';
import path from 'path';
import type { ScanEntry } from './scan-history';

const templatePath = path.join(__dirname, 'views', 'webview.ejs');

/**
 * Property 3: Webview renders all scan entry fields
 *
 * For any ScanEntry in the scan history, the rendered webview output for that
 * entry shall contain the barcode text, barcode format, and a formatted
 * timestamp string.
 *
 * Tag: Feature: barcode-scanning, Property 3: Webview renders all scan entry fields
 * Validates: Requirements 5.2
 */
describe('Feature: barcode-scanning, Property 3: Webview renders all scan entry fields', () => {
  const scanEntryArb = fc.record({
    text: fc.stringMatching(/^[A-Za-z0-9]{1,50}$/),
    format: fc.constantFrom('QR_CODE', 'CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'UPC_A'),
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  });

  it('rendered output contains text, format, and timestamp for every scan entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(scanEntryArb, { minLength: 1, maxLength: 5 }),
        async (scans: ScanEntry[]) => {
          const html = await ejs.renderFile(templatePath, {
            userId: 'test-user',
            scans,
          });

          for (const scan of scans) {
            expect(html).toContain(scan.text);
            expect(html).toContain(scan.format);
            expect(html).toContain(new Date(scan.timestamp).toLocaleString());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rendered output shows "No scans" message when scans array is empty', async () => {
    const html = await ejs.renderFile(templatePath, {
      userId: 'test-user',
      scans: [],
    });
    expect(html).toContain('No scans available.');
  });
});
