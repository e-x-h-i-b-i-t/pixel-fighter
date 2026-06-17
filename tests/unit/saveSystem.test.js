import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveManager } from '../../src/core/SaveManager.js';

describe('SaveManager and Achievements', () => {
  beforeEach(() => {
    saveManager.resetSave();
  });

  it('should initialize with default volume settings and achievements locked', () => {
    const settings = saveManager.getSettings();
    expect(settings.musicVolume).toBe(0.25);
    expect(settings.sfxVolume).toBe(0.45);

    const achievements = saveManager.getAchievements();
    expect(achievements.firstBlood.unlocked).toBe(false);
    expect(achievements.comboMaster.unlocked).toBe(false);
  });

  it('should unlock achievements and trigger popups', () => {
    const spy = vi.spyOn(saveManager, 'triggerAchievementPopup').mockImplementation(() => {});

    const unlocked = saveManager.unlockAchievement('firstBlood');
    expect(unlocked).toBe(true);
    expect(saveManager.getAchievements().firstBlood.unlocked).toBe(true);
    expect(spy).toHaveBeenCalled();

    // Re-unlocking should not trigger popup again or return true
    const reUnlocked = saveManager.unlockAchievement('firstBlood');
    expect(reUnlocked).toBe(false);

    spy.mockRestore();
  });

  it('should save and load settings', () => {
    saveManager.saveSettings({ musicVolume: 0.8 });
    expect(saveManager.getSettings().musicVolume).toBe(0.8);
    expect(saveManager.getSettings().sfxVolume).toBe(0.45); // unchanged
  });
});
