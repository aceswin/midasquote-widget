/*
 * MidasQuote Pricing Helper v3.0
 * Wizard-based setup + dynamic line item editor
 * Replaces pricing-helper-v2.js
 */

(function() {

  const LINE_ITEMS_TABLE = 'tblCkJsJ2OC6DgXok';

  let shopRecord = null;
  let pricingRecord = null;
  let lineItems = [];
  let wizardBaseline = null;
  let wizardStep = 0;
  let wizardItems = [];
  let currentEditId = null;

  const AT_BASE_URL = () => `https://api.airtable.com/v0/${shopRecord._baseId}`;
  const AT_HEADS = () => ({ 'Authorization': `Bearer ${shopRecord._token}`, 'Content-Type': 'application/json' });

  async function atGet(table, formula) {
    const url = `${AT_BASE_URL()}/${table}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=200`;
    const res = await fetch(url, { headers: AT_HEADS() });
    const data = await res.json();
    return data.records || [];
  }

  async function atCreate(table, fields) {
    const res = await fetch(`${AT_BASE_URL()}/${table}`, {
      method: 'POST', headers: AT_HEADS(),
      body: JSON.stringify({ fields })
    });
    return await res.json();
  }

  async function atUpdate(table, id, fields) {
    const res = await fetch(`${AT_BASE_URL()}/${table}/${id}`, {
      method: 'PATCH', headers: AT_HEADS(),
      body: JSON.stringify({ fields })
    });
    return await res.json();
  }

  async function atDelete(table, id) {
    const res = await fetch(`${AT_BASE_URL()}/${table}/${id}`, {
      method: 'DELETE', headers: AT_HEADS()
    });
    return await res.json();
  }

  // ============================================================
  // INJECT STYLES
  // ============================================================
  function injectStyles() {
    if (document.getElementById('mqph3-styles')) return;
    const s = document.createElement('style');
    s.id = 'mqph3-styles';
    s.textContent = `
      #mq-pricing-helper-v2 *{box-sizing:border-box;margin:0;padding:0}
      #mq-pricing-helper-v2{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2rem;max-width:900px}

      /* WIZARD */
      #mqph3-wizard{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:1.5rem}
      #mqph3-wizard-header{background:#1a1a1a;color:#fff;padding:1.5rem;display:flex;align-items:center;justify-content:space-between}
      #mqph3-wizard-header h2{font-size:16px;font-weight:600;margin:0}
      #mqph3-wizard-header p{font-size:13px;opacity:0.7;margin-top:4px}
      #mqph3-progress{display:flex;gap:4px;margin-top:12px}
      #mqph3-progress .step{flex:1;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;transition:background 0.3s}
      #mqph3-progress .step.done{background:#a3e635}
      #mqph3-progress .step.active{background:#fff}
      #mqph3-wizard-body{padding:1.5rem}
      #mqph3-wizard-nav{display:flex;gap:10px;padding:1rem 1.5rem;border-top:1px solid #e5e7eb;background:#f9fafb}

      /* STEP CARDS */
      .mqph3-step{display:none}
      .mqph3-step.active{display:block}
      .mqph3-step-title{font-size:18px;font-weight:700;color:#111;margin-bottom:6px}
      .mqph3-step-sub{font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6}
      .mqph3-highlight{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:1.25rem;font-size:13px;color:#166534;line-height:1.6}
      .mqph3-input-row{display:flex;align-items:center;gap:10px;margin-bottom:1rem}
      .mqph3-input-row label{font-size:13px;color:#374151;flex:1;font-weight:500}
      .mqph3-input-row input{width:130px;text-align:right;font-family:inherit;font-size:14px;font-weight:600;color:#111;background:#fff;border:1.5px solid #d1d5db;border-radius:8px;padding:8px 12px}
      .mqph3-input-row input:focus{outline:none;border-color:#1a1a1a}
      .mqph3-pfx{font-size:14px;color:#6b7280;font-weight:500}
      .mqph3-result-box{background:#f9fafb;border-radius:8px;padding:1rem;margin-top:1rem;font-size:13px;color:#374151;line-height:1.8}
      .mqph3-result-box strong{color:#111}
      .mqph3-result-val{font-size:20px;font-weight:700;color:#16a34a}
      .mqph3-skip-link{font-size:12px;color:#9ca3af;cursor:pointer;text-decoration:underline;margin-left:auto}
      .mqph3-skip-link:hover{color:#6b7280}

      /* BUTTONS */
      .mqph3-btn{padding:10px 20px;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;border:none;font-family:inherit;transition:all 0.15s}
      .mqph3-btn-primary{background:#1a1a1a;color:#fff}
      .mqph3-btn-primary:hover{opacity:0.88}
      .mqph3-btn-secondary{background:#fff;color:#111;border:1px solid #e5e7eb}
      .mqph3-btn-secondary:hover{background:#f9fafb}
      .mqph3-btn-danger{background:#fff;color:#dc2626;border:1px solid #fca5a5}
      .mqph3-btn-danger:hover{background:#fef2f2}
      .mqph3-btn-sm{padding:5px 12px;font-size:12px}
      .mqph3-btn-success{background:#16a34a;color:#fff}
      .mqph3-btn-success:hover{opacity:0.88}

      /* ITEM TABLE */
      #mqph3-items-section{margin-top:0}
      .mqph3-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}
      .mqph3-section-title{font-size:14px;font-weight:700;color:#111;display:flex;align-items:center;gap:8px}
      .mqph3-category-block{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:1.25rem;overflow:hidden}
      .mqph3-cat-header{background:#f9fafb;padding:12px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between}
      .mqph3-cat-title{font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em}
      .mqph3-item-row{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid #f3f4f6}
      .mqph3-item-row:last-child{border-bottom:none}
      .mqph3-item-name{flex:1;font-size:13px;font-weight:500;color:#111}
      .mqph3-item-desc{font-size:11px;color:#9ca3af;margin-top:1px}
      .mqph3-item-rate{font-size:13px;font-weight:600;color:#111;min-width:80px;text-align:right}
      .mqph3-item-unit{font-size:11px;color:#6b7280;min-width:70px;text-align:right}
      .mqph3-item-active{width:36px;text-align:center}
      .mqph3-toggle{width:32px;height:18px;background:#d1d5db;border-radius:9px;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;display:inline-block}
      .mqph3-toggle.on{background:#16a34a}
      .mqph3-toggle::after{content:'';position:absolute;width:14px;height:14px;background:#fff;border-radius:50%;top:2px;left:2px;transition:left 0.2s}
      .mqph3-toggle.on::after{left:16px}
      .mqph3-empty{text-align:center;padding:2rem;color:#9ca3af;font-size:13px}

      /* MODAL */
      #mqph3-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;padding:1rem}
      #mqph3-modal-overlay.show{display:flex}
      #mqph3-modal{background:#fff;border-radius:12px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
      #mqph3-modal .mh{padding:1.25rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between}
      #mqph3-modal .mh h3{font-size:15px;font-weight:600;color:#111}
      #mqph3-modal .mh button{background:none;border:none;font-size:20px;color:#6b7280;cursor:pointer;line-height:1}
      #mqph3-modal .mb{padding:1.25rem}
      .mqph3-field{display:flex;flex-direction:column;gap:5px;margin-bottom:1rem}
      .mqph3-field label{font-size:12px;font-weight:600;color:#374151}
      .mqph3-field input,.mqph3-field select,.mqph3-field textarea{font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;width:100%}
      .mqph3-field input:focus,.mqph3-field select:focus{outline:none;border-color:#1a1a1a}
      .mqph3-field textarea{resize:vertical;min-height:60px}
      .mqph3-msg{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:1rem;display:none}
      .mqph3-msg-success{background:#dcfce7;color:#166534;border:1px solid #86efac}
      .mqph3-msg-error{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}

      /* CT DIRECT ENTRY */
      #mqph3-ct-section{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:1.25rem;overflow:hidden}
      #mqph3-ct-section .mqph3-cat-header{display:flex;align-items:center;justify-content:space-between}
      .mqph3-ct-row{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f3f4f6}
      .mqph3-ct-row:last-child{border-bottom:none}
      .mqph3-ct-label{flex:1;font-size:13px;color:#374151;font-weight:500}
      .mqph3-ct-input{display:flex;align-items:center;gap:6px}
      .mqph3-ct-input span{font-size:13px;color:#6b7280}
      .mqph3-ct-input input{width:90px;text-align:right;font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px}
      .mqph3-ct-input input:focus{outline:none;border-color:#1a1a1a}
      .mqph3-save-row{padding:1rem 1.5rem;border-top:1px solid #e5e7eb;background:#f9fafb;display:flex;align-items:center;gap:12px}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // WIZARD STEPS DEFINITION
  // ============================================================
  function buildWizardSteps() {
    return [
      // Step 0: Welcome
      {
        id: 'welcome',
        title: '👋 Welcome to Pricing Setup',
        sub: `We'll walk you through setting up your pricing in about 10 minutes. You'll answer a few questions about your real jobs and we'll reverse-engineer your rates automatically — no math required.\n\nWhen you're done, your pricing will power the quote widget on your website.`,
        content: () => `
          <div class="mqph3-highlight">💡 <strong>How it works:</strong> We'll ask you to quote a few simple cabinet jobs using your existing quoting software. Then we'll calculate your per-linear-foot rates automatically. This ensures your estimates are accurate to your real pricing.</div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:#374151">
            <div>✅ Takes about 10 minutes</div>
            <div>✅ Uses your real job prices</div>
            <div>✅ You can re-run anytime</div>
            <div>✅ Edit anything after setup</div>
          </div>`,
        skipLabel: null,
        nextLabel: 'Start setup →',
      },

      // Step 1: Baseline quote
      {
        id: 'baseline',
        title: '📐 Step 1 of 6 — Your baseline price',
        sub: 'First, let\'s establish your baseline. In your quoting software, create a quote for exactly this job:',
        content: () => `
          <div class="mqph3-highlight">
            <strong>Quote this exact job:</strong><br/>
            • 4 linear feet of upper cabinets<br/>
            • 4 linear feet of base cabinets<br/>
            • Your most basic box material (e.g. white melamine)<br/>
            • Flat slab doors<br/>
            • No hardware upgrades<br/>
            • Supply only (no installation)<br/>
            • No removal, local delivery
          </div>
          <div class="mqph3-input-row">
            <label>What's your total price for this job?</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-baseline-price" placeholder="0.00" step="0.01" oninput="mqph3CalcBaseline()"/>
          </div>
          <div class="mqph3-input-row">
            <label>What material did you use as your baseline?</label>
            <input type="text" id="mqph3-baseline-mat" placeholder="e.g. White melamine" style="width:200px;text-align:left"/>
          </div>
          <div id="mqph3-baseline-result" class="mqph3-result-box" style="display:none"></div>`,
        skipLabel: 'Skip for now',
        nextLabel: 'Next →',
        onNext: () => {
          const price = parseFloat(document.getElementById('mqph3-baseline-price')?.value || 0);
          const mat = document.getElementById('mqph3-baseline-mat')?.value || 'Base material';
          if (price > 0) {
            wizardBaseline = { price, linFt: 8, ratePerFt: price / 8 };
            wizardItems.push({
              name: mat,
              category: 'material',
              rate: Math.round(wizardBaseline.ratePerFt * 100) / 100,
              unit: 'per lin ft',
              description: 'Baseline material — reverse engineered from sample quote',
              active: true,
              isBaseline: true,
            });
          }
        }
      },

      // Step 2: Second material
      {
        id: 'material2',
        title: '🪵 Step 2 of 6 — Second material upcharge',
        sub: 'Now quote the same job but change only the cabinet material. Keep everything else identical.',
        content: () => `
          <div class="mqph3-highlight">
            <strong>Same job as before, but:</strong><br/>
            • Change cabinet material to your second option (e.g. prefinished birch plywood)<br/>
            • Keep same doors, hardware, linear feet
          </div>
          <div class="mqph3-input-row">
            <label>What material are you quoting now?</label>
            <input type="text" id="mqph3-mat2-name" placeholder="e.g. Prefinished birch plywood" style="width:220px;text-align:left"/>
          </div>
          <div class="mqph3-input-row">
            <label>Total price for this job?</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-mat2-price" placeholder="0.00" step="0.01" oninput="mqph3CalcMat2()"/>
          </div>
          <div id="mqph3-mat2-result" class="mqph3-result-box" style="display:none"></div>`,
        skipLabel: 'Skip — I only offer one material',
        nextLabel: 'Next →',
        onNext: () => {
          const price = parseFloat(document.getElementById('mqph3-mat2-price')?.value || 0);
          const name = document.getElementById('mqph3-mat2-name')?.value;
          if (price > 0 && name && wizardBaseline) {
            const upcharge = (price - wizardBaseline.price) / 8;
            wizardItems.push({
              name,
              category: 'material',
              rate: Math.round(upcharge * 100) / 100,
              unit: 'per lin ft upcharge vs baseline',
              description: 'Material upcharge — reverse engineered from sample quote',
              active: true,
            });
          }
        }
      },

      // Step 3: Door style upcharge
      {
        id: 'doors',
        title: '🚪 Step 3 of 6 — Door style upcharge',
        sub: 'Now quote the same baseline job but change the door style. Go back to your baseline material.',
        content: () => `
          <div class="mqph3-highlight">
            <strong>Same baseline job, but:</strong><br/>
            • Use your baseline material again<br/>
            • Change door style to your most popular upgrade (e.g. shaker, raised panel)<br/>
            • Keep everything else the same
          </div>
          <div class="mqph3-input-row">
            <label>What door style are you quoting?</label>
            <input type="text" id="mqph3-door1-name" placeholder="e.g. Maple shaker" style="width:220px;text-align:left"/>
          </div>
          <div class="mqph3-input-row">
            <label>Total price for this job?</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-door1-price" placeholder="0.00" step="0.01" oninput="mqph3CalcDoor1()"/>
          </div>
          <div id="mqph3-door1-result" class="mqph3-result-box" style="display:none"></div>`,
        skipLabel: 'Skip — same price regardless of door style',
        nextLabel: 'Next →',
        onNext: () => {
          const price = parseFloat(document.getElementById('mqph3-door1-price')?.value || 0);
          const name = document.getElementById('mqph3-door1-name')?.value;
          if (price > 0 && name && wizardBaseline) {
            const upcharge = (price - wizardBaseline.price) / 8;
            wizardItems.push({
              name,
              category: 'door',
              rate: Math.round(upcharge * 100) / 100,
              unit: 'per lin ft upcharge',
              description: 'Door style upcharge — reverse engineered from sample quote',
              active: true,
            });
          }
        }
      },

      // Step 4: Hardware
      {
        id: 'hardware',
        title: '⚙️ Step 4 of 6 — Hardware upgrades',
        sub: 'Let\'s calculate your hardware upgrade upcharges using the same baseline job.',
        content: () => `
          <div class="mqph3-highlight">
            <strong>Quote the baseline job twice:</strong><br/>
            1. Add soft-close hinges only → enter that price<br/>
            2. Upgrade to prefinished birch drawer boxes only → enter that price<br/>
            (If you don't offer these, leave blank and skip)
          </div>
          <div class="mqph3-input-row">
            <label>Baseline + soft-close hinges</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-hinges-price" placeholder="0.00" step="0.01" oninput="mqph3CalcHardware()"/>
          </div>
          <div class="mqph3-input-row">
            <label>Baseline + birch drawer boxes</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-drawers-price" placeholder="0.00" step="0.01" oninput="mqph3CalcHardware()"/>
          </div>
          <div id="mqph3-hardware-result" class="mqph3-result-box" style="display:none"></div>`,
        skipLabel: 'Skip hardware upgrades',
        nextLabel: 'Next →',
        onNext: () => {
          const hp = parseFloat(document.getElementById('mqph3-hinges-price')?.value || 0);
          const dp = parseFloat(document.getElementById('mqph3-drawers-price')?.value || 0);
          if (hp > 0 && wizardBaseline) {
            wizardItems.push({
              name: 'Soft-close hinges',
              category: 'hardware',
              rate: Math.round(((hp - wizardBaseline.price) / 8) * 100) / 100,
              unit: 'per lin ft upcharge',
              description: 'Soft-close hinge upgrade — reverse engineered from sample quote',
              active: true,
            });
          }
          if (dp > 0 && wizardBaseline) {
            wizardItems.push({
              name: 'Prefinished birch drawer boxes',
              category: 'hardware',
              rate: Math.round(((dp - wizardBaseline.price) / 8) * 100) / 100,
              unit: 'per lin ft upcharge',
              description: 'Birch drawer box upgrade — reverse engineered from sample quote',
              active: true,
            });
          }
        }
      },

      // Step 5: Installation
      {
        id: 'install',
        title: '🔧 Step 5 of 6 — Installation rates',
        sub: 'What do you charge to install cabinets? We keep uppers and bases separate since bases take more time.',
        content: () => `
          <div class="mqph3-highlight">
            <strong>Quote installation only (no supply) for:</strong><br/>
            • 4 linear feet of upper cabinets → enter install price<br/>
            • 4 linear feet of base cabinets → enter install price<br/>
            These are install-only prices, not including the cabinets themselves.
          </div>
          <div class="mqph3-input-row">
            <label>Install price for 4ft of uppers</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-install-u" placeholder="0.00" step="0.01" oninput="mqph3CalcInstall()"/>
          </div>
          <div class="mqph3-input-row">
            <label>Install price for 4ft of bases</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-install-b" placeholder="0.00" step="0.01" oninput="mqph3CalcInstall()"/>
          </div>
          <div id="mqph3-install-result" class="mqph3-result-box" style="display:none"></div>`,
        skipLabel: 'Skip — supply only, no installation',
        nextLabel: 'Next →',
        onNext: () => {
          const up = parseFloat(document.getElementById('mqph3-install-u')?.value || 0);
          const bp = parseFloat(document.getElementById('mqph3-install-b')?.value || 0);
          if (up > 0) {
            wizardItems.push({
              name: 'Install — uppers',
              category: 'install',
              rate: Math.round((up / 4) * 100) / 100,
              unit: 'per lin ft',
              description: 'Upper cabinet installation rate — reverse engineered from sample quote',
              active: true,
            });
          }
          if (bp > 0) {
            wizardItems.push({
              name: 'Install — bases',
              category: 'install',
              rate: Math.round((bp / 4) * 100) / 100,
              unit: 'per lin ft',
              description: 'Base cabinet installation rate — reverse engineered from sample quote',
              active: true,
            });
          }
        }
      },

      // Step 6: Other rates
      {
        id: 'other',
        title: '📋 Step 6 of 6 — Other rates',
        sub: 'A few more rates to round out your pricing. Enter what applies to your shop.',
        content: () => `
          <div class="mqph3-input-row">
            <label>Cabinet removal & disposal (per lin ft)</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-removal" placeholder="0.00" step="0.01"/>
          </div>
          <div class="mqph3-input-row">
            <label>Local zone radius (km)</label>
            <input type="number" id="mqph3-zone-radius" placeholder="15" style="width:130px;text-align:right"/>
            <span class="mqph3-pfx">km</span>
          </div>
          <div class="mqph3-input-row">
            <label>Zone 2 travel surcharge (flat fee)</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-zone2" placeholder="0.00"/>
          </div>
          <div class="mqph3-input-row">
            <label>Zone 3 travel surcharge (flat fee)</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-zone3" placeholder="0.00"/>
          </div>
          <div class="mqph3-input-row">
            <label>Zone 4 travel surcharge (flat fee)</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-zone4" placeholder="0.00"/>
          </div>
          <div class="mqph3-input-row">
            <label>Tax rate</label>
            <input type="number" id="mqph3-tax" placeholder="5" style="width:130px;text-align:right"/>
            <span class="mqph3-pfx">%</span>
          </div>`,
        skipLabel: 'Skip other rates',
        nextLabel: 'Finish setup →',
        onNext: () => {
          const removal = parseFloat(document.getElementById('mqph3-removal')?.value || 0);
          const zr = parseFloat(document.getElementById('mqph3-zone-radius')?.value || 15);
          const z2 = parseFloat(document.getElementById('mqph3-zone2')?.value || 0);
          const z3 = parseFloat(document.getElementById('mqph3-zone3')?.value || 0);
          const z4 = parseFloat(document.getElementById('mqph3-zone4')?.value || 0);
          const tax = parseFloat(document.getElementById('mqph3-tax')?.value || 0);
          if (removal > 0) wizardItems.push({ name: 'Cabinet removal', category: 'other', rate: removal, unit: 'per lin ft', description: 'Remove & dispose existing cabinets', active: true });
          if (zr > 0) wizardItems.push({ name: 'Local zone radius', category: 'zone', rate: zr, unit: 'km', description: 'Jobs within this distance = no travel surcharge', active: true });
          if (z2 > 0) wizardItems.push({ name: 'Zone 2 surcharge', category: 'zone', rate: z2, unit: 'flat', description: 'Travel surcharge for zone 2 jobs', active: true });
          if (z3 > 0) wizardItems.push({ name: 'Zone 3 surcharge', category: 'zone', rate: z3, unit: 'flat', description: 'Travel surcharge for zone 3 jobs', active: true });
          if (z4 > 0) wizardItems.push({ name: 'Zone 4 surcharge', category: 'zone', rate: z4, unit: 'flat', description: 'Travel surcharge for zone 4 jobs (100km+)', active: true });
          if (tax > 0) wizardItems.push({ name: 'Tax rate', category: 'tax', rate: tax, unit: '%', description: 'Applied to cabinet subtotal', active: true });
        }
      },
    ];
  }

  // ============================================================
  // WIZARD CALCULATIONS
  // ============================================================
  window.mqph3CalcBaseline = function() {
    const price = parseFloat(document.getElementById('mqph3-baseline-price')?.value || 0);
    const res = document.getElementById('mqph3-baseline-result');
    if (!res) return;
    if (price > 0) {
      const ratePerFt = price / 8;
      res.style.display = 'block';
      res.innerHTML = `<strong>Your baseline rate:</strong> <span class="mqph3-result-val">$${ratePerFt.toFixed(2)} / lin ft</span><br/><span style="font-size:12px;color:#6b7280">(${price} ÷ 8 lin ft = $${ratePerFt.toFixed(2)}/ft)</span>`;
    } else {
      res.style.display = 'none';
    }
  };

  window.mqph3CalcMat2 = function() {
    const price = parseFloat(document.getElementById('mqph3-mat2-price')?.value || 0);
    const res = document.getElementById('mqph3-mat2-result');
    if (!res || !wizardBaseline) return;
    if (price > 0) {
      const upcharge = (price - wizardBaseline.price) / 8;
      res.style.display = 'block';
      res.innerHTML = `<strong>Material upcharge:</strong> <span class="mqph3-result-val">$${upcharge.toFixed(2)} / lin ft</span><br/><span style="font-size:12px;color:#6b7280">(${price} − ${wizardBaseline.price} = $${(price - wizardBaseline.price).toFixed(2)} ÷ 8 lin ft)</span>`;
    } else {
      res.style.display = 'none';
    }
  };

  window.mqph3CalcDoor1 = function() {
    const price = parseFloat(document.getElementById('mqph3-door1-price')?.value || 0);
    const res = document.getElementById('mqph3-door1-result');
    if (!res || !wizardBaseline) return;
    if (price > 0) {
      const upcharge = (price - wizardBaseline.price) / 8;
      res.style.display = 'block';
      res.innerHTML = `<strong>Door style upcharge:</strong> <span class="mqph3-result-val">$${upcharge.toFixed(2)} / lin ft</span><br/><span style="font-size:12px;color:#6b7280">(${price} − ${wizardBaseline.price} = $${(price - wizardBaseline.price).toFixed(2)} ÷ 8 lin ft)</span>`;
    } else {
      res.style.display = 'none';
    }
  };

  window.mqph3CalcHardware = function() {
    const hp = parseFloat(document.getElementById('mqph3-hinges-price')?.value || 0);
    const dp = parseFloat(document.getElementById('mqph3-drawers-price')?.value || 0);
    const res = document.getElementById('mqph3-hardware-result');
    if (!res || !wizardBaseline) return;
    let html = '';
    if (hp > 0) {
      const u = (hp - wizardBaseline.price) / 8;
      html += `<strong>Soft-close hinges upcharge:</strong> <span class="mqph3-result-val">$${u.toFixed(2)} / lin ft</span><br/>`;
    }
    if (dp > 0) {
      const u = (dp - wizardBaseline.price) / 8;
      html += `<strong>Birch drawer box upcharge:</strong> <span class="mqph3-result-val">$${u.toFixed(2)} / lin ft</span>`;
    }
    if (html) { res.style.display = 'block'; res.innerHTML = html; }
    else res.style.display = 'none';
  };

  window.mqph3CalcInstall = function() {
    const up = parseFloat(document.getElementById('mqph3-install-u')?.value || 0);
    const bp = parseFloat(document.getElementById('mqph3-install-b')?.value || 0);
    const res = document.getElementById('mqph3-install-result');
    if (!res) return;
    let html = '';
    if (up > 0) html += `<strong>Upper install rate:</strong> <span class="mqph3-result-val">$${(up/4).toFixed(2)} / lin ft</span><br/>`;
    if (bp > 0) html += `<strong>Base install rate:</strong> <span class="mqph3-result-val">$${(bp/4).toFixed(2)} / lin ft</span>`;
    if (html) { res.style.display = 'block'; res.innerHTML = html; }
    else res.style.display = 'none';
  };

  // ============================================================
  // WIZARD NAVIGATION
  // ============================================================
  function renderWizardStep(steps, idx) {
    steps.forEach((s, i) => {
      const el = document.getElementById(`mqph3-step-${i}`);
      if (el) el.classList.toggle('active', i === idx);
    });
    // progress
    const dots = document.querySelectorAll('#mqph3-progress .step');
    dots.forEach((d, i) => {
      d.classList.remove('done','active');
      if (i < idx) d.classList.add('done');
      else if (i === idx) d.classList.add('active');
    });
    // nav buttons
    const backBtn = document.getElementById('mqph3-back-btn');
    const nextBtn = document.getElementById('mqph3-next-btn');
    const skipBtn = document.getElementById('mqph3-skip-btn');
    if (backBtn) backBtn.style.display = idx === 0 ? 'none' : 'inline-block';
    if (nextBtn) nextBtn.textContent = steps[idx].nextLabel || 'Next →';
    if (skipBtn) {
      skipBtn.style.display = steps[idx].skipLabel ? 'inline-block' : 'none';
      if (steps[idx].skipLabel) skipBtn.textContent = steps[idx].skipLabel;
    }
  }

  window.mqph3Next = function() {
    const steps = buildWizardSteps();
    if (steps[wizardStep].onNext) steps[wizardStep].onNext();
    wizardStep++;
    if (wizardStep >= steps.length) {
      mqph3FinishWizard();
    } else {
      renderWizardStep(steps, wizardStep);
    }
  };

  window.mqph3Back = function() {
    if (wizardStep > 0) {
      wizardStep--;
      renderWizardStep(buildWizardSteps(), wizardStep);
    }
  };

  window.mqph3SkipStep = function() {
    wizardStep++;
    const steps = buildWizardSteps();
    if (wizardStep >= steps.length) {
      mqph3FinishWizard();
    } else {
      renderWizardStep(steps, wizardStep);
    }
  };

  async function mqph3FinishWizard() {
    const container = document.getElementById('mq-pricing-helper-v2');
    if (!container) return;
    container.innerHTML = '<div style="padding:3rem;text-align:center;color:#6b7280;font-size:14px">Saving your pricing setup...</div>';

    // Delete existing line items for this shop
    const existing = await atGet(LINE_ITEMS_TABLE, `{Shop} = "${shopRecord._recordId}"`);
    for (const r of existing) {
      await atDelete(LINE_ITEMS_TABLE, r.id);
    }

    // Create new line items
    for (let i = 0; i < wizardItems.length; i++) {
      const item = wizardItems[i];
      await atCreate(LINE_ITEMS_TABLE, {
        'Shop': [shopRecord._recordId],
        'Name': item.name,
        'Category': item.category,
        'Rate': item.rate,
        'Unit': item.unit,
        'Description': item.description || '',
        'Active': item.active !== false,
        'Sort order': i + 1,
      });
    }

    // Reload
    await loadAndRender();
  }

  // ============================================================
  // BUILD WIZARD HTML
  // ============================================================
  function buildWizardHTML() {
    const steps = buildWizardSteps();
    const progressDots = steps.map((_, i) => `<div class="step"></div>`).join('');
    const stepDivs = steps.map((s, i) => `
      <div class="mqph3-step ${i === 0 ? 'active' : ''}" id="mqph3-step-${i}">
        <div class="mqph3-step-title">${s.title}</div>
        <div class="mqph3-step-sub" style="white-space:pre-line">${s.sub}</div>
        ${s.content()}
      </div>`).join('');

    return `
      <div id="mqph3-wizard">
        <div id="mqph3-wizard-header">
          <div>
            <h2>⚙️ Pricing Setup Wizard</h2>
            <p>Let's get your pricing dialled in</p>
          </div>
        </div>
        <div id="mqph3-progress">${progressDots}</div>
        <div id="mqph3-wizard-body">${stepDivs}</div>
        <div id="mqph3-wizard-nav">
          <button class="mqph3-btn mqph3-btn-secondary" id="mqph3-back-btn" onclick="mqph3Back()" style="display:none">← Back</button>
          <button class="mqph3-btn mqph3-btn-secondary mqph3-skip-link" id="mqph3-skip-btn" onclick="mqph3SkipStep()" style="display:none">Skip</button>
          <button class="mqph3-btn mqph3-btn-primary" id="mqph3-next-btn" onclick="mqph3Next()" style="margin-left:auto">Start setup →</button>
        </div>
      </div>`;
  }

  // ============================================================
  // ITEM EDITOR
  // ============================================================
  const CATEGORY_LABELS = {
    material: '🪵 Cabinet materials',
    door: '🚪 Door styles',
    hardware: '⚙️ Hardware upgrades',
    install: '🔧 Installation',
    zone: '🚗 Travel zones',
    tax: '🧾 Tax & other',
    countertop: '🪨 Countertops',
    other: '📋 Other',
  };

  function groupByCategory(items) {
    const groups = {};
    items.forEach(r => {
      const cat = r.fields['Category'] || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return groups;
  }

  function buildItemsHTML(items) {
    if (!items.length) {
      return `<div class="mqph3-empty">No pricing items yet. Run the setup wizard or add items manually.</div>`;
    }
    const groups = groupByCategory(items);
    return Object.entries(groups).map(([cat, recs]) => `
      <div class="mqph3-category-block">
        <div class="mqph3-cat-header">
          <span class="mqph3-cat-title">${CATEGORY_LABELS[cat] || cat}</span>
          <button class="mqph3-btn mqph3-btn-secondary mqph3-btn-sm" onclick="mqph3OpenAdd('${cat}')">+ Add</button>
        </div>
        ${recs.sort((a,b) => (a.fields['Sort order']||0)-(b.fields['Sort order']||0)).map(r => `
          <div class="mqph3-item-row" id="mqph3-row-${r.id}">
            <div style="flex:1;min-width:0">
              <div class="mqph3-item-name">${r.fields['Name'] || '—'}</div>
              ${r.fields['Description'] ? `<div class="mqph3-item-desc">${r.fields['Description']}</div>` : ''}
            </div>
            <div class="mqph3-item-rate">$${(r.fields['Rate'] || 0).toLocaleString()}</div>
            <div class="mqph3-item-unit">${r.fields['Unit'] || ''}</div>
            <div class="mqph3-item-active">
              <div class="mqph3-toggle ${r.fields['Active'] ? 'on' : ''}" onclick="mqph3ToggleActive('${r.id}', this)"></div>
            </div>
            <button class="mqph3-btn mqph3-btn-secondary mqph3-btn-sm" onclick="mqph3OpenEdit('${r.id}')">Edit</button>
            <button class="mqph3-btn mqph3-btn-danger mqph3-btn-sm" onclick="mqph3DeleteItem('${r.id}')">Delete</button>
          </div>`).join('')}
      </div>`).join('');
  }

  // ============================================================
  // MODAL
  // ============================================================
  window.mqph3OpenAdd = function(defaultCat) {
    currentEditId = null;
    document.getElementById('mqph3-modal-title').textContent = 'Add pricing item';
    document.getElementById('mqph3-item-name').value = '';
    document.getElementById('mqph3-item-category').value = defaultCat || 'material';
    document.getElementById('mqph3-item-rate').value = '';
    document.getElementById('mqph3-item-unit').value = 'per lin ft';
    document.getElementById('mqph3-item-desc').value = '';
    document.getElementById('mqph3-item-active').checked = true;
    document.getElementById('mqph3-modal-overlay').classList.add('show');
  };

  window.mqph3OpenEdit = function(id) {
    const rec = lineItems.find(r => r.id === id);
    if (!rec) return;
    currentEditId = id;
    document.getElementById('mqph3-modal-title').textContent = 'Edit pricing item';
    document.getElementById('mqph3-item-name').value = rec.fields['Name'] || '';
    document.getElementById('mqph3-item-category').value = rec.fields['Category'] || 'material';
    document.getElementById('mqph3-item-rate').value = rec.fields['Rate'] || '';
    document.getElementById('mqph3-item-unit').value = rec.fields['Unit'] || 'per lin ft';
    document.getElementById('mqph3-item-desc').value = rec.fields['Description'] || '';
    document.getElementById('mqph3-item-active').checked = rec.fields['Active'] !== false;
    document.getElementById('mqph3-modal-overlay').classList.add('show');
  };

  window.mqph3CloseModal = function() {
    document.getElementById('mqph3-modal-overlay').classList.remove('show');
  };

  window.mqph3SaveItem = async function() {
    const name = document.getElementById('mqph3-item-name').value.trim();
    const category = document.getElementById('mqph3-item-category').value;
    const rate = parseFloat(document.getElementById('mqph3-item-rate').value || 0);
    const unit = document.getElementById('mqph3-item-unit').value;
    const desc = document.getElementById('mqph3-item-desc').value.trim();
    const active = document.getElementById('mqph3-item-active').checked;

    if (!name) { alert('Please enter a name.'); return; }

    const fields = {
      'Shop': [shopRecord._recordId],
      'Name': name,
      'Category': category,
      'Rate': rate,
      'Unit': unit,
      'Description': desc,
      'Active': active,
      'Sort order': currentEditId ? undefined : (lineItems.length + 1),
    };
    if (!currentEditId) delete fields['Sort order'];

    try {
      if (currentEditId) {
        await atUpdate(LINE_ITEMS_TABLE, currentEditId, fields);
      } else {
        fields['Sort order'] = lineItems.length + 1;
        await atCreate(LINE_ITEMS_TABLE, fields);
      }
      mqph3CloseModal();
      await loadAndRender();
    } catch(e) {
      alert('Error saving item. Please try again.');
    }
  };

  window.mqph3DeleteItem = async function(id) {
    if (!confirm('Delete this pricing item?')) return;
    try {
      await atDelete(LINE_ITEMS_TABLE, id);
      await loadAndRender();
    } catch(e) { alert('Error deleting item.'); }
  };

  window.mqph3ToggleActive = async function(id, toggleEl) {
    const rec = lineItems.find(r => r.id === id);
    if (!rec) return;
    const newVal = !rec.fields['Active'];
    toggleEl.classList.toggle('on', newVal);
    rec.fields['Active'] = newVal;
    await atUpdate(LINE_ITEMS_TABLE, id, { 'Active': newVal });
  };

  // ============================================================
  // COUNTERTOP DIRECT ENTRY
  // ============================================================
  function buildCTHtml(p) {
    const v = (field, def) => p[field] !== undefined ? p[field] : def;
    const row = (id, label, field, def, suffix) => `
      <div class="mqph3-ct-row">
        <span class="mqph3-ct-label">${label}</span>
        <div class="mqph3-ct-input">
          <span>$</span>
          <input type="number" id="mqph3-ct-${id}" value="${v(field, def)}" oninput="mqph3CTChanged()"/>
          <span>${suffix || '/ sqft'}</span>
        </div>
      </div>`;
    return `
      <div id="mqph3-ct-section">
        <div class="mqph3-cat-header">
          <span class="mqph3-cat-title">🪨 Countertop rates (direct entry)</span>
          <button class="mqph3-btn mqph3-btn-primary mqph3-btn-sm" onclick="mqph3SaveCT()">Save countertop rates</button>
        </div>
        <div id="mqph3-ct-msg" class="mqph3-msg"></div>
        ${row('lam', 'Laminate', 'Lam supply', 18, '/ sqft supply')}
        ${row('ss-econ', 'Solid surface — Economy', 'SS econ supply', 38, '/ sqft supply')}
        ${row('ss-mid', 'Solid surface — Mid', 'SS mid supply', 58, '/ sqft supply')}
        ${row('ss-prem', 'Solid surface — Premium', 'SS prem supply', 90, '/ sqft supply')}
        ${row('gran-econ', 'Granite — Economy', 'Gran econ supply', 45, '/ sqft supply')}
        ${row('gran-mid', 'Granite — Mid', 'Gran mid supply', 72, '/ sqft supply')}
        ${row('gran-prem', 'Granite — Premium', 'Gran prem supply', 130, '/ sqft supply')}
        ${row('quartz', 'Engineered quartz', 'Quartz supply', 85, '/ sqft supply')}
        ${row('marble', 'Marble', 'Marble supply', 110, '/ sqft supply')}
        ${row('butcher', 'Butcher block', 'Butcher supply', 42, '/ sqft supply')}
        ${row('backsplash', 'Backsplash rate (material + install)', 'Backsplash rate', 12, '/ lin ft')}
        ${row('sink', 'Sink cutout', 'Sink cutout', 180, 'each')}
        ${row('cooktop', 'Cooktop cutout', 'Cooktop cutout', 220, 'each')}
      </div>`;
  }

  window.mqph3CTChanged = function() {};

  window.mqph3SaveCT = async function() {
    const gn = id => parseFloat(document.getElementById(`mqph3-ct-${id}`)?.value || 0);
    const fields = {
      'Lam supply':        gn('lam'),
      'SS econ supply':    gn('ss-econ'),
      'SS mid supply':     gn('ss-mid'),
      'SS prem supply':    gn('ss-prem'),
      'Gran econ supply':  gn('gran-econ'),
      'Gran mid supply':   gn('gran-mid'),
      'Gran prem supply':  gn('gran-prem'),
      'Quartz supply':     gn('quartz'),
      'Marble supply':     gn('marble'),
      'Butcher supply':    gn('butcher'),
      'Backsplash rate':   gn('backsplash'),
      'Sink cutout':       gn('sink'),
      'Cooktop cutout':    gn('cooktop'),
    };
    try {
      if (pricingRecord) {
        await fetch(`https://api.airtable.com/v0/${shopRecord._baseId}/${shopRecord._pricingTable}/${pricingRecord.id}`, {
          method: 'PATCH', headers: AT_HEADS(),
          body: JSON.stringify({ fields })
        });
      }
      const msg = document.getElementById('mqph3-ct-msg');
      if (msg) { msg.textContent = '✓ Countertop rates saved!'; msg.className = 'mqph3-msg mqph3-msg-success'; msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 3000); }
    } catch(e) {
      const msg = document.getElementById('mqph3-ct-msg');
      if (msg) { msg.textContent = 'Error saving.'; msg.className = 'mqph3-msg mqph3-msg-error'; msg.style.display = 'block'; }
    }
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  async function loadAndRender() {
    const container = document.getElementById('mq-pricing-helper-v2');
    if (!container) return;

    lineItems = await atGet(LINE_ITEMS_TABLE, `{Shop} = "${shopRecord._recordId}"`);
    const hasItems = lineItems.length > 0;

    const p = pricingRecord?.fields || {};

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px">⚙️ Pricing Setup</h2>
          <p style="font-size:13px;color:#6b7280">Manage your rates — changes update your widget immediately.</p>
        </div>
        <button class="mqph3-btn mqph3-btn-secondary" onclick="mqph3RunWizard()">🧙 Re-run setup wizard</button>
      </div>

      <div id="mqph3-msg-global" class="mqph3-msg"></div>

      ${hasItems ? `
        <div class="mqph3-section-header">
          <span class="mqph3-section-title">📋 Your pricing items</span>
          <button class="mqph3-btn mqph3-btn-primary mqph3-btn-sm" onclick="mqph3OpenAdd()">+ Add item</button>
        </div>
        <div id="mqph3-items-section">${buildItemsHTML(lineItems)}</div>
      ` : `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:3rem;text-align:center;margin-bottom:1.5rem">
          <div style="font-size:32px;margin-bottom:12px">⚙️</div>
          <div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px">No pricing set up yet</div>
          <div style="font-size:13px;color:#6b7280;margin-bottom:1.5rem">Run the setup wizard to get started — it takes about 10 minutes.</div>
          <button class="mqph3-btn mqph3-btn-primary" onclick="mqph3RunWizard()">Start setup wizard →</button>
        </div>
      `}

      ${buildCTHtml(p)}

      <!-- MODAL -->
      <div id="mqph3-modal-overlay">
        <div id="mqph3-modal">
          <div class="mh">
            <h3 id="mqph3-modal-title">Add pricing item</h3>
            <button onclick="mqph3CloseModal()">×</button>
          </div>
          <div class="mb">
            <div class="mqph3-field"><label>Name</label><input type="text" id="mqph3-item-name" placeholder="e.g. Maple shaker doors"/></div>
            <div class="mqph3-field"><label>Category</label>
              <select id="mqph3-item-category">
                <option value="material">Material</option>
                <option value="door">Door style</option>
                <option value="hardware">Hardware</option>
                <option value="install">Installation</option>
                <option value="zone">Travel zone</option>
                <option value="tax">Tax</option>
                <option value="countertop">Countertop</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="mqph3-field"><label>Rate ($)</label><input type="number" id="mqph3-item-rate" placeholder="0.00" step="0.01"/></div>
            <div class="mqph3-field"><label>Unit</label>
              <select id="mqph3-item-unit">
                <option value="per lin ft">Per lin ft</option>
                <option value="per lin ft upcharge">Per lin ft upcharge</option>
                <option value="flat">Flat fee</option>
                <option value="each">Each</option>
                <option value="%">%</option>
                <option value="km">km</option>
                <option value="/ sqft">Per sqft</option>
              </select>
            </div>
            <div class="mqph3-field"><label>Description (optional)</label><textarea id="mqph3-item-desc" placeholder="e.g. Soft-close hinge upgrade per linear foot"></textarea></div>
            <div class="mqph3-field" style="flex-direction:row;align-items:center;gap:10px">
              <label style="margin:0">Active</label>
              <input type="checkbox" id="mqph3-item-active" checked style="width:auto"/>
            </div>
            <div style="display:flex;gap:10px;margin-top:1rem">
              <button class="mqph3-btn mqph3-btn-primary" onclick="mqph3SaveItem()" style="flex:1">Save item</button>
              <button class="mqph3-btn mqph3-btn-secondary" onclick="mqph3CloseModal()">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.mqph3RunWizard = function() {
    wizardStep = 0;
    wizardItems = [];
    wizardBaseline = null;
    const container = document.getElementById('mq-pricing-helper-v2');
    if (container) {
      container.innerHTML = buildWizardHTML();
      renderWizardStep(buildWizardSteps(), 0);
    }
  };

  // ============================================================
  // INIT — called by dashboard.js
  // ============================================================
  window.mqph2Init = function(passedShopRecord, passedPricingRecord) {
    if (!passedShopRecord) return;

    shopRecord = {
      ...passedShopRecord,
      _recordId: passedShopRecord.id,
      _baseId: 'app4zrMlVLwF2xn4h',
      _token: 'patulbU1ndSvFpMDo.906a8be9e784fb12de048d4238c5d553859f8d57670ccd1bc1a6de4e2da37325',
      _pricingTable: 'tblu6AYZs8h7SIaQl',
    };
    pricingRecord = passedPricingRecord;

    injectStyles();
    loadAndRender();
  };

})();