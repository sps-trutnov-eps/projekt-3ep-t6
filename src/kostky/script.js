/*
  script.js
  ---------
  Entry point — WebGL setup, render loop, and game UI orchestration.
  Handles both human and AI turns with visual dice rolling.
*/
import { initBuffers, initTableBuffers, initFrameBuffers } from "./init-buffers.js";
import { drawScene } from "./draw.js";
import { loop, rollAllDice, rollDice, getDiceValues, allSettled, NUM_DICE } from "./physics.js";
import * as game from "./game.js";

// --- WebGL init ---
const cnv = document.getElementById("cnv");
const gl = cnv.getContext("webgl");

// Pixelation: render at a fraction of container size, CSS stretches it up
const PIXEL_SCALE = 3; // 1/3 resolution for chunky pixel look
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
const frameWalls = initFrameBuffers(gl);
const texture = loadTexture(gl, "cubetexture.png");
const tableTexture = loadTexture(gl, "WoodTexture.jpg");
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

// --- UI elements ---
const elPlayerScore = document.getElementById("player-score");
const elAiScore = document.getElementById("ai-score");
const elTurnScore = document.getElementById("turn-score");
const elTurnIndicator = document.getElementById("turn-indicator");
const elStatus = document.getElementById("status-msg");
const elSelectionScore = document.getElementById("selection-score");
const btnRoll = document.getElementById("btn-roll");
const btnConfirm = document.getElementById("btn-confirm");
const btnBank = document.getElementById("btn-bank");
const dieBtns = document.querySelectorAll(".die-btn");
const btnRules = document.getElementById("btn-rules");
const rulesModal = document.getElementById("rules-modal");
const rulesClose = document.getElementById("rules-close");

btnRules.addEventListener('click', () => rulesModal.classList.add('open'));
rulesClose.addEventListener('click', () => rulesModal.classList.remove('open'));
rulesModal.addEventListener('click', (e) => {
  if (e.target === rulesModal) rulesModal.classList.remove('open');
});

// --- Game UI state ---
let settleHandled = true;

function updateUI() {
  const s = game.getState();
  elPlayerScore.textContent = s.playerScore;
  elAiScore.textContent = s.aiScore;
  elTurnScore.textContent = s.turnScore;

  // Turn indicator
  const isHuman = s.currentPlayer === 'human';
  elTurnIndicator.textContent = isHuman ? 'Your turn' : 'AI turn';
  elTurnIndicator.className = isHuman ? 'human' : 'ai';

  // Die buttons
  for (let i = 0; i < NUM_DICE; i++) {
    const btn = dieBtns[i];
    btn.textContent = s.diceValues[i] || '-';
    btn.classList.toggle('selected', s.selected[i]);
    btn.classList.toggle('kept', s.kept[i]);
    btn.disabled = s.phase !== 'SELECTING' || s.kept[i];
  }

  // Action buttons — only during human turns
  const humanSelecting = s.phase === 'SELECTING';
  btnRoll.disabled = !(s.phase === 'READY');
  btnConfirm.disabled = !humanSelecting;
  btnBank.disabled = !humanSelecting || s.turnScore === 0;

  if (humanSelecting) {
    btnRoll.disabled = true; // enabled after confirm
  }

  // Selection score preview
  const sel = game.getSelectedScore();
  if (humanSelecting && sel.score > 0) {
    elSelectionScore.textContent = `+${sel.score}`;
  } else {
    elSelectionScore.textContent = '';
  }
}

function setStatus(text, cls) {
  elStatus.textContent = text;
  elStatus.className = cls || '';
}

function disableAllButtons() {
  btnRoll.disabled = true;
  btnConfirm.disabled = true;
  btnBank.disabled = true;
  for (const btn of dieBtns) btn.disabled = true;
}

function postConfirmUI() {
  const s = game.getState();
  btnRoll.disabled = false;
  btnBank.disabled = false;
  btnConfirm.disabled = true;
  for (const btn of dieBtns) btn.disabled = true;

  const remaining = s.kept.filter(k => !k).length;
  if (remaining === 0) {
    setStatus('Hot Dice! All 6 scored — roll again!');
  } else {
    setStatus(`${s.turnScore} pts this turn. Roll ${remaining} dice or Bank?`);
  }
}

// --- Helper: trigger a roll (human or AI) ---
function triggerRoll() {
  const s = game.getState();
  const side = s.currentPlayer === 'ai' ? 'far' : 'near';
  const indices = game.startRoll();
  if (indices.length === 0 || indices.length === 6) {
    rollAllDice(side);
  } else {
    rollDice(indices, side);
  }
  settleHandled = false;
  disableAllButtons();
  updateUI();
}

// --- Human event handlers ---

btnRoll.addEventListener('click', () => {
  const s = game.getState();
  if (s.phase === 'WIN' || s.phase === 'LOSE') {
    game.newGame();
    updateUI();
    setStatus('Press Roll to start!');
    btnRoll.textContent = 'Roll';
    btnRoll.disabled = false;
    return;
  }
  setStatus('Rolling...');
  triggerRoll();
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
    setStatus(`You win with ${s.playerScore} points!`, 'win');
    btnRoll.textContent = 'New Game';
    btnRoll.disabled = false;
  } else if (s.phase === 'AI_READY') {
    // AI's turn starts
    setStatus('You banked. AI\'s turn...');
    setTimeout(() => startAiTurn(), 1000);
  }
});

dieBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.dataset.index);
    game.toggleSelect(idx);
    updateUI();
  });
});

// --- AI turn logic (visual, with delays) ---

function startAiTurn() {
  setStatus('AI is rolling...');
  triggerRoll();
  // settle detection in render loop will call handleAiSettle
}

function handleAiSettle() {
  const s = game.getState();

  if (s.phase === 'AI_FARKLE') {
    setStatus('AI Farkle! AI loses turn points.', 'farkle');
    updateUI();
    setTimeout(() => {
      game.resetTurn();
      updateUI();
      setStatus('AI farkled! Your turn — press Roll.');
      btnRoll.disabled = false;
    }, 1500);
    return;
  }

  // AI_SELECTING — pick scoring dice with a delay
  const toKeep = game.aiPickScoringDice(s.diceValues, s.kept);
  if (toKeep.length === 0) return; // shouldn't happen if not farkle

  // Visually select dice one by one
  let idx = 0;
  const selectInterval = setInterval(() => {
    if (idx >= toKeep.length) {
      clearInterval(selectInterval);
      // Confirm after a brief pause
      setTimeout(() => aiConfirmAndDecide(), 600);
      return;
    }
    game.toggleSelect(toKeep[idx]);
    updateUI();
    // Show the dice values on buttons during AI turn
    for (let i = 0; i < NUM_DICE; i++) {
      dieBtns[i].textContent = s.diceValues[i] || '-';
    }
    idx++;
  }, 300);
}

function aiConfirmAndDecide() {
  const result = game.confirmKeep();
  if (!result) return;
  updateUI();

  const s = game.getState();
  const shouldBank = game.aiShouldBank();

  if (shouldBank) {
    setStatus(`AI banks ${s.turnScore} points!`);
    setTimeout(() => {
      const afterBank = game.bank();
      updateUI();
      if (afterBank.phase === 'LOSE') {
        setStatus(`AI wins with ${afterBank.aiScore} points!`, 'lose');
        btnRoll.textContent = 'New Game';
        btnRoll.disabled = false;
      } else {
        setStatus(`AI banked. Your turn — press Roll.`);
        btnRoll.disabled = false;
      }
    }, 1000);
  } else {
    // Roll again
    const remaining = s.kept.filter(k => !k).length;
    setStatus(`AI pushes (${s.turnScore} pts). Rolling ${remaining || 6} dice...`);
    setTimeout(() => {
      triggerRoll();
    }, 1000);
  }
}

// --- Render loop ---
let then = 0;

function render(now) {
  now *= 0.001;
  deltaTime = now - then;
  then = now;

  resizeCanvas();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const diceState = loop(deltaTime);

  for (let i = 0; i < diceState.length; i++) {
    const d = diceState[i];
    drawScene(gl, programInfo, buffers, texture, d.quat, d.pos);
  }

  // Draw table
  drawScene(gl, programInfo, tableBuffers, tableTexture, [0, 0, 0], [0, -4, -8]);

  // Draw frame walls (positioned at table surface Y=-4)
  for (const wall of Object.values(frameWalls)) {
    drawScene(gl, programInfo, wall.buffers, tableTexture, [0, 0, 0],
      [wall.pos[0], -4 + wall.pos[1], wall.pos[2]]);
  }

  // Settle detection — handles both human and AI
  if (!settleHandled && allSettled()) {
    settleHandled = true;
    const values = getDiceValues();
    const s = game.onDiceSettled(values);
    updateUI();

    if (s.currentPlayer === 'ai') {
      // AI turn settle
      handleAiSettle();
    } else {
      // Human turn settle
      if (s.phase === 'FARKLE') {
        setStatus('Farkle! No scoring dice.', 'farkle');
        setTimeout(() => {
          const afterReset = game.resetTurn();
          updateUI();
          if (afterReset.phase === 'AI_READY') {
            setStatus('You farkled! AI\'s turn...');
            setTimeout(() => startAiTurn(), 1000);
          } else {
            setStatus('Farkle! Turn lost. Press Roll.');
            btnRoll.disabled = false;
          }
        }, 1500);
      } else if (s.phase === 'SELECTING') {
        setStatus('Select scoring dice, then Confirm.');
      }
    }
  }

  requestAnimationFrame(render);
}

game.newGame();
requestAnimationFrame(render);
