import duckdb from 'duckdb';
import path from 'path';
import { fileURLToPath } from 'url';

let dbInstance = null;
let connection = null;
let tablePromise = null;

// ✅ fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ local parquet path
const PARQUET_PATH = path.join(__dirname, 'db/properties_final.parquet');

export async function getConnection() {
  if (!dbInstance) {
    dbInstance = new duckdb.Database(':memory:');
  }

  if (!connection) {
    connection = dbInstance.connect();
  }

  return connection;
}

export async function loadParquetOnce(conn) {
  if (!tablePromise) {
    tablePromise = new Promise((resolve, reject) => {
      conn.run(`
        CREATE TABLE IF NOT EXISTS properties AS 
        SELECT * FROM read_parquet('${PARQUET_PATH}')
      `, (err) => {
        if (err) {
          tablePromise = null;
          reject(err);
        } else {
          console.log('✅ Parquet loaded from LOCAL file');
          resolve(true);
        }
      });
    });
  }

  return tablePromise;
}