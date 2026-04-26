require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

const PORT = process.env.PORT || 3001;
const UPSTOX_BASE = 'https://api.upstox.com/v2';

// ── Nifty indices instrument lists
const INDICES = {
  'NIFTY50': [
    'NSE_EQ|INE423A01024','NSE_EQ|INE742F01042','NSE_EQ|INE437A01024','NSE_EQ|INE021A01026',
    'NSE_EQ|INE238A01034','NSE_EQ|INE917I01010','NSE_EQ|INE296A01024','NSE_EQ|INE918I01026',
    'NSE_EQ|INE263A01024','NSE_EQ|INE397D01024','NSE_EQ|INE029A01011','NSE_EQ|INE216A01030',
    'NSE_EQ|INE059A01026','NSE_EQ|INE522F01014','NSE_EQ|INE361B01024','NSE_EQ|INE089A01023',
    'NSE_EQ|INE066A01021','NSE_EQ|INE047A01021','NSE_EQ|INE860A01027','NSE_EQ|INE040A01034',
    'NSE_EQ|INE795G01014','NSE_EQ|INE158A01026','NSE_EQ|INE038A01020','NSE_EQ|INE030A01027',
    'NSE_EQ|INE090A01021','NSE_EQ|INE095A01012','NSE_EQ|INE009A01021','NSE_EQ|INE154A01025',
    'NSE_EQ|INE019A01038','NSE_EQ|INE237A01028','NSE_EQ|INE018A01030','NSE_EQ|INE214T01019',
    'NSE_EQ|INE101A01026','NSE_EQ|INE585B01010','NSE_EQ|INE239A01024','NSE_EQ|INE733E01010',
    'NSE_EQ|INE213A01029','NSE_EQ|INE752E01010','NSE_EQ|INE002A01018','NSE_EQ|INE062A01020',
    'NSE_EQ|INE721A01013','NSE_EQ|INE044A01036','NSE_EQ|INE155A01022','NSE_EQ|INE081A01020',
    'NSE_EQ|INE467B01029','NSE_EQ|INE669C01036','NSE_EQ|INE280A01028','NSE_EQ|INE849A01020',
    'NSE_EQ|INE481G01011','NSE_EQ|INE075A01022'
  ]
};

const SYMBOL_MAP = {
  'NSE_EQ|INE423A01024':'ADANIENT','NSE_EQ|INE742F01042':'ADANIPORTS',
  'NSE_EQ|INE437A01024':'APOLLOHOSP','NSE_EQ|INE021A01026':'ASIANPAINT',
  'NSE_EQ|INE238A01034':'AXISBANK','NSE_EQ|INE917I01010':'BAJAJ-AUTO',
  'NSE_EQ|INE296A01024':'BAJFINANCE','NSE_EQ|INE918I01026':'BAJAJFINSV',
  'NSE_EQ|INE263A01024':'BEL','NSE_EQ|INE397D01024':'BHARTIARTL',
  'NSE_EQ|INE029A01011':'BPCL','NSE_EQ|INE216A01030':'BRITANNIA',
  'NSE_EQ|INE059A01026':'CIPLA','NSE_EQ|INE522F01014':'COALINDIA',
  'NSE_EQ|INE361B01024':'DIVISLAB','NSE_EQ|INE089A01023':'DRREDDY',
  'NSE_EQ|INE066A01021':'EICHERMOT','NSE_EQ|INE047A01021':'GRASIM',
  'NSE_EQ|INE860A01027':'HCLTECH','NSE_EQ|INE040A01034':'HDFCBANK',
  'NSE_EQ|INE795G01014':'HDFCLIFE','NSE_EQ|INE158A01026':'HEROMOTOCO',
  'NSE_EQ|INE038A01020':'HINDALCO','NSE_EQ|INE030A01027':'HINDUNILVR',
  'NSE_EQ|INE090A01021':'ICICIBANK','NSE_EQ|INE095A01012':'INDUSINDBK',
  'NSE_EQ|INE009A01021':'INFY','NSE_EQ|INE154A01025':'ITC',
  'NSE_EQ|INE019A01038':'JSWSTEEL','NSE_EQ|INE237A01028':'KOTAKBANK',
  'NSE_EQ|INE018A01030':'LT','NSE_EQ|INE214T01019':'LTIM',
  'NSE_EQ|INE101A01026':'M&M','NSE_EQ|INE585B01010':'MARUTI',
  'NSE_EQ|INE239A01024':'NESTLEIND','NSE_EQ|INE733E01010':'NTPC',
  'NSE_EQ|INE213A01029':'ONGC','NSE_EQ|INE752E01010':'POWERGRID',
  'NSE_EQ|INE002A01018':'RELIANCE','NSE_EQ|INE062A01020':'SBIN',
  'NSE_EQ|INE721A01013':'SHRIRAMFIN','NSE_EQ|INE044A01036':'SUNPHARMA',
  'NSE_EQ|INE155A01022':'TATAMOTORS','NSE_EQ|INE081A01020':'TATASTEEL',
  'NSE_EQ|INE467B01029':'TCS','NSE_EQ|INE669C01036':'TECHM',
  'NSE_EQ|INE280A01028':'TITAN','NSE_EQ|INE849A01020':'TRENT',
  'NSE_EQ|INE481G01011':'ULTRACEMCO','NSE_EQ|INE075A01022':'WIPRO'
};

// ── Cache
let cachedData = { stocks: [], niftyTrend: null, lastUpdated: null };
let accessToken = process.env.UPSTOX_ACCESS_TOKEN || '';

// ── Upstox API helper
async function upGet(path) {
  const res = await axios.get(UPSTOX_BASE + path, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Api-Version': '2.0'
    }
  });
  return res.data;
}

// ── Get IST date string
function getISTDate() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getISTDateOffset(days) {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  ist.setDate(ist.getDate() + days);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isMarketOpen() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

// ── Fetch Nifty 50 trend
async function fetchNiftyTrend() {
  try {
    const data = await upGet('/market-quote/quotes?instrument_key=NSE_INDEX%7CNifty%2050');
    const q = data.data?.['NSE_INDEX:Nifty 50'];
    if (!q) return null;
    const ltp = q.last_price;
    const netChg = q.net_change || 0;
    const prevClose = netChg !== 0 ? ltp - netChg : ltp;
    const chgPct = prevClose > 0 ? (netChg / prevClose * 100) : 0;
    return {
      ltp,
      prevClose,
      chgPct: parseFloat(chgPct.toFixed(2)),
      isUp: ltp > prevClose,
      change: parseFloat(netChg.toFixed(2))
    };
  } catch (e) {
    console.error('Nifty trend error:', e.message);
    return null;
  }
}

// ── Fetch PDH/PDL for a stock
async function fetchPDHL(instrumentKey) {
  try {
    const toDate = getISTDate();
    const fromDate = getISTDateOffset(-7);
    const key = encodeURIComponent(instrumentKey);
    const data = await upGet(`/historical-candle/${key}/day/${toDate}/${fromDate}`);
    const candles = data.data?.candles;
    if (!candles || candles.length < 1) return null;
    let prevCandle = null;
    for (const c of candles) {
      const cDate = c[0].substring(0, 10);
      if (cDate < toDate) { prevCandle = c; break; }
    }
    if (!prevCandle) prevCandle = candles[0];
    return { pdh: prevCandle[2], pdl: prevCandle[3], prevClose: prevCandle[4] };
  } catch (e) { return null; }
}

// ── Fetch intraday candles and detect signals
async function fetchSignals(instrumentKey, pdh, pdl) {
  try {
    const key = encodeURIComponent(instrumentKey);
    const data = await upGet(`/historical-candle/intraday/${key}/1minute`);
    if (!data.data?.candles || data.data.candles.length < 3) {
      return { sweepBuy: false, sweepSell: false, breakBuy: false, breakSell: false };
    }
    const raw = [...data.data.candles].reverse();
    let sweepBuy = false, sweepSell = false, breakBuy = false, breakSell = false;
    for (let i = 0; i < raw.length - 2; i += 3) {
      const chunk = raw.slice(i, i + 3);
      const open = chunk[0][1];
      const high = Math.max(...chunk.map(c => c[2]));
      const low = Math.min(...chunk.map(c => c[3]));
      const close = chunk[chunk.length - 1][4];
      if (low < pdl && close > pdl && close < pdh) sweepBuy = true;
      if (high > pdh && close < pdh && close > pdl) sweepSell = true;
      if (open < pdl && close > pdl && close < pdh) breakBuy = true;
      if (open > pdh && close < pdh && close > pdl) breakSell = true;
    }
    return { sweepBuy, sweepSell, breakBuy, breakSell };
  } catch (e) {
    return { sweepBuy: false, sweepSell: false, breakBuy: false, breakSell: false };
  }
}

// ── Main data fetch
async function fetchAllStocks(index = 'NIFTY50') {
  try {
    const instrumentKeys = INDICES[index] || INDICES['NIFTY50'];
    const SL_BUFFER = 5;

    // Fetch quotes in batches of 10
    const allQuotes = {};
    const BATCH = 10;
    for (let i = 0; i < instrumentKeys.length; i += BATCH) {
      const batch = instrumentKeys.slice(i, i + BATCH);
      const keys = batch.join(',');
      try {
        const data = await upGet(`/market-quote/quotes?instrument_key=${encodeURIComponent(keys)}`);
        if (data.data) Object.assign(allQuotes, data.data);
      } catch (e) { console.error('Batch quote error:', e.message); }
      if (i + BATCH < instrumentKeys.length) await new Promise(r => setTimeout(r, 300));
    }

    // Process each stock
    const stocks = [];
    for (const instrKey of instrumentKeys) {
      const lookupKey = instrKey.replace('|', ':');
      const q = allQuotes[lookupKey];
      if (!q) continue;

      const symbol = SYMBOL_MAP[instrKey] || instrKey;
      const ltp = q.last_price;
      const netChg = q.net_change || 0;
      const prevClose = netChg !== 0 ? ltp - netChg : ltp;
      const chgPct = prevClose > 0 ? (netChg / prevClose * 100) : 0;

      // Fetch PDH/PDL
      const pdhl = await fetchPDHL(instrKey);
      await new Promise(r => setTimeout(r, 100));

      if (!pdhl) continue;
      const { pdh, pdl } = pdhl;

      // Fetch signals
      const signals = await fetchSignals(instrKey, pdh, pdl);
      await new Promise(r => setTimeout(r, 100));

      // Calculate SL and targets
      const slBuy = pdl - SL_BUFFER;
      const slSell = pdh + SL_BUFFER;
      const target12Buy = ltp + (ltp - slBuy) * 2;
      const target12Sell = ltp - (slSell - ltp) * 2;
      const achieve12Buy = target12Buy < pdh;
      const achieve12Sell = target12Sell > pdl;

      // Proximity
      const distPdh = Math.abs((ltp - pdh) / pdh * 100);
      const distPdl = Math.abs((ltp - pdl) / pdl * 100);

      stocks.push({
        symbol,
        ltp: parseFloat(ltp.toFixed(2)),
        chgPct: parseFloat(chgPct.toFixed(2)),
        pdh: parseFloat(pdh.toFixed(2)),
        pdl: parseFloat(pdl.toFixed(2)),
        distPdh: parseFloat(distPdh.toFixed(2)),
        distPdl: parseFloat(distPdl.toFixed(2)),
        ...signals,
        slBuy: parseFloat(slBuy.toFixed(2)),
        slSell: parseFloat(slSell.toFixed(2)),
        target12Buy: parseFloat(target12Buy.toFixed(2)),
        target12Sell: parseFloat(target12Sell.toFixed(2)),
        achieve12Buy,
        achieve12Sell,
      });
    }

    return stocks;
  } catch (e) {
    console.error('fetchAllStocks error:', e.message);
    return [];
  }
}

// ── Refresh cache every 3 minutes during market hours
async function refreshCache() {
  if (!isMarketOpen()) return;
  console.log('Refreshing stock data...');
  const [stocks, niftyTrend] = await Promise.all([
    fetchAllStocks('NIFTY50'),
    fetchNiftyTrend()
  ]);
  cachedData = { stocks, niftyTrend, lastUpdated: new Date().toISOString() };
  console.log(`Cache updated: ${stocks.length} stocks`);
}

// ── Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', marketOpen: isMarketOpen(), lastUpdated: cachedData.lastUpdated });
});

app.get('/api/stocks', async (req, res) => {
  try {
    if (!cachedData.lastUpdated) await refreshCache();
    res.json({
      stocks: cachedData.stocks,
      niftyTrend: cachedData.niftyTrend,
      lastUpdated: cachedData.lastUpdated,
      marketOpen: isMarketOpen()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  accessToken = token;
  res.json({ success: true });
});

app.get('/api/refresh', async (req, res) => {
  await refreshCache();
  res.json({ success: true, stocks: cachedData.stocks.length });
});

// Schedule refresh every 3 minutes during market hours
cron.schedule('*/3 * * * *', refreshCache);

app.listen(PORT, () => {
  console.log(`Screener backend running on port ${PORT}`);
  accessToken = process.env.UPSTOX_ACCESS_TOKEN || '';
  if (isMarketOpen()) refreshCache();
});
