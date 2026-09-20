import React, { useState } from 'react';
import {
  ShieldCheck,
  Clock,
  Code2,
  Video,
  AlertTriangle,
  Monitor,
  ArrowRight,
} from 'lucide-react';
import { MockOAPayload } from '../../lib/mock-oa/types';

interface InstructionsProps {
  payload: MockOAPayload;
  onProceed: () => void;
}

export const Instructions: React.FC<InstructionsProps> = ({ payload, onProceed }) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header card */}
      <div className="bg-[#FBF9F5] border border-[#1F2420]/10 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2420]/10 pb-5">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#C1592B] font-semibold">
              Proctored Mock Online Assessment
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#1F2420] mt-1">
              {payload.company} Software Engineering OA
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1F2420]/5 text-[#1F2420] text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-[#C1592B]" />
              {payload.durationMinutes} Minutes
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1F2420]/5 text-[#1F2420] text-xs font-mono">
              <Code2 className="w-3.5 h-3.5 text-[#3F8F63]" />
              {payload.problems.length} Problems
            </span>
          </div>
        </div>

        {/* Practice Environment Notice (MANDATORY REQUIREMENT) */}
        <div className="mt-5 p-4 rounded-lg bg-[#E5A83B]/10 border border-[#E5A83B]/30 text-[#1F2420] text-sm leading-relaxed">
          <p className="font-semibold text-xs font-mono uppercase text-[#B47818] mb-1">
            Proctored Practice Notice
          </p>
          <p>
            This is a proctored practice environment. Coddy runs your code in the editor; Clarity
            cannot read it yet, so you mark each problem's status yourself at submit. Automated
            grading with hidden test cases arrives with the backend.
          </p>
        </div>

        {/* Rules & Format Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-[#1F2420]/[0.02] border border-[#1F2420]/10">
            <div className="flex items-center gap-2 mb-2 text-[#1F2420] font-medium text-sm">
              <Monitor className="w-4 h-4 text-[#C1592B]" />
              <span>Session Format</span>
            </div>
            <ul className="text-xs text-[#1F2420]/80 space-y-1.5 leading-normal">
              <li>• <strong>2 algorithmic problems:</strong> Balanced Shipments &amp; Prefix Autocomplete.</li>
              <li>• <strong>Standard I/O:</strong> Read from stdin, print to stdout.</li>
              <li>• <strong>Supported languages:</strong> Python 3, Java, C++.</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-[#1F2420]/[0.02] border border-[#1F2420]/10">
            <div className="flex items-center gap-2 mb-2 text-[#1F2420] font-medium text-sm">
              <Video className="w-4 h-4 text-[#C1592B]" />
              <span>Proctoring &amp; Recording</span>
            </div>
            <ul className="text-xs text-[#1F2420]/80 space-y-1.5 leading-normal">
              <li>• <strong>Full screen capture:</strong> Entire display monitor recording required.</li>
              <li>• <strong>No camera or microphone:</strong> Audio/webcam are never accessed.</li>
              <li>• <strong>Stored locally:</strong> Recorded video remains on your device (IndexedDB).</li>
            </ul>
          </div>
        </div>

        {/* Violations and Rules */}
        <div className="mt-5 p-4 rounded-lg bg-[#1F2420]/[0.03] border border-[#1F2420]/10 text-xs text-[#1F2420]/85 space-y-2">
          <div className="flex items-center gap-2 font-medium text-[#1F2420]">
            <AlertTriangle className="w-4 h-4 text-[#C1592B]" />
            <span>Strict Integrity Rules (Max 3 Violations)</span>
          </div>
          <p className="leading-relaxed">
            The assessment runs in <strong>mandatory fullscreen mode</strong>. Switching browser tabs,
            minimizing the window, exiting fullscreen, or terminating screen sharing will log a
            proctoring violation. Reaching <strong>3 violations</strong> triggers automatic submission.
          </p>
          <p className="text-[11px] text-[#1F2420]/60 italic">
            * Practice proctoring: designed for realism, not a security guarantee. Copy/paste and
            right-click operations inside the embedded Coddy editor are isolated within the sandbox
            and cannot be restricted from the host page.
          </p>
        </div>

        {/* Consent Checkbox */}
        <div className="mt-6 pt-5 border-t border-[#1F2420]/10">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              id="consent-checkbox"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded-sm border-[#1F2420]/30 text-[#C1592B] focus:ring-[#C1592B] cursor-pointer"
            />
            <span className="text-sm text-[#1F2420] leading-snug">
              I understand the proctoring rules, screen recording requirements, and practice assessment
              terms. I am ready to conduct my pre-flight browser checks.
            </span>
          </label>
        </div>

        {/* Action Button */}
        <div className="mt-6 flex justify-end">
          <button
            id="btn-proceed-preflight"
            type="button"
            disabled={!agreed}
            onClick={onProceed}
            className={`px-6 py-3 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
              agreed
                ? 'bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] cursor-pointer shadow-md'
                : 'bg-[#1F2420]/20 text-[#FAF6F0]/60 cursor-not-allowed'
            }`}
          >
            <span>Proceed to System Check</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
