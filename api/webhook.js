export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // Verifica del webhook (Meta chiama questo per confermare il collegamento)
      const verifyToken = "TOKEN_VERIFICA";
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === verifyToken) {
        console.log("✅ Webhook verificato da Meta");
        return res.status(200).send(challenge);
      } else {
        return res.status(403).send("Token di verifica errato");
      }
    }

    if (req.method === "POST") {
      // Ricezione messaggi
      const body = req.body;
      console.log("📩 Messaggio ricevuto:", JSON.stringify(body, null, 2));
      return res.status(200).json({ status: "ricevuto" });
    }

    return res.status(405).send("Metodo non consentito");
  } catch (error) {
    console.error("❌ Errore nel webhook:", error);
    res.status(500).send("Errore interno del server");
  }
}
