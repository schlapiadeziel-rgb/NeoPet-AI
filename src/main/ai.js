const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { parseAssistantEnvelope } = require("../shared/response");

async function requestJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: { message: text.slice(0, 500) } };
    }
    if (!response.ok) throw new Error(body.error?.message || `API 请求失败 (${response.status})`);
    return body;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("API 请求超时");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildSystemPrompt(pet) {
  return `你是名为“${pet.name}”的 AI 桌面宠物。性格：${pet.personality}\n使用用户正在使用的语言简洁回答。不要声称看到了未提供的内容。只输出一个 JSON 对象，不要使用 Markdown：{"reply":"回答内容","emotion":"neutral|happy|sad|excited|shy|angry|curious","action":"idle|wave|nod|dance|sleep|think|speak|happy"}。动作必须符合回答语义。`;
}

async function chat({ config, apiKey, pet, messages }) {
  if (!config.baseUrl || !config.model) throw new Error("请先在设置中填写 API 地址和模型名称");
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const body = await requestJson(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      temperature: 0.8,
      messages: [{ role: "system", content: buildSystemPrompt(pet) }, ...messages.slice(-20)]
    })
  });
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("API 没有返回可用回答");
  return parseAssistantEnvelope(content);
}

async function generatePet({ config, apiKey, prompt, outputDirectory }) {
  if (!config.baseUrl || !config.imageModel) throw new Error("请先填写 API 地址和图像模型");
  const safePrompt = String(prompt || "").trim().slice(0, 1500);
  if (!safePrompt) throw new Error("请描述想生成的宠物");
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const body = await requestJson(`${config.baseUrl}/images/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.imageModel,
      prompt: `Create one original full-body desktop pet character on a transparent background. Centered, no text, clean silhouette, suitable for subtle animation. Use the following only as high-level inspiration and do not copy copyrighted characters: ${safePrompt}`,
      size: "1024x1024",
      response_format: "b64_json"
    })
  });
  const item = body.data?.[0];
  if (!item) throw new Error("图像 API 没有返回图片");
  fs.mkdirSync(outputDirectory, { recursive: true });
  const file = path.join(outputDirectory, `pet-${Date.now()}.png`);
  if (item.b64_json) {
    fs.writeFileSync(file, Buffer.from(item.b64_json, "base64"));
  } else if (item.url) {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error("生成图片下载失败");
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  } else {
    throw new Error("图像 API 返回格式不支持");
  }
  return pathToFileURL(file).href;
}

module.exports = { chat, generatePet };
