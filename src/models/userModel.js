const db = require('../db');

class User {
  /**
   * Inicializace tabulky v databázi
   */
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL unique,
        password VARCHAR(255) NOT NULL,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        WL_ratio FLOAT GENERATED ALWAYS AS (
          CASE 
            WHEN losses = 0 THEN wins::FLOAT
            ELSE wins::FLOAT / losses::FLOAT
          END
        ) STORED,
        win_streak INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await db.query(sql);

    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
      ALTER TABLE users DROP COLUMN IF EXISTS first_name;
      ALTER TABLE users DROP COLUMN IF EXISTS last_name;  
      ALTER TABLE users DROP COLUMN IF EXISTS friends;
    `);
  }

  /**
   * Najde uživatele podle ID
   */
  static async findById(id) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0];
  }

  static async findByUsername(username) {
    const { rows } = await db.query('SELECT * from users where username = $1', [username]);
    return rows[0];
  }

  /**
   * Vytvoří nového uživatele
   * jen tam pridej HASH predem
   * BCrypt by mel fungovat i tady
   */
  static async create({ username, password }) {
    const sql = `
      INSERT INTO users (username, password)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [username, password]);
    return rows[0];
  }

  /**
   * Aktualizuje statistiky po hře
   * zavolast to po hre, IDhrace, bool jestli vyhral
   */
  static async updateStats(id, isWin) {
    const user = await this.findById(id);
    if (!user) return null;

    let { wins, losses, win_streak } = user;

    if (isWin) {
      wins++;
      win_streak++;
    } else {
      losses++;
      win_streak = 0; // Streak se přeruší
    }

    const sql = `
      UPDATE users 
      SET wins = $1, losses = $2, win_streak = $3 
      WHERE id = $4 
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [wins, losses, win_streak, id]);
    return rows[0];
  }
}

module.exports = User;
