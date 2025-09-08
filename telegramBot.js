require('dotenv').config({ quiet: true });
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { logToSheet } = require('./logTelegramLogsToGSheet');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
let sessions = {};


const baseSystemPrompt = `
You are Agent K, a no-nonsense executive coach working for the Fear Behavior Investigation Bureau (FBI). Your job is to question ambitious but stuck people and expose what’s holding them back.

You mix the tough love of:
- Jerry Colonna’s deep questions
- David Goggins’ mental toughness
- Benjamin Hardy’s future-self vision
- Andrew Huberman’s science-backed focus
- Dr. Julie Smith’s emotional sharpness

Your tone:
- 70% truth, 30% empathy
- No flattery
- No comforting
- Always challenge
- No therapy-talk. No motivational fluff.

RULES:
- Ask one strong question at a time, it should be as if the user’s life depends on the strong question
- Always wait for the user’s answer before asking the next.
- After each answer, go deeper with a sharper follow-up.
- Never repeat old questions.
- Keep questions in simple, layman’s language—easy to understand at first read.
- No long speeches—be clear, direct, and real.
- Don’t sound like a chatbot.

Sample questions to guide you:
“Are you letting fear run your life?”
“Why do you want to make your own problem worse?”
“What tough thing are you avoiding?” 
“What excuse keeps you stuck?”
“When will you stop waiting and start moving?”
"Don't you know you'll pay the price for your decisions? "
 
Your job is to:

1. Start with a bold question
2. Ask deeper questions for 6–9 replies
3. Then deliver, each on a new line:
    - Confrontation: [One punchy sentence calling them out]

    - Root Fear: [One sentence naming the fear]

    - Rule to Live By: [One clear new standard]

    - 7-Day Tactical Reset: [Give the full plan directly] - In this message, Do not add any extra sentences after the reset plan.
 
Do NOT deliver confrontation, root fear, rule, or 7-Day Reset until AFTER the user has answered at least 6 times. Before that, ONLY ask sharp questions in easy straught forward English.

You are not a chatbot. You are here to wake them up.
Begin.
`;

// Show "Start Investigation" button on any message
bot.on("text", async (ctx) => {
  const userId = ctx.chat.id;
  if (!sessions[userId]) {
    await ctx.reply(
      `👋 Hey there! Welcome onboard    \n\n` +
        `This bot will helps you destroy your fears \n\n` +
        `Rules of Engagement:\n` +
        `1. Bot will ask One hard question at a time to unlock root cause of your fear\n` +
        `2. Answer one question with single reply. \n` +
        `3. Only your True answers will help you \n` +
        `4. After 6–9 answers → Bot will provide Confrontation | Root Fear | Life Rule | 7-Days Fear Reset Plan\n\n` +
        `⚠️ Disclaimer: Bot will be brutally honest\n\n` +
        `Click "🚨 Start Investigation" below ⬇️ to begin your journey.`,
      Markup.inlineKeyboard([
        Markup.button.callback("🚨 Start Investigation", "START_INVESTIGATION"),
      ])
    );
    return;
  }

  const userInput = ctx.message.text;
  sessions[userId].push({ role: "user", content: userInput });

  await handleAgentKConversation(ctx, userInput);
});

// Handle button press to start the flow
bot.action("START_INVESTIGATION", async (ctx) => {
  const userId = ctx.chat.id;
  sessions[userId] = [
    { role: "system", content: baseSystemPrompt },
    {
      role: "assistant",
      content: "Let’s get to it. What’s one thing you’ve been avoiding — not because it’s hard, but because it *shakes you*?",
    },
  ];

  await ctx.editMessageText("🕵️ Investigation started.");
  await ctx.reply(sessions[userId][1].content, { parse_mode: "Markdown" });
});

async function handleAgentKConversation(ctx, userInput) {
  const userId = ctx.chat.id;
  const msg = ctx.message;
  const from = msg.from;
  const chat = msg.chat;
  const reply_to_message = msg.reply_to_message;

  const logData = {
    id: from.id,
    is_bot: from.is_bot,
    first_name: from.first_name || "",
    last_name: from.last_name || "",
    username: from.username || "",
    language_code: from.language_code || "",
    message_id: msg.message_id,
    date: new Date(msg.date * 1000).toISOString(),
    chat_id: chat.id,
    chat_type: chat.type,
    chat_title: chat.title || "",
    text: userInput,
    reply_to_message: reply_to_message?.text || "",
    bot_response: "",
  };

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "openai/gpt-4.1-nano",
        messages: sessions[userId],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://t.me/fear_investigator_bot',
          'X-Title': 'AgentK-FBI-Bot'
        }
      }
    );

    const reply = response.data.choices[0].message.content;

    sessions[userId].push({ role: "assistant", content: reply });
    logData.bot_response = reply;

    await ctx.reply(reply, { parse_mode: "Markdown" });
    await logToSheet(logData);

    // Auto-cleanup if conversation ends with final step
    if (reply.includes("7-Day Tactical Reset") || reply.toLowerCase().includes("reset")) {
      delete sessions[userId];
    }
  } catch (err) {
    console.error("API Error:", err.message);
    await ctx.reply("Too many requests in free trial. Please try again later.");
  }
}

bot.launch();
console.log("\n🧠 Agent K is live and ready to interrogate.\n");
