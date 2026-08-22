import Database from '@tauri-apps/plugin-sql'
import { createSeedState } from './seed'
import { migrateAppState } from './migration'
import type { AppState } from '../domain/types'

const STORAGE_KEY = 'memento:app-state:v2'
const LEGACY_STORAGE_KEY = 'memento:app-state:v1'
const RECOVERY_STORAGE_KEY = 'memento:recovery-snapshot:v2'
export interface RecoverySnapshot {
  createdAt: string
  state: AppState
}
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
    return migrateAppState(JSON.parse(raw))
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

  const localState = parseState(localStorage.getItem(STORAGE_KEY)) ?? parseState(localStorage.getItem(LEGACY_STORAGE_KEY))
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

export async function saveRecoverySnapshot(state: AppState): Promise<void> {
  const snapshot: RecoverySnapshot = { createdAt: new Date().toISOString(), state }
  const payload = JSON.stringify(snapshot)
  localStorage.setItem(RECOVERY_STORAGE_KEY, payload)
  if (inTauri()) {
    const database = await getDatabase()
    await database.execute(
      'INSERT INTO app_state (id, payload, updated_at) VALUES ($1, $2, $3) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
      ['recovery', payload, snapshot.createdAt],
    )
  }
}

export async function loadRecoverySnapshot(): Promise<RecoverySnapshot | null> {
  if (inTauri()) {
    try {
      const database = await getDatabase()
      const rows = await database.select<Array<{ payload: string }>>('SELECT payload FROM app_state WHERE id = $1', ['recovery'])
      const parsed = rows[0]?.payload ? JSON.parse(rows[0].payload) as RecoverySnapshot : null
      const state = parsed ? migrateAppState(parsed.state) : null
      if (parsed && state) return { createdAt: parsed.createdAt, state }
    } catch (error) {
      console.warn('Unable to load recovery snapshot.', error)
    }
  }
  const raw = localStorage.getItem(RECOVERY_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as RecoverySnapshot
    const state = migrateAppState(parsed.state)
    return state ? { createdAt: parsed.createdAt, state } : null
  } catch {
    return null
  }
}

export async function clearRecoverySnapshot(): Promise<void> {
  localStorage.removeItem(RECOVERY_STORAGE_KEY)
  if (inTauri()) {
    const database = await getDatabase()
    await database.execute('DELETE FROM app_state WHERE id = $1', ['recovery'])
  }
}
