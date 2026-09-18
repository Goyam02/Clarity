import React from 'react';

interface Testimonial {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatarColor: string;
  initials: string;
}

const row1Testimonials: Testimonial[] = [
  {
    id: 'r1-1',
    name: 'Aarav Sharma',
    role: 'CSE Student',
    quote: 'I finally stopped solving random problems. CLARITY actually showed me what I was weak at and what I should revise next.',
    avatarColor: 'from-[#C1592B] to-[#A3471E]',
    initials: 'AS',
  },
  {
    id: 'r1-2',
    name: 'Riya Mehta',
    role: 'Software Engineering Aspirant',
    quote: 'The daily plan feels completely different from a normal question sheet. It adapts to what I actually get wrong.',
    avatarColor: 'from-[#5B6B4D] to-[#45533A]',
    initials: 'RM',
  },
  {
    id: 'r1-3',
    name: 'Karan Verma',
    role: 'AI/ML Student',
    quote: 'The Knowledge Graph made it surprisingly easy to see which topics were holding back my DSA preparation.',
    avatarColor: 'from-[#526470] to-[#3B4A54]',
    initials: 'KV',
  },
  {
    id: 'r1-4',
    name: 'Ananya Kapoor',
    role: 'Placement Aspirant',
    quote: 'CODE RED is exactly what I wanted before an OA. Give it the company, JD and time — and it builds the preparation plan.',
    avatarColor: 'from-[#B8623B] to-[#994C29]',
    initials: 'AK',
  },
  {
    id: 'r1-5',
    name: 'Dev Malhotra',
    role: 'CSE Student',
    quote: "The best part is that my mock interview doesn't feel disconnected from my daily preparation.",
    avatarColor: 'from-[#657756] to-[#4C5B3E]',
    initials: 'DM',
  },
  {
    id: 'r1-6',
    name: 'Ishita Singh',
    role: 'Software Engineering Aspirant',
    quote: 'I went from preparing everything randomly to knowing exactly what needed attention.',
    avatarColor: 'from-[#7A6451] to-[#5C4938]',
    initials: 'IS',
  },
];

const row2Testimonials: Testimonial[] = [
  {
    id: 'r2-1',
    name: 'Arjun Bhatia',
    role: 'CSE Student',
    quote: 'Instead of asking what I should study today, CLARITY gives me a reason for every task.',
    avatarColor: 'from-[#4D625A] to-[#364942]',
    initials: 'AB',
  },
  {
    id: 'r2-2',
    name: 'Simran Kaur',
    role: 'Placement Aspirant',
    quote: 'The AI interviewer actually remembers where I struggle. That makes every mock interview more useful.',
    avatarColor: 'from-[#C1592B] to-[#A14820]',
    initials: 'SK',
  },
  {
    id: 'r2-3',
    name: 'Rahul Jain',
    role: 'Software Engineering Aspirant',
    quote: 'Seeing my mastery change after every session makes preparation feel measurable.',
    avatarColor: 'from-[#5B6B4D] to-[#46533A]',
    initials: 'RJ',
  },
  {
    id: 'r2-4',
    name: 'Mehak Gupta',
    role: 'AI/ML Student',
    quote: 'The company-specific preparation is what caught my attention. It feels much more targeted than generic DSA practice.',
    avatarColor: 'from-[#7B614F] to-[#5F4737]',
    initials: 'MG',
  },
  {
    id: 'r2-5',
    name: 'Aditya Rao',
    role: 'CSE Student',
    quote: 'I used to revise topics only when I remembered them. Now CLARITY reminds me before they disappear.',
    avatarColor: 'from-[#4A5D6B] to-[#354550]',
    initials: 'AR',
  },
  {
    id: 'r2-6',
    name: 'Naman Sethi',
    role: 'Placement Aspirant',
    quote: "One place for daily prep, mock OAs, interviews and my actual weak areas. That's the workflow I was missing.",
    avatarColor: 'from-[#A85834] to-[#874121]',
    initials: 'NS',
  },
];

const TestimonialCard: React.FC<{ item: Testimonial }> = ({ item }) => {
  return (
    <div
      className="w-[320px] sm:w-[350px] md:w-[360px] h-[210px] sm:h-[220px] shrink-0 p-5 sm:p-6 rounded-[16px] bg-[#FBF9F5] border border-[#1F2420]/10 hover:border-[#C1592B]/40 hover:bg-[#FFFFFF] hover:scale-[1.02] hover:shadow-[0_12px_36px_rgba(40,35,25,0.08)] transition-all duration-200 shadow-[0_8px_30px_rgba(40,35,25,0.05)] flex flex-col justify-between select-none cursor-default group/card text-left"
    >
      {/* Card Header: Avatar, Name, Role, and subtle quote accent */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full bg-gradient-to-br ${item.avatarColor} flex items-center justify-center text-[#FAF6F0] font-semibold text-xs tracking-wider border border-white/20 shadow-xs`}
          >
            {item.initials}
          </div>
          <div>
            <h4 className="text-[15px] font-semibold text-[#1F2420] leading-tight tracking-[-0.01em]">
              {item.name}
            </h4>
            <p className="text-[12px] font-medium text-[#1F2420]/60 mt-0.5 tracking-wide">
              {item.role}
            </p>
          </div>
        </div>

        {/* Subtle accent quote icon in muted sage moss */}
        <svg
          className="w-4 h-4 text-[#5B6B4D]/70 group-hover/card:text-[#C1592B] transition-colors"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
      </div>

      {/* Subtle separator */}
      <div className="w-full h-px bg-[#1F2420]/8 my-3" />

      {/* Testimonial Quote */}
      <p className="text-[13.5px] leading-[1.58] text-[#1F2420]/85 font-normal tracking-[-0.01em] line-clamp-3">
        &ldquo;{item.quote}&rdquo;
      </p>
    </div>
  );
};

export const TestimonialsSection: React.FC = () => {
  return (
    <section
      id="reviews"
      className="w-full bg-[#FAF6F0] text-[#1F2420] pt-24 sm:pt-28 md:pt-32 pb-24 sm:pb-32 relative overflow-hidden transition-colors"
      aria-label="Student testimonials"
    >
      {/* Background Decorative Matrix: Extremely subtle warm grid (3-5% opacity) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(rgba(31, 36, 32, 0.05) 1px, transparent 1px),
            repeating-linear-gradient(45deg, rgba(31, 36, 32, 0.015) 0, rgba(31, 36, 32, 0.015) 1px, transparent 0, transparent 40px)
          `,
          backgroundSize: '32px 32px, auto',
        }}
        aria-hidden="true"
      />

      {/* Soft Ambient Radial Variation to avoid looking flat */}
      <div
        className="absolute top-1/3 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none blur-[140px] opacity-15"
        style={{ background: 'radial-gradient(circle, #5B6B4D 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full pointer-events-none blur-[140px] opacity-10"
        style={{ background: 'radial-gradient(circle, #C1592B 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center mb-14 sm:mb-18 md:mb-20">
        {/* Section Heading */}
        <h2
          className="text-[32px] sm:text-[42px] md:text-[50px] font-normal tracking-[-0.025em] leading-[1.12] text-[#1F2420]"
          style={{ fontFamily: '"Newsreader", "Fraunces", Georgia, serif' }}
        >
          Built for the moment that matters.
        </h2>

        {/* Supporting Line */}
        <p className="mt-4 sm:mt-5 text-[16px] sm:text-[18px] text-[#1F2420]/75 max-w-2xl mx-auto font-normal leading-relaxed tracking-[-0.01em]">
          From daily practice to the night before your OA, CLARITY keeps your preparation connected.
        </p>
      </div>

      {/* Dual Marquee Track Container with Left and Right Edge Gradient Masks */}
      <div className="w-full relative z-10">
        {/* Soft edge gradient fade overlays blending into the cream background */}
        <div className="absolute top-0 bottom-0 left-0 w-16 sm:w-28 md:w-36 bg-gradient-to-r from-[#FAF6F0] to-transparent pointer-events-none z-20" />
        <div className="absolute top-0 bottom-0 right-0 w-16 sm:w-28 md:w-36 bg-gradient-to-l from-[#FAF6F0] to-transparent pointer-events-none z-20" />

        <div className="w-full flex flex-col gap-6 sm:gap-7">
          {/* Row 1: Continuously Moving LEFT TO RIGHT (→ → →) */}
          <div
            className="w-full overflow-hidden flex group"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
              maskImage:
                'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            }}
          >
            <div className="flex items-center gap-5 sm:gap-6 shrink-0 animate-marquee-l2r group-hover:[animation-play-state:paused] pr-5 sm:pr-6">
              {row1Testimonials.map((item) => (
                <TestimonialCard key={item.id} item={item} />
              ))}
            </div>
            <div
              className="flex items-center gap-5 sm:gap-6 shrink-0 animate-marquee-l2r group-hover:[animation-play-state:paused] pr-5 sm:pr-6"
              aria-hidden="true"
            >
              {row1Testimonials.map((item) => (
                <TestimonialCard key={`dup-${item.id}`} item={item} />
              ))}
            </div>
          </div>

          {/* Row 2: Continuously Moving RIGHT TO LEFT (← ← ←) */}
          <div
            className="w-full overflow-hidden flex group"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
              maskImage:
                'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            }}
          >
            <div className="flex items-center gap-5 sm:gap-6 shrink-0 animate-marquee-r2l group-hover:[animation-play-state:paused] pr-5 sm:pr-6">
              {row2Testimonials.map((item) => (
                <TestimonialCard key={item.id} item={item} />
              ))}
            </div>
            <div
              className="flex items-center gap-5 sm:gap-6 shrink-0 animate-marquee-r2l group-hover:[animation-play-state:paused] pr-5 sm:pr-6"
              aria-hidden="true"
            >
              {row2Testimonials.map((item) => (
                <TestimonialCard key={`dup-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
