import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';
import { equipSword } from '../../src/core/swordLoader.js';
import { damageResolutionSystem } from '../../src/systems/09-combat/DamageResolutionSystem.js';

describe('Equipped Sword Effects in DamageResolutionSystem', () => {
  let world;
  let attacker;
  let defender;

  beforeEach(() => {
    world = new World();
    
    // Attacker setup
    attacker = world.createEntity();
    world.addComponent(attacker, ComponentTypes.TRANSFORM, { facing: 1 });
    world.addComponent(attacker, ComponentTypes.HEALTH, { current: 50, max: 120 }); // injured
    world.addComponent(attacker, ComponentTypes.MANA, { current: 10, max: 100 });   // low mana
    
    // Defender setup
    defender = world.createEntity();
    world.addComponent(defender, ComponentTypes.TRANSFORM, { x: 200, y: 150, hitstunFramesLeft: 0 });
    world.addComponent(defender, ComponentTypes.VELOCITY, { vx: 0, vy: 0 });
    world.addComponent(defender, ComponentTypes.HEALTH, {
      current: 100,
      max: 100,
      incomingHits: []
    });
    world.addComponent(defender, ComponentTypes.STATUS_EFFECTS, { active: [] });
  });

  it('should apply burn status effect on Flame Tongue hit', () => {
    equipSword(world, attacker, 'flameTongue');

    const defHealth = world.getComponent(defender, ComponentTypes.HEALTH);
    defHealth.incomingHits.push({
      attackerId: attacker,
      baseDamage: 20,
      baseKnockback: 2.0,
      moveLaunchAngle: 45,
      hitstunFrames: 10,
      canCrit: false
    });

    damageResolutionSystem(world);

    const defStatus = world.getComponent(defender, ComponentTypes.STATUS_EFFECTS);
    expect(defStatus.active.length).toBe(1);
    expect(defStatus.active[0].type).toBe('burn');
    expect(defStatus.active[0].value).toBe(3);
    expect(defStatus.active[0].timer).toBe(180);
  });

  it('should heal attacker (lifesteal) on Vampiric Blade hit', () => {
    equipSword(world, attacker, 'vampiricBlade');

    const defHealth = world.getComponent(defender, ComponentTypes.HEALTH);
    defHealth.incomingHits.push({
      attackerId: attacker,
      baseDamage: 30, // 30 dmg * 0.9 dmg multiplier = 27 final damage. 27 * 0.20 lifesteal = 5 healing.
      baseKnockback: 2.0,
      moveLaunchAngle: 45,
      hitstunFrames: 10,
      canCrit: false
    });

    damageResolutionSystem(world);

    const attHealth = world.getComponent(attacker, ComponentTypes.HEALTH);
    expect(attHealth.current).toBe(55); // 50 + 5 = 55
  });

  it('should restore mana to attacker on Spellfire Edge hit', () => {
    equipSword(world, attacker, 'spellfireEdge');

    const defHealth = world.getComponent(defender, ComponentTypes.HEALTH);
    defHealth.incomingHits.push({
      attackerId: attacker,
      baseDamage: 10,
      baseKnockback: 2.0,
      moveLaunchAngle: 45,
      hitstunFrames: 10,
      canCrit: false
    });

    damageResolutionSystem(world);

    const attMana = world.getComponent(attacker, ComponentTypes.MANA);
    expect(attMana.current).toBe(18); // 10 + 8 = 18
  });

  it('should increase hitstun duration on Storm Bringer shock hit', () => {
    equipSword(world, attacker, 'stormBringer');

    const defHealth = world.getComponent(defender, ComponentTypes.HEALTH);
    defHealth.incomingHits.push({
      attackerId: attacker,
      baseDamage: 10,
      baseKnockback: 2.0,
      moveLaunchAngle: 45,
      hitstunFrames: 10, // base hitstun = 10
      canCrit: false
    });

    damageResolutionSystem(world);

    const defTransform = world.getComponent(defender, ComponentTypes.TRANSFORM);
    // base hitstun (10) + stormBringer extra shock (8) = 18 frames
    expect(defTransform.hitstunFramesLeft).toBe(18);
  });
});
