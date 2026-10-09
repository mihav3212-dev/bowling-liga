import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  computePlayerStandings,
  computeStandings,
  lastCompletedRound,
  playersByAverage,
  playersByHighs,
  seasonLabel,
  teamsByHighs,
  topGames,
  type PlayerStandingRow,
} from "./standings";
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

function playerLabel(row: PlayerStandingRow): string {
  return `${row.player.name}  ${row.teamName}`;
}

export async function exportStandingsPdf(state: LeagueState): Promise<void> {
  const teams = computeStandings(state);
  const players = computePlayerStandings(state);
  const round = lastCompletedRound(state);
  const season = state.seasonTitle ?? seasonLabel();
  const date = new Date().toLocaleDateString("sl-SI");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await withFonts(doc);
  const logo = await imageDataUrl("/logo-bowling-lenart.png");
  doc.setFont("FreeSans", "bold");

  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageW, 34, "F");
  doc.addImage(logo, "PNG", margin, 5, 58, 24);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(`BOWLING LIGA ${season}`, pageW - margin, 14, { align: "right" });
  const roundText = round > 0 ? `PO ${round}. KOLU` : "PRED ZAČETKOM";
  doc.setFontSize(9);
  doc.setTextColor(255, 78, 200);
  doc.text(roundText, pageW - margin, 21, { align: "right" });

  doc.setTextColor(20, 16, 10);
  let y = 42;
  doc.setFontSize(13);
  doc.text(`LESTVICA ${season} ${roundText}`, margin, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    styles: { font: "FreeSans", fontSize: 8, cellPadding: 1.3, textColor: [20, 16, 10] },
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
      1: { halign: "left", cellWidth: 48 },
      9: { fontStyle: "bold" },
    },
    head: [["#", "Ekipa", "T", "Z", "N", "P", "Male", "Keglji", "POV", "Točke"]],
    body: teams.map((row, i) => [
      i + 1,
      row.team.name,
      row.played,
      row.won,
      row.drawn,
      row.lost,
      row.small,
      row.pins,
      row.avg ? row.avg.toFixed(1) : "0.0",
      row.big,
    ]),
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y += 12;
  const colW = (pageW - margin * 2 - 10) / 2;
  const col1 = margin;
  const col2 = margin + colW + 10;

  const highs = topGames(state, 8).map((game) => ({
    name: `${game.playerName}  ${game.teamName}`,
    value: String(game.pins),
  }));
  const team200 = teamsByHighs(teams, "over200")
    .slice(0, 8)
    .map((row) => ({ name: row.team.name, value: String(row.over200) }));
  const team220 = teamsByHighs(teams, "over220")
    .slice(0, 8)
    .map((row) => ({ name: row.team.name, value: String(row.over220) }));
  const team240 = teamsByHighs(teams, "over240")
    .slice(0, 8)
    .map((row) => ({ name: row.team.name, value: String(row.over240) }));
  const byPoints = players.slice(0, 5).map((row) => ({
    name: playerLabel(row),
    value: String(row.points),
  }));
  const byAvg = playersByAverage(players)
    .slice(0, 5)
    .map((row) => ({
      name: playerLabel(row),
      value: row.avg.toFixed(1),
    }));
  const p200 = playersByHighs(players, "over200")
    .slice(0, 5)
    .map((row) => ({ name: playerLabel(row), value: String(row.over200) }));

  let yLeft = line(doc, team200, col1, y, colW, "NAJVEČ IGER NAD 200 — EKIPE");
  yLeft = line(doc, team220, col1, yLeft, colW, "NAJVEČ IGER NAD 220 — EKIPE");
  yLeft = line(doc, team240, col1, yLeft, colW, "NAJVEČ IGER NAD 240 — EKIPE");
  let yRight = line(doc, highs, col2, y, colW, "NAJVIŠJI REZULTATI");
  yRight = line(doc, p200, col2, yRight, colW, "NAJVEČ IGER NAD 200 — IGRALCI");
  yRight = line(doc, byPoints, col2, yRight, colW, "TOP 5 — MALE TOČKE");
  yRight = line(doc, byAvg, col2, yRight, colW, "TOP 5 — POVPREČJE");

  doc.setFont("FreeSans", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text(
    `Izpis ${date}   Točke ekipe: zmaga 2, remi 1, poraz 0.`,
    margin,
    Math.min(Math.max(yLeft, yRight) + 6, doc.internal.pageSize.getHeight() - 8),
  );

  const name = round > 0 ? `bowling-liga-lestvica-kolo-${round}.pdf` : "bowling-liga-lestvica.pdf";
  doc.save(name);
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
