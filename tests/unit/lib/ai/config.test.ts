import { describe, expect, it, vi } from "vitest";
import { extractAIResponse, runAI } from "@/lib/ai/config";

describe("runAI", () => {
  it("sends the complete ordered textual history through the native messages request", async () => {
    const run = vi.fn().mockResolvedValue({ response: "done" });
    const ai = { run } as unknown as CloudflareEnv["AI"];
    const messages = [
      { role: "system", content: "System" },
      { role: "user", content: "Question one" },
      { role: "assistant", content: "Answer one" },
      { role: "tool", content: "Tool result", tool_call_id: "call-1" },
      { role: "user", content: "Question two" },
    ];

    await runAI(ai, "CHAT", { messages });

    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith("@cf/openai/gpt-oss-20b", {
      messages,
      max_tokens: 400,
      temperature: 0.1,
    });
  });

  it("uses a native user message for plain text input", async () => {
    const run = vi.fn().mockResolvedValue({ response: "done" });
    const ai = { run } as unknown as CloudflareEnv["AI"];

    await runAI(ai, "GREETING", { text: "Hello" });

    expect(run).toHaveBeenCalledWith("@cf/openai/gpt-oss-20b", {
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 100,
      temperature: 0.1,
    });
  });

  it("preserves supported native roles and rejects ambiguous tool history", async () => {
    const run = vi.fn().mockResolvedValue({ response: "done" });
    const ai = { run } as unknown as CloudflareEnv["AI"];

    await runAI(ai, "CHAT", {
      messages: [{ role: "developer", content: "Verified facts" }],
    });
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      messages: [{ role: "developer", content: "Verified facts" }],
    });
    await expect(runAI(ai, "CHAT", {
      messages: [{ role: "tool", content: "Unbound tool output" }],
    })).rejects.toThrow(/tool_call_id/);
  });
});

describe("extractAIResponse", () => {
  it.each([
    [{ response: "task response" }, "task response"],
    [{ choices: [{ message: { content: "chat completion" } }] }, "chat completion"],
    [{ output_text: "responses convenience text" }, "responses convenience text"],
    [{ output: [{ type: "message", content: [{ type: "output_text", text: "part one" }, { type: "output_text", text: " part two" }] }] }, "part one part two"],
    [{ content: "legacy content" }, "legacy content"],
    [{ text: "legacy text" }, "legacy text"],
  ])("extracts a supported synchronous output variant", (value, expected) => {
    expect(extractAIResponse(value)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    12,
    {},
    { response: 12 },
    { output: "not-an-array" },
    { output: [{ type: "function_call", arguments: "{}" }] },
    { choices: [{ message: { content: null, tool_calls: [{ id: "call-1" }] } }] },
    { tool_calls: [{ name: "lookup" }] },
    { response: "", choices: [] },
    { status: "incomplete", response: "unsafe partial" },
    { status: "in_progress", response: "unsafe partial" },
    { status: "queued", output_text: "unsafe partial" },
    { status: "cancelled", content: "unsafe partial" },
    { status: null, response: "unsafe partial" },
    { error: { message: "failed" }, response: "unsafe partial" },
    { response: "partial", tool_calls: [{ id: "call-1" }] },
    { output_text: "partial", output: [{ type: "function_call", arguments: "{}" }] },
    { choices: [{ finish_reason: "length", message: { content: "truncated" } }] },
    { choices: [{ finish_reason: "tool_calls", message: { content: "mixed", tool_calls: [{ id: "call-1" }] } }] },
    { output: [{ type: "message", content: [{ type: "output_text", text: "mixed" }] }, { type: "function_call", arguments: "{}" }] },
  ])("returns an empty string for malformed or tool-only output", (value) => {
    expect(extractAIResponse(value)).toBe("");
  });

  it("accepts a completed response whose nullable error field is clear", () => {
    expect(extractAIResponse({ status: "completed", error: null, response: "done" }))
      .toBe("done");
  });

  it("does not consume streaming output", () => {
    let pulls = 0;
    const stream = new ReadableStream({
      pull(controller) {
        pulls += 1;
        controller.enqueue("unused");
        controller.close();
      },
    });

    expect(extractAIResponse(stream)).toBe("");
    expect(stream.locked).toBe(false);
    expect(pulls).toBe(0);
  });
});
