import { describe, it, expect, beforeEach } from 'vitest';
import { MatterWorld } from '../../src/physics/MatterWorld.js';
import { loadArena, ArenaTemplates } from '../../src/core/arenaLoader.js';

describe('Arena Loader', () => {
  let physics;

  beforeEach(() => {
    physics = new MatterWorld();
  });

  it('should load Forest Temple layout and register correct number of static bodies', () => {
    const properties = loadArena('forestTemple', physics, null);

    // Assert arena size properties
    expect(properties.width).toBe(ArenaTemplates.forestTemple.width);
    expect(properties.groundY).toBe(ArenaTemplates.forestTemple.groundY);

    // Assert bodies registered in Matter world
    // Floor (1) + Walls (2) + Platforms (3) = 6 static bodies
    const staticBodies = physics.world.bodies.filter(b => b.isStatic);
    expect(staticBodies.length).toBe(6);
  });

  it('should clear old static bodies when loading a new arena', () => {
    loadArena('forestTemple', physics, null);
    // Switch to volcano (floor + 2 walls + 2 platforms = 5 static bodies)
    loadArena('volcano', physics, null);

    const staticBodies = physics.world.bodies.filter(b => b.isStatic);
    expect(staticBodies.length).toBe(5);
  });
});
