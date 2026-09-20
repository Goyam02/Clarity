import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  LayoutDashboard,
  Download,
  Trash2,
  Video,
  Code,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { MockOAPayload, MockOASessionData, ProblemSubmissionStatus } from '../../lib/mock-oa/types';
import { RecordingStore } from '../../lib/proctor/types';

interface ResultSummaryProps {
  payload: MockOAPayload;
  sessionData: MockOASessionData;
  recordingStore?: RecordingStore;
  onRetake: () => void;
}

export const ResultSummary: React.FC<ResultSummaryProps> = ({
  payload,
  sessionData,
  recordingStore,
  onRetake,
}) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [recordingDiscarded, setRecordingDiscarded] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    if (recordingStore) {
      recordingStore.getBlob().then((blob) => {
        if (active && blob) {
          setVideoBlob(blob);
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);
        }
      });
    }

    return () => {
      active = false;
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [recordingStore]);

  const handleDownloadRecording = () => {
    if (!videoBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(videoBlob);
    a.download = `mock-oa-${payload.company.toLowerCase()}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDiscardRecording = async () => {
    if (recordingStore) {
      await recordingStore.discard();
    }
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    setVideoBlob(null);
    setRecordingDiscarded(true);
  };

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  // Outcome label
  let outcomeBadge = {
    label: 'Completed',
    bg: 'bg-[#3F8F63]/10 text-[#3F8F63] border-[#3F8F63]/30',
  };
  if (sessionData.outcome === 'violation_limit') {
    outcomeBadge = {
      label: 'Auto-submitted: violation limit',
      bg: 'bg-[#C1592B]/15 text-[#C1592B] border-[#C1592B]/30',
    };
  } else if (sessionData.outcome === 'timeout') {
    outcomeBadge = {
      label: 'Time-out',
      bg: 'bg-[#E5A83B]/20 text-[#B47818] border-[#E5A83B]/40',
    };
  }

  // Collect topics to revisit
  const topicsToRevisit = Array.from(
    new Set(payload.problems.flatMap((p) => p.topicIds))
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-[#FBF9F5] border border-[#1F2420]/10 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1F2420]/10 pb-5">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#1F2420]/50 font-semibold">
              Assessment Outcome &amp; Diagnostic Summary
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#1F2420] mt-1">
              {payload.company} {payload.year} Mock OA
            </h1>
          </div>

          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium border ${outcomeBadge.bg}`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{outcomeBadge.label}</span>
            </span>
          </div>
        </div>

        {/* Notice on self-reporting */}
        <div className="mt-4 text-xs text-[#1F2420]/70 leading-relaxed">
          This session was proctored under simulated testing conditions. Because code runs in
          Coddy's sandboxed environment, results below reflect your self-reported implementation
          states alongside proctor verification telemetry.
        </div>
      </div>

      {/* Problems Breakdown */}
      <div className="space-y-4">
        <h2 className="text-base font-mono uppercase tracking-wider text-[#1F2420]/70 font-semibold">
          Problem Performance
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {payload.problems.map((prob, idx) => {
            const status = sessionData.statuses[prob.id] || 'not_attempted';
            const lang = sessionData.selectedLanguages[prob.id] || 'python';
            const timeSpent = sessionData.timeSpentSeconds[prob.id] || 0;

            let statusTag = {
              text: 'Not Attempted',
              bg: 'bg-[#1F2420]/5 text-[#1F2420]/60',
            };
            if (status === 'solved') {
              statusTag = {
                text: 'Solved',
                bg: 'bg-[#3F8F63]/15 text-[#2c6947]',
              };
            } else if (status === 'partially_solved') {
              statusTag = {
                text: 'Partially Solved',
                bg: 'bg-[#E5A83B]/20 text-[#8a5b0f]',
              };
            }

            return (
              <div
                key={prob.id}
                className="p-5 rounded-xl bg-[#FBF9F5] border border-[#1F2420]/10 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-[#1F2420]/50">
                      Problem {idx + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${statusTag.bg}`}>
                      {statusTag.text}
                    </span>
                  </div>

                  <h3 className="text-lg font-serif font-medium text-[#1F2420]">
                    {prob.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs font-mono text-[#1F2420]/60 flex items-center gap-1 bg-[#1F2420]/5 px-2 py-0.5 rounded-sm">
                      <Code className="w-3 h-3 text-[#C1592B]" />
                      {lang === 'python' ? 'Python 3' : lang === 'java' ? 'Java' : 'C++'}
                    </span>
                    <span className="text-xs font-mono text-[#1F2420]/60 flex items-center gap-1 bg-[#1F2420]/5 px-2 py-0.5 rounded-sm">
                      <Clock className="w-3 h-3 text-[#3F8F63]" />
                      {formatSeconds(timeSpent)}
                    </span>
                  </div>
                </div>

                {/* Topic tags linking to graph */}
                <div className="pt-3 border-t border-[#1F2420]/10">
                  <span className="text-[10px] font-mono uppercase text-[#1F2420]/40 block mb-1.5">
                    Assessed Knowledge Topics
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {prob.topicIds.map((tid) => (
                      <Link
                        key={tid}
                        to={`/dashboard/graph?focus=${tid}`}
                        className="px-2 py-0.5 rounded-sm bg-[#1F2420]/5 hover:bg-[#C1592B]/10 hover:text-[#C1592B] text-[11px] font-mono text-[#1F2420]/75 transition-colors"
                      >
                        #{tid}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Proctoring & Integrity Log */}
      <div className="bg-[#FBF9F5] border border-[#1F2420]/10 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#1F2420]/10 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#C1592B]" />
            <h2 className="text-sm font-mono uppercase tracking-wider text-[#1F2420] font-semibold">
              Proctoring Telemetry ({sessionData.violations.length} logged)
            </h2>
          </div>
          <span className="text-xs font-mono text-[#1F2420]/60">
            Rule Threshold: 3 Max
          </span>
        </div>

        {sessionData.violations.length === 0 ? (
          <p className="text-xs font-mono text-[#3F8F63] flex items-center gap-1.5 py-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Zero proctoring violations logged during the full 70-minute session.</span>
          </p>
        ) : (
          <div className="space-y-2">
            {sessionData.violations.map((v, i) => (
              <div
                key={v.id || i}
                className="p-3 rounded-lg bg-[#C1592B]/5 border border-[#C1592B]/20 flex items-start gap-3 text-xs"
              >
                <AlertTriangle className="w-4 h-4 text-[#C1592B] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#C1592B]">
                      {v.type}
                    </span>
                    <span className="font-mono text-[11px] text-[#1F2420]/50">
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[#1F2420]/80 mt-0.5">{v.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Local Screen Recording Section */}
      <div className="bg-[#FBF9F5] border border-[#1F2420]/10 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#1F2420]/10 pb-3">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-[#1F2420]/70" />
            <h2 className="text-sm font-mono uppercase tracking-wider text-[#1F2420] font-semibold">
              Proctor Screen Recording
            </h2>
          </div>
          <span className="text-xs font-mono text-[#1F2420]/50">
            Stored Locally in IndexedDB
          </span>
        </div>

        {recordingDiscarded ? (
          <p className="text-xs text-[#1F2420]/60 italic">
            Screen recording has been permanently deleted from this browser.
          </p>
        ) : videoUrl ? (
          <div className="space-y-3">
            <video
              src={videoUrl}
              controls
              className="w-full max-h-[320px] bg-[#1F2420] rounded-lg shadow-inner"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-[#1F2420]/60 font-mono">
                Format: WebM Video ({videoBlob ? `${(videoBlob.size / (1024 * 1024)).toFixed(1)} MB` : ''})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadRecording}
                  className="px-3 py-1.5 rounded-md bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .webm</span>
                </button>
                <button
                  type="button"
                  onClick={handleDiscardRecording}
                  className="px-3 py-1.5 rounded-md border border-[#1F2420]/20 hover:bg-[#C1592B]/10 hover:text-[#C1592B] text-xs font-mono text-[#1F2420]/70 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Discard Recording</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#1F2420]/[0.02] rounded-lg text-xs text-[#1F2420]/60 font-mono">
            No local video recording available for this session.
          </div>
        )}
      </div>

      {/* Topics to Revisit Recommendation */}
      <div className="bg-[#FAF6F0] border border-[#1F2420]/15 rounded-xl p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#C1592B]" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-[#1F2420] font-semibold">
            Topics to Revisit on Knowledge Graph
          </h2>
        </div>
        <p className="text-xs text-[#1F2420]/70 leading-relaxed">
          Deepen your algorithmic foundations by exploring prerequisite links and targeted drill
          problems on your dynamic Knowledge Graph:
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {topicsToRevisit.map((topicId) => (
            <Link
              key={topicId}
              to={`/dashboard/graph?focus=${topicId}`}
              className="px-3 py-1.5 rounded-full bg-[#1F2420] text-[#FAF6F0] hover:bg-[#C1592B] text-xs font-mono transition-all flex items-center gap-1.5 shadow-xs"
            >
              <span>{topicId}</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          ))}
        </div>
      </div>

      {/* Navigation actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#1F2420]/10">
        <Link
          to="/dashboard"
          className="px-5 py-2.5 rounded-lg border border-[#1F2420]/20 hover:bg-[#1F2420]/5 text-xs font-mono text-[#1F2420] flex items-center gap-2 transition-all cursor-pointer"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        <button
          type="button"
          onClick={onRetake}
          className="px-6 py-2.5 rounded-lg bg-[#C1592B] hover:bg-[#a6481e] text-[#FAF6F0] text-xs font-mono font-medium flex items-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retake Mock OA</span>
        </button>
      </div>
    </div>
  );
};
