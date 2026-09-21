import React, { useState } from 'react';
import {
  Copy,
  Check,
  Tag,
  Maximize2,
  Minimize2,
  FileCode2,
} from 'lucide-react';
import { MockOAProblem } from '../../lib/mock-oa/types';

interface ProblemPanelProps {
  problem: MockOAProblem;
  problemIndex: number;
  totalProblems: number;
  isFocusedEditor: boolean;
  onToggleFocusEditor: () => void;
}

export const ProblemPanel: React.FC<ProblemPanelProps> = ({
  problem,
  problemIndex,
  totalProblems,
  isFocusedEditor,
  onToggleFocusEditor,
}) => {
  const [copiedExampleIdx, setCopiedExampleIdx] = useState<number | null>(null);
  const [copiedStdin, setCopiedStdin] = useState(false);

  const handleCopy = (text: string, type: 'stdin' | 'example', idx?: number) => {
    navigator.clipboard.writeText(text);
    if (type === 'stdin') {
      setCopiedStdin(true);
      setTimeout(() => setCopiedStdin(false), 2000);
    } else if (idx !== undefined) {
      setCopiedExampleIdx(idx);
      setTimeout(() => setCopiedExampleIdx(null), 2000);
    }
  };

  // Helper to render markdown-like text (paragraphs, bold, inline code, lists)
  const renderFormattedText = (raw: string) => {
    return raw.split('\n\n').map((para, i) => {
      // Inline formatting: `code` and **bold**
      const parts = para.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
      return (
        <p key={i} className="mb-3 text-sm text-[#1F2420]/85 leading-relaxed">
          {parts.map((part, j) => {
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code
                  key={j}
                  className="px-1.5 py-0.5 rounded-sm bg-[#1F2420]/5 font-mono text-xs text-[#C1592B]"
                >
                  {part.slice(1, -1)}
                </code>
              );
            }
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={j} className="font-semibold text-[#1F2420]">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div
      id="problem-description-panel"
      className="h-full flex flex-col bg-[#FBF9F5] border-r border-[#1F2420]/10 overflow-hidden"
    >
      {/* Header bar */}
      <div className="p-4 border-b border-[#1F2420]/10 flex items-center justify-between gap-3 bg-[#FAF6F0]/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#1F2420]/50">
              Problem {problemIndex + 1} of {totalProblems}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                problem.difficulty === 'Hard'
                  ? 'bg-[#C1592B]/10 text-[#C1592B]'
                  : 'bg-[#E5A83B]/15 text-[#B47818]'
              }`}
            >
              {problem.difficulty}
            </span>
          </div>
          <h2 className="text-xl font-serif text-[#1F2420] mt-0.5 font-medium">
            {problem.title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onToggleFocusEditor}
          title={isFocusedEditor ? 'Show problem panel' : 'Focus editor (hide panel)'}
          className="p-2 rounded-md hover:bg-[#1F2420]/5 text-[#1F2420]/70 hover:text-[#1F2420] transition-colors cursor-pointer text-xs flex items-center gap-1 font-mono"
        >
          {isFocusedEditor ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unfocus</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Focus Editor</span>
            </>
          )}
        </button>
      </div>

      {/* Content scroll area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
        {/* Topics chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="w-3 h-3 text-[#1F2420]/40 mr-0.5" />
          {problem.topicIds.map((tid) => (
            <span
              key={tid}
              className="px-2 py-0.5 rounded-full bg-[#1F2420]/5 text-[11px] font-mono text-[#1F2420]/70"
            >
              {tid}
            </span>
          ))}
        </div>

        {/* Problem Statement */}
        <section>
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#1F2420]/60 mb-2 font-semibold">
            Description
          </h3>
          <div className="prose-sm max-w-none">{renderFormattedText(problem.statement)}</div>
        </section>

        {/* Input & Output Format */}
        <section className="space-y-4">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#1F2420]/60 mb-1.5 font-semibold">
              Input Format
            </h3>
            <div className="text-xs text-[#1F2420]/80 leading-relaxed bg-[#1F2420]/[0.02] p-3 rounded-md border border-[#1F2420]/10">
              {renderFormattedText(problem.inputFormat)}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#1F2420]/60 mb-1.5 font-semibold">
              Output Format
            </h3>
            <div className="text-xs text-[#1F2420]/80 leading-relaxed bg-[#1F2420]/[0.02] p-3 rounded-md border border-[#1F2420]/10">
              {renderFormattedText(problem.outputFormat)}
            </div>
          </div>
        </section>

        {/* Constraints */}
        <section>
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#1F2420]/60 mb-2 font-semibold">
            Constraints
          </h3>
          <ul className="space-y-1.5 list-disc list-inside text-xs font-mono text-[#1F2420]/80 bg-[#1F2420]/[0.02] p-3 rounded-md border border-[#1F2420]/10">
            {problem.constraints.map((c, idx) => (
              <li key={idx} className="leading-relaxed">
                {c}
              </li>
            ))}
          </ul>
        </section>

        {/* Examples */}
        <section className="space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#1F2420]/60 font-semibold">
            Examples
          </h3>

          {problem.examples.map((ex, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-[#1F2420]/10 bg-[#FAF6F0] overflow-hidden text-xs"
            >
              <div className="bg-[#1F2420]/[0.03] px-3 py-1.5 border-b border-[#1F2420]/10 flex items-center justify-between">
                <span className="font-mono text-[11px] font-medium text-[#1F2420]/70">
                  Example {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(ex.input, 'example', idx)}
                  className="flex items-center gap-1 font-mono text-[10px] text-[#1F2420]/60 hover:text-[#C1592B] cursor-pointer"
                >
                  {copiedExampleIdx === idx ? (
                    <>
                      <Check className="w-3 h-3 text-[#3F8F63]" />
                      <span>Copied Input</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Input</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 space-y-2 font-mono">
                <div>
                  <span className="text-[10px] uppercase text-[#1F2420]/40 block mb-0.5">Input</span>
                  <pre className="bg-[#1F2420]/5 p-2 rounded-sm text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {ex.input}
                  </pre>
                </div>

                <div>
                  <span className="text-[10px] uppercase text-[#1F2420]/40 block mb-0.5">Output</span>
                  <pre className="bg-[#1F2420]/5 p-2 rounded-sm text-[11px] text-[#3F8F63] overflow-x-auto whitespace-pre-wrap">
                    {ex.output}
                  </pre>
                </div>

                {ex.explanation && (
                  <div className="pt-1 font-sans text-xs text-[#1F2420]/75 leading-relaxed">
                    <span className="font-medium text-[#1F2420]">Explanation: </span>
                    {ex.explanation}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Sample Stdin for Runner */}
        <section className="pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#1F2420]/60 font-semibold flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5 text-[#C1592B]" />
              <span>Default Stdin in Editor</span>
            </h3>
            <button
              type="button"
              onClick={() => handleCopy(problem.sampleStdin, 'stdin')}
              className="flex items-center gap-1 font-mono text-[10px] text-[#1F2420]/60 hover:text-[#C1592B] cursor-pointer"
            >
              {copiedStdin ? (
                <>
                  <Check className="w-3 h-3 text-[#3F8F63]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="bg-[#1F2420]/5 border border-[#1F2420]/10 p-2.5 rounded-md font-mono text-xs text-[#1F2420]/90 overflow-x-auto">
            {problem.sampleStdin}
          </pre>
        </section>
      </div>
    </div>
  );
};
