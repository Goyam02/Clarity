import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage.tsx';
import { OnboardingFlow } from './onboarding/OnboardingFlow.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import { DashboardGraphPage } from './pages/DashboardGraphPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { SignupPage } from './pages/SignupPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { CodeRedEntryPage } from './pages/codered/CodeRedEntryPage.tsx';
import { CodeRedSessionPage } from './pages/codered/CodeRedSessionPage.tsx';
import { CodeRedInterviewPage } from './pages/codered/CodeRedInterviewPage.tsx';
import { CodeRedDebriefPage } from './pages/codered/CodeRedDebriefPage.tsx';
import MockOAInstructionsPage from './pages/MockOAEntryPage.tsx';
import MockOASessionPage from './pages/MockOASessionPage.tsx';
import MockOAResultPage from './pages/MockOAResultPage.tsx';
import { AuthProvider } from './lib/auth/AuthContext.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';
import { GuestOnlyRoute } from './components/auth/GuestOnlyRoute.tsx';
import './index.css';

const GraphRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/dashboard/graph${location.search}`} replace />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <LoginPage />
              </GuestOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <GuestOnlyRoute>
                <SignupPage />
              </GuestOnlyRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingFlow />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/graph"
            element={
              <ProtectedRoute>
                <DashboardGraphPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          {/* CODE RED (spec §6): one engine, two endings */}
          <Route
            path="/code-red"
            element={
              <ProtectedRoute>
                <CodeRedEntryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/code-red/:sessionId"
            element={
              <ProtectedRoute>
                <CodeRedSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/code-red/interview"
            element={
              <ProtectedRoute>
                <CodeRedInterviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/code-red/interview/:sessionId/debrief"
            element={
              <ProtectedRoute>
                <CodeRedDebriefPage />
              </ProtectedRoute>
            }
          />
          {/* Locked environment (spec §8) — auth-gated like every product surface */}
          <Route
            path="/mock-oa"
            element={
              <ProtectedRoute>
                <MockOAInstructionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mock-oa/session"
            element={
              <ProtectedRoute>
                <MockOASessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mock-oa/result"
            element={
              <ProtectedRoute>
                <MockOAResultPage />
              </ProtectedRoute>
            }
          />
          <Route path="/graph" element={<GraphRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
