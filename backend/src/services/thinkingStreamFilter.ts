/**
 * ThinkingStreamFilter
 *
 * Model-agnostic streaming filter that removes <think>...</think> reasoning blocks
 * across arbitrary SSE stream chunks.
 *
 * Layer 2 defense-in-depth:
 * Even when provider-level reasoning_format="hidden" is configured (Layer 1),
 * this filter guarantees that any leaked or raw thinking tokens are intercepted
 * and eliminated before reaching the renderer.
 *
 * EOF Correctness Invariants:
 * - If the filter is definitively inside an open <think>...</think> block at stream termination,
 *   discard all hidden reasoning and any incomplete closing-tag buffer.
 * - If the filter is NOT inside a think block, any buffered characters that were only being held
 *   as a possible partial <think> or </think> prefix MUST be emitted as visible text on flush().
 * - Legitimate visible text is NEVER lost merely because a stream ended immediately after
 *   characters resembling a partial tag prefix (e.g. "<thi", "<thin", ordinary text ending with "<").
 * - Preserves low-latency streaming during normal text generation.
 * - Preserves comparison operators (e.g. `x < 10 && y > 5`).
 */

export class ThinkingStreamFilter {
  private inThinkBlock: boolean = false;
  private buffer: string = "";
  private readonly startTag = "<think>";
  private readonly endTag = "</think>";

  /**
   * Ingest a streaming delta chunk and return any confirmed user-visible text.
   */
  public processChunk(delta: string): string {
    if (!delta) return "";
    this.buffer += delta;
    let output = "";

    while (this.buffer.length > 0) {
      if (!this.inThinkBlock) {
        // Outside reasoning block
        const startIdx = this.buffer.indexOf(this.startTag);
        const orphanEndIdx = this.buffer.indexOf(this.endTag);

        // If an orphaned </think> appears before any <think>, strip the orphan tag
        if (orphanEndIdx !== -1 && (startIdx === -1 || orphanEndIdx < startIdx)) {
          if (orphanEndIdx > 0) {
            output += this.buffer.slice(0, orphanEndIdx);
          }
          this.buffer = this.buffer.slice(orphanEndIdx + this.endTag.length).replace(/^\s+/, "");
          continue;
        }

        if (startIdx !== -1) {
          // Found full start tag
          if (startIdx > 0) {
            output += this.buffer.slice(0, startIdx);
          }
          this.inThinkBlock = true;
          this.buffer = this.buffer.slice(startIdx + this.startTag.length);
        } else {
          // Check if buffer ends with a prefix of "<think>" or "</think>"
          let matchedPrefixLen = 0;
          const maxCheckStart = Math.min(this.buffer.length, this.startTag.length - 1);
          for (let len = maxCheckStart; len > 0; len--) {
            if (this.startTag.startsWith(this.buffer.slice(-len))) {
              matchedPrefixLen = Math.max(matchedPrefixLen, len);
              break;
            }
          }

          const maxCheckEnd = Math.min(this.buffer.length, this.endTag.length - 1);
          for (let len = maxCheckEnd; len > 0; len--) {
            if (this.endTag.startsWith(this.buffer.slice(-len))) {
              matchedPrefixLen = Math.max(matchedPrefixLen, len);
              break;
            }
          }

          if (matchedPrefixLen > 0) {
            const safe = this.buffer.slice(0, -matchedPrefixLen);
            if (safe) {
              output += safe;
            }
            this.buffer = this.buffer.slice(-matchedPrefixLen);
            break; // Await more data to see if it forms "<think>" or "</think>"
          } else {
            output += this.buffer;
            this.buffer = "";
          }
        }
      } else {
        // Inside reasoning block
        const endIdx = this.buffer.indexOf(this.endTag);
        if (endIdx !== -1) {
          // Found full end tag
          this.inThinkBlock = false;
          // Discard reasoning up to </think>, and strip leading whitespace after it
          this.buffer = this.buffer.slice(endIdx + this.endTag.length).replace(/^\s+/, "");
        } else {
          // Check if buffer ends with a prefix of "</think>"
          let matchedPrefixLen = 0;
          const maxCheckLen = Math.min(this.buffer.length, this.endTag.length - 1);
          for (let len = maxCheckLen; len > 0; len--) {
            if (this.endTag.startsWith(this.buffer.slice(-len))) {
              matchedPrefixLen = len;
              break;
            }
          }

          if (matchedPrefixLen > 0) {
            // Keep only the potential end tag prefix in buffer, discard the preceding reasoning
            this.buffer = this.buffer.slice(-matchedPrefixLen);
          } else {
            // No partial end tag, entire buffer is reasoning -> discard
            this.buffer = "";
          }
          break; // Await more data to see if it forms "</think>"
        }
      }
    }

    return output;
  }

  /**
   * Flush any remaining buffered characters when the stream finishes.
   *
   * EOF correctness:
   * - If the filter is NOT inside an open think block (inThinkBlock === false),
   *   any buffered characters that were being held as a possible partial <think>
   *   or </think> tag prefix MUST be emitted as visible text.
   * - If the filter is definitively inside an open think block (inThinkBlock === true),
   *   all hidden reasoning and any incomplete closing-tag buffer are completely discarded.
   */
  public flush(): string {
    let remaining = "";
    if (!this.inThinkBlock && this.buffer.length > 0) {
      remaining = this.buffer;
    }
    this.buffer = "";
    return remaining;
  }

  public isInThinkBlock(): boolean {
    return this.inThinkBlock;
  }

  public reset(): void {
    this.inThinkBlock = false;
    this.buffer = "";
  }
}
