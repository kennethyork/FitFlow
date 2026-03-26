// D1 HTTP Client — polyfills the D1Database binding interface using Cloudflare's REST API
// This allows @prisma/adapter-d1 to work from a standard Node.js server

class D1HttpPreparedStatement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
    this._params = [];
  }

  bind(...values) {
    this._params = values;
    return this;
  }

  async _execute() {
    const url = `${this._db._baseUrl}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this._db._apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: this._sql, params: this._params }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`D1 HTTP error ${res.status}: ${text}`);
    }
    const json = await res.json();
    if (!json.success) {
      const errMsg = json.errors?.[0]?.message || 'D1 query failed';
      throw new Error(errMsg);
    }
    return json.result?.[0] || { results: [], meta: {} };
  }

  async all() {
    const result = await this._execute();
    return {
      results: result.results || [],
      success: true,
      meta: result.meta || {},
    };
  }

  async first(column) {
    const result = await this._execute();
    const row = result.results?.[0] || null;
    if (column && row) return row[column];
    return row;
  }

  async run() {
    const result = await this._execute();
    return {
      results: result.results || [],
      success: true,
      meta: result.meta || {},
    };
  }

  async raw(options) {
    const result = await this._execute();
    const rows = result.results || [];
    if (!rows.length) return options?.columnNames ? { columns: [], results: [] } : [];
    const columns = Object.keys(rows[0]);
    const rawRows = rows.map(r => columns.map(c => r[c]));
    if (options?.columnNames) return { columns, results: rawRows };
    return rawRows;
  }
}

class D1HttpDatabase {
  constructor({ accountId, databaseId, apiToken }) {
    this._apiToken = apiToken;
    this._baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;
  }

  prepare(sql) {
    return new D1HttpPreparedStatement(this, sql);
  }

  async dump() {
    throw new Error('D1HttpDatabase.dump() not supported via REST API');
  }

  async batch(statements) {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.all());
    }
    return results;
  }

  async exec(sql) {
    const url = `${this._baseUrl}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this._apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`D1 exec error ${res.status}: ${text}`);
    }
    const json = await res.json();
    return { count: json.result?.length || 0, duration: 0 };
  }
}

module.exports = { D1HttpDatabase };
