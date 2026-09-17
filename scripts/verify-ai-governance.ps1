[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$errors = [System.Collections.Generic.List[string]]::new()

$requiredFiles = @(
    'AGENTS.md'
    'docs/ai/WORKFLOW.md'
    'docs/ai/TASK_PACKET.md'
    'docs/ai/MODEL_ROUTING.md'
    'docs/ai/QUALITY_GATES.md'
    'docs/ai/ARCHITECTURE_GUARDRAILS.md'
    'docs/ai/SECURITY_AND_PRIVACY.md'
    'docs/ai/UI_AND_MOTION.md'
    'docs/ai/DEFINITION_OF_DONE.md'
    'docs/ai/COMMIT_CONVENTIONS.md'
    'docs/superpowers/specs/2026-09-18-ai-engineering-system-design.md'
    'docs/superpowers/plans/2026-09-18-ai-engineering-system.md'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $relativePath -PathType Leaf)) {
        $errors.Add("Missing required file: $relativePath")
    }
}

$requiredHeadings = @{
    'AGENTS.md' = @('## 1. Начало каждой задачи', '## 6. Completion gate', '## 8. Stop conditions')
    'docs/ai/MODEL_ROUTING.md' = @('## Luna gate', '## Review результата Luna')
    'docs/ai/WORKFLOW.md' = @('## RED', '## Direct-main commit и push')
    'docs/ai/TASK_PACKET.md' = @('## Acceptance criteria', '## TDD evidence')
    'docs/ai/QUALITY_GATES.md' = @('## Gates по типу изменения', '## Baseline красный')
    'docs/ai/DEFINITION_OF_DONE.md' = @('## Correctness', '## Delivery')
    'docs/ai/COMMIT_CONVENTIONS.md' = @('## Русское описание', '## Breaking changes')
}

foreach ($entry in $requiredHeadings.GetEnumerator()) {
    if (-not (Test-Path -LiteralPath $entry.Key -PathType Leaf)) {
        continue
    }

    $content = Get-Content -Raw -LiteralPath $entry.Key
    foreach ($heading in $entry.Value) {
        if (-not $content.Contains($heading)) {
            $errors.Add("Missing heading '$heading' in $($entry.Key)")
        }
    }
}

$placeholderParts = @(
    '\bTO' + 'DO\b'
    '\bTB' + 'D\b'
    'implement' + '\s+later'
    'fill' + '\s+in'
    'appropriate' + '\s+tests'
    'as' + '\s+needed'
)
$placeholderPattern = '(?i)(' + ($placeholderParts -join '|') + ')'

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $relativePath -PathType Leaf)) {
        continue
    }

    $matches = Select-String -LiteralPath $relativePath -Pattern $placeholderPattern
    foreach ($match in $matches) {
        $errors.Add("Placeholder in $relativePath`:$($match.LineNumber): $($match.Line.Trim())")
    }
}

$markdownFiles = @('README.md') + $requiredFiles
$linkPattern = '\[[^\]]+\]\(([^)]+)\)'

foreach ($relativePath in $markdownFiles | Select-Object -Unique) {
    if (-not (Test-Path -LiteralPath $relativePath -PathType Leaf)) {
        continue
    }

    $content = Get-Content -Raw -LiteralPath $relativePath
    foreach ($match in [regex]::Matches($content, $linkPattern)) {
        $target = $match.Groups[1].Value.Trim()
        if ($target -match '^(https?://|mailto:|#)') {
            continue
        }

        $targetPath = ($target -split '#', 2)[0]
        if ([string]::IsNullOrWhiteSpace($targetPath)) {
            continue
        }

        $targetPath = [System.Uri]::UnescapeDataString($targetPath)
        $sourceDirectory = Split-Path -Parent (Join-Path $repoRoot $relativePath)
        $resolvedTarget = Join-Path $sourceDirectory $targetPath
        if (-not (Test-Path -LiteralPath $resolvedTarget)) {
            $errors.Add("Broken local link in $relativePath`: $target")
        }
    }
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$diffCheckOutput = & git diff --check 2>&1
$diffCheckExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($diffCheckExitCode -ne 0) {
    $errors.Add("git diff --check failed:`n$($diffCheckOutput -join "`n")")
}

if ($errors.Count -gt 0) {
    Write-Error ("AI governance verification failed ({0} issue(s)):`n- {1}" -f $errors.Count, ($errors -join "`n- "))
    exit 1
}

Write-Output 'AI governance verification passed.'
exit 0
