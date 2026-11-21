import { Bot } from "node-telegram-bot-api";
import { run } from "node-telegram-bot-api/node";
import { resolve } from "node:path";
import { chatWithAlia } from "./gemini";
import { MemoryStore } from "./memory";

const token = process.env.BOT_TOKEN;

if (!token) {
    throw new Error("BOT_TOKEN is missing");
}

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
}

const bot = new Bot(token);
const memory = new MemoryStore(resolve(process.cwd(), "data", "memory.json"));

bot.command("start", (ctx) => {
    return ctx.reply(
        "Hi, I'm Alia. I'm here for a real conversation: tell me what's on your mind, and I'll do my best to remember what matters to you. Use /help to see how to personalize me or manage your memory.",
    );
});

bot.command("help", (ctx) => {
    return ctx.reply(
        [
            "Just send me a message to chat.",
            "",
            "/personality <style> — choose how I talk with you",
            "/personality — see your current style",
            "/remember <note> — save something important",
            "/memory — review what I've saved",
            "/forget — delete your conversation and saved details",
            "/help — show this help",
        ].join("\n"),
    );
});

bot.command("personality", async (ctx) => {
    if (ctx.chat?.type !== "private") {
        return ctx.reply("Please message me directly to change your personal settings.");
    }

    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const style = typeof ctx.match === "string" ? ctx.match.trim() : "";
    if (!style) {
        const profile = await memory.getProfile(userId);
        return ctx.reply(
            profile.personality
                ? `Your preferred style is: ${profile.personality}\nTo change it, send /personality followed by a style.`
                : "I aim to be warm, thoughtful, and natural. To customize me, send /personality followed by a style, like /personality be playful and concise.",
        );
    }

    if (style.length > 500) {
        return ctx.reply("Please keep your style description under 500 characters.");
    }

    await memory.setPersonality(userId, style);
    return ctx.reply("Got it — I'll keep that style in mind when we talk.");
});

bot.command("remember", async (ctx) => {
    if (ctx.chat?.type !== "private") {
        return ctx.reply("Please message me directly to save a personal memory.");
    }

    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const note = typeof ctx.match === "string" ? ctx.match.trim() : "";
    if (!note) {
        return ctx.reply("Tell me what you'd like me to remember, for example: /remember My sister is named Maya.");
    }
    if (note.length > 500) {
        return ctx.reply("Please keep each memory under 500 characters.");
    }

    await memory.remember(userId, note);
    return ctx.reply("I'll remember that.");
});

bot.command("memory", async (ctx) => {
    if (ctx.chat?.type !== "private") {
        return ctx.reply("Please message me directly to review your personal memory.");
    }

    const userId = ctx.from?.id;
    if (userId === undefined) return;

    const profile = await memory.getProfile(userId);
    const details = [
        profile.personality ? `Your preferred style: ${profile.personality}` : undefined,
        profile.memories.length > 0
            ? `Saved notes:\n${profile.memories.map((note) => `• ${note}`).join("\n")}`
            : undefined,
        `${profile.conversationCount} conversation messages saved on this host.`,
    ].filter(Boolean);

    return ctx.reply(
        `Here's what I remember:\n${details.join("\n\n")}\n\nUse /forget to delete all of it.`,
    );
});

bot.command("forget", async (ctx) => {
    if (ctx.chat?.type !== "private") {
        return ctx.reply("Please message me directly to manage your personal memory.");
    }

    const userId = ctx.from?.id;
    if (userId === undefined) return;

    await memory.forget(userId);
    return ctx.reply("I've deleted your conversation history, saved notes, and preferred style.");
});

bot.on("message", (ctx) => {
    const message = ctx.message?.text?.trim();
    const userId = ctx.from?.id;

    if (!message || userId === undefined || message.startsWith("/")) {
        return;
    }

    if (ctx.chat?.type !== "private") {
        return ctx.reply("For a private conversation, message me directly.");
    }

    return handleConversation(userId, message, (text) => ctx.reply(text));
});

console.log("Bot is starting...");

async function handleConversation(
    userId: number,
    message: string,
    reply: (text: string) => Promise<unknown>,
): Promise<void> {
    try {
        const profile = await memory.getProfile(userId);
        await memory.addMessage(userId, "user", message);
        const answer = await chatWithAlia(profile, message);
        await memory.addMessage(userId, "assistant", answer);
        await reply(answer);
    } catch (error) {
        console.error("Could not complete the conversation:", error);
        await reply("I couldn't reach my conversation service just now. Please try again in a moment.");
    }
}

async function startBot(): Promise<void> {
    await run(bot);
}

startBot().catch((error: unknown) => {
    console.error("The bot stopped unexpectedly:", error);
    process.exitCode = 1;
});