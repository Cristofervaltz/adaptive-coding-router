import { TaskAssessment, ProviderStatus } from '../src/types';
import { SubscriptionManager } from './SubscriptionManager';

export interface RouteDecision {
  provider: 'codex' | 'gemini' | 'claude' | 'opencode';
  model: string;
  reasoningEffort?: string;
  explanation: string;
}

export class ModelRouter {
  constructor(private subscriptionManager: SubscriptionManager) {}

  public route(
    assessment: TaskAssessment,
    availableProviders: ProviderStatus[],
    manualModel?: string
  ): RouteDecision {
    const settings = this.subscriptionManager.getSettings();

    // 0. Provider availability check
    const isCodexInstalled = availableProviders.some((p) => p.id === 'codex' && p.installed);
    const isGeminiInstalled = availableProviders.some((p) => p.id === 'gemini' && p.installed);
    const isClaudeInstalled = availableProviders.some((p) => p.id === 'claude' && p.installed);
    const isOpencodeInstalled = availableProviders.some((p) => p.id === 'opencode' && p.installed);

    // 1. Manual Override check
    if (settings.routingMode === 'manual' || manualModel) {
      const selectedModel = manualModel || settings.manualModel || 'GPT-6.1 Sol Medium';
      let provider: 'codex' | 'gemini' | 'claude' | 'opencode' = 'codex';
      if (selectedModel.toLowerCase().includes('claude')) {
        provider = 'claude';
      } else if (
        selectedModel.toLowerCase().includes('opencode') ||
        selectedModel.includes('Qwen') ||
        selectedModel.includes('DeepSeek') ||
        selectedModel.includes('Llama')
      ) {
        provider = 'opencode';
      } else if (selectedModel.toLowerCase().includes('gemini')) {
        provider = 'gemini';
      }

      return {
        provider,
        model: selectedModel,
        reasoningEffort:
          selectedModel.includes('High') || selectedModel.includes('Ultra') ? 'high' : 'medium',
        explanation: `Manual selection mode active. Directed to ${selectedModel}.`,
      };
    }

    // Single provider availability fallbacks
    if (!isCodexInstalled && !isGeminiInstalled && isClaudeInstalled) {
      return {
        provider: 'claude',
        model: 'Claude 3.7 Sonnet',
        explanation: 'Only Claude CLI is detected. Routing to Claude 3.7 Sonnet.',
      };
    }

    if (!isCodexInstalled && !isGeminiInstalled && isOpencodeInstalled) {
      return {
        provider: 'opencode',
        model: 'Qwen-2.5-Coder-32B',
        explanation: 'Only OpenCode CLI is detected. Routing to local Qwen-2.5-Coder-32B.',
      };
    }

    if (!isCodexInstalled && isGeminiInstalled) {
      return {
        provider: 'gemini',
        model: 'Gemini 3.8 High',
        explanation: 'Codex CLI is not installed or detected in PATH. Routing to available Gemini CLI.',
      };
    }

    if (!isGeminiInstalled && isCodexInstalled) {
      return {
        provider: 'codex',
        model: assessment.complexity < 35 ? 'GPT-6 Luna' : 'GPT-6.1 Sol Medium',
        reasoningEffort: assessment.complexity < 35 ? 'low' : 'medium',
        explanation: 'Gemini CLI is not detected in PATH. Routing to available Codex CLI.',
      };
    }

    const { category, complexity, risk } = assessment;
    const reserveOpenAI = settings.reserveOpenAI;
    const canUseOpenAI = this.subscriptionManager.hasBudgetFor('OpenAI');
    const allowUltra = settings.allowUltra && this.subscriptionManager.isUltraAllowed();

    // 2. Special Asset / Animation Rule (Section 7.1)
    // "Luna и Gemini не должны автоматически получать задачи создания сложных ассетов только потому, что они считаются более экономичными."
    if (category === 'asset_generation' || category === 'animation') {
      if (canUseOpenAI) {
        return {
          provider: 'codex',
          model: 'Astra High',
          reasoningEffort: 'high',
          explanation: `Specialized asset creation/animation task requires high spatial synthesis. Astra High chosen over economy tier.`,
        };
      }
    }

    // 3. Architecture & Critical Debugging (Section 7.1)
    if (category === 'architecture' || (category === 'debugging' && complexity >= 70)) {
      if (canUseOpenAI) {
        if (complexity >= 85 && allowUltra) {
          return {
            provider: 'codex',
            model: 'GPT-6.1 Sol Ultra',
            reasoningEffort: 'high',
            explanation: `High complexity (${complexity}/100) architecture task. Sol Ultra selected within budget limits.`,
          };
        }
        return {
          provider: 'codex',
          model: 'GPT-6.1 Sol High',
          reasoningEffort: 'high',
          explanation: `Complex architecture/debugging task. Sol High selected for deep reasoning capabilities.`,
        };
      }
    }

    // 4. Reserve OpenAI Mode Logic (Section 3: Reserve OpenAI)
    // "При включении этого режима маршрутизатор должен отдавать приоритет Gemini для задач, с которыми он предположительно способен справиться."
    if (reserveOpenAI) {
      // If task is reasonable for Gemini (simple_code, documentation, visual_design, light refactoring, or complexity < 50)
      if (category === 'documentation' || category === 'simple_code' || complexity < 50) {
        return {
          provider: 'gemini',
          model: 'Gemini 3.8 High',
          explanation: `Reserve OpenAI active: Task complexity (${complexity}/100) fits Gemini 3.8 High, preserving OpenAI quota for high-risk work.`,
        };
      }
    }

    // 5. General Complexity Scale (Section 7.2)
    // 0–24: Economy
    if (complexity < 25) {
      if (reserveOpenAI) {
        return {
          provider: 'gemini',
          model: 'Gemini 3.8 High',
          explanation: `Economy tier (complexity ${complexity}/100). Gemini 3.8 High assigned for optimal quota efficiency.`,
        };
      }
      return {
        provider: 'codex',
        model: 'GPT-6 Luna',
        reasoningEffort: 'low',
        explanation: `Economy tier (complexity ${complexity}/100). Fast and lightweight GPT-6 Luna selected.`,
      };
    }

    // 25–49: Medium
    if (complexity < 50) {
      if (category === 'refactoring' || category === 'simple_code') {
        if (canUseOpenAI) {
          return {
            provider: 'codex',
            model: 'GPT-6.1 Sol Medium',
            reasoningEffort: 'medium',
            explanation: `Medium complexity tier (complexity ${complexity}/100). Standard refactoring/logic directed to Sol Medium.`,
          };
        }
      }
      return {
        provider: 'gemini',
        model: 'Gemini 3.8 High',
        explanation: `Medium complexity tier routed to Gemini 3.8 High based on quota balancing.`,
      };
    }

    // 50–74: High
    if (complexity < 75) {
      if (canUseOpenAI) {
        return {
          provider: 'codex',
          model: 'GPT-6.1 Sol High',
          reasoningEffort: 'high',
          explanation: `High complexity tier (complexity ${complexity}/100, risk ${risk}/100). Routed to Sol High for verified accuracy.`,
        };
      }
      return {
        provider: 'gemini',
        model: 'Gemini 3.8 High',
        explanation: `High complexity task routed to Gemini 3.8 High because OpenAI quota is constrained.`,
      };
    }

    // 75–100: High / Ultra
    if (allowUltra && complexity >= 85) {
      return {
        provider: 'codex',
        model: 'GPT-6.1 Sol Ultra',
        reasoningEffort: 'high',
        explanation: `Maximum complexity tier (${complexity}/100). Sol Ultra selected for mission-critical execution.`,
      };
    }

    if (canUseOpenAI) {
      return {
        provider: 'codex',
        model: 'GPT-6.1 Sol High',
        reasoningEffort: 'high',
        explanation: `High complexity tier (${complexity}/100). Sol High selected (Ultra disabled or preserved).`,
      };
    }

    return {
      provider: 'gemini',
      model: 'Gemini 3.8 High',
      explanation: `Routed to Gemini 3.8 High as default capable executor under resource constraints.`,
    };
  }
}
