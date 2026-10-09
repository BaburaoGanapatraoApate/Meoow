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
  incompleteNotification?: string;
  multiCaptureActive: boolean;
  captures: McqCapture[];
  onStartMultiCapture: () => void;
  onAddCapture: () => void;
  onFinish: () => void;
  onRemoveLast: () => void;
  onCancelCapture: () => void;
}

export function McqAssistantPanel({
  config, status, answer, incompleteNotification, multiCaptureActive, captures,
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
        : multiCaptureActive ? `Collecting question - ${captures.length} capture${captures.length === 1 ? '' : 's'}`
          : 'Ready - Ctrl + Shift + A (single) / Ctrl + Shift + M (multi)';

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
          <button
            type="button"
            onClick={onStartMultiCapture}
            disabled={status === 'processing'}
            title="Start multi-capture collection (Ctrl + Shift + M)"
          >
            Start Multi-Capture (Ctrl+Shift+M)
          </button>
        ) : (
          <>
            <button type="button" onClick={onAddCapture} disabled={status === 'processing'} title="Add capture (Ctrl + Shift + A)">
              Add Capture
            </button>
            <button type="button" className="primary" onClick={onFinish} disabled={status === 'processing' || captures.length === 0} title="Finish and analyze collection (Ctrl + Shift + Enter)">
              Finish &amp; Analyze
            </button>
            <button type="button" onClick={onRemoveLast} disabled={status === 'processing' || captures.length === 0}>
              Remove Last Capture
            </button>
            <button type="button" onClick={onCancelCapture} disabled={status === 'processing'}>
              Cancel Capture
            </button>
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
          {captures.length === 0 && <span className="mcq-capture-empty">Use Ctrl + Shift + A to add captures.</span>}
        </div>
      )}

      {incompleteNotification && (
        <div className="mcq-incomplete-notification" role="status">
          <span className="mcq-incomplete-badge">NOTICE</span>
          <span>{incompleteNotification}</span>
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
