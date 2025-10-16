// api/verify-subscription.js
import Razorpay from "razorpay";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { razorpay_payment_id, razorpay_subscription_id } = req.body || {};
    if (!razorpay_payment_id || !razorpay_subscription_id) {
      return res.status(400).json({ error: "Missing razorpay_payment_id or razorpay_subscription_id" });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // 1) Check payment status
    let payment;
    try {
      payment = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (err) {
      console.error("Error fetching payment:", err);
      return res.status(500).json({ error: "Failed to fetch payment" });
    }

    if (!payment || payment.status !== "captured") {
      return res.status(400).json({ error: "Payment not captured", payment });
    }

    // 2) Check subscription status
    let subscription;
    try {
      subscription = await razorpay.subscriptions.fetch(razorpay_subscription_id);
    } catch (err) {
      console.error("Error fetching subscription:", err);
      return res.status(500).json({ error: "Failed to fetch subscription" });
    }

    if (!subscription || !["active", "authenticated"].includes(subscription.status)) {
      // 'authenticated' may be intermediate, but best to check 'active'
      return res.status(400).json({ error: "Subscription not active", subscription });
    }

    // Optionally: read notes from subscription to get the original form data
    const notes = subscription.notes || {};

    // OPTIONAL: save the verified submission somewhere (Google Sheets / DB)
    // If you want, call an Apps Script or DB here. See note below.

    // success
    return res.status(200).json({ ok: true, notes, payment, subscription });
  } catch (err) {
    console.error("verify-subscription error:", err);
    return res.status(500).json({ error: err.message || err });
  }
}
