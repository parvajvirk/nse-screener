require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const TOKEN = () => process.env.UPSTOX_ACCESS_TOKEN || '';
const BASE = 'https://api.upstox.com/v2';
const SL_BUFFER = 5;

// ── Upstox API helper
async function upGet(path) {
  const res = await axios.get(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN()}`, Accept: 'application/json' }
  });
  return res.data;
}

// ── IST date helpers
function getIST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}
function istDateStr(offsetDays = 0) {
  const d = getIST();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Market hours
function isMarketOpen() {
  const ist = getIST();
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 9*60+15 && mins <= 15*60+30;
}

// ── Nifty 50 stocks: symbol -> ISIN instrument key
const NIFTY50 = {
  'RELIANCE':   'NSE_EQ|INE002A01018',
  'TCS':        'NSE_EQ|INE467B01029',
  'HDFCBANK':   'NSE_EQ|INE040A01034',
  'BHARTIARTL': 'NSE_EQ|INE397D01024',
  'ICICIBANK':  'NSE_EQ|INE090A01021',
  'INFOSYS':    'NSE_EQ|INE009A01021',
  'SBIN':       'NSE_EQ|INE062A01020',
  'HINDUNILVR': 'NSE_EQ|INE030A01027',
  'ITC':        'NSE_EQ|INE154A01025',
  'KOTAKBANK':  'NSE_EQ|INE237A01028',
  'LT':         'NSE_EQ|INE018A01030',
  'AXISBANK':   'NSE_EQ|INE238A01034',
  'BAJFINANCE': 'NSE_EQ|INE296A01024',
  'MARUTI':     'NSE_EQ|INE585B01010',
  'HCLTECH':    'NSE_EQ|INE860A01027',
  'SUNPHARMA':  'NSE_EQ|INE044A01036',
  'TITAN':      'NSE_EQ|INE280A01028',
  'ADANIPORTS': 'NSE_EQ|INE742F01042',
  'WIPRO':      'NSE_EQ|INE075A01022',
  'NTPC':       'NSE_EQ|INE733E01010',
  'TATAMOTORS': 'NSE_EQ|INE155A01022',
  'ONGC':       'NSE_EQ|INE213A01029',
  'TATASTEEL':  'NSE_EQ|INE081A01020',
  'POWERGRID':  'NSE_EQ|INE752E01010',
  'ULTRACEMCO': 'NSE_EQ|INE481G01011',
  'M&M':        'NSE_EQ|INE101A01026',
  'BAJAJ-AUTO': 'NSE_EQ|INE917I01010',
  'NESTLEIND':  'NSE_EQ|INE239A01024',
  'GRASIM':     'NSE_EQ|INE047A01021',
  'JSWSTEEL':   'NSE_EQ|INE019A01038',
  'ASIANPAINT': 'NSE_EQ|INE021A01026',
  'ADANIENT':   'NSE_EQ|INE423A01024',
  'DIVISLAB':   'NSE_EQ|INE361B01024',
  'BRITANNIA':  'NSE_EQ|INE216A01030',
  'CIPLA':      'NSE_EQ|INE059A01026',
  'EICHERMOT':  'NSE_EQ|INE066A01021',
  'DRREDDY':    'NSE_EQ|INE089A01023',
  'APOLLOHOSP': 'NSE_EQ|INE437A01024',
  'BAJAJFINSV': 'NSE_EQ|INE918I01026',
  'HEROMOTOCO': 'NSE_EQ|INE158A01026',
  'HINDALCO':   'NSE_EQ|INE038A01020',
  'INDUSINDBK': 'NSE_EQ|INE095A01012',
  'COALINDIA':  'NSE_EQ|INE522F01014',
  'BPCL':       'NSE_EQ|INE029A01011',
  'HDFCLIFE':   'NSE_EQ|INE795G01014',
  'BEL':        'NSE_EQ|INE263A01024',
  'TECHM':      'NSE_EQ|INE669C01036',
  'LTIM':       'NSE_EQ|INE214T01019',
  'TRENT':      'NSE_EQ|INE849A01020',
  'SHRIRAMFIN': 'NSE_EQ|INE721A01013',
};

// ── Cache for all NSE instruments
let allNSECache = [];
async function getAllNSE() {
  if (allNSECache.length > 0) return allNSECache;
  try {
    const zlib = require('zlib');
    const res = await axios.get('https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz', { responseType: 'arraybuffer' });
    const data = JSON.parse(zlib.gunzipSync(Buffer.from(res.data)).toString());
    allNSECache = data.filter(i => i.segment === 'NSE_EQ' && i.instrument_type === 'EQ');
    console.log(`Loaded ${allNSECache.length} NSE instruments`);
  } catch(e) {
    console.error('Failed to load NSE instruments:', e.message);
  }
  return allNSECache;
}

// ── Fetch Nifty 50 trend
async function fetchNiftyTrend() {
  try {
    const key = encodeURIComponent('NSE_INDEX|Nifty 50');
    const data = await upGet(`/market-quote/quotes?instrument_key=${key}`);
    const q = data.data?.['NSE_INDEX:Nifty 50'];
    if (!q) return null;
    const ltp = q.last_price;
    const prevClose = q.ohlc?.close || ltp;
    const chgPct = prevClose > 0 ? +((ltp - prevClose) / prevClose * 100).toFixed(2) : 0;
    return { ltp: +ltp.toFixed(2), prevClose: +prevClose.toFixed(2), chgPct, isUp: chgPct >= 0 };
  } catch(e) {
    console.error('Nifty trend error:', e.message);
    return null;
  }
}

// ── Fetch PDH/PDL
async function fetchPDHL(instrKey) {
  try {
    const toDate = istDateStr(0);
    const fromDate = istDateStr(-7);
    const key = encodeURIComponent(instrKey);
    const data = await upGet(`/historical-candle/${key}/day/${toDate}/${fromDate}`);
    const candles = data.data?.candles;
    if (!candles || candles.length < 1) return null;
    // Find most recent candle before today
    let prev = null;
    for (const c of candles) {
      if (c[0].substring(0,10) < toDate) { prev = c; break; }
    }
    if (!prev) prev = candles[0];
    return { pdh: prev[2], pdl: prev[3] };
  } catch(e) {
    return null;
  }
}

// ── Fetch intraday signals (3-min candles built from 1-min)
async function fetchSignals(instrKey, pdh, pdl) {
  const empty = { sweepBuy:false, sweepSell:false, breakBuy:false, breakSell:false };
  try {
    const key = encodeURIComponent(instrKey);
    let candles = null;
    // Try live intraday first
    try {
      const d = await upGet(`/historical-candle/intraday/${key}/1minute`);
      if (d.data?.candles?.length >= 3) candles = d.data.candles;
    } catch(e) {}
    // Fallback to last trading day
    if (!candles) {
      try {
        const date = istDateStr(0);
        const d = await upGet(`/historical-candle/${key}/1minute/${date}/${date}`);
        if (d.data?.candles?.length >= 3) candles = d.data.candles;
      } catch(e) {}
    }
    if (!candles) return empty;
    const raw = [...candles].reverse();
    let sweepBuy=false, sweepSell=false, breakBuy=false, breakSell=false;
    for (let i = 0; i < raw.length - 2; i += 3) {
      const chunk = raw.slice(i, i+3);
      const open = chunk[0][1];
      const high = Math.max(...chunk.map(c => c[2]));
      const low  = Math.min(...chunk.map(c => c[3]));
      const close = chunk[chunk.length-1][4];
      if (low < pdl && close > pdl && close < pdh) sweepBuy = true;
      if (high > pdh && close < pdh && close > pdl) sweepSell = true;
      if (open < pdl && close > pdl && close < pdh) breakBuy = true;
      if (open > pdh && close < pdh && close > pdl) breakSell = true;
    }
    return { sweepBuy, sweepSell, breakBuy, breakSell };
  } catch(e) { return empty; }
}

// ── Main fetch for Nifty50 (full data with signals)
async function fetchNifty50() {
  const instrKeys = Object.values(NIFTY50);
  const symbolByKey = {};
  for (const [sym, key] of Object.entries(NIFTY50)) symbolByKey[key] = sym;

  // Fetch quotes in batches of 10
  const allQuotes = {};
  for (let i = 0; i < instrKeys.length; i += 10) {
    const batch = instrKeys.slice(i, i+10).join(',');
    try {
      const d = await upGet(`/market-quote/quotes?instrument_key=${encodeURIComponent(batch)}`);
      if (d.data) Object.assign(allQuotes, d.data);
    } catch(e) { console.error('Quote batch error:', e.message); }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log(`Nifty50 quotes: ${Object.keys(allQuotes).length}`);

  // Build base stocks from quotes
  const baseStocks = [];
  for (const [symbol, instrKey] of Object.entries(NIFTY50)) {
    // Upstox returns key as NSE_EQ:SYMBOL
    const q = allQuotes[`NSE_EQ:${symbol}`] 
              || allQuotes[instrKey.replace('|',':')] 
              || Object.values(allQuotes).find(v => v.symbol === symbol || v.instrument_token === instrKey);
    if (!q) { console.log(`Missing quote for ${symbol}`); continue; }
    const ltp = q.last_price;
    const netChg = q.net_change || 0;
    const prevClose = netChg !== 0 ? ltp - netChg : (q.ohlc?.close || ltp);
    const chgPct = prevClose > 0 ? +((netChg / prevClose) * 100).toFixed(2) : 0;
    const open = q.ohlc?.open || ltp;
    const gapPct = prevClose > 0 ? +((open - prevClose) / prevClose * 100).toFixed(2) : 0;
    baseStocks.push({ instrKey, symbol, ltp, chgPct, prevClose, open, gapPct });
  }

  // Fetch PDH/PDL in parallel batches of 5
  const stocks = [];
  for (let i = 0; i < baseStocks.length; i += 10) {
    const batch = baseStocks.slice(i, i+10);
    const results = await Promise.allSettled(batch.map(async s => {
      const pdhl = await fetchPDHL(s.instrKey);
      if (!pdhl) return null;
      const { pdh, pdl } = pdhl;
      return {
        symbol: s.symbol, ltp: +s.ltp.toFixed(2), chgPct: s.chgPct,
        open: +s.open.toFixed(2), prevClose: +s.prevClose.toFixed(2), gapPct: s.gapPct,
        pdh: +pdh.toFixed(2), pdl: +pdl.toFixed(2),
        distPdh: +Math.abs((s.ltp-pdh)/pdh*100).toFixed(2),
        distPdl: +Math.abs((s.ltp-pdl)/pdl*100).toFixed(2),
        sweepBuy:false, sweepSell:false, breakBuy:false, breakSell:false,
        slBuy:0, slSell:0, target12Buy:0, target12Sell:0,
        achieve12Buy:false, achieve12Sell:false,
      };
    }));
    results.forEach(r => { if (r.status === 'fulfilled' && r.value) stocks.push(r.value); });
    if (i + 10 < baseStocks.length) await new Promise(r => setTimeout(r, 150));
  }
  console.log(`Nifty50 final: ${stocks.length} stocks`);
  return stocks;
}

// ── Fetch ALL NSE (quotes only, fast)
async function fetchAllNSE() {
  const instruments = await getAllNSE();
  if (!instruments.length) return [];
  
  const allQuotes = {};
  const BATCH = 50;
  for (let i = 0; i < instruments.length; i += BATCH) {
    const batch = instruments.slice(i, i+BATCH).map(x => x.instrument_key).join(',');
    try {
      const d = await upGet(`/market-quote/quotes?instrument_key=${encodeURIComponent(batch)}`);
      if (d.data) Object.assign(allQuotes, d.data);
    } catch(e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`ALL NSE quotes: ${Object.keys(allQuotes).length}`);

  return Object.values(allQuotes).map(q => {
    const ltp = q.last_price || 0;
    const netChg = q.net_change || 0;
    const prevClose = netChg !== 0 ? ltp - netChg : (q.ohlc?.close || ltp);
    const chgPct = prevClose > 0 ? +((netChg / prevClose) * 100).toFixed(2) : 0;
    const open = q.ohlc?.open || ltp;
    const gapPct = prevClose > 0 ? +((open - prevClose) / prevClose * 100).toFixed(2) : 0;
    return { symbol: q.symbol, ltp: +ltp.toFixed(2), chgPct, open: +open.toFixed(2), prevClose: +prevClose.toFixed(2), gapPct, pdh:0, pdl:0, distPdh:0, distPdl:0, sweepBuy:false, sweepSell:false, breakBuy:false, breakSell:false, slBuy:0, slSell:0, target12Buy:0, target12Sell:0, achieve12Buy:false, achieve12Sell:false };
  }).filter(s => s.ltp > 0);
}

// ── Cache
let cache = { nifty50: [], allNSE: [], niftyTrend: null, lastUpdated: null };

async function refreshNifty50() {
  console.log('Refreshing Nifty50...');
  try {
    const [stocks, trend] = await Promise.all([fetchNifty50(), fetchNiftyTrend()]);
    cache.nifty50 = stocks;
    cache.niftyTrend = trend;
    cache.lastUpdated = new Date().toISOString();
    console.log(`Cache updated: ${stocks.length} stocks`);
  } catch(e) { console.error('Refresh error:', e.message); }
}

// ── API Routes
app.get('/api/stocks', async (req, res) => {
  try {
    const index = req.query.index || 'NIFTY50';
    if (index === 'ALL') {
      const stocks = await fetchAllNSE();
      const trend = cache.niftyTrend || await fetchNiftyTrend();
      return res.json({ stocks, niftyTrend: trend, lastUpdated: new Date().toISOString() });
    }
    if (!cache.lastUpdated) await refreshNifty50();
    // Support combined indices e.g. "NIFTY50,NIFTYNEXT50"
    const indices = index.split(',');
    let stocks = cache.nifty50;
    if (indices.length > 1 || !indices.includes('NIFTY50')) {
      // For now return nifty50 as base - full multi-index support coming
      stocks = cache.nifty50;
    }
    res.json({ stocks, niftyTrend: cache.niftyTrend, lastUpdated: cache.lastUpdated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/refresh-and-get', async (req, res) => {
  try {
    const index = req.query.index || 'NIFTY50';
    if (index === 'ALL') {
      const stocks = await fetchAllNSE();
      const trend = await fetchNiftyTrend();
      return res.json({ stocks, niftyTrend: trend, lastUpdated: new Date().toISOString() });
    }
    await refreshNifty50();
    res.json({ stocks: cache.nifty50, niftyTrend: cache.niftyTrend, lastUpdated: cache.lastUpdated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/token', (req, res) => {
  const { token } = req.body;
  if (token) process.env.UPSTOX_ACCESS_TOKEN = token;
  res.json({ success: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', marketOpen: isMarketOpen(), stocks: cache.nifty50.length, lastUpdated: cache.lastUpdated });
});

app.get('/api/debug', async (req, res) => {
  try {
    const keys = Object.values(NIFTY50).join(',');
    const d = await upGet(`/market-quote/quotes?instrument_key=${encodeURIComponent(Object.values(NIFTY50).slice(0,10).join(','))}`);
    const returned = Object.keys(d.data || {});
    res.json({ sample_keys_returned: returned, total_symbols: Object.keys(NIFTY50).length });
  } catch(e) { res.json({ error: e.message }); }
});


// ── Frontend
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>NSE Stock Screener</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<style>
:root {
  --bg:#0d0f12; --surface:#141720; --surface2:#1c2030; --border:#2a2f3e; --border2:#363d50;
  --text:#e8eaf0; --muted:#7a8299; --dim:#4a5068;
  --green:#00c896; --green-bg:rgba(0,200,150,0.08); --green-border:rgba(0,200,150,0.25);
  --red:#ff5c5c; --red-bg:rgba(255,92,92,0.08); --red-border:rgba(255,92,92,0.25);
  --amber:#f5a623; --amber-bg:rgba(245,166,35,0.08);
  --blue:#4d9fff; --blue-bg:rgba(77,159,255,0.08); --blue-border:rgba(77,159,255,0.25);
  --purple:#a78bfa; --purple-bg:rgba(167,139,250,0.08); --purple-border:rgba(167,139,250,0.25);
  --font:'IBM Plex Sans',sans-serif; --mono:'IBM Plex Mono',monospace;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;min-height:100vh;}
.header{padding:20px 28px;border-bottom:1px solid var(--border);}
.header-top{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;}
.brand-row{display:flex;align-items:center;gap:10px;}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2s infinite;}
.dot.off{background:var(--dim);box-shadow:none;animation:none;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.brand-name{font-size:19px;font-weight:600;letter-spacing:-0.3px;}
.brand-sub{font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:2px;}
.hbtns{display:flex;gap:8px;align-items:center;}
.btn{font-family:var(--mono);font-size:12px;padding:7px 14px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:6px;}
.btn:hover{border-color:var(--green);color:var(--green);}
.btn.primary{border-color:var(--green);background:var(--green-bg);color:var(--green);}
@keyframes spin{to{transform:rotate(360deg)}}
.spinning{animation:spin 1s linear infinite;}
.trend-banner{display:flex;align-items:center;gap:14px;padding:10px 14px;border-radius:8px;border:1px solid;margin-bottom:14px;flex-wrap:wrap;}
.trend-banner.up{background:var(--green-bg);border-color:var(--green-border);}
.trend-banner.down{background:var(--red-bg);border-color:var(--red-border);}
.trend-banner.neutral{background:var(--amber-bg);border-color:rgba(245,166,35,0.25);}
.trend-tag{font-size:11px;font-weight:600;font-family:var(--mono);letter-spacing:0.5px;padding:3px 9px;border-radius:4px;border:1px solid;}
.trend-banner.up .trend-tag{color:var(--green);border-color:var(--green-border);background:var(--green-bg);}
.trend-banner.down .trend-tag{color:var(--red);border-color:var(--red-border);background:var(--red-bg);}
.trend-banner.neutral .trend-tag{color:var(--amber);border-color:rgba(245,166,35,0.3);background:var(--amber-bg);}
.trend-info{display:flex;gap:18px;flex-wrap:wrap;}
.t-item{font-size:12px;color:var(--muted);font-family:var(--mono);}
.t-item b{color:var(--text);font-weight:500;}
.trend-advice{margin-left:auto;font-size:11px;font-family:var(--mono);padding:3px 10px;border-radius:4px;}
.trend-banner.up .trend-advice{color:var(--green);background:var(--green-bg);}
.trend-banner.down .trend-advice{color:var(--red);background:var(--red-bg);}

/* STRATEGY TABS */
.strategy-tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:0;}
.stab{font-size:12px;padding:10px 20px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-family:var(--mono);transition:all 0.15s;border-bottom:2px solid transparent;white-space:nowrap;}
.stab.active{color:var(--green);border-bottom-color:var(--green);}
.stab:hover{color:var(--text);}

.controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 28px;border-bottom:1px solid var(--border);}
.ctrl{display:flex;align-items:center;gap:7px;}
.ctrl-lbl{font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:0.4px;}
input[type=range]{-webkit-appearance:none;width:90px;height:3px;background:var(--border2);border-radius:2px;outline:none;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:var(--green);cursor:pointer;}
.thresh-val{font-family:var(--mono);font-size:12px;color:var(--green);min-width:34px;}
.vdiv{width:1px;height:18px;background:var(--border2);}
.seg{display:flex;border:1px solid var(--border2);border-radius:6px;overflow:hidden;}
.sbtn{font-size:11px;padding:6px 10px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-family:var(--mono);transition:all 0.15s;white-space:nowrap;}
.sbtn.active{background:var(--surface2);color:var(--text);}
.sbtn:not(:last-child){border-right:1px solid var(--border2);}

.closed-screen{display:none;flex-direction:column;align-items:center;justify-content:center;padding:70px 28px;text-align:center;gap:14px;}
.closed-icon{font-size:36px;opacity:0.25;}
.closed-title{font-size:18px;font-weight:600;color:var(--muted);}
.closed-sub{font-size:12px;font-family:var(--mono);color:var(--dim);line-height:1.9;}
.closed-next{font-size:12px;font-family:var(--mono);color:var(--amber);}

.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:16px 28px;}
.stats-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:16px 28px;}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;}
.stat-lbl{font-size:10px;color:var(--muted);font-family:var(--mono);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:5px;}
.stat-val{font-size:22px;font-weight:600;font-family:var(--mono);}
.stat-val.g{color:var(--green);}
.stat-val.b{color:var(--blue);}
.stat-val.a{color:var(--amber);}

.tbl-wrap{padding:0 28px 28px;}
.tbl-inner{border:1px solid var(--border);border-radius:10px;overflow:hidden;overflow-x:auto;}
table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:800px;}
thead{background:var(--surface);}
th{padding:9px 12px;text-align:left;font-weight:500;font-size:10px;color:var(--muted);letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid var(--border);font-family:var(--mono);white-space:nowrap;cursor:pointer;user-select:none;}
th:hover{color:var(--text);}
td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:rgba(255,255,255,0.02);}
.sym{font-family:var(--mono);font-weight:500;font-size:13px;}
.mono{font-family:var(--mono);}
.pos{color:var(--green);font-family:var(--mono);}
.neg{color:var(--red);font-family:var(--mono);}
.gap-up{color:var(--green);font-family:var(--mono);font-weight:500;}
.gap-down{color:var(--red);font-family:var(--mono);font-weight:500;}

.sigs{display:flex;gap:4px;flex-wrap:wrap;}
.sig{font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;font-family:var(--mono);letter-spacing:0.3px;white-space:nowrap;border:1px solid;}
.sig-sl-buy{background:var(--green-bg);border-color:var(--green-border);color:var(--green);}
.sig-sl-sell{background:var(--red-bg);border-color:var(--red-border);color:var(--red);}
.sig-br-buy{background:var(--blue-bg);border-color:var(--blue-border);color:var(--blue);}
.sig-br-sell{background:var(--purple-bg);border-color:var(--purple-border);color:var(--purple);}
.sig-near{background:var(--surface2);border-color:var(--border2);color:var(--muted);}

.t-yes{color:var(--green);font-family:var(--mono);font-size:11px;}
.t-no{color:var(--red);font-family:var(--mono);font-size:11px;}
.t-na{color:var(--dim);font-family:var(--mono);font-size:11px;}
.align-yes{color:var(--green);font-family:var(--mono);font-size:11px;}
.align-no{color:var(--red);font-family:var(--mono);font-size:11px;}
.align-na{color:var(--dim);font-family:var(--mono);font-size:11px;}

.prox{display:flex;align-items:center;gap:6px;}
.prox-bg{width:55px;height:3px;background:var(--border2);border-radius:2px;}
.prox-fill{height:3px;border-radius:2px;}
.prox-txt{font-family:var(--mono);font-size:11px;color:var(--muted);min-width:36px;}

.msg-row td{text-align:center;padding:44px;color:var(--muted);font-family:var(--mono);font-size:13px;}
.loader{display:inline-flex;gap:5px;align-items:center;}
.loader span{width:5px;height:5px;border-radius:50%;background:var(--green);animation:blink 1.2s infinite;}
.loader span:nth-child(2){animation-delay:0.2s;}
.loader span:nth-child(3){animation-delay:0.4s;}
@keyframes blink{0%,80%,100%{opacity:0.15}40%{opacity:1}}

.legend{display:flex;gap:12px;align-items:center;padding:12px 28px;border-top:1px solid var(--border);flex-wrap:wrap;}
.leg-title{font-size:10px;color:var(--dim);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.5px;}
.leg-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);font-family:var(--mono);}
.leg-sig{font-size:10px;font-weight:600;padding:1px 6px;border-radius:3px;border:1px solid;}

.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;align-items:center;justify-content:center;}
.modal-overlay.show{display:flex;}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px;max-width:480px;width:90%;}
.modal-title{font-size:17px;font-weight:600;margin-bottom:8px;}
.modal-sub{font-size:13px;color:var(--muted);line-height:1.7;margin-bottom:20px;}
.token-input{width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:10px 14px;color:var(--text);font-family:var(--mono);font-size:12px;outline:none;resize:vertical;min-height:80px;margin-bottom:12px;}
.token-input:focus{border-color:var(--green);}
.modal-btns{display:flex;gap:8px;}
.modal-save{flex:1;padding:10px;border-radius:8px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-family:var(--mono);font-size:13px;cursor:pointer;}
.modal-save:hover{background:var(--green);color:#000;}
.modal-cancel{padding:10px 16px;border-radius:8px;border:1px solid var(--border2);background:transparent;color:var(--muted);font-family:var(--mono);font-size:13px;cursor:pointer;}

.footer{padding:10px 28px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--dim);font-family:var(--mono);border-top:1px solid var(--border);flex-wrap:wrap;gap:8px;}
.footer-cd{color:var(--green);}
.footer-cd.paused{color:var(--dim);}
</style>
</head>
<body>

<div class="modal-overlay" id="token-modal">
  <div class="modal">
    <div class="modal-title">Update Access Token</div>
    <div class="modal-sub">Paste your Upstox access token below.</div>
    <textarea class="token-input" id="token-input" placeholder="Paste access token here..."></textarea>
    <div class="modal-btns">
      <button class="modal-save" onclick="saveToken()">Save Token</button>
      <button class="modal-cancel" onclick="closeModal()">Cancel</button>
    </div>
  </div>
</div>

<div class="header">
  <div class="header-top">
    <div>
      <div class="brand-row"><div class="dot" id="status-dot"></div><div class="brand-name">NSE Stock Screener</div></div>
      <div class="brand-sub" id="brand-sub">Daily Candle Liquidity Sweep + Advanced ORB · Upstox API</div>
    </div>
    <div class="hbtns">
      <button class="btn" onclick="openModal()">⚙ Token</button>
      <button class="btn primary" id="refresh-btn" onclick="manualRefresh()">
        <span id="spin">↻</span> Refresh
      </button>
    </div>
  </div>

  <div class="trend-banner neutral" id="trend-banner">
    <span class="trend-tag" id="trend-tag">LOADING...</span>
    <div class="trend-info" id="trend-info"></div>
    <span class="trend-advice" id="trend-advice"></span>
  </div>

  <!-- STRATEGY TABS -->
  <div class="strategy-tabs">
    <button class="stab active" data-tab="dcls" onclick="setTab('dcls')">📊 Daily Candle Liquidity Sweep</button>
    <button class="stab" data-tab="orb" onclick="setTab('orb')">🚀 Advanced ORB</button>
  </div>
</div>

<!-- DCLS Controls -->
<div id="dcls-controls" class="controls">
  <div class="ctrl">
    <span class="ctrl-lbl">PROXIMITY</span>
    <input type="range" min="0.1" max="2" step="0.1" value="0.5" id="thresh" oninput="onThresh(this.value)"/>
    <span class="thresh-val" id="thresh-disp">0.5%</span>
  </div>
  <div class="vdiv"></div>
  <div class="seg">
    <button class="sbtn active" data-f="all" onclick="setFilter('all')">ALL</button>
    <button class="sbtn" data-f="buy" onclick="setFilter('buy')">BUY ONLY</button>
    <button class="sbtn" data-f="sell" onclick="setFilter('sell')">SELL ONLY</button>
  </div>
  <div class="vdiv"></div>
  <div class="seg" id="index-seg">
    <button class="sbtn active" data-i="NIFTY50" onclick="toggleIndex('NIFTY50',this)">NIFTY 50</button>
    <button class="sbtn" data-i="NIFTYNEXT50" onclick="toggleIndex('NIFTYNEXT50',this)">NEXT 50</button>
    <button class="sbtn" data-i="NIFTY100" onclick="toggleIndex('NIFTY100',this)">NIFTY 100</button>
    <button class="sbtn" data-i="ALL" onclick="toggleIndex('ALL',this)">ALL NSE</button>
  </div>
  <div class="vdiv"></div>
  <div class="ctrl">
    <span class="ctrl-lbl">OVERRIDE</span>
    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
      <input type="checkbox" id="override-toggle" onchange="toggleOverride(this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:var(--green);"/>
      <span style="font-size:11px;color:var(--muted);font-family:var(--mono);" id="override-label">Off</span>
    </label>
  </div>
</div>

<!-- ORB Controls -->
<div id="orb-controls" class="controls" style="display:none;">
  <div class="ctrl">
    <span class="ctrl-lbl">MIN GAP %</span>
    <input type="range" min="0" max="5" step="0.1" value="0" id="gap-thresh" oninput="onGapThresh(this.value)"/>
    <span class="thresh-val" id="gap-disp">0.0%</span>
  </div>
  <div class="vdiv"></div>
  <div class="seg">
    <button class="sbtn active" data-g="all" onclick="setGapFilter('all')">ALL</button>
    <button class="sbtn" data-g="up" onclick="setGapFilter('up')">GAP UP</button>
    <button class="sbtn" data-g="down" onclick="setGapFilter('down')">GAP DOWN</button>
  </div>
  <div class="vdiv"></div>
  <div class="seg" id="orb-index-seg">
    <button class="sbtn active" data-i2="NIFTY50" onclick="toggleIndex('NIFTY50',this)">NIFTY 50</button>
    <button class="sbtn" data-i2="NIFTYNEXT50" onclick="toggleIndex('NIFTYNEXT50',this)">NEXT 50</button>
    <button class="sbtn" data-i2="NIFTY100" onclick="toggleIndex('NIFTY100',this)">NIFTY 100</button>
    <button class="sbtn" data-i2="ALL" onclick="toggleIndex('ALL',this)">ALL NSE</button>
  </div>
</div>

<div class="closed-screen" id="closed-screen">
  <div class="closed-icon">🔒</div>
  <div class="closed-title" id="closed-title">Market is Closed</div>
  <div class="closed-sub" id="closed-sub"></div>
  <div class="closed-next" id="closed-next"></div>
</div>

<!-- DCLS Content -->
<div id="dcls-content">
  <div class="stats">
    <div class="stat"><div class="stat-lbl">Stocks Loaded</div><div class="stat-val" id="s-total">—</div></div>
    <div class="stat"><div class="stat-lbl">Near PDH / PDL</div><div class="stat-val g" id="s-signals">—</div></div>
  </div>
  <div class="tbl-wrap">
    <div class="tbl-inner">
      <table>
        <thead>
          <tr>
            <th onclick="sortTable('symbol','dcls')">Symbol</th>
            <th onclick="sortTable('ltp','dcls')">LTP (₹)</th>
            <th onclick="sortTable('chgPct','dcls')">Chg %</th>
            <th onclick="sortTable('pdh','dcls')">PDH (₹)</th>
            <th onclick="sortTable('pdl','dcls')">PDL (₹)</th>
            <th>Signal</th>
            <th>Trend Align</th>
            <th onclick="sortTable('distPdl','dcls')">Proximity</th>
          </tr>
        </thead>
        <tbody id="dcls-tbody">
          <tr class="msg-row"><td colspan="11"><div class="loader"><span></span><span></span><span></span></div>&nbsp; Loading...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="legend">
    <span class="leg-title">Legend:</span>
    <div class="leg-item"><span class="leg-sig sig-sl-buy">NEAR PDL</span> Stock near Previous Day Low — potential BUY setup</div>
    <div class="leg-item"><span class="leg-sig sig-sl-sell">NEAR PDH</span> Stock near Previous Day High — potential SELL setup</div>
  </div>
</div>

<!-- ORB Content -->
<div id="orb-content" style="display:none;">
  <div class="stats-4">
    <div class="stat"><div class="stat-lbl">Stocks Loaded</div><div class="stat-val" id="orb-total">—</div></div>
    <div class="stat"><div class="stat-lbl">Gap Up</div><div class="stat-val g" id="orb-up">—</div></div>
    <div class="stat"><div class="stat-lbl">Gap Down</div><div class="stat-val" style="color:var(--red)" id="orb-down">—</div></div>
    <div class="stat"><div class="stat-lbl">Avg Gap %</div><div class="stat-val a" id="orb-avg">—</div></div>
  </div>
  <div class="tbl-wrap">
    <div class="tbl-inner">
      <table>
        <thead>
          <tr>
            <th onclick="sortTable('symbol','orb')">Symbol</th>
            <th onclick="sortTable('ltp','orb')">LTP (₹)</th>
            <th onclick="sortTable('chgPct','orb')">Day Chg %</th>
            <th onclick="sortTable('gapPct','orb')">Gap % ▼</th>
            <th onclick="sortTable('open','orb')">Open (₹)</th>
            <th onclick="sortTable('prevClose','orb')">Prev Close (₹)</th>
            <th onclick="sortTable('pdh','orb')">PDH (₹)</th>
            <th onclick="sortTable('pdl','orb')">PDL (₹)</th>
          </tr>
        </thead>
        <tbody id="orb-tbody">
          <tr class="msg-row"><td colspan="8"><div class="loader"><span></span><span></span><span></span></div>&nbsp; Loading...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="footer">
  <span class="footer-cd" id="countdown">—</span>
  <span id="footer-time">—</span>
</div>

<script>
const API_BASE = '';
let allData = [];
let niftyTrend = null;
let currentTab = 'dcls';
let currentFilter = 'all';
let currentGapFilter = 'all';
let currentIndex = 'NIFTY50';
let threshold = 0.5;
let gapThreshold = 0;
let countdown = 180;
let tickTimer = null;
let overrideOn = false;
let sortKey = 'distPdl';
let sortDir = 1;
let sortKeyOrb = 'gapPct';
let sortDirOrb = -1;

function getIST(){return new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'}));}
function isMarketOpen(){
  if(overrideOn) return true;
  const ist=getIST();const d=ist.getDay();
  if(d===0||d===6) return false;
  const m=ist.getHours()*60+ist.getMinutes();
  return m>=9*60+15&&m<=15*60+30;
}
function nextOpen(){
  const ist=getIST();const d=ist.getDay();const m=ist.getHours()*60+ist.getMinutes();
  if(d>=1&&d<=5&&m<9*60+15){const n=new Date(ist);n.setHours(9,15,0,0);return n;}
  let ahead=d===5?3:d===6?2:1;
  const n=new Date(ist);n.setDate(n.getDate()+ahead);n.setHours(9,15,0,0);return n;
}

function toggleOverride(on){
  overrideOn=on;
  document.getElementById('override-label').textContent=on?'ON':'Off';
  document.getElementById('override-label').style.color=on?'var(--green)':'var(--muted)';
  updateMarketState();
  if(on) fetchData();
}

function updateMarketState(){
  const open=isMarketOpen();
  document.getElementById('status-dot').className=open?'dot':'dot off';
  document.getElementById('closed-screen').style.display=open?'none':'flex';
  document.getElementById('dcls-content').style.display=(open&&currentTab==='dcls')?'block':'none';
  document.getElementById('orb-content').style.display=(open&&currentTab==='orb')?'block':'none';
  document.getElementById('refresh-btn').disabled=!open;
  if(!open){
    stopTickers();
    const cd=document.getElementById('countdown');
    cd.textContent='Market closed — auto-refresh paused';cd.className='footer-cd paused';
    const ist=getIST();const d=ist.getDay();const m2=ist.getHours()*60+ist.getMinutes();
    let title='Market is Closed',sub='';
    if(d===0||d===6){title='Weekend — Market Closed';sub='NSE is closed. Screener resumes on Monday.';}
    else if(m2<9*60+15){title='Pre-Market — Not Open Yet';sub='Market opens at 09:15 IST.';}
    else{title='Market Closed for Today';sub='NSE closed at 15:30 IST. Resumes tomorrow.';}
    const n=nextOpen();
    document.getElementById('closed-title').textContent=title;
    document.getElementById('closed-sub').textContent=sub;
    document.getElementById('closed-next').textContent='Next session: '+n.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})+' at 09:15 IST';
  } else {
    if(!tickTimer) startTickers();
  }
}

function startTickers(){
  countdown=180;
  tickTimer=setInterval(()=>{
    if(!isMarketOpen()){updateMarketState();return;}
    countdown--;
    const m=Math.floor(countdown/60),s=countdown%60;
    const cd=document.getElementById('countdown');
    cd.textContent='Auto-refresh in '+m+':'+(s<10?'0':'')+s;
    cd.className='footer-cd';
    if(countdown<=0){countdown=180;fetchData();}
  },1000);
}
function stopTickers(){if(tickTimer){clearInterval(tickTimer);tickTimer=null;}}

function setTab(tab){
  currentTab=tab;
  document.querySelectorAll('.stab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.getElementById('dcls-controls').style.display=tab==='dcls'?'flex':'none';
  document.getElementById('orb-controls').style.display=tab==='orb'?'flex':'none';
  document.getElementById('dcls-content').style.display=(tab==='dcls'&&isMarketOpen())?'block':'none';
  document.getElementById('orb-content').style.display=(tab==='orb'&&isMarketOpen())?'block':'none';
  renderTable();
}

function openModal(){document.getElementById('token-modal').classList.add('show');}
function closeModal(){document.getElementById('token-modal').classList.remove('show');}
async function saveToken(){
  const token=document.getElementById('token-input').value.trim();
  if(!token){alert('Please paste a token');return;}
  await fetch(API_BASE+'/api/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
  closeModal();fetchData();
}

async function fetchData(){
  if(!isMarketOpen()) return;
  document.getElementById('spin').classList.add('spinning');
  try{
    const endpoint=overrideOn?'/api/refresh-and-get':'/api/stocks';
    const res=await fetch(API_BASE+endpoint+'?index='+encodeURIComponent(currentIndex));
    const json=await res.json();
    if(json.stocks){
      allData=json.stocks;
      niftyTrend=json.niftyTrend;
      updateTrendBanner();
      renderTable();
      const ist=getIST();
      document.getElementById('footer-time').textContent='Last updated: '+ist.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' IST';
    }
  }catch(e){console.error('Fetch error:',e);}
  document.getElementById('spin').classList.remove('spinning');
}

function manualRefresh(){if(!isMarketOpen())return;countdown=180;fetchData();}

function updateTrendBanner(){
  if(!niftyTrend)return;
  const banner=document.getElementById('trend-banner');
  banner.className=niftyTrend.isUp?'trend-banner up':'trend-banner down';
  document.getElementById('trend-tag').textContent=niftyTrend.isUp?'▲ UPTREND':'▼ DOWNTREND';
  document.getElementById('trend-advice').textContent=niftyTrend.isUp?'Look for BUY setups':'Look for SELL setups';
  const cc=niftyTrend.chgPct>=0?'var(--green)':'var(--red)';
  document.getElementById('trend-info').innerHTML=
    '<div class="t-item">Nifty: <b>₹'+niftyTrend.ltp.toLocaleString('en-IN',{minimumFractionDigits:2})+'</b></div>'+
    '<div class="t-item">Prev Close: <b>₹'+niftyTrend.prevClose.toLocaleString('en-IN',{minimumFractionDigits:2})+'</b></div>'+
    '<div class="t-item">Change: <b style="color:'+cc+'">'+(niftyTrend.chgPct>=0?'+':'')+niftyTrend.chgPct+'%</b></div>'+
    '<div class="t-item">Trend: <b>'+(niftyTrend.isUp?'Above Prev Close ▲':'Below Prev Close ▼')+'</b></div>';
}

function onThresh(v){threshold=parseFloat(v);document.getElementById('thresh-disp').textContent=threshold.toFixed(1)+'%';renderTable();}
function onGapThresh(v){gapThreshold=parseFloat(v);document.getElementById('gap-disp').textContent=gapThreshold.toFixed(1)+'%';renderTable();}
function setFilter(f){currentFilter=f;document.querySelectorAll('[data-f]').forEach(b=>b.classList.toggle('active',b.dataset.f===f));renderTable();}
function setGapFilter(g){currentGapFilter=g;document.querySelectorAll('[data-g]').forEach(b=>b.classList.toggle('active',b.dataset.g===g));renderTable();}
let selectedIndices = new Set(['NIFTY50']);
function toggleIndex(i, btn){
  // ALL NSE is exclusive - if selected, deselect others
  if(i === 'ALL'){
    selectedIndices.clear();
    selectedIndices.add('ALL');
  } else {
    selectedIndices.delete('ALL');
    if(selectedIndices.has(i)) {
      selectedIndices.delete(i);
      if(selectedIndices.size === 0) selectedIndices.add('NIFTY50'); // always keep at least one
    } else {
      selectedIndices.add(i);
    }
  }
  // Update button states
  document.querySelectorAll('[data-i],[data-i2]').forEach(b=>{
    const idx = b.dataset.i || b.dataset.i2;
    b.classList.toggle('active', selectedIndices.has(idx));
  });
  currentIndex = selectedIndices.has('ALL') ? 'ALL' : Array.from(selectedIndices).join(',');
  fetchData();
}
function setIndex(i){ toggleIndex(i, null); }

function sortTable(key, tab){
  if(tab==='dcls'){
    if(sortKey===key) sortDir*=-1; else{sortKey=key;sortDir=1;}
  } else {
    if(sortKeyOrb===key) sortDirOrb*=-1; else{sortKeyOrb=key;sortDirOrb=-1;}
  }
  renderTable();
}

function renderTable(){
  if(currentTab==='dcls') renderDCLS();
  else renderORB();
}

function renderDCLS(){
  const tbody=document.getElementById('dcls-tbody');
  if(!allData.length){tbody.innerHTML='<tr class="msg-row"><td colspan="11">No data. Click Refresh.</td></tr>';return;}
  const enriched=allData.map(d=>{
    const nearPdh=d.distPdh<=threshold;
    const nearPdl=d.distPdl<=threshold;
    // Trend align: uptrend+nearPDL = buy setup aligned; downtrend+nearPDH = sell setup aligned
    let trendAlign='na';
    if(niftyTrend){
      if(nearPdl&&niftyTrend.isUp) trendAlign='yes';
      else if(nearPdh&&!niftyTrend.isUp) trendAlign='yes';
      else if(nearPdh||nearPdl) trendAlign='no';
    }
    return {...d,nearPdh,nearPdl,trendAlign};
  });
  let filtered=enriched.filter(d=>{
    if(!d.nearPdh&&!d.nearPdl) return false;
    if(currentFilter==='buy') return d.nearPdl;
    if(currentFilter==='sell') return d.nearPdh;
    return true;
  }).sort((a,b)=>{
    const av=a[sortKey]??0,bv=b[sortKey]??0;
    return typeof av==='string'?av.localeCompare(bv)*sortDir:(av-bv)*sortDir;
  });
  document.getElementById('s-total').textContent=enriched.length;
  document.getElementById('s-signals').textContent=filtered.length;
  document.getElementById('s-sweep').textContent=enriched.filter(d=>d.nearPdl).length;
  document.getElementById('s-12').textContent=enriched.filter(d=>d.trendAlign==='yes').length;
  if(!filtered.length){tbody.innerHTML='<tr class="msg-row"><td colspan="8">No stocks near PDH/PDL. Try increasing proximity threshold.</td></tr>';return;}
  const fmt=v=>'₹'+v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  tbody.innerHTML=filtered.map(d=>{
    const chgSign=d.chgPct>=0?'+':'',chgCls=d.chgPct>=0?'pos':'neg';
    const sig=d.nearPdl?'<span class="sig sig-sl-buy">NEAR PDL</span>':'<span class="sig sig-sl-sell">NEAR PDH</span>';
    const aMap={yes:'<span class="align-yes">✓ Aligned</span>',no:'<span class="align-no">✗ Against</span>',na:'<span class="align-na">—</span>'};
    const proxVal=Math.min(d.distPdh,d.distPdl);
    const barW=Math.max(3,Math.round((1-proxVal/threshold)*55));
    const barC=d.distPdh<d.distPdl?'var(--red)':'var(--green)';
    return '<tr><td class="sym">'+d.symbol+'</td><td class="mono">'+fmt(d.ltp)+'</td><td class="'+chgCls+'">'+chgSign+d.chgPct+'%</td><td class="mono">'+fmt(d.pdh)+'</td><td class="mono">'+fmt(d.pdl)+'</td><td>'+sig+'</td><td>'+aMap[d.trendAlign]+'</td><td><div class="prox"><div class="prox-bg"><div class="prox-fill" style="width:'+barW+'px;background:'+barC+';"></div></div><span class="prox-txt">'+proxVal.toFixed(2)+'%</span></div></td></tr>';
  }).join('');
}

function renderORB(){
  const tbody=document.getElementById('orb-tbody');
  if(!allData.length){tbody.innerHTML='<tr class="msg-row"><td colspan="8">No data. Click Refresh.</td></tr>';return;}
  let filtered=allData.filter(d=>{
    const absGap=Math.abs(d.gapPct||0);
    if(absGap<gapThreshold) return false;
    if(currentGapFilter==='up') return (d.gapPct||0)>0;
    if(currentGapFilter==='down') return (d.gapPct||0)<0;
    return true;
  }).sort((a,b)=>{
    const av=a[sortKeyOrb]??0,bv=b[sortKeyOrb]??0;
    if(sortKeyOrb==='gapPct') return (Math.abs(bv)-Math.abs(av));
    return typeof av==='string'?av.localeCompare(bv)*sortDirOrb:(av-bv)*sortDirOrb;
  });
  const gapUp=allData.filter(d=>(d.gapPct||0)>0).length;
  const gapDown=allData.filter(d=>(d.gapPct||0)<0).length;
  const avgGap=allData.length>0?(allData.reduce((s,d)=>s+Math.abs(d.gapPct||0),0)/allData.length).toFixed(2):0;
  document.getElementById('orb-total').textContent=allData.length;
  document.getElementById('orb-up').textContent=gapUp;
  document.getElementById('orb-down').textContent=gapDown;
  document.getElementById('orb-avg').textContent=avgGap+'%';
  if(!filtered.length){tbody.innerHTML='<tr class="msg-row"><td colspan="8">No stocks match gap filter.</td></tr>';return;}
  const fmt=v=>'₹'+v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  tbody.innerHTML=filtered.map(d=>{
    const gap=d.gapPct||0;
    const gapCls=gap>0?'gap-up':'gap-down';
    const gapSign=gap>0?'+':'';
    const chgSign=d.chgPct>=0?'+':'';
    const chgCls=d.chgPct>=0?'pos':'neg';
    return '<tr><td class="sym">'+d.symbol+'</td><td class="mono">'+fmt(d.ltp)+'</td><td class="'+chgCls+'">'+chgSign+d.chgPct+'%</td><td class="'+gapCls+'">'+gapSign+gap.toFixed(2)+'%</td><td class="mono">'+fmt(d.open||d.ltp)+'</td><td class="mono">'+fmt(d.prevClose||d.ltp)+'</td><td class="mono">'+fmt(d.pdh)+'</td><td class="mono">'+fmt(d.pdl)+'</td></tr>';
  }).join('');
}

updateMarketState();
if(isMarketOpen()) fetchData();
setInterval(updateMarketState,60000);
</script>
</body>
</html>`);
});

// ── Schedule refresh every 3 min during market hours
cron.schedule('*/3 * * * *', () => { if (isMarketOpen()) refreshNifty50(); });

// ── Startup
app.listen(PORT, async () => {
  console.log(`Screener running on port ${PORT}`);
  if (isMarketOpen()) await refreshNifty50();
  else console.log('Market closed - skipping initial fetch');
});
