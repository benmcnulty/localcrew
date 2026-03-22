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
                <div class="stat-value" id="stat-resources">0</div>
                <div class="stat-label">Resources</div>
              </div>
              <div class="stat-tile">
                <div class="stat-value" id="stat-mode">standby</div>
                <div class="stat-label">Mode</div>
              </div>
              <div class="stat-tile">
                <div class="stat-value" id="stat-prompt">ready</div>
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
              <div class="card-title">API Authentication</div>
              <p class="section-note">Store a Local Crew API token in this browser session for protected admin actions. This token is never read from the URL.</p>
              <form id="api-token-form">
                <div class="field-group">
                  <label class="field-label">Session API token</label>
                  <input id="api-token-input" name="apiToken" type="password" autocomplete="off" placeholder="Paste LOCALCREW_API_TOKEN">
                </div>
                <div class="command-buttons" style="margin-top:8px">
                  <button type="submit">Save Token</button>
                  <button type="button" id="api-token-clear" class="btn-ghost">Clear Token</button>
                </div>
              </form>
            </div>
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
  background:
    radial-gradient(circle at top left, rgba(0, 212, 255, 0.12), transparent 34%),
    radial-gradient(circle at 86% 12%, rgba(180, 79, 255, 0.12), transparent 24%),
    linear-gradient(180deg, #091018 0%, #0b0f16 48%, #070a10 100%);
  color: #e8eaf0;
  font-family: "SF Pro Display", "Segoe UI Variable", "Avenir Next", "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

#app {
  position: relative;
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
  height: 56px;
  padding: 0 24px;
  background: rgba(6, 10, 16, 0.78);
  border-bottom: 1px solid rgba(95, 106, 140, 0.24);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(18px);
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
  font-weight: 900;
  letter-spacing: -0.02em;
  background: linear-gradient(120deg, #00d4ff 0%, #00ff7f 52%, #b44fff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 6px rgba(0,212,255,0.3));
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.topbar-name {
  font-size: 13px;
  color: #d8deea;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-status {
  font-size: 12px;
  color: #94a0b8;
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
  background: linear-gradient(180deg, rgba(9, 13, 21, 0.58), rgba(7, 10, 16, 0.92));
}

/* ── Sidebar ── */

#sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: linear-gradient(180deg, rgba(10, 14, 22, 0.94), rgba(10, 14, 20, 0.82));
  border-right: 1px solid rgba(95, 106, 140, 0.18);
  padding: 16px 10px 20px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  cursor: pointer;
  color: #8e98ad;
  border: 1px solid transparent;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 500;
  transition: color 0.12s, background 0.12s, border-color 0.12s, transform 0.12s;
  user-select: none;
}

.nav-item:hover {
  color: #d5dcec;
  background: rgba(22, 28, 40, 0.7);
  border-color: rgba(95, 106, 140, 0.2);
}

.nav-item.active {
  color: #eaf4ff;
  background: linear-gradient(135deg, rgba(30, 44, 66, 0.92), rgba(25, 39, 58, 0.74));
  border-color: rgba(79, 142, 247, 0.32);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 24px rgba(2, 8, 18, 0.26);
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
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

#content > section {
  width: min(1280px, 100%);
  align-self: center;
}

section[hidden] {
  display: none;
}

/* ── Cards ── */

.card {
  background: linear-gradient(180deg, rgba(18, 24, 35, 0.88), rgba(12, 18, 28, 0.8));
  border: 1px solid rgba(95, 106, 140, 0.22);
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 22px 50px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.03);
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
  background: linear-gradient(180deg, rgba(18, 24, 35, 0.88), rgba(12, 18, 28, 0.8));
  border: 1px solid rgba(95, 106, 140, 0.22);
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03);
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
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  transition: opacity 0.12s, transform 0.12s, box-shadow 0.12s;
}

button:hover {
  opacity: 0.85;
}

button[type="submit"] {
  background: linear-gradient(135deg, #67b2ff 0%, #4f8ef7 55%, #6b9dff 100%);
  color: #fff;
  box-shadow: 0 12px 24px rgba(79, 142, 247, 0.24);
}

.btn-ghost {
  background: rgba(28, 35, 48, 0.72);
  color: #d1d9e8;
  border: 1px solid rgba(95, 106, 140, 0.22);
}

.btn-ghost:hover {
  background: rgba(37, 44, 64, 0.92);
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
  background: rgba(10, 14, 22, 0.86);
  border: 1px solid rgba(95, 106, 140, 0.22);
  border-radius: 12px;
  color: #e8eaf0;
  padding: 9px 12px;
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
  background: rgba(8, 11, 18, 0.96);
  border: 1px solid rgba(57, 66, 92, 0.42);
  border-radius: 12px;
  padding: 12px 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  min-height: 88px;
  max-height: 420px;
  overflow-y: auto;
  margin: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
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
.badge-live { background: #163d29; color: #4caf7d; box-shadow: 0 0 0 1px rgba(76, 175, 125, 0.18), 0 8px 18px rgba(22, 61, 41, 0.22); }
.badge-dim  { background: rgba(30, 33, 48, 0.82); color: #8e98ad; }

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
  html { font-size: 18px; }

  #sidebar {
    width: 300px;
  }

  #topbar {
    height: 64px;
    padding: 0 32px;
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

@media (min-width: 3840px) {
  html { font-size: 24px; }
}

@media (max-width: 767px) {
  #layout { flex-direction: column; }

  #sidebar {
    display: flex;
    flex-direction: row;
    height: auto;
    width: 100%;
    border-right: none;
    border-top: 1px solid #2a2d3e;
    order: 2;
    overflow-x: auto;
    padding: 0;
  }

  .nav-item {
    flex-direction: column;
    padding: 8px 12px;
    font-size: 11px;
    min-width: 60px;
    border-left: none;
    border-top: 2px solid transparent;
    text-align: center;
  }

  .nav-item.active {
    border-left-color: transparent;
    border-top-color: #4f8ef7;
  }

  #content { order: 1; }
}

@media (max-width: 1024px) {
  .nav-item { min-height: 44px; }
  button, .btn { min-height: 44px; min-width: 44px; }
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
  guideHelpRefresh: document.getElementById("guide-help-refresh"),
  apiTokenForm: document.getElementById("api-token-form"),
  apiTokenInput: document.getElementById("api-token-input"),
  apiTokenClear: document.getElementById("api-token-clear")
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
  const storedToken = window.sessionStorage.getItem("localCrewApiToken") || "";
  state.apiToken = storedToken;
  if (els.apiTokenInput) {
    els.apiTokenInput.value = storedToken;
  }
}

function setConnectionState(dotClass, statusText, detailText) {
  if (els.topbarDot) {
    els.topbarDot.className = "dot " + dotClass;
  }
  if (els.topbarStatusText) {
    els.topbarStatusText.textContent = statusText;
  }
  if (els.connectionLine) {
    els.connectionLine.textContent = detailText || "";
  }
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
        ? "One resource configured. Run npm run setup:agent on agent devices to add more."
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

function formatExploreFileOutput(file) {
  const lines = [
    file.path,
    "relative: " + file.relativePath,
    "updated: " + file.modifiedAt,
    "size: " + file.size + " bytes"
  ];

  if (file.outline && Array.isArray(file.outline.headings) && file.outline.headings.length > 0) {
    lines.push("");
    lines.push("Heading references:");
    file.outline.headings.forEach((heading) => {
      const trail = Array.isArray(heading.trail) ? heading.trail.join(" > ") : heading.text;
      lines.push("- HEADING: " + trail + " (line " + heading.line + ")");
    });
  }

  lines.push("");
  lines.push("----- CONTENT -----");
  lines.push("");
  lines.push(file.content);
  return lines.join("\\n");
}

async function refreshView() {
  let status;
  let chatConfig;
  let dropbox;
  let resources;
  try {
    [status, chatConfig, dropbox, resources] = await Promise.all([
      getJson("/api/status"),
      getJson("/api/chat-config"),
      getJson("/api/dropbox"),
      getJson("/api/resources")
    ]);
  } catch (error) {
    const message = String(error);
    const authHint = message.includes("Unauthorized")
      ? "API token required for protected controls."
      : message.includes("Local Crew only serves local-network clients")
        ? "This UI is available only from the local network by default."
        : message;
    setConnectionState("dot-red", "connection failed", authHint);
    throw error;
  }

  // Topbar
  if (els.topbarOrchestrator) els.topbarOrchestrator.textContent = chatConfig.orchestratorName || "";
  setConnectionState("dot-green", "connected", "Prompt: " + (status.prompt || ""));

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
        "Explorer navigation:",
        "  sitemap: " + tree.sitemapPath,
        "  outline index: " + tree.outlineIndexPath,
        "",
        "Dropbox:",
        "  inbox:  " + dropbox.inbox.length,
        "  active: " + dropbox.active.length,
        "  outbox: " + dropbox.outbox.length,
        "",
        "Open the sitemap first when you need the compact document map.",
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

// API token form
els.apiTokenForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = els.apiTokenInput.value.trim();
  state.apiToken = token;
  if (token) {
    window.sessionStorage.setItem("localCrewApiToken", token);
  } else {
    window.sessionStorage.removeItem("localCrewApiToken");
  }
  if (els.resultOutput) {
    els.resultOutput.textContent = token
      ? "Stored API token for this browser session."
      : "Cleared API token for this browser session.";
  }
  try { await refreshView(); } catch (error) {
    if (els.resultOutput) els.resultOutput.textContent = String(error);
  }
});

els.apiTokenClear.addEventListener("click", async () => {
  state.apiToken = "";
  if (els.apiTokenInput) {
    els.apiTokenInput.value = "";
  }
  window.sessionStorage.removeItem("localCrewApiToken");
  if (els.resultOutput) {
    els.resultOutput.textContent = "Cleared API token for this browser session.";
  }
  try { await refreshView(); } catch (error) {
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
    if (els.fileOutput) els.fileOutput.textContent = formatExploreFileOutput(file);
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
  setConnectionState("dot-blue", "connecting", "Loading Local Crew state...");
  await refreshView();
  state.refreshTimer = window.setInterval(() => {
    refreshView().catch((error) => {
      if (els.resultOutput) els.resultOutput.textContent = String(error);
    });
  }, 1500);
}

start().catch((error) => {
  if (els.resultOutput) els.resultOutput.textContent = String(error);
  setConnectionState("dot-red", "connection failed", String(error));
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
      --fs-task:   0.82rem;
    }
    @media (max-width: 374px) {
      :root {
        --topbar-h:42px;--logbar-h:30px;--gap:5px;--pad:8px;--radius:4px;
        --fs-xs:0.56rem;--fs-sm:0.66rem;--fs-base:0.76rem;--fs-md:0.86rem;
        --fs-xl:1.4rem;--fs-metric:1.7rem;--fs-task:0.72rem;
      }
    }
    @media (min-width: 375px) and (max-width: 767px) {
      :root {
        --topbar-h:46px;--logbar-h:33px;--gap:7px;--pad:10px;--radius:5px;
        --fs-xs:0.60rem;--fs-sm:0.70rem;--fs-base:0.80rem;--fs-md:0.92rem;
        --fs-xl:1.6rem;--fs-metric:2.0rem;--fs-task:0.78rem;
      }
    }
    @media (min-width: 768px) {
      :root {
        --topbar-h:56px;--logbar-h:40px;--gap:12px;--pad:16px;
        --fs-sm:0.78rem;--fs-base:0.88rem;--fs-md:1.05rem;
        --fs-xl:2.1rem;--fs-metric:3rem;--fs-task:0.88rem;
      }
    }
    @media (min-width: 1024px) and (max-width: 1199px) {
      #dpnet { flex: 0 0 clamp(180px,22vw,220px); }
      #dpmet { flex: 0 0 clamp(200px,22vw,260px); }
    }
    @media (min-width: 1200px) {
      :root {
        --topbar-h:60px;--logbar-h:42px;--gap:16px;--pad:20px;
        --fs-xs:0.66rem;--fs-sm:0.8rem;--fs-base:0.9rem;--fs-md:1.05rem;
        --fs-lg:1.3rem;--fs-xl:2.3rem;--fs-metric:2.4rem;--fs-task:0.95rem;
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
        --fs-metric:clamp(2.8rem,3.2vw,5rem);
        --fs-task:clamp(1.2rem,1.4vw,2.2rem);
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
      font-family: "SF Pro Display", "Segoe UI Variable", "Avenir Next", "Segoe UI", sans-serif;
      font-size: var(--fs-base);
      -webkit-font-smoothing: antialiased;
    }
    /* Scanline overlay */
    body::after {
      content: '';
      position: fixed; inset: 0;
      background: repeating-linear-gradient(
        0deg, transparent, transparent 3px,
        rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px
      );
      pointer-events: none;
      z-index: 50;
    }
  els.statPrompt.textContent = p.length > 18 ? p.slice(0, 16) + "…" : p || "ready";

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
      display: flex; align-items: center; gap: 0.34em;
      font-size: var(--fs-lg); font-weight: 900;
      letter-spacing: -0.01em; white-space: nowrap; flex-shrink: 0;
    }
    .dlogo-mark {
      width: 0.88em; height: 0.88em; flex-shrink: 0;
      color: var(--n-blue);
      filter: drop-shadow(0 0 10px rgba(0,212,255,0.45)) drop-shadow(0 0 18px rgba(0,255,127,0.15));
    }
    .dlogo-mark svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .dlogo-text {
      background: linear-gradient(120deg, var(--n-blue) 0%, var(--n-green) 52%, var(--n-purple) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      filter: drop-shadow(0 0 10px rgba(0,212,255,0.4)) drop-shadow(0 0 22px rgba(0,255,127,0.18));
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
    .doverlay-btn {
      border: 1px solid rgba(0,212,255,0.2);
      background: rgba(0,212,255,0.05);
      color: rgba(0,212,255,0.55);
      border-radius: 4px;
      padding: 0.22em 0.6em;
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .doverlay-btn:hover {
      background: rgba(0,212,255,0.12);
      color: var(--n-blue);
    }
    .dtop-sep {
      width: 1px; height: 1.4em;
      background: rgba(0,212,255,0.15);
      margin: 0 0.2em;
      flex-shrink: 0;
    }
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
      will-change: opacity, box-shadow;
    }
    @keyframes dotPulse {
      0%,100% { box-shadow: 0 0 4px currentColor, 0 0 8px currentColor; }
      50% { box-shadow: 0 0 8px currentColor, 0 0 24px currentColor, 0 0 48px currentColor; }
    }
    .ddot-green { background: #00ff7f; color: #00ff7f; }
    .ddot-amber { background: var(--n-amber); color: var(--n-amber); animation: dotPulse 1.2s ease-in-out infinite; }
    .ddot-pink  { background: var(--n-pink); color: var(--n-pink); animation: dotPulse 1.8s ease-in-out infinite; }
    .ddot-blue  { background: var(--n-blue); color: var(--n-blue); animation: dotPulse 2s ease-in-out infinite; }
    .ddot-red   { background: #ff3333; color: #ff3333; }
    @keyframes busyPulse { 0%,100%{opacity:1;} 50%{opacity:0.2;} }
    .dpulse { animation: busyPulse 1.2s ease-in-out infinite; }

    /* ── Status banner ─────────────────────────────────────────────────── */
    #dstatus-banner {
      display: flex; align-items: center; gap: 0.6em; flex-wrap: nowrap;
      padding: 0.35em var(--pad); height: 28px; flex-shrink: 0;
      background: rgba(0,0,0,0.35);
      border-bottom: 1px solid rgba(0,212,255,0.08);
      font-family: "SF Mono",ui-monospace,monospace;
      font-size: var(--fs-xs); color: var(--muted2);
      overflow: hidden; white-space: nowrap;
    }
    #dstatus-banner > span { flex-shrink: 0; }
    #dstatus-banner > span:last-child { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .dstatus-chip {
      font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
      padding: 0.15em 0.5em; border-radius: 3px;
    }
    .dstatus-active    { background: rgba(0,255,127,0.12); color: #00ff7f; border: 1px solid rgba(0,255,127,0.3); }
    .dstatus-idle      { background: rgba(90,90,90,0.15);  color: var(--muted2); border: 1px solid rgba(90,90,90,0.3); }
    .dstatus-degraded  { background: rgba(255,204,0,0.12); color: var(--n-amber); border: 1px solid rgba(255,204,0,0.3); }
    .dstatus-blocked   { background: rgba(255,45,120,0.12); color: #ff2d78; border: 1px solid rgba(255,45,120,0.3); }
    .dstatus-recovering { background: rgba(0,212,255,0.12); color: var(--n-blue); border: 1px solid rgba(0,212,255,0.3); }
    .dstatus-dim { opacity: 0.5; }
    .dstatus-sep { opacity: 0.2; }

    /* ── KPI group (right panel) ───────────────────────────────────────── */
    .dkpi-group {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px; flex-shrink: 0;
    }
    @media (min-width: 1920px) { .dkpi-group { gap: 6px; } }
    .dkpi {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 0.35em 0.3em; border-radius: 4px;
      background: rgba(255,45,120,0.04);
      border: 1px solid rgba(255,45,120,0.12);
      gap: 0.15em; min-width: 0;
    }
    .dkpi-val {
      font-size: var(--fs-md); font-weight: 800; font-variant-numeric: tabular-nums;
      font-family: "SF Mono",ui-monospace,monospace;
      color: rgba(255,45,120,0.85); line-height: 1;
    }
    .dkpi-lbl {
      font-size: clamp(0.45rem, var(--fs-xs), 0.7rem); text-transform: uppercase;
      letter-spacing: 0.06em; opacity: 0.4; text-align: center; line-height: 1.1;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
    }

    /* ── Task primary card accent ──────────────────────────────────────── */
    .dtask-primary {
      border-left-color: var(--n-amber);
      background: rgba(255,204,0,0.04);
    }
    .dtask-primary .dtask-label { color: rgba(255,204,0,0.6); }
    .dtask-meta-row {
      margin-top: 0.3em; display: flex; align-items: center; gap: 0.4em; flex-wrap: wrap;
      font-size: var(--fs-xs);
    }

    /* ── Flash on value update ────────────────────────────────────────────── */
    @keyframes valFlash {
      0%   { opacity: 1; }
      15%  { opacity: 0.1; filter: brightness(3) saturate(2); }
      100% { opacity: 1; }
    }
    .flash { animation: valFlash 0.6s ease forwards; }

    /* ── Body layout ──────────────────────────────────────────────────────── */
    #dbody {
      display: flex; flex: 1; overflow: hidden; min-height: 0;
      gap: var(--gap); padding: var(--gap); padding-bottom: 0;
    }
    #dbody > * { min-width: 0; }
    @media (max-width: 767px) { #dbody { flex-direction: column; overflow-y: auto; } }
    @media (min-width: 768px) and (max-width: 1199px) {
      #dbody { flex-direction: row; flex-wrap: wrap; align-content: flex-start; }
      #dpnet  { flex: 0 0 min(320px, calc(42% - var(--gap) / 2)); }
      #dpmain { flex: 1; min-width: 0; }
      #dpmet  { flex: 0 0 100%; flex-direction: row; gap: var(--gap); min-width: 0; }
    }
    @media (min-width: 1200px) {
      #dpnet  { flex: 0 0 clamp(220px, 18vw, 280px); }
      #dpmain { flex: 1; min-width: 0; }
      #dpmet  { flex: 0 0 clamp(260px, 22vw, 380px); max-width: clamp(260px, 22vw, 380px); min-width: 0; }
    }
    @media (min-width: 1920px) { #dpnet { flex: 0 0 clamp(260px, 16vw, 340px); } #dpmet { flex: 0 0 clamp(300px, 18vw, 440px); max-width: clamp(300px, 18vw, 440px); } .dpanel { flex: 1 1 0; min-height: 0; } .dpmain-queue { flex: 1; } }
    @media (min-width: 3840px) { #dpnet { flex: 0 0 500px; } #dpmet { flex: 0 0 540px; max-width: 540px; } }
    @media (min-width: 5120px) { #dpnet { flex: 0 0 640px; } #dpmet { flex: 0 0 700px; max-width: 700px; } }

    /* ── Panel base ───────────────────────────────────────────────────────── */
    .dpanel {
      display: flex; flex-direction: column;
      background: var(--surface);
      border: 1px solid rgba(0,212,255,0.15);
      border-radius: var(--radius);
      padding: var(--pad); overflow: hidden; gap: var(--gap); flex-shrink: 0;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5),
                  inset 0 1px 0 rgba(255,255,255,0.04),
                  inset 0 -1px 0 rgba(0,0,0,0.3);
    }
    @media (min-width: 1200px) { .dpanel { flex-shrink: 1; } }

    /* Per-panel neon border + glow */
    #dpnet  { border-color: rgba(0,255,127,0.3);  box-shadow: 0 0 28px rgba(0,255,127,0.05),  inset 0 0 40px rgba(0,255,127,0.02);  }
    #dpmain { border-color: rgba(0,212,255,0.3);  box-shadow: 0 0 28px rgba(0,212,255,0.06),  inset 0 0 40px rgba(0,212,255,0.02);  }
    #dpmet  { border-color: rgba(255,45,120,0.3); box-shadow: 0 0 28px rgba(255,45,120,0.05), inset 0 0 40px rgba(255,45,120,0.02); }

    .dpanel-title {
      font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.12em; color: var(--muted2); flex-shrink: 0;
      display: flex; align-items: center; gap: 0.4em;
    }
    .dpanel-title svg {
      flex-shrink: 0;
      width: 1.22em;
      height: 1.22em;
      overflow: visible;
    }
    .dpanel-title .dmini-inline {
      margin-left: auto; display: flex; flex-direction: column; gap: 4px; align-items: flex-end;
    }
    .dmini-inline .dmini-pill {
      display: flex; align-items: center; gap: 0.25em;
      background: rgba(0,255,127,0.06); border: 1px solid rgba(0,255,127,0.18);
      border-radius: 3px; padding: 0.1em 0.4em;
      font-size: clamp(0.5rem, 0.55rem, 0.65rem); font-weight: 800;
      color: #00ff7f; font-variant-numeric: tabular-nums;
    }
    .dmini-pill-lbl { color: rgba(0,255,127,0.45); font-weight: 600; }
    #dpnet  .dpanel-title { color: rgba(0,255,127,0.5); }
    #dpmain .dpanel-title { color: rgba(0,212,255,0.5); }
    #dpmet  .dpanel-title { color: rgba(255,45,120,0.5); }
    .dsub {
      font-size: var(--fs-xs); text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted2); font-weight: 700;
    }

    /* ── Network panel ────────────────────────────────────────────────────── */
    #dres-grid {
      display: flex; flex-direction: column; gap: 3px;
      overflow-y: auto; flex: 1; min-height: 0;
    }
    .dres-card {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.2em 0.4em;
      padding: 0.3em 0.5em;
      background: rgba(0,255,127,0.04);
      border: 1px solid rgba(0,255,127,0.15);
      border-radius: 4px; flex-shrink: 0;
    }
    .dres-name {
      font-size: var(--fs-xs); font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;
    }
    @media (min-width: 1920px) {
      .dres-name { white-space: normal; word-break: break-word; -webkit-line-clamp: 2;
        display: -webkit-box; -webkit-box-orient: vertical; }
    }
    .dres-meta {
      display: flex; align-items: center; gap: 0.4em;
      width: 100%; padding-left: 0.9em;
    }
    .dtier {
      font-size: clamp(0.5rem, 0.55rem, 0.6rem); font-weight: 800; padding: 0.05em 0.4em;
      border-radius: 3px; text-transform: uppercase; letter-spacing: 0.06em; flex-shrink: 0;
    }
    .drole-captain { background: rgba(0,255,127,0.12); color: #00ff7f; border: 1px solid rgba(0,255,127,0.3); }
    .drole-mate { background: rgba(255,204,0,0.10); color: var(--n-amber); border: 1px solid rgba(255,204,0,0.3); }
    .drole-crew { background: rgba(90,90,90,0.12);  color: var(--muted2);  border: 1px solid rgba(90,90,90,0.3); }

    .dres-status {
      font-size: var(--fs-xs); letter-spacing: 0.07em; opacity: 0.5;
      text-transform: uppercase; flex-shrink: 0;
    }
    .dres-card[data-busy="1"] .dres-status { opacity: 0.9; color: var(--n-amber); }
    .dres-card[data-status="offline"] {
      background: rgba(255,60,80,0.06);
      border-color: rgba(255,60,80,0.25);
    }
    .dres-card[data-status="offline"] .dres-name { opacity: 0.5; }
    .dres-handle {
      font-size: var(--fs-xs); color: rgba(0,212,255,0.5); font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* Colorblind-friendly status shapes — purely visual, no leaked text */
    .ddot-green { border-radius: 50%; }
    .ddot-amber { border-radius: 2px; clip-path: polygon(50% 0%, 100% 100%, 0% 100%); }
    .ddot-red   { border-radius: 2px; }

    /* Busy device pulse animation */
    @keyframes device-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50%       { transform: scale(1.3); opacity: 0.6; }
    }
    .ddot-busy { animation: device-pulse 1.8s ease-in-out infinite; }

    /* ── Main panel ───────────────────────────────────────────────────────── */
    #dactive-tasks {
      display: flex; flex-direction: column; gap: 6px;
      flex-shrink: 0;
    }
    .dtask-card {
      background: rgba(0,212,255,0.04);
      border: 1px solid rgba(0,212,255,0.14);
      border-left: 3px solid rgba(0,212,255,0.5);
      box-shadow: inset 0 2px 6px rgba(0,0,0,0.4),
                  inset 0 -1px 2px rgba(255,255,255,0.04);
      border-radius: 0 var(--radius) var(--radius) 0;
      padding: 0.75em 1em;
      flex-shrink: 0;
    }
    .dtask-label {
      font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.1em; color: rgba(0,212,255,0.45);
      margin-bottom: 0.45em; display: flex; align-items: center; gap: 0.5em;
    }
    #dtask, .dtask-content {
      font-size: var(--fs-task); font-weight: 600; line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
      overflow: hidden; transition: color 0.5s;
    }
    @media (min-width: 1920px) { #dtask, .dtask-content { -webkit-line-clamp: 5; } }

    #dtask-meta {
      margin-top: 0.4em; display: flex; align-items: center; gap: 0.4em; flex-wrap: wrap;
    }
    .dtask-res {
      font-size: var(--fs-xs); font-family: "SF Mono",ui-monospace,monospace;
      font-weight: 700; color: rgba(0,212,255,0.6);
      background: rgba(0,212,255,0.08); border: 1px solid rgba(0,212,255,0.2);
      border-radius: 3px; padding: 0.1em 0.4em;
    }
    .dtask-pri {
      font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.06em; border-radius: 3px; padding: 0.1em 0.4em;
    }
    .dtask-pri-high   { background: rgba(255,45,120,0.12); color: #ff2d78; border: 1px solid rgba(255,45,120,0.3); }
    .dtask-pri-medium { background: rgba(255,204,0,0.10);  color: var(--n-amber); border: 1px solid rgba(255,204,0,0.25); }
    .dtask-pri-low    { background: rgba(90,90,90,0.12);   color: var(--muted2);  border: 1px solid rgba(90,90,90,0.25); }
    .dqres {
      margin-left: auto; flex-shrink: 0;
      font-size: var(--fs-xs); font-family: "SF Mono",ui-monospace,monospace;
      font-weight: 600; color: rgba(0,212,255,0.45);
      background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.15);
      border-radius: 3px; padding: 0.1em 0.35em;
    }

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
      animation: shimmer 3s ease-in-out infinite;
      box-shadow: 0 0 10px rgba(0,212,255,0.6), 0 0 24px rgba(0,255,127,0.3);
      transition: width 0.8s ease;
      will-change: width, background-position;
    }
    /* ── Center panel layout: focus row (tasks + gauge) → queue below ──── */
    .dfocus-row {
      display: flex; gap: var(--gap); flex-shrink: 0;
      contain: layout style;
    }
    .dfocus-row #dactive-tasks { flex: 1; min-width: 0; }
    .dpmain-queue {
      flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; overflow: hidden;
      contain: layout style;
    }
    .dpmain-gauge {
      flex: 0 0 clamp(130px, 36%, 240px); min-width: 0;
      display: flex; flex-direction: column; gap: 4px;
      border-left: 1px solid rgba(0,212,255,0.1);
      padding-left: var(--gap);
      justify-content: center;
      min-height: clamp(180px, 20vh, 260px);
    }
    #dqlist {
      display: flex; flex-direction: column; gap: 5px;
      flex: 1; overflow-y: auto; min-height: 0;
    }
    .dqitem {
      display: flex; align-items: flex-start; gap: 0.6em;
      padding: 0.45em 0.65em;
      background: rgba(0,212,255,0.035);
      border: 1px solid rgba(0,212,255,0.1);
      border-left: 2px solid rgba(0,212,255,0.35);
      border-radius: 0 4px 4px 0;
      font-size: var(--fs-sm); color: rgba(224,232,248,0.65); line-height: 1.4;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
    }
    .dqitem-active {
      border-left: 2px solid var(--n-amber);
      padding-left: 8px;
      background: rgba(255,204,0,0.04);
      color: rgba(224,232,248,0.85);
    }
    .dqnum {
      font-family: "SF Mono",ui-monospace,monospace; font-size: var(--fs-xs); font-weight: 800;
      color: rgba(0,212,255,0.55); flex-shrink: 0;
      background: rgba(0,212,255,0.1); padding: 0.1em 0.35em;
      border-radius: 3px; min-width: 1.4em; text-align: center;
    }
    .dqtext { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

    /* Radial gauge — compact within right column of .dfocus-row */
    .dgauge-wrap {
      display: flex; flex-direction: column; gap: 4px;
      flex: 1; min-height: 100%; justify-content: center;
    }
    .dgauge-hdr { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; gap: 2px; }
    .dgauge-cur {
      font-size: var(--fs-xl); font-family: "SF Mono",ui-monospace,monospace; font-weight: 800;
      color: var(--n-blue); text-shadow: 0 0 10px var(--n-blue), 0 0 24px rgba(0,212,255,0.35);
      font-variant-numeric: tabular-nums; line-height: 1;
    }
    .dgauge-sublbl {
      font-size: var(--fs-xs); color: rgba(0,212,255,0.4); text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    #dtpmlbl { display: none; } /* value displayed via .dgauge-cur directly */
    .dgauge-container {
      flex: 0 0 auto;
      min-height: clamp(140px, 18vh, 220px);
      max-height: none;
      display: flex; align-items: center; justify-content: center;
      padding: 6px 0 0;
      overflow: visible;
    }
    #dgauge { width: 100%; height: 100%; display: block; }
    .dgauge-val-text {
      /* font-size intentionally omitted — set as SVG attribute so it scales
         with the viewBox coordinate system instead of staying fixed in CSS px. */
      font-weight: 800; fill: var(--n-blue);
      font-family: "SF Mono","Fira Code",ui-monospace,monospace;
      filter: drop-shadow(0 0 5px var(--n-blue));
    }
    .dgauge-lbl-text {
      font-size: 7px; fill: rgba(0,212,255,0.35); text-transform: uppercase;
      letter-spacing: 0.14em; font-family: system-ui,sans-serif;
    }

    /* ── Metrics panel — stacked stat cards ──────────────────────────────── */
    .dstat-group { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
    .dstat-row {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 0.55em 0.5em; border-radius: var(--radius);
      border-bottom: 3px solid; gap: 0.25em;
      overflow: hidden; flex: 1; min-width: 0;
    }
    .dstat-row-done   { border-bottom-color: #00ff7f;         background: rgba(0,255,127,0.06); }
    .dstat-row-events { border-bottom-color: var(--n-purple); background: rgba(180,79,255,0.04); }
    .dstat-row-tokens { border-bottom-color: var(--n-amber);  background: rgba(255,204,0,0.04); }
    .dstat-val {
      font-size: clamp(1rem, var(--fs-xl), 2.4rem); font-weight: 800; font-variant-numeric: tabular-nums;
      line-height: 1; letter-spacing: 0.02em; flex-shrink: 0;
    }
    .mv-done   { color: #00ff7f;         text-shadow: 0 0 8px #00ff7f,        0 0 20px rgba(0,255,127,0.35); }
    .mv-events { color: var(--n-purple); text-shadow: 0 0 8px var(--n-purple),0 0 20px rgba(180,79,255,0.35); }
    .mv-tokens { color: var(--n-amber);  text-shadow: 0 0 8px var(--n-amber), 0 0 20px rgba(255,204,0,0.35); }
    .dstat-lbl {
      font-size: clamp(0.55rem, var(--fs-xs), 0.85rem); text-transform: uppercase; letter-spacing: 0.08em;
      opacity: 0.45; text-align: center; line-height: 1.2; flex-shrink: 1; min-width: 0;
    }
    .dmodels { display: flex; flex-direction: column; gap: 6px; flex: 1; overflow-y: auto; min-height: 0; }
    .dmodel-row { display: flex; flex-direction: column; gap: 3px; }
    .dmodel-hdr { display: flex; justify-content: space-between; font-size: var(--fs-xs); color: var(--muted2); }
    .dmodel-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%; }
    .dbar-track { height: 4px; background: rgba(0,255,127,0.1); border-radius: 2px; overflow: hidden; }
    @media (min-width: 1920px) { .dbar-track { height: 7px; } }
    @media (min-width: 3840px) { .dbar-track { height: 12px; } }
    @media (min-width: 5120px) { .dbar-track { height: 16px; } }
    .dbar-fill {
      height: 100%; border-radius: inherit;
      background: linear-gradient(90deg, #00ff7f, var(--n-blue));
      box-shadow: 0 0 6px #00ff7f; opacity: 0.8;
      transition: width 1s ease;
      will-change: width;
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
    /* HD: show up to 5 items */
    @media (min-width: 1920px) {
      .dlog + .dlog { opacity: 0.55; }
      .dlog + .dlog + .dlog { opacity: 0.3; }
      .dlog + .dlog + .dlog + .dlog { display: flex; opacity: 0.15; }
      .dlog + .dlog + .dlog + .dlog + .dlog { display: flex; opacity: 0.07; }
      .dlog + .dlog + .dlog + .dlog + .dlog + .dlog { display: none; }
    }
    /* 4K: show up to 7 items */
    @media (min-width: 3840px) {
      .dlog + .dlog + .dlog + .dlog + .dlog + .dlog { display: flex; opacity: 0.05; }
      .dlog + .dlog + .dlog + .dlog + .dlog + .dlog + .dlog { display: flex; opacity: 0.03; }
    }
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
    ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.35); border-radius: 2px; transition: background 0.2s ease; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(0,212,255,0.55); }

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
    #matrix-canvas { position: absolute; inset: 0; z-index: 1; }
    #matrix-canvas canvas { display: block; width: 100%; height: 100%; }

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
      font-weight: 800;
      margin-top: 2em; margin-bottom: 0.5em;
      border-bottom: 1px solid rgba(255,191,0,0.12);
      padding-bottom: 0.3em;
    }
    .daily-body h1 { color: #ffcc00; font-size: 1.6rem; text-shadow: 0 0 10px rgba(255,204,0,0.35); }
    .daily-body h2 { color: #f0b800; font-size: 1.3rem; text-shadow: 0 0 8px rgba(255,191,0,0.25); }
    .daily-body h3 { color: #d4a000; font-size: 1.1rem; text-shadow: 0 0 6px rgba(212,160,0,0.2); }
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
    .daily-archive-nav {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin-bottom: 28px; padding-bottom: 20px;
      border-bottom: 1px solid rgba(255,191,0,0.1);
    }
    .daily-archive-btn {
      background: rgba(255,191,0,0.06); border: 1px solid rgba(255,191,0,0.15);
      color: rgba(255,191,0,0.55); border-radius: 4px;
      padding: 4px 12px; font-size: 0.78rem; cursor: pointer;
      font-family: inherit; letter-spacing: 0.03em;
      transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .daily-archive-btn:hover { background: rgba(255,191,0,0.12); border-color: rgba(255,191,0,0.3); color: #ffbf00; }
    .daily-archive-btn.active { background: rgba(255,191,0,0.16); border-color: rgba(255,191,0,0.4); color: #ffbf00; font-weight: 700; }
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
    <div class="dlogo"><span class="dlogo-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><polygon points="12,2 20,7 20,17 12,22 4,17 4,7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.9"/><line x1="20" y1="7" x2="4" y2="17" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.9"/><line x1="20" y1="17" x2="4" y2="7" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.9"/></svg></span><span class="dlogo-text">Local Crew</span></div>
    <div class="dtop-center">
      <span id="dorch"></span>
      <span id="dmode">syncing</span>
      <span id="dbusy" class="ddot" style="display:none"></span>
      <span class="dtop-sep"></span>
      <span id="dactivity" class="dactivity">Auto Pause</span>
      <button id="dactive-toggle" class="dactive-btn" type="button" aria-label="Toggle always-active display mode">Monitor Off</button>
    </div>
    <div class="dtop-right">
      <button id="dmatrix-btn" class="doverlay-btn" type="button">Matrix</button>
      <button id="ddaily-btn" class="doverlay-btn" type="button">Daily</button>
      <span id="dhealthdot" class="ddot"></span>
      <span id="dclock">--:--</span>
    </div>
  </header>

  <div id="dstatus-banner">
    <span id="dstatus-fleet" class="dstatus-dim">Awaiting crew snapshot</span>
    <span class="dstatus-sep">&middot;</span>
    <span id="dstatus-bp" class="dstatus-dim">BP: nominal</span>
    <span class="dstatus-sep">&middot;</span>
    <span id="dstatus-bottleneck" class="dstatus-dim">Bottleneck: none</span>
    <span class="dstatus-sep">&middot;</span>
    <span id="dstatus-dispatch" class="dstatus-dim">Dispatch: standby</span>
  </div>

  <div id="dbody">
    <section id="dpnet" class="dpanel">
      <h2 class="dpanel-title"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="8" r="2.2" fill="currentColor" opacity="0.9"/><circle cx="12" cy="8" r="2.2" fill="currentColor" opacity="0.9"/><line x1="6.2" y1="8" x2="9.8" y2="8" stroke="currentColor" stroke-width="1.2" opacity="0.7"/><circle cx="8" cy="3.5" r="2.2" fill="currentColor" opacity="0.9"/><line x1="5" y1="6" x2="7" y2="4.5" stroke="currentColor" stroke-width="1.2" opacity="0.7"/><line x1="11" y1="6" x2="9" y2="4.5" stroke="currentColor" stroke-width="1.2" opacity="0.7"/></svg>Fleet<span class="dmini-inline"><span class="dmini-pill"><span id="dbusy-count">0</span><span class="dmini-pill-lbl">active</span></span><span class="dmini-pill"><span id="drescnt">0</span><span class="dmini-pill-lbl">online</span></span></span></h2>
      <div id="dres-grid"></div>
      <div class="dmodels">
        <div class="dsub" style="flex-shrink:0;color:rgba(0,255,127,0.5)">Model Activity</div>
        <div id="dmodelbars" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;min-height:0"></div>
      </div>
    </section>

    <section id="dpmain" class="dpanel">
      <h2 class="dpanel-title"><svg width="1em" height="1em" viewBox="0 0 16 16" style="vertical-align:-0.15em;margin-right:0.35em"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.5"/><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.7"/><circle cx="8" cy="8" r="1" fill="currentColor"/></svg>Current Focus</h2>
      <div class="dfocus-row">
      <div id="dactive-tasks">
        <div class="dtask-card dtask-primary">
          <div class="dtask-label">
            <span class="ddot ddot-blue" id="dtask-dot"></span>
            Primary
          </div>
          <div id="dtask" class="dtask-content">Connecting&hellip;</div>
          <div id="dtask-meta" class="dtask-meta-row"></div>
        </div>
      </div>
        <div class="dpmain-gauge">
          <div class="dgauge-wrap">
            <div class="dgauge-hdr">
              <span id="dgauge-bigval" class="dgauge-cur">0</span>
              <span class="dgauge-sublbl">tok&thinsp;/&thinsp;min</span>
            </div>
            <div class="dgauge-container">
              <svg id="dgauge" viewBox="0 0 200 145" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <filter id="neon-glow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur1"/>
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2"/>
                    <feMerge>
                      <feMergeNode in="blur2"/>
                      <feMergeNode in="blur1"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#00d4ff"/>
                    <stop offset="60%" stop-color="#00ff7f"/>
                    <stop offset="100%" stop-color="#ffcc00"/>
                  </linearGradient>
                </defs>
                <path id="dgauge-track" fill="none" stroke="rgba(0,212,255,0.1)" stroke-width="10" stroke-linecap="round"/>
                <path id="dgauge-fill" fill="none" stroke="url(#gauge-grad)" stroke-width="10" stroke-linecap="round" pathLength="100" filter="url(#neon-glow)" style="transition:stroke-dashoffset 1.2s ease"/>
                <g id="dgauge-ticks"></g>
                <text id="dgauge-val" class="dgauge-val-text" x="100" y="88" text-anchor="middle" font-size="26">0</text>
                <text class="dgauge-lbl-text" x="100" y="104" text-anchor="middle">utilization</text>
              </svg>
            </div>
            <span id="dtpmlbl" style="display:none"></span>
          </div>
        </div>
      </div>
      <div class="dpmain-queue">
          <div class="dqueue-hdr">
            <span class="dsub">Queue</span>
            <span id="dqfrac">0 pending &middot; 0 done</span>
          </div>
          <div class="dtrack"><div id="dqfill" style="width:0%"></div><span id="dqpct" class="dqpct"></span></div>
          <div id="dqlist"></div>
        </div>
    </section>

    <section id="dpmet" class="dpanel">
      <h2 class="dpanel-title"><svg width="1em" height="1em" viewBox="0 0 16 16" style="vertical-align:-0.15em;margin-right:0.35em"><rect x="1" y="9" width="3" height="6" rx="0.8" fill="currentColor" opacity="0.5"/><rect x="5.5" y="5" width="3" height="10" rx="0.8" fill="currentColor" opacity="0.7"/><rect x="10" y="1" width="3" height="14" rx="0.8" fill="currentColor" opacity="0.9"/></svg>Metrics</h2>
      <div class="dstat-group">
        <div class="dstat-row dstat-row-done">
          <div id="dtasksdone" class="dstat-val mv-done">0</div>
          <div class="dstat-lbl">Tasks Done</div>
        </div>
        <div class="dstat-row dstat-row-events">
          <div id="devents" class="dstat-val mv-events">0</div>
          <div class="dstat-lbl">Audit Events</div>
        </div>
        <div class="dstat-row dstat-row-tokens">
          <div id="dtokens" class="dstat-val mv-tokens">0</div>
          <div class="dstat-lbl">Total Tokens</div>
        </div>
      </div>
      <div class="dkpi-group">
        <div class="dkpi"><span class="dkpi-val" id="dkpi-tpm">0</span><span class="dkpi-lbl">tok/min</span></div>
        <div class="dkpi"><span class="dkpi-val" id="dkpi-tps">0</span><span class="dkpi-lbl">tok/sec</span></div>
        <div class="dkpi"><span class="dkpi-val" id="dkpi-drain">0.0</span><span class="dkpi-lbl">drain/min</span></div>
        <div class="dkpi"><span class="dkpi-val" id="dkpi-failed">0</span><span class="dkpi-lbl">failed</span></div>
        <div class="dkpi"><span class="dkpi-val" id="dkpi-stalled">0</span><span class="dkpi-lbl">stalled</span></div>
        <div class="dkpi"><span class="dkpi-val" id="dkpi-oldest">0s</span><span class="dkpi-lbl">oldest task</span></div>
      </div>
      <div style="display:none"><span id="dtpmbig"></span></div>
    </section>
  </div>

  <footer id="dlog-strip">
    <span class="dticker-dot"></span>
    <span class="dticker-label">Live</span>
    <div id="dlogfeed"></div>
  </footer>
</div>

<div id="matrix-overlay">
  <canvas id="matrix-canvas"></canvas>
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
    <div id="daily-archive-nav" class="daily-archive-nav" style="display:none"></div>
    <div id="daily-body" class="daily-body">
      <div class="daily-empty">
        <div class="daily-empty-icon">&#x1F4CB;</div>
        Loading&hellip;
      </div>
    </div>
  </div>
</div>

<script>
  var ST={resources:[],audit:[],lastId:-1,lastSyntheticId:-1,busyResources:{},activeAliases:{},resourceHealth:{},orchestratorAlias:'',orchestratorName:'',accountUsername:'',ema:{rate:0,lastT:0,timer:null,peak:10000},tps:{rate:0,peak:200}};
  var clockEl=document.getElementById('dclock');
  function tickClock(){
    clockEl.textContent=new Date().toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  tickClock();setInterval(tickClock,1000);

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function fmt(n){
    if(n==null||isNaN(n))return'\u2014';
    if(n>=1000000)return(n/1000000).toFixed(3)+'M';
    if(n>=10000)return Math.round(n/1000)+'K';
    if(n>=1000)return(n/1000).toFixed(1).replace(/\.0$/,'')+'K';
    return String(Math.round(n));
  }
  async function fetchJ(path){try{var r=await fetch(path,{cache:'no-store'});return r.ok?r.json():null;}catch(e){return null;}}
  function el(id){return document.getElementById(id);}
  function cleanHandle(value){
    var raw=String(value==null?'':value).trim().replace(/^@+/, '');
    return raw||'';
  }
  function getHeaderHandle(data){
    var raw=(data&&data.accountUsername)||ST.accountUsername||(data&&data.orchestratorName)||ST.orchestratorName||'ben';
    var cleaned=cleanHandle(raw);
    return '@'+(cleaned||'ben');
  }
  function syncHeaderHandle(data){
    if(data&&typeof data.accountUsername==='string'&&data.accountUsername.trim())ST.accountUsername=cleanHandle(data.accountUsername);
    if(data&&typeof data.orchestratorName==='string'&&data.orchestratorName.trim())ST.orchestratorName=data.orchestratorName;
    el('dorch').textContent=getHeaderHandle(data);
  }
  function countOnlineNodes(resourceHealth){
    if(!resourceHealth||typeof resourceHealth!=='object')return null;
    var count=0,seen=false;
    for(var alias in resourceHealth){
      if(!Object.prototype.hasOwnProperty.call(resourceHealth,alias))continue;
      seen=true;
      if(!resourceHealth[alias]||resourceHealth[alias].status!=='offline')count++;
    }
    return seen?count:null;
  }
  function syncOnlineNodeCount(data){
    var fleet=data&&data.displayMetrics&&data.displayMetrics.fleetSummary;
    if(fleet&&typeof fleet.onlineNodes==='number'){
      setVal('drescnt',String(fleet.onlineNodes));
      return;
    }
    var onlineCount=countOnlineNodes(data&&data.resourceHealth);
    if(typeof onlineCount==='number'){
      setVal('drescnt',String(onlineCount));
      return;
    }
    var cap=data&&data.capacity;
    if(cap&&typeof cap.resourceCount==='number'){
      setVal('drescnt',String(cap.resourceCount));
      return;
    }
    if(Array.isArray(data&&data.activeResources)){
      setVal('drescnt',String(data.activeResources.length));
    }
  }

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
    syncHeaderHandle(data);
    if(data.orchestratorAlias)ST.orchestratorAlias=data.orchestratorAlias;
    var mode=data.mode||'command',modeEl=el('dmode');
    modeEl.textContent=mode.toUpperCase();modeEl.className='m-'+mode;
    var busyEl=el('dbusy');var taskDotPoll=el('dtask-dot');
    if(data.auto&&data.auto.busy){
      if(busyEl){busyEl.style.display='';busyEl.className='ddot ddot-amber dpulse';}
      if(taskDotPoll)taskDotPoll.className='ddot ddot-amber dpulse';
    } else {
      if(busyEl)busyEl.style.display='none';
      if(taskDotPoll)taskDotPoll.className='ddot ddot-blue';
    }

    var taskEl=el('dtask'),next=data.nextTask,last=data.lastCompleted;
    if(taskEl){
      if(next&&next.content){
        taskEl.textContent=next.content;taskEl.style.color='';
      } else if(last&&last.content){
        taskEl.textContent='\u2713 '+last.content;taskEl.style.color='var(--muted2)';
      } else if(mode==='auto'){
        taskEl.textContent='Auto mode \u2014 scanning queue\u2026';taskEl.style.color='var(--muted2)';
      } else{taskEl.textContent='Idle \u2014 '+mode+' mode';taskEl.style.color='var(--muted)';}
    }

    var pending=(data.auto&&data.auto.pendingCount)||0,completed=(data.auto&&data.auto.completedCount)||0,targetPending=(data.auto&&data.auto.desiredPendingDepth)||0;
    el('dqfrac').textContent=pending+' pending'+(targetPending>0?' (target '+targetPending+')':'')+' \u00b7 '+fmt(completed)+' done';
    var barPct=targetPending>0?Math.min(100,Math.round(pending/targetPending*100)):(pending>0?Math.min(100,pending*10):0);
    el('dqfill').style.width=barPct+'%';
    var pctEl=el('dqpct');if(pctEl)pctEl.textContent=barPct>0?barPct+'%':'';
    setVal('dtasksdone',fmt(completed));
    var busyCount=Object.keys(ST.busyResources).length;
    setVal('dbusy-count',String(busyCount));

    var tel=data.telemetry;
    if(tel){
      setVal('devents',fmt(tel.totalEvents));
      var toks=0,mkeys=Object.keys(tel.models||{});
      for(var i=0;i<mkeys.length;i++)toks+=(tel.models[mkeys[i]].evalCount||0);
      setVal('dtokens',fmt(toks));
      renderModelBars(tel.models);
    }
    syncOnlineNodeCount(data);
    // Update active aliases and busy state from polling data
    if(Array.isArray(data.activeResources)){
      ST.activeAliases={};
      for(var ai=0;ai<data.activeResources.length;ai++){
        var ar=data.activeResources[ai];
        var arAlias=typeof ar==='string'?ar:ar.alias;
        ST.activeAliases[arAlias]=true;
        if(typeof ar==='object'&&ar.isBusy===true){
          ST.busyResources[arAlias]=true;
        } else if(typeof ar==='object'){
          delete ST.busyResources[arAlias];
        }
      }
    }
    // Update health data from polling
    if(data.resourceHealth && typeof data.resourceHealth==='object'){
      ST.resourceHealth=data.resourceHealth;
    }
    refreshResourceDots();
    // Wire displayMetrics to status banner and KPIs
    if(data.displayMetrics)applyDisplayMetrics(data.displayMetrics);
  }

  // Queue
  async function loadQueue(){
    var data=await fetchJ('/api/queue');
    if(!data)return;
    var active=data.activeTasks||[],tasks=data.pending||[],listEl=el('dqlist');

    // Render active tasks into Current Focus section
    var activeContainer=el('dactive-tasks');
    if(activeContainer){
      if(active.length>0){
        var ahtml='';
        for(var ai=0;ai<active.length;ai++){
          var ares=active[ai].assignedResource||active[ai].requestedResource;
          var isPrimary=ai===0;
          var dur=active[ai].startedAt?Math.round((Date.now()-active[ai].startedAt)/1000):0;
          var durStr=dur>60?Math.round(dur/60)+'m':dur+'s';
          ahtml+='<div class="dtask-card'+(isPrimary?' dtask-primary':'')+'">';
          ahtml+='<div class="dtask-label"><span class="ddot ddot-amber dpulse"></span>'+(isPrimary?'Primary':'Active')+'</div>';
          ahtml+='<div class="dtask-content">'+esc(active[ai].content)+'</div>';
          ahtml+='<div class="dtask-meta-row">';
          if(ares)ahtml+='<span class="dtask-res">@'+esc(ares)+'</span>';
          if(dur>0)ahtml+='<span class="dtask-res" style="color:var(--muted2)">'+durStr+'</span>';
          if(active[ai].priority)ahtml+='<span class="dtask-pri dtask-pri-'+active[ai].priority+'">'+active[ai].priority+'</span>';
          ahtml+='</div>';
          ahtml+='</div>';
        }
        activeContainer.innerHTML=ahtml;
      }
    }

    // Queue list shows only pending (waiting) tasks
    if(!tasks.length){listEl.innerHTML='<div class="dempty">No pending tasks</div>';return;}
    var html='';
    var max=Math.min(tasks.length,8);
    for(var j=0;j<max;j++){
      var r=tasks[j].requestedResource||tasks[j].assignedResource;
      html+='<div class="dqitem"><span class="dqnum">'+(j+1)+'.</span>';
      html+='<span class="dqtext">'+esc(tasks[j].content)+'</span>';
      if(r)html+='<span class="dqres">@'+esc(r)+'</span>';
      html+='</div>';
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
    var onlineCount=0;
    for(var i=0;i<cards.length;i++){
      var a=cards[i].getAttribute('data-alias');if(!a)continue;
      var dot=cards[i].querySelector('.ddot');if(!dot)continue;
      var isBusy=!!ST.busyResources[a];
      // Only pulse when busy (amber); green idle dots stay static
      dot.className='ddot '+getResourceDotClass(a)+(isBusy?' ddot-busy':'');
      if(isBusy){cards[i].classList.add('busy');cards[i].setAttribute('data-busy','1');}
      else{cards[i].classList.remove('busy');cards[i].setAttribute('data-busy','0');}
      var statusEl=cards[i].querySelector('.dres-status');
      if(statusEl){
        var h=ST.resourceHealth[a];
        var isOffline=h&&h.status==='offline';
        var statusWord=isBusy?'ACTIVE':(isOffline?'OFFLINE':'IDLE');
        statusEl.textContent=statusWord;
        cards[i].setAttribute('data-status',statusWord.toLowerCase());
        if(!isOffline)onlineCount++;
      }
    }
    // Sync utilization gauge with client-side busy/online state
    var busyCount=Object.keys(ST.busyResources).length;
    // Count online from rendered cards; fall back to total resources if no cards yet
    var totalResources=document.querySelectorAll('.dres-card').length;
    var effectiveOnline=onlineCount>0?onlineCount:(totalResources>0?totalResources:0);
    if(effectiveOnline>0){
      var util=Math.round((busyCount/effectiveOnline)*100);
      drawGauge(util,100);
    } else if(busyCount>0){
      // Cards not rendered yet but we know some are busy
      drawGauge(busyCount>0?25:0,100);
    }
  }
  async function loadResources(){
    var data=await fetchJ('/api/resources');
    if(!Array.isArray(data))return;
    var grid=el('dres-grid');
    if(!data.length){grid.innerHTML='<div class="dempty">No resources</div>';return;}
    var html='';
    var orchName=ST.orchestratorName||'Ben';
    for(var i=0;i<data.length;i++){
      var r=data[i],tier=r.tier||'low';
      // Only rename the actual Local Orchestrator device (by label), not by alias
      var isOrch=r.label==='Local Orchestrator';
      var label=esc(isOrch?orchName:(r.label||r.alias));
      var handleAlias=isOrch?orchName.toLowerCase():r.alias;
      var dotCls=getResourceDotClass(r.alias);
      var isBusy=!!ST.busyResources[r.alias];
      var busyCls=isBusy?' busy':'';
      var h=ST.resourceHealth[r.alias];
      var isOffline=h&&h.status==='offline';
      var statusText=isBusy?'ACTIVE':(isOffline?'OFFLINE':'IDLE');
      var role=r.shipRole||'Crew';
      var roleCls='drole-'+role.toLowerCase();
      var statusLower=statusText.toLowerCase();
      html+='<div class="dres-card'+busyCls+'" data-alias="'+esc(r.alias)+'" data-busy="'+(isBusy?'1':'0')+'" data-status="'+esc(statusLower)+'">';
      html+='<span class="ddot '+dotCls+(isBusy?' ddot-busy':'')+'"></span>';
      html+='<span class="dres-name" title="'+label+'">'+label+'</span>';
      html+='<span class="dres-handle">@'+esc(handleAlias)+'</span>';
      html+='<div class="dres-meta">';
      html+='<span class="dtier '+roleCls+'" title="'+esc(role)+'">'+esc(role.toUpperCase())+'</span>';
      html+='<span class="dres-status" aria-label="Status: '+statusText+'">'+statusText+'</span>';
      html+='</div>';
      html+='</div>';
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
    var newEvs=[],i,ev,totalNew=0;
    if(ST.lastId===0&&data.length>0)ST.lastId=data[0].id;
    for(i=0;i<data.length;i++){if(data[i].id>ST.lastId)newEvs.push(data[i]);}
    if(newEvs.length>0){
      for(i=0;i<newEvs.length;i++){
        ev=newEvs[i];
        if(ev.evalCount&&ev.evalCount>0)totalNew+=ev.evalCount;
        if(ev.id>ST.lastId)ST.lastId=ev.id;
      }
      ST.audit=data.slice(0,30);renderLog();
      if(totalNew>0)updateTpmEma(totalNew);
    }
  }
  function updateTpmEma(tokens){
    var now=Date.now();
    var elapsed=ST.ema.lastT?(now-ST.ema.lastT)/1000:30;
    var instant=elapsed>0.3?(tokens/elapsed*60):ST.ema.rate;
    ST.ema.rate=ST.ema.rate===0?instant:0.22*instant+0.78*ST.ema.rate;
    ST.ema.lastT=now;
    if(ST.ema.rate>ST.ema.peak)ST.ema.peak=ST.ema.rate*1.25;
    // tok/sec with heavier smoothing for natural gauge acceleration/deceleration
    var instantTps=elapsed>0.3?(tokens/elapsed):ST.tps.rate;
    ST.tps.rate=ST.tps.rate===0?instantTps:0.12*instantTps+0.88*ST.tps.rate;
    if(ST.tps.rate>ST.tps.peak)ST.tps.peak=ST.tps.rate*1.25;
    clearTimeout(ST.ema.timer);
    ST.ema.timer=setTimeout(decayTpm,6000);
    applyTpm(Math.round(ST.ema.rate));
  }
  function decayTpm(){
    ST.ema.rate*=0.65;
    ST.tps.rate*=0.65;
    applyTpm(Math.round(ST.ema.rate));
    if(ST.ema.rate>5){ST.ema.timer=setTimeout(decayTpm,2500);}
    else{ST.ema.rate=0;ST.tps.rate=0;applyTpm(0);}
  }
  function applyTpm(tpm){
    setVal('dgauge-bigval',tpm>0?fmt(tpm):'0');
    setVal('dtpmbig',fmt(tpm));
    // Update KPI tok/min and tok/sec in real-time
    setVal('dkpi-tpm',tpm>0?fmt(tpm):'0');
    var tps=Math.round(ST.tps.rate);
    setVal('dkpi-tps',tps>0?String(tps):'0');
    // Don't override gauge here — gauge shows fleet utilization from displayMetrics
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
      // Source node from resourceAlias or actor field
      var src='';
      if(ev.resourceAlias)src='@'+ev.resourceAlias;
      else if(ev.actor&&ev.actor!=='system')src='@'+ev.actor;
      html+='<div class="dlog"><span class="dlog-time">'+t+'</span>';
      html+='<span class="dlog-kind '+info[1]+'">'+info[0]+'</span>';
      if(src)html+='<span class="dlog-kind" style="opacity:0.4">'+esc(src)+'</span>';
      html+='<span class="dlog-sum">'+esc(ev.summary)+'</span>';
      if(!ev.success)html+='<span class="dlog-err">\u2717</span>';
      html+='</div>';
    }
    feed.innerHTML=html;
  }

  // Display metrics → status banner + KPIs + gauge
  function applyDisplayMetrics(dm){
    if(!dm)return;
    var sys=dm.systemStatus||{};
    var fleet=dm.fleetSummary||{};
    var queue=dm.queueHealth||{};
    var dispatch=dm.dispatch||{};

    // Status banner
    var stateEl=el('dstatus-state');
    if(stateEl){
      var st=sys.overallState||'idle';
      stateEl.textContent=st.toUpperCase();
      stateEl.className='dstatus-chip dstatus-'+st;
    }
    var modeEl2=el('dstatus-mode');
    if(modeEl2){
      var modeText=el('dmode');
      modeEl2.textContent=modeText?modeText.textContent:'syncing';
    }
    var fleetEl=el('dstatus-fleet');
    if(fleetEl){
      var st=sys.overallState||'idle';
      var activeCount=typeof fleet.activeNodes==='number'?fleet.activeNodes:Object.keys(ST.busyResources).length;
      var onlineCount=fleet.onlineNodes||0;
      var util=typeof fleet.utilizationPct==='number'
        ? fleet.utilizationPct
        : (onlineCount>0?Math.round((activeCount/onlineCount)*100):0);
      fleetEl.textContent=st.toUpperCase()+' '+util+'% util ('+activeCount+'/'+onlineCount+')';
      fleetEl.style.color=st==='active'?'#00ff7f':st==='degraded'?'var(--n-amber)':st==='blocked'?'#ff2d78':'';
    }
    var bpEl=el('dstatus-bp');
    if(bpEl){
      var bp=sys.backPressure||'nominal';
      bpEl.textContent='BP: '+bp;
      bpEl.style.color=bp==='critical'?'#ff2d78':bp==='high'?'var(--n-amber)':bp==='rising'?'rgba(255,204,0,0.6)':'';
    }
    var bnEl=el('dstatus-bottleneck');
    if(bnEl)bnEl.textContent=sys.bottleneck?'Bottleneck: '+sys.bottleneck:'Bottleneck: none';
    var dispEl=el('dstatus-dispatch');
    if(dispEl)dispEl.textContent='Dispatch: '+(dispatch.state||'idle')+(dispatch.strategy?' ('+dispatch.strategy+')':'');

    // KPIs — tok/min and tok/sec managed by realtime EMA, don't overwrite here
    setVal('dkpi-drain',typeof queue.drainRatePerMin==='number'?queue.drainRatePerMin.toFixed(1):'—');
    setVal('dkpi-drain',typeof queue.drainRatePerMin==='number'?queue.drainRatePerMin.toFixed(1):'0.0');
    setVal('dkpi-failed',String(queue.failedCount||0));
    setVal('dkpi-stalled',String(queue.stalledCount||0));
    var oldest=queue.oldestPendingAgeSec||0;
    setVal('dkpi-oldest',oldest>60?Math.round(oldest/60)+'m':oldest>0?oldest+'s':'0s');

    // Gauge → fleet utilization is driven by client-side refreshResourceDots()
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
    mxFeedText(summary);
    renderLog();
  }

  function applyStatePayload(d){
    // Show orchestrator name in header (e.g., "@Cap")
    if(d.orchestratorName){
      syncHeaderHandle(d);
    }
    else if(d.accountUsername){syncHeaderHandle(d);}
    if(d.orchestratorAlias)ST.orchestratorAlias=d.orchestratorAlias;
    if(d.mode){
      var modeEl=el('dmode');
      modeEl.textContent=String(d.mode).toUpperCase();
      modeEl.className='m-'+d.mode;
    }

    var busyEl=el('dbusy');
    var taskDot=el('dtask-dot');
    if(d.auto&&d.auto.busy){
      if(busyEl){busyEl.style.display='';busyEl.className='ddot ddot-amber dpulse';}
      if(taskDot)taskDot.className='ddot ddot-amber dpulse';
    } else {
      if(busyEl){busyEl.style.display='none';}
      if(taskDot)taskDot.className='ddot ddot-blue';
    }

    var auto=d.auto||{};
    var activeTasks=auto.activeTasks||[];
    var nextTask=auto.nextTask||null;
    var lastCompleted=auto.lastCompleted||null;
    var taskEl=el('dtask');
    var activeContainer=el('dactive-tasks');

    // Render multiple active tasks into the container
    if(activeTasks.length>0&&activeContainer){
      var ahtml='';
      for(var ati=0;ati<activeTasks.length;ati++){
        var at=activeTasks[ati];
        var atRes=at.assignedResource||at.requestedResource;
        var isPrimary=ati===0;
        var dur=at.startedAt?Math.round((Date.now()-at.startedAt)/1000):0;
        var durStr=dur>60?Math.round(dur/60)+'m':dur+'s';
        ahtml+='<div class="dtask-card'+(isPrimary?' dtask-primary':'')+'">';
        ahtml+='<div class="dtask-label"><span class="ddot ddot-amber dpulse"></span>'+(isPrimary?'Primary':'Active')+'</div>';
        ahtml+='<div class="dtask-content" style="color:var(--n-amber)">'+esc(at.content||'Task in progress')+'</div>';
        ahtml+='<div class="dtask-meta-row">';
        if(atRes)ahtml+='<span class="dtask-res">@'+esc(atRes)+'</span>';
        if(dur>0)ahtml+='<span class="dtask-res" style="color:var(--muted2)">'+durStr+'</span>';
        if(at.priority)ahtml+='<span class="dtask-pri dtask-pri-'+at.priority+'">'+at.priority+'</span>';
        ahtml+='</div>';
        ahtml+='</div>';
      }
      activeContainer.innerHTML=ahtml;
    } else if(activeContainer){
      // No active tasks — show single card with next/last/idle state
      var singleHtml='<div class="dtask-card dtask-primary"><div class="dtask-label"><span class="ddot ddot-blue" id="dtask-dot"></span>Primary</div><div id="dtask">';
      if(nextTask&&nextTask.content){
        singleHtml+=esc(nextTask.content);
      } else if(lastCompleted&&lastCompleted.content){
        var statusPrefix=lastCompleted.status==='failed'?'✗ ':'✓ ';
        singleHtml+=esc(statusPrefix+lastCompleted.content);
      } else if(d.mode==='auto'){
        singleHtml+='Auto mode — scanning queue…';
      } else {
        singleHtml+='Idle — '+esc(d.mode||'command')+' mode';
      }
      singleHtml+='</div><div id="dtask-meta" class="dtask-meta-row" style="display:none"></div></div>';
      activeContainer.innerHTML=singleHtml;
    }

    if(activeTasks.length>0){
      // dtask-dot handled per-card above
    } else if(nextTask&&nextTask.content){
      if(taskEl){taskEl.textContent=nextTask.content;taskEl.style.color='';}
    } else if(lastCompleted&&lastCompleted.content){
      var statusPrefix2=lastCompleted.status==='failed'?'✗ ':'✓ ';
      if(taskEl){taskEl.textContent=statusPrefix2+lastCompleted.content;taskEl.style.color=lastCompleted.status==='failed'?'#ff6666':'var(--muted2)';}
    } else if(d.mode==='auto'){
      if(taskEl){taskEl.textContent='Auto mode — scanning queue…';taskEl.style.color='var(--muted2)';}
    } else {
      if(taskEl){taskEl.textContent='Idle — '+(d.mode||'command')+' mode';taskEl.style.color='var(--muted)';}
    }

    var pending=Number(auto.pendingCount||0),completed=Number(auto.completedCount||0),targetPending=Number(auto.desiredPendingDepth||0);
    el('dqfrac').textContent=pending+' pending'+(targetPending>0?' (target '+targetPending+')':'')+' \u00b7 '+fmt(completed)+' done';
    var barPct2=targetPending>0?Math.min(100,Math.round(pending/targetPending*100)):(pending>0?Math.min(100,pending*10):0);
    el('dqfill').style.width=barPct2+'%';
    var pctEl2=el('dqpct');if(pctEl2)pctEl2.textContent=barPct2>0?barPct2+'%':'';
    var busyCount2=Object.keys(ST.busyResources).length;
    setVal('dbusy-count',String(busyCount2));

    if(Array.isArray(d.activeResources)){
      syncOnlineNodeCount(d);
      // Track busy state from active task assignment, not from the last model seen.
      ST.activeAliases={};
      for(var ai=0;ai<d.activeResources.length;ai++){
        var ar=d.activeResources[ai];
        var arAlias=typeof ar==='string'?ar:ar.alias;
        ST.activeAliases[arAlias]=true;
        if(typeof ar==='object'&&ar.isBusy===true){
          ST.busyResources[arAlias]=true;
        } else if(typeof ar==='object'){
          delete ST.busyResources[arAlias];
        }
      }
    }
    // Update health data from SSE
    if(d.resourceHealth && typeof d.resourceHealth==='object'){
      ST.resourceHealth=d.resourceHealth;
    }
    refreshResourceDots();

    if(typeof d.systemTps==='number'){
      var instPeak=Math.round(d.systemTps*60);
      if(instPeak>ST.ema.peak)ST.ema.peak=instPeak*1.25;
    }
    // Wire displayMetrics from SSE state
    if(d.displayMetrics)applyDisplayMetrics(d.displayMetrics);
  }

  // Model bars
  function renderModelBars(models){
    var container=el('dmodelbars');if(!models)return;
    var entries=[],mkeys=Object.keys(models),i,m,e,pct,nm,html='',maxT;
    for(i=0;i<mkeys.length;i++){m=models[mkeys[i]];if(m.calls>0)entries.push({name:mkeys[i],toks:m.evalCount||0});}
    entries.sort(function(a,b){return b.toks-a.toks;});entries=entries.slice(0,6);
    if(!entries.length){container.innerHTML='<div class="dempty">No model data yet</div>';return;}
    maxT=entries[0].toks;
    var orchAlias=ST.orchestratorAlias||'orchestrator';
    var orchName=ST.orchestratorName||'Ben';
    for(i=0;i<entries.length;i++){
      e=entries[i];pct=maxT>0?Math.round(e.toks/maxT*100):0;
      var displayName=e.name.replace(new RegExp('^'+orchAlias.replace(/[.*+?^{}()|[\]\\$]/g,'\\$&')+'/'),orchName+'/');
      nm=displayName.length>24?displayName.slice(0,22)+'\u2026':displayName;
      html+='<div class="dmodel-row"><div class="dmodel-hdr">';
      html+='<span class="dmodel-name" title="'+esc(e.name)+'">'+esc(nm)+'</span>';
      html+='<span style="color:rgba(0,255,127,0.6)">'+fmt(e.toks)+'t</span></div>';
      html+='<div class="dbar-track"><div class="dbar-fill" style="width:'+pct+'%"></div></div></div>';
    }
    container.innerHTML=html;
  }

  // Radial gauge
  (function(){
    var GCX=100,GCY=84,GR=60,G_S=135,G_E=45;
    function gPt(deg){var r=deg*Math.PI/180;return{x:GCX+GR*Math.sin(r),y:GCY-GR*Math.cos(r)};}
    function gPt2(deg,r2){var r=deg*Math.PI/180;return{x:GCX+r2*Math.sin(r),y:GCY-r2*Math.cos(r)};}
    function gArc(){var s=gPt(G_S),e=gPt(G_E);return'M'+s.x.toFixed(2)+' '+s.y.toFixed(2)+'A'+GR+' '+GR+' 0 1 1 '+e.x.toFixed(2)+' '+e.y.toFixed(2);}
    var arcD=gArc();
    var trackEl=document.getElementById('dgauge-track');
    var fillEl=document.getElementById('dgauge-fill');
    var valEl=document.getElementById('dgauge-val');
    var tickEl=document.getElementById('dgauge-ticks');
    if(trackEl)trackEl.setAttribute('d',arcD);
    if(fillEl){fillEl.setAttribute('d',arcD);fillEl.style.strokeDasharray='100';fillEl.style.strokeDashoffset='100';}
    function drawTicks(maxV){
      if(!tickEl)return;
      var n=5,html='',i,pct,deg,pt,len,pt2,lPt;
      for(i=0;i<=n;i++){
        pct=i/n;deg=G_S+pct*270;pt=gPt(deg);
        len=(i===0||i===n)?7:4;
        pt2=gPt2(deg,GR-len);
        html+='<line x1="'+pt.x.toFixed(1)+'" y1="'+pt.y.toFixed(1)+'" x2="'+pt2.x.toFixed(1)+'" y2="'+pt2.y.toFixed(1)+'" stroke="rgba(0,212,255,0.3)" stroke-width="1.5"/>';
        lPt=gPt2(deg,GR-18);
        html+='<text x="'+lPt.x.toFixed(1)+'" y="'+lPt.y.toFixed(1)+'" text-anchor="middle" dominant-baseline="middle" fill="rgba(0,212,255,0.35)" font-size="8" font-family="SF Mono,ui-monospace,monospace">'+fmt(maxV*i/n)+'</text>';
      }
      tickEl.innerHTML=html;
    }
    window.drawGauge=function(val,maxVal){
      var pct=Math.min(1,Math.max(0,val/(maxVal||100)));
      if(fillEl){fillEl.style.strokeDashoffset=String((100-pct*100).toFixed(1));}
      if(valEl)valEl.textContent=(fmt(val)||'\u2014')+'%';
      drawTicks(maxVal||100);
    };
    window.drawGauge(0,100);
  })();

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
        if(DAILY.on)dailyFetch();
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

  // ── Matrix Mode Engine (Canvas 2D) ─────────────────────────────
  // Crisp digital rain: snapped glyph grid, bounded frame cadence, and
  // visible-row rendering only so the overlay stays sharp at any DPI.
  var MX={on:false,maxStream:12000,raf:null,columns:[],lastT:0,lastDrawT:0,frameMs:1000/24};
  var mxPool='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=<>{}[]|;:.,~^()/_-';
  MX.overlay=document.getElementById('matrix-overlay');
  MX.cvs=document.getElementById('matrix-canvas');
  MX.ctx=MX.cvs?MX.cvs.getContext('2d',{alpha:false,desynchronized:true}):null;
  MX.closeEl=document.getElementById('mx-close');

  // Ring buffer for stream text — avoids splice/shift overhead entirely.
  var mxRing=new Array(MX.maxStream);
  var mxRingW=0,mxRingR=0,mxRingLen=0;

  function mxFeedText(t){
    if(!t||typeof t!=='string')return;
    for(var i=0;i<t.length;i++){
      var c=t.charAt(i);
      if(c==='\\r')continue;
      if(c==='\\n'||c==='\\t')c=' ';
      mxRing[mxRingW]=c;
      mxRingW=(mxRingW+1)%MX.maxStream;
      if(mxRingLen<MX.maxStream)mxRingLen++;
      else mxRingR=(mxRingR+1)%MX.maxStream; // overwrite oldest
    }
  }

  function mxGetChar(){
    if(mxRingLen<=0)return mxPool.charAt(Math.floor(Math.random()*mxPool.length));
    var c=mxRing[mxRingR];
    mxRingR=(mxRingR+1)%MX.maxStream;
    mxRingLen--;
    return c;
  }

  function mxSizeCanvas(){
    if(!MX.cvs)return;
    var dpr=Math.min(window.devicePixelRatio||1,2);
    var w=window.innerWidth;
    var h=window.innerHeight;
    if(!w||!h)return;
    MX.cvs.style.width=w+'px';
    MX.cvs.style.height=h+'px';
    MX.cvs.width=w*dpr;
    MX.cvs.height=h*dpr;
    if(MX.ctx)MX.ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function mxBuildColumns(w,h){
    var numCols=Math.max(20,Math.min(Math.floor(w/22),100));
    MX.columns=[];
    for(var i=0;i<numCols;i++){
      MX.columns.push(mxMakeCol(w,h,false));
    }
  }

  // Create a single column with randomized depth properties.
  // depth 0=far (small, dim, slow), 1=near (large, bright, fast)
  // Uses a fixed-size char array with a head index (ring) to avoid shift/push overhead.
  function mxMakeCol(w,h,startAbove){
    var depth=Math.random(); // 0..1 continuous
    var d3=depth*depth*depth; // cubic curve: most columns are background
    // Font sizes stay on a small set of snapped values for sharper glyph rasterization.
    var vScale=w>=5120?2.0:w>=3840?1.7:w>=1920?1.3:w>=1280?1.1:1.0;
    var fs=Math.round((14+d3*12)*vScale/2)*2;
    var lineH=Math.round(fs*1.16);
    var cellW=Math.max(10,Math.round(fs*0.64));
    var len=Math.floor(6+Math.random()*22+d3*10); // near columns are longer
    var chars=new Array(len);
    for(var i=0;i<len;i++)chars[i]=mxGetChar();
    var head=0; // ring index: chars[head] is the oldest (top of trail)
    // Speed: 30..200 px/sec, correlated with depth
    var speed=(30+d3*170+Math.random()*40)*vScale;
    // Opacity ceiling: 0.3 (far) to 1.0 (near) — far columns still visible
    var alpha=0.3+d3*0.7;
    // Cache font string to avoid rebuilding each frame
    var fontStr=fs+'px "SFMono-Regular","SF Mono","Menlo","Consolas","Liberation Mono",ui-monospace,monospace';
    var laneCount=Math.max(8,Math.floor(w/cellW));
    var x=Math.min(w-cellW,Math.floor(Math.random()*laneCount)*cellW);
    var y=startAbove? -(len*lineH+Math.random()*h*0.5) : -(len*lineH*Math.random());
    return {x:x,y:y,speed:speed,chars:chars,len:len,depth:depth,fs:fs,lineH:lineH,cellW:cellW,alpha:alpha,fontStr:fontStr,stepCarry:0,head:head};
  }

  // Respawn a column at the top with new properties
  function mxRespawn(col,w,h){
    var nc=mxMakeCol(w,h,true);
    col.x=nc.x;col.y=nc.y;col.speed=nc.speed;col.chars=nc.chars;col.len=nc.len;
    col.depth=nc.depth;col.fs=nc.fs;col.lineH=nc.lineH;col.cellW=nc.cellW;col.alpha=nc.alpha;col.fontStr=nc.fontStr;col.stepCarry=0;col.head=nc.head;
  }

  function mxFrame(ts){
    if(!MX.on){MX.raf=null;return;}
    var ctx=MX.ctx;
    if(!ctx||!MX.cvs){MX.raf=null;return;}
    var w=MX.cvs.clientWidth||window.innerWidth;
    var h=MX.cvs.clientHeight||window.innerHeight;

    var elapsed=MX.lastT?Math.min(ts-MX.lastT,100):16.67;
    MX.lastT=ts;
    if(MX.lastDrawT&&ts-MX.lastDrawT<MX.frameMs){
      MX.raf=requestAnimationFrame(mxFrame);
      return;
    }
    MX.lastDrawT=ts;
    // Delta time (capped at 100ms to avoid jumps on tab-switch)
    var dt=elapsed/1000;

    // Fade previous frame — keep phosphor trails crisp instead of muddy.
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.fillRect(0,0,w,h);

    ctx.textBaseline='top';
    ctx.imageSmoothingEnabled=false;

    var cols=MX.columns;
    var lastFont='';
    for(var ci=0;ci<cols.length;ci++){
      var col=cols[ci];
      // Move by delta time
      col.y+=col.speed*dt;
      col.stepCarry+=col.speed*dt;

      // Respawn if fully past viewport
      if(col.y>h+10){
        mxRespawn(col,w,h);
        continue;
      }

      while(col.stepCarry>=col.lineH){
        col.stepCarry-=col.lineH;
        // Ring buffer: overwrite oldest character at head, advance head
        col.chars[col.head]=mxGetChar();
        col.head=(col.head+1)%col.len;
      }

      // Set font only when it changes from previous column
      if(col.fontStr!==lastFont){ctx.font=col.fontStr;lastFont=col.fontStr;}

      // Draw only visible rows to reduce overdraw on large displays.
      var visibleStart=Math.max(0,Math.floor((-col.y)/col.lineH)-1);
      var visibleEnd=Math.min(col.len-1,Math.ceil((h-col.y)/col.lineH)+1);
      for(var chi=visibleStart;chi<=visibleEnd;chi++){
        // Map visual index to ring buffer position: head is oldest (top of trail)
        var ringIdx=(col.head+chi)%col.len;
        var ch=col.chars[ringIdx];
        if(!ch)continue;
        var cy=Math.round(col.y+chi*col.lineH);

        var trailFrac=chi/(col.len-1||1); // 0=top, 1=head
        var isHead=chi===col.len-1;

        if(isHead){
          // Head character: brightest, white-green
          ctx.globalAlpha=Math.min(col.alpha*1.2,1.0);
          ctx.fillStyle='#d8ffd8';
        }else{
          // Trail: phosphor green, fading toward top
          var charAlpha=col.alpha*(0.15+trailFrac*trailFrac*0.85);
          ctx.globalAlpha=charAlpha;
          ctx.fillStyle='#00ff41';
        }
        ctx.fillText(ch,col.x,cy);
      }
    }
    ctx.globalAlpha=1.0;
    MX.raf=requestAnimationFrame(mxFrame);
  }

  function mxStart(){
    if(MX.on)return;
    if(DAILY.on)dailyClose();
    MX.on=true;
    MX.overlay.classList.add('active');
    MX.lastT=0;
    requestAnimationFrame(function(){
      mxSizeCanvas();
      if(MX.ctx&&MX.cvs){
        // Clear to solid black
        MX.ctx.setTransform(1,0,0,1,0,0);
        MX.ctx.fillStyle='#000';
        MX.ctx.fillRect(0,0,MX.cvs.width,MX.cvs.height);
        MX.ctx.setTransform(Math.min(window.devicePixelRatio||1,2),0,0,Math.min(window.devicePixelRatio||1,2),0,0);
      }
      var w=MX.cvs?MX.cvs.clientWidth:window.innerWidth;
      var h=MX.cvs?MX.cvs.clientHeight:window.innerHeight;
      mxBuildColumns(w,h);
      MX.raf=requestAnimationFrame(mxFrame);
    });
  }

  function mxStop(){
    MX.on=false;
    MX.overlay.classList.remove('active');
    if(MX.raf){cancelAnimationFrame(MX.raf);MX.raf=null;}
    MX.columns=[];
    mxRingW=0;mxRingR=0;mxRingLen=0;
    MX.lastT=0;
    MX.lastDrawT=0;
    if(MX.ctx&&MX.cvs){
      MX.ctx.clearRect(0,0,MX.cvs.width,MX.cvs.height);
    }
  }

  // Resize canvas on window resize
  window.addEventListener('resize',function(){
    if(MX.on){
      mxSizeCanvas();
      var w=MX.cvs?MX.cvs.clientWidth:window.innerWidth;
      var h=MX.cvs?MX.cvs.clientHeight:window.innerHeight;
      mxBuildColumns(w,h);
    }
  });

  function mxProcessEvent(msg){
    if(!msg)return;
    if(msg.type==='task-start'&&msg.taskContent)mxFeedText(msg.taskContent);
    if(msg.type==='task-complete'&&msg.taskContent)mxFeedText(msg.taskContent);
    if(msg.type==='task-write'&&msg.filename)mxFeedText(msg.filename);
    if(msg.type==='queue-fill')mxFeedText('queue fill phase '+(msg.phase||''));
    if(msg.type==='daily-complete'&&msg.summary)mxFeedText(msg.summary);
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
  DAILY.archiveNavEl=document.getElementById('daily-archive-nav');

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
    h=h.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g,function(_,t,u){try{var p=new URL(u,location.href);if(p.protocol==='http:'||p.protocol==='https:')return'<a href="'+u+'" target="_blank" rel="noopener">'+t+'</a>';}catch(e){}return t;});
    // paragraphs — double newlines
    h=h.replace(/\\n{2,}/g,'</p><p>');
    // single newlines to <br>
    h=h.replace(/\\n/g,'<br>');
    return'<p>'+h+'</p>';
  }

  function dailyIsGuidance(c){
    return c.indexOf('Generate a comprehensive Daily Work markdown document')!==-1
      ||c.indexOf('Output ONLY the markdown document')!==-1
      ||c.indexOf('This is a high-priority system task')!==-1;
  }

  function dailyShowContent(content,updatedAt,stale){
    var c=content||'';
    if(!c||dailyIsGuidance(c)){
      DAILY.bodyEl.innerHTML='<div class="daily-empty"><div class="daily-empty-icon">&#x1F4CB;</div>Daily briefing document is pending generation.<br>The system will produce it during the next auto cycle.</div>';
      DAILY.updatedEl.textContent='';
      DAILY.staleEl.style.display='none';
      return;
    }
    DAILY.bodyEl.innerHTML=mdToHtml(c);
    if(updatedAt){
      var dt=new Date(updatedAt);
      DAILY.updatedEl.textContent='Updated '+dt.toLocaleString();
    }else{
      DAILY.updatedEl.textContent='';
    }
    DAILY.staleEl.style.display=stale?'inline-block':'none';
  }

  function dailyBuildArchiveNav(d){
    var nav=DAILY.archiveNavEl;
    if(!nav)return;
    var archives=d.archives||[];
    if(archives.length===0){nav.style.display='none';nav.innerHTML='';return;}
    nav.style.display='flex';
    var html='';
    // "Current" button — always first
    html+='<button class="daily-archive-btn active" data-idx="-1">Current</button>';
    for(var i=0;i<archives.length;i++){
      var ts=archives[i].updatedAt?new Date(archives[i].updatedAt).toLocaleDateString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Archive '+(i+1);
      html+='<button class="daily-archive-btn" data-idx="'+i+'">'+ts+'</button>';
    }
    nav.innerHTML=html;
    // Attach click handlers
    var btns=nav.querySelectorAll('.daily-archive-btn');
    for(var b=0;b<btns.length;b++){
      (function(btn){
        btn.addEventListener('click',function(){
          var idx=parseInt(btn.getAttribute('data-idx'),10);
          for(var x=0;x<btns.length;x++)btns[x].classList.remove('active');
          btn.classList.add('active');
          if(idx===-1){
            // Show current document
            dailyShowContent(d.content,d.updatedAt,d.stale);
          }else{
            var arc=d.archives[idx];
            if(arc)dailyShowContent(arc.content,arc.updatedAt,false);
          }
        });
      })(btns[b]);
    }
  }

  function dailyFetch(){
    fetch('/api/daily-work')
      .then(function(r){return r.json()})
      .then(function(d){
        if(!d||!d.available){
          DAILY.bodyEl.innerHTML='<div class="daily-empty"><div class="daily-empty-icon">&#x1F4CB;</div>No daily work document yet.<br>Enter auto mode to generate one.</div>';
          DAILY.updatedEl.textContent='';
          DAILY.staleEl.style.display='none';
          if(DAILY.archiveNavEl){DAILY.archiveNavEl.style.display='none';DAILY.archiveNavEl.innerHTML='';}
          return;
        }
        dailyBuildArchiveNav(d);
        dailyShowContent(d.content,d.updatedAt,d.stale);
      })
      .catch(function(){
        DAILY.bodyEl.innerHTML='<div class="daily-empty"><div class="daily-empty-icon">&#x26A0;</div>Failed to load daily work document.</div>';
      });
  }

  var dailyRefreshTimer=null;
  function dailyOpen(){
    if(DAILY.on)return;
    if(MX.on)mxStop();
    DAILY.on=true;
    DAILY.overlay.classList.add('active');
    dailyFetch();
    dailyRefreshTimer=setInterval(dailyFetch,90000);
  }

  function dailyClose(){
    DAILY.on=false;
    DAILY.overlay.classList.remove('active');
    if(dailyRefreshTimer){clearInterval(dailyRefreshTimer);dailyRefreshTimer=null;}
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

  window.addEventListener('pagehide',function(){if(MX.on)mxStop();if(DAILY.on)dailyClose();closeSSE();});
  updateActivityControls();
  syncActivityState();
</script>
</body>
</html>`;
}
