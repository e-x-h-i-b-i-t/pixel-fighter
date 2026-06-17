export const ComponentTypes = {
  TRANSFORM: 'Transform',
  VELOCITY: 'Velocity',
  PHYSICS_BODY: 'PhysicsBody',
  HEALTH: 'Health',
  STAMINA: 'Stamina',
  MANA: 'Mana',
  ULTIMATE_METER: 'UltimateMeter',
  INPUT_CONTROLLER: 'InputController',
  AI_CONTROLLER: 'AIController',
  ANIMATION_STATE: 'AnimationState',
  HURTBOX: 'Hurtbox',
  HITBOX_SHAPE: 'HitboxShape',
  DAMAGE_PACKET: 'DamagePacket',
  COMBO_STATE: 'ComboState',
  SWORD_LOADOUT: 'SwordLoadout',
  STATUS_EFFECTS: 'StatusEffects',
  SPRITE_REF: 'SpriteRef',
  OWNER_REF: 'OwnerRef',
  LIFETIME: 'Lifetime',
  RENDER_LAYER_REF: 'RenderLayerRef'
};

export const ComponentFactories = {
  [ComponentTypes.TRANSFORM]: (data = {}) => ({
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    facing: 1, // 1 = right, -1 = left
    doubleJumpsLeft: 1,
    isAirborne: false,
    isDashing: false,
    isRolling: false,
    dashTicks: 0,
    rollTicks: 0,
    ...data
  }),
  [ComponentTypes.VELOCITY]: (data = {}) => ({
    vx: 0,
    vy: 0,
    ...data
  }),
  [ComponentTypes.PHYSICS_BODY]: (data = {}) => ({
    matterBodyId: null,
    bodyType: 'kinematic', // 'kinematic' | 'dynamic' | 'static'
    collisionGroup: null,
    ...data
  }),
  [ComponentTypes.HEALTH]: (data = {}) => ({
    current: 100,
    max: 100,
    isInvulnerable: false,
    lastHitTimestamp: 0,
    ...data
  }),
  [ComponentTypes.STAMINA]: (data = {}) => ({
    current: 100,
    max: 100,
    regenRate: 0.2, // per tick
    regenDelayTimer: 0,
    ...data
  }),
  [ComponentTypes.MANA]: (data = {}) => ({
    current: 100,
    max: 100,
    regenRate: 0.05, // per tick
    ...data
  }),
  [ComponentTypes.ULTIMATE_METER]: (data = {}) => ({
    current: 0,
    isReady: false,
    ...data
  }),
  [ComponentTypes.INPUT_CONTROLLER]: (data = {}) => ({
    bufferedInputs: [], // queue of recent inputs
    heldKeys: {},       // map of currently held keys
    ...data
  }),
  [ComponentTypes.AI_CONTROLLER]: (data = {}) => ({
    difficulty: 'medium', // 'easy' | 'medium' | 'hard' | 'nightmare'
    behaviorTreeState: {},
    reactionTimer: 0,
    targetEntityId: null,
    ...data
  }),
  [ComponentTypes.ANIMATION_STATE]: (data = {}) => ({
    currentClip: 'idle',
    frameIndex: 0,
    frameTimer: 0,
    queuedClip: null,
    ...data
  }),
  [ComponentTypes.HURTBOX]: (data = {}) => ({
    shape: 'box', // 'box' | 'circle' | 'capsule'
    offset: { x: 0, y: 0 },
    size: { width: 40, height: 56 },
    vulnerableFlags: { physical: true, elemental: true },
    ...data
  }),
  [ComponentTypes.HITBOX_SHAPE]: (data = {}) => ({
    shape: 'box',
    offset: { x: 0, y: 0 },
    size: { width: 30, height: 30 },
    activeFrameRange: [0, 0], // startFrame, endFrame
    ...data
  }),
  [ComponentTypes.DAMAGE_PACKET]: (data = {}) => ({
    baseDamage: 10,
    damageType: 'physical', // 'physical' | 'elemental' | 'hybrid'
    element: 'neutral',     // 'neutral' | 'fire' | 'ice' | 'lightning' | 'shadow' | 'dragon'
    knockbackVector: { x: 0, y: 0 },
    hitstunFrames: 15,
    canCrit: true,
    statusOnHit: null,
    ...data
  }),
  [ComponentTypes.COMBO_STATE]: (data = {}) => ({
    chainIndex: 0,
    comboTimer: 0,
    lastMoveId: null,
    comboDamageScalar: 1.0,
    ...data
  }),
  [ComponentTypes.SWORD_LOADOUT]: (data = {}) => ({
    swordId: 'steelVanguard',
    statModifiers: {},
    elementId: 'neutral',
    specialMoveId: 'guardSurge',
    ultimateMoveId: 'vanguardJudgment',
    ...data
  }),
  [ComponentTypes.STATUS_EFFECTS]: (data = {}) => ({
    active: [], // array of { type, duration, value, timer }
    ...data
  }),
  [ComponentTypes.SPRITE_REF]: (data = {}) => ({
    pixiSpriteId: null,
    sprite: null, // actual reference to PIXI object
    ...data
  }),
  [ComponentTypes.OWNER_REF]: (data = {}) => ({
    entityId: null,
    ...data
  }),
  [ComponentTypes.LIFETIME]: (data = {}) => ({
    remainingFrames: 0,
    onExpire: null, // callback on despawn
    ...data
  }),
  [ComponentTypes.RENDER_LAYER_REF]: (data = {}) => ({
    layerName: 'entityLayer', // 'arenaLayer' | 'gameplayLayer' | 'vfxLayer' | etc.
    ...data
  })
};
