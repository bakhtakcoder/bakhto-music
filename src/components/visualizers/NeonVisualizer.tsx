import { useEffect, useRef } from "react";

interface NeonVisualizerProps {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
}

export const NeonVisualizer = ({ analyserRef }: NeonVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.scale(dpr, dpr);

    const particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
    const particleCount = 60;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: 1 + Math.random() * 2,
      });
    }

    const bufferLength = 256;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const analyser = analyserRef.current;
      width = canvas.clientWidth; height = canvas.clientHeight;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, width, height);

      // Background subtle grid/glow
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, `hsla(var(--accent), 0.06)`);
      grad.addColorStop(1, `hsla(var(--primary), 0.06)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      let amplitude = 0.1;
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        amplitude = dataArray.reduce((a, v) => a + v, 0) / (dataArray.length * 255);
      }

      // Equalizer bars
      const barCount = 48;
      const barWidth = width / barCount;
      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor((i / barCount) * bufferLength);
        const v = dataArray[idx] || 0;
        const h = (v / 255) * (height * 0.6);
        const x = i * barWidth + 2;
        const y = height - h - 2;
        const barGrad = ctx.createLinearGradient(x, y, x, height);
        barGrad.addColorStop(0, `hsla(var(--accent), 0.95)`);
        barGrad.addColorStop(1, `hsla(var(--primary), 0.6)`);
        ctx.fillStyle = barGrad;
        ctx.shadowColor = `hsla(var(--accent), ${0.35 + amplitude * 0.5})`;
        ctx.shadowBlur = 12 + amplitude * 30;
        ctx.fillRect(x, y, Math.max(2, barWidth - 4), h);
      }

      // Glitch wave (time-domain)
      if (analyser) {
        const timeData = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(timeData);
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = `hsla(var(--primary), 0.9)`;
        const slice = width / bufferLength;
        for (let i = 0; i < bufferLength; i++) {
          const x = i * slice;
          const v = (timeData[i] / 128.0) - 1.0;
          const y = height / 2 + v * (height * 0.25);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Neon particles
      particles.forEach(p => {
        p.x += p.vx * (1 + amplitude * 2);
        p.y += p.vy * (1 + amplitude * 2);
        if (p.x < -10) p.x = width + 10; if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10; if (p.y > height + 10) p.y = -10;
        ctx.beginPath();
        ctx.fillStyle = `hsla(var(--accent), ${0.4 + amplitude * 0.4})`;
        ctx.shadowColor = `hsla(var(--accent), ${0.6 + amplitude * 0.3})`;
        ctx.shadowBlur = 8 + amplitude * 24;
        ctx.arc(p.x, p.y, p.size + amplitude * 3, 0, Math.PI * 2);
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserRef]);

  return (
    <div className="w-full h-64 md:h-80 rounded-lg border bg-card/40 backdrop-blur-sm overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};
