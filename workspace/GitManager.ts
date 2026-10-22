import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { GitDiffSummary, GitDiffFile } from '../src/types';

export class GitManager {
  public async createWorktree(projectPath: string, taskId: string): Promise<string> {
    const isGit = fs.existsSync(path.join(projectPath, '.git'));
    if (!isGit) {
      // Initialize git if not present to ensure safe worktree isolation
      execSync('git init', { cwd: projectPath, stdio: 'ignore' });
      execSync('git add -A', { cwd: projectPath, stdio: 'ignore' });
      try {
        execSync('git commit -m "Initial commit for ACR worktree isolation"', { cwd: projectPath, stdio: 'ignore' });
      } catch {
        // empty commit
      }
    }

    const worktreeBase = path.join(projectPath, '.acr-worktrees');
    if (!fs.existsSync(worktreeBase)) {
      fs.mkdirSync(worktreeBase, { recursive: true });
    }

    // Ensure .acr-worktrees is ignored in main repository .gitignore
    const gitignorePath = path.join(projectPath, '.gitignore');
    try {
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf-8');
        if (!content.includes('.acr-worktrees')) {
          fs.appendFileSync(gitignorePath, '\n.acr-worktrees/\n');
        }
      } else {
        fs.writeFileSync(gitignorePath, '.acr-worktrees/\n');
      }
    } catch {
      // ignore
    }

    const branchName = `acr/task-${taskId.slice(0, 8)}`;
    const worktreePath = path.join(worktreeBase, `task-${taskId.slice(0, 8)}`);

    // Clean up if old path or branch exists
    this.cleanupWorktreeSync(projectPath, worktreePath, branchName);

    try {
      execSync(`git worktree add -b ${branchName} "${worktreePath}" HEAD`, {
        cwd: projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return worktreePath;
    } catch {
      // Fallback if worktree command fails: copy files into isolated directory
      return this.createDirectoryCopy(projectPath, worktreePath);
    }
  }

  public async getDiff(_projectPath: string, worktreePath: string): Promise<GitDiffSummary> {
    if (!fs.existsSync(worktreePath)) {
      return {
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        rawDiff: '',
      };
    }

    try {
      // Get staged and unstaged diff relative to HEAD
      const rawDiff = execSync('git diff HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      const numstatOut = execSync('git diff --numstat HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      const statusOut = execSync('git status --porcelain', {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      const files: GitDiffFile[] = [];
      let totalAdditions = 0;
      let totalDeletions = 0;

      // Parse numstat lines: <additions> <deletions> <path>
      const numstatLines = numstatOut.split('\n').filter((l) => l.trim().length > 0);
      for (const line of numstatLines) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const adds = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
          const dels = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
          const filePath = parts[2].trim();
          totalAdditions += adds;
          totalDeletions += dels;

          files.push({
            path: filePath,
            status: adds > 0 && dels === 0 ? 'added' : 'modified',
            additions: adds,
            deletions: dels,
            diff: '',
          });
        }
      }

      // Check untracked files
      const statusLines = statusOut.split('\n').filter((l) => l.trim().length > 0);
      for (const line of statusLines) {
        if (line.startsWith('??')) {
          const filePath = line.slice(3).trim();
          if (!files.some((f) => f.path === filePath)) {
            files.push({
              path: filePath,
              status: 'added',
              additions: 1,
              deletions: 0,
              diff: '',
            });
            totalAdditions += 1;
          }
        }
      }

      return {
        files,
        totalAdditions,
        totalDeletions,
        rawDiff: rawDiff || (files.length > 0 ? `Detected ${files.length} untracked or modified files.` : ''),
      };
    } catch {
      return {
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        rawDiff: '',
      };
    }
  }

  public async applyMerge(projectPath: string, worktreePath: string, taskId: string): Promise<void> {
    const branchName = `acr/task-${taskId.slice(0, 8)}`;

    try {
      // Commit all changes in worktree
      execSync('git add -A', { cwd: worktreePath, stdio: 'ignore' });
      try {
        execSync(`git commit -m "ACR: implement task ${taskId.slice(0, 8)}"`, {
          cwd: worktreePath,
          stdio: 'ignore',
        });
      } catch {
        // nothing to commit
      }

      // Merge into project branch
      execSync(`git merge ${branchName} --no-edit`, {
        cwd: projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } finally {
      this.cleanupWorktreeSync(projectPath, worktreePath, branchName);
    }
  }

  public async discardWorktree(projectPath: string, worktreePath: string, taskId: string): Promise<void> {
    const branchName = `acr/task-${taskId.slice(0, 8)}`;
    this.cleanupWorktreeSync(projectPath, worktreePath, branchName);
  }

  private cleanupWorktreeSync(projectPath: string, worktreePath: string, branchName: string): void {
    try {
      execSync(`git worktree remove --force "${worktreePath}"`, {
        cwd: projectPath,
        stdio: 'ignore',
      });
    } catch {
      // ignore
    }

    try {
      execSync(`git worktree prune`, {
        cwd: projectPath,
        stdio: 'ignore',
      });
    } catch {
      // ignore
    }

    try {
      execSync(`git branch -D ${branchName}`, {
        cwd: projectPath,
        stdio: 'ignore',
      });
    } catch {
      // ignore
    }

    if (fs.existsSync(worktreePath)) {
      try {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  private createDirectoryCopy(src: string, dest: string): string {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    // Safe shallow copy excluding .git and node_modules
    fs.cpSync(src, dest, {
      recursive: true,
      filter: (source) => {
        return !source.includes('.git') && !source.includes('node_modules') && !source.includes('.acr-worktrees');
      },
    });
    return dest;
  }
}
