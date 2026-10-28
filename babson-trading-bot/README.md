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

## Settings by round
| Round | Suggested flags |
|---|---|
| 1-3 (base case, fines) | defaults |
| 4 (CRZY 9% vol, TAME 3% high liq) | defaults; maybe `--unwind-ticks 15` |
| 5 | defaults |
| 6 (worse tenders + auctions) | `--min-edge 0.05` |
| 7 (CRZY 12% vol, TAME low liquidity) | `--min-edge 0.05 --risk-aversion 0.8` |
| 8 (high vol everywhere + auctions) | `--min-edge 0.05 --risk-aversion 0.8` |

Main tuning knobs:
- `--min-edge`: profit per share still required after costs. Raise it to accept fewer tenders.
- `--risk-aversion`: how much the bot charges for volatility. Raise it in high-vol rounds.
- `--impact-weight`: how pessimistic the bot is about its exit price.
- `--unwind-ticks`: how fast it flattens a position.
- `--wta-extra-edge` and `--comp-extra-edge`: how aggressively it bids in auctions. Lower values win more often but earn less per share.

## Testing offline
`python mock_rit_server.py` in one terminal and `python rit_liability_bot.py --api-key x` in another.
The mock is a crude fake that only checks the plumbing. It is not a model of the real market.
