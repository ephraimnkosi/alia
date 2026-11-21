import assert from "node:assert/strict";
import { test } from "node:test";
import { chatWithAlia } from "./gemini";

test("Gemini reply includes the user's style and relevant conversation context", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.GEMINI_API_KEY;
    let requestBody: {
        systemInstruction: { parts: Array<{ text: string }> };
        contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    } | undefined;
    let requestUrl = "";
    let requestKey = "";

    process.env.GEMINI_API_KEY = "test-key";
    globalThis.fetch = async (input, init) => {
        requestUrl = String(input);
        requestKey = new Headers(init?.headers).get("x-goog-api-key") ?? "";
        requestBody = JSON.parse(String(init?.body)) as typeof requestBody;
        return new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: "Mochi sounds adorable." }] } }],
        }), { status: 200 });
    };

    try {
        const reply = await chatWithAlia({
            messages: [{ role: "user", content: "I adopted Mochi.", timestamp: "2026-01-01T00:00:00.000Z" }],
            relevantMessages: [{ role: "user", content: "Mochi is my cat.", timestamp: "2025-12-01T00:00:00.000Z" }],
            memories: ["Mochi is a rescue cat."],
            personality: "gentle and funny",
            conversationCount: 1,
        }, "What do you remember about Mochi?");

        assert.equal(reply, "Mochi sounds adorable.");
        assert.match(requestUrl, /models\/gemini-3\.5-flash-lite:generateContent$/);
        assert.equal(requestKey, "test-key");
        assert.ok(requestBody);
        assert.match(requestBody.systemInstruction.parts[0].text, /gentle and funny/);
        assert.match(requestBody.systemInstruction.parts[0].text, /Mochi is my cat/);
        assert.equal(requestBody.contents[0].parts[0].text, "I adopted Mochi.");
        assert.equal(requestBody.contents[0].role, "user");
        assert.equal(requestBody.contents[1].parts[0].text, "What do you remember about Mochi?");
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalApiKey;
    }
});

test("retries temporary Gemini overload responses", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.GEMINI_API_KEY;
    let attempts = 0;

    process.env.GEMINI_API_KEY = "test-key";
    globalThis.fetch = async () => {
        attempts += 1;
        if (attempts < 3) {
            return new Response("temporarily unavailable", { status: 503 });
        }
        return new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: "I'm here." }] } }],
        }), { status: 200 });
    };

    try {
        const reply = await chatWithAlia({
            messages: [],
            relevantMessages: [],
            memories: [],
            personality: "",
            conversationCount: 0,
        }, "Are you there?");

        assert.equal(reply, "I'm here.");
        assert.equal(attempts, 3);
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = originalApiKey;
    }
});
