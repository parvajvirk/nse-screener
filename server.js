require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());
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

.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:16px 28px;}
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
  <div class="seg">
    <button class="sbtn active" data-i="NIFTY50" onclick="setIndex('NIFTY50')">NIFTY 50</button>
    <button class="sbtn" data-i="NIFTYNEXT50" onclick="setIndex('NIFTYNEXT50')">NEXT 50</button>
    <button class="sbtn" data-i="NIFTY100" onclick="setIndex('NIFTY100')">NIFTY 100</button>
    <button class="sbtn" data-i="ALL" onclick="setIndex('ALL')">ALL NSE</button>
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
  <div class="seg">
    <button class="sbtn active" data-i2="NIFTY50" onclick="setIndex('NIFTY50')">NIFTY 50</button>
    <button class="sbtn" data-i2="NIFTYNEXT50" onclick="setIndex('NIFTYNEXT50')">NEXT 50</button>
    <button class="sbtn" data-i2="NIFTY100" onclick="setIndex('NIFTY100')">NIFTY 100</button>
    <button class="sbtn" data-i2="ALL" onclick="setIndex('ALL')">ALL NSE</button>
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
    <div class="stat"><div class="stat-lbl">Signals Found</div><div class="stat-val g" id="s-signals">—</div></div>
    <div class="stat"><div class="stat-lbl">Sweep Signals</div><div class="stat-val g" id="s-sweep">—</div></div>
    <div class="stat"><div class="stat-lbl">1:2 Achievable</div><div class="stat-val g" id="s-12">—</div></div>
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
            <th onclick="sortTable('slBuy','dcls')">SL (₹)</th>
            <th onclick="sortTable('target12Buy','dcls')">1:2 Target (₹)</th>
            <th>1:2 OK?</th>
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
    <div class="leg-item"><span class="leg-sig sig-sl-buy">SWEEP BUY</span> Wick below PDL, closed inside</div>
    <div class="leg-item"><span class="leg-sig sig-sl-sell">SWEEP SELL</span> Wick above PDH, closed inside</div>
    <div class="leg-item"><span class="leg-sig sig-br-buy">BREAK BUY</span> Opened below PDL, closed back inside</div>
    <div class="leg-item"><span class="leg-sig sig-br-sell">BREAK SELL</span> Opened above PDH, closed back inside</div>
  </div>
</div>

<!-- ORB Content -->
<div id="orb-content" style="display:none;">
  <div class="stats">
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
    const res=await fetch(API_BASE+endpoint);
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
function setIndex(i){
  currentIndex=i;
  document.querySelectorAll('[data-i],[data-i2]').forEach(b=>{
    if(b.dataset.i===i||b.dataset.i2===i) b.classList.add('active');
    else b.classList.remove('active');
  });
  fetchData();
}

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
    const nearPdh=d.distPdh<=threshold,nearPdl=d.distPdl<=threshold;
    const hasSweep=d.sweepBuy||d.sweepSell,hasBR=d.breakBuy||d.breakSell;
    const hasSignal=hasSweep||hasBR;
    const hasBuy=d.sweepBuy||d.breakBuy,hasSell=d.sweepSell||d.breakSell;
    let trendAlign='na';
    if(niftyTrend){
      if(hasBuy&&niftyTrend.isUp) trendAlign='yes';
      else if(hasSell&&!niftyTrend.isUp) trendAlign='yes';
      else if(hasBuy||hasSell) trendAlign='no';
    }
    return {...d,nearPdh,nearPdl,hasSignal,hasSweep,hasBR,hasBuy,hasSell,trendAlign};
  });
  let filtered=enriched.filter(d=>{
    if(!(d.nearPdh||d.nearPdl||d.hasSignal)) return false;
    if(currentFilter==='buy') return d.hasBuy;
    if(currentFilter==='sell') return d.hasSell;
    return true;
  }).sort((a,b)=>{
    const av=a[sortKey]??0,bv=b[sortKey]??0;
    return typeof av==='string'?av.localeCompare(bv)*sortDir:(av-bv)*sortDir;
  });
  document.getElementById('s-total').textContent=enriched.length;
  document.getElementById('s-signals').textContent=enriched.filter(d=>d.hasSignal).length;
  document.getElementById('s-sweep').textContent=enriched.filter(d=>d.hasSweep||d.hasBR).length;
  document.getElementById('s-12').textContent=enriched.filter(d=>(d.hasBuy&&d.achieve12Buy)||(d.hasSell&&d.achieve12Sell)).length;
  if(!filtered.length){tbody.innerHTML='<tr class="msg-row"><td colspan="11">No stocks match filters. Try increasing threshold.</td></tr>';return;}
  const fmt=v=>'₹'+v.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  tbody.innerHTML=filtered.map(d=>{
    const chgSign=d.chgPct>=0?'+':'',chgCls=d.chgPct>=0?'pos':'neg';
    const sigs=[];
    if(d.sweepBuy) sigs.push('<span class="sig sig-sl-buy">SWEEP BUY</span>');
    if(d.sweepSell) sigs.push('<span class="sig sig-sl-sell">SWEEP SELL</span>');
    if(d.breakBuy) sigs.push('<span class="sig sig-br-buy">BREAK BUY</span>');
    if(d.breakSell) sigs.push('<span class="sig sig-br-sell">BREAK SELL</span>');
    if(!sigs.length){
      if(d.nearPdh) sigs.push('<span class="sig sig-near">NEAR PDH</span>');
      if(d.nearPdl) sigs.push('<span class="sig sig-near">NEAR PDL</span>');
    }
    const isBuy=d.sweepBuy||d.breakBuy,isSell=d.sweepSell||d.breakSell;
    let slH='<span class="t-na">—</span>';
    if(isBuy) slH='<span class="neg">'+fmt(d.slBuy)+'</span>';
    else if(isSell) slH='<span class="pos">'+fmt(d.slSell)+'</span>';
    let t12H='<span class="t-na">—</span>';
    if(isBuy) t12H='<span class="'+(d.achieve12Buy?'pos':'neg')+'">'+fmt(d.target12Buy)+'</span>';
    else if(isSell) t12H='<span class="'+(d.achieve12Sell?'neg':'pos')+'">'+fmt(d.target12Sell)+'</span>';
    let achH='<span class="t-na">—</span>';
    if(isBuy) achH=d.achieve12Buy?'<span class="t-yes">✓ YES</span>':'<span class="t-no">✗ NO</span>';
    else if(isSell) achH=d.achieve12Sell?'<span class="t-yes">✓ YES</span>':'<span class="t-no">✗ NO</span>';
    const aMap={yes:'<span class="align-yes">✓ Aligned</span>',no:'<span class="align-no">✗ Against</span>',na:'<span class="align-na">—</span>'};
    const proxVal=Math.min(d.distPdh,d.distPdl);
    const barW=Math.max(3,Math.round((1-proxVal/threshold)*55));
    const barC=d.distPdh<d.distPdl?'var(--red)':'var(--green)';
    return '<tr><td class="sym">'+d.symbol+'</td><td class="mono">'+fmt(d.ltp)+'</td><td class="'+chgCls+'">'+chgSign+d.chgPct+'%</td><td class="mono">'+fmt(d.pdh)+'</td><td class="mono">'+fmt(d.pdl)+'</td><td><div class="sigs">'+sigs.join('')+'</div></td><td>'+slH+'</td><td>'+t12H+'</td><td>'+achH+'</td><td>'+aMap[d.trendAlign]+'</td><td><div class="prox"><div class="prox-bg"><div class="prox-fill" style="width:'+barW+'px;background:'+barC+';"></div></div><span class="prox-txt">'+proxVal.toFixed(2)+'%</span></div></td></tr>';
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
    console.error('Nifty trend error:', e.message, e.response?.status, JSON.stringify(e.response?.data));
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

// ── Get last trading day date
function getLastTradingDay() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  // If weekend, go back to Friday
  if (day === 0) ist.setDate(ist.getDate() - 2); // Sunday -> Friday
  if (day === 6) ist.setDate(ist.getDate() - 1); // Saturday -> Friday
  // If before market open on weekday, go back one more day
  const mins = ist.getHours() * 60 + ist.getMinutes();
  if (day >= 1 && day <= 5 && mins < 9 * 60 + 15) {
    ist.setDate(ist.getDate() - (day === 1 ? 3 : 1)); // Monday -> Friday, else previous day
  }
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Fetch intraday candles and detect signals
async function fetchSignals(instrumentKey, pdh, pdl) {
  try {
    const key = encodeURIComponent(instrumentKey);
    let candles = null;

    // Try live intraday first
    try {
      const data = await upGet(`/historical-candle/intraday/${key}/1minute`);
      if (data.data?.candles && data.data.candles.length >= 3) {
        candles = data.data.candles;
      }
    } catch(e) {}

    // If no live data (market closed/weekend), use last trading day's 1-min data
    if (!candles) {
      try {
        const lastDay = getLastTradingDay();
        const fromDate = lastDay;
        const toDate = lastDay;
        const data = await upGet(`/historical-candle/${key}/1minute/${toDate}/${fromDate}`);
        if (data.data?.candles && data.data.candles.length >= 3) {
          candles = data.data.candles;
        }
      } catch(e) {}
    }

    if (!candles || candles.length < 3) {
      return { sweepBuy: false, sweepSell: false, breakBuy: false, breakSell: false };
    }

    const raw = [...candles].reverse();
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
    console.log(`Fetching quotes for ${instrumentKeys.length} stocks...`);
    for (let i = 0; i < instrumentKeys.length; i += BATCH) {
      const batch = instrumentKeys.slice(i, i + BATCH);
      const keys = batch.join(',');
      try {
        const data = await upGet(`/market-quote/quotes?instrument_key=${encodeURIComponent(keys)}`);
        if (data.data) {
          Object.assign(allQuotes, data.data);
          console.log(`Batch ${i/BATCH + 1}: got ${Object.keys(data.data).length} quotes`);
        } else {
          console.error(`Batch ${i/BATCH + 1} error:`, JSON.stringify(data));
        }
      } catch (e) { console.error('Batch quote error:', e.message, e.response?.data); }
      if (i + BATCH < instrumentKeys.length) await new Promise(r => setTimeout(r, 300));
    }
    console.log(`Total quotes received: ${Object.keys(allQuotes).length}`);

    // Process each stock - fetch PDH/PDL in parallel batches of 5
    const baseStocks = [];
    // Upstox returns keys as "NSE_EQ:SYMBOL" format
    const actualKeys = Object.keys(allQuotes);
    if (actualKeys.length > 0) console.log('Upstox key format:', actualKeys[0]);
    for (const instrKey of instrumentKeys) {
      const symbol = SYMBOL_MAP[instrKey] || '';
      // Upstox returns "NSE_EQ:SYMBOL" format
      const upstoxKey = `NSE_EQ:${symbol}`;
      const q = allQuotes[upstoxKey] ||
                allQuotes[instrKey.replace('|', ':')] ||
                Object.values(allQuotes).find(v => v.symbol === symbol);
      if (!q) continue;
      const ltp = q.last_price;
      const netChg = q.net_change || 0;
      const prevClose = netChg !== 0 ? ltp - netChg : ltp;
      const chgPct = prevClose > 0 ? (netChg / prevClose * 100) : 0;
      const open = q.ohlc?.open || ltp;
      const gapPct = prevClose > 0 ? ((open - prevClose) / prevClose * 100) : 0;
      baseStocks.push({ instrKey, symbol, ltp, chgPct, prevClose, open, gapPct });
    }

    console.log(`Processing ${baseStocks.length} stocks for PDH/PDL...`);

    // Fetch PDH/PDL in parallel batches of 5
    const stocks = [];
    const PDHL_BATCH = 5;
    for (let i = 0; i < baseStocks.length; i += PDHL_BATCH) {
      const batch = baseStocks.slice(i, i + PDHL_BATCH);
      const results = await Promise.allSettled(batch.map(async (s) => {
        const pdhl = await fetchPDHL(s.instrKey);
        if (!pdhl) return null;
        const { pdh, pdl } = pdhl;
        const signals = await fetchSignals(s.instrKey, pdh, pdl);
        const slBuy = pdl - SL_BUFFER;
        const slSell = pdh + SL_BUFFER;
        const target12Buy = s.ltp + (s.ltp - slBuy) * 2;
        const target12Sell = s.ltp - (slSell - s.ltp) * 2;
        const distPdh = Math.abs((s.ltp - pdh) / pdh * 100);
        const distPdl = Math.abs((s.ltp - pdl) / pdl * 100);
        return {
          symbol: s.symbol,
          ltp: parseFloat(s.ltp.toFixed(2)),
          chgPct: parseFloat(s.chgPct.toFixed(2)),
          pdh: parseFloat(pdh.toFixed(2)),
          pdl: parseFloat(pdl.toFixed(2)),
          distPdh: parseFloat(distPdh.toFixed(2)),
          distPdl: parseFloat(distPdl.toFixed(2)),
          ...signals,
          slBuy: parseFloat(slBuy.toFixed(2)),
          slSell: parseFloat(slSell.toFixed(2)),
          target12Buy: parseFloat(target12Buy.toFixed(2)),
          target12Sell: parseFloat(target12Sell.toFixed(2)),
          achieve12Buy: target12Buy < pdh,
          achieve12Sell: target12Sell > pdl,
        };
      }));
      results.forEach(r => { if (r.status === 'fulfilled' && r.value) stocks.push(r.value); });
      console.log(`PDH/PDL batch ${Math.floor(i/PDHL_BATCH)+1} done, total so far: ${stocks.length}`);
      if (i + PDHL_BATCH < baseStocks.length) await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Final stock count: ${stocks.length}`);
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

// Debug endpoint - returns raw quote keys from Upstox
app.get('/api/debug', async (req, res) => {
  try {
    const testKey = 'NSE_EQ|INE002A01018'; // RELIANCE
    const data = await upGet(`/market-quote/quotes?instrument_key=${encodeURIComponent(testKey)}`);
    const keys = Object.keys(data.data || {});
    const sample = keys.length > 0 ? data.data[keys[0]] : null;
    res.json({ 
      rawKeys: keys, 
      sampleFields: sample ? Object.keys(sample) : [],
      sampleData: sample,
      requestedKey: testKey
    });
  } catch(e) {
    res.json({ error: e.message, stack: e.stack });
  }
});

app.get('/api/stocks', async (req, res) => {
  try {
    // Always fetch if cache is empty, regardless of market hours
    if (!cachedData.lastUpdated || cachedData.stocks.length === 0) {
      const [stocks, niftyTrend] = await Promise.all([
        fetchAllStocks('NIFTY50'),
        fetchNiftyTrend()
      ]);
      cachedData = { stocks, niftyTrend, lastUpdated: new Date().toISOString() };
    }
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
  // Force refresh regardless of market hours
  console.log('Force refresh triggered...');
  const [stocks, niftyTrend] = await Promise.all([
    fetchAllStocks('NIFTY50'),
    fetchNiftyTrend()
  ]);
  cachedData = { stocks, niftyTrend, lastUpdated: new Date().toISOString() };
  console.log(`Force refresh done: ${stocks.length} stocks`);
  res.json({ success: true, stocks: cachedData.stocks.length });
});

// New endpoint: force fetch and return data in one call
app.get('/api/refresh-and-get', async (req, res) => {
  try {
    console.log('Override fetch triggered...');
    const [stocks, niftyTrend] = await Promise.all([
      fetchAllStocks('NIFTY50'),
      fetchNiftyTrend()
    ]);
    cachedData = { stocks, niftyTrend, lastUpdated: new Date().toISOString() };
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

// Schedule refresh every 3 minutes during market hours
cron.schedule('*/3 * * * *', refreshCache);

app.listen(PORT, () => {
  console.log(`Screener backend running on port ${PORT}`);
  accessToken = process.env.UPSTOX_ACCESS_TOKEN || '';
  if (isMarketOpen()) refreshCache();
});
