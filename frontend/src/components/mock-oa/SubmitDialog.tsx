import React from 'react';
import {
  Send,
  X,
  CheckCircle,
  HelpCircle,
  CircleDot,
  AlertCircle,
} from 'lucide-react';
import { MockOAProblem, ProblemSubmissionStatus } from '../../lib/mock-oa/types';

interface SubmitDialogProps {
  isOpen: boolean;
  problems: MockOAProblem[];
  statuses: Record<string, ProblemSubmissionStatus>;
  onChangeStatus: (problemId: string, status: ProblemSubmissionStatus) => void;
  onConfirmSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const SubmitDialog: React.FC<SubmitDialogProps> = ({
  isOpen,
  problems,
  statuses,
  onChangeStatus,
  onConfirmSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-dialog-title"
      className="fixed inset-0 z-50 bg-[#1F2420]/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-[#FAF6F0] border border-[#1F2420]/15 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[#1F2420]/10 pb-3">
          <div>
            <h3 id="submit-dialog-title" className="text-lg font-serif font-medium text-[#1F2420]">
              Submit Mock Assessment
            </h3>
            <p className="text-xs text-[#1F2420]/60 mt-0.5">
              Self-report your completion status for each problem.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1 rounded-md text-[#1F2420]/50 hover:text-[#1F2420] hover:bg-[#1F2420]/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice */}
        <div className="p-3 bg-[#E5A83B]/10 border border-[#E5A83B]/25 rounded-md text-xs text-[#1F2420]/80">
          Clarity does not read your code inside Coddy's sandbox. Please report your implementation
          result accurately for your mastery profile.
        </div>

        {/* Problem Status Pickers */}
        <div className="space-y-3">
          {problems.map((prob, idx) => {
            const currentStatus = statuses[prob.id] || 'not_attempted';
            return (
              <div
                key={prob.id}
                className="p-3.5 rounded-lg bg-[#FBF9F5] border border-[#1F2420]/10 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-[#1F2420]">
                    P{idx + 1}: {prob.title}
                  </span>
                  <span className="text-[10px] font-mono text-[#1F2420]/50 uppercase">
                    {prob.difficulty}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onChangeStatus(prob.id, 'solved')}
                    className={`px-2 py-1.5 rounded-md text-xs font-mono flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      currentStatus === 'solved'
                        ? 'bg-[#3F8F63]/15 border-[#3F8F63] text-[#2c6947] font-semibold'
                        : 'bg-[#FAF6F0] border-[#1F2420]/10 text-[#1F2420]/70 hover:bg-[#1F2420]/5'
                    }`}
                  >
                    <CheckCircle className="w-3 h-3 text-[#3F8F63]" />
                    <span>Solved</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeStatus(prob.id, 'partially_solved')}
                    className={`px-2 py-1.5 rounded-md text-xs font-mono flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      currentStatus === 'partially_solved'
                        ? 'bg-[#E5A83B]/20 border-[#B47818] text-[#8a5b0f] font-semibold'
                        : 'bg-[#FAF6F0] border-[#1F2420]/10 text-[#1F2420]/70 hover:bg-[#1F2420]/5'
                    }`}
                  >
                    <HelpCircle className="w-3 h-3 text-[#E5A83B]" />
                    <span>Partial</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeStatus(prob.id, 'not_attempted')}
                    className={`px-2 py-1.5 rounded-md text-xs font-mono flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      currentStatus === 'not_attempted'
                        ? 'bg-[#1F2420]/15 border-[#1F2420]/40 text-[#1F2420] font-semibold'
                        : 'bg-[#FAF6F0] border-[#1F2420]/10 text-[#1F2420]/70 hover:bg-[#1F2420]/5'
                    }`}
                  >
                    <CircleDot className="w-3 h-3 text-[#1F2420]/40" />
                    <span>Not done</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1F2420]/10">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-mono text-[#1F2420]/70 hover:text-[#1F2420] cursor-pointer"
          >
            Return to Exam
          </button>

          <button
            id="btn-confirm-final-submit"
            type="button"
            disabled={isSubmitting}
            onClick={onConfirmSubmit}
            className="px-5 py-2.5 rounded-lg bg-[#C1592B] hover:bg-[#a6481e] text-[#FAF6F0] text-xs font-medium transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Submitting...' : 'Confirm Submission'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
