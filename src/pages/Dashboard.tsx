import React, { useState } from 'react';
import { Project, Task, RunEvent, SubscriptionSettings, ProviderStatus } from '../types';
import { StatusBadge, CategoryBadge } from '../components/TaskBadge';
import { LiveLogs } from '../components/LiveLogs';
import { Send, Sliders, ChevronRight, PlayCircle, FolderOpen } from 'lucide-react';

interface DashboardProps {
  project: Project | null;
  onOpenProject: () => void;
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onCreateTask: (prompt: string, manualModel?: string) => Promise<void>;
  events: RunEvent[];
  settings: SubscriptionSettings;
  providers: ProviderStatus[];
}

export const Dashboard: React.FC<DashboardProps> = ({
  project,
  onOpenProject,
  tasks,
  onSelectTask,
  onCreateTask,
  events,
  settings,
  providers,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  // Discover models dynamically from connected providers
  const onlineProviders = providers.filter(
    (p) => p.installed && p.availableModels && p.availableModels.length > 0
  );
  const allDiscoveredModels = onlineProviders.flatMap((p) =>
    p.availableModels.map((m) => ({ id: m, providerName: p.name }))
  );

  const [selectedModel, setSelectedModel] = useState(
    settings?.manualModel || (allDiscoveredModels[0]?.id ?? 'gpt-6.1-sol')
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !project || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateTask(prompt.trim(), mode === 'manual' ? selectedModel : undefined);
      setPrompt('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTask = tasks.find((t) =>
    ['analyzing', 'running', 'validating', 'escalating', 'retrying'].includes(t.status)
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* Left Column: Task Creator & Queue */}
      <div className="w-full md:w-1/2 flex flex-col border-r border-zinc-800 bg-zinc-950/60 p-4 overflow-y-auto">
        {!project ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-zinc-800 rounded-lg bg-zinc-900/20">
            <FolderOpen className="w-10 h-10 text-zinc-500 mb-3" />
            <h3 className="text-sm font-medium text-zinc-200 mb-1">No Local Project Selected</h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-4">
              Select a repository or workspace folder to begin dispatching and validating coding tasks.
            </p>
            <button
              onClick={onOpenProject}
              className="px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              Select Project Directory
            </button>
          </div>
        ) : (
          <>
            {/* Task Prompt Input Box */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 mb-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-medium text-zinc-200">Dispatch Task</span>

                {/* Routing Mode Toggle */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-zinc-950 rounded p-0.5 border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setMode('auto')}
                      className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                        mode === 'auto' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Auto Route
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('manual')}
                      className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                        mode === 'manual' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Manual
                    </button>
                  </div>
                </div>
              </div>

              {/* Manual Model Selector (Shown when mode is manual) */}
              {mode === 'manual' && (
                <div className="flex items-center gap-2 py-1 px-2 rounded bg-zinc-950 border border-zinc-800/80 text-xs">
                  <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-zinc-500">Model:</span>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-transparent text-zinc-200 text-xs focus:outline-none flex-1 font-mono"
                  >
                    {onlineProviders.length === 0 ? (
                      <option value="gpt-6.1-sol" className="bg-zinc-900">
                        gpt-6.1-sol (Default)
                      </option>
                    ) : (
                      onlineProviders.map((prov) => (
                        <optgroup
                          key={prov.id}
                          label={prov.name}
                          className="bg-zinc-900 text-zinc-400 font-sans"
                        >
                          {prov.availableModels.map((modelId) => (
                            <option
                              key={modelId}
                              value={modelId}
                              className="bg-zinc-900 text-zinc-200 font-mono"
                            >
                              {modelId}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    )}
                  </select>
                </div>
              )}

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your coding task, bug fix, refactor, or asset requirement..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 resize-none font-sans"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSubmit(e);
                  }
                }}
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-600">Press Ctrl+Enter to submit</span>
                <button
                  type="submit"
                  disabled={!prompt.trim() || isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-medium transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>{isSubmitting ? 'Dispatching...' : 'Dispatch'}</span>
                </button>
              </div>
            </form>

            {/* Task Queue Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Task Queue ({tasks.length})
              </span>
              {activeTask && (
                <span className="flex items-center gap-1.5 text-xs text-blue-400 font-mono">
                  <PlayCircle className="w-3.5 h-3.5 animate-spin" />
                  Active: {activeTask.status}
                </span>
              )}
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {tasks.length === 0 ? (
                <div className="p-6 text-center text-zinc-600 text-xs italic">
                  No tasks dispatched yet. Enter a prompt above.
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700/80 transition-all cursor-pointer group flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={task.status} />
                        {task.assessment?.category && (
                          <CategoryBadge category={task.assessment.category} />
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {new Date(task.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-200 line-clamp-2 leading-relaxed">
                      {task.prompt}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/40 font-mono">
                      <span>
                        Complexity: {task.assessment?.complexity ?? 0}/100
                      </span>
                      <div className="flex items-center text-zinc-400 group-hover:text-zinc-200">
                        <span>Details</span>
                        <ChevronRight className="w-3 h-3 ml-0.5" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Right Column: Live Logs Console & Active Executor Info */}
      <div className="w-full md:w-1/2 flex flex-col p-4 bg-zinc-950 overflow-hidden">
        <LiveLogs events={events} isRunning={!!activeTask} />
      </div>
    </div>
  );
};
