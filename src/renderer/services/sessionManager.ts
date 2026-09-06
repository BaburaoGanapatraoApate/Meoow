import { v4 as uuidv4 } from 'uuid';
import type { SessionData, SessionFormData, TranscriptEntry, Answer } from '../types';

const SESSION_DATA_KEY = 'meowSessionData';
const ANSWERS_KEY = 'meowAnswers';
const TRANSCRIPT_KEY = 'meowTranscript';

/**
 * Local session manager — replaces the Cohost REST API session lifecycle.
 * All data is stored locally in sessionStorage / localStorage.
 */

export function createSession(formData: SessionFormData): SessionData {
  const session: SessionData = {
    id: uuidv4(),
    job_title: formData.job_title,
    company: formData.company,
    interview_type: formData.interview_type,
    interview_round: formData.interview_round,
    streaming_model: formData.streaming_model,
    experience_level: formData.experience_level,
    resume_file_path: formData.resume_file_path,
    notes: formData.notes,
    started_at: new Date().toISOString(),
    resolved_model: formData.streaming_model,
  };

  sessionStorage.setItem(SESSION_DATA_KEY, JSON.stringify(session));
  sessionStorage.removeItem(ANSWERS_KEY);
  sessionStorage.removeItem(TRANSCRIPT_KEY);

  return session;
}

export function getStoredSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAnswers(answers: Answer[]): void {
  try {
    sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
  } catch {
    // Storage full
  }
}

export function getStoredAnswers(): Answer[] {
  try {
    const raw = sessionStorage.getItem(ANSWERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTranscriptToSession(sessionId: string, transcript: TranscriptEntry[]): void {
  try {
    sessionStorage.setItem(
      TRANSCRIPT_KEY,
      JSON.stringify({ sessionId, transcript })
    );
  } catch {
    // Storage full
  }
}

export function getStoredTranscript(sessionId: string): TranscriptEntry[] | null {
  try {
    const raw = sessionStorage.getItem(TRANSCRIPT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (String(parsed.sessionId) !== String(sessionId) || !Array.isArray(parsed.transcript)) {
      return null;
    }
    return parsed.transcript;
  } catch {
    return null;
  }
}

export function clearSessionData(): void {
  sessionStorage.removeItem(SESSION_DATA_KEY);
  sessionStorage.removeItem(ANSWERS_KEY);
  sessionStorage.removeItem(TRANSCRIPT_KEY);
}

/**
 * Archive a completed session to localStorage for persistence across reloads.
 */
export function archiveSession(
  session: SessionData,
  transcript: TranscriptEntry[],
  answers: Answer[]
): void {
  try {
    const key = `meow-session-archive-${session.id}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        session,
        transcript,
        answers,
        ended_at: new Date().toISOString(),
      })
    );
  } catch {
    // Storage full
  }
}

/**
 * Store feedback locally.
 */
export function saveFeedback(
  sessionId: string,
  rating: number,
  message: string
): void {
  try {
    const feedbackList = JSON.parse(localStorage.getItem('meow-feedback') || '[]');
    feedbackList.push({
      sessionId,
      rating,
      message,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('meow-feedback', JSON.stringify(feedbackList));
  } catch {
    // Storage full
  }
}

