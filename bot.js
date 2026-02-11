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

if (!TELEGRAM_TOKEN) {
  console.error("❌ TELEGRAM_TOKEN is missing!");
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY is missing!");
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
    const chunk = text.substring(i, i + MAX_LENGTH);
    await bot.sendMessage(chatId, chunk);
  }
}

/* ===========================
   AI GENERATION (AUTO-CONTINUE)
=========================== */

async function generateLongResponse(userText) {
  let fullReply = "";
  let attempts = 0;
  let continueGenerating = true;

  while (continueGenerating && attempts < 3) {
    attempts++;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-70b-versatile",
        messages: [
          {
            role: "system",
            content: `
You are a professional academic writer and historian.

Always provide extremely detailed, structured, long-form responses.
Never summarize.
Never shorten.
Write comprehensive explanations with headings.
If the topic is large, continue chronologically without stopping.
`
          },
          {
            role: "user",
            content:
              attempts === 1
                ? userText + " Give a very long, detailed academic explanation."
                : "Continue from where you stopped. Do not repeat previous text."
          }
        ],
        max_tokens: 2000,
        temperature: 0.9
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = response.data.choices[0].message.content;

    console.log("📏 Reply length:", reply.length);

    fullReply += "\n" + reply;

    // If reply becomes shorter, assume model finished
    if (reply.length < 1500) {
      continueGenerating = false;
    }
  }

  return fullReply.trim();
}

/* ===========================
   MESSAGE HANDLER
=========================== */

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (!msg.text || msg.text.startsWith("/")) return;

  try {
    await bot.sendMessage(chatId, "⏳ Generating detailed response...");

    const reply = await generateLongResponse(msg.text);

    await sendLongMessage(chatId, reply);

  } catch (error) {
    console.error("❌ ERROR:", error.response?.data || error.message);
    bot.sendMessage(chatId, "Error talking to AI.");
  }
});
