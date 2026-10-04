import { mount } from "svelte";
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/lexend/latin-400.css";
import "@fontsource/lexend/latin-700.css";
import "@fontsource/opendyslexic/latin-400.css";
import "@fontsource/opendyslexic/latin-700.css";
import "./app.css";
import { applyReading, loadReading } from "./lib/reading";
import App from "./App.svelte";

// Before the app mounts, so the first paint already uses the saved choices.
applyReading(loadReading(), false);

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
