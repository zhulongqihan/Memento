import Database from '@tauri-apps/plugin-sql'
import { createSeedState } from './seed'
import type { AppState } from '../domain/types'

const STORAGE_KEY = 'memento:app-state:v1'
let databasePromise: Promise<Database> | null = null

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load('sqlite:memento.db').then(async (database) => {
      await database.execute(`CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`)
      return database
    })
  }
  return databasePromise
}

function parseState(raw: string | null): AppState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AppState
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.moments)) return null
    return parsed
  } catch {
    return null
  }
}

export async function loadState(): Promise<AppState> {
  if (inTauri()) {
    try {
      const database = await getDatabase()
      const rows = await database.select<Array<{ payload: string }>>('SELECT payload FROM app_state WHERE id = $1', ['current'])
      const state = parseState(rows[0]?.payload ?? null)
      if (state) return state
    } catch (error) {
      console.warn('SQLite unavailable, using local fallback.', error)
    }
  }

  const localState = parseState(localStorage.getItem(STORAGE_KEY))
  return localState ?? createSeedState()
}

export async function saveState(state: AppState): Promise<void> {
  const payload = JSON.stringify(state)
  localStorage.setItem(STORAGE_KEY, payload)

  if (inTauri()) {
    try {
      const database = await getDatabase()
      await database.execute(
        'INSERT INTO app_state (id, payload, updated_at) VALUES ($1, $2, $3) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
        ['current', payload, new Date().toISOString()],
      )
    } catch (error) {
      console.warn('Unable to persist to SQLite.', error)
    }
  }
}

