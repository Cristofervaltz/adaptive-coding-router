import fs from 'node:fs';
import path from 'node:path';
import { SubscriptionSettings, ProviderQuota, ProviderStatus, QuotaPool } from '../src/types';
import { AppDatabase } from '../storage/database';

interface CodexAuthToken {
  planType: string;
  email?: string;
  isUnlimited: boolean;
}

export class SubscriptionManager {
  private defaultSettings: SubscriptionSettings = {
    reserveOpenAI: true,
    openAIBudget: 100,
    openAIUsed: 0,
    codex5hUsed: 0,
    antigravityGeminiUsed: 0,
    antigravityClaudeUsed: 0,
    antigravityGptUsed: 0,
    claudeGeneralUsed: 0,
    claudeFableUsed: 0,
    opencodeCloudUsed: 0,
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
    const raw = this.db.getSetting<SubscriptionSettings>('subscription_settings', this.defaultSettings);
    const auth = this.detectCodexAuth();
    const claudeInfo = this.detectClaudeInfo();
    const agyInfo = this.detectAntigravityInfo();
    const opencodeInfo = this.detectOpenCodeInfo();

    return {
      ...this.defaultSettings,
      ...raw,
      detectedCodexPlan: auth.planType ? (auth.isUnlimited ? '$500 Pro (Unlimited)' : `${auth.planType.toUpperCase()}`) : 'Unauthenticated',
      detectedCodexEmail: auth.email,
      detectedClaudeTier: claudeInfo,
      detectedAntigravityTier: agyInfo,
      detectedOpenCodeTier: opencodeInfo,
    };
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

  private detectCodexAuth(): CodexAuthToken {
    try {
      const home = process.env.USERPROFILE || process.env.HOME || '';
      const authPath = path.join(home, '.codex', 'auth.json');
      if (!fs.existsSync(authPath)) {
        return { planType: '', isUnlimited: false };
      }

      const raw = fs.readFileSync(authPath, 'utf8');
      const data = JSON.parse(raw);
      const accessToken = data?.tokens?.access_token;
      if (!accessToken || typeof accessToken !== 'string') {
        return { planType: '', isUnlimited: false };
      }

      const parts = accessToken.split('.');
      if (parts.length < 2) {
        return { planType: '', isUnlimited: false };
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      const authObj = payload['https://api.openai.com/auth'] || {};
      const profileObj = payload['https://api.openai.com/profile'] || {};

      const planType = (authObj.chatgpt_plan_type || '').toLowerCase();
      const email = profileObj.email;
      const isUnlimited = planType === 'pro' || planType === 'enterprise';

      return {
        planType: planType || 'plus',
        email,
        isUnlimited,
      };
    } catch {
      return { planType: '', isUnlimited: false };
    }
  }

  private detectClaudeInfo(): string {
    try {
      const home = process.env.USERPROFILE || process.env.HOME || '';
      const settingsPath = path.join(home, '.claude', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        const data = JSON.parse(raw);
        if (data?.env?.CLAUDE_CODE_USE_BEDROCK === '1') {
          const profile = data?.env?.AWS_PROFILE || 'bedrock';
          return `AWS Bedrock (${profile})`;
        }
      }
      const claudeJson = path.join(home, '.claude.json');
      if (fs.existsSync(claudeJson)) {
        return 'Claude Pro / Team';
      }
      return 'Native Config';
    } catch {
      return 'Standard Tier';
    }
  }

  private detectAntigravityInfo(): string {
    try {
      const home = process.env.USERPROFILE || process.env.HOME || '';
      const agyDir = path.join(home, '.gemini', 'antigravity');
      if (fs.existsSync(agyDir)) {
        return 'Multi-Model Credits Mode';
      }
      return 'Native Engine';
    } catch {
      return 'Standard Mode';
    }
  }

  private detectOpenCodeInfo(): string {
    try {
      const home = process.env.USERPROFILE || process.env.HOME || '';
      const opPath = path.join(home, '.config', 'opencode', 'service.json');
      if (fs.existsSync(opPath)) {
        return 'Local Daemon + Cloud';
      }
      return 'Local Execution';
    } catch {
      return 'Local Execution';
    }
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

  public recordUsage(
    model: string,
    costMultiplier: number = 1,
    providerId?: 'codex' | 'antigravity' | 'claude' | 'opencode'
  ): void {
    const current = this.getSettings();
    const lower = model.toLowerCase();

    // Antigravity has 3 separated quota pools: Gemini, Claude in Antigravity, and GPT-OSS in Antigravity
    if (providerId === 'antigravity' || lower.includes('antigravity') || lower.includes('agy')) {
      if (lower.includes('claude')) {
        this.updateSettings({
          antigravityClaudeUsed: (current.antigravityClaudeUsed || 0) + costMultiplier,
        });
      } else if (lower.includes('gpt') || lower.includes('oss')) {
        this.updateSettings({
          antigravityGptUsed: (current.antigravityGptUsed || 0) + costMultiplier,
        });
      } else {
        this.updateSettings({
          antigravityGeminiUsed: (current.antigravityGeminiUsed || 0) + costMultiplier,
        });
      }
      return;
    }

    // Claude Code has separate pools for Fable 5.5 and Core 5.5
    if (providerId === 'claude' || lower.includes('claude') || lower.includes('fable')) {
      if (lower.includes('fable')) {
        this.updateSettings({
          claudeFableUsed: (current.claudeFableUsed || 0) + 1,
        });
      } else {
        this.updateSettings({
          claudeGeneralUsed: (current.claudeGeneralUsed || 0) + costMultiplier,
        });
      }
      return;
    }

    // OpenCode
    if (providerId === 'opencode' || lower.includes('opencode') || lower.includes('qwen') || lower.includes('deepseek')) {
      this.updateSettings({
        opencodeCloudUsed: (current.opencodeCloudUsed || 0) + 1,
      });
      return;
    }

    // OpenAI Codex models
    let delta = costMultiplier;
    if (model.includes('Ultra')) delta *= 3;
    else if (model.includes('Sol High') || model.includes('Astra')) delta *= 2;
    else if (model.includes('Luna')) delta *= 0.5;

    this.updateSettings({
      openAIUsed: (current.openAIUsed || 0) + delta,
      codex5hUsed: (current.codex5hUsed || 0) + 1,
    });
  }

  public getProviderQuotas(statuses: ProviderStatus[]): ProviderQuota[] {
    const s = this.getSettings();
    const auth = this.detectCodexAuth();
    const isOnline = (id: string) => statuses.find((st) => st.id === id)?.installed ?? false;

    // 1. OpenAI Codex (native detection from auth.json JWT)
    const isCodexUnlimited = auth.isUnlimited;
    const codexPlanName = auth.planType ? (isCodexUnlimited ? '$500 Pro' : `$20 ${auth.planType.charAt(0).toUpperCase() + auth.planType.slice(1)}`) : '$20 Plus';

    const codexPools: QuotaPool[] = [
      {
        id: 'codex_5h',
        name: isCodexUnlimited ? '5-Hour Rate Limit ($500 Plan)' : '5-Hour Rolling Window',
        total: isCodexUnlimited ? 100 : 40,
        used: isCodexUnlimited ? 0 : Math.min(40, s.codex5hUsed || 0),
        unit: isCodexUnlimited ? 'unlimited' : 'requests',
        isUnlimited: isCodexUnlimited,
        resetPeriod: isCodexUnlimited ? 'No rolling window' : '5 hours',
        statusText: isCodexUnlimited ? 'No 5-hour limit ($500 Pro)' : `${Math.max(0, 40 - (s.codex5hUsed || 0))} reqs left in 5h window`,
      },
      {
        id: 'codex_compute',
        name: 'OpenAI Compute Budget',
        total: s.openAIBudget || 100,
        used: Math.min(s.openAIBudget || 100, Math.round(s.openAIUsed || 0)),
        unit: 'credits',
        resetPeriod: 'Monthly cycle',
        statusText: `${Math.round(s.openAIUsed || 0)} / ${s.openAIBudget || 100} units used`,
      },
    ];

    // 2. Google Antigravity (strictly separated pools for Gemini, Claude, and GPT-OSS)
    const antigravityPools: QuotaPool[] = [
      {
        id: 'antigravity_gemini',
        name: 'Gemini Models (Flash High/Med/Low)',
        total: 100,
        used: Math.min(100, (s.antigravityGeminiUsed || 0) * 2),
        unit: 'percentage',
        resetPeriod: '1000 RPM capacity',
        statusText: `${Math.max(0, 100 - (s.antigravityGeminiUsed || 0) * 2)}% remaining (Gemini Quota)`,
      },
      {
        id: 'antigravity_claude',
        name: 'Claude in Antigravity (Sonnet & Opus)',
        total: 100,
        used: Math.min(100, (s.antigravityClaudeUsed || 0) * 4),
        unit: 'percentage',
        resetPeriod: 'Daily isolated pool',
        statusText: `${Math.max(0, 100 - (s.antigravityClaudeUsed || 0) * 4)}% remaining (Anthropic in agy)`,
      },
      {
        id: 'antigravity_gpt_oss',
        name: 'GPT-OSS in Antigravity (120B)',
        total: 100,
        used: Math.min(100, (s.antigravityGptUsed || 0) * 2),
        unit: 'percentage',
        resetPeriod: 'Dedicated compute cluster',
        statusText: `${Math.max(0, 100 - (s.antigravityGptUsed || 0) * 2)}% remaining (GPT-OSS Quota)`,
      },
    ];

    // 3. Anthropic Claude Code (separate Fable 5.5, Core 5.5, and Haiku 5.5)
    const claudePools: QuotaPool[] = [
      {
        id: 'claude_core',
        name: 'Claude 5.5 Core (Sonnet & Opus)',
        total: 100,
        used: Math.min(100, (s.claudeGeneralUsed || 0) * 4),
        unit: 'percentage',
        resetPeriod: '5 hours',
        statusText: `${Math.max(0, 100 - (s.claudeGeneralUsed || 0) * 4)}% remaining`,
      },
      {
        id: 'claude_fable',
        name: 'Fable 5.5 (Dedicated Quota Pool)',
        total: 50,
        used: Math.min(50, s.claudeFableUsed || 0),
        unit: 'requests',
        resetPeriod: 'Dedicated model quota',
        statusText: `${Math.max(0, 50 - (s.claudeFableUsed || 0))} / 50 tasks left`,
      },
      {
        id: 'claude_haiku',
        name: 'Haiku 5.5 Fast Pool',
        total: 100,
        used: Math.min(100, (s.claudeGeneralUsed || 0) * 1.5),
        unit: 'percentage',
        resetPeriod: '5 hours',
        statusText: 'High throughput capacity',
      },
    ];

    // 4. OpenCode CLI (Local GPU unlimited vs Free Cloud API)
    const opencodePools: QuotaPool[] = [
      {
        id: 'opencode_local',
        name: 'Local Models (Ollama / vLLM)',
        total: 100,
        used: 0,
        unit: 'unlimited',
        isUnlimited: true,
        resetPeriod: 'Local hardware',
        statusText: 'Unlimited compute (0 cost)',
      },
      {
        id: 'opencode_cloud_free',
        name: 'Free Cloud Tier (DeepSeek / Beam)',
        total: 100,
        used: Math.min(100, (s.opencodeCloudUsed || 0) * 5),
        unit: 'percentage',
        resetPeriod: 'Daily API quota',
        statusText: `${Math.max(0, 100 - (s.opencodeCloudUsed || 0) * 5)}% daily capacity left`,
      },
    ];

    return [
      {
        providerId: 'codex',
        providerName: 'OpenAI Codex',
        tierPlan: codexPlanName,
        accountEmail: auth.email,
        isOnline: isOnline('codex'),
        pools: codexPools,
      },
      {
        providerId: 'antigravity',
        providerName: 'Google Antigravity',
        tierPlan: 'Tri-Pool Quota Mode',
        accountDetail: s.detectedAntigravityTier,
        isOnline: isOnline('antigravity'),
        pools: antigravityPools,
      },
      {
        providerId: 'claude',
        providerName: 'Claude Code',
        tierPlan: s.detectedClaudeTier || '5.5 Split Pools',
        isOnline: isOnline('claude'),
        pools: claudePools,
      },
      {
        providerId: 'opencode',
        providerName: 'OpenCode CLI',
        tierPlan: 'Local Hardware & Cloud',
        isOnline: isOnline('opencode'),
        pools: opencodePools,
      },
    ];
  }

  public hasBudgetFor(model: string): boolean {
    const group = this.getModelGroup(model);
    if (group === 'google' || group === 'opencode') return true;

    const auth = this.detectCodexAuth();
    if (auth.isUnlimited) return true;

    const settings = this.getSettings();
    if (settings.openAIBudget <= 0) return true;
    return (settings.openAIUsed || 0) < settings.openAIBudget;
  }

  public isUltraAllowed(): boolean {
    const settings = this.getSettings();
    return settings.allowUltra && this.hasBudgetFor('GPT-6.1 Sol Ultra');
  }
}
