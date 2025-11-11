// api/webhook.js
// Variabili richieste su Vercel (Settings → Environment Variables):
// - WHATSAPP_TOKEN        (token accesso Meta, meglio permanente)
// - WHATSAPP_PHONE_ID     (Phone Number ID, non il WABA ID)
// - OPENAI_API_KEY        (opzionale: per risposta AI)
// - TOKEN_VERIFICA        (opzionale: se vuoi evitare di hardcodare il token di verifica)

export default async function handler(req, res) {
  try {
    // ---- Verifica webhook (GET) ----
    if (req.method === "GET") {
      const verifyToken = process.env.TOKEN_VERIFICA || "TOKEN_VERIFICA";
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === verifyToken) {
        console.log("✅ Webhook verificato da Meta");
        return res.status(200).send(challenge);
      }
      return res.status(403).send("Token di verifica errato");
    }

    // ---- Ricezione eventi (POST) ----
    if (req.method === "POST") {
      const body = req.body || {};
      const value = body?.entry?.[0]?.changes?.[0]?.value;

      // 1) STATUS (sent/delivered/read/failed)
      if (value?.statuses?.length) {
        for (const st of value.statuses) {
          console.log("📊 STATUS:", {
            id: st.id,
            status: st.status,          // sent, delivered, read, failed
            timestamp: st.timestamp,
            errors: st.errors || null,  // presente se failed
            recipient_id: st.recipient_id
          });
        }
        // non ritorniamo: nello stesso payload potrebbero NON esserci messaggi
      }

      // 2) MESSAGGI IN ARRIVO
      const msg = value?.messages?.[0];
      const fromWaId = msg?.from;                // es: "3932...." (già senza +)
      const text = msg?.text?.body ?? null;

      // procedi solo se c'è un testo da cui partire
      if (fromWaId && text) {
        // normalizza/assicura solo cifre
        const to = String(fromWaId).replace(/[^0-9]/g, "");

        // ---- Risposta (fallback + AI opzionale) ----
        let reply = `Hai scritto: "${text}"`;

        // opzionale: risposta con OpenAI
        if (process.env.OPENAI_API_KEY) {
          try {
            const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "Sei un assistente breve, chiaro e cordiale. Rispondi in italiano." },
                  { role: "user", content: text }
                ]
              })
            }).then(r => r.json());

            reply = aiResp?.choices?.[0]?.message?.content?.slice(0, 900) || reply;
          } catch (e) {
            console.error("OpenAI error:", e);
          }
        }

        // ---- Invio risposta via WhatsApp Cloud API (v22) ----
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
            "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`
          },
          body: JSON.stringify(payload)
        });

        const raw = await r.text();
        let out; try { out = JSON.parse(raw); } catch { out = raw; }
        console.log("📤 Invio WhatsApp ->", r.status, out);
      }

      // Rispondi sempre 200 entro i tempi della function
      return res.status(200).json({ ok: true });
    }

    // Metodi non consentiti
    return res.status(405).send("Metodo non consentito");
  } catch (err) {
    console.error("❌ Errore nel webhook:", err);
    return res.status(500).send("Errore interno del server");
  }
}
