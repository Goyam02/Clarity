import React from 'react';

export type Band = 'weak' | 'developing' | 'strong';

export type Reason =
  | 'revision_due'
  | 'needs_practice'
  | 'unmet_prerequisite'
  | 'past_mistakes'
  | 'partial_mastery';

export interface DashboardPayload {
  user: {
    name: string;
  };
  target: {
    company: string;
    oaDate: string; // ISO string
    daysLeft: number;
  };
  clearScore: {
    value: number;
    label: string;
  };
  today: {
    generatedAt: string;
    totalMinutes: number;
    topics: RevisionTopic[];
    adaptiveSet: AdaptiveProblem[];
  };
  sandbox: {
    badge?: string;
    poolTitle: string;
    verifiedQuestions: number;
    recurrenceNote: string;
    durationMinutes: number;
    proctored: boolean;
    expect: string[];
    launchUrl: string;
  };
}

export interface RevisionTopic {
  id: string;
  label: string;
  subject: 'DSA' | 'SQL' | 'DBMS' | 'OS' | 'CN';
  band: Band;
  rating: number;
  ratingMax: number;
  priority: 'High' | 'Medium' | 'Low';
  reasons: Reason[];
  whySelected: string;
  oaRelevance: {
    askedCount: number;
    sampleSize: number;
  } | null;
  subtopics: string[];
  learningGoal: string;
  estimatedMinutes: number;
  actions: ('start_revision' | 'practice_questions' | 'quick_quiz')[];
}

export interface AdaptiveProblem {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topicId: string;
  url: string;
}

export interface DashboardSectionConfig {
  id: string;
  label: string;
  component: React.ComponentType<{
    payload: DashboardPayload;
    isWelcome: boolean;
    onActionClick?: (action: string, topic?: RevisionTopic) => void;
  }>;
}

// Reason human-readable mapping
export const REASON_LABELS: Record<Reason, string> = {
  revision_due: 'Revision Due',
  needs_practice: 'Needs Practice',
  unmet_prerequisite: 'Unmet Prerequisite',
  past_mistakes: 'Past Mistakes',
  partial_mastery: 'Partial Mastery',
};
