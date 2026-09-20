import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { generateKnowledgeGraph } from '../lib/graph/generate';
import { ONBOARDING_TOPIC_CATALOG } from '../lib/graph/catalog';
import { KnowledgeGraph } from '../components/graph/KnowledgeGraph';
import { DashboardAmbientGlow } from '../components/graph/DashboardAmbientGlow';
import { GraphNode } from '../lib/graph/types';

// Preset mock profiles for testing
const DEMO_PRESETS = {
  balanced: {
    name: 'Standard Placement Candidate',
    targetCompany: 'Google',
    timeline: '3 months',
    ratings: {
      arrays_strings: 5,
      linked_lists: 4,
      stacks: 4,
      queues: 4,
      hash_tables: 4,
      trees: 3,
      heaps: 3,
      tries: 2,
      graphs: 2,
      disjoint_set: 2,
      segment_trees: 1,
      sorting: 5,
      binary_search: 4,
      two_pointers: 5,
      sliding_window: 4,
      recursion_backtracking: 3,
      divide_and_conquer: 3,
      greedy: 3,
      dynamic_programming: 2,
      graph_traversal: 3,
      shortest_paths: 2,
      mst: 2,
      topological_sort: 3,
      bit_manipulation: 2,
      math_number_theory: 3,
      sql_queries: 4,
      dbms_fundamentals: 1, // weak prereq to test blocked link
      operating_systems: 3,
      computer_networks: 2,
      oop_principles: 4,
      design_patterns: 3,
    },
  },
  dsa_master: {
    name: 'Competitive Programmer',
    targetCompany: 'Meta',
    timeline: '1 month',
    ratings: {
      arrays_strings: 5,
      linked_lists: 5,
      stacks: 5,
      queues: 5,
      hash_tables: 5,
      trees: 5,
      heaps: 5,
      tries: 5,
      graphs: 5,
      dynamic_programming: 5,
      segment_trees: 4,
      disjoint_set: 5,
      sorting: 5,
      binary_search: 5,
      two_pointers: 5,
      sliding_window: 5,
      recursion_backtracking: 5,
      divide_and_conquer: 5,
      greedy: 5,
      graph_traversal: 5,
      shortest_paths: 5,
      mst: 5,
      topological_sort: 5,
      bit_manipulation: 5,
      math_number_theory: 4,
      sql_queries: 2,
      dbms_fundamentals: 1,
      operating_systems: 1,
      computer_networks: 1,
    },
  },
  blocked_demo: {
    name: 'Foundation Gaps (Blocked Prereqs Test)',
    targetCompany: 'Uber',
    timeline: '6 weeks',
    ratings: {
      arrays_strings: 1, // weak foundation!
      linked_lists: 2,
      stacks: 2,
      queues: 2,
      hash_tables: 1, // weak foundation!
      trees: 1,
      heaps: 1,
      tries: 1,
      graphs: 1,
      sorting: 2,
      binary_search: 2,
      two_pointers: 1,
      sliding_window: 1,
      recursion_backtracking: 1,
      dynamic_programming: 1,
      sql_queries: 4,
      dbms_fundamentals: 1, // weak foundation blocking indexing!
      operating_systems: 2,
      computer_networks: 2,
    },
  },
  brand_new: {
    name: 'Day 1 Beginner (All Unrated)',
    targetCompany: 'Amazon',
    timeline: '6 months',
    ratings: {},
  },
};

export const GraphDemoPage: React.FC = () => {
  const [activePresetKey, setActivePresetKey] = useState<keyof typeof DEMO_PRESETS>('balanced');
  const [, setSelectedNodeInfo] = useState<GraphNode | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const activePreset = DEMO_PRESETS[activePresetKey];

  // Deterministically generate graph for this preset
  const graphData = useMemo(() => {
    return generateKnowledgeGraph({
      catalog: ONBOARDING_TOPIC_CATALOG,
      ratings: activePreset.ratings,
      targetCompany: activePreset.targetCompany,
      timeline: activePreset.timeline,
    });
  }, [activePreset]);

  // Blocked links count
  const blockedLinksCount = useMemo(() => {
    return graphData.links.filter((l) => l.blocked).length;
  }, [graphData]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col font-sans overflow-hidden relative">
      <DashboardAmbientGlow />

      {/* Top Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/graph"
            className="p-1.5 rounded-[6px] hover:bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            title="Return to Personal Graph"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] shadow-xs">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[14px] font-mono font-semibold tracking-wide uppercase text-[var(--ink)]">
                  Graph View Demo Environment
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] bg-[var(--accent-tint)] text-[var(--accent)] border border-[var(--accent)]/30 uppercase font-bold">
                  Test Sandbox
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                Obsidian-style force directed graph with deterministic topology & mastery telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Preset Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-[var(--muted)] uppercase font-medium">Preset:</span>
          <div className="flex items-center gap-1 bg-[var(--bg)] p-0.5 rounded-[6px] border border-[var(--border)]">
            {Object.entries(DEMO_PRESETS).map(([key, preset]) => {
              const isSelected = activePresetKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActivePresetKey(key as keyof typeof DEMO_PRESETS)}
                  className={`px-2.5 py-1 rounded-[4px] text-[11.5px] font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Sub-bar Telemetry metrics */}
      <div className="bg-[var(--surface)]/80 border-b border-[var(--border)] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between text-[11.5px] font-mono text-[var(--muted)] gap-3 z-20 backdrop-blur-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            Target:{' '}
            <strong className="text-[var(--ink)] font-semibold">{activePreset.targetCompany}</strong> (
            {activePreset.timeline})
          </span>
          <span className="text-[var(--border)]">•</span>
          <span>
            Nodes: <strong className="text-[var(--ink)] font-semibold">{graphData.nodes.length}</strong>
          </span>
          <span className="text-[var(--border)]">•</span>
          <span>
            Edges: <strong className="text-[var(--ink)] font-semibold">{graphData.links.length}</strong>
          </span>
          {blockedLinksCount > 0 && (
            <>
              <span className="text-[var(--border)]">•</span>
              <span className="flex items-center gap-1 text-[var(--mastery-weak-ink)] font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--mastery-weak-fill)]" />
                <span>
                  {blockedLinksCount} blocked prerequisite dependencies
                </span>
              </span>
            </>
          )}
        </div>

        {lastAction && (
          <div className="text-[11px] text-[var(--mastery-strong-ink)] bg-[var(--mastery-strong-tint)] border border-[var(--mastery-strong-fill)]/30 px-2 py-0.5 rounded-[4px]">
            Action Triggered: {lastAction}
          </div>
        )}
      </div>

      {/* Full Canvas Interactive Knowledge Graph */}
      <main className="flex-1 relative w-full h-[calc(100vh-95px)] overflow-hidden">
        <KnowledgeGraph
          initialData={graphData}
          onNodeSelect={(node) => setSelectedNodeInfo(node)}
          onActionClick={(action, node) => {
            setLastAction(`${action.toUpperCase()} started for "${node.label}"`);
          }}
          autoplayAnimation={true}
          className="w-full h-full"
        />
      </main>
    </div>
  );
};

export default GraphDemoPage;
