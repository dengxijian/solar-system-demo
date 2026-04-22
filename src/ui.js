export function bindUI(app) {
    const speedDisplay = document.getElementById("speed-display");
    const focusSelect = document.getElementById("focus-select");
    const bodySelect = document.getElementById("body-select");
    const shapeSelect = document.getElementById("shape-select");
    const shapeDisplay = document.getElementById("shape-display");

    const focusOptions = app.getFocusOptions();
    const replaceableBodies = app.getReplaceableBodies();
    const shapeOptions = app.getShapeOptions();

    focusOptions.forEach((option) => {
        focusSelect.add(new Option(option.label, option.key));
    });

    replaceableBodies.forEach((option) => {
        bodySelect.add(new Option(option.label, option.key));
    });

    shapeOptions.forEach((option) => {
        shapeSelect.add(new Option(option.label, option.key));
    });

    bodySelect.value = replaceableBodies[0]?.key ?? "";
    shapeSelect.value = app.getBodyShape(bodySelect.value);

    function updateShapeStatus() {
        const currentShape = app.getBodyShape(bodySelect.value);
        shapeDisplay.textContent = app.getShapeLabel(currentShape);
        shapeSelect.value = currentShape;
    }

    document.getElementById("btn-pause").addEventListener("click", () => {
        app.togglePause();
    });

    document.getElementById("btn-slow").addEventListener("click", () => {
        app.multiplyTimeScale(0.5);
    });

    document.getElementById("btn-fast").addEventListener("click", () => {
        app.multiplyTimeScale(2);
    });

    document.getElementById("btn-reset").addEventListener("click", () => {
        app.resetTimeScale();
    });

    document.getElementById("btn-focus").addEventListener("click", () => {
        if (focusSelect.value === "overview") {
            app.focusOverview();
            return;
        }

        app.focusBody(focusSelect.value);
    });

    document.getElementById("btn-overview").addEventListener("click", () => {
        focusSelect.value = "overview";
        app.focusOverview();
    });

    document.getElementById("btn-orbits").addEventListener("click", () => {
        app.toggleOrbits();
    });

    document.getElementById("btn-apply-shape").addEventListener("click", () => {
        app.setBodyShape(bodySelect.value, shapeSelect.value);
        updateShapeStatus();
    });

    document.getElementById("btn-restore-shape").addEventListener("click", () => {
        app.restoreBodyShape(bodySelect.value);
        updateShapeStatus();
    });

    document.getElementById("btn-unique-set").addEventListener("click", () => {
        app.applyUniqueShapeSet();
        updateShapeStatus();
    });

    document.getElementById("btn-restore-all").addEventListener("click", () => {
        app.restoreAllShapes();
        updateShapeStatus();
    });

    bodySelect.addEventListener("change", () => {
        updateShapeStatus();
    });

    focusSelect.addEventListener("change", () => {
        if (focusSelect.value === "overview") {
            app.focusOverview();
            return;
        }

        app.focusBody(focusSelect.value);
    });

    app.subscribe((state) => {
        speedDisplay.textContent = state.timeScale.toFixed(1);
        focusSelect.value = state.focusKey;
        updateShapeStatus();
    });
}
