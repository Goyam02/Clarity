import React, { useState } from 'react';
import { Code2, Terminal, BookOpen, Github, Plus, Trash2, Globe, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { UserProfiles } from '../types';

interface ProfilesStepProps {
  profiles: UserProfiles;
  onChange: (profiles: UserProfiles) => void;
  isValid: boolean;
}

// Normalizer to extract clean handle/username from raw profile URLs or usernames
export function normalizeHandle(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        // e.g., leetcode.com/u/handle or codeforces.com/profile/handle or github.com/handle
        if ((segments[0] === 'u' || segments[0] === 'profile' || segments[0] === 'user') && segments[1]) {
          return segments[1];
        }
        return segments[segments.length - 1];
      }
    }
  } catch {
    // If not a valid URL, treat as direct username
  }
  return trimmed.replace(/^@/, '');
}

export const ProfilesStep: React.FC<ProfilesStepProps> = ({
  profiles,
  onChange,
}) => {
  const [showOptionalPlatforms, setShowOptionalPlatforms] = useState(
    Boolean(profiles.hackerrank || profiles.codechef)
  );

  const handleFieldChange = (key: keyof UserProfiles, value: string) => {
    onChange({
      ...profiles,
      [key]: value,
    });
  };

  const activeCount = Object.values(profiles).filter((v) => Boolean(v && v.trim())).length;

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-6 text-left">
      {/* Step Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#5B6B4D]/15 text-[#5B6B4D] text-[11px] font-semibold uppercase tracking-wider">
          <Terminal className="w-3 h-3" />
          <span>Step 1 · Signal Extraction</span>
        </div>
        <h2
          className="text-[26px] sm:text-[30px] font-normal tracking-[-0.02em] leading-tight text-[#1F2420]"
          style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
        >
          Connect your coding platforms
        </h2>
        <p className="text-[14px] text-[#1F2420]/70 font-normal leading-relaxed">
          CLARITY pulls your solve distribution, difficulty tiers, and tag history to construct your initial mastery topology. Enter at least one platform handle or URL.
        </p>
      </div>

      {/* Primary Platform Inputs */}
      <div className="space-y-3.5">
        {/* LeetCode */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="input-leetcode"
            className="text-[13px] font-medium text-[#1F2420] flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-[4px] bg-[#FFA116]/15 text-[#FFA116] flex items-center justify-center font-bold text-xs">
                LC
              </span>
              <span>LeetCode</span>
              <span className="text-[11px] text-[#C1592B] font-semibold">Recommended</span>
            </span>
            {profiles.leetcode && (
              <span className="text-[11px] text-[#5B6B4D] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> @{normalizeHandle(profiles.leetcode)}
              </span>
            )}
          </label>
          <div className="relative flex items-center">
            <input
              id="input-leetcode"
              type="text"
              value={profiles.leetcode || ''}
              onChange={(e) => handleFieldChange('leetcode', e.target.value)}
              placeholder="e.g. neetcode or https://leetcode.com/u/username"
              className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#1F2420]/15 rounded-[4px] text-[14px] text-[#1F2420] placeholder:text-[#1F2420]/35 focus:outline-none focus:border-[#C1592B] focus:ring-1 focus:ring-[#C1592B] transition-all"
            />
          </div>
        </div>

        {/* Codeforces */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="input-codeforces"
            className="text-[13px] font-medium text-[#1F2420] flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-[4px] bg-[#3B5998]/15 text-[#3B5998] flex items-center justify-center font-bold text-xs">
                CF
              </span>
              <span>Codeforces</span>
            </span>
            {profiles.codeforces && (
              <span className="text-[11px] text-[#5B6B4D] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> @{normalizeHandle(profiles.codeforces)}
              </span>
            )}
          </label>
          <div className="relative flex items-center">
            <input
              id="input-codeforces"
              type="text"
              value={profiles.codeforces || ''}
              onChange={(e) => handleFieldChange('codeforces', e.target.value)}
              placeholder="e.g. tourist or codeforces.com/profile/username"
              className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#1F2420]/15 rounded-[4px] text-[14px] text-[#1F2420] placeholder:text-[#1F2420]/35 focus:outline-none focus:border-[#C1592B] focus:ring-1 focus:ring-[#C1592B] transition-all"
            />
          </div>
        </div>

        {/* GeeksforGeeks */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="input-gfg"
            className="text-[13px] font-medium text-[#1F2420] flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-[4px] bg-[#2F8D46]/15 text-[#2F8D46] flex items-center justify-center font-bold text-xs">
                GFG
              </span>
              <span>GeeksforGeeks (GFG)</span>
            </span>
            {profiles.gfg && (
              <span className="text-[11px] text-[#5B6B4D] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> @{normalizeHandle(profiles.gfg)}
              </span>
            )}
          </label>
          <div className="relative flex items-center">
            <input
              id="input-gfg"
              type="text"
              value={profiles.gfg || ''}
              onChange={(e) => handleFieldChange('gfg', e.target.value)}
              placeholder="e.g. username or geeksforgeeks.org/user/username"
              className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#1F2420]/15 rounded-[4px] text-[14px] text-[#1F2420] placeholder:text-[#1F2420]/35 focus:outline-none focus:border-[#C1592B] focus:ring-1 focus:ring-[#C1592B] transition-all"
            />
          </div>
        </div>

        {/* GitHub */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="input-github"
            className="text-[13px] font-medium text-[#1F2420] flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-[4px] bg-[#1F2420]/10 text-[#1F2420] flex items-center justify-center">
                <Github className="w-3.5 h-3.5" />
              </span>
              <span>GitHub</span>
            </span>
            {profiles.github && (
              <span className="text-[11px] text-[#5B6B4D] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> @{normalizeHandle(profiles.github)}
              </span>
            )}
          </label>
          <div className="relative flex items-center">
            <input
              id="input-github"
              type="text"
              value={profiles.github || ''}
              onChange={(e) => handleFieldChange('github', e.target.value)}
              placeholder="e.g. torvalds or github.com/username"
              className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#1F2420]/15 rounded-[4px] text-[14px] text-[#1F2420] placeholder:text-[#1F2420]/35 focus:outline-none focus:border-[#C1592B] focus:ring-1 focus:ring-[#C1592B] transition-all"
            />
          </div>
        </div>

        {/* Optional platforms toggle (HackerRank & CodeChef) */}
        {!showOptionalPlatforms ? (
          <button
            type="button"
            onClick={() => setShowOptionalPlatforms(true)}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#C1592B] hover:text-[#9e421a] font-medium py-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add more platforms (HackerRank, CodeChef)</span>
          </button>
        ) : (
          <div className="pt-2 border-t border-[#1F2420]/10 space-y-3.5">
            {/* HackerRank */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="input-hackerrank" className="text-[13px] font-medium text-[#1F2420] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-[4px] bg-[#00EA64]/15 text-[#008f3d] flex items-center justify-center font-bold text-xs">
                    HR
                  </span>
                  <span>HackerRank</span>
                </span>
                {profiles.hackerrank && (
                  <span className="text-[11px] text-[#5B6B4D] font-mono">@{normalizeHandle(profiles.hackerrank)}</span>
                )}
              </label>
              <input
                id="input-hackerrank"
                type="text"
                value={profiles.hackerrank || ''}
                onChange={(e) => handleFieldChange('hackerrank', e.target.value)}
                placeholder="e.g. hackerrank.com/profile/username"
                className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#1F2420]/15 rounded-[4px] text-[14px] text-[#1F2420] placeholder:text-[#1F2420]/35 focus:outline-none focus:border-[#C1592B] focus:ring-1 focus:ring-[#C1592B] transition-all"
              />
            </div>

            {/* CodeChef */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="input-codechef" className="text-[13px] font-medium text-[#1F2420] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-[4px] bg-[#5B4636]/15 text-[#5B4636] flex items-center justify-center font-bold text-xs">
                    CC
                  </span>
                  <span>CodeChef</span>
                </span>
                {profiles.codechef && (
                  <span className="text-[11px] text-[#5B6B4D] font-mono">@{normalizeHandle(profiles.codechef)}</span>
                )}
              </label>
              <input
                id="input-codechef"
                type="text"
                value={profiles.codechef || ''}
                onChange={(e) => handleFieldChange('codechef', e.target.value)}
                placeholder="e.g. codechef.com/users/username"
                className="w-full px-3.5 py-2.5 bg-[#FAF6F0] border border-[#1F2420]/15 rounded-[4px] text-[14px] text-[#1F2420] placeholder:text-[#1F2420]/35 focus:outline-none focus:border-[#C1592B] focus:ring-1 focus:ring-[#C1592B] transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Gentle Status Hint / Verification */}
      <div className="p-3 rounded-[6px] bg-[#1F2420]/4 border border-[#1F2420]/8 flex items-start gap-2.5 text-[12.5px] leading-normal text-[#1F2420]/75">
        <ShieldCheck className="w-4 h-4 text-[#5B6B4D] shrink-0 mt-0.5" />
        <div>
          {activeCount > 0 ? (
            <span>
              <strong className="text-[#1F2420] font-semibold">{activeCount} platform{activeCount > 1 ? 's' : ''} connected.</strong> Our agent will automatically fetch public submission records, recent streak data, and topic distribution.
            </span>
          ) : (
            <span>
              Enter at least one platform profile to continue. Don't worry if you don't have all accounts—just provide where you code most often.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
