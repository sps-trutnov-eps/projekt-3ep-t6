const db = require('../db');

class Room {
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        creator_id INTEGER REFERENCES users(id),
        player2_id INTEGER REFERENCES users(id),
        game_id INTEGER REFERENCES games(id),
        room_type VARCHAR(10) DEFAULT 'PRIVATE',
        invite_code VARCHAR(5) UNIQUE,
        status VARCHAR(20) DEFAULT 'WAITING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    return db.query(sql);
  }

  static generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Generuje kod dokud nenajde unikatni
  static async generateUniqueCode() {
    let code;
    let exists = true;
    while (exists) {
      code = this.generateCode();
      const { rows } = await db.query('SELECT id FROM rooms WHERE invite_code = $1', [code]);
      exists = rows.length > 0;
    }
    return code;
  }

  static async create(creatorId, isPrivate = true) {
    const roomType = isPrivate ? 'PRIVATE' : 'PUBLIC';
    const inviteCode = await this.generateUniqueCode();

    const sql = `
      INSERT INTO rooms (creator_id, room_type, invite_code)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [creatorId, roomType, inviteCode]);
    return rows[0];
  }

  static async setVisibility(roomId, isPublic) {
    const sql = `
      UPDATE rooms
      SET room_type = $2
      WHERE id = $1
      RETURNING *;
    `;
    const roomType = isPublic ? 'PUBLIC' : 'PRIVATE';
    const { rows } = await db.query(sql, [roomId, roomType]);
    return rows[0];
  }

  static async listPublic() {
    const sql = `
      SELECT r.*, u.username
      FROM rooms r
      JOIN users u ON r.creator_id = u.id
      WHERE r.room_type = 'PUBLIC'
      AND r.status = 'WAITING'
      ORDER BY r.created_at DESC;
    `;
    const { rows } = await db.query(sql);
    return rows;
  }

  static async findByCode(code) {
    const sql = `
      SELECT r.*, u.username
      FROM rooms r
      JOIN users u ON r.creator_id = u.id
      WHERE r.invite_code = $1;
    `;
    const { rows } = await db.query(sql, [code.toUpperCase()]);
    return rows[0];
  }

  static async findById(roomId) {
    const { rows } = await db.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    return rows[0];
  }

  static async join(roomId, playerId) {
    const sql = `
      UPDATE rooms
      SET player2_id = $2, status = 'READY'
      WHERE id = $1 AND player2_id IS NULL
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [roomId, playerId]);
    return rows[0];
  }

  static async startGame(roomId, gameId) {
    const sql = `
      UPDATE rooms
      SET game_id = $2, status = 'IN_GAME'
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [roomId, gameId]);
    return rows[0];
  }

  static async finish(roomId) {
    const sql = `
      UPDATE rooms
      SET status = 'FINISHED'
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [roomId]);
    return rows[0];
  }

  static async cleanupOld(hoursOld = 1) {
    const sql = `
      DELETE FROM rooms
      WHERE status = 'WAITING'
      AND created_at < NOW() - INTERVAL '${hoursOld} hours'
      RETURNING *;
    `;
    const { rows } = await db.query(sql);
    return rows;
  }
}

module.exports = Room;