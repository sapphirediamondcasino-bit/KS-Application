# Fix roblox/utils path

Write-Host "Fixing roblox/utils paths..." -ForegroundColor Cyan

$files = Get-ChildItem -Path "discord" -Recurse -Filter "*.js"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Fix roblox/utils paths (should be ../../roblox/utils from discord subfolders)
    if ($content -match "\.\.\/\.\.\/\.\.\/roblox\/utils\/") {
        $content = $content -replace "require\(['\`"]\.\.\/\.\.\/\.\.\/roblox\/utils\/([^'\`"]+)['\`"]\)", "require('../../roblox/utils/`$1')"
        
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Fixed: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "`nRun: node index.js" -ForegroundColor White