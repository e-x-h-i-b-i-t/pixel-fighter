import { describe, it, expect, beforeEach } from 'vitest';
import { RLAgent, RL_ACTIONS } from '../../src/ai/RLAgent.js';
import { RewardCalculator } from '../../src/ai/RewardCalculator.js';

// ── RLAgent ──────────────────────────────────────────────────────────────────

describe('RLAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new RLAgent();
  });

  it('initializes with zero Q-values for unknown states', () => {
    expect(agent._getQ('far|high|high|0|0|1|0', 'jump')).toBe(0);
    expect(agent._getQ('close|crit|mid|1|0|1|0', 'parry')).toBe(0);
  });

  it('Q-value increases after a positive reward', () => {
    agent.update('s0', 'jump', 5.0, 's1');
    expect(agent._getQ('s0', 'jump')).toBeGreaterThan(0);
  });

  it('Q-value decreases after a negative reward', () => {
    agent.update('s0', 'heavy_attack', -5.0, 's1');
    expect(agent._getQ('s0', 'heavy_attack')).toBeLessThan(0);
  });

  it('Bellman update uses ALPHA and GAMMA correctly', () => {
    // Q(s,a) = 0 + 0.15 * (2.0 + 0.90*0 - 0) = 0.30
    agent.update('s0', 'idle', 2.0, 's_new');
    expect(agent._getQ('s0', 'idle')).toBeCloseTo(0.30, 5);
  });

  it('epsilon starts at 0.40', () => {
    expect(agent.epsilon).toBeCloseTo(0.40, 5);
  });

  it('epsilon decays by ×0.97 on each match end', () => {
    const before = agent.epsilon;
    agent.onMatchEnd(-15);
    expect(agent.epsilon).toBeCloseTo(before * 0.97, 5);
  });

  it('epsilon never drops below 0.05', () => {
    agent.epsilon = 0.051;
    agent.onMatchEnd(15);
    expect(agent.epsilon).toBeGreaterThanOrEqual(0.05);

    agent.epsilon = 0.049;
    agent.onMatchEnd(15);
    expect(agent.epsilon).toBe(0.05);
  });

  it('matchCount increments on each match end', () => {
    expect(agent.matchCount).toBe(0);
    agent.onMatchEnd(15);
    expect(agent.matchCount).toBe(1);
    agent.onMatchEnd(-15);
    expect(agent.matchCount).toBe(2);
  });

  it('chooseAction returns a valid RL_ACTIONS string', () => {
    const state = 'close|mid|high|0|0|1|0';
    const action = agent.chooseAction(state);
    expect(RL_ACTIONS).toContain(action);
  });

  it('chooseAction exploits best action when epsilon=0', () => {
    agent.epsilon = 0;
    agent._setQ('s_test', 'parry', 99.0);
    agent._setQ('s_test', 'roll', 1.0);
    expect(agent.chooseAction('s_test')).toBe('parry');
  });

  it('serialize / load round-trip preserves Q-values and epsilon', () => {
    agent.update('s_persist', 'dash', 7.0, 's_next');
    agent.onMatchEnd(15);

    const json    = agent.serialize();
    const agent2  = new RLAgent(json);

    expect(agent2._getQ('s_persist', 'dash')).toBeCloseTo(
      agent._getQ('s_persist', 'dash'), 5
    );
    expect(agent2.epsilon).toBeCloseTo(agent.epsilon, 5);
    expect(agent2.matchCount).toBe(agent.matchCount);
  });

  it('getStats returns expected shape', () => {
    const stats = agent.getStats();
    expect(stats).toHaveProperty('matchCount');
    expect(stats).toHaveProperty('statesKnown');
    expect(stats).toHaveProperty('epsilon');
    expect(typeof stats.epsilon).toBe('string');
    expect(stats.epsilon.endsWith('%')).toBe(true);
  });
});

// ── RewardCalculator ─────────────────────────────────────────────────────────

describe('RewardCalculator', () => {
  let calc;

  beforeEach(() => {
    calc = new RewardCalculator();
    calc.reset(100, 100);
  });

  it('reward is negative when AI takes damage', () => {
    const r = calc.computeTickReward(80, 100);   // AI lost 20 HP
    expect(r).toBeLessThan(0);
  });

  it('reward is positive when AI deals damage', () => {
    const r = calc.computeTickReward(100, 75);   // Player lost 25 HP
    expect(r).toBeGreaterThan(0);
  });

  it('always includes a small time penalty', () => {
    // No damage dealt or taken → reward should be -0.02
    const r = calc.computeTickReward(100, 100);
    expect(r).toBeCloseTo(-0.02, 5);
  });

  it('parry bonus adds 3.0 to reward', () => {
    const withParry    = calc.computeTickReward(100, 100, true);
    calc.reset(100, 100);
    const withoutParry = calc.computeTickReward(100, 100, false);
    expect(withParry - withoutParry).toBeCloseTo(3.0, 5);
  });

  it('match reward is +15 for AI win', () => {
    expect(calc.computeMatchReward('ai')).toBe(15.0);
  });

  it('match reward is -15 for player win', () => {
    expect(calc.computeMatchReward('player')).toBe(-15.0);
  });

  it('flawless AI win adds +10 bonus', () => {
    expect(calc.computeMatchReward('ai', true)).toBe(25.0);
  });

  it('flawless has no effect on player win', () => {
    expect(calc.computeMatchReward('player', true)).toBe(-15.0);
  });

  it('reset() updates HP baselines', () => {
    calc.reset(50, 70);
    // No change from baseline → only time penalty
    const r = calc.computeTickReward(50, 70);
    expect(r).toBeCloseTo(-0.02, 5);
  });
});
