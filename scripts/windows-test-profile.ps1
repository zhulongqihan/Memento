$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
  throw 'Native release verification only runs in a disposable GitHub hosted Windows VM.'
}
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MementoKnownFolder {
  [DllImport("shell32.dll")]
  private static extern int SHGetKnownFolderPath(ref Guid id, uint flags, IntPtr token, out IntPtr path);
  public static string Roaming() {
    Guid id = new Guid("3EB685DB-65F9-4CF6-A03A-E3EF65729F3D");
    IntPtr path;
    int code = SHGetKnownFolderPath(ref id, 0, IntPtr.Zero, out path);
    if (code != 0) Marshal.ThrowExceptionForHR(code);
    try { return Marshal.PtrToStringUni(path); }
    finally { Marshal.FreeCoTaskMem(path); }
  }
}
'@
$roaming = [MementoKnownFolder]::Roaming()
$profile = [IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\')
if (-not $roaming.StartsWith($profile + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Known Folder does not belong to the hosted runner profile.'
}
[pscustomobject]@{
  identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  profile = $profile
  knownFolder = $roaming
  runnerEnvironment = $env:RUNNER_ENVIRONMENT
  runId = $env:GITHUB_RUN_ID
} | ConvertTo-Json -Compress
