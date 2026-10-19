const express = require("express");
const crypto = require("crypto");
const https = require("https");

const app = express();
app.use(express.json());

// Root health check endpoint
app.get("/", (req, res) => {
  res.send("Kraken Futures Webhook Relay is Active");
});

// Primary Webhook Endpoint for TradingView Alerts
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
    const hostname = "demo-futures.kraken.com";
    const nonce = Date.now().toString();

    // Build URL query string
    const queryParams = new URLSearchParams({
      orderType: orderType,
      symbol: symbol,
      side: side,
      size: size
    }).toString();

    // Futures HMAC-SHA512 Signature Calculation
    const hash = crypto.createHash("sha256").update(queryParams + nonce).digest();
    const secretBuffer = Buffer.from(API_SECRET, "base64");
    const apiSignature = crypto.createHmac("sha512", secretBuffer)
      .update(Buffer.concat([Buffer.from(endpointPath), hash]))
      .digest("base64");

    const requestOptions = {
      hostname: hostname,
      port: 443,
      path: `${endpointPath}?${queryParams}`,
      method: "POST",
      headers: {
        "APIKey": API_KEY,
        "Authent": apiSignature,
        "nonce": nonce,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    };

    // Direct HTTPS Request Execution
    const krakenReq = https.request(requestOptions, (krakenRes) => {
      let body = "";
      krakenRes.on("data", (chunk) => body += chunk);
      krakenRes.on("end", () => {
        let parsedBody;
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          parsedBody = body;
        }
        console.log(`[ORDER EXECUTION] ${side.toUpperCase()} ${size} ${symbol}:`, parsedBody);
        res.status(200).json({ status: "success", kraken_response: parsedBody });
      });
    });

    krakenReq.on("error", (err) => {
      console.error("Kraken HTTPS Request Error:", err);
      res.status(500).json({ status: "error", message: err.message });
    });

    krakenReq.end();
  } catch (err) {
    console.error("Relay Internal Error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kraken Futures Relay running on port ${PORT}`));
