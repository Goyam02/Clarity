import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, KeyRound, X } from 'lucide-react';

/**
 * Popup raised when the daily sync detects LeetCode rejected the stored
 * cookies (LEETCODE_SESSION / csrftoken expired). Sends the user straight to
 * Settings where the two fields live. Dismissible per session.
 */
const DISMISS_KEY = 'clarity_lc_expired_dismissed_at';

export const CookiesExpiredPopup: React.FC<{ expired: boolean }> = ({ expired }) => {
  const navigate = useNavigate();
  const [dismissedAt, setDismissedAt] = useState<number | null>(() => {
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY);
      return raw ? Number(raw) : null;
    } catch {
      return null;
    }
  });

  if (!expired) return null;
  // Re-show on a new session, or 12h after dismissal, so it never nags forever.
  if (dismissedAt && Date.now() - dismissedAt < 12 * 3600 * 1000) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissedAt(Date.now());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="LeetCode cookies expired"
    >
      <div className="w-full max-w-md rounded-[14px] bg-[#FBF9F5] border border-[#1F2420]/12 shadow-[0_12px_40px_rgba(31,36,32,0.18)] p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[8px] bg-[#FFA116]/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#B8730D]" />
            </span>
            <h2
              className="text-[19px] font-normal tracking-[-0.02em] text-[#1F2420]"
              style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
            >
              LeetCode cookies expired
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="p-1 rounded hover:bg-[#1F2420]/5 text-[#1F2420]/50 hover:text-[#1F2420] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[13.5px] text-[#1F2420]/75 leading-relaxed">
          Your stored <span className="font-mono text-[12.5px]">LEETCODE_SESSION</span> and{' '}
          <span className="font-mono text-[12.5px]">csrftoken</span> were rejected during
          today's progress sync, so LeetCode activity stopped updating. Everything else
          keeps working — only LeetCode pulls are paused.
        </p>

        <div className="p-3 rounded-[8px] bg-[#FFA116]/10 border border-[#FFA116]/30 text-[12.5px] text-[#7A5200]">
          Paste fresh values in <strong>Settings → Connected accounts → LeetCode</strong>{' '}
          to resume daily progress sync.
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2 rounded-[6px] text-[13px] font-medium text-[#1F2420]/70 hover:bg-[#1F2420]/5 cursor-pointer"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => {
              dismiss();
              navigate('/settings');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[13px] font-medium hover:bg-[#2e3730] cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Update cookies now
          </button>
        </div>
      </div>
    </div>
  );
};
