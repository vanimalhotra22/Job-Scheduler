# Distributed Job Scheduler

A production-inspired, highly reliable, and self-contained distributed job scheduling platform capable of executing asynchronous background jobs across multiple worker nodes. 

Built with **Node.js, Express, TypeScript, SQLite (WAL mode), and React (Vite)**, the project features atomic job claiming, worker heartbeats, automated retry backoff calculations, dead worker recovery, and a premium observability dashboard.

---

## 🛠️ Tech Stack & Key Features

* **Backend Engine**: Express + TypeScript with a robust, custom repository pattern.
* **Database & Concurrency**: SQLite with WAL (Write-Ahead Logging) and `BEGIN IMMEDIATE` transaction locking to guarantee atomic claims and strictly enforce queue concurrency limits without duplicate execution.
* **Decoupled Workers**: Standalone worker scripts that auto-register, send periodic heartbeats (CPU & RAM usage), poll for tasks, and support graceful shutdowns.
* **Fault Tolerance**: Automatic worker crash detection and stranded job reclaiming.
* **Flexible Scheduling**: Immediate, delayed, batch, and recurring cron jobs.
* **Retry Strategies**: Fixed delay, linear backoff, and exponential backoff calculations.
* **Observability Dashboard**: React + TypeScript + Vanilla CSS featuring custom SVG sparklines for real-time throughput metrics, queue toggles, and live audit logs.
* **Testing**: Comprehensive, dependency-free integration test suite.

---

## 📁 Folder Structure

```
distributed-job-scheduler/
├── backend/                   # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── controllers/       # REST API Handlers (Auth, Jobs, Queues, Workers, Metrics)
│   │   ├── database/          # SQLite Connection & Seed Scripts
│   │   ├── middleware/        # JWT Authentication & Role Validators
│   │   ├── routes/            # Route declarations
│   │   ├── services/          # Scheduler loop, Worker reclaimer, Retry engine
│   │   ├── test/              # Integration and Concurrency test suite
│   │   ├── worker.ts          # Standalone Worker Daemon script
│   │   └── index.ts           # Server start entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/                  # React + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── App.tsx            # Integrated dashboard UI
│   │   ├── index.css          # Design system & glassmorphism theme
│   │   └── main.tsx
│   ├── package.json
│   └── tsconfig.json
├── docs/                      # Architectural, ER, and API Documentation
│   ├── architecture.md
│   ├── design_decisions.md
│   ├── er_diagram.md
│   └── api_docs.md
└── README.md                  # Setup and execution guide
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher (v26.2.0 recommended)
* **NPM**: v9.0.0 or higher

---

### Step 1: Install Dependencies
Run `npm install` inside both the backend and frontend directories:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

### Step 2: Run the API Server
Start the Express API server in development mode. On startup, the database file `backend/data/scheduler.db` will be initialized, schemas migrated, and default seed data inserted automatically.

```bash
cd backend
npm run dev
```

* **API URL**: `http://localhost:5000`
* **Default Credentials**: `admin@scheduler.com` / `admin123`

---

### Step 3: Launch Standalone Worker Node(s)
Open a new terminal window and launch the worker script. The worker automatically registers with the server, starts sending heartbeats, and polls for jobs.

```bash
cd backend
npm run worker
```

* *Tip*: You can run this command in multiple terminal windows concurrently to test distributed claiming!

---

### Step 4: Run the Web Dashboard
Start the Vite development server for the React UI.

```bash
cd frontend
npm run dev
```

* **Dashboard URL**: `http://localhost:5173` (or as shown in the console)

---

## 🧪 Running Automated Tests

We have written an integration test suite validating user logins, queue configs, atomic claim transactions (preventing duplicates), backoff retries, and crashed worker reclaim states.

To execute the tests:

```bash
cd backend
npm run test
```
