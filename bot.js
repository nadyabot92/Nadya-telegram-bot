// Load .env only in local development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// 🔐 Validate required environment variables
if (!process.env.TELEGRAM_TOKEN) {
  console.error("❌ TELEGRAM_TOKEN is missing!");
  process.exit(1);
}

if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY is missing!");
  process.exit(1);
}

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: true,
});

console.log("✅ Bot is running...");

// Telegram max message size
const MAX_LENGTH = 4000;

// 📩 Handle incoming messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (!msg.text || msg.text.startsWith("/")) return;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-70b-versatile", // 🔥 Better & more detailed model
        messages: [
          {
            role: "system",
            content:
              "You are a highly detailed academic assistant. Always give long, comprehensive, structured answers. Write with depth, clarity, and full explanations. Use sections, bold titles, and examples where appropriate.",
          },
          {
            role: "user",
            content: msg.text,
          },
        ],
        max_tokens: 1200,
        temperature: 0.8,
        top_p: 0.95,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = response.data.choices[0].message.content;

    console.log("📏 Reply length:", reply.length);

    // ✂️ Split long messages safely
    if (reply.length <= MAX_LENGTH) {
      await bot.sendMessage(chatId, reply);
    } else {
      for (let i = 0; i < reply.length; i += MAX_LENGTH) {
        const chunk = reply.substring(i, i + MAX_LENGTH);
        await bot.sendMessage(chatId, chunk);
      }
    }
  } catch (error) {
    console.error("❌ AI Error:", error.response?.data || error.message);
    await bot.sendMessage(chatId, "⚠️ Error talking to AI.");
  }
});
