import { h, useState } from "../react.js";
import { netDurationMs, formatDuration, MONTH_NAMES } from "../lib.js";
import { EntryRow } from "./Entries.js";

const WEEKDAY_HEADERS = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

export function TidsKalender({ data, jobById, update }) {
  const [viewedMonth, setViewedMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);

  const year = viewedMonth.getFullYear();
  const month = viewedMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leadingOffset = (firstOfMonth.getDay() + 6) % 7; // mandag som første dag i uka
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const entriesByDay = {};
  data.entries.forEach((e) => {
    const d = new Date(e.start);
    if (d.getFullYear() === year && d.getMonth() === month) {
      (entriesByDay[d.getDate()] = entriesByDay[d.getDate()] || []).push(e);
    }
  });

  const cells = [];
  for (let i = 0; i < leadingOffset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const today = new Date();
  const todayDate = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;
  const monthTotalMs = Object.values(entriesByDay).reduce((sum, es) => sum + es.reduce((s, e) => s + netDurationMs(e), 0), 0);
  const selectedEntries = selectedDay
    ? (entriesByDay[selectedDay] || []).slice().sort((a, b) => new Date(a.start) - new Date(b.start))
    : [];

  return h("div", { className: "calendar-panel" },
    h("div", { className: "card" },
      h("div", { className: "row", style: { alignItems: "center", flexWrap: "nowrap", marginBottom: 2 } },
        h("button", {
          type: "button", className: "ghost tiny",
          onClick: () => { setViewedMonth(new Date(year, month - 1, 1)); setSelectedDay(null); },
        }, "‹"),
        h("div", { style: { flex: 1, textAlign: "center", fontWeight: 600 } }, `${MONTH_NAMES[month]} ${year}`),
        h("button", {
          type: "button", className: "ghost tiny",
          onClick: () => { setViewedMonth(new Date(year, month + 1, 1)); setSelectedDay(null); },
        }, "›")
      ),
      h("div", { className: "cal-sub" }, monthTotalMs > 0 ? `${formatDuration(monthTotalMs)} denne måneden` : "Ingen føringer denne måneden"),
      h("div", { className: "cal-grid" }, WEEKDAY_HEADERS.map((d) => h("div", { key: d, className: "cal-dow" }, d))),
      h("div", { className: "cal-grid" }, cells.map((day, idx) => {
        if (day === null) return h("div", { key: `e${idx}`, className: "cal-cell cal-empty" });
        const dayEntries = entriesByDay[day] || [];
        const classes = ["cal-cell"];
        if (day === todayDate) classes.push("cal-today");
        if (day === selectedDay) classes.push("cal-selected");
        if (dayEntries.length) classes.push("cal-has");
        return h("button", {
          key: day, type: "button", className: classes.join(" "),
          onClick: () => setSelectedDay(selectedDay === day ? null : day),
        },
          h("span", { className: "cal-daynum" }, day),
          dayEntries.length > 0 && h("span", { className: "cal-dots" },
            dayEntries.slice(0, 4).map((e) => h("span", {
              key: e.id, className: "cal-dot", style: { background: jobById(e.jobId)?.color || "#666" },
            }))
          )
        );
      })),
      selectedDay && h("div", { className: "cal-detail" },
        h("div", { style: { fontWeight: 600, margin: "12px 0 6px" } }, `${selectedDay}. ${MONTH_NAMES[month]}`),
        selectedEntries.length === 0
          ? h("div", { className: "empty" }, "Ingen føringer denne dagen.")
          : selectedEntries.map((e) => h(EntryRow, { key: e.id, e, job: jobById(e.jobId), data, update }))
      )
    )
  );
}
