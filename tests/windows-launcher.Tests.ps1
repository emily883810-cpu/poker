param([Parameter(Mandatory=$true)][string] $PythonPath)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Tokens = $null
$ParseErrors = $null
$Ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $ProjectRoot 'start-windows.ps1'), [ref]$Tokens, [ref]$ParseErrors)
if ($ParseErrors.Count -gt 0) { throw ($ParseErrors | Out-String) }
foreach ($Definition in $Ast.FindAll({param($Node) $Node -is [System.Management.Automation.Language.FunctionDefinitionAst]}, $true)) {
    Invoke-Expression $Definition.Extent.Text
}
$TestFolder = Join-Path ([System.IO.Path]::GetTempPath()) ('Poker OS spaces & ' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $TestFolder | Out-Null
try {
    $Bootstrap = Join-Path $TestFolder 'windows_bootstrap.py'
    Copy-Item -LiteralPath (Join-Path $ProjectRoot 'windows_bootstrap.py') -Destination $Bootstrap
    $WarningScript = Join-Path $TestFolder 'warning probe.py'
    [System.IO.File]::WriteAllText($WarningScript, "import sys`nsys.stderr.write('warning only\n')`nsys.exit(0)`n")
    foreach ($Mode in @('Legacy', 'Standard')) {
        $PSNativeCommandArgumentPassing = $Mode
        if (-not (Test-Dependencies $PythonPath)) { throw ('Installed dependency probe failed in ' + $Mode) }
        Invoke-SetupCommand $PythonPath @($Bootstrap, '--python-path')
        # Native stderr alone must not stop a successful installation command.
        Invoke-SetupCommand $PythonPath @($WarningScript)
        $FailureDetected = $false
        try { Invoke-SetupCommand $PythonPath @('-S', $Bootstrap, '--dependencies') } catch { $FailureDetected = $true }
        if (-not $FailureDetected) { throw ('Nonzero exit was lost in ' + $Mode) }
        Write-Host ('PASS: ' + $Mode + ' file probes, spaces, stderr warning, nonzero exit handling')
    }
    Write-Host 'PASS: launcher PowerShell syntax'
} finally {
    Remove-Item -LiteralPath $TestFolder -Recurse -Force
}
