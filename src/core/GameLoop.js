export class GameLoop {
  /**
   * @param {Object} options
   * @param {Function} options.update - Called on simulation step (fixed dt)
   * @param {Function} options.render - Called on render step (variable rate, passing alpha)
   * @param {number} [options.fps=60] - Target simulation frames per second
   */
  constructor({ update, render, fps = 60 }) {
    this.updateFn = update;
    this.renderFn = render;
    
    this.fixedDt = 1000 / fps; // default 16.67ms
    this.maxAccumulator = 250; // prevent spiral of death

    this.accumulator = 0;
    this.lastTime = 0;
    this.animationFrameId = null;
    this.running = false;

    this.hitstopTimer = 0; // ms of time-freeze
    
    // Fallbacks for node/headless test environments
    this.requestFrame = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame
      : (cb) => setTimeout(() => cb(performance.now()), this.fixedDt);
      
    this.cancelFrame = typeof cancelAnimationFrame !== 'undefined'
      ? cancelAnimationFrame
      : (id) => clearTimeout(id);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.animationFrameId = this.requestFrame.call(null, this.tick.bind(this));
  }

  stop() {
    this.running = false;
    if (this.animationFrameId !== null) {
      this.cancelFrame.call(null, this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Set hitstop duration in milliseconds
   * @param {number} durationMs 
   */
  triggerHitstop(durationMs) {
    this.hitstopTimer = durationMs;
  }

  tick(now) {
    if (!this.running) return;

    let delta = now - this.lastTime;
    if (delta < 0) delta = 0;
    
    // Clamp delta to avoid huge jumps if window loses focus
    if (delta > this.maxAccumulator) {
      delta = this.maxAccumulator;
    }

    this.lastTime = now;
    this.accumulator += delta;

    while (this.accumulator >= this.fixedDt) {
      if (this.hitstopTimer > 0) {
        // Decrease hitstop timer by fixed timestep
        this.hitstopTimer -= this.fixedDt;
        if (this.hitstopTimer < 0) this.hitstopTimer = 0;
        // Skip updating simulation but keep rendering
      } else {
        // Step the actual simulation
        this.updateFn(this.fixedDt);
      }
      this.accumulator -= this.fixedDt;
    }

    // Render interpolation fraction (alpha)
    const alpha = this.accumulator / this.fixedDt;
    this.renderFn(alpha);

    this.animationFrameId = this.requestFrame.call(null, this.tick.bind(this));
  }
}
