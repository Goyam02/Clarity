import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Siren, FileText, Clock, Sparkles } from 'lucide-react';
import { codeRedApi, CodeRedState } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';

/**
 * CODE RED entry (spec §6): company + JD + time + round.
 * Restyled to match the main landing page aesthetic (cream background,
 * soft ambient glow, terracotta accents, dark charcoal text, light cards).
 */
export const CodeRedEntryPage: React.FC = () => {
  const navigate = useNavigate();

  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [hours, setHours] = useState(4);
  const [roundType, setRoundType] = useState<'OA' | 'Interview'>('OA');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = company.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const state: CodeRedState = await codeRedApi.create(
        company.trim(), jobDescription.trim(), Math.round(hours * 60), roundType);
      navigate(`/code-red/${state.session_id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 0 ? err.message
          : err.code === 'FOUNDRY_NOT_CONFIGURED'
          ? 'The AI pipeline is not configured on the backend (see docs/azure-setup.md).'
          : err.message);
      } else {
        setError('Failed to generate the plan. Please try again.');
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans relative overflow-x-hidden selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Subtle Atmospheric Ambient Glow */}
      <div
        className="absolute top-0 left-0 right-0 h-[600px] pointer-events-none overflow-hidden z-0"
        aria-hidden="true"
      >
        {/* Central Warm Orange Glow */}
        <div
          className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[380px] rounded-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(249, 115, 22, 0.22) 0%, rgba(251, 146, 60, 0.12) 45%, transparent 75%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Top-Left Soft Pale Blue Flank */}
        <div
          className="absolute top-[-100px] left-[-100px] w-[500px] h-[400px] rounded-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at 35% 35%, rgba(165, 180, 252, 0.28) 0%, rgba(147, 197, 253, 0.15) 45%, transparent 75%)',
            filter: 'blur(65px)',
          }}
        />
        {/* Top-Right Soft Pale Blue Flank */}
        <div
          className="absolute top-[-100px] right-[-100px] w-[500px] h-[400px] rounded-[50%]"
          style={{
            background:
              'radial-gradient(ellipse at 65% 35%, rgba(165, 180, 252, 0.28) 0%, rgba(147, 197, 253, 0.15) 45%, transparent 75%)',
            filter: 'blur(65px)',
          }}
        />
      </div>

      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-[#1F2420]/10 relative z-10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[#1F2420]/70 hover:text-[#1F2420] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C1592B]/10 border border-[#C1592B]/30 text-[#C1592B] text-[12px] font-bold tracking-widest">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C1592B] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C1592B]" />
          </span>
          CODE RED
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-10 sm:py-16 relative z-10">
        <div className="w-full max-w-[560px]">
          <div className="mb-8">
            <h1
              className="text-[34px] sm:text-[40px] font-normal tracking-[-0.02em] leading-tight text-[#1F2420]"
              style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
            >
              This is not a normal day.
            </h1>
            <p className="mt-2 text-[14.5px] text-[#1F2420]/70 leading-relaxed">
              Tell the system what's coming. It diffs the company's known patterns against
              your mastery model and builds a minute-by-minute plan.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-[8px] bg-[#C1592B]/10 border border-[#C1592B]/30 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#C1592B]" />
              <div className="text-[13px] leading-snug text-[#1F2420]">{error}</div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="rounded-[14px] bg-[#FDFBF7] border border-[#E8E2D8] p-6 sm:p-8 space-y-5 shadow-[0_4px_24px_rgba(28,25,23,0.06)]"
          >
            {/* Company */}
            <div>
              <label
                htmlFor="cr-company"
                className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1.5"
              >
                Company
              </label>
              <input
                id="cr-company"
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ServiceNow"
                className="w-full px-3 py-2.5 text-[15px] bg-[#FAF7F2] border border-[#E8E2D8] rounded-[6px] text-[#1F2420] placeholder-[#1F2420]/35 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50 focus:border-[#C1592B] transition-colors"
              />
            </div>

            {/* JD */}
            <div>
              <label
                htmlFor="cr-jd"
                className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-[#C1592B]" />
                Paste the JD <span className="normal-case text-[#1F2420]/40">(optional but recommended)</span>
              </label>
              <textarea
                id="cr-jd"
                rows={5}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here — backend-heavy? SQL? system design mentioned? This shapes prioritization."
                className="w-full px-3 py-2.5 text-[14px] bg-[#FAF7F2] border border-[#E8E2D8] rounded-[6px] text-[#1F2420] placeholder-[#1F2420]/35 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50 focus:border-[#C1592B] transition-colors resize-y"
              />
            </div>

            {/* Time + Round row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="cr-hours"
                  className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-[#C1592B]" />
                  Time available
                </label>
                <select
                  id="cr-hours"
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-[15px] bg-[#FAF7F2] border border-[#E8E2D8] rounded-[6px] text-[#1F2420] focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50 focus:border-[#C1592B] transition-colors cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10, 14].map((h) => (
                    <option key={h} value={h} className="bg-[#FDFBF7] text-[#1F2420]">
                      {h} hour{h > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1.5">
                  Round
                </span>
                <div className="flex items-center gap-2 h-[46px]">
                  {(['OA', 'Interview'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoundType(r)}
                      className={`px-4 py-2 rounded-[6px] text-[13.5px] font-medium border transition-all cursor-pointer ${
                        roundType === r
                          ? 'bg-[#C1592B] border-[#C1592B] text-[#FAF6F0] shadow-[0_2px_10px_rgba(193,89,43,0.25)]'
                          : 'bg-[#FAF7F2] border-[#E8E2D8] text-[#1F2420]/70 hover:border-[#1F2420]/30 hover:text-[#1F2420]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id="btn-generate-plan"
              disabled={!canSubmit}
              className="w-full h-12 mt-1 flex items-center justify-center gap-2.5 rounded-[6px] bg-[#1F2420] hover:bg-[#C1592B] active:bg-[#161a17] text-[#FAF6F0] text-[15px] font-semibold transition-all shadow-[0_2px_8px_rgba(31,36,32,0.12)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C1592B] focus:ring-offset-2 focus:ring-offset-[#FAF6F0]"
            >
              {submitting ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse text-[#FAF6F0]" />
                  <span>Parsing JD, refreshing company intel, diffing your graph...</span>
                </>
              ) : (
                <>
                  <Siren className="w-4 h-4 text-[#C1592B]" />
                  <span>Generate my plan</span>
                </>
              )}
            </button>

            <p className="text-[11.5px] font-mono text-[#1F2420]/50 text-center leading-relaxed">
              Real computation: JD parse → company-intel refresh → mastery diff → planner.
              Takes a few seconds, not a fake loader.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};

