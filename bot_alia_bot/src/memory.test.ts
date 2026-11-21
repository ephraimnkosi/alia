import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { MemoryStore } from "./memory";

const temporaryDirectories: string[] = [];

after(async () => {
    await Promise.all(temporaryDirectories.map((directory) =>
        rm(directory, { recursive: true, force: true }),
    ));
});

async function createMemoryStore(): Promise<{ directory: string; memory: MemoryStore }> {
    const directory = await mkdtemp(join(tmpdir(), "alia-memory-"));
    temporaryDirectories.push(directory);
    return { directory, memory: new MemoryStore(join(directory, "memory.json")) };
}

test("conversation, notes, and personality persist across restarts", async () => {
    const { directory, memory: firstRun } = await createMemoryStore();
    await firstRun.addMessage(101, "user", "I enjoy hiking with my dog.");
    await firstRun.addMessage(101, "assistant", "That sounds lovely.");
    await firstRun.remember(101, "My dog's name is Pippin.");
    await firstRun.setPersonality(101, "playful and concise");

    const restored = new MemoryStore(join(directory, "memory.json"));
    const profile = await restored.getProfile(101);

    assert.equal(profile.conversationCount, 2);
    assert.deepEqual(profile.memories, ["My dog's name is Pippin."]);
    assert.equal(profile.personality, "playful and concise");
    assert.equal(profile.messages[0].content, "I enjoy hiking with my dog.");
});

test("older relevant conversation can be recalled without exposing another user", async () => {
    const { memory } = await createMemoryStore();
    await memory.addMessage(201, "user", "My favorite bakery is the one on Cedar Street.");
    for (let index = 0; index < 14; index += 1) {
        await memory.addMessage(201, "user", `Unrelated conversation number ${index}.`);
        await memory.addMessage(201, "assistant", "Thanks for telling me.");
    }
    await memory.addMessage(202, "user", "My favorite bakery is on Oak Avenue.");

    const profile = await memory.getProfile(201, "Which bakery did I mention on Cedar Street?");
    const otherUser = await memory.getProfile(202, "bakery");

    assert.ok(profile.relevantMessages.some((message) => message.content.includes("Cedar Street")));
    assert.equal(profile.messages.some((message) => message.content.includes("Oak Avenue")), false);
    assert.equal(otherUser.messages[0].content, "My favorite bakery is on Oak Avenue.");
});

test("forget removes all of one user's data without affecting others", async () => {
    const { memory } = await createMemoryStore();
    await memory.addMessage(301, "user", "Remember my plans.");
    await memory.remember(301, "Trip to Iceland");
    await memory.setPersonality(301, "cheerful");
    await memory.remember(302, "Loves jazz");

    await memory.forget(301);

    const forgotten = await memory.getProfile(301);
    const retained = await memory.getProfile(302);
    assert.equal(forgotten.conversationCount, 0);
    assert.deepEqual(forgotten.memories, []);
    assert.equal(forgotten.personality, "");
    assert.deepEqual(retained.memories, ["Loves jazz"]);
});
