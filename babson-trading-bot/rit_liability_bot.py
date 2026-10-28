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
    python rit_liability_bot.py --api-key YOURKEY --round 3          # load that round's preset
    python rit_liability_bot.py --api-key YOURKEY --round 7 --min-edge 0.04   # preset + override
"""
from __future__ import annotations

import argparse
import json
import math
import queue
import signal
import sys
import threading
import time
import webbrowser
from collections import defaultdict, deque
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

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
    dash_port: int = 8050             # live dashboard at http://localhost:8050 (0 = off)
    no_browser: bool = False          # don't open the dashboard automatically

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
    front_load: float = 1.0           # >1 unwinds faster early on (beat other traders to the book)
    passive: bool = True              # while on schedule, also rest an order at the touch (earn spread + rebate)
    passive_qty: int = 5000           # size of that resting order
    passive_ttl: int = 3              # ticks before a resting order is cancelled and re-quoted
    passive_share: float = 0.5        # cut the aggressive slice by this much while a resting order works

    # --- rounds 5-8 (no fines): speculative edges, all off unless no_fines ------------------
    round: int = 0                    # 1-8 applies the ROUND_PRESETS below
    no_fines: bool = False
    crowd_size: int = 25000           # competitive auctions: pre-position ahead of the winners' unwind
    crowd_ticks: int = 6              # ...starting this many ticks before the auction closes
    crowd_hold: int = 4               # ...and holding it this many ticks after it closes
    arb: bool = True                  # cross-market arbitrage _M vs _A when prices cross after fees
    arb_min: float = 0.005            # $/share profit after both fees
    arb_max_qty: int = 5000
    fade_size: int = 0                # fade abnormal price jumps (participant flow that tends to revert)
    fade_z: float = 3.0               # ...when the last fade_lookback-tick move exceeds this many sd
    fade_lookback: int = 5
    fade_hold: int = 6                # ticks to hold before the normal unwind closes it


# Explicit command-line flags always win over these.
ROUND_PRESETS = {
    1: {},
    2: {},
    3: {},
    4: {"unwind_ticks": 15},
    5: {"no_fines": True, "front_load": 1.3},
    6: {"no_fines": True, "front_load": 1.5, "min_edge": 0.05},
    7: {"no_fines": True, "front_load": 1.3, "min_edge": 0.05, "risk_aversion": 0.8},
    8: {"no_fines": True, "front_load": 1.5, "min_edge": 0.05, "risk_aversion": 0.8},
}


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


LOG = deque(maxlen=400)  # recent console lines, also shown on the dashboard


def log(*parts, **_):
    msg = " ".join(str(x) for x in parts)
    LOG.append(time.strftime("%H:%M:%S ") + msg.strip("\n"))
    print(msg, flush=True)


# Settings the dashboard may change while the bot runs.
TUNABLE = ["min_edge", "risk_aversion", "impact_weight", "unwind_ticks", "front_load", "max_slippage",
           "passive", "passive_qty", "no_fines", "crowd_size", "arb", "fade_size", "fade_z",
           "wta_extra_edge", "comp_extra_edge"]


# --------------------------------------------------------------------------------------------------
# The bot
# --------------------------------------------------------------------------------------------------
class Bot:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.api = RIT(cfg)
        self.trader_id = None
        self.period = None
        # dashboard controls (written by the web thread, read by the trading loop)
        self.paused = False
        self.auto_tenders = True
        self.flatten_now = False
        self.commands = queue.Queue()
        self.state = {"connected": False, "log": []}
        self.last_error = ""
        self.reset_period_state()

    def reset_period_state(self):
        self.mids = defaultdict(lambda: deque(maxlen=self.cfg.vol_window + 1))  # und -> mid history
        self.last_mid_tick = {}
        self.acquired_tick = {}            # und -> tick the current inventory started
        self.slices = defaultdict(int)     # (und, tick) -> orders sent
        self.tender_log = {}               # tender_id -> last decision text (avoid log spam)
        self.auction_done = set()
        self.accepted = set()
        self.crowd_done = set()
        self.crowd_pos = {}                # und -> signed shares of the crowd pre-position
        self.hold_until = {}               # und -> tick until which unwind leaves the position alone
        self.arb_tick = {}
        self.passive_ids = {}              # order_id -> (und, tick placed)
        self.passive_open = defaultdict(int)
        self.fade_block = {}
        self.busy = set()                  # unds with a live tender/auction (don't fade them)
        self.nlv_hist = []                 # [tick, nlv] for the dashboard chart
        self.tender_view = {}              # tender_id -> what the dashboard shows
        self.stats = {"accepted": 0, "expected": 0.0, "auctions": 0}

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

    def tender_cost_per_share(self, und, signed_qty: int, impact_mult: float = 1.0, exclude_crowd=False):
        """Returns (mid, required discount vs mid per share) for adding signed_qty to inventory."""
        mid = self.mid(und)
        if not mid:
            return None, None
        pos = self.position(und)
        if exclude_crowd:  # the crowd pre-position is a separate bet, not a hedge for the auction block
            pos -= self.crowd_pos.get(und, 0)
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
            log(msg)

    def handle_tenders(self, tick, act=True):
        tenders = self.api.get("/tenders") or []
        self.busy = {self.key(t["ticker"]) for t in tenders if t["ticker"] in self.secs}
        live_ids = {t["tender_id"] for t in tenders}
        self.tender_view = {k: v for k, v in self.tender_view.items() if k in live_ids}
        act = act and self.auto_tenders and not self.paused
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
                good = net_edge >= self.cfg.min_edge
                self.tender_view[tid] = dict(id=tid, kind="fixed", side="BUY" if we_buy else "SELL", qty=q,
                                             ticker=ticker, price=price, mid=mid, edge=edge, cost=need,
                                             net=net_edge, expires=expires,
                                             decision="WOULD ACCEPT" if good else "PASS")
                if good and act and self.within_limits(signed):
                    log(tag + f"  ACCEPT (exp. ${net_edge * q:,.0f})")
                    self.accept_tender(tid, und, tick, expected=net_edge * q)
                elif good and not act:
                    self.log_tender(tid, tag + "  would ACCEPT - auto-accept is off (use the dashboard)")
                else:
                    # keep watching: the market may move in our favour before it expires
                    self.log_tender(tid, tag + "  pass (watching until expiry)")
            else:
                wta = "winner" in caption or "highest" in caption or "lowest" in caption
                if (act and self.cfg.no_fines and not wta and self.cfg.crowd_size and tid not in self.crowd_done
                        and expires - tick <= self.cfg.crowd_ticks):
                    self.crowd_trade(und, we_buy, expires, tick)
                    self.crowd_done.add(tid)
                mult = 1.0 if wta else self.cfg.comp_impact_mult
                extra = self.cfg.wta_extra_edge if wta else self.cfg.comp_extra_edge
                mid, need = self.tender_cost_per_share(und, signed, mult, exclude_crowd=True)
                if mid is None:
                    continue
                disc = need + self.cfg.min_edge + extra
                bid = math.floor((mid - disc) * 100) / 100 if we_buy else math.ceil((mid + disc) * 100) / 100
                kind = "winner-take-all" if wta else "competitive"
                if tid not in self.auction_done:
                    self.tender_view[tid] = dict(id=tid, kind=kind, side="BUY" if we_buy else "SELL", qty=q,
                                                 ticker=ticker, price=bid, mid=mid, edge=disc, cost=need,
                                                 net=self.cfg.min_edge + extra, expires=expires,
                                                 decision=f"BID AT t{expires - self.cfg.auction_submit_before}")
                if tid in self.auction_done or expires - tick > self.cfg.auction_submit_before or not act:
                    if tid not in self.auction_done:
                        self.log_tender(tid, f"AUCTION {tid} {t['action']} {q:,} {ticker} "
                                             f"- will bid at t{expires - self.cfg.auction_submit_before}")
                    continue
                if not self.within_limits(signed):
                    log(f"[t{tick}] AUCTION {tid} skipped: would breach position limits")
                else:
                    log(f"[t{tick}] AUCTION {tid} ({kind}) {'BUY' if we_buy else 'SELL'} {q:,} {ticker} "
                          f"| mid {mid:.2f} -> submit {bid:.2f}")
                    self.submit_auction(tid, bid)
                self.auction_done.add(tid)

    def accept_tender(self, tid, und, tick, expected=0.0):
        if not self.cfg.dry_run:
            self.api.post(f"/tenders/{tid}")
        self.accepted.add(tid)
        self.acquired_tick.setdefault(und, tick)
        self.stats["accepted"] += 1
        self.stats["expected"] += expected

    def submit_auction(self, tid, price):
        if not self.cfg.dry_run:
            try:
                self.api.post(f"/tenders/{tid}", price=price)
            except RuntimeError as e:
                log("  auction submit failed:", e)
                return
        self.stats["auctions"] += 1
        self.auction_done.add(tid)

    def crowd_trade(self, und, crowd_buys, expires, tick):
        """Competitive auction: every winner will dump the block right after it closes. Get there first:
        if the crowd is buying the block (and will sell it), go short now and cover into their selling."""
        side = "SELL" if crowd_buys else "BUY"
        signed = -self.cfg.crowd_size if crowd_buys else self.cfg.crowd_size
        if not self.within_limits(signed):
            return
        lv = self.levels(und, side)
        if not lv:
            return
        limit_net = lv[0].net - self.cfg.max_slippage if side == "SELL" else lv[0].net + self.cfg.max_slippage
        _, filled, per_ticker = walk(lv, self.cfg.crowd_size, side, limit_net)
        log(f"[t{tick}] CROWD {side} {filled:,} {und} ahead of auction unwind (hold to t{expires + self.cfg.crowd_hold})",
              flush=True)
        for t, (q, worst_raw) in per_ticker.items():
            self.send(t, side, q, worst_raw)
        self.hold_until[und] = expires + self.cfg.crowd_hold
        self.crowd_pos[und] = filled if side == "BUY" else -filled

    def arbitrage(self, tick):
        if not (self.cfg.no_fines and self.cfg.arb and self.cfg.net_across_markets):
            return
        for und, tks in self.und_tickers.items():
            if len(tks) < 2 or self.arb_tick.get(und) == tick:
                continue
            for a in tks:
                for b in tks:
                    sa, sb = self.secs[a], self.secs[b]
                    ask, bid = sa.get("ask"), sb.get("bid")
                    if a == b or not ask or not bid:
                        continue
                    if bid - ask - take_fee(sa) - take_fee(sb) >= self.cfg.arb_min:
                        q = min(int(sa.get("ask_size") or 0), int(sb.get("bid_size") or 0), self.cfg.arb_max_qty)
                        if q <= 0:
                            continue
                        log(f"[t{tick}] ARB buy {q:,} {a} @ {ask:.2f} / sell {b} @ {bid:.2f}")
                        self.send(a, "BUY", q, ask)
                        self.send(b, "SELL", q, bid)
                        self.arb_tick[und] = tick

    def fade(self, tick):
        """No-fines rounds: a move far bigger than normal over a few ticks is usually another trader
        dumping a block; ANON flow pulls the price back toward its path, so lean against it briefly."""
        if not (self.cfg.no_fines and self.cfg.fade_size):
            return
        k = self.cfg.fade_lookback
        for und in self.und_tickers:
            h = self.mids[und]
            if (self.position(und) != 0 or und in self.busy or tick < self.fade_block.get(und, -1)
                    or len(h) < k + 20 or self.cfg.endgame_ticks + self.cfg.fade_hold + 5 > self.ticks_left):
                continue
            move = math.log(h[-1] / h[-1 - k])
            sd = self.tick_vol(und) * math.sqrt(k)
            if abs(move) < self.cfg.fade_z * sd:
                continue
            side = "BUY" if move < 0 else "SELL"
            lv = self.levels(und, side)
            if not lv:
                continue
            limit_net = lv[0].net - self.cfg.max_slippage / 2 if side == "SELL" else lv[0].net + self.cfg.max_slippage / 2
            _, filled, per_ticker = walk(lv, self.cfg.fade_size, side, limit_net)
            if not filled:
                continue
            log(f"[t{tick}] FADE {side} {filled:,} {und}: {move * 100:+.2f}% in {k} ticks ({abs(move) / sd:.1f} sd)",
                  flush=True)
            for t, (q, worst_raw) in per_ticker.items():
                self.send(t, side, q, worst_raw)
            self.hold_until[und] = tick + self.cfg.fade_hold
            self.acquired_tick[und] = tick + self.cfg.fade_hold
            self.fade_block[und] = tick + self.cfg.fade_hold + 15

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
            endgame = ticks_left <= self.cfg.endgame_ticks or self.flatten_now
            if tick <= self.hold_until.get(und, -1) and not endgame:
                continue
            if self.slices[(und, tick)] >= self.cfg.orders_per_tick and not endgame:
                continue

            held = tick - self.acquired_tick[und]
            side = "SELL" if pos > 0 else "BUY"
            resting = self.passive_open.get(und, 0)
            if (self.cfg.passive and not endgame and held < self.cfg.unwind_ticks and resting == 0
                    and abs(pos) > self.cfg.passive_qty):
                resting = self.place_passive(und, side, self.cfg.passive_qty, tick)
            remaining = abs(pos) - resting          # never let resting + new orders exceed the position
            if remaining <= 0:
                continue
            sched_left = max(1, self.cfg.unwind_ticks - held)
            per_tick = remaining if endgame else math.ceil(remaining / sched_left * self.cfg.front_load)
            qty = min(remaining, math.ceil(per_tick / self.cfg.orders_per_tick))
            if held > self.cfg.unwind_ticks:  # behind schedule -> speed up
                qty = min(remaining, qty * 2)
            elif resting and not endgame:     # the resting order is doing part of the work
                qty = max(1, int(qty * (1 - self.cfg.passive_share)))
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
                log(f"    (dry) {side} {q} {ticker} @ {price:.2f}")
            else:
                self.api.post("/orders", ticker=ticker, type="LIMIT", quantity=q, action=side,
                              price=round(price, 2))
            qty -= q

    def manage_orders(self, tick):
        """Cancel leftovers of aggressive orders and stale resting orders; keep resting unwind orders
        that are young, on the right side and still at the best price."""
        self.passive_open = defaultdict(int)
        if self.cfg.dry_run:
            return
        for o in self.api.get("/orders", status="OPEN") or []:
            oid, t = o["order_id"], o["ticker"]
            info = self.passive_ids.get(oid)
            keep = False
            if info and t in self.secs:
                und, placed = info
                pos = self.position(und)
                sec = self.secs[t]
                right_side = (pos > 0 and o["action"] == "SELL") or (pos < 0 and o["action"] == "BUY")
                at_touch = (o["price"] <= (sec.get("ask") or 0) + 1e-9 if o["action"] == "SELL"
                            else o["price"] >= (sec.get("bid") or 1e9) - 1e-9)
                keep = right_side and at_touch and tick - placed < self.cfg.passive_ttl
            if keep:
                self.passive_open[und] += int(o["quantity"] - o.get("quantity_filled", 0))
            else:
                try:
                    self.api.delete(f"/orders/{oid}")
                except RuntimeError:
                    pass  # already filled / gone
                self.passive_ids.pop(oid, None)

    def place_passive(self, und, side, qty, tick):
        """Rest an order at the touch on the venue that pays best for providing liquidity."""
        best = None
        for t in self.und_tickers[und]:
            sec = self.secs[t]
            bid, ask = sec.get("bid"), sec.get("ask")
            if not bid or not ask:
                continue
            rebate = float(sec.get("limit_order_rebate") or 0)
            maker_cost = -rebate if rebate > 0 else take_fee(sec)
            if side == "SELL":
                px = ask - 0.01 if ask - bid >= 0.03 else ask   # step inside a wide spread to be first
                val = px - maker_cost
            else:
                px = bid + 0.01 if ask - bid >= 0.03 else bid
                val = -(px + maker_cost)
            if best is None or val > best[0]:
                best = (val, t, px)
        if not best:
            return 0
        _, t, px = best
        if self.cfg.dry_run:
            log(f"    (dry) passive {side} {qty} {t} @ {px:.2f}")
            return qty
        o = self.api.post("/orders", ticker=t, type="LIMIT", quantity=qty, action=side, price=round(px, 2))
        if o and "order_id" in o:
            self.passive_ids[o["order_id"]] = (und, tick)
        return qty

    # ---------------------------------------------------------------- main loop
    def run(self):
        me = self.api.get("/trader")
        self.trader_id = me.get("trader_id")
        log(f"Connected as {self.trader_id}. NLV ${me.get('nlv', 0):,.0f}. "
              f"{'DRY RUN - no orders' if self.cfg.dry_run else 'LIVE'}")
        last_status_tick = None
        last_nlv_tick = None
        nlv = me.get("nlv", 0)
        case = {}
        while True:
            try:
                self.process_commands()
                case = self.api.get("/case")
                if case["status"] != "ACTIVE":
                    self.publish_state(case, nlv, connected=True)
                    time.sleep(0.5)
                    continue
                if case["period"] != self.period:
                    self.period = case["period"]
                    self.reset_period_state()
                    log(f"=== period {self.period} ===")
                tick = case["tick"]
                self.ticks_left = case["ticks_per_period"] - tick
                self.snapshot(case)
                if not self.paused:
                    self.manage_orders(tick)
                self.record_mids(tick)
                self.handle_tenders(tick)
                self.snapshot(case)                # refresh positions after any accepted tender
                if not self.paused or self.flatten_now:
                    self.unwind(case)
                if not self.paused:
                    self.arbitrage(tick)
                    self.fade(tick)
                if self.flatten_now and all(self.position(u) == 0 for u in self.und_tickers):
                    self.flatten_now = False
                    log(f"[t{tick}] flat - flatten complete")
                if tick != last_nlv_tick:
                    last_nlv_tick = tick
                    nlv = self.api.get("/trader").get("nlv", 0)
                    self.nlv_hist.append([tick, round(nlv, 2)])
                if tick != last_status_tick and tick % 10 == 0:
                    last_status_tick = tick
                    pos = ", ".join(f"{u}:{self.position(u):+,}" for u in self.und_tickers)
                    log(f"[t{tick}/{case['ticks_per_period']}] NLV ${nlv:,.0f} | {pos}")
                self.publish_state(case, nlv, connected=True)
            except requests.exceptions.ConnectionError:
                self.last_error = "Cannot reach RIT client API - is RIT open, logged in, and API enabled?"
                log(self.last_error)
                self.publish_state(case, nlv, connected=False)
                time.sleep(2)
            except RuntimeError as e:
                self.last_error = f"API error: {e}"
                log(self.last_error)
            time.sleep(self.cfg.loop_sleep)

    # ---------------------------------------------------------------- dashboard plumbing
    def process_commands(self):
        """Run dashboard commands on the trading thread (one thread talks to RIT)."""
        while True:
            try:
                cmd = self.commands.get_nowait()
            except queue.Empty:
                return
            action = cmd.get("action")
            try:
                if action == "cancel_all":
                    if not self.cfg.dry_run:
                        self.api.post("/commands/cancel", all=1)
                    self.passive_ids.clear()
                    log("[dash] cancelled all open orders")
                elif action == "accept":
                    v = self.tender_view.get(int(cmd["id"]))
                    if not v:
                        log(f"[dash] tender {cmd['id']} is gone")
                    elif v["kind"] == "fixed":
                        log(f"[dash] manual ACCEPT tender {v['id']} {v['side']} {v['qty']:,} {v['ticker']} @ {v['price']:.2f}")
                        self.accept_tender(v["id"], self.key(v["ticker"]), self.state.get("tick", 0),
                                           expected=v["net"] * v["qty"])
                    else:
                        price = float(cmd.get("price") or v["price"])
                        log(f"[dash] manual auction bid {v['id']} @ {price:.2f}")
                        self.submit_auction(v["id"], price)
                elif action == "decline":
                    tid = int(cmd["id"])
                    if not self.cfg.dry_run:
                        self.api.delete(f"/tenders/{tid}")
                    self.auction_done.add(tid)
                    self.accepted.add(tid)
                    log(f"[dash] declined tender {tid}")
            except (RuntimeError, ValueError, KeyError) as e:
                log(f"[dash] {action} failed: {e}")

    def control(self, cmd: dict):
        """Called from the web thread. Flags/settings change immediately; RIT calls are queued."""
        a = cmd.get("action")
        if a == "pause":
            self.paused = True
            self.commands.put({"action": "cancel_all"})
            log("[dash] PAUSED - no new trades, open orders cancelled")
        elif a == "resume":
            self.paused = False
            log("[dash] resumed")
        elif a == "auto_tenders":
            self.auto_tenders = bool(cmd.get("value"))
            log(f"[dash] auto-accept {'ON' if self.auto_tenders else 'OFF'}")
        elif a == "flatten":
            self.flatten_now = True
            log("[dash] FLATTEN - closing every position now")
        elif a == "dry_run":
            self.cfg.dry_run = bool(cmd.get("value"))
            log(f"[dash] mode -> {'DRY RUN' if self.cfg.dry_run else 'LIVE'}")
        elif a == "round":
            self.apply_round(int(cmd["value"]))
        elif a == "set":
            key = cmd.get("key")
            if key not in TUNABLE:
                return {"ok": False, "error": f"{key} is not adjustable"}
            cur = getattr(self.cfg, key)
            val = cmd.get("value")
            val = (val in (True, "true", "1", 1, "on")) if isinstance(cur, bool) else type(cur)(float(val))
            setattr(self.cfg, key, val)
            log(f"[dash] {key} = {val}")
        elif a in ("cancel_all", "accept", "decline"):
            self.commands.put(cmd)
        else:
            return {"ok": False, "error": f"unknown action {a}"}
        return {"ok": True}

    def apply_round(self, r: int):
        base = Config()
        for k in set().union(*ROUND_PRESETS.values()):
            setattr(self.cfg, k, getattr(base, k))
        for k, v in ROUND_PRESETS.get(r, {}).items():
            setattr(self.cfg, k, v)
        self.cfg.round = r
        log(f"[dash] round {r} preset loaded")

    def publish_state(self, case, nlv, connected):
        stocks = []
        for und, tks in getattr(self, "und_tickers", {}).items():
            mid = self.mid(und)
            stocks.append({
                "name": und, "position": self.position(und), "mid": mid,
                "vol": self.tick_vol(und) * 100,
                "markets": [{"ticker": t, "bid": self.secs[t].get("bid"), "ask": self.secs[t].get("ask"),
                             "position": self.secs[t].get("position", 0)} for t in tks],
            })
        self.state = {
            "connected": connected, "trader": self.trader_id, "live": not self.cfg.dry_run,
            "paused": self.paused, "auto_tenders": self.auto_tenders, "flatten": self.flatten_now,
            "status": case.get("status", "?"), "period": case.get("period"), "tick": case.get("tick", 0),
            "tpp": case.get("ticks_per_period", 300), "nlv": nlv, "nlv_hist": self.nlv_hist[-1500:],
            "stocks": stocks, "tenders": sorted(self.tender_view.values(), key=lambda v: v["id"]),
            "stats": self.stats, "round": self.cfg.round,
            "config": {k: getattr(self.cfg, k) for k in TUNABLE},
            "log": list(LOG)[-150:], "error": self.last_error,
        }


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
    args = vars(ap.parse_args())
    given = {a.lstrip("-").split("=")[0].replace("-", "_") for a in sys.argv[1:] if a.startswith("--")}
    for k, v in ROUND_PRESETS.get(args["round"], {}).items():
        if k not in given:
            args[k] = v
    cfg = Config(**args)
    if cfg.round:
        print(f"Round {cfg.round} preset: " + ", ".join(f"{k}={getattr(cfg, k)}" for k in
              ("no_fines", "min_edge", "risk_aversion", "unwind_ticks", "front_load")), flush=True)
    return cfg


def start_dashboard(bot: Bot):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def send(self, code, body, ctype):
            data = body.encode() if isinstance(body, str) else body
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path.startswith("/api/state"):
                self.send(200, json.dumps(bot.state), "application/json")
            elif self.path in ("/", "/index.html"):
                self.send(200, DASHBOARD_HTML, "text/html; charset=utf-8")
            else:
                self.send(404, "not found", "text/plain")

        def do_POST(self):
            if self.path != "/api/control":
                return self.send(404, "not found", "text/plain")
            try:
                n = int(self.headers.get("Content-Length") or 0)
                res = bot.control(json.loads(self.rfile.read(n) or b"{}"))
            except Exception as e:  # never let a bad click kill the server thread
                res = {"ok": False, "error": str(e)}
            self.send(200, json.dumps(res), "application/json")

    srv = ThreadingHTTPServer(("127.0.0.1", bot.cfg.dash_port), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://localhost:{bot.cfg.dash_port}"
    log(f"Dashboard: {url}")
    if not bot.cfg.no_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()




# The dashboard page (served at http://localhost:8050 while the bot runs).
DASHBOARD_HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RIT Bot Control</title>
<style>
:root {
  color-scheme: light;
  --bg: #f4f4f2; --surface-1: #fcfcfb; --surface-2: #efefec; --border: #dddcd7;
  --text-primary: #0b0b0b; --text-secondary: #52514e; --text-muted: #7a7974;
  --series-1: #2a78d6; --grid: #e6e5e1; --zero: #b9b8b2;
  --good: #0ca30c; --warning: #fab219; --serious: #ec835a; --critical: #d03b3b;
  --btn: #ffffff; --btn-hover: #f0efec;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
    --bg: #111110; --surface-1: #1a1a19; --surface-2: #232321; --border: #33332f;
    --text-primary: #f0efec; --text-secondary: #c3c2b7; --text-muted: #8f8e86;
    --series-1: #3987e5; --grid: #2a2a27; --zero: #55544f; --btn: #232321; --btn-hover: #2d2d2a;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111110; --surface-1: #1a1a19; --surface-2: #232321; --border: #33332f;
  --text-primary: #f0efec; --text-secondary: #c3c2b7; --text-muted: #8f8e86;
  --series-1: #3987e5; --grid: #2a2a27; --zero: #55544f; --btn: #232321; --btn-hover: #2d2d2a;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text-primary);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
header { position: sticky; top: 0; z-index: 5; background: var(--surface-1); border-bottom: 1px solid var(--border);
  padding: 10px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
header h1 { font-size: 16px; margin: 0 8px 0 0; font-weight: 650; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px;
  border: 1px solid var(--border); font-size: 12px; font-weight: 600; color: var(--text-secondary); background: var(--surface-2); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); }
.dot.good { background: var(--good); } .dot.warning { background: var(--warning); } .dot.critical { background: var(--critical); }
.progress { flex: 1 1 160px; min-width: 120px; height: 6px; background: var(--surface-2); border-radius: 3px; overflow: hidden; }
.progress > div { height: 100%; background: var(--text-muted); width: 0; transition: width .4s; }
main { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 14px; padding: 14px 16px 24px; max-width: 1400px; margin: 0 auto; }
@media (max-width: 960px) { main { grid-template-columns: minmax(0, 1fr); } }
.col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 14px; min-width: 0; }
.card h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-secondary); margin: 0 0 10px; font-weight: 650; }
.hero { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 18px; }
.hero .big { font-size: 34px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hero .sub { color: var(--text-secondary); }
.stats { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 4px; color: var(--text-secondary); font-size: 13px; }
.stats b { color: var(--text-primary); font-variant-numeric: tabular-nums; }
.chart-wrap { position: relative; margin-top: 10px; }
svg text { fill: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.tip { position: absolute; pointer-events: none; background: var(--surface-1); border: 1px solid var(--border);
  border-radius: 6px; padding: 4px 8px; font-size: 12px; white-space: nowrap; display: none; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
th { color: var(--text-secondary); font-weight: 600; font-size: 12px; }
th:first-child, td:first-child { text-align: left; }
.scroll-x { overflow-x: auto; }
.empty { color: var(--text-muted); padding: 10px 0; }
.badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 2px 8px;
  border-radius: 4px; border: 1px solid var(--border); color: var(--text-primary); background: var(--surface-2); }
.badge::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); }
.badge.good::before { background: var(--good); } .badge.warning::before { background: var(--warning); }
.badge.serious::before { background: var(--serious); }
button { font: inherit; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--btn);
  color: var(--text-primary); border-radius: 7px; padding: 8px 12px; }
button:hover { background: var(--btn-hover); }
button:disabled { opacity: .45; cursor: default; }
button.small { padding: 3px 9px; font-size: 12px; }
button.danger { border-color: var(--critical); color: var(--critical); }
button.on { outline: 2px solid var(--series-1); outline-offset: -2px; }
.controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.controls .wide { grid-column: span 2; }
.rounds { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; }
.rounds button { padding: 6px 0; }
.params { display: grid; grid-template-columns: 1fr 96px; gap: 6px 10px; align-items: center; }
.params label { color: var(--text-secondary); font-size: 13px; }
.params input[type=number] { width: 100%; font: inherit; font-variant-numeric: tabular-nums; padding: 4px 6px;
  border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); color: var(--text-primary); text-align: right; }
.params input.saved { outline: 2px solid var(--good); }
.hint { color: var(--text-muted); font-size: 12px; margin: 8px 0 0; }
#log { font: 12px/1.5 var(--mono); height: 340px; overflow: auto; background: var(--surface-2); border-radius: 6px;
  padding: 8px; white-space: pre-wrap; word-break: break-word; color: var(--text-secondary); }
.banner { display: none; background: var(--surface-1); border: 1px solid var(--critical); color: var(--text-primary);
  border-radius: 8px; padding: 10px 14px; margin: 14px 16px 0; }
.mkt { color: var(--text-muted); font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>RIT Bot Control</h1>
  <span class="pill"><span id="connDot" class="dot"></span><span id="conn">connecting</span></span>
  <span class="pill" id="modePill"><span id="modeDot" class="dot"></span><span id="mode">-</span></span>
  <span class="pill" id="statePill"><span id="stateDot" class="dot"></span><span id="state">-</span></span>
  <span class="pill" id="roundPill">Round -</span>
  <span class="pill" id="tickPill">tick -</span>
  <div class="progress" aria-hidden="true"><div id="prog"></div></div>
  <button class="small" id="themeBtn" title="Toggle light/dark">Theme</button>
</header>
<div class="banner" id="banner"></div>
<main>
  <div class="col">
    <section class="card">
      <h2>Net liquidation value (P&amp;L this round)</h2>
      <div class="hero"><span class="big" id="nlv">$0</span><span class="sub" id="nlvSub"></span></div>
      <div class="stats" id="stats"></div>
      <div class="chart-wrap" id="chartWrap">
        <svg id="chart" role="img" aria-label="NLV over ticks this round"></svg>
        <div class="tip" id="tip"></div>
      </div>
    </section>
    <section class="card">
      <h2>Tenders &amp; auctions</h2>
      <div class="scroll-x" id="tenders"></div>
      <p class="hint">Net = expected profit per share after impact, fees and risk. The bot auto-accepts when net &ge; min edge (if auto-accept is on). Use the buttons to override.</p>
    </section>
    <section class="card">
      <h2>Positions</h2>
      <div class="scroll-x" id="positions"></div>
    </section>
  </div>
  <div class="col">
    <section class="card">
      <h2>Controls</h2>
      <div class="controls">
        <button id="pauseBtn" class="wide">Pause trading</button>
        <button id="autoBtn">Auto-accept: on</button>
        <button id="dryBtn">Mode</button>
        <button id="flattenBtn" class="danger">Flatten all</button>
        <button id="cancelBtn">Cancel orders</button>
      </div>
      <p class="hint">Pause stops all new trades and cancels open orders. Flatten closes every position now, even while paused.</p>
      <h2 style="margin-top:14px">Round preset</h2>
      <div class="rounds" id="rounds"></div>
    </section>
    <section class="card">
      <h2>Strategy settings</h2>
      <div class="params" id="params"></div>
      <p class="hint">Changes apply instantly. Picking a round preset resets these to that round's values.</p>
    </section>
    <section class="card">
      <h2>Bot log</h2>
      <div id="log"></div>
    </section>
  </div>
</main>
<script>
const $ = (id) => document.getElementById(id);
const fmt$ = (v) => (v < 0 ? "-$" : "$") + Math.abs(Math.round(v)).toLocaleString();
const fmtN = (v, d = 2) => (v == null ? "-" : Number(v).toFixed(d));
const signed = (v) => (v > 0 ? "+" : "") + Math.round(v).toLocaleString();
let S = null;

const PARAMS = [
  ["min_edge", "Min edge $/share", 0.005],
  ["risk_aversion", "Risk aversion", 0.1],
  ["impact_weight", "Impact weight", 0.1],
  ["unwind_ticks", "Unwind ticks", 1],
  ["front_load", "Front-load", 0.1],
  ["max_slippage", "Max slippage $", 0.01],
  ["passive", "Passive unwinding", "bool"],
  ["passive_qty", "Passive size", 1000],
  ["no_fines", "No-fines mode (R5-8)", "bool"],
  ["crowd_size", "Crowd trade size", 5000],
  ["arb", "Cross-market arb", "bool"],
  ["fade_size", "Fade size (0 = off)", 5000],
  ["fade_z", "Fade trigger (sd)", 0.5],
  ["wta_extra_edge", "WTA auction margin", 0.01],
  ["comp_extra_edge", "Comp. auction margin", 0.01],
];

async function control(body) {
  try {
    const r = await fetch("/api/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) alert(j.error || "failed");
    poll();
    return j.ok;
  } catch (e) { alert("Bot not reachable: " + e); }
}

// ---- static UI ----
for (let r = 1; r <= 8; r++) {
  const b = document.createElement("button");
  b.textContent = r; b.dataset.r = r;
  b.onclick = () => control({ action: "round", value: r });
  $("rounds").appendChild(b);
}
for (const [key, label, step] of PARAMS) {
  const l = document.createElement("label"); l.htmlFor = "p_" + key; l.textContent = label;
  let inp;
  if (step === "bool") {
    inp = document.createElement("input"); inp.type = "checkbox";
    inp.onchange = () => control({ action: "set", key, value: inp.checked });
  } else {
    inp = document.createElement("input"); inp.type = "number"; inp.step = step;
    inp.onchange = async () => {
      if (await control({ action: "set", key, value: inp.value })) {
        inp.classList.add("saved"); setTimeout(() => inp.classList.remove("saved"), 700);
      }
    };
  }
  inp.id = "p_" + key;
  $("params").append(l, inp);
}
$("pauseBtn").onclick = () => control({ action: S && S.paused ? "resume" : "pause" });
$("autoBtn").onclick = () => control({ action: "auto_tenders", value: !(S && S.auto_tenders) });
$("flattenBtn").onclick = () => confirm("Close every position now with aggressive orders?") && control({ action: "flatten" });
$("cancelBtn").onclick = () => control({ action: "cancel_all" });
$("dryBtn").onclick = () => {
  if (!S) return;
  if (!S.live && !confirm("Switch to LIVE? The bot will start sending real orders and accepting tenders.")) return;
  control({ action: "dry_run", value: S.live });
};
$("themeBtn").onclick = () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("ritTheme", root.dataset.theme); } catch (e) {}
  if (S) drawChart(S);
};
try { const t = localStorage.getItem("ritTheme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

// ---- chart ----
let chartPts = [], chartGeom = null, lastMouse = null;
function drawChart(s) {
  const svg = $("chart"), W = $("chartWrap").clientWidth, H = 240;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  const pts = s.nlv_hist || []; chartPts = pts;
  const L = 64, R = 12, T = 10, B = 24, tpp = s.tpp || 300;
  let lo = Math.min(0, ...pts.map(p => p[1])), hi = Math.max(0, ...pts.map(p => p[1]));
  if (hi - lo < 1000) { hi += 500; lo -= 500; }
  const pad = (hi - lo) * 0.08; hi += pad; lo -= pad;
  const x = (t) => L + (t / tpp) * (W - L - R), y = (v) => T + (hi - v) / (hi - lo) * (H - T - B);
  chartGeom = { x, y, L, R, T, B, W, H, tpp };
  let g = "";
  const step = niceStep((hi - lo) / 4);
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    const yy = y(v).toFixed(1);
    g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${Math.abs(v) < 1e-6 ? "var(--zero)" : "var(--grid)"}" stroke-width="1"/>`;
    g += `<text x="${L - 8}" y="${+yy + 4}" text-anchor="end">${fmt$(v)}</text>`;
  }
  for (let t = 0; t <= tpp; t += 50) g += `<text x="${x(t)}" y="${H - 6}" text-anchor="middle">${t}</text>`;
  if (pts.length > 1) {
    const d = pts.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1)).join("");
    g += `<path d="${d}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  } else {
    g += `<text x="${(L + W - R) / 2}" y="${H / 2}" text-anchor="middle">P&amp;L appears once the round is running</text>`;
  }
  g += `<g id="cross" style="display:none"><line id="cx" y1="${T}" y2="${H - B}" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="3 3"/>
        <circle id="cdot" r="5" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/></g>
        <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" id="hit"/>`;
  svg.innerHTML = g;
  const hit = $("hit");
  hit.onmousemove = (e) => { lastMouse = e; showTip(e); };
  hit.onmouseleave = () => { lastMouse = null; hideTip(); };
  if (lastMouse) showTip(lastMouse);
}
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
function showTip(e) {
  if (!chartPts.length || !chartGeom) return;
  const rect = $("chart").getBoundingClientRect(), mx = e.clientX - rect.left;
  const { x, y, L, R, W, tpp } = chartGeom;
  const t = (mx - L) / (W - L - R) * tpp;
  let best = chartPts[0];
  for (const p of chartPts) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
  const px = x(best[0]), py = y(best[1]);
  $("cross").style.display = ""; $("cx").setAttribute("x1", px); $("cx").setAttribute("x2", px);
  $("cdot").setAttribute("cx", px); $("cdot").setAttribute("cy", py);
  const tip = $("tip"); tip.style.display = "block";
  tip.innerHTML = `<b>${fmt$(best[1])}</b> &nbsp;tick ${best[0]}`;
  const tw = tip.offsetWidth;
  tip.style.left = Math.min(Math.max(px - tw / 2, 0), W - tw) + "px"; tip.style.top = Math.max(py - 40, 0) + "px";
}
function hideTip() { $("tip").style.display = "none"; const c = $("cross"); if (c) c.style.display = "none"; }

// ---- render ----
function setPill(dotId, textId, text, cls) { $(textId).textContent = text; $(dotId).className = "dot " + (cls || ""); }
function render(s) {
  S = s;
  setPill("connDot", "conn", s.connected ? "RIT connected" + (s.trader ? " · " + s.trader : "") : "RIT not reachable", s.connected ? "good" : "critical");
  setPill("modeDot", "mode", s.live ? "LIVE" : "DRY RUN", s.live ? "good" : "warning");
  const st = s.flatten ? "FLATTENING" : s.paused ? "PAUSED" : s.status === "ACTIVE" ? "RUNNING" : "WAITING (" + s.status + ")";
  setPill("stateDot", "state", st, s.flatten ? "critical" : s.paused ? "warning" : s.status === "ACTIVE" ? "good" : "");
  $("roundPill").textContent = "Round " + (s.round || "-");
  $("tickPill").textContent = `period ${s.period ?? "-"} · tick ${s.tick ?? 0}/${s.tpp ?? 300}`;
  $("prog").style.width = ((s.tick || 0) / (s.tpp || 300) * 100).toFixed(1) + "%";
  const b = $("banner");
  if (!s.connected && s.error) { b.style.display = "block"; b.textContent = s.error; } else b.style.display = "none";

  $("nlv").textContent = fmt$(s.nlv || 0);
  const st2 = s.stats || {};
  $("stats").innerHTML = `<span>Tenders accepted <b>${st2.accepted || 0}</b></span><span>Expected from tenders <b>${fmt$(st2.expected || 0)}</b></span><span>Auction bids <b>${st2.auctions || 0}</b></span>`;
  drawChart(s);

  // controls
  $("pauseBtn").textContent = s.paused ? "Resume trading" : "Pause trading";
  $("pauseBtn").classList.toggle("on", s.paused);
  $("autoBtn").textContent = "Auto-accept: " + (s.auto_tenders ? "on" : "off");
  $("autoBtn").classList.toggle("on", !s.auto_tenders);
  $("dryBtn").textContent = s.live ? "Mode: LIVE" : "Mode: DRY RUN";
  for (const btn of $("rounds").children) btn.classList.toggle("on", +btn.dataset.r === s.round);
  for (const [key, , step] of PARAMS) {
    const inp = $("p_" + key), v = s.config[key];
    if (document.activeElement === inp) continue;
    if (step === "bool") inp.checked = !!v; else if (String(inp.value) !== String(v)) inp.value = v;
  }

  // tenders
  const tv = s.tenders || [];
  if (!tv.length) $("tenders").innerHTML = `<div class="empty">No open tenders. New ones appear here the moment RIT sends them.</div>`;
  else {
    let h = `<table><thead><tr><th>Tender</th><th>Side</th><th>Qty</th><th>Price</th><th>Mid</th><th>Edge</th><th>Cost</th><th>Net/sh</th><th>Exp. $</th><th>Expires</th><th>Bot</th><th></th></tr></thead><tbody>`;
    for (const t of tv) {
      const fixed = t.kind === "fixed";
      const cls = t.decision === "PASS" ? "" : fixed ? "good" : "serious";
      const left = t.expires - (s.tick || 0);
      h += `<tr><td>${t.id} <span class="mkt">${t.ticker}${fixed ? "" : " · " + t.kind}</span></td><td>${t.side}</td><td>${t.qty.toLocaleString()}</td>
        <td>${fmtN(t.price)}${fixed ? "" : " <span class='mkt'>bid</span>"}</td><td>${fmtN(t.mid)}</td><td>${fmtN(t.edge, 3)}</td><td>${fmtN(t.cost, 3)}</td>
        <td><b>${fmtN(t.net, 3)}</b></td><td>${fixed ? fmt$(t.net * t.qty) : "-"}</td><td>${left > 0 ? left + " ticks" : "now"}</td>
        <td><span class="badge ${cls}">${t.decision}</span></td>
        <td><button class="small" onclick="control({action:'accept', id:${t.id}})">${fixed ? "Accept" : "Bid " + fmtN(t.price)}</button>
            <button class="small" onclick="control({action:'decline', id:${t.id}})">Decline</button></td></tr>`;
    }
    $("tenders").innerHTML = h + "</tbody></table>";
  }

  // positions
  const ps = s.stocks || [];
  if (!ps.length) $("positions").innerHTML = `<div class="empty">Waiting for market data.</div>`;
  else {
    let h = `<table><thead><tr><th>Stock</th><th>Position</th><th>Mid</th><th>Vol/tick</th><th>Markets (bid / ask · position)</th></tr></thead><tbody>`;
    for (const p of ps) {
      const m = p.markets.map(k => `${k.ticker} ${fmtN(k.bid)} / ${fmtN(k.ask)} · ${signed(k.position)}`).join("<br>");
      h += `<tr><td><b>${p.name}</b></td><td><b>${signed(p.position)}</b></td><td>${fmtN(p.mid)}</td><td>${fmtN(p.vol, 2)}%</td><td class="mkt">${m}</td></tr>`;
    }
    $("positions").innerHTML = h + "</tbody></table>";
  }

  // log
  const lg = $("log"), atBottom = lg.scrollTop + lg.clientHeight >= lg.scrollHeight - 20;
  lg.textContent = (s.log || []).join("\n");
  if (atBottom) lg.scrollTop = lg.scrollHeight;
}

async function poll() {
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    render(await r.json());
  } catch (e) {
    setPill("connDot", "conn", "bot not running", "critical");
  }
}
setInterval(poll, 500); poll();
addEventListener("resize", () => S && drawChart(S));
</script>
</body>
</html>
"""


if __name__ == "__main__":
    bot = Bot(parse_args())
    if bot.cfg.dash_port:
        start_dashboard(bot)

    def bye(*_):
        log("Stopping - cancelling open orders.")
        try:
            if not bot.cfg.dry_run:
                bot.api.post("/commands/cancel", all=1)
        finally:
            sys.exit(0)

    signal.signal(signal.SIGINT, bye)
    bot.run()
