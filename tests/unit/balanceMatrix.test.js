import { describe, it, expect } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { MatterWorld } from '../../src/physics/MatterWorld.js';
import { aiSystem } from '../../src/systems/01-ai/AISystem.js';
import { actionResolutionSystem } from '../../src/systems/03-action/ActionResolutionSystem.js';
import { movementSystem } from '../../src/systems/04-movement/MovementSystem.js';
import { physicsPostUpdateSystem } from '../../src/systems/05-physics/PhysicsPostUpdateSystem.js';
import { hitDetectionSystem } from '../../src/systems/08-combat/HitDetectionSystem.js';
import { damageResolutionSystem } from '../../src/systems/09-combat/DamageResolutionSystem.js';
import { comboTrackingSystem } from '../../src/systems/10-resources/ComboTrackingSystem.js';
import { statusEffectSystem } from '../../src/systems/10-resources/StatusEffectSystem.js';
import { lifetimeSystem } from '../../src/systems/12-lifetime/LifetimeSystem.js';
import { loadCharacter } from '../../src/core/characterLoader.js';
import { equipSword } from '../../src/core/swordLoader.js';
import { loadArena } from '../../src/core/arenaLoader.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';

describe('QA Balance-Matrix Headless Simulations', () => {
  const runSimulation = (p1Class, p1Sword, p2Class, p2Sword) => {
    const world = new World();
    const physics = new MatterWorld();

    loadArena('forestTemple', physics, null);

    // Spawn Fighter 1 (AI)
    const f1 = world.createEntity();
    loadCharacter(world, f1, physics, p1Class, 300, 150, false);
    equipSword(world, f1, p1Sword);
    world.getComponent(f1, ComponentTypes.AI_CONTROLLER).difficulty = 'hard';

    // Spawn Fighter 2 (AI)
    const f2 = world.createEntity();
    loadCharacter(world, f2, physics, p2Class, 800, 150, false);
    equipSword(world, f2, p2Sword);
    world.getComponent(f2, ComponentTypes.AI_CONTROLLER).difficulty = 'hard';

    let ticks = 0;
    const maxTicks = 1500;

    while (ticks < maxTicks) {
      const h1 = world.getComponent(f1, ComponentTypes.HEALTH);
      const h2 = world.getComponent(f2, ComponentTypes.HEALTH);

      if (h1.current <= 0 || h2.current <= 0) {
        break;
      }

      // Execute game loop logic
      aiSystem(world);
      actionResolutionSystem(world, physics);
      movementSystem(world, 0.016, physics);
      physics.update(16);
      physicsPostUpdateSystem(world, physics);
      hitDetectionSystem(world, physics);
      damageResolutionSystem(world);
      comboTrackingSystem(world);
      statusEffectSystem(world);
      lifetimeSystem(world);

      ticks++;
    }

    const h1 = world.getComponent(f1, ComponentTypes.HEALTH);
    const h2 = world.getComponent(f2, ComponentTypes.HEALTH);

    return {
      ticks,
      f1Hp: h1.current,
      f2Hp: h2.current,
      winner: h1.current > h2.current ? 'f1' : (h2.current > h1.current ? 'f2' : 'draw')
    };
  };

  it('should run a match between Knight and Samurai and resolve within 4000 ticks', () => {
    const result = runSimulation('knight', 'steelBroadsword', 'samurai', 'muramasa');
    expect(result.ticks).toBeLessThan(4000);
    expect(result.winner).not.toBe('draw');
  });

  it('should run a match between Assassin and Mage Warrior and resolve successfully', () => {
    const result = runSimulation('assassin', 'flameTongue', 'mage', 'spellfireEdge');
    expect(result.ticks).toBeLessThan(4000);
    expect(result.winner).not.toBe('draw');
  });
});
