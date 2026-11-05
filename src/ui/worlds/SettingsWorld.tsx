import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Archive, ArrowDownToLine, ArrowUpFromLine, BookOpen, ChevronRight, KeyRound, Layers3, Sparkles } from 'lucide-react'
import type { AppState, DisplayDensity, NumberFormat, ThemeMode } from '../../domain/types'
import { COPY_LIBRARY } from '../../domain/narration'
import { APP_VERSION } from '../../version'
import { CreativeWorld } from '../creative-worlds'

export type SettingsSectionId = 'data' | 'life' | 'appearance' | 'library' | 'about'

export type SettingsWorldProps = {
  state: AppState
  recoveryAvailable: boolean
  backupPassword: string
  onBackupPasswordChange: (value: string) => void
  onExportJson: () => void
  onExportZip: () => void
  onExportEncrypted: (password: string) => void | Promise<void>
  onImport: (file: File, password: string) => void
  onRestoreSnapshot: () => void
  onResetData: () => void | Promise<void>
  onLifeProfileChange: (patch: { displayLifeProgress?: boolean; birthDate?: string; lifeExpectancyYears?: number }) => void
  onAppearanceChange: (patch: { theme?: ThemeMode; displayDensity?: DisplayDensity; numberFormat?: NumberFormat }) => void
  onNarrationEnabledChange: (enabled: boolean) => void
}

export function SettingsWorldV31({ state, recoveryAvailable, backupPassword, onBackupPasswordChange, onExportJson, onExportZip, onExportEncrypted, onImport, onRestoreSnapshot, onResetData, onLifeProfileChange, onAppearanceChange, onNarrationEnabledChange }: SettingsWorldProps): ReactElement {
  const fileInputId = 'backup-import-v31'
  const [section, setSection] = useState<SettingsSectionId>('data')
  const savedLifeYears = state.settings.lifeExpectancyYears ?? 80
  const [lifeYearsDraft, setLifeYearsDraft] = useState(() => String(savedLifeYears))
  const [lifeYearsError, setLifeYearsError] = useState<string | null>(null)
  useEffect(() => {
    setLifeYearsDraft(String(savedLifeYears))
    setLifeYearsError(null)
  }, [savedLifeYears])
  const commitLifeYears = () => {
    const years = Number(lifeYearsDraft)
    if (!lifeYearsDraft.trim() || !Number.isInteger(years) || years < 1 || years > 150) {
      setLifeYearsError('请输入 1 到 150 之间的整数。原有年限尚未更改。')
      return
    }
    setLifeYearsError(null)
    setLifeYearsDraft(String(years))
    if (years !== savedLifeYears) onLifeProfileChange({ lifeExpectancyYears: years })
  }
  const passwordReady = backupPassword.trim().length >= 8
  const sections: Array<[SettingsSectionId, string, string]> = [['data', '数据', '导入、导出与恢复'], ['life', '人生', '可选的时间刻度'], ['appearance', '阅读', '光线、密度与数字'], ['library', '旁白', '本地文案与授权'], ['about', '关于', '版本与本地原则']]
  return <CreativeWorld kind="registry"><div className="world-page world-settings-v29" data-layout="personal-registry"><header className="registry29-header"><div><span>PERSONAL REGISTRY / LOCAL ONLY</span><h1>我的</h1><p>一份安静、可维护的本地时间册。</p></div><div className="registry29-identity"><strong>{state.settings.displayName.slice(0, 1) || '我'}</strong><span>{state.settings.displayName}<br />数据只保存在这台电脑</span></div></header><div className="registry29-ledger" aria-label="时间册统计"><span>时刻</span><strong>{state.moments.length}</strong><span>经年</span><strong>{state.elapsed.length}</strong><span>余下</span><strong>{state.remaining.length}</strong><span>刻度</span><strong>{state.stages.length}</strong><span>每日</span><strong>{state.dailyEntries.length}</strong><span className="registry29-ledger-status">LOCAL / ACTIVE</span></div><div className="registry29-body"><nav className="registry29-directory" aria-label="设置目录"><span>目录 / DOCUMENTS</span>{sections.map(([id, label, note]) => <button key={id} className={section === id ? 'is-selected' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}><strong>{label}</strong><small>{note}</small><ChevronRight size={14} /></button>)}</nav><section className="registry29-document" aria-label="设置内容">
    {section === 'data' && <section className="registry29-section">
      <div className="registry29-section-head"><div><span>DATA / 01</span><h2>带走你的时间</h2></div><Archive size={18} /></div>
      <p className="registry29-note">备份包含全部时间记录、关联照片、每日一行、旁白收藏与使用历史，以及你的设置。可以保存到其他位置，留下一份自己的副本。</p>
      <section className="registry42-backup-group" aria-labelledby="backup-files-title">
        <h3 id="backup-files-title">保存与带回备份</h3>
        <p className="registry29-microcopy">ZIP 将记录与照片一起打包，适合日常留存；JSON 包含相同内容，便于查看。导入后可选择合并或替换，替换前会保留当前时间册的本地快照。</p>
        <div className="registry29-actions registry42-backup-actions">
          <button className="registry29-primary" onClick={onExportZip}><Archive size={15} />导出完整 ZIP</button>
          <button className="registry29-secondary" onClick={onExportJson}><ArrowDownToLine size={15} />导出 JSON</button>
          <button type="button" className="registry29-secondary" onClick={() => document.getElementById(fileInputId)?.click()}><ArrowUpFromLine size={15} />导入备份</button>
          <input hidden id={fileInputId} type="file" accept=".json,.zip,.memento,application/json,application/zip,application/octet-stream" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file, backupPassword); event.currentTarget.value = '' }} />
        </div>
      </section>
      <section className="registry42-encryption-group" aria-labelledby="backup-password-title">
        <h3 id="backup-password-title">给备份加一道密码</h3>
        <p className="registry29-microcopy">加密备份也包含上述完整内容。导入加密文件前，请先在这里填写密码。</p>
        <form className="registry29-encrypted" aria-label="加密备份" onSubmit={(event) => { event.preventDefault(); if (passwordReady) void onExportEncrypted(backupPassword) }}>
          <input className="sr-only" name="username" autoComplete="username" value="memento-local" readOnly tabIndex={-1} aria-hidden="true" />
          <label>备份密码 <small>加密导出或导入时使用</small><input name="backupPassword" autoComplete="new-password" type="password" minLength={8} value={backupPassword} onChange={(event) => onBackupPasswordChange(event.target.value)} placeholder="至少 8 个字符" /></label>
          <button type="submit" className="registry29-secondary" disabled={!passwordReady}><KeyRound size={15} />导出加密备份</button>
        </form>
        <p className="registry29-microcopy">请妥善保管密码；忘记密码后，将无法打开这份加密备份。</p>
      </section>
      {recoveryAvailable && <section className="registry42-recovery-group" aria-labelledby="backup-recovery-title">
        <h3 id="backup-recovery-title">恢复之前的时间册</h3>
        <p className="registry29-recovery" role="status">这里有一份替换导入或清空前的本地恢复快照。</p>
        <button className="registry29-secondary" onClick={onRestoreSnapshot}><ArrowUpFromLine size={15} />恢复快照</button>
      </section>}
      <section className="registry42-danger-zone" aria-labelledby="backup-reset-title">
        <div><h3 id="backup-reset-title">清空这本时间册</h3><p className="registry29-microcopy">清空前会自动保留一份本地快照。也可以先导出备份，保存在其他位置。</p></div>
        <button className="registry29-secondary registry29-danger" onClick={() => { if (window.confirm('清空后会删除当前时间册里的所有记录、照片、每日一行和旁白历史，但会先保留一份可恢复快照。确定继续吗？')) void onResetData() }}>清空全部数据</button>
      </section>
    </section>}
    {section === 'life' && <section className="registry29-section">
      <div className="registry29-section-head"><div><span>LIFE / 02</span><h2>人生进度</h2></div><Layers3 size={18} /></div>
      <p className="registry29-note">填写生日、选择一个预期年限并开启显示后，“几度”的刻度里会出现人生进度。它只是一条由你设定的时间参照。</p>
      <label className="registry29-toggle"><input type="checkbox" checked={state.settings.displayLifeProgress} onChange={(event) => onLifeProfileChange({ displayLifeProgress: event.target.checked })} /><span>显示人生进度</span></label>
      <div className="registry29-fields">
        <label>生日<input type="date" value={state.settings.birthDate ?? ''} onChange={(event) => onLifeProfileChange({ birthDate: event.target.value })} /></label>
        <div className="registry42-life-years">
          <label htmlFor="life-expectancy-years">预期年限</label>
          <input id="life-expectancy-years" type="number" min="1" max="150" step="1" value={lifeYearsDraft} aria-invalid={Boolean(lifeYearsError)} aria-describedby={lifeYearsError ? 'life-years-hint life-years-error' : 'life-years-hint'} onChange={(event) => { setLifeYearsDraft(event.target.value); setLifeYearsError(null) }} onBlur={commitLifeYears} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitLifeYears() } }} />
          <p id="life-years-hint" className="registry29-microcopy">1–150 年，离开输入框或按 Enter 保存。</p>
          {lifeYearsError && <p id="life-years-error" className="registry42-field-error" role="alert">{lifeYearsError}</p>}
        </div>
      </div>
    </section>}
    {section === 'appearance' && <section className="registry29-section"><div className="registry29-section-head"><div><span>READING / 03</span><h2>阅读外观</h2></div><Sparkles size={18} /></div><p className="registry29-note">四个页面拥有不同的观看方式；这里调整阅读条件，不会改变页面身份。</p><div className="registry29-fields registry29-fields--three"><label>阅读光线<select value={state.settings.theme ?? 'light'} onChange={(event) => onAppearanceChange({ theme: event.target.value as ThemeMode })}><option value="light">浅色</option><option value="dark">深色</option><option value="high-contrast">高对比</option></select></label><label>阅读习惯<select value={state.settings.displayDensity ?? 'comfortable'} onChange={(event) => onAppearanceChange({ displayDensity: event.target.value as DisplayDensity })}><option value="comfortable">舒适</option><option value="compact">紧凑</option></select></label><label>数字显示<select value={state.settings.numberFormat ?? 'plain'} onChange={(event) => onAppearanceChange({ numberFormat: event.target.value as NumberFormat })}><option value="plain">不分组</option><option value="grouped">千位分组</option></select></label></div></section>}
    {section === 'library' && <section className="registry29-section registry29-copy-source"><div className="registry29-section-head"><div><span>NARRATION / 04</span><h2>文案来源</h2></div><BookOpen size={18} /></div><p className="registry29-note">今日旁白来自随软件打包的本地只读文案库。运行时不请求网络，旁白不会进入正式时光轴或人生统计。</p><div className="registry29-source-count"><strong>{COPY_LIBRARY.length}</strong><span>条可轮换旁白 · 当前已使用 {state.narrationUses.length} 条</span></div><ul className="registry29-source-list"><li><a href="https://huggingface.co/datasets/gujilab/chinese-classical-corpus" target="_blank" rel="noreferrer">gujilab / chinese-classical-corpus</a><span>CC0</span><small>中文古典语料输出；用于中文原文条目。</small></li><li><a href="https://www.gutenberg.org/policy/license" target="_blank" rel="noreferrer">Project Gutenberg public-domain works</a><span>Public domain</span><small>外文原文及作品出处；中文译文为 Memento 编译译文。</small></li><li><a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">Creative Commons CC0 1.0</a><span>License</span><small>中文语料输出的再利用许可说明。</small></li></ul><label className="registry29-source-toggle"><input type="checkbox" checked={state.settings.dailyNarrationEnabled !== false} onChange={(event) => onNarrationEnabledChange(event.target.checked)} /><span>每天自动展示一条未使用的旁白</span></label></section>}
    {section === 'about' && <section className="registry29-section registry29-about"><div className="registry29-section-head"><div><span>MEMENTO / 05</span><h2>几度 · Memento</h2></div><Sparkles size={18} /></div><p className="registry29-note">v{APP_VERSION} · 本地优先 · 无账号 · 无云端。你的时间只属于你。</p></section>}
    </section></div></div></CreativeWorld>
}
