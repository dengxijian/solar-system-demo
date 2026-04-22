import { SolarSystemApp } from "./app.js";
import { applyPresentationParams } from "./presentation.js";
import { bindUI } from "./ui.js";

const app = new SolarSystemApp({
    container: document.getElementById("canvas-container"),
    statusElement: document.getElementById("status-pill"),
});

bindUI(app);
applyPresentationParams(app);
app.start();
window.__SOLAR_SYSTEM_READY__ = true;
