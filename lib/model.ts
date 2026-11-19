// The token radar's model, version radar-2: one snapshot of the protocol universe in, one ranked
// board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol
// is pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed
// into the ranked board.
//
// radar-2 values a pre-token protocol from the snapshot's own market evidence instead of one flat
// multiple. The protocols that already trade are the comparables: within each category, their
// market-cap/TVL ratios say what the market pays for a dollar of TVL in that kind of protocol.
//
//   ratio(p)   = the category ratio of p's category: the trimmed median of mcap_usd / tvl_usd over
//                the category's live protocols, shrunk toward the global trimmed median by the
//                category's peer count (ratio = (n x median + PRIOR_PEERS x global) / (n + PRIOR_PEERS)),
//                so a category with two peers leans on the market's overall ratio and one with twenty
//                stands on its own. Live ratios outside [RATIO_FLOOR, RATIO_CAP] are data noise or
//                outliers and never enter the statistics; a category with no live peers at all uses
//                the global ratio.
//   growth     = clamp(change_7d, GROWTH_FLOOR, GROWTH_CAP) per cent (a missing change counts as 0)
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   ageMult    = AGE_MIN_MULTIPLIER + (AGE_MAX_MULTIPLIER - AGE_MIN_MULTIPLIER)
//                x min(age_days, AGE_DAYS_CAP) / AGE_DAYS_CAP   (age unknown: UNKNOWN_AGE_DAYS)
//   chainMult  = 1 + CHAIN_STEP x min(chains - 1, CHAIN_EXTRA_CAP)
//   implied    = max(1, round(tvl_usd x ratio x growthMult x ageMult x chainMult))
//
// Every factor is written into the row's `model` breakdown, with the category's peer count, so a
// reader can recompute each implied value from the snapshot alone. No protocol name is ever
// special-cased: the same function scores every row, and ages come only from the snapshot's `as_of`.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants: the knobs of radar-2, all stated here and changeable in one place. */
export interface ModelConstants {
  /** Live mcap/TVL ratios below this are treated as noise and excluded from the statistics. */
  ratio_floor: number;
  /** Live mcap/TVL ratios above this are treated as outliers and excluded from the statistics. */
  ratio_cap: number;
  /** The fraction trimmed from each tail of a ratio sample before its median is taken. */
  trim_fraction: number;
  /** The pseudo-count that shrinks a category median toward the global median. */
  prior_peers: number;
  /** How strongly a week's TVL growth moves the value: the multiplier per +100%. */
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  /** The age multiplier of a protocol listed today. */
  age_min_multiplier: number;
  /** The age multiplier of a protocol at or past `age_days_cap`. */
  age_max_multiplier: number;
  /** The age, in days, at which the age multiplier stops rising. */
  age_days_cap: number;
  /** The age a protocol with no listing date is scored with. */
  unknown_age_days: number;
  /** The value added per chain beyond the first. */
  chain_step: number;
  /** How many extra chains count toward the chain multiplier. */
  chain_extra_cap: number;
}

export const MODEL: ModelConstants = {
  ratio_floor: 0.005,
  ratio_cap: 20,
  trim_fraction: 0.1,
  prior_peers: 8,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  age_min_multiplier: 0.7,
  age_max_multiplier: 1.2,
  age_days_cap: 1460,
  unknown_age_days: 365,
  chain_step: 0.025,
  chain_extra_cap: 10,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    /** The category ratio applied to this row (kept under the radar-1 name for the dashboard). */
    base_multiple: number;
    category_ratio: number;
    /** How many live protocols in the category back that ratio. */
    category_peers: number;
    /** The global trimmed-median ratio the category ratio is shrunk toward. */
    global_ratio: number;
    growth_pct: number;
    growth_multiplier: number;
    /** The age multiplier (kept under the radar-1 name for the dashboard). */
    maturity_multiplier: number;
    age_multiplier: number;
    chain_multiplier: number;
    chain_count: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_ratio: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  age_multiplier: number;
  chain_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The model's constants as the dashboard states them: radar-2's knobs plus the radar-1 display fields. */
export interface DisplayModel extends ModelConstants {
  /** The computed global ratio, shown where radar-1 showed its flat multiple. */
  base_multiple: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
}

/** One category's comparable set: how many live peers, their trimmed median, and the ratio applied. */
export interface CategoryStat {
  category: string | null;
  peers: number;
  median_ratio: number | null;
  ratio: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: DisplayModel;
  model_version: string;
  model_stats: {
    global_ratio: number;
    live_ratios_used: number;
    categories: CategoryStat[];
  };
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sample after trimming `trimFraction` from each tail; null for an empty sample. */
export function trimmedMedian(values: number[], trimFraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * trimFraction);
  const kept = sorted.slice(trim, sorted.length - trim);
  const sample = kept.length > 0 ? kept : sorted;
  const mid = Math.floor(sample.length / 2);
  return sample.length % 2 === 1 ? sample[mid]! : (sample[mid - 1]! + sample[mid]!) / 2;
}

/** The comparable statistics of one snapshot: the global ratio and every category's shrunk ratio. */
export interface RatioStats {
  global_ratio: number;
  /** How many live protocols' ratios entered the statistics (after the sanity bounds). */
  live_ratios_used: number;
  by_category: Map<string | null, CategoryStat>;
}

/**
 * The market's own ratios, from the snapshot's live protocols only: for each category, the trimmed
 * median of its peers' mcap/TVL, shrunk toward the global trimmed median by the peer count, so thin
 * categories borrow the market's evidence and deep ones stand on their own.
 */
export function ratioStats(snapshot: Snapshot, model: ModelConstants = MODEL): RatioStats {
  const sane = (p: SnapshotProtocol): number | null => {
    if (p.mcap_usd === null || p.tvl_usd <= 0) return null;
    const r = p.mcap_usd / p.tvl_usd;
    return r >= model.ratio_floor && r <= model.ratio_cap ? r : null;
  };
  const all: number[] = [];
  const perCategory = new Map<string | null, number[]>();
  for (const p of snapshot.protocols) {
    const r = sane(p);
    if (r === null) continue;
    all.push(r);
    const list = perCategory.get(p.category);
    if (list === undefined) perCategory.set(p.category, [r]);
    else list.push(r);
  }
  const global = trimmedMedian(all, model.trim_fraction) ?? 1;
  const by_category = new Map<string | null, CategoryStat>();
  for (const [category, ratios] of perCategory) {
    const median = trimmedMedian(ratios, model.trim_fraction)!;
    const n = ratios.length;
    by_category.set(category, {
      category,
      peers: n,
      median_ratio: median,
      ratio: (n * median + model.prior_peers * global) / (n + model.prior_peers),
    });
  }
  return { global_ratio: global, live_ratios_used: all.length, by_category };
}

/** The ratio one protocol is valued at: its category's shrunk ratio, or the global one. */
function ratioFor(protocol: SnapshotProtocol, stats: RatioStats): { ratio: number; peers: number } {
  if (protocol.category !== null) {
    const stat = stats.by_category.get(protocol.category);
    if (stat !== undefined) return { ratio: stat.ratio, peers: stat.peers };
  }
  return { ratio: stats.global_ratio, peers: 0 };
}

/** The factors and the implied value one protocol gets under `model` and the snapshot's `stats`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  stats: RatioStats,
): { implied: number; ratio: number; peers: number; growthPct: number; growthMult: number; ageMult: number; chainMult: number; age: number | null } {
  const { ratio, peers } = ratioFor(protocol, stats);
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const ageShare = Math.min(Math.max(ageForModel, 0), model.age_days_cap) / model.age_days_cap;
  const ageMult = model.age_min_multiplier + (model.age_max_multiplier - model.age_min_multiplier) * ageShare;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_extra_cap);
  const chainMult = 1 + model.chain_step * extraChains;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * ratio * growthMult * ageMult * chainMult));
  return { implied, ratio, peers, growthPct, growthMult, ageMult, chainMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a bridge of another network's asset, not a launch candidate of their own. */
const BRIDGE_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Cross Chain Bridge']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a bridge, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !(p.category !== null && BRIDGE_CATEGORIES.has(p.category)) && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const stats = ratioStats(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => ({ p, ...impliedValue(p, snapshot.as_of, model, stats) }));
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: round4(s.ratio),
      category_ratio: round4(s.ratio),
      category_peers: s.peers,
      global_ratio: round4(stats.global_ratio),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.ageMult),
      age_multiplier: round4(s.ageMult),
      chain_multiplier: round4(s.chainMult),
      chain_count: s.p.chains.length,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** What gas costs on a chain, in the plain figures a farmer budgets with. */
interface GasProfile {
  /** Funding the wallet and the first transactions. */
  setup: string;
  /** One ordinary transaction (a deposit, a swap, a claim). */
  oneTx: string;
  /** A week of small activity. */
  weekly: string;
}

const L2_CHAINS = new Set(['Arbitrum', 'Base', 'Optimism', 'Polygon', 'zkSync Era', 'Linea', 'Scroll', 'Mantle', 'Blast', 'Mode', 'Zora', 'BSC', 'Avalanche', 'Gnosis', 'Fantom', 'Sonic']);

function gasFor(chain: string): GasProfile {
  if (chain === 'Ethereum') return { setup: 'about $25 of ETH for mainnet gas', oneTx: 'about $6 of gas', weekly: 'about $8 of gas a week' };
  if (chain === 'Solana') return { setup: 'under $1 of SOL for fees', oneTx: 'a few cents of fees', weekly: 'under $1 of fees a week' };
  if (chain === 'Bitcoin') return { setup: 'about $5 of BTC for fees', oneTx: 'about $2 of fees', weekly: 'about $3 of fees a week' };
  if (L2_CHAINS.has(chain)) return { setup: `about $5 of ETH for gas on ${chain}`, oneTx: 'about $1 of gas', weekly: 'about $2 of gas a week' };
  return { setup: `about $8 of ${chain}'s gas token`, oneTx: 'about $2 of gas', weekly: 'about $3 of gas a week' };
}

/** A category's playbook: its two core actions and its recurring weekly action, in a farmer's words. */
interface Playbook {
  core: [FarmStep, FarmStep];
  weekly: FarmStep;
}

/**
 * The playbook for one protocol, chosen by its category and filled with its own figures: the capital
 * its TVL tier calls for, its first chain's gas, and a second chain when it runs on several. Every
 * step is an action a farmer can actually take in that kind of protocol, with a cost and a time.
 */
function playbookFor(p: SnapshotProtocol, capital: number, gas: GasProfile): Playbook {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const chain = chainOf(p);
  const half = Math.max(25, Math.round(capital / 2 / 5) * 5);
  const borrow = Math.max(20, Math.round((capital * 0.4) / 5) * 5);
  const step = (text: string, cost: string, time: string): FarmStep => ({ text, cost, time });

  if (c.includes('uncollateralized') || c === 'lending') {
    return {
      core: [
        step(`Supply $${capital} of USDC to ${name}'s main market on ${chain} and leave it supplied; lending positions are the activity a launch snapshot almost always counts.`, `$${capital} of capital and ${gas.oneTx}`, '15 minutes to set up'),
        step(`Borrow $${borrow} of USDC against the supply, hold the borrow open for 7 days, then repay it in full, so the wallet shows both sides of the market rather than a one-way deposit.`, `${gas.oneTx} twice, and a few cents of interest`, '10 minutes, plus 7 days with the borrow open'),
      ],
      weekly: step(`Roll the position once a week: repay and redraw a small borrow, or add and withdraw $${borrow} of supply, so every weekly snapshot shows the wallet active.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c.includes('cdp') || c.includes('stablecoin') || c.includes('algo-stables')) {
    return {
      core: [
        step(`Open a ${name} vault on ${chain} with $${capital} of collateral (ETH or a major stablecoin) and mint its stablecoin against it, keeping the collateral ratio above 200% so the position survives a bad week.`, `$${capital} of collateral and ${gas.oneTx}`, '20 minutes to set up'),
        step(`Deposit the minted stablecoin into ${name}'s own stability or savings pool, so the wallet is earning on both the vault and the stablecoin it issued.`, gas.oneTx, '10 minutes'),
      ],
      weekly: step(`Check the vault's collateral ratio once a week and top the collateral up if it drifts toward 180%; an unhealthy vault is liquidated and the farm is lost with it.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c.includes('dex')) {
    return {
      core: [
        step(`Provide $${capital} of liquidity to ${name}'s busiest pool on ${chain}, split evenly between the pair's two assets, and keep the LP position open.`, `$${capital} of capital and ${gas.oneTx}`, '15 minutes to set up'),
        step(`Route five swaps of about $${borrow} each through ${name} across the first week, in both directions; consistent volume from one wallet is what DEX points programs measure.`, `${gas.oneTx} per swap`, '5 minutes per swap'),
      ],
      weekly: step(`Make one swap and rebalance the LP range once a week, so the wallet keeps trading volume without churning the whole position.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c.includes('liquid staking') || c.includes('staking pool') || c.includes('staking')) {
    return {
      core: [
        step(`Stake $${capital} of the chain's native asset through ${name} on ${chain} and keep the liquid staking receipt token in the same wallet; the receipt is the position a snapshot sees.`, `$${capital} of capital and ${gas.oneTx}`, '10 minutes to set up'),
        step(`Put half of the receipt tokens (about $${half} worth) to work in a lending market or pool that accepts them, so the wallet stacks a second, separate position on the same stake.`, gas.oneTx, '15 minutes'),
      ],
      weekly: step(`Add a small top-up stake of about $${borrow} once a week, so the staked balance grows steadily instead of appearing in a single burst.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c.includes('restak') || c.includes('anchor btc') || c.includes('decentralized btc')) {
    return {
      core: [
        step(`Deposit $${capital} of BTC or a liquid staking token into ${name} on ${chain} and hold the restaked receipt; restaking points accrue to the wallet that holds it.`, `$${capital} of capital and ${gas.oneTx}`, '20 minutes to set up'),
        step(`Register the deposit on ${name}'s points page and link this wallet there, then screenshot the points balance; unregistered deposits are the most common way restaking farms are lost.`, 'nothing to register', '10 minutes'),
      ],
      weekly: step(`Check the points balance once a week and make one small extra deposit of about $${borrow} a month, so the position reads as an ongoing commitment.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('collateral')) {
    return {
      core: [
        step(`Deposit $${capital} of USDC into a ${name} curated vault on ${chain}; curator vaults (Morpho-style) are exactly the balances a curator's own token launch would reward.`, `$${capital} of capital and ${gas.oneTx}`, '15 minutes to set up'),
        step(`Split a second $${half} into a different vault from the same curator, so the wallet is exposed to two of its strategies rather than one.`, gas.oneTx, '10 minutes'),
      ],
      weekly: step(`Review the two vaults' allocations once a week and move the smaller one if its underlying markets change; curators publish the changes, and following them is visible activity.`, gas.weekly, '15 minutes a week'),
    };
  }
  if (c.includes('rwa')) {
    return {
      core: [
        step(`Complete ${name}'s eligibility and KYC check first, then subscribe $${capital} to its tokenized treasury or credit product on ${chain}; for RWA the verified account, not just the wallet, is what a launch can reward.`, `$${capital} of capital, and no fee for the check itself`, '30 minutes including verification'),
        step(`Hold the yield-bearing token in the same wallet and note its redemption windows in the farm log; RWA positions settle on the issuer's schedule, not instantly.`, 'nothing while holding', '5 minutes to note the dates'),
      ],
      weekly: step(`Reinvest the yield once a month, or add about $${borrow} when a new issuance opens, so the account shows recurring participation.`, gas.weekly, '10 minutes when you act'),
    };
  }
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options') || c.includes('synthetics')) {
    return {
      core: [
        step(`Deposit $${capital} of USDC as margin on ${name} and open one small hedged position (no more than 10% of the margin at risk), so the account trades without betting the farm on direction.`, `$${capital} of margin and ${gas.oneTx}`, '20 minutes to set up'),
        step(`Place one small trade a week for four weeks, each under 10% of margin, closing each before the next; a steady record of real trades is what derivatives points programs count.`, `${gas.oneTx} per trade, plus trading fees`, '10 minutes per trade'),
      ],
      weekly: step(`Review open positions and margin once a week and withdraw any profit above the starting margin, so a liquidation can never take the whole farm.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c.includes('basis')) {
    return {
      core: [
        step(`Commit $${capital} of USDC to ${name}'s basis strategy on ${chain}: the vault runs the delta-neutral pair (long spot, short perpetual) and the wallet holds the strategy shares.`, `$${capital} of capital and ${gas.oneTx}`, '15 minutes to set up'),
        step(`Keep a further $${half} of USDC idle in the same wallet as a margin buffer; basis strategies draw on it in volatile weeks, and an under-buffered position is the usual way this farm fails.`, `$${half} held back, unspent`, 'no time, it just sits there'),
      ],
      weekly: step(`Check the strategy's funding-rate earnings once a week and compound the payout into the position monthly.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c.includes('yield') || c.includes('farm') || c.includes('liquidity manager') || c.includes('leveraged')) {
    return {
      core: [
        step(`Deposit $${capital} of USDC or the chain's main stablecoin into ${name}'s flagship vault on ${chain} and keep the vault shares in this wallet.`, `$${capital} of capital and ${gas.oneTx}`, '15 minutes to set up'),
        step(`When the first rewards land, claim them and re-deposit them into the same vault; a compounding wallet shows the protocol real, retained usage.`, gas.oneTx, '10 minutes, once rewards appear'),
      ],
      weekly: step(`Make one deposit or withdrawal of about $${borrow} once a week, so the vault balance moves in a pattern no snapshot can mistake for a parked one-off.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c === 'chain') {
    return {
      core: [
        step(`Bridge $${capital} of USDC to ${name} and make the wallet's first transactions there: one DEX swap and one lending deposit in its native apps, so the wallet exists on the chain before any snapshot of it.`, `$${capital} of capital and about $5 of bridge and gas fees`, '30 minutes to set up'),
        step(`Hold a small balance of ${name}'s gas asset and pay fees with it weekly; chains reward the wallets that actually transact on them, not the ones that only hold a bridged balance.`, gas.oneTx, '5 minutes'),
      ],
      weekly: step(`Transact on ${name} once a week (a swap, a transfer between your own wallets, a small stake), keeping a streak of active weeks.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c.includes('payment') || c.includes('card')) {
    return {
      core: [
        step(`Open a ${name} account, finish its KYC, and activate the payment account or card; for payment products the verified, active account is the farm.`, 'no fee to open; a card may carry a small issue fee', '25 minutes including verification'),
        step(`Route about $${capital} of ordinary spending or transfers through ${name} across the first month, in several separate payments rather than one lump.`, `$${capital} of your own spending, not extra cost`, 'a few minutes per payment'),
      ],
      weekly: step(`Make at least one payment a week through ${name}, so the account reads as a real user's, which is what launch allocations for payment apps measure.`, 'nothing beyond the payment itself', '5 minutes a week'),
    };
  }
  if (c.includes('prediction')) {
    return {
      core: [
        step(`Fund the wallet with $${capital} of USDC and take one position in a liquid ${name} market you can explain; prediction markets reward accounts with a settled history.`, `$${capital} of capital and ${gas.oneTx}`, '15 minutes to set up'),
        step(`Let the first position settle, then take a second position in a different market category, so the account shows breadth rather than one bet.`, gas.oneTx, '10 minutes, after the first settles'),
      ],
      weekly: step(`Place or adjust one small position a week, keeping total exposure under the starting $${capital}.`, gas.weekly, '10 minutes a week'),
    };
  }
  if (c.includes('insurance')) {
    return {
      core: [
        step(`Buy about $${capital} of cover from ${name} on ${chain} against a major protocol you actually use, for a 90-day term; cover buyers are the customers an insurance token launch rewards first.`, `$${capital} of cover, priced as a premium of a few per cent`, '20 minutes to set up'),
        step(`If ${name} offers an underwriting pool, stake $${half} into it as well, and note that this half carries real loss risk if a claim pays out.`, `$${half} staked and ${gas.oneTx}`, '15 minutes'),
      ],
      weekly: step(`Check the cover is still in force once a month and renew it before it lapses, so there is no gap in the record.`, gas.weekly, '10 minutes a month'),
    };
  }
  if (c.includes('governance')) {
    return {
      core: [
        step(`Deposit $${capital} into the ${name} market its incentive program currently rewards on ${chain}; the program page names the market, and farming the wrong one earns nothing.`, `$${capital} of capital and ${gas.oneTx}`, '15 minutes to set up'),
        step(`Vote on one live governance proposal, or delegate your vote to an active delegate, in the first epoch; incentive programs increasingly weight voters over passive deposits.`, gas.oneTx, '10 minutes'),
      ],
      weekly: step(`Claim the week's incentives and re-deposit them, and vote in any new proposal, so both the balance and the voting record keep growing.`, gas.weekly, '15 minutes a week'),
    };
  }
  if (c.includes('index')) {
    return {
      core: [
        step(`Buy $${capital} of ${name}'s index token on ${chain} and hold it in this wallet; index holders are the natural recipients of an index protocol's own launch.`, `$${capital} of capital and ${gas.oneTx}`, '10 minutes to set up'),
        step(`Provide about $${half} of liquidity for the index token's main pool, so the wallet also appears on the market-making side of the product.`, `$${half} of capital and ${gas.oneTx}`, '15 minutes'),
      ],
      weekly: step(`Rebalance once a month: add about $${borrow} or trim back to the starting weight, keeping the position deliberate rather than forgotten.`, gas.weekly, '10 minutes a month'),
    };
  }
  if (c.includes('launchpad')) {
    return {
      core: [
        step(`Register this wallet for one open ${name} sale and complete its stated requirements (usually holding or staking its platform asset) before the sale's snapshot date.`, `$${capital} held or staked to qualify`, '20 minutes to register'),
        step(`Commit about $${half} to the sale itself if the allocation lands, and keep the rest for the next one; launchpad allocations reward accounts with a history of taking part.`, `$${half} if allocated`, '10 minutes'),
      ],
      weekly: step(`Check ${name} for new sales once a week and register early; most sales snapshot their participants days before they open.`, 'nothing to check', '5 minutes a week'),
    };
  }
  if (c.includes('cedefi') || c.includes('cex')) {
    return {
      core: [
        step(`Deposit $${capital} into a ${name} earn product and keep the deposit receipts and statements; CeDeFi positions live on the platform's books, so your records are the proof of the farm.`, `$${capital} of capital and no gas (off-chain)`, '15 minutes to set up'),
        step(`Turn on the product's auto-compound or loyalty setting if it offers one, so the balance grows without weekly transactions the platform cannot see anyway.`, 'nothing', '5 minutes'),
      ],
      weekly: step(`Log in once a week, check the balance and rate, and save a screenshot or statement line into the farm log.`, 'nothing', '5 minutes a week'),
    };
  }
  return {
    core: [
      step(`Deposit $${capital} of USDC into ${name} on ${chain} and complete its core action once (a deposit, a stake or a mint, whichever its app leads with), so the wallet is a real user of the product.`, `$${capital} of capital and ${gas.oneTx}`, '15 minutes to set up'),
      step(`Repeat the core action a second time in a later week with about $${half}, so the wallet shows a history of use rather than a single touch on one day.`, `$${half} of capital and ${gas.oneTx}`, '10 minutes'),
    ],
    weekly: step(`Make one qualifying action each week in ${name}'s app, such as a deposit, a claim or a vote, so every weekly snapshot counts the wallet as active.`, gas.weekly, '10 minutes a week'),
  };
}

/**
 * A protocol's farm plan: seven or eight steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a hand-written list
 * of names: a setup, the category's two core actions, a second-chain repetition for multi-chain
 * protocols, the weekly action, the hold, the claim check, and the log.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const book = playbookFor(p, capital, gas);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm with, and keep its seed phrase offline; fund it on ${chain} before you start.`,
      cost: gas.setup,
      time: '10 minutes',
    },
    book.core[0],
    book.core[1],
  ];
  if (p.chains.length >= 3) {
    const second = p.chains[1]!;
    const half = Math.max(25, Math.round(capital / 2 / 5) * 5);
    steps.push({
      text: `Repeat the core position on ${second}, one of ${p.name}'s other markets, with about $${half}; a wallet active on several of the protocol's chains is worth more to a launch than the same funds on one.`,
      cost: `$${half} of capital and ${gasFor(second).oneTx}`,
      time: '15 minutes',
    });
  }
  steps.push(book.weekly);
  steps.push({
    text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot; most launches weight wallets by how long they stayed, not just that they came.`,
    cost: `the $${capital} stays in the position`,
    time: `${hold} days`,
  });
  steps.push({
    text: `Before you withdraw anything, open ${p.name}'s own points or rewards page and claim only from the link it publishes; never pay a fee or sign a claim on a site that merely looks like it.`,
    cost: 'no fee to check, and never pay to claim',
    time: '10 minutes',
  });
  steps.push({
    text: `Write the wallet, the dates and every transaction in a farm log, so you can repeat the position next season or unwind it without hunting through explorers.`,
    cost: 'nothing but the log',
    time: '5 minutes',
  });
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_ratio: row.model.category_ratio,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    age_multiplier: row.model.age_multiplier,
    chain_multiplier: row.model.chain_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const stats = ratioStats(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const categories = [...stats.by_category.values()]
    .map((s) => ({ category: s.category, peers: s.peers, median_ratio: s.median_ratio === null ? null : round4(s.median_ratio), ratio: round4(s.ratio) }))
    .sort((a, b) => (a.category ?? '') < (b.category ?? '') ? -1 : (a.category ?? '') > (b.category ?? '') ? 1 : 0);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: {
      ...model,
      base_multiple: round4(stats.global_ratio),
      maturity_floor: model.age_min_multiplier,
      maturity_range: round4(model.age_max_multiplier - model.age_min_multiplier),
      maturity_days: model.age_days_cap,
    },
    model_version: MODEL_VERSION,
    model_stats: {
      global_ratio: round4(stats.global_ratio),
      live_ratios_used: stats.live_ratios_used,
      categories,
    },
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
