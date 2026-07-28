param(
    [string]$DatabasePath = (Join-Path $PSScriptRoot '..\w1ld_auth.db')
)

$ErrorActionPreference = 'Stop'
$version = '0.5.15'

foreach ($name in 'S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY') {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "Environment variable $name is required"
    }
}

$database = (Resolve-Path -LiteralPath $DatabasePath).Path
$toolDir = Join-Path $env:LOCALAPPDATA "W1ldTools\litestream-$version"
$exe = Join-Path $toolDir 'litestream.exe'

if (-not (Test-Path -LiteralPath $exe)) {
    New-Item -ItemType Directory -Path $toolDir -Force | Out-Null
    $zip = Join-Path $toolDir 'litestream.zip'
    $url = "https://github.com/benbjohnson/litestream/releases/download/v$version/litestream-$version-windows-x86_64.zip"
    curl.exe -L --fail --silent --show-error -o $zip $url
    Expand-Archive -LiteralPath $zip -DestinationPath $toolDir -Force
}

$prefixValue = $env:S3_DATABASE_PREFIX
if ([string]::IsNullOrWhiteSpace($prefixValue)) {
    $prefixValue = 'database/'
}
$prefix = $prefixValue.Trim('/')
$remotePath = if ($prefix) { "$prefix/w1ld_auth.db" } else { 'w1ld_auth.db' }
$endpoint = [Uri]::EscapeDataString($env:S3_ENDPOINT)
$region = [Uri]::EscapeDataString($env:S3_REGION)
$forcePathStyle = if ($env:S3_FORCE_PATH_STYLE -match '^(0|false|no)$') { 'false' } else { 'true' }
$replica = "s3://$($env:S3_BUCKET)/$remotePath`?endpoint=$endpoint&region=$region&forcePathStyle=$forcePathStyle"

$env:LITESTREAM_ACCESS_KEY_ID = $env:S3_ACCESS_KEY_ID
$env:LITESTREAM_SECRET_ACCESS_KEY = $env:S3_SECRET_ACCESS_KEY

Write-Host "Uploading an initial SQLite snapshot to s3://$($env:S3_BUCKET)/$remotePath"
& $exe replicate -once -force-snapshot $database $replica
if ($LASTEXITCODE -ne 0) {
    throw "Litestream migration failed with exit code $LASTEXITCODE"
}
