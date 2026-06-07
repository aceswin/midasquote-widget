/*
 * MidasQuote Pricing Helper v3.0
 * Wizard-based setup + dynamic line item editor
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
  // STYLES
  // ============================================================
  function injectStyles() {
    if (document.getElementById('mqph3-styles')) return;
    const s = document.createElement('style');
    s.id = 'mqph3-styles';
    s.textContent = `
      #mq-pricing-helper-v2 *{box-sizing:border-box;margin:0;padding:0}
      #mq-pricing-helper-v2{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2rem;max-width:900px}
      #mqph3-wizard{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:1.5rem}
      #mqph3-wizard-header{background:#1a1a1a;color:#fff;padding:1.5rem}
      #mqph3-wizard-header h2{font-size:16px;font-weight:600;margin:0}
      #mqph3-wizard-header p{font-size:13px;opacity:0.7;margin-top:4px}
      #mqph3-progress{display:flex;gap:4px;margin-top:12px}
      #mqph3-progress .step{flex:1;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;transition:background 0.3s}
      #mqph3-progress .step.done{background:#a3e635}
      #mqph3-progress .step.active{background:#fff}
      #mqph3-wizard-body{padding:1.5rem}
      #mqph3-wizard-nav{display:flex;gap:10px;padding:1rem 1.5rem;border-top:1px solid #e5e7eb;background:#f9fafb}
      .mqph3-step{display:none}
      .mqph3-step.active{display:block}
      .mqph3-step-title{font-size:18px;font-weight:700;color:#111;margin-bottom:6px}
      .mqph3-step-sub{font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6}
      .mqph3-highlight{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:1.25rem;font-size:13px;color:#166534;line-height:1.6}
      .mqph3-warn{background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;font-size:13px;color:#854d0e;margin-bottom:1rem}
      .mqph3-input-row{display:flex;align-items:center;gap:10px;margin-bottom:1rem}
      .mqph3-input-row label{font-size:13px;color:#374151;flex:1;font-weight:500}
      .mqph3-input-row input,.mqph3-input-row select{width:200px;font-family:inherit;font-size:13px;color:#111;background:#fff;border:1.5px solid #d1d5db;border-radius:8px;padding:8px 12px}
      .mqph3-input-row input[type=number]{width:130px;text-align:right;font-weight:600}
      .mqph3-input-row input:focus,.mqph3-input-row select:focus{outline:none;border-color:#1a1a1a}
      .mqph3-pfx{font-size:14px;color:#6b7280;font-weight:500}
      .mqph3-result-box{background:#f9fafb;border-radius:8px;padding:1rem;margin-top:0.5rem;margin-bottom:1rem;font-size:13px;color:#374151;line-height:1.8}
      .mqph3-result-val{font-size:20px;font-weight:700;color:#16a34a}
      .mqph3-item-divider{padding-bottom:1.5rem;margin-bottom:1.5rem;border-bottom:1px solid #f3f4f6}
      .mqph3-item-divider:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
      .mqph3-item-label{font-size:13px;font-weight:600;color:#111;margin-bottom:8px}
      .mqph3-btn{padding:10px 20px;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;border:none;font-family:inherit;transition:all 0.15s}
      .mqph3-btn-primary{background:#1a1a1a;color:#fff}
      .mqph3-btn-primary:hover{opacity:0.88}
      .mqph3-btn-secondary{background:#fff;color:#111;border:1px solid #e5e7eb}
      .mqph3-btn-secondary:hover{background:#f9fafb}
      .mqph3-btn-danger{background:#fff;color:#dc2626;border:1px solid #fca5a5}
      .mqph3-btn-danger:hover{background:#fef2f2}
      .mqph3-btn-sm{padding:5px 12px;font-size:12px}
      #mqph3-items-section{margin-top:0}
      .mqph3-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}
      .mqph3-section-title{font-size:14px;font-weight:700;color:#111}
      .mqph3-category-block{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:1.25rem;overflow:hidden}
      .mqph3-cat-header{background:#f9fafb;padding:12px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between}
      .mqph3-cat-title{font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em}
      .mqph3-item-row{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid #f3f4f6}
      .mqph3-item-row:last-child{border-bottom:none}
      .mqph3-item-name{flex:1;font-size:13px;font-weight:500;color:#111}
      .mqph3-item-desc{font-size:11px;color:#9ca3af;margin-top:1px}
      .mqph3-item-rate{font-size:13px;font-weight:600;color:#111;min-width:80px;text-align:right}
      .mqph3-item-unit{font-size:11px;color:#6b7280;min-width:90px;text-align:right}
      .mqph3-toggle{width:32px;height:18px;background:#d1d5db;border-radius:9px;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;display:inline-block}
      .mqph3-toggle.on{background:#16a34a}
      .mqph3-toggle::after{content:'';position:absolute;width:14px;height:14px;background:#fff;border-radius:50%;top:2px;left:2px;transition:left 0.2s}
      .mqph3-toggle.on::after{left:16px}
      .mqph3-empty{text-align:center;padding:2rem;color:#9ca3af;font-size:13px}
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
      #mqph3-ct-section{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:1.25rem;overflow:hidden}
      .mqph3-ct-row{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f3f4f6}
      .mqph3-ct-row:last-child{border-bottom:none}
      .mqph3-ct-label{flex:1;font-size:13px;color:#374151;font-weight:500}
      .mqph3-ct-input{display:flex;align-items:center;gap:6px}
      .mqph3-ct-input span{font-size:13px;color:#6b7280}
      .mqph3-ct-input input{width:90px;text-align:right;font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px}
      .mqph3-ct-input input:focus{outline:none;border-color:#1a1a1a}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // WIZARD STEPS
  // ============================================================
  function buildWizardSteps() {
    const materials  = lineItems.filter(r => r.fields['Category'] === 'material');
    const doorStyles = lineItems.filter(r => r.fields['Category'] === 'door');
    const noMats  = materials.length === 0;
    const noDoors = doorStyles.length === 0;
    const matOpts  = materials.map((m, i)  => `<option value="${i}">${m.fields['Name']}</option>`).join('');
    const doorOpts = doorStyles.map((d, i) => `<option value="${i}">${d.fields['Name']}</option>`).join('');

    return [
      // Step 0: Welcome
      {
        id: 'welcome',
        title: '👋 Welcome to Pricing Setup',
        sub: `We'll walk you through setting up your pricing in about 10 minutes. You'll answer a few questions about your real jobs and we'll reverse-engineer your rates automatically — no math required.`,
        content: () => `
          <div class="mqph3-highlight">💡 <strong>How it works:</strong> We'll ask you to quote a few simple cabinet jobs using your existing quoting software, then calculate your per-linear-foot rates automatically.</div>
          ${noMats || noDoors ? `
            <div class="mqph3-warn">⚠️ <strong>Before running the wizard</strong> you need to add your ${noMats ? 'materials' : ''}${noMats && noDoors ? ' and ' : ''}${noDoors ? 'door styles' : ''} first.<br/>
            Close this wizard, click <strong>"+ Add item"</strong> to add them, then come back.</div>` : `
            <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:#374151">
              <div>✅ Uses your real job prices from your quoting software</div>
              <div>✅ Separate rates for uppers and bases</div>
              <div>✅ Based on your own materials and door styles</div>
              <div>✅ You can re-run anytime</div>
            </div>`}`,
        skipLabel: null,
        nextLabel: noMats || noDoors ? 'Close wizard' : 'Start setup →',
        onNext: () => { if (noMats || noDoors) { loadAndRender(); return 'abort'; } }
      },

      // Step 1: Choose baseline
      {
        id: 'baseline-setup',
        title: '📐 Step 1 of 7 — Choose your baseline',
        sub: 'Pick your most basic and lowest-cost material and door style. Everything else will be calculated as an upcharge on top of this.',
        content: () => `
          <div class="mqph3-highlight">Your baseline should be your <strong>cheapest combination</strong> — the simplest job you quote.</div>
          <div class="mqph3-input-row">
            <label>Baseline material</label>
            <select id="mqph3-baseline-mat-sel">${matOpts}</select>
          </div>
          <div class="mqph3-input-row">
            <label>Baseline door style</label>
            <select id="mqph3-baseline-door-sel">${doorOpts}</select>
          </div>`,
        skipLabel: null,
        nextLabel: 'Next →',
        onNext: () => {
          const mi = parseInt(document.getElementById('mqph3-baseline-mat-sel')?.value || 0);
          const di = parseInt(document.getElementById('mqph3-baseline-door-sel')?.value || 0);
          wizardBaseline = {
            matIndex: mi, matName: materials[mi]?.fields['Name'] || 'Base material',
            doorIndex: di, doorName: doorStyles[di]?.fields['Name'] || 'Base door',
            upperPrice: 0, basePrice: 0, upperRate: 0, baseRate: 0,
          };
        }
      },

      // Step 2: Baseline uppers
      {
        id: 'baseline-uppers',
        title: '📐 Step 2 of 7 — Baseline upper cabinets',
        sub: 'In your quoting software, create a quote for exactly this job:',
        content: () => `
          <div class="mqph3-highlight">
            <strong>Quote this exact job:</strong><br/>
            • <strong>4 linear feet of upper cabinets only</strong> (no bases)<br/>
            • Material: <strong>${wizardBaseline?.matName || '—'}</strong><br/>
            • Door style: <strong>${wizardBaseline?.doorName || '—'}</strong><br/>
            • No hardware upgrades · Supply only · No removal · Local delivery
          </div>
          <div class="mqph3-input-row">
            <label>Your total price for 4ft of uppers?</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-baseline-u-price" placeholder="0.00" step="0.01" oninput="mqph3CalcBaselineU()"/>
          </div>
          <div id="mqph3-baseline-u-result" class="mqph3-result-box" style="display:none"></div>`,
        skipLabel: null,
        nextLabel: 'Next →',
        onNext: () => {
          const price = parseFloat(document.getElementById('mqph3-baseline-u-price')?.value || 0);
          if (price > 0 && wizardBaseline) {
            wizardBaseline.upperPrice = price;
            wizardBaseline.upperRate = price / 4;
            wizardItems.push({
              name: wizardBaseline.matName + ' — uppers',
              category: 'material', rate: Math.round(wizardBaseline.upperRate * 100) / 100,
              unit: 'per lin ft — uppers', description: 'Baseline material uppers — reverse engineered', active: true,
            });
          }
        }
      },

      // Step 3: Baseline bases
      {
        id: 'baseline-bases',
        title: '📐 Step 3 of 7 — Baseline base cabinets',
        sub: 'Same job but bases only. Bases are usually priced higher — more weight, drawers, ladder kicks.',
        content: () => `
          <div class="mqph3-highlight">
            <strong>Quote this exact job:</strong><br/>
            • <strong>4 linear feet of base cabinets only</strong> (no uppers)<br/>
            • Material: <strong>${wizardBaseline?.matName || '—'}</strong><br/>
            • Door style: <strong>${wizardBaseline?.doorName || '—'}</strong><br/>
            • No hardware upgrades · Supply only · No removal · Local delivery
          </div>
          ${wizardBaseline?.upperRate > 0 ? `<div style="font-size:12px;color:#6b7280;margin-bottom:12px">Your upper rate was $${wizardBaseline.upperRate.toFixed(2)}/ft — bases are usually higher.</div>` : ''}
          <div class="mqph3-input-row">
            <label>Your total price for 4ft of bases?</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-baseline-b-price" placeholder="0.00" step="0.01" oninput="mqph3CalcBaselineB()"/>
          </div>
          <div id="mqph3-baseline-b-result" class="mqph3-result-box" style="display:none"></div>`,
        skipLabel: null,
        nextLabel: 'Next →',
        onNext: () => {
          const price = parseFloat(document.getElementById('mqph3-baseline-b-price')?.value || 0);
          if (price > 0 && wizardBaseline) {
            wizardBaseline.basePrice = price;
            wizardBaseline.baseRate = price / 4;
            wizardItems.push({
              name: wizardBaseline.matName + ' — bases',
              category: 'material', rate: Math.round(wizardBaseline.baseRate * 100) / 100,
              unit: 'per lin ft — bases', description: 'Baseline material bases — reverse engineered', active: true,
            });
          }
        }
      },

      // Step 4: Additional materials
      {
        id: 'materials',
        title: '🪵 Step 4 of 7 — Additional material upcharges',
        sub: materials.length > 1
          ? 'Quote the same base cabinet job but swap the material. Use 4ft bases, same door style, supply only.'
          : 'You only have one material set up. Add more in the editor and re-run the wizard anytime.',
        content: () => {
          if (materials.length <= 1) return `<div class="mqph3-highlight">Only one material configured — skip this step. You can add more materials and re-run anytime.</div>`;
          const others = materials.filter((_, i) => i !== wizardBaseline?.matIndex);
          return others.map((m, idx) => `
            <div class="mqph3-item-divider">
              <div class="mqph3-item-label">📦 ${m.fields['Name']}</div>
              <div class="mqph3-highlight" style="margin-bottom:10px">4ft base cabinets · <strong>${m.fields['Name']}</strong> · ${wizardBaseline?.doorName} · supply only</div>
              <div class="mqph3-input-row">
                <label>Your price for this job?</label>
                <span class="mqph3-pfx">$</span>
                <input type="number" id="mqph3-mat-${idx}-price" placeholder="0.00" step="0.01" oninput="mqph3CalcMatUpcharge(${idx})"/>
              </div>
              <div id="mqph3-mat-${idx}-result" class="mqph3-result-box" style="display:none"></div>
            </div>`).join('');
        },
        skipLabel: materials.length <= 1 ? null : 'Skip — same price for all materials',
        nextLabel: 'Next →',
        onNext: () => {
          const others = materials.filter((_, i) => i !== wizardBaseline?.matIndex);
          others.forEach((m, idx) => {
            const price = parseFloat(document.getElementById(`mqph3-mat-${idx}-price`)?.value || 0);
            if (price > 0 && wizardBaseline) {
              const upcharge = (price - wizardBaseline.basePrice) / 4;
              wizardItems.push({ name: m.fields['Name'], category: 'material', rate: Math.round(upcharge * 100) / 100, unit: 'per lin ft upcharge vs baseline', description: 'Material upcharge — reverse engineered', active: true });
            }
          });
        }
      },

      // Step 5: Door style upcharges
      {
        id: 'doors',
        title: '🚪 Step 5 of 7 — Door style upcharges',
        sub: doorStyles.length > 1
          ? 'Same baseline job but swap the door style. Use baseline material, 4ft bases, supply only.'
          : 'You only have one door style set up. Add more in the editor and re-run the wizard anytime.',
        content: () => {
          if (doorStyles.length <= 1) return `<div class="mqph3-highlight">Only one door style configured — skip this step. You can add more and re-run anytime.</div>`;
          const others = doorStyles.filter((_, i) => i !== wizardBaseline?.doorIndex);
          return others.map((d, idx) => `
            <div class="mqph3-item-divider">
              <div class="mqph3-item-label">🚪 ${d.fields['Name']}</div>
              <div class="mqph3-highlight" style="margin-bottom:10px">4ft base cabinets · ${wizardBaseline?.matName} · <strong>${d.fields['Name']}</strong> · supply only</div>
              <div class="mqph3-input-row">
                <label>Your price for this job?</label>
                <span class="mqph3-pfx">$</span>
                <input type="number" id="mqph3-door-${idx}-price" placeholder="0.00" step="0.01" oninput="mqph3CalcDoorUpcharge(${idx})"/>
              </div>
              <div id="mqph3-door-${idx}-result" class="mqph3-result-box" style="display:none"></div>
            </div>`).join('');
        },
        skipLabel: doorStyles.length <= 1 ? null : 'Skip — same price for all door styles',
        nextLabel: 'Next →',
        onNext: () => {
          const others = doorStyles.filter((_, i) => i !== wizardBaseline?.doorIndex);
          others.forEach((d, idx) => {
            const price = parseFloat(document.getElementById(`mqph3-door-${idx}-price`)?.value || 0);
            if (price > 0 && wizardBaseline) {
              const upcharge = (price - wizardBaseline.basePrice) / 4;
              wizardItems.push({ name: d.fields['Name'], category: 'door', rate: Math.round(upcharge * 100) / 100, unit: 'per lin ft upcharge', description: 'Door style upcharge — reverse engineered', active: true });
            }
          });
        }
      },

      // Step 6: Hardware
      {
        id: 'hardware',
        title: '⚙️ Step 6 of 7 — Hardware upgrades',
        sub: 'Quote the baseline job with each hardware upgrade added one at a time.',
        content: () => {
          const hwItems = lineItems.filter(r => r.fields['Category'] === 'hardware');
          if (!hwItems.length) return `<div class="mqph3-highlight">No hardware items set up yet. Add them in the editor and re-run the wizard anytime.</div>`;
          return hwItems.map((h, idx) => `
            <div class="mqph3-item-divider">
              <div class="mqph3-item-label">⚙️ ${h.fields['Name']}</div>
              <div class="mqph3-highlight" style="margin-bottom:10px">Same baseline job + <strong>${h.fields['Name']}</strong> added</div>
              <div class="mqph3-input-row">
                <label>Your price with this upgrade?</label>
                <span class="mqph3-pfx">$</span>
                <input type="number" id="mqph3-hw-${idx}-price" placeholder="0.00" step="0.01" oninput="mqph3CalcHWUpcharge(${idx})"/>
              </div>
              <div id="mqph3-hw-${idx}-result" class="mqph3-result-box" style="display:none"></div>
            </div>`).join('');
        },
        skipLabel: 'Skip hardware',
        nextLabel: 'Next →',
        onNext: () => {
          const hwItems = lineItems.filter(r => r.fields['Category'] === 'hardware');
          hwItems.forEach((h, idx) => {
            const price = parseFloat(document.getElementById(`mqph3-hw-${idx}-price`)?.value || 0);
            if (price > 0 && wizardBaseline) {
              const upcharge = (price - wizardBaseline.basePrice) / 4;
              wizardItems.push({ name: h.fields['Name'], category: 'hardware', rate: Math.round(upcharge * 100) / 100, unit: 'per lin ft upcharge', description: 'Hardware upgrade — reverse engineered', active: true });
            }
          });
        }
      },

      // Step 7: Install + other
      {
        id: 'install',
        title: '🔧 Step 7 of 7 — Installation & other rates',
        sub: 'Quote install-only prices — no supply, just labour.',
        content: () => `
          <div class="mqph3-highlight">
            <strong>Install only (no supply):</strong><br/>
            • 4 linear feet of upper cabinets — what do you charge to install only?<br/>
            • 4 linear feet of base cabinets — what do you charge to install only?
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
          <div id="mqph3-install-result" class="mqph3-result-box" style="display:none"></div>
          <div style="height:1px;background:#e5e7eb;margin:1.25rem 0"></div>
          <div class="mqph3-input-row">
            <label>Cabinet removal & disposal (per lin ft)</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-removal" placeholder="0.00" step="0.01"/>
          </div>
          <div class="mqph3-input-row">
            <label>Local zone radius</label>
            <input type="number" id="mqph3-zone-radius" placeholder="15" style="width:130px;text-align:right"/>
            <span class="mqph3-pfx">km</span>
          </div>
          <div class="mqph3-input-row">
            <label>Zone 2 travel surcharge (flat)</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-zone2" placeholder="0.00"/>
          </div>
          <div class="mqph3-input-row">
            <label>Zone 3 travel surcharge (flat)</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-zone3" placeholder="0.00"/>
          </div>
          <div class="mqph3-input-row">
            <label>Zone 4 travel surcharge (flat)</label>
            <span class="mqph3-pfx">$</span>
            <input type="number" id="mqph3-zone4" placeholder="0.00"/>
          </div>
          <div class="mqph3-input-row">
            <label>Tax rate</label>
            <input type="number" id="mqph3-tax" placeholder="5" style="width:130px;text-align:right"/>
            <span class="mqph3-pfx">%</span>
          </div>`,
        skipLabel: 'Skip — supply only shop',
        nextLabel: 'Finish setup →',
        onNext: () => {
          const up = parseFloat(document.getElementById('mqph3-install-u')?.value || 0);
          const bp = parseFloat(document.getElementById('mqph3-install-b')?.value || 0);
          const removal = parseFloat(document.getElementById('mqph3-removal')?.value || 0);
          const zr = parseFloat(document.getElementById('mqph3-zone-radius')?.value || 0);
          const z2 = parseFloat(document.getElementById('mqph3-zone2')?.value || 0);
          const z3 = parseFloat(document.getElementById('mqph3-zone3')?.value || 0);
          const z4 = parseFloat(document.getElementById('mqph3-zone4')?.value || 0);
          const tax = parseFloat(document.getElementById('mqph3-tax')?.value || 0);
          if (up > 0) wizardItems.push({ name: 'Install — uppers', category: 'install', rate: Math.round((up/4)*100)/100, unit: 'per lin ft', description: 'Upper cabinet installation rate', active: true });
          if (bp > 0) wizardItems.push({ name: 'Install — bases', category: 'install', rate: Math.round((bp/4)*100)/100, unit: 'per lin ft', description: 'Base cabinet installation rate', active: true });
          if (removal > 0) wizardItems.push({ name: 'Cabinet removal', category: 'other', rate: removal, unit: 'per lin ft', description: 'Remove & dispose existing cabinets', active: true });
          if (zr > 0) wizardItems.push({ name: 'Local zone radius', category: 'zone', rate: zr, unit: 'km', description: 'Jobs within this distance = no travel surcharge', active: true });
          if (z2 > 0) wizardItems.push({ name: 'Zone 2 surcharge', category: 'zone', rate: z2, unit: 'flat', description: 'Travel surcharge for zone 2 jobs', active: true });
          if (z3 > 0) wizardItems.push({ name: 'Zone 3 surcharge', category: 'zone', rate: z3, unit: 'flat', description: 'Travel surcharge for zone 3 jobs', active: true });
          if (z4 > 0) wizardItems.push({ name: 'Zone 4 surcharge', category: 'zone', rate: z4, unit: 'flat', description: 'Travel surcharge for zone 4 jobs', active: true });
          if (tax > 0) wizardItems.push({ name: 'Tax rate', category: 'tax', rate: tax, unit: '%', description: 'Applied to cabinet subtotal', active: true });
        }
      },
    ];
  }

  // ============================================================
  // WIZARD CALCULATIONS
  // ============================================================
  window.mqph3CalcBaselineU = function() {
    const price = parseFloat(document.getElementById('mqph3-baseline-u-price')?.value || 0);
    const res = document.getElementById('mqph3-baseline-u-result');
    if (!res) return;
    if (price > 0) { res.style.display = 'block'; res.innerHTML = `<strong>Upper rate:</strong> <span class="mqph3-result-val">$${(price/4).toFixed(2)} / lin ft</span>`; }
    else res.style.display = 'none';
  };

  window.mqph3CalcBaselineB = function() {
    const price = parseFloat(document.getElementById('mqph3-baseline-b-price')?.value || 0);
    const res = document.getElementById('mqph3-baseline-b-result');
    if (!res) return;
    if (price > 0) { res.style.display = 'block'; res.innerHTML = `<strong>Base rate:</strong> <span class="mqph3-result-val">$${(price/4).toFixed(2)} / lin ft</span>`; }
    else res.style.display = 'none';
  };

  window.mqph3CalcMatUpcharge = function(idx) {
    const price = parseFloat(document.getElementById(`mqph3-mat-${idx}-price`)?.value || 0);
    const res = document.getElementById(`mqph3-mat-${idx}-result`);
    if (!res || !wizardBaseline) return;
    if (price > 0) { const u = (price - wizardBaseline.basePrice) / 4; res.style.display = 'block'; res.innerHTML = `<strong>Upcharge vs baseline:</strong> <span class="mqph3-result-val">$${u.toFixed(2)} / lin ft</span>`; }
    else res.style.display = 'none';
  };

  window.mqph3CalcDoorUpcharge = function(idx) {
    const price = parseFloat(document.getElementById(`mqph3-door-${idx}-price`)?.value || 0);
    const res = document.getElementById(`mqph3-door-${idx}-result`);
    if (!res || !wizardBaseline) return;
    if (price > 0) { const u = (price - wizardBaseline.basePrice) / 4; res.style.display = 'block'; res.innerHTML = `<strong>Door upcharge:</strong> <span class="mqph3-result-val">$${u.toFixed(2)} / lin ft</span>`; }
    else res.style.display = 'none';
  };

  window.mqph3CalcHWUpcharge = function(idx) {
    const price = parseFloat(document.getElementById(`mqph3-hw-${idx}-price`)?.value || 0);
    const res = document.getElementById(`mqph3-hw-${idx}-result`);
    if (!res || !wizardBaseline) return;
    if (price > 0) { const u = (price - wizardBaseline.basePrice) / 4; res.style.display = 'block'; res.innerHTML = `<strong>Hardware upcharge:</strong> <span class="mqph3-result-val">$${u.toFixed(2)} / lin ft</span>`; }
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
    if (html) { res.style.display = 'block'; res.innerHTML = html; } else res.style.display = 'none';
  };

  // ============================================================
  // WIZARD NAVIGATION
  // ============================================================
  function renderWizardStep(steps, idx) {
    steps.forEach((s, i) => {
      const el = document.getElementById(`mqph3-step-${i}`);
      if (el) el.classList.toggle('active', i === idx);
    });
    const dots = document.querySelectorAll('#mqph3-progress .step');
    dots.forEach((d, i) => { d.classList.remove('done','active'); if (i < idx) d.classList.add('done'); else if (i === idx) d.classList.add('active'); });
    const backBtn = document.getElementById('mqph3-back-btn');
    const nextBtn = document.getElementById('mqph3-next-btn');
    const skipBtn = document.getElementById('mqph3-skip-btn');
    if (backBtn) backBtn.style.display = idx === 0 ? 'none' : 'inline-block';
    if (nextBtn) nextBtn.textContent = steps[idx].nextLabel || 'Next →';
    if (skipBtn) { skipBtn.style.display = steps[idx].skipLabel ? 'inline-block' : 'none'; if (steps[idx].skipLabel) skipBtn.textContent = steps[idx].skipLabel; }
  }

  window.mqph3Next = function() {
    const steps = buildWizardSteps();
    const result = steps[wizardStep].onNext ? steps[wizardStep].onNext() : null;
    if (result === 'abort') return;
    wizardStep++;
    if (wizardStep >= steps.length) { mqph3FinishWizard(); } else { renderWizardStep(steps, wizardStep); }
  };

  window.mqph3Back = function() {
    if (wizardStep > 0) { wizardStep--; renderWizardStep(buildWizardSteps(), wizardStep); }
  };

  window.mqph3SkipStep = function() {
    wizardStep++;
    const steps = buildWizardSteps();
    if (wizardStep >= steps.length) { mqph3FinishWizard(); } else { renderWizardStep(steps, wizardStep); }
  };

  async function mqph3FinishWizard() {
    const container = document.getElementById('mq-pricing-helper-v2');
    if (!container) return;
    container.innerHTML = '<div style="padding:3rem;text-align:center;color:#6b7280;font-size:14px">Saving your pricing setup...</div>';
    const existing = await atGet(LINE_ITEMS_TABLE, `{Shop} = "${shopRecord._recordId}"`);
    for (const r of existing) { await atDelete(LINE_ITEMS_TABLE, r.id); }
    for (let i = 0; i < wizardItems.length; i++) {
      const item = wizardItems[i];
      await atCreate(LINE_ITEMS_TABLE, {
        'Shop': [shopRecord._recordId], 'Name': item.name, 'Category': item.category,
        'Rate': item.rate, 'Unit': item.unit, 'Description': item.description || '',
        'Active': item.active !== false, 'Sort order': i + 1,
      });
    }
    await loadAndRender();
  }

  // ============================================================
  // BUILD WIZARD HTML
  // ============================================================
  function buildWizardHTML() {
    const steps = buildWizardSteps();
    const progressDots = steps.map(() => `<div class="step"></div>`).join('');
    const stepDivs = steps.map((s, i) => `
      <div class="mqph3-step ${i === 0 ? 'active' : ''}" id="mqph3-step-${i}">
        <div class="mqph3-step-title">${s.title}</div>
        <div class="mqph3-step-sub">${s.sub}</div>
        ${s.content()}
      </div>`).join('');
    return `
      <div id="mqph3-wizard">
        <div id="mqph3-wizard-header">
          <h2>⚙️ Pricing Setup Wizard</h2>
          <p>Add your materials and door styles first, then run this wizard</p>
          <div id="mqph3-progress">${progressDots}</div>
        </div>
        <div id="mqph3-wizard-body">${stepDivs}</div>
        <div id="mqph3-wizard-nav">
          <button class="mqph3-btn mqph3-btn-secondary" id="mqph3-back-btn" onclick="mqph3Back()" style="display:none">← Back</button>
          <button class="mqph3-btn mqph3-btn-secondary" id="mqph3-skip-btn" onclick="mqph3SkipStep()" style="display:none">Skip</button>
          <button class="mqph3-btn mqph3-btn-primary" id="mqph3-next-btn" onclick="mqph3Next()" style="margin-left:auto">Start setup →</button>
        </div>
      </div>`;
  }

  // ============================================================
  // ITEM EDITOR
  // ============================================================
  const CATEGORY_LABELS = {
    material: '🪵 Cabinet materials', door: '🚪 Door styles', hardware: '⚙️ Hardware upgrades',
    install: '🔧 Installation', zone: '🚗 Travel zones', tax: '🧾 Tax & other',
    countertop: '🪨 Countertops', other: '📋 Other',
  };

  function buildItemsHTML(items) {
    if (!items.length) return `<div class="mqph3-empty">No pricing items yet. Run the setup wizard or add items manually.</div>`;
    const groups = {};
    items.forEach(r => { const cat = r.fields['Category'] || 'other'; if (!groups[cat]) groups[cat] = []; groups[cat].push(r); });
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
            <div style="width:36px;text-align:center"><div class="mqph3-toggle ${r.fields['Active'] ? 'on' : ''}" onclick="mqph3ToggleActive('${r.id}', this)"></div></div>
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

  window.mqph3CloseModal = function() { document.getElementById('mqph3-modal-overlay').classList.remove('show'); };

  window.mqph3SaveItem = async function() {
    const name = document.getElementById('mqph3-item-name').value.trim();
    const category = document.getElementById('mqph3-item-category').value;
    const rate = parseFloat(document.getElementById('mqph3-item-rate').value || 0);
    const unit = document.getElementById('mqph3-item-unit').value;
    const desc = document.getElementById('mqph3-item-desc').value.trim();
    const active = document.getElementById('mqph3-item-active').checked;
    if (!name) { alert('Please enter a name.'); return; }
    const fields = { 'Shop': [shopRecord._recordId], 'Name': name, 'Category': category, 'Rate': rate, 'Unit': unit, 'Description': desc, 'Active': active };
    try {
      if (currentEditId) { await atUpdate(LINE_ITEMS_TABLE, currentEditId, fields); }
      else { fields['Sort order'] = lineItems.length + 1; await atCreate(LINE_ITEMS_TABLE, fields); }
      mqph3CloseModal();
      await loadAndRender();
    } catch(e) { alert('Error saving item. Please try again.'); }
  };

  window.mqph3DeleteItem = async function(id) {
    if (!confirm('Delete this pricing item?')) return;
    try { await atDelete(LINE_ITEMS_TABLE, id); await loadAndRender(); } catch(e) { alert('Error deleting item.'); }
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
        <div class="mqph3-ct-input"><span>$</span><input type="number" id="mqph3-ct-${id}" value="${v(field, def)}"/><span>${suffix || '/ sqft'}</span></div>
      </div>`;
    return `
      <div id="mqph3-ct-section">
        <div class="mqph3-cat-header">
          <span class="mqph3-cat-title">🪨 Countertop rates (direct entry)</span>
          <button class="mqph3-btn mqph3-btn-primary mqph3-btn-sm" onclick="mqph3SaveCT()">Save countertop rates</button>
        </div>
        <div id="mqph3-ct-msg" class="mqph3-msg"></div>
        ${row('lam', 'Laminate', 'Lam supply', 18, '/ sqft')}
        ${row('ss-econ', 'Solid surface — Economy', 'SS econ supply', 38, '/ sqft')}
        ${row('ss-mid', 'Solid surface — Mid', 'SS mid supply', 58, '/ sqft')}
        ${row('ss-prem', 'Solid surface — Premium', 'SS prem supply', 90, '/ sqft')}
        ${row('gran-econ', 'Granite — Economy', 'Gran econ supply', 45, '/ sqft')}
        ${row('gran-mid', 'Granite — Mid', 'Gran mid supply', 72, '/ sqft')}
        ${row('gran-prem', 'Granite — Premium', 'Gran prem supply', 130, '/ sqft')}
        ${row('quartz', 'Engineered quartz', 'Quartz supply', 85, '/ sqft')}
        ${row('marble', 'Marble', 'Marble supply', 110, '/ sqft')}
        ${row('butcher', 'Butcher block', 'Butcher supply', 42, '/ sqft')}
        ${row('backsplash', 'Backsplash (material + install)', 'Backsplash rate', 12, '/ lin ft')}
        ${row('sink', 'Sink cutout', 'Sink cutout', 180, 'each')}
        ${row('cooktop', 'Cooktop cutout', 'Cooktop cutout', 220, 'each')}
      </div>`;
  }

  window.mqph3SaveCT = async function() {
    const gn = id => parseFloat(document.getElementById(`mqph3-ct-${id}`)?.value || 0);
    const fields = {
      'Lam supply': gn('lam'), 'SS econ supply': gn('ss-econ'), 'SS mid supply': gn('ss-mid'),
      'SS prem supply': gn('ss-prem'), 'Gran econ supply': gn('gran-econ'), 'Gran mid supply': gn('gran-mid'),
      'Gran prem supply': gn('gran-prem'), 'Quartz supply': gn('quartz'), 'Marble supply': gn('marble'),
      'Butcher supply': gn('butcher'), 'Backsplash rate': gn('backsplash'), 'Sink cutout': gn('sink'), 'Cooktop cutout': gn('cooktop'),
    };
    try {
      if (pricingRecord) {
        await fetch(`${AT_BASE_URL()}/${shopRecord._pricingTable}/${pricingRecord.id}`, {
          method: 'PATCH', headers: AT_HEADS(), body: JSON.stringify({ fields })
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
        <button class="mqph3-btn mqph3-btn-secondary" onclick="mqph3RunWizard()">🧙 Run setup wizard</button>
      </div>

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
          <div style="font-size:13px;color:#6b7280;margin-bottom:1rem">Start by adding your materials and door styles, then run the setup wizard.</div>
          <div style="display:flex;gap:10px;justify-content:center">
            <button class="mqph3-btn mqph3-btn-secondary" onclick="mqph3OpenAdd('material')">+ Add material</button>
            <button class="mqph3-btn mqph3-btn-secondary" onclick="mqph3OpenAdd('door')">+ Add door style</button>
            <button class="mqph3-btn mqph3-btn-primary" onclick="mqph3RunWizard()">Run wizard →</button>
          </div>
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
                <option value="per lin ft — uppers">Per lin ft — uppers</option>
                <option value="per lin ft — bases">Per lin ft — bases</option>
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
  // INIT
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