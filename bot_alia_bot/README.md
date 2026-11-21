# Alia Telegram companion

Alia is a private, AI-powered Telegram companion. Run the bot on your computer and talk to it from Telegram.

## Setup

1. Install Node.js 20.6 or newer.
2. Create a Telegram bot with [@BotFather](https://t.me/BotFather) and copy its token.
3. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and add `GEMINI_API_KEY` to `.env` alongside `BOT_TOKEN`. `GEMINI_MODEL` is optional; it defaults to `gemini-3.5-flash-lite`.
4. In `bot_alia_bot`, run `npm install`, then `npm start`.
5. Open your bot in Telegram and send `/start`.

The computer must stay on and connected to the internet while you use the bot. `npm run dev` starts the bot in watch mode; `npm run typecheck` and `npm test` run the checks.

## Conversation and memory

- Alia sends recent conversation context to the AI and saves the full text history locally in `data/memory.json`. Older messages with matching topics can be retrieved to help Alia recall past conversations.
- Each Telegram user has a separate history, saved notes, and personality preference. Personal chats are supported; group messages are not saved or sent to the AI.
- Use `/personality <style>` to customize how Alia talks, `/remember <note>` to save a detail, and `/memory` to review saved details.
- Use `/forget` to delete your conversation history, notes, and style. Keep `data/memory.json` private; it contains your conversations. This file is excluded from Git.
- Conversation messages are sent to the Google Gemini API to generate replies. Avoid sharing information you do not want processed by that service.
