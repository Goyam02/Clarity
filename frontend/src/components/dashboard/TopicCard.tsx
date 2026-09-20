import React from 'react';
import {
  Clock,
  Building2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Zap,
  Sparkles,
  Target,
} from 'lucide-react';
import { RevisionTopic, REASON_LABELS } from '../../lib/dashboard/types';

interface TopicCardProps {
  topic: RevisionTopic;
  companyName: string;
  isExpanded: boolean;
  onToggle: () => void;
  onActionClick?: (action: string, topic: RevisionTopic) => void;
}

export const TopicCard: React.FC<TopicCardProps> = ({
  topic,
  companyName,
  isExpanded,
  onToggle,
  onActionClick,
}) => {
  // Band styling with text label + color (never color alone)
  const getBandStyles = (band: RevisionTopic['band']) => {
    switch (band) {
      case 'weak':
        return {
          label: 'Weak',
          classes: 'bg-[var(--mastery-weak-tint)] text-[var(--mastery-weak-ink)] border-[var(--mastery-weak-fill)]/30',
          dot: 'bg-[var(--mastery-weak-fill)]',
        };
      case 'developing':
        return {
          label: 'Developing',
          classes: 'bg-[var(--mastery-mid-tint)] text-[var(--mastery-mid-ink)] border-[var(--mastery-mid-fill)]/30',
          dot: 'bg-[var(--mastery-mid-fill)]',
        };
      case 'strong':
        return {
          label: 'Strong',
          classes: 'bg-[var(--mastery-strong-tint)] text-[var(--mastery-strong-ink)] border-[var(--mastery-strong-fill)]/30',
          dot: 'bg-[var(--mastery-strong-fill)]',
        };
    }
  };

  const getPriorityStyles = (priority: RevisionTopic['priority']) => {
    switch (priority) {
      case 'High':
        return 'text-[#B8322A] bg-[#FCE8E6] border-[#B8322A]/20';
      case 'Medium':
        return 'text-[#BF7A0A] bg-[#FDF3E3] border-[#BF7A0A]/20';
      case 'Low':
        return 'text-[#3F8F63] bg-[#E3F2E9] border-[#3F8F63]/20';
    }
  };

  const bandStyle = getBandStyles(topic.band);
  const cardId = `topic-card-${topic.id}`;
  const detailsId = `topic-details-${topic.id}`;

  return (
    <div
      id={cardId}
      className={`rounded-[12px] bg-[#FBF9F5] border transition-all duration-200 shadow-[0_2px_12px_rgba(40,35,25,0.03)] flex flex-col justify-between ${
        isExpanded
          ? 'border-[#C1592B]/50 ring-1 ring-[#C1592B]/20 shadow-[0_8px_24px_rgba(40,35,25,0.06)]'
          : 'border-[#1F2420]/10 hover:border-[#1F2420]/25'
      }`}
    >
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Top Header: Subject + Band Chip + Rating + Priority */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-[#1F2420]/5 text-[#1F2420]/75 uppercase tracking-wider font-semibold border border-[#1F2420]/8">
              {topic.subject}
            </span>

            {/* Band chip: text label + color (never color alone) */}
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-[4px] border font-semibold inline-flex items-center gap-1.5 ${bandStyle.classes}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${bandStyle.dot}`} />
              <span>{bandStyle.label}</span>
            </span>

            {/* Rating display */}
            <span className="text-[11.5px] font-mono text-[#1F2420]/60 px-1.5 py-0.5 rounded-[4px] bg-[#FAF6F0] border border-[#1F2420]/8">
              <strong className="text-[#1F2420] font-semibold">{topic.rating}</strong>/{topic.ratingMax}
            </span>
          </div>

          {/* Priority Chip */}
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-[4px] border font-semibold ${getPriorityStyles(
              topic.priority
            )}`}
          >
            {topic.priority} Priority
          </span>
        </div>

        {/* Topic Title */}
        <div>
          <h3
            className="text-[17px] font-semibold text-[#1F2420] tracking-tight leading-snug"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            {topic.label}
          </h3>

          {/* Why Selected (one line) */}
          <p className="text-[12.5px] text-[#1F2420]/70 mt-1 leading-relaxed line-clamp-2">
            {topic.whySelected}
          </p>
        </div>

        {/* Reason Tags */}
        {topic.reasons && topic.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topic.reasons.map((r) => (
              <span
                key={r}
                className="text-[10.5px] font-mono px-1.5 py-0.5 rounded-[3px] bg-[#FAF6F0] text-[#1F2420]/70 border border-[#1F2420]/10"
              >
                {REASON_LABELS[r] || r}
              </span>
            ))}
          </div>
        )}

        {/* Company Relevance Line (Hidden when oaRelevance is null) */}
        {topic.oaRelevance && (
          <div className="flex items-center gap-1.5 text-[12px] text-[#C1592B] bg-[#C1592B]/8 px-2.5 py-1 rounded-[5px] border border-[#C1592B]/15">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Asked in <strong>{topic.oaRelevance.askedCount}</strong> of{' '}
              {topic.oaRelevance.sampleSize} recent {companyName} OAs
            </span>
          </div>
        )}

        {/* Inline Accordion Expanded Details */}
        {isExpanded && (
          <div
            id={detailsId}
            className="pt-3 border-t border-[#1F2420]/10 space-y-3 animate-in fade-in duration-200"
            role="region"
            aria-label={`${topic.label} revision syllabus and goals`}
          >
            {/* Subtopics to revise */}
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#1F2420]/60 font-semibold block">
                Subtopics to Revise
              </span>
              <ul className="space-y-1">
                {topic.subtopics.map((st, idx) => (
                  <li
                    key={idx}
                    className="text-[12px] text-[#1F2420]/80 flex items-start gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C1592B] mt-1.5 shrink-0" />
                    <span>{st}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Post-study Learning Goal */}
            <div className="p-2.5 rounded-[6px] bg-[#FAF6F0] border border-[#1F2420]/8 space-y-0.5">
              <div className="flex items-center gap-1 text-[11px] font-mono text-[#5B6B4D] font-semibold uppercase">
                <Target className="w-3 h-3" />
                <span>Learning Goal</span>
              </div>
              <p className="text-[12px] text-[#1F2420]/75 leading-relaxed">
                {topic.learningGoal}
              </p>
            </div>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {topic.actions.includes('practice_questions') && (
                <button
                  id={`btn-practice-${topic.id}`}
                  type="button"
                  onClick={() => onActionClick?.('practice_questions', topic)}
                  className="py-1.5 px-2.5 rounded-[5px] bg-[#FAF6F0] hover:bg-[#F0ECE1] border border-[#1F2420]/15 text-[#1F2420] text-[11.5px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#1F2420]"
                >
                  <Zap className="w-3 h-3 text-[#C1592B]" />
                  <span>Practice Questions</span>
                </button>
              )}
              {topic.actions.includes('quick_quiz') && (
                <button
                  id={`btn-quiz-${topic.id}`}
                  type="button"
                  onClick={() => onActionClick?.('quick_quiz', topic)}
                  className="py-1.5 px-2.5 rounded-[5px] bg-[#FAF6F0] hover:bg-[#F0ECE1] border border-[#1F2420]/15 text-[#1F2420] text-[11.5px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#1F2420]"
                >
                  <Sparkles className="w-3 h-3 text-[#3F8F63]" />
                  <span>Take Quick Quiz</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Footer: Estimated Minutes + Start Revision CTA + Accordion Toggle */}
      <div className="px-4 sm:px-5 py-3 border-t border-[#1F2420]/8 bg-[#FAF6F0]/60 rounded-b-[12px] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11.5px] font-mono text-[#1F2420]/65">
          <Clock className="w-3.5 h-3.5 text-[#1F2420]/50" />
          <span>~{topic.estimatedMinutes} min</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary CTA */}
          <button
            id={`btn-start-${topic.id}`}
            type="button"
            onClick={() => onActionClick?.('start_revision', topic)}
            className="px-3 py-1.5 rounded-[5px] bg-[#C1592B] hover:bg-[#A8451F] text-white text-[12px] font-medium transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#C1592B] focus:ring-offset-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Start Revision</span>
          </button>

          {/* Accessible Accordion Toggle Button */}
          <button
            id={`btn-expand-${topic.id}`}
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            aria-label={isExpanded ? `Collapse ${topic.label}` : `Expand ${topic.label} details`}
            className="p-1.5 rounded-[4px] hover:bg-[#1F2420]/8 text-[#1F2420]/60 hover:text-[#1F2420] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#1F2420]"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
