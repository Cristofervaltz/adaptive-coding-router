import { AppDatabase } from '../storage/database';
import { StatisticsOverview } from '../src/types';

export class StatisticsService {
  constructor(private db: AppDatabase) {}

  public getOverview(): StatisticsOverview {
    const tasks = this.db.getAllTasks();
    const runs = this.db.getAllRuns();

    const totalTasks = tasks.length;
    if (totalTasks === 0) {
      return {
        totalTasks: 0,
        firstPassSuccessRate: 0,
        validatedCompletionRate: 0,
        escalationRate: 0,
        medianDurationSec: 0,
        attemptsPerTask: 0,
        providerUsage: { google: 0, openai: 0, anthropic: 0, opencode: 0 },
        ultraUsage: 0,
        categorySuccess: {},
      };
    }

    // Map tasks to their runs
    const taskRunsMap = new Map<string, any[]>();
    for (const run of runs) {
      const list = taskRunsMap.get(run.task_id) || [];
      list.push(run);
      taskRunsMap.set(run.task_id, list);
    }

    let firstPassSuccessCount = 0;
    let validatedCompletionCount = 0;
    let escalatedTaskCount = 0;
    let totalAttempts = 0;
    const durationsSec: number[] = [];

    const categorySuccess: Record<string, { total: number; passed: number }> = {};
    let googleCount = 0;
    let openaiCount = 0;
    let anthropicCount = 0;
    let opencodeCount = 0;
    let ultraCount = 0;

    for (const task of tasks) {
      const taskRuns = taskRunsMap.get(task.id) || [];
      totalAttempts += taskRuns.length;

      let assessment: any = {};
      try {
        assessment = JSON.parse(task.assessment_json);
      } catch {
        // ignore
      }
      const cat = assessment.category || 'simple_code';
      if (!categorySuccess[cat]) {
        categorySuccess[cat] = { total: 0, passed: 0 };
      }
      categorySuccess[cat].total += 1;

      if (task.status === 'completed' || task.status === 'awaiting_approval') {
        validatedCompletionCount += 1;
        categorySuccess[cat].passed += 1;

        if (taskRuns.length === 1) {
          firstPassSuccessCount += 1;
        }
      }

      if (taskRuns.length > 1) {
        escalatedTaskCount += 1;
      }

      for (const run of taskRuns) {
        if (run.provider === 'gemini') googleCount += 1;
        else if (run.provider === 'claude') anthropicCount += 1;
        else if (run.provider === 'opencode') opencodeCount += 1;
        else openaiCount += 1;

        if (run.model && run.model.includes('Ultra')) {
          ultraCount += 1;
        }

        if (run.started_at && run.ended_at) {
          const dur = (new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 1000;
          if (dur > 0) durationsSec.push(dur);
        }
      }
    }

    durationsSec.sort((a, b) => a - b);
    const medianDurationSec =
      durationsSec.length > 0 ? durationsSec[Math.floor(durationsSec.length / 2)] : 0;

    return {
      totalTasks,
      firstPassSuccessRate: Math.round((firstPassSuccessCount / totalTasks) * 100),
      validatedCompletionRate: Math.round((validatedCompletionCount / totalTasks) * 100),
      escalationRate: Math.round((escalatedTaskCount / totalTasks) * 100),
      medianDurationSec: Math.round(medianDurationSec),
      attemptsPerTask: Number((totalAttempts / totalTasks).toFixed(1)),
      providerUsage: {
        google: googleCount,
        openai: openaiCount,
        anthropic: anthropicCount,
        opencode: opencodeCount,
      },
      ultraUsage: ultraCount,
      categorySuccess,
    };
  }

  public recordRating(taskId: string, score: number, feedback?: string): void {
    const id = `rating_${taskId}_${Date.now()}`;
    this.db.insertRating(id, taskId, score, feedback);
  }
}
