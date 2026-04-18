import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 5000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      /\.idx\.dev$/,
      /\.web\.app$/,
    ],
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);
app.use(express.json());

// ---------------------------------------------------------------------------
// Supabase Client
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// OpenRouter config
// ---------------------------------------------------------------------------
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";

const SYSTEM_PROMPT = `You are an expert AI complaint analyst for a wellness/customer support business. Your role is to deeply analyze customer complaints and use intelligent reasoning — not fixed rules — to classify, prioritize, and recommend resolutions.

CATEGORIES (choose exactly ONE):
- "Product Issue" — The actual product is defective, damaged, doesn't work as expected, causes health concerns, or fails to meet quality standards.
- "Packaging Issue" — Problem with how the product was packaged, sealed, labeled, or shipped. The product itself may be fine but arrived damaged due to packaging failure.
- "Trade Inquiry" — Questions or requests about wholesale pricing, bulk orders, business partnerships, distribution, or reseller arrangements.

PRIORITY REASONING (do NOT use a fixed table — reason based on these factors):
Analyze the complaint for:
- Tone signals: anger, urgency, distress, threats to return/escalate
- Safety signals: health risks, allergic reactions, contamination concerns
- Business impact signals: large order affected, multiple units, repeated issue
- Scale signals: "all", "entire batch", "multiple customers"
- Explicit urgency: words like "urgent", "immediately", "asap", "dangerous"

Then assign:
- HIGH: Any safety risk, significant anger, explicit urgency, large-scale impact, or potential legal/health consequence
- MEDIUM: Clear defect or issue but no safety risk, moderate inconvenience, standard quality complaint
- LOW: General inquiry, minor cosmetic issue, curious question, no urgency

RESOLUTION RECOMMENDATION:
Do NOT use a lookup table. Reason about the specific complaint and recommend a tailored, actionable resolution that addresses the exact nature of the problem described. Be specific: mention timelines, compensation amounts, escalation paths, or follow-up steps where appropriate.

RESPONSE FORMAT:
Return ONLY valid JSON with no preamble, no markdown, no explanation outside the JSON:
{
  "category": "Product Issue" | "Packaging Issue" | "Trade Inquiry",
  "priority": "High" | "Medium" | "Low",
  "sentiment": "positive" | "negative" | "neutral",
  "reasoning": "Two-sentence explanation: first sentence explains the category choice based on specific details in the complaint; second sentence explains the priority assignment based on tone, urgency, and impact signals detected.",
  "recommendation": "Specific, contextual resolution action tailored to this exact complaint — not a generic template response."
}

CRITICAL RULES:
- Respond with valid JSON ONLY — no text before or after the JSON object
- Reasoning must reference specific words or signals from the actual complaint
- Recommendations must be specific to the complaint's details, not generic
- If genuinely ambiguous between two categories, pick the one that best serves the customer's primary concern`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slaHoursForPriority(priority) {
  switch (priority) {
    case "High":
      return 2;
    case "Medium":
      return 8;
    case "Low":
      return 24;
    default:
      return 8;
  }
}

function buildComplaintRecord(classification, complaintText, source = "Manual", extSentiment = null) {
  const now = new Date();
  const slaHours = slaHoursForPriority(classification.priority);
  const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

  return {
    id: crypto.randomUUID(),
    complaint: complaintText,
    category: classification.category,
    priority: classification.priority,
    sentiment: extSentiment || classification.sentiment || "neutral",
    source: source,
    reasoning: classification.reasoning,
    recommendation: classification.recommendation,
    status: "Open",
    timestamp: now.toISOString(),
    slaDeadline: slaDeadline.toISOString(),
    statusHistory: [{ status: "Open", at: now.toISOString() }],
    resolvedAt: null,
    fallback: false,
  };
}

function fallbackClassify(text) {
  const lower = text.toLowerCase();

  const packagingKeywords = ["crushed", "damaged box", "broken seal", "leak", "packaging", "dented", "torn", "wrapper"];
  const productKeywords = ["doesn't work", "defective", "broken", "expired", "reaction", "allergic", "smell", "taste", "quality", "malfunction"];
  const tradeKeywords = ["wholesale", "bulk", "distributor", "reseller", "partnership", "pricing", "b2b", "business"];

  let category = "Product Issue";
  if (packagingKeywords.some((k) => lower.includes(k))) category = "Packaging Issue";
  else if (tradeKeywords.some((k) => lower.includes(k))) category = "Trade Inquiry";
  else if (productKeywords.some((k) => lower.includes(k))) category = "Product Issue";

  return {
    category,
    priority: "Medium",
    sentiment: "neutral",
    reasoning:
      "This classification was generated by keyword-based fallback because the AI service was unavailable. Manual review is recommended.",
    recommendation:
      "Please review this complaint manually and update the classification and recommendation as needed.",
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /api/classify — Classify a new complaint
app.post("/api/classify", async (req, res) => {
  try {
    const { complaint, source = "Manual", sentiment: extSentiment = null } = req.body;
    if (!complaint || typeof complaint !== "string" || complaint.trim().length === 0) {
      return res.status(400).json({ error: "Complaint text is required." });
    }

    let classification;
    let isFallback = false;

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "Clarion",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          max_tokens: 1024,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: complaint.trim() },
          ],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (!raw) throw new Error("Empty response from AI");

      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonStr = raw;
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      // Also try to find raw JSON object
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0];

      classification = JSON.parse(jsonStr);

      // Validate required fields
      const validCategories = ["Product Issue", "Packaging Issue", "Trade Inquiry"];
      const validPriorities = ["High", "Medium", "Low"];
      if (
        !validCategories.includes(classification.category) ||
        !validPriorities.includes(classification.priority) ||
        !classification.reasoning ||
        !classification.recommendation
      ) {
        throw new Error("Invalid classification structure from AI");
      }
    } catch (aiError) {
      console.error("AI classification failed, using fallback:", aiError.message);
      classification = fallbackClassify(complaint);
      isFallback = true;
    }

    const record = buildComplaintRecord(classification, complaint.trim(), source, extSentiment);
    record.fallback = isFallback;

    // Persist to Supabase
    const { data, error } = await supabase
      .from("complaints")
      .insert([
        {
          id: record.id,
          complaint: record.complaint,
          category: record.category,
          priority: record.priority,
          sentiment: record.sentiment,
          source: record.source,
          reasoning: record.reasoning,
          recommendation: record.recommendation,
          status: record.status,
          timestamp: record.timestamp,
          sla_deadline: record.slaDeadline,
          status_history: record.statusHistory,
          resolved_at: record.resolvedAt,
          fallback: record.fallback,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error details:", error);
      return res.status(500).json({ error: "Failed to save to database", details: error.message });
    }

    // Map snake_case from DB back to camelCase
    const mappedData = {
      ...data,
      slaDeadline: data.sla_deadline,
      statusHistory: data.status_history,
      resolvedAt: data.resolved_at,
    };

    return res.status(201).json(mappedData);
  } catch (err) {
    console.error("Classify endpoint outer error:", err);
    return res.status(500).json({ error: "Internal server error.", details: err.message });
  }
});

// GET /api/complaints — List all complaints from Supabase
app.get("/api/complaints", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .order("timestamp", { ascending: false });

    if (error) throw error;

    // Map snake_case from DB back to camelCase for Frontend
    const mappedData = data.map((c) => ({
      ...c,
      slaDeadline: c.sla_deadline,
      statusHistory: c.status_history,
      resolvedAt: c.resolved_at,
    }));

    res.json(mappedData);
  } catch (err) {
    console.error("GET complaints error:", err);
    res.status(500).json({ error: "Failed to fetch from database" });
  }
});

// PATCH /api/complaints/:id/status — Update status in Supabase
app.patch("/api/complaints/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ["Open", "In Progress", "Resolved"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  try {
    // 1. Get current status history
    const { data: current, error: fetchError } = await supabase
      .from("complaints")
      .select("status_history")
      .eq("id", id)
      .single();

    if (fetchError || !current) {
      console.error("Fetch current status error:", fetchError);
      return res.status(404).json({ error: "Complaint not found." });
    }

    const now = new Date().toISOString();
    const history = current.status_history || [];
    const newHistory = [...history, { status, at: now }];
    const resolvedAt = status === "Resolved" ? now : null;

    // 2. Update
    const { data, error: updateError } = await supabase
      .from("complaints")
      .update({
        status,
        status_history: newHistory,
        resolved_at: resolvedAt,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Update status error:", updateError);
      return res.status(500).json({ error: "Failed to update status", details: updateError.message });
    }

    // Map back
    const mapped = {
      ...data,
      slaDeadline: data.sla_deadline,
      statusHistory: data.status_history,
      resolvedAt: data.resolved_at,
    };

    res.json(mapped);
  } catch (err) {
    console.error("PATCH status outer error:", err);
    res.status(500).json({ error: "Failed to update database", details: err.message });
  }
});

// DELETE /api/complaints/:id — Delete from Supabase
app.delete("/api/complaints/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from("complaints").delete().eq("id", id);
    if (error) {
      console.error("DELETE Supabase error:", error);
      return res.status(500).json({ error: "Failed to delete from database", details: error.message });
    }
    res.status(204).send();
  } catch (err) {
    console.error("DELETE outer error:", err);
    res.status(500).json({ error: "Failed to delete from database", details: err.message });
  }
});

// POST /api/analyze-insights — Generate AI Recommendations
app.post("/api/analyze-insights", async (req, res) => {
  try {
    const { summaryData } = req.body;
    
    const INSIGHTS_PROMPT = `You are a customer service operations analyst. Analyze the complaint data provided and give 3-5 specific, actionable recommendations to improve resolution rates and reduce complaint volume. Be direct and specific.
Format your response as a JSON array of objects with keys: title, description, priority (high/medium/low), category.
Return ONLY valid JSON array with no preamble. Example: [{"title": "...", "description": "...", "priority": "high", "category": "Packaging Issue"}]`;

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Clarion",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 1024,
        messages: [
          { role: "system", content: INSIGHTS_PROMPT },
          { role: "user", content: JSON.stringify(summaryData) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch insights from AI");
    }

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("Empty response from AI");

    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) raw = jsonMatch[1].trim();
    
    let insights;
    try {
      insights = JSON.parse(raw);
    } catch {
      // Find Array brackets fallback
      const arrayMatch = raw.match(/\[[\s\S]*\]/);
      if(arrayMatch) insights = JSON.parse(arrayMatch[0]);
    }

    if (!Array.isArray(insights)) throw new Error("AI did not return an array");

    return res.json({ insights });
  } catch (err) {
    console.error("Analyze Insights error:", err);
    return res.status(500).json({ error: "Failed to generate insights." });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Complaint Engine backend running on http://localhost:${PORT}`);
});

