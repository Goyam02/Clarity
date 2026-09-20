import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, AlertTriangle, ArrowLeft, Sparkles, Compass } from 'lucide-react';
import { interviewsApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';

interface DebriefData {
  correctness: number;
  communication_quality: number | null;
  mastery_deltas: unknown[];
}

/** Debrief screen (spec §6b): scores + graph nodes visibly updating, same screen. */
export const CodeRedDebriefPage: React.FC = () => {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<DebriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await interviewsApi.debrief(sessionId);
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load the debrief.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#17150F] text-[#EDE8DD] flex flex-col items-center justify-center gap-3 font-mono text-[13px]">
        <RefreshCw className="w-5 h-5 animate-spin text-[#C1592B]" />
        <span className="text-[#EDE8DD]/60">The Evaluator is grading your session...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#17150F] text-[#EDE8DD] flex flex-col items-center justify-center px-6">
        <AlertTriangle className="w-8 h-8 text-[#FF6B5E] mb-3" />
        <p className="text-[14px] text-[#FFB4AC] mb-5 text-center max-w-md">{error}</p>
        <Link to="/dashboard" className="text-[13px] text-[#EDE8DD]/60 hover:text-[#EDE8DD]">
          Back to Home
        </Link>
      </div>
    );
  }

  const correctnessPct = Math.round((data?.correctness ?? 0) * 100);
  const commPct = data?.communication_quality != null
    ? Math.round(data.communication_quality * 100) : null;

  return (
    <div className="min-h-screen bg-[#17150F] text-[#EDE8DD] flex flex-col font-sans">
      <header className="px-6 py-4 border-b border-[#EDE8DD]/10 flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[#EDE8DD]/60 hover:text-[#EDE8DD]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
        <span className="text-[11px] font-mono uppercase tracking-widest text-[#EDE8DD]/40">
          Session Debrief
        </span>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1
          className="text-[30px] font-normal tracking-[-0.02em]"
          style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
        >
          Here's how it went.
        </h1>
        <p className="mt-2 text-[14px] text-[#EDE8DD]/65">
          Graded by the same Evaluator that coaches you daily — same signals, same graph.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-[12px] bg-[#1F1C15] border border-[#EDE8DD]/10">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#EDE8DD]/50">
              Correctness
            </span>
            <div className="mt-1 text-[38px] font-bold leading-none tabular-nums">
              {correctnessPct}
              <span className="text-[15px] text-[#EDE8DD]/45 font-normal">%</span>
            </div>
          </div>
          <div className="p-5 rounded-[12px] bg-[#1F1C15] border border-[#EDE8DD]/10">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#EDE8DD]/50">
              Communication clarity
            </span>
            <div className="mt-1 text-[38px] font-bold leading-none tabular-nums">
              {commPct != null ? commPct : '—'}
              {commPct != null && <span className="text-[15px] text-[#EDE8DD]/45 font-normal">%</span>}
            </div>
          </div>
        </div>

        {/* Graph loop-closer */}
        <div className="mt-6 p-5 rounded-[12px] bg-[#1F1C15] border border-[#EDE8DD]/10">
          <div className="flex items-center gap-2 mb-3">
            <Compass className="w-4 h-4 text-[#E5A83B]" />
            <span className="text-[13px] font-semibold">Mastery graph updated</span>
          </div>
          <p className="text-[13px] text-[#EDE8DD]/65 leading-relaxed">
            {(data?.mastery_deltas?.length ?? 0) > 0
              ? `${data!.mastery_deltas.length} node(s) moved from this session. Open the graph to see the new colors.`
              : 'This session did not move any nodes yet — complete more of the checklist next time.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/graph')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#C1592B] hover:bg-[#D0653A] text-[13px] font-medium cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            See the graph
          </button>
        </div>
      </main>
    </div>
  );
};
