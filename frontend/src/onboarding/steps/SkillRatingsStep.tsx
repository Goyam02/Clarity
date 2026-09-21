import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sliders, Sparkles, ChevronRight, ChevronLeft, RotateCcw } from 'lucide-react';
import { SKILL_CATEGORIES } from '../data/skillTopics';
import { TopicTabs } from '../components/TopicTabs';
import { RatingSlider } from '../components/RatingSlider';

interface SkillRatingsStepProps {
  skillRatings: Record<string, number>;
  onChange: (ratings: Record<string, number>) => void;
}

export const SkillRatingsStep: React.FC<SkillRatingsStepProps> = ({
  skillRatings,
  onChange,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(SKILL_CATEGORIES[0].id);

  const activeCategoryIndex = SKILL_CATEGORIES.findIndex((c) => c.id === activeCategoryId);
  const activeCategory = SKILL_CATEGORIES[activeCategoryIndex] || SKILL_CATEGORIES[0];

  const handleTopicRatingChange = (topicId: string, rating: number) => {
    onChange({
      ...skillRatings,
      [topicId]: rating,
    });
  };

  // Quick preset helper for the active category
  const setCategoryRating = (ratingValue: number) => {
    const updated = { ...skillRatings };
    for (const t of activeCategory.topics) {
      updated[t.id] = ratingValue;
    }
    onChange(updated);
  };

  const handlePrevCategory = () => {
    if (activeCategoryIndex > 0) {
      setActiveCategoryId(SKILL_CATEGORIES[activeCategoryIndex - 1].id);
    }
  };

  const handleNextCategory = () => {
    if (activeCategoryIndex < SKILL_CATEGORIES.length - 1) {
      setActiveCategoryId(SKILL_CATEGORIES[activeCategoryIndex + 1].id);
    }
  };

  // Overall statistics
  const totalTopics = SKILL_CATEGORIES.reduce((acc, cat) => acc + cat.topics.length, 0);
  const allRatings = Object.values(skillRatings);
  const averageMastery = allRatings.length
    ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
    : '3.0';

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 text-left">
      {/* Step Header */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#5B6B4D]/15 text-[#5B6B4D] text-[11px] font-semibold uppercase tracking-wider">
          <Sliders className="w-3 h-3" />
          <span>Step 2 · Self-Calibration</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <h2
            className="text-[26px] sm:text-[30px] font-normal tracking-[-0.02em] leading-tight text-[#1F2420]"
            style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
          >
            Skill confidence mapping
          </h2>
          <div className="text-[12px] text-[#1F2420]/70 font-mono shrink-0">
            Overall Avg: <span className="font-bold text-[#C1592B]">{averageMastery} / 5.0</span>
          </div>
        </div>
        <p className="text-[14px] text-[#1F2420]/70 font-normal leading-relaxed">
          Rate your independent problem-solving confidence across data structures, algorithms, and core fundamentals. Defaulted to Comfortable (3/5)—adjust to match your true level.
        </p>
      </div>

      {/* Sub-group Navigation Tabs */}
      <TopicTabs
        categories={SKILL_CATEGORIES}
        activeCategoryId={activeCategoryId}
        onSelectCategory={setActiveCategoryId}
        ratings={skillRatings}
      />

      {/* Category Info & Quick Category Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-[6px] bg-[#1F2420]/3 border border-[#1F2420]/8">
        <div>
          <h3 className="text-[14px] font-semibold text-[#1F2420]">
            {activeCategory.name}
          </h3>
          <p className="text-[12px] text-[#1F2420]/60">
            {activeCategory.description}
          </p>
        </div>

        {/* Quick Batch Level Adjustment */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
          <span className="text-[11px] text-[#1F2420]/50 uppercase tracking-wider font-mono mr-1">
            Set all:
          </span>
          {[
            { val: 2, label: '2 Easy' },
            { val: 3, label: '3 Med' },
            { val: 4, label: '4 High' },
          ].map((preset) => (
            <button
              key={preset.val}
              type="button"
              onClick={() => setCategoryRating(preset.val)}
              className="px-2 py-0.5 text-[11px] font-medium rounded-[3px] bg-[#FAF6F0] border border-[#1F2420]/15 hover:border-[#C1592B] hover:text-[#C1592B] transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Animated Topic Slider List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategoryId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="space-y-3"
        >
          {activeCategory.topics.map((topic) => (
            <RatingSlider
              key={topic.id}
              id={topic.id}
              name={topic.name}
              description={topic.description}
              value={skillRatings[topic.id] ?? 3}
              onChange={(newVal) => handleTopicRatingChange(topic.id, newVal)}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Category Pagination Footer for Effortless Navigation */}
      <div className="pt-2 border-t border-[#1F2420]/10 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevCategory}
          disabled={activeCategoryIndex === 0}
          className="inline-flex items-center gap-1 text-[13px] text-[#1F2420]/70 hover:text-[#1F2420] disabled:opacity-30 disabled:cursor-not-allowed font-medium py-1 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Category</span>
        </button>

        <span className="text-[12px] text-[#1F2420]/50 font-mono">
          Category {activeCategoryIndex + 1} of {SKILL_CATEGORIES.length}
        </span>

        {activeCategoryIndex < SKILL_CATEGORIES.length - 1 ? (
          <button
            type="button"
            onClick={handleNextCategory}
            className="inline-flex items-center gap-1 text-[13px] text-[#C1592B] hover:text-[#9e421a] font-medium py-1 transition-colors cursor-pointer"
          >
            <span>Next Category</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-[12px] text-[#5B6B4D] font-medium">
            All categories reviewed ✓
          </span>
        )}
      </div>
    </div>
  );
};
