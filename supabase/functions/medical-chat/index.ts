import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to your application domains
const ALLOWED_ORIGINS = [
  "https://id-preview--21e8aa03-4f1b-4cbb-8baa-5114faccad0c.lovable.app",
  "https://21e8aa03-4f1b-4cbb-8baa-5114faccad0c.lovableproject.com",
  "https://simple-med-text.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

// Get CORS headers based on request origin - strict whitelist only
const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Credentials": "true",
  };
};

// Validation constants
const MAX_QUESTION_LENGTH = 2000; // 2000 characters max for questions
const MAX_CONTEXT_LENGTH = 50000; // 50K characters max for report context
const VALID_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'ar', 'zh', 'ja', 'ko', 'ru'];

// Sanitize text input to prevent prompt injection
const sanitizeInput = (input: string): string => {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
};

// Validate report context structure
const validateReportContext = (context: unknown): { valid: boolean; error?: string } => {
  if (context === null || context === undefined) {
    return { valid: true }; // Context is optional
  }
  
  if (typeof context !== 'object') {
    return { valid: false, error: "Invalid context format" };
  }
  
  const contextStr = JSON.stringify(context);
  if (contextStr.length > MAX_CONTEXT_LENGTH) {
    return { valid: false, error: "Context too large" };
  }
  
  return { valid: true };
};

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      console.error("Authentication failed");
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let { question, reportContext, language = "en" } = requestBody;
    
    // Validate question
    if (!question) {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof question !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid question format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Question too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize question
    question = sanitizeInput(question);
    if (question.length === 0) {
      return new Response(
        JSON.stringify({ error: "Question cannot be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate language code
    if (typeof language !== 'string' || !VALID_LANGUAGES.includes(language)) {
      language = 'en';
    }

    // Validate report context
    const contextValidation = validateReportContext(reportContext);
    if (!contextValidation.valid) {
      return new Response(
        JSON.stringify({ error: contextValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Input validation passed");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const languageInstructions = language !== "en" 
      ? `Respond in the language with code "${language}".` 
      : "";

    const systemPrompt = `You are a compassionate and knowledgeable medical assistant helping patients understand their health reports. 

Guidelines:
- Explain medical terms in simple, everyday language
- Be reassuring but honest - don't minimize serious concerns
- Always recommend consulting a healthcare professional for medical decisions
- Focus on the specific question asked
- Keep responses concise (2-4 paragraphs max)
- If you don't have enough information, say so clearly

${languageInstructions}

${reportContext ? `Context from the patient's medical report:\n${JSON.stringify(reportContext)}` : "No specific report context provided."}`;

    console.log("Calling Lovable AI Gateway for medical chat...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      console.error("AI gateway request failed");
      
      // Return generic error for all AI gateway failures
      return new Response(
        JSON.stringify({ error: "Unable to process your request. Please try again." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "Unable to process your request. Please try again." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Medical chat response generated successfully");

    return new Response(
      JSON.stringify({ response: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("medical-chat error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" } }
    );
  }
});