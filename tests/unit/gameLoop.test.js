import { describe, it, expect, vi } from 'vitest';
import { GameLoop } from '../../src/core/GameLoop.js';

describe('GameLoop', () => {
  it('should call update and render callbacks', () => {
    const updateSpy = vi.fn();
    const renderSpy = vi.fn();
    const loop = new GameLoop({
      update: updateSpy,
      render: renderSpy,
      fps: 60
    });

    // Manually trigger a tick with a 34ms step (slightly above 2 frames of 16.67ms)
    loop.running = true;
    loop.lastTime = 0;
    loop.tick(34);

    // With 34ms, we expect 2 updates of 16.67ms
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledWith(expect.any(Number));
  });

  it('should skip updates during hitstop', () => {
    const updateSpy = vi.fn();
    const renderSpy = vi.fn();
    const loop = new GameLoop({
      update: updateSpy,
      render: renderSpy,
      fps: 60
    });

    loop.running = true;
    loop.lastTime = 0;
    
    // Set 20ms of hitstop
    loop.triggerHitstop(20);

    // Tick by 34ms (which accumulates 2 frames of 16.67ms)
    loop.tick(34);

    // First frame (16.67ms): hitstop decreases to 3.33ms, update is SKIPPED
    // Second frame (16.67ms): hitstop decreases to 0 (clamps to 0), update is SKIPPED
    // Net updates should be 0, and hitstop timer should clamp to 0
    expect(updateSpy).toHaveBeenCalledTimes(0);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(loop.hitstopTimer).toBe(0);

    // Tick again by 18ms (total time 52ms). Hitstop is 0, so update should run
    loop.tick(52);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
