import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Complaint } from "../App";

interface Props {
  complaints: Complaint[];
}

export default function ExportButtons({ complaints }: Props) {
  const exportCSV = () => {
    const rows = complaints.map((c) => ({
      ID: c.id,
      Complaint: c.complaint,
      Category: c.category,
      Priority: c.priority,
      Status: c.status,
      Reasoning: c.reasoning,
      Recommendation: c.recommendation,
      "SLA Deadline": c.slaDeadline,
      "SLA Breached":
        c.status === "Resolved"
          ? new Date(c.resolvedAt!).getTime() > new Date(c.slaDeadline).getTime()
            ? "Yes"
            : "No"
          : Date.now() > new Date(c.slaDeadline).getTime()
            ? "Yes"
            : "No",
      "Submitted At": c.timestamp,
      "Resolved At": c.resolvedAt || "",
      Fallback: c.fallback ? "Yes" : "No",
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `complaints_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    // Title
    doc.setFontSize(18);
    doc.setTextColor(137, 180, 250);
    doc.text("Clarion — Complaint Report", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    // Stats summary
    const total = complaints.length;
    const high = complaints.filter((c) => c.priority === "High").length;
    const open = complaints.filter((c) => c.status === "Open").length;
    const resolved = complaints.filter((c) => c.status === "Resolved").length;

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Total: ${total}  |  High Priority: ${high}  |  Open: ${open}  |  Resolved: ${resolved}`,
      14,
      38
    );

    // Table
    const head = [["ID", "Complaint", "Category", "Priority", "Status", "SLA Status", "Submitted"]];
    const body = complaints.map((c) => [
      c.id.slice(0, 8),
      c.complaint.length > 60 ? c.complaint.slice(0, 60) + "..." : c.complaint,
      c.category,
      c.priority,
      c.status,
      c.status === "Resolved"
        ? new Date(c.resolvedAt!).getTime() <= new Date(c.slaDeadline).getTime()
          ? "Within SLA"
          : "Breached"
        : Date.now() > new Date(c.slaDeadline).getTime()
          ? "Breached"
          : "On Track",
      new Date(c.timestamp).toLocaleString(),
    ]);

    autoTable(doc, {
      startY: 44,
      head,
      body,
      theme: "grid",
      headStyles: { fillColor: [38, 38, 55], textColor: [205, 214, 244], fontSize: 8 },
      bodyStyles: { fontSize: 7, textColor: [80, 80, 80] },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      margin: { left: 14, right: 14 },
    });

    doc.save(`complaints_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="export-group">
      <button
        id="export-csv-btn"
        className="btn btn-outline btn-sm"
        onClick={exportCSV}
        disabled={complaints.length === 0}
      >
        📄 Export CSV
      </button>
      <button
        id="export-pdf-btn"
        className="btn btn-outline btn-sm"
        onClick={exportPDF}
        disabled={complaints.length === 0}
      >
        📑 Export PDF
      </button>
    </div>
  );
}

