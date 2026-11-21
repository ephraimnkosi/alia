import { Bot, webhookCallback } from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;

if (!token) {
    throw new Error("BOT_TOKEN is missing");
}

const bot = new Bot(token);

bot.command("start", (ctx) => {
    return ctx.reply("Hello! 👋 I'm Alia Bot!");
});

bot.command("help", (ctx) => {
    return ctx.reply("Here are the commands I currently understand:\n/start\n/help");
});

bot.on("message", (ctx) => {
    const message = ctx.message?.text?.toLowerCase();

    if (!message) {
        return;
    }

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

export default webhookCallback(bot);