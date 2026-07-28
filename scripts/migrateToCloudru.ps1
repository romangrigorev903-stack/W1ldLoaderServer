param(
    [string]$Bucket = 'w1ld-auth-7ims-280726',
    [string]$Endpoint = 'https://s3.cloud.ru',
    [string]$Region = 'ru-central-1',
    [string]$TenantId = '25076bed-0732-43a1-8a5c-06f951902140'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Read-CloudruCredentials {
    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName System.Windows.Forms

    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Cloud.ru Object Storage credentials'
    $form.ClientSize = New-Object System.Drawing.Size(520, 190)
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $form.TopMost = $true

    $idLabel = New-Object System.Windows.Forms.Label
    $idLabel.Text = 'Key ID'
    $idLabel.Location = New-Object System.Drawing.Point(20, 22)
    $idLabel.AutoSize = $true
    $form.Controls.Add($idLabel)

    $idInput = New-Object System.Windows.Forms.TextBox
    $idInput.Location = New-Object System.Drawing.Point(20, 45)
    $idInput.Size = New-Object System.Drawing.Size(480, 24)
    $form.Controls.Add($idInput)

    $secretLabel = New-Object System.Windows.Forms.Label
    $secretLabel.Text = 'Key Secret'
    $secretLabel.Location = New-Object System.Drawing.Point(20, 82)
    $secretLabel.AutoSize = $true
    $form.Controls.Add($secretLabel)

    $secretInput = New-Object System.Windows.Forms.TextBox
    $secretInput.Location = New-Object System.Drawing.Point(20, 105)
    $secretInput.Size = New-Object System.Drawing.Size(480, 24)
    $secretInput.UseSystemPasswordChar = $true
    $form.Controls.Add($secretInput)

    $okButton = New-Object System.Windows.Forms.Button
    $okButton.Text = 'Continue'
    $okButton.Location = New-Object System.Drawing.Point(400, 145)
    $okButton.Size = New-Object System.Drawing.Size(100, 30)
    $okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.AcceptButton = $okButton
    $form.Controls.Add($okButton)

    if ($form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        $form.Dispose()
        throw 'Credential input was cancelled'
    }

    $credentials = [PSCustomObject]@{
        AccessKey = $idInput.Text.Trim()
        SecretKey = $secretInput.Text.Trim()
    }
    $secretInput.Clear()
    $form.Dispose()
    return $credentials
}

try {
    if ([string]::IsNullOrWhiteSpace($TenantId)) {
        $TenantId = Read-Host 'Cloud.ru Object Storage tenant ID'
    }
    if ([string]::IsNullOrWhiteSpace($TenantId)) {
        throw 'Tenant ID is required'
    }

    $credentials = Read-CloudruCredentials
    $accessKey = $credentials.AccessKey
    if ([string]::IsNullOrWhiteSpace($accessKey)) {
        throw 'Key ID is required'
    }

    $secretKey = $credentials.SecretKey
    if ([string]::IsNullOrWhiteSpace($secretKey)) {
        throw 'Key Secret is required'
    }
    if ($secretKey -notmatch '^[0-9a-fA-F]{32}$') {
        throw 'Key Secret must be the exact 32-character value copied from Cloud.ru'
    }

    $env:S3_ENDPOINT = $Endpoint
    $env:S3_REGION = $Region
    $env:S3_BUCKET = $Bucket
    $rawAccessKey = $accessKey.Trim()
    $env:S3_ACCESS_KEY_ID = "$($TenantId.Trim()):$rawAccessKey"
    $env:S3_SECRET_ACCESS_KEY = $secretKey
    $env:S3_CLIENTS_PREFIX = 'clients/'
    $env:S3_DATABASE_PREFIX = 'database/'
    $env:S3_FORCE_PATH_STYLE = 'true'
    $env:REQUIRE_S3 = 'true'

    Push-Location $repoRoot
    try {
        Write-Host 'Checking S3 credentials with tenant_id:key_id...'
        & node.exe (Join-Path $PSScriptRoot 'checkS3Access.js')
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Checking the alternate tenant_id.key_id format...'
            $env:S3_ACCESS_KEY_ID = "$($TenantId.Trim()).$rawAccessKey"
            & node.exe (Join-Path $PSScriptRoot 'checkS3Access.js')
        }
        if ($LASTEXITCODE -ne 0) {
            throw 'Neither supported access key format was accepted. The Key ID and Key Secret do not match.'
        }

        Write-Host 'Uploading client files to Cloud.ru Object Storage...'
        & npm.cmd run migrate:clients:s3
        if ($LASTEXITCODE -ne 0) {
            throw "Client migration failed with exit code $LASTEXITCODE"
        }

        Write-Host 'Uploading the SQLite database to Cloud.ru Object Storage...'
        & (Join-Path $PSScriptRoot 'migrateDatabaseToS3.ps1')
        if ($LASTEXITCODE -ne 0) {
            throw "Database migration failed with exit code $LASTEXITCODE"
        }

        Write-Host 'Cloud.ru migration completed successfully.' -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
finally {
    foreach ($name in @(
        'S3_ENDPOINT',
        'S3_REGION',
        'S3_BUCKET',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
        'S3_CLIENTS_PREFIX',
        'S3_DATABASE_PREFIX',
        'S3_FORCE_PATH_STYLE',
        'REQUIRE_S3'
    )) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }

    $credentials = $null
    $secretKey = $null
}
