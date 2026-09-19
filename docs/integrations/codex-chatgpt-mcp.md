# Подключение Memora MCP к Codex и ChatGPT

## Что уже работает

Локальный `@memora/mcp` — это стандартный MCP server по STDIO. Он доступен
Codex CLI, IDE и desktop ChatGPT на том же компьютере. Он умеет перечислять
типы документов, принимать явно выбранный файл из staging root, создавать
opaque handle, показывать workspace, запускать review workflow и проверять
redacted fixture mapping при включённом test scope.

Текущий extractor намеренно отвечает `manual-only`: OCR provider ещё не
provisioned. Это позволяет проверить transport, scopes и приватность, но не
создаёт ложного впечатления, что паспорт уже распознан.

## Локальный запуск

```powershell
npm run build --workspace=@memora/mcp
$env:MEMORA_ACTOR_ID = "local-codex"
$env:MEMORA_VAULT_ID = "local-vault"
$env:MEMORA_STAGING_ROOT = "C:\\Users\\<user>\\MemoraStaging"
$env:MEMORA_ALLOW_CONFIRM = "0"
$env:MEMORA_ALLOW_FIXTURES = "1"
```

В staging root помещается только файл, который пользователь действительно
выбрал для проверки. MCP не принимает произвольный путь за пределами этого
каталога и не возвращает путь/bytes в результате.

## Codex CLI

Для одноразовой настройки:

```powershell
codex mcp add memora -- npx --no-install tsx C:\\dev\\pet-projects\\memora\\apps\\mcp\\dist\\server.js
codex mcp list
```

Команда наследует `MEMORA_*` из окружения. Если нужно явно ограничить policy,
добавьте в `~/.codex/config.toml` (или доверенный проектный `.codex/config.toml`):

```toml
[mcp_servers.memora]
command = "npx"
args = ["--no-install", "tsx", "C:/dev/pet-projects/memora/apps/mcp/dist/server.js"]
env_vars = ["MEMORA_ACTOR_ID", "MEMORA_VAULT_ID", "MEMORA_STAGING_ROOT", "MEMORA_ALLOW_CONFIRM", "MEMORA_ALLOW_FIXTURES"]
default_tools_approval_mode = "writes"
enabled_tools = [
  "memora_document_list_types",
  "memora_document_stage_local_file",
  "memora_document_get_workspace",
  "memora_document_run_extraction",
  "memora_document_verify_fixture",
  "memora_document_create_confirmation",
  "memora_document_confirm_fields"
]
```

Для интерактивной проверки в TUI используется `/mcp`.

## Desktop ChatGPT

В desktop ChatGPT откройте Settings → MCP Servers → Add server, выберите STDIO,
укажите команду `npx` с аргументами `--no-install tsx` и путь к
`apps/mcp/dist/server.js`, добавьте `MEMORA_*` variables и перезапустите
приложение. В редакторе `/mcp` показывает активные серверы.

## ChatGPT в браузере

Веб‑ChatGPT не читает локальный `config.toml` и не подключается к локальному
STDIO напрямую. Для него нужен отдельный HTTPS Streamable HTTP endpoint с
OAuth/короткоживущим bearer token либо Secure MCP Tunnel. Этот endpoint ещё не
публикуется: сначала нужны remote auth, rate limits, retention и signed-in
transport smoke tests. Он никогда не будет принимать `localPath`; вместо этого
Web upload выдаёт одноразовый `stagedAssetHandle`.

## Рабочая последовательность проверки

1. Вызвать `memora_document_list_types`.
2. Явно выбрать тестовый или пользовательский файл в staging root.
3. Вызвать `memora_document_stage_local_file` с типом документа.
4. Вызвать `memora_document_run_extraction` и показать draft/confidence/evidence.
5. Для synthetic/redacted набора вызвать `memora_document_verify_fixture`;
   tool доступен только при `MEMORA_ALLOW_FIXTURES=1` и ничего не записывает.
6. Исправить поля в UI/диффе и только после явного подтверждения пользователя
   вызвать `memora_document_create_confirmation`, затем `confirm_fields`.

Подтверждение не включается автоматически: `MEMORA_ALLOW_CONFIRM=0` оставляет
write tool без capability, а Codex policy по умолчанию использует approval
`writes`.

## Официальные ссылки

- [MCP в Codex: STDIO, Streamable HTTP и config.toml](https://developers.openai.com/es-419/docs/extend/mcp?surface=cli)
- [Создание MCP server для Plugins](https://developers.openai.com/plugins/build/mcp-server)
- [Developer mode и MCP apps в ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
