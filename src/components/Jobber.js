import { h, Fragment, useState } from "../react.js";
import { newId, getJobPeriodSettings, getRecentPeriods, formatPeriodLabel, formatPayoutLabel, formatDateISO } from "../lib.js";

export function Jobber({ data, update }) {
  const setJob = (jobId, patch) => update((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === jobId ? { ...j, ...patch } : j)) }));
  const addJob = () => update((d) => ({
    ...d,
    jobs: [...d.jobs, { id: newId(), name: "Ny jobb", kind: "hourly", rate: 0, salary: 0, period: { type: "month" }, payoutOffset: 1, color: "#c9a0ff", sups: [] }],
  }));

  return h(Fragment, null,
    h("h1", null, "Jobber"),
    h("p", { className: "sub" }, "Satser og lønnsperiode per arbeidsgiver."),
    data.jobs.map((job) => h("div", { className: "card", key: job.id },
      h("div", { className: "row", style: { marginBottom: 8 } },
        h("div", { style: { flex: "1 1 60%" } },
          h("label", null, "Navn"),
          h("input", { value: job.name, onChange: (e) => setJob(job.id, { name: e.target.value }) })
        ),
        h("div", { style: { flex: "0 0 96px" } },
          h("label", null, "Farge"),
          h("input", { type: "color", value: job.color, onChange: (e) => setJob(job.id, { color: e.target.value }), style: { padding: 3, height: 40 } })
        )
      ),
      h("div", { className: "row", style: { marginBottom: 8 } },
        h("div", null,
          h("label", null, "Type"),
          h("select", { value: job.kind, onChange: (e) => setJob(job.id, { kind: e.target.value }) },
            h("option", { value: "hourly" }, "Timelønn"),
            h("option", { value: "fixed" }, "Fastlønn")
          )
        ),
        job.kind === "hourly"
          ? h("div", null,
              h("label", null, "Timelønn (kr)"),
              h("input", { inputMode: "decimal", value: job.rate, onChange: (e) => setJob(job.id, { rate: Number(e.target.value) || 0 }) })
            )
          : h("div", null,
              h("label", null, "Månedslønn (kr)"),
              h("input", { inputMode: "decimal", value: job.salary, onChange: (e) => setJob(job.id, { salary: Number(e.target.value) || 0 }) })
            )
      ),
      h("div", { className: "row", style: { marginBottom: 8 } },
        h("div", { style: { flex: "0 0 130px" } },
          h("label", null, "Lunsj trekkes (min)"),
          h("input", { inputMode: "numeric", value: job.breakMin || 0, onChange: (e) => setJob(job.id, { breakMin: Math.max(0, Number(e.target.value) || 0) }) })
        ),
        h("div", null,
          h("label", null, "Bare på vakter over"),
          h("select", { value: job.breakAfterHours ?? 0, onChange: (e) => setJob(job.id, { breakAfterHours: Number(e.target.value) }) },
            h("option", { value: 0 }, "alle vakter"),
            h("option", { value: 4 }, "4 timer"),
            h("option", { value: 5.5 }, "5,5 timer"),
            h("option", { value: 6 }, "6 timer"),
            h("option", { value: 8 }, "8 timer")
          )
        )
      ),
      h(PeriodSettings, { job, setJob }),
      job.kind === "hourly" && h(Fragment, null,
        h("label", null, "Tillegg (kr per time, i tillegg til grunnlønn)"),
        job.sups.map((sup) => h("div", { className: "row", key: sup.id, style: { marginBottom: 6 } },
          h("input", { value: sup.name, onChange: (e) => setJob(job.id, { sups: job.sups.map((s) => (s.id === sup.id ? { ...s, name: e.target.value } : s)) }) }),
          h("input", { inputMode: "decimal", style: { flex: "0 0 90px" }, value: sup.rate, onChange: (e) => setJob(job.id, { sups: job.sups.map((s) => (s.id === sup.id ? { ...s, rate: Number(e.target.value) || 0 } : s)) }) }),
          h("button", { className: "ghost tiny", style: { flex: "0 0 auto" }, onClick: () => setJob(job.id, { sups: job.sups.filter((s) => s.id !== sup.id) }) }, "Fjern")
        )),
        h("button", { className: "tiny ghost", onClick: () => setJob(job.id, { sups: [...job.sups, { id: newId(), name: "Nytt tillegg", rate: 0 }] }) }, "Legg til tillegg")
      ),
      h(DeleteJobButton, { job, data, update })
    )),
    h("button", { className: "primary", onClick: addJob }, "Legg til jobb")
  );
}

function DeleteJobButton({ job, data, update }) {
  const [confirming, setConfirming] = useState(false);
  const entryCount = data.entries.filter((e) => e.jobId === job.id).length;
  if (!confirming) {
    return h("button", { className: "tiny ghost", style: { marginTop: 10 }, onClick: () => setConfirming(true) }, "Slett jobb");
  }
  return h("div", { className: "row", style: { marginTop: 10 } },
    h("button", {
      className: "stop tiny",
      onClick: () => update((d) => ({ ...d, jobs: d.jobs.filter((j) => j.id !== job.id) })),
    }, "Slett ", job.name, " ", entryCount > 0 ? `(${entryCount} føringer blir liggende)` : ""),
    h("button", { className: "ghost tiny", onClick: () => setConfirming(false) }, "Behold")
  );
}

export function Sikkerhetskopi({ data, update }) {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState("");

  const restore = () => {
    try {
      const parsed = JSON.parse(pasted);
      if (!parsed.jobs || !parsed.entries) throw new Error();
      update(() => ({ running: null, checks: {}, ...parsed }));
      setMessage("Timelista er gjenopprettet.");
      setPasted("");
    } catch {
      setMessage("Teksten er ikke en gyldig sikkerhetskopi. Lim inn hele innholdet, fra { til }.");
    }
  };

  return h(Fragment, null,
    h("h2", null, "Sikkerhetskopi"),
    h("button", { className: "ghost", onClick: () => setOpen(!open) }, open ? "Lukk" : "Kopier ut eller gjenopprett timelista"),
    open && h("div", { className: "card", style: { marginTop: 10 } },
      h("label", null, "Alt du har ført. Merk og kopier teksten et trygt sted."),
      h("textarea", { readOnly: true, value: JSON.stringify(data), onFocus: (e) => e.target.select() }),
      h("label", { style: { marginTop: 12 } }, "Lim inn en tidligere kopi for å gjenopprette"),
      h("textarea", { value: pasted, onChange: (e) => setPasted(e.target.value), placeholder: "{...}" }),
      message && h("div", { className: "verdict warn", style: { marginTop: 8 } }, message),
      h("button", { className: "primary", style: { marginTop: 8 }, onClick: restore, disabled: !pasted.trim() }, "Gjenopprett fra kopi")
    )
  );
}

function PeriodSettings({ job, setJob }) {
  const period = getJobPeriodSettings(job);
  const patchPeriod = (patch) => setJob(job.id, { period: { ...period, ...patch }, periodStartDay: undefined });
  const recentLabels = getRecentPeriods(job, 2).map((p) => formatPeriodLabel(p, job));

  return h("div", { style: { borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12 } },
    h("div", { className: "row", style: { marginBottom: 8 } },
      h("div", null,
        h("label", null, "Lønnsperiode"),
        h("select", { value: period.type, onChange: (e) => patchPeriod({ type: e.target.value }) },
          h("option", { value: "month" }, "Kalendermåned"),
          h("option", { value: "customDay" }, "Fra en bestemt dato i måneden"),
          h("option", { value: "biweekly" }, "Hver fjortende dag"),
          h("option", { value: "weekly" }, "Hver uke")
        )
      ),
      period.type === "customDay" && h("div", { style: { flex: "0 0 130px" } },
        h("label", null, "Starter den"),
        h("input", { inputMode: "numeric", value: period.day || 16, onChange: (e) => patchPeriod({ day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) }) })
      ),
      (period.type === "biweekly" || period.type === "weekly") && h("div", null,
        h("label", null, "Første dag i en periode"),
        h("input", { type: "date", value: period.anchor || formatDateISO(new Date()), onChange: (e) => patchPeriod({ anchor: e.target.value }) })
      )
    ),
    h("div", { className: "row", style: { marginBottom: 8 } },
      h("div", { style: { flex: "0 0 130px" } },
        h("label", null, "Lønningsdag"),
        h("input", {
          inputMode: "numeric", placeholder: "f.eks. 15", value: job.payoutDay || "",
          onChange: (e) => setJob(job.id, { payoutDay: Math.min(28, Math.max(0, Number(e.target.value) || 0)) || undefined }),
        })
      ),
      h("div", null,
        h("label", null, "i"),
        h("select", { value: job.payoutOffset ?? 1, onChange: (e) => setJob(job.id, { payoutOffset: Number(e.target.value) }) },
          h("option", { value: 0 }, "samme måned som perioden slutter"),
          h("option", { value: 1 }, "måneden etter"),
          h("option", { value: 2 }, "to måneder etter")
        )
      )
    ),
    h("div", { style: { color: "var(--muted)", fontSize: 12.5 } },
      "Siste perioder: ", recentLabels.join(" · "),
      job.payoutDay ? `. ${formatPayoutLabel(getRecentPeriods(job, 2)[1], job)}.` : ""
    )
  );
}
