import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Mic, MicOff, RefreshCw, AlertTriangle, Send, Sparkles, ArrowLeft,
} from 'lucide-react';
import { interviewsApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';

interface TranscriptLine {
  type: string;
  text: string;
  at: string;
}

/**
 * Mock interview (spec §6b): split-screen — code editor (Coddy embed) on the
 * left, live interviewer channel on the right. The interviewer stays silent
 * while the candidate thinks and hints only after stuck-time thresholds
 * (backend drives pacing from event history).
 */
export const CodeRedInterviewPage: React.FC = () => {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();

  const [interviewId, setInterviewId] = useState<string>('');
  const [problemTitle, setProblemTitle] = useState('the problem');
  const [listening, setListening] = useState(true);
  const [speechDraft, setSpeechDraft] = useState('');
  const [code, setCode] = useState('# think aloud while you code\n');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interviewerUtterance, setInterviewerUtterance] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Create the interview session once.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const { session_id } = await interviewsApi.create();
        setInterviewId(session_id);
        const res = await interviewsApi.postEvent(session_id, 'SESSION_STARTED',
          { problem_title: problemTitle });
        if (res.interviewer?.utterance) {
          setInterviewerUtterance(res.interviewer.utterance);
          setTranscript([{ type: 'interviewer', text: res.interviewer.utterance,
                           at: new Date().toLocaleTimeString() }]);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message
          : 'Interviewer unavailable — check that the Foundry agents are configured.');
      }
    })();
  }, [problemTitle]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.length]);

  const sendEvent = useCallback(async (event_type: string, payload: Record<string, unknown>) => {
    if (!interviewId) return;
    setSending(true);
    try {
      const res = await interviewsApi.postEvent(interviewId, event_type, payload);
      if (res.interviewer?.utterance) {
        setInterviewerUtterance(res.interviewer.utterance);
        setTranscript((prev) => [...prev, {
          type: 'interviewer', text: res.interviewer!.utterance,
          at: new Date().toLocaleTimeString(),
        }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reach the interviewer.');
    } finally {
      setSending(false);
    }
  }, [interviewId]);

  const handleSendSpeech = async () => {
    const text = speechDraft.trim();
    if (!text) return;
    setTranscript((prev) => [...prev,
      { type: 'candidate', text, at: new Date().toLocaleTimeString() }]);
    setSpeechDraft('');
    await sendEvent('CANDIDATE_SPEECH', { text, problem_title: problemTitle });
  };

  const handleCodeIdle = () => {
    void sendEvent('CODE_CHANGED', {
      problem_title: problemTitle, seconds_since_activity: 120,
    });
  };

  const handleHintRequest = () => {
    setTranscript((prev) => [...prev,
      { type: 'candidate', text: '[hint requested]', at: new Date().toLocaleTimeString() }]);
    void sendEvent('HINT_REQUESTED', { problem_title: problemTitle });
  };

  const finish = async () => {
    if (!interviewId) { navigate('/dashboard'); return; }
    navigate(`/code-red/interview/${interviewId}/debrief`);
  };

  return (
    <div className="h-screen bg-[#17150F] text-[#EDE8DD] flex flex-col font-sans overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-[#EDE8DD]/10 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-[12px] font-mono text-[#EDE8DD]/50 hover:text-[#EDE8DD]">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#B8322A]/25 border border-[#B8322A]/50 text-[#FF6B5E] text-[10px] font-bold tracking-widest">
            <Mic className="w-3 h-3" />
            MOCK INTERVIEW
          </span>
          <span className="text-[12.5px] font-mono text-[#EDE8DD]/55 truncate max-w-[240px]">
            {problemTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void finish()}
          className="px-4 py-1.5 rounded-[6px] bg-[#B8322A] hover:bg-[#C9402F] text-[12.5px] font-semibold cursor-pointer transition-colors"
        >
          End & Debrief
        </button>
      </header>

      {error && (
        <div className="px-4 sm:px-6 py-2 bg-[#B8322A]/15 border-b border-[#B8322A]/40 text-[12px] text-[#FFB4AC] flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Split screen — the simultaneity IS the point */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Code editor */}
        <div className="flex-1 min-h-[40%] flex flex-col border-b lg:border-b-0 lg:border-r border-[#EDE8DD]/10">
          <div className="px-4 py-1.5 border-b border-[#EDE8DD]/10 text-[11px] font-mono text-[#EDE8DD]/50 flex items-center justify-between shrink-0">
            <span>solution.py</span>
            <button
              type="button"
              onClick={handleCodeIdle}
              disabled={sending}
              className="text-[10.5px] text-[#F0C87E] hover:text-[#F0C87E]/80 disabled:opacity-40 cursor-pointer"
              title="Nudge the interviewer (simulates idle-time check-in)"
            >
              check-in
            </button>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full resize-none bg-[#14120D] p-4 font-mono text-[13px] leading-relaxed text-[#EDE8DD] focus:outline-none"
          />
        </div>

        {/* Interviewer channel */}
        <div className="w-full lg:w-[380px] shrink-0 flex flex-col bg-[#1B1812]">
          {/* Live channel indicator */}
          <div className="px-4 py-3 border-b border-[#EDE8DD]/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {listening ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B8322A] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#B8322A]" />
                  </span>
                  <span className="text-[12px] font-mono text-[#EDE8DD]/70">Interviewer listening...</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-[#EDE8DD]/40" />
                  <span className="text-[12px] font-mono text-[#EDE8DD]/40">Muted</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setListening(!listening)}
              className="p-1.5 rounded-[6px] border border-[#EDE8DD]/15 text-[#EDE8DD]/60 hover:text-[#EDE8DD] cursor-pointer"
              aria-label={listening ? 'Mute' : 'Unmute'}
            >
              {listening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Current utterance */}
          {interviewerUtterance && (
            <div className="px-4 pt-3 shrink-0">
              <div className="p-3 rounded-[10px] bg-[#C1592B]/10 border border-[#C1592B]/25 text-[13.5px] leading-relaxed">
                "{interviewerUtterance}"
              </div>
            </div>
          )}

          {/* Transcript */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
            {transcript.map((line, i) => (
              <div
                key={i}
                className={`text-[12.5px] leading-snug ${
                  line.type === 'candidate' ? 'text-[#EDE8DD]/60 text-right' : 'text-[#EDE8DD]/85'
                }`}
              >
                <span className="text-[10px] font-mono text-[#EDE8DD]/30 block">
                  {line.type === 'candidate' ? 'you' : 'interviewer'} · {line.at}
                </span>
                {line.text}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>

          {/* Speak input (voice channel stand-in for the demo; WebRTC later) */}
          <div className="p-3 border-t border-[#EDE8DD]/10 flex items-center gap-2 shrink-0">
            <input
              value={speechDraft}
              onChange={(e) => setSpeechDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !sending) void handleSendSpeech(); }}
              placeholder="Speak your approach..."
              className="flex-1 px-3 py-2 rounded-[6px] bg-[#14120D] border border-[#EDE8DD]/15 text-[13px] text-[#EDE8DD] placeholder-[#EDE8DD]/30 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50"
            />
            <button
              type="button"
              onClick={handleHintRequest}
              disabled={sending}
              title="Request a hint"
              className="p-2 rounded-[6px] border border-[#E5A83B]/40 text-[#F0C87E] hover:bg-[#E5A83B]/10 disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleSendSpeech()}
              disabled={sending || !speechDraft.trim()}
              className="p-2 rounded-[6px] bg-[#C1592B] hover:bg-[#D0653A] disabled:opacity-40 cursor-pointer"
              aria-label="Send"
            >
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
