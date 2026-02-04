const db = require('../db');

class User {
  /**
   * Inicializace tabulky v databázi
   */
  static async createTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
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
        friends JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    return db.query(sql);
  }

  /**
   * Najde uživatele podle ID
   */
  static async findById(id) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0];
  }

  /**
   * Vytvoří nového uživatele
   * jen tam pridej HASH predem
   * BCrypt by mel fungovat i tady
   */
  static async create({ first_name, last_name, password }) {
    const sql = `
      INSERT INTO users (first_name, last_name, password)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(sql, [first_name, last_name, password]);
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

  /**
   * Přidá přítele (přidá ID do JSONB pole)
   * self-explanatory?
   */
  static async addFriend(userId, friendId) {
    const sql = `
      UPDATE users 
      SET friends = friends || $2::jsonb 
      WHERE id = $1 
      AND NOT (friends @> $2::jsonb)
      RETURNING *;
    `;
    // $2::jsonb očekává např. '[5]'
    //nemuzes tomu poslat samotne cislo, ale 'pole', protoze je to list pratelId a JSONB to tak ocekava
    const { rows } = await db.query(sql, [userId, JSON.stringify([friendId])]);
    return rows[0];
  }
}

module.exports = User;
