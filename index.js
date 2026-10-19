import os
from flask import Flask, request, jsonify
from kraken.futures import Market

app = Flask(__name__)

# Initialize official Kraken Futures SDK client in sandbox mode
API_KEY = os.getenv("KRAKEN_API_KEY", "WKHpL2Ix1gfxxmjce8+8VFBuuicHq6f3i6FhDoT9Ze/Ben/u8FbfYR0g")
API_SECRET = os.getenv("KRAKEN_API_SECRET", "UyV5gJbVKfEeuEEHeii6H8oJG86xa2AVkqGIqeh+6Iq6n5YiegXf3gIryIXxXnXK4pcIirLB6Tqhcb8iAi118A==")

client = Market(
    key=API_KEY,
    secret=API_SECRET,
    sandbox=True  # Automatically targets https://demo-futures.kraken.com
)

@app.route("/", methods=["GET"])
def health():
    return "Kraken Futures Python Relay Active"

@app.route("/webhook", methods=["POST"])
def webhook():
    try:
        data = request.get_json(force=True) or {}
        
        symbol = str(data.get("symbol", "pf_solusd")).lower()
        side = str(data.get("side", data.get("action", "buy"))).lower()
        order_type = str(data.get("type", data.get("ordertype", "mkt"))).lower()
        size = float(data.get("size", data.get("volume", 1)))

        # Official SDK execution with auto-signature & session management
        response = client.send_order(
            orderType=order_type,
            symbol=symbol,
            side=side,
            size=size
        )
        
        print(f"[ORDER SUCCESS] {side.upper()} {size} {symbol}: {response}")
        return jsonify({"status": "success", "kraken_response": response}), 200

    except Exception as e:
        print(f"[RELAY ERROR]: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port)
