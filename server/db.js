let db

async function setup() {
  if (process.env.DATABASE_URL) {
    // PostgreSQL (production, e.g. Render)
    const { Pool } = require('pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        username   TEXT UNIQUE NOT NULL,
        password   TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    db = {
      type: 'pg',
      pool,
      async findUser(username) {
        const r = await pool.query('SELECT * FROM users WHERE username = $1', [username])
        return r.rows[0] || null
      },
      async createUser(username, hash) {
        const r = await pool.query(
          'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username, created_at',
          [username, hash]
        )
        return r.rows[0]
      },
    }
  } else {
    // SQLite (local development)
    const Database = require('better-sqlite3')
    const path = require('path')
    const sqlite = new Database(path.join(__dirname, 'ai-chat.db'))
    sqlite.pragma('journal_mode = WAL')
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        username   TEXT UNIQUE NOT NULL,
        password   TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)
    db = {
      type: 'sqlite',
      sqlite,
      findUser(username) {
        return sqlite.prepare('SELECT * FROM users WHERE username = ?').get(username) || null
      },
      createUser(username, hash) {
        return sqlite.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash)
      },
    }
  }

  console.log(`[db] Connected (${db.type})`)
  return db
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call setup() first.')
  return db
}

module.exports = { setup, getDb }
