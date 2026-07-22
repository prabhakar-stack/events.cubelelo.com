"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchLobby, type RosterEntry } from "@/lib/api";
import { acquireSocket, releaseSocket } from "./socket";

export interface LobbyLive {
  roster: RosterEntry[];
  status: string;
  opensAt: string | null;
  rulesMd: string | null;
}

export function useLobby(
  roundId: string | null,
  me: { userId: string; name: string },
): LobbyLive & { fetchError: boolean } {
  const [serverRoster, setServerRoster] = useState<RosterEntry[]>([]);
  const [status, setStatus] = useState<string>("pending");
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [rulesMd, setRulesMd] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!roundId) return;
    let active = true;
    let attempt = 0;

    const load = () => {
      fetchLobby(roundId)
        .then((s) => {
          if (!active) return;
          setFetchError(false);
          setServerRoster(s.roster);
          setStatus(s.round.status);
          setOpensAt(s.round.opensAt);
          setRulesMd(s.competition.rulesMd);
        })
        .catch(() => {
          if (!active) return;
          attempt++;
          if (attempt < 3) {
            setTimeout(load, attempt * 2000);
          } else {
            setFetchError(true);
          }
        });
    };
    load();

    const socket = acquireSocket();

    const checkin = () => {
      socket.emit("lobby:checkin", { roundId, name: me.name });
    };
    checkin();
    socket.on("connect", checkin);

    const rosterHandler = (p: { roundId: string; competitors: RosterEntry[] }) => {
      if (p.roundId === roundId) setServerRoster(p.competitors);
    };
    const statusHandler = (p: { roundId: string; status: string; opensAt?: string }) => {
      if (p.roundId !== roundId) return;
      setStatus(p.status);
      if (p.opensAt !== undefined) setOpensAt(p.opensAt ?? null);
    };
    socket.on("lobby:roster", rosterHandler);
    socket.on("round:status", statusHandler);

    return () => {
      active = false;
      socket.emit("lobby:checkout", { roundId });
      socket.off("connect", checkin);
      socket.off("lobby:roster", rosterHandler);
      socket.off("round:status", statusHandler);
      releaseSocket();
    };
  }, [roundId, me.userId, me.name]);

  const roster = useMemo(() => {
    if (me.userId === "guest") return serverRoster;
    if (serverRoster.some((c) => c.userId === me.userId)) return serverRoster;
    return [{ userId: me.userId, name: me.name }, ...serverRoster];
  }, [serverRoster, me.userId, me.name]);

  return { roster, status, opensAt, rulesMd, fetchError };
}
