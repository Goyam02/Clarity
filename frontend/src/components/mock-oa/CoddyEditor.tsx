import React, { useState, useMemo } from 'react';
import {
  Code,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { MockOAProblem, SupportedLanguage } from '../../lib/mock-oa/types';
import { buildEmbedUrl, CODDY_ATTRIBUTION_URL } from '../../lib/coddy/buildEmbedUrl';

interface CoddyEditorProps {
  problem: MockOAProblem;
  selectedLanguage: SupportedLanguage;
  onChangeLanguage: (problemId: string, newLang: SupportedLanguage) => void;
  isVisible: boolean;
}

export const CoddyEditor: React.FC<CoddyEditorProps> = ({
  problem,
  selectedLanguage,
  onChangeLanguage,
  isVisible,
}) => {
  const [pendingLanguage, setPendingLanguage] = useState<SupportedLanguage | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);

  // Compute embed URL based on current language and problem starter
  const embedUrl = useMemo(() => {
    const starterCode = problem.starter[selectedLanguage] || problem.starter.python;
    return buildEmbedUrl({
      lang: selectedLanguage,
      theme: 'light',
      layout: 'stacked',
      code: starterCode,
      stdin: problem.sampleStdin,
      credit: true,
    });
  }, [problem, selectedLanguage, resetKey]);

  const handleLanguageSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as SupportedLanguage;
    if (newLang !== selectedLanguage) {
      setPendingLanguage(newLang);
    }
  };

  const confirmLanguageChange = () => {
    if (pendingLanguage) {
      onChangeLanguage(problem.id, pendingLanguage);
      setResetKey((k) => k + 1);
      setPendingLanguage(null);
    }
  };

  const cancelLanguageChange = () => {
    setPendingLanguage(null);
  };

  return (
    <div
      id={`editor-container-${problem.id}`}
      style={{ display: isVisible ? 'flex' : 'none' }}
      className="flex-1 flex-col h-full bg-[#FAF6F0] overflow-hidden"
    >
      {/* Editor Control Bar */}
      <div className="px-4 py-2 bg-[#FAF6F0] border-b border-[#1F2420]/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-[#1F2420]">
            <Code className="w-3.5 h-3.5 text-[#C1592B]" />
            <span>Language:</span>
          </div>

          <select
            id={`select-lang-${problem.id}`}
            value={selectedLanguage}
            onChange={handleLanguageSelect}
            className="px-2.5 py-1 text-xs font-mono bg-[#FAF6F0] border border-[#1F2420]/20 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#C1592B] cursor-pointer"
          >
            <option value="python">Python 3</option>
            <option value="java">Java (Main.java)</option>
            <option value="cpp">C++ (GCC)</option>
          </select>
        </div>

        {/* Reset / Reload code trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Reload starter code"
            onClick={() => setPendingLanguage(selectedLanguage)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono text-[#1F2420]/70 hover:text-[#C1592B] hover:bg-[#1F2420]/5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Starter</span>
          </button>
        </div>
      </div>

      {/* Language Change Warning Modal */}
      {pendingLanguage !== null && (
        <div className="fixed inset-0 z-50 bg-[#1F2420]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF6F0] border border-[#1F2420]/15 rounded-xl max-w-sm w-full p-5 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-[#E5A83B]/20 text-[#B47818]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#1F2420]">
                  Reset code for {problem.title}?
                </h4>
                <p className="text-xs text-[#1F2420]/75 mt-1 leading-relaxed">
                  Switching languages will reset your editor code for this problem to the default
                  starter template. Any unsaved edits will be discarded.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={cancelLanguageChange}
                className="px-3 py-1.5 rounded-md text-xs font-mono text-[#1F2420]/80 hover:bg-[#1F2420]/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLanguageChange}
                className="px-3 py-1.5 rounded-md text-xs font-mono bg-[#C1592B] text-[#FAF6F0] hover:bg-[#a6481e] cursor-pointer shadow-xs"
              >
                Confirm &amp; Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coddy Embedded Editor Iframe */}
      <div className="flex-1 w-full h-[calc(100%-75px)] relative bg-[#FFFFFF]">
        <iframe
          key={`${problem.id}-${selectedLanguage}-${resetKey}`}
          id={`coddy-iframe-${problem.id}`}
          src={embedUrl}
          title={`Coddy Code Editor - ${problem.title}`}
          loading="eager"
          className="w-full h-full border-0"
        />
      </div>

      {/* Attribution Footer Bar */}
      <div className="h-[28px] px-4 bg-[#FAF6F0] border-t border-[#1F2420]/10 flex items-center justify-between text-[11px] text-[#1F2420]/60 font-mono">
        <span>Execution runs within Coddy runner sandbox</span>
        <a
          href={CODDY_ATTRIBUTION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-[#C1592B] underline decoration-[#1F2420]/30 hover:decoration-[#C1592B]"
        >
          <span>Powered by Coddy</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
};
