/**
 * AudioWorklet processor for system audio capture.
 *
 * Runs on a dedicated audio rendering thread (not the main JS thread), so it
 * is not subject to the same scheduling jitter and deprecation issues as the
 * old ScriptProcessorNode approach.
 *
 * The processor receives raw PCM Float32 frames from the Web Audio graph and
 * forwards them to the main thread via MessagePort. The main thread
 * (capture.html) then relays the samples to the renderer window via IPC.
 *
 * process() must return true to keep the node alive.
 */
class PCMCaptureProcessor extends AudioWorkletProcessor {
  /**
   * @param {AudioWorkletNodeOptions} options
   */
  constructor(options) {
    super(options);
    // Allow the main thread to shut us down gracefully
    this.port.onmessage = (event) => {
      if (event.data === "stop") {
        this._stopped = true;
      }
    };
    this._stopped = false;
  }

  /**
   * Called by the audio engine for every render quantum (~128 frames at 48 kHz).
   * We transfer the buffer (zero-copy) to avoid GC pressure.
   *
   * @param {Float32Array[][]} inputs  - [[channel0, channel1, ...], ...]
   * @returns {boolean} true = keep alive
   */
  process(inputs) {
    if (this._stopped) return false;

    const channel = inputs[0]?.[0]; // first input, first (mono) channel
    if (channel && channel.length > 0) {
      // Transfer the buffer to avoid copying — the worklet gets a fresh
      // buffer each quantum so this is safe.
      const copy = channel.slice(); // slice gives a new ArrayBuffer we own
      this.port.postMessage(copy.buffer, [copy.buffer]);
    }

    return true; // keep the node alive
  }
}

registerProcessor("pcm-capture", PCMCaptureProcessor);
