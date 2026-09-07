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
  filePath: string;
  text: string;
  fileName: string;
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
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', badge: 'Fast' },
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', badge: 'Fast' },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B', badge: 'Fast' },
];

export const VISION_MODEL = 'llama-3.2-90b-vision-preview';

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
  parseResumeLocal(filePath: string): Promise<{ text: string }>;
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

