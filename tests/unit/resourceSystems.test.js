import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';
import { comboTrackingSystem } from '../../src/systems/10-resources/ComboTrackingSystem.js';
import { statusEffectSystem } from '../../src/systems/10-resources/StatusEffectSystem.js';

describe('Resource Systems', () => {
  let world;

  beforeEach(() => {
    world = new World();
  });

  describe('ComboTrackingSystem', () => {
    it('should decrement combo timer and reset combo chain on expiration', () => {
      const entity = world.createEntity();
      world.addComponent(entity, ComponentTypes.COMBO_STATE, {
        chainIndex: 3,
        comboTimer: 2 // 2 ticks left
      });

      const combo = world.getComponent(entity, ComponentTypes.COMBO_STATE);

      // Tick 1
      comboTrackingSystem(world);
      expect(combo.comboTimer).toBe(1);
      expect(combo.chainIndex).toBe(3);

      // Tick 2
      comboTrackingSystem(world);
      expect(combo.comboTimer).toBe(0);
      expect(combo.chainIndex).toBe(0); // reset!
    });
  });

  describe('StatusEffectSystem', () => {
    it('should tick burn damage periodically and expire', () => {
      const entity = world.createEntity();
      world.addComponent(entity, ComponentTypes.HEALTH, { current: 100, max: 100 });
      world.addComponent(entity, ComponentTypes.STATUS_EFFECTS, {
        active: [
          { type: 'burn', value: 5, timer: 35, tickTimer: 28 } // expires in 35 ticks, ticks in 2 ticks
        ]
      });

      const health = world.getComponent(entity, ComponentTypes.HEALTH);
      const status = world.getComponent(entity, ComponentTypes.STATUS_EFFECTS);

      // Tick 1 (tickTimer becomes 29)
      statusEffectSystem(world);
      expect(health.current).toBe(100);
      expect(status.active[0].timer).toBe(34);

      // Tick 2 (tickTimer becomes 30 -> triggers burn deal 5 damage -> resets to 0)
      statusEffectSystem(world);
      expect(health.current).toBe(95);
      expect(status.active[0].timer).toBe(33);

      // Fast forward 33 ticks to expire
      for (let i = 0; i < 33; i++) {
        statusEffectSystem(world);
      }
      expect(status.active.length).toBe(0); // expired and removed
    });

    it('should apply freeze slow modifier and restore once expired', () => {
      const entity = world.createEntity();
      world.addComponent(entity, ComponentTypes.HEALTH, { current: 100 });
      world.addComponent(entity, ComponentTypes.TRANSFORM, { speedModifier: 1.0 });
      world.addComponent(entity, ComponentTypes.STATUS_EFFECTS, {
        active: [
          { type: 'freeze', value: 0.4, timer: 2 } // 40% speed, 2 ticks duration
        ]
      });

      const transform = world.getComponent(entity, ComponentTypes.TRANSFORM);
      const status = world.getComponent(entity, ComponentTypes.STATUS_EFFECTS);

      // Tick 1
      statusEffectSystem(world);
      expect(transform.speedModifier).toBe(0.4);
      expect(status.active[0].timer).toBe(1);

      // Tick 2 (expires)
      statusEffectSystem(world);
      expect(status.active.length).toBe(0);
      expect(transform.speedModifier).toBe(1.0); // restored
    });
  });
});
