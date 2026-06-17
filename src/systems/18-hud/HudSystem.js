import * as PIXI from 'pixi.js';
import { ComponentTypes } from '../../ecs/componentTypes.js';

export class HudSystem {
  constructor(pixiApp) {
    this.pixiApp = pixiApp;
    this.container = null;
    this.graphics = null;
    
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof document.createElement === 'function';

    if (this.pixiApp && isBrowser) {
      this.container = new PIXI.Container();
      this.container.label = 'hudContainer';
      this.pixiApp.layers.uiLayer.addChild(this.container);
      this.initGraphics();
    }
  }

  initGraphics() {
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    // Style for player names
    const textStyle = {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      fill: '#ffffff',
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 3,
      dropShadowAngle: Math.PI / 6,
      dropShadowDistance: 2
    };

    this.p1NameText = new PIXI.Text('P1: FIGHTER', textStyle);
    this.p1NameText.position.set(20, 10);
    this.container.addChild(this.p1NameText);

    this.p2NameText = new PIXI.Text('P2: FIGHTER', textStyle);
    this.p2NameText.position.set(440, 10);
    this.container.addChild(this.p2NameText);

    // Combo texts
    const comboStyle = {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: 22,
      fontWeight: '900',
      fill: '#f59e0b', // amber
      stroke: '#000000',
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 4,
      dropShadowDistance: 2
    };

    this.p1ComboText = new PIXI.Text('', comboStyle);
    this.p1ComboText.position.set(30, 70);
    this.p1ComboText.visible = false;
    this.container.addChild(this.p1ComboText);

    this.p2ComboText = new PIXI.Text('', comboStyle);
    this.p2ComboText.position.set(550, 70);
    this.p2ComboText.visible = false;
    this.container.addChild(this.p2ComboText);
  }

  /**
   * Updates and redraws the HUD elements based on player/AI entity states.
   * @param {World} world 
   */
  update(world) {
    if (!this.graphics) return;

    this.graphics.clear();

    const players = world.query([ComponentTypes.INPUT_CONTROLLER]);
    const ais = world.query([ComponentTypes.AI_CONTROLLER]);

    const p1Id = players.length > 0 ? players[0] : null;
    const p2Id = ais.length > 0 ? ais[0] : null;

    // Redraw Player 1 HUD
    if (p1Id !== null) {
      this.drawPlayerHud(world, p1Id, 20, 26, 1);
    }

    // Redraw Player 2 HUD
    if (p2Id !== null) {
      // Draw P2 aligned to the right (x=440 to 620)
      this.drawPlayerHud(world, p2Id, 440, 26, 2);
    }
  }

  drawPlayerHud(world, entityId, startX, startY, playerNum) {
    const health = world.getComponent(entityId, ComponentTypes.HEALTH);
    const stamina = world.getComponent(entityId, ComponentTypes.STAMINA);
    const mana = world.getComponent(entityId, ComponentTypes.MANA);
    const ult = world.getComponent(entityId, ComponentTypes.ULTIMATE_METER);
    const combo = world.getComponent(entityId, ComponentTypes.COMBO_STATE);
    const transform = world.getComponent(entityId, ComponentTypes.TRANSFORM);

    if (!health) return;

    // Draw Name/Class text
    const nameText = playerNum === 1 ? this.p1NameText : this.p2NameText;
    const className = (transform.characterClass || 'knight').toUpperCase();
    nameText.text = `P${playerNum}: ${className}`;

    const g = this.graphics;

    // 1. Health Bar
    // Background
    g.beginFill(0x1e293b); // Slate-800
    g.drawRect(startX, startY, 180, 12);
    g.endFill();

    // Fill ratio
    const hpRatio = Math.max(0, Math.min(1, health.current / health.max));
    // Premium health color: red to emerald gradient feel
    const hpColor = hpRatio > 0.5 ? 0x10b981 : (hpRatio > 0.25 ? 0xf59e0b : 0xef4444);
    
    g.beginFill(hpColor);
    if (playerNum === 1) {
      g.drawRect(startX, startY, 180 * hpRatio, 12);
    } else {
      // P2 health drains to the right edge (x coordinate expands rightwards)
      const filledW = 180 * hpRatio;
      g.drawRect(startX + (180 - filledW), startY, filledW, 12);
    }
    g.endFill();

    // Border
    g.lineStyle(1.5, 0xffffff, 0.4);
    g.drawRect(startX, startY, 180, 12);
    g.lineStyle(0); // reset

    // 2. Stamina Bar (Yellow)
    if (stamina) {
      const stamRatio = Math.max(0, Math.min(1, stamina.current / stamina.max));
      const stamX = playerNum === 1 ? startX : startX + 80;
      g.beginFill(0x1e293b);
      g.drawRect(stamX, startY + 16, 100, 5);
      g.endFill();

      g.beginFill(0xf59e0b); // Amber
      g.drawRect(stamX, startY + 16, 100 * stamRatio, 5);
      g.endFill();
    }

    // 3. Mana Bar (Blue)
    if (mana) {
      const manaRatio = Math.max(0, Math.min(1, mana.current / mana.max));
      const manaX = playerNum === 1 ? startX : startX + 80;
      g.beginFill(0x1e293b);
      g.drawRect(manaX, startY + 24, 100, 5);
      g.endFill();

      g.beginFill(0x06b6d4); // Cyan
      g.drawRect(manaX, startY + 24, 100 * manaRatio, 5);
      g.endFill();
    }

    // 4. Ultimate Meter Circle (Purple)
    if (ult) {
      const ultRatio = Math.max(0, Math.min(1, ult.current / 100));
      const ultX = playerNum === 1 ? startX + 205 : startX - 25;
      const ultY = startY + 16;
      
      // Draw background ring
      g.lineStyle(4, 0x1e293b);
      g.drawCircle(ultX, ultY, 14);

      // Draw ultimate charge arc
      const readyColor = ult.isReady ? 0xa855f7 : 0x7c3aed; // bright purple vs dark violet
      if (ult.isReady) {
        g.lineStyle(4, readyColor);
        g.drawCircle(ultX, ultY, 14);
        // Draw glow effect for ready
        g.lineStyle(1.5, 0xffffff, 0.6 + Math.sin(performance.now() * 0.01) * 0.3);
        g.drawCircle(ultX, ultY, 16);
      } else if (ultRatio > 0) {
        g.lineStyle(4, readyColor);
        // Matter arc formula
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * ultRatio);
        g.arc(ultX, ultY, 14, startAngle, endAngle);
      }
      g.lineStyle(0); // reset
    }

    // 5. Combo Texts
    const comboText = playerNum === 1 ? this.p1ComboText : this.p2ComboText;
    if (combo && combo.chainIndex > 1) {
      comboText.text = `${combo.chainIndex} HITS!`;
      comboText.visible = true;
    } else {
      comboText.visible = false;
    }
  }

  destroy() {
    if (this.pixiApp && typeof window !== 'undefined') {
      this.pixiApp.layers.uiLayer.removeChild(this.container);
    }
  }
}
