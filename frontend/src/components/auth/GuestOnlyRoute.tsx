import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';

export const GuestOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#1F2420]/20 border-t-[#C1592B] rounded-full animate-spin" />
          <span className="text-[12px] font-mono tracking-widest text-[#1F2420]/60 uppercase">
            Checking Status...
          </span>
        </div>
      </div>
    );
  }

  if (user) {
    const destination = user.onboardingCompletedAt ? '/dashboard' : '/onboarding';
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
};
