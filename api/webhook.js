export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const verifyToken = "TOKEN_VERIFICA";
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];
      if (mode === "subscribe" && token === verifyToken) {
        console.log("✅ Webhook verificato da Meta");
        return res.status(200).send(challenge);
      }
      return res.status(403).send("Token di verifica errato");
    }

    if (req.method === "POST") {
      const body = req.body;
      const change = body?.entry?.[0]?.changes?.[0]?.value;

      // 1) Se è un aggiornamento di stato (sent/delivered/read/failed) loggalo e chiudi
      if (change?.statuses?.length) {
        const st = change.statuses[0];
        console.log("📊 STATUS:", {
          id: st.id,
          status: st.status,        // sent, delivered, read, failed
          timestamp: st.timestamp,
          errors: st.errors || null // motivo se failed
        });
        return res.status(200).json({ ok: true });
      }

      // 2) Messaggio in arrivo
      const msg = change?.messages?.[0];
      const fromRaw = msg?.from;
      const text = msg?.text?.body;

      if (fromRaw && text) {
        // normalizza il numero (solo cifre, con prefisso)
        const to = String(fromRaw).replace(/[^0-9]/g, "");

        // risposta base
        let reply = `Hai scritto: "${text}"`;

        // (opzionale) OpenAI
        try {
          if (process.env.OPENAI_API_KEY) {
            const ai = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "Rispondi in modo breve e utile." },
                  { role: "user", content: text }
                ],
              }),
            }).then(r => r.json());
            reply = ai?.choices?.[0]?.message?.content?.slice(0, 900) || reply;
          }
        } catch (e) {
          console.error("OpenAI error:", e);
        }

        // 3) Invio risposta (API v22)
        const url = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
        const payload = {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: reply }
        };

        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
          },
          body: JSON.stringify(payload),
        });

        const out = await r.json().catch(() => ({}));
        console.log("📤 Invio WhatsApp ->", r.status, out);
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).send("Metodo non consentito");
  } catch (err) {
    console.error("❌ Errore nel webhook:", err);
    return res.status(500).send("Errore interno del server");
  }
}

