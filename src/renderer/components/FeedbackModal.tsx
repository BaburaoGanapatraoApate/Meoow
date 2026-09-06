import React, { useState } from 'react';

interface FeedbackModalProps {
  sessionId: string;
  onSubmit: (rating: number, message: string) => void;
  onDismiss: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ sessionId, onSubmit, onDismiss }) => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Simulate saving feedback
      onSubmit(rating, comment);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="session-feedback-modal">
        <div className="session-feedback-success">
          <svg viewBox="0 0 24 24" className="success-icon" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h3>Thank you for your feedback!</h3>
          <button onClick={onDismiss}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-feedback-panel" data-window-interactive="true">
      <div className="session-feedback-header">
        <h3>Rate this session</h3>
      </div>
      <div className="session-feedback-body">
        <div className="session-feedback-stars">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              className={`star-button ${star <= (hoveredStar || rating) ? 'active' : ''}`}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRating(star)}
            >
              <svg viewBox="0 0 24 24" fill={star <= (hoveredStar || rating) ? 'currentColor' : 'none'} stroke="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>
        <textarea
          className="session-feedback-textarea"
          placeholder="Leave a comment (optional)..."
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
        {error && <div className="session-feedback-error">{error}</div>}
      </div>
      <div className="session-feedback-footer">
        <button className="skip-button" onClick={onDismiss} disabled={isSubmitting}>Skip</button>
        <button className="submit-button" onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
};
