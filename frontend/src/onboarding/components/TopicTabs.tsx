import React from 'react';
import { TopicCategory } from '../types';

interface TopicTabsProps {
  categories: TopicCategory[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
  ratings: Record<string, number>;
}

export const TopicTabs: React.FC<TopicTabsProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
  ratings,
}) => {
  return (
    <div className="w-full">
      {/* Scrollable sub-navigation container */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-none border-b border-[#1F2420]/10">
        {categories.map((category) => {
          const isActive = category.id === activeCategoryId;

          // Calculate average score for category
          const topicIds = category.topics.map((t) => t.id);
          const sum = topicIds.reduce((acc, id) => acc + (ratings[id] ?? 3), 0);
          const avg = (sum / (topicIds.length || 1)).toFixed(1);

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(category.id)}
              className={`px-3 sm:px-3.5 py-2 text-[13px] sm:text-[14px] font-medium whitespace-nowrap rounded-t-[4px] border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'border-[#C1592B] text-[#1F2420] font-semibold bg-[#1F2420]/5'
                  : 'border-transparent text-[#1F2420]/65 hover:text-[#1F2420] hover:bg-[#1F2420]/3'
              }`}
            >
              <span>{category.shortName}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-[4px] font-mono ${
                  isActive
                    ? 'bg-[#C1592B]/15 text-[#C1592B] font-bold'
                    : 'bg-[#1F2420]/5 text-[#1F2420]/60'
                }`}
              >
                {category.topics.length} · {avg}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
