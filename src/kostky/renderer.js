/*
  renderer.js
  -----------
  Pure 3D renderer for the dice scene. No game logic, no UI binding.
  Exposes window.diceRenderer for use by the existing singleplayer.js.
*/
import { initBuffers, initTableBuffers, initFrameBuffers } from "/kostky/init-buffers.js";
import { drawScene } from "/kostky/draw.js";
import { loop, rollAllDice, rollDice, getDiceValues, allSettled, NUM_DICE } from "/kostky/physics.js";

const { mat4 } = window;

const cnv = document.getElementById("cnv");
if (!cnv) throw new Error("No #cnv canvas found");
const gl = cnv.getContext("webgl");

const PIXEL_SCALE = 3;
function resizeCanvas() {
  const rect = cnv.parentElement.getBoundingClientRect();
  const w = Math.floor(rect.width / PIXEL_SCALE);
  const h = Math.floor(rect.height / PIXEL_SCALE);
  if (cnv.width !== w || cnv.height !== h) {
    cnv.width = w;
    cnv.height = h;
    gl.viewport(0, 0, w, h);
  }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);

const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;
    attribute vec2 aTextureCoord;
    uniform mat4 uNormalMatrix;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying highp vec2 vTextureCoord;
    varying highp vec3 vLighting;
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;
      highp vec3 ambientLight = vec3(0.35, 0.32, 0.25);
      highp vec3 directionalLightColor = vec3(1.0, 0.92, 0.75);
      highp vec3 directionalVector = normalize(vec3(0.85, 0.8, 0.75));
      highp vec4 transformedNormal = uNormalMatrix * vec4(aVertexNormal, 0.0);
      highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
      vLighting = ambientLight + (directionalLightColor * directional);
    }
  `;

const fsSource = `
    varying highp vec2 vTextureCoord;
    varying highp vec3 vLighting;
    uniform sampler2D uSampler;
    void main(void) {
      highp vec4 texelColor = texture2D(uSampler, vTextureCoord);
      gl_FragColor = vec4(texelColor.rgb * vLighting, texelColor.a);
    }
  `;

function initShaderProgram(gl, vs, fs) {
  const v = loadShader(gl, gl.VERTEX_SHADER, vs);
  const f = loadShader(gl, gl.FRAGMENT_SHADER, fs);
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  return p;
}

function loadShader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  return s;
}

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
const programInfo = {
  program: shaderProgram,
  attribLocations: {
    vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
    vertexNormal: gl.getAttribLocation(shaderProgram, "aVertexNormal"),
    textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord"),
  },
  uniformLocations: {
    projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
    modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
    normalMatrix: gl.getUniformLocation(shaderProgram, "uNormalMatrix"),
    uSampler: gl.getUniformLocation(shaderProgram, "uSampler"),
  },
};

function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    if ((image.width & (image.width - 1)) === 0 && (image.height & (image.height - 1)) === 0) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
  image.src = url;
  return texture;
}

const buffers = initBuffers(gl);
const tableBuffers = initTableBuffers(gl);
const frameWalls = initFrameBuffers(gl);
const texture = loadTexture(gl, "/kostky/cubetexture.png");
const tableTexture = loadTexture(gl, "/kostky/WoodTexture.jpg");
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

// --- 3D → 2D projection for labels ---
function getViewProjectionMatrix() {
  const fov = (45 * Math.PI) / 180;
  const aspect = cnv.clientWidth / cnv.clientHeight;
  const proj = mat4.create();
  mat4.perspective(proj, fov, aspect, 0.1, 100.0);
  const view = mat4.create();
  mat4.lookAt(view, [0, 12, 3], [0, -3, -13], [0, 1, 0]);
  const vp = mat4.create();
  mat4.multiply(vp, proj, view);
  return vp;
}

function projectToScreen(worldPos, vpMatrix) {
  const x = worldPos[0], y = worldPos[1], z = worldPos[2];
  const clipX = vpMatrix[0]*x + vpMatrix[4]*y + vpMatrix[8]*z + vpMatrix[12];
  const clipY = vpMatrix[1]*x + vpMatrix[5]*y + vpMatrix[9]*z + vpMatrix[13];
  const clipW = vpMatrix[3]*x + vpMatrix[7]*y + vpMatrix[11]*z + vpMatrix[15];
  if (clipW <= 0) return null;
  return {
    x: (clipX / clipW + 1) / 2 * cnv.clientWidth,
    y: (1 - clipY / clipW) / 2 * cnv.clientHeight,
  };
}

// --- Label / selection state ---
const diceLabels = document.querySelectorAll(".dice-label");
let shownValues = [];        // values to display on labels (set by host page)
let selectedSet = new Set();  // indices currently selected
let selectable = false;       // whether hovering/clicking selects
let onSelectCallback = null;  // called with (index, selectedSet) on toggle

diceLabels.forEach(label => {
  label.addEventListener('click', () => {
    if (!selectable) return;
    const idx = parseInt(label.dataset.index);
    if (selectedSet.has(idx)) selectedSet.delete(idx);
    else selectedSet.add(idx);
    if (onSelectCallback) onSelectCallback(idx, new Set(selectedSet));
  });
});

function updateLabels() {
  if (!shownValues.length || !lastDiceState.length || !selectable) {
    for (const l of diceLabels) l.classList.remove('visible');
    return;
  }
  const vp = getViewProjectionMatrix();
  for (let i = 0; i < NUM_DICE; i++) {
    const label = diceLabels[i];
    const ds = lastDiceState[i];
    if (!ds || i >= shownValues.length) { label.classList.remove('visible'); continue; }
    const screen = projectToScreen(ds.pos, vp);
    if (!screen) { label.classList.remove('visible'); continue; }
    label.style.left = screen.x + 'px';
    label.style.top = screen.y + 'px';
    label.querySelector('.dice-value').textContent = shownValues[i];
    label.classList.add('visible');
    label.classList.toggle('selected', selectedSet.has(i));
  }
}

// --- Render loop ---
let then = 0;
let lastDiceState = [];
let settleCallback = null;

function render(now) {
  now *= 0.001;
  const dt = now - then;
  then = now;

  resizeCanvas();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const diceState = loop(dt);
  lastDiceState = diceState;

  for (let i = 0; i < diceState.length; i++) {
    drawScene(gl, programInfo, buffers, texture, diceState[i].quat, diceState[i].pos);
  }

  drawScene(gl, programInfo, tableBuffers, tableTexture, [0, 0, 0], [0, -4, 0]);

  for (const wall of Object.values(frameWalls)) {
    drawScene(gl, programInfo, wall.buffers, tableTexture, [0, 0, 0],
      [wall.pos[0], -4 + wall.pos[1], wall.pos[2]]);
  }

  updateLabels();

  // Settle detection
  if (settleCallback && allSettled()) {
    const cb = settleCallback;
    settleCallback = null;
    cb(getDiceValues());
  }

  requestAnimationFrame(render);
}

requestAnimationFrame(render);

// --- Public API on window ---
window.diceRenderer = {
  roll(count) {
    selectable = false;
    selectedSet.clear();
    shownValues = [];
    for (const l of diceLabels) l.classList.remove('visible');
    const indices = [];
    for (let i = 0; i < (count || 6); i++) indices.push(i);
    if (indices.length === 6) rollAllDice('near');
    else rollDice(indices, 'near');
  },
  onSettle(cb) {
    settleCallback = cb;
  },
  // Show values on labels and enable hover/click selection
  showValues(values) {
    shownValues = values;
    selectable = true;
    selectedSet.clear();
  },
  // Hide labels and disable selection
  hideLabels() {
    selectable = false;
    shownValues = [];
    selectedSet.clear();
    for (const l of diceLabels) l.classList.remove('visible');
  },
  // Get currently selected indices
  getSelected() {
    return [...selectedSet];
  },
  // Set callback for selection changes: cb(clickedIndex, allSelectedIndices)
  onSelect(cb) {
    onSelectCallback = cb;
  },
  isSettled() {
    return allSettled();
  },
  getValues() {
    return getDiceValues();
  },
};
