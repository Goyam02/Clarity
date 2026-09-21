import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  ShieldAlert,
  Send,
  Radio,
} from 'lucide-react';
import { MockOAProblem, ProblemSubmissionStatus } from '../../lib/mock-oa/types';

interface ExamTopBarProps {
  company: string;
  endsAt: number;
  problems: MockOAProblem[];
  activeProblemId: string;
  problemStatuses: Record<string, ProblemSubmissionStatus>;
  violationsCount: number;
  maxViolations: number;
  onSelectProblem: (id: string) => void;
  onSubmitClick: () => void;
  onTimeout: () => void;
}

export const ExamTopBar: React.FC<ExamTopBarProps> = ({
  company,
  endsAt,
  problems,
  activeProblemId,
  problemStatuses,
  violationsCount,
  maxViolations,
  onSelectProblem,
  onSubmitClick,
  onTimeout,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() => Math.max(0, endsAt - Date.now()));
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>('');
  const announced10MinRef = useRef(false);
  const announced1MinRef = useRef(false);

  useEffect(() => {
    const updateTimer = () => {
      const diff = Math.max(0, endsAt - Date.now());
      setRemainingMs(diff);

      const minutesLeft = Math.floor(diff / 60000);

      // 10-minute aria-live announcement
      if (minutesLeft === 10 && !announced10MinRef.current) {
        announced10MinRef.current = true;
        setAriaAnnouncement('Ten minutes remaining in the online assessment.');
      }

      // 1-minute aria-live announcement
      if (minutesLeft === 1 && !announced1MinRef.current) {
        announced1MinRef.current = true;
        setAriaAnnouncement('One minute remaining in the online assessment.');
      }

      if (diff <= 0) {
        onTimeout();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endsAt, onTimeout]);

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isLowTime = remainingMs < 5 * 60 * 1000;

  return (
    <header className="w-full bg-[#FAF6F0] border-b border-[#1F2420]/12 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Hidden aria-live region for polite timer announcements */}
      <div aria-live="polite" className="sr-only">
        {ariaAnnouncement}
      </div>

      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-serif font-medium text-lg text-[#1F2420] tracking-tight">
            Clarity
          </span>
          <span className="text-xs text-[#1F2420]/30 font-mono">/</span>
          <span className="text-xs font-mono text-[#1F2420]/70 uppercase tracking-wider">
            Mock OA
          </span>
          <span className="text-xs text-[#1F2420]/30 font-mono">/</span>
          <span className="px-2 py-0.5 rounded-sm bg-[#1F2420]/5 text-[#1F2420] text-xs font-medium">
            {company}
          </span>
        </div>
      </div>

      {/* Problem Tabs */}
      <nav aria-label="Problems navigation" className="flex items-center gap-1.5">
        {problems.map((prob, idx) => {
          const isActive = prob.id === activeProblemId;
          const status = problemStatuses[prob.id] || 'not_attempted';

          let dotColor = 'bg-[#1F2420]/25'; // unattempted
          if (status === 'solved') dotColor = 'bg-[#3F8F63]';
          if (status === 'partially_solved') dotColor = 'bg-[#E5A83B]';

          return (
            <button
              key={prob.id}
              type="button"
              id={`tab-problem-${prob.id}`}
              onClick={() => onSelectProblem(prob.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1F2420] text-[#FAF6F0] shadow-xs'
                  : 'bg-[#1F2420]/5 hover:bg-[#1F2420]/10 text-[#1F2420]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
              <span>
                P{idx + 1}: {prob.title}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Right status modules: timer, proctor indicator, violations, submit */}
      <div className="flex items-center gap-4">
        {/* Screen Recording Active Indicator */}
        <div
          id="indicator-screen-recording"
          className="flex items-center gap-1.5 text-[11px] font-mono text-[#1F2420]/75 bg-[#1F2420]/5 px-2.5 py-1 rounded-md"
        >
          <span className="w-2 h-2 rounded-full bg-[#C1592B] animate-pulse" />
          <span>Screen recording</span>
        </div>

        {/* Violations Counter */}
        <div
          id="indicator-violations"
          className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-md border ${
            violationsCount > 0
              ? 'bg-[#C1592B]/10 border-[#C1592B]/30 text-[#C1592B]'
              : 'bg-[#1F2420]/5 border-transparent text-[#1F2420]/70'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>
            {violationsCount} / {maxViolations} violations
          </span>
        </div>

        {/* Timer */}
        <div
          id="indicator-timer"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-xs font-medium border ${
            isLowTime
              ? 'bg-[#C1592B]/15 border-[#C1592B]/40 text-[#C1592B]'
              : 'bg-[#1F2420]/5 border-[#1F2420]/10 text-[#1F2420]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#C1592B]" />
          <span className="tracking-wider">{formattedTime}</span>
        </div>

        {/* Submit Button */}
        <button
          id="btn-exam-submit"
          type="button"
          onClick={onSubmitClick}
          className="px-4 py-1.5 rounded-md bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#C1592B]"
        >
          <Send className="w-3 h-3 text-[#E5A83B]" />
          <span>Submit</span>
        </button>
      </div>
    </header>
  );
};
