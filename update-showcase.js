const fs = require('fs');

let html = fs.readFileSync('C:/Users/WIN/Desktop/newcrm/tapveraCrm/tapvera-showcase.html', 'utf8');

// ── 1. Update role count cards ──────────────────────────────────────────────
html = html.replace(
  '<div class="is-count adm">6</div>\n      <div class="is-title">Admin Portal</div>\n      <div class="is-desc">Employee directory, projects, leads, clients, tasks &amp; communications</div>',
  '<div class="is-count adm">9</div>\n      <div class="is-title">Admin Portal</div>\n      <div class="is-desc">Projects, clients, leads, callbacks, communication, tasks, call intelligence &amp; more</div>'
);
html = html.replace(
  '<div class="is-count hr">3</div>\n      <div class="is-title">HR Portal</div>\n      <div class="is-desc">Payroll generation, leave approvals, HR overview &amp; workforce stats</div>',
  '<div class="is-count hr">5</div>\n      <div class="is-title">HR Portal</div>\n      <div class="is-desc">Employee directory, leave management, payslips, shift &amp; holiday management</div>'
);
html = html.replace(
  '<div class="is-count sa">2</div>\n      <div class="is-title">Super Admin</div>\n      <div class="is-desc">Live attendance, full system access, notepad viewer &amp; total control</div>',
  '<div class="is-count sa">2</div>\n      <div class="is-title">Super Admin</div>\n      <div class="is-desc">Full business dashboard, live employee status monitoring &amp; total system control</div>'
);

// ── 2. Update TOC ────────────────────────────────────────────────────────────
const oldTocAdmHrSa = `      <div class="toc-section">
        <div class="toc-section-head adm"><span class="c-dot" style="background:var(--adm)"></span>Admin Portal</div>
        <div class="toc-row" onclick="document.getElementById('adm-dash').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">13. Admin Dashboard</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-emp').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">14. Employee &amp; Attendance Management</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-proj').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">15. Projects &amp; Clients</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-leads').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">16. Leads &amp; Callbacks</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-tasks').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">17. Chat, Tasks &amp; Notifications</span><span class="toc-row-n">ADM</span></div>
      </div>
      <div class="toc-section">
        <div class="toc-section-head hr"><span class="c-dot" style="background:var(--hr)"></span>HR Portal</div>
        <div class="toc-row" onclick="document.getElementById('hr-payroll').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">18. Payroll &amp; HR Dashboard</span><span class="toc-row-n">HR</span></div>
      </div>
      <div class="toc-section">
        <div class="toc-section-head sa"><span class="c-dot" style="background:var(--sa)"></span>Super Admin</div>
        <div class="toc-row" onclick="document.getElementById('roles').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">19. Role Access &amp; System Overview</span><span class="toc-row-n">SA</span></div>
        <div class="toc-row" onclick="document.getElementById('features').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">20. Complete Feature Set</span><span class="toc-row-n">SA</span></div>
      </div>`;

const newTocAdmHrSa = `      <div class="toc-section">
        <div class="toc-section-head adm"><span class="c-dot" style="background:var(--adm)"></span>Admin Portal</div>
        <div class="toc-row" onclick="document.getElementById('adm-proj').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">13. Project Management</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-client').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">14. Client Management</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-leads').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">15. Lead Management</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-callbacks').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">16. Callback Management</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-comm').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">17. Communication Tracking</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-notice').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">18. Notice Board</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-tasks').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">19. Task Assignment</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-callintel').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">20. Call Intelligence</span><span class="toc-row-n">ADM</span></div>
        <div class="toc-row" onclick="document.getElementById('adm-transfer').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">21. Transfer Management</span><span class="toc-row-n">ADM</span></div>
      </div>
      <div class="toc-section">
        <div class="toc-section-head hr"><span class="c-dot" style="background:var(--hr)"></span>HR Portal</div>
        <div class="toc-row" onclick="document.getElementById('hr-empdir').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">22. HR Employee Directory</span><span class="toc-row-n">HR</span></div>
        <div class="toc-row" onclick="document.getElementById('hr-leave').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">23. Leave Management</span><span class="toc-row-n">HR</span></div>
        <div class="toc-row" onclick="document.getElementById('hr-payslip').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">24. Payslip Management</span><span class="toc-row-n">HR</span></div>
        <div class="toc-row" onclick="document.getElementById('hr-shift').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">25. Shift Management</span><span class="toc-row-n">HR</span></div>
        <div class="toc-row" onclick="document.getElementById('hr-holiday').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">26. Holiday Management</span><span class="toc-row-n">HR</span></div>
      </div>
      <div class="toc-section">
        <div class="toc-section-head sa"><span class="c-dot" style="background:var(--sa)"></span>Super Admin</div>
        <div class="toc-row" onclick="document.getElementById('sa-dash').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">27. Super Admin Dashboard</span><span class="toc-row-n">SA</span></div>
        <div class="toc-row" onclick="document.getElementById('sa-status').scrollIntoView({behavior:'smooth'})"><span class="toc-row-name">28. Live Employee Status</span><span class="toc-row-n">SA</span></div>
      </div>`;

html = html.replace(oldTocAdmHrSa, newTocAdmHrSa);

// ── 3. Replace everything after end of employee section ──────────────────────
const empEndMarker = '</div><!-- end employee -->';
const empEndIdx = html.indexOf(empEndMarker) + empEndMarker.length;
const fileStart = html.substring(0, empEndIdx);

const newSections = `
<div class="divider"></div>


<!-- ════════════════════════════════════════
     ●  ADMIN PORTAL
════════════════════════════════════════ -->
<div id="admin">
<div class="sec-header adm">
  <div class="sec-badge adm"><span class="sec-dot"></span>Part Two · Admin Portal</div>
  <div class="sec-h">The <em class="adm">Admin Experience</em></div>
  <p class="sec-desc">Built for the people running the business — complete control over projects, clients, leads, callbacks, team communication, tasks, call intelligence, and transfers. Every tool an admin needs to keep operations moving without friction.</p>
  <div class="sec-modules">
    <span class="sec-mod">Project Management</span><span class="sec-mod">Client Management</span>
    <span class="sec-mod">Lead Management</span><span class="sec-mod">Callback Management</span>
    <span class="sec-mod">Communication Tracking</span><span class="sec-mod">Notice Board</span>
    <span class="sec-mod">Task Assignment</span><span class="sec-mod">Call Intelligence</span>
    <span class="sec-mod">Transfer Management</span>
  </div>
</div>

<!-- A1 — PROJECT MANAGEMENT -->
<div class="feat-block" id="adm-proj">
  <div class="feat-num"><span class="num adm">1</span><span>Admin Portal · Feature 1</span></div>
  <div class="feat-title">Project Management — Every Project, Every Status, One View</div>
  <div class="feat-subtitle">A complete project delivery engine that shows every active project, its team, its client, and its health — all from a single organised screen.</div>
  <p class="feat-story">
    Running multiple client projects at once means constantly tracking who is doing what, how far along each project is, and which ones are at risk of slipping. Tapvera's Project Management screen consolidates all of this into one table that answers every status question at a glance. <strong>Project name, client, assigned team members, type, deadline, and current status</strong> — all visible together without opening individual records.
  </p>
  <p class="feat-story">
    Projects are categorised by type — Website, SEO, Google Marketing, SMO, Hosting, Invoice App — with colour-coded status badges: On Track, In Review, Active, Planning, Completed, Overdue. Stat cards at the top give a portfolio-level count by type. Admins can switch between table view and card view, filter by status or type, and drill into any project to see its tasks, chat, shared sheets, SEO analytics, and client portal — all from the same entry point.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Project Management</div></div>
    <img src="Crm screenshots/projectmanagement.png" alt="Project Management"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--adm)"></span>Project Management — full project list with type, team, client, status and deadline in one view</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag adm">Project table with name / client / team / type / status / deadline</span>
    <span class="feat-tag adm">Type breakdown: Website, SEO, SMO, Marketing, Hosting, Invoice App</span>
    <span class="feat-tag adm">Status badges: On Track / In Review / Active / Planning / Overdue</span>
    <span class="feat-tag adm">Table view and card view toggle</span>
    <span class="feat-tag adm">Project-level tasks, chat, sheets, and SEO analytics</span>
    <span class="feat-tag adm">Client portal linked per project</span>
    <span class="feat-tag adm">Milestone tracking with deadline alerts</span>
    <span class="feat-tag adm">One-click downloadable project report</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon adm">📁</div><div class="fli-body"><div class="fli-title">Centralised Project Workspace</div><div class="fli-desc">Every project has its own space inside Tapvera — tasks, team chat, shared sheets, SEO analytics, reports, and screenshots — all organised under that project so nothing gets lost.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📊</div><div class="fli-body"><div class="fli-title">Portfolio Health at a Glance</div><div class="fli-desc">The project table shows all active projects with their status, giving managers immediate visibility into which projects are on track and which need attention — without opening each one.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">👥</div><div class="fli-body"><div class="fli-title">Team Assignment per Project</div><div class="fli-desc">Each project shows the assigned team members as avatar chips. Adding or removing a team member from a project takes seconds and instantly updates their task and communication access.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📋</div><div class="fli-body"><div class="fli-title">SEO &amp; Backlink Tracking Built In</div><div class="fli-desc">SEO projects include integrated keyword ranking tracking and backlink monitoring — no separate tools needed. Track keyword positions and link growth directly inside the project.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- A2 — CLIENT MANAGEMENT -->
<div class="feat-block" id="adm-client">
  <div class="feat-num"><span class="num adm">2</span><span>Admin Portal · Feature 2</span></div>
  <div class="feat-title">Client Management — Every Client Relationship, Fully Organised</div>
  <div class="feat-subtitle">A complete client directory with contact details, business info, status management, credentials, invoices, and interaction history — all in one place.</div>
  <p class="feat-story">
    Managing client relationships means keeping track of a lot of moving pieces — contact details, active projects, invoice status, past interactions, and credentials. Tapvera's Client Management screen brings all of it into one clean interface. <strong>Every client has a record</strong> showing their business name, email, phone, status (Active/Inactive), and quick access to all their linked projects and invoices.
  </p>
  <p class="feat-story">
    Admins can add new clients, edit their details, activate or deactivate accounts, and manage portal credentials — all without leaving the screen. Each client record stores invoices, interaction remarks, and a communication history so every team member who interacts with that client has the full context. A <strong>bulk email tool</strong> lets admins send messages to multiple clients at once with a custom subject and body.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Client Management</div></div>
    <img src="Crm screenshots/clientmanagement.png" alt="Client Management"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--adm)"></span>Client Management — full client directory with status, credentials, linked projects and invoice history</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag adm">Full client directory with name / business / email / status</span>
    <span class="feat-tag adm">Add / edit / deactivate clients instantly</span>
    <span class="feat-tag adm">Active / Inactive status toggle per client</span>
    <span class="feat-tag adm">Client portal credentials management</span>
    <span class="feat-tag adm">Invoice storage and payment tracking per client</span>
    <span class="feat-tag adm">Interaction remarks and communication history</span>
    <span class="feat-tag adm">Bulk email tool — custom subject and body</span>
    <span class="feat-tag adm">Linked projects view per client</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon adm">🔑</div><div class="fli-body"><div class="fli-title">Client Portal Access Control</div><div class="fli-desc">Each client has dedicated login credentials for their portal. Admins manage these credentials directly — generate, view, copy, or reset them — without involving IT or third-party tools.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">💼</div><div class="fli-body"><div class="fli-title">Invoice &amp; Payment Tracking</div><div class="fli-desc">Each client record stores their invoices and payment history. Track outstanding payments, view past transactions, and keep financial records against each client without a separate system.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📧</div><div class="fli-body"><div class="fli-title">Bulk Client Communication</div><div class="fli-desc">Select multiple clients and send a single email with a custom message — for announcements, updates, or reminders. No BCC, no mail merge, no third-party tool needed.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📝</div><div class="fli-body"><div class="fli-title">Interaction Remarks</div><div class="fli-desc">Log notes and remarks against each client interaction. Every team member who later touches that client account can see the full history and context — no repeated conversations.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- A3 — LEAD MANAGEMENT -->
<div class="feat-block" id="adm-leads">
  <div class="feat-num"><span class="num adm">3</span><span>Admin Portal · Feature 3</span></div>
  <div class="feat-title">Lead Management — Your Entire Sales Pipeline, Visualised</div>
  <div class="feat-subtitle">A drag-and-drop Kanban pipeline that tracks every prospect from first contact to closed deal — so no lead ever goes cold due to poor follow-up.</div>
  <p class="feat-story">
    Most businesses lose deals not because of price or product — but because of follow-up failure. A lead was contacted, interest was shown, and then nothing. Tapvera's Lead Management system is designed to make that impossible. <strong>Every lead has a stage, every stage has an owner, and the pipeline always shows you exactly what needs to happen next.</strong>
  </p>
  <p class="feat-story">
    The Visual Lead Board (Kanban) organises leads across six stages: New Leads, Contacted, Qualified, Negotiation, Closed Won, and Closed Lost. Each card shows the company name, contact person, phone number, and assigned rep. Leads move between stages by drag-and-drop — and every move is logged automatically. Stats at the top show conversion rate, win rate, total revenue, and average deal size in real time.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Lead Management</div></div>
    <img src="Crm screenshots/leadmanagement.png" alt="Lead Management"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--adm)"></span>Lead Kanban — 6-stage pipeline with drag-and-drop, lead cards, conversion metrics and team assignment</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag adm">6-stage Kanban: New → Contacted → Qualified → Negotiation → Won → Lost</span>
    <span class="feat-tag adm">Drag-and-drop lead stage movement</span>
    <span class="feat-tag adm">Lead cards: name / company / phone / assigned rep</span>
    <span class="feat-tag adm">Assign and transfer leads between team members</span>
    <span class="feat-tag adm">Conversion rate, win rate, revenue metrics</span>
    <span class="feat-tag adm">Every status change logged automatically</span>
    <span class="feat-tag adm">Priority tagging: High / Medium / Low</span>
    <span class="feat-tag adm">Source tracking for each lead</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon adm">🗂️</div><div class="fli-body"><div class="fli-title">Visual Kanban Pipeline</div><div class="fli-desc">Leads are represented as cards on a drag-and-drop board. Moving a lead from "Contacted" to "Qualified" is as simple as dragging the card — status updates instantly and the move is logged.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">👤</div><div class="fli-body"><div class="fli-title">Lead Ownership &amp; Transfer</div><div class="fli-desc">Every lead is assigned to a specific team member. Leads can be transferred between reps with full history preserved — no context lost, no starting from scratch.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📊</div><div class="fli-body"><div class="fli-title">Real-Time Sales Metrics</div><div class="fli-desc">Conversion rate, win rate, total revenue, and average deal size update in real time as leads move through the pipeline — giving managers an instant performance snapshot.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">🏷️</div><div class="fli-body"><div class="fli-title">Priority &amp; Source Tagging</div><div class="fli-desc">Each lead carries a priority level (High/Medium/Low) and source tag (Website, Referral, Cold Call, etc.) — making it easy to filter leads and focus effort on the highest-value prospects.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- A4 — CALLBACK MANAGEMENT -->
<div class="feat-block" id="adm-callbacks">
  <div class="feat-num"><span class="num adm">4</span><span>Admin Portal · Feature 4</span></div>
  <div class="feat-title">Callback Management — Every Follow-Up Scheduled, Nothing Missed</div>
  <div class="feat-subtitle">A time-based Kanban and calendar system that ensures every scheduled callback happens — on the right day, by the right person, with full context.</div>
  <p class="feat-story">
    Callbacks are where deals are won or lost. Scheduling a callback and actually completing it on time are two very different things — and most CRMs fail at the second part. <strong>Tapvera's Callback Management organises every scheduled follow-up into a live, time-aware board</strong> that makes it impossible to miss a callback or lose track of who was supposed to call whom.
  </p>
  <p class="feat-story">
    The time-based Kanban has six columns: Overdue, Today, Tomorrow, This Week, Future, and Completed. Each callback card shows the contact name, company, callback type (Call, Email, WhatsApp, Zoom, In-Person), scheduled time, and the assigned rep. Overdue callbacks are highlighted immediately so they get actioned first. The system also offers a full calendar view for month/week/day planning — with colour-coded events and click-through details.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Callback Management</div></div>
    <img src="Crm screenshots/callback management.png" alt="Callback Management"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--adm)"></span>Callback Kanban — time-based columns (Overdue, Today, Tomorrow, This Week, Future, Completed) with callback type and assignee</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag adm">Time-based Kanban: Overdue / Today / Tomorrow / This Week / Future / Completed</span>
    <span class="feat-tag adm">Callback types: Call / Email / WhatsApp / Zoom / In-Person</span>
    <span class="feat-tag adm">Overdue callbacks flagged immediately</span>
    <span class="feat-tag adm">Assign callbacks to specific reps</span>
    <span class="feat-tag adm">Calendar view (month / week / day / agenda)</span>
    <span class="feat-tag adm">Filter by rep, callback type, or status</span>
    <span class="feat-tag adm">Full contact context on every callback card</span>
    <span class="feat-tag adm">Notes attached to each callback</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon adm">⏰</div><div class="fli-body"><div class="fli-title">Overdue Callbacks Surfaced First</div><div class="fli-desc">The Overdue column highlights every missed callback in red the moment its scheduled time passes — making sure the team addresses backlog before scheduling new follow-ups.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📞</div><div class="fli-body"><div class="fli-title">Multi-Channel Follow-Up Types</div><div class="fli-desc">Each callback specifies the channel — phone call, email, WhatsApp, Zoom meeting, or in-person visit. Teams know exactly how to reach a contact, not just when.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📅</div><div class="fli-body"><div class="fli-title">Full Calendar Integration</div><div class="fli-desc">Switch from Kanban to a full calendar view showing every scheduled callback as a colour-coded event. Plan the week ahead, view daily schedules, and spot gaps in follow-up coverage.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">👤</div><div class="fli-body"><div class="fli-title">Rep-Level Accountability</div><div class="fli-desc">Every callback is assigned to a named team member. Managers can filter the board by rep to see who has pending callbacks, who is overdue, and who is completing their follow-ups on time.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- A5 — COMMUNICATION TRACKING -->
<div class="feat-block" id="adm-comm">
  <div class="feat-num"><span class="num adm">5</span><span>Admin Portal · Feature 5</span></div>
  <div class="feat-title">Communication Tracking — All Team Conversations, Organised by Project</div>
  <div class="feat-subtitle">Built-in team messaging with project-specific rooms, direct messages, and group chats — so every work conversation happens in the right place and is always findable.</div>
  <p class="feat-story">
    Work conversations belong where the work happens. Tapvera's Communication Tracking gives the entire organisation a fully structured messaging system — <strong>no WhatsApp, no Slack, no switching between tabs</strong>. Every project has its own dedicated chat room. Every team member has direct message access to every colleague. Discussions stay linked to the project or task they are about, making them searchable and permanently accessible.
  </p>
  <p class="feat-story">
    Admins can view all project communications, track conversation history, monitor team activity, and jump into any room to provide guidance or context. The search and filter tools let managers quickly find specific messages, decisions, or file attachments across all project rooms — without asking someone to forward a message.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Communication Tracking</div></div>
    <img src="Crm screenshots/communicationmanagement.png" alt="Communication Tracking"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--adm)"></span>Communication Tracking — project chat rooms, direct messages, group chats, and searchable conversation history</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag adm">Project-specific chat rooms per client/project</span>
    <span class="feat-tag adm">Direct messages between any team members</span>
    <span class="feat-tag adm">Group chats for departments or teams</span>
    <span class="feat-tag adm">File and image attachments in chat</span>
    <span class="feat-tag adm">Message reply and thread quoting</span>
    <span class="feat-tag adm">Real-time message delivery</span>
    <span class="feat-tag adm">Search across all conversations</span>
    <span class="feat-tag adm">Unread message counters per room</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon adm">💬</div><div class="fli-body"><div class="fli-title">Project Chat Rooms</div><div class="fli-desc">Every project has a dedicated chat room — all team discussions about that project are in one thread, searchable and persistent, linked directly to the project record.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📎</div><div class="fli-body"><div class="fli-title">File Sharing Built In</div><div class="fli-desc">Send images, documents, and files directly in chat — no separate file transfer needed. Attachments stay linked to their conversation so they can be found later without asking who sent what.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">🔍</div><div class="fli-body"><div class="fli-title">Full Conversation Search</div><div class="fli-desc">Search across all chat rooms and direct messages to find any decision, instruction, or file that was shared — even from months ago. No more "can you re-send that?"</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📊</div><div class="fli-body"><div class="fli-title">Admin Visibility Across All Rooms</div><div class="fli-desc">Admins can view all project rooms and team conversations — providing oversight without micromanagement. Jump in to provide context, share a file, or make a decision directly in the thread.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- A6 — NOTICE BOARD -->
<div class="feat-block" id="adm-notice">
  <div class="feat-num"><span class="num adm">6</span><span>Admin Portal · Feature 6</span></div>
  <div class="feat-title">Notice Board — Company-Wide Announcements, Instantly Delivered</div>
  <div class="feat-subtitle">A dedicated notice board that delivers company announcements to every employee the moment they log in — no mass emails, no group chats, no missed messages.</div>
  <p class="feat-story">
    Important company updates — new policies, holiday notices, meeting reminders, urgent alerts — need to reach everyone reliably. Tapvera's Notice Board gives admins a dedicated channel for organisation-wide communication that doesn't get buried in email inboxes or group chats. <strong>Post once, and every employee sees it on login</strong> — as a prominent overlay or pinned notification that cannot be easily dismissed without reading.
  </p>
  <p class="feat-story">
    Each notice can have a title, body, and optional attachment. Notices are timestamped and archived — so there's a permanent record of every company-wide communication, accessible to admins at any time. Employees can view the full notice board from their sidebar, review past notices, and see when each was posted and by whom.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Notice Board</div></div>
    <img src="Crm screenshots/notice board.png" alt="Notice Board"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--adm)"></span>Notice Board — company-wide announcements posted by admins, visible to all employees on login</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag adm">Company-wide announcements visible to all employees</span>
    <span class="feat-tag adm">Notice shown as overlay on employee login</span>
    <span class="feat-tag adm">Title, body, and optional attachment per notice</span>
    <span class="feat-tag adm">Timestamped and archived — permanent record</span>
    <span class="feat-tag adm">Posted by admin — visible instantly across org</span>
    <span class="feat-tag adm">Employees can view full notice board from sidebar</span>
    <span class="feat-tag adm">No email required — in-app delivery</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon adm">📢</div><div class="fli-body"><div class="fli-title">Instant Organisation-Wide Reach</div><div class="fli-desc">Post a notice and every employee across the organisation sees it the next time they log in — no email required, no group chat needed, no chance it gets missed in a busy inbox.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📌</div><div class="fli-body"><div class="fli-title">Login Overlay for Critical Notices</div><div class="fli-desc">Critical notices appear as a full-screen overlay when employees log in — ensuring holiday announcements, policy changes, or urgent alerts are seen before the employee starts their workday.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📚</div><div class="fli-body"><div class="fli-title">Permanent Notice Archive</div><div class="fli-desc">All past notices are archived and accessible. Employees can review previous announcements. Admins have a full audit trail of every company communication ever posted.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">✎</div><div class="fli-body"><div class="fli-title">Simple Notice Creation</div><div class="fli-desc">Admins create notices in seconds — title, body, and optional file attachment. No formatting tools, no scheduling complexity. Write it, post it, it's live immediately.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- A7 — TASK ASSIGNMENT -->
<div class="feat-block" id="adm-tasks">
  <div class="feat-num"><span class="num adm">7</span><span>Admin Portal · Feature 7</span></div>
  <div class="feat-title">Task Assignment — Assign, Track, and Manage Every Team Task from One Panel</div>
  <div class="feat-subtitle">A unified task management panel for admins — create tasks for any employee, set priorities and deadlines, and track the status of every task across the entire organisation.</div>
  <p class="feat-story">
    Knowing what your team is working on shouldn't require a daily standup or constant Slack messages. Tapvera's Task Assignment panel gives admins a complete view of <strong>every task across the entire organisation</strong> — not just their own. See what's pending, what's in progress, what's been completed, and what's overdue — all in one place without asking anyone for a status update.
  </p>
  <p class="feat-story">
    Creating a task is straightforward: select the employee, write the title and description, set a priority (High/Medium/Low), add a deadline, and assign it. The employee sees the task immediately in their dashboard. Admins track progress through status badges — Pending, In Progress, Completed, Rejected — and can filter by employee, priority, or deadline to find exactly what needs attention.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Task Assignment</div></div>
    <img src="Crm screenshots/superadmintaskassignment.png" alt="Task Assignment"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--adm)"></span>Task Assignment — admin view of all team tasks with priority, deadline, assignee, and live status tracking</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag adm">Admin view of all tasks across entire organisation</span>
    <span class="feat-tag adm">Create tasks for any employee with priority and deadline</span>
    <span class="feat-tag adm">Status tracking: Pending / In Progress / Completed / Rejected</span>
    <span class="feat-tag adm">Priority levels: High / Medium / Low</span>
    <span class="feat-tag adm">Filter by employee, priority, status, or due date</span>
    <span class="feat-tag adm">Employees see assigned tasks instantly on their dashboard</span>
    <span class="feat-tag adm">Task notes and description per assignment</span>
    <span class="feat-tag adm">Overdue tasks highlighted for immediate action</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon adm">📋</div><div class="fli-body"><div class="fli-title">Full Organisation Task View</div><div class="fli-desc">Admins see all tasks across all employees — not just their own. Understand team workload at a glance, spot bottlenecks, and rebalance tasks before deadlines are missed.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">⚡</div><div class="fli-body"><div class="fli-title">Instant Task Delivery</div><div class="fli-desc">The moment an admin assigns a task, the employee sees it in their dashboard with a notification. No emails, no chasing — the task is live and visible immediately.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">🎯</div><div class="fli-body"><div class="fli-title">Priority-Based Workload Management</div><div class="fli-desc">Tag tasks as High, Medium, or Low priority. Employees see their urgent tasks first. Admins can filter by priority to check that the most important work is getting done on time.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📅</div><div class="fli-body"><div class="fli-title">Deadline Tracking with Overdue Alerts</div><div class="fli-desc">Every task has a deadline. Overdue tasks are flagged visually so they get immediate attention. No task silently goes past its deadline without the admin noticing.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- A8 — CALL INTELLIGENCE -->
<div class="feat-block" id="adm-callintel">
  <div class="feat-num"><span class="num adm">8</span><span>Admin Portal · Feature 8</span></div>
  <div class="feat-title">Call Intelligence — Every Client Call Documented and Searchable</div>
  <div class="feat-subtitle">Log call summaries, notes, and outcomes for every client or lead interaction — so no conversation is ever lost and every team member stays fully informed.</div>
  <p class="feat-story">
    Sales and client calls contain decisions, commitments, and context that matter long after the call ends. Without a structured way to capture them, that information lives only in someone's head or a personal notepad — and disappears the moment that person is unavailable. <strong>Tapvera's Call Intelligence feature gives every call a permanent, searchable record</strong> that any authorised team member can access.
  </p>
  <p class="feat-story">
    Each call summary captures the contact name, date and time, duration, type (Inbound/Outbound), outcome, and detailed notes. Admins can view all call logs across the team — filtering by employee, date range, or contact — to understand what was discussed, what was promised, and what follow-up is needed. The full call history per client or lead is always available, building a complete interaction timeline.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Call Intelligence</div></div>
    <img src="Crm screenshots/call intelligence.png" alt="Call Intelligence"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--adm)"></span>Call Intelligence — call log with contact, date, type, outcome, and full summary notes per interaction</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag adm">Log call summaries per client or lead interaction</span>
    <span class="feat-tag adm">Contact name, date, time, duration, call type</span>
    <span class="feat-tag adm">Inbound / Outbound call classification</span>
    <span class="feat-tag adm">Outcome tagging per call</span>
    <span class="feat-tag adm">Detailed notes field per call record</span>
    <span class="feat-tag adm">Admin view of all team call logs</span>
    <span class="feat-tag adm">Filter by employee, date range, or contact</span>
    <span class="feat-tag adm">Full call history per client or lead</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon adm">📞</div><div class="fli-body"><div class="fli-title">Permanent Call Records</div><div class="fli-desc">Every call logged in Tapvera creates a permanent record. When a client calls again weeks later, the team member answering can see the full conversation history before saying hello.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">🔍</div><div class="fli-body"><div class="fli-title">Searchable Call History</div><div class="fli-desc">Search call logs by contact name, outcome, or notes keyword. Find a specific call, a specific promise made to a client, or all calls from a particular date range — instantly.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">👁️</div><div class="fli-body"><div class="fli-title">Team Call Oversight for Admins</div><div class="fli-desc">Admins see all call logs across the entire team — who spoke to which client, what was discussed, and what was promised. Managers can coach based on real call records, not impressions.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">🔗</div><div class="fli-body"><div class="fli-title">Linked to Lead &amp; Client Records</div><div class="fli-desc">Call logs are linked to the corresponding lead or client record — so the full interaction timeline is available when viewing a client profile or reviewing a lead's history.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- A9 — TRANSFER MANAGEMENT -->
<div class="feat-block" id="adm-transfer">
  <div class="feat-num"><span class="num adm">9</span><span>Admin Portal · Feature 9</span></div>
  <div class="feat-title">Transfer Management — Move Leads Between Team Members Without Losing Context</div>
  <div class="feat-subtitle">A structured lead transfer system that moves ownership between team members with full history intact — ensuring continuity and accountability with every handover.</div>
  <p class="feat-story">
    When a lead changes hands — because a sales rep leaves, a territory realigns, or a client requests a different contact — the worst possible outcome is losing the context of every interaction that happened before. <strong>Tapvera's Transfer Management system handles lead handovers with full history preserved.</strong> The new owner sees every call, every note, every stage change from the beginning — no re-introduction required.
  </p>
  <p class="feat-story">
    Admins can initiate a transfer from any lead record, selecting the new assignee and adding a transfer note. The previous owner, new owner, and timestamp are all recorded. Transferred leads keep their complete interaction history, callback schedule, and stage position. The receiving rep picks up exactly where the previous one left off — maintaining relationship continuity and preventing deals from going cold during the handover.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Transfer Management</div></div>
    <img src="Crm screenshots/transfer management.png" alt="Transfer Management"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--adm)"></span>Transfer Management — lead transfer log with previous owner, new owner, timestamp, and full history preservation</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag adm">Transfer leads between team members with full history intact</span>
    <span class="feat-tag adm">Previous owner, new owner, and timestamp recorded</span>
    <span class="feat-tag adm">Transfer note field for context</span>
    <span class="feat-tag adm">Transferred lead keeps stage, callbacks, and notes</span>
    <span class="feat-tag adm">Complete transfer log per lead record</span>
    <span class="feat-tag adm">Admin-initiated or rep-requested transfers</span>
    <span class="feat-tag adm">No context lost during team handovers</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon adm">🔄</div><div class="fli-body"><div class="fli-title">Zero-Loss Handovers</div><div class="fli-desc">When a lead is transferred, every interaction note, call log, stage history, and scheduled callback moves with it. The new rep starts with full context — not a blank slate.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">📋</div><div class="fli-body"><div class="fli-title">Full Transfer Audit Trail</div><div class="fli-desc">Every transfer is logged — who initiated it, who it went to, when it happened, and any note provided. Managers have a complete record of how leads moved through the team.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">👥</div><div class="fli-body"><div class="fli-title">Flexible Initiation</div><div class="fli-desc">Transfers can be initiated by an admin (reassigning a rep's leads) or requested by the rep themselves. Either way, the process is structured, documented, and tracked.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon adm">🔗</div><div class="fli-body"><div class="fli-title">Stage and Callback Continuity</div><div class="fli-desc">The lead's Kanban stage and all scheduled callbacks carry over to the new owner automatically. The next follow-up is already in the new rep's calendar before they even open the lead.</div></div></div>
  </div>
</div>
</div><!-- end admin -->
<div class="divider"></div>


<!-- ════════════════════════════════════════
     ●  HR PORTAL
════════════════════════════════════════ -->
<div id="hr">
<div class="sec-header hr">
  <div class="sec-badge hr"><span class="sec-dot"></span>Part Three · HR Portal</div>
  <div class="sec-h">The <em class="hr">HR Experience</em></div>
  <p class="sec-desc">A complete people-management suite — employee directory, leave approvals, payroll processing, shift scheduling, and holiday management — giving HR teams the tools to work on people strategy, not paperwork.</p>
  <div class="sec-modules">
    <span class="sec-mod">HR Employee Directory</span><span class="sec-mod">Leave Management</span>
    <span class="sec-mod">Payslip Management</span><span class="sec-mod">Shift Management</span>
    <span class="sec-mod">Holiday Management</span>
  </div>
</div>

<!-- H1 — HR EMPLOYEE DIRECTORY -->
<div class="feat-block" id="hr-empdir">
  <div class="feat-num"><span class="num hr">1</span><span>HR Portal · Feature 1</span></div>
  <div class="feat-title">HR Employee Directory — Your Complete Workforce, Fully Organised</div>
  <div class="feat-subtitle">A searchable, filterable directory of every employee in the organisation — with role, department, attendance status, and full profile access from one HR-focused view.</div>
  <p class="feat-story">
    HR teams need fast access to employee information — not just names and job titles, but the details that matter for people management: department, designation, current attendance status, leave balance, salary band, and work history. Tapvera's HR Employee Directory provides a <strong>purpose-built view of the entire workforce</strong> designed specifically for HR workflows, with quick-access actions at every row.
  </p>
  <p class="feat-story">
    Search by name, filter by department or designation, and access any employee's full profile — including personal details, salary structure, documents, and complete attendance history — in a single click. HR can update employee records, manage contract details, and view workforce analytics without switching to a separate system.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · HR Employee Directory</div></div>
    <img src="Crm screenshots/hrempdirectory.png" alt="HR Employee Directory"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--hr)"></span>HR Employee Directory — full workforce list with department, designation, status and profile access</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag hr">Full employee directory with department and designation</span>
    <span class="feat-tag hr">Search by name, filter by department or role</span>
    <span class="feat-tag hr">One-click access to full employee profiles</span>
    <span class="feat-tag hr">Salary structure and work history per employee</span>
    <span class="feat-tag hr">Document management per employee record</span>
    <span class="feat-tag hr">Attendance status indicators</span>
    <span class="feat-tag hr">Add / edit / deactivate employees</span>
    <span class="feat-tag hr">Workforce analytics view</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon hr">👥</div><div class="fli-body"><div class="fli-title">Complete Employee Profiles</div><div class="fli-desc">Every employee record includes personal details, contact info, role, department, documents, salary structure, and full attendance and work history — all in one HR-accessible profile.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">🔍</div><div class="fli-body"><div class="fli-title">Smart Search &amp; Filtering</div><div class="fli-desc">Find any employee instantly by searching their name or filtering by department, designation, or employment status. The directory handles large teams without any lag or pagination friction.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">📄</div><div class="fli-body"><div class="fli-title">Document Management</div><div class="fli-desc">Store and access employee documents — contracts, ID proofs, certifications — directly within each employee's record. No separate document drive, no emailing files back and forth.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">📊</div><div class="fli-body"><div class="fli-title">Attendance &amp; Leave Overview</div><div class="fli-desc">HR can view each employee's attendance percentage, leave balance, and current status directly from the directory — without opening separate attendance or leave modules.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- H2 — LEAVE MANAGEMENT -->
<div class="feat-block" id="hr-leave">
  <div class="feat-num"><span class="num hr">2</span><span>HR Portal · Feature 2</span></div>
  <div class="feat-title">Leave Management — Approve, Track, and Plan Employee Time Off Effortlessly</div>
  <div class="feat-subtitle">A complete leave request workflow — employees apply, HR reviews and approves or rejects, attendance updates automatically, and payroll reflects leave deductions with no manual work.</div>
  <p class="feat-story">
    Leave management is one of the most operationally sensitive HR tasks — handled poorly, it leads to unapproved absences, payroll errors, and compliance issues. Tapvera's Leave Management system creates a <strong>fully digital, structured approval workflow</strong> that replaces email chains and paper forms entirely. Employees apply for leave through their portal; HR sees every request in a centralised table and can approve or reject with a single click.
  </p>
  <p class="feat-story">
    Each leave request shows the employee name, leave type (Annual Leave, Sick Leave, Emergency Leave, Casual Leave), dates requested, number of days, reason, and current status (Pending/Approved/Rejected). Once approved, the employee's attendance record updates automatically and the leave deduction feeds into payroll — no manual updates required. HR also has a full view of who is currently on leave, helping avoid resource conflicts during project-critical periods.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Leave Management</div></div>
    <img src="Crm screenshots/hrleavemanagement.png" alt="Leave Management"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--hr)"></span>Leave Management — leave request table with type, dates, days, reason, status and one-click approve/reject</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag hr">Leave request table: employee / type / dates / days / status</span>
    <span class="feat-tag hr">Leave types: Annual / Sick / Emergency / Casual / Unpaid</span>
    <span class="feat-tag hr">One-click Approve or Reject per request</span>
    <span class="feat-tag hr">Attendance record updates automatically on approval</span>
    <span class="feat-tag hr">Leave deduction feeds directly into payroll</span>
    <span class="feat-tag hr">Active leaves view — who is away right now</span>
    <span class="feat-tag hr">Leave balance tracking per employee</span>
    <span class="feat-tag hr">Department-level leave overlap warnings</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon hr">✅</div><div class="fli-body"><div class="fli-title">One-Click Approval Workflow</div><div class="fli-desc">HR sees all pending leave requests in one table and approves or rejects each with a single click. No emails, no forms, no back-and-forth — the entire process takes seconds.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">🔗</div><div class="fli-body"><div class="fli-title">Automatic Attendance &amp; Payroll Updates</div><div class="fli-desc">Approved leave automatically updates the employee's attendance record and feeds the deduction into payroll. HR doesn't touch two systems — one action updates everything.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">📅</div><div class="fli-body"><div class="fli-title">Active Leave Visibility</div><div class="fli-desc">See a live view of all employees currently on approved leave — helping HR and managers avoid scheduling meetings, demos, or deadlines on days when key people are away.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">⚠️</div><div class="fli-body"><div class="fli-title">Department Overlap Warnings</div><div class="fli-desc">Tapvera flags when multiple employees from the same department have overlapping leave requests — so HR can manage coverage and avoid operational gaps before approving.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- H3 — PAYSLIP MANAGEMENT -->
<div class="feat-block" id="hr-payslip">
  <div class="feat-num"><span class="num hr">3</span><span>HR Portal · Feature 3</span></div>
  <div class="feat-title">Payslip Management — From Two Days of Payroll Work to Under an Hour</div>
  <div class="feat-subtitle">Fully automated salary calculation, attendance-linked deductions, and one-click payslip generation — every employee's payslip ready and distributed without manual calculation.</div>
  <p class="feat-story">
    Payroll used to take the HR team two full days every month: pulling attendance data, calculating deductions, adjusting for leaves, generating individual payslips, and distributing them. <strong>Tapvera's Auto Payroll system completes all of this in under an hour.</strong> Salary structures are configured once per employee. Every month, the system calculates gross pay, applies attendance-linked deductions, accounts for leave days, processes TDS and PF, and generates all payslips automatically — ready for every employee to access instantly.
  </p>
  <p class="feat-story">
    The Payslip Management screen gives HR a complete overview: every employee's payslip status (Processed/Pending), salary breakdown, and the ability to generate or re-generate individual payslips. Once generated, each payslip appears automatically in the respective employee's "My Payslips" section — no distribution required, no emails to send.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Payslip Management</div></div>
    <img src="Crm screenshots/hrpayslipmanagement.png" alt="Payslip Management"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--hr)"></span>Payslip Management — all employee payslip statuses, salary breakdown, and auto-generation with one click</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag hr">Auto Payroll — generate all payslips in one click</span>
    <span class="feat-tag hr">Salary structure: Base + Bonus + Allowances</span>
    <span class="feat-tag hr">Attendance-linked deductions automatically applied</span>
    <span class="feat-tag hr">Leave deductions reflected in net pay</span>
    <span class="feat-tag hr">TDS and Provident Fund calculations</span>
    <span class="feat-tag hr">Payslip status: Processed / Pending per employee</span>
    <span class="feat-tag hr">Payroll completion progress tracker</span>
    <span class="feat-tag hr">Instant employee self-access after generation</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon hr">⚙️</div><div class="fli-body"><div class="fli-title">One-Click Payroll Generation</div><div class="fli-desc">Configure each employee's salary structure once. Every month, a single click generates all payslips — calculated, formatted, and distributed automatically to every employee.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">🔗</div><div class="fli-body"><div class="fli-title">Attendance-Linked Deductions</div><div class="fli-desc">The payroll engine reads attendance data directly — absent days, late penalties, and unpaid leave are all automatically reflected in each employee's net pay calculation. No manual adjustments.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">📊</div><div class="fli-body"><div class="fli-title">Payroll Completion Tracker</div><div class="fli-desc">A progress indicator shows how many payslips have been generated and sent this month — confirming that the payroll run is complete before the HR team closes the month.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">📤</div><div class="fli-body"><div class="fli-title">Instant Employee Self-Access</div><div class="fli-desc">The moment payslips are generated, they appear in each employee's My Payslips section automatically — no distribution, no attachments, no chasing from employees asking for their payslip.</div></div></div>
  </div>
  <div class="highlight">
    <p><strong>Real result:</strong> "What used to take the HR team two days every month now takes under an hour. Payslips are generated and distributed automatically — employees receive them without anyone having to chase."</p>
  </div>
</div>
<div class="divider"></div>

<!-- H4 — SHIFT MANAGEMENT -->
<div class="feat-block" id="hr-shift">
  <div class="feat-num"><span class="num hr">4</span><span>HR Portal · Feature 4</span></div>
  <div class="feat-title">Shift Management — Organise, Assign, and Adjust Work Schedules With Ease</div>
  <div class="feat-subtitle">A complete shift scheduling system that defines shift structures, assigns employees, handles flexible requests, and keeps attendance tied to the right schedule automatically.</div>
  <p class="feat-story">
    Businesses with multiple shift patterns — morning, evening, night, and flexible — need a scheduling system that doesn't create administrative overhead. Tapvera's Shift Management module lets HR define shift structures once and assign employees to the right schedule with a few clicks. <strong>Attendance tracking, overtime calculations, and payroll deductions all automatically respect each employee's assigned shift</strong> — no manual adjustments needed.
  </p>
  <p class="feat-story">
    HR can view the current shift assignments for all employees, create new shift patterns, update existing ones, and process shift change requests submitted by employees. Flexible shift requests — where an employee asks to temporarily change their schedule — flow through an approval workflow identical to leave requests, keeping the process structured and auditable.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Shift Management</div></div>
    <img src="Crm screenshots/shiftmanagement.png" alt="Shift Management"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--hr)"></span>Shift Management — shift definitions, employee assignments, schedule view and flexible shift request approvals</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag hr">Create and manage Morning / Evening / Night / Flexible shifts</span>
    <span class="feat-tag hr">Assign employees to specific shift patterns</span>
    <span class="feat-tag hr">View all employee shift assignments at once</span>
    <span class="feat-tag hr">Attendance auto-validates against assigned shift</span>
    <span class="feat-tag hr">Overtime tracking per shift</span>
    <span class="feat-tag hr">Flexible shift change request workflow</span>
    <span class="feat-tag hr">Shift change approval or rejection with one click</span>
    <span class="feat-tag hr">Payroll reflects shift-based deductions automatically</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon hr">⏰</div><div class="fli-body"><div class="fli-title">Multi-Shift Support</div><div class="fli-desc">Define any number of shift patterns — morning (9 AM–6 PM), evening (2 PM–11 PM), night (11 PM–8 AM), and flexible hours. Assign different employees to different shifts with no conflict.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">🔗</div><div class="fli-body"><div class="fli-title">Attendance Tied to Shift</div><div class="fli-desc">The attendance system validates each punch against the employee's assigned shift — flagging late arrivals, early departures, and overtime based on the correct schedule, not a one-size-fits-all rule.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">🔄</div><div class="fli-body"><div class="fli-title">Flexible Shift Request Flow</div><div class="fli-desc">Employees can request a temporary shift change through their portal. HR reviews and approves with one click — the schedule updates automatically, and no manual calendar editing is needed.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">💰</div><div class="fli-body"><div class="fli-title">Shift-Aware Payroll</div><div class="fli-desc">Shift differentials, overtime, and late deductions are all calculated based on each employee's actual shift assignment — payroll is always accurate regardless of how complex the schedule is.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- H5 — HOLIDAY MANAGEMENT -->
<div class="feat-block" id="hr-holiday">
  <div class="feat-num"><span class="num hr">5</span><span>HR Portal · Feature 5</span></div>
  <div class="feat-title">Holiday Management — Manage the Company Calendar, Keep Everyone Informed</div>
  <div class="feat-subtitle">A centralised holiday calendar that HR controls — add public holidays, company-specific off days, and regional events — visible to every employee automatically.</div>
  <p class="feat-story">
    Every year, HR spends time sending out holiday lists via email, updating shared calendars, and fielding questions about which days are off. Tapvera's Holiday Management module eliminates all of that. <strong>HR adds holidays once to the central calendar — and every employee sees them automatically</strong> in their leave and attendance views, with no additional communication required.
  </p>
  <p class="feat-story">
    The holiday calendar supports public holidays, company-specific days (Founder's Day, company anniversary), and regional events. Holidays are automatically excluded from leave calculations — an employee applying for leave over a holiday period won't have that day counted against their leave balance. The attendance system also recognises holidays and marks them correctly without manual intervention.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Holiday Management</div></div>
    <img src="Crm screenshots/Holidaymanagement.png" alt="Holiday Management"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--hr)"></span>Holiday Management — company holiday calendar with add/edit/delete controls, visible to all employees</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag hr">Centralised holiday calendar managed by HR</span>
    <span class="feat-tag hr">Public holidays, company days, regional events</span>
    <span class="feat-tag hr">Add, edit, delete holidays with instant effect</span>
    <span class="feat-tag hr">Holidays auto-excluded from leave calculations</span>
    <span class="feat-tag hr">Attendance system marks holidays automatically</span>
    <span class="feat-tag hr">All employees see holidays in their leave view</span>
    <span class="feat-tag hr">Holiday list visible from employee sidebar</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon hr">📅</div><div class="fli-body"><div class="fli-title">Centralised Holiday Control</div><div class="fli-desc">HR manages the company holiday calendar from one place. Add a national holiday, update its name, or remove an incorrect entry — changes reflect everywhere immediately with no employee action required.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">🔗</div><div class="fli-body"><div class="fli-title">Smart Leave Calculation</div><div class="fli-desc">When an employee applies for leave that overlaps with a public holiday, the system automatically excludes the holiday from the leave day count — so employees don't waste leave days on days they weren't working anyway.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">👁️</div><div class="fli-body"><div class="fli-title">Visible to Every Employee</div><div class="fli-desc">Employees can view the full holiday list from their portal sidebar at any time — no more emailing HR to ask "is the 26th a holiday?" The answer is always visible and always current.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon hr">✅</div><div class="fli-body"><div class="fli-title">Attendance Auto-Marks Holidays</div><div class="fli-desc">The attendance system recognises company holidays and marks them correctly in each employee's record — no HR staff need to manually update attendance for days the whole company was off.</div></div></div>
  </div>
</div>
</div><!-- end hr -->
<div class="divider"></div>


<!-- ════════════════════════════════════════
     ●  SUPER ADMIN PORTAL
════════════════════════════════════════ -->
<div id="superadmin">
<div class="sec-header sa">
  <div class="sec-badge sa"><span class="sec-dot"></span>Part Four · Super Admin Portal</div>
  <div class="sec-h">The <em class="sa">Super Admin Experience</em></div>
  <p class="sec-desc">The highest level of access in Tapvera — a full business dashboard with complete data visibility, and a live employee status monitor showing exactly who is working, on break, or offline at any moment.</p>
  <div class="sec-modules">
    <span class="sec-mod">Full Business Dashboard</span><span class="sec-mod">Live Employee Status</span>
    <span class="sec-mod">All-Role Access</span><span class="sec-mod">System Configuration</span>
    <span class="sec-mod">Complete Data Visibility</span>
  </div>
</div>

<!-- SA1 — SUPER ADMIN DASHBOARD -->
<div class="feat-block" id="sa-dash">
  <div class="feat-num"><span class="num sa">1</span><span>Super Admin · Feature 1</span></div>
  <div class="feat-title">Super Admin Dashboard — The Complete Business Overview</div>
  <div class="feat-subtitle">Log in as Super Admin and see the full picture — employees, attendance, projects, revenue, and leads — all live, all in one screen, with access to every module in the system.</div>
  <p class="feat-story">
    The Super Admin is the business owner or managing director — the person who needs to see everything, not just their department's slice. Tapvera's Super Admin Dashboard delivers a <strong>complete business overview the moment you log in</strong>: how many people are in today, which projects are active, what the revenue trend looks like, and how the lead pipeline is performing — all on one screen.
  </p>
  <p class="feat-story">
    Beyond the dashboard numbers, the Super Admin has access to every module in the system — Employee Management, HR, Projects, Clients, Leads, Payroll, Shifts, Holidays, Notices, Call Logs, Transfers, and more. No feature is hidden, no data is gated. This is the control centre for the entire business — designed for the person who needs the full picture to make confident, fast decisions.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Super Admin Dashboard</div></div>
    <img src="Crm screenshots/Superadmindashboard.png" alt="Super Admin Dashboard"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--sa)"></span>Super Admin Dashboard — complete business overview with full access to all modules and live data</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag sa">Complete business overview on login</span>
    <span class="feat-tag sa">Access to every module in the system</span>
    <span class="feat-tag sa">Live attendance and employee status</span>
    <span class="feat-tag sa">Revenue trends and project health</span>
    <span class="feat-tag sa">Lead pipeline and conversion metrics</span>
    <span class="feat-tag sa">No data gated — full visibility across all roles</span>
    <span class="feat-tag sa">System configuration and role management</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon sa">👑</div><div class="fli-body"><div class="fli-title">Full System Access</div><div class="fli-desc">Super Admin can access every module, every record, and every report in the system. No feature is restricted — this is the complete view that only the business owner should have.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon sa">📊</div><div class="fli-body"><div class="fli-title">Live Business Metrics</div><div class="fli-desc">Attendance counts, project status, revenue trends, and lead conversion rates — all updated in real time on the dashboard. No refreshing, no manual pulls, no stale reports.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon sa">🛠️</div><div class="fli-body"><div class="fli-title">System Configuration</div><div class="fli-desc">Super Admin controls system-level settings — role assignments, employee onboarding, module permissions, and platform configuration — that are not accessible to any other role.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon sa">🔐</div><div class="fli-body"><div class="fli-title">Role-Based Access Management</div><div class="fli-desc">Assign and change employee roles — Employee, Admin, HR, or Super Admin — from the system settings. Every role assignment takes effect immediately, updating the employee's interface on next login.</div></div></div>
  </div>
</div>
<div class="divider"></div>

<!-- SA2 — LIVE EMPLOYEE STATUS -->
<div class="feat-block" id="sa-status">
  <div class="feat-num"><span class="num sa">2</span><span>Super Admin · Feature 2</span></div>
  <div class="feat-title">Live Employee Status — See Every Person's Work Status in Real Time</div>
  <div class="feat-subtitle">A live monitoring dashboard showing every employee's current status — Working, On Break, or Offline — with arrival times, work durations, and break durations updating in real time.</div>
  <p class="feat-story">
    As a business owner, knowing whether your team is at work right now — without calling anyone or checking a spreadsheet — is a fundamental operational need. Tapvera's Live Employee Status monitor gives the Super Admin a <strong>real-time dashboard showing every employee's current state</strong>: who clocked in and when, how long they've been working, how much break time they've taken, and who hasn't arrived yet — all on one screen.
  </p>
  <p class="feat-story">
    Employees are sorted by status priority — Working first, then On Break, then Offline — so the most relevant information is always at the top. The Super Admin can filter by status, search by name, and view historical data for any date. Summary stats at the top show total employees working, on break, and absent — giving an attendance pulse with a single glance, any time of day.
  </p>
  <div class="screenshot-wrap">
    <div class="screenshot-bar"><div class="sb-dots"><span class="sb-dot r"></span><span class="sb-dot y"></span><span class="sb-dot g"></span></div><div class="sb-url">web.tapvera.io · Live Employee Status</div></div>
    <img src="Crm screenshots/empstatus.png" alt="Live Employee Status"/>
    <div class="screenshot-caption"><span class="caption-dot" style="background:var(--sa)"></span>Live Employee Status — real-time monitor showing Working / On Break / Offline status, arrival times and work durations</div>
  </div>
  <div class="feat-tags">
    <span class="feat-tag sa">Real-time Working / On Break / Offline status per employee</span>
    <span class="feat-tag sa">Arrival time and total work duration per person</span>
    <span class="feat-tag sa">Break duration tracked and displayed live</span>
    <span class="feat-tag sa">Employees sorted by status priority</span>
    <span class="feat-tag sa">Filter by status or search by name</span>
    <span class="feat-tag sa">Summary stats: total working, on break, absent</span>
    <span class="feat-tag sa">Historical data — view any past date</span>
    <span class="feat-tag sa">Card view and table view toggle</span>
  </div>
  <div class="feat-list">
    <div class="feat-list-item"><div class="fli-icon sa">🟢</div><div class="fli-body"><div class="fli-title">Real-Time Status Updates</div><div class="fli-desc">The dashboard updates automatically — the moment an employee punches in, their status changes from Offline to Working. No page refresh needed. The business owner always sees current state.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon sa">⏱️</div><div class="fli-body"><div class="fli-title">Work and Break Duration Tracking</div><div class="fli-desc">For every employee currently working, see exactly how long they've been working today and how much total break time they've taken — updated live as minutes tick by.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon sa">📊</div><div class="fli-body"><div class="fli-title">Instant Attendance Summary</div><div class="fli-desc">The four summary cards at the top — Total Working, On Break, Absent, Attendance Rate — give a complete attendance pulse at a glance. No calculation, no report generation needed.</div></div></div>
    <div class="feat-list-item"><div class="fli-icon sa">📅</div><div class="fli-body"><div class="fli-title">Historical Status Lookup</div><div class="fli-desc">Switch the date picker to any past date and see the attendance status, arrival times, and work durations for that day — a complete historical record going back as far as the data exists.</div></div></div>
  </div>
</div>
</div><!-- end superadmin -->
<div class="divider"></div>


<!-- ════════════════════════════
     CLOSING
════════════════════════════ -->
<div class="closing">
  <div class="closing-grid"></div>
  <div class="closing-inner">
    <div class="cl-title">One Platform.<br/>Every Person. Every Process.</div>
    <p class="cl-sub">Tapvera CRM is the operating system for your company — from the first punch-in of the day to the last deal closed. Every workflow is designed to save time, reduce errors, and help your people do their best work.</p>
    <div class="cl-roles">
      <div class="cl-role"><div class="cl-role-n" style="color:var(--emp)">Employee</div><div class="cl-role-d">13 personal modules</div></div>
      <div class="cl-role"><div class="cl-role-n" style="color:var(--adm)">Admin</div><div class="cl-role-d">9 operational modules</div></div>
      <div class="cl-role"><div class="cl-role-n" style="color:var(--hr)">HR</div><div class="cl-role-d">5 people management tools</div></div>
      <div class="cl-role"><div class="cl-role-n" style="color:var(--sa)">Super Admin</div><div class="cl-role-d">Complete system control</div></div>
    </div>
    <div class="cl-credit">Built by <span>Tapvera Technologies Pvt. Ltd.</span> &middot; web.tapvera.io &middot; April 2026</div>
  </div>
</div>

</div><!-- end .doc -->

<script>
// smooth scroll for TOC links is handled inline
// print shortcut
document.addEventListener('keydown', function(e){
  if((e.ctrlKey||e.metaKey)&&e.key==='p'){window.print()}
})
</script>
</body>
</html>`;

const finalHtml = fileStart + newSections;
fs.writeFileSync('C:/Users/WIN/Desktop/newcrm/tapveraCrm/tapvera-showcase.html', finalHtml);
console.log('Done! Lines:', finalHtml.split('\n').length);
