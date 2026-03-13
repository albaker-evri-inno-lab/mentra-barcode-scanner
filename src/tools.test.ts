import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { handleToolCall } from './tools';
import type { ToolCall, AppSession } from '@mentra/sdk';

// Mock barcode-decoder module
const mockDecodeBarcode = mock(() => Promise.resolve([{ text: '12345', format: 'EAN_13' }]));
mock.module('./barcode-decoder', () => ({
  decodeBarcode: mockDecodeBarcode,
}));

// Mock scan-history module
const mockAddScan = mock(() => {});
mock.module('./scan-history', () => ({
  addScan: mockAddScan,
}));

function makeToolCall(toolId: string): ToolCall {
  return {
    toolId,
    timestamp: Date.now(),
    userId: 'user-1',
    toolParameters: {},
  } as ToolCall;
}

function makeSession(overrides: {
  enabled?: boolean;
  requestPhotoResult?: Buffer | Error;
} = {}): AppSession {
  const { enabled = true, requestPhotoResult = Buffer.from('fake-image') } = overrides;

  return {
    settings: {
      get: mock((key: string, defaultValue: boolean) => {
        if (key === 'enable_barcode_scanning') return enabled;
        return defaultValue;
      }),
    },
    camera: {
      requestPhoto: mock(() => {
        if (requestPhotoResult instanceof Error) return Promise.reject(requestPhotoResult);
        return Promise.resolve({
          buffer: requestPhotoResult,
          mimeType: 'image/jpeg',
          filename: 'photo.jpg',
          requestId: 'req-1',
          size: (requestPhotoResult as Buffer).length,
          timestamp: new Date(),
        });
      }),
    },
    layouts: {
      showTextWall: mock(() => {}),
    },
  } as unknown as AppSession;
}

describe('scan_barcode tool handler', () => {
  beforeEach(() => {
    mockDecodeBarcode.mockReset();
    mockAddScan.mockReset();
    mockDecodeBarcode.mockResolvedValue([{ text: '12345', format: 'EAN_13' }]);
  });

  it('returns error when no active session exists', async () => {
    const result = await handleToolCall(makeToolCall('scan_barcode'), 'user-1', undefined);
    expect(result).toBe('Error: No active session');
  });

  it('returns disabled message when barcode scanning is off', async () => {
    const session = makeSession({ enabled: false });
    const result = await handleToolCall(makeToolCall('scan_barcode'), 'user-1', session);
    expect(result).toBe('Barcode scanning is disabled');
    expect(session.camera.requestPhoto).not.toHaveBeenCalled();
  });

  it('returns error and displays message when camera capture fails', async () => {
    const session = makeSession({ requestPhotoResult: new Error('camera offline') });
    const result = await handleToolCall(makeToolCall('scan_barcode'), 'user-1', session);
    expect(result).toBe('Scan failed: could not capture image');
    expect(session.layouts.showTextWall).toHaveBeenCalledWith('Scan failed: could not capture image');
  });

  it('displays "No barcode found" when decoder returns empty array', async () => {
    mockDecodeBarcode.mockResolvedValue([]);
    const session = makeSession();
    const result = await handleToolCall(makeToolCall('scan_barcode'), 'user-1', session);
    expect(result).toBe('No barcode found');
    expect(session.layouts.showTextWall).toHaveBeenCalledWith('No barcode found');
    expect(mockAddScan).not.toHaveBeenCalled();
  });

  it('decodes barcode, stores in history, and displays result', async () => {
    mockDecodeBarcode.mockResolvedValue([{ text: 'ABC-123', format: 'CODE_128' }]);
    const session = makeSession();
    const result = await handleToolCall(makeToolCall('scan_barcode'), 'user-1', session);

    expect(session.camera.requestPhoto).toHaveBeenCalled();
    expect(mockDecodeBarcode).toHaveBeenCalled();
    expect(mockAddScan).toHaveBeenCalledWith('user-1', expect.objectContaining({
      text: 'ABC-123',
      format: 'CODE_128',
    }));
    expect(session.layouts.showTextWall).toHaveBeenCalledWith('CODE_128: ABC-123');
    expect(result).toBe('CODE_128: ABC-123');
  });

  it('returns error and displays message when decoder throws', async () => {
    mockDecodeBarcode.mockRejectedValue(new Error('decode failure'));
    const session = makeSession();
    const result = await handleToolCall(makeToolCall('scan_barcode'), 'user-1', session);
    expect(result).toBe('Error decoding barcode');
    expect(session.layouts.showTextWall).toHaveBeenCalledWith('Error decoding barcode');
  });

  it('returns undefined for unknown tool IDs', async () => {
    const session = makeSession();
    const result = await handleToolCall(makeToolCall('unknown_tool'), 'user-1', session);
    expect(result).toBeUndefined();
  });
});
