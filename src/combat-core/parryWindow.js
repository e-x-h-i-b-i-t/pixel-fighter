export const PARRY_WINDOW_MS = 160;
export const ATTACKER_PARRIED_DURATION_MS = 500; // 0.5s parried stagger state
export const FAILED_PARRY_RECOVERY_MS = 300;     // 0.3s vulnerability window
export const COUNTER_ATTACK_WINDOW_MS = 400;     // 0.4s follow-up window

/**
 * Evaluates whether an incoming hit is successfully parried.
 * @param {number} timeDiffMs - Time diff in ms between parry start and hit impact.
 * @returns {Object} Result mapping containing success state and follow-up/recovery times.
 */
export function evaluateParry(timeDiffMs) {
  if (timeDiffMs >= 0 && timeDiffMs <= PARRY_WINDOW_MS) {
    return {
      success: true,
      attackerParriedDuration: ATTACKER_PARRIED_DURATION_MS,
      counterWindow: COUNTER_ATTACK_WINDOW_MS
    };
  }
  
  return {
    success: false,
    defenderRecovery: FAILED_PARRY_RECOVERY_MS
  };
}
