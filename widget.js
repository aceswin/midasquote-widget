/*
 * MidasQuote Widget Embed Script v1.0
 * Replace the values in CONFIG with your real Airtable credentials
 * DO NOT share this file publicly with your credentials inside it
 * Host this file on Cloudflare Pages or similar CDN
 */

(function() {

  // ============================================================
  // CONFIG — replace these with your real values
  // Keep this file private — treat these like passwords
  // ============================================================
  const CONFIG = {
    AIRTABLE_TOKEN:     'patulbU1ndSvFpMDo.906a8be9e784fb12de048d4238c5d553859f8d57670ccd1bc1a6de4e2da37325',
    BASE_ID:            'app4zrMlVLwF2xn4h',
    SHOPS_TABLE:        'tbl8PoF2Mu3sAdlMs',
    PRICING_TABLE:      'tblu6AYZs8h7SIaQl',
    SPECIALTY_TABLE:    'tbloaXeEM5K7TOZCD',
    LEADS_TABLE:        'tblPcoTI8zCCHLICi',
    RESEND_API_KEY:     're_bkjuB6kc_HvraLCVCJntfLMjVBEjEkWuV',
    EMAIL_WORKER:    'https://midasquote-email.jordan132001.workers.dev',
FROM_EMAIL:         'quotes@midasquote.com',
  };
  // ============================================================



  const scriptTag = document.currentScript;
  const shopToken = new URLSearchParams(scriptTag.src.split('?')[1] || '').get('shop');
  if (!shopToken) { console.error('MidasQuote: No shop token found.'); return; }

  const AT_BASE = `https://api.airtable.com/v0/${CONFIG.BASE_ID}`;
  const AT_HEADS = { 'Authorization': `Bearer ${CONFIG.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

  async function atGet(table, formula) {
    const url = `${AT_BASE}/${table}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=100`;
    const res = await fetch(url, { headers: AT_HEADS });
    const data = await res.json();
    return data.records || [];
  }

  async function atCreate(table, fields) {
    const res = await fetch(`${AT_BASE}/${table}`, {
      method: 'POST', headers: AT_HEADS,
      body: JSON.stringify({ fields })
    });
    return await res.json();
  }

  // ============================================================
  // LOAD SHOP DATA
  // ============================================================
  async function loadShopData(token) {
    const shops = await atGet(CONFIG.SHOPS_TABLE, `{Shop token} = "${token}"`);
    if (!shops.length) { console.error('MidasQuote: Shop not found:', token); return null; }
    const shopRecord = shops[0];
    const shop = shopRecord.fields;
    shop._recordId = shopRecord.id;

    const pricing = await atGet(CONFIG.PRICING_TABLE,
      `FIND("${shop['Shop name']}", ARRAYJOIN({Shop}))`);
    const p = pricing.length ? pricing[0].fields : {};

    const specRecords = await atGet(CONFIG.SPECIALTY_TABLE,
      `AND(FIND("${shop['Shop name']}", ARRAYJOIN({Shop})), {Active})`);
    const specs = specRecords
      .sort((a, b) => (a.fields['Sort order'] || 0) - (b.fields['Sort order'] || 0))
      .map(r => ({
        id: r.id,
        label: r.fields['Item name'] || r.fields['Special Items'],
        price: r.fields['Price'] || 0,
        perFt: r.fields['Per linear foot'] || false,
      }));

    return { shop, pricing: p, specs };
  }

  // ============================================================
  // EMAIL & LEAD SAVING
  // ============================================================
async function saveLead(data, lead, quoteType, low, high, lines) {
    const { shop } = data;
    try {
      await atCreate(CONFIG.LEADS_TABLE, {
        'Lead ID':        `${lead.name} — ${new Date().toLocaleDateString()}`,
        'Shop':           [shop._recordId],
        'Customer name':  lead.name,
        'Customer email': lead.email,
        'Customer phone': lead.phone,
        'Quote type':     quoteType,
        'Estimate low':   low,
        'Estimate high':  high,
        'Quote details':  JSON.stringify(lines),
        'Source':         'Website',
        'Status':         'New',
      });
    } catch (e) { console.error('MidasQuote: Lead save failed', e); }

    const lineRows = (lines || [])
      .filter(l => l && l.label && l.cost !== undefined)
      .map(l => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">${l.label}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;${l.bold?'font-weight:700;color:#111':''}">${'$'}${Math.round(l.cost).toLocaleString()}</td>
      </tr>`).join('');

    await sendEmail(
      shop['Lead notify email'],
      `New ${quoteType} quote lead — ${lead.name}`,
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1a1a1a;margin-bottom:4px">New ${quoteType} quote lead</h2>
        <p style="color:#666;margin-bottom:16px">Someone just completed a quote on your MidasQuote widget.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600;color:#111" colspan="2">Customer details</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Name</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:500">${lead.name}</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Email</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.email}</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Phone</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.phone}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600;color:#111" colspan="2">Quote breakdown</td></tr>
          ${lineRows}
        </table>
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px">
          <div style="font-size:13px;color:#666;margin-bottom:4px">Estimated range</div>
          <div style="font-size:28px;font-weight:700;color:#16a34a">${'$'}${low.toLocaleString()} – $${high.toLocaleString()}</div>
        </div>
        <p style="color:#999;font-size:12px">Saved to your MidasQuote leads dashboard.</p>
      </div>`
    );

    if (lead.email) {
      await sendEmail(
        lead.email,
        `Your quote from ${shop['Shop name']}`,
        `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#1a1a1a;margin-bottom:4px">Your ${quoteType} quote from ${shop['Shop name']}</h2>
          <p style="color:#666;margin-bottom:16px">Hi ${lead.name}, here's your full estimate breakdown.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="padding:8px;background:#f9fafb;font-weight:600;color:#111" colspan="2">Quote breakdown</td></tr>
            ${lineRows}
          </table>
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px">
            <div style="font-size:13px;color:#666;margin-bottom:4px">Your estimated range</div>
            <div style="font-size:28px;font-weight:700;color:#16a34a">${'$'}${low.toLocaleString()} – $${high.toLocaleString()}</div>
          </div>
          <p style="color:#666;font-size:13px">${shop['Disclaimer text'] || 'Ballpark estimate only. Contact us for a full quote.'}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
          <p style="color:#666;font-size:13px"><strong>${shop['Shop name']}</strong><br/>${shop['Phone'] || ''}</p>
        </div>`
      );
    }
  }

 async function sendEmail(to, subject, html) {
    if (!CONFIG.EMAIL_WORKER) return;
    try {
      await fetch(CONFIG.EMAIL_WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html })
      });
    } catch (e) { console.error('MidasQuote: Email failed', e); }
  }

  function buildShopEmail(shop, lead, type, low, high, lines) {
    const lineRows = lines.map(l => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">${l.label}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;${l.bold?'font-weight:700;color:#111':''}">$${l.cost.toLocaleString()}</td>
      </tr>`).join('');
    return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#1a1a1a;margin-bottom:4px">New ${type} quote lead</h2>
      <p style="color:#666;margin-bottom:16px">Someone just completed a quote on your MidasQuote widget.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;font-weight:500" colspan="2">Customer details</td></tr>
        <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Name</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:500">${lead.name}</td></tr>
        <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Email</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.email}</td></tr>
        <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Phone</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.phone}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;font-weight:500" colspan="2">Quote breakdown</td></tr>
        ${lineRows}
      </table>
      <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px">
        <div style="font-size:13px;color:#666;margin-bottom:4px">Estimated range</div>
        <div style="font-size:28px;font-weight:700;color:#16a34a">$${low.toLocaleString()} – $${high.toLocaleString()}</div>
      </div>
      <p style="color:#666;font-size:12px">This lead has been saved to your MidasQuote dashboard.</p>
    </div>`;
  }

  function buildCustomerEmail(shop, lead, type, low, high, lines) {
    const lineRows = lines.map(l => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">${l.label}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;${l.bold?'font-weight:700;color:#111':''}">$${l.cost.toLocaleString()}</td>
      </tr>`).join('');
    return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#1a1a1a;margin-bottom:4px">Your ${type} quote from ${shop['Shop name']}</h2>
      <p style="color:#666;margin-bottom:16px">Hi ${lead.name}, here's a full breakdown of your estimate.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;font-weight:500" colspan="2">Quote breakdown</td></tr>
        ${lineRows}
      </table>
      <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px">
        <div style="font-size:13px;color:#666;margin-bottom:4px">Your estimated range</div>
        <div style="font-size:28px;font-weight:700;color:#16a34a">$${low.toLocaleString()} – $${high.toLocaleString()}</div>
      </div>
      <p style="color:#666;font-size:13px">${shop['Disclaimer text'] || 'This is a ballpark estimate only. Contact us for a full quote.'}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
      <p style="color:#666;font-size:13px"><strong>${shop['Shop name']}</strong><br/>${shop['Phone'] || ''}<br/>${shop['Website'] || ''}</p>
    </div>`;
  }

  // ============================================================
  // STYLES
  // ============================================================
  function injectStyles(brandColor) {
    const s = document.createElement('style');
    s.textContent = `
      #midasquote-widget *{box-sizing:border-box;margin:0;padding:0}
      #midasquote-widget{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff}
      #midasquote-widget .mq-header{display:flex;align-items:center;padding:1rem 1.5rem;background:#fff;border-bottom:1px solid #e5e7eb;gap:12px}
      #midasquote-widget .mq-logo{width:36px;height:36px;border-radius:8px;background:${brandColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;flex-shrink:0;overflow:hidden}
      #midasquote-widget .mq-logo img{width:100%;height:100%;object-fit:cover}
      #midasquote-widget .mq-shop-name{font-size:14px;font-weight:600;color:#111}
      #midasquote-widget .mq-shop-sub{font-size:12px;color:#6b7280}
      #midasquote-widget .mq-tab-bar{display:flex;background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:10px 1.5rem;gap:8px}
      #midasquote-widget .mq-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;border:1px solid #e5e7eb;border-radius:8px;background:#fff;transition:all 0.15s;text-align:center;font-family:inherit}
      #midasquote-widget .mq-tab:hover{border-color:#9ca3af;color:#111}
      #midasquote-widget .mq-tab.active{background:${brandColor};color:#fff;border-color:${brandColor}}
      #midasquote-widget .mq-tab.mq-tab-both.active{background:linear-gradient(135deg,${brandColor},#378ADD);border-color:transparent}
      #midasquote-widget .mq-tab-icon{font-size:18px;line-height:1;flex-shrink:0}
      #midasquote-widget .mq-tab-label{display:flex;flex-direction:column;align-items:flex-start;gap:1px}
      #midasquote-widget .mq-tab-title{font-size:13px;font-weight:500;line-height:1}
      #midasquote-widget .mq-tab-sub{font-size:10px;opacity:0.7;font-weight:400;line-height:1}
      #midasquote-widget .mq-tab-content{display:none;padding:1.5rem}
      #midasquote-widget .mq-tab-content.active{display:block}
      #midasquote-widget .mq-sec{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1.25rem;margin-bottom:1rem}
      #midasquote-widget .mq-sec-title{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1rem}
      #midasquote-widget .mq-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
      #midasquote-widget .mq-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
      #midasquote-widget .mq-field{display:flex;flex-direction:column;gap:5px}
      #midasquote-widget .mq-label{font-size:13px;color:#6b7280}
      #midasquote-widget .mq-hint{font-size:11px;color:#9ca3af;margin-top:2px;line-height:1.4}
      #midasquote-widget input,#midasquote-widget select{font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;width:100%}
      #midasquote-widget input:focus,#midasquote-widget select:focus{outline:none;border-color:${brandColor}}
      #midasquote-widget .mq-spec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:8px}
      #midasquote-widget .mq-spec-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;transition:all 0.15s}
      #midasquote-widget .mq-spec-item.on{background:#eff6ff;border-color:#93c5fd}
      #midasquote-widget .mq-spec-name{font-size:13px;color:#111;flex:1;cursor:pointer}
      #midasquote-widget .mq-spec-item.on .mq-spec-name{color:#1d4ed8}
      #midasquote-widget .mq-qty-ctrl{display:flex;align-items:center;gap:4px}
      #midasquote-widget .mq-qty-btn{width:22px;height:22px;border:1px solid #d1d5db;border-radius:4px;background:#fff;color:#111;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit}
      #midasquote-widget .mq-qty-val{font-size:13px;font-weight:500;min-width:16px;text-align:center}
      #midasquote-widget .mq-tog-row{display:flex;align-items:center;gap:10px;margin:1rem 0 0.75rem;padding:10px 12px;background:#f9fafb;border-radius:8px;cursor:pointer}
      #midasquote-widget .mq-tog{width:36px;height:20px;background:#d1d5db;border-radius:10px;position:relative;transition:background 0.2s;flex-shrink:0}
      #midasquote-widget .mq-tog.on{background:${brandColor}}
      #midasquote-widget .mq-tog::after{content:'';position:absolute;width:16px;height:16px;background:#fff;border-radius:50%;top:2px;left:2px;transition:left 0.2s}
      #midasquote-widget .mq-tog.on::after{left:18px}
      #midasquote-widget .mq-sub-sec{background:#f9fafb;border-radius:8px;padding:1rem;margin-top:0.75rem}
      #midasquote-widget .mq-sub-title{font-size:11px;font-weight:600;color:#6b7280;margin:0 0 0.75rem;text-transform:uppercase;letter-spacing:0.05em}
      #midasquote-widget .mq-calc-btn{width:100%;padding:13px;font-size:15px;font-weight:600;background:${brandColor};color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:0.5rem;transition:opacity 0.15s;font-family:inherit}
      #midasquote-widget .mq-calc-btn:hover{opacity:0.88}
      #midasquote-widget .mq-calc-btn:disabled{opacity:0.4;cursor:not-allowed}
      #midasquote-widget .mq-calc-btn-both{background:linear-gradient(135deg,${brandColor},#378ADD)}
      #midasquote-widget .mq-result{display:none;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1.25rem;margin-top:1rem}
      #midasquote-widget .mq-result.show{display:block}
      #midasquote-widget .mq-res-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #e5e7eb}
      #midasquote-widget .mq-res-title{font-size:15px;font-weight:600;color:#111;margin-bottom:3px}
      #midasquote-widget .mq-res-sub{font-size:13px;color:#6b7280}
      #midasquote-widget .mq-res-range{font-size:22px;font-weight:700;color:${brandColor};text-align:right}
      #midasquote-widget .mq-res-range-lbl{font-size:12px;color:#6b7280;text-align:right}
      #midasquote-widget .mq-line-items{list-style:none;padding:0;margin:0 0 1rem}
      #midasquote-widget .mq-line-items li{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #f3f4f6;color:#111}
      #midasquote-widget .mq-line-items li:last-child{border-bottom:none}
      #midasquote-widget .mq-li-lbl{color:#6b7280}
      #midasquote-widget .mq-disclaimer{font-size:12px;color:#6b7280;background:#f9fafb;border-radius:6px;padding:10px 12px;margin-top:1rem;line-height:1.5}
      #midasquote-widget .mq-cta-row{display:flex;gap:8px;margin-top:1rem}
      #midasquote-widget .mq-cta-row button{flex:1;padding:10px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer;border:1px solid #d1d5db;background:#fff;color:#111;transition:background 0.15s;font-family:inherit}
      #midasquote-widget .mq-cta-row button:hover{background:#f9fafb}
      #midasquote-widget .mq-pri{background:${brandColor}!important;color:#fff!important;border-color:${brandColor}!important}
      #midasquote-widget .mq-pri:hover{opacity:0.88!important;background:${brandColor}!important}
      #midasquote-widget .mq-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;padding:1rem}
      #midasquote-widget .mq-overlay.show{display:flex}
      #midasquote-widget .mq-modal{background:#fff;border-radius:12px;padding:1.5rem;width:90%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
      #midasquote-widget .mq-modal-title{font-size:16px;font-weight:600;color:#111;margin-bottom:4px}
      #midasquote-widget .mq-modal-sub{font-size:13px;color:#6b7280;margin-bottom:1.25rem;line-height:1.5}
      #midasquote-widget .mq-modal-fields{display:flex;flex-direction:column;gap:10px;margin-bottom:1.25rem}
      #midasquote-widget .mq-modal-btn{width:100%;padding:11px;font-size:14px;font-weight:600;background:${brandColor};color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit}
      #midasquote-widget .mq-modal-skip{width:100%;padding:8px;font-size:13px;color:#6b7280;background:none;border:none;cursor:pointer;margin-top:6px;font-family:inherit}
      #midasquote-widget .mq-surface-card{border:1px solid #e5e7eb;border-radius:10px;padding:1rem;margin-bottom:10px}
      #midasquote-widget .mq-surface-header{display:flex;align-items:center;gap:8px;margin-bottom:1rem}
      #midasquote-widget .mq-surface-num{width:24px;height:24px;border-radius:50%;background:${brandColor};color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      #midasquote-widget .mq-remove-btn{font-size:12px;color:#6b7280;background:none;border:1px solid #e5e7eb;border-radius:6px;padding:3px 10px;cursor:pointer;font-family:inherit}
      #midasquote-widget .mq-add-surface-btn{width:100%;padding:10px;font-size:13px;font-weight:500;border:1px dashed #d1d5db;border-radius:8px;background:none;color:#6b7280;cursor:pointer;margin-top:4px;font-family:inherit}
      #midasquote-widget .mq-add-surface-btn:hover{background:#f9fafb;color:#111}
      #midasquote-widget .mq-divider{height:1px;background:#e5e7eb;margin:1rem 0}
      #midasquote-widget .mq-check-row{display:flex;align-items:center;gap:8px;font-size:13px;color:#111;cursor:pointer;padding:5px 0}
      #midasquote-widget .mq-loading{display:none;text-align:center;padding:2rem;color:#6b7280;font-size:14px}
      #midasquote-widget .mq-loading.show{display:block}
      #midasquote-widget .mq-both-divider{display:flex;align-items:center;gap:12px;margin:1.5rem 0 1rem}
      #midasquote-widget .mq-both-divider-line{flex:1;height:1px;background:#e5e7eb}
      #midasquote-widget .mq-both-divider-label{font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;padding:4px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:20px}
      #midasquote-widget .mq-combined-result{display:none;background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #86efac;border-radius:10px;padding:1.5rem;margin-top:1rem}
      #midasquote-widget .mq-combined-result.show{display:block}
      #midasquote-widget .mq-combined-title{font-size:14px;font-weight:600;color:#166534;margin-bottom:1rem;display:flex;align-items:center;gap:6px}
      #midasquote-widget .mq-combined-section{margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(134,239,172,0.5)}
      #midasquote-widget .mq-combined-section:last-of-type{border-bottom:none;margin-bottom:0;padding-bottom:0}
      #midasquote-widget .mq-combined-section-title{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px}
      #midasquote-widget .mq-combined-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#111}
      #midasquote-widget .mq-combined-row .mq-clbl{color:#6b7280}
      #midasquote-widget .mq-combined-subtotal{display:flex;justify-content:space-between;font-size:13px;font-weight:600;padding:6px 0;border-top:1px solid rgba(134,239,172,0.5);margin-top:4px}
      #midasquote-widget .mq-grand-total{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;background:#fff;border-radius:8px;margin-top:1rem;border:1px solid #86efac}
      #midasquote-widget .mq-grand-label{font-size:15px;font-weight:600;color:#111}
      #midasquote-widget .mq-grand-sub{font-size:12px;color:#6b7280;margin-top:2px}
      #midasquote-widget .mq-grand-val{font-size:26px;font-weight:700;color:${brandColor};text-align:right}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // BUILD HTML HELPERS
  // ============================================================
  function matOpts() {
    return `<option value="melamine">Melamine</option>
      <option value="plywood">Plywood</option>
      <option value="mdf">Painted MDF</option>
      <option value="solid">Solid wood</option>`;
  }

  function doorOpts() {
    return `<option value="slab">Slab (flat)</option>
      <option value="shaker">Shaker</option>
      <option value="raised">Raised panel</option>
      <option value="glass">Glass inserts</option>`;
  }

  function ctMatOpts() {
    return `<optgroup label="Laminate"><option value="lam">Laminate</option></optgroup>
      <optgroup label="Solid Surface"><option value="ss_econ">Economy</option><option value="ss_mid">Mid-grade</option><option value="ss_prem">Premium</option></optgroup>
      <optgroup label="Granite"><option value="gran_econ">Economy granite</option><option value="gran_mid">Mid-grade granite</option><option value="gran_prem">Premium (Cambria)</option></optgroup>
      <optgroup label="Other"><option value="quartz">Engineered quartz</option><option value="marble">Marble</option><option value="butcher">Butcher block</option></optgroup>`;
  }

  function specHTML(specs, prefix) {
    if (!specs.length) return '<p style="font-size:13px;color:#6b7280">No specialty items configured yet.</p>';
    return specs.map((s, i) => `
      <div class="mq-spec-item" id="mq-sp-${prefix}-${i}">
        <span class="mq-spec-name" onclick="mqToggleSpec('${prefix}',${i})">${s.label}</span>
        <div class="mq-qty-ctrl">
          <button class="mq-qty-btn" onclick="mqAdjQty('${prefix}',${i},-1)">−</button>
          <span class="mq-qty-val" id="mq-qty-${prefix}-${i}">0</span>
          <button class="mq-qty-btn" onclick="mqAdjQty('${prefix}',${i},1)">+</button>
        </div>
      </div>`).join('');
  }

  function cabinetForm(prefix, specs, pricing) {
    return `
      <div class="mq-sec">
        <p class="mq-sec-title">Project basics</p>
        <div class="mq-grid2">
          <div class="mq-field"><label class="mq-label">Room type</label>
            <select id="mq-${prefix}-room"><option value="kitchen">Kitchen</option><option value="bathroom">Bathroom</option><option value="laundry">Laundry room</option><option value="garage">Garage</option><option value="office">Home office</option><option value="other">Other</option></select></div>
          <div class="mq-field"><label class="mq-label">Supply + install?</label>
            <select id="mq-${prefix}-si"><option value="supply">Supply only</option><option value="install">Supply + install</option></select></div>
        </div>
      </div>
      <div class="mq-sec">
        <p class="mq-sec-title">Cabinet measurements</p>
        <p class="mq-hint" style="margin-bottom:1rem">Uppers and bases measured separately. A 10ft wall with both = 10ft uppers + 10ft bases.</p>
        <div class="mq-grid3">
          <div class="mq-field"><label class="mq-label">Upper cabinets (lin ft)</label><input type="number" id="mq-${prefix}-uft" value="10" min="0" max="60"/></div>
          <div class="mq-field"><label class="mq-label">Base cabinets (lin ft)</label><input type="number" id="mq-${prefix}-bft" value="10" min="0" max="60"/></div>
          <div class="mq-field"><label class="mq-label">Height</label>
            <select id="mq-${prefix}-ht"><option value="standard">Standard (30")</option><option value="tall">Tall (36")</option><option value="mixed">Mix of both</option></select></div>
        </div>
        <div class="mq-tog-row" onclick="mqTogDiff('${prefix}')">
          <div class="mq-tog" id="mq-${prefix}-diff-tog"></div>
          <label style="font-size:13px;cursor:pointer">Different styles for uppers and lowers</label>
        </div>
        <div id="mq-${prefix}-shared">
          <div class="mq-grid3">
            <div class="mq-field"><label class="mq-label">Door style</label><select id="mq-${prefix}-door">${doorOpts()}</select></div>
            <div class="mq-field"><label class="mq-label">Box material</label><select id="mq-${prefix}-mat">${matOpts()}</select></div>
            <div class="mq-field"><label class="mq-label">Finish</label>
              <select id="mq-${prefix}-fin"><option value="natural">Natural / stain</option><option value="painted">Painted</option><option value="two-tone">Two-tone</option></select></div>
          </div>
        </div>
        <div id="mq-${prefix}-diff" style="display:none">
          <div class="mq-sub-sec"><p class="mq-sub-title">Upper cabinets</p>
            <div class="mq-grid3">
              <div class="mq-field"><label class="mq-label">Door style</label><select id="mq-${prefix}-u-door">${doorOpts()}</select></div>
              <div class="mq-field"><label class="mq-label">Box material</label><select id="mq-${prefix}-u-mat">${matOpts()}</select></div>
              <div class="mq-field"><label class="mq-label">Finish</label><select id="mq-${prefix}-u-fin"><option value="natural">Natural / stain</option><option value="painted">Painted</option><option value="two-tone">Two-tone</option></select></div>
            </div>
          </div>
          <div class="mq-sub-sec" style="margin-top:8px"><p class="mq-sub-title">Base cabinets</p>
            <div class="mq-grid3">
              <div class="mq-field"><label class="mq-label">Door style</label><select id="mq-${prefix}-b-door">${doorOpts()}</select></div>
              <div class="mq-field"><label class="mq-label">Box material</label><select id="mq-${prefix}-b-mat">${matOpts()}</select></div>
              <div class="mq-field"><label class="mq-label">Finish</label><select id="mq-${prefix}-b-fin"><option value="natural">Natural / stain</option><option value="painted">Painted</option><option value="two-tone">Two-tone</option></select></div>
            </div>
          </div>
        </div>
      </div>
      <div class="mq-sec">
        <p class="mq-sec-title">Hardware & drawers</p>
        <div class="mq-grid3">
          <div class="mq-field"><label class="mq-label">Door hinges</label>
            <select id="mq-${prefix}-hinges"><option value="regular">Regular hinges</option><option value="softclose">Soft-close hinges</option></select></div>
          <div class="mq-field"><label class="mq-label">Drawer slides</label>
            <select id="mq-${prefix}-slides"><option value="softclose">Soft-close slides</option><option value="regular">Regular slides</option></select></div>
          <div class="mq-field"><label class="mq-label">Drawer box material</label>
            <select id="mq-${prefix}-dbox"><option value="melamine">White melamine</option><option value="birch">Prefinished birch</option></select></div>
        </div>
      </div>
      <div class="mq-sec">
        <p class="mq-sec-title">Specialty items — select and set quantity</p>
        <div class="mq-spec-grid" id="mq-${prefix}-spec-grid">${specHTML(specs, prefix)}</div>
      </div>`;
  }

  function countertopForm(prefix, pricing) {
    return `
      <div class="mq-sec">
        <p class="mq-sec-title">Countertop options</p>
        <div class="mq-grid2">
          <div class="mq-field"><label class="mq-label">Supply + install?</label>
            <select id="mq-${prefix}-ct-si"><option value="supply">Supply only</option><option value="install">Supply + install</option></select></div>
        </div>
      </div>
      <div class="mq-sec">
        <p class="mq-sec-title">Surfaces</p>
        <div id="mq-${prefix}-ct-surfaces"></div>
        <button class="mq-add-surface-btn" onclick="mqAddSurface('${prefix}')">+ Add another surface</button>
      </div>`;
  }

  function removalTravelForm(prefix, pricing) {
    return `
      <div class="mq-sec">
        <p class="mq-sec-title">Removal & travel</p>
        <div class="mq-grid2">
          <div class="mq-field"><label class="mq-label">Remove existing cabinets?</label>
            <select id="mq-${prefix}-removal"><option value="no">No removal needed</option><option value="yes">Yes — remove & dispose</option></select></div>
          <div class="mq-field"><label class="mq-label">Job location</label>
            <select id="mq-${prefix}-zone">
              <option value="local">Local (within ${pricing['Local zone radius'] || 15}km)</option>
              <option value="zone2">Zone 2</option>
              <option value="zone3">Zone 3</option>
              <option value="zone4">Zone 4 (100km+)</option>
            </select></div>
        </div>
      </div>`;
  }

  // ============================================================
  // BUILD FULL WIDGET HTML
  // ============================================================
  function buildWidgetHTML(shop, specs, pricing) {
    const logoHTML = shop['Logo URL']
      ? `<img src="${shop['Logo URL']}" alt="${shop['Shop name']}"/>`
      : `<span>${(shop['Shop name'] || 'S').charAt(0)}</span>`;

    const disc = shop['Disclaimer text'] || 'Ballpark estimate only. Contact us for a full quote.';

    return `
      <div class="mq-header">
        <div class="mq-logo">${logoHTML}</div>
        <div>
          <div class="mq-shop-name">${shop['Shop name'] || ''}</div>
          <div class="mq-shop-sub">${shop['City'] || ''} &nbsp;·&nbsp; ${shop['Phone'] || ''}</div>
        </div>
      </div>

      <div class="mq-tab-bar">
        <button class="mq-tab active" onclick="mqSwitchTab('cabinets',this)">
          <span class="mq-tab-icon">🪵</span>
          <span class="mq-tab-label"><span class="mq-tab-title">Cabinets</span><span class="mq-tab-sub">Cabinet quote only</span></span>
        </button>
        <button class="mq-tab" onclick="mqSwitchTab('countertops',this)">
          <span class="mq-tab-icon">🪨</span>
          <span class="mq-tab-label"><span class="mq-tab-title">Countertops</span><span class="mq-tab-sub">Countertop quote only</span></span>
        </button>
        <button class="mq-tab mq-tab-both" onclick="mqSwitchTab('both',this)">
          <span class="mq-tab-icon">✨</span>
          <span class="mq-tab-label"><span class="mq-tab-title">Both</span><span class="mq-tab-sub">Full project quote</span></span>
        </button>
      </div>

      <!-- CABINET TAB -->
      <div class="mq-tab-content active" id="mq-tab-cabinets">
        ${cabinetForm('c', specs, pricing)}
        ${removalTravelForm('c', pricing)}
        <button class="mq-calc-btn" id="mq-c-calc-btn" onclick="mqCalcCabinets()">Calculate cabinet estimate</button>
        <div class="mq-loading" id="mq-c-loading">Building your estimate...</div>
        <div class="mq-result" id="mq-c-result">
          <div class="mq-res-hdr">
            <div><p class="mq-res-title" id="mq-c-res-title">Cabinet estimate</p><p class="mq-res-sub" id="mq-c-res-sub">—</p></div>
            <div><div class="mq-res-range-lbl">Estimated range</div><div class="mq-res-range" id="mq-c-res-range">—</div></div>
          </div>
          <ul class="mq-line-items" id="mq-c-line-items"></ul>
          <div class="mq-disclaimer">⚠ ${disc}</div>
          <div class="mq-cta-row">
            <button onclick="mqSwitchTab('both',document.querySelectorAll('.mq-tab')[2])">Get full project quote ✨</button>
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
          </div>
        </div>
      </div>

      <!-- COUNTERTOP TAB -->
      <div class="mq-tab-content" id="mq-tab-countertops">
        <div class="mq-sec">
          <p class="mq-sec-title">Project options</p>
          <div class="mq-grid2">
            <div class="mq-field"><label class="mq-label">Supply + install?</label>
              <select id="mq-ct-si"><option value="supply">Supply only</option><option value="install">Supply + install</option></select></div>
            <div class="mq-field"><label class="mq-label">Job location</label>
              <select id="mq-ct-zone"><option value="local">Local</option><option value="zone2">Zone 2</option><option value="zone3">Zone 3</option><option value="zone4">Zone 4</option></select></div>
          </div>
        </div>
        <div class="mq-sec">
          <p class="mq-sec-title">Surfaces</p>
          <div id="mq-ct-surfaces"></div>
          <button class="mq-add-surface-btn" onclick="mqAddSurface('ct')">+ Add another surface</button>
        </div>
        <button class="mq-calc-btn" id="mq-ct-calc-btn" onclick="mqCalcCountertops()">Calculate countertop estimate</button>
        <div class="mq-loading" id="mq-ct-loading">Building your estimate...</div>
        <div class="mq-result" id="mq-ct-result">
          <div class="mq-res-hdr">
            <div><p class="mq-res-title">Countertop estimate</p><p class="mq-res-sub" id="mq-ct-res-sub">—</p></div>
            <div><div class="mq-res-range-lbl">Estimated range</div><div class="mq-res-range" id="mq-ct-res-range">—</div></div>
          </div>
          <ul class="mq-line-items" id="mq-ct-line-items"></ul>
          <div class="mq-disclaimer">⚠ Stone slabs vary by lot. Final pricing requires templating. Contact us to book.</div>
          <div class="mq-cta-row">
            <button onclick="mqSwitchTab('both',document.querySelectorAll('.mq-tab')[2])">Get full project quote ✨</button>
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
          </div>
        </div>
      </div>

      <!-- BOTH TAB -->
      <div class="mq-tab-content" id="mq-tab-both">
        <div class="mq-both-divider">
          <div class="mq-both-divider-line"></div>
          <div class="mq-both-divider-label">🪵 Cabinet details</div>
          <div class="mq-both-divider-line"></div>
        </div>
        ${cabinetForm('b', specs, pricing)}

        <div class="mq-both-divider">
          <div class="mq-both-divider-line"></div>
          <div class="mq-both-divider-label">🪨 Countertop details</div>
          <div class="mq-both-divider-line"></div>
        </div>
        ${countertopForm('b', pricing)}
        ${removalTravelForm('b', pricing)}

        <button class="mq-calc-btn mq-calc-btn-both" id="mq-b-calc-btn" onclick="mqCalcBoth()">
          Calculate full project estimate ✨
        </button>
        <div class="mq-loading" id="mq-b-loading">Building your full project estimate...</div>

        <div class="mq-combined-result" id="mq-b-result">
          <div class="mq-combined-title">✨ Full project estimate</div>
          <div class="mq-combined-section" id="mq-b-cab-section">
            <div class="mq-combined-section-title">🪵 Cabinets</div>
            <div id="mq-b-cab-rows"></div>
            <div class="mq-combined-subtotal"><span>Cabinet subtotal</span><span id="mq-b-cab-sub">—</span></div>
          </div>
          <div class="mq-combined-section" id="mq-b-ct-section">
            <div class="mq-combined-section-title">🪨 Countertops</div>
            <div id="mq-b-ct-rows"></div>
            <div class="mq-combined-subtotal"><span>Countertop subtotal</span><span id="mq-b-ct-sub">—</span></div>
          </div>
          <div class="mq-grand-total">
            <div>
              <div class="mq-grand-label">Total project estimate</div>
              <div class="mq-grand-sub">Before tax · Ballpark estimate only</div>
            </div>
            <div class="mq-grand-val" id="mq-b-grand">—</div>
          </div>
          <div class="mq-disclaimer" style="margin-top:1rem">⚠ ${disc}</div>
          <div class="mq-cta-row" style="margin-top:1rem">
            <button onclick="mqShowConsultModal()">Ask a question ↗</button>
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
          </div>
        </div>
      </div>

      <!-- LEAD MODAL -->
      <div class="mq-overlay" id="mq-lead-overlay">
        <div class="mq-modal">
          <p class="mq-modal-title">Almost there — one quick step</p>
          <p class="mq-modal-sub">Enter your details and we'll send you a copy of your estimate.</p>
          <div class="mq-modal-fields">
            <div class="mq-field"><label class="mq-label">Your name</label><input type="text" id="mq-lead-name" placeholder="Jane Smith"/></div>
            <div class="mq-field"><label class="mq-label">Email address</label><input type="email" id="mq-lead-email" placeholder="jane@email.com"/></div>
            <div class="mq-field"><label class="mq-label">Phone number</label><input type="tel" id="mq-lead-phone" placeholder="(555) 000-0000"/></div>
          </div>
          <button class="mq-modal-btn" onclick="mqSubmitLead()">Show my estimate →</button>
          <button class="mq-modal-skip" onclick="mqSkipLead()">Skip for now</button>
        </div>
      </div>`;
  }

  // ============================================================
  // WIRE ALL LOGIC
  // ============================================================
  function wireWidget(data) {
    const { shop, pricing, specs } = data;

    // Pricing tables
    const MAT = {
      melamine: pricing['Melamine price']    || 280,
      plywood:  pricing['Plywood price']     || 380,
      mdf:      pricing['MDF price']         || 350,
      solid:    pricing['Solid wood price']  || 550,
    };
    const DOOR = {
      slab:   pricing['Slab multiplier']   || 0,
      shaker: pricing['Shaker multiplier'] || 0,
      raised: pricing['Raised multiplier'] || 0,
      glass:  pricing['Glass multiplier']  || 0,
    };
    const FIN = {
      natural:    pricing['Natural finish add']    || 0,
      painted:    pricing['Painted finish add']    || 0,
      'two-tone': pricing['Two tone finish add']   || 0,
    };
    const CT_MAT = {
      lam:       { label:'Laminate',                    ps:pricing['Lam supply']       ||18,  pi:pricing['Lam install']       ||12 },
      ss_econ:   { label:'Solid surface — Economy',     ps:pricing['SS econ supply']   ||38,  pi:pricing['SS econ install']   ||18 },
      ss_mid:    { label:'Solid surface — Mid',         ps:pricing['SS mid supply']    ||58,  pi:pricing['SS mid install']    ||18 },
      ss_prem:   { label:'Solid surface — Premium',     ps:pricing['SS prem supply']   ||90,  pi:pricing['SS prem install']   ||22 },
      gran_econ: { label:'Granite — Economy',           ps:pricing['Gran econ supply'] ||45,  pi:pricing['Gran econ install'] ||25 },
      gran_mid:  { label:'Granite — Mid',               ps:pricing['Gran mid supply']  ||72,  pi:pricing['Gran mid install']  ||25 },
      gran_prem: { label:'Granite — Premium (Cambria)', ps:pricing['Gran prem supply'] ||130, pi:pricing['Gran prem install'] ||30 },
      quartz:    { label:'Engineered quartz',           ps:pricing['Quartz supply']    ||85,  pi:pricing['Quartz install']    ||25 },
      marble:    { label:'Marble',                      ps:pricing['Marble supply']    ||110, pi:pricing['Marble install']    ||30 },
      butcher:   { label:'Butcher block',               ps:pricing['Butcher supply']   ||42,  pi:pricing['Butcher install']   ||18 },
    };
    const EDGE  = { eased:pricing['Eased edge']||0, bevel:pricing['Bevel edge']||4, bullnose:pricing['Bullnose edge']||8, ogee:pricing['Ogee edge']||14, waterfall:pricing['Waterfall edge']||28 };
    const ZONE  = { local:0, zone2:pricing['Zone 2 surcharge']||320, zone3:pricing['Zone 3 surcharge']||680, zone4:pricing['Zone 4 surcharge']||1100 };
    const iRate = pricing['Install rate uppers'] || 85;
    const rRate = pricing['Removal rate']        || 18;
    const hAdd  = pricing['Soft close hinges']   || 12;
    const bAdd  = pricing['Birch drawer box']    || 15;
    const taxR  = (pricing['Tax rate'] || 5) / 100;
    const ctDepth = pricing['Default CT depth'] || 25.5;
    const bsRate  = pricing['Backsplash rate']   || 12;
    const sinkR   = pricing['Sink cutout']        || 180;
    const cookR   = pricing['Cooktop cutout']     || 220;

    // State — separate qty arrays for each tab prefix
    const diffOn  = {};
    const specQty = {};
    const surfCounts = {};
    const surfs = {};
    let pendingCb = null;

    ['c','ct','b'].forEach(p => {
      diffOn[p] = false;
      specQty[p] = new Array(specs.length).fill(0);
      surfCounts[p] = 0;
      surfs[p] = {};
    });

    function fmt(n) { return '$' + Math.round(n).toLocaleString(); }
    function gv(id) { const e = document.getElementById(id); return e ? e.value : ''; }
    function gn(id, d = 0) { const v = parseFloat(gv(id)); return isNaN(v) ? d : v; }

    // ---- TABS ----
    window.mqSwitchTab = function (id, el) {
      document.querySelectorAll('.mq-tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.mq-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('mq-tab-' + id).classList.add('active');
      el.classList.add('active');
    };

    // ---- DIFF TOGGLES ----
    window.mqTogDiff = function (prefix) {
      diffOn[prefix] = !diffOn[prefix];
      document.getElementById(`mq-${prefix}-diff-tog`).classList.toggle('on', diffOn[prefix]);
      document.getElementById(`mq-${prefix}-shared`).style.display = diffOn[prefix] ? 'none' : 'block';
      document.getElementById(`mq-${prefix}-diff`).style.display   = diffOn[prefix] ? 'block' : 'none';
    };

    // ---- SPEC ITEMS ----
    window.mqToggleSpec = (prefix, i) => {
      if (specQty[prefix][i] === 0) mqAdjQty(prefix, i, 1);
      else mqAdjQty(prefix, i, -specQty[prefix][i]);
    };
    window.mqAdjQty = (prefix, i, d) => {
      specQty[prefix][i] = Math.max(0, specQty[prefix][i] + d);
      document.getElementById(`mq-qty-${prefix}-${i}`).textContent = specQty[prefix][i];
      document.getElementById(`mq-sp-${prefix}-${i}`).classList.toggle('on', specQty[prefix][i] > 0);
    };

    // ---- LEAD MODAL ----
    window.mqShowLead      = cb => { pendingCb = cb; document.getElementById('mq-lead-overlay').classList.add('show'); };
    window.mqSkipLead      = () => { document.getElementById('mq-lead-overlay').classList.remove('show'); if (pendingCb) { pendingCb(null); pendingCb = null; } };
    window.mqSubmitLead    = async () => {
      const lead = { name: gv('mq-lead-name'), email: gv('mq-lead-email'), phone: gv('mq-lead-phone') };
      document.getElementById('mq-lead-overlay').classList.remove('show');
      if (pendingCb) { pendingCb(lead); pendingCb = null; }
    };
    window.mqShowConsultModal = () => window.mqShowLead(() => {});

    // ---- CABINET CALCULATION (shared logic) ----
    function calcCabinet(prefix) {
      const uFt   = gn(`mq-${prefix}-uft`, 0);
      const bFt   = gn(`mq-${prefix}-bft`, 0);
      const si    = gv(`mq-${prefix}-si`);
      const hMult = { standard: 1.0, tall: 1.15, mixed: 1.08 }[gv(`mq-${prefix}-ht`)];
      const ir    = si === 'install' ? iRate : 0;
      const ha    = gv(`mq-${prefix}-hinges`) === 'softclose' ? hAdd : 0;
      const ba    = gv(`mq-${prefix}-dbox`)   === 'birch'     ? bAdd : 0;

      let uDoor, uMat, uFin, bDoor, bMat, bFin;
      if (diffOn[prefix]) {
        uDoor = gv(`mq-${prefix}-u-door`); uMat = gv(`mq-${prefix}-u-mat`); uFin = gv(`mq-${prefix}-u-fin`);
        bDoor = gv(`mq-${prefix}-b-door`); bMat = gv(`mq-${prefix}-b-mat`); bFin = gv(`mq-${prefix}-b-fin`);
      } else {
        uDoor = bDoor = gv(`mq-${prefix}-door`);
        uMat  = bMat  = gv(`mq-${prefix}-mat`);
        uFin  = bFin  = gv(`mq-${prefix}-fin`);
      }

      const uPft = MAT[uMat] * hMult + (DOOR[uDoor] || 0) + (FIN[uFin] || 0) + ha + ba + ir;
      const bPft = MAT[bMat]          + (DOOR[bDoor] || 0) + (FIN[bFin] || 0) + ha + ba + ir;
      const uCost = uFt * uPft;
      const bCost = bFt * bPft;

      const lines = [];
      if (uFt > 0) lines.push({ label: `Upper cabinets (${uFt} lin ft)`, cost: Math.round(uCost) });
      if (bFt > 0) lines.push({ label: `Base cabinets (${bFt} lin ft)`,  cost: Math.round(bCost) });

      let specTotal = 0;
      const totalFt = uFt + bFt;
      specs.forEach((s, i) => {
        if (!specQty[prefix][i]) return;
        const cost = s.perFt ? s.price * totalFt * specQty[prefix][i] : s.price * specQty[prefix][i];
        specTotal += cost;
        lines.push({ label: specQty[prefix][i] > 1 ? `${s.label} × ${specQty[prefix][i]}` : s.label, cost: Math.round(cost) });
      });

      const remCost  = gv(`mq-${prefix}-removal`) === 'yes' ? (uFt + bFt) * rRate : 0;
      const zoneCost = ZONE[gv(`mq-${prefix}-zone`)] || 0;
      if (remCost  > 0) lines.push({ label: 'Cabinet removal', cost: Math.round(remCost) });
      if (zoneCost > 0) lines.push({ label: 'Travel surcharge', cost: zoneCost });

      const sub   = uCost + bCost + specTotal + remCost + zoneCost;
      const tax   = sub * taxR;
      lines.push({ label: 'Subtotal (before tax)', cost: Math.round(sub), bold: true });
      if (taxR > 0) lines.push({ label: `Est. tax (${Math.round(taxR * 100)}%)`, cost: Math.round(tax) });

      const total = sub + tax;
      const low   = Math.round(total * 0.9  / 100) * 100;
      const high  = Math.round(total * 1.25 / 100) * 100;

      const roomLabel = { kitchen:'Kitchen', bathroom:'Bathroom', laundry:'Laundry room', garage:'Garage', office:'Home office', other:'Room' }[gv(`mq-${prefix}-room`)];
      return { lines, sub: Math.round(sub), total: Math.round(total), low, high, roomLabel, si, uFt, bFt };
    }

    // ---- COUNTERTOP CALCULATION (shared logic) ----
    function calcCountertop(prefix) {
      const ctSiId   = prefix === 'ct' ? 'mq-ct-si'   : `mq-${prefix}-ct-si`;
      const ctZoneId = prefix === 'ct' ? 'mq-ct-zone' : `mq-${prefix}-zone`;
      const surfKey  = prefix;

      const lines = []; let sub = 0;
      Object.keys(surfs[surfKey]).forEach(id => {
        if (!document.getElementById('mqsc-' + id)) return;
        const type  = gv('mqst-' + id);
        const mat   = gv('mqsm-' + id);
        const edge  = gv('mqse-' + id);
        const siOv  = gv('mqssi-' + id);
        const si    = siOv === 'inherit' ? gv(ctSiId) : siOv;
        const m     = CT_MAT[mat] || CT_MAT.lam;
        let sqft = 0, linFt = 0;
        if (type === 'std') {
          linFt = gn('mqslft-' + id, 10);
          sqft  = linFt * (ctDepth / 12);
        } else {
          const w = gn('mqsw-' + id, 0), d = gn('mqsd-' + id, 0);
          sqft  = (w * d) / 144;
          linFt = w / 12;
        }
        const cost = sqft * m.ps
          + (si === 'install' ? sqft * m.pi : 0)
          + linFt * (EDGE[edge] || 0)
          + (document.getElementById('mqsbs-' + id).checked ? linFt * bsRate : 0)
          + (document.getElementById('mqsco-' + id).checked
            ? gn('mqssink-' + id) * sinkR + gn('mqscook-' + id) * cookR : 0);
        sub += cost;
        lines.push({ label: `${gv('mqsn-' + id) || 'Surface'} — ${m.label} (${Math.round(sqft * 10) / 10} sqft)`, cost: Math.round(cost) });
      });

      const zc = prefix === 'ct' ? (ZONE[gv('mq-ct-zone')] || 0) : 0;
      if (zc > 0) { lines.push({ label: 'Travel surcharge', cost: zc }); sub += zc; }
      const tax = sub * taxR;
      lines.push({ label: 'Subtotal (before tax)', cost: Math.round(sub), bold: true });
      if (taxR > 0) lines.push({ label: `Est. tax (${Math.round(taxR * 100)}%)`, cost: Math.round(tax) });

      const total = sub + tax;
      const low   = Math.round(total * 0.88 / 100) * 100;
      const high  = Math.round(total * 1.22 / 100) * 100;
      return { lines, sub: Math.round(sub), total: Math.round(total), low, high };
    }

    // ---- RENDER RESULT ----
    function renderResult(titleEl, subEl, rangeEl, listEl, result) {
      document.getElementById(rangeEl).textContent = fmt(result.low) + ' – ' + fmt(result.high);
      const ul = document.getElementById(listEl); ul.innerHTML = '';
      result.lines.forEach(l => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="mq-li-lbl" ${l.bold ? 'style="font-weight:600;color:#111"' : ''}>${l.label}</span><span ${l.bold ? 'style="font-weight:600"' : ''}>${fmt(l.cost)}</span>`;
        ul.appendChild(li);
      });
    }

    // ---- CABINET TAB CALC ----
    window.mqCalcCabinets = () => {
      window.mqShowLead(async lead => {
        document.getElementById('mq-c-calc-btn').disabled = true;
        document.getElementById('mq-c-loading').classList.add('show');
        document.getElementById('mq-c-result').classList.remove('show');

        const r = calcCabinet('c');
        document.getElementById('mq-c-res-title').textContent = r.roomLabel + ' cabinet estimate';
        document.getElementById('mq-c-res-sub').textContent   = `${r.uFt} ft uppers · ${r.bFt} ft bases · ${r.si === 'install' ? 'Supply + install' : 'Supply only'}`;
        renderResult('mq-c-res-title','mq-c-res-sub','mq-c-res-range','mq-c-line-items', r);

        document.getElementById('mq-c-loading').classList.remove('show');
        document.getElementById('mq-c-result').classList.add('show');
        document.getElementById('mq-c-calc-btn').disabled = false;

        if (lead) await saveLead(data, lead, 'Cabinets', r.low, r.high, r.lines);
      });
    };

    // ---- COUNTERTOP TAB CALC ----
    window.mqCalcCountertops = () => {
      if (!Object.keys(surfs['ct']).filter(id => document.getElementById('mqsc-' + id)).length) {
        alert('Please add at least one surface.'); return;
      }
      window.mqShowLead(async lead => {
        document.getElementById('mq-ct-calc-btn').disabled = true;
        document.getElementById('mq-ct-loading').classList.add('show');
        document.getElementById('mq-ct-result').classList.remove('show');

        setTimeout(async () => {
          const r = calcCountertop('ct');
          const active = Object.keys(surfs['ct']).filter(id => document.getElementById('mqsc-' + id)).length;
          document.getElementById('mq-ct-res-sub').textContent = `${active} surface(s) · ${gv('mq-ct-si') === 'install' ? 'Supply + install' : 'Supply only'}`;
          renderResult(null,null,'mq-ct-res-range','mq-ct-line-items', r);

          document.getElementById('mq-ct-loading').classList.remove('show');
          document.getElementById('mq-ct-result').classList.add('show');
          document.getElementById('mq-ct-calc-btn').disabled = false;

          if (lead) await saveLead(data, lead, 'Countertops', r.low, r.high, r.lines);
        }, 900);
      });
    };

    // ---- BOTH TAB CALC ----
    window.mqCalcBoth = () => {
      window.mqShowLead(async lead => {
        document.getElementById('mq-b-calc-btn').disabled = true;
        document.getElementById('mq-b-loading').classList.add('show');
        document.getElementById('mq-b-result').classList.remove('show');

        setTimeout(async () => {
          const cab = calcCabinet('b');
          const ct  = calcCountertop('b');

          // Render cabinet section
          const cabRows = document.getElementById('mq-b-cab-rows'); cabRows.innerHTML = '';
          cab.lines.filter(l => !l.bold).forEach(l => {
            const d = document.createElement('div');
            d.className = 'mq-combined-row';
            d.innerHTML = `<span class="mq-clbl">${l.label}</span><span>${fmt(l.cost)}</span>`;
            cabRows.appendChild(d);
          });
          document.getElementById('mq-b-cab-sub').textContent = fmt(cab.sub);

          // Render countertop section
          const ctRows = document.getElementById('mq-b-ct-rows'); ctRows.innerHTML = '';
          ct.lines.filter(l => !l.bold).forEach(l => {
            const d = document.createElement('div');
            d.className = 'mq-combined-row';
            d.innerHTML = `<span class="mq-clbl">${l.label}</span><span>${fmt(l.cost)}</span>`;
            ctRows.appendChild(d);
          });
          document.getElementById('mq-b-ct-sub').textContent = fmt(ct.sub);

          // Grand total
          const totalLow  = cab.low  + ct.low;
          const totalHigh = cab.high + ct.high;
          document.getElementById('mq-b-grand').textContent = fmt(totalLow) + ' – ' + fmt(totalHigh);

          document.getElementById('mq-b-loading').classList.remove('show');
          document.getElementById('mq-b-result').classList.add('show');
          document.getElementById('mq-b-calc-btn').disabled = false;

          if (lead) {
            const allLines = [
              { label: '— CABINETS —', cost: 0 }, ...cab.lines,
              { label: '— COUNTERTOPS —', cost: 0 }, ...ct.lines,
            ];
            await saveLead(data, lead, 'Cabinets + Countertops', totalLow, totalHigh, allLines);
          }
        }, 1200);
      });
    };

    // ---- SURFACE MANAGEMENT ----
    function addSurfaceInternal(prefix, name) {
      surfCounts[prefix]++;
      const id = `s${prefix}${surfCounts[prefix]}`;
      surfs[prefix][id] = 1;
      const names = ['Kitchen run','Island top','Bathroom vanity','Bar top','Custom surface'];
      const n = name || names[Math.min(surfCounts[prefix] - 1, names.length - 1)];
      const ctMats = ctMatOpts();
      const containerId = prefix === 'ct' ? 'mq-ct-surfaces' : `mq-${prefix}-ct-surfaces`;
      const card = document.createElement('div');
      card.className = 'mq-surface-card'; card.id = 'mqsc-' + id;
      card.innerHTML = `
        <div class="mq-surface-header">
          <div class="mq-surface-num">${surfCounts[prefix]}</div>
          <input id="mqsn-${id}" value="${n}" style="font-size:14px;font-weight:500;color:#111;background:none;border:none;outline:none;flex:1;font-family:inherit"/>
          <button class="mq-remove-btn" onclick="mqRemoveSurf('${prefix}','${id}')">Remove</button>
        </div>
        <div class="mq-grid3" style="margin-bottom:1rem">
          <div class="mq-field"><label class="mq-label">Type</label>
            <select id="mqst-${id}" onchange="mqTogDims('${id}')"><option value="std">Standard run (lin ft)</option><option value="cust">Custom (W×D inches)</option></select></div>
          <div class="mq-field" id="mqsf-${id}"><label class="mq-label">Linear feet</label><input type="number" id="mqslft-${id}" value="10" min="1"/></div>
          <div class="mq-field" id="mqcf-${id}" style="display:none"><label class="mq-label">Dimensions (inches)</label>
            <div style="display:flex;gap:6px;align-items:center"><input type="number" id="mqsw-${id}" placeholder="W" style="width:55px"/><span style="font-size:13px;color:#6b7280">×</span><input type="number" id="mqsd-${id}" placeholder="D" style="width:55px"/></div></div>
        </div>
        <div class="mq-grid3" style="margin-bottom:1rem">
          <div class="mq-field"><label class="mq-label">Material</label><select id="mqsm-${id}">${ctMats}</select></div>
          <div class="mq-field"><label class="mq-label">Edge profile</label>
            <select id="mqse-${id}"><option value="eased">Eased</option><option value="bevel">Bevel</option><option value="bullnose">Bullnose</option><option value="ogee">Ogee</option><option value="waterfall">Waterfall</option></select></div>
          <div class="mq-field"><label class="mq-label">Install</label>
            <select id="mqssi-${id}"><option value="inherit">Same as project</option><option value="supply">Supply only</option><option value="install">Supply + install</option></select></div>
        </div>
        <div class="mq-divider"></div>
        <div style="display:flex;gap:2rem;flex-wrap:wrap">
          <label class="mq-check-row"><input type="checkbox" id="mqsbs-${id}"/> Backsplash (4" standard)</label>
          <label class="mq-check-row"><input type="checkbox" id="mqsco-${id}" onchange="mqTogCuts('${id}')"/> Cutouts needed</label>
        </div>
        <div id="mqscuts-${id}" style="display:none;margin-top:8px;padding:10px 12px;background:#f9fafb;border-radius:6px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><label style="font-size:13px;color:#6b7280;min-width:110px">Sink cutouts</label><input type="number" id="mqssink-${id}" value="0" min="0" max="4" style="width:55px"/></div>
          <div style="display:flex;align-items:center;gap:8px"><label style="font-size:13px;color:#6b7280;min-width:110px">Cooktop cutouts</label><input type="number" id="mqscook-${id}" value="0" min="0" max="2" style="width:55px"/></div>
        </div>`;
      document.getElementById(containerId).appendChild(card);
    }

    window.mqAddSurface = (prefix) => addSurfaceInternal(prefix);
    window.mqRemoveSurf = (prefix, id) => {
      const c = document.getElementById('mqsc-' + id);
      if (c) c.remove();
      delete surfs[prefix][id];
    };
    window.mqTogDims = id => {
      const t = gv('mqst-' + id);
      document.getElementById('mqsf-' + id).style.display = t === 'std' ? 'flex' : 'none';
      document.getElementById('mqcf-' + id).style.display = t === 'cust' ? 'flex' : 'none';
    };
    window.mqTogCuts = id => {
      document.getElementById('mqscuts-' + id).style.display =
        document.getElementById('mqsco-' + id).checked ? 'block' : 'none';
    };

    // Add default surfaces
    addSurfaceInternal('ct', 'Kitchen run');
    addSurfaceInternal('b',  'Kitchen run');
  }

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    const data = await loadShopData(shopToken);
    if (!data) return;
    const { shop, pricing, specs } = data;
    const container = document.getElementById('midasquote-widget');
    if (!container) {
      console.error('MidasQuote: Add <div id="midasquote-widget"></div> to your page.');
      return;
    }
    injectStyles(shop['Brand colour'] || '#1a1a1a');
    container.innerHTML = buildWidgetHTML(shop, specs, pricing);
    wireWidget(data);
  }

  init();

})();