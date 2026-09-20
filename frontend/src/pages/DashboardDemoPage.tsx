import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, RotateCcw, Compass, CheckCircle2, Shield } from 'lucide-react';
import { ClarityLogo } from '../components/Logos';
import { DashboardSections } from '../components/dashboard/DashboardSections';
import {
  MOCK_DASHBOARD_PAYLOAD,
  MOCK_EMPTY_DASHBOARD_PAYLOAD,
  createMockDashboardPayload,
} from '../lib/dashboard/mock';
import { DashboardPayload } from '../lib/dashboard/types';

export const DashboardDemoPage: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<'standard' | 'empty' | 'no-oa-relevance' | 'urgent'>(
    'standard'
  );
  const [isWelcome, setIsWelcome] = useState<boolean>(true);

  // Derive payload based on selected scenario
  const payload: DashboardPayload = React.useMemo(() => {
    switch (selectedScenario) {
      case 'empty':
        return MOCK_EMPTY_DASHBOARD_PAYLOAD;
      case 'no-oa-relevance':
        return {
          ...MOCK_DASHBOARD_PAYLOAD,
          today: {
            ...MOCK_DASHBOARD_PAYLOAD.today,
            topics: MOCK_DASHBOARD_PAYLOAD.today.topics.map((t) => ({
              ...t,
              oaRelevance: null, // Test requirement: null oaRelevance hides line without breaking
            })),
          },
        };
      case 'urgent':
        return createMockDashboardPayload({
          target: {
            company: 'Meta',
            oaDate: new Date(Date.now() + 5 * 86400000).toISOString(),
            daysLeft: 5,
          },
          clearScore: {
            value: 84,
            label: 'Top 8% Placement Readiness',
          },
        });
      case 'standard':
      default:
        return MOCK_DASHBOARD_PAYLOAD;
    }
  }, [selectedScenario]);

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans relative selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Demo Sandbox Top Control Banner */}
      <div className="bg-[#1F2420] text-[#FAF6F0] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[12px] font-mono z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Live Dashboard</span>
          </Link>
          <span className="text-white/20">|</span>
          <span className="px-2 py-0.5 rounded-[3px] bg-[#C1592B] text-white font-bold uppercase text-[10px]">
            Demo Sandbox
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-white/60">Scenario:</span>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value as any)}
              className="bg-white/10 border border-white/20 rounded-[4px] px-2 py-1 text-white text-[11.5px] cursor-pointer"
            >
              <option value="standard" className="bg-[#1F2420]">Standard Google (14 Days)</option>
              <option value="urgent" className="bg-[#1F2420]">Urgent Meta (5 Days)</option>
              <option value="no-oa-relevance" className="bg-[#1F2420]">All Topics: Null OA Relevance</option>
              <option value="empty" className="bg-[#1F2420]">Zero Topics (Empty State Test)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-white/80">
            <input
              type="checkbox"
              checked={isWelcome}
              onChange={(e) => setIsWelcome(e.target.checked)}
              className="rounded-[3px] text-[#C1592B]"
            />
            <span>Simulate ?welcome=1 Entrance</span>
          </label>
        </div>
      </div>

      {/* Standard Header */}
      <header className="w-full relative z-20 border-b border-[#1F2420]/8 bg-[#FAF6F0]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/">
            <ClarityLogo className="scale-90 origin-left" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/graph"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#1F2420] text-[#FAF6F0] text-[12px] font-medium hover:bg-[#C1592B] transition-colors shadow-xs"
            >
              <Compass className="w-3.5 h-3.5 text-[#E5A83B]" />
              <span>Knowledge Graph</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 relative z-10 flex flex-col gap-6 sm:gap-8">
        {/* Banner Hero */}
        <div className="p-5 sm:p-6 rounded-[16px] bg-[#FBF9F5] border border-[#1F2420]/10 shadow-[0_4px_20px_rgba(40,35,25,0.03)] flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#C1592B]/10 text-[#C1592B] text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Personal Knowledge Graph Active</span>
            </div>
            <h1
              className="text-[26px] sm:text-[32px] font-normal tracking-[-0.025em] text-[#1F2420] leading-tight"
              style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
            >
              Target Profile: <span className="text-[#C1592B] italic">{payload.target.company}</span> Readiness
            </h1>
            <p className="text-[13.5px] sm:text-[14.5px] text-[#1F2420]/75 max-w-xl">
              Synthesized across 3 connected platforms and your self-calibrated confidence distribution.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-[#FAF6F0] p-3.5 sm:p-4 rounded-[12px] border border-[#1F2420]/10 shrink-0 shadow-xs">
            <div>
              <span className="text-[11px] font-mono text-[#1F2420]/60 uppercase tracking-wider block">
                Clear Score
              </span>
              <span className="text-[34px] sm:text-[38px] font-bold text-[#1F2420] leading-none">
                {payload.clearScore.value}
              </span>
              <span className="text-[13.5px] text-[#1F2420]/60"> / 100</span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-[#C1592B] border-t-transparent flex items-center justify-center text-[11px] font-bold text-[#C1592B] uppercase text-center leading-none">
              Top
            </div>
          </div>
        </div>

        {/* Section Orchestration */}
        <DashboardSections payload={payload} isWelcome={isWelcome} />
      </main>
    </div>
  );
};

export default DashboardDemoPage;
