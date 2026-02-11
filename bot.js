// Load .env locally (NOT used on Render)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

/* ===========================
   RENDER PORT FIX (FREE PLAN)
=========================== */

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running.");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

/* ===========================
   ENV VARIABLES
=========================== */

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

/* ===========================
   TELEGRAM BOT INIT
=========================== */

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot is running...");

/* ===========================
   TELEGRAM SAFE MESSAGE SPLIT
=========================== */

const MAX_LENGTH = 4000;

async function sendLongMessage(chatId, text) {
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    await bot.sendMessage(chatId, text.substring(i, i + MAX_LENGTH));
  }
}

/* ===========================
   MESSAGE HANDLER
=========================== */

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text;

  if (!userText || userText.startsWith("/")) return;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",   // ⚡ Much faster
        messages: [
          { role: "system", content: "You are a helpful, intelligent assistant." },
          { role: "user", content: userText }
        ],
        max_tokens: 500,               // Much faster
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = response.data.choices[0].message.content;

    await sendLongMessage(chatId, reply);

  } catch (error) {
    console.error("❌ ERROR:", error.response?.data || error.message);
    bot.sendMessage(chatId, "Error talking to AI.");
  }
});
