/**
 * Quality Gate & Anti-Fabrication Verification Service
 *
 * Enforces interview truth rules:
 * 1. Distinguishes general technical knowledge from candidate-specific facts.
 * 2. Prohibits unsupported first-person claims (incidents, projects, employers, leadership)
 *    when candidate background is absent.
 * 3. Prohibits unanchored metrics (percentages, latency cuts, cost savings) not grounded in resume/notes.
 * 4. Ensures system design scale numbers are framed as interview assumptions.
 */

export interface QualityCheckOptions {
  taskType?: string;
  parentTaskType?: string;
  hasCandidateExperience?: boolean;
  hasCompanyContext?: boolean;
  candidateContext?: {
    resumeText?: string;
    notes?: string;
    skills?: string[];
    company?: string;
    stableFacts?: string[];
    allowedMetrics?: (number | string)[];
  };
}

export interface QualityCheckViolation {
  code: string;
  message: string;
  matchedText?: string;
  severity: "error" | "warning";
}

export interface QualityCheckResult {
  passed: boolean;
  violations: QualityCheckViolation[];
  containsUnanchoredMetrics: boolean;
  containsFabricatedIncident: boolean;
  containsFabricatedCompany: boolean;
  containsFramedAssumptionsOnly: boolean;
}

/**
 * Verify whether an answer satisfies interview truth and quality constraints.
 */
export function verifyAnswerQuality(
  answer: string,
  options: QualityCheckOptions = {}
): QualityCheckResult {
  const violations: QualityCheckViolation[] = [];
  let containsUnanchoredMetrics = false;
  let containsFabricatedIncident = false;
  let containsFabricatedCompany = false;
  let containsFramedAssumptionsOnly = true;

  if (!answer || answer.trim().length === 0) {
    return {
      passed: true,
      violations: [],
      containsUnanchoredMetrics: false,
      containsFabricatedIncident: false,
      containsFabricatedCompany: false,
      containsFramedAssumptionsOnly: true,
    };
  }

  // Strip bracketed placeholders e.g. [Replace this with your specific incident...]
  // Placeholders represent user-scaffolding templates, not fabricated factual assertions.
  const textWithoutBrackets = answer.replace(/\[[^\]]*\]/g, " ");

  const effectiveTaskType =
    options.taskType === "FOLLOW_UP" && options.parentTaskType
      ? options.parentTaskType
      : options.taskType || "GENERAL_TECHNICAL";

  const hasExp = options.hasCandidateExperience ?? false;
  const hasComp = options.hasCompanyContext ?? false;

  // ─────────────────────────────────────────────────────────────
  // 1. BEHAVIORAL: INCIDENT & PROJECT FABRICATION CHECK
  // ─────────────────────────────────────────────────────────────
  if (effectiveTaskType === "BEHAVIORAL") {
    if (!hasExp) {
      // Look for assertive unbracketed first-person incident claims implying actual occurrence
      const fabricatedIncidentPatterns = [
        /(?:^|[.!?]\s+|\n)(?:I led|I resolved|I handled|I fixed|I triaged)\s+(?:the|a|an|our)\s+(?:incident|production outage|outage|failure|sev-1|sev 1|sev-2|sev 2|crisis|database crash)/i,
        /(?:^|[.!?]\s+|\n)I led the incident response\b/i,
        /(?:^|[.!?]\s+|\n)I was responsible for resolving (?:the|a|an|our)\s+(?:outage|incident|downtime)/i,
        /(?:^|[.!?]\s+|\n)(?:In|At) my (?:previous|former|last) (?:company|employer|job|role|team),\s*(?:I|we)\s+(?:led|built|resolved|faced an outage|handled an incident)/i,
      ];

      for (const pattern of fabricatedIncidentPatterns) {
        const match = textWithoutBrackets.match(pattern);
        if (match) {
          containsFabricatedIncident = true;
          violations.push({
            code: "UNSUPPORTED_CANDIDATE_INCIDENT",
            message: `First-person incident or project claim generated without candidate context: "${match[0].trim()}"`,
            matchedText: match[0].trim(),
            severity: "error",
          });
          break;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. UNANCHORED METRICS DETECTION (Behavioral & HR)
  // ─────────────────────────────────────────────────────────────
  if (effectiveTaskType === "BEHAVIORAL" || effectiveTaskType === "HR") {
    // Look for quantified achievements in text outside brackets
    const metricMatches = [
      ...textWithoutBrackets.matchAll(
        /(?:reduced|improved|increased|decreased|cut|boosted|saved|dropped)\s+(?:[\w\s]{1,30}\s+)?(?:by|to)\s+(\d+(?:\.\d+)?%|\d+\s*(?:minutes?|seconds?|hours?|days?|ms))/gi
      ),
      ...textWithoutBrackets.matchAll(/\bby\s+(\d+(?:\.\d+)?%)\b/gi),
      ...textWithoutBrackets.matchAll(
        /\b(\d+(?:\.\d+)?%)\s+(?:latency|reduction|improvement|increase|drop|savings|boost)\b/gi
      ),
    ];

    const contextHaystack = [
      options.candidateContext?.resumeText || "",
      options.candidateContext?.notes || "",
      ...(options.candidateContext?.stableFacts || []),
      ...(options.candidateContext?.allowedMetrics || []).map(String),
    ]
      .join(" ")
      .toLowerCase();

    for (const match of metricMatches) {
      const metricValue = match[1] ? match[1].toLowerCase().trim() : match[0].toLowerCase().trim();
      const rawNumber = metricValue.replace(/[^\d.]/g, "");

      // Check if this metric is anchored in provided candidate context
      const isAnchored =
        contextHaystack.length > 0 &&
        (contextHaystack.includes(metricValue) ||
          (rawNumber.length > 0 && contextHaystack.includes(rawNumber)));

      if (!isAnchored) {
        containsUnanchoredMetrics = true;
        violations.push({
          code: "UNANCHORED_METRIC",
          message: `Quantified achievement metric "${metricValue}" is not anchored in candidate context.`,
          matchedText: match[0].trim(),
          severity: "error",
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. HR COMPANY & CREDENTIAL FABRICATION CHECK
  // ─────────────────────────────────────────────────────────────
  if (effectiveTaskType === "HR") {
    if (!hasComp) {
      // When company context is absent, the model must not invent knowledge of proprietary internal products
      const fakeCompanyClaims = [
        /(?:I have been following|I admire|I love)\s+your\s+(?:product|launch of|proprietary|mission at)\s+([A-Z][a-zA-Z0-9]+)/i,
        /(?:At|Working at)\s+([A-Z][a-zA-Z0-9]+)\s+specifically excites me because of your internal\b/i,
      ];
      for (const pattern of fakeCompanyClaims) {
        const match = textWithoutBrackets.match(pattern);
        if (match) {
          containsFabricatedCompany = true;
          violations.push({
            code: "UNSUPPORTED_COMPANY_CLAIM",
            message: `Invented proprietary company claim without company context: "${match[0].trim()}"`,
            matchedText: match[0].trim(),
            severity: "error",
          });
          break;
        }
      }
    }

    if (!hasExp) {
      // Must not invent past employers when candidate history is absent
      const fakeEmployerClaims = [
        /(?:During my time at|While working at|At my previous employer)\s+([A-Z][a-zA-Z0-9]+)/i,
      ];
      for (const pattern of fakeEmployerClaims) {
        const match = textWithoutBrackets.match(pattern);
        if (match) {
          violations.push({
            code: "UNSUPPORTED_EMPLOYER_CLAIM",
            message: `Employer claim without candidate history: "${match[0].trim()}"`,
            matchedText: match[0].trim(),
            severity: "error",
          });
          break;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. SYSTEM DESIGN SCALE ASSUMPTION FRAMING
  // ─────────────────────────────────────────────────────────────
  if (effectiveTaskType === "SYSTEM_DESIGN") {
    // Check if scale numbers appear (e.g., 50,000 QPS, 100k RPS, 10M DAU)
    const scaleMatches = textWithoutBrackets.match(
      /\b(\d+(?:,\d+)*(?:k|m|b)?\s*(?:qps|rps|tps|reads?\/sec|writes?\/sec|requests? per second|dau|mau))\b/gi
    );

    if (scaleMatches && scaleMatches.length > 0) {
      // Split into sentences and verify that sentences stating scale frame them as assumptions
      const sentences = textWithoutBrackets.split(/(?<=[.!?])\s+/);
      const assumptionKeywordRegex =
        /(?:assume|assuming|assumption|hypothetical|estimate|estimating|estimated|let's say|target|targeting|concrete|design for|planning for|approximately|roughly|scale of|workload of|traffic profile)/i;

      for (const scaleStr of scaleMatches) {
        const sentenceWithScale = sentences.find((s) =>
          s.toLowerCase().includes(scaleStr.toLowerCase())
        );
        if (sentenceWithScale) {
          const isFramed = assumptionKeywordRegex.test(sentenceWithScale);
          if (!isFramed) {
            // Check if it claims personal production experience
            if (/(?:in our production|in my last system|we handled|our cluster)/i.test(sentenceWithScale)) {
              containsFramedAssumptionsOnly = false;
              violations.push({
                code: "UNFRAMED_PRODUCTION_CLAIM",
                message: `System design scale statement is not framed as an interview assumption: "${sentenceWithScale.trim()}"`,
                matchedText: sentenceWithScale.trim(),
                severity: "error",
              });
            }
          }
        }
      }
    }
  }

  const passed = violations.filter((v) => v.severity === "error").length === 0;

  return {
    passed,
    violations,
    containsUnanchoredMetrics,
    containsFabricatedIncident,
    containsFabricatedCompany,
    containsFramedAssumptionsOnly,
  };
}

