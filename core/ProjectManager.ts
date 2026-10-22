import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { Project } from '../src/types';
import { AppDatabase } from '../storage/database';

export class ProjectManager {
  constructor(private db: AppDatabase) {}

  public async scanProject(folderPath: string): Promise<Project> {
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
      throw new Error(`Directory does not exist: ${folderPath}`);
    }

    const name = path.basename(folderPath);
    const existing = this.db.getProjectByPath(folderPath);
    const id = existing ? existing.id : crypto.randomUUID();

    const isGit = fs.existsSync(path.join(folderPath, '.git'));
    let gitBranch: string | undefined;
    let hasUncommitted = false;

    if (isGit) {
      try {
        gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: folderPath,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();

        const statusOut = execSync('git status --porcelain', {
          cwd: folderPath,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        hasUncommitted = statusOut.length > 0;
      } catch {
        // Git command failed or repo is empty
      }
    }

    const { language, testCommand, buildCommand, lintCommand } = this.detectStackAndCommands(folderPath);

    const now = new Date().toISOString();
    const project: Project = {
      id,
      name,
      path: folderPath,
      language,
      gitBranch,
      hasUncommitted,
      testCommand,
      buildCommand,
      lintCommand,
      createdAt: existing ? existing.created_at : now,
      updatedAt: now,
    };

    this.db.upsertProject({
      id: project.id,
      name: project.name,
      path: project.path,
      language: project.language,
      git_branch: project.gitBranch,
      test_command: project.testCommand,
      build_command: project.buildCommand,
      lint_command: project.lintCommand,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    });

    return project;
  }

  public getRecentProjects(): Project[] {
    const rows = this.db.getRecentProjects();
    return rows.map((r) => this.mapRowToProject(r));
  }

  public getProject(id: string): Project | null {
    const row = this.db.getProjectById(id);
    return row ? this.mapRowToProject(row) : null;
  }

  private detectStackAndCommands(folderPath: string): {
    language: string;
    testCommand?: string;
    buildCommand?: string;
    lintCommand?: string;
  } {
    const packageJsonPath = path.join(folderPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const hasTs = fs.existsSync(path.join(folderPath, 'tsconfig.json')) ||
          (pkg.devDependencies && pkg.devDependencies.typescript) ||
          (pkg.dependencies && pkg.dependencies.typescript);

        const scripts = pkg.scripts || {};
        return {
          language: hasTs ? 'TypeScript' : 'JavaScript',
          testCommand: scripts.test && !scripts.test.includes('no test specified') ? 'npm test' : undefined,
          buildCommand: scripts.build ? 'npm run build' : undefined,
          lintCommand: scripts.lint ? 'npm run lint' : undefined,
        };
      } catch {
        return { language: 'JavaScript' };
      }
    }

    if (fs.existsSync(path.join(folderPath, 'Cargo.toml'))) {
      return {
        language: 'Rust',
        testCommand: 'cargo test',
        buildCommand: 'cargo build',
        lintCommand: 'cargo clippy',
      };
    }

    if (fs.existsSync(path.join(folderPath, 'go.mod'))) {
      return {
        language: 'Go',
        testCommand: 'go test ./...',
        buildCommand: 'go build ./...',
        lintCommand: 'golangci-lint run',
      };
    }

    if (
      fs.existsSync(path.join(folderPath, 'pyproject.toml')) ||
      fs.existsSync(path.join(folderPath, 'requirements.txt')) ||
      fs.existsSync(path.join(folderPath, 'setup.py'))
    ) {
      return {
        language: 'Python',
        testCommand: fs.existsSync(path.join(folderPath, 'tests')) ? 'pytest' : undefined,
        lintCommand: 'flake8',
      };
    }

    if (fs.existsSync(path.join(folderPath, 'pom.xml'))) {
      return {
        language: 'Java',
        testCommand: 'mvn test',
        buildCommand: 'mvn package -DskipTests',
      };
    }

    if (fs.existsSync(path.join(folderPath, 'CMakeLists.txt'))) {
      return {
        language: 'C++',
        buildCommand: 'cmake --build build',
        testCommand: 'ctest --test-dir build',
      };
    }

    return {
      language: 'Unknown',
    };
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      language: row.language,
      gitBranch: row.git_branch || undefined,
      testCommand: row.test_command || undefined,
      buildCommand: row.build_command || undefined,
      lintCommand: row.lint_command || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
