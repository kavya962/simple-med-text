import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportText, language = "en" } = await req.json();
    
    if (!reportText || typeof reportText !== "string") {
      return new Response(
        JSON.stringify({ error: "Report text is required" }),
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

    const systemPrompt = `You are a compassionate medical report translator who helps patients understand their health reports in simple, clear language. Your goal is to:
1. Explain complex medical terminology in everyday words
2. Highlight important findings without causing unnecessary alarm
3. Provide actionable health advice
4. Be reassuring while remaining accurate

${languageInstructions}

You MUST respond with a valid JSON object using this exact structure:
{
  "summary": "A 2-3 sentence overview of the report in simple terms",
  "keyFindings": ["Finding 1 explained simply", "Finding 2 explained simply", ...],
  "precautions": ["Precaution 1", "Precaution 2", ...],
  "nextSteps": ["Step 1", "Step 2", ...]
}

Keep each finding, precaution, and next step concise (1-2 sentences max).
Include 3-5 items in each array.
ONLY output the JSON, no additional text.`;

    console.log("Calling Lovable AI Gateway for report analysis...");
    
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
          { role: "user", content: `Please analyze this medical report and explain it in simple terms:\n\n${reportText}` }
        ],
        temperature: 0.3,
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
    let analysis;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", content);
      // Fallback structure
      analysis = {
        summary: content.substring(0, 500),
        keyFindings: ["Please upload a clearer report for detailed analysis"],
        precautions: ["Consult with your healthcare provider for personalized advice"],
        nextSteps: ["Schedule a follow-up with your doctor to discuss these results"]
      };
    }

    console.log("Report analysis completed successfully");

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
