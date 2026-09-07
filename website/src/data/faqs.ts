export interface FaqItem {
  question: string;
  answer: string;
}

export const HOME_FAQS: FaqItem[] = [
  {
    question: 'What is Meoow AI and how does it assist with interviews?',
    answer: 'Meoow is a lightweight Windows desktop application designed to assist candidates with technical, coding, system design, and behavioral interview preparation. It provides real-time voice transcription, instant screen capture (Ctrl+Shift+A), and sub-second AI answer streaming (~0.2s) in a discreet floating overlay.'
  },
  {
    question: 'How do the 30 free credits work?',
    answer: 'When you create a new Meoow account and verify your email via the 6-digit OTP code, 30 free credits are immediately added to your account ledger. Each generated AI answer uses exactly 1 credit. There is no trial expiration date and no credit card is required to sign up.'
  },
  {
    question: 'How much does it cost when I need more credits?',
    answer: 'Meoow does not charge expensive monthly recurring subscriptions. You can purchase 40 additional credits for just ₹100 whenever you need more. Credits never expire and remain safe in your account.'
  },
  {
    question: 'How fast are the AI responses generated?',
    answer: 'On supported workflows, Meoow delivers structured AI answers, code hints, and complexity analysis in as little as ~0.2s through our optimized backend AI gateway powered by Groq.'
  },
  {
    question: 'Does Meoow record or store my interview audio?',
    answer: 'No. Audio data is streamed in-memory via an encrypted WebSocket gateway solely for live speech-to-text transcription via Deepgram Nova-3. We do not permanently store or save audio recordings on our servers.'
  },
  {
    question: 'What operating systems are supported?',
    answer: 'Meoow is currently built as a dedicated native desktop application for 64-bit Windows 10 and Windows 11 systems.'
  },
  {
    question: 'Is Meoow also known as Meooow, Meoow Tech, or Meow AI?',
    answer: 'Yes. While the official brand is Meoow (Meoow AI) and our official domain is meooow.tech, users and engineers frequently search for us as Meooow, Meoow Tech, Meooow Tech, Meow, or Meow AI. All of these names refer to the same real-time AI interview copilot and preparation assistant platform.'
  }
];

export const FEATURES_FAQS: FaqItem[] = [
  {
    question: 'How does real-time voice diarization work in Meoow?',
    answer: 'Meoow uses a dual-channel audio engine powered by Deepgram Nova-3. It separates incoming interviewer audio from your local microphone input, generating distinct transcript bubbles for both speakers in real time.'
  },
  {
    question: 'What types of problems can screen capture analyze?',
    answer: 'Pressing Ctrl+Shift+A opens our high-precision crop tool. You can capture LeetCode problem descriptions, IDE code snippets, SQL queries, system architecture diagrams, and complex math equations.'
  },
  {
    question: 'Can Meoow generate solutions in multiple programming languages?',
    answer: 'Yes! Meoow supports Python, Java, C++, C#, TypeScript, JavaScript, Go, Rust, and SQL. You can specify your default preferred language in your session setup.'
  },
  {
    question: 'How does the behavioral interview coach use the STAR method?',
    answer: 'When you upload your resume during session setup, Meoow contextualizes behavioral questions (e.g., "Tell me about a time you resolved a technical conflict") by framing answers around your actual project achievements in structured Situation, Task, Action, and Result format.'
  }
];

export const HOW_IT_WORKS_FAQS: FaqItem[] = [
  {
    question: 'Do I need to install any browser extensions?',
    answer: 'No browser extensions are needed. Meoow operates as a standalone native desktop overlay that works seamlessly across all meeting platforms (Zoom, Google Meet, Teams, Webex) and web browsers.'
  },
  {
    question: 'How do I position or hide the overlay window during a call?',
    answer: 'You can toggle the overlay visibility at any second by pressing Ctrl+Shift+H. You can also adjust background opacity from 10% to 100% and nudge the window in any direction using Alt + Arrow Keys.'
  },
  {
    question: 'How do I start a new session?',
    answer: 'Open the app, upload your optional resume file (PDF/DOCX), enter target role context, and click "Start Session". The live transcription pipeline and screen capture hooks activate immediately.'
  }
];

export const DEMO_FAQS: FaqItem[] = [
  {
    question: 'Can I test Meoow before using it in a real interview?',
    answer: 'Absolutely. We encourage all users to practice with mock interview sessions, LeetCode practice problems, or sample YouTube mock interview recordings using their 30 free signup credits.'
  },
  {
    question: 'What latency should I expect during live question capture?',
    answer: 'Screen capture processing and OCR extraction take a fraction of a second, and AI streaming begins in as little as ~0.2s depending on network connectivity and problem complexity.'
  }
];

export const CREDITS_FAQS: FaqItem[] = [
  {
    question: 'What is a credit?',
    answer: 'One credit represents one successfully generated AI answer or code explanation. Audio transcription, screen capture previews, and window controls do not consume credits.'
  },
  {
    question: 'Do purchased or signup credits expire?',
    answer: 'No. All credits (both signup bonus credits and purchased packs) remain in your account indefinitely until you choose to use them.'
  },
  {
    question: 'Do I need a monthly recurring subscription?',
    answer: 'No. Meoow has zero recurring subscription plans. You pay only for the credits you need (₹100 for 40 credits) through secure Razorpay payments.'
  },
  {
    question: 'What payment methods are accepted?',
    answer: 'We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, and major Indian wallets via Razorpay.'
  },
  {
    question: 'What happens when my credits reach zero?',
    answer: 'When your balance reaches zero, AI answer generation is paused until you top up your balance. You can still access the app, review past sessions, and configure interview settings.'
  }
];

export const SHORTCUTS_FAQS: FaqItem[] = [
  {
    question: 'Can I customize the global shortcuts?',
    answer: 'Global shortcuts are pre-configured to avoid collisions with common operating system and browser hotkeys. The default shortcuts are Ctrl+Shift+H (Show/Hide) and Ctrl+Shift+A (Screen Capture).'
  },
  {
    question: 'Do keyboard shortcuts work when Meoow is minimized or in the background?',
    answer: 'Yes. Global shortcuts are registered at the operating system level, allowing you to capture screens or toggle visibility while coding in your IDE or browser.'
  }
];

export const ABOUT_FAQS: FaqItem[] = [
  {
    question: 'Why was Meoow built?',
    answer: 'Technical interviews are stressful and often test memorization under pressure rather than true engineering capability. Meoow was built to level the playing field by providing an affordable, ultra-fast AI practice companion for students and software engineers.'
  },
  {
    question: 'What is the philosophy behind Meoow?',
    answer: 'We believe AI should empower candidates with structured thinking, hints, and complexity validation rather than replacing human learning. That’s why we focus on fast, transparent, and student-accessible tooling.'
  },
  {
    question: 'How is the brand name spelled — Meoow or Meooow?',
    answer: 'Our official product brand is Meoow (also referred to as Meoow AI or Meoow Tech). To secure a memorable global web presence, our official website is hosted at meooow.tech. Whether you search for Meoow, Meooow, Meoow Tech, Meooow Tech, Meow, or Meow AI, you have reached the official home of our AI interview copilot.'
  }
];

export const SUPPORT_FAQS: FaqItem[] = [
  {
    question: 'What should I do if I do not receive my OTP email during signup?',
    answer: 'Please check your spam/junk folder. Ensure your email address is spelled correctly. You can request a new OTP code after a 60-second cooldown period.'
  },
  {
    question: 'Why is my microphone or audio transcription not picking up sound?',
    answer: 'Make sure you have granted microphone permissions to Meoow in Windows Settings > Privacy & Security > Microphone. In the desktop app, ensure the microphone toggle is unmuted.'
  },
  {
    question: 'How do I contact the Meoow support team?',
    answer: 'You can reach our support team anytime via email at support@meooow.tech. We typically respond within 24 hours.'
  }
];

export const DOWNLOAD_FAQS: FaqItem[] = [
  {
    question: 'What are the minimum system requirements for Meoow?',
    answer: 'Windows 10 or 11 (64-bit), 4 GB RAM, 200 MB free disk space, a functional microphone, and an active broadband internet connection.'
  },
  {
    question: 'Is Meoow free to download?',
    answer: 'Yes, the desktop application is completely free to download. Every verified user receives 30 free starting credits immediately upon account activation.'
  }
];

