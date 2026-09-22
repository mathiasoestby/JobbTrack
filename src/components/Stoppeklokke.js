import { h, Fragment, useState } from "../react.js";
import { newId, netDurationMs, formatDuration, formatClock, formatTimeHM, getBreakMinutes } from "../lib.js";
import { EntryForm, EntryRow } from "./Entries.js";

export function Stoppeklokke({ data, update, now, jobById }) {
  const running = data.running;
  const [selectedJobId, setSelectedJobId] = useState(data.jobs[0]?.id || "");
  const [note, setNote] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);

  const start = () => {
    if (!selectedJobId) return;
    update((d) => ({ ...d, running: { jobId: selectedJobId, start: new Date().toISOString(), note, sups: [] } }));
    setNote("");
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
      };
      return { ...d, running: null, entries: [entry, ...d.entries] };
    });
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
            running.note ? ` · ${running.note}` : ""
          ),
          h("div", { className: "clock num" }, formatClock(now - new Date(running.start))),
          h("div", { className: "who" },
            "startet ", formatTimeHM(new Date(running.start)),
            getBreakMinutes(runningJob, now - new Date(running.start)) > 0
              ? ` · ${getBreakMinutes(runningJob, now - new Date(running.start))} min lunsj trekkes ved stopp`
              : ""
          ),
          runningJob?.sups?.length > 0 && h("div", { className: "row", style: { justifyContent: "center", margin: "12px 0 4px" } },
            runningJob.sups.map((sup) => h("button", {
              key: sup.id, className: "chip", "data-on": (running.sups || []).includes(sup.id) ? "1" : "0",
              onClick: () => toggleRunningSup(sup.id),
            }, sup.name))
          ),
          h("button", { className: "stop", style: { marginTop: 14, width: "100%" }, onClick: stop }, "Stopp og lagre")
        )
      : h("div", { className: "hero" },
          h("div", { className: "clock num", style: { color: "#3d4d5b" } }, "00:00:00"),
          h("div", { className: "row", style: { marginTop: 14 } },
            h("select", { value: selectedJobId, onChange: (e) => setSelectedJobId(e.target.value) },
              data.jobs.map((j) => h("option", { key: j.id, value: j.id }, j.name))
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
