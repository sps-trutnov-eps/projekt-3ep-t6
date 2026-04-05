/*
  script.js
  ---------
  Entry point — WebGL setup, render loop, and game UI orchestration.
*/
import { initBuffers, initTableBuffers } from "./init-buffers.js";
import { drawScene } from "./draw.js";
import { loop, rollAllDice, rollDice, getDiceValues, allSettled, NUM_DICE } from "./physics.js";
import * as game from "./game.js";

// --- WebGL init ---
const cnv = document.getElementById("cnv");
const gl = cnv.getContext("webgl");

let deltaTime = 0;

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

      highp vec3 ambientLight = vec3(0.3, 0.3, 0.3);
      highp vec3 directionalLightColor = vec3(1, 1, 1);
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

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
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
  const pixel = new Uint8Array([0, 0, 255, 255]);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
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

function isPowerOf2(value) { return (value & (value - 1)) === 0; }

const buffers = initBuffers(gl);
const tableBuffers = initTableBuffers(gl);
const texture = loadTexture(gl, "cubetexture.png");
const tableTexture = loadTexture(gl, "WoodTexture.jpg");
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

// --- UI elements ---
const elTotalScore = document.getElementById("total-score");
const elTurnScore = document.getElementById("turn-score");
const elStatus = document.getElementById("status-msg");
const elSelectionScore = document.getElementById("selection-score");
const btnRoll = document.getElementById("btn-roll");
const btnConfirm = document.getElementById("btn-confirm");
const btnBank = document.getElementById("btn-bank");
const dieBtns = document.querySelectorAll(".die-btn");

// --- Game UI state ---
let settleHandled = true; // true = not waiting for settle

function updateUI() {
  const s = game.getState();
  elTotalScore.textContent = s.totalScore;
  elTurnScore.textContent = s.turnScore;

  // Die buttons
  for (let i = 0; i < NUM_DICE; i++) {
    const btn = dieBtns[i];
    btn.textContent = s.diceValues[i] || '-';
    btn.classList.toggle('selected', s.selected[i]);
    btn.classList.toggle('kept', s.kept[i]);
    btn.disabled = s.phase !== 'SELECTING' || s.kept[i];
  }

  // Action buttons
  btnRoll.disabled = s.phase !== 'READY' && s.phase !== 'SELECTING';
  btnConfirm.disabled = s.phase !== 'SELECTING';
  btnBank.disabled = s.phase !== 'SELECTING' || s.turnScore === 0;

  // In SELECTING phase, only enable Roll if player has confirmed at least some dice this sub-turn
  // (i.e., there are kept dice or turnScore > 0 from a previous confirm)
  if (s.phase === 'SELECTING') {
    // Roll = re-roll remaining. Only allowed after confirming a selection
    btnRoll.disabled = true; // will be re-enabled after confirm
  }

  // Selection score preview
  const sel = game.getSelectedScore();
  if (s.phase === 'SELECTING' && sel.score > 0) {
    elSelectionScore.textContent = `+${sel.score} points`;
  } else {
    elSelectionScore.textContent = '';
  }
}

function setStatus(text, cls) {
  elStatus.textContent = text;
  elStatus.className = cls || '';
}

// --- After confirm, enable roll/bank ---
function postConfirmUI() {
  const s = game.getState();
  btnRoll.disabled = false;
  btnBank.disabled = false;
  btnConfirm.disabled = true;

  // Disable die buttons (already confirmed)
  for (let i = 0; i < NUM_DICE; i++) {
    dieBtns[i].disabled = true;
  }

  const remaining = s.kept.filter(k => !k).length;
  if (remaining === 0) {
    setStatus('Hot Dice! All 6 scored — roll again!');
  } else {
    setStatus(`${s.turnScore} points this turn. Roll ${remaining} dice or Bank?`);
  }
}

// --- Event handlers ---

btnRoll.addEventListener('click', () => {
  const s = game.getState();

  if (s.phase === 'READY' || s.phase === 'WIN') {
    if (s.phase === 'WIN') game.newGame();
    const indices = game.startRoll();
    rollAllDice();
    settleHandled = false;
    setStatus('Rolling...');
    updateUI();
    // Disable everything during roll
    btnRoll.disabled = true;
    btnConfirm.disabled = true;
    btnBank.disabled = true;
    return;
  }

  // Re-roll after confirming selection
  const indices = game.startRoll();
  if (indices.length === 0) {
    // Hot Dice — all kept, roll all 6
    rollAllDice();
  } else {
    rollDice(indices);
  }
  settleHandled = false;
  setStatus('Rolling...');
  updateUI();
  btnRoll.disabled = true;
  btnConfirm.disabled = true;
  btnBank.disabled = true;
});

btnConfirm.addEventListener('click', () => {
  const result = game.confirmKeep();
  if (!result) {
    setStatus('Those dice don\'t score! Pick scoring dice.');
    return;
  }
  updateUI();
  postConfirmUI();
});

btnBank.addEventListener('click', () => {
  const s = game.bank();
  updateUI();
  if (s.phase === 'WIN') {
    setStatus(`You win with ${s.totalScore} points!`, 'win');
    btnRoll.textContent = 'New Game';
    btnRoll.disabled = false;
    btnBank.disabled = true;
  } else {
    setStatus(`Banked! Total: ${s.totalScore}. Press Roll.`);
    btnRoll.textContent = 'Roll';
  }
});

// Die toggle buttons
dieBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.dataset.index);
    game.toggleSelect(idx);
    updateUI();
  });
});

// --- Render loop ---
let then = 0;

function render(now) {
  now *= 0.001;
  deltaTime = now - then;
  then = now;

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const diceState = loop(deltaTime);

  // Draw dice
  for (let i = 0; i < diceState.length; i++) {
    const d = diceState[i];
    drawScene(gl, programInfo, buffers, texture, d.quat, d.pos);
  }

  // Draw table
  drawScene(gl, programInfo, tableBuffers, tableTexture, [0, 0, 0], [0, -4, -8]);

  // Check settle
  if (!settleHandled && allSettled()) {
    settleHandled = true;
    const values = getDiceValues();
    const s = game.onDiceSettled(values);
    updateUI();

    if (s.phase === 'FARKLE') {
      setStatus('Farkle! No scoring dice.', 'farkle');
      setTimeout(() => {
        game.resetTurn();
        updateUI();
        setStatus('Farkle! Turn lost. Press Roll.');
        btnRoll.disabled = false;
      }, 1500);
    } else if (s.phase === 'SELECTING') {
      setStatus('Select scoring dice, then Confirm.');
    }
  }

  requestAnimationFrame(render);
}

// Init game state
game.newGame();
requestAnimationFrame(render);
