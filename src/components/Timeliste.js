import { h, Fragment, useState } from "../react.js";
import {
  pad2, netDurationMs, msToHours, formatDuration, formatDateISO, formatTimeHM, MONTH_NAMES,
  projectsForJob, projectLabel,
} from "../lib.js";
import { EntryRow } from "./Entries.js";

function buildCsv(entries, jobById, data) {
  const header = "jobb;prosjekt;dato;fra;til;lunsj_min;timer;tillegg;notat";
  const rows = entries.map((e) => {
    const job = jobById(e.jobId);
    const start = new Date(e.start);
    const end = new Date(e.end);
    const supNames = (e.sups || []).map((id) => job?.sups.find((s) => s.id === id)?.name).filter(Boolean).join("+");
    return [
      job?.name || "", projectLabel(data, e.projectId), formatDateISO(start), formatTimeHM(start), formatTimeHM(end),
      e.breakMin || 0, msToHours(netDurationMs(e)).toFixed(2).replace(".", ","), supNames, e.note || "",
    ].join(";");
  });
  return [header, ...rows].join("\n");
}

export function Timeliste({ data, update, jobById }) {
  const [jobFilter, setJobFilter] = useState("alle");
  const [projectFilter, setProjectFilter] = useState("alle");
  const [showCsv, setShowCsv] = useState(false);

  // Prosjektfilteret viser prosjektene til den valgte jobben — eller alle når ingen jobb er valgt.
  const filterProjects = jobFilter === "alle" ? data.projects || [] : projectsForJob(data, jobFilter);
  const pickJob = (id) => { setJobFilter(id); setProjectFilter("alle"); };

  const entries = [...data.entries]
    .sort((a, b) => new Date(b.start) - new Date(a.start))
    .filter((e) => jobFilter === "alle" || e.jobId === jobFilter)
    .filter((e) => projectFilter === "alle"
      || (projectFilter === "ingen" ? !e.projectId : e.projectId === projectFilter));

  const byMonth = {};
  entries.forEach((e) => {
    const d = new Date(e.start);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    (byMonth[key] = byMonth[key] || []).push(e);
  });

  return h(Fragment, null,
    h("h1", null, "Timeliste"),
    h("p", { className: "sub" }, "Alt du har ført, nyeste først."),
    h("div", { className: "row", style: { marginBottom: filterProjects.length > 0 ? 8 : 12 } },
      h("button", { className: "chip", "data-on": jobFilter === "alle" ? "1" : "0", onClick: () => pickJob("alle") }, "Alle"),
      data.jobs.map((j) => h("button", {
        key: j.id, className: "chip", "data-on": jobFilter === j.id ? "1" : "0", onClick: () => pickJob(j.id),
      }, j.name))
    ),
    filterProjects.length > 0 && h("div", { className: "row", style: { marginBottom: 12 } },
      h("button", { className: "chip", "data-on": projectFilter === "alle" ? "1" : "0", onClick: () => setProjectFilter("alle") }, "Alle prosjekter"),
      filterProjects.map((p) => h("button", {
        key: p.id, className: "chip", "data-on": projectFilter === p.id ? "1" : "0", onClick: () => setProjectFilter(p.id),
      }, p.name)),
      h("button", { className: "chip", "data-on": projectFilter === "ingen" ? "1" : "0", onClick: () => setProjectFilter("ingen") }, "Uten prosjekt")
    ),
    entries.length === 0 && h("div", { className: "card" },
      h("div", { className: "empty" }, "Ingen føringer her ennå. Start klokka, eller legg inn timer manuelt under Stoppeklokke.")
    ),
    Object.entries(byMonth).map(([key, monthEntries]) => {
      const [year, month] = key.split("-").map(Number);
      const totalMs = monthEntries.reduce((sum, e) => sum + netDurationMs(e), 0);
      return h("div", { className: "card", key },
        h("div", { className: "kv", style: { paddingTop: 0 } },
          h("span", { style: { fontWeight: 600 } }, MONTH_NAMES[month - 1], " ", year),
          h("span", { className: "num" }, formatDuration(totalMs), " · ", msToHours(totalMs).toFixed(2).replace(".", ","), " t")
        ),
        monthEntries.map((e) => h(EntryRow, { key: e.id, e, job: jobById(e.jobId), data, update, showDate: true }))
      );
    }),
    entries.length > 0 && h(Fragment, null,
      h("button", { className: "ghost", onClick: () => setShowCsv(!showCsv) }, showCsv ? "Skjul CSV" : "Vis som CSV"),
      showCsv && h("div", { className: "card", style: { marginTop: 10 } },
        h("textarea", { readOnly: true, value: buildCsv(entries, jobById, data), onFocus: (e) => e.target.select() })
      )
    )
  );
}
