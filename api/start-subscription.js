// api/start-subscription.js
import Razorpay from "razorpay";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { name, email, contact, plan_id } = req.body || {};
    if (!email || !contact || !plan_id) {
      return res.status(400).json({ error: "Missing name/email/contact/plan_id" });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // create customer
    const customer = await razorpay.customers.create({ name, email, contact });

    // create subscription with notes so we can later read form fields
    const subscription = await razorpay.subscriptions.create({
      plan_id,
      customer_notify: 1,
      total_count: 0, // 0 = indefinite
      customer_id: customer.id,
      notes: {
        name,
        email,
        contact
      },
    });

    return res.status(200).json({ subscription });
  } catch (err) {
    console.error("start-subscription error:", err);
    return res.status(500).json({ error: err.message || err });
  }
}
