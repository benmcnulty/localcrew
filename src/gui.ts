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
