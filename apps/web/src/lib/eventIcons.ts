export interface EventIcon {
  emoji: string;
  color: string;
}

const EVENT_ICONS: Record<string, EventIcon> = {
  "333": { emoji: "\u{1F9CA}", color: "#00d4aa" }, // 🧊
  "222": { emoji: "\u{1F7E6}", color: "#3b82f6" }, // 🟦
  "444": { emoji: "\u{1F7E7}", color: "#f97316" }, // 🟧
  "555": { emoji: "\u{1F7E5}", color: "#ef4444" }, // 🟥
  "666": { emoji: "\u{1F7EA}", color: "#a855f7" }, // 🟪
  "777": { emoji: "\u{1F52E}", color: "#ec4899" }, // 🔮
  "333oh": { emoji: "\u{1F590}️", color: "#a855f7" }, // 🖐️
  "333bf": { emoji: "\u{1F648}", color: "#64748b" }, // 🙈
  pyram: { emoji: "\u{1F53A}", color: "#22c55e" }, // 🔺
  skewb: { emoji: "\u{2B21}", color: "#eab308" }, // ⬡
  minx: { emoji: "\u{2B1F}", color: "#ec4899" }, // ⬟
  sq1: { emoji: "\u{1F4A0}", color: "#0ea5e9" }, // 💠
  clock: { emoji: "\u{1F550}", color: "#94a3b8" }, // 🕐
  "444bf": { emoji: "\u{1F648}", color: "#f97316" }, // 🙈
  "555bf": { emoji: "\u{1F648}", color: "#ef4444" }, // 🙈
  "333mbf": { emoji: "\u{1F9E0}", color: "#8b5cf6" }, // 🧠
  fto: { emoji: "\u{1F532}", color: "#06b6d4" }, // ▪️ → 🔲
};

const DEFAULT_ICON: EventIcon = { emoji: "\u{1F9E9}", color: "#71717a" }; // 🧩

export function eventIcon(eventType: string): EventIcon {
  return EVENT_ICONS[eventType] ?? DEFAULT_ICON;
}
