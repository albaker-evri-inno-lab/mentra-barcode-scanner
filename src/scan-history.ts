export interface ScanEntry {
  text: string;
  format: string;
  timestamp: Date;
}

const scanHistory = new Map<string, ScanEntry[]>();

export function addScan(userId: string, entry: ScanEntry): void {
  const scans = scanHistory.get(userId) ?? [];
  scans.push(entry);
  scanHistory.set(userId, scans);
}

export function getScans(userId: string): ScanEntry[] {
  return scanHistory.get(userId) ?? [];
}

export function clearScans(userId: string): void {
  scanHistory.delete(userId);
}
