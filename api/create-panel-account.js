// api/create-panel-account.js

export default async function handler(req, res) {
  // ==============================
  // CORS
  // ==============================
  res.setHeader("Access-Control-Allow-Origin", "*");
  // kalau mau lebih ketat, ganti "*" jadi:
  // "https://markett-pi.vercel.app"
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Hanya izinkan POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { username, product_id, order_id, amount } = req.body || {};

    if (!username || !product_id || !order_id || !amount) {
      return res.status(400).json({
        error: "username, product_id, order_id, amount wajib diisi",
      });
    }

    // ==============================
    // KONFIGURASI PTERODACTYL
    // ==============================
    const PTERO_API_URL = process.env.PTERO_API_URL;      // https://panel.kamu.com
    const PTERO_API_KEY = process.env.PTERO_API_KEY;      // Application API key (/admin/api)
    const LOGIN_URL     = process.env.PTERO_LOGIN_URL || PTERO_API_URL;

    const PTERO_EGG_ID        = Number(process.env.PTERO_EGG_ID || "15");
    const PTERO_ALLOCATION_ID = Number(process.env.PTERO_ALLOCATION_ID || "1");
    const PTERO_DOCKER_IMAGE  = process.env.PTERO_DOCKER_IMAGE || "ghcr.io/parkervcp/yolks:nodejs_18";
    const PTERO_STARTUP       = process.env.PTERO_STARTUP || "npm start";

    if (!PTERO_API_URL || !PTERO_API_KEY) {
      return res.status(500).json({
        error: "PTERO_API_URL / PTERO_API_KEY belum diset di Environment Vercel",
      });
    }

    if (!PTERO_EGG_ID || !PTERO_ALLOCATION_ID) {
      return res.status(500).json({
        error: "PTERO_EGG_ID / PTERO_ALLOCATION_ID belum diset di Environment Vercel",
      });
    }

    // ==============================
    // PLAN CONFIG (RAM / DISK / CPU)
    // ==============================
    const PLAN_CONFIG = {
      "panel-1gb":  { memory: 1024,  disk: 10240,  cpu: 100 },
      "panel-2gb":  { memory: 2048,  disk: 20480,  cpu: 150 },
      "panel-3gb":  { memory: 3072,  disk: 30720,  cpu: 200 },
      "panel-4gb":  { memory: 4096,  disk: 40960,  cpu: 250 },
      "panel-5gb":  { memory: 5120,  disk: 51200,  cpu: 300 },
      "panel-6gb":  { memory: 6144,  disk: 61440,  cpu: 350 },
      "panel-7gb":  { memory: 7168,  disk: 71680,  cpu: 400 },
      "panel-8gb":  { memory: 8192,  disk: 81920,  cpu: 450 },
      "panel-9gb":  { memory: 9216,  disk: 92160,  cpu: 500 },
      "panel-10gb": { memory: 10240, disk: 102400, cpu: 550 },
      "panel-unli": { memory: 0,     disk: 0,      cpu: 0   }, // sesuaikan manual di panel kalau perlu
    };

    const plan = PLAN_CONFIG[product_id];
    if (!plan) {
      return res.status(400).json({
        error: "product_id bukan paket panel RAM yang dikenali",
      });
    }

    // username → email dummy
    const email = `${username}@example.com`;

    // generate password random
    function randomPass(len) {
      const chars =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let out = "";
      for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
      return out;
    }

    const password = randomPass(10);

    console.log("Create panel user:", { username, email, order_id, amount });

    // ==============================
    // 1) CREATE USER
    // ==============================
    const createUserRes = await fetch(
      `${PTERO_API_URL.replace(/\/+$/, "")}/api/application/users`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${PTERO_API_KEY}`,
        },
        body: JSON.stringify({
          username,
          email,
          first_name: username,
          last_name: "User",
          password,
        }),
      }
    );

    const userText = await createUserRes.text();
    let userJson;
    try {
      userJson = JSON.parse(userText);
    } catch {
      userJson = userText;
    }

    if (!createUserRes.ok) {
      console.error("Ptero create user error:", createUserRes.status, userJson);
      return res.status(createUserRes.status).json({
        error: "Gagal membuat user panel",
        status: createUserRes.status,
        response: userJson,
      });
    }

    const userAttr = userJson.attributes || userJson;
    const userId = userAttr.id;

    console.log("Panel user created:", userId);

    // ==============================
    // 2) CREATE SERVER
    // ==============================
    console.log("Create server for user:", userId, "plan:", product_id);

    const serverBody = {
      name: `srv-${username}`,
      description: `Order ${order_id} • plan ${product_id}`,
      user: userId,
      egg: PTERO_EGG_ID,
      docker_image: PTERO_DOCKER_IMAGE,
      startup: PTERO_STARTUP,
      limits: {
        memory: plan.memory,  // MB
        swap: 0,
        disk: plan.disk,      // MB
        io: 500,
        cpu: plan.cpu || 100, // %
      },
      feature_limits: {
        databases: 1,
        allocations: 1,
        backups: 1,
      },
      allocation: {
        default: PTERO_ALLOCATION_ID,
      },
      environment: {
            INST: "npm",
            USER_UPLOAD: "0",
            AUTO_UPDATE: "0",
            CMD_RUN: "npm start"
          },
    };

    const createServerRes = await fetch(
      `${PTERO_API_URL.replace(/\/+$/, "")}/api/application/servers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${PTERO_API_KEY}`,
        },
        body: JSON.stringify(serverBody),
      }
    );

    const serverText = await createServerRes.text();
    let serverJson;
    try {
      serverJson = JSON.parse(serverText);
    } catch {
      serverJson = serverText;
    }

    if (!createServerRes.ok) {
      console.error(
        "Ptero create server error:",
        createServerRes.status,
        serverJson
      );
      // User sudah berhasil, server gagal → tetap 200 supaya front-end tahu user created,
      // tapi info error server dikirim untuk admin.
      return res.status(200).json({
        success: true,
        warning: "User panel berhasil dibuat, tetapi gagal membuat server",
        panel: {
          username,
          password,
          login_url: LOGIN_URL,
        },
        serverError: {
          status: createServerRes.status,
          response: serverJson,
        },
      });
    }

    console.log("Server created for user:", username);

    return res.status(200).json({
      success: true,
      panel: {
        username,
        password,
        login_url: LOGIN_URL,
      },
      server: serverJson,
    });
  } catch (err) {
    console.error("create-panel-account ERROR:", err);
    return res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
}
