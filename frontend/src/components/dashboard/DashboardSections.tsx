import React, { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  DashboardPayload,
  DashboardSectionConfig,
  RevisionTopic,
} from '../../lib/dashboard/types';
import { TodayRevisionSection } from './TodayRevisionSection';
import { SandboxSection } from './SandboxSection';
import { SectionRail } from './SectionRail';

export const DASHBOARD_SECTIONS_CONFIG: DashboardSectionConfig[] = [
  {
    id: 'section-today-revision',
    label: "Today's Revision",
    component: TodayRevisionSection,
  },
  {
    id: 'section-oa-sandbox',
    label: 'Simulated OA Sandbox',
    component: SandboxSection,
  },
];

interface DashboardSectionsProps {
  payload: DashboardPayload;
  isWelcome?: boolean;
  sections?: DashboardSectionConfig[];
  onActionClick?: (action: string, topic?: RevisionTopic) => void;
}

export const DashboardSections: React.FC<DashboardSectionsProps> = ({
  payload,
  isWelcome = false,
  sections = DASHBOARD_SECTIONS_CONFIG,
  onActionClick,
}) => {
  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id || '');
  const [section1HandoffProgress, setSection1HandoffProgress] = useState<number>(0);
  const shouldReduceMotion = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);

  // Track active section and scroll-linked handoff for Section 1 -> Section 2
  useEffect(() => {
    const observerCallback: IntersectionObserverCallback = (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          setActiveSectionId(entry.target.id);
        }
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: '-64px 0px -20% 0px',
      threshold: [0.1, 0.3, 0.5, 0.8],
    });

    sections.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    // Scroll listener for Section 1 handoff dimming and scaling
    const handleScroll = () => {
      if (shouldReduceMotion) return;

      const sec2 = document.getElementById('section-oa-sandbox');
      if (!sec2) return;

      const rect = sec2.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // As section 2 approaches viewport center, handoff progress goes from 0 to 1
      if (rect.top < windowHeight && rect.top > 0) {
        const progress = Math.min(1, Math.max(0, (windowHeight - rect.top) / (windowHeight * 0.7)));
        setSection1HandoffProgress(progress);
      } else if (rect.top <= 0) {
        setSection1HandoffProgress(1);
      } else {
        setSection1HandoffProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [sections, shouldReduceMotion]);

  const handleSelectSection = (id: string) => {
    setActiveSectionId(id);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 64;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
      });
    }
  };

  // Compute handoff styles for Section 1 (opacity ~ 0.6, scale ~ 0.985)
  const sec1Opacity = shouldReduceMotion ? 1 : 1 - section1HandoffProgress * 0.4;
  const sec1Scale = shouldReduceMotion ? 1 : 1 - section1HandoffProgress * 0.015;

  return (
    <div
      ref={containerRef}
      className="relative w-full flex flex-col gap-12 sm:gap-20"
      style={{
        scrollSnapType: 'y proximity',
      }}
    >
      {/* Floating Section Navigation Rail */}
      <SectionRail
        sections={sections}
        activeSectionId={activeSectionId}
        onSelectSection={handleSelectSection}
      />

      {/* Render Configured Sections */}
      {sections.map((sec, index) => {
        const Component = sec.component;
        const isSection1 = index === 0;

        return (
          <div
            key={sec.id}
            id={sec.id}
            style={
              isSection1 && !shouldReduceMotion
                ? {
                    opacity: sec1Opacity,
                    transform: `scale(${sec1Scale})`,
                    transformOrigin: 'top center',
                    transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
                  }
                : undefined
            }
          >
            <Component
              payload={payload}
              isWelcome={isWelcome}
              onActionClick={onActionClick}
            />
          </div>
        );
      })}
    </div>
  );
};
