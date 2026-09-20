import { DashboardPayload, RevisionTopic, AdaptiveProblem } from './types';

export const MOCK_REVISION_TOPICS: RevisionTopic[] = [
  {
    id: 'dynamic_programming',
    label: 'Dynamic Programming (2D & State Optimization)',
    subject: 'DSA',
    band: 'weak',
    rating: 2,
    ratingMax: 5,
    priority: 'High',
    reasons: ['unmet_prerequisite', 'past_mistakes'],
    whySelected: 'Critical blocker for Google OA round 1 hard graph/matrix path problems',
    oaRelevance: {
      askedCount: 19,
      sampleSize: 24,
    },
    subtopics: [
      'Grid DP & memoization tables',
      'Space-optimized 1D rolling array states',
      'Partitioning & knapsack variants',
    ],
    learningGoal: 'Synthesize optimal substructure without recursive stack overflow under 25 minutes',
    estimatedMinutes: 35,
    actions: ['start_revision', 'practice_questions', 'quick_quiz'],
  },
  {
    id: 'binary_search',
    label: 'Binary Search on Solution Space',
    subject: 'DSA',
    band: 'developing',
    rating: 3,
    ratingMax: 5,
    priority: 'High',
    reasons: ['revision_due', 'partial_mastery'],
    whySelected: 'Frequently combined with greedy checks in first-round technical screens',
    oaRelevance: {
      askedCount: 14,
      sampleSize: 24,
    },
    subtopics: [
      'Predicate monotonically decreasing functions',
      'Lower-bound vs upper-bound boundary condition termination',
      'Search space overflow bounds',
    ],
    learningGoal: 'Master invariant-safe mid-calculation and avoid off-by-one edge traps',
    estimatedMinutes: 25,
    actions: ['start_revision', 'practice_questions', 'quick_quiz'],
  },
  {
    id: 'recursion_backtracking',
    label: 'Backtracking & Pruning Invariants',
    subject: 'DSA',
    band: 'weak',
    rating: 2,
    ratingMax: 5,
    priority: 'High',
    reasons: ['needs_practice'],
    whySelected: 'Heavy execution time penalty observed on past exploratory search sets',
    oaRelevance: {
      askedCount: 11,
      sampleSize: 24,
    },
    subtopics: [
      'State undoing patterns & bitmask visited states',
      'Aggressive branch pruning conditions',
      'Combination sum with duplicates',
    ],
    learningGoal: 'Write strict pruning bounds before expanding the recursive DFS tree',
    estimatedMinutes: 30,
    actions: ['start_revision', 'practice_questions', 'quick_quiz'],
  },
  {
    id: 'sql_queries',
    label: 'SQL Window Functions & CTE Subqueries',
    subject: 'SQL',
    band: 'strong',
    rating: 4,
    ratingMax: 5,
    priority: 'Medium',
    reasons: ['revision_due'],
    whySelected: 'Maintain peak proficiency for mixed online assessment sections',
    oaRelevance: {
      askedCount: 8,
      sampleSize: 24,
    },
    subtopics: [
      'DENSE_RANK() over partition windows',
      'Recursive Common Table Expressions',
      'Self-joins on rolling date intervals',
    ],
    learningGoal: 'Refine syntax speed for cumulative aggregations under 10 minutes',
    estimatedMinutes: 20,
    actions: ['start_revision', 'practice_questions', 'quick_quiz'],
  },
  {
    id: 'dbms_fundamentals',
    label: 'Database Indexing & B+ Trees',
    subject: 'DBMS',
    band: 'weak',
    rating: 2,
    ratingMax: 5,
    priority: 'Medium',
    reasons: ['unmet_prerequisite', 'past_mistakes'],
    whySelected: 'Required foundation before query execution plan optimization',
    oaRelevance: null, // Tests case where oaRelevance is null
    subtopics: [
      'Clustered vs Secondary indexes',
      'B+ Tree fanout and disk I/O bounds',
      'Composite index leftmost prefix rule',
    ],
    learningGoal: 'Explain page splits and disk blocks with precise complexity metrics',
    estimatedMinutes: 25,
    actions: ['start_revision', 'quick_quiz'],
  },
  {
    id: 'sliding_window',
    label: 'Two Pointers & Dynamic Sliding Window',
    subject: 'DSA',
    band: 'developing',
    rating: 3,
    ratingMax: 5,
    priority: 'Low',
    reasons: ['partial_mastery'],
    whySelected: 'Secondary pattern commonly merged with hash map frequency checks',
    oaRelevance: {
      askedCount: 16,
      sampleSize: 24,
    },
    subtopics: [
      'Variable length window condition shrink/expand loop',
      'Substrings containing all k character permutations',
      'Monotonic queue window maximums',
    ],
    learningGoal: 'Solidify linear O(N) guarantees with right/left pointer mechanics',
    estimatedMinutes: 20,
    actions: ['start_revision', 'practice_questions'],
  },
];

export const MOCK_ADAPTIVE_PROBLEMS: AdaptiveProblem[] = [
  {
    id: 'prob-1',
    title: 'Kth Smallest Element in a Sorted Matrix',
    difficulty: 'Medium',
    topicId: 'binary_search',
    url: 'https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/',
  },
  {
    id: 'prob-2',
    title: 'Maximum Profit in Job Scheduling (Weighted DP + BS)',
    difficulty: 'Hard',
    topicId: 'dynamic_programming',
    url: 'https://leetcode.com/problems/maximum-profit-in-job-scheduling/',
  },
  {
    id: 'prob-3',
    title: 'Subarray Product Less Than K (Sliding Window)',
    difficulty: 'Medium',
    topicId: 'sliding_window',
    url: 'https://leetcode.com/problems/subarray-product-less-than-k/',
  },
];

export const MOCK_DASHBOARD_PAYLOAD: DashboardPayload = {
  user: {
    name: 'Candidate',
  },
  target: {
    company: 'Google',
    oaDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    daysLeft: 14,
  },
  clearScore: {
    value: 78,
    label: 'Top 12% Placement Readiness',
  },
  today: {
    generatedAt: new Date().toISOString(),
    totalMinutes: 95,
    topics: MOCK_REVISION_TOPICS,
    adaptiveSet: MOCK_ADAPTIVE_PROBLEMS,
  },
  sandbox: {
    badge: 'CODE RED',
    poolTitle: 'Google 2026 Question Pool',
    verifiedQuestions: 142,
    recurrenceNote: 'Updated weekly from verified campus & off-campus 2025/2026 drive submissions.',
    durationMinutes: 70,
    proctored: true,
    expect: [
      'Full-screen lock with Proctor Mode telemetry',
      '2 algorithmic challenges with hidden stress & corner test suites',
      'Strict execution time limit (2.0s for Java/Python, 1.0s for C++)',
      'Post-assessment diagnostic breakdown mapped to your Obsidian graph',
    ],
    launchUrl: '/mock-oa/google',
  },
};

/**
 * Creates a customized mock payload utilizing saved profile if available,
 * ensuring values match what the user set during onboarding.
 */
export function createMockDashboardPayload(custom?: Partial<DashboardPayload>): DashboardPayload {
  let company = 'Google';
  let daysLeft = 14;
  let userName = 'Candidate';
  let clearScoreVal = 78;

  try {
    const saved = localStorage.getItem('clarity_completed_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.goals?.dreamCompany) {
        company = parsed.goals.dreamCompany;
      }
      if (parsed.goals?.daysLeft) {
        daysLeft = parsed.goals.daysLeft;
      } else if (parsed.goals?.placementTimeline === 'immediate') {
        daysLeft = 14;
      } else if (parsed.goals?.placementTimeline?.includes('autumn')) {
        daysLeft = 42;
      }

      if (parsed.skillRatings) {
        const vals = Object.values(parsed.skillRatings) as number[];
        if (vals.length > 0) {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          clearScoreVal = Math.round((avg / 5) * 100);
        }
      }
    }
  } catch {
    // ignore
  }

  const targetDate = new Date(Date.now() + daysLeft * 86400000).toISOString();

  return {
    ...MOCK_DASHBOARD_PAYLOAD,
    user: {
      name: userName,
    },
    target: {
      company: custom?.target?.company || company,
      oaDate: custom?.target?.oaDate || targetDate,
      daysLeft: custom?.target?.daysLeft ?? daysLeft,
    },
    clearScore: {
      value: custom?.clearScore?.value ?? clearScoreVal,
      label: custom?.clearScore?.label || 'Top 12% Placement Readiness',
    },
    sandbox: {
      ...MOCK_DASHBOARD_PAYLOAD.sandbox,
      poolTitle: `${company} 2026 Question Pool`,
      launchUrl: `/mock-oa/${encodeURIComponent(company.toLowerCase())}`,
    },
    ...custom,
  };
}

/**
 * Fixture for empty topic state (to test empty state requirement)
 */
export const MOCK_EMPTY_DASHBOARD_PAYLOAD: DashboardPayload = {
  ...MOCK_DASHBOARD_PAYLOAD,
  today: {
    ...MOCK_DASHBOARD_PAYLOAD.today,
    totalMinutes: 0,
    topics: [],
    adaptiveSet: MOCK_ADAPTIVE_PROBLEMS,
  },
};
