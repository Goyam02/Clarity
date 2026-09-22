import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock, Lightbulb, Mic, MicOff, RefreshCw, Send, Shuffle, Sparkles, Volume2 } from 'lucide-react';
import { codeRedApi, interviewsApi, type CodeRedState } from '../../lib/api/endpoints';
import { GeminiVoiceInterviewer, postInterviewEvent, type InterviewQuestion, type VoiceStage } from '../../lib/geminiLive';

const TOPICS = [
  ['sliding-window', 'Sliding window'], ['two-pointers', 'Two pointers'],
  ['graphs-bfs', 'Graphs & traversal'], ['dp-knapsack', 'Dynamic programming'],
  ['sql-joins', 'SQL & databases'], ['oop', 'Object-oriented design'],
  ['os-paging', 'Operating systems'], ['cn', 'Computer networks'],
] as const;
type PendingEvent = { type: string; payload: Record<string, unknown> };

export function CodeRedInterviewPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const codeRedId = params.get('session') || '';
  const practice = location.pathname === '/interview';
  const [context, setContext] = useState<CodeRedState | null>(null);
  const [contextLoading, setContextLoading] = useState(Boolean(codeRedId));
  const [topic, setTopic] = useState(params.get('topic') || 'random');
  const [duration, setDuration] = useState(15);
  const [stage, setStage] = useState<VoiceStage>('idle');
  const [micOn, setMicOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [interviewId, setInterviewId] = useState('');
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [draft, setDraft] = useState('');
  const [typed, setTyped] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const voice = useRef<GeminiVoiceInterviewer | null>(null);
  const idRef = useRef('');
  const startingRef = useRef(false);
  const mounted = useRef(true);
  const events = useRef<PendingEvent[]>([]);
  const flushing = useRef<Promise<void> | null>(null);
  const startedAt = useRef(0);
  const selectedTopic = useRef('');
  const questionRef = useRef<InterviewQuestion | null>(null);

  useEffect(() => {
    let active = true;
    if (codeRedId) codeRedApi.get(codeRedId)
      .then(s => { if (active) { setContext(s); setDuration(Math.min(15, s.time_available_minutes)); } })
      .catch(e => { if (active) setError(e.message || 'Could not load CODE RED context.'); })
      .finally(() => { if (active) setContextLoading(false); });
    return () => { active = false; };
  }, [codeRedId]);

  const queue = useCallback((type: string, payload: Record<string, unknown>) => {
    events.current.push({ type, payload: { ...payload, client_event_id: crypto.randomUUID() } });
  }, []);
  const flush = useCallback((): Promise<void> => {
    if (flushing.current) return flushing.current;
    flushing.current = (async () => {
      if (!idRef.current) return;
      while (events.current.length) {
        const event = events.current[0];
        await postInterviewEvent(idRef.current, event.type, event.payload);
        events.current.shift();
      }
      if (mounted.current) setSaveError('');
    })().finally(() => { flushing.current = null; });
    return flushing.current;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      void flush().catch(() => setSaveError('Connection interrupted. Your answers are queued; we’ll retry saving.'));
    }, 5000);
    return () => { mounted.current = false; window.clearInterval(timer); void voice.current?.stop(); void flush().catch(() => {}); };
  }, [flush]);

  async function startVoice() {
    if (startingRef.current || contextLoading) return;
    startingRef.current = true; setStarting(true); setError('');
    try {
      await voice.current?.stop(); voice.current = null;
      let chosen = selectedTopic.current;
      if (!chosen) {
        const contextPattern = context?.tasks.find(t => TOPICS.some(([id]) => id === t.node_id))?.node_id;
        chosen = topic === 'random' ? (typeof contextPattern === 'string' ? contextPattern : TOPICS[Math.floor(Math.random() * TOPICS.length)][0]) : topic;
        selectedTopic.current = chosen;
      }
      const label = TOPICS.find(t => t[0] === chosen)?.[1] || chosen.replaceAll('-', ' ');
      if (!idRef.current) {
        const created = await interviewsApi.create();
        idRef.current = created.session_id;
        queue('SESSION_STARTED', { mode: practice ? 'practice' : 'code_red',
          company: context?.company || '', pattern: chosen, problem_title: label,
          duration_minutes: duration, code_red_session_id: codeRedId });
        if (mounted.current) setInterviewId(created.session_id);
      }
      if (!mounted.current) return;
      const vi = new GeminiVoiceInterviewer({ problemTitle: label, company: context?.company,
        durationMinutes: duration, roundType: 'Approach-only technical interview',
        masteryContext: context?.tasks.slice(0, 5).map(t => t.title).join('; ') }, {
        onStage: s => { if (mounted.current) { setStage(s); if (s === 'closed' || s === 'error') setMicOn(false); } },
        onQuestion: q => {
          if (!q.question.trim()) return;
          questionRef.current = q;
          if (mounted.current) { setQuestion(q); setQuestionCount(n => n + 1); setHint(''); }
          queue('QUESTION_ASKED', { ...q, pattern: selectedTopic.current });
        },
        onTranscript: line => {
          if (line.type === 'system') return;
          queue(line.type === 'candidate' ? 'CANDIDATE_SPEECH' : 'INTERVIEWER_SPEECH',
            { text: line.text, pattern: selectedTopic.current });
          if (!mounted.current) return;
          if (line.type === 'candidate') setAnswerCount(n => n + 1);
          else {
            setPrompt(line.text);
            if (!questionRef.current) setQuestion({ title: label, question: line.text, focus: chosen });
          }
        },
        onHint: text => { if (mounted.current) setHint(text); queue('HINT_GIVEN', { text }); },
        onError: text => { if (mounted.current) setError(text); },
      });
      voice.current = vi;
      await vi.start();
      if (!mounted.current) { await vi.stop(); return; }
      const ok = await vi.startMic(); setMicOn(ok);
      if (!ok) setTyped(true);
      if (!startedAt.current) startedAt.current = Date.now();
      vi.sendPrompt(questionRef.current
        ? `Resume this question: ${questionRef.current.question}. Ask me to continue my approach.`
        : 'Begin the interview now. Choose and display the first concrete question, then ask for my approach.');
      void flush().catch(() => setSaveError('Answers are queued until the backend reconnects.'));
    } catch (e) {
      await voice.current?.stop(); voice.current = null;
      if (mounted.current) { setError(e instanceof Error ? e.message : 'Could not start interview.'); setStage('error'); }
    } finally { startingRef.current = false; if (mounted.current) setStarting(false); }
  }

  async function toggleMic() {
    if (micOn) { voice.current?.stopMic(); setMicOn(false); }
    else setMicOn(await voice.current?.startMic() || false);
  }
  async function finish() {
    if (finishing || !idRef.current) return;
    setFinishing(true); setError('');
    try {
      await voice.current?.stop(); voice.current = null;
      await flush();
      navigate(`${practice ? '/interview' : '/code-red/interview'}/${idRef.current}/debrief`);
    } catch { setError('Your last answers could not be saved. Keep this page open and click End & review to retry.'); }
    finally { setFinishing(false); }
  }
  const live = ['listening', 'speaking', 'thinking'].includes(stage);
  const status = starting ? 'Connecting your interviewer' : stage === 'speaking' ? 'Interviewer speaking' : live ? micOn ? 'Listening to your approach' : 'Microphone muted' : interviewId ? 'Ready to reconnect' : 'Ready when you are';
  const remaining = Math.max(0, duration * 60 - elapsed);

  return <div className="min-h-screen bg-[#F7F4EE] text-[#1F2420] selection:bg-[#C1592B]/20">
    <header className="border-b border-[#1F2420]/10 bg-[#FFFDFA]/90"><div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-4"><Link to={codeRedId ? `/code-red/${codeRedId}` : '/dashboard'} aria-label="Back to practice" className="p-2 rounded-full border border-[#1F2420]/10"><ArrowLeft size={17} /></Link>
        <div><div className="text-[10px] uppercase tracking-[.2em] font-bold text-[#C1592B]">{practice ? 'Practice studio' : 'CODE RED · Interview'}</div><div className="font-semibold text-sm mt-1">{context?.company ? `${context.company} · ` : ''}The approach room</div></div></div>
      {interviewId && <button onClick={() => void finish()} disabled={finishing || starting} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1F2420] text-white disabled:opacity-50">{finishing ? 'Saving…' : 'End & review'}</button>}
    </div></header>
    <main className="max-w-6xl mx-auto px-5 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8"><div><span className="text-xs text-[#5B6B4D] font-medium inline-flex gap-2 items-center"><span className="w-1.5 h-1.5 rounded-full bg-[#5B6B4D] mt-1.5" /> Voice-first · Approach-focused</span>
        <h1 className="font-serif text-4xl sm:text-5xl mt-3 tracking-tight">Good thinking. Out loud.</h1><p className="mt-3 text-sm text-[#1F2420]/60">Clarify the question, explain your approach, and defend your trade-offs.</p></div>
        <div className="flex items-center gap-2 text-sm font-mono border border-[#1F2420]/10 rounded-xl px-4 py-3 bg-[#FFFDFA]"><Clock size={16} />{interviewId ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : `${duration} min`}<span className="text-[#1F2420]/40 text-xs">{remaining === 0 ? 'wrap up' : 'session'}</span></div></div>
      {(error || saveError) && <div role="alert" className="mb-5 rounded-xl border border-[#C1592B]/25 bg-[#C1592B]/5 px-4 py-3 text-sm leading-relaxed">{error || saveError}</div>}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_310px] gap-6 items-start">
        <section className="bg-[#FFFDFA] border border-[#1F2420]/10 rounded-[24px] overflow-hidden shadow-[0_12px_50px_rgba(30,35,25,.04)]">
          <div className="px-7 py-4 border-b border-[#1F2420]/8 flex items-center justify-between text-[11px] font-mono uppercase tracking-widest"><span className="text-[#C1592B]">{question ? `Question ${Math.max(1, questionCount).toString().padStart(2, '0')}` : 'Your next conversation'}</span><span className="text-[#1F2420]/40">Approach → Trade-offs → Edge cases</span></div>
          <div className="p-7 sm:p-9 min-h-[330px]">
            {question ? <><span className="text-xs text-[#5B6B4D]">{question.focus}</span><h2 className="font-serif text-3xl mt-3 leading-tight">{question.title}</h2><p className="mt-5 text-[17px] leading-8 whitespace-pre-wrap">{question.question}</p>
              <div className="mt-7 rounded-xl bg-[#F4F1EA] px-4 py-3 text-sm font-medium">How would you approach this? Start with your assumptions.</div></>
              : <><Sparkles className="text-[#C1592B] mb-6" size={28} /><h2 className="font-serif text-3xl">A question. Your reasoning.<br />A better next attempt.</h2><p className="text-sm leading-7 text-[#1F2420]/60 mt-4 max-w-md">Your interviewer will present a question here, listen to your approach, and follow up on the decisions you make.</p>
                {!interviewId && <div className="grid sm:grid-cols-2 gap-4 mt-7"><label className="text-xs font-medium">Focus<select value={topic} onChange={e => setTopic(e.target.value)} disabled={starting} className="w-full mt-2 p-3 rounded-xl border bg-white"><option value="random">Surprise me · random topic</option>{!TOPICS.some(t => t[0] === topic) && topic !== 'random' && <option value={topic}>{topic.replaceAll('-', ' ')}</option>}{TOPICS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                  <label className="text-xs font-medium">Time available<select value={duration} onChange={e => setDuration(Number(e.target.value))} disabled={starting} className="w-full mt-2 p-3 rounded-xl border bg-white">{[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label></div>}</>}
          </div>
          {prompt && <div className="mx-7 mb-6 p-4 border-l-2 border-[#C1592B] bg-[#C1592B]/5 rounded-r-xl"><span className="text-[10px] uppercase tracking-wider font-semibold text-[#C1592B]">Interviewer’s latest prompt</span><p className="mt-2 text-sm leading-relaxed">{prompt}</p></div>}
          {hint && <div className="mx-7 mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm flex gap-3"><Lightbulb size={18} className="shrink-0" />{hint}</div>}
          <div className="p-5 sm:px-7 border-t border-[#1F2420]/8 bg-[#FAF8F3]">
            <div className="flex flex-wrap items-center gap-3">
              {!live ? <button onClick={() => void startVoice()} disabled={starting || finishing || contextLoading || Boolean(codeRedId && !context)} className="flex gap-2 items-center rounded-xl bg-[#C1592B] px-5 py-3 text-white font-semibold text-sm disabled:opacity-50">{starting ? <RefreshCw size={17} className="animate-spin" /> : <Mic size={17} />}{starting ? 'Connecting…' : interviewId ? 'Reconnect interviewer' : 'Start interview'}<ArrowRight size={16} /></button>
                : <button onClick={() => void toggleMic()} className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${micOn ? 'bg-[#1F2420] text-white' : 'border bg-white'}`}>{micOn ? <Mic size={17} /> : <MicOff size={17} />}{micOn ? 'Mute microphone' : 'Unmute'}</button>}
              <button disabled={!live} onClick={() => { voice.current?.sendPrompt('Please give me one small hint for the current question.'); queue('HINT_REQUESTED', {}); }} className="flex gap-2 items-center text-sm p-2 disabled:opacity-40"><Lightbulb size={16} /> A small hint</button>
              <button onClick={() => setTyped(v => !v)} className="text-xs underline text-[#1F2420]/60 ml-auto">{typed ? 'Hide text option' : 'Prefer to type?'}</button>
            </div>
            {typed && <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); if (draft.trim() && live) { voice.current?.sendText(draft.trim()); setDraft(''); } }}><textarea aria-label="Your approach" placeholder="Describe your approach in words…" value={draft} onChange={e => setDraft(e.target.value)} rows={3} disabled={!live} className="flex-1 min-w-0 rounded-xl border p-3 bg-white text-sm resize-y" /><button aria-label="Send approach" disabled={!live || !draft.trim()} className="rounded-xl bg-[#1F2420] text-white px-4 disabled:opacity-40"><Send size={18} /></button></form>}
          </div>
        </section>
        <aside className="space-y-5">
          <div className="rounded-[24px] bg-[#263A32] text-[#F7F4EE] p-7 text-center overflow-hidden"><div className={`mx-auto h-24 w-24 rounded-full border border-white/20 flex items-center justify-center bg-white/5 ${stage === 'speaking' ? 'motion-safe:animate-pulse' : ''}`}>{stage === 'speaking' ? <Volume2 size={34} className="text-[#DBBE86]" /> : <Mic size={34} className="text-[#DBBE86]" />}</div><h2 className="font-serif text-2xl mt-5">Clarity interviewer</h2><p role="status" className="text-xs text-white/65 mt-3">{status}</p><div className="flex items-end justify-center gap-1 h-8 mt-5" aria-hidden="true">{[12, 20, 28, 16, 24, 32, 20, 12].map((h, i) => <span key={i} style={{ height: live ? h : 5, animationDelay: `${i * 100}ms` }} className={`w-1 rounded-full bg-[#DBBE86]/70 transition-all ${live ? 'motion-safe:animate-pulse' : ''}`} />)}</div></div>
          <div className="rounded-2xl border border-[#1F2420]/10 p-6"><h2 className="font-semibold text-sm">A clear approach sounds like…</h2><ol className="mt-4 space-y-4 text-sm text-[#1F2420]/70">{['Clarify inputs and constraints', 'Start simple, then improve', 'Explain why your approach works', 'Check complexity and edge cases'].map((s, i) => <li key={s} className="flex gap-3"><span className="text-[#C1592B] font-mono text-xs mt-0.5">0{i + 1}</span>{s}</li>)}</ol></div>
          <div className="flex items-center gap-2 px-2 text-xs text-[#5B6B4D]"><Check size={15} />{answerCount ? `${answerCount} response${answerCount === 1 ? '' : 's'} captured for your review` : 'Your responses stay off the screen'}</div>
          {practice && !interviewId && <p className="px-2 text-xs text-[#1F2420]/45 flex gap-2 leading-relaxed"><Shuffle size={16} className="shrink-0" />Random practice picks a fresh topic when you start a new session.</p>}
        </aside>
      </div>
    </main>
  </div>;
}
