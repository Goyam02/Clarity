/**
 * Gemini Live voice-to-voice interviewer (frontend-only — replaces the
 * planned LiveKit agent stack, see docs/plans/plan-livekit-voice-interview.md).
 *
 * Design:
 * - `@google/genai` Live API (`ai.live.connect`) speaks directly from the
 *   browser to Gemini: mic audio in (16kHz PCM), voice + transcript out.
 *   No SFU, no token broker, no extra backend service.
 * - The interviewer persona/context is passed via `systemInstruction`
 *   (candidate problem, mastery context, rubric) — kept in sync with the
 *   backend's mock-interview workflow by POSTing every transcript line to
 *   `/interviews/{id}/events` so `/debrief` keeps working unchanged.
 * - Tools (`show_editor`, `send_hint`, `log_code_state`) let the model push
 *   UI events; the page renders hint drawers / editor reveals on them.
 *
 * Key: `VITE_GEMINI_API_KEY` (frontend/.env.local, gitignored).
 * Model: `gemini-2.5-flash-native-audio-preview-12-2025` (Live API,
 * native audio dialog; configurable via VITE_GEMINI_LIVE_MODEL).
 */
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';
import { API_BASE_URL } from './api/client';

export const GEMINI_API_KEY: string =
  (import.meta.env?.VITE_GEMINI_API_KEY as string | undefined) || '';

const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

export type VoiceStage = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'closed' | 'error';

export interface TranscriptLine {
  type: 'interviewer' | 'candidate' | 'system';
  text: string;
  at: string;
}

export interface GeminiVoiceCallbacks {
  onStage: (stage: VoiceStage) => void;
  onTranscript: (line: TranscriptLine) => void;
  onHint?: (hint: string) => void;
  onEditorReveal?: () => void;
  onError: (message: string) => void;
}

export interface InterviewerContext {
  problemTitle: string;
  problemStatement?: string;
  company?: string;
  roundType?: string;
  masteryContext?: string;
}

function now(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function buildSystemInstruction(ctx: InterviewerContext): string {
  return [
    'You are a calibrated FAANG technical interviewer conducting a live spoken interview.',
    'You speak your questions and feedback out loud, in a warm but rigorous tone, 1-4 sentences per turn.',
    'Never mention that you are an AI or that this is a simulation.',
    '',
    `Company: ${ctx.company || 'unspecified'}. Round: ${ctx.roundType || 'technical interview'}.`,
    `Problem under discussion: ${ctx.problemTitle}.`,
    ctx.problemStatement ? `Problem statement: ${ctx.problemStatement}` : '',
    ctx.masteryContext ? `Candidate mastery context: ${ctx.masteryContext}` : '',
    '',
    'Interview rules:',
    '- Open by briefly introducing the problem and asking the candidate to walk through their approach.',
    '- While the candidate codes, keep them talking: ask "why this data structure?", "what is the time complexity?"',
    '- Give hints only when the candidate is stuck — escalate gently (question, then hint, then concrete pointer).',
    '- If the candidate is silent for a while, check in with a question rather than repeating yourself.',
    '- Close each session by summarizing strengths and one concrete improvement.',
  ].filter(Boolean).join('\n');
}

const INTERVIEWER_TOOLS = [{
  functionDeclarations: [
    {
      name: 'show_editor',
      description: 'Reveal the code editor pane to the candidate after you have introduced the problem and confirmed their approach.',
      parametersJsonSchema: { type: 'object', properties: {} },
    },
    {
      name: 'send_hint',
      description: 'Push a written hint into the candidate\'s editor sidebar without speaking over them. Use when they struggle silently.',
      parametersJsonSchema: {
        type: 'object',
        properties: { hint: { type: 'string', description: 'The hint text to show.' } },
        required: ['hint'],
      },
    },
  ],
}];

/** Output: 24kHz 16-bit PCM playback via WebAudio (no MediaSource hassle). */
class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextStartAt = 0;
  private playing = false;

  ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext({ sampleRate: 24000 });
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  get isPlaying(): boolean { return this.playing; }

  enqueue(base64Pcm: string): void {
    const ctx = this.ensure();
    const raw = atob(base64Pcm);
    const buf = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
    const pcm = new Int16Array(buf.buffer);
    const audioBuf = ctx.createBuffer(1, pcm.length, 24000);
    const channel = audioBuf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(ctx.destination);
    const startAt = Math.max(this.nextStartAt, ctx.currentTime + 0.02);
    src.start(startAt);
    this.nextStartAt = startAt + audioBuf.duration;
    this.playing = this.nextStartAt > ctx.currentTime;
    src.onended = () => { if (ctx.currentTime >= this.nextStartAt - 0.01) this.playing = false; };
  }

  /** Drop queued audio (candidate interrupted). */
  flush(): void {
    this.nextStartAt = 0;
    this.playing = false;
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}

export class GeminiVoiceInterviewer {
  private session: Session | null = null;
  private player = new PcmPlayer();
  private micStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private audioCtx: AudioContext | null = null;
  private closedByUs = false;

  constructor(
    private readonly ctx: InterviewerContext,
    private readonly cb: GeminiVoiceCallbacks,
  ) {}

  get active(): boolean { return this.session !== null; }

  async start(): Promise<void> {
    if (this.session) return;
    if (!GEMINI_API_KEY) {
      throw new Error('VITE_GEMINI_API_KEY is not set — add it to frontend/.env.local (see .env.example).');
    }
    this.cb.onStage('connecting');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const model = (import.meta.env?.VITE_GEMINI_LIVE_MODEL as string | undefined) || DEFAULT_MODEL;

    this.session = await ai.live.connect({
      model,
      callbacks: {
        onopen: () => { this.cb.onStage('listening'); },
        onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
        onerror: (e: ErrorEvent | Error) => {
          this.cb.onStage('error');
          this.cb.onError(`Voice channel error: ${e.message || 'unknown'}`);
        },
        onclose: (e: CloseEvent) => {
          this.session = null;
          this.stopMic();
          if (!this.closedByUs) this.cb.onStage('closed');
          if (e?.reason && !this.closedByUs) this.cb.onError(`Voice channel closed: ${e.reason}`);
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: buildSystemInstruction(this.ctx),
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: INTERVIEWER_TOOLS,
      },
    });
  }

  private handleMessage(msg: LiveServerMessage): void {
    const sc = msg.serverContent;

    // Tool calls from the interviewer model.
    if (msg.toolCall?.functionCalls?.length) {
      void this.handleToolCalls(msg.toolCall.functionCalls);
    }

    if (sc?.inputTranscription?.text) {
      this.cb.onTranscript({ type: 'candidate', text: sc.inputTranscription.text, at: now() });
    }
    if (sc?.outputTranscription?.text) {
      this.cb.onTranscript({ type: 'interviewer', text: sc.outputTranscription.text, at: now() });
      this.cb.onStage('speaking');
    }
    const parts = sc?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/')) {
        this.player.enqueue(part.inlineData.data);
      }
    }
    if (sc?.interrupted) {
      this.player.flush(); // candidate spoke over the model — drop queued audio
      this.cb.onStage('listening');
    }
    if (sc?.turnComplete) {
      this.cb.onStage(this.player.isPlaying ? 'speaking' : 'listening');
    }
  }

  private async handleToolCalls(calls: { name?: string; args?: Record<string, unknown>; id?: string }[]): Promise<void> {
    const responses: { id?: string; name?: string; response: Record<string, unknown> }[] = [];
    for (const call of calls) {
      if (call.name === 'show_editor') {
        this.cb.onEditorReveal?.();
        responses.push({ id: call.id, name: call.name, response: { ok: true } });
      } else if (call.name === 'send_hint') {
        const hint = String(call.args?.hint ?? '');
        if (hint) this.cb.onHint?.(hint);
        responses.push({ id: call.id, name: call.name, response: { ok: true } });
      } else {
        responses.push({ id: call.id, name: call.name, response: { ok: false, error: 'unknown tool' } });
      }
    }
    this.session?.sendToolResponse({ functionResponses: responses });
  }

  /** Start streaming mic audio (16kHz mono PCM16) into the session. */
  async startMic(): Promise<boolean> {
    if (!this.session) return false;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      this.cb.onError('Microphone permission denied — voice interview needs mic access.');
      return false;
    }
    const src = this.audioCtx?.createMediaStreamSource(this.micStream)
      ?? new AudioContext({ sampleRate: 16000 }).createMediaStreamSource(this.micStream);
    this.audioCtx = src.context as AudioContext;
    // ScriptProcessor is deprecated but universally supported and fine for 4k chunks.
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.session) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const bytes = new Uint8Array(pcm.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      this.session.sendRealtimeInput({
        audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' },
      });
    };
    src.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
    return true;
  }

  stopMic(): void {
    this.processor?.disconnect();
    this.processor = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    if (this.audioCtx && this.audioCtx.state !== 'closed') void this.audioCtx.close();
    this.audioCtx = null;
  }

  /** Type a text turn (fallback channel when the candidate prefers typing). */
  sendText(text: string): void {
    if (!this.session || !text.trim()) return;
    this.session.sendClientContent({ turns: { role: 'user', parts: [{ text }] }, turnComplete: true });
    this.cb.onTranscript({ type: 'candidate', text, at: now() });
  }

  async stop(): Promise<void> {
    this.closedByUs = true;
    this.stopMic();
    this.player.flush();
    try { this.session?.close(); } catch { /* already closed */ }
    this.session = null;
    this.cb.onStage('closed');
  }
}

/** Best-effort mirror of the voice transcript into the backend session so
 *  /interviews/{id}/debrief keeps working (same event contract as before). */
export async function postInterviewEvent(
  interviewId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const token = localStorage.getItem('clarity_auth_token') || '';
    const uid = localStorage.getItem('clarity_user_id') || '';
    await fetch(`${API_BASE_URL}/api/v1/interviews/${interviewId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : (uid ? { 'X-User-Id': uid } : {})),
      },
      body: JSON.stringify({ event_type: eventType, payload }),
    });
  } catch {
    // transcript mirroring is best-effort; never block the interview
  }
}
