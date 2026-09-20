import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { ArrowRight } from 'lucide-react';
import {
  ClarityLogo,
  DailyModeWordmark,
  CodeRedWordmark,
  MockInterviewWordmark,
  KnowledgeGraphWordmark,
  ClearScoreWordmark,
  MasteryModelWordmark,
  QuestionGeneratorWordmark,
  AiEvaluatorWordmark,
  CompanyIntelWordmark,
  OutcomeLoopWordmark,
} from '../components/Logos';
import { TestimonialsSection } from '../components/Testimonials';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  // Only real anchors — every link scrolls somewhere that exists.
  const navLinks = [
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Products', href: '#products' },
    { name: 'Reviews', href: '#reviews' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F2420] flex flex-col font-sans relative overflow-x-hidden selection:bg-[#C1592B] selection:text-[#FAF6F0]">
      {/* Hero & Brand Marquee Landing Container */}
      <div className="relative w-full flex flex-col">
        {/* Sarvam-inspired Atmospheric Ambient Glow (Luminous warm orange center + soft pale blue/lavender flanks fading to cream) */}
        <div
          className="absolute top-0 left-0 right-0 h-[780px] sm:h-[840px] md:h-[900px] pointer-events-none overflow-hidden z-0"
          aria-hidden="true"
        >
          {/* Central Rich Warm Orange Glow (Mirrors Sarvam hero atmosphere) */}
          <div
            className="absolute top-[-110px] sm:top-[-130px] left-1/2 -translate-x-1/2 w-[140%] sm:w-[900px] md:w-[1100px] lg:w-[1280px] h-[460px] sm:h-[540px] md:h-[620px] rounded-[50%]"
            style={{
              background:
                'radial-gradient(ellipse at 50% 32%, rgba(249, 115, 22, 0.78) 0%, rgba(249, 115, 22, 0.65) 22%, rgba(251, 146, 60, 0.48) 45%, rgba(253, 186, 116, 0.22) 68%, transparent 88%)',
              filter: 'blur(60px)',
            }}
          />

          {/* Top-Left Pale Blue / Lavender Flank Glow */}
          <div
            className="absolute top-[-110px] sm:top-[-130px] left-[-20%] sm:left-[-120px] w-[100%] sm:w-[580px] md:w-[720px] lg:w-[840px] h-[500px] sm:h-[580px] rounded-[50%]"
            style={{
              background:
                'radial-gradient(ellipse at 35% 35%, rgba(165, 180, 252, 0.75) 0%, rgba(147, 197, 253, 0.52) 34%, rgba(199, 210, 254, 0.22) 62%, transparent 85%)',
              filter: 'blur(65px)',
            }}
          />

          {/* Top-Right Pale Blue / Lavender Flank Glow */}
          <div
            className="absolute top-[-110px] sm:top-[-130px] right-[-20%] sm:right-[-120px] w-[100%] sm:w-[580px] md:w-[720px] lg:w-[840px] h-[500px] sm:h-[580px] rounded-[50%]"
            style={{
              background:
                'radial-gradient(ellipse at 65% 35%, rgba(165, 180, 252, 0.75) 0%, rgba(147, 197, 253, 0.52) 34%, rgba(199, 210, 254, 0.22) 62%, transparent 85%)',
              filter: 'blur(65px)',
            }}
          />

          {/* Core high-luminance warm orange sunburst focal layer */}
          <div
            className="absolute top-[-60px] sm:top-[-80px] left-1/2 -translate-x-1/2 w-[100%] sm:w-[650px] md:w-[800px] h-[280px] sm:h-[350px] rounded-[50%]"
            style={{
              background:
                'radial-gradient(ellipse at 50% 25%, rgba(255, 107, 0, 0.85) 0%, rgba(249, 115, 22, 0.55) 45%, transparent 75%)',
              filter: 'blur(50px)',
            }}
          />

          {/* Base unifying smooth ambient diffusion layer blending into cream */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              background:
                'radial-gradient(ellipse 95% 70% at 50% 0%, rgba(255, 138, 36, 0.25) 0%, rgba(180, 198, 252, 0.30) 42%, rgba(250, 246, 240, 0) 85%)',
            }}
          />
        </div>

        {/* Top Navigation */}
      <header className="w-full bg-[#FAF6F0]/40 backdrop-blur-md relative z-50 transition-colors">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-12 h-20 flex items-center justify-between">
          {/* Left section: Clarity Wordmark + Primary Navigation */}
          <div className="flex items-center gap-8 xl:gap-12">
            <Link to="/" className="flex items-center focus:outline-none" aria-label="Clarity Home">
              <ClarityLogo />
            </Link>

            <nav className="hidden lg:flex items-center gap-7 xl:gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-[15px] font-medium text-[#1F2420]/80 hover:text-[#C1592B] transition-colors duration-150"
                >
                  {link.name}
                </a>
              ))}
            </nav>
          </div>

          {/* Right section: Authentication & Action buttons */}
          <div className="hidden sm:flex items-center gap-5 md:gap-6">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="px-[18px] py-[9px] text-[14px] font-medium text-[#FAF6F0] bg-[#1F2420] border border-[#1F2420] rounded-[4px] hover:bg-[#2d352f] active:bg-[#161a17] transition-all duration-150 shadow-xs cursor-pointer"
                >
                  Go to Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="text-[14px] font-medium text-[#C1592B] hover:text-[#9e431c] transition-colors cursor-pointer"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-[15px] font-medium text-[#1F2420]/85 hover:text-[#C1592B] transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/signup"
                  className="px-[18px] py-[9px] text-[14px] font-medium text-[#FAF6F0] bg-[#1F2420] border border-[#1F2420] rounded-[4px] hover:bg-[#2d352f] active:bg-[#161a17] transition-all duration-150 shadow-xs cursor-pointer"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger toggle */}
          <div className="flex sm:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-[#1F2420] hover:bg-[#1F2420]/5 focus:outline-none"
              aria-label="Toggle navigation"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-b border-[#1F2420]/10 bg-[#FAF6F0] px-6 pt-3 pb-6 space-y-3 shadow-md">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base font-medium text-[#1F2420] hover:text-[#C1592B] py-1"
              >
                {link.name}
              </a>
            ))}
            <div className="pt-4 border-t border-[#1F2420]/10 flex flex-col gap-2.5">
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 text-sm font-medium text-[#FAF6F0] bg-[#1F2420] rounded-[4px] hover:bg-[#2d352f] transition-colors"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-base font-medium text-[#1F2420] hover:text-[#C1592B] py-1"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 text-sm font-medium text-[#FAF6F0] bg-[#1F2420] rounded-[4px] hover:bg-[#2d352f] transition-colors"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start text-center px-6 relative z-10">
        {/* Hero Section */}
        <section className="pt-16 sm:pt-20 md:pt-24 lg:pt-[104px] pb-10 max-w-5xl mx-auto flex flex-col items-center">
          {/* Supporting Micro-copy */}
          <p className="text-[12px] sm:text-[13px] md:text-[14px] text-[#5B6B4D] font-medium tracking-[0.03em] mb-4 sm:mb-5 select-none">
            One student. One evolving mastery model. Every session makes the next one smarter.
          </p>

          {/* Main Editorial Headline */}
          <h1
            className="text-[44px] sm:text-[62px] md:text-[74px] lg:text-[84px] font-normal tracking-[-0.025em] leading-[1.08] text-[#1F2420]"
            style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, "Times New Roman", serif' }}
          >
            <span className="text-[#C1592B] italic font-normal">Be ready</span>
            <br />
            before the interview
          </h1>

          {/* Subheading */}
          <p className="mt-7 sm:mt-8 text-[17px] sm:text-[18px] md:text-[19px] text-[#1F2420]/75 max-w-[700px] font-normal leading-[1.58] tracking-[-0.01em]">
            CLARITY builds a live model of what you actually know,
            <br className="hidden sm:inline" /> then turns it into personalized practice, company-specific
            <br className="hidden sm:inline" /> OAs, and AI mock interviews.
          </p>

          {/* CTA Buttons */}
          <div className="mt-9 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto">
            <Link
              to={user ? "/dashboard" : "/signup"}
              className="w-full sm:w-auto px-7 py-[13px] text-[15px] font-medium text-[#FAF6F0] bg-[#1F2420] border border-[#1F2420] rounded-[4px] hover:bg-[#2e3730] active:bg-[#161a17] transition-all duration-150 shadow-xs cursor-pointer text-center"
            >
              {user ? 'Go to Dashboard' : 'Start Preparing'}
            </Link>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-7 py-[13px] text-[15px] font-medium text-[#1F2420] bg-transparent border border-[#1F2420] rounded-[4px] hover:bg-[#1F2420]/5 active:bg-[#1F2420]/10 transition-all duration-150 cursor-pointer text-center"
            >
              See How It Works
            </a>
          </div>
        </section>

        {/* How It Works: real anchor target for #how-it-works (3 steps) */}
        <section
          id="how-it-works"
          className="w-full max-w-[1100px] mx-auto mt-6 sm:mt-10 pb-4 px-2 scroll-mt-24"
          aria-label="How Clarity works"
        >
          <h2
            className="text-[28px] sm:text-[36px] font-normal tracking-[-0.02em] text-center text-[#1F2420]"
            style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
          >
            How it works
          </h2>
          <div className="mt-8 sm:mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '01',
                title: 'Connect & calibrate',
                body: 'Link LeetCode, Codeforces, and GitHub — plus a short calibration. Your mastery model starts from real data, never self-report alone.',
              },
              {
                step: '02',
                title: 'See what you actually know',
                body: 'A live knowledge graph tracks mastery per topic, decays what you skip, and shows exactly why each recommendation is on your plan.',
              },
              {
                step: '03',
                title: 'Practice under real pressure',
                body: 'Company-targeted OAs, proctored mock assessments, and AI mock interviews — all feeding the same mastery model.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="p-5 sm:p-6 rounded-[14px] bg-[#FBF9F5]/90 border border-[#1F2420]/10 text-left shadow-[0_2px_12px_rgba(40,35,25,0.03)]"
              >
                <span className="text-[11px] font-mono font-bold text-[#C1592B] tracking-widest">{s.step}</span>
                <h3 className="mt-2 text-[17px] font-semibold text-[#1F2420] tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#1F2420]/70">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Link
              to={user ? '/dashboard' : '/signup'}
              className="inline-flex items-center gap-2 px-6 py-3 text-[14.5px] font-medium text-[#FAF6F0] bg-[#1F2420] rounded-[4px] hover:bg-[#2e3730] transition-all shadow-xs"
            >
              <span>Start building your mastery model</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Logo / Brand Pillar Marquee Section with Left & Right Gradient Masks */}
        <section id="products" className="w-full max-w-[1280px] mx-auto mt-12 sm:mt-16 md:mt-20 lg:mt-24 pb-28 sm:pb-36 overflow-hidden scroll-mt-20" aria-label="Core CLARITY pillars">
          <div
            className="w-full flex flex-col gap-7 sm:gap-8 group"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
              maskImage:
                'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
            }}
          >
            {/* Row 1: Scrolling Left (DAILY MODE, CODE RED, MOCK INTERVIEW, KNOWLEDGE GRAPH, CLEAR SCORE) */}
            <div className="overflow-hidden flex w-full">
              <div className="flex items-center gap-14 sm:gap-18 md:gap-20 shrink-0 animate-marquee-left group-hover:[animation-play-state:paused] pr-14 sm:pr-18 md:pr-20">
                <DailyModeWordmark />
                <CodeRedWordmark />
                <MockInterviewWordmark />
                <KnowledgeGraphWordmark />
                <ClearScoreWordmark />
              </div>
              <div
                className="flex items-center gap-14 sm:gap-18 md:gap-20 shrink-0 animate-marquee-left group-hover:[animation-play-state:paused] pr-14 sm:pr-18 md:pr-20"
                aria-hidden="true"
              >
                <DailyModeWordmark />
                <CodeRedWordmark />
                <MockInterviewWordmark />
                <KnowledgeGraphWordmark />
                <ClearScoreWordmark />
              </div>
            </div>

            {/* Row 2: Scrolling Right (MASTERY MODEL, QUESTION GENERATOR, AI EVALUATOR, COMPANY INTEL, OUTCOME LOOP) */}
            <div className="overflow-hidden flex w-full">
              <div className="flex items-center gap-14 sm:gap-18 md:gap-20 shrink-0 animate-marquee-right group-hover:[animation-play-state:paused] pr-14 sm:pr-18 md:pr-20">
                <MasteryModelWordmark />
                <QuestionGeneratorWordmark />
                <AiEvaluatorWordmark />
                <CompanyIntelWordmark />
                <OutcomeLoopWordmark />
              </div>
              <div
                className="flex items-center gap-14 sm:gap-18 md:gap-20 shrink-0 animate-marquee-right group-hover:[animation-play-state:paused] pr-14 sm:pr-18 md:pr-20"
                aria-hidden="true"
              >
                <MasteryModelWordmark />
                <QuestionGeneratorWordmark />
                <AiEvaluatorWordmark />
                <CompanyIntelWordmark />
                <OutcomeLoopWordmark />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Glowing Soft Moss Green Horizon (Fade from off-white #FAF6F0 into #5B6B4D) */}
      <div
        className="w-full h-[200px] sm:h-[240px] md:h-[280px] pointer-events-none absolute bottom-0 left-0 right-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 110% 85% at 50% 100%, rgba(91, 107, 77, 0.55) 0%, rgba(91, 107, 77, 0.32) 35%, rgba(91, 107, 77, 0.12) 65%, rgba(250, 246, 240, 0) 100%)',
        }}
        aria-hidden="true"
      />
      </div>

      {/* Testimonials / Reviews Section at the VERY BOTTOM */}
      <TestimonialsSection />
    </div>
  );
}

