import { h, Fragment, useState, useMemo } from "../react.js";
import {
  DAY_MS, netDurationMs, msToHours, calcEarnings, formatDuration, formatMoney,
  formatShortDate, getPeriodForDate, getRecentPeriods, formatPeriodLabel, formatPayoutLabel,
} from "../lib.js";

export function Lonn({ data, update }) {
  const [jobId, setJobId] = useState(data.jobs[0]?.id);
  const job = data.jobs.find((j) => j.id === jobId) || data.jobs[0];
  const periods = useMemo(() => (job ? getRecentPeriods(job) : []), [job?.id, JSON.stringify(job?.period), job?.periodStartDay]);
  const [periodIndex, setPeriodIndex] = useState(1); // 1 = forrige (avsluttede) periode
  const period = periods[Math.min(periodIndex, periods.length - 1)];
  const check = data.checks[`${jobId}|${period?.key}`] || { hours: "", gross: "" };

  if (!job || !period) return h("div", { className: "empty" }, "Legg til en jobb først.");

  const periodEntries = data.entries.filter(
    (e) => e.jobId === jobId && new Date(e.start) >= period.start && new Date(e.start) < period.end
  );
  const totalMs = periodEntries.reduce((sum, e) => sum + netDurationMs(e), 0);
  const totalHours = msToHours(totalMs);
  const expectedGross = periodEntries.reduce((sum, e) => sum + calcEarnings(e, job), 0);
  const supBreakdown = job.sups
    .map((sup) => {
      const hours = periodEntries.filter((e) => (e.sups || []).includes(sup.id)).reduce((sum, e) => sum + msToHours(netDurationMs(e)), 0);
      return { ...sup, hours, sum: hours * sup.rate };
    })
    .filter((sup) => sup.hours > 0);

  const setCheck = (patch) => update((d) => ({
    ...d, checks: { ...d.checks, [`${jobId}|${period.key}`]: { ...check, ...patch } },
  }));

  const paidHours = parseFloat(String(check.hours).replace(",", ".")) || 0;
  const paidGross = parseFloat(String(check.gross).replace(",", ".")) || 0;
  const hoursDiff = paidHours ? paidHours - totalHours : 0;
  const grossDiff = paidGross ? paidGross - expectedGross : 0;
  const hoursMatch = paidHours && Math.abs(hoursDiff) < 0.05;
  const grossMatch = paidGross && Math.abs(grossDiff) < 5;

  return h(Fragment, null,
    h("h1", null, "Lønnssjekk"),
    h("p", { className: "sub" }, "Mine timer mot det arbeidsgiver faktisk betalte."),
    h("div", { className: "row", style: { marginBottom: 12 } },
      h("select", { value: jobId, onChange: (e) => setJobId(e.target.value) },
        data.jobs.map((j) => h("option", { key: j.id, value: j.id }, j.name))
      ),
      h("select", { value: periodIndex, onChange: (e) => setPeriodIndex(Number(e.target.value)) },
        periods.map((p, i) => h("option", { key: p.key + i, value: i }, formatPeriodLabel(p, job)))
      )
    ),
    h("div", { className: "card" },
      h("div", { className: "kv" },
        h("span", null, "Perioden"),
        h("span", { className: "num" }, formatShortDate(period.start), " – ", formatShortDate(new Date(period.end - DAY_MS)))
      ),
      formatPayoutLabel(period, job) && h("div", { className: "kv" },
        h("span", null, "Lønningsdag"), h("span", { className: "num" }, formatPayoutLabel(period, job))
      ),
      h("div", { className: "kv" },
        h("span", null, "Timer ført"),
        h("span", { className: "num" }, formatDuration(totalMs), " (", totalHours.toFixed(2).replace(".", ","), " t)")
      ),
      h("div", { className: "kv" }, h("span", null, "Vakter"), h("span", { className: "num" }, periodEntries.length)),
      periodEntries.some((e) => e.breakMin > 0) && h("div", { className: "kv" },
        h("span", null, "Trukket lunsj"),
        h("span", { className: "num" }, "−", formatDuration(periodEntries.reduce((sum, e) => sum + (e.breakMin || 0) * 60000, 0)))
      ),
      job.kind === "hourly"
        ? h(Fragment, null,
            h("div", { className: "kv" },
              h("span", null, "Grunnlønn ", job.rate, " kr/t"),
              h("span", { className: "num" }, formatMoney(totalHours * job.rate))
            ),
            supBreakdown.map((sup) => h("div", { className: "kv", key: sup.id },
              h("span", null, sup.name, " (+", sup.rate, " kr/t · ", sup.hours.toFixed(2).replace(".", ","), " t)"),
              h("span", { className: "num" }, formatMoney(sup.sum))
            )),
            h("div", { className: "kv", style: { fontWeight: 600 } },
              h("span", null, "Forventet brutto"), h("span", { className: "num" }, formatMoney(expectedGross))
            )
          )
        : h("div", { className: "kv", style: { fontWeight: 600 } },
            h("span", null, "Avtalt månedslønn"), h("span", { className: "num" }, formatMoney(job.salary || 0))
          )
    ),
    h("h2", null, "Fra lønnsslippen"),
    h("div", { className: "card" },
      h("div", { className: "row" },
        h("div", null,
          h("label", null, "Timer utbetalt"),
          h("input", { inputMode: "decimal", placeholder: "0", value: check.hours, onChange: (e) => setCheck({ hours: e.target.value }) })
        ),
        h("div", null,
          h("label", null, "Brutto utbetalt"),
          h("input", { inputMode: "decimal", placeholder: "0", value: check.gross, onChange: (e) => setCheck({ gross: e.target.value }) })
        )
      ),
      (paidHours > 0 || paidGross > 0) && h(Fragment, null,
        paidHours > 0 && h("div", { className: `verdict ${hoursMatch ? "ok" : "bad"}` },
          hoursMatch
            ? "Timene stemmer."
            : `${hoursDiff > 0 ? "Betalt for" : "Mangler"} ${Math.abs(hoursDiff).toFixed(2).replace(".", ",")} timer ${hoursDiff > 0 ? "mer enn" : "sammenlignet med"} det du har ført.`
        ),
        paidGross > 0 && job.kind === "hourly" && h("div", { className: `verdict ${grossMatch ? "ok" : "bad"}` },
          grossMatch
            ? "Beløpet stemmer."
            : `Avvik på ${formatMoney(Math.abs(grossDiff))} – lønnsslippen er ${grossDiff > 0 ? "høyere" : "lavere"} enn beregningen din.`
        ),
        paidGross > 0 && job.kind === "fixed" && h("div", { className: `verdict ${Math.abs(paidGross - (job.salary || 0)) < 5 ? "ok" : "bad"}` },
          Math.abs(paidGross - (job.salary || 0)) < 5
            ? "Samme som avtalt månedslønn."
            : `Avviker ${formatMoney(Math.abs(paidGross - (job.salary || 0)))} fra avtalt månedslønn.`
        )
      ),
      h("div", { className: "verdict warn", style: { marginTop: 10 } },
        "Brutto er før skatt, og feriepenger, pensjonstrekk og etterbetalinger kan gi lovlige avvik. Bruk tallene som utgangspunkt for å spørre, ikke som fasit."
      )
    ),
    h("h2", null, "Andre jobber i samme tidsrom"),
    h("div", { className: "card" },
      data.jobs.map((otherJob) => {
        const otherPeriod = getPeriodForDate(new Date(period.start), otherJob);
        const otherEntries = data.entries.filter(
          (e) => e.jobId === otherJob.id && new Date(e.start) >= otherPeriod.start && new Date(e.start) < otherPeriod.end
        );
        const otherMs = otherEntries.reduce((sum, e) => sum + netDurationMs(e), 0);
        return h("div", { className: "kv", key: otherJob.id },
          h("span", null, h("span", { className: "dot", style: { background: otherJob.color } }), otherJob.name),
          h("span", { className: "num" }, formatDuration(otherMs),
            otherJob.kind === "hourly" ? ` · ${formatMoney(otherEntries.reduce((sum, e) => sum + calcEarnings(e, otherJob), 0))}` : "")
        );
      })
    )
  );
}
