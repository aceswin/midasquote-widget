/*
 * MidasQuote Pricing Helper v4.2
 * Updated wizard: 30"+18" spec throughout, box-only baseline, doors as upcharge, hinges restructured
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
    const res = await fetch(`${AT_BASE_URL()}/${table}`, { method: 'POST', headers: AT_HEADS(), body: JSON.stringify({ fields }) });
    return await res.json();
  }
  async function atUpdate(table, id, fields) {
    const res = await fetch(`${AT_BASE_URL()}/${table}/${id}`, { method: 'PATCH', headers: AT_HEADS(), body: JSON.stringify({ fields }) });
    return await res.json();
  }
  async function atDelete(table, id) {
    const res = await fetch(`${AT_BASE_URL()}/${table}/${id}`, { method: 'DELETE', headers: AT_HEADS() });
    return await res.json();
  }

  // ============================================================
  // STYLES
  // ============================================================
  function injectStyles() {
    if (document.getElementById('mqph4-styles')) return;
    const s = document.createElement('style');
    s.id = 'mqph4-styles';
    s.textContent = `
      #mq-pricing-helper-v2 *{box-sizing:border-box;margin:0;padding:0}
      #mq-pricing-helper-v2{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2rem;max-width:900px}
      .mqph-btn{padding:10px 20px;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;border:none;font-family:inherit;transition:all 0.15s}
      .mqph-btn-primary{background:#1a1a1a;color:#fff}.mqph-btn-primary:hover{opacity:0.88}
      .mqph-btn-secondary{background:#fff;color:#111;border:1px solid #e5e7eb}.mqph-btn-secondary:hover{background:#f9fafb}
      .mqph-btn-danger{background:#fff;color:#dc2626;border:1px solid #fca5a5}.mqph-btn-danger:hover{background:#fef2f2}
      .mqph-btn-sm{padding:5px 12px;font-size:12px}

      .mqph-setup-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:1.25rem;overflow:hidden}
      .mqph-setup-header{background:#f9fafb;padding:14px 16px;border-bottom:1px solid #e5e7eb}
      .mqph-setup-title{font-size:13px;font-weight:700;color:#111}
      .mqph-setup-sub{font-size:11px;color:#6b7280;margin-top:2px}
      .mqph-chip-row{display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px;align-items:center}
      .mqph-chip{display:flex;align-items:center;gap:6px;padding:6px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:20px;font-size:13px;color:#111}
      .mqph-chip-del{background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;line-height:1;padding:0 0 0 2px;font-family:inherit}.mqph-chip-del:hover{color:#dc2626}
      .mqph-chip-input{display:flex;align-items:center;gap:6px;padding:4px 8px;border:1.5px dashed #d1d5db;border-radius:20px}
      .mqph-chip-input input{border:none;outline:none;font-size:13px;color:#111;background:transparent;font-family:inherit;width:160px}
      .mqph-chip-input button{background:#1a1a1a;color:#fff;border:none;border-radius:12px;padding:3px 10px;font-size:12px;cursor:pointer;font-family:inherit}
      .mqph-default-chip{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}

      .mqph-wizard-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:1.5rem}
      .mqph-wizard-header{background:#1a1a1a;color:#fff;padding:1.25rem 1.5rem}
      .mqph-wizard-header h2{font-size:15px;font-weight:600;margin:0 0 4px}
      .mqph-wizard-header p{font-size:12px;opacity:0.65}
      .mqph-progress{display:flex;gap:4px;margin-top:10px}
      .mqph-progress .dot{flex:1;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;transition:background 0.3s}
      .mqph-progress .dot.done{background:#a3e635}
      .mqph-progress .dot.active{background:#fff}
      .mqph-wizard-body{padding:1.5rem}
      .mqph-wizard-nav{display:flex;gap:10px;padding:1rem 1.5rem;border-top:1px solid #e5e7eb;background:#f9fafb;align-items:center}
      .mqph-step{display:none}.mqph-step.active{display:block}
      .mqph-step-title{font-size:17px;font-weight:700;color:#111;margin-bottom:6px}
      .mqph-step-sub{font-size:13px;color:#6b7280;margin-bottom:1.25rem;line-height:1.6}
      .mqph-hl{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:1.25rem;font-size:13px;color:#166534;line-height:1.7}
      .mqph-warn{background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;font-size:13px;color:#854d0e;margin-bottom:1rem;line-height:1.6}
      .mqph-spec-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:1.25rem;font-size:13px;color:#374151;line-height:1.8}
      .mqph-spec-box strong{color:#111}
      .mqph-spec-box .mqph-spec-tag{display:inline-block;background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600;color:#374151;margin:2px 3px 2px 0}
      .mqph-input-row{display:flex;align-items:center;gap:10px;margin-bottom:1rem}
      .mqph-input-row label{font-size:13px;color:#374151;flex:1;font-weight:500}
      .mqph-input-row input[type=number]{width:130px;text-align:right;font-weight:600;font-family:inherit;font-size:13px;color:#111;background:#fff;border:1.5px solid #d1d5db;border-radius:8px;padding:8px 12px}
      .mqph-input-row input:focus{outline:none;border-color:#1a1a1a}
      .mqph-pfx{font-size:14px;color:#6b7280}
      .mqph-result{background:#f9fafb;border-radius:8px;padding:10px 14px;margin-top:6px;margin-bottom:1rem;font-size:13px;display:none}
      .mqph-result-val{font-size:18px;font-weight:700;color:#16a34a}
      .mqph-item-block{padding-bottom:1.25rem;margin-bottom:1.25rem;border-bottom:1px solid #f3f4f6}
      .mqph-item-block:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
      .mqph-item-block-label{font-size:13px;font-weight:600;color:#111;margin-bottom:8px}

      .mqph-cat-block{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:1.25rem;overflow:hidden}
      .mqph-cat-header{background:#f9fafb;padding:12px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between}
      .mqph-cat-title{font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em}
      .mqph-row{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid #f3f4f6}
      .mqph-row:last-child{border-bottom:none}
      .mqph-row-name{flex:1;font-size:13px;font-weight:500;color:#111}
      .mqph-row-desc{font-size:11px;color:#9ca3af;margin-top:1px}
      .mqph-row-rate{font-size:13px;font-weight:600;color:#111;min-width:80px;text-align:right}
      .mqph-row-unit{font-size:11px;color:#6b7280;min-width:100px;text-align:right}
      .mqph-toggle{width:32px;height:18px;background:#d1d5db;border-radius:9px;position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;display:inline-block}
      .mqph-toggle.on{background:#16a34a}
      .mqph-toggle::after{content:'';position:absolute;width:14px;height:14px;background:#fff;border-radius:50%;top:2px;left:2px;transition:left 0.2s}
      .mqph-toggle.on::after{left:16px}

      .mqph-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;padding:1rem}
      .mqph-overlay.show{display:flex}
      .mqph-modal{background:#fff;border-radius:12px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
      .mqph-modal .mh{padding:1.25rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between}
      .mqph-modal .mh h3{font-size:15px;font-weight:600;color:#111}
      .mqph-modal .mh button{background:none;border:none;font-size:20px;color:#6b7280;cursor:pointer;line-height:1}
      .mqph-modal .mb{padding:1.25rem}
      .mqph-field{display:flex;flex-direction:column;gap:5px;margin-bottom:1rem}
      .mqph-field label{font-size:12px;font-weight:600;color:#374151}
      .mqph-field input,.mqph-field select,.mqph-field textarea{font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;width:100%}
      .mqph-field input:focus,.mqph-field select:focus{outline:none;border-color:#1a1a1a}
      .mqph-field textarea{resize:vertical;min-height:60px}
      .mqph-msg{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:1rem;display:none}
      .mqph-msg-success{background:#dcfce7;color:#166534;border:1px solid #86efac}
      .mqph-msg-error{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}

      .mqph-ct-block{background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:1.25rem;overflow:hidden}
      .mqph-ct-row{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f3f4f6}
      .mqph-ct-row:last-child{border-bottom:none}
      .mqph-ct-label{flex:1;font-size:13px;color:#374151;font-weight:500}
      .mqph-ct-inp{display:flex;align-items:center;gap:6px}
      .mqph-ct-inp span{font-size:13px;color:#6b7280}
      .mqph-ct-inp input{width:90px;text-align:right;font-family:inherit;font-size:13px;color:#111;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px}
      .mqph-ct-inp input:focus{outline:none;border-color:#1a1a1a}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // CATEGORY CONFIG
  // ============================================================
  const CATEGORIES = [
    { id: 'material',  label: '🪵 Box materials',       sub: 'The material used to build the cabinet boxes', placeholder: 'e.g. White melamine' },
    { id: 'door',      label: '🚪 Door styles',          sub: 'Door styles you offer (doors are priced as an upcharge on top of the box)', placeholder: 'e.g. Maple shaker' },
    { id: 'drawerbox', label: '📦 Drawer box materials', sub: 'Materials used for drawer boxes', placeholder: 'e.g. Prefinished birch' },
    { id: 'slide',     label: '🔩 Drawer slides',        sub: 'Slide options you offer', placeholder: 'e.g. Undermount soft-close' },
    { id: 'hinge',     label: '🔧 Door hinges',          sub: 'Hinge options you offer — your cheapest hinge is the baseline, others become upcharges', placeholder: 'e.g. Concealed hinge' },
    { id: 'finish',    label: '🎨 Finishes',             sub: 'Finish options available', placeholder: 'e.g. Painted' },
  ];

  const CAT_LABELS = {
    material: '🪵 Box materials', door: '🚪 Door styles', drawerbox: '📦 Drawer box materials',
    slide: '🔩 Drawer slides', hinge: '🔧 Door hinges', finish: '🎨 Finishes',
    install: '🔧 Installation & removal', zone: '🚗 Travel zones', tax: '🧾 Tax & other',
    countertop: '🪨 Countertops', other: '📋 Other',
  };

  const DEFAULT_INSTALL = [
    { name: 'Install — uppers',   unit: 'per lin ft', description: 'Upper cabinet installation rate — set in wizard' },
    { name: 'Install — bases',    unit: 'per lin ft', description: 'Base cabinet installation rate — set in wizard' },
    { name: 'Cabinet removal',    unit: 'per lin ft', description: 'Remove & dispose existing cabinets — set in wizard' },
  ];

  const DEFAULT_HINGES = ['Soft-close hinges', 'Regular hinges'];

  // Standard spec used throughout entire wizard
  const WIZARD_SPEC = '1 × 30" cabinet + 1 × 18" cabinet = 4 linear feet';
  const WIZARD_SPEC_DOORS = '3 doors total: 2 on the 30", 1 on the 18"';

  // ============================================================
  // ITEM SETUP
  // ============================================================
  function buildItemSetupHTML() {
    const existing = {};
    lineItems.filter(r => r.fields).forEach(r => {
      const cat = r.fields['Category'];
      if (!existing[cat]) existing[cat] = [];
      existing[cat].push(r);
    });

    return `
      <div style="margin-bottom:1.5rem">
        <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:6px">🛠️ Set Up Your Shop Items</h2>
        <p style="font-size:13px;color:#6b7280;line-height:1.6">Add the materials, door styles, and options your shop offers. Just names for now — we'll figure out pricing in the wizard.</p>
      </div>

      ${CATEGORIES.map(cat => {
        const items = (existing[cat.id] || []).sort((a,b) => (a.fields['Sort order']||0)-(b.fields['Sort order']||0));
        return `
          <div class="mqph-setup-card">
            <div class="mqph-setup-header">
              <div class="mqph-setup-title">${cat.label}</div>
              <div class="mqph-setup-sub">${cat.sub}</div>
            </div>
            <div class="mqph-chip-row" id="mqph-chips-${cat.id}">
              ${items.map(r => `
                <div class="mqph-chip" id="mqph-chip-${r.id}">
                  ${r.fields['Name']}
                  <button class="mqph-chip-del" onclick="mqphDeleteChip('${r.id}','${cat.id}')">×</button>
                </div>`).join('')}
              <div class="mqph-chip-input">
                <input type="text" id="mqph-chip-input-${cat.id}" placeholder="${cat.placeholder}" onkeydown="if(event.key==='Enter')mqphAddChip('${cat.id}')"/>
                <button onclick="mqphAddChip('${cat.id}')">Add</button>
              </div>
            </div>
          </div>`;
      }).join('')}

      <div class="mqph-setup-card">
        <div class="mqph-setup-header">
          <div class="mqph-setup-title">🔧 Installation & removal</div>
          <div class="mqph-setup-sub">Pre-added for you — rates are calculated in the wizard. Delete any you don't offer. If you only do supply, delete all three.</div>
        </div>
        <div class="mqph-chip-row" id="mqph-chips-install">
          ${(existing['install'] || []).map(r => `
            <div class="mqph-chip mqph-default-chip" id="mqph-chip-${r.id}">
              ${r.fields['Name']}<button class="mqph-chip-del" onclick="mqphDeleteChip('${r.id}','install')">×</button>
            </div>`).join('')}
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:0.5rem">
        <button class="mqph-btn mqph-btn-secondary" onclick="loadAndRender()">Back to editor</button>
        <button class="mqph-btn mqph-btn-primary" onclick="mqphGoToWizard()">Items look good — run pricing wizard →</button>
      </div>
    `;
  }

  window.mqphAddChip = async function(cat) {
    const input = document.getElementById(`mqph-chip-input-${cat}`);
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    input.value = '';
    const sortMax = lineItems.filter(r => r.fields && r.fields['Category'] === cat).length + 1;
    const rec = await atCreate(LINE_ITEMS_TABLE, {
      'shop': [shopRecord._recordId], 'Name': name, 'Category': cat,
      'Rate': 0, 'Unit': 'per lin ft', 'Active': true, 'Sort order': sortMax,
    });
    if (rec && rec.id) {
      lineItems.push(rec);
      const container = document.getElementById(`mqph-chips-${cat}`);
      if (container) {
        const chip = document.createElement('div');
        chip.className = 'mqph-chip';
        chip.id = `mqph-chip-${rec.id}`;
        chip.innerHTML = `${name}<button class="mqph-chip-del" onclick="mqphDeleteChip('${rec.id}','${cat}')">×</button>`;
        const inputWrap = container.querySelector('.mqph-chip-input');
        container.insertBefore(chip, inputWrap);
      }
    }
  };

  window.mqphDeleteChip = async function(id, cat) {
    if (!confirm('Remove this item?')) return;
    await atDelete(LINE_ITEMS_TABLE, id);
    lineItems = lineItems.filter(r => r.id !== id);
    const chip = document.getElementById(`mqph-chip-${id}`);
    if (chip) chip.remove();
  };

  window.mqphGoToWizard = function() {
    wizardStep = 0;
    wizardItems = [];
    wizardBaseline = null;
    const container = document.getElementById('mq-pricing-helper-v2');
    if (container) {
      container.innerHTML = buildWizardHTML();
      renderWizardStep(0);
    }
  };

  // ============================================================
  // WIZARD SPEC BOX HELPER
  // ============================================================
  function specBox(lines) {
    return `<div class="mqph-spec-box">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
  }

  // ============================================================
  // WIZARD STEPS
  // ============================================================
  function getByCategory(cat) {
    return lineItems.filter(r => r.fields && r.fields['Category'] === cat && r.fields['Active'] !== false)
      .sort((a,b) => (a.fields['Sort order']||0)-(b.fields['Sort order']||0));
  }

  function buildWizardSteps() {
    const materials  = getByCategory('material');
    const doorStyles = getByCategory('door');
    const hinges     = getByCategory('hinge');
    const noMats  = materials.length === 0;
    const noDoors = doorStyles.length === 0;
    const matOpts  = materials.map((m,i)  => `<option value="${i}">${m.fields['Name']}</option>`).join('');
    const doorOpts = doorStyles.map((d,i) => `<option value="${i}">${d.fields['Name']}</option>`).join('');

    const steps = [];

    // Step 0: Welcome
    steps.push({
      title: '👋 Pricing Setup Wizard',
      sub: `We'll reverse-engineer your rates from real job quotes using a consistent spec throughout — no math required.`,
      content: () => noMats || noDoors ? `
        <div class="mqph-warn">⚠️ <strong>Missing items.</strong> You need to add ${noMats?'box materials':''}${noMats&&noDoors?' and ':''}${noDoors?'door styles':''} before running the wizard.<br/>
        <button class="mqph-btn mqph-btn-secondary" style="margin-top:10px" onclick="mqphStartItemSetup()">← Go back and add items</button></div>` : `
        <div class="mqph-hl">
          ✅ Found <strong>${materials.length}</strong> material${materials.length!==1?'s':''} and <strong>${doorStyles.length}</strong> door style${doorStyles.length!==1?'s':''}.<br/><br/>
          <strong>Every step uses the same cabinet spec:</strong><br/>
          <span class="mqph-spec-tag">1 × 30" cabinet</span> + <span class="mqph-spec-tag">1 × 18" cabinet</span> = <span class="mqph-spec-tag">4 linear feet</span><br/><br/>
          Keep this spec consistent in your quoting software for every step. We'll tell you exactly what to change each time.
        </div>
        <div style="font-size:13px;color:#374151;line-height:1.8">
          ✅ Box-only baseline (no doors)<br/>
          ✅ Door styles as upcharges on top of the box<br/>
          ✅ Separate rates for uppers and bases<br/>
          ✅ Hardware, hinges, and finish upgrades<br/>
          ✅ Installation and removal rates
        </div>`,
      skipLabel: null,
      nextLabel: noMats || noDoors ? null : 'Start →',
      onNext: () => noMats || noDoors ? 'abort' : null,
    });

    // Step 1: Choose baseline
    steps.push({
      title: '📐 Step 1 — Choose your baseline',
      sub: 'Pick your cheapest material and cheapest door style. The baseline quote will be box-only (no doors) — doors will be priced separately as upcharges.',
      content: () => `
        <div class="mqph-hl">Your baseline = cheapest material, no doors, no hardware upgrades. Everything else is calculated as an upcharge from here.</div>
        <div class="mqph-input-row"><label>Baseline box material</label><select id="mqph-bl-mat" style="width:220px">${matOpts}</select></div>
        <div class="mqph-input-row"><label>Baseline door style <span style="font-weight:400;color:#9ca3af">(used later for door steps)</span></label><select id="mqph-bl-door" style="width:220px">${doorOpts}</select></div>
        ${hinges.length > 0 ? `<div class="mqph-input-row"><label>Your cheapest hinge option <span style="font-weight:400;color:#9ca3af">(baseline hinge — others become upcharges)</span></label><select id="mqph-bl-hinge" style="width:220px">${hinges.map((h,i)=>`<option value="${i}">${h.fields['Name']}</option>`).join('')}</select></div>` : ''}`,
      nextLabel: 'Next →',
      onNext: () => {
        const mi = parseInt(document.getElementById('mqph-bl-mat')?.value||0);
        const di = parseInt(document.getElementById('mqph-bl-door')?.value||0);
        const hi = parseInt(document.getElementById('mqph-bl-hinge')?.value||0);
        wizardBaseline = {
          matIndex:mi, matName:materials[mi]?.fields['Name']||'',
          doorIndex:di, doorName:doorStyles[di]?.fields['Name']||'',
          hingeIndex:hi, hingeName:hinges[hi]?.fields['Name']||'',
          upperPrice:0, basePrice:0, upperRate:0, baseRate:0,
          upperWithDoorPrice:0, baseWithDoorPrice:0,
        };
      }
    });

    // Step 2: Baseline uppers — BOX ONLY, no doors
    steps.push({
      title: '📐 Step 2 — Baseline upper cabinets (box only)',
      sub: 'In your quoting software, quote this exact job:',
      content: () => `
        ${specBox([
          `<strong>Upper cabinets only — BOX ONLY, no doors</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" upper</span> + <span class="mqph-spec-tag">1 × 18" upper</span> = 4 lin ft`,
          `Material: <span class="mqph-spec-tag">${wizardBaseline?.matName || materials[parseInt(document.getElementById('mqph-bl-mat')?.value||0)]?.fields['Name'] || '—'}</span>`,
          `<strong>No doors · No hardware · Supply only · Local delivery</strong>`,
        ])}
        <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-bl-u-price" placeholder="0.00" oninput="mqphCalc('bl-u')"/></div>
        <div id="mqph-r-bl-u" class="mqph-result"></div>`,
      nextLabel: 'Next →',
      onNext: () => {
        const p = parseFloat(document.getElementById('mqph-bl-u-price')?.value||0);
        if (p>0&&wizardBaseline) {
          wizardBaseline.upperPrice=p; wizardBaseline.upperRate=p/4;
          wizardItems.push({ name:wizardBaseline.matName+' — uppers (box)', category:'material', rate:Math.round(wizardBaseline.upperRate*100)/100, unit:'per lin ft — uppers', description:'Baseline box rate uppers — reverse engineered', active:true });
        }
      }
    });

    // Step 3: Baseline bases — BOX ONLY, no doors
    steps.push({
      title: '📐 Step 3 — Baseline base cabinets (box only)',
      sub: 'Same spec, bases only. Bases include toe kick — no doors, no hardware.',
      content: () => `
        ${specBox([
          `<strong>Base cabinets only — BOX ONLY, no doors</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
          `Material: <span class="mqph-spec-tag">${wizardBaseline?.matName || materials[parseInt(document.getElementById('mqph-bl-mat')?.value||0)]?.fields['Name'] || '—'}</span>`,
          `<strong>No doors · No hardware · Supply only · Local delivery · Include toe kick</strong>`,
        ])}
        ${wizardBaseline?.upperRate>0?`<p style="font-size:12px;color:#6b7280;margin-bottom:12px">Your upper box rate was $${wizardBaseline.upperRate.toFixed(2)}/ft — bases should be higher due to toe kick and drawers.</p>`:''}
        <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-bl-b-price" placeholder="0.00" oninput="mqphCalc('bl-b')"/></div>
        <div id="mqph-r-bl-b" class="mqph-result"></div>`,
      nextLabel: 'Next →',
      onNext: () => {
        const p = parseFloat(document.getElementById('mqph-bl-b-price')?.value||0);
        if (p>0&&wizardBaseline) {
          wizardBaseline.basePrice=p; wizardBaseline.baseRate=p/4;
          wizardItems.push({ name:wizardBaseline.matName+' — bases (box)', category:'material', rate:Math.round(wizardBaseline.baseRate*100)/100, unit:'per lin ft — bases', description:'Baseline box rate bases — reverse engineered', active:true });
        }
      }
    });

    // Step 4: Additional materials (bases, box only, no doors)
    if (materials.length > 1) {
      steps.push({
        title: '🪵 Step 4 — Additional material upcharges',
        sub: 'Same base cabinet spec, just swap the material. Box only, no doors.',
        content: () => {
          const blIdx = wizardBaseline?.matIndex ?? parseInt(document.getElementById('mqph-bl-mat')?.value||'0');
          const others = materials.filter((_,i) => i !== blIdx);
          return others.map((m,idx) => `
            <div class="mqph-item-block">
              <div class="mqph-item-block-label">📦 ${m.fields['Name']}</div>
              ${specBox([
                `<strong>Base cabinets — BOX ONLY, no doors</strong>`,
                `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                `Material: <span class="mqph-spec-tag">${m.fields['Name']}</span> · No doors · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-mat-${idx}" placeholder="0.00" oninput="mqphCalcUp('mat-${idx}')"/></div>
              <div id="mqph-r-mat-${idx}" class="mqph-result"></div>
            </div>`).join('');
        },
        skipLabel: 'Skip — same price for all materials',
        nextLabel: 'Next →',
        onNext: () => {
          const others = materials.filter((_,i) => i !== (wizardBaseline?.matIndex ?? -1));
          others.forEach((m,idx) => {
            const p = parseFloat(document.getElementById(`mqph-mat-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              const u=(p-wizardBaseline.basePrice)/4;
              wizardItems.push({ name:m.fields['Name'], category:'material', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'Material upcharge — reverse engineered', active:true });
            }
          });
        }
      });
    }

    // Step 5: Door style upcharges — NOW add doors (3 doors: 2 on 30", 1 on 18")
    // First: baseline door with baseline hinge
    steps.push({
      title: '🚪 Step 5 — Door style pricing',
      sub: 'Now we add doors. Quote the same base cabinet spec but with your baseline door style and cheapest hinge.',
      content: () => `
        <div class="mqph-hl">This establishes your baseline door rate. We use the same 30"+18" spec — that gives us 3 doors total which is realistic for this size run.</div>
        ${specBox([
          `<strong>Base cabinets with baseline doors + baseline hinges</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
          `Material: <span class="mqph-spec-tag">${wizardBaseline?.matName||'—'}</span>`,
          `Door style: <span class="mqph-spec-tag">${wizardBaseline?.doorName||'—'}</span> · <span class="mqph-spec-tag">3 doors total: 2 on 30", 1 on 18"</span>`,
          `Hinges: <span class="mqph-spec-tag">${wizardBaseline?.hingeName||'your cheapest hinge'}</span> · Supply only`,
        ])}
        <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-door-baseline" placeholder="0.00" oninput="mqphCalcDoorBaseline()"/></div>
        <div id="mqph-r-door-baseline" class="mqph-result"></div>`,
      nextLabel: 'Next →',
      onNext: () => {
        const p = parseFloat(document.getElementById('mqph-door-baseline')?.value||0);
        if (p>0&&wizardBaseline) {
          wizardBaseline.baseWithDoorPrice = p;
          const doorUpcharge = (p - wizardBaseline.basePrice) / 4;
          wizardItems.push({ name:wizardBaseline.doorName, category:'door', rate:Math.round(doorUpcharge*100)/100, unit:'per lin ft upcharge', description:`Baseline door style (${wizardBaseline.hingeName}) — reverse engineered`, active:true });
          // Also store baseline hinge as $0 upcharge (it's the base)
          if (wizardBaseline.hingeName) {
            wizardItems.push({ name:wizardBaseline.hingeName, category:'hinge', rate:0, unit:'per lin ft upcharge', description:'Baseline hinge — included in door price', active:true });
          }
        }
      }
    });

    // Step 6: Additional door styles — only if >1 door style
    if (doorStyles.length > 1) {
      steps.push({
        title: '🚪 Step 6 — Additional door style upcharges',
        sub: 'Same spec, swap the door style. Keep the baseline material and baseline hinge.',
        content: () => {
          const blIdx = wizardBaseline?.doorIndex ?? parseInt(document.getElementById('mqph-bl-door')?.value||'0');
          const others = doorStyles.filter((_,i) => i !== blIdx);
          return others.map((d,idx) => `
            <div class="mqph-item-block">
              <div class="mqph-item-block-label">🚪 ${d.fields['Name']}</div>
              ${specBox([
                `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                `Material: <span class="mqph-spec-tag">${wizardBaseline?.matName||'—'}</span> · Doors: <span class="mqph-spec-tag">${d.fields['Name']}</span>`,
                `<span class="mqph-spec-tag">3 doors: 2 on 30", 1 on 18"</span> · Hinges: <span class="mqph-spec-tag">${wizardBaseline?.hingeName||'baseline hinge'}</span> · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-door-${idx}" placeholder="0.00" oninput="mqphCalcDoorUp(${idx})"/></div>
              <div id="mqph-r-door-${idx}" class="mqph-result"></div>
            </div>`).join('');
        },
        skipLabel: 'Skip — same price for all door styles',
        nextLabel: 'Next →',
        onNext: () => {
          const others = doorStyles.filter((_,i) => i !== (wizardBaseline?.doorIndex ?? -1));
          others.forEach((d,idx) => {
            const p = parseFloat(document.getElementById(`mqph-door-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              const u=(p - (wizardBaseline.baseWithDoorPrice||wizardBaseline.basePrice)) / 4;
              wizardItems.push({ name:d.fields['Name'], category:'door', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'Door style upcharge — reverse engineered', active:true });
            }
          });
        }
      });
    }

    // Step 7: Hinge upcharges — only if >1 hinge
    if (hinges.length > 1) {
      steps.push({
        title: '🔧 Step 7 — Hinge upcharges',
        sub: 'Same spec with baseline door, swap the hinge type. This calculates the upcharge over your baseline hinge.',
        content: () => {
          const blIdx = wizardBaseline?.hingeIndex ?? parseInt(document.getElementById('mqph-bl-hinge')?.value||'0');
          const others = hinges.filter((_,i) => i !== blIdx);
          return others.map((h,idx) => `
            <div class="mqph-item-block">
              <div class="mqph-item-block-label">🔧 ${h.fields['Name']}</div>
              ${specBox([
                `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                `Material: <span class="mqph-spec-tag">${wizardBaseline?.matName||'—'}</span> · Doors: <span class="mqph-spec-tag">${wizardBaseline?.doorName||'—'}</span>`,
                `Hinges: <span class="mqph-spec-tag">${h.fields['Name']}</span> (instead of ${wizardBaseline?.hingeName||'baseline hinge'}) · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price with ${h.fields['Name']}?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-hinge-${idx}" placeholder="0.00" oninput="mqphCalcHingeUp(${idx})"/></div>
              <div id="mqph-r-hinge-${idx}" class="mqph-result"></div>
            </div>`).join('');
        },
        skipLabel: 'Skip — only one hinge option',
        nextLabel: 'Next →',
        onNext: () => {
          const others = hinges.filter((_,i) => i !== (wizardBaseline?.hingeIndex ?? -1));
          others.forEach((h,idx) => {
            const p = parseFloat(document.getElementById(`mqph-hinge-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              const baseWithDoor = wizardBaseline.baseWithDoorPrice || wizardBaseline.basePrice;
              const u = (p - baseWithDoor) / 4;
              wizardItems.push({ name:h.fields['Name'], category:'hinge', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:`Hinge upcharge over ${wizardBaseline.hingeName} — reverse engineered`, active:true });
            }
          });
        }
      });
    }

    // Step 8: Other hardware & finishes (drawer boxes, slides, finishes)
    const hwCats = ['drawerbox','slide','finish'];
    const hwItems = lineItems.filter(r => r.fields && hwCats.includes(r.fields['Category']) && r.fields['Active']!==false);
    if (hwItems.length>0) {
      steps.push({
        title: '⚙️ Step 8 — Hardware & finish upgrades',
        sub: 'Quote the baseline box job (no doors) with each upgrade added one at a time.',
        content: () => hwItems.map((h,idx) => `
          <div class="mqph-item-block">
            <div class="mqph-item-block-label">${h.fields['Name']}</div>
            ${specBox([
              `Baseline box job + <span class="mqph-spec-tag">${h.fields['Name']}</span>`,
              `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> · Material: <span class="mqph-spec-tag">${wizardBaseline?.matName||'—'}</span>`,
              `No doors · Supply only`,
            ])}
            <div class="mqph-input-row"><label>Your price with this upgrade?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-hw-${idx}" placeholder="0.00" oninput="mqphCalcUp('hw-${idx}')"/></div>
            <div id="mqph-r-hw-${idx}" class="mqph-result"></div>
          </div>`).join(''),
        skipLabel: 'Skip hardware & finishes',
        nextLabel: 'Next →',
        onNext: () => {
          hwItems.forEach((h,idx) => {
            const p = parseFloat(document.getElementById(`mqph-hw-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              const u=(p-wizardBaseline.basePrice)/4;
              wizardItems.push({ name:h.fields['Name'], category:h.fields['Category'], rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'Hardware/finish upgrade — reverse engineered', active:true });
            }
          });
        }
      });
    }

    // Step 9: Installation & removal
    const hasInstall = getByCategory('install').length > 0;
    if (hasInstall) {
      steps.push({
        title: '🔧 Step 9 — Installation & removal',
        sub: 'Quote install-only prices — no supply, just labour. Then set your removal rate.',
        content: () => `
          ${specBox([
            `<strong>Install only (no supply):</strong>`,
            `Upper install: <span class="mqph-spec-tag">1 × 30" upper</span> + <span class="mqph-spec-tag">1 × 18" upper</span> = 4 lin ft`,
            `Base install: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
          ])}
          <div class="mqph-input-row"><label>Install price for 4ft of uppers (labour only)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-inst-u" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
          <div class="mqph-input-row"><label>Install price for 4ft of bases (labour only)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-inst-b" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
          <div id="mqph-r-install" class="mqph-result"></div>
          <div style="height:1px;background:#e5e7eb;margin:1.25rem 0"></div>
          <div class="mqph-input-row"><label>Cabinet removal & disposal (per lin ft)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-removal" placeholder="0.00"/></div>
          <p style="font-size:12px;color:#9ca3af;margin-top:-8px;margin-bottom:1rem">What you charge per linear foot to remove and dispose of existing cabinets.</p>`,
        skipLabel: 'Skip — supply only shop',
        nextLabel: 'Next →',
        onNext: () => {
          const u=parseFloat(document.getElementById('mqph-inst-u')?.value||0);
          const b=parseFloat(document.getElementById('mqph-inst-b')?.value||0);
          const r=parseFloat(document.getElementById('mqph-removal')?.value||0);
          if (u>0) wizardItems.push({ name:'Install — uppers', category:'install', rate:Math.round((u/4)*100)/100, unit:'per lin ft', description:'Upper install rate — reverse engineered', active:true });
          if (b>0) wizardItems.push({ name:'Install — bases', category:'install', rate:Math.round((b/4)*100)/100, unit:'per lin ft', description:'Base install rate — reverse engineered', active:true });
          if (r>0) wizardItems.push({ name:'Cabinet removal', category:'install', rate:r, unit:'per lin ft', description:'Remove & dispose existing cabinets', active:true });
        }
      });
    }

    // Final step: Travel & tax
    steps.push({
      title: '🚗 Final step — Travel zones & tax',
      sub: 'Set your travel surcharges and tax rate.',
      content: () => `
        <div class="mqph-input-row"><label>Local zone radius</label><input type="number" id="mqph-zone-r" placeholder="15" style="width:130px;text-align:right"/><span class="mqph-pfx">km</span></div>
        <p style="font-size:12px;color:#9ca3af;margin-top:-8px;margin-bottom:1rem">Jobs within this distance have no travel surcharge.</p>
        <div class="mqph-input-row"><label>Zone 2 surcharge (flat fee)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-zone2" placeholder="0.00"/></div>
        <div class="mqph-input-row"><label>Zone 3 surcharge (flat fee)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-zone3" placeholder="0.00"/></div>
        <div class="mqph-input-row"><label>Zone 4 surcharge (flat fee)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-zone4" placeholder="0.00"/></div>
        <div style="height:1px;background:#e5e7eb;margin:1.25rem 0"></div>
        <div class="mqph-input-row"><label>Tax rate</label><input type="number" id="mqph-tax" placeholder="5" style="width:130px;text-align:right"/><span class="mqph-pfx">%</span></div>`,
      skipLabel: 'Skip',
      nextLabel: 'Finish setup →',
      onNext: () => {
        const gn=id=>parseFloat(document.getElementById(id)?.value||0);
        const zr=gn('mqph-zone-r'),z2=gn('mqph-zone2'),z3=gn('mqph-zone3'),z4=gn('mqph-zone4'),tax=gn('mqph-tax');
        if (zr>0) wizardItems.push({ name:'Local zone radius', category:'zone', rate:zr, unit:'km', description:'Within this distance = no travel surcharge', active:true });
        if (z2>0) wizardItems.push({ name:'Zone 2 surcharge', category:'zone', rate:z2, unit:'flat', description:'Zone 2 travel surcharge', active:true });
        if (z3>0) wizardItems.push({ name:'Zone 3 surcharge', category:'zone', rate:z3, unit:'flat', description:'Zone 3 travel surcharge', active:true });
        if (z4>0) wizardItems.push({ name:'Zone 4 surcharge', category:'zone', rate:z4, unit:'flat', description:'Zone 4 travel surcharge', active:true });
        if (tax>0) wizardItems.push({ name:'Tax rate', category:'tax', rate:tax, unit:'%', description:'Applied to cabinet subtotal', active:true });
      }
    });

    return steps;
  }

  // ============================================================
  // WIZARD CALC HELPERS
  // ============================================================
  window.mqphCalc = function(id) {
    const map = {
      'bl-u': { inputId:'mqph-bl-u-price', resId:'mqph-r-bl-u', label:'Upper box rate', calc: p => p/4 },
      'bl-b': { inputId:'mqph-bl-b-price', resId:'mqph-r-bl-b', label:'Base box rate',  calc: p => p/4 },
    };
    const cfg = map[id]; if (!cfg) return;
    const p = parseFloat(document.getElementById(cfg.inputId)?.value||0);
    const res = document.getElementById(cfg.resId); if (!res) return;
    if (p>0) { const r=cfg.calc(p); res.style.display='block'; res.innerHTML=`<strong>${cfg.label}:</strong> <span class="mqph-result-val">$${r.toFixed(2)} / lin ft</span>`; }
    else res.style.display='none';
  };

  window.mqphCalcUp = function(id) {
    const input = document.getElementById(`mqph-${id}`);
    const res = document.getElementById(`mqph-r-${id}`);
    if (!input||!res||!wizardBaseline) return;
    const p = parseFloat(input.value||0);
    if (p>0) { const u=(p-wizardBaseline.basePrice)/4; res.style.display='block'; res.innerHTML=`<strong>Upcharge vs baseline box:</strong> <span class="mqph-result-val">$${u.toFixed(2)} / lin ft</span>`; }
    else res.style.display='none';
  };

  window.mqphCalcDoorBaseline = function() {
    const p = parseFloat(document.getElementById('mqph-door-baseline')?.value||0);
    const res = document.getElementById('mqph-r-door-baseline'); if (!res||!wizardBaseline) return;
    if (p>0) {
      const doorUp = (p-wizardBaseline.basePrice)/4;
      res.style.display='block';
      res.innerHTML=`<strong>Door upcharge (${wizardBaseline.doorName}):</strong> <span class="mqph-result-val">$${doorUp.toFixed(2)} / lin ft</span><br/><span style="font-size:12px;color:#6b7280">Box rate $${wizardBaseline.baseRate.toFixed(2)} + door $${doorUp.toFixed(2)} = $${(wizardBaseline.baseRate+doorUp).toFixed(2)}/ft total</span>`;
    } else res.style.display='none';
  };

  window.mqphCalcDoorUp = function(idx) {
    const input = document.getElementById(`mqph-door-${idx}`);
    const res = document.getElementById(`mqph-r-door-${idx}`);
    if (!input||!res||!wizardBaseline) return;
    const p = parseFloat(input.value||0);
    if (p>0) {
      const baseWithDoor = wizardBaseline.baseWithDoorPrice||wizardBaseline.basePrice;
      const u=(p-baseWithDoor)/4;
      res.style.display='block';
      res.innerHTML=`<strong>Upcharge vs baseline door:</strong> <span class="mqph-result-val">$${u.toFixed(2)} / lin ft</span>`;
    } else res.style.display='none';
  };

  window.mqphCalcHingeUp = function(idx) {
    const input = document.getElementById(`mqph-hinge-${idx}`);
    const res = document.getElementById(`mqph-r-hinge-${idx}`);
    if (!input||!res||!wizardBaseline) return;
    const p = parseFloat(input.value||0);
    if (p>0) {
      const baseWithDoor = wizardBaseline.baseWithDoorPrice||wizardBaseline.basePrice;
      const u=(p-baseWithDoor)/4;
      res.style.display='block';
      res.innerHTML=`<strong>Hinge upcharge:</strong> <span class="mqph-result-val">$${u.toFixed(2)} / lin ft</span>`;
    } else res.style.display='none';
  };

  window.mqphCalcInstall = function() {
    const u=parseFloat(document.getElementById('mqph-inst-u')?.value||0);
    const b=parseFloat(document.getElementById('mqph-inst-b')?.value||0);
    const res=document.getElementById('mqph-r-install'); if (!res) return;
    let html='';
    if (u>0) html+=`<strong>Upper install rate:</strong> <span class="mqph-result-val">$${(u/4).toFixed(2)} / lin ft</span><br/>`;
    if (b>0) html+=`<strong>Base install rate:</strong> <span class="mqph-result-val">$${(b/4).toFixed(2)} / lin ft</span>`;
    if (html) { res.style.display='block'; res.innerHTML=html; } else res.style.display='none';
  };

  // ============================================================
  // WIZARD NAV
  // ============================================================
  function getSteps() { return buildWizardSteps(); }

  function renderWizardStep(idx) {
    const steps = getSteps();
    steps.forEach((_,i) => { const el=document.getElementById(`mqph-step-${i}`); if(el) el.classList.toggle('active',i===idx); });
    const dots = document.querySelectorAll('.mqph-progress .dot');
    dots.forEach((d,i) => { d.classList.remove('done','active'); if(i<idx) d.classList.add('done'); else if(i===idx) d.classList.add('active'); });
    const back=document.getElementById('mqph-back-btn');
    const next=document.getElementById('mqph-next-btn');
    const skip=document.getElementById('mqph-skip-btn');
    if (back) back.style.display=idx===0?'none':'inline-block';
    if (next) { if(steps[idx].nextLabel){next.textContent=steps[idx].nextLabel;next.style.display='inline-block';}else next.style.display='none'; }
    if (skip) { skip.style.display=steps[idx].skipLabel?'inline-block':'none'; if(steps[idx].skipLabel) skip.textContent=steps[idx].skipLabel; }
  }

  window.mqphNext = function() {
    const steps = getSteps();
    const result = steps[wizardStep].onNext ? steps[wizardStep].onNext() : null;
    if (result==='abort') { loadAndRender(); return; }
    wizardStep++;
    if (wizardStep>=steps.length) { mqphFinishWizard(); } else { renderWizardStep(wizardStep); }
  };

  window.mqphBack = function() { if(wizardStep>0){wizardStep--;renderWizardStep(wizardStep);} };
  window.mqphSkip = function() { wizardStep++; const steps=getSteps(); if(wizardStep>=steps.length){mqphFinishWizard();}else{renderWizardStep(wizardStep);} };

  async function mqphFinishWizard() {
    const container = document.getElementById('mq-pricing-helper-v2');
    if (container) container.innerHTML = '<div style="padding:3rem;text-align:center;color:#6b7280;font-size:14px">Saving your pricing...</div>';
    const rateCategories = ['zone','tax'];
    const toDelete = lineItems.filter(r => r.fields && rateCategories.includes(r.fields['Category']));
    for (const r of toDelete) { await atDelete(LINE_ITEMS_TABLE, r.id); }
    for (let i=0; i<wizardItems.length; i++) {
      const item = wizardItems[i];
      const existing = lineItems.find(r => r.fields && r.fields['Name']===item.name && !rateCategories.includes(r.fields['Category']));
      if (existing) {
        await atUpdate(LINE_ITEMS_TABLE, existing.id, { 'Rate':item.rate, 'Unit':item.unit, 'Description':item.description, 'Active':true });
      } else {
        await atCreate(LINE_ITEMS_TABLE, { 'shop':[shopRecord._recordId], 'Name':item.name, 'Category':item.category, 'Rate':item.rate, 'Unit':item.unit, 'Description':item.description||'', 'Active':true, 'Sort order':i+1 });
      }
    }
    await loadAndRender();
  }

  function buildWizardHTML() {
    const steps = getSteps();
    const dots = steps.map(()=>`<div class="dot"></div>`).join('');
    const stepDivs = steps.map((s,i)=>`
      <div class="mqph-step ${i===0?'active':''}" id="mqph-step-${i}">
        <div class="mqph-step-title">${s.title}</div>
        <div class="mqph-step-sub">${s.sub}</div>
        ${s.content()}
      </div>`).join('');
    return `
      <div class="mqph-wizard-card">
        <div class="mqph-wizard-header">
          <h2>⚙️ Pricing Setup Wizard</h2>
          <p>Spec: 1 × 30" + 1 × 18" = 4 lin ft · used throughout every step</p>
          <div class="mqph-progress">${dots}</div>
        </div>
        <div class="mqph-wizard-body">${stepDivs}</div>
        <div class="mqph-wizard-nav">
          <button class="mqph-btn mqph-btn-secondary" id="mqph-back-btn" onclick="mqphBack()" style="display:none">← Back</button>
          <button class="mqph-btn mqph-btn-secondary" id="mqph-skip-btn" onclick="mqphSkip()" style="display:none">Skip</button>
          <button class="mqph-btn mqph-btn-primary" id="mqph-next-btn" onclick="mqphNext()" style="margin-left:auto">Start →</button>
        </div>
      </div>`;
  }

  // ============================================================
  // EDITOR
  // ============================================================
  function buildEditorHTML() {
    const groups = {};
    lineItems.filter(r=>r.fields).forEach(r => { const c=r.fields['Category']||'other'; if(!groups[c]) groups[c]=[]; groups[c].push(r); });
    const hasItems = lineItems.filter(r=>r.fields).length > 0;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px">⚙️ Pricing Setup</h2>
          <p style="font-size:13px;color:#6b7280">Manage your rates — changes update your widget immediately.</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="mqph-btn mqph-btn-secondary" onclick="mqphStartItemSetup()">🛠️ Edit shop items</button>
          <button class="mqph-btn mqph-btn-secondary" onclick="mqphGoToWizard()">🧙 Run pricing wizard</button>
        </div>
      </div>
      ${!hasItems ? `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:3rem;text-align:center;margin-bottom:1.5rem">
          <div style="font-size:32px;margin-bottom:12px">⚙️</div>
          <div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px">No pricing set up yet</div>
          <div style="font-size:13px;color:#6b7280;margin-bottom:1.5rem">Start by setting up your shop items, then run the pricing wizard.</div>
          <button class="mqph-btn mqph-btn-primary" onclick="mqphStartItemSetup()">Set up shop items →</button>
        </div>` : `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
          <span style="font-size:14px;font-weight:700;color:#111">📋 Your pricing items</span>
          <button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="mqphOpenAdd()">+ Add item</button>
        </div>
        ${Object.entries(groups).map(([cat,recs])=>`
          <div class="mqph-cat-block">
            <div class="mqph-cat-header">
              <span class="mqph-cat-title">${CAT_LABELS[cat]||cat}</span>
              <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenAdd('${cat}')">+ Add</button>
            </div>
            ${recs.sort((a,b)=>(a.fields['Sort order']||0)-(b.fields['Sort order']||0)).map(r=>`
              <div class="mqph-row">
                <div style="flex:1;min-width:0">
                  <div class="mqph-row-name">${r.fields['Name']||'—'}</div>
                  ${r.fields['Description']?`<div class="mqph-row-desc">${r.fields['Description']}</div>`:''}
                </div>
                <div class="mqph-row-rate">$${(r.fields['Rate']||0).toLocaleString()}</div>
                <div class="mqph-row-unit">${r.fields['Unit']||''}</div>
                <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active']?'on':''}" onclick="mqphToggle('${r.id}',this)"></div></div>
                <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenEdit('${r.id}')">Edit</button>
                <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDelete('${r.id}')">Delete</button>
              </div>`).join('')}
          </div>`).join('')}
      `}
      ${buildCTHtml(pricingRecord?.fields||{})}
      <div class="mqph-overlay" id="mqph-modal-overlay">
        <div class="mqph-modal">
          <div class="mh"><h3 id="mqph-modal-title">Add pricing item</h3><button onclick="mqphCloseModal()">×</button></div>
          <div class="mb">
            <div class="mqph-field"><label>Name</label><input type="text" id="mqph-item-name" placeholder="e.g. Maple shaker"/></div>
            <div class="mqph-field"><label>Category</label>
              <select id="mqph-item-cat">${Object.entries(CAT_LABELS).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
            </div>
            <div class="mqph-field"><label>Rate ($)</label><input type="number" id="mqph-item-rate" placeholder="0.00" step="0.01"/></div>
            <div class="mqph-field"><label>Unit</label>
              <select id="mqph-item-unit">
                <option>per lin ft</option><option>per lin ft — uppers</option><option>per lin ft — bases</option>
                <option>per lin ft upcharge</option><option>flat</option><option>each</option><option>%</option><option>km</option><option>/ sqft</option>
              </select>
            </div>
            <div class="mqph-field"><label>Description (optional)</label><textarea id="mqph-item-desc"></textarea></div>
            <div class="mqph-field" style="flex-direction:row;align-items:center;gap:10px"><label style="margin:0">Active</label><input type="checkbox" id="mqph-item-active" checked style="width:auto"/></div>
            <div style="display:flex;gap:10px;margin-top:1rem">
              <button class="mqph-btn mqph-btn-primary" onclick="mqphSaveItem()" style="flex:1">Save item</button>
              <button class="mqph-btn mqph-btn-secondary" onclick="mqphCloseModal()">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  window.mqphStartItemSetup = async function() {
    const hasHinge   = lineItems.filter(r=>r.fields).some(r => r.fields['Category']==='hinge');
    const hasInstall = lineItems.filter(r=>r.fields).some(r => r.fields['Category']==='install');
    if (!hasHinge) {
      for (let i=0;i<DEFAULT_HINGES.length;i++) {
        const rec=await atCreate(LINE_ITEMS_TABLE,{'shop':[shopRecord._recordId],'Name':DEFAULT_HINGES[i],'Category':'hinge','Rate':0,'Unit':'per lin ft upcharge','Active':true,'Sort order':i+1});
        if(rec&&rec.id) lineItems.push(rec);
      }
    }
    if (!hasInstall) {
      for (let i=0;i<DEFAULT_INSTALL.length;i++) {
        const rec=await atCreate(LINE_ITEMS_TABLE,{'shop':[shopRecord._recordId],'Name':DEFAULT_INSTALL[i].name,'Category':'install','Rate':0,'Unit':DEFAULT_INSTALL[i].unit,'Description':DEFAULT_INSTALL[i].description,'Active':true,'Sort order':i+1});
        if(rec&&rec.id) lineItems.push(rec);
      }
    }
    const container=document.getElementById('mq-pricing-helper-v2');
    if(container) container.innerHTML=buildItemSetupHTML();
  };

  window.mqphOpenAdd = function(cat) {
    currentEditId=null;
    document.getElementById('mqph-modal-title').textContent='Add pricing item';
    document.getElementById('mqph-item-name').value='';
    document.getElementById('mqph-item-cat').value=cat||'material';
    document.getElementById('mqph-item-rate').value='';
    document.getElementById('mqph-item-unit').value='per lin ft';
    document.getElementById('mqph-item-desc').value='';
    document.getElementById('mqph-item-active').checked=true;
    document.getElementById('mqph-modal-overlay').classList.add('show');
  };

  window.mqphOpenEdit = function(id) {
    const rec=lineItems.find(r=>r.id===id); if(!rec) return;
    currentEditId=id;
    document.getElementById('mqph-modal-title').textContent='Edit pricing item';
    document.getElementById('mqph-item-name').value=rec.fields['Name']||'';
    document.getElementById('mqph-item-cat').value=rec.fields['Category']||'material';
    document.getElementById('mqph-item-rate').value=rec.fields['Rate']||'';
    document.getElementById('mqph-item-unit').value=rec.fields['Unit']||'per lin ft';
    document.getElementById('mqph-item-desc').value=rec.fields['Description']||'';
    document.getElementById('mqph-item-active').checked=rec.fields['Active']!==false;
    document.getElementById('mqph-modal-overlay').classList.add('show');
  };

  window.mqphCloseModal=function(){document.getElementById('mqph-modal-overlay').classList.remove('show');};

  window.mqphSaveItem=async function(){
    const name=document.getElementById('mqph-item-name').value.trim();
    if(!name){alert('Please enter a name.');return;}
    const fields={'shop':[shopRecord._recordId],'Name':name,'Category':document.getElementById('mqph-item-cat').value,'Rate':parseFloat(document.getElementById('mqph-item-rate').value||0),'Unit':document.getElementById('mqph-item-unit').value,'Description':document.getElementById('mqph-item-desc').value.trim(),'Active':document.getElementById('mqph-item-active').checked};
    try{
      if(currentEditId){await atUpdate(LINE_ITEMS_TABLE,currentEditId,fields);}
      else{fields['Sort order']=lineItems.length+1;await atCreate(LINE_ITEMS_TABLE,fields);}
      mqphCloseModal();await loadAndRender();
    }catch(e){alert('Error saving. Please try again.');}
  };

  window.mqphDelete=async function(id){if(!confirm('Delete this item?'))return;try{await atDelete(LINE_ITEMS_TABLE,id);await loadAndRender();}catch(e){alert('Error deleting.');}};

  window.mqphToggle=async function(id,el){
    const rec=lineItems.find(r=>r.id===id);if(!rec)return;
    const val=!rec.fields['Active'];el.classList.toggle('on',val);rec.fields['Active']=val;
    await atUpdate(LINE_ITEMS_TABLE,id,{'Active':val});
  };

  // ============================================================
  // COUNTERTOP DIRECT ENTRY
  // ============================================================
  function buildCTHtml(p) {
    const v=(f,d)=>p[f]!==undefined?p[f]:d;
    const row=(id,label,field,def,suf)=>`
      <div class="mqph-ct-row">
        <span class="mqph-ct-label">${label}</span>
        <div class="mqph-ct-inp"><span>$</span><input type="number" id="mqph-ct-${id}" value="${v(field,def)}"/><span>${suf||'/ sqft'}</span></div>
      </div>`;
    return `
      <div class="mqph-ct-block">
        <div class="mqph-cat-header">
          <span class="mqph-cat-title">🪨 Countertop rates (direct entry)</span>
          <button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="mqphSaveCT()">Save countertop rates</button>
        </div>
        <div id="mqph-ct-msg" class="mqph-msg"></div>
        ${row('lam','Laminate','Lam supply',18,'/ sqft')}
        ${row('ss-econ','Solid surface — Economy','SS econ supply',38,'/ sqft')}
        ${row('ss-mid','Solid surface — Mid','SS mid supply',58,'/ sqft')}
        ${row('ss-prem','Solid surface — Premium','SS prem supply',90,'/ sqft')}
        ${row('gran-econ','Granite — Economy','Gran econ supply',45,'/ sqft')}
        ${row('gran-mid','Granite — Mid','Gran mid supply',72,'/ sqft')}
        ${row('gran-prem','Granite — Premium','Gran prem supply',130,'/ sqft')}
        ${row('quartz','Engineered quartz','Quartz supply',85,'/ sqft')}
        ${row('marble','Marble','Marble supply',110,'/ sqft')}
        ${row('butcher','Butcher block','Butcher supply',42,'/ sqft')}
        ${row('backsplash','Backsplash (material + install)','Backsplash rate',12,'/ lin ft')}
        ${row('sink','Sink cutout','Sink cutout',180,'each')}
        ${row('cooktop','Cooktop cutout','Cooktop cutout',220,'each')}
      </div>`;
  }

  window.mqphSaveCT=async function(){
    const gn=id=>parseFloat(document.getElementById(`mqph-ct-${id}`)?.value||0);
    const fields={'Lam supply':gn('lam'),'SS econ supply':gn('ss-econ'),'SS mid supply':gn('ss-mid'),'SS prem supply':gn('ss-prem'),'Gran econ supply':gn('gran-econ'),'Gran mid supply':gn('gran-mid'),'Gran prem supply':gn('gran-prem'),'Quartz supply':gn('quartz'),'Marble supply':gn('marble'),'Butcher supply':gn('butcher'),'Backsplash rate':gn('backsplash'),'Sink cutout':gn('sink'),'Cooktop cutout':gn('cooktop')};
    try{
      if(pricingRecord) await fetch(`${AT_BASE_URL()}/${shopRecord._pricingTable}/${pricingRecord.id}`,{method:'PATCH',headers:AT_HEADS(),body:JSON.stringify({fields})});
      const msg=document.getElementById('mqph-ct-msg');
      if(msg){msg.textContent='✓ Saved!';msg.className='mqph-msg mqph-msg-success';msg.style.display='block';setTimeout(()=>msg.style.display='none',3000);}
    }catch(e){
      const msg=document.getElementById('mqph-ct-msg');
      if(msg){msg.textContent='Error saving.';msg.className='mqph-msg mqph-msg-error';msg.style.display='block';}
    }
  };

  // ============================================================
  // LOAD AND RENDER
  // ============================================================
  async function loadAndRender() {
    const container=document.getElementById('mq-pricing-helper-v2');
    if(!container) return;
    const recs=await atGet(LINE_ITEMS_TABLE,`FIND("${shopRecord._recordId}", ARRAYJOIN({shop}))`);
    lineItems=recs.filter(r=>r.fields);
    container.innerHTML=buildEditorHTML();
  }

  window.loadAndRender=loadAndRender;

  // ============================================================
  // INIT
  // ============================================================
  window.mqph2Init=function(passedShopRecord,passedPricingRecord){
    if(!passedShopRecord) return;
    shopRecord={...passedShopRecord,_recordId:passedShopRecord.id,_baseId:'app4zrMlVLwF2xn4h',_token:'patulbU1ndSvFpMDo.906a8be9e784fb12de048d4238c5d553859f8d57670ccd1bc1a6de4e2da37325',_pricingTable:'tblu6AYZs8h7SIaQl'};
    pricingRecord=passedPricingRecord;
    injectStyles();
    loadAndRender();
  };

})();