import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import { signupSchema } from '../lib/auth/validation';
import { authApi, onboardingApi } from '../lib/api/endpoints';
import { ApiError, setToken, setUserId } from '../lib/api/client';
import { useAuth } from '../lib/auth/AuthContext';
import { SKIP_SIGNUP_TARGET } from '../lib/routes';

export const SignupPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  const nextParam = searchParams.get('next') || '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    // Client-side validation
    const valResult = signupSchema.safeParse({ firstName, lastName, email, password });
    if (!valResult.success) {
      const errMap: Record<string, string> = {};
      for (const issue of valResult.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !errMap[field]) {
          errMap[field] = issue.message;
        }
      }
      setFieldErrors(errMap);
      return;
    }

    setLoading(true);
    try {
      const issue = await authApi.register(
        email, `${firstName} ${lastName}`.trim(), password);
      setToken(issue.token);
      setUserId(issue.user_id);
      await refreshSession();
      // Seed the mastery graph right away (backend contract: onboarding).
      try {
        await onboardingApi.initialize();
      } catch {
        // Non-fatal: onboarding flow can initialize again later.
      }
      navigate(nextParam || '/onboarding');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_TAKEN') {
          setFieldErrors({ email: 'An account with this email already exists.' });
          setGeneralError('An account with this email already exists. You can log in instead.');
        } else {
          setGeneralError(err.message);
        }
      } else {
        setGeneralError('Network error. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Top Header with Wordmark and Exit */}
      <header className="w-full px-6 py-5 flex items-center justify-between border-b border-[#1F2420]/8 bg-[#FAF6F0]/80 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-2 group">
          <span
            className="text-[22px] font-normal tracking-[-0.03em] text-[#1F2420]"
            style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
          >
            CLARITY
          </span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[#1F2420]/70 hover:text-[#1F2420] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit to Home</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-12">
        <div className="w-full max-w-[440px] bg-[#FAF6F0] border border-[#1F2420]/12 rounded-[14px] p-6 sm:p-8 shadow-[0_8px_30px_rgba(31,36,32,0.04)]">
          {/* Card Title & Subtitle */}
          <div className="mb-6">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#5B6B4D] font-bold block mb-1.5">
              Student Account
            </span>
            <h1
              className="text-[28px] font-normal text-[#1F2420] tracking-[-0.02em] leading-tight"
              style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
            >
              Create your account
            </h1>
            <p className="mt-1.5 text-[14px] text-[#1F2420]/70 leading-relaxed">
              Join thousands preparing for top engineering technical interviews.
            </p>
          </div>

          {/* General Error Banner */}
          {generalError && (
            <div className="mb-5 p-3 rounded-[8px] bg-red-500/10 border border-red-500/20 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-[12.5px] text-red-900 leading-snug">
                {generalError}
                {generalError.includes('log in instead') && (
                  <div className="mt-1.5">
                    <Link
                      to={`/login?email=${encodeURIComponent(email)}`}
                      className="font-semibold underline text-[#C1592B]"
                    >
                      Click here to Log In
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="signup-firstname"
                  className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/80 mb-1"
                >
                  First Name
                </label>
                <input
                  id="signup-firstname"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className={`w-full px-3 py-2 text-[14px] bg-white border ${
                    fieldErrors.firstName ? 'border-red-500 ring-1 ring-red-500' : 'border-[#1F2420]/20'
                  } rounded-[6px] text-[#1F2420] placeholder-[#1F2420]/30 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50 transition-colors`}
                />
                {fieldErrors.firstName && (
                  <p className="mt-1 text-[11px] text-red-600 font-mono">{fieldErrors.firstName}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-lastname"
                  className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/80 mb-1"
                >
                  Last Name
                </label>
                <input
                  id="signup-lastname"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className={`w-full px-3 py-2 text-[14px] bg-white border ${
                    fieldErrors.lastName ? 'border-red-500 ring-1 ring-red-500' : 'border-[#1F2420]/20'
                  } rounded-[6px] text-[#1F2420] placeholder-[#1F2420]/30 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50 transition-colors`}
                />
                {fieldErrors.lastName && (
                  <p className="mt-1 text-[11px] text-red-600 font-mono">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="signup-email"
                className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/80 mb-1"
              >
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@university.edu"
                className={`w-full px-3 py-2 text-[14px] bg-white border ${
                  fieldErrors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-[#1F2420]/20'
                } rounded-[6px] text-[#1F2420] placeholder-[#1F2420]/30 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50 transition-colors`}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-[11px] text-red-600 font-mono">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="signup-password"
                className="block text-[12px] font-mono uppercase tracking-wider text-[#1F2420]/80 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className={`w-full px-3 py-2 pr-10 text-[14px] bg-white border ${
                    fieldErrors.password ? 'border-red-500 ring-1 ring-red-500' : 'border-[#1F2420]/20'
                  } rounded-[6px] text-[#1F2420] placeholder-[#1F2420]/30 focus:outline-none focus:ring-2 focus:ring-[#C1592B]/50 transition-colors`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#1F2420]/50 hover:text-[#1F2420] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password ? (
                <p className="mt-1 text-[11px] text-red-600 font-mono">{fieldErrors.password}</p>
              ) : (
                <p className="mt-1 text-[11px] text-[#1F2420]/50 font-mono">
                  Must be 8–128 characters.
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-signup-submit"
              disabled={loading}
              className="w-full mt-2 h-11 flex items-center justify-center gap-2 px-4 rounded-[6px] bg-[#1F2420] hover:bg-[#2e3730] active:bg-[#161a17] text-[#FAF6F0] text-[14px] font-medium transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C1592B]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#FAF6F0]/20 border-t-[#FAF6F0] rounded-full animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>

            {/* Skip Option */}
            <div className="pt-2 text-center">
              <Link
                to={SKIP_SIGNUP_TARGET}
                id="link-skip-signup"
                className="w-full h-10 inline-flex items-center justify-center rounded-[6px] text-[14px] font-medium text-[#1F2420]/75 hover:text-[#1F2420] hover:bg-[#1F2420]/5 active:bg-[#1F2420]/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#C1592B] focus:ring-offset-1 focus:ring-offset-[#FAF6F0] cursor-pointer"
              >
                Skip for now
              </Link>
              <p className="mt-1 text-[12px] text-[#1F2420]/60 leading-normal">
                You can create your account later. Until then your progress is saved on this device.
              </p>
            </div>
          </form>

          {/* Bottom Switcher */}
          <div className="mt-6 pt-5 border-t border-[#1F2420]/10 text-center">
            <p className="text-[13px] text-[#1F2420]/70">
              Already have an account?{' '}
              <Link
                to={`/login${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ''}`}
                className="text-[#C1592B] font-semibold hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
