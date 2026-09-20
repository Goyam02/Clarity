import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, RefreshCw, Zap, Mic, ExternalLink, TrendingUp, Globe, Library,
  FileText, Braces, Target, Timer,
} from 'lucide-react';
import {
  codeRedApi, CodeRedState, CodeRedTask, ClearScoreComponents,
} from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';

const SOURCE_META: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  company_corpus: {
    icon: <Library className="w-3 h-3" />, label: 'company',
    className: 'bg-[#C1592B]/15 text-[#E8956B] border-[#C1592B]/40',
  },
  web: {
    icon: <Globe className="w-3 h-3" />, label: 'web',
    className: 'bg-[#5B8DEF]/15 text-[#8FB3F5] border-[#5B8DEF]/40',
  },
  jd_profile: {
    icon: <FileText className="w-3 h-3" />, label: 'jd',
    className: 'bg-[#E5A83B]/15 text-[#F0C87E] border-[#E5A83B]/40',
  },
  mastery_diff: {
    icon: <Target className="w-3 h-3" />, label: 'weak spot',
    className: 'bg-[#B8322A]/20 text-[#FF9C92] border-[#B8322A]/45',
  },
  planner: {
    icon: <Braces className="w-3 h-3" />, label: 'core',
    className: 'bg-[#5B6B4D]/25 text-[#A9BD97] border-[#5B6B4D]/50',
  },
};

function useCountdown(endsAt: number | null): string {
  return useMemo(() => {
    if (!endsAt) return '';
    const tick = () => {
      const left = Math.max(0, endsAt - Date.now());
      const h = Math.floor(left / 3_600_000);
      const m = Math.floor((left % 3_600_000) / 60_000);
      return `${h}h ${String(m).padStart(2, '0')}m remaining`;
    };
    return tick();
  }, [endsAt]);
}

export const CodeRedSessionPage: React.FC = () => {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState<CodeRedState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  // Load session state; refetch helper for reloads after toggles.
  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const s = await codeRedApi.get(sessionId);
      setState(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useState(() => { void load(); });

  React.useEffect(() => { void load(); }, [load]);

  const toggleTask = useCallback(async (task: CodeRedTask) => {
    if (!state) return;
    setBusyTaskId(task.id);
    try {
      const next = await codeRedApi.setTaskStatus(
        sessionId, task.id, task.status === 'done' ? 'pending' : 'done');
      setState(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update task.');
    } finally {
      setBusyTaskId(null);
    }
  }, [state, sessionId]);

  const startMock = useCallback(async () => {
    try {
      await codeRedApi.startMockOA(sessionId);
      navigate('/mock-oa');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start the locked environment.');
    }
  }, [sessionId, navigate]);

  const remaining = useMemo(() => {
    if (!state) return 0;
    return state.tasks.filter((t) => t.status !== 'done')
      .reduce((acc, t) => acc + (t.duration_minutes || 0), 0);
  }, [state]);

  const doneCount = useMemo(
    () => state?.tasks.filter((t) => t.status === 'done').length ?? 0, [state]);

  const score: number | null = state?.clear_score?.score ?? null;
  const components: ClearScoreComponents | null = state?.clear_score?.components ?? null;
  const countdown = useCountdown(null);

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-[#17150F] text-[#EDE8DD] flex flex-col items-center justify-center gap-3 font-mono text-[13px]">
        <RefreshCw className="w-5 h-5 animate-spin text-[#C1592B]" />
        <span className="text-[#EDE8DD]/60">Diffing your graph against the company bar...</span>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen bg-[#17150F] text-[#EDE8DD] flex flex-col items-center justify-center px-6">
        <AlertTriangle className="w-8 h-8 text-[#FF6B5E] mb-3" />
        <p className="text-[14px] text-[#FFB4AC] mb-5 text-center max-w-md">{error}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void load()}
            className="px-4 py-2 rounded-[6px] bg-[#B8322A] hover:bg-[#C9402F] text-[13px] font-medium cursor-pointer"
          >
            Retry
          </button>
          <Link to="/code-red" className="text-[13px] text-[#EDE8DD]/60 hover:text-[#EDE8DD]">
            New session
          </Link>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const isInterview = state.round_type?.toLowerCase() === 'interview';

  return (
    <div className="min-h-screen bg-[#17150F] text-[#EDE8DD] flex flex-col font-sans selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Header: session identity + live CLEAR SCORE */}
      <header className="sticky top-0 z-30 border-b border-[#EDE8DD]/10 bg-[#17150F]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-[12px] font-mono text-[#EDE8DD]/50 hover:text-[#EDE8DD] transition-colors"
            >
              Exit
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#B8322A]/25 border border-[#B8322A]/50 text-[#FF6B5E] text-[10px] font-bold tracking-widest">
                  <Zap className="w-3 h-3" />
                  CODE RED
                </span>
                <h1
                  className="text-[17px] font-semibold tracking-tight"
                  style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
                >
                  {state.company} {isInterview ? 'Interview' : 'OA'}
                </h1>
              </div>
              <p className="text-[11.5px] font-mono text-[#EDE8DD]/45 mt-0.5 flex items-center gap-1.5">
                <Timer className="w-3 h-3" />
                {state.time_available_minutes}m budget · {remaining}m of work left {countdown && `· ${countdown}`}
              </p>
            </div>
          </div>

          {/* CLEAR SCORE — the number that should move live in any demo */}
          <div className="flex items-center gap-3">
            {score !== null && (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-[10px] bg-[#1F1C15] border border-[#EDE8DD]/12">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#EDE8DD]/50">
                  Clear Score
                </span>
                <span className="text-[26px] font-bold leading-none tabular-nums">
                  {Math.round(score * (score <= 1 ? 100 : 1))}
                  <span className="text-[12px] text-[#EDE8DD]/45 font-normal">%</span>
                </span>
                <TrendingUp className="w-4 h-4 text-[#6FBF8E]" />
              </div>
            )}
          </div>
        </div>

        {/* Score component bar */}
        {components && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[10.5px] font-mono text-[#EDE8DD]/45">
            {([['target_mastery', 'Target mastery'], ['recent_performance', 'Recent perf'],
               ['company_alignment', 'Company fit'], ['timed_performance', 'Timed'],
               ['core_cs', 'Core CS']] as const).map(([k, label]) => (
              <span key={k}>
                {label}:{' '}
                <strong className="text-[#EDE8DD]/75 tabular-nums">
                  {Math.round((components[k] ?? 0) * (components[k] <= 1 ? 100 : 1))}
                </strong>
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Drift warning */}
      {state.drift?.stale && (
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="p-3 rounded-[8px] bg-[#E5A83B]/10 border border-[#E5A83B]/30 flex items-start gap-2.5 text-[12.5px] text-[#F0C87E]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{state.drift.message || 'Company intel may be stale — verify before relying on it.'}</span>
          </div>
        </div>
      )}

      {/* Checklist */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-3">
        {error && (
          <div className="p-3 rounded-[8px] bg-[#B8322A]/15 border border-[#B8322A]/40 text-[12.5px] text-[#FFB4AC]">
            {error}
          </div>
        )}

        {state.tasks.length === 0 && (
          <div className="p-8 text-center text-[13.5px] text-[#EDE8DD]/50 font-mono">
            No checklist items — try a longer time budget or add a JD.
          </div>
        )}

        {state.tasks.map((task, idx) => {
          const done = task.status === 'done';
          const meta = SOURCE_META[task.detail?.source || 'planner'] || SOURCE_META.planner;
          return (
            <div
              key={task.id}
              className={`group flex items-start gap-3.5 p-4 rounded-[12px] border transition-all ${
                done
                  ? 'bg-[#1F1C15]/60 border-[#5B6B4D]/30 opacity-60'
                  : 'bg-[#1F1C15] border-[#EDE8DD]/10 hover:border-[#C1592B]/40'
              }`}
            >
              <button
                type="button"
                onClick={() => void toggleTask(task)}
                disabled={busyTaskId === task.id}
                aria-label={done ? 'Mark as not done' : 'Mark as done'}
                className="mt-0.5 shrink-0 cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/60 rounded-full"
              >
                {done ? (
                  <RefreshCw className="w-5 h-5 text-[#6FBF8E]" />
                ) : (
                  <span className="block w-5 h-5 rounded-full border-2 border-[#EDE8DD]/30 group-hover:border-[#C1592B] transition-colors" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-[14.5px] leading-snug ${done ? 'line-through text-[#EDE8DD]/50' : ''}`}>
                    <span className="font-mono text-[11px] text-[#EDE8DD]/35 mr-2">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    {task.title}
                  </p>
                  <span className="shrink-0 text-[11.5px] font-mono text-[#EDE8DD]/45 tabular-nums">
                    {task.duration_minutes}min
                  </span>
                </div>

                {/* why-tag + citation — the labeling that makes it feel intelligent */}
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border text-[10px] font-mono font-semibold uppercase tracking-wider ${meta.className}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  {task.detail?.citation && (
                    <a
                      href={String(task.detail.citation)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[#8FB3F5] hover:underline"
                    >
                      source
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  {task.type === 'explain_back' && (
                    <span className="text-[10.5px] font-mono text-[#EDE8DD]/40 uppercase">
                      explain-it-back
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Final launcher */}
        <div className="mt-4 pt-5 border-t border-[#EDE8DD]/10">
          <button
            type="button"
            onClick={() => void startMock()}
            className={`w-full h-12 flex items-center justify-center gap-2.5 rounded-[6px] text-[15px] font-semibold transition-all shadow-[0_4px_20px_rgba(184,50,42,0.35)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C1592B] focus:ring-offset-2 focus:ring-offset-[#17150F] ${
              doneCount > 0
                ? 'bg-[#B8322A] hover:bg-[#C9402F] text-[#FAF6F0]'
                : 'bg-[#B8322A]/60 hover:bg-[#B8322A] text-[#FAF6F0]'
            }`}
          >
            {isInterview ? <Mic className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            <span>{isInterview ? 'Start Mock Interview' : 'Start Mock OA'}</span>
          </button>
          <p className="mt-2 text-center text-[11.5px] font-mono text-[#EDE8DD]/35">
            {doneCount}/{state.tasks.length} checklist items done · locked environment sized to time remaining
          </p>
        </div>
      </main>
    </div>
  );
};
