const express = require("express");
const crypto = require("crypto");
const https = require("https");

const app = express();
app.use(express.json());

// Root health check endpoint
app.get("/", (req, res) => {
  res.send("Kraken Futures Webhook Relay is Active");
});

// Helper function to handle HTTPS requests with redirect support
function makeKrakenRequest(hostname, endpointPath, queryParams, apiKey, apiSignature, nonce) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: hostname,
      port: 443,
      path: `${endpointPath}?${queryParams}`,
      method: "POST",
      headers: {
        "APIKey": apiKey,
        "Authent": apiSignature,
        "nonce": nonce,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "NodeJS-Kraken-Relay"
      }
    };

    const req = https.request(requestOptions, (res) => {
      // Handle HTTP redirects (301, 302, 307, 308)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, `https://${hostname}`);
        return makeKrakenRequest(
          redirectUrl.hostname,
          redirectUrl.pathname,
          redirectUrl.search ? redirectUrl.search.substring(1) : queryParams,
          apiKey,
          apiSignature,
          nonce
        ).then(resolve).catch(reject);
      }

      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.end();
  });
}

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

    // Exact casing for Kraken Futures API: /derivatives/api/v3/sendOrder
    const endpointPath = "/derivatives/api/v3/sendOrder";
    const hostname = "demo-futures.kraken.com";
    const nonce = Date.now().toString();

    // Query parameters
    const queryParams = new URLSearchParams({
      orderType: orderType,
      symbol: symbol,
      side: side,
      size: size
    }).toString();

    // Futures HMAC Signature Calculation: SHA512( endpointPath + SHA256( queryParams + nonce ), API_SECRET )
    const hash = crypto.createHash("sha256").update(queryParams + nonce).digest();
    const secretBuffer = Buffer.from(API_SECRET, "base64");
    const apiSignature = crypto.createHmac("sha512", secretBuffer)
      .update(Buffer.concat([Buffer.from(endpointPath), hash]))
      .digest("base64");

    const response = await makeKrakenRequest(hostname, endpointPath, queryParams, API_KEY, apiSignature, nonce);

    console.log(`[ORDER EXECUTION] ${side.toUpperCase()} ${size} ${symbol}:`, response);
    res.status(200).json({ status: "success", kraken_response: response });

  } catch (err) {
    console.error("Relay Error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kraken Futures Relay running on port ${PORT}`));
