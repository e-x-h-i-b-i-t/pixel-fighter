import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RLSyncService } from '../../src/ai/RLSyncService.js';

describe('RLSyncService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchGlobalQTable', () => {
    it('returns global Q-table on successful response', async () => {
      const mockData = { qTable: { 'state1': { 'idle': 1.0 } }, totalMatchCount: 10, epsilon: 0.05 };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData
      });

      const result = await RLSyncService.fetchGlobalQTable();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockData);
    });

    it('returns null and warns when response is not ok', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await RLSyncService.fetchGlobalQTable();
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('returns null and warns on network error', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await RLSyncService.fetchGlobalQTable();
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('contributeQTable', () => {
    it('does not call fetch if updatedStates is empty or null', async () => {
      await RLSyncService.contributeQTable(null);
      await RLSyncService.contributeQTable({});
      expect(fetch).not.toHaveBeenCalled();
    });

    it('makes POST request with JSON payload when states exist', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, totalMatchCount: 11, updatedPairs: 1 })
      });

      const delta = { 'state1': { 'idle': 1.5 } };
      await RLSyncService.contributeQTable(delta, 1);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, options] = fetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        'x-rl-signature': 'fallback-signature'
      });
      expect(JSON.parse(options.body)).toEqual({ qTable: delta, matchCount: 1 });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('warns but does not crash if server rejects contribution', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid key' })
      });

      const delta = { 'state1': { 'idle': 1.5 } };
      await RLSyncService.contributeQTable(delta, 1);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('warns but does not crash on network error during contribution', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      fetch.mockRejectedValueOnce(new Error('Timeout'));

      const delta = { 'state1': { 'idle': 1.5 } };
      await RLSyncService.contributeQTable(delta, 1);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('fetchStats', () => {
    it('returns stats on successful fetch', async () => {
      const mockStats = { totalMatchCount: 100, statesKnown: 250, lastUpdated: '2026-06-18' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      });

      const result = await RLSyncService.fetchStats();
      expect(result).toEqual(mockStats);
    });

    it('returns null on failure', async () => {
      fetch.mockResolvedValueOnce({ ok: false });
      const result = await RLSyncService.fetchStats();
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await RLSyncService.fetchStats();
      expect(result).toBeNull();
    });
  });
});
