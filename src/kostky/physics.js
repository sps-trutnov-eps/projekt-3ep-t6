// physics.js
// ----------
// Dice rigid-body physics powered by cannon-es.
// Sets up a CANNON.World with gravity, floor, walls, and dice bodies.
// Exports a loop(dt) function that steps the simulation and returns
// dice state (position + quaternion) for rendering.

import * as CANNON from './node_modules/cannon-es/dist/cannon-es.js';

// --- Constants ---
const NUM_DICE = 6;
const HALF_SIZE = 1.0;
const FLOOR_Y = -4.0;
const MASS = 1.0;
const SEED = 42;

const TABLE_X_MIN = -9;
const TABLE_X_MAX = 9;
const TABLE_Z_MIN = -16;
const TABLE_Z_MAX = -2;
const CEILING_Y = 12;

// Thresholds for settling dice to nearest face
const SETTLE_VEL = 0.15;
const SETTLE_ANG_VEL = 0.3;

// --- Seeded RNG (mulberry32) ---
function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

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
const floorBody = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
floorBody.position.set(0, FLOOR_Y, 0);
world.addBody(floorBody);

// Ceiling
const ceilingBody = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
ceilingBody.position.set(0, CEILING_Y, 0);
world.addBody(ceilingBody);

// Left wall (x = TABLE_X_MIN)
const leftWall = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
leftWall.quaternion.setFromEuler(0, Math.PI / 2, 0);
leftWall.position.set(TABLE_X_MIN, 0, 0);
world.addBody(leftWall);

// Right wall (x = TABLE_X_MAX)
const rightWall = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
rightWall.quaternion.setFromEuler(0, -Math.PI / 2, 0);
rightWall.position.set(TABLE_X_MAX, 0, 0);
world.addBody(rightWall);

// Back wall (z = TABLE_Z_MIN)
const backWall = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
backWall.position.set(0, 0, TABLE_Z_MIN);
world.addBody(backWall);

// Front wall (z = TABLE_Z_MAX)
const frontWall = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
frontWall.quaternion.setFromEuler(0, Math.PI, 0);
frontWall.position.set(0, 0, TABLE_Z_MAX);
world.addBody(frontWall);

// --- Snap-to-face: find which local axis is closest to world-up,
// then build a target quat that corrects only the tilt (preserves yaw) ---
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
  // Find which local axis, rotated by q, is closest to world-up
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

  // Current world direction of that axis
  const current = q.vmult(bestLocal);

  // Rotation from current to world-up (shortest arc)
  const cross = new CANNON.Vec3();
  current.cross(WORLD_UP, cross);
  const crossLen = cross.length();

  if (crossLen < 1e-6) {
    // Already aligned
    return q.clone();
  }

  const dot = current.dot(WORLD_UP);
  const angle = Math.atan2(crossLen, dot);
  cross.scale(1 / crossLen, cross); // normalize axis

  const correction = new CANNON.Quaternion();
  correction.setFromAxisAngle(cross, angle);

  // Apply correction to current quaternion: corrected = correction * q
  const result = correction.mult(q);
  result.normalize();
  return result;
}

// --- Create dice ---
let dice = [];
let initialized = false;

function initDice() {
  const rng = mulberry32(SEED);
  const diceShape = new CANNON.Box(new CANNON.Vec3(HALF_SIZE, HALF_SIZE, HALF_SIZE));

  for (let i = 0; i < NUM_DICE; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const body = new CANNON.Body({
      mass: MASS,
      shape: diceShape,
      material: diceMaterial,
      linearDamping: 0.1,
      angularDamping: 0.2,
      sleepSpeedLimit: 0.1,
      sleepTimeLimit: 1.0,
    });

    // Spread dice out more to reduce stacking
    body.position.set(
      -4 + col * 4 + (rng() - 0.5) * 0.5,
      3 + row * 2.5 + rng() * 2,
      -10 + (rng() - 0.5) * 2,
    );

    body.velocity.set(
      (rng() - 0.5) * 6,
      -1 + rng() * 2,
      (rng() - 0.5) * 6,
    );

    body.quaternion.setFromEuler(
      rng() * Math.PI * 2,
      rng() * Math.PI * 2,
      rng() * Math.PI * 2,
    );

    body.angularVelocity.set(
      (rng() - 0.5) * 15,
      (rng() - 0.5) * 15,
      (rng() - 0.5) * 15,
    );

    world.addBody(body);
    dice.push({ body, settled: false });
  }
  initialized = true;
}

function loop(dt) {
  if (!initialized) initDice();
  if (dt > 0.1) dt = 0.016;

  world.step(1 / 60, dt, 5);

  // Post-step: snap nearly-still dice to nearest face
  for (const d of dice) {
    const b = d.body;
    const speed = b.velocity.length();
    const angSpeed = b.angularVelocity.length();

    if (!d.settled && speed < SETTLE_VEL && angSpeed < SETTLE_ANG_VEL) {
      const target = nearestFaceQuat(b.quaternion);
      // Slerp towards the nearest clean face orientation
      b.quaternion.x += (target.x - b.quaternion.x) * 0.15;
      b.quaternion.y += (target.y - b.quaternion.y) * 0.15;
      b.quaternion.z += (target.z - b.quaternion.z) * 0.15;
      b.quaternion.w += (target.w - b.quaternion.w) * 0.15;
      b.quaternion.normalize();

      // Kill residual angular velocity
      b.angularVelocity.scale(0.85, b.angularVelocity);

      // Mark as fully settled once very close
      const dotVal = Math.abs(
        b.quaternion.x * target.x + b.quaternion.y * target.y +
        b.quaternion.z * target.z + b.quaternion.w * target.w
      );
      if (dotVal > 0.999 && speed < 0.05) {
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

export { loop, dice };
