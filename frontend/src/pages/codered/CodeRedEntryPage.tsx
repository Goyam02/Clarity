import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Siren, FileText, Clock, Sparkles } from 'lucide-react';
import { codeRedApi, CodeRedState } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';

/**
 * CODE RED entry (spec §6): company + JD + time + round, darker theme.
 * On submit: real "building your plan..." transition while the backend parses
 * the JD, builds company intel, and diffs the mastery model.
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
    <div className="min-h-screen bg-[#17150F] text-[#EDE8DD] flex flex-col font-sans selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-[#EDE8DD]/10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[#EDE8DD]/60 hover:text-[#EDE8DD] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B8322A]/20 border border-[#B8322A]/50 text-[#FF6B5E] text-[12px] font-bold tracking-widest">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B8322A] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#B8322A]" />
          </span>
          CODE RED
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 sm:px-6 py-10 sm:py-16">
        <div className="w-full max-w-[560px]">
          <div className="mb-8">
            <h1
              className="text-[34px] sm:text-[40px] font-normal tracking-[-0.02em] leading-tight"
              style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
            >
              This is not a normal day.
            </h1>
            <p className="mt-2 text-[14.5px] text-[#EDE8DD]/70 leading-relaxed">
              Tell the system what's coming. It diffs the company's known patterns against
              your mastery model and builds a minute-by-minute plan.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-[8px] bg-[#B8322A]/15 border border-[#B8322A]/40 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF6B5E]" />
              <div className="text-[13px] leading-snug text-[#FFB4AC]">{error}</div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="rounded-[14px] bg-[#1F1C15] border border-[#EDE8DD]/12 p-6 sm:p-8 space-y-5 shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
          >
            {/* Company */}
            <div>
              <label
                htmlFor="cr-company"
                className="block text-[12px] font-mono uppercase tracking-wider text-[#EDE8DD]/70 mb-1.5"
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
                className="w-full px-3 py-2.5 text-[15px] bg-[#14120D] border border-[#EDE8DD]/15 rounded-[6px] text-[#EDE8DD] placeholder-[#EDE8DD]/25 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/60 focus:border-[#C1592B]/40 transition-colors"
              />
            </div>

            {/* JD */}
            <div>
              <label
                htmlFor="cr-jd"
                className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-[#EDE8DD]/70 mb-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Paste the JD <span className="normal-case text-[#EDE8DD]/40">(optional but recommended)</span>
              </label>
              <textarea
                id="cr-jd"
                rows={5}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here — backend-heavy? SQL? system design mentioned? This shapes prioritization."
                className="w-full px-3 py-2.5 text-[14px] bg-[#14120D] border border-[#EDE8DD]/15 rounded-[6px] text-[#EDE8DD] placeholder-[#EDE8DD]/25 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/60 focus:border-[#C1592B]/40 transition-colors resize-y"
              />
            </div>

            {/* Time + Round row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="cr-hours"
                  className="flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-wider text-[#EDE8DD]/70 mb-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Time available
                </label>
                <select
                  id="cr-hours"
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-[15px] bg-[#14120D] border border-[#EDE8DD]/15 rounded-[6px] text-[#EDE8DD] focus:outline-none focus:ring-2 focus:ring-[#C1592B]/60 transition-colors cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10, 14].map((h) => (
                    <option key={h} value={h} className="bg-[#1F1C15]">
                      {h} hour{h > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-[12px] font-mono uppercase tracking-wider text-[#EDE8DD]/70 mb-1.5">
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
                          ? 'bg-[#C1592B] border-[#C1592B] text-[#FAF6F0] shadow-[0_2px_12px_rgba(193,89,43,0.4)]'
                          : 'bg-transparent border-[#EDE8DD]/15 text-[#EDE8DD]/60 hover:border-[#EDE8DD]/35 hover:text-[#EDE8DD]'
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
              className="w-full h-12 mt-1 flex items-center justify-center gap-2.5 rounded-[6px] bg-[#B8322A] hover:bg-[#C9402F] active:bg-[#9E2820] text-[#FAF6F0] text-[15px] font-semibold transition-all shadow-[0_4px_20px_rgba(184,50,42,0.35)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C1592B] focus:ring-offset-2 focus:ring-offset-[#1F1C15]"
            >
              {submitting ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Parsing JD, refreshing company intel, diffing your graph...</span>
                </>
              ) : (
                <>
                  <Siren className="w-4 h-4" />
                  <span>Generate my plan</span>
                </>
              )}
            </button>

            <p className="text-[11.5px] font-mono text-[#EDE8DD]/35 text-center leading-relaxed">
              Real computation: JD parse → company-intel refresh → mastery diff → planner.
              Takes a few seconds, not a fake loader.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};
