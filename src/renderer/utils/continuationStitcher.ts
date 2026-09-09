/**
 * Continuation stitching utility for assembling truncated answers cleanly.
 * Handles:
 * - Mid-sentence word boundary concatenation
 * - Overlapping word/phrase deduplication
 * - Markdown code block continuation with redundant opening fence removal
 * - Auto-closing trailing unclosed code fences
 */
export function stitchAnswerContinuation(previousText: string, continuationText: string): string {
  if (!previousText) return continuationText || '';
  if (!continuationText) return previousText || '';

  let prev = previousText;
  let cont = continuationText;

  // 1. Check if continuation repeats an opening code fence when previous has an open fence
  const prevFenceCount = (prev.match(/```/g) || []).length;
  const isPrevFenceOpen = prevFenceCount % 2 === 1;

  if (isPrevFenceOpen) {
    const fenceMatch = cont.match(/^\s*```[a-zA-Z0-9_-]*\r?\n/);
    if (fenceMatch) {
      cont = cont.slice(fenceMatch[0].length);
    }
  }

  // 2. Check for overlapping phrase between tail of prev and head of cont (up to 200 chars)
  const maxOverlap = Math.min(200, prev.length, cont.length);
  let overlapLength = 0;

  for (let len = maxOverlap; len >= 4; len--) {
    const prevTail = prev.slice(-len);
    const contHead = cont.slice(0, len);
    if (prevTail.toLowerCase() === contHead.toLowerCase()) {
      overlapLength = len;
      break;
    }
  }

  let stitched = '';
  if (overlapLength > 0) {
    stitched = prev + cont.slice(overlapLength);
  } else {
    const prevEndsWithWord = /\w$/.test(prev);
    const contStartsWithWord = /^\w/.test(cont);
    if (prevEndsWithWord && contStartsWithWord) {
      stitched = prev + ' ' + cont;
    } else {
      stitched = prev + cont;
    }
  }

  // 3. Markdown safety: ensure balanced code fences
  const totalFences = (stitched.match(/```/g) || []).length;
  if (totalFences % 2 === 1) {
    stitched += '\n```\n';
  }

  return stitched;
}

