"use client";

import { useEffect, useState } from "react";
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
): LobbyLive {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [status, setStatus] = useState<string>("pending");
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [rulesMd, setRulesMd] = useState<string | null>(null);

  useEffect(() => {
    if (!roundId) return;
    let active = true;

    fetchLobby(roundId)
      .then((s) => {
        if (!active) return;
        setRoster(s.roster);
        setStatus(s.round.status);
        setOpensAt(s.round.opensAt);
        setRulesMd(s.competition.rulesMd);
      })
      .catch(() => {});

    const socket = acquireSocket();
    socket.emit("lobby:checkin", { roundId, name: me.name });

    const rosterHandler = (p: { roundId: string; competitors: RosterEntry[] }) => {
      if (p.roundId === roundId) setRoster(p.competitors);
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
      socket.off("lobby:roster", rosterHandler);
      socket.off("round:status", statusHandler);
      releaseSocket();
    };
  }, [roundId, me.userId, me.name]);

  return { roster, status, opensAt, rulesMd };
}
