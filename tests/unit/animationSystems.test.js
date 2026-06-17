import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../../src/ecs/World.js';
import { ComponentTypes } from '../../src/ecs/componentTypes.js';
import { animationStateSystem } from '../../src/systems/11-animation/AnimationStateSystem.js';
import { renderSyncSystem } from '../../src/systems/17-render/RenderSyncSystem.js';

describe('Animation & Render Synchronization Systems', () => {
  let world;

  beforeEach(() => {
    world = new World();
  });

  it('should map velocity to walking/running and tick frame indexes', () => {
    const entity = world.createEntity();
    world.addComponent(entity, ComponentTypes.TRANSFORM, { x: 100, y: 100, hitstunFramesLeft: 0, isAirborne: false });
    world.addComponent(entity, ComponentTypes.VELOCITY, { vx: 1.5, vy: 0 }); // moving horizontally
    world.addComponent(entity, ComponentTypes.ANIMATION_STATE, {
      currentClip: 'idle',
      frameIndex: 0,
      frameTimer: 0,
      frameDurationTicks: 2
    });

    const anim = world.getComponent(entity, ComponentTypes.ANIMATION_STATE);

    // Tick 1: updates targetClip to 'walk' and resets frames
    animationStateSystem(world);
    expect(anim.currentClip).toBe('walk');
    expect(anim.frameIndex).toBe(0);
    expect(anim.frameTimer).toBe(1);

    // Tick 2: timer reaches duration (2) -> increments frameIndex
    animationStateSystem(world);
    expect(anim.frameIndex).toBe(1);
    expect(anim.frameTimer).toBe(0);
  });

  it('should switch to hitstun clip when stun is active', () => {
    const entity = world.createEntity();
    world.addComponent(entity, ComponentTypes.TRANSFORM, { x: 100, y: 100, hitstunFramesLeft: 10 });
    world.addComponent(entity, ComponentTypes.VELOCITY, { vx: 0, vy: 0 });
    world.addComponent(entity, ComponentTypes.ANIMATION_STATE, { currentClip: 'idle' });

    animationStateSystem(world);
    const anim = world.getComponent(entity, ComponentTypes.ANIMATION_STATE);
    expect(anim.currentClip).toBe('hit');
  });

  it('should sync transform coordinates and texture frames to PixiJS Sprite', () => {
    // Mock Pixi Sprite
    const mockSprite = {
      position: {
        x: 0,
        y: 0,
        set: (x, y) => {
          mockSprite.position.x = x;
          mockSprite.position.y = y;
        }
      },
      scale: {
        x: 0,
        y: 0,
        set: (x, y) => {
          mockSprite.scale.x = x;
          mockSprite.scale.y = y;
        }
      },
      anchor: {
        set: vi.fn()
      },
      rotation: 0,
      texture: null
    };

    const mockTextures = {
      idle: ['tex_idle_0', 'tex_idle_1', 'tex_idle_2', 'tex_idle_3'],
      walk: ['tex_walk_0', 'tex_walk_1', 'tex_walk_2', 'tex_walk_3']
    };

    const entity = world.createEntity();
    world.addComponent(entity, ComponentTypes.TRANSFORM, { x: 150, y: 200, facing: -1, scale: 2.0, rotation: 0.5 });
    world.addComponent(entity, ComponentTypes.ANIMATION_STATE, { currentClip: 'idle', frameIndex: 2 });
    world.addComponent(entity, ComponentTypes.SPRITE_REF, {
      sprite: mockSprite,
      animations: mockTextures
    });

    renderSyncSystem(world);

    expect(mockSprite.position.x).toBe(150);
    expect(mockSprite.position.y).toBe(200);
    expect(mockSprite.scale.x).toBe(-2.0); // scale flipped by facing -1
    expect(mockSprite.scale.y).toBe(2.0);
    expect(mockSprite.rotation).toBe(0.5);
    expect(mockSprite.texture).toBe('tex_idle_2'); // matches frameIndex 2 of idle
  });
});
