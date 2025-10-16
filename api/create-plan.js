// api/create-plan.js
import Razorpay from "razorpay";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const plan = await razorpay.plans.create({
      period: "monthly",
      interval: 1,
      item: {
        name: "Monthly Subscription - ₹149",
        amount: 14900,
        currency: "INR",
      },
    });
    res.status(200).json(plan);
  } catch (err) {
    console.error("create-plan:", err);
    res.status(500).json({ error: err.message });
  }
}
