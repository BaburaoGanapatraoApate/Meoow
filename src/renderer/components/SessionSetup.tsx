import React, { useState, useRef, useEffect } from 'react';
import { LANGUAGES } from '../utils/languages';

const INTERVIEW_ROUNDS = [
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

const GROQ_MODELS = [
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', fast: true },
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', fast: true },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', fast: false },
  { id: 'groq/compound-mini', name: 'Compound Mini', fast: true },
  { id: 'groq/compound', name: 'Compound', fast: false },
];

const MAX_NOTES_LENGTH = 10000;

export interface SessionConfig {
  job_title: string;
  company: string;
  interview_type: string;
  interview_round: string;
  streaming_model: string;
  experience_level: string;
  resume_file_path: string;
  resume_text: string;
  notes: string;
  mic_device_id?: string;
}

interface SessionSetupProps {
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  autoAnswer: boolean;
  onAutoAnswerChange: (val: boolean) => void;
  onSubmit: (config: SessionConfig) => void;
  onCancel: () => void;
  isStarting: boolean;
}

export const SessionSetup: React.FC<SessionSetupProps> = ({
  selectedLanguage,
  onLanguageChange,
  autoAnswer,
  onAutoAnswerChange,
  onSubmit,
  onCancel,
  isStarting,
}) => {
  const [config, setConfig] = useState<SessionConfig>({
    job_title: '',
    company: '',
    interview_type: 'copilot',
    interview_round: 'general',
    streaming_model: 'qwen/qwen3.8-27b',
    experience_level: 'mid',
    resume_file_path: '',
    resume_text: '',
    notes: '',
  });

  const [titleError, setTitleError] = useState('');
  const [notesError, setNotesError] = useState('');
  const [resumeError, setResumeError] = useState('');
  const [isParsingResume, setIsParsingResume] = useState(false);

  // Audio input devices & live volume testing
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(() => {
    return localStorage.getItem('meow-selected-mic-id') || 'default';
  });
  const [micVolume, setMicVolume] = useState(0);

  // Enumerate audio input devices & auto-detect headphones
  useEffect(() => {
    let active = true;

    const refreshDevices = async () => {
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        let audioInputs = devices.filter(d => d.kind === 'audioinput');

        // If labels are blank, request permission briefly to get labels
        if (audioInputs.length > 0 && !audioInputs[0].label) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            devices = await navigator.mediaDevices.enumerateDevices();
            audioInputs = devices.filter(d => d.kind === 'audioinput');
          } catch (_) {}
        }

        if (!active) return;
        setAudioDevices(audioInputs);

        // Auto-select headphone / headset mic if available and not explicitly customized
        const savedId = localStorage.getItem('meow-selected-mic-id');
        if (!savedId || savedId === 'default' || !audioInputs.some(d => d.deviceId === savedId)) {
          const headsetDevice = audioInputs.find(d => {
            const lbl = (d.label || '').toLowerCase();
            return (
              lbl.includes('headset') ||
              lbl.includes('headphone') ||
              lbl.includes('earphone') ||
              lbl.includes('airpods') ||
              lbl.includes('bluetooth') ||
              lbl.includes('usb') ||
              lbl.includes('external')
            );
          });
          if (headsetDevice) {
            setSelectedMicId(headsetDevice.deviceId);
            localStorage.setItem('meow-selected-mic-id', headsetDevice.deviceId);
          }
        }
      } catch (err) {
        console.warn('[SessionSetup] Error enumerating devices:', err);
      }
    };

    refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
    };
  }, []);

  // Live mic volume test
  useEffect(() => {
    if (isStarting) return;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let animId: number | null = null;
    let stopped = false;

    const startMonitor = async () => {
      try {
        const constraints: MediaStreamConstraints =
          selectedMicId && selectedMicId !== 'default'
            ? { audio: { deviceId: { exact: selectedMicId } } }
            : { audio: true };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stopped) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume().catch(() => {});
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const update = () => {
          if (stopped) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 64) * 100));
          setMicVolume(level);
          animId = requestAnimationFrame(update);
        };
        update();
      } catch (_) {
        // Ignore test errors
      }
    };

    startMonitor();

    return () => {
      stopped = true;
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
      setMicVolume(0);
    };
  }, [selectedMicId, isStarting]);

  const updateConfig = (key: keyof SessionConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    if (key === 'job_title' && value.trim()) setTitleError('');
    if (key === 'notes') setNotesError('');
  };

  const handlePickResume = async () => {
    setResumeError('');
    if (!window.meow?.pickResumeFile) {
      setResumeError('Resume picking not available');
      return;
    }

    setIsParsingResume(true);
    try {
      const result = await window.meow.pickResumeFile();
      if (result) {
        setConfig(prev => ({
          ...prev,
          resume_file_path: result.filePath || '',
          resume_text: result.text || '',
        }));
      }
    } catch (err: any) {
      setResumeError(err.message || 'Failed to parse resume');
    } finally {
      setIsParsingResume(false);
    }
  };

  const clearResume = () => {
    setConfig(prev => ({
      ...prev,
      resume_file_path: '',
      resume_text: '',
    }));
    setResumeError('');
  };

  const handleMicChange = (deviceId: string) => {
    setSelectedMicId(deviceId);
    localStorage.setItem('meow-selected-mic-id', deviceId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = config.job_title.trim();
    if (!title) {
      setTitleError('Job title is required');
      return;
    }

    if ((config.notes?.length ?? 0) > MAX_NOTES_LENGTH) {
      setNotesError(`Notes cannot exceed ${MAX_NOTES_LENGTH.toLocaleString()} characters`);
      return;
    }

    localStorage.setItem('meow-selected-mic-id', selectedMicId);

    onSubmit({
      job_title: title,
      company: config.company.trim(),
      interview_type: 'copilot',
      interview_round: config.interview_round,
      streaming_model: config.streaming_model,
      experience_level: config.experience_level,
      resume_file_path: config.resume_file_path.trim(),
      resume_text: config.resume_text.trim(),
      notes: config.notes.trim(),
      mic_device_id: selectedMicId !== 'default' ? selectedMicId : undefined,
    });
  };

  const selectedModelInfo = GROQ_MODELS.find(m => m.id === config.streaming_model);

  return (
    <section className="session-setup-panel" data-window-interactive="true">
      <div className="session-setup-header">
        <div>
          <h2 className="session-setup-title">Configure Your Session</h2>
          <p className="session-setup-subtitle">Set up your personalized interview assistant</p>
        </div>
      </div>

      <form className="session-setup-form" onSubmit={handleSubmit}>
        <div className="session-setup-grid">
          <label className="session-setup-field">
            <span>Job Title *</span>
            <input
              type="text"
              value={config.job_title}
              onChange={e => updateConfig('job_title', e.target.value)}
              placeholder="e.g., Senior Frontend Engineer"
              disabled={isStarting}
              autoFocus
            />
            {titleError && <small className="session-setup-error">{titleError}</small>}
          </label>

          <label className="session-setup-field">
            <span>Company</span>
            <input
              type="text"
              value={config.company}
              onChange={e => updateConfig('company', e.target.value)}
              placeholder="e.g., Google"
              disabled={isStarting}
            />
          </label>

          <label className="session-setup-field">
            <span>Experience Level</span>
            <select
              value={config.experience_level}
              onChange={e => updateConfig('experience_level', e.target.value)}
              disabled={isStarting}
            >
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior Level</option>
            </select>
          </label>

          <label className="session-setup-field">
            <span>Interview Round</span>
            <select
              value={config.interview_round}
              onChange={e => updateConfig('interview_round', e.target.value)}
              disabled={isStarting}
            >
              {INTERVIEW_ROUNDS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          <label className="session-setup-field">
            <span>AI Model</span>
            <span className="model-select-wrapper">
              <select
                value={config.streaming_model}
                onChange={e => updateConfig('streaming_model', e.target.value)}
                disabled={isStarting}
              >
                {GROQ_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {selectedModelInfo?.fast && (
                <span className="model-select-options">Fast</span>
              )}
            </span>
          </label>

          <label className="session-setup-field">
            <span>Language</span>
            <select
              value={selectedLanguage}
              onChange={e => onLanguageChange(e.target.value)}
              disabled={isStarting}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>

          <div className="session-setup-field session-setup-mic-field">
            <span className="session-setup-label-row">
              <span>Microphone</span>
              <small style={{ color: micVolume > 8 ? '#10b981' : '#9ca3af', fontWeight: 600 }}>
                {micVolume > 8 ? `● Mic Signal ${micVolume}%` : 'Speak to test'}
              </small>
            </span>
            <select
              value={selectedMicId}
              onChange={e => handleMicChange(e.target.value)}
              disabled={isStarting}
            >
              <option value="default">Default (System Default)</option>
              {audioDevices.map(d => {
                const isHeadset = /headset|headphone|earphone|airpods|bluetooth|usb|external/i.test(d.label);
                return (
                  <option key={d.deviceId} value={d.deviceId}>
                    {isHeadset ? `🎧 ${d.label || 'Headset Microphone'}` : `🎙️ ${d.label || 'Microphone'}`}
                  </option>
                );
              })}
            </select>
            <div
              style={{
                width: '100%',
                height: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '3px',
                overflow: 'hidden',
                marginTop: '4px',
              }}
              title="Live microphone input meter"
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(micVolume > 0 ? 5 : 0, micVolume)}%`,
                  backgroundColor: micVolume > 8 ? '#10b981' : 'rgba(255, 255, 255, 0.3)',
                  transition: 'width 0.08s ease-out, background-color 0.15s ease',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>
        </div>

        <div className="session-setup-stack">
          <label className="session-setup-field auto-answer-field">
            <span>Auto Answer</span>
            <div className="session-setup-toggle-field">
              <div>
                <small className="session-setup-muted">
                  Detect and generate answers automatically after each question
                </small>
              </div>
              <input
                type="checkbox"
                checked={autoAnswer}
                onChange={e => onAutoAnswerChange(e.target.checked)}
                disabled={isStarting}
              />
            </div>
          </label>
        </div>

        <div className="session-setup-field">
          <div className="session-setup-resume-section">
            <span className="session-setup-resume-label">Resume</span>
            <div className="session-setup-file-picker">
              <button
                type="button"
                className="session-setup-secondary-button"
                onClick={handlePickResume}
                disabled={isStarting || isParsingResume}
              >
                {isParsingResume
                  ? 'Parsing...'
                  : config.resume_file_path
                  ? 'Change Resume'
                  : 'Choose Resume (PDF, DOCX, TXT)'}
              </button>
              {config.resume_file_path && (
                <>
                  <span className="session-setup-file-value" title={config.resume_file_path}>
                    {config.resume_file_path.split(/[\\/]/).pop()}
                  </span>
                  <button
                    type="button"
                    className="session-setup-ghost-button"
                    onClick={clearResume}
                    disabled={isStarting || isParsingResume}
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
            {resumeError && <small className="session-setup-error">{resumeError}</small>}
            {config.resume_text && (
              <small className="session-setup-muted">
                Resume loaded ({config.resume_text.length.toLocaleString()} characters)
              </small>
            )}
          </div>
        </div>

        <label className="session-setup-field">
          <span className="session-setup-label-row">
            <span>Session Notes</span>
            <small className="session-setup-character-count">
              {(config.notes?.length ?? 0).toLocaleString()} / {MAX_NOTES_LENGTH.toLocaleString()}
            </small>
          </span>
          <textarea
            value={config.notes}
            onChange={e => updateConfig('notes', e.target.value)}
            placeholder="Paste the job description, focus areas, or anything Meow should keep in mind."
            disabled={isStarting}
            maxLength={MAX_NOTES_LENGTH}
            rows={4}
          />
          {notesError && <small className="session-setup-error">{notesError}</small>}
        </label>

        <div className="session-setup-actions">
          <button
            type="button"
            className="session-setup-secondary-button"
            onClick={onCancel}
            disabled={isStarting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="session-setup-primary-button"
            disabled={isStarting || isParsingResume}
          >
            {isStarting ? 'Starting...' : 'Start Session'}
          </button>
        </div>
      </form>
    </section>
  );
};
