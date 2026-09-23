import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  RotateCcw,
  Compass,
  AlertTriangle,
  RefreshCw,
  Siren,
  Zap,
  Moon,
  Sun,
  Flame,
} from 'lucide-react';
import { ClarityLogo } from '../components/Logos';
import { useDashboard } from '../hooks/useDashboard';
import { usePlatformPulse } from '../hooks/usePlatformPulse';
import { PlatformPulseCard } from '../components/dashboard/PlatformPulseCard';
import { CookiesExpiredPopup } from '../components/dashboard/CookiesExpiredPopup';
import { DashboardSections } from '../components/dashboard/DashboardSections';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { OnboardingPayload } from '../onboarding/types';
import { UserMenu } from '../components/auth/UserMenu';
import { dailyApi, usersApi, DailyPlan } from '../lib/api/endpoints';
import { ApiError } from '../lib/api/client';

const COMPLETED_KEY = 'clarity_completed_profile';

const MOODS: { id: 'light' | 'normal' | 'push'; label: string; icon: React.ReactNode }[] = [
  { id: 'light', label: 'Light', icon: <Moon className="w-3 h-3" /> },
  { id: 'normal', label: 'Normal', icon: <Sun className="w-3 h-3" /> },
  { id: 'push', label: 'Push', icon: <Flame className="w-3 h-3" /> },
];

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
  // Daily platform sync (LeetCode + Codeforces) + solved-problem feed.
  // The sync itself fires at login/signup; this hook adopts its result.
  const pulse = usePlatformPulse();
  const lcCookiesExpired = pulse.leetcode?.expired === true;

  const profilesCount = profile?.profiles
    ? Object.values(profile.profiles).filter((v) => Boolean(v && v.trim())).length
    : 1;

  // Values strictly from payload when ready
  const dreamCompany = payload?.target?.company || profile?.goals?.dreamCompany || 'your target';
  const clearScore = payload?.clearScore?.value ?? null;
  const scoreLabel = payload?.clearScore?.label || 'Building Foundations';

  // --- Daily plan (spec §4): mood + time -> POST /daily/plan, live status toggles ---
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    dailyApi.todayPlan()
      .then((res) => { if (alive) setPlan(res.plan); })
      .catch((e) => { if (alive) setPlanError(e.message || 'Could not load your plan.'); })
      .finally(() => { if (alive) setPlanLoading(false); });
    return () => { alive = false; };
  }, []);

  const [mood, setMood] = useState<'light' | 'normal' | 'push'>('normal');
  const [minutes, setMinutes] = useState(40);
  const [taskBusy, setTaskBusy] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    usersApi.me().then(s => {
      if (active && ['light', 'normal', 'push'].includes(s.default_mood)) setMood(s.default_mood as 'light' | 'normal' | 'push');
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const generatePlan = async () => {
    setPlanBusy(true);
    setPlanError(null);
    try {
      const res = await dailyApi.generatePlan(mood, minutes);
      setPlan({
        plan_id: res.plan_id,
        date: new Date().toISOString().slice(0, 10),
        mood,
        time_available: minutes,
        tasks: res.tasks,
      });
    } catch (err) {
      setPlanError(err instanceof ApiError
        ? (err.code === 'FOUNDRY_NOT_CONFIGURED'
          ? 'The AI planner needs the Foundry backend configured (docs/azure-setup.md).'
          : err.message)
        : 'Could not generate the plan.');
    } finally {
      setPlanBusy(false);
    }
  };

  const toggleTask = async (index: number) => {
    if (!plan || taskBusy !== null) return;
    setTaskBusy(index);
    const task = plan.tasks[index];
    const next = task.status === 'done' ? 'pending' : 'done';
    setPlan({ ...plan, tasks: plan.tasks.map((t, i) =>
      i === index ? { ...t, status: next } : t) }); // optimistic
    try {
      await dailyApi.setTaskStatus(plan.plan_id, index, next);
    } catch {
      // revert on failure
      setPlan((p) => p ? { ...p, tasks: p.tasks.map((t, i) =>
        i === index ? { ...t, status: task.status } : t) } : p);
      setPlanError('Could not update the task. Please try again.');
    } finally {
      setTaskBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans relative selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Expired-cookie alert (daily sync reported LEETCODE_AUTH_EXPIRED) */}
      <CookiesExpiredPopup expired={lcCookiesExpired} />
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
            {/* CODE RED — spec §4: permanently visible in the Home header, one tap during panic */}
            <button
              id="btn-code-red"
              type="button"
              onClick={() => navigate('/code-red')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] bg-[#B8322A] text-[#FAF6F0] text-[12px] font-semibold hover:bg-[#C9402F] transition-colors shadow-[0_2px_10px_rgba(184,50,42,0.35)] cursor-pointer"
            >
              <Siren className="w-3.5 h-3.5" />
              <span>CODE RED</span>
            </button>
            <Link
              to="/dashboard/graph"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#1F2420] text-[#FAF6F0] text-[12px] font-medium hover:bg-[#C1592B] transition-colors shadow-xs"
            >
              <Compass className="w-3.5 h-3.5 text-[#E5A83B]" />
              <span className="hidden sm:inline">Knowledge Graph</span>
              <span className="sm:hidden">Graph</span>
            </Link>
            <button
              id="btn-update-calibration"
              type="button"
              onClick={() => navigate('/onboarding')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border border-[#1F2420]/15 text-[12px] font-medium hover:border-[#C1592B] hover:text-[#C1592B] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Update Calibration</span>
            </button>
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
                    <span>View Knowledge Graph</span>
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
                    {clearScore ?? '—'}
                  </span>
                  <span className="text-[13.5px] text-[#1F2420]/60">{clearScore !== null ? ' / 100' : ''}</span>
                </div>
                <div
                  className="w-12 h-12 rounded-full border-4 border-[#C1592B] border-t-transparent flex items-center justify-center text-[11px] font-bold text-[#C1592B] uppercase text-center leading-none"
                  title={scoreLabel}
                >
                  Top
                </div>
              </div>
            </div>

            {/* Daily Plan (spec §4): mood + time -> generated plan with live task state.
                Every value below comes from GET/POST /daily/plan — no placeholders. */}
            <div className="p-5 sm:p-6 rounded-[16px] bg-[#FBF9F5] border border-[#1F2420]/10 shadow-[0_4px_20px_rgba(40,35,25,0.03)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#C1592B]" />
                  <h2 className="text-[16px] font-semibold text-[#1F2420] tracking-tight">Today's Plan</h2>
                  {plan && (
                    <span className="text-[11px] font-mono text-[#1F2420]/50 uppercase">
                      {plan.mood} · {plan.time_available}m
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Mood toggle (spec §4: Light / Normal / Push) */}
                  <div className="flex items-center gap-1 p-0.5 rounded-[6px] bg-[#1F2420]/5 border border-[#1F2420]/10">
                    {MOODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMood(m.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11.5px] font-medium transition-colors cursor-pointer ${
                          mood === m.id
                            ? 'bg-[#1F2420] text-[#FAF6F0] shadow-xs'
                            : 'text-[#1F2420]/60 hover:text-[#1F2420]'
                        }`}
                      >
                        {m.icon}
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <select
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="px-2 py-1.5 rounded-[6px] border border-[#1F2420]/15 text-[12px] bg-[#FAF6F0] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
                    aria-label="Minutes available today"
                  >
                    {[15, 30, 40, 60, 90, 120].map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                  <button
                    id="btn-generate-plan"
                    type="button"
                    onClick={() => void generatePlan()}
                    disabled={planBusy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#C1592B] text-[#FAF6F0] text-[12px] font-semibold hover:bg-[#A8451F] transition-colors shadow-xs disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {planBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : plan ? <RotateCcw className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>{planBusy ? 'Planning…' : plan ? 'Regenerate' : 'Generate plan'}</span>
                  </button>
                </div>
              </div>

              {planError && (
                <p className="mt-3 text-[12.5px] text-[#B8322A]">{planError}</p>
              )}

              {planLoading ? (
                <p className="mt-4 text-[12.5px] font-mono text-[#1F2420]/50">Loading plan…</p>
              ) : plan && plan.tasks.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {plan.tasks.map((task, idx) => {
                    const done = task.status === 'done';
                    return (
                      <li key={`${task.id ?? idx}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => void toggleTask(idx)}
                          disabled={taskBusy !== null}
                          className={`w-full text-left flex items-center gap-3 p-3 rounded-[10px] border transition-colors cursor-pointer ${
                            done
                              ? 'bg-[#5B6B4D]/8 border-[#5B6B4D]/25'
                              : 'bg-[#FAF6F0] border-[#1F2420]/10 hover:border-[#C1592B]/40'
                          }`}
                        >
                          <span
                            className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              done ? 'border-[#5B6B4D] bg-[#5B6B4D]' : 'border-[#1F2420]/30'
                            }`}
                          >
                            {done && <span className="w-1.5 h-1.5 rounded-full bg-[#FAF6F0]" />}
                          </span>
                          <span className={`flex-1 text-[13.5px] leading-snug ${done ? 'line-through text-[#1F2420]/50' : 'text-[#1F2420]'}`}>
                            {task.title || task.task_type}
                          </span>
                          {typeof task.duration_minutes === 'number' && (
                            <span className="shrink-0 text-[11px] font-mono text-[#1F2420]/50 tabular-nums">
                              {task.duration_minutes}m
                            </span>
                          )}
                        </button>
                        {task.node_id && (
                          <Link to={`/dashboard/revision/${encodeURIComponent(task.node_id)}`}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#C1592B] hover:underline">
                            Open practice questions <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-[13px] text-[#1F2420]/65 max-w-xl">
                  No plan yet today. Pick a mood and the time you have — the planner diffs your
                  mastery graph and builds the session.
                </p>
              )}
            </div>

            {/* Platform Pulse: what you actually solved, refreshed on open */}
            <PlatformPulseCard pulse={pulse} />

            {/* Scroll-Driven Section-by-Section Experience (Replaces old static 3-card grid) */}
            <DashboardSections
              payload={payload}
              isWelcome={isWelcome}
              onActionClick={(action, topic) => {
                // Interactive action handler
                if (action === 'start_revision' && topic) {
                  navigate(`/dashboard/revision/${encodeURIComponent(topic.id)}`);
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
