// init-buffers.js

function initBuffers(gl) {
  const positionBuffer = initPositionBuffer(gl);
  const textureCoordBuffer = initTextureBuffer(gl);
  const indexBuffer = initIndexBuffer(gl);
  const normalBuffer = initNormalBuffer(gl);

  return {
    position: positionBuffer,
    normal: normalBuffer,
    textureCoord: textureCoordBuffer,
    indices: indexBuffer,
  };
}


function initPositionBuffer(gl) {
  // Create a buffer for the square's positions.
  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const S = 0.7; // half-size
  const positions = [
  // Front face
  -S, -S, S, S, -S, S, S, S, S, -S, S, S,
  // Back face
  -S, -S, -S, -S, S, -S, S, S, -S, S, -S, -S,
  // Top face
  -S, S, -S, -S, S, S, S, S, S, S, S, -S,
  // Bottom face
  -S, -S, -S, S, -S, -S, S, -S, S, -S, -S, S,
  // Right face
  S, -S, -S, S, S, -S, S, S, S, S, -S, S,
  // Left face
  -S, -S, -S, -S, -S, S, -S, S, S, -S, S, -S,
];

  // Now pass the list of positions into WebGL to build the
  // sg a Float3hape. We do this by creatin2Array from the
  // JavaScript array, then use it to fill the current buffer.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  return positionBuffer;
}

function initColorBuffer(gl) {
  const faceColors = [
    [1.0, 1.0, 1.0, 1.0], // Front face: white
    [1.0, 0.0, 0.0, 1.0], // Back face: red
    [0.0, 1.0, 0.0, 1.0], // Top face: green
    [0.0, 0.0, 1.0, 1.0], // Bottom face: blue
    [1.0, 1.0, 0.0, 1.0], // Right face: yellow
    [1.0, 0.0, 1.0, 1.0], // Left face: purple
  ];

  // Convert the array of colors into a table for all the vertices.

  let colors = [];

  for (const c of faceColors) {
    // Repeat each color four times for the four vertices of the face
    colors = colors.concat(c, c, c, c);
  }

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  return colorBuffer;
}

function initTextureBuffer(gl) {
  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

  const textureCoordinates = [
    // Front
    0.0, 1/3, 1/4, 1/3, 1/4, 2/3, 0.0, 2/3,
    // Back
    1/2, 1/3, 3/4, 1/3, 3/4, 2/3, 1/2, 2/3,
    // Top
    1/4, 1/3, 1/2, 1/3, 1/2, 2/3, 1/4, 2/3,
    // Bottom
    3/4, 1/3, 1.0, 1/3, 1.0, 2/3, 3/4, 2/3,
    // Right
    1/4, 0.0, 1/2, 0.0, 1/2, 1/3, 1/4, 1/3,
    // Left
    1/4, 2/3, 1/2, 2/3, 1/2, 1, 1/4, 1,
  ];

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(textureCoordinates),
    gl.STATIC_DRAW,
  );

  return textureCoordBuffer;
}

function initIndexBuffer(gl) {
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  // prettier-ignore
  const indices = [
     0,  1,  2,      0,  2,  3,    // front
     4,  5,  6,      4,  6,  7,    // back
     8,  9,  10,     8,  10, 11,   // top
     12, 13, 14,     12, 14, 15,   // bottom
     16, 17, 18,     16, 18, 19,   // right
     20, 21, 22,     20, 22, 23,   // left
  ];

  // Now send the element array to GL

  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW,
  );

  return indexBuffer;
}

function initNormalBuffer(gl) {
  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

  const vertexNormals = [
    // Front
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,

    // Back
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,

    // Top
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,

    // Bottom
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,

    // Right
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,

    // Left
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ];

  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(vertexNormals),
    gl.STATIC_DRAW,
  );

  return normalBuffer;
}

function initTableBuffers(gl) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Flat quad slightly larger than both frames (X ±4.8, Z -22.7 to -3.5)
  const positions = [
    -7.0, 0.0, -25.0,
     7.0, 0.0, -25.0,
     7.0, 0.0,  -1.0,
    -7.0, 0.0,  -1.0,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  const normals = [
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  const textureCoords = [
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  const indices = [0, 1, 2, 0, 2, 3];
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    normal: normalBuffer,
    textureCoord: textureCoordBuffer,
    indices: indexBuffer,
    vertexCount: 6,
  };
}

// Creates a box mesh centered at origin with given half-extents
function createBoxBuffers(gl, hx, hy, hz) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const p = [
    // Front
    -hx,-hy, hz,  hx,-hy, hz,  hx, hy, hz, -hx, hy, hz,
    // Back
    -hx,-hy,-hz, -hx, hy,-hz,  hx, hy,-hz,  hx,-hy,-hz,
    // Top
    -hx, hy,-hz, -hx, hy, hz,  hx, hy, hz,  hx, hy,-hz,
    // Bottom
    -hx,-hy,-hz,  hx,-hy,-hz,  hx,-hy, hz, -hx,-hy, hz,
    // Right
     hx,-hy,-hz,  hx, hy,-hz,  hx, hy, hz,  hx,-hy, hz,
    // Left
    -hx,-hy,-hz, -hx,-hy, hz, -hx, hy, hz, -hx, hy,-hz,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  const n = [
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(n), gl.STATIC_DRAW);

  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  const tc = [];
  for (let i = 0; i < 6; i++) tc.push(0,0, 1,0, 1,1, 0,1);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tc), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  const idx = [];
  for (let i = 0; i < 6; i++) {
    const o = i * 4;
    idx.push(o,o+1,o+2, o,o+2,o+3);
  }
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

  return { position: positionBuffer, normal: normalBuffer, textureCoord: textureCoordBuffer, indices: indexBuffer, vertexCount: 36 };
}

// Two square frames stacked in Z (near = human, far = AI), sharing a wall at Z_MID.
// Original width preserved (X_HALF=4.8), each frame is square (~9.6 × 9.6).
function initFrameBuffers(gl) {
  const WALL_H = 0.6;
  const WALL_T = 0.25;
  const X_HALF = 4.8;                       // original half-width
  const DEPTH = X_HALF * 2;                 // 9.6 — square frame
  const Z_NEAR_MAX = -3.5;                  // front edge
  const Z_MID = Z_NEAR_MAX - DEPTH;         // -13.1 shared wall
  const Z_FAR_MIN = Z_MID - DEPTH;          // -22.7 back edge
  const Z_TOTAL_MID = (Z_NEAR_MAX + Z_FAR_MIN) / 2;
  const Z_TOTAL_HALF = (Z_NEAR_MAX - Z_FAR_MIN) / 2;

  return {
    // Left wall (full length, both frames)
    left:   { buffers: createBoxBuffers(gl, WALL_T, WALL_H, Z_TOTAL_HALF + WALL_T), pos: [-X_HALF - WALL_T, WALL_H, Z_TOTAL_MID] },
    // Right wall (full length, both frames)
    right:  { buffers: createBoxBuffers(gl, WALL_T, WALL_H, Z_TOTAL_HALF + WALL_T), pos: [X_HALF + WALL_T, WALL_H, Z_TOTAL_MID] },
    // Front wall (near edge)
    front:  { buffers: createBoxBuffers(gl, X_HALF + WALL_T * 2, WALL_H, WALL_T), pos: [0, WALL_H, Z_NEAR_MAX + WALL_T] },
    // Back wall (far edge)
    back:   { buffers: createBoxBuffers(gl, X_HALF + WALL_T * 2, WALL_H, WALL_T), pos: [0, WALL_H, Z_FAR_MIN - WALL_T] },
    // Shared middle wall
    middle: { buffers: createBoxBuffers(gl, X_HALF + WALL_T * 2, WALL_H, WALL_T), pos: [0, WALL_H, Z_MID] },
  };
}

export { initBuffers, initTableBuffers, initFrameBuffers };