# Security

- Renderer isolation and sandboxing are enabled; Node integration is disabled.
- IPC exposes named operations, not arbitrary commands or filesystem access.
- Local commands use argument arrays with `shell: false`; inputs are bounded and processes time out.
- API keys use Electron `safeStorage` and are excluded from memory backups.
- Transcription files use a random temporary directory and are removed in `finally`.
- The Ollama preset uses loopback. Users exposing Ollama to a LAN must secure that network.
- Download runtime files only from official whisper.cpp releases and the official converted-model repository.

Do not include API keys, recordings or memory backups in public issues.
