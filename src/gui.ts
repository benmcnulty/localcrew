export function getGuiHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Crusty</title>
    <link rel="stylesheet" href="/ui/styles.css">
  </head>
  <body>
    <div id="app">
      <header id="topbar">
        <div class="topbar-left">
          <span class="logo">&#x2B21; Crusty</span>
          <span class="badge badge-dim">v0.1</span>
        </div>
        <div class="topbar-center">
          <span id="topbar-orchestrator" class="topbar-name"></span>
          <span id="topbar-dot" class="dot dot-gray"></span>
          <span id="topbar-status-text" class="topbar-status">connecting&hellip;</span>
        </div>
        <div class="topbar-right">
          <span class="badge badge-live">API Live</span>
        </div>
      </header>

      <div id="layout">
        <nav id="sidebar">
          <div class="nav-item active" data-section="dashboard">
            <span class="nav-icon">&#x25C8;</span><span>Dashboard</span>
          </div>
          <div class="nav-item" data-section="resources">
            <span class="nav-icon">&#x25C6;</span><span>Resources</span>
          </div>
          <div class="nav-item" data-section="participants">
            <span class="nav-icon">&#x25C9;</span><span>Participants</span>
          </div>
          <div class="nav-item" data-section="queue">
            <span class="nav-icon">&#x2261;</span><span>Queue &amp; Auto</span>
          </div>
          <div class="nav-item" data-section="direct">
            <span class="nav-icon">&#x21DD;</span><span>Direct Chat</span>
          </div>
          <div class="nav-item" data-section="dropbox">
            <span class="nav-icon">&#x229E;</span><span>Dropbox</span>
          </div>
          <div class="nav-item" data-section="explorer">
            <span class="nav-icon">&#x2338;</span><span>Explorer</span>
          </div>
          <div class="nav-item" data-section="settings">
            <span class="nav-icon">&#x2699;</span><span>Settings</span>
          </div>
        </nav>

        <main id="content">
          <!-- Dashboard -->
          <section id="section-dashboard">
            <div class="stat-grid">
              <div class="stat-tile">
                <div class="stat-value" id="stat-resources">&mdash;</div>
                <div class="stat-label">Resources</div>
              </div>
              <div class="stat-tile">
                <div class="stat-value" id="stat-mode">&mdash;</div>
                <div class="stat-label">Mode</div>
              </div>
              <div class="stat-tile">
                <div class="stat-value" id="stat-prompt">&mdash;</div>
                <div class="stat-label">Prompt</div>
              </div>
            </div>

            <div class="card">
              <div class="card-title">Controls</div>
              <div id="command-buttons" class="command-buttons">
                <button class="btn-ghost" data-command="/chat">/chat</button>
                <button class="btn-ghost" data-command="/group">/group</button>
                <button class="btn-ghost" data-command="/auto">/auto</button>
                <button class="btn-ghost" data-command="/stop">/stop</button>
                <button class="btn-ghost" data-command="/reset">/reset</button>
                <button class="btn-ghost" data-command="/clear">/clear</button>
                <button class="btn-ghost" data-command="/help">/help</button>
                <button class="btn-ghost" data-command="/status">/status</button>
              </div>
              <form id="command-form" class="input-row">
                <input id="command-input" name="command" type="text" autocomplete="off" placeholder="Command or message&hellip;">
                <button type="submit">Send</button>
              </form>
            </div>

            <div class="card">
              <div class="card-title-row">
                <span class="card-title">Live View</span>
                <div id="tab-buttons" class="tab-buttons">
                  <button class="tab-btn active" data-tab="status">status</button>
                  <button class="tab-btn" data-tab="queue">queue</button>
                  <button class="tab-btn" data-tab="metrics">metrics</button>
                  <button class="tab-btn" data-tab="detail">detail</button>
                </div>
              </div>
              <pre id="view-output"></pre>
            </div>

            <div class="card">
              <div class="card-title">Last Result</div>
              <pre id="result-output"></pre>
            </div>
          </section>

          <!-- Resources -->
          <section id="section-resources" hidden>
            <div class="card">
              <div class="card-title">Configured Resources</div>
              <p id="resource-summary" class="section-note"></p>
              <div id="resource-list" class="item-list"></div>
            </div>
            <div class="card">
              <div class="card-title">Add Resource</div>
              <form id="resource-form">
                <div class="form-grid">
                  <div class="field-group">
                    <label class="field-label">Alias</label>
                    <input id="resource-alias" name="alias" type="text" value="agent-2">
                  </div>
                  <div class="field-group">
                    <label class="field-label">Label</label>
                    <input id="resource-label" name="label" type="text" value="Agent Device">
                  </div>
                  <div class="field-group">
                    <label class="field-label">Base URL</label>
                    <input id="resource-base-url" name="baseUrl" type="text" value="http://127.0.0.1:11434">
                  </div>
                  <div class="field-group">
                    <label class="field-label">Tier</label>
                    <select id="resource-tier" name="tier">
                      <option value="top">top</option>
                      <option value="mid" selected>mid</option>
                      <option value="low">low</option>
                    </select>
                  </div>
                  <div class="field-group">
                    <label class="field-label">API Style</label>
                    <select id="resource-api-style" name="apiStyle">
                      <option value="ollama" selected>ollama</option>
                      <option value="openai">openai-compatible</option>
                      <option value="anthropic">anthropic</option>
                    </select>
                  </div>
                </div>
                <button type="submit">Add Resource</button>
              </form>
            </div>
          </section>

          <!-- Participants -->
          <section id="section-participants" hidden>
            <div class="card">
              <div class="card-title">Configured Participants</div>
              <p id="participant-summary" class="section-note"></p>
              <div id="participant-list" class="item-list"></div>
            </div>
            <div class="card">
              <div class="card-title">Add Participant</div>
              <form id="participant-form">
                <div class="form-grid">
                  <div class="field-group">
                    <label class="field-label">Alias</label>
                    <input id="participant-alias" name="alias" type="text" value="workhorse-chat">
                  </div>
                  <div class="field-group">
                    <label class="field-label">Resource</label>
                    <select id="participant-resource" name="resourceAlias"></select>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Nickname</label>
                    <input id="participant-nickname" name="nickname" type="text" value="Second Voice">
                  </div>
                </div>
                <button type="submit">Add Participant</button>
              </form>
            </div>
          </section>

          <!-- Queue & Auto -->
          <section id="section-queue" hidden>
            <div class="card">
              <div class="card-title">Auto Mode Controls</div>
              <div class="command-buttons">
                <button class="btn-ghost" data-command="/auto">Start /auto</button>
                <button class="btn-ghost" data-command="/stop">Stop /auto</button>
                <button class="btn-ghost" data-command="/daily status">Daily status</button>
                <button class="btn-ghost" data-command="/daily start">Start daily</button>
                <button class="btn-ghost" data-command="/daily finish">Finish daily</button>
              </div>
            </div>
            <div class="card">
              <div class="card-title">Queue</div>
              <pre id="queue-output"></pre>
            </div>
          </section>

          <!-- Direct Chat -->
          <section id="section-direct" hidden>
            <div class="card">
              <div class="card-title">Send Direct Message</div>
              <form id="direct-chat-form">
                <div class="form-grid">
                  <div class="field-group">
                    <label class="field-label">Resource</label>
                    <select id="direct-resource" name="resourceAlias"></select>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Model</label>
                    <select id="direct-model" name="model"></select>
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label">Message</label>
                  <textarea id="direct-message" name="message" rows="5" placeholder="Send a message directly to a resource&hellip;"></textarea>
                </div>
                <button type="submit">Send</button>
              </form>
            </div>
            <div class="card">
              <div class="card-title">Response</div>
              <pre id="direct-result-output">(no response yet)</pre>
            </div>
          </section>

          <!-- Dropbox -->
          <section id="section-dropbox" hidden>
            <div class="card">
              <div class="card-title">Dropbox Status</div>
              <pre id="dropbox-status-output"></pre>
            </div>
            <div class="card">
              <div class="card-title">Write to Inbox</div>
              <form id="inbox-form">
                <div class="field-group">
                  <label class="field-label">File name</label>
                  <input id="inbox-filename" name="filename" type="text" value="task.md">
                </div>
                <div class="field-group">
                  <label class="field-label">Document content</label>
                  <textarea id="inbox-content" name="content" rows="10" placeholder="Markdown task or document content&hellip;"></textarea>
                </div>
                <button type="submit">Write to Inbox</button>
              </form>
            </div>
          </section>

          <!-- Explorer -->
          <section id="section-explorer" hidden>
            <div class="card">
              <div class="card-title">File Tree</div>
              <pre id="tree-output"></pre>
            </div>
            <div class="card">
              <div class="card-title">Open File</div>
              <form id="file-open-form" class="input-row">
                <input id="file-path-input" type="text" autocomplete="off" placeholder="Full path&hellip;">
                <button type="submit">Open</button>
              </form>
              <pre id="file-output" style="margin-top:12px"></pre>
            </div>
          </section>

          <!-- Settings -->
          <section id="section-settings" hidden>
            <div class="card">
              <div class="card-title">Orchestrator Identity</div>
              <p id="orchestrator-summary" class="section-note"></p>
              <form id="orchestrator-form">
                <div class="field-group">
                  <label class="field-label">Profile name</label>
                  <input id="orchestrator-name" name="name" type="text" value="Orchestrator">
                </div>
                <button type="submit" style="margin-top:10px">Save Name</button>
              </form>
            </div>
            <div class="card">
              <div class="card-title">User Preferences</div>
              <p class="section-note">Stored in your local .crusty configuration. Used by weather, website, and daily digest tools.</p>
              <form id="preferences-form">
                <div class="form-grid">
                  <div class="field-group">
                    <label class="field-label">City (weather default)</label>
                    <input id="pref-city" name="city" type="text" placeholder="San Francisco">
                  </div>
                  <div class="field-group">
                    <label class="field-label">Zip code (weather default)</label>
                    <input id="pref-zip" name="zipCode" type="text" placeholder="94102">
                  </div>
                  <div class="field-group" style="grid-column:1/-1">
                    <label class="field-label">Personal website URL</label>
                    <input id="pref-website" name="personalWebsiteUrl" type="text" placeholder="https://example.com">
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label">Daily digest directive</label>
                  <textarea id="pref-directive" name="dailyDigestDirective" rows="3" placeholder="Instructions for daily summaries&hellip;"></textarea>
                </div>
                <button type="submit" style="margin-top:10px">Save Preferences</button>
              </form>
            </div>
          </section>
        </main>
      </div>

      <!-- Modal overlay (edit + workflow) -->
      <div id="modal-overlay" class="modal-overlay" hidden>
        <div class="modal-card">
          <section id="edit-panel" hidden>
            <div class="card-title">Edit</div>
            <p id="edit-target" class="section-note"></p>
            <form id="edit-form">
              <textarea id="edit-text" rows="16"></textarea>
              <div class="modal-actions">
                <button type="submit">Save</button>
                <button type="button" id="edit-cancel" class="btn-ghost">Cancel</button>
              </div>
            </form>
          </section>
          <section id="workflow-panel" hidden>
            <div class="card-title">New Agent</div>
            <div id="workflow-intro"></div>
            <form id="workflow-form"></form>
          </section>
        </div>
      </div>

      <!-- Compatibility shims (referenced by JS, not visible) -->
      <div id="connection-line" style="display:none"></div>
      <div id="remote-plan-line" style="display:none"></div>
      <div id="files-panel" style="display:none"></div>
    </div>
    <script type="module" src="/ui/app.js"></script>
  </body>
</html>`;
}

export function getGuiStyles(): string {
  return `*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  height: 100%;
  margin: 0;
  background: #0d0f14;
  color: #e8eaf0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* ── Topbar ── */

#topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 20px;
  background: #0a0c10;
  border-bottom: 1px solid #2a2d3e;
  flex-shrink: 0;
  gap: 16px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.logo {
  font-size: 17px;
  font-weight: 700;
  color: #4f8ef7;
  letter-spacing: -0.02em;
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.topbar-name {
  font-size: 13px;
  color: #c8cbda;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-status {
  font-size: 12px;
  color: #6b7280;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── Layout ── */

#layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Sidebar ── */

#sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #101318;
  border-right: 1px solid #2a2d3e;
  padding: 12px 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  cursor: pointer;
  color: #6b7280;
  border-left: 2px solid transparent;
  font-size: 13px;
  font-weight: 500;
  transition: color 0.1s, background 0.1s;
  user-select: none;
}

.nav-item:hover {
  color: #c8cbda;
  background: #161921;
}

.nav-item.active {
  color: #4f8ef7;
  background: #1e2130;
  border-left-color: #4f8ef7;
}

.nav-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

/* ── Content ── */

#content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Cards ── */

.card {
  background: #141720;
  border: 1px solid #2a2d3e;
  border-radius: 8px;
  padding: 18px 20px;
}

.card-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
  margin-bottom: 14px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.card-title-row .card-title {
  margin-bottom: 0;
}

.section-note {
  font-size: 13px;
  color: #9ca3af;
  margin: 0 0 12px;
}

/* ── Stat Grid ── */

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-tile {
  background: #141720;
  border: 1px solid #2a2d3e;
  border-radius: 8px;
  padding: 16px 20px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #e8eaf0;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

/* ── Buttons ── */

button {
  font: inherit;
  cursor: pointer;
  border-radius: 5px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  transition: opacity 0.1s;
}

button:hover {
  opacity: 0.85;
}

button[type="submit"] {
  background: #4f8ef7;
  color: #fff;
}

.btn-ghost {
  background: #1e2130;
  color: #c8cbda;
  border: 1px solid #2a2d3e;
}

.btn-ghost:hover {
  background: #252840;
  opacity: 1;
}

.btn-destructive {
  background: transparent;
  color: #e05252;
  border: 1px solid #4a2020;
}

.btn-destructive:hover {
  background: #2a1515;
  opacity: 1;
}

/* ── Command Buttons ── */

.command-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

/* ── Tab Buttons ── */

.tab-buttons {
  display: flex;
  gap: 4px;
}

.tab-btn {
  background: transparent;
  border: 1px solid #2a2d3e;
  color: #6b7280;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
}

.tab-btn.active {
  background: #1e2130;
  color: #4f8ef7;
  border-color: #4f8ef7;
}

/* ── Input Row ── */

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
}

/* ── Forms ── */

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

input,
select,
textarea {
  font: inherit;
  background: #0d0f14;
  border: 1px solid #2a2d3e;
  border-radius: 5px;
  color: #e8eaf0;
  padding: 7px 10px;
  width: 100%;
  font-size: 13px;
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #4f8ef7;
}

textarea {
  resize: vertical;
  min-height: 80px;
}

select {
  cursor: pointer;
}

/* ── Pre / Output ── */

pre {
  font-family: "SF Mono", "Fira Code", ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.65;
  color: #c8cbda;
  background: #0a0c10;
  border: 1px solid #1e2130;
  border-radius: 5px;
  padding: 12px 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  min-height: 64px;
  max-height: 420px;
  overflow-y: auto;
  margin: 0;
}

/* ── Item Lists ── */

.item-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.item-card {
  background: #0d0f14;
  border: 1px solid #2a2d3e;
  border-radius: 6px;
  padding: 12px 14px;
}

.item-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.item-alias {
  font-size: 13px;
  font-weight: 600;
  color: #4f8ef7;
  font-family: "SF Mono", ui-monospace, monospace;
}

.item-tier {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 3px;
  font-weight: 600;
}

.tier-top { background: #1a3a25; color: #4caf7d; }
.tier-mid { background: #2a2d1a; color: #c8a83a; }
.tier-low { background: #2a1e1e; color: #9c5a5a; }

.item-meta {
  font-size: 12px;
  color: #6b7280;
  font-family: "SF Mono", ui-monospace, monospace;
  margin-bottom: 10px;
}

.item-actions {
  display: flex;
  gap: 6px;
}

.item-actions button {
  padding: 4px 10px;
  font-size: 12px;
}

/* ── Badges & Dots ── */

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
}

.badge-live { background: #163d29; color: #4caf7d; }
.badge-dim  { background: #1e2130; color: #6b7280; }

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.dot-green { background: #4caf7d; }
.dot-red   { background: #e05252; }
.dot-gray  { background: #4b5563; }

/* ── Modal Overlay ── */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 24px;
}

.modal-card {
  background: #141720;
  border: 1px solid #2a2d3e;
  border-radius: 10px;
  padding: 24px;
  width: 100%;
  max-width: 680px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

/* ── Responsive ── */

@media (max-width: 800px) {
  #sidebar {
    display: none;
  }

  #content {
    padding: 16px;
  }

  .stat-grid {
    grid-template-columns: 1fr 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
`;
}

export function getGuiScript(): string {
  return `const state = {
  selectedSection: "dashboard",
  selectedTab: "status",
  selectedFilePath: "",
  pendingEdit: null,
  pendingWorkflow: null,
  refreshTimer: null,
  apiToken: ""
};

const els = {
  topbarOrchestrator: document.getElementById("topbar-orchestrator"),
  topbarDot: document.getElementById("topbar-dot"),
  topbarStatusText: document.getElementById("topbar-status-text"),
  statResources: document.getElementById("stat-resources"),
  statMode: document.getElementById("stat-mode"),
  statPrompt: document.getElementById("stat-prompt"),
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
  directResultOutput: document.getElementById("direct-result-output"),
  treeOutput: document.getElementById("tree-output"),
  fileOutput: document.getElementById("file-output"),
  fileOpenForm: document.getElementById("file-open-form"),
  filePathInput: document.getElementById("file-path-input"),
  inboxForm: document.getElementById("inbox-form"),
  inboxFilename: document.getElementById("inbox-filename"),
  inboxContent: document.getElementById("inbox-content"),
  dropboxStatusOutput: document.getElementById("dropbox-status-output"),
  queueOutput: document.getElementById("queue-output"),
  editPanel: document.getElementById("edit-panel"),
  editTarget: document.getElementById("edit-target"),
  editForm: document.getElementById("edit-form"),
  editText: document.getElementById("edit-text"),
  workflowPanel: document.getElementById("workflow-panel"),
  workflowIntro: document.getElementById("workflow-intro"),
  workflowForm: document.getElementById("workflow-form"),
  filesPanel: document.getElementById("files-panel"),
  modalOverlay: document.getElementById("modal-overlay"),
  preferencesForm: document.getElementById("preferences-form"),
  prefCity: document.getElementById("pref-city"),
  prefZip: document.getElementById("pref-zip"),
  prefWebsite: document.getElementById("pref-website"),
  prefDirective: document.getElementById("pref-directive"),
  connectionLine: document.getElementById("connection-line")
};

function selectSection(name) {
  state.selectedSection = name;
  document.querySelectorAll("[id^='section-']").forEach((el) => {
    el.hidden = el.id !== "section-" + name;
  });
  document.querySelectorAll(".nav-item[data-section]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-section") === name);
  });
}

function initializeApiToken() {
  const url = new URL(window.location.href);
  const queryToken = url.searchParams.get("token") || "";
  const storedToken = window.sessionStorage.getItem("crustyApiToken") || "";
  const token = queryToken || storedToken;

  if (queryToken) {
    window.sessionStorage.setItem("crustyApiToken", queryToken);
    url.searchParams.delete("token");
    window.history.replaceState({}, document.title, url.toString());
  }

  state.apiToken = token;
}

function buildApiHeaders(extraHeaders) {
  const headers = { ...(extraHeaders || {}) };
  if (state.apiToken) {
    headers.authorization = "Bearer " + state.apiToken;
  }
  return headers;
}

async function getJson(path) {
  const response = await fetch(path, { headers: buildApiHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: buildApiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function deleteJson(path) {
  const response = await fetch(path, { method: "DELETE", headers: buildApiHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function renderResult(payload) {
  const lines = [];
  if (payload.result) {
    if (payload.result.lines && payload.result.lines.length > 0) lines.push(...payload.result.lines);
    if (payload.result.errors && payload.result.errors.length > 0) {
      lines.push("", "Errors:", ...payload.result.errors);
    }
  }
  if (els.resultOutput) els.resultOutput.textContent = lines.join("\\n") || "(no output)";
}

function renderWorkflow(request) {
  state.pendingWorkflow = request || null;
  if (els.workflowPanel) els.workflowPanel.hidden = !request;
  if (els.editPanel) els.editPanel.hidden = true;
  if (els.modalOverlay) els.modalOverlay.hidden = !request;
  if (els.workflowForm) els.workflowForm.replaceChildren();
  if (els.workflowIntro) els.workflowIntro.replaceChildren();

  if (!request) return;

  for (const line of request.introLines || []) {
    const p = document.createElement("p");
    p.textContent = line;
    els.workflowIntro.appendChild(p);
  }

  for (const question of request.questions || []) {
    const group = document.createElement("div");
    group.className = "field-group";
    const label = document.createElement("label");
    label.className = "field-label";
    label.textContent = question.prompt;
    const input = document.createElement("input");
    input.name = question.key;
    input.type = "text";
    group.appendChild(label);
    group.appendChild(input);
    els.workflowForm.appendChild(group);
  }

  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Create agent";
  button.style.marginTop = "12px";
  els.workflowForm.appendChild(button);
}

function renderEdit(request) {
  state.pendingEdit = request || null;
  if (els.editPanel) els.editPanel.hidden = !request;
  if (els.workflowPanel) els.workflowPanel.hidden = true;
  if (els.modalOverlay) els.modalOverlay.hidden = !request;
  if (!request) {
    if (els.editTarget) els.editTarget.textContent = "";
    if (els.editText) els.editText.value = "";
    return;
  }
  if (els.editTarget) els.editTarget.textContent = request.prompt;
  if (els.editText) els.editText.value = request.initialText || "";
}

function renderResources(resources) {
  if (!els.resourceList) return;
  els.resourceList.replaceChildren();
  if (els.resourceSummary) {
    els.resourceSummary.textContent =
      resources.length <= 1
        ? "One resource configured. Run setup-agent.js on agent devices to add more."
        : resources.length + " resources configured.";
  }

  for (const resource of resources) {
    const card = document.createElement("div");
    card.className = "item-card";

    const header = document.createElement("div");
    header.className = "item-card-header";

    const alias = document.createElement("span");
    alias.className = "item-alias";
    alias.textContent = "@" + resource.alias;
    header.appendChild(alias);

    const tier = document.createElement("span");
    tier.className = "item-tier tier-" + (resource.tier || "mid");
    tier.textContent = resource.tier || "mid";
    header.appendChild(tier);
    card.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "item-meta";
    meta.textContent = [
      resource.label,
      resource.apiStyle || "ollama",
      resource.baseUrl,
      resource.defaultModel || ""
    ].filter(Boolean).join(" · ");
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-ghost";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", async () => { await submitCommand("/resource edit " + resource.alias); });
    actions.appendChild(editBtn);

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "btn-ghost";
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", async () => {
      const payload = await postJson("/api/resources/refresh", { alias: resource.alias });
      renderResult(payload);
      await refreshView();
    });
    actions.appendChild(refreshBtn);

    if (resources.length > 1) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn-destructive";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        const payload = await deleteJson("/api/resources?alias=" + encodeURIComponent(resource.alias));
        renderResult(payload);
        renderEdit(null);
        await refreshView();
      });
      actions.appendChild(removeBtn);
    }

    card.appendChild(actions);
    els.resourceList.appendChild(card);
  }
}

function renderResourceOptions(select, resources, selectedAlias) {
  if (!select) return;
  select.replaceChildren();
  for (const resource of resources) {
    const option = document.createElement("option");
    option.value = resource.alias;
    option.textContent = "@" + resource.alias + " — " + resource.label;
    option.selected = resource.alias === selectedAlias;
    select.appendChild(option);
  }
}

function renderModelOptions(select, models, selectedModel) {
  if (!select) return;
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
  if (!els.participantList) return;
  els.participantList.replaceChildren();
  if (els.participantSummary) {
    els.participantSummary.textContent =
      participants.length === 0
        ? "No group participants configured yet."
        : participants.length + " participants configured for chat/group modes.";
  }

  renderResourceOptions(els.participantResource, resources, resources[0] ? resources[0].alias : "");

  for (const participant of participants) {
    const card = document.createElement("div");
    card.className = "item-card";

    const header = document.createElement("div");
    header.className = "item-card-header";
    const aliasEl = document.createElement("span");
    aliasEl.className = "item-alias";
    aliasEl.textContent = "@" + participant.alias;
    header.appendChild(aliasEl);
    card.appendChild(header);

    const form = document.createElement("div");
    form.className = "form-grid";
    form.style.marginBottom = "0";

    const nickGroup = document.createElement("div");
    nickGroup.className = "field-group";
    const nickLabel = document.createElement("label");
    nickLabel.className = "field-label";
    nickLabel.textContent = "Nickname";
    const nickInput = document.createElement("input");
    nickInput.value = participant.nickname || participant.alias;
    nickGroup.appendChild(nickLabel);
    nickGroup.appendChild(nickInput);
    form.appendChild(nickGroup);

    const resGroup = document.createElement("div");
    resGroup.className = "field-group";
    const resLabel = document.createElement("label");
    resLabel.className = "field-label";
    resLabel.textContent = "Resource";
    const resourceSelect = document.createElement("select");
    renderResourceOptions(resourceSelect, resources, participant.resourceAlias);
    resGroup.appendChild(resLabel);
    resGroup.appendChild(resourceSelect);
    form.appendChild(resGroup);

    const modelGroup = document.createElement("div");
    modelGroup.className = "field-group";
    const modelLabel = document.createElement("label");
    modelLabel.className = "field-label";
    modelLabel.textContent = "Model";
    const modelSelect = document.createElement("select");
    modelGroup.appendChild(modelLabel);
    modelGroup.appendChild(modelSelect);
    form.appendChild(modelGroup);

    await loadModelsIntoSelect(participant.resourceAlias, modelSelect, participant.model);

    resourceSelect.addEventListener("change", async () => {
      await loadModelsIntoSelect(resourceSelect.value, modelSelect, "");
    });

    card.appendChild(form);

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.style.marginTop = "10px";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      const payload = await postJson("/api/edit", {
        kind: "participant",
        target: participant.alias,
        text: JSON.stringify(
          { nickname: nickInput.value, resourceAlias: resourceSelect.value, model: modelSelect.value },
          null, 2
        )
      });
      renderResult(payload);
      await refreshView();
    });
    actions.appendChild(saveBtn);

    const advBtn = document.createElement("button");
    advBtn.className = "btn-ghost";
    advBtn.textContent = "Advanced";
    advBtn.addEventListener("click", async () => { await submitCommand("/participant edit " + participant.alias); });
    actions.appendChild(advBtn);

    if (participants.length > 1) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn-destructive";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        const payload = await deleteJson("/api/participants?alias=" + encodeURIComponent(participant.alias));
        renderResult(payload);
        await refreshView();
      });
      actions.appendChild(removeBtn);
    }

    card.appendChild(actions);
    els.participantList.appendChild(card);
  }
}

async function refreshView() {
  const [status, chatConfig, dropbox, resources] = await Promise.all([
    getJson("/api/status"),
    getJson("/api/chat-config"),
    getJson("/api/dropbox"),
    getJson("/api/resources")
  ]);

  // Topbar
  if (els.topbarOrchestrator) els.topbarOrchestrator.textContent = chatConfig.orchestratorName || "";
  if (els.topbarDot) { els.topbarDot.className = "dot dot-green"; }
  if (els.topbarStatusText) els.topbarStatusText.textContent = "connected";
  if (els.connectionLine) els.connectionLine.textContent = "Prompt: " + (status.prompt || "");

  // Stats
  if (els.statResources) els.statResources.textContent = String(resources.length);
  if (els.statMode) els.statMode.textContent = status.mode || "command";
  if (els.statPrompt) {
    const p = status.prompt || "";
    els.statPrompt.textContent = p.length > 18 ? p.slice(0, 16) + "…" : p || "—";
  }

  // Settings panel
  if (els.orchestratorSummary) {
    els.orchestratorSummary.textContent =
      "Orchestrator: " + chatConfig.orchestratorName + " | default: @" + chatConfig.defaultEndpoint;
  }
  if (els.orchestratorName) els.orchestratorName.value = chatConfig.orchestratorName;

  // Resources & participants
  renderResources(resources);
  await renderParticipants(chatConfig.participants, resources);
  renderResourceOptions(els.directResource, resources, resources[0] ? resources[0].alias : "");
  if (els.directResource && els.directResource.value && els.directModel) {
    await loadModelsIntoSelect(els.directResource.value, els.directModel, els.directModel.value);
  }

  // Dropbox status
  if (els.dropboxStatusOutput) {
    els.dropboxStatusOutput.textContent = [
      "inbox:  " + dropbox.inbox.length + " file(s)",
      "active: " + dropbox.active.length + " file(s)",
      "outbox: " + dropbox.outbox.length + " file(s)"
    ].join("\\n");
  }

  // Section-specific content
  if (state.selectedSection === "dashboard") {
    const hud = await getJson("/api/hud?tab=" + encodeURIComponent(state.selectedTab));
    if (els.viewOutput) els.viewOutput.textContent = hud.lines.join("\\n");
  } else if (state.selectedSection === "queue") {
    const hud = await getJson("/api/hud?tab=queue");
    if (els.queueOutput) els.queueOutput.textContent = hud.lines.join("\\n");
  } else if (state.selectedSection === "explorer") {
    const tree = await getJson("/api/explore/tree");
    if (els.treeOutput) els.treeOutput.textContent = tree.lines.join("\\n");
    if (!state.selectedFilePath && els.fileOutput) {
      els.fileOutput.textContent = [
        "Dropbox:",
        "  inbox:  " + dropbox.inbox.length,
        "  active: " + dropbox.active.length,
        "  outbox: " + dropbox.outbox.length,
        "",
        "Enter a full path above to open a file."
      ].join("\\n");
    }
  }
}

async function submitCommand(input) {
  const payload = await postJson("/api/command", { input });
  renderResult(payload);

  if (payload.result && payload.result.viewerRequest) {
    if (payload.result.viewerRequest.kind === "explore") {
      selectSection("explorer");
    } else if (
      payload.result.viewerRequest.kind === "hud" ||
      payload.result.viewerRequest.kind === "status"
    ) {
      selectSection("dashboard");
    }
  }

  renderEdit(payload.result ? payload.result.editRequest : null);
  renderWorkflow(payload.result ? payload.result.workflowRequest : null);
  await refreshView();
}

// Nav item click handlers
document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
  item.addEventListener("click", async () => {
    selectSection(item.getAttribute("data-section"));
    try { await refreshView(); } catch (error) {
      if (els.resultOutput) els.resultOutput.textContent = String(error);
    }
  });
});

// Command button click handlers
document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", async () => {
    try { await submitCommand(button.getAttribute("data-command")); } catch (error) {
      if (els.resultOutput) els.resultOutput.textContent = String(error);
    }
  });
});

// Tab button click handlers (live view tabs in dashboard)
document.querySelectorAll(".tab-btn[data-tab]").forEach((button) => {
  button.addEventListener("click", async () => {
    state.selectedTab = button.getAttribute("data-tab");
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === state.selectedTab);
    });
    state.selectedFilePath = "";
    try { await refreshView(); } catch (error) {
      if (els.resultOutput) els.resultOutput.textContent = String(error);
    }
  });
});

// Command form
els.commandForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = els.commandInput.value.trim();
  if (!input) return;
  els.commandInput.value = "";
  try { await submitCommand(input); } catch (error) {
    if (els.resultOutput) els.resultOutput.textContent = String(error);
  }
});

// Inbox form
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
    if (els.resultOutput) els.resultOutput.textContent = String(error);
  }
});

// Resource form
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
    els.resourceLabel.value = "Agent Device";
    await refreshView();
  } catch (error) {
    if (els.resultOutput) els.resultOutput.textContent = String(error);
  }
});

// Orchestrator form
els.orchestratorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await postJson("/api/orchestrator", { name: els.orchestratorName.value });
    renderResult(payload);
    await refreshView();
  } catch (error) {
    if (els.resultOutput) els.resultOutput.textContent = String(error);
  }
});

// Participant form
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
    if (els.resultOutput) els.resultOutput.textContent = String(error);
  }
});

// Direct chat resource change
els.directResource.addEventListener("change", async () => {
  try { await loadModelsIntoSelect(els.directResource.value, els.directModel, ""); } catch (error) {
    if (els.resultOutput) els.resultOutput.textContent = String(error);
  }
});

// Direct chat form
els.directChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await postJson("/api/direct-chat", {
      resourceAlias: els.directResource.value,
      model: els.directModel.value,
      message: els.directMessage.value
    });
    renderResult(payload);
    if (els.directResultOutput && payload.result) {
      const lines = payload.result.lines && payload.result.lines.length > 0 ? payload.result.lines : [];
      els.directResultOutput.textContent = lines.join("\\n") || "(no output)";
    }
  } catch (error) {
    if (els.resultOutput) els.resultOutput.textContent = String(error);
    if (els.directResultOutput) els.directResultOutput.textContent = String(error);
  }
});

// File open form
els.fileOpenForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fullPath = els.filePathInput.value.trim();
  if (!fullPath) return;
  try {
    const file = await getJson("/api/explore/file?path=" + encodeURIComponent(fullPath));
    state.selectedFilePath = fullPath;
    if (els.fileOutput) els.fileOutput.textContent = file.path + "\\n\\n" + file.content;
  } catch (error) {
    if (els.fileOutput) els.fileOutput.textContent = String(error);
  }
});

// Edit form
els.editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.pendingEdit) return;
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
    if (els.resultOutput) els.resultOutput.textContent = String(error);
  }
});

// Edit cancel
const editCancelBtn = document.getElementById("edit-cancel");
if (editCancelBtn) {
  editCancelBtn.addEventListener("click", () => {
    renderEdit(null);
    renderWorkflow(null);
  });
}

// Workflow form
els.workflowForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.pendingWorkflow) return;
  const formData = new FormData(els.workflowForm);
  const body = {};
  for (const [key, value] of formData.entries()) body[key] = String(value);
  try {
    const payload = await postJson("/api/agent/create", body);
    renderResult(payload);
    renderWorkflow(null);
    await refreshView();
  } catch (error) {
    if (els.resultOutput) els.resultOutput.textContent = String(error);
  }
});

// Preferences form
if (els.preferencesForm) {
  els.preferencesForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const prefs = [
      ["city", els.prefCity ? els.prefCity.value.trim() : ""],
      ["zipCode", els.prefZip ? els.prefZip.value.trim() : ""],
      ["personalWebsiteUrl", els.prefWebsite ? els.prefWebsite.value.trim() : ""],
      ["dailyDigestDirective", els.prefDirective ? els.prefDirective.value.trim() : ""]
    ].filter(([, val]) => val !== "");
    try {
      for (const [key, value] of prefs) {
        await postJson("/api/command", { input: "/preferences set " + key + " " + JSON.stringify(value) });
      }
      if (els.resultOutput) els.resultOutput.textContent = "Preferences saved.";
    } catch (error) {
      if (els.resultOutput) els.resultOutput.textContent = String(error);
    }
  });
}

async function start() {
  initializeApiToken();
  await refreshView();
  state.refreshTimer = window.setInterval(() => {
    refreshView().catch((error) => {
      if (els.resultOutput) els.resultOutput.textContent = String(error);
    });
  }, 1500);
}

start().catch((error) => {
  if (els.resultOutput) els.resultOutput.textContent = String(error);
  if (els.topbarDot) els.topbarDot.className = "dot dot-red";
  if (els.topbarStatusText) els.topbarStatusText.textContent = "connection failed";
});
`;
}

// ---------------------------------------------------------------------------
// /display — read-only, real-time observability dashboard
// Self-contained single HTML file (inline CSS + JS, no external assets).
// Responsive across mobile, tablet, desktop, HD billboard, and UHD billboard.
// ---------------------------------------------------------------------------
export function getDisplayHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>Crusty &middot; Display</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #070910;
      --surface:  #0d1018;
      --surface2: #111520;
      --border:   #1c2030;
      --accent:   #4f8ef7;
      --success:  #4caf7d;
      --warning:  #f0a04b;
      --danger:   #e05252;
      --text:     #d8dce8;
      --muted:    #3a4055;
      --muted2:   #5a6378;
      --topbar-h: 48px;
      --logbar-h: 90px;
      --gap:      10px;
      --pad:      14px;
      --radius:   8px;
      --fs-xs:     0.6rem;
      --fs-sm:     0.72rem;
      --fs-base:   0.82rem;
      --fs-md:     0.95rem;
      --fs-lg:     1.15rem;
      --fs-xl:     1.7rem;
      --fs-metric: 2rem;
      --fs-task:   1rem;
    }
    @media (min-width: 768px) {
      :root {
        --topbar-h:52px;--logbar-h:96px;--gap:12px;--pad:16px;
        --fs-sm:0.76rem;--fs-base:0.86rem;--fs-md:1rem;
        --fs-xl:2rem;--fs-metric:2.8rem;--fs-task:1.05rem;
      }
    }
    @media (min-width: 1200px) {
      :root {
        --topbar-h:56px;--logbar-h:104px;--gap:16px;--pad:20px;
        --fs-xs:0.65rem;--fs-sm:0.78rem;--fs-base:0.88rem;--fs-md:1rem;
        --fs-lg:1.25rem;--fs-xl:2.2rem;--fs-metric:3rem;--fs-task:1.15rem;
      }
    }
    @media (min-width: 1920px) {
      :root {
        --topbar-h:76px;--logbar-h:128px;--gap:24px;--pad:28px;--radius:12px;
        --fs-xs:0.95rem;--fs-sm:1.15rem;--fs-base:1.35rem;--fs-md:1.65rem;
        --fs-lg:2.1rem;--fs-xl:3.2rem;
        --fs-metric:clamp(4rem,4.8vw,9rem);
        --fs-task:clamp(1.7rem,2.2vw,4rem);
      }
    }
    @media (min-width: 3840px) {
      :root {
        --topbar-h:120px;--logbar-h:220px;--gap:40px;--pad:48px;--radius:18px;
        --fs-xs:1.7rem;--fs-sm:2.1rem;--fs-base:2.5rem;--fs-md:3rem;
        --fs-lg:3.8rem;--fs-xl:5.5rem;
        --fs-metric:clamp(7rem,7.5vw,15rem);
        --fs-task:clamp(3rem,3.8vw,7rem);
      }
    }
    html,body{height:100%;width:100%;overflow:hidden;background:var(--bg);color:var(--text);
      font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:var(--fs-base);
      -webkit-font-smoothing:antialiased;}
    #dapp{display:flex;flex-direction:column;height:100vh;width:100vw;overflow:hidden;}

    /* Topbar */
    #dtop{display:flex;align-items:center;justify-content:space-between;
      height:var(--topbar-h);min-height:var(--topbar-h);
      background:#04060a;border-bottom:1px solid var(--border);
      padding:0 var(--pad);gap:var(--gap);flex-shrink:0;}
    .dlogo{font-size:var(--fs-lg);font-weight:700;color:var(--accent);
      letter-spacing:-0.02em;white-space:nowrap;flex-shrink:0;}
    .dtop-center{display:flex;align-items:center;gap:0.55em;overflow:hidden;
      flex:1;justify-content:center;}
    #dorch{font-size:var(--fs-md);font-weight:600;overflow:hidden;
      text-overflow:ellipsis;white-space:nowrap;}
    #dmode{font-size:var(--fs-xs);font-weight:700;letter-spacing:0.08em;
      text-transform:uppercase;padding:0.2em 0.65em;border-radius:3px;
      background:var(--surface2);color:var(--muted2);border:1px solid var(--border);
      white-space:nowrap;flex-shrink:0;}
    #dmode.m-auto{background:#091f12;color:var(--success);border-color:#153520;}
    #dmode.m-chat,#dmode.m-group{background:#091328;color:var(--accent);border-color:#142250;}
    #dmode.m-agent{background:#201508;color:var(--warning);border-color:#3a2810;}
    .dtop-right{display:flex;align-items:center;gap:0.65em;white-space:nowrap;flex-shrink:0;}
    #dclock{font-size:var(--fs-md);font-variant-numeric:tabular-nums;color:var(--muted2);
      font-family:"SF Mono","Fira Code",ui-monospace,monospace;}
    .ddot{display:inline-block;width:0.6em;height:0.6em;border-radius:50%;
      background:var(--muted);flex-shrink:0;}
    .ddot-green{background:var(--success);box-shadow:0 0 6px var(--success);}
    .ddot-amber{background:var(--warning);box-shadow:0 0 6px var(--warning);}
    .ddot-red{background:var(--danger);}
    @keyframes dpulse{0%,100%{opacity:1;}50%{opacity:0.25;}}
    .dpulse{animation:dpulse 1.4s ease-in-out infinite;}

    /* Body */
    #dbody{display:flex;flex:1;overflow:hidden;gap:var(--gap);
      padding:var(--gap);padding-bottom:0;}
    @media(max-width:767px){#dbody{flex-direction:column;overflow-y:auto;}}
    @media(min-width:768px)and(max-width:1199px){
      #dbody{flex-direction:row;flex-wrap:wrap;align-content:flex-start;}
      #dpnet{flex:0 0 calc(42% - var(--gap)/2);}#dpmain{flex:1;min-width:0;}
      #dpmet{flex:0 0 100%;flex-direction:row;gap:var(--gap);}
    }
    @media(min-width:1200px){
      #dpnet{flex:0 0 210px;}#dpmain{flex:1;min-width:0;}#dpmet{flex:0 0 230px;}
    }
    @media(min-width:1920px){#dpnet{flex:0 0 270px;}#dpmet{flex:0 0 280px;}}
    @media(min-width:3840px){#dpnet{flex:0 0 480px;}#dpmet{flex:0 0 520px;}}

    /* Panels */
    .dpanel{display:flex;flex-direction:column;background:var(--surface);
      border:1px solid var(--border);border-radius:var(--radius);
      padding:var(--pad);overflow:hidden;gap:var(--gap);flex-shrink:0;}
    @media(min-width:1200px){.dpanel{flex-shrink:1;}}
    .dpanel-title{font-size:var(--fs-xs);font-weight:700;text-transform:uppercase;
      letter-spacing:0.09em;color:var(--muted2);flex-shrink:0;}
    .dsub{font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:0.07em;
      color:var(--muted2);font-weight:600;}

    /* Network panel */
    #dres-grid{display:flex;flex-direction:column;gap:5px;overflow-y:auto;
      flex:1;min-height:0;}
    .dres-card{display:flex;align-items:center;gap:0.55em;padding:0.45em 0.6em;
      background:var(--surface2);border:1px solid var(--border);border-radius:5px;flex-shrink:0;}
    .dres-name{font-size:var(--fs-sm);font-weight:600;overflow:hidden;
      text-overflow:ellipsis;white-space:nowrap;flex:1;}
    .dtier{font-size:var(--fs-xs);font-weight:700;padding:0.1em 0.5em;border-radius:3px;
      text-transform:uppercase;letter-spacing:0.04em;flex-shrink:0;}
    .dtier-top{background:#091f12;color:var(--success);}
    .dtier-mid{background:#20190a;color:var(--warning);}
    .dtier-low{background:#1a0e0e;color:var(--muted2);}
    .dmini-row{display:flex;gap:6px;flex-shrink:0;}
    .dmini{flex:1;display:flex;flex-direction:column;align-items:center;
      background:var(--surface2);border:1px solid var(--border);border-radius:5px;
      padding:0.5em 0.4em;gap:0.15em;}
    .dmini-val{font-size:var(--fs-xl);font-weight:700;font-variant-numeric:tabular-nums;line-height:1;}
    .dmini-lbl{font-size:var(--fs-xs);color:var(--muted2);text-transform:uppercase;letter-spacing:0.05em;}

    /* Main panel */
    #dtask{font-size:var(--fs-task);font-weight:600;line-height:1.4;
      display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;
      overflow:hidden;flex-shrink:0;transition:color 0.4s;}
    @media(min-width:1920px){#dtask{-webkit-line-clamp:5;}}
    .dqueue-hdr{display:flex;justify-content:space-between;align-items:center;}
    #dqfrac{font-size:var(--fs-sm);color:var(--muted2);font-variant-numeric:tabular-nums;
      font-family:"SF Mono",ui-monospace,monospace;}
    .dtrack{height:4px;background:var(--surface2);border-radius:2px;overflow:hidden;}
    @media(min-width:1920px){.dtrack{height:8px;border-radius:4px;}}
    @media(min-width:3840px){.dtrack{height:14px;border-radius:7px;}}
    #dqfill{height:100%;background:linear-gradient(90deg,var(--accent),#7ab4ff);
      border-radius:inherit;transition:width 0.7s ease;}
    #dqlist{display:flex;flex-direction:column;gap:4px;overflow-y:auto;
      max-height:110px;flex-shrink:0;}
    @media(min-width:1920px){#dqlist{max-height:220px;}}
    @media(min-width:3840px){#dqlist{max-height:380px;}}
    .dqitem{display:flex;align-items:flex-start;gap:0.5em;font-size:var(--fs-sm);
      color:var(--muted2);line-height:1.4;}
    .dqnum{font-family:"SF Mono",ui-monospace,monospace;color:var(--muted);
      flex-shrink:0;min-width:1.6em;}
    .dqtext{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
    .dspark-hdr{display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
    #dtpmlbl{font-size:var(--fs-sm);color:var(--accent);
      font-family:"SF Mono",ui-monospace,monospace;font-weight:600;}
    #dsparkline{display:block;width:100%;flex:1;min-height:56px;}
    .dspark-wrap{display:flex;flex-direction:column;gap:6px;flex:1;min-height:0;}

    /* Metrics panel */
    .dmet-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--gap);flex-shrink:0;}
    @media(min-width:768px)and(max-width:1199px){.dmet-grid{grid-template-columns:repeat(4,1fr);}}
    .dmet-tile{background:var(--surface2);border:1px solid var(--border);border-radius:6px;
      padding:0.75em 0.5em;display:flex;flex-direction:column;align-items:center;gap:0.2em;}
    .dmet-val{font-size:var(--fs-metric);font-weight:700;font-variant-numeric:tabular-nums;line-height:1;}
    .dmet-val.accent{color:var(--accent);}
    .dmet-lbl{font-size:var(--fs-xs);color:var(--muted2);text-transform:uppercase;
      letter-spacing:0.06em;text-align:center;line-height:1.25;}
    .dmodels{display:flex;flex-direction:column;gap:8px;flex:1;overflow-y:auto;min-height:0;}
    @media(min-width:768px)and(max-width:1199px){.dmodels{display:none;}}
    .dmodel-row{display:flex;flex-direction:column;gap:3px;}
    .dmodel-hdr{display:flex;justify-content:space-between;font-size:var(--fs-xs);color:var(--muted2);}
    .dmodel-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:68%;}
    .dbar-track{height:3px;background:var(--surface2);border-radius:2px;overflow:hidden;}
    @media(min-width:1920px){.dbar-track{height:6px;}}
    @media(min-width:3840px){.dbar-track{height:10px;}}
    .dbar-fill{height:100%;background:var(--accent);opacity:0.65;
      border-radius:inherit;transition:width 0.9s ease;}

    /* Log strip */
    #dlog-strip{display:flex;flex-direction:column;gap:5px;
      height:var(--logbar-h);min-height:var(--logbar-h);
      padding:var(--gap) var(--pad);background:#04060a;
      border-top:1px solid var(--border);overflow:hidden;flex-shrink:0;}
    #dlogfeed{display:flex;flex-direction:column;gap:2px;overflow:hidden;flex:1;}
    @keyframes dfadein{from{opacity:0;transform:translateY(-3px);}to{opacity:1;transform:none;}}
    .dlog{display:flex;align-items:baseline;gap:0.6em;font-size:var(--fs-sm);
      line-height:1.3;white-space:nowrap;overflow:hidden;animation:dfadein 0.25s ease;}
    .dlog-time{font-family:"SF Mono",ui-monospace,monospace;color:var(--muted);
      flex-shrink:0;font-size:var(--fs-xs);}
    .dlog-kind{padding:0.05em 0.4em;border-radius:3px;font-size:var(--fs-xs);
      font-weight:700;flex-shrink:0;text-transform:uppercase;letter-spacing:0.04em;}
    .lk-chat{background:#091328;color:var(--accent);}
    .lk-wiki{background:#091f12;color:var(--success);}
    .lk-reddit{background:#1a150a;color:#c8a83a;}
    .lk-search{background:#1a1508;color:var(--warning);}
    .lk-weather{background:#081a1a;color:#4ecdc4;}
    .lk-live,.lk-web{background:#160920;color:#b44ff5;}
    .lk-sys{background:#111;color:var(--muted2);}
    .dlog-sum{color:var(--muted2);overflow:hidden;text-overflow:ellipsis;flex:1;}
    .dlog-err{color:var(--danger);flex-shrink:0;font-size:var(--fs-xs);}
    @media(min-width:1200px){
      .dlog:nth-last-child(n+4){opacity:0.45;}
      .dlog:nth-last-child(n+6){opacity:0.2;}
    }
    ::-webkit-scrollbar{width:3px;height:3px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
    .dempty{color:var(--muted2);font-size:var(--fs-sm);font-style:italic;
      text-align:center;padding:1em 0;}
  </style>
</head>
<body>
<div id="dapp">
  <header id="dtop">
    <div class="dlogo">&#x2B21; Crusty</div>
    <div class="dtop-center">
      <span id="dorch">&mdash;</span>
      <span id="dmode">&mdash;</span>
      <span id="dbusy" class="ddot" style="display:none"></span>
    </div>
    <div class="dtop-right">
      <span id="dhealthdot" class="ddot"></span>
      <span id="dclock">&mdash;</span>
    </div>
  </header>
  <div id="dbody">
    <section id="dpnet" class="dpanel">
      <h2 class="dpanel-title">Network</h2>
      <div id="dres-grid"></div>
      <div class="dmini-row">
        <div class="dmini"><div id="drescnt" class="dmini-val">&mdash;</div><div class="dmini-lbl">Online</div></div>
        <div class="dmini"><div id="dpending" class="dmini-val">&mdash;</div><div class="dmini-lbl">Queued</div></div>
        <div class="dmini"><div id="ddone" class="dmini-val">&mdash;</div><div class="dmini-lbl">Done</div></div>
      </div>
    </section>
    <section id="dpmain" class="dpanel">
      <h2 class="dpanel-title">Current Focus</h2>
      <div id="dtask">Connecting&hellip;</div>
      <div>
        <div class="dqueue-hdr">
          <span class="dsub">Queue Progress</span>
          <span id="dqfrac" class="dsub">0 / 0</span>
        </div>
        <div class="dtrack" style="margin-top:6px"><div id="dqfill" style="width:0%"></div></div>
        <div id="dqlist" style="margin-top:8px"></div>
      </div>
      <div class="dspark-wrap">
        <div class="dspark-hdr">
          <span class="dsub">Token Activity</span>
          <span id="dtpmlbl">&mdash; tok/min</span>
        </div>
        <canvas id="dsparkline"></canvas>
      </div>
    </section>
    <section id="dpmet" class="dpanel">
      <h2 class="dpanel-title">Metrics</h2>
      <div class="dmet-grid">
        <div class="dmet-tile"><div id="dtpmbig" class="dmet-val accent">&mdash;</div><div class="dmet-lbl">tok / min</div></div>
        <div class="dmet-tile"><div id="dtasksdone" class="dmet-val">&mdash;</div><div class="dmet-lbl">tasks done</div></div>
        <div class="dmet-tile"><div id="devents" class="dmet-val">&mdash;</div><div class="dmet-lbl">events</div></div>
        <div class="dmet-tile"><div id="dtokens" class="dmet-val">&mdash;</div><div class="dmet-lbl">tokens</div></div>
      </div>
      <div class="dmodels">
        <div class="dsub" style="flex-shrink:0">Model Activity</div>
        <div id="dmodelbars" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;min-height:0"></div>
      </div>
    </section>
  </div>
  <footer id="dlog-strip">
    <div class="dsub">Live Activity</div>
    <div id="dlogfeed"></div>
  </footer>
</div>
<script>
  var ST={resources:[],audit:[],lastId:-1,tokenWin:[],tpmHist:[]};
  var clockEl=document.getElementById('dclock');
  function tickClock(){
    clockEl.textContent=new Date().toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  tickClock();setInterval(tickClock,1000);
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function fmt(n){
    if(n==null||isNaN(n))return'\u2014';
    if(n>=1000000)return(n/1000000).toFixed(1).replace(/\.0$/,'')+'M';
    if(n>=10000)return Math.round(n/1000)+'K';
    if(n>=1000)return(n/1000).toFixed(1).replace(/\.0$/,'')+'K';
    return String(Math.round(n));
  }
  async function fetchJ(path){try{var r=await fetch(path,{cache:'no-store'});return r.ok?r.json():null;}catch(e){return null;}}
  function el(id){return document.getElementById(id);}

  async function checkHealth(){
    var data=await fetchJ('/api/health');
    el('dhealthdot').className='ddot '+(data&&data.ok?'ddot-green':'ddot-red');
  }

  async function loadStatus(){
    var data=await fetchJ('/api/status');
    if(!data)return;
    el('dorch').textContent=data.orchestratorName||'\u2014';
    var mode=data.mode||'command',modeEl=el('dmode');
    modeEl.textContent=mode.toUpperCase();modeEl.className='m-'+mode;
    var busyEl=el('dbusy');
    if(data.auto&&data.auto.busy){busyEl.style.display='';busyEl.className='ddot ddot-amber dpulse';}
    else{busyEl.style.display='none';}
    var taskEl=el('dtask'),next=data.nextTask,last=data.lastCompleted;
    if(next&&next.content){taskEl.textContent=next.content;taskEl.style.color='';}
    else if(last&&last.content){taskEl.textContent='\u2713 '+last.content;taskEl.style.color='var(--muted2)';}
    else if(mode==='auto'){taskEl.textContent='Auto mode \u2014 scanning queue\u2026';taskEl.style.color='var(--muted2)';}
    else{taskEl.textContent='Idle \u2014 '+mode+' mode';taskEl.style.color='var(--muted)';}
    var pending=(data.auto&&data.auto.pendingCount)||0,completed=(data.auto&&data.auto.completedCount)||0,total=pending+completed;
    el('dqfrac').textContent=completed+' / '+total;
    el('dqfill').style.width=(total>0?(completed/total*100):0)+'%';
    el('dpending').textContent=fmt(pending);el('ddone').textContent=fmt(completed);el('dtasksdone').textContent=fmt(completed);
    var tel=data.telemetry;
    if(tel){
      el('devents').textContent=fmt(tel.totalEvents);
      var toks=0,mkeys=Object.keys(tel.models||{});
      for(var i=0;i<mkeys.length;i++)toks+=(tel.models[mkeys[i]].evalCount||0);
      el('dtokens').textContent=fmt(toks);
      renderModelBars(tel.models);
    }
    var cap=data.capacity;
    if(cap)el('drescnt').textContent=String(cap.resourceCount||0);
  }

  async function loadQueue(){
    var data=await fetchJ('/api/queue');
    if(!data)return;
    var tasks=data.pending||[],listEl=el('dqlist');
    if(!tasks.length){listEl.innerHTML='<div class="dempty">No pending tasks</div>';return;}
    var html='',max=Math.min(tasks.length,8);
    for(var i=0;i<max;i++){
      html+='<div class="dqitem"><span class="dqnum">'+(i+1)+'.</span>';
      html+='<span class="dqtext">'+esc(tasks[i].content)+'</span></div>';
    }
    listEl.innerHTML=html;
  }

  async function loadResources(){
    var data=await fetchJ('/api/resources');
    if(!Array.isArray(data))return;
    var grid=el('dres-grid');
    if(!data.length){grid.innerHTML='<div class="dempty">No resources</div>';return;}
    var html='';
    for(var i=0;i<data.length;i++){
      var r=data[i],tier=r.tier||'low',label=esc(r.label||r.alias);
      html+='<div class="dres-card"><span class="ddot ddot-green"></span>';
      html+='<span class="dres-name" title="'+label+'">'+label+'</span>';
      html+='<span class="dtier dtier-'+tier+'">'+tier+'</span></div>';
    }
    grid.innerHTML=html;
  }

  var KIND_MAP={
    'ollama.chat':['chat','lk-chat'],'wikipedia.search':['wiki','lk-wiki'],
    'reddit.search':['reddit','lk-reddit'],'search.web':['search','lk-search'],
    'weather.fetch':['weather','lk-weather'],'benlive.fetch':['live','lk-live'],
    'website.fetch':['web','lk-web'],'system':['sys','lk-sys']
  };

  async function loadAudit(){
    var data=await fetchJ('/api/audit?limit=50');
    if(!Array.isArray(data))return;
    var newEvs=[],i,ev;
    for(i=0;i<data.length;i++){if(data[i].id>ST.lastId)newEvs.push(data[i]);}
    if(newEvs.length>0){
      for(i=0;i<newEvs.length;i++){
        ev=newEvs[i];
        if(ev.evalCount&&ev.evalCount>0)ST.tokenWin.push({t:new Date(ev.timestamp).getTime(),n:ev.evalCount});
        if(ev.id>ST.lastId)ST.lastId=ev.id;
      }
      var cutoff=Date.now()-60000;
      ST.tokenWin=ST.tokenWin.filter(function(p){return p.t>=cutoff;});
      ST.audit=data.slice(0,30);renderLog();
    }
    var tpm=calcTpm();
    ST.tpmHist.push(tpm);if(ST.tpmHist.length>80)ST.tpmHist.shift();
    el('dtpmlbl').textContent=fmt(tpm)+' tok/min';el('dtpmbig').textContent=fmt(tpm);
    drawSpark();
  }

  function calcTpm(){
    if(!ST.tokenWin.length)return 0;
    var span=Math.min(60000,Date.now()-ST.tokenWin[0].t);
    if(span<2000)return 0;
    var total=0;for(var i=0;i<ST.tokenWin.length;i++)total+=ST.tokenWin[i].n;
    return Math.round(total*60000/span);
  }

  function renderLog(){
    var feed=el('dlogfeed'),evs=ST.audit.slice().reverse().slice(-8);
    var html='',i,ev,info,t,errMark;
    for(i=0;i<evs.length;i++){
      ev=evs[i];info=KIND_MAP[ev.kind]||[ev.kind.split('.').pop(),'lk-sys'];
      t=new Date(ev.timestamp).toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
      errMark=ev.success?'':(': was here, check dlog-err');
      html+='<div class="dlog"><span class="dlog-time">'+t+'</span>';
      html+='<span class="dlog-kind '+info[1]+'">'+info[0]+'</span>';
      html+='<span class="dlog-sum">'+esc(ev.summary)+'</span>';
      if(!ev.success)html+='<span class="dlog-err">\u2717</span>';
      html+='</div>';
    }
    feed.innerHTML=html;
  }

  function renderModelBars(models){
    var container=el('dmodelbars');if(!models)return;
    var entries=[],mkeys=Object.keys(models),i,m,e,pct,nm,html='',maxT;
    for(i=0;i<mkeys.length;i++){m=models[mkeys[i]];if(m.calls>0)entries.push({name:mkeys[i],toks:m.evalCount||0});}
    entries.sort(function(a,b){return b.toks-a.toks;});entries=entries.slice(0,6);
    if(!entries.length){container.innerHTML='<div class="dempty">No model data yet</div>';return;}
    maxT=entries[0].toks;
    for(i=0;i<entries.length;i++){
      e=entries[i];pct=maxT>0?Math.round(e.toks/maxT*100):0;
      nm=e.name.length>24?e.name.slice(0,22)+'\u2026':e.name;
      html+='<div class="dmodel-row"><div class="dmodel-hdr">';
      html+='<span class="dmodel-name" title="'+esc(e.name)+'">'+esc(nm)+'</span>';
      html+='<span style="color:var(--muted2)">'+fmt(e.toks)+'t</span></div>';
      html+='<div class="dbar-track"><div class="dbar-fill" style="width:'+pct+'%"></div></div></div>';
    }
    container.innerHTML=html;
  }

  var cvs=document.getElementById('dsparkline'),ctx=cvs.getContext('2d');
  new ResizeObserver(function(){drawSpark();}).observe(cvs);
  function drawSpark(){
    var W=cvs.clientWidth,H=cvs.clientHeight;
    if(W<4||H<4)return;
    if(cvs.width!==W||cvs.height!==H){cvs.width=W;cvs.height=H;}
    ctx.clearRect(0,0,W,H);
    var data=ST.tpmHist;
    if(data.length<2){
      ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();return;
    }
    var maxV=0,i,pts=[],p;
    for(i=0;i<data.length;i++)if(data[i]>maxV)maxV=data[i];
    if(maxV<1)maxV=1;
    for(i=0;i<data.length;i++)pts.push({x:(i/(data.length-1))*W,y:H-(data[i]/maxV)*(H-6)-3});
    var grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'rgba(79,142,247,0.3)');grad.addColorStop(1,'rgba(79,142,247,0.02)');
    ctx.beginPath();ctx.moveTo(pts[0].x,H);
    for(i=0;i<pts.length;i++){p=pts[i];ctx.lineTo(p.x,p.y);}
    ctx.lineTo(pts[pts.length-1].x,H);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    ctx.beginPath();
    for(i=0;i<pts.length;i++){p=pts[i];if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
    ctx.strokeStyle='#4f8ef7';ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
    for(i=1;i<4;i++){var gy=(i/4)*H;ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}
    if(maxV>0){
      ctx.fillStyle='rgba(90,99,120,0.9)';
      var fs=Math.max(9,Math.min(13,Math.floor(H*0.18)));
      ctx.font=fs+'px "SF Mono",ui-monospace,monospace';
      ctx.fillText(fmt(maxV)+' max',4,fs+2);
    }
  }

  async function pollFast(){await checkHealth();await Promise.all([loadStatus(),loadQueue(),loadAudit()]);}
  pollFast();loadResources();
  setInterval(pollFast,3000);setInterval(loadResources,10000);
</script>
</body>
</html>`;
}
