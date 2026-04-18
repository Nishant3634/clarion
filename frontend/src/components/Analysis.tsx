import { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import type { Complaint } from "../App";
import { BrainCircuit, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  complaints: Complaint[];
  onError: (msg: string) => void;
}

interface Insight {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: string;
}

export default function Analysis({ complaints, onError }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  const categories = ["Product Issue", "Packaging Issue", "Trade Inquiry"];
  const CAT_COLORS: Record<string, string> = { "Product Issue": "#2DD4BF", "Packaging Issue": "#FFA726", "Trade Inquiry": "#4CAF50" };

  // --- SECTION 1: TREND ANALYSIS ---
  const { trendData, trendTable, summaryData } = useMemo(() => {
    const now = new Date();
    const months = [
      new Date(now.getFullYear(), now.getMonth() - 2, 1),
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      new Date(now.getFullYear(), now.getMonth(), 1)
    ];
    
    const weekBuckets: Record<string, Record<string, number>> = {};
    const monthTable: Record<string, number[]> = {
      "Product Issue": [0, 0, 0],
      "Packaging Issue": [0, 0, 0],
      "Trade Inquiry": [0, 0, 0]
    };

    complaints.forEach((c) => {
      const d = new Date(c.timestamp);
      
      for (let i = 0; i < 3; i++) {
        const start = months[i];
        const end = i === 2 ? new Date(now.getFullYear(), now.getMonth() + 1, 0) : new Date(now.getFullYear(), now.getMonth() - 1 + i + 1, 0);
        if (d >= start && d <= end) {
          if (monthTable[c.category]) monthTable[c.category][i]++;
          break;
        }
      }

      const yearStart = new Date(d.getFullYear(), 0, 1);
      const days = Math.floor((d.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil(days / 7);
      const weekKey = `W${weekNumber}`;
      
      if (!weekBuckets[weekKey]) weekBuckets[weekKey] = { "Product Issue": 0, "Packaging Issue": 0, "Trade Inquiry": 0 };
      if (weekBuckets[weekKey][c.category] !== undefined) {
        weekBuckets[weekKey][c.category]++;
      }
    });

    const trendChart = Object.keys(weekBuckets).sort().map(w => ({
      week: w,
      ...weekBuckets[w]
    }));

    const mTable = categories.map(cat => {
      const m1 = monthTable[cat][0];
      const m2 = monthTable[cat][1];
      const m3 = monthTable[cat][2];
      
      let trendText = "Stable";
      let trendIcon = <Minus className="w-4 h-4" style={{ color: "var(--color-text-secondary)" }} />;
      if (m2 > 0) {
        const pct = (m3 - m2) / m2;
        if (pct > 0.1) { trendText = "Increasing"; trendIcon = <TrendingUp className="w-4 h-4 text-[#EF5350]" />; }
        else if (pct < -0.1) { trendText = "Decreasing"; trendIcon = <TrendingDown className="w-4 h-4 text-[#4CAF50]" />; }
      } else if (m3 > 0) {
        trendText = "Increasing"; trendIcon = <TrendingUp className="w-4 h-4 text-[#EF5350]" />;
      }
      
      return { cat, m1, m2, m3, trendText, trendIcon };
    });

    return { trendData: trendChart, trendTable: mTable, summaryData: { monthTable, total: complaints.length } };
  }, [complaints]);

  // --- SECTION 3: RESOLUTION PERFORMANCE ---
  const { resTimeData, slaData, fastestCat, minTime, worstSlaCat, minSlaPct } = useMemo(() => {
    const resData: any[] = [];
    const slaComplianceData: any[] = [];
    let fCat = "";
    let mTime = Infinity;
    let wCat = "";
    let mSla = Infinity;

    categories.forEach(cat => {
      const catComplaints = complaints.filter(c => c.category === cat);
      const resolved = catComplaints.filter(c => c.status === "Resolved" && c.resolvedAt);
      
      let avgH = 0;
      if (resolved.length > 0) {
        const totalMs = resolved.reduce((acc, c) => acc + (new Date(c.resolvedAt!).getTime() - new Date(c.timestamp).getTime()), 0);
        avgH = totalMs / resolved.length / (1000 * 60 * 60);
      }
      resData.push({ category: cat, avgHours: Number(avgH.toFixed(1)) });

      if (avgH < mTime && resolved.length > 0) {
        mTime = avgH;
        fCat = cat;
      }

      let pct = 100;
      if (resolved.length > 0) {
        const withinSla = resolved.filter(c => new Date(c.resolvedAt!).getTime() <= new Date(c.slaDeadline).getTime());
        pct = (withinSla.length / resolved.length) * 100;
      } else if (catComplaints.length > 0) {
        pct = 0;
      }
      slaComplianceData.push({ category: cat, slaPct: Number(pct.toFixed(0)) });

      if (pct < mSla && catComplaints.length > 0) {
        mSla = pct;
        wCat = cat;
      }
    });

    return { resTimeData: resData, slaData: slaComplianceData, fastestCat: fCat, minTime: mTime, worstSlaCat: wCat, minSlaPct: mSla };
  }, [complaints]);

  // Handle caching
  useEffect(() => {
    const cached = localStorage.getItem("clarion_insights");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.data && parsed.timestamp) {
          setInsights(parsed.data);
          setLastGenerated(new Date(parsed.timestamp));
        }
      } catch (e) {}
    }
  }, []);

  // --- SECTION 2: AI INSIGHTS TRIGGER ---
  const generateInsights = async () => {
    if (complaints.length === 0) return onError("Not enough data to analyze.");
    setLoadingInsights(true);
    
    const agg = {
      totalComplaints: summaryData.total,
      recentTrend: trendTable.map(t => ({ category: t.cat, trend: t.trendText })),
      resolutionPerformace: resTimeData,
      slaCompliance: slaData
    };

    try {
      const res = await fetch("/api/analyze-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryData: agg })
      });
      if (!res.ok) throw new Error("Failed to generate AI insights");
      const data = await res.json();
      
      setInsights(data.insights);
      const now = new Date();
      setLastGenerated(now);
      localStorage.setItem("clarion_insights", JSON.stringify({ data: data.insights, timestamp: now.getTime() }));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 pb-16 transition-all duration-150 ease-in-out">
      
      {/* PAGE HEADER */}
      <div className="mb-10">
        <h1 style={{ fontFamily: "var(--font-title)", fontWeight: 600, fontSize: "28px", color: "var(--color-text-primary)", display: "inline-block" }}>
          Trend Analysis
        </h1>
        <span style={{ fontFamily: "var(--font-title)", fontWeight: 300, fontSize: "15px", color: "var(--color-text-secondary)", marginLeft: "12px", display: "inline-block" }}>
          Is it getting better or worse?
        </span>
      </div>
      
      {/* --- SECTION 1: TREND ANALYSIS --- */}
      <section className="mb-14">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
          
          {/* Chart Left */}
          <div style={{ flex: "1 1 55%", background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "24px" }}>
             <h3 style={{ fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "20px" }}>
               Volume by Week
             </h3>
             <div style={{ height: "300px", position: "relative" }}>
               {trendData.length === 0 ? <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">No data</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="week" stroke="transparent" tick={{fill: 'var(--color-text-muted)', fontFamily: 'var(--font-title)', fontSize: 11}} axisLine={false} tickLine={false} />
                      <YAxis stroke="transparent" tick={{fill: 'var(--color-text-muted)', fontFamily: 'var(--font-title)', fontSize: 11}} allowDecimals={false} axisLine={false} tickLine={false} />
                      <RechartsTooltip contentStyle={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: "8px", padding: "10px 14px", fontFamily: "var(--font-title)", fontSize: "12px" }} itemStyle={{ fontFamily: "var(--font-title)", fontSize: "12px" }} />
                      
                      {categories.map(cat => (
                         <Line key={cat} type="monotone" dataKey={cat} stroke={CAT_COLORS[cat]} strokeWidth={3} dot={{ fill: CAT_COLORS[cat], r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
               )}
             </div>
             
             {/* Custom Legend Below Chart */}
             {trendData.length > 0 && (
               <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "24px" }}>
                 {categories.map(cat => (
                   <div key={cat} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                     <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: CAT_COLORS[cat] }} />
                     <span style={{ fontFamily: "var(--font-title)", fontWeight: 400, fontSize: "12px", color: "var(--color-text-primary)" }}>{cat}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>

          {/* Table Right */}
          <div style={{ flex: "1 1 40%", background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
             <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
               <thead>
                 <tr style={{ background: "var(--color-bg-tertiary)" }}>
                   <th style={{ padding: "12px 20px", fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>Category</th>
                   <th style={{ padding: "12px 20px", fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", textAlign: "center" }}>M1</th>
                   <th style={{ padding: "12px 20px", fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", textAlign: "center" }}>M2</th>
                   <th style={{ padding: "12px 20px", fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", textAlign: "center" }}>M3</th>
                   <th style={{ padding: "12px 20px", fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)", textAlign: "right" }}>Trend</th>
                 </tr>
               </thead>
               <tbody>
                 {trendTable.map((row, idx) => {
                   const isIncreasing = row.trendText.includes("Increasing");
                   const isDecreasing = row.trendText.includes("Decreasing");
                   const trendColor = isIncreasing ? "#EF5350" : isDecreasing ? "#4CAF50" : "#9E9E9E";
                   const trendPrefix = isIncreasing ? "↑ " : isDecreasing ? "↓ " : "→ ";
                   
                   return (
                     <tr key={row.cat} style={{ borderBottom: idx === trendTable.length - 1 ? "none" : "1px solid var(--color-border)" }}>
                       <td style={{ padding: "14px 20px", fontFamily: "var(--font-title)", fontWeight: 400, fontSize: "13px", color: "var(--color-text-primary)" }}>{row.cat}</td>
                       <td style={{ padding: "14px 20px", fontFamily: "var(--font-title)", fontWeight: 400, fontSize: "13px", color: "var(--color-text-secondary)", textAlign: "center" }}>{row.m1}</td>
                       <td style={{ padding: "14px 20px", fontFamily: "var(--font-title)", fontWeight: 400, fontSize: "13px", color: "var(--color-text-secondary)", textAlign: "center" }}>{row.m2}</td>
                       <td style={{ padding: "14px 20px", fontFamily: "var(--font-title)", fontWeight: 400, fontSize: "13px", color: "var(--color-text-primary)", textAlign: "center" }}>{row.m3}</td>
                       <td style={{ padding: "14px 20px", fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "12px", color: trendColor, textAlign: "right" }}>
                         {trendPrefix}{row.trendText}
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
          </div>
        </div>
      </section>

      {/* --- SECTION 2: AI-POWERED INSIGHTS --- */}
      <section className="mb-14">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <h2 style={{ fontFamily: "var(--font-title)", fontWeight: 600, fontSize: "22px", color: "var(--color-text-primary)" }}>
            AI-Powered Insights
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {lastGenerated && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-muted)" }}>
                Last updated: {lastGenerated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={generateInsights}
              disabled={loadingInsights}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "transparent",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                padding: "8px 18px",
                fontFamily: "var(--font-title)",
                fontWeight: 500,
                fontSize: "13px",
                color: "var(--color-text-primary)",
                cursor: loadingInsights ? "not-allowed" : "pointer",
                transition: "all 150ms ease",
                opacity: loadingInsights ? 0.7 : 1
              }}
              onMouseEnter={e => {
                if (!loadingInsights) {
                  e.currentTarget.style.borderColor = "var(--color-accent)";
                  e.currentTarget.style.color = "var(--color-accent)";
                }
              }}
              onMouseLeave={e => {
                if (!loadingInsights) {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.color = "var(--color-text-primary)";
                }
              }}
            >
              <RefreshCw size={14} className={loadingInsights ? "animate-spin" : ""} />
              {loadingInsights ? "Analyzing..." : "Refresh Insights"}
            </button>
          </div>
        </div>

        {insights.length === 0 && !loadingInsights ? (
          <div style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "14px", padding: "40px", textAlign: "center" }}>
             <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "var(--color-text-muted)" }}>
               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
             </div>
             <div style={{ fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "15px", color: "var(--color-text-primary)" }}>No insights generated yet</div>
             <div style={{ fontFamily: "var(--font-title)", fontWeight: 400, fontSize: "13px", color: "var(--color-text-muted)", marginTop: "6px" }}>Click Refresh Insights to analyze your complaint data</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            {insights.map((insight, idx) => (
              <div 
                key={idx} 
                style={{ 
                  background: "var(--color-bg-secondary)", 
                  border: "1px solid var(--color-border)", 
                  borderRadius: "14px", 
                  padding: "22px",
                  transition: "all 200ms ease"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "var(--color-border-hover)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <span style={{
                    background: insight.priority === 'high' ? "#3B1A1A" : insight.priority === 'medium' ? "#3B2A1A" : "#1B3A2A",
                    color: insight.priority === 'high' ? "#EF5350" : insight.priority === 'medium' ? "#FFA726" : "#4CAF50",
                    fontFamily: "var(--font-title)",
                    fontWeight: 500,
                    fontSize: "10px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: "4px"
                  }}>
                    {insight.priority}
                  </span>
                  <span style={{ fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
                    {insight.category}
                  </span>
                </div>
                <h3 style={{ fontFamily: "var(--font-title)", fontWeight: 600, fontSize: "15px", color: "var(--color-text-primary)", marginTop: "10px", lineHeight: 1.4 }}>
                  {insight.title}
                </h3>
                <p style={{ fontFamily: "var(--font-title)", fontWeight: 300, fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "8px", lineHeight: 1.7 }}>
                  {insight.description}
                </p>
              </div>
            ))}
            {loadingInsights && insights.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: "48px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div className="w-8 h-8 border-2 border-transparent rounded-full animate-spin mb-4" style={{ borderTopColor: "var(--color-accent)" }}></div>
                <p style={{ fontFamily: "var(--font-title)", color: "var(--color-accent)" }} className="animate-pulse">Analyzing complaint patterns...</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* --- SECTION 3: RESOLUTION PERFORMANCE --- */}
      <section>
        <h2 style={{ fontFamily: "var(--font-title)", fontWeight: 600, fontSize: "22px", color: "var(--color-text-primary)", marginBottom: "20px" }}>
          Resolution Performance
        </h2>
        
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "24px" }}>
          
          <div style={{ flex: "1 1 calc(50% - 10px)", background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "24px" }}>
             <h3 style={{ fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "20px", textAlign: "center" }}>
               Avg Resolution Time by Category
             </h3>
             <div style={{ height: "250px" }}>
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={resTimeData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                   <XAxis type="number" stroke="transparent" tick={{fill: 'var(--color-text-muted)', fontFamily: 'var(--font-title)', fontSize: 11}} axisLine={false} tickLine={false} />
                   <YAxis dataKey="category" type="category" stroke="transparent" tick={{fill: 'var(--color-text-primary)', fontFamily: 'var(--font-title)', fontSize: 12}} axisLine={false} tickLine={false} />
                   <RechartsTooltip cursor={{fill: 'var(--color-bg-tertiary)', opacity: 0.4}} contentStyle={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: "8px", fontFamily: "var(--font-title)", fontSize: "12px" }} />
                   <Bar dataKey="avgHours" radius={[0, 4, 4, 0]} maxBarSize={30}>
                     {resTimeData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill="var(--color-accent)" />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

          <div style={{ flex: "1 1 calc(50% - 10px)", background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: "16px", padding: "24px" }}>
             <h3 style={{ fontFamily: "var(--font-title)", fontWeight: 500, fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "20px", textAlign: "center" }}>
               SLA Compliance by Category
             </h3>
             <div style={{ height: "250px" }}>
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={slaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
                   <XAxis dataKey="category" stroke="transparent" tick={{fill: 'var(--color-text-muted)', fontFamily: 'var(--font-title)', fontSize: 11}} axisLine={false} tickLine={false} />
                   <YAxis type="number" domain={[0, 100]} stroke="transparent" tick={{fill: 'var(--color-text-muted)', fontFamily: 'var(--font-title)', fontSize: 11}} axisLine={false} tickLine={false} />
                   <RechartsTooltip cursor={{fill: 'var(--color-bg-tertiary)', opacity: 0.4}} contentStyle={{ background: "var(--color-bg-tertiary)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)", borderRadius: "8px", fontFamily: "var(--font-title)", fontSize: "12px" }} />
                   <Bar dataKey="slaPct" radius={[4, 4, 0, 0]} maxBarSize={40}>
                     {slaData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.slaPct >= 80 ? "#4CAF50" : entry.slaPct >= 50 ? "#FFA726" : "#EF5350"} />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

        </div>

        <div style={{ fontFamily: "var(--font-title)", fontWeight: 400, fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
           Fastest resolved category is <span style={{ color: "var(--color-accent)" }}>{fastestCat || 'N/A'}</span> (avg {minTime === Infinity ? 0 : minTime.toFixed(1)}h). 
           Most at-risk category is <span style={{ color: "var(--color-accent)" }}>{worstSlaCat || 'N/A'}</span> with only <span style={{ color: "var(--color-accent)" }}>{minSlaPct === Infinity ? 100 : minSlaPct.toFixed(0)}%</span> SLA compliance.
        </div>
      </section>

    </div>
  );
}
