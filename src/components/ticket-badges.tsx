import { cn } from "@/lib/utils";

function colorStyle(color?: string | null): React.CSSProperties {
  const c = color || "#64748b";
  return { backgroundColor: `${c}22`, color: c, borderColor: `${c}55` };
}

export function ColorBadge({
  name,
  color,
  className,
  style,
}: {
  name?: string | null;
  color?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!name) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span
      className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", className)}
      style={{ ...colorStyle(color), ...style }}
    >
      {name}
    </span>
  );
}

// Backward-compatible exports — now driven by lookup data
export function StatusBadge({ name, color, className }: { name?: string | null; color?: string | null; className?: string }) {
  return <ColorBadge name={name} color={color} className={className} />;
}

export function PriorityBadge({ name, color, className }: { name?: string | null; color?: string | null; className?: string }) {
  return <ColorBadge name={name} color={color} className={className} />;
}
