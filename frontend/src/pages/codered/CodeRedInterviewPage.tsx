import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Mic, MicOff, RefreshCw, AlertTriangle, Send, Sparkles, ArrowLeft,
  PhoneOff, Volume2,
} from 'lucide-react';
import { interviewsApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import {
  GeminiVoiceInterviewer, postInterviewEvent, TranscriptLine, VoiceStage,
} from '../../lib/geminiLive';

/**
 * Mock interview (spec §6b) — voice-first, Gemini Live voice-to-voice.
 * The screen is primarily a spoken interviewer; the code editor is hidden
 * until the interviewer's `show_editor` tool call reveals it (animated).
 * Every transcript line is mirrored to the backend interview session so the
 * existing debrief pipeline keeps working unchanged.
 */
export const CodeRedInterviewPage: React.FC = () => {
  const { sessionId = '' } = useParams(); // optional CODE RED session linkage
  const navigate = useNavigate();

  const [interviewId, setInterviewId] = useState<string>('');
  const [problemTitle] = useState<string>('the problem');
  const [stage, setStage] = useState<VoiceStage>('idle');
  const [micOn, setMicOn] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [speechDraft, setSpeechDraft] = useState('');
  const [hints, setHints] = useState<string[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [code, setCode] = useState('# think aloud while you code\n');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const startedRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const interviewerRef = useRef<GeminiVoiceInterviewer | null>(null);

  const addLine = useCallback((line: TranscriptLine) => {
    setTranscript((prev) => [...prev, line]);
  }, []);

  // Create the backend interview session once (debrief + transcript storage).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const { session_id } = await interviewsApi.create();
        setInterviewId(session_id);
        await postInterviewEvent(session_id, 'SESSION_STARTED', { problem_title: problemTitle });
      } catch (err) {
        setError(err instanceof ApiError ? err.message
          : 'Could not open the interview session — the debrief needs the backend.');
      }
    })();
  }, [problemTitle]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.length, hints.length]);

  const startVoice = useCallback(async () => {
    if (interviewerRef.current || starting) return;
    setStarting(true);
    setError(null);
    try {
      const vi = new GeminiVoiceInterviewer(
        { problemTitle },
        {
          onStage: (s) => setStage(s),
          onTranscript: (line) => {
            addLine(line);
            if (interviewId) {
              void postInterviewEvent(interviewId,
                line.type === 'candidate' ? 'CANDIDATE_SPEECH' : 'INTERVIEWER_SPEECH',
                { text: line.text, problem_title: problemTitle });
            }
          },
          onHint: (hint) => {
            setHints((prev) => [...prev, hint]);
            if (interviewId) void postInterviewEvent(interviewId, 'HINT_GIVEN', { text: hint });
          },
          onEditorReveal: () => setEditorVisible(true),
          onError: (msg) => setError(msg),
        });
      interviewerRef.current = vi;
      await vi.start();
      const micOk = await vi.startMic();
      setMicOn(micOk);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the voice interviewer.');
      setStage('error');
      interviewerRef.current = null;
    } finally {
      setStarting(false);
    }
  }, [addLine, interviewId, problemTitle, starting]);

  const stopVoice = useCallback(async () => {
    await interviewerRef.current?.stop();
    interviewerRef.current = null;
    setMicOn(false);
    setStage('idle');
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => { void interviewerRef.current?.stop(); }, []);

  const toggleMic = useCallback(async () => {
    const vi = interviewerRef.current;
    if (!vi) return;
    if (micOn) {
      vi.stopMic();
      setMicOn(false);
      setStage('listening');
    } else {
      const ok = await vi.startMic();
      setMicOn(ok);
    }
  }, [micOn]);

  const sendTyped = useCallback(async () => {
    const text = speechDraft.trim();
    if (!text || !interviewerRef.current) return;
    setSpeechDraft('');
    interviewerRef.current.sendText(text);
    if (interviewId) {
      await postInterviewEvent(interviewId, 'CANDIDATE_SPEECH', { text, problem_title: problemTitle });
    }
  }, [interviewId, problemTitle, speechDraft]);

  const requestHint = useCallback(async () => {
    interviewerRef.current?.sendText('I am stuck — please give me a hint.');
    if (interviewId) {
      await postInterviewEvent(interviewId, 'HINT_REQUESTED', { problem_title: problemTitle });
    }
  }, [interviewId, problemTitle]);

  const finish = async () => {
    await stopVoice();
    if (interviewId) {
      navigate(`/code-red/interview/${interviewId}/debrief`);
    } else {
      navigate('/dashboard');
    }
  };

  const stageLabel: Record<VoiceStage, string> = {
    idle: 'Voice interviewer ready',
    connecting: 'Connecting…',
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Interviewer speaking',
    closed: 'Channel closed',
    error: 'Voice error',
  };
  const live = stage === 'listening' || stage === 'speaking' || stage === 'thinking';

  return (
    <div className="h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-[#1F2420]/10 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 bg-[#FAF6F0]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-[12px] font-mono text-[#1F2420]/60 hover:text-[#1F2420]">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#C1592B]/10 border border-[#C1592B]/30 text-[#C1592B] text-[10px] font-bold tracking-widest">
            <Mic className="w-3 h-3 text-[#C1592B]" />
            MOCK INTERVIEW · VOICE
          </span>
          <span className="text-[12.5px] font-mono text-[#1F2420]/60 truncate max-w-[240px]">
            {problemTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void finish()}
          className="px-4 py-1.5 rounded-[6px] bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] text-[12.5px] font-semibold cursor-pointer transition-colors"
        >
          End & Debrief
        </button>
      </header>

      {error && (
        <div className="px-4 sm:px-6 py-2 bg-[#C1592B]/10 border-b border-[#C1592B]/30 text-[12px] text-[#1F2420] flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#C1592B]" />
          <span className="truncate">{error}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main stage: voice orb + transcript (90% of the experience) */}
        <div className="flex-1 min-h-0 flex flex-col items-center">
          <div className="flex-1 w-full flex flex-col items-center justify-center gap-6 px-6 py-8 min-h-0">
            {/* Voice orb */}
            <motion.div
              animate={live ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={live ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' } : { duration: 0.2 }}
              className={`w-28 h-28 rounded-full flex items-center justify-center border shadow-sm ${
                stage === 'speaking'
                  ? 'bg-[#C1592B]/20 border-[#C1592B]'
                  : stage === 'thinking'
                  ? 'bg-[#C1592B]/15 border-[#C1592B]/60'
                  : live
                  ? 'bg-[#C1592B]/25 border-[#C1592B]'
                  : 'bg-[#FDFBF7] border-[#E8E2D8]'
              }`}
            >
              {stage === 'speaking' ? (
                <Volume2 className="w-10 h-10 text-[#C1592B]" />
              ) : micOn ? (
                <Mic className="w-10 h-10 text-[#C1592B]" />
              ) : (
                <MicOff className="w-10 h-10 text-[#1F2420]/40" />
              )}
            </motion.div>

            <span className="text-[13px] font-mono text-[#1F2420]/70">{stageLabel[stage]}</span>

            {!interviewerRef.current && stage === 'idle' && (
              <button
                type="button"
                onClick={() => void startVoice()}
                disabled={starting}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-[8px] bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] text-[14px] font-semibold disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
              >
                {starting ? <RefreshCw className="w-4 h-4 animate-spin text-[#C1592B]" /> : <Mic className="w-4 h-4 text-[#C1592B]" />}
                {starting ? 'Connecting…' : 'Start voice interview'}
              </button>
            )}

            {/* Live transcript ticker */}
            <div className="w-full max-w-xl flex-1 min-h-[120px] overflow-y-auto space-y-2 px-1">
              {transcript.map((line, i) => (
                <div
                  key={i}
                  className={`text-[13px] leading-snug ${
                    line.type === 'candidate' ? 'text-[#1F2420]/60 text-right' : 'text-[#1F2420] font-medium'
                  }`}
                >
                  <span className="text-[10px] font-mono text-[#1F2420]/40 block">
                    {line.type === 'candidate' ? 'you' : 'interviewer'} · {line.at}
                  </span>
                  {line.text}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Typed fallback + controls */}
          <div className="w-full px-4 pb-4 pt-2 border-t border-[#1F2420]/10 flex items-center gap-2 shrink-0 bg-[#FDFBF7]">
            <button
              type="button"
              onClick={() => void toggleMic()}
              disabled={!interviewerRef.current}
              className="p-2.5 rounded-[8px] border border-[#E8E2D8] bg-[#FAF7F2] text-[#1F2420]/70 hover:text-[#1F2420] disabled:opacity-40 cursor-pointer"
              aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {micOn ? <Mic className="w-4 h-4 text-[#C1592B]" /> : <MicOff className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => void requestHint()}
              disabled={!interviewerRef.current}
              title="Ask for a hint"
              className="p-2.5 rounded-[8px] border border-[#C1592B]/30 bg-[#C1592B]/10 text-[#C1592B] hover:bg-[#C1592B]/20 disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <input
              value={speechDraft}
              onChange={(e) => setSpeechDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !starting) void sendTyped(); }}
              placeholder="Type instead of speaking (fallback channel)…"
              disabled={!interviewerRef.current}
              className="flex-1 px-3 py-2.5 rounded-[8px] bg-[#FAF7F2] border border-[#E8E2D8] text-[13px] text-[#1F2420] placeholder-[#1F2420]/40 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50 disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => void sendTyped()}
              disabled={!interviewerRef.current || !speechDraft.trim()}
              className="p-2.5 rounded-[8px] bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] disabled:opacity-40 cursor-pointer transition-colors"
              aria-label="Send"
            >
              <Send className="w-4 h-4 text-[#C1592B]" />
            </button>
            {interviewerRef.current && (
              <button
                type="button"
                onClick={() => void stopVoice()}
                title="End the voice channel"
                className="p-2.5 rounded-[8px] border border-[#C1592B]/30 bg-[#C1592B]/10 text-[#C1592B] hover:bg-[#C1592B]/20 cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Editor pane — hidden until the interviewer reveals it */}
        <AnimatePresence>
          {editorVisible && (
            <motion.div
              initial={{ x: 80, opacity: 0, width: 0 }}
              animate={{ x: 0, opacity: 1, width: '50%' }}
              exit={{ x: 80, opacity: 0, width: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 28 }}
              className="hidden lg:flex flex-col border-l border-[#E8E2D8] bg-[#FDFBF7] overflow-hidden"
            >
              <div className="px-4 py-1.5 border-b border-[#E8E2D8] text-[11px] font-mono text-[#1F2420]/60 flex items-center justify-between shrink-0 bg-[#FAF7F2]">
                <span>solution.py</span>
                <span className="text-[#1F2420]/40">revealed by interviewer</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed text-[#1F2420] focus:outline-none"
              />
              {/* Hint drawer */}
              {hints.length > 0 && (
                <motion.div
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="border-t border-[#E8E2D8] p-3 space-y-2 shrink-0 max-h-40 overflow-y-auto bg-[#FAF7F2]"
                >
                  {hints.map((h, i) => (
                    <div key={i} className="p-2.5 rounded-[8px] bg-[#C1592B]/10 border border-[#C1592B]/30 text-[12.5px] text-[#1F2420]">
                      <Sparkles className="w-3 h-3 inline mr-1.5 -mt-0.5 text-[#C1592B]" />
                      {h}
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
