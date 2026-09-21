export interface CompanySuggestion {
  id: string;
  name: string;
  category: string;
  tier: 'tier1' | 'tier2' | 'fintech' | 'startup';
}

export const TOP_COMPANIES: CompanySuggestion[] = [
  { id: 'google', name: 'Google', category: 'Big Tech', tier: 'tier1' },
  { id: 'microsoft', name: 'Microsoft', category: 'Big Tech', tier: 'tier1' },
  { id: 'amazon', name: 'Amazon', category: 'Big Tech', tier: 'tier1' },
  { id: 'meta', name: 'Meta', category: 'Big Tech', tier: 'tier1' },
  { id: 'apple', name: 'Apple', category: 'Big Tech', tier: 'tier1' },
  { id: 'uber', name: 'Uber', category: 'Ride/Mobility', tier: 'tier1' },
  { id: 'atlassian', name: 'Atlassian', category: 'Enterprise SaaS', tier: 'tier1' },
  { id: 'adobe', name: 'Adobe', category: 'Creative Tech', tier: 'tier1' },
  { id: 'goldman-sachs', name: 'Goldman Sachs', category: 'Fintech / Banking', tier: 'fintech' },
  { id: 'de-shaw', name: 'D.E. Shaw', category: 'Quantitative / Finance', tier: 'fintech' },
  { id: 'morgan-stanley', name: 'Morgan Stanley', category: 'Investment Banking', tier: 'fintech' },
  { id: 'salesforce', name: 'Salesforce', category: 'Cloud SaaS', tier: 'tier1' },
  { id: 'stripe', name: 'Stripe', category: 'Fintech Payments', tier: 'fintech' },
  { id: 'oracle', name: 'Oracle', category: 'Cloud Infrastructure', tier: 'tier2' },
  { id: 'netflix', name: 'Netflix', category: 'Streaming Tech', tier: 'tier1' },
  { id: 'airbnb', name: 'Airbnb', category: 'Hospitality Tech', tier: 'tier1' },
  { id: 'nvidia', name: 'NVIDIA', category: 'Compute & AI', tier: 'tier1' },
  { id: 'palantir', name: 'Palantir', category: 'Enterprise AI', tier: 'tier1' },
];

export interface PlacementTimelineOption {
  id: string;
  label: string;
  description: string;
  urgency: 'high' | 'medium' | 'steady';
  tag: string;
}

export const TIMELINE_OPTIONS: PlacementTimelineOption[] = [
  {
    id: 'immediate',
    label: 'Immediate / Next 30–60 Days',
    description: 'Active placement drives & upcoming OA invitations right now',
    urgency: 'high',
    tag: 'Urgent',
  },
  {
    id: 'autumn-winter-2026',
    label: 'Upcoming Campus Placement Drive (Autumn 2026)',
    description: 'Final year / pre-final year on-campus day-1 and day-2 recruitment',
    urgency: 'high',
    tag: 'Main Cycle',
  },
  {
    id: 'summer-internship-2027',
    label: 'Summer Internships (Mid 2027)',
    description: 'Pre-final year internship screening rounds and coding challenges',
    urgency: 'medium',
    tag: 'Internship',
  },
  {
    id: 'next-year-2027',
    label: 'Next Placement Season (2027 Cohort)',
    description: 'Foundational build-up with 6–12 months of structured depth',
    urgency: 'steady',
    tag: 'Long Term',
  },
  {
    id: 'off-campus-lateral',
    label: 'Off-Campus & Lateral Transitions',
    description: 'Continuous rolling applications, referrals, and external hiring contests',
    urgency: 'medium',
    tag: 'Rolling',
  },
];
