import { useState, useMemo, Fragment } from "react";
import type { Complaint } from "../App";
import SLABadge from "./SLABadge";
import ExportButtons from "./ExportButtons";

interface Props {
  complaints: Complaint[];
  onStatusChange: (id: string, status: "Open" | "In Progress" | "Resolved") => void;
  onDelete: (id: string) => void;
}

type SortKey = "timestamp" | "category" | "priority" | "status" | "slaDeadline" | "sentiment";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export default function ComplaintHistory({ complaints, onStatusChange, onDelete }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSentiment, setFilterSentiment] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const filtered = useMemo(() => {
    let data = [...complaints];

    if (filterCategory !== "All") data = data.filter((c) => c.category === filterCategory);
    if (filterPriority !== "All") data = data.filter((c) => c.priority === filterPriority);
    if (filterStatus !== "All") data = data.filter((c) => c.status === filterStatus);
    if (filterSentiment !== "All") data = data.filter((c) => (c.sentiment?.toLowerCase() || "unknown") === filterSentiment.toLowerCase());

    data.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "timestamp":
          cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "priority":
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "sentiment": {
          const sA = a.sentiment?.toLowerCase() || "unknown";
          const sB = b.sentiment?.toLowerCase() || "unknown";
          const ordA = sA === "positive" ? 0 : sA === "neutral" ? 1 : sA === "negative" ? 2 : 3;
          const ordB = sB === "positive" ? 0 : sB === "neutral" ? 1 : sB === "negative" ? 2 : 3;
          cmp = ordA - ordB;
          break;
        }
        case "slaDeadline":
          cmp = new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return data;
  }, [complaints, filterCategory, filterPriority, filterStatus, filterSentiment, sortKey, sortDir]);

  const basePill = {
    fontFamily: "var(--font-title)",
    fontWeight: 500,
    fontSize: "11px",
    letterSpacing: "0.04em",
    padding: "4px 10px",
    borderRadius: "6px",
    display: "inline-block"
  };

  const priorityBadge = (p: string) => {
    let bg = "#1B3A2A";
    let col = "#4CAF50";
    if (p === "High") { bg = "#3B1A1A"; col = "#EF5350"; }
    else if (p === "Medium") { bg = "#3B2A1A"; col = "#FFA726"; }
    return <span style={{ ...basePill, background: bg, color: col }}>{p}</span>;
  };

  const categoryBadge = (c: string) => {
    return <span style={{ ...basePill, background: "var(--color-bg-tertiary)", color: "var(--color-accent)", border: "1px solid var(--color-border)" }}>{c}</span>;
  };

  const statusBadge = (s: string) => {
    return <span style={{ ...basePill, background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>{s}</span>;
  };

  const sourceBadge = (source?: string) => {
    const s = source || "Manual";
    let bg = "#1A2F3A";
    let col = "#5BA3C9";
    if (s === "CSV") { bg = "#1A2A1A"; col = "#5BC95B"; }
    else if (s === "Excel") { bg = "#2A1A2A"; col = "#C95BC9"; }
    return <span style={{ ...basePill, background: bg, color: col }}>{s}</span>;
  };

  const sentimentPill = (sentiment?: string) => {
    const s = sentiment?.toLowerCase();
    if (s === "positive") return <span style={{ ...basePill, background: "#1B3A2A", color: "#4CAF50" }}>Positive</span>;
    if (s === "negative") return <span style={{ ...basePill, background: "#3B1A1A", color: "#EF5350" }}>Negative</span>;
    if (s === "neutral") return <span style={{ ...basePill, background: "#2A2A2A", color: "#9E9E9E" }}>Neutral</span>;
    return <span style={{ color: "var(--color-text-muted)" }}>—</span>;
  };

  // Base dropdown style for filters
  const filterDropdownStyle = {
    background: "var(--color-bg-secondary) url('data:image/svg+xml;utf8,<svg fill=\"%2390A4AE\" height=\"16\" viewBox=\"0 0 24 24\" width=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>') no-repeat right 10px center",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    padding: "8px 32px 8px 14px",
    fontFamily: "var(--font-title)",
    fontWeight: 500,
    fontSize: "13px",
    color: "var(--color-text-primary)",
    outline: "none",
    appearance: "none" as const,
    cursor: "pointer",
    transition: "border-color 150ms ease"
  };

  return (
    <div style={{ transition: "all 150ms ease" }}>
      {/* FILTER BAR 
      The layout uses a flex container matching the exact instructions. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={filterDropdownStyle}
            onFocus={(e) => e.target.style.borderColor = "var(--color-accent)"}
            onBlur={(e) => e.target.style.borderColor = "var(--color-border)"}
          >
            <option value="All">All Categories</option>
            <option value="Product Issue">Product Issue</option>
            <option value="Packaging Issue">Packaging Issue</option>
            <option value="Trade Inquiry">Trade Inquiry</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            style={filterDropdownStyle}
            onFocus={(e) => e.target.style.borderColor = "var(--color-accent)"}
            onBlur={(e) => e.target.style.borderColor = "var(--color-border)"}
          >
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={filterDropdownStyle}
            onFocus={(e) => e.target.style.borderColor = "var(--color-accent)"}
            onBlur={(e) => e.target.style.borderColor = "var(--color-border)"}
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>

          <select
            value={filterSentiment}
            onChange={(e) => setFilterSentiment(e.target.value)}
            style={filterDropdownStyle}
            onFocus={(e) => e.target.style.borderColor = "var(--color-accent)"}
            onBlur={(e) => e.target.style.borderColor = "var(--color-border)"}
          >
            <option value="All">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Negative">Negative</option>
            <option value="Neutral">Neutral</option>
          </select>

          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginLeft: "4px" }}>
            {filtered.length} of {complaints.length} shown
          </span>
        </div>

        <div className="flex gap-2">
          {/* Note: In order to match the export buttons exact style directly, we're relying on inline styles inside ExportButtons or global css, but I will override it here internally if required. Assuming ExportButtons.tsx will be untouched, I've used globals earlier. But I can't touch ExportButtons.tsx according to the prompt (keep export PDF logic etc), but wait! Export buttons: background: var(--color-bg-tertiary)... I will wrap it. */}
          <ExportButtons complaints={complaints} />
        </div>
      </div>

      {/* TABLE SECTION */}
      {filtered.length === 0 ? (
        <div style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "16px", textAlign: "center", padding: "60px" }}>
          <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-title)", fontSize: "14px" }}>
            {complaints.length === 0
              ? "No complaints yet. Submit one to get started!"
              : "No complaints match the current filters."}
          </p>
        </div>
      ) : (
        <div style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "16px", overflow: "hidden" }}>
          <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--color-bg-tertiary)", borderBottom: "1px solid var(--color-border)" }}>
              <tr>
                {["ID", "Complaint", "Source", "Sentiment", "Category", "Priority", "Status", "Recommendation", "SLA", "Submitted", "Actions"].map((col, idx) => {
                  
                  // Sorting logic maps
                  const sortMap: Record<string, SortKey> = {
                    "Sentiment": "sentiment", "Category": "category", "Priority": "priority", 
                    "Status": "status", "SLA": "slaDeadline", "Submitted": "timestamp"
                  };
                  
                  const isSortable = !!sortMap[col];

                  return (
                    <th 
                      key={col} 
                      onClick={isSortable ? () => toggleSort(sortMap[col]) : undefined}
                      style={{ 
                        padding: "14px 16px", 
                        fontFamily: "var(--font-title)", 
                        fontWeight: 500, 
                        fontSize: "11px", 
                        letterSpacing: "0.08em", 
                        textTransform: "uppercase", 
                        color: "var(--color-text-muted)",
                        cursor: isSortable ? "pointer" : "default"
                      }}
                    >
                      {col}{isSortable && sortIndicator(sortMap[col])}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <Fragment key={c.id}>
                  <tr 
                    style={{ 
                      borderBottom: idx === filtered.length - 1 ? "none" : "1px solid var(--color-border)",
                      transition: "background 150ms ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(45,212,191,0.03)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "18px 16px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                      {c.id.slice(0, 8)}
                    </td>
                    <td
                      style={{ padding: "18px 16px", fontFamily: "var(--font-content)", fontSize: "14px", color: "var(--color-text-primary)", cursor: "pointer", maxWidth: "250px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      title="Click to expand"
                    >
                      {c.complaint}
                    </td>
                    <td style={{ padding: "18px 16px" }}>{sourceBadge(c.source)}</td>
                    <td style={{ padding: "18px 16px" }}>{sentimentPill(c.sentiment)}</td>
                    <td style={{ padding: "18px 16px" }}>{categoryBadge(c.category)}</td>
                    <td style={{ padding: "18px 16px" }}>{priorityBadge(c.priority)}</td>
                    <td style={{ padding: "18px 16px" }}>
                      <select
                        style={{
                          background: "var(--color-bg-tertiary)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontFamily: "var(--font-title)",
                          fontWeight: 500,
                          fontSize: "12px",
                          color: "var(--color-text-primary)",
                          outline: "none",
                          cursor: "pointer",
                          transition: "border-color 150ms ease"
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = "var(--color-accent)"}
                        onBlur={e => e.currentTarget.style.borderColor = "var(--color-border)"}
                        value={c.status}
                        onChange={(e) =>
                          onStatusChange(c.id, e.target.value as "Open" | "In Progress" | "Resolved")
                        }
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </td>
                    <td style={{ padding: "18px 16px", maxWidth: "200px", fontFamily: "var(--font-content)", fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.6, fontWeight: 300 }}>
                      {c.recommendation.length > 80
                        ? c.recommendation.slice(0, 80) + "..."
                        : c.recommendation}
                    </td>
                    <td style={{ padding: "18px 16px" }}>
                      <SLABadge slaDeadline={c.slaDeadline} status={c.status} />
                    </td>
                    <td style={{ padding: "18px 16px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                      {new Date(c.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: "18px 16px" }}>
                      <button
                        onClick={() => onDelete(c.id)}
                        style={{
                           background: "none", border: "none", color: "var(--color-negative)",
                           cursor: "pointer", opacity: 0.7, padding: "8px", fontWeight: "bold"
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}
                      >
                        X
                      </button>
                    </td>
                  </tr>
                  
                  {expandedId === c.id && (
                    <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                      <td colSpan={11} style={{ padding: "20px 24px", borderBottom: idx === filtered.length - 1 ? "none" : "1px solid var(--color-border)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          <div>
                            <div style={{ fontFamily: "var(--font-title)", fontWeight: 600, fontSize: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Full Complaint</div>
                            <div style={{ fontFamily: "var(--font-content)", fontSize: "14px", color: "var(--color-text-primary)", lineHeight: 1.6 }}>{c.complaint}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily: "var(--font-title)", fontWeight: 600, fontSize: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>AI Recommendation / Protocol</div>
                            <div style={{ fontFamily: "var(--font-content)", fontSize: "14px", color: "var(--color-accent)", lineHeight: 1.6, background: "rgba(45,212,191,0.05)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(45,212,191,0.1)" }}>{c.recommendation}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
