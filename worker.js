/* =========================================================
   Cloudflare Worker — secure proxy to the OpenAI API
   ---------------------------------------------------------
   Deploy this in the Cloudflare dashboard (Workers & Pages → Create → Worker),
   then add your key under Settings → Variables and Secrets:
       Name: OPENAI_API_KEY   Type: Secret
   The browser only ever talks to this Worker, so the key is never exposed.

   Request body from the site:
     { messages: [{ role, content }, ...], webSearch: boolean }
   Response to the site:
     { reply: string, citations: [{ url, title }] }
   ========================================================= */

const MODEL = "gpt-4o";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // tighten to your GitHub Pages URL if you like
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return json({ error: "Use POST" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json({ error: "No messages provided" }, 400);

    // Pull the system prompt out and send it as "instructions";
    // the rest of the conversation becomes the input.
    const instructions = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const input = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 8000) }))
      .slice(-30); // keep the request a reasonable size

    const payload = {
      model: MODEL,
      instructions,
      input,
      max_output_tokens: 1200,
    };

    // LevelUp: let the model search the web for current info + citations
    if (body.webSearch) {
      payload.tools = [{ type: "web_search_preview" }];
    }

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      return json({ error: data.error?.message || "OpenAI request failed" }, apiResponse.status);
    }

    // Collect the text and any url_citation annotations from the output
    let reply = "";
    const citations = [];
    for (const item of data.output || []) {
      if (item.type !== "message") continue;
      for (const part of item.content || []) {
        if (part.type !== "output_text") continue;
        reply += part.text;
        for (const a of part.annotations || []) {
          if (a.type === "url_citation") citations.push({ url: a.url, title: a.title });
        }
      }
    }

    return json({ reply, citations });
  },
};
