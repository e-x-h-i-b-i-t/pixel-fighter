import { describe, it, expect, beforeEach, vi } from 'vitest';
import Matter from 'matter-js';
import { World } from '../../src/ecs/World.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';
import { MatterWorld } from '../../src/physics/MatterWorld.js';
import { spawnHitbox } from '../../src/combat-core/hitboxSpawner.js';
import { physicsPostUpdateSystem } from '../../src/systems/05-physics/PhysicsPostUpdateSystem.js';
import { hitDetectionSystem } from '../../src/systems/08-combat/HitDetectionSystem.js';
import { damageResolutionSystem } from '../../src/systems/09-combat/DamageResolutionSystem.js';

describe('Combat ECS Systems Integration', () => {
  let world;
  let physics;

  beforeEach(() => {
    world = new World();
    physics = new MatterWorld();
  });

  it('should detect hitbox-hurtbox overlaps and resolve damage and knockback', () => {
    // 1. Setup attacker
    const attacker = world.createEntity();
    world.addComponent(attacker, ComponentTypes.TRANSFORM, { x: 100, y: 100, facing: 1 });
    world.addComponent(attacker, ComponentTypes.COMBO_STATE, { chainIndex: 0, comboTimer: 0 });
    world.addComponent(attacker, ComponentTypes.ULTIMATE_METER, { current: 0 });

    // 2. Setup defender
    const defender = world.createEntity();
    world.addComponent(defender, ComponentTypes.TRANSFORM, { x: 130, y: 100 }); // positioned 30px to the right
    world.addComponent(defender, ComponentTypes.VELOCITY, { vx: 0, vy: 0 });
    world.addComponent(defender, ComponentTypes.HEALTH, { current: 100, max: 100 });
    world.addComponent(defender, ComponentTypes.ULTIMATE_METER, { current: 0 });
    
    // Create Matter sensor body for defender hurtbox
    const hurtboxBody = Matter.Bodies.rectangle(130, 100, 30, 50, { isSensor: true });
    physics.registerBody(hurtboxBody, defender);
    world.addComponent(defender, ComponentTypes.PHYSICS_BODY, {
      matterBodyId: hurtboxBody.id
    });
    world.addComponent(defender, ComponentTypes.HURTBOX, {
      size: { width: 30, height: 50 }
    });

    // 3. Spawn hitbox relative to attacker (offset: {x: 25, y: 0}, size: {width: 20, height: 20})
    // Attacker is at 100, so hitbox will be at 125, overlapping defender's hurtbox at 130 (size: 30x50, extends from x: 115 to 145)
    const hitbox = spawnHitbox(world, attacker, physics, {
      offset: { x: 25, y: 0 },
      size: { width: 20, height: 20 },
      lifetimeFrames: 5,
      damagePacket: {
        baseDamage: 10,
        baseKnockback: 4,
        moveLaunchAngle: 0, // horizontal right
        canCrit: false // avoid random crit rolls for deterministic test
      }
    });

    expect(hitbox).toBeDefined();

    // 4. Sync physical body positions (runs in Step 5)
    physicsPostUpdateSystem(world, physics);

    // Verify hitbox body positioned correctly
    const hitboxPhys = world.getComponent(hitbox, ComponentTypes.PHYSICS_BODY);
    const hitboxBody = physics.world.bodies.find(b => b.id === hitboxPhys.matterBodyId);
    expect(hitboxBody.position.x).toBe(125);
    expect(hitboxBody.position.y).toBe(100);

    // 5. Run hit detection (runs in Step 8)
    hitDetectionSystem(world, physics);

    const defenderHealth = world.getComponent(defender, ComponentTypes.HEALTH);
    expect(defenderHealth.incomingHits.length).toBe(1);
    expect(defenderHealth.incomingHits[0].baseDamage).toBe(10);

    // 6. Run damage resolution (runs in Step 9)
    const hitstopSpy = vi.fn();
    damageResolutionSystem(world, hitstopSpy);

    // Assert defender took damage
    // Base damage = 10, Attacker strength = 1.0, combo scalar = 1.0, defense = 0.0 -> damage = 10
    expect(defenderHealth.current).toBe(90);
    expect(defenderHealth.incomingHits.length).toBe(0); // cleared

    // Assert defender took knockback
    const defenderVelocity = world.getComponent(defender, ComponentTypes.VELOCITY);
    // baseKnockback = 4, finalDmg = 10, maxHP = 100 -> ratio = 0.1 -> magnitude = 4 * (1.1) / 1.0 = 4.4
    // vector = facing (1) * cos(0) = 1, y = -sin(0) = 0 -> vx = 4.4, vy = 0
    expect(defenderVelocity.vx).toBeCloseTo(4.4);
    expect(defenderVelocity.vy).toBe(0);

    // Assert ultimate meters charged
    const attackerUlt = world.getComponent(attacker, ComponentTypes.ULTIMATE_METER);
    const defenderUlt = world.getComponent(defender, ComponentTypes.ULTIMATE_METER);
    // Attacker charge = 10 * 0.6 = 6
    // Defender charge = 10 * 0.25 = 2.5
    expect(attackerUlt.current).toBeCloseTo(6);
    expect(defenderUlt.current).toBeCloseTo(2.5);

    // Assert combo incremented
    const attackerCombo = world.getComponent(attacker, ComponentTypes.COMBO_STATE);
    expect(attackerCombo.chainIndex).toBe(1);

    // Assert hitstop was triggered
    expect(hitstopSpy).toHaveBeenCalledWith(50 + 10 * 5); // 100ms
  });
});
