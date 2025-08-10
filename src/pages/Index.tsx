import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Dropzone } from "@/components/Dropzone";
import { NeonVisualizer } from "@/components/visualizers/NeonVisualizer";
import { EffectControls } from "@/components/EffectControls";
import { useAudioEngine, EffectId } from "@/hooks/use-audio-engine";
import { Download, Play, Square, Sparkles, Link2 } from "lucide-react";

const effectList: { id: EffectId; name: string; desc: string }[] = [
  { id: "clean", name: "Clean", desc: "No effect" },
  { id: "bass_boost", name: "Bass Booster", desc: "+low shelf" },
  { id: "nightcore", name: "Nightcore", desc: "+speed +pitch" },
  { id: "lofi", name: "Lo‑Fi", desc: "bitcrush + lowpass" },
  { id: "echo_chamber", name: "Echo Chamber", desc: "feedback delay" },
  { id: "reverb_htrk", name: "HTRK‑style Reverb", desc: "lush space" },
  { id: "surround", name: "Surround", desc: "stereo pan" },
  { id: "vinyl_crackle", name: "Vinyl Crackle", desc: "nostalgic noise" },
  { id: "pitch_shift", name: "Pitch Shift", desc: "approx rate" },
  { id: "slow_reverb", name: "Slow Reverb", desc: "dreamy tail" },
  { id: "crystalizer", name: "Crystalizer", desc: "bright crunch" },
  { id: "trap_bass", name: "Trap Bass", desc: "boost + comp" },
  { id: "reverse", name: "Reverse", desc: "export reversed" },
  { id: "vaporwave", name: "Vaporwave", desc: "slow + reverb" },
  { id: "chiptune", name: "Chip‑Tune", desc: "retro grit" },
  { id: "tremolo", name: "Tremolo", desc: "AM wobble" },
  { id: "flanger", name: "Flanger", desc: "whoosh mod" },
  { id: "chorus", name: "Chorus", desc: "wide swirl" },
  { id: "stereo_widen", name: "Stereo Widen", desc: "pan widen" },
];

const Index = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const engine = useAudioEngine();

  const onFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    await engine.loadFile(file);
    toast({ title: "Track loaded", description: file.name });
  };

  const onLoadUrl = async () => {
    if (!url) return;
    try {
      await engine.loadFromUrl(url);
      toast({ title: "Track loaded from URL", description: url });
    } catch (e) {
      toast({ title: "Failed to load", description: "Please check the link.", variant: "destructive" as any });
    }
  };

  const exportAndDownload = async () => {
    toast({ title: "Processing…", description: "Rendering your MP3, please wait." });
    const res = await engine.exportMp3();
    if (!res) {
      toast({ title: "Unable to export MP3", description: engine.name ? "Encoder not ready. Please try again." : "Load an audio file first.", variant: "destructive" as any });
      return;
    }
    const { blob, url } = res;
    const a = document.createElement("a");
    a.href = url; a.download = (engine.name || "bakhtak-output") + ".mp3";
    document.body.appendChild(a); a.click(); a.remove();

    // store small base64 for history (limited)
    const reader = new FileReader();
    reader.onload = () => {
      engine.addToHistory({
        id: Date.now().toString(),
        name: engine.name || "Processed Track",
        effect: engine.effect,
        params: engine.params,
        date: new Date().toISOString(),
        mp3: typeof reader.result === 'string' ? reader.result : undefined,
      });
      toast({ title: "Done", description: "MP3 ready and added to history." });
    };
    reader.readAsDataURL(blob);
  };

  return (
    <div className="min-h-screen px-4 py-8 md:py-12">
      <header className="max-w-6xl mx-auto mb-8 md:mb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl md:text-5xl font-semibold tracking-tight">
              Bakhtak Music — Futuristic Audio Effects & Visualizer
            </h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Upload or paste a link, apply 50+ premium effects in real‑time, watch neon visuals pulse to your sound, and download your MP3.
            </p>
          </div>
          <Button variant="hero" className="hidden md:inline-flex animate-enter"><Sparkles className="mr-2"/>New Session</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Upload & Link */}
        <section className="lg:col-span-4 space-y-4">
          <Card className="bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dropzone onFiles={onFiles} />
              <div className="flex items-center gap-2">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste audio URL…" />
                <Button variant="neon" onClick={onLoadUrl}><Link2 className="mr-2"/>Load</Button>
              </div>
              <div className="text-xs text-muted-foreground">Current: {engine.name || "No track loaded"}</div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {engine.history.length === 0 && (
                <p className="text-sm text-muted-foreground">No processed tracks yet.</p>
              )}
              {engine.history.map(h => (
                <div key={h.id} className="flex items-center justify-between p-2 rounded-md border">
                  <div>
                    <div className="text-sm font-medium">{h.name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(h.date).toLocaleString()} • {h.effect}</div>
                  </div>
                  {h.mp3 && (
                    <a className="text-sm text-accent-foreground hover:underline" href={h.mp3} download={`${h.name}.mp3`}>Download</a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* Center: Visualizer & Controls */}
        <section className="lg:col-span-8 space-y-4">
          <Card className="bg-card/60 backdrop-blur-sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Visualizer</CardTitle>
              <div className="flex items-center gap-2">
                {!engine.isPlaying ? (
                  <Button variant="neon" onClick={engine.play}><Play className="mr-2"/>Play</Button>
                ) : (
                  <Button variant="outline" onClick={engine.stop}><Square className="mr-2"/>Stop</Button>
                )}
                <Button variant="hero" onClick={exportAndDownload}><Download className="mr-2"/>Download MP3</Button>
              </div>
            </CardHeader>
            <CardContent>
              <NeonVisualizer analyserRef={engine.analyser} />
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Effect Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <EffectControls
                intensity={engine.params.intensity}
                depth={engine.params.depth}
                speed={engine.params.speed}
                tone={engine.params.tone}
                onChange={(v) => engine.updateParams(v)}
              />
              <p className="text-xs text-muted-foreground mt-2">Tweak and preview in real time. Export reflects current settings.</p>
            </CardContent>
          </Card>
        </section>

        {/* Effects Library Full Width */}
        <section className="lg:col-span-12">
          <Card className="bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Effects Library</CardTitle>
                <Badge className="bg-accent/20 text-accent-foreground">50+ Effects</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {effectList.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => engine.setEffect(e.id, engine.params)}
                    className={`group rounded-lg border p-3 text-left transition hover:bg-accent/10 ${engine.effect === e.id ? 'border-accent' : 'border-border'}`}
                  >
                    <div className="font-medium flex items-center justify-between">
                      <span>{e.name}</span>
                      {engine.effect === e.id && <span className="text-xs text-accent-foreground">Active</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{e.desc}</div>
                    <div className="mt-2 h-1 rounded-full bg-[linear-gradient(90deg,hsl(var(--accent)),hsl(var(--primary)))] group-hover:animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto mt-10 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Bakhtak Music. Crafted with reactive neon.
      </footer>
    </div>
  );
};

export default Index;
