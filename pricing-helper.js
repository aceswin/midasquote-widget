/*
 * MidasQuote Pricing Helper v1.0
 * Helps shop owners calculate their per-linear-foot rates
 * by back-calculating from their existing software quotes
 */

(function () {

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

  function gn(id, d = 0) { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? d : v; }
  function gv(id) { return document.getElementById(id)?.value || ''; }
  function el(id) { return document.getElementById(id); }
  function fmt(n) { return '$' + Math.round(n || 0).toLocaleString(); }

  // ============================================================
  // STATE
  // ============================================================
  let shopRecord = null;
  let pricingRecord = null;
  let materials = [];
  let doorStyles = [];
  let installMethod = 'per_lft';

  // Default materials
  const DEFAULT_MATERIALS = [
    { id: 'melamine', name: 'Melamine', field: 'Melamine price', default: 280 },
    { id: 'plywood',  name: 'Plywood',  field: 'Plywood price',  default: 380 },
    { id: 'mdf',      name: 'Painted MDF', field: 'MDF price',   default: 350 },
    { id: 'solid',    name: 'Solid wood', field: 'Solid wood price', default: 550 },
  ];

  const DEFAULT_DOORS = [
    { id: 'slab',   name: 'Slab (flat)',   field: 'Slab multiplier',   default: 0 },
    { id: 'shaker', name: 'Shaker',        field: 'Shaker multiplier', default: 0 },
    { id: 'raised', name: 'Raised panel',  field: 'Raised multiplier', default: 0 },
    { id: 'glass',  name: 'Glass inserts', field: 'Glass multiplier',  default: 0 },
  ];

  // ============================================================
  // STYLES
  // ============================================================
  function injectStyles() {
    if (document.getElementById('mq-ph-styles')) return;
    const s = document.createElement('style');
    s.id = 'mq-ph-styles';
    s.textContent = `
      #mq-pricing-helper *{box-sizing:border-box;margin:0;padding:0}
      #mq-pricing-helper{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:900px;margin:0 auto;padding:2rem}
      #mq-pricing-helper h1{font-size:22px;font-weight:700;color:#111;margin-bottom:6px}
      #mq-pricing-helper .mq-ph-sub{font-size:14px;color:#6b7280;margin-bottom:2rem;line-height:1.5}
      #mq-pricing-helper .mq-ph-tabs{display:flex;gap:4px;background:#f3f4f6;padding:4px;border-radius:10px;margin-bottom:2rem}
      #mq-pricing-helper .mq-ph-tab{flex:1;padding:8px 12px;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;border-radius:8px;text-align:center;transition:all 0.15s;border:none;background:none;font-family:inherit}
      #mq-pricing-helper .mq-ph-tab.active{background:#fff;color:#111;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
      #mq-pricing-helper .mq-ph-section{display:none}
      #mq-pricing-helper .mq-ph-section.active{display:block}
      #mq-pricing-helper .mq-ph-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem;margin-bottom:1.25rem}
      #mq-pricing-helper .mq-ph-card-title{font-size:14px;font-weight:600;color:#111;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between}
      #mq-pricing-helper .mq-ph-card-sub{font-size:12px;color:#6b7280;margin-bottom:1.25rem;line-height:1.5}
      #mq-pricing-helper .mq-ph-calc{background:#f9fafb;border-radius:10px;padding:1.25rem;margin-top:1rem}
      #mq-pricing-helper .mq-ph-calc-title{font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem}
      #mq-pricing-helper .mq-ph-row{display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;flex-wrap:wrap}
      #mq-pricing-helper .mq-ph-field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:140px}
      #mq-pricing-helper .mq-ph-label{font-size:12px;font-weight:500;color:#374151}
      #mq-pricing-helper .mq-ph-hint{font-size:11px;color:#9ca3af;line-height:1.4}
      #mq-pricing-helper input[type=number],#mq-pricing-helper input[type=text],#mq-pricing-helper select{font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;width:100%}
      #mq-pricing-helper input:focus,#mq-pricing-helper select:focus{outline:none;border-color:#1a1a1a}
      #mq-pricing-helper .mq-ph-result{background:#fff;border:1px solid #86efac;border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-top:1rem}
      #mq-pricing-helper .mq-ph-result-lbl{font-size:13px;color:#166534;font-weight:500}
      #mq-pricing-helper .mq-ph-result-val{font-size:20px;font-weight:700;color:#16a34a}
      #mq-pricing-helper .mq-ph-result-actions{display:flex;gap:8px;align-items:center}
      #mq-pricing-helper .mq-ph-btn{padding:8px 16px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer;border:1px solid #e5e7eb;background:#fff;color:#111;font-family:inherit;transition:all 0.15s}
      #mq-pricing-helper .mq-ph-btn:hover{background:#f9fafb}
      #mq-pricing-helper .mq-ph-btn-primary{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
      #mq-pricing-helper .mq-ph-btn-primary:hover{opacity:0.88;background:#1a1a1a}
      #mq-pricing-helper .mq-ph-btn-sm{padding:5px 10px;font-size:12px}
      #mq-pricing-helper .mq-ph-btn-danger{color:#dc2626;border-color:#fca5a5}
      #mq-pricing-helper .mq-ph-btn-danger:hover{background:#fef2f2}
      #mq-pricing-helper .mq-ph-divider{height:1px;background:#e5e7eb;margin:1.25rem 0}
      #mq-pricing-helper .mq-ph-mat-header{display:grid;grid-template-columns:1fr 120px 120px 120px auto;gap:8px;align-items:center;padding:8px 12px;background:#f9fafb;border-radius:8px 8px 0 0;border:1px solid #e5e7eb;border-bottom:none;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em}
      #mq-pricing-helper .mq-ph-mat-row{display:grid;grid-template-columns:1fr 120px 120px 120px auto;gap:8px;align-items:center;padding:10px 12px;border:1px solid #e5e7eb;border-top:none}
      #mq-pricing-helper .mq-ph-mat-row:last-child{border-radius:0 0 8px 8px}
      #mq-pricing-helper .mq-ph-mat-row input{border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;font-size:13px;font-family:inherit;width:100%}
      #mq-pricing-helper .mq-ph-saved{background:#dcfce7;color:#166534;font-size:12px;padding:6px 12px;border-radius:6px;display:none;margin-top:8px}
      #mq-pricing-helper .mq-ph-error{background:#fee2e2;color:#991b1b;font-size:12px;padding:6px 12px;border-radius:6px;display:none;margin-top:8px}
      #mq-pricing-helper .mq-ph-info{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;font-size:13px;color:#1e40af;line-height:1.5;margin-bottom:1rem}
      #mq-pricing-helper .mq-ph-radio-group{display:flex;gap:12px;flex-wrap:wrap}
      #mq-pricing-helper .mq-ph-radio{display:flex;align-items:center;gap:6px;font-size:13px;color:#111;cursor:pointer;padding:8px 14px;border:1px solid #e5e7eb;border-radius:8px;transition:all 0.15s}
      #mq-pricing-helper .mq-ph-radio:has(input:checked){background:#f0fdf4;border-color:#86efac;color:#166534}
      #mq-pricing-helper .mq-ph-summary{background:#fff;border:2px solid #1a1a1a;border-radius:12px;padding:1.5rem;margin-top:1.5rem}
      #mq-pricing-helper .mq-ph-summary-title{font-size:15px;font-weight:700;color:#111;margin-bottom:1rem;display:flex;align-items:center;gap:8px}
      #mq-pricing-helper .mq-ph-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:1.25rem}
      #mq-pricing-helper .mq-ph-summary-item{background:#f9fafb;border-radius:8px;padding:10px 12px}
      #mq-pricing-helper .mq-ph-summary-lbl{font-size:11px;color:#6b7280;margin-bottom:2px}
      #mq-pricing-helper .mq-ph-summary-val{font-size:16px;font-weight:700;color:#111}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // BUILD HTML
  // ============================================================
  function buildHTML() {
    return `
      <h1>⚙️ Pricing Setup Helper</h1>
      <p class="mq-ph-sub">This tool helps you figure out your exact per-linear-foot rates by back-calculating from jobs you've already priced in your current software. No guessing — just real numbers from your real quotes.</p>

      <div class="mq-ph-tabs">
        <button class="mq-ph-tab active" onclick="mqPhTab('materials',this)">🪵 Cabinet materials</button>
        <button class="mq-ph-tab" onclick="mqPhTab('doors',this)">🚪 Door styles</button>
        <button class="mq-ph-tab" onclick="mqPhTab('install',this)">🔨 Installation</button>
        <button class="mq-ph-tab" onclick="mqPhTab('summary',this)">✅ Review & save</button>
      </div>

      <!-- MATERIALS -->
      <div class="mq-ph-section active" id="mqph-materials">
        <div class="mq-ph-info">
          💡 <strong>How this works:</strong> In your current software, quote a simple open cabinet with no doors — just the box. Use a standard 2-foot wide cabinet at whatever height you normally use. Enter what your software says it costs, and we'll calculate your per-linear-foot rate automatically.
        </div>

        <div id="mqph-mat-list"></div>

        <button class="mq-ph-btn" onclick="mqPhAddMaterial()" style="margin-top:1rem">+ Add material type</button>

        <div class="mq-ph-divider"></div>
        <div style="display:flex;justify-content:flex-end">
          <button class="mq-ph-btn mq-ph-btn-primary" onclick="mqPhTab('doors',document.querySelectorAll('.mq-ph-tab')[1])">Next: Door styles →</button>
        </div>
      </div>

      <!-- DOORS -->
      <div class="mq-ph-section" id="mqph-doors">
        <div class="mq-ph-info">
          💡 <strong>How this works:</strong> Door style adders are the EXTRA cost per linear foot above your base cabinet price. Quote the same cabinet twice in your software — once with slab doors, once with shaker doors. The difference divided by linear feet = your shaker adder.
        </div>

        <div id="mqph-door-list"></div>

        <button class="mq-ph-btn" onclick="mqPhAddDoor()" style="margin-top:1rem">+ Add door style</button>

        <div class="mq-ph-divider"></div>
        <div style="display:flex;justify-content:space-between">
          <button class="mq-ph-btn" onclick="mqPhTab('materials',document.querySelectorAll('.mq-ph-tab')[0])">← Back</button>
          <button class="mq-ph-btn mq-ph-btn-primary" onclick="mqPhTab('install',document.querySelectorAll('.mq-ph-tab')[2])">Next: Installation →</button>
        </div>
      </div>

      <!-- INSTALL -->
      <div class="mq-ph-section" id="mqph-install">
        <div class="mq-ph-card">
          <div class="mq-ph-card-title">Installation pricing method</div>
          <p class="mq-ph-card-sub">How do you charge for installation? Choose the method that matches how you quote jobs.</p>

          <div class="mq-ph-radio-group" style="margin-bottom:1.5rem">
            <label class="mq-ph-radio">
              <input type="radio" name="install-method" value="per_lft" checked onchange="mqPhInstallMethod('per_lft')"/>
              Per linear foot
            </label>
            <label class="mq-ph-radio">
              <input type="radio" name="install-method" value="per_cab" onchange="mqPhInstallMethod('per_cab')"/>
              Per cabinet
            </label>
            <label class="mq-ph-radio">
              <input type="radio" name="install-method" value="percent" onchange="mqPhInstallMethod('percent')"/>
              % of material cost
            </label>
            <label class="mq-ph-radio">
              <input type="radio" name="install-method" value="none" onchange="mqPhInstallMethod('none')"/>
              I don't install
            </label>
          </div>

          <!-- Per linear foot -->
          <div id="mqph-install-lft">
            <div class="mq-ph-calc">
              <div class="mq-ph-calc-title">Calculate your per-linear-foot install rate</div>
              <div class="mq-ph-row">
                <div class="mq-ph-field">
                  <label class="mq-ph-label">What do you charge to install a typical kitchen?</label>
                  <input type="number" id="mqph-install-job-cost" placeholder="e.g. 2500" oninput="mqPhCalcInstall()"/>
                  <span class="mq-ph-hint">Total install charge for the whole job</span>
                </div>
                <div class="mq-ph-field">
                  <label class="mq-ph-label">How many linear feet of cabinets?</label>
                  <input type="number" id="mqph-install-job-ft" placeholder="e.g. 30" oninput="mqPhCalcInstall()"/>
                  <span class="mq-ph-hint">Uppers + bases combined</span>
                </div>
              </div>
              <div class="mq-ph-result" id="mqph-install-lft-result" style="display:none">
                <div>
                  <div class="mq-ph-result-lbl">Your install rate</div>
                  <div class="mq-ph-result-val" id="mqph-install-lft-val">—</div>
                </div>
                <button class="mq-ph-btn mq-ph-btn-primary mq-ph-btn-sm" onclick="mqPhUseInstall()">Use this rate</button>
              </div>
              <div style="margin-top:1rem">
                <label class="mq-ph-label">Or enter directly (per linear foot):</label>
                <input type="number" id="mqph-install-direct" placeholder="e.g. 85" style="max-width:200px;margin-top:6px"/>
              </div>
            </div>
          </div>

          <!-- Per cabinet -->
          <div id="mqph-install-cab" style="display:none">
            <div class="mq-ph-calc">
              <div class="mq-ph-calc-title">Convert per-cabinet rate to per-linear-foot</div>
              <div class="mq-ph-row">
                <div class="mq-ph-field">
                  <label class="mq-ph-label">Install charge per cabinet</label>
                  <input type="number" id="mqph-install-per-cab" placeholder="e.g. 75" oninput="mqPhCalcInstallCab()"/>
                </div>
                <div class="mq-ph-field">
                  <label class="mq-ph-label">Average cabinet width (inches)</label>
                  <input type="number" id="mqph-install-cab-width" placeholder="e.g. 18" value="18" oninput="mqPhCalcInstallCab()"/>
                  <span class="mq-ph-hint">Typically 15–21 inches for standard cabinets</span>
                </div>
              </div>
              <div class="mq-ph-result" id="mqph-install-cab-result" style="display:none">
                <div>
                  <div class="mq-ph-result-lbl">Equivalent per-linear-foot rate</div>
                  <div class="mq-ph-result-val" id="mqph-install-cab-val">—</div>
                </div>
                <button class="mq-ph-btn mq-ph-btn-primary mq-ph-btn-sm" onclick="mqPhUseInstallCab()">Use this rate</button>
              </div>
            </div>
          </div>

          <!-- Percent -->
          <div id="mqph-install-pct" style="display:none">
            <div class="mq-ph-calc">
              <div class="mq-ph-calc-title">Estimate average install rate from percentage</div>
              <div class="mq-ph-row">
                <div class="mq-ph-field">
                  <label class="mq-ph-label">Install as % of material cost</label>
                  <input type="number" id="mqph-install-pct-val" placeholder="e.g. 25" oninput="mqPhCalcInstallPct()"/>
                </div>
                <div class="mq-ph-field">
                  <label class="mq-ph-label">Your typical material cost per linear foot</label>
                  <input type="number" id="mqph-install-pct-base" placeholder="e.g. 300" oninput="mqPhCalcInstallPct()"/>
                  <span class="mq-ph-hint">Use your most common material rate</span>
                </div>
              </div>
              <div class="mq-ph-result" id="mqph-install-pct-result" style="display:none">
                <div>
                  <div class="mq-ph-result-lbl">Equivalent per-linear-foot install rate</div>
                  <div class="mq-ph-result-val" id="mqph-install-pct-res">—</div>
                </div>
                <button class="mq-ph-btn mq-ph-btn-primary mq-ph-btn-sm" onclick="mqPhUseInstallPct()">Use this rate</button>
              </div>
            </div>
          </div>

          <!-- None -->
          <div id="mqph-install-none" style="display:none">
            <div class="mq-ph-info" style="background:#f0fdf4;border-color:#86efac;color:#166534">
              ✓ No problem — the widget will default to "Supply only" and won't show install pricing to customers.
            </div>
          </div>

        </div>

        <div class="mq-ph-divider"></div>
        <div style="display:flex;justify-content:space-between">
          <button class="mq-ph-btn" onclick="mqPhTab('doors',document.querySelectorAll('.mq-ph-tab')[1])">← Back</button>
          <button class="mq-ph-btn mq-ph-btn-primary" onclick="mqPhTab('summary',document.querySelectorAll('.mq-ph-tab')[3])">Next: Review & save →</button>
        </div>
      </div>

      <!-- SUMMARY -->
      <div class="mq-ph-section" id="mqph-summary">
        <div class="mq-ph-card">
          <div class="mq-ph-card-title">Your calculated rates</div>
          <p class="mq-ph-card-sub">Review everything below before saving to your widget. You can always come back and adjust.</p>
          <div id="mqph-summary-content"></div>
          <div id="mqph-save-msg" class="mq-ph-saved"></div>
          <div id="mqph-save-err" class="mq-ph-error"></div>
          <div style="margin-top:1.5rem;display:flex;gap:12px">
            <button class="mq-ph-btn mq-ph-btn-primary" onclick="mqPhSaveAll()" style="flex:1;padding:12px">💾 Save all rates to my widget</button>
            <button class="mq-ph-btn" onclick="mqPhTab('materials',document.querySelectorAll('.mq-ph-tab')[0])">← Start over</button>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================
  // MATERIAL CARD BUILDER
  // ============================================================
  function buildMaterialCard(mat, index) {
    const isCustom = mat.custom === true;
    return `
      <div class="mq-ph-card" id="mqph-mat-${mat.id}">
        <div class="mq-ph-card-title">
          <span>
            ${isCustom ? `<input type="text" value="${mat.name}" id="mqph-mat-name-${mat.id}" style="font-size:14px;font-weight:600;border:1px solid #e5e7eb;border-radius:6px;padding:3px 8px;width:200px" placeholder="Material name"/>` : `🪵 ${mat.name}`}
          </span>
          ${isCustom ? `<button class="mq-ph-btn mq-ph-btn-danger mq-ph-btn-sm" onclick="mqPhRemoveMaterial('${mat.id}')">Remove</button>` : ''}
        </div>
        <p class="mq-ph-card-sub">
          In your software, quote a simple <strong>2-foot wide open cabinet with no doors</strong> made of ${mat.name.toLowerCase()}. Just the box — no hardware, no doors. Enter the cost below.
        </p>
        <div class="mq-ph-calc">
          <div class="mq-ph-calc-title">Back-calculate your ${mat.name} rate</div>
          <div class="mq-ph-row">
            <div class="mq-ph-field">
              <label class="mq-ph-label">Your software's cost for a 2ft ${mat.name} cabinet</label>
              <input type="number" id="mqph-mat-cost-${mat.id}" placeholder="e.g. ${mat.default * 2}" oninput="mqPhCalcMat('${mat.id}',${mat.default})"/>
              <span class="mq-ph-hint">Box only, no doors, no hardware</span>
            </div>
            <div class="mq-ph-field">
              <label class="mq-ph-label">Cabinet width (feet)</label>
              <input type="number" id="mqph-mat-ft-${mat.id}" value="2" oninput="mqPhCalcMat('${mat.id}',${mat.default})"/>
              <span class="mq-ph-hint">Default is 2ft — change if needed</span>
            </div>
          </div>
          <div class="mq-ph-result" id="mqph-mat-result-${mat.id}" style="display:none">
            <div>
              <div class="mq-ph-result-lbl">Your ${mat.name} rate per linear foot</div>
              <div class="mq-ph-result-val" id="mqph-mat-val-${mat.id}">—</div>
            </div>
            <div class="mq-ph-result-actions">
              <span style="font-size:12px;color:#6b7280" id="mqph-mat-saved-${mat.id}"></span>
              <button class="mq-ph-btn mq-ph-btn-primary mq-ph-btn-sm" onclick="mqPhUseMat('${mat.id}','${mat.name}','${mat.field}')">Use this rate ✓</button>
            </div>
          </div>
          <div style="margin-top:1rem">
            <label class="mq-ph-label">Or enter directly:</label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
              <input type="number" id="mqph-mat-direct-${mat.id}" placeholder="${mat.default}" style="max-width:150px"/>
              <span style="font-size:13px;color:#6b7280">per linear foot</span>
              <button class="mq-ph-btn mq-ph-btn-sm" onclick="mqPhUseMatDirect('${mat.id}','${mat.name}','${mat.field}')">Use</button>
            </div>
          </div>
        </div>
        <div style="margin-top:1rem;display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:13px;color:#6b7280">Current rate: <strong id="mqph-mat-current-${mat.id}">${mat.current ? fmt(mat.current) + '/ft' : 'Not set'}</strong></div>
        </div>
      </div>`;
  }

  function buildDoorCard(door, index) {
    const isCustom = door.custom === true;
    return `
      <div class="mq-ph-card" id="mqph-door-${door.id}">
        <div class="mq-ph-card-title">
          <span>
            ${isCustom ? `<input type="text" value="${door.name}" id="mqph-door-name-${door.id}" style="font-size:14px;font-weight:600;border:1px solid #e5e7eb;border-radius:6px;padding:3px 8px;width:200px" placeholder="Door style name"/>` : `🚪 ${door.name}`}
          </span>
          ${isCustom ? `<button class="mq-ph-btn mq-ph-btn-danger mq-ph-btn-sm" onclick="mqPhRemoveDoor('${door.id}')">Remove</button>` : ''}
        </div>
        <p class="mq-ph-card-sub">
          Quote the same 2ft cabinet twice — once with your base/slab doors and once with ${door.name.toLowerCase()} doors. The difference ÷ linear feet = your ${door.name.toLowerCase()} adder.
        </p>
        <div class="mq-ph-calc">
          <div class="mq-ph-calc-title">Calculate ${door.name} adder</div>
          <div class="mq-ph-row">
            <div class="mq-ph-field">
              <label class="mq-ph-label">Cost with base/slab doors (2ft cabinet)</label>
              <input type="number" id="mqph-door-base-${door.id}" placeholder="e.g. 560" oninput="mqPhCalcDoor('${door.id}')"/>
            </div>
            <div class="mq-ph-field">
              <label class="mq-ph-label">Cost with ${door.name.toLowerCase()} doors (same cabinet)</label>
              <input type="number" id="mqph-door-with-${door.id}" placeholder="e.g. 680" oninput="mqPhCalcDoor('${door.id}')"/>
            </div>
            <div class="mq-ph-field">
              <label class="mq-ph-label">Cabinet width (feet)</label>
              <input type="number" id="mqph-door-ft-${door.id}" value="2" oninput="mqPhCalcDoor('${door.id}')"/>
            </div>
          </div>
          <div class="mq-ph-result" id="mqph-door-result-${door.id}" style="display:none">
            <div>
              <div class="mq-ph-result-lbl">${door.name} adder per linear foot</div>
              <div class="mq-ph-result-val" id="mqph-door-val-${door.id}">—</div>
            </div>
            <div class="mq-ph-result-actions">
              <span style="font-size:12px;color:#6b7280" id="mqph-door-saved-${door.id}"></span>
              <button class="mq-ph-btn mq-ph-btn-primary mq-ph-btn-sm" onclick="mqPhUseDoor('${door.id}','${door.name}','${door.field}')">Use this rate ✓</button>
            </div>
          </div>
          <div style="margin-top:1rem">
            <label class="mq-ph-label">Or enter directly:</label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
              <input type="number" id="mqph-door-direct-${door.id}" placeholder="${door.default}" style="max-width:150px"/>
              <span style="font-size:13px;color:#6b7280">adder per linear foot</span>
              <button class="mq-ph-btn mq-ph-btn-sm" onclick="mqPhUseDoorDirect('${door.id}','${door.name}','${door.field}')">Use</button>
            </div>
          </div>
        </div>
        <div style="margin-top:1rem;font-size:13px;color:#6b7280">Current adder: <strong id="mqph-door-current-${door.id}">${door.current ? fmt(door.current) + '/ft' : 'Not set (0)'}</strong></div>
      </div>`;
  }

  // ============================================================
  // CALCULATIONS
  // ============================================================
  window.mqPhCalcMat = function(id, defaultVal) {
    const cost = gn(`mqph-mat-cost-${id}`);
    const ft = gn(`mqph-mat-ft-${id}`, 2);
    if (!cost || !ft) { el(`mqph-mat-result-${id}`).style.display = 'none'; return; }
    const rate = cost / ft;
    el(`mqph-mat-val-${id}`).textContent = fmt(rate) + '/ft';
    el(`mqph-mat-result-${id}`).style.display = 'flex';
    // Store calculated rate
    const mat = materials.find(m => m.id === id);
    if (mat) mat.calculated = rate;
  };

  window.mqPhCalcDoor = function(id) {
    const base = gn(`mqph-door-base-${id}`);
    const withDoor = gn(`mqph-door-with-${id}`);
    const ft = gn(`mqph-door-ft-${id}`, 2);
    if (!base || !withDoor || !ft) { el(`mqph-door-result-${id}`).style.display = 'none'; return; }
    const adder = (withDoor - base) / ft;
    el(`mqph-door-val-${id}`).textContent = adder >= 0 ? fmt(adder) + '/ft' : '— (no adder)';
    el(`mqph-door-result-${id}`).style.display = 'flex';
    const door = doorStyles.find(d => d.id === id);
    if (door) door.calculated = Math.max(0, adder);
  };

  window.mqPhCalcInstall = function() {
    const cost = gn('mqph-install-job-cost');
    const ft = gn('mqph-install-job-ft');
    if (!cost || !ft) { el('mqph-install-lft-result').style.display = 'none'; return; }
    const rate = cost / ft;
    el('mqph-install-lft-val').textContent = fmt(rate) + '/ft';
    el('mqph-install-lft-result').style.display = 'flex';
    window._mqInstallRate = rate;
  };

  window.mqPhCalcInstallCab = function() {
    const perCab = gn('mqph-install-per-cab');
    const width = gn('mqph-install-cab-width', 18);
    if (!perCab || !width) { el('mqph-install-cab-result').style.display = 'none'; return; }
    const rate = perCab / (width / 12);
    el('mqph-install-cab-val').textContent = fmt(rate) + '/ft';
    el('mqph-install-cab-result').style.display = 'flex';
    window._mqInstallRate = rate;
  };

  window.mqPhCalcInstallPct = function() {
    const pct = gn('mqph-install-pct-val');
    const base = gn('mqph-install-pct-base');
    if (!pct || !base) { el('mqph-install-pct-result').style.display = 'none'; return; }
    const rate = base * (pct / 100);
    el('mqph-install-pct-res').textContent = fmt(rate) + '/ft';
    el('mqph-install-pct-result').style.display = 'flex';
    window._mqInstallRate = rate;
  };

  // ============================================================
  // USE RATE FUNCTIONS
  // ============================================================
  window.mqPhUseMat = function(id, name, field) {
    const mat = materials.find(m => m.id === id);
    if (!mat || !mat.calculated) return;
    mat.saved = mat.calculated;
    mat.field = field;
    const savedEl = el(`mqph-mat-saved-${id}`);
    if (savedEl) savedEl.textContent = '✓ Saved';
    updateSummary();
  };

  window.mqPhUseMatDirect = function(id, name, field) {
    const val = gn(`mqph-mat-direct-${id}`);
    if (!val) return;
    const mat = materials.find(m => m.id === id);
    if (!mat) return;
    mat.saved = val;
    mat.field = field;
    const savedEl = el(`mqph-mat-saved-${id}`);
    if (savedEl) { savedEl.textContent = '✓ Saved'; }
    updateSummary();
  };

  window.mqPhUseDoor = function(id, name, field) {
    const door = doorStyles.find(d => d.id === id);
    if (!door || door.calculated === undefined) return;
    door.saved = door.calculated;
    door.field = field;
    const savedEl = el(`mqph-door-saved-${id}`);
    if (savedEl) savedEl.textContent = '✓ Saved';
    updateSummary();
  };

  window.mqPhUseDoorDirect = function(id, name, field) {
    const val = gn(`mqph-door-direct-${id}`);
    const door = doorStyles.find(d => d.id === id);
    if (!door) return;
    door.saved = val || 0;
    door.field = field;
    const savedEl = el(`mqph-door-saved-${id}`);
    if (savedEl) savedEl.textContent = '✓ Saved';
    updateSummary();
  };

  window.mqPhUseInstall = function() {
    if (window._mqInstallRate) {
      el('mqph-install-direct').value = Math.round(window._mqInstallRate);
    }
  };

  window.mqPhUseInstallCab = function() {
    if (window._mqInstallRate) {
      el('mqph-install-direct').value = Math.round(window._mqInstallRate);
    }
  };

  window.mqPhUseInstallPct = function() {
    if (window._mqInstallRate) {
      el('mqph-install-direct').value = Math.round(window._mqInstallRate);
    }
  };

  // ============================================================
  // ADD / REMOVE
  // ============================================================
  window.mqPhAddMaterial = function() {
    const id = 'custom_mat_' + Date.now();
    const newMat = { id, name: 'New material', field: id, default: 300, custom: true };
    materials.push(newMat);
    const container = el('mqph-mat-list');
    const div = document.createElement('div');
    div.innerHTML = buildMaterialCard(newMat, materials.length);
    container.appendChild(div.firstElementChild);
  };

  window.mqPhRemoveMaterial = function(id) {
    materials = materials.filter(m => m.id !== id);
    const card = el(`mqph-mat-${id}`);
    if (card) card.remove();
    updateSummary();
  };

  window.mqPhAddDoor = function() {
    const id = 'custom_door_' + Date.now();
    const newDoor = { id, name: 'New door style', field: id, default: 0, custom: true };
    doorStyles.push(newDoor);
    const container = el('mqph-door-list');
    const div = document.createElement('div');
    div.innerHTML = buildDoorCard(newDoor, doorStyles.length);
    container.appendChild(div.firstElementChild);
  };

  window.mqPhRemoveDoor = function(id) {
    doorStyles = doorStyles.filter(d => d.id !== id);
    const card = el(`mqph-door-${id}`);
    if (card) card.remove();
    updateSummary();
  };

  // ============================================================
  // INSTALL METHOD SWITCH
  // ============================================================
  window.mqPhInstallMethod = function(method) {
    installMethod = method;
    ['lft','cab','pct','none'].forEach(m => {
      const e = el(`mqph-install-${m}`);
      if (e) e.style.display = 'none';
    });
    const show = el(`mqph-install-${method === 'per_lft' ? 'lft' : method === 'per_cab' ? 'cab' : method === 'percent' ? 'pct' : 'none'}`);
    if (show) show.style.display = 'block';
  };

  // ============================================================
  // TABS
  // ============================================================
  window.mqPhTab = function(id, btn) {
    document.querySelectorAll('#mq-pricing-helper .mq-ph-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#mq-pricing-helper .mq-ph-section').forEach(s => s.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const section = el(`mqph-${id}`);
    if (section) section.classList.add('active');
    if (id === 'summary') updateSummary();
  };

  // ============================================================
  // SUMMARY
  // ============================================================
  function updateSummary() {
    const container = el('mqph-summary-content');
    if (!container) return;

    const installRate = installMethod === 'none' ? 0 : (gn('mqph-install-direct') || window._mqInstallRate || 0);
    const savedMats = materials.filter(m => m.saved !== undefined);
    const savedDoors = doorStyles.filter(d => d.saved !== undefined);

    container.innerHTML = `
      <div style="margin-bottom:1.5rem">
        <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:8px">🪵 Cabinet materials (per linear foot)</div>
        <div class="mq-ph-summary-grid">
          ${materials.map(m => `
            <div class="mq-ph-summary-item">
              <div class="mq-ph-summary-lbl">${m.custom ? (el(`mqph-mat-name-${m.id}`)?.value || m.name) : m.name}</div>
              <div class="mq-ph-summary-val" style="${m.saved ? 'color:#16a34a' : 'color:#9ca3af'}">${m.saved ? fmt(m.saved) + '/ft' : 'Not set'}</div>
            </div>`).join('')}
        </div>
      </div>
      <div style="margin-bottom:1.5rem">
        <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:8px">🚪 Door style adders (per linear foot)</div>
        <div class="mq-ph-summary-grid">
          ${doorStyles.map(d => `
            <div class="mq-ph-summary-item">
              <div class="mq-ph-summary-lbl">${d.custom ? (el(`mqph-door-name-${d.id}`)?.value || d.name) : d.name}</div>
              <div class="mq-ph-summary-val" style="${d.saved !== undefined ? 'color:#16a34a' : 'color:#9ca3af'}">${d.saved !== undefined ? fmt(d.saved) + '/ft' : 'Not set'}</div>
            </div>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:13px;font-weight:600;color:#111;margin-bottom:8px">🔨 Installation</div>
        <div class="mq-ph-summary-grid">
          <div class="mq-ph-summary-item">
            <div class="mq-ph-summary-lbl">Install rate</div>
            <div class="mq-ph-summary-val" style="${installRate ? 'color:#16a34a' : 'color:#9ca3af'}">${installRate ? fmt(installRate) + '/ft' : installMethod === 'none' ? 'Not included' : 'Not set'}</div>
          </div>
        </div>
      </div>`;
  }

  // ============================================================
  // SAVE ALL
  // ============================================================
  window.mqPhSaveAll = async function() {
    if (!pricingRecord && !shopRecord) {
      el('mqph-save-err').textContent = 'No shop record found. Please refresh and try again.';
      el('mqph-save-err').style.display = 'block';
      return;
    }

    const installRate = installMethod === 'none' ? 0 : (gn('mqph-install-direct') || window._mqInstallRate || 0);
    const fields = { 'Install rate uppers': Math.round(installRate) };

    // Add material rates
    materials.forEach(m => {
      if (m.saved && m.field && !m.custom) {
        fields[m.field] = Math.round(m.saved);
      }
    });

    // Add door adders
    doorStyles.forEach(d => {
      if (d.saved !== undefined && d.field && !d.custom) {
        fields[d.field] = Math.round(d.saved);
      }
    });

    try {
      if (pricingRecord) {
        await atUpdate(CONFIG.PRICING_TABLE, pricingRecord.id, fields);
      } else {
        fields['Shop'] = [shopRecord.id];
        await atCreate(CONFIG.PRICING_TABLE, fields);
      }
      el('mqph-save-msg').textContent = '✓ All rates saved to your widget!';
      el('mqph-save-msg').style.display = 'block';
      el('mqph-save-err').style.display = 'none';
      setTimeout(() => { el('mqph-save-msg').style.display = 'none'; }, 4000);
    } catch(e) {
      el('mqph-save-err').textContent = 'Error saving — please try again.';
      el('mqph-save-err').style.display = 'block';
    }
  };

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    const container = document.getElementById('mq-pricing-helper');
    if (!container) {
      console.error('MidasQuote Pricing Helper: Add <div id="mq-pricing-helper"></div> to your page.');
      return;
    }

    injectStyles();
    container.innerHTML = '<div style="padding:3rem;text-align:center;color:#6b7280;font-size:14px">Loading pricing helper...</div>';

    // Get shop token
    let shopToken = new URLSearchParams(window.location.search).get('shop');
    if (!shopToken && window.$memberstackDom) {
      try {
        const { data: member } = await window.$memberstackDom.getCurrentMember();
        if (member) shopToken = member.metaData?.shopToken || member.customFields?.shopToken;
      } catch(e) {}
    }
    if (!shopToken) shopToken = 'dr-sales-001';

    // Load records
    const shops = await atGet(CONFIG.SHOPS_TABLE, `{Shop token} = "${shopToken}"`);
    if (shops.length) shopRecord = shops[0];

    if (shopRecord) {
      const pricing = await atGet(CONFIG.PRICING_TABLE, `FIND("${shopRecord.fields['Shop name']}", ARRAYJOIN({Shop}))`);
      if (pricing.length) pricingRecord = pricing[0];
    }

    // Initialize materials with current values
    materials = DEFAULT_MATERIALS.map(m => ({
      ...m,
      current: pricingRecord?.fields[m.field] || null,
      saved: pricingRecord?.fields[m.field] || undefined,
    }));

    doorStyles = DEFAULT_DOORS.map(d => ({
      ...d,
      current: pricingRecord?.fields[d.field] || null,
      saved: pricingRecord?.fields[d.field] !== undefined ? pricingRecord.fields[d.field] : undefined,
    }));

    // Build UI
    container.innerHTML = buildHTML();

    // Render material and door cards
    const matList = el('mqph-mat-list');
    materials.forEach((m, i) => {
      const div = document.createElement('div');
      div.innerHTML = buildMaterialCard(m, i);
      matList.appendChild(div.firstElementChild);
    });

    const doorList = el('mqph-door-list');
    doorStyles.forEach((d, i) => {
      const div = document.createElement('div');
      div.innerHTML = buildDoorCard(d, i);
      doorList.appendChild(div.firstElementChild);
    });

    // Pre-fill existing rates if available
    if (pricingRecord) {
      const f = pricingRecord.fields;
      if (f['Install rate uppers']) {
        const direct = el('mqph-install-direct');
        if (direct) direct.value = f['Install rate uppers'];
      }
      materials.forEach(m => {
        if (m.saved) {
          const cur = el(`mqph-mat-current-${m.id}`);
          if (cur) cur.textContent = fmt(m.saved) + '/ft';
        }
      });
      doorStyles.forEach(d => {
        if (d.saved !== undefined) {
          const cur = el(`mqph-door-current-${d.id}`);
          if (cur) cur.textContent = fmt(d.saved) + '/ft';
        }
      });
    }

    updateSummary();
  }

  init();

})();
