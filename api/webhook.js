const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Handle Meta WhatsApp Verification Challenge (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'waproperties_secret_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WhatsApp Webhook verified successfully');
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('Verification token mismatch');
    }
  }

  // Handle Incoming WhatsApp Webhook (POST)
  if (req.method === 'POST') {
    const body = req.body || {};
    console.log('Received WhatsApp Webhook event:', JSON.stringify(body, null, 2));

    let sender = "+923001234567";
    let messageText = "";

    try {
      if (body.entry && body.entry[0]?.changes && body.entry[0].changes[0]?.value) {
        const val = body.entry[0].changes[0].value;
        if (val.messages && val.messages[0]) {
          sender = val.messages[0].from;
          messageText = val.messages[0].text?.body || "";
        }
      }
    } catch (e) {
      console.error("Error parsing message", e);
    }

    return res.status(200).json({
      status: "received",
      sender,
      messageText,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
