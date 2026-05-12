import { createOpenAI } from "@ai-sdk/openai";

export const gateway = createOpenAI({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY,
  fetch: async (url, init) => {
    // Ensure all function_call_output.output values are strings (Responses API requirement).
    // The AI SDK can produce non-string outputs during multi-turn tool loops.
    if (init?.body && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body);
        if (body.input && Array.isArray(body.input)) {
          let modified = false;
          for (const item of body.input) {
            if (item.type === "function_call_output" && typeof item.output !== "string") {
              item.output = item.output == null ? "" : JSON.stringify(item.output);
              modified = true;
            }
          }
          if (modified) {
            init = { ...init, body: JSON.stringify(body) };
          }
        }
      } catch { /* ignore parse errors */ }
    }
    return fetch(url, init);
  },
});
