import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  RotateCcw,
  Compass,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { ClarityLogo } from '../components/Logos';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardSections } from '../components/dashboard/DashboardSections';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { OnboardingPayload } from '../onboarding/types';
import { UserMenu } from '../components/auth/UserMenu';

const COMPLETED_KEY = 'clarity_completed_profile';

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';

  const [profile, setProfile] = useState<OnboardingPayload | null>(null);

  // Load user profile from localStorage for platform count context
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COMPLETED_KEY);
      if (saved) {
        setProfile(JSON.parse(saved));
      }
    } catch {
      // LocalStorage fallback
    }
  }, []);

  // Fetch verified dashboard data via contract hook
  const { data: payload, isLoading, error, refetch } = useDashboard();

  const profilesCount = profile?.profiles
    ? Object.values(profile.profiles).filter((v) => Boolean(v && v.trim())).length
    : 1;

  // Values strictly from payload when ready
  const dreamCompany = payload?.target?.company || profile?.goals?.dreamCompany || 'Google';
  const clearScore = payload?.clearScore?.value ?? 78;
  const scoreLabel = payload?.clearScore?.label || 'Top 12% Placement Readiness';

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans relative selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Subtle Ambient Glow */}
      <div
        className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none overflow-hidden z-0"
        aria-hidden="true"
      >
        <div
          className="absolute top-[-90px] left-1/2 -translate-x-1/2 w-[900px] h-[350px] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(249, 115, 22, 0.15) 0%, rgba(251, 146, 60, 0.08) 35%, rgba(91, 107, 77, 0.05) 65%, transparent 85%)',
            filter: 'blur(50px)',
          }}
        />
      </div>

      {/* Header (Preserved exactly per spec) */}
      <header className="w-full relative z-20 border-b border-[#1F2420]/8 bg-[#FAF6F0]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/">
            <ClarityLogo className="scale-90 origin-left" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/graph"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#1F2420] text-[#FAF6F0] text-[12px] font-medium hover:bg-[#C1592B] transition-colors shadow-xs"
            >
              <Compass className="w-3.5 h-3.5 text-[#E5A83B]" />
              <span>Knowledge Graph</span>
            </Link>
            <button
              id="btn-update-calibration"
              type="button"
              onClick={() => navigate('/onboarding')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[#1F2420]/15 text-[12px] font-medium hover:border-[#C1592B] hover:text-[#C1592B] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Update Calibration</span>
            </button>
            <Link
              to="/"
              className="text-[13px] text-[#1F2420]/75 hover:text-[#C1592B] font-medium transition-colors hidden sm:inline"
            >
              Landing Page
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 relative z-10 flex flex-col gap-6 sm:gap-8">
        {/* Loading State: Zero Layout Shift Skeletons */}
        {isLoading && <DashboardSkeleton />}

        {/* Error State with Retry */}
        {error && !isLoading && (
          <div
            className="p-6 sm:p-8 rounded-[14px] bg-[#FCE8E6] border border-[#B8322A]/20 text-center space-y-3 shadow-xs"
            role="alert"
          >
            <AlertTriangle className="w-8 h-8 text-[#B8322A] mx-auto" />
            <h3 className="text-[17px] font-semibold text-[#1F2420]">
              Unable to load telemetry dashboard
            </h3>
            <p className="text-[13.5px] text-[#1F2420]/70 max-w-md mx-auto">
              {error.message || 'An unexpected error occurred while communicating with the diagnostic engine.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[5px] bg-[#1F2420] text-white text-[13px] font-medium hover:bg-[#C1592B] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
        )}

        {/* Payload Content Available */}
        {payload && !isLoading && (
          <>
            {/* Banner Hero (Padding calibrated so Section 1 is visible at 1440x900) */}
            <div className="p-5 sm:p-6 rounded-[16px] bg-[#FBF9F5] border border-[#1F2420]/10 shadow-[0_4px_20px_rgba(40,35,25,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#C1592B]/10 text-[#C1592B] text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  <span>Personal Knowledge Graph Active</span>
                </div>
                <h1
                  className="text-[26px] sm:text-[32px] font-normal tracking-[-0.025em] text-[#1F2420] leading-tight"
                  style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
                >
                  Target Profile: <span className="text-[#C1592B] italic">{dreamCompany}</span> Readiness
                </h1>
                <p className="text-[13.5px] sm:text-[14.5px] text-[#1F2420]/75 max-w-xl">
                  Synthesized across {profilesCount} connected platform{profilesCount > 1 ? 's' : ''} and your
                  self-calibrated confidence distribution.
                </p>
                <div className="pt-1.5 flex items-center gap-3">
                  <Link
                    to="/dashboard/graph"
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[12.5px] font-medium hover:bg-[#C1592B] transition-colors shadow-xs"
                  >
                    <Compass className="w-4 h-4 text-[#C1592B]" />
                    <span>View Obsidian Knowledge Graph</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Clear Score Badge */}
              <div className="flex items-center gap-4 bg-[#FAF6F0] p-3.5 sm:p-4 rounded-[12px] border border-[#1F2420]/10 shrink-0 shadow-xs">
                <div>
                  <span className="text-[11px] font-mono text-[#1F2420]/60 uppercase tracking-wider block">
                    Clear Score
                  </span>
                  <span className="text-[34px] sm:text-[38px] font-bold text-[#1F2420] leading-none">
                    {clearScore}
                  </span>
                  <span className="text-[13.5px] text-[#1F2420]/60"> / 100</span>
                </div>
                <div
                  className="w-12 h-12 rounded-full border-4 border-[#C1592B] border-t-transparent flex items-center justify-center text-[11px] font-bold text-[#C1592B] uppercase text-center leading-none"
                  title={scoreLabel}
                >
                  Top
                </div>
              </div>
            </div>

            {/* Scroll-Driven Section-by-Section Experience (Replaces old static 3-card grid) */}
            <DashboardSections
              payload={payload}
              isWelcome={isWelcome}
              onActionClick={(action, topic) => {
                // Interactive action handler
                if (action === 'start_revision' && topic) {
                  navigate(`/dashboard/graph?focus=${encodeURIComponent(topic.id)}`);
                }
              }}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default DashboardView;
