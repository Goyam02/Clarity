import React, { useEffect } from 'react';
import { ShieldAlert, AlertTriangle, X } from 'lucide-react';
import { ProctorViolation } from '../../lib/proctor/types';

interface ViolationBannerProps {
  violation: ProctorViolation | null;
  totalViolations: number;
  maxViolations: number;
  onDismiss: () => void;
}

export const ViolationBanner: React.FC<ViolationBannerProps> = ({
  violation,
  totalViolations,
  maxViolations,
  onDismiss,
}) => {
  useEffect(() => {
    if (!violation) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [violation, onDismiss]);

  if (!violation) return null;

  const isFinalViolation = totalViolations >= maxViolations;

  return (
    <div
      role="alert"
      className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-in slide-in-from-top duration-200"
    >
      <div className="bg-[#1F2420] text-[#FAF6F0] rounded-lg p-3.5 shadow-2xl border border-[#C1592B] flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-md bg-[#C1592B] text-[#FAF6F0] shrink-0 mt-0.5">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#E5A83B] uppercase tracking-wider">
                Violation {totalViolations} of {maxViolations}
              </span>
              {isFinalViolation && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#C1592B] text-[#FAF6F0] font-mono">
                  Limit Reached
                </span>
              )}
            </div>
            <p className="text-xs text-[#FAF6F0]/90 mt-1 leading-relaxed">
              {violation.message}
            </p>
            {isFinalViolation && (
              <p className="text-xs text-[#E5A83B] mt-1 font-semibold">
                Maximum allowed violations reached. Assessment is auto-submitting...
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-[#FAF6F0]/50 hover:text-[#FAF6F0] p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
