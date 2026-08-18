import "server-only";

const DEFAULT_MODEL = "grok-4.5";

function baseUrl() {
  const value = process.env.GROK_BASE_URL;
  if (!value) throw new Error("GROK_BASE_URL is not configured.");
  return value.replace(/\/$/, "");
}

function apiKey() {
  const value = process.env.GROK_API_KEY;
  if (!value) throw new Error("GROK_API_KEY is not configured.");
  return value;
}

export function defaultModel() {
  return process.env.GROK_DEFAULT_MODEL || DEFAULT_MODEL;
}

async function grokFetch(path, init = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Grok API returned ${response.status}: ${detail.slice(0, 500)}`);
  }
  return response;
}

export async function listModels() {
  const response = await grokFetch("/models", { method: "GET" });
  const payload = await response.json();
  const models = Array.isArray(payload?.data) ? payload.data : [];
  return models.map((model) => ({ id: model.id, name: model.name || model.id }));
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

export async function streamChat({ messages, model }) {
  const body = {
    model: model || defaultModel(),
    stream: true,
    messages: [
      {
        role: "system",
        content:
          "You are Grok Pocket, a concise and capable personal assistant. Answer in the user's language. Do not claim to have changed GitHub unless a dedicated GitHub action has completed.",
      },
      ...validateMessages(messages),
    ],
  };

  return grokFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function completeJson({ messages, model }) {
  const response = await grokFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: model || defaultModel(),
      temperature: 0.15,
      messages: validateMessages(messages),
    }),
  });
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (!text) throw new Error("The model returned no completion.");
  return text;
}
