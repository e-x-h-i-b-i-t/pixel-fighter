/**
 * Pure function to calculate final damage based on wielder and defender attributes.
 * @param {Object} params
 * @param {number} params.baseMoveDamage - Base damage of the attack move
 * @param {number} params.attackerStrength - Attacker's physical strength multiplier (e.g. 1.05)
 * @param {number} params.swordDamageMultiplier - Sword's damage multiplier (e.g. 1.15)
 * @param {number} params.comboScalar - Modifier based on combo position (e.g. 0.85)
 * @param {boolean} params.isCrit - Whether the attack scored a critical strike
 * @param {number} [params.critMultiplier=1.5] - Multiplier applied for critical strikes
 * @param {number} params.defenderDefensePercent - Defender's flat percentage defense (e.g. 0.12)
 * @param {number} [params.elementalAffinityModifier=1.0] - Modifiers for elemental strengths/weaknesses
 * @param {number} [params.flatPenetration=0.0] - Flat defense ignore value
 * @returns {number} Final calculated damage
 */
export function calculateDamage({
  baseMoveDamage,
  attackerStrength,
  swordDamageMultiplier = 1.0,
  comboScalar = 1.0,
  isCrit = false,
  critMultiplier = 1.5,
  defenderDefensePercent = 0.0,
  elementalAffinityModifier = 1.0,
  flatPenetration = 0.0
}) {
  const modifierStrength = baseMoveDamage * attackerStrength * swordDamageMultiplier * comboScalar;
  const criticalModifier = isCrit ? critMultiplier : 1.0;
  
  // Apply defense percent, taking flat penetration into account
  const netDefensePercent = Math.max(0, defenderDefensePercent);
  
  const baseReducedDamage = modifierStrength * criticalModifier * (1.0 - netDefensePercent) * elementalAffinityModifier;
  const finalDamage = baseReducedDamage + flatPenetration;

  return Math.max(0, Math.round(finalDamage));
}

/**
 * Pure function to check if a critical hit is triggered.
 * @param {number} attackerBaseCrit - Attacker base critical chance (e.g. 12 for 12%)
 * @param {number} swordCritModifier - Sword additive critical modifier (e.g. 5 for +5%)
 * @param {number} comboStageBonus - Additive combo bonus critical chance
 * @param {number} randomRoll - A random number between 0 and 100
 * @returns {boolean} True if the attack is critical
 */
export function checkCrit(attackerBaseCrit, swordCritModifier, comboStageBonus, randomRoll) {
  const totalCritChance = attackerBaseCrit + swordCritModifier + comboStageBonus;
  return randomRoll < totalCritChance;
}
