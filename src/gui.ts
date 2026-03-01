export function getGuiHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Crusty Local UI</title>
    <link rel="stylesheet" href="/ui/styles.css">
  </head>
  <body>
    <main>
      <h1>Crusty</h1>
      <p>Local prototype UI for the CLI orchestration surface.</p>
      <p id="connection-line"></p>
      <p id="remote-plan-line">Remote login/networking is under construction. Use the local API and local UI for now.</p>

      <section>
        <h2>Controls</h2>
        <div id="command-buttons">
          <button data-command="/chat">/chat</button>
          <button data-command="/group">/group</button>
          <button data-command="/auto">/auto</button>
          <button data-command="/stop">/stop</button>
          <button data-command="/reset">/reset</button>
          <button data-command="/clear">/clear</button>
          <button data-command="/help">/help</button>
          <button data-command="/login">/login</button>
        </div>
        <form id="command-form">
          <label>
            Command or message
            <input id="command-input" name="command" type="text" autocomplete="off">
          </label>
          <button type="submit">Submit</button>
        </form>
      </section>

      <section>
        <h2>View</h2>
        <div id="tab-buttons">
          <button data-tab="status">status</button>
          <button data-tab="queue">queue</button>
          <button data-tab="metrics">metrics</button>
          <button data-tab="detail">detail</button>
          <button data-tab="files">files</button>
        </div>
        <pre id="view-output"></pre>
      </section>

      <section>
        <h2>Last Result</h2>
        <pre id="result-output"></pre>
      </section>

      <section>
        <h2>Dropbox Inbox</h2>
        <form id="inbox-form">
          <label>
            File name
            <input id="inbox-filename" name="filename" type="text" value="task.md">
          </label>
          <label>
            Document content
            <textarea id="inbox-content" name="content" rows="10"></textarea>
          </label>
          <button type="submit">Write to inbox</button>
        </form>
      </section>

      <section id="edit-panel" hidden>
        <h2>Edit Request</h2>
        <p id="edit-target"></p>
        <form id="edit-form">
          <textarea id="edit-text" rows="14"></textarea>
          <button type="submit">Save</button>
        </form>
      </section>

      <section id="workflow-panel" hidden>
        <h2>Workflow</h2>
        <div id="workflow-intro"></div>
        <form id="workflow-form"></form>
      </section>

      <section id="files-panel" hidden>
        <h2>Explorer</h2>
        <pre id="tree-output"></pre>
        <form id="file-open-form">
          <label>
            Full path
            <input id="file-path-input" type="text" autocomplete="off">
          </label>
          <button type="submit">Open</button>
        </form>
        <pre id="file-output"></pre>
      </section>
    </main>
    <script type="module" src="/ui/app.js"></script>
  </body>
</html>`;
}

export function getGuiStyles(): string {
  return `body {
  font-family: monospace;
  margin: 1rem;
}

main {
  display: grid;
  gap: 1rem;
}

section {
  border: 1px solid #999;
  padding: 0.75rem;
}

form,
#command-buttons,
#tab-buttons {
  display: grid;
  gap: 0.5rem;
}

textarea,
input,
button {
  font: inherit;
}

pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

#tab-buttons,
#command-buttons {
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
}
`;
}

export function getGuiScript(): string {
  return `const state = {
  selectedTab: "status",
  selectedFilePath: "",
  pendingEdit: null,
  pendingWorkflow: null,
  refreshTimer: null
};

const els = {
  connectionLine: document.getElementById("connection-line"),
  commandForm: document.getElementById("command-form"),
  commandInput: document.getElementById("command-input"),
  resultOutput: document.getElementById("result-output"),
  viewOutput: document.getElementById("view-output"),
  treeOutput: document.getElementById("tree-output"),
  fileOutput: document.getElementById("file-output"),
  fileOpenForm: document.getElementById("file-open-form"),
  filePathInput: document.getElementById("file-path-input"),
  inboxForm: document.getElementById("inbox-form"),
  inboxFilename: document.getElementById("inbox-filename"),
  inboxContent: document.getElementById("inbox-content"),
  editPanel: document.getElementById("edit-panel"),
  editTarget: document.getElementById("edit-target"),
  editForm: document.getElementById("edit-form"),
  editText: document.getElementById("edit-text"),
  workflowPanel: document.getElementById("workflow-panel"),
  workflowIntro: document.getElementById("workflow-intro"),
  workflowForm: document.getElementById("workflow-form"),
  filesPanel: document.getElementById("files-panel")
};

async function getJson(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function renderResult(payload) {
  const lines = [];
  if (payload.result) {
    if (payload.result.lines && payload.result.lines.length > 0) {
      lines.push(...payload.result.lines);
    }
    if (payload.result.errors && payload.result.errors.length > 0) {
      lines.push("", "Errors:", ...payload.result.errors);
    }
  }
  els.resultOutput.textContent = lines.join("\\n") || "(no output)";
}

function renderWorkflow(request) {
  state.pendingWorkflow = request || null;
  els.workflowPanel.hidden = !request;
  els.workflowForm.replaceChildren();
  els.workflowIntro.replaceChildren();

  if (!request) {
    return;
  }

  for (const line of request.introLines || []) {
    const p = document.createElement("p");
    p.textContent = line;
    els.workflowIntro.appendChild(p);
  }

  for (const question of request.questions || []) {
    const label = document.createElement("label");
    label.textContent = question.prompt;
    const input = document.createElement("input");
    input.name = question.key;
    input.type = "text";
    label.appendChild(input);
    els.workflowForm.appendChild(label);
  }

  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Create agent";
  els.workflowForm.appendChild(button);
}

function renderEdit(request) {
  state.pendingEdit = request || null;
  els.editPanel.hidden = !request;
  if (!request) {
    els.editTarget.textContent = "";
    els.editText.value = "";
    return;
  }

  els.editTarget.textContent = request.prompt;
  els.editText.value = request.initialText || "";
}

async function refreshView() {
  const [status, hud, dropbox] = await Promise.all([
    getJson("/api/status"),
    state.selectedTab === "files" ? Promise.resolve(null) : getJson("/api/hud?tab=" + encodeURIComponent(state.selectedTab)),
    getJson("/api/dropbox")
  ]);

  els.connectionLine.textContent = "Prompt: " + status.prompt;

  if (state.selectedTab === "files") {
    els.filesPanel.hidden = false;
    const tree = await getJson("/api/explore/tree");
    els.treeOutput.textContent = tree.lines.join("\\n");
    if (!state.selectedFilePath) {
      els.fileOutput.textContent = [
        "Dropbox:",
        "inbox: " + dropbox.inbox.length,
        "active: " + dropbox.active.length,
        "outbox: " + dropbox.outbox.length,
        "",
        "Use a full path to open a file."
      ].join("\\n");
    }
    els.viewOutput.textContent = "files view is shown below";
    return;
  }

  els.filesPanel.hidden = true;
  els.viewOutput.textContent = hud.lines.join("\\n");
}

async function submitCommand(input) {
  const payload = await postJson("/api/command", { input });
  renderResult(payload);

  if (payload.result && payload.result.viewerRequest) {
    if (payload.result.viewerRequest.kind === "explore") {
      state.selectedTab = "files";
    } else if (payload.result.viewerRequest.kind === "hud" || payload.result.viewerRequest.kind === "status") {
      state.selectedTab = "status";
    }
  }

  renderEdit(payload.result ? payload.result.editRequest : null);
  renderWorkflow(payload.result ? payload.result.workflowRequest : null);
  await refreshView();
}

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await submitCommand(button.getAttribute("data-command"));
    } catch (error) {
      els.resultOutput.textContent = String(error);
    }
  });
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", async () => {
    state.selectedTab = button.getAttribute("data-tab");
    state.selectedFilePath = "";
    await refreshView();
  });
});

els.commandForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = els.commandInput.value.trim();
  if (!input) {
    return;
  }
  els.commandInput.value = "";
  try {
    await submitCommand(input);
  } catch (error) {
    els.resultOutput.textContent = String(error);
  }
});

els.inboxForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await postJson("/api/dropbox/inbox", {
      filename: els.inboxFilename.value,
      content: els.inboxContent.value
    });
    renderResult(payload);
    els.inboxContent.value = "";
    await refreshView();
  } catch (error) {
    els.resultOutput.textContent = String(error);
  }
});

els.fileOpenForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fullPath = els.filePathInput.value.trim();
  if (!fullPath) {
    return;
  }
  try {
    const file = await getJson("/api/explore/file?path=" + encodeURIComponent(fullPath));
    state.selectedFilePath = fullPath;
    els.fileOutput.textContent = file.path + "\\n\\n" + file.content;
  } catch (error) {
    els.fileOutput.textContent = String(error);
  }
});

els.editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.pendingEdit) {
    return;
  }

  try {
    const payload = await postJson("/api/edit", {
      kind: state.pendingEdit.kind,
      target: state.pendingEdit.target,
      text: els.editText.value
    });
    renderResult(payload);
    renderEdit(null);
    await refreshView();
  } catch (error) {
    els.resultOutput.textContent = String(error);
  }
});

els.workflowForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.pendingWorkflow) {
    return;
  }

  const formData = new FormData(els.workflowForm);
  const body = {};
  for (const [key, value] of formData.entries()) {
    body[key] = String(value);
  }

  try {
    const payload = await postJson("/api/agent/create", body);
    renderResult(payload);
    renderWorkflow(null);
    await refreshView();
  } catch (error) {
    els.resultOutput.textContent = String(error);
  }
});

async function start() {
  await refreshView();
  state.refreshTimer = window.setInterval(() => {
    refreshView().catch((error) => {
      els.resultOutput.textContent = String(error);
    });
  }, 1500);
}

start().catch((error) => {
  els.resultOutput.textContent = String(error);
});
`;
}
