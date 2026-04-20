#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_BASE_URL = "http://127.0.0.1:1234/v1";
const DEFAULT_TIMEOUT_MS = 120000;

function printUsage() {
  console.log(`Usage:
  node scripts/lm_studio_task.js [options] --prompt "Your task"
  echo "Your task" | node scripts/lm_studio_task.js [options]

Options:
  --prompt <text>          User prompt text. If omitted, stdin is used.
  --prompt-file <path>     Read prompt text from file.
  --system <text>          Optional system prompt.
  --system-file <path>     Read system prompt from file.
  --model <id>             Exact model id. Falls back to LLM_MODEL env or first /models entry.
  --base-url <url>         LM Studio API base URL. Default: ${DEFAULT_BASE_URL}
  --api-key <key>          Optional API key. Falls back to LM_STUDIO_API_KEY.
  --temperature <n>        Temperature, for example 0.2
  --max-tokens <n>         Max completion tokens.
  --timeout-ms <n>         Request timeout in ms. Default: ${DEFAULT_TIMEOUT_MS}
  --raw                    Print the full LM Studio JSON response.
  --show-models            Print available model ids and exit.
  --help                   Show this help.

Environment:
  LM_STUDIO_BASE_URL
  LM_STUDIO_API_KEY
  LLM_MODEL
`);
}

function parseArgs(argv) {
  const args = {
    raw: false,
    showModels: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      args.help = true;
      continue;
    }

    if (arg === "--raw") {
      args.raw = true;
      continue;
    }

    if (arg === "--show-models") {
      args.showModels = true;
      continue;
    }

    const next = argv[index + 1];
    if (next == null) {
      throw new Error(`Missing value for ${arg}`);
    }

    switch (arg) {
      case "--prompt":
        args.prompt = next;
        index += 1;
        break;
      case "--prompt-file":
        args.promptFile = next;
        index += 1;
        break;
      case "--system":
        args.system = next;
        index += 1;
        break;
      case "--system-file":
        args.systemFile = next;
        index += 1;
        break;
      case "--model":
        args.model = next;
        index += 1;
        break;
      case "--base-url":
        args.baseUrl = next;
        index += 1;
        break;
      case "--api-key":
        args.apiKey = next;
        index += 1;
        break;
      case "--temperature":
        args.temperature = Number(next);
        index += 1;
        break;
      case "--max-tokens":
        args.maxTokens = Number(next);
        index += 1;
        break;
      case "--timeout-ms":
        args.timeoutMs = Number(next);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function readTextFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  return fs.readFileSync(resolvedPath, "utf8");
}

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

async function requestJson(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let json;

    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error(`Non-JSON response from ${url}: ${text}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}: ${JSON.stringify(json)}`);
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function listModels(baseUrl, headers, timeoutMs) {
  const response = await requestJson(`${baseUrl}/models`, { headers }, timeoutMs);
  return Array.isArray(response.data) ? response.data : [];
}

function pickAssistantText(response) {
  const message = response?.choices?.[0]?.message;
  if (!message) {
    return "";
  }

  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }

  if (typeof message.reasoning_content === "string" && message.reasoning_content.trim()) {
    return message.reasoning_content;
  }

  return "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const baseUrl = normalizeBaseUrl(args.baseUrl || process.env.LM_STUDIO_BASE_URL || DEFAULT_BASE_URL);
  const apiKey = args.apiKey || process.env.LM_STUDIO_API_KEY || "lm-studio";
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  };

  const models = await listModels(baseUrl, headers, args.timeoutMs);
  if (args.showModels) {
    if (models.length === 0) {
      console.error("No models reported by LM Studio.");
      process.exitCode = 1;
      return;
    }

    for (const model of models) {
      console.log(model.id);
    }
    return;
  }

  const promptFromFile = args.promptFile ? readTextFile(args.promptFile) : "";
  const promptFromStdin = args.prompt ? "" : await readStdin();
  const prompt = args.prompt || promptFromFile || promptFromStdin;
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt is required. Pass --prompt, --prompt-file, or pipe text through stdin.");
  }

  const systemPrompt = args.systemFile ? readTextFile(args.systemFile) : args.system;
  const model = args.model || process.env.LLM_MODEL || models[0]?.id;
  if (!model) {
    throw new Error("Unable to resolve model id. Pass --model or set LLM_MODEL.");
  }

  const body = {
    model,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ],
  };

  if (Number.isFinite(args.temperature)) {
    body.temperature = args.temperature;
  }

  if (Number.isFinite(args.maxTokens)) {
    body.max_tokens = args.maxTokens;
  }

  const response = await requestJson(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    args.timeoutMs,
  );

  if (args.raw) {
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  const text = pickAssistantText(response);
  if (!text) {
    throw new Error("LM Studio returned an empty assistant message.");
  }

  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
