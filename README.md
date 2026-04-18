# ⚡ Clarion — AI-Powered Complaint Classification Engine

An intelligent complaint classification & resolution recommendation system built for the **Tark Shaastra Hackathon (TS-14)**.

## Features

- 🤖 **AI-Powered Classification** — Uses Claude Sonnet 4 to intelligently classify complaints
- 📊 **Real-Time Dashboard** — Interactive charts (Pie, Bar, Line) with live stats
- ⏱️ **SLA Tracking** — Live countdown timers with breach detection
- 📋 **Complaint Lifecycle** — Track Open → In Progress → Resolved status
- 📄 **Export** — Download reports as CSV or PDF
- 🔄 **Fallback Mode** — Keyword-based classification when AI is unavailable
- 🌙 **Dark Theme** — Beautiful Catppuccin-inspired design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS v4 |
| Backend | Node.js, Express.js |
| AI | Anthropic Claude Sonnet 4 |
| Charts | Recharts |
| Export | jsPDF + PapaParse |
| Data | In-memory + localStorage |

## Setup

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Add API Key

Create `backend/.env` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=5000
```

### 3. Run the App

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/classify` | Submit & classify a complaint |
| GET | `/api/complaints` | Get all complaints |
| PATCH | `/api/complaints/:id/status` | Update complaint status |
| DELETE | `/api/complaints/:id` | Delete a complaint |

## Project Structure

```
├── backend/
│   ├── server.js        # Express API + Claude integration
│   ├── .env             # API keys
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ComplaintForm.tsx      # Submission form + result card
│   │   │   ├── Dashboard.tsx          # Analytics + charts
│   │   │   ├── ComplaintHistory.tsx   # Sortable/filterable table
│   │   │   ├── SLABadge.tsx           # Live SLA countdown
│   │   │   ├── ExportButtons.tsx      # CSV + PDF export
│   │   │   └── ToastContainer.tsx     # Notifications
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css    # Design system
│   ├── index.html
│   └── vite.config.ts
└── README.md
```

## License

Built for TS-14 Hackathon.

