import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export type SliderGroupProps = {
  intensity: number;
  depth: number;
  speed: number;
  tone: number;
  onChange: (values: { intensity?: number; depth?: number; speed?: number; tone?: number }) => void;
};

export const EffectControls = ({ intensity, depth, speed, tone, onChange }: SliderGroupProps) => {
  const item = (label: string, value: number, key: keyof SliderGroupProps) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground">{Math.round(value * 100)}%</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange({ [key]: v } as any)} max={1} step={0.01} />
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {item("Intensity", intensity, "intensity")}
      {item("Depth", depth, "depth")}
      {item("Speed", speed, "speed")}
      {item("Tone", tone, "tone")}
    </div>
  );
};
