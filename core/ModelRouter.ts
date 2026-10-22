import { TaskAssessment, ProviderStatus } from '../src/types';
import { SubscriptionManager } from './SubscriptionManager';
import { ModelRegistry, ModelTier } from './ModelRegistry';

export interface RouteDecision {
  provider: 'codex' | 'antigravity' | 'claude' | 'opencode';
  model: string;
  reasoningEffort?: string;
  explanation: string;
}

export class ModelRouter {
  private registry: ModelRegistry;

  constructor(
    private subscriptionManager: SubscriptionManager,
    registry?: ModelRegistry
  ) {
    this.registry = registry || new ModelRegistry();
  }

  public route(
    assessment: TaskAssessment,
    availableProviders: ProviderStatus[],
    manualModel?: string
  ): RouteDecision {
    const settings = this.subscriptionManager.getSettings();
    const discovered = this.registry.getModelsForProviders(availableProviders);

    // 1. Manual Override check
    if (settings.routingMode === 'manual' || manualModel) {
      const selectedModel = manualModel || settings.manualModel || 'gpt-6.1-sol';
      const match = discovered.find(
        (m) => m.id === selectedModel || m.name === selectedModel
      );
      const provider = match ? match.provider : this.inferProvider(selectedModel);

      return {
        provider,
        model: selectedModel,
        reasoningEffort:
          selectedModel.includes('high') || selectedModel.includes('ultra')
            ? 'high'
            : 'medium',
        explanation: `Manual selection mode active. Directed to ${selectedModel}.`,
      };
    }

    if (discovered.length === 0) {
      // Fallback if no provider CLI detected
      return {
        provider: 'codex',
        model: 'gpt-6.1-sol',
        explanation: 'No active provider detected. Falling back to default execution.',
      };
    }

    // 2. Determine target tier based on complexity and risk
    const { category, complexity, risk } = assessment;
    let targetTier: ModelTier = 'standard';

    if (
      complexity < 30 &&
      category !== 'architecture' &&
      category !== 'asset_generation'
    ) {
      targetTier = 'economy';
    } else if (
      complexity >= 80 ||
      (category === 'architecture' && complexity >= 70)
    ) {
      targetTier = settings.allowUltra ? 'ultra_expert' : 'high_reasoning';
    } else if (
      complexity >= 60 ||
      risk >= 65 ||
      category === 'asset_generation'
    ) {
      targetTier = 'high_reasoning';
    } else {
      targetTier = 'standard';
    }

    // 3. Filter candidate models
    let candidates = discovered.filter((m) => {
      if (targetTier === 'economy') {
        return m.tier === 'economy' || m.tier === 'standard';
      }
      if (targetTier === 'standard') {
        return (
          m.tier === 'standard' ||
          m.tier === 'economy' ||
          m.tier === 'high_reasoning'
        );
      }
      if (targetTier === 'high_reasoning') {
        return (
          m.tier === 'high_reasoning' ||
          m.tier === 'ultra_expert' ||
          m.tier === 'standard'
        );
      }
      if (targetTier === 'ultra_expert') {
        return m.tier === 'ultra_expert' || m.tier === 'high_reasoning';
      }
      return true;
    });

    if (candidates.length === 0) {
      candidates = discovered;
    }

    // 4. Reserve OpenAI Mode: penalize OpenAI models if Reserve OpenAI is on or budget is low
    const reserveOpenAI = settings.reserveOpenAI;
    const hasOpenAIBudget = this.subscriptionManager.hasBudgetFor('OpenAI');

    candidates.sort((a, b) => {
      let scoreA = a.costMultiplier;
      let scoreB = b.costMultiplier;

      if (reserveOpenAI || !hasOpenAIBudget) {
        if (a.provider === 'codex') scoreA += 10;
        if (b.provider === 'codex') scoreB += 10;
      }

      // Capability matching bonus
      if (a.capabilities.includes(category)) scoreA -= 0.5;
      if (b.capabilities.includes(category)) scoreB -= 0.5;

      return scoreA - scoreB;
    });

    const chosen = candidates[0];
    const effort =
      chosen.tier === 'high_reasoning' || chosen.tier === 'ultra_expert'
        ? 'high'
        : 'medium';

    return {
      provider: chosen.provider,
      model: chosen.id,
      reasoningEffort: effort,
      explanation: `Dynamically selected ${chosen.name} (${chosen.provider}, tier: ${chosen.tier}, cost: ${chosen.costMultiplier}x) matching complexity ${complexity}/100 and category ${category}.`,
    };
  }

  private inferProvider(
    model: string
  ): 'codex' | 'antigravity' | 'claude' | 'opencode' {
    const l = model.toLowerCase();
    if (l.includes('claude')) return 'claude';
    if (l.includes('agy') || l.includes('antigravity')) return 'antigravity';
    if (l.includes('gemini')) return 'antigravity';
    if (
      l.includes('qwen') ||
      l.includes('deepseek') ||
      l.includes('llama') ||
      l.includes('opencode')
    ) {
      return 'opencode';
    }
    return 'codex';
  }
}
