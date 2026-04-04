const db = require('../db');

class Invitation {
    static async createTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS invitations (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (sender_id, receiver_id, room_id)
            );
        `;
        return db.query(sql);
    }

    static async create(senderId, receiverId, roomId) {
        const sql = `
            INSERT INTO invitations (sender_id, receiver_id, room_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (sender_id, receiver_id, room_id) DO NOTHING
            RETURNING *;
        `;
        const { rows } = await db.query(sql, [senderId, receiverId, roomId]);
        return rows[0];
    }

    static async listByReceiver(receiverId) {
        const sql = `
            SELECT i.*, u.username as sender_name, r.invite_code
            FROM invitations i
            JOIN users u ON i.sender_id = u.id
            JOIN rooms r ON i.room_id = r.id
            WHERE i.receiver_id = $1 AND i.status = 'PENDING'
            ORDER BY i.created_at DESC;
        `;
        const { rows } = await db.query(sql, [receiverId]);
        return rows;
    }

    static async updateStatus(invitationId, status) {
        const sql = `
            UPDATE invitations
            SET status = $2
            WHERE id = $1
            RETURNING *;
        `;
        const { rows } = await db.query(sql, [invitationId, status]);
        return rows[0];
    }
}

module.exports = Invitation;
