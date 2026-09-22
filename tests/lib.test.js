// Kjøres med `npm test` (node --test tests/). Ingen eksterne avhengigheter —
// bare Node sin innebygde testkjører, siden src/lib.js er rene funksjoner uten React/DOM.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  pad2, formatDuration, formatClock, msToHours, formatMoney,
  formatDateISO, formatTimeHM, parseDateTime, formatWeekdayDate, formatShortDate,
  startOfDay, getJobPeriodSettings, getPeriodForDate, formatPeriodLabel, formatPayoutLabel,
  getRecentPeriods, rawDurationMs, netDurationMs, getBreakMinutes, calcEarnings,
  roundTimeToNearest, DAY_MS,
  projectsForJob, findProject, projectLabel, hoursByProject, projectBreakdown,
} from "../src/lib.js";

describe("formatering", () => {
  test("pad2 legger til ledende null", () => {
    assert.equal(pad2(3), "03");
    assert.equal(pad2(12), "12");
  });

  test("formatDuration viser timer og minutter", () => {
    assert.equal(formatDuration(3 * 3600000 + 45 * 60000), "3t 45m");
    assert.equal(formatDuration(0), "0t 00m");
    assert.equal(formatDuration(-1000), "0t 00m"); // negativ varighet skal aldri vises
  });

  test("formatClock viser HH:MM:SS", () => {
    assert.equal(formatClock(3661 * 1000), "01:01:01");
    assert.equal(formatClock(59 * 1000), "00:00:59");
  });

  test("msToHours regner om millisekunder til timer", () => {
    assert.equal(msToHours(3600000), 1);
    assert.equal(msToHours(1800000), 0.5);
  });

  test("formatMoney runder og legger til 'kr'", () => {
    assert.equal(formatMoney(250), "250 kr");
    assert.equal(formatMoney(199.6), "200 kr");
  });

  test("formatDateISO/formatTimeHM/parseDateTime henger sammen", () => {
    const d = new Date(2026, 2, 5, 8, 30);
    assert.equal(formatDateISO(d), "2026-03-05");
    assert.equal(formatTimeHM(d), "08:30");
    assert.deepEqual(parseDateTime("2026-03-05", "08:30"), d);
  });

  test("formatWeekdayDate og formatShortDate", () => {
    const d = new Date(2026, 0, 5); // mandag 5. januar 2026
    assert.equal(formatWeekdayDate(d), "man 5. jan");
    assert.equal(formatShortDate(d), "5. jan");
  });

  test("startOfDay nullstiller klokkeslett", () => {
    const d = new Date(2026, 5, 10, 14, 22, 33);
    const s = startOfDay(d);
    assert.equal(s.getHours(), 0);
    assert.equal(s.getMinutes(), 0);
    assert.equal(s.getDate(), 10);
  });

  test("roundTimeToNearest runder til nærmeste intervall, med overrulling ved midnatt", () => {
    assert.equal(roundTimeToNearest("08:47", 5), "08:45");
    assert.equal(roundTimeToNearest("08:48", 5), "08:50");
    assert.equal(roundTimeToNearest("23:58", 5), "00:00");
    assert.equal(roundTimeToNearest("00:02", 5), "00:00");
    assert.equal(roundTimeToNearest("09:07", 15), "09:00");
    assert.equal(roundTimeToNearest("12:35", 10), "12:40");
  });
});

describe("lønnsperioder", () => {
  test("getJobPeriodSettings faller tilbake på gammel periodStartDay", () => {
    assert.deepEqual(getJobPeriodSettings({ period: { type: "weekly" } }), { type: "weekly" });
    assert.deepEqual(getJobPeriodSettings({ periodStartDay: 16 }), { type: "customDay", day: 16 });
    assert.deepEqual(getJobPeriodSettings({ periodStartDay: 1 }), { type: "month" });
    assert.deepEqual(getJobPeriodSettings({}), { type: "month" });
  });

  test("getPeriodForDate: kalendermåned", () => {
    const job = { period: { type: "month" } };
    const p1 = getPeriodForDate(new Date(2026, 2, 15), job);
    assert.equal(formatDateISO(p1.start), "2026-03-01");
    assert.equal(formatDateISO(p1.end), "2026-04-01");
    assert.equal(p1.key, "m2026-03");

    const p2 = getPeriodForDate(new Date(2026, 2, 1), job);
    assert.equal(formatDateISO(p2.start), "2026-03-01");
  });

  test("getPeriodForDate: fast dato i måneden (customDay), før og etter startdagen", () => {
    const job = { period: { type: "customDay", day: 16 } };

    const before = getPeriodForDate(new Date(2026, 2, 10), job); // 10. mars, før den 16.
    assert.equal(formatDateISO(before.start), "2026-02-16");
    assert.equal(formatDateISO(before.end), "2026-03-16");
    assert.equal(before.key, "m2026-02");

    const after = getPeriodForDate(new Date(2026, 2, 20), job); // 20. mars, etter den 16.
    assert.equal(formatDateISO(after.start), "2026-03-16");
    assert.equal(formatDateISO(after.end), "2026-04-16");
  });

  test("getPeriodForDate: ukentlig, ankret til en mandag", () => {
    const job = { period: { type: "weekly", anchor: "2026-01-05" } }; // mandag

    const sameWeek = getPeriodForDate(new Date(2026, 0, 11), job); // søndag, 6 dager inn
    assert.equal(formatDateISO(sameWeek.start), "2026-01-05");
    assert.equal(formatDateISO(sameWeek.end), "2026-01-12");

    const nextWeek = getPeriodForDate(new Date(2026, 0, 12), job); // nøyaktig 7 dager etter anker
    assert.equal(formatDateISO(nextWeek.start), "2026-01-12");
    assert.equal(formatDateISO(nextWeek.end), "2026-01-19");
  });

  test("getPeriodForDate: hver fjortende dag", () => {
    const job = { period: { type: "biweekly", anchor: "2026-01-05" } };

    const firstPeriod = getPeriodForDate(new Date(2026, 0, 18), job); // dag 13, fortsatt periode 0
    assert.equal(formatDateISO(firstPeriod.start), "2026-01-05");
    assert.equal(formatDateISO(firstPeriod.end), "2026-01-19");

    const secondPeriod = getPeriodForDate(new Date(2026, 0, 19), job); // dag 14, ny periode
    assert.equal(formatDateISO(secondPeriod.start), "2026-01-19");
  });

  test("formatPeriodLabel: månedlig vs. datospenn", () => {
    const monthJob = { period: { type: "month" } };
    const monthPeriod = getPeriodForDate(new Date(2026, 2, 15), monthJob);
    assert.equal(formatPeriodLabel(monthPeriod, monthJob), "mars 2026");

    const weeklyJob = { period: { type: "weekly", anchor: "2026-01-05" } };
    const weeklyPeriod = getPeriodForDate(new Date(2026, 0, 6), weeklyJob);
    assert.equal(formatPeriodLabel(weeklyPeriod, weeklyJob), "5. jan – 11. jan 2026");
  });

  test("formatPayoutLabel: tom streng uten lønningsdag, ellers utbetalingsdato", () => {
    const job = { period: { type: "customDay", day: 16 }, payoutDay: 20, payoutOffset: 1 };
    const period = getPeriodForDate(new Date(2026, 2, 20), job); // periode 16. mars – 16. april
    assert.equal(formatPayoutLabel(period, job), "Utbetales 20. mai");
    assert.equal(formatPayoutLabel(period, { ...job, payoutDay: 0 }), "");
  });

  test("getRecentPeriods returnerer periodene i synkende rekkefølge uten hull", () => {
    const job = { period: { type: "month" } };
    const periods = getRecentPeriods(job, 3);
    assert.equal(periods.length, 3);
    // hver periode skal slutte akkurat der forrige startet
    assert.equal(periods[0].start.getTime(), periods[1].end.getTime());
    assert.equal(periods[1].start.getTime(), periods[2].end.getTime());
  });
});

describe("varighet og lønnsberegning", () => {
  test("rawDurationMs/netDurationMs trekker fra lunsj", () => {
    const entry = { start: "2026-03-05T08:00:00", end: "2026-03-05T16:00:00", breakMin: 45 };
    assert.equal(rawDurationMs(entry), 8 * 3600000);
    assert.equal(netDurationMs(entry), 8 * 3600000 - 45 * 60000);
  });

  test("netDurationMs går aldri under null", () => {
    const entry = { start: "2026-03-05T08:00:00", end: "2026-03-05T08:30:00", breakMin: 999 };
    assert.equal(netDurationMs(entry), 0);
  });

  test("getBreakMinutes bruker terskel for vaktlengde", () => {
    const job = { breakMin: 30, breakAfterHours: 6 };
    assert.equal(getBreakMinutes(job, 5 * 3600000), 0);
    assert.equal(getBreakMinutes(job, 6 * 3600000), 30);
    assert.equal(getBreakMinutes(job, 8 * 3600000), 30);
    assert.equal(getBreakMinutes({ breakMin: 0, breakAfterHours: 0 }, 8 * 3600000), 0);
  });

  test("calcEarnings: 0 for fastlønn, timer * (sats + tillegg) for timelønn", () => {
    const hourlyJob = { kind: "hourly", rate: 200, sups: [{ id: "kveld", rate: 50 }] };
    const fixedJob = { kind: "fixed", rate: 0 };
    const entry = { start: "2026-03-05T08:00:00", end: "2026-03-05T16:00:00", breakMin: 30, sups: [] };

    assert.equal(calcEarnings(entry, fixedJob), 0);
    assert.equal(calcEarnings(entry, hourlyJob), 7.5 * 200);
    assert.equal(calcEarnings({ ...entry, sups: ["kveld"] }, hourlyJob), 7.5 * 250);
  });
});

describe("prosjekter", () => {
  const data = {
    jobs: [{ id: "j1", name: "Kafé" }, { id: "j2", name: "Lager" }],
    projects: [
      { id: "p1", jobId: "j1", name: "Bar" },
      { id: "p2", jobId: "j1", name: "Kjøkken" },
      { id: "p3", jobId: "j2", name: "Nattskift" },
    ],
    entries: [],
  };
  const hours = (n) => ({ start: "2026-03-05T08:00:00Z", end: `2026-03-05T${pad2(8 + n)}:00:00Z` });
  const entries = [
    { id: "e1", jobId: "j1", projectId: "p1", ...hours(4) },
    { id: "e2", jobId: "j1", projectId: "p2", ...hours(2) },
    { id: "e3", jobId: "j1", projectId: "p1", ...hours(3) },
    { id: "e4", jobId: "j1", ...hours(1) }, // uten prosjekt
    { id: "e5", jobId: "j1", projectId: "borte", ...hours(1) }, // slettet prosjekt
  ];

  test("projectsForJob gir bare prosjektene til én jobb", () => {
    assert.deepEqual(projectsForJob(data, "j1").map((p) => p.name), ["Bar", "Kjøkken"]);
    assert.deepEqual(projectsForJob(data, "j2").map((p) => p.name), ["Nattskift"]);
    assert.deepEqual(projectsForJob(data, "ukjent"), []);
  });

  test("projectsForJob tåler gammel data uten projects-liste", () => {
    assert.deepEqual(projectsForJob({ jobs: [] }, "j1"), []);
    assert.deepEqual(projectsForJob(undefined, "j1"), []);
  });

  test("findProject finner prosjektet, ellers null", () => {
    assert.equal(findProject(data, "p2").name, "Kjøkken");
    assert.equal(findProject(data, "borte"), null);
    assert.equal(findProject(data, undefined), null);
  });

  test("projectLabel: tom uten prosjekt, navn ellers, markert når prosjektet er slettet", () => {
    assert.equal(projectLabel(data, undefined), "");
    assert.equal(projectLabel(data, "p1"), "Bar");
    assert.equal(projectLabel(data, "borte"), "(slettet prosjekt)");
  });

  test("hoursByProject summerer nettotimer for ett prosjekt", () => {
    assert.equal(hoursByProject(entries, "p1"), 7);
    assert.equal(hoursByProject(entries, "p2"), 2);
    assert.equal(hoursByProject(entries, null), 1); // føringer uten prosjekt
    assert.equal(hoursByProject(entries, "p3"), 0);
  });

  test("hoursByProject trekker fra lunsj", () => {
    const withBreak = [{ jobId: "j1", projectId: "p1", breakMin: 30, ...hours(4) }];
    assert.equal(hoursByProject(withBreak, "p1"), 3.5);
  });

  test("projectBreakdown grupperer, sorterer synkende og legger 'uten prosjekt' sist", () => {
    const rows = projectBreakdown(entries, data);
    assert.deepEqual(rows.map((r) => [r.name, r.hours, r.count]), [
      ["Bar", 7, 2],
      ["Kjøkken", 2, 1],
      ["(slettet prosjekt)", 1, 1],
      ["Uten prosjekt", 1, 1],
    ]);
    assert.equal(rows[3].projectId, null);
  });

  test("projectBreakdown er tom når det ikke finnes føringer", () => {
    assert.deepEqual(projectBreakdown([], data), []);
  });
});
