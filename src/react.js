// React 19 har ikke lenger UMD-bygg (bare CJS/ESM), så vi henter dem som ES-moduler
// fra esm.sh i stedet for å vendore inn en minifisert kopi. esm.sh peker begge
// pakkene til nøyaktig samme react.mjs-fil, så de deler samme React-instans.
import React from "https://esm.sh/react@19.3.0";
import ReactDOM from "https://esm.sh/react-dom@19.3.0/client";

export { React, ReactDOM };

export const { useState, useEffect, useRef, useMemo, Fragment } = React;

// Kort alias for React.createElement (samme idé som "h" i Preact/hyperscript) —
// gjør trestrukturen i komponentene mye lettere å lese uten JSX/build-steg.
export const h = React.createElement;
