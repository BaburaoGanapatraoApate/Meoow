export interface StepItem {
  stepNumber: string;
  title: string;
  shortDesc: string;
  details: string;
  iconName: string;
  tip?: string;
}

export const WORKFLOW_STEPS: StepItem[] = [
  {
    stepNumber: '01',
    title: 'Download & Launch Desktop App',
    shortDesc: 'Install the lightweight Meoow desktop client on Windows 10/11.',
    details: 'Get the official Meoow Windows client in seconds. The application runs quietly in the background with minimal CPU/memory footprint.',
    iconName: 'DownloadCloud',
    tip: 'Runs alongside Zoom, Google Meet, Microsoft Teams, and browser-based coding platforms.'
  },
  {
    stepNumber: '02',
    title: 'Register & Claim 30 Free Credits',
    shortDesc: 'Verify your email to receive 30 complimentary AI interview credits.',
    details: 'Sign up with your email and verify your 6-digit OTP sent via Brevo. Exactly 30 free credits are immediately credited to your account balance.',
    iconName: 'Gift',
    tip: 'No credit card required. No automatic trial rebilling.'
  },
  {
    stepNumber: '03',
    title: 'Set Up Your Interview Session Context',
    shortDesc: 'Upload your resume and define your target role and language.',
    details: 'Attach your PDF/DOCX resume and specify your target company, role, and preferred programming languages (e.g. Python, Java, C++, TypeScript).',
    iconName: 'Sliders',
    tip: 'Meoow tailors every answer to match your real-world experience and target seniority level.'
  },
  {
    stepNumber: '04',
    title: 'Start Live Session & Enable Audio',
    shortDesc: 'Connect Deepgram real-time transcription for live audio input.',
    details: 'Click "Start Session" to open the live dual-channel audio pipeline. Meoow listens to incoming interviewer audio and transcribes technical questions live.',
    iconName: 'Radio',
    tip: 'Toggle background opacity and use Ctrl+Shift+H to show or hide the overlay at any instant.'
  },
  {
    stepNumber: '05',
    title: 'Capture Screen or Select Questions',
    shortDesc: 'Press Ctrl+Shift+A to capture code or algorithmic questions on screen.',
    details: 'Encountered a complex coding challenge or diagram? Hit Ctrl+Shift+A to instantly crop and analyze the question with high-accuracy OCR.',
    iconName: 'Crop',
    tip: 'You can also click on any transcribed audio message to generate an instant answer.'
  },
  {
    stepNumber: '06',
    title: 'Get Instant AI Guidance in ~0.2s',
    shortDesc: 'Review clean code solutions, hints, and structured talking points.',
    details: 'Our optimized Groq backend gateway streams concise, interview-ready answers with syntax-highlighted code, edge cases, and time/space complexity.',
    iconName: 'CheckCircle2',
    tip: 'Exactly 1 credit is deducted per successfully generated AI answer. Pay ₹100 for 40 credits only when you need more.'
  }
];

