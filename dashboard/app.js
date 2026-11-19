// Token Radar dashboard (model radar-2). Renders window.RADAR, written beside dashboard/ by
// main.ts: the ranked pre-token board, the live-token set, a per-protocol detail drawer with the
// model's own factors, and a farm plan per protocol. No network: every byte shown is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var M = DATA.model, MS = DATA.model_stats;
  var state = { q: '', category: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usdFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFull.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtX(n) { return (Math.round(n * 10000) / 10000).toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0') + 'x'; }
  function catStat(cat) {
    for (var i = 0; i < MS.categories.length; i++) if (MS.categories[i].category === cat) return MS.categories[i];
    return null;
  }
  // The board's arithmetic, from the rounded factors the detail view shows: it lands within a
  // rounding step of the board's own figure, which is computed from the unrounded factors.
  function recompute(r) {
    return Math.round(r.tvl_usd * r.category_ratio * r.growth_multiplier * r.age_multiplier * r.chain_multiplier);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ---- Farm plans: the same derivation board.json carries (category, chains, TVL, age decide the
  // actions, the capital, the hold and every cost and time). No protocol name is special-cased. ----
  function chainOf(p) { return p.chains && p.chains.length ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  var L2 = { Arbitrum: 1, Base: 1, Optimism: 1, Polygon: 1, 'zkSync Era': 1, Linea: 1, Scroll: 1, Mantle: 1, Blast: 1, Mode: 1, Zora: 1, BSC: 1, Avalanche: 1, Gnosis: 1, Fantom: 1, Sonic: 1 };
  function gasFor(chain) {
    if (chain === 'Ethereum') return { setup: 'about $25 of ETH for mainnet gas', oneTx: 'about $6 of gas', weekly: 'about $8 of gas a week' };
    if (chain === 'Solana') return { setup: 'under $1 of SOL for fees', oneTx: 'a few cents of fees', weekly: 'under $1 of fees a week' };
    if (chain === 'Bitcoin') return { setup: 'about $5 of BTC for fees', oneTx: 'about $2 of fees', weekly: 'about $3 of fees a week' };
    if (L2[chain]) return { setup: 'about $5 of ETH for gas on ' + chain, oneTx: 'about $1 of gas', weekly: 'about $2 of gas a week' };
    return { setup: "about $8 of " + chain + "'s gas token", oneTx: 'about $2 of gas', weekly: 'about $3 of gas a week' };
  }
  function playbookFor(p, capital, gas) {
    var c = (p.category || '').toLowerCase(), n = p.name, ch = chainOf(p);
    var half = Math.max(25, Math.round(capital / 2 / 5) * 5), borrow = Math.max(20, Math.round(capital * 0.4 / 5) * 5);
    function S(text, cost, time) { return { text: text, cost: cost, time: time }; }
    function B(core0, core1, weekly) { return { core: [core0, core1], weekly: weekly }; }
    if (c.indexOf('uncollateralized') >= 0 || c === 'lending') return B(
      S("Supply $" + capital + " of USDC to " + n + "'s main market on " + ch + " and leave it supplied; lending positions are the activity a launch snapshot almost always counts.", "$" + capital + " of capital and " + gas.oneTx, '15 minutes to set up'),
      S("Borrow $" + borrow + " of USDC against the supply, hold the borrow open for 7 days, then repay it in full, so the wallet shows both sides of the market.", gas.oneTx + " twice, and a few cents of interest", '10 minutes, plus 7 days with the borrow open'),
      S("Roll the position once a week: repay and redraw a small borrow, or add and withdraw $" + borrow + " of supply, so every weekly snapshot shows the wallet active.", gas.weekly, '10 minutes a week'));
    if (c.indexOf('cdp') >= 0 || c.indexOf('stablecoin') >= 0 || c.indexOf('algo-stables') >= 0) return B(
      S("Open a " + n + " vault on " + ch + " with $" + capital + " of collateral (ETH or a major stablecoin) and mint its stablecoin against it, keeping the collateral ratio above 200%.", "$" + capital + " of collateral and " + gas.oneTx, '20 minutes to set up'),
      S("Deposit the minted stablecoin into " + n + "'s own stability or savings pool, so the wallet earns on both the vault and the stablecoin it issued.", gas.oneTx, '10 minutes'),
      S("Check the vault's collateral ratio once a week and top the collateral up if it drifts toward 180%; an unhealthy vault is liquidated and the farm is lost with it.", gas.weekly, '10 minutes a week'));
    if (c.indexOf('dex') >= 0) return B(
      S("Provide $" + capital + " of liquidity to " + n + "'s busiest pool on " + ch + ", split evenly between the pair's two assets, and keep the LP position open.", "$" + capital + " of capital and " + gas.oneTx, '15 minutes to set up'),
      S("Route five swaps of about $" + borrow + " each through " + n + " across the first week, in both directions; consistent volume from one wallet is what DEX points programs measure.", gas.oneTx + " per swap", '5 minutes per swap'),
      S("Make one swap and rebalance the LP range once a week, so the wallet keeps trading volume without churning the whole position.", gas.weekly, '10 minutes a week'));
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('staking pool') >= 0 || c.indexOf('staking') >= 0) return B(
      S("Stake $" + capital + " of the chain's native asset through " + n + " on " + ch + " and keep the liquid staking receipt token in the same wallet; the receipt is the position a snapshot sees.", "$" + capital + " of capital and " + gas.oneTx, '10 minutes to set up'),
      S("Put half of the receipt tokens (about $" + half + " worth) to work in a lending market or pool that accepts them, stacking a second position on the same stake.", gas.oneTx, '15 minutes'),
      S("Add a small top-up stake of about $" + borrow + " once a week, so the staked balance grows steadily instead of appearing in a single burst.", gas.weekly, '10 minutes a week'));
    if (c.indexOf('restak') >= 0 || c.indexOf('anchor btc') >= 0 || c.indexOf('decentralized btc') >= 0) return B(
      S("Deposit $" + capital + " of BTC or a liquid staking token into " + n + " on " + ch + " and hold the restaked receipt; restaking points accrue to the wallet that holds it.", "$" + capital + " of capital and " + gas.oneTx, '20 minutes to set up'),
      S("Register the deposit on " + n + "'s points page and link this wallet there; unregistered deposits are the most common way restaking farms are lost.", 'nothing to register', '10 minutes'),
      S("Check the points balance once a week and make one small extra deposit of about $" + borrow + " a month, so the position reads as an ongoing commitment.", gas.weekly, '10 minutes a week'));
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('collateral') >= 0) return B(
      S("Deposit $" + capital + " of USDC into a " + n + " curated vault on " + ch + "; curator vaults are exactly the balances a curator's own token launch would reward.", "$" + capital + " of capital and " + gas.oneTx, '15 minutes to set up'),
      S("Split a second $" + half + " into a different vault from the same curator, so the wallet is exposed to two of its strategies rather than one.", gas.oneTx, '10 minutes'),
      S("Review the two vaults' allocations once a week and move the smaller one if its underlying markets change; following the curator's published changes is visible activity.", gas.weekly, '15 minutes a week'));
    if (c.indexOf('rwa') >= 0) return B(
      S("Complete " + n + "'s eligibility and KYC check first, then subscribe $" + capital + " to its tokenized treasury or credit product on " + ch + "; for RWA the verified account, not just the wallet, is what a launch can reward.", "$" + capital + " of capital, and no fee for the check itself", '30 minutes including verification'),
      S("Hold the yield-bearing token in the same wallet and note its redemption windows in the farm log; RWA positions settle on the issuer's schedule, not instantly.", 'nothing while holding', '5 minutes to note the dates'),
      S("Reinvest the yield once a month, or add about $" + borrow + " when a new issuance opens, so the account shows recurring participation.", gas.weekly, '10 minutes when you act'));
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('options') >= 0 || c.indexOf('synthetics') >= 0) return B(
      S("Deposit $" + capital + " of USDC as margin on " + n + " and open one small hedged position (no more than 10% of the margin at risk), so the account trades without betting the farm on direction.", "$" + capital + " of margin and " + gas.oneTx, '20 minutes to set up'),
      S("Place one small trade a week for four weeks, each under 10% of margin, closing each before the next; a steady record of real trades is what derivatives points programs count.", gas.oneTx + " per trade, plus trading fees", '10 minutes per trade'),
      S("Review open positions and margin once a week and withdraw any profit above the starting margin, so a liquidation can never take the whole farm.", gas.weekly, '10 minutes a week'));
    if (c.indexOf('basis') >= 0) return B(
      S("Commit $" + capital + " of USDC to " + n + "'s basis strategy on " + ch + ": the vault runs the delta-neutral pair (long spot, short perpetual) and the wallet holds the strategy shares.", "$" + capital + " of capital and " + gas.oneTx, '15 minutes to set up'),
      S("Keep a further $" + half + " of USDC idle in the same wallet as a margin buffer; basis strategies draw on it in volatile weeks, and an under-buffered position is the usual way this farm fails.", "$" + half + " held back, unspent", 'no time, it just sits there'),
      S("Check the strategy's funding-rate earnings once a week and compound the payout into the position monthly.", gas.weekly, '10 minutes a week'));
    if (c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('leveraged') >= 0) return B(
      S("Deposit $" + capital + " of USDC or the chain's main stablecoin into " + n + "'s flagship vault on " + ch + " and keep the vault shares in this wallet.", "$" + capital + " of capital and " + gas.oneTx, '15 minutes to set up'),
      S("When the first rewards land, claim them and re-deposit them into the same vault; a compounding wallet shows the protocol real, retained usage.", gas.oneTx, '10 minutes, once rewards appear'),
      S("Make one deposit or withdrawal of about $" + borrow + " once a week, so the vault balance moves in a pattern no snapshot can mistake for a parked one-off.", gas.weekly, '10 minutes a week'));
    if (c === 'chain') return B(
      S("Bridge $" + capital + " of USDC to " + n + " and make the wallet's first transactions there: one DEX swap and one lending deposit in its native apps, so the wallet exists on the chain before any snapshot of it.", "$" + capital + " of capital and about $5 of bridge and gas fees", '30 minutes to set up'),
      S("Hold a small balance of " + n + "'s gas asset and pay fees with it weekly; chains reward the wallets that actually transact on them.", gas.oneTx, '5 minutes'),
      S("Transact on " + n + " once a week (a swap, a transfer between your own wallets, a small stake), keeping a streak of active weeks.", gas.weekly, '10 minutes a week'));
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0) return B(
      S("Open a " + n + " account, finish its KYC, and activate the payment account or card; for payment products the verified, active account is the farm.", 'no fee to open; a card may carry a small issue fee', '25 minutes including verification'),
      S("Route about $" + capital + " of ordinary spending or transfers through " + n + " across the first month, in several separate payments rather than one lump.", "$" + capital + " of your own spending, not extra cost", 'a few minutes per payment'),
      S("Make at least one payment a week through " + n + ", so the account reads as a real user's, which is what launch allocations for payment apps measure.", 'nothing beyond the payment itself', '5 minutes a week'));
    if (c.indexOf('prediction') >= 0) return B(
      S("Fund the wallet with $" + capital + " of USDC and take one position in a liquid " + n + " market you can explain; prediction markets reward accounts with a settled history.", "$" + capital + " of capital and " + gas.oneTx, '15 minutes to set up'),
      S("Let the first position settle, then take a second position in a different market category, so the account shows breadth rather than one bet.", gas.oneTx, '10 minutes, after the first settles'),
      S("Place or adjust one small position a week, keeping total exposure under the starting $" + capital + ".", gas.weekly, '10 minutes a week'));
    if (c.indexOf('insurance') >= 0) return B(
      S("Buy about $" + capital + " of cover from " + n + " on " + ch + " against a major protocol you actually use, for a 90-day term; cover buyers are the customers an insurance token launch rewards first.", "$" + capital + " of cover, priced as a premium of a few per cent", '20 minutes to set up'),
      S("If " + n + " offers an underwriting pool, stake $" + half + " into it as well, and note that this half carries real loss risk if a claim pays out.", "$" + half + " staked and " + gas.oneTx, '15 minutes'),
      S("Check the cover is still in force once a month and renew it before it lapses, so there is no gap in the record.", gas.weekly, '10 minutes a month'));
    if (c.indexOf('governance') >= 0) return B(
      S("Deposit $" + capital + " into the " + n + " market its incentive program currently rewards on " + ch + "; the program page names the market, and farming the wrong one earns nothing.", "$" + capital + " of capital and " + gas.oneTx, '15 minutes to set up'),
      S("Vote on one live governance proposal, or delegate your vote to an active delegate, in the first epoch; incentive programs increasingly weight voters over passive deposits.", gas.oneTx, '10 minutes'),
      S("Claim the week's incentives and re-deposit them, and vote in any new proposal, so both the balance and the voting record keep growing.", gas.weekly, '15 minutes a week'));
    if (c.indexOf('index') >= 0) return B(
      S("Buy $" + capital + " of " + n + "'s index token on " + ch + " and hold it in this wallet; index holders are the natural recipients of an index protocol's own launch.", "$" + capital + " of capital and " + gas.oneTx, '10 minutes to set up'),
      S("Provide about $" + half + " of liquidity for the index token's main pool, so the wallet also appears on the market-making side of the product.", "$" + half + " of capital and " + gas.oneTx, '15 minutes'),
      S("Rebalance once a month: add about $" + borrow + " or trim back to the starting weight, keeping the position deliberate rather than forgotten.", gas.weekly, '10 minutes a month'));
    if (c.indexOf('launchpad') >= 0) return B(
      S("Register this wallet for one open " + n + " sale and complete its stated requirements (usually holding or staking its platform asset) before the sale's snapshot date.", "$" + capital + " held or staked to qualify", '20 minutes to register'),
      S("Commit about $" + half + " to the sale itself if the allocation lands, and keep the rest for the next one; launchpad allocations reward accounts with a history of taking part.", "$" + half + " if allocated", '10 minutes'),
      S("Check " + n + " for new sales once a week and register early; most sales snapshot their participants days before they open.", 'nothing to check', '5 minutes a week'));
    if (c.indexOf('cedefi') >= 0 || c.indexOf('cex') >= 0) return B(
      S("Deposit $" + capital + " into a " + n + " earn product and keep the deposit receipts and statements; CeDeFi positions live on the platform's books, so your records are the proof of the farm.", "$" + capital + " of capital and no gas (off-chain)", '15 minutes to set up'),
      S("Turn on the product's auto-compound or loyalty setting if it offers one, so the balance grows without weekly transactions the platform cannot see anyway.", 'nothing', '5 minutes'),
      S("Log in once a week, check the balance and rate, and save a screenshot or statement line into the farm log.", 'nothing', '5 minutes a week'));
    return B(
      S("Deposit $" + capital + " of USDC into " + n + " on " + ch + " and complete its core action once (a deposit, a stake or a mint, whichever its app leads with), so the wallet is a real user of the product.", "$" + capital + " of capital and " + gas.oneTx, '15 minutes to set up'),
      S("Repeat the core action a second time in a later week with about $" + half + ", so the wallet shows a history of use rather than a single touch on one day.", "$" + half + " of capital and " + gas.oneTx, '10 minutes'),
      S("Make one qualifying action each week in " + n + "'s app, such as a deposit, a claim or a vote, so every weekly snapshot counts the wallet as active.", gas.weekly, '10 minutes a week'));
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p), gas = gasFor(chain), capital = capitalFor(p), hold = holdDaysFor(p.age_days);
    var book = playbookFor(p, capital, gas);
    var steps = [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm with, and keep its seed phrase offline; fund it on ' + chain + ' before you start.', cost: gas.setup, time: '10 minutes' },
      book.core[0], book.core[1]
    ];
    if (p.chains.length >= 3) {
      var second = p.chains[1], half = Math.max(25, Math.round(capital / 2 / 5) * 5);
      steps.push({ text: "Repeat the core position on " + second + ", one of " + p.name + "'s other markets, with about $" + half + "; a wallet active on several of the protocol's chains is worth more to a launch than the same funds on one.", cost: "$" + half + " of capital and " + gasFor(second).oneTx, time: '15 minutes' });
    }
    steps.push(book.weekly);
    steps.push({ text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot; most launches weight wallets by how long they stayed, not just that they came.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' });
    steps.push({ text: "Before you withdraw anything, open " + p.name + "'s own points or rewards page and claim only from the link it publishes; never pay a fee or sign a claim on a site that merely looks like it.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' });
    steps.push({ text: 'Write the wallet, the dates and every transaction in a farm log, so you can repeat the position next season or unwind it without hunting through explorers.', cost: 'nothing but the log', time: '5 minutes' });
    return steps.map(stepText);
  }

  // ---- state in the hash, so every view (and every screenshot) is a URL ----
  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function chainsText(r, max) {
    if (!r.chains || !r.chains.length) return 'an unnamed chain';
    var shown = r.chains.slice(0, max || 2).join(', ');
    return r.chains.length > (max || 2) ? shown + ' +' + (r.chains.length - (max || 2)) : shown;
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }),
        el('span', { class: 'brand-name' }, 'Token ', el('em', { text: 'Radar' }))),
      el('div', { class: 'top-meta' },
        el('span', { class: 'chip' }, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', { class: 'chip' }, 'Model ', el('b', { text: DATA.model_version })),
        el('span', { class: 'chip' }, el('b', { text: String(DATA.board_size) }), ' protocols ranked'))
    );
  }

  function hero() {
    var kids = [
      el('h1', null, 'Pre-token protocols, ranked by ', el('span', { class: 'hl', text: 'what their launch could be worth' })),
      el('p', { class: 'lede', text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record, all ' + DATA.watchlist_size + ' of them. Below it, the early radar adds ' + DATA.early_size + ' smaller pre-token protocols by TVL. Each one is priced by the protocols in its own category that already trade — never by a hand-picked number.' }),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('small', { text: 'every $' + Math.round(DATA.floor_usd / 1e6) + 'M+ pre-token protocol' })),
        el('div', { class: 'stat' }, el('span', { text: 'Rows on the board' }), el('b', { text: String(DATA.board_size) }), el('small', { text: 'watchlist plus early radar' })),
        el('div', { class: 'stat' }, el('span', { text: 'Market-wide ratio' }), el('b', { text: fmtX(MS.global_ratio) }), el('small', { text: 'median mcap/TVL of ' + MS.live_ratios_used + ' live protocols' })),
        el('div', { class: 'stat' }, el('span', { text: 'Live tokens set aside' }), el('b', { text: String(DATA.live_size) }), el('small', { text: 'already trade; shown, never ranked' })))
    ];
    if (state.tab === 'pre-token' && !state.q && state.category === 'all') {
      kids.push(el('div', { class: 'podium' }, DATA.rows.slice(0, 3).map(function (r, i) {
        return el('button', { class: 'pod r' + (i + 1), type: 'button', onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'rk' }, el('span', { text: 'Rank ' + r.rank }), el('b', { text: ['No. 1', 'No. 2', 'No. 3'][i] })),
          el('h3', { text: r.name }),
          el('span', { class: 'cat', text: (r.category || 'Other') + ' · ' + chainsText(r, 3) }),
          el('div', { class: 'val', text: fmtUsd(r.implied_value_usd) }),
          el('div', { class: 'meta', text: 'TVL ' + fmtUsd(r.tvl_usd) + ' · 7d ' + fmtPct(r.change_7d) + ' · ratio ' + fmtX(r.category_ratio) }));
      })));
    }
    return el('section', { class: 'hero' }, kids);
  }

  function method() {
    var boardCats = {};
    DATA.rows.forEach(function (r) { if (r.category) boardCats[r.category] = 1; });
    var stats = MS.categories.filter(function (s) { return s.category && boardCats[s.category]; })
      .sort(function (a, b) { return b.peers - a.peers; }).slice(0, 14);
    return el('section', { class: 'method' },
      el('h2', { text: 'How this radar values a launch' }),
      el('p', { class: 'sub', text: 'One function scores every row from the snapshot figures alone. Open any protocol to see its own factors.' }),
      el('div', { class: 'cols' },
        el('div', null, el('h4', { text: '1 · Priced by its category' }),
          el('p', { text: 'Protocols that already trade are the comparables. Within each category, the trimmed median of their market cap ÷ TVL says what the market pays for a dollar of TVL there. A thin category is shrunk toward the market-wide ' + fmtX(MS.global_ratio) + ' (from ' + MS.live_ratios_used + ' live protocols), so two peers cannot set a price on their own.' })),
        el('div', null, el('h4', { text: '2 · Adjusted for momentum' }),
          el('p', { text: 'Seven-day TVL growth moves the value with weight ' + M.growth_weight + ', clamped to ' + M.growth_floor + '%…+' + M.growth_cap + '% so one wild week cannot dominate. A protocol present on more chains earns +' + (M.chain_step * 100) + '% per extra chain, up to ' + M.chain_extra_cap + ' extra.' })),
        el('div', null, el('h4', { text: '3 · Adjusted for time tokenless' }),
          el('p', { text: 'The longer a protocol has run with no token, the more a launch is worth: the age multiplier runs ' + fmtX(M.age_min_multiplier) + ' at listing to ' + fmtX(M.age_max_multiplier) + ' at ' + M.age_days_cap.toLocaleString('en-US') + ' days. No listing date scores as ' + M.unknown_age_days + ' days. Live-token protocols are set aside with their real market caps, never ranked by the model.' }))),
      el('div', { class: 'formula', text: 'implied value  =  TVL  x  category ratio  x  growth multiplier  x  age multiplier  x  chain multiplier' }),
      el('div', { class: 'ratios' }, stats.map(function (s) {
        return el('span', null, s.category + ' ', el('b', { text: fmtX(s.ratio) }), ' · ' + s.peers + ' peers');
      })));
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); }));
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('span', { class: 'lab', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' of ' + DATA.board_size + ' rows shown' : DATA.live.length + ' live-token protocols' }));
  }

  function sortHeader(key, label, numeric) {
    return el('th', { scope: 'col', class: numeric ? 'num' : null },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label, state.sort === key ? el('span', { class: 'arr', 'aria-hidden': 'true', text: state.dir < 0 ? ' ▾' : ' ▴' }) : null));
  }

  function boardTable() {
    var filtered = rows();
    var list = sortedRows(filtered);
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { class: 'sub', text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; writeHash(); render(); } })));
    }
    var max = 1;
    filtered.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    var tbody = el('tbody');
    list.forEach(function (r) {
      var tr = el('tr', {
        class: r.rank <= 3 ? 'r' + r.rank : null,
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'rank' }, el('span', { class: 'rankbadge', text: String(r.rank) })),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + chainsText(r) }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }))),
        el('td', null, el('span', { class: 'status', text: 'no token' })));
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'), sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL', true), sortHeader('growth', '7d', true), sortHeader('age', 'Age', true),
            sortHeader('implied', 'Implied value', true), el('th', { scope: 'col', text: 'Token' }))),
          tbody)));
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', { style: 'cursor:default' },
        el('td', { class: 'rank', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + chainsText(r) }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: '—' }),
        el('td', null, el('div', { class: 'implied' }, el('span', { class: 'num', text: fmtUsd(r.mcap_usd) }))),
        el('td', null, el('span', { class: 'status live', text: 'trades' }))));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Live tokens: these protocols already trade, so the figure shown is their market cap — a fact, not a model. They are the comparables behind the category ratios, and they are never ranked.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', class: 'num', text: 'TVL' }), el('th', { scope: 'col', class: 'num', text: '7d' }),
            el('th', { scope: 'col', class: 'num', text: 'Age' }), el('th', { scope: 'col', class: 'num', text: 'Market cap' }),
            el('th', { scope: 'col', text: 'Token' }))),
          tbody)));
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); render(); });

  function factorRow(k, v, why) {
    return el('tr', null, el('td', { class: 'k', text: k }), el('td', { class: 'v', text: v }), el('td', { class: 'why', text: why }));
  }

  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    var stat = catStat(row.category);
    var growthClamped = Math.min(M.growth_cap, Math.max(M.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var ratioWhy = stat && stat.peers > 0
      ? (row.category || 'Other') + ': ' + (stat.peers === 1
          ? 'its only live peer trades at ' + fmtX(stat.median_ratio) + ' of TVL, shrunk hard toward the market-wide ' + fmtX(MS.global_ratio)
          : stat.peers + ' live peers trade at a median ' + fmtX(stat.median_ratio) + ' of TVL, shrunk toward the market-wide ' + fmtX(MS.global_ratio))
      : 'no live peers in this category: the market-wide ratio applies';
    var ageWhy = row.age_days === null
      ? 'no listing date on record: scored as ' + M.unknown_age_days + ' days. The multiplier runs ' + fmtX(M.age_min_multiplier) + ' to ' + fmtX(M.age_max_multiplier) + ' over ' + M.age_days_cap + ' days'
      : 'tokenless since ' + (row.listed_at || 'its listing') + '. The multiplier runs ' + fmtX(M.age_min_multiplier) + ' to ' + fmtX(M.age_max_multiplier) + ' over ' + M.age_days_cap + ' days';
    var steps = farmSteps(row);
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-in' },
      el('div', { class: 'detail-head' },
        el('div', null,
          el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' · ' + (row.category || 'Other') }),
          el('h2', { id: 'detail-title', text: row.name }),
          el('span', { class: 'sub', text: chainsText(row, 99) })),
        el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })),
      el('div', { class: 'bigval', text: fmtUsd(row.implied_value_usd) }),
      el('p', { class: 'sub', text: 'Implied launch value under model ' + DATA.model_version + ' — an estimate from the snapshot, not a price.' }),
      el('section', { class: 'detail-section' },
        el('h3', { text: 'Why this value: the model breakdown' }),
        el('table', { class: 'factors' },
          factorRow('TVL', usdFull.format(row.tvl_usd), 'total value locked in the ' + DATA.as_of + ' snapshot'),
          factorRow('Category ratio', fmtX(row.category_ratio), ratioWhy),
          factorRow('Growth, 7d', fmtPct(row.change_7d) + ' → ' + fmtX(row.growth_multiplier), 'TVL change clamped to ' + M.growth_floor + '%…+' + M.growth_cap + '%, weighted x' + M.growth_weight + (growthClamped !== (row.change_7d || 0) ? ' (clamped from ' + fmtPct(row.change_7d) + ')' : '')),
          factorRow('Age tokenless', fmtAge(row.age_days) + ' → ' + fmtX(row.age_multiplier), ageWhy),
          factorRow('Chains', (row.chains ? row.chains.length : 0) + ' → ' + fmtX(row.chain_multiplier), '+' + (M.chain_step * 100) + '% per chain past the first, capped at ' + M.chain_extra_cap + ' extra'),
          el('tr', { class: 'total' },
            el('td', { class: 'k', text: 'Implied value' }),
            el('td', { class: 'v', text: fmtUsd(row.implied_value_usd) }),
            el('td', { class: 'why', text: 'recomputed from the rounded factors above: ≈ ' + fmtUsd(recompute(row)) })))),
      el('section', { class: 'detail-section' },
        el('h3', { text: 'Farm plan' }),
        el('p', { class: 'sub', text: 'If this protocol launches a token, these are the actions that put a wallet in line for it — derived from its category, chains, TVL and age.' }),
        el('ol', { class: 'steps' }, steps.map(function (s) {
          var at = s.indexOf(' Cost: ');
          var action = at >= 0 ? s.slice(0, at) : s;
          var tail = at >= 0 ? s.slice(at + 1) : '';
          return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
        })))));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(hero());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(method());
    shell.appendChild(el('p', { class: 'foot', text: 'Token Radar · model ' + DATA.model_version + ' · built from the sealed snapshot of ' + DATA.as_of + ' (' + DATA.source + '). Implied values are model estimates, not prices or advice.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
