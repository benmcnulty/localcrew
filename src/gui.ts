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
        <h2>Resources</h2>
        <p id="resource-summary"></p>
        <div id="resource-list"></div>
        <form id="resource-form">
          <label>
            Alias
            <input id="resource-alias" name="alias" type="text" value="agent-2">
          </label>
          <label>
            Label
            <input id="resource-label" name="label" type="text" value="Second Device">
          </label>
          <label>
            Base URL
            <input id="resource-base-url" name="baseUrl" type="text" value="http://127.0.0.1:11434">
          </label>
          <label>
            Tier
            <select id="resource-tier" name="tier">
              <option value="top">top</option>
              <option value="mid" selected>mid</option>
              <option value="low">low</option>
            </select>
          </label>
          <label>
            API style
            <select id="resource-api-style" name="apiStyle">
              <option value="ollama" selected>ollama</option>
              <option value="openai">openai-compatible</option>
            </select>
          </label>
          <button type="submit">Add resource</button>
        </form>
      </section>

      <section>
        <h2>Orchestrator</h2>
        <p id="orchestrator-summary"></p>
        <form id="orchestrator-form">
          <label>
            Profile name
            <input id="orchestrator-name" name="name" type="text" value="Orchestrator">
          </label>
          <button type="submit">Save orchestrator name</button>
        </form>
      </section>

      <section>
        <h2>Participants</h2>
        <p id="participant-summary"></p>
        <div id="participant-list"></div>
        <form id="participant-form">
          <label>
            Alias
            <input id="participant-alias" name="alias" type="text" value="workhorse-chat">
          </label>
          <label>
            Resource
            <select id="participant-resource" name="resourceAlias"></select>
          </label>
          <label>
            Nickname
            <input id="participant-nickname" name="nickname" type="text" value="Second Voice">
          </label>
          <button type="submit">Add participant</button>
        </form>
      </section>

      <section>
        <h2>Direct Chat</h2>
        <form id="direct-chat-form">
          <label>
            Resource
            <select id="direct-resource" name="resourceAlias"></select>
          </label>
          <label>
            Model
            <select id="direct-model" name="model"></select>
          </label>
          <label>
            Message
            <textarea id="direct-message" name="message" rows="6"></textarea>
          </label>
          <button type="submit">Send direct chat</button>
        </form>
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
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

section {
  border: 1px solid #999;
  padding: 0.75rem;
}

form,
#command-buttons,
#tab-buttons,
#resource-list,
#participant-list {
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
#command-buttons,
#resource-list,
#participant-list {
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
}

textarea {
  width: 100%;
}

input,
select {
  width: 100%;
  box-sizing: border-box;
}

#result-output,
#view-output,
#tree-output,
#file-output {
  min-height: 8rem;
}

@media (max-width: 720px) {
  body {
    margin: 0.5rem;
  }

  main {
    grid-template-columns: 1fr;
  }
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
  orchestratorSummary: document.getElementById("orchestrator-summary"),
  orchestratorForm: document.getElementById("orchestrator-form"),
  orchestratorName: document.getElementById("orchestrator-name"),
  resourceSummary: document.getElementById("resource-summary"),
  resourceList: document.getElementById("resource-list"),
  resourceForm: document.getElementById("resource-form"),
  resourceAlias: document.getElementById("resource-alias"),
  resourceLabel: document.getElementById("resource-label"),
  resourceBaseUrl: document.getElementById("resource-base-url"),
  resourceTier: document.getElementById("resource-tier"),
  resourceApiStyle: document.getElementById("resource-api-style"),
  participantSummary: document.getElementById("participant-summary"),
  participantList: document.getElementById("participant-list"),
  participantForm: document.getElementById("participant-form"),
  participantAlias: document.getElementById("participant-alias"),
  participantResource: document.getElementById("participant-resource"),
  participantNickname: document.getElementById("participant-nickname"),
  directChatForm: document.getElementById("direct-chat-form"),
  directResource: document.getElementById("direct-resource"),
  directModel: document.getElementById("direct-model"),
  directMessage: document.getElementById("direct-message"),
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

function renderResources(resources) {
  els.resourceList.replaceChildren();
  els.resourceSummary.textContent =
    resources.length <= 1
      ? "One resource is configured. Run setup:node on the next device, then add or sync it here."
      : resources.length + " resources configured.";

  for (const resource of resources) {
    const card = document.createElement("div");
    const summary = document.createElement("pre");
    summary.textContent = [
      "@" + resource.alias + " - " + resource.label,
      "tier: " + resource.tier,
      "api: " + (resource.apiStyle || "ollama"),
      "baseUrl: " + resource.baseUrl,
      "defaultModel: " + resource.defaultModel,
      resource.hostName ? "host: " + resource.hostName : "",
      resource.platform ? "platform: " + resource.platform : "",
      resource.lastRefreshedAt ? "refreshed: " + resource.lastRefreshedAt : ""
    ]
      .filter(Boolean)
      .join("\\n");
    card.appendChild(summary);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit " + resource.alias;
    editButton.addEventListener("click", async () => {
      await submitCommand("/resource edit " + resource.alias);
    });
    card.appendChild(editButton);

    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.textContent = "Refresh models";
    refreshButton.addEventListener("click", async () => {
      const payload = await postJson("/api/resources/refresh", {
        alias: resource.alias
      });
      renderResult(payload);
      await refreshView();
    });
    card.appendChild(refreshButton);

    if (resources.length > 1) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Remove " + resource.alias;
      removeButton.addEventListener("click", async () => {
        const payload = await fetch("/api/resources?alias=" + encodeURIComponent(resource.alias), {
          method: "DELETE"
        }).then((response) => response.json());
        renderResult(payload);
        renderEdit(null);
        await refreshView();
      });
      card.appendChild(removeButton);
    }

    els.resourceList.appendChild(card);
  }
}

function renderResourceOptions(select, resources, selectedAlias) {
  select.replaceChildren();
  for (const resource of resources) {
    const option = document.createElement("option");
    option.value = resource.alias;
    option.textContent = "@" + resource.alias + " - " + resource.label;
    option.selected = resource.alias === selectedAlias;
    select.appendChild(option);
  }
}

function renderModelOptions(select, models, selectedModel) {
  select.replaceChildren();
  for (const model of models) {
    const option = document.createElement("option");
    option.value = model.name;
    option.textContent = model.name;
    option.selected = model.name === selectedModel;
    select.appendChild(option);
  }
}

async function loadModelsIntoSelect(target, select, selectedModel) {
  const snapshot = await getJson("/api/models?target=" + encodeURIComponent(target));
  renderModelOptions(select, snapshot.models || [], selectedModel);
}

async function renderParticipants(participants, resources) {
  els.participantList.replaceChildren();
  els.participantSummary.textContent =
    participants.length === 0
      ? "No group participants are configured yet."
      : participants.length + " participants configured for chat/group modes.";

  renderResourceOptions(els.participantResource, resources, resources[0] ? resources[0].alias : "");

  for (const participant of participants) {
    const card = document.createElement("div");
    const header = document.createElement("strong");
    header.textContent = "@" + participant.alias;
    card.appendChild(header);

    const nicknameLabel = document.createElement("label");
    nicknameLabel.textContent = "Nickname";
    const nicknameInput = document.createElement("input");
    nicknameInput.value = participant.nickname || participant.alias;
    nicknameLabel.appendChild(nicknameInput);
    card.appendChild(nicknameLabel);

    const resourceLabel = document.createElement("label");
    resourceLabel.textContent = "Resource";
    const resourceSelect = document.createElement("select");
    renderResourceOptions(resourceSelect, resources, participant.resourceAlias);
    resourceLabel.appendChild(resourceSelect);
    card.appendChild(resourceLabel);

    const modelLabel = document.createElement("label");
    modelLabel.textContent = "Model";
    const modelSelect = document.createElement("select");
    modelLabel.appendChild(modelSelect);
    card.appendChild(modelLabel);

    await loadModelsIntoSelect(participant.resourceAlias, modelSelect, participant.model);

    resourceSelect.addEventListener("change", async () => {
      await loadModelsIntoSelect(resourceSelect.value, modelSelect, "");
    });

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save " + participant.alias;
    saveButton.addEventListener("click", async () => {
      const payload = await postJson("/api/edit", {
        kind: "participant",
        target: participant.alias,
        text: JSON.stringify(
          {
            nickname: nicknameInput.value,
            resourceAlias: resourceSelect.value,
            model: modelSelect.value
          },
          null,
          2
        )
      });
      renderResult(payload);
      await refreshView();
    });
    card.appendChild(saveButton);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Advanced edit";
    editButton.addEventListener("click", async () => {
      await submitCommand("/participant edit " + participant.alias);
    });
    card.appendChild(editButton);

    if (participants.length > 1) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", async () => {
        const payload = await fetch("/api/participants?alias=" + encodeURIComponent(participant.alias), {
          method: "DELETE"
        }).then((response) => response.json());
        renderResult(payload);
        await refreshView();
      });
      card.appendChild(removeButton);
    }

    els.participantList.appendChild(card);
  }
}

async function refreshView() {
  const [status, chatConfig, hud, dropbox, resources] = await Promise.all([
    getJson("/api/status"),
    getJson("/api/chat-config"),
    state.selectedTab === "files" ? Promise.resolve(null) : getJson("/api/hud?tab=" + encodeURIComponent(state.selectedTab)),
    getJson("/api/dropbox"),
    getJson("/api/resources")
  ]);

  els.connectionLine.textContent = "Prompt: " + status.prompt;
  els.orchestratorSummary.textContent =
    "Orchestrator: " + chatConfig.orchestratorName + " | default participant: @" + chatConfig.defaultEndpoint;
  els.orchestratorName.value = chatConfig.orchestratorName;
  renderResources(resources);
  await renderParticipants(chatConfig.participants, resources);
  renderResourceOptions(els.directResource, resources, resources[0] ? resources[0].alias : "");
  if (els.directResource.value) {
    await loadModelsIntoSelect(els.directResource.value, els.directModel, els.directModel.value);
  }

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

els.resourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await postJson("/api/resources", {
      alias: els.resourceAlias.value,
      label: els.resourceLabel.value,
      baseUrl: els.resourceBaseUrl.value,
      tier: els.resourceTier.value,
      apiStyle: els.resourceApiStyle.value
    });
    renderResult(payload);
    els.resourceAlias.value = "agent-" + String(Math.max(2, Date.now() % 1000));
    els.resourceLabel.value = "Additional Device";
    await refreshView();
  } catch (error) {
    els.resultOutput.textContent = String(error);
  }
});

els.orchestratorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await postJson("/api/orchestrator", {
      name: els.orchestratorName.value
    });
    renderResult(payload);
    await refreshView();
  } catch (error) {
    els.resultOutput.textContent = String(error);
  }
});

els.participantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await postJson("/api/participants", {
      alias: els.participantAlias.value,
      resourceAlias: els.participantResource.value,
      nickname: els.participantNickname.value
    });
    renderResult(payload);
    els.participantAlias.value = "participant-" + String(Math.max(2, Date.now() % 1000));
    els.participantNickname.value = "Additional Participant";
    await refreshView();
  } catch (error) {
    els.resultOutput.textContent = String(error);
  }
});

els.directResource.addEventListener("change", async () => {
  try {
    await loadModelsIntoSelect(els.directResource.value, els.directModel, "");
  } catch (error) {
    els.resultOutput.textContent = String(error);
  }
});

els.directChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await postJson("/api/direct-chat", {
      resourceAlias: els.directResource.value,
      model: els.directModel.value,
      message: els.directMessage.value
    });
    renderResult(payload);
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
