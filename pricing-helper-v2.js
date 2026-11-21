/*
 * MidasQuote Pricing Helper v4.5
 * - Full wipe+rewrite on wizard finish (no duplicates)
 * - Mini reverse-engineering wizard for adding individual items (no raw rate entry)
 * - Clean, consistent UI throughout
 */

(function() {

  const LINE_ITEMS_TABLE = 'tblCkJsJ2OC6DgXok';
  // Same Shops table dashboard.js's own CONFIG.SHOPS_TABLE points at — this
  // file runs as its own separate script/closure (see mqph2Init below) and
  // has no access to dashboard.js's CONFIG object, so it needs its own
  // copy of the table id to save shop-wide settings like Island panel
  // pricing directly to the Shop record, the same way LINE_ITEMS_TABLE
  // above is its own separate copy rather than a shared reference.
  const SHOPS_TABLE = 'tbl8PoF2Mu3sAdlMs';

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

  // Data access goes through dashboard.js's secure functions (window.mqDashApi,
  // Oct 2026) — the Worker checks the logged-in member and limits every call to
  // their own shop. No Airtable token lives in this file anymore.
  function mqphApi() {
    if (!window.mqDashApi) throw new Error('MidasQuote dashboard not loaded — pricing data is unavailable.');
    return window.mqDashApi;
  }

  // A UK (or any non-North-American) shop can pick their own currency
  // symbol on the dashboard's Shop Info tab — everywhere in the pricing
  // wizard that used to show a hardcoded "$" now reads it from here
  // instead, falling back to "$" for shops that haven't set one.
  // shopRecord is populated by mqph2Init() (passed in from dashboard.js's
  // already-loaded shop record) before loadAndRender() ever runs.
  function CUR() { return (shopRecord && shopRecord.fields && shopRecord.fields['Currency symbol']) || '$'; }

  // Same fix as dashboard.js's atGet (2026-09-12) — Airtable returns up to
  // 100 records per request, signalling more via an `offset` you pass back
  // in for the next page. This used to take one page (and, since
  // maxRecords=200 here was never actually reachable without following
  // that offset, was really no different from a 100-record cap in
  // practice) and stop, which would have silently capped a shop's Line
  // Items once their catalog — doors, materials, hinges, drawer configs,
  // countertops — grew past 100 rows. Jordan advertises unlimited items,
  // so this needs to have no ceiling.
  //
  // First same-day attempt at this fix added the offset-following loop
  // below but kept a `maxRecords` request param (200, changed from the
  // original) — a DIFFERENT parameter from `pageSize`. `pageSize` caps
  // records per page (max 100); `maxRecords` caps the TOTAL records
  // returned across every page combined. With any `maxRecords` set,
  // Airtable stops including `offset` once it hits that total, so the loop
  // below still exited after hitting the cap regardless of its value —
  // reproducing the same ceiling despite the "fix." Corrected same day to
  // `pageSize=100` with no `maxRecords` at all, so there's no overall cap
  // and the loop actually reaches every page. The 50-page (5,000 record)
  // backstop is just against a runaway loop, not a real limit any shop's
  // Line Items table would ever approach.
  async function atGet(table, formula) { return mqphApi().atGet(table, formula); }
  async function atCreate(table, fields) { return mqphApi().atCreate(table, fields); }
  async function atUpdate(table, id, fields) { return mqphApi().atUpdate(table, id, fields); }
  async function atDelete(table, id) { return mqphApi().atDelete(table, id); }


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
      .mqph-btn-saved{background:#16a34a !important;color:#fff !important}.mqph-btn-saved:hover{opacity:0.88 !important}
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
      /* Island panel pricing section (Jordan 2026-10-04): tighter spacing, and the price boxes sit beside their labels at a sensible width instead of stretching full width */
      #mqph-scope-islandpanel .mqph-field{margin-bottom:0.6rem !important;gap:4px !important}
      #mqph-scope-islandpanel .mqph-field.mqph-field-inline{flex-direction:row !important;align-items:center !important;justify-content:space-between !important;gap:6px 16px !important;flex-wrap:wrap !important}
      #mqph-scope-islandpanel .mqph-field.mqph-field-inline label{flex:1 1 260px !important;line-height:1.4 !important}
      #mqph-scope-islandpanel .mqph-field.mqph-field-inline input{flex:0 0 130px !important;width:130px !important}
      .mqph-info-h{font-size:11px !important;font-weight:800 !important;letter-spacing:0.06em !important;text-transform:uppercase !important;color:#1d4ed8 !important;margin:0 0 6px !important}
      .mqph-info-sec{padding:16px 0 14px !important;border-top:1px solid #bfdbfe !important}
      .mqph-info-sec:first-child{border-top:none !important;padding-top:4px !important}
      .mqph-info-sec:last-child{padding-bottom:2px !important}
      .mqph-info-sec p{margin:0 0 8px !important;line-height:1.55 !important}
      .mqph-info-sec p:last-child{margin-bottom:0 !important}
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

       /* MidasQuote Premium v4 — visual refinements only; no pricing logic or field changes. */
       #mq-pricing-helper-v2{max-width:1180px !important;width:100% !important;margin:0 auto !important;padding:8px 0 40px !important;color:#0f172a !important}
       #mq-pricing-helper-v2 .mqph-cat-block,#mq-pricing-helper-v2 .mqph-setup-card,#mq-pricing-helper-v2 .mqph-ct-block{background:#fff !important;border:1px solid #e5ebf3 !important;border-radius:8px !important;box-shadow:0 12px 30px rgba(15,23,42,.045) !important;margin-bottom:14px !important;overflow:hidden !important}
       #mq-pricing-helper-v2 .mqph-cat-header,#mq-pricing-helper-v2 .mqph-setup-header{background:linear-gradient(180deg,#ffffff,#f9fafc) !important;border-bottom:1px solid #eaf0f6 !important;padding:19px 22px !important;min-height:68px !important;gap:12px !important}
       #mq-pricing-helper-v2 .mqph-cat-header:hover{background:linear-gradient(180deg,#fffdf8,#fff6e2) !important}
       #mq-pricing-helper-v2 .mqph-cat-title{font-size:14px !important;font-weight:800 !important;letter-spacing:0.015em !important;color:#152134 !important;text-transform:none !important;line-height:1.45 !important}
       #mq-pricing-helper-v2 .mqph-setup-title{font-size:15px !important;font-weight:800 !important;letter-spacing:-.01em !important;color:#172033 !important}
       #mq-pricing-helper-v2 .mqph-setup-sub{font-size:12px !important;line-height:1.55 !important;color:#64748b !important;max-width:850px !important}
       #mq-pricing-helper-v2 .mqph-chip-row{padding:20px 22px !important;gap:9px !important}
       #mq-pricing-helper-v2 .mqph-chip{background:#f8fafc !important;border:1px solid #e2e8f0 !important;color:#26364b !important;border-radius:8px !important;padding:9px 12px !important;box-shadow:0 2px 6px rgba(15,23,42,.025) !important}
       #mq-pricing-helper-v2 .mqph-chip-input{border:1px dashed #cbd5e1 !important;border-radius:8px !important;background:#fff !important}
       #mq-pricing-helper-v2 .mqph-chip-input button{border-radius:8px !important;background:#181b22 !important;padding:7px 12px !important}
       #mq-pricing-helper-v2 .mqph-row{padding:14px 20px !important;gap:12px !important;border-bottom:1px solid #edf2f6 !important;min-height:62px !important}
       #mq-pricing-helper-v2 .mqph-row:hover{background:#f9fafb !important}
       #mq-pricing-helper-v2 .mqph-row-name{font-weight:700 !important;color:#172033 !important}
       #mq-pricing-helper-v2 .mqph-row-desc{font-size:12px !important;color:#64748b !important;line-height:1.5 !important}
       #mq-pricing-helper-v2 .mqph-row-rate{font-size:14px !important;font-weight:800 !important;color:#172033 !important}
       #mq-pricing-helper-v2 .mqph-row-unit{color:#64748b !important}
       #mq-pricing-helper-v2 .mqph-btn{border-radius:11px !important;padding:10px 17px !important;font-weight:750 !important;letter-spacing:0 !important;box-shadow:0 1px 3px rgba(15,23,42,.045) !important}
       #mq-pricing-helper-v2 .mqph-btn-primary{background:linear-gradient(180deg,#1c2029,#11141a) !important;box-shadow:0 9px 22px rgba(15,23,42,.14) !important}
       #mq-pricing-helper-v2 .mqph-btn-secondary{background:#fff !important;border:1px solid #dbe3ed !important;color:#253246 !important}
       #mq-pricing-helper-v2 .mqph-btn-secondary:hover{background:#f8fafc !important}
       #mq-pricing-helper-v2 .mqph-btn-danger{border:1px solid #fecaca !important;color:#b91c1c !important;background:#fff !important;box-shadow:none !important}
       #mq-pricing-helper-v2 .mqph-btn-sm{padding:7px 12px !important;font-size:12px !important}
       #mq-pricing-helper-v2 .mqph-wizard-card{border:1px solid #e4eaf2 !important;border-radius:24px !important;box-shadow:0 18px 42px rgba(15,23,42,.08) !important;max-width:980px !important;margin:0 auto 24px !important}
       #mq-pricing-helper-v2 .mqph-wizard-header{background:linear-gradient(120deg,#151922,#232633) !important;padding:25px 30px !important}
       #mq-pricing-helper-v2 .mqph-wizard-header h2{font-size:21px !important;font-weight:800 !important;letter-spacing:-.02em !important}
       #mq-pricing-helper-v2 .mqph-progress .dot.done{background:#f4cb62 !important}
       #mq-pricing-helper-v2 .mqph-progress .dot.active{background:#fff0bd !important}
       #mq-pricing-helper-v2 .mqph-wizard-body{padding:27px 30px !important}
       #mq-pricing-helper-v2 .mqph-wizard-nav{padding:20px 30px !important;background:#f8fafc !important;border-color:#e8edf4 !important}
       #mq-pricing-helper-v2 .mqph-step-title{font-size:21px !important;font-weight:800 !important;letter-spacing:-.02em !important}
       #mq-pricing-helper-v2 .mqph-step-sub{font-size:14px !important;color:#64748b !important}
       #mq-pricing-helper-v2 .mqph-modal{border:1px solid #e2e8f0 !important;border-radius:22px !important;box-shadow:0 28px 80px rgba(15,23,42,.25) !important}
       #mq-pricing-helper-v2 .mqph-modal-hdr{padding:22px 24px !important;background:#fcfdff !important;border-color:#e9eef5 !important}
       #mq-pricing-helper-v2 .mqph-modal-body{padding:24px !important}
       #mq-pricing-helper-v2 .mqph-modal-footer{padding:18px 24px !important;background:#f8fafc !important}
       #mq-pricing-helper-v2 .mqph-field input,#mq-pricing-helper-v2 .mqph-field select,#mq-pricing-helper-v2 .mqph-field textarea{border-radius:12px !important;border:1px solid #d8e0e9 !important;padding:10px 12px !important}
       #mq-pricing-helper-v2 .mqph-field input:focus,#mq-pricing-helper-v2 .mqph-field select:focus,#mq-pricing-helper-v2 .mqph-input-row input:focus{border-color:#cda84b !important;box-shadow:0 0 0 4px rgba(212,175,55,.12) !important}
       #mq-pricing-helper-v2 .mqph-ct-row{padding:15px 20px !important;border-color:#edf2f6 !important}
       #mq-pricing-helper-v2 .mqph-ct-block{max-width:none !important;width:100% !important}
       #mq-pricing-helper-v2 .mqph-info,#mq-pricing-helper-v2 .mqph-warn,#mq-pricing-helper-v2 .mqph-hl,#mq-pricing-helper-v2 .mqph-spec-box{border-radius:14px !important;line-height:1.7 !important}
       @media(max-width:700px){#mq-pricing-helper-v2{padding:6px 0 26px !important}#mq-pricing-helper-v2 .mqph-cat-header,#mq-pricing-helper-v2 .mqph-setup-header{padding:15px 16px !important}#mq-pricing-helper-v2 .mqph-row{padding:13px 15px !important}#mq-pricing-helper-v2 .mqph-wizard-header,#mq-pricing-helper-v2 .mqph-wizard-body,#mq-pricing-helper-v2 .mqph-wizard-nav{padding:18px !important}#mq-pricing-helper-v2 .mqph-modal{border-radius:0 !important}}
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

  // Which Unit values a shop can pick from for a given (pre-existing)
  // category — a closed dropdown in the raw Add/Edit item modal, never a
  // free-text field, per Jordan's explicit call 2026-09-10 ("no typing in
  // anywhere please" — a shop owner should only ever be choosing from a
  // fixed list, same as before, just with "mi" now offered alongside "km"
  // for travel zones since that one's just a display label either way —
  // see mqphOnItemCatChange / mqphPopulateUnitOptions below).
  const CAT_UNIT_OPTIONS = {
    material: ['per lin ft — uppers','per lin ft — bases'],
    door:     ['per lin ft upcharge'],
    hinge:    ['per lin ft upcharge'],
    drawer:   ['per lin ft upcharge'],
    install:  ['per lin ft','flat','each'],
    zone:     ['km','mi'],
    trim:     ['per lin ft','flat'],
    tax:      ['%'],
    other:    ['per lin ft','flat','each','%','km','mi'],
  };
  const ALL_UNIT_OPTIONS = ['per lin ft','per lin ft — uppers','per lin ft — bases','per lin ft upcharge','flat','each','%','km','mi'];

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
  //
  // "Baseline" used to be purely inferred — whichever record in a category
  // happened to have the lowest Sort order. That broke the moment a shop
  // single-added enough new materials/doors/hinges (the "+ Add" / "+Add
  // batch" features number a new row by counting existing rows in that
  // category, with no idea what number the original Pricing Setup Wizard
  // used) — a later addition could easily land on a lower Sort order than
  // the shop's real baseline and silently steal its spot, which is exactly
  // what happened on Muskoka Cabinets' shop (2026-09-09): a single-added
  // hinge, and then Plywood, both out-sorted the real baseline and got
  // quoted against for new door styles instead of it.
  //
  // Fixed by pinning baseline explicitly via the "Is baseline" checkbox
  // (set on the wizard's baseline rows when the wizard runs — see
  // mqphFinishWizard — and backfilled for existing shops by
  // migrateBaselinePins()), so it no longer depends on numbering staying
  // consistent between two different features. Sort order is kept only as
  // a fallback for a shop that hasn't been migrated yet / never ran the
  // wizard, so this can't change anything for a shop that was never
  // affected by the bug above.
  function getBaselineRates() {
    const materials = getByCategory('material');
    const doors     = getByCategory('door');
    const hinges    = getByCategory('hinge');

    // Baseline material = whichever material is pinned via "Is baseline",
    // else fall back to the lowest Sort order (old behavior).
    const pinnedMat = materials.find(r => r.fields['Is baseline']);
    const blMatName = (pinnedMat || materials[0])?.fields['Name']?.replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim() || '';

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

    // Baseline door = pinned door, else first door style (Sort order)
    const blDoor     = doors.find(r => r.fields['Is baseline']) || doors[0];
    const blDoorRate = blDoor?.fields['Rate'] || 0;
    const blDoorName = blDoor?.fields['Name'] || '';

    // Baseline hinge = pinned hinge, else first hinge (Sort order)
    const blHinge     = hinges.find(r => r.fields['Is baseline']) || hinges[0];
    const blHingeName = blHinge?.fields['Name'] || '';

    return { blMatName, blUpperRate, blBaseRate, blUpperPrice:blUpperRate*4, blBasePrice:blBaseRate*4, blDoorName, blDoorRate, blHingeName };
  }

  // ============================================================
  // PASSIVE BASELINE DRIFT WATCH — material & door only
  // ============================================================
  // Per Jordan 2026-09-12: "baseline means base as in lowest so cheapest
  // so cheapest should be baseline" — the wizard already tells shop owners
  // to pick their cheapest material/door as baseline when setting up, but
  // nothing enforced that afterward. This watches for it drifting out of
  // sync on its own (a shop owner edits some OTHER item's price down below
  // the current baseline, with no delete involved) and quietly self-heals:
  // re-pins whichever one is now actually cheapest, and returns a one-line
  // notice for buildEditorHTML() to show once. Runs at the end of every
  // loadAndRender() — cheap to compute (a sort over data already in memory)
  // and self-stabilizing (once re-pinned, the next run sees they already
  // match and does nothing), so there's no risk of it looping or spamming.
  //
  // Hinge is deliberately NOT watched here — its baseline is defined as
  // exactly $0 (folded into the door price, see getBaselineRates() above),
  // which is already the lowest a real, non-negative Rate can be. It can
  // only stop being "cheapest" by being deleted outright, which is the
  // ACTIVE flow (mqphOpenBaselineDeleteFlow below), not passive drift.
  async function mqphCheckBaselineDrift() {
    const notices = [];

    // --- Material: cheapest by BASES rate (same number every upcharge
    // formula elsewhere in this file already anchors off — see
    // getBaselineRates()'s blBasePrice). Only pairs with BOTH an uppers
    // and a bases row are eligible, same requirement Bulk Edit already
    // enforces — a material missing one half is a data problem to fix by
    // hand, not something this should guess at or silently promote.
    const matsByBase = {};
    lineItems.forEach(r => {
      if (!r.fields || r.fields['Category'] !== 'material' || r.fields['Active'] === false) return;
      const baseName = (r.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i, '').trim();
      if (!baseName) return;
      if (!matsByBase[baseName]) matsByBase[baseName] = { baseName, upperRec:null, baseRec:null };
      if (/—\s*uppers\s*$/i.test(r.fields['Name']||'')) matsByBase[baseName].upperRec = r; else matsByBase[baseName].baseRec = r;
    });
    const matPairs = Object.values(matsByBase).filter(p => p.upperRec && p.baseRec);
    if (matPairs.length > 1) {
      const currentBL = matPairs.find(p => p.baseRec.fields['Is baseline'] || p.upperRec.fields['Is baseline']);
      const cheapest = matPairs.reduce((min, p) => (p.baseRec.fields['Rate']||0) < (min.baseRec.fields['Rate']||0) ? p : min, matPairs[0]);
      if (currentBL && cheapest.baseName !== currentBL.baseName && (cheapest.baseRec.fields['Rate']||0) < (currentBL.baseRec.fields['Rate']||0)) {
        try {
          await atUpdate(LINE_ITEMS_TABLE, currentBL.upperRec.id, { 'Is baseline': false });
          await atUpdate(LINE_ITEMS_TABLE, currentBL.baseRec.id, { 'Is baseline': false });
          await atUpdate(LINE_ITEMS_TABLE, cheapest.upperRec.id, { 'Is baseline': true });
          await atUpdate(LINE_ITEMS_TABLE, cheapest.baseRec.id, { 'Is baseline': true });
          notices.push(`⭐ <strong>${cheapest.baseName}</strong> is now your cheapest box material, so it's now your baseline (was <strong>${currentBL.baseName}</strong>).`);
        } catch(e) { console.error('Failed to auto-update baseline material', e); }
      }
    }

    // --- Door: cheapest by Rate directly (every door's Rate is already an
    // absolute upcharge over the baseline box, independent of which door
    // is pinned — see getBaselineRates() above — so comparing Rate values
    // straight across doors is a valid, apples-to-apples comparison).
    const doors = lineItems.filter(r => r.fields && r.fields['Category'] === 'door' && r.fields['Active'] !== false);
    if (doors.length > 1) {
      const currentBL = doors.find(r => r.fields['Is baseline']);
      const cheapest = doors.reduce((min, r) => (r.fields['Rate']||0) < (min.fields['Rate']||0) ? r : min, doors[0]);
      if (currentBL && cheapest.id !== currentBL.id && (cheapest.fields['Rate']||0) < (currentBL.fields['Rate']||0)) {
        try {
          await atUpdate(LINE_ITEMS_TABLE, currentBL.id, { 'Is baseline': false });
          await atUpdate(LINE_ITEMS_TABLE, cheapest.id, { 'Is baseline': true });
          notices.push(`⭐ <strong>${cheapest.fields['Name']}</strong> is now your cheapest door style, so it's now your baseline (was <strong>${currentBL.fields['Name']}</strong>).`);
        } catch(e) { console.error('Failed to auto-update baseline door', e); }
      }
    }

    // Re-fetch so the render right after this reflects the re-pin instead
    // of the stale in-memory copy — cheap, and only happens on the rare
    // render where drift was actually found.
    if (notices.length) {
      const recs = await atGet(LINE_ITEMS_TABLE, `FIND("${shopRecord._shopToken}", ARRAYJOIN({Shop token (lookup)}))`);
      lineItems = recs.filter(r => r.fields);
    }
    return notices;
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
    // Used by the "Local delivery zone" card below — km/mi is just a display
    // label here (see CAT_UNIT_OPTIONS comment), so a shop can pick either
    // at setup time instead of only discovering the Edit-to-switch trick
    // later on the Pricing page. Defaults to 'km' for anyone who doesn't
    // touch it, matching the original hardcoded behavior.
    const existingZoneItem = (existing['zone']||[]).find(r=>r.fields['Name']?.toLowerCase().includes('local'));

    return `
      <div style="margin-bottom:1.5rem">
        <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:6px">🛠️ Set up your shop items</h2>
        <p style="font-size:13px;color:#6b7280;line-height:1.6">Start with the materials, door styles, and drawer configs you sell most — your everyday go-tos, not the rare special orders. A focused list gives customers a better experience and makes your widget feel clean and professional.</p>
      </div>

      <!-- Added per Jordan: the wizard used to offer a "Skip — same price for
           all materials/door styles" button on its Additional
           materials/Additional door styles steps, which sounded like it would
           carry the baseline price over to the rest of the group -- it
           actually just left them with NO price recorded at all. That button
           is gone now (see buildWizardSteps' Step 4/Step 6 skipLabel removal
           below); this tip heads the confusion off before it starts, by
           steering same-priced items away from the wizard's one-quote-per-
           item flow in the first place. -->
      <div class="mqph-warn">💡 <strong>If you have multiple items offered at the same price, just add ONE of them here — add the rest later in regular pricing.</strong> It's much faster to add multiple items of the same price after the wizard than to quote each one individually here.</div>

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
          <input type="number" id="mqph-local-radius" value="${existingZoneItem?.fields['Rate'] || 15}" style="width:90px;text-align:right;font-family:inherit;font-size:14px;font-weight:600;color:#111;background:#fff;border:1.5px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
          <select id="mqph-local-radius-unit" style="font-size:13px;font-family:inherit;color:#374151;font-weight:500;border:1.5px solid #d1d5db;border-radius:8px;padding:7px 8px;background:#fff">
            <option value="km" ${(existingZoneItem?.fields['Unit']||'km')==='km'?'selected':''}>km</option>
            <option value="mi" ${existingZoneItem?.fields['Unit']==='mi'?'selected':''}>mi</option>
          </select>
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
        <div class="mqph-warn">⚠️ <strong>Running the wizard replaces all existing pricing.</strong> Specialty items, countertop rates, tall cabinet rates, and crown/valance rates are not affected.</div>
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
            `<strong>Upper cabinets — box only, no doors, with shelves</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} upper</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} upper</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `<strong>No doors · With shelves · No hardware · Supply only</strong>`,
          ])}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-bl-u-price" placeholder="0.00" oninput="mqphCalc('bl-u')"/></div>
          <div id="mqph-r-bl-u" class="mqph-result"></div>`;
      },
      nextLabel:'Next →',
      onNext:() => {
        const p = parseFloat(document.getElementById('mqph-bl-u-price')?.value||0);
        if (p>0&&wizardBaseline) {
          wizardBaseline.upperPrice=p; wizardBaseline.upperRate=p/4;
          wizardItems.push({ name:wizardBaseline.matName+' — uppers', category:'material', rate:Math.round(wizardBaseline.upperRate*100)/100, unit:'per lin ft — uppers', description:'Baseline box rate uppers', active:true, isBaseline:true });
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
            `<strong>Base cabinets — box only, no doors, no drawers, with 2 shelves</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${matName}</span>`,
            `<strong>No doors · No drawers · With 2 shelves · Supply only · Include toe kick</strong>`,
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
          wizardItems.push({ name:wizardBaseline.matName+' — bases', category:'material', rate:Math.round(wizardBaseline.baseRate*100)/100, unit:'per lin ft — bases', description:'Baseline box rate bases', active:true, isBaseline:true });
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
                `Material: <span class="mqph-spec-tag">${m.fields['Name']}</span> · No doors · No drawers · With 2 shelves · Supply only · Include toe kick`,
              ])}
              <div class="mqph-input-row"><label>Your price?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-mat-${idx}" placeholder="0.00" oninput="mqphCalcMatUp(${idx})"/></div>
              <div id="mqph-r-mat-${idx}" class="mqph-result"></div>
            </div>`).join('');
        },
        // No "Skip — same price for all materials" button anymore (Jordan:
        // "lets remove that button that says 'Skip, all items have the same
        // price'... i think its confusing"). It sounded like it would carry
        // the baseline price over to these materials, but it actually left
        // them with NO price recorded at all -- clicking "Next →" with the
        // price fields left blank does the exact same thing (onNext only
        // pushes a wizardItems entry for a material whose price is > 0), so
        // nothing is lost, just the misleading shortcut. The item-setup
        // screen's new tip (see buildItemSetupHTML) heads this off earlier
        // by steering same-priced items away from this step in the first
        // place — add one here, add the rest later in regular pricing.
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
            `Hinges: <span class="mqph-spec-tag">${hingeName}</span> · No drawers · Supply only · Include toe kick`,
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
          wizardItems.push({ name:wizardBaseline.doorName, category:'door', rate:Math.round(u*100)/100, unit:'per lin ft upcharge', description:'Baseline door style', active:true, isBaseline:true });
          if (wizardBaseline.hingeName) {
            wizardItems.push({ name:wizardBaseline.hingeName, category:'hinge', rate:0, unit:'per lin ft upcharge', description:'Baseline hinge — included in door price', active:true, isBaseline:true });
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
                `<span class="mqph-spec-tag">3 doors: 2 on 30" ${mqphMmTag(30)}, 1 on 18" ${mqphMmTag(18)}</span> · Hinges: <span class="mqph-spec-tag">${hingeName}</span> · No drawers · Supply only · Include toe kick`,
              ])}
              <div class="mqph-input-row"><label>Your price?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-door-${idx}" placeholder="0.00" oninput="mqphCalcDoorUp(${idx})"/></div>
              <div id="mqph-r-door-${idx}" class="mqph-result"></div>
            </div>`).join('');
        },
        // Same reasoning as Step 4's removed "Skip — same price for all
        // materials" button just above -- see that comment. "Next →" with
        // blank price fields is the identical no-op skip, minus the
        // misleading "same price" wording.
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
                `Hinges: <span class="mqph-spec-tag">${h.fields['Name']}</span> (instead of ${blHingeName}) · No drawers · Supply only · Include toe kick`,
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
                  `<strong>1 top drawer per cabinet · Include slides/guides · No doors · No drawer fronts · Supply only · Include toe kick</strong>`,
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
                  `<strong>Full drawer bank (3 per cabinet) · Include slides/guides · No doors · No drawer fronts · Supply only · Include toe kick</strong>`,
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
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">🔼 Upper cabinets — install only</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:0.75rem">Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} upper</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} upper</span> = 4 lin ft ${mqphMmTag(48)}</div>
            <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) uppers, <strong>box only</strong> (no doors)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-u-nd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
            <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) uppers, <strong>with doors</strong> (hang, adjust and install handles)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-u-wd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
          </div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">🔽 Base cabinets — install only</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:0.75rem">Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)} · Include toe kick install</div>
            <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) bases, <strong>box only</strong> (no doors, include toe kick)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-b-nd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
            <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) bases, <strong>with doors</strong> (hang, adjust and install handles, include toe kick)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-b-wd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
          </div>
          <div id="mqph-r-install" class="mqph-result"></div>
          <div style="height:1px;background:#e5e7eb;margin:1.25rem 0"></div>
          <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">🗑️ Cabinet removal & disposal</div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:0.75rem">Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)} · Include toe kick install</div>
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
        const existingZoneRec = getByCategory('zone').find(z=>z.fields['Name']?.toLowerCase().includes('local'));
        const existingRadius = existingZoneRec?.fields['Rate'] || 15;
        const existingUnit = existingZoneRec?.fields['Unit'] || 'km';
        return `
          <div class="mqph-info">
            Jobs within your local radius are quoted at no extra travel charge — any delivery cost should already be built into your regular pricing. Jobs outside this area will include a note on the quote that travel charges may apply.
          </div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem">
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">📍 Local delivery radius</div>
            <div class="mqph-input-row"><label>No extra travel charge within this distance</label><input type="number" id="mqph-zone-r" value="${existingRadius}" style="width:130px;text-align:right"/><select id="mqph-zone-r-unit" style="font-size:14px;font-family:inherit;color:#374151;border:1px solid #d1d5db;border-radius:6px;padding:6px 8px"><option value="km" ${existingUnit==='km'?'selected':''}>km</option><option value="mi" ${existingUnit==='mi'?'selected':''}>mi</option></select></div>
          </div>`;
      },
      skipLabel:'Skip',
      nextLabel:'Finish setup →',
      onNext:() => {
        const gn=id=>parseFloat(document.getElementById(id)?.value||0);
        const zr=gn('mqph-zone-r');
        const zUnit = document.getElementById('mqph-zone-r-unit')?.value || 'km';
        if(zr>0) {
          const existing = lineItems.find(r=>r.fields&&r.fields['Category']==='zone'&&r.fields['Name']?.toLowerCase().includes('local'));
          if(existing) {
            atUpdate(LINE_ITEMS_TABLE, existing.id, {Rate:zr, Unit:zUnit});
            existing.fields['Rate'] = zr;
            existing.fields['Unit'] = zUnit;
          } else {
            atCreate(LINE_ITEMS_TABLE, {shop:[shopRecord._recordId],Name:'Local zone radius',Category:'zone',Rate:zr,Unit:zUnit,Description:'Within this distance = no travel surcharge',Active:true,'Sort order':0})
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

  // Install/removal requote flow — Jordan 2026-09-11: deleting ANY single
  // install/removal rate now cascade-deletes the whole category (see
  // mqphDelete below), since the widget needs the full set to price every
  // job type accurately. Once the category is empty, this is how a shop
  // gets it back — same 5-input quote as wizard Step 9, reusing
  // mqphCalcInstall() for the live calc since that function has no
  // wizard-state dependency of its own.
  window.mqphOpenInstallRequote = function() {
    // Per Jordan 2026-09-12 ("if they go to edit install rates it should
    // be showing the original quotes... so they can requote to edit"):
    // this modal now doubles as the "edit install rates" entry point
    // (see the button in buildEditorHTML's category header, no longer
    // gated to only the empty-category case) — so when rates already
    // exist, pre-fill each box with the ORIGINAL quoted job total those
    // rates came from, same "reverse rate × 4 = job price" math every
    // other Requote panel in this file already uses, instead of always
    // opening to 5 blank fields. Matched by each rate's fixed Name
    // (Sort order/Description can vary, Name doesn't). The two derived
    // some/mostly-drawers rates have no input box of their own — they're
    // always recomputed from the "bases, with doors" box on save, same
    // as they always have been.
    const findRate = (name) => lineItems.find(r => r.fields && r.fields['Category']==='install' && r.fields['Name']===name);
    const prefill = (id, name) => {
      const el = document.getElementById(id); if (!el) return;
      const rec = findRate(name);
      el.value = rec ? (Math.round((rec.fields['Rate']||0) * 4 * 100) / 100) : '';
    };
    prefill('mqph-inst-u-nd', 'Install — uppers (no doors)');
    prefill('mqph-inst-u-wd', 'Install — uppers (with doors)');
    prefill('mqph-inst-b-nd', 'Install — bases (no doors)');
    prefill('mqph-inst-b-wd', 'Install — bases (with doors)');
    prefill('mqph-removal',   'Cabinet removal');
    document.getElementById('mqph-install-requote-overlay')?.classList.add('show');
    mqphCalcInstall();
  };

  window.mqphCloseInstallRequote = function() {
    document.getElementById('mqph-install-requote-overlay')?.classList.remove('show');
  };

  window.mqphSaveInstallRequote = async function() {
    const und=parseFloat(document.getElementById('mqph-inst-u-nd')?.value||0);
    const uwd=parseFloat(document.getElementById('mqph-inst-u-wd')?.value||0);
    const bnd=parseFloat(document.getElementById('mqph-inst-b-nd')?.value||0);
    const bwd=parseFloat(document.getElementById('mqph-inst-b-wd')?.value||0);
    const rem=parseFloat(document.getElementById('mqph-removal')?.value||0);

    const hasExisting = lineItems.some(r => r.fields && r.fields['Category']==='install');
    const allBlank = !(und>0) && !(uwd>0) && !(bnd>0) && !(bwd>0) && !(rem>0);
    if (!hasExisting && allBlank) { alert('Enter at least one rate before saving.'); return; }
    if (hasExisting && allBlank) {
      if (!confirm('Every box is blank — this will delete all your remaining installation & removal rates. Continue?')) return;
    }

    const btn = document.getElementById('mqph-install-requote-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    // Per Jordan 2026-09-12: this modal now also serves as "edit install
    // rates" (see mqphOpenInstallRequote's pre-fill above), not just the
    // empty-category recovery flow it shipped as on 2026-09-11 — so
    // saving now UPDATES a rate that already exists (matched by its
    // fixed Name) instead of always creating a new row alongside it, and
    // clearing a box back to blank deletes that one rate. Mirrors every
    // other Requote/Edit panel in this file: edit in place, don't
    // duplicate.
    async function upsert(name, jobPriceOrRate, description, isRawRate) {
      const existing = lineItems.find(r => r.fields && r.fields['Category']==='install' && r.fields['Name']===name);
      const hasValue = isRawRate ? jobPriceOrRate !== null : jobPriceOrRate > 0;
      if (hasValue) {
        const rate = isRawRate ? jobPriceOrRate : Math.round((jobPriceOrRate/4)*100)/100;
        if (existing) {
          await atUpdate(LINE_ITEMS_TABLE, existing.id, {Rate:rate});
          existing.fields['Rate'] = rate;
        } else {
          const sort = lineItems.filter(r=>r.fields&&r.fields['Category']==='install').length + 1;
          const rec = await atCreate(LINE_ITEMS_TABLE, { shop:[shopRecord._recordId], Name:name, Category:'install', Rate:rate, Unit:'per lin ft', Description:description, Active:true, 'Sort order':sort });
          if (rec?.id) lineItems.push(rec);
        }
      } else if (existing) {
        await atDelete(LINE_ITEMS_TABLE, existing.id);
        const idx = lineItems.indexOf(existing); if (idx !== -1) lineItems.splice(idx, 1);
      }
    }

    try {
      await upsert('Install — uppers (no doors)',   und, 'Upper box install, no doors');
      await upsert('Install — uppers (with doors)', uwd, 'Upper install with doors hung');
      await upsert('Install — bases (no doors)',    bnd, 'Base box install, no doors');
      if (bwd > 0) {
        const bwdRate = Math.round((bwd/4)*100)/100;
        await upsert('Install — bases (with doors)',     bwd, 'Base install with doors hung');
        await upsert('Install — bases (some drawers)',   Math.round(bwdRate*1.10*100)/100, 'Base install with some drawers (+10% over with-doors rate)', true);
        await upsert('Install — bases (mostly drawers)', Math.round(bwdRate*1.15*100)/100, 'Base install with mostly drawers (+15% over with-doors rate)', true);
      } else {
        // Cleared back to blank — the two auto-calculated drawer rates
        // only ever exist because of this one, so they go too, same
        // "all 7 travel together" relationship the delete-cascade
        // already enforces elsewhere.
        await upsert('Install — bases (with doors)',     0, '');
        await upsert('Install — bases (some drawers)',   null, '', true);
        await upsert('Install — bases (mostly drawers)', null, '', true);
      }
      await upsert('Cabinet removal', rem, 'Remove & dispose existing cabinets');

      mqphCloseInstallRequote();
      await loadAndRender();
    } catch(e) {
      alert('Something went wrong saving these — please try again. Anything already saved stayed saved, so check Pricing before re-running to avoid duplicates.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save install/removal rates →'; }
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
    // Per Jordan 2026-09-12: "every new step should bring you to the
    // top of the step" — without this, the page kept whatever scroll
    // position it had from the PREVIOUS step, which could land partway
    // down or at the very bottom of the new (often shorter or taller)
    // step's content instead of showing its title from the top. Scrolls
    // the wizard card's own header into view, not just window.scrollTo,
    // so this still does the right thing regardless of where the wizard
    // sits on the page.
    document.querySelector('.mqph-wizard-header')?.scrollIntoView({block:'start'});
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
          Active:true, 'Sort order':i+1, 'Is baseline': item.isBaseline === true,
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
          `<span class="mqph-spec-tag">3 doors: 2 on 30" ${mqphMmTag(30)}, 1 on 18" ${mqphMmTag(18)}</span> · Hinges: <span class="mqph-spec-tag">${bl.blHingeName||'baseline hinge'}</span> · No drawers · Supply only · Include toe kick`,
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
          `Hinges: <span class="mqph-spec-tag">${name}</span> · No drawers · Supply only · Include toe kick`,
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
            `<strong>Include slides/guides · No doors · No drawer fronts · Supply only · Include toe kick</strong>`,
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
            `<strong>Include slides/guides · No doors · No drawer fronts · Supply only · Include toe kick</strong>`,
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
        // Per Jordan 2026-09-12 (hit this for real on hinge — see the
        // door branch below and the category-always-visible fix a few
        // hundred lines up): if this is the shop's very first material
        // (category was completely empty before this save), pin it
        // baseline immediately rather than leaving it unpinned — there's
        // nothing else in the category to compare it to, it's trivially
        // both the only option and the cheapest one. Material is safe to
        // just pin outright with no other math involved (its Rate is its
        // own absolute box price, never relative to baseline — same
        // reasoning as the "Is baseline" entry's material/door bullet).
        const isFirstOfCat = sortBase === 0;

        const upperRec = await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:`${name} — uppers`, Category:'material',
          Rate:upperRate, Unit:'per lin ft — uppers', Description:'Box material rate uppers', Active:true, 'Sort order':sortBase+1,
          ...(isFirstOfCat ? {'Is baseline': true} : {}),
        });
        const baseRec = await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:`${name} — bases`, Category:'material',
          Rate:baseRate, Unit:'per lin ft — bases', Description:'Box material rate bases', Active:true, 'Sort order':sortBase+2,
          ...(isFirstOfCat ? {'Is baseline': true} : {}),
        });
        if (upperRec?.id) lineItems.push(upperRec);
        if (baseRec?.id)  lineItems.push(baseRec);
      }

      if (cat === 'door') {
        const rate = Math.round(((p - bl.blBasePrice) / 4) * 100) / 100;
        const sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']==='door').length;
        // Same "first item in an empty category becomes baseline
        // automatically" reasoning as material just above — door's Rate
        // is likewise its own independent upcharge, safe to pin with no
        // other row needing to change.
        const isFirstOfCat = sortBase === 0;
        const rec = await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:name, Category:'door',
          Rate:rate, Unit:'per lin ft upcharge', Description:'Door style upcharge', Active:true, 'Sort order':sortBase+1,
          ...(isFirstOfCat ? {'Is baseline': true} : {}),
        });
        if (rec?.id) lineItems.push(rec);
      }

      if (cat === 'hinge') {
        const baseWithDoor = (bl.blBaseRate + bl.blDoorRate) * 4;
        const rate = Math.round(((p - baseWithDoor) / 4) * 100) / 100;
        const sortBase = lineItems.filter(r=>r.fields&&r.fields['Category']==='hinge').length;
        const isFirstOfCat = sortBase === 0;
        // Per Jordan 2026-09-12: adding the shop's first hinge back into
        // a completely empty category (e.g. after deleting the old
        // baseline hinge) has to become the new $0 baseline outright —
        // there's nothing else in the category for it to be an upcharge
        // over. But unlike material/door, just storing `rate` as-is and
        // pinning it would be WRONG: `rate` was computed against the OLD
        // baseline reference (`baseWithDoor`, which already has the OLD
        // baseline hinge's real dollar value folded into `bl.blDoorRate`
        // — see the chat reply for this session for the full derivation),
        // so it represents "how much more/less this hinge costs than
        // what's currently baked into every door's price as free" — not
        // this hinge's own upcharge over itself. The correct new baseline
        // hinge Rate is exactly 0 (it always is), and that same `rate`
        // value is exactly the amount every door's own Rate needs to move
        // by to stay accurate to the swap (their price included the OLD
        // hinge's value; shifting by `rate` re-bases them onto the new
        // one) — reusing the identical shift math the active baseline-
        // delete flow's hinge branch uses below in
        // mqphConfirmBaselineDelete, just triggered from this entry point
        // instead of that one.
        const doors = lineItems.filter(r => r.fields && r.fields['Category'] === 'door');
        if (isFirstOfCat && rate !== 0 && doors.length) {
          const preview = doors.slice(0,3)
            .map(d => `${d.fields['Name']}: ${CUR()}${(d.fields['Rate']||0).toFixed(2)}/lin ft → ${CUR()}${(((d.fields['Rate']||0)+rate)).toFixed(2)}/lin ft`).join('\n');
          const ok = confirm(`This becomes your new baseline hinge, priced at exactly ${CUR()}0 (included, not charged separately) — and since your door prices were quoted assuming your OLD baseline hinge, every door's price needs to shift by ${CUR()}${rate.toFixed(2)}/lin ft to stay accurate to this hinge's real cost.\n\nFor example:\n${preview}${doors.length>3?'\n…':''}\n\nContinue?`);
          if (!ok) {
            if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Save →'; }
            return;
          }
          for (const d of doors) {
            const newRate = Math.round(((d.fields['Rate']||0) + rate) * 100) / 100;
            try { await atUpdate(LINE_ITEMS_TABLE, d.id, {Rate:newRate}); d.fields['Rate'] = newRate; }
            catch(e) { console.error('Failed to reprice door for new baseline hinge', d.id, e); }
          }
        }
        const rec = await atCreate(LINE_ITEMS_TABLE, {
          shop:[shopRecord._recordId], Name:name, Category:'hinge',
          Rate:isFirstOfCat ? 0 : rate, Unit:'per lin ft upcharge', Description:'Hinge upcharge', Active:true, 'Sort order':sortBase+1,
          ...(isFirstOfCat ? {'Is baseline': true} : {}),
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
  function buildEditorHTML(driftNotices = []) {
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
      if (/^cc_/.test(c)) return; // custom pricing categories — handled by buildCustomCatsHtml()
      if (!groups[c]) groups[c] = [];
      groups[c].push(r);
    });
    const hasItems = visibleItems.length > 0;

    return `
      <div id="mqph-wizard-row" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;gap:1rem;flex-wrap:wrap">
        <div style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:.06em;text-transform:uppercase">Manage your rates</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${wizardHasRun ? `<div style="font-size:12px;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;max-width:340px;line-height:1.5">✨ Add new items using the <strong>+ Add</strong> buttons below, or <button class="mqph-btn-ghost" style="font-size:12px;padding:0;color:#1d4ed8;text-decoration:underline;cursor:pointer;background:none;border:none;font-family:inherit" onclick="mqphGoToWizard()">re-run the pricing wizard</button> to reprice everything.</div>` : `<button class="mqph-btn mqph-btn-secondary" onclick="mqphStartItemSetup()">🛠️ Edit shop items</button>`}
          <button class="mqph-btn mqph-btn-secondary" onclick="mqphGoToWizard()">🧙 Re-run pricing wizard</button>
          <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDeleteAll()">🗑️ Start fresh</button>
        </div>
      </div>

      ${document.getElementById('mq-page-pricing') && document.querySelector('#mq-page-pricing .mq-pricing-intro') ? '' : (typeof window.mqTrainingVideoBlockHTML === 'function' ? window.mqTrainingVideoBlockHTML('pricing') : '')}

      ${driftNotices.length ? driftNotices.map(n => `<div class="mqph-msg mqph-msg-success" style="display:block;margin-bottom:1rem">${n}</div>`).join('') : ''}

      ${!hasItems ? `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:3rem;text-align:center;margin-bottom:1.5rem">
          <div style="font-size:32px;margin-bottom:12px">⚙️</div>
          <div style="font-size:16px;font-weight:600;color:#111;margin-bottom:8px">No pricing set up yet</div>
          <div style="font-size:13px;color:#6b7280;margin-bottom:1.5rem">Start by setting up your shop items, then run the pricing wizard.</div>
          <button class="mqph-btn mqph-btn-primary" onclick="mqphStartItemSetup()">Set up shop items →</button>
        </div>` : `

        ${['material','door','drawer','hinge','zone','install'].map(cat => [cat, groups[cat]||[]]).concat(Object.entries(groups).filter(([cat]) => !['material','door','drawer','hinge','zone','install','other','tax'].includes(cat))).map(([cat,recs]) => `
          <div class="mqph-cat-block" data-mq-cat="${cat}">
            <div class="mqph-cat-header" onclick="mqphToggleCategory('${cat}')" style="cursor:pointer">
              <span class="mqph-cat-title"><span id="mqph-cat-arrow-${cat}" style="display:inline-block;margin-right:6px;transition:transform 0.2s;font-size:12px">▶</span>${CAT_LABELS[cat]||cat} <span style="font-size:12px;font-weight:400;color:#9ca3af">(${recs.length})</span></span>
              ${cat==='install'
                ? `<button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenInstallRequote()">${recs.length===0 ? '🔧 Requote install/removal rates' : '✏️ Edit install/removal rates'}</button>`
                : cat==='zone'
                  ? (recs.length===0 ? `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenAdd('zone')">+ Add</button>` : '')
                  : MINI_WIZ_CATS.includes(cat)
                    ? `<button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenAddItem('${cat}')">+ Add ${cat}</button>`
                    : `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="event.stopPropagation();mqphOpenAdd('${cat}')">+ Add</button>`
              }
            </div>
            <div id="mqph-cat-body-${cat}" style="display:none">
            ${cat==='zone' ? `<div style="font-size:11px;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:6px 10px;margin:4px 12px 8px">💡 Showing "km" but want "mi" instead (or back to km)? Click <strong>Edit</strong> on the zone below and switch the unit — it's just a label, so it's the one field that's editable there.</div>` : ''}
            ${cat==='install' && recs.length===0 ? `
            <div style="padding:16px 12px;font-size:12px;color:#6b7280;line-height:1.5">All installation & removal rates were deleted. Click <strong>"🔧 Requote install/removal rates"</strong> above to quote them again — the widget needs these to price install-only and removal jobs.</div>
            ` : recs.length===0 ? `
            <!-- Per Jordan 2026-09-12: a category that's dropped to zero
                 items (e.g. its last item got deleted) used to disappear
                 from this page ENTIRELY — header, "+ Add" button and all —
                 since the outer category list used to only render a
                 category that already had at least one item. That left no
                 way back in except through Airtable directly. Every
                 category above now always renders its header/button (see
                 the removed filter a few lines up); this is just the
                 friendlier empty body to go with it, in place of a bare
                 Name/Price column-header row with nothing under it. -->
            <div style="padding:16px 12px;font-size:12px;color:#6b7280;line-height:1.5">No ${(CAT_LABELS[cat]||cat).replace(/^\S+\s/,'').toLowerCase()} yet. Use the "+ Add" button above to add one.</div>
            ` : `
            <div style="display:flex;align-items:center;gap:16px;padding:4px 12px 6px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #f3f4f6;user-select:none">
              <span style="cursor:pointer;flex:1;${mqphSortLabelStyle(cat,'name')}" onclick="mqphSetSort('${cat}','name')">Name ${mqphSortArrow(cat,'name')}</span>
              <span style="cursor:pointer;min-width:80px;text-align:right;${mqphSortLabelStyle(cat,'price')}" onclick="mqphSetSort('${cat}','price')">Price ${mqphSortArrow(cat,'price')}</span>
              ${['door','material'].includes(cat) ? `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenBulkEdit('${cat}')">📊 Bulk edit</button>` : ''}
            </div>
            <div${recs.length > 10 ? ' style="max-height:450px;overflow-y:auto"' : ''}>
            ${mqphSortRecs(cat, recs).map(r=>`
              <div class="mqph-row">
                <div style="flex:1;min-width:0">
                  <div class="mqph-row-name"${cat==='door' ? ` id="mqph-door-row-name-${r.id}"` : ''}>${r.fields['Name']||'—'}${['material','door','hinge'].includes(cat) && r.fields['Is baseline'] ? ' <span title="New items in this category are priced as an upcharge against this one" style="font-size:11px;font-weight:600;color:#92400e">⭐ Baseline</span>' : ''}${cat==='door' ? mqphDoorStyleBadgeHtml(r) : ''}</div>
                  ${r.fields['Description']?`<div class="mqph-row-desc">${r.fields['Description']}</div>`:''}
                </div>
                <div class="mqph-row-rate">${(r.fields['Rate']||0) === 0 ? '<span style="font-size:11px;font-weight:600;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:2px 7px">Not priced individually (Part of baseline)</span>' : (r.fields['Category']==='zone'||r.fields['Unit']==='km'||r.fields['Unit']==='%') ? (r.fields['Rate']||0).toLocaleString() : CUR() +(r.fields['Rate']||0).toLocaleString()}</div>
                <div class="mqph-row-unit">${r.fields['Unit']||''}</div>
                <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active']?'on':''}" onclick="mqphToggle('${r.id}',this)"></div></div>
                ${cat==='install'
                  ? `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenInstallRequote()">Edit</button>`
                  : `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphOpenEdit('${r.id}')">Edit</button>`
                }
                <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphDelete('${r.id}')">Delete</button>
              </div>`).join('')}
            </div>
            `}
            </div>
          </div>`).join('')}
      `}

      ${buildCTHtml()}
      ${buildTrimHtml()}
      ${buildTallCabHtml()}
      ${buildIslandPanelHtml()}
      ${buildCustomCatsHtml()}

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
              <div id="mqph-bulk-requote-toggle" style="margin:2px 0 0"></div>
              <div id="mqph-bulk-requote-panel" style="display:none;margin-top:8px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px"></div>
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

      <!-- Install/removal requote overlay — appears only once Jordan's
           cascade-delete (see mqphDelete) has cleared the whole Install &
           Removal category, via the "🔧 Requote install/removal rates"
           button that takes the place of that category's normal "+ Add"
           button when it's empty. Reuses the exact same 5 input ids and
           mqphCalcInstall() live-calc as wizard Step 9 — mqphCalcInstall
           has no wizard-state dependency, it only reads these DOM ids — so
           the shop can requote the whole install/removal set without
           re-running the full pricing wizard. Added 2026-09-11. -->
      <div class="mqph-overlay" id="mqph-install-requote-overlay">
        <div class="mqph-modal">
          <div class="mqph-modal-hdr">
            <div><h3>🔧 Requote install/removal rates</h3></div>
            <button class="mqph-modal-hdr-close" onclick="mqphCloseInstallRequote()">×</button>
          </div>
          <div class="mqph-modal-body">
            <p style="font-size:13px;color:#6b7280;margin:0 0 1rem;line-height:1.5">Quote install-only prices — no supply, just labour. Use the same 4 lin ft spec as the rest of your pricing. Leave any box blank to skip that rate.</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">🔼 Upper cabinets — install only</div>
              <div style="font-size:11px;color:#6b7280;margin-bottom:0.75rem">Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} upper</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} upper</span> = 4 lin ft ${mqphMmTag(48)}</div>
              <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) uppers, <strong>box only</strong> (no doors)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-u-nd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
              <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) uppers, <strong>with doors</strong> (hang, adjust and install handles)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-u-wd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">🔽 Base cabinets — install only</div>
              <div style="font-size:11px;color:#6b7280;margin-bottom:0.75rem">Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)} · Include toe kick install</div>
              <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) bases, <strong>box only</strong> (no doors, include toe kick)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-b-nd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
              <div class="mqph-input-row"><label>4ft (${mqphMm(48).toLocaleString()}mm) bases, <strong>with doors</strong> (hang, adjust and install handles, include toe kick)</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-inst-b-wd" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
            </div>
            <div id="mqph-r-install" class="mqph-result"></div>
            <div style="height:1px;background:#e5e7eb;margin:1.25rem 0"></div>
            <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">🗑️ Cabinet removal & disposal</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:0.75rem">Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)} · Include toe kick install</div>
            <div class="mqph-input-row"><label>What would you charge to remove & dispose those same 4 linear feet (${mqphMm(48).toLocaleString()}mm) of base cabinets with doors?</label></div>
            <p style="font-size:12px;color:#6b7280;margin-bottom:10px;line-height:1.5">Include your cost to haul away and dispose of the old cabinets. <span id="mqph-removal-hint" style="color:#1d4ed8;font-weight:500"></span></p>
            <div class="mqph-input-row"><label>Removal & disposal price for 4ft (${mqphMm(48).toLocaleString()}mm) job</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-removal" placeholder="0.00" oninput="mqphCalcInstall()"/></div>
            <div id="mqph-r-removal" class="mqph-result"></div>
            <button class="mqph-btn mqph-btn-primary" id="mqph-install-requote-save" style="margin-top:1.25rem;width:100%" onclick="mqphSaveInstallRequote()">Save install/removal rates →</button>
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
            <div class="mqph-field"><label>Name</label><input type="text" id="mqph-item-name"/>
              <div id="mqph-item-name-lock-note" style="display:none;font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.4"></div>
            </div>
            <div class="mqph-field"><label>Category</label>
              <!-- 'drawer_config' is deliberately excluded here — it shares
                   CAT_LABELS' "🗄️ Drawer configurations" text with 'drawer'
                   (the real priced category, with Rate/Unit) purely for
                   display purposes elsewhere (category headers, etc.), but
                   it isn't a priced category itself — it has no entry in
                   CAT_UNIT_OPTIONS, and its rows are config-name chips
                   managed only through Edit Shop Items (see the
                   "drawer_config chips — not shown in editor" comment on
                   the main category-list render below). Listing it here
                   duplicated "Drawer configurations" in this dropdown
                   (Jordan flagged 2026-09-10) and would let a shop
                   accidentally create a malformed drawer_config row through
                   the wrong screen. -->
              <select id="mqph-item-cat" onchange="mqphOnItemCatChange()">${Object.entries(CAT_LABELS).filter(([v])=>!['drawer_config','other','tax'].includes(v)).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
              <div id="mqph-item-cat-lock-note" style="display:none;font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.4">🔒 Locked — an item's category can't be changed after it's created. Its Rate/Unit only make sense for the category it was priced under (e.g. a box material's rate is a flat price, a door style's is an upcharge, a drawer config's rate depends on its paired "some"/"mostly" rate) — switching category would keep the old number but reinterpret what it means, silently mispricing the widget. Delete and re-add the item under the correct category instead.</div>
            </div>
            <div class="mqph-field"><label id="mqph-item-rate-label">Rate (${CUR()})</label><input type="number" id="mqph-item-rate" step="0.01" oninput="mqphEditRequoteFromRate()"/></div>
            <div id="mqph-edit-requote-wrap"></div>
            <div class="mqph-field"><label>Unit</label>
              <select id="mqph-item-unit"></select>
              <div id="mqph-item-unit-lock-note" style="display:none;font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.4">🔒 Locked — an item's pricing method can't be changed after it's created (this is what let a hinge get accidentally switched to "each" and confuse pricing). Delete and re-add the item if it truly needs to be priced differently.</div>
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

      <!-- Baseline delete flow — see mqphOpenBaselineDeleteFlow above.
           Body content is fully dynamic (candidate list depends on which
           item is being deleted), so it's set via mqph-baseline-delete-body's
           innerHTML rather than templated here, same pattern as the bulk
           edit clusters list above. -->
      <div class="mqph-overlay" id="mqph-baseline-delete-overlay">
        <div class="mqph-modal">
          <div class="mqph-modal-hdr">
            <div><h3>⭐ Delete baseline item?</h3></div>
            <button class="mqph-modal-hdr-close" onclick="mqphCloseBaselineDelete()">×</button>
          </div>
          <div class="mqph-modal-body" id="mqph-baseline-delete-body"></div>
          <div class="mqph-modal-footer">
            <button class="mqph-btn mqph-btn-secondary" onclick="mqphCloseBaselineDelete()">Cancel</button>
            <button class="mqph-btn mqph-btn-danger" onclick="mqphConfirmBaselineDelete()" style="margin-left:auto">Delete item</button>
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
    const unit = document.getElementById('mqph-local-radius-unit')?.value || 'km';
    const existing = lineItems.find(r => r.fields && r.fields['Name']?.toLowerCase().includes('local') && r.fields['Category']==='zone');
    if (existing) {
      await atUpdate(LINE_ITEMS_TABLE, existing.id, { 'Rate':val, 'Unit':unit });
      existing.fields['Rate'] = val;
      existing.fields['Unit'] = unit;
    } else {
      const rec = await atCreate(LINE_ITEMS_TABLE, { 'shop':[shopRecord._recordId], 'Name':'Local zone radius', 'Category':'zone', 'Rate':val, 'Unit':unit, 'Description':'Within this distance = no travel surcharge', 'Active':true, 'Sort order':0 });
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

  // Fills the Unit dropdown with only the values that make sense for `cat`
  // (falling back to the full list for an unrecognized category) — a
  // closed set of choices, never free-typed, per Jordan's explicit call
  // 2026-09-10. If `selected` isn't in that category's normal list — an
  // old/odd item — it's added anyway so opening the modal never silently
  // swaps an item's unit out from under it just by rendering the dropdown.
  // Travel zones store a distance (km/mi), not a dollar amount — the
  // "Rate" field's label needs to say so, since a bare "Rate ($)" with a
  // dollar-sign prefix reads as a price and confused Jordan when he opened
  // his "Local zone radius" item and saw "$" next to a plain distance
  // number. Every other category still uses a real Rate ($/lin ft, %,
  // flat, etc.), so this only swaps the label for `zone`.
  function mqphRateLabel(cat) {
    return cat === 'zone' ? 'Distance' : `Rate (${CUR()})`;
  }

  function mqphPopulateUnitOptions(cat, selected) {
    const sel = document.getElementById('mqph-item-unit');
    if (!sel) return;
    const opts = CAT_UNIT_OPTIONS[cat] || ALL_UNIT_OPTIONS;
    const list = (selected && !opts.includes(selected)) ? [selected, ...opts] : opts;
    sel.innerHTML = list.map(u => `<option value="${u}" ${u===selected?'selected':''}>${u}</option>`).join('');
  }

  // Category changes only affect Unit choices while adding a brand-new
  // item — once editing an existing one, Unit is locked (see mqphOpenEdit)
  // regardless of what Category gets changed to.
  window.mqphOnItemCatChange = function() {
    if (currentEditId) return;
    const cat = document.getElementById('mqph-item-cat').value;
    mqphPopulateUnitOptions(cat, (CAT_UNIT_OPTIONS[cat]||ALL_UNIT_OPTIONS)[0]);
  };

  window.mqphOpenAdd = function(cat) {
    currentEditId = null;
    document.getElementById('mqph-modal-title').textContent = 'Add item';
    document.getElementById('mqph-item-name').value = '';
    // Add never reaches material/door/drawer through this raw modal (those
    // categories' "+ Add" opens the mini-wizard instead — see
    // MINI_WIZ_CATS) so Name always starts fresh/editable here — the
    // material/drawer lock above only ever applies on Edit.
    document.getElementById('mqph-item-name').disabled = false;
    const nameLockNote = document.getElementById('mqph-item-name-lock-note');
    if (nameLockNote) nameLockNote.style.display = 'none';
    document.getElementById('mqph-item-cat').value = cat || 'material';
    // Locked here too, not just on Edit — per Jordan 2026-09-11: "when
    // adding new they shouldnt be able to choose right? because if youre
    // adding a door, youre adding a door... you shouldnt be able to tell
    // it its a door [from some other category's Add button]." Confirmed
    // this is safe: mqphOpenAdd has exactly one call site in the whole
    // file (each category header's own "+ Add" button, passing its own
    // `cat`), so the category is always already decided by which button
    // was clicked — the dropdown was never actually choosing anything,
    // just redundantly re-displaying a decision already made.
    document.getElementById('mqph-item-cat').disabled = true;
    document.getElementById('mqph-item-rate').value = '';
    const rateLabelEl = document.getElementById('mqph-item-rate-label');
    if (rateLabelEl) rateLabelEl.textContent = mqphRateLabel(cat || 'material');
    mqphPopulateUnitOptions(cat || 'material', (CAT_UNIT_OPTIONS[cat||'material']||ALL_UNIT_OPTIONS)[0]);
    document.getElementById('mqph-item-unit').disabled = false;
    document.getElementById('mqph-item-desc').value = '';
    document.getElementById('mqph-item-active').checked = true;
    const lockNote = document.getElementById('mqph-item-unit-lock-note');
    if (lockNote) lockNote.style.display = 'none';
    const catLockNote = document.getElementById('mqph-item-cat-lock-note');
    if (catLockNote) {
      catLockNote.textContent = `🔒 Adding a "${CAT_LABELS[cat || 'material']}" item — set by the "+ Add" button you clicked. To add a different kind of item, use that category's own "+ Add" button instead.`;
      catLockNote.style.display = 'block';
    }
    // Add never reaches material/door/drawer (those categories' "+ Add"
    // opens the mini-wizard instead — see MINI_WIZ_CATS), so there's never
    // a rec to reverse-calculate a quote from here. Clear defensively
    // anyway in case a leftover panel from a prior Edit is still in the DOM.
    mqphRenderEditRequote(null);
    document.getElementById('mqph-modal-overlay').classList.add('show');
  };

  // ============================================================
  // EDIT MODAL — "see the original quote behind this rate" panel
  // ============================================================
  // Material, door and drawer rates aren't numbers a shop owner ever typed
  // directly — they're back-derived from a real job quote using the same
  // 4-lin-ft baseline spec the wizard/mini-wiz/Bulk-Edit-Requote all use
  // (see getBaselineRates()). Per Jordan 2026-09-11 ("seeing the linear
  // foot upcharge can be confusing, because its unrelatable... let them
  // see their original quote"), this reverse-calculates that job total and
  // shows it right in the Edit modal, pre-filled from the item's current
  // Rate. He confirmed (2026-09-11, AskUserQuestion) he wants it
  // interactive rather than read-only — same idea as Bulk Edit's Requote,
  // just built into every Edit instead of hidden behind a toggle — so
  // typing a new job total here writes straight back into the Rate field
  // above, and editing Rate directly updates this total right back. Either
  // field can drive the other; nothing here writes to Airtable itself,
  // mqphSaveItem() still owns that (it just reads whatever's currently in
  // Rate, same as always).
  //
  // UPDATE (2026-09-11) — hinge is now included too, per Jordan's
  // follow-up ask ("i also noticed hinges isnt showing its requote
  // option, can we also allow it"). The BASELINE hinge specifically is
  // still excluded from the interactive panel (see the `Is baseline`
  // check below) — its Rate is deliberately pinned at exactly 0 (its cost
  // is already folded into the baseline door price, not charged
  // separately — see the "Is baseline" entry in the persistent-fixes
  // checklist), and letting a shop type an arbitrary job price in here
  // would silently give it a nonzero rate, breaking that invariant. Every
  // other hinge reverses the same way door does.
  //
  // Material and door reverse cleanly (one real quote in, one number out).
  // Drawer's "mostly drawers" rate is trickier: it's the wizard's own
  // average of two separate quotes (1-drawer + full bank), and only the
  // blended result was ever saved on the "mostly drawers" record itself —
  // BUT the 1-drawer quote can be recovered exactly from the paired
  // "some drawers" record's own rate (their formulas share that same
  // number). UPDATE (2026-09-11): when that paired record still exists,
  // this now shows the actual drawer-bank quote (editable, so a shop can
  // requote it if they got it wrong or prices changed) instead of the
  // blended effective price — per Jordan: "id rather it show their quote
  // for the drawer bank because thats whats used to get the blended
  // rate." Falls back to the old blended-effective-price display only if
  // the paired "some drawers" record is missing (can mostly only happen
  // on old data from before the two were required to stay paired — see
  // mqphDelete's drawer-pair cascade above).
  function mqphEditRequoteSpec(rec) {
    const cat = rec.fields['Category'];
    if (!['material','door','drawer','hinge'].includes(cat)) return null;
    const bl = getBaselineRates();
    const name = rec.fields['Name'] || '';
    const unit = rec.fields['Unit'] || '';

    if (cat === 'material') {
      const isUpper = /uppers/i.test(unit) || /—\s*uppers\s*$/i.test(name);
      const matName = name.replace(/\s*—\s*(uppers|bases)\s*$/i, '').trim() || 'this material';
      return {
        priceLabel: 'Your total price for this job?',
        hint: null,
        spec: specBox(isUpper ? [
          `<strong>Upper cabinets — box only, no doors, with shelves</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} upper</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} upper</span> = 4 lin ft ${mqphMmTag(48)}`,
          `Material: <span class="mqph-spec-tag">${matName}</span> · No doors · With shelves · Supply only`,
        ] : [
          `<strong>Base cabinets — box only, no doors, no drawers, with 2 shelves</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
          `Material: <span class="mqph-spec-tag">${matName}</span> · No doors · No drawers · With 2 shelves · Supply only · Include toe kick`,
        ]),
        rateToPrice: (rate) => rate * 4,
        priceToRate: (price) => price / 4,
      };
    }

    if (cat === 'door') {
      if (bl.blBasePrice <= 0) return { noBaseline: true };
      return {
        priceLabel: 'Your total price for this job?',
        hint: `We'll subtract ${CUR()}${bl.blBasePrice.toLocaleString()} (your ${bl.blMatName} base box price) and divide by 4 to get the upcharge.`,
        spec: specBox([
          `<strong>Base cabinets + this door style</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
          `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Door: <span class="mqph-spec-tag">${name}</span>`,
          `<span class="mqph-spec-tag">3 doors: 2 on 30" ${mqphMmTag(30)}, 1 on 18" ${mqphMmTag(18)}</span> · Hinges: <span class="mqph-spec-tag">${bl.blHingeName||'baseline hinge'}</span> · No drawers · Supply only · Include toe kick`,
        ]),
        rateToPrice: (rate) => rate * 4 + bl.blBasePrice,
        priceToRate: (price) => (price - bl.blBasePrice) / 4,
      };
    }

    // drawer
    if (cat === 'drawer') {
      if (bl.blBasePrice <= 0) return { noBaseline: true };
      const isMostly = /mostly drawers\s*$/i.test(name);
      const drawerName = name.replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim() || 'this drawer config';
      if (isMostly) {
        // Recover the paired "some drawers" record's own quote — its rate
        // gives us the 1-drawer job price exactly (someRate = (p1 -
        // basePrice)/4, so p1 = someRate*4 + basePrice), which is the
        // missing piece needed to pull the drawer-bank quote back out of
        // this "mostly" rate (a plain average of the two).
        const someRec = lineItems.find(r => r.fields &&
          r.fields['Category'] === 'drawer' &&
          (r.fields['Name']||'').replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim() === drawerName &&
          /some drawers\s*$/i.test(r.fields['Name']||''));
        if (someRec) {
          const p1 = (someRec.fields['Rate']||0) * 4 + bl.blBasePrice;
          return {
            priceLabel: 'Your total price for the full drawer bank job?',
            hint: `In plain terms: this rate is a blend of two quotes — 1 drawer per cabinet, and a full 3-drawer bank — averaged together. We already know your 1-drawer quote from the "${drawerName} — some drawers" rate, so this box shows your drawer-bank quote specifically. Change it here if you quoted it wrong or prices changed, and we'll re-blend the two to update the rate.`,
            spec: specBox([
              `<strong>Base cabinets + full drawer bank (3 per cabinet)</strong>`,
              `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
              `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Drawers: <span class="mqph-spec-tag">${drawerName}</span> · No doors · No drawer fronts · Supply only · Include toe kick`,
            ]),
            rateToPrice: (rate) => 2 * (rate * 4 + bl.blBasePrice) - p1,
            priceToRate: (price) => ((p1 + price) / 2 - bl.blBasePrice) / 4,
          };
        }
        // No paired "some drawers" record found (old data from before the
        // pair became required together — see mqphDelete above) — fall
        // back to showing the blended effective price, same as before
        // this feature could recover the real drawer-bank quote.
        return {
          priceLabel: 'Combined effective job price for this rate',
          hint: `In plain terms: this rate is a blend of two quotes — 1 drawer per cabinet, and a full 3-drawer bank — averaged together, and only the blended result was ever saved (we couldn't find a matching "${drawerName} — some drawers" rate to recover your original drawer-bank quote from). This is that combined effective price, not one real quote. We subtract ${CUR()}${bl.blBasePrice.toLocaleString()} (your ${bl.blMatName} base box price) and divide by 4 to get the rate.`,
          spec: specBox([
            `<strong>Base cabinets + full drawer bank (3 per cabinet)</strong> — averaged with the 1-drawer quote`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
            `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Drawers: <span class="mqph-spec-tag">${drawerName}</span> · No doors · No drawer fronts · Supply only · Include toe kick`,
          ]),
          rateToPrice: (rate) => rate * 4 + bl.blBasePrice,
          priceToRate: (price) => (price - bl.blBasePrice) / 4,
          isBlended: true,
        };
      }
      return {
        priceLabel: 'Your total price for this job?',
        hint: `We'll subtract ${CUR()}${bl.blBasePrice.toLocaleString()} (your ${bl.blMatName} base box price) and divide by 4 to get the upcharge.`,
        spec: specBox([
          `<strong>Base cabinets + 1 top drawer per cabinet</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
          `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Drawers: <span class="mqph-spec-tag">${drawerName}</span> · Include slides/guides · No doors · No drawer fronts · Supply only · Include toe kick`,
        ]),
        rateToPrice: (rate) => rate * 4 + bl.blBasePrice,
        priceToRate: (price) => (price - bl.blBasePrice) / 4,
      };
    }

    // hinge — the baseline hinge itself is excluded (see the comment block
    // above this function for why); every other hinge reverses the same
    // way door does, over the base+baseline-door job instead of the bare
    // base box.
    if (rec.fields['Is baseline']) return { baselineHinge: true };
    if (bl.blBasePrice <= 0) return { noBaseline: true };
    const baseWithDoorPrice = bl.blBasePrice + bl.blDoorRate * 4;
    return {
      priceLabel: 'Your total price for this job?',
      hint: `We'll subtract ${CUR()}${baseWithDoorPrice.toLocaleString()} (your ${bl.blMatName} base box + ${bl.blDoorName||'baseline door'}) and divide by 4 to get the upcharge.`,
      spec: specBox([
        `<strong>Base cabinets + baseline door + this hinge</strong>`,
        `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
        `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Door: <span class="mqph-spec-tag">${bl.blDoorName||'baseline door'}</span>`,
        `Hinges: <span class="mqph-spec-tag">${name}</span> (instead of ${bl.blHingeName||'baseline hinge'}) · No drawers · Supply only · Include toe kick`,
      ]),
      rateToPrice: (rate) => rate * 4 + baseWithDoorPrice,
      priceToRate: (price) => (price - baseWithDoorPrice) / 4,
    };
  }

  // Holds the active conversion functions for whatever's open in the Edit
  // modal right now — null when the panel isn't showing (wrong category,
  // or no baseline yet), so the two oninput handlers below become no-ops.
  let _mqphEditRequote = null;

  function mqphRenderEditRequote(rec) {
    const wrap = document.getElementById('mqph-edit-requote-wrap');
    if (!wrap) return;
    _mqphEditRequote = null;
    if (!rec) { wrap.innerHTML = ''; return; }
    const cfg = mqphEditRequoteSpec(rec);
    if (!cfg) { wrap.innerHTML = ''; return; }
    if (cfg.noBaseline) {
      wrap.innerHTML = `<div style="font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;margin:-4px 0 1rem">⚠️ No baseline pricing found — run the pricing wizard first to see this rate's original quote.</div>`;
      return;
    }
    if (cfg.baselineHinge) {
      wrap.innerHTML = `<div style="font-size:12px;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;margin:-4px 0 1rem">⭐ This is your baseline hinge — its rate always stays ${CUR()}0 because its cost is already built into the baseline door price, not charged on top of it, so there's no separate quote to show here.</div>`;
      return;
    }
    _mqphEditRequote = cfg;
    const currentRate = parseFloat(document.getElementById('mqph-item-rate')?.value || 0);
    const price = currentRate ? cfg.rateToPrice(currentRate) : 0;
    wrap.innerHTML = `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin:-4px 0 1rem">
        <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">🧮 ${cfg.isBlended ? 'Reverse-calculated effective quote' : 'Original quote for this rate'}</div>
        ${cfg.spec}
        <div class="mqph-input-row"><label>${cfg.priceLabel}</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-edit-rq-price" value="${price>0?price.toFixed(2):''}" placeholder="0.00" oninput="mqphEditRequoteFromPrice()"/></div>
        ${cfg.hint ? `<p class="mqph-calc-hint" style="margin-bottom:0">${cfg.hint}</p>` : ''}
      </div>`;
  }

  // Typing a new job total here recalculates Rate above — doesn't touch
  // Airtable, just fills the input; Save still owns the actual write.
  window.mqphEditRequoteFromPrice = function() {
    if (!_mqphEditRequote) return;
    const priceInp = document.getElementById('mqph-edit-rq-price');
    const rateInp = document.getElementById('mqph-item-rate');
    if (!priceInp || !rateInp) return;
    const price = parseFloat(priceInp.value || 0);
    if (!price) return;
    rateInp.value = (Math.round(_mqphEditRequote.priceToRate(price) * 100) / 100).toFixed(2);
  };

  // The reverse direction — editing Rate directly keeps the quote total
  // above it honest instead of going stale/contradictory.
  window.mqphEditRequoteFromRate = function() {
    if (!_mqphEditRequote) return;
    const priceInp = document.getElementById('mqph-edit-rq-price');
    const rateInp = document.getElementById('mqph-item-rate');
    if (!priceInp || !rateInp) return;
    const rate = parseFloat(rateInp.value || 0);
    priceInp.value = rate ? (Math.round(_mqphEditRequote.rateToPrice(rate) * 100) / 100).toFixed(2) : '';
  };

  window.mqphOpenEdit = function(id) {
    const rec = lineItems.find(r=>r.id===id); if(!rec) return;
    currentEditId = id;
    document.getElementById('mqph-modal-title').textContent = 'Edit item';
    document.getElementById('mqph-item-name').value  = rec.fields['Name']||'';
    // Locked for material and drawer only — per Jordan 2026-09-11: "i think
    // both should probably be locked, because i can see how it would work
    // otherwise" (following up on his original Category-lock question,
    // which also asked whether material/drawer names are safe to change).
    // They're not: getBaselineRates() finds a material's uppers/bases pair,
    // and mqphDelete/mqphEditRequoteSpec find a drawer config's some/mostly
    // pair, by stripping the "— uppers"/"— bases"/"— some drawers"/
    // "— mostly drawers" suffix off this exact Name and matching the two
    // rows' stripped names against each other — a rename that doesn't keep
    // both halves in sync would silently break that pairing. Door was
    // deliberately left OUT of this lock (see the smart-door-rename fix
    // above) — Jordan wants door names to stay freely editable, and the
    // `Linked door style` fragility that used to make that unsafe is now
    // handled by auto-propagating a door rename into every linked trim
    // item, not by locking it.
    // Install — locked 2026-09-12 too, for the same reason as material/
    // drawer above: mqphOpenInstallRequote/mqphSaveInstallRequote and
    // widget.js/widgetpro.js all look up an install rate by one of its 5
    // fixed Name strings ('Install — uppers (no doors)', etc. — see the
    // CAT_LABELS/upsert comments near mqphSaveInstallRequote), so a
    // rename would silently orphan that rate from every place that reads
    // it by name. In practice this rarely gets reached — the per-row Edit
    // button for install rows now opens mqphOpenInstallRequote() instead
    // of this raw modal (see the category-row template) — but locked here
    // too as a defensive backstop, same layered pattern as Category's lock
    // applying to both Add and Edit even though most entry points are
    // already gated.
    const nameLocked = ['material','drawer','install'].includes(rec.fields['Category']);
    document.getElementById('mqph-item-name').disabled = nameLocked;
    const nameLockNote = document.getElementById('mqph-item-name-lock-note');
    if (nameLockNote) {
      nameLockNote.textContent = rec.fields['Category'] === 'install'
        ? '🔒 Locked — install & removal rates are matched to the widget\'s pricing by this exact name, so renaming one would silently stop it from being priced. Use the "✏️ Edit install/removal rates" panel instead to change the price.'
        : '🔒 Locked — box materials and drawer configs are matched to their paired row (uppers/bases, or some/mostly drawers) by parsing this exact name, so renaming one side without the other would break that pairing and silently mis-price the widget. Delete and re-add both halves together if it truly needs a new name.';
      nameLockNote.style.display = nameLocked ? 'block' : 'none';
    }
    document.getElementById('mqph-item-cat').value   = rec.fields['Category']||'material';
    // Locked, no exception (unlike Unit below) — Category changes what an
    // item's Rate/Unit actually MEAN (a box material's rate is a flat
    // price; a door style's is an upcharge over baseline; a drawer
    // config's depends on its paired "some"/"mostly" rate; an install
    // rate is one of a matched set) and every one of those meanings is
    // wired to Category-specific math and lookups elsewhere in this file
    // (getBaselineRates, the drawer-pairing delete/requote logic, the
    // install-cascade delete/requote logic, etc.) — switching Category on
    // an existing record would keep the same stored Rate but reinterpret
    // it under a different formula, silently mispricing the widget with
    // no warning. Per Jordan 2026-09-11: "categories should be locked...
    // i dont think any item should be able to change its category."
    document.getElementById('mqph-item-cat').disabled = true;
    const catLockNote = document.getElementById('mqph-item-cat-lock-note');
    if (catLockNote) {
      catLockNote.textContent = '🔒 Locked — an item\'s category can\'t be changed after it\'s created. Its Rate/Unit only make sense for the category it was priced under (e.g. a box material\'s rate is a flat price, a door style\'s is an upcharge, a drawer config\'s rate depends on its paired "some"/"mostly" rate) — switching category would keep the old number but reinterpret what it means, silently mispricing the widget. Delete and re-add the item under the correct category instead.';
      catLockNote.style.display = 'block';
    }
    document.getElementById('mqph-item-rate').value  = rec.fields['Rate']||'';
    const rateLabelEl = document.getElementById('mqph-item-rate-label');
    if (rateLabelEl) rateLabelEl.textContent = mqphRateLabel(rec.fields['Category']||'material');
    const editCat = rec.fields['Category']||'material';
    const unit = rec.fields['Unit']||'per lin ft';
    mqphPopulateUnitOptions(editCat, unit);
    // Locked: whatever pricing method the item was created with is the
    // only one it can ever have — see the CAT_UNIT_OPTIONS comment above
    // and Jordan's 2026-09-09 report of a customer accidentally switching
    // a hinge from "per lin ft upcharge" to "each" and confusing pricing.
    //
    // Exception: "zone" (travel zones). Its Unit is just a display label —
    // "km" vs "mi" — with zero calculation behind it (see CAT_UNIT_OPTIONS
    // comment), so switching it on Edit can't cause the hinge-style pricing
    // bug. Per Jordan 2026-09-10, leave it editable there so a shop can
    // relabel a zone from km to mi (or back) without deleting/recreating it.
    const unitLocked = editCat !== 'zone';
    document.getElementById('mqph-item-unit').disabled = unitLocked;
    document.getElementById('mqph-item-desc').value  = rec.fields['Description']||'';
    document.getElementById('mqph-item-active').checked = rec.fields['Active']!==false;
    const lockNote = document.getElementById('mqph-item-unit-lock-note');
    if (lockNote) lockNote.style.display = unitLocked ? 'block' : 'none';
    // Island-panel-style tagging lives entirely outside this modal (Jordan
    // 2026-10-03) — each style's own door-tagging list inside the "Island
    // panel pricing" section (see buildIslandPanelHtml/
    // mqphToggleIslandStyleDoor below) is the only place a door's
    // `Island panel style` tag is ever set, instead of needing each door
    // opened individually here.
    mqphRenderEditRequote(rec);
    document.getElementById('mqph-modal-overlay').classList.add('show');
  };

  window.mqphCloseModal = function() { document.getElementById('mqph-modal-overlay')?.classList.remove('show'); };

  window.mqphSaveItem = async function() {
    const name = document.getElementById('mqph-item-name').value.trim();
    if (!name) { alert('Please enter a name.'); return; }
    const category = document.getElementById('mqph-item-cat').value;
    if (!currentEditId && !mqphWarnIfDuplicate(category, name)) return;
    // Smart door rename — per Jordan 2026-09-11: "yes lets make door
    // change names smart." Crown/Valance trim items link to a door style
    // by storing its NAME as plain text in `Linked door style` (not a
    // record ID — see the door → trim cleanup inside mqphDelete above),
    // so a plain rename would otherwise silently orphan that link. Snapshot
    // the door's pre-save name here (Category is locked on Edit, so
    // `category` above is guaranteed to match `oldRec`'s if this is an
    // edit) and propagate the rename into every linked trim item's array
    // after the save succeeds, below.
    const oldRec = currentEditId ? lineItems.find(r => r.id === currentEditId) : null;
    const oldDoorName = (oldRec && oldRec.fields && oldRec.fields['Category'] === 'door') ? (oldRec.fields['Name'] || '') : '';
    const fields = {
      shop:[shopRecord._recordId], Name:name,
      Category:category,
      Rate:parseFloat(document.getElementById('mqph-item-rate').value||0),
      Unit:document.getElementById('mqph-item-unit').value,
      Description:document.getElementById('mqph-item-desc').value.trim(),
      Active:document.getElementById('mqph-item-active').checked,
    };
    // Note: `Island panel style` (door-only) is intentionally NOT touched
    // here — it's edited exclusively via the per-style door-tagging list in
    // the Island panel pricing section (mqphToggleIslandStyleDoor), not
    // through this raw modal, so a save here never overwrites it. Also
    // means a brand-new door created through this modal is left with this
    // field unset — by design, per Jordan 2026-10-03: unset reads as
    // "untagged", which shows up as an untagged-door warning in the Island
    // panel pricing section's header rather than silently defaulting to
    // some style it was never actually calibrated for (see
    // buildIslandPanelHtml's summary logic).
    try {
      if (currentEditId) { await atUpdate(LINE_ITEMS_TABLE,currentEditId,fields); }
      else { fields['Sort order']=lineItems.length+1; await atCreate(LINE_ITEMS_TABLE,fields); }
      if (oldDoorName && oldDoorName !== name) {
        const linkedTrims = lineItems.filter(r => {
          if (!r.fields || r.fields['Category'] !== 'trim') return false;
          let linked = [];
          try { linked = r.fields['Linked door style'] ? JSON.parse(r.fields['Linked door style']) : []; } catch(e) { linked = []; }
          return linked.includes(oldDoorName);
        });
        for (const t of linkedTrims) {
          let linked = [];
          try { linked = JSON.parse(t.fields['Linked door style']); } catch(e) { linked = []; }
          const renamed = linked.map(n => n === oldDoorName ? name : n);
          try { await atUpdate(LINE_ITEMS_TABLE, t.id, { 'Linked door style': JSON.stringify(renamed) }); } catch(e) { console.error('Failed to propagate door rename to linked trim', e); }
        }
      }
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
    const rec = lineItems.find(r => r.id === id);
    // Deleting the pinned baseline material/door/hinge used to just fall
    // through to the plain confirm() below, and getBaselineRates() would
    // silently pick up whatever had the lowest Sort order as the new
    // baseline — not necessarily the cheapest, and with zero warning. Per
    // Jordan 2026-09-11/12 ("baseline should be the cheapest... its called
    // baseline for that reason"), this intercepts that one case and routes
    // to an explicit picker instead — see mqphOpenBaselineDeleteFlow below.
    if (rec && rec.fields && rec.fields['Is baseline'] && ['material','door','hinge'].includes(rec.fields['Category'])) {
      return mqphOpenBaselineDeleteFlow(id);
    }
    // Drawer "some" and "mostly" rates are two halves of one calculation —
    // "mostly drawers"' rate is a blend that depends on the "some drawers"
    // rate for the same config to make sense (see mqphEditRequoteSpec
    // below, which reads the paired item back out to recover the original
    // drawer-bank quote) — deleting only one half leaves the other
    // pointing at a quote that no longer fully exists. Per Jordan
    // 2026-09-11: warn that the partner rate goes too, then delete both.
    let drawerPartner = null;
    if (rec && rec.fields && rec.fields['Category'] === 'drawer') {
      const baseName = (rec.fields['Name']||'').replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim();
      if (baseName) {
        drawerPartner = lineItems.find(r => r.id !== id && r.fields &&
          r.fields['Category'] === 'drawer' &&
          (r.fields['Name']||'').replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim() === baseName);
      }
    }
    // Installation & removal rates all work together to cover every job
    // type the widget can quote (uppers/bases, with/without doors, some/
    // mostly drawers, removal) — deleting only one would leave the widget
    // with no accurate install price for whatever job needs the missing
    // rate. Per Jordan 2026-09-11: warn that deleting any one install/
    // removal rate deletes the whole set, then let the shop requote all of
    // them at once via the "🔧 Requote install/removal rates" button that
    // takes the "+ Add" button's place once the category is empty (see
    // mqphOpenInstallRequote above).
    let installSiblings = [];
    if (rec && rec.fields && rec.fields['Category'] === 'install') {
      installSiblings = lineItems.filter(r => r.id !== id && r.fields && r.fields['Category'] === 'install');
    }

    const confirmMsg = drawerPartner
      ? `Delete this item? Its paired rate — "${drawerPartner.fields['Name']}" — is calculated together with this one and can't be split apart, so it'll be deleted too.`
      : installSiblings.length > 0
        ? `Delete this item? Your installation & removal rates work together — the widget picks whichever one matches a job, so having only some of them would make its install pricing inaccurate. Deleting this one will delete all ${installSiblings.length + 1} installation & removal rates together. You can requote them anytime after, using the button that'll appear here.`
        : 'Delete this item?';
    if (!confirm(confirmMsg)) return;
    try {
      // Same door → linked-crown/valance cleanup as mqphDeleteChip, for
      // this second, more generic delete path.
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
      await atDelete(LINE_ITEMS_TABLE,id);
      if (drawerPartner) { try { await atDelete(LINE_ITEMS_TABLE, drawerPartner.id); } catch(e) {} }
      for (const sib of installSiblings) { try { await atDelete(LINE_ITEMS_TABLE, sib.id); } catch(e) {} }
      await loadAndRender();
    } catch(e) { alert('Error deleting.'); }
  };

  // ============================================================
  // ACTIVE BASELINE DELETE FLOW — material, door, hinge
  // ============================================================
  // Per Jordan 2026-09-11/12: "baseline should be the cheapest... its
  // called baseline for that reason" — deleting the pinned baseline item
  // now shows this instead of the plain confirm() in mqphDelete above: the
  // item(s) that would become the new baseline (with a picker if more than
  // one is tied for cheapest), or a plain warning if it's the only item
  // left in its category.
  //
  // "Create a new item instead" is deliberately NOT a price-entry form
  // nested inside this popup — that would mean re-building a second, more
  // cramped copy of the existing Add-item form in here, which is a lot of
  // new surface area to get wrong for something the shop can already do
  // with the regular "+ Add" button. Per Jordan wanting this "easy and not
  // going to be all buggy": cancel out of this popup, add the new item
  // normally, then delete the old baseline again. For material/door
  // that's often a non-event by the time you come back — the passive
  // drift-watcher (mqphCheckBaselineDrift above) auto-promotes a genuinely
  // cheaper item to baseline the moment it's saved, so this popup may not
  // even appear a second time. Hinge isn't passively watched (its
  // baseline is pinned at exactly $0, not just "whatever's cheapest" — see
  // that function's own comment for why), so a newly-added hinge instead
  // shows up right here, as a normal candidate to pick.
  let _baselineDeleteState = null;

  function mqphOpenBaselineDeleteFlow(id) {
    const rec = lineItems.find(r => r.id === id);
    if (!rec) return;
    const cat = rec.fields['Category'];

    let candidates; // [{ key, label, price, ids:[...] }], cheapest-first ties grouped by equal price
    if (cat === 'material') {
      const baseName = (rec.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim();
      const byBase = {};
      lineItems.forEach(r => {
        if (!r.fields || r.fields['Category'] !== 'material' || r.fields['Active'] === false) return;
        const bn = (r.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim();
        if (bn === baseName) return; // exclude the material being deleted
        if (!byBase[bn]) byBase[bn] = { key: bn, label: bn, price: null, ids: [] };
        byBase[bn].ids.push(r.id);
        if (/—\s*bases\s*$/i.test(r.fields['Name']||'')) byBase[bn].price = r.fields['Rate']||0;
      });
      // Same requirement Bulk Edit and the drift-watcher already enforce —
      // a material missing its uppers or bases half can't be safely priced.
      candidates = Object.values(byBase).filter(c => c.price !== null && c.ids.length === 2);
    } else {
      candidates = lineItems.filter(r => r.fields && r.fields['Category'] === cat && r.fields['Active'] !== false && r.id !== id)
        .map(r => ({ key: r.id, label: r.fields['Name']||'—', price: r.fields['Rate']||0, ids: [r.id] }));
    }

    let cheapestTies = [];
    if (candidates.length) {
      const minPrice = Math.min(...candidates.map(c => c.price));
      cheapestTies = candidates.filter(c => Math.abs(c.price - minPrice) < 0.005);
    }

    _baselineDeleteState = { id, cat, rec, cheapestTies, selectedKey: cheapestTies[0]?.key || null };
    mqphRenderBaselineDeleteBody();
    document.getElementById('mqph-baseline-delete-overlay')?.classList.add('show');
  }

  function mqphRenderBaselineDeleteBody() {
    const s = _baselineDeleteState;
    const body = document.getElementById('mqph-baseline-delete-body');
    if (!s || !body) return;
    const catLabel = { material:'box material', door:'door style', hinge:'hinge' }[s.cat] || s.cat;
    const name = s.cat === 'material' ? (s.rec.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim() : (s.rec.fields['Name']||'—');

    if (!s.cheapestTies.length) {
      body.innerHTML = `
        <p style="font-size:13px;color:#374151;line-height:1.5;margin:0 0 1rem">
          "<strong>${name}</strong>" is your only ${catLabel} — it's currently your baseline. Deleting it will leave you with none, so your widget won't be able to quote any job until you add a new one.
        </p>`;
      return;
    }

    const hingeNote = s.cat === 'hinge' ? `
        <p style="font-size:12px;color:#6b7280;line-height:1.5;margin:0.5rem 0 0">
          Your baseline hinge is priced at exactly ${CUR()}0 (it's already folded into your baseline door price, not charged separately). Whichever you pick becomes the new ${CUR()}0 hinge, and every other hinge's price shifts to match so the actual price differences between them stay the same — you'll see a preview before anything changes.
        </p>` : '';

    body.innerHTML = `
      <p style="font-size:13px;color:#374151;line-height:1.5;margin:0 0 1rem">
        "<strong>${name}</strong>" is your baseline ${catLabel}. Deleting it, here's what becomes your new baseline${s.cheapestTies.length>1?' — pick one':''}:
      </p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:0.5rem">
        ${s.cheapestTies.map((c,i) => `
          <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;${i>0?'border-top:1px solid #e5e7eb':''}">
            <input type="radio" name="mqph-bl-pick" value="${c.key}" ${c.key===s.selectedKey?'checked':''} onchange="mqphSelectBaselineDeleteCandidate('${c.key}')" style="width:auto"/>
            <span style="flex:1;font-size:13px;color:#111">${c.label}</span>
            <span style="font-size:13px;color:#6b7280">${CUR()}${c.price.toFixed(2)}</span>
          </label>
        `).join('')}
      </div>
      <p style="font-size:12px;color:#9ca3af;line-height:1.5;margin:0.25rem 0 0">
        Want something cheaper to be the baseline instead? Cancel here, add it with the <strong>+ Add</strong> button, then delete "${name}" again.
      </p>
      ${hingeNote}`;
  }

  window.mqphSelectBaselineDeleteCandidate = function(key) {
    if (_baselineDeleteState) _baselineDeleteState.selectedKey = key;
  };

  window.mqphCloseBaselineDelete = function() {
    document.getElementById('mqph-baseline-delete-overlay')?.classList.remove('show');
    _baselineDeleteState = null;
  };

  window.mqphConfirmBaselineDelete = async function() {
    const s = _baselineDeleteState;
    if (!s) return;
    const picked = s.cheapestTies.find(c => c.key === s.selectedKey) || s.cheapestTies[0] || null;

    // Hinge rebalance preview — same math as the dead-but-correct
    // mqphSetAsBaseline above: shift EVERY hinge's Rate by the new
    // baseline's own pre-shift Rate, so it zeroes out and every other
    // hinge's price relative to it is unchanged, just re-anchored.
    // Per Jordan 2026-09-12: this alone isn't enough — every DOOR's own
    // stored Rate already has the OLD baseline hinge's real dollar value
    // baked into it (every door was quoted "box + this door + the
    // CURRENT baseline hinge" as one reference job — see
    // mqphEditRequoteSpec's door branch/the job-spec box wording), so
    // swapping which hinge is baseline without also moving doors would
    // leave every door quietly over- or under-priced by the real
    // difference between the old and new baseline hinge. `shift` here is
    // exactly that difference (the picked hinge's Rate relative to the
    // OLD baseline, same quantity used to zero out every other hinge —
    // see the identical derivation on the mini-wizard's own hinge branch
    // above, mqphMiniNext), so every door's Rate shifts by the same
    // amount, in the same direction hinge Rates shift the OPPOSITE way
    // (hinges: −shift, so they re-anchor to the new $0; doors: +shift,
    // so their price keeps reflecting this hinge's real cost instead of
    // the old one's).
    if (s.cat === 'hinge' && picked) {
      const catRows = lineItems.filter(r => r.fields && r.fields['Category'] === 'hinge' && r.id !== s.id);
      const doors = lineItems.filter(r => r.fields && r.fields['Category'] === 'door');
      const shift = picked.price || 0;
      if (shift !== 0) {
        const others = catRows.filter(h => h.id !== picked.key);
        const hingePreview = others.slice(0,2)
          .map(h => `${h.fields['Name']}: ${CUR()}${(h.fields['Rate']||0).toFixed(2)} → ${CUR()}${((h.fields['Rate']||0)-shift).toFixed(2)}`).join('\n');
        const doorPreview = doors.slice(0,2)
          .map(d => `${d.fields['Name']}: ${CUR()}${(d.fields['Rate']||0).toFixed(2)}/lin ft → ${CUR()}${(((d.fields['Rate']||0)+shift)).toFixed(2)}/lin ft`).join('\n');
        const ok = confirm(`Making "${picked.label}" the new baseline hinge (priced at ${CUR()}0, included) shifts every other hinge's price by ${CUR()}${shift.toFixed(2)} — nothing actually changes relative to each other, just re-anchored — AND shifts every door's price by the same amount, since your door prices were quoted assuming the OLD baseline hinge and need to stay accurate to this one's real cost.\n\nFor example:\n${hingePreview}${others.length>2?'\n…':''}\n${doorPreview}${doors.length>2?'\n…':''}\n\nContinue?`);
        if (!ok) return;
      }
    }

    document.getElementById('mqph-baseline-delete-overlay')?.classList.remove('show');
    try {
      // Same linked-crown/valance cleanup mqphDelete does for a normal
      // door delete — this flow bypasses that function entirely, so it
      // needs its own copy here.
      if (s.cat === 'door') {
        const doorName = s.rec.fields['Name'] || '';
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

      if (picked) {
        if (s.cat === 'hinge') {
          const shift = picked.price || 0;
          if (shift !== 0) {
            const catRows = lineItems.filter(r => r.fields && r.fields['Category'] === 'hinge' && r.id !== s.id);
            for (const h of catRows) {
              const newRate = Math.round(((h.fields['Rate']||0) - shift) * 100) / 100;
              try { await atUpdate(LINE_ITEMS_TABLE, h.id, {Rate:newRate}); } catch(e) { console.error('Failed to reprice hinge', h.id, e); }
            }
            // See the big comment above this function for why doors need
            // to move too, not just other hinges — same `shift` value,
            // opposite direction from the hinge rebalance just above.
            const doors = lineItems.filter(r => r.fields && r.fields['Category'] === 'door');
            for (const d of doors) {
              const newRate = Math.round(((d.fields['Rate']||0) + shift) * 100) / 100;
              try { await atUpdate(LINE_ITEMS_TABLE, d.id, {Rate:newRate}); } catch(e) { console.error('Failed to reprice door for new baseline hinge', d.id, e); }
            }
          }
        }
        // Old baseline row(s) get deleted below anyway (they're the ones
        // being removed), so there's nothing to explicitly unpin — just
        // pin the picked replacement.
        for (const rowId of picked.ids) {
          try { await atUpdate(LINE_ITEMS_TABLE, rowId, {'Is baseline': true}); } catch(e) { console.error('Failed to pin new baseline', e); }
        }
      }

      await atDelete(LINE_ITEMS_TABLE, s.id);
      if (s.cat === 'material') {
        // Material is two rows (uppers + bases) — delete the paired row too.
        const baseName = (s.rec.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim();
        const partner = lineItems.find(r => r.id !== s.id && r.fields && r.fields['Category'] === 'material' &&
          (r.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim() === baseName);
        if (partner) { try { await atDelete(LINE_ITEMS_TABLE, partner.id); } catch(e) {} }
      }
      _baselineDeleteState = null;
      await loadAndRender();
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
    // Requote (quote-a-job → back into the rate) is only wired up for
    // Material and Door so far — same math the "+ Add" mini-wizard already
    // uses for those two categories. Per Jordan 2026-09-10: Crown/Valance
    // are direct per-lin-ft rates shops already know off the top of their
    // head (no baseline math involved), so no requote helper needed there;
    // Hinge explicitly excluded too — no bulk edit for hinges at all.
    const toggleEl = document.getElementById('mqph-bulk-requote-toggle');
    if (toggleEl) toggleEl.innerHTML = (cat === 'material' || cat === 'door')
      ? `<a href="#" onclick="event.preventDefault();mqphBulkToggleRequote()" style="font-size:12px;color:#2563eb;text-decoration:none">🧮 Not sure of the price? Requote this job to calculate it →</a>`
      : '';
    const panelEl = document.getElementById('mqph-bulk-requote-panel');
    if (panelEl) { panelEl.style.display = 'none'; panelEl.innerHTML = ''; }
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
    // Selection changed underneath it — a Requote panel left open would be
    // quoting stale items, so collapse it rather than carry it forward.
    const panelEl = document.getElementById('mqph-bulk-requote-panel');
    if (panelEl) { panelEl.style.display = 'none'; panelEl.innerHTML = ''; }
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

  // Requote — Bulk Edit only, Material + Door. Same "quote a real job, we
  // back into the rate" math as the "+ Add" mini-wizard's material/door
  // steps (see miniWizContent/mqphMiniCalc/mqphMiniNext above) — reused
  // here rather than re-derived, per Jordan 2026-09-10: most shops don't
  // have their per-lin-ft upcharge reverse-engineered, but they do know
  // what they'd quote a customer for the equivalent job. The two Material
  // questions are shown together (not paginated into two steps like the
  // mini-wiz) since Bulk Edit's price fields already show Uppers + Bases
  // side by side. Result: fills the existing "New price" input(s) so the
  // shop owner sees the number before confirming — it never writes to
  // Airtable itself, mqphBulkApply() still owns that.
  function mqphBulkRequoteHTML() {
    const cat = _bulkEdit.cat;
    if (cat !== 'material' && cat !== 'door') return '';
    const bl = getBaselineRates();
    if (bl.blBasePrice <= 0) {
      return `<div style="font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 10px">⚠️ No baseline pricing found — run the pricing wizard first to use Requote.</div>`;
    }
    const selected = _bulkEdit.items.filter(it => _bulkEdit.checkedIds.has(it.id));
    const groupLabel = selected.length === 1 ? selected[0].label : `these ${selected.length} items`;

    if (cat === 'material') {
      return `
        <div style="font-size:12px;color:#6b7280;margin-bottom:10px;line-height:1.5">Quote these two jobs exactly like you would for a customer for ${groupLabel} — we'll work out the per-linear-foot rate.</div>
        <div class="mqph-item-block" style="margin-bottom:10px">
          ${specBox([
            `<strong>Upper cabinets — box only, no doors</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} upper</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} upper</span> = 4 lin ft ${mqphMmTag(48)}`,
            `No doors · Supply only · Local delivery`,
          ])}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-bulk-rq-p0" placeholder="0.00" oninput="mqphBulkRequoteCalc()"/></div>
          <div id="mqph-bulk-rq-r0" class="mqph-result"></div>
        </div>
        <div class="mqph-item-block" style="margin-bottom:10px">
          ${specBox([
            `<strong>Base cabinets — box only, no doors</strong>`,
            `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
            `No doors · Supply only · Include toe kick`,
          ])}
          <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-bulk-rq-p1" placeholder="0.00" oninput="mqphBulkRequoteCalc()"/></div>
          <div id="mqph-bulk-rq-r1" class="mqph-result"></div>
        </div>
        <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" style="width:100%" onclick="mqphBulkRequoteApply()">Use these prices ↑</button>`;
    }

    // door
    const baselineBoxDesc = `${CUR()}${bl.blBasePrice.toLocaleString()} (your ${bl.blMatName} base box price)`;
    return `
      <div class="mqph-item-block" style="margin-bottom:10px">
        <div style="font-size:12px;color:#6b7280;margin-bottom:8px;line-height:1.5">Quote the baseline base box job with ${groupLabel} added — we'll work out the upcharge.</div>
        ${specBox([
          `<strong>Base cabinets + door style</strong>`,
          `Cabinets: <span class="mqph-spec-tag">1 × 30" ${mqphMmTag(30)} base</span> + <span class="mqph-spec-tag">1 × 18" ${mqphMmTag(18)} base</span> = 4 lin ft ${mqphMmTag(48)}`,
          `Material: <span class="mqph-spec-tag">${bl.blMatName}</span> · Door: <span class="mqph-spec-tag">${groupLabel}</span>`,
          `<span class="mqph-spec-tag">3 doors: 2 on 30" ${mqphMmTag(30)}, 1 on 18" ${mqphMmTag(18)}</span> · Hinges: <span class="mqph-spec-tag">${bl.blHingeName||'baseline hinge'}</span> · No drawers · Supply only · Include toe kick`,
        ])}
        <div class="mqph-input-row"><label>Your total price for this job?</label><span class="mqph-pfx">${CUR()}</span><input type="number" id="mqph-bulk-rq-p0" placeholder="0.00" oninput="mqphBulkRequoteCalc()"/></div>
        <p class="mqph-calc-hint">We'll subtract ${baselineBoxDesc} and divide by 4 to get the door upcharge per lin ft</p>
        <div id="mqph-bulk-rq-r0" class="mqph-result"></div>
      </div>
      <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" style="width:100%" onclick="mqphBulkRequoteApply()">Use this price ↑</button>`;
  }

  window.mqphBulkToggleRequote = function() {
    const panel = document.getElementById('mqph-bulk-requote-panel');
    if (!panel) return;
    const willShow = panel.style.display === 'none' || !panel.style.display;
    if (willShow) {
      panel.innerHTML = mqphBulkRequoteHTML();
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
  };

  window.mqphBulkRequoteCalc = function() {
    const cat = _bulkEdit.cat;
    const bl = getBaselineRates();
    const reveal = (idx, rate) => {
      const el = document.getElementById(`mqph-bulk-rq-r${idx}`);
      if (!el) return;
      el.textContent = (rate !== null && !isNaN(rate)) ? `${CUR()}${rate.toFixed(2)} / lin ft` : '';
    };
    if (cat === 'material') {
      const p0 = parseFloat(document.getElementById('mqph-bulk-rq-p0')?.value || 0);
      const p1 = parseFloat(document.getElementById('mqph-bulk-rq-p1')?.value || 0);
      reveal(0, p0 > 0 ? p0 / 4 : null);
      reveal(1, p1 > 0 ? p1 / 4 : null);
    }
    if (cat === 'door') {
      const p0 = parseFloat(document.getElementById('mqph-bulk-rq-p0')?.value || 0);
      reveal(0, p0 > 0 ? (p0 - bl.blBasePrice) / 4 : null);
    }
  };

  // Fills the already-rendered "New price" input(s) with the computed
  // rate(s) and collapses back down — mqphBulkApply() (the actual write)
  // is untouched, so the shop owner still confirms via the normal button.
  window.mqphBulkRequoteApply = function() {
    const cat = _bulkEdit.cat;
    const bl = getBaselineRates();
    if (cat === 'material') {
      const p0 = parseFloat(document.getElementById('mqph-bulk-rq-p0')?.value || 0);
      const p1 = parseFloat(document.getElementById('mqph-bulk-rq-p1')?.value || 0);
      if (!(p0 > 0) || !(p1 > 0)) { alert('Enter a total price for both jobs first.'); return; }
      const upperRate = Math.round((p0/4)*100)/100;
      const baseRate  = Math.round((p1/4)*100)/100;
      const inp0 = document.getElementById('mqph-bulk-newprice-0');
      const inp1 = document.getElementById('mqph-bulk-newprice-1');
      if (inp0) inp0.value = upperRate.toFixed(2);
      if (inp1) inp1.value = baseRate.toFixed(2);
    } else if (cat === 'door') {
      const p0 = parseFloat(document.getElementById('mqph-bulk-rq-p0')?.value || 0);
      if (!(p0 > 0)) { alert('Enter a total price for the job first.'); return; }
      const rate = Math.round(((p0 - bl.blBasePrice)/4)*100)/100;
      const inp0 = document.getElementById('mqph-bulk-newprice-0');
      if (inp0) inp0.value = rate.toFixed(2);
    }
    const panel = document.getElementById('mqph-bulk-requote-panel');
    if (panel) panel.style.display = 'none';
  };

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
  //
  // Default (before a shop owner clicks a column header) is alphabetical
  // by name — per Jordan 2026-09-11, reversing the 2026-09-10 price-first
  // default: with a lot going on on this page, A→Z is the more findable
  // starting order than cheapest-first. `MQPH_DEFAULT_SORT` is that
  // starting state; "Sort order" (the original custom/import order) is
  // still reachable as a 3rd click, same as before.
  const MQPH_DEFAULT_SORT = {field:'name', dir:'asc'};
  let _mqphSortState = {}; // cat -> {field:'default'|'name'|'price', dir:'asc'|'desc'} — unset means MQPH_DEFAULT_SORT
  function mqphSortRecs(cat, recs) {
    const state = _mqphSortState[cat] || MQPH_DEFAULT_SORT;
    const sorted = [...recs];
    if (state.field === 'name') sorted.sort((a,b) => (a.fields['Name']||'').localeCompare(b.fields['Name']||''));
    else if (state.field === 'price') sorted.sort((a,b) => (a.fields['Rate']||0) - (b.fields['Rate']||0));
    else sorted.sort((a,b) => (a.fields['Sort order']||0) - (b.fields['Sort order']||0));
    if (state.dir === 'desc') sorted.reverse();
    return sorted;
  }
  function mqphSortArrow(cat, field) {
    const state = _mqphSortState[cat] || MQPH_DEFAULT_SORT;
    if (state.field !== field) return '<span style="opacity:0.35">↕</span>';
    return state.dir === 'asc' ? '↑' : '↓';
  }
  // Which column is actually driving the current sort gets called out in
  // color (not just the ↑/↓ vs ↕ arrow, which is easy to miss at a glance
  // on a busy page) — per Jordan 2026-09-11 ("highlight the method thats
  // currently being used for sorting"). Reuses the same blue already used
  // for links/active state elsewhere in this file (e.g. the default-chip
  // and re-run-wizard link), so it reads as "active" rather than an error.
  function mqphSortLabelStyle(cat, field) {
    const state = _mqphSortState[cat] || MQPH_DEFAULT_SORT;
    return state.field === field ? 'color:#1d4ed8' : '';
  }
  window.mqphSetSort = function(cat, field) {
    const current = _mqphSortState[cat] || MQPH_DEFAULT_SORT;
    if (current.field === field) {
      // 3rd click cycles back to the items' original custom/import order —
      // asc, then desc, then back to normal, without needing a dedicated
      // "Order" label taking up space of its own.
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
    // Each island panel style card's % preview box only ever gets filled
    // in by that card's own price inputs' oninput/onchange — it was never
    // run once on render, so opening this section with styles already
    // saved showed blank boxes instead of the actual saved ratios (Jordan
    // 2026-10-03 screenshot, originally reported against the old single-
    // ratio version of this section). Populate every style's box the
    // moment the section opens.
    if (opening && cat === 'islandpanel') mqphRecalcAllIslandStylePcts();
  };
  // Re-applies whichever sections were open before the last rebuild —
  // called right after buildEditorHTML() replaces the page's innerHTML.
  function mqphRestoreExpandedCats() {
    _mqphExpandedCats.forEach(cat => {
      const body = document.getElementById(`mqph-cat-body-${cat}`);
      const arrow = document.getElementById(`mqph-cat-arrow-${cat}`);
      if (body) body.style.display = 'block';
      if (arrow) arrow.style.transform = 'rotate(90deg)';
      // Same blank-box fix as mqphToggleCategory, for the case where the
      // section is being re-opened automatically after a rebuild (e.g.
      // right after saving a style, or after a door-tagging toggle) rather
      // than by a fresh click.
      if (cat === 'islandpanel') mqphRecalcAllIslandStylePcts();
    });
  }

  window.mqphToggle = async function(id, el) {
    const rec = lineItems.find(r=>r.id===id); if(!rec) return;
    const val = !rec.fields['Active'];
    // Turning an item OFF drops it from pricing exactly the same way
    // deleting it does (getByCategory()/getBaselineRates() both filter
    // out Active===false rows) — but bypasses every safety net built
    // for Delete (the install cascade-warning, the baseline material/
    // door/hinge picker). Per Jordan 2026-09-12 ("we shouldnt let them
    // toggle off any install items... that would be the same as kindof
    // deleting them"), block turning OFF (not on) for:
    //  - any Installation & Removal rate — the widget needs the
    //    complete set of 7 to price every job type; Delete (which
    //    cascades and offers the Requote flow) is the safe path.
    //  - whichever material/door/hinge row is the CURRENTLY PINNED
    //    baseline — same reasoning as the active baseline-delete flow
    //    above: silently dropping it out of getBaselineRates() by
    //    toggling it off would fall back to Sort order with no warning
    //    and no picker, exactly the bug that flow exists to prevent. A
    //    non-baseline material/door/hinge row can still be toggled off
    //    freely — this only blocks the one row currently defining the
    //    reference price for its category.
    if (!val) {
      if (rec.fields['Category'] === 'install') {
        alert("Installation & removal rates can't be turned off individually — the widget needs the complete set of 7 to price every job type accurately. Use Delete instead (it'll warn you and offer to requote the whole set).");
        return;
      }
      if (rec.fields['Is baseline'] && ['material','door','hinge'].includes(rec.fields['Category'])) {
        alert("This is your current baseline — every other price in this category is calculated relative to it, so it can't be turned off. Use Delete instead, which will let you pick what becomes the new baseline first.");
        return;
      }
    }
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

  // One-time-per-shop backfill for the explicit "Is baseline" pin (see the
  // big comment above getBaselineRates() for why this exists). For each of
  // material/door/hinge: if nothing in that category is pinned yet, look
  // for the row(s) whose Description carries the exact marker text the
  // Pricing Setup Wizard writes only on its baseline rows, and pin those.
  // If a category has no such marker (shop never ran the wizard) or
  // already has a pin (already migrated, or a shop owner set one manually
  // via ⭐ Set as baseline), it's left alone — getBaselineRates() keeps
  // falling back to Sort order for anything unpinned, so this can only
  // ever correct a category, never change one that was already fine.
  const BASELINE_MARKERS = { material:'Baseline box rate', door:'Baseline door style', hinge:'Baseline hinge' };
  async function migrateBaselinePins() {
    for (const cat of Object.keys(BASELINE_MARKERS)) {
      const rows = lineItems.filter(r => r.fields && r.fields['Category'] === cat);
      if (rows.some(r => r.fields['Is baseline'])) continue; // already pinned — never overwrite
      const marker = BASELINE_MARKERS[cat];
      const candidates = rows.filter(r => (r.fields['Description']||'').startsWith(marker));
      if (!candidates.length) continue; // no wizard-baseline marker found — leave unpinned, falls back to Sort order
      for (const rec of candidates) {
        try {
          await atUpdate(LINE_ITEMS_TABLE, rec.id, {'Is baseline': true});
          rec.fields['Is baseline'] = true;
        } catch(e) { /* non-fatal — leave this row to migrate next load */ }
      }
    }
  }

  // Lets a shop owner explicitly re-pin baseline themselves (⭐ button next
  // to each material/door/hinge row) instead of needing a dev fix if it
  // ever drifts again. For material, both the "— uppers" and "— bases"
  // rows of the chosen material are pinned together (and the old
  // baseline's rows, if any, are unpinned) since a material's baseline
  // status is really about the material as a whole, not one row of it.
  //
  // Material and door are safe to just re-pin with no other changes:
  // every material's Rate is its own independent, absolute box price (not
  // stored relative to baseline at all), and every door style's Rate is
  // an upcharge over a bare box (also independent of which door happens
  // to be pinned baseline) — so no other row's Rate needs to move.
  //
  // Hinge is genuinely different, and this is the one category where
  // Jordan was right to ask "won't this need to realign everything?":
  // the baseline hinge's Rate is hard-set to 0 by the wizard (its cost is
  // already folded into the baseline door/box price, so it's "included,"
  // not charged separately — see the wizard's Step 5 push, `rate:0`), and
  // every OTHER hinge's Rate is an upcharge over that $0. Just moving the
  // pin without touching Rate would leave the OLD baseline hinge stuck at
  // $0 forever (customers would get it for free) and the NEW baseline
  // hinge stuck at its old nonzero upcharge (customers would still get
  // charged for the "included" hinge) — so every hinge's Rate is shifted
  // by the new baseline's own (pre-shift) Rate: that zeroes out the new
  // baseline and preserves the actual price relationships between every
  // hinge exactly as they were, just re-anchored to the new $0 point.
  window.mqphSetAsBaseline = async function(cat, recId) {
    const rec = lineItems.find(r => r.id === recId);
    if (!rec) return;
    const catRows = lineItems.filter(r => r.fields && r.fields['Category'] === cat);
    let newBaselineRows;
    if (cat === 'material') {
      const baseName = (rec.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim();
      newBaselineRows = catRows.filter(r => (r.fields['Name']||'').replace(/\s*—\s*(uppers|bases)\s*$/i,'').trim() === baseName);
    } else {
      newBaselineRows = [rec];
    }

    if (cat === 'hinge') {
      const shift = rec.fields['Rate'] || 0;
      if (shift !== 0) {
        const preview = catRows.filter(h => h.id !== rec.id).slice(0,3)
          .map(h => `${h.fields['Name']}: ${CUR()}${(h.fields['Rate']||0).toFixed(2)} → ${CUR()}${(((h.fields['Rate']||0)-shift)).toFixed(2)}`).join('\n');
        const ok = confirm(`"${rec.fields['Name']}" currently costs ${CUR()}${shift.toFixed(2)}/ft more than your current baseline hinge. Making it the new baseline means it becomes the "included, no extra charge" hinge — so every hinge's price shifts by ${CUR()}${shift.toFixed(2)}/ft to keep the actual price differences between hinges the same.\n\nFor example:\n${preview}${catRows.length>4?'\n…':''}\n\nContinue?`);
        if (!ok) return;
        for (const h of catRows) {
          const newRate = Math.round(((h.fields['Rate']||0) - shift) * 100) / 100;
          try { await atUpdate(LINE_ITEMS_TABLE, h.id, {Rate:newRate}); h.fields['Rate'] = newRate; }
          catch(e) { console.error('Failed to reprice hinge', h.id, e); }
        }
      }
    }

    const toUnpin = catRows.filter(r => r.fields['Is baseline'] && !newBaselineRows.some(nb => nb.id === r.id));
    try {
      for (const r of toUnpin) { await atUpdate(LINE_ITEMS_TABLE, r.id, {'Is baseline': false}); r.fields['Is baseline'] = false; }
      for (const r of newBaselineRows) { await atUpdate(LINE_ITEMS_TABLE, r.id, {'Is baseline': true}); r.fields['Is baseline'] = true; }
    } catch(e) { console.error('Failed to update baseline pin', e); }
    await loadAndRender();
  };

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
         <div${items.length > 10 ? ' style="max-height:450px;overflow-y:auto"' : ''}>${items.map(rowFn).join('')}</div>`
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
      <div class="mqph-ct-block" id="mqph-scope-countertop">
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
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">
              <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem">Removal rate</div>
              <div style="font-size:11px;color:#6b7280;margin-bottom:0.75rem">What to charge to remove &amp; dispose of an existing countertop in THIS material — granite removal can cost more than laminate. Customers can opt into this per surface in the widget, right after choosing supply or supply + install. Leave at 0 to not offer removal for this material.</div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span style="font-size:13px;color:#6b7280">${CUR()}</span>
                <input type="number" id="mqph-ct-removal-rate" placeholder="0.00" step="0.01" style="width:100px;text-align:right;font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px"/>
                <span style="font-size:13px;color:#6b7280">per</span>
                <select id="mqph-ct-removal-unit" style="font-family:inherit;font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:7px 10px">
                  <option value="sqft">sqft</option><option value="lin ft">lin ft</option>
                </select>
                ${mqphRateCalcIconHTML('mqph-ct-removal-rate', 'mqph-ct-removal-unit')}
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
      ${items.length > 0 ? `<div${items.length > 10 ? ' style="max-height:450px;overflow-y:auto"' : ''}>${items.map(trimRow).join('')}</div>` : `<div style="padding:1rem 16px;font-size:13px;color:#9ca3af">${emptyMsg}</div>`}`;

    return `
      <div class="mqph-ct-block" id="mqph-scope-trim">
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
      <div class="mqph-ct-block" id="mqph-scope-tallcab">
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

  // Island panel pricing — one entry PER DOOR STYLE GROUP (e.g. "Shaker",
  // "Raised panel"), not a single shop-wide ratio. Reworked 2026-10-03 per
  // Jordan: the original single shop-wide ratio (one reference door, one %
  // applied against whatever door the customer picked) correctly captured
  // SPECIES price differences — a maple flat panel really is cheaper than
  // a rift oak or hickory one, and that should scale with whichever door's
  // rate the customer picks — but it also incorrectly captured STYLE/
  // profile differences (shaker vs. raised panel) that a flat panel has
  // nothing to do with: a flat panel costs the same regardless of whether
  // the box doors are $183/ft shaker or $270/ft raised panel, so charging
  // it as one flat % of whichever door rate happened to be selected badly
  // overcharged on pricier styles and undercharged on cheaper ones.
  //
  // Fix: shops define their own named style groups (shop-typed labels —
  // never shown to the customer), each independently calibrated against
  // its OWN reference door exactly the way the old single ratio worked,
  // and every real door line item gets tagged to exactly one group (Line
  // Items' `Island panel style` field, holding that style's id — see
  // mqphToggleIslandStyleDoor below). At quote time the widget looks up
  // which style the customer's CHOSEN door belongs to and applies THAT
  // style's %, still against the chosen door's own rate (same mechanism
  // as before — see calcCabinet's islandPanelCost in widget.js/
  // widgetpro.js) — so species differences within one style group keep
  // scaling correctly, while style/profile differences are now handled by
  // using an entirely different %, never the same one across groups.
  //
  // A door that isn't tagged to any style gets $0 panel upcharge (box +
  // install still price normally) rather than guessing — Jordan 2026-10-03:
  // new shops add doors before they'd ever get to this section, so
  // untagged has to be a safe, unsurprising default, not an error. The
  // section's collapsed-header summary surfaces untagged doors instead of
  // hiding the gap (see buildIslandPanelHtml below).
  //
  // Stored as an array directly on the Shop record ('Island panel styles')
  // — same one-off JSON-on-Shop pattern as before (Room types, Hidden
  // widget tabs, etc. in dashboard.js), just an array of style configs
  // instead of a single one. Replaces the retired 'Island panel pricing'
  // field (single shop-wide config) and the retired per-door 'Hide
  // decorative island panel' checkbox entirely — both fields are left
  // unused in Airtable (harmless; no shop had actually used either one
  // yet when this was reworked).
  function getIslandPanelStyles() {
    try {
      const arr = shopRecord.fields['Island panel styles'] ? JSON.parse(shopRecord.fields['Island panel styles']) : [];
      return Array.isArray(arr) ? arr : [];
    } catch(e) { return []; }
  }

  async function saveIslandPanelStylesArray(styles) {
    await atUpdate(SHOPS_TABLE, shopRecord.id, { 'Island panel styles': JSON.stringify(styles) });
    shopRecord.fields['Island panel styles'] = JSON.stringify(styles);
  }

  // Panel INSTALL prices (Jordan 2026-10-04): install labour is the same no
  // matter which door style a panel goes on, so there are exactly TWO shop-
  // wide numbers — one for installing a flat panel, one for a decorative
  // panel (furniture kick install included) — each quoted per 24" × 34.5"
  // panel, same as the panel price itself. Deliberately NOT part of any
  // style (an earlier version asked for it again on every style card).
  // Stored as JSON {flat, decorative} in the Shops table's 'Island panel
  // install rates' field (Long text). Blank/missing = $0 (optional).
  function getIslandInstallRates() {
    try {
      const o = shopRecord.fields['Island panel install rates'] ? JSON.parse(shopRecord.fields['Island panel install rates']) : {};
      return { flat: parseFloat(o.flat) || 0, decorative: parseFloat(o.decorative) || 0 };
    } catch(e) { return { flat: 0, decorative: 0 }; }
  }
  window._mqIslandInstallPending = window._mqIslandInstallPending || null;

  // Badge shown next to a door's name in the Door Styles catalog list,
  // reflecting which island panel style (if any) it's tagged to — replaces
  // the old 🎨 "Decorative panel" badge, which tracked the retired
  // per-door Hide-decorative checkbox instead of a style tag.
  function mqphDoorStyleBadgeHtml(doorRec) {
    const tag = doorRec.fields['Island panel style'];
    if (!tag) return '';
    const style = getIslandPanelStyles().find(s => s.id === tag);
    if (!style) return '';
    const safeName = (style.name||'').replace(/"/g,'&quot;');
    return ` <span title="Tagged to the &quot;${safeName}&quot; island panel style${style.offersDecorative?' — offers decorative panels':''}" style="font-size:11px;font-weight:600;color:#1d4ed8">🏝️ ${style.name}${style.offersDecorative?' 🎨':''}</span>`;
  }

  // In-memory-only styles from "+ Add a door style" that haven't been
  // saved yet — lost on reload, same as any other unsaved draft in this
  // app (e.g. the tall-cabinet wizard), which is fine since nothing's
  // actually committed until its own Save button is clicked.
  window._mqIslandDraftStyles = window._mqIslandDraftStyles || [];
  // Whatever's currently typed into a style card's inputs, BEFORE that
  // card is saved — keyed by style id (draft or already-saved), kept
  // separate from both the saved array and the draft list so a re-render
  // triggered by an unrelated action elsewhere on the page (e.g. tagging a
  // door under a DIFFERENT style's card) never wipes out in-progress
  // typing in this one.
  window._mqIslandPendingEdits = window._mqIslandPendingEdits || {};
  // Per-style door-tagging list UI state (search text + sort choice) —
  // view-only, never saved to Airtable.
  window._mqIslandTagUi = window._mqIslandTagUi || {};
  // Which already-saved styles are explicitly pinned open — Jordan
  // 2026-10-03: "once a style is saved, it can auto collapse. so that its
  // not a big mess." A card collapses to a one-line summary the instant
  // it's saved-and-clean; clicking it (or its Edit button) adds its id
  // here to force it back open. View-only, never saved to Airtable — a
  // fresh page load shows every already-saved style collapsed again,
  // same as any other UI-only state in this section.
  window._mqIslandExpandedStyles = window._mqIslandExpandedStyles || new Set();
  // One-shot flag: set right when a door-tagging toggle is the one that
  // takes the untagged-door count from >0 to 0, consumed (reset to false)
  // the very next time buildIslandPanelHtml renders, so the "✅ All doors
  // tagged!" banner shows exactly once per transition rather than on every
  // re-render afterward. The permanent header summary (see
  // buildIslandPanelHtml) updates separately and stays updated regardless
  // of this flag — Jordan 2026-10-03: "i think both. it will flash and
  // then after the flash will show up in the header right after."
  window._mqIslandJustCompletedFlash = window._mqIslandJustCompletedFlash || false;
  // Whether the "How island panel pricing works" explanation is expanded —
  // Jordan 2026-10-03 wanted the description collapsible, same declutter
  // reasoning as the style cards auto-collapsing. Collapsed by default
  // (view-only, never saved to Airtable, same as every other UI-only flag
  // in this section) so a shop that's already set this up once isn't
  // staring at a wall of explanation text every time they open the
  // section — one click brings it back for a shop that needs the refresher.
  window._mqIslandInfoExpanded = window._mqIslandInfoExpanded || false;

  // Shops quote a flat price for a finished 24"×34.5" panel (the size we
  // tell them to use) rather than a $/lin ft rate directly — most shops
  // think in flat per-panel quotes, not linear-foot rates, for a one-off
  // comparison piece like this. 24" wide = 2 linear feet, so we reverse-
  // engineer that flat quote into a $/lin ft rate (÷2) before comparing it
  // to the reference door's own $/lin ft rate to get the ratio (Jordan
  // 2026-10-01).
  const ISLAND_PANEL_WIDTH_FT = 2; // 24" panel width ÷ 12 = 2 linear feet

  // Doors eligible to show in ONE style's tagging list: untagged doors
  // (never tagged, or tagged to a style that's since been removed) plus
  // whatever's already tagged to THIS style (so the shop can review/untag
  // it). Doors tagged to any OTHER still-existing style are fully
  // excluded — Jordan 2026-10-03: "when a door has been selected for one
  // style then it wont show in the list for the other styles."
  // Looks up a style's current record wherever it actually lives right
  // now — the saved array, or (if it hasn't been saved yet) the draft
  // list. Used by code that needs a style's last-saved fields (e.g. its
  // decorative-ratio mode) outside of mqphIslandStyleCardHtml, which gets
  // `style` handed to it directly.
  function mqphGetStyleRecord(styleId) {
    return getIslandPanelStyles().find(s => s.id === styleId) || window._mqIslandDraftStyles.find(s => s.id === styleId) || null;
  }

  // Other SAVED styles a style can mirror its decorative ratio from —
  // Jordan 2026-10-03: "since the ratio for decorative panels should be
  // fairly consistent across the styles... lets give them the option...
  // to just use the same decorative ratio as whatever styles have a
  // ratio." Deliberately only looks at the saved array (never drafts or
  // in-progress typing) so the number being copied is a committed one,
  // not something that could still change before its own card is saved.
  function mqphEligibleDecorativeSources(styleId) {
    return getIslandPanelStyles().filter(s => s.id !== styleId && s.offersDecorative === true && s.decorativePct != null);
  }

  function mqphStyleDoorPool(styleId) {
    const allDoors = getByCategory('door');
    const savedIds = new Set(getIslandPanelStyles().map(s => s.id));
    return allDoors.filter(d => {
      const tag = d.fields['Island panel style'];
      if (!tag) return true;
      if (tag === styleId) return true;
      return !savedIds.has(tag);
    });
  }

  // Runs `fn` over `items` a few at a time with a short pause between
  // batches, instead of one giant Promise.all — Airtable's REST API caps
  // out around 5 requests/second per base, and Jordan 2026-10-03 mentioned
  // a shop with ~180 doors in a single group, which would blow well past
  // that if fired all at once (the writes would just start failing with
  // 429s, invisibly, since the old single Promise.all in
  // mqphRemoveIslandStyle's untag-on-remove had the exact same latent
  // issue — fixed alongside this for the same reason). Promise.allSettled
  // per batch so one failure doesn't abort the rest; returns the items
  // whose write failed so the caller can roll back just those.
  async function mqphThrottledBatch(items, fn, batchSize = 5, delayMs = 1100) {
    const failed = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(fn));
      results.forEach((r, j) => { if (r.status === 'rejected') failed.push(batch[j]); });
      if (i + batchSize < items.length) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return failed;
  }

  // Door groups (the shop's own "Group name" field, same one bulk-add
  // uses — see mqphToggleMiniBulk) that have at least one door left to
  // tag to THIS style, scoped to the normal tagging pool (so a group
  // entirely tagged to a DIFFERENT style never shows up as taggable here).
  // Jordan 2026-10-03: "it would be for it to also pay attention to if
  // there are any door groups made and then instead of clicking every door
  // that applies to a style they can just apply it to a whole group...
  // because my one shop has like 180 doors in one group... if no groups
  // exist then it just wont show the option."
  function mqphStyleDoorGroupsInPool(styleId) {
    const pool = mqphStyleDoorPool(styleId);
    const counts = {};
    pool.forEach(d => {
      if (d.fields['Island panel style'] === styleId) return; // already tagged here -- nothing left to do for it
      const g = (d.fields['Group name'] || '').trim();
      if (g) counts[g] = (counts[g] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }

  function mqphBuildStyleDoorListHtml(styleId) {
    const pool = mqphStyleDoorPool(styleId);
    const ui = window._mqIslandTagUi[styleId] || { query:'', sortBy:'name', sortDir:'asc' };
    const q = (ui.query||'').toLowerCase();
    const filtered = pool.filter(d => !q || (d.fields['Name']||'').toLowerCase().includes(q));
    filtered.sort((a,b) => {
      const dir = ui.sortDir === 'asc' ? 1 : -1;
      if (ui.sortBy === 'price') return dir * ((a.fields['Rate']||0) - (b.fields['Rate']||0));
      return dir * (a.fields['Name']||'').localeCompare(b.fields['Name']||'');
    });
    if (!filtered.length) return `<div style="padding:10px 2px;font-size:12px;color:#9ca3af">${pool.length ? 'No doors match that search.' : 'No doors available — every door is already tagged to a style.'}</div>`;
    return filtered.map(d => `
      <label style="display:flex;align-items:center;gap:10px;padding:7px 2px;border-bottom:1px solid #f3f4f6;font-size:13px;cursor:pointer">
        <input type="checkbox" ${d.fields['Island panel style']===styleId?'checked':''} onchange="mqphToggleIslandStyleDoor('${styleId}','${d.id}',this.checked)" style="width:auto;flex-shrink:0"/>
        <span style="flex:1">${d.fields['Name']||'—'}</span>
        <span style="color:#9ca3af">${CUR()}${(d.fields['Rate']||0).toLocaleString()}/lin ft</span>
      </label>`).join('');
  }

  function mqphIslandStyleCardHtml(style, isSaved, allDoors) {
    const pending = window._mqIslandPendingEdits[style.id] || {};
    const name = pending.name !== undefined ? pending.name : (style.name || '');
    const refDoorId = pending.refDoorId !== undefined ? pending.refDoorId : (style.refDoorId || '');
    const panelCostVal = pending.panelFlatQuote !== undefined ? pending.panelFlatQuote : (style.panelFlatQuote != null ? style.panelFlatQuote : '');
    // Legacy styles saved before this flag existed never had a choice to
    // make, so missing/undefined defaults to true (flat offered) — only an
    // EXPLICIT false turns it off. Jordan 2026-10-03: "some shops may be so
    // fancy that they dont offer flat, so just as easy for them to not
    // offer flat as an option as well."
    const offersFlat = pending.offersFlat !== undefined ? pending.offersFlat : (style.offersFlat !== false);
    const offersDecorative = pending.offersDecorative !== undefined ? pending.offersDecorative : !!style.offersDecorative;
    const decCostVal = pending.decorativeFlatQuote !== undefined ? pending.decorativeFlatQuote : (style.decorativeFlatQuote != null ? style.decorativeFlatQuote : '');
    const decorativeRatioMode = pending.decorativeRatioMode !== undefined ? pending.decorativeRatioMode : (style.decorativeRatioMode || 'manual');
    const decorativeCopySourceId = pending.decorativeCopySourceId !== undefined ? pending.decorativeCopySourceId : (style.decorativeCopySourceId || '');
    // Saved-and-unedited is the only state the green "saved" button shows
    // for — any pending edit (even one not yet reflected in `style` itself,
    // e.g. mid-typing) flips it back, same spirit as the old single-ratio
    // form's mqphResetIslandSaveBtn (Jordan 2026-10-01: wanted the button
    // itself to confirm a save happened).
    const isDirty = !isSaved || Object.keys(pending).length > 0;
    const taggedCount = allDoors.filter(d => d.fields['Island panel style'] === style.id).length;

    // Collapsed view — any already-saved style that isn't currently being
    // edited renders as a one-line summary instead of the full form, so a
    // shop with several styles isn't staring at a wall of inputs (Jordan
    // 2026-10-03: "once a style is saved, it can auto collapse. so that
    // its not a big mess."). Saving a style clears it from
    // _mqIslandExpandedStyles (see mqphSaveIslandStyle), which is what
    // makes it collapse right after; clicking the row (or its own Edit
    // button) re-adds it, which also makes it dirty-safe since typing
    // anything immediately keeps isDirty true regardless of that set.
    const isExpanded = isDirty || window._mqIslandExpandedStyles.has(style.id);
    if (!isExpanded) {
      const panelPctText = style.offersFlat === false ? 'flat not offered' : (style.panelPct != null ? `${Math.round(style.panelPct*10)/10}% panels` : '— panels');
      const decText = (style.offersDecorative && style.decorativePct != null) ? ` · ${Math.round(style.decorativePct*10)/10}% decorative` : '';
      const safeName = (style.name || 'Untitled style').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:10px;background:#f9fafb;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="mqphToggleIslandStyleCollapse('${style.id}')">
        <span style="flex:1;font-weight:600;font-size:13px;color:#111827">✓ ${safeName}</span>
        <span style="font-size:12px;color:#6b7280">${taggedCount} door${taggedCount===1?'':'s'} tagged · ${panelPctText}${decText}</span>
        <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="event.stopPropagation();mqphToggleIslandStyleCollapse('${style.id}')">Edit</button>
        <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="event.stopPropagation();mqphRemoveIslandStyle('${style.id}',true)">🗑</button>
      </div>`;
    }

    const doorOpts = allDoors.map(d => `<option value="${d.id}" ${refDoorId===d.id?'selected':''}>${d.fields['Name']} (${CUR()}${(d.fields['Rate']||0).toLocaleString()}/lin ft)</option>`).join('');
    const ui = window._mqIslandTagUi[style.id] || { query:'', sortBy:'name', sortDir:'asc' };
    // Other saved styles whose decorative ratio this one could mirror —
    // only offered once at least one OTHER style actually has one (Jordan
    // 2026-10-03: "after the first style that created a decorative panel
    // ratio, for the next styles... give them the option").
    const decSources = mqphEligibleDecorativeSources(style.id);
    // Door groups with something left to tag here — only shown at all if
    // at least one exists, per Jordan 2026-10-03: "if no groups exist then
    // it just wont show the option."
    const taggableGroups = mqphStyleDoorGroupsInPool(style.id);

    return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:14px;background:#fff">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <input type="text" id="mqph-style-${style.id}-name" placeholder="Style name (e.g. Shaker) — internal only, customers never see this" value="${name.replace(/"/g,'&quot;')}" oninput="mqphSetIslandStyleField('${style.id}','name',this.value)" style="flex:1;font-weight:600;font-size:14px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px"/>
        ${isSaved ? `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqphToggleIslandStyleCollapse('${style.id}')">▲ Collapse</button>` : ''}
        <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqphRemoveIslandStyle('${style.id}',${isSaved})">${isSaved ? '🗑 Remove style' : '✕ Discard'}</button>
      </div>
      <div class="mqph-field"><label>Compare against door style</label>
        <select id="mqph-style-${style.id}-refdoor" onchange="mqphSetIslandStyleField('${style.id}','refDoorId',this.value);mqphCalcStylePanelPct('${style.id}')">
          <option value="">— pick a door —</option>${doorOpts}
        </select>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin:10px 0">
        <input type="checkbox" id="mqph-style-${style.id}-offersflat" ${offersFlat?'checked':''} onchange="mqphSetIslandStyleField('${style.id}','offersFlat',this.checked)" style="width:auto"/>
        This door style offers flat panels
      </label>
      ${offersFlat ? `
      <div class="mqph-field mqph-field-inline"><label>Price you'd charge for a 24" × 34.5" finished flat panel in this style's material</label>
        <input type="number" id="mqph-style-${style.id}-panelcost" step="0.01" placeholder="0.00" value="${panelCostVal}" oninput="mqphSetIslandStyleField('${style.id}','panelFlatQuote',this.value);mqphCalcStylePanelPct('${style.id}')"/>
      </div>
      </div>` : ''}
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin:10px 0">
        <input type="checkbox" id="mqph-style-${style.id}-offersdec" ${offersDecorative?'checked':''} onchange="mqphSetIslandStyleField('${style.id}','offersDecorative',this.checked)" style="width:auto"/>
        This door style offers decorative panels
      </label>
      ${offersDecorative ? `
      ${decSources.length ? `
      <div style="display:flex;gap:14px;margin:4px 0 8px;font-size:12px">
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="mqph-style-${style.id}-decmode" value="manual" ${decorativeRatioMode!=='copy'?'checked':''} onchange="mqphSetIslandDecorativeMode('${style.id}','manual')" style="width:auto"/> Enter manually</label>
        <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="mqph-style-${style.id}-decmode" value="copy" ${decorativeRatioMode==='copy'?'checked':''} onchange="mqphSetIslandDecorativeMode('${style.id}','copy')" style="width:auto"/> Use same ratio as another style</label>
      </div>` : ''}
      ${decorativeRatioMode==='copy' && decSources.length ? `
      <div class="mqph-field"><label>Copy decorative ratio from</label>
        <select onchange="mqphSetIslandDecorativeSource('${style.id}',this.value)">
          ${decSources.map(s => `<option value="${s.id}" ${decorativeCopySourceId===s.id?'selected':''}>${(s.name||'Untitled').replace(/"/g,'&quot;')} — ${Math.round(s.decorativePct*10)/10}%</option>`).join('')}
        </select>
      </div>
      <div style="font-size:12px;color:#065f46;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px;margin:4px 0 8px">Using that style's decorative ratio for this one too — no separate decorative price needed here. Switch to "Enter manually" any time to quote your own.</div>
      ` : `
      <div class="mqph-field mqph-field-inline"><label>Price you'd charge for a 24" × 34.5" decorative panel to match <span style="display:inline-block;margin-top:4px;font-size:13px;font-weight:800;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:2px 8px;text-transform:none;letter-spacing:0">⚠️ (If this includes furniture kick, please include that with the panel price)</span></label>
        <input type="number" id="mqph-style-${style.id}-deccost" step="0.01" placeholder="0.00" value="${decCostVal}" oninput="mqphSetIslandStyleField('${style.id}','decorativeFlatQuote',this.value);mqphCalcStylePanelPct('${style.id}')"/>
      </div>`}
      ` : ''}
      <div id="mqph-style-${style.id}-pct-reveal" style="font-size:12px;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin:8px 0 12px;line-height:1.6"></div>
      <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-bottom:14px">
        <label style="font-weight:600;font-size:13px;color:#374151;display:block;margin-bottom:6px">Which doors use this style? <span style="font-weight:400;color:#9ca3af">(${taggedCount} tagged)</span></label>
        ${taggableGroups.length ? `
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px">
          <span style="font-size:12px;color:#374151;white-space:nowrap">Tag a whole group:</span>
          <select id="mqph-style-${style.id}-grouptag" onchange="mqphOnIslandGroupPicked('${style.id}')" style="flex:1;min-width:160px;font-size:12px;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px">
            <option value="">— pick a group —</option>
            ${taggableGroups.map(g => `<option value="${g.name.replace(/"/g,'&quot;')}">${g.name} (${g.count} door${g.count===1?'':'s'})</option>`).join('')}
          </select>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" id="mqph-style-${style.id}-grouptag-btn" onclick="mqphTagIslandStyleGroup('${style.id}', document.getElementById('mqph-style-${style.id}-grouptag').value)">Tag group</button>
        </div>` : ''}
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <input type="text" placeholder="Search doors…" value="${(ui.query||'').replace(/"/g,'&quot;')}" oninput="mqphSetIslandStyleSearch('${style.id}',this.value)" style="flex:1;min-width:140px;font-size:12px;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px"/>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" id="mqph-style-${style.id}-sortname-btn" onclick="mqphSetIslandStyleSort('${style.id}','name')">Name ${ui.sortBy==='name'?(ui.sortDir==='asc'?'▲':'▼'):''}</button>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" id="mqph-style-${style.id}-sortprice-btn" onclick="mqphSetIslandStyleSort('${style.id}','price')">Price ${ui.sortBy==='price'?(ui.sortDir==='asc'?'▲':'▼'):''}</button>
        </div>
        <div id="mqph-style-${style.id}-doorlist" style="max-height:220px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;padding:2px 10px">${mqphBuildStyleDoorListHtml(style.id)}</div>
      </div>
      <button class="mqph-btn ${isDirty ? 'mqph-btn-primary' : 'mqph-btn-saved'}" id="mqph-style-${style.id}-save-btn" style="width:100%" onclick="mqphSaveIslandStyle('${style.id}')">${isDirty ? 'Save this style →' : '✓ Style saved'}</button>
    </div>`;
  }

  function buildIslandPanelHtml() {
    const doors = getByCategory('door');
    const savedStyles = getIslandPanelStyles();
    const allStyles = [...savedStyles, ...window._mqIslandDraftStyles];
    const hasDoors = doors.length > 0;
    const savedStyleIds = new Set(savedStyles.map(s => s.id));
    // A door counts as untagged if it has no style tag at all, OR its tag
    // points at a style that's since been removed.
    const untaggedDoors = doors.filter(d => !d.fields['Island panel style'] || !savedStyleIds.has(d.fields['Island panel style']));
    // Collapsed-header summary: untagged doors take priority over the
    // normal style-count summary, since an untagged door is silently
    // getting $0 panel upcharge right now and that's worth surfacing even
    // with the section closed (Jordan 2026-10-03: "this would be in the
    // header even if the island pricing section is collapsed... it would
    // replace the percentages that its currently showing by default").
    // Once every door IS tagged, the header settles into a permanent "✅
    // All doors tagged" state (replacing the old "N style(s) priced" text
    // entirely, since by definition every tagged door already has a style
    // behind it) — Jordan 2026-10-03 wanted this to show "in the header
    // right after" the one-time flash below fades. Both directions are
    // live: add an untagged door later (or remove the style covering some
    // doors) and this reverts straight back to the ⚠️ warning.
    const allTagged = hasDoors && untaggedDoors.length === 0;
    const summary = !hasDoors
      ? 'Not set up yet'
      : untaggedDoors.length > 0
        ? `⚠️ ${untaggedDoors.length} untagged door${untaggedDoors.length===1?'':'s'}`
        : `✅ All doors tagged`;
    const summaryColor = !hasDoors ? '#9ca3af' : (untaggedDoors.length > 0 ? '#b45309' : '#059669');

    // One-shot flash banner for the exact moment the last untagged door
    // gets tagged — set by mqphToggleIslandStyleDoor, consumed (reset)
    // right here so it only ever renders once per transition, never on
    // every subsequent re-render while the permanent header state above
    // keeps showing "✅ All doors tagged" on its own.
    const showFlash = !!window._mqIslandJustCompletedFlash;
    window._mqIslandJustCompletedFlash = false;

    return `
      <div class="mqph-ct-block" id="mqph-scope-islandpanel">
        <div class="mqph-cat-header" onclick="mqphToggleCategory('islandpanel')" style="cursor:pointer">
          <span class="mqph-cat-title"><span id="mqph-cat-arrow-islandpanel" style="display:inline-block;margin-right:6px;transition:transform 0.2s;font-size:12px">▶</span>🏝️ Island panel pricing <span style="font-size:12px;font-weight:400;color:${summaryColor}">(${summary})</span></span>
        </div>
        <div id="mqph-cat-body-islandpanel" style="display:none">
          <div style="margin:12px 16px 0">
            ${typeof window.mqTrainingVideoBlockHTML === 'function' ? window.mqTrainingVideoBlockHTML('islandPanel') : ''}
          </div>
          <div class="mqph-info" style="margin:12px 16px;line-height:1.6">
            <div style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600" onclick="mqphToggleIslandInfo()">
              <span id="mqph-island-info-arrow" style="display:inline-block;font-size:11px;transition:transform 0.2s;${window._mqIslandInfoExpanded?'transform:rotate(90deg)':''}">▶</span>
              <span>How island panel pricing works</span>
            </div>
            <div id="mqph-island-info-body" style="display:${window._mqIslandInfoExpanded?'block':'none'};margin-top:8px">
              <div class="mqph-info-sec">
                <div class="mqph-info-h">The idea</div>
                <p>Islands tend to cost more because of finished side panels and back panels. To make this very simple, we'll create a ratio cost for your panels (flat or decorative) based on your different door styles.</p>
                <p>For example, if you have flat doors, shaker doors, and raised panel doors, you'd create those three distinct styles below.</p>
              </div>
              <div class="mqph-info-sec">
                <div class="mqph-info-h">What you enter for each style</div>
                <p>For each style, you decide whether that door style offers decorative panels, just flat panels, or both — then enter the price of a flat panel and/or a decorative panel based on one door you select to represent that style.</p>
                <p>For example, if the style is Shaker and you choose Maple Shaker as the door to price against, you simply quote the flat panel cost you'd charge for an island with Maple Shaker doors, and the decorative panel cost you'd charge for the same island.</p>
              </div>
              <div class="mqph-info-sec">
                <div class="mqph-info-h">How the ratio works</div>
                <p>This creates a ratio for each — maybe the flat panel works out to 75% of the door's linear-foot cost, and the decorative panel works out to 90%. From then on, whenever a customer adds an island and has a Shaker door selected, that ratio scales with whatever door is chosen — so if it's a Cherry Shaker door that costs more, the panel cost will be 75% of that door's cost per linear foot.</p>
              </div>
              <div class="mqph-info-sec">
                <div class="mqph-info-h">Different styles, different ratios</div>
                <p>Since a raised panel door is more expensive than a shaker door, we need a separate price for that style. If you use Maple Raised Panel as your door to price against, you'll likely use the same flat panel price as you did for Maple Shaker, but the ratio will differ — and that ratio then applies to all the raised panel doors. Conversely, your decorative panel ratio will likely be the same as it was for Maple Shaker, so you could reuse that ratio instead of requoting.</p>
              </div>
              <div class="mqph-info-sec">
                <div class="mqph-info-h">Furniture kick &amp; installation</div>
                <p>If furniture kick comes with your decorative panels, include it in your decorative panel price — and include its installation in your decorative panel install price.</p>
                <p>Installation prices are entered once, in their own box below your styles, and apply to every style.</p>
              </div>
              <div class="mqph-info-sec">
                <div class="mqph-info-h">Good to know</div>
                <p>Style names are internal only — customers never see them. Feel free to watch the video above to help make this clearer.</p>
              </div>
            </div>
          </div>
          ${showFlash ? `<div id="mqph-island-flash" style="margin:0 16px 12px;background:#d1fae5;border:1px solid #6ee7b7;color:#065f46;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px">✅ All doors tagged!</div>` : ''}
          ${!hasDoors ? `
          <div style="padding:1rem 16px;font-size:13px;color:#9ca3af">Add at least one door style above before setting up island panel pricing.</div>
          ` : `
          <div style="padding:0 16px 16px">
            ${allStyles.map(s => mqphIslandStyleCardHtml(s, savedStyleIds.has(s.id), doors)).join('')}
            <button class="mqph-btn mqph-btn-secondary" style="width:100%" onclick="mqphAddIslandStyle()">+ ${allStyles.length>0?'Add another':'Add a'} door style</button>
          </div>
          `}
          ${(() => {
            const saved = getIslandInstallRates();
            const pend = window._mqIslandInstallPending;
            const flatVal = pend ? pend.flat : (saved.flat || '');
            const decVal = pend ? pend.decorative : (saved.decorative || '');
            const isDirty = !!pend;
            return `
          <div id="mqph-island-install-box" style="margin:6px 16px 16px;border:2px solid #e5e7eb;border-radius:10px;padding:12px 14px;background:#f9fafb">
            <div style="font-weight:700;font-size:14px;color:#111827;margin-bottom:2px">🔧 Panel installation prices <span style="font-weight:400;font-size:12px;color:#6b7280">(separate from your styles above)</span></div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:10px;line-height:1.5">Entered once — these apply to every style. Optional (leave 0.00 if you don't charge extra). Only added to a quote when the customer picks supply + install.</div>
            <div class="mqph-field mqph-field-inline"><label>Price you'd charge to INSTALL a 24" × 34.5" flat panel</label>
              <input type="number" id="mqph-island-install-flat" step="0.01" min="0" placeholder="0.00" value="${flatVal}" oninput="mqphOnIslandInstallInput()"/>
            </div>
            <div class="mqph-field mqph-field-inline"><label>Price you'd charge to INSTALL a 24" × 34.5" decorative panel <span style="font-weight:400;color:#6b7280">(furniture kick install included)</span></label>
              <input type="number" id="mqph-island-install-dec" step="0.01" min="0" placeholder="0.00" value="${decVal}" oninput="mqphOnIslandInstallInput()"/>
            </div>
            <button class="mqph-btn ${isDirty ? 'mqph-btn-primary' : 'mqph-btn-saved'}" id="mqph-island-install-save-btn" style="width:100%" onclick="mqphSaveIslandInstallRates()">${isDirty ? 'Save install prices →' : '✓ Install prices saved'}</button>
          </div>`;
          })()}
        </div>
      </div>`;
  }

  // Re-renders the whole Island panel pricing section in place from
  // current in-memory state (saved styles + drafts + pending edits +
  // lineItems' live tags) — used after anything that changes which doors
  // are visible in which style's list (tagging toggles a door off ONE
  // style's pool and onto another's) or a style being added/removed/saved.
  // Re-opens the section (and recalculates every style's % preview) if it
  // was open before the re-render, same restore-state pattern as
  // mqphRestoreExpandedCats.
  function mqphRerenderIslandPanelSection() {
    const container = document.getElementById('mqph-scope-islandpanel');
    if (!container) return;
    const wasOpen = document.getElementById('mqph-cat-body-islandpanel')?.style.display !== 'none';
    container.outerHTML = buildIslandPanelHtml();
    if (wasOpen) {
      const body = document.getElementById('mqph-cat-body-islandpanel');
      const arrow = document.getElementById('mqph-cat-arrow-islandpanel');
      if (body) body.style.display = 'block';
      if (arrow) arrow.style.transform = 'rotate(90deg)';
      mqphRecalcAllIslandStylePcts();
    }
    // If this render included the one-shot "All doors tagged" flash,
    // fade it out after a couple seconds — the permanent header summary
    // (computed fresh every render, see buildIslandPanelHtml) is already
    // showing the settled "✅ All doors tagged" state underneath by then,
    // so nothing is lost when the banner goes away.
    const flash = document.getElementById('mqph-island-flash');
    if (flash) {
      setTimeout(() => {
        flash.style.transition = 'opacity 0.5s';
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 500);
      }, 2200);
    }
  }

  function mqphRecalcAllIslandStylePcts() {
    [...getIslandPanelStyles(), ...window._mqIslandDraftStyles].forEach(s => mqphCalcStylePanelPct(s.id));
  }

  // Wired to every style card's price/door inputs — the moment a shop
  // touches one, whatever's saved no longer necessarily matches what's on
  // screen, so that card's Save button drops back to its plain "unsaved"
  // look (mirrors the old single-ratio form's mqphResetIslandSaveBtn,
  // Jordan 2026-10-01). Also stashes the raw value in
  // window._mqIslandPendingEdits so it survives a re-render triggered by
  // an unrelated action elsewhere on the page (see mqphRerenderIslandPanelSection).
  window.mqphSetIslandStyleField = function(styleId, field, value) {
    if (!window._mqIslandPendingEdits[styleId]) window._mqIslandPendingEdits[styleId] = {};
    window._mqIslandPendingEdits[styleId][field] = value;
    const draft = window._mqIslandDraftStyles.find(s => s.id === styleId);
    if (draft) draft[field] = value;
    const btn = document.getElementById(`mqph-style-${styleId}-save-btn`);
    if (btn && btn.classList.contains('mqph-btn-saved')) {
      btn.classList.remove('mqph-btn-saved');
      btn.classList.add('mqph-btn-primary');
      btn.textContent = 'Save this style →';
    }
    // Toggling "offers flat" or "offers decorative" changes whether that
    // price field is even shown at all — needs the card's own markup
    // rebuilt, not just the % reveal, so it goes through the section-wide
    // re-render rather than a live recalc alone.
    if (field === 'offersFlat' || field === 'offersDecorative') mqphRerenderIslandPanelSection();
  };

  window.mqphCalcStylePanelPct = function(styleId) {
    const reveal = document.getElementById(`mqph-style-${styleId}-pct-reveal`);
    if (!reveal) return;
    const doorId = document.getElementById(`mqph-style-${styleId}-refdoor`)?.value;
    const doorRec = lineItems.find(r => r.id === doorId);
    const doorRate = doorRec?.fields['Rate'] || 0;
    const offersFlat = document.getElementById(`mqph-style-${styleId}-offersflat`)?.checked;
    const panelCostRaw = offersFlat ? document.getElementById(`mqph-style-${styleId}-panelcost`)?.value : '';
    const offersDec = document.getElementById(`mqph-style-${styleId}-offersdec`)?.checked;
    const panelEntered = offersFlat && panelCostRaw !== '' && panelCostRaw != null && !isNaN(parseFloat(panelCostRaw));
    const panelCost = panelEntered ? parseFloat(panelCostRaw) : 0;
    if (!doorRate) {
      reveal.innerHTML = `<span style="color:#92400e">Pick a door with a rate above ${CUR()}0 to compute a percentage.</span>`;
      return;
    }
    if (!offersFlat && !offersDec) {
      reveal.innerHTML = `<span style="color:#92400e">⚠️ This style needs to offer at least flat panels or decorative panels — check at least one above.</span>`;
      return;
    }
    const panelRatePerFt = panelCost > 0 ? panelCost / ISLAND_PANEL_WIDTH_FT : 0;
    const panelPct = panelRatePerFt > 0 ? (panelRatePerFt/doorRate)*100 : 0;

    // Decorative preview: either read from this card's own manual input,
    // or — if "use same ratio as another style" is selected — mirror the
    // chosen source style's saved % directly and re-derive what that
    // means in $/lin ft for THIS style's own reference door (never the
    // source style's door), same species-scaling logic as everywhere else
    // (Jordan 2026-10-03).
    const pending = window._mqIslandPendingEdits[styleId] || {};
    const rec = mqphGetStyleRecord(styleId);
    const decMode = pending.decorativeRatioMode !== undefined ? pending.decorativeRatioMode : (rec?.decorativeRatioMode || 'manual');
    const decSourceId = pending.decorativeCopySourceId !== undefined ? pending.decorativeCopySourceId : (rec?.decorativeCopySourceId || '');
    let decPct = null, decRatePerFt = null;
    if (offersDec && decMode === 'copy' && decSourceId) {
      const source = getIslandPanelStyles().find(s => s.id === decSourceId);
      if (source && source.decorativePct != null) {
        decPct = source.decorativePct;
        decRatePerFt = (decPct/100) * doorRate;
      }
    } else if (offersDec) {
      const decCostRaw = document.getElementById(`mqph-style-${styleId}-deccost`)?.value;
      const decCost = decCostRaw !== '' && decCostRaw != null ? parseFloat(decCostRaw) : null;
      decRatePerFt = (decCost != null && decCost > 0) ? decCost / ISLAND_PANEL_WIDTH_FT : null;
      decPct = (decRatePerFt != null && decRatePerFt > 0) ? (decRatePerFt/doorRate)*100 : null;
    }

    reveal.innerHTML = `
      ${offersFlat ? `<div>Flat panels: <strong>${panelEntered?`${Math.round(panelPct*10)/10}% of door cost`:'—'}</strong>${panelCost>0?` <span style="color:#9ca3af">(≈ ${CUR()}${panelRatePerFt.toFixed(2)}/lin ft)</span>`:''}</div>` : ''}
      ${offersDec ? `<div>Decorative panels: <strong>${decPct!=null?`${Math.round(decPct*10)/10}% of door cost`:'—'}</strong>${decRatePerFt!=null?` <span style="color:#9ca3af">(≈ ${CUR()}${decRatePerFt.toFixed(2)}/lin ft)</span>`:''}</div>` : ''}`;
  };

  window.mqphAddIslandStyle = function() {
    const id = 'style_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    window._mqIslandDraftStyles.push({ id, name:'', refDoorId:'', refDoorName:'', offersFlat:true, panelFlatQuote:null, panelRatePerFt:null, panelPct:null, offersDecorative:false, decorativeFlatQuote:null, decorativeRatePerFt:null, decorativePct:null, decorativeRatioMode:'manual', decorativeCopySourceId:null });
    _mqphExpandedCats.add('islandpanel');
    mqphRerenderIslandPanelSection();
  };

  // Manually re-opens or re-collapses an already-saved style card — a
  // brand-new draft always renders expanded regardless of this set (see
  // the isExpanded check in mqphIslandStyleCardHtml). The "▲ Collapse"
  // button now always shows for a saved style, dirty or not (Jordan
  // 2026-10-03 didn't want a separate "Discard changes" button — "it
  // should just still say collapse. maybe if they changed something and go
  // to collapse it, it could say collapse without saving? then they can
  // choose yes or no"): collapsing a style with unsaved pending edits
  // confirms first, and only drops those edits (no Airtable write to
  // undo — nothing was ever saved) if they say yes; saying no leaves it
  // expanded exactly as it was, untouched.
  window.mqphToggleIslandStyleCollapse = function(styleId) {
    const pending = window._mqIslandPendingEdits[styleId] || {};
    const isDirty = Object.keys(pending).length > 0;
    const currentlyExpanded = isDirty || window._mqIslandExpandedStyles.has(styleId);
    if (currentlyExpanded) {
      if (isDirty && !confirm('Collapse without saving? Your changes to this style won\'t be saved.')) return;
      delete window._mqIslandPendingEdits[styleId];
      window._mqIslandExpandedStyles.delete(styleId);
    } else {
      window._mqIslandExpandedStyles.add(styleId);
    }
    mqphRerenderIslandPanelSection();
  };

  // Toggles the "How island panel pricing works" explanation open/closed —
  // a direct DOM flip (not a full section re-render) since nothing else on
  // the page depends on its state, same lightweight pattern as the
  // door-search/sort toggles. The underlying flag still persists across a
  // full re-render triggered by anything else (see buildIslandPanelHtml),
  // so saving a style elsewhere doesn't snap this back shut.
  window.mqphOnIslandInstallInput = function() {
    window._mqIslandInstallPending = {
      flat: document.getElementById('mqph-island-install-flat')?.value ?? '',
      decorative: document.getElementById('mqph-island-install-dec')?.value ?? '',
    };
    const btn = document.getElementById('mqph-island-install-save-btn');
    if (btn && btn.classList.contains('mqph-btn-saved')) {
      btn.classList.remove('mqph-btn-saved');
      btn.classList.add('mqph-btn-primary');
      btn.textContent = 'Save install prices →';
    }
  };

  window.mqphSaveIslandInstallRates = async function() {
    const parse = (id, label) => {
      const raw = document.getElementById(id)?.value;
      const v = (raw !== '' && raw != null) ? parseFloat(raw) : 0;
      if (isNaN(v) || v < 0) { alert('Enter a valid ' + label + ' install price (0 or higher), or leave it blank.'); return undefined; }
      return v;
    };
    const flat = parse('mqph-island-install-flat', 'flat panel');
    if (flat === undefined) return;
    const decorative = parse('mqph-island-install-dec', 'decorative panel');
    if (decorative === undefined) return;
    const btn = document.getElementById('mqph-island-install-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      const json = JSON.stringify({ flat, decorative });
      await atUpdate(SHOPS_TABLE, shopRecord.id, { 'Island panel install rates': json });
      shopRecord.fields['Island panel install rates'] = json;
      window._mqIslandInstallPending = null;
      mqphRerenderIslandPanelSection();
    } catch(e) {
      console.error('Failed to save island panel install rates', e);
      alert('Something went wrong saving this — please try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Save install prices →'; }
    }
  };

  window.mqphToggleIslandInfo = function() {
    window._mqIslandInfoExpanded = !window._mqIslandInfoExpanded;
    const body = document.getElementById('mqph-island-info-body');
    const arrow = document.getElementById('mqph-island-info-arrow');
    if (body) body.style.display = window._mqIslandInfoExpanded ? 'block' : 'none';
    if (arrow) arrow.style.transform = window._mqIslandInfoExpanded ? 'rotate(90deg)' : '';
  };

  // Switches a style's decorative pricing between "enter manually" and
  // "copy another style's ratio" — needs a full section re-render (not
  // just a recalc) since it swaps out the input markup itself, same as
  // the offersDecorative checkbox already does.
  window.mqphSetIslandDecorativeMode = function(styleId, mode) {
    if (!window._mqIslandPendingEdits[styleId]) window._mqIslandPendingEdits[styleId] = {};
    window._mqIslandPendingEdits[styleId].decorativeRatioMode = mode;
    if (mode === 'copy' && !window._mqIslandPendingEdits[styleId].decorativeCopySourceId) {
      const eligible = mqphEligibleDecorativeSources(styleId);
      if (eligible.length) window._mqIslandPendingEdits[styleId].decorativeCopySourceId = eligible[0].id;
    }
    const draft = window._mqIslandDraftStyles.find(s => s.id === styleId);
    if (draft) draft.decorativeRatioMode = mode;
    const btn = document.getElementById(`mqph-style-${styleId}-save-btn`);
    if (btn && btn.classList.contains('mqph-btn-saved')) {
      btn.classList.remove('mqph-btn-saved');
      btn.classList.add('mqph-btn-primary');
      btn.textContent = 'Save this style →';
    }
    mqphRerenderIslandPanelSection();
  };

  window.mqphSetIslandDecorativeSource = function(styleId, sourceId) {
    if (!window._mqIslandPendingEdits[styleId]) window._mqIslandPendingEdits[styleId] = {};
    window._mqIslandPendingEdits[styleId].decorativeCopySourceId = sourceId;
    const draft = window._mqIslandDraftStyles.find(s => s.id === styleId);
    if (draft) draft.decorativeCopySourceId = sourceId;
    const btn = document.getElementById(`mqph-style-${styleId}-save-btn`);
    if (btn && btn.classList.contains('mqph-btn-saved')) {
      btn.classList.remove('mqph-btn-saved');
      btn.classList.add('mqph-btn-primary');
      btn.textContent = 'Save this style →';
    }
    mqphRerenderIslandPanelSection();
  };

  window.mqphSaveIslandStyle = async function(styleId) {
    const name = (document.getElementById(`mqph-style-${styleId}-name`)?.value || '').trim();
    const doorId = document.getElementById(`mqph-style-${styleId}-refdoor`)?.value;
    const doorRec = lineItems.find(r => r.id === doorId);
    const doorRate = doorRec?.fields['Rate'] || 0;
    const offersFlat = document.getElementById(`mqph-style-${styleId}-offersflat`)?.checked || false;
    const offersDecorative = document.getElementById(`mqph-style-${styleId}-offersdec`)?.checked || false;
    if (!name) { alert('Give this style a name (e.g. "Shaker") before saving.'); return; }
    if (!doorId || !doorRate) { alert('Pick a door style with a rate above ' + CUR() + '0 to compare against.'); return; }
    // Jordan 2026-10-03: a style needs to offer at least ONE of the two —
    // "some shops may be so fancy that they dont offer flat" (decorative-
    // only is fine), but offering neither would leave the style with no
    // price at all and no way for a customer to ever pick anything useful.
    if (!offersFlat && !offersDecorative) { alert('This style needs to offer at least flat panels or decorative panels — check at least one.'); return; }

    // Flat panel pricing — only collected/validated when this style
    // actually offers flat panels. offersFlat===false stores null rather
    // than 0 so it's distinguishable from "offers flat panels for free"
    // (0 was already a valid, intentional flat price before this — see
    // the comment below); null instead means the flat option doesn't
    // exist for this style at all, same as decorativePct when decorative
    // isn't offered.
    let panelCost = null, panelRatePerFt = null, panelPct = null;
    if (offersFlat) {
      const panelCostRaw = document.getElementById(`mqph-style-${styleId}-panelcost`)?.value;
      panelCost = panelCostRaw !== '' && panelCostRaw != null ? parseFloat(panelCostRaw) : 0;
      // Blank/0 is valid and intentional (same rule as the old single-ratio
      // form, Jordan 2026-10-02/03) -- a style that never needs finished end
      // panels at all should be able to save that explicitly.
      if (isNaN(panelCost) || panelCost < 0) { alert('Enter a valid price (0 or higher) for the finished flat panel — leave it blank or enter 0 if this style never needs finished end panels.'); return; }
      panelRatePerFt = panelCost / ISLAND_PANEL_WIDTH_FT;
      panelPct = Math.round(((panelRatePerFt/doorRate)*100)*100)/100;
    }

    // Decorative ratio: either quoted manually for this style, or copied
    // from another style's already-saved ratio (Jordan 2026-10-03). A
    // copied ratio stores the SAME % as the source — never a live link —
    // but its $/lin ft and flat-quote figures are re-derived against THIS
    // style's own reference door rate, so species scaling still works
    // exactly like a manually-entered ratio would (see mqphCalcStylePanelPct).
    const pending = window._mqIslandPendingEdits[styleId] || {};
    const rec = mqphGetStyleRecord(styleId);
    const decorativeRatioMode = pending.decorativeRatioMode !== undefined ? pending.decorativeRatioMode : (rec?.decorativeRatioMode || 'manual');
    const decorativeCopySourceId = pending.decorativeCopySourceId !== undefined ? pending.decorativeCopySourceId : (rec?.decorativeCopySourceId || '');

    let decorativePct = null, decorativeRatePerFt = null, decorativeFlatQuote = null, finalDecMode = 'manual', finalDecSource = null;
    if (offersDecorative && decorativeRatioMode === 'copy' && decorativeCopySourceId) {
      const source = getIslandPanelStyles().find(s => s.id === decorativeCopySourceId);
      if (!source || source.decorativePct == null) { alert('Pick a style with a saved decorative ratio to copy, or switch to entering one manually.'); return; }
      decorativePct = source.decorativePct;
      decorativeRatePerFt = (decorativePct/100) * doorRate;
      decorativeFlatQuote = Math.round(decorativeRatePerFt * ISLAND_PANEL_WIDTH_FT * 100) / 100;
      finalDecMode = 'copy';
      finalDecSource = decorativeCopySourceId;
    } else if (offersDecorative) {
      const decCostRaw = document.getElementById(`mqph-style-${styleId}-deccost`)?.value;
      const decCost = decCostRaw !== '' && decCostRaw != null ? parseFloat(decCostRaw) : null;
      decorativeRatePerFt = (decCost != null && decCost > 0) ? decCost / ISLAND_PANEL_WIDTH_FT : null;
      decorativePct = (decorativeRatePerFt != null) ? Math.round(((decorativeRatePerFt/doorRate)*100)*100)/100 : null;
      decorativeFlatQuote = (decCost != null && decCost > 0) ? decCost : null;
    }

    const newStyleObj = {
      id: styleId,
      name,
      refDoorId: doorId,
      refDoorName: doorRec.fields['Name'] || '',
      offersFlat,
      panelFlatQuote: panelCost,
      panelRatePerFt,
      panelPct,
      offersDecorative,
      decorativeFlatQuote,
      decorativeRatePerFt,
      decorativePct,
      decorativeRatioMode: finalDecMode,
      decorativeCopySourceId: finalDecSource,
    };

    const btn = document.getElementById(`mqph-style-${styleId}-save-btn`);
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      const styles = getIslandPanelStyles();
      const idx = styles.findIndex(s => s.id === styleId);
      if (idx >= 0) styles[idx] = newStyleObj; else styles.push(newStyleObj);
      await saveIslandPanelStylesArray(styles);
      window._mqIslandDraftStyles = window._mqIslandDraftStyles.filter(s => s.id !== styleId);
      delete window._mqIslandPendingEdits[styleId];
      // Auto-collapse right after a successful save (Jordan 2026-10-03) —
      // if it had been pinned open via the Edit/row click, that's done now.
      window._mqIslandExpandedStyles.delete(styleId);
      _mqphExpandedCats.add('islandpanel');
      mqphRerenderIslandPanelSection();
    } catch(e) {
      console.error('Failed to save island panel style', e);
      alert('Something went wrong saving this — please try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Save this style →'; }
    }
  };

  window.mqphRemoveIslandStyle = async function(styleId, isSaved) {
    if (!isSaved) {
      // Never actually saved -- just drop the local draft. No Airtable
      // write to undo, and no door could possibly be tagged to it yet.
      window._mqIslandDraftStyles = window._mqIslandDraftStyles.filter(s => s.id !== styleId);
      delete window._mqIslandPendingEdits[styleId];
      mqphRerenderIslandPanelSection();
      return;
    }
    const styles = getIslandPanelStyles();
    const style = styles.find(s => s.id === styleId);
    const styleName = style?.name || 'this style';
    const taggedDoors = getByCategory('door').filter(d => d.fields['Island panel style'] === styleId);
    if (!confirm(`Remove "${styleName}"?${taggedDoors.length ? ` ${taggedDoors.length} door${taggedDoors.length===1?'':'s'} tagged to it will become untagged.` : ''} This can't be undone.`)) return;
    try {
      if (taggedDoors.length) {
        // Throttled rather than one big Promise.all — a shop can easily
        // have 100+ doors tagged to one style (Jordan 2026-10-03 mentioned
        // ~180 in a single group), which would blow past Airtable's rate
        // limit if fired all at once (see mqphThrottledBatch).
        const failed = await mqphThrottledBatch(taggedDoors, d => atUpdate(LINE_ITEMS_TABLE, d.id, { 'Island panel style': '' }));
        const failedIds = new Set(failed.map(d => d.id));
        taggedDoors.forEach(d => { if (!failedIds.has(d.id)) d.fields['Island panel style'] = ''; });
        if (failed.length) {
          alert(`Removed "${styleName}", but ${failed.length} of ${taggedDoors.length} tagged door${taggedDoors.length===1?'':'s'} couldn't be untagged — please check ${failed.length===1?'it':'them'} manually (search for "${styleName}" won't find it anymore, but the old tag may still be sitting on the door record).`);
        }
      }
      await saveIslandPanelStylesArray(styles.filter(s => s.id !== styleId));
      delete window._mqIslandPendingEdits[styleId];
      mqphRerenderIslandPanelSection();
    } catch(e) {
      console.error('Failed to remove island panel style', e);
      alert('Something went wrong removing that — please try again.');
    }
  };

  // Per-door style tagging — instant-save, same lightweight optimistic
  // pattern as mqphToggle (the per-item Active switch): flip the in-memory
  // `lineItems` record and re-render right away, persist in the
  // background, roll back on failure. A full section re-render (not just
  // this one checkbox) is needed because tagging a door to style A also
  // has to make it disappear from every OTHER style's list, and update the
  // header's untagged-door count.
  window.mqphToggleIslandStyleDoor = async function(styleId, doorId, checked) {
    const rec = lineItems.find(r => r.id === doorId);
    if (!rec) return;
    const prevTag = rec.fields['Island panel style'] || '';
    const newTag = checked ? styleId : '';

    // Detect the exact moment THIS toggle takes the untagged-door count
    // from >0 to 0, so the one-time "All doors tagged" flash (Jordan
    // 2026-10-03) fires right on that transition rather than on every
    // re-render afterward — the permanent header state (buildIslandPanelHtml)
    // updates regardless of this flag.
    const savedStyleIds = new Set(getIslandPanelStyles().map(s => s.id));
    const doors = getByCategory('door');
    const untaggedBefore = doors.filter(d => !d.fields['Island panel style'] || !savedStyleIds.has(d.fields['Island panel style'])).length;
    rec.fields['Island panel style'] = newTag;
    const untaggedAfter = doors.filter(d => !d.fields['Island panel style'] || !savedStyleIds.has(d.fields['Island panel style'])).length;
    if (checked && untaggedBefore > 0 && untaggedAfter === 0) {
      window._mqIslandJustCompletedFlash = true;
    }

    mqphRerenderIslandPanelSection();
    try {
      await atUpdate(LINE_ITEMS_TABLE, doorId, { 'Island panel style': newTag });
    } catch(e) {
      console.error('Failed to save island panel style tag', e);
      alert('Something went wrong saving that — please try again.');
      rec.fields['Island panel style'] = prevTag;
      mqphRerenderIslandPanelSection();
    }
  };

  // Tags every door in one "Group name" group (the same grouping bulk-add
  // uses) to this style in one action, instead of checking doors one at a
  // time — Jordan 2026-10-03: "my one shop has like 180 doors in one
  // group. he would probably much prefer to just tag the whole group."
  // Only touches doors still eligible for THIS style (mqphStyleDoorPool) —
  // a door already tagged to a different existing style is deliberately
  // left alone rather than silently stolen by a bulk action; the dropdown
  // that calls this (mqphStyleDoorGroupsInPool) already only counts those
  // still-eligible doors, so the confirm count matches what will change.
  window.mqphTagIslandStyleGroup = async function(styleId, groupName) {
    if (!groupName) { alert('Pick a group to tag first.'); return; }
    const pool = mqphStyleDoorPool(styleId);
    const toTag = pool.filter(d => (d.fields['Group name'] || '').trim() === groupName && d.fields['Island panel style'] !== styleId);
    if (!toTag.length) { alert(`Every door in "${groupName}" is already tagged to this style.`); return; }
    if (!confirm(`Tag all ${toTag.length} door${toTag.length===1?'':'s'} in "${groupName}" to this style?`)) return;

    // Same all-doors-tagged flash detection as the single-door toggle,
    // just computed once for the whole batch rather than per door.
    const savedStyleIds = new Set(getIslandPanelStyles().map(s => s.id));
    const allDoors = getByCategory('door');
    const untaggedBefore = allDoors.filter(d => !d.fields['Island panel style'] || !savedStyleIds.has(d.fields['Island panel style'])).length;

    const prevTags = new Map(toTag.map(d => [d.id, d.fields['Island panel style'] || '']));
    toTag.forEach(d => { d.fields['Island panel style'] = styleId; });

    const untaggedAfter = allDoors.filter(d => !d.fields['Island panel style'] || !savedStyleIds.has(d.fields['Island panel style'])).length;
    if (untaggedBefore > 0 && untaggedAfter === 0) window._mqIslandJustCompletedFlash = true;

    mqphRerenderIslandPanelSection();
    const btn = document.getElementById(`mqph-style-${styleId}-grouptag-btn`);
    if (btn) { btn.disabled = true; btn.textContent = `Tagging ${toTag.length}…`; }

    // Throttled, not one big Promise.all — see mqphThrottledBatch. For 180
    // doors this takes under a minute in the background; the price is
    // already correct immediately from the optimistic update above.
    const failed = await mqphThrottledBatch(toTag, d => atUpdate(LINE_ITEMS_TABLE, d.id, { 'Island panel style': styleId }));
    if (failed.length) {
      const failedIds = new Set(failed.map(d => d.id));
      toTag.forEach(d => { if (failedIds.has(d.id)) d.fields['Island panel style'] = prevTags.get(d.id); });
      alert(`${toTag.length - failed.length} of ${toTag.length} doors in "${groupName}" were tagged — ${failed.length} failed and were rolled back. Try tagging the group again to pick up the rest.`);
    }
    // Re-render unconditionally, success or failure (Jordan 2026-10-03:
    // "even after is checkboxed the doors it still showed 'tagging 2
    // doors'... having it say that after successfully tagging makes it
    // look like its not working even though it is") — this was the actual
    // bug: that only happened above when `failed.length` was truthy, so a
    // fully successful batch left the button stuck on "Tagging N…"
    // forever with no further render to clear it, even though every door
    // really had been tagged.
    mqphRerenderIslandPanelSection();
  };

  // Highlights the "Tag group" button the moment a group is actually
  // picked, so it's obvious there's one more click needed — Jordan
  // 2026-10-03: "as soon as they select a group lets highlight the 'tag
  // group' button so they know they need to click it." A direct class
  // swap, not a re-render, so it doesn't interrupt picking from the
  // dropdown.
  window.mqphOnIslandGroupPicked = function(styleId) {
    const sel = document.getElementById(`mqph-style-${styleId}-grouptag`);
    const btn = document.getElementById(`mqph-style-${styleId}-grouptag-btn`);
    if (!sel || !btn) return;
    if (sel.value) {
      btn.classList.remove('mqph-btn-secondary');
      btn.classList.add('mqph-btn-primary');
    } else {
      btn.classList.remove('mqph-btn-primary');
      btn.classList.add('mqph-btn-secondary');
    }
  };

  // Search/sort are scoped to just the one style's door-list div (not a
  // full section re-render) specifically so the search box never loses
  // focus/cursor position mid-keystroke.
  window.mqphSetIslandStyleSearch = function(styleId, value) {
    if (!window._mqIslandTagUi[styleId]) window._mqIslandTagUi[styleId] = { query:'', sortBy:'name', sortDir:'asc' };
    window._mqIslandTagUi[styleId].query = value;
    const listEl = document.getElementById(`mqph-style-${styleId}-doorlist`);
    if (listEl) listEl.innerHTML = mqphBuildStyleDoorListHtml(styleId);
  };
  window.mqphSetIslandStyleSort = function(styleId, field) {
    if (!window._mqIslandTagUi[styleId]) window._mqIslandTagUi[styleId] = { query:'', sortBy:'name', sortDir:'asc' };
    const ui = window._mqIslandTagUi[styleId];
    ui.sortDir = (ui.sortBy === field && ui.sortDir === 'asc') ? 'desc' : 'asc';
    ui.sortBy = field;
    const listEl = document.getElementById(`mqph-style-${styleId}-doorlist`);
    if (listEl) listEl.innerHTML = mqphBuildStyleDoorListHtml(styleId);
    const nameBtn = document.getElementById(`mqph-style-${styleId}-sortname-btn`);
    const priceBtn = document.getElementById(`mqph-style-${styleId}-sortprice-btn`);
    if (nameBtn) nameBtn.textContent = `Name ${ui.sortBy==='name'?(ui.sortDir==='asc'?'▲':'▼'):''}`;
    if (priceBtn) priceBtn.textContent = `Price ${ui.sortBy==='price'?(ui.sortDir==='asc'?'▲':'▼'):''}`;
  };

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
    document.getElementById('mqph-ct-supply-min').value = '';
    document.getElementById('mqph-ct-install-rate').value = '';
    document.getElementById('mqph-ct-install-unit').value = 'sqft';
    document.getElementById('mqph-ct-install-min').value = '';
    document.getElementById('mqph-ct-removal-rate').value = '';
    document.getElementById('mqph-ct-removal-unit').value = 'sqft';
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
    document.getElementById('mqph-ct-removal-rate').value = rec.fields['Countertop removal rate']||'';
    document.getElementById('mqph-ct-removal-unit').value = rec.fields['Countertop removal unit']||'sqft';
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
        removalRate: parseFloat(document.getElementById('mqph-ct-removal-rate').value||0),
        removalUnit: document.getElementById('mqph-ct-removal-unit').value,
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
      'Countertop removal rate':parseFloat(document.getElementById('mqph-ct-removal-rate').value||0),
      'Countertop removal unit':document.getElementById('mqph-ct-removal-unit').value,
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
        'Countertop removal rate': ctBulk.removalRate, 'Countertop removal unit': ctBulk.removalUnit,
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
  let baselinePinMigrationDone = false;

  // Which cabinet-side pricing category keys to hide entirely when a shop
  // has narrowed the widget down to Countertops only (Shop Info's
  // "Estimator tabs" toggles). Zone (travel), tax, and any custom category
  // aren't in this list on purpose -- they're general/shared settings, not
  // clearly cabinet-only, and Jordan's request was specifically "all
  // cabinet related items" (box materials, door styles, hinges, drawer
  // configs -- the wizard-driven categories -- plus install/removal, which
  // is quoted in cabinet-specific terms; see CAT_LABELS['install']).
  const CABINET_ONLY_PRICING_CATS = ['material', 'door', 'drawer', 'hinge', 'install'];


  // ── Built-in cabinet steps on/off (Phase 3, Oct 2026) ──
  // Jordan: shops should be able to remake how kitchens are priced. Any of
  // these can be switched off: hidden on the widget + Pro, priced at $0,
  // and its pricing section here is tucked away (nothing is deleted). The
  // shop then prices it its own way with custom pricing categories (e.g. a
  // "Box material" step priced per cabinet lin ft, placed after cabinet
  // measurements). Stored as 'Hidden widget tabs'.builtinOff.
  const MQ_BOFF_STEPS = [
    ['materials', 'Box material', 'Material choice + its price per lin ft'],
    ['doors', 'Door style', 'Door choice + its price per lin ft'],
    ['hinges', 'Hinges', 'Hinge choice'],
    ['drawers', 'Drawers', 'Drawer amount / type step'],
    ['tallcabs', 'Tall cabinets', 'Pantry, oven units…'],
    ['trim', 'Crown moulding / valance', 'Trim step'],
    ['install', 'Cabinet installation', 'Built-in install rates (Supply + install question stays if one of your own options offers install)'],
    ['removal', 'Cabinet removal', '"Remove existing cabinets?" question'],
    ['island', 'Islands', '"+ Add island" and island panel pricing'],
  ];
  function mqphBoff() {
    try { const o = JSON.parse(mqccShopFields()['Hidden widget tabs'] || '{}'); return new Set((o && Array.isArray(o.builtinOff)) ? o.builtinOff : []); } catch(e) { return new Set(); }
  }
  window.mqphBoff = mqphBoff;
  // Three switches (Jordan, Oct 27): the core cabinet pricing pieces price
  // off each other (install follows doors and drawers; islands and tall
  // cabinets use the box, door, hinge and install rates), so they're ONE
  // group. Crown/valance (own prices, footage from the measurements) and
  // removal (rate x measured lin ft) stand alone.
  const MQ_BOFF_GROUP = ['materials', 'doors', 'hinges', 'drawers', 'install', 'tallcabs', 'island'];
  const MQ_BOFF_SWITCHES = [
    { id: 'core', keys: MQ_BOFF_GROUP, title: 'Built-in cabinet pricing', on: 'Box material, doors, hinges, drawers, installation, tall cabinets and islands — priced from the sections below.', off: 'Off — hidden on your widget and in MidasQuote Pro ($0), pricing tucked away (nothing deleted). Customers still enter cabinet measurements (set per project type on Project types), so your own ✨ Custom pricing steps can be priced per base / upper / total cabinet lin ft.' },
    { id: 'trim', keys: ['trim'], title: 'Crown moulding / valance', on: 'Footage comes from the upper cabinet measurements.', off: 'Off — hidden on your widget and in Pro.' },
    { id: 'removal', keys: ['removal'], title: 'Cabinet removal', on: '"Remove existing cabinets?" — priced per measured cabinet lin ft.', off: 'Off — question hidden on your widget and in Pro.' },
  ];
  function mqphBoffCardHTML() {
    const off = mqphBoff();
    return `<div class="mqph-cat-block" id="mqph-scope-boff" style="padding:14px 16px !important">
      <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:2px">🧩 Built-in cabinet pricing</div>
      <div style="font-size:12px;color:#6b7280;line-height:1.5;margin-bottom:6px">Most shops leave these on. Switch one off only to price it your own way with ✨ Custom pricing categories.</div>
      ${MQ_BOFF_SWITCHES.map(sw => {
        const isOff = sw.keys.some(k => off.has(k));
        return `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:9px 0;border-top:1px solid #f1f5f9">
          <div style="min-width:0"><div style="font-size:13px;font-weight:600;color:${isOff ? '#9ca3af' : '#111'}">${sw.title} <span style="font-size:11px;font-weight:700;color:${isOff ? '#b45309' : '#15803d'}">${isOff ? 'OFF' : 'ON'}</span></div>
          <div style="font-size:12px;color:#6b7280;line-height:1.5;margin-top:2px">${isOff ? sw.off : sw.on}</div></div>
          <div class="mqph-toggle ${isOff ? '' : 'on'}" id="mqph-boff-${sw.id}" onclick="mqphBoffToggle('${sw.id}')" style="flex-shrink:0;margin-top:2px"></div>
        </div>`;
      }).join('')}
    </div>`;
  }
  window.mqphBoffToggle = async function(swId) {
    const sw = MQ_BOFF_SWITCHES.find(x => x.id === swId) || MQ_BOFF_SWITCHES[0];
    const f = mqccShopFields();
    let o = {};
    try { o = JSON.parse(f['Hidden widget tabs'] || '{}') || {}; } catch(e) { o = {}; }
    if (!Array.isArray(o.hidden)) o.hidden = [];
    const off = new Set(Array.isArray(o.builtinOff) ? o.builtinOff : []);
    const turningOff = !sw.keys.some(k => off.has(k));
    if (turningOff && sw.id === 'core' && !confirm("Switch off the built-in cabinet pricing?\n\nBox material, doors, hinges, drawers, installation, tall cabinets and islands will be hidden on your widget and in Pro, and your cabinet quotes will use your own custom pricing steps instead.\n\nNothing is deleted — switch it back on any time.")) return;
    sw.keys.forEach(k => { if (turningOff) off.add(k); else off.delete(k); });
    o.builtinOff = MQ_BOFF_STEPS.map(([k]) => k).filter(k => off.has(k));
    if (!o.builtinOff.length) delete o.builtinOff;
    const json = JSON.stringify(o);
    try {
      await atUpdate(SHOPS_TABLE, shopRecord.id, { 'Hidden widget tabs': json });
      shopRecord.fields['Hidden widget tabs'] = json;
      if (window._mqShopRecord && window._mqShopRecord.fields) window._mqShopRecord.fields['Hidden widget tabs'] = json;
      mqphRerenderPricingPage();
      mqphApplyEstimatorTabScope();
      if (window._mqLastFetchTimes) window._mqLastFetchTimes['products'] = 0;
      if (typeof mqccMsg === 'function') mqccMsg(`✓ ${sw.title} ${turningOff ? 'switched off.' : 'is back on.'}`);
    } catch(e) { alert('Could not save: ' + e.message); }
  };
  // Which built-in step a custom "priced on" method / link / place depends on.
  const MQ_BOFF_HOW = { crown_lf: 'trim', valance_lf: 'trim', drawers: 'drawers', tallcabs: 'tallcabs', island_lf: 'island' };
  const MQ_BOFF_TIE = { door: 'doors', material: 'materials', drawer: 'drawers', hinge: 'hinges', crown: 'trim', valance: 'trim' };
  const MQ_BOFF_PLACE = { drawers: ['drawers'], tallcabs: ['tallcabs'], trim: ['trim'], selections: ['materials', 'doors', 'hinges'] };
  // Mirrors dashboard.js's mqComputeTabScope -- same 'Hidden widget tabs'
  // field, same {hidden, applyToPro} shape, just re-implemented here since
  // this file is loaded as its own separate script, not a shared module.
  function mqphComputeTabScope() {
    let hidden = [];
    try {
      const parsed = shopRecord && shopRecord.fields && shopRecord.fields['Hidden widget tabs'] ? JSON.parse(shopRecord.fields['Hidden widget tabs']) : null;
      if (parsed && Array.isArray(parsed.hidden)) hidden = parsed.hidden;
    } catch(e) { /* keep defaults */ }
    // Ticks saved on Business info win (mirrors dashboard.js mqComputeTabScope).
    let bz = null;
    try { const o = JSON.parse(mqccShopFields()['Hidden widget tabs'] || '{}'); bz = o && o.business ? o.business : null; } catch(e) { bz = null; }
    if (bz) {
      const off = Array.isArray(bz.off) ? bz.off : [];
      return { countertopsOnly: off.includes('cabinetry') || (hidden.includes('both') && hidden.includes('cabinets')), cabinetsOnly: off.includes('countertops') };
    }
    return {
      // Business type (Oct 2026): true whenever no built-in cabinet quote is
      // on -- including a business that only uses its own quote types.
      countertopsOnly: hidden.includes('both') && hidden.includes('cabinets'),
      // A quote type with the Countertops step still needs countertop pricing.
      cabinetsOnly: hidden.includes('both') && hidden.includes('countertops') && !mqccQts().some(q => q.countertops && q.on !== false),
    };
  }

  // Per Jordan: "after this fix Id like to make all cabinet related items
  // in pricing tab to become hidden when the countertops only toggle is
  // the only on on... and if the cabinets only one is the only one toggled
  // on then all the countertop pricing hidden." Re-run after every render
  // (loadAndRender) and exposed as window.mqphApplyEstimatorTabScope so
  // dashboard.js's mqToggleWidgetTab can refresh this tab live the moment
  // a shop flips a toggle, without forcing a full rebuild.
  function mqphApplyEstimatorTabScope() {
    const { countertopsOnly, cabinetsOnly } = mqphComputeTabScope();
    CABINET_ONLY_PRICING_CATS.forEach(cat => {
      const block = document.querySelector(`.mqph-cat-block[data-mq-cat="${cat}"]`);
      if (block) block.style.display = countertopsOnly ? 'none' : '';
    });
    const trimBlock = document.getElementById('mqph-scope-trim');
    if (trimBlock) trimBlock.style.display = countertopsOnly ? 'none' : '';
    const tallcabBlock = document.getElementById('mqph-scope-tallcab');
    if (tallcabBlock) tallcabBlock.style.display = countertopsOnly ? 'none' : '';
    // Custom pricing categories only show on the Cabinets/Both tabs.
    const customBlock = document.getElementById('mqph-scope-custom');
    // Kept when the shop has its own quote types — their steps live here too.
    if (customBlock) customBlock.style.display = (countertopsOnly && !mqccQts().length) ? 'none' : '';
    const ctBlock = document.getElementById('mqph-scope-countertop');
    if (ctBlock) ctBlock.style.display = cabinetsOnly ? 'none' : '';
    // No built-in cabinet quote (Business info): island panels, the handles
    // tip and the cabinet-side custom steps have nowhere to show either.
    const islandBlock = document.getElementById('mqph-scope-islandpanel');
    if (islandBlock) islandBlock.style.display = countertopsOnly ? 'none' : '';
    const hwNote = document.querySelector('.mq-pricing-hardware-note');
    if (hwNote) hwNote.style.display = countertopsOnly ? 'none' : '';
    const cabGroup = document.querySelector('#mqph-scope-custom [data-mqcc-group=""]');
    if (cabGroup) cabGroup.style.display = countertopsOnly ? 'none' : '';
    // Built-in steps switched off: their pricing sections are tucked away.
    const boffCard = document.getElementById('mqph-scope-boff');
    if (boffCard) boffCard.style.display = countertopsOnly ? 'none' : '';
    const off = mqphBoff();
    if (off.size) {
      const hide = el => { if (el) el.style.display = 'none'; };
      [['materials', 'material'], ['doors', 'door'], ['hinges', 'hinge'], ['drawers', 'drawer']].forEach(([k, cat]) => { if (off.has(k)) hide(document.querySelector(`.mqph-cat-block[data-mq-cat="${cat}"]`)); });
      if (off.has('install') && off.has('removal')) hide(document.querySelector('.mqph-cat-block[data-mq-cat="install"]'));
      if (off.has('tallcabs')) hide(document.getElementById('mqph-scope-tallcab'));
      if (off.has('trim')) hide(document.getElementById('mqph-scope-trim'));
      if (off.has('island')) hide(document.getElementById('mqph-scope-islandpanel'));
    }
    try { mqccApplyFilterScope(); } catch (e) { console.warn('pricing filter', e); }
  }
  window.mqphApplyEstimatorTabScope = mqphApplyEstimatorTabScope;


  // ============================================================
  // CUSTOM PRICING CATEGORIES (Phase 1, Oct 2026)
  // ============================================================
  // Shop-made priced categories (e.g. "Finishing & extras", "Site access")
  // that show on the widget as their own numbered step. Category settings
  // are saved on the shop as 'Custom categories' (Long text, JSON):
  //   [{ id:'cc_xxxx', name, description, answer:'one'|'any', required,
  //      showIf:'<option record id>'|'', proOnly }]
  // Each option is a normal Line Items row (Category = the category's id),
  // so My Products handles its photo, group and project types like any other
  // item. The option's pricing rule is in 'Custom pricing' (Long text, JSON):
  //   { how:'flat'|'each'|'base_lf'|'upper_lf'|'all_lf'|'pct', unit, min,
  //     showIf, proOnly }  — Rate holds the price (or the % for 'pct').
  // widget.js / widgetpro.js read both (see mqCcBuild there).
  // v2 (Oct 24): options can be priced off almost anything the quote knows.
  // `how` values (widget.js mqCcBuild/mqCcCost use the same list): flat,
  // each (customer enters a count, `unit`), opt (another option's count,
  // `src`), base_lf, upper_lf, all_lf, island_lf, crown_lf, valance_lf,
  // drawers, tallcabs, pct (% of the cabinet estimate), pct_all (% of the
  // cabinet estimate incl. extras), pct_cc (% of one custom category,
  // `pctCc`). Options and categories can also be tied to other picks
  // (`tie` = {cat, names}) and categories placed after any built-in step
  // (`after`).

  // ── "How to use steps" guide (Nov 19, Jordan) ──────────────────────────
  // A short, friendly walkthrough popup. Opens from the Pricing tab and from
  // the step / option boxes (jumping to the matching part).
  (function () { if (document.getElementById('mqcc-guide-css')) return; const st = document.createElement('style'); st.id = 'mqcc-guide-css'; st.textContent = '.mqcc-guide-link{font-size:13px;font-weight:600;color:#2563eb!important;text-decoration:none!important;white-space:nowrap}.mqcc-guide-link:hover{text-decoration:underline!important}'; (document.head || document.documentElement).appendChild(st); })();
  // Nov 21 (Jordan): the bottom "+ New step" only shows once its group's top
  // button has scrolled out of view. It keeps its space (no jumping) and
  // just fades in/out.
  (function () {
    if (window._mqccNsOn) return; window._mqccNsOn = true;
    const st = document.createElement('style');
    st.textContent = '.mqcc-ns-foot{transition:opacity .2s}.mqcc-ns-foot.mqcc-ns-off{opacity:0;pointer-events:none}';
    (document.head || document.documentElement).appendChild(st);
    const sync = () => {
      const foots = document.querySelectorAll('.mqcc-ns-foot'); if (!foots.length) return;
      const topCover = 130; // the dashboard's bars along the top of the window
      foots.forEach(f => {
        const t = [...document.querySelectorAll('.mqcc-ns-top')].find(b => b.dataset.g === f.dataset.g);
        let seen = false;
        if (t && t.offsetParent) { const r = t.getBoundingClientRect(); seen = r.bottom > topCover && r.top < window.innerHeight; }
        f.classList.toggle('mqcc-ns-off', seen);
        f.tabIndex = seen ? -1 : 0;
      });
    };
    let raf = 0; const kick = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; sync(); }); };
    document.addEventListener('scroll', kick, { passive: true, capture: true });
    window.addEventListener('resize', kick);
    setInterval(sync, 600); // also catches redraws / opening a step
  })();
  function mqccIsCab() { try { return !!window.mqBizOf((window._mqShopRecord || {}).fields || {}).cab; } catch (e) { return true; } }
  const MQCC_GUIDE_IMG = {"meas": "data:image/webp;base64,UklGRpyCAABXRUJQVlA4IJCCAADQNwKdASrUAyoDPpVKoEylpCMionJpoLASiWlu/CyMbjpCqtAZMJzFEONaz9q4IA+j2bv8l+wHui/THsAfpn54PqV8wH7b+sd6J/7z6hX9D/wHrX+pr/df+d7AHlz/uX8J/96/7fpg+oB//+B68nf3b/B/tf75Pjf6b/af73+1f9/9K/xv5v+9f2r9u/8L8f3zz/df0/xu+i/xf++/yvqV/Ivth+f/vP+U/73+F9nv9r/lPEv8x/ZP9v/jv3j+AX8q/mv+q/sv5H/JJ7p/uv8j/ku9Bzz/X/7v/P+wL66fUv+Z/g/89/9f9l7a3rn+k/un7wf4r/////6I/Lf6z/vv7v/of2z+wD+Q/1P/b/3T8rPlz/A/tJ5H323/Nf93/UfAF/Kf7N/yf8h/tP3L+k3+a/9n+h/2f7r+1z86/yv/n/0PwEfzf+0f+L/Ie3V///ct++f//92D9zP/+KYpHsHIFGhJlrEd1cTTx3VxNPHdXE08d1cTTx3VxNPHdXE08d1cTTx3VxMeI2LXbsQlwugih+V+rQMfeYq0aKgyE/aNGWHlj2LlM7ypB5LQtlVYB9u+TYWVVgH275NhZVV/6+yXMOjPHfaKWE0QKsSPdz1SMPYtCCnxBZ/ADb7PFXeb5CS0LZVWAfbvk2FlVYB9u+TYWVVgH2741yYFTkKcMrT2MJ5V+6BEPwGCUpY0hl3jeqXLujugL9bdOMzAmZqb21l188X+HPQ8oSPiSMDotnNLTVdUG712SlvcEtYtEhK8OtmNygCNXec/nflWAlc6GFbNTuBWyHvt7AmILSucgiBcmLDtb3JByTSglKXymyL3I6V2RLQo48W0/b7ydxK6hfcgUcGy/nIJEqutr3ctr8FmlmZ3lSDyWhbKqwD7d8mws/sEkcxLrttYu2n0q9eUpPiAUQ96NNtrAPt3ybCyqsA+3fJsLKqwFZX+vgY7q4mnjuriaeO6uJp47q4mnjuriaeO6uJp47q4mnjuriaeO6iqS/F3Tvbp3qBfYWRh4ZVG9xd0726d6gX2FkYeGVRvcXdO9uneoF9hZGHyO1KWyoVdLHTNm93VGT4hfECuUhJaFsqrAPt3ybCyb9sOIrx1468deOvHXjrx1468beT1Th10AuVyLNYsd0TkAUsb12EPJaFsqrAPt3ybCyqsBOa7+6cGOnl3aMD5iCrPzc7O1OmfHTnRCor0qhoyR9wWKRvjiuZYhg/n+k6oWmyHBaCNFtXxfDSIAzEuY8qBUXP1omQvlI3CADRnYvkvz89OHzwCEWAslHRG421gOulKGzhNh80jyBPoVyLwydIPJaFsqrAPt3ybCyqsFazNeWeoSQtqm1TaoTkxe1eWhconwtcRbogC0JWeYG5C2S2HsqAuWmVqx7CO+Po7UjtzQZvo5Za9ZsiiiFLZVWAfbvk2FlVYLfQlvkuDzs14FhuvvWLAuokP93ITUesd+u7F5dcVlge2uYFFq08ufa3weCCOFDwSq8ANIW/6uFsxFEWFWcN2pA2g42KvvJUHf5pgPrUT1qn9zYRW+oh208KsUfhltllegzAHjdV+DLF7BOb14EGKazoxCHnqFJxyIbGoqSpEAzkTJXc8dTUQ7QpjiuD9xB0fmb6+eFL109IydLfw4g72mH7nKZqvj1cS+Kv1rNukzDmhhRl9iStDEt9obyO3EXM3+u/JUJTsnvDJ/HxA9tVOvT/yf4i0y5YcLTPneZcEGz9ZZ6FRsOyBkWLMirRP+E+vP1F2KSPbgyvXm0HyX5wRZG5/cXSFIqQhOi+lKedxOoxwqgqZ+DyWhYtRu0S/CY69DEaiMiqpb1wq8EaPT7K8Y7NO35c5aOqUEBjqCc6bE3IFdTEoAWMwExaYB7RcPSjsgLY1OlGpGCN+njQrs3GDN4V68s6dvdfvlRchtJ4HA9JxyJBxfiwivySH4pxWUw4jgyymmlOr6ACXNkFpLtgph6xrjfov7uNPmWaENLzlsow3MD0q0UKBXfTg8l7EmGlt749XeK06U3criht6cxAoPfQFcVEYkb5jIhVXhDcnRXvoFagZF+RCsKxAyQtR4FDZLuUR0LmUPGjw8i3XMmUZCrJ4V0KRd9Bu8YMx4RDcJvThFo84JJkmwKTivVJvy2iwiAQoJeLzXIFJxPxDACpzgEQqz70WV31h+4v7ZhoZjkTW0nZ9sdCdWNUjbfTEVfbUajSWhTjogNBPrmD4NP7DOqyCb/uNf2gkp9M7v+T6jxX63pE/NTQJo+TSV40IiVUOvCs/4hO+4J1pjqrmT8WckP+T03jcH39a65opw22b/M2eiGzmdCkHeHAkdECiVCShy4bjywRF0XL24K/nieAgQMxOsaTYTojBGSeN7HQshC063aTwF5YSjE3LUMtujCTuNl3XhSP8Pi+RA6d7dO9QL7CyMgSpZn9eQqlbQMHTaP63sF8BYimlPdFWPavjvIt4I4VVgH276cdEAdemGjF01I7uT847yRvR8KMowPKaWYddinKGcHo7gbB72IY0OLWo3jMKM5ZBSRN0O5SEn7tkQdgybQLmnLe9Nm9iwScuFoXQoNT3yY78vXJd2RrvtH8AQGhV+2gGvakUCHR+Xw7fK9OY3ac5Ug8loWyuTlMeNl/8MtfY8lnE2HK5A/sCo5EyvZjISWhcDFznh3v0tzlCRi3ZJEiQCjdiupyVoRlvtA2RxTh5aURJwLkICghLBK1mZ7OsgXaDx8j+aDGiMduIuZw+vxJWhhv0f7GaL2sH8FwmRGA7OGLILmcZUxZdDptUxO4ZLql1CkJLSLTPu0OIofotIRCzfDVpvqtNkP/q5dCFtX+cG4qXWlJqkukTQrqjQjVZTxcypwSD0Xp3qhJof4sZDOF0ZWwrosESzaU5CXUZhfrRF5Ou1KXs7mhngIXOOaQFSpcQC+wM0S1iTxxlMF3MR72nhJAMmdivO3fJsMDFznmMtGxI77k28hrminDbeH1+JK0MS32XH/faBDSrcnw22bw9N4NDEt9obyO3EXKzhELB8PmWa8vypUcqDc9lL0Nm1usdMLGa7n4PVDYyNPeN7f9Nsu/OEJ9HkrVn9iIinGQy0VMPAPt3046IA7ieFyOKgaRhAV4hnOblVDUF3rqmaWQVToHL0IoEPXsrwuwKAJANER9DjPFamWq8fL/aOAAMsExfxdc71Z9iUWUE2TteO6EgAY3ez2IOY+ak8wHJiUIWNf5P1f2tgSUSjgnrrf0TI2aH9ITX3QRi9l5nf1EPnempYcN/U1htIbrtVFIRiiPOESW+GLEOOWyoxYFBzUkPiDt+FbdOCxLMWr494OZJli6nbDMEl5EE00EdqN+Dkgh1wVcniPlUeeJ67a4jVcsw/dnvUHqD1B6g9Pf/CeHy7UOCuUhJaFsqrAPt3ybCyq76nT8IUw69MnZ5rskYbKC+bAyB7mhGhppckdMRgkZgechL7MzvKkHkuNs46ZPsJ4wHKmvgaOqJd9nBZzasoUmPy4ItSuUhJaFsqrAPt3ybCybXnJlXp+O5vkz3G70lhw39TWHDDRANu0z+T31M/grw6yqnDbeH1+JK0MS32hvI7cRczh9fiStDEt9obyO3EXM4fSr02TWoTfS8XTi3L26d6gX2FkYeGTbu89fjD/ScWOkHNhB5f4rKaOVZdiokHXK7ekKm9VEAcnbZM3SMcteeroTOq0ks73jRvUwwzk6jWaFsqrAPt3yYG1irAPt3ybCyqsA+3fSB1p4qH0Za9j83VVs1JYS+nR7ErhKol5kNc0U4bbN4fxJWhiW+0N5HbiLmcPr8SVoYbVnmPczXSrmd5Ug8loWyqsA+3hZKQlyT9Jqm/R0FXYH0n6T9J+k/SfpP0n6T9J+k/SaehJaFsqrAPt3ybCyq7tcQmX7gs2k4ORzRuzD26yDFHzlB9rVH0w7tfKFVNiITTi87MAmiSl93LEi7Z/pkohzg+8R1f7OcHTz2ZneVIPJaFsqrAPt3ybCyqsA+3fJsLK5IMtTp8QAeRu819WdzDsSBQlzHx8tzl8s8j59cMDhv6msOG/qR4Lz4mwD7d8mwsqrAPt3ybFh/DTgwKEFsjtqzXDQHNpaDNSEo46/HXdv8AooQMZeDG5CUUtxg0R2gN0wWBNN1SBLoQpASdMlooDriyggrXU3KxaTwxG9Cg6oF50RAxgzuumIyoy7R4nWZuizVsFMRCI0+Aq0LZVWAfb9Afbvk2FlVYB9u+TYX1qYyFG7JGOg0PnY6DV1NYcN/U1htoO1BneVIPJaFsqrAPt3ybqbRjeewi5ePhElqd1IxUpisC7fSzx8UMPAPt3ybCyqsA+3fJsLKqwD7d8mwsqrAPvujA+VIShbDUdOWi4YvaDYcKei77S3bdfxkMMkjsMTTx3VxL4QKr8sA+3fJsLKqwD7d8mwsqrAPt3ybqc5GoDCVcW+QisMmXvmegRjNhKafKQuYKxuz0mO4BrlvOVFywOxAOCMfH7ef/HHVAaS89PQ8RCV3ymTKheNJ2vlV0WyqsA+3fJsLKqwD7d8mwsqrAU4Wg7P8CqZGd+nXiNLJ+T3NjMPOp+U6Wbm+Qb7guAnwlRLDhalsEvQHGzQjT01y1OVkNn7gm39iTserJk/SDyWhbKqwD7d8mwsqrAPt3ybC+pfjKs3dzfc5ySWDO7av6L0PAPt3ybCyqsA+3fJsLKqwD7d8pajexXKwL3aBk/AyxgeapPOnWozerkXEkbyc+wfjO9THwSy1ET3quZdPmd5Ug8loWyqsA+3fJsLKqwD7d8mwsqrAU5P/zItyoG/evvMxZfmwL0mJK0MS32hs8grfrinBUV5Ug8loWyqsA+3fJsLKqwD7d8mxYfu+iEfnRxppQDjwHzRbp8deKYfrFkVJTQmeX1DAxBhExpnCLNklAUjcB6KZuAqPuNauzDjbObfD2edtCsV/P6D5tKl0MiVUwtYJ7sfaWhjNbKqwD7d8mwsqrAPt3ybCyqsA+3698GpCsPwsk+NRij+Q1bzmIsSMjzyGuaJ2OybSLJEalhbyqsA+3fJsLKqwD7d8mwsqrAPt304aahNg3/MLprH7RJHUNXKlhciivnxfrB+WJF7zWs/OVRctWp2I8bOrG7ISKtdv4Hkhxl9L1YOrNcjiI4aqtdCgDECkfzZCD0E6ReAiBuQDcG6FOKqwD7d8mwsqrAPt4QuXC+YB1HrJIw8CCfx94iAOaN2/YjwaLiN2nrKkBCBeyckTqnTqLKhwxIF1j5GD4NlYED2vUnB4oo6jRz7ahUmuowjk5nc3ITMMA+FIoalZ8wsrQPnXsBEahoVqf1IuyPZS4Rac/JhO/0G3GRo2B7xKSnEGYb3FfM2rGNx8S8QD7d8mwsqrAPt3ybFgUCqH6MehE8LjWbBfYTvCLkDW+s4c5NInvpQRSL66KBFwYVzuYARhqGBCx6s4aMBK6OQaMB/7lc9nuoa3qJQPZOAwxuh0YdSUAEgvIgY5DCRTzENOckkDoPQTMzifEKQktC2VVgH275NhfTTQ7u0yPu10Mm6ThWAcFO9m6yPYVPgZ4z4nAVbZsMJHG8ffkDfXMS9cHRsXGuHRaunOvroadR4Ar5tNMM8A+3fJsLKqwD7d9OGkrqYbkdpzrLwLzt3ZyebAQfmP3fNTf8/COEFwe1OgxVaZbG8d1scVUAFChQvey9eUcKGGW7jfdVqIUnra9Gn8Trkd6oO6skrpu2i2VVgH275NhZVWAfbvk2FlVYLc5xCuyUKIVRrOVgDa6yJrfDKo3uIM7yYwEmXSi2VVgH275NhZVWAfbvk2FlVaMAbNcOB8iT69Kwqvh577lysKYwD3TYWVVgH3swH275NhZVWAfbvk2FlVYB9u+UguCYuza388d1cTTx3VjF2plDPAPt3ybCyqsA+3fJsLKqwD75U8ApjoRfNzvs3f4d4JPQjjd46Www/Le3eDTWjsYOld01rYi0RZbuWS/q/Mt9DzeH0PvGZTz94a5buZ3lSDyWhbKqwD7d8mwsqrAPt3ybCyWC1YI0XE7SU/OXKvXGVyMv7f3CLsmv6qRiK8deOvHVJp47q4mnjuriaeO6uJp47q4mnjurgvhlfiBYZJ+eAA/r2B9UHE/ZJ/KkNjvm0Nx+NxEdb+b/QxxNCa/B56ctjwdbsK28KSY5nz+OaOPSU8Qhouit5WfRK+yqAAAAEhSjDGfOQMq5iw0UlKlpK2TaJcJXhDEyjTG8XE2xOqGqA4YnXJ7vReCEtvfLiuQd3my93/CgzJGgqikJagui/QY3Ia2T7deefFpkeWXKwjfkXnIQF6AZfAI/COzUYWoBOCEMMpAdYav9hXkhkqc/YzfYUIlfDvW5JCQ7R/QbZhWDRx6pp9PtZxjwz3z34PI1kSCmkt/LajfAJC5ujXaVCL5rk7crRIDT3VhOd9iTE3/x46n5w1sAY6PxQfUI50VywiPwEkoAAAACUj1YUn4VYusqJZWwYIgIqvS2B7CmWMxCyA1I8+8nYPbapMFNDSu6I5Num3qXErjpE362iMoK9tRLvbo0E9I6KXKWd8T/1n4Vm97+mcWtA0l0el/eR12LufTWEyk4Cb+JmOSDz8tY2WSlp4Psvcfh0lEhQOJ6YUkfm8amNLRni2/DSn6c4o/9uqI+Bz/ZXOxPq0lA1e9Fdv+egPvXRBnSTuNpEtFU2SIcyghG42vwiejWOq/pcaYmlj+CEcbLOe0qsrF+TFn6HGjoz+67Zowhi8x0U9caFiMQ1OB1eHucF4YAUl3opRmdPy6/8YuNDFGqT/N2ZPtFvzXBFBYyhbQrZzKXrg3Vd9TgVfiruAZxZAPUQaiofkeZ1KfHXv+kSjaP5y2cwfqqurKn8J3QSdEUXgAAAASuhe0nCIzXg/9QfUoKhPr2cTWl6jTkKwbNty0uBAC6i1B44Tkg/epbHqsn2zZYSaNdTlhEXeZILf1F+/bAAkaDXwBA5pRNOK4WRH6HHtlWnfUUglsXDGeawilTDB9DemM5EClcGx9ezJ8acaAVFHpmSHCZRJGTqZe49ADVIoHISOuliw20cEnDO2fTTDor1Tqj9et5e4Ot29xIbGxBd5zpVtcrp6zG375rN2DbQkjQSy7bdGUidjYI2802Wp6An7eaPD0b+FdFfA460pshGTTcfRbR/aHzwLTOo5ioD17zkZkdY9JABwbdgOQyyzPOHtirWhSgFFwBIJ0uzls/ff83wW8ckHwBBdRuluZw9qf690tFgfhVvXwUKhT6fIiS1HDNDSPvNtfZgHUlaT/wWpQjRjZqJhIw8vn/lWrMgR3wpwovILRO+sR4J/icbqqwN4dSysGFSqJMFGXBKSS+b1EcpEL1qWKYvbnBxeP7fNisU2ZiOOx+bwXRFKtsBxV8LqYU8RRQehBxTOqXsPeavb2mSYz0NeW8AbqtgwraLjRHRdW9PwRoLL1wZADuEfFHkFwQPrhT/YC2hTW7U7qK27mnuuoKrt+/vxqfemNthqobiwWeyXISZE3apPIkmIhGja7+XfZCVr2isvnC6MQu+h1WaW1b4lP/ErfAta2M8ho4RVOagvP4F87r7EwwpZwgoy3zWZ5+g7llBXmrToSqjWj+oXNeT01MKeIooKHRORlffaoBIxx/g387bXCM2Xsfv1VBouuWdjFD40Ad7Iz2ziaduB/w0i6XDrHgMG70qB0YonjeRWKlKKhp/iVUlolfSOnPrN69WG5CQT54yaFjvQql/MiZSERk5mbIwTGfaoVYIJlzmEwB17HRWzX2OZROR0LFIEFFlIRAHPwwBGbnCgHaOk23RVkmlmc0BSIjF+RJXWmxldHYIquhtcwMlMsadkJ/uTXREGm4zRozDAaBO0Iha5gXOo9gMNa/ScJjwvoBvROtj1wa8oc8m0s/N90E0c0g3YEy7fiVq11l8g3ZKQrbPp8oCVVYt6Fr+QUn5CVdNnLKf/GXA1WB5/lVAEGujwuZaNsk7UreY6Qbcz/bSb9sUW/bvTS7TqjrufJpMkFw8GLDdquQwlEzzfQ17QNkPzt67lBrdbLfqfAB2CWTG1YV31JLMZwbbAZt4IlX+oj5cG+bkFSRnZBi9p0CIGuZoSvE06nltWhqdbK/CkEO9c638Rf8d4/L2UzxgBhtQqXrwuOYJKXOZ3SCzERTHod2Ysb9JQETbz/yOYxSFe0TwdNzLnNOxyL/UnHigcJUlEF+1YRiTrlmC0RFIs5oR+sTFStUqhNU9WUFzvRXKtcf6v7is7vsb3TBwqstAfxPAPbe+vXrBkCS7rg5eO8688OpsY13lmOrz0nrb7vrjiGXSXryjxxvHSQ40Zk0zjBnOmrZDk8SPe5ltr+SXbh+X+O+n73wkydfNSC2q2ylaCjseecU38s69TBAEjlwRFaZA9o4ees5wplnQAf0nc4akc8c5fOltoTjlo2thxVYZqUGen7IKpGicxq+7hhxdFh/eRDV1iE+kfvAOE+qYjccjVe98dK7bgsIfdR7sbAtRMofwkmb6dxTYK2A4VaBUehI3NvgFZoxiGOvyt/xXwqLoUlVD49fGOxEN1m2PEBrbk6dV8Tfz5VP2FK8nX1+prJZepwavKPsVIaMYecluO4lNtPlg3p9zqkMlVPTon11fWoFiFTzS5tFm7Mkw3+WkJdw6qB6cmgrPlfyGokfWjOdHv1zaY3LdxArp0hVqaDvG52T5YULIbq0BIvA8KDQyALe6LCR+/8kucBS4LcxKSg5XROPiB/yL0gqHiasZb4dizRVYl54DbZq/TXsbpY08uQTBdKhIZkMas60hm/XUtOAvgARTK6AGlwh2bVBQBuBNVuX74dKimCq+28es9qjONwFI0S8lCu7dy/5mEgZQz7waJRN25q9Fo/43hgZlT8dRw56OPI/My54GlSpWbofR6begkdovEu4gNusJnZXDUVRGqnuB6QiPrBiz8fTTiWDS7MT7tLfa+6Jt2X97g8Z/OHw9UwoE44Muf1ZYznUL1RkdlIaKjDGloNHCIPywwvvBVVlt5Sz+vgL44dJtgSHeUskfpuO0zfWrgg2iL43zUoXltMguNqIlRVbtAO4etLrFiRPoUHLDphB+cMqwBFwJI5Il2GQ0i9/FDH6KbdTAM4Kl7Iz/O0qgzGQXgIplDW5Hk5c5K4yGaomGJqlykRb734vYY9jtB21c9T/9DLBy6GeNTCvKHOlQYuSYsinMDQXmlo4YzcOwAAAAAAAAAAAARIg13Fu+AAAAAWJU7c+hI8wAAAAZbydYvjmIP9m3GWkM2e2+ePNjiNbWVqh3RxYG6P8P71wtu3Ut1Z0uJGgwIXYWpDPI1wpHv3JSVEUbNb6YfNCCygUek0yRuDGujKEeLCYpJxYN8hD94OUwgEzHlweeKj2sANtRgN44gkZEWMBoqSOHBdcRX+H/oKTq8F2YOLYj8lIqUWWWSifMff3oEIAwaCPUYF9iZByc8NzIuTXFQf1pLmFwzGwg+B3RqU8r+Yn8CA9Dp4P6IF7qv1x0htzrEV4Ku43Pq/BcpopegAAthhznegDCwFWUXpqzJ/rX160Bm/sr86/KCEFVMGj5tywF0CIaTgp1LLT/mQpZv1faUuPpaT38+AaZMi8aE9VcqhK5zvaRyvNuUAAsWqAl+ln/j0fgBrUhQ7HjGawenqL9iVxw2jG2rfDL4PJyF1LF3oXnwj6RruDNEsyf5ICBGLoMslEmX4Lulx7Zh7TjciLioSDXMsjfgCe/2pTIn20+KASsT9/g0YzsYNsuFWDud+XqFmDkADfAffq0Tp8oBZpwFCEZFj76Ueo3Un4T7UN5B5eHt+TndwrO1RgqVf/lMYI8VkVe4Tu+hQZgFIpL90vCO0vIUJE4E2Qm8XOZcjIUzuH1pwfdhjVKiEGxa7jWAbV1s+4jfWBHigS4uoa/FnQ1AIr3nnhOVs/hJ9mCJREvW/3aAtmZ8RYcfTepwMT7IUZPHkKhhzMnnSKmGTBk4pYyFkchxZTUhRChgoNdFCnAgS+0lfHS31KZGhlonhsIf0mwytNZgD+1E9f28lPg4dCvAfFENXMf/r6PvAYlG6hCzhCqzeKwwQ9w6s2rLTR9g7lUxkidK4LopQUhT3grHUBchnnNOjSYfnIjxhMjSZJYoGtVx9rW93RF5qbYOfGU9miWpOXMpq9pafxV+DjAa84SNe97gLHwORKILYzu0b1ampqZLNjeM5m52NW8sI+TV+ofnt55ARMiDAqaFNU3jukJoKvSzl+iFvYKXrNOXIvYSKznJNspGd5aWxGjCb2LWXOs4MSYm0hUQ4j3b6WGLpvPryYmqBT540wpJnt9JKwIVfg5whGcAcQotwG5aMz9wOjudDQFxP2sTHZqc2CmX7fORasuMrp54bA12vQiOvT0JPrGwMw6obnonKjv0cFEqZDdv8vTtJJ3EN1EtZjdRGU5/itESnKQyK/Cu41QnwJegToqWQaM7AkY/bTQczaq8qzjwFCa491j4vPxx+wCu8n/lBhZ3jh48QUeWOIkuNuDUxm1vTuEGAvgwXGipiE1x3Dwa63SMw1n909OG3HOzKFGFnz7aRwV6piDFhpYUC/+yipp92pWD4yJeqjL9o5oeAI1OdgosJBUEHQ3G2NWIJNdC9rUNO5kIk8JlHhL3aWvkIspojs4t9ZfLv1iPNx/w7nHP74kgajgLwetywAnFXB2nRonxXmfoilw8G1RuejkotHwlwxCdkoccxonolMaQuzj7b2FZSk6xlzE+Q5Jai7tsSORBE73wkgbV3nCz61U1eUWTuhwqj2/nfbF8+0eHRchzEw+71bddbCmR4TTQYwLgU6+KPLYLxYWWdkRgNDKTY4UeiCzw+GMm5nGW8FoG+OqtqpuRQvGAVJjVs5mwfBCfjRw2hv3mO0le2DDFYF0VUrIg+r2xfGaxhLUtJoQ/Qy9enQfJoZ5mQdgLgTvYkaWKV+/80sQUo8kVtk62dUeP3tt2xFm9J6UFa6dn/0pAc/wAf+s7DhaOMtP6H1qZz5x0nqFtra+Mdb23Zdu+PwNHhFdZvFEshCECEuyzAwot2p5fokAs7BJv0mBcl0nyGTv8VxbsQD5qAIQ+T9MQE7IVv4jZp9vdvdbkoqqmM51t5uYABe6sv71J38lBg+3/WRXb3cQbY1JNsaZ9NN7JETA1KTWCnCBlnYDN+KeRqhSbuiXtTb+iatdUsqZyCwMV6p7uJAyCerwHa9z1bD4wvW2ddYTbtCeuzsnc+25QNyMwqtXz1u1AaxyJBekaVE6iCnjq5y9GY96AHmAYSMnHPfXa+l6n0uBEuDc6YGPgBLW1ftsi6ZuHxffHmypVH2d0cJ9dY4/RIoS1sClk3G8rEB1Tl2vx+pby+VcJS0g5YVWhuS1UYoUOOHgjL/F1YnF4tGBIV4QzBjAZ66BLoBa+nB6iosvzxianVAgBN/C+ZinWVKIYkB0CpQ1acq4nStkCW3FAdexkiY3IRmI7X/xBXzQpEJw3h/kKRxBNtJoewiZGAgViEsdd+L6Hnyhu7enDa6K7/558+N14iMpb7JiJODFreHRQgp25Xrd9HXEGx5Yu4rVSGTcRE7/t4Bp3tWa+fuT59NXPac8z1bqZKBxpumt/maRV0WdpHCfXa752ELPyAadi5HbpMDplNGTa/H6lGXdU/yg/tklkf70dzwgdAaCTRWHfWL/HlUqKZPl/1Hb5fobonEYW1YXqFRfQXMRoUdnnPaGzWHrZwx1pc5vszh2mXqVPSYIwYtvtx3EAEGK/xprc7YQX/YsB/flWilf3IasBC7psN4WC6fY2+3Y3vi4zp+opFEoMUlPGZFOX4eg/ykrQdRYKZvMjU7W6e9ZlUeebYG7dpgLorzir+u8hbF398UTYd2lejOE+5sWNPn4az1pRJrZ/aUWBi8Zw8ET12sipqvXkfDXnKfXlz8zCxjGFl1AcdCLtqQe0/70sbNXDPz/FB+HdnRoGCTSSer8vzrVy+mv4oqm0vAaMGM2t4rHzl2YMy7Aov1XdtHQrmm5BbstLTcGjDrgdW99EF9iHiAvkJ7B6EI7Fqp8rPNVq5vhq488qnTfGQKC6qOddO7rLCPDXWILB/Ia/SIch/YuqJZWHGX544thjPRxY8eOEtvkzfdU2QPdaWdqGjvOU/ZFn08yZF/SYFmri4Fkeba4yq++4EaShOdnpmagzCtXQjglWBstSputOD92ZvlgF55BUHG1pxO3cc7UUnq06Tzx05ymZAoGACFm2PxST8rD+qcRtc+Pqwl0uuPkdxu24p1f7aZgwT8Wap3TbhzhlF0EjHdTDK571ZOhCLY4Qhq6NVQyGFsV44jrMtFa8rp9qbxpg1dO75x+uUsNc7Yr3a1fUnBFMW+BwWrwdGqQDfSIoHd+oXklO9eoHBSZ1uutO55pWzsm1Sqe5Rkn1D5r/+ToSd0Rog5FVyvke5a8LEka1FxpdW2YbPiqE/GGanokPMOBobvd60hidcgDkjremyY9Lk9vd/+YWjYoEg4t82dBO5WQUFvSkbLgwHURsI2sdZOsxraV857Qb3CEZAWNJocBkYHfmanSfjqB+DHw2UWFtQRvSAc1NPJxAcV6zv13ylQLDLiwKlNHDpUc8s3eOePrENjScSA7e5h/dpJX0f2Ez3oUtoK2ll57YqyQS9CMZX+ARyzH+/mXxJ+My4MOnR1szpdgRU7XxlgNrirCZfwPYlmrZrdZP8J2kZX97PKr95Co0skfL3k+jrm1qf76h1VuiHayk3K6bUb9Lcb0h6UGYO8Wy2lqspCZyvKwKUCh7dB/95SDfCO/lk1Uyn9e3O6L/KNUbkdruNTJMvWJmp0+fPjCiqOYD0ggNCvEqGV7U+CPw+o1zEiwoJiYl6K7ydXA3EHG9WTw6ltFWTyBeeN3tTrEJO30mNAxsmWRXqfj7DkySTMMXX+lYrt7FNZuLLeqN6DyanwLr0vYXBYoRK1EnfBSvILU7gCw4aj6UCJjoYERNKj/043DecCKIvYLcFw7sznWlT3MdZ/Bp7FGwbdZmRzern17KEuxrKp7KXnUQOd4M4hP3fMaxgb+GH52XLwN3Y0bfmwsd+/K4WDx0WuksA3A4eJaED1RFsC7B6ckx8HP9xi/SLL+j1PdXY1wvuDeVhtgtdBjD+Ot1wxS0qYJCGDqixJaC5iBm3alFghnjz3NIumV/7ZUlqEyrr0dOi4FjGkSlmHe8uVieC7DfkEjpR6d2Gy9iDLWUT/HjaxfFbd/IQcswsc19BP14FkqTm/uGFdz2LavZGffBD1M7pbiorijmC/nY5UT1+N3QNNZgy83PeFagZerSp8YF0aTilXDyi3qgEWXnBbgKnSQFkBN61WCQ6szKYkos+vH1cGpAJca7b930r+lweSahvitstoX2j7LwYlq1O9T4O7e5DauVI2A+UAqTYTDBAq1nCv+40LBjWF5LTF5DduG3DMregomgv26PeZuplXLftkHnXe9jv4BJsD+2esESIlfRi9+LmNaTBG8ZSN1gkygSf3GL9Izzurz+8sHFwtnktabyxtN5cU8yoCjfA2oXKYhhX4svx4yQHMFMfD/lSaTE3UdnkWeBUUI51h5aL9Dadeg46mH4KdUP6s49MnuM/9tA+SyEe8wjJ013aRavrETbzeKHFoCdnkcdVQWu/OjuFNML9THuJyPhCTs/2oqiD08izUmdqFpmgZFFQ48Ud4cw+OY0QCc9fRgOBvXfaKWzZpZNLaHNBEzG09k2RF3uSe+1Oxg/oUVuO7Fo6wHdg12eF33ekSeAH5wPtcUcnHL6sRc88GICjOovM0ljZAyrV3zSzPS0e5RV2Hl/tzN67h3DXdBExqkTx+dxDXF4RUeVpVyoPhZY+IfGI9rUi82gsimfGsNlHCRLlvmgD71e0SQFXK8xkr0EI2zZs2bNmzZs2gK6ZfArdVI+nxhbt3YJk+o5x+35LESNLSiP261JK5AqAg8zK0AFIimDHjRlgzzlZeVXj/e8jQjlWznhNgxoDHCR79vjfmeI9w1np5MHq6VPCj/HapyVu9ZbQ848Lc/afQP0bs5Z7aqlY6qYYeoFfMmK3HyYwih1EqNJZBe5HTdyjfi9cS/LGqKicUeRKzoG3nwZIVrCCu7PQDjD9AzO5zd2FzpYSleQO6OIQQk6fCX9QX7HZFh0D/GDPVfNShTzcqVQjtTZ9j6UocKPHr7AAydUWpCMI95BLWObdPGG8CPTdkXIQxn/rau5ziEisKvPWXbWst+2V3u1XfGZ5SgyvFHe0IqCD/7Dsh/2XY8y248tX4mMMCojlDBBHuOqu5rfdmuIaOup9VcAhYN1fkofMeL1N6xZvZkOwmUW2LS6KF6KZOhxK2xJoREZp09cBTyrvOjnJKN7SYsHVr80F9FnNaC+SCRYd9gKyWFGpqWWTv33ftWS3DNGJoqkJqH60j3uoc9M0d7r0gEZ4khbojwUjTvk8E1+iaS7Ay5tJfd/ARhI+QDJxYI0OUKc3tj/NgRpdI29vc5X0WRIrjU2ygUvpjA1EPZH42teWezuk9VzdmrA9w6FaBwQcKCSLLbdorMBY2G07fk0kyIXuMV+ww+/F+z9RnTQ7hcjHGHkc2uapstVd321GVmlb4+POQvIum1YvO8BBPx+5lYD7zOwWvH4hj7h9cI3UuQvi0X+yS9yjz643D6K0xSa2Jbeo82csj+E1+UjcBFud1yTBmnHN0/EGHSaXHP1PQ44koTBQWBWUog8sAWyj6gLGCFvOWsJwb7lNmSfLLO6HOxuTaU8aEdFNWjOWsH3ie4oPDpace3hUA+0/0HF8MqisOW5+vvL8UDlXu6fger/Gs0JHwoJ1GrRuZvffvhlRsJBp3vsgOEQPqdnvbUoAxlpqJ/XSFbmgyaDOCEEmFp7CtkiGPrgDvlOnpy+/1dCYXRhjNE4kHe59BDe8vxNrNNSfFTNW+QUJxop8pTKbM//g+9YXqGt79qJPYTvPGWD5AXVqOBgXQqs/s4eIyD1PpK9A49TaTOlLVczENvj8+HbV5tAryBo7/WfMDLP0Cpd7LMOQpFj5zp1W9vm27SQg0D3Ipat7WKGp3V+cGKfzV7c9wuzdZXxrBAAGytWPBmB5qtCWd6C9zZBnRXx5u3NZ8J2+HoDvSL7PjAHE75nkSy3PD2+cmz1+Rtd0xpf3PE6+sq2W/t1bhphLSS8CMNUb7QixY/W1B+ShGpWZZCQUCVJRY2iymJmWqrcADAcagKNOmejBH5LNWauYzkfIdgzcN2UNBmpoPMkE0I1QEQA+mDTKxQt7vjBVauw8tK6S/hEOFmQb6ZVHU8kjZ0xNJ10vKWWARD/VCF6B6AWATFofUHc8uPwJ7R7r5VcWXmXeo6emhHhq46lUoDBO0Lyko5HKfTSHjyYAC5gUixd9NRWv0S+619rZ0iDbL4Sm40F3O4iItog50yEvblORfd27eoAd6PXjadbjE7jprRzuKhC6l0m0T3vxA8FT04Qbyj10pI7XWfc4cHHOuZYMaCEH/fKGDBe1gd2bOZFwpb2tCuMw8IJEPEpj/LbtplJLsdLaMEI2fhfEZ23kPdGyLgzIWNVVV4rtfnLaDOJ55wSbDGVbhv0mwRdp5JR0Oruq1GWr0sAwf9ciJ8FCZTIiAzRr/P5DKmnxt7PnYH9zQICNL4VixpThgoFfdJo3T+lSA256rCLqnheC3pUve64n6/e4Q5+C+0fyHG8hwoURD1BOILecMAIfb1Yl+LVle+yFdZabFCSquYY+1IZR6aI7Bp+O/RhkYUNMDaz2ZtVFw2sZqKcXnIuTgynPOm02m6Io43BH4BdYodM5XbgynTfB1g7T+jsvXSqFmZQXxkkWNwf6Ly9U1QllfIzDx4udSbaOqTI9cq9g4CLMBAw3oLiCBtKoccF1Tlbz+yne0tZApd2gGCX9ycpcnY+s39Xei9hQIFzSe8gSj+z/SXjKacO/pzNoAPamRJJTtScW85aKbkQUJjfTFgiyNqo6mt4bBItpkYcwG1W9R2JvWtNF7VCTGbid3Qczl3HEiGhl0WlabY6e0W8ao+1zTwBGxL2c2ACxsKmaj80zWKiI07fTVtd4Qz29aqhBwEpl0ho2O6+jl1LomCKR4EuY7AslTpfiCZloZCtQoOsLzxPg3P6X3OceEOpD7gT7uzb3XN2JZ/NWvInOG9kKL2V3Mw6Wv218Ji8+KIxvlYgBHpWCEtkR9JWCijrCiAyUwUJNc8MuQM7vtRbB/+8Y2367TF466jhhzEI4Q3PFfUlgbgpkDMmfTeIlPnkPACLr+o078jYrsJmpQ8nh9yQLpmiZ6MipTDqqOhwKc1RbSyhhLRUnIYyW+uU8DlKOr3IpJi4kDvt7CBSK5m/lFaWpJ3bjetm8g3/smcXF56pCySCQw728KnWjOy0S7bgTCmJa1mXF7nBMeR8oxjUgD3AvtsFK6Y/pWWHr1ZHxrKlHXDTOMwGr8yl62OoOMis73cXXDey5/D3PNCjKlDrAYHnof2/ejifi64th79OwCKgWIOuTKgA2t4u2jzm0iqfI4u2xT/6RpgxZystxq2EjfHFsiGgKcyPuR9I6nk5S0TJuxL754vxj9tAsRMjutmHWRKga1rzjzmIkABAnGfLiFaqnFxY2TwzDP14kbBBXiwNZ3dWbtCpJFFNJ8XR03KajbHjWM519guavPZr5tBnp6Y0uRM+Z1dhyUkIwB8mdi/zXG3+qTSN8kNOhjzhDvmXZyKLpgzKMk3s6RZtOjrWXNcNQivB0z+TcysLzkOB7jD7hwRYai4A/g+Rr7UqcPFUmyN5UBH1hDrmiAYjg70stxboWwFSuBQk7hWpuvz8bdi2NUoqA7PkziBsqgleZ+2imOY3WoPHIAQ0amG/YakBPl5j8wGuwbJS6eAsnNAeUhUrCWB5DDUm9wAcdia55nTvnay+3Sjp6e7++PIYyHZPCEm7VbBoj6GNoG08V8bTZPv6cvc46D0Ko6Hk2aLAk6HnYhs1hFc2XsfjUqYKXiyJj7fjYxTCpVtw1ZpY0uXG1dc++C1NU9mgVFcJyfJrowOXXxbSvjOU3+TTMsn6RS4c+1gtCsmDuSgEQQomW+GLyG0kg+j9GkPjeSbAn0JK7kBGkfSr2/EOFfbD5kAmdcCpqKTN9uIy3DKaFUPdhSGK6k3zC3uKymG8tdLJkBLC20FTo959qEHPrZIMgQiL+GtQf8M+qvSOf+b2wzjnOPsQFibpJChcBpgESDYikOFvyfN+YscR78CPsFrut8kvwQjMLVyTk0WNOREBiqM+r6eaPDmpmRWlSyX7bl1tnN2cZkBU2qLNNdr3IieIvETOJBDprjExlZT+i2SoImpUvnNMkLSoPr8t9X1rh37QseOecF4Kh5hzkQ8/8dJfgWAYoKVUFpbBvqSnb78J87kVpWVHa5e7ObXKycHpXub5VLsSc9ItY9N4YdRoX0QMxL+edylDYni1B7hq6a4GaJ0kLMPI6K52OliMdIAvMYOdeKqobiNBXJQjeC7z2tDSOeu8kbmMdy+Lmz8YRGmiRkmiGs+zI28X9a/+JnIq9HKbEodXheBBeQwjRoL5dUPeEdSvbOFGMMm5evY3PyGUxW/TAE4Evu1x3eN7TiLLe6CZnJUOtmb+m86JWFcS+LxqkVtaYNyW1SVSzib2JTM1Js35EThDa0A2ObQJ67OH8NbU9gkHmyUCJq7m/W25VSytP5waG9O5vjeWVdrSQnP5qE18kdJkcO5bamEEerqpPfJU15XGwXd+iI9+cIjnFGKcJD4xSBXGGhqAekdHOO2pxv1z0N9lPUKW6rn33e1Wufa4x+5WLtEJ/q9uoOKN7hJu+wZGFKBh2gBgV4jyMxDy8cXAS02xOGKgoq9BkvnUFH4/X8j5qK9cOZUvvQOHNnh3i6tfyBERFgemURAqmgTSELpdpSS9+g+zbXPZBMMzBGVqkQJ93PS+BslZCZhF3swKvN68Op6cFEkDegYRuSFztaPOXjEAUXSosyfTr78e3Sd7AcJMhx7tcVEmfgeC2AGByz3DNG7NTkr2Gt7/k6vv5Iytk1e3y1pwKStqTg85DoaOLipEEpg0w+jGFLCoFBCuI3IaEnxz3G4juNaqT7KsXDnQw7Zs7XKwCmLNwDDEpjxhFoMkHWwFbyZY0UEB4/bSIiNfajAa91jS2b//7FrDA+Cet2OrEfHnf6Nh5hTtNsu0XQ0Uod8XXvsWu/cICaF2rr8JjG6Y8rqqQVCidvfB0f5c9sOgW+W3BzrYou3mycn8HFKJxucflxiXPQV+kIpxuPwKBdBX6xxEsIU2W74zffJRP76bdULl1TPcv7oZXxrcYWB+HEIhZveaPyawpD9ox2PVazaHo+rgFpOpQuu2GJ8Z3DzPxsl5Hjv3M6uzEz0t2OSoFy2Uv/o2qhwp1qhLC4nTKUSXUhyLcu3e4ObWepkGyMxg3zfWBn0mHD8TiUSXZqfUDE4ytQE8FxZqcxkt78l4EqMVPpEz4CXjK6YwpyTGp1RyWlLvYPd0utny2vc3aUjjiW54eE/WBAVVn7tcY9J00+NUhJt2AsnKGt6ILAzj/9HNBkrC6YYvUvIIzZKDno2CpkYsQsgFkz23+laA8cLhvl5AUe5b43Lb51js73sxtSScPu9vAu9+l7O60pIlFoJEVtDFi9Lr3nSOfWNlxlpUGMjKXJ3u36NpwuIVTCOYIKZEMdJJ0qXEl/eWFzL6JOlEhzeQtY0gqxyxa+wMhWm/1rOTjNmgN9r3DKuiY6RggK8XJ0hUZeJF0W9KsARJ2LOHpf5Cr1wEG8zk4pUKVpCm3AFlmUXPjzliTqbx7izv1BQR853d0k6FPQKqMd0k53RUPmchDkqCKGx0sGWclJdQRXAzbwFzm6+idjneZUDq6ZSm+/r1K+p3mPqV99o2qshpRGPoJYvwbggrRMSAlRSikfHYfdSMP4Pe0XEd7uIsfDPZUDvTxmcNHeCOphfr67e0rxhMIoA7e7rxTVYSFYSVV+SSuiXuj3Z5XSt2ntRNQ9xSpWUSrrBhRFUBMfN3qHBiHhnBQi44NLhXr5BuPrCnolm5LIQXQxXpznm2jN5LA/+Ci21n4p2xM3sb0kqS9e3mRpqlCfkrfJ6sEs5xkag8kjxFE8A4NplgBnDLZDwzx3Yk2P0+dJIFbhGJ8kc9Di3c01NH0yrP8J/SFV2XexrTUHMhhLeriXMCkX08bIpG8uxmukZ6F4goymQxDwpCZdllrK5F+0VavuWVk6LnmrqzVQsyPRlwPnUg0AzylcCypfQAvdMjQjtqODdGB5Wt5R+JrxkywpQ30NEx9ISEIiATNsDwdNP9R+bYVKvEMOse71pWGqkXzCaUbEkLcra2IOwx6t05hc+BAsTmvIxC+BDqcsZ6FA4x4tR9fM3O3KGhKYhG0RwXIkO8wlWgRJekhWrarGPERQiG+e9n554fLCeHt0BHO3wQ/IsZDnYc/tcvlFl1fgMrnNtk6t4gYkkaJ3VIB1H0QNdSdxmXxd4aA93uzqoGJVjy02JxFtEcVpcErPmARUfRVGkxQfQuiS7ORFgS5zPqmHGTwBZXcsFonXeu6Smi6aOoenMEintAq3nl6s4R2VjtaoiwJc5n0TYJzFENtS7+nDEf9LtBTJMTCxW6AN8r+6Io8sa00ysHYlete9uiOSFSDQ2jcWDnHy0PwaJ4piK+SJ9toewhMI+Ged1PU0/pgJEes6n1subJ+NcV378udXIuWIi2iOK0gGsB7G0luULqp59rPu9LidrS3IhvgUlO96HX1Aso6qBoaHc80vhkCwDotmQ4zPN5d7XRWsW7RZC6+tbV1hLBZyaif4abEPzt+l8PL0HH9kmK7hextjkmOZnLuxlUf9ci9YMWAxPHks1V1Ly5sKwqxdKPnd/eHIZa6AAse9g0uTwL2yAaVhrglOLLmYm2W4hIjWusnj/Dhisq4gzUjQFnpbNdpiFz4jCiKXTNxgkHOHQRdwJkD2QVu1sJ+SfBOvCLAMnf4PbOrykWne3xNmoffEag1m1ySHv5RUH4JPE3/FrQONaxB4c27l7zjf4yOCak8EYjVsTA/00v7L9drD/DVZ2Bp+IWu+jnNY//nU7rtx1aS0gMrXzv9rPv42cFeZ6Ho5fnO+1V12uSbVN+gHm4Q7MnSRJA0WnGq++0lVXxm+1OaR9Vk8s6DTN3xRj9J35hS0iudO4mHBR+UXgQBkDkV3okIGfjDYhdXfFgh6zD5tIzy6X36fzialb31Aj3pTPEfgaTbY3KIu+8e4TWhqlSLG+01T9vVcvKhKay7/NDDawHCBNrdLa/lfclAhThxXuGeG1DuAMMOCFREFwTZeBuuZunNTO8iigjNs9Ro6ORE8kHdjikonv0nt1t9ctdfhnbi0KiXyfiVQjT1dZBQXGwxaEuNsquLgKLaLP51gj+htbdoeDig2d7hvjqffkFjSkrXP8FuaHc+r6wUoU2PBr+NV1vEZKSs89XmXEPJIt2dmguZylnxwgFe4tqXJY3V5rNHJzvRoFWMJIo08xvz+y0HQR103VzZSGMq5dJz9pVt9GeyukWLiE84N/GThtNAQoyQdB962gxWVJjN3C1gHEO+sieCmjcY47BiLXW5nK3QzX+T1FkT4OgmFWIPUEBfv0CBardlMKFQyruWkEAWIARcDVnvHGOk9oQJIOJOLMHhRefEWfflTmRPTpgYxR3yab5fIbd7hib9sPICjSLx97DA9yJjqbasZWzIHPHGK0SBvP9hijKUr4HAUOFrjcOJxwCNUVL3KU1JxeyemgBIKtS/XN5K7OYnOY/HPCEsStisjmU2ykBZOuxHdHzEmGyVEPfaTClgDkJ9WPh+InfuQocO71qhr3RrBJJXipL+0bLd2KgHtkwyTrFuX+ypKJ8Z/hivT90E5HohfaWZIh3SkNnzxKkMkbnDTDUDRvXk1GBV7EC4j869oSYh52Ga9miYpabQ8SC4ZIfH67QhT47ccHjKfP2vBq+XV8O0HA7fXaO/FXI3VtCl57xyJFcn6IPAT/r/nn6i/eb+6XbtdlxDdythRnafxqK6s4u6N/+bRz89wkjYIWrrA0Y0DWjNKAFtYXjRWvj8cGvU6nmXxLISm04JNT0GvNBk4hJouzlIAP4Sfa7s5LDedDY/OZtfQvlELxiu15x/ZF9IygdoF/mtiaNV3VEfR+pf1eX/5QFhfXme1erXl13C+jVTJrjKY+ieuDJ0lhvJZSR5mAH7XiP+WF1zz13EtJeNLut0c020xhzavxlAYVKL4wOg0gQXFeCNC03Rzm/pFejGr3eCDC8i4yuSbY7UBQjD3AUbSXRumv9zIku/v2KfVHCOAyGoQpIsli9OMhQM/IC55W//yd5LrIzYea2cVZHtUUDbeY9H5X2g3lft4QE9oBfXsOBC/x1CmgYdXwESiEKHREVIM/Xgrr27SKk4k/oONwQWlH57+RaYBdqazBNm0eISeXcMbIjO/j5lq3lfxxKYW6rIiy/aLknnqKullAXl/vN8/QL+7tUru/zV+lsRkP02zrjrou0wpeXZ1Z+8MehngBCr3ib7YZlQbYfwnJngCH6z13rSv3nV/TxAnilvdZ4VbeE1WswwgI2vd6gX4TQOlu4sA5ICmQd0TU2OE7VoiW94pkOr5ICptd7pk9CX9Lt/PCbwB2NwITCMfaBkjaW6p8MWanINni4wCx1fZ910UtnmbKkb034xqJPE7h4ede3f7yFqNuySMYtDg821aaylmU3c8qf2w6ML8/ni7yA2EvgL+4PGd9r3HJcdNQu7/NX6WxaweGLHXWHcZJtnXdZDIai8sqJcHQ0HCxWEbRyKGVe1HGalSCRMxHikala8OsKJm7ITgpYe6pQdXXllHrNkrSa73Zmu12/Lp/Y8zh4PgplXruT6cYqpMav9t8T2sMB06OeYohLpl89aVUQafaRWjp7+gRXA1cTw0fa1S6QXcOPPoGSeYiY+nULW0OnE0qS1s354fA81kcOVJiK4CD3Myu8kcNLf2a4fOKJGnAyOXd2G5l/cQsrOiSf9HyVoZL4xwUKwzGamv9l9p7Zj/4gLzheE3eL/MlpUFEvLs5gR4ZV0Sq5eZL1dqjgBS5ehpZm625dgIG3kxbudZHdE/E9nqE0lnSVBl8sxkiRX7hz+zSOeCo+C5+W1jq+jOGd8wnSDJdTGAlKQGsCgQY3VCVMhrpDP4YOIl+2CTl3IHOgfIfVqH7a8N+Xu/kGvs8Shbn6H4cwP2J9V1dgc90bT/HUj1Q/ydrr5f590/362PRMma8+xKAe0QpK3cIhKuWYp+FuhlmbHffm1ADdsVbEEsAIZ9o7OMqWLeeKmwmJT2REpScf7fKvm9hwzzfLcKpkcQyDiv7zny+chVG3hYWsIaY736W00FLKmLpYdGVv3Xg0SSh7UKvXziAvQEZmwGE3sv8AvwCTCmxuhP9v5hAvm4ivr45M5ITSIwQc9vZksA/ZjnegxaexmzRs6nP2TcXB45IB9tEr/tRTT6n54K6Zb9QdJnquocdJqK926F7TzOeQCGk4b0Fg7lc0b4dGXp+q7Yf5aeKg5C6YHXWmSaX4cRLNhETLO3oD4CTVCa+GTLOlw0I/jskSLdPT8qO9bj1NZX4oKMvFobHxmbel85sTaQTtiBX9gmnDG78nm0ywN1C2coY5CX599uQ5N3teogSnzcyGOjAxSWEbs4GORvB5iqt0aSYXhhLCAqigLuhlXakDZ/wWVJ2TQMGa0Wj2S0hTbfeiE+0yn309nWpek0epkNN4Tk6SqGJhXuLDN+/CAUBbWH/4fE6x107S1flpeERFSGrOyrGkEvUpSwDsrkKpH4yhOXvuKGJsicojPQ7Sc7ra7la5ps+7M849ZOK78wPixdSwzuRv8BDAg0LQ44p5PMdLvGbkKnOLLs3QkoG0/+fdP9+tjz/C72YUcD0B4SF2AJFB4MuUYjSr+GJoc4gjRJQYgvq5lPGWou9Q8nFLjFyo7OMqWdDSklt0ogiv5nakG/DNlECA/E4qvgqtjVkdZYRcKZlTLUi+8FzTb4mzAsXlNkq8Op6l2S1kUIUfKAO9UmdPyG6JJ0laR83axMY0RVA02Q7ksx2Wk/OKCH3lViES34Cwpv4dj1nnczYTvAsK4nxWdbZ8gdk2PhWCEXzll6UkYn8zH9XTFbvG5aMevG/fqEZpbQ/LVYWecGJ9ikZJqy/nR1PRiB42KbRPa++Wbl05acBf79eVHnLTc7gYyM25BkZCP5374JEzNXqzhDio8ElZ6He5OH3G/VCkhxZ7oT19fylon7Zdr19f5zTW5sKadhR15VKf3m8OE1b3OfgUrgkyED+TH9D2tksaRANOGqOiMdLZ7pZODMi1yLHAb6X2cXNLpxRnAQ4UgflmLXJi2fKdhWKgjIgOXbi+G5qp5p+A49l1vpzIwxjlIkMZ/Yx6ZlvttOzKAo59LBxsl1QKSOsjcBTYGaj2FbbXsrbcKt/t7TF+1moBx3CbAzEa3uq7ke1wAV1llJ79ZqoSfTAQQOBUCHN3A8+MJxMz06t3ecTIKI7Frh0e2P1Js3HkKQqgcvGAd28Y9zpqBH0ekM4k4cKj212JA1JD10e3vhMTzOcFsGGlwXnzPhBfJhz00RvaTijCCD4vV2GrOOwyVnuM24Cya9Ap6UEkzmDHN5HQj97MOWQNIYCqLEdVVpQvuHlkg3FGLBu+1ZZtGwn1MIOG92q8XCRz9gbwJjXakuuwYaXBefM+EF8aPxQNPc4JQvZsdu5QVHPXu8AYuhVggLo1JfIeaHTBG+31B8BoebizC/j5F+INcpsRvV521/b85i3yLP3Q3A3tvF5fzl7wzL1qZTFaS8gHRPb00vhy3FCjD3eD5OkoSdBhSwSlU74QGd3icxj5PFVENEiAzDKljjXvkX72kuCm8Db5ChVbNKWgStsdT/9eNRuRd6iYfhWtGO8FvvPoj/1ZV7J7nrZ/I+zWjxQQRfFAwLrK4jMWS5IKyv6A7fWUftmUO5+MoULzKn7yx5E+cMUkRFeLplUBxqsa72SdLN9bljWrRel+ZkRJng8RSz6mOiB2p0oxpIh6gwEzwlM5wPFHK87TkSNpm6AsDXAyGJ77b7ssKwMgvRP5Cv5PzViK6yqXFvO+NnvkPruuWm9DdzXTY4PVXXz831ke42tzOSYe3hoYpOwAuPt2JDTkoeA9dH5tpLOo6zILFZilt5oZqRHrQj8vKYXmOnH5g3JbxiA96bQ+OcWLu+jsmZUN8Q5H1IMntHFYAClPtPM4+4471Rtga+QTgKcxyx2HDvBU97Gk8teaRQeImBUrT9mVA72UDBjuY4Bk6niM+MndJpWSxm1PIuWk1gOcQNuGPqvWNnbc99yZMkOUSz9LtWC+cjKDFSpmH+cmurAJ146vm4IS3XmekBY5ObWZiYWcZ+uycqEZLRHJhUGd6U0yEIpb99xOmvnmhotUQhVwV3F7L/wmaCB7WkHnpezLWDq7ousED0MfoKtvUo3J5CQYjKt6XMZ0WAi7azY0kadTYhNSGkmPt/wW0Wkm7dhU6Zf50NsELdEMwsJ6kI9sDkc7F0DmAdIdnqfnnekj9uq1pCeiKjS3Q8KyEklSqctg9KSPQ3ewbcd5DQhYju+3Z5msw5qpkD4oX5reMy9AI7ylA8ocA4msX/UNMuKeHfcoBpzB8Vbmzt9luvwEEzseQE5ipHtcQKGyf/mr7/K0AgtiJbCRW1RF7pPEbickQNdig7nXUoQA/M7wR8wFiQczheaaP3m5gyq2xVpOJ82PZSySmLI31ZuFk0zWPncvSB6i+fpAcGp+nVBt3gHH187sLcIy6uA96xFd2ej78y38Yv+YgZ3QZtosLNjtq1KBSPk75PD4b4EcQzpeb/+xDwdoH9ViQ38f+P97Rfg6ZZLbYVWRIj7CkopDGkob2HVtE0qihcGZIH+lhxh7DpKpBc2wHkXSOC7vermLS+cX3Lc1pONEFJYoz2yQmHe2cPbAeyIeo39VkYpOn5m34LJr7hW19hoKyF+ZTQmnGLuWcFmorvLWUgF4tx92WOLoHq4cJIvCDJOP1NdiVeYEysW4T40oDAbFo0QUY6suEKSwGIFonMU8FERuHj0WKhc8m3kX8VUshI/Y5sTHbGHl9Toq+lkheGeY4fS+zu+WKjJ2Q0FtJkWN+YB4e9++w5q8Whubpc98uMXhWlNQ1jEHiYTLjaAEUi/9eHjC6oXBA1DuSk0WrFnkS+hgSCNx2BHCJd8eY9u7p4rvNmjs7AE1nIIkg04gqQlTfqMgy55yymvJs8uxHnliN+SGp4iuJVpSCx0/p7Sh95aQkJbsrLGk7LqI4sHLuFPZhqVqUBhH+ypKoihpfCis9kM3VOcVTf9Dz/lABPsLBt/7sxp79NYAITxCLq4PBTzaHNBfdwPXSGjRZvPyOb9EBMUUfpvA5aD7i/ul87I7EklvkASc7h4cOzznqk0DMWNnYdI0ghcpILT+Znew+dg5ddgnqJiv2ILq1x2epLIDU8cRWTkA9IrKSxS0JW1RrpfPaQQGTwlYTpQcVUeiHZ2H8h9OUQVZTeCgVKvUA7aeORyt8vbJUQMWfyyYxMcWEtgQTN4V4Hectki9QwnjOTlm6ZmPBBfX50OpP5YgCyiSLDJQWM/EQ11XwvtkRmS60QJ1ToEMqXwX+4yPnd2HpsH7Uikwqdzb2um8sOo5x8/bbaeJAFwfO7WD7RTXb2ZFMD8IByTHWOd1aKacwMQTXt2ZYh33lpynrC3AOAID++71lp5MEBmbDRpXiWQRe0S3/qAhjAMSZZWuRLyg7l0eoi1wP1PZcQ/a/iBemyCC4CnOwNPLdKTpVYWSLt8MGnUgpRiUj1FemIMrwD3BbwdWAHZrjjqtzNdOWDciu/QFCuAWKD4G6F7YAmjxx1vxOSDIw6woFSr1AO3v9Zo2F7VnLO7LHaskH5folEXpP575FM5nKWrw/ckPKBFmH1EYJ0jkl7iRt78gsMO0MVH1dKw61Jl3fBiKTrTGjC0YNuNtJlG9JqfXWQ4FhZjFn7hRAx3U/UAp0LNYnz55f2VbqoaZk4Rkge/mAPo5VmGsI2jEN9Paj0OL9ZppkQKb/s+9cHJJbh1KZ9ei0fzCkYicsrAHyOZBZ5ntqBaqhiPmieA1B6vUEOgQVQPnUnXhDGOAe4b5asSerSffJJdBgOTCPyScSbKtr+zuzrlXUR6tIRhb94TPLIeTiR4sDwLuVgxpjRe8GizWl3Cnsw1ThB+4warUX9skvzvmfYhprSOOrR3YHo07sLFh8fhkNqHtIejRXec0ATngPuFn8bN1n3auVwFbAys6sh5R/XKUIE6YhpTz2OlZH+x/52BbhrHNAPQ8cfnhtmgtLLtUX0A+qAeU5NUCb/iZY/hFbE4AKbvn4Zz+Bh9Ry3kd3UNvixDY4eiJ2rF2ICwdUqrbGvKTzB5qMhkYBozu8EQ9RtUSey2x3EFFlxiwarygscYWAsd+Wu7A1Zhw+wSV0W44X8FAHEOOmrDz+NxVwKUPO/TWw8wqgppvZDD2uT4m55wWZDl8mr6WR/6UQ6KRd6raTpqro2gH8N7qrFv4UWHmC3vGaTbCYZ/upbjw49VGn+lmB/PKPvvkJkY3jvNvM45isOwDrcMR7sw0xAj5bGdFYFHctja4p8QKlktQ/JHWOuLWgRim4kbzIxJMoozthLmQNG4Pl7Ss6oJNiBTEw6shMGbWIJfOA1ukQjhv1/HyRz6hK/A2SaNpVDBt9RxGh0NB97xMaU+9+ivYoX3v5rBXVFU6pNkCVkgFDI9I9/3hOSwoaz+YsIoYxGUewR106trYfcLHeSKmQ41g50WOEZY/RFNm/8Znm4HOE2kN/doeVjadtGzsThnNXX2y8tdICzDAJOirdFiL67XFF8ZABI+Jm2LP9PXLXXWhoZPIJ8vLLACNXqZKjRwDYcIY3vHQw0Tw3caJA0GzhA9iQ7sJYFSUubF/AhuCfMUgjGIXij3F7+8AAzB4S+bvjJhucjcUlfilcmOVVlPVL0r5ICJ081cv1vPD0mIEzn+RXI4QLBpb4zDLuNLf4qInFs0Y4RnmgG2Y+8kSzRSFXyfNUeS2hUYYd5ed/OivjY+Ly4S4MDKN28gtHmGSt4VJpJbMXCcxl0KujAQZGN3pVg/N0SFTTK5Wg5a0OjuM87Br0AD0C520CLhd3YPG/0GANHYbJ+pJY88ifJgKejHt3QuQxfC/PWeXgeXizUxsBHEqR5yO7ibiWAKTkWMjvGRTPsk/T9AAKQAAGu1WE+DxuTL5O0WD7zl1SpUU51UAOaqL2LofrXX8D/mFP+TSYc3IgaLQWv2QmNosSOyg2Uiy/0oz8xf0mqXGMVhkom4J9RpYbXKlOHlBQf6n7XFJ7zb8BE+W9Hq/5635ivefoAx4gAAbAf+zUyZW8FKRR79hbT9evYafl6vqFXO5fp4iTf5Id3UaHchX7q1bB6GQDoRipPB5DMQYkwCPxJp0c4lmoqIKOeX+zuVciqFTCT7OKGHMjZqkJTYedGvwLTW2drDINlRMW4KFveOxFJjFZY/blWUjhOkZqgbKFWoCQV0ysMPfCO/DOqQ7i69LFHIzssk6WXKu0gcKXF+YRlHJlh89fg2hErcluXTVoXz1utcIdGggn+APQG6zkVw27FFwgCboT5/lsyHfGKIgv6oOeh7IMX5zwwdVuB1WKWDomjRInmTttr+QTrmN/5/Nw3YnUMZK0D2bFmIgA1Euu3ZZ5vRITzxyyPgyiL8moQPHL0ojjaUqANABDETkPw1aBpo2QdH+aS/hySqYecldPZ/n7vTj2QxUVMOpG5NDoC7umVVv2TCtQSd2qwNz3e1e8AbmRn5FhAxyQyl5UCmCmJO5OXh6y3517zR1es5OFV9Ov5i4w0zHH+3WviPzQEY9AUBSfGcGWyi1YOXvfJTpIsWTCaNz7FO0n6I7QEqwOLfwNJO3GE7rg1A9j0bbQ4ekn7vedKIMQZ2zhDCDdD7JSKhABmgnxbBRkclI5rKgWc1Pmvq9LiiLotzMxm3pQZxK6p9CSXcSoRgjv3Z+h5Wy5dTVj7F6XvDG52/nnzYbZ/vCJoJ73h5z8hsEw7mODrgoCutboT2PDd40mPwS8/ldL71Cxn6S3mkZWTO3Bw88nxBRSCUl3YTSLIH8NMvyHsNVkZ8YSeIgMqKizHVr44YY44FbNPR2fsruq6F7GIa81KN5jwpN2x0jd/NAr76O9JEXZ7KSRid3EW/s7pfQ62B/TeRVudJZ/47H/3+z912aZHlScI3IFwLTBf6SuMVdmFuadT+64969Hdm9J0bWjfPcvrm/COu7083yGFwAAN03xzh4Odc63qzkTUPemJuV14W3iqbDGPa7NLZGTcn5GZ/mx9eZT+FumkDAzh0t2zOd5tUaSsQslNzEl7FKwsht2hb4+0m3x9pNvj7SbfH2k2+PtJt8faTb4+0mqNuyFlg0vHjMqFiKLseP9gNM8v5RkNKmGEGNKKYAA5Egkw3FyRuA9A4q5I/c6kTyPzEHQLTEytxbSP8yatQOOmjsg6ZhhqSpKD129hGRfwF+6KEB6AS6kZ4VBCG+Lm8xQQY6XkDPD30s7EKDyKPkYfMA+3yj7mrto1xpTsqUljhn7LWLqKlO42erV54oCnXGqiYiEYhnEMLI1uAqKHb2nsZSVYOtqcEe3/Q/mHyg73epOgpHRjnjVrLdfRnJveO2nuG3Z1N6K2Su9OGGm/ZtrtlL5iyqtW9zARMpDzgiSrsdrxyOnvfm5687oiGDUSAufGpT2f1Rwh53tHuXtvw1Lov5awIwHOWd+YZXd4Zp58L6h68OzlrA6CI8jFWUbEOpL6adH8JVjD39ks83haSRiZeBP2GgPBgncMpk331vaeLyUPr3MVD+q/t3NpW4r4Y0LVavI6VTEnjO9aG5dfi7QKZPqfHDQV8ItL25K52Uq4Q6uXuf4DTH1LCwstR29xhCiMSNrClf9O+kbXq6EP2Q5VTDYMLUMHRf6Ul2jvAsU4gOb9WTeCajXfsmys3CW8aWlEqNP+ME4MJRR+rhSFX56GjnIWU6JKJXDCLuli/Ojt56EuRcpawg3i7e0N4cuPwss5SqNShKo62DtU9eNM+0nEEQYwymg6Le+gVl1MwZq4yVAdvTVDWMpEYnXeLwdQb1oCMrIgfV5FdIdY44GLFRPqn9/EmD6X5xahursc5fpdySkXHE/V7Ylu7onRmtT9t2DpFge4MZ8Gn02LO1sYQdPrT9QvfCUvB8BavfPK0o1wWjGXOwQyWtpFYlcL5cgj77Lh8Sv+t6byN2HGWPatfoHfGOfpcRjfL34KFfP61t/p5wzXlWBg6ahFgm3g9gd2J8SUrEyPGOzHPJWTnyowA9I9PJ1j0FxaIVCOpqQhpvIeeOc7z7Acwe68pL/4+qZh9PvRu2Ma/a7XBuDnAQjhXhs/XrxnnC+Z6HGfTCf1fUUAU93ra6gJmuTv7X72zmtSr5zY+U7L0B5jONtRxg1zsu57JYCIBw56u2DbnqoTqIALX4aHPPG/DoOGs1tKzmU7fVELNsy9YnJr/XD5ya1kr8/2hqk6/GXdmqzdNvt3ovbYp8UF8TYjxX+GdNB53KGdMl4AOJNrr8+huVUwldn1NEkGMJPyhK/jJ+93rS2tNWwckn7V+7GL/8Ref2SFxGf/p53kAwr/TKD57u7pH29h8XcoTd2MZ18qROdBI7pd/3Mk2AvmC2eEyWwdeKxCpJM6WQBM4N1vySpINSPwACfFM6uJS7NObgFz16ak4YMjgJywR/RBGIoEV6KOfBTOgU1T9yJ+kJMS34Mm9XC3SgFvgEevZ/SwfHZUFgAAABPDGfWP+s96N+rir7VqNdsRNwJOJnqW1vPhU3pyfwn1gAxhQrdTQkC0ug2G8AAAAJOBevUhe+uv0iHYdbWJTmaX4nZpeJ9te/iIn6lUFEbIn+0nywC1WGtpLuTG6jKHoD0zWJLYfgmaLVqD8haj/gI7S+sqGZG9sOJpLd2JMJ6nD/U9XY99XBoxCWRpBopUbybBQRj5pbIR6Pn0GcKTsPc+1yEYhR1PM5HDqlLH+fRBqvKmQo2263VenFh+JU85d5VP1Oh7O38S2iLuTPJClu0JcyUBPru2aV+Gl9dHG0ADeOpfcflArqT8XfY4Jub2bR6l0vI5gXt8L+2SIGB2MTWiZshEdRk0oLqEcIfWpFUVAVsyJcELnyyvLU3UFYCN36FD1nkb1E1DaxFaZ8mKGTsYhbKUBJ4XPO0lTrT99TZCRvGJpNhKehHrY2H8u13MYt3Snhy0SWD+UsooAJliKbmMErmnko323vvftuWOc1X9ZwnTBabwe/bSy/1Pp4j6/RVLY1EVIbXKfitK+/f4V667zL7briakSDFihg94hLI1JkIMgbA0L9z2UhDFKANPSoK/PsK/rSCJi7XzcY3L1DWqfK83TBdALg+3OQ9NWYAmg9gezuVo9K/uq1Th+FreJ5YL8tqVP/deD5g7UMYVJ/rEwcly/6tB0tpYPTAbfX522IDkryxTmsdI+6Tb/jRx6mTCcY/ObTDnuczWZBYruNRu+y1pehPYI1o6LlDOZ+PUSNaZoQIEeDTAqw9VlSr8j4H04o1kns7YPFpH1n7vXSfYewmclqU1s/pMXjghDRiPP0ea5plTcsgABcxSJpV24mi8dJGjzt9URRKrc4+HjLTXm2RnZ7SE6vf6PXYAvfeYPNLtZjc7cPUWuoO1sr9FLqCaZiKwyD2v2kRmWryWan4IypeRMvcnxtagdBM8PHrpoiwH3kIGVbUFuLgLJBbjfa99sX6w/3uM1OK/UIkM4C7Fl6GDW2usa/wgk9mpg1AYS5mHdeQT4QAAAtX1cveC6k4Cn3ZgeeIhWaPa6w5aFdoapU3TrOCudkZnKlDb4zw3j/VP75Gyzmolsq3lAEg4tD4wCy7aSsk3c0tO8NGpHZ+fmkStgwyg9aCULwdl9Gr0A0mVf0yk1uwDN8N69tplms3KWUrLK9l98671Qh87G+6KI8V0X4KX4ltI2swAAtHAiZPD8OPPORJcetWH90Rww0zQAfI0dxytCsNxEmgFDBBHWwhRrQAGJZgKRhJG42SkzhrT3u63mMprONUz0Q2O4xFOGfG4qWqZY27apDnCu09dCp/RzjrzvEsj4KOrkiuOlINiCwl5av4liGEpUEl1AJK99yttlUM1uurVyxgfGyNk+DoJKxtdDy+uY9Di+0kT/Ui/aSiemNmPqw4BrjCuvk8LPzrkUbZHHDuTaRBMuCMI5xDp3LdA3F0XtARgtrVYJ8ey7dYB4VtRlQaccqt8LWCO8CR++7Pe1CMhlLaPWmeR8i8OZp7UZyGapkPdY9L6ghRX4haOjyptlCyaT7JmVFVQLobkKovI3XMpxrqwNK0OMMOl/QU9G+veM/QcNDE2Ag+24VBMgHnRQhcxOtunkX9tG03tFnD1PVzF8kqJy77ph2HB9k5uAinSBagIt/TjebLRpaJUkmo9/BSEXVtSuHEJ4XMlZZUaj8sU/FZczTVHtgT8Bu3RH6nuPrhikbkPJw6laNQK77vc+7ZERBIsxr1H8vbDrvcA5gPsA1xWraQkpwibbpcf0qYlTdz8r8bMj3Rq1dhH+9l0BNAfDs3iPOeTSg+abYbmXIStmSrzaOS3qNPEXwWqb8neHHOXhCYHu3lTKIP0/eEn7DoeeDqTY/xlEE6X/cec/MqMIYeY77aQkcJmEM9p305JOp0WJ3TYgsy9qYBRA7UBPGVoCALi9vMZ/szZGYSQ09FwpH8leaOQ/RFKfeIIBjnLcOfzBfruwpLx4Az6uEgBgkx3MdivkArRU+Bn5dSg4nX6m4r5CrGZ8jQFYleLC5zvwbrYWMLIg63XCPZAn2LQFMD3PrjUUr1FvAHcnzv2roc70Nk7qPLwlqL9AIT6OxuFx1/JKPycco7mPGtsMmA+sbfCQXDYmsG64r+WCS0ZY6D6Uy/zMGcZkdvSiWVF+hH/ilR6pawY/WqQRwhpCWMHMZCDy0BNjczfxODNMI39WU06/XNzcoIRVFIJu7VE2U1QLcSHQ//o8JNhwrdm65AOBBgUy6mFNZxtTeeCMJhmKhMoRhMB7WZ2rrfE97Psb6VOMOO11T4SKhrUtcRTU76w+zVwewLW2fKtThoM1hl7v7e0b3r+DYSEFZwrxgIuA0jmKFcT48hyFCB/tu2UHvoXXMqC6hiHNMCzKIrdzsMP2SEB1JtPrAyFH8kUyPXG992LDLwMrpu+1OQU7LTb6MV8x5HcFikKa1aPXDrupOQPzmCCi7E3mjJZMR0juZiXjsQIhhfSKZY15daFlofq+WRh31wXLaPWuFszPXiwhylYfoyHW7ndr7vnLZNgewksBmnVD64e77qThQqAYjZG9XyGUDcp93rD7NXB9UlsKJR2BrU5/efFIEN5flzXPJqr1GHf5l/gso+M67rii3F2eX8oqTnNLbSMh3POWJVpMOsbxDRpC6qxHwM+8M4ftnqe/cEiPc01dviSxTViWk7kfPnBwvYHLoWT7JL7zuHGEVPtgE21hNqbNwok6T4vZcL1r7RfNoT/8Pjqu2wb+eOvPQgAAC6DJKRRr430QTy/WcIUoniVMEhGIAA2tCwKSshPLAAAEYrjDq7pYDodoAH0WrznIzMxruxxkgRpD2OE1eSWZRj+sFjB7v2xEK2fH5ExRAiC0U+/S+RGIdIjQh+zNXmJQgdWr95vOA/Wgm3Sm6ItcbUrbbhAmz/uUB7eMMeIjpjdBQxrEPC6JxByyK6PrwleKQqD7BUIlr2pBP9o/NfQ0Nsi6nfAmgCKr2UFlRmk+7TBjhtLX1LhW5Yy+7TLcCBJCa30/Eym8H8sMQxXSSrZXXSyYovvagewdIVE6d8XHtkoVqN2az+SRibhJH0cH1pdrARaLw+8doekfHBxyk/ZJ1Ho/5YMYK00sRbfDr1MLCfSyKCr8K7fhYKAYjLjyqcDxBmg36Vlh//rcggAAAQ5qHKzpIkP9A4xK2+u3zVBxX0THSxriX9Svppp7IRWzUk10Kd2VrZkQEKRHPIBL+aBSqKawfURef6GZCAbVIA3k3aWNtYPCAkm/WnhA1EhTAv52NgDUE2l4vaHtRB6fAjpAuorkK6ITaZDYd5H4RpjcB8cweAMArQulkmvIq/Kl2g0oXK1u+3eHD3apTceKcJTRCNAOmOSeuZkqxwP7/1JR7n2lwDuq78/fifKzVTkLxAAAAAE/EhJp35LaG78Ns0OdMzPI4u4aoE1eQn9fE9GJ3hZT/Ndqlj9CCvP8h+D2XrclLUzHrJCj8y6HcDbNxCB6BYa/XSRwXOKSr7jzF66Ua4Xaf/tDtPLhOfYoAmfeGxrr5zahSHfNYC0sdyY8a581jnaJ7YV/AGDE8z+Gpo6W1TOfWMXm3GaByAoHeqrOw/wa1EaLHRZ096cFIs2sJ0hzq2OgPz7JwKuvQpp5CU4lVhdzbsIL/jICvTMn234kYWZJg+AJ37O4Y9MYJHT7vQoTbNfeeDUxwDt2M65yaatE252qgqlv3XkyGd0m9TZh529pXf1C7LqX+BaFpzQdbNde05TZknbweIio1zLKg8uFiVRhEjKZf9t/ViCMIFfZNuD+/3t2xUeMMdUbyJhIxGPanAFUdOpiiVCw8HSwZ5rYJhMDI3H6oRrz7awObj+OAiuQkxEP+jE5GXgU77gSkEAXgnBG5AGnTiIgdxjhvysGcWpi9qeQGZ1bHvgtshyabCF5aUwxu1vKv9sJoeKtWCzm3C7d/6xZ9U99citj5QU89E6FLBHKzqoqV0DTjqpz3FEmoOZo/8GpeGdmJWAWShkCEUjp5FTSxLsNeDUA2OlL6q01y7kJaTOOVHQU+Gut99F1Y/07Ueeo+Ezocwn9UNYJLXMWRlKgD2HHQEZhR5Kd5OKR48NQFMyJUSFWxIr0NQS8m2BfX92p+EYdreFbZWXZHS/CKwDY8wN+V1po875ZXASXb24aqStryI2t6XUanconm95vhrwT82JyWKtTnwMvSXzLKbAML5JlBz9RkOK06TlNQP2nLWE6Q5wejt86t5ZB7PBJXLBl01gnZnafxbB2YZQkl1c0CySz03rA8a5YMJvgAfxntYRHoAAADOXEgCd1NiFF8UJwVgOAQigGyEskXN8JpBGew3LsHKtNMfCr0WQXzI0edX+zKRTVGca97b9RNgwpJMZJ/z5kA+EKWUxxA9zHsXCtdspI7bR3gjpSWMVAJ0w5fR5dwZnMsRTcz7raDm6YGFbb5/vM8uv7v0Kx5Fsx6e+l8IkIoMlFPSxQrxiP/o1K7c9BHVoiMdWESMU9XZF8wN6q1jxfYaI7JCn/z4lhVNOBl41bGXLbT3oEckt1xkOYVmQAL4lzLkQeZLAwOiVyJ351szXatsJCHxmlZUrM9Zu+6e4XqzoJ2Mb5QUTlUA/Yq28cHcN3Vp0F4NNbKiGXBc+1CrdR/6Xr4djYhKxnjYcmxN42qAiLiP9H7l3IL0JBSWS+zlSmszqRnTrowJa5cG54FYcb6oX2QXi7fvfTotWTuphFH/DIyAJttVMJMoZMORo9CuAQ8D1as4OuId5F36YeFSEv9q/Hnu1+FZ7rn7dy2a6bS/Sc6uBszQoxDdRH8LGTgc1K/hBZ7BhrgUtcwZw9wVKaCeT2aH2Nz+bOvT9UPLGL5PdDmTBsuy52/LUJOQAAAtLsrmBqZbiDdetHAAARhpY3lsrCXLKa+Y7THwTbTuVjtmSX5JZQfXGlZ5zvmjYoJ9lXMCUzyjMCrvjdUs1alXKvfFQpJOV8r5LpuWt9Z+PEbYFIR2i47btndr1EhJLGSJEVLiifmQeqt5F98owKhOmIqs6s6OlOMY+XebtvR/dtj+B+Psirg68FWT4me7BU8XGxzcTxZqtN8SRtqEvKll2vJA+YlJDfZ9JL9711UUyNNdlNDL/CPnHdP/ZVw2tMfxJQHEP1r0/2HihoFXLRrPqB6d+t7ZsLBRa7U3CctzFQlypqkuOrNQnm/gE0jkJKYihFRPmb0iSdR9B1JYCQl+xtfQxvesBbZh2g7pwp9ct5aNbbSVYM4ypbMek+UGwGTfaFZUbRJA9LvuxeL75T5f7uhv37Yci0F6ilmhajd7+WCETtITcCOksppNnWE5FWjM5QFyfBDM2pNwwF0pgZUEh7fMSDy1KWAZPYpZ08PqVf7+GTk5kxovzLc+rY7leArzVVkgafoa+XZ6CiE09RmrPkJJC7W0Z+rwcVXcwY+2Si8Ri+/a+YqKyxXLRzLg3uL9c1KC11Atkisekcy4tUcN87xCKS3+Ej7irgYi3/sKD8CLGLtmQl0lY5d+1R5+sYLiOmkCKOaECRANXxYX4KD1D+cL8S/kAAADZV+7/YyW+A2oBLUmARjgEVTgQpHGFm84Ogd83L9bGtx3qRStjM7B3s7UwhSJAx4zs6kdljiC6AtWqwSaXr/a0ttro3/lQAAAAVAT26j6cg+HSfxc2kGVakCU82FyJ6AANh+IlyrmVXSKi+P4aDg8tUc57g3oZoIebLu5Huc3LdhZ3ghL1mnDznkmGVcY7aI2b5eee7csGtKepfGNYlDbJS/dlFPbZi223U07QcwudOPfHDMqsQYBf3ieihW3igJKU9nS2h2rJ4wor5trokDk1wW/37/hS//oryinvIfZne+RqAJ4JcZROTr0bT0lHk2pMEmyEAsaQQwMlY6QuSSCgSzZoTcgyNLOfSUWs7S2yEDLZVhEHeKGAtll+Fg6hvMX3iNWis/Fy4fkCpw5+SSWpjrWtdgaJ7zEABaH67/ieDBuCAsO+PRpAtNdpsBiQayodGPhrPsBkbWIp5wN5xpCT0dfKB/qRYPqxMjoCSEfugBGXb6wxCqaCf3X1+AulmpWW2NGP8JfZsIJ6LQw6J51UTNe2FrlOOl9i6EHpOOm7nU8FdVcR7EQCPgjsx0geoiOfoZZj3g024s0diveLtTGk7aGm5n1n5I0qKvdSFSt/SGTDsvFoy9W5pvyd+5x7pQu0tRMm9104YeUM1cWdcyG0FOdHILZxofDCa1F0mpmL/KGcJ1AVpYUaLNfxA9FdYC4s7ih5cqXj/wGVYN/Ga/V0I894EHmrSRFFlHb1P1aIrj+Uf9b84e9OPXpts8oQA9SKiEJq2DNephx7EId+J0Ck+jmWBggzxT/C4E+MpR49E23HPuuRjPOhYZhwlPgAInIZKPKYZ5+oVhhVIcllyZ1MeLWJyev9Wk/PYjK2yg7ZPuOCyOEQheH6JtjispCDyBw3VXvuy0KBkg2Vk7sPerCszkxf8bL/BctEWzm30mIBP9wxTd7yMEjAf1f3wQayTdQyC60A3ne7x8bTYdbZErX4cFEQ4ev+aRQVw2EhqRDev7Ig/hCuJ6eyC96YXVFYijV7oawkOewXwGbK98Jf3Q83yoklJAYpM+nleKi7Wg9z3PJFvgHnYoqTEd6uLl8zsDlk2jkX64G0gMJF/xyHMC23tzwxkoeIyyNDcjJZxEpuBAWEihE2FAMeB6i0W5yt+zJRSgZrmWf962HiORdpRcfYphs8VvvVQU8XDFBQdX7Xtcdp7lVxRR1pkdcZFygNnDD4YcZQv3IuMTyb/yhhVoIAACsDLAhbsqUIlZ/pUrp1AVchoFssjq02W5RBQdQhbnrOTqiCyCucYFWYFjGhj1FuoWeU7E5RkOP8+nbR/SoAAAAWtH5DdawEOkhdMgygtL2NQBkovkNmk5Q+0xmi2x9zmHNia2ip3FE7dBI/70x1s65HrQiUVtBAmWXPXhhkPiL5Qrty0nzT/QchjtjGrK48AMbk+soB4Nz143KCqT/DoTpWVdPkdQ0qDrv/0OIXnw230mglenDx3i/kQlt+k4gvtLnlykH7AMVSZyhK6CrhQfiNqa8BXCVrYdF+EJnSQ6p711Vcrk7tbJ+pTXjl/w0RNtm55SODxskUX/yIb5BrvTpLI5NBFTBuJxcywnmNBB6NJNngqjEWno+v+/f0nju4vyGqB0hhP0+GGLukvRMIi1IaS6qztZVHH48mNUgm2MLACljP9SQ7FUkubTpOL70kVlG5s+hnNM56tdiJuIcSpKJhvLM2XrJwtPCluO25xJeMoUcc2V4zl36XWyeyVIRpBRfgPz+OogUj0t6HnikgcycUMBnx/RvoYtjrCNJerVysUhVRiMOiOJCDuxPzge+KaEU0RgX75MvWxLRMN1Wq44rM1w6HDHRJlHpmX9AGCov/vLnxMLsuEA/kbIBLpXOZeu47gAJqLoO0/KJVmV2qVmIL9yZ2xRA9fGl2jgD+s8IukLMZmkPxm1KI50poitsQ6OP+QpMajKDmJsO4sOXt6GCalnuSdigmFP4PRqeW7Q8dwtuEDO4SPrnXx5eBcwcjmRvXI4u5NqBT6rfafafVEUIiRsgAYPoGa4omHofuaAvzNZKjq1JS5NaqTY00ZZjcLf7dsRYC66TpQARaDJycmwaWLe8uo3N9Newle96Os50rJeDlnYJNrQtLL9pwWPkwwyIQmM7/z+rcgdFJYZiyf6KHmpFpg5kx1fVMBdG68TA4nhk2n+Gq74AZU3k94St4GDK/BreGeOe04F9WhzJrgRUMobWBEhN1tr8YsJdt75U880lKp+mdfTEB73mnm+9QKv7Vm9yOtXwuwDooNjhGqx1JquuTlqjXl+qFNiZaRufW9ITQnRKRBraJGKJldqvLNRXvjz8D/EEo93PW0ih8SdYE59MK8ldr4Sf/mUhPpckb8RJ4KOz+QzIlzaaEbqf55TuDuSEGlEWgRiC4rC24oiUhSR1bJVsWm12xML1bMqIVrBGlBhDx9Is4TLIDpbco3bljgmp4eD6XXDsBKFwN20CCKxB7TiuzAoSzOa01O8drEhwKvnA/JddWVVn4eJ75MZ4wqR3oRPf4SFWv+NjB2myv4fnwYqkHKBMh8TFL0KGZKWbkp5FINt6ULzzBNeSuac5SUrna94BhaIf5WvQOBDDF8QaTiDClqxcWzhHUMW74j/pdnFRg7C1PkIKCmql0lvYEpWA2FpAw74pARrA7EeHT8zqeB/5sGIpG1QQ1VV95QIlht8IsrgqMC1S37vxoABtrCV+x2Fwpk2gPahTErLLwoqcrg96JQkYDVUTbLyrH0BxYjY06U5AeKNs/1e3oL+KfYEU6adJaG0sfekkUXhXQI0IBGeMqtuLiFTmR3MhVlS4HgV24qE0YAmp8Iesp9Mv+kVLWYsLMkPy6U2fmPN0HCXVFPc3X9+ihxWJKxNnFSRsm5CQ8g15v6xvoRxUrTIE0SBTwUwtHdK+7JSFeBdOjFJx2hWmOhc5oX0tFogobUh6rxCx+ng8GL0+NrHvi6IwEZv1t2G4S6FFg8LOSxLdItqAWiSWfeRvzyoaso601hz7al+WH9sGz0UDfwv5NjcnGRdNowYAQLN3wvSGrKiN+W1WTx+lqtpFryKC6sBPB+PPONkqHAHTNtCei8whB2SXoAnJ1TMRMYybIVkXmvMkUONBBHlXwrNZ2HkM2L8rNL5Jr8zHdJqryqm37lGDqJDJR0Y+894G85azw6rpDR/tT/B8PMtSQjef3m3RbXqPr+0y2x4B5EilbzMYGppjns+kPt/ZN6NjHc+cQNT82RAFYH8rijQeCNzUo6yWBd4urvSA5YoGNgpv9v335Qxluv0RcpXqcLn+TForoxkgGviwAoiQ7X3djna2dzS15vk0dEpvxs28uOF5MED2kQ/GEFm6cPt6UIzqsSfgTf2YZzFOE3Fov2flDBK5F0Hh5B3N6Sk+xl6jRz0AW5DtXkacMYiaARDR3QYhTOKcfVCurp/lqh9KtzEW0Sq/UM+0ycwBmmaq+zYAb7JlBMqNa5s8qqGjwZKrzuEX6aTRpGGcSf2MlASDNrMAjAxveUucsBR399/g9Bv3NnLyw4BuVAbwWFl+4cwbG2ofDZNJXlRysUxzSEL6sXjKcgMvsqDICOwOXN4L+RvjbF4GAjRzQSscNHcG4TszNHd5VP2Grv6tOOVenYD1m04NsLWzh4iHsctQK1kB6YiA2JAQtoMnc7cI7KftsESbHAepDf8Uc7Ll0IkJNF2FyJKrmud46fmG0pAJXAFxroMsn+NrP+iAAowPGHBMfgVmk24iqBnyX4QxIH2ed8V7663Mjy8M3xqnAEBBuOFgSfRr4BNBPoNtfkqz6jrh75li1ipm6SvEatOCGfankf6C8ArUfusI1D8BameawtLMuKEx4GD/ZL8D90gABehEddWm8VK6+DwOJZC0xBITMDoFs/gkXcrTrM0USmhYnAnl6Fmc0pyw3Uo4YwRcmsA4ONrS3jItw1ua9hv0/7KhJQW1PbbqTuFHFn6tAbboEbevFtLsyYAXXgmCIEs70htf1FHFkj6CPrlAwwwpXNRHMNKnSYQ5jEDi9Atk+0mnDDMVBBgVvjMT84OQh1JCXHX1GR00sjHRAt/h5gK1DEDa4fRmk8w/RG9+O+5Hcruom08jgpwEnC1CYpNaiPTcZxCB+a+6ql/XAhbYnvrpmIlrJjKy5tRmNV/Ky0hO1vv8Pq/GGkpfAqxFFVUfAYSdRdYbL5fb+wOoK9Ap8GSU8hpF+Cz0AZTtqzNOcgylLlj2lleKo4AeY7gTHhOggNeNEWBZI1YSYVAKKmFhN8z9rOYRTIClM6C1Ey7Kkb9+GIUoQIKY9kyDINVN1y2lb/jUCcCYMB3HDX9fRm3J4kd5s3XtWB1CflWBxIqvrE+4OPtG4/ySFtfSpMw5QQwrn4jf0MAzh1ts6uo4wcGU8NOlJ+/2AU/8R5AXzdDJyJHdYFJ3t1raEOreLbMq5rbXIxKjRYMcThhcxRIlpobrCLK5grm3o9ZaCLEHn5RO/ny9WOyQ0vaEI5YSR4FSmS1co6LPgw2K39l57KQkTEsAkZEpqKUKQxb5VV379e0jECDBOqd2DwGHkw8Amo9kg6ZVngUHHWSWL3bYGmyisIAjlb23JNmdpC6IgVEpNbUt4L9/aVeCM3AZp5JAE577gypx6+8jvVBBoTPZFremeS57I95qViq5GEPYc4ok9QKRGGb0ugqn4zGiE401gXYxFyJum9QDKkg1G6hg3RU0JkwflE6SjxlBcBoCGzjF19fUtxh2apn1+a1ofwCBI3+37hf403v4U2z7jWgnGQUYD1NWbSdqbWM+ilG4xdswjIWWzjiNx3Ng8/Tzf2/QAHCQvgmH0L1Fue46lNvfRIlQNZqykkNHL5j2cSTZFl6yDnDkWjxnMvBD58ECpYUeSaEwL2+ap3Nn8aS7n3UOwDeQPJMMeB8i6Ed7hWB183FJq0TNH5h4alDMnAHxmfhAx+A2fZtWPNQz+vXYPY/4AAHpa9pytaCiAEhvDx2/T6s386B0IP+4AJOJhqZ0Y5qjDZkwcgNc3J7Lx2U8khfHLJ4igvPiPgfXuIzkfxdh9Qwx7LOJem9KEBhb8ArPxRA0otgNpegtBkSCTNXsjQWRDt5id0cE8lrkCSBuR6QzI/Ic7//MAolAPbbnAAUQq7tR3wqPC3X7bin4t+9qAIIwMPwT1VC+TmwyhmcycIqckaae93M4cEo7vOyQ8BEJilxOialCo1rkiLtsk8kctIz/WUul8vRBYl0vxxMDtHf9Nl0M3YpKkuF4ao5OXeY7YjNj5mSaUwdawAKUWqOSvkpTTVgpXzJZ/bEwfEWuMeWglKQ6VC+7UkCv3r8DmjjH77RstmzsFzu2bG8F8KL02c4AUyVTzn4BcdWW7mqpDQAXiMtYDtKNLrzTJS2rFiNxIG+GO4doDV+341DHaPV+OiHqTXv9+ISzR7tL6/BNa35lV1NMX2sBDbfAUzIFSbLO9Gsr2doNUB9nSWEPmAnL8OggG4CDXe+ZDbOBapdINUJWRCSa0XPNAelD6y7RKhTXi1XbIL9pMzuVprcNmKPvUKdtZzrxuzl9omulzFsl8EiPslU2P+uMaz8CsT97Y74LRKzVwvR+6IZm7tsTl5gIVDJak16QHG2qWtKM65ontXjw7d43pVJ8fDps2Y9KWlAaAW3S8lKBuO5Kq4fBThPBskTyhRtQiWfylgcWYRdwpE9fxnM/9/XPjHT+KCBfoAlvA9UwR0FzxiBydtYnQ4VJkFnofAI7gCfSn73rR7FwhkiflefxggEHS3I+AMEpB3qgBuNVFRobiK3aZ/NonZpwYMghVRQyc6Qyih7ubzX9dcwz7GwQiYJp+7b30pGhLU0AF5j8mnxBJHpeKPpYbh0/MWt9QKLNg6vDQCSGwCD+agzz8y49qV6r9b1relASwklhEX0vmCSEep3Uneu5tljqrabvY6/VkaMEorVPFCf4fKFcK9P6AmoJGOsVaw7wSTNbri5Eb2BQNcihsyEViSoYsTUmgJ2nnIxAEUOVsYYvSmQGuqqbYi2pixfguJvU8oqJIp6okFoHtbQwMKMA9hNfDxbm/Y2fnZl3wpIhW63mWrWGorqYZwWli6H6hc0D4jC9CXWVe2VyX+rrEMkbV6Bua9WeooHMBAum6vab8X82qwBPCzlnD5+raEJGoViA8AnR+dQBamehB9x9DVThKLiF4jhsEsjJnCD0SaZOCsfcPTE0/qNBJhd8KW4ALu22ou6+teFPsCvCef6lUyGeKjfwLWG35v9EdRfVBND4mFl8QwGG99+m6fosdiABIxjIziBd4gqFDv6uAB0YfQS+PdMNZI6z7JNpXADEh9r4u4Jr9/NO3zqzP1Iz7fS1ZZzW5TFTQDPgO8mBCfuxqom4QVHiB/YCCs9YitCFDXs4baorxE1wAtQj332TQJjAuakhT0u882teSb0aGR9rNsproOO+ZWSduIPm3t2xWEWisvdYPykuGeh5YgbpPsWaS+pWU1biAD/gRBaz+gsvpa9kYyfw7b2SbSuAGJD7XxdwTVMpbfh/S6GaY86auDiPVkxTdlq08mBCfut+TL00QnqAn7zeV4AFwSKNAt4mO8lhWnubZ32But+lsxg11s9PX57H+UejTmhFxpjyjCrT/Kx8PrR7WBQQ7nS07TSDpyAAqXtZbC+gGgZe8O3TNX5Rhd9GrmquouOEfAdHNqqeauDyRoDCFQLPWaC/Ot0yhl0PlNTqR/YxTGjvTT/0cRKguo/DgMMu9/CXt7z34yk+Uqsc8VUOxYolAZiOQfj7c+5+L3JUf27yfInaRI5J1Z4QmcvcSwg8BTe7C/VtnH+Epw/PYN0RJOo+xtNFc9dtiyW3rIK5hLViWQjjAZ/B8z0ZoEVJj/TzsaJDkKJK66fPpxyZzYauO6YTpuBzFS5nrvHjkT2TfCwZ42P829Gvd+JGwV80SYMeEGXVP/YkzuRVmAPp3PCNxD+ScO3jX5mK62qds4wOO7QOAGowXj+UCK87TeOAyVYFJYAAAAwhe6aRnLZRKrYmtXTp0zA/NClq5372nXV3WSc3gxR182zPe6uLhNXMmdhdhYVo73zxWUKUSOxgMXzjezcWRu0XZ7fxpa7+DKNGs7/6ZNtLmHNKGSG+5sJTShUAN6DQ7Rn2/3JJ9Uk03wxt6mu9StF+PiNAD8JUWL7n2YyXReik6Y5B68GQybW5hYpwGBSSce6002jEgwcKFwhG+2lvzjPztABupnOQ4mk7p+ovGpdzL55y1cR2FjkhfoESezNBk9inZ4qwo4jK3NA9h+ULNbv+jXyKDfKpmWzmU9Jb8AUMfISs1wIuHxopKp3FOXoH1YJxBgGBy0CN+cZ+doABumBFMjgmMbNwqv6moYzVyfN8nxVD968o+B9YpToMCTVfurX4zZDfhpCltGVN2OvAuGg04VZ/PAE44duph63ugAj0x8xpnQEgqTLEZ/AFDHyEqQ4GOXnlXQg/tbr/yJzep9Aq3/3wZBapJQAvFawD4jTlZ4S3+ZCe2RdzqRRB8BdSnD7Pnyc4gApMqBQEwrU9HRSpNpd6wQXbyKfFsCxpzvh4joXvrAAAGasWtFPfHG1QNKudhC5VRk+TKNIxfPg3HL0sJEq3u5Xq4wZHlL/gOunXOpzrsFJM5U+ghHzxXpbwzXxsvLs1mvkCPEoUi/6nMBd1pjFQSyIL1aybZXf1GWnjX8EfhOrzWDtc7Yr3aZeDlYOBXQsZnXqh1Nu+gtPbX+RDYMooHKBT+QXon2tfLTfcaaq090VEJ8r4zFwZx/37cydxm/hYPXiA4p/eauTBL68SFFSPKBj5esiK6g106F6ait4XcOqV+y9K64kZwkgAyMHUAAABqrW+5wZeABC8IY3+VGc9NLuKIG+rxOl+IYhw19me/jTijYfa4d7F7e+JF6OGQv8PgoUzobjgMoG3Te+8uPgQxKD1LYR0rFRvTQMwvBSzWMUc+2J2YwbyuY1mdFxOBRGe9D+A96Y/fwz2i8EE3wgkPGqefzXBrrJQN1gh6jsJFgUVyfPkIB9m3HI3t8JUVvqyskAABqFhiJj6dPgAAAAMYZUuUVooWujp0X33tEjcubJhGezETZ+nrH0szEyAHokOi2P8mMzhKl2QMkdb9EBoTppGG3g2z8iQ/aom5Gb4OLd/apGMfz5LGBA41pi2Z7puQ5Vb6y1CnbmEOdFOiRjS7dtlaUndUxPaSX5ZswBc/3MLqVB+lscPrEY4YmE8JgYYXC+57uyMSoaPc1XyPfH22V1qSsr48IXPHDvHwUEpvgrevD9aRA4FJEJcGE64VG5OYLZNWwxkKcm/mOX4Fl9RyvBNGy11rSEwAdmz8+6Agp0OuKw1ZCz/AvKIzcTXci6p/z8vM/WZSYuS4VVi8GgqXlpVAnUTx7WdgrdtYASoG0eVHwf8NQa4dQxuRyYc1L+GQuGKxdcFT0a/7K0wXWL4XYDUNuy1l1nmjyuZuZElCmDBv8BVvoxzKDpd/ROeIGzf6PLvl+APuh6D+uEHyCDQZaHSPaRQRJ0IPMIor+JirM8yp5rhImg2dQTTwSTRdz6g94r/csWGfaJky4dX89A7nCifH9Wxq+Dl4YZ7FLUfO5w0hxFzCKWYYlJOt1s3ucLqk3PDUaNb2qq35RKSL1CgUzCQ75WGCnMzZp8NK1EyIVEpDvWVPM9vUA/HWHr+xgHSqfCJNG8dQzypGJGMvUAHb1OQWg3pR7HXROLuSU79Dise/wX9ofUITLO+nAJHO+xchOEMGl62KPKEx5PE8/LDro5jQjJLXa5cOEpfa+RHKvLKABycpk2q9kbrgiBIjqwuwMmeluApbcuBo4sEA1+JMnWZYO0ZfwCn+u62MDBDoeJgZUs1m0dxOkVCDS7zpc5UwAgKXZLwoCOzwwmKSoutfO2+HjtcLuLkrxVipFkym3O+65AjLZwNSv83kINKvzLcsPr9KLyolma2Bg32SQ6Ut5zbA/LHRlZyYmN/OBxBO9lV1j3EyNSre1QA/za5HYdWmxirZsQdm1MgVJCSdggt6NHOgwNuf4rhnk5/6hl39TsOyOTQT/ZRCh3DuSzKPKLG51tnCQwssrg0t7mZf4/cSzYv4szyXAV8GCscKT01oYPhJE2ldE26aEr2chPlNFTuZFd4QgAAD5td/cXNow2eOXZYVqSCYBXI8hblTo2kZiiCVSVFNOjzTyGCcCF8Tm0J5m8kfCPiBuILjIeJV0c13gmGBxVXerYaB1XC5nAS9nPXtpPg98JdCn1LsWLFixd/Mf+gqlS/+ZfL/5l8v/mXy/+ZfL/5l8v/mXy/+ZfL/5l8v/mXy/+ZfL/5l8v/mXy/+ZfL/5l8v/mXy/+ZfL/5jmaoTjDXNz9BsTwQIl+schZy7WmxzvB88gKpzqgYnwQe/E24IAA", "project": "data:image/webp;base64,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", "step": "data:image/webp;base64,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", "list": "data:image/webp;base64,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", "newstep": "data:image/webp;base64,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", "option": "data:image/webp;base64,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"};
  window.mqccStepsGuide = function(jump) {
    let ov = document.getElementById('mqcc-guide-ov');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'mqcc-guide-ov';
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    const sec = (n, id, title, body) => `<section class="mqg-sec" id="mqg-${id}"><div class="mqg-num">${n}</div><div class="mqg-main"><h4>${title}</h4>${body}</div></section>`;
    const li = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;
    const fig = (k, cap) => `<figure class="mqg-fig"><img src="${MQCC_GUIDE_IMG[k]}" alt="" loading="lazy"/><figcaption>${cap}</figcaption></figure>`;
    // Nov 19 (Jordan): cabinet shops get cabinet examples; everyone else
    // gets flooring / painting ones, which nearly everyone can picture.
    const cab = mqccIsCab();
    const X = cab ? {
      qs: ['Which door style would you like?', 'Please choose the finish you would like', 'Do you need any extras?'],
      pt: 'Kitchen or Bathroom', one: 'a door style', any: 'crown moulding and other extras', count: 'doors',
      showIf: '“Glass inserts” only if they picked Shaker doors', later: 'Shaker at $28 per sq ft of that area',
      mq: 'How many square feet of doors?', mName: 'Door area', mNum: '76', mPick: 'Shaker', mRate: '28', mStep: 'Which door style would you like?', mTotal: '$2,128', mHere: '$9 per sq ft to refinish',
    } : {
      qs: ['What type of flooring would you like?', 'Please choose the paint finish you would like', 'Do you need any extras?'],
      pt: 'Living room or Basement', one: 'a type of flooring', any: 'new baseboards and other extras', count: 'stairs or rooms',
      showIf: '“Stair nosing” only if they picked Stairs', later: 'Hardwood at $7.25 per sq ft of that area',
      mq: 'How many square feet is the room?', mName: 'Room size', mNum: '200', mPick: 'Engineered hardwood', mRate: '7.25', mStep: 'What type of flooring would you like?', mTotal: '$1,450', mHere: '$1.25 per sq ft to remove old flooring',
    };
    ov.innerHTML = `
      <style>
        #mqcc-guide-ov{position:fixed;inset:0;z-index:100020;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center;padding:20px}
        #mqcc-guide-ov .mqg-box{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#fff;border-radius:16px;width:min(760px,100%);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.3)}
        #mqcc-guide-ov .mqg-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:20px 24px 14px;border-bottom:1px solid #eef0f3}
        #mqcc-guide-ov .mqg-hd h3{font-family:inherit;margin:0;font-size:20px;font-weight:800;color:#111827}
        #mqcc-guide-ov .mqg-hd p{margin:4px 0 0;font-size:13.5px;color:#6b7280}
        #mqcc-guide-ov .mqg-x{background:none;border:0;font-size:26px;line-height:1;cursor:pointer;color:#6b7280}
        #mqcc-guide-ov .mqg-body{overflow-y:auto;padding:4px 24px 18px}
        #mqcc-guide-ov .mqg-sec{display:flex;gap:14px;padding:18px 0;border-bottom:1px solid #f1f2f4}
        #mqcc-guide-ov .mqg-sec:last-child{border-bottom:0}
        #mqcc-guide-ov .mqg-num{flex:none;width:28px;height:28px;border-radius:50%;background:#111827;color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;margin-top:1px}
        #mqcc-guide-ov .mqg-main{min-width:0;flex:1;font-size:14px;color:#374151;line-height:1.6}
        #mqcc-guide-ov h4{font-family:inherit;margin:0 0 6px;font-size:16px;font-weight:800;color:#111827}
        #mqcc-guide-ov p{margin:0 0 8px}
        #mqcc-guide-ov ul{margin:6px 0 0;padding-left:18px}
        #mqcc-guide-ov li{margin:4px 0}
        #mqcc-guide-ov b{color:#111827}
        #mqcc-guide-ov .mqg-fig{margin:12px 0 4px}
        #mqcc-guide-ov .mqg-fig img{display:block;width:100%;height:auto;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 2px 8px rgba(17,24,39,.06)}
        #mqcc-guide-ov figcaption{font-size:12.5px;color:#6b7280;margin-top:6px;text-align:center}
        #mqcc-guide-ov .mqg-ex{margin-top:10px;background:#f8fafc;border:1px solid #e5ebf3;border-radius:10px;padding:10px 14px;font-size:13.5px}
        #mqcc-guide-ov .mqg-ex-t{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;margin-bottom:4px}
        #mqcc-guide-ov .mqg-tip{margin-top:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;color:#1e3a8a;font-size:13.5px}
        #mqcc-guide-ov .mqg-ft{display:flex;justify-content:flex-end;padding:12px 24px;border-top:1px solid #eef0f3}
      </style>
      <div class="mqg-box" role="dialog" aria-label="How to use steps">
        <div class="mqg-hd"><div><h3>📘 How to use steps</h3><p>Everything you need to build your quote — no experience needed.</p></div><button type="button" class="mqg-x" aria-label="Close" onclick="document.getElementById('mqcc-guide-ov').remove()">×</button></div>
        <div class="mqg-body">
          ${sec(1, 'what', 'How your quote works', `<p>When a customer starts your quote, the first thing they’re asked is <b>which project type</b> they’re doing — like ${X.pt}. That question is <b>automatic</b>; you don’t need to make it.</p>
            <p>After that come <b>your steps</b>: the questions you want to ask, one at a time. At the end, the customer sees their price.</p>
            ${fig('project', 'The project type is always asked first. Your steps are listed after it, on the left.')}`)}
          ${sec(2, 'idea', 'Steps and options', `<p>A <b>step</b> is one question. The answers the customer can pick are called <b>options</b>, and each option has its own price.</p>
            <div class="mqg-ex"><div class="mqg-ex-t">Good step questions</div>${X.qs.map(q => `“${q}”`).join('<br/>')}</div>
            ${fig('step', 'One step, exactly as your customer sees it — they tap an option, then Continue.')}`)}
          ${sec(3, 'find', 'Find your steps', `<p>On this Pricing page, scroll to <b>Custom pricing categories</b>. Each of your quotes has its own box, with its steps listed in the order customers see them.</p>
            ${fig('list', 'A quote with two steps. Tap a step to see its options.')}`)}
          ${sec(4, 'step', 'Make a new step', `<p>Tap <b>+ New step</b> on the quote you want. A box opens — fill it in from top to bottom:</p>
            ${fig('newstep', 'The new-step box. The preview on the right shows what customers will see as you type.')}
            ${li([
              `<b>What kind of step?</b> Pick <b>Choices</b> when customers choose from options, or <b>A measurement</b> when they type a number (like square feet).`,
              `<b>Show this step for these project types</b> — untick any project type it doesn’t apply to.`,
              `<b>Heading</b> — your question, e.g. “${X.qs[1]}”. Add a short <b>description</b> if it helps.`,
              `<b>Customers can pick</b> — <b>One</b> (like ${X.one}) or <b>Any</b> (like ${X.any}).`,
              `<b>Options</b> — type a name and a price for each answer, and choose what the price is based on: a flat price, per item, per square or linear foot, or one of your quote’s measurements. Tap <b>+ Add option</b> for more.`,
              `Further down: tick <b>must choose</b> if they can’t skip it, pick <b>where it goes</b>, and use <b>Only show this step if…</b> to show it only after an earlier answer (e.g. ${X.showIf}).`,
              `Tap <b>Save</b> and your step is live.`,
            ])}`)}
          ${sec(5, 'meas', 'Measurement steps', `<p>Use a measurement step when your price depends on <b>how big the job is</b>. Instead of picking an option, the customer types a number — like “${X.mq}”.</p>
            ${fig('meas', 'A measurement step. Customers see a box to type their number, plus a calculator if they measured in inches or millimetres.')}
            ${li([
              `In the new-step box, pick <b>A measurement</b> under <b>What kind of step?</b>`,
              `<b>Measured in</b> — <b>Square feet</b> (floors, walls, doors), <b>Linear feet</b> (baseboards, trim, countertops) or <b>A count</b> for anything you count, like ${X.count}.`,
              `<b>Name on the quote</b> — a short name for the number, like “${X.mName}”. It’s how the number shows on the estimate, and how you’ll find it when pricing options.`,
            ])}
            <p style="margin-top:10px"><b>Then choose how it’s priced:</b></p>
            ${li([
              `<b>Price it here</b> — the number has one price of its own, e.g. ${X.mHere}. Good when every customer pays the same rate.`,
              `<b>A later step prices it</b> — the step just collects the number, and your options use it. Make a Choices step after it, and set each option to <b>per sq ft of ${X.mName}</b>.`,
            ])}
            <div class="mqg-ex"><div class="mqg-ex-t">How it adds up</div>
              The customer types <b>${X.mNum}</b> in “${X.mq}”, then picks <b>${X.mPick}</b> ($${X.mRate} per sq ft of ${X.mName}) in “${X.mStep}”.<br/>
              Their estimate: ${X.mNum} × $${X.mRate} = <b>${X.mTotal}</b>. Each option can have its own rate on the same number.</div>
            <div class="mqg-tip">💡 Tick <b>Customers must fill this in</b> when the price can’t be worked out without the number.</div>`)}
          ${sec(6, 'option', 'Fine-tune an option', `<p>Every option has more settings. Tap <b>Edit</b> on any option to open them:</p>
            ${fig('option', 'The option box. Change anything on the left and watch the preview on the right.')}
            ${li([
              `<b>What it’s priced on</b> — flat, per item, per sq ft or lin ft, one of your quote’s measurements, a percentage, or “a later step prices it” (just a choice, no price).`,
              `<b>Work it out from a job you know</b> — enter a past job’s size and cost, and the price is worked out for you.`,
              `<b>Minimum charge</b> — so small jobs never come in too low.`,
              `<b>Offer installation</b> — customers choose Supply only or Supply + install, priced however you like.`,
              `<b>Photo</b> — add one in <b>My Products</b>; it shows on the option and on the estimate.`,
            ])}`)}
          ${sec(7, 'tidy', 'After you save', `${li([
            `<b>↑ ↓</b> change the order of steps and options.`,
            `The <b>switch</b> on an option turns it off without deleting it.`,
            `<b>Duplicate</b> copies a step or option with all its settings.`,
            `Tap <b>Preview widget</b> at the top of the dashboard to try your quote as a customer.`,
          ])}<div class="mqg-tip">✨ Start small: one step, two or three options, a price each. Try it in the preview, then add more.</div>`)}
        </div>
        <div class="mqg-ft"><button type="button" class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="document.getElementById('mqcc-guide-ov').remove()">Got it</button></div>
      </div>`;
    document.body.appendChild(ov);
    if (jump) { const t = ov.querySelector('#mqg-' + jump); if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 30); }
  };
  const MQCC_HOW = {
    flat:       { label: 'Flat price', short: 'flat', group: 'Simple' },
    later:      { label: 'No price here — a later step prices it', short: '', group: 'Simple' },
    each:       { label: 'Per custom unit — customer enters how many (hours, panels…)', short: 'each', group: 'Simple', per: 'unit' },
    sqft:       { label: 'Per sq ft — customer enters the square feet', short: 'per sq ft', group: 'Simple', per: 'sq ft', word: 'sq ft' },
    lft:        { label: 'Per linear ft — customer enters the linear feet', short: 'per lin ft', group: 'Simple', per: 'lin ft', word: 'lin ft' },
    opt:        { label: 'Another option’s number', short: '', group: 'From the quote' },
    meas:       { label: 'One of this quote’s measurements (e.g. wall area)', short: '', group: 'From the quote' },
    base_lf:    { label: 'Base cabinet lin ft', short: 'per base lin ft', group: 'From the quote', per: 'lin ft', word: 'ft of base cabinets' },
    upper_lf:   { label: 'Upper cabinet lin ft', short: 'per upper lin ft', group: 'From the quote', per: 'lin ft', word: 'ft of upper cabinets' },
    all_lf:     { label: 'Total cabinet lin ft (uppers + bases)', short: 'per cabinet lin ft', group: 'From the quote', per: 'lin ft', word: 'ft of cabinets' },
    island_lf:  { label: 'Island lin ft', short: 'per island lin ft', group: 'From the quote', per: 'lin ft', word: 'ft of island' },
    crown_lf:   { label: 'Crown moulding lin ft', short: 'per crown lin ft', group: 'From the quote', per: 'lin ft', word: 'ft of crown' },
    valance_lf: { label: 'Valance lin ft', short: 'per valance lin ft', group: 'From the quote', per: 'lin ft', word: 'ft of valance' },
    drawers:    { label: 'Number of drawers', short: 'per drawer', group: 'From the quote', per: 'drawer', word: 'drawers' },
    tallcabs:   { label: 'Number of tall cabinets', short: 'per tall cabinet', group: 'From the quote', per: 'tall cabinet', word: 'tall cabinets' },
    pct:        { label: '% of the cabinet estimate', short: 'of cabinets', group: 'Percentage', sfx: '% of the cabinet estimate' },
    pct_all:    { label: '% of the cabinet estimate including extras', short: 'of cabinets + extras', group: 'Percentage', sfx: '% of cabinets + extras' },
    pct_cc:     { label: '% of one of your custom categories', short: 'of', group: 'Percentage', sfx: '% of that category' },
  };
  const MQCC_PCT = ['pct', 'pct_all', 'pct_cc'];
  // Hows that give a count another option can be priced on.
  const MQCC_COUNTS = ['each', 'sqft', 'lft', 'opt', 'meas', 'base_lf', 'upper_lf', 'all_lf', 'island_lf', 'crown_lf', 'valance_lf', 'drawers', 'tallcabs'];
  const MQCC_PLACES = [
    ['measuring', 'After “How to measure”'], ['si', 'After “Supply + install”'], ['selections', 'After cabinet materials & doors'],
    ['measurements', 'After cabinet measurements'], ['drawers', 'After drawers'], ['tallcabs', 'After tall cabinets'],
    ['trim', 'After crown moulding / valance'], ['specialty', 'After Details & Selections (default)'], ['countertops', 'At the very end (after countertops on the Both tab)'],
  ];
  // Every place a step can go, in widget order: each built-in step, with the
  // custom steps already placed after it listed right under it (and steps
  // placed after those, and so on) — so a new step can go before/after any
  // of them. `selfId` (the category being edited) and anything chained after
  // it are left out, so a step can't be placed after itself.
  // `qt` = which quote the step is in ('' = Cabinets / Both, or one of the
  // shop's own quote types). A quote type's steps only line up with its own
  // steps; they all start right after its "Supply + install" question.
  function mqccPlaceList(selfId, qt) {
    const cats = mqccCats().filter(c => (c.qt || '') === (qt || ''));
    const out = [], seen = new Set();
    const walk = (key, depth) => cats.filter(c => mqccAfterKey(c) === key && !seen.has(c.id)).forEach(c => {
      seen.add(c.id);
      if (c.id === selfId) return; // skip itself and its own chain
      out.push(['cc:' + c.id, `${'\u00a0\u00a0\u00a0'.repeat(depth)}↳ After ✨ ${c.name}`]);
      walk('cc:' + c.id, depth + 1);
    });
    if (qt) {
      out.push(['si', 'At the start (right after the project type and measuring guide)']);
      walk('si', 1);
      out.push(['specialty', 'After Details & Selections (its specialty items, if it has any)']);
      walk('specialty', 1);
      return out;
    }
    const boffP = mqphBoff();
    MQCC_PLACES.forEach(([v, l]) => { const offP = MQ_BOFF_PLACE[v] && MQ_BOFF_PLACE[v].every(k => boffP.has(k)); out.push([v, offP ? l + ' (switched off — goes in its spot)' : l]); walk(v, 1); });
    return out;
  }
  // A quote type's step only knows "at the start" or "after another step".
  function mqccAfterKey(c) {
    const a = c.after || 'specialty';
    if (c.qt && !/^cc:/.test(a)) return a === 'specialty' ? 'specialty' : 'si';
    return a;
  }
  function mqccPlaceLabel(after, qt) {
    if (/^cc:/.test(after || '')) { const c = mqccCats().find(x => x.id === after.slice(3)); return 'After ✨ ' + (c ? c.name : 'a removed step'); }
    if (qt) return after === 'specialty' ? 'After Details & Selections' : 'At the start';
    return ((MQCC_PLACES.find(x => x[0] === after) || ['', 'After Details & Selections'])[1]).replace(' (default)', '');
  }
  // The shop's own quote types (Shop Info → Estimator tabs).
  function mqccQts() {
    let cfg = null;
    try { cfg = JSON.parse(mqccShopFields()['Hidden widget tabs'] || 'null'); } catch(e) { cfg = null; }
    return (cfg && Array.isArray(cfg.quoteTypes)) ? cfg.quoteTypes.filter(q => q && /^qt_[a-z0-9]+$/i.test(String(q.id || ''))) : [];
  }
  function mqccQtName(qt) { const q = mqccQts().find(x => x.id === qt); return q ? q.name : ''; }
  const MQCC_TIE_CATS = [['door', 'Door style'], ['material', 'Box material'], ['drawer', 'Drawer type'], ['hinge', 'Hinges'], ['crown', 'Crown moulding'], ['valance', 'Valance']];
  let mqccEditCat = null;   // category id being edited in the settings modal (null = new)
  let mqccEditItem = null;  // { cid, id } option being edited (id null = new)

  function mqccEsc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function mqccMoney(n) { const v = Number(n) || 0; return CUR() + v.toLocaleString(undefined, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function mqccShopFields() {
    // dashboard.js may have swapped in a freshly fetched shop record since
    // this file was initialised — always prefer the newest copy.
    return (window._mqShopRecord && window._mqShopRecord.id === shopRecord.id && window._mqShopRecord.fields) || shopRecord.fields || {};
  }
  function mqccCats() {
    let a = [];
    try { a = JSON.parse(mqccShopFields()['Custom categories'] || '[]'); } catch(e) { a = []; }
    return Array.isArray(a) ? a.filter(c => c && c.id) : [];
  }
  async function mqccSaveCats(cats) {
    const json = JSON.stringify(cats);
    await atUpdate(SHOPS_TABLE, shopRecord.id, { 'Custom categories': json });
    shopRecord.fields['Custom categories'] = json;
    if (window._mqShopRecord && window._mqShopRecord.fields) window._mqShopRecord.fields['Custom categories'] = json;
    // So My Products picks the change up the next time it's opened.
    if (window._mqLastFetchTimes) window._mqLastFetchTimes['products'] = 0;
  }
  function mqccCfg(r) {
    let c = {};
    try { c = JSON.parse((r && r.fields && r.fields['Custom pricing']) || '{}'); } catch(e) { c = {}; }
    return (c && typeof c === 'object') ? c : {};
  }
  function mqccItems(cid) {
    return lineItems.filter(r => r.fields && r.fields['Category'] === cid)
      .sort((a, b) => (a.fields['Sort order'] || 0) - (b.fields['Sort order'] || 0));
  }
  // Phase 4: a quote type's own measurements (Project types → Measurements):
  // [{id:'m_…', label, type:'sqft'|'lft'|'count', unit}] on the quote type.
  // Nov 18 (Jordan): one short line per quote saying which measurements it
  // can price with, or that it has none yet (with an example + a link).
  // Nov 18 (Jordan): "How many square feet?" isn't a step — it's a
  // measurement. Shown in the step dialog for a quote type, with the quote's
  // measurements and a quick way to add one right here.
  const MQCC_NUMQ = /how (many|much)|square f|sq\.? ?f|linear|lin\.? ?f|measure|dimension|length|width|\barea\b|footage/i;
  function mqccCatMeasHook() {
    const nmEl = document.getElementById('mqcc-cat-name');
    if (!nmEl || nmEl._mqMeasHook) return;
    nmEl._mqMeasHook = 1;
    nmEl.addEventListener('input', () => {
      const h = MQCC_NUMQ.test(nmEl.value);
      if (h === nmEl._mqMeasHot) return;
      nmEl._mqMeasHot = h;
      const keep = (document.getElementById('mqcc-cat-measname') || {}).value;
      mqccCatMeasBox();
      const mn = document.getElementById('mqcc-cat-measname'); if (mn && keep) mn.value = keep;
    });
  }
  function mqccCatMeasBox() {
    const box = document.getElementById('mqcc-cat-measbox'); if (!box) return;
    const qt = (document.getElementById('mqcc-cat-qt') || {}).value || '';
    if (!qt) { box.style.display = 'none'; return; }
    const ms = mqccMeasOf(qt);
    const nmEl = document.getElementById('mqcc-cat-name');
    const hot = MQCC_NUMQ.test((nmEl || {}).value || '');
    if (nmEl) nmEl._mqMeasHot = hot;
    box.style.display = 'block';
    box.style.background = hot ? '#fffbeb' : '#f0fdfa';
    box.style.borderColor = hot ? '#fcd34d' : '#99f6e4';
    box.style.color = hot ? '#78350f' : '#134e4a';
    if (!hot && !box._open) {
      box.style.background = '#f9fafb'; box.style.borderColor = '#e5e7eb'; box.style.color = '#374151';
      box.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span>📏 Need the customer to type a number, like square feet?</span><a href="#" onclick="event.preventDefault();mqccCatMeasOpen()" style="font-weight:600;color:#2563eb;text-decoration:none">That's a measurement →</a></div>`;
      return;
    }
    const esc = mqccEsc;
    const chips = ms.length ? ms.map(m => `<span style="display:inline-flex;gap:4px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:2px 8px;font-weight:600;color:#111827">${esc(m.label)} <span style="font-weight:400;color:#6b7280">${esc(mqccMeasUnit(m))}</span></span>`).join(' ') : '<span style="color:#6b7280">none yet</span>';
    box.innerHTML = `<div style="font-weight:700;margin-bottom:4px">${hot ? 'Asking for a number? Make it a measurement instead.' : 'Need the customer to type a number, like square feet?'}</div>
      <div>That's a <strong>measurement</strong>, not a step. A step is always a set of choices (e.g. <em>Door finish: Paint / Stain</em>). Price each choice <em>per sq ft</em> of a measurement, and its box shows on your widget right after the step.</div>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span>This quote's measurements:</span> ${chips}</div>
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <input type="text" id="mqcc-cat-measname" maxlength="40" placeholder="e.g. Door area" style="flex:1 1 150px;min-width:0;padding:7px 9px;border:1px solid #d1d5db;border-radius:8px;font:inherit;font-size:13px;background:#fff"/>
        <select id="mqcc-cat-meastype" onchange="document.getElementById('mqcc-cat-measunit').style.display=this.value==='count'?'':'none'" style="width:auto;padding:7px 8px;border:1px solid #d1d5db;border-radius:8px;font:inherit;font-size:13px;background:#fff"><option value="sqft">Square feet</option><option value="lft">Linear feet</option><option value="count">A count…</option></select>
        <input type="text" id="mqcc-cat-measunit" maxlength="24" placeholder="what's counted, e.g. doors" style="display:none;flex:0 1 160px;padding:7px 9px;border:1px solid #d1d5db;border-radius:8px;font:inherit;font-size:13px;background:#fff"/>
        <button type="button" class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqccCatMeasAdd(this)">+ Add measurement</button>
      </div>
      <div id="mqcc-cat-measmsg" style="font-size:12px;margin-top:6px"></div>`;
  }
  window.mqccCatMeasOpen = function() { const mb = document.getElementById('mqcc-cat-measbox'); if (mb) mb._open = 1; mqccCatMeasBox(); const n = document.getElementById('mqcc-cat-measname'); if (n) n.focus(); };
  window.mqccCatMeasAdd = async function(btn) {
    const qt = (document.getElementById('mqcc-cat-qt') || {}).value || '';
    const label = String((document.getElementById('mqcc-cat-measname') || {}).value || '').trim();
    const type = (document.getElementById('mqcc-cat-meastype') || {}).value || 'sqft';
    const unit = type === 'count' ? String((document.getElementById('mqcc-cat-measunit') || {}).value || '').trim() : '';
    const msg = t => { const m = document.getElementById('mqcc-cat-measmsg'); if (m) m.innerHTML = t; };
    if (!qt) return;
    if (!label) { msg('<span style="color:#b91c1c">Give it a name first, e.g. Door area.</span>'); return; }
    if (type === 'count' && !unit) { msg('<span style="color:#b91c1c">Say what\'s counted, e.g. doors.</span>'); return; }
    const f = mqccShopFields();
    let cfgAll = {}; try { cfgAll = JSON.parse(f['Hidden widget tabs'] || '{}') || {}; } catch (e) { cfgAll = {}; }
    const q = (cfgAll.quoteTypes || []).find(x => x && x.id === qt);
    if (!q) return;
    q.measures = Array.isArray(q.measures) ? q.measures : [];
    if (q.measures.some(x => x && String(x.label || '').trim().toLowerCase() === label.toLowerCase())) { msg('<span style="color:#b91c1c">This quote already has a measurement with that name.</span>'); return; }
    q.measures.push({ id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), label, type, unit });
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
    try {
      const json = JSON.stringify(cfgAll);
      await atUpdate(SHOPS_TABLE, shopRecord.id, { 'Hidden widget tabs': json });
      shopRecord.fields['Hidden widget tabs'] = json;
      if (window._mqShopRecord && window._mqShopRecord.fields) window._mqShopRecord.fields['Hidden widget tabs'] = json;
      { const mb = document.getElementById('mqcc-cat-measbox'); if (mb) mb._open = 1; }
      mqccCatMeasBox();
      msg(`<span style="color:#15803d;font-weight:600">✓ ${mqccEsc(label)} added.</span> Now make this step a choice (e.g. Door finish), save it, then on each option pick <strong>Price by → One of this quote's measurements</strong>.`);
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = '+ Add measurement'; }
      msg('<span style="color:#b91c1c">Couldn\'t save. Please try again.</span>');
    }
  };
  function mqccMeasNote(qtId) {
    const ms = mqccMeasOf(qtId);
    const ruler = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l14-14 4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>';
    const go = (txt) => `<button type="button" class="mqph-btn mqph-btn-secondary mqph-btn-sm" style="margin-left:auto;white-space:nowrap" onclick="event.stopPropagation();(window.mqQtOpenMeas||window.mqQtOpenInRooms)('${qtId}')">${txt} →</button>`;
    const box = (inner, tone) => `<div class="mqcc-meas-note" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fff;border:1px solid ${tone};border-radius:8px;padding:9px 12px;margin:4px 0 10px;font-size:12.5px;color:#374151;line-height:1.45">${inner}</div>`;
    if (!ms.length) return box(`<span style="color:#b45309;display:inline-flex">${ruler}</span><span><strong style="color:#111827">No measurements yet.</strong> Add one in Project types to price by size — e.g. <em>Wall area</em> in sq ft, priced at $2.50 per sq ft.</span>${go('Add measurements')}`, '#fde68a');
    const chip = m => `<span style="display:inline-flex;align-items:center;gap:5px;background:#f3f4f6;border-radius:6px;padding:3px 8px;font-weight:600;color:#111827">${mqccEsc(m.label)} <span style="font-weight:400;color:#6b7280">${mqccEsc(mqccMeasUnit(m))}</span></span>`;
    return box(`<span style="color:#0d9488;display:inline-flex">${ruler}</span><span style="color:#6b7280">Measurements you can price with:</span><span style="display:inline-flex;flex-wrap:wrap;gap:6px">${ms.map(chip).join('')}</span>${go('Edit')}`, '#e5e7eb');
  }
  function mqccMeasOf(qtId) { const q = mqccQts().find(x => x.id === qtId); return (q && Array.isArray(q.measures)) ? q.measures.filter(m => m && m.id && m.label) : []; }
  function mqccMeasUnit(m) { return !m ? 'unit' : (m.type === 'sqft' ? 'sq ft' : (m.type === 'lft' ? 'lin ft' : (m.unit || 'units'))); }
  function mqccMeasFind(measId) { for (const q of mqccQts()) { const m = (q.measures || []).find(x => x && x.id === measId); if (m) return m; } return null; }
  function mqccSrcUnit(srcId) {
    const r = lineItems.find(x => x.id === srcId);
    if (!r) return 'unit';
    const c = mqccCfg(r);
    if (c.how === 'meas') return mqccMeasUnit(mqccMeasFind(c.meas));
    if (c.how === 'each') return c.unit || r.fields['Name'] || 'unit';
    if (c.how === 'opt') return mqccSrcUnit(c.src);
    return (MQCC_HOW[c.how] && MQCC_HOW[c.how].per) || 'unit';
  }
  function mqccPriceText(r) {
    const c = mqccCfg(r), rate = Number(r.fields['Rate']) || 0, how = MQCC_HOW[c.how] ? c.how : 'flat';
    const pct = `${rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
    if (how === 'pct_cc') { const cat = mqccCats().find(x => x.id === c.pctCc); return `${pct} of ${mqccEsc(cat ? cat.name : 'a removed category')}`; }
    if (MQCC_PCT.includes(how)) return `${pct} ${MQCC_HOW[how].short}`;
    if (Array.isArray(c.variants) && c.variants.length && ['each', 'sqft', 'lft'].includes(how)) {
      const ps = c.variants.map(v => Number(v.price) || 0);
      const lo = Math.min(...ps), hi = Math.max(...ps);
      const per = how === 'each' ? mqccEsc(c.unit || 'unit') : MQCC_HOW[how].per;
      return `${lo === hi ? mqccMoney(lo) : mqccMoney(lo) + '–' + mqccMoney(hi)} per ${per.replace(/s$/, '')} <span style="font-weight:400;color:#6b7280">(${c.variants.length} variants)</span>`;
    }
    if (c.later) return '<span style="font-weight:500;color:#6b7280">Priced in a later step</span>';
    if (how === 'flat') return mqccMoney(rate);
    if (how === 'each') return `${mqccMoney(rate)} each (${mqccEsc(c.unit || 'unit')})`;
    if (how === 'meas') { const m = mqccMeasFind(c.meas); return `${mqccMoney(rate)} per ${mqccEsc(mqccMeasUnit(m).replace(/s$/, ''))} <span style="font-weight:400;color:#6b7280">(from ${mqccEsc(m ? m.label : 'a removed measurement')})</span>`; }
    if (how === 'opt') return `${mqccMoney(rate)} per ${mqccEsc(mqccSrcUnit(c.src))} <span style="font-weight:400;color:#6b7280">(from ${mqccEsc((lineItems.find(x => x.id === c.src) || { fields: {} }).fields['Name'] || 'a removed option')})</span>`;
    return `${mqccMoney(rate)} ${MQCC_HOW[how].short}`;
  }
  function mqccTieText(t) {
    if (!t || !t.cat || !Array.isArray(t.names) || !t.names.length) return '';
    const lab = (MQCC_TIE_CATS.find(x => x[0] === t.cat) || ['', t.cat])[1].toLowerCase();
    const shown = t.names.slice(0, 3).join(', ') + (t.names.length > 3 ? ` +${t.names.length - 3} more` : '');
    return `linked to ${lab}: ${shown}`;
  }
  // Names the shop can tie to, straight from their own pricing items.
  function mqccTieNames(cat) {
    const act = lineItems.filter(r => r.fields && r.fields['Active'] !== false);
    let names = [];
    if (cat === 'material') names = act.filter(r => r.fields['Category'] === 'material').map(r => (r.fields['Name'] || '').replace(/\s*—\s*(uppers|bases).*$/i, ''));
    else if (cat === 'drawer') names = act.filter(r => r.fields['Category'] === 'drawer').map(r => (r.fields['Name'] || '').replace(/\s*—\s*(some|mostly) drawers\s*$/i, ''));
    else if (cat === 'crown') names = act.filter(r => r.fields['Category'] === 'trim' && r.fields['Trim type'] !== 'valance').map(r => r.fields['Name']);
    else if (cat === 'valance') names = act.filter(r => r.fields['Category'] === 'trim' && r.fields['Trim type'] === 'valance').map(r => r.fields['Name']);
    else names = act.filter(r => r.fields['Category'] === cat).map(r => r.fields['Name']);
    return [...new Set(names.map(n => String(n || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }
  function mqccTieFieldHtml(pfx) {
    return `<div class="mqph-field"><label>Link to another pick (optional — like crown &amp; door styles)</label>
      <select id="mqcc-${pfx}-tiecat" onchange="mqccTieRender('${pfx}', [])">
        <option value="">Not linked</option>
        ${MQCC_TIE_CATS.filter(([v]) => !(MQ_BOFF_TIE[v] && mqphBoff().has(MQ_BOFF_TIE[v]))).map(([v, l]) => `<option value="${v}">Link to a ${l.toLowerCase()}</option>`).join('')}
      </select>
      <div id="mqcc-${pfx}-tienames" style="display:none;max-height:170px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;padding:6px 10px;margin-top:6px"></div>
    </div>`;
  }
  window.mqccTieRender = function(pfx, selected) {
    const cat = document.getElementById(`mqcc-${pfx}-tiecat`).value;
    const box = document.getElementById(`mqcc-${pfx}-tienames`);
    if (!cat) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const names = mqccTieNames(cat);
    const sel = new Set((selected || []).map(n => String(n).toLowerCase()));
    box.style.display = 'block';
    box.innerHTML = names.length
      ? `<div style="font-size:11px;color:#6b7280;margin:2px 0 6px;line-height:1.45">When the customer picks one of these, this option is chosen for them automatically (they can still change it). It's hidden the rest of the time.</div>` + names.map(n => `<label style="display:flex;align-items:center;gap:8px;font-size:13px;padding:3px 0;cursor:pointer"><input type="checkbox" value="${mqccEsc(n)}" ${sel.has(n.toLowerCase()) ? 'checked' : ''} style="width:15px;height:15px"/> ${mqccEsc(n)}</label>`).join('')
      : `<div style="font-size:12px;color:#9ca3af;padding:4px 0">You don’t have any of these set up in Pricing yet.</div>`;
  };
  function mqccTieRead(pfx) {
    const cat = document.getElementById(`mqcc-${pfx}-tiecat`).value;
    if (!cat) return null;
    const names = [...document.querySelectorAll(`#mqcc-${pfx}-tienames input:checked`)].map(i => i.value);
    return names.length ? { cat, names } : null;
  }
  function mqccTieLoad(pfx, tie) {
    document.getElementById(`mqcc-${pfx}-tiecat`).value = (tie && tie.cat) || '';
    mqccTieRender(pfx, (tie && tie.names) || []);
  }
  function mqccOptionLabel(id) {
    const r = lineItems.find(x => x.id === id);
    if (!r) return '';
    const cat = mqccCats().find(c => c.id === r.fields['Category']);
    return `${cat ? cat.name + ': ' : ''}${r.fields['Name'] || ''}`;
  }
  // Every option that could be used in a "show only if" rule.
  function mqccAllOptions(excludeCid, excludeId) {
    const out = [];
    mqccCats().forEach(c => {
      if (c.id === excludeCid && !excludeId) return; // a category can't depend on its own options
      mqccItems(c.id).forEach(r => { if (r.id !== excludeId) out.push({ id: r.id, label: `${c.name}: ${r.fields['Name'] || ''}` }); });
    });
    return out;
  }
  function mqccChip(text, tone) {
    const tones = { gold: 'background:#fffbeb;border-color:#fde68a;color:#92400e', blue: 'background:#eff6ff;border-color:#bfdbfe;color:#1e40af', gray: 'background:#f9fafb;border-color:#e5e7eb;color:#4b5563' };
    return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.03em;padding:2px 7px;border:1px solid;border-radius:10px;${tones[tone] || tones.gray};white-space:nowrap">${text}</span>`;
  }

  // ── Pricing filter (Jordan, Nov 2026) ─────────────────────────────────
  // A bar at the top of Pricing: pick a quote (Cabinets or one of the shop's
  // quote types), optionally one of its project types, and Everything /
  // Website widget only / Pro only. Only matching steps and options show,
  // and anything added while filtered starts tagged for it (pre-ticked in
  // the add window, still editable). Remembered per shop in this browser.
  function mqccFKeyName() { return 'mqcc_filter_' + ((shopRecord && (shopRecord._recordId || shopRecord.id)) || ''); }
  function mqccF() {
    if (!window._mqccFilter) {
      try { window._mqccFilter = JSON.parse(localStorage.getItem(mqccFKeyName()) || 'null'); } catch (e) { window._mqccFilter = null; }
      if (!window._mqccFilter || typeof window._mqccFilter !== 'object') window._mqccFilter = { qt: 'all', room: '', pro: 'all' };
    }
    const f = window._mqccFilter;
    if (!['all', 'widget', 'pro'].includes(f.pro)) f.pro = 'all';
    return f;
  }
  function mqccFSave() { try { localStorage.setItem(mqccFKeyName(), JSON.stringify(mqccF())); } catch (e) {} }
  function mqccQtIsPro(qt) { if (!qt) return false; const q = mqccQts().find(x => x.id === qt); return !!(q && q.proOnly); }
  function mqccFLiveQts() {
    const off = typeof window.mqQtsNotOffered === 'function' ? window.mqQtsNotOffered(mqccShopFields()) : new Set();
    return mqccQts().filter(q => !off.has(q.id));
  }
  // null = every quote; '' = Cabinets; 'qt_…' = that quote type.
  function mqccFKey() {
    const f = mqccF();
    if (f.qt === 'cab') return mqphComputeTabScope().countertopsOnly ? null : '';
    if (f.qt && f.qt !== 'all') return mqccFLiveQts().some(q => q.id === f.qt) ? f.qt : null;
    return null;
  }
  function mqccFRoom() {
    const k = mqccFKey(), f = mqccF();
    if (k === null || !f.room) return '';
    return mqccQtRooms(k).some(r => r.id === f.room) ? f.room : '';
  }
  function mqccFActive() { return mqccFKey() !== null || mqccF().pro !== 'all'; }
  function mqccItemRooms(r) { let v = []; try { v = JSON.parse((r && r.fields && r.fields['Visible rooms']) || '[]'); } catch (e) { v = []; } return Array.isArray(v) ? v : []; }
  function mqccFStepOk(c) {
    const f = mqccF(), k = mqccFKey(), room = mqccFRoom();
    if (k !== null && (c.qt || '') !== k) return false;
    if (room && (mqccCatRoomsHidden()[c.id] || []).includes(room)) return false;
    const stepPro = !!c.proOnly || mqccQtIsPro(c.qt);
    if (f.pro === 'widget' && stepPro) return false;
    return true;
  }
  function mqccFItemOk(r, c) {
    const f = mqccF(), room = mqccFRoom();
    if (room) { const v = mqccItemRooms(r); if (v.length && !v.includes(room)) return false; }
    const pro = !!mqccCfg(r).proOnly, stepPro = !!c.proOnly || mqccQtIsPro(c.qt);
    if (f.pro === 'widget' && pro) return false;
    return true;
  }
  function mqccRoomNames(qt, ids) { const rs = mqccQtRooms(qt); return ids.map(id => (rs.find(r => r.id === id) || {}).name).filter(Boolean); }
  window.mqccSetFilter = function (k, v) {
    const f = mqccF(); f[k] = v; if (k === 'qt') f.room = '';
    mqccFSave(); mqccRerender(null);
  };
  // What a new step / option made right now gets tagged with.
  function mqccFTagText(qtOverride) {
    const k = mqccFKey(), room = mqccFRoom(), f = mqccF(), bits = [];
    if (k !== null) bits.push(k === '' ? 'Cabinets' : mqccQtName(k));
    if (room && (qtOverride === undefined || qtOverride === k)) bits.push((mqccQtRooms(k).find(r => r.id === room) || {}).name + ' only');
    if (f.pro === 'pro') bits.push('⚡ MidasQuote Pro only');
    return bits.join(' · ');
  }
  function mqccFNoteHtml(id) {
    return `<div id="${id}" style="display:none;align-items:flex-start;gap:9px;background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;padding:9px 12px;margin:0 0 14px;font-size:12.5px;color:#1e3a8a;line-height:1.5"></div>`;
  }
  function mqccFNoteFill(id, isNew) {
    const el = document.getElementById(id); if (!el) return;
    const t = isNew && mqccFActive() ? mqccFTagText() : '';
    if (!t) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.innerHTML = `<span>🎯</span><span>Pre-filled from your Pricing filter: <strong>${mqccEsc(t)}</strong>. You can change any of it below before saving.</span>`;
    el.style.display = 'flex';
  }
  function mqccFBarHtml() {
    const f = mqccF(), k = mqccFKey(), room = mqccFRoom();
    const cab = !mqphComputeTabScope().countertopsOnly;
    const qts = mqccFLiveQts();
    const qtChoices = (cab ? 1 : 0) + qts.length;
    const chip = (on, label, js, title) => `<button type="button" class="mqcc-fchip${on ? ' on' : ''}" onclick="${js}"${title ? ` title="${mqccEsc(title)}"` : ''}>${label}</button>`;
    const rows = [];
    if (qtChoices > 1) rows.push(`<div class="mqcc-frow"><span class="mqcc-flab">Quote</span>${chip(k === null, 'All', "mqccSetFilter('qt','all')")}${cab ? chip(k === '', 'Cabinets', "mqccSetFilter('qt','cab')") : ''}${qts.map(q => chip(k === q.id, mqccEsc(q.name) + (q.proOnly ? ' ⚡' : ''), `mqccSetFilter('qt','${q.id}')`)).join('')}</div>`);
    const rs = k !== null ? mqccQtRooms(k).filter(r => r.active !== false) : [];
    if (rs.length > 1) rows.push(`<div class="mqcc-frow"><span class="mqcc-flab">Project type</span>${chip(!room, 'All ' + mqccEsc(k === '' ? 'cabinet' : mqccQtName(k)) + ' types', "mqccSetFilter('room','')")}${rs.map(r => chip(room === r.id, mqccEsc(r.name || 'Project type'), `mqccSetFilter('room','${r.id}')`)).join('')}</div>`);
    rows.push(`<div class="mqcc-frow"><span class="mqcc-flab">Shows on</span>${chip(f.pro === 'all', 'Everything', "mqccSetFilter('pro','all')")}${chip(f.pro === 'widget', 'Website widget', "mqccSetFilter('pro','widget')", 'Hide anything that is MidasQuote Pro only')}${chip(f.pro === 'pro', '⚡ MidasQuote Pro', "mqccSetFilter('pro','pro')", 'Everything MidasQuote Pro shows — anything you add here is set to Pro only')}</div>`);
    const tag = mqccFActive() ? mqccFTagText() : '';
    return `<style>
      #mqcc-fbar{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:0 0 14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
      #mqcc-fbar .mqcc-ftitle{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      #mqcc-fbar .mqcc-frow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:6px 0}
      #mqcc-fbar .mqcc-flab{font-size:12px;font-weight:700;color:#374151;min-width:96px}
      #mqcc-fbar .mqcc-fchip{border:1px solid #d1d5db !important;background:#fff !important;color:#374151 !important;border-radius:8px !important;padding:5px 12px !important;font-size:12.5px !important;font-weight:600 !important;cursor:pointer;line-height:1.3 !important;margin:0 !important;height:auto !important;min-height:0 !important}
      #mqcc-fbar .mqcc-fchip:hover{border-color:#9ca3af !important}
      #mqcc-fbar .mqcc-fchip.on{background:#111827 !important;border-color:#111827 !important;color:#fff !important}
      #mqcc-fbar .mqcc-ftag{font-size:12px;color:#1e3a8a;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:6px 10px;margin-top:8px;line-height:1.45}
      #mqcc-fbar .mqcc-fclear{margin-left:auto;font-size:12px;font-weight:600;color:#2563eb;background:none;border:0;cursor:pointer;padding:0;text-transform:none;letter-spacing:0}
      @media(max-width:640px){#mqcc-fbar .mqcc-flab{min-width:0;width:100%}}
    </style>
    <div class="mqcc-ftitle">🔎 Show only…${mqccFActive() ? `<button type="button" class="mqcc-fclear" onclick="window._mqccFilter={qt:'all',room:'',pro:'all'};mqccSetFilter('pro','all')">Show everything</button>` : ''}</div>
    ${rows.join('')}
    ${tag ? `<div class="mqcc-ftag">🎯 Anything you add while this is on is tagged <strong>${mqccEsc(tag)}</strong> — you can change it in the add window.</div>` : ''}`;
  }
  // Runs after every Pricing render: puts the bar at the top and tucks away
  // the built-in cabinet sections when a non-cabinet quote is picked.
  function mqccApplyFilterScope() {
    const host = document.getElementById('mq-pricing-helper-v2');
    const custom = document.getElementById('mqph-scope-custom');
    if (!host || !custom) return;
    let bar = document.getElementById('mqcc-fbar');
    // Page order (Jordan, Nov 2026): title → this filter → training video →
    // Handles & knobs note → "Manage your rates" + everything else. The bar
    // and video live in their own slot under the title so re-drawing the
    // pricing below never moves or reloads them.
    const page = document.getElementById('mq-page-pricing');
    const intro = page && page.querySelector('.mq-pricing-intro');
    if (intro) {
      let top = document.getElementById('mqph-top');
      if (!top) { top = document.createElement('div'); top.id = 'mqph-top'; intro.after(top); }
      if (!bar || bar.parentNode !== top) { if (bar) bar.remove(); bar = document.createElement('div'); bar.id = 'mqcc-fbar'; top.prepend(bar); }
      if (!document.getElementById('mq-training-video-pricing') && typeof window.mqTrainingVideoBlockHTML === 'function') {
        const v = document.createElement('div'); v.id = 'mqph-top-video'; v.innerHTML = window.mqTrainingVideoBlockHTML('pricing'); top.appendChild(v);
      }
      const hw = page.querySelector('.mq-pricing-hardware-note');
      if (hw && hw.previousElementSibling !== top) top.after(hw);
    }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'mqcc-fbar';
      // Right under "Manage your rates" — above the training video if it's there.
      const first = host.querySelector('[id^="mq-training-video-"]') || [...host.querySelectorAll('.mqph-cat-block, [id^="mqph-scope-"]')].find(e => e.offsetParent !== null || e === custom);
      (first || custom).parentNode.insertBefore(bar, first || custom);
    }
    bar.innerHTML = mqccFBarHtml();
    const k = mqccFKey();
    // The pricing wizard row (tip, Re-run pricing wizard, Start fresh) is
    // cabinet-only: shown when Cabinets is picked — or when cabinets are the
    // shop's only quote, so there's nothing to pick (Jordan, Nov 2026).
    const wiz = document.getElementById('mqph-wizard-row');
    if (wiz) { const cab = !mqphComputeTabScope().countertopsOnly; wiz.style.display = cab && (k === '' || (k === null && !mqccFLiveQts().length)) ? 'flex' : 'none'; }
    if (k !== null && k !== '') {
      host.querySelectorAll('.mqph-cat-block, [id^="mqph-scope-"], .mq-pricing-hardware-note').forEach(e => {
        if (e === custom || e === bar || custom.contains(e)) return;
        e.style.display = 'none';
      });
      document.querySelectorAll('.mq-pricing-hardware-note').forEach(e => { e.style.display = 'none'; });
    }
  }
  window.mqccApplyFilterScope = mqccApplyFilterScope;

  function buildCustomCatsHtml() {
    const cats = mqccCats();
    // With quote types: Cabinets steps first, then each quote type's own.
    const qtsAll = mqccQts();
    // Turned-off quote types (Business info → Quote types) are left off
    // Pricing entirely; their steps come back when the quote is switched on.
    // Jordan, Nov 2026: a quote switched off by hand stays here (build it
    // before it goes live); one whose trade was unticked on Business info
    // ("we don't offer this any more") is hidden.
    let bizTrades = null;
    try { const tc = JSON.parse(mqccShopFields()['Hidden widget tabs'] || 'null'); if (tc && tc.business && Array.isArray(tc.business.trades)) bizTrades = tc.business.trades; } catch(e) {}
    const qtsOff = typeof window.mqQtsNotOffered === 'function' ? window.mqQtsNotOffered(mqccShopFields())
      : new Set(qtsAll.filter(q => q.on === false && (q.offByTrade || (q.trade && bizTrades && !bizTrades.includes(q.trade)))).map(q => q.id));
    const groupOf = c => c.qt ? (qtsOff.has(c.qt) ? '__off' : (qtsAll.some(q => q.id === c.qt) ? c.qt : '__gone')) : '';
    const groupKeys = ['', ...qtsAll.filter(q => !qtsOff.has(q.id)).map(q => q.id), '__gone'];
    const offNames = qtsAll.filter(q => qtsOff.has(q.id)).map(q => q.name);
    const groupLabel = k => k === '' ? 'Cabinets (Cabinets only &amp; Cabinets + countertops)' : (k === '__gone' ? 'A deleted quote type — not showing anywhere' : '🗂️ ' + mqccEsc(mqccQtName(k)) + ((qtsAll.find(q => q.id === k) || {}).on === false ? ' <span style="font-weight:700;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:1px 8px;letter-spacing:0;text-transform:none">Off — not on your widget yet</span>' : ''));
    const blockOf = (c, ci, stepNo) => {
      const key = c.id;
      const allItems = mqccItems(c.id);
      const items = allItems.filter(r => mqccFItemOk(r, c));
      const itemsCut = items.length !== allItems.length;
      const fRoom = mqccFRoom();
      const mStep = c.kind === 'meas';
      const mM = mStep ? (mqccMeasOf(c.qt || '').find(x => x.id === c.meas) || null) : null;
      const chips = [
        mStep ? mqccChip('📏 Measurement' + (mM ? ' · ' + mqccEsc(mqccMeasUnit(mM)) : ''), 'blue') : mqccChip(c.answer === 'one' ? 'Pick one' : 'Pick any', 'blue'),
        mStep && parseFloat(c.rate) > 0 ? mqccChip(mqccMoney(c.rate) + ' per ' + mqccEsc(mqccMeasUnit(mM).replace(/s$/, '')), 'gray') : '',
        c.required ? mqccChip(mStep ? 'Must fill in' : c.answer === 'one' ? 'Must choose' : 'Must answer', 'gray') : '',
        c.proOnly ? mqccChip('⚡ Pro only', 'gold') : '',
        fRoom && !(mqccCatRoomsHidden()[c.id] || []).length ? mqccChip('All ' + mqccEsc(c.qt ? mqccQtName(c.qt) : 'cabinet') + ' types', 'gray') : '',
        c.showIf ? mqccChip('Only if ' + mqccEsc(mqccOptionLabel(c.showIf) || 'option removed'), 'gray') : '',
        (() => { const hid = mqccCatRoomsHidden()[c.id] || []; if (!hid.length) return ''; const rs = mqccQtRooms(c.qt || ''); const on = rs.filter(r => !hid.includes(r.id)); return rs.length > 1 && on.length < rs.length ? mqccChip('Only for ' + mqccEsc(on.map(r => r.name).join(', ') || 'no project types'), 'gray') : ''; })(),
        c.qt ? mqccChip('🗂️ ' + mqccEsc(mqccQtName(c.qt) || 'Deleted quote — not showing'), mqccQtName(c.qt) ? 'gold' : 'gray') : '',
        (c.qt ? (/^cc:/.test(c.after || '') || c.after === 'specialty') : (c.after && c.after !== 'specialty')) ? mqccChip('📍 ' + mqccEsc(mqccPlaceLabel(c.after, c.qt)), 'gray') : '',
      ].join(' ');
      const rows = items.map((r, ri) => {
        const cfg = mqccCfg(r);
        const notes = [
          cfg.min > 0 ? `min ${mqccMoney(cfg.min)}` : '',
          cfg.showIf ? 'only if ' + mqccEsc(mqccOptionLabel(cfg.showIf) || 'option removed') : '',
          mqccEsc(mqccTieText(cfg.tie)),
          cfg.install && cfg.install.price > 0 ? `install ${mqccMoney(cfg.install.price)}${cfg.install.how === 'flat' ? ' flat' : cfg.install.how === 'count' ? ' per ' + mqccEsc(String(cfg.install.unit || 'unit').replace(/s$/, '')) : cfg.install.how === 'sqft' ? ' per sq ft' : cfg.install.how === 'lft' ? ' per lin ft' : cfg.install.how === 'meas' ? ' per unit of ' + mqccEsc((mqccMeasFind(cfg.install.meas) || {}).label || 'a measurement') : ' each'}` : '',
          cfg.adj ? 'uses project type %' : '',
        ].filter(Boolean).join(' · ');
        return `<div class="mqph-row">
          <div style="display:flex;flex-direction:column;gap:2px${itemsCut ? ';visibility:hidden' : ''}">
            <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" style="padding:0 6px" title="Move up" ${ri === 0 ? 'disabled' : ''} onclick="mqccMoveItem('${c.id}','${r.id}',-1)">↑</button>
            <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" style="padding:0 6px" title="Move down" ${ri === items.length - 1 ? 'disabled' : ''} onclick="mqccMoveItem('${c.id}','${r.id}',1)">↓</button>
          </div>
          <div style="flex:1;min-width:0">
            <div class="mqph-row-name">${mqccEsc(r.fields['Name'] || '—')} ${cfg.proOnly ? mqccChip('⚡ Pro only', 'gold') : ''} ${(() => { const v = mqccItemRooms(r); const rs = mqccQtRooms(c.qt || ''); if (rs.length < 2) return ''; if (v.length && v.length < rs.length) return mqccChip('🗂️ ' + mqccEsc(mqccRoomNames(c.qt || '', v).join(', ') || 'No project types'), 'blue'); return fRoom ? mqccChip('All ' + mqccEsc(c.qt ? mqccQtName(c.qt) : 'cabinet') + ' types', 'gray') : ''; })()}</div>
            ${r.fields['Description'] ? `<div class="mqph-row-desc">${mqccEsc(r.fields['Description'])}</div>` : ''}
            ${notes ? `<div class="mqph-row-desc" style="color:#6b7280 !important">${notes}</div>` : ''}
          </div>
          <div class="mqph-row-rate" style="min-width:150px !important">${mqccPriceText(r)}</div>
          <div style="width:36px;text-align:center"><div class="mqph-toggle ${r.fields['Active'] !== false ? 'on' : ''}" title="Show on widget" onclick="mqphToggle('${r.id}',this)"></div></div>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqccOpenItem('${c.id}','${r.id}')">Edit</button>
          <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" title="Copy this option and all its settings, variants and photos" onclick="mqccDuplicateItem('${r.id}')">⧉ Duplicate</button>
          <button class="mqph-btn mqph-btn-danger mqph-btn-sm" onclick="mqccDeleteItem('${r.id}')">Delete</button>
        </div>`;
      }).join('');
      return `<div class="mqph-cat-block" data-mq-cat="${key}" style="margin:0 0 12px !important">
        <div class="mqph-cat-header" onclick="mqphToggleCategory('${key}')" style="cursor:pointer;gap:10px">
          <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0">
            <span class="mqph-cat-title"><span id="mqph-cat-arrow-${key}" style="display:inline-block;margin-right:6px;transition:transform 0.2s;font-size:12px">▶</span>${stepNo ? `<span class="mqcc-step-no" title="Customers answer this step ${stepNo === 1 ? 'first' : 'in this order'} — use ↑ ↓ to change it" style="display:inline-block;vertical-align:2px;margin-right:8px;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:#111827;border-radius:6px;padding:3px 7px">Step ${stepNo}</span>` : ''}${mqccEsc(c.name)} <span style="font-size:12px;font-weight:400;color:#9ca3af;text-transform:none;letter-spacing:0">(${items.length})</span></span>
            ${chips}
          </span>
          <span style="display:flex;gap:6px;flex-shrink:0" onclick="event.stopPropagation()">
            <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" title="Move up" ${!cats.slice(0, ci).some(x => (x.qt || '') === (c.qt || '')) ? 'disabled' : ''} onclick="mqccMoveCat('${c.id}',-1)">↑</button>
            <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" title="Move down" ${!cats.slice(ci + 1).some(x => (x.qt || '') === (c.qt || '')) ? 'disabled' : ''} onclick="mqccMoveCat('${c.id}',1)">↓</button>
            <button class="mqph-btn mqph-btn-secondary mqph-btn-sm" title="Rename this step or change its settings" onclick="mqccOpenCat('${c.id}')">✏️ Edit / rename</button>
            ${mStep ? '' : `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" title="Copy this category with all its options and photos" onclick="mqccDuplicateCat('${c.id}')">⧉ Duplicate</button>
            <button class="mqph-btn mqph-btn-primary mqph-btn-sm" onclick="mqccOpenItem('${c.id}',null)">+ Add option</button>`}
          </span>
        </div>
        <div id="mqph-cat-body-${key}" style="display:none">
          ${c.description ? `<div style="padding:10px 16px 0;font-size:12px;color:#6b7280;line-height:1.5">Customers see: “${mqccEsc(c.description)}”</div>` : ''}
          ${c.answer === 'one' && mqccItems(c.id).length > 1 ? `<div style="padding:8px 16px 0;font-size:12px;color:#6b7280;line-height:1.5">↕️ ${c.manualOrder ? `Customers see these <strong>in your order</strong> (set with ↑ ↓). <a href="#" onclick="event.preventDefault();event.stopPropagation();mqccOrderReset('${c.id}')" style="color:#1d4ed8">Go back to cheapest first</a>` : `Customers see these <strong>cheapest first</strong>. Move one with ↑ ↓ to use your own order instead.`}</div>` : ''}
          ${itemsCut ? `<div style="padding:8px 16px 0;font-size:12px;color:#1e40af;line-height:1.5">🔎 Showing ${items.length} of ${allItems.length} options for your filter. ↑↓ ordering is available when the filter is off.</div>` : ''}
          ${mStep ? `<div style="padding:14px 16px;font-size:12.5px;color:#4b5563;line-height:1.5">Customers type ${mM ? (mM.type === 'sqft' ? 'their square feet' : mM.type === 'lft' ? 'their linear feet' : 'how many ' + mqccEsc(mM.unit || 'units')) : 'a number'} here${parseFloat(c.rate) > 0 ? `, priced at <strong>${mqccMoney(c.rate)} per ${mqccEsc(mqccMeasUnit(mM).replace(/s$/, ''))}</strong>` : '. Options in other steps can be priced from it'}. Click <strong>✏️ Edit</strong> to change it.</div>` : items.length ? rows : `<div style="padding:16px;font-size:12px;color:#6b7280;line-height:1.5">${itemsCut ? 'No options in this step match your filter yet. Click <strong>+ Add option</strong> to add one — it’ll be tagged for it.' : 'No options yet. Click <strong>+ Add option</strong> to add the first one.'}</div>`}
          ${items.length ? mqccPreviewShell(c) : ''}
        </div>
      </div>`;
    };
    const catBlocks = qtsAll.length || cats.some(c => c.qt)
      ? groupKeys.map(k => {
          const fk = mqccFKey();
          if (fk !== null && k !== fk) return '';
          if (k && k !== '__gone' && mqccF().pro === 'widget' && mqccQtIsPro(k)) return '';
          const listAll = cats.filter(c => groupOf(c) === k);
          const list = listAll.filter(mqccFStepOk);
          if (mqccFActive() && !list.length && !(fk !== null && k === fk)) return '';
          const head = `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:16px 0 6px"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b7280">${groupLabel(k)}</div>${k !== '__gone' ? `<button class="mqph-btn mqph-btn-primary mqph-btn-sm mqcc-ns-top" data-g="${k}" onclick="window._mqccNewCatQt='${k}';mqccOpenCat(null)">+ New step</button>` : ''}</div>`;
          // Nov 21 (Jordan): a second "+ New step" after the last step, so you
          // don't have to scroll back up to add one.
          const footBtn = k !== '__gone' ? `<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="mqph-btn mqph-btn-primary mqph-btn-sm mqcc-ns-foot" data-g="${k}" onclick="window._mqccNewCatQt='${k}';mqccOpenCat(null)">+ New step</button></div>` : '';
          if (k && k !== '__gone') {
            // Each quote type in its own coloured box (same colour as on My
            // Products), with a Hide / Show toggle (Jordan, Nov 2026).
            const q = qtsAll.find(x => x.id === k) || {};
            const PAL = window.MQ_QT_PAL || [['#2563eb','#eff6ff']];
            const [bd, bg] = PAL[Math.max(0, qtsAll.filter(x => !qtsOff.has(x.id)).findIndex(x => x.id === k)) % PAL.length];
            const shut = (window._mqccQtShut || (window._mqccQtShut = new Set())).has(k);
            const icon = typeof window.mqQtIconSvg === 'function' ? window.mqQtIconSvg(q.icon || 'grid', 16) : '🗂️';
            const offTag = q.packEdit ? ' <span style="font-weight:700;font-size:11px;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:1px 8px">✏️ Starter pack copy you\'re editing</span>' : q.on === false ? ' <span style="font-weight:700;font-size:11px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:1px 8px">Off — not on your widget yet</span>' : '';
            const bhead = `<div onclick="if(!event.target.closest('button'))mqccQtToggle('${k}')" style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;flex-wrap:wrap">
              <span style="width:30px;height:30px;border-radius:8px;background:#fff;border:1px solid ${bd}44;color:${bd};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${icon}</span>
              <span style="font-size:16px;font-weight:800;color:#111827">${mqccEsc(mqccQtName(k))}</span>
              <span style="font-size:12px;color:#6b7280">${list.length !== listAll.length ? `${list.length} of ${listAll.length} steps` : `${list.length} step${list.length === 1 ? '' : 's'}`}</span>${offTag}
              <span style="margin-left:auto;display:inline-flex;gap:10px;align-items:center">${typeof window.mqQtHasPack === 'function' && window.mqQtHasPack(k) ? `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" title="Wipe this quote and set it up fresh from MidasQuote's starter pack" onclick="event.stopPropagation();window.mqQtResetToPack('${k}')">↺ Reset to starter pack</button>` : ''}${window.mqQtPackRestorable && window.mqQtPackRestorable(k) && window.mqQtPackMissing && window.mqQtPackMissing(k) > 0 ? `<button class="mqph-btn mqph-btn-secondary mqph-btn-sm" title="Puts back any option a step is missing from MidasQuote's starter pack — never changes what's already here" onclick="mqRestoreQtFromPack('${k}', this)">↺ Restore from starter pack</button>` : ''}<button class="mqph-btn mqph-btn-primary mqph-btn-sm mqcc-ns-top" data-g="${k}" onclick="window._mqccNewCatQt='${k}';mqccOpenCat(null)">+ New step</button><span class="mqcc-qt-shut-lab" style="font-size:12px;font-weight:600;color:${bd}">${shut ? 'Show ▸' : 'Hide ▾'}</span></span>
            </div>`;
            const body = list.length ? list.map((c, i) => blockOf(c, cats.indexOf(c), i + 1)).join('') : `<div style="font-size:12px;color:#6b7280;margin-top:10px">${listAll.length ? 'No steps match your filter yet — click <strong>+ New step</strong> to add one (it’ll be tagged for it).' : 'No steps yet — this quote won\'t show on your widget until it has at least one.'}</div>`;
            return `<div data-mqcc-group="${k}" style="border:1.5px solid ${bd}55;border-left:5px solid ${bd};background:${bg};border-radius:8px;padding:12px 14px 10px;margin:14px 0">${bhead}<div class="mqcc-qt-body" style="${shut ? 'display:none;' : ''}margin-top:6px">${mqccMeasNote(k)}${body}${list.length ? footBtn : ''}</div></div>`;
          }
          // Cabinets group shows (with its button) even when empty, for shops that do cabinets.
          if (!list.length && !(k === '' && mqccIsCab() && !mqccFActive())) return '';
          return `<div data-mqcc-group="${k}">` + head + (list.length ? list.map(c => blockOf(c, cats.indexOf(c))).join('') + footBtn : `<div style="font-size:12px;color:#6b7280;margin:4px 0 8px">No cabinet steps yet — click <strong>+ New step</strong> to add one (it shows on your Cabinets and Cabinets + countertops tabs).</div>`) + `</div>`;
        }).join('')
      : cats.filter(mqccFStepOk).map(c => blockOf(c, cats.indexOf(c))).join('') + (cats.length ? `<div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="mqph-btn mqph-btn-primary mqph-btn-sm mqcc-ns-foot" data-g="__flat" onclick="mqccOpenCat(null)">+ New step</button></div>` : '');

    const howGroups = [...new Set(Object.values(MQCC_HOW).map(o => o.group))];
    const boffNow = mqphBoff();
    const howOpts = howGroups.map(g => `<optgroup label="${g}">${Object.entries(MQCC_HOW).filter(([, o]) => o.group === g).map(([v, o]) => { const offK = MQ_BOFF_HOW[v] && boffNow.has(MQ_BOFF_HOW[v]); return `<option value="${v}"${offK ? ' disabled' : ''}>${o.label}${offK ? ' — step switched off' : ''}</option>`; }).join('')}</optgroup>`).join('');
    return `
      <style>@media(max-width:760px){#mqph-scope-custom .mqcc-pv-grid{grid-template-columns:1fr !important}}
        #mqcc-cat-tienames label,#mqcc-item-tienames label{display:flex !important;align-items:center !important;gap:8px !important;text-transform:none !important;letter-spacing:0 !important;font-weight:400 !important;font-size:13px !important;color:#111 !important;margin:0 !important;padding:3px 0 !important;cursor:pointer}
        #mqph-scope-custom ~ .mqph-overlay .mqcc-wide, .mqcc-wide{max-width:980px !important}
        .mqcc-modal-grid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:22px;align-items:start}
        .mqcc-kinds{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .mqcc-kind{display:flex;align-items:center;gap:11px;text-align:left;border:1px solid #e5e7eb;border-radius:10px;padding:11px 13px;background:#fff;cursor:pointer;font:inherit;color:#111827}
        .mqcc-kind b{display:block;font-size:14px}.mqcc-kind small{display:block;font-size:12px;color:#6b7280;font-weight:400;margin-top:1px}
        .mqcc-kind.on{border-color:#111827;box-shadow:inset 0 0 0 1px #111827;background:#fafafa}
        .mqcc-kind-ic{width:34px;height:34px;border-radius:8px;background:#f3f4f6;display:grid;place-items:center;font-size:16px;flex:none}
        #mqcc-cat-overlay .mqcc-seg{display:inline-flex !important;flex-wrap:wrap;width:fit-content !important;max-width:100%;border:1px solid #e5e7eb !important;border-radius:8px !important;padding:3px !important;gap:3px;background:#fff !important}
        #mqcc-cat-overlay .mqcc-seg button{display:inline-block !important;width:auto !important;height:auto !important;min-height:0 !important;border:0 !important;background:none !important;border-radius:6px !important;padding:7px 14px !important;margin:0 !important;font:inherit;font-size:13px !important;font-weight:500 !important;line-height:1.2 !important;color:#374151 !important;cursor:pointer;box-shadow:none !important}
        #mqcc-cat-overlay .mqcc-seg button.on{background:#111827 !important;color:#fff !important}
        .mqcc-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .mqcc-money{display:flex;align-items:center;gap:6px}.mqcc-money span{color:#6b7280}.mqcc-money input{flex:1;min-width:0}.mqcc-money em{font-style:normal;font-size:12.5px;color:#6b7280;white-space:nowrap}
        .mqcc-hint{font-size:11.5px;color:#6b7280;line-height:1.45;margin:-6px 0 16px}
        .mqcc-orow{display:grid;grid-template-columns:minmax(0,1fr) 96px minmax(0,170px) 28px;gap:6px;align-items:center;margin-bottom:6px}
        .mqcc-orow input,.mqcc-orow select{width:100%;min-width:0;margin:0}
        .mqcc-orow .mqcc-ox{border:0;background:none;color:#9ca3af;font-size:16px;cursor:pointer;padding:0}
        .mqcc-orow .mqcc-ox:hover{color:#dc2626}
        @media(max-width:760px){.mqcc-kinds,.mqcc-two{grid-template-columns:1fr}.mqcc-orow{grid-template-columns:1fr 80px;}.mqcc-orow select{grid-column:1/2}}
        .mqcc-modal-pv{position:sticky;top:0;max-height:calc(90vh - 120px);overflow-y:auto;background:#f8fafc !important;border:1px solid #e5e7eb !important;border-radius:12px !important;padding:14px !important}
        .mqcc-subbox{background:#f9fafb !important;border:1px solid #e5e7eb !important;border-radius:8px !important;padding:10px 12px !important;margin:0 0 14px !important}
        .mqcc-subbox-title{font-size:11px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.05em}
        .mqcc-subbox-note{font-size:11px;color:#6b7280;line-height:1.45;margin-top:4px}
        .mqcc-check{display:flex !important;align-items:flex-start !important;gap:8px !important;font-size:13px !important;font-weight:600 !important;color:#111 !important;cursor:pointer;text-transform:none !important;letter-spacing:0 !important}
        .mqcc-check input{width:16px !important;height:16px !important;min-width:16px !important;margin:1px 0 0 !important;flex:none !important}
        .mqcc-var-row{background:#fff !important;border:1px solid #e5e7eb !important;border-radius:10px !important;padding:12px 14px !important;margin-top:10px !important}
        .mqcc-var-row input,.mqcc-var-row select{font-size:13px !important;padding:6px 9px !important;height:auto !important;min-height:0 !important}
        .mqcc-var-line{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;font-size:12.5px;color:#374151;row-gap:10px}
        .mqcc-var-line .mqph-btn{margin:0 !important}
        .mqcc-modal-pv-label{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin-bottom:10px}
        @media(max-width:900px){.mqcc-modal-grid{grid-template-columns:1fr}.mqcc-modal-pv{position:static;max-height:none}}
        #mqcc-cat-tienames input,#mqcc-item-tienames input{width:15px !important;height:15px !important;min-width:15px !important;flex:none !important;margin:0 !important;padding:0 !important;box-shadow:none !important}</style>
      <div class="mqph-cat-block" id="mqph-scope-custom" style="padding:16px !important">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:${cats.length ? '14px' : '0'}">
          <div style="min-width:0;max-width:620px">
            <div class="mqph-cat-title">✨ Custom pricing categories</div>
            <div style="font-size:12px;color:#6b7280;margin-top:6px;line-height:1.55">${mqphComputeTabScope().countertopsOnly ? 'Make your own priced steps — prep work, site access, delivery, hourly work. Each category is its own step in one of your quote types' : `Make your own priced steps for anything not covered above — finished ends, site access, delivery, hourly work. Each category is its own step on your widget (Cabinets and Both tabs)${mqccQts().length ? ', or in one of your own quote types' : ''}`}. Photos, groups and which project types each option shows for are set in <strong>My Products</strong>, same as everything else.<div style="margin-top:8px"><a href="#" class="mqcc-guide-link" onclick="event.preventDefault();mqccStepsGuide()">📘 How to use steps</a></div></div>
          </div>
          <span style="display:inline-flex;gap:8px;flex-wrap:wrap"><span id="mqcc-steplib-btn">${mqccStepLibBtn()}</span>${qtsAll.length || cats.some(c => c.qt) ? '' : `<button class="mqph-btn mqph-btn-primary mqph-btn-sm mqcc-ns-top" data-g="__flat" onclick="mqccOpenCat(null)">+ New step</button>`}</span>
        </div>
        ${catBlocks}
        <div id="mqcc-msg" class="mqph-msg" style="margin-top:10px"></div>
      </div>

      <div class="mqph-overlay" id="mqcc-cat-overlay">
        <div class="mqph-modal mqcc-wide">
          <div class="mqph-modal-hdr">
            <div><h3 id="mqcc-cat-title">New category</h3><p>This becomes its own step on your widget. <a href="#" class="mqcc-guide-link" onclick="event.preventDefault();mqccStepsGuide('step')">How do steps work?</a></p></div>
            <button class="mqph-modal-hdr-close" onclick="mqccClose('mqcc-cat-overlay')">×</button>
          </div>
          <div class="mqph-modal-body">${mqccFNoteHtml('mqcc-cat-fnote')}<div id="mqcc-cat-newtip" style="display:none;align-items:flex-start;gap:10px;background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:13px;line-height:1.5;color:#78350f"><span style="font-size:17px;line-height:1.2">💡</span><span><strong>You're making the step itself</strong> — its name, the question customers see, and where it goes. The choices inside it (and their prices) come next: after you save, click <strong>+ Add option</strong> on the step.</span></div><div class="mqcc-modal-grid"><div>
            <div class="mqph-field" id="mqcc-cat-qt-wrap"><label>Quote</label>
              <div id="mqcc-cat-qt-fixed" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px;font-weight:600;color:#111827"><span id="mqcc-cat-qt-name"></span><a href="#" id="mqcc-cat-qt-move" onclick="event.preventDefault();document.getElementById('mqcc-cat-qt-fixed').style.display='none';document.getElementById('mqcc-cat-qt-pick').style.display='block'" style="font-size:12px;font-weight:600;color:#2563eb;text-decoration:none">Move to another quote</a></div>
              <div id="mqcc-cat-qt-pick" style="display:none"><select id="mqcc-cat-qt" onchange="mqccCatQtChanged();var n=document.getElementById('mqcc-cat-qt-name');if(n)n.textContent=this.options[this.selectedIndex].text"></select></div>
            </div>
            <div class="mqph-field" id="mqcc-cat-kind-wrap" style="display:none"><label>What kind of step?</label>
              <input type="hidden" id="mqcc-cat-kind" value="choices"/>
              <div class="mqcc-kinds">
                <button type="button" class="mqcc-kind" data-kind="choices" onclick="mqccCatKind('choices')"><span class="mqcc-kind-ic">☰</span><span><b>Choices</b><small>Customers pick from options</small></span></button>
                <button type="button" class="mqcc-kind" data-kind="meas" onclick="mqccCatKind('meas')"><span class="mqcc-kind-ic">📏</span><span><b>A measurement</b><small>Customers type a number, like square feet</small></span></button>
              </div>
              <div id="mqcc-cat-kindwarn" style="display:none;margin-top:8px;font-size:12.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:7px 10px"></div>
            </div>
            <div class="mqph-field" id="mqcc-cat-rooms-wrap" style="display:none !important"><label>Show this step for these project types</label>
              <style>
                #mqcc-cat-rooms{display:grid !important;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;padding:2px 0}
                #mqcc-cat-rooms label.mqcc-room-opt{display:flex !important;align-items:center !important;gap:9px !important;margin:0 !important;padding:9px 12px !important;border:1px solid #e5e7eb !important;border-radius:10px !important;background:#fff !important;cursor:pointer;text-transform:none !important;letter-spacing:0 !important;font-size:13.5px !important;font-weight:600 !important;color:#111827 !important;line-height:1.3 !important;width:auto !important;transition:border-color .15s,background .15s}
                #mqcc-cat-rooms label.mqcc-room-opt:has(input:checked){border-color:#2563eb !important;background:#eff6ff !important}
                #mqcc-cat-rooms label.mqcc-room-opt input{width:17px !important;height:17px !important;min-width:17px;margin:0 !important;padding:0 !important;flex:0 0 auto;accent-color:#2563eb}
                #mqcc-cat-rooms label.mqcc-room-opt span.mqcc-room-off{color:#9ca3af;font-weight:400}
              </style>
              <div id="mqcc-cat-rooms"></div>
              <div style="font-size:11px;color:#6b7280;margin-top:5px;line-height:1.45">Applies to every option in this step. Individual options can still be hidden for a project type in <strong>My Products</strong>.</div>
            </div>
            <div class="mqph-field"><label>Heading</label><input type="text" id="mqcc-cat-name" maxlength="60" placeholder="Finishing &amp; extras"/></div>
            <div class="mqph-field"><label>Description (optional)</label><input type="text" id="mqcc-cat-desc" maxlength="200" placeholder="A few finishing details that make the install look built-in."/></div>
            <div id="mqcc-cat-measf" style="display:none">
              <div class="mqph-field"><label>Measured in</label>
                <input type="hidden" id="mqcc-cat-mtype" value="sqft"/>
                <div class="mqcc-seg" id="mqcc-cat-mtype-seg"><button type="button" data-v="sqft" onclick="mqccCatMType('sqft')">Square feet</button><button type="button" data-v="lft" onclick="mqccCatMType('lft')">Linear feet</button><button type="button" data-v="count" onclick="mqccCatMType('count')">A count…</button></div>
                <input type="text" id="mqcc-cat-munit" maxlength="24" placeholder="What's counted, e.g. doors" style="display:none;margin-top:8px"/>
              </div>
              <div class="mqph-field"><label>How is it priced?</label>
                <input type="hidden" id="mqcc-cat-mpmode" value="here"/>
                <div class="mqcc-seg" id="mqcc-cat-mpmode-seg"><button type="button" data-v="here" onclick="mqccCatMPMode('here')">Price it here</button><button type="button" data-v="later" onclick="mqccCatMPMode('later')">A later step prices it</button></div>
              </div>
              <div id="mqcc-cat-mprice-here" class="mqph-field"><label>Price</label><div class="mqcc-money" style="max-width:320px"><span>$</span><input type="number" id="mqcc-cat-mrate" min="0" step="0.01" placeholder="0.00"/><em id="mqcc-cat-mper">per sq ft</em></div></div>
              <div id="mqcc-cat-mprice-later" class="mqcc-hint" style="display:none;margin:-4px 0 16px">Customers enter the number here, then options in a later step use it — e.g. ${mqccIsCab() ? '<em>Door style</em> with Shaker at $28 per sq ft' : '<em>Type of flooring</em> with Hardwood at $7.25 per sq ft'}. When you add those options, pick <strong>per sq ft of</strong> this measurement.</div>
              <div class="mqph-field"><label>Name on the quote (optional)</label><input type="text" id="mqcc-cat-mlabel" maxlength="40" placeholder="e.g. Door area" style="max-width:320px"/></div>
            </div>
            <div class="mqph-field" id="mqcc-cat-answer-wrap"><label>Customers can pick</label>
              <select id="mqcc-cat-answer" onchange="mqccCatAnswerChanged()">
                <option value="any">Any — they add whatever they want (like specialty items)</option>
                <option value="one">One — they choose a single option (like door styles)</option>
              </select>
            </div>
            <div class="mqph-field" id="mqcc-cat-opts-wrap" style="display:none"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px"><label style="margin:0">Options</label><span id="mqcc-madd-bar" style="display:none;align-items:center;gap:10px"><a href="#" onclick="event.preventDefault();mqccMaddHelp()" style="font-size:12.5px;font-weight:600;color:#2563eb;text-decoration:none">What's this?</a><button type="button" class="mqph-btn mqph-btn-sm" onclick="mqccMaddOpen()">📏 New measurement</button></span></div>
              <div id="mqcc-madd-help" style="display:none;margin:0 0 12px"></div>
              <div id="mqcc-madd" style="display:none;margin:0 0 12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb">
                <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:8px">New measurement for this quote</div>
                <div style="display:grid;grid-template-columns:1fr 170px;gap:8px">
                  <input type="text" id="mqcc-madd-name" maxlength="40" placeholder="Name, e.g. Crown length"/>
                  <select id="mqcc-madd-type" onchange="document.getElementById('mqcc-madd-unit').style.display=this.value==='count'?'':'none'"><option value="lft">Linear feet</option><option value="sqft">Square feet</option><option value="count">A count</option></select>
                </div>
                <input type="text" id="mqcc-madd-unit" maxlength="20" placeholder="What's counted, e.g. windows" style="display:none;margin-top:8px;width:100%"/>
                <div style="display:flex;gap:8px;align-items:center;margin-top:10px"><button type="button" class="mqph-btn mqph-btn-primary mqph-btn-sm" id="mqcc-madd-save" onclick="mqccMaddSave()">Add measurement</button><button type="button" class="mqph-btn mqph-btn-sm" onclick="mqccMaddClose()">Cancel</button></div>
              </div>
              <div id="mqcc-madd-ok" style="display:none;margin:0 0 10px;font-size:13px;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px"></div>
              <div class="mqcc-hint" id="mqcc-cat-opts-hint" style="margin:2px 0 10px;color:#1e3a8a;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:7px 10px">✱ This is a quick start — after creating the step, you can edit each option further: photos, descriptions, variants, install prices and more.</div>
              <div id="mqcc-cat-opts"></div>
              <a href="#" onclick="event.preventDefault();mqccRowAdd()" style="display:inline-block;font-size:13px;font-weight:600;color:#2563eb;text-decoration:none;margin-top:2px">+ Add option</a>
            </div>
            <label id="mqcc-cat-required-wrap" style="display:flex;align-items:center;gap:8px;font-size:13px;margin:0 0 14px;cursor:pointer">
              <input type="checkbox" id="mqcc-cat-required" style="width:16px;height:16px"/> <span id="mqcc-cat-required-txt">Customers must choose one (no “None” option)</span>
            </label>
            <div class="mqph-field"><label>Where it goes on your widget</label>
              <select id="mqcc-cat-after"></select>
            </div>
            <div class="mqph-field" id="mqcc-cat-showif-wrap"><label>Only show this step if…</label>
              <select id="mqcc-cat-showif"></select>
              <div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.45">Optional — show this step only after a certain earlier choice, e.g. “Ceiling finish” only if “Ceilings” was picked.</div>
            </div>

            <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0 0;cursor:pointer">
              <input type="checkbox" id="mqcc-cat-pro" style="width:16px;height:16px"/> ⚡ MidasQuote Pro only (hidden on your public widget)
            </label>
          </div>
            <div class="mqcc-modal-pv"><div class="mqcc-modal-pv-label">👁 Live preview — what customers will see</div><div id="mqcc-cat-pv"></div></div></div>
          </div>
          <div class="mqph-modal-footer">
            <button class="mqph-btn mqph-btn-danger mqph-btn-sm" id="mqcc-cat-delete" onclick="mqccDeleteCat()" style="display:none">Delete category</button>
            <button class="mqph-btn mqph-btn-secondary" onclick="mqccClose('mqcc-cat-overlay')" style="margin-left:auto">Cancel</button>
            <button class="mqph-btn mqph-btn-primary" id="mqcc-cat-save" onclick="mqccSaveCat()">Save category</button>
          </div>
        </div>
      </div>

      <div class="mqph-overlay" id="mqcc-item-overlay">
        <div class="mqph-modal mqcc-wide">
          <div class="mqph-modal-hdr">
            <div><h3 id="mqcc-item-title">New option</h3><p><span id="mqcc-item-sub"></span> <a href="#" class="mqcc-guide-link" onclick="event.preventDefault();mqccStepsGuide('option')">How do options work?</a></p></div>
            <button class="mqph-modal-hdr-close" onclick="mqccClose('mqcc-item-overlay')">×</button>
          </div>
          <div class="mqph-modal-body"><div class="mqcc-modal-grid"><div>
            ${mqccFNoteHtml('mqcc-item-fnote')}
            <div class="mqph-field" id="mqcc-item-step-wrap" style="display:none"><label>Which step is this option in?</label><select id="mqcc-item-step"></select><div style="font-size:11px;color:#6b7280;margin-top:4px">Change it to move this option (with its photo) into another step of this quote.</div></div>
            <div class="mqph-field"><label>Option name</label><input type="text" id="mqcc-item-name" maxlength="80" placeholder="e.g. Premium upgrade"/></div>
            <div class="mqph-field"><label>Description for customers (optional)</label><input type="text" id="mqcc-item-desc" maxlength="200"/></div>
            <div class="mqph-field"><label>What it's priced on</label><select id="mqcc-item-how" onchange="mqccItemHowChanged()">${howOpts}</select></div>
            <div class="mqph-field" id="mqcc-item-src-wrap"><label>Which option’s number?</label><select id="mqcc-item-src" onchange="mqccItemHowChanged()"></select></div>
            <div class="mqph-field" id="mqcc-item-meas-wrap"><label>Which measurement?</label><select id="mqcc-item-meas" onchange="mqccItemHowChanged()"></select><div style="font-size:11.5px;color:#6b7280;margin-top:4px">The customer enters it once in the quote's Measurements step. Add or change measurements on Project types → this quote → Measurements.</div></div>
            <div class="mqph-field" id="mqcc-item-pctcc-wrap"><label>Which category?</label><select id="mqcc-item-pctcc" onchange="mqccItemHowChanged()"></select></div>
            <div class="mqph-field" id="mqcc-item-unit-wrap"><label>What are you counting?</label><input type="text" id="mqcc-item-unit" maxlength="30" placeholder="panels, hours, trips…" oninput="mqccItemHowChanged()"/></div>
            <div id="mqcc-item-later-note" style="display:none;font-size:12.5px;color:#1e3a8a;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:9px 12px;margin:0 0 14px;line-height:1.5">Customers just pick this one. Its price comes from a step <strong>after</strong> it — e.g. pick <em>Refacing</em> here, then <em>Door style</em> (shown only if Refacing is picked) is priced per sq ft.</div>
            <div class="mqph-field" id="mqcc-item-rate-wrap"><label id="mqcc-item-rate-label">Price</label>
              <div style="display:flex;align-items:center;gap:6px"><span id="mqcc-item-rate-pfx" style="font-size:13px;color:#6b7280"></span><input type="number" id="mqcc-item-rate" step="0.01" style="flex:1" oninput="mqccCheck()"/><span id="mqcc-item-rate-sfx" style="font-size:13px;color:#6b7280"></span></div>
              <div id="mqcc-item-check" style="display:none;font-size:12px;color:#1e3a8a;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:6px 10px;margin-top:6px;line-height:1.45"></div>
            </div>
            <div id="mqcc-calc-wrap" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin:-4px 0 14px">
              <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Work it out from a job you know</div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;color:#374151">
                <span id="mqcc-calc-a-pre">A job with</span>
                <input type="number" id="mqcc-calc-a" step="0.01" style="width:84px" oninput="mqccCalc()"/>
                <span id="mqcc-calc-a-post">units</span>
                <span id="mqcc-calc-b-pre">cost</span> <span>${CUR()}</span>
                <input type="number" id="mqcc-calc-b" step="0.01" style="width:96px" oninput="mqccCalc()"/>
              </div>
              <div id="mqcc-calc-out" style="font-size:12px;color:#166534;margin-top:6px;min-height:16px"></div>
            </div>
            <div class="mqph-field" id="mqcc-item-min-wrap"><label>Minimum charge (optional)</label>
              <div style="display:flex;align-items:center;gap:6px"><span style="font-size:13px;color:#6b7280">${CUR()}</span><input type="number" id="mqcc-item-min" step="0.01" min="0" style="flex:1" oninput="mqccCheck()"/></div>
            </div>
            <div id="mqcc-item-var-wrap" class="mqcc-subbox">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                <div class="mqcc-subbox-title">Variants (optional)</div>
                <span style="display:flex;gap:6px"><button type="button" class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqccVarAdd(false)">+ Add variant</button><button type="button" class="mqph-btn mqph-btn-secondary mqph-btn-sm" onclick="mqccVarAdd(true)">📏 + Add sized variant</button></span>
              </div>
              <div class="mqcc-subbox-note" id="mqcc-var-note">Like specialty items: one option with several versions (e.g. sizes or species), each with its own price, minimum and photo (photos in My Products). Customers pick a variant and how many of each. A sized variant works its price out from its size and a rate.</div>
              <div id="mqcc-var-list"></div>
            </div>
            <div id="mqcc-item-inst-wrap" class="mqcc-subbox">
              <label class="mqcc-check"><input type="checkbox" id="mqcc-item-inst-on" onchange="mqccInstToggle()"/> Offer installation for this option</label>
              <div class="mqcc-subbox-note" id="mqcc-item-inst-note">Customers get a Supply only / Supply + install choice on this option. It starts on whatever they picked in your Supply + install step, and they can change it.</div>
              <div id="mqcc-item-inst-fields" style="display:none;margin-top:8px">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;color:#374151">
                  Install price <span style="color:#6b7280">${CUR()}</span><input type="number" id="mqcc-item-inst-price" step="0.01" min="0" style="width:96px" oninput="mqccCheck()"/>
                  <select id="mqcc-item-inst-how" onchange="mqccInstHowChanged()" style="width:auto;max-width:100%"><option value="flat">flat, once</option></select>
                </div>
                <div id="mqcc-item-inst-countf" style="display:none;margin-top:8px;font-size:13px;color:#374151">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">What's counted <input type="text" id="mqcc-item-inst-unit" maxlength="24" placeholder="e.g. doors" style="width:140px" oninput="mqccInstHowChanged(true)"/></div>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px">Question customers see <input type="text" id="mqcc-item-inst-q" maxlength="80" placeholder="e.g. How many doors need installing?" style="flex:1;min-width:200px"/></div>
                </div>
                <div id="mqcc-item-inst-explain" style="font-size:12px;color:#4b5563;margin-top:6px;line-height:1.45"></div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;color:#374151;margin-top:8px">
                  Install minimum (optional) <span style="color:#6b7280">${CUR()}</span><input type="number" id="mqcc-item-inst-min" step="0.01" min="0" style="width:96px" oninput="mqccCheck()"/>
                </div>
              </div>
            </div>
            <div id="mqcc-item-adj-wrap" style="margin:0 0 14px;display:flex;flex-direction:column;gap:3px">
              <label class="mqcc-check" style="margin:0"><input type="checkbox" id="mqcc-item-adj"/> Let project types raise or lower this price</label>
              <div id="mqcc-item-adj-hint" style="font-size:11.5px;color:#6b7280;line-height:1.5;padding-left:24px"></div>
            </div>
            <div class="mqph-field" id="mqcc-item-showif-wrap"><label>Show this option</label><select id="mqcc-item-showif"></select></div>
            ${mqccTieFieldHtml('item')}
            <div class="mqph-field" id="mqcc-item-rooms-wrap" style="display:none"><label>Show this option for these project types</label>
              <style>#mqcc-item-rooms{display:grid !important;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;padding:2px 0}
                #mqcc-item-rooms label.mqcc-room-opt{display:flex !important;align-items:center !important;gap:9px !important;margin:0 !important;padding:9px 12px !important;border:1px solid #e5e7eb !important;border-radius:9px !important;background:#fff !important;font-size:13px !important;font-weight:600 !important;color:#111 !important;text-transform:none !important;letter-spacing:0 !important;cursor:pointer}
                #mqcc-item-rooms label.mqcc-room-opt:has(input:checked){border-color:#2563eb !important;background:#eff6ff !important}
                #mqcc-item-rooms label.mqcc-room-opt input{width:17px !important;height:17px !important;min-width:17px;margin:0 !important;padding:0 !important;flex:0 0 auto;accent-color:#2563eb}</style>
              <div id="mqcc-item-rooms"></div>
              <div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.45">Untick a project type to hide this option for it. (Also editable on My Products.)</div>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0 0;cursor:pointer">
              <input type="checkbox" id="mqcc-item-pro" style="width:16px;height:16px"/> ⚡ MidasQuote Pro only (hidden on your public widget)
            </label>
          </div>
            <div class="mqcc-modal-pv"><div class="mqcc-modal-pv-label">👁 Live preview — what customers will see</div><div id="mqcc-item-pv"></div></div></div>
          </div>
          <div class="mqph-modal-footer">
            <button class="mqph-btn mqph-btn-secondary" onclick="mqccClose('mqcc-item-overlay')" style="margin-left:auto">Cancel</button>
            <button class="mqph-btn mqph-btn-secondary" id="mqcc-item-saveadd" onmousedown="event.preventDefault()" onclick="mqccItemGo(null)" style="border-color:#93c5fd;color:#1e40af;background:#eff6ff">+ Save &amp; add another</button>
            <button class="mqph-btn mqph-btn-primary" id="mqcc-item-save" onmousedown="event.preventDefault()" onclick="mqccSaveItem()">Save option</button>
          </div>
        </div>
      </div>`;
  }

  function mqccMsg(text, isError) {
    const el = document.getElementById('mqcc-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'mqph-msg ' + (isError ? 'mqph-msg-error' : 'mqph-msg-success');
    el.style.setProperty('display', 'block', 'important');
    clearTimeout(el._t); el._t = setTimeout(() => { el.style.setProperty('display', 'none', 'important'); }, 4000);
  }
  // .mqph-field sets display with !important, so plain style.display can't hide it.
  function mqccShow(id, on, shownAs) {
    const el = document.getElementById(id);
    if (!el) return;
    if (on) { if (shownAs) el.style.setProperty('display', shownAs, 'important'); else el.style.removeProperty('display'); }
    else el.style.setProperty('display', 'none', 'important');
  }
  window.mqccClose = function(id) { document.getElementById(id)?.classList.remove('show'); };
  window.mqccRerenderAll = () => { try { mqccRerender(null); } catch (e) {} };
  function mqccRerender(openKey) {
    if (openKey) _mqphExpandedCats.add(openKey);
    mqphRerenderPricingPage();
    mqphApplyEstimatorTabScope();
  }
  function mqccShowIfOptions(selectEl, list, current, alwaysLabel, pickedWord) {
    selectEl.innerHTML = `<option value="">${alwaysLabel}</option>` + list.map(o => pickedWord ? `<option value="${o.id}">The customer picked “${mqccEsc(o.label)}”</option>` : `<option value="${o.id}">Only if “${mqccEsc(o.label)}” is picked</option>`).join('');
    selectEl.value = list.some(o => o.id === current) ? current : '';
  }

  // ── Category settings ──
  window.mqccOpenCat = function(cid) {
    mqccEditCat = cid;
    const c = cid ? mqccCats().find(x => x.id === cid) : null;
    mqccCatKindInit(c);
    document.getElementById('mqcc-cat-title').textContent = c ? `Edit step: ${c.name}` : 'New step';
    const saveBtnTxt = document.getElementById('mqcc-cat-save');
    if (saveBtnTxt) saveBtnTxt.textContent = c ? 'Save changes' : 'Create step';
    document.getElementById('mqcc-cat-newtip').style.display = 'none';
    const cabWords = !mqphComputeTabScope().countertopsOnly;
    document.getElementById('mqcc-cat-name').placeholder = cabWords ? 'Finishing & extras' : 'e.g. Paint finish';
    document.getElementById('mqcc-cat-desc').placeholder = cabWords ? 'A few finishing details that make the install look built-in.' : 'e.g. Pick the sheen you’d like for your walls.';
    document.getElementById('mqcc-cat-name').value = c ? c.name : '';
    document.getElementById('mqcc-cat-desc').value = c ? (c.description || '') : '';
    document.getElementById('mqcc-cat-answer').value = c && c.answer === 'one' ? 'one' : 'any';
    document.getElementById('mqcc-cat-required').checked = !!(c && c.required);
    document.getElementById('mqcc-cat-pro').checked = c ? !!c.proOnly : mqccF().pro === 'pro';
    mqccFNoteFill('mqcc-cat-fnote', !c);
    // Which quote: Cabinets / Both, or one of the shop's own quote types.
    const qts = mqccQts();
    const qtSel = document.getElementById('mqcc-cat-qt');
    // A business that doesn't do cabinetry (Business info) gets no Cabinets
    // choice -- unless it's editing an old cabinet-side step (Nov 2026).
    const noCab = mqphComputeTabScope().countertopsOnly && qts.length > 0;
    const fk = mqccFKey();
    const curQt = c ? (c.qt || '') : (window._mqccNewCatQt || (fk ? fk : '') || (noCab ? qts[0].id : ''));
    window._mqccNewCatQt = '';
    // Only quotes the shop actually offers (+ the one this step is in);
    // shown as a plain name with a "Move to another quote" link (Nov 18).
    const qOff = typeof window.mqQtsNotOffered === 'function' ? window.mqQtsNotOffered(mqccShopFields()) : new Set();
    const qtsPick = qts.filter(q => q.id === curQt || !qOff.has(q.id));
    qtSel.innerHTML = (noCab && curQt ? '' : `<option value="">Cabinets (Cabinets only and Cabinets + countertops)</option>`)
      + qtsPick.map(q => `<option value="${q.id}">${mqccEsc(q.name)}${q.on === false ? ' (turned off)' : ''}${q.proOnly ? ' — Pro only' : ''}</option>`).join('')
      + (curQt && !qts.some(q => q.id === curQt) ? `<option value="${mqccEsc(curQt)}">A deleted quote type (not showing anywhere)</option>` : '');
    qtSel.value = curQt;
    mqccShow('mqcc-cat-qt-wrap', qts.length > 0 || !!curQt);
    const qn = document.getElementById('mqcc-cat-qt-name'), qf = document.getElementById('mqcc-cat-qt-fixed'), qp = document.getElementById('mqcc-cat-qt-pick'), qm = document.getElementById('mqcc-cat-qt-move');
    if (qn) qn.textContent = qtSel.selectedIndex >= 0 ? qtSel.options[qtSel.selectedIndex].text : '';
    if (qf) qf.style.display = 'flex';
    if (qp) qp.style.display = 'none';
    if (qm) qm.style.display = qtSel.options.length > 1 ? '' : 'none';
    mqccCatQtFill(c);
    mqccCatRoomsFill();
    mqccCatKindSync();
    document.getElementById('mqcc-cat-delete').style.display = c ? '' : 'none';
    mqccCatAnswerChanged();
    const catOv = document.getElementById('mqcc-cat-overlay');
    catOv.oninput = catOv.onchange = () => mqccDraftCatPreview();
    mqccDraftCatPreview();
    catOv.classList.add('show');
    setTimeout(() => document.getElementById('mqcc-cat-name')?.focus(), 50);
  };
  // Fills "Show this step" and "Where it goes" for whichever quote is picked.
  function mqccCatQtFill(c) {
    const cid = mqccEditCat;
    const qt = document.getElementById('mqcc-cat-qt').value || '';
    const sameQuote = mqccAllOptions(cid, null).filter(o => { const r = lineItems.find(x => x.id === o.id); const oc = r && mqccCats().find(x => x.id === r.fields['Category']); return oc && (oc.qt || '') === qt; });
    const curRule = c ? c.showIf : document.getElementById('mqcc-cat-showif').value;
    mqccShowIfOptions(document.getElementById('mqcc-cat-showif'), sameQuote, curRule, 'No condition — always show it', true);
    // Nothing earlier in this quote to depend on → no point showing the field.
    const ruleWrap = document.getElementById('mqcc-cat-showif-wrap');
    if (ruleWrap) ruleWrap.style.setProperty('display', (sameQuote.length || curRule) ? '' : 'none', 'important');
    const afterSel = document.getElementById('mqcc-cat-after');
    const places = mqccPlaceList(cid, qt);
    afterSel.innerHTML = places.map(([v, l]) => `<option value="${v}">${mqccEsc(l)}</option>`).join('');
    const keep = c && (c.qt || '') === qt ? (qt ? mqccAfterKey(c) : c.after) : null;
    if (keep && places.some(x => x[0] === keep)) afterSel.value = keep;
    else {
      // New step (or moved to another quote): default to the end of the
      // steps after Details & Selections — or a quote type's last step — so
      // adding several in a row keeps them in the order they were made.
      const start = qt ? 'si' : 'specialty';
      const k = places.findIndex(x => x[0] === start);
      let v = start;
      for (let n = k + 1; n < places.length && /^cc:/.test(places[n][0]); n++) v = places[n][0];
      afterSel.value = v;
    }
  }
  // ── "Show this step for these project types" (Nov 2026) ──
  // Same setting My Products' per-step 🗂️ project-type control edits: the
  // shop's "Category rooms" ({stepId: [hidden project type ids]}), which the
  // widget already uses to hide every option in the step for those project
  // types. Only shown when the step's quote has more than one project type.
  function mqccCatRoomsHidden() {
    try { const o = JSON.parse(mqccShopFields()['Category rooms'] || '{}'); return (o && typeof o === 'object') ? o : {}; } catch(e) { return {}; }
  }
  function mqccQtRooms(qt) {
    let rooms = [];
    try { rooms = JSON.parse(mqccShopFields()['Room types'] || '[]'); } catch(e) { rooms = []; }
    return (Array.isArray(rooms) ? rooms : []).filter(r => r && r.id && (qt ? r.forQt === qt : (!r.forQt && !r.forCountertops)));
  }
  function mqccCatRoomsFill() {
    const wrap = document.getElementById('mqcc-cat-rooms-wrap'), box = document.getElementById('mqcc-cat-rooms');
    if (!wrap || !box) return;
    const qt = document.getElementById('mqcc-cat-qt') ? (document.getElementById('mqcc-cat-qt').value || '') : '';
    const rooms = mqccQtRooms(qt);
    if (rooms.length < 2) { wrap.style.setProperty('display', 'none', 'important'); box.innerHTML = ''; return; }
    const sameQuote = mqccEditCat && (((mqccCats().find(x => x.id === mqccEditCat) || {}).qt || '') === qt);
    const fRoom = !mqccEditCat && mqccFKey() === qt ? mqccFRoom() : '';
    const hidden = new Set(sameQuote ? (mqccCatRoomsHidden()[mqccEditCat] || []) : (fRoom ? rooms.filter(r => r.id !== fRoom).map(r => r.id) : []));
    box.innerHTML = rooms.map(r => `<label class="mqcc-room-opt"><input type="checkbox" class="mqcc-cat-room" value="${mqccEsc(r.id)}" ${hidden.has(r.id) ? '' : 'checked'}/><span>${mqccEsc(r.name || 'Project type')}${r.active === false ? ' <span class="mqcc-room-off">(off)</span>' : ''}</span></label>`).join('');
    wrap.style.removeProperty('display');
  }
  // Option-level project types (the option's own "Visible rooms": [] = all).
  // Only the project types the step itself shows for are offered.
  function mqccItemRoomsFill(c, r) {
    const wrap = document.getElementById('mqcc-item-rooms-wrap'), box = document.getElementById('mqcc-item-rooms');
    if (!wrap || !box) return;
    const qt = c.qt || '';
    const stepHid = mqccCatRoomsHidden()[c.id] || [];
    const rooms = mqccQtRooms(qt).filter(x => !stepHid.includes(x.id));
    box.dataset.cid = c.id;
    if (rooms.length < 2) { wrap.style.display = 'none'; box.innerHTML = ''; return; }
    let on;
    if (r) { const v = mqccItemRooms(r); on = new Set(v.length ? v : rooms.map(x => x.id)); }
    else { const fr = mqccFKey() === qt ? mqccFRoom() : ''; on = new Set(fr && rooms.some(x => x.id === fr) ? [fr] : rooms.map(x => x.id)); }
    box.innerHTML = rooms.map(x => `<label class="mqcc-room-opt"><input type="checkbox" class="mqcc-item-room" value="${mqccEsc(x.id)}" ${on.has(x.id) ? 'checked' : ''}/><span>${mqccEsc(x.name || 'Project type')}</span></label>`).join('');
    wrap.style.display = '';
  }
  // → the JSON to save in "Visible rooms", or null to leave it alone, or false if none ticked.
  function mqccItemRoomsRead(c, r) {
    const boxes = [...document.querySelectorAll('#mqcc-item-rooms .mqcc-item-room')];
    if (!boxes.length) return null;
    const checked = boxes.filter(b => b.checked).map(b => b.value);
    if (!checked.length) return false;
    const all = mqccQtRooms(c.qt || '').map(x => x.id);
    const stepHid = mqccCatRoomsHidden()[c.id] || [];
    const old = r ? mqccItemRooms(r) : [];
    const oldEff = old.length ? old : all;
    const keepHidden = oldEff.filter(id => stepHid.includes(id)); // project types not offered in this window keep their old setting
    let next = all.filter(id => checked.includes(id) || keepHidden.includes(id));
    if (next.length === all.length) next = [];
    const json = JSON.stringify(next);
    return json === JSON.stringify(old) && r ? null : json;
  }
  function mqccCatRoomsRead() {
    const boxes = [...document.querySelectorAll('#mqcc-cat-rooms .mqcc-cat-room')];
    if (!boxes.length) return null;
    return { hidden: boxes.filter(b => !b.checked).map(b => b.value), all: boxes.map(b => b.value), names: boxes.filter(b => b.checked).map(b => b.parentNode.textContent.trim()) };
  }
  async function mqccSaveCatRooms(cid, pick) {
    const cr = mqccCatRoomsHidden();
    const before = JSON.stringify(cr[cid] || []);
    if (pick && pick.hidden.length) cr[cid] = pick.hidden; else delete cr[cid];
    if (JSON.stringify(cr[cid] || []) === before) return;
    const json = JSON.stringify(cr);
    await atUpdate(SHOPS_TABLE, shopRecord.id, { 'Category rooms': json });
    shopRecord.fields['Category rooms'] = json;
    if (window._mqShopRecord && window._mqShopRecord.fields) window._mqShopRecord.fields['Category rooms'] = json;
    window._mqCategoryRooms = cr;
    if (window._mqLastFetchTimes) window._mqLastFetchTimes['products'] = 0;
    // Same as My Products' step 🗂️ control: each option's own project-type
    // list follows the change, so an option hidden for a project type earlier
    // comes back when the step is turned on for it again (and vice versa).
    // Options start out ticked for exactly what the step shows; they can
    // still be changed one by one in My Products afterwards.
    const was = new Set(JSON.parse(before)), now = new Set(cr[cid] || []);
    const all = pick ? pick.all : [];
    const shown = all.filter(id => was.has(id) && !now.has(id)), hid = all.filter(id => !was.has(id) && now.has(id));
    if (!all.length || (!shown.length && !hid.length)) return;
    for (const r of mqccItems(cid)) {
      let cur = [];
      try { cur = JSON.parse(r.fields['Visible rooms'] || '[]'); } catch(e) { cur = []; }
      if (!Array.isArray(cur)) cur = [];
      const eff = new Set(cur.length ? cur : all);
      shown.forEach(id => eff.add(id)); hid.forEach(id => eff.delete(id));
      let list = all.filter(id => eff.has(id));
      if (!list.length) continue; // shown nowhere: keep its own list (empty would mean "everywhere")
      if (list.length === all.length) list = [];
      const next = JSON.stringify(list);
      if (next === JSON.stringify(cur)) continue;
      try { await atUpdate(LINE_ITEMS_TABLE, r.id, { 'Visible rooms': next }); r.fields['Visible rooms'] = next; }
      catch(e) { console.warn('option project types', r.id, e); }
    }
  }
  window.mqccCatQtChanged = function() {
    const c = mqccEditCat ? mqccCats().find(x => x.id === mqccEditCat) : null;
    mqccCatQtFill(c);
    mqccCatRoomsFill();
    (window._mqccRows || []).forEach(r => { if (/^meas:/.test(r.how)) r.how = 'flat'; });
    mqccCatKindSync();
    mqccDraftCatPreview();
  };
  // ── Nov 18 (Jordan): step kinds -- Choices (options, now addable right
  // in the step box) or A measurement (the customer types a number). ──
  function mqccMeasUnitWord(type, unit) { return type === 'lft' ? 'lin ft' : (type === 'count' ? (String(unit || '').trim() || 'unit') : 'sq ft'); }
  function mqccCatKindInit(c) {
    const kind = c && c.kind === 'meas' ? 'meas' : 'choices';
    document.getElementById('mqcc-cat-kind').value = kind;
    const qt = c && c.qt ? c.qt : '';
    const m = c && c.kind === 'meas' ? (mqccMeasOf(qt).find(x => x.id === c.meas) || mqccMeasFind(c.meas)) : null;
    document.getElementById('mqcc-cat-mtype').value = m && (m.type === 'lft' || m.type === 'sqft') ? m.type : (m ? 'count' : 'sqft');
    document.getElementById('mqcc-cat-munit').value = m && m.type !== 'sqft' && m.type !== 'lft' ? (m.unit || '') : '';
    document.getElementById('mqcc-cat-mlabel').value = m && c && m.label !== c.name ? m.label : '';
    document.getElementById('mqcc-cat-mrate').value = c && c.kind === 'meas' && parseFloat(c.rate) > 0 ? c.rate : '';
    document.getElementById('mqcc-cat-mpmode').value = c && c.kind === 'meas' && !(parseFloat(c.rate) > 0) ? 'later' : 'here';
    window._mqccRowsGone = [];
    window._mqccKindWas = kind;
    window._mqccRows = c ? (c.kind === 'meas' ? [] : mqccItems(c.id).map(mqccRowFromItem)) : [{ name: '', rate: '', how: 'flat' }];
  }
  // An existing option as a step-box row. Pricing the simple rows can't show
  // (%, another option's number, cabinet lin ft…) is read-only here.
  const MQCC_ROW_SIMPLE = ['flat', 'each', 'sqft', 'lft', 'meas'];
  function mqccRowFromItem(r) {
    const cfg = mqccCfg(r);
    const how0 = MQCC_HOW[cfg.how] ? cfg.how : 'flat';
    const how = cfg.later ? 'later' : (how0 === 'meas' ? 'meas:' + (cfg.meas || '') : how0);
    const rate = Number(r.fields['Rate']) || 0;
    return { id: r.id, name: r.fields['Name'] || '', rate: cfg.later ? '' : String(rate), how, unit: cfg.unit || '',
      locked: !MQCC_ROW_SIMPLE.includes(how0), lockedText: mqccPriceText(r), off: r.fields['Active'] === false,
      extras: mqccRowExtras(r, cfg), nVar: Array.isArray(cfg.variants) ? cfg.variants.length : 0,
      orig: { name: r.fields['Name'] || '', rate: cfg.later ? '' : String(rate), how } };
  }
  function mqccRowExtras(r, cfg) {
    const hasPhoto = (cfg.ph && typeof cfg.ph === 'object' && cfg.ph[''] ) || mqccPvPhoto(r.fields['Category'], r.fields['Name'] || '');
    return [
      hasPhoto ? '📷 photo' : '',
      Array.isArray(cfg.variants) && cfg.variants.length ? `${cfg.variants.length} variant${cfg.variants.length === 1 ? '' : 's'}` : '',
      cfg.install && cfg.install.price > 0 ? 'install' : '',
      cfg.min > 0 ? 'min ' + mqccMoney(cfg.min) : '',
      r.fields['Description'] ? 'description' : '',
      cfg.showIf ? 'only if…' : '',
      cfg.tie ? 'linked' : '',
      cfg.proOnly ? 'Pro only' : '',
      r.fields['Active'] === false ? 'turned off' : '',
    ].filter(Boolean);
  }
  // Show / hide the parts that belong to the picked kind.
  function mqccCatKindSync() {
    const qt = (document.getElementById('mqcc-cat-qt') || {}).value || '';
    const editing = !!mqccEditCat;
    let kind = document.getElementById('mqcc-cat-kind').value;
    if (!qt && kind === 'meas' && !editing) kind = document.getElementById('mqcc-cat-kind').value = 'choices';
    const meas = kind === 'meas';
    const show = (id, on) => { const e = document.getElementById(id); if (e) e.style.setProperty('display', on ? '' : 'none', 'important'); };
    show('mqcc-cat-kind-wrap', !!qt);
    document.querySelectorAll('.mqcc-kind').forEach(b => b.classList.toggle('on', b.dataset.kind === kind));
    show('mqcc-cat-measf', meas);
    show('mqcc-cat-answer-wrap', !meas);
    show('mqcc-cat-opts-wrap', !meas);
    mqccCatMType(document.getElementById('mqcc-cat-mtype').value, true);
    mqccCatMPMode(document.getElementById('mqcc-cat-mpmode').value, true);
    const nm = document.getElementById('mqcc-cat-name'), ds = document.getElementById('mqcc-cat-desc');
    const cabWords = !mqphComputeTabScope().countertopsOnly && !qt;
    nm.placeholder = meas ? 'e.g. How many square feet of doors?' : (cabWords ? 'Finishing & extras' : 'e.g. Door finish');
    ds.placeholder = meas ? 'e.g. Measure the front of each door, then add them up.' : (cabWords ? 'A few finishing details that make the install look built-in.' : 'e.g. Pick the look you want.');
    const rt = document.getElementById('mqcc-cat-required-txt');
    if (rt) rt.textContent = meas ? 'Customers must fill this in' : (document.getElementById('mqcc-cat-answer').value === 'one' ? 'Customers must choose one (no “None” option)' : 'Customers must add at least one before continuing');
    const saveBtn = document.getElementById('mqcc-cat-save');
    if (saveBtn) saveBtn.textContent = editing ? 'Save changes' : 'Create step';
    if (!meas) mqccRowsRender();
    { const oh = document.getElementById('mqcc-cat-opts-hint'); if (oh) oh.textContent = editing ? 'Renaming or re-pricing keeps each option\'s photos and extras. Use “Photos & more →” for photos, variants, install and the rest.' : '✱ This is a quick start — after creating the step, you can edit each option further: photos, descriptions, variants, install prices and more.'; }
    const kw = document.getElementById('mqcc-cat-kindwarn');
    if (kw) {
      const was = window._mqccKindWas, n = editing && was === 'choices' ? mqccItems(mqccEditCat).length : 0;
      kw.textContent = editing && was !== kind ? (kind === 'meas' ? (n ? `Saving deletes this step's ${n} option${n === 1 ? '' : 's'}.` : '') : 'This step will ask customers to pick options instead of typing a number.') : '';
      kw.style.display = kw.textContent ? 'block' : 'none';
    }
  }
  window.mqccCatKind = function(k) { document.getElementById('mqcc-cat-kind').value = k; mqccCatKindSync(); mqccDraftCatPreview(); };
  window.mqccCatMPMode = function(m, quiet) {
    document.getElementById('mqcc-cat-mpmode').value = m;
    document.querySelectorAll('#mqcc-cat-mpmode-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === m));
    document.getElementById('mqcc-cat-mprice-here').style.setProperty('display', m === 'here' ? 'block' : 'none', 'important');
    document.getElementById('mqcc-cat-mprice-later').style.setProperty('display', m === 'later' ? 'block' : 'none', 'important');
    if (!quiet) mqccDraftCatPreview();
  };
  window.mqccCatMType = function(t, quiet) {
    document.getElementById('mqcc-cat-mtype').value = t;
    document.querySelectorAll('#mqcc-cat-mtype-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === t));
    document.getElementById('mqcc-cat-munit').style.display = t === 'count' ? '' : 'none';
    const per = document.getElementById('mqcc-cat-mper');
    if (per) per.textContent = 'per ' + mqccMeasUnitWord(t, document.getElementById('mqcc-cat-munit').value).replace(/s$/, '');
    if (!quiet) mqccDraftCatPreview();
  };
  // Inline option rows (new Choices steps).
  function mqccRowHows() {
    const qt = (document.getElementById('mqcc-cat-qt') || {}).value || '';
    const out = [['flat', 'flat price'], ['later', 'no price — a later step prices it'], ['each', 'per item'], ['sqft', 'per sq ft (they enter it)'], ['lft', 'per lin ft (they enter it)']];
    if (qt) mqccMeasOf(qt).forEach(m => out.push(['meas:' + m.id, `per ${mqccMeasUnit(m).replace(/s$/, '')} of ${m.label}`]));
    return out;
  }

  // ── Nov 20 (Jordan): add a quote measurement right from the step box ──
  // Same list as Project types → Measurements (saved on the quote type), so
  // it shows there too; the option rows' price menus pick it up instantly.
  function mqccMaddSync() {
    const qt = (document.getElementById('mqcc-cat-qt') || {}).value || '';
    const bar = document.getElementById('mqcc-madd-bar'); if (bar) bar.style.display = qt ? 'inline-flex' : 'none';
    if (!qt) { ['mqcc-madd', 'mqcc-madd-help', 'mqcc-madd-ok'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; }); }
  }
  const MQCC_MADD_IMG = {"own": "data:image/webp;base64,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", "sstep": "data:image/webp;base64,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", "smeas": "data:image/webp;base64,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"};
  // Nov 20 (Jordan): "What's this?" shows the two ways side by side, with
  // real widget screens and the typing box circled. Written dead simple.
  function mqccMaddHelpHtml() {
    const fig = (k, cap) => `<figure style="margin:8px 0 0"><img src="${MQCC_MADD_IMG[k]}" alt="" style="display:block;width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px"/>${cap ? `<figcaption style="font-size:12px;color:#6b7280;margin-top:4px;text-align:center">${cap}</figcaption>` : ''}</figure>`;
    const card = (n, title, sub, body, pick) => `<div style="border:1px solid ${pick ? '#bfdbfe' : '#e5e7eb'};background:${pick ? '#f8fbff' : '#fff'};border-radius:10px;padding:12px 14px;margin-top:10px">
        <div style="display:flex;align-items:center;gap:8px"><span style="flex:none;width:24px;height:24px;border-radius:50%;background:#111827;color:#fff;font-weight:800;font-size:12.5px;display:flex;align-items:center;justify-content:center">${n}</span><span style="font-size:14.5px;font-weight:800;color:#111827">${title}</span></div>
        <div style="font-size:12.5px;color:#6b7280;margin:3px 0 0 32px">${sub}</div>
        <div style="font-size:13.5px;color:#374151;line-height:1.55;margin-top:8px">${body}</div></div>`;
    return `<div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;padding:12px 14px">
      <div style="font-size:15px;font-weight:800;color:#1e3a8a">Two ways to ask the customer for a number</div>
      <div style="font-size:13.5px;color:#1e3a8a;margin-top:2px;line-height:1.5">Like “how many feet of crown moulding?” Pick the way that fits.</div>
      ${card(1, 'The number is typed right in this step', 'In the price menu: <strong>per lin ft (they enter it)</strong>',
        `The customer picks an option, and a box appears <strong>right under it</strong> to type the feet. One step, done.${fig('own', 'The customer types the feet here, in the same step.')}
         <div style="margin-top:8px"><strong>Use this when</strong> only one option needs a number.</div>`)}
      ${card(2, 'The number gets its own page', 'Made with the <strong>📏 New measurement</strong> button',
        `The customer picks an option — <strong>no box here</strong>. Then the quote takes them to a <strong>new page</strong>, “Let’s get your measurements”, to type the feet <strong>once</strong>. Every option that uses it is priced from that one number.
         ${fig('sstep', 'First, they pick an option. No box to type in yet.')}<div style="text-align:center;font-size:22px;line-height:1;color:#6b7280;font-weight:700;margin:6px 0 0">↓ then the next page ↓</div>${fig('smeas', 'Here they type the feet, once.')}
         <div style="margin-top:8px"><strong>Use this when</strong> several options are priced on the same length — like crown moulding — or you want all the measuring together on one page.</div>`, true)}
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin-top:10px">
        <div style="font-size:14px;font-weight:800;color:#111827;margin-bottom:4px">How to set up way 2</div>
        <ol style="margin:0;padding-left:20px;font-size:13.5px;color:#374151;line-height:1.7">
          <li>Click <strong>📏 New measurement</strong> (top right of Options).</li>
          <li>Give it a name, like <strong>Crown length</strong>. Pick <strong>Linear feet</strong>. Click <strong>Add measurement</strong>.</li>
          <li>In each option’s price menu, pick <strong>per lin ft of Crown length</strong>.</li>
          <li>Click <strong>Save</strong>. That’s it!</li>
        </ol>
        <div style="font-size:12.5px;color:#6b7280;margin-top:8px">Good to know: measurements you add here are the same ones in <strong>Project types → Measurements</strong>. Rename or remove them there any time.</div>
      </div>
      <div style="text-align:right;margin-top:8px"><a href="#" onclick="event.preventDefault();mqccMaddHelp()" style="font-size:12.5px;font-weight:600;color:#2563eb;text-decoration:none">Got it — hide this</a></div>
    </div>`;
  }
  window.mqccMaddHelp = function() {
    const h = document.getElementById('mqcc-madd-help'); if (!h) return;
    if (!h.dataset.built) { h.innerHTML = mqccMaddHelpHtml(); h.dataset.built = '1'; }
    h.style.display = h.style.display === 'none' ? 'block' : 'none';
  };
  window.mqccMaddOpen = function() {
    const b = document.getElementById('mqcc-madd'); if (!b) return;
    b.style.display = 'block'; const ok = document.getElementById('mqcc-madd-ok'); if (ok) ok.style.display = 'none';
    const n = document.getElementById('mqcc-madd-name'); n.value = ''; document.getElementById('mqcc-madd-unit').value = '';
    setTimeout(() => n.focus(), 30);
  };
  window.mqccMaddClose = function() { const b = document.getElementById('mqcc-madd'); if (b) b.style.display = 'none'; };
  window.mqccMaddSave = async function() {
    const qt = (document.getElementById('mqcc-cat-qt') || {}).value || ''; if (!qt) return;
    const label = document.getElementById('mqcc-madd-name').value.trim();
    const type = document.getElementById('mqcc-madd-type').value;
    const unit = document.getElementById('mqcc-madd-unit').value.trim();
    if (!label) { alert('Give the measurement a name, e.g. Crown length.'); return; }
    if (type === 'count' && !unit) { alert('Say what\'s counted, e.g. windows.'); return; }
    if (mqccMeasOf(qt).some(m => String(m.label).trim().toLowerCase() === label.toLowerCase())) { alert('This quote already has a measurement called “' + label + '”. Pick it in the option\'s price menu, or use another name.'); return; }
    const btn = document.getElementById('mqcc-madd-save'); const t0 = btn.textContent; btn.disabled = true; btn.textContent = 'Saving, one second…';
    try {
      await mqccSaveStepMeas(qt, null, label, type, unit);
      mqccMaddClose();
      mqccRowsRender();
      const word = type === 'count' ? (unit.replace(/s$/, '') || 'unit') : (type === 'sqft' ? 'sq ft' : 'lin ft');
      const ok = document.getElementById('mqcc-madd-ok');
      if (ok) { ok.innerHTML = `✓ Added <strong>${mqccEsc(label)}</strong>. Now pick <strong>per ${mqccEsc(word)} of ${mqccEsc(label)}</strong> in any option's price menu below.`; ok.style.display = 'block'; }
      try { if (typeof mqccRenderMeasBar === 'function') mqccRenderMeasBar(); } catch (e) {}
    } catch (e) { alert('Couldn\'t add the measurement — please try again.'); }
    finally { btn.disabled = false; btn.textContent = t0; }
  };
  function mqccRowsRender() {
    mqccMaddSync();
    const box = document.getElementById('mqcc-cat-opts'); if (!box) return;
    const rows = window._mqccRows || (window._mqccRows = []);
    if (!rows.length) rows.push({ name: '', rate: '', how: 'flat' });
    const hows0 = mqccRowHows();
    const cid = mqccEditCat;
    box.innerHTML = rows.map((r, i) => {
      const hows = hows0.map(([v, l]) => [v, v === 'each' && r.unit && r.unit !== 'each' ? 'per ' + r.unit.replace(/s$/, '') : l]);
      if (/^meas:/.test(r.how) && !hows.some(h => h[0] === r.how)) hows.push([r.how, 'per unit of a removed measurement']);
      const more = r.id ? `<a href="#" onclick="event.preventDefault();mqccRowFull(${i})" style="font-size:11.5px;font-weight:600;color:#2563eb;text-decoration:none;white-space:nowrap">Photos &amp; more →</a>` : '';
      const tags = r.id && r.extras && r.extras.length ? `<span style="font-size:11.5px;color:#6b7280">${r.extras.map(mqccEsc).join(' · ')}</span>` : '';
      const priceCell = r.locked
        ? `<div style="grid-column:span 2;font-size:12.5px;color:#374151;padding:0 4px">${r.lockedText}</div>`
        : `<div class="mqcc-money" style="${r.how === 'later' ? 'visibility:hidden' : ''}"><span>$</span><input type="number" min="0" step="0.01" placeholder="0.00" value="${mqccEsc(r.rate)}" oninput="mqccRowSet(${i},'rate',this.value)"/></div>
        <select onchange="mqccRowSet(${i},'how',this.value)">${hows.map(([v, l]) => `<option value="${v}" ${r.how === v ? 'selected' : ''}>${mqccEsc(l)}</option>`).join('')}</select>`;
      return `<div class="mqcc-orow" style="${r.off ? 'opacity:.6' : ''}">
        <input type="text" maxlength="60" placeholder="Option name" value="${mqccEsc(r.name)}" oninput="mqccRowSet(${i},'name',this.value)"/>
        ${priceCell}
        <button type="button" class="mqcc-ox" title="Remove" onclick="mqccRowDel(${i})">✕</button>
      </div>${tags || more ? `<div style="display:flex;gap:10px;align-items:center;margin:-2px 0 8px 2px">${tags}${more}</div>` : ''}`;
    }).join('');
  }
  // Full option editor for one row (photos, variants, install…).
  window.mqccRowFull = function(i) {
    const r = (window._mqccRows || [])[i]; if (!r || !r.id) return;
    const changed = (window._mqccRows || []).some(x => !x.id ? String(x.name || '').trim() : (x.name !== x.orig.name || x.rate !== x.orig.rate || x.how !== x.orig.how)) || (window._mqccRowsGone || []).length;
    if (changed && !confirm('Open the full editor for this option?\n\nChanges you made in this step box that aren\'t saved yet will be lost.')) return;
    const cid = mqccEditCat;
    mqccClose('mqcc-cat-overlay');
    mqccOpenItem(cid, r.id);
  };
  window.mqccRowSet = function(i, k, v) { const r = (window._mqccRows || [])[i]; if (!r) return; r[k] = v; if (k === 'how') mqccRowsRender(); mqccDraftCatPreview(); };
  window.mqccRowAdd = function() { (window._mqccRows = window._mqccRows || []).push({ name: '', rate: '', how: 'flat' }); mqccRowsRender(); const ins = document.querySelectorAll('#mqcc-cat-opts .mqcc-orow input[type=text]'); if (ins.length) ins[ins.length - 1].focus(); };
  window.mqccRowDel = function(i) { const g = (window._mqccRows || []).splice(i, 1)[0]; if (g && g.id) (window._mqccRowsGone = window._mqccRowsGone || []).push(g); mqccRowsRender(); mqccDraftCatPreview(); };
  function mqccRowsFilled() { return (window._mqccRows || []).filter(r => String(r.name || '').trim()); }
  // Saves a measurement step's measurement on its quote (new or updated).
  async function mqccSaveStepMeas(qt, measId, label, type, unit) {
    const f = mqccShopFields();
    let cfgAll = {}; try { cfgAll = JSON.parse(f['Hidden widget tabs'] || '{}') || {}; } catch (e) { cfgAll = {}; }
    const q = (cfgAll.quoteTypes || []).find(x => x && x.id === qt);
    if (!q) throw new Error('quote type not found');
    q.measures = Array.isArray(q.measures) ? q.measures : [];
    let m = measId && q.measures.find(x => x && x.id === measId);
    if (!m) { m = { id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }; q.measures.push(m); }
    Object.assign(m, { label, type, unit: type === 'count' ? unit : '' });
    const json = JSON.stringify(cfgAll);
    await atUpdate(SHOPS_TABLE, shopRecord.id, { 'Hidden widget tabs': json });
    shopRecord.fields['Hidden widget tabs'] = json;
    if (window._mqShopRecord && window._mqShopRecord.fields) window._mqShopRecord.fields['Hidden widget tabs'] = json;
    return m.id;
  }
  async function mqccDropStepMeas(qt, measId) {
    if (!qt || !measId) return;
    if (lineItems.some(r => { const c = mqccCfg(r); return c.how === 'meas' && c.meas === measId; })) return; // options still priced from it
    const f = mqccShopFields();
    let cfgAll = {}; try { cfgAll = JSON.parse(f['Hidden widget tabs'] || '{}') || {}; } catch (e) { return; }
    const q = (cfgAll.quoteTypes || []).find(x => x && x.id === qt);
    if (!q || !Array.isArray(q.measures)) return;
    const n = q.measures.length;
    q.measures = q.measures.filter(x => x && x.id !== measId);
    if (q.measures.length === n) return;
    const json = JSON.stringify(cfgAll);
    await atUpdate(SHOPS_TABLE, shopRecord.id, { 'Hidden widget tabs': json });
    shopRecord.fields['Hidden widget tabs'] = json;
    if (window._mqShopRecord && window._mqShopRecord.fields) window._mqShopRecord.fields['Hidden widget tabs'] = json;
  }
  // What a measurement step looks like on the widget (live preview).
  function mqccMeasStepPvHtml(name, desc, label, type, unit, rate) {
    const u = mqccMeasUnitWord(type, unit);
    const sampleN = type === 'count' ? 6 : (type === 'lft' ? 24 : 48);
    const calc = type === 'count' ? '' : `<div style="font-size:12.5px;color:#2563eb;font-weight:600;margin-top:10px">🧮 Use the calculator</div>`;
    return `<div style="background:#fff;border:1px solid #dbe3ef;border-radius:12px;padding:16px">
      <div style="display:flex;align-items:center;gap:10px;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:.02em;color:#111827"><span style="width:24px;height:24px;border-radius:50%;background:#1d4ed8;color:#fff;display:grid;place-items:center;font-size:12px;flex:none">📏</span>${mqccEsc(name || 'Your heading')}</div>
      ${desc ? `<div style="font-size:13px;color:#4b5563;margin:8px 0 0;line-height:1.5">${mqccEsc(desc)}</div>` : ''}
      <div style="margin-top:12px;font-size:13px;font-weight:600;color:#374151">${mqccEsc(label || name || 'Measurement')}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px"><div style="width:130px;border:1px solid #d1d5db;border-radius:8px;padding:9px 11px;font-size:15px;font-weight:600;color:#111827;background:#fff">${sampleN}</div><span style="font-size:13px;color:#6b7280">${mqccEsc(u)}</span></div>
      ${calc}
      ${rate > 0 ? `<div style="margin-top:12px;font-size:12.5px;color:#15803d;font-weight:600">e.g. ${sampleN} ${mqccEsc(u)} × ${mqccMoney(rate)} = ${mqccMoney(sampleN * rate)}</div>` : ''}
    </div>`;
  }
  window.mqccCatAnswerChanged = function() {
    if (document.getElementById('mqcc-cat-kind').value === 'meas') return;
    const one = document.getElementById('mqcc-cat-answer').value === 'one';
    document.getElementById('mqcc-cat-required-txt').textContent = one
      ? 'Customers must choose one (no “None” option)'
      : 'Customers must add at least one before continuing';
  };

  // Nov 20 (Jordan): "Saving, one second…" on the Save buttons while the
  // save runs (it can take a few seconds).
  async function mqccSavingWrap(btnId, run) {
    const b = document.getElementById(btnId);
    if (b && b.dataset.saving === '1') return;
    const t0 = b ? b.textContent : '';
    if (b) { b.dataset.saving = '1'; b.disabled = true; b.textContent = 'Saving, one second…'; }
    try { return await run(); }
    finally { if (b) { b.dataset.saving = ''; b.disabled = false; if (b.textContent === 'Saving, one second…') b.textContent = t0; } }
  }
  window.mqccSaveCat = async function() { return mqccSavingWrap('mqcc-cat-save', mqccSaveCatRun); };
  async function mqccSaveCatRun() {
    const name = document.getElementById('mqcc-cat-name').value.trim();
    if (!name) { alert('Give this step a heading.'); return; }
    const kind = document.getElementById('mqcc-cat-kind').value === 'meas' && ((document.getElementById('mqcc-cat-qt') || {}).value || '') ? 'meas' : 'choices';
    const mType = document.getElementById('mqcc-cat-mtype').value;
    const mUnit = document.getElementById('mqcc-cat-munit').value.trim();
    if (kind === 'meas' && mType === 'count' && !mUnit) { alert('Say what\'s counted, e.g. doors.'); return; }
    const badRow = kind === 'choices' && mqccRowsFilled().find(r => !r.locked && r.how !== 'later' && r.rate !== '' && !(parseFloat(r.rate) >= 0));
    if (badRow) { alert(`Check the price for “${badRow.name}”.`); return; }
    const prevCat = mqccEditCat ? Object.assign({}, mqccCats().find(c => c.id === mqccEditCat) || {}) : null;
    const prevKind = prevCat ? (prevCat.kind === 'meas' ? 'meas' : 'choices') : null;
    // Anything that would be lost → one clear warning first.
    {
      const warn = [];
      const nOpts = prevCat && prevKind === 'choices' ? mqccItems(prevCat.id).length : 0;
      if (prevCat && prevKind === 'choices' && kind === 'meas' && nOpts) warn.push(`This step's ${nOpts} option${nOpts === 1 ? '' : 's'} will be deleted (with their photos and settings).`);
      if (kind === 'choices') {
        const gone = window._mqccRowsGone || [];
        if (gone.length) warn.push(`Delete ${gone.map(g => '“' + (g.orig ? g.orig.name : g.name) + '”').join(', ')} — photos and settings go with ${gone.length === 1 ? 'it' : 'them'}.`);
        (window._mqccRows || []).filter(r => r.id && r.nVar && r.how !== r.orig.how && !['each', 'sqft', 'lft'].includes(r.how)).forEach(r => warn.push(`“${r.name}”: its ${r.nVar} variant${r.nVar === 1 ? '' : 's'} will be removed (they only work with per-item, per sq ft or per lin ft pricing).`));
        (window._mqccRows || []).filter(r => r.id && !String(r.name || '').trim()).forEach(r => warn.push(`“${r.orig.name}” has no name — it will be deleted.`));
      }
      if (warn.length && !confirm('Before saving:\n\n• ' + warn.join('\n• ') + '\n\nSave anyway?')) return;
    }
    const btn = document.getElementById('mqcc-cat-save');
    btn.disabled = true;
    const cats = mqccCats();
    const answer = kind === 'meas' ? 'any' : (document.getElementById('mqcc-cat-answer').value === 'one' ? 'one' : 'any');
    const data = {
      name,
      description: document.getElementById('mqcc-cat-desc').value.trim(),
      answer,
      required: document.getElementById('mqcc-cat-required').checked,
      showIf: document.getElementById('mqcc-cat-showif').value || '',
      proOnly: document.getElementById('mqcc-cat-pro').checked,
      after: document.getElementById('mqcc-cat-after').value || 'specialty',
    };
    const qtPick = document.getElementById('mqcc-cat-qt') ? (document.getElementById('mqcc-cat-qt').value || '') : '';
    const roomPick = mqccCatRoomsRead();
    if (roomPick && roomPick.hidden.length === roomPick.all.length) { alert('Tick at least one project type for this step to show in.'); btn.disabled = false; return; }
    // Same name already in this quote → almost always meant to edit that one
    // (Jordan, Nov 2026: renames ended up as second copies).
    const twin = cats.find(c => c.id !== mqccEditCat && (c.qt || '') === qtPick && (c.name || '').trim().toLowerCase() === name.toLowerCase());
    if (twin && !confirm(`This quote already has a step called “${twin.name}”.\n\nTo change that step, click Cancel and use ✏️ Edit / rename on it instead.\n\nClick OK only if you really want two steps with the same name.`)) { btn.disabled = false; return; }
    let id = mqccEditCat;
    let moved = true;
    if (id) {
      const i = cats.findIndex(c => c.id === id);
      if (i >= 0) {
        moved = (cats[i].after || 'specialty') !== data.after || (cats[i].qt || '') !== qtPick;
        cats[i] = { ...cats[i], ...data };
        delete cats[i].tie; // links live on options only
        if (qtPick) cats[i].qt = qtPick; else delete cats[i].qt;
      }
    } else {
      id = 'cc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      cats.push(qtPick ? { id, ...data, qt: qtPick } : { id, ...data });
    }
    // "After X" means right after X: a new (or moved) step goes ahead of any
    // steps already sitting after X, so picking "After tall cabinets" puts
    // it before "Finished ends", and "↳ After ✨ Finished ends" puts it after.
    if (moved) {
      const i = cats.findIndex(c => c.id === id);
      const self = cats.splice(i, 1)[0];
      const j = cats.findIndex(c => (c.after || 'specialty') === data.after && (c.qt || '') === qtPick);
      if (j >= 0) cats.splice(j, 0, self); else cats.push(self);
    }
    try {
      const ci = cats.findIndex(c => c.id === id);
      if (kind === 'meas' && ci >= 0) {
        const mLabel = document.getElementById('mqcc-cat-mlabel').value.trim();
        const rate = document.getElementById('mqcc-cat-mpmode').value === 'later' ? 0 : parseFloat(document.getElementById('mqcc-cat-mrate').value);
        cats[ci].meas = await mqccSaveStepMeas(qtPick, cats[ci].meas, mLabel || name, mType, mUnit);
        cats[ci].kind = 'meas';
        if (rate > 0) cats[ci].rate = Math.round(rate * 100) / 100; else delete cats[ci].rate;
        if (mLabel) cats[ci].priceName = mLabel; else delete cats[ci].priceName;
      } else if (ci >= 0) { delete cats[ci].kind; delete cats[ci].meas; delete cats[ci].rate; delete cats[ci].priceName; }
      await mqccSaveCats(cats);
      await mqccSaveCatRooms(id, roomPick);
      // Switched kind on an existing step.
      if (prevCat && prevKind === 'choices' && kind === 'meas') {
        const old = mqccItems(id);
        for (const r of old) { await atDelete(LINE_ITEMS_TABLE, r.id); }
        const gone = new Set(old.map(r => r.id));
        lineItems = lineItems.filter(r => !gone.has(r.id));
        if (gone.size) await mqccClearShowIfRefs(gone);
      }
      if (prevCat && prevKind === 'meas' && kind === 'choices') { try { await mqccDropStepMeas(prevCat.qt, prevCat.meas); } catch (e) {} }
      // Options from the rows: removed ones deleted, changed ones updated,
      // new ones added. Extras (photos, variants, install…) are kept.
      let made = 0, changedN = 0;
      if (kind === 'choices' && mqccEditCat) {
        const goneIds = new Set((window._mqccRowsGone || []).map(g => g.id));
        (window._mqccRows || []).forEach(r => { if (r.id && !String(r.name || '').trim()) goneIds.add(r.id); });
        for (const gid of goneIds) { try { await atDelete(LINE_ITEMS_TABLE, gid); } catch (e) {} }
        if (goneIds.size) { lineItems = lineItems.filter(r => !goneIds.has(r.id)); await mqccClearShowIfRefs(goneIds); }
        for (const r of (window._mqccRows || [])) {
          if (!r.id || goneIds.has(r.id)) continue;
          const rec = lineItems.find(x => x.id === r.id); if (!rec) continue;
          const name = String(r.name).trim().slice(0, 60);
          const nameCh = name !== r.orig.name, priceCh = !r.locked && (r.rate !== r.orig.rate || r.how !== r.orig.how);
          if (!nameCh && !priceCh) continue;
          const cfg = Object.assign({}, mqccCfg(rec));
          const fields = { Name: name };
          if (priceCh) {
            if (r.how === 'later') { cfg.how = 'flat'; cfg.later = true; delete cfg.meas; fields.Rate = 0; }
            else {
              delete cfg.later;
              if (/^meas:/.test(r.how)) { cfg.how = 'meas'; cfg.meas = r.how.slice(5); } else { cfg.how = r.how; delete cfg.meas; }
              fields.Rate = Math.round((parseFloat(r.rate) || 0) * 100) / 100;
            }
            cfg.unit = cfg.how === 'each' ? (r.unit || cfg.unit || 'each') : '';
            if (!['each', 'sqft', 'lft'].includes(cfg.how)) delete cfg.variants;
            fields['Custom pricing'] = JSON.stringify(cfg);
          }
          await atUpdate(LINE_ITEMS_TABLE, r.id, fields);
          if (nameCh) { try { await mqccCopyShopKeys(mqccKeyPairs(id, r.orig.name, id, name, cfg)); } catch (e) {} }
          Object.assign(rec.fields, fields);
          changedN++;
        }
      }
      if (kind === 'choices') {
        const have = mqccItems(id);
        let sort = have.length ? Math.max(...have.map(x => x.fields['Sort order'] || 0)) + 1 : 1;
        for (const r of mqccRowsFilled().filter(x => !x.id)) {
          const how = /^meas:/.test(r.how) ? 'meas' : (['each', 'sqft', 'lft'].includes(r.how) ? r.how : 'flat');
          const cfg = { how, unit: how === 'each' ? 'each' : '', min: 0, showIf: '', proOnly: mqccF().pro === 'pro' };
          if (how === 'meas') cfg.meas = r.how.slice(5);
          if (r.how === 'later') cfg.later = true;
          const fields = { Name: String(r.name).trim().slice(0, 60), Description: '', Rate: r.how === 'later' ? 0 : Math.round((parseFloat(r.rate) || 0) * 100) / 100, 'Custom pricing': JSON.stringify(cfg) };
          const rec = await atCreate(LINE_ITEMS_TABLE, { shop: [shopRecord._recordId], Category: id, Active: true, 'Sort order': sort, ...fields });
          if (rec && rec.id) { lineItems.push({ id: rec.id, fields: { ...(rec.fields || {}), Category: id, Active: true, 'Sort order': sort, ...fields } }); made++; }
          sort++;
        }
      }
      window._mqccRows = []; window._mqccRowsGone = [];
      mqccClose('mqcc-cat-overlay');
      mqccRerender(id);
      mqccMsg(mqccEditCat ? '✓ Step saved.' : kind === 'meas' ? '✓ Measurement step added.' : made ? `✓ Step added with ${made} option${made === 1 ? '' : 's'}.` : '✓ Step added — now add its options.');
    } catch(e) { alert('Could not save: ' + e.message); }
    btn.disabled = false;
  };
  window.mqccDeleteCat = async function() {
    const cid = mqccEditCat;
    const c = mqccCats().find(x => x.id === cid);
    if (!c) return;
    const items = mqccItems(cid);
    if (!confirm(`Delete "${c.name}"${items.length ? ` and its ${items.length} option${items.length === 1 ? '' : 's'}` : ''}? This can't be undone.`)) return;
    try {
      for (const r of items) { await atDelete(LINE_ITEMS_TABLE, r.id); }
      const gone = new Set(items.map(r => r.id));
      lineItems = lineItems.filter(r => !gone.has(r.id));
      const cats = mqccCats().filter(x => x.id !== cid).map(x => (gone.has(x.showIf) ? { ...x, showIf: '' } : x))
        .map(x => (x.after === 'cc:' + cid ? { ...x, after: c.after || 'specialty' } : x)); // steps placed after it take its spot
      await mqccSaveCats(cats);
      await mqccClearShowIfRefs(gone);
      if (c.kind === 'meas') { try { await mqccDropStepMeas(c.qt, c.meas); } catch (e) {} }
      mqccClose('mqcc-cat-overlay');
      mqccRerender(null);
      mqccMsg('✓ Category deleted.');
    } catch(e) { alert('Could not delete: ' + e.message); }
  };
  window.mqccMoveCat = async function(cid, dir) {
    const cats = mqccCats();
    const i = cats.findIndex(c => c.id === cid);
    if (i < 0) return;
    // Swap with the nearest step in the same quote.
    let j = i + dir;
    while (j >= 0 && j < cats.length && (cats[j].qt || '') !== (cats[i].qt || '')) j += dir;
    if (j < 0 || j >= cats.length) return;
    [cats[i], cats[j]] = [cats[j], cats[i]];
    try { await mqccSaveCats(cats); mqccRerender(null); } catch(e) { alert('Could not save: ' + e.message); }
  };

  // ── Options ──
  window.mqccOpenItem = function(cid, id) {
    const c = mqccCats().find(x => x.id === cid);
    if (!c) return;
    mqccEditItem = { cid, id };
    // Pick-one step: the option being edited starts picked in the preview,
    // so its description and "How many?" show right away.
    if (c.answer === 'one') mqccPv.one[cid] = id || '__draft__';
    const r = id ? lineItems.find(x => x.id === id) : null;
    const cfg = mqccCfg(r);
    document.getElementById('mqcc-item-title').textContent = r ? 'Edit option' : 'New option';
    document.getElementById('mqcc-item-sub').textContent = c.name;
    { // Move an existing option into another step of the same quote.
      const sib = mqccCats().filter(cc => (cc.qt || '') === (c.qt || ''));
      const stSel = document.getElementById('mqcc-item-step');
      if (stSel) {
        stSel.innerHTML = sib.map(cc => `<option value="${cc.id}">${mqccEsc(cc.name)}${cc.id === cid ? ' (now)' : ''}</option>`).join('');
        stSel.value = cid;
        mqccShow('mqcc-item-step-wrap', !!r && sib.length > 1);
      }
    }
    document.getElementById('mqcc-item-name').value = r ? (r.fields['Name'] || '') : '';
    document.getElementById('mqcc-item-desc').value = r ? (r.fields['Description'] || '') : '';
    document.getElementById('mqcc-item-how').value = cfg.later ? 'later' : (MQCC_HOW[cfg.how] ? cfg.how : 'flat');
    // Count options this one can be priced on (never itself).
    const srcList = [];
    mqccCats().filter(cc => (cc.qt || '') === (c.qt || '')).forEach(cc => mqccItems(cc.id).forEach(o => { if (o.id !== id && MQCC_COUNTS.includes(mqccCfg(o).how)) srcList.push(`<option value="${o.id}">${mqccEsc(cc.name + ': ' + (o.fields['Name'] || ''))} (${mqccEsc(mqccSrcUnit(o.id))})</option>`); }));
    const srcSel = document.getElementById('mqcc-item-src');
    srcSel.innerHTML = srcList.length ? srcList.join('') : '<option value="">No counted options yet — add one priced on “A number the customer enters” first</option>';
    if (cfg.src && srcSel.querySelector(`option[value="${cfg.src}"]`)) srcSel.value = cfg.src;
    const ccSel = document.getElementById('mqcc-item-pctcc');
    const sameQuoteCats = mqccCats().filter(cc => (cc.qt || '') === (c.qt || ''));
    ccSel.innerHTML = sameQuoteCats.map(cc => `<option value="${cc.id}">${mqccEsc(cc.name)}</option>`).join('');
    ccSel.value = cfg.pctCc && sameQuoteCats.some(cc => cc.id === cfg.pctCc) ? cfg.pctCc : cid;
    // A quote type has no cabinets: nothing to price off cabinet footage,
    // drawers or doors, and nothing to link to.
    const inQt = !!c.qt;
    const measList = inQt ? mqccMeasOf(c.qt) : [];
    const measSel = document.getElementById('mqcc-item-meas');
    measSel.innerHTML = measList.length ? measList.map(m => `<option value="${m.id}">${mqccEsc(m.label)} (${mqccEsc(mqccMeasUnit(m))})</option>`).join('') : '<option value="">No measurements yet — add them on Project types → this quote → Measurements</option>';
    if (cfg.meas && measSel.querySelector(`option[value="${cfg.meas}"]`)) measSel.value = cfg.meas;
    const CAB_HOWS = ['base_lf', 'upper_lf', 'all_lf', 'island_lf', 'crown_lf', 'valance_lf', 'drawers', 'tallcabs', 'pct'];
    const howSel = document.getElementById('mqcc-item-how');
    [...howSel.querySelectorAll('option')].forEach(o => { const off = (inQt && CAB_HOWS.includes(o.value)) || (!inQt && o.value === 'meas'); o.hidden = off; o.disabled = off; });
    if (!inQt && howSel.value === 'meas') howSel.value = 'flat';
    [...howSel.querySelectorAll('optgroup')].forEach(g => { g.hidden = [...g.children].every(o => o.hidden); });
    const pctAllOpt = howSel.querySelector('option[value="pct_all"]');
    if (pctAllOpt) pctAllOpt.textContent = inQt ? '% of everything else in this quote' : MQCC_HOW.pct_all.label;
    // Show the real names next to the generic choices, e.g.
    // "% of one of your custom categories (Fence style, Height, Gates…)".
    // A dropdown list can't be styled per word, so it's plain text, cut to fit.
    {
      const fit = (base, names) => { if (!names.length) return base; let t = base + '  (' + names.join(', ') + ')'; if (t.length > 78) t = t.slice(0, 76).replace(/[,\s]+[^,]*$/, '') + '…)'; return t; };
      const sibNames = mqccCats().filter(x => x.id !== c.id && (inQt ? (x.qt || '') === (c.qt || '') : true)).map(x => x.name);
      const ccOpt = howSel.querySelector('option[value="pct_cc"]');
      if (ccOpt) ccOpt.textContent = fit(MQCC_HOW.pct_cc.label, sibNames);
      // Nov 18 (Jordan): one choice per measurement ("Per sq ft of Door
      // area"), so there's no separate "Which measurement?" box. All of them
      // keep value "meas"; data-meas says which one.
      [...howSel.querySelectorAll('option[data-meas-extra]')].forEach(o => o.remove());
      const mOpt = howSel.querySelector('option[value="meas"]');
      if (mOpt) {
        delete mOpt.dataset.meas;
        if (measList.length) {
          const lab = m => `Per ${mqccMeasUnit(m).replace(/s$/, '')} of ${m.label}`;
          mOpt.textContent = lab(measList[0]); mOpt.dataset.meas = measList[0].id;
          let prev = mOpt;
          measList.slice(1).forEach(m => { const o = document.createElement('option'); o.value = 'meas'; o.textContent = lab(m); o.dataset.meas = m.id; o.dataset.measExtra = '1'; prev.after(o); prev = o; });
          if (howSel.value === 'meas') { const want = [...howSel.options].find(o => o.dataset.meas === (cfg.meas || '')); if (want) howSel.selectedIndex = want.index; }
        } else mOpt.textContent = MQCC_HOW.meas.label;
      }
    }
    if (inQt && CAB_HOWS.includes(howSel.value)) howSel.value = 'flat';
    const tieWrap = document.getElementById('mqcc-item-tiecat') && document.getElementById('mqcc-item-tiecat').closest('.mqph-field');
    if (tieWrap) tieWrap.style.setProperty('display', inQt ? 'none' : '', inQt ? 'important' : '');
    mqccTieLoad('item', inQt ? null : cfg.tie);
    document.getElementById('mqcc-item-unit').value = cfg.unit || '';
    document.getElementById('mqcc-item-rate').value = r && r.fields['Rate'] != null ? r.fields['Rate'] : '';
    document.getElementById('mqcc-item-min').value = cfg.min > 0 ? cfg.min : '';
    document.getElementById('mqcc-item-pro').checked = r ? !!cfg.proOnly : (mqccF().pro === 'pro' && !c.proOnly && !mqccQtIsPro(c.qt));
    mqccItemRoomsFill(c, r);
    mqccFNoteFill('mqcc-item-fnote', !r);
    const inst = cfg.install && typeof cfg.install === 'object' ? cfg.install : null;
    document.getElementById('mqcc-item-inst-on').checked = !!(inst && inst.price > 0);
    document.getElementById('mqcc-item-inst-price').value = inst && inst.price > 0 ? inst.price : '';
    window._mqccInstWant = inst ? (inst.how === 'meas' ? 'meas:' + (inst.meas || '') : (['flat', 'same', 'count', 'sqft', 'lft'].includes(inst.how) ? inst.how : 'same')) : 'flat';
    document.getElementById('mqcc-item-inst-unit').value = inst && inst.unit ? inst.unit : '';
    document.getElementById('mqcc-item-inst-q').value = inst && inst.label ? inst.label : '';
    document.getElementById('mqcc-item-inst-min').value = inst && inst.min > 0 ? inst.min : '';
    mqccInstToggle();
    document.getElementById('mqcc-item-adj').checked = !!cfg.adj;
    // Worded for where this step lives: a cabinet shop's Cabinets / Full
    // project steps talk about Base cabinets %; a quote type (painting,
    // flooring…) only ever sees its own Items %.
    document.getElementById('mqcc-item-adj-hint').innerHTML = inQt
      ? 'Off (normal): only a project type’s <strong>Total ballpark %</strong> changes this price. On: its <strong>Items %</strong> changes this price too, and its <strong>Installation %</strong> changes this option’s install. Set them on Project types → Price adjustments.'
      : 'Off (normal — same as specialty items): only a project type’s <strong>Total ballpark %</strong> changes this price. On: its <strong>Base cabinets %</strong> changes this price too, and its <strong>Installation %</strong> changes this option’s install. Set them on Project types → Price adjustments.';
    mqccVarDraft = Array.isArray(cfg.variants) ? cfg.variants.map(v => ({ ...v })) : [];
    mqccVarRender();
    document.getElementById('mqcc-calc-a').value = '';
    document.getElementById('mqcc-calc-b').value = '';
    document.getElementById('mqcc-calc-out').textContent = '';
    // Show-if rules are for "pick any" categories — a pick-one category
    // already shows exactly one choice at a time.
    mqccShow('mqcc-item-showif-wrap', c.answer === 'any');
    mqccShowIfOptions(document.getElementById('mqcc-item-showif'), mqccAllOptions(cid, id || '__new__').filter(o => { const rr = lineItems.find(x => x.id === o.id); const oc = rr && mqccCats().find(x => x.id === rr.fields['Category']); return oc && (oc.qt || '') === (c.qt || ''); }), cfg.showIf || '', 'Always');
    mqccItemHowChanged();
    const itemOv = document.getElementById('mqcc-item-overlay');
    itemOv.oninput = itemOv.onchange = () => mqccDraftItemPreview();
    mqccDraftItemPreview();
    itemOv.classList.add('show');
    setTimeout(() => { mqccItemSnap = mqccItemSig(); }, 0);
    setTimeout(() => document.getElementById('mqcc-item-name')?.focus(), 50);
  };
  function mqccPerWord(how) {
    if (how === 'each') return document.getElementById('mqcc-item-unit').value.trim() || 'unit';
    if (how === 'opt') return mqccSrcUnit(document.getElementById('mqcc-item-src').value);
    if (how === 'meas') return mqccMeasUnit(mqccMeasFind(document.getElementById('mqcc-item-meas').value)).replace(/s$/, '');
    return (MQCC_HOW[how] && MQCC_HOW[how].per) || 'unit';
  }
  window.mqccItemHowChanged = function() {
    const how = document.getElementById('mqcc-item-how').value;
    { const hs = document.getElementById('mqcc-item-how'), o = hs.options[hs.selectedIndex], ms = document.getElementById('mqcc-item-meas');
      if (o && o.dataset.meas && ms && ms.value !== o.dataset.meas) ms.value = o.dataset.meas; }
    const isPct = MQCC_PCT.includes(how);
    const later = how === 'later';
    { const ln = document.getElementById('mqcc-item-later-note'); if (ln) ln.style.display = later ? 'block' : 'none'; }
    mqccShow('mqcc-item-rate-wrap', !later);
    mqccShow('mqcc-item-unit-wrap', how === 'each');
    mqccShow('mqcc-item-src-wrap', how === 'opt');
    mqccShow('mqcc-item-meas-wrap', how === 'meas' && !(document.getElementById('mqcc-item-meas').value)); // only when there's nothing to pick yet
    mqccShow('mqcc-item-pctcc-wrap', how === 'pct_cc');
    mqccShow('mqcc-item-min-wrap', how !== 'flat' && !later);
    const catNow = mqccEditItem ? mqccCats().find(x => x.id === mqccEditItem.cid) : null;
    mqccShow('mqcc-item-var-wrap', !!catNow && catNow.answer === 'any' && ['each', 'sqft', 'lft'].includes(how));
    mqccShow('mqcc-item-inst-wrap', !isPct && !later);
    mqccShow('mqcc-item-adj-wrap', !isPct && !later, 'flex');
    const vnote = document.getElementById('mqcc-var-note');
    if (vnote) vnote.dataset.per = how === 'each' ? '' : ((MQCC_HOW[how] && MQCC_HOW[how].per) || '');
    if (document.getElementById('mqcc-var-list')) mqccVarRender();
    const per = mqccPerWord(how);
    document.getElementById('mqcc-item-rate-label').textContent = isPct ? 'Percentage (use a minus for a discount)' : (how === 'flat' ? 'Price' : `Price per ${per}`);
    document.getElementById('mqcc-item-rate-pfx').textContent = isPct ? '' : CUR();
    document.getElementById('mqcc-item-rate-sfx').textContent = isPct ? MQCC_HOW[how].sfx : '';
    mqccShow('mqcc-calc-wrap', how !== 'flat' && !later);
    let words;
    if (isPct) words = ['On a', how === 'pct' ? 'cabinet job, this added' : (how === 'pct_all' ? 'job (cabinets + extras), this added' : 'total for that category, this added'), ''];
    else if (how === 'each' || how === 'opt' || how === 'meas') words = ['A job with', per, 'cost'];
    else words = ['A job with', (MQCC_HOW[how] && MQCC_HOW[how].word) || 'units', 'cost'];
    document.getElementById('mqcc-calc-a-pre').textContent = words[0] + (isPct ? ' ' + CUR() : '');
    document.getElementById('mqcc-calc-a-post').textContent = words[1];
    document.getElementById('mqcc-calc-b-pre').textContent = words[2];
    mqccInstWording(how);
    mqccCalc();
    mqccCheck();
  };
  // Nov 18 (Jordan): install wording that fits this option -- your own
  // quotes have no Supply + install step, and "same count as the item"
  // didn't say what count.
  function mqccInstWording(how) {
    const c = mqccEditItem ? mqccCats().find(x => x.id === mqccEditItem.cid) : null;
    const inQt = !!(c && c.qt);
    const note = document.getElementById('mqcc-item-inst-note');
    if (note) note.textContent = inQt
      ? 'Customers choose Supply only or Supply + install right on this option (it starts on Supply only).'
      : 'Customers get a Supply only / Supply + install choice on this option. It starts on whatever they picked in your Supply + install step, and they can change it.';
    const sel = document.getElementById('mqcc-item-inst-how');
    if (!sel) return;
    let same;
    if (how === 'meas') { const ms = document.getElementById('mqcc-item-meas'); const o = ms && ms.options[ms.selectedIndex]; const m = o ? mqccMeasFind(o.value) : null; same = m ? `per ${mqccMeasUnit(m).replace(/s$/, '')} — the same ${m.label} they enter` : ''; }
    else if (how === 'sqft') same = 'per sq ft — the same square feet they enter';
    else if (how === 'lft') same = 'per lin ft — the same linear feet they enter';
    else if (how === 'each') { const u = (document.getElementById('mqcc-item-unit').value || 'item').trim(); same = `per ${u.replace(/s$/, '')} — the same number of ${u.replace(/s?$/, 's')} they pick`; }
    else if (how === 'opt') same = 'per unit — the same number as the linked option';
    else if (MQCC_HOW[how] && MQCC_HOW[how].per) same = `per ${MQCC_HOW[how].per.replace(/s$/, '')} — the same ${MQCC_HOW[how].word || MQCC_HOW[how].per} as the price`;
    else same = '';
    const cu = (document.getElementById('mqcc-item-inst-unit').value || '').trim();
    const opts = [['flat', 'flat, once']];
    if (same) opts.push(['same', same]);
    opts.push(['count', cu ? `per ${cu.replace(/s$/, '')} — customers say how many` : 'per item they count (e.g. per door)']);
    opts.push(['sqft', 'per sq ft — customers enter the square feet']);
    opts.push(['lft', 'per lin ft — customers enter the linear feet']);
    // Nov 19: skip the measurement the option is already priced on — "the
    // same … they enter" at the top already covers it.
    const sameMeas = how === 'meas' && same ? ((document.getElementById('mqcc-item-meas') || {}).value || '') : '';
    if (inQt) mqccMeasOf(c.qt).forEach(m => { if (sameMeas && m.id === sameMeas) return; opts.push(['meas:' + m.id, `per ${mqccMeasUnit(m).replace(/s$/, '')} of ${m.label}`]); });
    let keep = window._mqccInstWant || sel.value || 'flat';
    if (sameMeas && keep === 'meas:' + sameMeas) keep = 'same';
    window._mqccInstWant = null;
    sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${mqccEsc(l)}</option>`).join('');
    sel.value = opts.some(o => o[0] === keep) ? keep : 'flat';
    mqccInstHowChanged(true);
  }
  window.mqccInstHowChanged = function(quiet) {
    const sel = document.getElementById('mqcc-item-inst-how'); if (!sel) return;
    const v = sel.value;
    const cf = document.getElementById('mqcc-item-inst-countf'); if (cf) cf.style.display = v === 'count' ? 'block' : 'none';
    const cu = (document.getElementById('mqcc-item-inst-unit').value || '').trim() || 'doors';
    const cOpt = sel.querySelector('option[value="count"]'); if (cOpt && (document.getElementById('mqcc-item-inst-unit').value || '').trim()) cOpt.textContent = `per ${cu.replace(/s$/, '')} — customers say how many`;
    const ex = document.getElementById('mqcc-item-inst-explain');
    if (ex) ex.textContent = v === 'flat' ? 'One install charge whenever they choose Supply + install.'
      : v === 'same' ? 'Install is multiplied by the same number this option is priced on.'
      : v === 'count' ? `When they choose Supply + install, customers are asked how many ${cu} — e.g. $17 × 12 ${cu}.`
      : v === 'sqft' ? 'When they choose Supply + install, customers enter the square feet to install (with the calculator).'
      : v === 'lft' ? 'When they choose Supply + install, customers enter the linear feet to install (with the calculator).'
      : /^meas:/.test(v) ? 'Install is multiplied by what customers enter for that measurement.' : '';
    if (!quiet) mqccCheck();
    if (typeof mqccDraftItemPreview === 'function') { try { mqccDraftItemPreview(); } catch (e) {} }
  };
  window.mqccCalc = function() {
    const how = document.getElementById('mqcc-item-how').value;
    const a = parseFloat(document.getElementById('mqcc-calc-a').value);
    const b = parseFloat(document.getElementById('mqcc-calc-b').value);
    const out = document.getElementById('mqcc-calc-out');
    if (!(a > 0) || isNaN(b)) { out.innerHTML = ''; return; }
    const isPct = MQCC_PCT.includes(how);
    const rate = isPct ? (b / a) * 100 : b / a;
    const r2 = Math.round(rate * 100) / 100;
    out.innerHTML = `= <strong>${isPct ? r2 + '%' : mqccMoney(r2) + ' per ' + mqccEsc(mqccPerWord(how))}</strong> <button type="button" class="mqph-btn mqph-btn-secondary mqph-btn-sm" style="margin-left:6px" onclick="document.getElementById('mqcc-item-rate').value='${r2}';mqccCheck()">Use this</button>`;
  };
  // ── Switch options inside the window (Nov 2026): clicking another option
  // in the live preview (or "+ New option") opens it here. Changes to the
  // current one are saved first; nothing changed -> it just switches.
  let mqccItemSnap = '';
  function mqccItemSig() {
    const ov = document.getElementById('mqcc-item-overlay');
    if (!ov) return '';
    return JSON.stringify([...ov.querySelectorAll('input,select,textarea')].map(e => e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value)) + JSON.stringify(mqccVarDraft || []);
  }
  // Saving can take a second on a real connection: show "Saving…" on the
  // first click straight away and ignore extra clicks meanwhile, so it never
  // looks like it needs a second click (or saves the option twice).
  let mqccGoBusy = false;
  window.mqccItemGo = async function(targetId) {
    if (mqccGoBusy) return;
    mqccGoBusy = true;
    const btns = [...document.querySelectorAll('#mqcc-item-saveadd, #mqcc-item-pv button[onclick="mqccItemGo(null)"]')];
    const pv = document.getElementById('mqcc-item-pv');
    btns.forEach(b => { b.dataset.mqT = b.innerHTML; b.disabled = true; b.innerHTML = 'Saving…'; b.style.cursor = 'wait'; });
    if (pv) pv.style.cursor = 'wait';
    try { await mqccItemGoRun(targetId); }
    finally {
      mqccGoBusy = false;
      btns.forEach(b => { if (b.isConnected && b.dataset.mqT != null) { b.innerHTML = b.dataset.mqT; b.disabled = false; b.style.cursor = ''; } });
      if (pv) pv.style.cursor = '';
    }
  };
  async function mqccItemGoRun(targetId) {
    const ed = mqccEditItem;
    if (!ed) return;
    const cid = ed.cid;
    const ov = document.getElementById('mqcc-item-overlay');
    const fresh = !ed.id && !targetId;
    if (!fresh && (targetId || null) === (ed.id || null)) return;
    if (fresh && !document.getElementById('mqcc-item-name').value.trim()) {
      // Already on a blank new option -- nothing to save yet.
      document.getElementById('mqcc-item-name').focus();
      return;
    }
    if (fresh || mqccItemSig() !== mqccItemSnap) {
      const name = document.getElementById('mqcc-item-name').value.trim();
      if (!ed.id && !name) {
        if (!confirm('This new option has no name yet, so it can’t be saved. Leave it without saving?')) return;
      } else {
        const was = name;
        await mqccSaveItem();
        if (ov && ov.classList.contains('show')) return; // something needs fixing first -- stay here
        window._mqccItemSavedNote = was;
      }
    }
    mqccOpenItem(cid, targetId || null);
  }
  window.mqccSaveItem = async function() { return mqccSavingWrap('mqcc-item-save', mqccSaveItemRun); };
  async function mqccSaveItemRun() {
    const ed = mqccEditItem;
    if (!ed) return;
    const name = document.getElementById('mqcc-item-name').value.trim();
    if (!name) { alert('Give the option a name.'); return; }
    const stepSel = document.getElementById('mqcc-item-step');
    const toCid = ed.id && stepSel && stepSel.value && mqccCats().some(x => x.id === stepSel.value) ? stepSel.value : ed.cid;
    if (toCid !== ed.cid && lineItems.some(r => r.fields && r.fields['Category'] === toCid && (r.fields['Name'] || '').trim().toLowerCase() === name.toLowerCase())) {
      alert('That step already has an option with this name — rename one of them first.'); return;
    }
    if (lineItems.some(r => r.fields && r.fields['Category'] === ed.cid && r.id !== ed.id && (r.fields['Name'] || '').trim().toLowerCase() === name.toLowerCase())) {
      alert('This category already has an option with that name — photos are matched by name, so each one needs its own.'); return;
    }
    const how = document.getElementById('mqcc-item-how').value;
    const varOn = getComputedStyle(document.getElementById('mqcc-item-var-wrap')).display !== 'none';
    const vars = varOn ? mqccVarDraft.filter(v => String(v.label || '').trim()) : [];
    if (varOn && mqccVarDraft.some(v => !String(v.label || '').trim())) { alert('Give every variant a name (or remove the empty ones).'); return; }
    let rate = parseFloat(document.getElementById('mqcc-item-rate').value);
    if (how === 'later') rate = 0; // priced by a later step
    if (isNaN(rate) && vars.length) rate = 0; // each variant carries its own price
    if (isNaN(rate)) { alert(MQCC_PCT.includes(how) ? 'Enter the percentage.' : 'Enter the price.'); return; }
    const instOn = !MQCC_PCT.includes(how) && how !== 'later' && document.getElementById('mqcc-item-inst-on').checked;
    const instPrice = parseFloat(document.getElementById('mqcc-item-inst-price').value);
    if (instOn && !(instPrice > 0)) { alert('Enter the install price (or untick "Offer installation").'); return; }
    const unit = document.getElementById('mqcc-item-unit').value.trim();
    if (how === 'each' && !unit) { alert('Say what the customer is counting (e.g. panels, hours).'); return; }
    const src = document.getElementById('mqcc-item-src').value;
    if (how === 'opt' && !src) { alert('Pick which option’s number this is priced on.'); return; }
    const measPick = document.getElementById('mqcc-item-meas').value;
    if (how === 'meas' && !measPick) { alert('Pick which measurement this is priced on (add measurements on Project types → this quote first).'); return; }
    const roomsJson = mqccItemRoomsRead(mqccCats().find(x => x.id === ed.cid) || {}, ed.id ? lineItems.find(x => x.id === ed.id) : null);
    if (roomsJson === false) { alert('Tick at least one project type for this option to show in.'); return; }
    const min = parseFloat(document.getElementById('mqcc-item-min').value);
    const cfg = {
      how: how === 'later' ? 'flat' : how,
      unit: how === 'each' ? unit : '',
      min: how !== 'flat' && min > 0 ? Math.round(min * 100) / 100 : 0,
      showIf: document.getElementById('mqcc-item-showif-wrap').style.display === 'none' ? '' : (document.getElementById('mqcc-item-showif').value || ''),
      proOnly: document.getElementById('mqcc-item-pro').checked,
    };
    if (how === 'later') cfg.later = true;
    if (how === 'opt') cfg.src = src;
    if (how === 'meas') cfg.meas = measPick;
    if (how === 'pct_cc') cfg.pctCc = document.getElementById('mqcc-item-pctcc').value;
    if (instOn) {
      const imin = parseFloat(document.getElementById('mqcc-item-inst-min').value);
      const ih = document.getElementById('mqcc-item-inst-how').value || 'flat';
      cfg.install = { price: Math.round(instPrice * 100) / 100, how: /^meas:/.test(ih) ? 'meas' : ih, min: imin > 0 ? Math.round(imin * 100) / 100 : 0 };
      if (/^meas:/.test(ih)) cfg.install.meas = ih.slice(5);
      if (ih === 'count') { cfg.install.unit = (document.getElementById('mqcc-item-inst-unit').value || '').trim() || 'units'; const q = (document.getElementById('mqcc-item-inst-q').value || '').trim(); if (q) cfg.install.label = q; }
    }
    if (!MQCC_PCT.includes(how) && document.getElementById('mqcc-item-adj').checked) cfg.adj = true;
    if (vars.length) cfg.variants = vars.map(v => { const o = { id: v.id, label: String(v.label).trim(), price: Math.round((parseFloat(v.price) || 0) * 100) / 100, min: Math.round((parseFloat(v.min) || 0) * 100) / 100 }; if (v.sized) Object.assign(o, { sized: true, dimA: v.dimA, dimB: v.dimB, unit: v.unit === 'mm' ? 'mm' : 'in', swap: !!v.swap, rateMode: v.rateMode || 'flat', rate: parseFloat(v.rate) || 0 }); return o; });
    const tie = mqccTieRead('item');
    if (tie) cfg.tie = tie;
    // Keep the option's own photos (set on My Products, Nov 2026).
    if (ed.id) { const oldCfg = mqccCfg(lineItems.find(x => x.id === ed.id)); if (oldCfg.ph && typeof oldCfg.ph === 'object') cfg.ph = oldCfg.ph; }
    const fields = {
      Name: name,
      Description: document.getElementById('mqcc-item-desc').value.trim(),
      Rate: Math.round(rate * 100) / 100,
      'Custom pricing': JSON.stringify(cfg),
    };
    if (roomsJson != null && !(ed.id && document.getElementById('mqcc-item-step') && document.getElementById('mqcc-item-step').value !== ed.cid)) fields['Visible rooms'] = roomsJson;
    const btn = document.getElementById('mqcc-item-save');
    btn.disabled = true;
    try {
      if (ed.id) {
        const r0 = lineItems.find(x => x.id === ed.id);
        const oldName = r0 ? (r0.fields['Name'] || '') : name;
        if (toCid !== ed.cid) {
          const there = mqccItems(toCid);
          fields.Category = toCid;
          fields['Sort order'] = there.length ? Math.max(...there.map(x => x.fields['Sort order'] || 0)) + 1 : 1;
        }
        await atUpdate(LINE_ITEMS_TABLE, ed.id, fields);
        if (r0) Object.assign(r0.fields, fields);
        if (toCid !== ed.cid) {
          try { await mqccCopyShopKeys(mqccKeyPairs(ed.cid, oldName, toCid, name, cfg)); } catch(e) {}
          ed.cid = toCid;
        }
      } else {
        const existing = mqccItems(ed.cid);
        const sort = existing.length ? Math.max(...existing.map(r => r.fields['Sort order'] || 0)) + 1 : 1;
        const rec = await atCreate(LINE_ITEMS_TABLE, { shop: [shopRecord._recordId], Category: ed.cid, Active: true, 'Sort order': sort, ...fields });
        if (rec && rec.id) lineItems.push({ id: rec.id, fields: { ...(rec.fields || {}), Category: ed.cid, Active: true, 'Sort order': sort, ...fields } });
      }
      if (window._mqLastFetchTimes) window._mqLastFetchTimes['products'] = 0;
      mqccClose('mqcc-item-overlay');
      mqccRerender(ed.cid);
      mqccMsg('✓ Option saved. Add a photo or pick its project types in My Products.');
    } catch(e) { alert('Could not save: ' + e.message); }
    btn.disabled = false;
  };
  // ── Variants editor (same idea as Specialty Items' variants) ──
  let mqccVarDraft = [];
  function mqccVarId() { return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  // Sized variant: label and price worked out from its two dimensions and a
  // rate — same maths as Specialty Items (mqApplySizedVariantCalcs): $/sq ft
  // uses both, $/lin ft uses the longer side.
  function mqccVarSized(v) {
    if (!v || !v.sized) return;
    const a = parseFloat(v.dimA) || 0, b = parseFloat(v.dimB) || 0;
    const mm = v.unit === 'mm';
    if (a || b) { const u = mm ? 'mm' : '"'; v.label = v.swap ? `${b}${u} x ${a}${u}` : `${a}${u} x ${b}${u}`; }
    const mode = v.rateMode || 'flat';
    if (mode !== 'flat' && v.rate) {
      const ft = n => mm ? n / 304.8 : n / 12;
      v.price = Math.round((mode === 'sqft' ? ft(a) * ft(b) * v.rate : Math.max(ft(a), ft(b)) * v.rate) * 100) / 100;
    }
  }
  function mqccVarRender() {
    const list = document.getElementById('mqcc-var-list');
    if (!list) return;
    const perRaw = (document.getElementById('mqcc-var-note') || { dataset: {} }).dataset.per || '';
    const per = perRaw ? 'per ' + perRaw : 'each';
    list.innerHTML = mqccVarDraft.map((v, i) => {
      const lock = v.sized ? 'readonly style="background:#f3f4f6;width:130px"' : 'style="width:130px"';
      const priceLock = v.sized && (v.rateMode || 'flat') !== 'flat' ? 'readonly style="background:#f3f4f6;width:84px"' : 'style="width:84px"';
      return `<div class="mqcc-var-row">
        <div class="mqcc-var-line">
          <input type="text" placeholder="Variant name" value="${mqccEsc(v.label || '')}" ${lock} oninput="mqccVarSet(${i},'label',this.value)" id="mqcc-var-label-${i}"/>
          <span>${CUR()}</span><input type="number" step="0.01" placeholder="Price" value="${v.price != null && v.price !== '' ? v.price : ''}" ${priceLock} oninput="mqccVarSet(${i},'price',this.value)" id="mqcc-var-price-${i}"/><span style="color:#6b7280">${mqccEsc(per)}</span>
          <span style="color:#6b7280">min ${CUR()}</span><input type="number" step="0.01" min="0" placeholder="0" value="${v.min > 0 ? v.min : ''}" style="width:64px" oninput="mqccVarSet(${i},'min',this.value)"/>
          <label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:600;margin:0"><input type="checkbox" ${v.sized ? 'checked' : ''} onchange="mqccVarSet(${i},'sized',this.checked,true)" style="width:14px;height:14px"/> 📏 Sized</label>
          <button type="button" class="mqph-btn mqph-btn-secondary mqph-btn-sm" title="Duplicate this variant" onclick="mqccVarDup(${i})">⧉</button>
          <button type="button" class="mqph-btn mqph-btn-danger mqph-btn-sm" title="Remove" onclick="mqccVarDel(${i})">✕</button>
        </div>
        ${v.sized ? `<div class="mqcc-var-line" style="margin-top:6px">
          Size <input type="number" step="0.01" min="0" value="${v.dimA || ''}" style="width:64px" oninput="mqccVarSet(${i},'dimA',this.value)"/> x
          <input type="number" step="0.01" min="0" value="${v.dimB || ''}" style="width:64px" oninput="mqccVarSet(${i},'dimB',this.value)"/>
          <select onchange="mqccVarSet(${i},'unit',this.value)" style="width:auto"><option value="in" ${v.unit !== 'mm' ? 'selected' : ''}>inches</option><option value="mm" ${v.unit === 'mm' ? 'selected' : ''}>mm</option></select>
          <label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;text-transform:none;letter-spacing:0;margin:0"><input type="checkbox" ${v.swap ? 'checked' : ''} onchange="mqccVarSet(${i},'swap',this.checked)" style="width:14px;height:14px"/> show 2nd size first</label>
          · Price <select onchange="mqccVarSet(${i},'rateMode',this.value,true)" style="width:auto"><option value="flat" ${(v.rateMode || 'flat') === 'flat' ? 'selected' : ''}>flat (type it)</option><option value="sqft" ${v.rateMode === 'sqft' ? 'selected' : ''}>per sq ft</option><option value="lft" ${v.rateMode === 'lft' ? 'selected' : ''}>per lin ft</option></select>
          ${(v.rateMode || 'flat') !== 'flat' ? `${CUR()}<input type="number" step="0.01" min="0" value="${v.rate || ''}" style="width:72px" oninput="mqccVarSet(${i},'rate',this.value)"/>` : ''}
        </div>` : ''}
      </div>`;
    }).join('') || '<div style="font-size:12px;color:#9ca3af;margin-top:6px">No variants — the option uses its own price above.</div>';
  }
  window.mqccVarSet = function(i, k, val, rerender) {
    const v = mqccVarDraft[i];
    if (!v) return;
    v[k] = val;
    mqccVarSized(v);
    if (rerender) { mqccVarRender(); }
    else if (v.sized) {
      const l = document.getElementById('mqcc-var-label-' + i), p = document.getElementById('mqcc-var-price-' + i);
      if (l && document.activeElement !== l) l.value = v.label || '';
      if (p && document.activeElement !== p) p.value = v.price != null ? v.price : '';
    }
    mqccDraftItemPreview();
  };
  window.mqccVarAdd = function(sized) {
    mqccVarDraft.push(sized ? { id: mqccVarId(), label: '', price: '', min: 0, sized: true, unit: 'in', rateMode: 'sqft', rate: '' } : { id: mqccVarId(), label: '', price: '', min: 0 });
    mqccVarRender(); mqccDraftItemPreview();
  };
  window.mqccVarDup = function(i) {
    const v = mqccVarDraft[i];
    if (!v) return;
    mqccVarDraft.splice(i + 1, 0, { ...v, id: mqccVarId() });
    mqccVarRender(); mqccDraftItemPreview();
  };
  window.mqccVarDel = function(i) { mqccVarDraft.splice(i, 1); mqccVarRender(); mqccDraftItemPreview(); };
  window.mqccInstToggle = function() {
    const on = document.getElementById('mqcc-item-inst-on').checked;
    document.getElementById('mqcc-item-inst-fields').style.display = on ? 'block' : 'none';
    if (typeof mqccCheck === 'function') mqccCheck();
  };

  // ── Duplicate (same idea as Specialty Items' ⧉ Duplicate) ──
  // Photos / "hide from showroom" / best-seller live on the shop record keyed
  // li_<category>_<name>[_v<variant>], so those are copied to the new keys.
  function mqccPhotoKey(cid, name) {
    const base = String(name || '').replace(/\s*—\s*(uppers|bases|some drawers|mostly drawers|with doors|no doors)\s*$/i, '').trim();
    return `li_${cid}_${base.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
  }
  async function mqccCopyShopKeys(pairs, extraFields) {
    const f = mqccShopFields();
    const parse = k => { try { const o = JSON.parse(f[k] || '{}'); return o && typeof o === 'object' ? o : {}; } catch(e) { return {}; } };
    const maps = { 'Photos': parse('Photos'), 'Hidden': parse('Hidden'), 'Featured items': parse('Featured items') };
    const upd = {};
    Object.entries(maps).forEach(([field, m]) => {
      let changed = false;
      pairs.forEach(([from, to]) => { if (m[from] !== undefined && from !== to) { m[to] = m[from]; changed = true; } });
      if (changed) upd[field] = JSON.stringify(m);
    });
    Object.assign(upd, extraFields || {});
    if (!Object.keys(upd).length) return;
    await atUpdate(SHOPS_TABLE, shopRecord.id, upd);
    Object.entries(upd).forEach(([k, v]) => { shopRecord.fields[k] = v; if (window._mqShopRecord && window._mqShopRecord.fields) window._mqShopRecord.fields[k] = v; });
  }
  function mqccKeyPairs(oldCid, oldName, newCid, newName, cfg) {
    const a = mqccPhotoKey(oldCid, oldName), b = mqccPhotoKey(newCid, newName);
    return [[a, b], ...((cfg && Array.isArray(cfg.variants)) ? cfg.variants.map(v => [a + '_v' + v.id, b + '_v' + v.id]) : [])];
  }
  const MQCC_COPY_FIELDS = ['Name', 'Description', 'Rate', 'Active', 'Sort order', 'Custom pricing', 'Visible rooms', 'Group name', 'Group description', 'Group sort order'];
  window.mqccDuplicateItem = async function(id) {
    const r = lineItems.find(x => x.id === id);
    if (!r) return;
    // Sits right next to Edit -- ask, so a slip doesn't leave a stray copy (Nov 18).
    if (!confirm(`Make a copy of “${(r.fields['Name'] || 'this option').trim()}”?\n\nThe copy gets the same price, photos and settings. To rename an option, use Edit instead.`)) return;
    const cid = r.fields['Category'];
    const names = new Set(mqccItems(cid).map(x => (x.fields['Name'] || '').trim().toLowerCase()));
    const base = (r.fields['Name'] || 'Option').trim();
    let name = `${base} - Copy`, n = 2;
    while (names.has(name.toLowerCase())) name = `${base} - Copy ${n++}`;
    const fields = { shop: [shopRecord._recordId], Category: cid };
    MQCC_COPY_FIELDS.forEach(k => { if (r.fields[k] !== undefined && r.fields[k] !== null && r.fields[k] !== '') fields[k] = r.fields[k]; });
    fields.Name = name;
    fields['Sort order'] = (r.fields['Sort order'] || 0) + 0.5;
    try {
      const rec = await atCreate(LINE_ITEMS_TABLE, fields);
      if (rec && rec.id) lineItems.push({ id: rec.id, fields: { ...(rec.fields || {}), ...fields } });
      await mqccCopyShopKeys(mqccKeyPairs(cid, base, cid, name, mqccCfg(r)));
      if (window._mqLastFetchTimes) window._mqLastFetchTimes['products'] = 0;
      mqccRerender(cid);
      mqccMsg(`✓ Duplicated as "${name}" — click Edit to change it.`);
    } catch(e) { alert('Could not duplicate: ' + e.message); }
  };
  window.mqccDuplicateCat = async function(cid) {
    const cats = mqccCats();
    const c = cats.find(x => x.id === cid);
    if (!c) return;
    const catNames = new Set(cats.map(x => (x.name || '').trim().toLowerCase()));
    let name = `${c.name} - Copy`, n = 2;
    while (catNames.has(name.toLowerCase())) name = `${c.name} - Copy ${n++}`;
    const newId = 'cc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const items = mqccItems(cid);
    try {
      // Copy the options first (new record ids), then point any rules that
      // referred to options inside this category at their copies.
      const idMap = {}, pairs = [];
      for (const r of items) {
        const fields = { shop: [shopRecord._recordId], Category: newId };
        MQCC_COPY_FIELDS.forEach(k => { if (r.fields[k] !== undefined && r.fields[k] !== null && r.fields[k] !== '') fields[k] = r.fields[k]; });
        const rec = await atCreate(LINE_ITEMS_TABLE, fields);
        if (rec && rec.id) { idMap[r.id] = rec.id; lineItems.push({ id: rec.id, fields: { ...(rec.fields || {}), ...fields } }); }
        pairs.push(...mqccKeyPairs(cid, r.fields['Name'], newId, r.fields['Name'], mqccCfg(r)));
      }
      for (const oldId of Object.keys(idMap)) {
        const nr = lineItems.find(x => x.id === idMap[oldId]);
        const cfg = mqccCfg(nr);
        let changed = false;
        if (cfg.showIf && idMap[cfg.showIf]) { cfg.showIf = idMap[cfg.showIf]; changed = true; }
        if (cfg.src && idMap[cfg.src]) { cfg.src = idMap[cfg.src]; changed = true; }
        if (cfg.pctCc === cid) { cfg.pctCc = newId; changed = true; }
        if (changed) { const json = JSON.stringify(cfg); await atUpdate(LINE_ITEMS_TABLE, nr.id, { 'Custom pricing': json }); nr.fields['Custom pricing'] = json; }
      }
      const copy = { ...c, id: newId, name, showIf: idMap[c.showIf] || c.showIf || '' };
      const i = cats.findIndex(x => x.id === cid);
      cats.splice(i + 1, 0, copy);
      await mqccSaveCats(cats);
      // Category-level project types and "Pick a collection" label come along too.
      const f = mqccShopFields(), extra = {};
      try { const cr = JSON.parse(f['Category rooms'] || '{}'); if (cr && cr[cid]) { cr[newId] = cr[cid]; extra['Category rooms'] = JSON.stringify(cr); } } catch(e) {}
      try { const pl = JSON.parse(f['Category picker labels'] || '{}'); if (pl && pl[cid]) { pl[newId] = pl[cid]; extra['Category picker labels'] = JSON.stringify(pl); } } catch(e) {}
      await mqccCopyShopKeys(pairs, extra);
      if (window._mqLastFetchTimes) window._mqLastFetchTimes['products'] = 0;
      mqccRerender(newId);
      mqccMsg(`✓ Duplicated as "${name}" with ${items.length} option${items.length === 1 ? '' : 's'}.`);
    } catch(e) { alert('Could not duplicate: ' + e.message); }
  };
  // ── Premade steps (Oct 29): MidasQuote's ready-made steps (saved on the
  // admin Templates page) -- a shop copies one into any of its quotes.
  function mqccStepLibBtn() {
    if (!Array.isArray(window._mqStepLib)) {
      if (!window._mqStepLibLoading && typeof window.mqLibRows === 'function') {
        window._mqStepLibLoading = true;
        window.mqLibRows('step').then(rows => { window._mqStepLib = rows || []; }).catch(() => { window._mqStepLib = []; }).then(() => {
          window._mqStepLibLoading = false;
          const w = document.getElementById('mqcc-steplib-btn'); if (w) w.innerHTML = mqccStepLibBtn();
        });
      }
      return '';
    }
    return window._mqStepLib.length ? `<button class="mqph-btn mqph-btn-sm" onclick="mqccStepLibOpen()">🧩 Premade steps</button>` : '';
  }
  function mqccStepTargets() {
    const out = [];
    if (!mqphComputeTabScope().countertopsOnly) out.push({ id: '', name: 'Cabinets (Cabinets only + Cabinets & countertops)' });
    const off = typeof window.mqQtsNotOffered === 'function' ? window.mqQtsNotOffered(mqccShopFields()) : new Set();
    mqccQts().filter(q => !off.has(q.id)).forEach(q => out.push({ id: q.id, name: q.name + (q.on === false ? ' (turned off)' : '') }));
    return out;
  }
  function mqccStepSorted() {
    const biz = typeof window.mqBizSnapshot === 'function' ? window.mqBizSnapshot() : null;
    const mine = new Set([...(biz && biz.trades) || [], biz && biz.cab ? 'cabinetry' : '', biz && biz.ct ? 'countertops' : ''].filter(Boolean));
    return (window._mqStepLib || []).slice().sort((a, b) => {
      const ra = a.body.trade ? (mine.has(a.body.trade) ? 0 : 2) : 1, rb = b.body.trade ? (mine.has(b.body.trade) ? 0 : 2) : 1;
      return ra - rb || String(a.body.name || '').localeCompare(String(b.body.name || ''));
    });
  }
  window.mqccStepLibOpen = function(qt) {
    let ov = document.getElementById('mqcc-steplib-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'mqcc-steplib-overlay';
      ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(17,17,17,.55);z-index:99999;align-items:flex-start;justify-content:center;padding:4vh 14px;overflow-y:auto';
      ov.addEventListener('click', e => { if (e.target === ov) ov.style.display = 'none'; });
      document.body.appendChild(ov);
    }
    const targets = mqccStepTargets();
    if (!targets.length) { alert('Add a quote type first (Business info).'); return; }
    const sel = qt !== undefined && targets.some(t => t.id === qt) ? qt : (window._mqccStepTarget !== undefined && targets.some(t => t.id === window._mqccStepTarget) ? window._mqccStepTarget : targets[0].id);
    window._mqccStepTarget = sel;
    const steps = mqccStepSorted();
    const card = r => {
      const b = r.body, st = b.step || {};
      const needsMeas = (st.measures || []).length > 0;
      const blocked = needsMeas && !sel;
      const opts = (st.items || []).slice().sort((x, y) => (x.fields['Sort order'] || 0) - (y.fields['Sort order'] || 0)).slice(0, 6).map(it => `<span style="display:inline-block;font-size:11.5px;background:#f3f4f6;border-radius:8px;padding:3px 9px;margin:0 4px 4px 0;color:#374151">${mqccEsc(it.fields.Name || '')}${' · ' + String(mqccPriceText({ fields: it.fields })).replace(/<span[^>]*>.*?<\/span>/g, '').replace(/ of a removed category$/, '').trim()}</span>`).join('');
      return `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;margin-bottom:10px;background:#fff">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="min-width:0;flex:1">
            <div style="font-size:14px;font-weight:700;color:#111">${mqccEsc(b.name || 'Step')}${b.tradeLabel ? ` <span style="font-size:11px;font-weight:600;color:#8a6510;background:#fbf3df;border-radius:8px;padding:2px 8px;margin-left:4px">${mqccEsc(b.tradeLabel)}</span>` : ''}</div>
            ${b.desc ? `<div style="font-size:12.5px;color:#6b7280;margin-top:3px;line-height:1.45">${mqccEsc(b.desc)}</div>` : ''}
            <div style="margin-top:8px">${opts}${(st.items || []).length > 6 ? `<span style="font-size:11.5px;color:#6b7280">+${st.items.length - 6} more</span>` : ''}</div>
            ${needsMeas ? `<div style="font-size:11.5px;color:#6b7280;margin-top:2px">Priced from the measurement${st.measures.length === 1 ? '' : 's'} ${mqccEsc(st.measures.map(m => '“' + m.label + '”').join(', '))} — added to the quote for you if it doesn't have ${st.measures.length === 1 ? 'it' : 'them'}.</div>` : ''}
          </div>
          <button class="mqph-btn mqph-btn-primary mqph-btn-sm" ${blocked ? 'disabled title="Needs one of your own quote types (it uses measurements)"' : ''} onclick="mqccStepAdd('${r.id}')">${blocked ? 'Quote types only' : '+ Add'}</button>
        </div>
      </div>`;
    };
    ov.innerHTML = `<div style="background:#f9fafb;border-radius:16px;width:100%;max-width:720px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#fff;border-bottom:1px solid #e5e7eb">
        <div style="font-size:16px;font-weight:800;color:#111">🧩 Premade steps</div>
        <button onclick="document.getElementById('mqcc-steplib-overlay').style.display='none'" style="background:none;border:0;font-size:22px;line-height:1;color:#6b7280;cursor:pointer" aria-label="Close">×</button>
      </div>
      <div style="padding:14px 18px">
        <div style="font-size:12.5px;color:#4b5563;line-height:1.5;margin-bottom:10px">Ready-made steps from MidasQuote, already priced. Adding one copies it into your quote — then change the names and prices to match yours, like any step you made yourself.</div>
        <label style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;font-weight:700;color:#111;margin-bottom:12px">Add to:
          <select id="mqcc-steplib-target" onchange="mqccStepLibOpen(this.value)" style="font-size:13px;padding:7px 10px;border:1px solid #d1d5db;border-radius:8px;font-family:inherit;min-width:240px">${targets.map(t => `<option value="${mqccEsc(t.id)}"${t.id === sel ? ' selected' : ''}>${mqccEsc(t.name)}</option>`).join('')}</select>
        </label>
        <div id="mqcc-steplib-msg" style="font-size:12.5px;margin-bottom:8px"></div>
        ${steps.length ? steps.map(card).join('') : '<div style="font-size:13px;color:#6b7280">No premade steps yet.</div>'}
      </div>
    </div>`;
    ov.style.display = 'flex';
  };
  window.mqccStepAdd = async function(recId) {
    const r = (window._mqStepLib || []).find(x => x.id === recId);
    if (!r) return;
    const st = r.body.step || {};
    const qt = window._mqccStepTarget || '';
    const msg = (t, err) => { const m = document.getElementById('mqcc-steplib-msg'); if (m) { m.style.color = err ? '#b91c1c' : '#15803d'; m.textContent = t; } };
    if (!qt && (st.measures || []).length) { msg('That step uses measurements, so it can only go in one of your own quote types.', true); return; }
    msg('Adding…');
    const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newCid = 'cc_' + rid();
    try {
      // Measurements: reuse the quote's own when the label + kind match,
      // otherwise add them to the quote type.
      const measMap = {};
      if (qt && (st.measures || []).length) {
        const f = mqccShopFields();
        let cfgAll = {}; try { cfgAll = JSON.parse(f['Hidden widget tabs'] || '{}') || {}; } catch(e) { cfgAll = {}; }
        const q = (cfgAll.quoteTypes || []).find(x => x && x.id === qt);
        if (q) {
          q.measures = Array.isArray(q.measures) ? q.measures : [];
          let changed = false;
          st.measures.forEach(m => {
            const same = q.measures.find(x => x && String(x.label || '').trim().toLowerCase() === String(m.label || '').trim().toLowerCase() && x.type === m.type);
            if (same) measMap[m.id] = same.id;
            else { const nm = Object.assign({}, m, { id: 'm_' + rid() }); q.measures.push(nm); measMap[m.id] = nm.id; changed = true; }
          });
          if (changed) {
            const json = JSON.stringify(cfgAll);
            await atUpdate(SHOPS_TABLE, shopRecord.id, { 'Hidden widget tabs': json });
            shopRecord.fields['Hidden widget tabs'] = json;
            if (window._mqShopRecord && window._mqShopRecord.fields) window._mqShopRecord.fields['Hidden widget tabs'] = json;
          }
        }
      }
      // Options (new records), then links between them.
      const idMap = {}, made = [];
      for (const it of (st.items || [])) {
        const fields = Object.assign({}, it.fields, { shop: [shopRecord._recordId], Category: newCid });
        delete fields['Visible rooms'];
        const rec = await atCreate(LINE_ITEMS_TABLE, fields);
        if (rec && rec.id) { idMap[it.id] = rec.id; const row = { id: rec.id, fields: { ...(rec.fields || {}), ...fields } }; lineItems.push(row); made.push(row); }
      }
      for (const row of made) {
        const cfg = mqccCfg(row);
        let ch = false;
        if (cfg.showIf) { cfg.showIf = idMap[cfg.showIf] || ''; if (!cfg.showIf) delete cfg.showIf; ch = true; }
        if (cfg.src) { if (idMap[cfg.src]) cfg.src = idMap[cfg.src]; else delete cfg.src; ch = true; }
        if (cfg.pctCc) { if (cfg.pctCc === st.cid) cfg.pctCc = newCid; else delete cfg.pctCc; ch = true; }
        if (cfg.meas) { cfg.meas = measMap[cfg.meas] || cfg.meas; ch = true; }
        if (qt && cfg.tie) { delete cfg.tie; ch = true; }
        if (ch) { const json = JSON.stringify(cfg); await atUpdate(LINE_ITEMS_TABLE, row.id, { 'Custom pricing': json }); row.fields['Custom pricing'] = json; }
      }
      // The step itself, at the end of that quote's steps.
      const cats = mqccCats();
      const names = new Set(cats.filter(c => (c.qt || '') === qt).map(c => (c.name || '').trim().toLowerCase()));
      let name = st.cat && st.cat.name || r.body.name || 'Step', n = 2;
      const base = name;
      while (names.has(name.toLowerCase())) name = `${base} ${n++}`;
      const places = mqccPlaceList(null, qt);
      const start = qt ? 'si' : 'specialty';
      let after = start;
      for (let k = places.findIndex(x => x[0] === start) + 1; k > 0 && k < places.length && /^cc:/.test(places[k][0]); k++) after = places[k][0];
      const cat = Object.assign({ id: newCid }, st.cat || {}, { name, after });
      if (qt) cat.qt = qt;
      const j = cats.findIndex(c => (c.after || 'specialty') === after && (c.qt || '') === qt);
      if (j >= 0) cats.splice(j, 0, cat); else cats.push(cat);
      await mqccSaveCats(cats);
      // Photos / hidden / featured + "Pick a collection" label.
      const f = mqccShopFields();
      const upd = {};
      const pre = 'li_' + st.cid + '_';
      [['Photos', st.photos], ['Hidden', st.hidden], ['Featured items', st.featured]].forEach(([k, src]) => {
        const keys = Object.keys(src || {}).filter(x => x.startsWith(pre));
        if (!keys.length) return;
        let m = {}; try { m = JSON.parse(f[k] || '{}') || {}; } catch(e) { m = {}; }
        keys.forEach(x => { m['li_' + newCid + '_' + x.slice(pre.length)] = src[x]; });
        upd[k] = JSON.stringify(m);
      });
      if (st.pickerLabel) { let m = {}; try { m = JSON.parse(f['Category picker labels'] || '{}') || {}; } catch(e) { m = {}; } m[newCid] = st.pickerLabel; upd['Category picker labels'] = JSON.stringify(m); }
      if (Object.keys(upd).length) {
        await atUpdate(SHOPS_TABLE, shopRecord.id, upd);
        Object.entries(upd).forEach(([k, v]) => { shopRecord.fields[k] = v; if (window._mqShopRecord && window._mqShopRecord.fields) window._mqShopRecord.fields[k] = v; });
      }
      if (window._mqLastFetchTimes) window._mqLastFetchTimes['products'] = 0;
      document.getElementById('mqcc-steplib-overlay').style.display = 'none';
      mqccRerender(newCid);
      const where = qt ? mqccQtName(qt) : 'your Cabinets quotes';
      mqccMsg(`✓ “${name}” added to ${where} with ${made.length} option${made.length === 1 ? '' : 's'}. Check the prices — they're starting points. Pick its project types in My Products.`);
    } catch(e) { msg('Could not add it: ' + e.message, true); }
  };
  window.mqccDeleteItem = async function(id) {
    const r = lineItems.find(x => x.id === id);
    if (!r || !confirm(`Delete "${r.fields['Name'] || 'this option'}"?`)) return;
    try {
      await atDelete(LINE_ITEMS_TABLE, id);
      lineItems = lineItems.filter(x => x.id !== id);
      const gone = new Set([id]);
      const cats = mqccCats();
      if (cats.some(c => c.showIf === id)) await mqccSaveCats(cats.map(c => (c.showIf === id ? { ...c, showIf: '' } : c)));
      await mqccClearShowIfRefs(gone);
      if (window._mqLastFetchTimes) window._mqLastFetchTimes['products'] = 0;
      mqccRerender(r.fields['Category']);
      mqccMsg('✓ Option deleted.');
    } catch(e) { alert('Could not delete: ' + e.message); }
  };
  // Options whose "show only if" pointed at something just deleted go back
  // to always showing.
  async function mqccClearShowIfRefs(goneIds) {
    const cats = new Set(mqccCats().map(c => c.id));
    for (const r of lineItems) {
      if (!r.fields || !cats.has(r.fields['Category'])) continue;
      const cfg = mqccCfg(r);
      if ((cfg.showIf && goneIds.has(cfg.showIf)) || (cfg.src && goneIds.has(cfg.src))) {
        if (goneIds.has(cfg.showIf)) cfg.showIf = '';
        if (goneIds.has(cfg.src)) cfg.src = '';
        const json = JSON.stringify(cfg);
        await atUpdate(LINE_ITEMS_TABLE, r.id, { 'Custom pricing': json });
        r.fields['Custom pricing'] = json;
      }
    }
  }
  window.mqccQtToggle = function(k) {
    const set = window._mqccQtShut || (window._mqccQtShut = new Set());
    set.has(k) ? set.delete(k) : set.add(k);
    const g = document.querySelector(`[data-mqcc-group="${k}"]`);
    if (!g) return;
    const b = g.querySelector('.mqcc-qt-body'), l = g.querySelector('.mqcc-qt-shut-lab');
    if (b) b.style.display = set.has(k) ? 'none' : '';
    if (l) l.textContent = set.has(k) ? 'Show ▸' : 'Hide ▾';
  };
  window.mqccOrderReset = async function(cid) {
    const cats0 = mqccCats(), ci = cats0.findIndex(c => c.id === cid);
    if (ci < 0) return;
    cats0[ci] = Object.assign({}, cats0[ci]); delete cats0[ci].manualOrder;
    try { await mqccSaveCats(cats0); mqccRerender(cid); } catch(e) { alert('Could not save: ' + e.message); }
  };
  window.mqccMoveItem = async function(cid, id, dir) {
    const items = mqccItems(cid);
    const i = items.findIndex(r => r.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    try {
      // Moving an option = "use my order" on the widget (pick-one steps are
      // otherwise listed cheapest-first there).
      const cats0 = mqccCats(), ci = cats0.findIndex(c => c.id === cid);
      if (ci >= 0 && !cats0[ci].manualOrder) { cats0[ci] = Object.assign({}, cats0[ci], { manualOrder: true }); await mqccSaveCats(cats0); }
      // Renumber the whole list 1..n so equal/missing sort orders can't stick.
      for (let k = 0; k < items.length; k++) {
        if ((items[k].fields['Sort order'] || 0) !== k + 1) {
          await atUpdate(LINE_ITEMS_TABLE, items[k].id, { 'Sort order': k + 1 });
          items[k].fields['Sort order'] = k + 1;
        }
      }
      mqccRerender(cid);
    } catch(e) { alert('Could not save: ' + e.message); }
  };



  // ── Customer preview (dashboard only, nothing saved) ──
  // Each custom category on the Pricing tab shows a clickable copy of its
  // widget step plus the price lines it would add, using sample job numbers
  // the shop can change. Mirrors widget.js's mqCcCost/mqCcSync rules (show-if,
  // minimums, % of the cabinet estimate). Turned-off options are left out,
  // same as the widget; project types aren't applied (the preview shows every
  // option). Pro-only options/categories show with a ⚡ tag.
  const mqccPv = { base: 14, upper: 12, est: 9840, island: 6, crown: 12, valance: 8, drawers: 8, tall: 1, install: false, qty: {}, on: {}, one: {}, oneQty: {}, vq: {}, vcur: {}, si: {}, meas: {}, instq: {} };
  const MQCC_PV_SAMPLE = { island_lf: 'island', crown_lf: 'crown', valance_lf: 'valance', drawers: 'drawers', tallcabs: 'tall' };

  // Turns a saved (or being-edited) option into the shape the preview uses —
  // same rules as widget.js mqCcBuild.
  function mqccPvNorm(cid, answer, base, cfg) {
    const ih = cfg.install && ['flat', 'same', 'count', 'sqft', 'lft', 'meas'].includes(cfg.install.how) ? cfg.install.how : 'same';
    const inst = cfg.install && (parseFloat(cfg.install.price) || 0) > 0 ? { price: parseFloat(cfg.install.price) || 0, how: ih, meas: cfg.install.meas || '', unit: cfg.install.unit || '', label: cfg.install.label || '', min: parseFloat(cfg.install.min) || 0 } : null;
    const variants = (answer === 'any' && ['each', 'sqft', 'lft'].includes(cfg.how) && Array.isArray(cfg.variants))
      ? cfg.variants.filter(v => v && v.id && String(v.label || '').trim()).map(v => ({ id: v.id, label: String(v.label).trim(), price: parseFloat(v.price) || 0, min: parseFloat(v.min) || 0 })) : [];
    return Object.assign(base, { inst, adj: !!cfg.adj, variants });
  }
  function mqccPvItems(cid) {
    const answer = ((mqccCats().find(x => x.id === cid)) || {}).answer === 'one' ? 'one' : 'any';
    return mqccItems(cid).filter(r => r.fields['Active'] !== false).map(r => {
      const cfg = mqccCfg(r);
      return mqccPvNorm(cid, answer, mqccPvItemBase(r, cfg), cfg);
    });
  }
  function mqccPvItemBase(r, cfg) {
    {
      return { id: r.id, name: r.fields['Name'] || '', desc: r.fields['Description'] || '', rate: Number(r.fields['Rate']) || 0,
        how: (cfg.how === 'sqft' || cfg.how === 'lft') ? 'each' : (MQCC_HOW[cfg.how] ? cfg.how : 'flat'), unit: cfg.how === 'sqft' ? 'sq ft' : (cfg.how === 'lft' ? 'lin ft' : (cfg.unit || '')), min: Number(cfg.min) || 0, showIf: cfg.showIf || '', proOnly: !!cfg.proOnly,
        src: cfg.src || '', meas: cfg.meas || '', pctCc: cfg.pctCc || '', tie: cfg.tie || null,
        groupName: (r.fields['Group name'] || '').trim(), groupOrder: r.fields['Group sort order'] || 0 };
    }
  }
  function mqccPvPhoto(cid, name) {
    let photos = {};
    try { photos = JSON.parse(mqccShopFields()['Photos'] || '{}'); } catch(e) { photos = {}; }
    const base = String(name || '').replace(/\s*—\s*(uppers|bases|some drawers|mostly drawers|with doors|no doors)\s*$/i, '').trim();
    const k = `li_${cid}_${base.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
    if (photos[k]) return photos[k];
    // ...or on the option itself (cfg.ph), Nov 2026.
    const r = (lineItems || []).find(x => x.fields && x.fields['Category'] === cid && String(x.fields['Name'] || '').trim() === String(name || '').trim());
    let cfg = {}; try { cfg = JSON.parse((r && r.fields['Custom pricing']) || '{}') || {}; } catch(e) {}
    return (cfg.ph && cfg.ph['']) || '';
  }
  function mqccPvOneVal(c, items) {
    const v = mqccPv.one[c.id];
    if (v && (v === 'none' ? !c.required : items.some(i => i.id === v))) return v;
    return c.required ? (items[0] ? items[0].id : 'none') : 'none';
  }
  function mqccPvFind(id) {
    for (const c of mqccCats()) { const it = mqccPvItems(c.id).find(i => i.id === id); if (it) return { c, it }; }
    return null;
  }
  function mqccPvVq(it, vid) { return mqccPv.vq[it.id + '|' + vid] || 0; }
  function mqccPvVcur(it) { const v = mqccPv.vcur[it.id]; return it.variants.some(x => x.id === v) ? v : it.variants[0].id; }
  function mqccPvWantsInst(c, it) {
    if (!it.inst) return false;
    const key = c.answer === 'one' ? c.id : it.id;
    const v = mqccPv.si[key];
    return v ? v === 'install' : mqccPv.install;
  }
  function mqccPvPicked(c, it, items) {
    if (c.answer === 'one') return mqccPvOneVal(c, items) === it.id;
    if (it.variants && it.variants.length) return it.variants.some(v => mqccPvVq(it, v.id) > 0);
    if (it.how === 'each') return (mqccPv.qty[it.id] || 0) > 0;
    return !!mqccPv.on[it.id];
  }
  function mqccPvLive(id, depth) {
    const hit = mqccPvFind(id);
    if (!hit || depth > 6) return false;
    const items = mqccPvItems(hit.c.id);
    return mqccPvCatOn(hit.c, depth + 1) && mqccPvItemOn(hit.c, hit.it, depth + 1) && mqccPvPicked(hit.c, hit.it, items);
  }
  function mqccPvItemOn(c, it, depth) {
    if (c.answer === 'any' && it.showIf && mqccPvFind(it.showIf)) return mqccPvLive(it.showIf, (depth || 0) + 1);
    return true;
  }
  function mqccPvCatOn(c, depth) {
    if (c.showIf && mqccPvFind(c.showIf)) return mqccPvLive(c.showIf, (depth || 0) + 1);
    return true;
  }
  // Same math as widget.js mqCcQty/mqCcCost, on the sample job.
  function mqccPvQty(c, it, depth) {
    switch (it.how) {
      case 'each':
        if (it.variants && it.variants.length) return it.variants.reduce((a, v) => a + mqccPvVq(it, v.id), 0);
        return c.answer === 'one' ? (mqccPv.oneQty[c.id] == null ? 0 : mqccPv.oneQty[c.id]) : (mqccPv.qty[it.id] || 0);
      case 'base_lf': return mqccPv.base;
      case 'upper_lf': return mqccPv.upper;
      case 'all_lf': return mqccPv.base + mqccPv.upper;
      case 'island_lf': return mqccPv.island;
      case 'crown_lf': return mqccPv.crown;
      case 'valance_lf': return mqccPv.valance;
      case 'drawers': return mqccPv.drawers;
      case 'tallcabs': return mqccPv.tall;
      case 'meas': return mqccPv.meas[it.meas] || 0;
      case 'opt': {
        const hit = mqccPvFind(it.src);
        if (!hit || (depth || 0) > 6 || !mqccPvLive(it.src, 0)) return 0;
        return mqccPvQty(hit.c, hit.it, (depth || 0) + 1);
      }
      default: return 1;
    }
  }
  function mqccPvQtyLabel(it, q) {
    const n = Math.round(q * 100) / 100;
    if (it.how === 'each') return `${n}${it.unit ? ' ' + it.unit : ''}`;
    if (/_lf$/.test(it.how)) return `${n} lin ft`;
    if (it.how === 'drawers') return `${n} drawer${n === 1 ? '' : 's'}`;
    if (it.how === 'tallcabs') return `${n} tall cabinet${n === 1 ? '' : 's'}`;
    if (it.how === 'opt') return `${n} ${mqccSrcUnit(it.src)}`;
    return '';
  }
  function mqccPvCompute() {
    const picked = [];
    mqccCats().forEach(c => {
      if (!mqccPvCatOn(c, 0)) return;
      const items = mqccPvItems(c.id);
      items.forEach(it => { if (mqccPvItemOn(c, it, 0) && mqccPvPicked(c, it, items)) picked.push({ c, it }); });
    });
    const res = new Map(), catSum = {};
    let extras = 0;
    const fin = (it, cost) => (it.min > 0 && cost >= 0 && cost < it.min) ? { cost: it.min, minUsed: true } : { cost, minUsed: false };
    picked.filter(x => !MQCC_PCT.includes(x.it.how)).forEach(({ c, it }) => {
      const q = mqccPvQty(c, it, 0);
      if (it.how !== 'flat' && !(q > 0)) return;
      const doInst = mqccPvWantsInst(c, it);
      const sfx = it.inst ? (doInst ? ' — Supply' : ' — Supply only') : '';
      const out = [];
      const mn = (min, cost) => (min > 0 && cost >= 0 && cost < min) ? { cost: min, minUsed: true } : { cost, minUsed: false };
      if (it.variants && it.variants.length) {
        it.variants.forEach(v => { const vq = mqccPvVq(it, v.id); if (!(vq > 0)) return; const f = mn(v.min, v.price * vq); out.push({ label: `${it.name} — ${v.label} (${mqccPvQtyLabel(it, vq)})${sfx}`, cost: f.cost, minUsed: f.minUsed, pro: it.proOnly }); });
      } else {
        const f = fin(it, it.how === 'flat' ? it.rate : it.rate * q);
        const lab = it.how === 'flat' ? it.name : `${it.name} (${mqccPvQtyLabel(it, q)})`;
        out.push(f.cost ? { label: lab + sfx, cost: f.cost, minUsed: f.minUsed, pro: it.proOnly } : { label: lab + ' — included', cost: 0, included: true, pro: it.proOnly });
      }
      if (doInst) {
        const ih = it.inst.how;
        const per = ih === 'same' && it.how !== 'flat';
        // Own count (doors, sq ft…): what's typed in the preview's count box.
        const own = ih === 'count' || ih === 'sqft' || ih === 'lft';
        const iq = per ? q : own ? (mqccPv.instq[c.answer === 'one' ? c.id : it.id] || 0) : ih === 'meas' ? (mqccPv.meas[it.inst.meas] || 0) : 1;
        const f = (own || ih === 'meas') && !(iq > 0) ? { cost: 0 } : mn(it.inst.min, it.inst.price * iq);
        const ownWord = ih === 'count' ? (it.inst.unit || 'units') : ih === 'sqft' ? 'sq ft' : 'lin ft';
        if (f.cost) out.push({ label: per ? `${it.name} (${mqccPvQtyLabel(it, q)}) — Install` : own ? `${it.name} (${iq} ${ownWord}) — Install` : ih === 'meas' ? `${it.name} (${iq}) — Install` : `${it.name} — Install`, cost: f.cost, minUsed: f.minUsed, pro: it.proOnly });
      }
      if (!out.length) return;
      const sum = out.reduce((a, l) => a + l.cost, 0);
      res.set(it.id, out);
      catSum[c.id] = (catSum[c.id] || 0) + sum;
      extras += sum;
    });
    picked.filter(x => MQCC_PCT.includes(x.it.how)).forEach(({ it }) => {
      // A quote type has no cabinet estimate — its % is of the rest of that quote.
      const ownCat = mqccCats().find(cc => mqccPvItems(cc.id).some(x => x.id === it.id));
      const est = ownCat && ownCat.qt ? 0 : mqccPv.est;
      const base = it.how === 'pct' ? est : (it.how === 'pct_all' ? est + extras : (catSum[it.pctCc] || 0));
      const f = fin(it, base * it.rate / 100);
      if (!f.cost) return;
      res.set(it.id, [{ label: `${it.name} (${it.rate}%)`, cost: f.cost, minUsed: f.minUsed, pro: it.proOnly }]);
    });
    return { res, catSum, extras };
  }
  function mqccPvLines(c) {
    const { res } = mqccPvCompute();
    return mqccPvItems(c.id).flatMap(it => res.get(it.id) || []).map(r => ({ ...r, cost: Math.round(r.cost) }));
  }
  function mqccPvMoney(n) { return (n < 0 ? '−' : '') + CUR() + Math.abs(Math.round(n)).toLocaleString(); }
  function mqccPvThumb(cid, it, size) {
    const url = mqccPvPhoto(cid, it.name);
    return url
      ? `<img src="${mqccEsc(url)}" alt="" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;flex-shrink:0;background:#f3f4f6" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'✨',style:'width:${size}px;height:${size}px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #e5e7eb'}))"/>`
      : `<div style="width:${size}px;height:${size}px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size / 3)}px;flex-shrink:0">${it.id === 'none' ? '🚫' : '✨'}</div>`;
  }
  const MQCC_PV_BTN = 'font:inherit;font-size:12px;font-weight:700;border-radius:6px;cursor:pointer;padding:5px 12px;';
  // ── Preview measuring calculator (Oct 30): the same ft / in / mm
  // calculator customers get on the widget for anything in feet, so the
  // shop sees it here too. Fills the preview's number.
  function mqccPvCalcMode(unit) {
    const t = String(unit || '').trim().toLowerCase().replace(/\./g, '');
    if (/^(sq ?ft|sqft|square ?f(ee|oo)t|sf|ft2|ft²)$/.test(t)) return 'sqft';
    if (/^(lin ?ft|linft|linear ?f(ee|oo)t|lf|ft|feet|foot)$/.test(t)) return 'linear';
    return '';
  }
  function mqccPvCalcBtn(target, unit, label) {
    const mode = mqccPvCalcMode(unit);
    if (!mode) return '';
    return `<button type="button" title="Measurement calculator (customers get this too)" onclick="event.stopPropagation();mqccPvCalcOpen('${target}','${mode}','${mqccEsc(String(label || '').replace(/'/g, ''))}')" style="width:28px;height:28px;border-radius:6px;border:1px solid #93c5fd;background:#eff6ff;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" stroke="#1d4ed8" stroke-width="1.8"/><rect x="6.5" y="4.5" width="11" height="4" rx=".5" fill="#1d4ed8"/><rect x="6.5" y="11" width="2.6" height="2.4" rx=".4" fill="#1d4ed8"/><rect x="10.7" y="11" width="2.6" height="2.4" rx=".4" fill="#1d4ed8"/><rect x="14.9" y="11" width="2.6" height="2.4" rx=".4" fill="#1d4ed8"/><rect x="6.5" y="15" width="2.6" height="2.4" rx=".4" fill="#1d4ed8"/><rect x="10.7" y="15" width="2.6" height="2.4" rx=".4" fill="#1d4ed8"/><rect x="14.9" y="15" width="2.6" height="2.4" rx=".4" fill="#1d4ed8"/><rect x="6.5" y="19" width="11" height="2" rx=".4" fill="#1d4ed8"/></svg></button>`;
  }
  const MQCC_FRAC = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅛': ' 1/8', '⅜': ' 3/8', '⅝': ' 5/8', '⅞': ' 7/8' };
  function mqccCalcParse(val) {
    let t = String(val == null ? '' : val).toLowerCase().replace(/[½¼¾⅛⅜⅝⅞]/g, c => MQCC_FRAC[c]);
    t = t.replace(/[″”"]/g, '').replace(/(inches|inch|in)\b/g, '').replace(/(\d)\s*-\s*(\d+\s*\/)/, '$1 $2').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
    let m = /^(\d*\.?\d+) (\d+)\/(\d+)$/.exec(t); if (m) return +m[3] ? (+m[1]) + (+m[2]) / (+m[3]) : 0;
    m = /^(\d+)\/(\d+)$/.exec(t); if (m) return +m[2] ? (+m[1]) / (+m[2]) : 0;
    const n = parseFloat(t); return isFinite(n) && n > 0 ? n : 0;
  }
  const mqccPvCalcSt = { target: '', mode: 'sqft', label: '', unit: 'in', rows: [] };
  const mqccCalcFt = v => { const n = mqccCalcParse(v); return mqccPvCalcSt.unit === 'ft' ? n : (mqccPvCalcSt.unit === 'mm' ? n / 304.8 : n / 12); };
  function mqccCalcTotal() {
    const t = mqccPvCalcSt.mode === 'sqft' ? mqccPvCalcSt.rows.reduce((a, r) => a + mqccCalcFt(r.w) * mqccCalcFt(r.h), 0) : mqccPvCalcSt.rows.reduce((a, r) => a + mqccCalcFt(r.v), 0);
    return Math.round(t * 100) / 100;
  }
  function mqccCalcRender() {
    const box = document.getElementById('mqcc-pvcalc-card');
    if (!box) return;
    const c = mqccPvCalcSt, uw = c.unit === 'mm' ? 'mm' : (c.unit === 'ft' ? 'feet' : 'inches');
    const inp = 'flex:1;min-width:0;font-size:15px;padding:7px 9px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit';
    const ub = u => `<button type="button" onclick="mqccCalcUnit('${u}')" style="flex:1;padding:7px;border-radius:6px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid ${c.unit === u ? '#1a1a1a' : '#d1d5db'};background:${c.unit === u ? '#1a1a1a' : '#fff'};color:${c.unit === u ? '#fff' : '#374151'}">${u === 'ft' ? 'Feet' : (u === 'in' ? 'Inches' : 'mm')}</button>`;
    box.innerHTML = `<div style="font-size:15px;font-weight:700;color:#111;margin-bottom:3px">${c.mode === 'sqft' ? '📐 Square footage calculator' : '📏 Measurement calculator'}${c.label ? ` <span style="font-weight:600;color:#2563eb">— ${mqccEsc(c.label)}</span>` : ''}</div>
      <div style="font-size:12.5px;color:#4b5563;margin-bottom:6px">${c.mode === 'sqft' ? 'Measure each area (width × height) and we’ll add them up in square feet.' : 'Measure each section and we’ll add them up and convert to feet.'}</div>
      <div style="font-size:11.5px;color:#1d4ed8;background:#eff6ff;border-radius:6px;padding:5px 8px;margin-bottom:12px">Preview — this is the calculator your customers get on the widget.</div>
      <div style="display:flex;gap:6px;margin-bottom:10px">${ub('ft')}${ub('in')}${ub('mm')}</div>
      ${c.unit === 'in' ? '<div style="font-size:11.5px;color:#6b7280;margin:-4px 0 8px">Fractions are fine — e.g. 36 3/4 or 3/8</div>' : ''}
      ${c.rows.map((r, i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:7px"><span style="font-size:12px;color:#4b5563;width:60px;flex-shrink:0">Section ${i + 1}</span>${c.mode === 'sqft'
        ? `<input type="text" inputmode="decimal" value="${mqccEsc(r.w || '')}" placeholder="Width" oninput="mqccCalcSet(${i},'w',this.value)" style="${inp}"/><span style="font-size:12px;color:#6b7280">×</span><input type="text" inputmode="decimal" value="${mqccEsc(r.h || '')}" placeholder="Height" oninput="mqccCalcSet(${i},'h',this.value)" style="${inp}"/>`
        : `<input type="text" inputmode="decimal" value="${mqccEsc(r.v || '')}" placeholder="0" oninput="mqccCalcSet(${i},'v',this.value)" style="${inp}"/>`}<span style="font-size:12px;color:#4b5563;width:42px">${uw}</span>${c.rows.length > 1 ? `<button type="button" onclick="mqccCalcDel(${i})" style="background:none;border:0;color:#dc2626;cursor:pointer;font-size:15px;padding:0 3px">✕</button>` : ''}</div>`).join('')}
      <button type="button" onclick="mqccCalcAdd()" style="width:100%;padding:7px;border-radius:6px;border:1.5px dashed #93c5fd;background:#eff6ff;color:#1e40af;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;margin:2px 0 10px">+ Add another section</button>
      <div style="background:#f0fdf4;border-radius:8px;padding:8px 10px;margin-bottom:12px;text-align:center"><div style="font-size:11.5px;color:#4b5563">Total</div><div id="mqcc-pvcalc-total" style="font-size:17px;font-weight:700;color:#166534">${mqccCalcTotal()} ${c.mode === 'sqft' ? 'sq ft' : 'ft'}</div></div>
      <div style="display:flex;gap:8px"><button type="button" onclick="mqccCalcClose()" style="flex:1;padding:9px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#374151;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer">Cancel</button><button type="button" onclick="mqccCalcApply()" style="flex:1;padding:9px;border-radius:8px;border:0;background:#1a1a1a;color:#fff;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer">Use this total</button></div>`;
  }
  window.mqccPvCalcOpen = function(target, mode, label) {
    let ov = document.getElementById('mqcc-pvcalc');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'mqcc-pvcalc';
      ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(17,17,17,.5);z-index:2147483000;align-items:center;justify-content:center;padding:16px';
      ov.innerHTML = '<div id="mqcc-pvcalc-card" style="background:#fff;border-radius:14px;padding:18px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,.3)"></div>';
      ov.addEventListener('click', e => { if (e.target === ov) mqccCalcClose(); });
      document.body.appendChild(ov);
    }
    Object.assign(mqccPvCalcSt, { target, mode, label, rows: [mode === 'sqft' ? { w: '', h: '' } : { v: '' }] });
    mqccCalcRender();
    ov.style.display = 'flex';
  };
  window.mqccCalcSet = function(i, k, v) { if (mqccPvCalcSt.rows[i]) mqccPvCalcSt.rows[i][k] = v; const t = document.getElementById('mqcc-pvcalc-total'); if (t) t.textContent = `${mqccCalcTotal()} ${mqccPvCalcSt.mode === 'sqft' ? 'sq ft' : 'ft'}`; };
  window.mqccCalcUnit = function(u) { mqccPvCalcSt.unit = u; mqccCalcRender(); };
  window.mqccCalcAdd = function() { mqccPvCalcSt.rows.push(mqccPvCalcSt.mode === 'sqft' ? { w: '', h: '' } : { v: '' }); mqccCalcRender(); };
  window.mqccCalcDel = function(i) { mqccPvCalcSt.rows.splice(i, 1); mqccCalcRender(); };
  window.mqccCalcClose = function() { const ov = document.getElementById('mqcc-pvcalc'); if (ov) ov.style.display = 'none'; };
  window.mqccCalcApply = function() {
    const v = mqccCalcTotal(), [kind, key] = [mqccPvCalcSt.target.slice(0, mqccPvCalcSt.target.indexOf(':')), mqccPvCalcSt.target.slice(mqccPvCalcSt.target.indexOf(':') + 1)];
    if (kind === 'one') mqccPv.oneQty[key] = v;
    else if (kind === 'qty') mqccPv.qty[key] = v;
    else if (kind === 'meas') mqccPv.meas[key] = v;
    else if (kind === 'var') { const it = mqccPvFindAny(key); if (it && it.variants && it.variants.length) mqccPv.vq[key + '|' + mqccPvVcur(it)] = v; }
    mqccCalcClose();
    mqccPvRefresh();
  };
  window.mqccPvMeasSet = function(id, v) { mqccPv.meas[id] = Math.max(0, parseFloat(v) || 0); mqccPvRefresh(); };
  function mqccPvStepper(onMinus, onPlus, val, unit) {
    const b = 'width:24px;height:24px;border:1px solid #d1d5db;border-radius:5px;background:#fff;color:#111;font:inherit;font-size:14px;cursor:pointer;padding:0;line-height:1';
    return `<span style="display:inline-flex;align-items:center;gap:6px"><button type="button" style="${b}" onclick="${onMinus}">−</button><span style="min-width:26px;text-align:center;font-size:14px;font-weight:600">${Math.round(val * 100) / 100}</span><button type="button" style="${b}" onclick="${onPlus}">+</button><span style="font-size:11px;font-weight:600;color:#6b7280">${mqccEsc(unit || 'quantity')}</span></span>`;
  }

  function mqccPvViewHtml(c, itemsOverride, hiId) {
    const items = itemsOverride || mqccPvItems(c.id);
    const hi = id => id && id === hiId ? 'box-shadow:0 0 0 3px #fbbf24;' : '';
    const hiA = id => id && id === hiId ? ' data-mqcc-hi="1"' : '';
    const catOn = mqccPvCatOn(c, 0);
    const proTag = ' <span style="font-size:9px;font-weight:800;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:1px 5px;vertical-align:middle;letter-spacing:0;text-transform:none">⚡ Pro</span>';
    let body = '';
    if (c.answer === 'one') {
      const val = mqccPvOneVal(c, items);
      // Same order as the widget: cheapest first unless the shop set its own.
      const ordered = (c.manualOrder || items.some(i => i.groupName)) ? items : items.map((it, k) => ({ it, k })).sort((a, b) => ((a.it.rate || 0) - (b.it.rate || 0)) || (a.k - b.k)).map(x => x.it);
      const list = (c.required ? [] : [{ id: 'none', name: 'None' }]).concat(ordered);
      body = `<div style="display:flex;flex-wrap:wrap;gap:8px">${list.map(it => {
        const sel = val === it.id;
        const go = hiId && it.id !== 'none' && it.id !== hiId ? `;mqccItemGo('${it.id}')` : '';
        return `<button type="button"${hiA(it.id)}${go ? ' title="Click to edit this option"' : ''} onmousedown="event.preventDefault()" onclick="mqccPvPickOne('${c.id}','${it.id}')${go}" style="${hi(it.id)}width:104px;padding:6px;border-radius:9px;border:${sel ? '2px solid #111' : '1px solid #e5e7eb'};background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;font:inherit">
          ${mqccPvThumb(c.id, it, 88)}
          <span style="font-size:11px;font-weight:${sel ? 700 : 500};color:#111;line-height:1.25;text-align:center">${mqccEsc(it.name)}${it.proOnly ? proTag : ''}${it.tie ? ` <span title="${mqccEsc(mqccTieText(it.tie))}">🔗</span>` : ''}</span>
          <span style="font-size:10px;font-weight:700;border-radius:10px;padding:2px 8px;${sel ? 'background:#111;color:#fff' : 'border:1px solid #d1d5db;color:#374151'}">${sel ? '✓ Selected' : 'Select'}</span>
        </button>`;
      }).join('')}</div>`;
      const cur = items.find(i => i.id === val);
      if (cur && cur.desc) body += `<div style="font-size:12.5px;color:#4b5563;margin-top:10px;line-height:1.45">${mqccEsc(cur.desc)}</div>`;
      if (cur && cur.how === 'each') {
        const q = mqccPv.oneQty[c.id] == null ? 0 : mqccPv.oneQty[c.id];
        body += `<div style="display:flex;align-items:center;gap:10px;margin-top:10px;font-size:13px;font-weight:600;color:#374151">How many? ${mqccPvStepper(`mqccPvOneQty('${c.id}',-1)`, `mqccPvOneQty('${c.id}',1)`, q, cur.unit)}${mqccPvCalcBtn('one:' + c.id, cur.unit, c.name)}</div>`;
      }
      if (cur && cur.inst) body += `<div style="display:flex;align-items:center;gap:10px;margin-top:10px;font-size:13px;font-weight:600;color:#374151">Installation ${mqccPvSiSelect(c.id, mqccPvWantsInst(c, cur))}</div>${mqccPvInstQtyHtml(c.id, cur, mqccPvWantsInst(c, cur))}`;
    } else {
      const names = [...new Set(items.filter(i => i.groupName).sort((a, b) => (a.groupOrder || 0) - (b.groupOrder || 0)).map(i => i.groupName))];
      const buckets = names.map(n => ({ name: n, items: items.filter(i => i.groupName === n) }));
      const loose = items.filter(i => !i.groupName);
      if (loose.length) buckets.push({ name: names.length ? 'Other' : '', items: loose });
      const auto = { base_lf: 'Uses the base cabinet length', upper_lf: 'Uses the upper cabinet length', all_lf: 'Uses the total cabinet length',
        island_lf: 'Uses the island length', crown_lf: 'Uses the crown moulding length', valance_lf: 'Uses the valance length',
        drawers: 'Uses the number of drawers', tallcabs: 'Uses the number of tall cabinets' };
      body = buckets.map(b => `${b.name ? `<div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#374151;margin:10px 0 6px">${mqccEsc(b.name)}</div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px">${b.items.map(it => {
          const shown = mqccPvItemOn(c, it, 0);
          const on = shown && mqccPvPicked(c, it, items);
          const rule = it.showIf ? (mqccPvFind(it.showIf) || {}).it : null;
          const vcur = it.variants && it.variants.length ? mqccPvVcur(it) : '';
          const control = vcur ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px">${it.variants.map(v => { const vq = mqccPvVq(it, v.id), sel = v.id === vcur; return `<button type="button" onclick="mqccPvVar('${it.id}','${v.id}')" style="font:inherit;font-size:11px;font-weight:600;padding:3px 8px;border-radius:8px;cursor:pointer;border:1px solid ${sel ? '#111' : '#d1d5db'};background:${sel ? '#111' : '#fff'};color:${sel ? '#fff' : '#374151'}">${mqccEsc(v.label)}${vq > 0 ? ` <span style="color:${sel ? '#fbbf24' : '#1d4ed8'}">×${vq}</span>` : ''}</button>`; }).join('')}</div><span style="display:inline-flex;align-items:center;gap:8px">${mqccPvStepper(`mqccPvVarQty('${it.id}',-1)`, `mqccPvVarQty('${it.id}',1)`, mqccPvVq(it, vcur), it.unit)}${mqccPvCalcBtn('var:' + it.id, it.unit, it.name)}</span>`
            : it.how === 'each'
            ? `<span style="display:inline-flex;align-items:center;gap:8px">${mqccPvStepper(`mqccPvQty('${it.id}',-1)`, `mqccPvQty('${it.id}',1)`, mqccPv.qty[it.id] || 0, it.unit)}${mqccPvCalcBtn('qty:' + it.id, it.unit, it.name)}</span>`
            : `<button type="button" onclick="mqccPvToggle('${it.id}')" style="${MQCC_PV_BTN}border:1.5px solid ${on ? '#1d4ed8' : '#d1d5db'};background:${on ? '#1d4ed8' : '#fff'};color:${on ? '#fff' : '#111'}">${on ? '✓ Added' : '+ Add'}</button>`;
          const goAny = hiId && it.id !== hiId ? ` title="Click to edit this option" onmousedown="if(!event.target.closest('input,select'))event.preventDefault()" onclick="if(!event.target.closest('button,input,select'))mqccItemGo('${it.id}')"` : '';
          return `<div${hiA(it.id)}${goAny} style="${hi(it.id)}${goAny ? 'cursor:pointer;' : ''}display:flex;gap:10px;padding:8px 10px;border-radius:8px;border:1px ${shown ? 'solid' : 'dashed'} ${on ? '#93c5fd' : '#e5e7eb'};background:${on ? '#eff6ff' : '#fff'};${shown ? '' : 'opacity:.55'}">
            ${mqccPvThumb(c.id, it, 56)}
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <div style="font-size:13px;line-height:1.2;color:${on ? '#1d4ed8' : '#111'}">${mqccEsc(it.name)}${it.proOnly ? proTag : ''}</div>
              ${it.desc ? `<div style="font-size:11px;color:#6b7280;line-height:1.3">${mqccEsc(it.desc)}</div>` : ''}
              ${auto[it.how] ? `<div style="font-size:11px;color:#166534">📐 ${auto[it.how]}</div>` : ''}
              ${it.how === 'opt' ? `<div style="font-size:11px;color:#166534">📐 Uses the number of ${mqccEsc(mqccSrcUnit(it.src))}</div>` : ''}
              ${it.how === 'meas' ? `<div style="font-size:11px;color:#166534">📐 Uses “${mqccEsc((mqccMeasFind(it.meas) || {}).label || 'a removed measurement')}”</div>` : ''}
              ${it.tie ? `<div style="font-size:11px;color:#6b7280">🔗 ${mqccEsc(mqccTieText(it.tie))}</div>` : ''}
              ${shown ? `<div style="margin-top:3px">${control}</div>${it.inst ? `<div style="margin-top:5px">${mqccPvSiSelect(it.id, mqccPvWantsInst(c, it))}</div>${mqccPvInstQtyHtml(it.id, it, mqccPvWantsInst(c, it))}` : ''}` : `<div style="font-size:11px;color:#92400e;margin-top:3px">Hidden until “${mqccEsc(rule ? rule.name : '')}” is picked</div>`}
            </div>
          </div>`;
        }).join('')}</div>`).join('');
    }
    const ruleTarget = c.showIf ? (mqccPvFind(c.showIf) || {}).it : null;
    return `<div style="background:#fff;border:1.5px solid ${catOn ? '#93c5fd' : '#e5e7eb'};border-radius:10px;padding:12px 14px;${catOn ? '' : 'opacity:.6'}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="width:22px;height:22px;border-radius:50%;background:#1d4ed8;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center">✨</span>
        <span style="font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#111">${mqccEsc(c.name)}</span>${c.proOnly ? proTag : ''}
      </div>
      ${c.description ? `<div style="font-size:12px;color:#4b5563;margin-bottom:10px;line-height:1.5">${mqccEsc(c.description)}</div>` : ''}
      ${!catOn ? `<div style="font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;margin-bottom:10px">This step is hidden until “${mqccEsc(ruleTarget ? ruleTarget.name : '')}” is picked.</div>` : ''}
      ${items.length ? body : '<div style="font-size:12px;color:#9ca3af">Turned-off options don’t show to customers.</div>'}
      ${(() => {
        // Options priced per measurement: a sample of the quote's Measurements
        // screen (with the calculator), so the price can be tried out here.
        const ids = [...new Set(items.filter(i => i.how === 'meas' && i.meas).map(i => i.meas))];
        const ms = ids.map(id => mqccMeasFind(id)).filter(Boolean);
        if (!ms.length) return '';
        return `<div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:8px 10px;margin-top:12px">
          <div style="font-size:11px;font-weight:700;color:#0f766e;margin-bottom:6px">${(() => {
            // Owned by a measurement step → customers enter it there.
            const own = mqccCats().find(x => x.kind === 'meas' && ms.some(m => m.id === x.meas));
            if (own) return `📏 Customers enter this in “${mqccEsc(own.name)}” — try a number:`;
            // The first step (in this quote's order) priced from a measurement is where customers enter it.
            const order = mqccPlaceList(null, c.qt || '').map(x => x[0]).filter(v => /^cc:/.test(v)).map(v => v.slice(3));
            const firstFor = id => order.find(cid => lineItems.some(r => r.fields && r.fields['Category'] === cid && r.fields['Active'] !== false && mqccCfg(r).how === 'meas' && mqccCfg(r).meas === id));
            const elsewhere = ms.map(m => firstFor(m.id)).filter(cid => cid && cid !== c.id);
            const other = elsewhere.length ? mqccCats().find(x => x.id === elsewhere[0]) : null;
            return other ? `📐 Customers enter this in the Measurements step right after “${mqccEsc(other.name)}” — try a number:` : '📐 Customers enter this in the Measurements step right after this one — try a number:';
          })()}</div>
          <div style="display:flex;flex-wrap:wrap;gap:12px">${ms.map(m => `<label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#374151">${mqccEsc(m.label)}
            <input type="text" inputmode="decimal" value="${mqccPv.meas[m.id] || 0}" onchange="mqccPvMeasSet('${m.id}', this.value)" onclick="this.select()" style="width:70px;text-align:center;font-size:13px;padding:4px 6px;border:1px solid #d1d5db;border-radius:5px;font-family:inherit"/>
            <span style="font-size:11px;color:#6b7280">${mqccEsc(mqccMeasUnit(m))}</span>${mqccPvCalcBtn('meas:' + m.id, m.type === 'sqft' ? 'sq ft' : (m.type === 'lft' ? 'ft' : m.unit), m.label)}</label>`).join('')}</div>
        </div>`;
      })()}
    </div>`;
  }
  function mqccPvLinesHtml(c) {
    const lines = mqccPvLines(c);
    const total = lines.reduce((a, l) => a + l.cost, 0);
    return lines.length
      ? `${lines.map(l => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:5px 0;border-bottom:1px solid #f3f4f6"><span style="color:#374151">${mqccEsc(l.label)}${l.minUsed ? ' <span style="color:#92400e">(minimum)</span>' : ''}${l.pro ? ' <span style="color:#92400e">⚡</span>' : ''}</span><strong style="white-space:nowrap">${l.included ? 'Included' : mqccPvMoney(l.cost)}</strong></div>`).join('')}
        <div style="display:flex;justify-content:space-between;font-size:13px;padding-top:8px"><span style="font-weight:700">Adds to the estimate</span><strong>${total >= 0 ? '+' : ''}${mqccPvMoney(total)}</strong></div>`
      : `<div style="font-size:12px;color:#9ca3af;line-height:1.5">Pick or add something on the left to see what it adds.</div>`;
  }
  function mqccPreviewShell(c) {
    const inp = (k, label, pfx) => `<label style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#374151;margin-bottom:6px">${label}<span style="display:inline-flex;align-items:center;gap:4px">${pfx ? `<span style="color:#6b7280">${pfx}</span>` : ''}<input type="number" min="0" step="0.5" data-mqcc-pv="${k}" value="${mqccPv[k]}" oninput="mqccPvSample('${k}',this.value)" style="width:84px;font-size:12px;padding:4px 6px;border:1px solid #d1d5db;border-radius:5px"/></span></label>`;
    return `<div style="border-top:1px solid #eef0f3;padding:14px 16px 16px;background:#fafbfc">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b7280">👁 Customer preview</div>
        <div style="font-size:11px;color:#9ca3af">Click around like a customer — nothing here is saved. Linked options (🔗) always show here.</div>
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:14px;align-items:start" class="mqcc-pv-grid">
        <div id="mqcc-pv-view-${c.id}" data-mqcc-pv-cat="${c.id}">${mqccPvViewHtml(c)}</div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px">
          <div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#374151;margin-bottom:8px">Sample job</div>
          ${c.qt ? '' : `${inp('base', 'Base cabinets (lin ft)')}
          ${inp('upper', 'Upper cabinets (lin ft)')}
          ${inp('est', 'Cabinet estimate', CUR())}`}
          ${c.qt ? '' : (() => {
            const used = new Set();
            mqccCats().forEach(cc => mqccPvItems(cc.id).forEach(it => { if (MQCC_PV_SAMPLE[it.how]) used.add(it.how); }));
            const labels = { island_lf: 'Island (lin ft)', crown_lf: 'Crown moulding (lin ft)', valance_lf: 'Valance (lin ft)', drawers: 'Drawers', tallcabs: 'Tall cabinets' };
            return Object.keys(labels).filter(h => used.has(h)).map(h => inp(MQCC_PV_SAMPLE[h], labels[h])).join('');
          })()}
          ${mqccCats().some(cc => mqccPvItems(cc.id).some(it => it.inst)) ? `<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#374151;margin:2px 0 6px;cursor:pointer;text-transform:none;letter-spacing:0;font-weight:500"><input type="checkbox" data-mqcc-pv-inst ${mqccPv.install ? 'checked' : ''} onchange="mqccPvInstall(this.checked);document.querySelectorAll('[data-mqcc-pv-inst]').forEach(x=>x.checked=this.checked)" style="width:14px;height:14px"/> Customer picked Supply + install</label>` : ''}
          <div id="mqcc-pv-lines-${c.id}" style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:6px">${mqccPvLinesHtml(c)}</div>
        </div>
      </div>
    </div>`;
  }
  // Show-if rules can cross categories, so every preview refreshes together.
  function mqccPvRefresh() {
    if (document.getElementById('mqcc-cat-overlay')?.classList.contains('show')) mqccDraftCatPreview();
    if (document.getElementById('mqcc-item-overlay')?.classList.contains('show')) mqccDraftItemPreview();
    mqccCats().forEach(c => {
      const v = document.getElementById(`mqcc-pv-view-${c.id}`);
      if (v) v.innerHTML = mqccPvViewHtml(c);
      const l = document.getElementById(`mqcc-pv-lines-${c.id}`);
      if (l) l.innerHTML = mqccPvLinesHtml(c);
    });
  }
  // Live previews inside the New/Edit category and option windows, built
  // from what's typed so far (nothing saved until Save).
  function mqccDraftCatPreview() {
    const box = document.getElementById('mqcc-cat-pv');
    if (!box) return;
    if (document.getElementById('mqcc-cat-kind').value === 'meas') {
      const t = document.getElementById('mqcc-cat-mtype').value;
      box.innerHTML = mqccMeasStepPvHtml(document.getElementById('mqcc-cat-name').value.trim(), document.getElementById('mqcc-cat-desc').value.trim(), document.getElementById('mqcc-cat-mlabel').value.trim(), t, document.getElementById('mqcc-cat-munit').value, (document.getElementById('mqcc-cat-mpmode').value === 'later' ? 0 : (parseFloat(document.getElementById('mqcc-cat-mrate').value) || 0)))
        + `<div style="font-size:11px;color:#6b7280;line-height:1.5;margin-top:10px">📍 Step goes: <strong>${mqccEsc(mqccPlaceLabel(document.getElementById('mqcc-cat-after').value, (document.getElementById('mqcc-cat-qt') || {}).value || ''))}</strong></div>`;
      return;
    }
    const answer = document.getElementById('mqcc-cat-answer').value === 'one' ? 'one' : 'any';
    const c = {
      id: mqccEditCat || '__newcat', name: document.getElementById('mqcc-cat-name').value.trim() || 'Your category name',
      description: document.getElementById('mqcc-cat-desc').value.trim(), answer,
      required: document.getElementById('mqcc-cat-required').checked,
      proOnly: document.getElementById('mqcc-cat-pro').checked, showIf: '',
    };
    let items = mqccEditCat ? mqccPvItems(mqccEditCat) : [];
    const pvById = {}; items.forEach(x => { pvById[x.id] = x; });
    if (mqccRowsFilled().length || (mqccEditCat && (window._mqccRowsGone || []).length)) items = mqccRowsFilled().filter(r => !r.off).map((r, i) => {
      const how = /^meas:/.test(r.how) ? 'meas' : (['sqft', 'lft', 'each'].includes(r.how) ? 'each' : 'flat');
      if (r.id && pvById[r.id]) return r.locked ? Object.assign({}, pvById[r.id], { name: String(r.name).trim() }) : Object.assign({}, pvById[r.id], { name: String(r.name).trim(), rate: r.how === 'later' ? 0 : (parseFloat(r.rate) || 0), how, meas: how === 'meas' ? r.how.slice(5) : '', unit: r.how === 'sqft' ? 'sq ft' : (r.how === 'lft' ? 'lin ft' : (r.how === 'each' ? (r.unit || 'each') : '')) });
      return { id: '__r' + i, name: String(r.name).trim(), desc: '', rate: r.how === 'later' ? 0 : (parseFloat(r.rate) || 0), how, unit: r.how === 'sqft' ? 'sq ft' : (r.how === 'lft' ? 'lin ft' : (r.how === 'each' ? 'each' : '')), meas: how === 'meas' ? r.how.slice(5) : '', min: 0, showIf: '', proOnly: false, src: '', pctCc: '', tie: null, groupName: '', groupOrder: 0 };
    });
    const sample = !items.length;
    if (sample) items = ['Option 1', 'Option 2', 'Option 3'].map((n, i) => ({ id: '__s' + i, name: n, desc: '', rate: 0, how: i === 1 ? 'each' : 'flat', unit: i === 1 ? 'units' : '', min: 0, showIf: '', proOnly: false, src: '', pctCc: '', tie: null, groupName: '', groupOrder: 0 }));
    const place = mqccPlaceLabel(document.getElementById('mqcc-cat-after').value, (document.getElementById('mqcc-cat-qt') || {}).value || '');
    const rule = document.getElementById('mqcc-cat-showif');
    const rp = mqccCatRoomsRead();
    box.innerHTML = `${mqccPvViewHtml(c, items)}
      <div style="font-size:11px;color:#6b7280;line-height:1.5;margin-top:10px">📍 Step goes: <strong>${mqccEsc(place)}</strong>${rp && rp.hidden.length ? `<br>🗂️ Only for: <strong>${mqccEsc(rp.names.join(', ') || 'no project types')}</strong>` : ''}${rule && rule.value ? `<br>👁 Only shows when “${mqccEsc(mqccOptionLabel(rule.value))}” is picked` : ''}${sample ? '<br>Sample options shown — add your real ones after saving.' : ''}</div>`;
  }
  function mqccDraftItemPreview() {
    const box = document.getElementById('mqcc-item-pv');
    const ed = mqccEditItem;
    if (!box || !ed) return;
    const c = mqccCats().find(x => x.id === ed.cid);
    if (!c) return;
    const how0 = document.getElementById('mqcc-item-how').value;
    const how = how0 === 'later' ? 'flat' : how0;
    const draft = {
      id: ed.id || '__draft__', name: document.getElementById('mqcc-item-name').value.trim() || 'New option',
      desc: document.getElementById('mqcc-item-desc').value.trim(), rate: parseFloat(document.getElementById('mqcc-item-rate').value) || 0,
      how: (how === 'sqft' || how === 'lft') ? 'each' : how, unit: how === 'sqft' ? 'sq ft' : (how === 'lft' ? 'lin ft' : document.getElementById('mqcc-item-unit').value.trim()), min: parseFloat(document.getElementById('mqcc-item-min').value) || 0,
      showIf: c.answer === 'any' ? (document.getElementById('mqcc-item-showif').value || '') : '',
      proOnly: document.getElementById('mqcc-item-pro').checked,
      src: how === 'opt' ? document.getElementById('mqcc-item-src').value : '', meas: how === 'meas' ? document.getElementById('mqcc-item-meas').value : '', pctCc: how === 'pct_cc' ? document.getElementById('mqcc-item-pctcc').value : '',
      tie: mqccTieRead('item'), groupName: '', groupOrder: 0,
    };
    {
      const instOn = !MQCC_PCT.includes(how) && how !== 'later' && document.getElementById('mqcc-item-inst-on').checked;
      const varOn = getComputedStyle(document.getElementById('mqcc-item-var-wrap')).display !== 'none';
      mqccPvNorm(c.id, c.answer, draft, {
        how, adj: document.getElementById('mqcc-item-adj').checked,
        install: instOn ? (() => { const ih = document.getElementById('mqcc-item-inst-how').value || 'flat'; return { price: document.getElementById('mqcc-item-inst-price').value, how: /^meas:/.test(ih) ? 'meas' : ih, meas: /^meas:/.test(ih) ? ih.slice(5) : '', unit: document.getElementById('mqcc-item-inst-unit').value, label: document.getElementById('mqcc-item-inst-q').value, min: document.getElementById('mqcc-item-inst-min').value }; })() : null,
        variants: varOn ? mqccVarDraft : [],
      });
      mqccPvDraftItem = draft;
    }
    const saved = mqccPvItems(c.id);
    const i = saved.findIndex(x => x.id === draft.id);
    const items = i >= 0 ? saved.map(x => (x.id === draft.id ? { ...x, ...draft, groupName: x.groupName, groupOrder: x.groupOrder } : x)) : saved.concat([draft]);
    const savedNote = window._mqccItemSavedNote; window._mqccItemSavedNote = '';
    box.innerHTML = `${savedNote ? `<div style="font-size:12px;font-weight:600;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:6px 10px;margin-bottom:8px">✓ “${mqccEsc(savedNote)}” saved</div>` : ''}${mqccPvViewHtml(c, items, draft.id)}
      <button type="button" onmousedown="event.preventDefault()" onclick="mqccItemGo(null)" style="position:sticky;bottom:-14px;z-index:3;box-shadow:0 -8px 14px -6px rgba(248,250,252,.95),0 4px 10px -6px rgba(30,64,175,.35);width:100%;margin-top:10px;padding:8px;border-radius:8px;border:1.5px dashed #93c5fd;background:#eff6ff;color:#1e40af;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer">+ ${ed.id ? 'New option' : 'Save this one &amp; add another'} in “${mqccEsc(c.name)}”</button>
      <div style="font-size:11px;color:#6b7280;line-height:1.5;margin-top:8px">The highlighted ${c.answer === 'one' ? 'choice' : 'card'} is the option you're editing. <strong>Click any other option to edit it here</strong> — your changes to this one are saved first. The price check is under the price box.</div>`;
    // Keep this option in view inside the preview panel (desktop).
    const hiEl = box.querySelector('[data-mqcc-hi]'), pane = box.closest('.mqcc-modal-pv');
    if (hiEl && pane && pane.scrollHeight > pane.clientHeight) {
      const top = hiEl.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
      if (top < pane.scrollTop || top + hiEl.offsetHeight > pane.scrollTop + pane.clientHeight) pane.scrollTop = Math.max(0, top - 40);
    }
  }
  function mqccPvSiSelect(key, isInst) {
    return `<select onchange="mqccPvSi('${key}',this.value)" style="font:inherit;font-size:11px;font-weight:600;padding:3px 6px;border:1px solid #d1d5db;border-radius:5px;background:#fff;width:auto"><option value="supply" ${isInst ? '' : 'selected'}>Supply only</option><option value="install" ${isInst ? 'selected' : ''}>Supply + install</option></select>`;
  }
  window.mqccPvSi = function(key, v) { mqccPv.si[key] = v; mqccPvRefresh(); };
  // Nov 19: the install count box customers see (per door / sq ft / lin ft
  // they enter), same as the widget, once Supply + install is chosen.
  function mqccPvInstQtyHtml(key, it, wants) {
    const ih = it && it.inst && it.inst.how;
    if (!wants || !(ih === 'count' || ih === 'sqft' || ih === 'lft')) return '';
    const word = ih === 'sqft' ? 'square feet' : ih === 'lft' ? 'linear feet' : (it.inst.unit || 'items');
    const ask = it.inst.label || (ih === 'sqft' ? 'How many square feet need installing?' : ih === 'lft' ? 'How many linear feet need installing?' : `How many ${it.inst.unit || 'of these'} need installing?`);
    const v = mqccPv.instq[key] || 0;
    const b = 'width:24px;height:24px;border:1px solid #d1d5db;background:#fff;border-radius:5px;cursor:pointer;font-size:13px;line-height:1;padding:0';
    return `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #e5e7eb;font-size:12px;color:#4b5563" onclick="event.stopPropagation()">${mqccEsc(ask)}
      <div style="display:flex;align-items:center;gap:6px;margin-top:5px"><button type="button" style="${b}" onclick="mqccPvInstQ('${key}',-1)">−</button><span style="min-width:28px;text-align:center;font-size:14px;font-weight:600;color:#111827">${v}</span><button type="button" style="${b}" onclick="mqccPvInstQ('${key}',1)">+</button><span style="font-weight:600;color:#6b7280">${mqccEsc(word)}</span></div></div>`;
  }
  window.mqccPvInstQ = function(key, d) { mqccPv.instq[key] = Math.max(0, (mqccPv.instq[key] || 0) + d); mqccPvRefresh(); };
  function mqccPvFindAny(id) {
    const hit = mqccPvFind(id);
    if (hit) return hit.it;
    // the option being edited in the window isn't saved yet
    return mqccPvDraftItem && mqccPvDraftItem.id === id ? mqccPvDraftItem : null;
  }
  window.mqccPvVar = function(id, vid) { mqccPv.vcur[id] = vid; mqccPvRefresh(); };
  window.mqccPvVarQty = function(id, d) {
    const it = mqccPvFindAny(id);
    if (!it || !it.variants || !it.variants.length) return;
    const k = id + '|' + mqccPvVcur(it);
    mqccPv.vq[k] = Math.max(0, (mqccPv.vq[k] || 0) + d);
    mqccPvRefresh();
  };
  window.mqccPvInstall = function(on) { mqccPv.install = !!on; mqccPvRefresh(); };
  let mqccPvDraftItem = null;
  window.mqccPvPickOne = function(cid, id) { mqccPv.one[cid] = id; mqccPvRefresh(); };
  window.mqccPvOneQty = function(cid, d) { const q = mqccPv.oneQty[cid] == null ? 0 : mqccPv.oneQty[cid]; mqccPv.oneQty[cid] = Math.max(0, q + d); mqccPvRefresh(); };
  window.mqccPvQty = function(id, d) { mqccPv.qty[id] = Math.max(0, (mqccPv.qty[id] || 0) + d); mqccPvRefresh(); };
  window.mqccPvToggle = function(id) { mqccPv.on[id] = !mqccPv.on[id]; mqccPvRefresh(); };
  window.mqccPvSample = function(k, v) {
    mqccPv[k] = Math.max(0, parseFloat(v) || 0);
    document.querySelectorAll(`[data-mqcc-pv="${k}"]`).forEach(i => { if (i !== document.activeElement) i.value = v; });
    mqccCats().forEach(c => { const l = document.getElementById(`mqcc-pv-lines-${c.id}`); if (l) l.innerHTML = mqccPvLinesHtml(c); });
  };

  // One-line check in the option editor, updated as the shop types.
  window.mqccCheck = function() {
    const el = document.getElementById('mqcc-item-check');
    if (!el) return;
    const how = document.getElementById('mqcc-item-how').value;
    const rate = parseFloat(document.getElementById('mqcc-item-rate').value);
    if (isNaN(rate)) { el.style.display = 'none'; return; }
    const min = how === 'flat' ? 0 : (parseFloat(document.getElementById('mqcc-item-min').value) || 0);
    const withMin = cost => (min > 0 && cost >= 0 && cost < min) ? [min, ' (minimum applied)'] : [cost, ''];
    let text = '';
    if (how === 'flat') text = `Adds <strong>${mqccPvMoney(rate)}</strong> when a customer picks it.`;
    else if (MQCC_PCT.includes(how)) {
      let base = mqccPv.est, what = `a ${mqccPvMoney(mqccPv.est)} cabinet estimate`;
      if (how === 'pct_all') what = `a ${mqccPvMoney(mqccPv.est)} cabinet estimate (plus any extras picked)`;
      if (how === 'pct_cc') { base = 1000; const cc = mqccCats().find(x => x.id === document.getElementById('mqcc-item-pctcc').value); what = `${mqccPvMoney(1000)} of ${mqccEsc(cc ? cc.name : 'that category')}`; }
      const [cost, note] = withMin(base * rate / 100);
      text = `On ${what} → ${cost < 0 ? 'takes off' : 'adds'} <strong>${mqccPvMoney(Math.abs(cost))}</strong>${note}`;
    } else {
      const sample = { each: 3, sqft: 30, lft: 12, opt: 3, meas: (() => { const m = mqccMeasFind(document.getElementById('mqcc-item-meas').value); return m && m.type === 'sqft' ? 300 : (m && m.type === 'lft' ? 40 : 3); })(), base_lf: mqccPv.base, upper_lf: mqccPv.upper, all_lf: mqccPv.base + mqccPv.upper, island_lf: mqccPv.island, crown_lf: mqccPv.crown, valance_lf: mqccPv.valance, drawers: mqccPv.drawers, tallcabs: mqccPv.tall }[how] || 0;
      const [cost, note] = withMin(rate * sample);
      const what = (how === 'each' || how === 'opt' || how === 'meas') ? `${sample} ${mqccEsc(mqccPerWord(how))}` : `${sample} ${(MQCC_HOW[how] && MQCC_HOW[how].word) || ''}`;
      text = `${['each', 'sqft', 'lft'].includes(how) ? 'A customer who enters' : 'On a job with'} ${what} → <strong>${mqccPvMoney(cost)}</strong>${note}`;
    }
    el.innerHTML = '🧮 ' + text;
    el.style.display = 'block';
    if (document.getElementById('mqcc-item-overlay')?.classList.contains('show')) mqccDraftItemPreview();
  };

  window.mqphReload = () => loadAndRender();
  async function loadAndRender() {
    const container=document.getElementById('mq-pricing-helper-v2');
    if(!container) return;
    const recs=await atGet(LINE_ITEMS_TABLE,`FIND("${shopRecord._shopToken}", ARRAYJOIN({Shop token (lookup)}))`);
    lineItems=recs.filter(r=>r.fields);
    if (!ctMigrationDone) {
      ctMigrationDone = true; // set before awaiting so a second call can't race in
      await migrateCTPricing();
    }
    if (!baselinePinMigrationDone) {
      baselinePinMigrationDone = true; // set before awaiting so a second call can't race in
      await migrateBaselinePins();
    }
    // Runs on every load, not just once — see mqphCheckBaselineDrift's own
    // comment for why that's safe (self-stabilizing, cheap).
    const driftNotices = await mqphCheckBaselineDrift();
    container.innerHTML=buildEditorHTML(driftNotices);
    mqphRestoreExpandedCats();
    mqphApplyEstimatorTabScope();
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
      _shopToken: (passedShopRecord.fields && passedShopRecord.fields['Shop token']) || '',
      _pricingTable: 'tblu6AYZs8h7SIaQl',
    };
    pricingRecord = passedPricingRecord;
    injectStyles();
    loadAndRender();
  };

})();