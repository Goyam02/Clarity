import React from 'react';
import { ExternalLink, Code2 } from 'lucide-react';
import { AdaptiveProblem } from '../../lib/dashboard/types';

interface AdaptiveSetProps {
  problems: AdaptiveProblem[];
  onProblemClick?: (problem: AdaptiveProblem) => void;
}

export const AdaptiveSet: React.FC<AdaptiveSetProps> = ({
  problems,
  onProblemClick,
}) => {
  const getDifficultyBadge = (diff: AdaptiveProblem['difficulty']) => {
    switch (diff) {
      case 'Easy':
        return 'text-[#3F8F63] bg-[#E3F2E9] border-[#3F8F63]/25';
      case 'Medium':
        return 'text-[#C1592B] bg-[#F6E3D8] border-[#C1592B]/25';
      case 'Hard':
        return 'text-[#5B6B4D] bg-[#EFF3EB] border-[#5B6B4D]/25';
    }
  };

  return (
    <div className="rounded-[14px] bg-[#FBF9F5] border border-[#1F2420]/10 p-5 sm:p-6 shadow-[0_2px_12px_rgba(40,35,25,0.03)] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[5px] bg-[#1F2420]/5 flex items-center justify-center text-[#1F2420]">
            <Code2 className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-[15px] font-semibold text-[#1F2420]">
            Today&apos;s 3-Problem Adaptive Set
          </h4>
        </div>
        <span className="text-[11px] font-mono text-[#1F2420]/50 uppercase">
          Dynamic Curated Batch
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {problems.map((prob, idx) => (
          <a
            key={prob.id || idx}
            id={`adaptive-problem-${prob.id || idx}`}
            href={prob.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (onProblemClick) {
                e.preventDefault();
                onProblemClick(prob);
              }
            }}
            className="p-3 rounded-[8px] bg-[#FAF6F0] hover:bg-[#F2ECE1] border border-[#1F2420]/8 hover:border-[#C1592B]/40 transition-all flex items-center justify-between gap-2 group cursor-pointer"
          >
            <div className="min-w-0">
              <span className="text-[11px] font-mono text-[#1F2420]/50 block uppercase">
                Problem 0{idx + 1}
              </span>
              <span className="text-[13px] font-medium text-[#1F2420] group-hover:text-[#C1592B] transition-colors truncate block">
                {prob.title}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded-[4px] border ${getDifficultyBadge(
                  prob.difficulty
                )}`}
              >
                {prob.difficulty}
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-[#1F2420]/40 group-hover:text-[#C1592B] transition-colors" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
