/**
 * Audio merger: combines mic (channel 0) and loopback (channel 1)
 * into a single 2-channel MediaStream for Deepgram multichannel transcription.
 *
 * Port of original bundle lines 9076-9111.
 */

export interface AudioMergerResult {
  stream: MediaStream;
  cleanup: () => void;
}

export interface VadRefs {
  micActive: { current: boolean };
  loopbackActive: { current: boolean };
}

export function createAudioMerger(
  micStream: MediaStream | null,
  loopbackStream: MediaStream | null,
  vadRefs: VadRefs
): AudioMergerResult | null {
  if (!micStream && !loopbackStream) return null;

  const ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch((err) => console.warn('[AudioMerger] AudioContext resume failed:', err));
  }
  ctx.addEventListener('statechange', () => {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  });

  const destination = ctx.createMediaStreamDestination();
  destination.channelCount = 2;
  destination.channelCountMode = 'explicit';
  const merger = ctx.createChannelMerger(2);
  const cleanups: Array<() => void> = [];

  const createVadMonitor = (
    sourceNode: MediaStreamAudioSourceNode,
    activeRef: { current: boolean },
    threshold = 10,
    silenceTimeout = 400
  ): (() => void) => {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    sourceNode.connect(analyser);

    const binCount = analyser.frequencyBinCount;
    const data = new Uint8Array(binCount);
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId = 0;
    let stopped = false;

    const setActive = (active: boolean) => {
      if (activeRef.current !== active) {
        activeRef.current = active;
      }
    };

    const loop = () => {
      if (stopped || ctx.state === 'closed') return;
      analyser.getByteFrequencyData(data);

      let sum = 0;
      for (let i = 0; i < binCount; i++) sum += data[i];

      if (sum / binCount > threshold) {
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
        setActive(true);
      } else if (activeRef.current && !silenceTimer) {
        silenceTimer = setTimeout(() => {
          setActive(false);
          silenceTimer = null;
        }, silenceTimeout);
      }

      rafId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      if (silenceTimer) clearTimeout(silenceTimer);
      setActive(false);
      analyser.disconnect();
    };
  };

  if (micStream) {
    const source = ctx.createMediaStreamSource(micStream);
    source.connect(merger, 0, 0);
    cleanups.push(createVadMonitor(source, vadRefs.micActive, 10, 400));
  }

  if (loopbackStream) {
    const source = ctx.createMediaStreamSource(loopbackStream);
    source.connect(merger, 0, 1);
    cleanups.push(createVadMonitor(source, vadRefs.loopbackActive, 10, 400));
  }

  merger.connect(destination);

  return {
    stream: destination.stream,
    cleanup: () => {
      cleanups.forEach((fn) => fn());
      ctx.close();
    },
  };
}

