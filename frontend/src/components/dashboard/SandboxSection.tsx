import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  ShieldAlert,
  Database,
  CheckCircle,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { DashboardPayload } from '../../lib/dashboard/types';
import { MOCK_OA_ROUTE } from '../../lib/routes';

interface SandboxSectionProps {
  payload: DashboardPayload;
  onLaunch?: (url: string) => void;
}

export const SandboxSection: React.FC<SandboxSectionProps> = ({
  payload,
  onLaunch,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.3, once: true });
  const shouldReduceMotion = useReducedMotion();

  const { sandbox, target } = payload;

  // Question count tick up effect when entering viewport
  const [displayCount, setDisplayCount] = useState(shouldReduceMotion ? sandbox.verifiedQuestions : 0);

  useEffect(() => {
    if (!isInView || shouldReduceMotion) {
      if (shouldReduceMotion) setDisplayCount(sandbox.verifiedQuestions);
      return;
    }

    let start = 0;
    const end = sandbox.verifiedQuestions;
    const duration = 900; // ms
    const stepTime = 25;
    const steps = Math.ceil(duration / stepTime);
    const increment = Math.ceil(end / steps);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayCount(end);
        clearInterval(timer);
      } else {
        setDisplayCount(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isInView, sandbox.verifiedQuestions, shouldReduceMotion]);

  const handleLaunch = () => {
    if (onLaunch) {
      onLaunch(sandbox.launchUrl);
    } else {
      window.location.href = sandbox.launchUrl;
    }
  };

  return (
    <section
      id="section-oa-sandbox"
      ref={ref}
      className="w-full min-h-[calc(100vh-80px)] flex flex-col justify-center py-10 sm:py-16 scroll-snap-start"
      style={{ scrollMarginTop: '64px' }}
      aria-label="Simulated OA Sandbox Section"
    >
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
        animate={isInView || shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full rounded-[20px] bg-[#FBF9F5] border border-[#1F2420]/12 p-6 sm:p-10 shadow-[0_12px_40px_rgba(40,35,25,0.05)] relative overflow-hidden"
      >
        {/* Subtle decorative background watermark */}
        <div
          className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-[#C1592B]/5 pointer-events-none blur-2xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-8">
          {/* Header & Badges */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {sandbox.badge && (
                <span className="px-2.5 py-0.5 rounded-[4px] bg-[#C1592B] text-[#FAF6F0] text-[11px] font-mono font-bold uppercase tracking-wider shadow-xs flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{sandbox.badge}</span>
                </span>
              )}

              {sandbox.proctored && (
                <span className="px-2.5 py-0.5 rounded-[4px] bg-[#1F2420]/6 border border-[#1F2420]/10 text-[#1F2420]/80 text-[11px] font-mono font-medium uppercase tracking-wider">
                  Proctored Simulation
                </span>
              )}

              <span className="px-2.5 py-0.5 rounded-[4px] bg-[#1F2420]/6 border border-[#1F2420]/10 text-[#1F2420]/80 text-[11px] font-mono font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#C1592B]" />
                <span>{sandbox.durationMinutes} Minutes</span>
              </span>
            </div>

            <h2
              className="text-[28px] sm:text-[38px] font-normal tracking-[-0.02em] text-[#1F2420] leading-tight"
              style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
            >
              Simulated Online Assessment Sandbox
            </h2>

            <p className="text-[14.5px] sm:text-[16px] text-[#1F2420]/75 max-w-2xl leading-relaxed">
              Experience the exact test pressure, proctor telemetry, and hidden edge cases of an authentic{' '}
              <strong className="text-[#1F2420] font-semibold">{target.company}</strong> coding round before your
              scheduled test.
            </p>
          </div>

          {/* Question Pool Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 p-5 sm:p-6 rounded-[14px] bg-[#FAF6F0] border border-[#1F2420]/10 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#C1592B]" />
                  <h3 className="text-[15px] font-semibold text-[#1F2420]">
                    {sandbox.poolTitle}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#5B6B4D] bg-[#5B6B4D]/10 px-2 py-0.5 rounded-[4px] font-semibold">
                  Verified Calibration
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-[34px] sm:text-[40px] font-bold text-[#1F2420] tracking-tight leading-none">
                  {displayCount}
                </span>
                <span className="text-[13px] text-[#1F2420]/60 font-mono">
                  verified problems with frequency ratings
                </span>
              </div>

              <p className="text-[12.5px] text-[#1F2420]/70 leading-relaxed border-t border-[#1F2420]/8 pt-2.5">
                {sandbox.recurrenceNote}
              </p>
            </div>

            {/* Quick Metrics Pillar */}
            <div className="p-5 sm:p-6 rounded-[14px] bg-[#FAF6F0] border border-[#1F2420]/10 flex flex-col justify-between gap-4 shadow-xs">
              <div>
                <span className="text-[11px] font-mono text-[#1F2420]/50 uppercase tracking-wider block font-semibold">
                  Assessment Environment
                </span>
                <div className="text-[20px] font-semibold text-[#1F2420] mt-1">
                  Full IDE Mode
                </div>
                <p className="text-[12px] text-[#1F2420]/65 mt-1">
                  Includes memory diagnostics, runtime benchmarks, and auto-linting.
                </p>
              </div>

              <div className="text-[11.5px] font-mono text-[#5B6B4D] flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Zero Installation Required</span>
              </div>
            </div>
          </div>

          {/* What to Expect List */}
          {sandbox.expect && sandbox.expect.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/60 font-bold block">
                What to Expect During the Assessment
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sandbox.expect.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-[8px] bg-[#FAF6F0] border border-[#1F2420]/8 flex items-start gap-2.5 text-[13px] text-[#1F2420]/85"
                  >
                    <CheckCircle className="w-4 h-4 text-[#3F8F63] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Launch Mock OA CTA */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-[#1F2420]/10">
            <div className="text-[12px] font-mono text-[#1F2420]/60 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3F8F63] animate-pulse" />
              <span>Sandbox Servers Online & Ready</span>
            </div>

            <a
              id="btn-launch-mock-oa"
              href={MOCK_OA_ROUTE}
              className="px-6 py-3 rounded-[6px] bg-[#1F2420] hover:bg-[#C1592B] text-[#FAF6F0] text-[14px] font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#C1592B] focus:ring-offset-2 no-underline"
            >
              <Zap className="w-4 h-4 text-[#E5A83B]" />
              <span>Launch Mock OA</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
