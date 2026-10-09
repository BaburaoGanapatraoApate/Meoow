import React, { useEffect, useRef } from 'react';
import type { McqAssistantConfig } from './McqAssistantSetup';

export interface McqCapture {
  id: string;
  blob: Blob;
  url: string;
  hash: string;
  createdAt: number;
}

interface Props {
  config: McqAssistantConfig;
  status: 'ready' | 'processing' | 'answer-ready' | 'error';
  answer: string;
  multiCaptureActive: boolean;
  captures: McqCapture[];
  onStartMultiCapture: () => void;
  onAddCapture: () => void;
  onFinish: () => void;
  onRemoveLast: () => void;
  onCancelCapture: () => void;
}

export function McqAssistantPanel({
  config, status, answer, multiCaptureActive, captures,
  onStartMultiCapture, onAddCapture, onFinish, onRemoveLast, onCancelCapture,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
      listRef.current.scrollLeft = 0;
    }
  }, [captures.length]);

  const label = status === 'processing' ? 'Processing...'
    : status === 'answer-ready' ? 'Answer Ready'
      : status === 'error' ? 'Needs attention'
        : multiCaptureActive ? `Collecting current question - ${captures.length} captures`
          : 'Ready - press Ctrl + Shift + A';

  return (
    <section className="mcq-assistant-panel" data-window-interactive="true">
      <div className="mcq-assistant-panel-header">
        <div>
          <span className="mcq-assistant-active-badge">MCQ ASSISTANT ACTIVE</span>
          <h2>{config.category}{config.subject ? ` - ${config.subject}` : ''}</h2>
        </div>
        <span className={`mcq-assistant-status ${status}`}>{label}</span>
      </div>

      <div className="mcq-capture-actions">
        {!multiCaptureActive ? (
          <button type="button" onClick={onStartMultiCapture} disabled={status === 'processing'}>Start Multi-Capture</button>
        ) : (
          <>
            <button type="button" onClick={onAddCapture} disabled={status === 'processing'}>Add Capture</button>
            <button type="button" className="primary" onClick={onFinish} disabled={status === 'processing' || captures.length === 0}>Finish &amp; Analyze</button>
            <button type="button" onClick={onRemoveLast} disabled={status === 'processing' || captures.length === 0}>Remove Last Capture</button>
            <button type="button" onClick={onCancelCapture} disabled={status === 'processing'}>Cancel Capture</button>
          </>
        )}
      </div>

      {multiCaptureActive && (
        <div className="mcq-capture-strip" ref={listRef} aria-label="Collected screenshots, newest first">
          {[...captures].reverse().map((capture, displayIndex) => (
            <div className="mcq-capture-thumbnail" key={capture.id}>
              <img src={capture.url} alt={`Capture ${captures.length - displayIndex}`} />
              <span>Capture {captures.length - displayIndex}</span>
            </div>
          ))}
          {captures.length === 0 && <span className="mcq-capture-empty">Use Ctrl + Shift + A to add the first capture.</span>}
        </div>
      )}

      <div className="mcq-assistant-answer" aria-live="polite">
        {status === 'processing' ? <span className="mcq-assistant-loader" /> : null}
        <span>{answer || (multiCaptureActive
          ? 'Scroll the source page yourself and capture each part in order. Finish with Ctrl + Shift + Enter.'
          : 'Capture a visible MCQ to receive only its selected option.')}</span>
      </div>
    </section>
  );
}
