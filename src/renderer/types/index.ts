// ─── Transcript ───
export interface TranscriptEntry {
  id: number | string;
  speaker: 'user' | 'interviewer';
  message: string;
  text: string;
  timestamp: string;
  is_final: boolean;
  sequenceNumber: number;
  createdAt: number;
}

export interface TranscriptResult {
  source: 'microphone' | 'screen';
  text: string;
  is_final: boolean;
  timestamp: string;
  sequenceNumber: number;
  sessionId: string;
}

export interface TranscriptGroup {
  id: number | string;
  speaker: 'user' | 'interviewer';
  startTimestamp: string;
  endTimestamp: string;
  is_final: boolean;
  texts: string[];
}

export interface QuestionEntry {
  text: string;
  createdAt: number;
}

// ─── Answers ───
export interface Answer {
  answer: string;
  timestamp: string;
  source?: string;
  requestId?: string;
  outcome?: string;
  isError?: boolean;
  errorCode?: string;
  retryAfterSeconds?: number;
  finishReason?: string;
  isComplete?: boolean;
}

export interface AnswerScreenshots {
  [timestamp: string]: string; // blob URL
}

// ─── Session ───
export interface SessionFormData {
  job_title: string;
  company: string;
  interview_type: string;
  interview_round: string;
  streaming_model: string;
  experience_level: string;
  resume_file_path: string;
  notes: string;
  mic_device_id?: string;
}

export interface SessionData {
  id: string;
  job_title?: string;
  company?: string;
  interview_type?: string;
  interview_round?: string;
  streaming_model?: string;
  experience_level?: string;
  resume_file_path?: string;
  resume_text?: string;
  notes?: string;
  started_at?: string;
  resolved_model?: string;
}

export interface SessionContext {
  sessionId: string;
  jobTitle: string;
  company: string;
  experienceLevel: string;
  interviewRound: string;
  streamingModel: string;
  visionModel?: string;
  notes: string;
  resumeText: string;
  language: string;
}

// ─── Groq ───
export interface GroqStreamParams {
  requestId: string;
  messages: GroqMessage[];
  model: string;
  sessionContext: SessionContext;
  source?: string;
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | GroqMessageContent[];
}

export interface GroqMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface GroqChunkEvent {
  chunk: string;
  requestId: string;
}

export interface GroqDoneEvent {
  answer: string;
  requestId: string;
  source?: string;
  timestamp: string;
}

export interface GroqErrorEvent {
  message: string;
  requestId: string;
  category?: string;
  code?: string;
}

// ─── API Key Status ───
export interface ApiKeyStatus {
  groq: boolean;
  deepgram: boolean;
}

// ─── Toast ───
export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
}

// ─── Connection ───
export type CopilotConnectionState = 'idle' | 'connected' | 'joining' | 'reconnecting' | 'disconnected' | 'error';

// ─── Feedback ───
export interface EndedSessionFeedback {
  sessionId: string;
}

// ─── Active Session Dialog ───
export interface ActiveSessionDialog {
  session: SessionData | null;
  message: string;
  error?: string;
}

// ─── Resume ───
export interface ResumeFile {
  id: string;
  name: string;
  filePath: string;
}

export interface ResumeParseResult {
  success: boolean;
  format: 'pdf' | 'docx' | 'txt' | 'unknown';
  pageCount: number;
  extractedPages: number;
  extractedChars: number;
  text: string;
  fileName: string;
  filePath: string;
  warnings: string[];
  errorCode?:
    | 'FILE_NOT_FOUND'
    | 'FILE_EMPTY'
    | 'UNSUPPORTED_FORMAT'
    | 'PDF_EMPTY_TEXT'
    | 'PDF_SCANNED_NO_TEXT'
    | 'PDF_PARTIAL_EXTRACTION'
    | 'PDF_PARSE_ERROR'
    | 'DOCX_PARSE_ERROR'
    | 'TXT_READ_ERROR';
  errorMessage?: string;
}

// ─── Update State ───
export type UpdateStatus = 'idle' | 'available' | 'downloaded' | 'error';

export interface UpdateState {
  status: UpdateStatus;
  progress: number | null;
  error: string | null;
}

// ─── Groq Models ───
export interface GroqModel {
  id: string;
  label: string;
  badge?: string;
}

export const GROQ_MODELS: GroqModel[] = [
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B', badge: 'Fast' },
  { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B' },
  { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B', badge: 'Fast' },
];

export const VISION_MODEL = 'qwen/qwen3.6-27b';

// ─── Interview Rounds ───
export interface InterviewRound {
  value: string;
  label: string;
}

export const INTERVIEW_ROUNDS: InterviewRound[] = [
  { value: 'general', label: 'General' },
  { value: 'hr_screening', label: 'HR Screening' },
  { value: 'technical', label: 'Technical' },
  { value: 'coding', label: 'Coding' },
  { value: 'system_design', label: 'System Design' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'culture_fit', label: 'Culture Fit' },
  { value: 'final_executive', label: 'Final Executive' },
];

export const NOTES_MAX_LENGTH = 10_000;

// ─── Window API type declaration ───
declare global {
  interface Window {
    meow: MeowAPI;
    captureAPI: CaptureAPI;
  }
}

export interface MeowAPI {
  // Invoke
  getVersion(): Promise<string>;
  setPrivateMode(enabled: boolean): Promise<boolean>;
  getProtectionSupported(): Promise<boolean>;
  checkScreenPermission(): Promise<boolean>;
  requestScreenPermission(): Promise<boolean>;
  getScreenSources(): Promise<Array<{ id: string; name: string; display_id: string; isPrimary: boolean }>>;
  minimizeToTray(): Promise<void>;
  showApp(): Promise<void>;
  getWindowBounds(): Promise<{ x: number; y: number; width: number; height: number } | null>;
  setWindowBounds(bounds: Partial<{ x: number; y: number; width: number; height: number }>): Promise<void>;
  getApiKeyStatus(): Promise<ApiKeyStatus>;
  startAudioCapture(): Promise<boolean>;
  stopAudioCapture(): Promise<boolean>;
  parseResumeLocal(filePath: string): Promise<ResumeParseResult>;
  pickResumeFile(): Promise<ResumeParseResult | null>;
  getAuthToken(): Promise<string | null>;
  setAuthToken(token: string): Promise<boolean>;
  clearAuthToken(): Promise<boolean>;
  getDeviceIdentity(): Promise<{
    deviceId: string;
    deviceToken: string;
    deviceName: string;
    platform: string;
    osVersion: string;
    appVersion: string;
  }>;
  openRazorpayCheckout(options: any): Promise<{ success: boolean; data?: any; error?: string; dismissed?: boolean }>;

  // Send
  quitApp(): void;
  copyTextToClipboard(text: string): void;
  setIgnoreMouseEvents(ignore: boolean): void;
  setFocusable(focusable: boolean): void;
  setInputFocus(focused: boolean): void;
  requestFocus(): void;
  openExternal(url: string): void;

  // Event listeners
  onProtectionSupported(cb: (supported: boolean) => void): () => void;
  onScreenPermissionStatus(cb: (hasPermission: boolean) => void): () => void;
  onAnalyzeScreenShortcut(cb: () => void): () => void;
  onAudioData(cb: (data: number[]) => void): () => void;
  onAudioCaptureStarted(cb: () => void): () => void;
  onAudioCaptureStopped(cb: () => void): () => void;
  onAudioCaptureError(cb: (error: string) => void): () => void;

  // Constant
  platform: string;
}

export interface CaptureAPI {
  getScreenSources(): Promise<Array<{ id: string; name: string }>>;
  sendAudioData(data: number[]): void;
  notifyCaptureStarted(): void;
  notifyCaptureStopped(): void;
  notifyCaptureRestarting(attempt: number, maxRetries: number): void;
  notifyCaptureError(error: string): void;
  onStartCapture(cb: () => void): () => void;
  onStopCapture(cb: () => void): () => void;
}

// ─── Task & Quality Types (Phase 1 & Phase 2) ───
export type TaskType =
  | 'CODING'
  | 'SQL'
  | 'DEBUGGING'
  | 'CONCEPTUAL'
  | 'THEORETICAL_CONCEPT'
  | 'CASE_STUDY'
  | 'SYSTEM_DESIGN'
  | 'ML_DESIGN'
  | 'MCQ'
  | 'BEHAVIORAL'
  | 'HR'
  | 'DATA_INTERPRETATION'
  | 'PRODUCT_SCENARIO'
  | 'GENERAL_TECHNICAL'
  | 'FOLLOW_UP'
  | 'CLARIFICATION'
  | 'COMPARISON'
  | 'RESUME_DRILLDOWN';

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TaskClassificationResult {
  taskType: TaskType;
  parentTaskType?: TaskType;
  confidence: number; // 0 to 1
  tier: ConfidenceTier;
  rationale: string;
  suggestedDepth: 'SHORT' | 'NORMAL' | 'DEEP';
  requiresCode: boolean;
}


export interface CompactScreenObservation {
  observationId: string;
  timestamp: string;
  taskType?: TaskType;
  primaryQuestionOrProblem: string;
  keyEntitiesAndConstraints: string[];
  codeSnippet: string | null; // extracted text snippet only, never raw binary/image
  tokenCount: number;
}

export interface DialogueTurn {
  turnId: string;
  sequenceNumber: number;
  speaker: 'interviewer' | 'candidate';
  text: string;
  timestamp: string;
  tokenCount: number;
}

export interface EstablishedFact {
  factId: string;
  category: 'architecture' | 'decision' | 'constraint' | 'candidate_fact';
  fact: string;
  establishedAt: string;
}

export interface ActiveDiscussionThread {
  threadId: string;
  parentTopic: string;
  taskType: TaskType;
  establishedDecisions: string[];
  lastQuestion: string;
  lastAnswerSummary?: string;
  startedAt: string;
  turnCount: number;
}

export interface CandidateFacts {
  jobTitle: string;
  company: string;
  interviewRound: string;
  experienceLevel: string;
  focusNotes?: string;
  keySkills: string[];
  mode: 'PERSONALIZED' | 'GENERAL';
}

export interface CurrentContextSlot {
  question: string | null;
  userPrompt: string | null;
  taskType: TaskType | null;
  confidence: number | null;
  latestScreenObservation: CompactScreenObservation | null;
}

export interface InterviewContext {
  sessionId: string;
  contextVersion: number;
  lastSequenceNumber: number;
  activeDiscussionThread: ActiveDiscussionThread | null;
  current: CurrentContextSlot;
  recentTurns: DialogueTurn[];
  stableFacts: EstablishedFact[];
  rollingSummary: string | null;
  candidateFacts: CandidateFacts;
}

export type ContextEventType =
  | 'SESSION_INITIALIZED'
  | 'TRANSCRIPT_TURN_ADDED'
  | 'SCREEN_OBSERVATION_RECORDED'
  | 'MANUAL_QUESTION_SUBMITTED'
  | 'AI_ANSWER_RECORDED'
  | 'DISCUSSION_THREAD_UPDATED'
  | 'FACT_ESTABLISHED'
  | 'SESSION_DESTROYED';

export interface ContextEvent {
  eventId: string;
  sequenceNumber: number;
  requestId?: string;
  timestamp: string;
  contextVersion: number;
  type: ContextEventType;
  payload: any;
}

export interface BoundedContextPayload {
  contextVersion: number;
  estimatedTokens: number;
  current: {
    question: string | null;
    userPrompt: string | null;
    taskType: TaskType | null;
  };
  activeThread: {
    parentTopic: string;
    taskType: TaskType;
    decisions: string[];
  } | null;
  screenObservation: {
    problem: string;
    entities: string[];
    codeSnippet: string | null;
  } | null;
  recentTurns: Array<{ speaker: 'interviewer' | 'candidate'; text: string }>;
  stableFacts: string[];
  summary: string | null;
  candidateProfile: {
    role: string;
    level: string;
    skills: string[];
    mode: 'PERSONALIZED' | 'GENERAL';
  };
}


