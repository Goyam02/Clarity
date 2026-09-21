import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMockOA } from '../lib/mock-oa/api';
import { MockOAPayload, MockOASessionData } from '../lib/mock-oa/types';
import { getStoredSession, clearMockOASession } from '../lib/mock-oa/machine';
import { createRecordingStore } from '../lib/proctor/recordingStore';
import { ResultSummary } from '../components/mock-oa/ResultSummary';
import MockOALayout from './MockOALayout';
import { RefreshCw } from 'lucide-react';

export default function MockOAResultPage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<MockOAPayload | null>(null);
  const [session, setSession] = useState<MockOASessionData | null>(null);

  useEffect(() => {
    let stored = getStoredSession();

    // Also check last submission fallback
    if (!stored) {
      try {
        const last = sessionStorage.getItem('clarity_mock_oa_last_submission');
        if (last) {
          stored = JSON.parse(last);
        }
      } catch {
        // ignore
      }
    }

    if (!stored) {
      // Direct visits to /result without matching state redirect to /mock-oa
      navigate('/mock-oa', { replace: true });
      return;
    }

    setSession(stored);
    fetchMockOA(stored.assessmentId).then((p) => setPayload(p));
  }, [navigate]);

  const handleRetake = () => {
    clearMockOASession();
    navigate('/mock-oa');
  };

  if (!payload || !session) {
    return (
      <MockOALayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 font-mono text-sm text-[#1F2420]/70">
            <RefreshCw className="w-4 h-4 animate-spin text-[#C1592B]" />
            <span>Loading assessment diagnostic report...</span>
          </div>
        </div>
      </MockOALayout>
    );
  }

  const recordingStore = createRecordingStore('current_mock_oa');

  return (
    <MockOALayout>
      <div className="w-full min-h-screen py-10 px-4 sm:px-6">
        <ResultSummary
          payload={payload}
          sessionData={session}
          recordingStore={recordingStore}
          onRetake={handleRetake}
        />
      </div>
    </MockOALayout>
  );
}
