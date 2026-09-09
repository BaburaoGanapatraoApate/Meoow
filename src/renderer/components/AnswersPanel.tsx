import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import { Answer } from '../types';

interface AnswersPanelProps {
  isSessionStarted: boolean;
  answers: Answer[];
  answerScreenshots: Record<string, string>;
  currentStreamingAnswer: string;
  currentStreamingScreenshot: string | null;
  autoAnswer: boolean;
  canGenerateAnswer: boolean;
  onAutoAnswerChange: (val: boolean) => void;
  onGenerateAnswer: () => void;
  onSubmitQuestion: (q: string) => void;
}

export const AnswersPanel: React.FC<AnswersPanelProps> = ({
  isSessionStarted,
  answers,
  answerScreenshots,
  currentStreamingAnswer,
  currentStreamingScreenshot,
  autoAnswer,
  canGenerateAnswer,
  onAutoAnswerChange,
  onGenerateAnswer,
  onSubmitQuestion,
}) => {
  const [manualInput, setManualInput] = useState('');

  if (!isSessionStarted && answers.length === 0 && !currentStreamingAnswer) {
    return <React.Fragment />;
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      onSubmitQuestion(manualInput.trim());
      setManualInput('');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleManualSubmit(e);
    }
  };

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current && (currentStreamingAnswer || answers.length > 0)) {
      containerRef.current.scrollTop = 0;
    }
  }, [answers.length, !!currentStreamingAnswer]);

  const processText = (text: string) =>
    (text || '')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  return (
    <div className="copilot-response" data-window-interactive="true">
      <div className="copilot-response-header">
        <h3 className="copilot-heading">AI Copilot</h3>
        <div className="copilot-actions">
          {!autoAnswer && (
            <button
              type="button"
              className="start-button"
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.78rem' }}
              onClick={onGenerateAnswer}
              disabled={!canGenerateAnswer}
            >
              Generate Answer
            </button>
          )}
        </div>
      </div>

      <div className="copilot-container" ref={containerRef}>
        {currentStreamingAnswer && (
          <div className="answer-streaming" style={{ marginBottom: '0.75rem' }}>
            <div className="answer-streaming-header">
              <span className="pulse-dot"></span> Generating Answer...
            </div>
            <div className="answer-streaming-body">
              {currentStreamingScreenshot && (
                <div className="answer-screenshot">
                  <img src={currentStreamingScreenshot} alt="Context" />
                </div>
              )}
              <div className="answer-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock as any }}>
                  {processText(currentStreamingAnswer)}
                </ReactMarkdown>
              </div>
              <span className="streaming-caret"></span>
            </div>
          </div>
        )}

        {answers.length === 0 && !currentStreamingAnswer ? (
          <p className="copilot-message">
            Listening to interviewer questions. Live AI answers will appear here automatically.
          </p>
        ) : (
          <div className="answers-list">
            {answers.map((ans, idx) => (
              <div key={ans.requestId || ans.timestamp || idx} className="answer-item">
                <div className="answer-item-label">
                  {ans.source === 'screen' || ans.source === 'screen_capture' ? 'Screen Analysis' : ans.source === 'manual' ? 'Manual Question' : 'Interview Answer'}
                  {ans.timestamp && ` • ${new Date(ans.timestamp).toLocaleTimeString()}`}
                </div>
                {ans.timestamp && answerScreenshots[ans.timestamp] && (
                  <div className="answer-screenshot">
                    <img src={answerScreenshots[ans.timestamp]} alt="Context" />
                  </div>
                )}
                <div className="answer-item-text answer-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock as any }}>
                    {processText(ans.answer)}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="manual-input" data-window-interactive="true">
        <form className="manual-input-form" onSubmit={handleManualSubmit} data-window-interactive="true">
          <input
            type="text"
            className="manual-input-field"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a manual question or prompt and press Enter..."
            data-window-interactive="true"
            onClick={e => e.stopPropagation()}
          />
          <button
            type="submit"
            className="manual-input-button"
            disabled={!manualInput.trim()}
            data-window-interactive="true"
            onClick={e => e.stopPropagation()}
          >
            Ask AI
          </button>
        </form>
      </div>
    </div>
  );
};
