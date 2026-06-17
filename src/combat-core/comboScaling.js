/**
 * Pure function to get damage scalar based on current combo chain index.
 * @param {number} chainIndex - Current combo hit index (0 = first hit, 1 = second hit, etc.)
 * @returns {number} Damage multiplier between 0.55 and 1.0
 */
export function getComboDamageScalar(chainIndex) {
  // Chain index 0: 1.0
  // Chain index 1: 0.85
  // Chain index 2: 0.70
  // Chain index 3+: 0.55 (floor)
  if (chainIndex <= 0) return 1.0;
  if (chainIndex === 1) return 0.85;
  if (chainIndex === 2) return 0.70;
  return 0.55;
}

/**
 * Pure function to check if juggle limit has been reached.
 * @param {number} airborneHitsCount - Consecutive hits landed on an airborne opponent
 * @returns {boolean} True if maximum juggle count reached
 */
export function checkJuggleLimit(airborneHitsCount) {
  return airborneHitsCount >= 4;
}
