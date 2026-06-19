/*
 * MidasQuote Dashboard v1.0
 * Shop owner backend panel
 * Loads based on Memberstack member's shopToken
 */

(function () {

  const CONFIG = {
      AIRTABLE_TOKEN:     'patBtaoCbxqqQzRId.4342548ea07fbac4e5998244a4eaa09db09e9ab6494efb175664bd1f9e0462b3',
    BASE_ID:            'app4zrMlVLwF2xn4h',
    SHOPS_TABLE:        'tbl8PoF2Mu3sAdlMs',
    PRICING_TABLE:      'tblu6AYZs8h7SIaQl',
    SPECIALTY_TABLE:    'tbloaXeEM5K7TOZCD',
    LEADS_TABLE:        'tblPcoTI8zCCHLICi',
    LINE_ITEMS_TABLE:   'tblCkJsJ2OC6DgXok',
    RESEND_API_KEY:     're_bkjuB6kc_HvraLCVCJntfLMjVBEjEkWuV',
    EMAIL_WORKER:       'https://midasquote-email.jordan132001.workers.dev',
    FROM_EMAIL:         'quotes@midasquote.com',
  };

  const AT_BASE = `https://api.airtable.com/v0/${CONFIG.BASE_ID}`;
  const AT_HEADS = { 'Authorization': `Bearer ${CONFIG.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

  async function atGet(table, formula) {
    const url = `${AT_BASE}/${table}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=100`;
    const res = await fetch(url, { headers: AT_HEADS });
    const data = await res.json();
    return data.records || [];
  }

  async function atUpdate(table, id, fields) {
    const res = await fetch(`${AT_BASE}/${table}/${id}`, {
      method: 'PATCH', headers: AT_HEADS,
      body: JSON.stringify({ fields })
    });
    return await res.json();
  }

  async function atCreate(table, fields) {
    const res = await fetch(`${AT_BASE}/${table}`, {
      method: 'POST', headers: AT_HEADS,
      body: JSON.stringify({ fields })
    });
    return await res.json();
  }

  async function atDelete(table, id) {
    const res = await fetch(`${AT_BASE}/${table}/${id}`, {
      method: 'DELETE', headers: AT_HEADS
    });
    return await res.json();
  }

  function fmt(n) { return '$' + Math.round(n || 0).toLocaleString(); }
  function gv(id) { const e = document.getElementById(id); return e ? e.value : ''; }
  function gn(id, d = 0) { const v = parseFloat(gv(id)); return isNaN(v) ? d : v; }
  function el(id) { return document.getElementById(id); }
  function show(id) { const e = el(id); if (e) e.style.display = 'block'; }
  function hide(id) { const e = el(id); if (e) e.style.display = 'none'; }
  function showMsg(id, msg, type = 'success') {
    const e = el(id);
    if (!e) return;
    e.textContent = msg;
    e.className = `mq-msg mq-msg-${type}`;
    e.style.display = 'block';
    setTimeout(() => { e.style.display = 'none'; }, 3000);
  }

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      #midasquote-dashboard *{box-sizing:border-box;margin:0;padding:0}
      #midasquote-dashboard{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;min-height:100vh;width:100vw;position:relative;left:50%;right:50%;margin-left:-50vw;margin-right:-50vw}
      #midasquote-dashboard .mq-topbar{background:#fff;border-bottom:1px solid #e5e7eb;padding:0 2rem;display:flex;align-items:center;justify-content:space-between;height:60px;position:sticky;top:0;z-index:100}
      #midasquote-dashboard .mq-topbar-brand{font-size:16px;font-weight:700;color:#111;display:flex;align-items:center;gap:8px}
      #midasquote-dashboard .mq-topbar-shop{font-size:13px;color:#6b7280}
      #midasquote-dashboard .mq-topbar-actions{display:flex;align-items:center;gap:12px}
      #midasquote-dashboard .mq-btn{padding:8px 16px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer;border:1px solid #e5e7eb;background:#fff;color:#111;font-family:inherit;transition:all 0.15s}
      #midasquote-dashboard .mq-btn:hover{background:#f9fafb}
      #midasquote-dashboard .mq-btn-primary{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
      #midasquote-dashboard .mq-btn-primary:hover{opacity:0.88;background:#1a1a1a}
      #midasquote-dashboard .mq-btn-danger{background:#fff;color:#dc2626;border-color:#fca5a5}
      #midasquote-dashboard .mq-btn-danger:hover{background:#fef2f2}
      #midasquote-dashboard .mq-btn-sm{padding:5px 10px;font-size:12px}
      #midasquote-dashboard .mq-layout{display:flex;min-height:calc(100vh - 60px);width:100%}
      #midasquote-dashboard .mq-sidebar{width:220px;background:#fff;border-right:1px solid #e5e7eb;padding:1.5rem 0;flex-shrink:0}
      #midasquote-dashboard .mq-nav-item{display:flex;align-items:center;gap:10px;padding:11px 1.5rem;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;transition:all 0.15s;border-left:3px solid transparent}
      #midasquote-dashboard .mq-nav-item:hover{color:#111;background:#f9fafb}
      #midasquote-dashboard .mq-nav-item.active{color:#111;background:#f9fafb;border-left-color:#1a1a1a}
      #midasquote-dashboard .mq-nav-icon{font-size:16px;width:20px;text-align:center}
      #midasquote-dashboard .mq-nav-section{font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;padding:1.25rem 1.5rem 0.5rem}
      #midasquote-dashboard .mq-content{flex:1;padding:2.5rem;overflow-y:visible}
      #midasquote-dashboard .mq-page{display:none}
      #midasquote-dashboard .mq-page.active{display:block}
      #midasquote-dashboard .mq-page-title{font-size:22px;font-weight:700;color:#111;margin-bottom:6px}
      #midasquote-dashboard .mq-page-sub{font-size:13px;color:#6b7280;margin-bottom:2rem}
      #midasquote-dashboard .mq-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.75rem;margin-bottom:1.5rem}
      #midasquote-dashboard .mq-card-title{font-size:13px;font-weight:600;color:#111;margin-bottom:1rem;display:flex;align-items:center;gap:8px}
      #midasquote-dashboard .mq-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}
      #midasquote-dashboard .mq-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem}
      #midasquote-dashboard .mq-field{display:flex;flex-direction:column;gap:5px}
      #midasquote-dashboard .mq-label{font-size:12px;font-weight:500;color:#374151}
      #midasquote-dashboard .mq-hint{font-size:11px;color:#9ca3af;margin-top:2px}
      #midasquote-dashboard input[type=text],#midasquote-dashboard input[type=email],#midasquote-dashboard input[type=tel],#midasquote-dashboard input[type=number],#midasquote-dashboard input[type=url],#midasquote-dashboard select,#midasquote-dashboard textarea{font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;width:100%}
      #midasquote-dashboard input:focus,#midasquote-dashboard select:focus,#midasquote-dashboard textarea:focus{outline:none;border-color:#1a1a1a}
      #midasquote-dashboard textarea{resize:vertical;min-height:80px}
      #midasquote-dashboard .mq-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1.25rem;margin-bottom:2rem}
      #midasquote-dashboard .mq-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem}
      #midasquote-dashboard .mq-stat-val{font-size:26px;font-weight:700;color:#111;margin-bottom:6px}
      #midasquote-dashboard .mq-stat-lbl{font-size:12px;color:#6b7280;font-weight:500}
      #midasquote-dashboard .mq-stat-green .mq-stat-val{color:#16a34a}
      #midasquote-dashboard .mq-table{width:100%;border-collapse:collapse}
      #midasquote-dashboard .mq-table th{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:left}
      #midasquote-dashboard .mq-table td{font-size:13px;padding:12px 16px;border-bottom:1px solid #f3f4f6;color:#111}
      #midasquote-dashboard .mq-table tr:last-child td{border-bottom:none}
      #midasquote-dashboard .mq-table tr:hover td{background:#f9fafb}
      #midasquote-dashboard .mq-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
      #midasquote-dashboard .mq-badge-green{background:#dcfce7;color:#166534}
      #midasquote-dashboard .mq-badge-blue{background:#dbeafe;color:#1e40af}
      #midasquote-dashboard .mq-badge-yellow{background:#fef9c3;color:#854d0e}
      #midasquote-dashboard .mq-badge-red{background:#fee2e2;color:#991b1b}
      #midasquote-dashboard .mq-badge-grey{background:#f3f4f6;color:#6b7280}
      #midasquote-dashboard .mq-embed-box{background:#1a1a1a;border-radius:8px;padding:1rem;font-family:monospace;font-size:12px;color:#a3e635;line-height:1.6;position:relative;margin-top:1rem;word-break:break-all}
      #midasquote-dashboard .mq-copy-btn{position:absolute;top:8px;right:8px;background:#374151;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit}
      #midasquote-dashboard .mq-copy-btn:hover{background:#4b5563}
      #midasquote-dashboard .mq-spec-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6}
      #midasquote-dashboard .mq-spec-row:last-child{border-bottom:none}
      #midasquote-dashboard .mq-spec-name{flex:1;font-size:13px;color:#111}
      #midasquote-dashboard .mq-spec-price{width:100px}
      #midasquote-dashboard .mq-msg{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:1rem;display:none}
      #midasquote-dashboard .mq-msg-success{background:#dcfce7;color:#166534;border:1px solid #86efac}
      #midasquote-dashboard .mq-msg-error{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
      #midasquote-dashboard .mq-loading{text-align:center;padding:3rem;color:#6b7280;font-size:14px}
      #midasquote-dashboard .mq-divider{height:1px;background:#e5e7eb;margin:1.5rem 0}
      #midasquote-dashboard .mq-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0}
      #midasquote-dashboard .mq-toggle{width:40px;height:22px;background:#d1d5db;border-radius:11px;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0}
      #midasquote-dashboard .mq-toggle.on{background:#1a1a1a}
      #midasquote-dashboard .mq-toggle::after{content:'';position:absolute;width:18px;height:18px;background:#fff;border-radius:50%;top:2px;left:2px;transition:left 0.2s}
      #midasquote-dashboard .mq-toggle.on::after{left:20px}
      #midasquote-dashboard .mq-empty{text-align:center;padding:3rem;color:#9ca3af;font-size:14px}
      #midasquote-dashboard .mq-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}

      @media (max-width: 768px) {
        #midasquote-dashboard .mq-layout{flex-direction:column}
        #midasquote-dashboard .mq-sidebar{width:100%;padding:0.5rem 0;display:flex;overflow-x:auto;border-right:none;border-bottom:1px solid #e5e7eb;-webkit-overflow-scrolling:touch}
        #midasquote-dashboard .mq-nav-section{display:none}
        #midasquote-dashboard .mq-nav-item{flex-shrink:0;border-left:none;border-bottom:3px solid transparent;padding:10px 14px;white-space:nowrap}
        #midasquote-dashboard .mq-nav-item.active{border-left-color:transparent;border-bottom-color:#1a1a1a}
        #midasquote-dashboard .mq-content{padding:1.25rem}
        #midasquote-dashboard .mq-topbar{padding:0 1rem;flex-wrap:wrap;height:auto;min-height:60px}
        #midasquote-dashboard .mq-topbar-brand{font-size:14px}
        #midasquote-dashboard .mq-card{padding:1.25rem}
        #midasquote-dashboard .mq-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        #midasquote-dashboard .mq-table{min-width:560px}
      }
    `;
    document.head.appendChild(s);
  }

window.logoutMember = async function () {
  try {
    await window.$memberstackDom.logout();

    // Change this if your login page URL is different
    window.location.href = "/login";
  } catch (err) {
    console.error("Logout failed:", err);
    alert("Logout failed. Please refresh and try again.");
  }
};

  function buildHTML(shop) {
    const token = shop['Shop token'] || '';
    const embedCode = '&lt;div id="midasquote-widget"&gt;&lt;/div&gt;\n&lt;script src="https://widget.midasquote.com/widget.js?shop=' + token + '"&gt;&lt;/script&gt;';
    window._mqRawEmbedCode = '<div id="midasquote-widget"></div>\n<scr' + 'ipt src="https://widget.midasquote.com/widget.js?shop=' + token + '"></scr' + 'ipt>';

    return `
      <div class="mq-topbar">
        <div>
          <div class="mq-topbar-brand">⚡ MidasQuote</div>
          <div class="mq-topbar-shop">${shop['Shop name'] || 'My Shop'}</div>
        </div>
        <div class="mq-topbar-actions">
          <button class="mq-btn mq-btn-sm" onclick="window.open('https://widget.midasquote.com/?shop=${token}','_blank')">Preview widget ↗</button>
          <button 
  type="button"
  class="mq-btn mq-btn-sm"
  onclick="logoutMember()">
  Log out
</button>
        </div>
      </div>

      <div class="mq-layout">
        <div class="mq-sidebar">
          <div class="mq-nav-section">Overview</div>
          <div class="mq-nav-item active" onclick="mqNav('overview',this)"><span class="mq-nav-icon">📊</span> Dashboard</div>
          <div class="mq-nav-item" onclick="mqNav('leads',this)"><span class="mq-nav-icon">👥</span> Leads</div>
          <div class="mq-nav-section">Setup</div>
          <div class="mq-nav-item" onclick="mqNav('shop',this)"><span class="mq-nav-icon">🏪</span> Shop info</div>
          <div class="mq-nav-item" onclick="mqNav('pricing',this)"><span class="mq-nav-icon">💰</span> Pricing</div>
          <div class="mq-nav-item" onclick="mqNav('specialty',this)"><span class="mq-nav-icon">⭐</span> Specialty items</div>
          <div class="mq-nav-item" onclick="mqNav('embed',this)"><span class="mq-nav-icon">🔗</span> Embed code</div>
          <div class="mq-nav-item" onclick="mqNav('products',this)"><span class="mq-nav-icon">📦</span> My Products</div>
          <div class="mq-nav-item" onclick="mqNav('billing',this)"><span class="mq-nav-icon">💳</span> Billing</div>
          <div class="mq-nav-item" onclick="mqNav('marketing',this)"><span class="mq-nav-icon">📣</span> Marketing Kit</div>
        </div>

        <div class="mq-content">

          <!-- OVERVIEW -->
          <div class="mq-page active" id="mq-page-overview">
            <div class="mq-page-title">Welcome back 👋</div>
            <div class="mq-page-sub">Here's what's happening with your widget</div>
            <div class="mq-stat-grid" id="mq-stats">
              <div class="mq-stat"><div class="mq-stat-val" id="mq-stat-leads">—</div><div class="mq-stat-lbl">Total leads</div></div>
              <div class="mq-stat mq-stat-green"><div class="mq-stat-val" id="mq-stat-new">—</div><div class="mq-stat-lbl">New this week</div></div>
              <div class="mq-stat"><div class="mq-stat-val" id="mq-stat-booked">—</div><div class="mq-stat-lbl">Booked</div></div>
              <div class="mq-stat"><div class="mq-stat-val" id="mq-stat-value">—</div><div class="mq-stat-lbl">Est. pipeline value</div></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">📋 Recent leads</div>
              <div id="mq-recent-leads"><div class="mq-loading">Loading leads...</div></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">🔗 Your widget embed code</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:8px">Copy and paste this into your website where you want the widget to appear.</p>
              <div class="mq-embed-box" id="mq-embed-preview"><span>${embedCode}</span><button class="mq-copy-btn" id="mq-copy-embed-1">Copy</button></div>
            </div>
          </div>

          <!-- LEADS -->
          <div class="mq-page" id="mq-page-leads">
            <div class="mq-section-header">
              <div>
                <div class="mq-page-title">Leads</div>
                <div class="mq-page-sub">All quote requests from your widget</div>
              </div>
              <select id="mq-lead-filter" onchange="mqFilterLeads()" style="font-size:13px;padding:6px 10px;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit">
                <option value="">All leads</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Booked">Booked</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
            <div id="mq-leads-msg"></div>
            <div style="margin-bottom:1rem;text-align:right">
              <button class="mq-btn mq-btn-danger mq-btn-sm" onclick="mqDeleteAllLeads()">🗑️ Clear all leads</button>
            </div>
            <div class="mq-card" style="padding:0;overflow:hidden">
              <div id="mq-leads-table"><div class="mq-loading">Loading leads...</div></div>
            </div>
          </div>

          <!-- SHOP INFO -->
          <div class="mq-page" id="mq-page-shop">
            <div class="mq-page-title">Shop info</div>
            <div class="mq-page-sub">This info appears on your widget and in emails to customers</div>
            <div class="mq-card">
              <div id="mq-shop-msg"></div>
              <div class="mq-grid2" style="margin-bottom:1rem">
                <div class="mq-field"><label class="mq-label">Shop name</label><input type="text" id="mq-shop-name"/></div>
                <div class="mq-field"><label class="mq-label">Phone number</label><input type="tel" id="mq-shop-phone"/></div>
                <div class="mq-field"><label class="mq-label">City</label><input type="text" id="mq-shop-city"/></div>
                <div class="mq-field"><label class="mq-label">Website URL</label><input type="url" id="mq-shop-website"/></div>
                <div class="mq-field"><label class="mq-label">Lead notify email</label><input type="email" id="mq-shop-email"/><span class="mq-hint">Where new lead notifications go</span></div>
                <div class="mq-field"><label class="mq-label">Brand colour</label><input type="text" id="mq-shop-color" placeholder="#1a1a1a"/><span class="mq-hint">Hex code for widget buttons</span></div>
              </div>
              <div class="mq-grid2" style="margin-bottom:1rem">
                <div class="mq-field">
                  <label class="mq-label">Quote range — low (% below estimate)</label>
                  <input type="number" id="mq-shop-range-low" placeholder="10" min="0" max="50"/>
                  <span class="mq-hint">Default 10 — quote shows up to 10% below your estimate</span>
                </div>
                <div class="mq-field">
                  <label class="mq-label">Quote range — high (% above estimate)</label>
                  <input type="number" id="mq-shop-range-high" placeholder="15" min="0" max="50"/>
                  <span class="mq-hint">Default 15 — quote shows up to 15% above your estimate</span>
                </div>
              </div>
              <div class="mq-field" style="margin-bottom:1rem">
                <label class="mq-label">Logo URL</label>
                <input type="url" id="mq-shop-logo" placeholder="https://yoursite.com/logo.png"/>
                <span class="mq-hint">Direct link to your logo image — appears in the widget header</span>
              </div>
              <div class="mq-field" style="margin-bottom:1.5rem">
                <label class="mq-label">Disclaimer text</label>
                <textarea id="mq-shop-disclaimer" placeholder="Ballpark estimate only. Contact us for a full quote."></textarea>
                <span class="mq-hint">Shown at the bottom of every quote</span>
              </div>
              <div class="mq-field" style="margin-bottom:1rem">
                <label class="mq-label">"Book a consultation" link <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
                <input type="url" id="mq-shop-consult-link" placeholder="https://yoursite.com/contact"/>
                <span class="mq-hint">If set, the widget's "Book a consultation" button opens this page in a new tab instead of the default contact form</span>
              </div>
              <div class="mq-field" style="margin-bottom:1.5rem">
                <label class="mq-label">Or, consultation email <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
                <input type="email" id="mq-shop-consult-email" placeholder="sales@yourshop.com"/>
                <span class="mq-hint">Used only if no link is set above — opens a pre-filled email instead</span>
              </div>
              <div class="mq-toggle-row" style="margin-bottom:1.5rem">
                <div>
                  <div style="font-size:13px;font-weight:500;color:#111">Show "View our products" link on widget</div>
                  <div style="font-size:12px;color:#6b7280;margin-top:2px">Customers can browse your showroom before getting a quote</div>
                </div>
                <div class="mq-toggle on" id="mq-showroom-toggle" onclick="mqToggleShowroom()"></div>
              </div>
              <button class="mq-btn mq-btn-primary" onclick="mqSaveShop()">Save shop info</button>
            </div>
          </div>

          <!-- PRICING -->
          <div class="mq-page" id="mq-page-pricing">
            <div id="mq-pricing-helper-v2"></div>
          </div>

          <!-- SPECIALTY ITEMS -->
          <div class="mq-page" id="mq-page-specialty">
            <div class="mq-section-header">
              <div>
                <div class="mq-page-title">Specialty items</div>
                <div class="mq-page-sub">Add-ons that appear as options in your widget</div>
              </div>
              <button class="mq-btn mq-btn-primary mq-btn-sm" onclick="mqAddSpecItem()">+ New item</button>
              <button class="mq-btn mq-btn-sm" onclick="mqSaveAllSpecItems()" style="margin-left:6px">💾 Save all</button>
            </div>
            <div id="mq-spec-msg"></div>
            <div class="mq-card" style="padding:0;overflow:hidden">
              <div id="mq-spec-list"><div class="mq-loading">Loading specialty items...</div></div>
            </div>
          </div>

          <!-- EMBED CODE -->
          <div class="mq-page" id="mq-page-embed">
            <div class="mq-page-title">Embed code</div>
            <div class="mq-page-sub">Paste this code into your website where you want the widget to appear</div>
            <div class="mq-card">
              <div class="mq-card-title">📋 Your embed code</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Copy the code below and paste it into your website's HTML where you want the quote widget to appear. Works on Wix, Squarespace, WordPress, Webflow, GoDaddy and any custom site.</p>
              <div class="mq-embed-box"><span>${embedCode}</span><button class="mq-copy-btn" id="mq-copy-embed-2">Copy</button></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">📱 Shop mode</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Use this link to pull up the widget on your phone or tablet for walk-in customers. No lead capture — just the quote tool.</p>
              <div class="mq-embed-box">https://widget.midasquote.com/?shop=${token}&mode=shop<button class="mq-copy-btn" onclick="mqCopyText('https://widget.midasquote.com/?shop=${token}&mode=shop',this)">Copy</button></div>
            </div>
            <div class="mq-card">
              <div class="mq-card-title">💡 Installation help</div>
              <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;color:#374151;line-height:1.6">
                <div><strong>Wix:</strong> Add → Embed → Embed a Widget → paste your code</div>
                <div><strong>Squarespace:</strong> Edit page → Add block → Code → paste your code</div>
                <div><strong>WordPress:</strong> Add block → Custom HTML → paste your code</div>
                <div><strong>Webflow:</strong> Add element → Embed → paste your code</div>
                <div><strong>Need help?</strong> Email <a href="mailto:hello@midasquote.com" style="color:#1a1a1a">hello@midasquote.com</a></div>
              </div>
            </div>
          </div>

          <!-- MY PRODUCTS -->
          <div class="mq-page" id="mq-page-products">
            <div class="mq-page-title">My Products</div>
            <div class="mq-page-sub">Add photos to your materials and options — these appear on your customer showroom page</div>
            <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem;font-size:13px;color:#92400e;line-height:1.7">
              <strong>💡 How to add a photo URL:</strong><br>
              <strong>Option 1 —</strong> Find a photo on your website, Facebook, or anywhere online. Right-click the image → <em>"Copy image address"</em> → paste it in the box below.<br>
              <strong>Option 2 —</strong> Upload your own photo for free at <a href="https://imgbb.com" target="_blank" style="color:#92400e;font-weight:600">imgbb.com</a> — upload, then copy the "Direct link" and paste it below.<br>
              <strong>Option 3 —</strong> Click <em>"📷 Choose from library"</em> to pick from our curated cabinet & countertop photo collection.
            </div>
            <div id="mq-products-msg"></div>
            <div id="mq-products-content"><div class="mq-loading">Loading your products...</div></div>
            <div class="mq-card" style="margin-top:1rem">
              <div class="mq-card-title">🔗 Your showroom link</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Share this with customers so they can browse your products before getting a quote.</p>
              <div class="mq-embed-box"><span id="mq-showroom-link-text"></span><button class="mq-copy-btn" id="mq-showroom-copy-btn">Copy</button></div>
              <button class="mq-btn" style="margin-top:10px" id="mq-showroom-open-btn">Open showroom ↗</button>
            </div>
          </div>

          <!-- BILLING -->
          <div class="mq-page" id="mq-page-billing">
            <div class="mq-page-title">Billing</div>
            <div class="mq-page-sub">Manage your subscription, payment method, and invoices</div>

            <div class="mq-card" style="margin-bottom:1rem">
              <div class="mq-card-title">📋 Current plan</div>
              <div id="mq-billing-plan" style="font-size:14px;color:#6b7280;margin-bottom:1.25rem">Loading plan info...</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="mq-btn mq-btn-primary" onclick="mqOpenBillingPortal()">Manage plan</button>
                <button class="mq-btn" onclick="mqUpgradeToAnnual()">Upgrade to annual</button>
              </div>
            </div>

            <div class="mq-card" style="margin-bottom:1rem">
              <div class="mq-card-title">💳 Payment method</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Update your credit card or billing details.</p>
              <button class="mq-btn" onclick="mqOpenBillingPortal()">Update payment method</button>
            </div>

            <div class="mq-card" style="margin-bottom:1rem">
              <div class="mq-card-title">🧾 Invoices</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">View and download your past invoices.</p>
              <button class="mq-btn" onclick="mqOpenBillingPortal()">View invoices</button>
            </div>

            <div class="mq-card" style="border-color:#fca5a5">
              <div class="mq-card-title" style="color:#dc2626">⚠️ Cancel subscription</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:6px;line-height:1.6">We're sorry to see you go. You can cancel at any time — your widget stays active until the end of your current billing period.</p>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem;line-height:1.6">Your leads and pricing data will be available for 30 days after cancellation.</p>
              <button class="mq-btn mq-btn-danger" onclick="mqOpenBillingPortal()">Cancel subscription</button>
            </div>
          </div>

          <!-- MARKETING KIT -->
          <div class="mq-page" id="mq-page-marketing">
            <div class="mq-page-title">Marketing Kit</div>
            <div class="mq-page-sub">Ready-made copy to help you promote your new quote widget — personalized with your shop's link</div>

            <div class="mq-card">
              <div class="mq-card-title">📱 Social media posts</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Copy and paste these straight into Facebook or Instagram. Your quote link is already filled in.</p>
              <div id="mq-mk-social"></div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">🏷️ Headline options for your website</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Use one of these above your embedded widget.</p>
              <div id="mq-mk-headlines"></div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">💬 Direct message template</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem">Send this to past customers or leads who might have a future project.</p>
              <div id="mq-mk-dm"></div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">🎯 Quote page header</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">A clean intro section to place above your widget. Here's what it looks like:</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:0.5rem;margin-bottom:1.25rem">
                <div id="mq-mk-header-preview"></div>
              </div>
              <p style="font-size:12px;color:#9ca3af;margin-bottom:8px">Code to copy:</p>
              <div class="mq-embed-box"><span id="mq-mk-header-display"></span><button class="mq-copy-btn" id="mq-mk-header-copy">Copy</button></div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">✨ Trust bar for your website</div>
              <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Paste this code snippet directly above or below your widget embed code. Here's what it looks like:</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:1.5rem;margin-bottom:1.25rem">
                <div id="mq-mk-trustbar-preview"></div>
              </div>
              <p style="font-size:12px;color:#9ca3af;margin-bottom:8px">Code to copy:</p>
              <div class="mq-embed-box"><span id="mq-mk-trustbar-display"></span><button class="mq-copy-btn" id="mq-mk-trustbar-copy">Copy</button></div>
            </div>

            <div class="mq-card">
              <div class="mq-card-title">📍 Where to post</div>
              <div style="font-size:13px;color:#374151;line-height:2">
                ✓ Your website homepage or a dedicated "Get a Quote" page<br>
                ✓ Pin a post to the top of your Facebook Business Page<br>
                ✓ Local Facebook homeowner / renovation groups (check group rules first)<br>
                ✓ Instagram bio link<br>
                ✓ Google Business Profile — add to your website field or post an update<br>
                ✓ Email signature<br>
                ✓ A QR code sign for walk-in customers to scan in-store
              </div>
            </div>

            <div class="mq-card" style="border-color:#86efac;background:#f0fdf4">
              <div class="mq-card-title">✅ Pre-launch checklist</div>
              <div style="font-size:13px;color:#166534;line-height:2">
                ☐ Widget is embedded and tested on your site<br>
                ☐ Link works on both desktop and mobile<br>
                ☐ You've tried the quote flow yourself at least once<br>
                ☐ Your shop info (name, phone, logo) looks correct in the widget<br>
                ☐ You know new leads land in your Leads tab
              </div>
            </div>
          </div>

        </div>
      </div>
      <!-- Hidden Memberstack trigger for billing portal -->
      <a data-ms-modal="profile" data-ms-modal-tab="plans" href="#" id="mq-ms-plans-trigger" style="display:none">plans</a>
    `;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  window.mqUpgradeToAnnual = async function() {
    try {
      await window.$memberstackDom.purchasePlansWithCheckout({
        priceId: 'prc_midasquote-annual-0o2d0axt',
      });
    } catch(e) {
      console.error('Upgrade error:', e);
      alert('Unable to open upgrade checkout. Please email hello@midasquote.com to upgrade your plan.');
    }
  };

  window.mqOpenBillingPortal = async function() {
    try {
      // launchStripeCustomerPortal opens Stripe billing directly — cancel, update card, invoices all in one
      await window.$memberstackDom.launchStripeCustomerPortal({});
    } catch(e) {
      console.error('Billing portal error:', e);
      // Fallback to profile modal
      try { await window.$memberstackDom.openModal('PROFILE'); } catch(e2) {}
    }
  };

  window.mqLogout = function() {
    let attempts = 0;
    const tryLogout = async () => {
      if (window.$memberstackDom?.logout) {
        try { await window.$memberstackDom.logout(); window.location.reload(); }
        catch(e) { window.location.href = '/?ms-logout=true'; }
        return;
      }
      attempts++;
      if (attempts < 20) setTimeout(tryLogout, 250);
      else window.location.href = '/?ms-logout=true';
    };
    tryLogout();
  };

  window.mqNav = function(page, el) {
    document.querySelectorAll('#midasquote-dashboard .mq-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('#midasquote-dashboard .mq-page').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    const pageEl = document.getElementById('mq-page-' + page);
    if (pageEl) pageEl.classList.add('active');
  };

  // ============================================================
  // COPY HELPERS
  // ============================================================
  window.mqCopyEmbed = function(btn) {
    const code = window._mqRawEmbedCode || '';
    navigator.clipboard.writeText(code).then(() => {
      if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); }
    });
  };
  window.mqCopyText = function(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000); }
    });
  };

  // ============================================================
  // LOAD DATA
  // ============================================================
  async function loadShop(shopToken) {
    const shops = await atGet(CONFIG.SHOPS_TABLE, `{Shop token} = "${shopToken}"`);
    return shops.length ? shops[0] : null;
  }

  async function loadPricing(shopName) {
    const recs = await atGet(CONFIG.PRICING_TABLE, `FIND("${shopName}", ARRAYJOIN({Shop}))`);
    return recs.length ? recs[0] : null;
  }

  async function loadLeads(shopName) {
    const recs = await atGet(CONFIG.LEADS_TABLE, `FIND("${shopName}", ARRAYJOIN({Shop}))`);
    return recs;
  }

  async function loadSpecialty(shopName) {
    const recs = await atGet(CONFIG.SPECIALTY_TABLE, `FIND("${shopName}", ARRAYJOIN({Shop}))`);
    return recs.sort((a, b) => (a.fields['Sort order'] || 0) - (b.fields['Sort order'] || 0));
  }

  const DEFAULT_SPECIALTY_ITEMS = [
    { name:'Tall cabinets',              price:0,  perFt:false, sort:1  },
    { name:'Appliance garage',           price:0,  perFt:false, sort:2  },
    { name:'Blind corner solution',      price:0,  perFt:false, sort:3  },
    { name:'Double garbage pullout',     price:0,  perFt:false, sort:4  },
    { name:'Toe kick drawers',           price:0,  perFt:false, sort:5  },
    { name:'Lazy Susan',                 price:0,  perFt:false, sort:6  },
    { name:'Wine rack / cabinet',        price:0,  perFt:false, sort:7  },
    { name:'Spice rack',                 price:0,  perFt:false, sort:8  },
    { name:'Pull-out shelves',           price:0,  perFt:false, sort:9  },
    { name:'Pot drawers',                price:0,  perFt:false, sort:10 },
    { name:'Pantry unit',                price:0,  perFt:false, sort:11 },
    { name:'Desk / homework station',    price:0,  perFt:false, sort:12 },
    { name:'Glass door fronts',          price:0,  perFt:false, sort:13 },
    { name:'Undervalence lighting rail', price:0,  perFt:true,  sort:14 },
    { name:'Crown moulding',             price:0,  perFt:true,  sort:15 },
  ];

  async function ensureSpecialtyDefaults(shopRecord) {
    const shopName = shopRecord.fields['Shop name'];
    const existing = await atGet(CONFIG.SPECIALTY_TABLE, `FIND("${shopName}", ARRAYJOIN({Shop}))`);
    if (existing.length > 0) return existing;
    // New shop — create default list
    const created = [];
    for (const item of DEFAULT_SPECIALTY_ITEMS) {
      try {
        const rec = await atCreate(CONFIG.SPECIALTY_TABLE, {
          'Shop': [shopRecord.id],
          'Item name': item.name,
          'Special Items': item.name,
          'Price': item.price,
          'Per linear foot': item.perFt,
          'Active': true,
          'Sort order': item.sort,
        });
        if (rec?.id) created.push(rec);
      } catch(e) { console.warn('Failed to create default specialty item:', item.name, e); }
    }
    return created.sort((a,b) => (a.fields['Sort order']||0)-(b.fields['Sort order']||0));
  }

  // ============================================================
  // POPULATE FIELDS
  // ============================================================
  function populateShop(shop) {
    const f = shop.fields;
    const set = (id, val) => { const e = el(id); if (e) e.value = val || ''; };
    set('mq-shop-name', f['Shop name']);
    set('mq-shop-phone', f['Phone']);
    set('mq-shop-city', f['City']);
    set('mq-shop-website', f['Website']);
    set('mq-shop-email', f['Lead notify email']);
    set('mq-shop-color', f['Brand colour']);
    set('mq-shop-range-low',  f['Quote range low']  || '10');
    set('mq-shop-range-high', f['Quote range high'] || '15');
    set('mq-shop-logo', f['Logo URL']);
    set('mq-shop-disclaimer', f['Disclaimer text']);
    set('mq-shop-consult-link', f['Consultation link']);
    set('mq-shop-consult-email', f['Consultation email']);
    const toggle = el('mq-showroom-toggle');
    if (toggle) {
      const isOn = f['Show showroom'] !== false;
      toggle.classList.toggle('on', isOn);
    }
  }

  function populatePricing(pricing) {
    if (!pricing) return;
    const f = pricing.fields;
    const set = (id, val) => { const e = el(id); if (e && val !== undefined) e.value = val; };
    set('mq-p-melamine', f['Melamine price']);
    set('mq-p-plywood', f['Plywood price']);
    set('mq-p-mdf', f['MDF price']);
    set('mq-p-solid', f['Solid wood price']);
    set('mq-p-slab', f['Slab multiplier']);
    set('mq-p-shaker', f['Shaker multiplier']);
    set('mq-p-raised', f['Raised multiplier']);
    set('mq-p-glass', f['Glass multiplier']);
    set('mq-p-install', f['Install rate uppers']);
    set('mq-p-hinges', f['Soft close hinges']);
    set('mq-p-drawer', f['Birch drawer box']);
    set('mq-p-removal', f['Removal rate']);
    set('mq-p-lam', f['Lam supply']);
    set('mq-p-ss-econ', f['SS econ supply']);
    set('mq-p-ss-mid', f['SS mid supply']);
    set('mq-p-ss-prem', f['SS prem supply']);
    set('mq-p-gran-econ', f['Gran econ supply']);
    set('mq-p-gran-mid', f['Gran mid supply']);
    set('mq-p-gran-prem', f['Gran prem supply']);
    set('mq-p-quartz', f['Quartz supply']);
    set('mq-p-marble', f['Marble supply']);
    set('mq-p-butcher', f['Butcher supply']);
    set('mq-p-zone-radius', f['Local zone radius']);
    set('mq-p-zone2', f['Zone 2 surcharge']);
    set('mq-p-zone3', f['Zone 3 surcharge']);
    set('mq-p-zone4', f['Zone 4 surcharge']);
    set('mq-p-tax', f['Tax rate']);
    set('mq-p-backsplash', f['Backsplash rate']);
    set('mq-p-sink', f['Sink cutout']);
    set('mq-p-cooktop', f['Cooktop cutout']);
  }

  function renderLeads(leads, limit) {
    if (!leads.length) return '<div class="mq-empty">No leads yet — share your widget to start capturing quotes!</div>';
    const rows = (limit ? leads.slice(0, limit) : leads).map(r => {
      const f = r.fields;
      const statusColors = { New: 'blue', Contacted: 'yellow', Booked: 'green', Lost: 'red' };
      const color = statusColors[f['Status']] || 'grey';
      return `<tr>
        <td><strong>${f['Customer name'] || '—'}</strong></td>
        <td>${f['Customer email'] || '—'}</td>
        <td>${f['Customer phone'] || '—'}</td>
        <td>${f['Quote type'] || '—'}</td>
        <td>${f['Estimate low'] ? fmt(f['Estimate low']) + ' – ' + fmt(f['Estimate high']) : '—'}</td>
        <td><span class="mq-badge mq-badge-${color}">${f['Status'] || 'New'}</span></td>
        <td>
          <select onchange="mqUpdateLeadStatus('${r.id}', this.value)" style="font-size:11px;padding:3px 6px;border:1px solid #e5e7eb;border-radius:6px;font-family:inherit">
            <option ${f['Status']==='New'?'selected':''}>New</option>
            <option ${f['Status']==='Contacted'?'selected':''}>Contacted</option>
            <option ${f['Status']==='Booked'?'selected':''}>Booked</option>
            <option ${f['Status']==='Lost'?'selected':''}>Lost</option>
          </select>
        </td>
        <td><button class="mq-btn mq-btn-danger mq-btn-sm" onclick="mqDeleteLead('${r.id}')">Delete</button></td>
      </tr>`;
    }).join('');
    return `<div class="mq-table-wrap"><table class="mq-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Type</th><th>Estimate</th><th>Status</th><th>Update</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderStats(leads) {
    const total = leads.length;
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newThisWeek = leads.filter(r => new Date(r.fields['Created'] || r.createdTime) > oneWeekAgo).length;
    const booked = leads.filter(r => r.fields['Status'] === 'Booked').length;
    const pipeline = leads.reduce((sum, r) => sum + (r.fields['Estimate high'] || 0), 0);
    const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
    set('mq-stat-leads', total);
    set('mq-stat-new', newThisWeek);
    set('mq-stat-booked', booked);
    set('mq-stat-value', fmt(pipeline));
  }

  function renderSpecialty(specs, shopRecord) {
    const container = el('mq-spec-list');
    if (!container) return;
    if (!specs.length) {
      container.innerHTML = '<div class="mq-empty" style="padding:2rem">No specialty items yet. Click "+ Add item" to add your first one.</div>';
      return;
    }
    container.innerHTML = `
      <div class="mq-table-wrap">
      <table class="mq-table" id="mq-spec-table">
        <thead><tr><th></th><th>Item name</th><th>Price</th><th>Per lin ft?</th><th>Active</th><th></th></tr></thead>
        <tbody id="mq-spec-tbody">
          ${specs.map(r => `
            <tr data-id="${r.id}" style="cursor:grab">
              <td style="color:#9ca3af;font-size:16px;padding:8px 12px">⠿</td>
              <td><input type="text" value="${r.fields['Item name'] || ''}" id="mq-spec-name-${r.id}" style="border:none;background:none;font-size:13px;width:160px" onblur="mqSaveSpecField('${r.id}','Item name',this.value)"/></td>
              <td><input type="number" value="${r.fields['Price'] || ''}" id="mq-spec-price-${r.id}" style="width:80px" onblur="mqSaveSpecField('${r.id}','Price',parseFloat(this.value))"/></td>
              <td><input type="checkbox" ${r.fields['Per linear foot']?'checked':''} onchange="mqSaveSpecField('${r.id}','Per linear foot',this.checked)"/></td>
              <td><input type="checkbox" ${r.fields['Active']?'checked':''} onchange="mqSaveSpecField('${r.id}','Active',this.checked)"/></td>
              <td><button class="mq-btn mq-btn-danger mq-btn-sm" onclick="mqDeleteSpec('${r.id}')">Delete</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      </div>`;

    const tbody = document.getElementById('mq-spec-tbody');
    let dragging = null;

    tbody.querySelectorAll('tr').forEach(row => {
      row.draggable = true;
      row.addEventListener('dragstart', () => {
        dragging = row;
        setTimeout(() => row.style.opacity = '0.4', 0);
      });
      row.addEventListener('dragend', async () => {
        row.style.opacity = '1';
        dragging = null;
        const rows = [...tbody.querySelectorAll('tr')];
        for (let i = 0; i < rows.length; i++) {
          await atUpdate(CONFIG.SPECIALTY_TABLE, rows[i].dataset.id, { 'Sort order': i + 1 });
        }
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        const after = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        if (e.clientY < after) {
          tbody.insertBefore(dragging, row);
        } else {
          tbody.insertBefore(dragging, row.nextSibling);
        }
      });
    });
  }

  // ============================================================
  // SAVE FUNCTIONS
  // ============================================================
  window.mqToggleShowroom = function() {
    const toggle = el('mq-showroom-toggle');
    if (!toggle) return;
    toggle.classList.toggle('on');
    const isOn = toggle.classList.contains('on');
    const shopRec = window._mqShopRecord;
    if (shopRec) {
      atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, { 'Show showroom': isOn });
      shopRec.fields['Show showroom'] = isOn;
    }
  };

  window.mqSaveShop = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, {
        'Shop name':         gv('mq-shop-name'),
        'Phone':             gv('mq-shop-phone'),
        'City':              gv('mq-shop-city'),
        'Website':           gv('mq-shop-website'),
        'Lead notify email': gv('mq-shop-email'),
        'Brand colour':      gv('mq-shop-color'),
        'Quote range low':   gn('mq-shop-range-low',  10),
        'Quote range high':  gn('mq-shop-range-high', 15),
        'Logo URL':          gv('mq-shop-logo'),
        'Disclaimer text':   gv('mq-shop-disclaimer'),
        'Consultation link': gv('mq-shop-consult-link'),
        'Consultation email': gv('mq-shop-consult-email'),
      });
      showMsg('mq-shop-msg', '✓ Shop info saved!');
    } catch(e) { showMsg('mq-shop-msg', 'Error saving — please try again.', 'error'); }
  };

  window.mqSavePricing = async function() {
    const pricingRec = window._mqPricingRecord;
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    try {
      const fields = {
        'Shop':                [shopRec.id],
        'Melamine price':      gn('mq-p-melamine'),
        'Plywood price':       gn('mq-p-plywood'),
        'MDF price':           gn('mq-p-mdf'),
        'Solid wood price':    gn('mq-p-solid'),
        'Slab multiplier':     gn('mq-p-slab'),
        'Shaker multiplier':   gn('mq-p-shaker'),
        'Raised multiplier':   gn('mq-p-raised'),
        'Glass multiplier':    gn('mq-p-glass'),
        'Install rate uppers': gn('mq-p-install'),
        'Soft close hinges':   gn('mq-p-hinges'),
        'Birch drawer box':    gn('mq-p-drawer'),
        'Removal rate':        gn('mq-p-removal'),
        'Lam supply':          gn('mq-p-lam'),
        'SS econ supply':      gn('mq-p-ss-econ'),
        'SS mid supply':       gn('mq-p-ss-mid'),
        'SS prem supply':      gn('mq-p-ss-prem'),
        'Gran econ supply':    gn('mq-p-gran-econ'),
        'Gran mid supply':     gn('mq-p-gran-mid'),
        'Gran prem supply':    gn('mq-p-gran-prem'),
        'Quartz supply':       gn('mq-p-quartz'),
        'Marble supply':       gn('mq-p-marble'),
        'Butcher supply':      gn('mq-p-butcher'),
        'Local zone radius':   gn('mq-p-zone-radius'),
        'Zone 2 surcharge':    gn('mq-p-zone2'),
        'Zone 3 surcharge':    gn('mq-p-zone3'),
        'Zone 4 surcharge':    gn('mq-p-zone4'),
        'Tax rate':            gn('mq-p-tax'),
        'Backsplash rate':     gn('mq-p-backsplash'),
        'Sink cutout':         gn('mq-p-sink'),
        'Cooktop cutout':      gn('mq-p-cooktop'),
      };
      if (pricingRec) {
        await atUpdate(CONFIG.PRICING_TABLE, pricingRec.id, fields);
      } else {
        const newRec = await atCreate(CONFIG.PRICING_TABLE, fields);
        window._mqPricingRecord = newRec;
      }
      showMsg('mq-pricing-msg', '✓ Pricing saved!');
    } catch(e) { showMsg('mq-pricing-msg', 'Error saving — please try again.', 'error'); }
  };

  const PHOTO_LIBRARY = {
    melamine:  { label:'Melamine',                emoji:'🟤', desc:'Durable, easy-clean surface over engineered wood. Budget-friendly and available in dozens of colours.' },
    plywood:   { label:'Plywood',                 emoji:'🪵', desc:'Superior moisture resistance and structural strength. A premium choice for long-lasting cabinets.' },
    mdf:       { label:'MDF',                     emoji:'⬜', desc:'Smooth, consistent surface ideal for painted finishes.' },
    solid:     { label:'Solid Wood',              emoji:'🌲', desc:'Real hardwood construction. Beautiful grain, extremely durable, and a timeless choice.' },
    slab:      { label:'Slab Door',               emoji:'▭',  desc:'Clean, flat door with no frame. The defining look of modern and minimalist kitchens.' },
    shaker:    { label:'Shaker Door',             emoji:'⬜', desc:'Five-piece frame with a flat centre panel. The most popular style — timeless and versatile.' },
    raised:    { label:'Raised Panel Door',       emoji:'🔲', desc:'Traditional raised centre panel. Adds depth and a classic, formal look.' },
    glass:     { label:'Glass Front Door',        emoji:'🪟', desc:'Perfect for displaying dishes or adding visual lightness. Clear, frosted, or textured.' },
    none:      { label:'No Doors',                emoji:'📦', desc:'Open shelving or frameless box only. Popular for pantry areas and modern designs.' },
    lam:       { label:'Laminate',                emoji:'🟫', desc:'Most affordable option. Hundreds of colours and patterns including realistic stone looks.' },
    ss_econ:   { label:'Solid Surface — Economy', emoji:'⬜', desc:'Non-porous, seamless surface that resists stains. Can be repaired if scratched.' },
    ss_mid:    { label:'Solid Surface — Mid',     emoji:'⬜', desc:'Premium solid surface with better colour depth and durability.' },
    ss_prem:   { label:'Solid Surface — Premium', emoji:'⬜', desc:'Top-tier solid surface with designer colour options and superior finish quality.' },
    gran_econ: { label:'Granite — Economy',       emoji:'🪨', desc:'Natural stone with unique veining and excellent heat resistance. Great value.' },
    gran_mid:  { label:'Granite — Mid',           emoji:'🪨', desc:'More consistent patterning and colour selection. Extremely durable.' },
    gran_prem: { label:'Granite — Premium',       emoji:'🪨', desc:'Exceptional colour, movement, and rarity. Each slab is unique.' },
    quartz:    { label:'Quartz',                  emoji:'💎', desc:'Engineered stone — non-porous, consistent colouring, very low maintenance.' },
    marble:    { label:'Marble',                  emoji:'🤍', desc:'The ultimate luxury surface. Beautiful natural veining unique to every slab.' },
    butcher:   { label:'Butcher Block',           emoji:'🟤', desc:'Warm, natural wood surface. Ideal for islands. Can be sanded and refinished.' },
  };

  // MidasQuote curated photo library — swap placeholder URLs for real photos when ready
  // Format: { category: [ {url, label}, ... ] }
  // GitHub photo library — reads directly from repo folders, no manifest needed
  // Folder structure: photos/materials/, photos/doors/, photos/countertops/, etc.
  const GH_REPO = 'aceswin/midasquote-widget';
  const GH_BASE = `https://raw.githubusercontent.com/${GH_REPO}/main/photos`;
  const GH_API  = `https://api.github.com/repos/${GH_REPO}/contents/photos`;

  // Map line item categories to photo folder names
  const CAT_TO_FOLDER = {
    material:   'materials',
    door:       'doors',
    drawer:     'drawers',
    hinge:      'hinges',
    countertop: 'countertops',
    specialty:  'specialty',
  };

  const _photoCache = {};

  async function fetchPhotoFolder(cat) {
    const folder = CAT_TO_FOLDER[cat] || cat;
    if (_photoCache[folder]) return _photoCache[folder];
    try {
      const res = await fetch(`${GH_API}/${folder}`);
      if (!res.ok) { _photoCache[folder] = []; return []; }
      const files = await res.json();
      const photos = files
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
        .map(f => ({
          url:   `${GH_BASE}/${folder}/${f.name}`,
          label: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        }));
      _photoCache[folder] = photos;
      return photos;
    } catch(e) { _photoCache[folder] = []; return []; }
  }

  // Photo picker modal
  function injectPhotoPicker() {
    if (document.getElementById('mq-photo-picker')) return;
    const modal = document.createElement('div');
    modal.id = 'mq-photo-picker';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;width:100%;max-width:600px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div style="font-size:15px;font-weight:600;color:#111">📷 Choose from library</div>
          <button onclick="mqClosePhotoPicker()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#6b7280;line-height:1">×</button>
        </div>
        <div id="mq-picker-grid" style="padding:1rem;overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px"></div>
        <div style="padding:0.75rem 1rem;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;flex-shrink:0">
          Don't see what you're looking for? You can also paste a photo URL directly.
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  let _pickerTargetKey = null;

  window.mqOpenPhotoPicker = async function(key, cat) {
    injectPhotoPicker();
    _pickerTargetKey = key;
    const grid = document.getElementById('mq-picker-grid');
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#9ca3af;font-size:13px">Loading photos...</div>';
    document.getElementById('mq-photo-picker').style.display = 'flex';

    const photos = await fetchPhotoFolder(cat);

    if (!photos.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#9ca3af;font-size:13px">
        No library photos available for this category yet.<br>
        No worries — just paste your own photo URL above instead.
      </div>`;
      return;
    }

    grid.innerHTML = photos.map(p => `
      <div onclick="mqSelectLibraryPhoto('${p.url}')"
        style="cursor:pointer;border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;transition:all 0.15s"
        onmouseover="this.style.borderColor='#1a1a1a';this.style.transform='scale(1.02)'"
        onmouseout="this.style.borderColor='#e5e7eb';this.style.transform='scale(1)'">
        <img src="${p.url}" style="width:100%;height:100px;object-fit:cover;display:block"
          onerror="this.parentElement.style.display='none'"/>
        <div style="padding:6px 8px;font-size:11px;font-weight:500;color:#374151;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.label}</div>
      </div>`).join('');
  };

  window.mqClosePhotoPicker = function() {
    const m = document.getElementById('mq-photo-picker');
    if (m) m.style.display = 'none';
  };

  window.mqSelectLibraryPhoto = function(url) {
    const input = el('mq-photo-' + _pickerTargetKey);
    if (input) {
      input.value = url;
      mqPreviewPhoto(_pickerTargetKey);
    }
    mqClosePhotoPicker();
  };

  function buildProductCard(key, savedPhotos) {
    const lib = PHOTO_LIBRARY[key];
    if (!lib) return '';
    const savedUrl = (savedPhotos && savedPhotos[key]) || '';
    const preview = savedUrl
      ? `<img src="${savedUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:10px" onerror="this.style.display='none'"/>`
      : `<div style="width:100%;height:120px;background:#f0efeb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${lib.emoji}</div>`;
    return `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:1rem">
        <div id="mq-photo-preview-${key}">${preview}</div>
        <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:6px">${lib.label}</div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:8px;line-height:1.4">${lib.desc}</div>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Photo URL (optional)</div>
        <input type="text" id="mq-photo-${key}" value="${savedUrl}" placeholder="https://your-site.com/photo.jpg"
          style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:6px"/>
        <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;margin-bottom:4px" onclick="mqPreviewPhoto('${key}')">Preview photo</button>
        <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;color:#6b7280" onclick="mqOpenPhotoPicker('${key}','${key in PHOTO_LIBRARY ? (PHOTO_LIBRARY[key].label||'').toLowerCase() : 'specialty'}')">📷 Choose from library</button>
      </div>`;
  }

  window.mqPreviewPhoto = function(key) {
    const input = el('mq-photo-' + key);
    const preview = el('mq-photo-preview-' + key);
    if (!input || !preview) return;
    const url = input.value.trim();
    if (!url) {
      const lib = PHOTO_LIBRARY[key];
      preview.innerHTML = `<div style="width:100%;height:120px;background:#f0efeb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${lib?.emoji||'📷'}</div>`;
      return;
    }
    preview.innerHTML = `<img src="${url}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:10px" onerror="this.outerHTML='<div style=\\'width:100%;height:120px;background:#f0efeb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px\\'>📷</div>'"/>`;
  };

  window.mqMarkProductsDirty = function() {
    document.querySelectorAll('.mq-products-save-btn').forEach(btn => {
      btn.textContent = '💾 Save changes';
      btn.style.background = '#16a34a';
      btn.style.borderColor = '#16a34a';
    });
  };

  window.mqSaveProducts = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    const photos = {};
    const hidden = {};
    document.querySelectorAll('[id^="mq-photo-"]').forEach(input => {
      if (input.tagName !== 'INPUT') return;
      const key = input.id.replace('mq-photo-', '');
      if (input.value.trim()) photos[key] = input.value.trim();
    });
    document.querySelectorAll('[id^="mq-hidden-"]').forEach(cb => {
      const key = cb.id.replace('mq-hidden-', '');
      if (cb.checked) hidden[key] = true;
    });
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, {
        'Photos':  JSON.stringify(photos),
        'Hidden':  JSON.stringify(hidden),
      });
      shopRec.fields['Photos']  = JSON.stringify(photos);
      shopRec.fields['Hidden']  = JSON.stringify(hidden);
      document.querySelectorAll('.mq-products-save-btn').forEach(btn => {
        btn.textContent = 'Saved ✓';
        btn.style.background = '#1a1a1a';
        btn.style.borderColor = '#1a1a1a';
        setTimeout(() => { btn.textContent = 'Save photos'; }, 2000);
      });
      showMsg('mq-products-msg', '✓ Photos saved!');
    } catch(e) { showMsg('mq-products-msg', 'Error saving — please try again.', 'error'); }
  };

  async function initProductsTab(shopRecord, lineItemsData) {
    const token = shopRecord.fields['Shop token'] || '';
    const showroomUrl = `https://widget.midasquote.com/showroom.html?shop=${token}`;

    let savedPhotos = {};
    let savedProducts = {};
    try { if (shopRecord.fields['Photos']) savedPhotos = JSON.parse(shopRecord.fields['Photos']); } catch(e) {}
    try { if (shopRecord.fields['Products']) savedProducts = JSON.parse(shopRecord.fields['Products']); } catch(e) {}

    // Categories to exclude from My Products (no photos needed)
    const EXCLUDED_CATS = new Set(['install','zone','tax','removal','backsplash','cutout','other','hinge']);

    // Group line items by category directly — same source as pricing helper
    const byCategory = {};
    (lineItemsData || []).forEach(r => {
      if (!r.fields || r.fields['Active'] === false) return;
      const cat = r.fields['Category'];
      if (!cat || EXCLUDED_CATS.has(cat.toLowerCase())) return;
      if (!byCategory[cat]) byCategory[cat] = [];
      // Deduplicate by base name (strip "— uppers"/"— bases" suffix)
      const ITEM_EXCLUDE = /backsplash|cutout|cooktop/i;
      const baseName = (r.fields['Name'] || '').replace(/\s*—\s*(uppers|bases|some drawers|mostly drawers|with doors|no doors)\s*$/i,'').trim();
      if (ITEM_EXCLUDE.test(baseName)) return;
      if (!byCategory[cat].find(x => x.baseName === baseName)) {
        byCategory[cat].push({ id: r.id, baseName, fullName: r.fields['Name'] || baseName });
      }
    });

    const CAT_DISPLAY = {
      material: { title:'🪵 Box Materials',       emoji:'🪵' },
      door:     { title:'🚪 Door Styles',          emoji:'🚪' },
      drawer:   { title:'🗄️ Drawer Configurations', emoji:'🗄️' },
      hinge:    { title:'🔧 Door Hinges',          emoji:'🔧' },
      countertop:{ title:'🪨 Countertop Materials', emoji:'🪨' },
    };

    // Build Products for showroom — all item names per category
    const savedProductsForShowroom = {};
    Object.entries(byCategory).forEach(([cat, items]) => {
      savedProductsForShowroom[cat] = items.map(i => i.baseName);
    });


    // Save detected keys so showroom can read them
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, shopRecord.id, { 'Products': JSON.stringify(savedProductsForShowroom) });
      shopRecord.fields['Products'] = JSON.stringify(savedProductsForShowroom);
    } catch(e) {}

    // Load specialty items
    const specItems = await atGet(CONFIG.SPECIALTY_TABLE, `AND(FIND("${shopRecord.fields['Shop name']}", ARRAYJOIN({Shop})), {Active})`);

    const icons = {'tall':'📦','appliance':'🔌','blind':'↩️','garbage':'🗑️','toe':'👟','lazy':'🔄','wine':'🍷','spice':'🧂','pull':'📥','pot':'🍳','pantry':'🥫','desk':'🖥️','glass':'🪟','light':'💡','crown':'👑'};
    function specIcon(name) { for (const [k,v] of Object.entries(icons)) { if ((name||'').toLowerCase().includes(k)) return v; } return '⭐'; }

    let savedHidden = {};
    try { if (shopRecord.fields['Hidden']) savedHidden = JSON.parse(shopRecord.fields['Hidden']); } catch(e) {}

    function photoCard(key, name, emoji, cat) {
      const savedUrl = savedPhotos[key] || '';
      const isHidden = savedHidden[key] || false;
      const preview = savedUrl
        ? `<img src="${savedUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:10px" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div style="display:none;width:100%;height:120px;background:#f0efeb;border-radius:8px;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${emoji}</div>`
        : `<div style="width:100%;height:120px;background:#f0efeb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:36px;margin-bottom:10px">${emoji}</div>`;
      return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:1rem;${isHidden ? 'opacity:0.5' : ''}">
        <div id="mq-photo-preview-${key}">${preview}</div>
        <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:6px">${name}</div>
        <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" id="mq-hidden-${key}" ${isHidden ? 'checked' : ''} style="width:auto"
            onchange="mqMarkProductsDirty();this.closest('div[style*=border-radius]').style.opacity=this.checked?'0.5':'1'"/>
          Hide from showroom
        </label>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Photo URL (optional)</div>
        <input type="text" id="mq-photo-${key}" value="${savedUrl}" placeholder="https://your-site.com/photo.jpg"
          style="font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%;margin-bottom:6px"
          oninput="mqMarkProductsDirty()"/>
        <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;margin-bottom:4px" onclick="mqPreviewPhoto('${key}')">Preview photo</button>
        <button class="mq-btn mq-btn-sm" style="width:100%;font-size:11px;color:#6b7280" onclick="mqOpenPhotoPicker('${key}','${cat||'specialty'}')">📷 Choose from library</button>
      </div>`;
    }

    function catSection(cat) {
      const items = byCategory[cat] || [];
      if (!items.length) return '';
      const disp = CAT_DISPLAY[cat] || { title: cat, emoji: '📦' };
      const cards = items.map(item => {
        const key = `li_${cat}_${item.baseName.replace(/[^a-z0-9]/gi,'_').toLowerCase()}`;
        const lib = PHOTO_LIBRARY[item.baseName.toLowerCase().replace(/\s+/g,'_')] || {};
        return photoCard(key, item.baseName, lib.emoji || disp.emoji, cat);
      }).join('');
      return `<div class="mq-card">
        <div class="mq-card-title">${disp.title}</div>
        <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Add a photo URL for each item — leave blank to show the default icon on your showroom page.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px">${cards}</div>
        <button class="mq-btn mq-btn-primary mq-products-save-btn" style="margin-top:1rem;width:100%" onclick="mqSaveProducts()">Save photos</button>
      </div>`;
    }

    const specSection = specItems.length ? `<div class="mq-card">
      <div class="mq-card-title">⭐ Specialty Items</div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:1rem">Add photos to your specialty items. All active items from your Specialty Items tab appear here.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px">
        ${specItems.map(r => photoCard('spec_' + r.id, r.fields['Item name'] || '', specIcon(r.fields['Item name']), 'specialty')).join('')}
      </div>
      <button class="mq-btn mq-btn-primary mq-products-save-btn" style="margin-top:1rem;width:100%" onclick="mqSaveProducts()">Save photos</button>
    </div>` : '';

    const content = el('mq-products-content');
    if (content) {
      const catsOrdered = ['material','door','drawer','hinge','countertop'];
      const hasCats = catsOrdered.some(c => byCategory[c]?.length);
      content.innerHTML = (!hasCats && !specItems.length)
        ? '<div class="mq-empty">Set up your pricing first — your configured items will appear here automatically.</div>'
        : catsOrdered.map(catSection).join('') + specSection;
    }

    const linkText = el('mq-showroom-link-text');
    const copyBtn  = el('mq-showroom-copy-btn');
    const openBtn  = el('mq-showroom-open-btn');
    if (linkText) linkText.textContent = showroomUrl;
    if (copyBtn)  copyBtn.onclick = () => mqCopyText(showroomUrl, copyBtn);
    if (openBtn)  openBtn.onclick = () => window.open(showroomUrl, '_blank');
  }
  window.mqToggleShowroom = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    const toggle = el('mq-showroom-toggle');
    const isOn = toggle.classList.contains('on');
    toggle.classList.toggle('on', !isOn);
    try {
      await atUpdate(CONFIG.SHOPS_TABLE, shopRec.id, { 'Show showroom': !isOn });
      shopRec.fields['Show showroom'] = !isOn;
      showMsg('mq-products-msg', !isOn ? '✓ Showroom link enabled on widget.' : '✓ Showroom link hidden from widget.');
    } catch(e) { toggle.classList.toggle('on', isOn); showMsg('mq-products-msg', 'Error saving.', 'error'); }
  };

  window.mqUpdateLeadStatus = async function(id, status) {
    try {
      await atUpdate(CONFIG.LEADS_TABLE, id, { 'Status': status });
    } catch(e) { console.error('Failed to update lead status', e); }
  };

  window.mqSaveAllSpecItems = async function() {
    const rows = document.querySelectorAll('#mq-spec-tbody tr[data-id]');
    if (!rows.length) return;
    showMsg('mq-spec-msg', 'Saving...');
    try {
      for (const row of rows) {
        const id = row.dataset.id;
        const nameInput = document.getElementById('mq-spec-name-' + id);
        const priceInput = document.getElementById('mq-spec-price-' + id);
        if (nameInput || priceInput) {
          await atUpdate(CONFIG.SPECIALTY_TABLE, id, {
            'Item name': nameInput?.value || '',
            'Price': parseFloat(priceInput?.value) || 0,
          });
        }
      }
      showMsg('mq-spec-msg', '✓ All items saved!');
    } catch(e) { showMsg('mq-spec-msg', 'Error saving — please try again.', 'error'); }
  };

  window.mqSaveSpecField = async function(id, field, value) {
    try {
      await atUpdate(CONFIG.SPECIALTY_TABLE, id, { [field]: value });
    } catch(e) { console.error('Failed to save specialty field', e); }
  };

  window.mqDeleteSpec = async function(id) {
    if (!confirm('Delete this specialty item?')) return;
    try {
      await atDelete(CONFIG.SPECIALTY_TABLE, id);
      const specs = await loadSpecialty(window._mqShopRecord.fields['Shop name']);
      renderSpecialty(specs, window._mqShopRecord);
      showMsg('mq-spec-msg', '✓ Item deleted.');
    } catch(e) { showMsg('mq-spec-msg', 'Error deleting item.', 'error'); }
  };

  window.mqAddSpecItem = async function() {
    const shopRec = window._mqShopRecord;
    if (!shopRec) return;
    try {
      await atCreate(CONFIG.SPECIALTY_TABLE, {
        'Item name': 'New item',
        'Shop': [shopRec.id],
        'Price': 0,
        'Active': true,
        'Per linear foot': false,
        'Sort order': 0,
      });
      const specs = await loadSpecialty(shopRec.fields['Shop name']);
      renderSpecialty(specs, shopRec);
      showMsg('mq-spec-msg', '✓ Item added — edit the name and price above.');
    } catch(e) { showMsg('mq-spec-msg', 'Error adding item.', 'error'); }
  };

  window.mqDeleteLead = async function(id) {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await atDelete(CONFIG.LEADS_TABLE, id);
      window._mqLeads = window._mqLeads.filter(r => r.id !== id);
      renderStats(window._mqLeads);
      el('mq-recent-leads').innerHTML = renderLeads(window._mqLeads, 5);
      mqFilterLeads();
      showMsg('mq-leads-msg', '✓ Lead deleted.');
    } catch(e) { showMsg('mq-leads-msg', 'Error deleting lead.', 'error'); }
  };

  window.mqDeleteAllLeads = async function() {
    const count = window._mqLeads?.length || 0;
    if (count === 0) return;
    if (!confirm(`Delete ALL ${count} leads? This is useful for clearing test data but cannot be undone. Are you sure?`)) return;
    if (!confirm(`Really delete all ${count} leads? Last chance to cancel.`)) return;
    try {
      for (const lead of window._mqLeads) {
        await atDelete(CONFIG.LEADS_TABLE, lead.id);
      }
      window._mqLeads = [];
      renderStats([]);
      el('mq-recent-leads').innerHTML = renderLeads([], 5);
      mqFilterLeads();
      showMsg('mq-leads-msg', '✓ All leads deleted.');
    } catch(e) { showMsg('mq-leads-msg', 'Error deleting leads.', 'error'); }
  };

  // ============================================================
  // MY PRODUCTS
  // ============================================================


  window.mqFilterLeads = async function() {
    const filter = gv('mq-lead-filter');
    let leads = window._mqLeads || [];
    if (filter) leads = leads.filter(r => r.fields['Status'] === filter);
    el('mq-leads-table').innerHTML = renderLeads(leads);
  };

  // ============================================================
  // MARKETING KIT
  // ============================================================
  function initMarketingKit(shopRecord) {
    const shopName = shopRecord.fields['Shop name'] || 'our shop';
    const token = shopRecord.fields['Shop token'] || '';
    const quoteLink = `https://widget.midasquote.com/?shop=${token}`;
    const embedCode = `<div style="text-align:center">\n  <div id="midasquote-widget"></div>\n  <script src="https://widget.midasquote.com/widget.js?shop=${token}"></script>\n</div>`;

    const socialPosts = [
      `🛠️ Now you can get an instant cabinet quote right from our website! No phone calls, no waiting around — just answer a few quick questions and get your ballpark price in under 2 minutes. Try it now → ${quoteLink}`,
      `Tired of waiting days for a quote? We just made it instant. ⚡ Get a real price range on your kitchen project in 60 seconds — right from your phone. ${quoteLink}`,
      `We just upgraded how we quote projects. Instead of waiting for a callback, you can now get an instant estimate online — anytime, day or night. Give it a try: ${quoteLink}`,
      `Know your price before you even call. Get an instant cabinet estimate here → ${quoteLink}`,
      `Hey homeowners! If you're planning a kitchen remodel, we just made getting a price way easier. Try our new instant quote tool — no obligation, just real numbers: ${quoteLink}`,
    ];

    const headlines = [
      'Get a free quote online in minutes',
      'Know your price before you even call',
      'Get your cabinet estimate in under 2 minutes',
      'No phone calls. No waiting. Just your price.',
      'See what your project costs — right now',
    ];

    const dmTemplate = `Hi [Name]! Just wanted to let you know ${shopName} now has an instant online quote tool if you ever want a quick ballpark on a future project — no need to wait for a callback. Here's the link if you ever want to check it out: ${quoteLink}`;

    const heroHeaderHTML = `<div style="text-align:center;padding:2rem 1rem 1.5rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#b8763a;margin-bottom:0.75rem;display:flex;align-items:center;justify-content:center;gap:10px">
    <span style="display:block;width:24px;height:1.5px;background:#b8763a"></span>
    Instant Pricing
    <span style="display:block;width:24px;height:1.5px;background:#b8763a"></span>
  </div>
  <h2 style="font-size:28px;font-weight:600;color:#1a1a1a;line-height:1.2;margin:0 0 0.75rem">Get your cabinet estimate<br/>in under 2 minutes</h2>
  <p style="font-size:14px;color:#6b7280;line-height:1.7;max-width:460px;margin:0 auto">No phone tag, no awkward sales call. Fill in a few details and we'll send you a ballpark range you can actually plan around.</p>
</div>`;

    const trustBarHTML = `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:1.5rem;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin:30px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="font-size:15px">✅</span><span>No commitment required</span></div>
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="font-size:15px">📧</span><span>Results sent to your inbox</span></div>
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="font-size:15px">🔒</span><span>We never sell your info</span></div>
  <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="font-size:15px">⚡</span><span>Instant ballpark estimate</span></div>
</div>`;

    const escapeHtml = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const socialEl = el('mq-mk-social');
    if (socialEl) {
      socialEl.innerHTML = socialPosts.map((post, i) => `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:10px">
          <div style="font-size:13px;color:#111;line-height:1.6;margin-bottom:8px">${escapeHtml(post)}</div>
          <button class="mq-btn mq-btn-sm" onclick="mqCopyText(${JSON.stringify(post)},this)">Copy</button>
        </div>`).join('');
    }

    const headlinesEl = el('mq-mk-headlines');
    if (headlinesEl) {
      headlinesEl.innerHTML = headlines.map(h => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6">
          <span style="font-size:13px;color:#111">${escapeHtml(h)}</span>
          <button class="mq-btn mq-btn-sm" onclick="mqCopyText(${JSON.stringify(h)},this)">Copy</button>
        </div>`).join('');
    }

    const dmEl = el('mq-mk-dm');
    if (dmEl) {
      dmEl.innerHTML = `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px">
          <div style="font-size:13px;color:#111;line-height:1.6;margin-bottom:8px">${escapeHtml(dmTemplate)}</div>
          <button class="mq-btn mq-btn-sm" onclick="mqCopyText(${JSON.stringify(dmTemplate)},this)">Copy</button>
        </div>`;
    }

    const headerDisplay = el('mq-mk-header-display');
    const headerCopyBtn = el('mq-mk-header-copy');
    const headerPreview = el('mq-mk-header-preview');
    if (headerDisplay) headerDisplay.textContent = heroHeaderHTML;
    if (headerCopyBtn) headerCopyBtn.onclick = () => mqCopyText(heroHeaderHTML, headerCopyBtn);
    if (headerPreview) headerPreview.innerHTML = heroHeaderHTML;

    const trustDisplay = el('mq-mk-trustbar-display');
    const trustCopyBtn = el('mq-mk-trustbar-copy');
    const trustPreview = el('mq-mk-trustbar-preview');
    if (trustDisplay) trustDisplay.textContent = trustBarHTML;
    if (trustCopyBtn) trustCopyBtn.onclick = () => mqCopyText(trustBarHTML, trustCopyBtn);
    if (trustPreview) trustPreview.innerHTML = trustBarHTML;
  }

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    const container = document.getElementById('midasquote-dashboard');
    if (!container) {
      console.error('MidasQuote Dashboard: Add <div id="midasquote-dashboard"></div> to your page.');
      return;
    }

    injectStyles();
    container.innerHTML = '<div class="mq-loading" style="padding:4rem;text-align:center;font-size:14px;color:#6b7280">Loading your dashboard...</div>';

    let shopToken = new URLSearchParams(window.location.search).get('shop');
    if (!shopToken && window.$memberstackDom) {
      try {
        const { data: member } = await window.$memberstackDom.getCurrentMember();
        if (member) shopToken = member.metaData?.shopToken || member.customFields?.shopToken;
      } catch(e) {}
    }
    if (!shopToken) shopToken = 'dr-sales-001';

    const shopRecord = await loadShop(shopToken);
    if (!shopRecord) {
      container.innerHTML = '<div class="mq-loading" style="padding:4rem;text-align:center;color:#dc2626">Shop not found. Please contact support at hello@midasquote.com</div>';
      return;
    }

    window._mqShopRecord = shopRecord;
    container.innerHTML = buildHTML(shopRecord.fields);

    // Tell Memberstack to re-scan the DOM so data-ms-modal attributes work on dynamically injected elements
    if (window.$memberstackDom?.reinitialize) window.$memberstackDom.reinitialize();
    else if (window.MemberStack?.reload) window.MemberStack.reload();

    // Wire up embed copy buttons now that DOM exists
    ['mq-copy-embed-1', 'mq-copy-embed-2'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.onclick = () => mqCopyEmbed(btn);
    });

    const pricingRecord = await loadPricing(shopRecord.fields['Shop name']);
    window._mqPricingRecord = pricingRecord;
    if (pricingRecord) populatePricing(pricingRecord);
    populateShop(shopRecord);

    const leads = await loadLeads(shopRecord.fields['Shop name']);
    window._mqLeads = leads;
    renderStats(leads);
    el('mq-recent-leads').innerHTML = renderLeads(leads, 5);
    el('mq-leads-table').innerHTML = renderLeads(leads);

    const specs = await ensureSpecialtyDefaults(shopRecord);
    renderSpecialty(specs, shopRecord);

    // Load line items for My Products tab
    const lineItems = await atGet(CONFIG.LINE_ITEMS_TABLE, `FIND("${shopRecord.fields['Shop name']}", ARRAYJOIN({Shop}))`);
    window._mqLineItems = lineItems;
  }

  // Load pricing helper when that nav item is clicked
  const origMqNav = window.mqNav;
  window.mqNav = async function(page, navEl) {
    origMqNav(page, navEl);
    if (page === 'marketing') {
      const socialEl = document.getElementById('mq-mk-social');
      if (socialEl && !socialEl.dataset.loaded && window._mqShopRecord) {
        socialEl.dataset.loaded = 'true';
        initMarketingKit(window._mqShopRecord);
      }
    }
    if (page === 'billing') {
      const planEl = document.getElementById('mq-billing-plan');
      if (planEl && planEl.textContent === 'Loading plan info...') {
        try {
          const { data: member } = await window.$memberstackDom.getCurrentMember();
          const plans = member?.planConnections || [];
          if (plans.length > 0) {
            const plan = plans[0];
            planEl.innerHTML = `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                <span style="background:#dcfce7;color:#166534;font-size:12px;font-weight:500;padding:3px 10px;border-radius:20px">Active</span>
                <span style="font-size:14px;font-weight:500;color:#111">${plan.planName || plan.plan?.name || 'MidasQuote'}</span>
              </div>
              <p style="font-size:13px;color:#6b7280">Your subscription is active. Manage it using the buttons below.</p>`;
          } else {
            planEl.innerHTML = `<p style="font-size:13px;color:#6b7280">No active plan found. <a href="/pricing" style="color:#1a1a1a;font-weight:500">View plans →</a></p>`;
          }
        } catch(e) {
          planEl.innerHTML = `<p style="font-size:13px;color:#6b7280">Use the buttons below to manage your subscription.</p>`;
        }
      }
    }
    if (page === 'products') {
      const prodContent = document.getElementById('mq-products-content');
      if (prodContent) {
        prodContent.innerHTML = '<div class="mq-loading">Loading your products...</div>';
        atGet(CONFIG.LINE_ITEMS_TABLE, `FIND("${window._mqShopRecord.fields['Shop name']}", ARRAYJOIN({Shop}))`)
          .then(lineItems => {
            window._mqLineItems = lineItems;
            initProductsTab(window._mqShopRecord, lineItems);
          });
      }
    }
    if (page === 'pricing') {
      const helperContainer = document.getElementById('mq-pricing-helper-v2');
      if (helperContainer && !helperContainer.dataset.loaded) {
        helperContainer.dataset.loaded = 'true';
        const script = document.createElement('script');
        script.src = 'https://widget.midasquote.com/pricing-helper-v2.js';
        script.onload = function() {
          window.mqph2Init(window._mqShopRecord, window._mqPricingRecord);
        };
        document.body.appendChild(script);
      }
    }
  };

  init();

})();