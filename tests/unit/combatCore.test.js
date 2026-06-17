import { describe, it, expect } from 'vitest';
import { calculateDamage, checkCrit } from '../../src/combat-core/damageFormula.js';
import { calculateKnockback, calculateHitstun, HITSTUN_CAP } from '../../src/combat-core/knockbackFormula.js';
import { getComboDamageScalar, checkJuggleLimit } from '../../src/combat-core/comboScaling.js';
import { evaluateParry, PARRY_WINDOW_MS } from '../../src/combat-core/parryWindow.js';
import {
  addUltimateMeterOnDealtDamage,
  addUltimateMeterOnTakenDamage,
  addUltimateMeterOnParry,
  addUltimateMeterOnCounter
} from '../../src/combat-core/ultimateResolution.js';

describe('Combat Core Math Formulas', () => {
  
  describe('damageFormula.js', () => {
    // 4 character base stats (Strength / Defense)
    const knight = { strength: 1.10, defense: 0.12 };
    const samurai = { strength: 1.05, defense: 0.06 };
    const assassin = { strength: 0.95, defense: 0.04 };
    const mageWarrior = { strength: 1.00, defense: 0.08 };

    // 4 representative sword stats (Damage Mult)
    const steelVanguard = 1.00;
    const emberfallCleaver = 1.15;
    const dragonscaleGreatsword = 1.25;
    const solarisRapier = 0.90;

    it('should calculate base hits correctly for various character/sword pairings', () => {
      // Knight wielding Steel Vanguard (base move dmg: 10) vs Samurai (defense 0.06)
      const dmg1 = calculateDamage({
        baseMoveDamage: 10,
        attackerStrength: knight.strength,
        swordDamageMultiplier: steelVanguard,
        defenderDefensePercent: samurai.defense
      });
      // Expected = round(10 * 1.10 * 1.00 * 1.0 * 1.0 * (1 - 0.06)) = round(11 * 0.94) = round(10.34) = 10
      expect(dmg1).toBe(10);

      // Samurai wielding Emberfall Cleaver vs Knight (defense 0.12)
      const dmg2 = calculateDamage({
        baseMoveDamage: 15,
        attackerStrength: samurai.strength,
        swordDamageMultiplier: emberfallCleaver,
        defenderDefensePercent: knight.defense
      });
      // Expected = round(15 * 1.05 * 1.15 * 1.0 * 1.0 * (1 - 0.12)) = round(18.1125 * 0.88) = round(15.939) = 16
      expect(dmg2).toBe(16);

      // Assassin wielding Solaris Rapier vs Mage Warrior (defense 0.08)
      const dmg3 = calculateDamage({
        baseMoveDamage: 12,
        attackerStrength: assassin.strength,
        swordDamageMultiplier: solarisRapier,
        defenderDefensePercent: mageWarrior.defense
      });
      // Expected = round(12 * 0.95 * 0.90 * 1.0 * (1 - 0.08)) = round(10.26 * 0.92) = round(9.4392) = 9
      expect(dmg3).toBe(9);
    });

    it('should calculate critical hits correctly', () => {
      // Mage Warrior wielding Dragonscale Greatsword (base move: 20) with Crit vs Knight
      const dmg = calculateDamage({
        baseMoveDamage: 20,
        attackerStrength: mageWarrior.strength,
        swordDamageMultiplier: dragonscaleGreatsword,
        isCrit: true,
        critMultiplier: 1.5,
        defenderDefensePercent: knight.defense
      });
      // Expected = round(20 * 1.00 * 1.25 * 1.0 * 1.5 * (1 - 0.12)) = round(37.5 * 0.88) = round(33.0) = 33
      expect(dmg).toBe(33);
    });

    it('should verify critical strike check probability', () => {
      // Chance: base(12) + sword(5) + combo(3) = 20%
      expect(checkCrit(12, 5, 3, 19)).toBe(true);  // roll < 20
      expect(checkCrit(12, 5, 3, 20)).toBe(false); // roll = 20 (not critical)
    });
  });

  describe('knockbackFormula.js', () => {
    it('should scale knockback inversely with defender weight', () => {
      const kbHeavy = calculateKnockback({
        baseKnockback: 10,
        finalDamage: 20,
        defenderMaxHP: 100,
        defenderWeight: 1.20, // Knight
        moveLaunchAngle: 45,
        attackerFacing: 1
      });

      const kbLight = calculateKnockback({
        baseKnockback: 10,
        finalDamage: 20,
        defenderMaxHP: 100,
        defenderWeight: 0.75, // Assassin
        moveLaunchAngle: 45,
        attackerFacing: 1
      });

      expect(kbLight.magnitude).toBeGreaterThan(kbHeavy.magnitude);
      // kbHeavy = 10 * (1.2) / 1.2 = 10
      // kbLight = 10 * (1.2) / 0.75 = 16
      expect(kbHeavy.magnitude).toBeCloseTo(10);
      expect(kbLight.magnitude).toBeCloseTo(16);
    });

    it('should apply counter/parry punish bonus', () => {
      const kbNormal = calculateKnockback({
        baseKnockback: 10,
        finalDamage: 10,
        defenderMaxHP: 100,
        defenderWeight: 1.0,
        moveLaunchAngle: 0,
        attackerFacing: 1
      });

      const kbPunish = calculateKnockback({
        baseKnockback: 10,
        finalDamage: 10,
        defenderMaxHP: 100,
        defenderWeight: 1.0,
        isCounterOrParryPunish: true,
        moveLaunchAngle: 0,
        attackerFacing: 1
      });

      expect(kbPunish.magnitude).toBeCloseTo(kbNormal.magnitude * 1.3);
    });

    it('should calculate directional vectors depending on facing', () => {
      const kbRight = calculateKnockback({
        baseKnockback: 10,
        finalDamage: 0,
        defenderMaxHP: 100,
        defenderWeight: 1.0,
        moveLaunchAngle: 0,
        attackerFacing: 1
      });

      const kbLeft = calculateKnockback({
        baseKnockback: 10,
        finalDamage: 0,
        defenderMaxHP: 100,
        defenderWeight: 1.0,
        moveLaunchAngle: 0,
        attackerFacing: -1
      });

      expect(kbRight.vector.x).toBe(1);
      expect(kbLeft.vector.x).toBe(-1);
    });

    it('should assert hitstun never exceeds HITSTUN_CAP', () => {
      const normalHitstun = calculateHitstun(15, 0.2); // 15 * 1.2 = 18
      const maxHitstun = calculateHitstun(50, 0.5);   // 50 * 1.5 = 75 (capped at 60)
      
      expect(normalHitstun).toBe(18);
      expect(maxHitstun).toBe(HITSTUN_CAP);
    });
  });

  describe('comboScaling.js', () => {
    it('should scale damage down per combo progression step', () => {
      expect(getComboDamageScalar(0)).toBe(1.0);
      expect(getComboDamageScalar(1)).toBe(0.85);
      expect(getComboDamageScalar(2)).toBe(0.70);
      expect(getComboDamageScalar(3)).toBe(0.55);
      expect(getComboDamageScalar(10)).toBe(0.55); // Floor
    });

    it('should verify combo chains stay below maximum threshold (preventing infinites)', () => {
      // Simulate 10-hit combo chain of moves with base move damage of 10
      let totalDamage = 0;
      for (let i = 0; i < 10; i++) {
        const scalar = getComboDamageScalar(i);
        const dmg = calculateDamage({
          baseMoveDamage: 10,
          attackerStrength: 1.0,
          comboScalar: scalar
        });
        totalDamage += dmg;
      }
      
      // Infinite/unscaled 10-hit: 10 * 10 = 100
      // Scaled 10-hit: 10*1.0 + 10*0.85 + 10*0.70 + 7*10*0.55 = 10 + 9 + 7 + 7*6 = 26 + 42 = 68
      // Asserts that scaled combo damage does not grow linearly
      expect(totalDamage).toBe(68); // rounded per-hit values: 10 + 9 + 7 + 7 * 6 = 68
      expect(totalDamage).toBeLessThan(100);
    });

    it('should check juggle limits correctly', () => {
      expect(checkJuggleLimit(3)).toBe(false);
      expect(checkJuggleLimit(4)).toBe(true);
    });
  });

  describe('parryWindow.js', () => {
    it('should register successful parries exactly within the active window', () => {
      // Boundary checks
      expect(evaluateParry(0).success).toBe(true);
      expect(evaluateParry(PARRY_WINDOW_MS).success).toBe(true);
      expect(evaluateParry(PARRY_WINDOW_MS - 1).success).toBe(true);
      
      // Outside window check
      expect(evaluateParry(-1).success).toBe(false);
      expect(evaluateParry(PARRY_WINDOW_MS + 1).success).toBe(false);
      
      // Check recovery times
      expect(evaluateParry(100).attackerParriedDuration).toBe(500);
      expect(evaluateParry(200).defenderRecovery).toBe(300);
    });
  });

  describe('ultimateResolution.js', () => {
    it('should charge ultimate meter up to a cap of 100', () => {
      let meter = 0;
      meter = addUltimateMeterOnDealtDamage(meter, 50); // 50 * 0.6 = 30
      expect(meter).toBe(30);

      meter = addUltimateMeterOnTakenDamage(meter, 40); // 30 + 40 * 0.25 = 40
      expect(meter).toBe(40);

      meter = addUltimateMeterOnParry(meter); // 40 + 12 = 52
      expect(meter).toBe(52);

      meter = addUltimateMeterOnCounter(meter); // 52 + 8 = 60
      expect(meter).toBe(60);

      // Exceed cap
      meter = addUltimateMeterOnDealtDamage(meter, 100); // 60 + 60 = 120 (capped at 100)
      expect(meter).toBe(100);
    });
  });

});
