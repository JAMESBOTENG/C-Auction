#!/usr/bin/env python3
"""
Tiny fake RIT REST server for smoke-testing rit_liability_bot.py offline (NOT a faithful simulator).

    python mock_rit_server.py            # serves http://localhost:9999/v1, one 300-tick period
    python rit_liability_bot.py --api-key test

Two stocks on two markets (CRZY_M/CRZY_A, TAME_M/TAME_A), a random-walk "true" price, a book that is
rebuilt around it every tick and depressed by net order flow, fixed tenders and a couple of auctions.
"""
import json
import random
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

TICK_SECONDS, TPP = 0.1, 300
random.seed(7)
lock = threading.Lock()
S = {
    "tick": 0, "true": {"CRZY": 10.0, "TAME": 25.0}, "pressure": {"CRZY": 0.0, "TAME": 0.0},
    "pos": {}, "cash": 0.0, "books": {}, "orders": {}, "next_id": 1, "tenders": {}, "trades": 0,
}
TICKERS = ["CRZY_M", "CRZY_A", "TAME_M", "TAME_A"]
FEE = {"_M": 0.02, "_A": 0.01}
for t in TICKERS:
    S["pos"][t] = 0


def und(t):
    return t.split("_")[0]


def rebuild_books():
    for t in TICKERS:
        u = und(t)
        mid = S["true"][u] + S["pressure"][u] + random.uniform(-0.02, 0.02) * (1 if t.endswith("_A") else 0)
        mid = round(mid, 2)
        S["books"][t] = {
            "bids": [{"price": round(mid - 0.01 * k, 2), "quantity": random.randint(2, 6) * 1000,
                      "quantity_filled": 0, "trader_id": "ANON"} for k in range(1, 30)],
            "asks": [{"price": round(mid + 0.01 * k, 2), "quantity": random.randint(2, 6) * 1000,
                      "quantity_filled": 0, "trader_id": "ANON"} for k in range(1, 30)],
        }


def fill(ticker, action, qty, limit):
    book = S["books"][ticker]["asks" if action == "BUY" else "bids"]
    done = 0
    for lv in book:
        avail = lv["quantity"] - lv["quantity_filled"]
        ok = lv["price"] <= limit if action == "BUY" else lv["price"] >= limit
        if not ok or done >= qty:
            break
        take = min(avail, qty - done)
        lv["quantity_filled"] += take
        done += take
        sign = 1 if action == "BUY" else -1
        S["pos"][ticker] += sign * take
        S["cash"] -= sign * take * lv["price"] + take * FEE[ticker[-2:]]
        S["pressure"][und(ticker)] += sign * take * 0.0000015
    S["trades"] += done
    return done


def clock():
    while S["tick"] < TPP:
        time.sleep(TICK_SECONDS)
        with lock:
            S["tick"] += 1
            for u in S["true"]:
                S["true"][u] *= 1 + random.gauss(0, 0.003)
                S["pressure"][u] *= 0.92
            rebuild_books()
            tk = S["tick"]
            if tk % 50 == 10:  # fixed tender
                u = random.choice(["CRZY", "TAME"])
                act = random.choice(["BUY", "SELL"])
                spread = random.choice([0.03, 0.12, 0.25, 0.30])
                mid = S["true"][u]
                S["tenders"][tk] = {"tender_id": tk, "period": 1, "tick": tk, "expires": tk + 15,
                                    "caption": f"An institution would like to {'SELL' if act == 'BUY' else 'BUY'}",
                                    "quantity": random.choice([40000, 60000, 80000]), "action": act,
                                    "is_fixed_bid": True, "price": round(mid - spread if act == "BUY" else mid + spread, 2),
                                    "ticker": u + "_M", "reserve": None}
            if tk in (120, 230):  # auctions
                u = "TAME"
                S["tenders"][tk] = {"tender_id": tk, "period": 1, "tick": tk, "expires": tk + 30,
                                    "caption": "Winner take all: highest bid wins" if tk == 120 else
                                    "Anyone who bids higher than the reserve will get filled.",
                                    "quantity": 50000, "action": "BUY", "is_fixed_bid": False, "price": None,
                                    "ticker": u + "_M", "reserve": round(S["true"][u] - 0.30, 2)}
            for tid in [k for k, v in S["tenders"].items() if v["expires"] < tk]:
                del S["tenders"][tid]


def nlv():
    return S["cash"] + sum(S["pos"][t] * S["true"][und(t)] for t in TICKERS)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def route(self, method):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        p = u.path
        with lock:
            if p == "/v1/case":
                return self.reply({"name": "MOCK LT4", "period": 1, "tick": S["tick"], "ticks_per_period": TPP,
                                   "total_periods": 1, "status": "ACTIVE" if S["tick"] < TPP else "STOPPED",
                                   "is_enforce_trading_limits": True})
            if p == "/v1/trader":
                return self.reply({"trader_id": "me", "first_name": "a", "last_name": "b", "nlv": nlv()})
            if p == "/v1/limits":
                return self.reply([{"name": "LIMIT", "gross": 0, "net": 0, "gross_limit": 250000, "net_limit": 150000}])
            if p == "/v1/securities":
                out = []
                for t in TICKERS:
                    b = S["books"].get(t) or {"bids": [{"price": 0}], "asks": [{"price": 0}]}
                    out.append({"ticker": t, "type": "STOCK", "position": S["pos"][t], "is_tradeable": True,
                                "bid": b["bids"][0]["price"], "ask": b["asks"][0]["price"],
                                "last": S["true"][und(t)], "trading_fee": FEE[t[-2:]],
                                "limit_order_rebate": 0.005 if t.endswith("_A") else 0, "max_trade_size": 10000})
                return self.reply(out)
            if p == "/v1/securities/book":
                b = S["books"][q["ticker"]]
                n = int(q.get("limit", 20))
                return self.reply({"bids": b["bids"][:n], "asks": b["asks"][:n]})
            if p == "/v1/orders" and method == "GET":
                return self.reply([])  # every order is IOC in the mock
            if p == "/v1/orders" and method == "POST":
                done = fill(q["ticker"], q["action"], int(q["quantity"]), float(q["price"]))
                return self.reply({"order_id": 1, "quantity_filled": done})
            if p == "/v1/commands/cancel":
                return self.reply({"cancelled_order_ids": []})
            if p == "/v1/tenders":
                return self.reply([{k: v for k, v in t.items() if k != "reserve"} for t in S["tenders"].values()])
            if p.startswith("/v1/tenders/"):
                tid = int(p.rsplit("/", 1)[1])
                t = S["tenders"].pop(tid, None)
                if t and method == "POST":
                    price = float(q["price"]) if "price" in q else t["price"]
                    if t["is_fixed_bid"] or price >= t["reserve"]:
                        sign = 1 if t["action"] == "BUY" else -1
                        S["pos"][t["ticker"]] += sign * t["quantity"]
                        S["cash"] -= sign * t["quantity"] * price
                        print(f"[mock t{S['tick']}] filled tender {tid} {t['action']} {t['quantity']} @ {price}")
                    else:
                        print(f"[mock t{S['tick']}] auction {tid} bid {price} below reserve {t['reserve']}")
                return self.reply({"success": True})
        self.reply({"code": "NOT_FOUND"}, 404)

    def do_GET(self):
        self.route("GET")

    def do_POST(self):
        self.route("POST")

    def do_DELETE(self):
        self.route("DELETE")


if __name__ == "__main__":
    rebuild_books()
    threading.Thread(target=clock, daemon=True).start()
    srv = ThreadingHTTPServer(("localhost", 9999), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    while S["tick"] < TPP:
        time.sleep(0.5)
    time.sleep(0.3)
    print(f"[mock] END  NLV ${nlv():,.0f}  positions {S['pos']}  shares traded {S['trades']:,}")
