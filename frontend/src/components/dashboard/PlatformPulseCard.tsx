import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, RefreshCw, AlertTriangle, ExternalLink, CheckCircle2 } from 'lucide-react';
import { PlatformPulse } from '../../hooks/usePlatformPulse';

/**
 * "Platform Pulse" — what you actually solved on LeetCode/Codeforces, fed by
 * the daily sync that runs when the dashboard opens. Surfaces expired-cookie
 * warnings inline (no silent staleness).
 */
export const PlatformPulseCard: React.FC<{ pulse: PlatformPulse }> = ({ pulse }) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayItems = pulse.activity.filter(
    (i) => (i.solved_at || '').slice(0, 10) === today);
  const showItems = todayItems.length > 0 ? todayItems : pulse.activity.slice(0, 5);
  const lcExpired = pulse.leetcode?.expired === true;

  return (
    <section className="p-5 sm:p-6 rounded-[16px] bg-[#FBF9F5] border border-[#1F2420]/10 shadow-[0_4px_20px_rgba(40,35,25,0.03)] space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Activity className="w-4 h-4 text-[#C1592B]" />
          Platform Pulse
          <span className="text-[11px] font-mono text-[#1F2420]/50 font-normal">
            {todayItems.length > 0
              ? `${todayItems.length} solved today`
              : pulse.activity.length > 0
                ? `${pulse.activity.length} recent`
                : 'no recent pulls'}
          </span>
        </h2>
        <Link
          to="/settings"
          className="text-[12px] text-[#1F2420]/60 hover:text-[#C1592B] font-medium"
        >
          Manage connections
        </Link>
      </div>

      {lcExpired && (
        <div className="p-3 rounded-[8px] bg-[#FFA116]/10 border border-[#FFA116]/30 flex items-start gap-2.5 text-[12.5px]">
          <AlertTriangle className="w-4 h-4 text-[#B8730D] shrink-0 mt-0.5" />
          <div>
            <strong>LeetCode cookies expired.</strong> Re-enter{' '}
            <span className="font-mono text-[11.5px]">LEETCODE_SESSION</span> +{' '}
            <span className="font-mono text-[11.5px]">csrftoken</span> in{' '}
            <Link to="/settings" className="underline font-medium">Settings</Link>{' '}
            to keep daily progress syncing.
          </div>
        </div>
      )}

      {pulse.loading ? (
        <div className="flex items-center gap-2 text-[12.5px] font-mono text-[#1F2420]/55">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#C1592B]" />
          Syncing your platforms...
        </div>
      ) : showItems.length === 0 ? (
        <p className="text-[13px] text-[#1F2420]/60">
          Nothing pulled yet — connect LeetCode or Codeforces in Settings and
          today's solved problems will appear here automatically.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {showItems.map((i) => (
            <li
              key={`${i.platform}-${i.slug}`}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] bg-white border border-[#1F2420]/10"
            >
              <span className="flex items-center gap-2 min-w-0">
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${i.platform === 'leetcode' ? 'text-[#FFA116]' : 'text-[#3B5998]'}`}
                />
                <span className="text-[13px] truncate" title={i.title}>{i.title}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[10.5px] font-mono uppercase text-[#1F2420]/45">
                  {i.platform}
                </span>
                {i.platform === 'leetcode' && (
                  <a
                    href={`https://leetcode.com/problems/${i.slug}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1F2420]/40 hover:text-[#C1592B]"
                    aria-label={`Open ${i.title} on LeetCode`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
