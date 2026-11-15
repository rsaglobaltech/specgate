/**
 * The studio's app (change studio-redesign). Mounted into the shell Specgate
 * serves; reads `/api/*` and writes with the page's token, as before.
 */
import { render } from "preact";
import { App } from "./App";

const root = document.getElementById("app");
if (root) render(<App />, root);
