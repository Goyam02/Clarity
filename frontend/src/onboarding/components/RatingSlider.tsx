import React from 'react';
import { RATING_LEVELS } from '../data/skillTopics';

interface RatingSliderProps {
  id: string;
  name: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}

export const RatingSlider: React.FC<RatingSliderProps> = ({
  id,
  name,
  description,
  value,
  onChange,
}) => {
  const currentLevel = RATING_LEVELS.find((lvl) => lvl.value === value) || RATING_LEVELS[2];
  const percentage = ((value - 1) / (RATING_LEVELS.length - 1)) * 100;

  return (
    <div
      className="p-3.5 sm:p-4 rounded-[8px] bg-[#FAF6F0]/80 border border-[#1F2420]/10 hover:border-[#C1592B]/40 transition-colors duration-150"
      id={`slider-container-${id}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 mb-2.5">
        <div>
          <label
            htmlFor={`rating-${id}`}
            className="text-[14px] sm:text-[15px] font-semibold text-[#1F2420] tracking-[-0.01em] cursor-pointer"
          >
            {name}
          </label>
          {description && (
            <p className="text-[12px] text-[#1F2420]/65 leading-tight mt-0.5 font-normal">
              {description}
            </p>
          )}
        </div>

        {/* Live level badge */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 mt-1 sm:mt-0">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] text-[11px] sm:text-[12px] font-medium tracking-tight transition-colors ${
              value >= 4
                ? 'bg-[#C1592B] text-[#FAF6F0]'
                : value === 3
                ? 'bg-[#1F2420] text-[#FAF6F0]'
                : 'bg-[#5B6B4D]/15 text-[#5B6B4D]'
            }`}
          >
            <span className="font-bold">{value}/5</span>
            <span className="opacity-80">·</span>
            <span>{currentLevel.label}</span>
          </span>
        </div>
      </div>

      {/* Slider Controls */}
      <div className="relative pt-1.5 pb-1">
        {/* Custom Track Container */}
        <div className="relative w-full h-2 rounded-full bg-[#1F2420]/10 cursor-pointer overflow-hidden">
          <div
            className="absolute top-0 left-0 bottom-0 bg-[#C1592B] rounded-full transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Range Input overlaid directly on top with standard thumb styling */}
        <input
          id={`rating-${id}`}
          type="range"
          min="1"
          max="5"
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={value}
          aria-label={`${name} confidence rating`}
        />

        {/* 5 discrete clickable tick milestones for tactile touch support */}
        <div className="flex justify-between items-center mt-2 px-1 text-[11px] text-[#1F2420]/50 select-none">
          {RATING_LEVELS.map((lvl) => {
            const isSelected = lvl.value === value;
            return (
              <button
                key={lvl.value}
                type="button"
                onClick={() => onChange(lvl.value)}
                className={`flex flex-col items-center gap-0.5 hover:text-[#C1592B] transition-colors cursor-pointer ${
                  isSelected ? 'text-[#C1592B] font-bold' : ''
                }`}
                title={`${lvl.value} - ${lvl.label}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    isSelected
                      ? 'bg-[#C1592B] scale-125'
                      : lvl.value <= value
                      ? 'bg-[#C1592B]/60'
                      : 'bg-[#1F2420]/20'
                  }`}
                />
                <span className="text-[10px] hidden sm:inline">{lvl.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
