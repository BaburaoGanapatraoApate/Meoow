import React from 'react';
import { Star } from 'lucide-react';
import { TestimonialItem, TESTIMONIALS_ROW_1, TESTIMONIALS_ROW_2 } from '../../data/testimonials';

interface TestimonialCardProps {
  item: TestimonialItem;
}

const TestimonialCard: React.FC<TestimonialCardProps> = ({ item }) => {
  return (
    <div
      className={`w-[340px] sm:w-[380px] flex-shrink-0 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between select-none ${item.accentColor}`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            {[...Array(item.rating)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {item.tag}
          </span>
        </div>
        <p className="text-slate-700 text-sm sm:text-base leading-relaxed italic">
          "{item.quote}"
        </p>
      </div>
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-purple-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-inner">
          {item.avatarText}
        </div>
        <div>
          <div className="font-semibold text-brand-navy-900 text-sm">
            {item.name}
          </div>
          <div className="text-xs text-slate-500">{item.role}</div>
        </div>
      </div>
    </div>
  );
};

export const TestimonialRail: React.FC = () => {
  // Duplicate arrays for continuous infinite marquee looping
  const row1Items = [...TESTIMONIALS_ROW_1, ...TESTIMONIALS_ROW_1, ...TESTIMONIALS_ROW_1];
  const row2Items = [...TESTIMONIALS_ROW_2, ...TESTIMONIALS_ROW_2, ...TESTIMONIALS_ROW_2];

  return (
    <div className="overflow-hidden space-y-6 py-4 relative marquee-wrapper">
      {/* Subtle edge fade masks */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-brand-surface-subtle to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-brand-surface-subtle to-transparent z-10" />

      {/* Row 1: Left moving */}
      <div className="flex gap-5 w-max animate-marquee-left marquee-track">
        {row1Items.map((item, idx) => (
          <TestimonialCard key={`r1-${item.id}-${idx}`} item={item} />
        ))}
      </div>

      {/* Row 2: Right moving */}
      <div className="flex gap-5 w-max animate-marquee-right marquee-track">
        {row2Items.map((item, idx) => (
          <TestimonialCard key={`r2-${item.id}-${idx}`} item={item} />
        ))}
      </div>
    </div>
  );
};
