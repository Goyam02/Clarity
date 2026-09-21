import React, { useState } from 'react';
import {
  Settings,
  X,
  Search,
  Check,
  RotateCcw,
  Play,
  Compass,
} from 'lucide-react';
import {
  GraphSettings,
  DEFAULT_GRAPH_SETTINGS,
  Subject,
  MasteryBand,
  GraphNode,
} from '../../lib/graph/types';
import { useGraphTheme } from '../../lib/graph/graphTheme';

interface GraphControlsProps {
  settings: GraphSettings;
  onUpdateSettings: (updates: Partial<GraphSettings>) => void;
  onResetSettings: () => void;
  onTriggerAnimate: () => void;
  isAnimating: boolean;
  nodes: GraphNode[];
  selectedNodeId: string | null;
}

const ALL_SUBJECTS: Subject[] = ['DSA', 'SQL', 'DBMS', 'OS', 'CN', 'OOP'];

export const GraphControls: React.FC<GraphControlsProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  onTriggerAnimate,
  isAnimating,
  nodes,
  selectedNodeId,
}) => {
  const theme = useGraphTheme();
  // Mobile defaults to collapsed, desktop can be open
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'filters' | 'groups' | 'display' | 'forces'>('filters');

  // Compute band counts
  const bandCounts = nodes.reduce((acc, node) => {
    acc[node.band] = (acc[node.band] || 0) + 1;
    return acc;
  }, {} as Record<MasteryBand, number>);

  const bandsConfig: {
    id: MasteryBand;
    label: string;
    fillColor: string;
    inkColor: string;
  }[] = [
    {
      id: 'strong',
      label: 'Strong (≥70%)',
      fillColor: theme.masteryStrongFill,
      inkColor: theme.masteryStrongInk,
    },
    {
      id: 'developing',
      label: 'Developing (40–69%)',
      fillColor: theme.masteryMidFill,
      inkColor: theme.masteryMidInk,
    },
    {
      id: 'weak',
      label: 'Weak (<40%)',
      fillColor: theme.masteryWeakFill,
      inkColor: theme.masteryWeakInk,
    },
    {
      id: 'unrated',
      label: 'Unrated',
      fillColor: theme.masteryNone,
      inkColor: theme.muted,
    },
  ];

  const toggleSubject = (subject: Subject) => {
    const current = settings.selectedSubjects;
    const next = current.includes(subject)
      ? current.filter((s) => s !== subject)
      : [...current, subject];
    onUpdateSettings({ selectedSubjects: next });
  };

  const toggleBand = (band: MasteryBand) => {
    const current = settings.selectedBands;
    const next = current.includes(band)
      ? current.filter((b) => b !== band)
      : [...current, band];
    onUpdateSettings({ selectedBands: next });
  };

  return (
    <div className="absolute top-4 right-4 z-30 font-sans">
      {/* Floating Toggle Button (Secondary Outlined Style) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] hover:bg-[var(--bg)] text-[var(--ink)] border border-[var(--border)] rounded-[8px] shadow-[0_4px_20px_rgba(40,35,25,0.06)] backdrop-blur-md transition-all text-[12.5px] font-medium cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-2"
          aria-label="Open graph settings panel"
        >
          <Settings className="w-4 h-4 text-[var(--accent)]" />
          <span>Graph Controls</span>
          {settings.searchQuery && (
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          )}
        </button>
      )}

      {/* Main Collapsible Panel (Card Style) */}
      {isOpen && (
        <div
          className="w-[320px] sm:w-[350px] max-h-[85vh] overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-[14px] shadow-[0_8px_30px_rgba(40,35,25,0.08)] backdrop-blur-md p-4 text-[var(--ink)] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
          role="region"
          aria-label="Obsidian Graph View Settings"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-[12px] font-mono font-semibold tracking-wide uppercase text-[var(--ink)]">
                Graph View Settings
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-[4px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
              aria-label="Close graph settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section Selector Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--bg)] border border-[var(--border)] rounded-[6px] text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setActiveSection('filters')}
              className={`py-1 rounded-[4px] transition-all cursor-pointer ${
                activeSection === 'filters'
                  ? 'bg-[var(--ink)] text-[var(--bg)] font-medium shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Filters
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('groups')}
              className={`py-1 rounded-[4px] transition-all cursor-pointer ${
                activeSection === 'groups'
                  ? 'bg-[var(--ink)] text-[var(--bg)] font-medium shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Groups
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('display')}
              className={`py-1 rounded-[4px] transition-all cursor-pointer ${
                activeSection === 'display'
                  ? 'bg-[var(--ink)] text-[var(--bg)] font-medium shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Display
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('forces')}
              className={`py-1 rounded-[4px] transition-all cursor-pointer ${
                activeSection === 'forces'
                  ? 'bg-[var(--ink)] text-[var(--bg)] font-medium shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Forces
            </button>
          </div>

          {/* 1. FILTERS SECTION */}
          {activeSection === 'filters' && (
            <div className="space-y-3.5 text-[12px]">
              {/* Search Box */}
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block mb-1.5 font-medium">
                  Search Topics
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--muted)]" />
                  <input
                    type="text"
                    value={settings.searchQuery}
                    onChange={(e) => onUpdateSettings({ searchQuery: e.target.value })}
                    placeholder="e.g., Trees, SQL, TCP..."
                    className="w-full pl-8 pr-7 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] text-[12px] text-[var(--ink)] placeholder:text-[var(--muted)]/60 focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-2 focus:ring-offset-[var(--surface)] transition-all"
                  />
                  {settings.searchQuery && (
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ searchQuery: '' })}
                      className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Subject Filter */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] mb-1.5 font-medium">
                  <span>Subjects</span>
                  <div className="space-x-2 text-[10.5px] lowercase">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ selectedSubjects: ALL_SUBJECTS })}
                      className="text-[var(--accent)] hover:underline cursor-pointer font-semibold"
                    >
                      all
                    </button>
                    <span className="text-[var(--border)]">/</span>
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ selectedSubjects: [] })}
                      className="text-[var(--muted)] hover:text-[var(--ink)] hover:underline cursor-pointer"
                    >
                      none
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {ALL_SUBJECTS.map((subj) => {
                    const active = settings.selectedSubjects.includes(subj);
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => toggleSubject(subj)}
                        className={`py-1 px-2 rounded-[4px] border text-[11px] font-mono transition-colors flex items-center justify-between cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 ${
                          active
                            ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--bg)] font-medium shadow-xs'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <span>{subj}</span>
                        {active && <Check className="w-3 h-3 text-[var(--bg)]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mastery Band Filter */}
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block mb-1.5 font-medium">
                  Mastery Levels
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {bandsConfig.map((band) => {
                    const active = settings.selectedBands.includes(band.id);
                    return (
                      <button
                        key={band.id}
                        type="button"
                        onClick={() => toggleBand(band.id)}
                        className={`py-1.5 px-2 rounded-[4px] border text-[11px] font-mono transition-colors flex items-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 ${
                          active
                            ? 'bg-[var(--surface)] border-[var(--ink)] text-[var(--ink)] font-semibold shadow-xs'
                            : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: band.fillColor }}
                        />
                        <span className="capitalize">{band.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Show Orphans Toggle */}
              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-medium text-[var(--ink)] block">
                    Show Orphans
                  </span>
                  <span className="text-[10.5px] text-[var(--muted)]">
                    Keep disconnected topics visible
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ showOrphans: !settings.showOrphans })}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-2 ${
                    settings.showOrphans ? 'bg-[var(--ink)]' : 'bg-[var(--border)]'
                  }`}
                  aria-pressed={settings.showOrphans}
                >
                  <div
                    className={`bg-[var(--surface)] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.showOrphans ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* 2. GROUPS / LEGEND SECTION */}
          {activeSection === 'groups' && (
            <div className="space-y-3 text-[12px]">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block font-medium">
                Rating Calibration Groups
              </span>
              <p className="text-[11.5px] text-[var(--muted)] leading-relaxed">
                Click any group below to toggle those nodes in the knowledge graph.
              </p>
              <div className="space-y-2">
                {bandsConfig.map((band) => {
                  const active = settings.selectedBands.includes(band.id);
                  const count = bandCounts[band.id] || 0;
                  return (
                    <button
                      key={band.id}
                      type="button"
                      onClick={() => toggleBand(band.id)}
                      className={`w-full p-2.5 rounded-[6px] border flex items-center justify-between transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 ${
                        active
                          ? 'bg-[var(--surface)] border-[var(--ink)] text-[var(--ink)] shadow-xs'
                          : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: band.fillColor }}
                        />
                        <span
                          className="text-[12.5px] font-semibold"
                          style={{ color: band.inkColor }}
                        >
                          {band.label}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-[3px] bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)]">
                        {count} nodes
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Obsidian telemetry note */}
              <div className="pt-2 text-[11px] text-[var(--muted)] border-t border-[var(--border)] leading-relaxed">
                <span className="text-[var(--accent)] font-mono font-semibold">Note:</span> Blocked prerequisite flows are highlighted with a dashed line where foundational mastery is weak.
              </div>
            </div>
          )}

          {/* 3. DISPLAY SECTION */}
          {activeSection === 'display' && (
            <div className="space-y-3.5 text-[12px]">
              {/* Mode Toggle: Global vs Local */}
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block mb-1.5 font-medium">
                  Graph Mode
                </label>
                <div className="grid grid-cols-2 gap-1 bg-[var(--bg)] border border-[var(--border)] p-1 rounded-[6px]">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ mode: 'global' })}
                    className={`py-1 rounded-[4px] text-[11.5px] font-medium transition-all cursor-pointer ${
                      settings.mode === 'global'
                        ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Global View
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ mode: 'local' })}
                    className={`py-1 rounded-[4px] text-[11.5px] font-medium transition-all cursor-pointer ${
                      settings.mode === 'local'
                        ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Local Graph
                  </button>
                </div>
              </div>

              {/* Local Graph Depth Slider */}
              {settings.mode === 'local' && (
                <div className="p-2.5 bg-[var(--bg)] rounded-[6px] border border-[var(--border)]">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-[var(--muted)]">Neighborhood Depth</span>
                    <span className="text-[var(--ink)] font-bold">{settings.localDepth} hops</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="1"
                    value={settings.localDepth}
                    onChange={(e) => onUpdateSettings({ localDepth: Number(e.target.value) })}
                    className="w-full accent-[var(--ink)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                  />
                  <span className="text-[10px] text-[var(--muted)] block mt-1">
                    {selectedNodeId
                      ? 'Showing neighbors around selected topic'
                      : 'Click a topic node to center the local graph'}
                  </span>
                </div>
              )}

              {/* Directional Arrows Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-medium text-[var(--ink)] block">
                    Directional Arrows
                  </span>
                  <span className="text-[10.5px] text-[var(--muted)]">
                    Indicate prerequisite flow
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ showArrows: !settings.showArrows })}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-2 ${
                    settings.showArrows ? 'bg-[var(--ink)]' : 'bg-[var(--border)]'
                  }`}
                  aria-pressed={settings.showArrows}
                >
                  <div
                    className={`bg-[var(--surface)] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.showArrows ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Node Size Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-[var(--muted)]">Node Size Scale</span>
                  <span className="text-[var(--ink)] font-semibold">{settings.nodeSize.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={settings.nodeSize}
                  onChange={(e) => onUpdateSettings({ nodeSize: Number(e.target.value) })}
                  className="w-full accent-[var(--ink)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                />
              </div>

              {/* Link Thickness Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-[var(--muted)]">Link Thickness</span>
                  <span className="text-[var(--ink)] font-semibold">{settings.linkThickness.toFixed(1)}px</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={settings.linkThickness}
                  onChange={(e) => onUpdateSettings({ linkThickness: Number(e.target.value) })}
                  className="w-full accent-[var(--ink)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                />
              </div>

              {/* Text Fade Threshold Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-[var(--muted)]">Text Fade Threshold</span>
                  <span className="text-[var(--ink)] font-semibold">{settings.fadeThreshold.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="3.0"
                  step="0.1"
                  value={settings.fadeThreshold}
                  onChange={(e) => onUpdateSettings({ fadeThreshold: Number(e.target.value) })}
                  className="w-full accent-[var(--ink)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                />
              </div>

              {/* Animate Growth Button (Dark button style) */}
              <div className="pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={onTriggerAnimate}
                  disabled={isAnimating}
                  className="w-full py-2 px-3 rounded-[6px] bg-[var(--ink)] hover:bg-[var(--ink)]/90 text-[var(--bg)] text-[12px] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-2 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isAnimating ? 'Growing Graph...' : 'Replay Graph Growth'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. FORCES SECTION */}
          {activeSection === 'forces' && (
            <div className="space-y-3.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block font-medium">
                  D3 Simulation Forces
                </span>
                <button
                  type="button"
                  onClick={onResetSettings}
                  className="text-[11px] font-mono text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Repel Force */}
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-[var(--muted)]">Repel Strength (Charge)</span>
                  <span className="text-[var(--ink)] font-semibold">{settings.chargeRepel}</span>
                </div>
                <input
                  type="range"
                  min="-400"
                  max="0"
                  step="10"
                  value={settings.chargeRepel}
                  onChange={(e) => onUpdateSettings({ chargeRepel: Number(e.target.value) })}
                  className="w-full accent-[var(--ink)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                />
              </div>

              {/* Link Distance */}
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-[var(--muted)]">Link Distance</span>
                  <span className="text-[var(--ink)] font-semibold">{settings.linkDistance}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="5"
                  value={settings.linkDistance}
                  onChange={(e) => onUpdateSettings({ linkDistance: Number(e.target.value) })}
                  className="w-full accent-[var(--ink)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                />
              </div>

              {/* Link Force / Strength */}
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-[var(--muted)]">Link Rigidity</span>
                  <span className="text-[var(--ink)] font-semibold">{settings.linkStrength.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={settings.linkStrength}
                  onChange={(e) => onUpdateSettings({ linkStrength: Number(e.target.value) })}
                  className="w-full accent-[var(--ink)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                />
              </div>

              {/* Center Force */}
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-[var(--muted)]">Center Pull Strength</span>
                  <span className="text-[var(--ink)] font-semibold">{settings.centerStrength.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.30"
                  step="0.01"
                  value={settings.centerStrength}
                  onChange={(e) => onUpdateSettings({ centerStrength: Number(e.target.value) })}
                  className="w-full accent-[var(--ink)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GraphControls;
