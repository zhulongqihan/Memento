import Database from '@tauri-apps/plugin-sql'
import { invoke } from '@tauri-apps/api/core'

let databasePromise: Promise<Database> | null = null

/** One shared SQLite connection and schema initializer for desktop adapters. */
export async function getSqliteDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = invoke<string>('memento_database_url').then((url) => Database.load(url)).then(async (database) => {
      await database.execute(`CREATE TABLE IF NOT EXISTS app_state (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`)
      await database.execute(`CREATE TABLE IF NOT EXISTS photo_assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`)
      await database.execute(`CREATE TABLE IF NOT EXISTS asset_migration_log (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        phase TEXT NOT NULL,
        source_schema INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        details_json TEXT NOT NULL
      )`)
      return database
    }).catch((error) => {
      databasePromise = null
      throw error
    })
  }

  return databasePromise
}
