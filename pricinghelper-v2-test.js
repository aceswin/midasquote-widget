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
  let wizardStepContrib = {}; // stepIndex -> the wizardItems that step's onNext added last time through
  let wizardFinishing = false;
  let currentEditId = null;

  // Mini-wizard state
  let miniWiz = { cat: null, name: '', step: 0, matchMode: false, matchName: '', matchRates: null, bulkMode: false, bulkCount: 0, bulkRates: null, bulkNames: [] };

  // Shops outside North America think in mm, not inches — rather than a full
  // imperial/metric toggle, every inch/foot measurement shown in the wizard
  // also gets its mm equivalent inline so metric shops never need a
  // calculator. Everything still gets stored/output in linear feet either way.
  const mqphMm = (inches) => Math.round(inches * 25.4);
  const mqphMmTag = (inches) => `<span class="mqph-mm">(${mqphMm(inches).toLocaleString()}mm)</span>`;

  const AT_BASE_URL = () => `https://api.airtable.com/v0/${shopRecord._baseId}`;
  const AT_HEADS = () => ({ 'Authorization': `Bearer ${shopRecord._token}`, 'Content-Type': 'application/json' });

  // A UK (or any non-North-American) shop can pick their own currency
  // symbol on the dashboard's Shop Info tab — everywhere in the pricing
  // wizard that used to show a hardcoded "$" now reads it from here
  // instead, falling back to "$" for shops that haven't set one.
  // shopRecord is populated by mqph2Init() (passed in from dashboard.js's
  // already-loaded shop record) before loadAndRender() ever runs.
  function CUR() { return (shopRecord && shopRecord.fields && shopRecord.fields['Currency symbol']) || '$'; }

  async function atGet(table, formula) {
    const url = `${AT_BASE_URL()}/${table}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=200`;
    const res = await fetch(url, { headers: AT_HEADS() });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Airtable GET ${table} failed: ${res.status} ${errBody}`);
    }
    const data = await res.json();
    return data.records || [];
  }
  async function atCreate(table, fields) {
    // typecast:true lets Airtable auto-add a new option to a Single Select
    // field instead of rejecting the request with a 422 when the value
    // isn't already one of the field's known choices.
    const res = await fetch(`${AT_BASE_URL()}/${table}`, { method: 'POST', headers: AT_HEADS(), body: JSON.stringify({ fields, typecast: true }) });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`Airtable CREATE ${table} failed: ${res.status}`, errBody);
      throw new Error(`Airtable CREATE ${table} failed: ${res.status} ${errBody}`);
    }
    return await res.json();
  }
  async function atUpdate(table, id, fields) {
    const res = await fetch(`${AT_BASE_URL()}/${table}/${id}`, { method: 'PATCH', headers: AT_HEADS(), body: JSON.stringify({ fields, typecast: true }) });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`Airtable UPDATE ${table} failed: ${res.status}`, errBody);
      throw new Error(`Airtable UPDATE ${table} failed: ${res.status} ${errBody}`);
    }
    return await res.json();
  }
  async function atDelete(table, id) {
    const res = await fetch(`${AT_BASE_URL()}/${table}/${id}`, { method: 'DELETE', headers: AT_HEADS() });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Airtable DELETE ${table} failed: ${res.status} ${errBody}`);
    }
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
      .mqph-mm{font-weight:500 !important;color:#9ca3af !important}

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
      /* Chrome/Edge draw their own little dropdown arrow on any input with
         a "list" attribute — hides it so it doesn't overlap the custom ▼
         we render ourselves next to the Group name fields. */
      input[list]::-webkit-calendar-picker-indicator{display:none !important}
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
    { id:'door',     label:'🚪 Door styles',             sub:'Think species and profile — maple shaker, oak raised panel, MDF slab, and so on. Unless you charge significantly more for one finish over another, you don\'t need a separate item for each finish. Keep it to your most popular styles.', placeholder:'e.g. Maple shaker' },
   { id:'drawer_config', label:'🗄️ Drawer configurations', sub:"Add your drawer options by material and close type — that's all customers care about. Something like 'White melamine — soft-close' or 'Prefinished birch — soft-close'. Skip the slide type and hardware details — keep it customer-friendly.", placeholder:'e.g. Prefinished birch — soft-close' },
    { id:'hinge',    label:'🔧 Door hinges',             sub:'Pre-added — Hinge options you offer — your cheapest hinge is the baseline, others become upcharges. Most shops only need these 2 options.', placeholder:'e.g. Push to open hinge system' },
  ];

  const CAT_LABELS = {
    material:'🪵 Box materials', door:'🚪 Door styles', drawer:'🗄️ Drawer configurations', drawer_config:'🗄️ Drawer configurations',
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
  const DEFAULT_HINGES = ['Regular hinges','Soft-close hinges'];

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
        <p style="font-size:13px;color:#6b7280;line-height:1.6">Start with the materials, door styles, and drawer configs you sell most — your everyday go-tos, not the rare special orders. A focused list gives customers a better experience and makes your widget feel clean and professional.</p>
      </div>

      ${CATEGORIES.map(cat => {
        const allItems = (existing[cat.id] || []).sort((a,b) => (a.fields['Sort order']||0)-(b.fields['Sort order']||0));
        let items;
        if (cat.id === 'material') {
          // Deduplicate by base name — strip "— uppers"/"— bases" so only one chip per material
          const seenBaseNames = new Set();
          items = allItems.filter(r => {
            const baseName = (r.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i, '').trim();
            if (seenBaseNames.has(baseName)) return false;
            seenBaseNames.add(baseName);
            return true;
          }).map(r => ({
            ...r,
            fields: { ...r.fields, Name: (r.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i, '').trim() }
          }));
        } else {
          items = allItems;
        }
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
    // For drawer_config chips: also delete all associated priced 'drawer' records
    if (cat === 'drawer_config') {
      const configRec = lineItems.find(r => r.id === id);
      const baseName = configRec?.fields['Name'] || '';
      if (baseName) {
        const pricedDrawers = lineItems.filter(r =>
          r.fields && r.fields['Category'] === 'drawer' &&
          (r.fields['Name']||'').replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim() === baseName
        );
        for (const r of pricedDrawers) {
          try { await atDelete(LINE_ITEMS_TABLE, r.id); } catch(e) {}
        }
        lineItems = lineItems.filter(r => !pricedDrawers.find(p => p.id === r.id));
      }
    }
    // For doors: any crown/valance linked to this door style needs that
    // link cleaned up too, otherwise it keeps pointing at a door name that
    // no longer exists — the widget would just silently never match it,
    // but it'd sit there stale in the dashboard forever.
    if (cat === 'door') {
      const doorRec = lineItems.find(r => r.id === id);
      const doorName = doorRec?.fields['Name'] || '';
      if (doorName) {
        const linkedTrims = lineItems.filter(r => {
          if (!r.fields || r.fields['Category'] !== 'trim') return false;
          let linked = [];
          try { linked = r.fields['Linked door style'] ? JSON.parse(r.fields['Linked door style']) : []; } catch(e) { linked = []; }
          return linked.includes(doorName);
        });
        for (const t of linkedTrims) {
          let linked = [];
          try { linked = JSON.parse(t.fields['Linked door style']); } catch(e) { linked = []; }
          const cleaned = linked.filter(name => name !== doorName);
          try {
            await atUpdate(LINE_ITEMS_TABLE, t.id, { 'Linked door style': JSON.stringify(cleaned) });
            t.fields['Linked door style'] = JSON.stringify(cleaned);
          } catch(e) { console.error('Failed to clean up linked door style', e); }
        }
      }
    }
    await atDelete(LINE_ITEMS_TABLE, id);
    lineItems = lineItems.filter(r => r.id !== id);
    const chip = document.getElementById(`mqph-chip-${id}`);
    if (chip) chip.remove();
  };

window.mqphGoToWizard = function() {
    wizardStep = 0; wizardItems = []; wizardBaseline = null; wizardFinishing = false; wizardStepContrib = {};
    const container = document.getElementById('mq-pricing-helper-v2');
    if (container) { container.innerHTML = buildWizardHTML(); renderWizardStep(0); }
  };

  // ============================================================
  // WIZARD STEPS
  // ============================================================
  function buildWizardSteps() {
    // Deduplicate materials by base name — strip "— uppers"/"— bases" so wizard
    // only shows one entry per material (e.g. "White melamine" not both variants)
    const allMaterials = getByCategory('material');
    const seenMatNames = new Set();
    const materials = allMaterials.filter(m => {
      const baseName = (m.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i, '').trim();
      if (seenMatNames.has(baseName)) return false;
      seenMatNames.add(baseName);
      return true;
    }).map(m => ({
      ...m,
      fields: { ...m.fields, Name: (m.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i, '').trim() }
    }));
    const doorStyles = getByCategory('door');
    // drawer_config = user-defined base names (source for wizard steps)
    // drawer = priced sub-records created by wizard (some/mostly variants)
    const drawers    = getByCategory('drawer_config');
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
          <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} cabinet</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} cabinet</span> = <span class="mqph-spec-tag">4 linear feet ${mqphMmTag(48)}</span>
        </div>
        <div style="font-size:13px;color:#374151;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:1.25rem;line-height:1.6">💡 <strong>Tip:</strong> Just price your main, most-common items here — not every single variation. Once your baseline is set, use the <strong>+ Add</strong> button on each category to add a whole batch of similarly-priced items at once — much faster than running through this wizard for every option.</div>
        <div style="font-size:13px;color:#374151;line-height:1.9;margin-bottom:1.25rem">
          ✅ Box-only baseline (no doors, no drawers)<br/>
          ✅ Door styles as upcharges<br/>
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
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} upper</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} upper</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `<strong>No doors · No drawers · No hardware · Supply only</strong>`,
          ])}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-bl-u-price" placeholder="0.00" oninput="mqphCalc('bl-u')"/></div>
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
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `<strong>No doors · No drawers · Supply only · Include toe kick</strong>`,
          ])}
          ${wizardBaseline?.upperRate>0?`<p style="font-size:12px;color:#6b7280;margin-bottom:12px">Your upper rate was ${CUR()}${wizardBaseline.upperRate.toFixed(2)}/ft — bases are usually higher (toe kick).</p>`:''}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-bl-b-price" placeholder="0.00" oninput="mqphCalc('bl-b')"/></div>
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
                `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
                `Material: <span class="mqph-spec-tag">${m.fields['Name']}</span> · No doors · No drawers · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-mat-${idx}" placeholder="0.00" oninput="mqphCalcMatUp(${idx})"/></div>
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
            if (p>0 && wizardBaseline) {
              const upcharge  = (p - wizardBaseline.basePrice) / 4;
              const upperRate = (wizardBaseline.upperRate || 0) + upcharge;
              const baseRate  = (wizardBaseline.baseRate  || 0) + upcharge;
              wizardItems.push({ name:m.fields['Name']+' — uppers', category:'material', rate:Math.round(upperRate*100)/100, unit:'per lin ft — uppers', description:'Baseline uppers + material upcharge', active:true });
              wizardItems.push({ name:m.fields['Name']+' — bases',  category:'material', rate:Math.round(baseRate*100)/100, unit:'per lin ft — bases',  description:'Baseline bases + material upcharge',  active:true });
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
          <div class="mqph-hl">Doors are priced as an upcharge on top of the box.</div>
          ${specBox([
            `<strong>Base cabinets + baseline door style (no drawers)</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `Door style: <span class="mqph-spec-tag">${doorName}</span> · <span class="mqph-spec-tag">3 doors: 2 on 30" ${mqphMmTag(30)}, 1 on 18" ${mqphMmTag(18)}</span>`,
            `Hinges: <span class="mqph-spec-tag">${hingeName}</span> · No drawers · Supply only`,
          ])}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-door-baseline" placeholder="0.00" oninput="mqphCalcDoorBaseline()"/></div>
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
                `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
                `Material: <span class="mqph-spec-tag">${matName}</span> · Door: <span class="mqph-spec-tag">${d.fields['Name']}</span>`,
                `<span class="mqph-spec-tag">3 doors: 2 on 30" ${mqphMmTag(30)}, 1 on 18" ${mqphMmTag(18)}</span> · Hinges: <span class="mqph-spec-tag">${hingeName}</span> · No drawers · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-door-${idx}" placeholder="0.00" oninput="mqphCalcDoorUp(${idx})"/></div>
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
                `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
                `Material: <span class="mqph-spec-tag">${matName}</span> · Door: <span class="mqph-spec-tag">${doorName}</span>`,
                `Hinges: <span class="mqph-spec-tag">${h.fields['Name']}</span> (instead of ${blHingeName}) · No drawers · Supply only`,
              ])}
              <div class="mqph-input-row"><label>Your price with ${h.fields['Name']}?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-hinge-${idx}" placeholder="0.00" oninput="mqphCalcHingeUp(${idx})"/></div>
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
                  `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
                  `Material: <span class="mqph-spec-tag">${matName}</span> · Drawers: <span class="mqph-spec-tag">${d.fields['Name']}</span>`,
                  `<strong>1 top drawer per cabinet · Include slides/guides · No doors · No drawer fronts · Supply only</strong>`,
                ])}
                <div class="mqph-input-row"><label>Your price for this job?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-drawer1-${idx}" placeholder="0.00" oninput="mqphCalcDrawer1(${idx})"/></div>
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
                  `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
                  `Material: <span class="mqph-spec-tag">${matName}</span> · Drawers: <span class="mqph-spec-tag">${d.fields['Name']}</span>`,
                  `<strong>Full drawer bank (3 per cabinet) · Include slides/guides · No doors · No drawer fronts · Supply only</strong>`,
                ])}
                ${p1>0?`<p style="font-size:12px;color:#6b7280;margin-bottom:10px">1-drawer quote was ${CUR()}${p1.toLocaleString()} — bank quote should be higher.</p>`:''}
                <div class="mqph-input-row"><label>Your price for this job?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-drawer3-${idx}" placeholder="0.00" oninput="mqphCalcDrawer3(${idx})"/></div>
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
                unit: 'per lin ft',
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
                unit: 'per lin ft',
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
            <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) uppers, <strong>box only</strong> (no doors)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-u-nd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
            <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) uppers, <strong>with doors</strong> (hang, adjust and install handles)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-u-wd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
          </div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🔽 Base cabinets — install only</div>
            <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) bases, <strong>box only</strong> (no doors)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-b-nd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
            <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) bases, <strong>with doors</strong> (hang, adjust and install handles)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-b-wd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
          </div>
          <div id="mqph-r-install" class="mqph-result"></div>
          <div style="height:1px;background:#e5e7eb;margin:1.25rem 0"></div>
          <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🗑️ Cabinet removal & disposal</div>
          <div class="mqph-input-row"><label>What would you charge to remove & dispose those same 4 linear feet (${mqphMm(48).toLocaleString()}mm) of base cabinets with doors?</label></div>
          <p style="font-size:12px;color:#6b7280;margin-bottom:10px;line-height:1.5">Include your cost to haul away and dispose of the old cabinets. <span id="mqph-removal-hint" style="color:#1d4ed8;font-weight:500"></span></p>
          <div class="mqph-input-row"><label>Removal & disposal price for 4ft (${mqphMm(48).toLocaleString()}mm) job</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-removal" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
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
    if(p>0){res.style.display='block';res.innerHTML=`<strong>${cfg.label}:</strong> <span class="mqph-result-val">${CUR()}${cfg.calc(p).toFixed(2)}/lin ft</span>`;}
    else res.style.display='none';
  };
  window.mqphCalcMatUp = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-mat-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-mat-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){
      const upcharge  = (p - wizardBaseline.basePrice) / 4;
      const upperRate = (wizardBaseline.upperRate || 0) + upcharge;
      const baseRate  = (wizardBaseline.baseRate  || 0) + upcharge;
      res.style.display='block';
      res.innerHTML=`<strong>Upcharge:</strong> <span class="mqph-result-val">${CUR()}${upcharge.toFixed(2)}/lin ft</span> <span style="font-size:12px;color:#6b7280">&nbsp;→ uppers ${CUR()}${upperRate.toFixed(2)}/ft · bases ${CUR()}${baseRate.toFixed(2)}/ft</span>`;
    }
    else res.style.display='none';
  };
  window.mqphCalcDoorBaseline = function() {
    const p=parseFloat(document.getElementById('mqph-door-baseline')?.value||0);
    const res=document.getElementById('mqph-r-door-baseline'); if(!res||!wizardBaseline) return;
    if(p>0){
      const u=(p-wizardBaseline.basePrice)/4;
      res.style.display='block';
      res.innerHTML=`<strong>Door upcharge:</strong> <span class="mqph-result-val">${CUR()}${u.toFixed(2)}/lin ft</span> <span style="font-size:12px;color:#6b7280">&nbsp;(box ${CUR()}${wizardBaseline.baseRate.toFixed(2)} + door ${CUR()}${u.toFixed(2)} = ${CUR()}${(wizardBaseline.baseRate+u).toFixed(2)}/ft total)</span>`;
    } else res.style.display='none';
  };
  window.mqphCalcDoorUp = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-door-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-door-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){const u=(p-wizardBaseline.basePrice)/4;res.style.display='block';res.innerHTML=`<strong>Upcharge vs plain box:</strong> <span class="mqph-result-val">${CUR()}${u.toFixed(2)}/lin ft</span>`;}
    else res.style.display='none';
  };
  window.mqphCalcHingeUp = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-hinge-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-hinge-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){const u=(p-(wizardBaseline.baseWithDoorPrice||wizardBaseline.basePrice))/4;res.style.display='block';res.innerHTML=`<strong>Hinge upcharge:</strong> <span class="mqph-result-val">${CUR()}${u.toFixed(2)}/lin ft</span>`;}
    else res.style.display='none';
  };
  window.mqphCalcDrawer1 = function(idx) {
    const p=parseFloat(document.getElementById(`mqph-drawer1-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-drawer1-${idx}`); if(!res||!wizardBaseline) return;
    if(p>0){
      const u=(p-wizardBaseline.basePrice)/4;
      res.style.display='block';
      res.innerHTML=`<strong>"Some drawers" upcharge:</strong> <span class="mqph-result-val">${CUR()}${u.toFixed(2)}/lin ft</span>`;
    } else res.style.display='none';
  };
  window.mqphCalcDrawer3 = function(idx) {
    const p3=parseFloat(document.getElementById(`mqph-drawer3-${idx}`)?.value||0);
    const res=document.getElementById(`mqph-r-drawer3-${idx}`); if(!res||!wizardBaseline) return;
    const p1=wizardBaseline?.drawer1Prices?.[idx]||0;
    if(p3>0){
      const mostlyRate=((p1+p3)/2-wizardBaseline.basePrice)/4;
      res.style.display='block';
      res.innerHTML=`<strong>"Mostly drawers" upcharge:</strong> <span class="mqph-result-val">${CUR()}${mostlyRate.toFixed(2)}/lin ft</span> <span style="font-size:12px;color:#6b7280">(average of ${CUR()}${p1.toLocaleString()} + ${CUR()}${p3.toLocaleString()})</span>`;
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
    if(und>0) html+=`Uppers (no doors): <span class="mqph-result-val">${CUR()}${(und/4).toFixed(2)}/lin ft</span><br/>`;
    if(uwd>0) html+=`Uppers (with doors): <span class="mqph-result-val">${CUR()}${(uwd/4).toFixed(2)}/lin ft</span><br/>`;
    if(bnd>0) html+=`Bases (no doors): <span class="mqph-result-val">${CUR()}${(bnd/4).toFixed(2)}/lin ft</span><br/>`;
    if(bwd>0) {
      html+=`Bases (with doors): <span class="mqph-result-val">${CUR()}${(bwd/4).toFixed(2)}/lin ft</span><br/>`;
      html+=`Bases (some drawers): <span class="mqph-result-val">${CUR()}${(bwd/4*1.10).toFixed(2)}/lin ft</span> <span style="font-size:11px;color:#9ca3af">auto +10%</span><br/>`;
      html+=`Bases (mostly drawers): <span class="mqph-result-val">${CUR()}${(bwd/4*1.15).toFixed(2)}/lin ft</span> <span style="font-size:11px;color:#9ca3af">auto +15%</span>`;
      // Update removal suggestion hint
      const hint = document.getElementById('mqph-removal-hint');
      if (hint) hint.textContent = `Suggested: ${CUR()}${Math.round(bwd*0.5)} (half your base install with doors rate)`;
    }
    if(html){res.style.display='block';res.innerHTML=html;}else res.style.display='none';
    // Removal live rate
    const remRes = document.getElementById('mqph-r-removal');
    if (remRes) {
      if(rem>0){remRes.style.display='block';remRes.innerHTML=`<strong>Removal rate:</strong> <span class="mqph-result-val">${CUR()}${(rem/4).toFixed(2)}/lin ft</span>`;}
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
    // If we've been through this step before (i.e. the user hit Back to fix
    // something and is now hitting Next again), pull out whatever it added
    // last time before letting onNext push a fresh set — otherwise every
    // revisit adds another duplicate copy on top.
    if (wizardStepContrib[wizardStep]) {
      wizardStepContrib[wizardStep].forEach(item => {
        const idx = wizardItems.indexOf(item);
        if (idx !== -1) wizardItems.splice(idx, 1);
      });
    }
    const startLen = wizardItems.length;
    const result=steps[wizardStep].onNext?steps[wizardStep].onNext():null;
    if(result==='abort'){loadAndRender();return;}
    wizardStepContrib[wizardStep] = wizardItems.slice(startLen);
    wizardStep++;
    if(wizardStep>=steps.length) mqphFinishWizard(); else renderWizardStep(wizardStep);
  };
  window.mqphBack=function(){if(wizardStep>0){wizardStep--;renderWizardStep(wizardStep);}};
  window.mqphSkip=function(){
    // Skipping means "this step contributes nothing" — if it previously
    // contributed items (Next, then Back, then Skip instead), drop those too.
    if (wizardStepContrib[wizardStep]) {
      wizardStepContrib[wizardStep].forEach(item => {
        const idx = wizardItems.indexOf(item);
        if (idx !== -1) wizardItems.splice(idx, 1);
      });
      wizardStepContrib[wizardStep] = [];
    }
    wizardStep++;
    const steps=buildWizardSteps();
    if(wizardStep>=steps.length) mqphFinishWizard(); else renderWizardStep(wizardStep);
  };

  // ============================================================
  // FINISH WIZARD — full wipe + rewrite
  // ============================================================
 async function mqphFinishWizard() {
    if (wizardFinishing) return; // already saving — ignore a duplicate trigger
    wizardFinishing = true;
    const container=document.getElementById('mq-pricing-helper-v2');
    if(container) container.innerHTML='<div style="padding:3rem;text-align:center;color:#6b7280;font-size:14px">Saving your pricing…</div>';

    // Wipe all wizard-owned categories clean. Now that atDelete actually
    // throws on failure, a failed delete here would previously have been
    // silently swallowed by the empty catch and we'd carry on to create a
    // fresh replacement anyway — leaving the old, undeleted record plus a
    // brand-new duplicate. Retry once, and if it still fails, stop before
    // creating anything rather than risk more duplicates.
    const toDelete=lineItems.filter(r => r.fields && WIZARD_OWNED_CATEGORIES.includes(r.fields['Category']));
    const failedDeletes=[];
    for(const r of toDelete) {
      try { await atDelete(LINE_ITEMS_TABLE,r.id); }
      catch(e) {
        try { await atDelete(LINE_ITEMS_TABLE,r.id); }
        catch(e2) { console.error('Delete failed twice, giving up on this record:', r.id, e2); failedDeletes.push(r); }
      }
    }
    if (failedDeletes.length) {
      wizardFinishing = false;
      if (container) container.innerHTML = `<div style="padding:3rem;text-align:center;color:#dc2626;font-size:14px">Couldn't clear out ${failedDeletes.length} old pricing item(s) before saving — nothing else was changed, so you don't end up with duplicates. Please wait a moment and try again.</div>`;
      return;
    }

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
          <p>Spec used throughout every step: 1 × 30" (${mqphMm(30)}mm) + 1 × 18" (${mqphMm(18)}mm) = 4 lin ft (${mqphMm(48).toLocaleString()}mm)</p>
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

  // "Match another item's pricing" — lets a shop owner skip re-quoting the
  // whole spec job and just copy an existing item's rate(s) directly instead.
  // Material/drawer are 2-rate categories (uppers/bases, some/mostly drawers)
  // stored as paired records with the same base name; door/hinge are single-rate.
  function miniWizMatchOptions(cat) {
    if (cat === 'material') {
      return [...new Set(lineItems.filter(r=>r.fields&&r.fields['Category']==='material').map(r=>r.fields['Name'].replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim()))];
    }
    if (cat === 'drawer') {
      return [...new Set(lineItems.filter(r=>r.fields&&r.fields['Category']==='drawer').map(r=>r.fields['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i,'').trim()))];
    }
    return lineItems.filter(r=>r.fields&&r.fields['Category']===cat).map(r=>r.fields['Name']);
  }

  function miniWizMatchBlock(cat) {
    const options = miniWizMatchOptions(cat);
    if (!options.length) return ''; // nothing to match against yet
    const preview = miniWiz.matchRates ? (() => {
      if (cat === 'material') return `Will use ${CUR()}${miniWiz.matchRates.rate0.toFixed(2)}/lin ft (uppers) and ${CUR()}${miniWiz.matchRates.rate1.toFixed(2)}/lin ft (bases) — same as "${miniWiz.matchName}"`;
      if (cat === 'drawer') return `Will use ${CUR()}${miniWiz.matchRates.rate0.toFixed(2)}/lin ft (some drawers) and ${CUR()}${miniWiz.matchRates.rate1.toFixed(2)}/lin ft (mostly drawers) — same as "${miniWiz.matchName}"`;
      return `Will use ${CUR()}${miniWiz.matchRates.rate0.toFixed(2)}/lin ft upcharge — same as "${miniWiz.matchName}"`;
    })() : '';
    return `
      <div style="margin-bottom:1.25rem;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;font-weight:500">
          <input type="checkbox" id="mqph-mini-match-toggle" ${miniWiz.matchMode?'checked':''} onchange="mqphToggleMiniMatch(this.checked)" style="width:auto"/>
          Match another ${CAT_LABELS[cat]||cat}'s pricing instead of quoting a new job
        </label>
        ${miniWiz.matchMode ? `
          <select id="mqph-mini-match-select" onchange="mqphApplyMiniMatch('${cat}',this.value)" style="margin-top:8px;font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;width:100%">
            <option value="">Choose an item…</option>
            ${options.map(n=>`<option value="${n.replace(/"/g,'&quot;')}" ${miniWiz.matchName===n?'selected':''}>${n}</option>`).join('')}
          </select>
          <div id="mqph-mini-match-preview" style="margin-top:8px;font-size:13px;color:#374151">${preview}</div>
        ` : ''}
      </div>`;
  }

  window.mqphToggleMiniMatch = function(checked) {
    miniWiz.matchMode = checked;
    miniWiz.matchName = '';
    miniWiz.matchRates = null;
    renderMiniWiz();
  };

  window.mqphApplyMiniMatch = function(cat, name) {
    miniWiz.matchName = name;
    if (!name) { miniWiz.matchRates = null; renderMiniWiz(); return; }
    if (cat === 'material') {
      const upperRec = lineItems.find(r=>r.fields&&r.fields['Category']==='material'&&r.fields['Name'].replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim()===name&&/uppers/i.test(r.fields['Name']));
      const baseRec  = lineItems.find(r=>r.fields&&r.fields['Category']==='material'&&r.fields['Name'].replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim()===name&&/bases/i.test(r.fields['Name']));
      miniWiz.matchRates = { rate0: upperRec?.fields['Rate']||0, rate1: baseRec?.fields['Rate']||0 };
    } else if (cat === 'drawer') {
      const someRec   = lineItems.find(r=>r.fields&&r.fields['Category']==='drawer'&&r.fields['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i,'').trim()===name&&/some drawers/i.test(r.fields['Name']));
      const mostlyRec = lineItems.find(r=>r.fields&&r.fields['Category']==='drawer'&&r.fields['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i,'').trim()===name&&/mostly drawers/i.test(r.fields['Name']));
      miniWiz.matchRates = { rate0: someRec?.fields['Rate']||0, rate1: mostlyRec?.fields['Rate']||0 };
    } else {
      const rec = lineItems.find(r=>r.fields&&r.fields['Category']===cat&&r.fields['Name']===name);
      miniWiz.matchRates = { rate0: rec?.fields['Rate']||0 };
    }
    renderMiniWiz();
  };

  // Returns the HTML content for each mini-wiz step
  function miniWizContent(cat, name, step) {
    if (miniWiz.bulkMode) name = 'your new items (you\'ll name each one individually at the end)';
    const bl = getBaselineRates();
    const noBaseline = bl.blBasePrice <= 0;

    if (noBaseline) {
      return `
        <div class="mqph-warn" style="margin-bottom:0">
          ⚠️ <strong>No baseline pricing found.</strong> Run the full pricing wizard first to set up your baseline rates. Then adding individual items will work correctly.
        </div>`;
    }

    const matchBlock = miniWizMatchBlock(cat);
    if (miniWiz.matchMode) {
      // Match mode replaces the whole "quote a job" flow — nothing else to
      // show once an existing item's pricing is being copied directly.
      return matchBlock;
    }

    if (cat === 'material') {
      if (step === 0) {
        return `
          <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Quote this job exactly in your software, then enter the total below.</p>
          ${specBox([
            `<strong>Upper cabinets — box only, no doors</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} upper</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} upper</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${name}</span> &nbsp;·&nbsp; No doors &nbsp;·&nbsp; Supply only &nbsp;·&nbsp; Local delivery`,
          ])}
          ${matchBlock}
          <div class="mqph-price-input-wrap"><span class="mqph-pfx">${CUR()}</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p0" placeholder="0" oninput="mqphMiniCalc()"/></div>
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
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${name}</span> &nbsp;·&nbsp; No doors &nbsp;·&nbsp; Supply only &nbsp;·&nbsp; Include toe kick`,
          ])}
          ${matchBlock}
          <div class="mqph-price-input-wrap"><span class="mqph-pfx">${CUR()}</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p1" placeholder="0" oninput="mqphMiniCalc()"/></div>
          <p class="mqph-calc-hint">Enter your quoted total for this 4 lin ft job</p>
          <div class="mqph-rate-reveal" id="mqph-mini-reveal-1">
            <div class="mqph-rate-reveal-val" id="mqph-mini-rate-1">—</div>
            <div class="mqph-rate-reveal-lbl">per linear foot — bases</div>
          </div>`;
      }
    }

    if (cat === 'door') {
      const baselineBoxDesc = `${CUR()}${bl.blBasePrice.toLocaleString()} (your ${bl.blMatName} base box price)`;
      return `
        <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Quote the same baseline base box job with this new door style added.</p>
        ${specBox([
          `<strong>Base cabinets + new door style</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
          `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Door: <span class="mqph-spec-tag">${name}</span>`,
          `<span class="mqph-spec-tag">3 doors: 2 on 30" ${mqphMmTag(30)}, 1 on 18" ${mqphMmTag(18)}</span> · Hinges: <span class="mqph-spec-tag">${bl.blHingeName||'baseline hinge'}</span> · No drawers · Supply only`,
        ])}
        ${matchBlock}
        <div class="mqph-price-input-wrap"><span class="mqph-pfx">${CUR()}</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p0" placeholder="0" oninput="mqphMiniCalc()"/></div>
        <p class="mqph-calc-hint">We'll subtract ${baselineBoxDesc} and divide by 4 to get the door upcharge per lin ft</p>
        <div class="mqph-rate-reveal" id="mqph-mini-reveal-0">
          <div class="mqph-rate-reveal-val" id="mqph-mini-rate-0">—</div>
          <div class="mqph-rate-reveal-lbl">per linear foot upcharge</div>
        </div>`;
    }

    if (cat === 'hinge') {
      const baseWithDoor = (bl.blBaseRate + bl.blDoorRate) * 4;
      const baselineDesc = `${CUR()}${baseWithDoor.toLocaleString(undefined,{maximumFractionDigits:0})} (${bl.blMatName} bases + ${bl.blDoorName})`;
      return `
        <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Quote the baseline box + baseline door, but swap to this hinge.</p>
        ${specBox([
          `<strong>Base cabinets + baseline door + new hinge</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
          `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Door: <span class="mqph-spec-tag">${bl.blDoorName}</span>`,
          `Hinges: <span class="mqph-spec-tag">${name}</span> · No drawers · Supply only`,
        ])}
        ${matchBlock}
        <div class="mqph-price-input-wrap"><span class="mqph-pfx">${CUR()}</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p0" placeholder="0" oninput="mqphMiniCalc()"/></div>
        <p class="mqph-calc-hint">We'll subtract ${baselineDesc} and divide by 4 to get the hinge upcharge per lin ft</p>
        <div class="mqph-rate-reveal" id="mqph-mini-reveal-0">
          <div class="mqph-rate-reveal-val" id="mqph-mini-rate-0">—</div>
          <div class="mqph-rate-reveal-lbl">per linear foot upcharge</div>
        </div>`;
    }

    if (cat === 'drawer') {
      const baselineBoxDesc = `${CUR()}${bl.blBasePrice.toLocaleString(undefined,{maximumFractionDigits:0})} (your ${bl.blMatName} base box price)`;
      if (step === 0) {
        return `
          <p style="font-size:13px;color:#6b7280;margin-bottom:1.5rem;line-height:1.6">Quote the baseline base box with <strong>1 top drawer</strong> in each cabinet. This gives us the "some drawers" rate.</p>
          ${specBox([
            `<strong>Base cabinets + 1 top drawer per cabinet</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Drawers: <span class="mqph-spec-tag">${name}</span>`,
            `<strong>Include slides/guides · No doors · No drawer fronts · Supply only</strong>`,
          ])}
          ${matchBlock}
          <div class="mqph-price-input-wrap"><span class="mqph-pfx">${CUR()}</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p0" placeholder="0" oninput="mqphMiniCalc()"/></div>
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
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Drawers: <span class="mqph-spec-tag">${name}</span>`,
            `<strong>Include slides/guides · No doors · No drawer fronts · Supply only</strong>`,
          ])}
          ${p0>0?`<p style="font-size:12px;color:#6b7280;margin-bottom:12px">1-drawer quote was ${CUR()}${p0.toLocaleString()} — bank quote should be higher.</p>`:''}
          ${matchBlock}
          <div class="mqph-price-input-wrap"><span class="mqph-pfx">${CUR()}</span><input class="mqph-price-input-big" type="number" id="mqph-mini-p1" placeholder="0" oninput="mqphMiniCalc()"/></div>
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
        rv.textContent = `${CUR()}${rate.toFixed(2)} / lin ft`;
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
    const isLast = miniWiz.matchMode || step >= total - 1;

    const stepLabels = { material:['Upper rate','Base rate'], door:['Door upcharge'], hinge:['Hinge upcharge'], drawer:['Some drawers','Mostly drawers'] };
    const labels = stepLabels[cat] || [];

    const progressDots = labels.map((_,i) =>
      `<div style="flex:1;height:3px;border-radius:2px;background:${i<step?'#a3e635':i===step?'#fff':'rgba(255,255,255,0.25)'};transition:background 0.3s"></div>`
    ).join('');

    const catMeta = { material:{icon:'🪵',title:'Add box material'}, door:{icon:'🚪',title:'Add door style'}, hinge:{icon:'🔧',title:'Add door hinge'}, drawer:{icon:'🗄️',title:'Add drawer config'} };
    const meta = catMeta[cat] || { icon:'➕', title:'Add item' };

    document.getElementById('mqph-mini-title').innerHTML = `${meta.icon} ${meta.title}${miniWiz.bulkMode ? ` (× ${miniWiz.bulkCount})` : ''}`;
    document.getElementById('mqph-mini-sub').textContent = miniWiz.bulkMode ? `${miniWiz.bulkCount} items, same price` : name;
    document.getElementById('mqph-mini-progress').innerHTML = progressDots;
    document.getElementById('mqph-mini-content').innerHTML = miniWizContent(cat, name, step);

    // Nav buttons
    const nextBtn = document.getElementById('mqph-mini-next');
    const backBtn = document.getElementById('mqph-mini-back');
    if (nextBtn) nextBtn.textContent = isLast ? 'Save →' : 'Next →';
    if (backBtn) backBtn.style.display = (!miniWiz.matchMode && step > 0) ? 'inline-block' : 'none';
  }

  window.mqphMiniNext = async function() {
    const cat  = miniWiz.cat;
    const name = miniWiz.name;
    const step = miniWiz.step;
    const bl   = getBaselineRates();

    // Match mode entirely bypasses the "quote a job" flow — just copy the
    // matched item's rate(s) straight onto the new one and save.
    if (miniWiz.matchMode) {
      if (!miniWiz.matchRates) {
        const sel = document.getElementById('mqph-mini-match-select');
        if (sel) sel.style.borderColor = '#dc2626';
        return;
      }
      if (miniWiz.bulkMode) {
        miniWiz.bulkRates = miniWiz.matchRates;
        mqphShowBulkNameScreen();
        return;
      }
      if (!mqphWarnIfDuplicate(cat, name)) return;
      const nextBtn = document.getElementById('mqph-mini-next');
      if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Saving…'; }
      try {
        const mr = miniWiz.matchRates;
        if (cat === 'material') {
          const sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']==='material').length;
          const upperRec = await atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:`${name} — uppers`, Category:'material', Rate:mr.rate0, Unit:'per lin ft — uppers', Description:'Box material rate uppers', Active:true, 'Sort order':sortBase+1 });
          const baseRec  = await atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:`${name} — bases`, Category:'material', Rate:mr.rate1, Unit:'per lin ft — bases', Description:'Box material rate bases', Active:true, 'Sort order':sortBase+2 });
          if (upperRec?.id) lineItems.push(upperRec);
          if (baseRec?.id)  lineItems.push(baseRec);
        } else if (cat === 'door') {
          const sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']==='door').length;
          const rec = await atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:name, Category:'door', Rate:mr.rate0, Unit:'per lin ft upcharge', Description:'Door style upcharge', Active:true, 'Sort order':sortBase+1 });
          if (rec?.id) lineItems.push(rec);
        } else if (cat === 'hinge') {
          const sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']==='hinge').length;
          const rec = await atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:name, Category:'hinge', Rate:mr.rate0, Unit:'per lin ft upcharge', Description:'Hinge upcharge', Active:true, 'Sort order':sortBase+1 });
          if (rec?.id) lineItems.push(rec);
        } else if (cat === 'drawer') {
          const sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']==='drawer').length;
          const rec1 = await atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:`${name} — some drawers`, Category:'drawer', Rate:mr.rate0, Unit:'per lin ft upcharge', Description:'Some drawers rate (1 drawer per cabinet)', Active:true, 'Sort order':sortBase+1 });
          const rec2 = await atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:`${name} — mostly drawers`, Category:'drawer', Rate:mr.rate1, Unit:'per lin ft upcharge', Description:'Mostly drawers rate (averaged 1-drawer + bank)', Active:true, 'Sort order':sortBase+2 });
          if (rec1?.id) lineItems.push(rec1);
          if (rec2?.id) lineItems.push(rec2);
        }
        mqphCloseMiniWiz();
        await loadAndRender();
      } catch(e) {
        console.error('Failed to save matched item', e);
        if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Save →'; }
        alert('Error saving. Please try again.');
      }
      return;
    }

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

    // Last step — save to Airtable (or, in bulk mode, compute the shared
    // rate(s) and move to the naming screen instead of saving yet)
    if (miniWiz.bulkMode) {
      miniWiz[`p${step}`] = p;
      if (cat === 'material') {
        miniWiz.bulkRates = { rate0: Math.round((miniWiz.p0/4)*100)/100, rate1: Math.round((miniWiz.p1/4)*100)/100 };
      } else if (cat === 'door') {
        miniWiz.bulkRates = { rate0: Math.round(((p - bl.blBasePrice)/4)*100)/100 };
      } else if (cat === 'hinge') {
        const baseWithDoor = (bl.blBaseRate + bl.blDoorRate) * 4;
        miniWiz.bulkRates = { rate0: Math.round(((p - baseWithDoor)/4)*100)/100 };
      } else if (cat === 'drawer') {
        const p0 = miniWiz.p0 || 0, p1 = miniWiz.p1 || 0;
        miniWiz.bulkRates = {
          rate0: p0>0 ? Math.round(((p0 - bl.blBasePrice)/4)*100)/100 : 0,
          rate1: (p0>0 && p1>0) ? Math.round((((p0+p1)/2 - bl.blBasePrice)/4)*100)/100 : 0,
        };
      }
      mqphShowBulkNameScreen();
      return;
    }
    if (!mqphWarnIfDuplicate(cat, name)) return;
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
            Rate:someRate, Unit:'per lin ft upcharge', Description:'Some drawers rate (1 drawer per cabinet)', Active:true, 'Sort order':sortBase+1,
          });
          if (rec1?.id) lineItems.push(rec1);
        }

        if (p0 > 0 && p1 > 0) {
          const mostlyRate = Math.round((((p0 + p1) / 2 - bl2.blBasePrice) / 4) * 100) / 100;
          const rec2 = await atCreate(LINE_ITEMS_TABLE, {
            shop:[shopRecord._recordId], Name:`${name} — mostly drawers`, Category:'drawer',
            Rate:mostlyRate, Unit:'per lin ft upcharge', Description:'Mostly drawers rate (averaged 1-drawer + bank)', Active:true, 'Sort order':sortBase+2,
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

  // Hinges aren't a groupable category (matches My Products) — no group
  // field offered there.
  const GROUPABLE_MINI_CATS = ['material','door','drawer'];

  // After the shared price is set, this screen collects one name per item —
  // empty inputs (not pre-filled placeholders) so nothing gets silently
  // saved with a generic, un-renamed label.
  window.mqphShowBulkNameScreen = function() {
    const cat = miniWiz.cat;
    const catMeta = { material:{icon:'🪵',label:'box material'}, door:{icon:'🚪',label:'door style'}, hinge:{icon:'🔧',label:'hinge'}, drawer:{icon:'🗄️',label:'drawer configuration'} };
    const meta = catMeta[cat] || { icon:'➕', label:'item' };
    document.getElementById('mqph-mini-title').innerHTML = `${meta.icon} Name your ${miniWiz.bulkCount} new ${meta.label}s`;
    document.getElementById('mqph-mini-sub').textContent = 'All share the price you just set';
    document.getElementById('mqph-mini-progress').innerHTML = '';
    const rows = Array.from({length: miniWiz.bulkCount}, (_,i) => `
      <div style="margin-bottom:8px">
        <input type="text" id="mqph-bulk-name-${i}" class="mqph-name-input" style="font-size:14px;padding:8px 10px" placeholder="${meta.label.charAt(0).toUpperCase()+meta.label.slice(1)} #${i+1}"/>
      </div>`).join('');
    const groupBlock = GROUPABLE_MINI_CATS.includes(cat) ? (() => {
      const existingGroups = [...new Set(lineItems.filter(r=>r.fields&&r.fields['Category']===cat&&(r.fields['Group name']||'').trim()).map(r=>r.fields['Group name'].trim()))];
      return `
        <div style="margin-bottom:1rem;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
          <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">Group name (optional)</label>
          <div style="position:relative">
            <input type="text" id="mqph-bulk-group" list="mqph-bulk-group-list" placeholder="e.g. Laminates — leave blank for no group" style="width:100%;padding-right:28px"/>
            <span onclick="document.getElementById('mqph-bulk-group').focus()" style="position:absolute;right:6px;top:0;bottom:0;width:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#9ca3af;font-size:11px">▼</span>
          </div>
          <datalist id="mqph-bulk-group-list">${existingGroups.map(g=>`<option value="${g.replace(/"/g,'&quot;')}"></option>`).join('')}</datalist>
          <div style="font-size:11px;color:#6b7280;margin-top:4px">Match an existing group to add these to it, or type a new name to create one — applies to all ${miniWiz.bulkCount} items below.</div>
        </div>`;
    })() : '';
    document.getElementById('mqph-mini-content').innerHTML = `
      ${groupBlock}
      <p style="font-size:13px;color:#6b7280;margin-bottom:1rem;line-height:1.6">Type each name. Leave any blank and we'll flag it before saving.</p>
      <div style="max-height:340px;overflow-y:auto;padding-right:4px">${rows}</div>
      <div id="mqph-bulk-name-warn" style="display:none;margin-top:10px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12px;color:#991b1b"></div>
    `;
    const nextBtn = document.getElementById('mqph-mini-next');
    const backBtn = document.getElementById('mqph-mini-back');
    if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = `Create ${miniWiz.bulkCount} items →`; nextBtn.onclick = () => mqphSaveBulkNames(); }
    if (backBtn) { backBtn.style.display = 'inline-block'; backBtn.textContent = 'Cancel'; backBtn.onclick = () => mqphCloseMiniWiz(); }
  };

  window.mqphSaveBulkNames = async function() {
    const cat = miniWiz.cat;
    const count = miniWiz.bulkCount;
    const names = [];
    const blanks = [];
    for (let i = 0; i < count; i++) {
      const v = document.getElementById(`mqph-bulk-name-${i}`)?.value.trim() || '';
      names.push(v);
      if (!v) blanks.push(i+1);
    }
    const warnEl = document.getElementById('mqph-bulk-name-warn');
    if (blanks.length) {
      if (warnEl) { warnEl.style.display='block'; warnEl.textContent = `${blanks.length} item${blanks.length>1?'s are':' is'} still unnamed (#${blanks.slice(0,10).join(', ')}${blanks.length>10?', …':''}). Fill in every name before saving.`; }
      const firstBlank = document.getElementById(`mqph-bulk-name-${blanks[0]-1}`);
      if (firstBlank) firstBlank.focus();
      return;
    }
    // Internal duplicates (two rows named the same thing) and duplicates
    // against existing items — checked once as a batch rather than one
    // popup per item, since confirming 90 times would be unusable.
    const seen = new Map();
    const internalDupes = [];
    names.forEach((n,i) => {
      const key = mqphBaseNameFor(cat, n).toLowerCase();
      if (seen.has(key)) internalDupes.push(n); else seen.set(key, i);
    });
    const existingDupes = names.filter(n => mqphFindDuplicateName(cat, n));
    const allDupes = [...new Set([...internalDupes, ...existingDupes])];
    if (allDupes.length) {
      const proceed = confirm(`These names look like duplicates (either repeated in your list, or already exist): ${allDupes.slice(0,15).join(', ')}${allDupes.length>15?', …':''}.\n\nSave everything anyway?`);
      if (!proceed) return;
    }

    const nextBtn = document.getElementById('mqph-mini-next');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Saving…'; }
    const mr = miniWiz.bulkRates || {};
    const groupName = GROUPABLE_MINI_CATS.includes(cat) ? (document.getElementById('mqph-bulk-group')?.value || '').trim() : '';
    const groupFields = {};
    if (groupName) {
      const groupMembers = lineItems.filter(r=>r.fields&&r.fields['Category']===cat&&(r.fields['Group name']||'').trim()===groupName);
      const isExistingGroup = groupMembers.length > 0;
      groupFields['Group name'] = groupName;
      if (isExistingGroup) {
        groupFields['Group sort order'] = groupMembers.find(m=>typeof m.fields['Group sort order']==='number')?.fields['Group sort order'] || 0;
        groupFields['Group description'] = groupMembers.find(m=>m.fields['Group description'])?.fields['Group description'] || '';
      } else {
        const allOrders = [...new Set(lineItems.filter(r=>r.fields&&r.fields['Category']===cat&&(r.fields['Group name']||'').trim()).map(r=>r.fields['Group sort order']||0))];
        groupFields['Group sort order'] = allOrders.length ? Math.max(...allOrders)+1 : 0;
      }
    }
    const writes = [];
    let sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']===cat).length;
    try {
      for (const nm of names) {
        if (cat === 'material') {
          writes.push(atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:`${nm} — uppers`, Category:'material', Rate:mr.rate0||0, Unit:'per lin ft — uppers', Description:'Box material rate uppers', Active:true, 'Sort order':++sortBase, ...groupFields }));
          writes.push(atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:`${nm} — bases`, Category:'material', Rate:mr.rate1||0, Unit:'per lin ft — bases', Description:'Box material rate bases', Active:true, 'Sort order':++sortBase, ...groupFields }));
        } else if (cat === 'door') {
          writes.push(atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:nm, Category:'door', Rate:mr.rate0||0, Unit:'per lin ft upcharge', Description:'Door style upcharge', Active:true, 'Sort order':++sortBase, ...groupFields }));
        } else if (cat === 'hinge') {
          writes.push(atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:nm, Category:'hinge', Rate:mr.rate0||0, Unit:'per lin ft upcharge', Description:'Hinge upcharge', Active:true, 'Sort order':++sortBase }));
        } else if (cat === 'drawer') {
          writes.push(atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:`${nm} — some drawers`, Category:'drawer', Rate:mr.rate0||0, Unit:'per lin ft upcharge', Description:'Some drawers rate (1 drawer per cabinet)', Active:true, 'Sort order':++sortBase, ...groupFields }));
          writes.push(atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:`${nm} — mostly drawers`, Category:'drawer', Rate:mr.rate1||0, Unit:'per lin ft upcharge', Description:'Mostly drawers rate (averaged 1-drawer + bank)', Active:true, 'Sort order':++sortBase, ...groupFields }));
        }
      }
      await Promise.all(writes);
      mqphCloseMiniWiz();
      await loadAndRender();
    } catch(e) {
      console.error('Bulk save error:', e);
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = `Create ${count} items →`; }
      alert('Something went wrong saving these — please try again. Anything already created stayed saved, so check My Products/Pricing before re-running to avoid duplicates.');
    }
  };

  window.mqphMiniBack = function() {
    if (miniWiz.step > 0) { miniWiz.step--; renderMiniWiz(); }
  };

  window.mqphCloseMiniWiz = function() {
    document.getElementById('mqph-mini-overlay')?.classList.remove('show');
    miniWiz = { cat:null, name:'', step:0, matchMode:false, matchName:'', matchRates:null, bulkMode:false, bulkCount:0, bulkRates:null, bulkNames:[] };
  };

  function openMiniWiz(cat, name, bulkCount) {
    miniWiz = { cat, name, step:0, matchMode:false, matchName:'', matchRates:null, bulkMode: !!bulkCount, bulkCount: bulkCount||0, bulkRates:null, bulkNames:[] };
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
      if (c === 'tall_cabinet') return; // handled by buildTallCabHtml()
      if (c === 'drawer_config') return; // config chips — not shown in editor, only in Edit Shop Items
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
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${wizardHasRun ? `<div style="font-size:12px;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;max-width:340px;line-height:1.5">✨ Add new items using the <strong>+ Add</strong> buttons below, or <button class="mqph-btn-ghost" style="font-size:12px;padding:0;color:#1d4ed8;text-decoration:underline;cursor:pointer;background:none;border:none;font-family:inherit" onclick="mqphGoToWizard()">re-run the pricing wizard</button> to reprice everything.</div>` : `<button class="mqph-btn mqph-btn-secondary" onclick="mqphStartItemSetup()">🛠️ Edit shop items</button>`}
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

        ${['material','door','drawer','hinge','zone','install','other','tax'].filter(cat => groups[cat]).map(cat => [cat, groups[cat]]).concat(Object.entries(groups).filter(([cat]) => !['material','door','drawer','hinge','zone','install','other','tax'].includes(cat))).map(([cat,recs]) => `
          <div class="mqph-cat-block">
            <div class="mqph-cat-header" onclick="mqphToggleCategory('${cat}')" style="cursor:pointer">
              <span class="mqph-cat-title"><span id="mqph-cat-arrow-${cat}" style="display:inline-block;margin-right:6px;transition:transform 0.2s;font-size:12px">▶</span>${CAT_LABELS[cat]||cat} <span style="font-size:12px;font-weight:400;color:#9ca3af">(${recs.length})</span></span>
              ${cat==='install'
                ? ''
                : MINI_WIZ_CATS.includes(cat)
                  ? `<button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenAddItem('${cat}')">+ Add ${cat}</button>`
                  : `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenAdd('${cat}')">+ Add</button>`
              }
            </div>
            <div id="mqph-cat-body-${cat}" style="display:none">
            <div style="display:flex;align-items:center;gap:16px;padding:4px 12px 6px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #f3f4f6;user-select:none">
              <span style="cursor:pointer;flex:1" onclick="mqphSetSort('${cat}','name')">Name ${mqphSortArrow(cat,'name')}</span>
              <span style="cursor:pointer;min-width:80px;text-align:right" onclick="mqphSetSort('${cat}','price')">Price ${mqphSortArrow(cat,'price')}</span>
              ${['door','material'].includes(cat) ? `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenBulkEdit('${cat}')">📊 Bulk edit</button>` : ''}
            </div>
            ${mqphSortRecs(cat, recs).map(r=>`
              <div class="mqph-row">
                <div style="flex:1;min-width:0">
                  <div class="mqph-row-name">${r.fields['Name']||'—'}</div>
                  ${r.fields['Description']?`<div class="mqph-row-desc">${r.fields['Description']}</div>`:''}
                </div>
                <div class="mqph-row-rate">${(r.fields['Rate']||0) === 0 ? '<span style="font-size:11px;font-weight:600;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:2px 7px">Not priced individually (Part of baseline)</span>' : (r.fields['Category']==='zone'||r.fields['Unit']==='km'||r.fields['Unit']==='%') ? (r.fields['Rate']||0).toLocaleString() : CUR() +(r.fields['Rate']||0).toLocaleString()}</div>
                <div class="mqph-row-unit">${r.fields['Unit']||''}</div>
                <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active']?'on':''}" onclick="mqphToggle('${r.id}',this)"></div></div>
                <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenEdit('${r.id}')">Edit</button>
                <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDelete('${r.id}')">Delete</button>
              </div>`).join('')}
            </div>
          </div>`).join('')}
      `}

      ${buildCTHtml()}
      ${buildTrimHtml()}
      ${buildTallCabHtml()}

      <!-- Bulk price edit overlay — Doors, Box Materials, Crown, Valance only -->
      <div class="mqph-overlay" id="mqph-bulk-overlay">
        <div class="mqph-modal" style="max-width:560px">
          <div class="mqph-modal-hdr">
            <div><h3 id="mqph-bulk-title">Bulk edit prices</h3></div>
            <button class="mqph-modal-close" onclick="mqphCloseBulkEdit()">×</button>
          </div>
          <div class="mqph-modal-body">
            <div class="mqph-field">
              <label>Narrow to a group <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
              <select id="mqph-bulk-group-filter" onchange="mqphBulkFilterGroup(this.value)"></select>
            </div>
            <div style="font-size:11px;color:#6b7280;margin:-4px 0 10px">Items with the exact same price(s) are grouped together below — check a whole group at once, or expand it to hand-pick individual items.</div>
            <div id="mqph-bulk-clusters" style="max-height:280px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:1rem"></div>
            <div id="mqph-bulk-edit-form" style="display:none;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem">
              <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:0.75rem" id="mqph-bulk-selected-count"></div>
              <div id="mqph-bulk-price-fields"></div>
              <div style="margin-top:10px">
                <label style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px">Or match another item's price</label>
                <input type="text" id="mqph-bulk-match-search" placeholder="Search items to match…" oninput="mqphBulkMatchSearch(this.value)" style="width:100%;font-size:13px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box"/>
                <div id="mqph-bulk-match-results" style="max-height:140px;overflow-y:auto;margin-top:4px"></div>
              </div>
              <button class="mqph-btn mqph-btn-primary" style="margin-top:1rem;width:100%" onclick="mqphBulkApply()">Update selected items →</button>
            </div>
          </div>
        </div>
      </div>

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
            <div class="mqph-field"><label>Rate (${CUR()})</label><input type="number" id="mqph-item-rate" step="0.01"/></div>
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
      door:    { icon:'🚪', label:'Door style',         ph:'e.g. Maple shaker' },
      hinge:   { icon:'🔧', label:'Door hinge',         ph:'e.g. Concealed soft-close' },
      drawer:  { icon:'🗄️', label:'Drawer configuration', ph:'e.g. Birch — soft-close' },
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
      ${cat === 'door' ? `<p style="font-size:12px;color:#9ca3af;margin-top:-0.5rem;line-height:1.5">Tip: Keep it simple. (e.g. "Maple shaker", "Painted MDF shaker", "Melamine Slabs", "Red Oak raised panel", "3/4 PLAM", Etc.)</p>` : ''}
      <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid #e5e7eb">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;font-weight:500">
          <input type="checkbox" id="mqph-mini-bulk-toggle" onchange="mqphToggleMiniBulk('${cat}',this.checked)" style="width:auto"/>
          Adding multiple items at the same price? (e.g. 90 door styles that all cost the same)
        </label>
        <div id="mqph-mini-bulk-wrap" style="display:none;margin-top:10px">
          <div class="mqph-input-row"><label>How many ${meta.label.toLowerCase()}s?</label><input type="number" id="mqph-mini-bulk-count" min="2" max="300" placeholder="e.g. 90"/></div>
          <p style="font-size:11px;color:#6b7280;margin-top:-6px">You'll quote one job to set the shared price, then name each one at the end.</p>
        </div>
      </div>
    `;

    const nextBtn = document.getElementById('mqph-mini-next');
    const backBtn = document.getElementById('mqph-mini-back');
    if (nextBtn) { nextBtn.textContent = 'Next →'; nextBtn.disabled = false; nextBtn.onclick = () => mqphMiniNameNext(cat); }
    if (backBtn) { backBtn.style.display = 'inline-block'; backBtn.onclick = () => { mqphCloseMiniWiz(); }; backBtn.textContent = 'Cancel'; }

    overlay.classList.add('show');
    setTimeout(() => document.getElementById('mqph-mini-name-inp')?.focus(), 100);
  };

  window.mqphToggleMiniBulk = function(cat, checked) {
    const nameInp = document.getElementById('mqph-mini-name-inp');
    const bulkWrap = document.getElementById('mqph-mini-bulk-wrap');
    if (nameInp) nameInp.style.display = checked ? 'none' : 'block';
    if (bulkWrap) bulkWrap.style.display = checked ? 'block' : 'none';
    const nextBtn = document.getElementById('mqph-mini-next');
    if (nextBtn) nextBtn.onclick = () => checked ? mqphMiniBulkCountNext(cat) : mqphMiniNameNext(cat);
  };

  window.mqphMiniBulkCountNext = function(cat) {
    const count = parseInt(document.getElementById('mqph-mini-bulk-count')?.value || '0', 10);
    if (!count || count < 2) {
      const inp = document.getElementById('mqph-mini-bulk-count');
      if (inp) { inp.style.borderColor = '#dc2626'; inp.focus(); }
      return;
    }
    const nextBtn = document.getElementById('mqph-mini-next');
    const backBtn = document.getElementById('mqph-mini-back');
    if (nextBtn) nextBtn.onclick = () => mqphMiniNext();
    if (backBtn) backBtn.onclick = () => mqphMiniBack();
    openMiniWiz(cat, null, count);
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
    // Migration: auto-create drawer_config records from existing priced 'drawer' records
    // so shops that already ran the wizard get clean config chips without losing data
    const hasDrawerConfigs = lineItems.filter(r=>r.fields).some(r=>r.fields['Category']==='drawer_config');
    if (!hasDrawerConfigs) {
      const pricedDrawers = lineItems.filter(r=>r.fields&&r.fields['Category']==='drawer');
      const baseNames = [...new Set(pricedDrawers.map(r=>(r.fields['Name']||'').replace(/\s*—\s*(some|mostly) drawers\s*$/i,'').trim()).filter(Boolean))];
      for (let i=0; i<baseNames.length; i++) {
        const rec = await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:baseNames[i], Category:'drawer_config',
          Rate:0, Unit:'per lin ft', Active:true, 'Sort order':i+1,
        });
        if (rec?.id) lineItems.push(rec);
      }
    }
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
    const category = document.getElementById('mqph-item-cat').value;
    if (!currentEditId && !mqphWarnIfDuplicate(category, name)) return;
    const fields = {
      shop:[shopRecord._recordId], Name:name,
      Category:category,
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
    try {
      // Same door → linked-crown/valance cleanup as mqphDeleteChip, for
      // this second, more generic delete path.
      const rec = lineItems.find(r => r.id === id);
      if (rec && rec.fields && rec.fields['Category'] === 'door') {
        const doorName = rec.fields['Name'] || '';
        if (doorName) {
          const linkedTrims = lineItems.filter(r => {
            if (!r.fields || r.fields['Category'] !== 'trim') return false;
            let linked = [];
            try { linked = r.fields['Linked door style'] ? JSON.parse(r.fields['Linked door style']) : []; } catch(e) { linked = []; }
            return linked.includes(doorName);
          });
          for (const t of linkedTrims) {
            let linked = [];
            try { linked = JSON.parse(t.fields['Linked door style']); } catch(e) { linked = []; }
            const cleaned = linked.filter(name => name !== doorName);
            try { await atUpdate(LINE_ITEMS_TABLE, t.id, { 'Linked door style': JSON.stringify(cleaned) }); } catch(e) { console.error('Failed to clean up linked door style', e); }
          }
        }
      }
      await atDelete(LINE_ITEMS_TABLE,id); await loadAndRender();
    } catch(e) { alert('Error deleting.'); }
  };

  // ============================================================
  // BULK PRICE EDIT — update many same-priced items at once
  // (Doors, Box Materials, Crown, Valance only)
  //
  // The underlying record structure differs by category, which this
  // normalizes away: a door/crown/valance is one Airtable record, but a box
  // material is actually TWO separate records (uppers + bases) linked only
  // by a shared name pattern. Every category gets flattened here into a
  // "logical item" with one or two named price fields, so the rest of this
  // feature (clustering, selection, editing) doesn't need to care which
  // category it's looking at.
  // ============================================================
  let _bulkEdit = { cat: null, items: [], groupFilter: '', checkedIds: new Set(), openClusters: new Set() };
  const BULK_EDIT_LABELS = { material: '🪵 Box Materials', door: '🚪 Door Styles', trim_crown: '👑 Crown Moulding', trim_valance: '📏 Valance' };

  function mqphBulkEditItems(cat) {
    if (cat === 'material') {
      const recs = lineItems.filter(r => r.fields && r.fields['Category'] === 'material');
      const byBase = {};
      recs.forEach(r => {
        const nm = r.fields['Name'] || '';
        const baseName = nm.replace(/\s*—\s*(uppers|bases)\s*$/i, '').trim();
        const isUpper = /—\s*uppers\s*$/i.test(nm);
        if (!byBase[baseName]) byBase[baseName] = { baseName, upperRec: null, baseRec: null, groupName: (r.fields['Group name']||'').trim() };
        if (isUpper) byBase[baseName].upperRec = r; else byBase[baseName].baseRec = r;
      });
      // Only items with BOTH halves present are editable here — a
      // material missing one half is a data problem to fix by hand, not
      // something bulk edit should guess at.
      return Object.values(byBase).filter(it => it.upperRec && it.baseRec).map(it => ({
        id: 'mat:' + it.baseName,
        label: it.baseName,
        groupName: it.groupName,
        priceFields: [
          { key: 'upper', label: 'Uppers price', recId: it.upperRec.id, value: it.upperRec.fields['Rate']||0 },
          { key: 'base', label: 'Bases price', recId: it.baseRec.id, value: it.baseRec.fields['Rate']||0 },
        ],
      }));
    }
    if (cat === 'door') {
      return lineItems.filter(r => r.fields && r.fields['Category'] === 'door').map(r => ({
        id: r.id, label: r.fields['Name']||'—', groupName: (r.fields['Group name']||'').trim(),
        priceFields: [{ key: 'price', label: 'Price', recId: r.id, value: r.fields['Rate']||0 }],
      }));
    }
    if (cat === 'trim_crown' || cat === 'trim_valance') {
      const trimType = cat === 'trim_crown' ? 'crown' : 'valance';
      return lineItems.filter(r => r.fields && r.fields['Category'] === 'trim' && (r.fields['Trim type']||'crown') === trimType).map(r => ({
        id: r.id, label: r.fields['Name']||'—', groupName: (r.fields['Group name']||'').trim(),
        priceFields: [
          { key: 'supply', label: 'Supply price', recId: r.id, value: r.fields['Rate']||0 },
          { key: 'install', label: 'Install price', recId: r.id, value: r.fields['Install rate']||0 },
        ],
      }));
    }
    return [];
  }

  window.mqphOpenBulkEdit = function(cat) {
    _bulkEdit = { cat, items: mqphBulkEditItems(cat), groupFilter: '', checkedIds: new Set(), openClusters: new Set() };
    document.getElementById('mqph-bulk-title').textContent = `Bulk edit — ${BULK_EDIT_LABELS[cat]||cat}`;
    const groups = [...new Set(_bulkEdit.items.filter(i=>i.groupName).map(i=>i.groupName))];
    const groupSel = document.getElementById('mqph-bulk-group-filter');
    groupSel.innerHTML = `<option value="">All items</option>` + groups.map(g=>`<option value="${g.replace(/"/g,'&quot;')}">${g}</option>`).join('');
    groupSel.value = '';
    mqphRenderBulkClusters();
    document.getElementById('mqph-bulk-edit-form').style.display = 'none';
    document.getElementById('mqph-bulk-overlay').classList.add('show');
  };

  window.mqphCloseBulkEdit = function() {
    document.getElementById('mqph-bulk-overlay').classList.remove('show');
  };

  window.mqphBulkFilterGroup = function(val) {
    _bulkEdit.groupFilter = val;
    mqphRenderBulkClusters();
  };

  // Two items only cluster together if EVERY price field matches exactly —
  // for materials that means uppers AND bases both have to match, not just
  // one of them.
  function mqphBulkPriceKey(item) {
    return item.priceFields.map(f => f.value.toFixed(2)).join('|');
  }

  function mqphBulkVisibleItems() {
    return _bulkEdit.groupFilter ? _bulkEdit.items.filter(i => i.groupName === _bulkEdit.groupFilter) : _bulkEdit.items;
  }

  function mqphRenderBulkClusters() {
    const container = document.getElementById('mqph-bulk-clusters');
    if (!container) return;
    const items = mqphBulkVisibleItems();
    if (!items.length) {
      container.innerHTML = `<div style="padding:1.5rem;text-align:center;font-size:13px;color:#9ca3af">No items ${_bulkEdit.groupFilter?'in this group':'found'}.</div>`;
      return;
    }
    const clusters = {};
    items.forEach(it => {
      const key = mqphBulkPriceKey(it);
      if (!clusters[key]) clusters[key] = { key, priceFields: it.priceFields, items: [] };
      clusters[key].items.push(it);
    });
    const clusterList = Object.values(clusters).sort((a,b) => b.items.length - a.items.length);
    container.innerHTML = clusterList.map(c => {
      const allChecked = c.items.every(it => _bulkEdit.checkedIds.has(it.id));
      const someChecked = !allChecked && c.items.some(it => _bulkEdit.checkedIds.has(it.id));
      const isOpen = _bulkEdit.openClusters.has(c.key);
      const priceLabel = c.priceFields.map(f => `${f.label}: ${CUR()}${f.value.toFixed(2)}`).join(' · ');
      const keyEsc = c.key.replace(/'/g,"\\'");
      return `
        <div style="border-bottom:1px solid #f3f4f6">
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:${allChecked?'#eff6ff':'#fff'}">
            <input type="checkbox" ${allChecked?'checked':''} onclick="mqphSelectBulkCluster('${keyEsc}')" style="width:auto;flex-shrink:0"/>
            <span style="flex:1;font-size:13px;font-weight:600;color:#111;cursor:pointer" onclick="mqphExpandBulkCluster('${keyEsc}')">${priceLabel} <span style="font-weight:400;color:#9ca3af">— ${c.items.length} item${c.items.length!==1?'s':''}</span></span>
            <span onclick="mqphExpandBulkCluster('${keyEsc}')" style="font-size:11px;color:#2563eb;cursor:pointer;user-select:none;white-space:nowrap">${isOpen?'Hide items ▲':'Show items ▼'}</span>
          </div>
          ${isOpen ? `<div style="padding:4px 12px 8px 34px">${c.items.map(it => `
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#374151;padding:4px 0;cursor:pointer">
              <input type="checkbox" ${_bulkEdit.checkedIds.has(it.id)?'checked':''} onchange="mqphToggleBulkItem('${it.id.replace(/'/g,"\\'")}')" style="width:auto;flex-shrink:0"/>
              <span>${it.label}${it.groupName?` <span style="color:#9ca3af">— ${it.groupName}</span>`:''}</span>
            </label>`).join('')}</div>` : ''}
        </div>`;
    }).join('');
    mqphUpdateBulkForm();
  }

  window.mqphExpandBulkCluster = function(key) {
    if (_bulkEdit.openClusters.has(key)) _bulkEdit.openClusters.delete(key);
    else _bulkEdit.openClusters.add(key);
    mqphRenderBulkClusters();
  };

  window.mqphSelectBulkCluster = function(key) {
    const clusterItems = mqphBulkVisibleItems().filter(it => mqphBulkPriceKey(it) === key);
    const allChecked = clusterItems.every(it => _bulkEdit.checkedIds.has(it.id));
    clusterItems.forEach(it => { if (allChecked) _bulkEdit.checkedIds.delete(it.id); else _bulkEdit.checkedIds.add(it.id); });
    mqphRenderBulkClusters();
  };

  window.mqphToggleBulkItem = function(id) {
    if (_bulkEdit.checkedIds.has(id)) _bulkEdit.checkedIds.delete(id);
    else _bulkEdit.checkedIds.add(id);
    mqphRenderBulkClusters();
  };

  function mqphUpdateBulkForm() {
    const form = document.getElementById('mqph-bulk-edit-form');
    const selected = _bulkEdit.items.filter(it => _bulkEdit.checkedIds.has(it.id));
    if (!selected.length) { form.style.display = 'none'; return; }
    form.style.display = 'block';
    document.getElementById('mqph-bulk-selected-count').textContent = `${selected.length} item${selected.length!==1?'s':''} selected`;
    // Every logical item in a category shares the same price-field shape,
    // so the first selected item's fields define the form.
    document.getElementById('mqph-bulk-price-fields').innerHTML = selected[0].priceFields.map((f,i) => `
      <div class="mqph-input-row" style="margin-bottom:8px">
        <label>${f.label}</label>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="color:#6b7280">${CUR()}</span>
          <input type="number" id="mqph-bulk-newprice-${i}" step="0.01" style="width:120px" placeholder="New price"/>
        </div>
      </div>`).join('');
    const matchResults = document.getElementById('mqph-bulk-match-results');
    if (matchResults) matchResults.innerHTML = '';
    const searchInput = document.getElementById('mqph-bulk-match-search');
    if (searchInput) searchInput.value = '';
  }

  window.mqphBulkMatchSearch = function(val) {
    const term = (val||'').toLowerCase().trim();
    const resultsEl = document.getElementById('mqph-bulk-match-results');
    if (!resultsEl) return;
    if (!term) { resultsEl.innerHTML = ''; return; }
    const matches = _bulkEdit.items.filter(it => it.label.toLowerCase().includes(term)).slice(0, 8);
    resultsEl.innerHTML = matches.length ? matches.map(it => `
      <div onclick="mqphBulkPickMatch('${it.id.replace(/'/g,"\\'")}')" style="padding:6px 8px;font-size:12px;cursor:pointer;border-radius:6px;display:flex;justify-content:space-between;gap:8px" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='transparent'">
        <span>${it.label}</span>
        <span style="color:#6b7280;white-space:nowrap">${it.priceFields.map(f=>CUR() +f.value.toFixed(2)).join(' / ')}</span>
      </div>`).join('') : `<div style="font-size:12px;color:#9ca3af;padding:6px 8px">No matches.</div>`;
  };

  window.mqphBulkPickMatch = function(id) {
    const target = _bulkEdit.items.find(it => it.id === id);
    if (!target) return;
    target.priceFields.forEach((f,i) => {
      const input = document.getElementById(`mqph-bulk-newprice-${i}`);
      if (input) input.value = f.value.toFixed(2);
    });
    document.getElementById('mqph-bulk-match-search').value = `Matched to: ${target.label}`;
    document.getElementById('mqph-bulk-match-results').innerHTML = '';
  };

  window.mqphBulkApply = async function() {
    const selected = _bulkEdit.items.filter(it => _bulkEdit.checkedIds.has(it.id));
    if (!selected.length) return;
    const newValues = selected[0].priceFields.map((f,i) => {
      const v = parseFloat(document.getElementById(`mqph-bulk-newprice-${i}`)?.value);
      return isNaN(v) ? null : v;
    });
    if (newValues.some(v => v === null)) { alert('Please enter a new price for every field (or pick an item above to match).'); return; }

    const summary = selected[0].priceFields.map((f,i) => `${f.label} → ${CUR()}${newValues[i].toFixed(2)}`).join(', ');
    if (!confirm(`Update ${selected.length} item${selected.length!==1?'s':''}?\n\n${summary}`)) return;

    // Group field updates by underlying record id first — crown/valance
    // have supply AND install on the same record, so those need to go out
    // as one combined update rather than two separate concurrent writes to
    // the same record.
    const writes = [];
    selected.forEach(it => {
      const byRecId = {};
      it.priceFields.forEach((f,i) => {
        const fieldName = f.key === 'install' ? 'Install rate' : 'Rate';
        if (!byRecId[f.recId]) byRecId[f.recId] = {};
        byRecId[f.recId][fieldName] = newValues[i];
      });
      Object.entries(byRecId).forEach(([recId, fields]) => writes.push(atUpdate(LINE_ITEMS_TABLE, recId, fields)));
    });
    try {
      await Promise.all(writes);
      mqphCloseBulkEdit();
      await loadAndRender();
    } catch(e) {
      console.error('Bulk update failed', e);
      alert('Something went wrong updating some items — please check and try again.');
    }
  };

  // View-only sort for the item list within each category — doesn't touch
  // the actual "Sort order" field at all, so it never affects what order
  // customers see on the widget. Purely a convenience for finding/editing
  // items in the dashboard (e.g. sort a big door list alphabetically to
  // find one, then it's still in its normal custom order for customers).
  let _mqphSortState = {}; // cat -> {field:'default'|'name'|'price', dir:'asc'|'desc'}
  function mqphSortRecs(cat, recs) {
    const state = _mqphSortState[cat] || {field:'default', dir:'asc'};
    const sorted = [...recs];
    if (state.field === 'name') sorted.sort((a,b) => (a.fields['Name']||'').localeCompare(b.fields['Name']||''));
    else if (state.field === 'price') sorted.sort((a,b) => (a.fields['Rate']||0) - (b.fields['Rate']||0));
    else sorted.sort((a,b) => (a.fields['Sort order']||0) - (b.fields['Sort order']||0));
    if (state.dir === 'desc') sorted.reverse();
    return sorted;
  }
  function mqphSortArrow(cat, field) {
    const state = _mqphSortState[cat] || {field:'default', dir:'asc'};
    if (state.field !== field) return '<span style="opacity:0.35">↕</span>';
    return state.dir === 'asc' ? '↑' : '↓';
  }
  window.mqphSetSort = function(cat, field) {
    const current = _mqphSortState[cat] || {field:'default', dir:'asc'};
    if (current.field === field) {
      // 3rd click cycles back to default order — asc, then desc, then back
      // to normal, without needing a dedicated "Order" label taking up
      // space of its own.
      _mqphSortState[cat] = current.dir === 'asc' ? { field, dir:'desc' } : { field:'default', dir:'asc' };
    } else {
      _mqphSortState[cat] = { field, dir:'asc' };
    }
    mqphRerenderPricingPage();
  };
  // Re-renders using data already loaded in memory — no need to hit
  // Airtable again just because a view-only sort preference changed.
  function mqphRerenderPricingPage() {
    const container = document.getElementById('mq-pricing-helper-v2');
    if (!container) return;
    container.innerHTML = buildEditorHTML();
    mqphRestoreExpandedCats();
  }

  // Collapsible category sections — same pattern as My Products, to keep
  // this page manageable once a shop has a lot of pricing set up. Tracked
  // in this set (not just the DOM) because loadAndRender rebuilds the whole
  // page's HTML from scratch after every save/delete — without this, every
  // section would silently re-collapse on every single action.
  let _mqphExpandedCats = new Set();
  window.mqphToggleCategory = function(cat) {
    const body = document.getElementById(`mqph-cat-body-${cat}`);
    const arrow = document.getElementById(`mqph-cat-arrow-${cat}`);
    if (!body) return;
    const opening = body.style.display === 'none';
    body.style.display = opening ? 'block' : 'none';
    if (arrow) arrow.style.transform = opening ? 'rotate(90deg)' : 'rotate(0deg)';
    if (opening) _mqphExpandedCats.add(cat); else _mqphExpandedCats.delete(cat);
  };
  // Re-applies whichever sections were open before the last rebuild —
  // called right after buildEditorHTML() replaces the page's innerHTML.
  function mqphRestoreExpandedCats() {
    _mqphExpandedCats.forEach(cat => {
      const body = document.getElementById(`mqph-cat-body-${cat}`);
      const arrow = document.getElementById(`mqph-cat-arrow-${cat}`);
      if (body) body.style.display = 'block';
      if (arrow) arrow.style.transform = 'rotate(90deg)';
    });
  }

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

  // Parse a material's edge/addon options JSON safely
  // Duplicate-name detection — the actual cause of at least one real
  // customer's inflated pricing: re-adding an item (via the mini-wizard or
  // any "+ Add" flow) that already exists silently creates a second,
  // independent record instead of catching the mistake. Material/drawer
  // names carry a suffix (— uppers/bases, — some/mostly drawers) that has
  // to be stripped before comparing, or "X — uppers" would never match
  // itself. Comparison is case-insensitive and only checks active items —
  // an intentionally-deactivated old item shouldn't block a legitimate
  // re-add of the same name.
  function mqphBaseNameFor(category, name) {
    if (category === 'material') return (name||'').replace(/\s*—\s*(uppers|bases)\s*$/i, '').trim();
    if (category === 'drawer') return (name||'').replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim();
    return (name||'').trim();
  }
  function mqphFindDuplicateName(category, name, excludeIds) {
    const targetBase = mqphBaseNameFor(category, name).toLowerCase();
    if (!targetBase) return null;
    const excludeSet = new Set(excludeIds||[]);
    return lineItems.find(r => r.fields && r.fields['Category']===category && r.fields['Active']!==false && !excludeSet.has(r.id) && mqphBaseNameFor(category, r.fields['Name']).toLowerCase() === targetBase) || null;
  }
  // Returns true if it's OK to proceed (no duplicate, or the shop owner
  // confirmed they want to add it anyway) — false if they backed out.
  function mqphWarnIfDuplicate(category, name, excludeIds) {
    const dupe = mqphFindDuplicateName(category, name, excludeIds);
    if (!dupe) return true;
    return confirm(`"${dupe.fields['Name']}" already exists in this category. Adding another one with the same name can cause pricing mix-ups later — Airtable can't tell them apart, and whichever one happens to be found first is the one that gets used.\n\nAdd it anyway?`);
  }

  function getAddonOptions(r) {
    try {
      const raw = r.fields['Addon options'];
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
        ? bsOpts.map(o=>`${o.label} (supply ${CUR()}${(o.supplyRate||0).toLocaleString()}, install ${CUR()}${(o.installRate||0).toLocaleString()}/lin ft)`).join(', ')
        : 'No backsplash options set';
      const cutoutOpts = getCutoutOptions(r);
      const cutoutSummary = cutoutOpts.length
        ? cutoutOpts.map(o=>`${o.label} ${CUR()}${(o.rate||0).toLocaleString()}`).join(', ')
        : null;
      return `
        <div class="mqph-row">
          <div style="flex:1;min-width:0">
            <div class="mqph-row-name">${r.fields['Name']||'—'}</div>
            <div class="mqph-row-desc">🧱 ${bsSummary}${cutoutSummary ? ` &nbsp;·&nbsp; ✂️ ${cutoutSummary}` : ''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:13px;flex-wrap:wrap">
            <span style="color:#6b7280;font-size:11px">Supply:</span>
            <span style="font-weight:600">${CUR()}${(r.fields['Rate']||0).toLocaleString()}</span>
            <span style="color:#6b7280;font-size:11px">/${su}</span>
            <span style="color:#d1d5db;margin:0 4px">·</span>
            <span style="color:#6b7280;font-size:11px">Install:</span>
            <span style="font-weight:600">${CUR()}${(r.fields['Install rate']||0).toLocaleString()}</span>
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

    // Every distinct edge/addon across all countertop materials, deduped by id
    // (the same addon object lives redundantly on every material it applies to).
    function mqphCountertopAddonList() {
      const seen = new Map();
      materials.forEach(m => getAddonOptions(m).forEach(a => { if (a && a.id && !seen.has(a.id)) seen.set(a.id, a); }));
      return [...seen.values()];
    }
    const addonList = mqphCountertopAddonList();
    const addonRow = (a) => {
      const taggedMats = materials.filter(m=>getAddonOptions(m).some(x=>x.id===a.id));
      const rates = taggedMats.map(m => getAddonOptions(m).find(x=>x.id===a.id)?.rate || 0);
      const allSame = rates.every(r => r === rates[0]);
      const rateLabel = !rates.length ? `${CUR()}0` : allSame ? `${CUR()}${rates[0].toLocaleString()}` : `${CUR()}${Math.min(...rates).toLocaleString()}–${CUR()}${Math.max(...rates).toLocaleString()}`;
      return `
      <div class="mqph-row">
        <div style="flex:1;min-width:0">
          <div class="mqph-row-name">${a.isEdge?'📐':'➕'} ${a.label}${a.isEdge?' <span style="font-weight:400;color:#6b7280;font-size:12px">(edge profile)</span>':''}</div>
          <div class="mqph-row-desc">Applies to: ${taggedMats.map(m=>m.fields['Name']).join(', ') || '—'}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:13px">
          <span style="font-weight:600">${rateLabel}</span>
          <span style="color:#6b7280;font-size:11px">${a.pricingType==='flat'?'flat rate':a.pricingType==='sqft'?'/ sq ft':'/ lin ft'}</span>
        </div>
        <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenAddonEdit('${a.id}')">Edit</button>
        <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDeleteAddon('${a.id}')">Delete</button>
      </div>`;
    };

    return `
      <div class="mqph-ct-block">
        <div class="mqph-cat-header" onclick="mqphToggleCategory('countertop')" style="cursor:pointer">
          <span class="mqph-cat-title"><span id="mqph-cat-arrow-countertop" style="display:inline-block;margin-right:6px;transition:transform 0.2s;font-size:12px">▶</span>🪨 Countertop pricing <span style="font-size:12px;font-weight:400;color:#9ca3af">(${materials.length})</span></span>
          <button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenCTAdd()">+ Add material</button>
        </div>
        <div id="mqph-cat-body-countertop" style="display:none">
        <div id="mqph-ct-msg" class="mqph-msg"></div>
        <div class="mqph-info" style="margin:12px 16px">
          Each material now carries its own backsplash height options and cutout pricing — no more separate backsplash/cutout items to keep in sync. Add a material below, then set its backsplash heights and cutout rates right inside it.
        </div>
        ${section('Materials', materials, matRow, 'No materials yet — add your first countertop material.')}
        <div style="padding:8px 16px 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;background:#f9fafb;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between">
          <span>Edges &amp; addons</span>
          <button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="mqphOpenAddonAdd()">+ New edge/addon</button>
        </div>
        <div class="mqph-info" style="margin:12px 16px">
          Edge profiles (like a bullnose or ogee edge) are always priced per linear foot and let the customer pick one per counter — if none are added, customers just get a standard edge at no extra charge. Addons (like a waterfall) can use any pricing method and stack in any quantity. Either kind can be tagged onto as many materials as you like.
        </div>
        ${addonList.length ? addonList.map(addonRow).join('') : `<div style="padding:1rem 16px;font-size:13px;color:#9ca3af">No edges or addons yet.</div>`}
        </div>
      </div>

      <!-- Countertop add/edit modal -->
      <div class="mqph-overlay" id="mqph-ct-modal-overlay">
        <div class="mqph-modal">
          <div class="mqph-modal-hdr">
            <div><h3 id="mqph-ct-modal-title">Add countertop material</h3></div>
            <button class="mqph-modal-hdr-close" onclick="mqphCloseCTModal()">×</button>
          </div>
          <div class="mqph-modal-body" id="mqph-ct-modal-body">
            <div class="mqph-field" id="mqph-ct-name-field"><label>Name</label><input type="text" id="mqph-ct-name" placeholder="e.g. Granite — Mid"/></div>

            <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #e5e7eb" id="mqph-ct-bulk-toggle-wrap">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;font-weight:500">
                <input type="checkbox" id="mqph-ct-bulk-toggle" onchange="mqphToggleCTBulk(this.checked)" style="width:auto"/>
                Adding multiple materials at the same price? (e.g. 10 laminate colors)
              </label>
              <div id="mqph-ct-bulk-wrap" style="display:none;margin-top:10px">
                <div class="mqph-input-row"><label>How many materials?</label><input type="number" id="mqph-ct-bulk-count" min="2" max="300" placeholder="e.g. 10"/></div>
                <p style="font-size:11px;color:#6b7280;margin-top:-6px">Set the shared pricing/backsplash/cutout settings below, then name each one at the end.</p>
              </div>
            </div>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Supply rate</div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span style="font-size:13px;color:#6b7280">${CUR()}</span>
                <input type="number" id="mqph-ct-supply-rate" placeholder="0.00" step="0.01" oninput="mqphSyncBsSupplyRate()" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
                <span style="font-size:13px;color:#6b7280">per</span>
                <select id="mqph-ct-supply-unit" onchange="mqphSyncBsSupplyRate()" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px">
                  <option value="sqft">sqft</option><option value="lin ft">lin ft</option>
                </select>
                ${mqphRateCalcIconHTML('mqph-ct-supply-rate', 'mqph-ct-supply-unit')}
              </div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Install rate</div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span style="font-size:13px;color:#6b7280">${CUR()}</span>
                <input type="number" id="mqph-ct-install-rate" placeholder="0.00" step="0.01" oninput="mqphSyncBsInstallRate()" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
                <span style="font-size:13px;color:#6b7280">per</span>
                <select id="mqph-ct-install-unit" onchange="mqphSyncBsInstallRate()" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px">
                  <option value="sqft">sqft</option><option value="lin ft">lin ft</option>
                </select>
                ${mqphRateCalcIconHTML('mqph-ct-install-rate', 'mqph-ct-install-unit')}
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
            <button class="mqph-btn mqph-btn-primary" id="mqph-ct-save-btn" onclick="mqphSaveCTItem()" style="margin-left:auto">Save</button>
          </div>
        </div>
      </div>

      <!-- Countertop edge/addon add/edit modal -->
      <div class="mqph-overlay" id="mqph-addon-modal-overlay">
        <div class="mqph-modal">
          <div class="mqph-modal-hdr">
            <div><h3 id="mqph-addon-modal-title">New edge/addon</h3></div>
            <button class="mqph-modal-hdr-close" onclick="mqphCloseAddonModal()">×</button>
          </div>
          <div class="mqph-modal-body">
            <div class="mqph-field"><label>Name</label><input type="text" id="mqph-addon-name" placeholder="e.g. Waterfall edge"/></div>

            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:1rem">
              <input type="checkbox" id="mqph-addon-isedge" onchange="mqphAddonToggleEdge(this.checked)" style="width:auto"/>
              This is an edge profile (customer picks one per counter — e.g. bullnose, ogee, mitered)
            </label>

            <div class="mqph-field">
              <label>Pricing method</label>
              <select id="mqph-addon-pricing">
                <option value="flat">Flat rate</option>
                <option value="linft">Per linear foot</option>
                <option value="sqft">Per square foot</option>
              </select>
              <div id="mqph-addon-edge-note" style="display:none;font-size:12px;color:#92400e;margin-top:6px">Edges are always priced per linear foot — this can't be changed.</div>
            </div>

            <div class="mqph-info" style="margin-bottom:1rem">
              💡 Flat rate keeps things simplest for the customer — it's one clear number, and since this is a ballpark tool, small real-world variation (extra material for an odd-shaped counter, a bit more labor on one job vs. another) is exactly what the estimate range is already there to absorb. Per linear/square foot makes sense when the cost genuinely scales with the size of the job — just know it adds a bit more for the customer to think through.
            </div>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Applies to these countertop materials</div>
              <div style="font-size:11px;color:#6b7280;margin-bottom:0.75rem">Check which materials this applies to, and set its own rate for each one — a waterfall on granite doesn't have to cost the same as a waterfall on laminate.</div>
              <div id="mqph-addon-materials" style="display:flex;flex-direction:column;gap:6px"></div>
            </div>
          </div>
          <div class="mqph-modal-footer">
            <button id="mqph-addon-delete" class="mqph-btn mqph-btn-danger" style="display:none" onclick="mqphDeleteAddon()">Delete</button>
            <button class="mqph-btn mqph-btn-secondary" onclick="mqphCloseAddonModal()">Cancel</button>
            <button class="mqph-btn mqph-btn-primary" onclick="mqphSaveAddon()" style="margin-left:auto">Save</button>
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
            <span style="font-weight:600">${CUR()}${(r.fields['Rate']||0).toLocaleString()}</span>
            <span style="color:#6b7280;font-size:11px">/lin ft</span>
            <span style="color:#d1d5db;margin:0 4px">·</span>
            <span style="color:#6b7280;font-size:11px">Install:</span>
            <span style="font-weight:600">${CUR()}${(r.fields['Install rate']||0).toLocaleString()}</span>
            <span style="color:#6b7280;font-size:11px">/lin ft</span>
          </div>
          <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active']?'on':''}" onclick="mqphToggle('${r.id}',this)"></div></div>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenTrimEdit('${r.id}')">Edit</button>
          <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDelete('${r.id}')">Delete</button>
        </div>`;
    }

    const trimSection = (title, items, emptyMsg, bulkCat) => `<div style="padding:8px 16px 4px;display:flex;align-items:center;justify-content:space-between;background:#f9fafb;border-bottom:1px solid #f3f4f6">
        <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">${title}</span>
        ${items.length > 0 ? `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenBulkEdit('${bulkCat}')">📊 Bulk edit</button>` : ''}
      </div>
      ${items.length > 0 ? items.map(trimRow).join('') : `<div style="padding:1rem 16px;font-size:13px;color:#9ca3af">${emptyMsg}</div>`}`;

    return `
      <div class="mqph-ct-block">
        <div class="mqph-cat-header" onclick="mqphToggleCategory('trim')" style="cursor:pointer">
          <span class="mqph-cat-title"><span id="mqph-cat-arrow-trim" style="display:inline-block;margin-right:6px;transition:transform 0.2s;font-size:12px">▶</span>👑 Crown moulding / valance <span style="font-size:12px;font-weight:400;color:#9ca3af">(${trimItems.length})</span></span>
          <button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenTrimAdd()">+ Add style</button>
        </div>
        <div id="mqph-cat-body-trim" style="display:none">
        <div id="mqph-trim-msg" class="mqph-msg"></div>
        ${trimSection('Crown moulding', crownItems, 'No crown moulding styles yet — add one above.', 'trim_crown')}
        ${trimSection('Valance', valanceItems, 'No valance styles yet — add one above.', 'trim_valance')}
        <div style="padding:0.75rem 16px;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6">Customers can choose crown, valance, both, or neither — cost is calculated from the upper cabinet linear footage plus any wall returns they enter.</div>
        </div>
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
              <select id="mqph-trim-type" onchange="mqphUpdateTrimTypeHint()"><option value="crown">Crown moulding</option><option value="valance">Valance</option></select>
            </div>
            <div class="mqph-field">
              <label>Style name</label>
              <input type="text" id="mqph-trim-name" placeholder="e.g. Standard crown — Maple"/>
            </div>
            <div class="mqph-field">
              <label>Which door styles show this <span id="mqph-trim-type-label-for-hint">crown</span>?</label>
              <div style="display:flex;gap:6px;margin-bottom:6px">
                <input type="text" id="mqph-trim-door-search" placeholder="Search door styles…" oninput="mqphTrimDoorSearch(this.value)" style="flex:1;font-size:12px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box"/>
                <button type="button" onclick="mqphTrimDoorSelectAll(true)" style="font-size:11px;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;white-space:nowrap">Select all</button>
                <button type="button" onclick="mqphTrimDoorSelectAll(false)" style="font-size:11px;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;white-space:nowrap">Deselect all</button>
              </div>
              <div id="mqph-trim-door-link-list" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;max-height:160px;overflow-y:auto"></div>
              <div style="font-size:11px;color:#9ca3af;margin-top:4px">Only the door styles checked here will show this <span id="mqph-trim-type-label-for-hint2">crown</span> as an option on the widget — anything left unchecked stays hidden for it. "Select all" / "Deselect all" only apply to whatever's currently showing under your search.</div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Supply rate (per linear foot)</div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span style="font-size:13px;color:#6b7280">${CUR()}</span>
                <input type="number" id="mqph-trim-supply-rate" placeholder="0.00" step="0.01" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
                <span style="font-size:13px;color:#6b7280">/ lin ft</span>
                ${mqphRateCalcIconHTML('mqph-trim-supply-rate', '', 'linear')}
              </div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Install rate (per linear foot)</div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span style="font-size:13px;color:#6b7280">${CUR()}</span>
                <input type="number" id="mqph-trim-install-rate" placeholder="0.00" step="0.01" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
                <span style="font-size:13px;color:#6b7280">/ lin ft</span>
                ${mqphRateCalcIconHTML('mqph-trim-install-rate', '', 'linear')}
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

  // ============================================================
  // TALL CABINET EDITOR
  // ============================================================
  function buildTallCabHtml() {
    const tallCabs = lineItems.filter(r => r.fields && r.fields['Category'] === 'tall_cabinet')
      .sort((a,b) => (a.fields['Sort order']||0) - (b.fields['Sort order']||0));

    const wizardHasRun = lineItems.some(r => r.fields && r.fields['Category'] === 'material' && (r.fields['Rate']||0) > 0);

    function tallRow(r) {
      return `
        <div class="mqph-row">
          <div style="flex:1;min-width:0">
            <div class="mqph-row-name">${r.fields['Name']||'—'}</div>
            <div class="mqph-row-desc">Base unit price — door, material & install upcharges applied automatically by widget</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;font-size:13px">
            <span style="color:#6b7280;font-size:11px">Base price:</span>
            <span style="font-weight:600">${CUR()}${(r.fields['Rate']||0).toLocaleString()}</span>
            <span style="color:#6b7280;font-size:11px">/ unit</span>
          </div>
          <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active']?'on':''}" onclick="mqphToggle('${r.id}',this)"></div></div>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenTallCabEdit('${r.id}')">Edit</button>
          <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDelete('${r.id}')">Delete</button>
        </div>`;
    }

    return `
      <div class="mqph-ct-block">
        <div class="mqph-cat-header" onclick="mqphToggleCategory('tallcab')" style="cursor:pointer">
          <span class="mqph-cat-title"><span id="mqph-cat-arrow-tallcab" style="display:inline-block;margin-right:6px;transition:transform 0.2s;font-size:12px">▶</span>🏛️ Tall cabinets <span style="font-size:12px;font-weight:400;color:#9ca3af">(${tallCabs.length})</span></span>
          ${wizardHasRun
            ? `<button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenTallCabAdd()">+ Add type</button>`
            : `<span style="font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:4px 10px">Complete main pricing wizard first</span>`
          }
        </div>
        <div id="mqph-cat-body-tallcab" style="display:none">
        <div id="mqph-tallcab-msg" class="mqph-msg"></div>
        <div class="mqph-info" style="margin:12px 16px;line-height:1.6">
          Add each tall cabinet variation you offer — with pullouts, oven unit, pantry, etc. Quote each as a standard <strong>24" wide unit using your baseline material, no doors</strong> (supply only). The widget automatically calculates door upcharges, material upcharges, hinge upcharges, and install on top based on what the customer has selected.
        </div>
        ${tallCabs.length
          ? tallCabs.map(tallRow).join('')
          : `<div style="padding:1rem 16px;font-size:13px;color:#9ca3af">No tall cabinet types yet — add your first one above.</div>`
        }
        <div style="padding:0.75rem 16px;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6">The widget reminds customers not to include tall cabinet wall space in their upper and base measurements.</div>
        </div>
      </div>

      <!-- Tall cabinet add/edit modal -->
      <div class="mqph-overlay" id="mqph-tallcab-modal-overlay">
        <div class="mqph-modal">
          <div class="mqph-modal-hdr mqph-mini-hdr" style="background:#1a1a1a;border-radius:12px 12px 0 0">
            <div>
              <h3 id="mqph-tallcab-modal-title" style="color:#fff;font-size:15px">Add tall cabinet type</h3>
              <p id="mqph-tallcab-modal-sub" style="color:rgba(255,255,255,0.6);font-size:12px;margin:3px 0 0;padding:0"></p>
              <div id="mqph-tallcab-modal-progress" style="display:flex;gap:4px;margin-top:10px"></div>
            </div>
            <button class="mqph-modal-hdr-close" onclick="mqphCloseTallCabModal()" style="color:rgba(255,255,255,0.7);font-size:22px">×</button>
          </div>
          <div class="mqph-modal-body" id="mqph-tallcab-modal-content"></div>
          <div class="mqph-modal-footer">
            <button class="mqph-btn mqph-btn-secondary" id="mqph-tallcab-back" onclick="mqphTallCabBack()" style="display:none">← Back</button>
            <button class="mqph-btn mqph-btn-primary" id="mqph-tallcab-next" onclick="mqphTallCabNext()" style="margin-left:auto">Next →</button>
          </div>
        </div>
      </div>`;
  }

  // Tall cabinet mini wizard state
  let tallCabWiz = { step: 0, name: '', editId: null, price: null };

  function renderTallCabWizStep() {
    const bl = getBaselineRates();
    const step = tallCabWiz.step;
    const name = tallCabWiz.name;
    const isEdit = !!tallCabWiz.editId;

    const titleEl    = document.getElementById('mqph-tallcab-modal-title');
    const subEl      = document.getElementById('mqph-tallcab-modal-sub');
    const progressEl = document.getElementById('mqph-tallcab-modal-progress');
    const contentEl  = document.getElementById('mqph-tallcab-modal-content');
    const nextBtn    = document.getElementById('mqph-tallcab-next');
    const backBtn    = document.getElementById('mqph-tallcab-back');

    const dots = ['Name','Quote'].map((_,i) =>
      `<div style="flex:1;height:3px;border-radius:2px;background:${i<step?'#a3e635':i===step?'#fff':'rgba(255,255,255,0.25)'};transition:background 0.3s"></div>`
    ).join('');
    if (progressEl) progressEl.innerHTML = dots;

    if (step === 0) {
      if (titleEl) titleEl.textContent = isEdit ? 'Edit tall cabinet type' : '🏛️ Add tall cabinet type';
      if (subEl)   subEl.textContent   = 'Step 1 of 2 — name it first';
      if (contentEl) contentEl.innerHTML = `
        <p style="font-size:13px;color:#6b7280;margin-bottom:1rem;line-height:1.6">What do you call this tall cabinet? Be descriptive — it appears in your widget as a selectable option.</p>
        <input class="mqph-name-input" type="text" id="mqph-tallcab-name-inp" placeholder="e.g. Tall cabinet — all doors & shelves" value="${name.replace(/"/g,'&quot;')}" onkeydown="if(event.key==='Enter')mqphTallCabNext()"/>
        <div style="font-size:12px;color:#9ca3af;margin-top:-0.5rem;line-height:1.5">Examples: "Tall cab with pullouts", "Oven unit", "Pantry — all doors", "Tall cab — drawer bank bottom"</div>`;
      if (nextBtn) { nextBtn.textContent = 'Next →'; nextBtn.disabled = false; }
      if (backBtn) backBtn.style.display = 'none';

    } else if (step === 1) {
      if (titleEl) titleEl.textContent = '🏛️ Quote this tall cabinet';
      if (subEl)   subEl.textContent   = name;
      if (contentEl) contentEl.innerHTML = `
        <p style="font-size:13px;color:#6b7280;margin-bottom:1.25rem;line-height:1.6">Quote this exact tall cabinet in your software, then enter the total below.</p>
        ${specBox([
          `<strong>${name}</strong>`,
          `Width: <span class="mqph-spec-tag">24" (610mm)</span> (standard tall cabinet width)`,
          `Material: <span class="mqph-spec-tag">${bl.blMatName||'your baseline material'}</span>`,
          `<strong>No doors · No hinges · Supply only · No install · Local delivery</strong>`,
          `Include the box, shelves, and any interior fittings specific to this type (pullouts, drawer boxes, etc.)`,
          `<span style="color:#1e40af">Door upcharges, hinge upcharges, material upcharges, and install will be calculated automatically by the widget based on what the customer selects.</span>`,
        ])}
        <div class="mqph-price-input-wrap"><span class="mqph-pfx">${CUR()}</span><input class="mqph-price-input-big" type="number" id="mqph-tallcab-price" placeholder="0" oninput="mqphTallCabCalc()"/></div>
        <p class="mqph-calc-hint">Base unit price only — door, hinge, material & install upcharges are added automatically</p>
        <div class="mqph-rate-reveal" id="mqph-tallcab-reveal" style="display:none">
          <div class="mqph-rate-reveal-val" id="mqph-tallcab-rate-val">—</div>
          <div class="mqph-rate-reveal-lbl">base unit price (stored as-is)</div>
        </div>`;
      if (nextBtn) { nextBtn.textContent = 'Save →'; nextBtn.disabled = false; }
      if (backBtn) backBtn.style.display = 'inline-block';
      if (tallCabWiz.price) setTimeout(() => { const el = document.getElementById('mqph-tallcab-price'); if(el){el.value=tallCabWiz.price;mqphTallCabCalc();} }, 50);
    }
  }

  window.mqphTallCabCalc = function() {
    const p = parseFloat(document.getElementById('mqph-tallcab-price')?.value || 0);
    const reveal = document.getElementById('mqph-tallcab-reveal');
    const val    = document.getElementById('mqph-tallcab-rate-val');
    if (reveal && val) {
      if (p > 0) { reveal.style.display = 'block'; val.textContent = `${CUR()}${p.toLocaleString()} / unit`; }
      else reveal.style.display = 'none';
    }
  };

  window.mqphTallCabNext = async function() {
    const step = tallCabWiz.step;
    if (step === 0) {
      const name = document.getElementById('mqph-tallcab-name-inp')?.value.trim();
      if (!name) { const inp = document.getElementById('mqph-tallcab-name-inp'); if(inp){inp.style.borderColor='#dc2626';inp.focus();} return; }
      tallCabWiz.name = name;
      tallCabWiz.step = 1;
      renderTallCabWizStep();
    } else if (step === 1) {
      const p = parseFloat(document.getElementById('mqph-tallcab-price')?.value || 0);
      if (!p || p <= 0) { const inp = document.getElementById('mqph-tallcab-price'); if(inp){inp.style.borderBottomColor='#dc2626';inp.focus();} return; }
      if (!tallCabWiz.editId && !mqphWarnIfDuplicate('tall_cabinet', tallCabWiz.name)) return;
      tallCabWiz.price = p;
      const nextBtn = document.getElementById('mqph-tallcab-next');
      if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Saving…'; }
      try {
        const fields = {
          shop: [shopRecord._recordId], Name: tallCabWiz.name, Category: 'tall_cabinet',
          Rate: p, Unit: 'per unit',
          Description: 'Base unit price — 24" wide, baseline material & door, supply only',
          Active: true,
        };
        if (tallCabWiz.editId) {
          await atUpdate(LINE_ITEMS_TABLE, tallCabWiz.editId, fields);
        } else {
          fields['Sort order'] = lineItems.filter(r=>r.fields?.['Category']==='tall_cabinet').length + 1;
          const rec = await atCreate(LINE_ITEMS_TABLE, fields);
          if (rec?.id) lineItems.push(rec);
        }
        mqphCloseTallCabModal();
        await loadAndRender();
      } catch(e) {
        console.error('Tall cab save error:', e);
        if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Save →'; }
        alert('Error saving. Please try again.');
      }
    }
  };

  window.mqphTallCabBack = function() {
    if (tallCabWiz.step > 0) { tallCabWiz.step--; renderTallCabWizStep(); }
  };

  window.mqphOpenTallCabAdd = function() {
    tallCabWiz = { step: 0, name: '', editId: null, price: null };
    document.getElementById('mqph-tallcab-modal-overlay')?.classList.add('show');
    renderTallCabWizStep();
  };

  window.mqphOpenTallCabEdit = function(id) {
    const rec = lineItems.find(r => r.id === id); if (!rec) return;
    tallCabWiz = { step: 0, name: rec.fields['Name']||'', editId: id, price: rec.fields['Rate']||null };
    document.getElementById('mqph-tallcab-modal-overlay')?.classList.add('show');
    renderTallCabWizStep();
  };

  window.mqphCloseTallCabModal = function() {
    document.getElementById('mqph-tallcab-modal-overlay')?.classList.remove('show');
    tallCabWiz = { step: 0, name: '', editId: null, price: null };
  };

  let currentTrimEditId = null;
  let currentBsOptions = []; // in-memory list while the CT modal is open
  let currentCutoutOptions = []; // in-memory list while the CT modal is open
  let ctBulk = null; // shared config captured before the bulk naming screen
  let ctModalOriginalBodyHTML = null; // captured once, restored before every open (bulk naming screen overwrites the body)

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

  // A shop owner thinking in metric shouldn't have to do the sqft/linft
  // math themselves just to set a countertop rate — this "Use metric?"
  // calculator (same idea as the one on the dashboard's Specialty Items
  // tab) opens a tiny popover where they type their rate per square metre
  // or per linear metre — whichever matches the field's current "per"
  // dropdown — and it converts and drops the equivalent rate straight into
  // the Supply/Install rate field. The stored rate and the widget's own
  // pricing math never change — this is purely a friendlier way to type
  // the same number.
  // targetUnitSelectId: id of a <select> whose current value ('lin ft' vs
  // anything else) decides linear-vs-sqft mode. Pass forcedMode ('linear' or
  // 'sqft') instead when there's no unit dropdown at all — e.g. Crown/Valance
  // rates, which are always per linear foot.
  function mqphRateCalcIconHTML(targetInputId, targetUnitSelectId, forcedMode) {
    const svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="2" width="16" height="20" rx="2" stroke="#1d4ed8" stroke-width="1.8"/><rect x="6.5" y="4.5" width="11" height="4" rx="0.5" fill="#1d4ed8"/><rect x="6.5" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="10.7" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="14.9" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="6.5" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="10.7" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="14.9" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="6.5" y="19" width="11" height="2" rx="0.4" fill="#1d4ed8"/></svg>`;
    return `<span style="display:inline-flex;align-items:center;gap:7px;margin-left:6px">
      <span style="font-size:11px;color:#2563eb;font-weight:600;white-space:nowrap">Use metric?</span>
      <button type="button" onclick="mqphShowRateCalc(this,'${targetInputId}','${targetUnitSelectId||''}',event,'${forcedMode||''}')" title="Enter a metric rate instead (per m² or per linear metre) — we'll convert it" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;cursor:pointer;padding:0;flex-shrink:0">${svg}</button>
    </span>`;
  }

  window.mqphShowRateCalc = function(triggerEl, targetInputId, targetUnitSelectId, event, forcedMode) {
    if (event) event.stopPropagation();
    let mode;
    if (forcedMode === 'linear' || forcedMode === 'sqft') {
      mode = forcedMode;
    } else {
      const unitSelect = document.getElementById(targetUnitSelectId);
      mode = (unitSelect?.value === 'lin ft') ? 'linear' : 'sqft';
    }
    let pop = document.getElementById('mqph-rate-calc-popover');
    const alreadyOpenForThis = pop && pop.style.display === 'block' && pop._trigger === triggerEl;
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'mqph-rate-calc-popover';
      pop.style.cssText = 'position:absolute;z-index:100002;display:none;background:#fff;color:#111;font-size:13px;line-height:1.5;padding:14px;border-radius:10px;width:230px;box-shadow:0 8px 24px rgba(0,0,0,0.25);border:1px solid #e5e7eb';
      pop.addEventListener('click', (e) => e.stopPropagation());
      document.body.appendChild(pop);
      // Only need to wire this once — closes the popover on any outside
      // click, same pattern as the dashboard's Specialty Items version.
      document.addEventListener('click', () => { pop.style.display = 'none'; });
    }
    if (alreadyOpenForThis) { pop.style.display = 'none'; return; }
    pop._trigger = triggerEl;
    pop._targetInputId = targetInputId;
    pop._mode = mode;
    const unitLabel = mode === 'linear' ? 'linear metre' : 'square metre (m²)';
    const targetUnitLabel = mode === 'linear' ? 'lin ft' : 'sq ft';
    pop.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;font-size:13px">🧮 Enter rate per ${unitLabel}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <span style="color:#6b7280">${CUR()}</span>
        <input type="number" id="mqph-rate-calc-input" placeholder="0.00" style="flex:1;min-width:0;font-size:14px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit" oninput="mqphRateCalcUpdate()"/>
      </div>
      <div style="background:#f0fdf4;border-radius:6px;padding:8px 10px;margin-bottom:10px;text-align:center">
        <div style="font-size:11px;color:#6b7280">= per ${targetUnitLabel}</div>
        <div id="mqph-rate-calc-result" style="font-size:15px;font-weight:700;color:#166534">${CUR()}0.00</div>
      </div>
      <div style="display:flex;gap:6px">
        <button type="button" onclick="mqphCloseRateCalc()" style="flex:1;padding:7px;border-radius:6px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>
        <button type="button" onclick="mqphApplyRateCalc()" style="flex:1;padding:7px;border-radius:6px;border:none;background:#1a1a1a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Use this</button>
      </div>`;
    const rect = triggerEl.getBoundingClientRect();
    pop.style.display = 'block';
    pop.style.top = (window.scrollY + rect.bottom + 6) + 'px';
    pop.style.left = Math.max(8, window.scrollX + rect.left - 100) + 'px';
    setTimeout(() => document.getElementById('mqph-rate-calc-input')?.focus(), 50);
  };

  window.mqphRateCalcUpdate = function() {
    const pop = document.getElementById('mqph-rate-calc-popover');
    const input = document.getElementById('mqph-rate-calc-input');
    const resultEl = document.getElementById('mqph-rate-calc-result');
    if (!pop || !input || !resultEl) return;
    const val = parseFloat(input.value) || 0;
    // 1 sqft = 0.092903 sqm, 1 ft = 0.3048 m — same conversion the
    // Specialty Items calculator uses.
    const converted = pop._mode === 'linear' ? val * 0.3048 : val * 0.092903;
    resultEl.textContent = CUR() + converted.toFixed(2);
  };

  window.mqphApplyRateCalc = function() {
    const pop = document.getElementById('mqph-rate-calc-popover');
    const input = document.getElementById('mqph-rate-calc-input');
    if (!pop || !input || !pop._targetInputId) return;
    const val = parseFloat(input.value) || 0;
    const converted = pop._mode === 'linear' ? val * 0.3048 : val * 0.092903;
    const rounded = Math.round(converted * 100) / 100;
    const targetEl = document.getElementById(pop._targetInputId);
    if (targetEl) {
      targetEl.value = rounded;
      // Programmatic value changes don't fire input events on their own —
      // dispatch one so mqphSyncBsSupplyRate/InstallRate (which keep the
      // backsplash height options' auto-synced rates in step) actually run.
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    mqphCloseRateCalc();
  };

  window.mqphCloseRateCalc = function() {
    const pop = document.getElementById('mqph-rate-calc-popover');
    if (pop) pop.style.display = 'none';
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
            <span style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em">Supply ${CUR()}</span>
            <div style="display:flex;gap:4px;align-items:center">
              <input type="number" value="${o.supplyRate!=null?o.supplyRate:''}" placeholder="0.00" step="0.01" oninput="mqphUpdateBsOption(${i},'supplyRate',this.value,true)" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px;width:80px;text-align:right"/>
              <select onchange="mqphUpdateBsOption(${i},'supplyUnit',this.value,false)" style="font-family:inherit;font-size:12px;border:1px solid #d1d5db;border-radius:8px;padding:6px 6px;min-width:60px">${unitOpts(o.supplyUnit||matSupplyUnit)}</select>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;min-width:90px">
            <span style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em">Install ${CUR()}</span>
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
        <span style="font-size:11px;color:#9ca3af">${CUR()}</span>
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
    const body = document.getElementById('mqph-ct-modal-body');
    if (body) {
      if (ctModalOriginalBodyHTML === null) ctModalOriginalBodyHTML = body.innerHTML; // first-ever open — capture the pristine form
      else body.innerHTML = ctModalOriginalBodyHTML; // restore in case the bulk naming screen replaced it last time
    }
    const saveBtn = document.getElementById('mqph-ct-save-btn');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; saveBtn.onclick = () => mqphSaveCTItem(); }
    currentCutoutOptions = [{label:'Sink cutout', rate:180}, {label:'Cooktop cutout', rate:220}];
    document.getElementById('mqph-ct-modal-title').textContent = 'Add countertop material';
    document.getElementById('mqph-ct-name').value = '';
    document.getElementById('mqph-ct-supply-rate').value = '';
    document.getElementById('mqph-ct-supply-unit').value = 'sqft';
    document.getElementById('mqph-ct-install-rate').value = '';
    document.getElementById('mqph-ct-install-unit').value = 'sqft';
    document.getElementById('mqph-ct-active').checked = true;
    // Default row — auto-sync flags update it live as user types rates above
    currentBsOptions = [{ label:'4" standard', heightIn:4, supplyRate:0, supplyUnit:'sqft', installRate:0, installUnit:'sqft', _supplyAutoSync:true, _installAutoSync:true }];
    mqphRenderBsList();
    mqphRenderCutoutList();
    document.getElementById('mqph-ct-bulk-toggle-wrap').style.display = 'block';
    document.getElementById('mqph-ct-bulk-toggle').checked = false;
    mqphToggleCTBulk(false);
    document.getElementById('mqph-ct-modal-overlay').classList.add('show');
  };

  window.mqphToggleCTBulk = function(checked) {
    const nameField = document.getElementById('mqph-ct-name-field');
    const bulkWrap = document.getElementById('mqph-ct-bulk-wrap');
    if (nameField) nameField.style.display = checked ? 'none' : 'flex';
    if (bulkWrap) bulkWrap.style.display = checked ? 'block' : 'none';
  };

  window.mqphOpenCTEdit = function(id) {
    const rec = lineItems.find(r=>r.id===id); if(!rec) return;
    currentCTEditId = id;
    const body = document.getElementById('mqph-ct-modal-body');
    if (body && ctModalOriginalBodyHTML !== null) body.innerHTML = ctModalOriginalBodyHTML;
    const saveBtn = document.getElementById('mqph-ct-save-btn');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; saveBtn.onclick = () => mqphSaveCTItem(); }
    currentBsOptions = getBsOptions(rec);
    const matSupply  = rec.fields['Rate']||0;
    const matInstall = rec.fields['Install rate']||0;
    const unitParts  = (rec.fields['Unit']||'sqft|sqft').split('|');
    const matSupplyUnit  = (unitParts[0]||'sqft').trim();
    const matInstallUnit = (unitParts[1]||'sqft').trim();
    // Backfill any missing rate/unit fields on existing bs rows
    currentBsOptions.forEach(o => {
      if (o.supplyRate==null  || o.supplyRate===0)  { o.supplyRate  = matSupply;  o._supplyAutoSync  = true; }
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
    // Bulk-add only makes sense when creating new items, not editing one
    document.getElementById('mqph-ct-bulk-toggle-wrap').style.display = 'none';
    mqphToggleCTBulk(false);
    document.getElementById('mqph-ct-modal-overlay').classList.add('show');
  };

  window.mqphCloseCTModal = function() { document.getElementById('mqph-ct-modal-overlay')?.classList.remove('show'); };

  window.mqphSaveCTItem = async function() {
    const bulkOn = document.getElementById('mqph-ct-bulk-toggle')?.checked && !currentCTEditId;
    const su = document.getElementById('mqph-ct-supply-unit').value;
    const iu = document.getElementById('mqph-ct-install-unit').value;
    // Drop any half-filled backsplash/cutout rows (no label) before saving
    const cleanBsOptions = currentBsOptions.filter(o => (o.label||'').trim().length > 0).map(({label, heightIn, supplyRate, supplyUnit, installRate, installUnit}) => ({label, heightIn, supplyRate, supplyUnit, installRate, installUnit}));
    const cleanCutoutOptions = currentCutoutOptions.filter(o => (o.label||'').trim().length > 0);

    if (bulkOn) {
      const count = parseInt(document.getElementById('mqph-ct-bulk-count')?.value || '0', 10);
      if (!count || count < 2) {
        const inp = document.getElementById('mqph-ct-bulk-count');
        if (inp) { inp.style.borderColor = '#dc2626'; inp.focus(); }
        return;
      }
      ctBulk = {
        count,
        supplyRate: parseFloat(document.getElementById('mqph-ct-supply-rate').value||0),
        installRate: parseFloat(document.getElementById('mqph-ct-install-rate').value||0),
        unit: `${su}|${iu}`,
        bsOptions: cleanBsOptions,
        cutoutOptions: cleanCutoutOptions,
        active: document.getElementById('mqph-ct-active').checked,
      };
      mqphShowCTBulkNameScreen();
      return;
    }

    const name = document.getElementById('mqph-ct-name').value.trim();
    if (!name) { alert('Please enter a name.'); return; }
    if (!currentCTEditId && !mqphWarnIfDuplicate('countertop', name)) return;
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

  // After the shared supply/install/backsplash/cutout settings are set,
  // this swaps the same modal to a naming list — same pattern as the
  // mini-wizard's bulk flow, just inside a modal instead of the full-screen
  // wizard overlay since Countertops don't use that flow at all.
  window.mqphShowCTBulkNameScreen = function() {
    document.getElementById('mqph-ct-modal-title').textContent = `Name your ${ctBulk.count} new materials`;
    const existingGroups = [...new Set(lineItems.filter(r=>r.fields&&r.fields['Category']==='countertop'&&(r.fields['Group name']||'').trim()).map(r=>r.fields['Group name'].trim()))];
    const rows = Array.from({length: ctBulk.count}, (_,i) => `
      <div style="margin-bottom:8px">
        <input type="text" id="mqph-ct-bulk-name-${i}" class="mqph-name-input" style="font-size:14px;padding:8px 10px" placeholder="Material #${i+1}"/>
      </div>`).join('');
    document.getElementById('mqph-ct-modal-body').innerHTML = `
      <p style="font-size:13px;color:#6b7280;margin-bottom:1rem;line-height:1.6">All share the pricing/backsplash/cutout settings you just set. Type each name — leave any blank and we'll flag it before saving.</p>
      <div style="margin-bottom:1rem;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px">
        <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">Group name (optional)</label>
        <div style="position:relative">
          <input type="text" id="mqph-ct-bulk-group" list="mqph-ct-bulk-group-list" placeholder="e.g. Laminates — leave blank for no group" style="width:100%;padding-right:28px"/>
          <span onclick="document.getElementById('mqph-ct-bulk-group').focus()" style="position:absolute;right:6px;top:0;bottom:0;width:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#9ca3af;font-size:11px">▼</span>
        </div>
        <datalist id="mqph-ct-bulk-group-list">${existingGroups.map(g=>`<option value="${g.replace(/"/g,'&quot;')}"></option>`).join('')}</datalist>
        <div style="font-size:11px;color:#6b7280;margin-top:4px">Match an existing group to add these to it, or type a new name to create one.</div>
      </div>
      <div style="max-height:300px;overflow-y:auto;padding-right:4px">${rows}</div>
      <div id="mqph-ct-bulk-name-warn" style="display:none;margin-top:10px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12px;color:#991b1b"></div>
    `;
    const saveBtn = document.getElementById('mqph-ct-save-btn');
    if (saveBtn) { saveBtn.textContent = `Create ${ctBulk.count} items →`; saveBtn.onclick = () => mqphSaveCTBulkNames(); }
  };

  window.mqphSaveCTBulkNames = async function() {
    const count = ctBulk.count;
    const names = [];
    const blanks = [];
    for (let i = 0; i < count; i++) {
      const v = document.getElementById(`mqph-ct-bulk-name-${i}`)?.value.trim() || '';
      names.push(v);
      if (!v) blanks.push(i+1);
    }
    const warnEl = document.getElementById('mqph-ct-bulk-name-warn');
    if (blanks.length) {
      if (warnEl) { warnEl.style.display='block'; warnEl.textContent = `${blanks.length} item${blanks.length>1?'s are':' is'} still unnamed (#${blanks.slice(0,10).join(', ')}${blanks.length>10?', …':''}). Fill in every name before saving.`; }
      const firstBlank = document.getElementById(`mqph-ct-bulk-name-${blanks[0]-1}`);
      if (firstBlank) firstBlank.focus();
      return;
    }
    const seen = new Set();
    const internalDupes = [];
    names.forEach(n => { const k = n.toLowerCase(); if (seen.has(k)) internalDupes.push(n); else seen.add(k); });
    const existingDupes = names.filter(n => mqphFindDuplicateName('countertop', n));
    const allDupes = [...new Set([...internalDupes, ...existingDupes])];
    if (allDupes.length) {
      if (!confirm(`These names look like duplicates (either repeated in your list, or already exist): ${allDupes.slice(0,15).join(', ')}${allDupes.length>15?', …':''}.\n\nSave everything anyway?`)) return;
    }

    const groupName = (document.getElementById('mqph-ct-bulk-group')?.value || '').trim();
    const groupFields = {};
    if (groupName) {
      const groupMembers = lineItems.filter(r=>r.fields&&r.fields['Category']==='countertop'&&(r.fields['Group name']||'').trim()===groupName);
      groupFields['Group name'] = groupName;
      if (groupMembers.length) {
        groupFields['Group sort order'] = groupMembers.find(m=>typeof m.fields['Group sort order']==='number')?.fields['Group sort order'] || 0;
        groupFields['Group description'] = groupMembers.find(m=>m.fields['Group description'])?.fields['Group description'] || '';
      } else {
        const allOrders = [...new Set(lineItems.filter(r=>r.fields&&r.fields['Category']==='countertop'&&(r.fields['Group name']||'').trim()).map(r=>r.fields['Group sort order']||0))];
        groupFields['Group sort order'] = allOrders.length ? Math.max(...allOrders)+1 : 0;
      }
    }

    const saveBtn = document.getElementById('mqph-ct-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    let sortBase = lineItems.filter(r=>r.fields?.['Category']==='countertop').length;
    try {
      const writes = names.map(nm => atCreate(LINE_ITEMS_TABLE, {
        shop:[shopRecord._recordId], Name:nm, Category:'countertop',
        Rate: ctBulk.supplyRate, 'Install rate': ctBulk.installRate, Unit: ctBulk.unit,
        Description:'type:material',
        'Backsplash options': JSON.stringify(ctBulk.bsOptions),
        'Cutout options': JSON.stringify(ctBulk.cutoutOptions),
        Active: ctBulk.active, 'Sort order': ++sortBase, ...groupFields,
      }));
      await Promise.all(writes);
      mqphCloseCTModal();
      await loadAndRender();
    } catch(e) {
      console.error('CT bulk save error:', e);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = `Create ${count} items →`; }
      alert('Something went wrong saving these — please try again. Anything already created stayed saved, so check Pricing before re-running to avoid duplicates.');
    }
  };

  // ============================================================
  // COUNTERTOP EDGE/ADDON MANAGER — edge profiles (single-select per
  // counter, always priced per linear foot) and stackable extras like a
  // waterfall (flat/linear ft/sq ft). One addon object, redundantly stored
  // in the 'Addon options' JSON list on every countertop material it
  // applies to — create once here, tag onto as many materials as needed.
  // ============================================================
  let currentAddonEditId = null; // null = creating a brand new addon

  window.mqphAddonToggleEdge = function(checked) {
    const pricingSel = document.getElementById('mqph-addon-pricing');
    const note = document.getElementById('mqph-addon-edge-note');
    if (!pricingSel || !note) return;
    if (checked) { pricingSel.value = 'linft'; pricingSel.disabled = true; note.style.display = 'block'; }
    else { pricingSel.disabled = false; note.style.display = 'none'; }
  };

  function mqphCountertopMaterials() {
    return lineItems.filter(r=>r.fields&&r.fields['Category']==='countertop'&&!(r.fields['Description']||'').includes('type:backsplash')&&!(r.fields['Description']||'').includes('type:cutout'))
      .sort((a,b)=>(a.fields['Sort order']||0)-(b.fields['Sort order']||0));
  }

  function mqphCountertopAddonListAll() {
    const seen = new Map();
    mqphCountertopMaterials().forEach(m => getAddonOptions(m).forEach(a => { if (a && a.id && !seen.has(a.id)) seen.set(a.id, a); }));
    return [...seen.values()];
  }

  function mqphPopulateAddonMaterials(addonId) {
    const list = document.getElementById('mqph-addon-materials');
    if (!list) return;
    const materials = mqphCountertopMaterials();
    if (!materials.length) { list.innerHTML = '<div style="font-size:12px;color:#9ca3af">No countertop materials set up yet.</div>'; return; }
    list.innerHTML = materials.map(m => {
      const existing = getAddonOptions(m).find(a => a.id === addonId);
      const checked = existing ? 'checked' : '';
      const rateVal = existing ? existing.rate : '';
      return `<div style="display:flex;align-items:center;gap:8px">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#374151;cursor:pointer;flex:1">
          <input type="checkbox" data-mat-id="${m.id}" ${checked} onchange="document.getElementById('mqph-addon-rate-${m.id}').style.visibility=this.checked?'visible':'hidden'" style="width:auto;flex-shrink:0"/>
          <span>${m.fields['Name']||'—'}</span>
        </label>
        <div style="display:flex;align-items:center;gap:4px;visibility:${existing?'visible':'hidden'}" id="mqph-addon-ratewrap-${m.id}">
          <span style="font-size:12px;color:#6b7280">${CUR()}</span>
          <input type="number" id="mqph-addon-rate-${m.id}" value="${rateVal}" placeholder="0.00" step="0.01" style="width:70px;font-size:12px;padding:4px 6px;border:1px solid #d1d5db;border-radius:5px"/>
        </div>
      </div>`;
    }).join('');
  }

  window.mqphOpenAddonAdd = function() {
    currentAddonEditId = null;
    document.getElementById('mqph-addon-modal-title').textContent = 'New edge/addon';
    document.getElementById('mqph-addon-name').value = '';
    document.getElementById('mqph-addon-isedge').checked = false;
    document.getElementById('mqph-addon-pricing').value = 'flat';
    document.getElementById('mqph-addon-delete').style.display = 'none';
    mqphAddonToggleEdge(false);
    mqphPopulateAddonMaterials(null);
    document.getElementById('mqph-addon-modal-overlay').classList.add('show');
  };

  window.mqphOpenAddonEdit = function(addonId) {
    const existing = mqphCountertopAddonListAll().find(a => a.id === addonId);
    if (!existing) return;
    currentAddonEditId = addonId;
    document.getElementById('mqph-addon-modal-title').textContent = `Edit "${existing.label}"`;
    document.getElementById('mqph-addon-name').value = existing.label || '';
    document.getElementById('mqph-addon-isedge').checked = !!existing.isEdge;
    document.getElementById('mqph-addon-pricing').value = existing.pricingType || 'flat';
    document.getElementById('mqph-addon-delete').style.display = 'inline-block';
    mqphAddonToggleEdge(!!existing.isEdge);
    mqphPopulateAddonMaterials(addonId);
    document.getElementById('mqph-addon-modal-overlay').classList.add('show');
  };

  window.mqphCloseAddonModal = function() { document.getElementById('mqph-addon-modal-overlay')?.classList.remove('show'); };

  window.mqphSaveAddon = async function() {
    const name = document.getElementById('mqph-addon-name').value.trim();
    if (!name) { alert('Please enter a name.'); return; }
    const isEdge = document.getElementById('mqph-addon-isedge').checked;
    const pricingType = isEdge ? 'linft' : document.getElementById('mqph-addon-pricing').value;
    const id = currentAddonEditId || ('addon_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7));

    const materials = mqphCountertopMaterials();
    const checkedMatIds = new Set([...document.querySelectorAll('#mqph-addon-materials input[type=checkbox]:checked')].map(cb => cb.dataset.matId));

    const writes = [];
    materials.forEach(m => {
      const shouldBeIn = checkedMatIds.has(m.id);
      const current = getAddonOptions(m);
      const currentlyIn = current.some(a => a.id === id);
      let newList = null;
      if (shouldBeIn) {
        // Each material gets its own rate — a waterfall on granite doesn't
        // have to cost the same as a waterfall on laminate.
        const rate = parseFloat(document.getElementById(`mqph-addon-rate-${m.id}`)?.value) || 0;
        const addonObj = { id, label: name, isEdge, pricingType, rate };
        newList = currentlyIn ? current.map(a => a.id===id ? addonObj : a) : [...current, addonObj];
      } else if (currentlyIn) {
        newList = current.filter(a => a.id !== id);
      }
      if (newList) {
        m.fields['Addon options'] = JSON.stringify(newList);
        writes.push(atUpdate(LINE_ITEMS_TABLE, m.id, { 'Addon options': JSON.stringify(newList) }));
      }
    });

    try {
      await Promise.all(writes);
      mqphCloseAddonModal();
      await loadAndRender();
    } catch(e) {
      console.error('Failed to save addon', e);
      alert('Could not save — please try again.');
    }
  };

  window.mqphDeleteAddon = async function(addonId) {
    const id = addonId || currentAddonEditId;
    if (!id) return;
    if (!confirm('Delete this edge/addon? It will be removed from every countertop material using it.')) return;
    const materials = mqphCountertopMaterials().filter(m => getAddonOptions(m).some(a=>a.id===id));
    try {
      await Promise.all(materials.map(m => {
        const newList = getAddonOptions(m).filter(a=>a.id!==id);
        m.fields['Addon options'] = JSON.stringify(newList);
        return atUpdate(LINE_ITEMS_TABLE, m.id, { 'Addon options': JSON.stringify(newList) });
      }));
      mqphCloseAddonModal();
      await loadAndRender();
    } catch(e) {
      console.error('Failed to delete addon', e);
      alert('Could not delete — please try again.');
    }
  };

  // Checked state is tracked here rather than read straight from the DOM,
  // same reasoning as the product-group manager: searching filters door
  // names out of the DOM entirely, so a checked door that's been searched
  // away would otherwise be silently lost when saving.
  let _trimDoorChecked = new Set();
  let _trimDoorAllNames = [];
  let _trimDoorSearchText = '';

  function populateTrimDoorOptions(selectedDoorNames) {
    const doorItems = lineItems.filter(r=>r.fields&&r.fields['Category']==='door');
    _trimDoorAllNames = doorItems.map(d => d.fields['Name']||'').filter(Boolean);
    const selected = Array.isArray(selectedDoorNames) ? selectedDoorNames : (selectedDoorNames ? [selectedDoorNames] : []);
    _trimDoorChecked = new Set(selected);
    _trimDoorSearchText = '';
    const searchInput = document.getElementById('mqph-trim-door-search');
    if (searchInput) searchInput.value = '';
    mqphRenderTrimDoorList();
  }

  function mqphRenderTrimDoorList() {
    const list = document.getElementById('mqph-trim-door-link-list');
    if (!list) return;
    if (!_trimDoorAllNames.length) {
      list.innerHTML = '<div style="font-size:12px;color:#9ca3af">No door styles set up yet.</div>';
      return;
    }
    let names = [..._trimDoorAllNames];
    if (_trimDoorSearchText) names = names.filter(n => n.toLowerCase().includes(_trimDoorSearchText));
    if (!names.length) {
      list.innerHTML = `<div style="font-size:12px;color:#9ca3af">No door styles match "${_trimDoorSearchText}".</div>`;
      return;
    }
    list.innerHTML = names.map(name => {
      const checked = _trimDoorChecked.has(name) ? 'checked' : '';
      return `<label class="mqph-trim-door-row" style="display:flex !important;flex-direction:row !important;align-items:center !important;gap:8px !important;font-size:13px !important;font-weight:400 !important;text-transform:none !important;letter-spacing:normal !important;color:#374151 !important;cursor:pointer;padding:6px 4px;border-radius:6px"
        onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='transparent'">
        <input type="checkbox" onchange="mqphTrimDoorToggle('${name.replace(/'/g,"\\'")}')" ${checked} style="width:16px !important;height:16px !important;flex-shrink:0;margin:0 !important"/>
        <span style="flex:1">${name}</span>
      </label>`;
    }).join('');
  }

  window.mqphTrimDoorSearch = function(val) {
    _trimDoorSearchText = (val || '').toLowerCase();
    mqphRenderTrimDoorList();
  };

  window.mqphTrimDoorToggle = function(name) {
    if (_trimDoorChecked.has(name)) _trimDoorChecked.delete(name);
    else _trimDoorChecked.add(name);
  };

  window.mqphTrimDoorSelectAll = function(select) {
    // Scoped to whatever's currently visible under the active search — not
    // the full list — so searching "maple" then clicking Select all only
    // touches those maple results, leaving everything else as it was.
    let names = [..._trimDoorAllNames];
    if (_trimDoorSearchText) names = names.filter(n => n.toLowerCase().includes(_trimDoorSearchText));
    names.forEach(n => { if (select) _trimDoorChecked.add(n); else _trimDoorChecked.delete(n); });
    mqphRenderTrimDoorList();
  };

  window.mqphUpdateTrimTypeHint = function() {
    const type = document.getElementById('mqph-trim-type')?.value || 'crown';
    const label = type === 'valance' ? 'valance' : 'crown';
    document.querySelectorAll('#mqph-trim-type-label-for-hint, #mqph-trim-type-label-for-hint2').forEach(el => { el.textContent = label; });
  };

  window.mqphOpenTrimAdd = function() {
    currentTrimEditId = null;
    document.getElementById('mqph-trim-modal-title').textContent = 'Add crown / valance style';
    document.getElementById('mqph-trim-type').value = 'crown';
    document.getElementById('mqph-trim-name').value = '';
    document.getElementById('mqph-trim-supply-rate').value = '';
    document.getElementById('mqph-trim-install-rate').value = '';
    document.getElementById('mqph-trim-active').checked = true;
    // Every door checked by default — a brand new style shows for
    // everything until the shop deliberately narrows it down, rather than
    // silently showing for nothing until they think to check boxes.
    const allDoorNames = lineItems.filter(r=>r.fields&&r.fields['Category']==='door').map(d=>d.fields['Name']||'').filter(Boolean);
    populateTrimDoorOptions(allDoorNames);
    mqphUpdateTrimTypeHint();
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
    mqphUpdateTrimTypeHint();
    document.getElementById('mqph-trim-modal-overlay').classList.add('show');
  };

  window.mqphCloseTrimModal = function() { document.getElementById('mqph-trim-modal-overlay')?.classList.remove('show'); };

  window.mqphSaveTrimItem = async function() {
    const name = document.getElementById('mqph-trim-name').value.trim();
    if (!name) { alert('Please enter a name.'); return; }
    const trimType = document.getElementById('mqph-trim-type').value;
    if (!currentTrimEditId) {
      const dupe = lineItems.find(r => r.fields && r.fields['Category']==='trim' && (r.fields['Trim type']||'crown')===trimType && r.fields['Active']!==false && (r.fields['Name']||'').trim().toLowerCase()===name.toLowerCase());
      if (dupe && !confirm(`"${dupe.fields['Name']}" already exists in ${trimType==='valance'?'Valance':'Crown moulding'}. Adding another one with the same name can cause pricing mix-ups later.\n\nAdd it anyway?`)) return;
    }
    const linkedDoors = [..._trimDoorChecked];
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
    mqphRestoreExpandedCats();
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