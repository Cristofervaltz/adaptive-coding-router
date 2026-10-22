import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { Project, ValidationResult, GitDiffSummary } from '../src/types';

export class Validator {
  private secretPatterns = [
    { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{32,}/ },
    { name: 'GitHub Personal Access Token', regex: /gh[pousr]_[a-zA-Z0-9]{36,}/ },
    { name: 'Google API Key', regex: /AIzaSy[a-zA-Z0-9_-]{33}/ },
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
    { name: 'Generic Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  ];

  public async validateRun(
    runId: string,
    worktreePath: string,
    project: Project,
    diff: GitDiffSummary
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // 1. Secrets check
    results.push(this.checkSecrets(runId, diff.rawDiff));

    // 2. Git Diff integrity check
    results.push(this.checkDiffIntegrity(runId, diff));

    // 3. Automated Test Command check
    if (project.testCommand) {
      results.push(this.executeCommandCheck(runId, 'test', project.testCommand, worktreePath));
    } else {
      results.push({
        id: crypto.randomUUID(),
        runId,
        checkType: 'test',
        status: 'skipped',
        durationMs: 0,
        summary: 'No test suite configured for this project.',
      });
    }

    // 4. Lint Command check
    if (project.lintCommand) {
      results.push(this.executeCommandCheck(runId, 'lint', project.lintCommand, worktreePath));
    }

    // 5. Build Command check
    if (project.buildCommand) {
      results.push(this.executeCommandCheck(runId, 'build', project.buildCommand, worktreePath));
    }

    return results;
  }

  private checkSecrets(runId: string, diffText: string): ValidationResult {
    const startTime = Date.now();
    for (const pattern of this.secretPatterns) {
      if (pattern.regex.test(diffText)) {
        return {
          id: crypto.randomUUID(),
          runId,
          checkType: 'secrets',
          status: 'failed',
          durationMs: Date.now() - startTime,
          summary: `Security hazard: Potential ${pattern.name} detected in diff.`,
          details: `Line matched pattern ${pattern.name}. Avoid committing credentials.`,
        };
      }
    }

    return {
      id: crypto.randomUUID(),
      runId,
      checkType: 'secrets',
      status: 'passed',
      durationMs: Date.now() - startTime,
      summary: 'No secrets detected in code diff.',
    };
  }

  private checkDiffIntegrity(runId: string, diff: GitDiffSummary): ValidationResult {
    const startTime = Date.now();
    if (diff.files.length === 0) {
      return {
        id: crypto.randomUUID(),
        runId,
        checkType: 'diff',
        status: 'warning',
        durationMs: Date.now() - startTime,
        summary: 'No files were modified by the executor.',
        details: 'The agent exited without introducing any file changes into the worktree.',
      };
    }

    if (diff.totalDeletions > 500 && diff.totalAdditions < 50) {
      return {
        id: crypto.randomUUID(),
        runId,
        checkType: 'diff',
        status: 'warning',
        durationMs: Date.now() - startTime,
        summary: `Large deletion alert: ${diff.totalDeletions} lines deleted vs ${diff.totalAdditions} added.`,
        details: 'Verify that critical project files were not unintentionally deleted.',
      };
    }

    return {
      id: crypto.randomUUID(),
      runId,
      checkType: 'diff',
      status: 'passed',
      durationMs: Date.now() - startTime,
      summary: `Clean diff: ${diff.files.length} files changed (+${diff.totalAdditions} / -${diff.totalDeletions}).`,
    };
  }

  private executeCommandCheck(
    runId: string,
    checkType: 'test' | 'lint' | 'build',
    command: string,
    cwd: string
  ): ValidationResult {
    const startTime = Date.now();
    try {
      const output = execSync(command, {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 45000,
      });

      return {
        id: crypto.randomUUID(),
        runId,
        checkType,
        status: 'passed',
        durationMs: Date.now() - startTime,
        summary: `${checkType.toUpperCase()} passed successfully (${command}).`,
        details: output.slice(0, 1000),
      };
    } catch (err: any) {
      const errorOutput = (err.stdout || err.stderr || err.message || '').toString();
      return {
        id: crypto.randomUUID(),
        runId,
        checkType,
        status: 'failed',
        durationMs: Date.now() - startTime,
        summary: `${checkType.toUpperCase()} failed (${command}). Exit code: ${err.status || 1}.`,
        details: errorOutput.slice(0, 2000),
      };
    }
  }
}
