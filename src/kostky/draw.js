// draw.js
// --------
// Contains the `drawScene` function which sets up the camera
// projection, model-view transforms (including rotation), binds
// attributes/uniforms and issues the draw call.

const { mat4 } = window;

function drawScene(gl, programInfo, buffers, texture, rotation, pos) {
  const fieldOfView = (45 * Math.PI) / 180;
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  // Camera: player's POV, looking across the table
  const viewMatrix = mat4.create();
  mat4.lookAt(viewMatrix,
    [0, 5, 2],      // eye
    [0, -2, -8],    // center
    [0, 1, 0],
  );

  // Model matrix
  const modelMatrix = mat4.create();
  mat4.translate(modelMatrix, modelMatrix, [pos[0], pos[1], pos[2]]);

  // Combine: view * model
  const modelViewMatrix = mat4.create();
  mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);

  // Rotation: quaternion [s, vx, vy, vz] (length 4) or Euler angles [rx, ry, rz] (length 3)
  if (Array.isArray(rotation) && rotation.length === 4) {
    const [s, vx, vy, vz] = rotation;
    const rotMat = mat4.create();
    rotMat[0]  = 1 - 2*vy*vy - 2*vz*vz;
    rotMat[1]  = 2*vx*vy + 2*s*vz;
    rotMat[2]  = 2*vx*vz - 2*s*vy;
    rotMat[3]  = 0;
    rotMat[4]  = 2*vx*vy - 2*s*vz;
    rotMat[5]  = 1 - 2*vx*vx - 2*vz*vz;
    rotMat[6]  = 2*vy*vz + 2*s*vx;
    rotMat[7]  = 0;
    rotMat[8]  = 2*vx*vz + 2*s*vy;
    rotMat[9]  = 2*vy*vz - 2*s*vx;
    rotMat[10] = 1 - 2*vx*vx - 2*vy*vy;
    rotMat[11] = 0;
    mat4.multiply(modelViewMatrix, modelViewMatrix, rotMat);
  } else {
    const rot = Array.isArray(rotation) ? rotation : [rotation * 0.3, rotation * 0.7, rotation];
    mat4.rotate(modelViewMatrix, modelViewMatrix, rot[0], [1, 0, 0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, rot[1], [0, 1, 0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, rot[2], [0, 0, 1]);
  }

  const normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelViewMatrix);
  mat4.transpose(normalMatrix, normalMatrix);

  setPositionAttribute(gl, buffers, programInfo);
  setTextureAttribute(gl, buffers, programInfo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  setNormalAttribute(gl, buffers, programInfo);

  gl.useProgram(programInfo.program);

  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

  {
    const vertexCount = buffers.vertexCount || 36;
    gl.drawElements(gl.TRIANGLES, vertexCount, gl.UNSIGNED_SHORT, 0);
  }
}

function setPositionAttribute(gl, buffers, programInfo) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
}

function setTextureAttribute(gl, buffers, programInfo) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
  gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
}

function setNormalAttribute(gl, buffers, programInfo) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
  gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
}

export { drawScene };
