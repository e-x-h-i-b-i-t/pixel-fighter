import { ComponentTypes } from '../../ecs/componentTypes.js';

export const ActionMap = {
  // Movement
  'ArrowLeft': 'left',
  'a': 'left',
  'ArrowRight': 'right',
  'd': 'right',
  'ArrowUp': 'jump',
  'w': 'jump',
  ' ': 'jump',
  'ArrowDown': 'down',
  's': 'down',
  
  // Combat/Actions
  'j': 'lightAttack',
  'z': 'lightAttack',
  'k': 'heavyAttack',
  'x': 'heavyAttack',
  'l': 'parry',
  'c': 'parry',
  'Shift': 'dash',
  'f': 'dash',
  'e': 'roll',
  'q': 'ultimate'
};

// Input buffer expiration in milliseconds
const BUFFER_EXPIRATION_MS = 500;

export class InputSystem {
  constructor() {
    this.heldKeys = {};
    this.keyPresses = []; // queue of raw key events to process next tick
    
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    
    this.bindEvents();
  }

  bindEvents() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    }
  }

  unbindEvents() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
    }
  }

  handleKeyDown(event) {
    // Prevent default browser behavior for gaming keys (arrows, space)
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
      event.preventDefault();
    }
    
    // Only track repeat presses as one hold
    if (!event.repeat) {
      this.heldKeys[event.key] = true;
      this.keyPresses.push({ key: event.key, timestamp: Date.now() });
    }
  }

  handleKeyUp(event) {
    this.heldKeys[event.key] = false;
  }

  /**
   * Updates the InputController components on all player entities.
   * @param {World} world 
   * @param {number} dtMs 
   */
  update(world, dtMs) {
    const playerEntities = world.query([ComponentTypes.INPUT_CONTROLLER]);
    const now = Date.now();

    for (const entityId of playerEntities) {
      const input = world.getComponent(entityId, ComponentTypes.INPUT_CONTROLLER);
      if (!input) continue;

      // Update currently held keys state
      input.heldKeys = { ...this.heldKeys };

      // Process new presses into buffered inputs
      for (const press of this.keyPresses) {
        const action = ActionMap[press.key];
        if (action) {
          input.bufferedInputs.push({
            action,
            timestamp: press.timestamp,
            consumed: false
          });
        }
      }

      // Clear buffer of old/expired inputs
      input.bufferedInputs = input.bufferedInputs.filter(item => {
        return !item.consumed && (now - item.timestamp) < BUFFER_EXPIRATION_MS;
      });
    }

    // Clear key presses after copying to all active controllers
    this.keyPresses = [];
  }
}
