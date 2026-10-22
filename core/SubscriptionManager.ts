import { SubscriptionSettings } from '../src/types';
import { AppDatabase } from '../storage/database';

export class SubscriptionManager {
  private defaultSettings: SubscriptionSettings = {
    reserveOpenAI: true,
    openAIBudget: 100, // Normalized unit/quota limit
    openAIUsed: 0,
    allowUltra: true,
    maxAttempts: 3,
    timeoutSeconds: 300,
    codexPath: 'codex',
    antigravityPath: 'agy',
    claudePath: 'claude',
    opencodePath: 'opencode',
    routingMode: 'auto',
    manualModel: 'gpt-6.1-sol',
  };

  constructor(private db: AppDatabase) {}

  public getSettings(): SubscriptionSettings {
    return this.db.getSetting<SubscriptionSettings>('subscription_settings', this.defaultSettings);
  }

  public updateSettings(partial: Partial<SubscriptionSettings>): SubscriptionSettings {
    const current = this.getSettings();
    const updated: SubscriptionSettings = {
      ...current,
      ...partial,
    };
    this.db.setSetting('subscription_settings', updated);
    return updated;
  }

  public getModelGroup(model: string): 'google' | 'openai' | 'anthropic' | 'opencode' {
    const lower = model.toLowerCase();
    if (lower.includes('claude')) {
      return 'anthropic';
    }
    if (lower.includes('opencode') || lower.includes('qwen') || lower.includes('deepseek') || lower.includes('llama')) {
      return 'opencode';
    }
    if (lower.includes('gemini') || lower.includes('antigravity') || lower.includes('agy')) {
      return 'google';
    }
    return 'openai';
  }

  public recordUsage(model: string, costMultiplier: number = 1): void {
    const group = this.getModelGroup(model);
    if (group === 'openai') {
      const current = this.getSettings();
      let delta = costMultiplier;
      if (model.includes('Ultra')) delta *= 3;
      else if (model.includes('Sol High') || model.includes('Astra')) delta *= 2;
      else if (model.includes('Luna')) delta *= 0.5;

      this.updateSettings({
        openAIUsed: current.openAIUsed + delta,
      });
    }
  }

  public hasBudgetFor(model: string): boolean {
    const group = this.getModelGroup(model);
    if (group === 'google') return true;

    const settings = this.getSettings();
    if (settings.openAIBudget <= 0) return true; // unlimited/untracked
    return settings.openAIUsed < settings.openAIBudget;
  }

  public isUltraAllowed(): boolean {
    const settings = this.getSettings();
    return settings.allowUltra && this.hasBudgetFor('GPT-6.1 Sol Ultra');
  }
}
