export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Verifica del webhook da Meta (servirà dopo)
    const verifyToken = 'TOKEN_VERIFICA';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verificato!');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }

  if (req.method === 'POST') {
    const body = req.body;
    console.log('Messaggio ricevuto:', JSON.stringify(body, null, 2));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).send('Method Not Allowed');
}
