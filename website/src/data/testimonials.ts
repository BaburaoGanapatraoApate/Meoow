/**
 * SAMPLE CANDIDATE PERSPECTIVES & PRACTICE SCENARIOS
 * 
 * Note: These representative profiles illustrate common interview preparation
 * use cases across DSA, system design, screen OCR, and behavioral coaching.
 * They represent practice workflows rather than formal verified customer endorsements.
 */

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  avatarText: string;
  rating: number;
  quote: string;
  tag: string;
  accentColor: string;
}

export const TESTIMONIALS_ROW_1: TestimonialItem[] = [
  {
    id: 't-1',
    name: 'Aarav S.',
    role: 'Computer Science Graduate',
    avatarText: 'AS',
    rating: 5,
    quote: 'The ~0.2s answer speed during practice mock interviews is unreal. It helps me catch edge cases in graph and dynamic programming problems before I start coding.',
    tag: 'DSA Preparation',
    accentColor: 'border-brand-purple-400/30'
  },
  {
    id: 't-2',
    name: 'Priya M.',
    role: 'Frontend Developer Candidate',
    avatarText: 'PM',
    rating: 5,
    quote: 'Being able to press Ctrl+Shift+A to instantly grab a tricky problem statement without breaking focus changed my entire preparation routine.',
    tag: 'Screen Capture',
    accentColor: 'border-blue-400/30'
  },
  {
    id: 't-3',
    name: 'Karthik R.',
    role: 'Full-Stack Engineer',
    avatarText: 'KR',
    rating: 5,
    quote: 'The credit model is so refreshing compared to expensive $50/month subscriptions. 30 free credits to start, and ₹100 for 40 credits is super affordable for students.',
    tag: 'Fair Pricing',
    accentColor: 'border-emerald-400/30'
  },
  {
    id: 't-4',
    name: 'Ananya D.',
    role: 'Backend SDE Candidate',
    avatarText: 'AD',
    rating: 5,
    quote: 'The system design architectural blueprints give structured trade-offs between SQL vs NoSQL, caching strategies, and throughput calculations.',
    tag: 'System Design',
    accentColor: 'border-purple-400/30'
  },
  {
    id: 't-5',
    name: 'Rohan K.',
    role: 'DevOps & Cloud Engineer',
    avatarText: 'RK',
    rating: 5,
    quote: 'Stealth window opacity controls and Alt+Arrow navigation make the desktop app completely non-intrusive. Best technical practice companion I’ve used.',
    tag: 'Desktop UI',
    accentColor: 'border-cyan-400/30'
  }
];

export const TESTIMONIALS_ROW_2: TestimonialItem[] = [
  {
    id: 't-6',
    name: 'Sneha P.',
    role: 'Data Structures Enthusiast',
    avatarText: 'SP',
    rating: 5,
    quote: 'The STAR behavioral method coach helped me turn my college projects into punchy, metric-driven interview stories that impressed hiring managers.',
    tag: 'Behavioral STAR',
    accentColor: 'border-brand-purple-400/30'
  },
  {
    id: 't-7',
    name: 'Vikram N.',
    role: 'Java Backend Candidate',
    avatarText: 'VN',
    rating: 5,
    quote: 'Deepgram live voice transcription accurately captures complex technical terminology and separates questions effortlessly.',
    tag: 'Voice Engine',
    accentColor: 'border-blue-400/30'
  },
  {
    id: 't-8',
    name: 'Devika T.',
    role: 'Self-Taught Programmer',
    avatarText: 'DT',
    rating: 5,
    quote: 'Having the AI break down complex LeetCode hard problems into progressive hints rather than dumping answers helped build real problem-solving intuition.',
    tag: 'Learning Framework',
    accentColor: 'border-emerald-400/30'
  },
  {
    id: 't-9',
    name: 'Manish G.',
    role: 'SDE-1 Applicant',
    avatarText: 'MG',
    rating: 5,
    quote: '30 free signup credits gave me plenty of runway to run 5 full practice interviews. When I topped up for ₹100, the credits were added immediately.',
    tag: 'Student Friendly',
    accentColor: 'border-purple-400/30'
  },
  {
    id: 't-10',
    name: 'Neha B.',
    role: 'Systems Engineer',
    avatarText: 'NB',
    rating: 5,
    quote: 'The desktop app is fast, responsive, and doesn’t lag your computer even while running high-resolution screen capture and live audio transcription.',
    tag: 'Performance',
    accentColor: 'border-cyan-400/30'
  }
];
