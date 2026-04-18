import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
import ComplaintForm from "./components/ComplaintForm";
import Dashboard from "./components/Dashboard";
import ComplaintHistory from "./components/ComplaintHistory";
import Analysis from "./components/Analysis";
import ToastContainer from "./components/ToastContainer";

export interface Complaint {
  id: string;
  complaint: string;
  category: "Product Issue" | "Packaging Issue" | "Trade Inquiry";
  priority: "High" | "Medium" | "Low";
  reasoning: string;
  recommendation: string;
  status: "Open" | "In Progress" | "Resolved";
  timestamp: string;
  slaDeadline: string;
  statusHistory: { status: string; at: string }[];
  resolvedAt: string | null;
  fallback: boolean;
  source?: "Manual" | "CSV" | "Excel";
  sentiment?: "positive" | "negative" | "neutral" | "neutral/skip";
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: "" },
  { key: "submit", label: "Add Complaint", icon: "" },
  { key: "history", label: "Complaint History", icon: "" },
  { key: "analysis", label: "Analysis", icon: "" },
];

const LOCAL_KEY = "clarion_data";

function loadFromLocal(): Complaint[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLocal(data: Complaint[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

export default function App() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [complaints, setComplaints] = useState<Complaint[]>(loadFromLocal);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Sync to localStorage on every change
  useEffect(() => {
    saveToLocal(complaints);
  }, [complaints]);

  // Hydrate from backend on mount
  useEffect(() => {
    fetch("/api/complaints")
      .then((r) => r.json())
      .then((data: Complaint[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setComplaints((prev) => {
            const ids = new Set(prev.map((c) => c.id));
            const merged = [...prev];
            for (const c of data) {
              if (!ids.has(c.id)) merged.push(c);
            }
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const addComplaint = useCallback((c: Complaint) => {
    setComplaints((prev) => [c, ...prev]);
    addToast("Complaint classified successfully!", "success");
  }, [addToast]);

  const updateStatus = useCallback(
    async (id: string, status: "Open" | "In Progress" | "Resolved") => {
      try {
        const res = await fetch(`/api/complaints/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error("Failed");
        const updated: Complaint = await res.json();
        setComplaints((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
        );
        addToast(`Status updated to ${status}`, "success");
      } catch {
        // Fallback: update locally
        setComplaints((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            const now = new Date().toISOString();
            return {
              ...c,
              status,
              statusHistory: [...c.statusHistory, { status, at: now }],
              resolvedAt: status === "Resolved" ? now : c.resolvedAt,
            };
          })
        );
        addToast(`Status updated to ${status} (offline)`, "success");
      }
    },
    [addToast]
  );

  const deleteComplaint = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/complaints/${id}`, { method: "DELETE" });
      } catch {
        // ignore
      }
      setComplaints((prev) => prev.filter((c) => c.id !== id));
      addToast("Complaint deleted", "success");
    },
    [addToast]
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{display: 'inline-block', verticalAlign: 'text-bottom'}}><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" /></svg> Clarion</h1>
          <span className="subtitle">AI-Powered Complaint Classification Engine</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span className="badge badge-low">{complaints.length} total</span>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              fontSize: 12, fontFamily: "'Sora', sans-serif",
              fontWeight: 300, color: '#546E7A'
            }}>
              {user?.email}
            </span>

            <button onClick={signOut} style={{
              background: 'transparent',
              border: '1px solid #1E3A42',
              borderRadius: 7,
              padding: '6px 14px',
              fontFamily: "'Sora', sans-serif",
              fontWeight: 500,
              fontSize: 12,
              color: '#90A4AE',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#EF5350'
              e.currentTarget.style.color = '#EF5350'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#1E3A42'
              e.currentTarget.style.color = '#90A4AE'
            }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="nav-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`nav-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "submit" && (
        <ComplaintForm onSubmit={addComplaint} onError={(msg) => addToast(msg, "error")} />
      )}
      {tab === "dashboard" && <Dashboard complaints={complaints} />}
      {tab === "history" && (
        <ComplaintHistory
          complaints={complaints}
          onStatusChange={updateStatus}
          onDelete={deleteComplaint}
        />
      )}
      {tab === "analysis" && (
        <Analysis complaints={complaints} onError={(msg) => addToast(msg, "error")} />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}

