import { ProxyAgent, fetch, type Dispatcher } from "undici";
import type { ToolExecutionContext, ToolExecutionResult } from "./executor";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_CHARS = 200_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type WebFetchArgs = {
  url?: unknown;
  method?: unknown;
  headers?: unknown;
  body?: unknown;
  proxy?: unknown;
  maxChars?: unknown;
  timeoutMs?: unknown;
  parseJson?: unknown;
};

/** 读取 Windows 系统代理（Internet Settings 注册表）。未开启或无地址返回 null。 */
function readWindowsSystemProxy(): string | null {
  try {
    // spawnSync 传参数数组，避免 shell 引号转义问题
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawnSync } = require("child_process");
    const psCommand =
      "$p=Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'; Write-Output ($p.ProxyEnable.ToString()+'|'+$p.ProxyServer)";
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", psCommand],
      { encoding: "utf8", timeout: 5000, env: { ...process.env, LC_ALL: "C" } }
    );
    const out = (result.stdout as string | undefined)?.trim() ?? "";
    const match = /^(\d+)\|(.*)$/.exec(out);
    if (!match) {
      return null;
    }
    const enabled = match[1] === "1";
    const server = (match[2] || "").trim();
    if (!enabled || !server) {
      return null;
    }
    // 兼容可能已带 scheme，无 scheme 则补 http://
    return /^https?:\/\//i.test(server) ? server : `http://${server}`;
  } catch {
    return null;
  }
}

/** 解析代理：显式参数 > 环境变量 > Windows 系统代理 > 无（直连）。 */
function resolveProxy(explicit?: unknown): string | undefined {
  const explicitStr = typeof explicit === "string" && explicit.trim() ? explicit.trim() : "";
  if (explicitStr) {
    return /^https?:\/\//i.test(explicitStr) ? explicitStr : `http://${explicitStr}`;
  }

  const envProxy =
    process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || undefined;
  if (envProxy) {
    return envProxy;
  }

  if (process.platform === "win32") {
    return readWindowsSystemProxy() ?? undefined;
  }

  return undefined;
}

export async function handleWebFetchTool(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const config = args as WebFetchArgs;
  const url = typeof config.url === "string" ? config.url.trim() : "";
  if (!url) {
    return {
      ok: false,
      name: "web_fetch",
      error: 'Missing required "url" string.',
    };
  }
  if (!/^https?:\/\//i.test(url)) {
    return {
      ok: false,
      name: "web_fetch",
      error: `Invalid URL: ${url}. Only http(s) URLs are supported.`,
    };
  }

  const method = typeof config.method === "string" && config.method.trim() ? config.method.trim().toUpperCase() : "GET";
  const timeoutMs =
    typeof config.timeoutMs === "number" && config.timeoutMs > 0
      ? config.timeoutMs
      : DEFAULT_TIMEOUT_MS;
  const maxChars =
    typeof config.maxChars === "number" && config.maxChars > 0 ? config.maxChars : DEFAULT_MAX_CHARS;
  const parseJson = config.parseJson === true;
  const body = typeof config.body === "string" ? config.body : config.body !== undefined ? JSON.stringify(config.body) : undefined;

  const proxy = resolveProxy(config.proxy);
  const dispatcher: Dispatcher | undefined = proxy ? new ProxyAgent(proxy) : undefined;

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  };
  if (typeof config.headers === "object" && config.headers !== null) {
    for (const [key, value] of Object.entries(config.headers as Record<string, unknown>)) {
      if (typeof value === "string" || typeof value === "number") {
        headers[key] = String(value);
      }
    }
  }
  if (body && method !== "GET" && method !== "HEAD" && !Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const activityId = `web-fetch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  context.onProcessStart?.(activityId, `Fetching ${url}`);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      redirect: "follow",
      dispatcher,
      signal: controller.signal,
    });

    // 优先 JSON 解析（parseJson 或 content-type 含 json），否则纯文本
    const contentType = response.headers.get("content-type") ?? "";
    let text = await response.text();
    const wantJson = parseJson || /json/i.test(contentType);

    let outputText: string;
    let json = false;
    if (wantJson) {
      try {
        outputText = JSON.stringify(JSON.parse(text), null, 2);
        json = true;
      } catch {
        outputText = text;
      }
    } else {
      outputText = text;
    }

    const truncated = outputText.length > maxChars;
    if (truncated) {
      outputText = outputText.slice(0, maxChars) + "\n...[truncated]";
    }

    return {
      ok: true,
      name: "web_fetch",
      output: outputText || undefined,
      metadata: {
        url,
        status: response.status,
        statusText: response.statusText,
        contentType,
        proxyUsed: proxy ?? null,
        json,
        truncated,
        bytes: text.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      name: "web_fetch",
      error: `web_fetch failed: ${message}`,
      metadata: { url, proxyUsed: proxy ?? null },
    };
  } finally {
    clearTimeout(timer);
    context.onProcessExit?.(activityId);
    if (dispatcher) {
      dispatcher.close?.();
    }
  }
}
