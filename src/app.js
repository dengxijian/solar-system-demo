import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
    OVERVIEW_CAMERA,
    PLANET_CONFIG,
    SHAPE_OPTIONS,
    SUN_CONFIG,
    UNIQUE_SHAPE_SET,
} from "./config.js";
import {
    createBodyMesh,
    createOrbitLine,
    createRingMesh,
    createStarfield,
    disposeMeshResources,
} from "./factory.js";

export class SolarSystemApp {
    constructor({ container, statusElement }) {
        this.container = container;
        this.statusElement = statusElement;
        this.clock = new THREE.Clock();
        this.textureLoader = new THREE.TextureLoader();
        this.textureCache = new Map();
        this.listeners = new Set();
        this.bodySystems = new Map();
        this.focusOrder = ["overview", ...PLANET_CONFIG.map((body) => body.key), SUN_CONFIG.key];
        this.timeScale = 1;
        this.isPaused = false;
        this.previousTimeScale = 1;
        this.focusKey = "overview";
        this.focusWorldPosition = null;
        this.orbitsVisible = true;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x02050d);

        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            1200,
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minDistance = 6;
        this.controls.maxDistance = 240;

        this.handleResize = this.handleResize.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.animate = this.animate.bind(this);

        this.container.appendChild(this.renderer.domElement);
        this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

        this.setupScene();
        this.createSystems();
        this.focusOverview(false);
        this.updateStatus();

        window.addEventListener("resize", this.handleResize);
        window.addEventListener("keydown", this.handleKeyDown);
    }

    setupScene() {
        this.scene.add(createStarfield());

        // Keep a visible base illumination so distant planets still show texture details.
        this.ambientLight = new THREE.AmbientLight(0x8aa0c8, 0.72);
        this.scene.add(this.ambientLight);

        this.hemisphereLight = new THREE.HemisphereLight(0xe7f1ff, 0x1a2236, 0.68);
        this.scene.add(this.hemisphereLight);

        // Use zero decay for classroom visualization, otherwise outer planets are too dark.
        this.sunLight = new THREE.PointLight(0xffffff, 8.5, 0, 0);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 180;
        this.sunLight.shadow.bias = -0.0008;
        this.scene.add(this.sunLight);
    }

    createSystems() {
        const sunSpinPivot = new THREE.Object3D();
        const sunMesh = createBodyMesh(SUN_CONFIG, "sphere", this.getTexture.bind(this));
        sunSpinPivot.add(sunMesh);
        this.scene.add(sunSpinPivot);

        this.bodySystems.set(SUN_CONFIG.key, {
            ...SUN_CONFIG,
            pivot: sunSpinPivot,
            bodyGroup: sunSpinPivot,
            spinPivot: sunSpinPivot,
            bodyMesh: sunMesh,
            currentShape: "sphere",
        });

        PLANET_CONFIG.forEach((bodyConfig) => {
            const pivot = new THREE.Object3D();
            const bodyGroup = new THREE.Object3D();
            const spinPivot = new THREE.Object3D();

            bodyGroup.position.x = bodyConfig.distance;
            pivot.add(bodyGroup);
            bodyGroup.add(spinPivot);
            spinPivot.rotation.z = bodyConfig.tilt ?? 0;

            const bodyMesh = createBodyMesh(bodyConfig, "sphere", this.getTexture.bind(this));
            spinPivot.add(bodyMesh);

            const orbitLine = createOrbitLine(bodyConfig.distance);
            this.scene.add(orbitLine);
            this.scene.add(pivot);

            const system = {
                ...bodyConfig,
                pivot,
                bodyGroup,
                spinPivot,
                bodyMesh,
                orbitLine,
                currentShape: "sphere",
            };

            if (bodyConfig.ring) {
                const ring = createRingMesh(bodyConfig, bodyConfig.ring, this.getTexture.bind(this));
                spinPivot.add(ring);
                system.ring = ring;
            }

            if (bodyConfig.moon) {
                const moonPivot = new THREE.Object3D();
                const moonAnchor = new THREE.Object3D();
                const moonSpinPivot = new THREE.Object3D();
                const moonMesh = createBodyMesh(
                    bodyConfig.moon,
                    "sphere",
                    this.getTexture.bind(this),
                );
                const moonOrbitLine = createOrbitLine(bodyConfig.moon.distance, 0x8fa0ff, 0.28, 64);

                moonAnchor.position.x = bodyConfig.moon.distance;
                moonPivot.add(moonAnchor);
                moonAnchor.add(moonSpinPivot);
                moonSpinPivot.add(moonMesh);
                bodyGroup.add(moonPivot);
                bodyGroup.add(moonOrbitLine);

                system.moon = {
                    ...bodyConfig.moon,
                    pivot: moonPivot,
                    spinPivot: moonSpinPivot,
                    mesh: moonMesh,
                    orbitLine: moonOrbitLine,
                };
            }

            this.bodySystems.set(bodyConfig.key, system);
        });
    }

    getTexture(texturePath) {
        if (!this.textureCache.has(texturePath)) {
            const texture = this.textureLoader.load(texturePath);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = this.maxAnisotropy;
            this.textureCache.set(texturePath, texture);
        }

        return this.textureCache.get(texturePath);
    }

    start() {
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate);

        const delta = Math.min(this.clock.getDelta(), 0.05);
        const scaledDelta = delta * this.timeScale;

        const sunSystem = this.bodySystems.get(SUN_CONFIG.key);
        sunSystem.spinPivot.rotation.y += sunSystem.rotationSpeed * scaledDelta;

        PLANET_CONFIG.forEach((bodyConfig) => {
            const system = this.bodySystems.get(bodyConfig.key);
            system.pivot.rotation.y += system.orbitSpeed * scaledDelta;
            system.spinPivot.rotation.y += system.rotationSpeed * scaledDelta;

            if (system.moon) {
                system.moon.pivot.rotation.y += system.moon.orbitSpeed * scaledDelta;
                system.moon.spinPivot.rotation.y += system.moon.rotationSpeed * scaledDelta;
            }
        });

        this.scene.updateMatrixWorld(true);
        this.updateFocusTracking();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getState());
        return () => {
            this.listeners.delete(listener);
        };
    }

    notify() {
        const state = this.getState();
        this.listeners.forEach((listener) => listener(state));
    }

    getState() {
        const currentFocus = this.getFocusLabel(this.focusKey);

        return {
            timeScale: this.timeScale,
            isPaused: this.isPaused,
            focusKey: this.focusKey,
            focusLabel: currentFocus,
            orbitsVisible: this.orbitsVisible,
        };
    }

    getFocusOptions() {
        return [
            { key: "overview", label: "总览" },
            ...PLANET_CONFIG.map((body) => ({ key: body.key, label: body.label })),
            { key: SUN_CONFIG.key, label: SUN_CONFIG.label },
        ];
    }

    getReplaceableBodies() {
        return PLANET_CONFIG.map((body) => ({ key: body.key, label: body.label }));
    }

    getShapeOptions() {
        return SHAPE_OPTIONS;
    }

    getFocusLabel(key) {
        if (key === "overview") {
            return "总览";
        }

        return this.bodySystems.get(key)?.label ?? "总览";
    }

    getBodyShape(bodyKey) {
        return this.bodySystems.get(bodyKey)?.currentShape ?? "sphere";
    }

    getShapeLabel(shapeKey) {
        return SHAPE_OPTIONS.find((item) => item.key === shapeKey)?.label ?? "球体";
    }

    setPaused(paused) {
        if (paused) {
            if (!this.isPaused) {
                this.previousTimeScale = this.timeScale || this.previousTimeScale || 1;
                this.timeScale = 0;
                this.isPaused = true;
            }
        } else if (this.isPaused) {
            this.timeScale = this.previousTimeScale || 1;
            this.isPaused = false;
        }

        this.updateStatus();
        this.notify();
    }

    setTimeScale(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return;
        }

        const clampedValue = THREE.MathUtils.clamp(numericValue, 0.125, 32);
        this.timeScale = clampedValue;
        this.previousTimeScale = clampedValue;
        this.isPaused = false;
        this.updateStatus();
        this.notify();
    }

    togglePause() {
        if (this.isPaused) {
            this.timeScale = this.previousTimeScale;
            this.isPaused = false;
        } else {
            this.previousTimeScale = this.timeScale;
            this.timeScale = 0;
            this.isPaused = true;
        }

        this.updateStatus();
        this.notify();
    }

    multiplyTimeScale(factor) {
        if (this.isPaused) {
            return;
        }

        this.timeScale = THREE.MathUtils.clamp(this.timeScale * factor, 0.125, 32);
        this.updateStatus();
        this.notify();
    }

    resetTimeScale() {
        this.timeScale = 1;
        this.previousTimeScale = 1;
        this.isPaused = false;
        this.updateStatus();
        this.notify();
    }

    focusOverview(shouldNotify = true) {
        this.focusKey = "overview";
        this.focusWorldPosition = null;
        this.controls.target.set(...OVERVIEW_CAMERA.target);
        this.camera.position.set(...OVERVIEW_CAMERA.position);
        this.controls.update();
        this.updateStatus();
        if (shouldNotify) {
            this.notify();
        }
    }

    focusBody(bodyKey) {
        if (bodyKey === "overview") {
            this.focusOverview();
            return;
        }

        const system = this.bodySystems.get(bodyKey);
        if (!system) {
            return;
        }

        this.scene.updateMatrixWorld(true);

        const targetPosition = new THREE.Vector3();
        system.bodyGroup.getWorldPosition(targetPosition);

        const currentOffset = this.camera.position.clone().sub(this.controls.target);
        if (currentOffset.lengthSq() === 0) {
            currentOffset.set(1, 0.45, 1);
        }

        currentOffset.normalize();
        const focusDistance = Math.max(system.radius * 10, 8);
        const cameraPosition = targetPosition.clone().add(currentOffset.multiplyScalar(focusDistance));
        cameraPosition.y += Math.max(system.radius * 1.2, 1.5);

        this.controls.target.copy(targetPosition);
        this.camera.position.copy(cameraPosition);
        this.controls.update();

        this.focusKey = bodyKey;
        this.focusWorldPosition = targetPosition.clone();
        this.updateStatus();
        this.notify();
    }

    getFocusPosition(bodyKey = this.focusKey) {
        if (bodyKey === "overview") {
            return null;
        }

        const system = this.bodySystems.get(bodyKey);
        if (!system) {
            return null;
        }

        const targetPosition = new THREE.Vector3();
        system.bodyGroup.getWorldPosition(targetPosition);
        return targetPosition;
    }

    updateFocusTracking() {
        const targetPosition = this.getFocusPosition();
        if (!targetPosition) {
            return;
        }

        if (!this.focusWorldPosition) {
            this.focusWorldPosition = targetPosition.clone();
            return;
        }

        const delta = targetPosition.clone().sub(this.focusWorldPosition);
        if (delta.lengthSq() === 0) {
            return;
        }

        this.controls.target.add(delta);
        this.camera.position.add(delta);
        this.focusWorldPosition.copy(targetPosition);
    }

    cycleFocus(step) {
        const currentIndex = this.focusOrder.indexOf(this.focusKey);
        const nextIndex = (currentIndex + step + this.focusOrder.length) % this.focusOrder.length;
        const nextKey = this.focusOrder[nextIndex];

        if (nextKey === "overview") {
            this.focusOverview();
        } else {
            this.focusBody(nextKey);
        }
    }

    setBodyShape(bodyKey, shapeKey) {
        const system = this.bodySystems.get(bodyKey);
        if (!system || system.replaceable === false) {
            return;
        }

        if (system.currentShape === shapeKey) {
            return;
        }

        const nextMesh = createBodyMesh(system, shapeKey, this.getTexture.bind(this));
        system.spinPivot.remove(system.bodyMesh);
        disposeMeshResources(system.bodyMesh);
        system.bodyMesh = nextMesh;
        system.currentShape = shapeKey;
        system.spinPivot.add(nextMesh);

        this.updateStatus();
        this.notify();
    }

    restoreBodyShape(bodyKey) {
        this.setBodyShape(bodyKey, "sphere");
    }

    restoreAllShapes() {
        PLANET_CONFIG.forEach((body) => {
            this.setBodyShape(body.key, "sphere");
        });
    }

    applyUniqueShapeSet() {
        Object.entries(UNIQUE_SHAPE_SET).forEach(([bodyKey, shapeKey]) => {
            this.setBodyShape(bodyKey, shapeKey);
        });
    }

    setOrbitsVisible(visible) {
        this.orbitsVisible = Boolean(visible);

        PLANET_CONFIG.forEach((body) => {
            const system = this.bodySystems.get(body.key);
            system.orbitLine.visible = this.orbitsVisible;
            if (system.moon) {
                system.moon.orbitLine.visible = this.orbitsVisible;
            }
        });

        this.updateStatus();
        this.notify();
    }

    toggleOrbits() {
        this.setOrbitsVisible(!this.orbitsVisible);
    }

    adjustCamera({ theta = 0, phi = 0, zoom = 1 }) {
        const offset = this.camera.position.clone().sub(this.controls.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);

        spherical.theta += theta;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi + phi, 0.25, Math.PI - 0.25);
        spherical.radius = THREE.MathUtils.clamp(spherical.radius * zoom, 4, 260);

        offset.setFromSpherical(spherical);
        this.camera.position.copy(this.controls.target).add(offset);
        this.controls.update();
    }

    updateStatus() {
        if (!this.statusElement) {
            return;
        }

        const focusLabel = this.getFocusLabel(this.focusKey);
        const playback = this.isPaused ? "已暂停" : `时间 ${this.timeScale.toFixed(1)}x`;
        const orbitText = this.orbitsVisible ? "轨道显示" : "轨道隐藏";
        this.statusElement.textContent = `聚焦: ${focusLabel} | ${playback} | ${orbitText}`;
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    handleKeyDown(event) {
        const tagName = document.activeElement?.tagName;
        if (tagName === "SELECT" || tagName === "BUTTON") {
            return;
        }

        switch (event.code) {
            case "Space":
                event.preventDefault();
                this.togglePause();
                break;
            case "BracketLeft":
                this.multiplyTimeScale(0.5);
                break;
            case "BracketRight":
                this.multiplyTimeScale(2);
                break;
            case "KeyA":
                this.adjustCamera({ theta: 0.1 });
                break;
            case "KeyD":
                this.adjustCamera({ theta: -0.1 });
                break;
            case "KeyW":
                this.adjustCamera({ phi: -0.08 });
                break;
            case "KeyS":
                this.adjustCamera({ phi: 0.08 });
                break;
            case "KeyQ":
                this.adjustCamera({ zoom: 0.9 });
                break;
            case "KeyE":
                this.adjustCamera({ zoom: 1.1 });
                break;
            case "ArrowLeft":
                this.cycleFocus(-1);
                break;
            case "ArrowRight":
                this.cycleFocus(1);
                break;
            case "Digit0":
                this.focusOverview();
                break;
            case "Digit1":
                this.focusBody("mercury");
                break;
            case "Digit2":
                this.focusBody("venus");
                break;
            case "Digit3":
                this.focusBody("earth");
                break;
            case "Digit4":
                this.focusBody("mars");
                break;
            case "Digit5":
                this.focusBody("jupiter");
                break;
            case "Digit6":
                this.focusBody("saturn");
                break;
            case "Digit7":
                this.focusBody("uranus");
                break;
            case "Digit8":
                this.focusBody("neptune");
                break;
            case "Digit9":
                this.focusBody("sun");
                break;
            case "KeyT":
                this.toggleOrbits();
                break;
            default:
                break;
        }
    }
}
