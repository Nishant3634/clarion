import { useEffect, useState } from "react";

interface Props {
  slaDeadline: string;
  status: string;
}

export default function SLABadge({ slaDeadline, status }: Props) {
  const [label, setLabel] = useState("");
  const [breached, setBreached] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const deadline = new Date(slaDeadline).getTime();

      if (status === "Resolved") {
        setLabel("Resolved");
        setBreached(false);
        return;
      }

      const diff = deadline - now;
      if (diff <= 0) {
        setBreached(true);
        setLabel("SLA Breached");
      } else {
        setBreached(false);
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (hrs > 0) {
          setLabel(`${hrs}h ${mins}m remaining`);
        } else {
          setLabel(`${mins}m remaining`);
        }
      }
    };

    update();
    const interval = setInterval(update, 60000); // update every minute
    return () => clearInterval(interval);
  }, [slaDeadline, status]);

  const baseStyle = {
    fontFamily: "var(--font-title)",
    fontWeight: 500,
    fontSize: "11px",
    letterSpacing: "0.04em",
    padding: "4px 10px",
    borderRadius: "6px",
    display: "inline-block"
  };

  if (status === "Resolved") {
    return <span style={{ ...baseStyle, background: "#1B3A2A", color: "#4CAF50" }}>✓ Resolved</span>;
  }

  return (
    <span style={{ 
      ...baseStyle, 
      background: breached ? "#3B1A1A" : "#1A2A3B", 
      color: breached ? "#EF5350" : "#2DD4BF" 
    }}>
      {breached ? "⚠ " : "⏱ "}
      {label}
    </span>
  );
}
