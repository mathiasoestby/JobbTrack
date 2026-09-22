import { h, Fragment, useState, useEffect, useRef } from "./react.js";
import { loadData, saveData } from "./store.js";
import { Stoppeklokke } from "./components/Stoppeklokke.js";
import { Timeliste } from "./components/Timeliste.js";
import { Lonn } from "./components/Lonn.js";
import { Jobber, Sikkerhetskopi } from "./components/Jobber.js";
import { Rapport } from "./components/Rapport.js";
import { TidsKalender } from "./components/Kalender.js";

// Korte faneetiketter — fem faner må få plass side om side på en smal telefon.
const TABS = [
  ["tid", "Klokke"],
  ["liste", "Timeliste"],
  ["lonn", "Lønn"],
  ["rapport", "Rapport"],
  ["jobber", "Jobber"],
];

export function App() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("tid");
  const [now, setNow] = useState(Date.now());
  const [saveError, setSaveError] = useState("");
  const lastDataRef = useRef(null);

  useEffect(() => {
    loadData().then(setData);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const persist = async (d) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (await saveData(d)) return setSaveError(""), true;
      } catch {
        // prøv igjen
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    setSaveError("Lagringen svarer ikke. Timene ligger trygt i appen så lenge du står her, men forsvinner hvis du lukker den. Ta en sikkerhetskopi nederst før du går.");
    return false;
  };

  const update = (patch) => {
    setData((d) => {
      const next = typeof patch === "function" ? patch(d) : patch;
      lastDataRef.current = next;
      persist(next);
      return next;
    });
  };

  if (!data) {
    return h("div", {
      style: { background: "#101820", color: "#8fa3b0", minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" },
    }, "Henter timelista…");
  }

  const jobById = (id) => data.jobs.find((j) => j.id === id);

  return h("div", { className: "app" },
    h("div", { className: "layout" },
      h("div", { className: "main-col" },
        saveError && h("div", { className: "verdict bad", style: { marginBottom: 12 } },
          h("div", { style: { marginBottom: 8 } }, saveError),
          h("button", { className: "tiny", onClick: () => persist(lastDataRef.current || data) }, "Prøv å lagre igjen")
        ),
        activeTab === "tid" && h(Stoppeklokke, { data, update, now, jobById }),
        activeTab === "liste" && h(Timeliste, { data, update, jobById }),
        activeTab === "lonn" && h(Lonn, { data, update }),
        activeTab === "rapport" && h(Rapport, { data }),
        activeTab === "jobber" && h(Fragment, null, h(Jobber, { data, update }), h(Sikkerhetskopi, { data, update }))
      ),
      h(TidsKalender, { data, jobById, update })
    ),
    h("nav", { className: "tabs" },
      TABS.map(([key, label]) => h("button", {
        key, "data-on": activeTab === key ? "1" : "0", onClick: () => setActiveTab(key),
      }, label))
    )
  );
}
