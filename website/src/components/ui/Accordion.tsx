import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface AccordionItemProps {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  question,
  answer,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-200/80 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left group focus:outline-none"
        aria-expanded={isOpen}
      >
        <span className="text-base sm:text-lg font-semibold text-brand-navy-900 group-hover:text-brand-purple-600 transition-colors pr-4">
          {question}
        </span>
        <span
          className={`flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 group-hover:bg-brand-purple-50 flex items-center justify-center text-slate-500 group-hover:text-brand-purple-600 transition-all duration-200 ${
            isOpen ? 'rotate-180 bg-brand-purple-100 text-brand-purple-700' : ''
          }`}
        >
          <ChevronDown className="w-4 h-4" />
        </span>
      </button>
      {isOpen && (
        <div className="pb-5 pr-8 text-slate-600 text-sm sm:text-base leading-relaxed animate-fadeIn">
          {answer}
        </div>
      )}
    </div>
  );
};

export interface AccordionProps {
  items: { question: string; answer: string }[];
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({ items, className = '' }) => {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm ${className}`}>
      {items.map((item, idx) => (
        <AccordionItem
          key={idx}
          question={item.question}
          answer={item.answer}
          defaultOpen={idx === 0}
        />
      ))}
    </div>
  );
};
