// Tracks when each user fetched scrambles for a round, used for anti-cheat timing validation.
const fetchTimes = new Map<string, number>();

function key(roundId: string, userId: string): string {
  return `${roundId}:${userId}`;
}

export function recordScrambleFetch(roundId: string, userId: string): void {
  fetchTimes.set(key(roundId, userId), Date.now());
}

export function getScrambleFetchTime(roundId: string, userId: string): number | undefined {
  return fetchTimes.get(key(roundId, userId));
}
