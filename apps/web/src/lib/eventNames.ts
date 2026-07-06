const EVENT_NAMES: Record<string, string> = {
  "333": "3x3",
  "222": "2x2",
  "444": "4x4",
  "555": "5x5",
  "666": "6x6",
  "777": "7x7",
  pyram: "Pyraminx",
  skewb: "Skewb",
  minx: "Megaminx",
  "333oh": "3x3 OH",
  "333bf": "3x3 BLD",
  sq1: "Square-1",
  clock: "Clock",
  "444bf": "4x4 BLD",
  "555bf": "5x5 BLD",
  "333mbf": "Multi-BLD",
  fto: "FTO",
};

export function eventDisplayName(eventType: string): string {
  return EVENT_NAMES[eventType] ?? eventType;
}
