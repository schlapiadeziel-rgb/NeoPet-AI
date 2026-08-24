const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

function run(command, args, { timeout = 120000, input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, shell: false, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
    const stdout = []; const stderr = [];
    const timer = setTimeout(() => { child.kill(); reject(new Error("本地组件执行超时")); }, timeout);
    child.stdout.on("data", (value) => stdout.push(value)); child.stderr.on("data", (value) => stderr.push(value));
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); const out = Buffer.concat(stdout).toString("utf8"); const err = Buffer.concat(stderr).toString("utf8"); code === 0 ? resolve({ stdout: out, stderr: err }) : reject(new Error((err || out || `退出码 ${code}`).trim().slice(-1200))); });
    if (input) { child.stdin.end(input); }
  });
}

function defaultWhisperPaths() {
  const root = path.join(process.env.LOCALAPPDATA || "", "NeoPet AI", "runtime", "whisper");
  const candidates = ["whisper-cli.exe", "bin/whisper-cli.exe", "Release/whisper-cli.exe"].map((item) => path.join(root, item));
  return { exe: candidates.find(fs.existsSync) || candidates[0], model: path.join(root, "ggml-tiny.bin") };
}

async function runtimeStatus(config = {}) {
  const whisper = defaultWhisperPaths();
  const whisperExe = config.whisperExe || whisper.exe; const whisperModel = config.whisperModel || whisper.model;
  let ollama = false; let gemma = false; let pyttsx3 = false;
  try { const response = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(1800) }); if (response.ok) { ollama = true; const value = await response.json(); gemma = value.models?.some((item) => item.name === "gemma3:1b" || item.name.startsWith("gemma3:1b-")); } } catch {}
  try { await run(config.pythonCommand || "python", ["-c", "import pyttsx3"], { timeout: 5000 }); pyttsx3 = true; } catch {}
  return { ollama, gemma, pyttsx3, whisper: fs.existsSync(whisperExe) && fs.existsSync(whisperModel), whisperExe, whisperModel };
}

async function transcribe(buffer, config = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) throw new Error("没有收到有效录音");
  if (buffer.length > 25 * 1024 * 1024) throw new Error("录音不能超过 25MB");
  const defaults = defaultWhisperPaths(); const exe = config.whisperExe || defaults.exe; const model = config.whisperModel || defaults.model;
  if (!fs.existsSync(exe) || !fs.existsSync(model)) throw new Error("Whisper Tiny 尚未安装");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "neopet-stt-")); const input = path.join(directory, "input.webm"); const wav = path.join(directory, "audio.wav"); const output = path.join(directory, "result");
  try {
    fs.writeFileSync(input, buffer); await run("ffmpeg", ["-y", "-i", input, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], { timeout: 30000 });
    await run(exe, ["-m", model, "-f", wav, "-l", "auto", "-nt", "-otxt", "-of", output], { timeout: 120000 });
    return fs.readFileSync(`${output}.txt`, "utf8").trim();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

async function speak(text, config = {}, scriptPath) {
  const value = String(text || "").slice(0, 4000); if (!value) return;
  await run(config.pythonCommand || "python", [scriptPath, "--rate", String(config.speechRate || 1), "--text", value], { timeout: 120000 });
}

let installation;
function installRuntime(scriptPath) {
  if (installation) return installation;
  installation = run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], { timeout: 45 * 60 * 1000 }).finally(() => { installation = null; });
  return installation;
}

module.exports = { defaultWhisperPaths, installRuntime, run, runtimeStatus, speak, transcribe };
