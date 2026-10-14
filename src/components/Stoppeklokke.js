import { h, Fragment, useState } from "../react.js";
import { newId, netDurationMs, formatDuration, formatClock, formatTimeHM, getBreakMinutes, projectsForJob, projectLabel, previousStopTime } from "../lib.js";
import { EntryForm, EntryRow } from "./Entries.js";
import { Tidshjul } from "./Tidshjul.js";

export function Stoppeklokke({ data, update, now, jobById }) {
  const running = data.running;
  const [selectedJobId, setSelectedJobId] = useState(data.jobs[0]?.id || "");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [note, setNote] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  // Utkast til ny starttid mens tidshjulet er åpent; null = ikke i justeringsmodus.
  const [draftStart, setDraftStart] = useState(null);

  const selectableProjects = projectsForJob(data, selectedJobId);

  const start = () => {
    if (!selectedJobId) return;
    update((d) => ({
      ...d,
      running: {
        jobId: selectedJobId, start: new Date().toISOString(), note, sups: [],
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
    }));
    setNote("");
    setDraftStart(null);
  };

  const stop = () => {
    update((d) => {
      if (!d.running) return d;
      const endIso = new Date().toISOString();
      const job = d.jobs.find((j) => j.id === d.running.jobId);
      const entry = {
        id: newId(),
        jobId: d.running.jobId,
        start: d.running.start,
        end: endIso,
        note: d.running.note || "",
        sups: d.running.sups || [],
        breakMin: getBreakMinutes(job, new Date(endIso) - new Date(d.running.start)),
        ...(d.running.projectId ? { projectId: d.running.projectId } : {}),
      };
      return { ...d, running: null, entries: [entry, ...d.entries] };
    });
  };

  const saveDraftStart = () => {
    const newStart = draftStart.toISOString();
    update((d) => (d.running ? { ...d, running: { ...d.running, start: newStart } } : d));
    setDraftStart(null);
  };

  const toggleRunningSup = (supId) => update((d) => ({
    ...d,
    running: {
      ...d.running,
      sups: (d.running.sups || []).includes(supId)
        ? d.running.sups.filter((id) => id !== supId)
        : [...(d.running.sups || []), supId],
    },
  }));

  const runningJob = running ? jobById(running.jobId) : null;
  const todaysEntries = data.entries.filter((e) => new Date(e.start).toDateString() === new Date().toDateString());
  const todaysTotalMs = todaysEntries.reduce((sum, e) => sum + netDurationMs(e), 0)
    + (running ? now - new Date(running.start) : 0);

  return h(Fragment, null,
    h("h1", null, "Timeliste"),
    h("p", { className: "sub" }, "Din egen fasit mot lønnsslippen."),

    running
      ? h("div", { className: "hero" },
          h("div", { className: "who" },
            h("span", { className: "dot live", style: { background: runningJob?.color } }),
            runningJob?.name,
            projectLabel(data, running.projectId) ? ` · ${projectLabel(data, running.projectId)}` : "",
            running.note ? ` · ${running.note}` : ""
          ),
          draftStart
            ? h(Tidshjul, {
                start: draftStart,
                end: null,
                now,
                onChange: ({ start }) => setDraftStart(start),
                previousStop: previousStopTime(data.entries, new Date(now)),
              })
            : h(Fragment, null,
                h("div", { className: "clock num" }, formatClock(now - new Date(running.start))),
                h("div", { className: "who" },
                  "startet ", formatTimeHM(new Date(running.start)),
                  getBreakMinutes(runningJob, now - new Date(running.start)) > 0
                    ? ` · ${getBreakMinutes(runningJob, now - new Date(running.start))} min lunsj trekkes ved stopp`
                    : "",
                  " · ",
                  h("button", { className: "linkbtn", onClick: () => setDraftStart(new Date(running.start)) }, "Juster start")
                )
              ),
          runningJob?.sups?.length > 0 && h("div", { className: "row", style: { justifyContent: "center", margin: "12px 0 4px" } },
            runningJob.sups.map((sup) => h("button", {
              key: sup.id, className: "chip", "data-on": (running.sups || []).includes(sup.id) ? "1" : "0",
              onClick: () => toggleRunningSup(sup.id),
            }, sup.name))
          ),
          draftStart
            ? h("div", { className: "row", style: { marginTop: 14 } },
                h("button", { className: "primary", onClick: saveDraftStart }, "Lagre ny start"),
                h("button", { className: "ghost", onClick: () => setDraftStart(null) }, "Avbryt")
              )
            : h("button", { className: "stop", style: { marginTop: 14, width: "100%" }, onClick: stop }, "Stopp og lagre")
        )
      : h("div", { className: "hero" },
          h("div", { className: "clock num", style: { color: "#3d4d5b" } }, "00:00:00"),
          h("div", { className: "row", style: { marginTop: 14 } },
            h("select", {
              value: selectedJobId,
              onChange: (e) => { setSelectedJobId(e.target.value); setSelectedProjectId(""); },
            },
              data.jobs.map((j) => h("option", { key: j.id, value: j.id }, j.name))
            ),
            // Prosjektvelger bare for jobber som bruker prosjekter.
            selectableProjects.length > 0 && h("select", {
              value: selectedProjectId, onChange: (e) => setSelectedProjectId(e.target.value),
            },
              h("option", { value: "" }, "Ingen prosjekt"),
              selectableProjects.map((p) => h("option", { key: p.id, value: p.id }, p.name))
            ),
            h("input", { placeholder: "Hva jobber du med?", value: note, onChange: (e) => setNote(e.target.value) })
          ),
          h("button", { className: "primary", style: { marginTop: 10, width: "100%" }, onClick: start }, "Start klokka")
        ),

    h("div", { className: "card" },
      h("div", { className: "kv" }, h("span", null, "I dag"), h("span", { className: "num" }, formatDuration(todaysTotalMs))),
      todaysEntries.length === 0 && !running && h("div", { className: "empty" }, "Ingenting registrert i dag ennå."),
      todaysEntries.map((e) => h(EntryRow, { key: e.id, e, job: jobById(e.jobId), data, update }))
    ),
    h("button", { className: "ghost", onClick: () => setShowManualForm(!showManualForm) },
      showManualForm ? "Lukk" : "Legg inn timer manuelt"),
    showManualForm && h(EntryForm, { data, update, onDone: () => setShowManualForm(false) })
  );
}
