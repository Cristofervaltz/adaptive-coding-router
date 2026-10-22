import React, { useState, useEffect, useRef } from 'react';
import { RunEvent } from '../types';
import { Terminal, Search, Trash2, ArrowDown } from 'lucide-react';

interface LiveLogsProps {
  events: RunEvent[];
  onClear?: () => void;
  isRunning?: boolean;
}

export const LiveLogs: React.FC<LiveLogsProps> = ({ events, onClear, isRunning }) => {
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const filtered = events.filter((e) =>
    e.payload.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Console Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/80 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-2 text-zinc-300 font-mono">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          <span>Execution Log</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[11px] text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="w-3 h-3 absolute left-2 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded pl-7 pr-2 py-0.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-36"
            />
          </div>

          {/* Autoscroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1 rounded border ${autoScroll ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-transparent border-zinc-800 text-zinc-500'}`}
            title="Auto-scroll"
          >
            <ArrowDown className="w-3 h-3" />
          </button>

          {/* Clear button */}
          {onClear && (
            <button
              onClick={onClear}
              className="p-1 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Log Output Area */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed select-text space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-zinc-600 italic py-4 text-center">No logs recorded yet.</div>
        ) : (
          filtered.map((ev, i) => {
            const timeStr = new Date(ev.timestamp).toLocaleTimeString();
            let textColor = 'text-zinc-300';

            if (ev.eventType === 'stderr' || ev.eventType === 'error') {
              textColor = 'text-rose-400';
            } else if (ev.eventType === 'status') {
              textColor = 'text-cyan-400';
            } else if (ev.payload.includes('[EscalationManager]')) {
              textColor = 'text-purple-400 font-semibold';
            }

            return (
              <div key={ev.id || i} className="flex items-start gap-2 group hover:bg-zinc-900/50 px-1 py-0.5 rounded">
                <span className="text-zinc-600 shrink-0 select-none">{timeStr}</span>
                <span className="text-zinc-500 shrink-0 select-none">[{ev.eventType}]</span>
                <span className={`${textColor} break-all whitespace-pre-wrap`}>{ev.payload}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
