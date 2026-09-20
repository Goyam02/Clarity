import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Sparkles, Upload, ScanLine, Globe, GraduationCap, Compass, HelpCircle } from 'lucide-react';
import { ClarityLogo } from '../components/Logos';
import { OnboardingPayload, UserProfiles, UserGoals, ResumeSignal, ScreenshotSignal, PlatformPull } from './types';
import { getDefaultSkillRatings } from './data/skillTopics';
import { ProgressIndicator } from './components/ProgressIndicator';
import { ProfilesStep } from './steps/ProfilesStep';
import { SkillRatingsStep } from './steps/SkillRatingsStep';
import { GoalsStep } from './steps/GoalsStep';
import { GeneratingStep } from './steps/GeneratingStep';
import { generateKnowledgeGraph } from '../lib/graph/generate';
import { ONBOARDING_TOPIC_CATALOG } from '../lib/graph/catalog';
import {
  onboardingApi, CalibrationQuestion, CalibrationSummary,
} from '../lib/api/endpoints';
import { ApiError } from '../lib/api/client';

const STORAGE_KEY = 'clarity_onboarding_draft';
const COMPLETED_KEY = 'clarity_completed_profile';

const INITIAL_PROFILES: UserProfiles = {
  leetcode: '',
  codeforces: '',
  gfg: '',
  github: '',
  hackerrank: '',
  codechef: '',
};

const INITIAL_LC_TOKENS = { session: '', csrf: '' };

const INITIAL_GOALS: UserGoals = {
  dreamCompany: 'Google',
  targetRole: 'sde',
  placementTimeline: 'autumn-winter-2026',
};

/**
 * Spec §3 "Maximum Real Signal" flow — 7 screens:
 * 1 Account (handled by /signup before this route) → so here:
 * 1 Resume Upload · 2 Scan Your Coding Profiles (screenshots)
 * 3 Real Platform Pulls (Codeforces + GitHub) · 4 Calibration Quiz
 * 5 Skill Confidence (self-report, the existing sliders)
 * 6 Current Focus + Targets · 7 Graph Reveal
 */
const STEP_LABELS = [
  'Resume',
  'Profile Scan',
  'Platform Pulls',
  'Calibration',
  'Skill Confidence',
  'Focus & Targets',
];
const TOTAL_STEPS = 6;
const GENERATING = 7; // virtual final "screen"

export const OnboardingFlow: React.FC = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<number>(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Form state
  const [profiles, setProfiles] = useState<UserProfiles>(INITIAL_PROFILES);
  const [lcTokens, setLcTokens] = useState(INITIAL_LC_TOKENS);
  const [skillRatings, setSkillRatings] = useState<Record<string, number>>(() => getDefaultSkillRatings());
  const [goals, setGoals] = useState<UserGoals>(INITIAL_GOALS);
  const [resume, setResume] = useState<ResumeSignal | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotSignal[]>([]);
  const [platformPulls, setPlatformPulls] = useState<PlatformPull | null>(null);
  const [showLcHelp, setShowLcHelp] = useState(false);

  // Calibration state (screen 4)
  const [calRunId, setCalRunId] = useState<string | null>(null);
  const [calQuestion, setCalQuestion] = useState<CalibrationQuestion | null>(null);
  const [calAnswered, setCalAnswered] = useState(0);
  const [calCorrect, setCalCorrect] = useState(0);
  const [calStartedAt, setCalStartedAt] = useState<number>(0);
  const [calSummary, setCalSummary] = useState<CalibrationSummary | null>(null);
  const [calBusy, setCalBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  void HelpCircle; // reserved for inline token help tooltip

  // Rehydrate
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<OnboardingPayload>
          & { currentStep?: number; maxReachedStep?: number };
        if (parsed.profiles) setProfiles(parsed.profiles);
        if (parsed.skillRatings) setSkillRatings(parsed.skillRatings);
        if (parsed.goals) setGoals(parsed.goals);
        if (parsed.resume !== undefined) setResume(parsed.resume);
        if (parsed.screenshots) setScreenshots(parsed.screenshots);
        if (parsed.currentStep && parsed.currentStep >= 1 && parsed.currentStep <= TOTAL_STEPS) {
          setCurrentStep(parsed.currentStep);
        }
        if (parsed.maxReachedStep) setMaxReachedStep(parsed.maxReachedStep);
        setLastSavedTime('Restored draft');
      }
    } catch {
      // LocalStorage fallback
    }
  }, []);

  // Persist draft
  useEffect(() => {
    if (isGenerating) return;
    try {
      const payload: OnboardingPayload & { currentStep: number; maxReachedStep: number } = {
        profiles, skillRatings, goals, resume, screenshots, platformPulls,
        calibration: calRunId ? { runId: calRunId, answered: calAnswered, correct: calCorrect } : null,
        currentStep, maxReachedStep,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // Ignore quota errors
    }
  }, [profiles, skillRatings, goals, resume, screenshots, platformPulls,
      calRunId, calAnswered, calCorrect, currentStep, maxReachedStep, isGenerating]);

  // --- per-step validation ---------------------------------------------------
  const isStepValid = useMemo(() => {
    switch (currentStep) {
      case 1: return true; // resume optional (free signal, never blocks)
      case 2: return true; // screenshots optional
      case 3: return true; // pulls optional (may run later)
      case 4: return calSummary !== null; // calibration done (or skipped via finish)
      case 5: return Object.keys(skillRatings).length > 0;
      case 6: return Boolean(goals.dreamCompany?.trim() && goals.placementTimeline);
      default: return false;
    }
  }, [currentStep, calSummary, skillRatings, goals]);

  const canProceed = isStepValid;
  const calibrationSkippable = currentStep === 4 && calSummary === null;

  // --- screen 3: real platform pulls ------------------------------------------
  const runPlatformPulls = useCallback(async () => {
    setStepError(null);
    setCalBusy(true);
    try {
      const lcProvided = Boolean(lcTokens.session.trim() && lcTokens.csrf.trim());
      const res = await onboardingApi.signals(
        profiles.codeforces || '', profiles.github || '',
        lcProvided ? { session: lcTokens.session.trim(), csrf: lcTokens.csrf.trim() } : undefined);
      const cf = res.codeforces as PlatformPull['codeforces'] | undefined;
      const gh = res.github as PlatformPull['github'] | undefined;
      setPlatformPulls({
        codeforces: cf ? { ...cf, handle: profiles.codeforces || cf.handle || '' } : undefined,
        github: gh ? { ...gh, username: profiles.github || gh.username || '' } : undefined,
        leetcode: res.leetcode ? {
          username: res.leetcode.username,
          totalSolved: res.leetcode.total_solved,
          blendedCount: res.leetcode.blended?.length ?? 0,
        } : undefined,
      });
      // Tokens verified + stored server-side — clear the plaintext immediately.
      if (lcProvided) setLcTokens(INITIAL_LC_TOKENS);
    } catch (err) {
      setStepError(err instanceof ApiError
        ? `${err.message} (you can continue — this signal is optional)`
        : 'Platform pull failed — you can continue.');
    } finally {
      setCalBusy(false);
    }
  }, [profiles.codeforces, profiles.github, lcTokens]);

  // --- screen 4: adaptive calibration ------------------------------------------
  const startCalibration = useCallback(async () => {
    setStepError(null);
    setCalBusy(true);
    try {
      const res = await onboardingApi.calibrationStart();
      setCalRunId(res.run_id);
      setCalQuestion(res.question);
      setCalStartedAt(Date.now());
    } catch (err) {
      setStepError(err instanceof ApiError ? err.message : 'Could not start the calibration quiz.');
    } finally {
      setCalBusy(false);
    }
  }, []);

  const answerCalibration = useCallback(async (correct: boolean) => {
    if (!calRunId) return;
    setCalBusy(true);
    const solveTime = Math.max(5, (Date.now() - calStartedAt) / 1000);
    try {
      const res = await onboardingApi.calibrationAnswer(calRunId, correct, solveTime);
      setCalAnswered((n) => n + 1);
      if (correct) setCalCorrect((n) => n + 1);
      if (res.done) {
        setCalSummary(res.summary || null);
        setCalQuestion(null);
      } else if (res.question) {
        setCalQuestion(res.question);
        setCalStartedAt(Date.now());
      }
    } catch (err) {
      setStepError(err instanceof ApiError ? err.message : 'Answer failed — try again.');
    } finally {
      setCalBusy(false);
    }
  }, [calRunId, calStartedAt]);

  // --- resume + screenshot parsing (vision endpoints) ---------------------------
  const uploadFile = useCallback(async (kind: 'resume' | 'screenshot', file: File) => {
    setStepError(null);
    setCalBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(
        `${(import.meta.env?.VITE_API_BASE_URL as string || 'http://localhost:8000').replace(/\/$/, '')}/api/v1/uploads/${kind}`,
        { method: 'POST', body: fd,
          headers: { Authorization: `Bearer ${localStorage.getItem('clarity_auth_token') || ''}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      if (kind === 'resume') {
        setResume({
          fileName: file.name,
          skills: (data?.skills || data?.extraction?.skills || []) as string[],
          projects: (data?.projects || data?.extraction?.projects || []) as string[],
        });
      } else {
        setScreenshots((prev) => [...prev, {
          fileName: file.name,
          platform: 'leetcode',
          solvedCounts: data?.solved_counts,
          topicBreakdown: data?.topic_breakdown,
        }]);
      }
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Vision extraction failed.');
    } finally {
      setCalBusy(false);
    }
  }, []);

  // --- navigation ---------------------------------------------------------------
  const handleNext = () => {
    if (!canProceed) return;
    if (currentStep < TOTAL_STEPS) {
      setDirection('forward');
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setMaxReachedStep((prev) => Math.max(prev, nextStep));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setDirection('forward');
      setIsGenerating(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1 && !isGenerating) {
      setDirection('backward');
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepJump = (targetStep: number) => {
    if (targetStep >= 1 && targetStep <= maxReachedStep && !isGenerating) {
      setDirection(targetStep > currentStep ? 'forward' : 'backward');
      setCurrentStep(targetStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSkipCalibration = () => {
    setCalSummary({ signals: [], total: 0 });
  };

  // Completion
  const handleGenerationComplete = (finalPayload: OnboardingPayload) => {
    const fullPayload: OnboardingPayload = {
      ...finalPayload,
      resume,
      screenshots,
      platformPulls,
      calibration: calSummary ? { runId: calRunId || '', answered: calAnswered, correct: calCorrect } : null,
      completedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(fullPayload));
      localStorage.removeItem(STORAGE_KEY);
      const graph = generateKnowledgeGraph({
        catalog: ONBOARDING_TOPIC_CATALOG,
        ratings: fullPayload.skillRatings,
        targetCompany: fullPayload.goals?.dreamCompany,
        timeline: fullPayload.goals?.placementTimeline,
      });
      localStorage.setItem('clarity_knowledge_graph', JSON.stringify(graph));
    } catch {
      // LocalStorage fallback
    }

    // Persist focus + targets to the backend (screen 6 contract)
    void onboardingApi.focus({
      current_focus: '',
      target_companies: [fullPayload.goals.dreamCompany].filter(Boolean),
      placement_timeline: fullPayload.goals.placementTimeline,
      codeforces_handle: fullPayload.profiles.codeforces || '',
      github_username: fullPayload.profiles.github || '',
    }).catch(() => null);

    navigate('/dashboard?welcome=1');
  };

  const slideVariants = {
    enter: (dir: 'forward' | 'backward') => ({ x: dir === 'forward' ? 24 : -24, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 'forward' | 'backward') => ({ x: dir === 'forward' ? -24 : 24, opacity: 0 }),
  };

  const currentPayload: OnboardingPayload = { profiles, skillRatings, goals };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans relative selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Ambient glow */}
      <div className="absolute top-0 left-0 right-0 h-[460px] pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div
          className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[700px] sm:w-[900px] h-[340px] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(249, 115, 22, 0.16) 0%, rgba(251, 146, 60, 0.09) 35%, rgba(91, 107, 77, 0.05) 65%, transparent 85%)',
            filter: 'blur(50px)',
          }}
        />
      </div>

      {/* Header */}
      <header className="w-full relative z-20 border-b border-[#1F2420]/8 bg-[#FAF6F0]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="inline-block" title="Return to Clarity Home">
            <ClarityLogo className="scale-90 origin-left" />
          </Link>
          <div className="flex items-center gap-3">
            {lastSavedTime && (
              <span className="text-[11.5px] font-mono text-[#1F2420]/50 hidden sm:inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5B6B4D]" />
                <span>Autosaved</span>
              </span>
            )}
            <Link to="/" className="text-[13px] text-[#1F2420]/70 hover:text-[#C1592B] font-medium transition-colors">
              Exit to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-start relative z-10">
        {!isGenerating && (
          <div className="mb-6 sm:mb-8">
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={TOTAL_STEPS}
              stepLabels={STEP_LABELS}
              onStepClick={handleStepJump}
              maxReachedStep={maxReachedStep}
            />
          </div>
        )}

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isGenerating ? 'Generating Knowledge Graph'
            : `Step ${currentStep} of ${TOTAL_STEPS}: ${STEP_LABELS[currentStep - 1]}`}
        </div>

        <div
          className={`w-full rounded-[16px] bg-[#FBF9F5] border border-[#1F2420]/10 shadow-[0_8px_30px_rgba(40,35,25,0.05)] transition-all ${
            isGenerating ? 'p-4 sm:p-8' : 'p-5 sm:p-8 md:p-10'
          }`}
        >
          {isGenerating ? (
            <GeneratingStep payload={currentPayload} onComplete={handleGenerationComplete} />
          ) : (
            <div>
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentStep}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Screen 1: Resume Upload */}
                  {currentStep === 1 && (
                    <div className="space-y-5">
                      <StepHeader
                        icon={<Upload className="w-5 h-5" />}
                        title="Upload your resume"
                        subtitle="A vision model reads it directly — skills and projects become editable signal. Free, reliable, zero platform dependency."
                      />
                      <FileDrop
                        accept=".pdf"
                        hint="Drag & drop a PDF, or click to browse"
                        busy={calBusy}
                        onFile={(f) => void uploadFile('resume', f)}
                      />
                      {resume && (
                        <div className="p-4 rounded-[10px] bg-[#FAF6F0] border border-[#1F2420]/10 space-y-2">
                          <p className="text-[12px] font-mono text-[#1F2420]/60">{resume.fileName}</p>
                          <ChipRow label="Skills" items={resume.skills} />
                          <ChipRow label="Projects" items={resume.projects} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Screen 2: Scan Your Coding Profiles */}
                  {currentStep === 2 && (
                    <div className="space-y-5">
                      <StepHeader
                        icon={<ScanLine className="w-5 h-5" />}
                        title="Scan your coding profiles"
                        subtitle="Upload a screenshot of your LeetCode/GFG profile. No login, no tokens — a vision model reads solve counts and difficulty distribution off the image."
                      />
                      <FileDrop
                        accept="image/*"
                        hint="Drop a profile screenshot (png/jpg)"
                        busy={calBusy}
                        onFile={(f) => void uploadFile('screenshot', f)}
                      />
                      {screenshots.length > 0 && (
                        <div className="space-y-2">
                          {screenshots.map((s, i) => (
                            <div key={i} className="p-3.5 rounded-[10px] bg-[#FAF6F0] border border-[#1F2420]/10 flex items-center justify-between">
                              <div>
                                <p className="text-[13px] font-medium">{s.fileName}</p>
                                {s.solvedCounts?.total != null && (
                                  <p className="text-[11.5px] font-mono text-[#1F2420]/55">
                                    {s.solvedCounts.total} solved
                                    {s.solvedCounts.easy != null && ` · E${s.solvedCounts.easy}`}
                                    {s.solvedCounts.medium != null && ` / M${s.solvedCounts.medium}`}
                                    {s.solvedCounts.hard != null && ` / H${s.solvedCounts.hard}`}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setScreenshots((prev) => prev.filter((_, j) => j !== i))}
                                className="text-[12px] text-[#B8322A] hover:underline cursor-pointer"
                              >
                                remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Screen 3: Real Platform Pulls */}
                  {currentStep === 3 && (
                    <div className="space-y-5">
                      <StepHeader
                        icon={<Globe className="w-5 h-5" />}
                        title="Pull your real platform data"
                        subtitle="Codeforces and GitHub use their public APIs. LeetCode needs two cookies from your own browser — they are encrypted at rest, used only to read your own solve data, and wipeable in Settings anytime."
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label htmlFor="ob-cf" className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1">Codeforces handle</label>
                          <input
                            id="ob-cf"
                            value={profiles.codeforces || ''}
                            onChange={(e) => setProfiles((p) => ({ ...p, codeforces: e.target.value }))}
                            placeholder="tourist"
                            className="w-full px-3 py-2 text-[14px] bg-white border border-[#1F2420]/20 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
                          />
                        </div>
                        <div>
                          <label htmlFor="ob-gh" className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1">GitHub username</label>
                          <input
                            id="ob-gh"
                            value={profiles.github || ''}
                            onChange={(e) => setProfiles((p) => ({ ...p, github: e.target.value }))}
                            placeholder="octocat"
                            className="w-full px-3 py-2 text-[14px] bg-white border border-[#1F2420]/20 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
                          />
                        </div>
                      </div>

                      {/* LeetCode cookie tokens (2) */}
                      <div className="p-4 rounded-[10px] border border-[#FFA116]/30 bg-[#FFA116]/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-[13px] font-medium">
                            <span className="w-6 h-6 rounded-[4px] bg-[#FFA116]/15 text-[#FFA116] flex items-center justify-center font-bold text-xs">LC</span>
                            LeetCode cookies <span className="text-[11px] text-[#C1592B] font-semibold">(strongest signal)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowLcHelp((v) => !v)}
                            className="text-[12px] text-[#C1592B] hover:underline cursor-pointer"
                          >
                            {showLcHelp ? 'Hide' : 'How to get these?'}
                          </button>
                        </div>
                        {showLcHelp && (
                          <ol className="text-[12px] text-[#1F2420]/70 list-decimal ml-5 space-y-0.5">
                            <li>Log in to leetcode.com in your browser</li>
                            <li>Open DevTools (F12) → Application → Cookies → https://leetcode.com</li>
                            <li>Copy the values of <strong>LEETCODE_SESSION</strong> and <strong>csrftoken</strong></li>
                            <li>Paste both below — that's it. Encrypted at rest, never logged.</li>
                          </ol>
                        )}
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label htmlFor="ob-lc-session" className="block text-[11.5px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1">LEETCODE_SESSION</label>
                            <input
                              id="ob-lc-session"
                              type="password"
                              autoComplete="off"
                              value={lcTokens.session}
                              onChange={(e) => setLcTokens((t) => ({ ...t, session: e.target.value }))}
                              placeholder="eyJhbGciOiJI..."
                              className="w-full px-3 py-2 text-[13px] font-mono bg-white border border-[#1F2420]/20 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#FFA116]/50"
                            />
                          </div>
                          <div>
                            <label htmlFor="ob-lc-csrf" className="block text-[11.5px] font-mono uppercase tracking-wider text-[#1F2420]/70 mb-1">csrftoken</label>
                            <input
                              id="ob-lc-csrf"
                              type="password"
                              autoComplete="off"
                              value={lcTokens.csrf}
                              onChange={(e) => setLcTokens((t) => ({ ...t, csrf: e.target.value }))}
                              placeholder="32-character token"
                              className="w-full px-3 py-2 text-[13px] font-mono bg-white border border-[#1F2420]/20 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#FFA116]/50"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void runPlatformPulls()}
                        disabled={calBusy || (!profiles.codeforces && !profiles.github && !(lcTokens.session.trim() && lcTokens.csrf.trim()))}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[13px] font-medium disabled:opacity-40 cursor-pointer"
                      >
                        {calBusy ? <RefreshCwSmall /> : <Globe className="w-3.5 h-3.5" />}
                        Pull live signals
                      </button>
                      {platformPulls && (
                        <div className="p-4 rounded-[10px] bg-[#FAF6F0] border border-[#1F2420]/10 space-y-1.5 text-[13px]">
                          {platformPulls.leetcode && (
                            <p className="font-mono text-[12.5px]">
                              LeetCode: <strong>{platformPulls.leetcode.username}</strong>
                              {platformPulls.leetcode.totalSolved != null && ` · ${platformPulls.leetcode.totalSolved} solved`}
                              {` · ${platformPulls.leetcode.blendedCount} topic signals fed to your graph`}
                            </p>
                          )}
                          {platformPulls.codeforces && (
                            <p className="font-mono text-[12.5px]">
                              Codeforces: <strong>{platformPulls.codeforces.handle}</strong>
                              {platformPulls.codeforces.rating != null && ` · rating ${platformPulls.codeforces.rating}`}
                              {platformPulls.codeforces.solved != null && ` · ${platformPulls.codeforces.solved} solved`}
                              {platformPulls.codeforces.error && ` · ${platformPulls.codeforces.error}`}
                            </p>
                          )}
                          {platformPulls.github && (
                            <p className="font-mono text-[12.5px]">
                              GitHub: <strong>{platformPulls.github.username}</strong>
                              {platformPulls.github.topLanguages?.length
                                && ` · ${platformPulls.github.topLanguages.slice(0, 4).join(', ')}`}
                              {platformPulls.github.error && ` · ${platformPulls.github.error}`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Screen 4: Calibration Quiz */}
                  {currentStep === 4 && (
                    <div className="space-y-5">
                      <StepHeader
                        icon={<GraduationCap className="w-5 h-5" />}
                        title="Quick calibration quiz"
                        subtitle="8–10 adaptive questions across DSA + core CS. Difficulty follows your answers — this measures your level instead of asking you to guess it. ~4 minutes."
                      />
                      {calSummary ? (
                        <div className="p-4 rounded-[10px] bg-[#E3F2E9] border border-[#3F8F63]/30 text-[13.5px]">
                          Calibration complete — {calCorrect}/{calAnswered} correct.
                          {' '}Your graph starts from measured mastery, not vibes.
                        </div>
                      ) : calQuestion ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-[11.5px] font-mono text-[#1F2420]/55">
                            <span>Q{calQuestion.index + 1} · {calQuestion.topic} · difficulty {calQuestion.difficulty}/5</span>
                            <span>{calAnswered} answered</span>
                          </div>
                          <div className="p-4 rounded-[10px] bg-[#FAF6F0] border border-[#1F2420]/10">
                            <p className="text-[14.5px] font-medium mb-2">{calQuestion.title}</p>
                            <p className="text-[13.5px] text-[#1F2420]/80 whitespace-pre-wrap leading-relaxed">
                              {calQuestion.statement}
                            </p>
                            {calQuestion.test_cases?.[0] && (
                              <div className="mt-3 text-[12px] font-mono text-[#1F2420]/60 space-y-1">
                                <p>sample in: {calQuestion.test_cases[0].input}</p>
                                <p>sample out: {calQuestion.test_cases[0].output}</p>
                              </div>
                            )}
                          </div>
                          <p className="text-[12px] font-mono text-[#1F2420]/50">
                            Work it out, then self-mark honestly against the sample:
                          </p>
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              disabled={calBusy}
                              onClick={() => void answerCalibration(true)}
                              className="px-5 py-2.5 rounded-[6px] bg-[#3F8F63] hover:bg-[#2F6F4B] text-[#FAF6F0] text-[13.5px] font-medium disabled:opacity-40 cursor-pointer"
                            >
                              I solved it
                            </button>
                            <button
                              type="button"
                              disabled={calBusy}
                              onClick={() => void answerCalibration(false)}
                              className="px-5 py-2.5 rounded-[6px] border border-[#1F2420]/25 text-[#1F2420] text-[13.5px] font-medium hover:bg-[#1F2420]/5 disabled:opacity-40 cursor-pointer"
                            >
              Didn't get it
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void startCalibration()}
                          disabled={calBusy}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[13.5px] font-medium disabled:opacity-40 cursor-pointer"
                        >
                          {calBusy ? <RefreshCwSmall /> : <Sparkles className="w-4 h-4" />}
                          Start calibration
                        </button>
                      )}
                    </div>
                  )}

                  {/* Screen 5: Skill Confidence (existing sliders) */}
                  {currentStep === 5 && (
                    <SkillRatingsStep skillRatings={skillRatings} onChange={setSkillRatings} />
                  )}

                  {/* Screen 6: Focus + Targets (existing goals) */}
                  {currentStep === 6 && <GoalsStep goals={goals} onChange={setGoals} />}
                </motion.div>
              </AnimatePresence>

              {stepError && (
                <p className="mt-4 text-[12.5px] text-[#B8322A] font-mono">{stepError}</p>
              )}

              {/* Footer controls */}
              <div className="mt-8 sm:mt-10 pt-5 sm:pt-6 border-t border-[#1F2420]/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="w-full sm:w-auto px-5 py-[11px] text-[14px] font-medium text-[#1F2420] bg-transparent border border-[#1F2420]/25 rounded-[4px] hover:bg-[#1F2420]/5 active:bg-[#1F2420]/10 transition-all duration-150 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </button>
                  ) : (
                    <span className="text-[12px] text-[#1F2420]/45 font-normal hidden sm:inline">
                      Step 1 of {TOTAL_STEPS} · real signal first
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  {calibrationSkippable && (
                    <button
                      type="button"
                      onClick={handleSkipCalibration}
                      className="text-[12.5px] text-[#1F2420]/55 hover:text-[#1F2420] underline cursor-pointer"
                    >
                      Skip calibration (self-report only)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceed}
                    className="w-full sm:w-auto px-7 py-[12px] text-[14px] sm:text-[15px] font-medium text-[#FAF6F0] bg-[#1F2420] border border-[#1F2420] rounded-[4px] hover:bg-[#2e3730] active:bg-[#161a17] transition-all duration-150 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 select-none"
                  >
                    {currentStep === TOTAL_STEPS ? (
                      <>
                        <Compass className="w-4 h-4 text-[#FAF6F0]" />
                        <span>Generate My Knowledge Graph</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-[12px] text-[#1F2420]/50">
          <span>LeetCode cookies are encrypted at rest, used only to read your own data · wipe anytime in Settings</span>
        </div>
      </main>
    </div>
  );
};

// --- small local helpers ------------------------------------------------------

const StepHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({
  icon, title, subtitle,
}) => (
  <div className="space-y-1.5">
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-[#C1592B]/10 text-[#C1592B] text-[12px] font-bold uppercase tracking-wider">
      {icon}
      <span>Real Signal</span>
    </div>
    <h2 className="text-[22px] sm:text-[26px] font-normal tracking-[-0.02em]"
        style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}>
      {title}
    </h2>
    <p className="text-[13.5px] text-[#1F2420]/70 leading-relaxed max-w-2xl">{subtitle}</p>
  </div>
);

const RefreshCwSmall: React.FC = () => (
  <span className="w-3.5 h-3.5 border-2 border-[#FAF6F0]/30 border-t-[#FAF6F0] rounded-full animate-spin inline-block" />
);

const ChipRow: React.FC<{ label: string; items: string[] }> = ({ label, items }) => (
  <div>
    <span className="text-[11px] font-mono uppercase tracking-wider text-[#1F2420]/50 block mb-1">
      {label} {items.length === 0 && '(none detected — edit anytime)'}
    </span>
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className="px-2 py-0.5 rounded-[4px] bg-white border border-[#1F2420]/12 text-[12px]">
          {s}
        </span>
      ))}
    </div>
  </div>
);

const FileDrop: React.FC<{
  accept: string;
  hint: string;
  busy: boolean;
  onFile: (f: File) => void;
}> = ({ accept, hint, busy, onFile }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`p-8 rounded-[12px] border-2 border-dashed text-center cursor-pointer transition-colors ${
        dragOver ? 'border-[#C1592B] bg-[#C1592B]/5' : 'border-[#1F2420]/20 hover:border-[#1F2420]/40'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      {busy ? (
        <span className="inline-flex items-center gap-2 text-[13.5px] font-mono text-[#1F2420]/60">
          <span className="w-4 h-4 border-2 border-[#1F2420]/20 border-t-[#C1592B] rounded-full animate-spin" />
          Extracting signal...
        </span>
      ) : (
        <p className="text-[13.5px] text-[#1F2420]/60">{hint}</p>
      )}
    </div>
  );
};
