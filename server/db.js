// Thin D1 HTTP wrapper — replaces Prisma with raw SQL via Cloudflare D1 REST API
// For local dev, uses better-sqlite3 directly

let _db = null;

function initDb() {
  if (process.env.D1_DATABASE_ID) {
    const { D1HttpDatabase } = require('./d1Client');
    _db = new D1HttpDatabase({
      accountId: process.env.D1_ACCOUNT_ID,
      databaseId: process.env.D1_DATABASE_ID,
      apiToken: process.env.D1_API_TOKEN,
    });
    _db._type = 'd1';
    console.log('Using Cloudflare D1 database');
  } else {
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace('file:', '')
      : path.join(__dirname, 'prisma', 'dev.db');
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    // Wrap better-sqlite3 to match D1 interface
    _db = {
      _type: 'sqlite',
      _sqlite: sqlite,
      prepare(sql) {
        return new LocalStatement(sqlite, sql);
      },
    };
    console.log('Using local SQLite database');
  }
}

class LocalStatement {
  constructor(sqlite, sql) {
    this._sqlite = sqlite;
    this._sql = sql;
    this._params = [];
  }
  bind(...values) {
    this._params = values;
    return this;
  }
  async all() {
    const stmt = this._sqlite.prepare(this._sql);
    const rows = stmt.all(...this._params);
    return { results: rows };
  }
  async first() {
    const stmt = this._sqlite.prepare(this._sql);
    const row = stmt.get(...this._params);
    return row || null;
  }
  async run() {
    const stmt = this._sqlite.prepare(this._sql);
    const info = stmt.run(...this._params);
    return { meta: { last_row_id: info.lastInsertRowid, changes: info.changes } };
  }
}

// ── Query helpers ──

// Run a SELECT and return all rows
async function all(sql, ...params) {
  const result = await _db.prepare(sql).bind(...params).all();
  return result.results || [];
}

// Run a SELECT and return the first row or null
async function get(sql, ...params) {
  if (_db._type === 'sqlite') {
    return _db.prepare(sql).bind(...params).first();
  }
  // D1: use .first()
  return _db.prepare(sql).bind(...params).first();
}

// Run INSERT/UPDATE/DELETE and return metadata
async function run(sql, ...params) {
  const result = await _db.prepare(sql).bind(...params).run();
  return result;
}

// Insert and return the new row by id (SQLite RETURNING or fetch after insert)
async function insert(table, data) {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(', ');
  const cols = keys.map(k => `"${k}"`).join(', ');
  const vals = keys.map(k => data[k]);
  const sql = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`;
  const result = await run(sql, ...vals);
  const id = result.meta?.last_row_id;
  if (id) {
    return get(`SELECT * FROM "${table}" WHERE "id" = ?`, id);
  }
  return null;
}

// Count rows
async function count(table, where = '', ...params) {
  const sql = `SELECT COUNT(*) as cnt FROM "${table}"${where ? ' WHERE ' + where : ''}`;
  const row = await get(sql, ...params);
  return row?.cnt || 0;
}

function getDb() { return _db; }

module.exports = { initDb, getDb, all, get, run, insert, count };
