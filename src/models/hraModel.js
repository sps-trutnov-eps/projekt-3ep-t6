const db = require('../db');

class Game {
    /**
     * Inicializace tabulky games
     */
    static async createTable() {
      const createSql = `
        CREATE TABLE IF NOT EXISTS games (
            id SERIAL PRIMARY KEY,
            player1_id INTEGER REFERENCES users(id),
            player2_id INTEGER REFERENCES users(id),
            game_mode VARCHAR(12) DEFAULT 'MULTIPLAYER',
            current_turn_id INTEGER REFERENCES users(id),
            winner_id INTEGER REFERENCES users(id),
            p1_score INTEGER DEFAULT 0,
            p2_score INTEGER DEFAULT 0,
            turn_score INTEGER DEFAULT 0,           
            dice_left INTEGER DEFAULT 6,
            last_seed INTEGER DEFAULT 10000,  
            status VARCHAR(20) DEFAULT 'ACTIVE',
            last_roll JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await db.query(createSql);

      // Migrations: safely add columns if they don't exist yet
      const migrations = [
        `ALTER TABLE games ADD COLUMN IF NOT EXISTS game_mode VARCHAR(12) DEFAULT 'MULTIPLAYER'`,
        `ALTER TABLE games ADD COLUMN IF NOT EXISTS turn_score INTEGER DEFAULT 0`,
        `ALTER TABLE games ADD COLUMN IF NOT EXISTS dice_left INTEGER DEFAULT 6`,
        `ALTER TABLE games ADD COLUMN IF NOT EXISTS last_roll JSONB DEFAULT '[]'`,
        'ALTER TABLE games ADD COLUMN IF NOT EXISTS last_seed INTEGER DEFAULT 10000',
      ];

      for (const sql of migrations) {
         await db.query(sql);
      }
  }

  /**
   * Vytvoří novou hru mezi dvěma hráči
   * První na tahu je player1
   */
  static async create(player1Id, player2Id) {
      const sql = `
        INSERT INTO games (player1_id, player2_id, current_turn_id, dice_left)
        VALUES ($1, $2, $1, 6)
        RETURNING *;
      `;
      const { rows } = await db.query(sql, [player1Id, player2Id]);
      return rows[0];
  }

    /**
     * Najde hru podle ID
     */
    static async findById(gameId) {
        const { rows } = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
        return rows[0];
    }
    // Uloží výsledek hodu do last_roll bez změny turn_score nebo dice_left
    static async saveRoll(gameId, rollValues) {
        const sql = `
            UPDATE games
            SET last_roll = $2
            WHERE id = $1
            RETURNING *;
        `;
        const { rows } = await db.query(sql, [gameId, JSON.stringify(rollValues)]);
        return rows[0];
    }

    /**
     * Aktualizuje stav v rámci tahu hráče (po hodu kostkami)
     * - Přičte body získané z hodu k turn_score (body na stole)
     * - Aktualizuje počet zbývajících kostek
     * - Uloží, co padlo (pro zobrazení)
     */
    static async updateTurn(gameId, pointsGained, diceRemaining, rollValues) {
        // Pokud hráč vyhází všechny kostky (Hot Dice), dostane nových 6
        const nextDiceCount = diceRemaining === 0 ? 6 : diceRemaining;

        const sql = `
            UPDATE games
            SET turn_score = turn_score + $2,
                dice_left = $3,
                last_roll = $4
            WHERE id = $1
            RETURNING *;
        `;
        // JSON.stringify pro uložení pole čísel
        const { rows } = await db.query(sql, [gameId, pointsGained, nextDiceCount, JSON.stringify(rollValues)]);
        return rows[0];
    }

    /**
     * Bust / Farkle - Hráč hodil a nic mu nepadlo
     * - Přijde o body v tomto kole (turn_score = 0)
     * - Tah se předá soupeři
     * - Resetuje se počet kostek na 6
     */
    static async bust(gameId, nextPlayerId, rollValues) {
        const sql = `
            UPDATE games
            SET turn_score = 0,
                dice_left = 6,
                current_turn_id = $2,
                last_roll = $3
            WHERE id = $1
            RETURNING *;
        `;
        const { rows } = await db.query(sql, [gameId, nextPlayerId, JSON.stringify(rollValues)]);
        return rows[0];
    }

    /**
     * Bank - Hráč se rozhodl uložit body a předat tah
     * - Body z 'turn_score' se přičtou k jeho celkovému skóre (p1_score nebo p2_score)
     * - Resetuje se turn_score na 0
     * - Tah se předá soupeři
     * - Reset kostek na 6
     */
    static async bankPoints(gameId, playerId, nextPlayerId) {
        // Nejdřív zjistíme, jestli je to player1 nebo player2, abychom věděli, kam přičíst
        const game = await this.findById(gameId);
        if (!game) throw new Error('Game not found');

        let columnToUpdate = '';
        if (game.player1_id === playerId) {
            columnToUpdate = 'p1_score';
        } else if (game.player2_id === playerId) {
            columnToUpdate = 'p2_score';
        } else {
            throw new Error('Player not in this game');
        }

        // Dynamicky sestavíme query podle toho, komu přičítáme
        const sql = `
            UPDATE games
            SET 
                ${columnToUpdate} = ${columnToUpdate} + turn_score,
                turn_score = 0,
                dice_left = 6,
                current_turn_id = $2
            WHERE id = $1
            RETURNING *;
        `;
        
        const { rows } = await db.query(sql, [gameId, nextPlayerId]);
        return rows[0];
    }

    /**
     * Ukončí hru (jeden hráč dosáhl cílového skóre)
     */
    static async finishGame(gameId, winnerId) {
        const sql = `
            UPDATE games
            SET status = 'FINISHED',
                winner_id = $2
            WHERE id = $1
            RETURNING *;
        `;
        const { rows } = await db.query(sql, [gameId, winnerId]);
        return rows[0];
    }
    
    static async createSingleplayerGame(playerId) {
        const sql = `
            INSERT INTO games (player1_id, current_turn_id, game_mode, dice_left)
            VALUES ($1, $1, 'SINGLEPLAYER', 6)
            RETURNING *;
        `;
        const { rows } = await db.query(sql, [playerId]);
        return rows[0];
    }

    /**
     * Bank NPC points in singleplayer mode
     */
    static async bankNpcPoints(gameId, points) {
        const sql = `
            UPDATE games
            SET 
                p2_score = p2_score + $2,
                turn_score = 0,
                dice_left = 6,
                current_turn_id = player1_id
            WHERE id = $1
            RETURNING *;
        `;
        const { rows } = await db.query(sql, [gameId, points]);
        return rows[0];
    }
}


module.exports = Game;