import React, { useState, useEffect } from 'react';
import { StatisticsOverview } from '../types';
import {
  BarChart3,
  Cpu,
  RefreshCw,
  Zap,
} from 'lucide-react';

export const Statistics: React.FC = () => {
  const [stats, setStats] = useState<StatisticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await window.acrApi.getStatistics();
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-zinc-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-xs">Loading analytics...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-zinc-400">
        <span className="text-xs">Unable to load metrics</span>
      </div>
    );
  }

  const totalProviderRuns = (stats.providerUsage.google || 0) + (stats.providerUsage.openai || 0);
  const googlePct =
    totalProviderRuns > 0 ? Math.round((stats.providerUsage.google / totalProviderRuns) * 100) : 0;
  const openaiPct = totalProviderRuns > 0 ? 100 - googlePct : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Routing & Performance Analytics
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Resource conservation and model accuracy telemetry across local executions.
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
            Total Tasks
          </span>
          <div className="text-xl font-bold font-mono text-zinc-100">{stats.totalTasks}</div>
          <span className="text-[10px] text-zinc-500">Processed in queue</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
            First-Pass Win
          </span>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {stats.firstPassSuccessRate}%
          </div>
          <span className="text-[10px] text-zinc-500">No escalation needed</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
            Validated Pass
          </span>
          <div className="text-xl font-bold font-mono text-blue-400">
            {stats.validatedCompletionRate}%
          </div>
          <span className="text-[10px] text-zinc-500">Passed test/diff suite</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
            Escalation Rate
          </span>
          <div className="text-xl font-bold font-mono text-purple-400">
            {stats.escalationRate}%
          </div>
          <span className="text-[10px] text-zinc-500">Required model step-up</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
            Median Runtime
          </span>
          <div className="text-xl font-bold font-mono text-zinc-200">
            {stats.medianDurationSec}s
          </div>
          <span className="text-[10px] text-zinc-500">Execution latency</span>
        </div>

        <div className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide">
            Avg Attempts
          </span>
          <div className="text-xl font-bold font-mono text-zinc-200">{stats.attemptsPerTask}</div>
          <span className="text-[10px] text-zinc-500">Per dispatched task</span>
        </div>
      </div>

      {/* Provider Quota Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Provider Split */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-zinc-400" />
              Provider Execution Distribution
            </span>
            <span className="text-xs font-mono text-zinc-500">{totalProviderRuns} total runs</span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1">
                <span>Google Gemini ({stats.providerUsage.google} runs)</span>
                <span>{googlePct}%</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${googlePct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1">
                <span>OpenAI Codex ({stats.providerUsage.openai} runs)</span>
                <span>{openaiPct}%</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${openaiPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quota & Ultra Reserve Alert */}
        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Quota & Heavy Model Protection
            </span>
            <span className="text-xs font-mono text-amber-400 font-medium">
              {stats.ultraUsage} Sol Ultra runs
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            OpenAI subscription limits apply across ChatGPT web and Codex CLI simultaneously. The
            router prioritizes Gemini 3.8 and lightweight Sol models to prevent rate-limit
            exhaustion.
          </p>

          <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">Sol Ultra Escalations:</span>
            <span className="text-zinc-200 font-bold">{stats.ultraUsage} invocations</span>
          </div>
        </div>
      </div>

      {/* Category Performance Breakdown Table */}
      <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-3">
        <span className="text-xs font-semibold text-zinc-200 block">
          Task Category Success Rates
        </span>

        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 font-mono text-[11px]">
              <tr>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3">Total Tasks</th>
                <th className="py-2 px-3">Validated Passed</th>
                <th className="py-2 px-3">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 font-mono text-zinc-300">
              {Object.keys(stats.categorySuccess).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-zinc-600 italic">
                    No categorical data available yet.
                  </td>
                </tr>
              ) : (
                Object.entries(stats.categorySuccess).map(([cat, data]) => {
                  const rate = data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0;
                  return (
                    <tr key={cat} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-2 px-3 font-sans font-medium text-zinc-200">{cat}</td>
                      <td className="py-2 px-3">{data.total}</td>
                      <td className="py-2 px-3 text-emerald-400">{data.passed}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                            <div
                              className="bg-blue-500 h-full rounded-full"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-[11px]">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
