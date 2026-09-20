import React, { useState, useMemo, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Clock, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { DashboardPayload, RevisionTopic, Band } from '../../lib/dashboard/types';
import { TopicCard } from './TopicCard';
import { AdaptiveSet } from './AdaptiveSet';

interface TodayRevisionSectionProps {
  payload: DashboardPayload;
  isWelcome?: boolean;
  onActionClick?: (action: string, topic?: RevisionTopic) => void;
}

export const TodayRevisionSection: React.FC<TodayRevisionSectionProps> = ({
  payload,
  isWelcome = false,
  onActionClick,
}) => {
  const [selectedBand, setSelectedBand] = useState<'all' | Band>('all');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Counts calculated directly from backend topics
  const { allTopics, weakCount, devCount, strongCount } = useMemo(() => {
    const topics = payload.today.topics || [];
    return {
      allTopics: topics,
      weakCount: topics.filter((t) => t.band === 'weak').length,
      devCount: topics.filter((t) => t.band === 'developing').length,
      strongCount: topics.filter((t) => t.band === 'strong').length,
    };
  }, [payload.today.topics]);

  // Filtered topics maintaining strict backend ordering
  const displayedTopics = useMemo(() => {
    if (selectedBand === 'all') return allTopics;
    return allTopics.filter((t) => t.band === selectedBand);
  }, [allTopics, selectedBand]);

  // Accordion: only one open at a time
  const handleToggleExpand = (topicId: string) => {
    setExpandedTopicId((prev) => (prev === topicId ? null : topicId));
  };

  // Welcome animation duration / delays
  const baseDuration = shouldReduceMotion ? 0 : isWelcome ? 0.45 : 0.25;
  const staggerDelay = shouldReduceMotion ? 0 : isWelcome ? 0.06 : 0.03;

  return (
    <section
      id="section-today-revision"
      className="w-full min-h-[calc(100vh-80px)] flex flex-col justify-start py-6 sm:py-8 scroll-snap-start"
      style={{ scrollMarginTop: '64px' }}
      aria-label="Today's Revision Section"
    >
      <div className="w-full flex flex-col gap-6">
        {/* Section Header: Days Left + Topic Count + Estimated Minutes */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: baseDuration, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1F2420]/10 pb-4"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-[11.5px] font-mono text-[#C1592B] font-semibold uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {payload.target.daysLeft} days to your {payload.target.company} OA
              </span>
            </div>
            <h2
              className="text-[26px] sm:text-[32px] font-normal tracking-tight text-[#1F2420] leading-tight"
              style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
            >
              Today&apos;s Revision Plan
            </h2>
          </div>

          <div className="flex items-center gap-3 text-[12.5px] font-mono text-[#1F2420]/75">
            <span className="px-2.5 py-1 rounded-[6px] bg-[#1F2420]/5 border border-[#1F2420]/8 font-medium">
              <strong className="text-[#1F2420]">{allTopics.length}</strong> topics to revise today
            </span>
            <span className="px-2.5 py-1 rounded-[6px] bg-[#1F2420]/5 border border-[#1F2420]/8 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C1592B]" />
              <span>~{payload.today.totalMinutes} min</span>
            </span>
          </div>
        </motion.div>

        {/* Band Filter Tabs with counts */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: baseDuration, delay: shouldReduceMotion ? 0 : 0.08 }}
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Filter topics by mastery band"
        >
          {[
            { id: 'all', label: 'All', count: allTopics.length },
            { id: 'weak', label: 'Weak', count: weakCount, dot: 'bg-[var(--mastery-weak-fill)]' },
            { id: 'developing', label: 'Developing', count: devCount, dot: 'bg-[var(--mastery-mid-fill)]' },
            { id: 'strong', label: 'Strong', count: strongCount, dot: 'bg-[var(--mastery-strong-fill)]' },
          ].map((tab) => {
            const isSelected = selectedBand === tab.id;
            return (
              <button
                key={tab.id}
                id={`band-tab-${tab.id}`}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedBand(tab.id as 'all' | Band)}
                className={`px-3 py-1.5 rounded-[6px] text-[12px] font-medium font-mono transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                  isSelected
                    ? 'bg-[#1F2420] text-[#FAF6F0] border-[#1F2420] shadow-xs'
                    : 'bg-[#FAF6F0] text-[#1F2420]/75 border-[#1F2420]/12 hover:border-[#1F2420]/30 hover:text-[#1F2420]'
                }`}
              >
                {tab.dot && <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />}
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-[3px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#1F2420]/8 text-[#1F2420]/70'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* Topic Cards Grid */}
        {displayedTopics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedTopics.map((topic, index) => (
              <motion.div
                key={topic.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: baseDuration,
                  delay: shouldReduceMotion ? 0 : 0.15 + index * staggerDelay,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <TopicCard
                  topic={topic}
                  companyName={payload.target.company}
                  isExpanded={expandedTopicId === topic.id}
                  onToggle={() => handleToggleExpand(topic.id)}
                  onActionClick={onActionClick}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          /* Empty state for no topics in filter or overall */
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-8 rounded-[12px] bg-[#FBF9F5] border border-[#1F2420]/10 text-center space-y-2"
          >
            <CheckCircle2 className="w-8 h-8 text-[#3F8F63] mx-auto" />
            <h3 className="text-[16px] font-semibold text-[#1F2420]">
              All rated topics are above novice level. Keep up the high consistency!
            </h3>
            <p className="text-[13px] text-[#1F2420]/60 max-w-md mx-auto">
              No pending topics match the current filter. Switch filter to &quot;All&quot; or start the
              adaptive challenge set below.
            </p>
          </motion.div>
        )}

        {/* Today's 3-Problem Adaptive Set */}
        {payload.today.adaptiveSet && payload.today.adaptiveSet.length > 0 && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: baseDuration,
              delay: shouldReduceMotion ? 0 : 0.35,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <AdaptiveSet
              problems={payload.today.adaptiveSet}
              onProblemClick={(prob) => onActionClick?.('solve_problem', undefined)}
            />
          </motion.div>
        )}
      </div>
    </section>
  );
};
