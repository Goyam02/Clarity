import React from 'react';

/**
 * Reusable ambient radial glow at the top center matching the dashboard.
 */
export const DashboardAmbientGlow: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`absolute top-0 left-0 right-0 h-[400px] pointer-events-none overflow-hidden z-0 ${className}`}
      aria-hidden="true"
    >
      <div
        className="absolute top-[-90px] left-1/2 -translate-x-1/2 w-[900px] h-[350px] rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(249, 115, 22, 0.15) 0%, rgba(251, 146, 60, 0.08) 35%, rgba(91, 107, 77, 0.05) 65%, transparent 85%)',
          filter: 'blur(50px)',
        }}
      />
    </div>
  );
};

export default DashboardAmbientGlow;
