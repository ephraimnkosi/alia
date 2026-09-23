//
import "dotenv/config";

import { Bot } from "node-telegram-bot-api";
import { run } from "node-telegram-bot-api/node";

const token = process.env.BOT_TOKEN;

if (!token) {
    throw new Error("BOT_TOKEN is missing");
}

const bot = new Bot(token);

bot.command("start", (ctx) => {
    return ctx.reply("Hello! 👋 I'm your Telegram bot!");
});

bot.command("help", (ctx) => {
    return ctx.reply("Available commands:\n/start\n/help");
});


// to reply and stuff
bot.on("message", (ctx) => {
    const message = ctx.message?.text?.toLowerCase();

    if (message === "hello" || message === "hi") {
        return ctx.reply("Hey! 👋 How are you doing?");
    }

    if (message === "how are you") {
        return ctx.reply("I'm doing great! 😎 How about you?");
    }

    if (message === "bye") {
        return ctx.reply("See you later! 👋");
    }

    return ctx.reply(`You said: ${message}`);
});

console.log("Bot is starting...");

async function startBot() {
    await run(bot);
}

startBot();