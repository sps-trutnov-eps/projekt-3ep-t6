// physics.js
// ----------
// Dice rigid-body physics powered by cannon-es.
// Sets up a CANNON.World with gravity, floor, walls, and dice bodies.
// Exports a loop(dt) function that steps the simulation and returns
// dice state (position + quaternion) for rendering.

import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

// --- Constants ---
const NUM_DICE = 6;
const HALF_SIZE = 0.7;
const FLOOR_Y = -4.0;
const MASS = 1.0;

const TABLE_X_MIN = -5;
const TABLE_X_MAX = 5;
const TABLE_Z_MIN = -23;
const TABLE_Z_MAX = -3;
const CEILING_Y = 6;

// Thresholds for settling dice to nearest face
const SETTLE_VEL = 0.15;
const SETTLE_ANG_VEL = 0.3;

// Axis index → dice face number
const AXIS_TO_FACE = [6, 5, 2, 4, 1, 3];

// Reverse: face number → axis index  (FACE_TO_AXIS[face] = axisIdx)
const FACE_TO_AXIS = [];
for (let i = 0; i < AXIS_TO_FACE.length; i++) FACE_TO_AXIS[AXIS_TO_FACE[i]] = i;

// --- World setup ---
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.81, 0),
});
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.solver.iterations = 15;

const diceMaterial = new CANNON.Material('dice');
const wallMaterial = new CANNON.Material('wall');

world.addContactMaterial(new CANNON.ContactMaterial(diceMaterial, wallMaterial, {
  friction: 0.4,
  restitution: 0.35,
}));
world.addContactMaterial(new CANNON.ContactMaterial(diceMaterial, diceMaterial, {
  friction: 0.3,
  restitution: 0.4,
}));

// --- Create walls ---

// Floor
const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: wallMaterial });
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
floorBody.position.set(0, FLOOR_Y, 0);
world.addBody(floorBody);

// Ceiling
const ceilingBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: wallMaterial });
ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
ceilingBody.position.set(0, CEILING_Y, 0);
world.addBody(ceilingBody);

// Left wall
const leftWall = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: wallMaterial });
leftWall.quaternion.setFromEuler(0, Math.PI / 2, 0);
leftWall.position.set(TABLE_X_MIN, 0, 0);
world.addBody(leftWall);

// Right wall
const rightWall = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: wallMaterial });
rightWall.quaternion.setFromEuler(0, -Math.PI / 2, 0);
rightWall.position.set(TABLE_X_MAX, 0, 0);
world.addBody(rightWall);

// Back wall
const backWall = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: wallMaterial });
backWall.position.set(0, 0, TABLE_Z_MIN);
world.addBody(backWall);

// Front wall
const frontWall = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: wallMaterial });
frontWall.quaternion.setFromEuler(0, Math.PI, 0);
frontWall.position.set(0, 0, TABLE_Z_MAX);
world.addBody(frontWall);

// Middle divider wall at Z=-13.1 — thin Box, not two planes (avoids trapping dice)
const MIDDLE_Z = -13.1;
const middleWall = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Box(new CANNON.Vec3(5, 4, 0.25)),
  material: wallMaterial,
});
middleWall.position.set(0, 0, MIDDLE_Z);
world.addBody(middleWall);

// --- Snap-to-face helpers ---
const LOCAL_AXES = [
  new CANNON.Vec3(1, 0, 0),
  new CANNON.Vec3(-1, 0, 0),
  new CANNON.Vec3(0, 1, 0),
  new CANNON.Vec3(0, -1, 0),
  new CANNON.Vec3(0, 0, 1),
  new CANNON.Vec3(0, 0, -1),
];
const WORLD_UP = new CANNON.Vec3(0, 1, 0);

function nearestFaceQuat(q) {
  let bestDot = -2;
  let bestLocal = LOCAL_AXES[0];
  for (const axis of LOCAL_AXES) {
    const worldAxis = q.vmult(axis);
    const d = worldAxis.dot(WORLD_UP);
    if (d > bestDot) {
      bestDot = d;
      bestLocal = axis;
    }
  }

  const current = q.vmult(bestLocal);
  const cross = new CANNON.Vec3();
  current.cross(WORLD_UP, cross);
  const crossLen = cross.length();

  if (crossLen < 1e-6) return q.clone();

  const dot = current.dot(WORLD_UP);
  const angle = Math.atan2(crossLen, dot);
  cross.scale(1 / crossLen, cross);

  const correction = new CANNON.Quaternion();
  correction.setFromAxisAngle(cross, angle);
  const result = correction.mult(q);
  result.normalize();
  return result;
}

// --- Target values for server-authoritative rolls ---
let targetValues = null;  // null = free physics, array = snap to these faces

function targetFaceQuat(q, faceNumber) {
  const axisIdx = FACE_TO_AXIS[faceNumber];
  if (axisIdx === undefined) return nearestFaceQuat(q);
  const targetLocal = LOCAL_AXES[axisIdx];

  const current = q.vmult(targetLocal);
  const cross = new CANNON.Vec3();
  current.cross(WORLD_UP, cross);
  const crossLen = cross.length();

  if (crossLen < 1e-6) return q.clone();

  const dot = current.dot(WORLD_UP);
  const angle = Math.atan2(crossLen, dot);
  cross.scale(1 / crossLen, cross);

  const correction = new CANNON.Quaternion();
  correction.setFromAxisAngle(cross, angle);
  const result = correction.mult(q);
  result.normalize();
  return result;
}

// --- Dice state ---
let dice = [];
let bodiesCreated = false;

const diceShape = new CANNON.Box(new CANNON.Vec3(HALF_SIZE, HALF_SIZE, HALF_SIZE));

function createBodies() {
  for (let i = 0; i < NUM_DICE; i++) {
    const body = new CANNON.Body({
      mass: MASS,
      shape: diceShape,
      material: diceMaterial,
      linearDamping: 0.1,
      angularDamping: 0.2,
      sleepSpeedLimit: 0.1,
      sleepTimeLimit: 1.0,
    });
    // Start off-screen behind camera until first roll
    body.type = CANNON.Body.STATIC;
    body.position.set(0, FLOOR_Y + HALF_SIZE, 10);
    world.addBody(body);
    dice.push({ body, settled: true });
  }
  bodiesCreated = true;
}

// --- Public API ---

// side: 'near' = player's half (closer to camera), 'far' = AI's half (far end)
function rollAllDice(side) {
  if (!bodiesCreated) createBodies();
  const indices = [];
  for (let i = 0; i < NUM_DICE; i++) indices.push(i);
  for (const d of dice) {
    d.body.type = CANNON.Body.DYNAMIC;
    d.body.mass = MASS;
    d.body.updateMassProperties();
  }
  rollDice(indices, side);
}

let prng = Math.random;

function setSeed(seed) {
  let s = seed;
  prng = function() {
    s |= 0;
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function rollDice(indices, side) {
  if (!bodiesCreated) createBodies();
  side = side || 'near';

  // Near frame (Z -3.5 to -13.1) = human, Far frame (Z -13.1 to -22.7) = AI
  const zCenter = side === 'far' ? -17.9 : -8.3;


  // Launch the dice being rolled
  const count = indices.length;
  for (let j = 0; j < count; j++) {
    const i = indices[j];
    const d = dice[i];
    const b = d.body;

    b.type = CANNON.Body.DYNAMIC;
    b.mass = MASS;
    b.updateMassProperties();
    b.wakeUp();
    d.settled = false;

    // Spawn spread out along X within the frame
    const spread = count > 1 ? (j / (count - 1)) * 5 - 2.5 : 0;
    b.position.set(
      spread + (prng() - 0.5) * 0.5,
      2 + j * 1.5 + prng() * 0.5,
      zCenter + (prng() - 0.5) * 1.5,
    );

    b.velocity.set(
      (prng() - 0.5) * 4,
      -3 - prng() * 2,
      (prng() - 0.5) * 3,
    );

    b.quaternion.setFromEuler(
      prng() * Math.PI * 2,
      prng() * Math.PI * 2,
      prng() * Math.PI * 2,
    );

    b.angularVelocity.set(
      (prng() - 0.5) * 15,
      (prng() - 0.5) * 15,
      (prng() - 0.5) * 15,
    );
  }
}

function getUpAxisIndex(q) {
  let bestDot = -2;
  let bestIdx = 0;
  for (let i = 0; i < LOCAL_AXES.length; i++) {
    const worldAxis = q.vmult(LOCAL_AXES[i]);
    const d = worldAxis.dot(WORLD_UP);
    if (d > bestDot) {
      bestDot = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function getDiceValues() {
  return dice.map(d => AXIS_TO_FACE[getUpAxisIndex(d.body.quaternion)]);
}

function allSettled() {
  if (!bodiesCreated) return false;
  return dice.every(d => d.settled);
}

function loop(dt) {
  if (!bodiesCreated) createBodies();
  if (dt > 0.1) dt = 0.016;

  world.step(1 / 60, dt, 5);

  // Post-step: snap nearly-still dice to nearest face (or target face)
  for (let di = 0; di < dice.length; di++) {
    const d = dice[di];
    if (d.settled) continue;
    const b = d.body;
    if (b.type === CANNON.Body.STATIC) continue;

    const speed = b.velocity.length();
    const angSpeed = b.angularVelocity.length();

    if (speed < SETTLE_VEL && angSpeed < SETTLE_ANG_VEL) {
      const target = (targetValues && targetValues[di] !== undefined)
        ? targetFaceQuat(b.quaternion, targetValues[di])
        : nearestFaceQuat(b.quaternion);
      b.quaternion.x += (target.x - b.quaternion.x) * 0.15;
      b.quaternion.y += (target.y - b.quaternion.y) * 0.15;
      b.quaternion.z += (target.z - b.quaternion.z) * 0.15;
      b.quaternion.w += (target.w - b.quaternion.w) * 0.15;
      b.quaternion.normalize();

      b.angularVelocity.scale(0.85, b.angularVelocity);

      const dotVal = Math.abs(
        b.quaternion.x * target.x + b.quaternion.y * target.y +
        b.quaternion.z * target.z + b.quaternion.w * target.w
      );
      if (dotVal > 0.999 && speed < 0.05) {
        // Check if stacked on another die (Y too high above floor)
        if (b.position.y > FLOOR_Y + HALF_SIZE + 1.5) {
          // Nudge sideways and let it re-settle
          b.position.x += (prng() - 0.5) * 4;
          b.position.y = FLOOR_Y + HALF_SIZE + 3;
          b.velocity.set((prng() - 0.5) * 2, -2, (prng() - 0.5) * 2);
          b.wakeUp();
          continue;
        }
        b.quaternion.copy(target);
        b.angularVelocity.set(0, 0, 0);
        b.velocity.set(0, 0, 0);
        d.settled = true;
      }
    }
  }

  return dice.map(d => ({
    quat: [d.body.quaternion.w, d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z],
    pos: [d.body.position.x, d.body.position.y, d.body.position.z],
  }));
}

function rollToValues(values, side) {
  targetValues = values;
  const count = values.length;
  if (!bodiesCreated) createBodies();
  const indices = [];
  for (let i = 0; i < count; i++) indices.push(i);
  for (const d of dice) {
    d.body.type = CANNON.Body.DYNAMIC;
    d.body.mass = MASS;
    d.body.updateMassProperties();
  }
  rollDice(indices, side);
}

function clearTargetValues() {
  targetValues = null;
}

function hideDice(indices) {
  if (!bodiesCreated) return;
  for (const i of indices) {
    if (i < NUM_DICE) {
      const b = dice[i].body;
      b.type = CANNON.Body.STATIC;
      b.velocity.set(0, 0, 0);
      b.angularVelocity.set(0, 0, 0);
      // Move far below the floor, out of view
      b.position.set(0, -50, 0);
    }
  }
}

export { loop, dice, rollAllDice, rollDice, rollToValues, clearTargetValues, getDiceValues, allSettled, NUM_DICE, setSeed, hideDice };
