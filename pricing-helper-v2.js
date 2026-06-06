/*
 * MidasQuote Pricing Helper v2.0
 * Inline calculator buttons next to each pricing field
 * Back-calculates from sample cabinet/door costs
 */

(function() {

  const CONFIG = {
    AIRTABLE_TOKEN:  'YOUR_AIRTABLE_TOKEN_HERE',
    BASE_ID:         'YOUR_BASE_ID_HERE',
    SHOPS_TABLE:     'YOUR_SHOPS_TABLE_ID_HERE',
    PRICING_TABLE:   'YOUR_SHOP_PRICING_TABLE_ID_HERE',
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

  let shopRecord = null;
  let pricingRecord = null;
  let currentMat = 'melamine';
  let currentDoorId = 'slab';
  let currentDoorLabel = 'Slab';
  let boxCalcRate = 0;
  let doorCalcRate = 0;
  let doorSizeCount = 0;

  const MAT_LABELS = {
    melamine: 'Melamine',
    plywood:  'Plywood',
    mdf:      'Painted MDF',
    solid:    'Solid wood',
  };

  const DOOR_LABELS = {
    slab:   'Slab (flat)',
    shaker: 'Shaker',
    raised: 'Raised panel',
    glass:  'Glass inserts',
  };

  // ============================================================
  // INJECT STYLES
  // ============================================================
  function injectStyles() {
    if (document.getElementById('mqph2-styles')) return;
    const s = document.createElement('style');
    s.id = 'mqph2-styles';
    s.textContent = `
      #mq-pricing-helper-v2 *{box-sizing:border-box;margin:0;padding:0}
      #mq-pricing-helper-v2{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:860px;padding:2rem}
      #mq-pricing-helper-v2 h1{font-size:20px;font-weight:700;color:#111;margin-bottom:6px}
      #mq-pricing-helper-v2 .ph-sub{font-size:13px;color:#6b7280;margin-bottom:2rem;line-height:1.5}
      #mq-pricing-helper-v2 .ph-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem;margin-bottom:1.25rem}
      #mq-pricing-helper-v2 .ph-card-title{font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1rem}
      #mq-pricing-helper-v2 .ph-price-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f3f4f6}
      #mq-pricing-helper-v2 .ph-price-row:last-child{border-bottom:none}
      #mq-pricing-helper-v2 .ph-price-label{font-size:13px;color:#111;flex:1;font-weight:500}
      #mq-pricing-helper-v2 .ph-input-wrap{display:flex;align-items:center;gap:4px}
      #mq-pricing-helper-v2 .ph-input-wrap span{font-size:13px;color:#6b7280}
      #mq-pricing-helper-v2 .ph-input-wrap input{width:95px;text-align:right;font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px}
      #mq-pricing-helper-v2 .ph-input-wrap input:focus{outline:none;border-color:#1a1a1a}
      #mq-pricing-helper-v2 .ph-help-btn{font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px;background:#eff6ff;color:#1d4ed8;border:none;cursor:pointer;white-space:nowrap;flex-shrink:0;font-family:inherit}
      #mq-pricing-helper-v2 .ph-help-btn:hover{background:#dbeafe}
      #mq-pricing-helper-v2 .ph-save-row{margin-top:1.5rem;display:flex;align-items:center;gap:12px}
      #mq-pricing-helper-v2 .ph-save-btn{padding:10px 24px;font-size:13px;font-weight:600;background:#1a1a1a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit}
      #mq-pricing-helper-v2 .ph-save-btn:hover{opacity:0.88}
      #mq-pricing-helper-v2 .ph-saved{font-size:13px;color:#16a34a;display:none}

      /* MODAL */
      #mqph2-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:center;justify-content:center;padding:1rem}
      #mqph2-overlay.show{display:flex}
      #mqph2-modal{background:#fff;border-radius:12px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25)}
      #mqph2-modal .mh{display:flex;align-items:flex-start;justify-content:space-between;padding:1.25rem;border-bottom:1px solid #e5e7eb;position:sticky;top:0;background:#fff;z-index:1}
      #mqph2-modal .mh-title{font-size:15px;font-weight:600;color:#111;margin-bottom:3px}
      #mqph2-modal .mh-sub{font-size:12px;color:#6b7280;line-height:1.5}
      #mqph2-modal .mh-close{font-size:22px;color:#6b7280;background:none;border:none;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0}
      #mqph2-modal .mtabs{display:flex;border-bottom:1px solid #e5e7eb}
      #mqph2-modal .mtab{flex:1;padding:12px;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;border:none;background:#f9fafb;border-bottom:2px solid transparent;text-align:center;font-family:inherit;transition:all 0.15s}
      #mqph2-modal .mtab.active{background:#fff;color:#111;border-bottom-color:#1a1a1a}
      #mqph2-modal .mbody{display:none;padding:1.25rem}
      #mqph2-modal .mbody.active{display:block}
      #mqph2-modal .cab-ref{display:flex;gap:8px;margin-bottom:1rem}
      #mqph2-modal .cab-box{flex:1;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;font-size:12px;color:#6b7280}
      #mqph2-modal .cab-box strong{display:block;font-size:16px;color:#111;margin-bottom:2px}
      #mqph2-modal .note{font-size:12px;color:#6b7280;background:#f9fafb;border-radius:8px;padding:10px 12px;margin-bottom:1rem;line-height:1.5}
      #mqph2-modal .step{margin-bottom:1.25rem}
      #mqph2-modal .step-lbl{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;display:flex;align-items:center;gap:6px}
      #mqph2-modal .snum{width:20px;height:20px;border-radius:50%;background:#f3f4f6;border:1px solid #e5e7eb;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#6b7280;flex-shrink:0}
      #mqph2-modal .irow{display:flex;align-items:center;gap:10px;margin-bottom:8px}
      #mqph2-modal .irow label{font-size:13px;color:#6b7280;flex:1;line-height:1.4}
      #mqph2-modal .irow input{width:100px;text-align:right;font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px}
      #mqph2-modal .irow input:focus{outline:none;border-color:#1a1a1a}
      #mqph2-modal .ipfx{font-size:13px;color:#6b7280;flex-shrink:0}
      #mqph2-modal .divider{height:1px;background:#e5e7eb;margin:1rem 0}
      #mqph2-modal .res-box{background:#f9fafb;border-radius:10px;padding:1.25rem;margin-bottom:1rem}
      #mqph2-modal .res-box.hi{background:#f0fdf4;border:1px solid #86efac}
      #mqph2-modal .rrow{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid #f3f4f6}
      #mqph2-modal .rrow:last-child{border-bottom:none}
      #mqph2-modal .rlbl{color:#6b7280}
      #mqph2-modal .rval{font-weight:600;color:#111}
      #mqph2-modal .rfinal{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb}
      #mqph2-modal .rfinal-lbl{font-size:14px;font-weight:600;color:#111}
      #mqph2-modal .rfinal-val{font-size:26px;font-weight:700;color:#16a34a}
      #mqph2-modal .marg-row{display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:4px}
      #mqph2-modal input[type=range]{width:100%;margin:6px 0;accent-color:#1a1a1a}
      #mqph2-modal .apply-btn{width:100%;padding:11px;font-size:14px;font-weight:600;background:#1a1a1a;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:4px;font-family:inherit;transition:opacity 0.15s}
      #mqph2-modal .apply-btn:hover{opacity:0.88}
      #mqph2-modal .apply-btn:disabled{opacity:0.35;cursor:not-allowed}
      #mqph2-modal .fhint{font-size:11px;color:#9ca3af;text-align:center;margin-top:8px;line-height:1.5}
      #mqph2-modal .direct-row{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
      #mqph2-modal .direct-row span{font-size:13px;color:#6b7280}
      #mqph2-modal .direct-row input{width:100px;font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px}
      #mqph2-modal .door-size-card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:8px}
      #mqph2-modal .door-size-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:13px;font-weight:500;color:#111}
      #mqph2-modal .door-dims{display:flex;gap:8px;flex-wrap:wrap}
      #mqph2-modal .dim-f{display:flex;flex-direction:column;gap:3px;flex:1;min-width:70px}
      #mqph2-modal .dim-l{font-size:11px;color:#6b7280}
      #mqph2-modal .dim-i{font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:5px 8px;width:100%}
      #mqph2-modal .add-size-btn{width:100%;padding:8px;font-size:12px;border:1px dashed #d1d5db;border-radius:8px;background:none;color:#6b7280;cursor:pointer;font-family:inherit;margin-bottom:1rem}
      #mqph2-modal .add-size-btn:hover{background:#f9fafb;color:#111}
      #mqph2-modal .del-btn{width:22px;height:22px;border:none;background:none;color:#9ca3af;cursor:pointer;font-size:16px;border-radius:4px;font-family:inherit}
      #mqph2-modal .del-btn:hover{background:#f3f4f6;color:#111}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // BUILD HTML
  // ============================================================
  function buildHTML() {
    const p = pricingRecord?.fields || {};

    const matRow = (id, label, field, defaultVal) => `
      <div class="ph-price-row">
        <span class="ph-price-label">${label}</span>
        <div class="ph-input-wrap">
          <span>$</span>
          <input type="number" id="ph-${id}" value="${p[field] || defaultVal}" oninput="mqph2SaveState()"/>
          <span>/ lin ft</span>
        </div>
        <button class="ph-help-btn" onclick="mqph2OpenBox('${id}','${label}','${field}')">🧮 Help me calculate</button>
      </div>`;

    const doorRow = (id, label, field, defaultVal) => `
      <div class="ph-price-row">
        <span class="ph-price-label">${label}</span>
        <div class="ph-input-wrap">
          <span>$</span>
          <input type="number" id="ph-door-${id}" value="${p[field] !== undefined ? p[field] : defaultVal}" oninput="mqph2SaveState()"/>
          <span>/ lin ft upcharge</span>
        </div>
        <button class="ph-help-btn" onclick="mqph2OpenDoor('${id}','${label}','${field}')">🧮 Help me calculate</button>
      </div>`;

    const numRow = (id, label, field, defaultVal, suffix) => `
      <div class="ph-price-row">
        <span class="ph-price-label">${label}</span>
        <div class="ph-input-wrap">
          <span>$</span>
          <input type="number" id="ph-${id}" value="${p[field] || defaultVal}" oninput="mqph2SaveState()"/>
          <span>${suffix || '/ lin ft'}</span>
        </div>
      </div>`;

    return `
      <h1>⚙️ Pricing Setup Helper</h1>
      <p class="ph-sub">Set your rates below. Click <strong>🧮 Help me calculate</strong> next to any field to back-calculate your rate from a sample job.</p>

      <div id="mqph2-save-msg" style="display:none;background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:1rem">✓ Pricing saved to your widget!</div>
      <div id="mqph2-err-msg" style="display:none;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:1rem">Error saving — please try again.</div>

      <div class="ph-card">
        <div class="ph-card-title">🪵 Cabinet materials — base price per linear foot</div>
        ${matRow('melamine', 'Melamine', 'Melamine price', 280)}
        ${matRow('plywood',  'Plywood',  'Plywood price',  380)}
        ${matRow('mdf',      'Painted MDF', 'MDF price',   350)}
        ${matRow('solid',    'Solid wood',  'Solid wood price', 550)}
      </div>

      <div class="ph-card">
        <div class="ph-card-title">🚪 Door style upcharges — added per linear foot on top of base material rate</div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:1rem;line-height:1.5">These are the EXTRA cost per linear foot when a customer chooses a specific door style. Use the calculator to convert your per-sqft door pricing automatically.</div>
        ${doorRow('slab',   'Slab (flat)',   'Slab multiplier',   0)}
        ${doorRow('shaker', 'Shaker',        'Shaker multiplier', 0)}
        ${doorRow('raised', 'Raised panel',  'Raised multiplier', 0)}
        ${doorRow('glass',  'Glass inserts', 'Glass multiplier',  0)}
      </div>

      <div class="ph-card">
        <div class="ph-card-title">⚙️ Hardware & installation</div>
        ${numRow('install',  'Install rate',             'Install rate uppers', 85,  '/ lin ft')}
        ${numRow('hinges',   'Soft-close hinges upcharge', 'Soft close hinges', 12,  '/ lin ft')}
        ${numRow('drawer',   'Birch drawer box upcharge',  'Birch drawer box',  15,  '/ lin ft')}
        ${numRow('removal',  'Cabinet removal rate',       'Removal rate',      18,  '/ lin ft')}
      </div>

      <div class="ph-card">
        <div class="ph-card-title">🚗 Travel zones</div>
        ${numRow('zone-radius', 'Local zone radius', 'Local zone radius', 15, 'km')}
        ${numRow('zone2', 'Zone 2 surcharge (flat)', 'Zone 2 surcharge', 320, 'flat')}
        ${numRow('zone3', 'Zone 3 surcharge (flat)', 'Zone 3 surcharge', 680, 'flat')}
        ${numRow('zone4', 'Zone 4 surcharge (flat)', 'Zone 4 surcharge', 1100, 'flat')}
      </div>

      <div class="ph-card">
        <div class="ph-card-title">🧾 Tax & other</div>
        ${numRow('tax', 'Tax rate', 'Tax rate', 5, '%')}
        ${numRow('backsplash', 'Backsplash rate', 'Backsplash rate', 12, '/ lin ft')}
        ${numRow('sink', 'Sink cutout', 'Sink cutout', 180, 'each')}
        ${numRow('cooktop', 'Cooktop cutout', 'Cooktop cutout', 220, 'each')}
      </div>

      <div style="display:flex;gap:12px;align-items:center;margin-top:0.5rem">
        <button class="ph-save-btn" onclick="mqph2SaveAll()">💾 Save all pricing to my widget</button>
        <span id="ph-saved-inline" style="font-size:13px;color:#16a34a;display:none">✓ Saved!</span>
      </div>

      <!-- MODAL -->
      <div id="mqph2-overlay">
        <div id="mqph2-modal">
          <div class="mh">
            <div>
              <div class="mh-title" id="mqph2-modal-title">Pricing calculator</div>
              <div class="mh-sub" id="mqph2-modal-sub">Back-calculate your rate</div>
            </div>
            <button class="mh-close" onclick="mqph2CloseModal()">×</button>
          </div>
          <div class="mtabs" id="mqph2-tabs">
            <button class="mtab active" id="mqph2-tab-box-btn" onclick="mqph2ModalTab('box')">📦 Cabinet box</button>
            <button class="mtab" id="mqph2-tab-door-btn" onclick="mqph2ModalTab('door')">🚪 Door pricing</button>
          </div>

          <!-- BOX TAB -->
          <div class="mbody active" id="mqph2-tab-box">
            <div class="cab-ref">
              <div class="cab-box"><strong>24"</strong>wide</div>
              <div class="cab-box"><strong>34.5"</strong>tall</div>
              <div class="cab-box"><strong>24"</strong>deep</div>
              <div class="cab-box"><strong>= 2</strong>lin ft</div>
            </div>
            <div class="note">💡 In your quoting software, quote a <strong>24" wide open base cabinet with no doors or drawers</strong> — just the box in your chosen material. Enter what it costs you and what you'd charge.</div>

            <div class="step">
              <div class="step-lbl"><div class="snum">1</div>Your cost to build this cabinet</div>
              <div class="irow"><label>Sheet goods (material) for this cabinet</label><div style="display:flex;align-items:center;gap:4px"><span class="ipfx">$</span><input type="number" id="mqph2-material" placeholder="0" oninput="mqph2RecalcBox()"/></div></div>
              <div class="irow"><label>Hardware (hinges, slides, pins)</label><div style="display:flex;align-items:center;gap:4px"><span class="ipfx">$</span><input type="number" id="mqph2-hardware" placeholder="0" oninput="mqph2RecalcBox()"/></div></div>
              <div class="irow"><label>Sundries (glue, screws, edge tape)</label><div style="display:flex;align-items:center;gap:4px"><span class="ipfx">$</span><input type="number" id="mqph2-sundries" placeholder="0" oninput="mqph2RecalcBox()"/></div></div>
            </div>

            <div class="step">
              <div class="step-lbl"><div class="snum">2</div>Labour to build this cabinet</div>
              <div class="irow"><label>Build time (hours)</label><input type="number" id="mqph2-hours" placeholder="0.0" step="0.25" oninput="mqph2RecalcBox()"/></div>
              <div class="irow"><label>Your shop rate ($ per hour)</label><div style="display:flex;align-items:center;gap:4px"><span class="ipfx">$</span><input type="number" id="mqph2-shoprate" placeholder="0" oninput="mqph2RecalcBox()"/></div></div>
            </div>

            <div class="step">
              <div class="step-lbl"><div class="snum">3</div>Your profit margin</div>
              <div class="marg-row"><span>Margin: <strong id="mqph2-marg-disp">30%</strong></span><span>drag to adjust</span></div>
              <input type="range" id="mqph2-margin" min="10" max="60" value="30" oninput="mqph2UpdateMargin();mqph2RecalcBox()"/>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#9ca3af"><span>10% (slim)</span><span>30% (typical)</span><span>60% (premium)</span></div>
            </div>

            <div class="divider"></div>

            <div class="res-box" id="mqph2-box-result">
              <div class="rrow"><span class="rlbl">Total material cost</span><span class="rval" id="mqph2-r-mat">$0</span></div>
              <div class="rrow"><span class="rlbl">Labour cost</span><span class="rval" id="mqph2-r-lab">$0</span></div>
              <div class="rrow"><span class="rlbl">Total cost to build</span><span class="rval" id="mqph2-r-cost">$0</span></div>
              <div class="rrow"><span class="rlbl">Profit margin (<span id="mqph2-r-mpct">30</span>%)</span><span class="rval" id="mqph2-r-marg">$0</span></div>
              <div class="rrow"><span class="rlbl">Your sell price for this 24" cabinet</span><span class="rval" id="mqph2-r-sell">$0</span></div>
              <div class="rfinal"><span class="rfinal-lbl">Your linear foot rate</span><span class="rfinal-val" id="mqph2-r-rate">$0 / lin ft</span></div>
            </div>

            <div class="note">
              <strong style="color:#111">Already know your price?</strong> Just enter what you'd charge for a 24" cabinet:
              <div class="direct-row">
                <span>I charge $</span>
                <input type="number" id="mqph2-direct" placeholder="0" oninput="mqph2DirectCalc()"/>
                <span>for a 24" cabinet → <strong id="mqph2-direct-rate" style="color:#111">$0 / lin ft</strong></span>
              </div>
            </div>

            <button class="apply-btn" id="mqph2-box-apply" onclick="mqph2ApplyBox()" disabled>Apply this rate to my pricing →</button>
            <p class="fhint">Applies to <strong id="mqph2-mat-name">melamine</strong> price. You can always adjust manually.</p>
          </div>

          <!-- DOOR TAB -->
          <div class="mbody" id="mqph2-tab-door">
            <div class="note">💡 Enter your per-sqft door rate. Add typical cabinet sizes and we'll calculate the average door face area per linear foot and convert it to a lin ft upcharge automatically.</div>

            <div class="step">
              <div class="step-lbl"><div class="snum">1</div>Your rate for <span id="mqph2-door-style-name">this door style</span></div>
              <div class="irow">
                <label>Your price per sqft of door face</label>
                <div style="display:flex;align-items:center;gap:4px"><span class="ipfx">$</span><input type="number" id="mqph2-d-sqft" placeholder="e.g. 45.95" step="0.01" oninput="mqph2RecalcDoor()"/><span class="ipfx">/ sqft</span></div>
              </div>
            </div>

            <div class="step">
              <div class="step-lbl"><div class="snum">2</div>Your typical cabinet sizes for this door style</div>
              <p style="font-size:12px;color:#6b7280;margin-bottom:10px">Add the cabinet sizes you most commonly build. We'll average the door face area across them to get a per-linear-foot upcharge.</p>
              <div id="mqph2-door-sizes"></div>
              <button class="add-size-btn" onclick="mqph2AddDoorSize()">+ Add another cabinet size</button>
            </div>

            <div class="divider"></div>

            <div class="res-box" id="mqph2-door-result">
              <div class="rrow"><span class="rlbl">Average door face area per cabinet</span><span class="rval" id="mqph2-d-avgface">0 sqft</span></div>
              <div class="rrow"><span class="rlbl">Average door face area per linear foot</span><span class="rval" id="mqph2-d-avglinft">0 sqft/lin ft</span></div>
              <div class="rrow"><span class="rlbl">Your rate per sqft</span><span class="rval" id="mqph2-d-rate-disp">$0 / sqft</span></div>
              <div class="rfinal"><span class="rfinal-lbl">Door upcharge per linear foot</span><span class="rfinal-val" id="mqph2-d-result">$0 / lin ft</span></div>
            </div>

            <button class="apply-btn" id="mqph2-door-apply" onclick="mqph2ApplyDoor()" disabled>Apply door upcharge →</button>
            <p class="fhint">Applies to <strong id="mqph2-door-field-name">slab</strong> door upcharge in your pricing panel.</p>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================
  // MODAL FUNCTIONS
  // ============================================================
  window.mqph2OpenBox = function(matId, matLabel, field) {
    currentMat = matId;
    document.getElementById('mqph2-modal-title').textContent = `Calculate your ${matLabel.toLowerCase()} rate`;
    document.getElementById('mqph2-modal-sub').textContent = 'Back-calculate from a sample 24" cabinet';
    document.getElementById('mqph2-mat-name').textContent = matLabel.toLowerCase();
    // reset
    ['mqph2-material','mqph2-hardware','mqph2-sundries','mqph2-hours','mqph2-shoprate','mqph2-direct'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('mqph2-margin').value = 30;
    mqph2UpdateMargin();
    mqph2RecalcBox();
    // show box tab
    mqph2ModalTab('box');
    document.getElementById('mqph2-overlay').classList.add('show');
  };

  window.mqph2OpenDoor = function(doorId, doorLabel, field) {
    currentDoorId = doorId;
    currentDoorLabel = doorLabel;
    document.getElementById('mqph2-modal-title').textContent = `Calculate your ${doorLabel.toLowerCase()} door upcharge`;
    document.getElementById('mqph2-modal-sub').textContent = 'Convert your per-sqft door rate to a per-linear-foot upcharge';
    document.getElementById('mqph2-door-style-name').textContent = doorLabel.toLowerCase();
    document.getElementById('mqph2-door-field-name').textContent = doorLabel.toLowerCase();
    document.getElementById('mqph2-d-sqft').value = '';
    // reset door sizes
    document.getElementById('mqph2-door-sizes').innerHTML = '';
    doorSizeCount = 0;
    mqph2AddDoorSize(24, 30);  // default: 24" wide x 30" tall
    mqph2AddDoorSize(18, 30);  // another common size
    mqph2RecalcDoor();
    mqph2ModalTab('door');
    document.getElementById('mqph2-overlay').classList.add('show');
  };

  window.mqph2CloseModal = function() {
    document.getElementById('mqph2-overlay').classList.remove('show');
  };

  window.mqph2ModalTab = function(tab) {
    ['box','door'].forEach(t => {
      document.getElementById(`mqph2-tab-${t}`).classList.toggle('active', t === tab);
      document.getElementById(`mqph2-tab-${t}-btn`).classList.toggle('active', t === tab);
    });
  };

  // ============================================================
  // BOX CALCULATIONS
  // ============================================================
  function gn(id, d = 0) { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? d : v; }
  function fmt(n) { return '$' + Math.round(n).toLocaleString(); }

  window.mqph2UpdateMargin = function() {
    const v = document.getElementById('mqph2-margin').value;
    document.getElementById('mqph2-marg-disp').textContent = v + '%';
    document.getElementById('mqph2-r-mpct').textContent = v;
  };

  window.mqph2RecalcBox = function() {
    const mat = gn('mqph2-material') + gn('mqph2-hardware') + gn('mqph2-sundries');
    const lab = gn('mqph2-hours') * gn('mqph2-shoprate');
    const cost = mat + lab;
    const margin = gn('mqph2-margin', 30);
    const margAmt = cost * (margin / 100);
    const sell = cost + margAmt;
    const rate = sell / 2;

    document.getElementById('mqph2-r-mat').textContent = fmt(mat);
    document.getElementById('mqph2-r-lab').textContent = fmt(lab);
    document.getElementById('mqph2-r-cost').textContent = fmt(cost);
    document.getElementById('mqph2-r-marg').textContent = fmt(margAmt);
    document.getElementById('mqph2-r-sell').textContent = fmt(sell);
    document.getElementById('mqph2-r-rate').textContent = fmt(rate) + ' / lin ft';

    boxCalcRate = rate;
    const hasData = cost > 0;
    document.getElementById('mqph2-box-result').classList.toggle('hi', hasData);
    document.getElementById('mqph2-box-apply').disabled = rate <= 0;
    if (hasData) document.getElementById('mqph2-direct').value = '';
  };

  window.mqph2DirectCalc = function() {
    const direct = gn('mqph2-direct');
    const rate = direct / 2;
    document.getElementById('mqph2-direct-rate').textContent = fmt(rate) + ' / lin ft';
    boxCalcRate = rate;
    document.getElementById('mqph2-box-apply').disabled = rate <= 0;
    if (rate > 0) {
      ['mqph2-material','mqph2-hardware','mqph2-sundries','mqph2-hours','mqph2-shoprate'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      document.getElementById('mqph2-r-rate').textContent = fmt(rate) + ' / lin ft';
      document.getElementById('mqph2-r-sell').textContent = fmt(direct);
      document.getElementById('mqph2-box-result').classList.add('hi');
    }
  };

  window.mqph2ApplyBox = function() {
    if (boxCalcRate <= 0) return;
    const rounded = Math.round(boxCalcRate);
    const field = document.getElementById(`ph-${currentMat}`);
    if (field) {
      field.value = rounded;
      field.style.background = '#f0fdf4';
      field.style.borderColor = '#86efac';
      setTimeout(() => { field.style.background = ''; field.style.borderColor = ''; }, 2000);
    }
    mqph2CloseModal();
  };

  // ============================================================
  // DOOR CALCULATIONS
  // ============================================================
  window.mqph2AddDoorSize = function(defaultW, defaultH) {
    doorSizeCount++;
    const id = doorSizeCount;
    const container = document.getElementById('mqph2-door-sizes');
    const card = document.createElement('div');
    card.className = 'door-size-card';
    card.id = `mqph2-ds-${id}`;
    card.innerHTML = `
      <div class="door-size-hdr">
        <span>Cabinet ${id}</span>
        <button class="del-btn" onclick="mqph2RemoveDoorSize(${id})">×</button>
      </div>
      <div class="door-dims">
        <div class="dim-f"><label class="dim-l">Width (inches)</label><input type="number" class="dim-i" id="mqph2-dw-${id}" value="${defaultW || ''}" placeholder="e.g. 24" oninput="mqph2RecalcDoor()"/></div>
        <div class="dim-f"><label class="dim-l">Height (inches)</label><input type="number" class="dim-i" id="mqph2-dh-${id}" value="${defaultH || ''}" placeholder="e.g. 30" oninput="mqph2RecalcDoor()"/></div>
        <div class="dim-f"><label class="dim-l">How many doors?</label><input type="number" class="dim-i" id="mqph2-dqty-${id}" value="1" min="1" oninput="mqph2RecalcDoor()"/></div>
        <div class="dim-f"><label class="dim-l">Cabinet width (inches)</label><input type="number" class="dim-i" id="mqph2-dcw-${id}" value="${defaultW || ''}" placeholder="e.g. 24" oninput="mqph2RecalcDoor()"/></div>
      </div>`;
    container.appendChild(card);
    mqph2RecalcDoor();
  };

  window.mqph2RemoveDoorSize = function(id) {
    const card = document.getElementById(`mqph2-ds-${id}`);
    if (card) card.remove();
    mqph2RecalcDoor();
  };

  window.mqph2RecalcDoor = function() {
    const sqftRate = gn('mqph2-d-sqft');
    let totalFace = 0, totalLinFt = 0, count = 0;

    for (let i = 1; i <= doorSizeCount; i++) {
      const w = gn(`mqph2-dw-${i}`);
      const h = gn(`mqph2-dh-${i}`);
      const qty = gn(`mqph2-dqty-${i}`, 1);
      const cabW = gn(`mqph2-dcw-${i}`) || w;
      if (!w || !h || !document.getElementById(`mqph2-ds-${i}`)) continue;
      const faceSqft = (w * h * qty) / 144;
      const cabLinFt = cabW / 12;
      totalFace += faceSqft;
      totalLinFt += cabLinFt;
      count++;
    }

    if (count === 0 || totalLinFt === 0) {
      document.getElementById('mqph2-d-avgface').textContent = '0 sqft';
      document.getElementById('mqph2-d-avglinft').textContent = '0 sqft/lin ft';
      document.getElementById('mqph2-d-rate-disp').textContent = fmt(sqftRate) + ' / sqft';
      document.getElementById('mqph2-d-result').textContent = '$0 / lin ft';
      document.getElementById('mqph2-door-apply').disabled = true;
      return;
    }

    const avgFace = totalFace / count;
    const facePerLinFt = totalFace / totalLinFt;
    const upchargePerLinFt = facePerLinFt * sqftRate;

    document.getElementById('mqph2-d-avgface').textContent = (Math.round(avgFace * 10) / 10) + ' sqft';
    document.getElementById('mqph2-d-avglinft').textContent = (Math.round(facePerLinFt * 100) / 100) + ' sqft/lin ft';
    document.getElementById('mqph2-d-rate-disp').textContent = fmt(sqftRate) + ' / sqft';
    document.getElementById('mqph2-d-result').textContent = fmt(upchargePerLinFt) + ' / lin ft';

    doorCalcRate = upchargePerLinFt;
    document.getElementById('mqph2-door-result').classList.toggle('hi', upchargePerLinFt > 0);
    document.getElementById('mqph2-door-apply').disabled = upchargePerLinFt <= 0 || sqftRate <= 0;
  };

  window.mqph2ApplyDoor = function() {
    if (doorCalcRate <= 0) return;
    const rounded = Math.round(doorCalcRate);
    const field = document.getElementById(`ph-door-${currentDoorId}`);
    if (field) {
      field.value = rounded;
      field.style.background = '#f0fdf4';
      field.style.borderColor = '#86efac';
      setTimeout(() => { field.style.background = ''; field.style.borderColor = ''; }, 2000);
    }
    mqph2CloseModal();
  };

  // ============================================================
  // SAVE STATE & SAVE ALL
  // ============================================================
  window.mqph2SaveState = function() {
    // nothing needed — values are in fields
  };

  window.mqph2SaveAll = async function() {
    if (!shopRecord) return;

    const gv = id => parseFloat(document.getElementById(id)?.value) || 0;

    const fields = {
      'Melamine price':    gv('ph-melamine'),
      'Plywood price':     gv('ph-plywood'),
      'MDF price':         gv('ph-mdf'),
      'Solid wood price':  gv('ph-solid'),
      'Slab multiplier':   gv('ph-door-slab'),
      'Shaker multiplier': gv('ph-door-shaker'),
      'Raised multiplier': gv('ph-door-raised'),
      'Glass multiplier':  gv('ph-door-glass'),
      'Install rate uppers': gv('ph-install'),
      'Soft close hinges': gv('ph-hinges'),
      'Birch drawer box':  gv('ph-drawer'),
      'Removal rate':      gv('ph-removal'),
      'Local zone radius': gv('ph-zone-radius'),
      'Zone 2 surcharge':  gv('ph-zone2'),
      'Zone 3 surcharge':  gv('ph-zone3'),
      'Zone 4 surcharge':  gv('ph-zone4'),
      'Tax rate':          gv('ph-tax'),
      'Backsplash rate':   gv('ph-backsplash'),
      'Sink cutout':       gv('ph-sink'),
      'Cooktop cutout':    gv('ph-cooktop'),
    };

    try {
      if (pricingRecord) {
        await atUpdate(CONFIG.PRICING_TABLE, pricingRecord.id, fields);
      } else {
        fields['Shop'] = [shopRecord.id];
        const newRec = await atCreate(CONFIG.PRICING_TABLE, fields);
        pricingRecord = newRec;
      }
      const msg = document.getElementById('mqph2-save-msg');
      msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 3000);
      const inline = document.getElementById('ph-saved-inline');
      inline.style.display = 'block';
      setTimeout(() => inline.style.display = 'none', 2000);
    } catch(e) {
      const err = document.getElementById('mqph2-err-msg');
      err.style.display = 'block';
      setTimeout(() => err.style.display = 'none', 4000);
    }
  };

// ============================================================
  // INIT — called by dashboard.js, not self-initializing
  // ============================================================
  window.mqph2Init = function(passedShopRecord, passedPricingRecord) {
    shopRecord = passedShopRecord;
    pricingRecord = passedPricingRecord;

    const container = document.getElementById('mq-pricing-helper-v2');
    if (!container) return;

    injectStyles();
    container.innerHTML = buildHTML();
  };

})();
