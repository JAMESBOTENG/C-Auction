# RIT liability-trading bot (Babson Trading Competition, LT3/LT4)

## Setup (Windows machine running the RIT client)
1. Install Python 3.9+ and run `pip install requests`.
2. Open RIT and log in to the competition server. Open the **API** window in the client and
   copy the **API key**. Check the port too (the default is 9999).
3. Run the bot in dry-run mode first. It prints its decisions and places no trades:
   `python rit_liability_bot.py --api-key YOURKEY --dry-run`
4. Run it live: `python rit_liability_bot.py --api-key YOURKEY`. Press Ctrl+C to stop; that also cancels any open orders.

## Check this first on the practice server: are the two markets netted?
The bot treats `CRZY_M` and `CRZY_A` as **one inventory**. It may buy a tender on `_M` and sell part of it
on `_A` when `_A` is cheaper, which can leave e.g. `CRZY_M +30,000 / CRZY_A -30,000`.
On the practice server, accept a tender, let the bot unwind, then look at the Portfolio and
Trading Limits windows:
- If the **net** limit and the fines treat the stock as flat, you're fine (this is the intent of the case:
  "distribute your trades between the two markets").
- If they don't, run with `--net-across-markets`. That flag switches netting **off**, so each
  ticker unwinds only on its own market.

## Settings by round: use `--round N`
`python rit_liability_bot.py --api-key YOURKEY --round 6` loads the preset for that round. Any flag
you pass explicitly overrides the preset.

| Round | Preset |
|---|---|
| 1-3 | defaults. Fines apply, so the bot only trades to unwind tenders. |
| 4 | `unwind_ticks 15` |
| 5 | no-fines mode, faster unwind |
| 6 | no-fines mode, `min_edge 0.05`, fast unwind, crowd trade on competitive auctions |
| 7 | no-fines mode, `min_edge 0.05`, `risk_aversion 0.8` |
| 8 | like 7, plus crowd trade on auctions |

**No-fines mode (rounds 5-8)** adds:
- **Crowd trade:** in a competitive auction, every winner dumps the block right after it closes.
  `crowd_ticks` (default 6) ticks before the close, the bot goes `crowd_size` (default 25k) shares in
  the opposite direction. It holds the position until `crowd_hold` ticks after the close, then covers
  into the winners' selling. Set `--crowd-size 0` to turn it off.
- **Cross-market arbitrage:** when one market's bid is above the other market's ask by more than both
  fees combined, the bot buys on one market and sells on the other (only rounds 5-6 have two markets).
- **Front-loaded unwind** (`front_load`): sells more in the first ticks of an unwind, so the bot reaches the order book before other traders.

Main tuning knobs:
- `--min-edge`: profit per share still required after costs. Raise it to accept fewer tenders.
- `--risk-aversion`: how much the bot charges for volatility. Raise it in high-vol rounds.
- `--impact-weight`: how pessimistic the bot is about its exit price.
- `--unwind-ticks`: how fast it flattens a position.
- `--wta-extra-edge` and `--comp-extra-edge`: how aggressively it bids in auctions. Lower values win more often but earn less per share.

## Testing offline
`python mock_rit_server.py` in one terminal and `python rit_liability_bot.py --api-key x` in another.
The mock is a crude fake that only checks the plumbing. It is not a model of the real market.
