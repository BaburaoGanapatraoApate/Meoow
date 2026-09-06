import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TranscriptEntry } from '../types';

interface TranscriptPanelProps {
  isSessionStarted: boolean;
  transcript: TranscriptEntry[];
  onManualQuestion?: (q: string) => void;
}

interface TranscriptGroup {
  id: string | number;
  speaker: string;
  isFinal: boolean;
  texts: string[];
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ isSessionStarted, transcript, onManualQuestion }) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const grouped: TranscriptGroup[] = [];
    let currentGroup: TranscriptGroup | null = null;
    let lastTime = 0;

    transcript.forEach(entry => {
      const entryTime = entry.createdAt || Date.parse(entry.timestamp) || 0;
      const timeDiff = entryTime - lastTime;
      const spk = (entry.speaker || 'interviewer').toLowerCase();
      const text = (entry.text || entry.message || '').trim();
      if (!text) return;

      // Group consecutive final messages from same speaker within 5 seconds
      // Interim speech is kept cleanly separated for immediate live word streaming
      if (currentGroup && currentGroup.speaker === spk && timeDiff < 5000 && currentGroup.isFinal && entry.is_final) {
        currentGroup.texts.push(text);
      } else {
        currentGroup = {
          id: entry.id || `${spk}-${entryTime}`,
          speaker: spk,
          isFinal: !!entry.is_final,
          texts: [text]
        };
        grouped.push(currentGroup);
      }
      lastTime = entryTime;
    });
    return grouped;
  }, [transcript]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [groups, autoScroll]);

  if (!isSessionStarted && transcript.length === 0) {
    return <React.Fragment />;
  }

  return (
    <div className="transcript-panel" data-window-interactive="true">
      <div className="transcript-header">
        <h3 className="transcript-heading">Transcript</h3>
        <label className="auto-scroll-toggle">
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
          <p className="auto-scroll-label">
            <span>Auto Scroll</span>
          </p>
        </label>
      </div>
      <div className="transcript-container" ref={containerRef}>
        {groups.length === 0 ? (
          <p className="transcript-message">Live conversation will transcribe here in real-time...</p>
        ) : (
          groups.map((group, idx) => {
            const isUser = group.speaker === 'user';
            const fullText = group.texts.join(' ').trim();
            if (!fullText) return null;

            return (
              <div
                key={group.id || idx}
                className={`transcript-message-group ${isUser ? 'user-message' : 'interviewer-message'} ${group.isFinal ? 'final' : 'interim'}`}
              >
                <div className={`message-avatar ${isUser ? 'user' : 'interviewer'}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="message-content-wrapper">
                  <div className="message-header">
                    <div className="message-speaker">{isUser ? 'You' : 'Interviewer'}</div>
                    {!isUser && onManualQuestion && group.isFinal && (
                      <button
                        type="button"
                        className="answer-button"
                        onClick={() => onManualQuestion(fullText)}
                        title="Generate AI answer for this question"
                      >
                        Answer
                      </button>
                    )}
                  </div>
                  <div className="message-bubble">
                    {fullText}
                    {!group.isFinal && (
                      <span
                        className="streaming-caret"
                        style={{
                          display: 'inline-block',
                          marginLeft: '4px',
                          width: '3px',
                          height: '11px',
                          backgroundColor: 'currentColor',
                          verticalAlign: 'baseline',
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
