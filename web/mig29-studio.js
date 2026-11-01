import * as T from "./vendor/three.module.js";
import { createMig29Model } from "./mig29-model.js?v=visual-2";
import { preloadMig29Asset as loadMig29Asset } from "./mig29-asset.js?v=visual-2";
import { disposeObject } from "./aircraft-catalog.js";

const $ = (id) => document.getElementById(id),
  canvas = $("model-canvas"),
  status = $("model-status");
const DEG = Math.PI / 180,
  clamp = T.MathUtils.clamp,
  V = (...a) => new T.Vector3(...a);
const PRESETS = {
  overview: {
    name: "전체 형상",
    eye: [14, 7, -18],
    at: [0, 0.3, -0.2],
    number: "01 / AIRFRAME",
    title: "초기 Fulcrum의 실루엣.",
    copy: "좁은 등판과 쌍발 엔진, 큰 날개 뿌리를 가진 9.12의 형상입니다.",
  },
  front: {
    name: "정면",
    eye: [0, 1.1, -24],
    at: [0, 0.4, -0.5],
    number: "02 / AIRFRAME",
    title: "낮게 배치된 두 흡입구.",
    copy: "FOD 차단판과 상부 보조 흡입구로 지상과 비행 상태의 경로를 전환합니다.",
  },
  top: {
    name: "상면",
    eye: [0, 26, 0],
    at: [0, 0, 0],
    number: "03 / AIRFRAME",
    title: "날개 뿌리와 후퇴익.",
    copy: "회녹색 게임 도장과 고정 날개, 앞전·플랩·에일러론을 살펴보세요.",
  },
  bottom: {
    name: "하부 전체",
    eye: [0, -26, 0],
    at: [0, 0, 0],
    number: "04 / AIRFRAME",
    title: "하부 외피와 착륙장치.",
    copy: "두 엔진 나셀 사이의 하부 외피와 착륙장치 수납부를 확인하세요.",
  },
  rear: {
    name: "후면",
    eye: [17, 7, 23],
    at: [0, 0.3, 0],
    number: "05 / AIRFRAME",
    title: "RD-33 쌍발 배기부.",
    copy: "고정축 가변 면적 노즐과 상하로 열리는 에어브레이크입니다.",
  },
  intake: {
    name: "흡입구 상세",
    eye: [1.25, -0.40, -5.25],
    at: [0.72, -0.46, -1.75],
    number: "06 / AIRFRAME",
    title: "주 흡입구와 보조 흡입구.",
    copy: "FOD 차단판을 열어 내부 덕트와 압축기를 확인하세요.",
  },
  nozzle: {
    name: "노즐 상세",
    eye: [1.8, 0.2, 9],
    at: [0.95, -0.188, 5.5],
    number: "07 / AIRFRAME",
    title: "가변 면적 노즐.",
    copy: "겹친 18개 페탈과 배기 통로를 표현했습니다. 출구 개방은 후연 상태에 따라 변합니다.",
  },
  cockpit: {
    name: "조종석 상세",
    eye: [1.35, 2.2, -2.6],
    at: [0, 0.85, -4.0],
    number: "08 / AIRFRAME",
    title: "아날로그 조종석.",
    copy: "원형 비행 계기와 HUD, 좌석과 측면 콘솔을 확인하세요.",
  },
};

let renderer,
  scene,
  camera,
  model,
  env,
  floor,
  observer,
  raf = 0,
  disposed = false,
  contextLost = false;
class Orbit {
  constructor() {
    this.radius = 1;
    this.theta = 0;
    this.phi = Math.PI / 2;
  }
  copy(s) {
    this.radius = s.radius;
    this.theta = s.theta;
    this.phi = s.phi;
    return this;
  }
  setFromVector3(v) {
    this.radius = v.length();
    this.theta = Math.atan2(v.x, v.z);
    this.phi = Math.acos(clamp(v.y / Math.max(this.radius, 1e-9), -1, 1));
    return this;
  }
}
PRESETS.front.fov = 28;
const target = V(),
  targetGoal = V(),
  offset = V(),
  spherical = new Orbit(),
  goal = new Orbit();
let current = "overview",
  dirty = true,
  last = 0,
  width = 1,
  height = 1,
  drag = null,
  pinch = null;
const pointers = new Map(),
  reduced = matchMedia("(prefers-reduced-motion: reduce)");
const pose = { gear: 1, canopy: 0, fod: 1, airbrake: 0, afterburner: 0.3 };
const desired = { ...pose };
function fail(message) {
  status.hidden = false;
  status.classList.add("error");
  status.textContent = message;
  $("save-view").disabled = true;
}
function setView(name, instant = false) {
  const p = PRESETS[name];
  if (!p) return;
  camera.fov = p.fov || 38;
  camera.updateProjectionMatrix();
  current = name;
  targetGoal.set(...p.at);
  offset.set(...p.eye).sub(targetGoal);
  goal.setFromVector3(offset);
  // Portrait stages frame the complete airframe, rather than cropping the wings.
  if (["overview", "front", "top", "bottom", "rear"].includes(name))
    goal.radius *= Math.max(1, 0.95 / (width / height));
  if (instant || reduced.matches) {
    spherical.copy(goal);
    target.copy(targetGoal);
    camera.position.setFromSpherical(spherical).add(target);
    camera.lookAt(target);
  }
  for (const b of document.querySelectorAll("[data-view]"))
    b.setAttribute("aria-pressed", String(b.dataset.view === name));
  $("view-name").textContent = p.name;
  $("detail-number").textContent = p.number;
  $("detail-title").textContent = p.title;
  $("detail-copy").textContent = p.copy;
  dirty = true;
}
function studioEnvironment() {
  const room = new T.Scene();
  room.background = new T.Color(0x7c8185);
  const panel = (color, intensity, size, pos, look) => {
    const mesh = new T.Mesh(
      new T.PlaneGeometry(...size),
      new T.MeshBasicMaterial({
        color: new T.Color(color).multiplyScalar(intensity),
        side: T.DoubleSide,
      }),
    );
    mesh.position.set(...pos);
    mesh.lookAt(...look);
    room.add(mesh);
  };
  panel(0xe1edff, 2.5, [35, 14], [-16, 18, -7], [0, 0, 0]);
  panel(0xb5dbe1, 1.5, [30, 6], [12, 14, 12], [0, 0, 0]);
  panel(0xf5e4cc, 0.9, [20, 6], [5, 4, -25], [0, 0, 0]);
  const pmrem = new T.PMREMGenerator(renderer);
  const result = pmrem.fromScene(room, 0.04, 0.1, 100);
  pmrem.dispose();
  disposeObject(room);
  return result;
}
function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  width = Math.max(1, Math.round(rect.width));
  height = Math.max(1, Math.round(rect.height));
  renderer.setPixelRatio(
    Math.min(devicePixelRatio || 1, width < 700 ? 1.65 : 2),
  );
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  dirty = true;
}
function bindControls() {
  for (const b of document.querySelectorAll("[data-view]"))
    b.addEventListener("click", () => setView(b.dataset.view));
  $("reset-view").addEventListener("click", () => {
    $("gear").checked = true;
    $("canopy").checked = false;
    $("ramp").value = "100";
    $("vector").value = "0";
    $("aperture").value = "30";
    for (const id of ["gear", "canopy", "ramp", "vector", "aperture"])
      $(id).dispatchEvent(new Event("input"));
    setView("overview");
  });
  $("gear").addEventListener("input", () => {
    desired.gear = $("gear").checked ? 1 : 0;
    dirty = true;
  });
  $("canopy").addEventListener("input", () => {
    desired.canopy = $("canopy").checked ? 55 * DEG : 0;
    dirty = true;
  });
  for (const [id, key, scale, unit] of [
    ["ramp", "fod", 0.01, "%"],
    ["vector", "airbrake", 0.01, "%"],
    ["aperture", "afterburner", 0.01, "%"],
  ]) {
    $(id).addEventListener("input", () => {
      desired[key] = Number($(id).value) * scale;
      $(id + "-value").textContent = $(id).value + unit;
      dirty = true;
    });
  }
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      pan: e.shiftKey || e.button === 2,
    };
    pinch = null;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
    }
  });
  function pan(dx, dy) {
    const right = V(1, 0, 0).applyQuaternion(camera.quaternion),
      up = V(0, 1, 0).applyQuaternion(camera.quaternion),
      scale = goal.radius * 0.0018;
    targetGoal
      .addScaledVector(right, -dx * scale)
      .addScaledVector(up, dy * scale);
    // Panning is bounded to keep the model recoverable with ordinary gestures.
    targetGoal.x = clamp(targetGoal.x, -12, 12);
    targetGoal.y = clamp(targetGoal.y, -4, 9);
    targetGoal.z = clamp(targetGoal.z, -14, 14);
  }
  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const previous = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()],
        d = Math.hypot(a.x - b.x, a.y - b.y),
        x = (a.x + b.x) / 2,
        y = (a.y + b.y) / 2;
      if (pinch) {
        goal.radius = clamp(
          (goal.radius * pinch.distance) / Math.max(1, d),
          2.4,
          90,
        );
        pan(x - pinch.x, y - pinch.y);
      }
      pinch = { distance: d, x, y };
    } else if (drag?.id === e.pointerId) {
      if (drag.pan || e.shiftKey)
        pan(e.clientX - previous.x, e.clientY - previous.y);
      else {
        goal.theta -= (e.clientX - previous.x) * 0.006;
        goal.phi = clamp(
          goal.phi - (e.clientY - previous.y) * 0.006,
          0.025,
          Math.PI - 0.06,
        );
      }
    }
    dirty = true;
  });
  function release(e) {
    pointers.delete(e.pointerId);
    pinch = null;
    const remaining = [...pointers.entries()][0];
    drag = remaining ? { id: remaining[0], ...remaining[1], pan: false } : null;
  }
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(name, release);
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      goal.radius = clamp(goal.radius * Math.exp(e.deltaY * 0.001), 2.4, 90);
      dirty = true;
    },
    { passive: false },
  );
  canvas.addEventListener("keydown", (e) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "=",
        "-",
        "Home",
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    if (e.key === "Home") {
      setView("overview");
      return;
    }
    if (e.key === "ArrowLeft") goal.theta += 0.1;
    if (e.key === "ArrowRight") goal.theta -= 0.1;
    if (e.key === "ArrowUp")
      goal.phi = clamp(goal.phi - 0.08, 0.025, Math.PI - 0.06);
    if (e.key === "ArrowDown")
      goal.phi = clamp(goal.phi + 0.08, 0.025, Math.PI - 0.06);
    if (e.key === "+" || e.key === "=")
      goal.radius = Math.max(2.4, goal.radius * 0.9);
    if (e.key === "-") goal.radius = Math.min(90, goal.radius / 0.9);
    dirty = true;
  });
  window.addEventListener("blur", () => {
    drag = null;
    pinch = null;
    pointers.clear();
  });
  $("save-view").addEventListener("click", () => {
    renderer.render(scene, camera);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "Project-Apex-Mig29-" + current + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, "image/png");
  });
}
function render(time) {
  if (disposed) return;
  raf = requestAnimationFrame(render);
  if (document.hidden || contextLost) return;
  const dt = Math.min(0.25, (time - last) / 1000 || 1 / 60);
  last = time;
  const alpha = reduced.matches ? 1 : 1 - Math.exp(-dt * 9);
  let moving =
    Math.abs(spherical.theta - goal.theta) +
      Math.abs(spherical.phi - goal.phi) +
      Math.abs(spherical.radius - goal.radius) +
      target.distanceTo(targetGoal) >
    0.0001;
  spherical.theta = mix(spherical.theta, goal.theta, alpha);
  spherical.phi = mix(spherical.phi, goal.phi, alpha);
  spherical.radius = mix(spherical.radius, goal.radius, alpha);
  target.lerp(targetGoal, alpha);
  for (const key of Object.keys(pose)) {
    moving ||= Math.abs(pose[key] - desired[key]) > 0.0001;
    pose[key] = mix(pose[key], desired[key], alpha);
  }
  if (moving || dirty) {
    camera.position.setFromSpherical(spherical).add(target);
    camera.lookAt(target);
    floor.visible = current !== "bottom" && camera.position.y > -0.5;
    scene.getObjectByName("metre-scale studio ground markings").visible =
      floor.visible;
    model.update(pose, dt);
    renderer.render(scene, camera);
    dirty = false;
  }
}
const mix = T.MathUtils.lerp;
async function boot() {
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color(0x1c2227);
    scene.fog = new T.FogExp2(0x1c2227, 0.009);
    camera = new T.PerspectiveCamera(38, 1, 0.08, 250);
    env = studioEnvironment();
    scene.environment = env.texture;
    const key = new T.DirectionalLight(0xf2f1ea, 2.8);
    key.position.set(-12, 21, -12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -18,
      right: 18,
      top: 18,
      bottom: -18,
      near: 1,
      far: 75,
    });
    key.shadow.normalBias = 0.035;
    key.shadow.bias = -0.00015;
    key.shadow.radius = 3;
    scene.add(key);
    const rim = new T.DirectionalLight(0xc8dee8, 1.4);
    rim.position.set(12, 7, 15);
    scene.add(rim);
    const front = new T.DirectionalLight(0xf5e6d5, 0.8);
    front.position.set(3, 4, -20);
    scene.add(front);
    scene.add(new T.HemisphereLight(0xc8d1d7, 0x26282a, 0.7));
    const undersideFill = new T.DirectionalLight(0xd3e3ec, 0.95);
    undersideFill.position.set(3, -12, -8);
    scene.add(undersideFill);
    floor = new T.Mesh(
      new T.PlaneGeometry(400, 400),
      new T.MeshStandardMaterial({
        color: 0x282c2e,
        roughness: 0.88,
        metalness: 0.15,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.875;
    floor.receiveShadow = true;
    scene.add(floor);
    const marks = new T.Group();
    marks.name = "metre-scale studio ground markings";
    scene.add(marks);
    for (const radius of [11.5, 15.0, 19.0]) {
      const points = Array.from({ length: 181 }, (_, i) =>
        V(
          Math.cos((i / 180) * Math.PI * 2) * radius,
          -1.863,
          Math.sin((i / 180) * Math.PI * 2) * radius,
        ),
      );
      marks.add(
        new T.Line(
          new T.BufferGeometry().setFromPoints(points),
          new T.LineBasicMaterial({
            color: 0x47616e,
            transparent: true,
            opacity: radius === 11.5 ? 0.28 : 0.14,
          }),
        ),
      );
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const asset = await loadMig29Asset((message) => {
      status.textContent = message;
    });
    status.textContent = "곡면과 재질을 준비하는 중…";
    await new Promise((resolve) => requestAnimationFrame(resolve));
    model = createMig29Model(asset);
    scene.add(model.group);
    resize();
    setView(
      new URLSearchParams(location.search).get("view") || "overview",
      true,
    );
    // Compile the actual paint, glass and morph variants before dismissing loading.
    model.update(pose);
    floor.visible = current !== "bottom";
    scene.getObjectByName("metre-scale studio ground markings").visible =
      floor.visible;
    renderer.render(scene, camera);
    status.hidden = true;
    $("save-view").disabled = false;
    observer = new ResizeObserver(() => {
      const oldAspect = width / height;
      resize();
      if (Math.abs(oldAspect - width / height) > 0.15) setView(current);
    });
    observer.observe(canvas.parentElement);
    bindControls();
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      contextLost = true;
      fail("그래픽 연결이 중단되었습니다. 페이지를 새로고침해 주세요.");
    });
    canvas.addEventListener("webglcontextrestored", () => location.reload());
    // Read-only diagnostics for the geometry and browser regression checks.
    Object.defineProperty(window, "mig29Studio", {
      value: {
        get model() {
          return model;
        },
        get camera() {
          return camera;
        },
        get renderer() {
          return renderer;
        },
        get scene() {
          return scene;
        },
        get pose() {
          return { ...pose };
        },
        setView,
        get view() {
          return current;
        },
      },
      configurable: true,
    });
    document.documentElement.dataset.mig29Ready = "true";
    raf = requestAnimationFrame(render);
  } catch (error) {
    console.error(error);
    fail(
      "3D 외형을 준비하지 못했습니다. WebGL 2를 지원하는 최신 브라우저에서 하드웨어 가속을 켜고 다시 시도해 주세요.",
    );
  }
}
window.addEventListener("pagehide", (e) => {
  if (e.persisted) return;
  disposed = true;
  cancelAnimationFrame(raf);
  observer?.disconnect();
  if (scene) disposeObject(scene);
  env?.dispose();
  renderer?.dispose();
});
boot();
