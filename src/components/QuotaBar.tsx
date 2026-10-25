import React, { useState } from 'react';
import { ProviderQuota } from '../types';
import {
  Gauge,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Infinity as InfinityIcon,
  Zap,
  CheckCircle,
  Clock,
  RefreshCw,
  User,
} from 'lucide-react';

interface QuotaBarProps {
  quotas: ProviderQuota[];
  onRefresh?: () => void;
}

export const QuotaBar: React.FC<QuotaBarProps> = ({ quotas, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);

  if (!quotas || quotas.length === 0) {
    return null;
  }

  return (
    <div className="bg-zinc-950/90 border-b border-zinc-800/80 px-4 py-2 text-xs select-none">
      {/* Top compact strip */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-zinc-300 font-medium text-[11px] uppercase tracking-wider">
            <Gauge className="w-3.5 h-3.5 text-blue-400" />
            <span>Quota & Rate Limits</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
              title="Refresh quota status"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
          <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
            (4 Connected Providers)
          </span>
        </div>

        {/* Quick Summary Chips for each provider */}
        <div className="flex items-center gap-2 flex-wrap">
          {quotas.map((pq) => {
            const isOnline = pq.isOnline;
            const primaryPool = pq.pools[0];

            return (
              <div
                key={pq.providerId}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono transition-colors ${
                  isOnline
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    : 'bg-zinc-950/50 border-zinc-900 text-zinc-600'
                }`}
              >
                <span className="font-semibold text-zinc-400">
                  {pq.providerId === 'codex'
                    ? 'Codex'
                    : pq.providerId === 'antigravity'
                    ? 'Antigravity'
                    : pq.providerId === 'claude'
                    ? 'Claude'
                    : 'OpenCode'}
                  :
                </span>

                {pq.providerId === 'codex' && primaryPool?.isUnlimited ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <InfinityIcon className="w-3 h-3" />
                    <span>$500 Pro (Unlimited)</span>
                  </span>
                ) : pq.providerId === 'codex' ? (
                  <span className="flex items-center gap-1 text-zinc-300">
                    <span>5h: {Math.max(0, (primaryPool?.total || 40) - (primaryPool?.used || 0))} left</span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-indigo-400" title="Deep Reasoning weekly pool">
                      Reasoning: {Math.max(0, (pq.pools[1]?.total || 50) - (pq.pools[1]?.used || 0))} left
                    </span>
                  </span>
                ) : pq.providerId === 'antigravity' ? (
                  <span className="flex items-center gap-1 text-zinc-300">
                    <span className="text-blue-400" title="Google Gemini Models Quota">
                      Gemini: {100 - (pq.pools[0]?.used || 0)}%
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-purple-400" title="Shared Claude & GPT Quota Pool in Antigravity">
                      Claude & GPT: {100 - (pq.pools[1]?.used || 0)}%
                    </span>
                  </span>
                ) : pq.providerId === 'claude' ? (
                  <span className="flex items-center gap-1 text-cyan-400">
                    <span>5.5 Core: {100 - (primaryPool?.used || 0)}%</span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-amber-300" title="Separate quota pool for Fable 5.5">
                      Fable: {Math.max(0, (pq.pools[1]?.total || 50) - (pq.pools[1]?.used || 0))} left
                    </span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    <span>Local 0x</span>
                  </span>
                )}
              </div>
            );
          })}

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 transition-colors ml-1"
            title={expanded ? 'Collapse quota cards' : 'Expand full quota breakdowns'}
          >
            <span>{expanded ? 'Less' : 'Details'}</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Multi-Pool Detail Cards */}
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-2.5 pt-2.5 border-t border-zinc-800/60">
          {quotas.map((pq) => (
            <div
              key={pq.providerId}
              className={`p-2.5 rounded-md border flex flex-col justify-between ${
                pq.isOnline
                  ? 'bg-zinc-900/60 border-zinc-800'
                  : 'bg-zinc-950/40 border-zinc-900 opacity-60'
              }`}
            >
              {/* Provider Header, Plan Tag & Account */}
              <div className="pb-1.5 border-b border-zinc-800/80 mb-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200 text-xs">
                    {pq.providerName}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                    {pq.tierPlan}
                  </span>
                </div>
                {(pq.accountEmail || pq.accountDetail) && (
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono mt-1">
                    <User className="w-2.5 h-2.5 text-zinc-500" />
                    <span className="truncate">{pq.accountEmail || pq.accountDetail}</span>
                  </div>
                )}
              </div>

              {/* Individual Quota Pools */}
              <div className="space-y-2">
                {pq.pools.map((pool) => {
                  const percent = pool.isUnlimited
                    ? 0
                    : Math.min(100, Math.round((pool.used / (pool.total || 1)) * 100));

                  const isFable = pool.id.includes('fable');
                  const isClaudeInAgy = pool.id.includes('antigravity_claude');
                  const isGptInAgy = pool.id.includes('antigravity_gpt');

                  return (
                    <div key={pool.id} className="text-[11px]">
                      <div className="flex items-center justify-between text-zinc-400 mb-0.5">
                        <span
                          className={`truncate flex items-center gap-1 ${
                            isFable
                              ? 'text-amber-300 font-medium'
                              : isClaudeInAgy
                              ? 'text-purple-300'
                              : isGptInAgy
                              ? 'text-emerald-300'
                              : ''
                          }`}
                        >
                          {isFable && <Sparkles className="w-3 h-3 text-amber-400" />}
                          {isClaudeInAgy && <Zap className="w-3 h-3 text-purple-400" />}
                          {pool.name}
                        </span>

                        <span className="font-mono text-[10px] text-zinc-300 ml-1">
                          {pool.isUnlimited ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                              <InfinityIcon className="w-3 h-3" />
                              Unlimited
                            </span>
                          ) : (
                            <span>{pool.statusText || `${pool.used} / ${pool.total}`}</span>
                          )}
                        </span>
                      </div>

                      {/* Progress Bar (if not unlimited) */}
                      {!pool.isUnlimited ? (
                        <div className="w-full bg-zinc-950 rounded-full h-1.5 border border-zinc-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              percent > 85
                                ? 'bg-rose-500'
                                : isFable
                                ? 'bg-amber-400'
                                : isClaudeInAgy
                                ? 'bg-purple-400'
                                : isGptInAgy
                                ? 'bg-emerald-400'
                                : percent > 60
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{pool.resetPeriod || 'Continuous execution'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
