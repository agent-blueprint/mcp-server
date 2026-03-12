import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { saveToken, loadToken } from '../token-store.js';

describe('token-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveToken', () => {
    it('creates config dir and writes token with restricted permissions', () => {
      saveToken('ab_live_test123');

      expect(mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('agentblueprint'),
        { recursive: true }
      );
      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.stringContaining('"apiKey": "ab_live_test123"'),
        { encoding: 'utf-8', mode: 0o600 }
      );
    });

    it('includes apiUrl when provided', () => {
      saveToken('ab_live_test123', 'http://localhost:3000');

      const written = (writeFileSync as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      const parsed = JSON.parse(written);
      expect(parsed.apiKey).toBe('ab_live_test123');
      expect(parsed.apiUrl).toBe('http://localhost:3000');
    });

    it('omits apiUrl when not provided', () => {
      saveToken('ab_live_test123');

      const written = (writeFileSync as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      const parsed = JSON.parse(written);
      expect(parsed.apiUrl).toBeUndefined();
    });
  });

  describe('loadToken', () => {
    it('returns stored config when file exists', () => {
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ apiKey: 'ab_live_stored', apiUrl: 'https://custom.example.com' })
      );

      const result = loadToken();
      expect(result).toEqual({
        apiKey: 'ab_live_stored',
        apiUrl: 'https://custom.example.com',
      });
    });

    it('returns null when file does not exist', () => {
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(loadToken()).toBeNull();
    });

    it('returns null when file contains invalid JSON', () => {
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue('not json');

      expect(loadToken()).toBeNull();
    });

    it('returns null when apiKey is empty', () => {
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ apiKey: '' })
      );

      expect(loadToken()).toBeNull();
    });
  });
});
