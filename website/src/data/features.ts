export interface FeatureItem {
  id: string;
  category: 'core' | 'technical' | 'experience' | 'security';
  title: string;
  tagline: string;
  description: string;
  iconName: string;
  highlight?: string;
  details: string[];
}

export const FEATURES: FeatureItem[] = [
  {
    id: 'real-time-transcription',
    category: 'core',
    title: 'Real-Time Voice Transcription',
    tagline: 'Deepgram Nova-3 Multi-Channel Voice Engine',
    description: 'Captures and diarizes audio in real-time with ultra-low latency, clearly distinguishing interviewer questions from your own voice.',
    iconName: 'Mic',
    highlight: 'Dual-Channel Diarization',
    details: [
      'Separates interviewer speech from candidate speech automatically',
      'Ultra-fast real-time speech-to-text with high accuracy on technical terminology',
      'Ephemeral audio buffers with zero persistent voice recordings'
    ]
  },
  {
    id: 'screen-understanding',
    category: 'core',
    title: 'Instant Screen & Code Capture',
    tagline: 'Analyze code, diagrams, and problem statements',
    description: 'Capture any region of your screen with a single keystroke (Ctrl+Shift+A) to instantly parse coding problems, diagrams, and complex prompts.',
    iconName: 'Scan',
    highlight: 'Single-Key Capture',
    details: [
      'High-precision OCR tuned for code syntax and algorithmic diagrams',
      'Automatic problem statement parsing and constraint detection',
      'Zero interruption to active video conference windows'
    ]
  },
  {
    id: 'fast-ai-answers',
    category: 'core',
    title: 'Sub-Second AI Answer Pipeline',
    tagline: 'Near-instant responses powered by Groq',
    description: 'Generates structured, clean answers in as little as ~0.2s on supported workflows, providing hints, edge cases, and code solutions without awkward pauses.',
    iconName: 'Zap',
    highlight: 'As fast as ~0.2s',
    details: [
      'Streaming token delivery directly into your lightweight desktop overlay',
      'Clean syntax-highlighted code blocks in Python, Java, C++, TypeScript, and Go',
      'Concise, interview-tailored explanations optimized for verbal articulation'
    ]
  },
  {
    id: 'dsa-copilot',
    category: 'technical',
    title: 'DSA & Algorithmic Problem Solver',
    tagline: 'Master LeetCode-style technical challenges',
    description: 'Get structured algorithmic breakdowns including optimal data structures, time and space complexity, boundary conditions, and test cases.',
    iconName: 'Code',
    highlight: 'Time & Space Complexity',
    details: [
      'Provides optimal Big-O complexity analysis upfront',
      'Highlights tricky edge cases (empty arrays, overflow, recursion limits)',
      'Offers progressive hints before full implementation code'
    ]
  },
  {
    id: 'system-design-framework',
    category: 'technical',
    title: 'System Design Architecture Copilot',
    tagline: 'Structured scalability, caching, and partitioning',
    description: 'Navigate high-level architectural questions with structured blueprints: functional requirements, API contracts, database schemas, and trade-offs.',
    iconName: 'Cpu',
    highlight: 'Scalability Blueprints',
    details: [
      'Guides you through QPS estimation, data storage sizing, and throughput math',
      'Suggests optimal caching strategies (Redis, CDN), sharding, and message queues (Kafka)',
      'Articulates CAP theorem trade-offs and disaster recovery strategies'
    ]
  },
  {
    id: 'behavioral-star-coaching',
    category: 'technical',
    title: 'Behavioral STAR Method Coach',
    tagline: 'Structure situational stories with impact',
    description: 'Transform your past projects and experiences into crisp, compelling STAR (Situation, Task, Action, Result) answers aligned with company leadership principles.',
    iconName: 'Compass',
    highlight: 'STAR Method Framing',
    details: [
      'Maps questions to resume bullet points uploaded during session setup',
      'Emphasizes quantifiable results, conflict resolution, and leadership ownership',
      'Avoids rambling with concise, high-impact talking points'
    ]
  },
  {
    id: 'stealth-overlay-controls',
    category: 'experience',
    title: 'Stealth Desktop Overlay & Window Controls',
    tagline: 'Discreet, customizable, and always accessible',
    description: 'Designed specifically as a floating transparent desktop overlay with adjustable opacity slider, quick hide shortcut (Ctrl+Shift+H), and keyboard nudging.',
    iconName: 'Layers',
    highlight: 'Stealth Shortcuts',
    details: [
      'Adjust background opacity from 10% to 100% on the fly',
      'Move window effortlessly using Alt + Arrow Keys',
      'Protected window architecture designed for unobtrusive background operation'
    ]
  },
  {
    id: 'context-customization',
    category: 'experience',
    title: 'Personalized Interview Context',
    tagline: 'Resume parsing & target role alignment',
    description: 'Upload your resume (PDF/DOCX) and specify the job title, company name, and preferred programming language before starting each session.',
    iconName: 'FileText',
    highlight: 'Resume-Aware AI',
    details: [
      'Extracts key technical skills, past company stack, and project achievements',
      'Generates answers that reflect your personal background and seniority level',
      'Supports target role customization from Junior Engineer to Staff Architect'
    ]
  },
  {
    id: 'transparent-credit-model',
    category: 'security',
    title: 'Transparent, Pay-As-You-Go Credits',
    tagline: 'No forced monthly subscriptions',
    description: 'Start free with 30 bonus credits upon email verification. Purchase 40 additional credits for just ₹100 whenever you need them. 1 credit = 1 answer.',
    iconName: 'CreditCard',
    highlight: '30 Free Credits + ₹100/40',
    details: [
      'Exactly 1 credit deducted per successfully generated AI answer',
      'Credits never expire and remain safe in your account ledger',
      'Secure payment processing powered by Razorpay'
    ]
  },
  {
    id: 'privacy-first-security',
    category: 'security',
    title: 'Privacy-Conscious Architecture',
    tagline: 'Ephemeral audio and encrypted server gateways',
    description: 'All AI communication is handled through isolated backend gateways with zero persistent audio storage and AES-256 encrypted credentials.',
    iconName: 'ShieldCheck',
    highlight: 'Zero Audio Stored',
    details: [
      'Audio streams are ephemeral and processed in-memory for live transcription only',
      'Backend authentication secured by industry-standard JWTs and Argon2/Bcrypt hashing',
      'Strict database row-level authorization on Neon PostgreSQL'
    ]
  }
];

