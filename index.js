const express = require('express');
const { bot } = require('./telegramBot');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Agent K is operational.');
});

// Webhook secret path
app.use(bot.webhookCallback('/agentk-secret-9328'));

// Set webhook only once
async function setWebhookOnce() {
  try {
    const webhookInfo = await bot.telegram.getWebhookInfo();
    const currentUrl = webhookInfo.url;
    const desiredUrl = 'https://fear-investigator-2.onrender.com/agentk-secret-9328';

    if (currentUrl !== desiredUrl) {
      await bot.telegram.setWebhook(desiredUrl);
      console.log('✅ Webhook successfully set.');
    } else {
      console.log('✅ Webhook already set. No need to reset.');
    }
  } catch (err) {
    console.error('❌ Failed to set webhook:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  setWebhookOnce();  // ✅ Call once at startup
});
