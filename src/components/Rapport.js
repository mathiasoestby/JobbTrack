// Rapportfanen: nøkkeltall og enkle grafer for en valgt periode.
// Grafene er håndrullet inline SVG/CSS — appen er offline-first, og et
// CDN-hentet diagrambibliotek ville vært en unødvendig ekstern avhengighet.
import { h, Fragment, useState } from "../react.js";
import {
  DAY_MS, REPORT_RANGES, getReportRange, entriesInRange, summarizeEntries,
  bucketTotals, bucketUnitForRange, jobBreakdown, projectBreakdown, findProject,
  msToHours, formatDuration, formatMoney, formatShortDate, MONTH_NAMES_SHORT,
} from "../lib.js";

const WEEKDAY_LETTERS = ["sø", "ma", "ti", "on", "to", "fr", "lø"];
const MUTED = "#66798a";

const hoursText = (ms) => `${msToHours(ms).toFixed(2).replace(".", ",")} t`;

export function Rapport({ data }) {
  const [preset, setPreset] = useState("maned");
  const { start, end } = getReportRange(preset);
  const lastDay = new Date(end - DAY_MS);

  const entries = entriesInRange(data.entries, start, end);
  const summary = summarizeEntries(entries, data.jobs);
  const unit = bucketUnitForRange(preset);
  const buckets = bucketTotals(entries, start, end, unit);
  const jobRows = jobBreakdown(entries, data.jobs);
  const usesProjects = (data.projects || []).length > 0 || entries.some((e) => e.projectId);
  const projectRows = usesProjects ? projectBreakdown(entries, data) : [];
  // Prosjektene arver fargen til jobben de hører til; slettede og prosjektløse timer blir grå.
  const projectColor = (row) => row.color
    || data.jobs.find((j) => j.id === findProject(data, row.projectId)?.jobId)?.color
    || MUTED;

  return h(Fragment, null,
    h("h1", null, "Rapport"),
    h("p", { className: "sub" }, "Hvor timene faktisk blir av."),
    h("div", { className: "row", style: { marginBottom: 12 } },
      REPORT_RANGES.map(([key, label]) => h("button", {
        key, className: "chip", "data-on": preset === key ? "1" : "0", onClick: () => setPreset(key),
      }, label))
    ),

    entries.length === 0
      ? h("div", { className: "card" },
          h("div", { className: "empty" },
            "Ingen føringer mellom ", formatShortDate(start), " og ", formatShortDate(lastDay), ". ",
            "Velg en lengre periode, eller før timer under Klokke."
          )
        )
      : h(Fragment, null,
          h("div", { className: "card" },
            h("div", { className: "cal-sub" },
              formatShortDate(start), " – ", formatShortDate(lastDay), " ", lastDay.getFullYear()
            ),
            h("div", { className: "stat-grid" },
              h(Nokkeltall, { label: "Timer", value: formatDuration(summary.totalMs), sub: hoursText(summary.totalMs) }),
              h(Nokkeltall, { label: "Vakter", value: String(summary.count), sub: `snitt ${formatDuration(summary.avgMs)}` }),
              summary.hasGross && h(Nokkeltall, {
                label: "Brutto timelønn", value: formatMoney(summary.gross), sub: "før skatt, uten fastlønn",
              }),
              h(Nokkeltall, {
                label: unit === "dag" ? "Dager med arbeid" : "Perioder med arbeid",
                value: String(buckets.filter((b) => b.ms > 0).length),
                sub: `av ${buckets.length}`,
              })
            )
          ),

          h("h2", null, "Arbeidstid per ", { dag: "dag", uke: "uke", maned: "måned" }[unit]),
          h("div", { className: "card" }, h(Soylediagram, { buckets, jobs: data.jobs, unit, preset })),

          h("h2", null, "Fordeling per jobb"),
          h("div", { className: "card" }, h(JobbFordeling, { rows: jobRows, totalMs: summary.totalMs })),

          projectRows.length > 0 && h(Fragment, null,
            h("h2", null, "Fordeling per prosjekt"),
            h("div", { className: "card" },
              projectRows.map((row) => h(StolpeRad, {
                key: row.projectId || "ingen",
                name: row.name,
                color: projectColor(row),
                ms: row.ms,
                count: row.count,
                totalMs: summary.totalMs,
              }))
            )
          )
        )
  );
}

function Nokkeltall({ label, value, sub }) {
  return h("div", { className: "stat" },
    h("b", { className: "num" }, value),
    h("span", null, label, sub ? ` · ${sub}` : "")
  );
}

// Stablede søyler: én kolonne per dag/uke/måned, fargelagt per jobb.
// SVG-en strekkes fritt i bredden (preserveAspectRatio="none"); all tekst ligger
// i HTML-en under, så ingenting blir forvrengt.
function Soylediagram({ buckets, jobs, unit, preset }) {
  const maxMs = Math.max(...buckets.map((b) => b.ms), 0);
  const columnWidth = 10;
  const width = buckets.length * columnWidth;
  // Jobbene i fast rekkefølge, så stablingen ikke hopper mellom søylene.
  const stackOrder = [...new Set(buckets.flatMap((b) => Object.keys(b.byJob)))]
    .sort((a, b) => jobs.findIndex((j) => j.id === a) - jobs.findIndex((j) => j.id === b));

  if (maxMs === 0) return h("div", { className: "empty" }, "Ingen timer i denne perioden.");

  return h(Fragment, null,
    h("div", { className: "cal-sub" }, "Høyeste søyle: ", formatDuration(maxMs)),
    h("svg", {
      className: "chart", viewBox: `0 0 ${width} 100`, preserveAspectRatio: "none",
      role: "img", "aria-label": `Arbeidstid per ${unit}`,
    },
      buckets.map((bucket, i) => {
        const x = i * columnWidth + 1;
        let cursorY = 100;
        return h("g", { key: i },
          h("rect", { x, y: 0, width: columnWidth - 2, height: 100, fill: "#121b23" }),
          stackOrder.map((jobId) => {
            const ms = bucket.byJob[jobId] || 0;
            if (!ms) return null;
            const height = (ms / maxMs) * 100;
            cursorY -= height;
            return h("rect", {
              key: jobId, x, y: cursorY, width: columnWidth - 2, height,
              fill: jobs.find((j) => j.id === jobId)?.color || MUTED,
            });
          }),
          h("title", null, `${fullLabel(bucket, unit)}: ${formatDuration(bucket.ms)}`)
        );
      })
    ),
    h("div", { className: "chart-labels num" },
      buckets.map((bucket, i) => h("span", { key: i }, shortLabel(bucket, i, unit, preset)))
    )
  );
}

function fullLabel(bucket, unit) {
  const d = bucket.date;
  if (unit === "maned") return `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  if (unit === "uke") return `uke fra ${formatShortDate(d)}`;
  return formatShortDate(d);
}

// Tett med søyler gir ikke plass til alle merkelappene — vis bare et lesbart utvalg.
function shortLabel(bucket, i, unit, preset) {
  const d = bucket.date;
  if (unit === "maned") return MONTH_NAMES_SHORT[d.getMonth()];
  if (unit === "uke") return i % 2 === 0 ? `${d.getDate()}.${d.getMonth() + 1}` : "";
  if (preset === "uke") return WEEKDAY_LETTERS[d.getDay()];
  return d.getDate() === 1 || d.getDate() % 5 === 0 ? String(d.getDate()) : "";
}

// Ringdiagram + forklaring. Ringen er én sirkel per jobb med stroke-dasharray
// som andel av omkretsen (satt til 100 via radien), forskjøvet til å starte øverst.
function JobbFordeling({ rows, totalMs }) {
  const radius = 15.915; // omkrets = 100
  let offset = 25; // start klokka 12
  const arcs = rows.map((row) => {
    const share = totalMs > 0 ? (row.ms / totalMs) * 100 : 0;
    const arc = { ...row, share, dash: `${share} ${100 - share}`, offset };
    offset = (offset - share + 100) % 100;
    return arc;
  });

  return h("div", { className: "donut-wrap" },
    h("svg", { className: "donut", viewBox: "0 0 42 42", role: "img", "aria-label": "Fordeling per jobb" },
      h("circle", { cx: 21, cy: 21, r: radius, fill: "none", stroke: "#121b23", strokeWidth: 5 }),
      arcs.map((arc) => h("circle", {
        key: arc.jobId, cx: 21, cy: 21, r: radius, fill: "none",
        stroke: arc.color, strokeWidth: 5,
        strokeDasharray: arc.dash, strokeDashoffset: arc.offset,
      })),
      h("text", {
        x: 21, y: 21.6, textAnchor: "middle", fill: "#e8edf1",
        style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 6, fontWeight: 600 },
      }, msToHours(totalMs).toFixed(1).replace(".", ",")),
      h("text", {
        x: 21, y: 25.8, textAnchor: "middle", fill: "#8fa3b0",
        style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 3.2 },
      }, "timer")
    ),
    h("div", { className: "donut-legend" },
      arcs.map((arc) => h("div", { className: "kv", key: arc.jobId },
        h("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } },
          h("span", { className: "dot", style: { background: arc.color } }), arc.name
        ),
        h("span", { className: "num" },
          formatDuration(arc.ms), " · ", Math.round(arc.share), " %",
          arc.kind === "hourly" && arc.gross > 0 ? ` · ${formatMoney(arc.gross)}` : ""
        )
      ))
    )
  );
}

function StolpeRad({ name, color, ms, count, totalMs }) {
  const share = totalMs > 0 ? (ms / totalMs) * 100 : 0;
  return h("div", { className: "bar-row" },
    h("div", { className: "bar-head" },
      h("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, name),
      h("span", { className: "num" }, formatDuration(ms), " · ", count, count === 1 ? " vakt" : " vakter")
    ),
    h("div", { className: "bar-track" },
      h("div", { className: "bar-fill", style: { width: `${Math.max(share, 1.5)}%`, background: color } })
    )
  );
}
