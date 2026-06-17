export const HITSTUN_CAP = 60; // 60 frames max at 60Hz (1 second)

/**
 * Pure function to calculate knockback magnitude and directional vector.
 * @param {Object} params
 * @param {number} params.baseKnockback - Base knockback value of the attack
 * @param {number} params.finalDamage - Final damage dealt by the hit
 * @param {number} params.defenderMaxHP - Defender's maximum HP
 * @param {number} params.defenderWeight - Defender's weight scaling (e.g. 1.2 for heavy)
 * @param {boolean} [params.isCounterOrParryPunish=false] - True if this was a parry punish
 * @param {number} params.moveLaunchAngle - Launch angle in degrees (0 = straight right, 90 = straight up)
 * @param {number} params.attackerFacing - 1 if attacker faces right, -1 if left
 * @returns {Object} { magnitude: number, vector: { x: number, y: number } }
 */
export function calculateKnockback({
  baseKnockback,
  finalDamage,
  defenderMaxHP,
  defenderWeight,
  isCounterOrParryPunish = false,
  moveLaunchAngle,
  attackerFacing
}) {
  const damageHpRatio = finalDamage / defenderMaxHP;
  const knockbackMagnitude = (baseKnockback * (1.0 + damageHpRatio) / defenderWeight) * (isCounterOrParryPunish ? 1.3 : 1.0);
  
  // Convert angle in degrees to radians
  const angleRad = (moveLaunchAngle * Math.PI) / 180;
  
  // Attacker facing right (1) or left (-1) flips the horizontal vector.
  const vx = Math.cos(angleRad) * attackerFacing;
  // Screens are Y-down, so positive angle (launching up) means negative Y change.
  const vy = -Math.sin(angleRad);
  
  return {
    magnitude: knockbackMagnitude,
    vector: { x: vx, y: vy }
  };
}

/**
 * Pure function to calculate hitstun duration in frames.
 * @param {number} baseHitstun - Base hitstun of the move in frames
 * @param {number} comboStageBonus - Additive hitstun bonus based on combo progression
 * @returns {number} Hitstun in frames (capped)
 */
export function calculateHitstun(baseHitstun, comboStageBonus) {
  const frames = baseHitstun * (1.0 + comboStageBonus);
  return Math.min(HITSTUN_CAP, Math.round(frames));
}
