import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import { SessionSetup } from './components/SessionSetup';
import { AnswersPanel } from './components/AnswersPanel';
import { TranscriptPanel } from './components/TranscriptPanel';
import { ToastProvider, useToast } from './components/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { GroqClient } from './services/groqClient';
import { createDeepgramManager, type DeepgramMessageEvent } from './services/deepgramClient';
import {
  createSession as createLocalSession,
  saveAnswers,
  clearSessionData,
  archiveSession,
  saveFeedback,
} from './services/sessionManager';
import { setupClickThrough } from './utils/clickThrough';
import {
  isFillerOnlyTranscript,
  buildQuestionSignature,
  findDuplicates,
  isCrossTalkDuplicate,
  saveTranscript,
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

// ── Constants (optimized for instant ~1s human turnaround) ──
const AUDIO_FIRST_DATA_TIMEOUT = 15_000;
const UTTERANCE_END_MS = 400;
const QUESTION_DEBOUNCE_MS = 600;
const UTTERANCE_END_DELAY = 100;
const FINALIZE_TIMEOUT = 800;
const FINALIZE_DRAIN = 100;

// ── Inner app component (uses toast context) ──
function MeowApp() {
  const toast = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // ── State ──
  const [isSessionStarted, setIsSessionStarted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const answersRef = useRef<Answer[]>([]);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [isShowingSetup, setIsShowingSetup] = useState(true);
  const [isStartingSession, setIsStartingSession] = useState(false);
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

  // ── Refs ──
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
    questionBuffer.current = '';
    if (!text || isFillerOnlyTranscript(text)) return;

    const signature = buildQuestionSignature(text);
    if (signature === lastQuestionSignatureRef.current) return;
    lastQuestionSignatureRef.current = signature;

    recentQuestionsRef.current.push({ text, createdAt: Date.now() });
    if (recentQuestionsRef.current.length > 4) recentQuestionsRef.current.shift();

    // Build context from recent transcript
    const recentTranscript = transcriptRef.current
      .filter(e => e.is_final)
      .slice(-6)
      .map(e => `${e.speaker === 'user' ? 'Candidate' : 'Interviewer'}: ${e.text}`)
      .join('\n');

    const fullContext = recentTranscript ? `${recentTranscript}\n\nInterviewer's question: ${text}` : text;

    if (autoAnswerRef.current && groqClientRef.current) {
      groqClientRef.current.sendTranscript(fullContext, true, 'auto', selectedLanguage);
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
            // If punctuation present, trigger flush immediately; else short delay
            if (/[?.!]$/.test(buf)) {
              flushQuestion();
            } else {
              scheduleQuestionFlush(UTTERANCE_END_DELAY);
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
              if (isFinal) {
                questionBuffer.current = (questionBuffer.current + ' ' + text).trim();
              }
              const currentQ = questionBuffer.current.trim();
              if (speechFinal && /[?.!]$/.test(currentQ)) {
                flushQuestion();
              } else {
                scheduleQuestionFlush(QUESTION_DEBOUNCE_MS);
              }
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
      if (isSessionStarted) analyzeScreen();
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
          onAnswerStart: ({ requestId }) => {
            setPendingCopilotWork(n => n + 1);
            streamingAnswerRef.current = '';
          },
          onAnswerChunk: ({ chunk }) => {
            streamingAnswerRef.current += chunk;
            setCurrentStreamingAnswer(streamingAnswerRef.current);
          },
          onAnswer: (answer) => {
            setPendingCopilotWork(n => Math.max(0, n - 1));
            const finalAnswerText = answer.answer || streamingAnswerRef.current;
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
            setCurrentStreamingAnswer('');
            setCurrentStreamingScreenshot(null);
            streamingAnswerRef.current = '';
          },
          onError: (err) => {
            setPendingCopilotWork(n => Math.max(0, n - 1));
            toast.error(err.message || 'AI generation failed');
            setCurrentStreamingAnswer('');
            streamingAnswerRef.current = '';
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
      clearSessionData();
      setIsEndingActiveSession(false);
      setIsShowingSetup(true);
      toast.success('Session ended');
    }
  };

  // ── Analyze screen ──
  const analyzeScreen = async () => {
    const client = groqClientRef.current || groqClient;
    if (!client) {
      toast.error('AI assistant is not ready yet');
      return;
    }
    toast.info('Capturing screen for analysis...');
    try {
      const sources = await window.meow?.getScreenSources?.();
      const source = sources?.find((s: any) => s.isPrimary || s.id?.startsWith('screen:')) || sources?.[0];
      if (!source) throw new Error('No screen source found');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
          },
        } as any,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());

      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8));
      if (!blob || blob.size > 4 * 1024 * 1024) throw new Error('Screenshot too large or failed');

      const url = URL.createObjectURL(blob);
      screenshotUrlsRef.current.add(url);
      setCurrentStreamingScreenshot(url);

      const requestId = await client.sendScreenCapture(blob);
      if (requestId) {
        setAnswerScreenshots(prev => ({ ...prev, [new Date().toISOString()]: url }));
      }
    } catch (err: any) {
      toast.error('Screen analysis failed: ' + (err.message || 'Unknown error'));
    }
  };

  // ── Manual question ──
  const onSubmitQuestion = (question: string) => {
    groqClient?.sendManualQuestion(question, selectedLanguage);
  };

  // ── Generate answer (manual trigger when auto-answer off) ──
  const generateAnswer = () => {
    const recent = transcriptRef.current
      .filter(e => e.is_final && e.speaker === 'interviewer')
      .slice(-3)
      .map(e => e.text)
      .join(' ');
    if (recent && groqClient) {
      groqClient.sendTranscript(recent, false, 'manual', selectedLanguage);
    }
  };

  // ── Toggle mic ──
  const toggleMic = () => {
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
        onStart={() => setIsShowingSetup(prev => !prev)}
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
        isMicEnabled={isMicEnabled}
        onToggleMic={toggleMic}
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
