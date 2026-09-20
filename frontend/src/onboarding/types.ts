export interface UserProfiles {
  leetcode?: string;
  codeforces?: string;
  gfg?: string;
  github?: string;
  hackerrank?: string;
  codechef?: string;
}

export interface UserGoals {
  dreamCompany: string;
  targetRole?: string;
  placementTimeline: string;
  oaDate?: string;
  daysLeft?: number;
}

export interface ResumeSignal {
  fileName: string;
  skills: string[];
  projects: string[];
}

export interface ScreenshotSignal {
  fileName: string;
  platform: 'leetcode' | 'gfg' | 'other';
  solvedCounts?: { easy?: number; medium?: number; hard?: number; total?: number };
  topicBreakdown?: Record<string, number>;
}

export interface PlatformPull {
  codeforces?: {
    handle: string;
    rating?: number;
    solved?: number;
    recentTags?: string[];
    error?: string;
  };
  github?: {
    username: string;
    topLanguages?: string[];
    repoCount?: number;
    error?: string;
  };
  leetcode?: {
    username: string;
    totalSolved?: number;
    blendedCount?: number;
  };
}

export interface OnboardingPayload {
  profiles: UserProfiles;
  skillRatings: Record<string, number>; // topic key -> rating (1 to 5)
  goals: UserGoals;
  resume?: ResumeSignal | null;
  screenshots?: ScreenshotSignal[];
  platformPulls?: PlatformPull | null;
  calibration?: {
    runId: string;
    answered: number;
    correct: number;
  } | null;
  completedAt?: string;
}

export interface TopicItem {
  id: string;
  name: string;
  description?: string;
}

export interface TopicCategory {
  id: string;
  name: string;
  shortName: string;
  description: string;
  topics: TopicItem[];
}
