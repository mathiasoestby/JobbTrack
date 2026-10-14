// Skjema for å registrere/redigere en enkelt føring, og raden som viser en føring i lister.
import { h, useState } from "../react.js";
import {
  newId, netDurationMs, formatDuration, formatDateISO, formatTimeHM,
  parseDateTime, formatWeekdayDate, getBreakMinutes, previousStopTime,
  projectsForJob, projectLabel,
} from "../lib.js";
import { Tidshjul } from "./Tidshjul.js";

const HOUR_MS = 60 * 60 * 1000;

// `initial` er satt når skjemaet brukes til å redigere en eksisterende føring (fra EntryRow).
export function EntryForm({ data, update, onDone, initial }) {
  const [jobId, setJobId] = useState(initial?.jobId || data.jobs[0]?.id);
  const [times, setTimes] = useState(() => {
    if (initial) return { start: new Date(initial.start), end: new Date(initial.end) };
    const today = formatDateISO(new Date());
    return { start: parseDateTime(today, "09:00"), end: parseDateTime(today, "17:00") };
  });
  const [projectId, setProjectId] = useState(initial?.projectId || "");
  const [note, setNote] = useState(initial?.note || "");
  const [sups, setSups] = useState(initial?.sups || []);
  const [breakMinInput, setBreakMinInput] = useState(initial ? String(initial.breakMin || 0) : "");
  const [error, setError] = useState("");

  const job = data.jobs.find((j) => j.id === jobId);
  const projects = projectsForJob(data, jobId);

  const save = () => {
    const { start, end } = times;
    if (end <= start) {
      setError("Stopp må være etter start.");
      return;
    }
    if (end - start > 20 * HOUR_MS) {
      setError("Over 20 timer – sjekk klokkeslettene.");
      return;
    }
    const defaultBreak = getBreakMinutes(job, end - start);
    const breakMin = breakMinInput === "" ? defaultBreak : Math.max(0, Number(breakMinInput) || 0);
    if (breakMin * 60000 >= end - start) {
      setError("Lunsjen er like lang som vakta – sjekk tallene.");
      return;
    }

    const entry = {
      id: initial?.id || newId(),
      jobId,
      start: start.toISOString(),
      end: end.toISOString(),
      note,
      sups,
      breakMin,
      ...(projectId ? { projectId } : {}),
    };
    update((d) => ({
      ...d,
      entries: [entry, ...d.entries.filter((e) => e.id !== entry.id)].sort(
        (a, b) => new Date(b.start) - new Date(a.start)
      ),
    }));
    onDone();
  };

  return h(
    "div", { className: "card", style: { marginTop: 10 } },
    h("div", { style: { marginBottom: 8 } },
      h("label", null, "Jobb"),
      h("select", { value: jobId, onChange: (e) => { setJobId(e.target.value); setSups([]); setProjectId(""); } },
        data.jobs.map((j) => h("option", { key: j.id, value: j.id }, j.name))
      )
    ),
    // Prosjektvelger vises bare for jobber som faktisk bruker prosjekter.
    (projects.length > 0 || projectId) && h("div", { style: { marginBottom: 8 } },
      h("label", null, "Prosjekt"),
      h("select", { value: projectId, onChange: (e) => setProjectId(e.target.value) },
        h("option", { value: "" }, "Ingen prosjekt"),
        projects.map((p) => h("option", { key: p.id, value: p.id }, p.name)),
        projectId && !projects.some((p) => p.id === projectId) &&
          h("option", { value: projectId }, projectLabel(data, projectId))
      )
    ),
    h(Tidshjul, {
      start: times.start,
      end: times.end,
      onChange: (next) => { setTimes(next); setError(""); },
      previousStop: previousStopTime(data.entries, times.end, initial?.id),
    }),
    h("div", { className: "row", style: { marginBottom: 8 } },
      h("div", { style: { flex: "0 0 130px" } },
        h("label", null, "Lunsj (min)"),
        h("input", {
          inputMode: "numeric",
          placeholder: String(getBreakMinutes(job, 8 * HOUR_MS)),
          value: breakMinInput,
          onChange: (e) => setBreakMinInput(e.target.value),
        })
      ),
      h("div", null,
        h("label", null, "Notat"),
        h("input", { value: note, onChange: (e) => setNote(e.target.value) })
      )
    ),
    job?.sups?.length > 0 && h("div", { className: "row", style: { marginBottom: 10 } },
      job.sups.map((sup) => h("button", {
        key: sup.id, className: "chip", "data-on": sups.includes(sup.id) ? "1" : "0",
        onClick: () => setSups(sups.includes(sup.id) ? sups.filter((id) => id !== sup.id) : [...sups, sup.id]),
      }, sup.name))
    ),
    error && h("div", { className: "verdict bad", style: { marginBottom: 8 } }, error),
    h("div", { className: "row" },
      h("button", { className: "primary", onClick: save }, "Lagre timer"),
      h("button", { className: "ghost", onClick: onDone }, "Avbryt")
    )
  );
}

export function EntryRow({ e: entry, job, data, update, showDate }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const start = new Date(entry.start);
  const end = new Date(entry.end);

  if (editing) {
    return h("div", { style: { padding: "6px 0" } },
      h(EntryForm, { data, update, onDone: () => setEditing(false), initial: entry }),
      confirmingDelete
        ? h("div", { className: "row" },
            h("button", {
              className: "stop tiny",
              onClick: () => update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== entry.id) })),
            }, "Slett føringen"),
            h("button", { className: "ghost tiny", onClick: () => setConfirmingDelete(false) }, "Behold")
          )
        : h("button", { className: "tiny ghost", onClick: () => setConfirmingDelete(true) }, "Slett føringen")
    );
  }

  const project = projectLabel(data, entry.projectId);

  return h("div", { className: "entry" },
    h("span", { className: "dot", style: { background: job?.color || "#666" } }),
    h("div", { className: "meta" },
      h("div", { className: "name" },
        job?.name || "Slettet jobb",
        project ? ` · ${project}` : "",
        entry.note ? ` · ${entry.note}` : ""),
      h("div", { className: "when num" },
        showDate ? `${formatWeekdayDate(start)} · ` : "",
        formatTimeHM(start), "–", formatTimeHM(end),
        entry.breakMin > 0 && ` · −${entry.breakMin} min lunsj`,
        (entry.sups || []).length > 0 &&
          ` · ${entry.sups.map((id) => job?.sups.find((s) => s.id === id)?.name).filter(Boolean).join(", ")}`
      )
    ),
    h("div", { className: "num", style: { fontSize: 14 } }, formatDuration(netDurationMs(entry))),
    h("button", { className: "tiny ghost", onClick: () => setEditing(true) }, "Endre")
  );
}
