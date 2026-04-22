import duckdb from 'duckdb';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

let dbInstance = null;
let connection = null;
let tablePromise = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ local cache file
const LOCAL_PATH = path.join(__dirname, 'properties.parquet');

// ✅ YOUR R2 PUBLIC FILE
const REMOTE_URL = 'https://pub-465091b295bd4eceb75d79e289a45c27.r2.dev/properties_final.parquet';

// 🔥 download once
async function downloadFile() {
  if (fs.existsSync(LOCAL_PATH)) return;

  console.log('⬇️ Downloading parquet from R2...');

  const res = await fetch(REMOTE_URL);

  if (!res.ok) {
    throw new Error(`Download failed: ${res.statusText}`);
  }

  const fileStream = fs.createWriteStream(LOCAL_PATH);

  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on('error', reject);
    fileStream.on('finish', resolve);
  });

  console.log('✅ Download complete');
}

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
    tablePromise = new Promise(async (resolve, reject) => {
      try {
        await downloadFile();

        conn.run(`
          CREATE TABLE IF NOT EXISTS properties AS 
          SELECT * FROM read_parquet('${LOCAL_PATH}')
        `, (err) => {
          if (err) {
            tablePromise = null;
            reject(err);
          } else {
            console.log('✅ Parquet loaded (R2 → local cache)');
            resolve(true);
          }
        });

      } catch (err) {
        console.error('❌ Download error:', err);
        reject(err);
      }
    });
  }

  return tablePromise;
}