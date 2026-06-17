export const MAX_ULTIMATE_METER = 100;

/**
 * Calculate next ultimate meter on dealing damage.
 * @param {number} currentMeter 
 * @param {number} damageDealt 
 * @returns {number} Next meter value (capped at 100)
 */
export function addUltimateMeterOnDealtDamage(currentMeter, damageDealt) {
  const nextMeter = currentMeter + damageDealt * 0.6;
  return Math.min(MAX_ULTIMATE_METER, nextMeter);
}

/**
 * Calculate next ultimate meter on taking damage.
 * @param {number} currentMeter 
 * @param {number} damageTaken 
 * @returns {number} Next meter value (capped at 100)
 */
export function addUltimateMeterOnTakenDamage(currentMeter, damageTaken) {
  const nextMeter = currentMeter + damageTaken * 0.25;
  return Math.min(MAX_ULTIMATE_METER, nextMeter);
}

/**
 * Calculate next ultimate meter on landing a parry.
 * @param {number} currentMeter 
 * @returns {number} Next meter value (capped at 100)
 */
export function addUltimateMeterOnParry(currentMeter) {
  return Math.min(MAX_ULTIMATE_METER, currentMeter + 12);
}

/**
 * Calculate next ultimate meter on landing a counter attack.
 * @param {number} currentMeter 
 * @returns {number} Next meter value (capped at 100)
 */
export function addUltimateMeterOnCounter(currentMeter) {
  return Math.min(MAX_ULTIMATE_METER, currentMeter + 8);
}
