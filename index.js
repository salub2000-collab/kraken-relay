const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const API_KEY = process.env.KRAKEN_API_KEY || "V53RS1q+ukUF4mRVYJQ1+yWdy1goe9hX9rO7y7XwuuhPI6q5Y6dwqiKg";
const API_SECRET = process.env.KRAKEN_API_SECRET || "t7h5D58kJfVaxyGT8coLsKSHpv083/J6GQuExmAaHf4v1E/A3/ZszOTZu39LUAJocvsD8cOnBnilpz7jb0sa8w==";

// Health check endpoint for Render
app.get("/", (req, res) => {
  res.send("Kraken Webhook Relay is Active");
});

// Primary Webhook Endpoint
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    
    const action = (data.action || "buy").toLowerCase();
    const symbol = data.symbol || "PF_LINKUSD";
    const volume = String(data.volume || "8");

    const endpointPath = "/derivatives/api/v3/sendorder";
    const url = "https://futures.kraken.com" + endpointPath;
    const nonce = Date.now().toString();

    const side = action === "buy" ? "buy" : "sell";
    const postData = `orderType=mkt&side=${side}&size=${volume}&symbol=${symbol}`;

    // 1. SHA-256 Digest over (postData + nonce + endpointPath)
    const sha256Hash = crypto.createHash("sha256")
      .update(postData + nonce + endpointPath)
      .digest();

    // 2. Base64-decode secret and calculate HMAC-SHA512
    const secretBuffer = Buffer.from(API_SECRET, "base64");
    const apiSignature = crypto.createHmac("sha512", secretBuffer)
      .update(sha256Hash)
      .digest("base64");

    // 3. Send POST request to Kraken Futures
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "APIKey": API_KEY,
        "Authent": apiSignature,
        "Nonce": nonce,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: postData
    });

    const resData = await response.text();
    console.log("Kraken Response:", resData);

    res.status(200).send(resData);
  } catch (err) {
    console.error("Relay Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kraken relay running on port ${PORT}`));
