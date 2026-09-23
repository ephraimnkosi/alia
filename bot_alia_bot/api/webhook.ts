import { Bot } from "node-telegram-bot-api";

const token = process.env.BOT_TOKEN;

if (!token) {
    throw new Error("BOT_TOKEN is missing");
}

const bot = new Bot(token);

export default async function handler(req: any, res: any) {
    if (req.method !== "POST") {
        return res.status(405).json({
            message: "Method not allowed"
        });
    }

    console.log("Telegram sent us an update!");

    return res.status(200).json({
        message: "Update received"
    });
}