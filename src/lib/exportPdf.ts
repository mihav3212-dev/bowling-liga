import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import { computeWeekRecap } from "./recap";
import {
  computePlayerStandings,
  computeStandings,
  lastCompletedRound,
  playersByAverage,
  seasonLabel,
  seasonRoundCount,
} from "./standings";
import { pairingTemplate, slotLabel } from "./pairings";
import { matchTotals, scoreGame, scoredPins } from "./scoring";
import type { LeagueState } from "./types";

async function fontBase64(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Pisava ni naložena: ${path}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

async function imageDataUrl(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Logotip ni naložen: ${path}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

let fontCache: Promise<{ regular: string; bold: string }> | null = null;

async function withFonts(doc: jsPDF): Promise<void> {
  if (!fontCache) {
    fontCache = Promise.all([
      fontBase64("/fonts/FreeSans.ttf"),
      fontBase64("/fonts/FreeSansBold.ttf"),
    ]).then(([regular, bold]) => ({ regular, bold }));
  }
  const fonts = await fontCache;
  doc.addFileToVFS("FreeSans.ttf", fonts.regular);
  doc.addFileToVFS("FreeSansBold.ttf", fonts.bold);
  doc.addFont("FreeSans.ttf", "FreeSans", "normal");
  doc.addFont("FreeSansBold.ttf", "FreeSans", "bold");
}

function line(
  doc: jsPDF,
  items: { name: string; value: string }[],
  x: number,
  y: number,
  width: number,
  title: string,
): number {
  doc.setFont("FreeSans", "bold");
  doc.setFontSize(8);
  doc.setTextColor(20, 16, 10);
  doc.text(title, x, y);
  y += 5;
  doc.setDrawColor(180);
  doc.line(x, y - 3, x + width, y - 3);
  doc.setFont("FreeSans", "normal");
  doc.setFontSize(7.5);
  if (items.length === 0) {
    doc.text("—", x, y);
    return y + 6;
  }
  for (const [i, item] of items.entries()) {
    const name = doc.splitTextToSize(`${i + 1}. ${item.name}`, width - 16)[0] as string;
    doc.text(name, x, y);
    doc.text(item.value, x + width, y, { align: "right" });
    y += 4.2;
  }
  return y + 4;
}

type BuiltPdf = { filename: string; doc: jsPDF };

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportStandingsPdf(state: LeagueState): Promise<void> {
  const built = await buildStandingsPdf(state);
  built.doc.save(built.filename);
}

async function buildStandingsPdf(state: LeagueState): Promise<BuiltPdf> {
  const teams = computeStandings(state);
  const round = lastCompletedRound(state);
  const season = state.seasonTitle ?? seasonLabel();
  const date = new Date().toLocaleDateString("sl-SI");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await withFonts(doc);
  const logo = await imageDataUrl("/logo-bowling-lenart.png");
  doc.setFont("FreeSans", "bold");

  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();

  doc.addImage(logo, "PNG", margin, 5, 58, 24);
  doc.setTextColor(20, 16, 10);
  doc.setFontSize(11);
  doc.text(`BOWLING LIGA ${season}`, pageW - margin, 14, { align: "right" });
  const roundText = round > 0 ? `PO ${round}. KOLU` : "PRED ZAČETKOM";
  doc.setFontSize(9);
  doc.setTextColor(255, 78, 200);
  doc.text(roundText, pageW - margin, 21, { align: "right" });
  doc.setDrawColor(40);
  doc.setLineWidth(0.3);
  doc.line(margin, 32, pageW - margin, 32);

  doc.setTextColor(20, 16, 10);
  let y = 42;
  doc.setFontSize(13);
  doc.text(`LESTVICA ${season} ${roundText}`, margin, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    styles: { font: "FreeSans", fontSize: 8, cellPadding: 1.3, textColor: [20, 16, 10], halign: "center" },
    headStyles: {
      font: "FreeSans",
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: [20, 16, 10],
      halign: "center",
      lineWidth: 0.2,
      lineColor: [40, 40, 40],
    },
    bodyStyles: { lineWidth: 0.15, lineColor: [160, 160, 160] },
    columnStyles: {
      1: { halign: "left", cellWidth: 30 },
      11: { fontStyle: "bold", halign: "center" },
    },
    head: [[
      "#",
      "Ekipa",
      "Igre",
      "Z",
      "P",
      "R",
      "Velike točke",
      "Male točke",
      "Keglji",
      "Povp./ekipa",
      "Povp./igralec",
      "TOČKE",
    ]],
    body: teams.map((row, i) => [
      i + 1,
      row.team.name,
      row.played,
      row.won,
      row.lost,
      row.drawn,
      row.velike,
      row.small,
      row.pins,
      row.teamAvg ? row.teamAvg.toFixed(1) : "0.0",
      row.avg ? row.avg.toFixed(2) : "0.00",
      row.big,
    ]),
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y += 12;
  const recap = computeWeekRecap(state);
  const fmt = (row: { name: string; team?: string }) =>
    row.team ? `${row.name}  (${row.team})` : row.name;
  const colW = (pageW - margin * 2 - 10) / 2;
  const col1 = margin;
  const col2 = margin + colW + 10;
  let yLeft = line(
    doc,
    recap.bestSingle.map((row) => ({ name: fmt(row), value: String(row.value) })),
    col1,
    y,
    colW,
    "NAJVEČ KEGLJEV — POSAMEZNO",
  );
  yLeft = line(
    doc,
    recap.bestSeries.map((row) => ({ name: fmt(row), value: String(row.value) })),
    col1,
    yLeft,
    colW,
    "NAJBOLJŠA IGRA — SKUPAJ",
  );
  yLeft = line(
    doc,
    recap.bestTeam.map((row) => ({ name: row.name, value: String(row.value) })),
    col1,
    yLeft,
    colW,
    "NAJVEČ KEGLJEV — EKIPNO",
  );
  let yRight = line(
    doc,
    recap.topSingles.map((row) => ({ name: fmt(row), value: String(row.value) })),
    col2,
    y,
    colW,
    "TOP 5 — POSAMEZNA IGRA",
  );
  yRight = line(
    doc,
    recap.topSeries.map((row) => ({ name: fmt(row), value: String(row.value) })),
    col2,
    yRight,
    colW,
    "TOP 5 — POSAMEZNO 4 IGRE",
  );
  yRight = line(
    doc,
    recap.topTeams.map((row) => ({ name: row.name, value: String(row.value) })),
    col2,
    yRight,
    colW,
    "TOP 5 — KEGLJI PO IGRI EKIPA",
  );

  doc.setFont("FreeSans", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text(
    `Izpis ${date}   Točke ekipe: zmaga 2, remi 1, poraz 0.`,
    margin,
    Math.min(Math.max(yLeft, yRight) + 6, doc.internal.pageSize.getHeight() - 8),
  );

  const filename = round > 0 ? `bowling-liga-lestvica-kolo-${round}.pdf` : "bowling-liga-lestvica.pdf";
  return { filename, doc };
}

function teamName(state: LeagueState, id: string): string {
  return state.teams.find((t) => t.id === id)?.name ?? "?";
}

export async function exportResultsPdf(state: LeagueState): Promise<void> {
  const season = state.seasonTitle ?? seasonLabel();
  const date = new Date().toLocaleDateString("sl-SI");
  const done = state.matches.filter((m) => matchTotals(m, state.players).complete);
  const byRound = new Map<number, typeof done>();
  for (const match of done) {
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await withFonts(doc);
  const logo = await imageDataUrl("/logo-bowling-lenart.png");
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();

  doc.addImage(logo, "PNG", margin, 5, 58, 24);
  doc.setTextColor(20, 16, 10);
  doc.setFont("FreeSans", "bold");
  doc.setFontSize(11);
  doc.text(`BOWLING LIGA ${season}`, pageW - margin, 14, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(255, 78, 200);
  doc.text("REZULTATI", pageW - margin, 21, { align: "right" });
  doc.setDrawColor(40);
  doc.setLineWidth(0.3);
  doc.line(margin, 32, pageW - margin, 32);

  let y = 42;
  doc.setTextColor(20, 16, 10);
  doc.setFontSize(13);
  doc.text(`REZULTATI ${season}`, margin, y);
  y += 4;

  if (rounds.length === 0) {
    doc.setFont("FreeSans", "normal");
    doc.setFontSize(10);
    doc.text("Še ni vnesenih rezultatov.", margin, y + 8);
  }

  for (const round of rounds) {
    const rows = (byRound.get(round) ?? []).map((match) => {
      const totals = matchTotals(match, state.players);
      return [
        `${teamName(state, match.homeTeamId)} – ${teamName(state, match.awayTeamId)}`,
        `${totals.homeMatch}:${totals.awayMatch}`,
        `${totals.homeBig}:${totals.awayBig}`,
        `${totals.homePins}:${totals.awayPins}`,
      ];
    });
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles: { font: "FreeSans", fontSize: 8, cellPadding: 1.4, textColor: [20, 16, 10] },
      headStyles: {
        font: "FreeSans",
        fontStyle: "bold",
        fillColor: [255, 255, 255],
        textColor: [20, 16, 10],
        lineWidth: 0.2,
        lineColor: [40, 40, 40],
      },
      bodyStyles: { lineWidth: 0.15, lineColor: [160, 160, 160] },
      columnStyles: {
        1: { halign: "center", cellWidth: 18 },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "center", cellWidth: 18 },
      },
      head: [[`${round}. kolo`, "TOČKE", "Velike točke", "Keglji"]],
      body: rows,
    });
    y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
  }

  doc.setFont("FreeSans", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text(`Izpis ${date}`, margin, doc.internal.pageSize.getHeight() - 8);
  doc.save("bowling-liga-rezultati.pdf");
}

export async function exportPlayersPdf(state: LeagueState): Promise<void> {
  const built = await buildPlayersPdf(state);
  built.doc.save(built.filename);
}

async function buildPlayersPdf(state: LeagueState): Promise<BuiltPdf> {
  const season = state.seasonTitle ?? seasonLabel();
  const date = new Date().toLocaleDateString("sl-SI");
  const roundCount = seasonRoundCount(state);
  const players = playersByAverage(computePlayerStandings(state));

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  await withFonts(doc);
  const logo = await imageDataUrl("/logo-bowling-lenart.png");
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();

  doc.addImage(logo, "PNG", margin, 4, 48, 20);
  doc.setTextColor(20, 16, 10);
  doc.setFont("FreeSans", "bold");
  doc.setFontSize(11);
  doc.text(`BOWLING LIGA ${season}`, pageW - margin, 12, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(255, 78, 200);
  doc.text("LESTVICA IGRALCEV", pageW - margin, 19, { align: "right" });
  doc.setDrawColor(40);
  doc.setLineWidth(0.3);
  doc.line(margin, 26, pageW - margin, 26);

  const head = [
    "#",
    "Igralec",
    "Ekipa",
    ...Array.from({ length: roundCount }, (_, i) => String(i + 1)),
    "Keglji",
    "Igre",
    "Povp.",
  ];
  const body = players.map((row, i) => [
    i + 1,
    row.player.name,
    row.teamName,
    ...row.byRound.map((games) => {
      const pins = games.reduce((sum, n) => sum + n, 0);
      return games.length ? String(pins) : "—";
    }),
    row.pins,
    row.games,
    row.avg.toFixed(1),
  ]);

  autoTable(doc, {
    startY: 34,
    margin: { left: margin, right: margin },
    styles: { font: "FreeSans", fontSize: 7, cellPadding: 1.1, textColor: [20, 16, 10] },
    headStyles: {
      font: "FreeSans",
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: [20, 16, 10],
      halign: "center",
      lineWidth: 0.2,
      lineColor: [40, 40, 40],
    },
    bodyStyles: { lineWidth: 0.12, lineColor: [160, 160, 160] },
    columnStyles: {
      1: { halign: "left" },
      2: { halign: "left" },
    },
    head: [head],
    body: body.length ? body : [["", "Še ni odigranih iger.", "", ...Array(roundCount + 3).fill("")]],
  });

  doc.setFont("FreeSans", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text(`Izpis ${date}`, margin, doc.internal.pageSize.getHeight() - 8);
  return { filename: "bowling-liga-igralci.pdf", doc };
}

function field(doc: jsPDF, label: string, value: string, x: number, y: number, width: number): void {
  doc.setFont("FreeSans", "normal");
  doc.setFontSize(12);
  doc.setTextColor(20, 16, 10);
  doc.text(label, x, y);
  const labelW = doc.getTextWidth(label);
  const lineX = x + labelW + 2;
  const lineY = y + 1.2;
  doc.setDrawColor(40);
  doc.setLineWidth(0.35);
  doc.line(lineX, lineY, x + width, lineY);
  if (value) {
    doc.setFont("FreeSans", "bold");
    doc.text(value, lineX + 1.5, y);
  }
}

function drawRegistrationPage(
  doc: jsPDF,
  state: LeagueState,
  team: LeagueState["teams"][number],
  date: string,
  season: string,
): void {
  const margin = 22;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const innerW = pageW - margin * 2;
  const players = state.players.filter((p) => p.teamId === team.id);

  doc.setFont("FreeSans", "normal");
  doc.setFontSize(14);
  doc.setTextColor(20, 16, 10);
  doc.text("Bowling Center Lenart", margin, 22);
  doc.text("Industrijska ulica 24", margin, 28.5);
  doc.text("2230 Lenart", margin, 35);

  doc.text(`Datum: ${date}`, pageW - margin, 22, { align: "right" });

  doc.setFont("FreeSans", "bold");
  doc.setFontSize(16);
  doc.text(`PRIJAVNI LIST za bowling ligo ${season}`, pageW / 2, 52, { align: "center" });

  field(doc, "Ime ekipe: ", team.name, margin, 68, innerW);
  field(doc, "Vodja ekipe: ", team.captain ?? "", margin, 80, innerW);
  field(doc, "Tel. številka: ", team.phone ?? "", margin, 92, innerW);
  field(doc, "E-pošta: ", team.email ?? "", margin, 104, innerW);

  doc.setLineWidth(0.6);
  doc.line(margin, 112, pageW - margin, 112);

  doc.setFont("FreeSans", "normal");
  doc.setFontSize(13);
  doc.text("Ime in priimek", pageW / 2, 124, { align: "center" });

  const slots = Math.max(10, players.length);
  let y = 138;
  for (let i = 0; i < slots; i++) {
    if (y > pageH - 28) {
      doc.addPage();
      y = 24;
    }
    const n = `${i + 1}.`;
    doc.setFont("FreeSans", "normal");
    doc.setFontSize(12);
    doc.text(n, margin, y);
    doc.setLineWidth(0.3);
    doc.line(margin + 12, y + 1.2, pageW - margin, y + 1.2);
    const name = players[i]?.name;
    if (name) {
      doc.setFont("FreeSans", "bold");
      doc.text(name, margin + 14, y);
    }
    y += 12;
  }

  y = Math.max(y + 8, pageH - 22);
  doc.setFont("FreeSans", "bold");
  doc.setFontSize(11);
  doc.text("Seznam se po odigranem 1. kola NE SME VEČ SPREMINJATI.", pageW / 2, y, {
    align: "center",
  });
}

export async function exportMatchPdf(state: LeagueState, matchId: string): Promise<void> {
  const built = await buildMatchPdf(state, matchId);
  if (built) built.doc.save(built.filename);
}

async function buildMatchPdf(state: LeagueState, matchId: string): Promise<BuiltPdf | null> {
  const match = state.matches.find((m) => m.id === matchId);
  if (!match) return null;
  const home = state.teams.find((t) => t.id === match.homeTeamId)?.name ?? "Domači";
  const away = state.teams.find((t) => t.id === match.awayTeamId)?.name ?? "Gostje";
  const players = new Map(state.players.map((p) => [p.id, p]));
  const totals = matchTotals(match, state.players);
  const template = pairingTemplate();
  const season = state.seasonTitle ?? seasonLabel();
  const when = match.startsAt
    ? new Date(match.startsAt).toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" })
    : "";

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await withFonts(doc);
  const logo = await imageDataUrl("/logo-bowling-lenart.png");
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();

  doc.addImage(logo, "PNG", margin, 5, 42, 17);
  doc.setFont("FreeSans", "bold");
  doc.setTextColor(20, 16, 10);
  doc.setFontSize(12);
  doc.text(`BOWLING LIGA ${season}`, pageW - margin, 12, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(255, 78, 200);
  doc.text("ZAPISNIK", pageW - margin, 18, { align: "right" });
  doc.setDrawColor(40);
  doc.setLineWidth(0.3);
  doc.line(margin, 25, pageW - margin, 25);

  doc.setTextColor(20, 16, 10);
  doc.setFont("FreeSans", "normal");
  doc.setFontSize(9);
  doc.text(`${match.round}. kolo${when ? `  ·  ${when}` : ""}`, margin, 31);
  doc.setFont("FreeSans", "bold");
  doc.setFontSize(11);
  doc.text(`DOMAČI: ${home}`, margin, 38);
  doc.text(`GOSTI: ${away}`, pageW / 2 + 4, 38);

  let y = 47;
  const tableW = pageW - margin * 2;
  const tableHead = {
    font: "FreeSans",
    fontStyle: "bold" as const,
    fillColor: [255, 255, 255] as [number, number, number],
    textColor: [20, 16, 10] as [number, number, number],
    lineWidth: 0.2,
    lineColor: [40, 40, 40] as [number, number, number],
  };
  // Skupna širina vseh tabel (A4 − robovi), da so v isti liniji.
  const roundCols = {
    0: { cellWidth: 10 },
    1: { cellWidth: 10 },
    2: { halign: "left" as const, cellWidth: 50 },
    3: { cellWidth: 16 },
    4: { cellWidth: 12, fontStyle: "bold" as const, fillColor: [245, 225, 74] as [number, number, number] },
    5: { cellWidth: 12, fontStyle: "bold" as const, fillColor: [245, 225, 74] as [number, number, number] },
    6: { cellWidth: 16 },
    7: { halign: "left" as const, cellWidth: 50 },
    8: { cellWidth: 10 },
  };
  const lineupCols = {
    0: { cellWidth: 10 },
    1: { halign: "left" as const, cellWidth: 45 },
    2: { cellWidth: 12 },
    3: { cellWidth: 14 },
    4: { cellWidth: 12 },
    5: { cellWidth: 10 },
    6: { halign: "left" as const, cellWidth: 45 },
    7: { cellWidth: 12 },
    8: { cellWidth: 14 },
    9: { cellWidth: 12 },
  };
  const totalsCols = {
    0: { halign: "left" as const, fontStyle: "bold" as const, cellWidth: tableW - 96 },
    1: { cellWidth: 24 },
    2: { cellWidth: 24 },
    3: { cellWidth: 24 },
    4: { cellWidth: 24 },
  };

  for (let ri = 0; ri < 4; ri++) {
    const round = match.rounds[ri];
    const roundTot = totals.rounds[ri];
    const body = (round?.games ?? []).map((game, gi) => {
      const slots = template[ri]?.[gi];
      const duel = scoreGame(game, state.players);
      return [
        String(game.lane),
        slots ? slotLabel("home", slots.homeSlot) : "",
        players.get(game.homePlayerId)?.name ?? "",
        scoredPins(game.homePins, players.get(game.homePlayerId)) ?? "",
        duel ? String(duel.homeTotal) : "",
        duel ? String(duel.awayTotal) : "",
        scoredPins(game.awayPins, players.get(game.awayPlayerId)) ?? "",
        players.get(game.awayPlayerId)?.name ?? "",
        slots ? slotLabel("away", slots.awaySlot) : "",
      ];
    });
    doc.setFont("FreeSans", "bold");
    doc.setFontSize(9);
    doc.text(`${ri + 1}. KROG`, margin, y);
    y += 1.5;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: tableW,
      pageBreak: "avoid",
      styles: { font: "FreeSans", fontSize: 8, cellPadding: 1.1, textColor: [20, 16, 10], halign: "center" },
      headStyles: tableHead,
      bodyStyles: { lineWidth: 0.15, lineColor: [160, 160, 160] },
      columnStyles: roundCols,
      head: [["S", "", "Priimek in ime", "Rez.", "T", "T", "Rez.", "Priimek in ime", ""]],
      body,
    });
    y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 4;
    if (roundTot) {
      doc.setFont("FreeSans", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 16, 10);
      const tLine = `Seštevek T ${roundTot.homeSmall}:${roundTot.awaySmall}${
        roundTot.complete
          ? `  ·  velike ${roundTot.homeBig}:${roundTot.awayBig}  ·  keglji ${roundTot.homePins}:${roundTot.awayPins}`
          : ""
      }`;
      doc.text(tLine, margin, y);
      y += 6;
    }
  }

  const homeLine = [...match.homeStarters, ...match.homeBench];
  const awayLine = [...match.awayStarters, ...match.awayBench];
  const sl = (n: number) => n.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const playerMatchStats = (playerId: string) => {
    let games = 0;
    let points = 0;
    let pins = 0;
    if (!playerId) return { games, points, pins };
    const player = players.get(playerId);
    for (const round of match.rounds) {
      for (const game of round.games) {
        if (game.homePlayerId === playerId && game.homePins != null) {
          const hp = game.homePins === 0 ? 0 : scoredPins(game.homePins, player);
          if (hp == null) continue;
          games += 1;
          pins += hp;
          const duel = scoreGame(game, state.players);
          if (duel) points += duel.homeTotal;
        } else if (game.awayPlayerId === playerId && game.awayPins != null) {
          const ap = game.awayPins === 0 ? 0 : scoredPins(game.awayPins, player);
          if (ap == null) continue;
          games += 1;
          pins += ap;
          const duel = scoreGame(game, state.players);
          if (duel) points += duel.awayTotal;
        }
      }
    }
    return { games, points, pins };
  };
  const playerCols = (playerId: string) => {
    const name = players.get(playerId)?.name ?? "";
    const { games, points, pins } = playerMatchStats(playerId);
    if (!playerId || games === 0) return [name, "", "", ""];
    return [name, String(points), String(pins), sl(pins / games)];
  };
  const lineup = [0, 1, 2, 3, 4, 5].map((i) => [
    slotLabel("home", i),
    ...playerCols(homeLine[i] ?? ""),
    slotLabel("away", i),
    ...playerCols(awayLine[i] ?? ""),
  ]);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: tableW,
    pageBreak: "avoid",
    styles: { font: "FreeSans", fontSize: 7.5, cellPadding: 1, textColor: [20, 16, 10], halign: "center" },
    headStyles: tableHead,
    bodyStyles: { lineWidth: 0.15, lineColor: [160, 160, 160] },
    columnStyles: lineupCols,
    head: [["", "Domači", "T", "Rez.", "Pov.", "", "Gostje", "T", "Rez.", "Pov."]],
    body: lineup,
  });
  y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 4;

  let homeGames = 0;
  let awayGames = 0;
  for (const round of match.rounds) {
    for (const game of round.games) {
      if (game.homePins != null) homeGames += 1;
      if (game.awayPins != null) awayGames += 1;
    }
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: tableW,
    pageBreak: "avoid",
    styles: { font: "FreeSans", fontSize: 9, cellPadding: 1.5, textColor: [20, 16, 10], halign: "center" },
    headStyles: tableHead,
    bodyStyles: { lineWidth: 0.15, lineColor: [160, 160, 160] },
    columnStyles: totalsCols,
    head: [["", "Skupaj", "Povp.", "Sk. točk", "Rezultat"]],
    body: [
      [home, totals.homePins, homeGames ? sl(totals.homePins / homeGames) : "—", totals.homeBig, totals.complete ? totals.homeMatch : "—"],
      [away, totals.awayPins, awayGames ? sl(totals.awayPins / awayGames) : "—", totals.awayBig, totals.complete ? totals.awayMatch : "—"],
    ],
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 4 || !totals.complete) return;
      const higher =
        (data.row.index === 0 && totals.homeMatch > totals.awayMatch) ||
        (data.row.index === 1 && totals.awayMatch > totals.homeMatch);
      if (higher) {
        data.cell.styles.fillColor = [245, 225, 74];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return {
    filename: `zapisnik-${match.round}-kolo-${fileSafe(home)}-${fileSafe(away)}.pdf`,
    doc,
  };
}

export async function exportRoundPdfs(state: LeagueState, round: number): Promise<void> {
  const zip = new JSZip();
  const matches = state.matches
    .filter((m) => m.round === round)
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  for (const match of matches) {
    const built = await buildMatchPdf(state, match.id);
    if (built) zip.file(built.filename, built.doc.output("blob"));
  }
  const standings = await buildStandingsPdf(state);
  zip.file(standings.filename, standings.doc.output("blob"));
  const players = await buildPlayersPdf(state);
  zip.file(players.filename, players.doc.output("blob"));
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `bowling-liga-kolo-${round}.zip`);
}

function fileSafe(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9čćžšđ]+/gi, "-")
    .replace(/^-|-$/g, "") || "ekipa";
}

export async function exportRegistrationPdf(state: LeagueState, teamId?: string): Promise<void> {
  const teams = teamId ? state.teams.filter((t) => t.id === teamId) : state.teams;
  if (teams.length === 0) return;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await withFonts(doc);
  const date = new Date().toLocaleDateString("sl-SI");
  const season = state.seasonTitle ?? seasonLabel();

  teams.forEach((team, i) => {
    if (i > 0) doc.addPage();
    drawRegistrationPage(doc, state, team, date, season);
  });

  const name =
    teams.length === 1
      ? `prijavni-list-${fileSafe(teams[0].name)}.pdf`
      : "prijavni-listi-lige.pdf";
  doc.save(name);
}
