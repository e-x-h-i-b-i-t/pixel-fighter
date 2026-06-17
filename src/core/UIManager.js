import { audioEngine } from './AudioEngine.js';
import { saveManager } from './SaveManager.js';

export class UIManager {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.initElements();
    this.bindEvents();
    this.loadSettings();
  }

  initElements() {
    this.mainMenu = document.getElementById('main-menu');
    this.selectionScreen = document.getElementById('selection-screen');
    this.pauseScreen = document.getElementById('pause-screen');
    this.resultsScreen = document.getElementById('results-screen');
    this.settingsScreen = document.getElementById('settings-screen');
    this.achievementsScreen = document.getElementById('achievements-screen');
    
    this.btnPlay = document.getElementById('btn-play');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnAchievements = document.getElementById('btn-achievements');
    this.btnFight = document.getElementById('btn-fight');
    this.btnSelectBack = document.getElementById('btn-select-back');
    this.btnResume = document.getElementById('btn-resume');
    this.btnPauseQuit = document.getElementById('btn-pause-quit');
    this.btnRematch = document.getElementById('btn-rematch');
    this.btnResultsCharacter = document.getElementById('btn-results-character');
    this.btnResultsMenu = document.getElementById('btn-results-menu');

    this.p1Class = document.getElementById('p1-class');
    this.p1Sword = document.getElementById('p1-sword');
    this.p2Class = document.getElementById('p2-class');
    this.p2Sword = document.getElementById('p2-sword');
    this.aiDifficulty = document.getElementById('ai-difficulty');
    this.arenaSelect = document.getElementById('arena-select');

    this.resultsTitle = document.getElementById('results-title');
    this.resultsStats = document.getElementById('results-stats');
    
    this.btnSettingsBack = document.getElementById('btn-settings-back');
    this.btnAchievementsBack = document.getElementById('btn-achievements-back');
    this.btnResetSave = document.getElementById('btn-reset-save');
    this.musicVolume = document.getElementById('music-volume');
    this.sfxVolume = document.getElementById('sfx-volume');
    this.achievementsList = document.getElementById('achievements-list');
  }

  bindEvents() {
    // Main Menu
    if (this.btnPlay) {
      this.btnPlay.addEventListener('click', () => {
        this.hideAll();
        this.selectionScreen.classList.remove('hidden');
      });
    }

    if (this.btnSettings) {
      this.btnSettings.addEventListener('click', () => {
        this.hideAll();
        if (this.settingsScreen) {
          this.settingsScreen.classList.remove('hidden');
        }
        this.loadSettings();
        if (this.callbacks.onOpenSettings) {
          this.callbacks.onOpenSettings();
        }
      });
    }
    
    if (this.btnAchievements) {
      this.btnAchievements.addEventListener('click', () => {
        this.hideAll();
        if (this.achievementsScreen) {
          this.achievementsScreen.classList.remove('hidden');
        }
        this.loadAchievements();
        if (this.callbacks.onOpenAchievements) {
          this.callbacks.onOpenAchievements();
        }
      });
    }

    if (this.btnSettingsBack) {
      this.btnSettingsBack.addEventListener('click', () => {
        this.hideAll();
        if (this.mainMenu) {
          this.mainMenu.classList.remove('hidden');
        }
      });
    }

    if (this.btnAchievementsBack) {
      this.btnAchievementsBack.addEventListener('click', () => {
        this.hideAll();
        if (this.mainMenu) {
          this.mainMenu.classList.remove('hidden');
        }
      });
    }

    if (this.musicVolume) {
      this.musicVolume.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audioEngine.setMusicVolume(val);
        saveManager.saveSettings({ musicVolume: val });
      });
    }

    if (this.sfxVolume) {
      this.sfxVolume.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audioEngine.setSFXVolume(val);
        saveManager.saveSettings({ sfxVolume: val });
      });
    }

    if (this.btnResetSave) {
      this.btnResetSave.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all save data (achievements and settings)?')) {
          saveManager.resetSave();
          this.loadSettings();
          alert('Save data reset successfully.');
        }
      });
    }

    // Character Select Screen
    if (this.btnSelectBack) {
      this.btnSelectBack.addEventListener('click', () => {
        this.hideAll();
        this.mainMenu.classList.remove('hidden');
      });
    }

    if (this.btnFight) {
      this.btnFight.addEventListener('click', () => {
        const p1Opts = {
          class: this.p1Class.value,
          sword: this.p1Sword.value
        };
        const p2Opts = {
          class: this.p2Class.value,
          sword: this.p2Sword.value,
          difficulty: this.aiDifficulty.value
        };
        const arena = this.arenaSelect.value;
        
        this.hideAll();
        if (this.callbacks.onStartFight) {
          this.callbacks.onStartFight(p1Opts, p2Opts, arena);
        }
      });
    }

    // Pause Screen
    if (this.btnResume && this.callbacks.onResumeGame) {
      this.btnResume.addEventListener('click', this.callbacks.onResumeGame);
    }

    if (this.btnPauseQuit) {
      this.btnPauseQuit.addEventListener('click', () => {
        this.hideAll();
        this.mainMenu.classList.remove('hidden');
        if (this.callbacks.onQuitGame) {
          this.callbacks.onQuitGame();
        }
      });
    }

    // Results Screen
    if (this.btnRematch) {
      this.btnRematch.addEventListener('click', () => {
        const p1Opts = {
          class: this.p1Class.value,
          sword: this.p1Sword.value
        };
        const p2Opts = {
          class: this.p2Class.value,
          sword: this.p2Sword.value,
          difficulty: this.aiDifficulty.value
        };
        const arena = this.arenaSelect.value;
        
        this.hideAll();
        if (this.callbacks.onStartFight) {
          this.callbacks.onStartFight(p1Opts, p2Opts, arena);
        }
      });
    }

    if (this.btnResultsCharacter) {
      this.btnResultsCharacter.addEventListener('click', () => {
        this.hideAll();
        this.selectionScreen.classList.remove('hidden');
      });
    }

    if (this.btnResultsMenu) {
      this.btnResultsMenu.addEventListener('click', () => {
        this.hideAll();
        this.mainMenu.classList.remove('hidden');
        if (this.callbacks.onQuitGame) {
          this.callbacks.onQuitGame();
        }
      });
    }
  }

  hideAll() {
    if (this.mainMenu) this.mainMenu.classList.add('hidden');
    if (this.selectionScreen) this.selectionScreen.classList.add('hidden');
    if (this.pauseScreen) this.pauseScreen.classList.add('hidden');
    if (this.resultsScreen) this.resultsScreen.classList.add('hidden');
    if (this.settingsScreen) this.settingsScreen.classList.add('hidden');
    if (this.achievementsScreen) this.achievementsScreen.classList.add('hidden');
  }

  loadSettings() {
    const settings = saveManager.getSettings();
    if (this.musicVolume) {
      this.musicVolume.value = settings.musicVolume;
      audioEngine.setMusicVolume(settings.musicVolume);
    }
    if (this.sfxVolume) {
      this.sfxVolume.value = settings.sfxVolume;
      audioEngine.setSFXVolume(settings.sfxVolume);
    }
  }

  loadAchievements() {
    if (!this.achievementsList) return;
    const achievements = saveManager.getAchievements();
    this.achievementsList.innerHTML = '';
    
    Object.keys(achievements).forEach(id => {
      const ach = achievements[id];
      const item = document.createElement('div');
      item.className = `stat-row ${ach.unlocked ? 'achievement-unlocked' : 'achievement-locked'}`;
      item.style.padding = '10px';
      item.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.alignItems = 'flex-start';
      item.style.textAlign = 'left';
      
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.width = '100%';
      header.style.fontWeight = 'bold';
      
      const title = document.createElement('span');
      title.textContent = ach.name;
      title.style.color = ach.unlocked ? '#f59e0b' : '#6b7280'; // golden vs gray
      
      const status = document.createElement('span');
      status.textContent = ach.unlocked ? 'UNLOCKED' : 'LOCKED';
      status.style.fontSize = '0.8em';
      status.style.color = ach.unlocked ? '#10b981' : '#6b7280';
      
      header.appendChild(title);
      header.appendChild(status);
      
      const desc = document.createElement('span');
      desc.textContent = ach.desc || ach.description;
      desc.style.fontSize = '0.9em';
      desc.style.color = '#9ca3af';
      desc.style.marginTop = '4px';
      
      item.appendChild(header);
      item.appendChild(desc);
      this.achievementsList.appendChild(item);
    });
  }

  showPause() {
    this.pauseScreen.classList.remove('hidden');
  }

  hidePause() {
    this.pauseScreen.classList.add('hidden');
  }

  showResults(winner, stats = {}) {
    this.hideAll();
    this.resultsScreen.classList.remove('hidden');

    if (winner === 'player') {
      this.resultsTitle.textContent = 'VICTORY';
      this.resultsTitle.className = 'menu-title victory-title';
    } else {
      this.resultsTitle.textContent = 'DEFEAT';
      this.resultsTitle.className = 'menu-title defeat-title';
    }

    const durationSec = ((stats.durationMs || 0) / 1000).toFixed(1);
    
    this.resultsStats.innerHTML = `
      <div class="stat-row">
        <span>MATCH DURATION:</span>
        <span>${durationSec}s</span>
      </div>
      <div class="stat-row">
        <span>HITS LANDED:</span>
        <span>${stats.hitsLanded || 0}</span>
      </div>
      <div class="stat-row">
        <span>MAX COMBO:</span>
        <span>${stats.maxCombo || 0} HITS</span>
      </div>
      <div class="stat-row">
        <span>DAMAGE DEALT:</span>
        <span>${stats.damageDealt || 0}</span>
      </div>
      <div class="stat-row">
        <span>ULTIMATES CAST:</span>
        <span>${stats.ultimatesCast || 0}</span>
      </div>
    `;
  }
}
