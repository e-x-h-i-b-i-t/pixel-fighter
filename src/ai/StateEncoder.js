import { ComponentTypes } from '../ecs/componentTypes.js';

/**
 * Discretizes the continuous game state into a compact string key
 * suitable for use as a Q-table lookup key.
 *
 * State format: "<dist>|<p1hp>|<aihp>|<p1atk>|<air>|<stam>|<ult>"
 * Example:      "close|mid|high|1|0|1|0"
 *
 * Total state space: 4×4×4×2×2×2×2 = 1,024 states
 *
 * @param {World} world
 * @param {number} aiId   - Entity ID of the AI fighter
 * @param {number} playerId - Entity ID of the human player
 * @returns {string|null}  State key, or null if required components missing
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

  const dist = Math.abs(plTransform.x - aiTransform.x);

  return [
    _distBucket(dist),
    _hpBucket(plHealth.current, plHealth.max),
    _hpBucket(aiHealth.current, aiHealth.max),
    plAnim?.currentClip === 'attack' ? '1' : '0',
    aiTransform.isAirborne ? '1' : '0',
    (!aiStamina || aiStamina.current >= 30) ? '1' : '0',
    aiUltimate?.isReady ? '1' : '0',
  ].join('|');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _distBucket(dist) {
  if (dist < 45)  return 'very_close';
  if (dist < 100) return 'close';
  if (dist < 200) return 'mid';
  return 'far';
}

function _hpBucket(current, max) {
  const r = max > 0 ? current / max : 0;
  if (r < 0.25) return 'crit';
  if (r < 0.5)  return 'low';
  if (r < 0.75) return 'mid';
  return 'high';
}
