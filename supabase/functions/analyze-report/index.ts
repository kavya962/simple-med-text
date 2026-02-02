import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("Authenticated user:", userId);

    const { reportText, imageData, pdfData, language = "en" } = await req.json();
    
    if (!reportText && !imageData && !pdfData) {
      return new Response(
        JSON.stringify({ error: "Please upload a medical report (PDF, image, or text file)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to analyze report" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "Failed to get analysis from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response
    let result;
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", content);
      return new Response(
        JSON.stringify({ error: "Failed to process the document. Please try uploading a clearer medical report." }),
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});