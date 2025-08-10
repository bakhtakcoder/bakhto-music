import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare global { interface Window { lamejs?: any; Lame?: any } }

export type EffectId =
  | "clean"
  | "bass_boost"
  | "nightcore"
  | "lofi"
  | "echo_chamber"
  | "reverb_htrk"
  | "surround"
  | "vinyl_crackle"
  | "pitch_shift"
  | "slow_reverb"
  | "crystalizer"
  | "trap_bass"
  | "reverse"
  | "vaporwave"
  | "chiptune"
  | "tremolo"
  | "flanger"
  | "chorus"
  | "stereo_widen";

export type EffectParams = {
  intensity: number; // 0..1
  depth: number; // 0..1
  speed: number; // 0..1
  tone: number; // 0..1
};

export type HistoryItem = {
  id: string;
  name: string;
  effect: EffectId;
  params: EffectParams;
  date: string;
  mp3?: string; // base64 data URL (limited to last few)
};

const DEFAULT_PARAMS: EffectParams = {
  intensity: 0.6,
  depth: 0.5,
  speed: 0.5,
  tone: 0.5,
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function generateImpulse(ctx: BaseAudioContext, seconds = 3, decay = 2) {
  const rate = ctx.sampleRate;
  const length = rate * seconds;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const channelData = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function createBitcrusherNode(ctx: AudioContext, bits = 8, normFreq = 0.1) {
  // Simple ScriptProcessor-based bitcrusher (adequate for preview)
  const node = ctx.createScriptProcessor(4096, 1, 1);
  let phaser = 0;
  let last = 0;
  const step = Math.pow(0.5, bits);
  node.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) {
      phaser += normFreq;
      if (phaser >= 1.0) {
        phaser -= 1.0;
        last = step * Math.floor(input[i] / step + 0.5);
      }
      output[i] = last;
    }
  };
  return node;
}

export function useAudioEngine() {
  const [ctx, setCtx] = useState<AudioContext | null>(null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [name, setName] = useState<string>("");

  const [effect, setEffect] = useState<EffectId>("clean");
  const [params, setParams] = useState<EffectParams>(DEFAULT_PARAMS);

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<PannerNode | StereoPannerNode | null>(null);
  const tremoloOscRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem("bakhtak-history");
      return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("bakhtak-history", JSON.stringify(history.slice(0, 8)));
  }, [history]);

  const ensureCtx = useCallback(() => {
    if (!ctx) {
      const newCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setCtx(newCtx);
      return newCtx;
    }
    return ctx;
  }, [ctx]);

  const setupGraph = useCallback(
    (context: AudioContext, buffer: AudioBuffer) => {
      // Cleanup existing
      try { sourceRef.current?.stop(); } catch {}
      sourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      outputGainRef.current?.disconnect();
      pannerRef.current?.disconnect();
      tremoloOscRef.current?.stop();
      tremoloOscRef.current?.disconnect();
      lfoGainRef.current?.disconnect();

      const src = context.createBufferSource();
      src.buffer = buffer;

      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;

      const outputGain = context.createGain();
      outputGain.gain.value = 0.95;

      // Build effect chain per current selection
      let node: AudioNode = src;

      const mapToneFreq = (t: number) => 100 + t * t * 10000; // 100..10k roughly
      const mapSpeed = (s: number) => 0.5 + s * 1.5; // 0.5..2.0x

      switch (effect) {
        case "clean": {
          // no-op
          break;
        }
        case "bass_boost": {
          const biq = context.createBiquadFilter();
          biq.type = "lowshelf";
          biq.frequency.value = 200;
          biq.gain.value = 5 + params.intensity * 18; // +5..+23 dB
          node.connect(biq); node = biq;
          break;
        }
        case "nightcore": {
          src.playbackRate.value = mapSpeed(0.7 + params.speed * 0.3); // 1.2..2.0
          const hp = context.createBiquadFilter();
          hp.type = "highpass";
          hp.frequency.value = 150 + params.tone * 1000;
          node.connect(hp); node = hp;
          break;
        }
        case "lofi": {
          const crusher = createBitcrusherNode(context, 6 + Math.round(params.intensity * 4), 0.05 + params.depth * 0.15);
          const lp = context.createBiquadFilter();
          lp.type = "lowpass";
          lp.frequency.value = 2000 - params.tone * 1500;
          node.connect(crusher); crusher.connect(lp); node = lp;
          break;
        }
        case "echo_chamber": {
          const delay = context.createDelay(1.2);
          delay.delayTime.value = 0.25 + params.speed * 0.7; // 0.25..0.95s
          const fb = context.createGain();
          fb.gain.value = 0.2 + params.intensity * 0.75;
          node.connect(delay);
          delay.connect(fb); fb.connect(delay);
          node = delay;
          break;
        }
        case "reverb_htrk": {
          const conv = context.createConvolver();
          conv.buffer = generateImpulse(context, 4 + params.depth * 4, 2.5);
          node.connect(conv); node = conv;
          break;
        }
        case "surround": {
          const panner = context.createStereoPanner();
          panner.pan.value = -1 + params.depth * 2; // -1..1
          pannerRef.current = panner;
          node.connect(panner); node = panner;
          break;
        }
        case "vinyl_crackle": {
          const noise = context.createBufferSource();
          const noiseBuf = context.createBuffer(1, buffer.length, context.sampleRate);
          const data = noiseBuf.getChannelData(0);
          for (let i = 0; i < data.length; i += Math.floor(200 + Math.random() * 4000)) {
            data[i] = (Math.random() * 2 - 1) * (0.2 + params.intensity * 0.5);
          }
          noise.buffer = noiseBuf;
          noise.loop = true;
          const mix = context.createGain();
          mix.gain.value = 0.05 + 0.15 * params.depth;
          noise.connect(mix);
          mix.connect(context.destination); // bleed to output lightly
          noise.start();
          const lp = context.createBiquadFilter();
          lp.type = "lowpass"; lp.frequency.value = 8000 - params.tone * 5000;
          node.connect(lp); node = lp;
          break;
        }
        case "pitch_shift": {
          src.playbackRate.value = 0.8 + params.intensity * 1.4; // approx pitch/time together
          node = node; // no extra nodes
          break;
        }
        case "slow_reverb": {
          src.playbackRate.value = 0.7 + params.speed * 0.2;
          const conv = context.createConvolver();
          conv.buffer = generateImpulse(context, 6 + params.depth * 6, 3);
          node.connect(conv); node = conv;
          break;
        }
        case "crystalizer": {
          const crusher = createBitcrusherNode(context, 4 + Math.round(params.intensity * 4), 0.2);
          const hp = context.createBiquadFilter();
          hp.type = "highpass"; hp.frequency.value = 1000 + params.tone * 4000;
          node.connect(crusher); crusher.connect(hp); node = hp;
          break;
        }
        case "trap_bass": {
          const shelf = context.createBiquadFilter();
          shelf.type = "lowshelf"; shelf.frequency.value = 90; shelf.gain.value = 8 + params.intensity * 18;
          const comp = context.createDynamicsCompressor();
          comp.threshold.value = -30; comp.knee.value = 20; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.25;
          node.connect(shelf); shelf.connect(comp); node = comp;
          break;
        }
        case "reverse": {
          // Preview plays normal; offline export will reverse
          break;
        }
        case "vaporwave": {
          src.playbackRate.value = 0.8 - params.speed * 0.2; // slower
          const conv = context.createConvolver(); conv.buffer = generateImpulse(context, 5, 2.2);
          node.connect(conv); node = conv;
          break;
        }
        case "chiptune": {
          const crusher = createBitcrusherNode(context, 3 + Math.round(params.intensity * 3), 0.25 + params.depth * 0.3);
          const hp = context.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200 + params.tone * 4000;
          node.connect(crusher); crusher.connect(hp); node = hp;
          break;
        }
        case "tremolo": {
          const vca = context.createGain(); vca.gain.value = 1;
          const lfo = context.createOscillator();
          const lfoGain = context.createGain(); lfoGain.gain.value = params.intensity * 0.8; // depth
          lfo.type = "sine"; lfo.frequency.value = 2 + params.speed * 10;
          lfo.connect(lfoGain); lfoGain.connect(vca.gain);
          lfo.start();
          tremoloOscRef.current = lfo; lfoGainRef.current = lfoGain;
          node.connect(vca); node = vca;
          break;
        }
        case "flanger": {
          const delay = context.createDelay(0.02);
          const lfo = context.createOscillator();
          const lfoGain = context.createGain();
          delay.delayTime.value = 0.003;
          lfo.type = "sine"; lfo.frequency.value = 0.1 + params.speed * 1.2;
          lfoGain.gain.value = 0.0005 + params.depth * 0.004; // 0.5..4.5ms
          lfo.connect(lfoGain); lfoGain.connect(delay.delayTime); lfo.start();
          const fb = context.createGain(); fb.gain.value = 0.2 + params.intensity * 0.6;
          node.connect(delay); delay.connect(fb); fb.connect(delay);
          tremoloOscRef.current = lfo; lfoGainRef.current = lfoGain;
          node = delay;
          break;
        }
        case "chorus": {
          const delay1 = context.createDelay(0.03);
          const delay2 = context.createDelay(0.03);
          const lfo1 = context.createOscillator(); const g1 = context.createGain();
          const lfo2 = context.createOscillator(); const g2 = context.createGain();
          lfo1.frequency.value = 0.15 + params.speed * 0.6; g1.gain.value = 0.002 + params.depth * 0.004;
          lfo2.frequency.value = 0.25 + params.speed * 0.7; g2.gain.value = 0.002 + params.depth * 0.004;
          lfo1.connect(g1); g1.connect(delay1.delayTime); lfo2.connect(g2); g2.connect(delay2.delayTime);
          lfo1.start(); lfo2.start();
          const merger = context.createChannelMerger(2);
          node.connect(delay1); node.connect(delay2);
          delay1.connect(merger, 0, 0); delay2.connect(merger, 0, 1);
          tremoloOscRef.current = lfo1; lfoGainRef.current = g1; // store some for cleanup
          node = merger;
          break;
        }
        case "stereo_widen": {
          const p = context.createStereoPanner(); p.pan.value = -0.2 + params.intensity * 0.8;
          node.connect(p); node = p;
          break;
        }
      }

      node.connect(analyser);
      analyser.connect(outputGain);
      outputGain.connect(context.destination);

      sourceRef.current = src;
      analyserRef.current = analyser;
      outputGainRef.current = outputGain;

      return src;
    },
    [effect, params]
  );

  const loadFile = useCallback(async (file: File) => {
    const context = ensureCtx();
    const arrayBuf = await file.arrayBuffer();
    const audioBuf = await context.decodeAudioData(arrayBuf.slice(0));
    setBuffer(audioBuf);
    setName(file.name);
  }, [ensureCtx]);

  const loadFromUrl = useCallback(async (url: string) => {
    const context = ensureCtx();
    const resp = await fetch(url);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await context.decodeAudioData(arrayBuf);
    setBuffer(audioBuf);
    setName(url.split("/").pop() || "Link track");
  }, [ensureCtx]);

  const play = useCallback(() => {
    if (!buffer) return;
    const context = ensureCtx();
    const src = setupGraph(context, buffer);
    src.onended = () => setPlaying(false);
    src.start();
    setPlaying(true);
  }, [buffer, ensureCtx, setupGraph]);

  const stop = useCallback(() => {
    try { sourceRef.current?.stop(); } catch {}
    setPlaying(false);
  }, []);

  const updateParams = useCallback((p: Partial<EffectParams>) => {
    setParams(prev => ({ ...prev, ...p }));
  }, []);

  const analyser = useMemo(() => analyserRef.current || null, [analyserRef.current]);

  async function exportMp3(): Promise<{ blob: Blob; url: string } | null> {
    if (!buffer) return null;
    const duration = buffer.duration;
    const sampleRate = 44100; // use 44.1k for mp3
    const channels = Math.min(2, buffer.numberOfChannels);
    const offline = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);

    // Prepare reversed buffer if needed
    let workBuffer = buffer;
    if (effect === "reverse") {
      const reversed = offline.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const src = buffer.getChannelData(ch);
        const dst = reversed.getChannelData(ch);
        for (let i = 0, j = src.length - 1; i < src.length; i++, j--) {
          dst[i] = src[j];
        }
      }
      workBuffer = reversed;
    }

    const src = offline.createBufferSource();
    src.buffer = workBuffer;

    // Rebuild simplified effect chain compatible with offline rendering
    let node: AudioNode = src;
    const mapSpeed = (s: number) => 0.5 + s * 1.5;
    switch (effect) {
      case "clean": break;
      case "bass_boost": {
        const biq = offline.createBiquadFilter(); biq.type = "lowshelf"; biq.frequency.value = 200; biq.gain.value = 5 + params.intensity * 18; node.connect(biq); node = biq; break;
      }
      case "nightcore": {
        src.playbackRate.value = 1.2 + params.speed * 0.8;
        const hp = offline.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 150 + params.tone * 1000; node.connect(hp); node = hp; break;
      }
      case "lofi": {
        const lp = offline.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2000 - params.tone * 1500; node.connect(lp); node = lp; break; // bitcrusher omitted offline for speed
      }
      case "echo_chamber": {
        const delay = offline.createDelay(1.2); delay.delayTime.value = 0.25 + params.speed * 0.7; const fb = offline.createGain(); fb.gain.value = 0.25 + params.intensity * 0.6; node.connect(delay); delay.connect(fb); fb.connect(delay); node = delay; break;
      }
      case "reverb_htrk": {
        const conv = offline.createConvolver(); conv.buffer = generateImpulse(offline, 4 + params.depth * 4, 2.5); node.connect(conv); node = conv; break;
      }
      case "surround": {
        const p = offline.createStereoPanner(); p.pan.value = -1 + params.depth * 2; node.connect(p); node = p; break;
      }
      case "vinyl_crackle": {
        const lp = offline.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 8000 - params.tone * 5000; node.connect(lp); node = lp; break;
      }
      case "pitch_shift": {
        src.playbackRate.value = mapSpeed(params.intensity); break;
      }
      case "slow_reverb": {
        src.playbackRate.value = 0.7 + params.speed * 0.2; const conv = offline.createConvolver(); conv.buffer = generateImpulse(offline, 6 + params.depth * 6, 3); node.connect(conv); node = conv; break;
      }
      case "crystalizer": {
        const hp = offline.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1000 + params.tone * 4000; node.connect(hp); node = hp; break;
      }
      case "trap_bass": {
        const shelf = offline.createBiquadFilter(); shelf.type = "lowshelf"; shelf.frequency.value = 90; shelf.gain.value = 8 + params.intensity * 18; const comp = offline.createDynamicsCompressor(); comp.threshold.value = -30; comp.knee.value = 20; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.25; node.connect(shelf); shelf.connect(comp); node = comp; break;
      }
      case "reverse": {
        // already reversed above
        break;
      }
      case "vaporwave": {
        src.playbackRate.value = 0.7 + params.speed * 0.1; const conv = offline.createConvolver(); conv.buffer = generateImpulse(offline, 5, 2.2); node.connect(conv); node = conv; break;
      }
      case "chiptune": {
        const hp = offline.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200 + params.tone * 4000; node.connect(hp); node = hp; break;
      }
      case "tremolo": {
        const vca = offline.createGain(); vca.gain.value = 1; node.connect(vca); node = vca; break; // omit offline LFO
      }
      case "flanger": {
        const delay = offline.createDelay(0.02); delay.delayTime.value = 0.004; const fb = offline.createGain(); fb.gain.value = 0.3; node.connect(delay); delay.connect(fb); fb.connect(delay); node = delay; break;
      }
      case "chorus": {
        const delay1 = offline.createDelay(0.03); const delay2 = offline.createDelay(0.03); delay1.delayTime.value = 0.008; delay2.delayTime.value = 0.012; const merger = offline.createChannelMerger(2); node.connect(delay1); node.connect(delay2); delay1.connect(merger, 0, 0); delay2.connect(merger, 0, 1); node = merger; break;
      }
      case "stereo_widen": {
        const p = offline.createStereoPanner(); p.pan.value = 0.4 + params.intensity * 0.4; node.connect(p); node = p; break;
      }
    }

    node.connect(offline.destination);
    src.start();

    const rendered = await offline.startRendering();

    // Encode to MP3 using lamejs
    const left = rendered.getChannelData(0);
    const right = channels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0);

    const Mp3 = (window as any).lamejs?.Mp3Encoder;
    if (!Mp3) {
      console.error("lamejs Mp3Encoder not available yet");
      return null;
    }
    const mp3encoder = new Mp3(2, sampleRate, 192);
    const blockSize = 1152;
    let mp3Data: Uint8Array[] = [];

    const toInt16 = (f32: Float32Array) => {
      const len = f32.length;
      const i16 = new Int16Array(len);
      for (let i = 0; i < len; i++) {
        let s = Math.max(-1, Math.min(1, f32[i]));
        i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return i16;
    };

    const left16 = toInt16(left);
    const right16 = toInt16(right);

    for (let i = 0; i < left16.length; i += blockSize) {
      const l = left16.subarray(i, i + blockSize);
      const r = right16.subarray(i, i + blockSize);
      const mp3buf = mp3encoder.encodeBuffer(l, r);
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }
    const end = mp3encoder.flush();
    if (end.length > 0) mp3Data.push(end);

    const blob = new Blob(mp3Data, { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    return { blob, url };
  }

  const setEffectParams = (id: EffectId, newParams: EffectParams) => {
    setEffect(id);
    setParams(newParams);
    if (isPlaying && ctx && buffer) {
      // Rebuild while playing for live preview
      const src = setupGraph(ctx, buffer);
      try { src.start(); setPlaying(true); } catch {}
    }
  };

  const addToHistory = (item: HistoryItem) => {
    setHistory(prev => [item, ...prev].slice(0, 8));
  };

  return {
    loadFile,
    loadFromUrl,
    play,
    stop,
    isPlaying,
    name,
    setName,
    effect,
    params,
    setEffect: setEffectParams,
    updateParams,
    analyser: analyserRef,
    exportMp3,
    history,
    addToHistory,
  };
}
