import {
  Bot,
  Compass,
  Feather,
  Gem,
  Sparkles,
  Terminal,
  Waves,
  Cpu,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  waves: Waves,
  sparkles: Sparkles,
  gem: Gem,
  feather: Feather,
  compass: Compass,
  bot: Bot,
  terminal: Terminal,
};

export default function AgentGlyph({
  glyph,
  className,
  size = 16,
}: {
  glyph: string;
  className?: string;
  size?: number;
}) {
  const Icon = MAP[glyph] ?? Cpu;
  return <Icon className={className} size={size} strokeWidth={1.8} />;
}
