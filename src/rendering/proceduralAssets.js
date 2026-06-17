import * as PIXI from 'pixi.js';

/**
 * Creates a procedural pixel-art texture for a character frame.
 * @param {string} charClass - 'knight' | 'samurai' | 'assassin' | 'mage'
 * @param {string} anim - 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'attack' | 'hit' | 'dead'
 * @param {number} frame - Frame index (0 to 3)
 * @returns {PIXI.Texture}
 */
export function generateProceduralTexture(charClass, anim, frame) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  
  // Disable image smoothing for crisp retro look
  ctx.imageSmoothingEnabled = false;

  // Colors based on class
  let armorColor = '#475569';  // slate blue
  let trimColor = '#fbbf24';   // gold
  let capeColor = '#dc2626';   // red cape
  let skinColor = '#fed7aa';   // peach
  let eyeColor = '#0f172a';    // dark

  if (charClass === 'samurai') {
    armorColor = '#991b1b';    // red lacquer
    trimColor = '#1e293b';     // dark steel
    capeColor = '#f59e0b';     // amber sash
    eyeColor = '#fff';         // white eye slits
  } else if (charClass === 'assassin') {
    armorColor = '#1e1b4b';    // deep indigo
    trimColor = '#10b981';     // poison green glow
    capeColor = '#311042';     // dark violet cloak
    eyeColor = '#10b981';      // green glow
  } else if (charClass === 'mage') {
    armorColor = '#0891b2';    // cyan robes
    trimColor = '#fb7185';     // rose trims
    capeColor = '#7c3aed';     // purple cowl
    eyeColor = '#22d3ee';      // cyan fire
  }

  // Handle flash/hitstun
  let isHitFlash = (anim === 'hit');
  let isDead = (anim === 'dead');

  // --- DRAWING PROCEDURAL PIXEL ART ---
  ctx.clearRect(0, 0, 32, 48);

  if (isHitFlash) {
    // Fill shape with solid bright red/white flash
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(8, 8, 16, 36);
    return PIXI.Texture.from(canvas);
  }

  if (isDead) {
    // Flattened / rotated on floor
    ctx.fillStyle = armorColor;
    ctx.fillRect(4, 40, 24, 8); // flat body
    ctx.fillStyle = capeColor;
    ctx.fillRect(6, 42, 16, 4); // cape flat
    ctx.fillStyle = trimColor;
    ctx.fillRect(20, 38, 4, 4); // helmet piece
    return PIXI.Texture.from(canvas);
  }

  // --- STANDARD POSITIONS ---
  let breathY = 0;
  if (anim === 'idle') {
    // Breathing cycle: bob up and down
    breathY = (frame % 2 === 0) ? 0 : 1;
  }

  let legOffset = 0;
  if (anim === 'walk' || anim === 'run') {
    // Walking leg cycle
    legOffset = (frame % 2 === 0) ? -1 : 1;
  }

  // 1. Cape (backmost layer)
  ctx.fillStyle = capeColor;
  if (anim === 'run') {
    // Cape flying back
    ctx.fillRect(2, 18 + breathY, 8, 20);
  } else {
    // Draped cape
    ctx.fillRect(6, 18 + breathY, 6, 22);
  }

  // 2. Legs & Feet
  ctx.fillStyle = '#1e293b'; // boots
  if (anim === 'jump') {
    // Tucked legs
    ctx.fillRect(8, 38, 4, 4);
    ctx.fillRect(20, 38, 4, 4);
  } else if (anim === 'fall') {
    // Extended legs
    ctx.fillRect(9, 40, 4, 6);
    ctx.fillRect(19, 40, 4, 6);
  } else {
    // Standard walk cycle legs
    ctx.fillRect(9 + legOffset, 38, 4, 10);
    ctx.fillRect(19 - legOffset, 38, 4, 10);
  }

  // 3. Body / Armor Chestplate
  ctx.fillStyle = armorColor;
  ctx.fillRect(8, 16 + breathY, 16, 22); // main chestplate
  ctx.fillStyle = trimColor;
  ctx.fillRect(14, 20 + breathY, 4, 14);  // crest/trim stripe
  ctx.fillRect(8, 16 + breathY, 16, 2);   // shoulder plate trims

  // 4. Helmet
  ctx.fillStyle = armorColor;
  ctx.fillRect(10, 6 + breathY, 12, 10); // helmet base
  ctx.fillStyle = trimColor;
  ctx.fillRect(14, 4 + breathY, 4, 3);    // plume/spike
  ctx.fillStyle = eyeColor;
  ctx.fillRect(17, 9 + breathY, 4, 2);    // visor slot / eyes

  // 5. Arms & Weapon (in front)
  ctx.fillStyle = armorColor;
  if (anim === 'attack') {
    // Swinging arm forward
    ctx.fillRect(22, 18 + breathY, 6, 6); // arm forward
    ctx.fillStyle = '#cbd5e1'; // steel sword
    ctx.fillRect(26, 8 + breathY, 4, 20);  // swing blade
    ctx.fillStyle = '#b45309'; // hilt
    ctx.fillRect(24, 24 + breathY, 6, 2);
  } else {
    // Resting arm at side
    ctx.fillRect(22, 18 + breathY, 4, 12);
    ctx.fillStyle = '#cbd5e1'; // weapon hilt peaking out
    ctx.fillRect(21, 26 + breathY, 2, 8);
  }

  return PIXI.Texture.from(canvas);
}

/**
 * Procedural asset catalog generator.
 * @param {string} charClass 
 * @returns {Object} map of animation name to array of PIXI.Texture
 */
export function getCharacterAnimations(charClass) {
  const animations = {
    idle: [],
    walk: [],
    run: [],
    jump: [],
    fall: [],
    attack: [],
    hit: [],
    dead: []
  };

  // Generate 4 frames per animation
  for (let f = 0; f < 4; f++) {
    animations.idle.push(generateProceduralTexture(charClass, 'idle', f));
    animations.walk.push(generateProceduralTexture(charClass, 'walk', f));
    animations.run.push(generateProceduralTexture(charClass, 'run', f));
    animations.jump.push(generateProceduralTexture(charClass, 'jump', f));
    animations.fall.push(generateProceduralTexture(charClass, 'fall', f));
    animations.attack.push(generateProceduralTexture(charClass, 'attack', f));
    animations.hit.push(generateProceduralTexture(charClass, 'hit', f));
    animations.dead.push(generateProceduralTexture(charClass, 'dead', f));
  }

  return animations;
}

/**
 * Generates a background gradient texture for the selected arena.
 * @param {string} arenaId 
 * @param {number} width 
 * @param {number} height 
 * @returns {PIXI.Texture}
 */
export function generateParallaxBackground(arenaId, width = 640, height = 360) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, height);

  if (arenaId === 'frozenMountain') {
    grad.addColorStop(0, '#1e1b4b'); // deep indigo sky
    grad.addColorStop(1, '#312e81'); // blue twilight
  } else if (arenaId === 'volcano') {
    grad.addColorStop(0, '#450a0a'); // blood red ash sky
    grad.addColorStop(0.7, '#7f1d1d');
    grad.addColorStop(1, '#f97316'); // glowing orange horizon
  } else if (arenaId === 'darkCastle') {
    grad.addColorStop(0, '#020617'); // obsidian sky
    grad.addColorStop(0.8, '#0f172a');
    grad.addColorStop(1, '#1e1b4b'); // purple lightning sky
  } else if (arenaId === 'skyKingdom') {
    grad.addColorStop(0, '#0284c7'); // sky blue
    grad.addColorStop(0.7, '#38bdf8');
    grad.addColorStop(1, '#fef08a'); // golden clouds horizon
  } else {
    // forestTemple (default)
    grad.addColorStop(0, '#064e3b'); // emerald sky
    grad.addColorStop(0.7, '#0f766e');
    grad.addColorStop(1, '#2dd4bf'); // teal horizon
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Draw some far-away background elements (like distant mountains or clouds)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  if (arenaId === 'skyKingdom') {
    // Draw cloud puffs
    ctx.beginPath();
    ctx.arc(150, 200, 80, 0, Math.PI * 2);
    ctx.arc(260, 240, 100, 0, Math.PI * 2);
    ctx.arc(380, 210, 70, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Draw mountain peaks
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(120, height - 120);
    ctx.lineTo(280, height);
    ctx.moveTo(180, height);
    ctx.lineTo(360, height - 160);
    ctx.lineTo(540, height);
    ctx.moveTo(420, height);
    ctx.lineTo(580, height - 100);
    ctx.lineTo(640, height);
    ctx.fill();
  }

  return PIXI.Texture.from(canvas);
}

/**
 * Generates a transparent parallax midground texture with themed silhouettes.
 * @param {string} arenaId 
 * @param {number} width 
 * @param {number} height 
 * @returns {PIXI.Texture}
 */
export function generateParallaxMidground(arenaId, width = 640, height = 360) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  if (arenaId === 'frozenMountain') {
    // Pine trees covered in snow
    ctx.fillStyle = '#1e3a8a'; // dark blue tree silhouette
    drawPineTree(ctx, 100, height, 80, 140);
    drawPineTree(ctx, 220, height, 60, 100);
    drawPineTree(ctx, 450, height, 90, 160);
    drawPineTree(ctx, 560, height, 70, 120);
  } else if (arenaId === 'volcano') {
    // Craggy rocks & lava vents
    ctx.fillStyle = '#27272a'; // dark charcoal
    ctx.beginPath();
    ctx.moveTo(80, height);
    ctx.lineTo(140, height - 180);
    ctx.lineTo(200, height);
    ctx.moveTo(400, height);
    ctx.lineTo(470, height - 200);
    ctx.lineTo(550, height);
    ctx.fill();
  } else if (arenaId === 'darkCastle') {
    // Gothic spires
    ctx.fillStyle = '#0f172a'; // dark slate
    ctx.fillRect(80, height - 140, 40, 140);
    ctx.beginPath();
    ctx.moveTo(80, height - 140);
    ctx.lineTo(100, height - 210);
    ctx.lineTo(120, height - 140);
    ctx.fill();

    ctx.fillRect(480, height - 170, 50, 170);
    ctx.beginPath();
    ctx.moveTo(480, height - 170);
    ctx.lineTo(505, height - 250);
    ctx.lineTo(530, height - 170);
    ctx.fill();
  } else if (arenaId === 'skyKingdom') {
    // Floating sky islands
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.ellipse(200, 120, 70, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(480, 150, 90, 25, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // forestTemple (default): ancient stone arches & ivy
    ctx.fillStyle = '#065f46'; // forest green shade
    
    // Draw pillars
    ctx.fillRect(60, 0, 30, height);
    ctx.fillRect(520, 0, 30, height);
    
    // Arch
    ctx.beginPath();
    ctx.arc(290, 80, 100, Math.PI, 0, false);
    ctx.lineWidth = 25;
    ctx.strokeStyle = '#065f46';
    ctx.stroke();
  }

  return PIXI.Texture.from(canvas);
}

function drawPineTree(ctx, x, y, width, height) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - width/2, y - height/3);
  ctx.lineTo(x - width/4, y - height/3);
  ctx.lineTo(x - width/3, y - 2*height/3);
  ctx.lineTo(x - width/6, y - 2*height/3);
  ctx.lineTo(x, y - height);
  ctx.lineTo(x + width/6, y - 2*height/3);
  ctx.lineTo(x + width/3, y - 2*height/3);
  ctx.lineTo(x + width/4, y - height/3);
  ctx.lineTo(x + width/2, y - height/3);
  ctx.closePath();
  ctx.fill();
}

/**
 * Generates a tileable stone platform texture.
 * @param {string} arenaId 
 * @param {number} width 
 * @param {number} height 
 * @returns {PIXI.Texture}
 */
export function generatePlatformTexture(arenaId, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  let brickColor = '#4b5563'; // gray brick
  let topColor = '#10b981';   // grass green
  
  if (arenaId === 'frozenMountain') {
    brickColor = '#38bdf8'; // icy blue
    topColor = '#f8fafc';   // snow white
  } else if (arenaId === 'volcano') {
    brickColor = '#18181b'; // obsidian black
    topColor = '#ef4444';   // glowing magma red
  } else if (arenaId === 'darkCastle') {
    brickColor = '#312e81'; // dark gothic blue
    topColor = '#4f46e5';   // royal purple trim
  } else if (arenaId === 'skyKingdom') {
    brickColor = '#f1f5f9'; // white marble
    topColor = '#fbbf24';   // gold trim
  }

  // Draw main block fill
  ctx.fillStyle = brickColor;
  ctx.fillRect(0, 0, width, height);

  // Draw brick cracks/lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 2;
  
  // horizontal brick lines
  for (let y = 10; y < height; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw top grass layer
  ctx.fillStyle = topColor;
  ctx.fillRect(0, 0, width, 8);

  return PIXI.Texture.from(canvas);
}
