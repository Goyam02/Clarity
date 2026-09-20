import React from 'react';
import { DashboardSectionConfig } from '../../lib/dashboard/types';

interface SectionRailProps {
  sections: DashboardSectionConfig[];
  activeSectionId: string;
  onSelectSection: (id: string) => void;
}

export const SectionRail: React.FC<SectionRailProps> = ({
  sections,
  activeSectionId,
  onSelectSection,
}) => {
  return (
    <aside
      aria-label="Section navigation rail"
      className="fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-end gap-3 pointer-events-auto"
    >
      <div className="bg-[#FAF6F0]/90 backdrop-blur-md border border-[#1F2420]/12 rounded-full p-1.5 shadow-[0_4px_20px_rgba(40,35,25,0.06)] flex flex-col items-center gap-2">
        {sections.map((sec, index) => {
          const isActive = activeSectionId === sec.id;
          const label = `Section ${index + 1}: ${sec.label}`;

          return (
            <button
              key={sec.id}
              id={`rail-dot-${sec.id}`}
              type="button"
              onClick={() => onSelectSection(sec.id)}
              aria-label={label}
              aria-current={isActive ? 'true' : undefined}
              className="group relative flex items-center justify-center p-1 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#C1592B] rounded-full"
            >
              {/* Tooltip on hover/focus */}
              <span
                role="tooltip"
                className="absolute right-full mr-3.5 px-2.5 py-1 rounded-[4px] bg-[#1F2420] text-[#FAF6F0] text-[11px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity pointer-events-none shadow-md z-50"
              >
                {sec.label}
              </span>

              {/* Dot indicator */}
              <div
                className={`transition-all duration-300 rounded-full ${
                  isActive
                    ? 'w-2.5 h-6 bg-[#C1592B] shadow-xs'
                    : 'w-2.5 h-2.5 bg-[#1F2420]/25 group-hover:bg-[#1F2420]/60'
                }`}
              />
            </button>
          );
        })}
      </div>
    </aside>
  );
};
