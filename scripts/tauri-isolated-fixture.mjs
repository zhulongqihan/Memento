import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isolatedRoot = resolve(projectRoot, 'output', 'tauri-isolated')
const [action, profileName] = process.argv.slice(2)
if (!['prepare', 'remove-trigger', 'inspect-failure', 'inspect-success'].includes(action)) {
  throw new Error('用法：node scripts/tauri-isolated-fixture.mjs <prepare|remove-trigger|inspect-failure|inspect-success> <profile-name>')
}
if (!profileName || !/^[a-z0-9-]{1,48}$/.test(profileName)) throw new Error('profile-name 只能包含小写字母、数字和连字符。')

const profileRoot = resolve(isolatedRoot, profileName)
if (!profileRoot.startsWith(`${isolatedRoot}${sep}`)) throw new Error('隔离配置目录必须位于 output/tauri-isolated 内。')
const roamingDirectory = join(profileRoot, 'Roaming')
const appDataDirectory = join(roamingDirectory, 'com.zhulongqihan.memento')
const databasePath = join(appDataDirectory, 'memento.db')
const assetsDirectory = join(appDataDirectory, 'assets')
const fixturePath = join(projectRoot, 'src', 'data', 'fixtures', 'legacy', 'local-v3.json')

function openDatabase() {
  if (!existsSync(databasePath)) throw new Error(`隔离测试数据库不存在：${databasePath}`)
  return new DatabaseSync(databasePath)
}

function readFixture() {
  return JSON.parse(readFileSync(fixturePath, 'utf8'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

if (action === 'prepare') {
  if (existsSync(databasePath)) throw new Error(`拒绝覆盖已存在的隔离测试数据库：${databasePath}`)
  mkdirSync(appDataDirectory, { recursive: true })
  const fixture = readFixture()
  const database = new DatabaseSync(databasePath)
  database.exec(`CREATE TABLE app_state (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)`)
  database.prepare('INSERT INTO app_state (id, payload, updated_at) VALUES (?, ?, ?)')
    .run('current', JSON.stringify(fixture), new Date().toISOString())
  if (process.argv[4] === '--fail-current') {
    database.exec(`CREATE TRIGGER fail_current_update BEFORE UPDATE ON app_state
      WHEN NEW.id = 'current'
      BEGIN SELECT RAISE(ABORT, 'synthetic current-row commit failure'); END`)
  }
  database.close()
  console.log(JSON.stringify({ profileRoot, APPDATA: roamingDirectory, expectedDataDirectory: appDataDirectory, seededSchema: fixture.schemaVersion }, null, 2))
  process.exit(0)
}

if (action === 'remove-trigger') {
  const database = openDatabase()
  database.exec('DROP TRIGGER IF EXISTS fail_current_update')
  database.close()
  console.log(`已从隔离数据库移除合成提交故障：${databasePath}`)
  process.exit(0)
}

const database = openDatabase()
const current = database.prepare("SELECT payload FROM app_state WHERE id = 'current'").get()
const recovery = database.prepare("SELECT payload FROM app_state WHERE id = 'recovery'").get()
const migration = database.prepare('SELECT status, phase FROM asset_migration_log ORDER BY updated_at DESC LIMIT 1').get()
const assetMetadata = database.prepare('SELECT id, size_bytes, sha256 FROM photo_assets ORDER BY id').all()
database.close()

assert(current?.payload, 'current 行不存在。')
assert(recovery?.payload, 'recovery 行不存在。')
assert(migration, '迁移日志不存在。')
const currentState = JSON.parse(current.payload)
const recoverySnapshot = JSON.parse(recovery.payload)
const fixture = readFixture()
const fixturePhoto = fixture.photos[0]
const expectedBytes = Buffer.from(fixturePhoto.dataUrl.slice(fixturePhoto.dataUrl.indexOf(',') + 1), 'base64')
const assetPath = join(assetsDirectory, fixturePhoto.id)
assert(existsSync(assetPath), `合成照片文件不存在：${assetPath}`)
const actualBytes = readFileSync(assetPath)
const digest = createHash('sha256').update(expectedBytes).digest('hex')
const assetRow = assetMetadata.find((asset) => asset.id === fixturePhoto.id)
assert(assetRow, 'SQLite photo_assets 行不存在。')
assert(actualBytes.equals(expectedBytes), '隔离资产文件字节与 v3 合成照片不一致。')
assert(assetRow.size_bytes === expectedBytes.byteLength, 'SQLite 资产大小与照片文件不一致。')
assert(assetRow.sha256 === digest, 'SQLite 资产 SHA-256 与照片文件不一致。')
assert(recoverySnapshot.state?.schemaVersion === 4, '恢复快照不是 schema v4。')

if (action === 'inspect-failure') {
  assert(JSON.stringify(currentState) === JSON.stringify(fixture), '失败后 current 行不再等于原始 v3 状态。')
  assert(migration.status === 'failed' && migration.phase === 'committing_state', '迁移日志未记录 current 行提交失败。')
  console.log(JSON.stringify({ result: 'PASS', currentSchema: currentState.schemaVersion, recoverySchema: recoverySnapshot.state.schemaVersion, migration, assetId: fixturePhoto.id, assetBytes: actualBytes.byteLength, sha256: digest, databasePath, assetsDirectory }, null, 2))
} else {
  assert(currentState.schemaVersion === 4, '重试后 current 行没有升级到 v4。')
  assert(!Object.hasOwn(currentState, 'photos'), 'v4 current 行仍内嵌 photos。')
  assert(currentState.moments[0]?.photoIds.includes(fixturePhoto.id), '重试后记录没有保留照片引用。')
  assert(migration.status === 'committed' && migration.phase === 'completed', '重试后的迁移日志未提交成功。')
  console.log(JSON.stringify({ result: 'PASS', currentSchema: currentState.schemaVersion, momentTitle: currentState.moments[0]?.title, recoverySchema: recoverySnapshot.state.schemaVersion, migration, assetId: fixturePhoto.id, assetBytes: actualBytes.byteLength, sha256: digest, databasePath, assetsDirectory }, null, 2))
}
