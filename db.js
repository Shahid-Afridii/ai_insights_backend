import duckdb from 'duckdb';

let dbInstance = null;
let connection = null; // ✅ SINGLE CONNECTION
let tableLoaded = false;
let loadingPromise = null;

export function getDB() {
  if (!dbInstance) {
    dbInstance = new duckdb.Database(':memory:');
  }
  return dbInstance;
}

export async function getConnection() {
  if (!connection) {
    const db = getDB();
    connection = db.connect(); // ✅ REUSE SAME CONNECTION
  }
  return connection;
}

export async function loadParquetOnce(conn) {
  if (tableLoaded) return;

  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    console.log('📦 Loading parquet...');

    conn.run(`
      CREATE TABLE IF NOT EXISTS properties AS 
      SELECT * FROM read_parquet('https://pub-465091b295bd4eceb75d79e289a45c27.r2.dev/properties_final.parquet')
    `, (err) => {
      if (err) {
        console.error('❌ Parquet load failed:', err);
        loadingPromise = null;
        reject(err);
      } else {
        console.log('✅ Parquet loaded once');
        tableLoaded = true;
        resolve(true);
      }
    });
  });

  return loadingPromise;
}