import {
  Anchor, BrickWall, ClipboardList, Columns3, DoorOpen, Fan, Flame, Forklift, Grid3x3, Hammer, HardHat, House, Lamp, Layers,
  PaintRoller, Route, Shovel, Sparkles, TrafficCone, TrainTrack, Trees, Truck, Umbrella, WavesHorizontal, Zap, Droplets,
  type LucideIcon,
} from "lucide-react";

const ICONES: Record<string, LucideIcon> = {
  Anchor, BrickWall, ClipboardList, Columns3, DoorOpen, Fan, Flame, Forklift, Grid3x3, Hammer, HardHat, House, Lamp, Layers,
  PaintRoller, Route, Shovel, Sparkles, TrafficCone, TrainTrack, Trees, Truck, Umbrella, WavesHorizontal, Zap, Droplets,
};

/** Ícone do assunto pelo nome gravado no banco; nome desconhecido usa o ícone de camadas. */
export function IconeAssunto({ nome, className }: { nome: string; className?: string }) {
  const I = ICONES[nome] ?? Layers;
  return <I className={className} aria-hidden="true" />;
}
