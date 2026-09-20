import { BrowserProctor } from '../proctor/browserProctor';
import { createRecordingStore } from '../proctor/recordingStore';
import { RecordingStore } from '../proctor/types';

/**
 * In-memory runtime manager for the active mock OA session.
 * Preserves media stream, recorder, and proctor across route transitions.
 */
class MockOARuntimeManager {
  public stream: MediaStream | null = null;
  public proctor: BrowserProctor | null = null;
  public recorder: MediaRecorder | null = null;
  public store: RecordingStore | null = null;

  public initializeRuntime(stream: MediaStream): {
    proctor: BrowserProctor;
    store: RecordingStore;
    recorder: MediaRecorder | null;
  } {
    this.stream = stream;
    this.proctor = new BrowserProctor();
    this.store = createRecordingStore('current_mock_oa');

    let recorder: MediaRecorder | null = null;
    try {
      if (typeof window !== 'undefined' && window.MediaRecorder) {
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0 && this.store) {
            this.store.append(event.data).catch(() => {});
          }
        };
        // 10s timeslice chunks to IndexedDB
        recorder.start(10000);
      }
    } catch (err) {
      console.warn('[Mock OA Runtime] MediaRecorder initialization warning:', err);
    }

    this.recorder = recorder;
    return { proctor: this.proctor, store: this.store, recorder };
  }

  public cleanup(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    if (this.proctor) {
      this.proctor.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}

export const mockOARuntime = new MockOARuntimeManager();
