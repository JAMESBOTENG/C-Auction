#!/usr/bin/env python3
"""
RIT liability-trading bot for the 16th Annual Babson Trading Competition (LT3 / LT4 cases).

What it does every loop:
  1. Tenders   - prices each tender offer against the live order book of every market that trades
                 the same stock (e.g. CRZY_M + CRZY_A), charges for market impact, fees and inventory
                 risk, and accepts only the ones with enough expected profit. Marginal tenders are
                 re-checked every loop until they expire (waiting is a free option).
  2. Auctions  - for competitive / winner-take-all auctions (rounds 6 and 8) it computes the worst
                 price it would still be happy with and submits a bid/offer at that price.
  3. Unwind    - flattens every position back to zero over ~N ticks (TWAP schedule) using
                 marketable LIMIT orders (never market orders), routing each slice to whichever
                 market has the best price after fees, and never trading past zero (no fines in
                 rounds 1-4). In the last ticks of the period it dumps whatever is left.

Requirements: Python 3.9+, `pip install requests`, RIT client running and logged in with the
REST API enabled (in the RIT client: the "API" button / tab shows the port and the API key).

Usage:
    python rit_liability_bot.py --api-key YOURKEY
    python rit_liability_bot.py --api-key YOURKEY --dry-run          # watch decisions, trade nothing
    python rit_liability_bot.py --api-key YOURKEY --min-edge 0.05    # pickier (later rounds)
"""
from __future__ import annotations

import argparse
import math
import signal
import sys
import time
from collections import defaultdict, deque
from dataclasses import dataclass

import requests


# --------------------------------------------------------------------------------------------------
# Configuration — every field can be overridden from the command line (see parse_args)
# --------------------------------------------------------------------------------------------------
@dataclass
class Config:
    api_key: str = "YOUR_API_KEY"
    host: str = "localhost"
    port: int = 9999
    dry_run: bool = False
    loop_sleep: float = 0.15          # seconds between loops

    # --- tender acceptance -------------------------------------------------------------------
    min_edge: float = 0.03            # $/share profit still required AFTER impact, fees and risk charge
    risk_aversion: float = 0.5        # how many 1-sd inventory-risk dollars to charge against the edge
    impact_weight: float = 0.6        # 1.0 = assume the whole block is dumped into today's visible book
    unwind_ticks: int = 18            # target ticks to flatten a position (the case suggests 15-20)
    default_tick_vol: float = 0.003   # per-tick return sd used until enough price history exists
    vol_window: int = 60              # ticks of mid-price history used to estimate volatility

    # --- auctions (rounds 6 & 8) -------------------------------------------------------------
    wta_extra_edge: float = 0.03      # winner-take-all: extra margin vs winner's curse
    comp_extra_edge: float = 0.05     # competitive: you are paid YOUR price, so ask for more
    comp_impact_mult: float = 1.6     # competitive: every winner unwinds at once -> worse exit
    auction_submit_before: int = 4    # submit this many ticks before the auction expires

    # --- execution ---------------------------------------------------------------------------
    orders_per_tick: int = 2          # unwind slices per tick per stock
    max_slippage: float = 0.05        # per slice, never walk the book more than this past the best price
    endgame_ticks: int = 12           # with this few ticks left in the period, flatten everything
    net_across_markets: bool = True   # treat CRZY_M and CRZY_A as one inventory (see README)
    book_depth: int = 50


# --------------------------------------------------------------------------------------------------
# REST client
# --------------------------------------------------------------------------------------------------
class RIT:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.base = f"http://{cfg.host}:{cfg.port}/v1"
        self.s = requests.Session()
        self.s.headers.update({"X-API-Key": cfg.api_key})

    def _req(self, method: str, path: str, **params):
        for _ in range(20):
            r = self.s.request(method, self.base + path, params=params or None, timeout=5)
            if r.status_code == 429:  # rate limited: RIT says how long to wait
                wait = 0.1
                try:
                    wait = float(r.json().get("wait", wait))
                except Exception:
                    wait = float(r.headers.get("Retry-After", wait))
                time.sleep(max(wait, 0.02))
                continue
            if r.status_code == 401:
                raise SystemExit("401 Unauthorized: wrong API key (check the API tab in the RIT client).")
            if not r.ok:
                raise RuntimeError(f"{method} {path} {params} -> {r.status_code}: {r.text[:200]}")
            return r.json() if r.content else None
        raise RuntimeError(f"{method} {path}: still rate limited after retries")

    def get(self, path, **p):
        return self._req("GET", path, **p)

    def post(self, path, **p):
        return self._req("POST", path, **p)

    def delete(self, path, **p):
        return self._req("DELETE", path, **p)


# --------------------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------------------
def underlying(ticker: str) -> str:
    """CRZY_M / CRZY_A / CRZY -> CRZY"""
    return ticker.split("_")[0]


def take_fee(sec: dict) -> float:
    """Fee per share for an order that removes liquidity."""
    fee = sec.get("trading_fee")
    if fee is not None:
        return abs(float(fee))
    return 0.01 if sec["ticker"].endswith("_A") else 0.02


class Level:
    __slots__ = ("net", "raw", "qty", "ticker")

    def __init__(self, net, raw, qty, ticker):
        self.net, self.raw, self.qty, self.ticker = net, raw, qty, ticker


def walk(levels: list[Level], qty: int, side: str, limit_net: float | None = None):
    """Walk best-first levels for `qty` shares, stopping at limit_net.
    Returns (avg_net_price, filled, {ticker: (qty, worst_raw_price)})."""
    filled, notional, per_ticker = 0, 0.0, {}
    for lv in levels:
        if filled >= qty:
            break
        if limit_net is not None and (lv.net < limit_net - 1e-9 if side == "SELL" else lv.net > limit_net + 1e-9):
            break
        take = min(lv.qty, qty - filled)
        filled += take
        notional += take * lv.net
        q, _ = per_ticker.get(lv.ticker, (0, lv.raw))
        per_ticker[lv.ticker] = (q + take, lv.raw)
    return (notional / filled if filled else None), filled, per_ticker


# --------------------------------------------------------------------------------------------------
# The bot
# --------------------------------------------------------------------------------------------------
class Bot:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.api = RIT(cfg)
        self.trader_id = None
        self.period = None
        self.reset_period_state()

    def reset_period_state(self):
        self.mids = defaultdict(lambda: deque(maxlen=self.cfg.vol_window + 1))  # und -> mid history
        self.last_mid_tick = {}
        self.acquired_tick = {}            # und -> tick the current inventory started
        self.slices = defaultdict(int)     # (und, tick) -> orders sent
        self.tender_log = {}               # tender_id -> last decision text (avoid log spam)
        self.auction_done = set()
        self.accepted = set()

    # ---------------------------------------------------------------- market data
    def snapshot(self, case):
        secs = {s["ticker"]: s for s in self.api.get("/securities")
                if s.get("type", "STOCK") == "STOCK" and s.get("is_tradeable", True)}
        self.secs = secs
        self.und_tickers = defaultdict(list)
        for t in secs:
            self.und_tickers[underlying(t) if self.cfg.net_across_markets else t].append(t)
        self.books = {}

    def key(self, ticker):
        return underlying(ticker) if self.cfg.net_across_markets else ticker

    def book(self, ticker):
        if ticker not in self.books:
            b = self.api.get("/securities/book", ticker=ticker, limit=self.cfg.book_depth)
            self.books[ticker] = b
        return self.books[ticker]

    def position(self, und) -> int:
        return int(round(sum(self.secs[t].get("position", 0) for t in self.und_tickers[und])))

    def levels(self, und, side: str) -> list[Level]:
        """side='SELL' -> bids we can hit (best net first); side='BUY' -> asks we can lift."""
        out = []
        for t in self.und_tickers[und]:
            fee = take_fee(self.secs[t])
            for o in self.book(t)["bids" if side == "SELL" else "asks"]:
                if o.get("trader_id") == self.trader_id:
                    continue
                q = int(o["quantity"] - o.get("quantity_filled", 0))
                if q <= 0:
                    continue
                p = float(o["price"])
                out.append(Level(p - fee if side == "SELL" else p + fee, p, q, t))
        out.sort(key=lambda lv: -lv.net if side == "SELL" else lv.net)
        return out

    def mid(self, und) -> float | None:
        bids, asks = [], []
        for t in self.und_tickers[und]:
            s = self.secs[t]
            if s.get("bid"):
                bids.append(s["bid"])
            if s.get("ask"):
                asks.append(s["ask"])
        if bids and asks:
            return (max(bids) + min(asks)) / 2
        s = self.secs[self.und_tickers[und][0]]
        return s.get("last") or None

    def record_mids(self, tick):
        for und in self.und_tickers:
            m = self.mid(und)
            if m and self.last_mid_tick.get(und) != tick:
                self.mids[und].append(m)
                self.last_mid_tick[und] = tick

    def tick_vol(self, und) -> float:
        h = list(self.mids[und])
        if len(h) < 15:
            return self.cfg.default_tick_vol
        rets = [math.log(b / a) for a, b in zip(h, h[1:]) if a > 0 and b > 0]
        mu = sum(rets) / len(rets)
        sd = math.sqrt(sum((r - mu) ** 2 for r in rets) / max(1, len(rets) - 1))
        return max(sd, self.cfg.default_tick_vol * 0.3)

    # ---------------------------------------------------------------- tender economics
    def liquidation_cost(self, und, inv: int, mid: float) -> float:
        """$ cost (vs mid, incl. fees) of pushing inventory `inv` through the visible book."""
        if inv == 0:
            return 0.0
        side = "SELL" if inv > 0 else "BUY"
        lv = self.levels(und, side)
        n = abs(inv)
        avg, filled, _ = walk(lv, n, side)
        if filled == 0:
            return n * mid * 0.02
        cost = filled * ((mid - avg) if side == "SELL" else (avg - mid))
        if filled < n:  # book too thin: price the rest at twice the distance of the deepest level
            gap = abs(mid - lv[-1].net) * 2 + 0.02
            cost += (n - filled) * gap
        return max(cost, 0.0)

    def inventory_risk(self, und, inv: int, mid: float) -> float:
        # sd of P&L while unwinding linearly over T ticks: |inv| * price * sigma * sqrt(T/3)
        return abs(inv) * mid * self.tick_vol(und) * math.sqrt(self.cfg.unwind_ticks / 3)

    def tender_cost_per_share(self, und, signed_qty: int, impact_mult: float = 1.0):
        """Returns (mid, required discount vs mid per share) for adding signed_qty to inventory."""
        mid = self.mid(und)
        if not mid:
            return None, None
        pos = self.position(und)
        new = pos + signed_qty
        d_cost = self.liquidation_cost(und, new, mid) - self.liquidation_cost(und, pos, mid)
        d_risk = self.inventory_risk(und, new, mid) - self.inventory_risk(und, pos, mid)
        q = abs(signed_qty)
        need = (self.cfg.impact_weight * impact_mult * d_cost + self.cfg.risk_aversion * d_risk) / q
        return mid, need

    def within_limits(self, signed_qty: int) -> bool:
        try:
            limits = self.api.get("/limits")
        except Exception:
            return True
        net = sum(self.position(u) for u in self.und_tickers)
        gross = sum(abs(self.position(u)) for u in self.und_tickers)
        for lim in limits or []:
            gl, nl = lim.get("gross_limit") or 0, lim.get("net_limit") or 0
            if gl and gross + abs(signed_qty) > gl:
                return False
            if nl and abs(net + signed_qty) > nl:
                return False
        return True

    def log_tender(self, tid, msg):
        if self.tender_log.get(tid) != msg:
            self.tender_log[tid] = msg
            print(msg, flush=True)

    def handle_tenders(self, tick):
        tenders = self.api.get("/tenders") or []
        for t in tenders:
            tid = t["tender_id"]
            ticker = t["ticker"]
            if ticker not in self.secs or tid in self.accepted:
                continue
            und = self.key(ticker)
            q = int(t["quantity"])
            we_buy = t["action"] == "BUY"
            signed = q if we_buy else -q
            expires = t.get("expires") or tick
            fixed = t.get("is_fixed_bid", True)
            caption = (t.get("caption") or "").lower()

            if fixed:
                price = float(t["price"])
                mid, need = self.tender_cost_per_share(und, signed)
                if mid is None:
                    continue
                edge = (mid - price) if we_buy else (price - mid)  # gross discount vs mid
                net_edge = edge - need
                tag = (f"[t{tick}] TENDER {tid} {'BUY' if we_buy else 'SELL'} {q:,} {ticker} @ {price:.2f} "
                       f"| mid {mid:.2f} edge {edge:+.3f} cost {need:.3f} -> net {net_edge:+.3f}/sh")
                if net_edge >= self.cfg.min_edge and self.within_limits(signed):
                    print(tag + f"  ACCEPT (exp. ${net_edge * q:,.0f})", flush=True)
                    if not self.cfg.dry_run:
                        self.api.post(f"/tenders/{tid}")
                    self.accepted.add(tid)
                    self.acquired_tick.setdefault(und, tick)
                else:
                    # keep watching: the market may move in our favour before it expires
                    self.log_tender(tid, tag + "  pass (watching until expiry)")
            else:
                if tid in self.auction_done or expires - tick > self.cfg.auction_submit_before:
                    if tid not in self.auction_done:
                        self.log_tender(tid, f"AUCTION {tid} {t['action']} {q:,} {ticker} "
                                             f"- will bid at t{expires - self.cfg.auction_submit_before}")
                    continue
                wta = "winner" in caption or "highest" in caption or "lowest" in caption
                mult = 1.0 if wta else self.cfg.comp_impact_mult
                extra = self.cfg.wta_extra_edge if wta else self.cfg.comp_extra_edge
                mid, need = self.tender_cost_per_share(und, signed, mult)
                if mid is None:
                    continue
                disc = need + self.cfg.min_edge + extra
                bid = math.floor((mid - disc) * 100) / 100 if we_buy else math.ceil((mid + disc) * 100) / 100
                kind = "winner-take-all" if wta else "competitive"
                if not self.within_limits(signed):
                    print(f"[t{tick}] AUCTION {tid} skipped: would breach position limits", flush=True)
                else:
                    print(f"[t{tick}] AUCTION {tid} ({kind}) {'BUY' if we_buy else 'SELL'} {q:,} {ticker} "
                          f"| mid {mid:.2f} -> submit {bid:.2f}", flush=True)
                    if not self.cfg.dry_run:
                        try:
                            self.api.post(f"/tenders/{tid}", price=bid)
                        except RuntimeError as e:
                            print("  auction submit failed:", e, flush=True)
                self.auction_done.add(tid)

    # ---------------------------------------------------------------- unwinding
    def unwind(self, case):
        tick, tpp = case["tick"], case["ticks_per_period"]
        ticks_left = tpp - tick
        for und in list(self.und_tickers):
            pos = self.position(und)
            if pos == 0:
                self.acquired_tick.pop(und, None)
                continue
            self.acquired_tick.setdefault(und, tick)
            if self.slices[(und, tick)] >= self.cfg.orders_per_tick and ticks_left > self.cfg.endgame_ticks:
                continue

            remaining = abs(pos)
            held = tick - self.acquired_tick[und]
            endgame = ticks_left <= self.cfg.endgame_ticks
            sched_left = max(1, self.cfg.unwind_ticks - held)
            per_tick = remaining if endgame else math.ceil(remaining / sched_left)
            qty = min(remaining, math.ceil(per_tick / self.cfg.orders_per_tick))
            if held > self.cfg.unwind_ticks:  # behind schedule -> speed up
                qty = min(remaining, qty * 2)

            side = "SELL" if pos > 0 else "BUY"
            lv = self.levels(und, side)
            if not lv:
                continue
            slip = self.cfg.max_slippage * (4 if endgame else 1)
            limit_net = lv[0].net - slip if side == "SELL" else lv[0].net + slip
            avg, filled, per_ticker = walk(lv, qty, side, limit_net)
            if filled == 0:
                continue
            for t, (q, worst_raw) in per_ticker.items():
                self.send(t, side, q, worst_raw)
            self.slices[(und, tick)] += 1

    def send(self, ticker, side, qty, price):
        max_sz = int(self.secs[ticker].get("max_trade_size") or 10_000) or 10_000
        while qty > 0:
            q = min(qty, max_sz)
            if self.cfg.dry_run:
                print(f"    (dry) {side} {q} {ticker} @ {price:.2f}")
            else:
                self.api.post("/orders", ticker=ticker, type="LIMIT", quantity=q, action=side,
                              price=round(price, 2))
            qty -= q

    def cancel_leftovers(self):
        if self.cfg.dry_run:
            return
        if self.api.get("/orders", status="OPEN"):
            self.api.post("/commands/cancel", all=1)

    # ---------------------------------------------------------------- main loop
    def run(self):
        me = self.api.get("/trader")
        self.trader_id = me.get("trader_id")
        print(f"Connected as {self.trader_id}. NLV ${me.get('nlv', 0):,.0f}. "
              f"{'DRY RUN - no orders' if self.cfg.dry_run else 'LIVE'}", flush=True)
        last_status_tick = None
        while True:
            try:
                case = self.api.get("/case")
                if case["status"] != "ACTIVE":
                    time.sleep(0.5)
                    continue
                if case["period"] != self.period:
                    self.period = case["period"]
                    self.reset_period_state()
                    print(f"=== period {self.period} ===", flush=True)
                tick = case["tick"]
                self.cancel_leftovers()            # leftovers first, so positions below are final
                self.snapshot(case)
                self.record_mids(tick)
                self.handle_tenders(tick)
                self.snapshot(case)                # refresh positions after any accepted tender
                self.unwind(case)
                if tick != last_status_tick and tick % 10 == 0:
                    last_status_tick = tick
                    nlv = self.api.get("/trader").get("nlv", 0)
                    pos = ", ".join(f"{u}:{self.position(u):+,}" for u in self.und_tickers)
                    print(f"[t{tick}/{case['ticks_per_period']}] NLV ${nlv:,.0f} | {pos}", flush=True)
            except requests.exceptions.ConnectionError:
                print("Cannot reach RIT client API - is RIT open, logged in, and API enabled?", flush=True)
                time.sleep(2)
            except RuntimeError as e:
                print("API error:", e, flush=True)
            time.sleep(self.cfg.loop_sleep)


def parse_args() -> Config:
    cfg = Config()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for name, default in vars(cfg).items():
        flag = "--" + name.replace("_", "-")
        if isinstance(default, bool):
            ap.add_argument(flag, action="store_true" if not default else "store_false",
                            dest=name, help=f"(default {default})")
        else:
            ap.add_argument(flag, type=type(default), default=default, dest=name, help=f"(default {default})")
    return Config(**vars(ap.parse_args()))


if __name__ == "__main__":
    bot = Bot(parse_args())

    def bye(*_):
        print("\nStopping - cancelling open orders.")
        try:
            if not bot.cfg.dry_run:
                bot.api.post("/commands/cancel", all=1)
        finally:
            sys.exit(0)

    signal.signal(signal.SIGINT, bye)
    bot.run()
