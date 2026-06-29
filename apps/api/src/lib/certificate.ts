import PDFDocument from "pdfkit";
import type { Repository } from "../db/repo";

export interface CertificateData {
  participantName: string;
  clId: string;
  competitionTitle: string;
  competitionDate: string;
  events: Array<{
    eventType: string;
    rank: number | null;
    bestSingleMs: number | null;
    ao5Ms: number | null;
  }>;
  isPodium: boolean;
  podiumRank?: number;
}

function fmtMs(ms: number | null): string {
  if (ms === null) return "DNF";
  return (ms / 1000).toFixed(2) + "s";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

export function generateCertificatePDF(data: CertificateData): typeof PDFDocument.prototype {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
  });

  const w = 841.89;
  const h = 595.28;
  const cx = w / 2;

  // Border
  const borderColor = data.isPodium ? "#d4a843" : "#3b8a6e";
  doc.rect(20, 20, w - 40, h - 40).lineWidth(3).stroke(borderColor);
  doc.rect(28, 28, w - 56, h - 56).lineWidth(1).stroke(borderColor);

  // Header
  doc.fontSize(14).fillColor("#888888").text("CUBELELO EVENTS", 0, 60, {
    align: "center",
    width: w,
  });

  // Title
  const title = data.isPodium ? "CERTIFICATE OF ACHIEVEMENT" : "CERTIFICATE OF PARTICIPATION";
  doc.fontSize(28).fillColor(borderColor).text(title, 0, 95, {
    align: "center",
    width: w,
  });

  // Decorative line
  doc.moveTo(cx - 150, 135).lineTo(cx + 150, 135).lineWidth(1).stroke(borderColor);

  // "This is to certify that"
  doc.fontSize(12).fillColor("#555555").text("This is to certify that", 0, 155, {
    align: "center",
    width: w,
  });

  // Participant name
  doc.fontSize(32).fillColor("#1a1a1a").text(data.participantName, 0, 180, {
    align: "center",
    width: w,
  });

  // CL ID
  doc.fontSize(10).fillColor("#888888").text(`CL ID: ${data.clId}`, 0, 222, {
    align: "center",
    width: w,
  });

  if (data.isPodium && data.podiumRank) {
    doc.fontSize(16).fillColor("#333333").text(
      `achieved ${ordinal(data.podiumRank)} place in`,
      0, 250,
      { align: "center", width: w },
    );
  } else {
    doc.fontSize(16).fillColor("#333333").text(
      "successfully participated in",
      0, 250,
      { align: "center", width: w },
    );
  }

  // Competition title
  doc.fontSize(22).fillColor("#1a1a1a").text(data.competitionTitle, 0, 280, {
    align: "center",
    width: w,
  });

  // Date
  doc.fontSize(11).fillColor("#666666").text(
    `held on ${data.competitionDate}`,
    0, 315,
    { align: "center", width: w },
  );

  // Events table
  if (data.events.length > 0) {
    const tableTop = 345;
    const colX = [cx - 200, cx - 60, cx + 50, cx + 150];

    doc.fontSize(9).fillColor("#999999");
    doc.text("Event", colX[0], tableTop, { width: 140 });
    doc.text("Rank", colX[1], tableTop, { width: 80 });
    doc.text("Best Single", colX[2], tableTop, { width: 100 });
    doc.text("Average", colX[3], tableTop, { width: 100 });

    doc.moveTo(colX[0]!, tableTop + 14).lineTo(colX[3]! + 80, tableTop + 14).lineWidth(0.5).stroke("#cccccc");

    data.events.forEach((ev, i) => {
      const y = tableTop + 22 + i * 18;
      doc.fontSize(10).fillColor("#333333");
      doc.text(ev.eventType, colX[0], y, { width: 140 });
      doc.text(ev.rank !== null ? ordinal(ev.rank) : "-", colX[1], y, { width: 80 });
      doc.text(fmtMs(ev.bestSingleMs), colX[2], y, { width: 100 });
      doc.text(fmtMs(ev.ao5Ms), colX[3], y, { width: 100 });
    });
  }

  // Footer line
  doc.moveTo(cx - 150, h - 100).lineTo(cx + 150, h - 100).lineWidth(0.5).stroke("#cccccc");

  doc.fontSize(9).fillColor("#999999").text(
    "Cubelelo Events Platform",
    0, h - 90,
    { align: "center", width: w },
  );

  doc.fontSize(8).fillColor("#bbbbbb").text(
    "This certificate was digitally generated and does not require a signature.",
    0, h - 75,
    { align: "center", width: w },
  );

  doc.end();
  return doc;
}

export async function collectCertificateData(
  repo: Repository,
  competitionId: string,
  userId: string,
): Promise<CertificateData | null> {
  const comp = await repo.competitions.findById(competitionId);
  if (!comp) return null;

  const user = await repo.users.findById(userId);
  if (!user) return null;

  const reg = await repo.registrations.findByUserAndComp(userId, competitionId);
  if (!reg) return null;

  const events = await repo.competitionEvents.findByCompetition(competitionId);
  const rounds = await repo.rounds.findByCompetition(competitionId);

  const eventResults: CertificateData["events"] = [];
  let bestRank: number | null = null;

  for (const ev of events) {
    const evRounds = rounds
      .filter((r) => r.competitionEventId === ev.id)
      .sort((a, b) => b.roundNumber - a.roundNumber);

    for (const round of evRounds) {
      const results = await repo.results.findByRound(round.id);
      const userResult = results.find((r) => r.userId === userId);
      if (userResult) {
        eventResults.push({
          eventType: ev.eventType,
          rank: userResult.rank,
          bestSingleMs: userResult.bestSingleMs,
          ao5Ms: userResult.ao5Ms,
        });
        if (userResult.rank !== null && userResult.rank !== undefined && (bestRank === null || userResult.rank < bestRank)) {
          bestRank = userResult.rank;
        }
        break;
      }
    }
  }

  const compDate = comp.startsAt
    ? new Date(comp.startsAt).toLocaleDateString("en-IN", {
        year: "numeric", month: "long", day: "numeric",
      })
    : new Date(comp.createdAt).toLocaleDateString("en-IN", {
        year: "numeric", month: "long", day: "numeric",
      });

  return {
    participantName: user.name,
    clId: user.clId,
    competitionTitle: comp.title,
    competitionDate: compDate,
    events: eventResults,
    isPodium: bestRank !== null && bestRank <= 3,
    podiumRank: bestRank !== null && bestRank <= 3 ? bestRank : undefined,
  };
}
