const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// Root health check endpoint
app.get("/", (req, res) => {
  res.send("Kraken Webhook Relay is Active");
});

// Primary Webhook Endpoint
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    
    const API_KEY = process.env.KRAKEN_API_KEY || "V53RS1q+ukUF4mRVYJQ1+yWdy1goe9hX9rO7y7XwuuhPI6q5Y6dwqiKg";
    const API_SECRET = process.env.KRAKEN_API_SECRET || "t7h5D58kJfVaxyGT8coLsKSHpv083/J6GQuExmAaHf4v1E/A3/ZszOTZu39LUAJocvsD8cOnBnilpz7jb0sa8w==";

    const action = (data.action || "buy").toLowerCase();
    const symbol = data.symbol || "PF_LINKUSD";
    const volume = String(data.volume || "8");

    const path = "/0/private/AddOrder";
    const url = "https://api.kraken.com" + path;
    const nonce = Date.now().toString();

    // Convert symbols if needed (e.g., PF_LINKUSD -> LINKUSD)
    const pair = symbol.replace("PF_", "");

    const postData = new URLSearchParams({
      nonce: nonce,
      ordertype: "market",
      type: action === "buy" ? "buy" : "sell",
      volume: volume,
      pair: pair
    }).toString();

    // Standard Kraken v1 API Signature Calculation
    const sha256Hash = crypto.createHash("sha256")
      .update(nonce + postData)
      .digest();

    const secretBuffer = Buffer.from(API_SECRET, "base64");
    const apiSignature = crypto.createHmac("sha512", secretBuffer)
      .update(Buffer.concat([Buffer.from(path), sha256Hash]))
      .digest("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "API-Key": API_KEY,
        "API-Sign": apiSignature,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: postData
    });

    const resData = await response.text();
    console.log("Kraken API Response:", resData);

    res.status(200).send(resData);
  } catch (err) {
    console.error("Relay Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kraken relay running on port ${PORT}`));
