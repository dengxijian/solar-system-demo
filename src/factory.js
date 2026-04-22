import * as THREE from "three";

function buildGeometry(shapeKey, radius) {
    switch (shapeKey) {
        case "box":
            return new THREE.BoxGeometry(radius * 2.1, radius * 2.1, radius * 2.1);
        case "octahedron":
            return new THREE.OctahedronGeometry(radius * 1.55, 0);
        case "cylinder":
            return new THREE.CylinderGeometry(radius, radius, radius * 2.5, 36, 1);
        case "cone":
            return new THREE.ConeGeometry(radius * 1.1, radius * 2.6, 36, 1);
        case "dodecahedron":
            return new THREE.DodecahedronGeometry(radius * 1.22, 0);
        case "icosahedron":
            return new THREE.IcosahedronGeometry(radius * 1.28, 0);
        case "capsule":
            return new THREE.CapsuleGeometry(radius * 0.72, radius * 1.5, 8, 18);
        case "torusKnot":
            return new THREE.TorusKnotGeometry(radius * 0.78, radius * 0.26, 120, 18);
        case "sphere":
        default:
            return new THREE.SphereGeometry(radius, 48, 48);
    }
}

function createBodyMaterial(bodyConfig, shapeKey, getTexture) {
    if (bodyConfig.materialType === "emissive") {
        return new THREE.MeshBasicMaterial({
            map: getTexture(bodyConfig.texture),
            color: 0xfff3d0,
        });
    }

    const texture = getTexture(bodyConfig.texture);

    return new THREE.MeshPhongMaterial({
        map: texture,
        emissive: new THREE.Color(0x181818),
        emissiveMap: texture,
        specular: new THREE.Color(0x4f5d73),
        shininess: bodyConfig.shininess ?? 12,
        flatShading: shapeKey !== "sphere" && shapeKey !== "capsule",
    });
}

export function createBodyMesh(bodyConfig, shapeKey, getTexture) {
    const geometry = buildGeometry(shapeKey, bodyConfig.radius);
    const material = createBodyMaterial(bodyConfig, shapeKey, getTexture);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = bodyConfig.materialType !== "emissive";
    mesh.receiveShadow = bodyConfig.materialType !== "emissive";
    mesh.userData.shapeKey = shapeKey;
    return mesh;
}

export function createOrbitLine(radius, color = 0xffffff, opacity = 0.16, segments = 128) {
    const points = [];
    for (let i = 0; i <= segments; i += 1) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
    });

    return new THREE.LineLoop(geometry, material);
}

export function createRingMesh(bodyConfig, ringConfig, getTexture) {
    const innerRadius = bodyConfig.radius * ringConfig.innerScale;
    const outerRadius = bodyConfig.radius * ringConfig.outerScale;
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 96);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;

    for (let index = 0; index < position.count; index += 1) {
        const x = position.getX(index);
        const y = position.getY(index);
        const radialDistance = Math.sqrt((x * x) + (y * y));
        const mappedU = (radialDistance - innerRadius) / (outerRadius - innerRadius);
        uv.setXY(index, mappedU, 0.5);
    }

    const texture = getTexture(ringConfig.texture);
    const material = new THREE.MeshPhongMaterial({
        map: texture,
        alphaMap: texture,
        transparent: true,
        alphaTest: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
        shininess: 10,
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = ringConfig.tilt;
    ring.castShadow = false;
    ring.receiveShadow = false;
    return ring;
}

export function createStarfield() {
    const starCount = 2500;
    const positions = new Float32Array(starCount * 3);
    const radiusMin = 120;
    const radiusMax = 240;

    for (let index = 0; index < starCount; index += 1) {
        const radius = THREE.MathUtils.lerp(radiusMin, radiusMax, Math.random());
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        const stride = index * 3;

        positions[stride] = radius * Math.sin(phi) * Math.cos(theta);
        positions[stride + 1] = radius * Math.cos(phi);
        positions[stride + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.65,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
    });

    return new THREE.Points(geometry, material);
}

export function disposeMeshResources(mesh) {
    if (!mesh) {
        return;
    }

    if (mesh.geometry) {
        mesh.geometry.dispose();
    }

    const { material } = mesh;
    if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
    } else if (material) {
        material.dispose();
    }
}
