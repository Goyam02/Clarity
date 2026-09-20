import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { isAuthEnforced } from '../../lib/auth/authConfig';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // If auth enforcement is disabled (default), allow guest access without redirect
  if (!isAuthEnforced()) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[#1F2420]/20 border-t-[#C1592B] rounded-full animate-spin" />
          <span className="text-[12px] font-mono tracking-widest text-[#1F2420]/60 uppercase">
            Verifying Session...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
};
