import {
  ProctorProvider,
  ProctorReport,
  ProctorViolation,
  ProctorViolationType,
} from './types';

export const MAX_VIOLATIONS = 3;
export const DEBOUNCE_MS = 3000;

export class BrowserProctor implements ProctorProvider {
  private mediaStream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private violations: ProctorViolation[] = [];
  private listeners: Array<(v: ProctorViolation) => void> = [];
  private isRunning: boolean = false;
  private startedAt: number = 0;
  private lastViolationTimestamps: Partial<Record<ProctorViolationType, number>> = {};

  // Handlers saved for cleanup
  private handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
  private handleFullscreenChangeBound = this.handleFullscreenChange.bind(this);
  private handleBeforeUnloadBound = this.handleBeforeUnload.bind(this);
  private handleKeyDownBound = this.handleKeyDown.bind(this);
  private handleContextMenuBound = this.handleContextMenu.bind(this);
  private handleTrackEndedBound = this.handleTrackEnded.bind(this);

  constructor() {
    // Check if session was reloaded
    if (typeof window !== 'undefined') {
      const isReloaded = sessionStorage.getItem('clarity_mock_oa_active') === 'true';
      if (isReloaded) {
        this.recordViolation('PAGE_RELOAD', 'Session page was refreshed during the active assessment.');
      }
    }
  }

  public start(
    mediaStream: MediaStream,
    onViolation?: (v: ProctorViolation) => void
  ): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startedAt = Date.now();
    this.mediaStream = mediaStream;

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('clarity_mock_oa_active', 'true');
    }

    if (onViolation) {
      this.listeners.push(onViolation);
    }

    this.bindTrack(mediaStream);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
      document.addEventListener('fullscreenchange', this.handleFullscreenChangeBound);
      window.addEventListener('beforeunload', this.handleBeforeUnloadBound);
      window.addEventListener('keydown', this.handleKeyDownBound);
      document.addEventListener('contextmenu', this.handleContextMenuBound);
    }
  }

  public updateStream(newStream: MediaStream): void {
    if (this.videoTrack) {
      this.videoTrack.removeEventListener('ended', this.handleTrackEndedBound);
    }
    this.mediaStream = newStream;
    this.bindTrack(newStream);
  }

  private bindTrack(stream: MediaStream): void {
    const tracks = stream.getVideoTracks();
    if (tracks.length > 0) {
      this.videoTrack = tracks[0];
      this.videoTrack.addEventListener('ended', this.handleTrackEndedBound);
    }
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('clarity_mock_oa_active');
    }

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);
      document.removeEventListener('fullscreenchange', this.handleFullscreenChangeBound);
      window.removeEventListener('beforeunload', this.handleBeforeUnloadBound);
      window.removeEventListener('keydown', this.handleKeyDownBound);
      document.removeEventListener('contextmenu', this.handleContextMenuBound);
    }

    if (this.videoTrack) {
      this.videoTrack.removeEventListener('ended', this.handleTrackEndedBound);
      try {
        this.videoTrack.stop();
      } catch {
        // ignore
      }
      this.videoTrack = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      this.mediaStream = null;
    }
  }

  public onViolation(callback: (v: ProctorViolation) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public getReport(): ProctorReport {
    return {
      violations: [...this.violations],
      totalViolations: this.violations.length,
      maxViolationsReached: this.violations.length >= MAX_VIOLATIONS,
      startedAt: this.startedAt,
      endedAt: this.isRunning ? undefined : Date.now(),
      screenShareVerified: true,
    };
  }

  private recordViolation(type: ProctorViolationType, message: string): void {
    const now = Date.now();
    const lastTime = this.lastViolationTimestamps[type] || 0;

    if (now - lastTime < DEBOUNCE_MS) {
      return; // Debounced
    }

    this.lastViolationTimestamps[type] = now;

    const violation: ProctorViolation = {
      id: `viol-${now}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      message,
      timestamp: now,
    };

    this.violations.push(violation);
    this.listeners.forEach((listener) => {
      try {
        listener(violation);
      } catch (err) {
        console.error('[Proctor] Listener error:', err);
      }
    });
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.recordViolation(
        'TAB_HIDDEN',
        'Exam tab was hidden or application switched to another window/tab.'
      );
    }
  }

  private handleFullscreenChange(): void {
    if (!document.fullscreenElement) {
      this.recordViolation(
        'FULLSCREEN_EXIT',
        'Fullscreen mode was exited during the active assessment.'
      );
    }
  }

  private handleTrackEnded(): void {
    this.recordViolation(
      'SHARE_STOPPED',
      'Screen sharing was terminated or stopped by the user.'
    );
  }

  private handleBeforeUnload(e: BeforeUnloadEvent): void {
    if (!this.isRunning) return;
    e.preventDefault();
    e.returnValue = 'Assessment in progress: navigating away or refreshing records a proctoring violation.';
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Shortcuts like F12, Ctrl+Shift+I, Ctrl+U, Cmd+Opt+I logged as INFO, not counted as violations
    const isDevKey =
      e.key === 'F12' ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
      ((e.ctrlKey || e.metaKey) && (e.key === 'U' || e.key === 'u'));

    if (isDevKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[Proctor INFO] Developer inspection shortcut intercepted:', e.key);
      }
    }
  }

  private handleContextMenu(_e: MouseEvent): void {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Proctor INFO] Context menu triggered on assessment chrome.');
    }
  }
}
