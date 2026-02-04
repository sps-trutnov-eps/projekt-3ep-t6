const db = require('../db');

class Room {
  /**
   * Inicializace tabulky rooms
   */
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        creator_id INTEGER REFERENCES users(id),
        player2_id INTEGER REFERENCES users(id),
        game_id INTEGER REFERENCES games(id),
        room_type VARCHAR(10) DEFAULT 'PUBLIC', -- 'PUBLIC' nebo 'PRIVATE'
        invite_code VARCHAR(5) UNIQUE,
        status VARCHAR(20) DEFAULT 'WAITING', -- 'WAITING', 'IN_GAME', 'FINISHED'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    return db.query(sql);
  }

  /**
   * Vygeneruje náhodný 5-písmenný kód pro roomku
   */
  static generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Vytvoří novou roomku
   * @param {number} creatorId - ID uživatele, který roomku vytváří
   * @param {boolean} isPrivate - true pro soukromou roomku, false pro veřejnou
   */
  static async create(creatorId, isPrivate = false) {
    const roomType = isPrivate ? 'PRIVATE' : 'PUBLIC';
    const inviteCode = this.generateCode();
    
    const sql = `
      INSERT INTO rooms (creator_id, room_type, invite_code)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [creatorId, roomType, inviteCode]);
    return rows[0];
  }

  /**
   * Vrátí seznam všech veřejných roomek čekajících na hráče
   * Včetně info o creatorovi (jméno)
   */
  static async listPublic() {
    const sql = `
      SELECT r.*, u.first_name, u.last_name 
      FROM rooms r
      JOIN users u ON r.creator_id = u.id
      WHERE r.room_type = 'PUBLIC' 
      AND r.status = 'WAITING'
      ORDER BY r.created_at DESC;
    `;
    const { rows } = await db.query(sql);
    return rows;
  }

  /**
   * Připojí druhého hráče do roomky
   * Změní status na 'READY' (oba hráči jsou připojeni)
   */
  static async join(roomId, playerId) {
    const sql = `
      UPDATE rooms
      SET player2_id = $2,
          status = 'READY'
      WHERE id = $1 
      AND player2_id IS NULL
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [roomId, playerId]);
    return rows[0];
  }

  /**
   * Najde roomku podle invite kódu (pro private roomky)
   */
  static async findByCode(code) {
    const sql = `
      SELECT r.*, u.first_name, u.last_name 
      FROM rooms r
      JOIN users u ON r.creator_id = u.id
      WHERE r.invite_code = $1;
    `;
    const { rows } = await db.query(sql, [code.toUpperCase()]);
    return rows[0];
  }

  /**
   * Najde roomku podle ID
   */
  static async findById(roomId) {
    const { rows } = await db.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    return rows[0];
  }

  /**
   * Spustí hru z roomky
   * Nastaví game_id a změní status na 'IN_GAME'
   */
  static async startGame(roomId, gameId) {
    const sql = `
      UPDATE rooms
      SET game_id = $2,
          status = 'IN_GAME'
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [roomId, gameId]);
    return rows[0];
  }

  /**
   * Ukončí roomku (po skončení hry)
   */
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

  /**
   * Smaže staré roomky (cleanup)
   * Například roomky starší než 1 hodinu, které jsou stále ve WAITING
   */
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