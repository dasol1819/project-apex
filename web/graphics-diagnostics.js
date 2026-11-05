// This page tests normal web APIs. It cannot enable a disabled browser GPU.
function probeWebGL(kind, attributes) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const messages = [];
  canvas.addEventListener('webglcontextcreationerror', e => messages.push(e.statusMessage));
  let gl;
  try {
    gl = canvas.getContext(kind, attributes);
    if (!gl) return { available: false, attributes, messages };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const result = {
      available: true,
      attributes: gl.getContextAttributes(),
      version: gl.getParameter(gl.VERSION),
      renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      messages,
    };
    const v2 = kind === 'webgl2';
    const vertex = v2
      ? '#version 300 es\nin vec2 position;void main(){gl_Position=vec4(position,0.,1.);}'
      : 'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';
    const fragment = v2
      ? '#version 300 es\nprecision mediump float;out vec4 pixel;void main(){pixel=vec4(0.25,0.5,0.75,1.);}'
      : 'precision mediump float;void main(){gl_FragColor=vec4(0.25,0.5,0.75,1.);}';
    const shaders = [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]].map(([type, source]) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    });
    const program = gl.createProgram();
    shaders.forEach(shader => gl.attachShader(program, shader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, 16, 16);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixel = new Uint8Array(4);
    gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    result.pixel = Array.from(pixel);
    result.drawPassed = [64,128,191,255].every((value, i) => Math.abs(value - pixel[i]) <= 1);
    result.glError = gl.getError();
    result.drawPassed &&= result.glError === gl.NO_ERROR;
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
    return result;
  } catch (error) {
    return { available: !!gl, drawPassed: false, error: error.message, attributes, messages };
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

async function fetchCheck(path, wasm = false) {
  try {
    const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (!response.ok) return { ok: false, status: response.status, url: response.url };
    const bytes = await response.arrayBuffer();
    return { ok: !wasm || WebAssembly.validate(bytes), status: response.status, bytes: bytes.byteLength,
      ...(wasm ? { wasmValid: WebAssembly.validate(bytes) } : {}) };
  } catch (error) { return { ok: false, error: error.message }; }
}

async function run() {
  const status = document.querySelector('#diagnostic-status');
  const output = document.querySelector('#diagnostic-report');
  const retry = document.querySelector('#retry');
  retry.disabled = true;
  document.documentElement.removeAttribute('data-diagnostic-ready');
  status.textContent = '검사 중…';
  status.className = '';
  const report = {
    checkedAt: new Date().toISOString(),
    url: location.origin + location.pathname,
    secureContext: isSecureContext,
    userAgent: navigator.userAgent,
    webgl2: probeWebGL('webgl2', { antialias: true, powerPreference: 'high-performance' }),
    webgl2Default: probeWebGL('webgl2', { antialias: false, powerPreference: 'default' }),
    webgl1: probeWebGL('webgl', { antialias: false }),
  };
  output.textContent = JSON.stringify(report, null, 2);
  const [flight, entryModule, model] = await Promise.all([
    fetchCheck('./flight.wasm', true), fetchCheck('./app.js'), fetchCheck('./mig15bis-model.js'),
  ]);
  report.files = { flight, entryModule, model };
  report.result = report.webgl2.drawPassed && Object.values(report.files).every(file => file.ok) ? 'PASS' : 'FAIL';
  report.reason = !report.webgl2.available
    ? '이 브라우저에서 WebGL 2 컨텍스트를 생성하지 못했습니다. 하드웨어 가속 또는 검수 브라우저의 그래픽 실행 설정을 확인해야 합니다.'
    : !report.webgl2.drawPassed ? 'WebGL 2 셰이더 또는 픽셀 그리기 검사가 실패했습니다.'
    : report.result === 'FAIL' ? '게임 파일 요청 또는 비행 모듈 검증이 실패했습니다.'
    : 'WebGL 2 셰이더·픽셀 그리기와 게임 파일 검사를 통과했습니다. 게임 실행 검사는 별도로 수행합니다.';
  status.textContent = report.result + ' · ' + report.reason;
  status.className = report.result === 'PASS' ? 'pass' : 'fail';
  output.textContent = JSON.stringify(report, null, 2);
  document.documentElement.setAttribute('data-diagnostic-ready', 'true');
  retry.disabled = false;
}
document.querySelector('#retry').addEventListener('click', run);
run();
