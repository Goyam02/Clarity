import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div
      className="w-full flex flex-col gap-8 animate-pulse"
      aria-busy="true"
      aria-label="Loading dashboard data..."
    >
      {/* Hero skeleton */}
      <div className="p-6 sm:p-7 rounded-[16px] bg-[#FBF9F5] border border-[#1F2420]/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-3 w-full max-w-xl">
          <div className="w-48 h-5 bg-[#1F2420]/8 rounded-[4px]" />
          <div className="w-80 h-9 bg-[#1F2420]/10 rounded-[6px]" />
          <div className="w-full h-4 bg-[#1F2420]/6 rounded-[4px]" />
          <div className="w-44 h-8 bg-[#1F2420]/8 rounded-[6px] mt-2" />
        </div>
        <div className="w-36 h-20 bg-[#FAF6F0] rounded-[12px] border border-[#1F2420]/8 shrink-0" />
      </div>

      {/* Section 1 skeleton: heading + tabs + 3 cards + adaptive set */}
      <div className="min-h-[calc(100vh-140px)] flex flex-col gap-6 py-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1F2420]/10 pb-4">
          <div className="space-y-2">
            <div className="w-44 h-4 bg-[#1F2420]/8 rounded-[4px]" />
            <div className="w-64 h-8 bg-[#1F2420]/10 rounded-[6px]" />
          </div>
          <div className="flex gap-3">
            <div className="w-32 h-6 bg-[#1F2420]/8 rounded-[4px]" />
            <div className="w-24 h-6 bg-[#1F2420]/8 rounded-[4px]" />
          </div>
        </div>

        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-20 h-8 bg-[#1F2420]/8 rounded-[6px]" />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-[12px] bg-[#FBF9F5] border border-[#1F2420]/8 p-5 space-y-4"
            >
              <div className="flex justify-between">
                <div className="w-24 h-5 bg-[#1F2420]/8 rounded-[4px]" />
                <div className="w-20 h-5 bg-[#1F2420]/8 rounded-[4px]" />
              </div>
              <div className="w-48 h-6 bg-[#1F2420]/10 rounded-[4px]" />
              <div className="w-full h-10 bg-[#1F2420]/6 rounded-[4px]" />
              <div className="w-36 h-4 bg-[#1F2420]/8 rounded-[4px]" />
            </div>
          ))}
        </div>

        <div className="h-28 rounded-[14px] bg-[#FBF9F5] border border-[#1F2420]/8 p-5" />
      </div>
    </div>
  );
};
