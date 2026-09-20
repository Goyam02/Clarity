import React from 'react';
import { Check } from 'lucide-react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onStepClick?: (stepIndex: number) => void;
  maxReachedStep: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  totalSteps,
  stepLabels,
  onStepClick,
  maxReachedStep,
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-2" aria-label="Onboarding Progress">
      {/* Visual step line and milestones */}
      <div className="relative flex items-center justify-between">
        {/* Continuous background track behind the milestones */}
        <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-[2px] bg-[#1F2420]/10 -z-0" />

        {/* Animated fill track based on progress */}
        <div
          className="absolute top-1/2 left-4 -translate-y-1/2 h-[2px] bg-[#C1592B] transition-all duration-300 ease-out -z-0"
          style={{
            width: `${Math.max(0, ((currentStep - 1) / (totalSteps - 1)) * 100)}%`,
            maxWidth: 'calc(100% - 2rem)',
          }}
        />

        {stepLabels.map((label, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const isClickable = stepNum <= maxReachedStep && stepNum !== currentStep && onStepClick;

          return (
            <div key={label} className="relative z-10 flex flex-col items-center group">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(stepNum)}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                className={`w-8 h-8 rounded-[4px] flex items-center justify-center text-xs font-semibold transition-all duration-200 border ${
                  isCompleted
                    ? 'bg-[#1F2420] text-[#FAF6F0] border-[#1F2420] cursor-pointer hover:bg-[#C1592B] hover:border-[#C1592B]'
                    : isCurrent
                    ? 'bg-[#C1592B] text-[#FAF6F0] border-[#C1592B] shadow-xs scale-105 ring-4 ring-[#C1592B]/15'
                    : 'bg-[#FAF6F0] text-[#1F2420]/50 border-[#1F2420]/20'
                } ${isClickable ? 'cursor-pointer' : ''}`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <span>{stepNum}</span>
                )}
              </button>

              <span
                className={`mt-2 text-[11px] sm:text-[12px] font-medium tracking-tight whitespace-nowrap hidden sm:block transition-colors ${
                  isCurrent
                    ? 'text-[#1F2420] font-semibold'
                    : isCompleted
                    ? 'text-[#1F2420]/75'
                    : 'text-[#1F2420]/40'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile step label display */}
      <div className="mt-2 text-center sm:hidden">
        <span className="text-[12px] font-medium text-[#C1592B] uppercase tracking-wider">
          Step {currentStep} of {totalSteps}:
        </span>{' '}
        <span className="text-[13px] font-semibold text-[#1F2420]">
          {stepLabels[currentStep - 1]}
        </span>
      </div>
    </div>
  );
};
