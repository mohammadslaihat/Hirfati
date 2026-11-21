# Builds the Lambda package: installs dependencies with the official Lambda image, then adds handler.py
$ErrorActionPreference = "Stop"
$here  = $PSScriptRoot
$build = Join-Path $here "build"
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory $build | Out-Null

docker run --rm --platform linux/amd64 -v "${here}:/work" --entrypoint pip `
  public.ecr.aws/lambda/python:3.12 install -r /work/monitor/requirements.txt -t /work/build --no-cache-dir
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }

Copy-Item (Join-Path $here "monitor\handler.py") $build
Write-Host "Lambda build ready:"
Get-ChildItem $build -Name
