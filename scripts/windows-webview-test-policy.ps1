param(
  [ValidateSet('Configure', 'Restore')][string]$Mode,
  [string]$Executable,
  [string]$UserDataFolder,
  [Parameter(Mandatory = $true)][string]$StateFile
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
  throw 'WebView test policy is limited to a disposable GitHub hosted Windows VM.'
}
$workspace = [IO.Path]::GetFullPath($env:GITHUB_WORKSPACE).TrimEnd('\') + '\'
$temporary = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\') + '\'
if (-not [IO.Path]::GetFullPath($StateFile).StartsWith($workspace, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Policy snapshot must stay in the CI workspace.'
}
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  if ($Mode -eq 'Restore' -and (Test-Path -LiteralPath $StateFile)) { throw 'Cannot restore an elevated policy snapshot.' }
  return # Non-elevated WebView2 honors the per-process environment variables.
}
$saved = @()
if (Test-Path -LiteralPath $StateFile) { $saved = @(Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json) }
$prefix = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2\'
$names = @('memento.exe', 'Memento-4.0.0-portable.exe')
foreach ($entry in $saved) {
  if ($entry.Path -notin @(($prefix + 'AdditionalBrowserArguments'), ($prefix + 'UserDataFolder')) -or $entry.Name -notin $names) {
    throw 'Unexpected policy entry in the test snapshot.'
  }
}
if ($Mode -eq 'Restore') {
  foreach ($entry in $saved) {
    if ($entry.Existed) {
      New-ItemProperty -LiteralPath $entry.Path -Name $entry.Name -Value $entry.Value -PropertyType $entry.Kind -Force | Out-Null
    } elseif (Test-Path -LiteralPath $entry.Path) {
      Remove-ItemProperty -LiteralPath $entry.Path -Name $entry.Name -ErrorAction SilentlyContinue
    }
  }
  return
}
$exe = [IO.Path]::GetFullPath($Executable)
$name = [IO.Path]::GetFileName($exe)
if ($name -notin $names -or (-not $exe.StartsWith($workspace, [StringComparison]::OrdinalIgnoreCase) -and -not $exe.StartsWith($temporary, [StringComparison]::OrdinalIgnoreCase))) {
  throw 'Only the exact CI test executable names and paths are allowed.'
}
$folder = [IO.Path]::GetFullPath($UserDataFolder)
if (-not $folder.StartsWith($temporary, [StringComparison]::OrdinalIgnoreCase)) { throw 'WebView profile must stay in RUNNER_TEMP.' }
# Runtime 150+ ignores environment overrides from elevated hosts. Use the
# documented machine policy, scoped to our test exe names, then restore it.
# https://github.com/MicrosoftEdge/WebView2Feedback/issues/5645
foreach ($setting in @(
  @{ Key = 'AdditionalBrowserArguments'; Value = '--remote-debugging-port=9225' },
  @{ Key = 'UserDataFolder'; Value = $folder }
)) {
  $path = $prefix + $setting.Key
  if (-not ($saved | Where-Object { $_.Path -eq $path -and $_.Name -eq $name })) {
    $key = Get-Item -LiteralPath $path -ErrorAction SilentlyContinue
    $existed = $null -ne $key -and $key.GetValueNames() -contains $name
    $saved += [pscustomobject]@{
      Path = $path; Name = $name; Existed = $existed
      Value = $(if ($existed) { $key.GetValue($name) } else { $null })
      Kind = $(if ($existed) { $key.GetValueKind($name).ToString() } else { 'String' })
    }
    ConvertTo-Json -InputObject $saved -Depth 4 | Set-Content -LiteralPath $StateFile -Encoding UTF8
  }
  New-Item -Path $path -Force | Out-Null
  New-ItemProperty -LiteralPath $path -Name $name -Value $setting.Value -PropertyType String -Force | Out-Null
}
