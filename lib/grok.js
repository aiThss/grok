import "server-only";

const DEFAULT_MODEL = "grok-4.5";
const REQUEST_TIMEOUT_MS = 45_000;

function gatewayError(message) {
  return new Error(message);
}

function baseUrl() {
  const value = process.env.GROK_BASE_URL?.trim();
  if (!value) throw gatewayError("GROK_BASE_URL is not configured.");

  let url;
  try {
    url = new URL(value);
  } catch {
    throw gatewayError("GROK_BASE_URL must be a valid https URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw gatewayError("GROK_BASE_URL must use http or https.");
  }

  // Grok2API and xAI-compatible gateways expose OpenAI endpoints below /v1.
  // Accepting a host-only value prevents a subtle failure where the gateway
  // returns its HTML landing page with HTTP 200 for /chat/completions.
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = /(?:^|\/)v1$/i.test(path) ? path || "/v1" : `${path || ""}/v1`;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function apiKey() {
  const value = process.env.GROK_API_KEY?.trim();
  if (!value) throw gatewayError("GROK_API_KEY is not configured.");
  return value;
}

export function defaultModel() {
  return process.env.GROK_DEFAULT_MODEL || DEFAULT_MODEL;
}

export function imageModel() {
  return process.env.GROK_IMAGE_MODEL || "grok-imagine-image-2.0";
}

function lockedModel(requestedModel) {
  const model = defaultModel();
  if (requestedModel && requestedModel !== model) {
    throw new Error(`This workspace is locked to ${model}.`);
  }
  return model;
}

function lockedImageModel(requestedModel) {
  const model = imageModel();
  if (requestedModel && requestedModel !== model) {
    throw new Error(`Image generation is locked to ${model}.`);
  }
  return model;
}

async function grokFetch(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw gatewayError("Grok gateway timed out after 45 seconds. Check the gateway and its upstream account.");
    }

    const code = error?.cause?.code;
    throw gatewayError(`Unable to reach the Grok gateway${code ? ` (${code})` : ""}. Check GROK_BASE_URL and the container network.`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw gatewayError(`Grok API returned ${response.status}: ${formatGatewayDetail(detail)}`);
  }
  return response;
}

function formatGatewayDetail(detail) {
  const text = detail.trim();
  if (!text) return "No error details were returned.";
  if (text.startsWith("<")) {
    return "The gateway returned HTML instead of API JSON. Set GROK_BASE_URL to its OpenAI-compatible /v1 endpoint.";
  }
  return text.slice(0, 500);
}

async function responseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw gatewayError(`Grok gateway returned invalid JSON: ${formatGatewayDetail(text)}`);
  }
}

export async function listModels() {
  const model = defaultModel();
  const response = await grokFetch("/models");
  const payload = await responseJson(response);
  const ids = Array.isArray(payload?.data)
    ? payload.data.map((item) => item?.id).filter((id) => typeof id === "string")
    : [];

  if (!ids.includes(model)) {
    const available = ids.slice(0, 12).join(", ") || "none";
    throw gatewayError(`GROK_DEFAULT_MODEL \"${model}\" is not available from the gateway. Available models: ${available}.`);
  }

  const image = imageModel();
  return [
    { id: model, name: model, kind: "chat" },
    ...(image === model ? [] : [{ id: image, name: image, kind: "image" }]),
  ];
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 80) {
    throw new Error("A valid conversation is required.");
  }

  return messages.map((message) => {
    const role = ["system", "user", "assistant"].includes(message?.role) ? message.role : "user";
    const content = typeof message?.content === "string" ? message.content.slice(0, 60_000) : "";
    if (!content.trim()) throw new Error("Messages cannot be empty.");
    return { role, content };
  });
}

export async function completeChat({ messages, model }) {
  const response = await grokFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: lockedModel(model),
      messages: [
        {
          role: "system",
          content:
            "You are Grok Pocket, a concise and capable personal assistant. Answer in the user's language. Do not claim to have changed GitHub unless a dedicated GitHub action has completed.",
        },
        ...validateMessages(messages),
      ],
    }),
  });
  const payload = await responseJson(response);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The model returned no completion.");
  }
  return content;
}

export async function completeJson({ messages, model }) {
  const response = await grokFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: lockedModel(model),
      temperature: 0.15,
      messages: validateMessages(messages),
    }),
  });
  const payload = await responseJson(response);
  const text = payload?.choices?.[0]?.message?.content;
  if (!text) throw new Error("The model returned no completion.");
  return text;
}

export async function generateImage({ prompt, model, size }) {
  if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 4_000) {
    throw new Error("Image prompts must be between 3 and 4,000 characters.");
  }

  const response = await grokFetch("/images/generations", {
    method: "POST",
    body: JSON.stringify({
      model: lockedImageModel(model),
      prompt: prompt.trim(),
      n: 1,
      size: size || "1024x1024",
    }),
  });
  const payload = await responseJson(response);
  const images = Array.isArray(payload?.data) ? payload.data : [];
  if (!images.length) throw new Error("The gateway returned no image.");
  return images.map((image) => ({
    url: image.url || null,
    b64Json: image.b64_json || null,
    revisedPrompt: image.revised_prompt || null,
  }));
}
