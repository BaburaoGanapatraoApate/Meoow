export interface NavItem {
  label: string;
  href: string;
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Features', href: '/features' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Demo', href: '/demo' },
  { label: 'Credits', href: '/credits' },
  { label: 'Shortcuts', href: '/shortcuts' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
];

export const FOOTER_NAV = {
  product: [
    { label: 'Features', href: '/features' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Live Demo', href: '/demo' },
    { label: 'Credits & Pricing', href: '/credits' },
    { label: 'Keyboard Shortcuts', href: '/shortcuts' },
    { label: 'Download App', href: '/download' },
  ],
  resources: [
    { label: 'Interview Prep Blog', href: '/blog' },
    { label: 'Help & Support', href: '/support' },
    { label: 'Frequently Asked Questions', href: '/features#faq' },
    { label: 'System Requirements', href: '/download#requirements' },
  ],
  company: [
    { label: 'About Meoow', href: '/about' },
    { label: 'Contact Support', href: '/support' },
    { label: 'Desktop App Features', href: '/download#changelog' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Use', href: '/terms' },
  ],
};

