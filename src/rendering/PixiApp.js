import * as PIXI from 'pixi.js';

// Set global PIXI settings for pixel art (v7 API)
PIXI.BaseTexture.defaultOptions.scaleMode = PIXI.SCALE_MODES.NEAREST;

export class PixiApp {
  constructor() {
    this.logicalWidth = 640;
    this.logicalHeight = 360;
    
    const canvas = document.getElementById('game-canvas');
    const wrapper = document.getElementById('game-canvas-wrapper');
    const initialWidth = wrapper ? wrapper.clientWidth : window.innerWidth;
    const initialHeight = wrapper ? wrapper.clientHeight : window.innerHeight;
    
    this.app = new PIXI.Application({
      view: canvas,
      width: initialWidth,
      height: initialHeight,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
      backgroundAlpha: 1,
      backgroundColor: 0x070709
    });

    // Root gameplay container that holds all our scaled layers
    this.gameplayViewport = new PIXI.Container();
    this.app.stage.addChild(this.gameplayViewport);

    // Setup window resize listener
    window.addEventListener('resize', this.resize.bind(this));
    this.resize();
  }

  resize() {
    const wrapper = document.getElementById('game-canvas-wrapper');
    const w = wrapper ? wrapper.clientWidth : window.innerWidth;
    const h = wrapper ? wrapper.clientHeight : window.innerHeight;
    
    // Resize the renderer
    this.app.renderer.resize(w, h);

    // Calculate scale factor to fit the viewport
    const scaleX = w / this.logicalWidth;
    const scaleY = h / this.logicalHeight;
    const scale = Math.min(scaleX, scaleY);
    
    // Scale viewport
    this.gameplayViewport.scale.set(scale);

    // Center viewport in screen
    this.gameplayViewport.x = Math.round((w - this.logicalWidth * scale) / 2);
    this.gameplayViewport.y = Math.round((h - this.logicalHeight * scale) / 2);
  }

  destroy() {
    window.removeEventListener('resize', this.resize.bind(this));
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }
}
