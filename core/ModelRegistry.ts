import { ProviderStatus } from '../src/types';

export type ModelTier = 'economy' | 'standard' | 'high_reasoning' | 'ultra_expert';

export interface DiscoveredModel {
  id: string;
  name: string;
  provider: 'codex' | 'gemini' | 'antigravity' | 'claude' | 'opencode';
  tier: ModelTier;
  complexityMin: number;
  complexityMax: number;
  costMultiplier: number;
  capabilities: string[];
  isSubscriptionQuota: boolean;
  supportedReasoningEfforts?: string[];
}

export class ModelRegistry {
  public classifyModel(
    rawId: string,
    rawName: string,
    provider: 'codex' | 'gemini' | 'antigravity' | 'claude' | 'opencode',
    supportedReasoningLevels?: string[]
  ): DiscoveredModel {
    const id = rawId.toLowerCase();
    const name = rawName || rawId;

    let tier: ModelTier = 'standard';
    let complexityMin = 30;
    let complexityMax = 69;
    let costMultiplier = 1.0;
    let isSubscriptionQuota = provider !== 'opencode';

    // Hierarchy and tier heuristics
    if (
      id.includes('ultra') ||
      id.includes('max') ||
      id.includes('opus') ||
      id.includes('405b')
    ) {
      tier = 'ultra_expert';
      complexityMin = 85;
      complexityMax = 100;
      costMultiplier = 4.0;
    } else if (
      id.includes('flash-high') ||
      id.includes('astra') ||
      id.includes('sonnet') ||
      id.includes('high') ||
      id.includes('r1') ||
      id.includes('o1') ||
      id.includes('o3') ||
      id.includes('70b')
    ) {
      tier = 'high_reasoning';
      complexityMin = 65;
      complexityMax = 89;
      costMultiplier = 2.0;
    } else if (
      id.includes('flash-low') ||
      id.includes('luna') ||
      id.includes('haiku') ||
      id.includes('mini') ||
      id.includes('lite') ||
      id.includes('7b') ||
      id.includes('8b')
    ) {
      tier = 'economy';
      complexityMin = 0;
      complexityMax = 34;
      costMultiplier = 0.4;
    } else {
      tier = 'standard';
      complexityMin = 30;
      complexityMax = 69;
      costMultiplier = 1.0;
    }

    // Provider-specific adjustments
    if (provider === 'opencode') {
      costMultiplier = 0.05; // Local execution has virtually zero direct subscription cost
      isSubscriptionQuota = false;
    }

    // Capabilities inference
    const capabilities: string[] = ['coding'];
    if (tier === 'high_reasoning' || tier === 'ultra_expert') {
      capabilities.push('architecture', 'deep_debugging', 'complex_refactoring');
    }
    if (id.includes('astra') || id.includes('vision') || id.includes('sonnet')) {
      capabilities.push('asset_generation', 'visual_design', 'animation');
    }

    return {
      id: rawId,
      name,
      provider,
      tier,
      complexityMin,
      complexityMax,
      costMultiplier,
      capabilities,
      isSubscriptionQuota,
      supportedReasoningEfforts: supportedReasoningLevels,
    };
  }

  public getModelsForProviders(providers: ProviderStatus[]): DiscoveredModel[] {
    const list: DiscoveredModel[] = [];

    for (const p of providers) {
      if (!p.installed) continue;

      for (const m of p.availableModels || []) {
        list.push(this.classifyModel(m, m, p.id));
      }
    }

    return list;
  }
}
