import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from "recharts";
import type { Complaint } from "../App";

interface Props {
  complaints: Complaint[];
}

const CAT_COLORS_ARRAY = [
  "#2DD4BF", "#FFA726", "#4CAF50", "#EF5350", "#546E7A"
];

const PRI_COLORS: Record<string, string> = {
  High: "#EF5350",
  Medium: "#FFA726",
  Low: "#4CAF50",
};

const STATUS_COLORS: Record<string, string> = {
  Resolved: "#4CAF50",
  Open: "#EF5350",
  "In Progress": "#FFA726"
};

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "#4CAF50",
  Negative: "#EF5350",
  Neutral: "#546E7A"
};

export default function Dashboard({ complaints }: Props) {
  const stats = useMemo(() => {
    const total = complaints.length;
    const high = complaints.filter((c) => c.priority === "High").length;
    const open = complaints.filter((c) => c.status === "Open").length;
    const inProgress = complaints.filter((c) => c.status === "In Progress").length;
    const resolved = complaints.filter((c) => c.status === "Resolved").length;

    // Average resolution time
    const resolvedComplaints = complaints.filter((c) => c.resolvedAt);
    let avgResTime = 0;
    if (resolvedComplaints.length > 0) {
      const totalMs = resolvedComplaints.reduce((sum, c) => {
        return sum + (new Date(c.resolvedAt!).getTime() - new Date(c.timestamp).getTime());
      }, 0);
      avgResTime = totalMs / resolvedComplaints.length / 60000; // minutes
    }

    // SLA compliance
    const resolvedWithSLA = resolvedComplaints.filter((c) => {
      return new Date(c.resolvedAt!).getTime() <= new Date(c.slaDeadline).getTime();
    });
    const slaCompliance = resolvedComplaints.length > 0
      ? Math.round((resolvedWithSLA.length / resolvedComplaints.length) * 100)
      : 100;

    return { total, high, open, inProgress, resolved, avgResTime, slaCompliance };
  }, [complaints]);

  // Chart 1: Categories
  const catData = useMemo(() => {
    const counts: Record<string, number> = {};
    complaints.forEach((c) => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [complaints]);

  // Chart 2: Sentiment
  const sentimentData = useMemo(() => {
    const counts: Record<string, number> = { Positive: 0, Negative: 0, Neutral: 0 };
    let hasSentimentData = false;
    complaints.forEach((c) => {
      let s = c.sentiment?.toLowerCase();
      if (!s) return;
      if (s === "positive") { counts.Positive++; hasSentimentData = true; }
      else if (s === "negative") { counts.Negative++; hasSentimentData = true; }
      else { counts.Neutral++; hasSentimentData = true; }
    });
    return {
      hasData: hasSentimentData,
      data: Object.entries(counts).filter(([_, val]) => val > 0).map(([name, value]) => ({ name, value })),
      rawCounts: counts
    };
  }, [complaints]);

  // Chart 3: Status
  const statusData = [
    { name: "Resolved", value: stats.resolved },
    { name: "Open", value: stats.open },
    { name: "In Progress", value: stats.inProgress }
  ].filter(d => d.value > 0);

  // Priority
  const priData = useMemo(() => {
    const counts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    complaints.forEach((c) => counts[c.priority]++);
    return ["High", "Medium", "Low"].map((name) => ({ name, value: counts[name] }));
  }, [complaints]);

  // Volume Over Time
  const timeData = useMemo(() => {
    const buckets: Record<string, number> = {};
    complaints.forEach((c) => {
      const d = new Date(c.timestamp);
      // Group by daily
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .map(([time, count]) => ({ time: time, count, rawDate: new Date(time).getTime() }))
      .sort((a, b) => a.rawDate - b.rawDate);
  }, [complaints]);

  const formatAvgTime = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)}m`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex h-full items-center justify-center p-8 text-center text-slate-500">
      {message}
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500 pb-12" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* --- STAT CARDS --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6" style={{ gap: '16px' }}>
        {[
          { label: "Total Complaints", value: stats.total, color: "var(--color-text-primary)" },
          { label: "High Priority", value: stats.high, color: "var(--color-high)" },
          { label: "Open", value: stats.open, color: "var(--color-high)" },
          { label: "In Progress", value: stats.inProgress, color: "var(--color-medium)" },
          { label: "Resolved", value: stats.resolved, color: "var(--color-low)" },
          { label: "Avg Res. Time", value: stats.total > 0 && stats.resolved > 0 ? formatAvgTime(stats.avgResTime) : "—", color: "var(--color-text-secondary)" }
        ].map((stat, i) => (
           <div key={i} className="card shadow-sm" style={{ padding: '20px' }}>
             <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-title)' }}>{stat.label}</div>
             <div className="text-3xl font-bold tracking-tight" style={{ color: stat.color }}>{stat.value}</div>
           </div>
        ))}
      </div>

      {/* --- 3 PIE CHARTS (Side by side) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '16px' }}>
        
        {/* Category Pie */}
        <div className="card flex flex-col shadow-sm chart-container">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-center" style={{ marginBottom: '12px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-title)' }}>Complaints by Category</h3>
          <div className="chart-card mb-4 w-full relative">
            {complaints.length === 0 ? <EmptyState message="No data collected." /> : (
              <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                    {catData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={CAT_COLORS_ARRAY[index % CAT_COLORS_ARRAY.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: "var(--radius)" }} />
                  <Legend wrapperStyle={{ fontSize: "0.8rem", paddingTop: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Sentiment Index */}
        <div className="card flex flex-col shadow-sm chart-container">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-center" style={{ marginBottom: '12px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-title)' }}>Sentiment Index</h3>
          <div className="chart-card mb-4 w-full relative">
            {!sentimentData.hasData ? (
               <EmptyState message="Import a CSV/Excel file or add manually to see sentiment." />
            ) : (
              <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                <PieChart>
                  <Pie data={sentimentData.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                    {sentimentData.data.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: "var(--radius)" }} />
                  <Legend wrapperStyle={{ fontSize: "0.8rem", paddingTop: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Pie */}
        <div className="card flex flex-col shadow-sm chart-container">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-center" style={{ marginBottom: '12px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-title)' }}>Complaints by Status</h3>
          <div className="chart-card mb-4 w-full relative">
            {complaints.length === 0 ? <EmptyState message="No data collected." /> : (
              <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={80} strokeWidth={0}>
                    {statusData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: "var(--radius)" }} />
                  <Legend wrapperStyle={{ fontSize: "0.8rem", paddingTop: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* --- LOWER ROW: Bar, Line, SLA Donut --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: '16px' }}>
        
        {/* Priority Bar Chart */}
        <div className="card shadow-sm chart-container">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ marginBottom: '12px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-title)' }}>Complaints by Priority</h3>
          <div className="chart-card w-full relative">
             {complaints.length === 0 ? <EmptyState message="No data collected." /> : (
                <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                  <BarChart data={priData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--color-text-secondary)" tick={{fill: 'var(--color-text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} />
                    <YAxis stroke="var(--color-text-secondary)" tick={{fill: 'var(--color-text-secondary)', fontSize: 12}} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'var(--color-border)', opacity: 0.4}} contentStyle={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: "var(--radius)" }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                      {priData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PRI_COLORS[entry.name]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             )}
          </div>
        </div>

        {/* Volume Over Time Line Chart */}
        <div className="card shadow-sm chart-container">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ marginBottom: '12px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-title)' }}>Complaint Volume Over Time</h3>
          <div className="chart-card w-full relative">
            {timeData.length === 0 ? <EmptyState message="No data collected." /> : (
               <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                 <LineChart data={timeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                   <XAxis dataKey="time" stroke="var(--color-text-secondary)" tick={{fill: 'var(--color-text-secondary)', fontSize: 12}} axisLine={false} tickLine={false} />
                   <YAxis stroke="var(--color-text-secondary)" tick={{fill: 'var(--color-text-secondary)', fontSize: 12}} allowDecimals={false} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: "var(--radius)" }} />
                   <Line type="monotone" dataKey="count" stroke="#2DD4BF" strokeWidth={3} dot={{ fill: "#2DD4BF", r: 4, strokeWidth: 2, stroke: "var(--color-bg-primary)" }} activeDot={{ r: 6 }} />
                 </LineChart>
               </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* SLA Donut */}
        <div className="card shadow-sm flex flex-col justify-center items-center chart-container">
           <h3 className="text-sm font-semibold uppercase tracking-wider w-full text-left" style={{ marginBottom: '12px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-title)' }}>SLA Compliance</h3>
           <div className="relative w-48 h-48 flex items-center justify-center">
             <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
               <path
                 style={{ color: 'var(--color-border)' }}
                 className="text-current"
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                 fill="none" stroke="currentColor" strokeWidth="3"
               />
               <path
                 style={{ color: stats.slaCompliance >= 80 ? 'var(--color-positive)' : stats.slaCompliance >= 50 ? 'var(--color-medium)' : 'var(--color-negative)' }}
                 className="text-current"
                 strokeDasharray={`${stats.slaCompliance}, 100`}
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                 fill="none" stroke="currentColor" strokeWidth="3"
               />
             </svg>
             <div className="text-center">
                <div className="text-4xl font-bold tracking-tight" style={{ color: stats.slaCompliance >= 80 ? 'var(--color-positive)' : stats.slaCompliance >= 50 ? 'var(--color-medium)' : 'var(--color-negative)' }}>
                  {stats.slaCompliance}%
                </div>
                <div className="text-xs uppercase font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>Within SLA</div>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
