import { createOpenAI } from "@ai-sdk/openai";

export const gateway = createOpenAI({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY,
  fetch: async (url, init) => {
    // Fix the Responses API input array before sending.
    if (init?.body && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body);
        if (body.input && Array.isArray(body.input)) {
          const fixedInput: unknown[] = [];
          let modified = false;

          for (const item of body.input) {
            // Case 1: Item has `output` as an array — flatten into individual items
            if (Array.isArray(item.output)) {
              modified = true;
              if (item.content) {
                const { output: _dropped, ...rest } = item;
                fixedInput.push(rest);
              }
              for (const outputItem of item.output) {
                if (typeof outputItem.output !== "undefined" && typeof outputItem.output !== "string") {
                  outputItem.output = outputItem.output == null ? "{}" : JSON.stringify(outputItem.output);
                }
                fixedInput.push(outputItem);
              }
              continue;
            }

            // Case 2: Any item with `output` that isn't a string
            if ("output" in item && typeof item.output !== "string") {
              modified = true;
              item.output = item.output == null ? "{}" : JSON.stringify(item.output);
            }

            fixedInput.push(item);
          }

          if (modified) {
            body.input = fixedInput;
            init = { ...init, body: JSON.stringify(body) };
          }

          // Debug: log the shape of each input item so we can diagnose Responses API rejections
          const shapes = (modified ? fixedInput : body.input).map((item: Record<string, unknown>, i: number) => {
            const keys = Object.keys(item);
            const shape: Record<string, string> = { i: String(i), type: String(item.type ?? "?") };
            if ("output" in item) shape.outputType = typeof item.output === "string" ? `str(${(item.output as string).length})` : `${typeof item.output}${Array.isArray(item.output) ? "[]" : ""}`;
            if ("content" in item) shape.contentType = typeof item.content === "string" ? `str(${(item.content as string).length})` : Array.isArray(item.content) ? `arr(${(item.content as unknown[]).length})` : typeof item.content;
            shape.keys = keys.join(",");
            return shape;
          });
          console.log("[ai-gateway] input shapes:", JSON.stringify(shapes));
        }
      } catch (e) {
        console.error("[ai-gateway] Failed to parse/fix body:", e);
      }
    }

    const res = await fetch(url, init);

    // If the API still rejects, log the full input for diagnosis
    if (res.status === 400) {
      const cloned = res.clone();
      try {
        const errBody = await cloned.json();
        if (errBody?.error?.message?.includes("output")) {
          console.error("[ai-gateway] 400 error:", errBody.error.message);
          // Log the full input that was sent
          if (init?.body && typeof init.body === "string") {
            const sent = JSON.parse(init.body);
            console.error("[ai-gateway] Full input sent:", JSON.stringify(sent.input, null, 2).substring(0, 3000));
          }
        }
      } catch { /* ignore parse errors on error body */ }
    }

    return res;
  },
});
