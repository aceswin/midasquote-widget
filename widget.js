/*
 * MidasQuote Widget v3.3
 */

(function() {

  const CONFIG = {
    AIRTABLE_TOKEN:  'patulbU1ndSvFpMDo.906a8be9e784fb12de048d4238c5d553859f8d57670ccd1bc1a6de4e2da37325',
    BASE_ID:         'app4zrMlVLwF2xn4h',
    SHOPS_TABLE:     'tbl8PoF2Mu3sAdlMs',
    PRICING_TABLE:   'tblu6AYZs8h7SIaQl',
    SPECIALTY_TABLE: 'tbloaXeEM5K7TOZCD',
    LEADS_TABLE:     'tblPcoTI8zCCHLICi',
    LINE_ITEMS_TABLE:'tblCkJsJ2OC6DgXok',
    EMAIL_WORKER:    'https://midasquote-email.jordan132001.workers.dev',
  };

  const scriptTag = document.currentScript;
  const shopToken = new URLSearchParams(scriptTag.src.split('?')[1] || '').get('shop');
  if (!shopToken) { console.error('MidasQuote: No shop token found.'); return; }

  const AT_BASE = `https://api.airtable.com/v0/${CONFIG.BASE_ID}`;
  const AT_HEADS = { 'Authorization': `Bearer ${CONFIG.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' };

  async function atGet(table, formula) {
    const url = `${AT_BASE}/${table}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=200`;
    const res = await fetch(url, { headers: AT_HEADS });
    const data = await res.json();
    return data.records || [];
  }

  async function atCreate(table, fields) {
    const res = await fetch(`${AT_BASE}/${table}`, { method:'POST', headers:AT_HEADS, body:JSON.stringify({fields}) });
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

    const pricing = await atGet(CONFIG.PRICING_TABLE, `FIND("${shop['Shop name']}", ARRAYJOIN({Shop}))`);
    const p = pricing.length ? pricing[0].fields : {};

    const lineItemRecords = await atGet(CONFIG.LINE_ITEMS_TABLE, `FIND("${shop['Shop name']}", ARRAYJOIN({shop}))`);
    const sorted = lineItemRecords.filter(r=>r.fields).sort((a,b)=>(a.fields['Sort order']||0)-(b.fields['Sort order']||0));
    const byCategory = cat => sorted.filter(r=>r.fields['Category']===cat).map(r=>r.fields);

    const rawMaterials = byCategory('material');
    const matSeen = new Set();
    const dedupedMaterials = rawMaterials.reduce((acc, m) => {
      const baseName = m['Name'].replace(/\s*—\s*(uppers|bases).*$/i, '').trim();
      if (!matSeen.has(baseName)) { matSeen.add(baseName); acc.push({ ...m, _baseName: baseName }); }
      return acc;
    }, []);

    const li = {
      materials:       dedupedMaterials,
      rawMaterials:    rawMaterials,
      doorStyles:      byCategory('door'),
      drawers:         byCategory('drawer'),
      hinges:          byCategory('hinge'),
      installItems:    byCategory('install'),
      taxItems:        byCategory('tax'),
      otherItems:      byCategory('other'),
      countertopItems: byCategory('countertop'),
    };

    const localZone = sorted.find(r=>r.fields['Category']==='zone'&&r.fields['Name']?.toLowerCase().includes('local'));
    li.localRadius = localZone?.['Rate'] || 15;

    const hasDynamic = li.materials.length > 0;

    const specRecords = await atGet(CONFIG.SPECIALTY_TABLE, `AND(FIND("${shop['Shop name']}", ARRAYJOIN({Shop})), {Active})`);
    const specs = specRecords
      .sort((a,b)=>(a.fields['Sort order']||0)-(b.fields['Sort order']||0))
      .map(r=>({ id:r.id, label:r.fields['Item name']||r.fields['Special Items'], price:r.fields['Price']||0, perFt:r.fields['Per linear foot']||false }));

    return { shop, pricing:p, specs, li, hasDynamic };
  }

  // ============================================================
  // EMAIL & LEAD
  // ============================================================
  async function saveLead(data, lead, quoteType, low, high, lines) {
    const { shop } = data;
    try {
      await atCreate(CONFIG.LEADS_TABLE, {
        'Lead ID':`${lead.name} — ${new Date().toLocaleDateString()}`,
        'Shop':[shop._recordId], 'Customer name':lead.name,
        'Customer email':lead.email, 'Customer phone':lead.phone,
        'Quote type':quoteType, 'Estimate low':low, 'Estimate high':high,
        'Quote details':JSON.stringify(lines), 'Source':'Website', 'Status':'New',
      });
    } catch(e) { console.error('Lead save failed', e); }

    const lineRows = (lines||[]).filter(l=>l&&l.label&&l.cost!==undefined)
      .map(l=>`<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">${l.label}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;${l.bold?'font-weight:700;color:#111':''}">${'$'}${Math.round(l.cost).toLocaleString()}</td></tr>`).join('');

    await sendEmail(shop['Lead notify email'], `New ${quoteType} quote lead — ${lead.name}`,
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1a1a1a">New ${quoteType} quote lead</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600" colspan="2">Customer details</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Name</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.name}</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Email</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.email}</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Phone</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.phone}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600" colspan="2">Quote breakdown</td></tr>${lineRows}
        </table>
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:13px;color:#666;margin-bottom:4px">Estimated range</div>
          <div style="font-size:28px;font-weight:700;color:#16a34a">$${low.toLocaleString()} – $${high.toLocaleString()}</div>
        </div>
      </div>`);

    if (lead.email) {
      await sendEmail(lead.email, `Your quote from ${shop['Shop name']}`,
        `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#1a1a1a">Your ${quoteType} quote from ${shop['Shop name']}</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="padding:8px;background:#f9fafb;font-weight:600" colspan="2">Quote breakdown</td></tr>${lineRows}
          </table>
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px">
            <div style="font-size:28px;font-weight:700;color:#16a34a">$${low.toLocaleString()} – $${high.toLocaleString()}</div>
          </div>
          <p style="color:#666;font-size:13px">${shop['Disclaimer text']||'Ballpark estimate only. Contact us for a full quote.'}</p>
          <p style="color:#666;font-size:13px;margin-top:8px">⚠ Jobs outside our local delivery area may be subject to additional travel charges — your final quote will confirm the exact amount.</p>
          <p style="color:#666;font-size:13px"><strong>${shop['Shop name']}</strong><br/>${shop['Phone']||''}</p>
        </div>`);
    }
  }

  async function sendEmail(to, subject, html) {
    if (!CONFIG.EMAIL_WORKER||!to) return;
    try { await fetch(CONFIG.EMAIL_WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,subject,html})}); }
    catch(e) { console.error('Email failed',e); }
  }

  // ============================================================
  // STYLES
  // ============================================================
  function injectStyles(bc) {
    const s = document.createElement('style');
    s.textContent = `
      #midasquote-widget *{box-sizing:border-box;margin:0;padding:0}
      #midasquote-widget{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff}
      #midasquote-widget .mq-header{display:flex;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid #e5e7eb;gap:12px}
      #midasquote-widget .mq-logo{width:36px;height:36px;border-radius:8px;background:${bc};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;flex-shrink:0;overflow:hidden}
      #midasquote-widget .mq-logo img{width:100%;height:100%;object-fit:cover}
      #midasquote-widget .mq-shop-name{font-size:14px;font-weight:600;color:#111}
      #midasquote-widget .mq-shop-sub{font-size:12px;color:#6b7280}
      #midasquote-widget .mq-tab-bar{display:flex;background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:10px 1.5rem;gap:8px}
      #midasquote-widget .mq-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;border:1px solid #e5e7eb;border-radius:8px;background:#fff;transition:all 0.15s;font-family:inherit}
      #midasquote-widget .mq-tab.active{background:${bc};color:#fff;border-color:${bc}}
      #midasquote-widget .mq-tab-icon{font-size:18px;flex-shrink:0}
      #midasquote-widget .mq-tab-label{display:flex;flex-direction:column;align-items:flex-start;gap:1px}
      #midasquote-widget .mq-tab-title{font-size:13px;font-weight:500;line-height:1}
      #midasquote-widget .mq-tab-sub{font-size:10px;opacity:0.7;line-height:1}
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
      #midasquote-widget input:focus,#midasquote-widget select:focus{outline:none;border-color:${bc}}
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
      #midasquote-widget .mq-tog.on{background:${bc}}
      #midasquote-widget .mq-tog::after{content:'';position:absolute;width:16px;height:16px;background:#fff;border-radius:50%;top:2px;left:2px;transition:left 0.2s}
      #midasquote-widget .mq-tog.on::after{left:18px}
      #midasquote-widget .mq-sub-sec{background:#f9fafb;border-radius:8px;padding:1rem;margin-top:0.75rem}
      #midasquote-widget .mq-sub-title{font-size:11px;font-weight:600;color:#6b7280;margin:0 0 0.75rem;text-transform:uppercase;letter-spacing:0.05em}
      #midasquote-widget .mq-calc-btn{width:100%;padding:13px;font-size:15px;font-weight:600;background:${bc};color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:0.5rem;transition:opacity 0.15s;font-family:inherit}
      #midasquote-widget .mq-calc-btn:hover{opacity:0.88}
      #midasquote-widget .mq-calc-btn:disabled{opacity:0.4;cursor:not-allowed}
      #midasquote-widget .mq-calc-btn-both{background:linear-gradient(135deg,${bc},#378ADD)}
      #midasquote-widget .mq-result{display:none;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1.25rem;margin-top:1rem}
      #midasquote-widget .mq-result.show{display:block}
      #midasquote-widget .mq-res-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #e5e7eb}
      #midasquote-widget .mq-res-title{font-size:15px;font-weight:600;color:#111;margin-bottom:3px}
      #midasquote-widget .mq-res-sub{font-size:13px;color:#6b7280}
      #midasquote-widget .mq-res-range{font-size:22px;font-weight:700;color:${bc};text-align:right}
      #midasquote-widget .mq-res-range-lbl{font-size:12px;color:#6b7280;text-align:right}
      #midasquote-widget .mq-line-items{list-style:none;padding:0;margin:0 0 1rem}
      #midasquote-widget .mq-line-items li{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid #f3f4f6}
      #midasquote-widget .mq-line-items li:last-child{border-bottom:none}
      #midasquote-widget .mq-li-lbl{color:#6b7280}
      #midasquote-widget .mq-disclaimer{font-size:12px;color:#6b7280;background:#f9fafb;border-radius:6px;padding:10px 12px;margin-top:1rem;line-height:1.5}
      #midasquote-widget .mq-travel-note{font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;margin-top:8px;line-height:1.5}
      #midasquote-widget .mq-cta-row{display:flex;gap:8px;margin-top:1rem}
      #midasquote-widget .mq-cta-row button{flex:1;padding:10px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer;border:1px solid #d1d5db;background:#fff;color:#111;font-family:inherit}
      #midasquote-widget .mq-pri{background:${bc}!important;color:#fff!important;border-color:${bc}!important}
      #midasquote-widget .mq-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;padding:1rem}
      #midasquote-widget .mq-overlay.show{display:flex}
      #midasquote-widget .mq-modal{background:#f8faff;border-radius:12px;padding:1.5rem;width:90%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.18);position:relative;margin:auto}
      #midasquote-widget .mq-modal-title{font-size:16px;font-weight:600;color:#111;margin-bottom:4px}
      #midasquote-widget .mq-modal-sub{font-size:13px;color:#6b7280;margin-bottom:1.25rem;line-height:1.5}
      #midasquote-widget .mq-modal-fields{display:flex;flex-direction:column;gap:10px;margin-bottom:1.25rem}
      #midasquote-widget .mq-modal-btn{width:100%;padding:11px;font-size:14px;font-weight:600;background:${bc};color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit}
      #midasquote-widget .mq-modal-skip{width:100%;padding:8px;font-size:13px;color:#6b7280;background:none;border:none;cursor:pointer;margin-top:6px;font-family:inherit}
      #midasquote-widget .mq-surface-card{border:1px solid #e5e7eb;border-radius:10px;padding:1rem;margin-bottom:10px}
      #midasquote-widget .mq-surface-header{display:flex;align-items:center;gap:8px;margin-bottom:1rem}
      #midasquote-widget .mq-surface-num{width:24px;height:24px;border-radius:50%;background:${bc};color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      #midasquote-widget .mq-remove-btn{font-size:12px;color:#6b7280;background:none;border:1px solid #e5e7eb;border-radius:6px;padding:3px 10px;cursor:pointer;font-family:inherit}
      #midasquote-widget .mq-add-surface-btn{width:100%;padding:10px;font-size:13px;border:1px dashed #d1d5db;border-radius:8px;background:none;color:#6b7280;cursor:pointer;margin-top:4px;font-family:inherit}
      #midasquote-widget .mq-divider{height:1px;background:#e5e7eb;margin:1rem 0}
      #midasquote-widget .mq-check-row{display:flex;align-items:center;gap:8px;font-size:13px;color:#111;cursor:pointer;padding:5px 0}
      #midasquote-widget .mq-loading{display:none;text-align:center;padding:2rem;color:#6b7280;font-size:14px}
      #midasquote-widget .mq-loading.show{display:block}
      #midasquote-widget .mq-both-divider{display:flex;align-items:center;gap:12px;margin:1.5rem 0 1rem}
      #midasquote-widget .mq-both-divider-line{flex:1;height:1px;background:#e5e7eb}
      #midasquote-widget .mq-both-divider-label{font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;padding:4px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:20px}
      #midasquote-widget .mq-combined-result{display:none;background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #86efac;border-radius:10px;padding:1.5rem;margin-top:1rem}
      #midasquote-widget .mq-combined-result.show{display:block}
      #midasquote-widget .mq-combined-title{font-size:14px;font-weight:600;color:#166534;margin-bottom:1rem}
      #midasquote-widget .mq-combined-section{margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(134,239,172,0.5)}
      #midasquote-widget .mq-combined-section:last-of-type{border-bottom:none;margin-bottom:0;padding-bottom:0}
      #midasquote-widget .mq-combined-section-title{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px}
      #midasquote-widget .mq-combined-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
      #midasquote-widget .mq-combined-row .mq-clbl{color:#6b7280}
      #midasquote-widget .mq-combined-subtotal{display:flex;justify-content:space-between;font-size:13px;font-weight:600;padding:6px 0;border-top:1px solid rgba(134,239,172,0.5);margin-top:4px}
      #midasquote-widget .mq-grand-total{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;background:#fff;border-radius:8px;margin-top:1rem;border:1px solid #86efac}
      #midasquote-widget .mq-grand-label{font-size:15px;font-weight:600;color:#111}
      #midasquote-widget .mq-grand-sub{font-size:12px;color:#6b7280;margin-top:2px}
      #midasquote-widget .mq-grand-val{font-size:26px;font-weight:700;color:${bc};text-align:right}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // MODULE-LEVEL CT_MAT — populated before buildWidgetHTML runs
  // ============================================================
  let CT_MAT = {};

  function buildCTMAT(data) {
    const { li, pricing } = data;
    CT_MAT = {};
    const hasDynamicCT = li.countertopItems.length > 0;
    if (hasDynamicCT) {
      li.countertopItems
        .filter(item => {
          const desc = item['Description']||'';
          return desc.includes('type:material') || (!desc.includes('type:backsplash') && !desc.includes('type:cutout'));
        })
        .forEach((item, i) => {
          const unitParts = (item['Unit']||'sqft|sqft').split('|');
          CT_MAT[`ct_${i}`] = {
            label:       item['Name'],
            ps:          item['Rate']||0,
            pi:          item['Install rate']||0,
            supplyUnit:  (unitParts[0]||'sqft').trim(),
            installUnit: (unitParts[1]||'sqft').trim(),
          };
        });
    } else {
      CT_MAT['lam']       = {label:'Laminate',                ps:pricing['Lam supply']||18,   pi:12, supplyUnit:'sqft', installUnit:'sqft'};
      CT_MAT['ss_econ']   = {label:'Solid surface — Economy', ps:pricing['SS econ supply']||38, pi:18, supplyUnit:'sqft', installUnit:'sqft'};
      CT_MAT['ss_mid']    = {label:'Solid surface — Mid',     ps:pricing['SS mid supply']||58,  pi:18, supplyUnit:'sqft', installUnit:'sqft'};
      CT_MAT['ss_prem']   = {label:'Solid surface — Premium', ps:pricing['SS prem supply']||90, pi:22, supplyUnit:'sqft', installUnit:'sqft'};
      CT_MAT['gran_econ'] = {label:'Granite — Economy',       ps:pricing['Gran econ supply']||45,  pi:25, supplyUnit:'sqft', installUnit:'sqft'};
      CT_MAT['gran_mid']  = {label:'Granite — Mid',           ps:pricing['Gran mid supply']||72,   pi:25, supplyUnit:'sqft', installUnit:'sqft'};
      CT_MAT['gran_prem'] = {label:'Granite — Premium',       ps:pricing['Gran prem supply']||130, pi:30, supplyUnit:'sqft', installUnit:'sqft'};
      CT_MAT['quartz']    = {label:'Engineered quartz',       ps:pricing['Quartz supply']||85,  pi:25, supplyUnit:'sqft', installUnit:'sqft'};
      CT_MAT['marble']    = {label:'Marble',                  ps:pricing['Marble supply']||110, pi:30, supplyUnit:'sqft', installUnit:'sqft'};
      CT_MAT['butcher']   = {label:'Butcher block',           ps:pricing['Butcher supply']||42, pi:18, supplyUnit:'sqft', installUnit:'sqft'};
    }
  }

  function ctMatOpts() {
    return Object.entries(CT_MAT).map(([k,m])=>`<option value="${k}">${m.label}</option>`).join('') ||
      `<option value="lam">Laminate</option>`;
  }

  // ============================================================
  // BUILD WIDGET HTML
  // ============================================================
  function makeOpts(items, fallbackOpts) {
    if (items && items.length > 0) return items.map((m,i)=>`<option value="dyn_${i}">${m._baseName || m['Name']}</option>`).join('');
    return fallbackOpts || '';
  }

  function specHTML(specs, prefix) {
    if (!specs.length) return '<p style="font-size:13px;color:#6b7280">No specialty items configured yet.</p>';
    return specs.map((s,i)=>`
      <div class="mq-spec-item" id="mq-sp-${prefix}-${i}">
        <div style="flex:1;min-width:0">
          <span class="mq-spec-name" onclick="mqToggleSpec('${prefix}',${i})">${s.label}</span>
          <div style="font-size:11px;color:#9ca3af;margin-top:1px">${s.perFt ? 'linear feet' : 'quantity'}</div>
        </div>
        <div class="mq-qty-ctrl">
          <button class="mq-qty-btn" onclick="mqAdjQty('${prefix}',${i},-1)">−</button>
          <span class="mq-qty-val" id="mq-qty-${prefix}-${i}">0</span>
          <button class="mq-qty-btn" onclick="mqAdjQty('${prefix}',${i},1)">+</button>
        </div>
      </div>`).join('');
  }

  function cabinetForm(prefix, specs, data) {
    const { li, hasDynamic } = data;
    const mOpts = makeOpts(li.materials, '<option value="melamine">Melamine</option><option value="plywood">Plywood</option>');
    const dOpts = `<option value="none">No doors</option>` + makeOpts(li.doorStyles, '<option value="slab">Slab</option><option value="shaker">Shaker</option>');
    const hingeOpts = makeOpts(li.hinges, '<option value="softclose">Soft-close</option><option value="regular">Regular</option>');
    const hasDrawers = li.drawers.length > 0;
    const hasHinges  = li.hinges.length > 0;
    const hasInstall = !hasDynamic || li.installItems.length > 0;
    const drawerConfigNames = [...new Set(li.drawers.map(d => d['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim()))];
    const drawerConfigOpts = drawerConfigNames.map((n,i) => `<option value="${i}">${n}</option>`).join('');

    return `
      <div class="mq-sec">
        <p class="mq-sec-title">Project basics</p>
        <div class="mq-grid2">
          <div class="mq-field"><label class="mq-label">Room type</label>
            <select id="mq-${prefix}-room"><option value="kitchen">Kitchen</option><option value="bathroom">Bathroom</option><option value="laundry">Laundry room</option><option value="garage">Garage</option><option value="office">Home office</option><option value="other">Other</option></select></div>
          ${hasInstall?`<div class="mq-field"><label class="mq-label">Supply + install?</label>
            <select id="mq-${prefix}-si"><option value="supply">Supply only</option><option value="install">Supply + install</option></select></div>`:''}
        </div>
      </div>
      <div class="mq-sec">
        <p class="mq-sec-title">Cabinet measurements</p>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;margin-bottom:1rem;font-size:12px;color:#92400e;line-height:1.5">
          💡 Uppers and bases measured separately. <strong>Include island cabinets in your base linear footage.</strong>
        </div>
        <div class="mq-grid3">
          <div class="mq-field"><label class="mq-label">Upper cabinets (lin ft)</label><input type="number" id="mq-${prefix}-uft" value="10" min="0" max="60"/></div>
          <div class="mq-field"><label class="mq-label">Base cabinets (lin ft)</label><input type="number" id="mq-${prefix}-bft" value="10" min="0" max="60"/></div>
          <div class="mq-field"><label class="mq-label">Height</label>
            <select id="mq-${prefix}-ht"><option value="standard">Standard (30")</option><option value="tall">Tall (36–40")</option></select></div>
        </div>
        <div class="mq-tog-row" onclick="mqTogDiff('${prefix}')">
          <div class="mq-tog" id="mq-${prefix}-diff-tog"></div>
          <label style="font-size:13px;cursor:pointer">Different styles for uppers and lowers</label>
        </div>
        <div id="mq-${prefix}-shared">
          <div class="mq-grid3">
            <div class="mq-field"><label class="mq-label">Box material</label><select id="mq-${prefix}-mat">${mOpts}</select></div>
            <div class="mq-field"><label class="mq-label">Door style</label><select id="mq-${prefix}-door">${dOpts}</select></div>
            ${hasHinges?`<div class="mq-field"><label class="mq-label">Door hinges</label><select id="mq-${prefix}-hinge">${hingeOpts}</select></div>`:''}
          </div>
        </div>
        <div id="mq-${prefix}-diff" style="display:none">
          <div class="mq-sub-sec"><p class="mq-sub-title">Upper cabinets</p>
            <div class="mq-grid3">
              <div class="mq-field"><label class="mq-label">Box material</label><select id="mq-${prefix}-u-mat">${mOpts}</select></div>
              <div class="mq-field"><label class="mq-label">Door style</label><select id="mq-${prefix}-u-door">${dOpts}</select></div>
              ${hasHinges?`<div class="mq-field"><label class="mq-label">Door hinges</label><select id="mq-${prefix}-u-hinge">${hingeOpts}</select></div>`:''}
            </div>
          </div>
          <div class="mq-sub-sec" style="margin-top:8px"><p class="mq-sub-title">Base cabinets</p>
            <div class="mq-grid3">
              <div class="mq-field"><label class="mq-label">Box material</label><select id="mq-${prefix}-b-mat">${mOpts}</select></div>
              <div class="mq-field"><label class="mq-label">Door style</label><select id="mq-${prefix}-b-door">${dOpts}</select></div>
              ${hasHinges?`<div class="mq-field"><label class="mq-label">Door hinges</label><select id="mq-${prefix}-b-hinge">${hingeOpts}</select></div>`:''}
            </div>
          </div>
        </div>
      </div>
      ${hasDrawers?`<div class="mq-sec">
        <p class="mq-sec-title">Drawers</p>
        <div class="mq-grid2">
          <div class="mq-field"><label class="mq-label">Drawer amount</label>
            <select id="mq-${prefix}-drawer-tier" onchange="mqTogDrawerConfig('${prefix}')">
              <option value="none">No drawers</option>
              <option value="some">Some drawers</option>
              <option value="mostly">Mostly drawers</option>
            </select>
          </div>
          <div class="mq-field" id="mq-${prefix}-drawer-config-wrap" style="display:none">
            <label class="mq-label">Drawer type</label>
            <select id="mq-${prefix}-drawer-config">${drawerConfigOpts}</select>
          </div>
        </div>
      </div>`:''}
      <div class="mq-sec">
        <p class="mq-sec-title">Removal</p>
        <div class="mq-grid2">
          <div class="mq-field"><label class="mq-label">Remove existing cabinets?</label>
            <select id="mq-${prefix}-removal"><option value="no">No removal needed</option><option value="yes">Yes — remove & dispose</option></select></div>
        </div>
      </div>
      <div class="mq-sec">
        <p class="mq-sec-title">Specialty items</p>
        <div class="mq-spec-grid">${specHTML(specs, prefix)}</div>
      </div>`;
  }

  const TRAVEL_NOTE = '🚗 This estimate is based on local delivery. Jobs outside our local area may be subject to additional travel charges — your final quote will confirm the exact amount.';

  function buildWidgetHTML(shop, specs, data) {
    const logoHTML = shop['Logo URL'] ? `<img src="${shop['Logo URL']}" alt="${shop['Shop name']}"/>` : `<span>${(shop['Shop name']||'S').charAt(0)}</span>`;
    const disc = shop['Disclaimer text'] || 'Ballpark estimate only. Contact us for a full quote.';

    return `
      <div class="mq-header">
        <div class="mq-logo">${logoHTML}</div>
        <div style="flex:1">
          <div class="mq-shop-name">${shop['Shop name']||''}</div>
          <div class="mq-shop-sub">${shop['City']||''} &nbsp;·&nbsp; ${shop['Phone']||''}</div>
        </div>
        ${shop['Show showroom'] !== false && shop['Shop token'] ? `<a href="https://widget.midasquote.com/showroom.html?shop=${shop['Shop token']}" target="_blank" style="font-size:12px;font-weight:600;color:#fff;text-decoration:none;background:${shop['Brand colour']||'#1a1a1a'};border-radius:20px;padding:7px 14px;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:6px;transition:opacity 0.15s;box-shadow:0 2px 8px rgba(0,0,0,0.15)" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">🖼️ Browse our products</a>` : ''}
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
        <button class="mq-tab" onclick="mqSwitchTab('both',this)">
          <span class="mq-tab-icon">✨</span>
          <span class="mq-tab-label"><span class="mq-tab-title">Both</span><span class="mq-tab-sub">Full project quote</span></span>
        </button>
      </div>

      <!-- CABINET TAB -->
      <div class="mq-tab-content active" id="mq-tab-cabinets">
        ${cabinetForm('c', specs, data)}
        <button class="mq-calc-btn" id="mq-c-calc-btn" onclick="mqCalcCabinets()">Calculate cabinet estimate</button>
        <div class="mq-loading" id="mq-c-loading">Building your estimate...</div>
        <div class="mq-result" id="mq-c-result">
          <div class="mq-res-hdr">
            <div><p class="mq-res-title" id="mq-c-res-title">Cabinet estimate</p><p class="mq-res-sub" id="mq-c-res-sub">—</p></div>
            <div><div class="mq-res-range-lbl">Estimated range</div><div class="mq-res-range" id="mq-c-res-range">—</div></div>
          </div>
          <ul class="mq-line-items" id="mq-c-line-items"></ul>
          <div class="mq-disclaimer">⚠ ${disc}</div>
          <div class="mq-travel-note">${TRAVEL_NOTE}</div>
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
          <div class="mq-disclaimer">⚠ Stone slabs vary by lot. Final pricing requires templating.</div>
          <div class="mq-travel-note">${TRAVEL_NOTE}</div>
          <div class="mq-cta-row">
            <button onclick="mqSwitchTab('both',document.querySelectorAll('.mq-tab')[2])">Get full project quote ✨</button>
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
          </div>
        </div>
      </div>

      <!-- BOTH TAB -->
      <div class="mq-tab-content" id="mq-tab-both">
        <div class="mq-both-divider"><div class="mq-both-divider-line"></div><div class="mq-both-divider-label">🪵 Cabinet details</div><div class="mq-both-divider-line"></div></div>
        ${cabinetForm('b', specs, data)}
        <div class="mq-both-divider"><div class="mq-both-divider-line"></div><div class="mq-both-divider-label">🪨 Countertop details</div><div class="mq-both-divider-line"></div></div>
        <div class="mq-sec"><p class="mq-sec-title">Countertop options</p>
          <div class="mq-grid2">
            <div class="mq-field"><label class="mq-label">Supply + install?</label>
              <select id="mq-b-ct-si"><option value="supply">Supply only</option><option value="install">Supply + install</option></select></div>
          </div>
          <label style="display:flex;align-items:flex-start;gap:10px;margin-top:0.75rem;cursor:pointer">
            <input type="checkbox" id="mq-b-use-cab" onchange="mqTogUseCab('b')" style="margin-top:2px;flex-shrink:0;width:auto"/>
            <span style="font-size:13px;font-weight:500;line-height:1.4">Use my base cabinet measurements <span style="font-weight:400;color:#9ca3af">(assumes 25" depth)</span></span>
          </label>
          <div id="mq-b-cab-mat" style="display:none;margin-top:0.75rem">
            <div class="mq-field" style="margin-bottom:0.75rem"><label class="mq-label">Countertop material</label><select id="mq-b-ct-mat-cab">${ctMatOpts()}</select></div>
            <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:0.75rem">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="checkbox" id="mq-b-cab-bs" style="width:auto;flex-shrink:0"/> Backsplash (4" standard)
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                <input type="checkbox" id="mq-b-cab-co" onchange="mqTogCabCuts('b')" style="width:auto;flex-shrink:0"/> Cutouts needed
              </label>
            </div>
            <div id="mq-b-cab-cuts" style="display:none;padding:10px 12px;background:#f9fafb;border-radius:6px;margin-bottom:0.75rem">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><label style="font-size:13px;color:#6b7280;min-width:110px">Sink cutouts</label><input type="number" id="mq-b-cab-sink" value="0" min="0" max="4" style="width:55px"/></div>
              <div style="display:flex;align-items:center;gap:8px"><label style="font-size:13px;color:#6b7280;min-width:110px">Cooktop cutouts</label><input type="number" id="mq-b-cab-cook" value="0" min="0" max="2" style="width:55px"/></div>
            </div>
          </div>
        </div>
        <div class="mq-sec"><p class="mq-sec-title">Additional surfaces</p>
          <div id="mq-b-ct-surfaces"></div>
          <button class="mq-add-surface-btn" onclick="mqAddSurface('b')">+ Add another surface</button>
        </div>
        <button class="mq-calc-btn mq-calc-btn-both" id="mq-b-calc-btn" onclick="mqCalcBoth()">Calculate full project estimate ✨</button>
        <div class="mq-loading" id="mq-b-loading">Building your full project estimate...</div>
        <div class="mq-combined-result" id="mq-b-result">
          <div class="mq-combined-title">✨ Full project estimate</div>
          <div class="mq-combined-section">
            <div class="mq-combined-section-title">🪵 Cabinets</div>
            <div id="mq-b-cab-rows"></div>
            <div class="mq-combined-subtotal"><span>Cabinet subtotal</span><span id="mq-b-cab-sub">—</span></div>
          </div>
          <div class="mq-combined-section">
            <div class="mq-combined-section-title">🪨 Countertops</div>
            <div id="mq-b-ct-rows"></div>
            <div class="mq-combined-subtotal"><span>Countertop subtotal</span><span id="mq-b-ct-sub">—</span></div>
          </div>
          <div class="mq-grand-total">
            <div><div class="mq-grand-label">Total project estimate</div><div class="mq-grand-sub">Before tax · Ballpark estimate only</div></div>
            <div class="mq-grand-val" id="mq-b-grand">—</div>
          </div>
          <div class="mq-disclaimer" style="margin-top:1rem">⚠ ${disc}</div>
          <div class="mq-travel-note" style="margin-top:8px">${TRAVEL_NOTE}</div>
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
            <div class="mq-field"><label class="mq-label">Phone number <span style="color:#9ca3af;font-weight:400">(optional)</span></label><input type="tel" id="mq-lead-phone" placeholder="(555) 000-0000"/></div>
          </div>
          <button class="mq-modal-btn" onclick="mqSubmitLead()">Show my estimate →</button>
          <button class="mq-modal-skip" onclick="mqSkipLead()">Skip for now</button>
        </div>
      </div>`;
  }

  // ============================================================
  // WIRE LOGIC
  // ============================================================
  function wireWidget(data) {
    const { shop, pricing, specs, li, hasDynamic } = data;

    const drawerConfigNames = [...new Set(
      li.drawers.map(d => d['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim())
    )];

    function P() {
      const mat={}, door={}, drawer={}, hinge={};
      let installU=0, installB=0, installBSome=0, installBMostly=0, removalRate=0, taxRate=0;

      if (hasDynamic) {
        li.materials.forEach((m,i) => {
          const baseName = m._baseName || m['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim();
          const uItem = li.rawMaterials.find(r => r['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim() === baseName && r['Unit']?.includes('uppers'));
          const bItem = li.rawMaterials.find(r => r['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim() === baseName && r['Unit']?.includes('bases'));
          const fallbackRate = m['Rate'] || 0;
          mat[`dyn_${i}`] = { label:baseName, rateU:uItem?uItem['Rate']||0:fallbackRate, rateB:bItem?bItem['Rate']||0:fallbackRate };
        });
        li.doorStyles.forEach((d,i) => { door[`dyn_${i}`] = { label:d['Name'], rate:d['Rate']||0 }; });
        li.drawers.forEach(d => {
          const name = d['Name'];
          const baseName = name.replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim();
          const tier = name.match(/—\s*(some|mostly) drawers\s*$/i)?.[1]?.toLowerCase();
          if (baseName && tier) {
            if (!drawer[baseName]) drawer[baseName] = {};
            drawer[baseName][tier] = d['Rate'] || 0;
          }
        });
        li.hinges.forEach((h,i) => { hinge[`dyn_${i}`] = { label:h['Name'], rate:h['Rate']||0 }; });

        const iu       = li.installItems.find(i=>i['Name']?.toLowerCase().includes('upper') && !i['Name']?.toLowerCase().includes('drawer'));
        const ib       = li.installItems.find(i=>i['Name']?.toLowerCase().includes('base') && i['Name']?.toLowerCase().includes('with doors'));
        const ibSome   = li.installItems.find(i=>i['Name']?.toLowerCase().includes('some drawers'));
        const ibMostly = li.installItems.find(i=>i['Name']?.toLowerCase().includes('mostly drawers'));
        const rem      = li.otherItems.find(i=>i['Name']?.toLowerCase().includes('removal')) ||
                         li.installItems.find(i=>i['Name']?.toLowerCase().includes('removal'));
        const tax      = li.taxItems[0];
        installU       = iu?iu['Rate']||0:0;
        installB       = ib?ib['Rate']||0:0;
        installBSome   = ibSome?ibSome['Rate']||0:installB;
        installBMostly = ibMostly?ibMostly['Rate']||0:installB;
        removalRate    = rem?rem['Rate']||0:0;
        taxRate        = tax?(tax['Rate']||0)/100:0;
      } else {
        mat['melamine'] = {label:'Melamine', rateU:pricing['Melamine price']||280, rateB:pricing['Melamine price']||280};
        mat['plywood']  = {label:'Plywood',  rateU:pricing['Plywood price'] ||380, rateB:pricing['Plywood price'] ||380};
        door['slab']    = {label:'Slab',   rate:0};
        door['shaker']  = {label:'Shaker', rate:pricing['Shaker multiplier']||0};
        hinge['softclose'] = {label:'Soft-close', rate:pricing['Soft close hinges']||12};
        hinge['regular']   = {label:'Regular',    rate:0};
        installU       = pricing['Install rate uppers']||85;
        installB       = installU;
        installBSome   = Math.round(installB*1.10*100)/100;
        installBMostly = Math.round(installB*1.15*100)/100;
        removalRate    = pricing['Removal rate']||18;
        taxRate        = (pricing['Tax rate']||5)/100;
      }
      return { mat, door, drawer, hinge, installU, installB, installBSome, installBMostly, removalRate };
    }

    // Backsplash install rate
    const bsLineItem   = li.countertopItems.find(i=>(i['Description']||'').includes('type:backsplash'));
    const bsInstallRate = bsLineItem ? (bsLineItem['Install rate']||0) : (pricing['Backsplash rate']||12);

    // Cutout rates
    const sinkItem = li.countertopItems.find(i=>(i['Description']||'').includes('type:cutout')&&i['Name']?.toLowerCase().includes('sink'));
    const cookItem = li.countertopItems.find(i=>(i['Description']||'').includes('type:cutout')&&(i['Name']?.toLowerCase().includes('cooktop')||i['Name']?.toLowerCase().includes('cook')));
    const sinkR    = sinkItem ? (sinkItem['Rate']||180) : (pricing['Sink cutout']||180);
    const cookR    = cookItem ? (cookItem['Rate']||220) : (pricing['Cooktop cutout']||220);

    const EDGE     = {eased:0,bevel:4,bullnose:8,ogee:14,waterfall:28};
    const ctDepth  = 25;

    const diffOn={},specQty={},surfCounts={},surfs={};
    let pendingCb=null;
    ['c','ct','b'].forEach(p=>{diffOn[p]=false;specQty[p]=new Array(specs.length).fill(0);surfCounts[p]=0;surfs[p]={};});

    function fmt(n){return '$'+Math.round(n).toLocaleString();}
    function gv(id){const e=document.getElementById(id);return e?e.value:'';}
    function gn(id,d=0){const v=parseFloat(gv(id));return isNaN(v)?d:v;}

    window.mqSwitchTab=(id,el)=>{
      document.querySelectorAll('.mq-tab-content').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.mq-tab').forEach(t=>t.classList.remove('active'));
      document.getElementById('mq-tab-'+id).classList.add('active');
      el.classList.add('active');
    };

    window.mqTogDiff=(prefix)=>{
      diffOn[prefix]=!diffOn[prefix];
      document.getElementById(`mq-${prefix}-diff-tog`).classList.toggle('on',diffOn[prefix]);
      document.getElementById(`mq-${prefix}-shared`).style.display=diffOn[prefix]?'none':'block';
      document.getElementById(`mq-${prefix}-diff`).style.display=diffOn[prefix]?'block':'none';
    };

    window.mqTogDrawerConfig=(prefix)=>{
      const tier=gv(`mq-${prefix}-drawer-tier`);
      const wrap=document.getElementById(`mq-${prefix}-drawer-config-wrap`);
      if(wrap) wrap.style.display=tier==='none'?'none':'block';
    };

    window.mqToggleSpec=(prefix,i)=>{if(specQty[prefix][i]===0)mqAdjQty(prefix,i,1);else mqAdjQty(prefix,i,-specQty[prefix][i]);};
    window.mqAdjQty=(prefix,i,d)=>{
      specQty[prefix][i]=Math.max(0,specQty[prefix][i]+d);
      document.getElementById(`mq-qty-${prefix}-${i}`).textContent=specQty[prefix][i];
      document.getElementById(`mq-sp-${prefix}-${i}`).classList.toggle('on',specQty[prefix][i]>0);
    };

    window.mqShowLead=cb=>{
      pendingCb=cb;
      // Prefill from previously saved info so repeat visitors don't re-type
      try{
        const saved=JSON.parse(localStorage.getItem('mq_lead_info')||'null');
        if(saved){
          const nameEl=document.getElementById('mq-lead-name');
          const emailEl=document.getElementById('mq-lead-email');
          const phoneEl=document.getElementById('mq-lead-phone');
          if(nameEl&&!nameEl.value) nameEl.value=saved.name||'';
          if(emailEl&&!emailEl.value) emailEl.value=saved.email||'';
          if(phoneEl&&!phoneEl.value) phoneEl.value=saved.phone||'';
        }
      }catch(e){}
      const overlay=document.getElementById('mq-lead-overlay');
      overlay.classList.add('show');
      // Scroll the overlay into view so it appears at the user's current position
      overlay.scrollIntoView({behavior:'smooth',block:'center'});
    };
    window.mqSkipLead=()=>{document.getElementById('mq-lead-overlay').classList.remove('show');if(pendingCb){pendingCb(null);pendingCb=null;}};
    window.mqSubmitLead=async()=>{
      const lead={name:gv('mq-lead-name'),email:gv('mq-lead-email'),phone:gv('mq-lead-phone')};
      // Remember for next time so they don't have to re-type
      try{localStorage.setItem('mq_lead_info',JSON.stringify(lead));}catch(e){}
      document.getElementById('mq-lead-overlay').classList.remove('show');
      if(pendingCb){pendingCb(lead);pendingCb=null;}
    };
    window.mqShowConsultModal=()=>window.mqShowLead(()=>{});

    function getMaterialRates(matKey, mat) {
      const m = mat[matKey];
      if (!m) return { rateU:0, rateB:0, label:'' };
      return { rateU:m.rateU??m.rate??0, rateB:m.rateB??m.rate??0, label:m.label||'' };
    }

    function calcCabinet(prefix) {
      const {mat,door,drawer,hinge,installU,installB,installBSome,installBMostly,removalRate}=P();
      const uFt=gn(`mq-${prefix}-uft`,0), bFt=gn(`mq-${prefix}-bft`,0);
      const si=document.getElementById(`mq-${prefix}-si`)?gv(`mq-${prefix}-si`):'supply';
      const hMult={standard:1.0,tall:1.30}[gv(`mq-${prefix}-ht`)]||1.0;

      let uMatKey,uDoorKey,uHingeKey,bMatKey,bDoorKey,bHingeKey;
      if(diffOn[prefix]){
        uMatKey=gv(`mq-${prefix}-u-mat`);uDoorKey=gv(`mq-${prefix}-u-door`);uHingeKey=gv(`mq-${prefix}-u-hinge`)||'';
        bMatKey=gv(`mq-${prefix}-b-mat`);bDoorKey=gv(`mq-${prefix}-b-door`);bHingeKey=gv(`mq-${prefix}-b-hinge`)||'';
      } else {
        uMatKey=bMatKey=gv(`mq-${prefix}-mat`);
        uDoorKey=bDoorKey=gv(`mq-${prefix}-door`);
        uHingeKey=bHingeKey=gv(`mq-${prefix}-hinge`)||'';
      }

      const drawerTier       = gv(`mq-${prefix}-drawer-tier`) || 'none';
      const drawerConfigIdx  = parseInt(gv(`mq-${prefix}-drawer-config`) || '0');
      const drawerConfigName = drawerConfigNames[drawerConfigIdx] || '';
      const drawerRate       = drawerTier === 'none' ? 0 : (drawer[drawerConfigName]?.[drawerTier] || 0);

      const uMat      = getMaterialRates(uMatKey,mat);
      const bMat      = getMaterialRates(bMatKey,mat);
      const uDoorRate = uDoorKey==='none'?0:(door[uDoorKey]?.rate||0);
      const bDoorRate = bDoorKey==='none'?0:(door[bDoorKey]?.rate||0);
      const uHingeRate= uDoorKey==='none'?0:(hinge[uHingeKey]?.rate||0);
      const bHingeRate= bDoorKey==='none'?0:(hinge[bHingeKey]?.rate||0);

      const uInstall = si==='install'?installU:0;
      const bInstall = si==='install'?(
        drawerTier==='some'   ? installBSome   :
        drawerTier==='mostly' ? installBMostly :
        installB
      ):0;

      const uPft  = (uMat.rateU + uDoorRate + uHingeRate + uInstall) * hMult;
      const bPft  = bMat.rateB+bDoorRate+bHingeRate+drawerRate+bInstall;
      const uCost = uFt*uPft, bCost=bFt*bPft;

      const lines=[];
      const uDoorLabel=uDoorKey==='none'?'No doors':(door[uDoorKey]?.label||'');
      const bDoorLabel=bDoorKey==='none'?'No doors':(door[bDoorKey]?.label||'');
      if(uFt>0) lines.push({label:`Upper cabinets — ${uMat.label} / ${uDoorLabel} (${uFt} lin ft)`,cost:Math.round(uCost)});
      if(bFt>0) lines.push({label:`Base cabinets — ${bMat.label} / ${bDoorLabel} (${bFt} lin ft)`,cost:Math.round(bCost)});
      if(drawerRate>0&&bFt>0) lines.push({label:`Drawers — ${drawerConfigName} / ${drawerTier} (${bFt} lin ft bases)`,cost:Math.round(drawerRate*bFt)});

      let specTotal=0;
      specs.forEach((s,i)=>{
        if(!specQty[prefix][i]) return;
        // For per-linear-foot items, the quantity IS the linear feet — independent of cabinet measurements
        const cost=s.perFt?s.price*specQty[prefix][i]:s.price*specQty[prefix][i];
        specTotal+=cost;
        const qtyLabel=s.perFt?`${specQty[prefix][i]} ft`:(specQty[prefix][i]>1?`× ${specQty[prefix][i]}`:'');
        lines.push({label:qtyLabel?`${s.label} (${qtyLabel})`:s.label,cost:Math.round(cost)});
      });

      const remEl=document.getElementById(`mq-${prefix}-removal`);
      const remCost=remEl&&remEl.value==='yes'?(uFt+bFt)*removalRate:0;
      if(remCost>0) lines.push({label:'Cabinet removal',cost:Math.round(remCost)});

      const sub=uCost+bCost+specTotal+remCost;
      lines.push({label:'Subtotal (before tax)',cost:Math.round(sub),bold:true});

      const total=sub;
      const low=Math.round(total*0.9/100)*100, high=Math.round(total*1.15/100)*100;
      const roomLabel={kitchen:'Kitchen',bathroom:'Bathroom',laundry:'Laundry room',garage:'Garage',office:'Home office',other:'Room'}[gv(`mq-${prefix}-room`)]||'Cabinet';
      return {lines,sub:Math.round(sub),total:Math.round(total),low,high,roomLabel,si,uFt,bFt};
    }

    function calcCountertop(prefix) {
      const {removalRate}=P();
      const ctSiId=prefix==='ct'?'mq-ct-si':'mq-b-ct-si';
      const lines=[]; let sub=0;

      const useCabMeasure = document.getElementById(`mq-${prefix}-use-cab`)?.checked;
      if (useCabMeasure) {
        const bFt   = gn(`mq-${prefix}-bft`, 0);
        const matId = prefix==='ct' ? 'mq-ct-ct-mat-cab' : `mq-${prefix}-ct-mat-cab`;
        const bsId  = prefix==='ct' ? 'mq-ct-cab-bs'     : `mq-${prefix}-cab-bs`;
        const coId  = prefix==='ct' ? 'mq-ct-cab-co'     : `mq-${prefix}-cab-co`;
        const sinkId= prefix==='ct' ? 'mq-ct-cab-sink'   : `mq-${prefix}-cab-sink`;
        const cookId= prefix==='ct' ? 'mq-ct-cab-cook'   : `mq-${prefix}-cab-cook`;
        if (bFt > 0) {
          const linFt = bFt;
          const sqft  = linFt * (ctDepth / 12);
          const mat   = gv(matId);
          const si    = gv(ctSiId);
          const m     = CT_MAT[mat] || Object.values(CT_MAT)[0];
          if (m) {
            const supplyCost  = m.supplyUnit  === 'lin ft' ? linFt*m.ps : sqft*m.ps;
            const installCost = si==='install' ? (m.installUnit==='lin ft' ? linFt*m.pi : sqft*m.pi) : 0;
            const bsChecked   = document.getElementById(bsId)?.checked;
            let bsCost = 0;
            if (bsChecked) {
              const bsSqft   = linFt * (4/12);
              const bsSupply = m.supplyUnit === 'lin ft' ? linFt*m.ps : bsSqft*m.ps;
              bsCost = bsSupply + linFt * bsInstallRate;
            }
            const coChecked = document.getElementById(coId)?.checked;
            const cutoutCost = coChecked ? gn(sinkId)*sinkR + gn(cookId)*cookR : 0;
            const cost = supplyCost + installCost + bsCost + cutoutCost;
            sub += cost;
            lines.push({label:`Cabinet run — ${m.label} (${linFt} lin ft, ~${Math.round(sqft*10)/10} sqft)${bsChecked?' + backsplash':''}`, cost:Math.round(cost)});
          }
        }
      }

      Object.keys(surfs[prefix]).forEach(id=>{
        if(!document.getElementById('mqsc-'+id)) return;
        const mat=gv('mqsm-'+id), edge=gv('mqse-'+id);
        const siOv=gv('mqssi-'+id), si=siOv==='inherit'?gv(ctSiId):siOv;
        const m=CT_MAT[mat]||Object.values(CT_MAT)[0];
        if (!m) return;
        const w=gn('mqsw-'+id,0), d=gn('mqsd-'+id,ctDepth);
        const sqft=(w*(d||ctDepth))/144;
        const linFt=w/12;
        const supplyCost  = m.supplyUnit  === 'lin ft' ? linFt*m.ps : sqft*m.ps;
        const installCost = si==='install' ? (m.installUnit==='lin ft' ? linFt*m.pi : sqft*m.pi) : 0;
        const bsChecked   = document.getElementById('mqsbs-'+id)?.checked;
        let bsCost = 0;
        if (bsChecked) {
          const bsSqft   = linFt*(4/12);
          const bsSupply = m.supplyUnit==='lin ft' ? linFt*m.ps : bsSqft*m.ps;
          bsCost = bsSupply + linFt*bsInstallRate;
        }
        const cost = supplyCost+installCost+linFt*(EDGE[edge]||0)+bsCost
          +(document.getElementById('mqsco-'+id)?.checked?gn('mqssink-'+id)*sinkR+gn('mqscook-'+id)*cookR:0);
        sub+=cost;
        lines.push({label:`${gv('mqsn-'+id)||'Surface'} — ${m.label} (${Math.round(sqft*10)/10} sqft, ${Math.round(linFt*10)/10} lin ft)`,cost:Math.round(cost)});
      });

      lines.push({label:'Subtotal (before tax)',cost:Math.round(sub),bold:true});
      const total=sub;
      return {lines,sub:Math.round(sub),total:Math.round(total),low:Math.round(total*0.9/100)*100,high:Math.round(total*1.15/100)*100};
    }

    function renderResult(rangeEl,listEl,result){
      document.getElementById(rangeEl).textContent=fmt(result.low)+' – '+fmt(result.high);
      const ul=document.getElementById(listEl);ul.innerHTML='';
      result.lines.forEach(l=>{
        const li=document.createElement('li');
        li.innerHTML=`<span class="mq-li-lbl" ${l.bold?'style="font-weight:600;color:#111"':''}>${l.label}</span><span ${l.bold?'style="font-weight:600"':''}>${fmt(l.cost)}</span>`;
        ul.appendChild(li);
      });
    }

    window.mqCalcCabinets=()=>{
      window.mqShowLead(async lead=>{
        document.getElementById('mq-c-calc-btn').disabled=true;
        document.getElementById('mq-c-loading').classList.add('show');
        document.getElementById('mq-c-result').classList.remove('show');
        const r=calcCabinet('c');
        document.getElementById('mq-c-res-title').textContent=r.roomLabel+' cabinet estimate';
        document.getElementById('mq-c-res-sub').textContent=`${r.uFt} ft uppers · ${r.bFt} ft bases · ${r.si==='install'?'Supply + install':'Supply only'}`;
        renderResult('mq-c-res-range','mq-c-line-items',r);
        document.getElementById('mq-c-loading').classList.remove('show');
        document.getElementById('mq-c-result').classList.add('show');document.getElementById('mq-c-result').scrollIntoView({behavior:'smooth',block:'start'});
        document.getElementById('mq-c-calc-btn').disabled=false;
        if(lead) await saveLead(data,lead,'Cabinets',r.low,r.high,r.lines);
      });
    };

    window.mqCalcCountertops=()=>{
      const hasSurfaces=Object.keys(surfs['ct']).filter(id=>document.getElementById('mqsc-'+id)).length>0;
      if(!hasSurfaces){alert('Please add at least one surface.');return;}
      window.mqShowLead(async lead=>{
        document.getElementById('mq-ct-calc-btn').disabled=true;
        document.getElementById('mq-ct-loading').classList.add('show');
        document.getElementById('mq-ct-result').classList.remove('show');
        setTimeout(async()=>{
          const r=calcCountertop('ct');
          const active=Object.keys(surfs['ct']).filter(id=>document.getElementById('mqsc-'+id)).length;
          document.getElementById('mq-ct-res-sub').textContent=`${active} surface(s) · ${gv('mq-ct-si')==='install'?'Supply + install':'Supply only'}`;
          renderResult('mq-ct-res-range','mq-ct-line-items',r);
          document.getElementById('mq-ct-loading').classList.remove('show');
          document.getElementById('mq-ct-result').classList.add('show');document.getElementById('mq-ct-result').scrollIntoView({behavior:'smooth',block:'start'});
          document.getElementById('mq-ct-calc-btn').disabled=false;
          if(lead) await saveLead(data,lead,'Countertops',r.low,r.high,r.lines);
        },900);
      });
    };

    window.mqCalcBoth=()=>{
      window.mqShowLead(async lead=>{
        document.getElementById('mq-b-calc-btn').disabled=true;
        document.getElementById('mq-b-loading').classList.add('show');
        document.getElementById('mq-b-result').classList.remove('show');
        setTimeout(async()=>{
          const cab=calcCabinet('b'),ct=calcCountertop('b');
          const cabRows=document.getElementById('mq-b-cab-rows');cabRows.innerHTML='';
          cab.lines.filter(l=>!l.bold).forEach(l=>{const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">${l.label}</span><span>${fmt(l.cost)}</span>`;cabRows.appendChild(d);});
          document.getElementById('mq-b-cab-sub').textContent=fmt(cab.sub);
          const ctRows=document.getElementById('mq-b-ct-rows');ctRows.innerHTML='';
          ct.lines.filter(l=>!l.bold).forEach(l=>{const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">${l.label}</span><span>${fmt(l.cost)}</span>`;ctRows.appendChild(d);});
          document.getElementById('mq-b-ct-sub').textContent=fmt(ct.sub);
          const tl=cab.low+ct.low,th=cab.high+ct.high;
          document.getElementById('mq-b-grand').textContent=fmt(tl)+' – '+fmt(th);
          document.getElementById('mq-b-loading').classList.remove('show');
          document.getElementById('mq-b-result').classList.add('show');document.getElementById('mq-b-result').scrollIntoView({behavior:'smooth',block:'start'});
          document.getElementById('mq-b-calc-btn').disabled=false;
          if(lead) await saveLead(data,lead,'Cabinets + Countertops',tl,th,[{label:'— CABINETS —',cost:0},...cab.lines,{label:'— COUNTERTOPS —',cost:0},...ct.lines]);
        },1200);
      });
    };

    function addSurfaceInternal(prefix,name){
      surfCounts[prefix]++;
      const id=`s${prefix}${surfCounts[prefix]}`;
      surfs[prefix][id]=1;
      const names=['Kitchen run','Island top','Bathroom vanity','Bar top','Custom surface'];
      const n=name||names[Math.min(surfCounts[prefix]-1,names.length-1)];
      const containerId=prefix==='ct'?'mq-ct-surfaces':'mq-'+prefix+'-ct-surfaces';
      const card=document.createElement('div');
      card.className='mq-surface-card';card.id='mqsc-'+id;
      card.innerHTML=`
        <div class="mq-surface-header">
          <div class="mq-surface-num">${surfCounts[prefix]}</div>
          <input id="mqsn-${id}" value="${n}" style="font-size:14px;font-weight:500;color:#111;background:none;border:none;outline:none;flex:1;font-family:inherit"/>
          <button class="mq-remove-btn" onclick="mqRemoveSurf('${prefix}','${id}')">Remove</button>
        </div>
        <div class="mq-grid3" style="margin-bottom:1rem">
          <div class="mq-field"><label class="mq-label">Width (inches)</label><input type="number" id="mqsw-${id}" placeholder="e.g. 120" oninput="mqCalcSurfDims('${id}')"/></div>
          <div class="mq-field"><label class="mq-label">Depth (inches)</label><input type="number" id="mqsd-${id}" placeholder="${ctDepth}" value="${ctDepth}" oninput="mqCalcSurfDims('${id}')"/></div>
          <div class="mq-field"><label class="mq-label" style="color:#16a34a">Auto-calculated</label>
            <div style="font-size:13px;color:#6b7280;padding:7px 0" id="mqsdims-${id}">Enter width & depth</div></div>
        </div>
        <div class="mq-grid3" style="margin-bottom:1rem">
          <div class="mq-field"><label class="mq-label">Material</label><select id="mqsm-${id}">${ctMatOpts()}</select></div>
          <div class="mq-field"><label class="mq-label">Edge profile</label>
            <select id="mqse-${id}"><option value="eased">Eased</option><option value="bevel">Bevel (+$4/ft)</option><option value="bullnose">Bullnose (+$8/ft)</option><option value="ogee">Ogee (+$14/ft)</option><option value="waterfall">Waterfall (+$28/ft)</option></select></div>
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
      document.getElementById(containerId)?.appendChild(card);
    }

    window.mqAddSurface=(prefix)=>addSurfaceInternal(prefix);
    window.mqRemoveSurf=(prefix,id)=>{const c=document.getElementById('mqsc-'+id);if(c)c.remove();delete surfs[prefix][id];};
    window.mqTogUseCab=(prefix)=>{
      const checked = document.getElementById(`mq-${prefix}-use-cab`)?.checked;
      const matDiv  = document.getElementById(`mq-${prefix}-cab-mat`);
      if(matDiv) matDiv.style.display=checked?'block':'none';
    };
    window.mqCalcSurfDims=(id)=>{
      const w=parseFloat(document.getElementById(`mqsw-${id}`)?.value||0);
      const d=parseFloat(document.getElementById(`mqsd-${id}`)?.value||ctDepth);
      const el=document.getElementById(`mqsdims-${id}`);
      if(el&&w>0){
        const sqft=Math.round((w*d)/144*10)/10;
        const linFt=Math.round(w/12*10)/10;
        el.textContent=`${sqft} sqft · ${linFt} lin ft`;
        el.style.color='#16a34a';
      } else if(el){el.textContent='Enter width & depth';el.style.color='#6b7280';}
    };
    window.mqTogCabCuts=(prefix)=>{
      const coId   = prefix==='ct'?'mq-ct-cab-co':`mq-${prefix}-cab-co`;
      const cutsId = prefix==='ct'?'mq-ct-cab-cuts':`mq-${prefix}-cab-cuts`;
      const el=document.getElementById(cutsId);
      if(el) el.style.display=document.getElementById(coId)?.checked?'block':'none';
    };
    window.mqTogCuts=id=>{document.getElementById('mqscuts-'+id).style.display=document.getElementById('mqsco-'+id).checked?'block':'none';};

    addSurfaceInternal('ct','Kitchen run');
    addSurfaceInternal('b','Kitchen run');
  }

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    const data=await loadShopData(shopToken);
    if(!data) return;
    const {shop,specs}=data;
    const container=document.getElementById('midasquote-widget');
    if(!container){console.error('MidasQuote: Add <div id="midasquote-widget"></div> to your page.');return;}
    injectStyles(shop['Brand colour']||'#1a1a1a');
    buildCTMAT(data);  // build CT_MAT before buildWidgetHTML uses ctMatOpts()
    container.innerHTML=buildWidgetHTML(shop,specs,data);
    wireWidget(data);
  }

  init();

})();
