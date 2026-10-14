// Tidshjul: juster start/stopp ved å dra håndtak rundt en minuttskive (én runde = én time),
// eller ved å skrive klokkeslett direkte. Brukes både på løpende klokke og i føringsskjemaet.
import { h, useState, useRef, useEffect } from "../react.js";
import {
  pad2, formatDateISO, formatTimeHM, formatWeekdayDate, parseDateTime, addMinutes,
  roundDateToNearest, roundDurationEnd, firstTimeAfter, MINUTE_MS,
} from "../lib.js";

const SIZE = 300;
const CENTER = SIZE / 2;
const RING_RADIUS = 112;
const RING_WIDTH = 24;
const ROUND_CHOICES = [5, 10, 15];

// Vinkel (radianer, 0 = kl. 12, med klokka) for minuttviseren til et tidspunkt.
const minuteAngle = (date) => ((date.getMinutes() + date.getSeconds() / 60) / 60) * 2 * Math.PI;

const pointAt = (angle, radius) => [CENTER + radius * Math.sin(angle), CENTER - radius * Math.cos(angle)];

function arcPath(fromAngle, sweep, radius) {
  const [x1, y1] = pointAt(fromAngle, radius);
  const [x2, y2] = pointAt(fromAngle + sweep, radius);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
}

function splitDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return {
    main: `${Math.floor(totalSeconds / 3600)}:${pad2(Math.floor((totalSeconds % 3600) / 60))}`,
    seconds: `:${pad2(totalSeconds % 60)}`,
  };
}

// `end` er null mens klokka går — da er stopp «nå» og kan ikke dras.
// `onChange({ start, end })` kalles med nye Date-verdier; forelderen bestemmer når det lagres.
export function Tidshjul({ start, end, now, onChange, previousStop }) {
  const [roundMinutes, setRoundMinutes] = useState(5);
  const [topHandle, setTopHandle] = useState("end");
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  // Hindrer at siden scroller når man drar et håndtak på mobil. React legger touch-lyttere
  // som passive, og iOS respekterer ikke alltid touch-action på SVG-elementer.
  useEffect(() => {
    const svg = svgRef.current;
    const blockScroll = (event) => { if (event.target.closest(".dial-handle")) event.preventDefault(); };
    svg.addEventListener("touchstart", blockScroll, { passive: false });
    return () => svg.removeEventListener("touchstart", blockScroll);
  }, []);

  const running = !end;
  const stopTime = end || new Date(now);

  // Start må ligge minst ett minutt før stopp (eller ikke etter «nå» når klokka går).
  const clampStart = (candidate) => {
    const latest = running ? new Date(now) : addMinutes(end, -1);
    return candidate > latest ? latest : candidate;
  };
  const clampEnd = (candidate) => (candidate < addMinutes(start, 1) ? addMinutes(start, 1) : candidate);

  const moveStart = (candidate) => onChange({ start: clampStart(candidate), end });
  const moveEnd = (candidate) => onChange({ start, end: clampEnd(candidate) });

  // --- Dra håndtak ------------------------------------------------------
  const pointerMinute = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    return ((Math.atan2(dx, -dy) / (2 * Math.PI)) * 60 + 60) % 60;
  };

  const beginDrag = (which) => (event) => {
    event.preventDefault();
    svgRef.current.setPointerCapture(event.pointerId);
    setTopHandle(which);
    dragRef.current = { which, last: pointerMinute(event), accum: 0, base: which === "start" ? start : end, steps: 0 };
  };

  // Summerer små vinkelendringer, så det å dra forbi kl. 12 bare ruller over til neste/forrige time.
  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const minute = pointerMinute(event);
    let delta = minute - drag.last;
    if (delta > 30) delta -= 60;
    if (delta < -30) delta += 60;
    drag.last = minute;
    drag.accum += delta;

    const steps = Math.round(drag.accum);
    if (steps === drag.steps) return;
    drag.steps = steps;
    const candidate = addMinutes(drag.base, steps);
    const clamped = drag.which === "start" ? clampStart(candidate) : clampEnd(candidate);
    if (clamped.getTime() !== candidate.getTime()) {
      // Stopp ved grensen, og la tilbakedraget virke med en gang.
      Object.assign(drag, { base: clamped, accum: 0, steps: 0 });
    }
    drag.which === "start" ? moveStart(clamped) : moveEnd(clamped);
  };

  const endDrag = () => { dragRef.current = null; };

  const onHandleKey = (which) => (event) => {
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 15, PageDown: -15 }[event.key];
    if (!step) return;
    event.preventDefault();
    setTopHandle(which);
    which === "start" ? moveStart(addMinutes(start, step)) : moveEnd(addMinutes(end, step));
  };

  // --- Skrive klokkeslett direkte ----------------------------------------
  // Stopp beholder klokkeslettet sitt og legges på første passende tidspunkt etter ny start,
  // akkurat som før: 22:00 → 06:00 blir en nattevakt.
  const setStartAt = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return;
    const newStart = clampStart(parseDateTime(dateStr, timeStr));
    onChange({ start: newStart, end: running ? null : firstTimeAfter(newStart, formatTimeHM(end)) });
  };

  const setEndTime = (timeStr) => {
    if (timeStr) onChange({ start, end: firstTimeAfter(start, timeStr) });
  };

  // --- Tegning -------------------------------------------------------------
  const durationMs = stopTime - start;
  const durationMinutes = durationMs / MINUTE_MS;
  const startAngle = minuteAngle(start);
  const partialSweep = ((durationMinutes % 60) / 60) * 2 * Math.PI;
  const duration = splitDuration(durationMs);

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const major = i % 5 === 0;
    const angle = (i / 60) * 2 * Math.PI;
    const [x1, y1] = pointAt(angle, 92);
    const [x2, y2] = pointAt(angle, major ? 81 : 86);
    return h("line", { key: i, x1, y1, x2, y2, className: major ? "dial-tick major" : "dial-tick" });
  });

  const handle = (which) => {
    const time = which === "start" ? start : end;
    const [x, y] = pointAt(minuteAngle(time), RING_RADIUS);
    return h("g", {
      key: which,
      className: `dial-handle ${which}`,
      role: "slider",
      tabIndex: 0,
      "aria-label": which === "start" ? "Starttid" : "Stopptid",
      "aria-valuetext": formatTimeHM(time),
      onPointerDown: beginDrag(which),
      onKeyDown: onHandleKey(which),
    },
      h("circle", { cx: x, cy: y, r: 27, className: "dial-halo" }),
      h("circle", { cx: x, cy: y, r: 19, className: "dial-knob" }),
      which === "start"
        ? h("path", { d: `M ${x - 5} ${y - 8} L ${x + 8} ${y} L ${x - 5} ${y + 8} Z`, className: "dial-icon" })
        : h("rect", { x: x - 6, y: y - 6, width: 12, height: 12, rx: 1.5, className: "dial-icon" })
    );
  };

  const handles = running ? [handle("start")] : topHandle === "start" ? [handle("end"), handle("start")] : [handle("start"), handle("end")];
  const [nowX, nowY] = pointAt(minuteAngle(stopTime), RING_RADIUS);
  const canUsePreviousStop = previousStop && previousStop < stopTime && previousStop.getTime() !== start.getTime();

  return h("div", { className: "tidshjul" },
    h("div", { className: "tj-times" },
      h("div", { className: "tj-side" },
        h("label", null, "Start"),
        h("input", {
          type: "time", className: "tj-time num", value: formatTimeHM(start),
          onChange: (e) => setStartAt(formatDateISO(start), e.target.value),
        }),
        h("input", {
          type: "date", className: "tj-date", value: formatDateISO(start),
          onChange: (e) => setStartAt(e.target.value, formatTimeHM(start)),
        }),
        h("div", { className: "tj-links" },
          canUsePreviousStop && h("button", { type: "button", className: "linkbtn", onClick: () => moveStart(previousStop) }, "Forrige stopp"),
          h("button", { type: "button", className: "linkbtn", onClick: () => moveStart(roundDateToNearest(start, roundMinutes)) }, "Rund av")
        )
      ),
      h("div", { className: "tj-arrow", "aria-hidden": "true" }, "→"),
      h("div", { className: "tj-side" },
        h("label", null, running ? "Nå" : "Stopp"),
        running
          ? h("div", { className: "tj-time tj-static num" }, formatTimeHM(stopTime))
          : h("input", {
              type: "time", className: "tj-time num", value: formatTimeHM(end),
              onChange: (e) => setEndTime(e.target.value),
            }),
        h("div", { className: "tj-date tj-static" }, formatWeekdayDate(stopTime)),
        !running && h("div", { className: "tj-links" },
          h("button", { type: "button", className: "linkbtn", onClick: () => moveEnd(roundDateToNearest(end, roundMinutes)) }, "Rund av")
        )
      )
    ),

    h("div", { className: "dial-wrap" },
      h("svg", {
        ref: svgRef, viewBox: `0 0 ${SIZE} ${SIZE}`, className: "dial",
        onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag,
      },
        h("circle", { cx: CENTER, cy: CENTER, r: RING_RADIUS, className: "dial-track", strokeWidth: RING_WIDTH }),
        // Hele timer fyller ringen svakt; den påbegynte timen tegnes sterkere fra start.
        durationMinutes >= 60 && h("circle", { cx: CENTER, cy: CENTER, r: RING_RADIUS, className: "dial-full", strokeWidth: RING_WIDTH }),
        partialSweep > 0.001 && h("path", { d: arcPath(startAngle, partialSweep, RING_RADIUS), className: "dial-arc", strokeWidth: RING_WIDTH }),
        ticks,
        running && h("circle", { cx: nowX, cy: nowY, r: 7, className: "dial-now live" }),
        handles
      ),
      h("div", { className: "dial-center" },
        h("div", { className: "dial-duration num" }, duration.main, h("sup", null, duration.seconds)),
        !running && h("button", {
          type: "button", className: "linkbtn",
          onClick: () => moveEnd(roundDurationEnd(start, end, roundMinutes)),
        }, "Rund av varighet")
      )
    ),

    h("div", { className: "tj-round" },
      h("span", null, "Avrunding"),
      ROUND_CHOICES.map((minutes) => h("button", {
        key: minutes, type: "button", className: "chip", "data-on": roundMinutes === minutes ? "1" : "0",
        onClick: () => setRoundMinutes(minutes),
      }, `${minutes} min`))
    )
  );
}
