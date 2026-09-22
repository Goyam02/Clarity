import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchMockOA } from '../lib/mock-oa/api';
import { MockOAPayload } from '../lib/mock-oa/types';
import { initializeSession, getStoredSession, clearMockOASession } from '../lib/mock-oa/machine';
import { mockOARuntime } from '../lib/mock-oa/runtime';
import { Instructions } from '../components/mock-oa/Instructions';
import { PreflightChecks } from '../components/mock-oa/PreflightChecks';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import MockOALayout from './MockOALayout';

export default function MockOAInstructionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [payload, setPayload] = useState<MockOAPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<'instructions' | 'preflight'>('instructions');
  const [verifiedStream, setVerifiedStream] = useState<MediaStream | null>(null);
  const [existingActiveSession, setExistingActiveSession] = useState<boolean>(false);
  const requestRef = useRef<Promise<MockOAPayload> | null>(null);

  useEffect(() => {
    // A CODE RED launch carries the pre-sized backend session in ?session=;
    // otherwise the data seam generates a fresh standalone assessment.
    const backendSessionId = searchParams.get('session') || undefined;
    let active = true;
    // Reuse the in-flight creation during StrictMode's effect replay.
    requestRef.current ??= fetchMockOA(backendSessionId);
    requestRef.current
      .then((data) => { if (active) setPayload(data); })
      .catch((error) => { if (active) setLoadError(error.message || 'Could not load the assessment.'); });

    const existing = getStoredSession();
    if (existing && existing.active && existing.endsAt > Date.now()) {
      setExistingActiveSession(true);
    }
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartExam = () => {
    if (!payload || !verifiedStream) return;

    // Initialize in-memory runtime (recorder + proctor)
    const { proctor } = mockOARuntime.initializeRuntime(verifiedStream);

    // Initialize session state
    initializeSession(payload.id, payload.durationMinutes, payload.problems);

    // Start proctoring signals
    proctor.start(verifiedStream);

    // Navigate to live session route
    navigate('/mock-oa/session');
  };

  const handleResumeExisting = () => {
    navigate('/mock-oa/session');
  };

  const handleResetSession = () => {
    clearMockOASession();
    mockOARuntime.cleanup();
    setExistingActiveSession(false);
  };

  if (loadError) {
    return (
      <MockOALayout>
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
          <AlertTriangle className="w-8 h-8 text-[#B8322A]" />
          <p className="text-sm text-[#1F2420]/80 max-w-sm text-center">{loadError}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 rounded-[6px] bg-[#1F2420] text-[#FAF6F0] text-[13px] font-medium hover:bg-[#C1592B] transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </MockOALayout>
    );
  }

  if (!payload) {
    return (
      <MockOALayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 font-mono text-sm text-[#1F2420]/70">
            <RefreshCw className="w-4 h-4 animate-spin text-[#C1592B]" />
            <span>Generating your assessment...</span>
          </div>
        </div>
      </MockOALayout>
    );
  }

  return (
    <MockOALayout>
      <div className="w-full min-h-screen py-10 px-4 sm:px-6 flex flex-col justify-between">
        {/* Top return link */}
        <div className="max-w-3xl mx-auto w-full mb-6">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#1F2420]/60 hover:text-[#1F2420] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </button>
        </div>

        {/* Existing active session prompt */}
        {existingActiveSession && (
          <div className="max-w-3xl mx-auto w-full mb-6 p-4 rounded-xl bg-[#E5A83B]/15 border border-[#E5A83B]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#8a5b0f]">
              <AlertTriangle className="w-4 h-4" />
              <span>An active assessment session was found in progress on this device.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetSession}
                className="px-3 py-1.5 rounded-md border border-[#8a5b0f]/30 hover:bg-[#8a5b0f]/10 text-[#8a5b0f] font-mono cursor-pointer"
              >
                Reset &amp; Start Over
              </button>
              <button
                type="button"
                onClick={handleResumeExisting}
                className="px-3 py-1.5 rounded-md bg-[#8a5b0f] text-[#FAF6F0] hover:bg-[#724a0a] font-mono cursor-pointer shadow-xs"
              >
                Resume Active Session
              </button>
            </div>
          </div>
        )}

        {/* Main Step Content */}
        <div className="flex-1 flex flex-col justify-center">
          {step === 'instructions' ? (
            <Instructions
              payload={payload}
              onProceed={() => setStep('preflight')}
            />
          ) : (
            <PreflightChecks
              onStreamVerified={(stream) => setVerifiedStream(stream)}
              onStartSession={handleStartExam}
              onBack={() => setStep('instructions')}
            />
          )}
        </div>

        {/* Minimal Footer */}
        <footer className="max-w-3xl mx-auto w-full mt-10 pt-4 border-t border-[#1F2420]/10 text-center text-xs font-mono text-[#1F2420]/40">
          Clarity Assessment Engine · {payload.company} · {payload.year}
        </footer>
      </div>
    </MockOALayout>
  );
}
