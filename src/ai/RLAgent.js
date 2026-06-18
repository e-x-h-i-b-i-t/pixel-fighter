/**
 * Tabular Q-Learning agent for the Pixel Sword Fighter AI opponent.
 *
 * Q-table: Map of stateKey → { action → Q-value }
 * Policy:  ε-greedy (explore randomly or exploit best known action)
 * Update:  Bellman equation per tick
 * Storage: Serialized to / from JSON (localStorage via SaveManager)
 *
 * Hyperparameters:
 *   α (learning rate)  = 0.15
 *   γ (discount)       = 0.90
 *   ε (exploration)    = 0.40 → decays by ×0.97 per match → floor 0.05
 */

export const RL_ACTIONS = [
  'move_toward',
  'move_away',
  'idle',
  'jump',
  'light_attack',
  'heavy_attack',
  'parry',
  'dash',
  'roll',
];

const ALPHA         = 0.15;
const GAMMA         = 0.90;
const EPSILON_START = 0.40;
const EPSILON_MIN   = 0.05;
const EPSILON_DECAY = 0.97;

export class RLAgent {
  /**
   * @param {Object|string|null} savedData - Serialized Q-table data to restore from,
   *   or null to start fresh.
   */
  constructor(savedData = null) {
    /** @type {Object.<string, Object.<string, number>>} */
    this.qTable      = {};
    this.epsilon     = EPSILON_START;
    this.matchCount  = 0;

    // Transient per-tick state (not serialized)
    this.lastState   = null;
    this.lastAction  = null;

    // Delta tracker: only states updated THIS match (uploaded to server, then cleared)
    this._updatedStates = {};

    if (savedData) this._load(savedData);
  }

  // ── Q-table accessors ────────────────────────────────────────────────────

  _getQ(stateKey, action) {
    return this.qTable[stateKey]?.[action] ?? 0;
  }

  _setQ(stateKey, action, value) {
    if (!this.qTable[stateKey]) this.qTable[stateKey] = {};
    this.qTable[stateKey][action] = value;
  }

  // ── Policy ───────────────────────────────────────────────────────────────

  /**
   * Choose an action using the ε-greedy policy.
   * @param {string} stateKey - Current encoded state string
   * @returns {string} One of RL_ACTIONS
   */
  chooseAction(stateKey) {
    if (Math.random() < this.epsilon) {
      // Explore: pick a random action
      return RL_ACTIONS[Math.floor(Math.random() * RL_ACTIONS.length)];
    }

    // Exploit: pick the action with the highest Q-value for this state
    let bestAction = RL_ACTIONS[0];
    let bestQ      = -Infinity;

    for (const action of RL_ACTIONS) {
      const q = this._getQ(stateKey, action);
      if (q > bestQ) {
        bestQ      = q;
        bestAction = action;
      }
    }
    return bestAction;
  }

  // ── Learning ─────────────────────────────────────────────────────────────

  /**
   * Bellman Q-update for a single (state, action, reward, nextState) transition.
   * Q(s,a) ← Q(s,a) + α × [r + γ × max_a'(Q(s',a')) − Q(s,a)]
   *
   * @param {string} state
   * @param {string} action
   * @param {number} reward
   * @param {string} nextState
   */
  update(state, action, reward, nextState) {
    const currentQ  = this._getQ(state, action);
    const maxNextQ  = nextState === '__terminal__'
      ? 0
      : Math.max(...RL_ACTIONS.map(a => this._getQ(nextState, a)));

    const newQ = currentQ + ALPHA * (reward + GAMMA * maxNextQ - currentQ);
    this._setQ(state, action, newQ);

    // Track this update for delta upload to global server
    if (!this._updatedStates[state]) this._updatedStates[state] = {};
    this._updatedStates[state][action] = newQ;
  }

  /**
   * Call at the end of every match.
   * Applies the terminal match reward, decays ε, increments match counter.
   *
   * @param {number} matchReward - Output of RewardCalculator.computeMatchReward()
   */
  onMatchEnd(matchReward) {
    // Terminal Bellman update with no future state
    if (this.lastState && this.lastAction) {
      this.update(this.lastState, this.lastAction, matchReward, '__terminal__');
    }

    this.matchCount++;
    this.epsilon  = Math.max(EPSILON_MIN, this.epsilon * EPSILON_DECAY);
    this.lastState  = null;
    this.lastAction = null;
    // Note: _updatedStates is NOT cleared here.
    // main.js reads it AFTER calling onMatchEnd() to upload the delta,
    // then clears it via resetDelta().
  }

  /**
   * Returns the set of state-action pairs updated this match and resets the tracker.
   * Call this after onMatchEnd() to get the delta for server upload.
   * @returns {Object}
   */
  drainDelta() {
    const delta = this._updatedStates;
    this._updatedStates = {};
    return delta;
  }

  /**
   * Merge a global Q-table from the server into the local Q-table.
   * Server Q-values take precedence for states the local agent hasn't explored yet;
   * for already-known states, we blend: local × 0.7 + global × 0.3.
   *
   * @param {{ qTable: Object }} globalData - Response from RLSyncService.fetchGlobalQTable()
   */
  initFromGlobal(globalData) {
    if (!globalData?.qTable) return;

    for (const [state, actions] of Object.entries(globalData.qTable)) {
      if (!this.qTable[state]) {
        // New state we haven't seen — take global value directly
        this.qTable[state] = { ...actions };
      } else {
        // Known state — blend to avoid overwriting local learning
        for (const [action, globalQ] of Object.entries(actions)) {
          const localQ = this.qTable[state][action] ?? 0;
          this.qTable[state][action] = localQ * 0.7 + globalQ * 0.3;
        }
      }
    }

    this._updatedStates = {}; // Fresh delta for the new match
    console.log(`[RL] Seeded from global Q-table: ${Object.keys(globalData.qTable).length} states`);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  getStats() {
    return {
      matchCount:  this.matchCount,
      statesKnown: Object.keys(this.qTable).length,
      epsilon:     (this.epsilon * 100).toFixed(1) + '%',
    };
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /**
   * Serialize the agent state to a JSON string for localStorage.
   * @returns {string}
   */
  serialize() {
    return JSON.stringify({
      qTable:     this.qTable,
      epsilon:    this.epsilon,
      matchCount: this.matchCount,
    });
  }

  _load(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    this.qTable     = parsed.qTable     ?? {};
    this.epsilon    = parsed.epsilon    ?? EPSILON_START;
    this.matchCount = parsed.matchCount ?? 0;
  }
}
