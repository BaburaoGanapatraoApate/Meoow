import type { TranscriptEntry } from '../types';

/**
 * Cross-talk deduplication and transcript processing.
 * Exact port of original bundle lines 8765-8807 and 8851-8905.
 */

const CROSS_TALK_WINDOW_MS = 5_000;

/** Unicode-aware word tokenization */
export function tokenize(text: string): string[] {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Longest Common Subsequence length between two token arrays */
export function lcsLength(a: string[], b: string[]): number {
  const row = Array(b.length + 1).fill(0);
  for (const tokenA of a) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = tokenA === b[j - 1] ? prev + 1 : Math.max(row[j], row[j - 1]);
      prev = temp;
    }
  }
  return row[b.length];
}

/** Check if two texts are cross-talk duplicates: LCS >= 80% AND length ratio >= 45% */
export function isCrossTalkDuplicate(textA: string, textB: string): boolean {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  if (tokensA.join(' ') === tokensB.join(' ')) return true;

  const shorter = Math.min(tokensA.length, tokensB.length);
  const longer = Math.max(tokensA.length, tokensB.length);
  if (shorter < 3) return false;

  return lcsLength(tokensA, tokensB) / shorter >= 0.8 && shorter / longer >= 0.45;
}

function getCreatedAt(entry: TranscriptEntry): number {
  if (typeof entry.createdAt === 'number') return entry.createdAt;
  const t = Date.parse(entry.timestamp);
  return Number.isFinite(t) ? t : 0;
}

/** Find duplicate entries from the other speaker within the time window */
export function findDuplicates(
  transcript: TranscriptEntry[],
  speaker: string,
  text: string,
  now: number = Date.now()
): number[] {
  const indices: number[] = [];
  for (let i = transcript.length - 1; i >= 0; --i) {
    const entry = transcript[i];
    if (now - getCreatedAt(entry) > CROSS_TALK_WINDOW_MS) break;
    if (entry.speaker !== speaker && isCrossTalkDuplicate(text, entry.text || entry.message || '')) {
      indices.push(i);
    }
  }
  return indices;
}

/** Check if text is only filler words */
export function isFillerOnlyTranscript(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalized) return true;
  return /^(okay|ok|cool|good|right|mhmm|uh huh|yep|yeah|yes|no|alright|all right|interesting|great|fine|sure|got it|i see|understand|understood|thanks|thank you)(\s+(okay|ok|cool|good|right|mhmm|uh huh|yep|yeah|yes|no|alright|all right|interesting|great|fine|sure|got it|i see|understand|understood|thanks|thank you))*$/.test(
    normalized
  );
}

/** Normalize text to create a question signature for dedup */
export function buildQuestionSignature(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Build transcript context from recent question entries (last 4 within 6s) */
export function buildTranscriptContext(
  entries: Array<{ text: string; createdAt: number }>
): string {
  const last = entries[entries.length - 1];
  if (!last) return '';

  const context = [last];
  for (let i = entries.length - 2; i >= 0 && context.length < 4; i--) {
    const prev = context[context.length - 1];
    const entry = entries[i];
    if (prev.createdAt - entry.createdAt > 6_000) break;
    context.push(entry);
  }

  return [...context].reverse().map((e) => e.text).join('\n');
}

/** Save transcript to sessionStorage */
export function saveTranscript(sessionId: string, transcript: TranscriptEntry[]): void {
  try {
    sessionStorage.setItem(
      'meowTranscript',
      JSON.stringify({ sessionId, transcript })
    );
  } catch {
    // Storage full or unavailable
  }
}

/** Load transcript from sessionStorage */
export function loadTranscript(sessionId: string): TranscriptEntry[] | null {
  try {
    const raw = sessionStorage.getItem('meowTranscript');
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

/**
 * Detect whether an interviewer's speech segment is grammatically or semantically incomplete.
 * Identifies trailing conjunctions, prepositions, auxiliary verbs, determiners, or open punctuation.
 */
const INCOMPLETE_TRAILING_WORDS = new Set([
  // Conjunctions & relative pronouns
  'and', 'or', 'but', 'nor', 'so', 'yet', 'if', 'when', 'where', 'while', 'because', 'although',
  'though', 'that', 'which', 'who', 'whom', 'whose', 'whether', 'as', 'since', 'unless',
  // Prepositions
  'to', 'for', 'with', 'in', 'on', 'at', 'of', 'from', 'by', 'about', 'into', 'through',
  'between', 'under', 'over', 'after', 'before', 'without', 'within', 'during', 'against',
  'towards', 'upon', 'like', 'than',
  // Auxiliary & linking verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'would', 'could', 'should', 'will', 'can', 'may', 'might', 'must', 'shall',
  // Determiners
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'our', 'their', 'its'
]);

export function isSemanticallyIncomplete(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  // Trailing open punctuation (e.g., comma, hyphen, colon, semicolon, ellipsis)
  if (/[,:\-;–—\.\.]$/.test(trimmed) && !/[.?!]$/.test(trimmed)) {
    return true;
  }

  // Tokenize words
  const words = trimmed.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/);
  if (words.length === 0) return true;

  const lastWord = words[words.length - 1];
  if (INCOMPLETE_TRAILING_WORDS.has(lastWord)) {
    return true;
  }

  // Short incomplete question starters without predicate (1-3 words like "can you", "what is", "how do", "could you")
  if (words.length <= 3 && /^(can|could|would|will|how|what|why|where|when|who|is|are|do|does|did)\s+(you|we|i|it|the|a|this)$/.test(words.join(' '))) {
    return true;
  }

  return false;
}

/**
 * Checks if newText appears to be an immediate continuation of previousText
 * (e.g. speech recognition fragmented a sentence across two events).
 */
export function isContinuationOfPrevious(previousText: string, newText: string): boolean {
  const prevTrimmed = previousText.trim();
  const newTrimmed = newText.trim();
  if (!prevTrimmed || !newTrimmed) return false;

  // If previous was explicitly incomplete
  if (isSemanticallyIncomplete(prevTrimmed)) return true;

  // If newText starts with a lowercase letter (common in continuous STT streams)
  if (/^[a-z]/.test(newTrimmed)) return true;

  // If newText starts with a conjunction or continuation word
  const firstWord = newTrimmed.toLowerCase().split(/\s+/)[0];
  if (['and', 'or', 'but', 'so', 'because', 'with', 'using', 'like', 'for', 'to', 'in', 'also'].includes(firstWord)) {
    return true;
  }

  // If previous text lacked terminal punctuation (.?!) and new text doesn't look like a completely new question
  if (!/[.?!]$/.test(prevTrimmed)) {
    return true;
  }

  return false;
}

