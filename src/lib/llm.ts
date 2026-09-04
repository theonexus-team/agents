/** Thin wrapper around NVIDIA's build.nvidia.com NIM API (OpenAI-compatible chat
 * completions) — used instead of Anthropic's API for the trading-analyst pipeline
 * specifically because it's free-tier/cheaper for this volume of calls. Same
 * NVIDIA_API_KEY env var name as soul-blueprint's Riva integration (NVIDIA API keys
 * are account-wide across NIM endpoints, not per-project) — reuse that key here
 * rather than provisioning a new one. Unrelated to Claude Code itself. */
export async function callLlm(system: string, userMessage: string): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured");

  const model = process.env.NVIDIA_LLM_MODEL || "meta/llama-3.1-70b-instruct";

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NVIDIA NIM API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("NVIDIA NIM API response had no content");
  return text;
}
