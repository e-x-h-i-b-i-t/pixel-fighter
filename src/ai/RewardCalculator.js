/**
 * Computes reward signals for the RL agent.
 *
 * Two reward types:
 *  - Per-tick: incremental HP delta feedback + time penalty
 *  - End-of-match: large sparse win/loss signal
 */
export class RewardCalculator {
  constructor() {
    this.prevAiHp     = 100;
    this.prevPlayerHp = 100;
  }

  /**
   * Call at the start of each match to baseline the HP values.
   * @param {number} aiHp
   * @param {number} playerHp
   */
  reset(aiHp, playerHp) {
    this.prevAiHp     = aiHp;
    this.prevPlayerHp = playerHp;
  }

  /**
   * Compute per-tick reward based on HP changes since last call.
   * @param {number} aiHp         - Current AI HP
   * @param {number} playerHp     - Current player HP
   * @param {boolean} parryOccurred - True if a parry/counter triggered this tick
   * @returns {number} Reward scalar
   */
  computeTickReward(aiHp, playerHp, parryOccurred = false) {
    const dmgDealt = Math.max(0, this.prevPlayerHp - playerHp);
    const dmgTaken = Math.max(0, this.prevAiHp     - aiHp);

    this.prevAiHp     = aiHp;
    this.prevPlayerHp = playerHp;

    let reward = 0;
    reward += dmgDealt  * 0.5;            // reward for dealing damage
    reward -= dmgTaken  * 0.5;            // penalty for taking damage
    reward += parryOccurred ? 3.0 : 0;    // bonus for successful parry
    reward -= 0.02;                        // small time penalty → encourages aggression
    return reward;
  }

  /**
   * Compute end-of-match sparse reward.
   * @param {'player'|'ai'} winner
   * @param {boolean} isFlawless - AI won without taking any damage
   * @returns {number}
   */
  computeMatchReward(winner, isFlawless = false) {
    let reward = winner === 'ai' ? 15.0 : -15.0;
    if (winner === 'ai' && isFlawless) reward += 10.0;
    return reward;
  }
}
