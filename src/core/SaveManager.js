const STORAGE_KEY = 'pixel_sword_fighter_save';

const DefaultSaveData = {
  settings: {
    musicVolume: 0.25,
    sfxVolume: 0.45
  },
  achievements: {
    firstBlood: { unlocked: false, name: 'First Blood', desc: 'Land your first hit on an opponent' },
    comboMaster: { unlocked: false, name: 'Combo Master', desc: 'Reach a 5x combo chain' },
    comboLegend: { unlocked: false, name: 'Combo Legend', desc: 'Reach a 10x combo chain' },
    flawless: { unlocked: false, name: 'Flawless Victory', desc: 'Win a match with full health' },
    giantSlayer: { unlocked: false, name: 'Giant Slayer', desc: 'Defeat a Nightmare AI opponent' },
    elementalStrike: { unlocked: false, name: 'Elemental strike', desc: 'Inflict burn or freeze on an opponent' }
  }
};

class SaveManager {
  constructor() {
    this.data = { ...DefaultSaveData };
    this.load();
  }

  load() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.data = {
          settings: { ...DefaultSaveData.settings, ...parsed.settings },
          achievements: { ...DefaultSaveData.achievements }
        };
        // Merge achievement unlock states
        if (parsed.achievements) {
          for (const key in parsed.achievements) {
            if (this.data.achievements[key]) {
              this.data.achievements[key].unlocked = !!parsed.achievements[key].unlocked;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load save data from localStorage:', e);
    }
  }

  save() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save data to localStorage:', e);
    }
  }

  getSettings() {
    return this.data.settings;
  }

  saveSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
  }

  getAchievements() {
    return this.data.achievements;
  }

  unlockAchievement(id) {
    if (this.data.achievements[id] && !this.data.achievements[id].unlocked) {
      this.data.achievements[id].unlocked = true;
      this.save();
      
      // Trigger a beautiful visual alert/pop-up in the game UI
      this.triggerAchievementPopup(this.data.achievements[id]);
      return true;
    }
    return false;
  }

  triggerAchievementPopup(achievement) {
    if (typeof document === 'undefined') return;
    
    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'achievement-toast';
    popup.innerHTML = `
      <div class="toast-title">ACHIEVEMENT UNLOCKED!</div>
      <div class="toast-name">${achievement.name}</div>
      <div class="toast-desc">${achievement.desc}</div>
    `;

    // Append to app container or body
    const container = document.getElementById('app-container') || document.body;
    container.appendChild(popup);

    // Fade in and out
    setTimeout(() => {
      popup.classList.add('show');
    }, 100);

    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => {
        popup.remove();
      }, 500);
    }, 3500);
  }

  resetSave() {
    this.data = {
      settings: { ...DefaultSaveData.settings },
      achievements: {}
    };
    for (const key in DefaultSaveData.achievements) {
      this.data.achievements[key] = { ...DefaultSaveData.achievements[key], unlocked: false };
    }
    this.save();
  }
}

export const saveManager = new SaveManager();
