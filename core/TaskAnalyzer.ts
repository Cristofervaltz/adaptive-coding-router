import { TaskAssessment, TaskCategory } from '../src/types';

export class TaskAnalyzer {
  public analyze(prompt: string, hasTests: boolean = false): TaskAssessment {
    const text = prompt.toLowerCase();

    // 1. Determine Category
    let category: TaskCategory = 'simple_code';
    let requiresArchitecture = false;
    let estimatedFiles = 1;

    if (this.matchesAny(text, ['3d', 'mesh', 'blender', 'texture', 'procedural asset', 'gltf', 'fbx', 'cad', 'low poly', 'model generation'])) {
      category = 'asset_generation';
      estimatedFiles = 2;
    } else if (this.matchesAny(text, ['animation', 'rigging', 'animator', 'keyframe', 'blend tree', 'skeletal', 'ik/fk'])) {
      category = 'animation';
      estimatedFiles = 2;
    } else if (this.matchesAny(text, ['ui', 'ux', 'css', 'tailwind', 'style', 'theme', 'layout', 'dashboard', 'interface', 'frontend design', 'responsive'])) {
      category = 'visual_design';
      estimatedFiles = 3;
    } else if (this.matchesAny(text, ['readme', 'docs', 'documentation', 'jsdoc', 'markdown', 'guide', 'comment'])) {
      category = 'documentation';
      estimatedFiles = 1;
    } else if (this.matchesAny(text, ['architecture', 'microservice', 'system design', 'rewrite whole', 'architect', 'data flow', 'domain layer', 'event-driven'])) {
      category = 'architecture';
      requiresArchitecture = true;
      estimatedFiles = 6;
    } else if (this.matchesAny(text, ['bug', 'fix', 'error', 'crash', 'exception', 'issue', 'memory leak', 'fail', 'stacktrace', 'reproduce'])) {
      category = 'debugging';
      estimatedFiles = 2;
    } else if (this.matchesAny(text, ['refactor', 'cleanup', 'decouple', 'extract method', 'modularize', 'dry'])) {
      category = 'refactoring';
      estimatedFiles = 4;
    } else if (this.matchesAny(text, ['concurrency', 'race condition', 'algorithm', 'parser', 'compiler', 'distributed', 'queue', 'synchronization', 'lock', 'thread'])) {
      category = 'complex_code';
      estimatedFiles = 3;
    }

    // 2. Score Complexity (0 - 100)
    let complexity = 20;

    switch (category) {
      case 'documentation':
        complexity = 15;
        break;
      case 'simple_code':
        complexity = 22;
        break;
      case 'visual_design':
        complexity = 45;
        break;
      case 'refactoring':
        complexity = 48;
        break;
      case 'debugging':
        complexity = 58;
        break;
      case 'complex_code':
        complexity = 68;
        break;
      case 'architecture':
        complexity = 82;
        break;
      case 'asset_generation':
        complexity = 80;
        break;
      case 'animation':
        complexity = 78;
        break;
    }

    // Adjust complexity based on prompt length and structural cues
    if (text.length > 300) complexity += 10;
    if (this.matchesAny(text, ['full stack', 'end-to-end', 'across all modules', 'database migration', 'breaking change'])) {
      complexity += 15;
      estimatedFiles = Math.max(estimatedFiles, 5);
      requiresArchitecture = true;
    }
    complexity = Math.min(100, Math.max(5, complexity));

    // 3. Score Risk (0 - 100)
    let risk = Math.round(complexity * 0.7);
    if (!hasTests) {
      risk = Math.min(100, risk + 15);
    }
    if (requiresArchitecture || category === 'refactoring') {
      risk = Math.min(100, risk + 15);
    }

    // 4. Preferred Capabilities
    const preferredCapabilities: string[] = [];
    if (category === 'asset_generation' || category === 'animation') {
      preferredCapabilities.push('high_spatial_reasoning', 'creative_generation');
    }
    if (category === 'architecture' || category === 'complex_code') {
      preferredCapabilities.push('deep_reasoning', 'system_level_coherence');
    }
    if (category === 'debugging') {
      preferredCapabilities.push('root_cause_analysis');
    }
    if (requiresArchitecture) {
      preferredCapabilities.push('multi_file_planning');
    }

    const confidence = 0.85;

    const reasoning = `Categorized as '${category}' (complexity: ${complexity}/100, risk: ${risk}/100, estimated files: ${estimatedFiles}). ${requiresArchitecture ? 'Architectural oversight required.' : 'Localized scope.'}`;

    return {
      category,
      complexity,
      risk,
      confidence,
      estimatedFiles,
      requiresArchitecture,
      preferredCapabilities,
      reasoning,
    };
  }

  private matchesAny(target: string, keywords: string[]): boolean {
    return keywords.some((kw) => target.includes(kw));
  }
}
