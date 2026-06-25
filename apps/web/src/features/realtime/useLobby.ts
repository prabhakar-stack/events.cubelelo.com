"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { fetchLobby, type RosterEntry } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface LobbyLive {
  roster: RosterEntry[];
  status: string;
  opensAt: string | null;
  rulesMd: string | null;
}

/**
 * Joins a round's lobby: loads the snapshot over REST, checks the competitor in
 * over Socket.io, and keeps the roster + round status live.
 */
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

    const socket: Socket = io(BASE_URL, { transports: ["websocket"] });
    socket.on("connect", () =>
      socket.emit("lobby:checkin", { roundId, userId: me.userId, name: me.name }),
    );
    socket.on(
      "lobby:roster",
      (p: { roundId: string; competitors: RosterEntry[] }) => {
        if (p.roundId === roundId) setRoster(p.competitors);
      },
    );
    socket.on(
      "round:status",
      (p: { roundId: string; status: string; opensAt?: string }) => {
        if (p.roundId !== roundId) return;
        setStatus(p.status);
        if (p.opensAt !== undefined) setOpensAt(p.opensAt ?? null);
      },
    );

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [roundId, me.userId, me.name]);

  return { roster, status, opensAt, rulesMd };
}
