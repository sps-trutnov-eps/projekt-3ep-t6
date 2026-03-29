const db = require('../db');

class Friend {
  /**
   * Inicializace tabulky friendships
   */
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, friend_id)
      );
    `;
    await db.query(sql);

    // Migrations: ensure status can be PENDING, ACCEPTED, REJECTED, BLOCKED
    // For now we just ensure the table exists with basic fields.
  }

  /**
   * Poslat žádost o přátelství
   */
  static async sendRequest(userId, friendId) {
    const sql = `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'PENDING')
      ON CONFLICT (user_id, friend_id) DO NOTHING
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [userId, friendId]);
    return rows[0];
  }

  /**
   * Přijmout žádost
   */
  static async acceptRequest(userId, friendId) {
    const sql = `
      UPDATE friendships
      SET status = 'ACCEPTED'
      WHERE user_id = $2 AND friend_id = $1
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [userId, friendId]);
    return rows[0];
  }

  /**
   * Odmítnout nebo zrušit přátelství
   */
  static async removeFriendship(userId, friendId) {
    const sql = `
      DELETE FROM friendships
      WHERE (user_id = $1 AND friend_id = $2)
      OR (user_id = $2 AND friend_id = $1)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [userId, friendId]);
    return rows[0];
  }

  /**
   * Získat seznam přátel
   */
  static async getFriends(userId) {
    const sql = `
      SELECT u.id, u.username, u.wins, u.losses
      FROM users u
      JOIN friendships f ON (f.user_id = u.id OR f.friend_id = u.id)
      WHERE (f.user_id = $1 OR f.friend_id = $1)
      AND f.status = 'ACCEPTED'
      AND u.id != $1;
    `;
    const { rows } = await db.query(sql, [userId]);
    return rows;
  }

  /**
   * Získat příchozí žádosti
   */
  static async getPendingRequests(userId) {
    const sql = `
      SELECT u.id, u.username
      FROM users u
      JOIN friendships f ON f.user_id = u.id
      WHERE f.friend_id = $1
      AND f.status = 'PENDING';
    `;
    const { rows } = await db.query(sql, [userId]);
    return rows;
  }
}

module.exports = Friend;
