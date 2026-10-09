import React, { useState } from 'react';
import { LANGUAGES } from '../utils/languages';

export interface McqAssistantConfig {
  category: string;
  subject: string;
  difficulty: 'any' | 'easy' | 'medium' | 'hard';
  language: string;
  instructions: string;
}

interface Props {
  initialLanguage: string;
  onStart: (config: McqAssistantConfig) => void;
  onCancel: () => void;
}

export function McqAssistantSetup({ initialLanguage, onStart, onCancel }: Props) {
  const [config, setConfig] = useState<McqAssistantConfig>({
    category: '',
    subject: '',
    difficulty: 'any',
    language: initialLanguage,
    instructions: '',
  });
  const [categoryError, setCategoryError] = useState('');

  const update = <K extends keyof McqAssistantConfig>(key: K, value: McqAssistantConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    if (key === 'category' && String(value).trim()) setCategoryError('');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const category = config.category.trim();
    if (!category) {
      setCategoryError('Test type / category is required');
      return;
    }
    onStart({
      ...config,
      category,
      subject: config.subject.trim(),
      instructions: config.instructions.trim(),
    });
  };

  return (
    <section className="session-setup-panel mcq-assistant-setup" data-window-interactive="true">
      <div className="session-setup-header">
        <div>
          <h2 className="session-setup-title">MCQ Assistant (Admin)</h2>
          <p className="session-setup-subtitle">Configure a private, screenshot-only test session</p>
        </div>
        <button type="button" onClick={onCancel} className="session-setup-close-btn" aria-label="Close MCQ Assistant setup">×</button>
      </div>

      <form className="session-setup-form" onSubmit={submit}>
        <div className="session-setup-grid">
          <label className="session-setup-field">
            <span>Test Type / Category *</span>
            <input
              autoFocus
              type="text"
              value={config.category}
              onChange={e => update('category', e.target.value)}
              placeholder="e.g., Aptitude, Technical, Machine Learning"
              maxLength={200}
            />
            {categoryError && <small className="session-setup-error">{categoryError}</small>}
          </label>

          <label className="session-setup-field">
            <span>Subject / Domain</span>
            <input
              type="text"
              value={config.subject}
              onChange={e => update('subject', e.target.value)}
              placeholder="e.g., Probability, DBMS, DSA"
              maxLength={200}
            />
          </label>

          <label className="session-setup-field">
            <span>Difficulty</span>
            <select value={config.difficulty} onChange={e => update('difficulty', e.target.value as McqAssistantConfig['difficulty'])}>
              <option value="any">Any</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label className="session-setup-field">
            <span>Language</span>
            <select value={config.language} onChange={e => update('language', e.target.value)}>
              {LANGUAGES.map(language => (
                <option key={language.code} value={language.code}>{language.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="session-setup-field">
          <span>Session Notes / Instructions</span>
          <textarea
            value={config.instructions}
            onChange={e => update('instructions', e.target.value)}
            placeholder="Optional subject context or answer-format guidance"
            maxLength={2000}
          />
          <small className="session-setup-muted">{config.instructions.length}/2000</small>
        </label>

        <div className="session-setup-actions">
          <button type="button" className="session-setup-secondary-button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="session-setup-primary-button">Start Test</button>
        </div>
      </form>
    </section>
  );
}
