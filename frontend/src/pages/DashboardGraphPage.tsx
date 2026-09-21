import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  LayoutDashboard,
  Target,
  Clock,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { generateKnowledgeGraph } from '../lib/graph/generate';
import { ONBOARDING_TOPIC_CATALOG } from '../lib/graph/catalog';
import { KnowledgeGraph } from '../components/graph/KnowledgeGraph';
import { DashboardAmbientGlow } from '../components/graph/DashboardAmbientGlow';
import { GraphData, GraphNode } from '../lib/graph/types';
import { OnboardingPayload } from '../onboarding/types';
import { masteryApi, usersApi, MasteryNodeDto } from '../lib/api/endpoints';
import { UserMenu } from '../components/auth/UserMenu';

export const DashboardGraphPage: React.FC = () => {
  const [profile, setProfile] = useState<OnboardingPayload | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [highlightedTopicId, setHighlightedTopicId] = useState<string | null>(null);
  const [actionNotification, setActionNotification] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    // Real mastery state from the backend (GET /mastery/nodes) + target profile
    // (GET /users/me). The graph generator maps these onto the topic catalog —
    // topics with no mastery node render as 'unrated', never as invented data.
    (async () => {
      let nodes: MasteryNodeDto[] = [];
      let company = 'Google';
      let timeline = 'Upcoming Placement';
      try {
        const [snap, me] = await Promise.all([masteryApi.nodes(), usersApi.me()]);
        nodes = snap.nodes || [];
        company = me.current_focus?.split(':')[0]?.trim() || me.target_companies?.[0] || 'Google';
        timeline = me.placement_timeline || 'Upcoming Placement';
      } catch {
        // Backend unreachable: render the catalog with all-unrated nodes
        // (honest empty state) rather than fabricated ratings.
      }
      if (!alive) return;
      setProfile({ goals: { dreamCompany: company, placementTimeline: timeline } } as never);

      // Map backend mastery nodes -> catalog ratings (0..1 scale).
      const ratings: Record<string, number | null> = {};
      for (const topic of ONBOARDING_TOPIC_CATALOG) {
        const node = nodes.find(
          (n) => n.topic_id === topic.id || n.pattern === topic.id ||
                 n.pattern === topic.id.replace(/_/g, '-'));
        const raw = node?.effective_mastery ?? node?.mastery_score;
        ratings[topic.id] = typeof raw === 'number' ? raw : null;
      }
      setGraphData(generateKnowledgeGraph({
        catalog: ONBOARDING_TOPIC_CATALOG,
        ratings,
        targetCompany: company,
        timeline,
      }));
    })();

    // Check for ?focus=<topicId> in query params
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const focusTopic = urlParams.get('focus');
      if (focusTopic) {
        setHighlightedTopicId(focusTopic);
      }
    }

    return () => { alive = false; };
  }, []);

  const dreamCompany = profile?.goals?.dreamCompany || 'Google';
  const timeline = profile?.goals?.placementTimeline || 'Upcoming Drive';

  // Metrics
  const metrics = useMemo(() => {
    if (!graphData) return { total: 0, strong: 0, developing: 0, weak: 0, blocked: 0 };
    return {
      total: graphData.nodes.length,
      strong: graphData.nodes.filter((n) => n.band === 'strong').length,
      developing: graphData.nodes.filter((n) => n.band === 'developing').length,
      weak: graphData.nodes.filter((n) => n.band === 'weak').length,
      blocked: graphData.links.filter((l) => l.blocked).length,
    };
  }, [graphData]);

  // Today's Recommended Focus nodes (weak prerequisites or high-degree developing hubs)
  const recommendedFocusNodes = useMemo(() => {
    if (!graphData) return [];
    // Prioritize blocked prereqs or weak nodes with highest degree
    const candidates = graphData.nodes
      .filter((n) => n.band === 'weak' || n.band === 'developing')
      .sort((a, b) => {
        if (a.band === 'weak' && b.band !== 'weak') return -1;
        if (b.band === 'weak' && a.band !== 'weak') return 1;
        return (b.degree || 0) - (a.degree || 0);
      })
      .slice(0, 3);
    return candidates;
  }, [graphData]);

  const handleActionClick = (action: 'revision' | 'practice' | 'quiz', node: GraphNode) => {
    setActionNotification(`${action.toUpperCase()} started for "${node.label}"`);
    setTimeout(() => setActionNotification(null), 3500);
  };

  if (!graphData) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--muted)] font-mono text-[13px]">
        Generating personal knowledge graph...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col font-sans overflow-hidden relative">
      {/* Replicate the dashboard ambient glow */}
      <DashboardAmbientGlow />

      {/* Top Telemetry Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 z-30 shadow-xs">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-[6px] bg-[var(--accent)] flex items-center justify-center text-white font-bold text-[14px] shadow-xs">
              C
            </div>
            <span className="font-semibold tracking-tight text-[15px] text-[var(--ink)]">
              Clarity
            </span>
          </Link>

          <div className="h-4 w-px bg-[var(--border)]" />

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-[var(--bg)] p-0.5 rounded-[6px] border border-[var(--border)] text-[12px] font-mono">
            <Link
              to="/dashboard"
              className="px-2.5 py-1 rounded-[4px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors flex items-center gap-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Readiness</span>
            </Link>
            <span className="px-2.5 py-1 rounded-[4px] bg-[var(--ink)] text-[var(--bg)] font-medium flex items-center gap-1.5 shadow-xs">
              <Compass className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Knowledge Graph</span>
            </span>
          </nav>
        </div>

        {/* Target Profile Metadata & User Profile */}
        <div className="flex items-center gap-3 text-[11.5px] font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[var(--bg)] border border-[var(--border)] text-[var(--ink)] shadow-xs">
            <Target className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="text-[var(--muted)]">Target:</span>
            <strong className="text-[var(--ink)] font-semibold">{dreamCompany}</strong>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)]">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeline}</span>
          </div>
          <UserMenu />
        </div>
      </header>

      {/* Telemetry Metric Sub-Bar */}
      <div className="bg-[var(--surface)]/80 border-b border-[var(--border)] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between text-[11.5px] font-mono text-[var(--muted)] gap-2 z-20 backdrop-blur-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[var(--ink)]">
            Topology:{' '}
            <strong className="text-[var(--ink)] font-bold">{metrics.total} topics</strong> mapped
          </span>
          <span className="text-[var(--border)]">•</span>
          <span className="text-[var(--mastery-strong-ink)] font-semibold">
            {metrics.strong} Strong
          </span>
          <span className="text-[var(--border)]">•</span>
          <span className="text-[var(--mastery-mid-ink)] font-semibold">
            {metrics.developing} Developing
          </span>
          <span className="text-[var(--border)]">•</span>
          <span className="text-[var(--mastery-weak-ink)] font-semibold">
            {metrics.weak} Weak
          </span>
          {metrics.blocked > 0 && (
            <>
              <span className="text-[var(--border)]">•</span>
              <span className="text-[var(--mastery-weak-ink)] font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--mastery-weak-fill)]" />
                <span>{metrics.blocked} blocked prerequisite flows</span>
              </span>
            </>
          )}
        </div>

        {/* Today's Recommended Focus Highlights */}
        {recommendedFocusNodes.length > 0 && (
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-[var(--muted)] uppercase text-[10px] font-bold">Today's Focus:</span>
            {recommendedFocusNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onMouseEnter={() => setHighlightedTopicId(node.id)}
                onMouseLeave={() => setHighlightedTopicId(null)}
                onClick={() => setHighlightedTopicId(node.id)}
                className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-mono border transition-all cursor-pointer ${
                  node.band === 'weak'
                    ? 'border-[var(--mastery-weak-fill)]/40 text-[var(--mastery-weak-ink)] bg-[var(--mastery-weak-tint)] hover:bg-[var(--mastery-weak-tint)]/80'
                    : 'border-[var(--mastery-mid-fill)]/40 text-[var(--mastery-mid-ink)] bg-[var(--mastery-mid-tint)] hover:bg-[var(--mastery-mid-tint)]/80'
                }`}
                title={`Highlight ${node.label} in graph`}
              >
                {node.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Notification Toast */}
      {actionNotification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] shadow-[0_8px_30px_rgba(40,35,25,0.08)] text-[12px] font-mono flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{actionNotification}</span>
        </div>
      )}

      {/* Obsidian-Style Force-Directed Graph */}
      <main className="flex-1 relative w-full h-[calc(100vh-85px)] overflow-hidden">
        <KnowledgeGraph
          initialData={graphData}
          highlightedNodeId={highlightedTopicId}
          onActionClick={handleActionClick}
          autoplayAnimation={false}
          className="w-full h-full"
        />
      </main>
    </div>
  );
};

export default DashboardGraphPage;
