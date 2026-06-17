# Reinforcement Learning AI — Implementation Plan
> Pixel Sword Fighter · Q-Learning Adaptive Opponent

---

## Overview

Replace the static rule-based AI with an **online Q-Learning agent** that:
- Learns from every fight in real-time (no training server needed)
- Persists its Q-table across sessions via `localStorage`
- Adapts specifically to the human player's tendencies
- Reaches Hard-equivalent skill after ~30 matches (~30–45 min of play)

The existing rule-based AI (Easy / Medium / Hard / Nightmare) is **untouched**. RL is a new `adaptive` difficulty tier.

---

## Algorithm: Tabular Q-Learning

```
Every game tick:
  1. Encode game state  →  discrete state key (string)
  2. Choose action      →  ε-greedy policy (explore vs exploit)
  3. Execute action     →  same output format as rule-based AI
  4. Compute reward     →  damage delta, parry bonus, win/loss
  5. Update Q-table     →  Bellman equation
  6. Save state+action  →  used next tick for the update

On match end:
  - Apply large sparse reward (win +15 / loss -15)
  - Decay ε (reduce exploration)
  - Persist Q-table to localStorage
```

### Bellman Update Rule

```
Q(s, a) ← Q(s, a) + α × [ r + γ × max_a'(Q(s', a')) − Q(s, a) ]
```

---

## Hyperparameters

| Parameter | Value | Notes |
|---|---|---|
| α (learning rate) | `0.15` | 15% update per visit |
| γ (discount factor) | `0.90` | Values near-future rewards |
| ε start | `0.40` | 40% random exploration initially |
| ε min | `0.05` | Always keeps 5% exploration |
| ε decay | `× 0.97` per match | Exponential decay |

---

## State Space

Discretize continuous values into buckets → compact string key.

```
"<dist>|<p1hp>|<aihp>|<p1atk>|<air>|<stam>|<ult>"
Example: "close|mid|high|1|0|1|0"
```

| Feature | Buckets | Values |
|---|---|---|
| Distance (px) | 4 | `very_close` <45 / `close` <100 / `mid` <200 / `far` ≥200 |
| Player HP % | 4 | `crit` <0.25 / `low` <0.5 / `mid` <0.75 / `high` ≥0.75 |
| AI HP % | 4 | same as above |
| Player attacking | 2 | `0` / `1` |
| AI is airborne | 2 | `0` / `1` |
| AI stamina ≥ 30 | 2 | `0` / `1` |
| Ultimate ready | 2 | `0` / `1` |

**Total state space**: 4×4×4×2×2×2×2 = **1,024 states**

---

## Action Space (9 actions)

```js
const ACTIONS = [
  'move_toward',   // chase player
  'move_away',     // retreat / create space
  'idle',          // stay still
  'jump',          // jump or double-jump
  'light_attack',  // fast, low-damage swing
  'heavy_attack',  // slow, high-damage swing
  'parry',         // block/counter window
  'dash',          // invincible dash (costs stamina)
  'roll',          // evasive roll (costs stamina)
];
```

**Q-table size**: 1,024 × 9 = **9,216 float values** (~72 KB in localStorage)

---

## Reward Function

### Per-Tick (continuous, small signal)
```js
reward += damageDeltaDealt  × 0.5    // reward for hurting player
reward -= damageDeltaTaken  × 0.5    // penalty for taking damage
reward += successfulParry ? 3.0 : 0  // bonus for parrying
reward -= 0.02                        // time penalty (encourages aggression)
```

### End-of-Match (sparse, large signal)
```js
reward += winner === 'ai' ? +15.0 : -15.0  // win/loss
reward += flawlessVictory ? +10.0 : 0      // no damage taken bonus
```

---

## File Structure

```
src/
  ai/
    RLAgent.js           ← Q-table, ε-greedy policy, Bellman update, serialize/load
    StateEncoder.js      ← ECS state → discrete string key
    RewardCalculator.js  ← HP delta tracking, per-tick + end-of-match rewards
  systems/
    01-ai/
      AISystem.js        ← MODIFY: route to RL when difficulty = 'adaptive'
  core/
    SaveManager.js       ← MODIFY: add saveQTable() / loadQTable()
    UIManager.js         ← MODIFY: show RL stats panel
  index.css              ← MODIFY: style RL stats panel
index.html               ← MODIFY: add "🧠 Adaptive (RL)" difficulty option + stats panel
tests/unit/
  rlAgent.test.js        ← NEW unit tests
```

---

## Implementation Steps

### Step 1 — `src/ai/StateEncoder.js`

```js
import { ComponentTypes } from '../ecs/componentTypes.js';

export function encodeState(world, aiId, playerId) {
  const aiT    = world.getComponent(aiId, ComponentTypes.TRANSFORM);
  const aiH    = world.getComponent(aiId, ComponentTypes.HEALTH);
  const aiS    = world.getComponent(aiId, ComponentTypes.STAMINA);
  const aiU    = world.getComponent(aiId, ComponentTypes.ULTIMATE_METER);
  const plT    = world.getComponent(playerId, ComponentTypes.TRANSFORM);
  const plH    = world.getComponent(playerId, ComponentTypes.HEALTH);
  const plAnim = world.getComponent(playerId, ComponentTypes.ANIMATION_STATE);

  const dist = Math.abs(plT.x - aiT.x);
  const distBucket =
    dist < 45  ? 'very_close' :
    dist < 100 ? 'close' :
    dist < 200 ? 'mid' : 'far';

  const bucket = (hp, max) => {
    const r = hp / max;
    return r < 0.25 ? 'crit' : r < 0.5 ? 'low' : r < 0.75 ? 'mid' : 'high';
  };

  return [
    distBucket,
    bucket(plH.current, plH.max),
    bucket(aiH.current, aiH.max),
    plAnim.currentClip === 'attack' ? '1' : '0',
    aiT.isAirborne ? '1' : '0',
    (aiS.current >= 30) ? '1' : '0',
    aiU.isReady ? '1' : '0',
  ].join('|');
}
```

---

### Step 2 — `src/ai/RewardCalculator.js`

```js
export class RewardCalculator {
  constructor() {
    this.prevAiHp = 100;
    this.prevPlayerHp = 100;
  }

  reset(aiHp, playerHp) {
    this.prevAiHp = aiHp;
    this.prevPlayerHp = playerHp;
  }

  computeTickReward(aiHp, playerHp, parryOccurred = false) {
    const dmgDealt = Math.max(0, this.prevPlayerHp - playerHp);
    const dmgTaken = Math.max(0, this.prevAiHp - aiHp);
    this.prevAiHp = aiHp;
    this.prevPlayerHp = playerHp;

    let reward = 0;
    reward += dmgDealt * 0.5;
    reward -= dmgTaken * 0.5;
    reward += parryOccurred ? 3.0 : 0;
    reward -= 0.02;  // time penalty
    return reward;
  }

  computeMatchReward(winner, isFlawless) {
    let reward = winner === 'ai' ? 15.0 : -15.0;
    if (winner === 'ai' && isFlawless) reward += 10.0;
    return reward;
  }
}
```

---

### Step 3 — `src/ai/RLAgent.js`

```js
const ACTIONS = [
  'move_toward','move_away','idle','jump',
  'light_attack','heavy_attack','parry','dash','roll'
];
const EPSILON_MIN  = 0.05;
const EPSILON_DECAY = 0.97;

export class RLAgent {
  constructor(savedData = null) {
    this.qTable      = {};
    this.epsilon     = 0.40;
    this.alpha       = 0.15;
    this.gamma       = 0.90;
    this.matchCount  = 0;
    this.lastState   = null;
    this.lastAction  = null;
    if (savedData) this._load(savedData);
  }

  // Returns the best known Q-value for a state
  _getQ(state, action) {
    return this.qTable[state]?.[action] ?? 0;
  }

  _setQ(state, action, value) {
    if (!this.qTable[state]) this.qTable[state] = {};
    this.qTable[state][action] = value;
  }

  // ε-greedy action selection
  chooseAction(stateKey) {
    if (Math.random() < this.epsilon) {
      // Explore: random action
      return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    }
    // Exploit: best known action
    let bestAction = ACTIONS[0];
    let bestQ = -Infinity;
    for (const action of ACTIONS) {
      const q = this._getQ(stateKey, action);
      if (q > bestQ) { bestQ = q; bestAction = action; }
    }
    return bestAction;
  }

  // Bellman update
  update(state, action, reward, nextState) {
    const currentQ = this._getQ(state, action);
    const maxNextQ = Math.max(...ACTIONS.map(a => this._getQ(nextState, a)));
    const newQ = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);
    this._setQ(state, action, newQ);
  }

  // Call at end of each match
  onMatchEnd(matchReward) {
    if (this.lastState && this.lastAction) {
      // Final update with terminal reward
      this.update(this.lastState, this.lastAction, matchReward, '__terminal__');
    }
    this.matchCount++;
    this.epsilon = Math.max(EPSILON_MIN, this.epsilon * EPSILON_DECAY);
    this.lastState  = null;
    this.lastAction = null;
  }

  getStats() {
    return {
      matchCount:   this.matchCount,
      statesKnown:  Object.keys(this.qTable).length,
      epsilon:      (this.epsilon * 100).toFixed(1) + '%',
    };
  }

  serialize() {
    return JSON.stringify({ qTable: this.qTable, epsilon: this.epsilon, matchCount: this.matchCount });
  }

  _load(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    this.qTable     = parsed.qTable     ?? {};
    this.epsilon    = parsed.epsilon    ?? 0.40;
    this.matchCount = parsed.matchCount ?? 0;
  }
}
```

---

### Step 4 — Modify `AISystem.js`

```js
// Add parameter: rlAgent (optional)
export function aiSystem(world, rlAgent = null) {
  ...
  for (const aiId of aiEntities) {
    const ai = world.getComponent(aiId, ComponentTypes.AI_CONTROLLER);

    if (ai.difficulty === 'adaptive' && rlAgent) {
      // RL path
      const stateKey = encodeState(world, aiId, playerEntityId);
      const action   = rlAgent.chooseAction(stateKey);
      _applyRLAction(transform, action, world, aiId); // helper below
      rlAgent.lastState  = stateKey;
      rlAgent.lastAction = action;
    } else {
      // Existing rule-based path — UNCHANGED
      _runRuleBasedAI(ai, transform, ...);
    }
  }
}

function _applyRLAction(transform, action, world, aiId) {
  switch (action) {
    case 'move_toward':   transform.aiMoveDir = 1; break;
    case 'move_away':     transform.aiMoveDir = -1; break;
    case 'idle':          transform.aiMoveDir = 0; break;
    case 'jump':          transform.aiBufferedAction = 'jump'; break;
    case 'light_attack':  transform.aiBufferedAction = 'lightAttack'; break;
    case 'heavy_attack':  transform.aiBufferedAction = 'heavyAttack'; break;
    case 'parry':         transform.aiBufferedAction = 'parry'; break;
    case 'dash':          transform.aiBufferedAction = 'dash'; break;
    case 'roll':          transform.aiBufferedAction = 'roll'; break;
  }
}
```

---

### Step 5 — Modify `main.js`

```js
import { RLAgent }          from './ai/RLAgent.js';
import { RewardCalculator } from './ai/RewardCalculator.js';
import { encodeState }      from './ai/StateEncoder.js';

const rlAgent   = new RLAgent(saveManager.loadQTable());
const rewardCalc = new RewardCalculator();

// In startMatch():
if (p2Opts.difficulty === 'adaptive') {
  const aiH  = world.getComponent(ai, ComponentTypes.HEALTH);
  const plH  = world.getComponent(player, ComponentTypes.HEALTH);
  rewardCalc.reset(aiH.current, plH.current);
}

// In update() game loop:
if (p2Opts.difficulty === 'adaptive') {
  const aiH  = world.getComponent(ai, ComponentTypes.HEALTH);
  const plH  = world.getComponent(player, ComponentTypes.HEALTH);
  const nextState = encodeState(world, ai, player);
  const reward    = rewardCalc.computeTickReward(aiH.current, plH.current);

  if (rlAgent.lastState) {
    rlAgent.update(rlAgent.lastState, rlAgent.lastAction, reward, nextState);
  }
  updateRLStatsPanel(rlAgent.getStats());
}

// On match end (inside win condition check):
if (p2Opts.difficulty === 'adaptive') {
  const isFlawless = playerHealth.current === playerHealth.max;
  rlAgent.onMatchEnd(rewardCalc.computeMatchReward(
    playerHealth.current <= 0 ? 'ai' : 'player',
    isFlawless
  ));
  saveManager.saveQTable(rlAgent.serialize());
}
```

---

### Step 6 — Modify `SaveManager.js`

```js
saveQTable(serialized) {
  localStorage.setItem('rl_qtable', serialized);
}

loadQTable() {
  const raw = localStorage.getItem('rl_qtable');
  return raw ? JSON.parse(raw) : null;
}

resetSave() {
  // existing logic...
  localStorage.removeItem('rl_qtable'); // optional: reset RL too
}
```

---

### Step 7 — UI Changes

**`index.html`** — Add to difficulty dropdown:
```html
<option value="adaptive">🧠 Adaptive (RL)</option>
```

Add stats panel (shown only during Adaptive fights):
```html
<div id="rl-stats-panel" class="rl-stats-panel hidden">
  <div class="rl-stats-title">🧠 AI Learning</div>
  <div class="rl-stat">Matches: <b id="rl-matches">0</b></div>
  <div class="rl-stat">States: <b id="rl-states">0</b></div>
  <div class="rl-stat">Explore: <b id="rl-epsilon">40%</b></div>
</div>
```

**`src/index.css`** — Glassmorphic info card:
```css
.rl-stats-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(10, 10, 30, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(168, 85, 247, 0.4);
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 0.8rem;
  color: #e2e8f0;
  z-index: 200;
}
.rl-stats-title { color: #a855f7; font-weight: bold; margin-bottom: 6px; }
.rl-stat b { color: #f59e0b; }
```

---

### Step 8 — Unit Tests (`tests/unit/rlAgent.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { RLAgent } from '../../src/ai/RLAgent.js';
import { encodeState } from '../../src/ai/StateEncoder.js';

describe('RLAgent', () => {
  it('initializes Q-value to 0 for unknown state', () => {
    const agent = new RLAgent();
    expect(agent._getQ('unknown|state', 'jump')).toBe(0);
  });

  it('increases Q-value after positive reward', () => {
    const agent = new RLAgent();
    agent.update('s', 'jump', 5.0, 's2');
    expect(agent._getQ('s', 'jump')).toBeGreaterThan(0);
  });

  it('decreases Q-value after negative reward', () => {
    const agent = new RLAgent();
    agent.update('s', 'jump', -5.0, 's2');
    expect(agent._getQ('s', 'jump')).toBeLessThan(0);
  });

  it('decays epsilon on match end', () => {
    const agent = new RLAgent();
    const initial = agent.epsilon;
    agent.onMatchEnd(15);
    expect(agent.epsilon).toBeLessThan(initial);
  });

  it('serializes and loads correctly', () => {
    const agent = new RLAgent();
    agent.update('s', 'parry', 3.0, 's2');
    const serialized = agent.serialize();
    const agent2 = new RLAgent(serialized);
    expect(agent2._getQ('s', 'parry')).toBeCloseTo(agent._getQ('s', 'parry'));
  });
});
```

---

## Training Progression

| Matches | ε | Behavior |
|---|---|---|
| 1–5 | ~37% | Very random, exploring all actions |
| 6–15 | ~28% | Prefers high-reward actions in common states |
| 16–30 | ~18% | Tactical — parries, times attacks, chases |
| 31–50 | ~10% | Hard-mode equivalent, punishes bad habits |
| 51+ | 5% (floor) | Near-optimal, adapts to your specific playstyle |

**Estimated time to Hard-equivalent**: ~30 matches ≈ **30–45 minutes** of gameplay

---

## Open Questions

1. **Per-class Q-table?** — One global Q-table vs separate tables per character class (Knight, Samurai, etc.). Separate = each class develops its own style but trains slower.

2. **Reset behavior** — Should "Reset Save Data" wipe the Q-table? Or keep AI training separate from achievements?

3. **Headless pre-training** — Add a "Simulate N matches" button that runs AI vs AI in the background to bootstrap the Q-table before the player's first fight?
