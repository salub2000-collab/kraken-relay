const express = require("express");
const crypto = require("crypto");
const https = require("https");

const app = express();
app.use(express.json());

// Root health check endpoint
app.get("/", (req, res) => {
  res.send("Kraken Futures Webhook Relay is Active");
});

// Primary Webhook Endpoint for TradingView
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    
    // Kraken Demo Futures API Credentials
    const API_KEY = process.env.KRAKEN_API_KEY || "WKHpL2Ix1gfxxmjce8+8VFBuuicHq6f3i6FhDoT9Ze/Ben/u8FbfYR0g";
    const API_SECRET = process.env.KRAKEN_API_SECRET || "UyV5gJbVKfEeuEEHeii6H8oJG86xa2AVkqGIqeh+6Iq6n5YiegXf3gIryIXxXnXK4pcIirLB6Tqhcb8iAi118A==";

    const symbol = (data.symbol || "pf_solusd").toLowerCase();
    const side = (data.side || data.action || "buy").toLowerCase();
    const orderType = (data.type || data.ordertype || "mkt").toLowerCase();
    const size = String(data.size || data.volume || "1");

    // Correct Kraken Futures API Path
    const endpointPath = "/api/v3/sendorder";
    const hostname = "demo-futures.kraken.com";
    const nonce = Date.now().toString();

    // Form-encoded body payload
    const postData = new URLSearchParams({
      orderType: orderType,
      symbol: symbol,
      side: side,
      size: size
    }).toString();

    // Kraken Futures Signature Algorithm: HMAC-SHA512( SHA256(postData + nonce + endpointPath), API_SECRET )
    const hash = crypto.createHash("sha256").update(postData + nonce + endpointPath).digest();
    const secretBuffer = Buffer.from(API_SECRET, "base64");
    const apiSignature = crypto.createHmac("sha512", secretBuffer).update(hash).digest("base64");

    const requestOptions = {
      hostname: hostname,
      port: 443,
      path: endpointPath,
      method: "POST",
      headers: {
        "APIKey": API_KEY,
        "Authent": apiSignature,
        "nonce": nonce,
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const reqKraken = https.request(requestOptions, (resKraken) => {
      let body = "";
      resKraken.on("data", (chunk) => body += chunk);
      resKraken.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        console.log(`[ORDER RESPONSE] ${side.toUpperCase()} ${size} ${symbol}:`, parsed);
        res.status(200).json({ status: "success", kraken_response: parsed });
      });
    });

    reqKraken.on("error", (err) => {
      console.error("Kraken Request Error:", err);
      res.status(500).json({ status: "error", message: err.message });
    });

    // Write postData payload to the request body stream
    reqKraken.write(postData);
    reqKraken.end();

  } catch (err) {
    console.error("Relay Error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kraken Futures Relay running on port ${PORT}`));
