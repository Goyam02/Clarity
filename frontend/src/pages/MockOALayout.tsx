import React, { useEffect } from 'react';

export interface MockOALayoutProps {
  children: React.ReactNode;
}

/**
 * Layout for the /mock-oa route group.
 * Minimal exam chrome with no dashboard header or navigation.
 * Uses strict noindex robots meta and dashboard cream/terracotta tokens.
 */
export default function MockOALayout({ children }: MockOALayoutProps) {
  useEffect(() => {
    // Ensure robots noindex tag exists while in mock-oa route
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    let created = false;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
      created = true;
    }
    const previousContent = meta.content;
    meta.content = 'noindex, nofollow';

    return () => {
      if (meta) {
        if (created) {
          meta.remove();
        } else {
          meta.content = previousContent || '';
        }
      }
    };
  }, []);

  return (
    <div
      id="mock-oa-root"
      className="min-h-screen w-full bg-[#FAF6F0] text-[#1F2420] antialiased selection:bg-[#C1592B] selection:text-[#FAF6F0] flex flex-col font-sans"
    >
      <main className="flex-1 flex flex-col w-full">{children}</main>
    </div>
  );
}
