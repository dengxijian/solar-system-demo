function isFalseLike(value) {
    if (value == null) {
        return false;
    }

    return ["0", "false", "off", "hide", "no"].includes(value.toLowerCase());
}

function isTrueLike(value) {
    if (value == null) {
        return false;
    }

    return ["1", "true", "on", "show", "yes"].includes(value.toLowerCase());
}

function setBodyVisibility(elementId, isVisible) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    element.hidden = !isVisible;
}

export function applyPresentationParams(app) {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length === 0) {
        return;
    }

    const panelParam = params.get("panel");
    if (isFalseLike(panelParam)) {
        document.body.classList.add("presentation-no-panel");
    }

    const statusParam = params.get("status");
    if (isFalseLike(statusParam)) {
        document.body.classList.add("presentation-no-status");
        setBodyVisibility("status-pill", false);
    }

    const preset = params.get("preset");
    if (preset === "unique") {
        app.applyUniqueShapeSet();
    }

    const body = params.get("body");
    const shape = params.get("shape");
    if (body && shape) {
        app.setBodyShape(body, shape);
    }

    const orbits = params.get("orbits");
    if (isFalseLike(orbits)) {
        app.setOrbitsVisible(false);
    } else if (isTrueLike(orbits)) {
        app.setOrbitsVisible(true);
    }

    const focus = params.get("focus");
    if (focus) {
        if (focus === "overview") {
            app.focusOverview(false);
        } else {
            app.focusBody(focus);
        }
    }

    const timeScale = params.get("time");
    if (timeScale) {
        app.setTimeScale(Number(timeScale));
    }

    const paused = params.get("paused");
    if (isTrueLike(paused)) {
        app.setPaused(true);
    } else if (isFalseLike(paused)) {
        app.setPaused(false);
    }
}
