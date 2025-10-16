// api/webhook.js
import crypto from "crypto";
import fetch from "node-fetch";

export default async function handler(req, res) {
  let body = "";
  req.on("data", chunk => (body += chunk));
  req.on("end", async () => {
    const secret = process.env.WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    if (!secret || !signature) {
      console.warn("Missing webhook secret or signature");
      return res.status(400).send("Bad request");
    }

    // Verify signature
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (expected !== signature) {
      console.warn("Invalid signature");
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(body);
    console.log("Webhook event:", event.event);

    // Choose which event(s) to forward to Thenty:
    // - subscription.activated (subscription created & active)
    // - invoice.paid (initial invoice/payments)
    // We'll handle invoice.paid and subscription.activated to be safe.
    try {
      if (event.event === "subscription.activated" || event.event === "invoice.paid") {
        // find notes: if event contains subscription payload:
        let notes = null;
        if (event.payload?.subscription?.entity?.notes) {
          notes = event.payload.subscription.entity.notes;
        } else if (event.payload?.invoice?.entity?.subscription_id) {
          // We might need to fetch subscription to read notes - but invoice payload includes subscription id
          const subId = event.payload.invoice.entity.subscription_id;
          // fetch subscription details from Razorpay to read notes
          const razorpay = new (await import("razorpay")).default({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
          });
          const subscription = await razorpay.subscriptions.fetch(subId);
          notes = subscription.notes || null;
        }

        if (notes) {
          // Build payload to send to Thenty (adjust fields to match your Thenty form fields)
          const thentyPayload = {
            name: notes.name,
            email: notes.email,
            phone: notes.contact,
            razorpay_event: event.event,
            subscription_id: event.payload?.subscription?.entity?.id || event.payload?.invoice?.entity?.subscription_id
          };

          // POST to Thenty webhook endpoint
          const thentyUrl = process.env.THENTY_WEBHOOK_URL; // must be set in Vercel
          if (thentyUrl) {
            const forwardRes = await fetch(thentyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(thentyPayload),
            });
            console.log("Forwarded to Thenty, status:", forwardRes.status);
          } else {
            console.warn("THENTY_WEBHOOK_URL not set - skipping forward");
          }
        } else {
          console.warn("No notes found to forward to Thenty");
        }
      }
    } catch (err) {
      console.error("Error handling webhook:", err);
      // still respond 200 to avoid retries? You can respond 500 to retry or 200 to ack.
    }

    res.status(200).json({ ok: true });
  });
}
