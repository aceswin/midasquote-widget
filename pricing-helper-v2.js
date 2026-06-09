/*
 * MidasQuote Pricing Helper v4.3
 * Clean categories: materials, doors (with finish in name), drawer configs, hinges, install
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
      #mq-pricing-helper-v2 *{box-sizing:border-box !important}
      #mq-pricing-helper-v2{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif !important;padding:2rem !important;max-width:900px}
      .mqph-btn{padding:10px 20px !important;font-size:13px !important;font-weight:600 !important;border-radius:8px !important;cursor:pointer !important;border:none !important;font-family:inherit !important;transition:all 0.15s !important;line-height:1.2 !important}
      .mqph-btn-primary{background:#1a1a1a !important;color:#fff !important}.mqph-btn-primary:hover{opacity:0.88 !important}
      .mqph-btn-secondary{background:#fff !important;color:#111 !important;border:1px solid #e5e7eb !important}.mqph-btn-secondary:hover{background:#f9fafb !important}
      .mqph-btn-danger{background:#fff !important;color:#dc2626 !important;border:1px solid #fca5a5 !important}.mqph-btn-danger:hover{background:#fef2f2 !important}
      .mqph-btn-sm{padding:5px 12px !important;font-size:12px !important}
      .mqph-setup-card{background:#fff !important;border:1px solid #e5e7eb !important;border-radius:12px !important;margin-bottom:1.25rem !important;overflow:hidden !important}
      .mqph-setup-header{background:#f9fafb !important;padding:14px 16px !important;border-bottom:1px solid #e5e7eb !important}
      .mqph-setup-title{font-size:13px !important;font-weight:700 !important;color:#111 !important}
      .mqph-setup-sub{font-size:11px !important;color:#6b7280 !important;margin-top:2px !important;line-height:1.5 !important}
      .mqph-chip-row{display:flex !important;flex-wrap:wrap !important;gap:8px !important;padding:14px 16px !important;align-items:center !important}
      .mqph-chip{display:flex !important;align-items:center !important;gap:6px !important;padding:6px 12px !important;background:#f9fafb !important;border:1px solid #e5e7eb !important;border-radius:20px !important;font-size:13px !important;color:#111 !important}
      .mqph-chip-del{background:none !important;border:none !important;color:#9ca3af !important;cursor:pointer !important;font-size:16px !important;line-height:1 !important;padding:0 0 0 2px !important;font-family:inherit !important}.mqph-chip-del:hover{color:#dc2626 !important}
      .mqph-chip-input{display:flex !important;align-items:center !important;gap:6px !important;padding:4px 8px !important;border:1.5px dashed #d1d5db !important;border-radius:20px !important}
      .mqph-chip-input input{border:none !important;outline:none !important;font-size:13px !important;color:#111 !important;background:transparent !important;font-family:inherit !important;width:220px !important}
      .mqph-chip-input button{background:#1a1a1a !important;color:#fff !important;border:none !important;border-radius:12px !important;padding:3px 10px !important;font-size:12px !important;cursor:pointer !important;font-family:inherit !important}
      .mqph-default-chip{background:#eff6ff !important;border-color:#93c5fd !important;color:#1d4ed8 !important}
      .mqph-wizard-card{background:#fff !important;border:1px solid #e5e7eb !important;border-radius:12px !important;overflow:hidden !important;margin-bottom:1.5rem !important}
      .mqph-wizard-header{background:#1a1a1a !important;color:#fff !important;padding:1.25rem 1.5rem !important}
      .mqph-wizard-header h2{font-size:15px !important;font-weight:600 !important;margin:0 0 4px !important;padding:0 !important}
      .mqph-wizard-header p{font-size:12px !important;opacity:0.65 !important;margin:0 !important;padding:0 !important}
      .mqph-progress{display:flex !important;gap:4px !important;margin-top:10px !important;padding:0 !important}
      .mqph-progress .dot{flex:1 !important;height:4px !important;background:rgba(255,255,255,0.2) !important;border-radius:2px !important;transition:background 0.3s !important;padding:0 !important}
      .mqph-progress .dot.done{background:#a3e635 !important}
      .mqph-progress .dot.active{background:#fff !important}
      .mqph-wizard-body{padding:1.5rem !important}
      .mqph-wizard-nav{display:flex !important;gap:10px !important;padding:1rem 1.5rem !important;border-top:1px solid #e5e7eb !important;background:#f9fafb !important;align-items:center !important}
      .mqph-step{display:none !important}.mqph-step.active{display:block !important}
      .mqph-step-title{font-size:17px !important;font-weight:700 !important;color:#111 !important;margin-bottom:6px !important;padding:0 !important}
      .mqph-step-sub{font-size:13px !important;color:#6b7280 !important;margin-bottom:1.25rem !important;line-height:1.6 !important;padding:0 !important}
      .mqph-hl{background:#f0fdf4 !important;border:1px solid #86efac !important;border-radius:8px !important;padding:12px 16px !important;margin-bottom:1.25rem !important;font-size:13px !important;color:#166534 !important;line-height:1.7 !important}
      .mqph-warn{background:#fef9c3 !important;border:1px solid #fde047 !important;border-radius:8px !important;padding:12px 16px !important;font-size:13px !important;color:#854d0e !important;margin-bottom:1rem !important;line-height:1.6 !important}
      .mqph-spec-box{background:#f9fafb !important;border:1px solid #e5e7eb !important;border-radius:8px !important;padding:12px 16px !important;margin-bottom:1.25rem !important;font-size:13px !important;color:#374151 !important;line-height:1.8 !important}
      .mqph-spec-box strong{color:#111 !important}
      .mqph-spec-tag{display:inline-block !important;background:#fff !important;border:1px solid #e5e7eb !important;border-radius:6px !important;padding:2px 8px !important;font-size:12px !important;font-weight:600 !important;color:#374151 !important;margin:2px 3px 2px 0 !important}
      .mqph-input-row{display:flex !important;align-items:center !important;gap:10px !important;margin-bottom:1rem !important;padding:0 !important}
      .mqph-input-row label{font-size:13px !important;color:#374151 !important;flex:1 !important;font-weight:500 !important;padding:0 !important;margin:0 !important}
      .mqph-input-row input[type=number]{width:130px !important;text-align:right !important;font-weight:600 !important;font-family:inherit !important;font-size:13px !important;color:#111 !important;background:#fff !important;border:1.5px solid #d1d5db !important;border-radius:8px !important;padding:8px 12px !important}
      .mqph-input-row input:focus{outline:none !important;border-color:#1a1a1a !important}
      .mqph-pfx{font-size:14px !important;color:#6b7280 !important;padding:0 !important;margin:0 !important}
      .mqph-result{background:#f9fafb !important;border-radius:8px !important;padding:10px 14px !important;margin-top:6px !important;margin-bottom:1rem !important;font-size:13px !important;display:none !important}
      .mqph-result-val{font-size:18px !important;font-weight:700 !important;color:#16a34a !important}
      .mqph-item-block{padding-bottom:1.25rem !important;margin-bottom:1.25rem !important;border-bottom:1px solid #f3f4f6 !important}
      .mqph-item-block:last-child{border-bottom:none !important;margin-bottom:0 !important;padding-bottom:0 !important}
      .mqph-item-block-label{font-size:13px !important;font-weight:600 !important;color:#111 !important;margin-bottom:8px !important;padding:0 !important}
      .mqph-cat-block{background:#fff !important;border:1px solid #e5e7eb !important;border-radius:12px !important;margin-bottom:1.25rem !important;overflow:hidden !important}
      .mqph-cat-header{background:#f9fafb !important;padding:12px 16px !important;border-bottom:1px solid #e5e7eb !important;display:flex !important;align-items:center !important;justify-content:space-between !important}
      .mqph-cat-title{font-size:12px !important;font-weight:700 !important;color:#374151 !important;text-transform:uppercase !important;letter-spacing:0.06em !important;padding:0 !important;margin:0 !important}
      .mqph-row{display:flex !important;align-items:center !important;gap:8px !important;padding:10px 16px !important;border-bottom:1px solid #f3f4f6 !important}
      .mqph-row:last-child{border-bottom:none !important}
      .mqph-row-name{flex:1 !important;font-size:13px !important;font-weight:500 !important;color:#111 !important;padding:0 !important;margin:0 !important}
      .mqph-row-desc{font-size:11px !important;color:#9ca3af !important;margin-top:1px !important;padding:0 !important}
      .mqph-row-rate{font-size:13px !important;font-weight:600 !important;color:#111 !important;min-width:80px !important;text-align:right !important;padding:0 !important;margin:0 !important}
      .mqph-row-unit{font-size:11px !important;color:#6b7280 !important;min-width:100px !important;text-align:right !important;padding:0 !important;margin:0 !important}
      .mqph-toggle{width:32px !important;height:18px !important;background:#d1d5db !important;border-radius:9px !important;position:relative !important;cursor:pointer !important;transition:background 0.2s !important;flex-shrink:0 !important;display:inline-block !important;padding:0 !important;margin:0 !important}
      .mqph-toggle.on{background:#16a34a !important}
      .mqph-toggle::after{content:'' !important;position:absolute !important;width:14px !important;height:14px !important;background:#fff !important;border-radius:50% !important;top:2px !important;left:2px !important;transition:left 0.2s !important}
      .mqph-toggle.on::after{left:16px !important}
      .mqph-overlay{display:none !important;position:fixed !important;inset:0 !important;background:rgba(0,0,0,0.5) !important;z-index:9999 !important;align-items:center !important;justify-content:center !important;padding:1rem !important}
      .mqph-overlay.show{display:flex !important}
      .mqph-modal{background:#fff !important;border-radius:12px !important;width:100% !important;max-width:480px !important;max-height:90vh !important;overflow-y:auto !important;box-shadow:0 20px 60px rgba(0,0,0,0.2) !important}
      .mqph-modal .mh{padding:1.25rem !important;border-bottom:1px solid #e5e7eb !important;display:flex !important;align-items:center !important;justify-content:space-between !important}
      .mqph-modal .mh h3{font-size:15px !important;font-weight:600 !important;color:#111 !important;margin:0 !important;padding:0 !important}
      .mqph-modal .mh button{background:none !important;border:none !important;font-size:20px !important;color:#6b7280 !important;cursor:pointer !important;line-height:1 !important;padding:0 !important;margin:0 !important}
      .mqph-modal .mb{padding:1.25rem !important}
      .mqph-field{display:flex !important;flex-direction:column !important;gap:5px !important;margin-bottom:1rem !important;padding:0 !important}
      .mqph-field label{font-size:12px !important;font-weight:600 !important;color:#374151 !important;margin:0 !important;padding:0 !important}
      .mqph-field input,.mqph-field select,.mqph-field textarea{font-family:inherit !important;font-size:13px !important;color:#111 !important;background:#fff !important;border:1px solid #d1d5db !important;border-radius:8px !important;padding:8px 10px !important;width:100% !important}
      .mqph-field input:focus,.mqph-field select:focus{outline:none !important;border-color:#1a1a1a !important}
      .mqph-field textarea{resize:vertical !important;min-height:60px !important}
      .mqph-msg{padding:10px 14px !important;border-radius:8px !important;font-size:13px !important;margin-bottom:1rem !important;display:none !important}
      .mqph-msg-success{background:#dcfce7 !important;color:#166534 !important;border:1px solid #86efac !important}
      .mqph-msg-error{background:#fee2e2 !important;color:#991b1b !important;border:1px solid #fca5a5 !important}
      .mqph-ct-block{background:#fff !important;border:1px solid #e5e7eb !important;border-radius:12px !important;margin-bottom:1.25rem !important;overflow:hidden !important}
      .mqph-ct-row{display:flex !important;align-items:center !important;gap:10px !important;padding:10px 16px !important;border-bottom:1px solid #f3f4f6 !important}
      .mqph-ct-row:last-child{border-bottom:none !important}
      .mqph-ct-label{flex:1 !important;font-size:13px !important;color:#374151 !important;font-weight:500 !important;padding:0 !important;margin:0 !important}
      .mqph-ct-inp{display:flex !important;align-items:center !important;gap:6px !important;padding:0 !important;margin:0 !important}
      .mqph-ct-inp span{font-size:13px !important;color:#6b7280 !important;padding:0 !important;margin:0 !important}
      .mqph-ct-inp input{width:90px !important;text-align:right !important;font-family:inherit !important;font-size:13px !important;color:#111 !important;background:#fff !important;border:1px solid #d1d5db !important;border-radius:8px !important;padding:7px 10px !important}
      .mqph-ct-inp input:focus{outline:none !important;border-color:#1a1a1a !important}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // CATEGORY CONFIG
  // ============================================================
  const CATEGORIES = [
    {
      id: 'material',
      label: '🪵 Box materials',
      sub: 'The material used to build the cabinet boxes (e.g. White melamine, Prefinished birch plywood, Painted MDF)',
      placeholder: 'e.g. White melamine'
    },
    {
      id: 'door',
      label: '🚪 Door styles',
      sub: 'Include the finish in the name — each door+finish combo is a separate item (e.g. "Maple shaker — stained & lacquered", "MDF slab — painted", "Maple shaker — painted")',
      placeholder: 'e.g. Maple shaker — stained & lacquered'
    },
    {
      id: 'drawer',
      label: '🗄️ Drawer configurations',
      sub: 'Combine box material + slide type in the name (e.g. "Prefinished birch — soft-close undermount", "White melamine — white track")',
      placeholder: 'e.g. Prefinished birch — soft-close undermount'
    },
    {
      id: 'hinge',
      label: '🔧 Door hinges',
      sub: 'Hinge options you offer — your cheapest hinge is the baseline, others become upcharges',
      placeholder: 'e.g. Concealed hinge'
    },
    {
      id: 'zone',
      label: '🚗 Travel zones',
      sub: 'Zone 1 is your local delivery area — no surcharge added. Your standard delivery cost should already be factored into your regular pricing. Add flat-fee surcharge zones beyond that for travel costs. Name them with their distance range e.g. "Zone 2 — 16 to 50km"',
      placeholder: 'e.g. Zone 2 — 16 to 50km'
    },
  ];

  const CAT_LABELS = {
    material: '🪵 Box materials',
    door: '🚪 Door styles',
    drawer: '🗄️ Drawer configurations',
    hinge: '🔧 Door hinges',
    install: '🔧 Installation & removal',
    zone: '🚗 Travel zones',
    tax: '🧾 Tax & other',
    other: '📋 Other',
  };

  const DEFAULT_INSTALL = [
    { name: 'Install — uppers (no doors)',   unit: 'per lin ft', description: 'Upper box install rate, no doors — set in wizard' },
    { name: 'Install — uppers (with doors)', unit: 'per lin ft', description: 'Upper install rate with doors — set in wizard' },
    { name: 'Install — bases (no doors)',    unit: 'per lin ft', description: 'Base box install rate, no doors — set in wizard' },
    { name: 'Install — bases (with doors)',  unit: 'per lin ft', description: 'Base install rate with doors — set in wizard' },
    { name: 'Cabinet removal',               unit: 'per lin ft', description: 'Remove & dispose existing cabinets — set in wizard' },
  ];

  const DEFAULT_HINGES = ['Soft-close hinges', 'Regular hinges'];

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
        <p style="font-size:13px;color:#6b7280;line-height:1.6">Add everything your shop offers. Just names for now — we'll figure out pricing in the wizard.</p>
      </div>

      ${CATEGORIES.map(cat => {
        const items = (existing[cat.id] || []).sort((a,b) => (a.fields['Sort order']||0)-(b.fields['Sort order']||0));
        const existingLocalRadius = (existing['zone']||[]).find(r=>r.fields['Name']?.toLowerCase().includes('local'))?.fields['Rate'] || 15;
        let zoneExtra = '';
        if (cat.id === 'zone') {
          zoneExtra = '<div style="padding:12px 16px;background:#eff6ff;border-bottom:1px solid #bfdbfe">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
            + '<div style="background:#1d4ed8;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap">Zone 1 — Local</div>'
            + '<div style="font-size:12px;color:#1e40af">Your local delivery area — no extra surcharge added within this radius. Factor your standard delivery cost into your regular pricing. Add flat-fee surcharge zones below for jobs beyond this area.</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:8px">'
            + '<label style="font-size:13px;color:#1e40af;font-weight:500">Local radius:</label>'
            + '<input type="number" id="mqph-local-radius" value="' + existingLocalRadius + '" style="width:80px;text-align:right;font-family:inherit;font-size:13px;color:#111;background:#fff;border:1.5px solid #93c5fd;border-radius:8px;padding:6px 10px;font-weight:600"/>'
            + '<span style="font-size:13px;color:#1e40af;font-weight:500">km</span>'
            + '<button onclick="mqphSaveLocalRadius()" style="background:#1d4ed8;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Save</button>'
            + '<span id="mqph-local-radius-saved" style="font-size:12px;color:#16a34a;display:none">✓ Saved</span>'
            + '</div></div>';
        }
        return `
          <div class="mqph-setup-card">
            <div class="mqph-setup-header">
              <div class="mqph-setup-title">${cat.label}</div>
              <div class="mqph-setup-sub">${cat.sub}</div>
            </div>
            ${zoneExtra}
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
          <div class="mqph-setup-sub">Pre-added for you — rates are set in the wizard. Delete any you don't offer. Supply-only shop? Delete all three.</div>
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
    wizardStep = 0; wizardItems = []; wizardBaseline = null;
    const container = document.getElementById('mq-pricing-helper-v2');
    if (container) { container.innerHTML = buildWizardHTML(); renderWizardStep(0); }
  };

  // ============================================================
  // WIZARD HELPERS
  // ============================================================
  function getByCategory(cat) {
    return lineItems.filter(r => r.fields && r.fields['Category'] === cat && r.fields['Active'] !== false)
      .sort((a,b) => (a.fields['Sort order']||0)-(b.fields['Sort order']||0));
  }

  function specBox(lines) {
    return `<div class="mqph-spec-box">${lines.map(l=>`<div>${l}</div>`).join('')}</div>`;
  }

  function getBlIdx(selectId, stored) {
    if (stored !== undefined && stored !== null) return stored;
    return parseInt(document.getElementById(selectId)?.value || '0');
  }

  // ============================================================
  // WIZARD STEPS
  // ============================================================
  function buildWizardSteps() {
    const materials  = getByCategory('material');
    const doorStyles = getByCategory('door');
    const drawers    = getByCategory('drawer');
    const hinges     = getByCategory('hinge');
    const noMats  = materials.length === 0;
    const noDoors = doorStyles.length === 0;

    const matOpts  = materials.map((m,i)  => `<option value="${i}">${m.fields['Name']}</option>`).join('');
    const doorOpts = doorStyles.map((d,i) => `<option value="${i}">${d.fields['Name']}</option>`).join('');
    const hingeOpts = hinges.map((h,i)   => `<option value="${i}">${h.fields['Name']}</option>`).join('');

    const steps = [];

    // Step 0: Welcome
    steps.push({
      title: '👋 Pricing Setup Wizard',
      sub: `We'll reverse-engineer your rates from real job quotes using a consistent spec throughout — no math required.`,
      content: () => noMats || noDoors ? `
        <div class="mqph-warn">⚠️ <strong>Missing items.</strong> You need to add ${noMats?'box materials':''}${noMats&&noDoors?' and ':''}${noDoors?'door styles':''} before running the wizard.</div>
        <button class="mqph-btn mqph-btn-primary" style="margin-top:10px" onclick="mqphStartItemSetup()">← Add shop items first</button>` : `
        <div class="mqph-hl">
          ✅ Found <strong>${materials.length}</strong> material${materials.length!==1?'s':''}, <strong>${doorStyles.length}</strong> door style${doorStyles.length!==1?'s':''}, <strong>${drawers.length}</strong> drawer config${drawers.length!==1?'s':''}, <strong>${hinges.length}</strong> hinge${hinges.length!==1?'s':''}.<br/><br/>
          <strong>Every step uses the same spec:</strong><br/>
          <span class="mqph-spec-tag">1 × 30" cabinet</span> + <span class="mqph-spec-tag">1 × 18" cabinet</span> = <span class="mqph-spec-tag">4 linear feet</span>
        </div>
        <div style="font-size:13px;color:#374151;line-height:1.8;margin-bottom:1.25rem">
          ✅ Box-only baseline (no doors, no drawers)<br/>
          ✅ Door styles as upcharges (finish included in name)<br/>
          ✅ Drawer configurations as upcharges<br/>
          ✅ Separate upper and base rates<br/>
          ✅ Installation and removal rates
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;color:#374151">Need to add or change your shop items first?</span>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphStartItemSetup()">🛠️ Edit shop items</button>
        </div>`,
      nextLabel: noMats || noDoors ? null : 'Start →',
      onNext: () => noMats || noDoors ? 'abort' : null,
    });

    // Step 1: Choose baseline
    steps.push({
      title: '📐 Step 1 — Choose your baseline',
      sub: 'Pick your cheapest options. The baseline is box-only with no doors — doors and drawers are priced separately.',
      content: () => `
        <div class="mqph-hl">Baseline = cheapest material + cheapest door style + cheapest hinge. Everything else is an upcharge from here.</div>
        <div class="mqph-input-row"><label>Baseline box material</label><select id="mqph-bl-mat" style="width:260px">${matOpts}</select></div>
        <div class="mqph-input-row"><label>Baseline door style <span style="font-weight:400;color:#9ca3af">(used in door pricing steps)</span></label><select id="mqph-bl-door" style="width:260px">${doorOpts}</select></div>
        ${hinges.length>0?`<div class="mqph-input-row"><label>Cheapest hinge <span style="font-weight:400;color:#9ca3af">(baseline — others become upcharges)</span></label><select id="mqph-bl-hinge" style="width:260px">${hingeOpts}</select></div>`:''}`,
      nextLabel: 'Next →',
      onNext: () => {
        const mi = parseInt(document.getElementById('mqph-bl-mat')?.value||'0');
        const di = parseInt(document.getElementById('mqph-bl-door')?.value||'0');
        const hi = parseInt(document.getElementById('mqph-bl-hinge')?.value||'0');
        wizardBaseline = {
          matIndex:mi, matName:materials[mi]?.fields['Name']||'',
          doorIndex:di, doorName:doorStyles[di]?.fields['Name']||'',
          hingeIndex:hi, hingeName:hinges[hi]?.fields['Name']||'',
          upperPrice:0, basePrice:0, upperRate:0, baseRate:0,
          baseWithDoorPrice:0,
        };
      }
    });

    // Step 2: Baseline uppers — BOX ONLY
    steps.push({
      title: '📐 Step 2 — Baseline upper cabinets (box only)',
      sub: 'Quote this exact job in your quoting software:',
      content: () => {
        const matName = wizardBaseline?.matName || materials[getBlIdx('mqph-bl-mat', null)]?.fields['Name'] || '—';
        return `
          ${specBox([
            `<strong>Upper cabinets — BOX ONLY, no doors, no drawers</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" upper</span> + <span class="mqph-spec-tag">1 × 18" upper</span> = 4 lin ft`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `<strong>No doors · No drawers · No hardware · Supply only · Local delivery</strong>`,
          ])}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-bl-u-price" placeholder="0.00" oninput="mqphCalc('bl-u')"/></div>
          <div id="mqph-r-bl-u" class="mqph-result"></div>`;
      },
      nextLabel: 'Next →',
      onNext: () => {
        const p = parseFloat(document.getElementById('mqph-bl-u-price')?.value||0);
        if (p>0&&wizardBaseline) {
          wizardBaseline.upperPrice=p; wizardBaseline.upperRate=p/4;
          wizardItems.push({ name:wizardBaseline.matName+' — uppers', category:'material', rate:Math.round(wizardBaseline.upperRate*100)/100, unit:'per lin ft — uppers', description:'Baseline box rate uppers', active:true });
        }
      }
    });

    // Step 3: Baseline bases — BOX ONLY
    steps.push({
      title: '📐 Step 3 — Baseline base cabinets (box only)',
      sub: 'Same spec, bases only. Include toe kick — no doors, no drawers.',
      content: () => {
        const matName = wizardBaseline?.matName || materials[getBlIdx('mqph-bl-mat', null)]?.fields['Name'] || '—';
        return `
          ${specBox([
            `<strong>Base cabinets — BOX ONLY, no doors, no drawers</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `<strong>No doors · No drawers · Supply only · Local delivery · Include toe kick</strong>`,
          ])}
          ${wizardBaseline?.upperRate>0?`<p style="font-size:12px;color:#6b7280;margin-bottom:12px">Upper rate was $${wizardBaseline.upperRate.toFixed(2)}/ft — bases should be higher (toe kick + drawers).</p>`:''}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-bl-b-price" placeholder="0.00" oninput="mqphCalc('bl-b')"/></div>
          <div id="mqph-r-bl-b" class="mqph-result"></div>`;
      },
      nextLabel: 'Next →',
      onNext: () => {
        const p = parseFloat(document.getElementById('mqph-bl-b-price')?.value||0);
        if (p>0&&wizardBaseline) {
          wizardBaseline.basePrice=p; wizardBaseline.baseRate=p/4;
          wizardItems.push({ name:wizardBaseline.matName+' — bases', category:'material', rate:Math.round(wizardBaseline.baseRate*100)/100, unit:'per lin ft — bases', description:'Baseline box rate bases', active:true });
        }
      }
    });

    // Step 4: Additional materials (only if >1)
    if (materials.length > 1) {
      steps.push({
        title: '🪵 Step 4 — Additional material upcharges',
        sub: 'Same base cabinet spec, swap the material. Box only, no doors, no drawers.',
        content: () => {
          const blIdx = getBlIdx('mqph-bl-mat', wizardBaseline?.matIndex);
          const others = materials.filter((_,i) => i !== blIdx);
          return others.map((m,idx) => `
            <div class="mqph-item-block">
              <div class="mqph-item-block-label">📦 ${m.fields['Name']}</div>
              ${specBox([
                `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                `Material: <span class="mqph-spec-tag">${m.fields['Name']}</span> · No doors · No drawers · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-mat-${idx}" placeholder="0.00" oninput="mqphCalcUp('mat-${idx}')"/></div>
              <div id="mqph-r-mat-${idx}" class="mqph-result"></div>
            </div>`).join('');
        },
        skipLabel: 'Skip — same price for all materials',
        nextLabel: 'Next →',
        onNext: () => {
          const blIdx = getBlIdx('mqph-bl-mat', wizardBaseline?.matIndex);
          const others = materials.filter((_,i) => i !== blIdx);
          others.forEach((m,idx) => {
            const p = parseFloat(document.getElementById(`mqph-mat-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              wizardItems.push({ name:m.fields['Name'], category:'material', rate:Math.round(((p-wizardBaseline.basePrice)/4)*100)/100, unit:'per lin ft upcharge', description:'Material upcharge', active:true });
            }
          });
        }
      });
    }

    // Step 5: Baseline door style (with finish in name)
    steps.push({
      title: '🚪 Step 5 — Baseline door style pricing',
      sub: 'Now add doors. Quote baseline material + baseline door style + cheapest hinge.',
      content: () => {
        const matName  = wizardBaseline?.matName  != null ? wizardBaseline.matName  : (materials[getBlIdx('mqph-bl-mat',null)]?.fields['Name']  || '—');
        const doorName = wizardBaseline?.doorName != null ? wizardBaseline.doorName : (doorStyles[getBlIdx('mqph-bl-door',null)]?.fields['Name'] || '—');
        const hi = wizardBaseline?.hingeIndex ?? parseInt(document.getElementById('mqph-bl-hinge')?.value || '0');
        const hingeName = hinges[hi]?.fields['Name'] || 'your cheapest hinge';
        return `
          <div class="mqph-hl">Doors are priced as an upcharge on top of the box. The finish is already in your door name — e.g. "Maple shaker — stained & lacquered".</div>
          ${specBox([
            `<strong>Base cabinets + baseline door style (no drawers)</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `Door style: <span class="mqph-spec-tag">${doorName}</span> · <span class="mqph-spec-tag">3 doors: 2 on 30", 1 on 18"</span>`,
            `Hinges: <span class="mqph-spec-tag">${hingeName}</span> · No drawers · Supply only`,
          ])}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-door-baseline" placeholder="0.00" oninput="mqphCalcDoorBaseline()"/></div>
          <div id="mqph-r-door-baseline" class="mqph-result"></div>`;
      },
      nextLabel: 'Next →',
      onNext: () => {
        const p = parseFloat(document.getElementById('mqph-door-baseline')?.value||0);
        if (p>0&&wizardBaseline) {
          wizardBaseline.baseWithDoorPrice = p;
          const u = (p - wizardBaseline.basePrice) / 4;
          wizardItems.push({ name:wizardBaseline.doorName, category:'door', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'Baseline door style — reverse engineered', active:true });
          if (wizardBaseline.hingeName) {
            wizardItems.push({ name:wizardBaseline.hingeName, category:'hinge', rate:0, unit:'per lin ft upcharge', description:'Baseline hinge — included in door price', active:true });
          }
        }
      }
    });

    // Step 6: Additional door styles (only if >1)
    if (doorStyles.length > 1) {
      steps.push({
        title: '🚪 Step 6 — Additional door style upcharges',
        sub: 'Same spec, swap the door style. Keep baseline material and baseline hinge.',
        content: () => {
          const blIdx = getBlIdx('mqph-bl-door', wizardBaseline?.doorIndex);
          const matName  = wizardBaseline?.matName  != null ? wizardBaseline.matName  : (materials[getBlIdx('mqph-bl-mat',null)]?.fields['Name']  || '—');
          const hi = wizardBaseline?.hingeIndex ?? 0;
          const hingeName = hinges[hi]?.fields['Name'] || 'baseline hinge';
          const others = doorStyles.filter((_,i) => i !== blIdx);
          return others.map((d,idx) => `
            <div class="mqph-item-block">
              <div class="mqph-item-block-label">🚪 ${d.fields['Name']}</div>
              ${specBox([
                `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                `Material: <span class="mqph-spec-tag">${matName}</span> · Door: <span class="mqph-spec-tag">${d.fields['Name']}</span>`,
                `<span class="mqph-spec-tag">3 doors: 2 on 30", 1 on 18"</span> · Hinges: <span class="mqph-spec-tag">${hingeName}</span> · No drawers · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-door-${idx}" placeholder="0.00" oninput="mqphCalcDoorUp(${idx})"/></div>
              <div id="mqph-r-door-${idx}" class="mqph-result"></div>
            </div>`).join('');
        },
        skipLabel: 'Skip — same price for all door styles',
        nextLabel: 'Next →',
        onNext: () => {
          const blIdx = getBlIdx('mqph-bl-door', wizardBaseline?.doorIndex);
          const others = doorStyles.filter((_,i) => i !== blIdx);
          others.forEach((d,idx) => {
            const p = parseFloat(document.getElementById(`mqph-door-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              const u = (p - (wizardBaseline.baseWithDoorPrice||wizardBaseline.basePrice)) / 4;
              wizardItems.push({ name:d.fields['Name'], category:'door', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'Door style upcharge', active:true });
            }
          });
        }
      });
    }

    // Step 7: Hinge upcharges (only if >1)
    if (hinges.length > 1) {
      steps.push({
        title: '🔧 Step 7 — Hinge upcharges',
        sub: 'Same spec with baseline door — swap the hinge. Calculates upcharge over your baseline hinge.',
        content: () => {
          const blIdx = getBlIdx('mqph-bl-hinge', wizardBaseline?.hingeIndex);
          const matName  = wizardBaseline?.matName  != null ? wizardBaseline.matName  : (materials[getBlIdx('mqph-bl-mat',null)]?.fields['Name']  || '—');
          const doorName = wizardBaseline?.doorName != null ? wizardBaseline.doorName : (doorStyles[getBlIdx('mqph-bl-door',null)]?.fields['Name'] || '—');
          const blHingeName = hinges[wizardBaseline?.hingeIndex ?? 0]?.fields['Name'] || 'baseline hinge';
          const others = hinges.filter((_,i) => i !== blIdx);
          return others.map((h,idx) => `
            <div class="mqph-item-block">
              <div class="mqph-item-block-label">🔧 ${h.fields['Name']}</div>
              ${specBox([
                `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                `Material: <span class="mqph-spec-tag">${matName}</span> · Door: <span class="mqph-spec-tag">${doorName}</span>`,
                `Hinges: <span class="mqph-spec-tag">${h.fields['Name']}</span> (instead of ${blHingeName}) · No drawers · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price with ${h.fields['Name']}?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-hinge-${idx}" placeholder="0.00" oninput="mqphCalcHingeUp(${idx})"/></div>
              <div id="mqph-r-hinge-${idx}" class="mqph-result"></div>
            </div>`).join('');
        },
        skipLabel: 'Skip — only one hinge option',
        nextLabel: 'Next →',
        onNext: () => {
          const blIdx = getBlIdx('mqph-bl-hinge', wizardBaseline?.hingeIndex);
          const others = hinges.filter((_,i) => i !== blIdx);
          others.forEach((h,idx) => {
            const p = parseFloat(document.getElementById(`mqph-hinge-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              const u = (p - (wizardBaseline.baseWithDoorPrice||wizardBaseline.basePrice)) / 4;
              wizardItems.push({ name:h.fields['Name'], category:'hinge', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:`Hinge upcharge over ${wizardBaseline.hingeName}`, active:true });
            }
          });
        }
      });
    }

    // Step 8a: One-drawer upcharge (Quote B)
    if (drawers.length > 0) {
      steps.push({
        title: '🗄️ Step 8a — One drawer per cabinet',
        sub: 'Quote the same baseline box job but add 1 top drawer in each cabinet. No doors, no drawer fronts.',
        content: () => {
          const matName = wizardBaseline?.matName || materials[getBlIdx('mqph-bl-mat',null)]?.fields['Name'] || '—';
          return `
            <div class="mqph-hl">This gives us the "some drawers" pricing tier. Quote for each drawer configuration you offer.</div>
            ${drawers.map((d,idx) => `
              <div class="mqph-item-block">
                <div class="mqph-item-block-label">🗄️ ${d.fields['Name']}</div>
                ${specBox([
                  `<strong>Same baseline box + 1 top drawer in each cab</strong>`,
                  `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                  `Material: <span class="mqph-spec-tag">${matName}</span> · Drawers: <span class="mqph-spec-tag">${d.fields['Name']}</span>`,
                  `<strong>No doors · No drawer fronts · Supply only</strong>`,
                ])}
                <div class="mqph-input-row"><label>Your price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-drawer1-${idx}" placeholder="0.00" oninput="mqphCalcDrawer1(${idx})"/></div>
                <div id="mqph-r-drawer1-${idx}" class="mqph-result"></div>
              </div>`).join('')}`;
        },
        skipLabel: 'Skip drawers',
        nextLabel: 'Next →',
        onNext: () => {
          drawers.forEach((d,idx) => {
            const p = parseFloat(document.getElementById(`mqph-drawer1-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              const u = (p - wizardBaseline.basePrice) / 4;
              wizardItems.push({ name:d.fields['Name']+' — 1 drawer upcharge', category:'drawer', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'1-drawer upcharge (Quote B) — reverse engineered', active:true });
            }
          });
        }
      });

      // Step 8b: Full drawer bank upcharge (Quote C)
      steps.push({
        title: '🗄️ Step 8b — Full drawer bank',
        sub: 'Same spec but now quote a full drawer bank — 3 drawers in each cabinet. No doors, no drawer fronts.',
        content: () => {
          const matName = wizardBaseline?.matName || materials[getBlIdx('mqph-bl-mat',null)]?.fields['Name'] || '—';
          return `
            <div class="mqph-hl">This gives us the "mostly drawers" pricing tier. Same 30"+18" spec, full drawer bank, no doors.</div>
            ${drawers.map((d,idx) => `
              <div class="mqph-item-block">
                <div class="mqph-item-block-label">🗄️ ${d.fields['Name']}</div>
                ${specBox([
                  `<strong>Full drawer bank — 3 drawers in each cabinet</strong>`,
                  `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                  `Material: <span class="mqph-spec-tag">${matName}</span> · Drawers: <span class="mqph-spec-tag">${d.fields['Name']}</span>`,
                  `<strong>No doors · No drawer fronts · Supply only</strong>`,
                ])}
                <div class="mqph-input-row"><label>Your price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-drawer3-${idx}" placeholder="0.00" oninput="mqphCalcDrawer3(${idx})"/></div>
                <div id="mqph-r-drawer3-${idx}" class="mqph-result"></div>
              </div>`).join('')}`;
        },
        skipLabel: 'Skip',
        nextLabel: 'Next →',
        onNext: () => {
          drawers.forEach((d,idx) => {
            const p = parseFloat(document.getElementById(`mqph-drawer3-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              const u = (p - wizardBaseline.basePrice) / 4;
              wizardItems.push({ name:d.fields['Name']+' — bank upcharge', category:'drawer', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'Full drawer bank upcharge (Quote C) — reverse engineered', active:true });
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
        sub: 'Quote install-only prices for each scenario — no supply, just labour. We need separate rates for with and without doors since installing doors takes more time.',
        content: () => `
          <div class="mqph-hl">Use the same <span class="mqph-spec-tag">1 × 30"</span> + <span class="mqph-spec-tag">1 × 18"</span> = 4 lin ft spec for each quote below.</div>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1.25rem">
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🔼 Upper cabinets — install only</div>
            <div class="mqph-input-row">
              <label>4ft uppers, <strong>box only</strong> (no doors installed)</label>
              <span class="mqph-pfx">$</span>
              <input type="number" id="mqph-inst-u-nd" placeholder="0.00" oninput="mqphCalcInstall()"/>
            </div>
            <div class="mqph-input-row">
              <label>4ft uppers, <strong>with doors</strong> (hang & adjust doors too)</label>
              <span class="mqph-pfx">$</span>
              <input type="number" id="mqph-inst-u-wd" placeholder="0.00" oninput="mqphCalcInstall()"/>
            </div>
          </div>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1.25rem">
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🔽 Base cabinets — install only</div>
            <div class="mqph-input-row">
              <label>4ft bases, <strong>box only</strong> (no doors installed)</label>
              <span class="mqph-pfx">$</span>
              <input type="number" id="mqph-inst-b-nd" placeholder="0.00" oninput="mqphCalcInstall()"/>
            </div>
            <div class="mqph-input-row">
              <label>4ft bases, <strong>with doors</strong> (hang & adjust doors too)</label>
              <span class="mqph-pfx">$</span>
              <input type="number" id="mqph-inst-b-wd" placeholder="0.00" oninput="mqphCalcInstall()"/>
            </div>
          </div>

          <div id="mqph-r-install" class="mqph-result"></div>

          <div style="height:1px;background:#e5e7eb;margin:1.25rem 0"></div>
          <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🗑️ Cabinet removal</div>
          <div class="mqph-input-row">
            <label>Removal & disposal rate (per lin ft)</label>
            <span class="mqph-pfx">$</span>
            <input type="number" id="mqph-removal" placeholder="0.00"/>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin-bottom:1rem">What you charge per linear foot to remove and dispose of existing cabinets.</p>`,
        skipLabel: 'Skip — supply only shop',
        nextLabel: 'Next →',
        onNext: () => {
          const und=parseFloat(document.getElementById('mqph-inst-u-nd')?.value||0);
          const uwd=parseFloat(document.getElementById('mqph-inst-u-wd')?.value||0);
          const bnd=parseFloat(document.getElementById('mqph-inst-b-nd')?.value||0);
          const bwd=parseFloat(document.getElementById('mqph-inst-b-wd')?.value||0);
          const r=parseFloat(document.getElementById('mqph-removal')?.value||0);
          if (und>0) wizardItems.push({ name:'Install — uppers (no doors)', category:'install', rate:Math.round((und/4)*100)/100, unit:'per lin ft', description:'Upper box install, no doors', active:true });
          if (uwd>0) wizardItems.push({ name:'Install — uppers (with doors)', category:'install', rate:Math.round((uwd/4)*100)/100, unit:'per lin ft', description:'Upper install with doors hung', active:true });
          if (bnd>0) wizardItems.push({ name:'Install — bases (no doors)', category:'install', rate:Math.round((bnd/4)*100)/100, unit:'per lin ft', description:'Base box install, no doors', active:true });
          if (bwd>0) wizardItems.push({ name:'Install — bases (with doors)', category:'install', rate:Math.round((bwd/4)*100)/100, unit:'per lin ft', description:'Base install with doors hung', active:true });
          if (r>0) wizardItems.push({ name:'Cabinet removal', category:'install', rate:r, unit:'per lin ft', description:'Remove & dispose existing cabinets', active:true });
        }
      });
    }

    // Final: Travel zones & tax
    // Read any zones already set up in item setup
    const existingZones = getByCategory('zone').filter(z => !z.fields['Name']?.toLowerCase().includes('local'));
    steps.push({
      title: '🚗 Final step — Travel zones & tax',
      sub: 'Set your local delivery radius and flat-fee surcharges for jobs beyond it. Surcharges are per job — set them to roughly cover your fuel and travel time for a typical job in that area.',
      content: () => {
        const zoneRows = existingZones.length > 0
          ? existingZones.map((z,i) => `
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
              <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:0.75rem">📍 ${z.fields['Name'] || 'Zone '+(i+2)}</div>
              <div class="mqph-input-row">
                <label>Distance range (km) e.g. 16–50km</label>
                <input type="text" id="mqph-zone-range-${i}" placeholder="e.g. 16–50km" style="width:160px"/>
              </div>
              <div class="mqph-input-row">
                <label>Flat travel surcharge for this zone</label>
                <span class="mqph-pfx">$</span>
                <input type="number" id="mqph-zone-fee-${i}" placeholder="0.00"/>
              </div>
            </div>`).join('')
          : `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;font-size:13px;color:#856404;margin-bottom:1rem">
              No travel zones set up yet. You can add zones in "Edit shop items" after finishing the wizard, or skip this step.
            </div>`;
        return `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1.25rem">
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">📍 Local zone</div>
            <div class="mqph-input-row">
              <label>Local radius — no surcharge within this distance</label>
              <input type="number" id="mqph-zone-r" placeholder="15" style="width:130px;text-align:right"/>
              <span class="mqph-pfx">km</span>
            </div>
          </div>
          ${zoneRows}
          <div style="height:1px;background:#e5e7eb;margin:1.25rem 0"></div>
          <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🧾 Tax</div>
          <div class="mqph-input-row">
            <label>Tax rate applied to cabinet subtotal</label>
            <input type="number" id="mqph-tax" placeholder="5" style="width:130px;text-align:right"/>
            <span class="mqph-pfx">%</span>
          </div>`;
      },
      skipLabel: 'Skip',
      nextLabel: 'Finish setup →',
      onNext: () => {
        const gn=id=>parseFloat(document.getElementById(id)?.value||0);
        const gs=id=>document.getElementById(id)?.value||'';
        const zr=gn('mqph-zone-r'), tax=gn('mqph-tax');
        if (zr>0) wizardItems.push({ name:'Local zone radius', category:'zone', rate:zr, unit:'km', description:'Within this distance = no travel surcharge', active:true });
        existingZones.forEach((z,i) => {
          const fee=gn(`mqph-zone-fee-${i}`);
          const range=gs(`mqph-zone-range-${i}`);
          if (fee>0) {
            const desc = range ? `Travel surcharge — ${range}` : 'Travel surcharge';
            wizardItems.push({ name:z.fields['Name'], category:'zone', rate:fee, unit:'flat', description:desc, active:true });
          }
        });
        if (tax>0) wizardItems.push({ name:'Tax rate', category:'tax', rate:tax, unit:'%', description:'Applied to cabinet subtotal', active:true });
      }
    });

    return steps;
  }

  // ============================================================
  // CALC HELPERS
  // ============================================================
  window.mqphCalc = function(id) {
    const map = {
      'bl-u':{ inputId:'mqph-bl-u-price', resId:'mqph-r-bl-u', label:'Upper box rate', calc:p=>p/4 },
      'bl-b':{ inputId:'mqph-bl-b-price', resId:'mqph-r-bl-b', label:'Base box rate',  calc:p=>p/4 },
    };
    const cfg=map[id]; if(!cfg) return;
    const p=parseFloat(document.getElementById(cfg.inputId)?.value||0);
    const res=document.getElementById(cfg.resId); if(!res) return;
    if(p>0){res.style.display='block';res.innerHTML=`<strong>${cfg.label}:</strong> <span class="mqph-result-val">$${cfg.calc(p).toFixed(2)} / lin ft</span>`;}
    else res.style.display='none';
  };

  window.mqphCalcUp = function(id) {
    const input=document.getElementById(`mqph-${id}`);
    const res=document.getElementById(`mqph-r-${id}`);
    if(!input||!res||!wizardBaseline) return;
    const p=parseFloat(input.value||0);
    if(p>0){const u=(p-wizardBaseline.basePrice)/4;res.style.display='block';res.innerHTML=`<strong>Upcharge vs baseline box:</strong> <span class="mqph-result-val">$${u.toFixed(2)} / lin ft</span>`;}
    else res.style.display='none';
  };

  window.mqphCalcDoorBaseline = function() {
    const p=parseFloat(document.getElementById('mqph-door-baseline')?.value||0);
    const res=document.getElementById('mqph-r-door-baseline'); if(!res||!wizardBaseline) return;
    if(p>0){
      const u=(p-wizardBaseline.basePrice)/4;
      res.style.display='block';
      res.innerHTML=`<strong>Door upcharge:</strong> <span class="mqph-result-val">$${u.toFixed(2)} / lin ft</span><br/><span style="font-size:12px;color:#6b7280">Box $${wizardBaseline.baseRate.toFixed(2)} + door $${u.toFixed(2)} = $${(wizardBaseline.baseRate+u).toFixed(2)}/ft total</span>`;
    } else res.style.display='none';
  };

  window.mqphCalcDoorUp = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-door-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-door-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){const u=(p-(wizardBaseline.baseWithDoorPrice||wizardBaseline.basePrice))/4;res.style.display='block';res.innerHTML=`<strong>Upcharge vs baseline door:</strong> <span class="mqph-result-val">$${u.toFixed(2)} / lin ft</span>`;}
    else res.style.display='none';
  };

  window.mqphCalcHingeUp = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-hinge-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-hinge-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){const u=(p-(wizardBaseline.baseWithDoorPrice||wizardBaseline.basePrice))/4;res.style.display='block';res.innerHTML=`<strong>Hinge upcharge:</strong> <span class="mqph-result-val">$${u.toFixed(2)} / lin ft</span>`;}
    else res.style.display='none';
  };

  window.mqphCalcDrawer1 = function(idx) {
    const p = parseFloat(document.getElementById(`mqph-drawer1-${idx}`)?.value||0);
    const res = document.getElementById(`mqph-r-drawer1-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){const u=(p-wizardBaseline.basePrice)/4;res.style.display='block';res.innerHTML=`<strong>1-drawer upcharge:</strong> <span class="mqph-result-val">$${u.toFixed(2)} / lin ft</span>`;}
    else res.style.display='none';
  };

  window.mqphCalcDrawer3 = function(idx) {
    const p = parseFloat(document.getElementById(`mqph-drawer3-${idx}`)?.value||0);
    const res = document.getElementById(`mqph-r-drawer3-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){const u=(p-wizardBaseline.basePrice)/4;res.style.display='block';res.innerHTML=`<strong>Full bank upcharge:</strong> <span class="mqph-result-val">$${u.toFixed(2)} / lin ft</span>`;}
    else res.style.display='none';
  };

  window.mqphCalcInstall = function() {
    const und=parseFloat(document.getElementById('mqph-inst-u-nd')?.value||0);
    const uwd=parseFloat(document.getElementById('mqph-inst-u-wd')?.value||0);
    const bnd=parseFloat(document.getElementById('mqph-inst-b-nd')?.value||0);
    const bwd=parseFloat(document.getElementById('mqph-inst-b-wd')?.value||0);
    const res=document.getElementById('mqph-r-install'); if(!res) return;
    let html='';
    if(und>0) html+=`<strong>Uppers (no doors):</strong> <span class="mqph-result-val">$${(und/4).toFixed(2)} / lin ft</span><br/>`;
    if(uwd>0) html+=`<strong>Uppers (with doors):</strong> <span class="mqph-result-val">$${(uwd/4).toFixed(2)} / lin ft</span><br/>`;
    if(bnd>0) html+=`<strong>Bases (no doors):</strong> <span class="mqph-result-val">$${(bnd/4).toFixed(2)} / lin ft</span><br/>`;
    if(bwd>0) html+=`<strong>Bases (with doors):</strong> <span class="mqph-result-val">$${(bwd/4).toFixed(2)} / lin ft</span>`;
    if(html){res.style.display='block';res.innerHTML=html;}else res.style.display='none';
  };

  // ============================================================
  // WIZARD NAV
  // ============================================================
  function getSteps() { return buildWizardSteps(); }

  // Store input values so Back button can restore them
  const wizardSavedInputs = {};
  function saveCurrentInputs() {
    document.querySelectorAll('.mqph-wizard-body input, .mqph-wizard-body select').forEach(el => { if(el.id) wizardSavedInputs[el.id] = el.value; });
  }
  function restoreSavedInputs() {
    Object.entries(wizardSavedInputs).forEach(([id, val]) => { const el = document.getElementById(id); if(el) el.value = val; });
  }

  function renderWizardStep(idx) {
    saveCurrentInputs();
    const steps=getSteps();
    const activeEl=document.getElementById(`mqph-step-${idx}`);
    if(activeEl){
      activeEl.innerHTML=`<div class="mqph-step-title">${steps[idx].title}</div><div class="mqph-step-sub">${steps[idx].sub}</div>${steps[idx].content()}`;
    }
    restoreSavedInputs();
    steps.forEach((_,i)=>{const el=document.getElementById(`mqph-step-${i}`);if(el)el.classList.toggle('active',i===idx);});
    const dots=document.querySelectorAll('.mqph-progress .dot');
    dots.forEach((d,i)=>{d.classList.remove('done','active');if(i<idx)d.classList.add('done');else if(i===idx)d.classList.add('active');});
    const back=document.getElementById('mqph-back-btn');
    const next=document.getElementById('mqph-next-btn');
    const skip=document.getElementById('mqph-skip-btn');
    if(back) back.style.display=idx===0?'none':'inline-block';
    if(next){if(steps[idx].nextLabel){next.textContent=steps[idx].nextLabel;next.style.display='inline-block';}else next.style.display='none';}
    if(skip){skip.style.display=steps[idx].skipLabel?'inline-block':'none';if(steps[idx].skipLabel)skip.textContent=steps[idx].skipLabel;}
  }

  window.mqphNext=function(){console.log("mqphNext: step",wizardStep,"wizardBaseline before onNext:",JSON.stringify(wizardBaseline));
    const steps=getSteps();
    const result=steps[wizardStep].onNext?steps[wizardStep].onNext():null;
    if(result==='abort'){loadAndRender();return;}
    wizardStep++;console.log("mqphNext: after onNext wizardBaseline:",JSON.stringify(wizardBaseline));
    if(wizardStep>=steps.length){mqphFinishWizard();}else{renderWizardStep(wizardStep);}
  };
  window.mqphBack=function(){if(wizardStep>0){wizardStep--;renderWizardStep(wizardStep);}};
  window.mqphSkip=function(){wizardStep++;const steps=getSteps();if(wizardStep>=steps.length){mqphFinishWizard();}else{renderWizardStep(wizardStep);}};

  async function mqphFinishWizard() {
    const container=document.getElementById('mq-pricing-helper-v2');
    if(container) container.innerHTML='<div style="padding:3rem;text-align:center;color:#6b7280;font-size:14px">Saving your pricing...</div>';
    const rateCategories=['zone','tax'];
    const toDelete=lineItems.filter(r=>r.fields&&rateCategories.includes(r.fields['Category']));
    for(const r of toDelete){await atDelete(LINE_ITEMS_TABLE,r.id);}
    for(let i=0;i<wizardItems.length;i++){
      const item=wizardItems[i];
      const existing=lineItems.find(r=>r.fields&&r.fields['Name']===item.name&&!rateCategories.includes(r.fields['Category']));
      if(existing){await atUpdate(LINE_ITEMS_TABLE,existing.id,{Rate:item.rate,Unit:item.unit,Description:item.description,Active:true});}
      else{await atCreate(LINE_ITEMS_TABLE,{shop:[shopRecord._recordId],Name:item.name,Category:item.category,Rate:item.rate,Unit:item.unit,Description:item.description||'',Active:true,'Sort order':i+1});}
    }
    await loadAndRender();
  }

  function buildWizardHTML() {
    const steps=getSteps();
    const dots=steps.map(()=>`<div class="dot"></div>`).join('');
    const stepDivs=steps.map((s,i)=>`<div class="mqph-step ${i===0?'active':''}" id="mqph-step-${i}"></div>`).join('');
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
    const groups={};
    lineItems.filter(r=>r.fields).forEach(r=>{const c=r.fields['Category']||'other';if(!groups[c])groups[c]=[];groups[c].push(r);});
    const hasItems=lineItems.filter(r=>r.fields).length>0;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem">
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px">⚙️ Pricing Setup</h2>
          <p style="font-size:13px;color:#6b7280">Manage your rates — changes update your widget immediately.</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="mqph-btn mqph-btn-secondary" onclick="mqphStartItemSetup()">🛠️ Edit shop items</button>
          <button class="mqph-btn mqph-btn-secondary" onclick="mqphGoToWizard()">🧙 Run pricing wizard</button>
          <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDeleteAll()" title="Delete all pricing items and start fresh">🗑️ Start fresh</button>
        </div>
      </div>
      ${!hasItems?`
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:3rem;text-align:center;margin-bottom:1.5rem">
          <div style="font-size:32px;margin-bottom:12px">⚙️</div>
          <div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px">No pricing set up yet</div>
          <div style="font-size:13px;color:#6b7280;margin-bottom:1.5rem">Start by setting up your shop items, then run the pricing wizard.</div>
          <button class="mqph-btn mqph-btn-primary" onclick="mqphStartItemSetup()">Set up shop items →</button>
        </div>`:`
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
            <div class="mqph-field"><label>Name</label><input type="text" id="mqph-item-name" placeholder="e.g. Maple shaker — stained & lacquered"/></div>
            <div class="mqph-field"><label>Category</label>
              <select id="mqph-item-cat">${Object.entries(CAT_LABELS).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
            </div>
            <div class="mqph-field"><label>Rate ($)</label><input type="number" id="mqph-item-rate" placeholder="0.00" step="0.01"/></div>
            <div class="mqph-field"><label>Unit</label>
              <select id="mqph-item-unit">
                <option>per lin ft</option><option>per lin ft — uppers</option><option>per lin ft — bases</option>
                <option>per lin ft upcharge</option><option>flat</option><option>each</option><option>%</option><option>km</option>
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

  window.mqphSaveLocalRadius = async function() {
    const val = parseFloat(document.getElementById('mqph-local-radius')?.value || 15);
    const existing = lineItems.find(r => r.fields && r.fields['Name']?.toLowerCase().includes('local') && r.fields['Category'] === 'zone');
    if (existing) {
      await atUpdate(LINE_ITEMS_TABLE, existing.id, { 'Rate': val, 'Description': 'Within this distance = no travel surcharge' });
      existing.fields['Rate'] = val;
    } else {
      const rec = await atCreate(LINE_ITEMS_TABLE, { 'shop':[shopRecord._recordId], 'Name':'Local zone radius', 'Category':'zone', 'Rate':val, 'Unit':'km', 'Description':'Within this distance = no travel surcharge', 'Active':true, 'Sort order':0 });
      if (rec && rec.id) lineItems.push(rec);
    }
    const saved = document.getElementById('mqph-local-radius-saved');
    if (saved) { saved.style.display = 'inline'; setTimeout(() => saved.style.display = 'none', 2000); }
  };

  window.mqphStartItemSetup = async function() {
    const hasHinge  =lineItems.filter(r=>r.fields).some(r=>r.fields['Category']==='hinge');
    const hasInstall=lineItems.filter(r=>r.fields).some(r=>r.fields['Category']==='install');
    if(!hasHinge){for(let i=0;i<DEFAULT_HINGES.length;i++){const rec=await atCreate(LINE_ITEMS_TABLE,{shop:[shopRecord._recordId],Name:DEFAULT_HINGES[i],Category:'hinge',Rate:0,Unit:'per lin ft upcharge',Active:true,'Sort order':i+1});if(rec&&rec.id)lineItems.push(rec);}}
    if(!hasInstall){for(let i=0;i<DEFAULT_INSTALL.length;i++){const rec=await atCreate(LINE_ITEMS_TABLE,{shop:[shopRecord._recordId],Name:DEFAULT_INSTALL[i].name,Category:'install',Rate:0,Unit:DEFAULT_INSTALL[i].unit,Description:DEFAULT_INSTALL[i].description,Active:true,'Sort order':i+1});if(rec&&rec.id)lineItems.push(rec);}}
    const container=document.getElementById('mq-pricing-helper-v2');
    if(container) container.innerHTML=buildItemSetupHTML();
  };

  window.mqphOpenAdd=function(cat){
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

  window.mqphOpenEdit=function(id){
    const rec=lineItems.find(r=>r.id===id);if(!rec)return;
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
    const fields={shop:[shopRecord._recordId],Name:name,Category:document.getElementById('mqph-item-cat').value,Rate:parseFloat(document.getElementById('mqph-item-rate').value||0),Unit:document.getElementById('mqph-item-unit').value,Description:document.getElementById('mqph-item-desc').value.trim(),Active:document.getElementById('mqph-item-active').checked};
    try{if(currentEditId){await atUpdate(LINE_ITEMS_TABLE,currentEditId,fields);}else{fields['Sort order']=lineItems.length+1;await atCreate(LINE_ITEMS_TABLE,fields);}mqphCloseModal();await loadAndRender();}
    catch(e){alert('Error saving. Please try again.');}
  };

  window.mqphDeleteAll = async function() {
    if (!confirm('Delete ALL pricing items and start fresh? This cannot be undone.')) return;
    const container = document.getElementById('mq-pricing-helper-v2');
    if (container) container.innerHTML = '<div style="padding:3rem;text-align:center;color:#6b7280;font-size:14px">Deleting all items...</div>';
    for (const r of lineItems) { try { await atDelete(LINE_ITEMS_TABLE, r.id); } catch(e) {} }
    lineItems = [];
    await loadAndRender();
  };

  window.mqphDelete=async function(id){if(!confirm('Delete this item?'))return;try{await atDelete(LINE_ITEMS_TABLE,id);await loadAndRender();}catch(e){alert('Error deleting.');}};

  window.mqphToggle=async function(id,el){
    const rec=lineItems.find(r=>r.id===id);if(!rec)return;
    const val=!rec.fields['Active'];el.classList.toggle('on',val);rec.fields['Active']=val;
    await atUpdate(LINE_ITEMS_TABLE,id,{Active:val});
  };

  // ============================================================
  // COUNTERTOP DIRECT ENTRY
  // ============================================================
  function buildCTHtml(p){
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
      if(pricingRecord)await fetch(`${AT_BASE_URL()}/${shopRecord._pricingTable}/${pricingRecord.id}`,{method:'PATCH',headers:AT_HEADS(),body:JSON.stringify({fields})});
      const msg=document.getElementById('mqph-ct-msg');
      if(msg){msg.textContent='✓ Saved!';msg.className='mqph-msg mqph-msg-success';msg.style.display='block';setTimeout(()=>msg.style.display='none',3000);}
    }catch(e){const msg=document.getElementById('mqph-ct-msg');if(msg){msg.textContent='Error saving.';msg.className='mqph-msg mqph-msg-error';msg.style.display='block';}}
  };

  // ============================================================
  // LOAD AND RENDER
  // ============================================================
  async function loadAndRender(){
    const container=document.getElementById('mq-pricing-helper-v2');
    if(!container) return;
    const recs=await atGet(LINE_ITEMS_TABLE,`FIND("${shopRecord._shopName}", ARRAYJOIN({shop}))`);
    lineItems=recs.filter(r=>r.fields);
    container.innerHTML=buildEditorHTML();
  }

  window.loadAndRender=loadAndRender;

  // ============================================================
  // INIT
  // ============================================================
  window.mqph2Init=function(passedShopRecord,passedPricingRecord){
    if(!passedShopRecord) return;
    shopRecord={...passedShopRecord,_recordId:passedShopRecord.id,_shopName:(passedShopRecord.fields&&passedShopRecord.fields['Shop name'])||'',_baseId:'app4zrMlVLwF2xn4h',_token:'patulbU1ndSvFpMDo.906a8be9e784fb12de048d4238c5d553859f8d57670ccd1bc1a6de4e2da37325',_pricingTable:'tblu6AYZs8h7SIaQl'};
    pricingRecord=passedPricingRecord;
    injectStyles();
    loadAndRender();
  };

})();