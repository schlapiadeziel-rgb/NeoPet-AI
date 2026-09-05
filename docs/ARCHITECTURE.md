# NeoPet AI architecture

NeoPet separates orchestration from replaceable providers. The renderer owns presentation and microphone capture; the main process exposes a narrow IPC contract. `ai.js` handles OpenAI-compatible chat, `providers.js` owns endpoint presets and model discovery, `runtime.js` handles local process adapters, and `store.js` owns persistence. Pure domain modules under `src/shared` own care, continuous emotion, achievements, memory and response parsing. No provider imports another provider.

Data flows from bounded microphone capture to Whisper STT, then to the selected chat endpoint with bounded context, then to the pet action envelope and selected TTS provider. The Ollama preset uses `http://127.0.0.1:11434/v1` with `gemma3:1b`.

Provider contracts are deliberately small: `listModels(endpoint) -> names`, `transcribe(bytes) -> text`, `chat(messages, context) -> envelope`, `speak(text) -> completion`, and `advanceCompanion(state, interaction) -> state`. Kokoro or another local engine can therefore be added without changing chat, memory or animation.

The living-pet loop is data-driven. Care values decay with elapsed wall time, the two-axis emotion engine derives valence/arousal and a named mood, interaction events push that state, and the renderer chooses idle/sleep/curious motions from the result. Achievement counters are separate from care and companion memory, so rewards never become a dependency of AI chat.

Desktop presentation has two shells over the same pet state: a full chat/control surface and a transparent compact pet with a small HUD and context menu. Mobile is a separate NeoAI conversation workbench; it does not ship the desktop pet renderer or pet assets. Original NeoPet characters remain on desktop and independent from reference projects.

The mobile web app shares the chat/context boundary and supports OpenAI-compatible APIs or reachable LAN model servers. The Android shell adds a bundled arm64 llama.cpp runtime, app-private GGUF downloads and a serialized native inference adapter. Model weights are chosen and downloaded by the user rather than bundled in the APK. Cross-app actions pass through a confirmation card, a narrow native intent allowlist and an optional AccessibilityService that stops on password, OTP, banking and payment screens.
