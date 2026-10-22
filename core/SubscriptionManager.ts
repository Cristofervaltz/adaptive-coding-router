import { SubscriptionSettings, ProviderQuota, ProviderStatus } from '../src/types';
import { AppDatabase } from '../storage/database';

export class SubscriptionManager {
  private defaultSettings: SubscriptionSettings = {
    reserveOpenAI: true,
    openAIBudget: 100, // Normalized compute quota limit
    openAIUsed: 0,
    openAIPlan: 'tier_500', // Default: $500 Max Tier without 5-hour rolling limits
    claudePlan: 'claude_team_5_5',
    antigravityCreditsBudget: 100,
    antigravityCreditsUsed: 0,
    claudeGeneralUsed: 0,
    claudeFableUsed: 0,
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
    if (lower.includes('claude') || lower.includes('fable')) {
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
    const current = this.getSettings();
    const lower = model.toLowerCase();

    if (lower.includes('fable')) {
      this.updateSettings({
        claudeFableUsed: (current.claudeFableUsed || 0) + 1,
      });
    } else if (lower.includes('claude')) {
      this.updateSettings({
        claudeGeneralUsed: (current.claudeGeneralUsed || 0) + costMultiplier,
      });
    } else if (lower.includes('gemini') || lower.includes('antigravity') || lower.includes('agy')) {
      this.updateSettings({
        antigravityCreditsUsed: (current.antigravityCreditsUsed || 0) + costMultiplier,
      });
    } else if (lower.includes('opencode') || lower.includes('qwen') || lower.includes('deepseek') || lower.includes('llama')) {
      // Free / local execution
    } else {
      // OpenAI Codex models
      let delta = costMultiplier;
      if (model.includes('Ultra')) delta *= 3;
      else if (model.includes('Sol High') || model.includes('Astra')) delta *= 2;
      else if (model.includes('Luna')) delta *= 0.5;

      this.updateSettings({
        openAIUsed: (current.openAIUsed || 0) + delta,
      });
    }
  }

  public getProviderQuotas(statuses: ProviderStatus[]): ProviderQuota[] {
    const s = this.getSettings();
    const isOnline = (id: string) => statuses.find((st) => st.id === id)?.installed ?? false;

    // 1. OpenAI Codex
    const isOpenAI500 = s.openAIPlan === 'tier_500';
    const isOpenAI200 = s.openAIPlan === 'pro_200';
    const openAiPools = [
      {
        id: 'openai_5h',
        name: isOpenAI500 ? '5-Hour Rate Limit (Tier $500)' : '5-Hour Rolling Window',
        total: isOpenAI500 ? 100 : isOpenAI200 ? 100 : 40,
        used: isOpenAI500 ? 0 : Math.min(isOpenAI200 ? 100 : 40, Math.round(s.openAIUsed * 2)),
        unit: isOpenAI500 ? ('unlimited' as const) : ('requests' as const),
        isUnlimited: isOpenAI500,
        resetPeriod: isOpenAI500 ? 'No rolling cap' : '5 hours',
        statusText: isOpenAI500 ? 'No 5-hour limit ($500 Max Tier)' : `${Math.max(0, 40 - Math.round(s.openAIUsed))} reqs remaining`,
      },
      {
        id: 'openai_budget',
        name: 'Codex Compute Quota',
        total: s.openAIBudget || 100,
        used: Math.min(s.openAIBudget || 100, Math.round(s.openAIUsed || 0)),
        unit: 'credits' as const,
        resetPeriod: 'Monthly cycle',
        statusText: `${Math.round(s.openAIUsed || 0)} / ${s.openAIBudget || 100} units used`,
      },
    ];

    // 2. Anthropic Claude Code (Separate Fable 5.5 and Core 5.5 pools)
    const claudePools = [
      {
        id: 'claude_main',
        name: 'Claude 5.5 Core (Sonnet & Opus)',
        total: 100,
        used: Math.min(100, Math.round((s.claudeGeneralUsed || 0) * 4)),
        unit: 'percentage' as const,
        resetPeriod: '5 hours',
        statusText: `${Math.max(0, 100 - Math.round((s.claudeGeneralUsed || 0) * 4))}% remaining`,
      },
      {
        id: 'claude_fable',
        name: 'Fable 5.5 (Dedicated Quota Pool)',
        total: 50,
        used: Math.min(50, s.claudeFableUsed || 0),
        unit: 'requests' as const,
        resetPeriod: 'Daily isolated pool',
        statusText: `${Math.max(0, 50 - (s.claudeFableUsed || 0))} / 50 tasks left`,
      },
      {
        id: 'claude_haiku',
        name: 'Haiku 5.5 Fast Pool',
        total: 100,
        used: Math.min(100, Math.round((s.claudeGeneralUsed || 0) * 1.5)),
        unit: 'percentage' as const,
        resetPeriod: '5 hours',
        statusText: 'High throughput tier',
      },
    ];

    // 3. Google Antigravity
    const antigravityPools = [
      {
        id: 'antigravity_credits',
        name: 'Google AI Credits',
        total: s.antigravityCreditsBudget || 100,
        used: Math.min(s.antigravityCreditsBudget || 100, Math.round(s.antigravityCreditsUsed || 0)),
        unit: 'credits' as const,
        resetPeriod: 'Monthly account cycle',
        statusText: `${Math.round(s.antigravityCreditsUsed || 0)} / ${s.antigravityCreditsBudget || 100} credits consumed`,
      },
      {
        id: 'antigravity_flash',
        name: 'Gemini 3.8 Flash Tier',
        total: 100,
        used: 0,
        unit: 'unlimited' as const,
        isUnlimited: true,
        resetPeriod: '1000 RPM capacity',
        statusText: 'No rate throttling',
      },
      {
        id: 'antigravity_thinking',
        name: 'Flash High & Claude in agy',
        total: 100,
        used: Math.min(100, Math.round((s.antigravityCreditsUsed || 0) * 3)),
        unit: 'percentage' as const,
        resetPeriod: 'Daily allowance',
        statusText: `${Math.max(0, 100 - Math.round((s.antigravityCreditsUsed || 0) * 3))}% remaining`,
      },
    ];

    // 4. OpenCode CLI
    const opencodePools = [
      {
        id: 'opencode_local',
        name: 'Local Models (Ollama / vLLM)',
        total: 100,
        used: 0,
        unit: 'unlimited' as const,
        isUnlimited: true,
        resetPeriod: 'Local hardware',
        statusText: 'Unlimited compute (0 cost)',
      },
      {
        id: 'opencode_cloud_free',
        name: 'Free Cloud Tier (DeepSeek / Beam)',
        total: 100,
        used: 8,
        unit: 'percentage' as const,
        resetPeriod: 'Daily API limit',
        statusText: '92% daily capacity',
      },
    ];

    return [
      {
        providerId: 'codex',
        providerName: 'OpenAI Codex',
        tierPlan: isOpenAI500 ? '$500 Max Tier' : isOpenAI200 ? '$200 Pro' : '$20 Plus',
        isOnline: isOnline('codex'),
        pools: openAiPools,
      },
      {
        providerId: 'claude',
        providerName: 'Claude Code',
        tierPlan: 'Team 5.5 (Split Quotas)',
        isOnline: isOnline('claude'),
        pools: claudePools,
      },
      {
        providerId: 'antigravity',
        providerName: 'Google Antigravity',
        tierPlan: 'AI Credits Mode',
        isOnline: isOnline('antigravity'),
        pools: antigravityPools,
      },
      {
        providerId: 'opencode',
        providerName: 'OpenCode CLI',
        tierPlan: 'Local & Free Cloud',
        isOnline: isOnline('opencode'),
        pools: opencodePools,
      },
    ];
  }

  public hasBudgetFor(model: string): boolean {
    const group = this.getModelGroup(model);
    if (group === 'google' || group === 'opencode') return true;

    const settings = this.getSettings();
    if (settings.openAIPlan === 'tier_500') return true;
    if (settings.openAIBudget <= 0) return true;
    return (settings.openAIUsed || 0) < settings.openAIBudget;
  }

  public isUltraAllowed(): boolean {
    const settings = this.getSettings();
    return settings.allowUltra && this.hasBudgetFor('GPT-6.1 Sol Ultra');
  }
}
