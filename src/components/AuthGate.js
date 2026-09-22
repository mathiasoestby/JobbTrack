// Innlogging/oppkobling foran selve appen: firebaseConfig-oppsett, deretter e-post/passord-innlogging.
import { h, Fragment, useState, useEffect } from "../react.js";
import {
  getStoredFirebaseConfig, saveFirebaseConfig, normalizeFirebaseConfigText,
  connectFirebase, connectFirestoreStorage, migrateLocalBackup,
} from "../firebase.js";
import { App } from "../App.js";

const screenStyle = { maxWidth: 380, margin: "0 auto", padding: "48px 20px", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", color: "#e8edf1" };
const fieldStyle = { width: "100%", padding: "10px 12px", marginBottom: 8, background: "#121b23", color: "#e8edf1", border: "1px solid #26333f", borderRadius: 8, font: "inherit", boxSizing: "border-box" };
const primaryButtonStyle = { ...fieldStyle, background: "#ffb23f", color: "#14202b", fontWeight: 600, border: 0, cursor: "pointer" };
const ghostButtonStyle = { ...fieldStyle, background: "transparent", color: "#8fa3b0", cursor: "pointer" };
const mutedTextStyle = { color: "#8fa3b0", fontSize: 13, lineHeight: 1.5 };

function mapAuthErrorToMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Feil e-post eller passord.";
  if (code.includes("email-already-in-use")) return "Det finnes allerede en bruker med denne e-posten. Logg inn i stedet.";
  if (code.includes("weak-password")) return "Passordet må være minst 6 tegn.";
  if (code.includes("operation-not-allowed")) return "Denne innloggingsmåten er ikke skrudd på i Firebase-prosjektet ennå.";
  return "Innloggingen gikk ikke gjennom. Prøv igjen.";
}

export function AuthGate() {
  const [config, setConfig] = useState(getStoredFirebaseConfig());
  const [client, setClient] = useState(null);
  const [user, setUser] = useState(undefined); // undefined = ukjent ennå, null = ikke innlogget
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [configText, setConfigText] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signUpMode, setSignUpMode] = useState(false);
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    connectFirebase(config)
      .then((c) => {
        if (cancelled) return;
        setClient(c);
        c.authModule.onAuthStateChanged(c.auth, (u) => setUser(u || null));
      })
      .catch(() => setErrorMessage("Fikk ikke lastet Firebase. Sjekk nettet, og at konfigurasjonen stemmer."));
    return () => { cancelled = true; };
  }, [config]);

  useEffect(() => {
    if (!client || !user) return;
    connectFirestoreStorage({ db: client.db, firestoreModule: client.firestoreModule, uid: user.uid });
    migrateLocalBackup()
      .then((didMigrate) => { setMigrated(didMigrate); setReady(true); })
      .catch(() => setReady(true));
  }, [client, user]);

  if (!config) {
    const save = () => {
      try {
        const parsed = JSON.parse(normalizeFirebaseConfigText(configText));
        if (!parsed.apiKey || !parsed.projectId) throw new Error();
        saveFirebaseConfig(parsed);
        setConfig(parsed);
        setErrorMessage("");
      } catch {
        setErrorMessage("Klarte ikke lese konfigurasjonen. Ta med hele objektet, fra { til }.");
      }
    };
    return h("div", { style: screenStyle },
      h("h2", null, "Koble til Firebase"),
      h("p", { style: mutedTextStyle }, "Lim inn firebaseConfig-objektet fra prosjektinnstillingene. Det lagres bare på denne enheten."),
      h("textarea", {
        style: { ...fieldStyle, height: 150, fontFamily: "monospace", fontSize: 12 },
        value: configText, onChange: (e) => setConfigText(e.target.value), placeholder: '{ "apiKey": "...", "projectId": "..." }',
      }),
      errorMessage && h("p", { style: { ...mutedTextStyle, color: "#ff7a6b" } }, errorMessage),
      h("button", { style: primaryButtonStyle, onClick: save }, "Lagre og fortsett")
    );
  }

  if (user === undefined || (user && !ready)) {
    return h("div", { style: { ...screenStyle, ...mutedTextStyle } }, errorMessage || "Kobler til…");
  }

  if (!user) {
    const submit = async (action) => {
      try {
        setErrorMessage("");
        await action();
      } catch (err) {
        setErrorMessage(mapAuthErrorToMessage(err));
      }
    };
    return h("div", { style: screenStyle },
      h("h2", null, signUpMode ? "Lag bruker" : "Logg inn"),
      h("p", { style: mutedTextStyle }, "Samme innlogging på PC og mobil gir deg de samme timene begge steder."),
      h("input", { style: fieldStyle, type: "email", placeholder: "E-post", value: email, onChange: (e) => setEmail(e.target.value) }),
      h("input", { style: fieldStyle, type: "password", placeholder: "Passord", value: password, onChange: (e) => setPassword(e.target.value) }),
      errorMessage && h("p", { style: { ...mutedTextStyle, color: "#ff7a6b" } }, errorMessage),
      h("button", {
        style: primaryButtonStyle,
        onClick: () => submit(() => signUpMode
          ? client.authModule.createUserWithEmailAndPassword(client.auth, email, password)
          : client.authModule.signInWithEmailAndPassword(client.auth, email, password)),
      }, signUpMode ? "Lag bruker" : "Logg inn"),
      h("button", { style: ghostButtonStyle, onClick: () => { setSignUpMode(!signUpMode); setErrorMessage(""); } },
        signUpMode ? "Jeg har bruker fra før" : "Lag ny bruker")
    );
  }

  return h(Fragment, null,
    h("div", { style: { ...mutedTextStyle, textAlign: "center", padding: "10px 16px 0", fontSize: 12.5 } },
      user.email,
      h("button", {
        onClick: () => client.authModule.signOut(client.auth),
        style: { marginLeft: 10, background: "transparent", border: 0, color: "#ffb23f", cursor: "pointer", font: "inherit" },
      }, "Logg ut"),
      migrated && h("div", { style: { color: "#4ec9b0", marginTop: 6 } }, "Timene fra den lokale versjonen er flyttet opp.")
    ),
    h(App, null)
  );
}
