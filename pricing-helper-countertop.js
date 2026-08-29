/*
 * MidasQuote Pricing Helper — Countertop Stores v1.0
 * Forked from the cabinet-shop "Pricing Helper v4.5" file.
 *
 * This build serves MidasQuote Countertop Stores only. The following
 * cabinet-shop pricing modals — and everything that existed solely to
 * support them (the full pricing wizard, the "Edit shop items" chip
 * setup screen, the mini reverse-engineering add-item wizard, and the
 * category-specific bulk price editor) — have been removed entirely:
 *   - Box Materials
 *   - Door Styles
 *   - Drawer Configurations
 *   - Door Hinges
 *   - Crown Moulding / Valance ("Trim")
 *   - Tall Cabinets
 *
 * Kept fully intact: the Countertop Materials modal (supply/install
 * rates, backsplash height options, cutout rates, edge profiles &
 * addons, bulk-add mode) and the generic "Other pricing" editor (used
 * for Travel zones / Tax / Installation & removal / Other — added and
 * edited through a plain add/edit modal, not a category-specific
 * wizard). Shared infrastructure — the CUR() currency helper, the
 * Airtable read/write helpers (typecast:true), the metric rate
 * calculator, and the modal/overlay/save/close plumbing — is unchanged.
 *
 * Note: no separate "Specialty Items" modal was found in the source
 * file this was forked from — comments here reference "the dashboard's
 * Specialty Items tab" as an external page, implying that feature lives
 * in dashboard.js, not in this file. Nothing was removed under that
 * name; if a Specialty Items modal does exist elsewhere in this file
 * for future reference, it was not present at fork time.
 */

(function() {

  const LINE_ITEMS_TABLE = 'tblCkJsJ2OC6DgXok';

  let shopRecord = null;
  let pricingRecord = null;
  let lineItems = [];
  let currentEditId = null;

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
  // Generic (non-countertop) pricing categories still supported through
  // the plain add/edit modal below. The cabinet-only categories this
  // build removed (material/door/drawer/hinge/trim/tall_cabinet) are
  // intentionally absent from this map.
  const CAT_LABELS = {
    install:'🔧 Installation & removal',
    zone:'🚗 Travel zones', tax:'🧾 Tax', other:'📋 Other',
  };

  // ============================================================
  // EDITOR
  // ============================================================
  function buildEditorHTML() {
    const visibleItems = lineItems.filter(r => r.fields);

    const groups = {};
    visibleItems.forEach(r => {
      const c = r.fields['Category'] || 'other';
      if (c === 'countertop') return; // handled by buildCTHtml()
      if (!groups[c]) groups[c] = [];
      groups[c].push(r);
    });

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;gap:1rem;flex-wrap:wrap">
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px">⚙️ Pricing</h2>
          <p style="font-size:13px;color:#6b7280">Your rates — changes apply to your widget immediately.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDeleteAll()">🗑️ Start fresh</button>
        </div>
      </div>

      ${['zone','install','other','tax'].filter(cat => groups[cat]).map(cat => [cat, groups[cat]]).concat(Object.entries(groups).filter(([cat]) => !['zone','install','other','tax'].includes(cat))).map(([cat,recs]) => `
        <div class="mqph-cat-block">
          <div class="mqph-cat-header" onclick="mqphToggleCategory('${cat}')" style="cursor:pointer">
            <span class="mqph-cat-title"><span id="mqph-cat-arrow-${cat}" style="display:inline-block;margin-right:6px;transition:transform 0.2s;font-size:12px">▶</span>${CAT_LABELS[cat]||cat} <span style="font-size:12px;font-weight:400;color:#9ca3af">(${recs.length})</span></span>
            <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenAdd('${cat}')">+ Add</button>
          </div>
          <div id="mqph-cat-body-${cat}" style="display:none">
          <div style="display:flex;align-items:center;gap:16px;padding:4px 12px 6px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #f3f4f6;user-select:none">
            <span style="cursor:pointer;flex:1" onclick="mqphSetSort('${cat}','name')">Name ${mqphSortArrow(cat,'name')}</span>
            <span style="cursor:pointer;min-width:80px;text-align:right" onclick="mqphSetSort('${cat}','price')">Price ${mqphSortArrow(cat,'price')}</span>
          </div>
          ${mqphSortRecs(cat, recs).map(r=>`
            <div class="mqph-row">
              <div style="flex:1;min-width:0">
                <div class="mqph-row-name">${r.fields['Name']||'—'}</div>
                ${r.fields['Description']?`<div class="mqph-row-desc">${r.fields['Description']}</div>`:''}
              </div>
              <div class="mqph-row-rate">${(r.fields['Category']==='zone'||r.fields['Unit']==='km'||r.fields['Unit']==='%') ? (r.fields['Rate']||0).toLocaleString() : CUR() +(r.fields['Rate']||0).toLocaleString()}</div>
              <div class="mqph-row-unit">${r.fields['Unit']||''}</div>
              <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active']?'on':''}" onclick="mqphToggle('${r.id}',this)"></div></div>
              <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenEdit('${r.id}')">Edit</button>
              <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDelete('${r.id}')">Delete</button>
            </div>`).join('')}
          </div>
        </div>`).join('')}

      ${buildCTHtml()}

      <!-- Raw edit modal (Travel zones / Tax / Installation / Other) -->
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
                <option>per lin ft</option><option>flat</option><option>each</option><option>%</option><option>km</option>
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

  window.mqphOpenAdd = function(cat) {
    currentEditId = null;
    document.getElementById('mqph-modal-title').textContent = 'Add item';
    document.getElementById('mqph-item-name').value = '';
    document.getElementById('mqph-item-cat').value = cat || 'other';
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
    document.getElementById('mqph-item-cat').value   = rec.fields['Category']||'other';
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
      await atDelete(LINE_ITEMS_TABLE,id); await loadAndRender();
    } catch(e) { alert('Error deleting.'); }
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
  // customer's inflated pricing: re-adding an item (via the "+ Add" flow)
  // that already exists silently creates a second, independent record
  // instead of catching the mistake. Comparison is case-insensitive and
  // only checks active items — an intentionally-deactivated old item
  // shouldn't block a legitimate re-add of the same name.
  // (In the full cabinet-shop build this also stripped a "— uppers/bases"
  // or "— some/mostly drawers" suffix per category before comparing; those
  // categories don't exist in the countertop build, so it's just a trim now.)
  function mqphBaseNameFor(category, name) {
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
      const minSupply = r.fields['Minimum price']||0;
      const minInstall = r.fields['Install minimum price']||0;
      const minSummary = (minSupply>0 || minInstall>0)
        ? `📏 Min: ${minSupply>0?`${CUR()}${minSupply.toLocaleString()} supply`:''}${(minSupply>0&&minInstall>0)?' + ':''}${minInstall>0?`${CUR()}${minInstall.toLocaleString()} install`:''} per counter`
        : null;
      return `
        <div class="mqph-row">
          <div style="flex:1;min-width:0">
            <div class="mqph-row-name">${r.fields['Name']||'—'}</div>
            <div class="mqph-row-desc">🧱 ${bsSummary}${cutoutSummary ? ` &nbsp;·&nbsp; ✂️ ${cutoutSummary}` : ''}${minSummary ? ` &nbsp;·&nbsp; ${minSummary}` : ''}</div>
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
          Each material now carries its own backsplash height options and cutout pricing — no more separate backsplash/cutout items to keep in sync. Add a material below, then set its backsplash heights and cutout rates right inside it. Each material also has its own optional minimum charge per counter (separately for supply and install) — set one when a small counter still means ordering a full sheet.
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
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb">
                <span style="font-size:12px;color:#6b7280;white-space:nowrap" title="A small counter can still mean ordering a full sheet of material — this floor makes sure supply cost never goes below what you set here, no matter how small the sq ft/lin ft math comes out. Leave at 0 for no minimum. Applies per counter/surface, not to the whole quote.">Minimum charge per counter ⓘ</span>
                <span style="font-size:13px;color:#6b7280">${CUR()}</span>
                <input type="number" id="mqph-ct-supply-min" placeholder="0.00" step="0.01" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
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
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb">
                <span style="font-size:12px;color:#6b7280;white-space:nowrap" title="Same idea as the supply minimum, but for install labor — a small counter can still take as long to template and install as a bigger one. Leave at 0 for no minimum.">Minimum charge per counter ⓘ</span>
                <span style="font-size:13px;color:#6b7280">${CUR()}</span>
                <input type="number" id="mqph-ct-install-min" placeholder="0.00" step="0.01" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
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
    document.getElementById('mqph-ct-supply-min').value = '';
    document.getElementById('mqph-ct-install-rate').value = '';
    document.getElementById('mqph-ct-install-unit').value = 'sqft';
    document.getElementById('mqph-ct-install-min').value = '';
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
    document.getElementById('mqph-ct-supply-min').value = rec.fields['Minimum price']||'';
    document.getElementById('mqph-ct-install-rate').value = matInstall||'';
    document.getElementById('mqph-ct-install-unit').value = matInstallUnit;
    document.getElementById('mqph-ct-install-min').value = rec.fields['Install minimum price']||'';
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
        supplyMin: parseFloat(document.getElementById('mqph-ct-supply-min').value||0),
        installRate: parseFloat(document.getElementById('mqph-ct-install-rate').value||0),
        installMin: parseFloat(document.getElementById('mqph-ct-install-min').value||0),
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
      'Minimum price':parseFloat(document.getElementById('mqph-ct-supply-min').value||0),
      'Install rate':parseFloat(document.getElementById('mqph-ct-install-rate').value||0),
      'Install minimum price':parseFloat(document.getElementById('mqph-ct-install-min').value||0),
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
        Rate: ctBulk.supplyRate, 'Minimum price': ctBulk.supplyMin,
        'Install rate': ctBulk.installRate, 'Install minimum price': ctBulk.installMin, Unit: ctBulk.unit,
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
      _token:    'patBtaoCbxqqQzRId.4342548ea07fbac4e5998244a4eaa09db09e9ab6494efb175664bd1f9e0462b3',
      _pricingTable: 'tblu6AYZs8h7SIaQl',
    };
    pricingRecord = passedPricingRecord;
    injectStyles();
    loadAndRender();
  };

})();