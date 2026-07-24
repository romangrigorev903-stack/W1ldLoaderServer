$urlFile = Join-Path $PSScriptRoot "tunnel-url.txt"
$logFile = Join-Path $PSScriptRoot "tunnel_output.txt"

Remove-Item $urlFile -Force -ErrorAction SilentlyContinue
Remove-Item $logFile -Force -ErrorAction SilentlyContinue

Write-Host "Starting NPort tunnel..."
Write-Host "URL will be saved to: tunnel-url.txt"
Write-Host ""

# Try different subdomains if first one is taken
$subdomains = @("w1ldmc", "w1ldlauncher", "w1ldserver", "w1ld-auth", "w1ld-mc")

foreach ($subdomain in $subdomains) {
    Write-Host "Trying subdomain: $subdomain" -ForegroundColor Yellow
    
    $process = Start-Process -FilePath "nport" -ArgumentList "3000 -s $subdomain" -NoNewWindow -PassThru -RedirectStandardOutput "$PSScriptRoot\nport_output.txt" -RedirectStandardError "$PSScriptRoot\nport_error.txt"
    
    # Wait for NPort to start
    Start-Sleep -Seconds 5
    
    # Check if tunnel is working
    try {
        $url = "https://$subdomain.nport.link"
        $r = Invoke-WebRequest -Uri "$url/api/login" -Method POST -ContentType 'application/json' -Body '{"username":"test","password":"test"}' -UseBasicParsing -ErrorAction Stop -TimeoutSec 5
        
        if ($r.StatusCode -eq 200) {
            $url | Out-File $urlFile -Force -Encoding UTF8
            Write-Host "`n[SUCCESS] Tunnel URL: $url`n" -ForegroundColor Green
            Write-Host "Press Ctrl+C to stop tunnel..."
            
            # Keep process running
            $process.WaitForExit()
            break
        }
    } catch {
        Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
        
        # Kill process and try next
        $process.Kill()
        Start-Sleep -Seconds 1
    }
}

Write-Host "`nTunnel stopped." -ForegroundColor Yellow