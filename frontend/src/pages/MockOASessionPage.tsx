import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMockOA, submitMockOA } from '../lib/mock-oa/api';
import {
  MockOAPayload,
  MockOASessionData,
  ProblemSubmissionStatus,
  SupportedLanguage,
  AssessmentOutcome,
} from '../lib/mock-oa/types';
import {
  getStoredSession,
  saveStoredSession,
  setStoredState,
} from '../lib/mock-oa/machine';
import { mockOARuntime } from '../lib/mock-oa/runtime';
import { MAX_VIOLATIONS } from '../lib/proctor/browserProctor';
import { ProctorViolation } from '../lib/proctor/types';
import { ExamTopBar } from '../components/mock-oa/ExamTopBar';
import { ProblemPanel } from '../components/mock-oa/ProblemPanel';
import { CoddyEditor } from '../components/mock-oa/CoddyEditor';
import { SubmitDialog } from '../components/mock-oa/SubmitDialog';
import { ViolationBanner } from '../components/mock-oa/ViolationBanner';
import { BlockingOverlay } from '../components/mock-oa/BlockingOverlay';
import MockOALayout from './MockOALayout';
import { RefreshCw, FileText, Code } from 'lucide-react';

export default function MockOASessionPage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<MockOAPayload | null>(null);
  const [session, setSession] = useState<MockOASessionData | null>(null);

  // Active problem selection
  const [activeProblemId, setActiveProblemId] = useState<string>('');

  // Responsive mobile/desktop tabs below 1024px
  const [mobileTab, setMobileTab] = useState<'problem' | 'editor'>('problem');
  const [isFocusedEditor, setIsFocusedEditor] = useState<boolean>(false);

  // Submitting dialog modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Proctor state
  const [activeViolation, setActiveViolation] = useState<ProctorViolation | null>(null);
  const [isExitedFullscreen, setIsExitedFullscreen] = useState<boolean>(false);
  const [isShareStopped, setIsShareStopped] = useState<boolean>(false);

  // Guard: load session & payload
  useEffect(() => {
    const stored = getStoredSession();
    if (!stored || !stored.active) {
      // Direct visits without active session redirect to /mock-oa
      navigate('/mock-oa', { replace: true });
      return;
    }

    setSession(stored);
    setActiveProblemId(stored.currentProblemId || 'p1');

    fetchMockOA(stored.assessmentId).then((p) => {
      setPayload(p);
    });
  }, [navigate]);

  // Handle final submission
  const handleFinalSubmit = useCallback(
    async (outcome: AssessmentOutcome = 'completed') => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      const currentSession = getStoredSession() || session;
      if (!currentSession) {
        navigate('/mock-oa/result');
        return;
      }

      const finalizedSession: MockOASessionData = {
        ...currentSession,
        active: false,
        outcome,
        finishedAt: Date.now(),
      };

      saveStoredSession(finalizedSession);
      setStoredState('finished');

      // Finalize recorder and cleanup runtime
      if (mockOARuntime.recorder && mockOARuntime.recorder.state !== 'inactive') {
        try {
          mockOARuntime.recorder.stop();
        } catch {
          // ignore
        }
      }
      if (mockOARuntime.store) {
        await mockOARuntime.store.finalize().catch(() => null);
      }
      mockOARuntime.cleanup();

      // Exit fullscreen if active
      if (document.fullscreenElement && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch {
          // ignore
        }
      }

      // Submit to data seam
      await submitMockOA(finalizedSession);
      navigate('/mock-oa/result', { replace: true });
    },
    [isSubmitting, session, navigate]
  );

  // Proctor listener & runtime setup
  useEffect(() => {
    if (!session || !session.active) return;

    let proctor = mockOARuntime.proctor;
    if (!proctor) {
      // If reloaded or stream lost, prompt re-share
      setIsShareStopped(true);
    }

    // Proctor violation subscription
    const handleViolation = (v: ProctorViolation) => {
      setActiveViolation(v);

      setSession((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          violations: [...prev.violations, v],
        };
        saveStoredSession(updated);

        // Check if max violations reached
        if (updated.violations.length >= MAX_VIOLATIONS) {
          setTimeout(() => {
            handleFinalSubmit('violation_limit');
          }, 1500);
        }

        return updated;
      });

      if (v.type === 'FULLSCREEN_EXIT') {
        setIsExitedFullscreen(true);
      } else if (v.type === 'SHARE_STOPPED') {
        setIsShareStopped(true);
      }
    };

    if (proctor) {
      const unsub = proctor.onViolation(handleViolation);
      return () => unsub();
    }
  }, [session?.active, handleFinalSubmit]);

  // Fullscreen state listener
  useEffect(() => {
    const checkFullscreen = () => {
      if (!document.fullscreenElement) {
        setIsExitedFullscreen(true);
      } else {
        setIsExitedFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', checkFullscreen);
    return () => document.removeEventListener('fullscreenchange', checkFullscreen);
  }, []);

  // Time spent accumulator per active problem
  useEffect(() => {
    if (!session || !session.active || isSubmitModalOpen) return;

    const interval = setInterval(() => {
      setSession((prev) => {
        if (!prev || !prev.active) return prev;
        const currentProb = activeProblemId || prev.currentProblemId;
        const currentSecs = prev.timeSpentSeconds[currentProb] || 0;
        const updated = {
          ...prev,
          timeSpentSeconds: {
            ...prev.timeSpentSeconds,
            [currentProb]: currentSecs + 1,
          },
        };
        saveStoredSession(updated);
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.active, activeProblemId, isSubmitModalOpen]);

  // Handle language change for a problem
  const handleChangeLanguage = (problemId: string, newLang: SupportedLanguage) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        selectedLanguages: {
          ...prev.selectedLanguages,
          [problemId]: newLang,
        },
      };
      saveStoredSession(updated);
      return updated;
    });
  };

  // Handle problem selection tab
  const handleSelectProblem = (id: string) => {
    setActiveProblemId(id);
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, currentProblemId: id };
      saveStoredSession(updated);
      return updated;
    });
  };

  // Handle problem status update
  const handleChangeStatus = (problemId: string, status: ProblemSubmissionStatus) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        statuses: {
          ...prev.statuses,
          [problemId]: status,
        },
      };
      saveStoredSession(updated);
      return updated;
    });
  };

  // Reshare screen handler for blocking overlay
  const handleReshareScreen = async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 5, max: 10 },
        },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.getSettings().displaySurface !== 'monitor') {
        videoTrack?.stop();
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }

      mockOARuntime.stream = stream;
      if (mockOARuntime.proctor) {
        mockOARuntime.proctor.updateStream(stream);
      }

      setIsShareStopped(false);
      return true;
    } catch {
      return false;
    }
  };

  const handleRequestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setIsExitedFullscreen(false);
    } catch {
      // ignore
    }
  };

  if (!payload || !session) {
    return (
      <MockOALayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 font-mono text-sm text-[#1F2420]/70">
            <RefreshCw className="w-4 h-4 animate-spin text-[#C1592B]" />
            <span>Connecting to live session...</span>
          </div>
        </div>
      </MockOALayout>
    );
  }

  const activeProblem =
    payload.problems.find((p) => p.id === activeProblemId) || payload.problems[0];
  const activeProblemIndex = payload.problems.findIndex((p) => p.id === activeProblem.id);

  return (
    <MockOALayout>
      <div className="h-screen w-full flex flex-col bg-[#FAF6F0] overflow-hidden">
        {/* Top bar */}
        <ExamTopBar
          company={payload.company}
          endsAt={session.endsAt}
          problems={payload.problems}
          activeProblemId={activeProblem.id}
          problemStatuses={session.statuses}
          violationsCount={session.violations.length}
          maxViolations={MAX_VIOLATIONS}
          onSelectProblem={handleSelectProblem}
          onSubmitClick={() => setIsSubmitModalOpen(true)}
          onTimeout={() => handleFinalSubmit('timeout')}
        />

        {/* Violation Warning Toast Banner */}
        <ViolationBanner
          violation={activeViolation}
          totalViolations={session.violations.length}
          maxViolations={MAX_VIOLATIONS}
          onDismiss={() => setActiveViolation(null)}
        />

        {/* Blocking Overlays (Fullscreen exit, Screen share stopped) */}
        <BlockingOverlay
          isExitedFullscreen={isExitedFullscreen}
          isShareStopped={isShareStopped}
          onRequestFullscreen={handleRequestFullscreen}
          onReshareScreen={handleReshareScreen}
        />

        {/* Mobile Tab Switcher (Visible only below 1024px) */}
        <div className="lg:hidden bg-[#FAF6F0] border-b border-[#1F2420]/10 px-4 py-1.5 flex items-center justify-around">
          <button
            type="button"
            onClick={() => setMobileTab('problem')}
            className={`flex items-center gap-1.5 text-xs font-mono py-1 px-4 rounded-md transition-colors cursor-pointer ${
              mobileTab === 'problem'
                ? 'bg-[#1F2420] text-[#FAF6F0]'
                : 'text-[#1F2420]/70 hover:bg-[#1F2420]/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Problem Description</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            className={`flex items-center gap-1.5 text-xs font-mono py-1 px-4 rounded-md transition-colors cursor-pointer ${
              mobileTab === 'editor'
                ? 'bg-[#1F2420] text-[#FAF6F0]'
                : 'text-[#1F2420]/70 hover:bg-[#1F2420]/5'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Coddy Editor</span>
          </button>
        </div>

        {/* Main Work Area: Left Panel (40%) + Right Panel (60%) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Panel: Problem Statement (40% width on lg) */}
          <div
            className={`h-full ${
              isFocusedEditor
                ? 'hidden'
                : mobileTab === 'problem'
                ? 'w-full lg:w-[40%] flex'
                : 'hidden lg:w-[40%] lg:flex'
            }`}
          >
            <ProblemPanel
              problem={activeProblem}
              problemIndex={activeProblemIndex}
              totalProblems={payload.problems.length}
              isFocusedEditor={isFocusedEditor}
              onToggleFocusEditor={() => setIsFocusedEditor(!isFocusedEditor)}
            />
          </div>

          {/* Right Panel: Coddy Embed Editor (60% width on lg, or 100% if focused) */}
          <div
            className={`h-full ${
              isFocusedEditor
                ? 'w-full flex'
                : mobileTab === 'editor'
                ? 'w-full lg:w-[60%] flex'
                : 'hidden lg:w-[60%] lg:flex'
            }`}
          >
            {/* KEEP BOTH IFRAMES MOUNTED IN DOM TO PRESERVE CODE ON PROBLEM SWITCH */}
            {payload.problems.map((prob) => (
              <CoddyEditor
                key={prob.id}
                problem={prob}
                selectedLanguage={session.selectedLanguages[prob.id] || 'python'}
                onChangeLanguage={handleChangeLanguage}
                isVisible={prob.id === activeProblem.id}
              />
            ))}
          </div>
        </div>

        {/* Submit Confirmation Dialog */}
        <SubmitDialog
          isOpen={isSubmitModalOpen}
          problems={payload.problems}
          statuses={session.statuses}
          onChangeStatus={handleChangeStatus}
          onConfirmSubmit={() => handleFinalSubmit('completed')}
          onCancel={() => setIsSubmitModalOpen(false)}
          isSubmitting={isSubmitting}
        />
      </div>
    </MockOALayout>
  );
}
