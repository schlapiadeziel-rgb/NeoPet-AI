# Performance

- Microphone clips stop after 20 seconds and are rejected above 25 MB.
- Whisper input is normalized to 16 kHz mono PCM; temporary files are deleted after each run.
- Local subprocesses have explicit timeouts and run without a shell.
- Chat history is capped at 30 persisted messages and 20 request messages; facts at 100 and diary entries at 90.
- Gemma 3 1B is the low-memory default. Larger models are never silently downloaded.
- UI animation remains in the renderer while inference runs in the main process.

Recommended baseline: 8 GB RAM, four CPU cores and 3 GB free disk.
