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
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 100000; // 100K characters
const VALID_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'ar', 'zh', 'ja', 'ko', 'ru'];
const BASE64_DATA_URI_REGEX = /^data:[a-z]+\/[a-z0-9\-+.]+;base64,/i;

// Validate base64 data URI format and estimate size
const validateBase64Data = (data: string, fieldName: string): { valid: boolean; error?: string } => {
  if (typeof data !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  
  if (!BASE64_DATA_URI_REGEX.test(data)) {
    return { valid: false, error: `Invalid ${fieldName} format. Expected base64 data URI` };
  }
  
  // Extract base64 content and estimate size
  const base64Content = data.split(',')[1] || '';
  const estimatedSize = (base64Content.length * 3) / 4;
  
  if (estimatedSize > MAX_FILE_SIZE) {
    return { valid: false, error: `${fieldName} too large. Maximum size is 10MB` };
  }
  
  return { valid: true };
};

// Sanitize text input to prevent prompt injection
const sanitizeInput = (input: string): string => {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
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

    let { reportText, imageData, pdfData, language = "en" } = requestBody;
    
    // Validate at least one input is provided
    if (!reportText && !imageData && !pdfData) {
      return new Response(
        JSON.stringify({ error: "Please upload a medical report (PDF, image, or text file)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate language code
    if (typeof language !== 'string' || !VALID_LANGUAGES.includes(language)) {
      language = 'en';
    }

    // Validate and sanitize text input
    if (reportText) {
      if (typeof reportText !== 'string') {
        return new Response(
          JSON.stringify({ error: "Invalid report format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (reportText.length > MAX_TEXT_LENGTH) {
        return new Response(
          JSON.stringify({ error: "Report text too large" }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      reportText = sanitizeInput(reportText);
      if (reportText.length === 0) {
        return new Response(
          JSON.stringify({ error: "Report text cannot be empty" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate image data
    if (imageData) {
      const imageValidation = validateBase64Data(imageData, "Image");
      if (!imageValidation.valid) {
        return new Response(
          JSON.stringify({ error: "Invalid image format or size" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate PDF data
    if (pdfData) {
      const pdfValidation = validateBase64Data(pdfData, "PDF");
      if (!pdfValidation.valid) {
        return new Response(
          JSON.stringify({ error: "Invalid PDF format or size" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      ? `Provide the entire response in the language with code "${language}".` 
      : "";

    const systemPrompt = `You are a medical report validator and translator. Your job is to:
1. FIRST: Determine if the document/image is a legitimate medical report
2. ONLY if it's a valid medical report: Explain it in simple terms

A document is considered a VALID medical report if it contains:
- Hospital name, clinic name, or laboratory name
- Patient information (name, age, date, etc.)
- Medical test results, diagnoses, or clinical findings
- Medical terminology and health-related data

If the document is NOT a valid medical report (e.g., random images, non-medical documents, screenshots of unrelated content, etc.), you MUST respond with exactly this JSON:
{"isValid": false, "error": "This does not appear to be a medical report. Please upload a document from a hospital, clinic, or laboratory that contains your test results or diagnosis."}

If it IS a valid medical report, respond with this JSON structure:
{
  "isValid": true,
  "summary": "A 2-3 sentence overview of the report in simple terms",
  "keyFindings": ["Finding 1 explained simply", "Finding 2 explained simply", ...],
  "precautions": ["Precaution 1", "Precaution 2", ...],
  "nextSteps": ["Step 1", "Step 2", ...]
}

${languageInstructions}

IMPORTANT RULES:
- Be STRICT about validation - only accept genuine medical reports
- Do NOT make up or assume medical values - only use what's in the actual report
- Extract and explain the ACTUAL values shown in the report
- Keep each finding, precaution, and next step concise (1-2 sentences max)
- Include 3-5 items in each array based on what the report actually contains
- ONLY output valid JSON, no additional text`;

    console.log("Calling Lovable AI Gateway for report validation and analysis...");
    
    // Build the messages based on input type
    let userContent: any;
    
    if (pdfData) {
      // For PDFs, send as document to multimodal AI
      console.log("Processing PDF document...");
      userContent = [
        { type: "text", text: "Please validate and analyze this medical report PDF. Extract the actual values and findings shown:" },
        { type: "image_url", image_url: { url: pdfData } }
      ];
    } else if (imageData) {
      // For images, use multimodal format
      console.log("Processing image...");
      userContent = [
        { type: "text", text: "Please validate and analyze this medical report image. Extract the actual values and findings shown:" },
        { type: "image_url", image_url: { url: imageData } }
      ];
    } else {
      // For text
      console.log("Processing text report...");
      userContent = `Please validate and analyze this medical report:\n\n${reportText}`;
    }
    
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
          { role: "user", content: userContent }
        ],
        temperature: 0.2,
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

    // Parse the JSON response
    let result;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response");
      return new Response(
        JSON.stringify({ error: "Unable to process the document. Please try uploading a clearer image." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the document was validated as a medical report
    if (result.isValid === false) {
      console.log("Document rejected: not a valid medical report");
      return new Response(
        JSON.stringify({ error: result.error || "This does not appear to be a medical report. Please upload a document from a hospital, clinic, or laboratory." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the valid analysis
    const analysis = {
      summary: result.summary,
      keyFindings: result.keyFindings || [],
      precautions: result.precautions || [],
      nextSteps: result.nextSteps || []
    };

    console.log("Medical report validated and analyzed successfully");

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("analyze-report error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get("Origin")), "Content-Type": "application/json" } }
    );
  }
});