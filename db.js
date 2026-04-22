import duckdb from 'duckdb';

/* ================= MAIN DB (FOR /predict) ================= */

let dbInstance = null;
let connection = null;
let tablePromise = null;

export function getDB() {
  if (!dbInstance) {
    dbInstance = new duckdb.Database(':memory:');
  }
  return dbInstance;
}

export async function getConnection() {
  if (!connection) {
    const db = getDB();
    connection = db.connect();
  }
  return connection;
}

export async function loadParquetOnce(conn) {
  if (tablePromise) return tablePromise;

  tablePromise = new Promise((resolve, reject) => {
    console.log('📦 Loading MAIN parquet...');

    conn.run(`
      CREATE TABLE IF NOT EXISTS properties AS 
      SELECT * FROM read_parquet('https://pub-465091b295bd4eceb75d79e289a45c27.r2.dev/properties_final.parquet')
    `, (err) => {
      if (err) {
        console.error('❌ MAIN parquet load failed:', err);
        tablePromise = null;
        reject(err);
      } else {
        console.log('✅ MAIN parquet loaded');
        resolve(true);
      }
    });
  });

  return tablePromise;
}

/* ================= AREA DB (SEPARATE) ================= */

let areaDB = null;
let areaConn = null;
let areaLoaded = false;
let areaLoadingPromise = null;

export function getAreaConnection() {
  if (!areaDB) {
    areaDB = new duckdb.Database(':memory:');
  }

  if (!areaConn) {
    areaConn = areaDB.connect();
  }

  return areaConn;
}

export async function loadAreaParquetOnce(conn) {
  if (areaLoaded) return;

  if (areaLoadingPromise) return areaLoadingPromise;

  areaLoadingPromise = new Promise((resolve, reject) => {
    console.log('📦 Loading AREA parquet...');

    conn.run(`
      CREATE TABLE IF NOT EXISTS properties AS 
      SELECT * FROM read_parquet('https://pub-465091b295bd4eceb75d79e289a45c27.r2.dev/properties_final.parquet')
    `, (err) => {
      if (err) {
        console.error('❌ AREA parquet load failed:', err);
        areaLoadingPromise = null;
        reject(err);
      } else {
        console.log('✅ AREA parquet loaded');
        areaLoaded = true;
        resolve(true);
      }
    });
  });

  return areaLoadingPromise;
}