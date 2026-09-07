import { CANONICAL_DOMAIN, BRAND_NAME, PRODUCT_NAME, METRICS } from '../utils/constants';
import { BlogPost } from './blogPosts';

export interface PageSeoConfig {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  keywords: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterCard?: 'summary_large_image' | 'summary';
  noIndex?: boolean;
  structuredData?: object | object[];
}

export const DEFAULT_OG_IMAGE = `${CANONICAL_DOMAIN}/og-meoow.png`;

export const GLOBAL_KEYWORDS = [
  'Meoow',
  'Meoow AI',
  'Meooow',
  'Meoow Tech',
  'Meooow Tech',
  'Meow',
  'Meow AI',
  'Meooow AI',
  'Meooow.tech',
  'AI interview help',
  'AI interview assistant',
  'AI interview preparation',
  'free AI interview tools',
  'DSA interview preparation',
  'system design interview preparation',
  'behavioral interview preparation',
  'real-time AI interview assistance',
  'AI interview copilot',
  'coding interview practice',
  'technical interview assistant',
  'Groq AI interview copilot',
  'Deepgram voice transcription interview',
];

/**
 * Global Schema.org Structured Data
 */
export const getGlobalOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND_NAME,
  alternateName: [
    'Meoow AI',
    'Meooow',
    'Meooow AI',
    'Meoow Tech',
    'Meooow Tech',
    'Meow',
    'Meow AI',
    'Meooow.tech',
  ],
  legalName: 'Meoow AI Technologies',
  url: CANONICAL_DOMAIN,
  logo: `${CANONICAL_DOMAIN}/logo.png`,
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@meooow.tech',
    contactType: 'customer support',
    availableLanguage: ['English'],
  },
});

export const getWebSiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: PRODUCT_NAME,
  alternateName: [
    'Meoow',
    'Meooow',
    'Meooow AI',
    'Meoow Tech',
    'Meooow Tech',
    'Meow',
    'Meow AI',
    'Meooow.tech',
  ],
  url: CANONICAL_DOMAIN,
  description: 'Real-Time AI Interview Copilot & Preparation Assistant for Software Engineers',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${CANONICAL_DOMAIN}/blog?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

export const getSoftwareApplicationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: PRODUCT_NAME,
  alternateName: [
    'Meoow',
    'Meooow',
    'Meoow Tech',
    'Meooow Tech',
    'Meow',
    'Meow AI',
    'Meooow AI',
  ],
  operatingSystem: 'Windows 10, Windows 11 (64-bit)',
  applicationCategory: 'DeveloperApplication',
  offers: {
    '@type': 'Offer',
    price: '0.00',
    priceCurrency: 'USD',
    description: `Free tier with ${METRICS.freeCredits} starter credits, then ₹${METRICS.paidPackagePriceInr} per ${METRICS.paidPackageCredits} credits package (pay-as-you-go).`,
  },
  featureList: [
    'Sub-second (~0.2s) Groq LPU reasoning gateway',
    'Real-time Deepgram speech transcription',
    'One-key screen OCR and code snippet capture (Ctrl+Shift+A)',
    'Discreet desktop overlay with opacity controls and hotkeys',
    'Data structures & algorithms (DSA) hints and complexity trade-offs',
    'System design architecture breakdown and capacity calculation',
    'Behavioral STAR method answer framing from candidate resume',
  ],
});

/**
 * Static Routes SEO Map
 */
export const STATIC_PAGE_SEO: Record<string, PageSeoConfig> = {
  '/': {
    title: 'Meoow AI | Real-Time AI Interview Copilot & Preparation Assistant',
    metaDescription:
      'Meoow (Meoow AI) is the real-time AI interview copilot and preparation assistant for software engineers. Get live speech transcription, instant screen OCR capture, and sub-second Groq AI hints. Start free with 30 credits at meooow.tech.',
    canonicalUrl: `${CANONICAL_DOMAIN}/`,
    keywords: [
      'Meoow',
      'Meoow AI',
      'Meooow',
      'Meoow Tech',
      'Meooow Tech',
      'Meow',
      'Meow AI',
      'Meooow AI',
      'Meooow.tech',
      'AI interview help',
      'AI interview assistant',
      'AI interview preparation',
      'free AI interview tools',
      'real-time AI interview assistance',
      'AI interview copilot',
      'coding interview practice',
    ],
    ogTitle: 'Meoow AI | Real-Time AI Interview Copilot & Preparation Assistant',
    ogDescription:
      'Meoow (Meoow AI) is the real-time AI interview copilot and preparation assistant for software engineers. Excel in technical software interviews with sub-second AI hints, voice transcription, and instant screen OCR. Start free with 30 bonus credits.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    structuredData: [
      getGlobalOrganizationSchema(),
      getWebSiteSchema(),
      getSoftwareApplicationSchema(),
    ],
  },
  '/features': {
    title: 'Features — Voice Transcription, Screen OCR & AI Copilot | Meoow AI',
    metaDescription:
      'Explore Meoow AI features: Deepgram real-time voice transcription, Groq sub-second (~0.2s) reasoning, one-key screen OCR capture (Ctrl+Shift+A), and discrete desktop overlay.',
    canonicalUrl: `${CANONICAL_DOMAIN}/features`,
    keywords: [
      'AI interview features',
      'voice transcription interview',
      'screen OCR coding interview',
      'Groq AI interview copilot',
      'technical interview overlay',
    ],
    ogTitle: 'Features — Voice Transcription, Screen OCR & Fast AI Copilot | Meoow AI',
    ogDescription:
      'Discover sub-second AI inference, real-time voice transcription, resume-tailored answers, and non-intrusive desktop hotkeys.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  },
  '/how-it-works': {
    title: 'How It Works — Step-by-Step AI Interview Preparation | Meoow AI',
    metaDescription:
      'Learn how Meoow AI operates: download the desktop client, press hotkeys to capture problem statements, receive sub-second AI hints, and master technical interviews.',
    canonicalUrl: `${CANONICAL_DOMAIN}/how-it-works`,
    keywords: [
      'how AI interview copilot works',
      'AI interview preparation workflow',
      'technical interview practice steps',
      'real-time interview assistant workflow',
    ],
    ogTitle: 'How It Works — Step-by-Step AI Interview Preparation | Meoow AI',
    ogDescription:
      'See how Meoow captures live audio, reads coding problems with OCR, and streams structured hints with ~0.2s latency.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  },
  '/demo': {
    title: 'Interactive Demo — Test Live AI Interview Assistance | Meoow AI',
    metaDescription:
      'Experience Meoow AI in an interactive browser demo. Simulate DSA problem extraction, system design scoping, and behavioral STAR answers in real time.',
    canonicalUrl: `${CANONICAL_DOMAIN}/demo`,
    keywords: [
      'AI interview demo',
      'interactive interview simulation',
      'try AI interview copilot',
      'DSA mock interview demo',
    ],
    ogTitle: 'Interactive Demo — Test Live AI Interview Assistance | Meoow AI',
    ogDescription:
      'Test DSA problem solving, system design diagrams, and behavioral STAR framing live in our interactive demo.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  },
  '/credits': {
    title: 'Pricing & Credits — Transparent Pay-As-You-Go | Meoow AI',
    metaDescription:
      'Simple, student-friendly AI interview pricing. Get 30 free starting credits on signup, then purchase packs of 40 credits for just ₹100. No recurring subscriptions.',
    canonicalUrl: `${CANONICAL_DOMAIN}/credits`,
    keywords: [
      'AI interview pricing',
      'free AI interview credits',
      'pay as you go interview prep',
      'affordable coding interview help',
      'cheap AI interview assistant',
    ],
    ogTitle: 'Pricing & Credits — Transparent Pay-As-You-Go | Meoow AI',
    ogDescription:
      'Get 30 free credits on registration. Top up anytime with ₹100 for 40 credits. Zero recurring subscriptions or hidden fees.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  },
  '/shortcuts': {
    title: 'Keyboard Shortcuts & Hotkeys Guide | Meoow AI',
    metaDescription:
      'Master Meoow AI keyboard shortcuts: Ctrl+Shift+A for instant screen capture, Ctrl+Shift+H to hide overlay, Ctrl+Shift+C to copy code, and opacity toggles.',
    canonicalUrl: `${CANONICAL_DOMAIN}/shortcuts`,
    keywords: [
      'AI interview shortcuts',
      'interview copilot hotkeys',
      'screen capture hotkey interview',
      'desktop overlay keyboard controls',
    ],
    ogTitle: 'Keyboard Shortcuts & Hotkeys Guide | Meoow AI',
    ogDescription:
      'Learn the essential keyboard shortcuts to control Meoow AI seamlessly during mock practice and technical interviews.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  },
  '/about': {
    title: 'About Us — Empowering Engineers in Technical Interviews | Meoow AI',
    metaDescription:
      'Learn about the mission behind Meoow AI: making elite technical interview preparation accessible, transparent, and affordable for software engineers globally.',
    canonicalUrl: `${CANONICAL_DOMAIN}/about`,
    keywords: [
      'about Meoow AI',
      'AI interview company mission',
      'technical interview preparation team',
      'software engineering interview coaching',
    ],
    ogTitle: 'About Us — Empowering Engineers in Technical Interviews | Meoow AI',
    ogDescription:
      'Building ultra-low-latency, privacy-focused AI tools to help engineers showcase their best capabilities in technical interviews.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    structuredData: getGlobalOrganizationSchema(),
  },
  '/blog': {
    title: 'Blog — Technical Interview Prep, DSA & AI Guides | Meoow AI',
    metaDescription:
      'In-depth engineering guides, algorithmic patterns, system design frameworks, behavioral interview strategies, and AI interview preparation insights.',
    canonicalUrl: `${CANONICAL_DOMAIN}/blog`,
    keywords: [
      'technical interview blog',
      'DSA interview preparation',
      'system design interview guide',
      'behavioral interview STAR method',
      'AI interview assistant guides',
      'free interview tools',
    ],
    ogTitle: 'Blog — Technical Interview Prep, DSA & AI Guides | Meoow AI',
    ogDescription:
      'Read in-depth guides on DSA patterns, system design scaling, STAR behavioral framing, and effective AI-assisted preparation.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  },
  '/support': {
    title: 'Help & Support — FAQs & Technical Assistance | Meoow AI',
    metaDescription:
      'Get help with Meoow AI: troubleshooting desktop permissions, audio setup, credit balance, Razorpay billing, and contact our engineering support team.',
    canonicalUrl: `${CANONICAL_DOMAIN}/support`,
    keywords: [
      'Meoow AI support',
      'interview copilot help',
      'desktop audio setup troubleshooting',
      'AI interview assistant customer service',
    ],
    ogTitle: 'Help & Support — FAQs & Technical Assistance | Meoow AI',
    ogDescription:
      'Find answers to setup questions, audio configuration, credit packages, and reach out to our support team.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  },
  '/privacy': {
    title: 'Privacy Policy — Ephemeral Audio & Data Protection | Meoow AI',
    metaDescription:
      'Read the Meoow AI Privacy Policy. We process voice audio ephemerally, never store raw meeting recordings, and encrypt all user data in transit and at rest.',
    canonicalUrl: `${CANONICAL_DOMAIN}/privacy`,
    keywords: [
      'Meoow AI privacy policy',
      'ephemeral audio processing',
      'interview data security',
      'AI privacy standards',
    ],
    ogTitle: 'Privacy Policy — Ephemeral Audio & Data Protection | Meoow AI',
    ogDescription:
      'Learn how Meoow protects candidate privacy with zero audio retention, end-to-end encryption, and strict data governance.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  },
  '/terms': {
    title: 'Terms of Service — Usage Guidelines & Policies | Meoow AI',
    metaDescription:
      'Review the Terms of Service for Meoow AI desktop application and website. Understand credit terms, acceptable use policies, and software licensing.',
    canonicalUrl: `${CANONICAL_DOMAIN}/terms`,
    keywords: [
      'Meoow AI terms of service',
      'software license terms',
      'acceptable use policy',
    ],
    ogTitle: 'Terms of Service — Usage Guidelines & Policies | Meoow AI',
    ogDescription:
      'Read the official Terms of Service governing the use of Meoow AI desktop software and web services.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
  },
  '/download': {
    title: 'Download Meoow AI for Windows — Free Desktop Client (30 Credits)',
    metaDescription:
      'Download Meoow AI for Windows 10 & 11 (64-bit). Real-time speech transcription, one-key screen OCR, and sub-second Groq AI assistance. Includes 30 free credits.',
    canonicalUrl: `${CANONICAL_DOMAIN}/download`,
    keywords: [
      'download Meoow AI',
      'AI interview assistant download',
      'free AI interview software Windows',
      'coding interview copilot desktop app',
    ],
    ogTitle: 'Download Meoow AI for Windows — Free Desktop Client (30 Credits)',
    ogDescription:
      'Get the native Windows desktop client with 30 free starting credits. Real-time audio transcription and instant screen OCR.',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    structuredData: getSoftwareApplicationSchema(),
  },
  '/login': {
    title: 'Login to Your Account | Meoow AI',
    metaDescription: 'Log in to your Meoow AI account to manage credits, view purchase history, and configure desktop settings.',
    canonicalUrl: `${CANONICAL_DOMAIN}/login`,
    keywords: ['Meoow AI login', 'sign in interview copilot'],
    noIndex: true,
  },
  '/signup': {
    title: 'Create an Account — Get 30 Free Credits | Meoow AI',
    metaDescription: 'Create a free Meoow AI account and instantly claim 30 free credits for real-time AI interview practice.',
    canonicalUrl: `${CANONICAL_DOMAIN}/signup`,
    keywords: ['Meoow AI signup', 'register free interview credits'],
    noIndex: true,
  },
};

/**
 * Fallback 404 SEO Config
 */
export const NOT_FOUND_SEO: PageSeoConfig = {
  title: 'Page Not Found (404) | Meoow AI',
  metaDescription: 'The page you are looking for could not be found on Meoow AI.',
  canonicalUrl: `${CANONICAL_DOMAIN}/404`,
  keywords: ['404', 'not found'],
  noIndex: true,
};

/**
 * Get SEO configuration for a given route pathname
 */
export const getSeoForPath = (pathname: string): PageSeoConfig => {
  const normalizedPath = pathname === '' ? '/' : pathname.replace(/\/+$/, '') || '/';
  if (STATIC_PAGE_SEO[normalizedPath]) {
    return STATIC_PAGE_SEO[normalizedPath];
  }
  return NOT_FOUND_SEO;
};

/**
 * Generate Schema.org BlogPosting / Article JSON-LD
 */
export const getBlogPostSchema = (post: BlogPost) => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: post.title,
  alternativeHeadline: post.metaTitle,
  description: post.metaDescription,
  image: post.tags.length > 0 ? DEFAULT_OG_IMAGE : DEFAULT_OG_IMAGE,
  datePublished: '2026-09-04T08:00:00+00:00',
  dateModified: '2026-09-06T12:00:00+00:00',
  author: {
    '@type': 'Organization',
    name: post.author,
    url: CANONICAL_DOMAIN,
  },
  publisher: {
    '@type': 'Organization',
    name: BRAND_NAME,
    url: CANONICAL_DOMAIN,
    logo: {
      '@type': 'ImageObject',
      url: `${CANONICAL_DOMAIN}/logo.png`,
    },
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': post.canonicalUrl,
  },
  keywords: post.tags.join(', '),
  articleSection: post.category,
});

/**
 * Generate Schema.org BreadcrumbList JSON-LD
 */
export const getBreadcrumbSchema = (
  items: { name: string; url: string }[]
) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

