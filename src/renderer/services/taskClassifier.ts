import type {
  TaskType,
  ConfidenceTier,
  TaskClassificationResult,
  ActiveDiscussionThread,
  CompactScreenObservation,
  DialogueTurn,
  CandidateFacts,
} from '../types';

export interface ClassifierContext {
  activeDiscussionThread?: ActiveDiscussionThread | null;
  latestScreenObservation?: CompactScreenObservation | null;
  recentTurns?: DialogueTurn[] | Array<{ speaker: 'interviewer' | 'candidate'; text: string }>;
  interviewRound?: string;
  candidateProfile?: CandidateFacts;
}

interface FeatureRule {
  taskType: TaskType;
  regexes: RegExp[];
  weight: number;
}

/**
 * Deterministic multi-feature rules for each candidate TaskType.
 */
const FEATURE_RULES: FeatureRule[] = [
  // ─── CODING ───
  {
    taskType: 'CODING',
    regexes: [
      /\bwrite\s+(?:a\s+)?(?:python|javascript|typescript|java|c\+\+|cpp|golang|go|rust)?\s*(?:function|method|class|algorithm|code|solution)\b/i,
      /\bimplement\s+(?:a\s+)?(?:function|method|class|algorithm|solution)\b/i,
      /\bcode\s+this(?:\s+up)?\b/i,
      /\bleetcode\b/i,
      /\btwo\s*sum\b/i,
      /\breverse\s+(?:a\s+)?linked\s*list\b/i,
      /\bbinary\s+tree\s+(?:traversal|inorder|preorder|postorder|level\s*order|diameter|depth)\b/i,
      /\bvalid\s+parentheses\b/i,
      /\btime\s+and\s+space\s+complexity\s+of\s+(?:your|this)\s+solution\b/i,
      /\boptimal\s+(?:time\s+complexity|space\s+complexity)\b/i,
      /\bmerge\s+k\s+sorted\b/i,
      /\btrapping\s+rain\s+water\b/i,
      /\bfind\s+(?:the\s+)?(?:kth\s+largest|median|longest\s+substring|subarray|maximum\s+subarray)\b/i,
      /\bsliding\s+window\s+(?:maximum|pattern|solution)\b/i,
      /\bdynamic\s+programming\s+(?:solution|table|memoization|bottom\s*up)\b/i,
    ],
    weight: 0.75,
  },

  // ─── SQL ───
  {
    taskType: 'SQL',
    regexes: [
      /\b(?:write|give\s+me)\s+(?:a\s+)?sql\s+(?:query|statement|command)\b/i,
      /\bsql\s+query\s+to\b/i,
      /\bselect\s+.+\s+from\s+.+\b/i,
      /\bsecond\s+highest\s+salary\b/i,
      /\b(?:inner|left|right|full|cross)\s+join\b/i,
      /\bgroup\s+by\s+.+\s+having\b/i,
      /\bwindow\s+function(?:s)?\b/i,
      /\b(?:dense_rank|row_number|rank)\(\)\s+over\b/i,
      /\bpartition\s+by\b/i,
      /\bdatabase\s+schema\s+(?:query|table)\b/i,
    ],
    weight: 0.80,
  },

  // ─── DEBUGGING ───
  {
    taskType: 'DEBUGGING',
    regexes: [
      /\bfix\s+(?:this|the)\s+(?:error|bug|issue|exception|crash|code)\b/i,
      /\bwhy\s+is\s+this\s+(?:throwing|crashing|failing|giving\s+error)\b/i,
      /\bdebug\s+(?:this|the)\s+(?:code|function|issue|error)\b/i,
      /\bwhat(?:'s|\s+is)\s+wrong\s+with\s+this\s+(?:code|implementation)\b/i,
      /\bspot\s+the\s+bug\b/i,
      /\bstack\s*trace\b/i,
      /\b(?:nullpointerexception|typeerror|syntaxerror|indexerror|referenceerror|segmentation\s+fault|recursionerror|out\s+of\s+memory)\b/i,
      /\bmemory\s+leak\b/i,
      /\bdeadlock\s+detection\b/i,
      /\boff-by-one\s+error\b/i,
    ],
    weight: 0.75,
  },

  // ─── MCQ ───
  {
    taskType: 'MCQ',
    regexes: [
      /\b(?:which\s+of\s+the\s+following|choose\s+the\s+(?:correct|best)\s+option|select\s+the\s+best\s+answer)\b/i,
      /\b(?:\(?[A-D]\)?[\s.:]\s+[^\n]+){2,}/i,
      /\boptions?:\s*\(?[A-D]\)?/i,
      /\b(?:is\s+it|choose)\s+(?:[A-D]\b|option\s+[A-D]\b)/i,
    ],
    weight: 0.80,
  },

  // ─── ML_DESIGN ───
  {
    taskType: 'ML_DESIGN',
    regexes: [
      /\bdesign\s+(?:an?\s+)?(?:ml|machine\s+learning|ai)\s+(?:system|pipeline|solution|architecture)\b/i,
      /\bdesign\s+(?:an?\s+)?(?:recommendation|recommender|ranking|eta\s+prediction|fraud\s+detection|churn\s+prediction|search\s+ranking|ad\s+click|ctr\s+prediction)\s+(?:system|model|solution)\b/i,
      /\beta\s+prediction\b/i,
      /\bfeature\s+engineering\s+(?:pipeline|strategy)\b/i,
      /\bdata\s+leakage\b/i,
      /\boffline\s+vs\s+online\s+evaluation\b/i,
      /\b(?:model|data|concept)\s+drift\b/i,
      /\bfeature\s+store\b/i,
      /\bembedding\s+(?:generation|retrieval|model)\b/i,
      /\bauc-?roc\b/i,
      /\bprecision[- ]recall\s+trade-?off\b/i,
    ],
    weight: 0.75,
  },

  // ─── SYSTEM_DESIGN ───
  {
    taskType: 'SYSTEM_DESIGN',
    regexes: [
      /\bdesign\s+(?:a\s+)?(?:url\s+shortener|tinyurl|rate\s+limiter|distributed\s+cache|notification\s+service|chat\s+system|twitter|uber|instagram|web\s+crawler|key-value\s+store|payment\s+system|cdn)\b/i,
      /\bdesign\s+(?:a\s+)?(?:distributed|scalable|high-availability)\s+(?:system|architecture|service|backend)\b/i,
      /\bhow\s+would\s+you\s+(?:architect|design)\s+(?:a\s+)?(?:scalable|distributed|system)\b/i,
      /\bhigh-level\s+system\s+design\b/i,
      /\bcap\s+theorem\b/i,
      /\bdatabase\s+sharding\b/i,
      /\bread\s+replicas\b/i,
      /\bmessage\s+queue\s+(?:architecture|throughput)\b/i,
      /\bconsistent\s+hashing\b/i,
      /\bsingle\s+point\s+of\s+failure\b/i,
    ],
    weight: 0.75,
  },

  // ─── BEHAVIORAL ───
  {
    taskType: 'BEHAVIORAL',
    regexes: [
      /\btell\s+me\s+about\s+a\s+time\b/i,
      /\bgive\s+me\s+an\s+example\s+of\s+(?:when|a\s+time)\b/i,
      /\bdescribe\s+a\s+situation\s+where\b/i,
      /\bdisagreed\s+with\s+(?:a\s+)?(?:teammate|peer|manager|coworker|lead)\b/i,
      /\bhow\s+do\s+you\s+handle\s+(?:conflict|disagreements?|difficult\s+stakeholders?)\b/i,
      /\bfaced\s+(?:a\s+)?(?:tight\s+deadline|difficult\s+challenge|setback)\b/i,
      /\bmade\s+a\s+mistake\s+(?:and\s+how\s+you\s+handled\s+it|at\s+work)\b/i,
      /\bproudest\s+(?:engineering\s+)?accomplishment\b/i,
      /\bworked\s+under\s+pressure\b/i,
      /\blead\s+a\s+(?:project|team|initiative)\b/i,
    ],
    weight: 0.80,
  },

  // ─── HR ───
  {
    taskType: 'HR',
    regexes: [
      /\bwhy\s+(?:do\s+you\s+want\s+to\s+work\s+(?:at|for|here)|our\s+company)\b/i,
      /\bwhy\s+(?:do\s+you\s+want\s+)?this\s+role\b/i,
      /\bwhy\s+should\s+we\s+hire\s+you\b/i,
      /\btell\s+me\s+about\s+yourself\b/i,
      /\bwalk\s+me\s+through\s+your\s+resume\b/i,
      /\bwhere\s+do\s+you\s+see\s+yourself\s+in\s+5\s+years\b/i,
      /\bwhat\s+are\s+your\s+salary\s+expectations\b/i,
      /\bwhat\s+(?:is|are)\s+your\s+notice\s+period\b/i,
      /\bwhy\s+are\s+you\s+leaving\s+your\s+(?:current\s+)?job\b/i,
      /\bwhat\s+are\s+your\s+strengths\s+and\s+weaknesses\b/i,
      /\bare\s+you\s+open\s+to\s+relocation\b/i,
    ],
    weight: 0.80,
  },

  // ─── CONCEPTUAL / THEORETICAL_CONCEPT ───
  {
    taskType: 'CONCEPTUAL',
    regexes: [
      /\bwhat\s+is\s+the\s+difference\s+between\b/i,
      /\bwhy\s+use\s+precision\s+instead\s+of\s+accuracy\b/i,
      /\bwhy\s+use\s+recall\s+instead\s+of\b/i,
      /\bhow\s+does\s+(?:[a-z0-9_]+)\s+work(?:\s+under\s+the\s+hood)?\b/i,
      /\bexplain\s+(?:how|the\s+concept\s+of|what\s+is)\b/i,
      /\bwhat\s+happens\s+under\s+the\s+hood\b/i,
      /\bpros\s+and\s+cons\s+of\b/i,
      /\bwhen\s+would\s+you\s+use\s+[a-z0-9_]+\s+(?:over|instead\s+of)\b/i,
      /\bgarbage\s+collection\b/i,
      /\bgil\s+in\s+python\b/i,
      /\bb-?tree\s+vs\s+b\+?\s*tree\b/i,
      /\boptimistic\s+vs\s+pessimistic\s+locking\b/i,
      /\bprocess\s+vs\s+thread\b/i,
      /\btcp\s+vs\s+udp\b/i,
      /\bvirtual\s+memory\b/i,
      /\bbias-variance\s+trade-?off\b/i,
      /\boverfitting\s+vs\s+underfitting\b/i,
    ],
    weight: 0.75,
  },


  // ─── COMPARISON ───
  {
    taskType: 'COMPARISON',
    regexes: [
      /\bcompare\s+(?:and\s+contrast\s+)?[a-z0-9_]+\s+(?:and|with|vs)\s+[a-z0-9_]+\b/i,
      /\b[a-z0-9_]+\s+vs\.?\s+[a-z0-9_]+\b/i,
      /\btrade-?offs?\s+between\s+[a-z0-9_]+\s+and\s+[a-z0-9_]+\b/i,
    ],
    weight: 0.55,
  },

  // ─── CASE_STUDY ───
  {
    taskType: 'CASE_STUDY',
    regexes: [
      /\bcase\s+study\b/i,
      /\bhow\s+would\s+you\s+approach\s+(?:this\s+scenario|this\s+problem|increasing\s+conversion)\b/i,
      /\bbusiness\s+case\b/i,
      /\broot\s+cause\s+analysis\s+for\s+(?:revenue|churn|growth)\b/i,
    ],
    weight: 0.55,
  },

  // ─── RESUME_DRILLDOWN ───
  {
    taskType: 'RESUME_DRILLDOWN',
    regexes: [
      /\byou\s+mentioned\s+(?:on|in)\s+your\s+resume\b/i,
      /\bi\s+see\s+(?:that\s+)?you\s+worked\s+(?:at|on)\b/i,
      /\btell\s+me\s+more\s+about\s+this\s+project\s+on\s+your\s+resume\b/i,
      /\byou\s+listed\s+[a-z0-9_]+\s+on\s+your\s+resume\b/i,
    ],
    weight: 0.65,
  },

  // ─── DATA_INTERPRETATION ───
  {
    taskType: 'DATA_INTERPRETATION',
    regexes: [
      /\bwhat\s+does\s+this\s+(?:chart|graph|plot|metric|distribution)\s+(?:show|indicate|mean)\b/i,
      /\binterpret\s+(?:this|the)\s+(?:chart|p-value|roc\s+curve|confusion\s+matrix)\b/i,
      /\bp-value\s+(?:of|<|=)\b/i,
    ],
    weight: 0.55,
  },

  // ─── PRODUCT_SCENARIO ───
  {
    taskType: 'PRODUCT_SCENARIO',
    regexes: [
      /\bhow\s+would\s+you\s+measure\s+the\s+success\s+of\b/i,
      /\bnorth\s+star\s+metric\b/i,
      /\bmetric\s+dropped\s+by\b/i,
      /\ba\/b\s+test\s+(?:design|hypothesis|results)\b/i,
    ],
    weight: 0.55,
  },
];

/**
 * Patterns indicating an explicit code generation request.
 */
const EXPLICIT_CODE_REQUEST_REGEXES = [
  /\b(?:write|implement|code|generate|provide)\s+(?:a\s+)?(?:python|javascript|typescript|java|c\+\+|cpp|golang|go|rust|sql)?\s*(?:function|code|algorithm|script|method|class)\b/i,
  /\bwrite\s+(?:the\s+)?code\b/i,
  /\bcode\s+this\b/i,
  /\bshow\s+(?:me\s+)?(?:the\s+)?(?:code|implementation)\b/i,
];

/**
 * Short query triggers suggesting a conversational follow-up.
 */
const FOLLOW_UP_LEAD_REGEX = /^(?:why\??|how\??|what\s+about\b|what\s+if\b|how\s+about\b|can\s+we\b|could\s+we\b|why\s+not\b|how\s+would\s+you\b|what\s+are\s+the\s+trade-?offs\b|any\s+drawbacks\??|and\s+then\??|can\s+you\s+optimize\b|why\s+use\s+that\b|how\s+to\s+scale\s+that\b)/i;

/**
 * Classify the interview task deterministically using multi-feature scoring and conversational context.
 */
export function classifyInterviewTask(
  question: string,
  context?: ClassifierContext
): TaskClassificationResult {
  const trimmed = (question || '').trim();
  if (!trimmed) {
    return {
      taskType: 'GENERAL_TECHNICAL',
      confidence: 0.30,
      tier: 'LOW',
      rationale: 'Empty question provided; defaulting to general technical with low confidence.',
      suggestedDepth: 'SHORT',
      requiresCode: false,
    };
  }

  // 1. Follow-up & Ambiguous Short Question Check using active discussion thread
  const activeThread = context?.activeDiscussionThread;
  const latestScreen = context?.latestScreenObservation;
  const parentTaskType: TaskType | undefined = activeThread?.taskType || latestScreen?.taskType;

  const isShortQuery = trimmed.length <= 45;
  const hasFollowUpLead = FOLLOW_UP_LEAD_REGEX.test(trimmed);

  if (parentTaskType && (isShortQuery || hasFollowUpLead)) {
    // Explicit check: does the follow-up request code?
    const isExplicitCodeRequest = EXPLICIT_CODE_REQUEST_REGEXES.some(r => r.test(trimmed));
    const requiresCode = parentTaskType === 'CODING' || (parentTaskType === 'SQL' && /query|sql/i.test(trimmed)) || isExplicitCodeRequest;

    return {
      taskType: 'FOLLOW_UP',
      parentTaskType,
      confidence: 0.88,
      tier: 'HIGH',
      rationale: `Follow-up question anchored to active thread '${activeThread?.parentTopic || 'screen observation'}' (parent: ${parentTaskType}).`,
      suggestedDepth: parentTaskType === 'SYSTEM_DESIGN' || parentTaskType === 'ML_DESIGN' ? 'NORMAL' : 'SHORT',
      requiresCode,
    };
  }

  // 2. Feature Scoring across all task types
  const scores: Map<TaskType, { score: number; matches: string[] }> = new Map();

  for (const rule of FEATURE_RULES) {
    let currentScore = scores.get(rule.taskType)?.score || 0;
    const matches: string[] = scores.get(rule.taskType)?.matches || [];

    for (const regex of rule.regexes) {
      const match = trimmed.match(regex);
      if (match) {
        currentScore += rule.weight;
        matches.push(match[0]);
      }
    }

    if (currentScore > 0) {
      scores.set(rule.taskType, { score: currentScore, matches });
    }
  }

  // 3. Contextual Boosts (e.g. interview round alignment)
  const round = (context?.interviewRound || '').toLowerCase();
  if (round.includes('coding') && scores.has('CODING')) {
    scores.get('CODING')!.score += 0.15;
  } else if ((round.includes('system_design') || round.includes('system')) && scores.has('SYSTEM_DESIGN')) {
    scores.get('SYSTEM_DESIGN')!.score += 0.15;
  } else if ((round.includes('ml') || round.includes('machine_learning')) && scores.has('ML_DESIGN')) {
    scores.get('ML_DESIGN')!.score += 0.15;
  } else if ((round.includes('behavioral') || round.includes('culture')) && scores.has('BEHAVIORAL')) {
    scores.get('BEHAVIORAL')!.score += 0.15;
  } else if (round.includes('hr') && scores.has('HR')) {
    scores.get('HR')!.score += 0.15;
  }

  // 4. Negative indicators / Disambiguation
  // A. ML_DESIGN vs CODING: If question says "design an ML system", penalize CODING
  if (/design\s+(?:an?\s+)?(?:ml|machine\s+learning)\b/i.test(trimmed)) {
    if (scores.has('CODING')) {
      scores.get('CODING')!.score = 0;
    }
  }
  // B. SYSTEM_DESIGN vs CODING: If question says "design a url shortener" / "system design", penalize CODING
  if (/design\s+(?:a\s+)?(?:url\s+shortener|system|tinyurl|distributed)\b/i.test(trimmed)) {
    if (scores.has('CODING')) {
      scores.get('CODING')!.score = 0;
    }
  }
  // C. BEHAVIORAL / HR vs CODING:
  if (/tell\s+me\s+about\s+a\s+time|why\s+do\s+you\s+want\s+this\s+role/i.test(trimmed)) {
    if (scores.has('CODING')) scores.get('CODING')!.score = 0;
    if (scores.has('SYSTEM_DESIGN')) scores.get('SYSTEM_DESIGN')!.score = 0;
  }

  // 5. Select Winning Task Type
  let bestType: TaskType = 'GENERAL_TECHNICAL';
  let maxScore = 0;
  let bestMatches: string[] = [];

  for (const [taskType, data] of scores.entries()) {
    if (data.score > maxScore) {
      maxScore = data.score;
      bestType = taskType;
      bestMatches = data.matches;
    }
  }

  // Normalize confidence (0 to 1)
  const normalizedConfidence = Math.min(0.98, Math.max(0.10, Number(maxScore.toFixed(2))));

  // Check explicit code request
  const hasExplicitCodeRequest = EXPLICIT_CODE_REQUEST_REGEXES.some(r => r.test(trimmed));

  // 6. Confidence Tier Resolution
  let tier: ConfidenceTier;
  if (normalizedConfidence >= 0.70) {
    tier = 'HIGH';
  } else if (normalizedConfidence >= 0.40) {
    tier = 'MEDIUM';
  } else {
    tier = 'LOW';
  }

  // LOW CONFIDENCE GUARD: Never cause arbitrary code generation.
  if (tier === 'LOW') {
    return {
      taskType: 'GENERAL_TECHNICAL',
      parentTaskType,
      confidence: normalizedConfidence,
      tier: 'LOW',
      rationale: `Low feature score (${normalizedConfidence}); safe fallback to GENERAL_TECHNICAL.`,
      suggestedDepth: 'NORMAL',
      requiresCode: false, // STRICT: Never emit code on low confidence
    };
  }

  // Determine requiresCode for winning type
  let requiresCode = false;
  if (bestType === 'CODING' || bestType === 'SQL') {
    requiresCode = true;
  } else if (bestType === 'DEBUGGING') {
    // Debugging requires code if fixing a snippet
    requiresCode = hasExplicitCodeRequest || /fix|code|snippet/i.test(trimmed);
  } else if (bestType === 'ML_DESIGN' || bestType === 'SYSTEM_DESIGN' || bestType === 'CASE_STUDY') {
    // CRITICAL: ML_DESIGN, SYSTEM_DESIGN and CASE_STUDY do NOT generate code unless explicitly asked!
    requiresCode = hasExplicitCodeRequest;
  } else {
    requiresCode = false;
  }

  // Determine suggested depth
  let suggestedDepth: 'SHORT' | 'NORMAL' | 'DEEP' = 'NORMAL';
  if (bestType === 'MCQ') {
    suggestedDepth = 'SHORT';
  } else if (bestType === 'CONCEPTUAL') {
    suggestedDepth = 'SHORT';
  } else if (bestType === 'HR') {
    suggestedDepth = /notice\s+period|salary|compensation/i.test(trimmed) ? 'SHORT' : 'NORMAL';
  } else if (bestType === 'SYSTEM_DESIGN' || bestType === 'ML_DESIGN' || bestType === 'CASE_STUDY') {
    suggestedDepth = 'DEEP';
  }

  return {
    taskType: bestType,
    parentTaskType,
    confidence: normalizedConfidence,
    tier,
    rationale: `Matched features: [${bestMatches.slice(0, 3).join(', ')}] with score ${maxScore.toFixed(2)}.`,
    suggestedDepth,
    requiresCode,
  };
}

