import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Monitor,
  Maximize2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface PreflightChecksProps {
  onStreamVerified: (stream: MediaStream) => void;
  onStartSession: () => void;
  onBack: () => void;
}

export const PreflightChecks: React.FC<PreflightChecksProps> = ({
  onStreamVerified,
  onStartSession,
  onBack,
}) => {
  const [browserSupported, setBrowserSupported] = useState<boolean>(true);
  const [displayMediaSupported, setDisplayMediaSupported] = useState<boolean>(true);
  const [mediaRecorderSupported, setMediaRecorderSupported] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  const [sharingActive, setSharingActive] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent;
    const mobileDetected = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    setIsMobile(mobileDetected);

    // Desktop Chromium check (Chrome, Chromium, Edge)
    const isChromium = (/Chrome/.test(ua) || /Edg/.test(ua)) && !mobileDetected;
    setBrowserSupported(isChromium);

    const hasDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    setDisplayMediaSupported(hasDisplayMedia);

    const hasMediaRecorder = typeof window.MediaRecorder !== 'undefined';
    setMediaRecorderSupported(hasMediaRecorder);
  }, []);

  const handleShareScreen = async () => {
    setShareError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setShareError('getDisplayMedia API is not supported in this browser environment.');
      return;
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
      if (!videoTrack) {
        setShareError('No video track detected from screen capture.');
        return;
      }

      const settings = videoTrack.getSettings();
      // VERIFY DISPLAY SURFACE IS ENTIRE MONITOR
      if (settings.displaySurface !== 'monitor') {
        // Must reject window or tab shares!
        videoTrack.stop();
        stream.getTracks().forEach((t) => t.stop());
        setShareError('Share your entire screen to continue. Application window or browser tab shares are strictly prohibited.');
        setSharingActive(false);
        setActiveStream(null);
        return;
      }

      // Track terminated listener
      videoTrack.addEventListener('ended', () => {
        setSharingActive(false);
        setActiveStream(null);
        setShareError('Screen sharing was ended. You must re-share your entire screen.');
      });

      setActiveStream(stream);
      setSharingActive(true);
      onStreamVerified(stream);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('Permission denied') || errorMsg.includes('cancelled')) {
        setShareError('Screen capture permission was declined. Please share your entire screen to proceed.');
      } else {
        setShareError(`Screen sharing initialization failed: ${errorMsg}`);
      }
      setSharingActive(false);
      setActiveStream(null);
    }
  };

  const handleStartExam = async () => {
    if (!sharingActive || !activeStream) return;
    setIsStarting(true);

    try {
      // Request full screen on document
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed or was bypassed:', err);
    }

    onStartSession();
  };

  const allChecksPass = browserSupported && displayMediaSupported && mediaRecorderSupported && !isMobile;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="bg-[#FBF9F5] border border-[#1F2420]/10 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="border-b border-[#1F2420]/10 pb-4 mb-6">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#C1592B] font-semibold">
            Pre-Flight System Verification
          </span>
          <h2 className="text-2xl font-serif text-[#1F2420] mt-1">
            Browser &amp; Screen Verification
          </h2>
          <p className="text-sm text-[#1F2420]/70 mt-1">
            Ensure your system satisfies proctoring requirements before entering the live session.
          </p>
        </div>

        {/* Mobile / Unsupported Browser Warning */}
        {(!allChecksPass || isMobile) && (
          <div className="p-4 rounded-lg bg-[#C1592B]/10 border border-[#C1592B]/30 text-[#1F2420] text-sm mb-6 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#C1592B]">
              <XCircle className="w-5 h-5" />
              <span>Unsupported Environment Detected</span>
            </div>
            <p className="text-xs leading-relaxed">
              {isMobile
                ? 'Mobile devices and tablets are not supported for Google Mock OAs. Please open this assessment on a desktop computer with Chrome or Edge.'
                : 'A desktop Chromium browser (Google Chrome or Microsoft Edge) with active Screen Capture & MediaRecorder APIs is required.'}
            </p>
          </div>
        )}

        {/* System Checklist */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#1F2420]/[0.02] border border-[#1F2420]/10">
            <div className="flex items-center gap-3">
              <Monitor className="w-4 h-4 text-[#1F2420]/70" />
              <div>
                <p className="text-sm font-medium text-[#1F2420]">Desktop Chromium Browser</p>
                <p className="text-xs text-[#1F2420]/60">Google Chrome or Microsoft Edge on desktop</p>
              </div>
            </div>
            <div>
              {browserSupported && !isMobile ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#3F8F63]">
                  <CheckCircle2 className="w-4 h-4" /> Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#C1592B]">
                  <XCircle className="w-4 h-4" /> Unsupported
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#1F2420]/[0.02] border border-[#1F2420]/10">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-[#1F2420]/70" />
              <div>
                <p className="text-sm font-medium text-[#1F2420]">Screen Capture API</p>
                <p className="text-xs text-[#1F2420]/60">navigator.mediaDevices.getDisplayMedia</p>
              </div>
            </div>
            <div>
              {displayMediaSupported ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#3F8F63]">
                  <CheckCircle2 className="w-4 h-4" /> Supported
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#C1592B]">
                  <XCircle className="w-4 h-4" /> Unavailable
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg bg-[#1F2420]/[0.02] border border-[#1F2420]/10">
            <div className="flex items-center gap-3">
              <Maximize2 className="w-4 h-4 text-[#1F2420]/70" />
              <div>
                <p className="text-sm font-medium text-[#1F2420]">MediaRecorder Engine</p>
                <p className="text-xs text-[#1F2420]/60">In-browser local WebM recording pipeline</p>
              </div>
            </div>
            <div>
              {mediaRecorderSupported ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#3F8F63]">
                  <CheckCircle2 className="w-4 h-4" /> Supported
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#C1592B]">
                  <XCircle className="w-4 h-4" /> Unavailable
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step 1: Screen Share Section */}
        <div className="p-4 rounded-lg bg-[#1F2420]/[0.03] border border-[#1F2420]/10 space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1F2420] text-[#FAF6F0] text-xs font-mono flex items-center justify-center">
                1
              </span>
              <span className="text-sm font-semibold text-[#1F2420]">
                Step 1: Share Entire Display Monitor
              </span>
            </div>

            {sharingActive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#3F8F63]/10 text-[#3F8F63] text-xs font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            )}
          </div>

          <p className="text-xs text-[#1F2420]/75 leading-relaxed">
            In the browser prompt, select <strong>"Entire Screen"</strong>. Selecting a specific
            application window or single tab is rejected by the proctoring verification system.
          </p>

          {shareError && (
            <div className="p-3 rounded-md bg-[#C1592B]/10 border border-[#C1592B]/20 text-xs text-[#C1592B] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{shareError}</span>
            </div>
          )}

          <div>
            <button
              id="btn-share-screen"
              type="button"
              disabled={!allChecksPass || sharingActive}
              onClick={handleShareScreen}
              className={`px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                sharingActive
                  ? 'bg-[#3F8F63]/15 text-[#3F8F63] cursor-default'
                  : allChecksPass
                  ? 'bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] cursor-pointer shadow-xs'
                  : 'bg-[#1F2420]/20 text-[#FAF6F0]/60 cursor-not-allowed'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>{sharingActive ? 'Entire Screen Shared & Verified' : 'Share Entire Screen'}</span>
            </button>
          </div>
        </div>

        {/* Step 2: Start Assessment (User Gesture 2) */}
        <div className="p-4 rounded-lg bg-[#1F2420]/[0.03] border border-[#1F2420]/10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#1F2420] text-[#FAF6F0] text-xs font-mono flex items-center justify-center">
              2
            </span>
            <span className="text-sm font-semibold text-[#1F2420]">
              Step 2: Enter Fullscreen &amp; Begin Assessment
            </span>
          </div>

          <p className="text-xs text-[#1F2420]/75 leading-relaxed">
            Clicking <strong>Start Assessment</strong> will expand the browser to full screen and
            activate the 70-minute assessment timer and proctoring engine.
          </p>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-mono text-[#1F2420]/60 hover:text-[#1F2420] cursor-pointer"
            >
              ← Back to Overview
            </button>

            <button
              id="btn-start-exam"
              type="button"
              disabled={!sharingActive || isStarting}
              onClick={handleStartExam}
              className={`px-6 py-3 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                sharingActive && !isStarting
                  ? 'bg-[#C1592B] hover:bg-[#a6481e] text-[#FAF6F0] cursor-pointer shadow-md'
                  : 'bg-[#1F2420]/20 text-[#FAF6F0]/60 cursor-not-allowed'
              }`}
            >
              {isStarting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Entering Session...</span>
                </>
              ) : (
                <>
                  <span>Start Assessment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
