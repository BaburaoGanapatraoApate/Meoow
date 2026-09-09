import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header, { formatCooldown } from './components/Header';
import { SessionSetup } from './components/SessionSetup';
import { AnswersPanel } from './components/AnswersPanel';
import { TranscriptPanel } from './components/TranscriptPanel';
import { ToastProvider, useToast } from './components/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { DeviceLimitModal } from './components/DeviceLimitModal';
import { GroqClient } from './services/groqClient';
import { createDeepgramManager, type DeepgramMessageEvent } from './services/deepgramClient';
import {
  createSession as createLocalSession,
  saveAnswers,
  clearSessionData,
  archiveSession,
  saveFeedback,
} from './services/sessionManager';
import { interviewContextManager } from './services/interviewContextManager';
import { classifyInterviewTask } from './services/taskClassifier';
import { setupClickThrough } from './utils/clickThrough';
import {
  isFillerOnlyTranscript,
  buildQuestionSignature,
  findDuplicates,
  isCrossTalkDuplicate,
  saveTranscript,
  isSemanticallyIncomplete,
  isContinuationOfPrevious,
} from './utils/transcriptProcessor';
import { createAudioMerger } from './utils/audioMerger';
import type {
  TranscriptEntry,
  Answer,
  SessionData,
  SessionFormData,
  SessionContext,
  CopilotConnectionState,
  AnswerScreenshots,
} from './types';

// ── Constants (optimized for conversational turn-taking & human speech cadence) ──
const AUDIO_FIRST_DATA_TIMEOUT = 15_000;
const CONTINUATION_GRACE_MS = 1400; // 1.4s grace period covering natural 1.0-1.2s human thought pauses
const INCOMPLETE_HOLD_EXTEND_MS = 800; // Hold extension step when trailing clause is semantically incomplete
const MAX_INCOMPLETE_HOLD_MS = 3500; // Safety cutoff preventing indefinite holding of broken speech
const FINALIZE_TIMEOUT = 800;
const FINALIZE_DRAIN = 100;

interface ActiveStreamSession {
  requestId: string;
  source: string;
  accumulatedText: string;
  screenshotUrl?: string | null;
}

// ── Inner app component (uses toast context) ──
function MeowApp() {
  const toast = useToast();
  const {
    isAuthenticated,
    isLoading,
    refreshUser,
    user,
    deviceLimitExceeded,
    activeDevices,
    maxDevices,
    syncDevice,
    logout,
  } = useAuth();

  // ── State ──
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const answersRef = useRef<Answer[]>([]);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [isShowingSetup, setIsShowingSetup] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const hasZeroCredits = (user?.credits ?? 0) <= 0 && user?.usageMode !== 'unlimited';
  const [zeroCreditCountdown, setZeroCreditCountdown] = useState<number | null>(null);
  const zeroCreditCountdownRef = useRef<number | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [autoAnswer, setAutoAnswer] = useState(true);
  const [isEndingActiveSession, setIsEndingActiveSession] = useState(false);
  const [groqClient, setGroqClient] = useState<GroqClient | null>(null);
  const [copilotConnectionState, setCopilotConnectionState] = useState<CopilotConnectionState>('idle');
  const [pendingCopilotWork, setPendingCopilotWork] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [currentStreamingAnswer, setCurrentStreamingAnswer] = useState('');
  const [currentStreamingScreenshot, setCurrentStreamingScreenshot] = useState<string | null>(null);
  const [answerScreenshots, setAnswerScreenshots] = useState<AnswerScreenshots>({});
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [loopbackStream, setLoopbackStream] = useState<MediaStream | null>(null);
  const [mergedStream, setMergedStream] = useState<MediaStream | null>(null);
  const [isProtectionSupported, setIsProtectionSupported] = useState(true);
  const [isDeepgramConnected, setIsDeepgramConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeCooldown, setAnalyzeCooldown] = useState(0);

  // ── Refs ──
  const isAnalyzingScreenRef = useRef(false);
  const analyzeCooldownRef = useRef(0);
  const activeStreamsRef = useRef<Map<string, ActiveStreamSession>>(new Map());

  // Sync cooldown ref & run 1s countdown ticker
  useEffect(() => {
    analyzeCooldownRef.current = analyzeCooldown;
  }, [analyzeCooldown]);

  useEffect(() => {
    if (analyzeCooldown <= 0) return;
    const timer = setInterval(() => {
      setAnalyzeCooldown(prev => {
        const next = prev - 1;
        analyzeCooldownRef.current = Math.max(0, next);
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [analyzeCooldown]);
  const foregroundStreamIdRef = useRef<string | null>(null);
  const currentStreamingScreenshotRef = useRef<string | null>(null);
  const lastFlushedQuestionRef = useRef<{ text: string; timestamp: number; requestId?: string } | null>(null);
  const questionStartTimeRef = useRef<number>(0);
  const screenshotUrlsRef = useRef<Set<string>>(new Set());
  const deepgramManagerRef = useRef<ReturnType<typeof createDeepgramManager> | null>(null);
  const pendingAudioChunksRef = useRef<Blob[]>([]);
  const questionBuffer = useRef('');
  const recentQuestionsRef = useRef<Array<{ text: string; createdAt: number }>>([]);
  const lastQuestionSignatureRef = useRef('');
  const autoAnswerRef = useRef(true);
  const groqClientRef = useRef<GroqClient | null>(null);
  const micActiveRef = useRef(false);
  const loopbackActiveRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const hasReceivedAudioRef = useRef(false);
  const questionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizeCallbackRef = useRef<(() => void) | null>(null);
  const sequenceRef = useRef(0);
  const streamingAnswerRef = useRef('');

  // ── Sync refs ──
  useEffect(() => { autoAnswerRef.current = autoAnswer; }, [autoAnswer]);
  useEffect(() => { groqClientRef.current = groqClient; }, [groqClient]);
  useEffect(() => { zeroCreditCountdownRef.current = zeroCreditCountdown; }, [zeroCreditCountdown]);

  // ── Click-through setup (only active during live session) ──
  useEffect(() => setupClickThrough(isSessionStarted), [isSessionStarted]);

  // ── Cleanup blob URLs ──
  useEffect(() => () => {
    screenshotUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  // ── Protection support check ──
  useEffect(() => {
    window.meow?.getProtectionSupported?.().then(setIsProtectionSupported).catch(() => {});
    const cleanup = window.meow?.onProtectionSupported?.((s: boolean) => setIsProtectionSupported(s));
    return () => cleanup?.();
  }, []);

  // ── Audio merger effect ──
  useEffect(() => {
    if (!micStream && !loopbackStream) {
      setMergedStream(null);
      return;
    }
    const result = createAudioMerger(micStream, loopbackStream, {
      micActive: micActiveRef,
      loopbackActive: loopbackActiveRef,
    });
    if (result) {
      setMergedStream(result.stream);
      return result.cleanup;
    }
  }, [micStream, loopbackStream]);

  // ── Transcript handler ──
  const handleTranscriptResult = useCallback((
    speaker: 'user' | 'interviewer',
    text: string,
    isFinal: boolean,
  ) => {
    // Drop user voice immediately when credits are 0 during session
    if (speaker === 'user' && zeroCreditCountdownRef.current !== null) {
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;

    setTranscript(prev => {
      const now = Date.now();
      // Cross-talk dedup: check against opposite speaker within 5s window
      if (isFinal) {
        const dupes = findDuplicates(prev, speaker === 'user' ? 'interviewer' : 'user', trimmed, now);
        if (dupes.length > 0) return prev;
      }

      // Search backward for the most recent interim entry from this speaker
      let existingInterimIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].speaker === speaker && !prev[i].is_final) {
          existingInterimIdx = i;
          break;
        }
      }

      const next = [...prev];
      if (existingInterimIdx !== -1) {
        const existing = next[existingInterimIdx];
        if (!isFinal && existing.text === trimmed) return prev;
        next[existingInterimIdx] = {
          ...existing,
          message: trimmed,
          text: trimmed,
          timestamp: new Date().toISOString(),
          is_final: isFinal,
          createdAt: now,
        };
      } else {
        const entry: TranscriptEntry = {
          id: `${speaker}-${sequenceRef.current++}`,
          speaker,
          message: trimmed,
          text: trimmed,
          timestamp: new Date().toISOString(),
          is_final: isFinal,
          sequenceNumber: sequenceRef.current,
          createdAt: now,
        };
        next.push(entry);
      }
      transcriptRef.current = next;
      if (isFinal && speaker === 'user') {
        interviewContextManager.addCandidateTurn(trimmed);
      }
      return next;
    });
  }, []);

  // ── Question flush ──
  const flushQuestion = useCallback(() => {
    if (questionDebounceRef.current) {
      clearTimeout(questionDebounceRef.current);
      questionDebounceRef.current = null;
    }

    const text = questionBuffer.current.trim();
    if (!text || isFillerOnlyTranscript(text)) {
      questionBuffer.current = '';
      questionStartTimeRef.current = 0;
      return;
    }

    const now = Date.now();
    const durationHeld = questionStartTimeRef.current ? now - questionStartTimeRef.current : 0;
    // If the sentence is semantically incomplete (e.g. ends in "and", "or", "for", "with", "a", comma),
    // hold for up to MAX_INCOMPLETE_HOLD_MS to let the interviewer finish formulating the question
    if (isSemanticallyIncomplete(text) && durationHeld < MAX_INCOMPLETE_HOLD_MS) {
      questionDebounceRef.current = setTimeout(flushQuestion, INCOMPLETE_HOLD_EXTEND_MS);
      return;
    }

    questionBuffer.current = '';
    questionStartTimeRef.current = 0;

    // Check if this segment is a continuation of a recently flushed incomplete question
    let questionToAnswer = text;
    const lastFlushed = lastFlushedQuestionRef.current;
    const isContinuation =
      lastFlushed &&
      now - lastFlushed.timestamp < 4500 &&
      isContinuationOfPrevious(lastFlushed.text, text);

    if (isContinuation && lastFlushed) {
      // Merge with previous segment
      questionToAnswer = `${lastFlushed.text} ${text}`.replace(/\s+/g, ' ').trim();
      // Cancel premature stream if still active
      if (lastFlushed.requestId && groqClientRef.current) {
        groqClientRef.current.cancelStream(lastFlushed.requestId);
      }
    }

    const signature = buildQuestionSignature(questionToAnswer);
    if (signature === lastQuestionSignatureRef.current) return;
    lastQuestionSignatureRef.current = signature;

    recentQuestionsRef.current.push({ text: questionToAnswer, createdAt: now });
    if (recentQuestionsRef.current.length > 4) recentQuestionsRef.current.shift();

    // Build context from recent transcript
    const recentTranscript = transcriptRef.current
      .filter(e => e.is_final)
      .slice(-6)
      .map(e => `${e.speaker === 'user' ? 'Candidate' : 'Interviewer'}: ${e.text}`)
      .join('\n');

    const fullContext = recentTranscript
      ? `${recentTranscript}\n\nInterviewer's question: ${questionToAnswer}`
      : questionToAnswer;

    // Classify task with bounded context
    const contextSnapshot = interviewContextManager.getSnapshot();
    const classification = classifyInterviewTask(questionToAnswer, {
      activeDiscussionThread: contextSnapshot.activeDiscussionThread,
      latestScreenObservation: contextSnapshot.current.latestScreenObservation,
      recentTurns: contextSnapshot.recentTurns,
      interviewRound: sessionData?.interview_round,
      candidateProfile: contextSnapshot.candidateFacts,
    });

    interviewContextManager.addInterviewerTurn(questionToAnswer);
    const boundedContext = interviewContextManager.buildBoundedContextPayload();

    if (autoAnswerRef.current && groqClientRef.current) {
      const reqId = groqClientRef.current.sendTranscript(
        fullContext,
        true,
        'auto',
        selectedLanguage,
        classification,
        boundedContext
      );
      lastFlushedQuestionRef.current = {
        text: questionToAnswer,
        timestamp: now,
        requestId: reqId || undefined,
      };
    } else {
      lastFlushedQuestionRef.current = {
        text: questionToAnswer,
        timestamp: now,
      };
    }
  }, [selectedLanguage]);

  const scheduleQuestionFlush = useCallback((delayMs: number) => {
    if (questionDebounceRef.current) clearTimeout(questionDebounceRef.current);
    questionDebounceRef.current = setTimeout(flushQuestion, delayMs);
  }, [flushQuestion]);

  // ── Deepgram connection effect ──
  useEffect(() => {
    if (!isRecording || !sessionData?.id) return;
    let stopped = false;

    const startDg = async () => {
      const token = await window.meow?.getAuthToken?.();
      if (stopped || !token) {
        console.error('[Deepgram] No auth token available');
        return;
      }

      console.log('[Deepgram] Initializing Deepgram backend gateway connection for language:', selectedLanguage);
      const manager = createDeepgramManager(
        async () => window.meow?.getAuthToken?.(),
        selectedLanguage,
        (event: DeepgramMessageEvent) => {
          if (stopped) return;
          if (event.type === 'SpeechStarted') {
            return;
          } else if (event.type === 'UtteranceEnd') {
            const buf = questionBuffer.current.trim();
            if (!buf) return;
            // UtteranceEnd confirms silence gap: ensure continuation grace timer is running,
            // but NEVER flush prematurely at 400ms!
            if (!questionDebounceRef.current) {
              scheduleQuestionFlush(CONTINUATION_GRACE_MS);
            }
          } else if (event.type === 'Results') {
            const ch = event.channel_index?.[0] ?? 0;
            const alt = event.channel?.alternatives?.[0];
            const text = alt?.transcript;
            if (!text) return;
            const speaker: 'user' | 'interviewer' = ch === 0 ? 'user' : 'interviewer';
            const isFinal = !!event.is_final;
            const speechFinal = !!event.speech_final;

            handleTranscriptResult(speaker, text, isFinal);

            if (speaker === 'interviewer') {
              if (!questionStartTimeRef.current) {
                questionStartTimeRef.current = Date.now();
              }
              if (isFinal) {
                questionBuffer.current = (questionBuffer.current + ' ' + text).trim();
              }

              // Consistent continuation-grace strategy:
              // Whenever interviewer speech arrives, reset the continuation grace window.
              // This protects against natural 1.0-1.2s human pauses between clauses
              // without introducing unnecessary 3.5s delays for complete questions.
              scheduleQuestionFlush(CONTINUATION_GRACE_MS);
            }

            if (event.from_finalize && finalizeCallbackRef.current) {
              finalizeCallbackRef.current();
              finalizeCallbackRef.current = null;
            }
          }
        },
        (state) => {
          if (state === 'connected') {
            setCopilotConnectionState('connected');
            setIsDeepgramConnected(true);
          } else if (state === 'reconnecting') {
            setCopilotConnectionState('reconnecting');
            setIsDeepgramConnected(false);
          } else if (state === 'error') {
            setCopilotConnectionState('error');
            setIsDeepgramConnected(false);
          }
        },
      );

      deepgramManagerRef.current = manager;
      await manager.start();
      if (!stopped) {
        setIsDeepgramConnected(true);
      }
    };

    startDg().catch(err => console.error('[Deepgram] Setup failed:', err));

    return () => {
      stopped = true;
      setIsDeepgramConnected(false);
      deepgramManagerRef.current?.stop();
      deepgramManagerRef.current = null;
    };
  }, [isRecording, sessionData?.id, selectedLanguage, handleTranscriptResult, flushQuestion, scheduleQuestionFlush]);

  // ── MediaRecorder effect ──
  useEffect(() => {
    if (!mergedStream || !isDeepgramConnected) return;

    try {
      console.log('[MediaRecorder] Setting up audio streaming to Deepgram...');
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = new MediaRecorder(
        mergedStream,
        mimeType ? { mimeType, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 }
      );
      mediaRecorderRef.current = recorder;

      // Flush any queued audio chunks once Deepgram connection is active
      const flushPendingChunks = () => {
        const conn = deepgramManagerRef.current?.connection;
        if (conn?.isConnected() && pendingAudioChunksRef.current.length > 0) {
          while (pendingAudioChunksRef.current.length > 0) {
            const chunk = pendingAudioChunksRef.current.shift();
            if (chunk && chunk.size > 0) conn.sendMedia(chunk);
          }
        }
      };
      flushPendingChunks();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          const conn = deepgramManagerRef.current?.connection;
          if (conn?.isConnected()) {
            flushPendingChunks();
            conn.sendMedia(e.data);
          } else {
            // Buffer early chunks (such as the WebM header) so they are not dropped
            pendingAudioChunksRef.current.push(e.data);
            if (pendingAudioChunksRef.current.length > 60) {
              pendingAudioChunksRef.current.shift();
            }
          }
        }
      };

      recorder.start(100);
      hasReceivedAudioRef.current = true;
      console.log('[MediaRecorder] Started recording audio chunks (100ms)');

      return () => {
        if (recorder.state !== 'inactive') {
          try { recorder.stop(); } catch {}
        }
        mediaRecorderRef.current = null;
        pendingAudioChunksRef.current = [];
      };
    } catch (err) {
      console.error('[MediaRecorder] Failed to create:', err);
    }
  }, [mergedStream, isDeepgramConnected]);

  // ── Analyze screen shortcut ──
  useEffect(() => {
    const cleanup = window.meow?.onAnalyzeScreenShortcut?.(() => {
      if (isSessionStarted) {
        if (analyzeCooldownRef.current > 0) {
          toast.info(`Screen analysis is rate-limited. Please wait ~${formatCooldown(analyzeCooldownRef.current)}.`);
          return;
        }
        analyzeScreen();
      }
    });
    return () => cleanup?.();
  }, [isSessionStarted]);

  // ── Get mic stream (with preferred device support) ──
  const getMicStream = async (preferredDeviceId?: string): Promise<MediaStream | null> => {
    try {
      const constraints: MediaStreamConstraints =
        preferredDeviceId && preferredDeviceId !== 'default'
          ? {
              audio: {
                deviceId: { exact: preferredDeviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            }
          : {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            };
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('[Mic] Preferred device request failed, falling back to default:', err);
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (fallbackErr) {
        console.error('[Mic] Failed to access any microphone:', fallbackErr);
        return null;
      }
    }
  };

  // ── Get loopback stream via direct getDisplayMedia ──
  // The main window's session has setDisplayMediaRequestHandler registered
  // which auto-provides system loopback audio without any user picker.
  const getLoopbackStream = async (): Promise<MediaStream | null> => {
    try {
      console.log('[Loopback] Requesting system audio via getDisplayMedia...');
      const desktopStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,  // video must be requested for the handler to return audio
        audio: true,
      });

      // Disable video track to save resources but keep it alive
      // (stopping it can terminate the audio on some platforms)
      desktopStream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });

      const audioTracks = desktopStream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.warn('[Loopback] No audio track in display media — no system audio available');
        desktopStream.getTracks().forEach(t => t.stop());
        return null;
      }

      console.log('[Loopback] System audio captured:', audioTracks[0].label);

      // Build a stream containing only the audio track
      const audioStream = new MediaStream(audioTracks);

      // Notify main process capture system (for compatibility)
      window.meow?.startAudioCapture?.().catch?.(() => {});

      return audioStream;
    } catch (err) {
      console.error('[Loopback] getDisplayMedia failed:', err);
      return null;
    }
  };


  // ── Wait for audio data ──
  const waitForAudioData = async () => {
    const start = Date.now();
    while (!hasReceivedAudioRef.current && Date.now() - start < 1000) {
      await new Promise(r => setTimeout(r, 50));
    }
  };

  // ── Cleanup streams ──
  const cleanupStreams = () => {
    micStream?.getTracks().forEach(t => t.stop());
    setMicStream(null);
    if (loopbackStream) {
      loopbackStream.getTracks().forEach(t => t.stop());
      (loopbackStream as any)?._cleanupCapture?.();
      setLoopbackStream(null);
    }
  };

  // ── Start session ──
  const handleStartSession = async (formData: SessionFormData & { resume_text?: string }) => {
    if (deviceLimitExceeded) {
      toast.error('Device limit reached', 'Please authorize this device by replacing an inactive one.');
      return;
    }

    if (hasZeroCredits) {
      toast.error('You have 0 credits so buy it', 'Please purchase credits to start an interview session.', {
        label: 'Buy Credits',
        onClick: () => setIsPurchaseModalOpen(true),
      });
      setIsPurchaseModalOpen(true);
      return;
    }

    setIsStartingSession(true);
    hasReceivedAudioRef.current = false;
    streamingAnswerRef.current = '';
    questionBuffer.current = '';
    recentQuestionsRef.current = [];
    lastQuestionSignatureRef.current = '';
    sequenceRef.current = 0;

    try {
      const preferredMic = formData.mic_device_id || localStorage.getItem('meow-selected-mic-id') || undefined;
      const mic = await getMicStream(preferredMic);
      if (!mic) throw new Error('Could not access microphone');
      mic.getAudioTracks().forEach(t => { t.enabled = isMicEnabled; });
      setMicStream(mic);

      const loop = await getLoopbackStream();
      if (loop) {
        setLoopbackStream(loop);
      } else {
        toast.info('System audio unavailable — mic only. Interviewer voice may not be captured.');
      }
      // Mark audio as ready immediately once mic is obtained
      hasReceivedAudioRef.current = true;

      const session = createLocalSession(formData);
      setSessionData(session);
      setResumeText(formData.resume_file_path || '');

      interviewContextManager.initSession({
        sessionId: session.id,
        job_title: formData.job_title,
        company: formData.company,
        interview_round: formData.interview_round,
        experience_level: formData.experience_level,
        notes: formData.notes,
        resume_text: formData.resume_text || (session as any).resume_text || '',
      });

      const sessionContext: SessionContext = {
        sessionId: session.id,
        jobTitle: formData.job_title,
        company: formData.company,
        experienceLevel: formData.experience_level,
        interviewRound: formData.interview_round,
        streamingModel: formData.streaming_model,
        notes: formData.notes,
        resumeText: formData.resume_text || (session as any).resume_text || '',
        language: selectedLanguage,
      };

      const client = new GroqClient(
        {
          onAnswerStart: ({ source, requestId }) => {
            setPendingCopilotWork(n => n + 1);

            const isScreen = source === 'screen' || source === 'screen_capture';
            const screenshotUrl = isScreen ? currentStreamingScreenshotRef.current : null;

            // Register this stream session independently
            activeStreamsRef.current.set(requestId, {
              requestId,
              source,
              accumulatedText: '',
              screenshotUrl,
            });

            // Screen analysis ALWAYS takes foreground (deliberate user action).
            // Normal interview / manual stream takes foreground only if no screen analysis is actively foregrounded.
            const shouldBeForeground = isScreen || !isAnalyzingScreenRef.current;

            if (shouldBeForeground) {
              foregroundStreamIdRef.current = requestId;
              streamingAnswerRef.current = '';
              setCurrentStreamingAnswer('');
              if (!isScreen) {
                setCurrentStreamingScreenshot(null);
                currentStreamingScreenshotRef.current = null;
              }
            }
          },
          onAnswerChunk: ({ chunk, requestId }) => {
            const stream = activeStreamsRef.current.get(requestId);
            if (stream) {
              stream.accumulatedText += chunk;
            }

            // Only update foreground streaming UI if chunk belongs to the foreground stream
            if (requestId === foregroundStreamIdRef.current) {
              streamingAnswerRef.current = stream ? stream.accumulatedText : (streamingAnswerRef.current + chunk);
              setCurrentStreamingAnswer(streamingAnswerRef.current);
            }
          },
          onAnswer: (answer) => {
            setPendingCopilotWork(n => Math.max(0, n - 1));

            const stream = answer.requestId ? activeStreamsRef.current.get(answer.requestId) : undefined;
            const finalAnswerText = answer.answer || stream?.accumulatedText || (answer.requestId === foregroundStreamIdRef.current ? streamingAnswerRef.current : '');

            // ALWAYS commit completed answer to history, whether it was foreground or background
            if (finalAnswerText) {
              const rawSource = answer.source || stream?.source || 'manual';
              const effectiveSource = rawSource.startsWith('screen') ? 'screen' : rawSource === 'audio' ? 'audio' : 'manual';
              interviewContextManager.recordAiAnswer(finalAnswerText, effectiveSource as any);
              const finalAnswer: Answer = {
                ...answer,
                answer: finalAnswerText,
              };
              setAnswers(prev => {
                const next = [finalAnswer, ...prev];
                answersRef.current = next;
                saveAnswers(next);
                return next;
              });
            }

            // If this was the foreground stream, clear the streaming UI card
            if (answer.requestId === foregroundStreamIdRef.current) {
              setCurrentStreamingAnswer('');
              setCurrentStreamingScreenshot(null);
              streamingAnswerRef.current = '';
              foregroundStreamIdRef.current = null;
              currentStreamingScreenshotRef.current = null;
            }

            if (answer.errorCode === 'RATE_LIMIT_EXCEEDED' && answer.retryAfterSeconds) {
              const seconds = Math.max(1, Math.min(86400, Math.ceil(answer.retryAfterSeconds)));
              setAnalyzeCooldown(seconds);
              analyzeCooldownRef.current = seconds;
            }

            if (
              answer.source === 'screen' ||
              answer.source === 'screen_capture' ||
              stream?.source === 'screen' ||
              stream?.source === 'screen_capture'
            ) {
              isAnalyzingScreenRef.current = false;
              setIsAnalyzing(false);
            }

            if (answer.requestId) {
              activeStreamsRef.current.delete(answer.requestId);
            }

            refreshUser?.().catch?.(() => {});
          },
          onError: (err) => {
            setPendingCopilotWork(n => Math.max(0, n - 1));
            if (err.code === 'INSUFFICIENT_CREDITS') {
              refreshUser?.().catch?.(() => {});
            }

            if (err.code === 'RATE_LIMIT_EXCEEDED') {
              setAnalyzeCooldown(20);
              analyzeCooldownRef.current = 20;
            }

            // If error was on the foreground stream, clear UI and show toast
            if (!err.requestId || err.requestId === foregroundStreamIdRef.current) {
              toast.error(err.message || 'AI generation failed');
              setCurrentStreamingAnswer('');
              setCurrentStreamingScreenshot(null);
              streamingAnswerRef.current = '';
              foregroundStreamIdRef.current = null;
              currentStreamingScreenshotRef.current = null;
            }

            const stream = err.requestId ? activeStreamsRef.current.get(err.requestId) : undefined;
            if (
              !err.requestId ||
              stream?.source === 'screen' ||
              stream?.source === 'screen_capture'
            ) {
              isAnalyzingScreenRef.current = false;
              setIsAnalyzing(false);
            }

            if (err.requestId) {
              activeStreamsRef.current.delete(err.requestId);
            }
          },
        },
        sessionContext,
      );

      setGroqClient(client);
      setCopilotConnectionState('connected');
      setIsRecording(true);
      await waitForAudioData();
      setIsSessionStarted(true);
      setIsShowingSetup(false);
      toast.success('Session started');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start session');
      cleanupStreams();
    } finally {
      setIsStartingSession(false);
    }
  };

  // ── End session ──
  const endSession = async () => {
    if (isEndingActiveSession) return;
    setIsEndingActiveSession(true);
    toast.info('Ending session...');

    try {
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }

      // Finalize Deepgram
      const dgConn = deepgramManagerRef.current?.connection;
      if (dgConn?.isConnected()) {
        try {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 800);
            finalizeCallbackRef.current = () => {
              clearTimeout(timeout);
              setTimeout(resolve, 100);
            };
            dgConn.sendFinalize();
          });
        } catch {}
      }

      // Archive
      if (sessionData) {
        try {
          archiveSession(sessionData, transcriptRef.current, answersRef.current);
        } catch {}
      }
    } catch (err: any) {
      console.warn('[Meow] Warning during session end:', err);
    } finally {
      try { deepgramManagerRef.current?.stop(); } catch {}
      deepgramManagerRef.current = null;
      try { cleanupStreams(); } catch {}
      try { (groqClientRef.current || groqClient)?.disconnect(); } catch {}

      setIsRecording(false);
      setIsDeepgramConnected(false);
      setIsSessionStarted(false);
      setZeroCreditCountdown(null);
      interviewContextManager.destroySession();
      setTranscript([]);
      transcriptRef.current = [];
      setAnswers([]);
      answersRef.current = [];
      setSessionData(null);
      setGroqClient(null);
      setCopilotConnectionState('idle');
      setPendingCopilotWork(0);
      setCurrentStreamingAnswer('');
      setCurrentStreamingScreenshot(null);
      isAnalyzingScreenRef.current = false;
      setIsAnalyzing(false);
      foregroundStreamIdRef.current = null;
      currentStreamingScreenshotRef.current = null;
      activeStreamsRef.current.clear();
      lastFlushedQuestionRef.current = null;
      questionBuffer.current = '';
      questionStartTimeRef.current = 0;
      clearSessionData();
      try {
        await refreshUser?.();
      } catch {}
      setIsEndingActiveSession(false);
      setIsShowingSetup(false);
      toast.success('Session ended');
    }
  };

  // ── Analyze screen ──
  const analyzeScreen = async () => {
    if (isAnalyzingScreenRef.current || analyzeCooldownRef.current > 0) {
      if (analyzeCooldownRef.current > 0) {
        toast.info(`Screen analysis is rate-limited. Please wait ~${formatCooldown(analyzeCooldownRef.current)}.`);
      }
      return;
    }

    const client = groqClientRef.current || groqClient;
    if (!client) {
      toast.error('AI assistant is not ready yet');
      return;
    }

    setIsAnalyzing(true);
    isAnalyzingScreenRef.current = true;
    toast.info('Capturing screen for analysis...');

    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;

    try {
      const sources = await window.meow?.getScreenSources?.();
      const source = sources?.find((s: any) => s.isPrimary || s.id?.startsWith('screen:')) || sources?.[0];
      if (!source) throw new Error('No screen source found');

      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
          },
        } as any,
      });

      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      let targetWidth = video.videoWidth || 1920;
      let targetHeight = video.videoHeight || 1080;
      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;

      if (targetWidth > MAX_WIDTH || targetHeight > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / targetWidth, MAX_HEIGHT / targetHeight);
        targetWidth = Math.round(targetWidth * ratio);
        targetHeight = Math.round(targetHeight * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      }

      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8));
      if (!blob || blob.size > 4 * 1024 * 1024) throw new Error('Screenshot too large or failed');

      console.log(`[ScreenCapture] Captured JPEG: ${targetWidth}x${targetHeight}, ${(blob.size / 1024).toFixed(1)} KB`);

      // Revoke older object URLs to prevent Chromium memory leaks
      screenshotUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      screenshotUrlsRef.current.clear();

      const url = URL.createObjectURL(blob);
      screenshotUrlsRef.current.add(url);
      setCurrentStreamingScreenshot(url);
      currentStreamingScreenshotRef.current = url;

      const requestId = await client.sendScreenCapture(blob);
      if (requestId) {
        setAnswerScreenshots(prev => ({ ...prev, [new Date().toISOString()]: url }));
      } else {
        setIsAnalyzing(false);
        isAnalyzingScreenRef.current = false;
      }
    } catch (err: any) {
      setIsAnalyzing(false);
      isAnalyzingScreenRef.current = false;
      toast.error('Screen analysis failed: ' + (err.message || 'Unknown error'));
    } finally {
      // Explicitly detach and unload HTMLVideoElement to release Chromium Direct3D11 / MediaFoundation decoders
      if (video) {
        try {
          video.pause();
          video.srcObject = null;
          video.load();
          video.remove();
        } catch {}
      }
      if (stream) {
        try {
          stream.getTracks().forEach(t => t.stop());
        } catch {}
      }
    }
  };

  // ── Manual question ──
  const onSubmitQuestion = (question: string) => {
    const client = groqClientRef.current || groqClient;
    if (!client) return;

    const contextSnapshot = interviewContextManager.getSnapshot();
    const classification = classifyInterviewTask(question, {
      activeDiscussionThread: contextSnapshot.activeDiscussionThread,
      latestScreenObservation: contextSnapshot.current.latestScreenObservation,
      recentTurns: contextSnapshot.recentTurns,
      interviewRound: sessionData?.interview_round,
      candidateProfile: contextSnapshot.candidateFacts,
    });

    interviewContextManager.setManualQuestion(question, classification.taskType);
    const boundedContext = interviewContextManager.buildBoundedContextPayload();

    client.sendManualQuestion(question, selectedLanguage, classification, boundedContext);
  };

  // ── Generate answer (manual trigger when auto-answer off) ──
  const generateAnswer = () => {
    const client = groqClientRef.current || groqClient;
    const recent = transcriptRef.current
      .filter(e => e.is_final && e.speaker === 'interviewer')
      .slice(-3)
      .map(e => e.text)
      .join(' ');
    if (recent && client) {
      const contextSnapshot = interviewContextManager.getSnapshot();
      const classification = classifyInterviewTask(recent, {
        activeDiscussionThread: contextSnapshot.activeDiscussionThread,
        latestScreenObservation: contextSnapshot.current.latestScreenObservation,
        recentTurns: contextSnapshot.recentTurns,
        interviewRound: sessionData?.interview_round,
        candidateProfile: contextSnapshot.candidateFacts,
      });
      const boundedContext = interviewContextManager.buildBoundedContextPayload();
      client.sendTranscript(recent, false, 'manual', selectedLanguage, classification, boundedContext);
    }
  };

  // ── In-Session 0-Credit Monitor & Immediate Voice Cutoff ──
  useEffect(() => {
    if (!isSessionStarted) {
      if (zeroCreditCountdown !== null) setZeroCreditCountdown(null);
      return;
    }

    if (hasZeroCredits) {
      if (zeroCreditCountdown === null) {
        // Start 60-second countdown
        setZeroCreditCountdown(60);
        // Cut off microphone immediately
        setIsMicEnabled(false);
        micStream?.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
        toast.warning(
          '0 Credits Remaining',
          'Microphone disabled. Session will end in 1 minute unless credits are added.',
          {
            label: 'Buy Credits',
            onClick: () => setIsPurchaseModalOpen(true),
          }
        );
      }
    } else {
      if (zeroCreditCountdown !== null) {
        // User added credits during countdown! Recover session
        setZeroCreditCountdown(null);
        setIsMicEnabled(true);
        micStream?.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        toast.success('Credits Added', 'Voice capture restored. You can continue your session.');
      }
    }
  }, [isSessionStarted, hasZeroCredits, zeroCreditCountdown, micStream, toast]);

  // ── In-Session 0-Credit 1-Minute Countdown & Auto-End ──
  useEffect(() => {
    if (!isSessionStarted || zeroCreditCountdown === null) return;

    if (zeroCreditCountdown <= 0) {
      endSession();
      setZeroCreditCountdown(null);
      toast.error(
        'Session Ended',
        'Session automatically ended because your account has 0 credits.',
        {
          label: 'Buy Credits',
          onClick: () => setIsPurchaseModalOpen(true),
        }
      );
      setIsPurchaseModalOpen(true);
      return;
    }

    const timer = setInterval(() => {
      setZeroCreditCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isSessionStarted, zeroCreditCountdown, endSession, toast]);

  // ── Periodic Credit Balance Check During Session ──
  useEffect(() => {
    if (!isSessionStarted) return;
    const interval = setInterval(() => {
      refreshUser?.().catch?.(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, [isSessionStarted, refreshUser]);

  // ── Toggle mic ──
  const toggleMic = () => {
    if (zeroCreditCountdown !== null) {
      toast.warning('Microphone Disabled', 'You have 0 credits. Buy credits to resume voice capture.', {
        label: 'Buy Credits',
        onClick: () => setIsPurchaseModalOpen(true),
      });
      return;
    }
    const next = !isMicEnabled;
    setIsMicEnabled(next);
    micStream?.getAudioTracks().forEach(t => { t.enabled = next; });
  };

  // ── Render ──
  if (isLoading) {
    return (
      <div className="auth-container" data-window-interactive="true">
        <div style={{ color: '#38bdf8', fontSize: '14px', fontWeight: 600 }}>
          Loading Meoow session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="app-container">
      <Header
        onStart={() => {
          if (hasZeroCredits) {
            toast.error('You have 0 credits so buy it', 'Please purchase credits to start an interview session.', {
              label: 'Buy Credits',
              onClick: () => setIsPurchaseModalOpen(true),
            });
            setIsPurchaseModalOpen(true);
            return;
          }
          setIsShowingSetup(prev => !prev);
        }}
        isShowingSetup={isShowingSetup}
        isStartingSession={isStartingSession}
        onStartInterview={() => {
          if (hasZeroCredits) {
            toast.error('You have 0 credits so buy it', 'Please purchase credits to start an interview session.', {
              label: 'Buy Credits',
              onClick: () => setIsPurchaseModalOpen(true),
            });
            setIsPurchaseModalOpen(true);
            return;
          }
          setIsShowingSetup(true);
        }}
        onCancelSetup={() => setIsShowingSetup(false)}
        isSessionStarted={isSessionStarted}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        autoAnswer={autoAnswer}
        onAutoAnswerChange={setAutoAnswer}
        canGenerateAnswer={!!groqClient}
        onGenerateAnswer={generateAnswer}
        copilotConnectionState={copilotConnectionState}
        pendingCopilotWork={pendingCopilotWork}
        onReconnectCopilot={() => {}}
        onEnd={endSession}
        onAnalyzeScreen={analyzeScreen}
        isAnalyzing={isAnalyzing}
        analyzeCooldown={analyzeCooldown}
        isMicEnabled={isMicEnabled}
        onToggleMic={toggleMic}
        isPurchaseModalOpen={isPurchaseModalOpen}
        onOpenPurchaseModal={() => setIsPurchaseModalOpen(true)}
        onClosePurchaseModal={() => setIsPurchaseModalOpen(false)}
        zeroCreditCountdown={zeroCreditCountdown}
      />

      {!isProtectionSupported && (
        <div className="protection-warning" data-window-interactive="true">
          ⚠️ Screen capture protection is not supported on this system. The app window may be visible in screen recordings.
        </div>
      )}

      {isShowingSetup && !isSessionStarted && (
        <SessionSetup
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          autoAnswer={autoAnswer}
          onAutoAnswerChange={setAutoAnswer}
          onSubmit={handleStartSession}
          onCancel={() => setIsShowingSetup(false)}
          isStarting={isStartingSession}
          hasZeroCredits={hasZeroCredits}
          onOpenBuyCredits={() => setIsPurchaseModalOpen(true)}
        />
      )}

      {isSessionStarted && (
        <div className="panels-container" data-window-interactive="true">
          <AnswersPanel
            isSessionStarted={isSessionStarted}
            answers={answers}
            answerScreenshots={answerScreenshots}
            currentStreamingAnswer={currentStreamingAnswer}
            currentStreamingScreenshot={currentStreamingScreenshot}
            autoAnswer={autoAnswer}
            canGenerateAnswer={!!groqClient}
            onAutoAnswerChange={setAutoAnswer}
            onGenerateAnswer={generateAnswer}
            onSubmitQuestion={onSubmitQuestion}
          />
          <TranscriptPanel
            isSessionStarted={isSessionStarted}
            transcript={transcript}
            onManualQuestion={onSubmitQuestion}
          />
        </div>
      )}

      <DeviceLimitModal
        isOpen={deviceLimitExceeded}
        activeDevices={activeDevices}
        maxDevices={maxDevices}
        onDeviceReplaced={() => {
          syncDevice();
        }}
        onLogout={() => {
          logout();
        }}
      />

      {/* ToastViewport is rendered by ToastProvider */}
    </div>
  );
}

// ── Root export ──
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MeowApp />
      </ToastProvider>
    </AuthProvider>
  );
}
