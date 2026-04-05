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
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const diceMaterial = new CANNON.Material('dice');
const wallMaterial = new CANNON.Material('wall');

world.addContactMaterial(new CANNON.ContactMaterial(diceMaterial, wallMaterial, {
  friction: 0.5,
  restitution: 0.3,
}));
world.addContactMaterial(new CANNON.ContactMaterial(diceMaterial, diceMaterial, {
  friction: 0.4,
  restitution: 0.3,
}));

// --- Create walls ---
const wallThickness = 0.5;

// Floor
const floorBody = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
floorBody.quaternion.setFromEulerDeg(-90, 0, 0);
floorBody.position.set(0, FLOOR_Y, 0);
world.addBody(floorBody);

// Ceiling
const ceilingBody = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
ceilingBody.quaternion.setFromEulerDeg(90, 0, 0);
ceilingBody.position.set(0, CEILING_Y, 0);
world.addBody(ceilingBody);

// Left wall (x = TABLE_X_MIN)
const leftWall = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
leftWall.quaternion.setFromEulerDeg(0, 90, 0);
leftWall.position.set(TABLE_X_MIN, 0, 0);
world.addBody(leftWall);

// Right wall (x = TABLE_X_MAX)
const rightWall = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
rightWall.quaternion.setFromEulerDeg(0, -90, 0);
rightWall.position.set(TABLE_X_MAX, 0, 0);
world.addBody(rightWall);

// Back wall (z = TABLE_Z_MIN)
const backWall = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
backWall.position.set(0, 0, TABLE_Z_MIN);
// Default plane faces +Z, we want it facing +Z (inward), so no rotation needed
world.addBody(backWall);

// Front wall (z = TABLE_Z_MAX)
const frontWall = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Plane(),
  material: wallMaterial,
});
frontWall.quaternion.setFromEulerDeg(0, 180, 0);
frontWall.position.set(0, 0, TABLE_Z_MAX);
world.addBody(frontWall);

// --- Create dice ---
let dice = [];
let initialized = false;

function initDice() {
  const rng = mulberry32(SEED);
  const diceShape = new CANNON.Box(new CANNON.Vec3(HALF_SIZE, HALF_SIZE, HALF_SIZE));

  for (let i = 0; i < NUM_DICE; i++) {
    const col = i % 3;
    const body = new CANNON.Body({
      mass: MASS,
      shape: diceShape,
      material: diceMaterial,
      linearDamping: 0.015,
      angularDamping: 0.13,
    });

    body.position.set(
      -3 + col * 3 + (rng() - 0.5) * 0.5,
      4 + rng() * 3,
      -6 + rng() * 1,
    );

    body.velocity.set(
      (rng() - 0.5) * 4,
      2 + rng() * 3,
      -6 - rng() * 4,
    );

    body.quaternion.setFromEuler(
      rng() * Math.PI * 2,
      rng() * Math.PI * 2,
      rng() * Math.PI * 2,
    );

    body.angularVelocity.set(
      (rng() - 0.5) * 12,
      (rng() - 0.5) * 12,
      (rng() - 0.5) * 12,
    );

    world.addBody(body);
    dice.push(body);
  }
  initialized = true;
}

function loop(dt) {
  if (!initialized) initDice();
  if (dt > 0.1) dt = 0.016;

  world.step(1 / 60, dt, 3);

  // Return state in the same format the renderer expects:
  // quat as [s, x, y, z], pos as [x, y, z]
  return dice.map(body => ({
    quat: [body.quaternion.w, body.quaternion.x, body.quaternion.y, body.quaternion.z],
    pos: [body.position.x, body.position.y, body.position.z],
  }));
}

export { loop, dice };
