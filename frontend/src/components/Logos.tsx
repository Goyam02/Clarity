import React from 'react';

// Clarity Brand Logo: Clean, confident wordmark with custom terracotta geometric prism/aperture accent
export const ClarityLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-2 select-none cursor-pointer group ${className}`}>
    <span
      className="text-[24px] font-semibold tracking-[-0.035em] text-[#1F2420]"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      Clarity
    </span>
    {/* Subtle custom geometric accent mark in burnt clay / terracotta */}
    <div className="flex items-center gap-[3px] translate-y-[-0.5px]">
      <span className="w-2 h-2 rounded-full bg-[#C1592B] transition-transform duration-200 group-hover:scale-125" />
      <span className="w-1.5 h-1.5 rounded-full bg-[#5B6B4D] opacity-60 transition-transform duration-200 group-hover:scale-110" />
    </div>
  </div>
);

// Pillar 1: DAILY MODE (Clean technical sans, tracked)
export const DailyModeWordmark: React.FC = () => (
  <span
    className="text-[13px] uppercase tracking-[0.24em] font-bold text-[#1F2420]/70 hover:text-[#1F2420] transition-colors whitespace-nowrap select-none"
    style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
  >
    DAILY MODE
  </span>
);

// Pillar 2: CODE RED (Modernist high-contrast serif with subtle accent)
export const CodeRedWordmark: React.FC = () => (
  <span
    className="text-[17px] tracking-[0.06em] font-bold text-[#1F2420]/85 hover:text-[#C1592B] transition-colors whitespace-nowrap select-none flex items-center gap-1.5"
    style={{ fontFamily: '"Fraunces", Georgia, serif' }}
  >
    <span>CODE RED</span>
    <span className="w-1.5 h-1.5 rounded-full bg-[#C1592B]" />
  </span>
);

// Pillar 3: MOCK INTERVIEW (Distinguished small-caps editorial serif)
export const MockInterviewWordmark: React.FC = () => (
  <span
    className="text-[15px] uppercase tracking-[0.14em] font-semibold text-[#1F2420]/80 hover:text-[#1F2420] transition-colors whitespace-nowrap select-none"
    style={{ fontFamily: '"Newsreader", Georgia, serif' }}
  >
    MOCK INTERVIEW
  </span>
);

// Pillar 4: KNOWLEDGE GRAPH (Refined editorial italic serif)
export const KnowledgeGraphWordmark: React.FC = () => (
  <span
    className="text-[19px] italic font-normal tracking-[-0.01em] text-[#1F2420]/85 hover:text-[#1F2420] transition-colors whitespace-nowrap select-none"
    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
  >
    Knowledge Graph
  </span>
);

// Pillar 5: CLEAR SCORE (Bold architectural geometric sans)
export const ClearScoreWordmark: React.FC = () => (
  <span
    className="text-[14px] uppercase tracking-[0.22em] font-extrabold text-[#1F2420]/75 hover:text-[#1F2420] transition-colors whitespace-nowrap select-none"
    style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
  >
    CLEAR SCORE
  </span>
);

// Pillar 6: MASTERY MODEL (Classic high-contrast serif uppercase)
export const MasteryModelWordmark: React.FC = () => (
  <span
    className="text-[16px] uppercase tracking-[0.12em] font-semibold text-[#1F2420]/80 hover:text-[#1F2420] transition-colors whitespace-nowrap select-none"
    style={{ fontFamily: '"Newsreader", Georgia, serif' }}
  >
    MASTERY MODEL
  </span>
);

// Pillar 7: QUESTION GENERATOR (Clean tracked grotesque)
export const QuestionGeneratorWordmark: React.FC = () => (
  <span
    className="text-[13px] uppercase tracking-[0.20em] font-medium text-[#1F2420]/70 hover:text-[#1F2420] transition-colors whitespace-nowrap select-none"
    style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
  >
    QUESTION GENERATOR
  </span>
);

// Pillar 8: AI EVALUATOR (Modern sans with technical mono badge)
export const AiEvaluatorWordmark: React.FC = () => (
  <span className="text-[15px] tracking-[-0.01em] font-semibold text-[#1F2420]/75 hover:text-[#1F2420] transition-colors whitespace-nowrap select-none flex items-center gap-1.5">
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5B6B4D] font-mono px-1.5 py-0.5 rounded-xs bg-[#5B6B4D]/10">
      AI
    </span>
    <span>EVALUATOR</span>
  </span>
);

// Pillar 9: COMPANY INTEL (Editorial heritage display serif)
export const CompanyIntelWordmark: React.FC = () => (
  <span
    className="text-[16px] uppercase tracking-[0.08em] font-medium text-[#1F2420]/80 hover:text-[#1F2420] transition-colors whitespace-nowrap select-none"
    style={{ fontFamily: '"Fraunces", Georgia, serif' }}
  >
    COMPANY INTEL
  </span>
);

// Pillar 10: OUTCOME LOOP (Flowing humanist italic serif)
export const OutcomeLoopWordmark: React.FC = () => (
  <span
    className="text-[20px] italic font-normal tracking-normal text-[#1F2420]/85 hover:text-[#1F2420] transition-colors whitespace-nowrap select-none"
    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
  >
    Outcome Loop
  </span>
);
