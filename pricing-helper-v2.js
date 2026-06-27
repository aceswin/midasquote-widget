/*
 * MidasQuote Pricing Helper v4.5
 * - Full wipe+rewrite on wizard finish (no duplicates)
 * - Mini reverse-engineering wizard for adding individual items (no raw rate entry)
 * - Clean, consistent UI throughout
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

  // Mini-wizard state
  let miniWiz = { cat: null, name: '', step: 0 };

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

      /* ── Buttons ── */
      .mqph-btn{padding:10px 20px !important;font-size:13px !important;font-weight:600 !important;border-radius:8px !important;cursor:pointer !important;border:none !important;font-family:inherit !important;transition:all 0.15s !important;line-height:1.2 !important}
      .mqph-btn-primary{background:#1a1a1a !important;color:#fff !important}.mqph-btn-primary:hover{opacity:0.88 !important}
      .mqph-btn-secondary{background:#fff !important;color:#111 !important;border:1px solid #e5e7eb !important}.mqph-btn-secondary:hover{background:#f9fafb !important}
      .mqph-btn-danger{background:#fff !important;color:#dc2626 !important;border:1px solid #fca5a5 !important}.mqph-btn-danger:hover{background:#fef2f2 !important}
      .mqph-btn-sm{padding:5px 12px !important;font-size:12px !important}
      .mqph-btn-ghost{background:none !important;border:none !important;color:#6b7280 !important;font-size:13px !important;cursor:pointer !important;font-family:inherit !important;padding:4px 0 !important}
      .mqph-btn-ghost:hover{color:#111 !important}

      /* ── Item setup chips ── */
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

      /* ── Wizard ── */
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

      /* ── Callout boxes ── */
      .mqph-hl{background:#f0fdf4 !important;border:1px solid #86efac !important;border-radius:8px !important;padding:12px 16px !important;margin-bottom:1.25rem !important;font-size:13px !important;color:#166534 !important;line-height:1.7 !important}
      .mqph-warn{background:#fef9c3 !important;border:1px solid #fde047 !important;border-radius:8px !important;padding:12px 16px !important;font-size:13px !important;color:#854d0e !important;margin-bottom:1rem !important;line-height:1.6 !important}
      .mqph-info{background:#eff6ff !important;border:1px solid #bfdbfe !important;border-radius:8px !important;padding:12px 16px !important;font-size:13px !important;color:#1e40af !important;margin-bottom:1.25rem !important;line-height:1.7 !important}
      .mqph-spec-box{background:#f9fafb !important;border:1px solid #e5e7eb !important;border-radius:8px !important;padding:12px 16px !important;margin-bottom:1.25rem !important;font-size:13px !important;color:#374151 !important;line-height:1.8 !important}
      .mqph-spec-box strong{color:#111 !important}
      .mqph-spec-tag{display:inline-block !important;background:#fff !important;border:1px solid #e5e7eb !important;border-radius:6px !important;padding:2px 8px !important;font-size:12px !important;font-weight:600 !important;color:#374151 !important;margin:2px 3px 2px 0 !important}

      /* ── Inputs ── */
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

      /* ── Editor pricing list ── */
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

      /* ── Overlays & modals ── */
      .mqph-overlay{display:none !important;position:fixed !important;inset:0 !important;background:rgba(0,0,0,0.5) !important;z-index:9999 !important;align-items:center !important;justify-content:center !important;padding:1rem !important}
      .mqph-overlay.show{display:flex !important}
      .mqph-modal{background:#fff !important;border-radius:12px !important;width:100% !important;max-width:520px !important;max-height:90vh !important;overflow-y:auto !important;box-shadow:0 20px 60px rgba(0,0,0,0.2) !important}
      .mqph-modal-hdr{padding:1.25rem 1.5rem !important;border-bottom:1px solid #e5e7eb !important;display:flex !important;align-items:flex-start !important;justify-content:space-between !important;gap:12px !important}
      .mqph-modal-hdr h3{font-size:16px !important;font-weight:700 !important;color:#111 !important;margin:0 !important;padding:0 !important}
      .mqph-modal-hdr p{font-size:13px !important;color:#6b7280 !important;margin:4px 0 0 !important;padding:0 !important;line-height:1.5 !important}
      .mqph-mini-hdr h3{color:#fff !important}
      .mqph-mini-hdr p{color:rgba(255,255,255,0.65) !important}
      .mqph-modal-hdr-close{background:none !important;border:none !important;font-size:20px !important;color:#9ca3af !important;cursor:pointer !important;line-height:1 !important;padding:0 !important;margin:0 !important;flex-shrink:0 !important}.mqph-modal-hdr-close:hover{color:#374151 !important}
      .mqph-modal-body{padding:1.5rem !important}
      .mqph-modal-footer{padding:1rem 1.5rem !important;border-top:1px solid #e5e7eb !important;display:flex !important;gap:10px !important;align-items:center !important;background:#f9fafb !important}

      @media (max-width: 640px) {
        .mqph-row{flex-wrap:wrap !important;gap:6px !important;padding:12px !important}
        .mqph-row-name{flex:1 1 100% !important;order:1 !important}
        .mqph-row-desc{flex:1 1 100% !important;order:2 !important}
        .mqph-row-rate{order:3 !important;min-width:0 !important;text-align:left !important;flex:0 0 auto !important}
        .mqph-row-unit{order:4 !important;min-width:0 !important;text-align:left !important;flex:0 0 auto !important}
        .mqph-row .mqph-toggle{order:5 !important;margin-left:auto !important}
        .mqph-row button{order:6 !important}
        .mqph-cat-header{flex-wrap:wrap !important;gap:8px !important}
        .mqph-modal{max-width:100% !important;width:100% !important;height:100% !important;max-height:100% !important;border-radius:0 !important}
        .mqph-overlay{padding:0 !important}
      }

      /* ── Mini-wizard steps ── */
      .mqph-mini-step{display:none !important}.mqph-mini-step.active{display:block !important}
      .mqph-name-input{font-family:inherit !important;font-size:15px !important;font-weight:600 !important;color:#111 !important;background:#fff !important;border:1.5px solid #d1d5db !important;border-radius:8px !important;padding:10px 14px !important;width:100% !important;margin-bottom:1.25rem !important}
      .mqph-name-input:focus{outline:none !important;border-color:#1a1a1a !important}
      .mqph-price-input-wrap{display:flex !important;align-items:center !important;gap:8px !important;margin-bottom:8px !important}
      .mqph-price-input-wrap .mqph-pfx{font-size:22px !important;color:#9ca3af !important;font-weight:300 !important}
      .mqph-price-input-big{font-family:inherit !important;font-size:28px !important;font-weight:700 !important;color:#111 !important;background:#fff !important;border:none !important;border-bottom:2px solid #d1d5db !important;padding:4px 0 !important;width:180px !important;outline:none !important}
      .mqph-price-input-big:focus{border-bottom-color:#1a1a1a !important}
      .mqph-calc-hint{font-size:12px !important;color:#9ca3af !important;margin-bottom:1.25rem !important;padding:0 !important}
      .mqph-rate-reveal{background:#f0fdf4 !important;border:1px solid #86efac !important;border-radius:8px !important;padding:14px 16px !important;margin-bottom:1.25rem !important;display:none !important}
      .mqph-rate-reveal-val{font-size:22px !important;font-weight:700 !important;color:#16a34a !important}
      .mqph-rate-reveal-lbl{font-size:12px !important;color:#6b7280 !important;margin-top:2px !important}

      /* ── Edit modal fields ── */
      .mqph-field{display:flex !important;flex-direction:column !important;gap:5px !important;margin-bottom:1rem !important;padding:0 !important}
      .mqph-field label{font-size:12px !important;font-weight:600 !important;color:#374151 !important;text-transform:uppercase !important;letter-spacing:0.04em !important;margin:0 !important;padding:0 !important}
      .mqph-field input,.mqph-field select,.mqph-field textarea{font-family:inherit !important;font-size:13px !important;color:#111 !important;background:#fff !important;border:1px solid #d1d5db !important;border-radius:8px !important;padding:8px 10px !important;width:100% !important}
      .mqph-field input:focus,.mqph-field select:focus{outline:none !important;border-color:#1a1a1a !important}
      .mqph-field textarea{resize:vertical !important;min-height:60px !important}
      .mqph-msg{padding:10px 14px !important;border-radius:8px !important;font-size:13px !important;margin-bottom:1rem !important;display:none !important}
      .mqph-msg-success{background:#dcfce7 !important;color:#166534 !important;border:1px solid #86efac !important}
      .mqph-msg-error{background:#fee2e2 !important;color:#991b1b !important;border:1px solid #fca5a5 !important}

      /* ── Countertop block ── */
      .mqph-ct-block{background:#fff !important;border:1px solid #e5e7eb !important;border-radius:12px !important;margin-bottom:1.25rem !important;overflow:hidden !important}
      .mqph-ct-row{display:flex !important;align-items:center !important;gap:10px !important;padding:10px 16px !important;border-bottom:1px solid #f3f4f6 !important}
      .mqph-ct-row:last-child{border-bottom:none !important}
      .mqph-ct-label{flex:1 !important;font-size:13px !important;color:#374151 !important;font-weight:500 !important;padding:0 !important;margin:0 !important}
      .mqph-ct-inp{display:flex !important;align-items:center !important;gap:6px !important}
      .mqph-ct-inp span{font-size:13px !important;color:#6b7280 !important}
      .mqph-ct-inp input{width:90px !important;text-align:right !important;font-family:inherit !important;font-size:13px !important;color:#111 !important;background:#fff !important;border:1px solid #d1d5db !important;border-radius:8px !important;padding:7px 10px !important}
      .mqph-ct-inp input:focus{outline:none !important;border-color:#1a1a1a !important}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // CATEGORY CONFIG
  // ============================================================
  const CATEGORIES = [
    { id:'material', label:'🪵 Box materials',          sub:'The material used to build the cabinet boxes (e.g. White melamine, Prefinished birch plywood, Painted MDF)', placeholder:'e.g. White melamine' },
    { id:'door',     label:'🚪 Door styles',             sub:'Include the finish in the name — each door+finish combo is a separate item (e.g. "Maple shaker — stained & lacquered", "MDF slab — painted")', placeholder:'e.g. Maple shaker — stained & lacquered' },
    { id:'drawer',   label:'🗄️ Drawer configurations',  sub:'Combine box material + slide type in the name (e.g. "Prefinished birch — soft-close undermount")', placeholder:'e.g. Prefinished birch — soft-close undermount' },
    { id:'hinge',    label:'🔧 Door hinges',             sub:'Hinge options you offer — your cheapest hinge is the baseline, others become upcharges', placeholder:'e.g. Concealed hinge' },

  ];

  const CAT_LABELS = {
    material:'🪵 Box materials', door:'🚪 Door styles', drawer:'🗄️ Drawer configurations',
    hinge:'🔧 Door hinges', install:'🔧 Installation & removal',
    zone:'🚗 Travel zones', tax:'🧾 Tax', other:'📋 Other',
    trim:'👑 Crown moulding / valance',
  };

  // Categories fully owned by the wizard — wiped on every full wizard run
  const WIZARD_OWNED_CATEGORIES = ['material','door','drawer','hinge','install','tax'];

  // Categories where "+ Add" opens the mini reverse-engineering wizard instead of raw form
  const MINI_WIZ_CATS = ['material','door','drawer','hinge'];

  const DEFAULT_INSTALL = [
    { name:'Install — uppers (no doors)',   unit:'per lin ft', description:'Upper box install rate, no doors' },
    { name:'Install — uppers (with doors)', unit:'per lin ft', description:'Upper install rate with doors hung' },
    { name:'Install — bases (no doors)',    unit:'per lin ft', description:'Base box install rate, no doors' },
    { name:'Install — bases (with doors)',  unit:'per lin ft', description:'Base install rate with doors hung' },
    { name:'Cabinet removal',               unit:'per lin ft', description:'Remove & dispose existing cabinets' },
  ];
  const DEFAULT_HINGES = ['Soft-close hinges','Regular hinges'];

  // ============================================================
  // HELPERS
  // ============================================================
  function getByCategory(cat) {
    return lineItems.filter(r => r.fields && r.fields['Category'] === cat && r.fields['Active'] !== false)
      .sort((a,b) => (a.fields['Sort order']||0)-(b.fields['Sort order']||0));
  }

  // Derive baseline rates from existing lineItems for mini-wizard math
  function getBaselineRates() {
    const materials = getByCategory('material');
    const doors     = getByCategory('door');
    const hinges    = getByCategory('hinge');

    // Baseline material = first material (Sort order 1 = set in wizard as baseline)
    const blMatName = materials[0]?.fields['Name']?.replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim() || '';

    // Find uppers + bases rates for baseline material
    const blUpperRec = lineItems.find(r => r.fields &&
      r.fields['Category']==='material' &&
      r.fields['Name']?.replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim() === blMatName &&
      r.fields['Unit']?.includes('uppers'));
    const blBaseRec = lineItems.find(r => r.fields &&
      r.fields['Category']==='material' &&
      r.fields['Name']?.replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim() === blMatName &&
      r.fields['Unit']?.includes('bases'));

    const blUpperRate = blUpperRec?.fields['Rate'] || 0;
    const blBaseRate  = blBaseRec?.fields['Rate']  || 0;

    // Baseline door = first door style (Sort order 1)
    const blDoor     = doors[0];
    const blDoorRate = blDoor?.fields['Rate'] || 0;
    const blDoorName = blDoor?.fields['Name'] || '';

    // Baseline hinge = first hinge (rate 0)
    const blHinge     = hinges[0];
    const blHingeName = blHinge?.fields['Name'] || '';

    return { blMatName, blUpperRate, blBaseRate, blUpperPrice:blUpperRate*4, blBasePrice:blBaseRate*4, blDoorName, blDoorRate, blHingeName };
  }

  function specBox(lines) {
    return `<div class="mqph-spec-box">${lines.map(l=>`<div>${l}</div>`).join('')}</div>`;
  }

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
        <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:6px">🛠️ Set up your shop items</h2>
        <p style="font-size:13px;color:#6b7280;line-height:1.6">Add everything your shop offers. Just names for now — pricing is figured out in the wizard.</p>
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

      <!-- Local delivery zone — standalone, no chip input -->
      <div class="mqph-setup-card">
        <div class="mqph-setup-header">
          <div class="mqph-setup-title">📍 Local delivery zone</div>
          <div class="mqph-setup-sub">Define the radius within which you deliver at no extra travel charge. Any delivery cost within this area should already be factored into your regular pricing. Jobs outside this radius will show a note on the quote that travel charges may apply — you can confirm the exact amount when you follow up with the customer.</div>
        </div>
        <div style="padding:14px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="font-size:13px;color:#374151;font-weight:500">Local radius:</label>
          <input type="number" id="mqph-local-radius" value="${(existing['zone']||[]).find(r=>r.fields['Name']?.toLowerCase().includes('local'))?.fields['Rate'] || 15}" style="width:90px;text-align:right;font-family:inherit;font-size:14px;font-weight:600;color:#111;background:#fff;border:1.5px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
          <span style="font-size:13px;color:#6b7280;font-weight:500">km</span>
          <button onclick="mqphSaveLocalRadius()" style="background:#1a1a1a;color:#fff;border:none;border-radius:8px;padding:7px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save</button>
          <span id="mqph-local-radius-saved" style="font-size:12px;color:#16a34a;display:none">✓ Saved</span>
        </div>
      </div>

      <div class="mqph-setup-card">
        <div class="mqph-setup-header">
          <div class="mqph-setup-title">🔧 Installation & removal</div>
          <div class="mqph-setup-sub">Pre-added — rates are set in the wizard. Delete any you don't offer. Supply-only shop? Delete all.</div>
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
      'shop':[shopRecord._recordId], 'Name':name, 'Category':cat,
      'Rate':0, 'Unit':'per lin ft', 'Active':true, 'Sort order':sortMax,
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
  // WIZARD STEPS
  // ============================================================
  function buildWizardSteps() {
    const materials  = getByCategory('material');
    const doorStyles = getByCategory('door');
    const drawers    = getByCategory('drawer');
    const hinges     = getByCategory('hinge');
    const noMats  = materials.length === 0;
    const noDoors = doorStyles.length === 0;

    const matOpts   = materials.map((m,i)  => `<option value="${i}">${m.fields['Name']}</option>`).join('');
    const doorOpts  = doorStyles.map((d,i) => `<option value="${i}">${d.fields['Name']}</option>`).join('');
    const hingeOpts = hinges.map((h,i)     => `<option value="${i}">${h.fields['Name']}</option>`).join('');

    const steps = [];

    // Step 0: Welcome
    steps.push({
      title:'👋 Pricing Setup Wizard',
      sub:`We'll reverse-engineer your rates from real job quotes using a consistent spec throughout — no math required.`,
      content:() => noMats||noDoors ? `
        <div class="mqph-warn">⚠️ <strong>Missing items.</strong> You need to add ${noMats?'box materials':''}${noMats&&noDoors?' and ':''}${noDoors?'door styles':''} before running the wizard.</div>
        <button class="mqph-btn mqph-btn-primary" style="margin-top:10px" onclick="mqphStartItemSetup()">← Add shop items first</button>` : `
        <div class="mqph-hl">
          ✅ Found <strong>${materials.length}</strong> material${materials.length!==1?'s':''}, <strong>${doorStyles.length}</strong> door style${doorStyles.length!==1?'s':''}, <strong>${drawers.length}</strong> drawer config${drawers.length!==1?'s':''}, <strong>${hinges.length}</strong> hinge${hinges.length!==1?'s':''}.<br/><br/>
          <strong>Every step uses the same spec:</strong>&nbsp;
          <span class="mqph-spec-tag">1 × 30" cabinet</span> + <span class="mqph-spec-tag">1 × 18" cabinet</span> = <span class="mqph-spec-tag">4 linear feet</span>
        </div>
        <div style="font-size:13px;color:#374151;line-height:1.9;margin-bottom:1.25rem">
          ✅ Box-only baseline (no doors, no drawers)<br/>
          ✅ Door styles as upcharges (finish included in name)<br/>
          ✅ Drawer configurations as upcharges<br/>
          ✅ Separate upper and base rates<br/>
          ✅ Installation and removal rates
        </div>
        <div class="mqph-warn">⚠️ <strong>Running the wizard replaces all existing pricing.</strong> Specialty items, countertop rates, and crown/valance rates are not affected.</div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;color:#374151">Need to add or change your shop items first?</span>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphStartItemSetup()">🛠️ Edit shop items</button>
        </div>`,
      nextLabel: noMats||noDoors ? null : 'Start →',
      onNext: () => noMats||noDoors ? 'abort' : null,
    });

    // Step 1: Choose baseline
    steps.push({
      title:'📐 Step 1 — Choose your baseline',
      sub:'Pick your cheapest options. Everything else will be calculated as an upcharge from these.',
      content:() => `
        <div class="mqph-hl">Baseline = your cheapest material + cheapest door style + cheapest hinge.</div>
        <div class="mqph-input-row"><label>Baseline box material</label><select id="mqph-bl-mat" style="width:260px">${matOpts}</select></div>
        <div class="mqph-input-row"><label>Baseline door style <span style="font-weight:400;color:#9ca3af">(used in door pricing steps)</span></label><select id="mqph-bl-door" style="width:260px">${doorOpts}</select></div>
        ${hinges.length>0?`<div class="mqph-input-row"><label>Cheapest hinge <span style="font-weight:400;color:#9ca3af">(others become upcharges)</span></label><select id="mqph-bl-hinge" style="width:260px">${hingeOpts}</select></div>`:''}`,
      nextLabel:'Next →',
      onNext:() => {
        const mi = parseInt(document.getElementById('mqph-bl-mat')?.value||'0');
        const di = parseInt(document.getElementById('mqph-bl-door')?.value||'0');
        const hi = parseInt(document.getElementById('mqph-bl-hinge')?.value||'0');
        wizardBaseline = {
          matIndex:mi, matName:materials[mi]?.fields['Name']||'',
          doorIndex:di, doorName:doorStyles[di]?.fields['Name']||'',
          hingeIndex:hi, hingeName:hinges[hi]?.fields['Name']||'',
          upperPrice:0, basePrice:0, upperRate:0, baseRate:0, baseWithDoorPrice:0,
        };
      }
    });

    // Step 2: Baseline uppers
    steps.push({
      title:'📐 Step 2 — Baseline upper cabinets (box only)',
      sub:'Quote this exact job in your software:',
      content:() => {
        const matName = wizardBaseline?.matName || materials[0]?.fields['Name'] || '—';
        return `
          ${specBox([
            `<strong>Upper cabinets — box only, no doors, no drawers</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" upper</span> + <span class="mqph-spec-tag">1 × 18" upper</span> = 4 lin ft`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `<strong>No doors · No drawers · No hardware · Supply only · Local delivery</strong>`,
          ])}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-bl-u-price" placeholder="0.00" oninput="mqphCalc('bl-u')"/></div>
          <div id="mqph-r-bl-u" class="mqph-result"></div>`;
      },
      nextLabel:'Next →',
      onNext:() => {
        const p = parseFloat(document.getElementById('mqph-bl-u-price')?.value||0);
        if (p>0&&wizardBaseline) {
          wizardBaseline.upperPrice=p; wizardBaseline.upperRate=p/4;
          wizardItems.push({ name:wizardBaseline.matName+' — uppers', category:'material', rate:Math.round(wizardBaseline.upperRate*100)/100, unit:'per lin ft — uppers', description:'Baseline box rate uppers', active:true });
        }
      }
    });

    // Step 3: Baseline bases
    steps.push({
      title:'📐 Step 3 — Baseline base cabinets (box only)',
      sub:'Same spec, bases only. Include toe kick — no doors, no drawers.',
      content:() => {
        const matName = wizardBaseline?.matName || materials[0]?.fields['Name'] || '—';
        return `
          ${specBox([
            `<strong>Base cabinets — box only, no doors, no drawers</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `<strong>No doors · No drawers · Supply only · Local delivery · Include toe kick</strong>`,
          ])}
          ${wizardBaseline?.upperRate>0?`<p style="font-size:12px;color:#6b7280;margin-bottom:12px">Your upper rate was $${wizardBaseline.upperRate.toFixed(2)}/ft — bases are usually higher (toe kick).</p>`:''}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-bl-b-price" placeholder="0.00" oninput="mqphCalc('bl-b')"/></div>
          <div id="mqph-r-bl-b" class="mqph-result"></div>`;
      },
      nextLabel:'Next →',
      onNext:() => {
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
        title:'🪵 Step 4 — Additional materials',
        sub:'Same base cabinet spec, swap the material. Box only, no doors, no drawers.',
        content:() => {
          const blIdx = wizardBaseline?.matIndex ?? 0;
          const others = materials.filter((_,i) => i !== blIdx);
          return others.map((m,idx) => `
            <div class="mqph-item-block">
              <div class="mqph-item-block-label">📦 ${m.fields['Name']}</div>
              ${specBox([
                `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                `Material: <span class="mqph-spec-tag">${m.fields['Name']}</span> · No doors · No drawers · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-mat-${idx}" placeholder="0.00" oninput="mqphCalcMatUp(${idx})"/></div>
              <div id="mqph-r-mat-${idx}" class="mqph-result"></div>
            </div>`).join('');
        },
        skipLabel:'Skip — same price for all materials',
        nextLabel:'Next →',
        onNext:() => {
          const blIdx = wizardBaseline?.matIndex ?? 0;
          const others = materials.filter((_,i) => i !== blIdx);
          others.forEach((m,idx) => {
            const p = parseFloat(document.getElementById(`mqph-mat-${idx}`)?.value||0);
            if (p>0) {
              wizardItems.push({ name:m.fields['Name']+' — uppers', category:'material', rate:Math.round((p/4)*100)/100, unit:'per lin ft — uppers', description:'Material rate uppers', active:true });
              wizardItems.push({ name:m.fields['Name']+' — bases',  category:'material', rate:Math.round((p/4)*100)/100, unit:'per lin ft — bases',  description:'Material rate bases',  active:true });
            }
          });
        }
      });
    }

    // Step 5: Baseline door style
    steps.push({
      title:'🚪 Step 5 — Baseline door style',
      sub:'Now add doors. Quote baseline material + baseline door style + cheapest hinge.',
      content:() => {
        const matName  = wizardBaseline?.matName  || materials[0]?.fields['Name'] || '—';
        const doorName = wizardBaseline?.doorName || doorStyles[0]?.fields['Name'] || '—';
        const hi = wizardBaseline?.hingeIndex ?? 0;
        const hingeName = hinges[hi]?.fields['Name'] || 'your cheapest hinge';
        return `
          <div class="mqph-hl">Doors are priced as an upcharge on top of the box. The finish is already in your door name.</div>
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
      nextLabel:'Next →',
      onNext:() => {
        const p = parseFloat(document.getElementById('mqph-door-baseline')?.value||0);
        if (p>0&&wizardBaseline) {
          wizardBaseline.baseWithDoorPrice = p;
          const u = (p - wizardBaseline.basePrice) / 4;
          wizardItems.push({ name:wizardBaseline.doorName, category:'door', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'Baseline door style', active:true });
          if (wizardBaseline.hingeName) {
            wizardItems.push({ name:wizardBaseline.hingeName, category:'hinge', rate:0, unit:'per lin ft upcharge', description:'Baseline hinge — included in door price', active:true });
          }
        }
      }
    });

    // Step 6: Additional door styles
    if (doorStyles.length > 1) {
      steps.push({
        title:'🚪 Step 6 — Additional door styles',
        sub:'Same spec, swap the door style. Keep baseline material and baseline hinge.',
        content:() => {
          const blIdx = wizardBaseline?.doorIndex ?? 0;
          const matName = wizardBaseline?.matName || materials[0]?.fields['Name'] || '—';
          const hingeName = hinges[wizardBaseline?.hingeIndex ?? 0]?.fields['Name'] || 'baseline hinge';
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
        skipLabel:'Skip — same price for all door styles',
        nextLabel:'Next →',
        onNext:() => {
          const blIdx = wizardBaseline?.doorIndex ?? 0;
          const others = doorStyles.filter((_,i) => i !== blIdx);
          others.forEach((d,idx) => {
            const p = parseFloat(document.getElementById(`mqph-door-${idx}`)?.value||0);
            if (p>0&&wizardBaseline) {
              const u = (p - wizardBaseline.basePrice) / 4;
              wizardItems.push({ name:d.fields['Name'], category:'door', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'Door style upcharge', active:true });
            }
          });
        }
      });
    }

    // Step 7: Hinge upcharges
    if (hinges.length > 1) {
      steps.push({
        title:'🔧 Step 7 — Hinge upcharges',
        sub:'Same spec with baseline door — swap the hinge.',
        content:() => {
          const blIdx = wizardBaseline?.hingeIndex ?? 0;
          const matName = wizardBaseline?.matName || materials[0]?.fields['Name'] || '—';
          const doorName = wizardBaseline?.doorName || doorStyles[0]?.fields['Name'] || '—';
          const blHingeName = hinges[blIdx]?.fields['Name'] || 'baseline hinge';
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
        skipLabel:'Skip — only one hinge option',
        nextLabel:'Next →',
        onNext:() => {
          const blIdx = wizardBaseline?.hingeIndex ?? 0;
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

    // Step 8a: Drawers — 1 drawer per cabinet ("some drawers" rate)
    if (drawers.length > 0) {
      steps.push({
        title:'🗄️ Step 8a — Some drawers (1 per cabinet)',
        sub:'Quote the baseline box job with 1 top drawer in each cabinet. No doors, no drawer fronts.',
        content:() => {
          const matName = wizardBaseline?.matName || materials[0]?.fields['Name'] || '—';
          return `
            <div class="mqph-hl">
              This gives us the <strong>"some drawers"</strong> rate — used when a customer says their project has some drawers but not a full drawer bank in every cabinet.
            </div>
            ${drawers.map((d,idx) => `
              <div class="mqph-item-block">
                <div class="mqph-item-block-label">🗄️ ${d.fields['Name']}</div>
                ${specBox([
                  `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                  `Material: <span class="mqph-spec-tag">${matName}</span> · Drawers: <span class="mqph-spec-tag">${d.fields['Name']}</span>`,
                  `<strong>1 top drawer per cabinet · No doors · No drawer fronts · Supply only</strong>`,
                ])}
                <div class="mqph-input-row"><label>Your price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-drawer1-${idx}" placeholder="0.00" oninput="mqphCalcDrawer1(${idx})"/></div>
                <div id="mqph-r-drawer1-${idx}" class="mqph-result"></div>
              </div>`).join('')}`;
        },
        skipLabel:'Skip drawers',
        nextLabel:'Next →',
        onNext:() => {
          // Store 1-drawer prices in wizardBaseline for use in step 8b
          if (!wizardBaseline.drawer1Prices) wizardBaseline.drawer1Prices = {};
          drawers.forEach((d,idx) => {
            const p = parseFloat(document.getElementById(`mqph-drawer1-${idx}`)?.value||0);
            if (p>0) wizardBaseline.drawer1Prices[idx] = p;
          });
        }
      });

      // Step 8b: Drawers — full drawer bank ("mostly drawers" rate)
      steps.push({
        title:'🗄️ Step 8b — Mostly drawers (full bank)',
        sub:'Same spec but now quote a full drawer bank — 3 drawers in each cabinet. No doors, no drawer fronts.',
        content:() => {
          const matName = wizardBaseline?.matName || materials[0]?.fields['Name'] || '—';
          return `
            <div class="mqph-hl">
              This gives us the <strong>"mostly drawers"</strong> rate — used when a customer's project is heavily drawer-based. We'll average this with the 1-drawer quote to get an accurate blended rate.
            </div>
            ${drawers.map((d,idx) => {
              const p1 = wizardBaseline?.drawer1Prices?.[idx] || 0;
              return `
              <div class="mqph-item-block">
                <div class="mqph-item-block-label">🗄️ ${d.fields['Name']}</div>
                ${specBox([
                  `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
                  `Material: <span class="mqph-spec-tag">${matName}</span> · Drawers: <span class="mqph-spec-tag">${d.fields['Name']}</span>`,
                  `<strong>Full drawer bank (3 per cabinet) · No doors · No drawer fronts · Supply only</strong>`,
                ])}
                ${p1>0?`<p style="font-size:12px;color:#6b7280;margin-bottom:10px">1-drawer quote was $${p1.toLocaleString()} — bank quote should be higher.</p>`:''}
                <div class="mqph-input-row"><label>Your price for this job?</label><span class="mqph-pfx">$</span><input type="number" id="mqph-drawer3-${idx}" placeholder="0.00" oninput="mqphCalcDrawer3(${idx})"/></div>
                <div id="mqph-r-drawer3-${idx}" class="mqph-result"></div>
              </div>`;
            }).join('')}`;
        },
        skipLabel:'Skip',
        nextLabel:'Next →',
        onNext:() => {
          drawers.forEach((d,idx) => {
            const p1 = wizardBaseline?.drawer1Prices?.[idx] || 0;
            const p3 = parseFloat(document.getElementById(`mqph-drawer3-${idx}`)?.value||0);
            if (p1>0&&wizardBaseline) {
              // "some drawers" rate = (1-drawer quote - baseline box) / 4
              const someRate = (p1 - wizardBaseline.basePrice) / 4;
              wizardItems.push({
                name: d.fields['Name'] + ' — some drawers',
                category: 'drawer',
                rate: Math.round(someRate*100)/100,
                unit: 'per lin ft upcharge',
                description: 'Some drawers rate (1 drawer per cabinet)',
                active: true,
              });
            }
            if (p1>0&&p3>0&&wizardBaseline) {
              // "mostly drawers" rate = ((1-drawer + bank) / 2 - baseline box) / 4
              const mostlyRate = ((p1 + p3) / 2 - wizardBaseline.basePrice) / 4;
              wizardItems.push({
                name: d.fields['Name'] + ' — mostly drawers',
                category: 'drawer',
                rate: Math.round(mostlyRate*100)/100,
                unit: 'per lin ft upcharge',
                description: 'Mostly drawers rate (averaged 1-drawer + bank)',
                active: true,
              });
            }
          });
        }
      });
    }

    // Step 9: Installation & removal
    const hasInstall = getByCategory('install').length > 0;
    if (hasInstall) {
      steps.push({
        title:'🔧 Step 9 — Installation & removal',
        sub:'Quote install-only prices — no supply, just labour. Use the same 4 lin ft spec.',
        content:() => `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🔼 Upper cabinets — install only</div>
            <div class="mqph-input-row"><label>4ft uppers, <strong>box only</strong> (no doors)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-inst-u-nd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
            <div class="mqph-input-row"><label>4ft uppers, <strong>with doors</strong> (hang & adjust)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-inst-u-wd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
          </div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🔽 Base cabinets — install only</div>
            <div class="mqph-input-row"><label>4ft bases, <strong>box only</strong> (no doors)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-inst-b-nd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
            <div class="mqph-input-row"><label>4ft bases, <strong>with doors</strong> (hang & adjust)</label><span class="mqph-pfx">$</span><input type="number" id="mqph-inst-b-wd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
          </div>
          <div id="mqph-r-install" class="mqph-result"></div>
          <div style="height:1px;background:#e5e7eb;margin:1.25rem 0"></div>
          <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🗑️ Cabinet removal & disposal</div>
          <div class="mqph-input-row"><label>What would you charge to remove & dispose those same 4 linear feet of base cabinets with doors?</label></div>
          <p style="font-size:12px;color:#6b7280;margin-bottom:10px;line-height:1.5">Include your cost to haul away and dispose of the old cabinets. <span id="mqph-removal-hint" style="color:#1d4ed8;font-weight:500"></span></p>
          <div class="mqph-input-row"><label>Removal & disposal price for 4ft job</label><span class="mqph-pfx">$</span><input type="number" id="mqph-removal" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
          <div id="mqph-r-removal" class="mqph-result"></div>`,
        skipLabel:'Skip — supply only',
        nextLabel:'Next →',
        onNext:() => {
          const und=parseFloat(document.getElementById('mqph-inst-u-nd')?.value||0);
          const uwd=parseFloat(document.getElementById('mqph-inst-u-wd')?.value||0);
          const bnd=parseFloat(document.getElementById('mqph-inst-b-nd')?.value||0);
          const bwd=parseFloat(document.getElementById('mqph-inst-b-wd')?.value||0);
          const rem=parseFloat(document.getElementById('mqph-removal')?.value||0);

          if(und>0) wizardItems.push({ name:'Install — uppers (no doors)',   category:'install', rate:Math.round((und/4)*100)/100, unit:'per lin ft', description:'Upper box install, no doors', active:true });
          if(uwd>0) wizardItems.push({ name:'Install — uppers (with doors)', category:'install', rate:Math.round((uwd/4)*100)/100, unit:'per lin ft', description:'Upper install with doors hung', active:true });
          if(bnd>0) wizardItems.push({ name:'Install — bases (no doors)',    category:'install', rate:Math.round((bnd/4)*100)/100, unit:'per lin ft', description:'Base box install, no doors', active:true });
          if(bwd>0) {
            const bwdRate = Math.round((bwd/4)*100)/100;
            wizardItems.push({ name:'Install — bases (with doors)',       category:'install', rate:bwdRate,                              unit:'per lin ft', description:'Base install with doors hung', active:true });
            // Auto-calculated drawer install rates — no extra quotes needed
            wizardItems.push({ name:'Install — bases (some drawers)',     category:'install', rate:Math.round(bwdRate*1.10*100)/100,    unit:'per lin ft', description:'Base install with some drawers (+10% over with-doors rate)', active:true });
            wizardItems.push({ name:'Install — bases (mostly drawers)',   category:'install', rate:Math.round(bwdRate*1.15*100)/100,    unit:'per lin ft', description:'Base install with mostly drawers (+15% over with-doors rate)', active:true });
          }
          if(rem>0) wizardItems.push({ name:'Cabinet removal', category:'install', rate:Math.round((rem/4)*100)/100, unit:'per lin ft', description:'Remove & dispose existing cabinets', active:true });
        }
      });
    }

    // Final: Local zone & tax
    steps.push({
      title:'📍 Final step — Local delivery zone',
      sub:'Set your local delivery radius so the widget knows your service area.',
      content:() => {
        const existingRadius = getByCategory('zone').find(z=>z.fields['Name']?.toLowerCase().includes('local'))?.fields['Rate'] || 15;
        return `
          <div class="mqph-info">
            Jobs within your local radius are quoted at no extra travel charge — any delivery cost should already be built into your regular pricing. Jobs outside this area will include a note on the quote that travel charges may apply.
          </div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem">
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">📍 Local delivery radius</div>
            <div class="mqph-input-row"><label>No extra travel charge within this distance</label><input type="number" id="mqph-zone-r" value="${existingRadius}" style="width:130px;text-align:right"/><span class="mqph-pfx">km</span></div>
          </div>`;
      },
      skipLabel:'Skip',
      nextLabel:'Finish setup →',
      onNext:() => {
        const gn=id=>parseFloat(document.getElementById(id)?.value||0);
        const zr=gn('mqph-zone-r');
        if(zr>0) {
          const existing = lineItems.find(r=>r.fields&&r.fields['Category']==='zone'&&r.fields['Name']?.toLowerCase().includes('local'));
          if(existing) {
            atUpdate(LINE_ITEMS_TABLE, existing.id, {Rate:zr});
            existing.fields['Rate'] = zr;
          } else {
            atCreate(LINE_ITEMS_TABLE, {shop:[shopRecord._recordId],Name:'Local zone radius',Category:'zone',Rate:zr,Unit:'km',Description:'Within this distance = no travel surcharge',Active:true,'Sort order':0})
              .then(rec=>{ if(rec?.id) lineItems.push(rec); });
          }
        }
      }
    });

    return steps;
  }

  // ============================================================
  // WIZARD CALC HELPERS
  // ============================================================
  window.mqphCalc = function(id) {
    const map = {
      'bl-u':{ inputId:'mqph-bl-u-price', resId:'mqph-r-bl-u', label:'Upper box rate', calc:p=>p/4 },
      'bl-b':{ inputId:'mqph-bl-b-price', resId:'mqph-r-bl-b', label:'Base box rate',  calc:p=>p/4 },
    };
    const cfg=map[id]; if(!cfg) return;
    const p=parseFloat(document.getElementById(cfg.inputId)?.value||0);
    const res=document.getElementById(cfg.resId); if(!res) return;
    if(p>0){res.style.display='block';res.innerHTML=`<strong>${cfg.label}:</strong> <span class="mqph-result-val">$${cfg.calc(p).toFixed(2)}/lin ft</span>`;}
    else res.style.display='none';
  };
  window.mqphCalcMatUp = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-mat-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-mat-${idx}`); if(!res) return;
    if(p>0){res.style.display='block';res.innerHTML=`<strong>Rate:</strong> <span class="mqph-result-val">$${(p/4).toFixed(2)}/lin ft</span>`;}
    else res.style.display='none';
  };
  window.mqphCalcDoorBaseline = function() {
    const p=parseFloat(document.getElementById('mqph-door-baseline')?.value||0);
    const res=document.getElementById('mqph-r-door-baseline'); if(!res||!wizardBaseline) return;
    if(p>0){
      const u=(p-wizardBaseline.basePrice)/4;
      res.style.display='block';
      res.innerHTML=`<strong>Door upcharge:</strong> <span class="mqph-result-val">$${u.toFixed(2)}/lin ft</span> <span style="font-size:12px;color:#6b7280">&nbsp;(box $${wizardBaseline.baseRate.toFixed(2)} + door $${u.toFixed(2)} = $${(wizardBaseline.baseRate+u).toFixed(2)}/ft total)</span>`;
    } else res.style.display='none';
  };
  window.mqphCalcDoorUp = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-door-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-door-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){const u=(p-wizardBaseline.basePrice)/4;res.style.display='block';res.innerHTML=`<strong>Upcharge vs plain box:</strong> <span class="mqph-result-val">$${u.toFixed(2)}/lin ft</span>`;}
    else res.style.display='none';
  };
  window.mqphCalcHingeUp = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-hinge-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-hinge-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){const u=(p-(wizardBaseline.baseWithDoorPrice||wizardBaseline.basePrice))/4;res.style.display='block';res.innerHTML=`<strong>Hinge upcharge:</strong> <span class="mqph-result-val">$${u.toFixed(2)}/lin ft</span>`;}
    else res.style.display='none';
  };
  window.mqphCalcDrawer1 = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-drawer1-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-drawer1-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){
      const u=(p-wizardBaseline.basePrice)/4;
      res.style.display='block';
      res.innerHTML=`<strong>"Some drawers" upcharge:</strong> <span class="mqph-result-val">$${u.toFixed(2)}/lin ft</span>`;
    } else res.style.display='none';
  };
  window.mqphCalcDrawer3 = function(idx) {
    const p3=parseFloat(document.getElementById(`mqph-drawer3-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-drawer3-${idx}`); if(!res||!wizardBaseline) return;
    const p1=wizardBaseline?.drawer1Prices?.[idx]||0;
    if(p3>0){
      const mostlyRate=((p1+p3)/2-wizardBaseline.basePrice)/4;
      res.style.display='block';
      res.innerHTML=`<strong>"Mostly drawers" upcharge:</strong> <span class="mqph-result-val">$${mostlyRate.toFixed(2)}/lin ft</span> <span style="font-size:12px;color:#6b7280">(average of $${p1.toLocaleString()} + $${p3.toLocaleString()})</span>`;
    } else res.style.display='none';
  };
  window.mqphCalcInstall = function() {
    const und=parseFloat(document.getElementById('mqph-inst-u-nd')?.value||0);
    const uwd=parseFloat(document.getElementById('mqph-inst-u-wd')?.value||0);
    const bnd=parseFloat(document.getElementById('mqph-inst-b-nd')?.value||0);
    const bwd=parseFloat(document.getElementById('mqph-inst-b-wd')?.value||0);
    const rem=parseFloat(document.getElementById('mqph-removal')?.value||0);
    const res=document.getElementById('mqph-r-install'); if(!res) return;
    let html='';
    if(und>0) html+=`Uppers (no doors): <span class="mqph-result-val">$${(und/4).toFixed(2)}/lin ft</span><br/>`;
    if(uwd>0) html+=`Uppers (with doors): <span class="mqph-result-val">$${(uwd/4).toFixed(2)}/lin ft</span><br/>`;
    if(bnd>0) html+=`Bases (no doors): <span class="mqph-result-val">$${(bnd/4).toFixed(2)}/lin ft</span><br/>`;
    if(bwd>0) {
      html+=`Bases (with doors): <span class="mqph-result-val">$${(bwd/4).toFixed(2)}/lin ft</span><br/>`;
      html+=`Bases (some drawers): <span class="mqph-result-val">$${(bwd/4*1.10).toFixed(2)}/lin ft</span> <span style="font-size:11px;color:#9ca3af">auto +10%</span><br/>`;
      html+=`Bases (mostly drawers): <span class="mqph-result-val">$${(bwd/4*1.15).toFixed(2)}/lin ft</span> <span style="font-size:11px;color:#9ca3af">auto +15%</span>`;
      // Update removal suggestion hint
      const hint = document.getElementById('mqph-removal-hint');
      if (hint) hint.textContent = `Suggested: $${Math.round(bwd*0.5)} (half your base install with doors rate)`;
    }
    if(html){res.style.display='block';res.innerHTML=html;}else res.style.display='none';
    // Removal live rate
    const remRes = document.getElementById('mqph-r-removal');
    if (remRes) {
      if(rem>0){remRes.style.display='block';remRes.innerHTML=`<strong>Removal rate:</strong> <span class="mqph-result-val">$${(rem/4).toFixed(2)}/lin ft</span>`;}
      else remRes.style.display='none';
    }
  };

  // ============================================================
  // WIZARD NAV
  // ============================================================
  const wizardSavedInputs = {};
  function saveCurrentInputs() {
    document.querySelectorAll('.mqph-wizard-body input, .mqph-wizard-body select').forEach(el => { if(el.id) wizardSavedInputs[el.id]=el.value; });
  }
  function restoreSavedInputs() {
    Object.entries(wizardSavedInputs).forEach(([id,val]) => { const el=document.getElementById(id); if(el) el.value=val; });
  }

  function renderWizardStep(idx) {
    saveCurrentInputs();
    const steps=buildWizardSteps();
    const activeEl=document.getElementById(`mqph-step-${idx}`);
    if(activeEl) activeEl.innerHTML=`<div class="mqph-step-title">${steps[idx].title}</div><div class="mqph-step-sub">${steps[idx].sub}</div>${steps[idx].content()}`;
    restoreSavedInputs();
    steps.forEach((_,i)=>{ const el=document.getElementById(`mqph-step-${i}`); if(el) el.classList.toggle('active',i===idx); });
    const dots=document.querySelectorAll('.mqph-progress .dot');
    dots.forEach((d,i)=>{ d.classList.remove('done','active'); if(i<idx) d.classList.add('done'); else if(i===idx) d.classList.add('active'); });
    const back=document.getElementById('mqph-back-btn');
    const next=document.getElementById('mqph-next-btn');
    const skip=document.getElementById('mqph-skip-btn');
    if(back) back.style.display=idx===0?'none':'inline-block';
    if(next){ if(steps[idx].nextLabel){next.textContent=steps[idx].nextLabel;next.style.display='inline-block';}else next.style.display='none'; }
    if(skip){ skip.style.display=steps[idx].skipLabel?'inline-block':'none'; if(steps[idx].skipLabel) skip.textContent=steps[idx].skipLabel; }
  }

  window.mqphExitWizard = function() {
    if (wizardStep === 0 || confirm('Exit the wizard? Progress on this run won\'t be saved, but any pricing already in your account is untouched.')) {
      loadAndRender();
    }
  };

  window.mqphNext=function(){    const steps=buildWizardSteps();
    const result=steps[wizardStep].onNext?steps[wizardStep].onNext():null;
    if(result==='abort'){loadAndRender();return;}
    wizardStep++;
    if(wizardStep>=steps.length) mqphFinishWizard(); else renderWizardStep(wizardStep);
  };
  window.mqphBack=function(){if(wizardStep>0){wizardStep--;renderWizardStep(wizardStep);}};
  window.mqphSkip=function(){
    wizardStep++;
    const steps=buildWizardSteps();
    if(wizardStep>=steps.length) mqphFinishWizard(); else renderWizardStep(wizardStep);
  };

  // ============================================================
  // FINISH WIZARD — full wipe + rewrite
  // ============================================================
  async function mqphFinishWizard() {
    const container=document.getElementById('mq-pricing-helper-v2');
    if(container) container.innerHTML='<div style="padding:3rem;text-align:center;color:#6b7280;font-size:14px">Saving your pricing…</div>';

    // Wipe all wizard-owned categories clean
    const toDelete=lineItems.filter(r => r.fields && WIZARD_OWNED_CATEGORIES.includes(r.fields['Category']));
    for(const r of toDelete) { try { await atDelete(LINE_ITEMS_TABLE,r.id); } catch(e){} }

    // Write fresh records
    for(let i=0;i<wizardItems.length;i++) {
      const item=wizardItems[i];
      try {
        await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:item.name, Category:item.category,
          Rate:item.rate, Unit:item.unit, Description:item.description||'',
          Active:true, 'Sort order':i+1,
        });
      } catch(e) { console.warn('Create failed:',item.name,e); }
    }
    await loadAndRender();
  }

  function buildWizardHTML() {
    const steps=buildWizardSteps();
    return `
      <div class="mqph-wizard-card">
        <div class="mqph-wizard-header">
          <h2>⚙️ Pricing Setup Wizard</h2>
          <p>Spec used throughout every step: 1 × 30" + 1 × 18" = 4 lin ft</p>
          <div class="mqph-progress">${steps.map(()=>'<div class="dot"></div>').join('')}</div>
        </div>
        <div class="mqph-wizard-body">${steps.map((_,i)=>`<div class="mqph-step ${i===0?'active':''}" id="mqph-step-${i}"></div>`).join('')}</div>
        <div class="mqph-wizard-nav">
          <button class="mqph-btn mqph-btn-secondary" id="mqph-back-btn" onclick="mqphBack()" style="display:none">← Back</button>
          <button class="mqph-btn mqph-btn-secondary" id="mqph-skip-btn" onclick="mqphSkip()" style="display:none">Skip</button>
          <button class="mqph-btn mqph-btn-ghost" id="mqph-exit-btn" onclick="mqphExitWizard()" style="margin-left:4px">Exit to editor</button>
          <button class="mqph-btn mqph-btn-primary" id="mqph-next-btn" onclick="mqphNext()" style="margin-left:auto">Start →</button>
        </div>
      </div>`;
  }

  // ============================================================
  // MINI REVERSE-ENGINEERING WIZARD  (add single item)
  // ============================================================

  // Returns the HTML content for each mini-wiz step
  function miniWizContent(cat, name, step) {
    const bl = getBaselineRates();
    const noBaseline = bl.blBasePrice <= 0;

    if (noBaseline) {
      return `
        <div class="mqph-warn" style="margin-bottom:0">
          ⚠️ <strong>No baseline pricing found.</strong> Run the full pricing wizard first to set up your baseline rates. Then adding individual items will work correctly.
        </div>`;
    }

    if (cat === 'material') {
      if (step === 0) {
        return `
          <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Quote this job exactly in your software, then enter the total below.</p>
          ${specBox([
            `<strong>Upper cabinets — box only, no doors</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" upper</span> + <span class="mqph-spec-tag">1 × 18" upper</span> = 4 lin ft`,
            `Material: <span class="mqph-spec-tag">${name}</span> &nbsp;·&nbsp; No doors &nbsp;·&nbsp; Supply only &nbsp;·&nbsp; Local delivery`,
          ])}
          <div class="mqph-price-input-wrap"><span class="mqph-pfx">$</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p0" placeholder="0" oninput="mqphMiniCalc()"/></div>
          <p class="mqph-calc-hint">Enter your quoted total for this 4 lin ft job</p>
          <div class="mqph-rate-reveal" id="mqph-mini-reveal-0">
            <div class="mqph-rate-reveal-val" id="mqph-mini-rate-0">—</div>
            <div class="mqph-rate-reveal-lbl">per linear foot — uppers</div>
          </div>`;
      }
      if (step === 1) {
        return `
          <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Same material, now bases. Include toe kick.</p>
          ${specBox([
            `<strong>Base cabinets — box only, no doors</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
            `Material: <span class="mqph-spec-tag">${name}</span> &nbsp;·&nbsp; No doors &nbsp;·&nbsp; Supply only &nbsp;·&nbsp; Include toe kick`,
          ])}
          <div class="mqph-price-input-wrap"><span class="mqph-pfx">$</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p1" placeholder="0" oninput="mqphMiniCalc()"/></div>
          <p class="mqph-calc-hint">Enter your quoted total for this 4 lin ft job</p>
          <div class="mqph-rate-reveal" id="mqph-mini-reveal-1">
            <div class="mqph-rate-reveal-val" id="mqph-mini-rate-1">—</div>
            <div class="mqph-rate-reveal-lbl">per linear foot — bases</div>
          </div>`;
      }
    }

    if (cat === 'door') {
      const baselineBoxDesc = `$${bl.blBasePrice.toLocaleString()} (your ${bl.blMatName} base box price)`;
      return `
        <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Quote the same baseline base box job with this new door style added.</p>
        ${specBox([
          `<strong>Base cabinets + new door style</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
          `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Door: <span class="mqph-spec-tag">${name}</span>`,
          `<span class="mqph-spec-tag">3 doors: 2 on 30", 1 on 18"</span> · Hinges: <span class="mqph-spec-tag">${bl.blHingeName||'baseline hinge'}</span> · No drawers · Supply only`,
        ])}
        <div class="mqph-price-input-wrap"><span class="mqph-pfx">$</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p0" placeholder="0" oninput="mqphMiniCalc()"/></div>
        <p class="mqph-calc-hint">We'll subtract ${baselineBoxDesc} and divide by 4 to get the door upcharge per lin ft</p>
        <div class="mqph-rate-reveal" id="mqph-mini-reveal-0">
          <div class="mqph-rate-reveal-val" id="mqph-mini-rate-0">—</div>
          <div class="mqph-rate-reveal-lbl">per linear foot upcharge</div>
        </div>`;
    }

    if (cat === 'hinge') {
      const baseWithDoor = (bl.blBaseRate + bl.blDoorRate) * 4;
      const baselineDesc = `$${baseWithDoor.toLocaleString(undefined,{maximumFractionDigits:0})} (${bl.blMatName} bases + ${bl.blDoorName})`;
      return `
        <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Quote the baseline box + baseline door, but swap to this hinge.</p>
        ${specBox([
          `<strong>Base cabinets + baseline door + new hinge</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
          `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Door: <span class="mqph-spec-tag">${bl.blDoorName}</span>`,
          `Hinges: <span class="mqph-spec-tag">${name}</span> · No drawers · Supply only`,
        ])}
        <div class="mqph-price-input-wrap"><span class="mqph-pfx">$</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p0" placeholder="0" oninput="mqphMiniCalc()"/></div>
        <p class="mqph-calc-hint">We'll subtract ${baselineDesc} and divide by 4 to get the hinge upcharge per lin ft</p>
        <div class="mqph-rate-reveal" id="mqph-mini-reveal-0">
          <div class="mqph-rate-reveal-val" id="mqph-mini-rate-0">—</div>
          <div class="mqph-rate-reveal-lbl">per linear foot upcharge</div>
        </div>`;
    }

    if (cat === 'drawer') {
      const baselineBoxDesc = `$${bl.blBasePrice.toLocaleString(undefined,{maximumFractionDigits:0})} (your ${bl.blMatName} base box price)`;
      if (step === 0) {
        return `
          <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Quote the baseline base box with <strong>1 top drawer</strong> in each cabinet. This gives us the "some drawers" rate.</p>
          ${specBox([
            `<strong>Base cabinets + 1 top drawer per cabinet</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
            `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Drawers: <span class="mqph-spec-tag">${name}</span>`,
            `<strong>No doors · No drawer fronts · Supply only</strong>`,
          ])}
          <div class="mqph-price-input-wrap"><span class="mqph-pfx">$</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p0" placeholder="0" oninput="mqphMiniCalc()"/></div>
          <p class="mqph-calc-hint">We'll subtract ${baselineBoxDesc} and divide by 4 to get the "some drawers" upcharge per lin ft</p>
          <div class="mqph-rate-reveal" id="mqph-mini-reveal-0">
            <div class="mqph-rate-reveal-val" id="mqph-mini-rate-0">—</div>
            <div class="mqph-rate-reveal-lbl">per linear foot — some drawers upcharge</div>
          </div>`;
      }
      if (step === 1) {
        const p0 = miniWiz.p0 || 0;
        return `
          <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Now quote a <strong>full drawer bank</strong> — 3 drawers in each cabinet. This gives us the "mostly drawers" rate.</p>
          ${specBox([
            `<strong>Base cabinets + full drawer bank (3 per cabinet)</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" base</span> + <span class="mqph-spec-tag">1 × 18" base</span> = 4 lin ft`,
            `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Drawers: <span class="mqph-spec-tag">${name}</span>`,
            `<strong>No doors · No drawer fronts · Supply only</strong>`,
          ])}
          ${p0>0?`<p style="font-size:12px;color:#6b7280;margin-bottom:12px">1-drawer quote was $${p0.toLocaleString()} — bank quote should be higher.</p>`:''}
          <div class="mqph-price-input-wrap"><span class="mqph-pfx">$</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p1" placeholder="0" oninput="mqphMiniCalc()"/></div>
          <p class="mqph-calc-hint">We'll average this with your 1-drawer quote to get the "mostly drawers" rate</p>
          <div class="mqph-rate-reveal" id="mqph-mini-reveal-1">
            <div class="mqph-rate-reveal-val" id="mqph-mini-rate-1">—</div>
            <div class="mqph-rate-reveal-lbl">per linear foot — mostly drawers upcharge</div>
          </div>`;
      }
    }

    return '';
  }

  // Live calc preview inside mini-wiz
  window.mqphMiniCalc = function() {
    const bl = getBaselineRates();
    const cat = miniWiz.cat;
    const step = miniWiz.step;

    const reveal = (idx, rate) => {
      const el = document.getElementById(`mqph-mini-reveal-${idx}`);
      const rv = document.getElementById(`mqph-mini-rate-${idx}`);
      if (!el || !rv) return;
      if (rate !== null && !isNaN(rate)) {
        rv.textContent = `$${rate.toFixed(2)} / lin ft`;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    };

    if (cat === 'material') {
      const p = parseFloat(document.getElementById(`mqph-mini-p${step}`)?.value || 0);
      reveal(step, p > 0 ? p / 4 : null);
    }
    if (cat === 'door') {
      const p = parseFloat(document.getElementById('mqph-mini-p0')?.value || 0);
      reveal(0, p > 0 ? (p - bl.blBasePrice) / 4 : null);
    }
    if (cat === 'hinge') {
      const baseWithDoor = (bl.blBaseRate + bl.blDoorRate) * 4;
      const p = parseFloat(document.getElementById('mqph-mini-p0')?.value || 0);
      reveal(0, p > 0 ? (p - baseWithDoor) / 4 : null);
    }
    if (cat === 'drawer') {
      if (step === 0) {
        const p = parseFloat(document.getElementById('mqph-mini-p0')?.value || 0);
        reveal(0, p > 0 ? (p - bl.blBasePrice) / 4 : null);
      }
      if (step === 1) {
        const p0 = miniWiz.p0 || 0;
        const p1 = parseFloat(document.getElementById('mqph-mini-p1')?.value || 0);
        reveal(1, p0 > 0 && p1 > 0 ? ((p0 + p1) / 2 - bl.blBasePrice) / 4 : null);
      }
    }
  };

  // Total steps per category
  function miniWizTotalSteps(cat) {
    return (cat === 'material' || cat === 'drawer') ? 2 : 1;
  }

  function renderMiniWiz() {
    const cat  = miniWiz.cat;
    const name = miniWiz.name;
    const step = miniWiz.step;
    const total = miniWizTotalSteps(cat);
    const isLast = step >= total - 1;

    const stepLabels = { material:['Upper rate','Base rate'], door:['Door upcharge'], hinge:['Hinge upcharge'], drawer:['Some drawers','Mostly drawers'] };
    const labels = stepLabels[cat] || [];

    const progressDots = labels.map((_,i) =>
      `<div style="flex:1;height:3px;border-radius:2px;background:${i<step?'#a3e635':i===step?'#fff':'rgba(255,255,255,0.25)'};transition:background 0.3s"></div>`
    ).join('');

    const catMeta = { material:{icon:'🪵',title:'Add box material'}, door:{icon:'🚪',title:'Add door style'}, hinge:{icon:'🔧',title:'Add door hinge'}, drawer:{icon:'🗄️',title:'Add drawer config'} };
    const meta = catMeta[cat] || { icon:'➕', title:'Add item' };

    document.getElementById('mqph-mini-title').innerHTML = `${meta.icon} ${meta.title}`;
    document.getElementById('mqph-mini-sub').textContent = name;
    document.getElementById('mqph-mini-progress').innerHTML = progressDots;
    document.getElementById('mqph-mini-content').innerHTML = miniWizContent(cat, name, step);

    // Nav buttons
    const nextBtn = document.getElementById('mqph-mini-next');
    const backBtn = document.getElementById('mqph-mini-back');
    if (nextBtn) nextBtn.textContent = isLast ? 'Save →' : 'Next →';
    if (backBtn) backBtn.style.display = step > 0 ? 'inline-block' : 'none';
  }

  window.mqphMiniNext = async function() {
    const cat  = miniWiz.cat;
    const name = miniWiz.name;
    const step = miniWiz.step;
    const bl   = getBaselineRates();

    // Collect the value at this step
    const p = parseFloat(document.getElementById(`mqph-mini-p${step}`)?.value || document.getElementById('mqph-mini-p0')?.value || 0);
    if (!p || p <= 0) {
      const inp = document.getElementById(`mqph-mini-p${step}`) || document.getElementById('mqph-mini-p0');
      if (inp) { inp.style.borderBottomColor='#dc2626'; inp.focus(); }
      return;
    }

    const total = miniWizTotalSteps(cat);
    const isLast = step >= total - 1;

    if (!isLast) {
      // Store step value and advance
      miniWiz[`p${step}`] = p;
      miniWiz.step++;
      renderMiniWiz();
      return;
    }

    // Last step — save to Airtable
    miniWiz[`p${step}`] = p;
    const nextBtn = document.getElementById('mqph-mini-next');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Saving…'; }

    try {
      if (cat === 'material') {
        const upperRate = Math.round((miniWiz.p0 / 4) * 100) / 100;
        const baseRate  = Math.round((miniWiz.p1 / 4) * 100) / 100;
        const sortBase  = lineItems.filter(r=>r.fields&&r.fields['Category']==='material').length;

        const upperRec = await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:`${name} — uppers`, Category:'material',
          Rate:upperRate, Unit:'per lin ft — uppers', Description:'Box material rate uppers', Active:true, 'Sort order':sortBase+1,
        });
        const baseRec = await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:`${name} — bases`, Category:'material',
          Rate:baseRate, Unit:'per lin ft — bases', Description:'Box material rate bases', Active:true, 'Sort order':sortBase+2,
        });
        if (upperRec?.id) lineItems.push(upperRec);
        if (baseRec?.id)  lineItems.push(baseRec);
      }

      if (cat === 'door') {
        const rate = Math.round(((p - bl.blBasePrice) / 4) * 100) / 100;
        const sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']==='door').length;
        const rec = await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:name, Category:'door',
          Rate:rate, Unit:'per lin ft upcharge', Description:'Door style upcharge', Active:true, 'Sort order':sortBase+1,
        });
        if (rec?.id) lineItems.push(rec);
      }

      if (cat === 'hinge') {
        const baseWithDoor = (bl.blBaseRate + bl.blDoorRate) * 4;
        const rate = Math.round(((p - baseWithDoor) / 4) * 100) / 100;
        const sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']==='hinge').length;
        const rec = await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:name, Category:'hinge',
          Rate:rate, Unit:'per lin ft upcharge', Description:'Hinge upcharge', Active:true, 'Sort order':sortBase+1,
        });
        if (rec?.id) lineItems.push(rec);
      }

      if (cat === 'drawer') {
        const p0 = miniWiz.p0 || 0; // 1-drawer quote
        const p1 = miniWiz.p1 || 0; // bank quote (current step)
        const bl2 = getBaselineRates();
        const sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']==='drawer').length;

        if (p0 > 0) {
          const someRate = Math.round(((p0 - bl2.blBasePrice) / 4) * 100) / 100;
          const rec1 = await atCreate(LINE_ITEMS_TABLE, {
            shop:[shopRecord._recordId], Name:`${name} — some drawers`, Category:'drawer',
            Rate:someRate, Unit:'per lin ft', Description:'Some drawers rate (1 drawer per cabinet)', Active:true, 'Sort order':sortBase+1,
          });
          if (rec1?.id) lineItems.push(rec1);
        }

        if (p0 > 0 && p1 > 0) {
          const mostlyRate = Math.round((((p0 + p1) / 2 - bl2.blBasePrice) / 4) * 100) / 100;
          const rec2 = await atCreate(LINE_ITEMS_TABLE, {
            shop:[shopRecord._recordId], Name:`${name} — mostly drawers`, Category:'drawer',
            Rate:mostlyRate, Unit:'per lin ft', Description:'Mostly drawers rate (averaged 1-drawer + bank)', Active:true, 'Sort order':sortBase+2,
          });
          if (rec2?.id) lineItems.push(rec2);
        }
      }

      mqphCloseMiniWiz();
      await loadAndRender();

    } catch(e) {
      console.error('Mini-wiz save error:', e);
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Save →'; }
      alert('Error saving. Please try again.');
    }
  };

  window.mqphMiniBack = function() {
    if (miniWiz.step > 0) { miniWiz.step--; renderMiniWiz(); }
  };

  window.mqphCloseMiniWiz = function() {
    document.getElementById('mqph-mini-overlay')?.classList.remove('show');
    miniWiz = { cat:null, name:'', step:0 };
  };

  function openMiniWiz(cat, name) {
    miniWiz = { cat, name, step:0 };
    const overlay = document.getElementById('mqph-mini-overlay');
    if (!overlay) return;
    overlay.classList.add('show');
    renderMiniWiz();
  }

  // ============================================================
  // EDITOR
  // ============================================================
  function buildEditorHTML() {
    // Wizard has run if any material record has a rate > 0
    const wizardHasRun = lineItems.some(r => r.fields && r.fields['Category'] === 'material' && (r.fields['Rate'] || 0) > 0);

    // Hide wizard-owned $0 items until wizard has completed —
    // they exist in Airtable (pre-created by item setup) but aren't meaningful yet
    const visibleItems = lineItems.filter(r => {
      if (!r.fields) return false;
      if (!wizardHasRun && WIZARD_OWNED_CATEGORIES.includes(r.fields['Category']) && (r.fields['Rate'] || 0) === 0) return false;
      return true;
    });

    const groups = {};
    visibleItems.forEach(r => {
      const c = r.fields['Category'] || 'other';
      if (c === 'countertop') return; // handled by buildCTHtml()
      if (c === 'trim') return; // handled by buildTrimHtml()
      if (!groups[c]) groups[c] = [];
      groups[c].push(r);
    });
    const hasItems = visibleItems.length > 0;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;gap:1rem;flex-wrap:wrap">
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px">⚙️ Pricing</h2>
          <p style="font-size:13px;color:#6b7280">Your rates — changes apply to your widget immediately.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="mqph-btn mqph-btn-secondary" onclick="mqphStartItemSetup()">🛠️ Edit shop items</button>
          <button class="mqph-btn mqph-btn-secondary" onclick="mqphGoToWizard()">🧙 Re-run pricing wizard</button>
          <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDeleteAll()">🗑️ Start fresh</button>
        </div>
      </div>

      ${!hasItems ? `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:3rem;text-align:center;margin-bottom:1.5rem">
          <div style="font-size:32px;margin-bottom:12px">⚙️</div>
          <div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px">No pricing set up yet</div>
          <div style="font-size:13px;color:#6b7280;margin-bottom:1.5rem">Start by setting up your shop items, then run the pricing wizard.</div>
          <button class="mqph-btn mqph-btn-primary" onclick="mqphStartItemSetup()">Set up shop items →</button>
        </div>` : `

        ${Object.entries(groups).map(([cat,recs]) => `
          <div class="mqph-cat-block">
            <div class="mqph-cat-header">
              <span class="mqph-cat-title">${CAT_LABELS[cat]||cat}</span>
              ${MINI_WIZ_CATS.includes(cat)
                ? `<button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="mqphOpenAddItem('${cat}')">+ Add ${cat}</button>`
                : `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenAdd('${cat}')">+ Add</button>`
              }
            </div>
            ${recs.sort((a,b)=>(a.fields['Sort order']||0)-(b.fields['Sort order']||0)).map(r=>`
              <div class="mqph-row">
                <div style="flex:1;min-width:0">
                  <div class="mqph-row-name">${r.fields['Name']||'—'}</div>
                  ${r.fields['Description']?`<div class="mqph-row-desc">${r.fields['Description']}</div>`:''}
                </div>
                <div class="mqph-row-rate">${(r.fields['Rate']||0) === 0 ? '<span style="font-size:11px;font-weight:600;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:2px 7px">Not priced individually (Part of baseline)</span>' : (r.fields['Category']==='zone'||r.fields['Unit']==='km'||r.fields['Unit']==='%') ? (r.fields['Rate']||0).toLocaleString() : '$'+(r.fields['Rate']||0).toLocaleString()}</div>
                <div class="mqph-row-unit">${r.fields['Unit']||''}</div>
                <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active']?'on':''}" onclick="mqphToggle('${r.id}',this)"></div></div>
                <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenEdit('${r.id}')">Edit</button>
                <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDelete('${r.id}')">Delete</button>
              </div>`).join('')}
          </div>`).join('')}
      `}

      ${buildCTHtml()}
      ${buildTrimHtml()}

      <!-- Mini-wizard overlay -->
      <div class="mqph-overlay" id="mqph-mini-overlay">
        <div class="mqph-modal">
          <div class="mqph-modal-hdr mqph-mini-hdr" style="background:#1a1a1a;border-radius:12px 12px 0 0">
            <div>
              <h3 id="mqph-mini-title" style="color:#fff;font-size:15px">Add item</h3>
              <p id="mqph-mini-sub" style="color:rgba(255,255,255,0.6);font-size:12px;margin:3px 0 0;padding:0"></p>
              <div id="mqph-mini-progress" style="display:flex;gap:4px;margin-top:10px;min-width:200px"></div>
            </div>
            <button class="mqph-modal-hdr-close" onclick="mqphCloseMiniWiz()" style="color:rgba(255,255,255,0.7);font-size:22px">×</button>
          </div>
          <div class="mqph-modal-body" id="mqph-mini-content"></div>
          <div class="mqph-modal-footer">
            <button class="mqph-btn mqph-btn-secondary" id="mqph-mini-back" onclick="mqphMiniBack()" style="display:none">← Back</button>
            <button class="mqph-btn mqph-btn-primary" id="mqph-mini-next" onclick="mqphMiniNext()" style="margin-left:auto">Next →</button>
          </div>
        </div>
      </div>

      <!-- Raw edit modal -->
      <div class="mqph-overlay" id="mqph-modal-overlay">
        <div class="mqph-modal">
          <div class="mqph-modal-hdr">
            <div><h3 id="mqph-modal-title">Edit item</h3></div>
            <button class="mqph-modal-hdr-close" onclick="mqphCloseModal()">×</button>
          </div>
          <div class="mqph-modal-body">
            <div class="mqph-field"><label>Name</label><input type="text" id="mqph-item-name"/></div>
            <div class="mqph-field"><label>Category</label>
              <select id="mqph-item-cat">${Object.entries(CAT_LABELS).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
            </div>
            <div class="mqph-field"><label>Rate ($)</label><input type="number" id="mqph-item-rate" step="0.01"/></div>
            <div class="mqph-field"><label>Unit</label>
              <select id="mqph-item-unit">
                <option>per lin ft</option><option>per lin ft — uppers</option><option>per lin ft — bases</option>
                <option>per lin ft upcharge</option><option>flat</option><option>each</option><option>%</option><option>km</option>
              </select>
            </div>
            <div class="mqph-field"><label>Description (optional)</label><textarea id="mqph-item-desc"></textarea></div>
            <div class="mqph-field" style="flex-direction:row;align-items:center;gap:10px">
              <label style="text-transform:none;font-size:13px;font-weight:500">Active</label>
              <input type="checkbox" id="mqph-item-active" checked style="width:auto"/>
            </div>
          </div>
          <div class="mqph-modal-footer">
            <button class="mqph-btn mqph-btn-secondary" onclick="mqphCloseModal()">Cancel</button>
            <button class="mqph-btn mqph-btn-primary" onclick="mqphSaveItem()" style="margin-left:auto">Save item</button>
          </div>
        </div>
      </div>
    `;
  }

  // Opens mini-wiz with a name prompt first
  window.mqphOpenAddItem = function(cat) {
    // Prompt for name inline — small name modal
    const catMeta = {
      material:{ icon:'🪵', label:'Box material',      ph:'e.g. Painted MDF' },
      door:    { icon:'🚪', label:'Door style',         ph:'e.g. Maple shaker — painted' },
      hinge:   { icon:'🔧', label:'Door hinge',         ph:'e.g. Concealed soft-close' },
      drawer:  { icon:'🗄️', label:'Drawer configuration', ph:'e.g. Birch — soft-close undermount' },
    };
    const meta = catMeta[cat] || { icon:'➕', label:'Item', ph:'Enter name' };

    // Reuse mini-wiz overlay with a name-entry screen
    const overlay = document.getElementById('mqph-mini-overlay');
    if (!overlay) return;

    document.getElementById('mqph-mini-title').innerHTML = `${meta.icon} New ${meta.label}`;
    document.getElementById('mqph-mini-sub').textContent = 'Step 1 of 2 — name it first';
    document.getElementById('mqph-mini-progress').innerHTML = '';
    document.getElementById('mqph-mini-content').innerHTML = `
      <p style="font-size:13px;color:#6b7280;margin-bottom:1rem;line-height:1.6">What do you call this ${meta.label.toLowerCase()}? Use a descriptive name — it'll appear in your widget dropdown.</p>
      <input class="mqph-name-input" type="text" id="mqph-mini-name-inp" placeholder="${meta.ph}" onkeydown="if(event.key==='Enter')mqphMiniNameNext('${cat}')"/>
      ${cat === 'door' ? `<p style="font-size:12px;color:#9ca3af;margin-top:-0.5rem;line-height:1.5">Tip: include the finish in the name — each door+finish combo is its own item (e.g. "Maple shaker — stained & lacquered")</p>` : ''}
    `;

    const nextBtn = document.getElementById('mqph-mini-next');
    const backBtn = document.getElementById('mqph-mini-back');
    if (nextBtn) { nextBtn.textContent = 'Next →'; nextBtn.disabled = false; nextBtn.onclick = () => mqphMiniNameNext(cat); }
    if (backBtn) { backBtn.style.display = 'inline-block'; backBtn.onclick = () => { mqphCloseMiniWiz(); }; backBtn.textContent = 'Cancel'; }

    overlay.classList.add('show');
    setTimeout(() => document.getElementById('mqph-mini-name-inp')?.focus(), 100);
  };

  window.mqphMiniNameNext = function(cat) {
    const name = document.getElementById('mqph-mini-name-inp')?.value.trim();
    if (!name) {
      const inp = document.getElementById('mqph-mini-name-inp');
      if (inp) inp.style.borderColor = '#dc2626';
      return;
    }
    // Wire next button back to normal mini-wiz flow
    const nextBtn = document.getElementById('mqph-mini-next');
    const backBtn = document.getElementById('mqph-mini-back');
    if (nextBtn) nextBtn.onclick = () => mqphMiniNext();
    if (backBtn) backBtn.onclick = () => mqphMiniBack();
    openMiniWiz(cat, name);
  };

  window.mqphSaveLocalRadius = async function() {
    const val = parseFloat(document.getElementById('mqph-local-radius')?.value || 15);
    const existing = lineItems.find(r => r.fields && r.fields['Name']?.toLowerCase().includes('local') && r.fields['Category']==='zone');
    if (existing) {
      await atUpdate(LINE_ITEMS_TABLE, existing.id, { 'Rate':val });
      existing.fields['Rate'] = val;
    } else {
      const rec = await atCreate(LINE_ITEMS_TABLE, { 'shop':[shopRecord._recordId], 'Name':'Local zone radius', 'Category':'zone', 'Rate':val, 'Unit':'km', 'Description':'Within this distance = no travel surcharge', 'Active':true, 'Sort order':0 });
      if (rec?.id) lineItems.push(rec);
    }
    const saved = document.getElementById('mqph-local-radius-saved');
    if (saved) { saved.style.display='inline'; setTimeout(()=>saved.style.display='none',2000); }
  };

  window.mqphStartItemSetup = async function() {
    const hasHinge   = lineItems.filter(r=>r.fields).some(r=>r.fields['Category']==='hinge');
    const hasInstall = lineItems.filter(r=>r.fields).some(r=>r.fields['Category']==='install');
    if (!hasHinge)   { for(let i=0;i<DEFAULT_HINGES.length;i++){const rec=await atCreate(LINE_ITEMS_TABLE,{shop:[shopRecord._recordId],Name:DEFAULT_HINGES[i],Category:'hinge',Rate:0,Unit:'per lin ft upcharge',Active:true,'Sort order':i+1});if(rec?.id)lineItems.push(rec);} }
    if (!hasInstall) { for(let i=0;i<DEFAULT_INSTALL.length;i++){const rec=await atCreate(LINE_ITEMS_TABLE,{shop:[shopRecord._recordId],Name:DEFAULT_INSTALL[i].name,Category:'install',Rate:0,Unit:DEFAULT_INSTALL[i].unit,Description:DEFAULT_INSTALL[i].description,Active:true,'Sort order':i+1});if(rec?.id)lineItems.push(rec);} }
    const container=document.getElementById('mq-pricing-helper-v2');
    if(container) container.innerHTML=buildItemSetupHTML();
  };

  window.mqphOpenAdd = function(cat) {
    currentEditId = null;
    document.getElementById('mqph-modal-title').textContent = 'Add item';
    document.getElementById('mqph-item-name').value = '';
    document.getElementById('mqph-item-cat').value = cat || 'material';
    document.getElementById('mqph-item-rate').value = '';
    document.getElementById('mqph-item-unit').value = 'per lin ft';
    document.getElementById('mqph-item-desc').value = '';
    document.getElementById('mqph-item-active').checked = true;
    document.getElementById('mqph-modal-overlay').classList.add('show');
  };

  window.mqphOpenEdit = function(id) {
    const rec = lineItems.find(r=>r.id===id); if(!rec) return;
    currentEditId = id;
    document.getElementById('mqph-modal-title').textContent = 'Edit item';
    document.getElementById('mqph-item-name').value  = rec.fields['Name']||'';
    document.getElementById('mqph-item-cat').value   = rec.fields['Category']||'material';
    document.getElementById('mqph-item-rate').value  = rec.fields['Rate']||'';
    document.getElementById('mqph-item-unit').value  = rec.fields['Unit']||'per lin ft';
    document.getElementById('mqph-item-desc').value  = rec.fields['Description']||'';
    document.getElementById('mqph-item-active').checked = rec.fields['Active']!==false;
    document.getElementById('mqph-modal-overlay').classList.add('show');
  };

  window.mqphCloseModal = function() { document.getElementById('mqph-modal-overlay')?.classList.remove('show'); };

  window.mqphSaveItem = async function() {
    const name = document.getElementById('mqph-item-name').value.trim();
    if (!name) { alert('Please enter a name.'); return; }
    const fields = {
      shop:[shopRecord._recordId], Name:name,
      Category:document.getElementById('mqph-item-cat').value,
      Rate:parseFloat(document.getElementById('mqph-item-rate').value||0),
      Unit:document.getElementById('mqph-item-unit').value,
      Description:document.getElementById('mqph-item-desc').value.trim(),
      Active:document.getElementById('mqph-item-active').checked,
    };
    try {
      if (currentEditId) { await atUpdate(LINE_ITEMS_TABLE,currentEditId,fields); }
      else { fields['Sort order']=lineItems.length+1; await atCreate(LINE_ITEMS_TABLE,fields); }
      mqphCloseModal(); await loadAndRender();
    } catch(e) { alert('Error saving. Please try again.'); }
  };

  window.mqphDeleteAll = async function() {
    if (!confirm('Delete ALL pricing items and start fresh? This cannot be undone.')) return;
    const container = document.getElementById('mq-pricing-helper-v2');
    if (container) container.innerHTML = '<div style="padding:3rem;text-align:center;color:#6b7280;font-size:14px">Clearing all pricing…</div>';
    for (const r of lineItems) { try { await atDelete(LINE_ITEMS_TABLE,r.id); } catch(e){} }
    lineItems = [];
    await loadAndRender();
  };

  window.mqphDelete = async function(id) {
    if (!confirm('Delete this item?')) return;
    try { await atDelete(LINE_ITEMS_TABLE,id); await loadAndRender(); } catch(e) { alert('Error deleting.'); }
  };

  window.mqphToggle = async function(id, el) {
    const rec = lineItems.find(r=>r.id===id); if(!rec) return;
    const val = !rec.fields['Active'];
    el.classList.toggle('on',val); rec.fields['Active']=val;
    await atUpdate(LINE_ITEMS_TABLE,id,{Active:val});
  };

  // ============================================================
  // COUNTERTOP EDITOR (dynamic — reads/writes Line Items table)
  // Each material row is self-contained: supply, install, its own
  // backsplash height options, and its own cutout rates.
  // ============================================================

  // Parse a material's backsplash options JSON safely
  function getBsOptions(r) {
    try {
      const raw = r.fields['Backsplash options'];
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { return []; }
  }

  // Parse a material's cutout options JSON safely
  function getCutoutOptions(r) {
    try {
      const raw = r.fields['Cutout options'];
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) { return []; }
  }

  // One-time migration: copy old global Backsplash/Sink/Cooktop rates onto
  // every existing material that hasn't been migrated yet, so pricing never
  // silently drops to $0 for an existing shop. Also upgrades materials that
  // only have the older flat 'Sink cutout rate' / 'Cooktop cutout rate'
  // fields into the newer 'Cutout options' list format.
  async function migrateCTPricing() {
    const ctItems = lineItems.filter(r=>r.fields&&r.fields['Category']==='countertop');
    const oldBacksplash = ctItems.find(r=>(r.fields['Description']||'').includes('type:backsplash'));
    const oldSink        = ctItems.find(r=>(r.fields['Description']||'').includes('type:cutout')&&r.fields['Name']?.toLowerCase().includes('sink'));
    const oldCooktop     = ctItems.find(r=>(r.fields['Description']||'').includes('type:cutout')&&r.fields['Name']?.toLowerCase().includes('cooktop'));
    const materials = ctItems.filter(r=>{
      const desc = r.fields['Description']||'';
      return !desc.includes('type:backsplash') && !desc.includes('type:cutout');
    });

    const defaultBsInstall = oldBacksplash ? (oldBacksplash.fields['Install rate']||12) : 12;
    const defaultSinkRate  = oldSink ? (oldSink.fields['Rate']||180) : 180;
    const defaultCookRate  = oldCooktop ? (oldCooktop.fields['Rate']||220) : 220;

    for (const m of materials) {
      const needsBs = !m.fields['Backsplash options'];
      const needsCutoutOptions = !m.fields['Cutout options'];
      if (!needsBs && !needsCutoutOptions) continue;
      const patch = {};
      if (needsBs) {
        patch['Backsplash options'] = JSON.stringify([{label:'4" standard', heightIn:4, supplyRate:m.fields['Rate']||0, installRate:defaultBsInstall}]);
      }
      if (needsCutoutOptions) {
        // Prefer this material's own flat sink/cooktop fields (set by a prior
        // version of this editor) if present, otherwise fall back to the
        // shop's old global cutout rates.
        const sinkRate = m.fields['Sink cutout rate']!=null ? m.fields['Sink cutout rate'] : defaultSinkRate;
        const cookRate = m.fields['Cooktop cutout rate']!=null ? m.fields['Cooktop cutout rate'] : defaultCookRate;
        patch['Cutout options'] = JSON.stringify([
          {label:'Sink cutout', rate:sinkRate},
          {label:'Cooktop cutout', rate:cookRate},
        ]);
      }
      try {
        await atUpdate(LINE_ITEMS_TABLE, m.id, patch);
        Object.assign(m.fields, patch);
      } catch(e) { /* non-fatal — leave this material to migrate next load */ }
    }
  }

  function buildCTHtml() {
    const materials = lineItems.filter(r=>r.fields&&r.fields['Category']==='countertop'&&!(r.fields['Description']||'').includes('type:backsplash')&&!(r.fields['Description']||'').includes('type:cutout'))
      .sort((a,b)=>(a.fields['Sort order']||0)-(b.fields['Sort order']||0));

    function matRow(r) {
      const unitParts = (r.fields['Unit']||'sqft|sqft').split('|');
      const su = (unitParts[0]||'sqft').trim();
      const iu = (unitParts[1]||'sqft').trim();
      const bsOpts = getBsOptions(r);
      const bsSummary = bsOpts.length
        ? bsOpts.map(o=>`${o.label} (supply $${(o.supplyRate||0).toLocaleString()}, install $${(o.installRate||0).toLocaleString()}/lin ft)`).join(', ')
        : 'No backsplash options set';
      const cutoutOpts = getCutoutOptions(r);
      const cutoutSummary = cutoutOpts.length
        ? cutoutOpts.map(o=>`${o.label} $${(o.rate||0).toLocaleString()}`).join(', ')
        : null;
      return `
        <div class="mqph-row">
          <div style="flex:1;min-width:0">
            <div class="mqph-row-name">${r.fields['Name']||'—'}</div>
            <div class="mqph-row-desc">🧱 ${bsSummary}${cutoutSummary ? ` &nbsp;·&nbsp; ✂️ ${cutoutSummary}` : ''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:13px;flex-wrap:wrap">
            <span style="color:#6b7280;font-size:11px">Supply:</span>
            <span style="font-weight:600">$${(r.fields['Rate']||0).toLocaleString()}</span>
            <span style="color:#6b7280;font-size:11px">/${su}</span>
            <span style="color:#d1d5db;margin:0 4px">·</span>
            <span style="color:#6b7280;font-size:11px">Install:</span>
            <span style="font-weight:600">$${(r.fields['Install rate']||0).toLocaleString()}</span>
            <span style="color:#6b7280;font-size:11px">/${iu}</span>
          </div>
          <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active']?'on':''}" onclick="mqphToggle('${r.id}',this)"></div></div>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenCTEdit('${r.id}')">Edit</button>
          <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDelete('${r.id}')">Delete</button>
        </div>`;
    }

    const section = (title, items, rowFn, emptyMsg) => items.length > 0
      ? `<div style="padding:8px 16px 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;background:#f9fafb;border-bottom:1px solid #f3f4f6">${title}</div>
         ${items.map(rowFn).join('')}`
      : `<div style="padding:8px 16px 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;background:#f9fafb;border-bottom:1px solid #f3f4f6">${title}</div>
         <div style="padding:1rem 16px;font-size:13px;color:#9ca3af">${emptyMsg}</div>`;

    return `
      <div class="mqph-ct-block">
        <div class="mqph-cat-header">
          <span class="mqph-cat-title">🪨 Countertop pricing</span>
          <button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="mqphOpenCTAdd()">+ Add material</button>
        </div>
        <div id="mqph-ct-msg" class="mqph-msg"></div>
        <div class="mqph-info" style="margin:12px 16px">
          Each material now carries its own backsplash height options and cutout pricing — no more separate backsplash/cutout items to keep in sync. Add a material below, then set its backsplash heights and cutout rates right inside it.
        </div>
        ${section('Materials', materials, matRow, 'No materials yet — add your first countertop material.')}
      </div>

      <!-- Countertop add/edit modal -->
      <div class="mqph-overlay" id="mqph-ct-modal-overlay">
        <div class="mqph-modal">
          <div class="mqph-modal-hdr">
            <div><h3 id="mqph-ct-modal-title">Add countertop material</h3></div>
            <button class="mqph-modal-hdr-close" onclick="mqphCloseCTModal()">×</button>
          </div>
          <div class="mqph-modal-body">
            <div class="mqph-field"><label>Name</label><input type="text" id="mqph-ct-name" placeholder="e.g. Granite — Mid"/></div>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Supply rate</div>
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:13px;color:#6b7280">$</span>
                <input type="number" id="mqph-ct-supply-rate" placeholder="0.00" step="0.01" oninput="mqphSyncBsSupplyRate()" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
                <span style="font-size:13px;color:#6b7280">per</span>
                <select id="mqph-ct-supply-unit" onchange="mqphSyncBsSupplyRate()" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px">
                  <option value="sqft">sqft</option><option value="lin ft">lin ft</option>
                </select>
              </div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Install rate</div>
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:13px;color:#6b7280">$</span>
                <input type="number" id="mqph-ct-install-rate" placeholder="0.00" step="0.01" oninput="mqphSyncBsInstallRate()" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
                <span style="font-size:13px;color:#6b7280">per</span>
                <select id="mqph-ct-install-unit" onchange="mqphSyncBsInstallRate()" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px">
                  <option value="sqft">sqft</option><option value="lin ft">lin ft</option>
                </select>
              </div>
            </div>

            <!-- Backsplash options builder -->
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Backsplash height options</div>
              <div class="mqph-info" style="margin-bottom:0.75rem">
                Supply rate defaults to this material's own rate when you add a new option, but you can edit it per option. Set a label, height, supply rate, and install rate for each. The customer picks one option in the widget.
              </div>
              <div id="mqph-ct-bs-list"></div>
              <button type="button" class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphAddBsOption()" style="margin-top:6px">+ Add height option</button>
            </div>

            <!-- Cutout options for this material -->
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Cutout options for this material</div>
              <div class="mqph-info" style="margin-bottom:0.75rem">
                Sink and cooktop cutouts are included by default — remove either if you don't need them, or add your own (e.g. "Outlet cutout"). Each one appears as its own quantity field in the widget.
              </div>
              <div id="mqph-ct-cutout-list"></div>
              <button type="button" class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphAddCutoutOption()" style="margin-top:6px">+ Add cutout</button>
            </div>

            <div class="mqph-field" style="flex-direction:row;align-items:center;gap:10px">
              <label style="text-transform:none;font-size:13px;font-weight:500">Active</label>
              <input type="checkbox" id="mqph-ct-active" checked style="width:auto"/>
            </div>
          </div>
          <div class="mqph-modal-footer">
            <button class="mqph-btn mqph-btn-secondary" onclick="mqphCloseCTModal()">Cancel</button>
            <button class="mqph-btn mqph-btn-primary" onclick="mqphSaveCTItem()" style="margin-left:auto">Save</button>
          </div>
        </div>
      </div>`;
  }

  function buildTrimHtml() {
    const trimItems = lineItems.filter(r=>r.fields&&r.fields['Category']==='trim')
      .sort((a,b)=>(a.fields['Sort order']||0)-(b.fields['Sort order']||0));

    const crownItems   = trimItems.filter(r => (r.fields['Trim type']||'crown') === 'crown');
    const valanceItems = trimItems.filter(r => r.fields['Trim type'] === 'valance');

    function trimRow(r) {
      let linkedDoors = [];
      try { linkedDoors = r.fields['Linked door style'] ? JSON.parse(r.fields['Linked door style']) : []; } catch(e) { linkedDoors = []; }
      return `
        <div class="mqph-row">
          <div style="flex:1;min-width:0">
            <div class="mqph-row-name">${r.fields['Name']||'—'}</div>
            ${linkedDoors.length ? `<div style="font-size:11px;color:#16a34a;margin-top:2px">🔗 Auto-applies with: ${linkedDoors.join(', ')}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:13px;flex-wrap:wrap">
            <span style="color:#6b7280;font-size:11px">Supply:</span>
            <span style="font-weight:600">$${(r.fields['Rate']||0).toLocaleString()}</span>
            <span style="color:#6b7280;font-size:11px">/lin ft</span>
            <span style="color:#d1d5db;margin:0 4px">·</span>
            <span style="color:#6b7280;font-size:11px">Install:</span>
            <span style="font-weight:600">$${(r.fields['Install rate']||0).toLocaleString()}</span>
            <span style="color:#6b7280;font-size:11px">/lin ft</span>
          </div>
          <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active']?'on':''}" onclick="mqphToggle('${r.id}',this)"></div></div>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenTrimEdit('${r.id}')">Edit</button>
          <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDelete('${r.id}')">Delete</button>
        </div>`;
    }

    const trimSection = (title, items, emptyMsg) => items.length > 0
      ? `<div style="padding:8px 16px 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;background:#f9fafb;border-bottom:1px solid #f3f4f6">${title}</div>
         ${items.map(trimRow).join('')}`
      : `<div style="padding:8px 16px 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;background:#f9fafb;border-bottom:1px solid #f3f4f6">${title}</div>
         <div style="padding:1rem 16px;font-size:13px;color:#9ca3af">${emptyMsg}</div>`;

    return `
      <div class="mqph-ct-block">
        <div class="mqph-cat-header">
          <span class="mqph-cat-title">👑 Crown moulding / valance</span>
          <button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="mqphOpenTrimAdd()">+ Add style</button>
        </div>
        <div id="mqph-trim-msg" class="mqph-msg"></div>
        ${trimSection('Crown moulding', crownItems, 'No crown moulding styles yet — add one above.')}
        ${trimSection('Valance', valanceItems, 'No valance styles yet — add one above.')}
        <div style="padding:0.75rem 16px;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6">Customers can choose crown, valance, both, or neither — cost is calculated from the upper cabinet linear footage plus any wall returns they enter.</div>
      </div>

      <!-- Trim add/edit modal -->
      <div class="mqph-overlay" id="mqph-trim-modal-overlay">
        <div class="mqph-modal">
          <div class="mqph-modal-hdr">
            <div><h3 id="mqph-trim-modal-title">Add crown / valance style</h3></div>
            <button class="mqph-modal-close" onclick="mqphCloseTrimModal()">×</button>
          </div>
          <div class="mqph-modal-body">
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin-bottom:1rem;font-size:12px;color:#92400e;line-height:1.6">
              Pricing isn't always equal across crown/valance styles — standard crown, crown to the ceiling, crown with a riser, different materials, etc. all cost differently. Add as many styles as you offer, each with its own rate. Since this is a ballpark estimate, use your average per-linear-foot pricing for each style.
            </div>
            <div class="mqph-field">
              <label>Type</label>
              <select id="mqph-trim-type"><option value="crown">Crown moulding</option><option value="valance">Valance</option></select>
            </div>
            <div class="mqph-field">
              <label>Style name</label>
              <input type="text" id="mqph-trim-name" placeholder="e.g. Standard crown — Maple"/>
            </div>
            <div class="mqph-field">
              <label>Auto-apply with door styles <span style="text-transform:none;font-weight:400;color:#9ca3af">(optional, pick as many as apply)</span></label>
              <div id="mqph-trim-door-link-list" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;max-height:160px;overflow-y:auto"></div>
              <div style="font-size:11px;color:#9ca3af;margin-top:4px">If checked, this trim is automatically suggested whenever a customer chooses one of these door styles — they can still switch it themselves if they want something different.</div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Supply rate (per linear foot)</div>
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:13px;color:#6b7280">$</span>
                <input type="number" id="mqph-trim-supply-rate" placeholder="0.00" step="0.01" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
                <span style="font-size:13px;color:#6b7280">/ lin ft</span>
              </div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Install rate (per linear foot)</div>
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:13px;color:#6b7280">$</span>
                <input type="number" id="mqph-trim-install-rate" placeholder="0.00" step="0.01" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
                <span style="font-size:13px;color:#6b7280">/ lin ft</span>
              </div>
            </div>
            <div class="mqph-field" style="flex-direction:row;align-items:center;gap:10px">
              <label style="text-transform:none;font-size:13px;font-weight:500">Active</label>
              <input type="checkbox" id="mqph-trim-active" checked style="width:auto"/>
            </div>
          </div>
          <div class="mqph-modal-footer">
            <button class="mqph-btn mqph-btn-secondary" onclick="mqphCloseTrimModal()">Cancel</button>
            <button class="mqph-btn mqph-btn-primary" onclick="mqphSaveTrimItem()" style="margin-left:auto">Save</button>
          </div>
        </div>
      </div>`;
  }

  let currentCTEditId = null;
  let currentTrimEditId = null;
  let currentBsOptions = []; // in-memory list while the CT modal is open
  let currentCutoutOptions = []; // in-memory list while the CT modal is open

  // Called by oninput on the supply rate field and onchange on supply unit dropdown
  window.mqphSyncBsSupplyRate = function() {
    const rate = parseFloat(document.getElementById('mqph-ct-supply-rate')?.value || 0);
    const unit = document.getElementById('mqph-ct-supply-unit')?.value || 'sqft';
    currentBsOptions.forEach(o => {
      if (o._supplyAutoSync !== false) { o.supplyRate = rate; o.supplyUnit = unit; }
    });
    mqphRenderBsList();
  };

  // Called by oninput on the install rate field and onchange on install unit dropdown
  window.mqphSyncBsInstallRate = function() {
    const rate = parseFloat(document.getElementById('mqph-ct-install-rate')?.value || 0);
    const unit = document.getElementById('mqph-ct-install-unit')?.value || 'sqft';
    currentBsOptions.forEach(o => {
      if (o._installAutoSync !== false) { o.installRate = rate; o.installUnit = unit; }
    });
    mqphRenderBsList();
  };

  function mqphRenderBsList() {
    const list = document.getElementById('mqph-ct-bs-list');
    if (!list) return;
    if (!currentBsOptions.length) {
      list.innerHTML = `<div style="font-size:12px;color:#9ca3af;padding:6px 0">No height options yet — add one below.</div>`;
      return;
    }
    const matSupplyUnit  = document.getElementById('mqph-ct-supply-unit')?.value  || 'sqft';
    const matInstallUnit = document.getElementById('mqph-ct-install-unit')?.value || 'sqft';
    const unitOpts = (selected) => ['sqft','lin ft'].map(u => `<option value="${u}" ${u===selected?'selected':''}>${u}</option>`).join('');
    list.innerHTML = currentBsOptions.map((o,i) => `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:8px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
          <div style="display:flex;flex-direction:column;gap:3px;flex:2;min-width:110px">
            <span style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em">Name</span>
            <input type="text" value="${(o.label||'').replace(/"/g,'&quot;')}" placeholder='e.g. 4" standard' oninput="mqphUpdateBsOption(${i},'label',this.value,false)" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px;width:100%"/>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;width:80px">
            <span style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em">Height (in)</span>
            <input type="number" value="${o.heightIn!=null?o.heightIn:''}" placeholder="4" oninput="mqphUpdateBsOption(${i},'heightIn',this.value,false)" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px;width:100%;text-align:right"/>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;min-width:90px">
            <span style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em">Supply $</span>
            <div style="display:flex;gap:4px;align-items:center">
              <input type="number" value="${o.supplyRate!=null?o.supplyRate:''}" placeholder="0.00" step="0.01" oninput="mqphUpdateBsOption(${i},'supplyRate',this.value,true)" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px;width:80px;text-align:right"/>
              <select onchange="mqphUpdateBsOption(${i},'supplyUnit',this.value,false)" style="font-family:inherit;font-size:12px;border:1px solid #d1d5db;border-radius:8px;padding:6px 6px;min-width:60px">${unitOpts(o.supplyUnit||matSupplyUnit)}</select>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;min-width:90px">
            <span style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em">Install $</span>
            <div style="display:flex;gap:4px;align-items:center">
              <input type="number" value="${o.installRate!=null?o.installRate:''}" placeholder="0.00" step="0.01" oninput="mqphUpdateBsOption(${i},'installRate',this.value,true)" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px;width:80px;text-align:right"/>
              <select onchange="mqphUpdateBsOption(${i},'installUnit',this.value,false)" style="font-family:inherit;font-size:12px;border:1px solid #d1d5db;border-radius:8px;padding:6px 6px;min-width:60px">${unitOpts(o.installUnit||matInstallUnit)}</select>
            </div>
          </div>
          <button type="button" class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphRemoveBsOption(${i})" style="flex-shrink:0;margin-bottom:1px">✕</button>
        </div>
      </div>`).join('');
  }

  window.mqphAddBsOption = function() {
    const matSupply  = parseFloat(document.getElementById('mqph-ct-supply-rate')?.value  || 0);
    const matInstall = parseFloat(document.getElementById('mqph-ct-install-rate')?.value || 0);
    const matSupplyUnit  = document.getElementById('mqph-ct-supply-unit')?.value  || 'sqft';
    const matInstallUnit = document.getElementById('mqph-ct-install-unit')?.value || 'sqft';
    currentBsOptions.push({ label:'', heightIn:4, supplyRate:matSupply, supplyUnit:matSupplyUnit, installRate:matInstall, installUnit:matInstallUnit, _supplyAutoSync:true, _installAutoSync:true });
    mqphRenderBsList();
  };

  window.mqphRemoveBsOption = function(i) {
    currentBsOptions.splice(i,1);
    mqphRenderBsList();
  };

  function mqphRenderCutoutList() {
    const list = document.getElementById('mqph-ct-cutout-list');
    if (!list) return;
    if (!currentCutoutOptions.length) {
      list.innerHTML = `<div style="font-size:12px;color:#9ca3af;padding:6px 0">No cutout options — add one below (e.g. "Sink cutout").</div>`;
      return;
    }
    list.innerHTML = currentCutoutOptions.map((o,i) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <input type="text" value="${(o.label||'').replace(/"/g,'&quot;')}" placeholder="Label, e.g. Sink cutout" oninput="mqphUpdateCutoutOption(${i},'label',this.value)" style="flex:1;min-width:120px;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
        <span style="font-size:11px;color:#9ca3af">$</span>
        <input type="number" value="${o.rate!=null?o.rate:''}" placeholder="Rate" step="0.01" oninput="mqphUpdateCutoutOption(${i},'rate',this.value)" style="width:100px;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
        <span style="font-size:11px;color:#9ca3af">each</span>
        <button type="button" class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphRemoveCutoutOption(${i})">✕</button>
      </div>`).join('');
  }

  window.mqphAddCutoutOption = function() {
    currentCutoutOptions.push({label:'', rate:0});
    mqphRenderCutoutList();
  };

  window.mqphRemoveCutoutOption = function(i) {
    currentCutoutOptions.splice(i,1);
    mqphRenderCutoutList();
  };

  window.mqphUpdateCutoutOption = function(i, key, val) {
    if (!currentCutoutOptions[i]) return;
    currentCutoutOptions[i][key] = key==='rate' ? parseFloat(val||0) : val;
  };

  window.mqphUpdateBsOption = function(i, key, val, manualEdit) {
    if (!currentBsOptions[i]) return;
    currentBsOptions[i][key] = (key==='heightIn'||key==='installRate'||key==='supplyRate') ? parseFloat(val||0) : val;
    if (manualEdit) {
      if (key === 'supplyRate')  currentBsOptions[i]._supplyAutoSync  = false;
      if (key === 'installRate') currentBsOptions[i]._installAutoSync = false;
    }
  };

  window.mqphOpenCTAdd = function() {
    currentCTEditId = null;
    currentCutoutOptions = [{label:'Sink cutout', rate:180}, {label:'Cooktop cutout', rate:220}];
    document.getElementById('mqph-ct-modal-title').textContent = 'Add countertop material';
    document.getElementById('mqph-ct-name').value = '';
    document.getElementById('mqph-ct-supply-rate').value = '';
    document.getElementById('mqph-ct-supply-unit').value = 'sqft';
    document.getElementById('mqph-ct-install-rate').value = '';
    document.getElementById('mqph-ct-install-unit').value = 'sqft';
    document.getElementById('mqph-ct-active').checked = true;
    // Default row starts at 0 — auto-sync flags mean it will update live as user types rates above
    currentBsOptions = [{ label:'4" standard', heightIn:4, supplyRate:0, supplyUnit:'sqft', installRate:0, installUnit:'sqft', _supplyAutoSync:true, _installAutoSync:true }];
    mqphRenderBsList();
    mqphRenderCutoutList();
    document.getElementById('mqph-ct-modal-overlay').classList.add('show');
  };

  window.mqphOpenCTEdit = function(id) {
    const rec = lineItems.find(r=>r.id===id); if(!rec) return;
    currentCTEditId = id;
    currentBsOptions = getBsOptions(rec);
    const matSupply  = rec.fields['Rate']||0;
    const matInstall = rec.fields['Install rate']||0;
    const unitParts  = (rec.fields['Unit']||'sqft|sqft').split('|');
    const matSupplyUnit  = (unitParts[0]||'sqft').trim();
    const matInstallUnit = (unitParts[1]||'sqft').trim();
    // Backfill any missing rate/unit fields on existing bs rows
    currentBsOptions.forEach(o => {
      if (o.supplyRate==null || o.supplyRate===0)  { o.supplyRate  = matSupply;  o._supplyAutoSync  = true; }
      if (o.supplyUnit==null)  o.supplyUnit  = matSupplyUnit;
      if (o.installRate==null || o.installRate===0) { o.installRate = matInstall; o._installAutoSync = true; }
      if (o.installUnit==null) o.installUnit = matInstallUnit;
    });
    currentCutoutOptions = getCutoutOptions(rec);
    if (!currentCutoutOptions.length && (rec.fields['Sink cutout rate']!=null || rec.fields['Cooktop cutout rate']!=null)) {
      currentCutoutOptions = [
        {label:'Sink cutout', rate:rec.fields['Sink cutout rate']!=null?rec.fields['Sink cutout rate']:180},
        {label:'Cooktop cutout', rate:rec.fields['Cooktop cutout rate']!=null?rec.fields['Cooktop cutout rate']:220},
      ];
    }
    document.getElementById('mqph-ct-modal-title').textContent = 'Edit countertop material';
    document.getElementById('mqph-ct-name').value = rec.fields['Name']||'';
    document.getElementById('mqph-ct-supply-rate').value  = matSupply||'';
    document.getElementById('mqph-ct-supply-unit').value  = matSupplyUnit;
    document.getElementById('mqph-ct-install-rate').value = matInstall||'';
    document.getElementById('mqph-ct-install-unit').value = matInstallUnit;
    document.getElementById('mqph-ct-active').checked = rec.fields['Active']!==false;
    mqphRenderBsList();
    mqphRenderCutoutList();
    document.getElementById('mqph-ct-modal-overlay').classList.add('show');
  };

  window.mqphCloseCTModal = function() { document.getElementById('mqph-ct-modal-overlay')?.classList.remove('show'); };

  window.mqphSaveCTItem = async function() {
    const name = document.getElementById('mqph-ct-name').value.trim();
    if (!name) { alert('Please enter a name.'); return; }
    const su = document.getElementById('mqph-ct-supply-unit').value;
    const iu = document.getElementById('mqph-ct-install-unit').value;
    // Drop any half-filled backsplash/cutout rows (no label) before saving
    const cleanBsOptions = currentBsOptions.filter(o => (o.label||'').trim().length > 0);
    const cleanCutoutOptions = currentCutoutOptions.filter(o => (o.label||'').trim().length > 0);
    const fields = {
      shop:[shopRecord._recordId], Name:name, Category:'countertop',
      Rate:parseFloat(document.getElementById('mqph-ct-supply-rate').value||0),
      'Install rate':parseFloat(document.getElementById('mqph-ct-install-rate').value||0),
      Unit:`${su}|${iu}`, Description:'type:material',
      'Backsplash options': JSON.stringify(cleanBsOptions),
      'Cutout options': JSON.stringify(cleanCutoutOptions),
      Active:document.getElementById('mqph-ct-active').checked,
    };
    try {
      if (currentCTEditId) { await atUpdate(LINE_ITEMS_TABLE, currentCTEditId, fields); }
      else { fields['Sort order'] = lineItems.filter(r=>r.fields?.['Category']==='countertop').length + 1; await atCreate(LINE_ITEMS_TABLE, fields); }
      mqphCloseCTModal();
      await loadAndRender();
    } catch(e) { alert('Error saving. Please try again.'); }
  };

  function populateTrimDoorOptions(selectedDoorNames) {
    const list = document.getElementById('mqph-trim-door-link-list');
    if (!list) return;
    const selected = Array.isArray(selectedDoorNames) ? selectedDoorNames : (selectedDoorNames ? [selectedDoorNames] : []);
    const doorItems = lineItems.filter(r=>r.fields&&r.fields['Category']==='door');
    if (!doorItems.length) {
      list.innerHTML = '<div style="font-size:12px;color:#9ca3af">No door styles set up yet.</div>';
      return;
    }
    list.innerHTML = doorItems.map((d,i) => {
      const name = d.fields['Name']||'';
      const checked = selected.includes(name) ? 'checked' : '';
      return `<label class="mqph-trim-door-row" style="display:flex !important;flex-direction:row !important;align-items:center !important;gap:8px !important;font-size:13px !important;font-weight:400 !important;text-transform:none !important;letter-spacing:normal !important;color:#374151 !important;cursor:pointer;padding:6px 4px;border-radius:6px"
        onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='transparent'">
        <input type="checkbox" class="mqph-trim-door-checkbox" value="${name.replace(/"/g,'&quot;')}" ${checked} style="width:16px !important;height:16px !important;flex-shrink:0;margin:0 !important"/>
        <span style="flex:1">${name}</span>
      </label>`;
    }).join('');
  }

  window.mqphOpenTrimAdd = function() {
    currentTrimEditId = null;
    document.getElementById('mqph-trim-modal-title').textContent = 'Add crown / valance style';
    document.getElementById('mqph-trim-type').value = 'crown';
    document.getElementById('mqph-trim-name').value = '';
    document.getElementById('mqph-trim-supply-rate').value = '';
    document.getElementById('mqph-trim-install-rate').value = '';
    document.getElementById('mqph-trim-active').checked = true;
    populateTrimDoorOptions([]);
    document.getElementById('mqph-trim-modal-overlay').classList.add('show');
  };

  window.mqphOpenTrimEdit = function(id) {
    const rec = lineItems.find(r=>r.id===id); if(!rec) return;
    currentTrimEditId = id;
    document.getElementById('mqph-trim-modal-title').textContent = 'Edit crown / valance style';
    document.getElementById('mqph-trim-type').value = rec.fields['Trim type'] || 'crown';
    document.getElementById('mqph-trim-name').value = rec.fields['Name']||'';
    document.getElementById('mqph-trim-supply-rate').value = rec.fields['Rate']||'';
    document.getElementById('mqph-trim-install-rate').value = rec.fields['Install rate']||'';
    document.getElementById('mqph-trim-active').checked = rec.fields['Active']!==false;
    let linkedDoors = [];
    try { linkedDoors = rec.fields['Linked door style'] ? JSON.parse(rec.fields['Linked door style']) : []; } catch(e) { linkedDoors = []; }
    populateTrimDoorOptions(linkedDoors);
    document.getElementById('mqph-trim-modal-overlay').classList.add('show');
  };

  window.mqphCloseTrimModal = function() { document.getElementById('mqph-trim-modal-overlay')?.classList.remove('show'); };

  window.mqphSaveTrimItem = async function() {
    const name = document.getElementById('mqph-trim-name').value.trim();
    if (!name) { alert('Please enter a name.'); return; }
    const trimType = document.getElementById('mqph-trim-type').value;
    const linkedDoors = Array.from(document.querySelectorAll('.mqph-trim-door-checkbox:checked')).map(cb => cb.value);
    const fields = {
      shop:[shopRecord._recordId], Name:name, Category:'trim',
      Rate:parseFloat(document.getElementById('mqph-trim-supply-rate').value||0),
      'Install rate':parseFloat(document.getElementById('mqph-trim-install-rate').value||0),
      Unit:'lin ft|lin ft', Description:'type:trim',
      'Trim type': trimType,
      'Linked door style': JSON.stringify(linkedDoors),
      Active:document.getElementById('mqph-trim-active').checked,
    };
    try {
      if (currentTrimEditId) { await atUpdate(LINE_ITEMS_TABLE, currentTrimEditId, fields); }
      else { fields['Sort order'] = lineItems.filter(r=>r.fields?.['Category']==='trim').length + 1; await atCreate(LINE_ITEMS_TABLE, fields); }
      mqphCloseTrimModal();
      await loadAndRender();
    } catch(e) { alert('Error saving. Please try again.'); }
  };

  // ============================================================
  // LOAD AND RENDER
  // ============================================================
  let ctMigrationDone = false;

  async function loadAndRender() {
    const container=document.getElementById('mq-pricing-helper-v2');
    if(!container) return;
    const recs=await atGet(LINE_ITEMS_TABLE,`FIND("${shopRecord._shopName}", ARRAYJOIN({shop}))`);
    lineItems=recs.filter(r=>r.fields);
    if (!ctMigrationDone) {
      ctMigrationDone = true; // set before awaiting so a second call can't race in
      await migrateCTPricing();
    }
    container.innerHTML=buildEditorHTML();
  }

  window.loadAndRender=loadAndRender;

  // ============================================================
  // INIT
  // ============================================================
  window.mqph2Init = function(passedShopRecord, passedPricingRecord) {
    if (!passedShopRecord) return;
    shopRecord = {
      ...passedShopRecord,
      _recordId: passedShopRecord.id,
      _shopName: (passedShopRecord.fields && passedShopRecord.fields['Shop name']) || '',
      _baseId:   'app4zrMlVLwF2xn4h',
      _token:    'patulbU1ndSvFpMDo.906a8be9e784fb12de048d4238c5d553859f8d57670ccd1bc1a6de4e2da37325',
      _pricingTable: 'tblu6AYZs8h7SIaQl',
    };
    pricingRecord = passedPricingRecord;
    injectStyles();
    loadAndRender();
  };

})();