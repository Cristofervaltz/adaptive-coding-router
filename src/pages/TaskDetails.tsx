import React, { useState, useEffect, useCallback } from 'react';
import { Task, Run, RunEvent, ValidationResult, GitDiffSummary } from '../types';
import { StatusBadge, CategoryBadge } from '../components/TaskBadge';
import { DiffViewer } from '../components/DiffViewer';
import { LiveLogs } from '../components/LiveLogs';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Square,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Cpu,
  Layers,
  Star,
  RefreshCw,
} from 'lucide-react';

interface TaskDetailsProps {
  taskId: string;
  onBack: () => void;
}

export const TaskDetails: React.FC<TaskDetailsProps> = ({ taskId, onBack }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [diff, setDiff] = useState<GitDiffSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'diff' | 'logs'>('diff');
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [ratingSubmitted, setRatingSubmitted] = useState<boolean>(false);

  const fetchDetails = useCallback(async () => {
    if (!window.acrApi) {
      setLoading(false);
      return;
    }
    try {
      const details = await window.acrApi.getTaskDetails(taskId);
      if (details) {
        setTask(details.task);
        setRuns(details.runs || []);
        setEvents(details.events || []);
        setValidations(details.validations || []);
        setDiff(details.diff);
        if (details.task.rating) {
          setRating(details.task.rating);
          setRatingSubmitted(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchDetails();

    if (!window.acrApi) return;

    const unsubStatus = window.acrApi.onTaskStatusChanged((data) => {
      if (data.taskId === taskId) {
        fetchDetails();
      }
    });

    const unsubEvent = window.acrApi.onTaskEvent((event) => {
      if (runs.some((r) => r.id === event.runId)) {
        setEvents((prev) => [...prev, event]);
      }
    });

    return () => {
      unsubStatus();
      unsubEvent();
    };
  }, [taskId, fetchDetails, runs]);

  const handleApprove = async () => {
    if (!task || isProcessing) return;
    try {
      setIsProcessing(true);
      await window.acrApi.approveTask(task.id);
      await fetchDetails();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!task || isProcessing) return;
    try {
      setIsProcessing(true);
      await window.acrApi.rejectTask(task.id);
      await fetchDetails();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!task || isProcessing) return;
    try {
      setIsProcessing(true);
      await window.acrApi.cancelTask(task.id);
      await fetchDetails();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = async () => {
    if (!task || isProcessing) return;
    try {
      setIsProcessing(true);
      await window.acrApi.retryTask(task.id);
      onBack();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitRating = async (value: number) => {
    if (!task) return;
    setRating(value);
    await window.acrApi.rateTask(task.id, value, feedback);
    setRatingSubmitted(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-zinc-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-xs">Loading task details...</span>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-400">
        <p className="text-sm mb-4">Task not found</p>
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded bg-zinc-800 text-xs text-zinc-200 hover:bg-zinc-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isExecuting = ['analyzing', 'running', 'validating', 'escalating', 'retrying'].includes(
    task.status
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Task Details Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-zinc-300">
              Task #{task.id.slice(0, 8)}
            </span>
            <StatusBadge status={task.status} />
            {task.assessment?.category && <CategoryBadge category={task.assessment.category} />}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {task.status === 'awaiting_approval' && (
            <>
              <button
                onClick={handleReject}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-medium transition-colors"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Reject</span>
              </button>
              <button
                onClick={handleApprove}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve & Merge</span>
              </button>
            </>
          )}

          {isExecuting && (
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-rose-300 text-xs font-medium transition-colors"
            >
              <Square className="w-3 h-3 text-rose-400" />
              <span>Cancel Task</span>
            </button>
          )}

          {['completed', 'failed', 'cancelled'].includes(task.status) && (
            <button
              onClick={handleRetry}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span>Retry Task</span>
            </button>
          )}

          <button
            onClick={fetchDetails}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            title="Refresh details"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Metadata, Runs & Validations */}
        <div className="w-full md:w-5/12 border-r border-zinc-800 overflow-y-auto p-4 space-y-4 bg-zinc-950/40">
          {/* Prompt card */}
          <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40">
            <span className="text-[11px] font-medium text-zinc-400 block mb-1 uppercase tracking-wide">
              Task Prompt
            </span>
            <p className="text-xs text-zinc-100 whitespace-pre-wrap leading-relaxed">
              {task.prompt}
            </p>
          </div>

          {/* Assessment metrics */}
          <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2.5">
            <span className="text-[11px] font-medium text-zinc-400 block uppercase tracking-wide">
              Router Assessment
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[10px]">Complexity</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {task.assessment?.complexity ?? 0}/100
                </span>
              </div>
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[10px]">Risk Score</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {task.assessment?.risk ?? 0}/100
                </span>
              </div>
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[10px]">Confidence</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {Math.round((task.assessment?.confidence ?? 0) * 100)}%
                </span>
              </div>
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80">
                <span className="text-zinc-500 block text-[10px]">Estimated Files</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {task.assessment?.estimatedFiles ?? 1}
                </span>
              </div>
            </div>

            {task.assessment?.reasoning && (
              <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-2 rounded border border-zinc-900 leading-normal font-sans">
                {task.assessment.reasoning}
              </div>
            )}
          </div>

          {/* Execution History */}
          <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                Execution Runs ({runs.length})
              </span>
              <Cpu className="w-3.5 h-3.5 text-zinc-500" />
            </div>

            {runs.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No runs started yet.</p>
            ) : (
              <div className="space-y-2">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-zinc-400">
                          Attempt #{run.attemptNumber}
                        </span>
                        <span className="font-semibold text-zinc-200">{run.model}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                          run.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                            : run.status === 'running'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800/40'
                            : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
                      <span>Provider: {run.provider}</span>
                      {run.reasoningEffort && <span>Effort: {run.reasoningEffort}</span>}
                    </div>

                    {run.errorMessage && (
                      <div className="text-[11px] text-rose-400 bg-rose-950/20 p-1.5 rounded border border-rose-900/40 font-mono break-all">
                        {run.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Validation Checks */}
          <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                Validation Pipeline ({validations.length})
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
            </div>

            {validations.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No validation records yet.</p>
            ) : (
              <div className="space-y-1.5">
                {validations.map((val) => (
                  <div
                    key={val.id}
                    className="p-2 rounded bg-zinc-950 border border-zinc-800/80 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {val.status === 'passed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : val.status === 'failed' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      )}
                      <div>
                        <span className="font-mono font-medium text-zinc-200 uppercase text-[11px] mr-1.5">
                          {val.checkType}
                        </span>
                        <span className="text-zinc-400 text-[11px]">{val.summary}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {val.durationMs}ms
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Quality Rating */}
          <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide block">
              Result Evaluation
            </span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleSubmitRating(star)}
                  className={`p-1 rounded transition-colors ${
                    rating >= star
                      ? 'text-amber-400'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                  title={`Rate ${star} / 5`}
                >
                  <Star className="w-4 h-4 fill-current" />
                </button>
              ))}
              {ratingSubmitted && (
                <span className="text-[11px] text-emerald-400 font-medium ml-2">
                  Recorded
                </span>
              )}
            </div>
            {!ratingSubmitted && (
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  placeholder="Optional review feedback..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none"
                />
                <button
                  onClick={() => handleSubmitRating(rating || 5)}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded"
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Diff Viewer & Logs */}
        <div className="w-full md:w-7/12 flex flex-col bg-zinc-950 overflow-hidden">
          {/* Tab Selector */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800">
              <button
                onClick={() => setActiveTab('diff')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'diff'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Worktree Diff</span>
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'logs'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Task Logs ({events.length})</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-3">
            {activeTab === 'diff' ? (
              <DiffViewer diff={diff} />
            ) : (
              <LiveLogs events={events} isRunning={isExecuting} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
