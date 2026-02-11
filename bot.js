// Load .env locally only
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

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

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot is running...");

// Telegram max safe message length
const MAX_LENGTH = 4000;

// Function to send long messages safely
async function sendLongMessage(chatId, text) {
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    const chunk = text.substring(i, i + MAX_LENGTH);
    await bot.sendMessage(chatId, chunk);
  }
}

// Function to generate AI response with auto-continue
async function generateLongResponse(userText) {
  let fullReply = "";
  let continueGenerating = true;
  let attempts = 0;

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

Always provide extremely detailed, long-form, structured answers.
Never summarize.
Never shorten.
Write comprehensive explanations with clear headings.
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

    // If reply seems long enough, stop
    if (reply.length < 1500) {
      continueGenerating = false;
    }
  }

  return fullReply.trim();
}

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
