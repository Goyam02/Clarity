import React from 'react';
import {
  X,
  BookOpen,
  Zap,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { GraphNode, GraphLink, MasteryBand } from '../../lib/graph/types';
import { useGraphTheme } from '../../lib/graph/graphTheme';

interface TopicPanelProps {
  node: GraphNode | null;
  onClose: () => void;
  allNodes: GraphNode[];
  links: GraphLink[];
  onSelectNode: (nodeId: string) => void;
  onUpdateRating?: (nodeId: string, rating: number) => void;
  onActionClick?: (action: 'revision' | 'practice' | 'quiz', node: GraphNode) => void;
}

export const TopicPanel: React.FC<TopicPanelProps> = ({
  node,
  onClose,
  allNodes,
  links,
  onSelectNode,
  onUpdateRating,
  onActionClick,
}) => {
  const theme = useGraphTheme();
  if (!node) return null;

  // Find prerequisites: links where target is this node and kind is prerequisite
  const prereqIds = links
    .filter((l) => {
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      return tgtId === node.id && l.kind === 'prerequisite';
    })
    .map((l) => (typeof l.source === 'string' ? l.source : (l.source as GraphNode).id));

  // Find dependents: links where source is this node and kind is prerequisite
  const dependentIds = links
    .filter((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      return srcId === node.id && l.kind === 'prerequisite';
    })
    .map((l) => (typeof l.target === 'string' ? l.target : (l.target as GraphNode).id));

  // Find related topics
  const relatedIds = links
    .filter((l) => {
      if (l.kind !== 'related') return false;
      const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      return srcId === node.id || tgtId === node.id;
    })
    .map((l) => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      return srcId === node.id ? tgtId : srcId;
    });

  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  const getBandBadge = (band: MasteryBand) => {
    switch (band) {
      case 'strong':
        return {
          label: 'Strong',
          color: 'text-[var(--mastery-strong-ink)]',
          dot: theme.masteryStrongFill,
          badgeClass: 'bg-[var(--mastery-strong-tint)] border-[var(--mastery-strong-fill)]/30 text-[var(--mastery-strong-ink)]',
        };
      case 'developing':
        return {
          label: 'Developing',
          color: 'text-[var(--mastery-mid-ink)]',
          dot: theme.masteryMidFill,
          badgeClass: 'bg-[var(--mastery-mid-tint)] border-[var(--mastery-mid-fill)]/30 text-[var(--mastery-mid-ink)]',
        };
      case 'weak':
        return {
          label: 'Weak',
          color: 'text-[var(--mastery-weak-ink)]',
          dot: theme.masteryWeakFill,
          badgeClass: 'bg-[var(--mastery-weak-tint)] border-[var(--mastery-weak-fill)]/30 text-[var(--mastery-weak-ink)]',
        };
      default:
        return {
          label: 'Unrated',
          color: 'text-[var(--muted)]',
          dot: theme.masteryNone,
          badgeClass: 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]',
        };
    }
  };

  const badge = getBandBadge(node.band);
  const masteryPercentage = node.mastery !== null ? Math.round(node.mastery * 100) : null;

  return (
    <div
      className="absolute bottom-4 left-4 right-4 sm:right-auto sm:left-4 sm:top-20 sm:bottom-auto w-auto sm:w-[360px] max-h-[85vh] overflow-y-auto bg-[var(--surface)] backdrop-blur-md border border-[var(--border)] rounded-[14px] shadow-[0_12px_40px_rgba(40,35,25,0.08)] p-5 text-[var(--ink)] z-30 transition-all font-sans"
      role="region"
      aria-label={`Details for ${node.label}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] uppercase tracking-wider font-medium">
              {node.subject}
            </span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-[4px] border font-semibold flex items-center gap-1.5 ${badge.badgeClass}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: badge.dot }}
              />
              <span>
                {badge.label}
                {masteryPercentage !== null ? ` · ${masteryPercentage}%` : ''}
              </span>
            </span>
          </div>
          <h2
            className="text-[20px] font-medium tracking-tight text-[var(--ink)] leading-snug"
            style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
          >
            {node.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-[4px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats & Meta */}
      <div className="py-3 grid grid-cols-2 gap-2 text-[12px] border-b border-[var(--border)]">
        <div className="bg-[var(--bg)] border border-[var(--border)] p-2.5 rounded-[8px]">
          <div className="text-[var(--muted)] text-[11px] flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3" />
            <span>Last Revised</span>
          </div>
          <div className="text-[var(--ink)] font-semibold mt-0.5">
            {node.lastRevisedAt ? node.lastRevisedAt : 'Not yet revised'}
          </div>
        </div>
        <div className="bg-[var(--bg)] border border-[var(--border)] p-2.5 rounded-[8px]">
          <div className="text-[var(--muted)] text-[11px] flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3 text-[var(--mastery-mid-fill)]" />
            <span>Quiz Mistakes</span>
          </div>
          <div className="text-[var(--ink)] font-semibold mt-0.5">
            {node.quizMistakes ?? 0} errors logged
          </div>
        </div>
      </div>

      {/* Description / Why this matters */}
      {node.whyItMatters && (
        <div className="py-3 border-b border-[var(--border)] text-[12.5px] leading-relaxed text-[var(--muted)]">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] block mb-1 font-semibold">
            Context & Syllabus
          </span>
          {node.whyItMatters}
        </div>
      )}

      {/* Quick Rating Calibration */}
      {onUpdateRating && (
        <div className="py-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--muted)] mb-2 font-medium">
            <span>QUICK CALIBRATE</span>
            <span className="text-[var(--ink)] font-bold">
              {node.mastery !== null ? `${Math.round(node.mastery * 4) + 1}/5` : 'Unrated'}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((lvl) => {
              const currentLvl = node.mastery !== null ? Math.round(node.mastery * 4) + 1 : 0;
              const isSelected = currentLvl === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onUpdateRating(node.id, lvl)}
                  className={`py-1 text-[11px] font-mono font-medium rounded-[4px] border transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 ${
                    isSelected
                      ? 'bg-[var(--ink)] border-[var(--ink)] text-[var(--bg)] shadow-xs'
                      : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Prerequisites Section */}
      <div className="py-3 border-b border-[var(--border)] space-y-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block font-medium">
          Prerequisites ({prereqIds.length})
        </span>
        {prereqIds.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {prereqIds.map((pId) => {
              const prereqNode = nodeMap.get(pId);
              if (!prereqNode) return null;
              const pBadge = getBandBadge(prereqNode.band);
              return (
                <button
                  key={pId}
                  type="button"
                  onClick={() => onSelectNode(pId)}
                  className="px-2.5 py-1 rounded-[6px] bg-[var(--bg)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--ink)] text-[12px] text-[var(--ink)] transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                  title={`Focus on ${prereqNode.label}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: pBadge.dot }}
                  />
                  <span>{prereqNode.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <span className="text-[12px] text-[var(--muted)]/70 italic">No foundational prerequisites</span>
        )}
      </div>

      {/* Dependents Section */}
      <div className="py-3 border-b border-[var(--border)] space-y-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block font-medium">
          Dependents & Unlocked ({dependentIds.length})
        </span>
        {dependentIds.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {dependentIds.map((dId) => {
              const depNode = nodeMap.get(dId);
              if (!depNode) return null;
              return (
                <button
                  key={dId}
                  type="button"
                  onClick={() => onSelectNode(dId)}
                  className="px-2.5 py-1 rounded-[6px] bg-[var(--bg)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--ink)] text-[12px] text-[var(--ink)] transition-colors flex items-center gap-1 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                  title={`Focus on ${depNode.label}`}
                >
                  <span>{depNode.label}</span>
                  <ChevronRight className="w-3 h-3 text-[var(--muted)]" />
                </button>
              );
            })}
          </div>
        ) : (
          <span className="text-[12px] text-[var(--muted)]/70 italic">Terminal leaf topic</span>
        )}
      </div>

      {/* Related Topics */}
      {relatedIds.length > 0 && (
        <div className="py-3 border-b border-[var(--border)] space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--muted)] block font-medium">
            Cross-Discipline Links
          </span>
          <div className="flex flex-wrap gap-1.5">
            {relatedIds.map((rId) => {
              const relNode = nodeMap.get(rId);
              if (!relNode) return null;
              return (
                <button
                  key={rId}
                  type="button"
                  onClick={() => onSelectNode(rId)}
                  className="px-2 py-0.5 rounded-[6px] bg-[var(--bg)] hover:bg-[var(--surface)] border border-[var(--border)] text-[11.5px] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)]"
                >
                  {relNode.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dashboard Actions */}
      <div className="pt-4 space-y-2">
        <button
          type="button"
          onClick={() => onActionClick?.('revision', node)}
          className="w-full py-2 px-3 rounded-[6px] bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white text-[13px] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
        >
          <BookOpen className="w-4 h-4" />
          <span>Start Revision Session</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onActionClick?.('practice', node)}
            className="py-1.5 px-2.5 rounded-[6px] bg-[var(--bg)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
          >
            <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Practice</span>
          </button>
          <button
            type="button"
            onClick={() => onActionClick?.('quiz', node)}
            className="py-1.5 px-2.5 rounded-[6px] bg-[var(--bg)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--mastery-strong-fill)]" />
            <span>Quick Quiz</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicPanel;
