import { ComponentTypes } from '../../ecs/componentTypes.js';
import { calculateDamage, checkCrit } from '../../combat-core/damageFormula.js';
import { audioEngine } from '../../core/AudioEngine.js';
import { calculateKnockback, calculateHitstun } from '../../combat-core/knockbackFormula.js';
import { getComboDamageScalar } from '../../combat-core/comboScaling.js';
import {
  addUltimateMeterOnDealtDamage,
  addUltimateMeterOnTakenDamage
} from '../../combat-core/ultimateResolution.js';

/**
 * ECS System to resolve queued hits on entities.
 * Runs in Step 9 of the execution cycle.
 * @param {World} world 
 * @param {Function} [triggerHitstop] - Optional callback to freeze GameLoop rendering
 */
export function damageResolutionSystem(world, triggerHitstop) {
  const entities = world.query([ComponentTypes.HEALTH, ComponentTypes.VELOCITY, ComponentTypes.TRANSFORM]);

  for (const defenderId of entities) {
    const health = world.getComponent(defenderId, ComponentTypes.HEALTH);
    const velocity = world.getComponent(defenderId, ComponentTypes.VELOCITY);
    const transform = world.getComponent(defenderId, ComponentTypes.TRANSFORM);

    if (!health || !health.incomingHits || health.incomingHits.length === 0) continue;

    // Process all queued hits
    for (const hit of health.incomingHits) {
      const {
        attackerId,
        baseDamage,
        damageType,
        element,
        baseKnockback,
        moveLaunchAngle,
        hitstunFrames,
        canCrit,
        isCounterOrParryPunish
      } = hit;

      // Skip processing if defender is already dead
      if (health.current <= 0) continue;

      // 1. Gather Attacker Stats
      let attackerStrength = 1.0;
      let attackerCritChance = 5.0; // Base 5%
      let swordDamageMultiplier = 1.0;
      let swordCritModifier = 0.0;
      let comboStageBonus = 0.0;
      let comboDamageScalar = 1.0;
      
      const attackerTransform = world.getComponent(attackerId, ComponentTypes.TRANSFORM);
      const attackerCombo = world.getComponent(attackerId, ComponentTypes.COMBO_STATE);
      const attackerSword = world.getComponent(attackerId, ComponentTypes.SWORD_LOADOUT);
      
      // We can look for custom stats attached to wielder transform or components
      if (attackerTransform) {
        attackerStrength = attackerTransform.strengthModifier || 1.0;
        attackerCritChance = attackerTransform.baseCritChance || 5.0;
      }

      if (attackerCombo) {
        comboDamageScalar = getComboDamageScalar(attackerCombo.chainIndex);
        // Combo stage bonuses
        comboStageBonus = attackerCombo.chainIndex * 2; // e.g., +2% crit per combo hit
      }

      if (attackerSword) {
        swordDamageMultiplier = attackerSword.damageMultiplier || 1.0;
        swordCritModifier = attackerSword.critModifier || 0.0;
      }

      // 2. Roll Critical Hit
      const isCrit = canCrit ? checkCrit(attackerCritChance, swordCritModifier, comboStageBonus, Math.random() * 100) : false;

      // 3. Evaluate Final Damage
      const defenderDefensePercent = transform.defenseModifier || 0.0; // read defense modifier from transform/loadout
      
      const finalDamage = calculateDamage({
        baseMoveDamage: baseDamage,
        attackerStrength,
        swordDamageMultiplier,
        comboScalar: comboDamageScalar,
        isCrit,
        critMultiplier: 1.5,
        defenderDefensePercent
      });

      // Apply damage to health
      health.current = Math.max(0, health.current - finalDamage);
      health.lastHitTimestamp = Date.now();

      // Trigger hit/parry audio feedback
      if (isCounterOrParryPunish) {
        audioEngine.playSFX('parry', transform.x);
      } else {
        audioEngine.playSFX('hit', transform.x);
      }

      // 4. Evaluate Knockback & Stun
      const defenderWeight = transform.weightModifier || 1.0;
      const attackerFacing = attackerTransform ? attackerTransform.facing : 1;
      
      const kb = calculateKnockback({
        baseKnockback,
        finalDamage,
        defenderMaxHP: health.max,
        defenderWeight,
        isCounterOrParryPunish,
        moveLaunchAngle,
        attackerFacing
      });

      // Apply knockback impulse (velocity changes directly)
      velocity.vx += kb.vector.x * kb.magnitude;
      velocity.vy += kb.vector.y * kb.magnitude;

      // Stun duration
      const finalHitstun = calculateHitstun(hitstunFrames, comboStageBonus / 100);
      transform.hitstunFramesLeft = finalHitstun;
      transform.isAirborne = true; // Knockback always puts defender in airborne state

      // Resolve Sword Loadout Special Effects (Lifesteal, Mana Restore, Elemental Statuses)
      if (attackerSword && finalDamage > 0) {
        // Lifesteal
        if (attackerSword.lifestealRatio > 0) {
          const attackerHealth = world.getComponent(attackerId, ComponentTypes.HEALTH);
          if (attackerHealth) {
            attackerHealth.current = Math.min(
              attackerHealth.max,
              attackerHealth.current + Math.floor(finalDamage * attackerSword.lifestealRatio)
            );
          }
        }

        // Mana Restore
        if (attackerSword.manaRestore > 0) {
          const attackerMana = world.getComponent(attackerId, ComponentTypes.MANA);
          if (attackerMana) {
            attackerMana.current = Math.min(
              attackerMana.max,
              attackerMana.current + attackerSword.manaRestore
            );
          }
        }

        // Elemental Status Effects
        if (attackerSword.elementalEffect) {
          const effect = attackerSword.elementalEffect;
          if (effect.type === 'shock') {
            // Shock adds flat bonus hitstun frames immediately
            transform.hitstunFramesLeft = (transform.hitstunFramesLeft || 0) + effect.value;
          } else {
            // Burn/Freeze push onto defender's active status list
            const defenderStatus = world.getComponent(defenderId, ComponentTypes.STATUS_EFFECTS);
            if (defenderStatus) {
              const existing = defenderStatus.active.find(e => e.type === effect.type);
              if (existing) {
                existing.timer = effect.duration; // refresh duration
              } else {
                defenderStatus.active.push({
                  type: effect.type,
                  value: effect.value,
                  timer: effect.duration,
                  tickTimer: 0
                });
              }
            }
          }
        }
      }

      // 5. Ultimate Meter Adjustments
      const attackerUlt = world.getComponent(attackerId, ComponentTypes.ULTIMATE_METER);
      if (attackerUlt) {
        attackerUlt.current = addUltimateMeterOnDealtDamage(attackerUlt.current, finalDamage);
        if (attackerUlt.current >= 100) {
          attackerUlt.current = 100;
          attackerUlt.isReady = true;
        }
      }

      const defenderUlt = world.getComponent(defenderId, ComponentTypes.ULTIMATE_METER);
      if (defenderUlt) {
        defenderUlt.current = addUltimateMeterOnTakenDamage(defenderUlt.current, finalDamage);
        if (defenderUlt.current >= 100) {
          defenderUlt.current = 100;
          defenderUlt.isReady = true;
        }
      }

      // 6. Combo Counter Update
      if (attackerCombo) {
        attackerCombo.chainIndex++;
        attackerCombo.comboTimer = 180; // 3 seconds of buffer at 60Hz
      }

      // 7. Trigger Hitstop (render freeze)
      // Hitstop is proportional to damage magnitude: e.g. 50ms base + 5ms per point of damage, capped at 250ms
      if (triggerHitstop) {
        const hitstopDuration = Math.min(250, 50 + finalDamage * 5);
        triggerHitstop(hitstopDuration);
      }
    }

    // Clear resolved hits
    health.incomingHits = [];
  }
}
