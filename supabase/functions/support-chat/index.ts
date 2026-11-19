import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://id-preview--21e8aa03-4f1b-4cbb-8baa-5114faccad0c.lovable.app",
  "https://21e8aa03-4f1b-4cbb-8baa-5114faccad0c.lovableproject.com",
  "https://simple-med-text.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Credentials": "true",
});

const HANDOFF_TEXT = "I'm not completely sure about this one, so I've passed your conversation to our support team. A person will reply here soon.";

serve(async (req) => {
  const headers = { ...cors(req.headers.get("Origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.slice(7));
    if (authErr || !claims?.claims) return json({ error: "Authentication failed" }, 401);
    const userId = claims.claims.sub as string;
    const email = (claims.claims.email as string) ?? null;

    let body: { message?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid request format" }, 400); }
    const message = typeof body.message === "string"
      ? body.message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim() : "";
    if (!message || message.length > 2000) return json({ error: "Message must be 1-2000 characters" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let { data: convo } = await admin.from("support_conversations").select("*").eq("user_id", userId).maybeSingle();
    if (!convo) {
      const { data, error } = await admin.from("support_conversations")
        .insert({ user_id: userId, user_email: email }).select().single();
      if (error) throw error;
      convo = data;
    }

    const { error: insErr } = await admin.from("support_messages")
      .insert({ conversation_id: convo.id, sender: "user", content: message });
    if (insErr) throw insErr;
    await admin.from("support_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convo.id);

    // Already with a person: the bot stays quiet.
    if (convo.status === "needs_human") return json({ status: "needs_human" });

    const [{ data: articles }, { data: reports }, { data: history }] = await Promise.all([
      admin.from("help_articles").select("title, content").order("updated_at", { ascending: false }).limit(50),
      admin.from("report_history").select("file_name, summary, key_findings, next_steps, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      admin.from("support_messages").select("sender, content").eq("conversation_id", convo.id)
        .order("created_at", { ascending: false }).limit(20),
    ]);

    const docs = (articles ?? []).map((a) => `### ${a.title}\n${a.content}`).join("\n\n") || "(no help articles yet)";
    const reps = (reports ?? []).map((r) =>
      `- ${r.file_name} (analyzed ${new Date(r.created_at).toDateString()}): ${r.summary}`).join("\n") || "(this patient has no saved reports)";

    const system = `You are the friendly support assistant for MediClear, an app that explains medical reports in simple language.
Answer ONLY using the help articles and the patient's saved reports below. Keep answers short and plain.
If the answer is not clearly covered, if the patient asks for a person, or if they need medical advice beyond what their saved reports say, set "confident" to false.
Reply in the same language the patient writes in.
Respond with JSON only: {"reply": string, "confident": boolean, "reason": string}

HELP ARTICLES:
${docs.slice(0, 40000)}

PATIENT'S SAVED REPORTS:
${reps}`;

    const msgs = (history ?? []).reverse().map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.content,
    }));

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...msgs],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });
    if (ai.status === 429) return json({ error: "Too many requests, please try again shortly." }, 429);
    if (ai.status === 402) return json({ error: "AI credits are used up." }, 402);
    if (!ai.ok) { console.error("AI gateway failed", ai.status); return json({ error: "Unable to reply right now." }, 503); }

    const raw = (await ai.json()).choices?.[0]?.message?.content ?? "";
    let parsed: { reply?: string; confident?: boolean; reason?: string } = {};
    try { parsed = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()); } catch { parsed = {}; }

    const confident = parsed.confident === true && !!parsed.reply;
    const reply = confident ? parsed.reply! : HANDOFF_TEXT;
    await admin.from("support_messages").insert({ conversation_id: convo.id, sender: "assistant", content: reply });
    if (!confident) {
      await admin.from("support_conversations").update({
        status: "needs_human", handoff_reason: (parsed.reason ?? "Assistant was unsure").slice(0, 300),
      }).eq("id", convo.id);
    }
    return json({ status: confident ? "bot" : "needs_human" });
  } catch (e) {
    console.error("support-chat error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Unable to process request" }, 500);
  }
});
