import { ValidationResult, SubscriptionSettings, TaskCategory } from '../src/types';

export interface EscalationDecision {
  canEscalate: boolean;
  nextModel?: string;
  nextProvider?: 'codex' | 'gemini';
  reasoningEffort?: string;
  reason: string;
  diagnosticContext: string;
}

export class EscalationManager {
  public classifyError(
    exitCode: number,
    errorMessage: string,
    validationResults: ValidationResult[]
  ): string {
    const text = (errorMessage || '').toLowerCase();

    // Check validation failures first
    const failedValidation = validationResults.find((v) => v.status === 'failed');
    if (failedValidation) {
      if (failedValidation.checkType === 'secrets') return 'security_hazard';
      if (failedValidation.checkType === 'test') return 'test_failure';
      if (failedValidation.checkType === 'build') return 'build_failure';
      if (failedValidation.checkType === 'lint') return 'lint_failure';
    }

    if (text.includes('auth') || text.includes('unauthorized') || text.includes('login') || text.includes('token')) {
      return 'auth_error';
    }
    if (text.includes('timeout') || text.includes('timed out')) {
      return 'timeout';
    }
    if (text.includes('quota') || text.includes('rate limit') || text.includes('insufficient_quota')) {
      return 'quota_exhausted';
    }
    if (text.includes('not found') || text.includes('spawn') || text.includes('enoent')) {
      return 'infrastructure_error';
    }

    return exitCode !== 0 ? 'runtime_error' : 'code_error';
  }

  public evaluateEscalation(
    attemptCount: number,
    currentModel: string,
    _taskCategory: TaskCategory,
    errorCategory: string,
    validationResults: ValidationResult[],
    settings: SubscriptionSettings,
    ultraAttemptsCount: number
  ): EscalationDecision {
    const diagnosticContext = this.buildDiagnosticContext(validationResults);

    // 1. Check max attempts
    if (attemptCount >= settings.maxAttempts) {
      return {
        canEscalate: false,
        reason: `Reached maximum attempt limit (${attemptCount}/${settings.maxAttempts}). Manual intervention required.`,
        diagnosticContext,
      };
    }

    // 2. Unrecoverable errors that upgrading model cannot fix (Section 11)
    if (errorCategory === 'auth_error' || errorCategory === 'infrastructure_error') {
      return {
        canEscalate: false,
        reason: `Infrastructure or authentication failure (${errorCategory}). Model escalation will not resolve this.`,
        diagnosticContext,
      };
    }

    if (errorCategory === 'security_hazard') {
      return {
        canEscalate: false,
        reason: 'Secrets or sensitive credentials detected in proposed changes. Aborted for security.',
        diagnosticContext,
      };
    }

    // 3. Escalation Ladder
    let nextModel = 'GPT-6.1 Sol High';
    let nextProvider: 'codex' | 'gemini' = 'codex';
    let reasoningEffort: string = 'high';

    if (currentModel.includes('Luna') || currentModel.includes('Gemini')) {
      nextModel = 'GPT-6.1 Sol Medium';
      nextProvider = 'codex';
      reasoningEffort = 'medium';
    } else if (currentModel.includes('Sol Medium')) {
      nextModel = 'GPT-6.1 Sol High';
      nextProvider = 'codex';
      reasoningEffort = 'high';
    } else if (currentModel.includes('Sol High') || currentModel.includes('Astra')) {
      if (settings.allowUltra && ultraAttemptsCount === 0) {
        nextModel = 'GPT-6.1 Sol Ultra';
        nextProvider = 'codex';
        reasoningEffort = 'high';
      } else {
        nextModel = 'GPT-6.1 Sol High';
        nextProvider = 'codex';
        reasoningEffort = 'high';
      }
    } else if (currentModel.includes('Sol Ultra')) {
      return {
        canEscalate: false,
        reason: 'Already reached highest tier (Sol Ultra). Cannot escalate further.',
        diagnosticContext,
      };
    }

    return {
      canEscalate: true,
      nextModel,
      nextProvider,
      reasoningEffort,
      reason: `Escalating from ${currentModel} to ${nextModel} due to ${errorCategory}. Attempt ${attemptCount + 1}/${settings.maxAttempts}.`,
      diagnosticContext,
    };
  }

  private buildDiagnosticContext(validationResults: ValidationResult[]): string {
    const failed = validationResults.filter((v) => v.status === 'failed');
    if (failed.length === 0) return 'Execution completed but verification failed.';

    return failed
      .map((f) => `[${f.checkType.toUpperCase()} CHECK FAILED]: ${f.summary}\n${f.details ? f.details.slice(0, 500) : ''}`)
      .join('\n---\n');
  }
}
