export function getGuiHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Local Crew</title>
    <link rel="stylesheet" href="/ui/styles.css">
  </head>
  <body>
    <div id="app">
      <header id="topbar">
        <div class="topbar-left">
          <span class="logo">&#x2B21; Local Crew</span>
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
          <div class="nav-item" data-section="topology">
            <span class="nav-icon">&#x2442;</span><span>Topology</span>
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
          <div class="nav-item" data-section="guide">
            <span class="nav-icon">&#x2753;</span><span>Guide</span>
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
              <p class="section-note">Stored in your local .localcrew configuration. Used by weather, website, and daily digest tools.</p>
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

          <!-- Topology -->
          <section id="section-topology" hidden>
            <div class="card">
              <div class="card-title-row">
                <span class="card-title">Network Topology</span>
                <button class="btn-ghost" id="topology-refresh">Refresh</button>
              </div>
              <pre id="topology-output">(loading...)</pre>
            </div>
            <div class="card">
              <div class="card-title">Assign Resource Role</div>
              <form id="topology-assign-form">
                <div class="form-grid">
                  <div class="field-group">
                    <label class="field-label">Resource alias</label>
                    <input id="topo-assign-alias" name="alias" type="text" placeholder="workhorse">
                  </div>
                  <div class="field-group">
                    <label class="field-label">Role</label>
                    <select id="topo-assign-role" name="role">
                      <option value="orchestrator">orchestrator</option>
                      <option value="agent" selected>agent</option>
                    </select>
                  </div>
                </div>
                <button type="submit">Assign Role</button>
              </form>
            </div>
            <div class="card">
              <div class="card-title">Delegate Agent to Sub-Orchestrator</div>
              <form id="topology-delegate-form">
                <div class="form-grid">
                  <div class="field-group">
                    <label class="field-label">Orchestrator alias</label>
                    <input id="topo-delegate-orch" name="orchestrator" type="text" placeholder="workhorse">
                  </div>
                  <div class="field-group">
                    <label class="field-label">Agent alias</label>
                    <input id="topo-delegate-agent" name="agent" type="text" placeholder="helper">
                  </div>
                </div>
                <div class="command-buttons" style="margin-top:8px">
                  <button type="submit">Delegate</button>
                  <button type="button" id="topo-undelegate-btn" class="btn-ghost">Undelegate</button>
                </div>
              </form>
            </div>
          </section>

          <!-- Guide -->
          <section id="section-guide" hidden>
            <div class="card">
              <div class="card-title">Getting Started</div>
              <div class="guide-content">
                <p>Local Crew is a local-first multi-device inference orchestrator. Use the sidebar to navigate between sections.</p>
                <ol>
                  <li><strong>Dashboard</strong> &mdash; run commands, view live status, and control modes (chat, group, auto)</li>
                  <li><strong>Resources</strong> &mdash; add and manage inference endpoints (Ollama, OpenAI-compatible, Anthropic)</li>
                  <li><strong>Participants</strong> &mdash; configure chat personas with nicknames, instructions, and resource bindings</li>
                  <li><strong>Queue &amp; Auto</strong> &mdash; manage the autonomous task queue and daily work sessions</li>
                  <li><strong>Direct Chat</strong> &mdash; test any resource directly with a message and model override</li>
                  <li><strong>Topology</strong> &mdash; view and manage the hierarchical device network</li>
                  <li><strong>Dropbox</strong> &mdash; submit documents for orchestrated processing</li>
                  <li><strong>Explorer</strong> &mdash; browse internal and external memory files</li>
                  <li><strong>Settings</strong> &mdash; configure orchestrator identity and user preferences</li>
                </ol>
              </div>
            </div>
            <div class="card">
              <div class="card-title">Quick Reference</div>
              <div id="guide-topics" class="guide-content">
                <div class="guide-topic-buttons command-buttons">
                  <button class="btn-ghost" data-guide-topic="chat">Chat</button>
                  <button class="btn-ghost" data-guide-topic="auto">Auto Mode</button>
                  <button class="btn-ghost" data-guide-topic="resources">Resources</button>
                  <button class="btn-ghost" data-guide-topic="participants">Participants</button>
                  <button class="btn-ghost" data-guide-topic="agents">Agents</button>
                  <button class="btn-ghost" data-guide-topic="tools">Web Tools</button>
                  <button class="btn-ghost" data-guide-topic="topology">Topology</button>
                  <button class="btn-ghost" data-guide-topic="preferences">Preferences</button>
                  <button class="btn-ghost" data-guide-topic="daily">Daily Sessions</button>
                </div>
                <pre id="guide-topic-output" style="margin-top:12px"></pre>
              </div>
            </div>
            <div class="card">
              <div class="card-title">CLI Command Reference</div>
              <div class="guide-content">
                <pre id="guide-help-output">(click Refresh to load)</pre>
                <button class="btn-ghost" id="guide-help-refresh" style="margin-top:8px">Refresh</button>
              </div>
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
            <div class="modal-actions">
              <button type="button" id="workflow-cancel" class="btn-ghost">Cancel</button>
            </div>
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

section[hidden] {
  display: none;
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

.modal-overlay[hidden] {
  display: none;
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

  .modal-card {
    padding: 16px;
    max-width: 100%;
  }
}

@media (max-width: 480px) {
  #topbar {
    padding: 0 12px;
    gap: 8px;
    font-size: 14px;
  }

  #content {
    padding: 12px;
  }

  .stat-grid {
    grid-template-columns: 1fr;
  }

  .section-title {
    font-size: 16px;
  }

  .modal-overlay {
    padding: 12px;
  }

  .modal-card {
    padding: 14px;
    border-radius: 8px;
  }

  .modal-actions {
    flex-direction: column;
  }

  .item-actions {
    flex-direction: column;
    gap: 4px;
  }

  .item-actions button {
    width: 100%;
  }
}

@media (min-width: 1200px) {
  #sidebar {
    width: 260px;
  }

  .stat-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .modal-card {
    max-width: 780px;
  }
}

@media (min-width: 1920px) {
  #sidebar {
    width: 300px;
  }

  #content {
    padding: 32px;
  }

  .stat-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  .section-title {
    font-size: 22px;
    margin-bottom: 18px;
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
  connectionLine: document.getElementById("connection-line"),
  topologyOutput: document.getElementById("topology-output"),
  topologyRefresh: document.getElementById("topology-refresh"),
  topologyAssignForm: document.getElementById("topology-assign-form"),
  topoAssignAlias: document.getElementById("topo-assign-alias"),
  topoAssignRole: document.getElementById("topo-assign-role"),
  topoDelegateForm: document.getElementById("topology-delegate-form"),
  topoDelegateOrch: document.getElementById("topo-delegate-orch"),
  topoDelegateAgent: document.getElementById("topo-delegate-agent"),
  topoUndelegateBtn: document.getElementById("topo-undelegate-btn"),
  guideTopicOutput: document.getElementById("guide-topic-output"),
  guideHelpOutput: document.getElementById("guide-help-output"),
  guideHelpRefresh: document.getElementById("guide-help-refresh")
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
  const storedToken = window.sessionStorage.getItem("localCrewApiToken") || "";
  const token = queryToken || storedToken;

  if (queryToken) {
    window.sessionStorage.setItem("localCrewApiToken", queryToken);
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

function updateModalOverlay() {
  const anyOpen = state.pendingEdit || state.pendingWorkflow;
  if (els.modalOverlay) els.modalOverlay.hidden = !anyOpen;
  document.body.style.overflow = anyOpen ? "hidden" : "";
}

function renderWorkflow(request) {
  state.pendingWorkflow = request || null;
  if (els.workflowPanel) els.workflowPanel.hidden = !request;
  if (request && els.editPanel) els.editPanel.hidden = true;
  if (els.workflowForm) els.workflowForm.replaceChildren();
  if (els.workflowIntro) els.workflowIntro.replaceChildren();
  updateModalOverlay();

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
  if (request && els.workflowPanel) els.workflowPanel.hidden = true;
  updateModalOverlay();
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
  } else if (state.selectedSection === "topology") {
    try {
      const payload = await postJson("/api/command", { input: "/topology" });
      if (els.topologyOutput && payload.result && payload.result.lines) {
        els.topologyOutput.textContent = payload.result.lines.join("\\n") || "(no topology data)";
      }
    } catch (e) {
      if (els.topologyOutput) els.topologyOutput.textContent = String(e);
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

// Workflow cancel
const workflowCancelBtn = document.getElementById("workflow-cancel");
if (workflowCancelBtn) {
  workflowCancelBtn.addEventListener("click", () => {
    renderWorkflow(null);
    renderEdit(null);
  });
}

// Close modal on Escape key
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.pendingEdit || state.pendingWorkflow) {
      renderEdit(null);
      renderWorkflow(null);
    }
  }
});

// Close modal on backdrop click (outside .modal-card)
if (els.modalOverlay) {
  els.modalOverlay.addEventListener("click", (event) => {
    if (event.target === els.modalOverlay) {
      renderEdit(null);
      renderWorkflow(null);
    }
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

// Topology refresh
if (els.topologyRefresh) {
  els.topologyRefresh.addEventListener("click", async () => {
    try {
      const payload = await postJson("/api/command", { input: "/topology" });
      if (els.topologyOutput && payload.result && payload.result.lines) {
        els.topologyOutput.textContent = payload.result.lines.join("\\n") || "(no topology data)";
      }
    } catch (error) {
      if (els.topologyOutput) els.topologyOutput.textContent = String(error);
    }
  });
}

// Topology assign form
if (els.topologyAssignForm) {
  els.topologyAssignForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const alias = els.topoAssignAlias ? els.topoAssignAlias.value.trim() : "";
    const role = els.topoAssignRole ? els.topoAssignRole.value : "agent";
    if (!alias) return;
    try {
      const payload = await postJson("/api/command", { input: "/topology assign " + alias + " " + role });
      renderResult(payload);
      if (els.topologyOutput && payload.result && payload.result.lines) {
        els.topologyOutput.textContent = payload.result.lines.join("\\n");
      }
      await refreshView();
    } catch (error) {
      if (els.resultOutput) els.resultOutput.textContent = String(error);
    }
  });
}

// Topology delegate form
if (els.topoDelegateForm) {
  els.topoDelegateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const orch = els.topoDelegateOrch ? els.topoDelegateOrch.value.trim() : "";
    const agent = els.topoDelegateAgent ? els.topoDelegateAgent.value.trim() : "";
    if (!orch || !agent) return;
    try {
      const payload = await postJson("/api/command", { input: "/topology delegate " + orch + " " + agent });
      renderResult(payload);
      await refreshView();
    } catch (error) {
      if (els.resultOutput) els.resultOutput.textContent = String(error);
    }
  });
}

// Topology undelegate
if (els.topoUndelegateBtn) {
  els.topoUndelegateBtn.addEventListener("click", async () => {
    const orch = els.topoDelegateOrch ? els.topoDelegateOrch.value.trim() : "";
    const agent = els.topoDelegateAgent ? els.topoDelegateAgent.value.trim() : "";
    if (!orch || !agent) return;
    try {
      const payload = await postJson("/api/command", { input: "/topology undelegate " + orch + " " + agent });
      renderResult(payload);
      await refreshView();
    } catch (error) {
      if (els.resultOutput) els.resultOutput.textContent = String(error);
    }
  });
}

// Guide topic buttons
document.querySelectorAll("[data-guide-topic]").forEach((button) => {
  button.addEventListener("click", async () => {
    const topic = button.getAttribute("data-guide-topic");
    try {
      const payload = await postJson("/api/command", { input: "/help " + topic });
      if (els.guideTopicOutput && payload.result && payload.result.lines) {
        els.guideTopicOutput.textContent = payload.result.lines.join("\\n");
      }
    } catch (error) {
      if (els.guideTopicOutput) els.guideTopicOutput.textContent = String(error);
    }
  });
});

// Guide help refresh
if (els.guideHelpRefresh) {
  els.guideHelpRefresh.addEventListener("click", async () => {
    try {
      const payload = await postJson("/api/command", { input: "/help" });
      if (els.guideHelpOutput && payload.result && payload.result.lines) {
        els.guideHelpOutput.textContent = payload.result.lines.join("\\n");
      }
    } catch (error) {
      if (els.guideHelpOutput) els.guideHelpOutput.textContent = String(error);
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
// /display — Neon Jumbotron real-time observability dashboard
// Self-contained HTML (inline CSS + JS). Responsive: mobile → 4K billboard.
// ---------------------------------------------------------------------------
export function getDisplayHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>Local Crew &middot; Billboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Neon palette tokens ─────────────────────────────────────────────── */
    :root {
      --bg:        #020408;
      --surface:   rgba(4, 8, 24, 0.92);
      --surface2:  rgba(6, 12, 30, 0.88);
      --n-blue:    #00d4ff;
      --n-green:   #00ff7f;
      --n-pink:    #ff2d78;
      --n-amber:   #ffcc00;
      --n-purple:  #b44fff;
      --n-cyan:    #00fff5;
      --n-orange:  #ff7700;
      --text:      #e0e8f8;
      --muted:     #2a3550;
      --muted2:    #4a5a78;

      /* Layout */
      --topbar-h: 52px;
      --logbar-h: 38px;
      --gap:      10px;
      --pad:      14px;
      --radius:   6px;

      /* Typography scale — mobile base */
      --fs-xs:     0.62rem;
      --fs-sm:     0.75rem;
      --fs-base:   0.86rem;
      --fs-md:     1rem;
      --fs-lg:     1.2rem;
      --fs-xl:     1.8rem;
      --fs-metric: 2.2rem;
      --fs-task:   1.02rem;
    }
    @media (min-width: 768px) {
      :root {
        --topbar-h:56px;--logbar-h:40px;--gap:12px;--pad:16px;
        --fs-sm:0.78rem;--fs-base:0.88rem;--fs-md:1.05rem;
        --fs-xl:2.1rem;--fs-metric:3rem;--fs-task:1.1rem;
      }
    }
    @media (min-width: 1200px) {
      :root {
        --topbar-h:60px;--logbar-h:42px;--gap:16px;--pad:20px;
        --fs-xs:0.66rem;--fs-sm:0.8rem;--fs-base:0.9rem;--fs-md:1.05rem;
        --fs-lg:1.3rem;--fs-xl:2.3rem;--fs-metric:2.4rem;--fs-task:1.2rem;
      }
    }
    @media (min-width: 2560px) {
      html { font-size: 20px; }
    }
    /* HD Billboard */
    @media (min-width: 1920px) {
      :root {
        --topbar-h:80px;--logbar-h:56px;--gap:24px;--pad:30px;--radius:10px;
        --fs-xs:1rem;--fs-sm:1.2rem;--fs-base:1.4rem;--fs-md:1.75rem;
        --fs-lg:2.2rem;--fs-xl:3.4rem;
        --fs-metric:clamp(4.5rem,5vw,10rem);
        --fs-task:clamp(1.8rem,2.4vw,4.5rem);
      }
    }
    /* 4K Billboard */
    @media (min-width: 3840px) {
      html { font-size: 24px; }
      :root {
        --topbar-h:128px;--logbar-h:80px;--gap:44px;--pad:52px;--radius:18px;
        --fs-xs:1.8rem;--fs-sm:2.2rem;--fs-base:2.6rem;--fs-md:3.2rem;
        --fs-lg:4rem;--fs-xl:5.8rem;
        --fs-metric:clamp(8rem,8vw,16rem);
        --fs-task:clamp(3.5rem,4vw,8rem);
      }
    }
    /* 5K Billboard */
    @media (min-width: 5120px) {
      html { font-size: 30px; }
      :root {
        --topbar-h:160px;--logbar-h:100px;--gap:56px;--pad:64px;--radius:22px;
        --fs-xs:2.2rem;--fs-sm:2.8rem;--fs-base:3.2rem;--fs-md:4rem;
        --fs-lg:5rem;--fs-xl:7.5rem;
        --fs-metric:clamp(10rem,10vw,20rem);
        --fs-task:clamp(4.5rem,5vw,10rem);
      }
    }

    /* ── Base — glowing grid background ─────────────────────────────────── */
    html, body {
      height: 100%; width: 100%; overflow: hidden;
      background-color: var(--bg);
      background-image:
        linear-gradient(rgba(0,212,255,0.028) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,212,255,0.028) 1px, transparent 1px);
      background-size: 60px 60px;
      color: var(--text);
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: var(--fs-base);
      -webkit-font-smoothing: antialiased;
    }
    /* Scanline overlay */
    body::after {
      content: '';
      position: fixed; inset: 0;
      background: repeating-linear-gradient(
        0deg, transparent, transparent 3px,
        rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px
      );
      pointer-events: none;
      z-index: 50;
    }

    /* ── App shell ────────────────────────────────────────────────────────── */
    #dapp {
      display: flex; flex-direction: column;
      height: 100vh; width: 100vw; overflow: hidden;
    }

    /* ── Topbar ───────────────────────────────────────────────────────────── */
    #dtop {
      display: flex; align-items: center; justify-content: space-between;
      height: var(--topbar-h); min-height: var(--topbar-h);
      background: rgba(0,0,6,0.97);
      border-bottom: 1px solid rgba(0,212,255,0.25);
      box-shadow: 0 1px 20px rgba(0,212,255,0.12);
      padding: 0 var(--pad); gap: var(--gap); flex-shrink: 0;
    }
    .dlogo {
      font-size: var(--fs-lg); font-weight: 800;
      color: var(--n-blue); letter-spacing: 0.04em; white-space: nowrap; flex-shrink: 0;
      text-shadow: 0 0 8px var(--n-blue), 0 0 20px var(--n-blue), 0 0 50px rgba(0,212,255,0.4);
    }
    .dtop-center {
      display: flex; align-items: center; gap: 0.65em;
      overflow: hidden; flex: 1; justify-content: center;
    }
    #dorch {
      font-size: var(--fs-md); font-weight: 700; letter-spacing: 0.04em;
      color: var(--n-blue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      text-shadow: 0 0 6px var(--n-blue), 0 0 16px rgba(0,212,255,0.5);
    }
    #dmode {
      font-size: var(--fs-xs); font-weight: 800; letter-spacing: 0.12em;
      text-transform: uppercase; padding: 0.25em 0.8em; border-radius: 3px;
      background: transparent; color: var(--muted2); border: 1px solid var(--muted);
      white-space: nowrap; flex-shrink: 0;
    }
    #dmode.m-auto   { color:#00ff7f; border-color:rgba(0,255,127,0.5); background:rgba(0,255,127,0.07); text-shadow:0 0 8px #00ff7f,0 0 16px rgba(0,255,127,0.4); }
    #dmode.m-chat   { color:var(--n-blue); border-color:rgba(0,212,255,0.5); background:rgba(0,212,255,0.07); text-shadow:0 0 8px var(--n-blue),0 0 16px rgba(0,212,255,0.4); }
    #dmode.m-group  { color:var(--n-cyan); border-color:rgba(0,255,245,0.5); background:rgba(0,255,245,0.07); text-shadow:0 0 8px var(--n-cyan); }
    #dmode.m-agent  { color:var(--n-amber); border-color:rgba(255,204,0,0.5); background:rgba(255,204,0,0.07); text-shadow:0 0 8px var(--n-amber); }
    #dmode.m-command { color:var(--muted2); }
    .dtop-right { display:flex;align-items:center;gap:0.8em;white-space:nowrap;flex-shrink:0; }
    .dactivity {
      font-size: var(--fs-xs);
      color: var(--muted2);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .dactive-btn {
      border: 1px solid rgba(0,212,255,0.3);
      background: rgba(0,212,255,0.08);
      color: var(--n-blue);
      border-radius: 4px;
      padding: 0.22em 0.6em;
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .dactive-btn.on {
      border-color: rgba(0,255,127,0.45);
      background: rgba(0,255,127,0.12);
      color: #00ff7f;
      text-shadow: 0 0 6px rgba(0,255,127,0.5);
    }
    #dclock {
      font-size: var(--fs-md); font-variant-numeric: tabular-nums; letter-spacing: 0.06em;
      color: var(--n-amber); font-family: "SF Mono","Fira Code",ui-monospace,monospace;
      text-shadow: 0 0 6px var(--n-amber), 0 0 14px rgba(255,204,0,0.4);
    }

    /* ── Neon status dots ─────────────────────────────────────────────────── */
    .ddot {
      display: inline-block; border-radius: 50%; flex-shrink: 0;
      width: 0.65em; height: 0.65em; background: var(--muted);
    }
    @keyframes dotPulse {
      0%,100% { box-shadow: 0 0 4px currentColor, 0 0 8px currentColor; }
      50% { box-shadow: 0 0 8px currentColor, 0 0 24px currentColor, 0 0 48px currentColor; }
    }
    .ddot-green { background: #00ff7f; color: #00ff7f; animation: dotPulse 2.2s ease-in-out infinite; }
    .ddot-amber { background: var(--n-amber); color: var(--n-amber); animation: dotPulse 1.2s ease-in-out infinite; }
    .ddot-pink  { background: var(--n-pink); color: var(--n-pink); animation: dotPulse 1.8s ease-in-out infinite; }
    .ddot-blue  { background: var(--n-blue); color: var(--n-blue); animation: dotPulse 2s ease-in-out infinite; }
    .ddot-red   { background: #ff3333; color: #ff3333; }
    @keyframes busyPulse { 0%,100%{opacity:1;} 50%{opacity:0.2;} }
    .dpulse { animation: busyPulse 1.2s ease-in-out infinite; }

    /* ── Flash on value update ────────────────────────────────────────────── */
    @keyframes valFlash {
      0%   { opacity: 1; }
      15%  { opacity: 0.1; filter: brightness(3) saturate(2); }
      100% { opacity: 1; }
    }
    .flash { animation: valFlash 0.45s ease forwards; }

    /* ── Body layout ──────────────────────────────────────────────────────── */
    #dbody {
      display: flex; flex: 1; overflow: hidden;
      gap: var(--gap); padding: var(--gap); padding-bottom: 0;
    }
    @media (max-width: 767px) { #dbody { flex-direction: column; overflow-y: auto; } }
    @media (min-width: 768px) and (max-width: 1199px) {
      #dbody { flex-direction: row; flex-wrap: wrap; align-content: flex-start; }
      #dpnet  { flex: 0 0 calc(42% - var(--gap) / 2); }
      #dpmain { flex: 1; min-width: 0; }
      #dpmet  { flex: 0 0 100%; flex-direction: row; gap: var(--gap); }
    }
    @media (min-width: 1200px) {
      #dpnet  { flex: 0 0 215px; }
      #dpmain { flex: 1; min-width: 0; }
      #dpmet  { flex: 0 0 260px; max-width: 260px; }
    }
    @media (min-width: 1920px) { #dpnet { flex: 0 0 280px; } #dpmet { flex: 0 0 clamp(260px, 16vw, 340px); max-width: 340px; } }
    @media (min-width: 3840px) { #dpnet { flex: 0 0 500px; } #dpmet { flex: 0 0 540px; max-width: 540px; } }
    @media (min-width: 5120px) { #dpnet { flex: 0 0 640px; } #dpmet { flex: 0 0 700px; max-width: 700px; } }

    /* ── Panel base ───────────────────────────────────────────────────────── */
    .dpanel {
      display: flex; flex-direction: column;
      background: var(--surface);
      border: 1px solid rgba(0,212,255,0.15);
      border-radius: var(--radius);
      padding: var(--pad); overflow: hidden; gap: var(--gap); flex-shrink: 0;
    }
    @media (min-width: 1200px) { .dpanel { flex-shrink: 1; } }

    /* Per-panel neon border + glow */
    #dpnet  { border-color: rgba(0,255,127,0.3);  box-shadow: 0 0 28px rgba(0,255,127,0.05),  inset 0 0 40px rgba(0,255,127,0.02);  }
    #dpmain { border-color: rgba(0,212,255,0.3);  box-shadow: 0 0 28px rgba(0,212,255,0.06),  inset 0 0 40px rgba(0,212,255,0.02);  }
    #dpmet  { border-color: rgba(255,45,120,0.3); box-shadow: 0 0 28px rgba(255,45,120,0.05), inset 0 0 40px rgba(255,45,120,0.02); }

    .dpanel-title {
      font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.12em; color: var(--muted2); flex-shrink: 0;
    }
    #dpnet  .dpanel-title { color: rgba(0,255,127,0.5); }
    #dpmain .dpanel-title { color: rgba(0,212,255,0.5); }
    #dpmet  .dpanel-title { color: rgba(255,45,120,0.5); }
    .dsub {
      font-size: var(--fs-xs); text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted2); font-weight: 700;
    }

    /* ── Network panel ────────────────────────────────────────────────────── */
    #dres-grid {
      display: flex; flex-direction: column; gap: 5px;
      overflow-y: auto; flex: 1; min-height: 0;
    }
    .dres-card {
      display: flex; align-items: center; gap: 0.6em;
      padding: 0.5em 0.7em;
      background: rgba(0,255,127,0.04);
      border: 1px solid rgba(0,255,127,0.15);
      border-radius: 4px; flex-shrink: 0;
    }
    .dres-name {
      font-size: var(--fs-sm); font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;
    }
    @media (min-width: 1920px) {
      .dres-name { white-space: normal; word-break: break-word; -webkit-line-clamp: 2;
        display: -webkit-box; -webkit-box-orient: vertical; }
    }
    .dtier {
      font-size: var(--fs-xs); font-weight: 800; padding: 0.1em 0.55em;
      border-radius: 3px; text-transform: uppercase; letter-spacing: 0.06em; flex-shrink: 0;
    }
    .dtier-top { background: rgba(0,255,127,0.12); color: #00ff7f; border: 1px solid rgba(0,255,127,0.3); }
    .dtier-mid { background: rgba(255,204,0,0.10); color: var(--n-amber); border: 1px solid rgba(255,204,0,0.3); }
    .dtier-low { background: rgba(90,90,90,0.12);  color: var(--muted2);  border: 1px solid rgba(90,90,90,0.3); }

    .dmini-row { display: flex; gap: 6px; flex-shrink: 0; }
    .dmini {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      background: rgba(0,255,127,0.04); border: 1px solid rgba(0,255,127,0.18);
      border-radius: 5px; padding: 0.55em 0.4em; gap: 0.15em;
    }
    .dmini-val {
      font-size: var(--fs-xl); font-weight: 800; font-variant-numeric: tabular-nums;
      line-height: 1; color: #00ff7f;
      text-shadow: 0 0 6px #00ff7f, 0 0 16px rgba(0,255,127,0.5);
    }
    .dmini-lbl { font-size: var(--fs-xs); color: rgba(0,255,127,0.5); text-transform: uppercase; letter-spacing: 0.07em; }

    /* ── Main panel ───────────────────────────────────────────────────────── */
    #dtask {
      font-size: var(--fs-task); font-weight: 600; line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
      overflow: hidden; flex-shrink: 0; transition: color 0.5s;
    }
    @media (min-width: 1920px) { #dtask { -webkit-line-clamp: 5; } }

    .dqueue-hdr { display: flex; justify-content: space-between; align-items: center; }
    #dqfrac {
      font-size: var(--fs-sm); font-variant-numeric: tabular-nums;
      font-family: "SF Mono",ui-monospace,monospace;
      color: var(--n-blue); text-shadow: 0 0 6px var(--n-blue);
    }
    .dtrack { height: 16px; background: rgba(0,212,255,0.08); border-radius: 8px; overflow: hidden; position: relative; }
    @media (min-width: 1920px) { .dtrack { height: 24px; border-radius: 12px; } }
    @media (min-width: 3840px) { .dtrack { height: 40px; border-radius: 20px; } }
    @media (min-width: 5120px) { .dtrack { height: 52px; border-radius: 26px; } }
    .dqpct {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%); z-index: 1;
      font-size: var(--fs-xs); font-family: "SF Mono",ui-monospace,monospace;
      font-weight: 800; color: rgba(255,255,255,0.6); letter-spacing: 0.06em;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    }
    @keyframes shimmer {
      from { background-position: -200% center; }
      to   { background-position:  200% center; }
    }
    #dqfill {
      height: 100%; border-radius: inherit;
      background: linear-gradient(90deg, #00ff7f, #00d4ff, #00fff5, #00d4ff, #00ff7f);
      background-size: 300% 100%;
      animation: shimmer 3s linear infinite;
      box-shadow: 0 0 10px rgba(0,212,255,0.6), 0 0 24px rgba(0,255,127,0.3);
      transition: width 0.8s ease;
    }
    #dqlist {
      display: flex; flex-direction: column; gap: 5px;
      overflow-y: auto; max-height: 115px; flex-shrink: 0;
    }
    @media (min-width: 1920px) { #dqlist { max-height: 230px; } }
    @media (min-width: 3840px) { #dqlist { max-height: 420px; } }
    @media (min-width: 5120px) { #dqlist { max-height: 560px; } }
    .dqitem {
      display: flex; align-items: flex-start; gap: 0.5em;
      font-size: var(--fs-sm); color: rgba(224,232,248,0.6); line-height: 1.4;
    }
    .dqnum { font-family: "SF Mono",ui-monospace,monospace; color: var(--muted2); flex-shrink: 0; min-width: 1.6em; }
    .dqtext { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

    /* Sparkline */
    .dspark-wrap { display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0; }
    .dspark-hdr { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
    #dtpmlbl {
      font-size: var(--fs-sm); font-family: "SF Mono",ui-monospace,monospace; font-weight: 700;
      color: var(--n-blue); text-shadow: 0 0 8px var(--n-blue), 0 0 18px rgba(0,212,255,0.5);
    }
    #dsparkline { display: block; width: 100%; flex: 1; min-height: 60px; }

    /* ── Metrics panel ────────────────────────────────────────────────────── */
    .dmet-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); flex-shrink: 0; }
    @media (min-width: 768px) and (max-width: 1199px) { .dmet-grid { grid-template-columns: repeat(4,1fr); } }
    .dmet-tile {
      background: rgba(255,45,120,0.04);
      border: 1px solid rgba(255,45,120,0.18);
      border-radius: 6px; padding: 0.8em 0.5em;
      display: flex; flex-direction: column; align-items: center; gap: 0.22em;
    }
    .dmet-val {
      font-size: var(--fs-metric); font-weight: 800;
      font-variant-numeric: tabular-nums; line-height: 1; letter-spacing: 0.03em;
    }
    .mv-tpm    { color: var(--n-blue);   text-shadow: 0 0 8px var(--n-blue),  0 0 24px rgba(0,212,255,0.4); }
    .mv-done   { color: #00ff7f;         text-shadow: 0 0 8px #00ff7f,        0 0 24px rgba(0,255,127,0.4); }
    .mv-events { color: var(--n-purple); text-shadow: 0 0 8px var(--n-purple),0 0 24px rgba(180,79,255,0.4); }
    .mv-tokens { color: var(--n-amber);  text-shadow: 0 0 8px var(--n-amber), 0 0 24px rgba(255,204,0,0.4); }
    .dmet-lbl {
      font-size: var(--fs-xs); color: rgba(255,45,120,0.5); text-transform: uppercase;
      letter-spacing: 0.08em; text-align: center; line-height: 1.2;
    }
    .dmodels { display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; min-height: 0; }
    @media (min-width: 768px) and (max-width: 1199px) { .dmodels { display: none; } }
    .dmodel-row { display: flex; flex-direction: column; gap: 4px; }
    .dmodel-hdr { display: flex; justify-content: space-between; font-size: var(--fs-xs); color: var(--muted2); }
    .dmodel-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%; }
    .dbar-track { height: 4px; background: rgba(180,79,255,0.1); border-radius: 2px; overflow: hidden; }
    @media (min-width: 1920px) { .dbar-track { height: 7px; } }
    @media (min-width: 3840px) { .dbar-track { height: 12px; } }
    @media (min-width: 5120px) { .dbar-track { height: 16px; } }
    .dbar-fill {
      height: 100%; border-radius: inherit;
      background: linear-gradient(90deg, var(--n-purple), var(--n-blue));
      box-shadow: 0 0 6px var(--n-purple); opacity: 0.8;
      transition: width 1s ease;
    }

    .paused #dqfill,
    .paused .dbar-fill,
    .paused .ddot,
    .paused .flash {
      animation: none !important;
      transition: none !important;
    }

    /* ── Ticker strip ─────────────────────────────────────────────────────── */
    #dlog-strip {
      display: flex; align-items: center; gap: 0.8em;
      height: var(--logbar-h); min-height: var(--logbar-h);
      padding: 0 var(--pad);
      background: rgba(0,0,8,0.96);
      border-top: 1px solid rgba(0,212,255,0.2);
      box-shadow: 0 -1px 20px rgba(0,212,255,0.08);
      overflow: hidden; flex-shrink: 0;
    }
    .dticker-label {
      font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.1em;
      color: rgba(0,212,255,0.45); font-weight: 800; white-space: nowrap; flex-shrink: 0;
    }
    @keyframes tickerPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
    .dticker-dot { width:6px; height:6px; border-radius:50%; background:#00ff7f; flex-shrink:0;
      animation: tickerPulse 2s ease-in-out infinite; box-shadow: 0 0 6px #00ff7f; }
    @media (min-width:1920px){.dticker-dot{width:10px;height:10px}}
    @media (min-width:3840px){.dticker-dot{width:16px;height:16px}}
    @media (min-width:5120px){.dticker-dot{width:20px;height:20px}}
    #dlogfeed {
      display: flex; align-items: center; gap: 1.5em;
      overflow: hidden; flex: 1; min-width: 0;
      -webkit-mask-image: linear-gradient(90deg, white 0%, white 80%, transparent 100%);
      mask-image: linear-gradient(90deg, white 0%, white 80%, transparent 100%);
    }
    @keyframes tickerSlide { from { opacity:0; transform: translateX(40px); } to { opacity:1; transform:none; } }
    .dlog {
      display: flex; align-items: center; gap: 0.45em;
      font-size: var(--fs-sm); line-height: 1;
      white-space: nowrap; flex-shrink: 0;
      animation: tickerSlide 0.5s ease;
    }
    .dlog + .dlog { opacity: 0.4; }
    .dlog + .dlog + .dlog { opacity: 0.15; }
    .dlog + .dlog + .dlog + .dlog { display: none; }
    .dlog-time {
      font-family: "SF Mono",ui-monospace,monospace; color: var(--muted2);
      flex-shrink: 0; font-size: var(--fs-xs);
    }
    .dlog-kind {
      padding: 0.12em 0.5em; border-radius: 3px; font-size: var(--fs-xs);
      font-weight: 800; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .lk-chat    { background:rgba(0,212,255,0.12);    color:var(--n-blue);   border:1px solid rgba(0,212,255,0.3);   text-shadow:0 0 6px var(--n-blue);   }
    .lk-wiki    { background:rgba(0,255,127,0.10);    color:#00ff7f;         border:1px solid rgba(0,255,127,0.3);   text-shadow:0 0 6px #00ff7f;         }
    .lk-reddit  { background:rgba(255,119,0,0.10);    color:var(--n-orange); border:1px solid rgba(255,119,0,0.3);   text-shadow:0 0 6px var(--n-orange);  }
    .lk-search  { background:rgba(255,204,0,0.09);    color:var(--n-amber);  border:1px solid rgba(255,204,0,0.3);   text-shadow:0 0 6px var(--n-amber);   }
    .lk-weather { background:rgba(0,255,245,0.09);    color:var(--n-cyan);   border:1px solid rgba(0,255,245,0.3);   text-shadow:0 0 6px var(--n-cyan);    }
    .lk-live    { background:rgba(180,79,255,0.10);   color:var(--n-purple); border:1px solid rgba(180,79,255,0.3);  text-shadow:0 0 6px var(--n-purple);  }
    .lk-web     { background:rgba(180,79,255,0.10);   color:var(--n-purple); border:1px solid rgba(180,79,255,0.3);  text-shadow:0 0 6px var(--n-purple);  }
    .lk-jobs    { background:rgba(255,204,0,0.14);    color:var(--n-amber);  border:1px solid rgba(255,204,0,0.4);   text-shadow:0 0 8px var(--n-amber);   }
    .lk-sys     { background:rgba(40,50,70,0.5);      color:var(--muted2);   border:1px solid rgba(60,70,90,0.4);    }
    .dlog-sum { color: rgba(200,215,240,0.65); overflow: hidden; text-overflow: ellipsis; max-width: 55vw; }
    .dlog-err { color: #ff4444; flex-shrink: 0; font-size: var(--fs-xs); text-shadow: 0 0 6px #ff4444; }

    /* ── Resource busy animation ──────────────────────────────────────────── */
    @keyframes resBusy {
      0%, 100% { border-color: rgba(255,204,0,0.35); box-shadow: 0 0 8px rgba(255,204,0,0.1), inset 0 0 12px rgba(255,204,0,0.03); }
      50% { border-color: rgba(255,204,0,0.65); box-shadow: 0 0 18px rgba(255,204,0,0.25), inset 0 0 24px rgba(255,204,0,0.06); }
    }
    .dres-card.busy {
      border-color: rgba(255,204,0,0.4);
      background: rgba(255,204,0,0.06);
      animation: resBusy 1.5s ease-in-out infinite;
    }
    .dres-card.busy .ddot { background: var(--n-amber); color: var(--n-amber); animation: dotPulse 1.2s ease-in-out infinite; }

    /* ── Scrollbar ────────────────────────────────────────────────────────── */
    ::-webkit-scrollbar { width: 3px; height: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.2); border-radius: 2px; }

    /* ── Empty ────────────────────────────────────────────────────────────── */
    .dempty { color: var(--muted2); font-size: var(--fs-sm); font-style: italic; text-align: center; padding: 1em 0; }

    /* ── Matrix overlay ───────────────────────────────────────────────────── */
    #matrix-overlay {
      position: fixed; inset: 0; z-index: 10000;
      overflow: hidden;
      opacity: 0; visibility: hidden; pointer-events: none;
      transition: opacity 0.7s ease, visibility 0.7s;
      /* 3D depth void — layered gradient planes creating dimensional shading */
      background:
        radial-gradient(ellipse 120% 28% at 50% 0%, rgba(0,12,3,0.07) 0%, transparent 70%),
        radial-gradient(ellipse 120% 28% at 50% 100%, rgba(0,10,2,0.06) 0%, transparent 70%),
        radial-gradient(ellipse 28% 120% at 0% 50%, rgba(0,8,2,0.05) 0%, transparent 70%),
        radial-gradient(ellipse 28% 120% at 100% 50%, rgba(0,8,2,0.05) 0%, transparent 70%),
        radial-gradient(ellipse at 0% 0%, rgba(0,10,3,0.06) 0%, transparent 35%),
        radial-gradient(ellipse at 100% 0%, rgba(0,8,2,0.04) 0%, transparent 30%),
        radial-gradient(ellipse at 0% 100%, rgba(0,8,2,0.04) 0%, transparent 30%),
        radial-gradient(ellipse at 100% 100%, rgba(0,10,3,0.06) 0%, transparent 35%),
        radial-gradient(ellipse 60% 60% at 50% 50%, #000000 0%, rgba(0,3,1,0.12) 100%),
        radial-gradient(ellipse 85% 85% at 50% 55%, rgba(0,5,1,0.03) 0%, transparent 80%),
        #000000;
    }
    #matrix-overlay.active { opacity: 1; visibility: visible; pointer-events: auto; }
    /* CRT scanlines */
    #matrix-overlay::before {
      content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px);
    }
    /* Screen-edge vignette for CRT curvature depth */
    #matrix-overlay::after {
      content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none;
      background: radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.35) 100%);
    }
    #matrix-canvas { position: absolute; inset: 0; z-index: 1; overflow: hidden; }

    /* Falling column */
    .mx-col {
      position: absolute; top: 0;
      display: flex; flex-direction: column; align-items: center;
      font-family: "SF Mono","Fira Code","Cascadia Code",ui-monospace,monospace;
      line-height: 1.15; pointer-events: none;
      will-change: transform;
      animation: mxFall var(--mx-dur) var(--mx-ease, cubic-bezier(0.12, 0, 0.39, 0)) forwards;
      font-size: var(--mx-size); opacity: var(--mx-opacity); filter: blur(var(--mx-blur));
      /* Trail gradient mask — fade top, bright head at bottom */
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.06) 4%, rgba(0,0,0,0.25) 18%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.82) 75%, white 95%);
      mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.06) 4%, rgba(0,0,0,0.25) 18%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.82) 75%, white 95%);
    }
    @keyframes mxFall {
      from { transform: translateY(calc(-1 * var(--mx-height))); }
      to   { transform: translateY(100vh); }
    }

    /* Character glyph — phosphor green with CRT bloom */
    .mx-ch {
      display: block;
      color: #00ff41;
      text-shadow:
        0 0 0.06em #00ff41,
        0 0 0.18em rgba(0,255,65,0.65),
        0 0 0.45em rgba(0,200,50,0.3),
        0 0 0.9em rgba(0,150,30,0.15),
        0 0 1.6em rgba(0,100,20,0.06);
    }
    /* Head character — bright white-green leading edge */
    .mx-ch:last-child {
      color: #ccffdd;
      text-shadow:
        0 0 0.06em #ffffff,
        0 0 0.15em #ddffee,
        0 0 0.35em #00ff41,
        0 0 0.7em rgba(0,255,65,0.65),
        0 0 1.3em rgba(0,255,65,0.35),
        0 0 2.2em rgba(0,200,50,0.15);
    }

    /* Depth tiers — parallax through size, opacity, and defocus */
    .mx-col[data-depth="0"]{--mx-size:0.62rem;--mx-opacity:0.12;--mx-blur:1.5px}
    .mx-col[data-depth="1"]{--mx-size:0.74rem;--mx-opacity:0.18;--mx-blur:1.1px}
    .mx-col[data-depth="2"]{--mx-size:0.88rem;--mx-opacity:0.28;--mx-blur:0.7px}
    .mx-col[data-depth="3"]{--mx-size:1.04rem;--mx-opacity:0.42;--mx-blur:0.35px}
    .mx-col[data-depth="4"]{--mx-size:1.22rem;--mx-opacity:0.6;--mx-blur:0.15px}
    .mx-col[data-depth="5"]{--mx-size:1.44rem;--mx-opacity:0.8;--mx-blur:0px}
    .mx-col[data-depth="6"]{--mx-size:1.72rem;--mx-opacity:0.95;--mx-blur:0px}
    @media(min-width:1920px){
      .mx-col[data-depth="0"]{--mx-size:0.92rem}
      .mx-col[data-depth="1"]{--mx-size:1.08rem}
      .mx-col[data-depth="2"]{--mx-size:1.32rem}
      .mx-col[data-depth="3"]{--mx-size:1.58rem}
      .mx-col[data-depth="4"]{--mx-size:1.86rem}
      .mx-col[data-depth="5"]{--mx-size:2.18rem}
      .mx-col[data-depth="6"]{--mx-size:2.6rem}
    }
    @media(min-width:3840px){
      .mx-col[data-depth="0"]{--mx-size:1.6rem}
      .mx-col[data-depth="1"]{--mx-size:1.9rem}
      .mx-col[data-depth="2"]{--mx-size:2.3rem}
      .mx-col[data-depth="3"]{--mx-size:2.8rem}
      .mx-col[data-depth="4"]{--mx-size:3.4rem}
      .mx-col[data-depth="5"]{--mx-size:4rem}
      .mx-col[data-depth="6"]{--mx-size:4.8rem}
    }
    @media(min-width:5120px){
      .mx-col[data-depth="0"]{--mx-size:2rem}
      .mx-col[data-depth="1"]{--mx-size:2.4rem}
      .mx-col[data-depth="2"]{--mx-size:2.9rem}
      .mx-col[data-depth="3"]{--mx-size:3.5rem}
      .mx-col[data-depth="4"]{--mx-size:4.2rem}
      .mx-col[data-depth="5"]{--mx-size:5rem}
      .mx-col[data-depth="6"]{--mx-size:6rem}
    }

    /* Glass close button — translucent with blocked depth shading */
    .mx-close {
      position: absolute; top: 16px; right: 16px; z-index: 4;
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, rgba(40,40,40,0.3) 0%, rgba(20,20,20,0.2) 50%, rgba(10,10,10,0.25) 100%);
      backdrop-filter: blur(16px) saturate(0.4);
      -webkit-backdrop-filter: blur(16px) saturate(0.4);
      border: 1px solid rgba(255,255,255,0.06);
      border-top-color: rgba(255,255,255,0.1);
      border-left-color: rgba(255,255,255,0.08);
      border-radius: 6px;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.05),
        inset 0 -1px 2px rgba(0,0,0,0.3),
        0 2px 8px rgba(0,0,0,0.5),
        0 0 1px rgba(255,255,255,0.03);
      color: rgba(255,255,255,0.22);
      font-size: 16px; font-weight: 300; line-height: 1;
      cursor: pointer; transition: all 0.25s ease;
    }
    .mx-close:hover {
      background: linear-gradient(135deg, rgba(50,50,50,0.45) 0%, rgba(30,30,30,0.35) 50%, rgba(20,20,20,0.4) 100%);
      color: rgba(255,255,255,0.5);
      border-color: rgba(255,255,255,0.12);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.08),
        inset 0 -1px 2px rgba(0,0,0,0.4),
        0 4px 14px rgba(0,0,0,0.6),
        0 0 1px rgba(255,255,255,0.06);
    }
    @media(min-width:1920px){.mx-close{width:46px;height:46px;font-size:22px;top:24px;right:24px;border-radius:8px}}
    @media(min-width:3840px){.mx-close{width:68px;height:68px;font-size:32px;top:40px;right:40px;border-radius:12px}}
    @media(min-width:5120px){.mx-close{width:86px;height:86px;font-size:40px;top:52px;right:52px;border-radius:16px}}

    /* Enter Matrix topbar button */
    .dmatrix-btn {
      border: 1px solid rgba(0,255,65,0.35);
      background: rgba(0,255,65,0.08);
      color: rgba(0,255,65,0.8);
      border-radius: 4px;
      padding: 0.28em 0.75em;
      font-size: var(--fs-sm);
      font-weight: 700;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: all 0.3s ease;
      text-shadow: 0 0 6px rgba(0,255,65,0.3);
      white-space: nowrap;
    }
    .dmatrix-btn:hover {
      border-color: rgba(0,255,65,0.6);
      background: rgba(0,255,65,0.14);
      color: #00ff41;
      text-shadow: 0 0 10px rgba(0,255,65,0.6), 0 0 25px rgba(0,255,65,0.25);
      box-shadow: 0 0 14px rgba(0,255,65,0.15);
    }

    /* Daily button — amber/gold accent */
    .ddaily-btn {
      border: 1px solid rgba(255,191,0,0.35);
      background: rgba(255,191,0,0.08);
      color: rgba(255,191,0,0.8);
      border-radius: 4px;
      padding: 0.28em 0.75em;
      font-size: var(--fs-sm);
      font-weight: 700;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: all 0.3s ease;
      text-shadow: 0 0 6px rgba(255,191,0,0.3);
      white-space: nowrap;
    }
    .ddaily-btn:hover {
      border-color: rgba(255,191,0,0.6);
      background: rgba(255,191,0,0.14);
      color: #ffbf00;
      text-shadow: 0 0 10px rgba(255,191,0,0.6), 0 0 25px rgba(255,191,0,0.25);
      box-shadow: 0 0 14px rgba(255,191,0,0.15);
    }

    /* ── Daily Work Overlay ───────────────────────────────────────── */
    #daily-overlay {
      position: fixed; inset: 0; z-index: 100;
      opacity: 0; visibility: hidden; pointer-events: none;
      transition: opacity 0.5s ease, visibility 0.5s ease;
      background:
        radial-gradient(ellipse at 50% 50%, rgba(15,12,5,0.95) 0%, rgba(5,4,1,0.98) 100%),
        #0a0800;
      overflow-y: auto;
    }
    #daily-overlay.active { opacity: 1; visibility: visible; pointer-events: auto; }
    /* Amber scanlines */
    #daily-overlay::before {
      content: ''; position: fixed; inset: 0; z-index: 1; pointer-events: none;
      background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,191,0,0.02) 3px, rgba(255,191,0,0.02) 6px);
    }
    .daily-close {
      position: fixed; top: 16px; right: 16px; z-index: 102;
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, rgba(40,35,10,0.3) 0%, rgba(20,18,5,0.2) 50%, rgba(10,8,2,0.25) 100%);
      backdrop-filter: blur(16px) saturate(0.4);
      -webkit-backdrop-filter: blur(16px) saturate(0.4);
      border: 1px solid rgba(255,191,0,0.12);
      border-radius: 6px;
      box-shadow: inset 0 1px 0 rgba(255,191,0,0.05), 0 2px 8px rgba(0,0,0,0.5);
      color: rgba(255,191,0,0.35);
      font-size: 16px; font-weight: 300; line-height: 1;
      cursor: pointer; transition: all 0.25s ease;
    }
    .daily-close:hover {
      background: linear-gradient(135deg, rgba(50,45,15,0.45) 0%, rgba(30,26,8,0.35) 100%);
      color: rgba(255,191,0,0.7);
      border-color: rgba(255,191,0,0.25);
    }
    @media(min-width:1920px){.daily-close{width:46px;height:46px;font-size:22px;top:24px;right:24px}}
    @media(min-width:3840px){.daily-close{width:68px;height:68px;font-size:32px;top:40px;right:40px}}
    @media(min-width:5120px){.daily-close{width:86px;height:86px;font-size:40px;top:52px;right:52px}}

    .daily-content {
      position: relative; z-index: 2;
      max-width: 900px; margin: 0 auto;
      padding: 60px 40px 80px;
      font-family: "SF Mono","Fira Code","Cascadia Code",ui-monospace,monospace;
    }
    .daily-header {
      text-align: center; margin-bottom: 48px;
    }
    .daily-header h1 {
      font-size: 2.4rem; font-weight: 900; letter-spacing: 0.08em;
      color: #ffbf00;
      text-shadow: 0 0 20px rgba(255,191,0,0.4), 0 0 60px rgba(255,160,0,0.15);
      margin: 0 0 8px;
    }
    .daily-header .daily-meta {
      font-size: 0.85rem; color: rgba(255,191,0,0.5); letter-spacing: 0.04em;
    }
    .daily-header .daily-stale {
      display: inline-block; margin-left: 12px;
      padding: 2px 10px; border-radius: 3px;
      background: rgba(255,80,0,0.15); border: 1px solid rgba(255,80,0,0.3);
      color: #ff6600; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em;
    }
    .daily-body {
      color: rgba(255,220,150,0.85);
      font-size: 0.95rem; line-height: 1.7;
    }
    .daily-body h1,.daily-body h2,.daily-body h3 {
      color: #ffbf00; font-weight: 800;
      text-shadow: 0 0 8px rgba(255,191,0,0.25);
      margin-top: 2em; margin-bottom: 0.5em;
      border-bottom: 1px solid rgba(255,191,0,0.12);
      padding-bottom: 0.3em;
    }
    .daily-body h1{font-size:1.6rem} .daily-body h2{font-size:1.3rem} .daily-body h3{font-size:1.1rem}
    .daily-body ul,.daily-body ol { padding-left: 1.5em; }
    .daily-body li { margin-bottom: 0.4em; }
    .daily-body strong { color: #ffd966; }
    .daily-body code {
      background: rgba(255,191,0,0.08); border: 1px solid rgba(255,191,0,0.12);
      padding: 0.1em 0.4em; border-radius: 3px; font-size: 0.88em; color: #ffe0a0;
    }
    .daily-body a { color: #ffbf00; text-decoration: underline; }
    .daily-empty {
      text-align: center; padding: 80px 20px;
      color: rgba(255,191,0,0.4); font-size: 1.1rem;
    }
    .daily-empty .daily-empty-icon { font-size: 3rem; margin-bottom: 16px; }
    @media(min-width:1920px){
      .daily-content{max-width:1200px;padding:80px 60px 100px}
      .daily-header h1{font-size:3.2rem}
      .daily-body{font-size:1.1rem}
    }
    @media(min-width:3840px){
      .daily-content{max-width:2000px;padding:120px 100px 160px}
      .daily-header h1{font-size:4.8rem}
      .daily-body{font-size:1.5rem}
    }
    @media(min-width:5120px){
      .daily-content{max-width:2800px;padding:160px 140px 200px}
      .daily-header h1{font-size:6rem}
      .daily-body{font-size:1.9rem}
    }
  </style>
</head>
<body>
<div id="dapp">

  <header id="dtop">
    <div class="dlogo">&#x2B21; Local Crew</div>
    <div class="dtop-center">
      <span id="dorch">&mdash;</span>
      <span id="dmode">&mdash;</span>
      <span id="dbusy" class="ddot" style="display:none"></span>
    </div>
    <div class="dtop-right">
      <span id="dactivity" class="dactivity">Auto Pause</span>
      <button id="dactive-toggle" class="dactive-btn" type="button" aria-label="Toggle always-active display mode">Monitor Off</button>
      <button id="dmatrix-btn" class="dmatrix-btn" type="button">Enter Matrix</button>
      <button id="ddaily-btn" class="ddaily-btn" type="button">Daily</button>
      <span id="dhealthdot" class="ddot"></span>
      <span id="dclock">&mdash;</span>
    </div>
  </header>

  <div id="dbody">
    <section id="dpnet" class="dpanel">
      <h2 class="dpanel-title">&#x25cf; Network</h2>
      <div id="dres-grid"></div>
      <div class="dmini-row">
        <div class="dmini"><div id="drescnt" class="dmini-val">&mdash;</div><div class="dmini-lbl">Online</div></div>
        <div class="dmini"><div id="dpending" class="dmini-val">&mdash;</div><div class="dmini-lbl">Queued</div></div>
        <div class="dmini"><div id="ddone" class="dmini-val">&mdash;</div><div class="dmini-lbl">Done</div></div>
      </div>
    </section>

    <section id="dpmain" class="dpanel">
      <h2 class="dpanel-title">&#x25cf; Current Focus</h2>
      <div id="dtask">Connecting&hellip;</div>
      <div>
        <div class="dqueue-hdr">
          <span class="dsub">Queue</span>
          <span id="dqfrac">0 pending &middot; 0 done</span>
        </div>
        <div class="dtrack" style="margin-top:7px"><div id="dqfill" style="width:0%"></div><span id="dqpct" class="dqpct"></span></div>
        <div id="dqlist" style="margin-top:9px"></div>
      </div>
      <div class="dspark-wrap">
        <div class="dspark-hdr">
          <span class="dsub">Token Activity <span style="color:var(--muted);font-size:0.85em">(60s)</span></span>
          <span id="dtpmlbl">&mdash; tok/min</span>
        </div>
        <canvas id="dsparkline"></canvas>
      </div>
    </section>

    <section id="dpmet" class="dpanel">
      <h2 class="dpanel-title">&#x25cf; Metrics</h2>
      <div class="dmet-grid">
        <div class="dmet-tile"><div id="dtpmbig" class="dmet-val mv-tpm">&mdash;</div><div class="dmet-lbl">tok / min</div></div>
        <div class="dmet-tile"><div id="dtasksdone" class="dmet-val mv-done">&mdash;</div><div class="dmet-lbl">tasks done</div></div>
        <div class="dmet-tile"><div id="devents" class="dmet-val mv-events">&mdash;</div><div class="dmet-lbl">events</div></div>
        <div class="dmet-tile"><div id="dtokens" class="dmet-val mv-tokens">&mdash;</div><div class="dmet-lbl">tokens</div></div>
      </div>
      <div class="dmodels">
        <div class="dsub" style="flex-shrink:0;color:rgba(180,79,255,0.5)">Model Activity</div>
        <div id="dmodelbars" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:9px;min-height:0"></div>
      </div>
    </section>
  </div>

  <footer id="dlog-strip">
    <span class="dticker-dot"></span>
    <span class="dticker-label">Live</span>
    <div id="dlogfeed"></div>
  </footer>
</div>

<div id="matrix-overlay">
  <div id="matrix-canvas"></div>
  <button id="mx-close" class="mx-close" type="button" aria-label="Exit Matrix view">&#x2715;</button>
</div>

<div id="daily-overlay">
  <button id="daily-close" class="daily-close" type="button" aria-label="Close Daily Work">&#x2715;</button>
  <div class="daily-content">
    <div class="daily-header">
      <h1>&#x2600; Daily Work</h1>
      <div class="daily-meta">
        <span id="daily-updated"></span>
        <span id="daily-stale-badge" class="daily-stale" style="display:none">STALE</span>
      </div>
    </div>
    <div id="daily-body" class="daily-body">
      <div class="daily-empty">
        <div class="daily-empty-icon">&#x1F4CB;</div>
        Loading&hellip;
      </div>
    </div>
  </div>
</div>

<script>
  var ST={resources:[],audit:[],lastId:-1,lastSyntheticId:-1,tokenWin:[],tpmHist:[],busyResources:{},activeAliases:{},resourceHealth:{}};
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

  // Flash glow animation on value update
  function setVal(id,text){
    var e=el(id);if(!e)return;
    if(e.textContent===text)return;
    e.textContent=text;
    e.classList.remove('flash');
    void e.offsetWidth;
    e.classList.add('flash');
  }

  // Health
  async function checkHealth(){
    var data=await fetchJ('/api/health');
    var ok=data&&data.ok===true;
    el('dhealthdot').className='ddot '+(ok?'ddot-green':'ddot-red');
  }

  // Status
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
    if(next&&next.content){
      taskEl.textContent=next.content;taskEl.style.color='';
    } else if(last&&last.content){
      taskEl.textContent='\u2713 '+last.content;taskEl.style.color='var(--muted2)';
    } else if(mode==='auto'){
      taskEl.textContent='Auto mode \u2014 scanning queue\u2026';taskEl.style.color='var(--muted2)';
    } else{taskEl.textContent='Idle \u2014 '+mode+' mode';taskEl.style.color='var(--muted)';}

    var pending=(data.auto&&data.auto.pendingCount)||0,completed=(data.auto&&data.auto.completedCount)||0;
    el('dqfrac').textContent=pending+' pending \u00b7 '+fmt(completed)+' done';
    // Bar shows pending queue depth: wider = more backlog. Fades out when idle.
    var barPct=pending>0?Math.min(100,pending*10):0;
    el('dqfill').style.width=barPct+'%';
    var pctEl=el('dqpct');if(pctEl)pctEl.textContent=pending>0?pending+' queued':'';
    setVal('dpending',fmt(pending));setVal('ddone',fmt(completed));setVal('dtasksdone',fmt(completed));

    var tel=data.telemetry;
    if(tel){
      setVal('devents',fmt(tel.totalEvents));
      var toks=0,mkeys=Object.keys(tel.models||{});
      for(var i=0;i<mkeys.length;i++)toks+=(tel.models[mkeys[i]].evalCount||0);
      setVal('dtokens',fmt(toks));
      renderModelBars(tel.models);
    }
    var cap=data.capacity;
    if(cap)setVal('drescnt',String(cap.resourceCount||0));
    // Update active aliases from polling data
    if(Array.isArray(data.activeResources)){
      ST.activeAliases={};
      for(var ai=0;ai<data.activeResources.length;ai++){
        var ar=data.activeResources[ai];
        ST.activeAliases[typeof ar==='string'?ar:ar.alias]=true;
      }
    }
    // Update health data from polling
    if(data.resourceHealth && typeof data.resourceHealth==='object'){
      ST.resourceHealth=data.resourceHealth;
    }
    refreshResourceDots();
  }

  // Queue
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

  // Resources
  function getResourceDotClass(alias){
    if(ST.busyResources[alias])return'ddot-amber';
    // Health poll data takes precedence over activity-based detection
    var h=ST.resourceHealth[alias];
    if(h){
      if(h.status==='offline')return'ddot-red';
      if(h.status==='degraded')return'ddot-amber';
      return'ddot-green';
    }
    if(ST.activeAliases[alias])return'ddot-green';
    return'ddot-red';
  }
  function refreshResourceDots(){
    var cards=document.querySelectorAll('.dres-card');
    for(var i=0;i<cards.length;i++){
      var a=cards[i].getAttribute('data-alias');if(!a)continue;
      var dot=cards[i].querySelector('.ddot');if(!dot)continue;
      dot.className='ddot '+getResourceDotClass(a);
      if(ST.busyResources[a]){cards[i].classList.add('busy');}else{cards[i].classList.remove('busy');}
    }
  }
  async function loadResources(){
    var data=await fetchJ('/api/resources');
    if(!Array.isArray(data))return;
    var grid=el('dres-grid');
    if(!data.length){grid.innerHTML='<div class="dempty">No resources</div>';return;}
    var html='';
    for(var i=0;i<data.length;i++){
      var r=data[i],tier=r.tier||'low',label=esc(r.label||r.alias);
      var dotCls=getResourceDotClass(r.alias);
      var busyCls=ST.busyResources[r.alias]?' busy':'';
      html+='<div class="dres-card'+busyCls+'" data-alias="'+esc(r.alias)+'"><span class="ddot '+dotCls+'"></span>';
      html+='<span class="dres-name" title="'+label+'">'+label+'</span>';
      html+='<span class="dtier dtier-'+tier+'">'+tier+'</span></div>';
    }
    grid.innerHTML=html;
  }

  // Audit
  var KIND_MAP={
    'ollama.chat':     ['chat',   'lk-chat'],
    'wikipedia.search':['wiki',   'lk-wiki'],
    'reddit.search':   ['reddit', 'lk-reddit'],
    'search.web':      ['search', 'lk-search'],
    'weather.fetch':   ['weather','lk-weather'],
    'benlive.fetch':   ['live',   'lk-live'],
    'website.fetch':   ['web',    'lk-web'],
    'system':          ['sys',    'lk-sys']
  };
  async function loadAudit(){
    var data=await fetchJ('/api/audit?limit=50');
    if(!Array.isArray(data))return;
    var newEvs=[],i,ev;
    for(i=0;i<data.length;i++){if(data[i].id>ST.lastId)newEvs.push(data[i]);}
    if(newEvs.length>0){
      for(i=0;i<newEvs.length;i++){
        ev=newEvs[i];
        if(ev.summary)mxFeedText(ev.summary);
        if(ev.evalCount&&ev.evalCount>0)ST.tokenWin.push({t:new Date(ev.timestamp).getTime(),n:ev.evalCount});
        if(ev.id>ST.lastId)ST.lastId=ev.id;
      }
      var cutoff=Date.now()-60000;
      ST.tokenWin=ST.tokenWin.filter(function(p){return p.t>=cutoff;});
      ST.audit=data.slice(0,30);renderLog();
    }
    var tpm=calcTpm();
    ST.tpmHist.push(tpm);if(ST.tpmHist.length>80)ST.tpmHist.shift();
    setVal('dtpmlbl',fmt(tpm)+' tok/min');setVal('dtpmbig',fmt(tpm));
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
    var feed=el('dlogfeed');
    var evs=ST.audit.slice(0,3);
    var html='',i,ev,info,t;
    for(i=0;i<evs.length;i++){
      ev=evs[i];
      // Detect job-related events by scope or summary keyword
      var isJob=(ev.scope&&ev.scope.indexOf('job')>=0)||(ev.summary&&(ev.summary.toLowerCase().indexOf('job')>=0||ev.summary.toLowerCase().indexOf('opportunit')>=0||ev.summary.toLowerCase().indexOf('compens')>=0||ev.summary.toLowerCase().indexOf('salary')>=0));
      if(isJob){info=['jobs','lk-jobs'];}
      else{info=KIND_MAP[ev.kind]||[ev.kind.split('.').pop(),'lk-sys'];}
      t=new Date(ev.timestamp).toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
      html+='<div class="dlog"><span class="dlog-time">'+t+'</span>';
      html+='<span class="dlog-kind '+info[1]+'">'+info[0]+'</span>';
      html+='<span class="dlog-sum">'+esc(ev.summary)+'</span>';
      if(!ev.success)html+='<span class="dlog-err">\u2717</span>';
      html+='</div>';
    }
    feed.innerHTML=html;
  }

  function pushDisplayLog(kind,summary,success){
    var nowIso=new Date().toISOString();
    var entry={
      id:ST.lastSyntheticId,
      timestamp:nowIso,
      kind:kind,
      scope:'display.event',
      summary:summary,
      success:success!==false
    };
    ST.lastSyntheticId-=1;
    ST.audit.unshift(entry);
    if(ST.audit.length>30)ST.audit=ST.audit.slice(0,30);
    renderLog();
  }

  function applyStatePayload(d){
    if(d.orchestratorName)el('dorch').textContent=d.orchestratorName;
    if(d.mode){
      var modeEl=el('dmode');
      modeEl.textContent=String(d.mode).toUpperCase();
      modeEl.className='m-'+d.mode;
    }

    var busyEl=el('dbusy');
    if(d.auto&&d.auto.busy){busyEl.style.display='';busyEl.className='ddot ddot-amber dpulse';}
    else if(busyEl){busyEl.style.display='none';}

    var auto=d.auto||{};
    var nextTask=auto.nextTask||null;
    var lastCompleted=auto.lastCompleted||null;
    var taskEl=el('dtask');
    if(nextTask&&nextTask.content){
      taskEl.textContent=nextTask.content;
      taskEl.style.color='';
    } else if(lastCompleted&&lastCompleted.content){
      var statusPrefix=lastCompleted.status==='failed'?'✗ ':'✓ ';
      taskEl.textContent=statusPrefix+lastCompleted.content;
      taskEl.style.color=lastCompleted.status==='failed'?'#ff6666':'var(--muted2)';
    } else if(d.mode==='auto'){
      taskEl.textContent='Auto mode — scanning queue…';
      taskEl.style.color='var(--muted2)';
    } else {
      taskEl.textContent='Idle — '+(d.mode||'command')+' mode';
      taskEl.style.color='var(--muted)';
    }

    var pending=Number(auto.pendingCount||0),completed=Number(auto.completedCount||0);
    el('dqfrac').textContent=pending+' pending \u00b7 '+fmt(completed)+' done';
    var barPct2=pending>0?Math.min(100,pending*10):0;
    el('dqfill').style.width=barPct2+'%';
    var pctEl2=el('dqpct');if(pctEl2)pctEl2.textContent=pending>0?pending+' queued':'';
    setVal('dpending',fmt(pending));
    setVal('ddone',fmt(completed));
    setVal('dtasksdone',fmt(completed));

    if(Array.isArray(d.activeResources)){
      setVal('drescnt',String(d.activeResources.length));
      // Track which aliases are active (have telemetry) for dot coloring
      ST.activeAliases={};
      for(var ai=0;ai<d.activeResources.length;ai++){
        var ar=d.activeResources[ai];
        ST.activeAliases[typeof ar==='string'?ar:ar.alias]=true;
      }
    }
    // Update health data from SSE
    if(d.resourceHealth && typeof d.resourceHealth==='object'){
      ST.resourceHealth=d.resourceHealth;
    }
    refreshResourceDots();

    if(typeof d.systemTps==='number'){
      var tpm=Math.max(0,Math.round(d.systemTps*60));
      ST.tpmHist.push(tpm);if(ST.tpmHist.length>80)ST.tpmHist.shift();
      setVal('dtpmlbl',fmt(tpm)+' tok/min');
      setVal('dtpmbig',fmt(tpm));
      drawSpark();
    }
  }

  // Model bars
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
      html+='<span style="color:rgba(180,79,255,0.6)">'+fmt(e.toks)+'t</span></div>';
      html+='<div class="dbar-track"><div class="dbar-fill" style="width:'+pct+'%"></div></div></div>';
    }
    container.innerHTML=html;
  }

  // Sparkline
  var cvs=document.getElementById('dsparkline'),ctx=cvs.getContext('2d');
  new ResizeObserver(function(){drawSpark();}).observe(cvs);
  function drawSpark(){
    var W=cvs.clientWidth,H=cvs.clientHeight;
    if(W<4||H<4)return;
    if(cvs.width!==W||cvs.height!==H){cvs.width=W;cvs.height=H;}
    ctx.clearRect(0,0,W,H);
    var data=ST.tpmHist;
    if(data.length<2){
      ctx.strokeStyle='rgba(0,212,255,0.08)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();return;
    }
    var maxV=0,i,pts=[],p;
    for(i=0;i<data.length;i++)if(data[i]>maxV)maxV=data[i];
    if(maxV<1)maxV=1;
    for(i=0;i<data.length;i++)pts.push({x:(i/(data.length-1))*W,y:H-(data[i]/maxV)*(H-8)-4});

    // Gradient fill
    var grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'rgba(0,212,255,0.4)');
    grad.addColorStop(0.5,'rgba(0,255,127,0.15)');
    grad.addColorStop(1,'rgba(0,212,255,0.01)');
    ctx.beginPath();ctx.moveTo(pts[0].x,H);
    for(i=0;i<pts.length;i++){p=pts[i];ctx.lineTo(p.x,p.y);}
    ctx.lineTo(pts[pts.length-1].x,H);ctx.closePath();
    ctx.fillStyle=grad;ctx.fill();

    // Glow line
    ctx.save();
    ctx.shadowColor='#00d4ff';ctx.shadowBlur=8;
    ctx.beginPath();
    for(i=0;i<pts.length;i++){p=pts[i];if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
    ctx.strokeStyle='#00d4ff';ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
    ctx.restore();

    // Leading edge dot
    var last=pts[pts.length-1];
    ctx.save();
    ctx.shadowColor='#00ff7f';ctx.shadowBlur=16;
    ctx.beginPath();ctx.arc(last.x,last.y,3.5,0,Math.PI*2);
    ctx.fillStyle='#00ff7f';ctx.fill();
    ctx.restore();

    // Grid lines
    ctx.strokeStyle='rgba(0,212,255,0.06)';ctx.lineWidth=1;
    for(i=1;i<4;i++){var gy=(i/4)*H;ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}

    // Max label
    if(maxV>0){
      ctx.fillStyle='rgba(0,212,255,0.45)';
      var fs=Math.max(9,Math.min(12,Math.floor(H*0.17)));
      ctx.font=fs+'px "SF Mono",ui-monospace,monospace';
      ctx.fillText(fmt(maxV)+' max',4,fs+2);
    }
  }

  // Initial load (one fetch to populate UI before stream lifecycle kicks in)
  async function pollFull(){await checkHealth();await Promise.all([loadStatus(),loadQueue(),loadAudit()]);}

  // Display activity lifecycle:
  // - default: pause network work when unfocused/hidden
  // - optional: always-active monitor mode (for dedicated billboard screens)
  var DISPLAY_ACTIVITY_KEY='localCrewDisplayAlwaysActive';
  var query=new URLSearchParams(window.location.search);
  var alwaysActive=query.get('active')==='1'||window.localStorage.getItem(DISPLAY_ACTIVITY_KEY)==='1';
  var sseActive=false;
  var sseConnection=null;
  var fallbackTimer=null;
  var reconnectTimer=null;
  var fullPollTimer=null;
  var resourcePollTimer=null;

  function shouldStayActive(){
    if(alwaysActive)return true;
    return document.visibilityState==='visible'&&document.hasFocus();
  }

  function clearTimer(name){
    if(name){clearInterval(name);clearTimeout(name);} 
  }

  function updateActivityControls(){
    var statusEl=el('dactivity');
    var btn=el('dactive-toggle');
    if(statusEl){
      statusEl.textContent=alwaysActive?'Always Active':'Auto Pause';
    }
    if(btn){
      btn.textContent=alwaysActive?'Monitor On':'Monitor Off';
      btn.className='dactive-btn'+(alwaysActive?' on':'');
    }
  }

  function stopPolling(){
    clearTimer(fullPollTimer);fullPollTimer=null;
    clearTimer(resourcePollTimer);resourcePollTimer=null;
    clearTimer(fallbackTimer);fallbackTimer=null;
  }

  function startPolling(){
    if(!fullPollTimer)fullPollTimer=setInterval(pollFull,30000);
    if(!resourcePollTimer)resourcePollTimer=setInterval(loadResources,60000);
  }

  function closeSSE(){
    if(sseConnection){
      try{sseConnection.close();}catch(e){}
      sseConnection=null;
    }
    sseActive=false;
    clearTimer(reconnectTimer);reconnectTimer=null;
  }

  function startSSE(){
    if(!shouldStayActive()||sseConnection)return;
    var es=new EventSource('/api/events');
    sseConnection=es;
    es.onopen=function(){
      sseActive=true;
      clearTimer(fallbackTimer);fallbackTimer=null;
    };
    es.onmessage=function(ev){
      var msg;try{msg=JSON.parse(ev.data);}catch(e){return;}
      mxProcessEvent(msg);
      if(msg.type==='connected'){pollFull();return;}
      if(msg.type==='state'){
        var d=msg;
        applyStatePayload(d);
        if(document.visibilityState!=='hidden'||alwaysActive){
          if(typeof window.requestIdleCallback==='function'){
            window.requestIdleCallback(function(){loadStatus();loadQueue();});
          } else {
            setTimeout(function(){loadStatus();loadQueue();},50);
          }
        }
        return;
      }
      if(msg.type==='task-start'){
        if(msg.resourceAlias){ST.busyResources[msg.resourceAlias]=true;mxMarkBusy(msg.resourceAlias,true);refreshResourceDots();}
        pushDisplayLog('system','Task #'+msg.taskId+' started on @'+msg.resourceAlias+': '+(msg.taskContent||''),true);
        return;
      }
      if(msg.type==='task-complete'){
        if(msg.resourceAlias){delete ST.busyResources[msg.resourceAlias];mxMarkBusy(msg.resourceAlias,false);refreshResourceDots();}
        var ok=msg.status==='completed';
        pushDisplayLog('system','Task #'+msg.taskId+' '+(ok?'completed':'failed')+' on @'+msg.resourceAlias+' ('+Math.round((msg.durationMs||0)/1000)+'s, '+fmt(msg.tokenCount||0)+' tok)',ok);
        return;
      }
      if(msg.type==='task-write'){
        pushDisplayLog('system','Task #'+msg.taskId+' WRITE['+msg.stage+']['+msg.path+'] '+(msg.verified?'✓':'✗'),msg.verified!==false);
        return;
      }
      if(msg.type==='queue-fill'){
        pushDisplayLog('system','Queue-fill '+msg.phase+(msg.verdict?(' verdict: '+msg.verdict):'')+' ('+fmt(msg.taskCount||0)+' tasks)',true);
        return;
      }
      if(msg.type==='daily-complete'){
        pushDisplayLog('system','DAILY_COMPLETE '+(msg.sessionId?('('+msg.sessionId+') '):'')+(msg.summary||''),true);
      }
    };
    es.onerror=function(){
      sseActive=false;
      try{es.close();}catch(e){}
      if(sseConnection===es)sseConnection=null;
      if(!shouldStayActive()){
        clearTimer(fallbackTimer);fallbackTimer=null;
        return;
      }
      if(!fallbackTimer){fallbackTimer=setInterval(pollFull,15000);}
      clearTimer(reconnectTimer);
      reconnectTimer=setTimeout(function(){startSSE();},30000);
    };
  }

  function syncActivityState(){
    document.body.classList.toggle('paused',!shouldStayActive());
    if(shouldStayActive()){
      startPolling();
      pollFull();
      loadResources();
      startSSE();
      return;
    }
    closeSSE();
    stopPolling();
  }

  var toggleBtn=el('dactive-toggle');
  if(toggleBtn){
    toggleBtn.addEventListener('click',function(){
      alwaysActive=!alwaysActive;
      window.localStorage.setItem(DISPLAY_ACTIVITY_KEY,alwaysActive?'1':'0');
      updateActivityControls();
      syncActivityState();
    });
  }

  document.addEventListener('visibilitychange',syncActivityState);
  window.addEventListener('focus',syncActivityState);
  window.addEventListener('blur',syncActivityState);
  window.addEventListener('pageshow',syncActivityState);
  window.addEventListener('pagehide',syncActivityState);

  // ── Resource busy marker ──────────────────────────────────────────
  function mxMarkBusy(alias,busy){
    var cards=document.querySelectorAll('.dres-card[data-alias]');
    for(var ci=0;ci<cards.length;ci++){
      if(cards[ci].getAttribute('data-alias')===alias){
        if(busy)cards[ci].classList.add('busy');
        else cards[ci].classList.remove('busy');
      }
    }
  }

  // ── Matrix Mode Engine ────────────────────────────────────────────
  var MX={on:false,buf:[],maxBuf:5000,timer:null,cols:new Set(),maxCols:30};
  MX.overlay=document.getElementById('matrix-overlay');
  MX.cvs=document.getElementById('matrix-canvas');
  MX.closeEl=document.getElementById('mx-close');

  function mxFeedText(t){
    if(!t||typeof t!=='string')return;
    for(var i=0;i<t.length;i++){
      var c=t.charAt(i);
      if(c==='\\n'||c==='\\r'||c==='\\t')continue;
      if(c===' '&&Math.random()>0.35)continue;
      MX.buf.push(c);
    }
    if(MX.buf.length>MX.maxBuf)MX.buf.splice(0,MX.buf.length-MX.maxBuf);
  }

  function mxPull(n){
    var out=[],pool='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=<>{}[]|;:.,~^()/_-';
    for(var i=0;i<n;i++){
      if(MX.buf.length>30){
        var idx=Math.floor(Math.random()*MX.buf.length);
        out.push(MX.buf.splice(idx,1)[0]);
      } else {
        out.push(pool.charAt(Math.floor(Math.random()*pool.length)));
      }
    }
    return out;
  }

  function mxSpawn(){
    if(!MX.on||MX.cols.size>=MX.maxCols)return;
    var depth=Math.floor(Math.random()*7);
    // Varied segment lengths: 3-35 chars for a more organic, less uniform look
    var count=Math.floor(3+Math.random()*32);
    var x=Math.random()*92+4;
    // Per-column speed variation: faster overall with gravity-like curve
    // Base duration shorter than before (6-9s), plus depth offset and random jitter
    var dur=6-depth*0.4+Math.random()*3;
    // Random easing variation: some columns accelerate more aggressively
    var easings=['cubic-bezier(0.12,0,0.39,0)','cubic-bezier(0.22,0,0.36,0)','cubic-bezier(0.08,0,0.50,0)','cubic-bezier(0.33,0,0.25,0)'];
    var easing=easings[Math.floor(Math.random()*easings.length)];
    var chars=mxPull(count);
    var col=document.createElement('div');
    col.className='mx-col';
    col.setAttribute('data-depth',String(depth));
    col.style.left=x+'%';
    col.style.setProperty('--mx-dur',dur.toFixed(1)+'s');
    col.style.setProperty('--mx-height',(count*1.2)+'em');
    col.style.setProperty('--mx-ease',easing);
    for(var i=0;i<chars.length;i++){
      var sp=document.createElement('span');
      sp.className='mx-ch';
      sp.textContent=chars[i];
      col.appendChild(sp);
    }
    MX.cvs.appendChild(col);
    MX.cols.add(col);
    col.addEventListener('animationend',function(){
      if(col.parentNode)col.parentNode.removeChild(col);
      MX.cols.delete(col);
    });
  }

  // Spawn a group of nearby columns for a "panel" effect
  function mxSpawnGroup(){
    var groupSize=Math.floor(2+Math.random()*4); // 2-5 columns
    var baseX=Math.random()*80+5;
    for(var g=0;g<groupSize;g++){
      if(MX.cols.size>=MX.maxCols)break;
      var depth=Math.floor(Math.random()*7);
      var count=Math.floor(3+Math.random()*32);
      var x=baseX+g*(1.5+Math.random()*2); // each column slightly offset
      if(x>96)x=96;
      var dur=6-depth*0.4+Math.random()*3;
      var easings=['cubic-bezier(0.12,0,0.39,0)','cubic-bezier(0.22,0,0.36,0)','cubic-bezier(0.08,0,0.50,0)'];
      var easing=easings[Math.floor(Math.random()*easings.length)];
      var chars=mxPull(count);
      var col=document.createElement('div');
      col.className='mx-col';
      col.setAttribute('data-depth',String(depth));
      col.style.left=x+'%';
      col.style.setProperty('--mx-dur',dur.toFixed(1)+'s');
      col.style.setProperty('--mx-height',(count*1.2)+'em');
      col.style.setProperty('--mx-ease',easing);
      // Stagger start within group for natural feel
      col.style.animationDelay=(g*0.08+Math.random()*0.15).toFixed(2)+'s';
      for(var ci=0;ci<chars.length;ci++){
        var sp=document.createElement('span');
        sp.className='mx-ch';
        sp.textContent=chars[ci];
        col.appendChild(sp);
      }
      MX.cvs.appendChild(col);
      MX.cols.add(col);
      col.addEventListener('animationend',function(){
        var c=this;if(c.parentNode)c.parentNode.removeChild(c);
        MX.cols.delete(c);
      });
    }
  }

  function mxStart(){
    if(MX.on)return;
    if(DAILY.on)dailyClose();
    MX.on=true;
    MX.overlay.classList.add('active');
    var vw=window.innerWidth;
    var rate=vw>=3840?60:vw>=1920?100:vw>=1200?140:200;
    MX.maxCols=vw>=3840?70:vw>=1920?55:vw>=1200?40:26;
    var burst=Math.floor(MX.maxCols*0.55);
    for(var i=0;i<burst;i++)setTimeout(mxSpawn,i*30);
    // Mix individual spawns with group spawns for chunked panel effect
    MX.timer=setInterval(function(){
      if(Math.random()<0.3){mxSpawnGroup();}else{mxSpawn();}
    },rate);
  }

  function mxStop(){
    MX.on=false;
    MX.overlay.classList.remove('active');
    if(MX.timer){clearInterval(MX.timer);MX.timer=null;}
    MX.cols.forEach(function(c){if(c.parentNode)c.parentNode.removeChild(c);});
    MX.cols.clear();
  }

  function mxProcessEvent(msg){
    if(!msg)return;
    if(msg.type==='state'){
      if(msg.orchestratorName)mxFeedText(msg.orchestratorName);
      var a=msg.auto||{};
      if(a.nextTask&&a.nextTask.content)mxFeedText(a.nextTask.content);
      if(a.lastCompleted&&a.lastCompleted.content)mxFeedText(a.lastCompleted.content);
      if(Array.isArray(msg.activeResources)){
        for(var ri=0;ri<msg.activeResources.length;ri++)mxFeedText(msg.activeResources[ri]);
      }
    }
    if(msg.type==='task-start'&&msg.taskContent)mxFeedText(msg.taskContent);
    if(msg.type==='task-complete'&&msg.taskContent)mxFeedText(msg.taskContent);
    if(msg.type==='queue-fill')mxFeedText('queue fill phase '+(msg.phase||''));
  }

  var mxBtn=document.getElementById('dmatrix-btn');
  if(mxBtn)mxBtn.addEventListener('click',mxStart);
  if(MX.closeEl)MX.closeEl.addEventListener('click',mxStop);

  // ── Daily Work Overlay ────────────────────────────────────────────
  var DAILY={on:false};
  DAILY.overlay=document.getElementById('daily-overlay');
  DAILY.closeEl=document.getElementById('daily-close');
  DAILY.bodyEl=document.getElementById('daily-body');
  DAILY.updatedEl=document.getElementById('daily-updated');
  DAILY.staleEl=document.getElementById('daily-stale-badge');

  function mdToHtml(md){
    if(!md)return'';
    var h=esc(md);
    // headings
    h=h.replace(/^### (.+)$/gm,'<h3>$1</h3>');
    h=h.replace(/^## (.+)$/gm,'<h2>$1</h2>');
    h=h.replace(/^# (.+)$/gm,'<h1>$1</h1>');
    // bold
    h=h.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
    // inline code
    h=h.replace(/\\x60([^\\x60]+)\\x60/g,'<code>$1</code>');
    // unordered list items
    h=h.replace(/^- (.+)$/gm,'<li>$1</li>');
    // wrap consecutive <li> in <ul>
    h=h.replace(/((?:<li>.*<\\/li>\\n?)+)/g,'<ul>$1</ul>');
    // links
    h=h.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    // paragraphs — double newlines
    h=h.replace(/\\n{2,}/g,'</p><p>');
    // single newlines to <br>
    h=h.replace(/\\n/g,'<br>');
    return'<p>'+h+'</p>';
  }

  function dailyFetch(){
    fetch('/api/daily-work')
      .then(function(r){return r.json()})
      .then(function(d){
        if(!d||!d.available){
          DAILY.bodyEl.innerHTML='<div class="daily-empty"><div class="daily-empty-icon">&#x1F4CB;</div>No daily work document yet.<br>Enter auto mode to generate one.</div>';
          DAILY.updatedEl.textContent='';
          DAILY.staleEl.style.display='none';
          return;
        }
        // Detect if content is guidance/template rather than real generated data.
        // The guidance template contains instructional language, not actual briefing content.
        var c=d.content||'';
        var isGuidance=c.indexOf('Generate a comprehensive Daily Work markdown document')!==-1
          ||c.indexOf('Output ONLY the markdown document')!==-1
          ||c.indexOf('This is a high-priority system task')!==-1;
        if(isGuidance){
          DAILY.bodyEl.innerHTML='<div class="daily-empty"><div class="daily-empty-icon">&#x1F4CB;</div>Daily briefing document is pending generation.<br>The system will produce it during the next auto cycle.</div>';
          DAILY.updatedEl.textContent='';
          DAILY.staleEl.style.display='none';
          return;
        }
        DAILY.bodyEl.innerHTML=mdToHtml(c);
        if(d.updatedAt){
          var dt=new Date(d.updatedAt);
          DAILY.updatedEl.textContent='Updated '+dt.toLocaleString();
        }
        DAILY.staleEl.style.display=d.stale?'inline-block':'none';
      })
      .catch(function(){
        DAILY.bodyEl.innerHTML='<div class="daily-empty"><div class="daily-empty-icon">&#x26A0;</div>Failed to load daily work document.</div>';
      });
  }

  function dailyOpen(){
    if(DAILY.on)return;
    if(MX.on)mxStop();
    DAILY.on=true;
    DAILY.overlay.classList.add('active');
    dailyFetch();
  }

  function dailyClose(){
    DAILY.on=false;
    DAILY.overlay.classList.remove('active');
  }

  var dailyBtn=document.getElementById('ddaily-btn');
  if(dailyBtn)dailyBtn.addEventListener('click',dailyOpen);
  if(DAILY.closeEl)DAILY.closeEl.addEventListener('click',dailyClose);

  // Close Daily overlay on backdrop click (click on overlay outside content)
  if(DAILY.overlay){
    DAILY.overlay.addEventListener('click',function(e){
      if(e.target===DAILY.overlay)dailyClose();
    });
  }

  // Escape key closes active overlays (Daily first, then Matrix)
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      if(DAILY.on){dailyClose();return;}
      if(MX.on){mxStop();return;}
    }
  });

  updateActivityControls();
  syncActivityState();
</script>
</body>
</html>`;
}
