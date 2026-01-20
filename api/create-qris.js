export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, order_id } = req.body || {};

    if (!amount || !order_id) {
      return res.status(400).json({ error: "amount dan order_id wajib diisi" });
    }

    const project = process.env.PAKASIR_PROJECT;
    const api_key = process.env.PAKASIR_API_KEY;

    if (!project || !api_key) {
      return res.status(500).json({ error: "Konfigurasi server belum lengkap" });
    }

    const pakasirRes = await fetch(
      "https://app.pakasir.com/api/transactioncreate/qris",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, api_key, order_id, amount })
      }
    );

    const data = await pakasirRes.json();
    return res.status(pakasirRes.status).json(data);
  } catch (err) {
    console.error("Error create-qris:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
