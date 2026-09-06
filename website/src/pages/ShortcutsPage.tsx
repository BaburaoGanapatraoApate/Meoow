import React, { useState } from 'react';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Accordion } from '../components/ui/Accordion';
import { CtaSection } from '../components/ui/CtaSection';
import { SHORTCUTS, ShortcutItem } from '../data/shortcuts';
import { SHORTCUTS_FAQS } from '../data/faqs';
import { Keyboard, Search } from 'lucide-react';

export const ShortcutsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredShortcuts = SHORTCUTS.filter((sc) => {
    const matchesCategory =
      activeCategory === 'all' || sc.category === activeCategory;
    const matchesSearch =
      sc.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.keys.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-20 sm:space-y-28 py-12">
      {/* 1. HERO SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <Badge variant="purple" size="md">
          <Keyboard className="w-3.5 h-3.5" />
          <span>Keyboard Guide</span>
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-brand-navy-950 tracking-tight leading-tight">
          Master Meoow with{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple-600 to-indigo-500">
            Global Hotkeys
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Control your desktop overlay, capture code on screen, and nudge window position without taking your hands off the keyboard.
        </p>
      </section>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-brand-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-purple-400 shadow-sm"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm text-xs font-semibold">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeCategory === 'all'
                  ? 'bg-brand-purple-600 text-white'
                  : 'text-slate-600 hover:text-brand-navy-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveCategory('Window Control')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeCategory === 'Window Control'
                  ? 'bg-brand-purple-600 text-white'
                  : 'text-slate-600 hover:text-brand-navy-900'
              }`}
            >
              Window Control
            </button>
            <button
              onClick={() => setActiveCategory('Screen & AI')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeCategory === 'Screen & AI'
                  ? 'bg-brand-purple-600 text-white'
                  : 'text-slate-600 hover:text-brand-navy-900'
              }`}
            >
              Screen & AI
            </button>
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredShortcuts.map((sc: ShortcutItem) => (
            <Card key={sc.id} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">{sc.category}</span>
                {sc.badgeText && <Badge variant="purple" size="sm">{sc.badgeText}</Badge>}
              </div>

              {/* Keycaps Visualizer */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {sc.keys.map((key, kIdx) => (
                  <React.Fragment key={kIdx}>
                    <kbd className="px-3 py-1.5 rounded-lg bg-slate-100 border-2 border-slate-300/80 shadow text-brand-navy-950 font-mono font-bold text-sm tracking-wide">
                      {key}
                    </kbd>
                    {kIdx < sc.keys.length - 1 && <span className="text-slate-400 font-bold">+</span>}
                  </React.Fragment>
                ))}
              </div>

              <div>
                <h3 className="text-base font-bold text-brand-navy-950">{sc.action}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  {sc.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. SHORTCUTS FAQS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <SectionHeading
          badgeText="FAQ"
          badgeVariant="purple"
          title="Frequently Asked Questions About Shortcuts"
          subtitle="Learn how global shortcuts interact with video conferencing apps and IDEs."
        />

        <Accordion items={SHORTCUTS_FAQS} />
      </section>

      {/* 4. CTA SECTION */}
      <CtaSection
        title="Ready to Practice with Speed?"
        subtitle="Download Meoow for Windows and start navigating interviews effortlessly."
      />
    </div>
  );
};
