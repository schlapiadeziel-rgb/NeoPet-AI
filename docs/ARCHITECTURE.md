# NeoPet AI architecture

NeoPet separates orchestration from replaceable providers. The renderer owns presentation and microphone capture; the main process exposes a narrow IPC contract. `ai.js` handles OpenAI-compatible chat, `runtime.js` handles local process adapters, `companion.js` owns memory rules, and `store.js` owns persistence. No provider imports another provider.

Data flows from bounded microphone capture to Whisper STT, then to the selected chat endpoint with bounded context, then to the pet action envelope and selected TTS provider. The Ollama preset uses `http://127.0.0.1:11434/v1` with `gemma3:1b`.

Provider contracts are deliberately small: `transcribe(bytes) -> text`, `chat(messages, context) -> envelope`, `speak(text) -> completion`, and `advanceCompanion(state, interaction) -> state`. Kokoro can therefore be added without changing chat, memory or animation.

The mobile web app shares the chat/context boundary. A phone may use a reachable LAN Ollama server; phone `localhost` is not the PC and native on-device inference needs a platform adapter.
