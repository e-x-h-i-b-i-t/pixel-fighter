/**
 * RLSyncService — Client-side bridge between the game and the global RL API server.
 *
 * Responsibilities:
 *  - Fetch the global Q-table before each adaptive match
 *  - Upload the local Q-table delta (only updated states) after each match
 *  - Fetch global training stats for the UI panel
 *
 * Failure mode: ALL methods degrade gracefully — if the server is unreachable
 * the game continues in local-only mode with no error shown to the player.
 */

const API_BASE = import.meta.env.VITE_RL_API_URL ?? 'http://localhost:4000/api/ai';
const TIMEOUT_MS = 5000;

export class RLSyncService {
  /**
   * Download the global Q-table from the server.
   * Merges it into the local agent so the player benefits from all prior training.
   *
   * @returns {Promise<{ qTable: Object, totalMatchCount: number, epsilon: number }|null>}
   *   Returns null if the server is unreachable (graceful degradation).
   */
  static async fetchGlobalQTable() {
    try {
      const res = await fetch(`${API_BASE}/qtable`, {
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[RL] Could not fetch global Q-table (offline mode):', err.message);
      return null;
    }
  }

  /**
   * Upload the player's local Q-table delta to the global server.
   * Only sends states that were updated during this match — not the full Q-table.
   * Fire-and-forget: doesn't block game flow or show errors to the player.
   *
   * @param {Object} updatedStates  - { stateKey: { action: qValue } } — delta only
   * @param {number} matchCount     - Number of matches this delta represents (usually 1)
   */
  static async contributeQTable(updatedStates, matchCount = 1) {
    if (!updatedStates || Object.keys(updatedStates).length === 0) return;

    try {
      const SECRET = import.meta.env.VITE_RL_SECRET ?? 'pixel-fighter-rl-secret';
      const bodyPayload = JSON.stringify({ qTable: updatedStates, matchCount });
      const signature = await signPayload(bodyPayload, SECRET);

      const res = await fetch(`${API_BASE}/contribute`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rl-signature': signature
        },
        body:    bodyPayload,
        signal:  AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('[RL] Server rejected contribution:', body.error ?? res.status);
      } else {
        const { totalMatchCount, updatedPairs } = await res.json();
        console.log(`[RL] Contributed ${updatedPairs} Q-pairs. Global matches: ${totalMatchCount}`);
      }
    } catch (err) {
      // Silently fail — the player's game is never affected by upload failures
      console.warn('[RL] Could not upload Q-table delta (offline mode):', err.message);
    }
  }

  /**
   * Fetch global training statistics from the server.
   * Used to populate the RL stats panel after a match.
   *
   * @returns {Promise<{ totalMatchCount: number, statesKnown: number, lastUpdated: string }|null>}
   */
  static async fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/stats`, {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return null;
    }
  }
}

/**
 * Computes HMAC SHA-256 signature for client-server auth verification.
 */
async function signPayload(message, secretKey) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    // Fallback/stub for non-browser/test environments if subtle is missing
    return 'fallback-signature';
  }
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const msgData = encoder.encode(message);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await window.crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      msgData
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('[RL] Error signing payload:', err);
    return '';
  }
}

