"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const HISTORY_KEY = "grok-pocket-history-v1";
const CHAT_REQUEST_TIMEOUT_MS = 100_000;

function responseError(response, payload) {
  if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;

  const status = response.status ? `HTTP ${response.status}` : "lỗi mạng";
  if ([502, 503, 504].includes(response.status)) {
    return `Máy chủ web đã ngắt yêu cầu (${status}) trước khi Grok trả lời. Hãy thử lại; nếu còn lặp lại, kiểm tra timeout reverse proxy của Dokploy.`;
  }
  return `Yêu cầu không thành công (${status}).`;
}

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    // Reverse proxies often return an HTML error page. Deliberately do not
    // render its body in the UI; it is noisy and could include infrastructure
    // information. `responseError` still surfaces its HTTP status.
    return {};
  }
}

function textFromStreamEvent(payload) {
  const content = payload?.choices?.[0]?.delta?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "string" ? part : part?.text || "").join("");
  }
  return "";
}

async function readChatStream(response, onDelta) {
  if (!response.body) throw new Error("Máy chủ không trả luồng chat.");
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const payload = await responsePayload(response);
    throw new Error(responseError(response, payload));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  function consumeEvent(event) {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }

    const delta = textFromStreamEvent(payload);
    if (!delta) return;
    content += delta;
    onDelta(content);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      events.forEach(consumeEvent);
      if (done) break;
    }
    if (buffer.trim()) consumeEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!content.trim()) throw new Error("Model không trả nội dung chat.");
  return content;
}

async function requestJson(url, options) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const payload = await responsePayload(response);
  if (!response.ok) throw new Error(responseError(response, payload));
  return payload;
}

function Message({ message }) {
  return (
    <article className={`message ${message.role}`}>
      <div className="message-label">{message.role === "user" ? "Bạn" : "Grok"}</div>
      <div className="message-content">{message.content || <span className="typing">Đang trả lời…</span>}</div>
    </article>
  );
}

function Login({ configured, configurationError, onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="mark">G</div>
        <p className="eyebrow">PRIVATE WORKSPACE</p>
        <h1>Grok Pocket</h1>
        <p className="muted">Grok cá nhân, tối ưu cho điện thoại và các repo GitHub của bạn.</p>
        {configurationError ? (
          <p className="form-error">{configurationError}</p>
        ) : configured ? (
          <form onSubmit={submit} className="login-form">
            <label htmlFor="password">Mật khẩu ứng dụng</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
            />
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" disabled={busy || !password}>{busy ? "Đang mở…" : "Mở workspace"}</button>
          </form>
        ) : (
          <p className="form-error">Chưa có <code>APP_PASSWORD</code> trong biến môi trường Dokploy.</p>
        )}
      </section>
    </main>
  );
}

function GithubWorkspace({ selectedModel }) {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [files, setFiles] = useState([]);
  const [paths, setPaths] = useState("");
  const [prompt, setPrompt] = useState("");
  const [autoPush, setAutoPush] = useState(false);
  const [preview, setPreview] = useState(null);
  const [commit, setCommit] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showFiles, setShowFiles] = useState(false);

  useEffect(() => {
    requestJson("/api/github/repositories")
      .then((payload) => {
        setRepositories(payload.repositories || []);
        setSelectedRepo(payload.repositories?.[0]?.fullName || "");
      })
      .catch((reason) => setError(reason.message));
  }, []);

  async function loadFiles() {
    if (!selectedRepo) return;
    setBusy(true);
    setError("");
    try {
      const payload = await requestJson(`/api/github/files?repo=${encodeURIComponent(selectedRepo)}`);
      setFiles(payload.files || []);
      setShowFiles(true);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  function addFile(path) {
    const current = paths.split("\n").map((value) => value.trim()).filter(Boolean);
    if (!current.includes(path) && current.length < 12) setPaths([...current, path].join("\n"));
  }

  async function createPreview(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCommit(null);
    try {
      const payload = await requestJson("/api/github/preview", {
        method: "POST",
        body: JSON.stringify({
          repo: selectedRepo,
          prompt,
          paths: paths.split("\n").map((value) => value.trim()).filter(Boolean),
          model: selectedModel,
        }),
      });
      setPreview(payload.preview);
      if (autoPush) await push(payload.preview);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function push(proposal = preview) {
    if (!proposal) return;
    const payload = await requestJson("/api/github/apply", {
      method: "POST",
      body: JSON.stringify({
        repo: proposal.repo,
        expectedHeadSha: proposal.expectedHeadSha,
        commitMessage: proposal.commitMessage,
        changes: proposal.changes,
      }),
    });
    setCommit(payload.commit);
  }

  const chosenPaths = useMemo(() => new Set(paths.split("\n").map((value) => value.trim()).filter(Boolean)), [paths]);

  if (repositories.length === 0 && !error) {
    return <section className="github-empty"><h2>GitHub chưa được bật</h2><p>Thêm <code>GITHUB_TOKEN</code> và <code>GITHUB_ALLOWED_REPOS</code> vào Dokploy để dùng chế độ push thẳng main.</p></section>;
  }

  return (
    <section className="github-workspace">
      <div className="section-heading">
        <div><p className="eyebrow">DIRECT TO MAIN</p><h2>GitHub workspace</h2></div>
        <span className="branch-badge">{repositories.find((repo) => repo.fullName === selectedRepo)?.branch || "main"}</span>
      </div>
      <p className="muted">AI chỉ nhận các file bạn chọn. Khi auto-push bật, thay đổi sẽ thành một commit trực tiếp trên main.</p>
      <form onSubmit={createPreview} className="github-form">
        <label>Repository
          <select value={selectedRepo} onChange={(event) => { setSelectedRepo(event.target.value); setFiles([]); setShowFiles(false); }}>
            {repositories.map((repo) => <option key={repo.fullName} value={repo.fullName} disabled={repo.unavailable}>{repo.fullName}{repo.unavailable ? " (không truy cập được)" : ""}</option>)}
          </select>
        </label>
        <div className="row-between">
          <label>File cần AI đọc <span className="hint">tối đa 12, mỗi dòng một file</span></label>
          <button type="button" className="text-button" onClick={loadFiles} disabled={busy || !selectedRepo}>Duyệt file</button>
        </div>
        <textarea value={paths} onChange={(event) => setPaths(event.target.value)} placeholder={"src/app.js\nREADME.md"} rows={4} />
        {showFiles && <div className="file-picker">{files.slice(0, 150).map((path) => <button className={chosenPaths.has(path) ? "file-choice chosen" : "file-choice"} type="button" key={path} onClick={() => addFile(path)}>{path}</button>)}</div>}
        <label>Yêu cầu thay đổi
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Sửa phần đăng nhập để hiển thị lỗi rõ hơn và thêm test phù hợp." rows={5} />
        </label>
        <label className="toggle-row"><input type="checkbox" checked={autoPush} onChange={(event) => setAutoPush(event.target.checked)} /><span><strong>Auto-push vào main</strong><small>AI tạo xong thay đổi là commit ngay, không qua PR.</small></span></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy || !selectedRepo || !prompt || !paths.trim()}>{busy ? "AI đang làm…" : autoPush ? "Tạo và push main" : "Tạo bản xem trước"}</button>
      </form>
      {preview && <section className="proposal"><h3>{preview.summary}</h3><p className="muted">Commit: <code>{preview.commitMessage}</code></p>{preview.changes.map((change) => <details key={change.path}><summary><span className={change.action}>{change.action === "delete" ? "Xóa" : "Sửa"}</span> {change.path}</summary>{change.action === "upsert" && <pre>{change.content}</pre>}</details>)}{!autoPush && !commit && <button className="primary-button push-button" onClick={() => { setBusy(true); setError(""); push().catch((reason) => setError(reason.message)).finally(() => setBusy(false)); }} disabled={busy}>Push trực tiếp vào main</button>}</section>}
      {commit && <p className="success-note">Đã push vào <strong>{commit.branch}</strong>. <a href={commit.url} target="_blank" rel="noreferrer">Mở commit {commit.sha.slice(0, 7)} ↗</a></p>}
    </section>
  );
}

function ImageStudio({ models }) {
  const imageModels = useMemo(() => models.filter((item) => item.kind === "image" || item.id.includes("imagine-image")), [models]);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [images, setImages] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!model && imageModels.length) setModel(imageModels[0].id);
  }, [imageModels, model]);

  async function submit(event) {
    event.preventDefault();
    if (!model || !prompt.trim()) return;
    setBusy(true);
    setError("");
    try {
      const payload = await requestJson("/api/images", { method: "POST", body: JSON.stringify({ prompt, model, size }) });
      setImages(payload.images || []);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="image-studio">
      <div className="section-heading"><div><p className="eyebrow">IMAGE STUDIO</p><h2>Tạo ảnh với Grok</h2></div><span className="branch-badge">{imageModels.length} model{imageModels.length === 1 ? "" : "s"}</span></div>
      <p className="muted">Prompt được gửi qua gateway server-side; API key không xuất hiện trong trình duyệt.</p>
      {imageModels.length ? <form className="image-form" onSubmit={submit}>
        <label>Model<select value={model} onChange={(event) => setModel(event.target.value)}>{imageModels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Kích thước<select value={size} onChange={(event) => setSize(event.target.value)}><option value="1024x1024">Vuông</option><option value="1536x1024">Ngang</option><option value="1024x1536">Dọc</option></select></label>
        <label>Prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} placeholder="Một bản minh họa tối giản của trợ lý AI trong không gian làm việc đêm, tông tím và xanh mint…" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" disabled={busy || !prompt.trim()}>{busy ? "Đang tạo ảnh…" : "Tạo ảnh"}</button>
      </form> : <p className="form-error">Gateway hiện không công bố model Imagine nào. Kiểm tra Model Routes trong Grok2API, sau đó refresh trang.</p>}
      {images.length > 0 && <div className="image-results">{images.map((image, index) => { const source = image.url || (image.b64Json ? `data:image/png;base64,${image.b64Json}` : null); return source ? <figure key={`${source.slice(0, 40)}-${index}`}><img src={source} alt={image.revisedPrompt || prompt} />{image.revisedPrompt && <figcaption>{image.revisedPrompt}</figcaption>}<a href={source} target="_blank" rel="noreferrer">Mở ảnh ↗</a></figure> : null; })}</div>}
    </section>
  );
}

function App() {
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [gatewayReady, setGatewayReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [deferredInstall, setDeferredInstall] = useState(null);
  const [historyReady, setHistoryReady] = useState(false);
  const bottomRef = useRef(null);
  const sendingRef = useRef(false);

  const loadModels = useCallback(async () => {
    setGatewayReady(false);
    setError("");
    try {
      const payload = await requestJson("/api/models");
      const nextModels = payload.models || [];
      setModels(nextModels);
      setModel(payload.defaultModel || nextModels[0]?.id || "");
      setGatewayReady(true);
    } catch (reason) {
      setModels([]);
      setModel("");
      setError(reason instanceof Error ? reason.message : "Không thể kiểm tra kết nối Grok.");
    }
  }, []);

  useEffect(() => {
    const rawHistory = window.localStorage.getItem(HISTORY_KEY);
    if (rawHistory) {
      try { setMessages(JSON.parse(rawHistory)); } catch { window.localStorage.removeItem(HISTORY_KEY); }
    }
    setHistoryReady(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const handleInstall = (event) => { event.preventDefault(); setDeferredInstall(event); };
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleInstall);
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  useEffect(() => { if (historyReady) window.localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-80))); }, [messages, historyReady]);
  // Effects may only return a cleanup function. Keep this block explicit: a
  // browser implementation or polyfill must never leak a scroll result to
  // React as an invalid cleanup value when chat state changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function install() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    setDeferredInstall(null);
  }

  async function send(event) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || sendingRef.current || !gatewayReady || !model) return;
    sendingRef.current = true;
    const next = [...messages, { role: "user", content }, { role: "assistant", content: "" }];
    setMessages(next);
    setDraft("");
    setSending(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/chat", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(0, -1), model }), signal: controller.signal });
      if (!response.ok) {
        const payload = await responsePayload(response);
        throw new Error(responseError(response, payload));
      }
      await readChatStream(response, (answer) => {
        setMessages((current) => [...current.slice(0, -1), { role: "assistant", content: answer }]);
      });
    } catch (reason) {
      setMessages((current) => current.slice(0, -1));
      if (reason instanceof DOMException && reason.name === "AbortError") {
        setError("Yêu cầu chat đã quá 100 giây. Hãy thử lại; nếu còn lặp lại, kiểm tra gateway hoặc timeout reverse proxy của Dokploy.");
      } else {
        setError(reason instanceof Error ? reason.message : "Đã có lỗi xảy ra.");
      }
    } finally {
      window.clearTimeout(timeout);
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab("chat")}><span className="brand-mark">G</span><span>Grok Pocket</span></button>
        <div className="top-actions">{deferredInstall && <button className="secondary-button" onClick={install}>Cài app</button>}<button className="secondary-button" onClick={() => { window.localStorage.removeItem(HISTORY_KEY); setMessages([]); }}>Chat mới</button></div>
      </header>
      <nav className="tabs" aria-label="Primary"><button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>Chat</button><button className={tab === "images" ? "active" : ""} onClick={() => setTab("images")}>Ảnh</button><button className={tab === "github" ? "active" : ""} onClick={() => setTab("github")}>GitHub</button></nav>
      {tab === "chat" ? <section className="chat-shell"><div className="chat-toolbar"><div><p className="eyebrow">PRIVATE AI · GROK STYLE</p><h1>Hôm nay mình làm gì?</h1></div><select value={model} disabled aria-label="Model bị khóa">{(models.filter((item) => item.kind !== "image").length ? models.filter((item) => item.kind !== "image") : [{ id: model, name: model || "Đang kiểm tra…" }]).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="messages">{messages.length === 0 && <div className="welcome"><div className="welcome-orb">✦</div><h2>Chat nhanh. Làm việc sâu.</h2><p>Trò chuyện với Grok 4.5, tạo ảnh, hoặc mở GitHub Workspace để tạo bản thay đổi có kiểm soát.</p><div className="prompt-grid">{["Tóm tắt vấn đề kỹ thuật này thành các bước có thể làm ngay", "Viết một API đăng nhập an toàn bằng Next.js", "Lập kế hoạch refactor repository này"].map((suggestion) => <button key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>)}</div></div>}{messages.map((message, index) => <Message key={`${message.role}-${index}`} message={message} />)}<div ref={bottomRef} /></div>{error && <div className="chat-error"><p className="form-error">{error}</p>{!gatewayReady && <button type="button" className="text-button" onClick={loadModels}>Thử lại kết nối</button>}</div>}<form onSubmit={send} className="composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nhắn Grok…" rows={2} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} /><button className="send-button" disabled={sending || !gatewayReady || !model || !draft.trim()} aria-label="Gửi">↑</button></form><p className="composer-hint">Giao diện lấy cảm hứng từ trải nghiệm chat hiện đại · Enter để gửi · Shift + Enter để xuống dòng</p></section> : tab === "images" ? <ImageStudio models={models} /> : <GithubWorkspace selectedModel={model} />}
    </main>
  );
}

export default function Home() {
  const [state, setState] = useState({ checking: true, authenticated: false, configured: false, configurationError: "" });

  useEffect(() => {
    requestJson("/api/auth/session")
      .then((payload) => setState({ checking: false, authenticated: payload.authenticated, configured: payload.passwordConfigured, configurationError: payload.configurationError || "" }))
      .catch(() => setState({ checking: false, authenticated: false, configured: false, configurationError: "Không thể kiểm tra cấu hình máy chủ." }));
  }, []);

  async function login(password) {
    await requestJson("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
    setState((current) => ({ ...current, authenticated: true }));
  }

  if (state.checking) return <main className="loading-screen"><div className="loader" />Đang mở workspace…</main>;
  if (!state.authenticated) return <Login configured={state.configured} configurationError={state.configurationError} onLogin={login} />;
  return <App />;
}
