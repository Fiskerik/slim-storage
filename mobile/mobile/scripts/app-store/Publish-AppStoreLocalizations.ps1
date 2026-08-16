[CmdletBinding(DefaultParameterSetName = "Preview")]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [string]$MetadataPath = ".\app-store-metadata.json",

    [Parameter(ParameterSetName = "Preview")]
    [switch]$Preview,

    [Parameter(Mandatory = $true, ParameterSetName = "Apply")]
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")
$resolvedMetadata = if ([System.IO.Path]::IsPathRooted($MetadataPath)) {
    Resolve-Path -LiteralPath $MetadataPath
} else {
    Resolve-Path -LiteralPath (Join-Path (Get-Location) $MetadataPath)
}
$uploader = Join-Path $PSScriptRoot "app-store-connect.mjs"
$command = if ($Apply) { "upload" } else { "preview" }

if ($Apply) {
    $missing = @("ASC_ISSUER_ID", "ASC_KEY_ID") | Where-Object { -not [Environment]::GetEnvironmentVariable($_) }
    if (-not $env:ASC_PRIVATE_KEY -and -not $env:ASC_PRIVATE_KEY_PATH) {
        $missing += "ASC_PRIVATE_KEY_PATH or ASC_PRIVATE_KEY"
    }
    if ($missing.Count -gt 0) {
        throw "Missing App Store Connect credentials: $($missing -join ', ')"
    }
    Write-Host "Uploading localized listing metadata for iOS $Version..." -ForegroundColor Yellow
} else {
    Write-Host "Previewing localized listing metadata for iOS $Version..." -ForegroundColor Cyan
}

Push-Location $projectRoot
try {
    & node $uploader $command --metadata $resolvedMetadata.Path --version $Version
    if ($LASTEXITCODE -ne 0) { throw "App Store localization command failed with exit code $LASTEXITCODE." }
} finally {
    Pop-Location
}
