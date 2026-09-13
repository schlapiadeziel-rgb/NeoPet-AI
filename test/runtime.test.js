const test = require("node:test");
const assert = require("node:assert/strict");
const { defaultWhisperPaths, run, transcribe } = require("../src/main/runtime");

test("runtime resolves the isolated local Whisper directory", () => {
  const paths = defaultWhisperPaths();
  assert.match(paths.model, /NeoPet AI[\\/]runtime[\\/]whisper[\\/]ggml-tiny\.bin$/);
  assert.match(paths.exe, /whisper-cli\.exe$/);
});

test("process runner does not invoke a shell", async () => {
  const value = await run(process.execPath, ["-e", "process.stdout.write(process.argv[1])", "safe;literal"], { timeout: 5000 });
  assert.equal(value.stdout, "safe;literal");
});

test("transcription rejects oversized input before spawning tools", async () => {
  await assert.rejects(() => transcribe(Buffer.alloc(25 * 1024 * 1024 + 1)), /25MB/);
});
