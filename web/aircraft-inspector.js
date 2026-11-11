import * as T from "./vendor/three.module.js";
import { createAircraft } from "./aircraft.js?v=mig23mld-11";
import { aircraftDefinition, disposeObject } from "./aircraft-catalog.js";

const V = (...p) => new T.Vector3(...p),
  D = Math.PI / 180,
  clamp = T.MathUtils.clamp;
const views = [
  ["overview", "전체"],
  ["front", "정면"],
  ["top", "상면"],
  ["bottom", "하부"],
  ["rear", "후면"],
  ["intake", "흡입구"],
  ["nozzle", "노즐"],
  ["cockpit", "조종석"],
];
export function createAircraftInspector({
  document: d,
  getType,
  getSnapshot = () => ({}),
  onOpen = () => {},
  onClose = () => {},
}) {
  const dialog = d.createElement("dialog");
  dialog.id = "aircraft-inspector";
  dialog.className = "aircraft-inspector";
  dialog.setAttribute("aria-labelledby", "inspector-title");
  dialog.innerHTML = `<header class="inspector-heading"><div><span>AIRFRAME STUDIO</span><h2 id="inspector-title"></h2></div><button type="button" id="inspector-close" aria-label="기체 자세히 보기 닫기">닫기 ×</button></header><div class="inspector-layout"><section class="inspector-stage"><canvas id="inspector-canvas" tabindex="0" aria-label="기체 3D 보기. 드래그 회전, Shift 또는 오른쪽 드래그 이동, 휠·두 손가락 확대. 방향키 회전, Home 초기화."></canvas><span id="inspector-view-name" class="inspector-view-name"></span><p class="inspector-hint">드래그 회전 · Shift / 오른쪽 드래그 이동 · 휠 / 두 손가락 확대</p><p id="inspector-status" role="status">기체를 준비하는 중…</p></section><aside class="inspector-panel"><nav aria-label="기체 상세 시점">${views.map(([id, label]) => `<button type="button" data-inspector-view="${id}" aria-pressed="${id === "overview"}">${label}</button>`).join("")}</nav><p id="inspector-description"></p><fieldset><legend>가동부 살펴보기</legend><label><span>착륙장치</span><input id="inspector-gear" type="checkbox" checked></label><label id="inspector-canopy-row"><span>캐노피 열기</span><input id="inspector-canopy" type="checkbox"></label><label id="inspector-fod-row"><span>흡입구 FOD 차단판</span><input id="inspector-fod" type="checkbox" checked></label><label id="inspector-bay-row"><span>무장창 열기</span><input id="inspector-bay" type="checkbox"></label><label id="inspector-fold-row"><span>날개 접기</span><input id="inspector-fold" type="checkbox"></label><label id="inspector-sweep-row" class="inspector-range"><span>날개 후퇴각</span><output id="inspector-sweep-value">20°</output><input id="inspector-sweep" type="range" min="20" max="68" value="20"></label><label id="inspector-aperture-row" class="inspector-range"><span>노즐 개방</span><output id="inspector-aperture-value">30%</output><input id="inspector-aperture" type="range" min="0" max="100" value="30"></label><label id="inspector-vector-row" class="inspector-range"><span>노즐 편향</span><output id="inspector-vector-value">0°</output><input id="inspector-vector" type="range" min="-15" max="15" value="0"></label></fieldset><div class="inspector-tools"><button id="inspector-zoom-in" aria-label="기체 확대">＋</button><button id="inspector-zoom-out" aria-label="기체 축소">−</button><button id="inspector-reset">전체 보기</button><button id="inspector-save">화면 저장 ↓</button></div><p class="inspector-note">관찰용 가동부 조작입니다. 닫으면 이전 화면으로 돌아갑니다.</p></aside></div>`;
  d.body.append(dialog);
  const $ = (id) => d.getElementById(id),
    canvas = $("inspector-canvas"),
    stage = canvas.parentElement,
    pointers = new Map();
  let renderer,
    scene,
    camera,
    model,
    observer,
    raf = 0,
    last = 0,
    previousFocus,
    type,
    definition,
    snapshot,
    view = "overview",
    radius = 20,
    azimuth = 2.5,
    elevation = 0.25,
    width = 1,
    height = 1,
    disposed = true,
    contextLost = false,
    dirty = true;
  const target = V(),
    pan = V(),
    offset = V(),
    box = new T.Box3();
  let floor,
    ground = -2;
  function releasePointers() {
    for (const id of pointers.keys())
      try {
        canvas.releasePointerCapture(id);
      } catch {}
    pointers.clear();
  }
  function setView(name) {
    if (!model) return;
    view = name;
    dirty = true;
    pan.set(0, 0, 0);
    const length = definition.length,
      span = definition.span,
      max = Math.max(length, span);
    target.copy(box.getCenter(V()));
    let eye, at;
    const direction = {
      overview: [1, 0.45, -1.3],
      front: [0, 0.1, -1],
      top: [0, 1, 0.001],
      bottom: [0, -1, 0.001],
      rear: [0.65, 0.25, 1],
    };
    if (direction[name]) {
      const vertical = ["top", "bottom"].includes(name)
        ? length
        : box.getSize(V()).y;
      const horizontal = ["top", "bottom", "front", "rear"].includes(name)
        ? span
        : max;
      const distance =
        (Math.max(vertical, horizontal / Math.max(0.35, width / height)) *
          0.6) /
        Math.tan((38 * D) / 2);
      eye = V(...direction[name])
        .normalize()
        .multiplyScalar(distance)
        .add(target);
    } else {
      const id = name === "cockpit" ? 11 : name === "intake" ? 27 : 22,
        b = model.group.userData.damagePartBounds?.[id];
      at = b ? V(...b.center) : target.clone();
      if (name === "intake") {
        at.z = b ? b.min[2] + 0.2 : -length * 0.12;
        eye = at
          .clone()
          .add(V(Math.min(1.2, span * 0.09), 0.1, -Math.min(4, length * 0.24)));
      }
      if (name === "nozzle") {
        const exhaust =
          model.group.userData.effectsAnchors?.exhaust?.[1] ||
          model.group.userData.effectsAnchors?.exhaust?.[0];
        if (exhaust) at.set(...exhaust);
        eye = at.clone().add(V(0.8, 0.4, Math.min(4, length * 0.2)));
      }
      if (name === "cockpit") {
        eye = at.clone().add(V(Math.min(1.7, span * 0.13), 1.3, 1.1));
      }
      if (type === 13) {
        if (name === "intake") {
          at.set(1.25, -0.067, -2.28);
          eye = V(2.05, -0.05, -6.0);
        }
        if (name === "cockpit") {
          at.set(0, 1.2, -6.8);
          eye = V(1.8, 2.5, -5.4);
        }
      }
      if (type === 14) {
        if (name === "intake") {
          at.set(0.72, -0.46, -1.75);
          eye = V(1.3, -0.3, -5.2);
        }
        if (name === "cockpit") {
          at.set(0, 0.85, -4.0);
          eye = V(1.35, 2.2, -2.6);
        }
      }
      if(type===15){if(name==='intake'){at.set(0,0,-4.65);eye=V(1.05,.3,-7.4);}if(name==='cockpit'){at.set(0,.93,-2.65);eye=V(1.6,1.9,-4.0);}}
      target.copy(at);
      if (width / height < 0.8) eye.sub(at).multiplyScalar(1.3).add(at);
    }
    offset.copy(eye).sub(target);
    radius = offset.length();
    azimuth = Math.atan2(offset.x, offset.z);
    elevation = Math.asin(offset.y / radius);
    for (const button of dialog.querySelectorAll("[data-inspector-view]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.inspectorView === name),
      );
    $("inspector-view-name").textContent = views.find(([id]) => id === name)[1];
    $("inspector-description").textContent = {
      overview: "기체 전체 형상과 선택한 무장 구성을 살펴보세요.",
      front: "정면에서 동체와 날개, 흡입구 배치를 확인하세요.",
      top: "날개 평면형과 상부 표면을 살펴보세요.",
      bottom: "기체 아래로 돌아가 하부 외피와 착륙장치를 확인하세요.",
      rear: "엔진 배기부와 미익 배치를 살펴보세요.",
      intake: "입구 테두리에서 내부 덕트까지 확대해 보세요.",
      nozzle: "배기 통로와 노즐 형상을 살펴보세요.",
      cockpit: "캐노피와 조종석 주변을 확대해 보세요.",
    }[name];
  }
  function resize() {
    dirty = true;
    const r = stage.getBoundingClientRect();
    width = Math.max(1, r.width);
    height = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function render(now) {
    if (disposed) return;
    raf = requestAnimationFrame(render);
    if (d.hidden || contextLost || !dirty) return;
    if (now - last < 1000 / 30) return;
    draw(now);
  }
  function draw(now) {
    if (disposed || contextLost) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 1 / 60);
    last = now;
    dirty = false;
    const vector = Number($("inspector-vector").value) * D,
      gear = $("inspector-gear").checked ? 1 : 0;
    model.update(
      {
        ...snapshot,
        gear,
        canopy: $("inspector-canopy").checked ? 0.85 : 0,
        fod: $("inspector-fod").checked ? 1 : 0,
        intakeRamp: 0,
        bayPreview: $("inspector-bay").checked,
        wingFold: $("inspector-fold").checked ? 1 : 0,
        wingSweep: Number($("inspector-sweep").value),
        afterburner: Number($("inspector-aperture").value) / 100,
        vectorPitch: vector,
        leftNozzle: vector,
        rightNozzle: vector,
        nozzle: vector,
        gunFiring: false,
        time: now / 1000,
        leftTail: 0,
        rightTail: 0,
        leftFlap: 0,
        rightFlap: 0,
        leftAileron: 0,
        rightAileron: 0,
        leftRudder: 0,
        rightRudder: 0,
      },
      dt,
    );
    // Preview nozzle area without a flame covering the hardware.
    model.group.traverse((o) => {
      if (o.isMesh && o.material.isShaderMaterial) o.visible = false;
    });
    camera.position
      .copy(target)
      .add(pan)
      .add(
        offset
          .set(
            Math.sin(azimuth) * Math.cos(elevation),
            Math.sin(elevation),
            Math.cos(azimuth) * Math.cos(elevation),
          )
          .multiplyScalar(radius),
      );
    camera.up.set(0, 1, 0);
    camera.lookAt(target.clone().add(pan));
    const near = clamp(radius / 200, 0.015, 0.5);
    if (camera.near !== near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    floor.visible = view !== "bottom" && camera.position.y > ground + 0.05;
    renderer.render(scene, camera);
  }
  function close() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    observer?.disconnect();
    releasePointers();
    dialog.close();
    delete dialog.dataset.ready;
    if (scene) {
      const textures = new Set();
      scene.traverse((o) => {
        if (!o.material) return;
        for (const material of Array.isArray(o.material)
          ? o.material
          : [o.material])
          for (const value of Object.values(material))
            if (value?.isCanvasTexture) textures.add(value);
      });
      for (const texture of textures) texture.dispose();
      disposeObject(scene);
    }
    renderer?.renderLists.dispose();
    model = scene = camera = floor = snapshot = undefined;
    onClose();
    previousFocus?.focus?.({ preventScroll: true });
  }
  function open(requested = getType()) {
    if (!disposed) return;
    definition = aircraftDefinition(requested);
    type = definition.id;
    previousFocus = d.activeElement;
    snapshot = type === Number(getType()) ? getSnapshot() : {};
    onOpen();
    disposed = false;
    contextLost = false;
    dirty = true;
    last = 0;
    dialog.showModal();
    $("inspector-title").textContent =
      definition.name + " · " + definition.nickname;
    $("inspector-status").textContent = "기체를 준비하는 중…";
    $("inspector-status").hidden = false;
    try {
      renderer ??= new T.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: false,
      });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      scene = new T.Scene();
      scene.background = new T.Color(0x1a2329);
      camera = new T.PerspectiveCamera(
        38,
        1,
        0.025,
        Math.max(1500, definition.span * 30),
      );
      scene.add(new T.HemisphereLight(0xd9edf5, 0x34414a, 2));
      for (const [color, power, p] of [
        [0xf3f1e5, 3.2, [-12, 18, -12]],
        [0xb9dbef, 2, [12, 6, 15]],
        [0xd0e1ea, 1.2, [0, -12, -5]],
      ]) {
        const light = new T.DirectionalLight(color, power);
        light.position.set(...p);
        scene.add(light);
      }
      model = createAircraft(type);
      scene.add(model.group);
      model.update({ ...snapshot, gear: 1, afterburner: 0 });
      model.group.updateMatrixWorld(true);
      box.makeEmpty();
      model.group.traverse((o) => {
        let visible = true;
        for (let p = o; p; p = p.parent) if (!p.visible) visible = false;
        if (
          !visible ||
          !o.isMesh ||
          o.userData.visualEffect ||
          o.material.isShaderMaterial
        )
          return;
        o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      });
      ground = box.min.y - 0.02;
      floor = new T.Mesh(
        new T.PlaneGeometry(
          Math.max(definition.span, definition.length) * 6,
          Math.max(definition.span, definition.length) * 6,
        ),
        new T.MeshStandardMaterial({ color: 0x222e33, roughness: 0.95 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = ground;
      scene.add(floor);
      $("inspector-gear").checked = true;
      $("inspector-gear").disabled = !!definition.fixedGear;
      $("inspector-canopy").checked = false;
      $("inspector-fod").checked = true;
      $("inspector-bay").checked = false;
      $("inspector-fold").checked = false;
      $("inspector-sweep").value = "20";
      $("inspector-sweep-value").textContent = "20°";
      $("inspector-bay-row").hidden = !(
        definition.internalWeapons || definition.bomber
      );
      $("inspector-fold-row").hidden = !definition.superHornet;
      $("inspector-sweep-row").hidden = type !== 4;
      $("inspector-gear").closest("label").querySelector("span").textContent =
        definition.fixedGear ? "착륙장치 (고정)" : "착륙장치";
      $("inspector-aperture").value = "30";
      const vectorLimit = type === 13 ? 15 : 20;
      $("inspector-vector").min = String(-vectorLimit);
      $("inspector-vector").max = String(vectorLimit);
      $("inspector-vector").value = "0";
      $("inspector-aperture-value").textContent = "30%";
      $("inspector-vector-value").textContent = "0°";
      $("inspector-canopy-row").hidden = ![13, 14, 15].includes(type);
      $("inspector-fod-row").hidden = type !== 14;
      $("inspector-aperture-row").hidden = !!(
        definition.bomber || definition.propeller || definition.noAfterburner
      );
      $("inspector-vector-row").hidden = !definition.tvc;
      resize();
      setView("overview");
      observer = new ResizeObserver(() => {
        if (disposed) return;
        resize();
      });
      observer.observe(stage);
      render(performance.now());
      $("inspector-status").hidden = true;
      canvas.focus({ preventScroll: true });
      dialog.dataset.ready = "true";
    } catch (error) {
      console.error(error);
      $("inspector-status").textContent =
        "3D 보기를 준비하지 못했습니다. 닫은 뒤 다시 열어 주세요.";
    }
  }
  for (const b of dialog.querySelectorAll("[data-inspector-view]"))
    b.onclick = () => setView(b.dataset.inspectorView);
  $("inspector-close").onclick = close;
  $("inspector-save").onclick = () => {
    if (!renderer || !scene) return;
    draw(performance.now());
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob),
        link = d.createElement("a");
      link.href = url;
      link.download =
        definition.name.replace(/[^a-zA-Z0-9-]/g, "-") + "-" + view + ".png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, "image/png");
  };
  $("inspector-reset").onclick = () => setView("overview");
  $("inspector-zoom-in").onclick = () =>
    (radius = clamp(radius * 0.82, 0.55, 500));
  $("inspector-zoom-out").onclick = () =>
    (radius = clamp(radius / 0.82, 0.55, 500));
  for (const id of ["aperture", "vector", "sweep"])
    $("inspector-" + id).oninput = () =>
      ($("inspector-" + id + "-value").textContent =
        $("inspector-" + id).value + (id === "aperture" ? "%" : "°"));
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  dialog.addEventListener("input", () => (dirty = true));
  dialog.addEventListener("click", () => (dirty = true));
  dialog.addEventListener("keydown", (e) => {
    dirty = true;
    e.stopPropagation();
    if (e.target !== canvas) return;
    const key = e.key;
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "=",
        "-",
        "Home",
      ].includes(key)
    ) {
      e.preventDefault();
      if (key === "Home") setView("overview");
      if (key === "ArrowLeft") azimuth += 0.1;
      if (key === "ArrowRight") azimuth -= 0.1;
      if (key === "ArrowUp") elevation = clamp(elevation + 0.1, -1.55, 1.55);
      if (key === "ArrowDown") elevation = clamp(elevation - 0.1, -1.55, 1.55);
      if (key === "+" || key === "=") radius = clamp(radius * 0.85, 0.55, 500);
      if (key === "-") radius = clamp(radius / 0.85, 0.55, 500);
    }
  });
  dialog.addEventListener("keyup", (e) => e.stopPropagation());
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && ![0, 2].includes(e.button)) return;
    e.preventDefault();
    canvas.focus();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      pan: e.shiftKey || e.button === 2,
    });
  });
  function movePan(dx, dy) {
    const right = V(1, 0, 0).applyQuaternion(camera.quaternion),
      up = V(0, 1, 0).applyQuaternion(camera.quaternion);
    pan
      .addScaledVector(right, -dx * radius * 0.0018)
      .addScaledVector(up, dy * radius * 0.0018);
    pan.clampLength(0, Math.max(definition.span, definition.length));
  }
  canvas.addEventListener("pointermove", (e) => {
    const old = pointers.get(e.pointerId);
    if (!old || disposed) return;
    dirty = true;
    e.preventDefault();
    const before = [...pointers.values()];
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: old.pan });
    const after = [...pointers.values()];
    if (after.length === 2) {
      const length = (a) => Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      radius = clamp(
        (radius * length(before)) / Math.max(1, length(after)),
        0.55,
        500,
      );
      movePan(
        (after[0].x + after[1].x - before[0].x - before[1].x) / 2,
        (after[0].y + after[1].y - before[0].y - before[1].y) / 2,
      );
    } else if (old.pan || e.shiftKey) {
      const right = V(1, 0, 0).applyQuaternion(camera.quaternion),
        up = V(0, 1, 0).applyQuaternion(camera.quaternion);
      pan
        .addScaledVector(right, -(e.clientX - old.x) * radius * 0.0018)
        .addScaledVector(up, (e.clientY - old.y) * radius * 0.0018);
      pan.clampLength(0, Math.max(definition.span, definition.length));
    } else {
      azimuth -= (e.clientX - old.x) * 0.006;
      elevation = clamp(elevation + (e.clientY - old.y) * 0.006, -1.55, 1.55);
    }
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(event, (e) => pointers.delete(e.pointerId));
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      dirty = true;
      radius = clamp(radius * Math.exp(e.deltaY * 0.001), 0.55, 500);
    },
    { passive: false },
  );
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    contextLost = true;
    $("inspector-status").hidden = false;
    $("inspector-status").textContent =
      "그래픽 연결이 중단됐습니다. 닫은 뒤 다시 열어 주세요.";
  });
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    dirty = true;
    if (!disposed) $("inspector-status").hidden = true;
  });
  d.defaultView.addEventListener("pagehide", (e) => {
    if (e.persisted) return;
    close();
    renderer?.dispose();
  });
  return {
    open,
    close,
    get active() {
      return !disposed;
    },
    get state() {
      return {
        type,
        view,
        radius,
        elevation,
        target: target.toArray(),
        pan: pan.toArray(),
      };
    },
  };
}
