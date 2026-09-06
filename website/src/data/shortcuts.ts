export interface ShortcutItem {
  id: string;
  category: 'Window Control' | 'Screen & AI' | 'Navigation & System';
  keys: string[];
  action: string;
  description: string;
  badgeText?: string;
}

export const SHORTCUTS: ShortcutItem[] = [
  {
    id: 'toggle-window',
    category: 'Window Control',
    keys: ['Ctrl', 'Shift', 'H'],
    action: 'Show / Hide Overlay',
    description: 'Instantly toggle the visibility of the Meoow stealth desktop overlay without interrupting active windows or screen sharing.',
    badgeText: 'Global Shortcut'
  },
  {
    id: 'analyze-screen',
    category: 'Screen & AI',
    keys: ['Ctrl', 'Shift', 'A'],
    action: 'Capture & Analyze Screen',
    description: 'Trigger the high-precision screen capture tool to crop code snippets, problem statements, diagrams, or live coding challenges for instant AI analysis.',
    badgeText: 'Global Shortcut'
  },
  {
    id: 'move-window-left',
    category: 'Window Control',
    keys: ['Alt', '←'],
    action: 'Nudge Window Left',
    description: 'Reposition the overlay 20 pixels to the left for optimal visual positioning across multi-monitor or single-screen setups.',
  },
  {
    id: 'move-window-right',
    category: 'Window Control',
    keys: ['Alt', '→'],
    action: 'Nudge Window Right',
    description: 'Reposition the overlay 20 pixels to the right to keep your coding editor or video call view clear.',
  },
  {
    id: 'move-window-up',
    category: 'Window Control',
    keys: ['Alt', '↑'],
    action: 'Nudge Window Up',
    description: 'Move the overlay 20 pixels upward smoothly on your desktop screen.',
  },
  {
    id: 'move-window-down',
    category: 'Window Control',
    keys: ['Alt', '↓'],
    action: 'Nudge Window Down',
    description: 'Move the overlay 20 pixels downward on your desktop screen.',
  },
  {
    id: 'toggle-devtools',
    category: 'Navigation & System',
    keys: ['Ctrl', 'Shift', 'I'],
    action: 'Toggle Developer Tools',
    description: 'Open developer diagnostics and network inspect tools for local debugging and troubleshooting.',
  },
];

