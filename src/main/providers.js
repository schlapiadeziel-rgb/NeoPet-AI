const PRESETS = {
  api: { label: "默认 API", baseUrl: "https://api.openai.com/v1", needsKey: true },
  ollama: { label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", needsKey: false },
  lmstudio: { label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1", needsKey: false },
  llamacpp: { label: "llama.cpp", baseUrl: "http://127.0.0.1:8080/v1", needsKey: false },
  custom: { label: "自定义", baseUrl: "", needsKey: false }
};

async function listModels(baseUrl, apiKey = "") {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const response = await fetch(`${String(baseUrl).replace(/\/$/, "")}/models`, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`模型服务返回 ${response.status}`);
    const body = await response.json();
    return (Array.isArray(body.data) ? body.data : []).map((item) => String(item.id || "")).filter(Boolean).slice(0, 200);
  } catch (error) {
    if (error.name === "AbortError") throw new Error("模型服务连接超时");
    throw error;
  } finally { clearTimeout(timer); }
}

module.exports = { PRESETS, listModels };
