import fs   from 'fs/promises';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QTABLE_PATH  = path.resolve(__dirname, 'qtable.json');
const ALPHA_GLOBAL = 0.10;   // Conservative merge rate — one player can't corrupt the table
const QVALUE_MIN   = -50;    // Clamp to prevent runaway Q-values
const QVALUE_MAX   = +50;

// Valid state key format: "very_close|mid|high|1|0|1|0"
const STATE_KEY_REGEX =
  /^(very_close|close|mid|far)\|(crit|low|mid|high)\|(crit|low|mid|high)\|[01]\|[01]\|[01]\|[01]$/;

const VALID_ACTIONS = new Set([
  'move_toward','move_away','idle','jump',
  'light_attack','heavy_attack','parry','dash','roll'
]);

const DEFAULT_STATE = {
  qTable:            {},
  totalMatchCount:   0,
  totalContributors: 0,
  lastUpdated:       null
};

// ── File lock (simple in-process mutex) ──────────────────────────────────────
// Prevents concurrent writes from corrupting the JSON file.
let writeLock = Promise.resolve();

async function withLock(fn) {
  writeLock = writeLock.then(fn).catch(fn);
  return writeLock;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load the global Q-table from disk.
 * Returns DEFAULT_STATE if the file doesn't exist yet.
 * @returns {Promise<Object>}
 */
export async function loadQTable() {
  try {
    const raw = await fs.readFile(QTABLE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Persist the global Q-table to disk.
 * @param {Object} data
 */
export async function saveQTable(data) {
  await fs.writeFile(QTABLE_PATH, JSON.stringify(data), 'utf-8');
}

/**
 * Validate and sanitize a player-contributed Q-table delta.
 * Returns { valid: boolean, error?: string, sanitized?: Object }
 * @param {Object} playerQTable
 */
export function validateQTableDelta(playerQTable) {
  if (!playerQTable || typeof playerQTable !== 'object') {
    return { valid: false, error: 'qTable must be a non-null object' };
  }

  const sanitized = {};

  for (const [state, actions] of Object.entries(playerQTable)) {
    // Validate state key format
    if (!STATE_KEY_REGEX.test(state)) {
      return { valid: false, error: `Invalid state key format: "${state}"` };
    }
    if (typeof actions !== 'object' || actions === null) {
      return { valid: false, error: `Actions for state "${state}" must be an object` };
    }

    sanitized[state] = {};
    for (const [action, qValue] of Object.entries(actions)) {
      // Validate action name
      if (!VALID_ACTIONS.has(action)) {
        return { valid: false, error: `Unknown action: "${action}"` };
      }
      // Validate Q-value is a finite number
      if (typeof qValue !== 'number' || !Number.isFinite(qValue)) {
        return { valid: false, error: `Q-value for (${state}, ${action}) must be a finite number` };
      }
      // Clamp Q-values to prevent runaway exploitation
      sanitized[state][action] = Math.max(QVALUE_MIN, Math.min(QVALUE_MAX, qValue));
    }
  }

  return { valid: true, sanitized };
}

/**
 * Merge a player's Q-table delta into the global Q-table.
 * Uses a weighted exponential moving average (α_global = 0.10).
 *
 * global_Q(s,a) ← global_Q(s,a) + α × (player_Q(s,a) − global_Q(s,a))
 *
 * @param {Object} sanitizedDelta  - Already validated & clamped delta
 * @param {number} matchCount      - Number of matches this delta represents
 * @returns {Promise<{ updatedPairs: number, totalMatchCount: number }>}
 */
export async function mergeContribution(sanitizedDelta, matchCount) {
  return withLock(async () => {
    const global = await loadQTable();
    let updatedPairs = 0;

    for (const [state, actions] of Object.entries(sanitizedDelta)) {
      if (!global.qTable[state]) global.qTable[state] = {};

      for (const [action, playerQ] of Object.entries(actions)) {
        const currentGlobalQ = global.qTable[state][action] ?? 0;
        const merged = currentGlobalQ + ALPHA_GLOBAL * (playerQ - currentGlobalQ);
        global.qTable[state][action] = Math.max(QVALUE_MIN, Math.min(QVALUE_MAX, merged));
        updatedPairs++;
      }
    }

    global.totalMatchCount   += (matchCount || 1);
    global.totalContributors += 1;
    global.lastUpdated        = new Date().toISOString();

    await saveQTable(global);
    return { updatedPairs, totalMatchCount: global.totalMatchCount };
  });
}
