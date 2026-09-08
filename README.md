# NeoPet AI

NeoPet AI now has two purpose-built surfaces: a Windows AI desktop pet and the NeoAI Android/mobile assistant. Windows retains its original animated pets, care, memory and transparent always-on-top mode. Mobile is a conversation-first workbench with files, voice, phone tools and user-confirmed cross-app assistance.

Both surfaces accept freely configurable OpenAI-compatible APIs and LAN model servers. The Android app also includes an arm64 llama.cpp runtime and an in-app model catalog: users choose a GGUF model, download it into app-private storage and run it without Ollama or an API key. The browser/PWA build keeps API and LAN modes because web sandboxes cannot load the bundled Android runtime.

Windows also supports a modular offline runtime: Whisper Tiny STT, Ollama with Gemma 3 1B, and pyttsx3 TTS, with a reserved Kokoro provider boundary.

[完整中文说明](README_CN.md)
