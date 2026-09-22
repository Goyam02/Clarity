import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveServerMessage } from '@google/genai';

const mocks = vi.hoisted(() => ({ connect: vi.fn(), send: vi.fn(), tool: vi.fn(), close: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { live = { connect: mocks.connect }; }, Modality: { AUDIO: 'AUDIO' },
}));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
  vi.stubGlobal('AudioContext', class {
    state = 'running';
    close = vi.fn().mockResolvedValue(undefined);
  });
  mocks.connect.mockResolvedValue({ sendClientContent: mocks.send, sendToolResponse: mocks.tool, close: mocks.close });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup() {
  const { GeminiVoiceInterviewer } = await import('./geminiLive');
  const onTranscript = vi.fn();
  const onQuestion = vi.fn();
  const interviewer = new GeminiVoiceInterviewer({ problemTitle: 'Graphs', durationMinutes: 10 },
    { onStage: vi.fn(), onError: vi.fn(), onTranscript, onQuestion });
  await interviewer.start();
  const options = mocks.connect.mock.calls[0][0];
  return { interviewer, onTranscript, onQuestion, options,
    message: (msg: Partial<LiveServerMessage>) => options.callbacks.onmessage(msg) };
}

describe('approach-only voice interview', () => {
  it('uses question cards and an explicit spoken-approach prompt', async () => {
    const { interviewer, options } = await setup();
    const tools = options.config.tools[0].functionDeclarations.map((t: { name: string }) => t.name);
    expect(tools).toEqual(['show_question', 'send_hint']);
    expect(options.config.systemInstruction).toContain('There is no editor');
    expect(options.config.systemInstruction).toContain('How would you approach this?');
    await interviewer.stop();
  });
  it('aggregates transcription fragments into complete turns', async () => {
    const { interviewer, onTranscript, message } = await setup();
    message({ serverContent: { inputTranscription: { text: 'I would use' } } });
    message({ serverContent: { inputTranscription: { text: ' a queue.' } } });
    expect(onTranscript).not.toHaveBeenCalled();
    message({ serverContent: { outputTranscription: { text: 'Why a queue?' } } });
    message({ serverContent: { turnComplete: true } });
    expect(onTranscript.mock.calls.map(c => [c[0].type, c[0].text])).toEqual([
      ['candidate', 'I would use a queue.'], ['interviewer', 'Why a queue?'],
    ]);
    await interviewer.stop();
    expect(onTranscript).toHaveBeenCalledTimes(2);
  });
  it('displays structured questions and excludes control prompts from candidate evidence', async () => {
    const { interviewer, onTranscript, onQuestion, message } = await setup();
    message({ toolCall: { functionCalls: [{ id: 'q1', name: 'show_question',
      args: { title: 'A shortest path', question: 'How do you find a shortest path?', focus: 'BFS' } }] } });
    expect(onQuestion).toHaveBeenCalledWith({ title: 'A shortest path', question: 'How do you find a shortest path?', focus: 'BFS' });
    interviewer.sendPrompt('Begin the interview.');
    expect(onTranscript).not.toHaveBeenCalled();
    interviewer.sendText('I would use BFS.');
    expect(onTranscript).toHaveBeenCalledTimes(1);
    await interviewer.stop();
  });
});
