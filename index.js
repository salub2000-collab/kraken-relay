const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// Root health check
app.get("/", (req, res) => {
  res.send("Kraken Futures Webhook Relay is Active");
});

// Primary Webhook Endpoint
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

    const endpointPath = "/derivatives/api/v3/sendorder";
    const baseUrl = "https://demo-futures.kraken.com";
    const nonce = Date.now().toString();

    // Query string parameters
    const params = new URLSearchParams({
      orderType: orderType,
      symbol: symbol,
      side: side,
      size: size
    });

    const queryString = params.toString();

    // HMAC Signature: SHA512( endpointPath + SHA256( queryString + nonce ), API_SECRET )
    const hash = crypto.createHash("sha256").update(queryString + nonce).digest();
    const secretBuffer = Buffer.from(API_SECRET, "base64");
    const apiSignature = crypto.createHmac("sha512", secretBuffer)
      .update(Buffer.concat([Buffer.from(endpointPath), hash]))
      .digest("base64");

    const targetUrl = `${baseUrl}${endpointPath}?${queryString}`;

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "APIKey": API_KEY,
        "Authent": apiSignature,
        "nonce": nonce,
        "Accept": "application/json"
      }
    });

    const resText = await response.text();
    let resData;
    try {
      resData = JSON.parse(resText);
    } catch (e) {
      resData = resText;
    }

    console.log(`[ORDER EXECUTION] ${side.toUpperCase()} ${size} ${symbol}:`, resData);

    res.status(200).json({ status: "success", kraken_response: resData });
  } catch (err) {
    console.error("Relay Error:", err);
    res.status(500).json({ status: "error", message: err.message, stack: err.stack });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kraken Futures Relay running on port ${PORT}`));
