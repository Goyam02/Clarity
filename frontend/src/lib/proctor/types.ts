/**
 * Proctoring and recording type definitions.
 */

export type ProctorViolationType =
  | 'TAB_HIDDEN'
  | 'FULLSCREEN_EXIT'
  | 'SHARE_STOPPED'
  | 'PAGE_RELOAD';

export interface ProctorViolation {
  id: string;
  type: ProctorViolationType;
  message: string;
  timestamp: number;
}

export interface ProctorReport {
  violations: ProctorViolation[];
  totalViolations: number;
  maxViolationsReached: boolean;
  startedAt: number;
  endedAt?: number;
  screenShareVerified: boolean;
}

export interface ProctorProvider {
  start: (mediaStream: MediaStream, onViolation: (v: ProctorViolation) => void) => void;
  stop: () => void;
  onViolation: (callback: (v: ProctorViolation) => void) => () => void;
  getReport: () => ProctorReport;
  updateStream: (newStream: MediaStream) => void;
}

export interface RecordingStore {
  append: (chunk: Blob) => Promise<void>;
  finalize: () => Promise<Blob | null>;
  getBlob: () => Promise<Blob | null>;
  discard: () => Promise<void>;
  purgeOld: (maxAgeMs?: number) => Promise<void>;
  uploadRecording?: (blob: Blob) => Promise<{ success: boolean; url?: string }>;
}
