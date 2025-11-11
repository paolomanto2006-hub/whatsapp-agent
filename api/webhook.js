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
      console.log("📩 Messaggio ricevuto:", JSON.stringify(body));

      // Estrarre eventuale messaggio testuale in arrivo
      const change = body?.entry?.[0]?.changes?.[0]?.value;
      const msg = change?.messages?.[0];
      const from = msg?.from; // numero del mittente (es. "39329...")
      const text = msg?.text?.body;

      // Rispondiamo solo ai messaggi reali (non a status/ack)
      if (from && text) {
        // (Opzionale) chiamata a OpenAI per generare la risposta
        let reply = `Hai scritto: "${text}"`; // fallback
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
                  { role: "system", content: "Rispondi in modo breve, chiaro e cordiale." },
                  { role: "user", content: text }
                ],
              }),
            }).then(r => r.json());
            reply = ai?.choices?.[0]?.message?.content?.slice(0, 900) || reply;
          }
        } catch (e) {
          console.error("OpenAI error:", e);
        }

        // Invia la risposta via WhatsApp Cloud API
        const url = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
        const payload = {
          messaging_product: "whatsapp",
          to: from,
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

        const out = await r.text();
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
