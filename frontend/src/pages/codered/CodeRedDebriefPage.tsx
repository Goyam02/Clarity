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
      <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col items-center justify-center gap-3 font-mono text-[13px]">
        <RefreshCw className="w-5 h-5 animate-spin text-[#C1592B]" />
        <span className="text-[#1F2420]/60">The Evaluator is grading your session...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col items-center justify-center px-6">
        <AlertTriangle className="w-8 h-8 text-[#C1592B] mb-3" />
        <p className="text-[14px] text-[#1F2420] mb-5 text-center max-w-md">{error}</p>
        <Link to="/dashboard" className="text-[13px] text-[#1F2420]/60 hover:text-[#1F2420]">
          Back to Home
        </Link>
      </div>
    );
  }

  const correctnessPct = Math.round((data?.correctness ?? 0) * 100);
  const commPct = data?.communication_quality != null
    ? Math.round(data.communication_quality * 100) : null;

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans relative overflow-x-hidden selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Subtle Atmospheric Ambient Glow */}
      <div
        className="absolute top-0 left-0 right-0 h-[600px] pointer-events-none overflow-hidden z-0"
        aria-hidden="true"
      >
        <div
          className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[380px] rounded-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(249, 115, 22, 0.22) 0%, rgba(251, 146, 60, 0.12) 45%, transparent 75%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute top-[-100px] left-[-100px] w-[500px] h-[400px] rounded-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at 35% 35%, rgba(165, 180, 252, 0.28) 0%, rgba(147, 197, 253, 0.15) 45%, transparent 75%)',
            filter: 'blur(65px)',
          }}
        />
      </div>

      <header className="px-6 py-4 border-b border-[#1F2420]/10 flex items-center justify-between relative z-10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[#1F2420]/60 hover:text-[#1F2420]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Home
        </Link>
        <span className="text-[11px] font-mono uppercase tracking-widest text-[#1F2420]/50">
          Session Debrief
        </span>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 relative z-10">
        <h1
          className="text-[30px] font-normal tracking-[-0.02em] text-[#1F2420]"
          style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
        >
          Here's how it went.
        </h1>
        <p className="mt-2 text-[14px] text-[#1F2420]/70">
          Graded by the same Evaluator that coaches you daily — same signals, same graph.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-[12px] bg-[#FDFBF7] border border-[#E8E2D8] shadow-xs">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#1F2420]/50">
              Correctness
            </span>
            <div className="mt-1 text-[38px] font-bold leading-none tabular-nums text-[#1F2420]">
              {correctnessPct}
              <span className="text-[15px] text-[#1F2420]/45 font-normal">%</span>
            </div>
          </div>
          <div className="p-5 rounded-[12px] bg-[#FDFBF7] border border-[#E8E2D8] shadow-xs">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#1F2420]/50">
              Communication clarity
            </span>
            <div className="mt-1 text-[38px] font-bold leading-none tabular-nums text-[#1F2420]">
              {commPct != null ? commPct : '—'}
              {commPct != null && <span className="text-[15px] text-[#1F2420]/45 font-normal">%</span>}
            </div>
          </div>
        </div>

        {/* Graph loop-closer */}
        <div className="mt-6 p-5 rounded-[12px] bg-[#FDFBF7] border border-[#E8E2D8] shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Compass className="w-4 h-4 text-[#C1592B]" />
            <span className="text-[13px] font-semibold text-[#1F2420]">Mastery graph updated</span>
          </div>
          <p className="text-[13px] text-[#1F2420]/70 leading-relaxed">
            {(data?.mastery_deltas?.length ?? 0) > 0
              ? `${data!.mastery_deltas.length} node(s) moved from this session. Open the graph to see the new colors.`
              : 'This session did not move any nodes yet — complete more of the checklist next time.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/graph')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] text-[13px] font-medium cursor-pointer transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C1592B]" />
            See the graph
          </button>
        </div>
      </main>
    </div>
  );
};
