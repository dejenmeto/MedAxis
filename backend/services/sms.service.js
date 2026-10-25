async function sendSms({ to, message }) {
  if (!process.env.SMS_API_URL || !process.env.SMS_API_TOKEN) {
    throw new Error("SMS provider is not configured. Check SMS API settings.");
  }

  if (!to || !message) {
    throw new Error("SMS recipient and message are required.");
  }

  const response = await fetch(process.env.SMS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SMS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, message }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`SMS provider returned HTTP ${response.status}.`);
  }

  const responseText = await response.text();
  let result = {};

  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    result = {};
  }

  return {
    messageId: result.messageId || result.message_id || result.id || null,
  };
}

module.exports = { sendSms };
