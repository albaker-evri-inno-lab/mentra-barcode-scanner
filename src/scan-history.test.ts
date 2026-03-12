import { describe, it, expect, beforeEach } from 'bun:test';
import fc from 'fast-check';
import { addScan, getScans, clearScans, type ScanEntry } from './scan-history';

/**
 * Property 2: Scan history round-trip
 *
 * For any ScanEntry with arbitrary text, format, and timestamp, calling
 * addScan(userId, entry) followed by getScans(userId) shall return an array
 * containing an entry with identical text, format, and timestamp values.
 *
 * Tag: Feature: barcode-scanning, Property 2: Scan history round-trip
 * Validates: Requirements 4.1
 */
describe('Feature: barcode-scanning, Property 2: Scan history round-trip', () => {
  const userIdArb = fc.string({ minLength: 1 });

  const scanEntryArb = fc.record({
    text: fc.string({ minLength: 1 }),
    format: fc.string({ minLength: 1 }),
    timestamp: fc.date(),
  });

  beforeEach(() => {
    // Clear all possible state to prevent leaking between runs.
    // We use a unique userId per property run, but clean up as a safety net.
  });

  it('addScan followed by getScans returns the stored entry', () => {
    fc.assert(
      fc.property(userIdArb, scanEntryArb, (userId: string, entry: ScanEntry) => {
        // Clean state before each iteration
        clearScans(userId);

        addScan(userId, entry);
        const scans = getScans(userId);

        expect(scans.length).toBeGreaterThanOrEqual(1);

        const match = scans.find(
          (s) =>
            s.text === entry.text &&
            s.format === entry.format &&
            s.timestamp.getTime() === entry.timestamp.getTime(),
        );
        expect(match).toBeDefined();

        // Clean up after iteration
        clearScans(userId);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Scan history unit tests', () => {
  beforeEach(() => {
    clearScans('user-1');
    clearScans('user-2');
  });

  it('addScan stores an entry and getScans retrieves it', () => {
    const entry: ScanEntry = { text: '12345', format: 'EAN-13', timestamp: new Date('2025-01-01T00:00:00Z') };
    addScan('user-1', entry);

    const scans = getScans('user-1');
    expect(scans).toHaveLength(1);
    expect(scans[0].text).toBe('12345');
    expect(scans[0].format).toBe('EAN-13');
    expect(scans[0].timestamp.getTime()).toBe(entry.timestamp.getTime());
  });

  it('addScan stores multiple entries for the same user', () => {
    addScan('user-1', { text: 'AAA', format: 'QR_CODE', timestamp: new Date() });
    addScan('user-1', { text: 'BBB', format: 'CODE_128', timestamp: new Date() });

    const scans = getScans('user-1');
    expect(scans).toHaveLength(2);
    expect(scans[0].text).toBe('AAA');
    expect(scans[1].text).toBe('BBB');
  });

  it('getScans returns empty array for unknown user', () => {
    const scans = getScans('no-such-user');
    expect(scans).toEqual([]);
  });

  it('clearScans empties the history for a user', () => {
    addScan('user-1', { text: 'X', format: 'CODE_39', timestamp: new Date() });
    expect(getScans('user-1')).toHaveLength(1);

    clearScans('user-1');
    expect(getScans('user-1')).toEqual([]);
  });

  it('clearScans for one user does not affect another user', () => {
    addScan('user-1', { text: 'A', format: 'QR_CODE', timestamp: new Date() });
    addScan('user-2', { text: 'B', format: 'EAN-8', timestamp: new Date() });

    clearScans('user-1');

    expect(getScans('user-1')).toEqual([]);
    expect(getScans('user-2')).toHaveLength(1);
    expect(getScans('user-2')[0].text).toBe('B');
  });
});
