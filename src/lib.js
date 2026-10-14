// Dato/tid-formatering, lønnsperioder og lønnsberegning. Rene funksjoner, ingen React her.

export const DAY_MS = 24 * 60 * 60 * 1000;

export const MONTH_NAMES = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];
export const MONTH_NAMES_SHORT = [
  "jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des",
];
const WEEKDAY_NAMES_SHORT = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

export const newId = () => Math.random().toString(36).slice(2, 9);

export const pad2 = (n) => String(n).padStart(2, "0");

// ms -> "Xt Ym"
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = pad2(Math.floor((totalSeconds % 3600) / 60));
  return `${hours}t ${minutes}m`;
}

// ms -> "HH:MM:SS", brukt til den tikkende klokka
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = pad2(Math.floor(totalSeconds / 3600));
  const m = pad2(Math.floor((totalSeconds % 3600) / 60));
  const s = pad2(totalSeconds % 60);
  return `${h}:${m}:${s}`;
}

export const msToHours = (ms) => ms / (60 * 60 * 1000);

export const formatMoney = (amount) => `${Math.round(amount).toLocaleString("nb-NO")} kr`;

export const formatDateISO = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const formatTimeHM = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

export function parseDateTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

// "08:47" rundet til nærmeste 5/10/15 min -> "08:45". Ruller over midnatt ved behov.
export function roundTimeToNearest(timeStr, minutes) {
  const [h, m] = timeStr.split(":").map(Number);
  const totalMinutes = h * 60 + m;
  const rounded = Math.round(totalMinutes / minutes) * minutes;
  const wrapped = ((rounded % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
}

// --- Tidshjulet ---------------------------------------------------------
// Start/stopp holdes som ekte Date-objekter, så dagskifte og sommertid håndteres av Date selv.

export const MINUTE_MS = 60 * 1000;

export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * MINUTE_MS);

// Runder et tidspunkt til nærmeste 5/10/15 min (sekundene regnes med).
export function roundDateToNearest(date, minutes) {
  const clockMinutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const rounded = Math.round(clockMinutes / minutes) * minutes;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, rounded);
}

// Flytter stopp slik at varigheten blir et helt antall intervaller (aldri kortere enn ett).
export function roundDurationEnd(start, end, minutes) {
  const steps = Math.max(1, Math.round((end - start) / (minutes * MINUTE_MS)));
  return addMinutes(start, steps * minutes);
}

// Første gang klokka viser `timeStr` etter `start` — samme dag, eller neste dag
// når vakta går over midnatt. Føringer er alltid under ett døgn, så det er entydig.
export function firstTimeAfter(start, timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const sameDay = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hours, minutes);
  return sameDay > start ? sameDay : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, hours, minutes);
}

// Når forrige føring sluttet, sett fra `before` (føringen som redigeres holdes utenfor).
export function previousStopTime(entries, before, excludeId) {
  let latest = null;
  entries.forEach((e) => {
    if (e.id === excludeId) return;
    const end = new Date(e.end);
    if (end <= before && (!latest || end > latest)) latest = end;
  });
  return latest;
}

export const formatWeekdayDate = (date) =>
  `${WEEKDAY_NAMES_SHORT[date.getDay()]} ${date.getDate()}. ${MONTH_NAMES_SHORT[date.getMonth()]}`;

export const formatShortDate = (date) => `${date.getDate()}. ${MONTH_NAMES_SHORT[date.getMonth()]}`;

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Håndterer også gamle jobber som bare har `periodStartDay` i stedet for `period`.
export function getJobPeriodSettings(job) {
  if (job?.period?.type) return job.period;
  const legacyStartDay = job?.periodStartDay || 1;
  return legacyStartDay > 1 ? { type: "customDay", day: legacyStartDay } : { type: "month" };
}

// Finner lønnsperioden (start/slutt/nøkkel) som en gitt dato faller innenfor, for en jobb.
export function getPeriodForDate(date, job) {
  const period = getJobPeriodSettings(job);
  const day = startOfDay(date);

  if (period.type === "month" || period.type === "customDay") {
    const startDay = period.type === "month" ? 1 : Math.min(28, Math.max(1, period.day || 1));
    let year = day.getFullYear();
    let month = day.getMonth();
    if (day.getDate() < startDay) month -= 1;
    const start = new Date(year, month, startDay);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, startDay);
    return { start, end, key: `m${start.getFullYear()}-${pad2(start.getMonth() + 1)}` };
  }

  const lengthDays = period.type === "biweekly" ? 14 : 7;
  const anchor = startOfDay(period.anchor ? parseDateTime(period.anchor, "00:00") : new Date(2026, 0, 5));
  const periodsSinceAnchor = Math.floor(Math.round((day - anchor) / DAY_MS) / lengthDays);
  const start = startOfDay(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + periodsSinceAnchor * lengthDays));
  const end = startOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + lengthDays));
  return { start, end, key: `w${formatDateISO(start)}` };
}

export function formatPeriodLabel(period, job) {
  const type = getJobPeriodSettings(job).type;
  if (type === "month") return `${MONTH_NAMES[period.start.getMonth()]} ${period.start.getFullYear()}`;
  const lastDay = new Date(period.end - DAY_MS);
  return `${formatShortDate(period.start)} – ${formatShortDate(lastDay)} ${lastDay.getFullYear()}`;
}

export function formatPayoutLabel(period, job) {
  const payoutDay = job?.payoutDay;
  if (!payoutDay) return "";
  const lastDay = new Date(period.end - DAY_MS);
  const payoutDate = new Date(lastDay.getFullYear(), lastDay.getMonth() + (job.payoutOffset || 0), Math.min(28, payoutDay));
  return `Utbetales ${payoutDate.getDate()}. ${MONTH_NAMES_SHORT[payoutDate.getMonth()]}`;
}

// De siste `count` periodene for en jobb, nyeste først.
export function getRecentPeriods(job, count = 14) {
  const periods = [];
  let cursor = new Date();
  for (let i = 0; i < count; i++) {
    const period = getPeriodForDate(cursor, job);
    periods.push(period);
    cursor = new Date(period.start.getTime() - DAY_MS);
  }
  return periods;
}

export const rawDurationMs = (entry) => new Date(entry.end) - new Date(entry.start);

export const netDurationMs = (entry) => Math.max(0, rawDurationMs(entry) - (entry.breakMin || 0) * 60000);

// Hvor mye lunsj som skal trekkes for en vakt av gitt varighet, basert på jobbens innstilling.
export function getBreakMinutes(job, durationMs) {
  const breakMin = job?.breakMin || 0;
  if (!breakMin) return 0;
  const threshold = (job?.breakAfterHours || 0) * 60 * 60 * 1000;
  return durationMs >= threshold ? breakMin : 0;
}

// --- Prosjekter ---------------------------------------------------------
// Et prosjekt hører til én jobb: {id, jobId, name, color?}. En føring kan ha `projectId`.
// Sletting er myk: føringene beholder id-en, og vises som "(slettet prosjekt)".

export const NO_PROJECT_LABEL = "Uten prosjekt";
export const DELETED_PROJECT_LABEL = "(slettet prosjekt)";

export const projectsForJob = (data, jobId) => (data?.projects || []).filter((p) => p.jobId === jobId);

export const findProject = (data, projectId) =>
  (projectId && (data?.projects || []).find((p) => p.id === projectId)) || null;

// "" når føringen ikke har prosjekt i det hele tatt.
export const projectLabel = (data, projectId) =>
  !projectId ? "" : findProject(data, projectId)?.name || DELETED_PROJECT_LABEL;

export const hoursByProject = (entries, projectId) =>
  msToHours(entries
    .filter((e) => (e.projectId || null) === (projectId || null))
    .reduce((sum, e) => sum + netDurationMs(e), 0));

// Timer per prosjekt, mest først. Føringer uten prosjekt samles i én rad til slutt.
export function projectBreakdown(entries, data) {
  const buckets = new Map();
  entries.forEach((entry) => {
    const key = entry.projectId || null;
    const bucket = buckets.get(key) || { projectId: key, name: "", ms: 0, count: 0 };
    bucket.ms += netDurationMs(entry);
    bucket.count += 1;
    buckets.set(key, bucket);
  });
  return [...buckets.values()]
    .map((b) => ({
      ...b,
      name: b.projectId ? projectLabel(data, b.projectId) : NO_PROJECT_LABEL,
      color: findProject(data, b.projectId)?.color,
      hours: msToHours(b.ms),
    }))
    .sort((a, b) => (a.projectId === null) - (b.projectId === null) || b.ms - a.ms);
}

// Forventet lønn for én føring: 0 for fastlønn, ellers timer * (timelønn + eventuelle tillegg).
export function calcEarnings(entry, job) {
  if (!job || job.kind === "fixed") return 0;
  const hours = msToHours(netDurationMs(entry));
  const supRateSum = (entry.sups || []).reduce(
    (sum, supId) => sum + (job.sups.find((s) => s.id === supId)?.rate || 0),
    0
  );
  return hours * ((job.rate || 0) + supRateSum);
}

// --- Rapport ------------------------------------------------------------
// Aggregering for rapportfanen. Perioden er alltid [start, end) med start på døgnskillet,
// og en føring hører til dagen den startet — samme regel som resten av appen bruker.

export const REPORT_RANGES = [
  ["uke", "Denne uken"],
  ["maned", "Denne måneden"],
  ["3mnd", "Siste 3 måneder"],
  ["ar", "I år"],
];

export function getReportRange(preset, now = new Date()) {
  const day = startOfDay(now);
  if (preset === "uke") {
    const mondayOffset = (day.getDay() + 6) % 7;
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate() - mondayOffset);
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
  }
  if (preset === "ar") {
    return { start: new Date(day.getFullYear(), 0, 1), end: new Date(day.getFullYear() + 1, 0, 1) };
  }
  const monthsBack = preset === "3mnd" ? 2 : 0;
  return {
    start: new Date(day.getFullYear(), day.getMonth() - monthsBack, 1),
    end: new Date(day.getFullYear(), day.getMonth() + 1, 1),
  };
}

export const entriesInRange = (entries, start, end) =>
  entries.filter((e) => {
    const entryStart = new Date(e.start);
    return entryStart >= start && entryStart < end;
  });

// Nøkkeltallene øverst i rapporten. `hasGross` er falsk når ingen av føringene
// hører til en timelønnet jobb — da sier et bruttotall ingenting.
export function summarizeEntries(entries, jobs) {
  const totalMs = entries.reduce((sum, e) => sum + netDurationMs(e), 0);
  const gross = entries.reduce((sum, e) => sum + calcEarnings(e, jobs.find((j) => j.id === e.jobId)), 0);
  return {
    totalMs,
    count: entries.length,
    avgMs: entries.length ? totalMs / entries.length : 0,
    gross,
    hasGross: entries.some((e) => jobs.find((j) => j.id === e.jobId)?.kind === "hourly"),
  };
}

// Dagsøyler blir uleselige over lange perioder, så lange perioder grupperes grovere.
export const bucketUnitForRange = (preset) =>
  preset === "ar" ? "maned" : preset === "3mnd" ? "uke" : "dag";

// Søylene i diagrammet: én bøtte per dag/uke/måned i perioden, også de tomme,
// så diagrammet viser hullene like tydelig som toppene.
export function bucketTotals(entries, start, end, unit = "dag") {
  const nextStart = (d) => {
    if (unit === "maned") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (unit === "uke" ? 7 : 1));
  };

  const buckets = [];
  for (let cursor = new Date(start); cursor < end; cursor = nextStart(cursor)) {
    const bucketEnd = nextStart(cursor);
    buckets.push({ date: cursor, end: bucketEnd > end ? new Date(end) : bucketEnd, ms: 0, byJob: {} });
  }

  entriesInRange(entries, start, end).forEach((entry) => {
    const entryStart = new Date(entry.start);
    const bucket = buckets.find((b) => entryStart >= b.date && entryStart < b.end);
    if (!bucket) return;
    const ms = netDurationMs(entry);
    bucket.ms += ms;
    bucket.byJob[entry.jobId] = (bucket.byJob[entry.jobId] || 0) + ms;
  });
  return buckets;
}

// Én rad per dag i perioden — også dagene uten føringer, så stolpediagrammet får riktig bredde.
export const dailyTotals = (entries, start, end) => bucketTotals(entries, start, end, "dag");

// Timer og brutto per jobb, mest først. Jobber uten føringer i perioden tas ikke med.
export function jobBreakdown(entries, jobs) {
  const buckets = new Map();
  entries.forEach((entry) => {
    const bucket = buckets.get(entry.jobId) || { jobId: entry.jobId, ms: 0, count: 0, gross: 0 };
    bucket.ms += netDurationMs(entry);
    bucket.count += 1;
    bucket.gross += calcEarnings(entry, jobs.find((j) => j.id === entry.jobId));
    buckets.set(entry.jobId, bucket);
  });
  return [...buckets.values()]
    .map((b) => {
      const job = jobs.find((j) => j.id === b.jobId);
      return { ...b, name: job?.name || "Slettet jobb", color: job?.color || "#66798a", kind: job?.kind, hours: msToHours(b.ms) };
    })
    .sort((a, b) => b.ms - a.ms);
}
