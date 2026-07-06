function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function GradientAvatar({
  name,
  size = 64,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const hash = hashString(name || "?");
  const hueA = hash % 360;
  const hueB = (hueA + 55) % 360;

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hueA}, 70%, 45%), hsl(${hueB}, 75%, 40%))`,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}
