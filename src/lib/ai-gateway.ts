import { createOpenAI } from "@ai-sdk/openai";

export const gateway = createOpenAI({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY,
  fetch: async (url, init) => {
    console.log(`[ai-gateway] fetch called: ${typeof url === 'string' ? url : url?.toString()}`);
    // Ensure all output values are strings in the Responses API input array.
    if (init?.body && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body);
        if (body.input && Array.isArray(body.input)) {
          let modified = false;
          for (let i = 0; i < body.input.length; i++) {
            const item = body.input[i];
            // Log all items with output for debugging
            if ("output" in item) {
              const outputType = typeof item.output;
              const isArray = Array.isArray(item.output);
              console.log(`[ai-gateway] input[${i}] has output: type=${item.type}, outputType=${outputType}, isArray=${isArray}`);
              if (outputType !== "string") {
                console.log(`[ai-gateway] Fixing input[${i}].output:`, JSON.stringify(item.output)?.substring(0, 300));
                item.output = item.output == null ? "" : JSON.stringify(item.output);
                modified = true;
              }
            }
          }
          if (modified) {
            init = { ...init, body: JSON.stringify(body) };
          }
        }
      } catch (e) {
        console.error("[ai-gateway] Failed to parse/fix body:", e);
      }
    } else if (init?.body) {
      console.log("[ai-gateway] Body is not a string:", typeof init.body);
    }
    return fetch(url, init);
  },
});
