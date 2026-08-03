# TapveraCRM

A full-stack HR and CRM platform for managing employees, clients, projects, attendance, payroll, and leads — built for Indian businesses with IST-first design.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Role System](#role-system)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Attendance System](#attendance-system)
- [Biometric Integration](#biometric-integration)
- [Payroll System](#payroll-system)
- [Access Management](#access-management)
- [Real-time Features](#real-time-features)
- [File Storage](#file-storage)
- [Email & Notifications](#email--notifications)

---

## Overview

TapveraCRM is a monorepo containing a Node.js/Express REST API (`server/`) and a React SPA (`client/`). It handles the full employee lifecycle — from onboarding and daily attendance to payroll generation and client management — with a real-time dashboard, granular permission controls, and fingerprint terminal integration.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, Redux Toolkit, React Router 7 |
| Backend | Node.js, Express 4 |
| Database | MongoDB (Mongoose 8) |
| Real-time | Socket.IO 4 + Redis adapter (ioredis) |
| Auth | JWT (jsonwebtoken) |
| File storage | AWS S3 + CloudFront CDN |
| Email | Nodemailer (Gmail SMTP) |
| AI analytics | OpenRouter API |
| Charts | Recharts, Chart.js |
| PDF generation | PDFKit, jsPDF |
| Biometric | ZKTeco / Identix ADMS iClock protocol |
| Google APIs | Sheets API (service account) |
| SEO tracking | SerpAPI + Playwright fallback |
| Deployment | AWS Elastic Beanstalk (backend), S3/CloudFront (frontend) |

---

## Features

### HR Management
- Employee registration, profiles, and directory
- Department and position hierarchy with numeric level ordering
- Shift management — fixed, flexible, night shifts
- Leave requests with approval workflow
- Holiday calendar management
- Manual and biometric attendance management
- Payslip generation and employee payslip portal
- Automatic payroll (salary generation from attendance records)
- Transfer management between departments

### Attendance
- Daily punch in/out with live status dashboard
- Break tracking (start/end break sessions)
- Shift-aware date assignment (night shifts handled correctly)
- Late arrival detection and overtime tracking
- Manual attendance corrections by admin/HR
- Biometric fingerprint terminal sync (ZKTeco iClock/ADMS protocol)
- Attendance analytics with AI-generated insights
- Monthly attendance reports with exception details

### CRM
- Lead management with Kanban board
- Callback scheduling and calendar view
- Client management with remarks and quote/support request portal
- Project management with task assignment and team collaboration
- Communication tracking per project
- Call intelligence and call recording support
- Lead/callback transfer between employees

### Access & Permissions
- Four built-in roles: Super Admin, Admin, HR, Employee
- Position-based permission flags (granular, per-position)
- Delegated access management — managers can grant a subset of their own permissions to subordinates
- Hierarchical data scoping (own / subordinate / department / all)
- Access audit log for every permission change

### Other
- Real-time notifications (in-app + browser push)
- Internal chat / messaging
- Shared notepad (per user + super admin viewer)
- Shared Google Sheets integration
- Notice board
- Todo / task management
- Client portal (separate login, limited view)
- AI attendance analytics (via OpenRouter)
- SEO keyword rank tracking with SerpAPI + Playwright
- Blog and backlink management
- WhatsApp Business API notifications
- Screenshot capture (Playwright)
- Achievements / celebration system

---

## Role System

| Role | Description |
|---|---|
| `super-admin` | Full access to all data, pages, and admin tools |
| `admin` | Company-wide operational access; can be scoped via Position |
| `hr` | HR operations: attendance, payroll, leaves, shifts, employees |
| `employee` | Own data only; elevated access via Position permission flags |
| `client` | Read-only client portal (projects, tasks, communication) |

Permissions are resolved at runtime from the employee's assigned **Position** document, with optional per-user overrides. The single source of truth for what each flag means lives in `server/utils/accessControl.js`.

---

## Project Structure

```
tapveraCrm/
├── client/                     # React frontend (Vite)
│   └── src/
│       ├── pages/              # Route-level page components
│       │   ├── admin/          # Admin-only pages (payroll, access, biometric…)
│       │   └── …
│       ├── components/         # Shared UI components
│       │   └── dashboard/Sidebar.jsx
│       ├── contexts/           # React context providers (Theme, WebSocket, Achievement)
│       ├── hooks/              # Custom hooks
│       ├── store/              # Redux slices
│       └── utils/              # timeUtils, browserNotifications, …
│
└── server/                     # Express backend
    ├── app.js                  # Entry point — mounts all routes
    ├── config/                 # Redis connection
    ├── controllers/            # Request handlers
    ├── middlewares/            # authMiddleware, authorize, …
    ├── models/                 # Mongoose schemas
    ├── routes/                 # Express routers
    ├── services/               # Business logic
    │   ├── AttendanceService.js
    │   └── biometric/
    │       ├── AdmsParser.js           # Pure iClock protocol parser
    │       └── BiometricAttendanceService.js
    ├── socket/                 # Socket.IO setup
    ├── utils/
    │   ├── accessControl.js    # Central permission engine
    │   └── hierarchyUtils.js   # Subordinate / department ID resolution
    └── scripts/                # One-time migration scripts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB 6+)
- Redis 6+ (local or AWS ElastiCache)
- A Gmail account with an App Password (for email)

### Install

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### Configure

```bash
cp server/.env.example server/.env
# Fill in the required variables (see Environment Variables below)
```

Create `client/.env`:

```
VITE_API_BASE=http://localhost:5000
```

### Run

```bash
# Backend (from /server)
npm run dev      # nodemon

# Frontend (from /client)
npm run dev      # Vite dev server — http://localhost:5173
```

---

## Environment Variables

All backend variables live in `server/.env`. Copy `server/.env.example` and fill in:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `REDIS_URL` | Yes | Redis URL for Socket.IO adapter |
| `PORT` | No | Server port (default: 5000; use 8081 on Elastic Beanstalk) |
| `FRONTEND_URL` | Yes (prod) | Your production frontend origin (for CORS) |
| `NODE_ENV` | No | `development` or `production` |
| `EMAIL_HOST` | Yes | SMTP host (e.g. `smtp.gmail.com`) |
| `EMAIL_PORT` | Yes | SMTP port (587) |
| `EMAIL_USER` | Yes | Gmail address |
| `EMAIL_PASS` | Yes | Gmail App Password (16-char, not your login password) |
| `AWS_ACCESS_KEY_ID` | Optional | For S3 file uploads |
| `AWS_SECRET_ACCESS_KEY` | Optional | For S3 file uploads |
| `AWS_REGION` | Optional | S3 region |
| `AWS_S3_BUCKET_NAME` | Optional | S3 bucket |
| `CLOUDFRONT_DOMAIN` | Optional | CloudFront CDN domain for file URLs |
| `WHATSAPP_ACCESS_TOKEN` | Optional | Meta WhatsApp Business API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | Meta WhatsApp phone number ID |
| `ADMIN_NUMBERS` | Optional | Comma-separated admin WhatsApp numbers |
| `OPENROUTER_API_KEY` | Optional | AI analytics (attendance insights) |
| `SERPAPI_KEY` | Optional | SEO keyword rank tracking |
| `GOOGLE_PRIVATE_KEY` | Optional | Google Sheets service account |
| `GOOGLE_CLIENT_EMAIL` | Optional | Google Sheets service account email |
| `ENCRYPTION_KEY` | Optional | 32-char key for encrypting per-user email passwords |
| `BIOMETRIC_DEVICE_TIMEZONE` | No | IANA timezone for fingerprint terminals (default: `Asia/Kolkata`) |
| `BIOMETRIC_MIN_PUNCH_GAP_SECONDS` | No | Minimum gap to collapse re-scans (default: 90) |

---

## API Overview

All routes are prefixed with `/api` except the biometric terminal endpoints which live at `/iclock`.

| Prefix | Description |
|---|---|
| `/api/auth` | Login, signup, token refresh |
| `/api/users` | Employee CRUD, profile, permissions |
| `/api/departments` | Department management |
| `/api/positions` | Position / role management and delegated access |
| `/api/attendance` | Daily punch events (new date-centric system) |
| `/api/admin/attendance` | Admin attendance overrides |
| `/api/manual-attendance` | HR manual attendance corrections |
| `/api/super-admin` | Live workforce dashboard data |
| `/api/super-admin/attendance` | Attendance portal (per-employee monthly view) |
| `/api/payslips` | Payslip generation and retrieval |
| `/api/auto-payroll` | Automatic payroll run |
| `/api/leaves` | Leave requests and approvals |
| `/api/shifts` | Shift definitions and employee assignments |
| `/api/holidays` | Holiday calendar |
| `/api/clients` | Client management |
| `/api/client-requests` | Client quote and support requests |
| `/api/projects` | Project management |
| `/api/tasks` | Task assignment and updates |
| `/api/leads` | Lead management |
| `/api/callbacks` | Callback scheduling |
| `/api/transfers` | Lead/callback transfers |
| `/api/notifications` | In-app notifications |
| `/api/messages` | Internal messaging |
| `/api/notepad` | Per-user notepad |
| `/api/sheets` | Google Sheets integration |
| `/api/notices` | Company notice board |
| `/api/biometric` | Biometric device management (admin API) |
| `/iclock` | ZKTeco / Identix ADMS protocol endpoints (plain text, device-facing) |

---

## Attendance System

Attendance is stored in a date-centric `AttendanceRecord` model where each document represents one calendar day and contains all employee punch events for that day. Derived fields (work duration, late status, overtime, current status) are recalculated synchronously on every punch.

Key design decisions:

- **IST-first**: All shift comparisons and date assignments use `Asia/Kolkata` via `Intl.DateTimeFormat`. Timestamps are stored as UTC and converted on read.
- **Night shift handling**: A punch at 01:00 IST is assigned to the previous day's record when the employee's shift spans midnight.
- **Transaction safety**: Every punch goes through a MongoDB session/transaction to prevent race conditions from near-simultaneous scans.
- **Single calculation path**: In-app punches, manual admin corrections, and biometric device pushes all go through `AttendanceService.recordPunchEvent` — one source of truth.

---

## Biometric Integration

TapveraCRM supports ZKTeco / Identix fingerprint terminals that speak the **ADMS / iClock push protocol**.

### How it works

1. The terminal is configured with the server's IP and the path `/iclock`.
2. On boot (and periodically), the device sends a `GET /iclock/cdata` handshake. The server replies with a plain-text config block (`TimeZone=5.5`, `Realtime=1`, etc.).
3. On each finger scan, the device pushes a `POST /iclock/cdata?table=ATTLOG` with a tab-delimited row: `PIN  DateTime  Status  VerifyMode`.
4. `AdmsParser.parseAttlog()` converts the device's local wall-clock timestamp to UTC using the `deviceTimeToUtc` helper (IANA timezone aware, no external dependencies).
5. `BiometricAttendanceService.processAttlogBatch()` maps each PIN to a CRM employee, deduplicates rapid re-scans, infers PUNCH_IN vs PUNCH_OUT from the employee's current state, and hands off to `AttendanceService.recordPunchEvent`.
6. Every raw device row is persisted to `BiometricPunch` before interpretation, so bad mappings can be replayed without data loss.

### Employee PIN mapping

In the admin panel under **Biometric Device Management**, each employee is assigned the numeric PIN that matches their fingerprint enrolment on the terminal.

---

## Payroll System

### Auto Payroll

`POST /api/auto-payroll/generate` runs a payroll calculation for a given month:

- Pulls attendance records to count working days, present days, LWP (leave without pay) days
- Applies configured salary components (basic, HRA, allowances, deductions)
- Generates a payslip PDF per employee
- Stores the result in the `Payslip` collection

### Manual Adjustment

The **Salary Management** page lets HR view generated payslips, make line-item adjustments, and mark them as finalised before they appear in the employee's payslip portal.

### Employee Payslips

Employees access their own payslips at `/my-payslips`. Each payslip includes a breakdown of earnings, deductions, and net pay, and can be downloaded as a PDF.

---

## Access Management

Permissions are modelled on the `Position` document (`server/models/Position.js`). Each Position carries a set of boolean flags:

```
canManageUsers          canManageClients        canManageProjects
canAssignTasks          canApproveLeaves        canApproveShifts
canViewReports          canManageAttendance     canManageSalary
canViewCommunicationTracking    canManageDepartments    canManagePositions
canViewSubordinateLeads         canViewSubordinateTasks …
canManageSubordinateAccess      (enables delegated access editing)
```

The `server/utils/accessControl.js` module is the single choke point for "can user X do Y?". It resolves the user's Position, merges any per-user `permissionOverrides`, and evaluates against `ACTION_PERMISSION_MAP`. Super Admin bypasses all checks.

Delegated access (the **My Team's Access** page) lets a manager with `canManageSubordinateAccess` grant flags from their own set to their direct subordinates — subject to a ceiling rule (you cannot grant what you don't hold) and a scope rule (target must be within your hierarchy and at a strictly lower level).

Every permission change is recorded in `AccessAuditLog` for audit purposes.

---

## Real-time Features

Socket.IO is used for:

- **Live attendance dashboard** — the super admin workforce page updates instantly when any employee punches in/out or starts/ends a break
- **In-app notifications** — task assignments, leave approvals, payslip availability, etc.
- **Chat / messaging** — internal one-to-one and group messages
- **Project events** — task status changes broadcast to project members

Redis is required as the Socket.IO adapter so real-time events work correctly across multiple server instances.

---

## File Storage

File uploads (profile photos, project attachments, payslip PDFs) are stored in **AWS S3**. When `CLOUDFRONT_DOMAIN` is set, files are served through CloudFront for faster delivery.

If S3 is not configured, uploads fall back to local disk storage in `server/uploads/`.

---

## Email & Notifications

- **Email**: Nodemailer with Gmail SMTP (App Password). Used for password resets, payslip delivery, and leave approval notifications.
- **WhatsApp**: Meta WhatsApp Business API. Used for task notifications and help-desk alerts to admin numbers.
- **In-app**: Real-time via Socket.IO + a persistent `Notification` collection.
- **Browser push**: Web Notifications API for foreground/background alerts.
