
import type { Report } from "./report.js";

export type CardTheme = "light" | "dark";

const escapeXml = (value: string): string =>
  value.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const number = (value: number): string =>
  value.toLocaleString("en-US");

const percentage = (value: number): string =>
  `${(value * 100).toFixed(1)}%`;

export function cardFor(
  report: Report,
  theme: CardTheme = "light",
  reportFile = "workproof-report.json",
): string {
  if (report.repositories.length === 0) {
    throw new Error("the report has no repositories");
  }
  if (report.repositories.length > 1) {
    throw new Error("--card supports only one repository");
  }
  const repo = report.repositories[0]!;
  const figure = (id: string) => {
    const result = repo.figures.find((item) => item.id === id);
    if (!result) throw new Error(`the report has no ${id} figure`);
    return result.value as Record<string, unknown>;
  };

  const surviving = figure("survivingLines");
  const commits = figure("commitShare");
  const tenure = figure("tenure");
  const files = figure("filesAuthored");

  const metrics = [
    {
      label: "SURVIVING LINES",
      value: number(surviving.lines as number),
      detail: [
      `${percentage(surviving.share as number)} of surviving lines`,
      typeof surviving.sample === "number" && surviving.sample > 1
        ? `1 in ${number(surviving.sample)} files sampled`
        : null,
    ]
      .filter((part): part is string => part !== null)
      .join(" · "),
    },
    {
      label: "COMMIT SHARE",
      value: percentage(commits.share as number),
      detail: `${number(commits.author as number)} / ${number(commits.total as number)} commits`,
    },
    {
      label: "TENURE",
      value: number(tenure.days as number),
      detail: "days of contribution",
    },
    {
      label: "FILES AUTHORED",
      value: number(files.authored as number),
      detail: `${number(files.total as number)} files at HEAD`,
    },
  ];

  const dark = theme === "dark";

  const c = dark
    ? {
        bg: "#101114",
        fg: "#f0f0f0",
        muted: "#92949d",
        line: "#303137",
        accent: "#b9f27c",
      }
    : {
        bg: "#ffffff",
        fg: "#171717",
        muted: "#777777",
        line: "#e5e5e5",
        accent: "#365e29",
      };

  const cells = metrics.map((metric, index) => {
    const x = 24 + index * 116;

    return `
      <g>
        <text
          x="${x}"
          y="83"
          font-family="Arial, Helvetica, sans-serif"
          font-size="8"
          font-weight="600"
          letter-spacing="0.8"
          fill="${c.muted}"
        >${escapeXml(metric.label)}</text>

        <text
          x="${x}"
          y="111"
          font-family="Arial, Helvetica, sans-serif"
          font-size="22"
          font-weight="600"
          letter-spacing="-0.8"
          fill="${c.fg}"
        >${escapeXml(metric.value)}</text>

        <text
          x="${x}"
          y="130"
          font-family="Arial, Helvetica, sans-serif"
          font-size="8.5"
          fill="${c.muted}"
        >${escapeXml(metric.detail)}</text>
      </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg"
  width="500" height="180" viewBox="0 0 500 180"
  role="img" aria-label="Workproof repository report">

  <rect width="500" height="180" fill="${c.bg}"/>
  <rect width="500" height="3" fill="${c.accent}"/>

  <g font-family="Arial, Helvetica, sans-serif">
    <text
      x="24" y="29"
      font-size="13"
      font-weight="700"
      letter-spacing="-0.3"
      fill="${c.fg}"
    >workproof<tspan fill="${c.accent}">.</tspan></text>

    <text
      x="24" y="46"
      font-size="9"
      fill="${c.muted}"
    >REPOSITORY REPORT</text>
    <text
      x="476" y="29"
      text-anchor="end"
      font-family="monospace"
      font-size="9"
      fill="${c.muted}"
    >${escapeXml(repo.head.slice(0, 12))}</text>
    <line x1="24" y1="57" x2="476" y2="57" stroke="${c.line}"/>
    ${cells}
    <line x1="24" y1="148" x2="476" y2="148" stroke="${c.line}"/>
    <circle cx="28" cy="164" r="3" fill="${c.accent}"/>
    <text
      x="38" y="167"
      font-size="8.5"
      font-weight="600"
      fill="${c.fg}"
    >VERIFY</text>
    <text
      x="84" y="167"
      font-size="8.5"
      fill="${c.muted}"
    >npx workproof check ${escapeXml(reportFile)}</text>
  </g>
</svg>`;
}
