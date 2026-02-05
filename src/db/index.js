const { Pool } = require('pg');

const pool = new Pool({
  // Tyto proměnné si pg načte automaticky z environment variables (nastavených v docker-compose)
  // nebo použije defaulty pro lokální vývoj mimo Docker
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'moje_databaze',
  password: process.env.PGPASSWORD || 'postgres',
  port: process.env.PGPORT || 5432,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
