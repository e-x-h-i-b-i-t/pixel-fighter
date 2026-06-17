# Reinforcement Learning AI — Implementation Plan
> Pixel Sword Fighter · Global Federated Q-Learning Opponent

---

## Overview

A **globally shared AI** where every player's matches contribute to training the same Q-table, stored on a central server. Each player downloads the global Q-table before a fight, trains it locally, and uploads their updates after the match — like crowdsourced brain training.

```
Player A fights → uploads Q-delta → Global Q-table improves
Player B fights → downloads improved Q-table → fights smarter AI → uploads delta
Player C fights → even smarter AI → ...
```

This is a simplified form of **Federated Q-Learning** — no ML server, no GPU, just a lightweight Node.js REST API.

---

## Architecture

```
┌─────────────────────────────────────┐
│           Browser (Client)          │
│                                     │
│  RLAgent.js   ←──────────────────┐  │
│  (local Q-table during fight)    │  │
│        │                         │  │
│  RLSyncService.js                │  │
│   ├── GET  /api/ai/qtable  ──────┘  │  ← fetch before match
│   └── POST /api/ai/contribute  ─────┼──→ push delta after match
└─────────────────────────────────────┘
                    │
          ┌─────────▼──────────┐
          │   Express.js API   │
          │   server/          │
          │                    │
          │  GET  /api/ai/qtable       → serve global Q-table JSON
          │  POST /api/ai/contribute   → merge player delta into global
          │  GET  /api/ai/stats        → training statistics
          └─────────┬──────────┘
                    │
          ┌─────────▼──────────┐
          │   Storage Layer    │
          │                    │
          │  qtable.json       │  ← Phase 1 (file-based, simple)
          │  OR PostgreSQL     │  ← Phase 2 (scale, concurrent writes)
          └────────────────────┘
```

---

## Algorithm: Federated Q-Learning Merge

When a player uploads their match delta, the server merges it into the global Q-table using a **weighted exponential moving average**:

```
For each (state, action) the player updated this match:

  global_Q[s][a] = global_Q[s][a] + α_global × (player_Q[s][a] - global_Q[s][a])

Where α_global = 0.10  (global learning rate — conservative to avoid one player corrupting the table)
```

This means:
- One player's bad match can't ruin the global AI
- Popular states (visited by many players) converge fast
- Rare states (unusual situations) update slowly but correctly

---

## Hyperparameters

| Parameter | Value | Notes |
|---|---|---|
| α local (client) | `0.15` | Per-tick local Q-updates |
| α global (server) | `0.10` | Conservative merge rate |
| γ (discount factor) | `0.90` | Both client and server |
| ε start | `0.40` | Per-client, decays locally |
| ε min | `0.05` | Floor for each client |
| ε decay | `× 0.97` per match | Each client decays independently |
| Min matches to merge | `1` | No minimum — every match contributes |

---

## State Space (unchanged from local plan)

```
"<dist>|<p1hp>|<aihp>|<p1atk>|<air>|<stam>|<ult>"
Example: "close|mid|high|1|0|1|0"
```

**1,024 states × 9 actions = 9,216 Q-values** (~72 KB JSON — fast to transfer)

---

## File Structure

```
pixel-sword-fighter/
  server/
    index.js                  ← Express server entry point
    routes/
      qtable.js               ← GET /api/ai/qtable, POST /api/ai/contribute, GET /api/ai/stats
    storage/
      qtableStore.js          ← Read/write/merge Q-table (file or DB)
      qtable.json             ← Global Q-table (auto-created if missing)
    middleware/
      rateLimit.js            ← Prevent spam contributions
    package.json              ← Server dependencies (express, cors)
    .env.example              ← PORT, STORAGE_TYPE, DB_URL (optional)
    Dockerfile                ← Container for deployment
  src/
    ai/
      RLAgent.js              ← Local Q-Learning agent (same as before)
      StateEncoder.js         ← ECS state → discrete string key
      RewardCalculator.js     ← Per-tick + end-of-match rewards
      RLSyncService.js        ← NEW: fetch global Q-table, push delta to server
    systems/
      01-ai/
        AISystem.js           ← MODIFY: route to RL when difficulty = 'adaptive'
    core/
      SaveManager.js          ← MODIFY: add local Q-table cache methods
      UIManager.js            ← MODIFY: show RL stats panel
    index.css                 ← MODIFY: style RL panel
  index.html                  ← MODIFY: add Adaptive difficulty + stats panel
  tests/unit/
    rlAgent.test.js           ← Unit tests
    rlSyncService.test.js     ← API mock tests
  docker-compose.yml          ← Run game + API together
```

---

## Server Implementation

### `server/package.json`
```json
{
  "name": "pixel-fighter-rl-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5"
  }
}
```

---

### `server/storage/qtableStore.js`

```js
import fs from 'fs/promises';
import path from 'path';

const QTABLE_PATH = path.resolve('./storage/qtable.json');
const ALPHA_GLOBAL = 0.10;

// Initial empty Q-table structure
const DEFAULT_STATE = {
  qTable: {},
  totalMatchCount: 0,
  totalContributors: 0,
  lastUpdated: null
};

export async function loadQTable() {
  try {
    const raw = await fs.readFile(QTABLE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveQTable(data) {
  await fs.writeFile(QTABLE_PATH, JSON.stringify(data), 'utf-8');
}

/**
 * Merges a player's Q-table delta into the global Q-table.
 * Uses weighted exponential moving average per state-action pair.
 *
 * @param {Object} playerQTable - The player's local qTable { stateKey: { action: float } }
 * @param {number} playerMatchCount - How many matches the player trained
 */
export async function mergeContribution(playerQTable, playerMatchCount) {
  const global = await loadQTable();

  let updatedPairs = 0;

  for (const [state, actions] of Object.entries(playerQTable)) {
    if (!global.qTable[state]) {
      global.qTable[state] = {};
    }
    for (const [action, playerQ] of Object.entries(actions)) {
      const currentGlobalQ = global.qTable[state][action] ?? 0;
      // Weighted merge: conservative α_global = 0.10
      global.qTable[state][action] = currentGlobalQ + ALPHA_GLOBAL * (playerQ - currentGlobalQ);
      updatedPairs++;
    }
  }

  global.totalMatchCount += playerMatchCount;
  global.totalContributors += 1;
  global.lastUpdated = new Date().toISOString();

  await saveQTable(global);

  return { updatedPairs, totalMatchCount: global.totalMatchCount };
}
```

---

### `server/routes/qtable.js`

```js
import express from 'express';
import { loadQTable, mergeContribution } from '../storage/qtableStore.js';

export const router = express.Router();

// GET /api/ai/qtable
// Returns the global Q-table for clients to download before a match
router.get('/qtable', async (req, res) => {
  try {
    const data = await loadQTable();
    res.json({
      qTable: data.qTable,
      epsilon: 0.05,           // Global AI always uses low exploration (exploit mode)
      totalMatchCount: data.totalMatchCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load Q-table' });
  }
});

// POST /api/ai/contribute
// Player uploads their local Q-table delta after a match
// Body: { qTable: {...}, matchCount: number, winner: 'player'|'ai' }
router.post('/contribute', async (req, res) => {
  const { qTable, matchCount } = req.body;

  if (!qTable || typeof qTable !== 'object') {
    return res.status(400).json({ error: 'Invalid Q-table payload' });
  }

  try {
    const result = await mergeContribution(qTable, matchCount || 1);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to merge contribution' });
  }
});

// GET /api/ai/stats
// Global training statistics (for a stats dashboard or debug panel)
router.get('/stats', async (req, res) => {
  const data = await loadQTable();
  res.json({
    totalMatchCount:    data.totalMatchCount,
    totalContributors:  data.totalContributors,
    statesKnown:        Object.keys(data.qTable).length,
    lastUpdated:        data.lastUpdated
  });
});
```

---

### `server/index.js`

```js
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { router as qtableRouter } from './routes/qtable.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' })); // Q-table is ~72KB

// Rate limiting: max 10 contributions per IP per minute
const limiter = rateLimit({ windowMs: 60_000, max: 10 });
app.use('/api/ai/contribute', limiter);

app.use('/api/ai', qtableRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`RL API server running on http://localhost:${PORT}`);
});
```

---

## Client Implementation

### `src/ai/RLSyncService.js` (NEW)

```js
const API_BASE = import.meta.env.VITE_RL_API_URL || 'http://localhost:4000/api/ai';

export class RLSyncService {
  /**
   * Fetches the global Q-table from the server.
   * Falls back to empty table if server is unreachable.
   */
  static async fetchGlobalQTable() {
    try {
      const res = await fetch(`${API_BASE}/qtable`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error('Server error');
      return await res.json();
    } catch (err) {
      console.warn('[RL] Could not fetch global Q-table, starting fresh:', err.message);
      return null; // Graceful degradation — local-only mode
    }
  }

  /**
   * Sends the player's local Q-table to the server for merging.
   * Fire-and-forget — doesn't block game flow.
   */
  static async contributeQTable(localQTable, matchCount) {
    try {
      await fetch(`${API_BASE}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qTable: localQTable, matchCount }),
        signal: AbortSignal.timeout(5000)
      });
    } catch (err) {
      console.warn('[RL] Could not contribute Q-table:', err.message);
      // Silently fail — player's match is not affected
    }
  }

  /**
   * Fetches global training stats for the UI panel.
   */
  static async fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/stats`, { signal: AbortSignal.timeout(2000) });
      return await res.json();
    } catch {
      return null;
    }
  }
}
```

---

### Updated `RLAgent.js` (key change: load from global)

```js
import { RLSyncService } from './RLSyncService.js';

export class RLAgent {
  constructor() {
    this.qTable      = {};     // Populated from global server
    this.epsilon     = 0.40;   // Client's local exploration rate
    this.alpha       = 0.15;
    this.gamma       = 0.90;
    this.matchCount  = 0;
    this.lastState   = null;
    this.lastAction  = null;
    this._updatedStates = {}; // Track only states changed THIS match
  }

  // Initialize from global Q-table before a match
  async initFromGlobal() {
    const global = await RLSyncService.fetchGlobalQTable();
    if (global?.qTable) {
      this.qTable = global.qTable;
      console.log(`[RL] Loaded global Q-table: ${Object.keys(this.qTable).length} states known`);
    }
    this._updatedStates = {}; // Reset delta tracker
  }

  update(state, action, reward, nextState) {
    const currentQ = this._getQ(state, action);
    const maxNextQ = Math.max(...ACTIONS.map(a => this._getQ(nextState, a)));
    const newQ = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);
    this._setQ(state, action, newQ);

    // Track this state as updated this match (for delta upload)
    if (!this._updatedStates[state]) this._updatedStates[state] = {};
    this._updatedStates[state][action] = newQ;
  }

  async onMatchEnd(matchReward) {
    if (this.lastState && this.lastAction) {
      this.update(this.lastState, this.lastAction, matchReward, '__terminal__');
    }
    this.matchCount++;
    this.epsilon = Math.max(EPSILON_MIN, this.epsilon * EPSILON_DECAY);
    this.lastState  = null;
    this.lastAction = null;

    // Upload only the states updated this match (not full Q-table)
    await RLSyncService.contributeQTable(this._updatedStates, 1);
    this._updatedStates = {};
  }

  // ... rest of methods unchanged (chooseAction, _getQ, _setQ, getStats)
}
```

---

### Updated `main.js` (match lifecycle)

```js
import { RLAgent }          from './ai/RLAgent.js';
import { RLSyncService }    from './ai/RLSyncService.js';
import { RewardCalculator } from './ai/RewardCalculator.js';
import { encodeState }      from './ai/StateEncoder.js';

const rlAgent    = new RLAgent();
const rewardCalc = new RewardCalculator();

// In startMatch() — fetch global Q-table BEFORE match starts
const startMatch = async (p1Opts, p2Opts, arenaId) => {
  if (p2Opts.difficulty === 'adaptive') {
    await rlAgent.initFromGlobal(); // Download latest global AI brain
  }
  // ... rest of startMatch unchanged
};

// In update() game loop (per-tick RL update — unchanged from local plan)
if (p2Opts.difficulty === 'adaptive') { ... }

// On match end — upload delta to server (fire-and-forget)
// rlAgent.onMatchEnd() handles the upload internally
```

---

## Environment Configuration

### `.env.example` (client)
```
VITE_RL_API_URL=http://localhost:4000/api/ai
```

### `server/.env.example`
```
PORT=4000
STORAGE_TYPE=file          # 'file' | 'postgres' (future)
```

---

## Deployment

### Local Development (two terminals)

```bash
# Terminal 1 — Game client
npm run dev

# Terminal 2 — RL API server
cd server
npm install
npm run dev
```

### Docker Compose (single command)

**`docker-compose.yml`**:
```yaml
version: '3.8'
services:
  game:
    build: .
    ports:
      - "3000:3000"
    environment:
      - VITE_RL_API_URL=http://rl-api:4000/api/ai

  rl-api:
    build: ./server
    ports:
      - "4000:4000"
    volumes:
      - rl_data:/app/storage

volumes:
  rl_data:
```

```bash
docker-compose up
```

### Free Cloud Deployment Options

| Platform | Cost | Notes |
|---|---|---|
| **Railway** | Free tier | Deploy from GitHub, auto-deploys on push |
| **Render** | Free tier | 750 hrs/month free, persists volumes |
| **Fly.io** | Free tier | Global edge, good latency worldwide |
| **VPS** | ~$5/month | Full control, any cloud provider |

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/ai/qtable` | `GET` | Download global Q-table (before match) |
| `/api/ai/contribute` | `POST` | Upload match delta (after match) |
| `/api/ai/stats` | `GET` | Global training statistics |
| `/health` | `GET` | Server health check |

### Example: Download Q-table
```bash
curl http://localhost:4000/api/ai/qtable
# → { "qTable": {...}, "totalMatchCount": 247, "epsilon": 0.05 }
```

### Example: Upload contribution
```bash
curl -X POST http://localhost:4000/api/ai/contribute \
  -H "Content-Type: application/json" \
  -d '{ "qTable": { "close|mid|high|1|0|1|0": { "parry": 4.2 } }, "matchCount": 1 }'
# → { "success": true, "updatedPairs": 38, "totalMatchCount": 248 }
```

---

## Graceful Degradation (Offline Mode)

If the server is unreachable, the game still works:

```
Server unreachable → RLSyncService returns null
                   → RLAgent starts with empty local Q-table
                   → AI plays randomly (like fresh start)
                   → Contributions silently fail (no crash)
                   → Player experience is unaffected
```

---

## Unit Tests

### `tests/unit/rlAgent.test.js`
- Q-value initializes to 0 for unknown state
- Q-value increases after positive reward
- Only updated states are included in delta upload (`_updatedStates`)
- ε decays correctly on `onMatchEnd()`
- `initFromGlobal()` merges global Q-table into local

### `tests/unit/rlSyncService.test.js`
- `fetchGlobalQTable()` returns null on network error (no throw)
- `contributeQTable()` silently ignores 500 server errors
- Correct JSON payload shape sent to `/api/ai/contribute`

---

## Training Progress (Global)

Since ALL players contribute, the global AI trains much faster than individual local training:

| Global Matches | Behavior |
|---|---|
| 0–50 | Basic: learns to chase and attack |
| 50–200 | Tactical: parries, uses ultimates, jumps over attacks |
| 200–500 | Hard-equivalent: punishes predictable patterns |
| 500–1000 | Nightmare-equivalent: reads timing, combo-extends |
| 1000+ | Near-optimal: beats most players consistently |

With 10 active players: Hard-level in **~3–5 minutes** of total gameplay.
With 100 active players: Hard-level in **seconds** of total gameplay.

---

## Open Questions

1. **Auth / anti-cheat** — Should contributions require a signed token to prevent players from manually sending fake high-reward Q-values to corrupt the global table? (Simple fix: HMAC signature on payload)

2. **Per-character-class tables** — One global Q-table for all classes, or separate per class (`rl_qtable_knight`, `rl_qtable_samurai`, etc.)?

3. **Q-table versioning** — If game balance changes (damage values, move costs), old Q-table values may be misleading. Add a `schemaVersion` field to invalidate stale data?

4. **PostgreSQL migration** — File-based JSON works for a solo project but concurrent writes from many players may cause race conditions. Phase 2: PostgreSQL with row locking per state key.

---

## Security & Anti-Cheat

Without protection, anyone can POST fake Q-values and corrupt the global AI brain.

### Threat Model

| Threat | Risk | Mitigation |
|---|---|---|
| Fake contributions (forged Q-values) | Corrupts global AI | HMAC signature on payload |
| Spam contributions | DDoS / overwrite attack | Rate limiter (already in plan) |
| Extreme Q-values | Destabilizes learning | Clamp Q-values to `[-50, +50]` server-side |
| State key injection | Expand Q-table to gigabytes | Validate state key format with regex |

### Implementation: HMAC Payload Signing

**Server** generates and embeds a shared secret in the game bundle (not ideal for open source, but sufficient for casual anti-cheat):

```js
// server/middleware/verifySignature.js
import crypto from 'crypto';

const SECRET = process.env.RL_SECRET || 'pixel-fighter-rl-secret';

export function verifySignature(req, res, next) {
  const signature = req.headers['x-rl-signature'];
  const body      = JSON.stringify(req.body);
  const expected  = crypto.createHmac('sha256', SECRET).update(body).digest('hex');

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  next();
}
```

```js
// src/ai/RLSyncService.js — sign before upload
const SECRET = import.meta.env.VITE_RL_SECRET || 'pixel-fighter-rl-secret';

static async contributeQTable(localQTable, matchCount) {
  const body      = JSON.stringify({ qTable: localQTable, matchCount });
  const signature = await signPayload(body, SECRET); // HMAC SHA-256

  await fetch(`${API_BASE}/contribute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rl-signature': signature
    },
    body
  });
}
```

### Server-side Q-value Clamping

```js
// In qtableStore.js mergeContribution():
const QVALUE_MIN = -50;
const QVALUE_MAX = +50;

global.qTable[state][action] = Math.max(QVALUE_MIN,
  Math.min(QVALUE_MAX,
    currentGlobalQ + ALPHA_GLOBAL * (playerQ - currentGlobalQ)
  )
);
```

### State Key Validation

```js
// Valid format: "very_close|mid|high|1|0|1|0"
const STATE_KEY_REGEX = /^(very_close|close|mid|far)\|(crit|low|mid|high)\|(crit|low|mid|high)\|[01]\|[01]\|[01]\|[01]$/;

for (const state of Object.keys(playerQTable)) {
  if (!STATE_KEY_REGEX.test(state)) {
    return res.status(400).json({ error: `Invalid state key: ${state}` });
  }
}
```

---

## Phase 2: PostgreSQL Storage

When concurrent players cause file write race conditions, migrate to PostgreSQL.

### Schema

```sql
CREATE TABLE qtable (
  state_key   VARCHAR(64)    NOT NULL,
  action      VARCHAR(32)    NOT NULL,
  q_value     DOUBLE PRECISION NOT NULL DEFAULT 0,
  visit_count INTEGER        NOT NULL DEFAULT 0,
  updated_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
  PRIMARY KEY (state_key, action)
);

CREATE TABLE rl_meta (
  key   VARCHAR(64) PRIMARY KEY,
  value TEXT
);

INSERT INTO rl_meta VALUES ('total_matches', '0'), ('total_contributors', '0');
```

### Migration of `qtableStore.js`

```js
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function mergeContribution(playerQTable, matchCount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [state, actions] of Object.entries(playerQTable)) {
      for (const [action, playerQ] of Object.entries(actions)) {
        // Upsert with weighted merge using PostgreSQL arithmetic
        await client.query(`
          INSERT INTO qtable (state_key, action, q_value, visit_count)
          VALUES ($1, $2, $3, 1)
          ON CONFLICT (state_key, action) DO UPDATE
            SET q_value     = qtable.q_value + 0.10 * ($3 - qtable.q_value),
                visit_count = qtable.visit_count + 1,
                updated_at  = NOW()
        `, [state, action, Math.max(-50, Math.min(50, playerQ))]);
      }
    }

    await client.query(`
      UPDATE rl_meta SET value = (value::int + $1)::text
      WHERE key = 'total_matches'
    `, [matchCount]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

> **Benefit**: Concurrent writes are safe — each (state, action) row is updated atomically, no JSON file locking needed.

---

## Complete `StateEncoder.js`

```js
import { ComponentTypes } from '../ecs/componentTypes.js';

const ACTIONS = [
  'move_toward','move_away','idle','jump',
  'light_attack','heavy_attack','parry','dash','roll'
];

function distBucket(dist) {
  if (dist < 45)  return 'very_close';
  if (dist < 100) return 'close';
  if (dist < 200) return 'mid';
  return 'far';
}

function hpBucket(current, max) {
  const r = max > 0 ? current / max : 0;
  if (r < 0.25) return 'crit';
  if (r < 0.5)  return 'low';
  if (r < 0.75) return 'mid';
  return 'high';
}

/**
 * Encode current ECS game state into a discrete string key.
 * Returns null if required components are missing.
 */
export function encodeState(world, aiId, playerId) {
  const aiTransform = world.getComponent(aiId, ComponentTypes.TRANSFORM);
  const aiHealth    = world.getComponent(aiId, ComponentTypes.HEALTH);
  const aiStamina   = world.getComponent(aiId, ComponentTypes.STAMINA);
  const aiUltimate  = world.getComponent(aiId, ComponentTypes.ULTIMATE_METER);
  const plTransform = world.getComponent(playerId, ComponentTypes.TRANSFORM);
  const plHealth    = world.getComponent(playerId, ComponentTypes.HEALTH);
  const plAnim      = world.getComponent(playerId, ComponentTypes.ANIMATION_STATE);

  if (!aiTransform || !plTransform || !aiHealth || !plHealth) return null;

  const dist         = Math.abs(plTransform.x - aiTransform.x);
  const playerAtk    = plAnim?.currentClip === 'attack' ? '1' : '0';
  const aiAirborne   = aiTransform.isAirborne ? '1' : '0';
  const staminaOk    = (!aiStamina || aiStamina.current >= 30) ? '1' : '0';
  const ultimateRdy  = aiUltimate?.isReady ? '1' : '0';

  return [
    distBucket(dist),
    hpBucket(plHealth.current, plHealth.max),
    hpBucket(aiHealth.current, aiHealth.max),
    playerAtk,
    aiAirborne,
    staminaOk,
    ultimateRdy
  ].join('|');
}
```

---

## Complete `RewardCalculator.js`

```js
/**
 * Computes rewards for the RL agent based on game state changes.
 * Tracks HP deltas tick-by-tick for continuous feedback.
 */
export class RewardCalculator {
  constructor() {
    this.prevAiHp     = 100;
    this.prevPlayerHp = 100;
  }

  /** Call at the start of each match to set initial HP baselines. */
  reset(aiHp, playerHp) {
    this.prevAiHp     = aiHp;
    this.prevPlayerHp = playerHp;
  }

  /**
   * Compute per-tick reward from HP deltas.
   * @param {number} aiHp - Current AI HP
   * @param {number} playerHp - Current player HP
   * @param {boolean} parryOccurred - Whether a parry was triggered this tick
   * @returns {number} reward signal
   */
  computeTickReward(aiHp, playerHp, parryOccurred = false) {
    const dmgDealt = Math.max(0, this.prevPlayerHp - playerHp);
    const dmgTaken = Math.max(0, this.prevAiHp - aiHp);

    this.prevAiHp     = aiHp;
    this.prevPlayerHp = playerHp;

    let reward = 0;
    reward += dmgDealt  * 0.5;      // reward for dealing damage
    reward -= dmgTaken  * 0.5;      // penalty for taking damage
    reward += parryOccurred ? 3.0 : 0; // bonus for successful parry
    reward -= 0.02;                 // time penalty — encourages aggression
    return reward;
  }

  /**
   * Compute end-of-match sparse reward.
   * @param {'player'|'ai'} winner
   * @param {boolean} isFlawless - AI won without taking damage
   */
  computeMatchReward(winner, isFlawless = false) {
    let reward = winner === 'ai' ? 15.0 : -15.0;
    if (winner === 'ai' && isFlawless) reward += 10.0;
    return reward;
  }
}
```

---

## Execution Checklist

Use this checklist when implementing. Check off each item as it is completed.

### Phase 1 — Core RL (Local Only, No Server)
- [ ] Create `src/ai/StateEncoder.js`
- [ ] Create `src/ai/RewardCalculator.js`
- [ ] Create `src/ai/RLAgent.js`
- [ ] Modify `src/systems/01-ai/AISystem.js` — add `adaptive` difficulty route
- [ ] Modify `src/main.js` — wire up RLAgent, RewardCalculator in game loop
- [ ] Modify `src/core/SaveManager.js` — add `saveQTable` / `loadQTable`
- [ ] Add `🧠 Adaptive (RL)` option to difficulty dropdown in `index.html`
- [ ] Add RL stats panel HTML + CSS
- [ ] Write unit tests in `tests/unit/rlAgent.test.js`
- [ ] Run `npx vitest run` — all tests pass

### Phase 2 — Global Server
- [ ] Create `server/` directory with `package.json`
- [ ] Create `server/storage/qtableStore.js` (file-based)
- [ ] Create `server/routes/qtable.js`
- [ ] Create `server/index.js`
- [ ] Create `server/middleware/rateLimit.js`
- [ ] Create `src/ai/RLSyncService.js`
- [ ] Update `RLAgent.js` — add `initFromGlobal()`, `_updatedStates` delta tracking
- [ ] Update `main.js` — call `rlAgent.initFromGlobal()` before match start
- [ ] Add `VITE_RL_API_URL` to `.env.example`
- [ ] Test locally: two terminals, game + server, play a match, check `qtable.json` updates
- [ ] Write `tests/unit/rlSyncService.test.js` with mocked fetch

### Phase 3 — Security
- [ ] Add HMAC signature to `RLSyncService.contributeQTable()`
- [ ] Add `verifySignature` middleware to `server/middleware/`
- [ ] Add Q-value clamping `[-50, +50]` in `qtableStore.mergeContribution()`
- [ ] Add state key regex validation in `/api/ai/contribute` route

### Phase 4 — Deployment
- [ ] Create `Dockerfile` for server
- [ ] Create `docker-compose.yml`
- [ ] Test `docker-compose up` locally
- [ ] Deploy server to Railway / Render / Fly.io
- [ ] Set `VITE_RL_API_URL` in production build env
- [ ] Verify `/health` endpoint is reachable
- [ ] Play 3 matches in production, check `/api/ai/stats` updates

### Phase 5 — PostgreSQL (if needed)
- [ ] Provision PostgreSQL instance
- [ ] Run schema migration SQL
- [ ] Swap `qtableStore.js` to PostgreSQL implementation
- [ ] Set `DATABASE_URL` env var on server
- [ ] Load test with concurrent contributions

