const crypto = require("crypto");

const isTestMode = () =>
  String(process.env.PAYMENT_MODE || "test").toLowerCase() === "test";

async function initializePayment(transaction, payer) {
  if (isTestMode()) {
    return {
      provider: "test",
      providerReference: transaction.transaction_reference,
      checkoutUrl: null,
      status: "pending",
    };
  }

  if (String(process.env.PAYMENT_PROVIDER || "").toLowerCase() !== "chapa") {
    throw new Error("Unsupported payment provider.");
  }

  const secretKey = process.env.CHAPA_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Chapa payment credentials are not configured.");
  }

  const response = await fetch(
    "https://api.chapa.co/v1/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(transaction.amount).toFixed(2),
        currency: transaction.currency,
        email: payer.email,
        first_name: payer.firstName || "MedAxis",
        last_name: payer.lastName || "Patient",
        tx_ref: transaction.transaction_reference,
        return_url: process.env.PAYMENT_RETURN_URL,
        callback_url: process.env.PAYMENT_CALLBACK_URL,
        customization: {
          title: "MedAxis Hospital",
          description: "Hospital invoice payment",
        },
      }),
      signal: AbortSignal.timeout(20000),
    },
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.status !== "success") {
    throw new Error(
      result.message || "The payment provider could not initialize payment.",
    );
  }

  return {
    provider: "chapa",
    providerReference: transaction.transaction_reference,
    checkoutUrl: result.data?.checkout_url || null,
    status: "pending",
  };
}

async function verifyPayment(transactionReference) {
  if (isTestMode()) {
    throw new Error(
      "Real provider verification is unavailable in test mode. " +
        "Use the protected test simulation endpoint instead.",
    );
  }

  if (String(process.env.PAYMENT_PROVIDER || "").toLowerCase() !== "chapa") {
    throw new Error("Unsupported payment provider.");
  }

  const secretKey = process.env.CHAPA_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Chapa payment credentials are not configured.");
  }

  const response = await fetch(
    `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(
      transactionReference,
    )}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(20000),
    },
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Payment verification failed.");
  }

  const data = result.data || {};

  return {
    status:
      String(data.status).toLowerCase() === "success" ? "success" : "failed",
    providerReference: String(data.reference || transactionReference),
    amount: Number(data.amount),
    currency: String(data.currency || "").toUpperCase(),
  };
}

module.exports = {
  initializePayment,
  verifyPayment,
  isTestMode,
};
