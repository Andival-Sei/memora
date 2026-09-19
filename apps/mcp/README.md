# Memora STDIO MCP

Локальный server предоставляет Codex и desktop ChatGPT только capability-scoped
tools. Он принимает файл из `MEMORA_STAGING_ROOT`, возвращает opaque handle и не
возвращает путь, private URL или bytes. При включённом test scope он также
проверяет redacted fixture mapping. По умолчанию extraction помечен
`manual-only`, потому что OCR provider ещё не provisioned.

Сборка и запуск:

```powershell
npm run build --workspace=@memora/mcp
$env:MEMORA_ACTOR_ID = "local-codex"
$env:MEMORA_VAULT_ID = "local-vault"
$env:MEMORA_STAGING_ROOT = "C:\\Users\\<user>\\MemoraStaging"
npx --no-install tsx .\\apps\\mcp\\dist\\server.js
```

Подключение к Codex/desktop ChatGPT описано в
`docs/integrations/codex-chatgpt-mcp.md`. Для браузерного ChatGPT этот локальный
STDIO процесс не подходит: нужен remote Streamable HTTP или Secure MCP Tunnel.
