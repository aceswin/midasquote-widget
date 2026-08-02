/*
 * MidasQuote PRO QUOTER — TEST BUILD (widgetprotestcats.js)
 * Same widget as the customer-facing one, but for shop owners on the go:
 * shows the real exact computed price (not just the customer ballpark
 * range), and includes an "Add to Home Screen" helper so it feels like a
 * real app on their phone instead of a bookmarked webpage.
 * No login/auth gate — same unlisted-shop-token model as the regular
 * widget, kept deliberately simple. Not linked from anywhere public;
 * treat the URL itself as the only thing standing between "just you"
 * and "anyone with the link."
 */

(function() {

  const CONFIG = {
    PROXY_WORKER:    'https://midasquote-airtable-proxy.jordan132001.workers.dev',
    EMAIL_WORKER:    'https://midasquote-email.jordan132001.workers.dev',
  };

  const scriptTag = document.currentScript;
  const shopToken = new URLSearchParams(scriptTag.src.split('?')[1] || '').get('shop');
  if (!shopToken) { console.error('MidasQuote: No shop token found.'); return; }
  // Generate a session ID once per page load — used to group quote attempts
  // from the same visitor in the dashboard, even if they skip contact info.
  const _mqSessionId = Math.random().toString(36).slice(2,10).toUpperCase();

  // Retry helper — mobile connections (switching wifi/cellular, brief drops)
  // are far more likely to hit a transient network blip than desktop.
  // Retries up to 3 times with a short increasing delay before giving up.
  async function fetchWithRetry(url, options, attempts = 3, delayMs = 400) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout per attempt
      try {
        const res = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        lastErr = err;
        if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
    throw lastErr;
  }

  // ============================================================
  // LOAD SHOP DATA
  // ============================================================
  // Matches the dashboard's "My Products" tab photo-key format so the widget
  // can find real photos for materials/doors/hinges/drawers/trim/countertops.
  // Format: li_<category>_<normalized-name> — different from the
  // spec_<recordId> pattern used for specialty items, since these are
  // deduped/grouped by name rather than by Airtable record id.
  function photoKeyFor(cat, name) {
    const baseName = (name||'').replace(/\s*—\s*(uppers|bases|some drawers|mostly drawers|with doors|no doors)\s*$/i,'').trim();
    const norm = baseName.replace(/[^a-z0-9]/gi,'_').toLowerCase();
    return `li_${cat}_${norm}`;
  }

  // Safely parses the 'Visible rooms' field saved by the dashboard's My
  // Products / Specialty items room-linking UI. Empty/missing = visible for
  // every project type (backward compatible default for every item that's
  // never had this touched).
  function parseVisibleRooms(fieldsObj) {
    try { return fieldsObj['Visible rooms'] ? JSON.parse(fieldsObj['Visible rooms']) : []; }
    catch(e) { return []; }
  }

  // Implements the override rule: an item's own explicit project-type setting
  // always wins outright. Only when an item has NEVER been individually
  // configured does it inherit whatever the whole category is hidden for.
  // Returns an empty array to mean "visible everywhere" — same convention
  // already used throughout the rest of the file, so no other code needs to
  // change to understand the result of this function.
  function effectiveVisibleRooms(itemExplicitRooms, category) {
    if (itemExplicitRooms && itemExplicitRooms.length) return itemExplicitRooms;
    const categoryRooms = window._mqCategoryRooms || {};
    const hiddenForCategory = categoryRooms[category] || [];
    if (!hiddenForCategory.length) return [];
    const allRoomIds = (window._mqRoomTypes || []).map(r => r.id);
    return allRoomIds.filter(id => !hiddenForCategory.includes(id));
  }

  async function loadShopData(token) {
    const res = await fetchWithRetry(`${CONFIG.PROXY_WORKER}/shop-data?shop=${encodeURIComponent(token)}`, {});
    const payload = await res.json();
    if (payload.error || !payload.shop) { console.error('MidasQuote: Shop not found:', token); return null; }

    const shopRecord = payload.shop;
    const shop = shopRecord.fields;
    window._mqRangeLow  = (100 - (parseFloat(shop['Quote range low'])  || 5)) / 100;
    window._mqRangeHigh = (100 + (parseFloat(shop['Quote range high']) || 20)) / 100;
    shop._recordId = shopRecord.id;

    // Parse the shop's saved product photos (same JSON field the dashboard's
    // My Products tab and showroom page already read) so the widget can show
    // real thumbnails instead of just text labels for unfamiliar terms.
    let shopPhotos = {};
    try { shopPhotos = shop['Photos'] ? JSON.parse(shop['Photos']) : {}; } catch(e) { shopPhotos = {}; }

    // Room types — fully editable/addable by the shop now, each with its own
    // price adjustment %. Falls back to the original fixed 6 rooms (with
    // Bathroom's -5% preserved as a working example) for every shop that
    // hasn't touched this new setting yet, so nothing changes for anyone
    // until they actively configure it.
    let roomTypes = [];
    try { roomTypes = shop['Room types'] ? JSON.parse(shop['Room types']) : []; } catch(e) { roomTypes = []; }
    if (!Array.isArray(roomTypes) || !roomTypes.length) {
      roomTypes = [
        { id:'kitchen', name:'Kitchen',        adjustment:0,  description:'The kitchen is where life happens — let\'s build one you\'ll love spending time in. Pick your cabinets, doors, and finishes, and watch your dream kitchen take shape.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/kitchen.png', measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/kitchen.png' },
        { id:'bathroom',name:'Bathroom',       adjustment:-5, description:'Turn your bathroom into a personal retreat. Choose the vanity and finishes that make getting ready each morning feel a little more special.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/bathroom.png', measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/bathroom.png' },
        { id:'laundry', name:'Laundry room',   adjustment:0,  description:'Even the laundry room deserves some love. Add smart, good-looking storage that makes everyday chores feel a lot less like chores.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/laundry.png', measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/laundry.png' },
        { id:'garage',  name:'Garage',         adjustment:0,  description:'From tools to hobbies to overflow storage — give your garage the organized, great-looking upgrade it\'s been waiting for.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/garage.png', measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/garage.png' },
        { id:'commercial', name:'Commercial',  adjustment:0,  description:'Make a great first impression. Get cabinetry built to fit your business, whether it\'s a sleek office or a welcoming retail space.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/commercial.png', measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/commercial.png' },
        { id:'other',   name:'Other',          adjustment:0,  description:'Got a project that doesn\'t quite fit the mold? We love a good challenge — let\'s bring your vision to life.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/other.png', measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/other.png' },
        { id:'refacing',   name:'Refacing',    adjustment:0,  description:'Love your layout, just not the look? Refacing gives your cabinets a whole new personality — new doors, drawer fronts, crown, and valance — without the cost or mess of a full remodel.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/refacing.png', measureText:"[tip]**Skip the math** — tap the [calc] next to the field and enter each section's width and height in whatever unit is easiest (feet, inches, or mm). We'll convert and total the square footage for you automatically, no matter how many sections you have.[/tip]\n\n**Measure in sections:** Break your cabinets into individual runs — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/refacing.png' },
        { id:'repainting', name:'Repainting',  adjustment:0,  description:'Sometimes all it takes is a fresh coat. Give your existing cabinets new color and new life, without replacing a thing.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/repainting.png', measureText:"[tip]**Skip the math** — tap the [calc] next to the field and enter each section's width and height in whatever unit is easiest (feet, inches, or mm). We'll convert and total the square footage for you automatically, no matter how many sections you have.[/tip]\n\n**Measure in sections:** Break your cabinets into individual runs — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/repainting.png' },
        { id:'restaining', name:'Restaining',  adjustment:0,  description:'Bring back the natural beauty of your cabinets. A fresh stain can restore that warm, rich look you fell in love with in the first place.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/restaining.png', measureText:"[tip]**Skip the math** — tap the [calc] next to the field and enter each section's width and height in whatever unit is easiest (feet, inches, or mm). We'll convert and total the square footage for you automatically, no matter how many sections you have.[/tip]\n\n**Measure in sections:** Break your cabinets into individual runs — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/restaining.png' },
      ];
    }
    // Draft project types (active:false) never show to customers, no matter
    // what's configured for them — the shop owner is still setting it up.
    roomTypes = roomTypes.filter(r => r.active !== false);
    window._mqRoomTypes = roomTypes;

    // Category-level hiding — e.g. hide the entire Door Styles category for
    // "Door refacing". An item's own explicit setting always overrides this;
    // this only applies to items that have never been individually configured.
    let categoryRooms = {};
    try { categoryRooms = shop['Category rooms'] ? JSON.parse(shop['Category rooms']) : {}; } catch(e) { categoryRooms = {}; }
    window._mqCategoryRooms = categoryRooms;

    // Per-category "Pick a collection" dropdown label (materials, doors,
    // drawers, crown, valance can each say something different).
    try { window._mqCategoryPickerLabels = shop['Category picker labels'] ? JSON.parse(shop['Category picker labels']) : {}; } catch(e) { window._mqCategoryPickerLabels = {}; }

    const p = payload.pricing || {};

    const lineItemRecords = payload.lineItems || [];
    const sorted = lineItemRecords.filter(r=>r.fields).sort((a,b)=>(a.fields['Sort order']||0)-(b.fields['Sort order']||0));
    const byCategory = cat => sorted.filter(r=>r.fields['Category']===cat).map(r=>r.fields);

    const rawMaterials = byCategory('material');
    const matSeen = new Set();
    const dedupedMaterials = rawMaterials.reduce((acc, m) => {
      const baseName = m['Name'].replace(/\s*—\s*(uppers|bases).*$/i, '').trim();
      if (!matSeen.has(baseName)) { matSeen.add(baseName); acc.push({ ...m, _baseName: baseName }); }
      return acc;
    }, []);

    const li = {
      materials:       dedupedMaterials,
      rawMaterials:    rawMaterials,
      doorStyles:      byCategory('door'),
      drawers:         byCategory('drawer'),
      hinges:          byCategory('hinge'),
      installItems:    byCategory('install'),
      taxItems:        byCategory('tax'),
      otherItems:      byCategory('other'),
      countertopItems: byCategory('countertop'),
      trimItems:       byCategory('trim'),
      tallCabItems:    byCategory('tall_cabinet'),
    };

    // Match photos uploaded via the dashboard's "My Products" tab (see the
    // module-level photoKeyFor helper above for the key format).
    li.materials.forEach(m => { m.photoUrl = shopPhotos[photoKeyFor('material', m._baseName || m['Name'])] || ''; m.visibleRooms = effectiveVisibleRooms(parseVisibleRooms(m), 'material'); });
    li.doorStyles.forEach(d => { d.photoUrl = shopPhotos[photoKeyFor('door', d['Name'])] || ''; d.visibleRooms = effectiveVisibleRooms(parseVisibleRooms(d), 'door'); });
    li.hinges.forEach(h => { h.photoUrl = shopPhotos[photoKeyFor('hinge', h['Name'])] || ''; h.visibleRooms = effectiveVisibleRooms(parseVisibleRooms(h), 'hinge'); });
    li.drawers.forEach(dr => { dr.photoUrl = shopPhotos[photoKeyFor('drawer', dr['Name'])] || ''; dr.visibleRooms = effectiveVisibleRooms(parseVisibleRooms(dr), 'drawer'); });

    const localZone = sorted.find(r=>r.fields['Category']==='zone'&&r.fields['Name']?.toLowerCase().includes('local'));
    li.localRadius = localZone?.['Rate'] || 15;

    const hasDynamic = li.materials.length > 0;

    const specRecords = payload.specialty || [];
    const specs = assignBadges(specRecords
      .map(r=>{
        const visibleRooms = effectiveVisibleRooms(parseVisibleRooms(r.fields), 'specialty');
        return {
          id:r.id,
          label:r.fields['Item name']||r.fields['Special Items'],
          price:r.fields['Price']||0,
          perFt:r.fields['Per linear foot']||false,
          perSqFt:r.fields['Per square foot']||false,
          photoUrl: shopPhotos['spec_' + r.id] || '',
          visibleRooms, // empty array = visible for every room (backward compatible default)
          offersInstallChoice: r.fields['Offers install choice']||false,
          installPrice: r.fields['Install price']||0,
          installMode: r.fields['Install mode']||'supply',
          installPerFt: r.fields['Install per linear foot']||false,
          installPerSqFt: r.fields['Install per square foot']||false,
          installQtyLabel: r.fields['Install quantity label']||'',
          description: r.fields['Description']||'',
          category: r.fields['Category']||'',
        };
      }));

    return { shop, pricing:p, specs, li, hasDynamic, shopPhotos, roomTypes };
  }

  // ============================================================
  // EMAIL & LEAD
  // ============================================================
  // Pro Quoter never creates an Airtable Leads record, and never sends a
  // "new lead" notification — the shop owner isn't a lead, and there's no
  // one else who needs telling. All that's left is optionally emailing a
  // copy of the quote to whatever address they enter, including the real
  // total (not just the customer ballpark range).
  async function saveLead(data, lead, quoteType, low, high, lines, realTotal) {
    const { shop } = data;
    if (lead._isSkip || !lead.email) return;

    const lineRows = (lines||[])
      .filter(l=>l&&l.label&&(l.header||l.cost!==undefined))
      .map(l=>l.header
        ? `<tr><td colspan="2" style="padding:12px 8px 4px;font-weight:700;color:#111;font-size:14px;text-transform:uppercase;letter-spacing:0.04em">${l.label}</td></tr>`
        : `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">${l.label}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;${l.bold?'font-weight:700;color:#111':''}">${'$'}${Math.round(l.cost).toLocaleString()}</td></tr>`
      ).join('');

    await sendEmail(lead.email, `${quoteType} quote — ${shop['Shop name']}`,
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#0f2a52">${quoteType} quote</h2>
        <div style="background:#0f2a52;border-radius:8px;padding:16px;text-align:center;margin-bottom:12px">
          <div style="font-size:14px;color:#fbbf24;margin-bottom:4px">Your real total</div>
          <div style="font-size:28px;font-weight:700;color:#fff">$${Math.round(realTotal||0).toLocaleString()}</div>
        </div>
        <div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;margin-bottom:16px;color:#666;font-size:14px">
          Customer sees this range: $${low.toLocaleString()} – $${high.toLocaleString()}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600" colspan="2">Full breakdown</td></tr>${lineRows}
        </table>
      </div>`);
  }

  async function sendEmail(to, subject, html) {
    if (!CONFIG.EMAIL_WORKER||!to) return;
    try { await fetch(CONFIG.EMAIL_WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,subject,html})}); }
    catch(e) { console.error('Email failed',e); }
  }

  // ============================================================
  // STYLES
  // ============================================================
  function injectStyles(bc) {
    const s = document.createElement('style');
    s.textContent = `
      #midasquote-widget *{box-sizing:border-box;margin:0;padding:0}
      #midasquote-widget{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:900px;margin:20px auto;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.28),0 10px 24px rgba(0,0,0,0.24),0 30px 70px rgba(0,0,0,0.35)}
      @media (max-width:600px){
        #midasquote-widget{margin:0 0 2rem;border-radius:0;max-width:100%;width:100%}
        #midasquote-widget .mq-label{font-size:15px}
        #midasquote-widget .mq-hint{font-size:15px}
        #midasquote-widget .mq-sec-title{font-size:14px}
        #midasquote-widget .mq-header{padding:0.85rem 0.6rem;gap:8px;flex-wrap:wrap}
        #midasquote-widget .mq-header-actions{flex:1 1 100%;justify-content:flex-start;margin-top:4px}
        #midasquote-widget .mq-tab-bar{padding:8px 0.5rem;gap:5px}
        #midasquote-widget .mq-tab{padding:9px 6px;font-size:12.5px}
        /* The measuring guide image is a wide landscape infographic — on a
           narrow phone, the box's own 16px side padding eats into already
           limited width. Bleeding the image past just that padding (not the
           whole page) gives it noticeably more room without a full custom
           per-viewport reflow. */
        #midasquote-widget .mq-measure-guide-img{width:calc(100% + 32px)!important;max-width:calc(100% + 32px)!important;margin-left:-16px!important;margin-right:-16px!important}
      }
      #midasquote-widget .mq-header{display:flex;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid #e5e7eb;gap:12px}
      #midasquote-widget .mq-header-actions{display:flex;gap:8px;flex-shrink:0}
      #midasquote-widget .mq-logo{width:48px;height:48px;border-radius:8px;background:${bc};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;flex-shrink:0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.28)}
      /* A real uploaded logo isn't forced into that square anymore — shown
         at its natural aspect ratio instead, so a wide or tall logo doesn't
         get cropped to fit a square box. Only the no-logo "first letter"
         placeholder above still uses the square/coloured background. */
      #midasquote-widget .mq-logo-real{height:48px;max-width:180px;flex-shrink:0;display:flex;align-items:center}
      #midasquote-widget .mq-logo-real img{max-height:48px;max-width:180px;width:auto;height:auto;object-fit:contain}
      #midasquote-widget .mq-shop-name{font-size:14px;font-weight:600;color:#111}
      #midasquote-widget .mq-shop-sub{font-size:13px;color:#4b5563}
      #midasquote-widget .mq-tab-bar{display:flex;background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:10px 1.5rem;gap:8px}
      #midasquote-widget .mq-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;font-size:14px;font-weight:500;color:#4b5563;cursor:pointer;border:1px solid #e5e7eb;border-radius:8px;background:#fff;transition:all 0.15s;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.10)}
      #midasquote-widget .mq-tab.active{background:${bc};color:#fff;border-color:${bc};box-shadow:0 6px 20px rgba(0,0,0,0.30)}
      #midasquote-widget .mq-tab-icon{font-size:18px;flex-shrink:0}
      #midasquote-widget .mq-tab-label{display:flex;flex-direction:column;align-items:flex-start;gap:1px}
      #midasquote-widget .mq-tab-title{font-size:14px;font-weight:500;line-height:1}
      #midasquote-widget .mq-tab-sub{font-size:10px;opacity:0.7;line-height:1}
      #midasquote-widget .mq-tab-content{display:none;padding:15px}
      #midasquote-widget .mq-tab-content.active{display:block}
      #midasquote-widget .mq-sec{background:#fff;border:1.5px solid #1e3a5f;border-radius:10px;padding:15px;margin-bottom:1rem;box-shadow:0 4px 14px rgba(0,0,0,0.10)}
      #midasquote-widget .mq-sec{border-left:4px solid #0f2a52}
      #midasquote-widget .mq-step-badge{width:22px;height:22px;border-radius:50%;background:#0f2a52;color:#fbbf24;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-family:inherit}
      #midasquote-widget .mq-sec-header-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;cursor:pointer}
      #midasquote-widget .mq-sec-header-row .mq-sec-title{margin-bottom:0}
      #midasquote-widget .mq-collapse-arrow{display:inline-block;transition:transform 0.2s;font-size:12px;color:#6b7280;flex-shrink:0;margin-left:8px}
      #midasquote-widget .mq-collapse-arrow.open{transform:rotate(90deg)}
      #midasquote-widget .mq-sec.mq-step-current{box-shadow:0 0 0 3px #fbbf24,0 4px 14px rgba(0,0,0,0.10);opacity:1}
      #midasquote-widget .mq-sec.mq-step-done{filter:brightness(0.8);transition:filter 0.2s}
      #midasquote-widget .mq-sec.mq-step-upcoming{filter:brightness(0.55);transition:filter 0.2s}
      #midasquote-widget .mq-sec.mq-step-current{transition:box-shadow 0.2s}
      #midasquote-widget .mq-step-footer{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:14px;border-top:1px dashed #e5e7eb}
      #midasquote-widget .mq-step-continue-btn{background:#0f2a52;color:#fbbf24;border:none;border-radius:8px;padding:9px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
      #midasquote-widget .mq-step-back-btn{background:none;border:none;color:#4b5563;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;padding:9px 4px}
      #midasquote-widget .mq-step-done-badge{color:#16a34a;font-size:13px;font-weight:700}
      #midasquote-widget .mq-sec-title{font-size:14px;font-weight:800;color:#1f2937;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1rem}
      #midasquote-widget .mq-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
      #midasquote-widget .mq-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
      #midasquote-widget .mq-field{flex-direction:column;gap:5px;min-width:0}
      #midasquote-widget .mq-label{font-size:15px;color:#374151}
      #midasquote-widget .mq-hint{font-size:14px;color:#4b5563;margin-top:2px;line-height:1.5}
      #midasquote-widget .mq-qty-ctrl input{width:36px!important;padding:2px 4px!important;box-shadow:none!important;border-radius:4px!important}
      #midasquote-widget input[type=number]::-webkit-inner-spin-button,#midasquote-widget input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
      #midasquote-widget input[type=number]{-moz-appearance:textfield}
      #midasquote-widget input:focus,#midasquote-widget select:focus{outline:none;border-color:${bc};box-shadow:0 6px 20px rgba(0,0,0,0.30)}
      #midasquote-widget select,#midasquote-widget input{font-size:16px;font-family:inherit;width:100%}
      #midasquote-widget input{text-indent:8px}
      #midasquote-widget .mq-qty-ctrl input{text-indent:0}
      #midasquote-widget .mq-spec-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}
      #midasquote-widget .mq-spec-item{display:flex;flex-direction:column;gap:8px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;transition:all 0.15s}
      #midasquote-widget .mq-spec-top{display:flex;align-items:center;gap:8px}
      #midasquote-widget .mq-spec-bottom{display:flex;flex-direction:column;align-items:flex-start;gap:3px}
      #midasquote-widget .mq-spec-item.on{background:#0f2a52;border-color:#d97706}
      #midasquote-widget .mq-spec-name{font-size:14px;line-height:1.15;color:#111;flex:1;display:block}
      #midasquote-widget .mq-spec-category-heading{color:${bc}}
      #midasquote-widget .mq-spec-category-group{border:1.5px solid #e0e0e0;border-radius:12px;padding:12px 14px 14px;background:#fafafa;box-shadow:0 8px 20px rgba(0,0,0,0.12),0 2px 6px rgba(0,0,0,0.08)}
      #midasquote-widget .mq-spec-category-heading{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px}
      #midasquote-widget .mq-spec-category-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}
      #midasquote-widget .mq-spec-item.on .mq-spec-name{color:#fbbf24;font-weight:600}
      #midasquote-widget .mq-spec-thumb{width:96px;height:96px;border-radius:6px;object-fit:contain;flex-shrink:0;cursor:zoom-in;border:1px solid #e5e7eb;background:#f3f4f6}
      #midasquote-widget .mq-spec-thumb-placeholder{width:96px;height:96px;border-radius:6px;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:20px;color:#6b7280;border:1px solid #e5e7eb}
      #midasquote-widget .mq-vpicker-row{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
      #midasquote-widget .mq-vpicker-chip{flex-shrink:0;width:110px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;font-family:inherit;transition:all 0.15s}
      #midasquote-widget .mq-vpicker-chip.selected{border-color:${bc};background:${bc}0d}
      #midasquote-widget .mq-spec-mode-select{cursor:pointer}
      #midasquote-widget .mq-spec-mode-select option[value=""]{color:#9ca3af}
      @keyframes mqShakeChoice{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
      #midasquote-widget .mq-spec-mode-select.mq-needs-choice{animation:mqShakeChoice 0.4s ease;border-color:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,0.15)}
      #midasquote-widget input.mq-needs-choice{animation:mqShakeChoice 0.4s ease;border-color:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,0.15)}
      #midasquote-widget .mq-vpicker-thumb{width:96px;height:96px;border-radius:6px;object-fit:contain;background:#f3f4f6}
      #midasquote-widget .mq-vpicker-thumb-placeholder{width:96px;height:96px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:20px;color:#6b7280}
      #midasquote-widget .mq-vpicker-label{font-size:10px;color:#374151;text-align:center;line-height:1.2;word-break:break-word;max-width:100%}
      #midasquote-widget .mq-vpicker-chip.selected .mq-vpicker-label{color:${bc};font-weight:600}
      #midasquote-widget .mq-vpicker-group-note{font-size:9px;color:#16a34a;text-align:center;line-height:1.25;margin-top:2px;max-width:100%}
      #midasquote-widget .mq-vpicker-select-btn{margin-top:5px;font-size:10px;font-weight:600;padding:4px 10px;border-radius:12px;border:1px solid #d1d5db;background:#fff;color:#374151;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all 0.15s}
      #midasquote-widget .mq-vpicker-chip.selected .mq-vpicker-select-btn{background:${bc};border-color:${bc};color:#fff}
      #midasquote-widget .mq-vpicker-chip.mq-suggested{box-shadow:0 0 0 2px #bbf7d0}
      #midasquote-widget .mq-vpicker-thumb{cursor:zoom-in}
      #midasquote-widget .mq-vpicker-thumb-placeholder{cursor:default}
      #midasquote-widget .mq-vpicker-badge{position:absolute;top:-6px;right:-6px;font-size:9px;font-weight:700;padding:2px 5px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.25);pointer-events:none}
      #midasquote-widget .mq-vpicker-badge-1{background:#dcfce7;color:#166534}
      #midasquote-widget .mq-vpicker-badge-2{background:#fef3c7;color:#92400e}
      #midasquote-widget .mq-vpicker-badge-3{background:linear-gradient(135deg,#f0d488,#d4af37);color:#1a1a1a;border:1px solid #b8901f}
      #midasquote-widget .mq-qty-ctrl{display:flex;align-items:center;gap:4px}
      #midasquote-widget .mq-qty-btn{width:22px;height:22px;border:1px solid #d1d5db;border-radius:4px;background:#fff;color:#111;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit}
      #midasquote-widget .mq-qty-val{font-size:14px;font-weight:500;min-width:16px;text-align:center}
      #midasquote-widget .mq-tog-row{display:flex;align-items:center;gap:10px;margin:1rem 0 0.75rem;padding:10px 12px;background:#f9fafb;border-radius:8px;cursor:pointer}
      #midasquote-widget .mq-tog{width:36px !important;height:20px !important;background:#d1d5db !important;border-radius:10px !important;position:relative !important;display:inline-block !important;transition:background 0.2s;flex-shrink:0}
      #midasquote-widget .mq-tog.on{background:${bc} !important}
      #midasquote-widget .mq-tog::after{content:'' !important;position:absolute !important;width:16px !important;height:16px !important;background:#fff !important;border-radius:50% !important;top:2px !important;left:2px !important;transition:left 0.2s}
      #midasquote-widget .mq-tog.on::after{left:18px !important}
      #midasquote-widget .mq-sub-sec{background:#f9fafb;border-radius:8px;padding:1rem;margin-top:0.75rem;border-left:4px solid #d1d5db}
      #midasquote-widget .mq-sub-sec.mq-sub-upper{border-left-color:#d97706;background:#fffbeb}
      #midasquote-widget .mq-sub-sec.mq-sub-base{border-left-color:#f59e0b;background:#fffbeb}
      #midasquote-widget .mq-sub-title{font-size:15px;font-weight:700;color:#111;margin:0 0 0.85rem;display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1px solid rgba(0,0,0,0.08)}
      #midasquote-widget .mq-calc-btn{width:100%;padding:13px;font-size:15px;font-weight:600;background:${bc};color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:0.5rem;transition:opacity 0.15s;font-family:inherit;box-shadow:0 6px 20px rgba(0,0,0,0.25)}
      #midasquote-widget .mq-calc-btn:hover{opacity:0.88}
      #midasquote-widget .mq-calc-btn:disabled{opacity:0.4;cursor:not-allowed}
      @keyframes mqCalcPulse{0%,100%{box-shadow:0 6px 20px rgba(0,0,0,0.25)}50%{box-shadow:0 0 0 7px ${bc}66,0 6px 20px rgba(0,0,0,0.25)}}
      #midasquote-widget .mq-calc-btn.mq-calc-btn-pulse{animation:mqCalcPulse 0.8s ease 2}
      #midasquote-widget .mq-calc-btn-both{background:linear-gradient(135deg,${bc},#d97706)}
      #midasquote-widget .mq-result{display:none;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1.25rem;margin-top:1rem;box-shadow:0 6px 24px rgba(0,0,0,0.12)}
      #midasquote-widget .mq-result.show{display:block}
      #midasquote-widget .mq-res-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid #e5e7eb}
      #midasquote-widget .mq-res-title{font-size:15px;font-weight:600;color:#111;margin-bottom:3px}
      #midasquote-widget .mq-res-sub{font-size:14px;color:#4b5563}
      #midasquote-widget .mq-res-range{font-size:22px;font-weight:700;color:${bc};text-align:right}
      #midasquote-widget .mq-res-range-lbl{font-size:13px;color:#4b5563;text-align:right}
      #midasquote-widget .mq-line-items{list-style:none;padding:0;margin:0 0 1rem}
      #midasquote-widget .mq-line-items li{display:flex;justify-content:space-between;font-size:14px;padding:6px 0;border-bottom:1px solid #f3f4f6}
      #midasquote-widget .mq-line-items li:last-child{border-bottom:none}
      #midasquote-widget .mq-li-lbl{color:#4b5563}
      #midasquote-widget .mq-disclaimer{font-size:13px;color:#4b5563;background:#f9fafb;border-radius:6px;padding:10px 12px;margin-top:1rem;line-height:1.5}
      #midasquote-widget .mq-travel-note{font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;margin-top:8px;line-height:1.5}
      #midasquote-widget .mq-powered-by{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:14px;padding-top:12px;border-top:1px solid #f0f0f0;font-size:12px;color:#6b7280;letter-spacing:0.01em}
      #midasquote-widget .mq-powered-by a{color:#6b7280;text-decoration:none;font-weight:500;transition:color 0.15s}
      #midasquote-widget .mq-powered-by a:hover{color:#1a1a1a}
      #midasquote-widget .mq-powered-by svg{opacity:0.45}
      #midasquote-widget .mq-financing-note{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:10px;font-size:13px;font-weight:600;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px}
      #midasquote-widget .mq-cta-row{display:flex;gap:8px;margin-top:1rem}
      #midasquote-widget .mq-cta-row button{flex:1;padding:10px;font-size:14px;font-weight:500;border-radius:8px;cursor:pointer;border:1px solid #d1d5db;background:#fff;color:#111;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
      #midasquote-widget .mq-pri{background:${bc}!important;color:#fff!important;border-color:${bc}!important}
      #midasquote-widget .mq-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center;padding:1rem}
      #midasquote-widget .mq-overlay.show{display:flex}
      #midasquote-widget .mq-modal{background:#f8faff;border-radius:12px;padding:1.5rem;width:90%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.18);position:relative;margin:auto}
      #midasquote-widget .mq-modal-title{font-size:16px;font-weight:600;color:#111;margin-bottom:4px}
      #midasquote-widget .mq-modal-sub{font-size:14px;color:#4b5563;margin-bottom:1.25rem;line-height:1.5}
      #midasquote-widget .mq-modal-fields{display:flex;flex-direction:column;gap:10px;margin-bottom:1.25rem}
      #midasquote-widget .mq-modal-btn{width:100%;padding:11px;font-size:14px;font-weight:600;background:${bc};color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit}
      #midasquote-widget .mq-modal-skip{width:100%;padding:8px;font-size:14px;color:#4b5563;background:none;border:none;cursor:pointer;margin-top:6px;font-family:inherit}
      #midasquote-widget .mq-surface-card{border:1px solid #e5e7eb;border-radius:10px;padding:1rem;margin-bottom:10px}
      #midasquote-widget .mq-surface-header{display:flex;align-items:center;gap:8px;margin-bottom:1rem}
      #midasquote-widget .mq-surface-num{width:24px;height:24px;border-radius:50%;background:${bc};color:#fff;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      #midasquote-widget .mq-remove-btn{font-size:13px;color:#4b5563;background:none;border:1px solid #e5e7eb;border-radius:6px;padding:3px 10px;cursor:pointer;font-family:inherit}
      #midasquote-widget .mq-add-surface-btn{width:100%;padding:10px;font-size:14px;border:1px dashed #d1d5db;border-radius:8px;background:none;color:#4b5563;cursor:pointer;margin-top:4px;font-family:inherit}
      #midasquote-widget .mq-divider{height:1px;background:#e5e7eb;margin:1rem 0}
      #midasquote-widget .mq-check-row{display:flex;align-items:center;gap:8px;font-size:14px;color:#111;cursor:pointer;padding:5px 0}
      #midasquote-widget .mq-loading{display:none;text-align:center;padding:2rem;color:#4b5563;font-size:14px}
      #midasquote-widget .mq-loading.show{display:block}
      #midasquote-widget .mq-both-divider{display:flex;align-items:center;gap:12px;margin:1.5rem 0 1rem}
      #midasquote-widget .mq-both-divider-line{flex:1;height:1px;background:#e5e7eb}
      #midasquote-widget .mq-both-divider-label{font-size:13px;font-weight:600;color:#4b5563;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;padding:4px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:20px}
      #midasquote-widget .mq-combined-result{display:none;background:linear-gradient(135deg,#f0fdf4,#fffbeb);border:1px solid #86efac;border-radius:10px;padding:1.5rem;margin-top:1rem;box-shadow:0 6px 24px rgba(0,0,0,0.10)}
      #midasquote-widget .mq-combined-result.show{display:block}
      #midasquote-widget .mq-combined-title{font-size:14px;font-weight:600;color:#166534;margin-bottom:1rem}
      #midasquote-widget .mq-combined-section{margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(134,239,172,0.5)}
      #midasquote-widget .mq-combined-section:last-of-type{border-bottom:none;margin-bottom:0;padding-bottom:0}
      #midasquote-widget .mq-combined-section-title{font-size:12px;font-weight:600;color:#4b5563;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px}
      #midasquote-widget .mq-combined-row{display:flex;justify-content:space-between;font-size:14px;padding:4px 0}
      #midasquote-widget .mq-combined-row .mq-clbl{color:#4b5563}
      #midasquote-widget .mq-combined-subtotal{display:none}
      #midasquote-widget .mq-grand-total{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;background:#fff;border-radius:8px;margin-top:1rem;border:1px solid #86efac;box-shadow:0 4px 16px rgba(134,239,172,0.35)}
      #midasquote-widget .mq-grand-label{font-size:15px;font-weight:600;color:#111}
      #midasquote-widget .mq-grand-sub{font-size:13px;color:#4b5563;margin-top:2px}
      #midasquote-widget .mq-grand-val{font-size:26px;font-weight:700;color:${bc};text-align:right}
      .mq-lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:100000;align-items:center;justify-content:center;padding:1.5rem;cursor:zoom-out;flex-direction:column;gap:0.75rem}
      .mq-hover-preview{display:none;position:fixed;z-index:100001;background:#fff;border-radius:10px;padding:8px;box-shadow:0 12px 32px rgba(0,0,0,0.28);pointer-events:none}
      .mq-hover-preview.show{display:block}
      .mq-hover-preview img{display:block;max-width:180px;max-height:180px;border-radius:6px;object-fit:contain}
      .mq-hover-preview .mq-hp-label{font-size:12px;color:#374151;text-align:center;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:180px}
      .mq-lightbox.show{display:flex}
      .mq-lightbox img{max-width:100%;max-height:75vh;object-fit:contain;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
      .mq-lightbox-label{color:#fff;font-size:14px;font-weight:500;text-align:center}
      .mq-lightbox-hint{color:rgba(255,255,255,0.45);font-size:12px}
    `;
    document.head.appendChild(s);
  }

  // ============================================================
  // MODULE-LEVEL CT_MAT — populated before buildWidgetHTML runs
  // ============================================================
  let CT_MAT = {};

  // Countertop installation is priced independently from cabinet installation
  // (a shop could sub out cabinet install but do their own countertop work,
  // or vice versa) — this is the shared check both the Both-tab countertop
  // field and each Additional Surface's install field use.
  function hasCountertopInstall() {
    return Object.values(CT_MAT).some(m => (m.pi||0) > 0);
  }

  function buildCTMAT(data) {
    const { li, pricing, shopPhotos } = data;
    CT_MAT = {};
    const hasDynamicCT = li.countertopItems.length > 0;
    if (hasDynamicCT) {
      li.countertopItems
        .filter(item => {
          const desc = item['Description']||'';
          return desc.includes('type:material') || (!desc.includes('type:backsplash') && !desc.includes('type:cutout'));
        })
        .forEach((item, i) => {
          const unitParts = (item['Unit']||'sqft|sqft').split('|');
          let bsOptions = [];
          try { bsOptions = item['Backsplash options'] ? JSON.parse(item['Backsplash options']) : []; } catch(e) { bsOptions = []; }
          let cutoutOptions = [];
          try { cutoutOptions = item['Cutout options'] ? JSON.parse(item['Cutout options']) : []; } catch(e) { cutoutOptions = []; }
          // Fall back to older flat sink/cooktop fields if this material predates
          // the Cutout options list format.
          if (!cutoutOptions.length && (item['Sink cutout rate']!=null || item['Cooktop cutout rate']!=null)) {
            cutoutOptions = [
              {label:'Sink cutout', rate:item['Sink cutout rate']!=null?item['Sink cutout rate']:180},
              {label:'Cooktop cutout', rate:item['Cooktop cutout rate']!=null?item['Cooktop cutout rate']:220},
            ];
          }
          CT_MAT[`ct_${i}`] = {
            label:       item['Name'],
            ps:          item['Rate']||0,
            pi:          item['Install rate']||0,
            supplyUnit:  (unitParts[0]||'sqft').trim(),
            installUnit: (unitParts[1]||'sqft').trim(),
            bsOptions:   Array.isArray(bsOptions) ? bsOptions : [],
            cutoutOptions: Array.isArray(cutoutOptions) ? cutoutOptions : [],
            photoUrl:    (shopPhotos||{})[photoKeyFor('countertop', item['Name'])] || '',
            visibleRooms: effectiveVisibleRooms(parseVisibleRooms(item), 'countertop'),
            groupName:   (item['Group name']||'').trim(),
            groupOrder:  item['Group sort order']||0,
            groupDesc:   item['Group description']||'',
          };
        });
    } else {
      const legacyBs = [{label:'4" standard', heightIn:4, installRate:pricing['Backsplash rate']||12}];
      const legacyCutouts = [{label:'Sink cutout', rate:pricing['Sink cutout']||180}, {label:'Cooktop cutout', rate:pricing['Cooktop cutout']||220}];
      CT_MAT['lam']       = {label:'Laminate',                ps:pricing['Lam supply']||18,   pi:12, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
      CT_MAT['ss_econ']   = {label:'Solid surface — Economy', ps:pricing['SS econ supply']||38, pi:18, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
      CT_MAT['ss_mid']    = {label:'Solid surface — Mid',     ps:pricing['SS mid supply']||58,  pi:18, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
      CT_MAT['ss_prem']   = {label:'Solid surface — Premium', ps:pricing['SS prem supply']||90, pi:22, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
      CT_MAT['gran_econ'] = {label:'Granite — Economy',       ps:pricing['Gran econ supply']||45,  pi:25, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
      CT_MAT['gran_mid']  = {label:'Granite — Mid',           ps:pricing['Gran mid supply']||72,   pi:25, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
      CT_MAT['gran_prem'] = {label:'Granite — Premium',       ps:pricing['Gran prem supply']||130, pi:30, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
      CT_MAT['quartz']    = {label:'Engineered quartz',       ps:pricing['Quartz supply']||85,  pi:25, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
      CT_MAT['marble']    = {label:'Marble',                  ps:pricing['Marble supply']||110, pi:30, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
      CT_MAT['butcher']   = {label:'Butcher block',           ps:pricing['Butcher supply']||42, pi:18, supplyUnit:'sqft', installUnit:'sqft', bsOptions:legacyBs, cutoutOptions:legacyCutouts};
    }
  }

  let TRIM = {};
  function buildTRIM(data) {
    const { li, shopPhotos } = data;
    TRIM = {};
    (li.trimItems || []).forEach((item, i) => {
      let linkedDoors = [];
      try { linkedDoors = item['Linked door style'] ? JSON.parse(item['Linked door style']) : []; } catch(e) { linkedDoors = []; }
      const type = item['Trim type']||'crown';
      TRIM[`trim_${i}`] = {
        label:       item['Name'],
        ps:          item['Rate']||0,
        pi:          item['Install rate']||0,
        type:        type,
        linkedDoors: linkedDoors,
        // Dashboard groups crown/valance into separate pseudo-categories
        // (trim_crown / trim_valance) for photo purposes, not just "trim"
        photoUrl:    (shopPhotos||{})[photoKeyFor(`trim_${type}`, item['Name'])] || '',
        visibleRooms: effectiveVisibleRooms(parseVisibleRooms(item), `trim_${type}`),
        groupName:   (item['Group name']||'').trim(),
        groupOrder:  item['Group sort order']||0,
        groupDesc:   item['Group description']||'',
      };
    });
  }

  function trimOpts(type) {
    const opts = Object.entries(TRIM)
      .filter(([k,t]) => t.type === type)
      .map(([k,t])=>`<option value="${k}">${t.label}</option>`).join('');
    return `<option value="none">None</option>` + opts;
  }

  // ── Tall cabinets ──
  let TALL_CAB = {};
  function buildTALLCAB(data) {
    const { li, shopPhotos } = data;
    TALL_CAB = {};
    (li.tallCabItems || []).filter(item => item['Active'] !== false).forEach((item, i) => {
      TALL_CAB[`tc_${i}`] = {
        label: item['Name'],
        basePrice: item['Rate'] || 0,
        photoUrl: (shopPhotos||{})[photoKeyFor('tall_cabinet', item['Name'])] || '',
        visibleRooms: effectiveVisibleRooms(parseVisibleRooms(item), 'tall_cabinet'),
      };
    });
  }

  function tallCabOpts() {
    return `<option value="none">None</option>` + Object.entries(TALL_CAB).map(([k,t]) => `<option value="${k}">${t.label}</option>`).join('');
  }

  function tallCabItems() {
    return sortAndBadgeItems([{value:'none', label:'None', icon:'🚫'}].concat(
      Object.entries(TALL_CAB).map(([k,t])=>({value:k, label:t.label, photoUrl:t.photoUrl, icon:'🏛️', price:t.basePrice||0, visibleRooms:t.visibleRooms||[]}))
    ));
  }

  function ctMatOpts() {
    return Object.entries(CT_MAT).map(([k,m])=>`<option value="${k}">${m.label}</option>`).join('') ||
      `<option value="lam">Laminate</option>`;
  }

  function ctMatItems() {
    const entries = Object.entries(CT_MAT);
    return entries.length
      ? sortBadgeAndGroupItems(entries.map(([k,m])=>({value:k, label:m.label, photoUrl:m.photoUrl, icon:'🪨', price:(m.ps||0)+(m.pi||0), visibleRooms:m.visibleRooms||[], groupName:m.groupName||'', groupOrder:m.groupOrder||0, groupDesc:m.groupDesc||''})))
      : [{value:'lam', label:'Laminate', icon:'🪨'}];
  }

  // ============================================================
  // BUILD WIDGET HTML
  // ============================================================
  function makeOpts(items, fallbackOpts) {
    if (items && items.length > 0) return items.map((m,i)=>`<option value="dyn_${i}">${m._baseName || m['Name']}</option>`).join('');
    return fallbackOpts || '';
  }

  // Lightbox for enlarging specialty item photos — same pattern as the
  // showroom page, kept inline here so it works without leaving the widget.
  // If a shop's logo image fails to load (broken URL, expired hosting,
  // whatever) — fall back to the plain letter avatar instead of leaving a
  // broken-image icon with wrapped alt text on screen.
  window.mqHandleLogoError = function(imgEl, brandColor, firstLetter) {
    const wrap = imgEl.parentElement;
    if (!wrap) return;
    wrap.className = 'mq-logo';
    wrap.style.background = brandColor;
    wrap.innerHTML = `<span>${firstLetter}</span>`;
  };

  window.mqPhotoLightbox = function(src, label) {
    let lb = document.getElementById('mq-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'mq-lightbox';
      lb.className = 'mq-lightbox';
      lb.onclick = () => lb.classList.remove('show');
      lb.innerHTML = `
        <img id="mq-lightbox-img" src=""/>
        <div class="mq-lightbox-label" id="mq-lightbox-label"></div>
        <div class="mq-lightbox-hint">Tap anywhere to close</div>`;
      // Appended to document.body (not the widget container) so position:fixed
      // can't be broken by a transformed ancestor somewhere in the host page —
      // same fix already used for the hover preview.
      document.body.appendChild(lb);
    }
    document.getElementById('mq-lightbox-img').src = src;
    document.getElementById('mq-lightbox-label').textContent = label || '';
    lb.classList.add('show');
  };

  // Desktop-only hover preview — appended to document.body (not inside the
  // widget) so the picker row's horizontal scroll container can't clip it.
  // Gated by a real hover+fine-pointer check so touch devices never trigger it,
  // even if a stray mouseenter-style event fires on tap.
  let _mqHoverPreviewEl = null;
  function ensureHoverPreview() {
    if (_mqHoverPreviewEl) return _mqHoverPreviewEl;
    _mqHoverPreviewEl = document.createElement('div');
    _mqHoverPreviewEl.className = 'mq-hover-preview';
    _mqHoverPreviewEl.innerHTML = `<img/><div class="mq-hp-label"></div>`;
    document.body.appendChild(_mqHoverPreviewEl);
    return _mqHoverPreviewEl;
  }
  window.mqHoverPreviewShow = function(chipEl, photoUrl, label) {
    if (!photoUrl) return;
    if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const preview = ensureHoverPreview();
    preview.querySelector('img').src = photoUrl;
    preview.querySelector('.mq-hp-label').textContent = label || '';
    const rect = chipEl.getBoundingClientRect();
    const showAbove = rect.top > 210; // enough room above; otherwise fall back to below
    preview.style.left = Math.min(Math.max(rect.left + rect.width/2, 100), window.innerWidth - 100) + 'px';
    if (showAbove) {
      preview.style.top = (rect.top - 8) + 'px';
      preview.style.transform = 'translate(-50%, -100%)';
    } else {
      preview.style.top = (rect.bottom + 8) + 'px';
      preview.style.transform = 'translate(-50%, 0)';
    }
    preview.classList.add('show');
  };
  window.mqHoverPreviewHide = function() {
    if (_mqHoverPreviewEl) _mqHoverPreviewEl.classList.remove('show');
  };

  // Visual chip picker for materials/doors/hinges. Renders a horizontally
  // scrollable row of thumbnail+label chips. A hidden <select> with the same
  // id/options sits alongside it so every existing gv()/onchange reference
  // elsewhere in the file keeps working completely untouched — clicking a
  // chip just sets that hidden select's value and fires a real 'change' event.
  // Sorts real (priced) items cheapest-first and assigns a $/$$/$$$ badge so
  // customers can tell at a glance which options cost more. A "None" item (if
  // present) is pinned first with no badge — it's not really a "priced" option.
  // Badge rules: all same price -> everyone gets a single $. 2 items -> $ / $$$
  // (no middle tier with only 2 points). 3 items -> $ / $$ / $$$ one each.
  // 4+ items -> split by price RANGE into thirds (not by item count), so a
  // tight cluster of similar prices doesn't get artificially split apart.
  function assignBadges(realItems) {
    if (!realItems.length) return realItems;
    const sorted = [...realItems].sort((a,b)=>a.price-b.price);
    const allEqual = sorted.every(it => it.price === sorted[0].price);
    if (allEqual) { sorted.forEach(it => it.badge = '$'); return sorted; }
    const n = sorted.length;
    if (n === 2) { sorted[0].badge='$'; sorted[1].badge='$$$'; }
    else if (n === 3) { sorted[0].badge='$'; sorted[1].badge='$$'; sorted[2].badge='$$$'; }
    else {
      const min = sorted[0].price, max = sorted[n-1].price, range = max-min;
      const b1 = min + range/3, b2 = min + 2*range/3;
      sorted.forEach(it => { it.badge = it.price<=b1 ? '$' : (it.price<=b2 ? '$$' : '$$$'); });
    }
    return sorted;
  }
  function sortAndBadgeItems(items) {
    const noneItem = items.find(it => it.value === 'none');
    const realItems = items.filter(it => it.value !== 'none');
    const badged = assignBadges(realItems);
    return noneItem ? [noneItem, ...badged] : badged;
  }

  // Clusters items sharing a Group name together (shop-owner-controlled
  // order first, then any ungrouped leftovers last, sorted cheapest-first
  // within each cluster), and flags a cluster whose members all cost the
  // exact same so the chip can show a quick reassurance note. Runs after
  // badges are already assigned, so it only ever reorders — price badges
  // still reflect standing across the whole list. No-op if nothing's grouped.
  function applyItemGrouping(items) {
    if (!items.some(it => it.groupName)) return items;
    const groupNames = [...new Set(items.filter(it => it.groupName).map(it => it.groupName))];
    const groups = groupNames.map(name => {
      const members = items.filter(it => it.groupName === name).sort((a,b) => a.price - b.price);
      const allSamePrice = members.length > 1 && members.every(m => m.price === members[0].price);
      if (allSamePrice) members.forEach(m => m.samePriceNote = true);
      const order = members.find(m => m.groupOrder)?.groupOrder || 0;
      return { order, members };
    }).sort((a,b) => a.order - b.order);
    const ungrouped = items.filter(it => !it.groupName).sort((a,b) => a.price - b.price);
    return [...groups.flatMap(g => g.members), ...ungrouped];
  }

  // sortAndBadgeItems already pins a "none"/"no doors" item first — grouping
  // only ever applies to the real, priced options after that.
  function sortBadgeAndGroupItems(items) {
    const sorted = sortAndBadgeItems(items);
    const noneItem = sorted.find(it => it.value === 'none');
    const rest = sorted.filter(it => it.value !== 'none');
    const grouped = applyItemGrouping(rest);
    return noneItem ? [noneItem, ...grouped] : grouped;
  }

  function pickerRow(selectId, items, extraOnChangeAttr, category) {
    const hasAnyGroup = items.some(it => it.groupName);
    const groupNames = hasAnyGroup ? [...new Set(items.filter(it => it.groupName).map(it => it.groupName))] : [];
    const hasOtherBucket = hasAnyGroup && items.some(it => it.value !== 'none' && !it.groupName);
    const groupDescOf = (name) => (items.find(it => it.groupName === name && it.groupDesc)?.groupDesc || '');
    const pickerLabel = ((window._mqCategoryPickerLabels||{})[category] || '').trim() || 'Pick a collection';
    const totalRealCount = items.filter(it => it.value !== 'none').length;
    const countOf = (name) => name === '__other__'
      ? items.filter(it => it.value !== 'none' && !it.groupName).length
      : items.filter(it => it.groupName === name).length;
    const countNote = (name) => `Showing ${countOf(name)} of ${totalRealCount} total — pick a different collection above to see the rest`;
    if (hasAnyGroup) {
      window._mqGroupFilter = window._mqGroupFilter || {};
      window._mqGroupFilter[selectId] = groupNames[0];
    }
    // Pro has its own fixed navy/gold theme regardless of shop branding, so
    // this uses that same navy directly rather than a per-shop color.
    const focal = '#0f2a52';
    const focalTint = '#eef2f7';
    const groupDropdown = hasAnyGroup ? `
      <div style="margin-bottom:10px;background:${focalTint};border:1.5px solid ${focal};border-radius:10px;padding:12px 14px">
        <label style="font-size:14px;font-weight:700;color:${focal};display:flex;align-items:center;gap:6px;margin-bottom:8px">🗂️ ${pickerLabel}</label>
        <select onchange="mqFilterPickerByGroup('${selectId}',this.value,this.selectedOptions[0]?this.selectedOptions[0].dataset.desc:'',this.selectedOptions[0]?this.selectedOptions[0].dataset.count:'')" style="font-size:14px;font-weight:600;padding:8px 30px 8px 12px;border:1.5px solid ${focal};border-radius:6px;width:auto;max-width:100%;display:inline-block;color:#111;background:#fff">
          ${groupNames.map(g=>`<option value="${g.replace(/"/g,'&quot;')}" data-desc="${groupDescOf(g).replace(/"/g,'&quot;')}" data-count="${countOf(g)}">${g}</option>`).join('')}
          ${hasOtherBucket ? `<option value="__other__" data-desc="" data-count="${countOf('__other__')}">Other</option>` : ''}
        </select>
        <div id="mq-groupcount-${selectId}" style="font-size:12px;font-weight:600;color:${focal};margin-top:8px">${countNote(groupNames[0])}</div>
        <div id="mq-groupdesc-${selectId}" style="font-size:12px;color:#6b7280;margin:4px 0 0;line-height:1.5">${groupDescOf(groupNames[0])}</div>
      </div>` : '';
    const chips = items.map((it,i)=>{
      const safePhoto = (it.photoUrl||'').replace(/'/g,"\\'");
      const safeLabel = (it.label||'').replace(/'/g,"\\'");
      const thumb = it.photoUrl
        ? `<img class="mq-vpicker-thumb" src="${it.photoUrl}" alt="${it.label}" onclick="event.stopPropagation();mqPhotoLightbox('${safePhoto}','${safeLabel}')" onerror="this.outerHTML='<div class=\\'mq-vpicker-thumb-placeholder\\'>${it.icon||'🎨'}</div>'"/>`
        : `<div class="mq-vpicker-thumb-placeholder">${it.icon||'🎨'}</div>`;
      const badgeHtml = it.badge ? `<span class="mq-vpicker-badge mq-vpicker-badge-${it.badge.length}">${it.badge}</span>` : '';
      const selectedClass = i===0 ? ' selected' : '';
      const selectBtnLabel = i===0 ? '✓ Selected' : 'Select';
      const roomsAttr = JSON.stringify(it.visibleRooms||[]).replace(/"/g,'&quot;');
      const groupNote = it.samePriceNote ? `<span class="mq-vpicker-group-note">✓ Same price as other ${(it.groupName||'').replace(/'/g,"\\'")} options</span>` : '';
      const groupAttr = it.value==='none' ? '__always__' : (it.groupName || (hasAnyGroup ? '__other__' : ''));
      return `<div class="mq-vpicker-chip${selectedClass}" data-vpicker-for="${selectId}" data-value="${it.value}" data-rooms="${roomsAttr}" data-group="${groupAttr}" onmouseenter="mqHoverPreviewShow(this,'${safePhoto}','${safeLabel}')" onmouseleave="mqHoverPreviewHide()"><div style="position:relative">${thumb}${badgeHtml}</div><span class="mq-vpicker-label">${it.label}</span>${groupNote}<button type="button" class="mq-vpicker-select-btn" onclick="mqPickVisual('${selectId}',this)">${selectBtnLabel}</button></div>`;
    }).join('');
    return `${groupDropdown}<div class="mq-vpicker-row" id="mq-vprow-${selectId}">${chips}</div>`;
  }

  window.mqFilterPickerByGroup = function(selectId, groupValue, desc, count) {
    window._mqGroupFilter = window._mqGroupFilter || {};
    window._mqGroupFilter[selectId] = groupValue;
    const descEl = document.getElementById(`mq-groupdesc-${selectId}`);
    if (descEl) descEl.textContent = desc || '';
    const countEl = document.getElementById(`mq-groupcount-${selectId}`);
    if (countEl) {
      const row = document.getElementById(`mq-vprow-${selectId}`);
      const total = row ? row.querySelectorAll('.mq-vpicker-chip[data-value]:not([data-value="none"])').length : 0;
      countEl.textContent = `Showing ${count||0} of ${total} total — pick a different collection above to see the rest`;
    }
    const m = selectId.match(/^mq-(c|b)-/);
    if (m) window.mqRefreshAllPickerVisibility(m[1]);
  };

  window.mqPickVisual = function(selectId, btnEl) {
    const chipEl = btnEl.closest('.mq-vpicker-chip');
    const sel = document.getElementById(selectId);
    if (!sel || !chipEl) return;
    sel.value = chipEl.getAttribute('data-value');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelectorAll(`[data-vpicker-for="${selectId}"]`).forEach(c => {
      c.classList.remove('selected');
      const b = c.querySelector('.mq-vpicker-select-btn');
      if (b) b.textContent = 'Select';
    });
    chipEl.classList.add('selected');
    btnEl.textContent = '✓ Selected';
  };

  function specHTML(specs, prefix) {
    if (!specs.length) return '<p style="font-size:14px;color:#4b5563">No specialty items configured yet.</p>';

    const buildCard = (s,i) => {
      const safeLabel = (s.label||'').replace(/'/g,"\\'");
      const thumb = s.photoUrl
        ? `<img class="mq-spec-thumb" src="${s.photoUrl}" alt="${s.label}" onclick="event.stopPropagation();mqPhotoLightbox('${s.photoUrl.replace(/'/g,"\\'")}','${safeLabel}')" onmouseenter="mqHoverPreviewShow(this,'${s.photoUrl.replace(/'/g,"\\'")}','${safeLabel}')" onmouseleave="mqHoverPreviewHide()" onerror="this.outerHTML='<div class=\\'mq-spec-thumb-placeholder\\'>⭐</div>'"/>`
        : `<div class="mq-spec-thumb-placeholder">⭐</div>`;
      const badgeHtml = s.badge ? `<span class="mq-vpicker-badge mq-vpicker-badge-${s.badge.length}" style="position:absolute;top:-6px;right:-6px">${s.badge}</span>` : '';
      const roomsAttr = JSON.stringify(s.visibleRooms||[]).replace(/"/g,'&quot;');
      const specUnitKind = (perFt, perSqFt) => perFt ? 'linear' : (perSqFt ? 'sqft' : 'item');
      const installDiffers = s.offersInstallChoice && specUnitKind(s.perFt, s.perSqFt) !== specUnitKind(s.installPerFt, s.installPerSqFt);
      const installModeHtml = s.offersInstallChoice
        ? `<select id="mq-spec-mode-${prefix}-${i}" class="mq-spec-mode-select" style="font-size:11px;padding:4px 6px;border:1.5px solid #d1d5db;border-radius:5px;margin-top:4px;width:100%;background:#fff;color:#111;font-weight:600" onchange="mqSpecModeChanged('${prefix}',${i})">
            <option value="" selected disabled>Choose one</option>
            <option value="supply">Supply only</option>
            <option value="install">Supplied &amp; Installed</option>
          </select>`
        : (s.installMode === 'na' ? '' : `<div style="font-size:11px;color:#6b7280;margin-top:2px">${s.installMode === 'installed' ? 'Supplied & Installed' : 'Supply only'}</div>`);
      const installQtyRowHtml = installDiffers ? `
        <div id="mq-spec-installqty-${prefix}-${i}" style="display:none;margin-top:6px;padding-top:6px;border-top:1px dashed #e5e7eb">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${s.installQtyLabel || 'How many of these need to be installed?'}</div>
          <div class="mq-qty-ctrl">
            <button class="mq-qty-btn" onclick="mqAdjInstallQty('${prefix}',${i},-1)">−</button>
            <input type="text" inputmode="${s.installPerFt||s.installPerSqFt?'decimal':'numeric'}" pattern="${s.installPerFt||s.installPerSqFt?'[0-9]*\\.?[0-9]*':'[0-9]*'}" id="mq-installqty-${prefix}-${i}" value="0" style="width:36px;text-align:center;font-size:14px;font-weight:500;border:1px solid #d1d5db;border-radius:4px;padding:2px 4px;font-family:inherit;box-shadow:none" oninput="mqSetInstallQty('${prefix}',${i},this.value)" onclick="this.select()"/>
            <button class="mq-qty-btn" onclick="mqAdjInstallQty('${prefix}',${i},1)">+</button>
            ${s.installPerSqFt ? calcBtn(`mq-installqty-${prefix}-${i}`,'sqft',s.label) : (s.installPerFt ? calcBtn(`mq-installqty-${prefix}-${i}`,'linear',s.label) : '')}
          </div>
          <span style="font-size:11px;font-weight:600;color:#6b7280">${s.installPerSqFt ? 'square feet' : (s.installPerFt ? 'linear feet' : 'quantity')}</span>
        </div>` : '';
      return `
      <div class="mq-spec-item" id="mq-sp-${prefix}-${i}" data-rooms="${roomsAttr}">
        <div class="mq-spec-top">
          <div style="position:relative;flex-shrink:0">${thumb}${badgeHtml}</div>
          <div style="flex:1;min-width:0">
            <span class="mq-spec-name">${s.label}</span>
            ${s.description ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.3">${s.description}</div>` : ''}
            ${installModeHtml}
          </div>
        </div>
        <div class="mq-spec-bottom">
          <div class="mq-qty-ctrl">
            <button class="mq-qty-btn" onclick="mqAdjQty('${prefix}',${i},-1)">−</button>
            <input type="text" inputmode="${(s.perSqFt||s.perFt)?'decimal':'numeric'}" pattern="${(s.perSqFt||s.perFt)?'[0-9]*\\.?[0-9]*':'[0-9]*'}" id="mq-qty-${prefix}-${i}" value="0" style="width:36px;text-align:center;font-size:14px;font-weight:500;border:1px solid #d1d5db;border-radius:4px;padding:2px 4px;font-family:inherit;box-shadow:none" oninput="mqSetQty('${prefix}',${i},this.value)" onclick="this.select()"/>
            <button class="mq-qty-btn" onclick="mqAdjQty('${prefix}',${i},1)">+</button>
            ${s.perSqFt ? calcBtn(`mq-qty-${prefix}-${i}`,'sqft',s.label) : (s.perFt ? calcBtn(`mq-qty-${prefix}-${i}`,'linear',s.label) : '')}
          </div>
          <span style="font-size:11px;font-weight:600;color:#6b7280">${s.perSqFt ? 'square feet' : (s.perFt ? 'linear feet' : 'quantity')}</span>
          ${installQtyRowHtml}
        </div>
      </div>`;
    };

    const hasAnyCategory = specs.some(s => (s.category||'').trim());
    if (!hasAnyCategory) return specs.map((s,i)=>buildCard(s,i)).join('');

    const groups = {};
    const order = [];
    specs.forEach((s,i) => {
      const cat = (s.category||'').trim() || '__other__';
      if (!groups[cat]) { groups[cat] = []; order.push(cat); }
      groups[cat].push(i);
    });
    if (groups['__other__']) {
      order.splice(order.indexOf('__other__'), 1);
      order.push('__other__');
    }

    return order.map((cat, gi) => {
      const label = cat === '__other__' ? 'Other' : cat;
      const cardsHtml = groups[cat].map(i => buildCard(specs[i], i)).join('');
      return `<div class="mq-spec-category-group" style="grid-column:1/-1;margin:${gi===0?'0':'14px'} 0 0">
        <div class="mq-spec-category-heading">${label}</div>
        <div class="mq-spec-category-items">${cardsHtml}</div>
      </div>`;
    }).join('');
  }

  // The exact same blue calculator icon as the real button, sized for
  // sitting inline within guide text. Used directly in the built-in
  // defaults below, and available as a [calc] token in shop-owner-written
  // guide text (see renderSafeGuideText) since plain text/emoji can never
  // reliably render in the right color — it depends entirely on the
  // reader's device/font, which is exactly the confusion this avoids.
  function mqCalcIconInlineHTML() {
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;vertical-align:-6px;margin:0 2px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="2" width="16" height="20" rx="2" stroke="#1d4ed8" stroke-width="1.8"/><rect x="6.5" y="4.5" width="11" height="4" rx="0.5" fill="#1d4ed8"/><rect x="6.5" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="10.7" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="14.9" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="6.5" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="10.7" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="14.9" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="6.5" y="19" width="11" height="2" rx="0.4" fill="#1d4ed8"/></svg></span>`;
  }

  // The generic measuring guide every project type falls back to until a
  // shop owner sets custom "how to measure" text for that specific project
  // type (see mqRefreshMeasureGuide). Kept as its own function so both the
  // initial HTML render and the per-project-type swap can reuse the exact
  // same markup.
  function defaultMeasureGuideHTML(roomId = 'kitchen') {
    const cornerSection = `<div style="margin-bottom:6px"><strong>Corner cabinets:</strong> At each corner, measure one wall all the way in, then stop the other wall short of the corner — about 1 foot for upper cabinets, about 2 feet for base cabinets, since that's roughly where the corner cabinet already covers the space either way. Don't worry about the exact number, this is a ballpark estimate.
      <img src="https://aceswin.github.io/midasquote-widget/measure-guides/corner-cabinets.png" alt="How to measure corner cabinets" onclick="mqPhotoLightbox('https://aceswin.github.io/midasquote-widget/measure-guides/corner-cabinets.png','How to measure corner cabinets')" onerror="this.style.display='none'" style="width:100%;max-width:280px;height:auto;border-radius:6px;margin-top:8px;cursor:zoom-in;display:block"/>
    </div>`;
    if (roomId === 'kitchen') {
      return `
        <div style="font-weight:600;margin-bottom:8px;color:#111">📏 Quick measuring guide</div>
        <div style="background:#fffbeb;border-radius:6px;padding:8px 10px;margin-bottom:10px;color:#92400e;font-size:12px">💡 <strong>Don't worry about doing any math yourself.</strong> Measure each wall separately, in whatever unit is easiest (feet, inches, or mm), then tap the ${mqCalcIconInlineHTML()} and enter each one as its own section — got <strong>3 separate runs of upper cabinets</strong>? That's 3 sections. We'll add them up and convert everything for you, no matter how many walls you have.</div>
        <div style="margin-bottom:6px"><strong>Upper cabinets:</strong> A section for every wall run where uppers will go.</div>
        <div style="margin-bottom:6px"><strong>Base cabinets:</strong> Same idea — a section for every run of base cabinets.</div>
        <div style="margin-bottom:6px"><strong>Island cabinets:</strong> Add these in with your base cabinets — measure the island as another section under Base cabinets, not on its own.</div>
        ${cornerSection}`;
    }
    return `
      <div style="font-weight:600;margin-bottom:8px;color:#111">📏 Quick measuring guide</div>
      <div style="background:#fffbeb;border-radius:6px;padding:8px 10px;margin-bottom:10px;color:#92400e;font-size:12px">💡 <strong>Don't worry about doing any math yourself.</strong> Measure each wall separately, in whatever unit is easiest (feet, inches, or mm), then tap the ${mqCalcIconInlineHTML()} and enter each one as its own section. We'll add them up and convert everything for you, no matter how many walls you have.</div>
      <div style="margin-bottom:6px"><strong>Upper cabinets:</strong> A section for every wall run where uppers will go.</div>
      <div style="margin-bottom:6px"><strong>Base cabinets:</strong> Same idea — a section for every run of base cabinets.</div>
      <div style="margin-bottom:6px"><strong>Not sure?</strong> Just use your best guess — this is a ballpark estimate!</div>
      ${roomId !== 'bathroom' ? cornerSection : ''}`;
  }

  // Renders shop-owner-supplied guide text safely: escapes everything first
  // (so no stray HTML/script can ever run), THEN allows exactly four
  // whitelisted, harmless transforms — **bold**, line breaks, a [calc]
  // token that expands to the real blue calculator icon, and a
  // [corner-img] token that expands to the standard corner-cabinets
  // measuring photo — so a shop owner can match the look of the default
  // guide without any real markup ever reaching the page.
  function renderSafeGuideText(raw) {
    const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let html = esc(raw || '');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/\[calc\]/g, mqCalcIconInlineHTML());
    html = html.replace(/\[corner-img\]/g, '<img src="https://aceswin.github.io/midasquote-widget/measure-guides/corner-cabinets.png" alt="How to measure corner cabinets" onclick="mqPhotoLightbox(\'https://aceswin.github.io/midasquote-widget/measure-guides/corner-cabinets.png\',\'How to measure corner cabinets\')" onerror="this.style.display=\'none\'" style="width:100%;max-width:280px;height:auto;border-radius:6px;margin-top:8px;cursor:zoom-in;display:block"/>');
    html = html.replace(/\[tip\](.+?)\[\/tip\]/gs, '<div style="background:#fffbeb;border-radius:6px;padding:8px 10px;margin-top:8px;color:#92400e;font-size:12px">💡 $1</div>');
    return html;
  }

  // ============================================================
  // MEASUREMENT CONVERSION CALCULATOR
  // ============================================================
  // Lets a customer measure each section of a wall/run in inches or mm,
  // add as many sections as they need, and have the total automatically
  // converted and dropped into whichever linear-ft or sq-ft field they
  // opened the calculator from.
  let _mqCalcMode = 'linear'; // 'linear' or 'sqft'
  let _mqCalcTargetId = null;
  let _mqCalcUnit = 'ft'; // 'ft', 'in', or 'mm'
  let _mqCalcSections = []; // linear: [{val}]  ·  sqft: [{w,h}]
  let _mqCalcFieldLabel = ''; // shown in the modal so it's clear which field this fills in

  function mqCalcToFeet(val, unit) {
    const n = parseFloat(val) || 0;
    if (unit === 'ft') return n;
    return unit === 'mm' ? n / 304.8 : n / 12;
  }

  function mqEnsureCalcModal() {
    let modal = document.getElementById('mq-measure-calc');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'mq-measure-calc';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100000;display:none;align-items:center;justify-content:center;padding:1rem;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    modal.innerHTML = `<div id="mq-calc-card" style="background:#fff;border-radius:16px;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;padding:1.5rem;box-shadow:0 24px 60px rgba(0,0,0,0.25)"></div>`;
    // Click the dark backdrop (not the card itself) to close, same pattern
    // used by the showroom popup elsewhere in this file.
    modal.addEventListener('click', (e) => { if (e.target === modal) mqCloseMeasureCalc(); });
    document.body.appendChild(modal);
    return modal;
  }

  window.mqOpenMeasureCalc = function(targetId, mode, fieldLabel) {
    const specMatch = targetId.match(/^mq-qty-([a-z]+)-(\d+)$/);
    if (specMatch && window.mqSpecModeChosen && !window.mqSpecModeChosen(specMatch[1], parseInt(specMatch[2], 10))) {
      return;
    }
    _mqCalcMode = mode;
    _mqCalcTargetId = targetId;
    _mqCalcFieldLabel = fieldLabel || '';
    _mqCalcSections = mode === 'linear' ? [{ val: '' }] : [{ w: '', h: '' }];
    mqEnsureCalcModal().style.display = 'flex';
    mqRenderCalc();
  };

  window.mqCloseMeasureCalc = function() {
    const modal = document.getElementById('mq-measure-calc');
    if (modal) modal.style.display = 'none';
  };

  window.mqCalcSetUnit = function(unit) {
    _mqCalcUnit = unit;
    mqRenderCalc();
  };

  window.mqCalcAddSection = function() {
    _mqCalcSections.push(_mqCalcMode === 'linear' ? { val: '' } : { w: '', h: '' });
    mqRenderCalc();
  };

  window.mqCalcRemoveSection = function(idx) {
    if (_mqCalcSections.length <= 1) return; // always keep at least one row
    _mqCalcSections.splice(idx, 1);
    mqRenderCalc();
  };

  window.mqCalcUpdateSection = function(idx, field, val) {
    _mqCalcSections[idx][field] = val;
    mqRenderCalcTotal();
  };

  function mqCalcComputeTotal() {
    if (_mqCalcMode === 'linear') {
      const totalUnits = _mqCalcSections.reduce((sum, s) => sum + (parseFloat(s.val) || 0), 0);
      return mqCalcToFeet(totalUnits, _mqCalcUnit);
    }
    return _mqCalcSections.reduce((sum, s) => sum + mqCalcToFeet(s.w, _mqCalcUnit) * mqCalcToFeet(s.h, _mqCalcUnit), 0);
  }

  function mqRenderCalcTotal() {
    const totalEl = document.getElementById('mq-calc-total');
    if (!totalEl) return;
    const total = mqCalcComputeTotal();
    totalEl.textContent = _mqCalcMode === 'linear' ? `${total.toFixed(2)} linear ft` : `${total.toFixed(2)} sq ft`;
  }

  function mqRenderCalc() {
    const card = document.getElementById('mq-calc-card');
    if (!card) return;
    const unitLabel = _mqCalcUnit === 'mm' ? 'mm' : (_mqCalcUnit === 'ft' ? 'feet' : 'inches');
    const rows = _mqCalcSections.map((s, idx) => _mqCalcMode === 'linear' ? `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:13px;color:#4b5563;width:64px;flex-shrink:0">Section ${idx + 1}</span>
        <input type="number" value="${s.val}" placeholder="0" oninput="mqCalcUpdateSection(${idx},'val',this.value)" style="flex:1;font-size:14px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit"/>
        <span style="font-size:13px;color:#4b5563;width:44px">${unitLabel}</span>
        ${_mqCalcSections.length > 1 ? `<button type="button" onclick="mqCalcRemoveSection(${idx})" style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:0 4px">✕</button>` : '<span style="width:20px;flex-shrink:0"></span>'}
      </div>` : `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:13px;color:#4b5563;width:64px;flex-shrink:0">Section ${idx + 1}</span>
        <input type="number" value="${s.w}" placeholder="Width" oninput="mqCalcUpdateSection(${idx},'w',this.value)" style="flex:1;min-width:0;font-size:14px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit"/>
        <span style="font-size:12px;color:#6b7280;flex-shrink:0">×</span>
        <input type="number" value="${s.h}" placeholder="Height" oninput="mqCalcUpdateSection(${idx},'h',this.value)" style="flex:1;min-width:0;font-size:14px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit"/>
        <span style="font-size:13px;color:#4b5563;width:44px">${unitLabel}</span>
        ${_mqCalcSections.length > 1 ? `<button type="button" onclick="mqCalcRemoveSection(${idx})" style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:0 4px">✕</button>` : '<span style="width:20px;flex-shrink:0"></span>'}
      </div>`
    ).join('');

    card.innerHTML = `
      <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:4px">${_mqCalcMode === 'linear' ? '📏 Measurement calculator' : '📐 Square footage calculator'}${_mqCalcFieldLabel ? ` <span style="font-weight:600;color:#2563eb">(${_mqCalcFieldLabel})</span>` : ''}</div>
      <div style="font-size:13px;color:#4b5563;margin-bottom:14px">${_mqCalcMode === 'linear' ? "Measure each section, and we'll add them all up and convert to feet for you." : "Measure the width and height of each section, and we'll convert and total the square footage for you."}</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button type="button" onclick="mqCalcSetUnit('ft')" style="flex:1;padding:8px;border-radius:6px;border:1.5px solid ${_mqCalcUnit === 'ft' ? '#1a1a1a' : '#d1d5db'};background:${_mqCalcUnit === 'ft' ? '#1a1a1a' : '#fff'};color:${_mqCalcUnit === 'ft' ? '#fff' : '#374151'};font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Feet</button>
        <button type="button" onclick="mqCalcSetUnit('in')" style="flex:1;padding:8px;border-radius:6px;border:1.5px solid ${_mqCalcUnit === 'in' ? '#1a1a1a' : '#d1d5db'};background:${_mqCalcUnit === 'in' ? '#1a1a1a' : '#fff'};color:${_mqCalcUnit === 'in' ? '#fff' : '#374151'};font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Inches</button>
        <button type="button" onclick="mqCalcSetUnit('mm')" style="flex:1;padding:8px;border-radius:6px;border:1.5px solid ${_mqCalcUnit === 'mm' ? '#1a1a1a' : '#d1d5db'};background:${_mqCalcUnit === 'mm' ? '#1a1a1a' : '#fff'};color:${_mqCalcUnit === 'mm' ? '#fff' : '#374151'};font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Millimeters</button>
      </div>
      <div id="mq-calc-rows">${rows}</div>
      <button type="button" onclick="mqCalcAddSection()" style="width:100%;padding:8px;border-radius:6px;border:1.5px dashed #d97706;background:#0f2a52;color:#fbbf24;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:14px">+ Add another section</button>
      <div style="background:#f0fdf4;border-radius:8px;padding:10px 12px;margin-bottom:14px;text-align:center">
        <div style="font-size:12px;color:#4b5563;margin-bottom:2px">Total</div>
        <div id="mq-calc-total" style="font-size:18px;font-weight:700;color:#166534"></div>
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" onclick="mqCloseMeasureCalc()" style="flex:1;padding:10px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#374151;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>
        <button type="button" onclick="mqCalcApply()" style="flex:1;padding:10px;border-radius:8px;border:none;background:#1a1a1a;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Use this total</button>
      </div>`;
    mqRenderCalcTotal();
  }

  window.mqCalcApply = function() {
    const rawTotal = mqCalcComputeTotal();
    // Specialty item qty fields (per linear/sq ft) now keep one decimal place;
    // everything else (uft/bft/trim) already supports full decimals.
    const total = _mqCalcTargetId && _mqCalcTargetId.startsWith('mq-qty-')
      ? Math.round(rawTotal * 10) / 10
      : Math.round(rawTotal * 100) / 100;
    const targetEl = document.getElementById(_mqCalcTargetId);
    if (targetEl) {
      targetEl.value = total;
      // Fire both events — some target fields listen for 'input' (live
      // recalculation as you type), others for 'change'. Covers either.
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
      targetEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    mqCloseMeasureCalc();
    if (targetEl) {
      setTimeout(() => {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  };

  // Small button that opens the calculator above, for placement right next
  // to whichever field it should fill in.
  // Reusable header row for a collapsible section — title on the left,
  // "Open"/"Close" + arrow on the right. `key` must be unique per section
  // (used to build the mq-${key}-body / -arrow / -label ids mqToggleCollapse
  // and mqRenumberSteps both key off of).
  function collapsibleHeader(key, title) {
    // stopPropagation so this doesn't also trigger the surrounding section's
    // own "click anywhere to open" handler (mqOpenIfClosed) — this header's
    // click already fully manages toggling both directions by itself. Since
    // that also blocks the step-focus "jump to this section" listener from
    // ever seeing the click, it's called explicitly here too, so clicking
    // the header clears the grey/upcoming state exactly like clicking
    // anywhere else in the section already does.
    return `<div class="mq-sec-header-row" onclick="event.stopPropagation();mqToggleCollapse('${key}');mqJumpToSectionIfNeeded(event.currentTarget.closest('.mq-sec'))">
      <p class="mq-sec-title">${title}</p>
      <span style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <span id="mq-${key}-label" style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">Open</span>
        <span class="mq-collapse-arrow" id="mq-${key}-arrow">▶</span>
      </span>
    </div>`;
  }

  function calcBtn(targetId, mode, fieldLabel) {
    const icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="#1d4ed8" stroke-width="1.8"/>
      <rect x="6.5" y="4.5" width="11" height="4" rx="0.5" fill="#1d4ed8"/>
      <rect x="6.5" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/>
      <rect x="10.7" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/>
      <rect x="14.9" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/>
      <rect x="6.5" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/>
      <rect x="10.7" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/>
      <rect x="14.9" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/>
      <rect x="6.5" y="19" width="11" height="2" rx="0.4" fill="#1d4ed8"/>
    </svg>`;
    const safeLabel = (fieldLabel||'').replace(/'/g,"\\'");
    return `<button type="button" onclick="mqOpenMeasureCalc('${targetId}','${mode}','${safeLabel}')" title="Measurement calculator" style="background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;width:32px;height:32px;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;margin-left:6px;padding:0">${icon}</button>`;
  }

  function cabinetForm(prefix, specs, data) {
    const { li, hasDynamic, shopPhotos, roomTypes } = data;
    const mOpts = makeOpts(li.materials, '<option value="melamine">Melamine</option><option value="plywood">Plywood</option>');
    const dOpts = `<option value="none">No doors</option>` + makeOpts(li.doorStyles, '<option value="slab">Slab</option><option value="shaker">Shaker</option>');
    const hingeOpts = makeOpts(li.hinges, '<option value="softclose">Soft-close</option><option value="regular">Regular</option>');
    const hasDrawers = li.drawers.length > 0;
    const hasHinges  = li.hinges.length > 0;
    const hasTrim    = (li.trimItems || []).length > 0;
    const hasCrown    = (li.trimItems || []).some(t => (t['Trim type']||'crown') === 'crown');
    const hasValance  = (li.trimItems || []).some(t => t['Trim type'] === 'valance');
    // Safety net: the pricing wizard auto-adds 4 default install line items
    // at $0 the first time a shop touches item setup, and tells them to
    // delete whichever they don't offer ("Supply-only shop? Delete all.").
    // If a shop skips that step, those $0 stubs would otherwise still count
    // as "has install" below — so require at least one to actually be priced.
    const hasInstall = !hasDynamic || li.installItems.some(i => (i['Rate']||0) > 0);
    const drawerConfigNames = [...new Set(li.drawers.map(d => d['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim()))];
    const drawerConfigOpts = drawerConfigNames.map((n,i) => `<option value="${i}">${n}</option>`).join('');
    const drawerConfigItems = sortBadgeAndGroupItems(drawerConfigNames.map((n,i)=>{
      const someRec = li.drawers.find(d => d['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i,'').trim()===n && /some drawers/i.test(d['Name']));
      return {
        value:`${i}`, label:n, photoUrl:(shopPhotos||{})[photoKeyFor('drawer', n)]||'', icon:'🗄️',
        // Badge/sort by the "Some drawers" rate as the representative price for this config
        price: someRec?.['Rate'] || 0,
        visibleRooms: li.drawers.find(d => d['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i,'').trim()===n)?.visibleRooms || [],
        groupName: (someRec?.['Group name']||'').trim(), groupOrder: someRec?.['Group sort order']||0, groupDesc: someRec?.['Group description']||'',
      };
    }));

    // Same value indexing as mOpts/dOpts/hingeOpts above (dyn_0, dyn_1... when
    // the shop has real pricing data, or the legacy fallback values when not)
    // so picking a chip always sets a value the existing calc logic already understands.
    // Sorted cheapest-first with $/$$/$$$ badges so customers can tell at a
    // glance which options cost more — "None" (where it exists) always stays
    // pinned first with no badge, since it's not really a "priced" choice.
    const mItems = li.materials.length > 0
      ? sortBadgeAndGroupItems(li.materials.map((m,i)=>{
          const baseName = m._baseName || m['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim();
          const bItem = li.rawMaterials.find(r => r['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim() === baseName && r['Unit']?.includes('bases'));
          const priceRate = bItem ? (bItem['Rate']||0) : (m['Rate']||0);
          return {value:`dyn_${i}`, label:baseName, photoUrl:m.photoUrl, icon:'🪵', price:priceRate, visibleRooms:m.visibleRooms||[], groupName:(m['Group name']||'').trim(), groupOrder:m['Group sort order']||0, groupDesc:m['Group description']||''};
        }))
      : [{value:'melamine',label:'Melamine',icon:'🪵'},{value:'plywood',label:'Plywood',icon:'🪵'}];
    const dItems = sortBadgeAndGroupItems([{value:'none',label:'No doors',icon:'🚫'}].concat(
      li.doorStyles.length > 0
        ? li.doorStyles.map((d,i)=>({value:`dyn_${i}`, label:d['Name'], photoUrl:d.photoUrl, icon:'🚪', price:d['Rate']||0, visibleRooms:d.visibleRooms||[], groupName:(d['Group name']||'').trim(), groupOrder:d['Group sort order']||0, groupDesc:d['Group description']||''}))
        : [{value:'slab',label:'Slab',icon:'🚪'},{value:'shaker',label:'Shaker',icon:'🚪'}]
    ));
    const hingeItems = li.hinges.length > 0
      ? sortAndBadgeItems(li.hinges.map((h,i)=>({value:`dyn_${i}`, label:h['Name'], photoUrl:h.photoUrl, icon:'🔧', price:h['Rate']||0, visibleRooms:h.visibleRooms||[]})))
      : [{value:'softclose',label:'Soft-close',icon:'🔧'},{value:'regular',label:'Regular',icon:'🔧'}];
    const crownItems = sortBadgeAndGroupItems([{value:'none',label:'None',icon:'🚫'}].concat(
      Object.entries(TRIM).filter(([k,t])=>t.type==='crown').map(([k,t])=>({value:k, label:t.label, photoUrl:t.photoUrl, icon:'👑', price:(t.ps||0)+(t.pi||0), visibleRooms:t.visibleRooms||[], groupName:t.groupName||'', groupOrder:t.groupOrder||0, groupDesc:t.groupDesc||''}))
    ));
    const valanceItems = sortBadgeAndGroupItems([{value:'none',label:'None',icon:'🚫'}].concat(
      Object.entries(TRIM).filter(([k,t])=>t.type==='valance').map(([k,t])=>({value:k, label:t.label, photoUrl:t.photoUrl, icon:'📏', price:(t.ps||0)+(t.pi||0), visibleRooms:t.visibleRooms||[], groupName:t.groupName||'', groupOrder:t.groupOrder||0, groupDesc:t.groupDesc||''}))
    ));

    return `
      <div class="mq-sec">
        <p class="mq-sec-title">Project basics</p>
        <div style="background:#F0E9DA;border:2px solid #0f2a52;border-radius:12px;padding:16px 18px">
          <label style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:#0f2a52;margin-bottom:8px">
            <span style="background:#0f2a52;color:#fbbf24;border-radius:50%;width:26px;height:26px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">1</span>
            Start here — choose your project type
          </label>
          <select id="mq-${prefix}-room" onchange="mqTogVanityNote('${prefix}');mqTogDwOption('${prefix}');mqRefreshRoomVisibility('${prefix}');mqShowRoomDescription('${prefix}');mqRefreshMeasureGuide('${prefix}');mqRefreshAllPickerVisibility('${prefix}');mqOnProjectTypeChange('${prefix}')" style="font-size:15px;font-weight:600;padding:10px 12px">${(roomTypes||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select>
          <p class="mq-hint" id="mq-${prefix}-room-vanity-note" style="display:none;color:#0f2a52;font-weight:600;margin-top:8px"></p>
          <div id="mq-${prefix}-room-desc" style="display:none;margin-top:8px;padding:10px 12px;background:#fff;border:1px solid #0f2a52;border-radius:6px;font-size:13px;color:#1f2937;line-height:1.5"></div>
        </div>
      </div>
      <div class="mq-sec" id="mq-${prefix}-measuring-sec" onclick="mqOpenIfClosed('${prefix}-measuring')">
        ${collapsibleHeader(`${prefix}-measuring`, 'How to measure')}
        <div style="font-size:13px;color:#4b5563;margin-bottom:10px;line-height:1.5">
          📏 Tips for getting accurate measurements, plus a converter for inches/mm.
        </div>
        <div id="mq-${prefix}-measuring-body" style="display:none">
          <div id="mq-${prefix}-measure-guide" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-size:13px;color:#374151;line-height:1.7">${defaultMeasureGuideHTML()}</div>
        </div>
      </div>
      <div class="mq-sec" id="mq-${prefix}-si-field">
        <p class="mq-sec-title">${hasInstall ? 'Supply + install' : 'Supply'}</p>
        <div style="background:linear-gradient(135deg,#0f2a52,#1e3a5f);border:2px solid #fbbf24;border-radius:12px;padding:16px 18px">
          <div class="mq-field"><label class="mq-label" style="font-size:14px;font-weight:700;color:#fbbf24">${hasInstall ? 'Supply + install?' : 'Supply'}</label>
            <p class="mq-hint" style="margin-bottom:8px;color:#cbd5e1">${hasInstall ? "Let us know if you just need the cabinets themselves (supply only), or if you'd also like us to install them for you (supply + install)." : 'This shop offers supply only — installation is not included.'}</p>
            <select id="mq-${prefix}-si" onchange="mqSyncCtSi('${prefix}')">${hasInstall ? '<option value="supply">Supply only</option><option value="install">Supply + install</option>' : '<option value="supply">Supply only</option>'}</select></div>
        </div>
      </div>
      <div class="mq-sec" id="mq-${prefix}-cabinet-measurements-sec">
        <p class="mq-sec-title">Cabinet measurements</p>
        ${Object.keys(TALL_CAB).length > 0 ? `<div style="background:#f0fdf4;border:2px solid #4ade80;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:13px;color:#166534;line-height:1.5">📐 <strong>Note:</strong> Do not include tall cabinets (eg. Pantry cabinet, Tall oven unit, etc.) in your linear foot measurements. Add them in the tall cabinets section.</div>` : ''}
        <div class="mq-grid3">
          <div class="mq-field"><label class="mq-label">Upper cabinets (lin ft)</label>
            <div style="display:flex;align-items:center"><input type="number" id="mq-${prefix}-uft" value="0" min="0" max="60" style="flex:1;min-width:0"/>${calcBtn(`mq-${prefix}-uft`,'linear','Upper cabinets')}</div>
            <div style="font-size:13px;color:#2563eb;font-weight:700;margin-top:4px">👉 Not sure? Tap the calculator to measure</div>
          </div>
          <div class="mq-field"><label class="mq-label">Base cabinets (lin ft)</label>
            <div style="display:flex;align-items:center"><input type="number" id="mq-${prefix}-bft" value="0" min="0" max="60" oninput="mqRefreshBsFt('${prefix}')" style="flex:1;min-width:0"/>${calcBtn(`mq-${prefix}-bft`,'linear','Base cabinets')}</div>
            <div style="font-size:13px;color:#2563eb;font-weight:700;margin-top:4px">👉 Not sure? Tap the calculator to measure</div>
          </div>
          <div class="mq-field"><label class="mq-label">Height (uppers)</label>
            <select id="mq-${prefix}-ht"><option value="standard">Standard (30")</option><option value="tall">Extended (36–40")</option></select></div>
        </div>
        <div class="mq-tog-row" onclick="mqTogDiff('${prefix}')">
          <div class="mq-tog" id="mq-${prefix}-diff-tog"></div>
          <label style="font-size:14px;cursor:pointer">Different styles for uppers and lowers</label>
        </div>
        <div id="mq-${prefix}-shared">
          <div class="mq-field"><label class="mq-label">Box material</label>
            ${pickerRow(`mq-${prefix}-mat`, mItems, null, 'material')}
            <select id="mq-${prefix}-mat" style="display:none">${mOpts}</select></div>
          <div class="mq-field" style="margin-top:10px"><label class="mq-label">Door style</label>
            ${pickerRow(`mq-${prefix}-door`, dItems, null, 'door')}
            <select id="mq-${prefix}-door" onchange="mqApplyLinkedTrim('${prefix}', this.value)" style="display:none">${dOpts}</select></div>
          ${hasHinges?`<div class="mq-field" style="margin-top:10px"><label class="mq-label">Door hinges</label>
            ${pickerRow(`mq-${prefix}-hinge`, hingeItems)}
            <select id="mq-${prefix}-hinge" style="display:none">${hingeOpts}</select></div>`:''}
          <p class="mq-hint" style="margin-top:6px">These materials may not reflect our full inventory. If you don't see yours, please feel free to contact us.</p>
        </div>
        <div id="mq-${prefix}-diff" style="display:none">
          <div class="mq-sub-sec mq-sub-upper"><p class="mq-sub-title">🔼 Upper cabinets</p>
            <div class="mq-field"><label class="mq-label">Box material</label>
              ${pickerRow(`mq-${prefix}-u-mat`, mItems, null, 'material')}
              <select id="mq-${prefix}-u-mat" style="display:none">${mOpts}</select></div>
            <div class="mq-field" style="margin-top:10px"><label class="mq-label">Door style</label>
              ${pickerRow(`mq-${prefix}-u-door`, dItems, null, 'door')}
              <select id="mq-${prefix}-u-door" onchange="mqApplyLinkedTrim('${prefix}', this.value)" style="display:none">${dOpts}</select></div>
            ${hasHinges?`<div class="mq-field" style="margin-top:10px"><label class="mq-label">Door hinges</label>
              ${pickerRow(`mq-${prefix}-u-hinge`, hingeItems)}
              <select id="mq-${prefix}-u-hinge" style="display:none">${hingeOpts}</select></div>`:''}
          </div>
          <div class="mq-sub-sec mq-sub-base" style="margin-top:8px"><p class="mq-sub-title">🔽 Base cabinets</p>
            <div class="mq-field"><label class="mq-label">Box material</label>
              ${pickerRow(`mq-${prefix}-b-mat`, mItems, null, 'material')}
              <select id="mq-${prefix}-b-mat" style="display:none">${mOpts}</select></div>
            <div class="mq-field" style="margin-top:10px"><label class="mq-label">Door style</label>
              ${pickerRow(`mq-${prefix}-b-door`, dItems, null, 'door')}
              <select id="mq-${prefix}-b-door" style="display:none">${dOpts}</select></div>
            ${hasHinges?`<div class="mq-field" style="margin-top:10px"><label class="mq-label">Door hinges</label>
              ${pickerRow(`mq-${prefix}-b-hinge`, hingeItems)}
              <select id="mq-${prefix}-b-hinge" style="display:none">${hingeOpts}</select></div>`:''}
          </div>
        </div>
      </div>
      ${hasDrawers?`<div class="mq-sec" id="mq-${prefix}-drawers-sec">
        <p class="mq-sec-title">Drawers</p>
        <div class="mq-field">
          <label class="mq-label">Drawer amount</label>
          <select id="mq-${prefix}-drawer-tier" onchange="mqTogDrawerConfig('${prefix}')">
            <option value="none">No drawers</option>
            <option value="some">Some drawers</option>
            <option value="mostly">Mostly drawers</option>
          </select>
        </div>
        <div style="font-size:13px;color:#4b5563;margin:12px 0 10px;line-height:1.5">
          🗄️ <strong>Mostly drawers</strong> means that, aside from your sink and corner cabinets, 50% or more of your base cabinets are full stacked drawer banks with no door at all. 🗄️ <strong>Some drawers</strong> means fewer than that — most are a standard door with just one drawer on top.
        </div>
        <div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap;justify-content:flex-start">
          <div style="flex:0 1 150px;text-align:center">
            <img src="https://widget.midasquote.com/drawer-guide/mostly-drawers.png" alt="Full drawer bank example" style="width:100%;max-width:150px;border-radius:8px;border:1px solid #e5e7eb;display:block;margin:0 auto;cursor:zoom-in" onclick="mqPhotoLightbox('https://widget.midasquote.com/drawer-guide/mostly-drawers.png','Full drawer bank example')" onerror="this.style.display='none'"/>
            <div style="font-size:11px;color:#6b7280;margin-top:6px;line-height:1.4">Most bases look like this (stacked drawers, no door) → pick <strong>Mostly drawers</strong></div>
          </div>
          <div style="flex:0 1 150px;text-align:center">
            <img src="https://widget.midasquote.com/drawer-guide/some-drawers.png" alt="Standard door with one top drawer example" style="width:100%;max-width:150px;border-radius:8px;border:1px solid #e5e7eb;display:block;margin:0 auto;cursor:zoom-in" onclick="mqPhotoLightbox('https://widget.midasquote.com/drawer-guide/some-drawers.png','Standard door with one top drawer example')" onerror="this.style.display='none'"/>
            <div style="font-size:11px;color:#6b7280;margin-top:6px;line-height:1.4">Most bases look like this (door + one top drawer) → pick <strong>Some drawers</strong></div>
          </div>
        </div>
        <div class="mq-field" id="mq-${prefix}-drawer-config-wrap" style="display:none;margin-top:10px">
          <label class="mq-label">Drawer type</label>
          ${pickerRow(`mq-${prefix}-drawer-config`, drawerConfigItems, null, 'drawer')}
          <select id="mq-${prefix}-drawer-config" style="display:none">${drawerConfigOpts}</select>
        </div>
      </div>`:''}
      ${Object.keys(TALL_CAB).length > 0 ? `
      <div class="mq-sec" id="mq-${prefix}-tallcabs-sec" onclick="mqOpenIfClosed('${prefix}-tallcabs')">
        ${collapsibleHeader(`${prefix}-tallcabs`, 'Tall cabinets')}
        <div style="font-size:13px;color:#4b5563;margin-bottom:10px;line-height:1.5">
          🏛️ Add each tall cabinet separately — pick a type, width, and quantity, then add another for a different type.
        </div>
        <div id="mq-${prefix}-tallcabs-body" style="display:none">
          <div id="mq-${prefix}-tallcabs"></div>
          <button class="mq-add-surface-btn" onclick="mqAddTallCab('${prefix}')">+ Add a tall cabinet</button>
        </div>
      </div>` : ''}
      ${hasTrim?`<div class="mq-sec" id="mq-${prefix}-trim-sec" onclick="mqOpenIfClosed('${prefix}-trim')">
        ${collapsibleHeader(`${prefix}-trim`, 'Crown moulding / valance')}
        <div id="mq-${prefix}-trim-auto-explainer" style="font-size:12px;color:#4b5563;margin-bottom:10px;line-height:1.5">📐 Crown and valance footage is calculated automatically from your upper cabinet measurements above — just pick the style.</div>
        <div id="mq-${prefix}-trim-noauto-explainer" style="display:none;font-size:12px;color:#4b5563;margin-bottom:10px;line-height:1.5">📐 This project type doesn't include cabinet measurements, so enter your crown/valance linear footage directly below.</div>
        <div id="mq-${prefix}-trim-auto-note" style="display:none;font-size:13px;font-weight:600;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 10px;margin-bottom:8px"></div>
        <label id="mq-${prefix}-trim-use-cab-wrap" style="display:none;align-items:flex-start;gap:10px;margin-bottom:10px;cursor:pointer">
          <input type="checkbox" id="mq-${prefix}-trim-use-cab" onchange="mqTogTrimUseCab('${prefix}')" style="margin-top:2px;flex-shrink:0;width:auto"/>
          <span style="font-size:14px;font-weight:500;line-height:1.4">Use my upper cabinet measurements</span>
        </label>
        <div id="mq-${prefix}-trim-body" style="display:none">
        <label id="mq-${prefix}-trim-manual-toggle-wrap" style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-bottom:10px;background:#f9fafb;border-radius:6px;padding:8px 10px">
          <input type="checkbox" id="mq-${prefix}-trim-manual-toggle" onchange="mqTogTrimManualFt('${prefix}')" style="width:auto;flex-shrink:0"/>
          Don't use upper cabinet linear footage — enter it myself
        </label>
        <div id="mq-${prefix}-trim-manual-wrap" style="display:none;margin-bottom:10px;align-items:center;gap:8px">
          <label style="font-size:14px;color:#374151">Linear feet</label>
          <input type="number" id="mq-${prefix}-trim-manual-ft" value="0" min="0" step="0.5" style="width:90px"/>
          ${calcBtn(`mq-${prefix}-trim-manual-ft`,'linear','Crown & valance')}
        </div>
        ${hasCrown?`<div style="margin-bottom:8px">
          <div class="mq-field"><label class="mq-label">Crown moulding</label>
            ${pickerRow(`mq-${prefix}-trim-crown`, crownItems, null, 'trim_crown')}
            <select id="mq-${prefix}-trim-crown" onchange="mqTogTrimReturns('${prefix}')" style="display:none">${trimOpts('crown')}</select>
          </div>
          <div class="mq-field" id="mq-${prefix}-trim-crown-returns-wrap" style="display:none;margin-top:10px;background:#0f2a52;border:1.5px solid #d97706;border-radius:8px;padding:10px 12px">
            <div style="display:flex;align-items:flex-start">
              ${termHelpThumb(MQ_TERM_IMAGES.crownReturn,'What is a crown return?')}
              <div style="flex:1;min-width:0">
                <label class="mq-label" style="color:#fbbf24;font-weight:700">Returns to wall</label>
                <input type="number" id="mq-${prefix}-trim-crown-returns" value="0" min="0" max="20"/>
                <div style="font-size:12px;color:#cbd5e1;margin-top:6px;line-height:1.5">A "return" is where the crown turns and meets the wall. Each return adds 1 linear foot to your total — count how many you have. If unsure, just leave as 0.</div>
              </div>
            </div>
          </div>
        </div>`:''}
        ${hasValance?`<div>
          <div class="mq-field"><label class="mq-label">Valance</label>
            ${pickerRow(`mq-${prefix}-trim-valance`, valanceItems, null, 'trim_valance')}
            <select id="mq-${prefix}-trim-valance" onchange="mqTogTrimReturns('${prefix}')" style="display:none">${trimOpts('valance')}</select>
          </div>
          <div class="mq-field" id="mq-${prefix}-trim-valance-returns-wrap" style="display:none;margin-top:10px;background:#0f2a52;border:1.5px solid #d97706;border-radius:8px;padding:10px 12px">
            <div style="display:flex;align-items:flex-start">
              ${termHelpThumb(MQ_TERM_IMAGES.valanceReturn,'What is a valance return?')}
              <div style="flex:1;min-width:0">
                <label class="mq-label" style="color:#fbbf24;font-weight:700">Returns to wall</label>
                <input type="number" id="mq-${prefix}-trim-valance-returns" value="0" min="0" max="20"/>
                <div style="font-size:12px;color:#cbd5e1;margin-top:6px;line-height:1.5">A "return" is where the valance turns and meets the wall. Each return adds 1 linear foot to your total — count how many you have. If unsure, just leave as 0.</div>
              </div>
            </div>
          </div>
        </div>`:''}
        </div>
      </div>`:''}
      <div class="mq-sec" id="mq-${prefix}-removal-sec">
        <p class="mq-sec-title">Removal</p>
        <div class="mq-grid2">
          <div class="mq-field"><label class="mq-label">Remove existing cabinets?</label>
            <select id="mq-${prefix}-removal"><option value="no">No removal needed</option><option value="yes">Yes — remove & dispose</option></select></div>
        </div>
      </div>
      <div class="mq-sec" id="mq-${prefix}-specialty-sec" onclick="mqOpenIfClosed('${prefix}-specialty')">
        ${collapsibleHeader(`${prefix}-specialty`, 'Details & Selections')}
        <div style="font-size:13px;color:#4b5563;margin-bottom:10px;line-height:1.5">
          ⭐ Optional extras and upgrades — browse and add anything you'd like.
        </div>
        <div id="mq-${prefix}-specialty-body" style="display:none">
          <div class="mq-spec-grid">${specHTML(specs, prefix)}</div>
        </div>
      </div>`;
  }

  const TRAVEL_NOTE = '🚗 This estimate is based on local delivery. Jobs outside our local area may be subject to additional travel charges — your final quote will confirm the exact amount.';

  // Reference images for trade terms most customers won't recognize
  // ("return", "side splash") — shared across every shop since these look
  // the same regardless of who's doing the quote, so no per-shop upload
  // system needed, just one fixed set.
  const MQ_TERM_IMAGES = {
    crownReturn:   'https://aceswin.github.io/midasquote-widget/term-images/crown-return.png',
    valanceReturn: 'https://aceswin.github.io/midasquote-widget/term-images/valance-return.png',
    sidesplash:    'https://aceswin.github.io/midasquote-widget/term-images/sidesplash.png',
  };
  function termHelpThumb(imgUrl, label, size = 48, showCaption = true) {
    const safeLabel = label.replace(/'/g, "\\'");
    return `<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;margin-right:8px">
      <img src="${imgUrl}" alt="${label}" onclick="event.stopPropagation();mqPhotoLightbox('${imgUrl}','${safeLabel}')" onerror="this.parentElement.style.display='none'" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;cursor:zoom-in;border:1px solid #93c5fd"/>
      ${showCaption ? '<span style="font-size:9px;font-weight:800;color:#1d4ed8;margin-top:3px;white-space:nowrap">Click to view</span>' : ''}
    </div>`;
  }

  const PRICE_LEGEND_HTML = `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:1rem;font-size:13px;color:#4b5563;line-height:1.6">
      Options below are listed <strong>cheapest to most expensive</strong>. Tap any photo to see it up close.
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px;align-items:center">
        <span style="display:inline-flex;align-items:center;gap:5px"><span class="mq-vpicker-badge mq-vpicker-badge-1" style="position:static;display:inline-block">$</span> Budget-friendly</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span class="mq-vpicker-badge mq-vpicker-badge-2" style="position:static;display:inline-block">$$</span> Mid-range</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span class="mq-vpicker-badge mq-vpicker-badge-3" style="position:static;display:inline-block">$$$</span> Premium</span>
      </div>
    </div>`;

  function buildWidgetHTML(shop, specs, data) {
    const hasCtInstall = hasCountertopInstall();
    const bcSafe = (shop['Brand colour']||'#1a1a1a').replace(/'/g,"\\'");
    const letterSafe = ((shop['Shop name']||'S').charAt(0)||'S').replace(/'/g,"\\'").replace(/"/g,'&quot;');
    const logoHTML = shop['Logo URL'] ? `<div class="mq-logo-real"><img src="${shop['Logo URL']}" alt="${shop['Shop name']}" onerror="mqHandleLogoError(this,'${bcSafe}','${letterSafe}')"/></div>` : `<div class="mq-logo"><span>${(shop['Shop name']||'S').charAt(0)}</span></div>`;
    const disc = shop['Disclaimer text'] || 'Ballpark estimate only. Contact us for a full quote.';
    const financingOn = shop['Offers financing'] === 'Yes';
    const financingHTML = financingOn
      ? `<div class="mq-financing-note">💳 Financing available</div>`
      : '';
    const financingLink = (shop['Financing link'] || '').trim();
    const askQuestionBtn = (financingOn && financingLink)
      ? `<button onclick="window.open('${financingLink}','_blank')">Get pre-approved ↗</button>`
      : `<button onclick="mqShowConsultModal()">Ask a question ↗</button>`;

    return `
      <div style="background:linear-gradient(135deg,#0f2a52,#1e3a5f);padding:16px 20px;text-align:center">
        <div style="font-size:19px;font-weight:800;letter-spacing:0.08em;color:#fbbf24;text-transform:uppercase">⚡ MidasQuote Pro ⚡</div>
        <div style="font-size:12px;color:#cbd5e1;letter-spacing:0.04em;margin-top:2px">Real numbers. Every time.</div>
      </div>
      <div class="mq-header">
        ${logoHTML}
        <div style="flex:1">
          <div class="mq-shop-name">${shop['Shop name']||''}</div>
          <div class="mq-shop-sub">${shop['City']||''} &nbsp;·&nbsp; ${shop['Phone']||''}</div>
        </div>
        <div class="mq-header-actions">
          ${shop['Show showroom'] !== 'Hide' && shop['Shop token'] ? `<a href="https://widget.midasquote.com/showroom.html?shop=${shop['Shop token']}" target="_blank" style="font-size:13px;font-weight:600;color:#fff;text-decoration:none;background:#0f2a52;border-radius:8px;padding:7px 14px;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:6px;transition:opacity 0.15s;box-shadow:0 8px 24px rgba(0,0,0,0.30),0 2px 6px rgba(0,0,0,0.15)" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">🖼️ See our showroom</a>` : ''}
          <button onclick="mqOpenProposalsList()" style="font-size:13px;font-weight:600;color:#fff;border:none;background:#0f2a52;border-radius:8px;padding:7px 14px;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:6px;cursor:pointer;font-family:inherit;transition:opacity 0.15s;box-shadow:0 8px 24px rgba(0,0,0,0.30),0 2px 6px rgba(0,0,0,0.15)" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">📄 My Proposals</button>
        </div>
      </div>
      <div class="mq-powered-by" style="margin-top:10px;padding-top:0;border-top:none;margin-bottom:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Powered by <a href="https://www.midasquote.com" target="_blank" rel="noopener">MidasQuote</a></div>
      <div class="mq-tab-bar">
        <button class="mq-tab active" onclick="mqSwitchTab('both',this)">
          <span class="mq-tab-icon">✨</span>
          <span class="mq-tab-label"><span class="mq-tab-title">Both</span><span class="mq-tab-sub">Full project quote</span></span>
        </button>
        <button class="mq-tab" onclick="mqSwitchTab('cabinets',this)">
          <span class="mq-tab-icon">🪵</span>
          <span class="mq-tab-label"><span class="mq-tab-title">Cabinets</span><span class="mq-tab-sub">Cabinet quote only</span></span>
        </button>
        <button class="mq-tab" onclick="mqSwitchTab('countertops',this)">
          <span class="mq-tab-icon">🪨</span>
          <span class="mq-tab-label"><span class="mq-tab-title">Countertops</span><span class="mq-tab-sub">Countertop quote only</span></span>
        </button>
      </div>

      <!-- CABINET TAB -->
      <div class="mq-tab-content" id="mq-tab-cabinets">
        ${PRICE_LEGEND_HTML}
        ${cabinetForm('c', specs, data)}
        <button class="mq-calc-btn" id="mq-c-calc-btn" onclick="mqCalcCabinets()">Calculate cabinet estimate</button>
        <div class="mq-loading" id="mq-c-loading">Building your estimate...</div>
        <div class="mq-result" id="mq-c-result">
          <div class="mq-res-hdr">
            <div><p class="mq-res-title" id="mq-c-res-title">Cabinet estimate</p><p class="mq-res-sub" id="mq-c-res-sub">—</p><p class="mq-hint" id="mq-c-vanity-note" style="display:none;color:#1d4ed8"></p></div>
            <div><div class="mq-res-range-lbl">Customer sees this range</div><div class="mq-res-range" id="mq-c-res-range">—</div>
              <div style="display:inline-block;margin-top:8px;background:linear-gradient(135deg,#111,#1f1f1f);border:1px solid #fbbf24;border-radius:8px;padding:6px 12px;font-size:14px;font-weight:700;color:#fbbf24">💰 Your real total: <span id="mq-c-res-real" style="color:#fff">—</span></div>
            </div>
          </div>
          <ul class="mq-line-items" id="mq-c-line-items"></ul>
          <div class="mq-disclaimer">⚠ ${disc}</div>
          <div style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:6px;padding:10px 12px;margin-top:8px;font-size:13px;color:#92400e;line-height:1.5">🔧 <strong>Handles & knobs not included</strong> in this estimate unless listed as a specialty item above.</div>
          <div class="mq-travel-note">${TRAVEL_NOTE}</div>
          <div class="mq-cta-row">
            <button onclick="mqSwitchTab('both',document.querySelectorAll('.mq-tab')[0])">Get full project quote ✨</button>
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
          </div>
          <div class="mq-cta-row">
            <button class="mq-pri" onclick="mqOpenProposalModal('c')">📄 Create proposal</button>
          </div>
          ${financingHTML}
          <div class="mq-powered-by"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Powered by <a href="https://www.midasquote.com" target="_blank" rel="noopener">MidasQuote</a></div>
        </div>
      </div>

      <!-- COUNTERTOP TAB -->
      <div class="mq-tab-content" id="mq-tab-countertops">
        ${PRICE_LEGEND_HTML}
        <div class="mq-sec">
          <p class="mq-sec-title">Surfaces</p>
          <div id="mq-ct-surfaces"></div>
          <button class="mq-add-surface-btn" onclick="mqAddSurface('ct')">+ Add another surface</button>
          <p class="mq-hint" style="margin-top:10px">These materials may not reflect our full inventory. If you don't see yours, please feel free to contact us.</p>
        </div>
        <button class="mq-calc-btn" id="mq-ct-calc-btn" onclick="mqCalcCountertops()">Calculate countertop estimate</button>
        <div class="mq-loading" id="mq-ct-loading">Building your estimate...</div>
        <div class="mq-result" id="mq-ct-result">
          <div class="mq-res-hdr">
            <div><p class="mq-res-title">Countertop estimate</p><p class="mq-res-sub" id="mq-ct-res-sub">—</p></div>
            <div><div class="mq-res-range-lbl">Customer sees this range</div><div class="mq-res-range" id="mq-ct-res-range">—</div>
              <div style="display:inline-block;margin-top:8px;background:linear-gradient(135deg,#111,#1f1f1f);border:1px solid #fbbf24;border-radius:8px;padding:6px 12px;font-size:14px;font-weight:700;color:#fbbf24">💰 Your real total: <span id="mq-ct-res-real" style="color:#fff">—</span></div>
            </div>
          </div>
          <ul class="mq-line-items" id="mq-ct-line-items"></ul>
          <div class="mq-disclaimer">⚠ Stone slabs vary by lot. Final pricing requires templating.</div>
          <div class="mq-travel-note">${TRAVEL_NOTE}</div>
          <div class="mq-cta-row">
            <button onclick="mqSwitchTab('both',document.querySelectorAll('.mq-tab')[0])">Get full project quote ✨</button>
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
          </div>
          <div class="mq-cta-row">
            <button class="mq-pri" onclick="mqOpenProposalModal('ct')">📄 Create proposal</button>
          </div>
          ${financingHTML}
          <div class="mq-powered-by"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Powered by <a href="https://www.midasquote.com" target="_blank" rel="noopener">MidasQuote</a></div>
        </div>
      </div>

      <!-- BOTH TAB -->
      <div class="mq-tab-content active" id="mq-tab-both">
        ${PRICE_LEGEND_HTML}
        <div class="mq-both-divider" id="mq-b-cabinet-divider"><div class="mq-both-divider-line"></div><div class="mq-both-divider-label">🪵 Cabinet details</div><div class="mq-both-divider-line"></div></div>
        ${cabinetForm('b', specs, data)}
        <div id="mq-b-countertop-details-sec">
        <div class="mq-both-divider"><div class="mq-both-divider-line"></div><div class="mq-both-divider-label">🪨 Countertop details</div><div class="mq-both-divider-line"></div></div>
        <div class="mq-sec" id="mq-b-ct-options-sec"><p class="mq-sec-title">Countertop options</p>
          <div class="mq-grid2">
            <div class="mq-field"><label class="mq-label">${hasCtInstall ? 'Supply + install?' : 'Supply'}</label>
              ${hasCtInstall ? '' : '<p class="mq-hint" style="margin-bottom:6px">This shop offers supply only — installation is not included.</p>'}
              <select id="mq-b-ct-si">${hasCtInstall ? '<option value="supply">Supply only</option><option value="install">Supply + install</option>' : '<option value="supply">Supply only</option>'}</select></div>
          </div>
          <label id="mq-b-use-cab-wrap" style="display:flex;align-items:flex-start;gap:10px;margin-top:0.75rem;cursor:pointer">
            <input type="checkbox" id="mq-b-use-cab" onchange="mqTogUseCab('b')" style="margin-top:2px;flex-shrink:0;width:auto"/>
            <span style="font-size:14px;font-weight:500;line-height:1.4">Use my base cabinet measurements <span style="font-weight:400;color:#6b7280">(assumes standard depth counter)</span></span>
          </label>
          <div id="mq-b-cab-mat" style="display:none;margin-top:0.75rem">
            <div class="mq-field" style="margin-bottom:0.75rem"><label class="mq-label">Countertop material</label>
              ${pickerRow('mq-b-ct-mat-cab', ctMatItems(), null, 'countertop')}
              <select id="mq-b-ct-mat-cab" onchange="mqRefreshBsOpts('mq-b-ct-mat-cab','mq-b-cab-bs');mqRefreshCutoutOpts('mq-b-ct-mat-cab','mq-b-cab-cuts');mqRefreshBsFt('b')" style="display:none">${ctMatOpts()}</select></div>
            <div style="background:#f9fafb;border-radius:6px;padding:10px 12px;margin-bottom:0.75rem">
            <div id="mq-b-cab-dw-wrap">
                <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-bottom:8px">
                  <input type="checkbox" id="mq-b-cab-dw" onchange="mqRefreshBsFt('b')" style="width:auto;flex-shrink:0"/> Add extra space for a dishwasher <span style="color:#6b7280;font-weight:400">(+24")</span>
                </label>
              </div>
              <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
                <input type="checkbox" id="mq-b-cab-extra-toggle" onchange="mqTogCabExtra('b')" style="width:auto;flex-shrink:0"/> Add additional counter space
              </label>
              <div id="mq-b-cab-extra-wrap" style="display:none;margin-top:8px;align-items:center;gap:8px">
                <label style="font-size:14px;color:#374151">Additional space (feet)</label>
                <input type="number" id="mq-b-cab-extra-ft" value="0" min="0" step="0.5" oninput="mqRefreshBsFt('b')" style="width:80px"/>
              </div>
              <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-top:8px">
                <input type="checkbox" id="mq-b-cab-co" onchange="mqTogCabCuts('b')" style="width:auto;flex-shrink:0"/> Cutouts needed
              </label>
              <div id="mq-b-cab-cuts" style="display:none;margin-top:8px;padding:10px 12px;background:#fff;border-radius:6px"></div>
              <div style="font-size:14px;color:#166534;margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb">
                📐 Countertop area: <strong id="mq-b-cab-ctft">0</strong> lin ft &nbsp;·&nbsp; <strong id="mq-b-cab-ctsqft">0</strong> sqft
              </div>
            </div>
            <div style="margin-bottom:0.75rem">
              <div class="mq-field" style="margin-bottom:0">
                <label class="mq-label">Backsplash</label>
                <select id="mq-b-cab-bs" style="min-width:160px" onchange="mqRefreshBsFt('b')"><option value="none">None</option></select>
              </div>
            </div>
            <div id="mq-b-cab-bsft-block" style="display:none;padding:10px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;margin-bottom:0.75rem">
              <div style="font-size:14px;color:#166534;margin-bottom:8px">Backsplash linear footage (auto): <strong id="mq-b-cab-bsft-auto">0</strong> ft — based on your base cabinet measurement above.</div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                ${termHelpThumb(MQ_TERM_IMAGES.sidesplash,'What is a side splash?',36,false)}<label style="font-size:14px;color:#374151"><strong>Side splashes</strong> (Quantity)</label>
                <input type="number" id="mq-b-cab-bs-sides" value="0" min="0" max="10" oninput="mqRefreshBsFt('b')" style="width:70px"/>
              </div>
              <div style="font-size:12px;color:#4b5563;margin-bottom:8px;line-height:1.5">
                A side splash is the short piece against a wall at the end of a run of countertops. Each one adds roughly 2 linear feet to your backsplash total — count how many you have. If unsure, just leave as 0.
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <label style="font-size:14px;color:#374151;min-width:170px"><strong>No backsplash cabinets</strong> (lin ft)</label>
                <input type="number" id="mq-b-cab-bs-subtract" value="0" min="0" step="0.1" oninput="mqRefreshBsFt('b')" style="width:70px"/>
              </div>
              <div style="font-size:13px;color:#4b5563;margin-top:6px">Have an island or a section of counter from your base cabinet run that won't have backsplash? Enter the linear feet here and we'll subtract it off.</div>
              <div style="font-size:14px;color:#166534;margin-top:8px">Backsplash footage used: <strong id="mq-b-cab-bsft-net">0</strong> ft</div>
            </div>
          </div>
        </div>
        <div class="mq-sec"><p class="mq-sec-title" id="mq-b-ct-surfaces-title">Additional surfaces</p>
          <div id="mq-b-ct-surfaces"></div>
          <button class="mq-add-surface-btn" onclick="mqAddSurface('b')">+ Add another surface</button>
        </div>
        </div>
        <button class="mq-calc-btn mq-calc-btn-both" id="mq-b-calc-btn" onclick="mqCalcBoth()">Calculate full project estimate ✨</button>
        <div class="mq-loading" id="mq-b-loading">Building your full project estimate...</div>
        <div class="mq-combined-result" id="mq-b-result">
          <div class="mq-combined-title">✨ Full project estimate</div>
         <div class="mq-combined-section">
            <div class="mq-combined-section-title">🪵 Cabinets</div>
            <p class="mq-hint" id="mq-b-vanity-note" style="display:none;color:#1d4ed8;margin-bottom:6px"></p>
            <div id="mq-b-cab-rows"></div>
          </div>
          <div class="mq-combined-section">
            <div class="mq-combined-section-title">🪨 Countertops</div>
            <div id="mq-b-ct-rows"></div>
          </div>
          <div class="mq-grand-total">
            <div><div class="mq-grand-label">Total project estimate</div><div class="mq-grand-sub">Before tax · Customer sees this range</div></div>
            <div class="mq-grand-val" id="mq-b-grand">—</div>
          </div>
          <div style="text-align:right;margin-top:8px"><span style="display:inline-block;background:linear-gradient(135deg,#111,#1f1f1f);border:1px solid #fbbf24;border-radius:8px;padding:7px 14px;font-size:14px;font-weight:700;color:#fbbf24">💰 Your real total: <span id="mq-b-grand-real" style="color:#fff">—</span></span></div>
          <div class="mq-disclaimer" style="margin-top:1rem">⚠ ${disc}</div>
          <div style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:6px;padding:10px 12px;margin-top:8px;font-size:13px;color:#92400e;line-height:1.5">🔧 <strong>Handles & knobs not included</strong> in this estimate unless listed as a specialty item above.</div>
          <div class="mq-travel-note" style="margin-top:8px">${TRAVEL_NOTE}</div>
          <div class="mq-cta-row" style="margin-top:1rem">
            ${askQuestionBtn}
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
          </div>
          <div class="mq-cta-row">
            <button class="mq-pri" onclick="mqOpenProposalModal('b')">📄 Create proposal</button>
          </div>
          ${financingHTML}
          <div class="mq-powered-by"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Powered by <a href="https://www.midasquote.com" target="_blank" rel="noopener">MidasQuote</a></div>
        </div>
      </div>

      <!-- LEAD MODAL -->
      <div class="mq-overlay" id="mq-lead-overlay">
        <div class="mq-modal">
          <p class="mq-modal-title">Send a copy to yourself?</p>
          <p class="mq-modal-sub">Enter your email if you'd like this quote sent to you. Totally optional.</p>
          <div class="mq-modal-fields">
            <div class="mq-field"><label class="mq-label">Your email <span style="color:#6b7280;font-weight:400">(optional)</span></label><input type="email" id="mq-lead-email" placeholder="you@email.com"/></div>
          </div>
          <button class="mq-modal-btn" onclick="mqSubmitLead()">View estimate →</button>
          <button class="mq-modal-skip" onclick="mqSkipLead()">Skip</button>
        </div>
      </div>

      <!-- CONSULT EMAIL FALLBACK MODAL -->
      <div class="mq-overlay" id="mq-consult-email-overlay">
        <div class="mq-modal">
          <p class="mq-modal-title">Get in touch</p>
          <p class="mq-modal-sub">Send your question or consultation request to:</p>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:1.25rem;display:flex;align-items:center;justify-content:space-between;gap:10px">
            <span id="mq-consult-email-display" style="font-size:14px;font-weight:600;color:#111;word-break:break-all">—</span>
            <button class="mq-btn mq-btn-sm" id="mq-consult-email-copy-btn" onclick="mqCopyConsultEmail()" style="flex-shrink:0">Copy</button>
          </div>
          <button class="mq-modal-btn" onclick="mqOpenConsultMailto()">Open in email app ↗</button>
          <button class="mq-modal-skip" onclick="document.getElementById('mq-consult-email-overlay').classList.remove('show')">Close</button>
        </div>
      </div>`;
  }

  // ============================================================
  // WIRE LOGIC
  // ============================================================
  function wireWidget(data) {
    const { shop, pricing, specs, li, hasDynamic } = data;

    const drawerConfigNames = [...new Set(
      li.drawers.map(d => d['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim())
    )];

    function P() {
      const mat={}, door={}, drawer={}, hinge={};
      let installUWithDoors=0, installUNoDoors=0, installBWithDoors=0, installBNoDoors=0, installBSome=0, installBMostly=0, removalRate=0, taxRate=0;

      if (hasDynamic) {
        li.materials.forEach((m,i) => {
          const baseName = m._baseName || m['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim();
          const uItem = li.rawMaterials.find(r => r['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim() === baseName && r['Unit']?.includes('uppers'));
          const bItem = li.rawMaterials.find(r => r['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim() === baseName && r['Unit']?.includes('bases'));
          const fallbackRate = m['Rate'] || 0;
          mat[`dyn_${i}`] = { label:baseName, rateU:uItem?uItem['Rate']||0:fallbackRate, rateB:bItem?bItem['Rate']||0:fallbackRate };
        });
        li.doorStyles.forEach((d,i) => { door[`dyn_${i}`] = { label:d['Name'], rate:d['Rate']||0 }; });
        li.drawers.forEach(d => {
          const name = d['Name'];
          const baseName = name.replace(/\s*—\s*(some|mostly) drawers\s*$/i, '').trim();
          const tier = name.match(/—\s*(some|mostly) drawers\s*$/i)?.[1]?.toLowerCase();
          if (baseName && tier) {
            if (!drawer[baseName]) drawer[baseName] = {};
            drawer[baseName][tier] = d['Rate'] || 0;
          }
        });
        li.hinges.forEach((h,i) => { hinge[`dyn_${i}`] = { label:h['Name'], rate:h['Rate']||0 }; });

        // Install rates need to match whether doors are actually present — a
        // generic "upper" match (ignoring door status) or a hardcoded "with
        // doors" assumption for bases both silently used the wrong rate.
        // Look for explicit no-doors/with-doors variants first, and fall back
        // to a generic match only for shops that haven't split their pricing
        // that way, so nothing breaks for existing setups.
        const iuGeneric   = li.installItems.find(i=>i['Name']?.toLowerCase().includes('upper') && !i['Name']?.toLowerCase().includes('drawer'));
        const iuWithDoors = li.installItems.find(i=>i['Name']?.toLowerCase().includes('upper') && i['Name']?.toLowerCase().includes('with doors')) || iuGeneric;
        const iuNoDoors   = li.installItems.find(i=>i['Name']?.toLowerCase().includes('upper') && i['Name']?.toLowerCase().includes('no doors')) || iuGeneric;
        const ibWithDoors = li.installItems.find(i=>i['Name']?.toLowerCase().includes('base') && i['Name']?.toLowerCase().includes('with doors'));
        const ibNoDoors   = li.installItems.find(i=>i['Name']?.toLowerCase().includes('base') && i['Name']?.toLowerCase().includes('no doors')) || ibWithDoors;
        const ibSome   = li.installItems.find(i=>i['Name']?.toLowerCase().includes('some drawers'));
        const ibMostly = li.installItems.find(i=>i['Name']?.toLowerCase().includes('mostly drawers'));
        const rem      = li.otherItems.find(i=>i['Name']?.toLowerCase().includes('removal')) ||
                         li.installItems.find(i=>i['Name']?.toLowerCase().includes('removal'));
        const tax      = li.taxItems[0];
        installUWithDoors = iuWithDoors?iuWithDoors['Rate']||0:0;
        installUNoDoors   = iuNoDoors?iuNoDoors['Rate']||0:0;
        installBWithDoors = ibWithDoors?ibWithDoors['Rate']||0:0;
        installBNoDoors   = ibNoDoors?ibNoDoors['Rate']||0:0;
        installBSome   = ibSome?ibSome['Rate']||0:installBWithDoors;
        installBMostly = ibMostly?ibMostly['Rate']||0:installBWithDoors;
        removalRate    = rem?rem['Rate']||0:0;
        taxRate        = tax?(tax['Rate']||0)/100:0;
      } else {
        mat['melamine'] = {label:'Melamine', rateU:pricing['Melamine price']||280, rateB:pricing['Melamine price']||280};
        mat['plywood']  = {label:'Plywood',  rateU:pricing['Plywood price'] ||380, rateB:pricing['Plywood price'] ||380};
        door['slab']    = {label:'Slab',   rate:0};
        door['shaker']  = {label:'Shaker', rate:pricing['Shaker multiplier']||0};
        hinge['softclose'] = {label:'Soft-close', rate:pricing['Soft close hinges']||12};
        hinge['regular']   = {label:'Regular',    rate:0};
        installUWithDoors = installUNoDoors = pricing['Install rate uppers']||85;
        installBWithDoors = installBNoDoors = installUWithDoors;
        installBSome   = Math.round(installBWithDoors*1.10*100)/100;
        installBMostly = Math.round(installBWithDoors*1.15*100)/100;
        removalRate    = pricing['Removal rate']||18;
        taxRate        = (pricing['Tax rate']||5)/100;
      }
      return { mat, door, drawer, hinge, installUWithDoors, installUNoDoors, installBWithDoors, installBNoDoors, installBSome, installBMostly, removalRate };
    }

    // Legacy global fallback rates (used only if a material has no per-material
    // pricing yet — e.g. shop hasn't loaded the pricing helper to trigger migration).
    const legacyBsItem   = li.countertopItems.find(i=>(i['Description']||'').includes('type:backsplash'));
    const legacyBsInstallRate = legacyBsItem ? (legacyBsItem['Install rate']||0) : (pricing['Backsplash rate']||12);
    const legacySinkItem = li.countertopItems.find(i=>(i['Description']||'').includes('type:cutout')&&i['Name']?.toLowerCase().includes('sink'));
    const legacyCookItem = li.countertopItems.find(i=>(i['Description']||'').includes('type:cutout')&&(i['Name']?.toLowerCase().includes('cooktop')||i['Name']?.toLowerCase().includes('cook')));
    const legacySinkR = legacySinkItem ? (legacySinkItem['Rate']||180) : (pricing['Sink cutout']||180);
    const legacyCookR = legacyCookItem ? (legacyCookItem['Rate']||220) : (pricing['Cooktop cutout']||220);

    // Per-material backsplash options — falls back to a single legacy 4" option
    // if this material hasn't been migrated to per-material pricing yet.
    function bsOptionsFor(m) {
      if (m && Array.isArray(m.bsOptions) && m.bsOptions.length) return m.bsOptions;
      return [{label:'4" standard', heightIn:4, installRate:legacyBsInstallRate}];
    }
    // Per-material cutout options — falls back to legacy Sink/Cooktop globals
    // if this material hasn't been migrated to per-material pricing yet.
    function cutoutOptionsFor(m) {
      if (m && Array.isArray(m.cutoutOptions) && m.cutoutOptions.length) return m.cutoutOptions;
      return [{label:'Sink cutout', rate:legacySinkR}, {label:'Cooktop cutout', rate:legacyCookR}];
    }
    function bsOptsHtml(m) {
      return bsOptionsFor(m).map((o,i)=>`<option value="${i}">${(o.label||'Backsplash').replace(/"/g,'&quot;')}</option>`).join('');
    }
    function cutoutRowsHtml(m, idPrefix) {
      return cutoutOptionsFor(m).map((o,i)=>
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><label style="font-size:14px;color:#4b5563;min-width:110px">${(o.label||'Cutout').replace(/"/g,'&quot;')}</label><input type="number" id="${idPrefix}-${i}" value="0" min="0" max="10" style="width:55px"/></div>`
      ).join('');
    }

    const ctDepth  = 25.5;

    const diffOn={},specQty={},installQty={},surfCounts={},surfs={},tallCabs={},tallCabCounts={};
    let pendingCb=null;
    ['c','ct','b'].forEach(p=>{diffOn[p]=false;specQty[p]=new Array(specs.length).fill(0);installQty[p]=new Array(specs.length).fill(0);surfCounts[p]=0;surfs[p]={};tallCabs[p]={};tallCabCounts[p]=0;});

    function fmt(n){return '$'+Math.round(n).toLocaleString();}
    function gv(id){const e=document.getElementById(id);return e?e.value:'';}
    function gn(id,d=0){const v=parseFloat(gv(id));return isNaN(v)?d:v;}

    window.mqSwitchTab=(id,el)=>{
      document.querySelectorAll('.mq-tab-content').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.mq-tab').forEach(t=>t.classList.remove('active'));
      document.getElementById('mq-tab-'+id).classList.add('active');
      el.classList.add('active');
      if (id === 'cabinets') { mqRenumberSteps('c'); window.mqUpdateStepFocus('c'); }
      else if (id === 'both') { mqRenumberSteps('b'); window.mqUpdateStepFocus('b'); }
    };

    window.mqTogDiff=(prefix)=>{
      diffOn[prefix]=!diffOn[prefix];
      document.getElementById(`mq-${prefix}-diff-tog`).classList.toggle('on',diffOn[prefix]);
      document.getElementById(`mq-${prefix}-shared`).style.display=diffOn[prefix]?'none':'block';
      document.getElementById(`mq-${prefix}-diff`).style.display=diffOn[prefix]?'block':'none';
    };
    window.mqTogVanityNote=(prefix)=>{
      // Intentionally hidden from customers — the % adjustment itself still
      // fully applies in calcCabinet, this just stops announcing it on the
      // widget. Kept as a no-op function (rather than removing every call
      // site) so nothing else breaks.
      const note = document.getElementById(`mq-${prefix}-room-vanity-note`);
      if (note) note.style.display = 'none';
    };
    // Shows/hides specialty items based on the currently selected room. An
    // item with an empty visibleRooms list is visible everywhere (backward
    // compatible default for every item that's never had this configured).
    // If a previously-selected item gets hidden by the room switch, its
    // quantity resets to 0 so nothing stays silently "charged" for a room
    // it no longer applies to.
    window.mqRefreshRoomVisibility=(prefix)=>{
      const roomId = gv(`mq-${prefix}-room`);
      document.querySelectorAll(`[id^="mq-sp-${prefix}-"]`).forEach(el=>{
        let rooms=[];
        try { rooms = JSON.parse(el.getAttribute('data-rooms')||'[]'); } catch(e) { rooms=[]; }
        const visible = !rooms.length || rooms.includes(roomId);
        el.style.display = visible ? '' : 'none';
        if (!visible) {
          const idx = parseInt(el.id.split('-').pop(), 10);
          if (specQty[prefix] && specQty[prefix][idx] > 0) {
            specQty[prefix][idx] = 0;
            const qtyInput = document.getElementById(`mq-qty-${prefix}-${idx}`);
            if (qtyInput) qtyInput.value = 0;
            el.classList.remove('on');
          }
          if (installQty[prefix] && installQty[prefix][idx] > 0) {
            installQty[prefix][idx] = 0;
            const installQtyInput = document.getElementById(`mq-installqty-${prefix}-${idx}`);
            if (installQtyInput) installQtyInput.value = 0;
          }
        }
      });
      const specBody = document.getElementById(`mq-${prefix}-specialty-body`);
      if (specBody) {
        specBody.querySelectorAll('.mq-spec-category-group').forEach(group => {
          const anyVisible = [...group.querySelectorAll('.mq-spec-item')].some(item => item.style.display !== 'none');
          group.style.display = anyVisible ? '' : 'none';
        });
      }
    };
    // Shows the shop owner's custom guidance note for whichever project type
    // is selected — e.g. "For door refacing, skip the box materials below,
    // just add square footage under Specialty Items instead."
    // Per-room fallback images — used whenever a shop's own room data has this
  // field blank (not just when the whole Room types array is empty), so
  // clearing a single field on an already-customized shop still falls back
  // sensibly instead of just showing nothing. Only the 6 project types with
  // real default assets are covered; anything else (Refacing/Repainting/
  // Restaining, or a shop's own custom-named project type) has no fallback
  // and simply shows blank, same as before.
  const MQ_DEFAULT_COVER_IMAGES = {
    kitchen: 'https://aceswin.github.io/midasquote-widget/cover-images/kitchen.png',
    bathroom: 'https://aceswin.github.io/midasquote-widget/cover-images/bathroom.png',
    laundry: 'https://aceswin.github.io/midasquote-widget/cover-images/laundry.png',
    garage: 'https://aceswin.github.io/midasquote-widget/cover-images/garage.png',
    commercial: 'https://aceswin.github.io/midasquote-widget/cover-images/commercial.png',
    other: 'https://aceswin.github.io/midasquote-widget/cover-images/other.png',
  };
  const MQ_DEFAULT_MEASURE_IMAGES = {
    kitchen: 'https://aceswin.github.io/midasquote-widget/measure-guides/kitchen.png',
    bathroom: 'https://aceswin.github.io/midasquote-widget/measure-guides/bathroom.png',
    laundry: 'https://aceswin.github.io/midasquote-widget/measure-guides/laundry.png',
    garage: 'https://aceswin.github.io/midasquote-widget/measure-guides/garage.png',
    commercial: 'https://aceswin.github.io/midasquote-widget/measure-guides/commercial.png',
    other: 'https://aceswin.github.io/midasquote-widget/measure-guides/other.png',
  };

  // Matches a room to one of the 6 default-image keys above. Tries the id
  // first (the normal, fast path for anything using the standard ids), but
  // falls back to matching on the room's NAME too — since a room can end up
  // with a mismatched id (renamed from something else, or added as a custom
  // row that got an auto-generated room_<timestamp> id) while still clearly
  // being "Garage" or "Commercial" by name.
  function mqDefaultImageKey(room) {
    if (!room) return null;
    const id = (room.id||'').toLowerCase();
    if (MQ_DEFAULT_COVER_IMAGES[id]) return id;
    const name = (room.name||'').toLowerCase();
    if (name.includes('kitchen')) return 'kitchen';
    if (name.includes('bathroom')) return 'bathroom';
    if (name.includes('laundry')) return 'laundry';
    if (name.includes('garage')) return 'garage';
    if (name.includes('commercial')) return 'commercial';
    if (name.includes('other')) return 'other';
    return null;
  }

  window.mqShowRoomDescription=(prefix)=>{
      const descEl = document.getElementById(`mq-${prefix}-room-desc`);
      if (!descEl) return;
      const roomId = gv(`mq-${prefix}-room`);
      const room = (window._mqRoomTypes||[]).find(r=>r.id===roomId);
      const desc = room ? (room.description||'').trim() : '';
      const coverImg = room ? ((room.coverImage||'').trim() || MQ_DEFAULT_COVER_IMAGES[mqDefaultImageKey(room)] || '') : '';
      if (!desc && !coverImg) { descEl.style.display = 'none'; return; }
      descEl.innerHTML = ''; // clear previous content before rebuilding
      if (coverImg) {
        const img = document.createElement('img');
        img.src = coverImg;
        img.style.cssText = 'width:100%;max-height:160px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;cursor:zoom-in';
        img.onerror = () => { img.style.display = 'none'; };
        // Same tap-to-zoom lightbox as every other photo in the widget — a
        // lot of people instinctively try to click project type photos too.
        img.onclick = () => mqPhotoLightbox(coverImg, room && room.name ? room.name : 'Project photo');
        descEl.appendChild(img);
      }
      if (desc) {
        // textContent (not innerHTML) so the shop owner's own description
        // text can never be interpreted as markup, even by accident.
        const textDiv = document.createElement('div');
        textDiv.textContent = desc;
        descEl.appendChild(textDiv);
      }
      descEl.style.display = 'block';
    };
    // Swaps the "How to measure your space" guide to match whichever project
    // type is currently selected. Falls back to the standard generic guide
    // whenever that project type hasn't had its own custom text set — so
    // nothing changes for any shop/project type that's never touched this.
    // Image and text fall back independently of each other, so a shop that's
    // set one but not the other still gets the default for whichever one
    // they haven't touched.
    window.mqRefreshMeasureGuide=(prefix)=>{
      const guideEl = document.getElementById(`mq-${prefix}-measure-guide`);
      if (!guideEl) return;
      const roomId = gv(`mq-${prefix}-room`);
      const room = (window._mqRoomTypes||[]).find(r=>r.id===roomId);
      const customText = room ? (room.measureText||'').trim() : '';
      const customImg  = room ? ((room.measureImage||'').trim() || MQ_DEFAULT_MEASURE_IMAGES[mqDefaultImageKey(room)] || '') : '';
      guideEl.innerHTML = ''; // clear before rebuilding
      if (customImg) {
        const img = document.createElement('img');
        img.src = customImg;
        img.className = 'mq-measure-guide-img';
        // height:auto + object-fit:contain (not cover) so the whole image
        // always shows, never cropped — a fixed max-height with "cover" was
        // cropping top/bottom on wide desktop screens even though the same
        // image displayed fully on narrow mobile ones.
        img.style.cssText = 'width:100%;height:auto;max-height:480px;object-fit:contain;border-radius:6px;margin-bottom:4px;display:block;cursor:zoom-in';
        img.onerror = () => { img.style.display = 'none'; };
        // Same tap-to-zoom lightbox already used for every other photo in the
        // widget (materials, doors, specialty items, etc.) — works identically
        // on mobile and desktop.
        img.onclick = () => mqPhotoLightbox(customImg, room && room.name ? `${room.name} — measuring guide` : 'Measuring guide');
        guideEl.appendChild(img);
        const caption = document.createElement('div');
        caption.textContent = '🔍 Tap to enlarge';
        caption.style.cssText = 'text-align:center;font-size:12px;font-weight:700;color:#2563eb;margin-bottom:10px';
        guideEl.appendChild(caption);
      }
      if (!customText) {
        const defaultBody = document.createElement('div');
        defaultBody.innerHTML = defaultMeasureGuideHTML(roomId);
        guideEl.appendChild(defaultBody);
        return;
      }
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:600;margin-bottom:8px;color:#111';
      title.textContent = '📏 How to measure for this project';
      guideEl.appendChild(title);
      // Safe renderer (escapes everything, then allows only **bold** and line
      // breaks) so shop owners can format their guide like the default one
      // without any real markup ever reaching the page — see renderSafeGuideText.
      const body = document.createElement('div');
      body.innerHTML = renderSafeGuideText(customText);
      guideEl.appendChild(body);
    };
    // Covers every picker at once — materials, doors, hinges, drawer configs,
    // crown, valance, tall cabinets, and countertop materials — since they
    // all render as the same .mq-vpicker-row/.mq-vpicker-chip structure.
    // Scoped to just this tab's section so changing the room on the Cabinets
    // tab doesn't affect the Both tab's independently-set room, and vice versa.
    // If the currently selected option in any row becomes hidden, the first
    // still-visible option gets auto-selected instead of silently leaving a
    // hidden (and possibly still-priced) choice active.
    window.mqRefreshAllPickerVisibility=(prefix)=>{
      if (prefix !== 'c' && prefix !== 'b') return; // only Cabinets/Both tabs have a room selector
      const roomId = gv(`mq-${prefix}-room`);
      const scope = document.getElementById(prefix==='c' ? 'mq-tab-cabinets' : 'mq-tab-both');
      if (!scope) return;
      scope.querySelectorAll('.mq-vpicker-row').forEach(row=>{
        const rowSelectId = row.id.replace(/^mq-vprow-/, '');
        const groupFilter = (window._mqGroupFilter||{})[rowSelectId];
        let anyVisibleSelected=false, firstVisibleChip=null;
        row.querySelectorAll('.mq-vpicker-chip').forEach(chip=>{
          let rooms=[];
          try { rooms = JSON.parse(chip.getAttribute('data-rooms')||'[]'); } catch(e) { rooms=[]; }
          const roomOk = !rooms.length || rooms.includes(roomId);
          const chipGroup = chip.getAttribute('data-group');
          const groupOk = !groupFilter || chipGroup === groupFilter || chipGroup === '__always__';
          const visible = roomOk && groupOk;
          chip.style.display = visible ? '' : 'none';
          if (visible && !firstVisibleChip) firstVisibleChip = chip;
          if (visible && chip.classList.contains('selected')) anyVisibleSelected = true;
        });
        if (!anyVisibleSelected && firstVisibleChip) {
          const selectId = firstVisibleChip.getAttribute('data-vpicker-for');
          const btn = firstVisibleChip.querySelector('.mq-vpicker-select-btn');
          if (selectId && btn) window.mqPickVisual(selectId, btn);
        }
      });
    };
    // If a whole category has zero real (non-"None") options left for the
    // current project type, hide the entire section — not just the empty
    // picker, since e.g. a "Cabinet measurements" section with no box
    // material available doesn't make sense to show at all.
    // Gives the "Start here" feel a life beyond just the entrance — every
    // section after it gets a small matching numbered badge next to its
    // title, renumbered live as sections show/hide per project type (e.g.
    // Refacing skips box materials, some shops have no drawers configured,
    // etc.) so there are never gaps or a "step 4" appearing out of nowhere.
    function mqEnsureStepBadge(titleEl) {
      let badge = titleEl.querySelector('.mq-step-badge');
      if (badge) return badge;
      const text = titleEl.textContent;
      titleEl.innerHTML = '';
      titleEl.style.display = 'flex';
      titleEl.style.alignItems = 'center';
      titleEl.style.gap = '8px';
      badge = document.createElement('span');
      badge.className = 'mq-step-badge';
      titleEl.appendChild(badge);
      const label = document.createElement('span');
      label.textContent = text;
      titleEl.appendChild(label);
      return badge;
    }

    window.mqToggleCollapse = function(key) {
      const body = document.getElementById(`mq-${key}-body`);
      const arrow = document.getElementById(`mq-${key}-arrow`);
      const label = document.getElementById(`mq-${key}-label`);
      if (!body) return;
      const opening = body.style.display === 'none';
      body.style.display = opening ? 'block' : 'none';
      if (arrow) arrow.classList.toggle('open', opening);
      if (label) label.textContent = opening ? 'Close' : 'Open';
    };

    // Clicking anywhere in a closed section opens it (bigger, more forgiving
    // tap target than just the header row) — but closing stays deliberate,
    // only the header row itself does that, so clicking around inside an
    // already-open section (fields, buttons, etc.) never accidentally
    // collapses it back.
    window.mqOpenIfClosed = function(key) {
      const body = document.getElementById(`mq-${key}-body`);
      if (body && body.style.display === 'none') {
        window.mqToggleCollapse(key);
      }
    };

    // Shared by numbering, step-focus, and anything else that needs "every
    // currently-visible .mq-sec in this tab, in order" — one place to keep
    // that logic consistent.
    function mqScrollWithOffset(el, offsetPx) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.pageYOffset - (offsetPx || 80);
      window.scrollTo({ top, behavior: 'smooth' });
    }
    // Exposed globally so mqStartNewEstimate — a sibling function declared
    // outside wireWidget's scope — can actually reach this instead of
    // throwing a ReferenceError when the "Start a New Estimate" button
    // tries to call it.
    window.mqScrollWithOffset = mqScrollWithOffset;

    function mqGetVisibleSections(prefix) {
      const scopeId = prefix === 'c' ? 'mq-tab-cabinets' : (prefix === 'b' ? 'mq-tab-both' : null);
      const scope = scopeId && document.getElementById(scopeId);
      if (!scope) return [];
      return [...scope.querySelectorAll('.mq-sec')].filter(sec => sec.offsetParent !== null);
    }

    window.mqRenumberSteps = function(prefix) {
      const sections = mqGetVisibleSections(prefix);
      let stepNum = 2; // "1" stays reserved for Project basics' own big badge
      sections.forEach((sec, i) => {
        if (i === 0) return; // first visible section = Project basics
        const titleEl = sec.querySelector('.mq-sec-title');
        if (!titleEl) return;
        mqEnsureStepBadge(titleEl).textContent = stepNum;
        stepNum++;
      });
    };

    // ── Guided step focus ──
    // Every numbered section gets one of three looks: the CURRENT step is
    // fully lit up with a Continue/Back footer; DONE steps stay visible
    // (not hidden — someone might want to scroll back and double check
    // something) but dimmed with a small checkmark; UPCOMING steps are
    // dimmed too. Nothing is actually locked — a confident user can click
    // straight into an upcoming section and it just becomes the new current
    // step. Changing project type restarts the flow at step 1, since
    // section visibility itself may have changed.
    let _mqStepIndex = { c: 0, b: 0 };

    function mqEnsureStepFooter(sec, prefix, index, total) {
      const current = _mqStepIndex[prefix] || 0;
      let footer = sec.querySelector('.mq-step-footer');
      if (!footer) {
        footer = document.createElement('div');
        footer.className = 'mq-step-footer';
        sec.appendChild(footer);
      }
      if (index === current) {
        footer.style.display = 'flex';
        footer.innerHTML = `
          ${index > 0 ? `<button type="button" class="mq-step-back-btn" onclick="event.stopPropagation();mqStepBack('${prefix}')">← Back</button>` : '<span></span>'}
          <button type="button" class="mq-step-continue-btn" onclick="event.stopPropagation();mqStepContinue('${prefix}')">${index < total - 1 ? 'Continue →' : 'Done ✓'}</button>`;
      } else if (index < current) {
        footer.style.display = 'flex';
        footer.innerHTML = `<span></span><span class="mq-step-done-badge">✓ Done</span>`;
      } else {
        footer.style.display = 'none';
        footer.innerHTML = '';
      }
    }

    window.mqUpdateStepFocus = function(prefix) {
      const sections = mqGetVisibleSections(prefix);
      const current = _mqStepIndex[prefix] || 0;
      sections.forEach((sec, i) => {
        sec.classList.remove('mq-step-current', 'mq-step-done', 'mq-step-upcoming');
        sec.classList.add(i < current ? 'mq-step-done' : i === current ? 'mq-step-current' : 'mq-step-upcoming');
        mqEnsureStepFooter(sec, prefix, i, sections.length);
      });
      // If the current step is a collapsible section that's still closed,
      // open it automatically — no point being "the focused step" if its
      // content is hidden.
      const cur = sections[current];
      if (cur) {
        const body = cur.querySelector('[id$="-body"]');
        if (body && body.style.display === 'none') {
          const key = body.id.replace(/^mq-/, '').replace(/-body$/, '');
          window.mqToggleCollapse(key);
        }
      }
    };

    // Highlights whichever Calculate button belongs to this tab — used when
    // someone clicks "Done" on the last guided step, since there's nothing
    // left in the step flow itself to scroll to at that point. Scrolls to
    // it, pulses it, then actually clicks it after a short delay so the
    // scroll animation has time to land first — "Done" means done, not
    // "now go find and click a second button yourself."
    function mqHighlightCalcButton(prefix) {
      const btnId = prefix === 'c' ? 'mq-c-calc-btn' : (prefix === 'ct' ? 'mq-ct-calc-btn' : 'mq-b-calc-btn');
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.classList.remove('mq-calc-btn-pulse');
      void btn.offsetWidth;
      btn.classList.add('mq-calc-btn-pulse');
      setTimeout(() => btn.classList.remove('mq-calc-btn-pulse'), 1600);
      setTimeout(() => { if (!btn.disabled) btn.click(); }, 500);
    }

    window.mqStepContinue = function(prefix) {
      const sections = mqGetVisibleSections(prefix);
      const wasLast = (_mqStepIndex[prefix] || 0) >= sections.length - 1;
      _mqStepIndex[prefix] = Math.min((_mqStepIndex[prefix] || 0) + 1, sections.length - 1);
      window.mqUpdateStepFocus(prefix);
      if (wasLast) { mqHighlightCalcButton(prefix); return; }
      const next = sections[_mqStepIndex[prefix]];
      if (next) mqScrollWithOffset(next);
    };

    window.mqStepBack = function(prefix) {
      _mqStepIndex[prefix] = Math.max((_mqStepIndex[prefix] || 0) - 1, 0);
      window.mqUpdateStepFocus(prefix);
      const sections = mqGetVisibleSections(prefix);
      const cur = sections[_mqStepIndex[prefix]];
      if (cur) mqScrollWithOffset(cur);
    };

    // Clicking directly into any other section (ahead or already-done)
    // jumps the flow straight to it — nothing here is actually gated, this
    // just keeps the visual state honest for anyone navigating on their own,
    // in either direction (e.g. jumping back from Specialty Items to Doors
    // by tapping that section directly, same as scrolling up would).
    window.mqJumpToSectionIfNeeded = function(sec) {
      const tab = sec.closest('.mq-tab-content');
      if (!tab) return;
      const prefix = tab.id === 'mq-tab-cabinets' ? 'c' : (tab.id === 'mq-tab-both' ? 'b' : null);
      if (!prefix) return;
      const sections = mqGetVisibleSections(prefix);
      const idx = sections.indexOf(sec);
      if (idx !== -1 && idx !== (_mqStepIndex[prefix] || 0)) {
        _mqStepIndex[prefix] = idx;
        window.mqUpdateStepFocus(prefix);
      }
    };

    document.addEventListener('click', (e) => {
      const sec = e.target.closest('#midasquote-widget .mq-sec');
      if (!sec) return;
      mqJumpToSectionIfNeeded(sec);
    });

    window.mqRefreshSectionVisibility=(prefix)=>{
      if (prefix !== 'c' && prefix !== 'b') return;
      const roomId = gv(`mq-${prefix}-room`);
      function rowHasReal(selectId) {
        const row = document.getElementById(`mq-vprow-${selectId}`);
        if (!row) return false;
        let found = false;
        row.querySelectorAll('.mq-vpicker-chip').forEach(chip=>{
          if (chip.getAttribute('data-value')==='none') return; // "None" isn't a real option
          let rooms=[];
          try { rooms = JSON.parse(chip.getAttribute('data-rooms')||'[]'); } catch(e) { rooms=[]; }
          if (!rooms.length || rooms.includes(roomId)) found = true;
        });
        return found;
      }
      const cabActive = rowHasReal(`mq-${prefix}-mat`);
      const cabSec = document.getElementById(`mq-${prefix}-cabinet-measurements-sec`);
      if (cabSec) cabSec.style.display = cabActive ? '' : 'none';
      const roomObjForMeasuring = (window._mqRoomTypes||[]).find(r=>r.id===roomId);
      const measuringSec = document.getElementById(`mq-${prefix}-measuring-sec`);
      if (measuringSec) measuringSec.style.display = (roomObjForMeasuring && roomObjForMeasuring.hideMeasureGuide) ? 'none' : '';
      // The "Cabinet details" divider only exists on the Both tab
      const cabDivider = document.getElementById(`mq-${prefix}-cabinet-divider`);
      if (cabDivider) cabDivider.style.display = cabActive ? '' : 'none';
      // Supply+install is now its own section — hide it the same way, keeping
      // Project type/Measuring visible.
      const siField = document.getElementById(`mq-${prefix}-si-field`);
      if (siField) siField.style.display = cabActive ? '' : 'none';
      // Removal only makes sense if there's a cabinet being priced at all
      const removalSec = document.getElementById(`mq-${prefix}-removal-sec`);
      if (removalSec) removalSec.style.display = cabActive ? '' : 'none';

      const drawSec = document.getElementById(`mq-${prefix}-drawers-sec`);
      if (drawSec) drawSec.style.display = rowHasReal(`mq-${prefix}-drawer-config`) ? '' : 'none';

      const tcSec = document.getElementById(`mq-${prefix}-tallcabs-sec`);
      if (tcSec) {
        let anyReal = false;
        tcSec.querySelectorAll('.mq-vpicker-row').forEach(row=>{
          row.querySelectorAll('.mq-vpicker-chip').forEach(chip=>{
            if (chip.getAttribute('data-value')==='none') return;
            let rooms=[];
            try { rooms = JSON.parse(chip.getAttribute('data-rooms')||'[]'); } catch(e) { rooms=[]; }
            if (!rooms.length || rooms.includes(roomId)) anyReal = true;
          });
        });
        tcSec.style.display = anyReal ? '' : 'none';
      }

      const trimSec = document.getElementById(`mq-${prefix}-trim-sec`);
      if (trimSec) {
        const crownReal = rowHasReal(`mq-${prefix}-trim-crown`);
        const valanceReal = rowHasReal(`mq-${prefix}-trim-valance`);
        trimSec.style.display = (crownReal || valanceReal) ? '' : 'none';
      }
      // If there are no cabinet measurements to draw from, the "don't use
      // upper cabinet footage" checkbox doesn't make sense to show (there's
      // nothing to opt out of) — hide it and default straight to manual entry.
      const toggleWrap = document.getElementById(`mq-${prefix}-trim-manual-toggle-wrap`);
      const useCabWrap = document.getElementById(`mq-${prefix}-trim-use-cab-wrap`);
      const autoExplainer = document.getElementById(`mq-${prefix}-trim-auto-explainer`);
      const noAutoExplainer = document.getElementById(`mq-${prefix}-trim-noauto-explainer`);
      const manualWrap = document.getElementById(`mq-${prefix}-trim-manual-wrap`);
      const manualToggleCb = document.getElementById(`mq-${prefix}-trim-manual-toggle`);
      const useCabCb = document.getElementById(`mq-${prefix}-trim-use-cab`);
      if (toggleWrap) toggleWrap.style.display = cabActive ? 'flex' : 'none';
      if (useCabWrap) useCabWrap.style.display = cabActive ? 'flex' : 'none';
      if (autoExplainer) autoExplainer.style.display = cabActive ? 'block' : 'none';
      if (noAutoExplainer) noAutoExplainer.style.display = cabActive ? 'none' : 'block';
      if (!cabActive) {
        if (manualWrap) manualWrap.style.display = 'flex';
        if (manualToggleCb) manualToggleCb.checked = true; // keeps it consistent even though it's hidden
        if (useCabCb) useCabCb.checked = false;
      } else {
        // Cabinet boxes ARE part of this project type — default to using
        // those measurements for crown/valance too, since re-typing footage
        // that's already been measured once is exactly the busywork this
        // checkbox exists to skip. Unconditional, same as the no-cabinets
        // branch above — this re-asserts the sensible default whenever
        // project type/room changes, rather than only on first load.
        if (useCabCb) useCabCb.checked = true;
        if (manualToggleCb) manualToggleCb.checked = false;
        if (manualWrap) manualWrap.style.display = 'none';
      }

      // Countertop details — Both tab only (the standalone Countertops tab has
      // no room selector, so this never applies there). All countertop
      // material pickers (the main one + any added surfaces) share the same
      // underlying item list, so checking just the main one is representative.
      if (prefix === 'b') {
        const ctSec = document.getElementById('mq-b-countertop-details-sec');
        if (ctSec) ctSec.style.display = rowHasReal('mq-b-ct-mat-cab') ? '' : 'none';

        // Same idea as the crown/valance "use my upper cabinet measurements"
        // toggle above — if there are no base cabinets to pull footage from
        // at all, offering a checkbox to "use" them doesn't make sense.
        // Hide it and default straight to the countertop's own manual/
        // independent surface entry instead.
        const useCabWrapCt = document.getElementById('mq-b-use-cab-wrap');
        const useCabCbCt = document.getElementById('mq-b-use-cab');
        const surfTitle = document.getElementById('mq-b-ct-surfaces-title');
        const surfContainer = document.getElementById('mq-b-ct-surfaces');
        if (useCabWrapCt) useCabWrapCt.style.display = cabActive ? 'flex' : 'none';
        if (!cabActive && useCabCbCt && useCabCbCt.checked) {
          useCabCbCt.checked = false;
          window.mqTogUseCab('b');
        }
        if (surfTitle) surfTitle.textContent = cabActive ? 'Additional surfaces' : 'Surfaces';
        if (!cabActive && surfContainer && !surfContainer.children.length) {
          addSurfaceInternal('b', 'Kitchen run');
          surfContainer.dataset.autoAdded = 'true';
        } else if (cabActive && surfContainer && surfContainer.dataset.autoAdded === 'true') {
          surfContainer.innerHTML = '';
          surfContainer.dataset.autoAdded = 'false';
        }

        // With no cabinets, there's no cabinet-level Supply/Install setting
        // left to ask about at all — each surface already asks the question
        // itself. Hide the whole Countertop Options section rather than
        // just the "use my measurements" checkbox within it.
        const ctOptionsSec = document.getElementById('mq-b-ct-options-sec');
        if (ctOptionsSec) ctOptionsSec.style.display = cabActive ? '' : 'none';

        // "Same as project" on each surface's own Install dropdown only
        // means something when Countertop Options is actually visible to
        // set that project-level value — with it hidden, strip that choice
        // out entirely so nothing points at an invisible, unreachable
        // setting. Restored automatically if cabinets come back.
        document.querySelectorAll('[id^="mqssi-"]').forEach(sel => {
          const inheritOpt = sel.querySelector('option[value="inherit"]');
          if (!cabActive) {
            if (inheritOpt) {
              if (sel.value === 'inherit') sel.value = 'supply';
              inheritOpt.remove();
            }
          } else if (cabActive && !inheritOpt && sel.closest('#mq-b-ct-surfaces')) {
            const opt = document.createElement('option');
            opt.value = 'inherit';
            opt.textContent = 'Same as project';
            sel.insertBefore(opt, sel.firstChild);
          }
        });
      }
      mqRenumberSteps(prefix);
      window.mqUpdateStepFocus(prefix);
    };

    // Only an actual project type change restarts the guided flow at step 1
    // — mqRefreshSectionVisibility itself gets called from other places too
    // (like adding a tall cabinet card), which should refresh what's showing
    // without yanking someone back to the beginning of the flow.
    function mqResetPicker(selectId) {
      const firstChip = document.querySelector(`[data-vpicker-for="${selectId}"]`);
      if (!firstChip) return;
      const btn = firstChip.querySelector('.mq-vpicker-select-btn');
      if (btn) window.mqPickVisual(selectId, btn);
    }

    function mqResetCabinetForm(prefix) {
      const siSel = document.getElementById(`mq-${prefix}-si`);
      if (siSel) siSel.selectedIndex = 0;

      const uftEl = document.getElementById(`mq-${prefix}-uft`);
      if (uftEl) uftEl.value = 0;
      const bftEl = document.getElementById(`mq-${prefix}-bft`);
      if (bftEl) bftEl.value = 0;
      const htEl = document.getElementById(`mq-${prefix}-ht`);
      if (htEl) htEl.selectedIndex = 0;

      mqResetPicker(`mq-${prefix}-mat`);
      mqResetPicker(`mq-${prefix}-door`);
      mqResetPicker(`mq-${prefix}-hinge`);
      mqResetPicker(`mq-${prefix}-u-door`);

      const drawerTierEl = document.getElementById(`mq-${prefix}-drawer-tier`);
      if (drawerTierEl) drawerTierEl.selectedIndex = 0;
      mqResetPicker(`mq-${prefix}-drawer-config`);
      window.mqTogDrawerConfig(prefix);

      const tcContainer = document.getElementById(`mq-${prefix}-tallcabs`);
      if (tcContainer) tcContainer.innerHTML = '';
      renumberTallCabs(prefix);

      const useCabTrimCb = document.getElementById(`mq-${prefix}-trim-use-cab`);
      if (useCabTrimCb) useCabTrimCb.checked = false;
      mqResetPicker(`mq-${prefix}-trim-crown`);
      mqResetPicker(`mq-${prefix}-trim-valance`);
      const crownReturns = document.getElementById(`mq-${prefix}-trim-crown-returns`);
      if (crownReturns) crownReturns.value = 0;
      const valanceReturns = document.getElementById(`mq-${prefix}-trim-valance-returns`);
      if (valanceReturns) valanceReturns.value = 0;
      window.mqTogTrimReturns(prefix);

      const removalEl = document.getElementById(`mq-${prefix}-removal`);
      if (removalEl) removalEl.selectedIndex = 0;

      if (prefix === 'b') {
        const useCabCt = document.getElementById('mq-b-use-cab');
        if (useCabCt) useCabCt.checked = false;
        window.mqTogUseCab('b');
        const ctSurfaces = document.getElementById('mq-b-ct-surfaces');
        if (ctSurfaces) { ctSurfaces.innerHTML = ''; ctSurfaces.dataset.autoAdded = 'false'; }
        const ctSi = document.getElementById('mq-b-ct-si');
        if (ctSi) ctSi.selectedIndex = 0;
      }

      window.mqRefreshAllPickerVisibility(prefix);
      window.mqRefreshBsFt(prefix);
    }

    window.mqOnProjectTypeChange = function(prefix) {
      _mqStepIndex[prefix] = 0;
      mqResetCabinetForm(prefix);
      if (specQty[prefix]) {
        Object.keys(specQty[prefix]).forEach(i => {
          specQty[prefix][i] = 0;
          const qtyInput = document.getElementById(`mq-qty-${prefix}-${i}`);
          if (qtyInput) qtyInput.value = 0;
          document.getElementById(`mq-sp-${prefix}-${i}`)?.classList.remove('on');
          const modeSel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
          if (modeSel) modeSel.selectedIndex = 0;
          if (installQty[prefix]) installQty[prefix][i] = 0;
          const installQtyInput = document.getElementById(`mq-installqty-${prefix}-${i}`);
          if (installQtyInput) installQtyInput.value = 0;
          const installQtyRow = document.getElementById(`mq-spec-installqty-${prefix}-${i}`);
          if (installQtyRow) installQtyRow.style.display = 'none';
        });
      }
      mqRefreshSectionVisibility(prefix);
    };
    window.mqTogDwOption=(prefix)=>{
      const wrap = document.getElementById(`mq-${prefix}-cab-dw-wrap`);
      if (!wrap) return; // only exists on the Both tab
      const room = gv(`mq-${prefix}-room`);
      const showDw = room==='kitchen' || room==='other';
      wrap.style.display = showDw ? 'block' : 'none';
      if (!showDw) {
        const dwCheckbox = document.getElementById(`mq-${prefix}-cab-dw`);
        if (dwCheckbox && dwCheckbox.checked) {
          dwCheckbox.checked = false;
          mqRefreshBsFt(prefix);
        }
      }
    };

    window.mqTogTrimReturns=(prefix)=>{
      const crownKey=gv(`mq-${prefix}-trim-crown`);
      const valanceKey=gv(`mq-${prefix}-trim-valance`);
      const crownWrap=document.getElementById(`mq-${prefix}-trim-crown-returns-wrap`);
      const valanceWrap=document.getElementById(`mq-${prefix}-trim-valance-returns-wrap`);
      const showCrown=crownKey&&crownKey!=='none';
      const showValance=valanceKey&&valanceKey!=='none';
      if(crownWrap) crownWrap.style.display=showCrown?'block':'none';
      if(valanceWrap) valanceWrap.style.display=showValance?'block':'none';
    };
    window.mqTogTrimManualFt=(prefix)=>{
      const checked = document.getElementById(`mq-${prefix}-trim-manual-toggle`)?.checked;
      const wrap = document.getElementById(`mq-${prefix}-trim-manual-wrap`);
      if (wrap) wrap.style.display = checked ? 'flex' : 'none';
      // Keep the "Use my upper cabinet measurements" checkbox (shown before
      // the section unfolds) in sync — they're two views of the same choice.
      const useCabCb = document.getElementById(`mq-${prefix}-trim-use-cab`);
      if (useCabCb) useCabCb.checked = !checked;
    };

    // Checking "Use my upper cabinet measurements" (shown before the section
    // unfolds, same idea as the countertop's "Use my base cabinet
    // measurements") both switches to auto mode and unfolds the section —
    // unchecking it switches to manual mode without re-collapsing, since by
    // then the customer is likely mid-way through picking a style.
    window.mqTogTrimUseCab=(prefix)=>{
      const useCabCb = document.getElementById(`mq-${prefix}-trim-use-cab`);
      const manualCb = document.getElementById(`mq-${prefix}-trim-manual-toggle`);
      if (!useCabCb) return;
      if (manualCb) manualCb.checked = !useCabCb.checked;
      mqTogTrimManualFt(prefix);
      if (useCabCb.checked) {
        const body = document.getElementById(`mq-${prefix}-trim-body`);
        if (body && body.style.display === 'none') mqToggleCollapse(`${prefix}-trim`);
      }
    };

    // Highlights whichever crown/valance chip matches the current door
    // selection with the same green used in the suggestion note — a light
    // ring, not a hard border, so it layers cleanly whether or not that
    // chip also happens to be the one actually selected.
    function mqMarkSuggestedChip(selectId, matchKey) {
      document.querySelectorAll(`[data-vpicker-for="${selectId}"]`).forEach(c => c.classList.remove('mq-suggested'));
      if (!matchKey) return;
      const chip = document.querySelector(`[data-vpicker-for="${selectId}"][data-value="${matchKey}"]`);
      if (chip) chip.classList.add('mq-suggested');
    }

    window.mqApplyLinkedTrim=(prefix, doorKey)=>{
      const crownSelect=document.getElementById(`mq-${prefix}-trim-crown`);
      const valanceSelect=document.getElementById(`mq-${prefix}-trim-valance`);
      if(!crownSelect && !valanceSelect) return; // shop has no trim styles configured
      const noteId=`mq-${prefix}-trim-auto-note`;
      let note=document.getElementById(noteId);

      if(!doorKey || doorKey==='none'){
        if(crownSelect) crownSelect.value='none';
        if(valanceSelect) valanceSelect.value='none';
        if(note) note.style.display='none';
        mqMarkSuggestedChip(`mq-${prefix}-trim-crown`, null);
        mqMarkSuggestedChip(`mq-${prefix}-trim-valance`, null);
        mqTogTrimReturns(prefix);
        return;
      }

      const doorItem=(data.li.doorStyles||[])[parseInt(doorKey.replace('dyn_',''),10)];
      const doorName=doorItem?doorItem['Name']:'';

      const crownMatchKey=Object.keys(TRIM).find(k=>TRIM[k].type==='crown' && TRIM[k].linkedDoors && TRIM[k].linkedDoors.includes(doorName));
      const valanceMatchKey=Object.keys(TRIM).find(k=>TRIM[k].type==='valance' && TRIM[k].linkedDoors && TRIM[k].linkedDoors.includes(doorName));
      mqMarkSuggestedChip(`mq-${prefix}-trim-crown`, crownMatchKey);
      mqMarkSuggestedChip(`mq-${prefix}-trim-valance`, valanceMatchKey);

      // Don't auto-select — just show a suggestion note so the customer stays in control
      if(note){
        const suggestions=[];
        if(crownMatchKey) suggestions.push(TRIM[crownMatchKey].label);
        if(valanceMatchKey) suggestions.push(TRIM[valanceMatchKey].label);
        if(suggestions.length){ note.textContent=`💡 ${suggestions.join(' & ')} is typically used with this door style — add it below if you'd like it included`; note.style.display='block'; }
        else note.style.display='none';
      }
      mqTogTrimReturns(prefix);
    };

window.mqTogDrawerConfig=(prefix)=>{
      const tier=gv(`mq-${prefix}-drawer-tier`);
      const wrap=document.getElementById(`mq-${prefix}-drawer-config-wrap`);
      if(wrap) wrap.style.display=tier==='none'?'none':'block';
    };

    window.mqToggleSpec=(prefix,i)=>{if(specQty[prefix][i]===0){if(!mqSpecModeChosen(prefix,i))return;mqAdjQty(prefix,i,1);}else mqAdjQty(prefix,i,-specQty[prefix][i]);};
    window.mqAdjQty=(prefix,i,d)=>{
      if (d > 0 && !mqSpecModeChosen(prefix,i)) return;
      const allowDecimal = specs[i] && (specs[i].perFt || specs[i].perSqFt);
      let next = Math.max(0, specQty[prefix][i] + d);
      if (allowDecimal) next = Math.round(next * 10) / 10; // keep to one decimal place
      specQty[prefix][i]=next;
      const el=document.getElementById(`mq-qty-${prefix}-${i}`);
      if(el) el.value=specQty[prefix][i];
      document.getElementById(`mq-sp-${prefix}-${i}`)?.classList.toggle('on',specQty[prefix][i]>0);
    };
    window.mqSetQty=(prefix,i,val)=>{
      const allowDecimal = specs[i] && (specs[i].perFt || specs[i].perSqFt);
      const n = allowDecimal
        ? Math.max(0, Math.round((parseFloat(val)||0) * 10) / 10) // one decimal — e.g. linear/sq ft items
        : Math.max(0, parseInt(val,10)||0); // whole numbers — plain quantity items
      if (n > 0 && !mqSpecModeChosen(prefix,i)) {
        const el=document.getElementById(`mq-qty-${prefix}-${i}`);
        if(el) el.value = 0;
        return;
      }
      specQty[prefix][i]=n;
      document.getElementById(`mq-sp-${prefix}-${i}`)?.classList.toggle('on',n>0);
    };

    window.mqSpecModeChanged = function(prefix, i) {
      const row = document.getElementById(`mq-spec-installqty-${prefix}-${i}`);
      if (!row) return;
      const sel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
      row.style.display = (sel && sel.value === 'install') ? 'block' : 'none';
    };
    window.mqAdjInstallQty=(prefix,i,d)=>{
      const allowDecimal = specs[i] && (specs[i].installPerFt || specs[i].installPerSqFt);
      let next = Math.max(0, (installQty[prefix][i]||0) + d);
      if (allowDecimal) next = Math.round(next * 10) / 10;
      installQty[prefix][i]=next;
      const el=document.getElementById(`mq-installqty-${prefix}-${i}`);
      if(el) el.value=installQty[prefix][i];
    };
    window.mqSetInstallQty=(prefix,i,val)=>{
      const allowDecimal = specs[i] && (specs[i].installPerFt || specs[i].installPerSqFt);
      const n = allowDecimal
        ? Math.max(0, Math.round((parseFloat(val)||0) * 10) / 10)
        : Math.max(0, parseInt(val,10)||0);
      installQty[prefix][i]=n;
    };

    function renumberTallCabs(prefix){
      const container=document.getElementById(`mq-${prefix}-tallcabs`);
      if(!container) return;
      container.querySelectorAll('.mq-surface-num').forEach((el,i)=>{ el.textContent=i+1; });
    }
    function addTallCabInternal(prefix){
      tallCabCounts[prefix]++;
      const id=`tc${prefix}${tallCabCounts[prefix]}`;
      tallCabs[prefix][id]=0; // starts at 0 so the card (with photos) is visible right away without silently counting as "added"
      const containerId=`mq-${prefix}-tallcabs`;
      const card=document.createElement('div');
      card.className='mq-surface-card';
      card.id=`mq-tc-card-${id}`;
      card.innerHTML=`
        <div class="mq-surface-header">
          <div class="mq-surface-num">${tallCabCounts[prefix]}</div>
          <span style="font-size:14px;font-weight:500;color:#111;flex:1">Tall cabinet</span>
          <button class="mq-remove-btn" onclick="mqRemoveTallCab('${prefix}','${id}')">Remove</button>
        </div>
        <div class="mq-field" style="margin-bottom:10px">
          <label class="mq-label">Type</label>
          ${pickerRow(`mq-tc-type-${id}`, tallCabItems())}
          <select id="mq-tc-type-${id}" onchange="mqTogTallCabNone('${prefix}','${id}')" style="display:none">${tallCabOpts()}</select>
        </div>
        <div style="display:flex;align-items:flex-end;gap:2rem;flex-wrap:wrap">
          <div class="mq-field" style="margin-bottom:0">
            <label class="mq-label">Width (inches)</label>
            <input type="number" id="mq-tc-width-${id}" value="24" min="12" max="48" style="width:100px"/>
          </div>
          <div>
            <label class="mq-label" style="display:block;margin-bottom:5px">Quantity</label>
            <div class="mq-qty-ctrl">
              <button class="mq-qty-btn" onclick="mqAdjTallCabQty('${prefix}','${id}',-1)">−</button>
              <span class="mq-qty-val" id="mq-tc-qty-${id}">0</span>
              <button class="mq-qty-btn" onclick="mqAdjTallCabQty('${prefix}','${id}',1)">+</button>
            </div>
          </div>
        </div>`;
      document.getElementById(containerId)?.appendChild(card);
      renumberTallCabs(prefix);
      mqRefreshAllPickerVisibility(prefix);
      mqRefreshSectionVisibility(prefix);
    }
    window.mqAddTallCab=(prefix)=>addTallCabInternal(prefix);
    window.mqRemoveTallCab=(prefix,id)=>{
      document.getElementById(`mq-tc-card-${id}`)?.remove();
      delete tallCabs[prefix][id];
      renumberTallCabs(prefix);
    };
    window.mqAdjTallCabQty=(prefix,id,d)=>{
      tallCabs[prefix][id]=Math.max(0,(tallCabs[prefix][id]||0)+d);
      const el=document.getElementById(`mq-tc-qty-${id}`);
      if(el) el.textContent=tallCabs[prefix][id];
    };
    // Picking "None" zeroes the quantity out, same as before. Picking (or
    // switching to a different) real type auto-bumps quantity to 1 if it's
    // still sitting at 0 — every other picker in the widget "just works"
    // the moment you pick something, so tall cabinets shouldn't be the one
    // place someone has to remember a second step to also set a quantity.
    // Doesn't touch the quantity if they're switching between two real
    // types and already had some quantity set — only fills in the gap.
    window.mqTogTallCabNone=(prefix,id)=>{
      const type = gv(`mq-tc-type-${id}`);
      const el=document.getElementById(`mq-tc-qty-${id}`);
      if (type === 'none') {
        tallCabs[prefix][id]=0;
        if(el) el.textContent=0;
      } else if (!tallCabs[prefix][id]) {
        tallCabs[prefix][id]=1;
        if(el) el.textContent=1;
      }
    };

    window.mqShowLead=cb=>{
      pendingCb=cb;
      // Prefill from previously saved info so repeat visitors don't re-type
      try{
        const saved=JSON.parse(localStorage.getItem('mq_lead_info')||'null');
        if(saved){
          const emailEl=document.getElementById('mq-lead-email');
          if(emailEl&&!emailEl.value) emailEl.value=saved.email||'';
        }
      }catch(e){}
      const overlay=document.getElementById('mq-lead-overlay');
      overlay.classList.add('show');
      // Scroll the overlay into view so it appears at the user's current position
      overlay.scrollIntoView({behavior:'smooth',block:'center'});
    };
    window.mqSkipLead=()=>{
      document.getElementById('mq-lead-overlay').classList.remove('show');
      const lead={email:gv('mq-lead-email'),_isSkip:true};
      if(pendingCb){pendingCb(lead);pendingCb=null;}
    };
    window.mqSubmitLead=async()=>{
      const lead={email:gv('mq-lead-email')};
      // Remember for next time so they don't have to re-type
      try{localStorage.setItem('mq_lead_info',JSON.stringify(lead));}catch(e){}
      document.getElementById('mq-lead-overlay').classList.remove('show');
      if(pendingCb){pendingCb(lead);pendingCb=null;}
    };
    window.mqShowConsultModal=()=>{
      const shop=window._mqShopData||{};
      const consultUrl=(shop['Consultation link']||'').trim();
      const consultEmail=(shop['Consultation email']||'').trim();
      if(consultUrl){
        window.open(consultUrl,'_blank');
        return;
      }
      if(consultEmail){
        window._mqConsultEmail = consultEmail;
        const display = document.getElementById('mq-consult-email-display');
        if (display) display.textContent = consultEmail;
        const copyBtn = document.getElementById('mq-consult-email-copy-btn');
        if (copyBtn) copyBtn.textContent = 'Copy';
        document.getElementById('mq-consult-email-overlay')?.classList.add('show');
        return;
      }
      window.mqShowLead(()=>{});
    };

    window.mqOpenConsultMailto=()=>{
      const email = window._mqConsultEmail||'';
      if (!email) return;
      const shop=window._mqShopData||{};
      window.location.href='mailto:'+email+'?subject='+encodeURIComponent('Consultation request — '+(shop['Shop name']||''));
    };

    window.mqCopyConsultEmail=()=>{
      const email = window._mqConsultEmail||'';
      if (!email) return;
      const btn = document.getElementById('mq-consult-email-copy-btn');
      const resetLabel = () => { if (btn) btn.textContent = 'Copy'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(() => {
          if (btn) btn.textContent = 'Copied ✓';
          setTimeout(resetLabel, 2000);
        }).catch(() => { if (btn) btn.textContent = 'Copy failed'; setTimeout(resetLabel, 2000); });
      } else {
        // Fallback for older browsers without the Clipboard API
        const ta = document.createElement('textarea');
        ta.value = email;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); if (btn) btn.textContent = 'Copied ✓'; }
        catch(e) { if (btn) btn.textContent = 'Copy failed'; }
        document.body.removeChild(ta);
        setTimeout(resetLabel, 2000);
      }
    };

    function getMaterialRates(matKey, mat) {
      const m = mat[matKey];
      if (!m) return { rateU:0, rateB:0, label:'' };
      return { rateU:m.rateU??m.rate??0, rateB:m.rateB??m.rate??0, label:m.label||'' };
    }

    function calcCabinet(prefix) {
      const {mat,door,drawer,hinge,installUWithDoors,installUNoDoors,installBWithDoors,installBNoDoors,installBSome,installBMostly,removalRate}=P();
      // If the Cabinet measurements section is hidden (no real box material
      // for the current project type), treat linear footage as 0 regardless
      // of whatever's still sitting in those inputs — otherwise a hidden
      // section's leftover default values would still silently get charged.
      const cabSecEl = document.getElementById(`mq-${prefix}-cabinet-measurements-sec`);
      const cabSectionActive = !cabSecEl || cabSecEl.style.display !== 'none';
      const uFt = cabSectionActive ? gn(`mq-${prefix}-uft`,0) : 0;
      const bFt = cabSectionActive ? gn(`mq-${prefix}-bft`,0) : 0;
      const si=document.getElementById(`mq-${prefix}-si`)?gv(`mq-${prefix}-si`):'supply';
      const hMult={standard:1.0,tall:1.30}[gv(`mq-${prefix}-ht`)]||1.0;

      let uMatKey,uDoorKey,uHingeKey,bMatKey,bDoorKey,bHingeKey;
      if(diffOn[prefix]){
        uMatKey=gv(`mq-${prefix}-u-mat`);uDoorKey=gv(`mq-${prefix}-u-door`);uHingeKey=gv(`mq-${prefix}-u-hinge`)||'';
        bMatKey=gv(`mq-${prefix}-b-mat`);bDoorKey=gv(`mq-${prefix}-b-door`);bHingeKey=gv(`mq-${prefix}-b-hinge`)||'';
      } else {
        uMatKey=bMatKey=gv(`mq-${prefix}-mat`);
        uDoorKey=bDoorKey=gv(`mq-${prefix}-door`);
        uHingeKey=bHingeKey=gv(`mq-${prefix}-hinge`)||'';
      }

      const drawerTier       = gv(`mq-${prefix}-drawer-tier`) || 'none';
      const drawerConfigIdx  = parseInt(gv(`mq-${prefix}-drawer-config`) || '0');
      const drawerConfigName = drawerConfigNames[drawerConfigIdx] || '';
      const drawerRate       = drawerTier === 'none' ? 0 : (drawer[drawerConfigName]?.[drawerTier] || 0);

      const uMat      = getMaterialRates(uMatKey,mat);
      const bMat      = getMaterialRates(bMatKey,mat);
      const uDoorRate = uDoorKey==='none'?0:(door[uDoorKey]?.rate||0);
      const bDoorRate = bDoorKey==='none'?0:(door[bDoorKey]?.rate||0);
      const uHingeRate= uDoorKey==='none'?0:(hinge[uHingeKey]?.rate||0);
      const bHingeRate= bDoorKey==='none'?0:(hinge[bHingeKey]?.rate||0);

      // Cabinets in some rooms (like bathroom vanities) run smaller than
      // kitchen cabinets at the same linear footage — and now a project type
      // can carry up to three independent price adjustments: materials/box
      // cost, installation cost, and a final ballpark-wide adjustment. Lets a
      // shop do things like "Bathroom vanities run -5% on materials",
      // "Renovations run +10% on install since customers are living in the
      // house", or "Luxury package runs +15% on the whole ballpark" — any
      // combination, per project type. Falls back to the older single
      // "adjustment" field for any shop that hasn't touched this yet, so
      // nothing already saved silently stops working.
      const roomId = gv(`mq-${prefix}-room`);
      const roomObj = (window._mqRoomTypes||[]).find(r=>r.id===roomId);
      const materialAdjPct = roomObj ? (parseFloat(roomObj.materialAdjPct !== undefined ? roomObj.materialAdjPct : roomObj.adjustment) || 0) : 0;
      const upperMaterialAdjPct = roomObj ? (parseFloat(roomObj.upperMaterialAdjPct)||0) : 0;
      const installAdjPct  = roomObj ? (parseFloat(roomObj.installAdjPct)||0) : 0;
      const totalAdjPct    = roomObj ? (parseFloat(roomObj.totalAdjPct)||0) : 0;
      const hasRoomAdjustment = materialAdjPct !== 0;
      const roomAdjPct = materialAdjPct; // kept for anything still reading the old name
      const vanityMult = (100 + materialAdjPct) / 100;
      const upperVanityMult = (100 + upperMaterialAdjPct) / 100;
      const installMult = (100 + installAdjPct) / 100;

      const uInstall = (si==='install'?(uDoorKey==='none'?installUNoDoors:installUWithDoors):0) * installMult;
      const bInstall = (si==='install'?(
        drawerTier==='some'   ? installBSome   :
        drawerTier==='mostly' ? installBMostly :
        (bDoorKey==='none'?installBNoDoors:installBWithDoors)
      ):0) * installMult;

      // Material/door/hinge only — no install baked in, so it can show as its
      // own line item for the shop. Height multiplier still applies to the
      // whole upper-cabinet box (material + install together), same as before.
      const uMatDoorHinge = uMat.rateU * upperVanityMult + uDoorRate + uHingeRate;
      const bMatDoorHinge = bMat.rateB * vanityMult + bDoorRate + drawerRate + bHingeRate;
      const uPft  = (uMatDoorHinge + uInstall) * hMult;
      const bPft  = bMatDoorHinge + bInstall;
      const uCost = uFt*uPft, bCost=bFt*bPft;
      const uMatCost = uFt * uMatDoorHinge * hMult;
      const uInstallCost = uFt * uInstall * hMult;
      const bMatCost = bFt * bMatDoorHinge;
      const bInstallCost = bFt * bInstall;

      const lines=[];
      const uDoorLabel=uDoorKey==='none'?'No doors':(door[uDoorKey]?.label||'');
      const bDoorLabel=bDoorKey==='none'?'No doors':(door[bDoorKey]?.label||'');
      if(uFt>0) lines.push({label:`Upper cabinets — ${uMat.label} / ${uDoorLabel} (${uFt} lin ft)`,cost:Math.round(uMatCost)});
      if(uFt>0&&uInstallCost>0) lines.push({label:`Upper cabinet install (${uFt} lin ft)`,cost:Math.round(uInstallCost)});
      if(bFt>0) lines.push({label:`Base cabinets — ${bMat.label} / ${bDoorLabel} (${bFt} lin ft)`,cost:Math.round(bMatCost)});
      if(bFt>0&&bInstallCost>0) lines.push({label:`Base cabinet install (${bFt} lin ft)`,cost:Math.round(bInstallCost)});
      if(drawerRate>0&&bFt>0) lines.push({label:`Drawers — ${drawerConfigName} / ${drawerTier} (${bFt} lin ft bases)`,cost:Math.round(drawerRate*bFt)});

      // Tall cabinets — loop over every card the customer added. Each one
      // contributes its own cost (base price + door/material/install/hinge
      // upcharges) and its own linear footage toward crown/valance trim.
      let tallCabTotal = 0;
      let tcLinFtForTrim = 0;
      const tallCabLines = [];
      Object.keys(tallCabs[prefix] || {}).forEach(id => {
        if (!document.getElementById(`mq-tc-card-${id}`)) return; // card removed
        const tcQty = tallCabs[prefix][id] || 0;
        if (tcQty <= 0) return;
        const tcKey = gv(`mq-tc-type-${id}`);
        if (!tcKey || tcKey === 'none') return;
        const tcWidthIn = gn(`mq-tc-width-${id}`, 24);
        const tc = TALL_CAB[tcKey];
        if (!tc) return;
        const tcLinFt = tcWidthIn / 12;
        // Trim footage gets an extra 12" per cabinet for the return where crown/valance
        // transitions from this tall cabinet's depth back to the shallower upper cabinets —
        // kept separate from tcLinFt so it doesn't inflate the cabinet's own cost math.
        tcLinFtForTrim += ((tcWidthIn + 12) / 12) * tcQty;
        // Base unit price (from wizard — baseline mat, baseline door, supply only)
        let tcUnitPrice = tc.basePrice;
        // Door upcharge: (door rate per lin ft × tcLinFt) × 2.25 to account for full-height doors
        const doorKey = diffOn[prefix] ? gv(`mq-${prefix}-b-door`) : gv(`mq-${prefix}-door`);
        const doorUpchargePerFt = doorKey && doorKey !== 'none' ? (door[doorKey]?.rate || 0) : 0;
        tcUnitPrice += doorUpchargePerFt * tcLinFt * 2.25;
        // Material upcharge: difference above baseline material, per lin ft × tcLinFt × 2 (uppers + bases height equiv)
        const matKey = diffOn[prefix] ? gv(`mq-${prefix}-b-mat`) : gv(`mq-${prefix}-mat`);
        const tcMatRates = getMaterialRates(matKey, mat);
        const blMatRates = getMaterialRates(Object.keys(mat)[0], mat);
        const matUpcharge = Math.max(0, tcMatRates.rateB - blMatRates.rateB) * tcLinFt * 2;
        tcUnitPrice += matUpcharge;
        // Install: base install rate × tcLinFt × 2 if supply + install — door-aware, same as regular bases
        if (si === 'install') tcUnitPrice += (doorKey==='none'?installBNoDoors:installBWithDoors) * tcLinFt * 2 * installMult;
        // Hinge upcharge — only applies if doors are actually being added (no doors = no hinges needed)
        const hingeKey = diffOn[prefix] ? gv(`mq-${prefix}-b-hinge`) : gv(`mq-${prefix}-hinge`);
        const tcHingeRate = (hingeKey && doorKey && doorKey !== 'none') ? (hinge[hingeKey]?.rate || 0) : 0;
        tcUnitPrice += tcHingeRate * tcLinFt * 2.25;

        const tcCost = Math.round(tcUnitPrice * tcQty);
        tallCabTotal += tcCost;
        const tcDoorLabel = doorKey==='none'?'No doors':(door[doorKey]?.label||'');
        tallCabLines.push({label:`${tc.label} (${tcQty} × ${tcWidthIn}") · ${tcDoorLabel} · ${si==='install'?'Supply + install':'Supply only'}`, cost: tcCost});
      });

      let trimCost = 0;
      const useManualTrimFt = !cabSectionActive || document.getElementById(`mq-${prefix}-trim-manual-toggle`)?.checked;
      const manualTrimFt = useManualTrimFt ? gn(`mq-${prefix}-trim-manual-ft`, 0) : 0;
      const crownKey = gv(`mq-${prefix}-trim-crown`);
      if (crownKey && crownKey !== 'none' && TRIM[crownKey]) {
        const trim = TRIM[crownKey];
        const returns = gn(`mq-${prefix}-trim-crown-returns`, 0);
        const trimFt = useManualTrimFt ? (manualTrimFt + returns) : (uFt + returns + tcLinFtForTrim);
        const cost = trimFt * (trim.ps + trim.pi);
        trimCost += cost;
        const tcNote = (!useManualTrimFt && tcLinFtForTrim > 0) ? ` + ${tcLinFtForTrim.toFixed(1)} ft tall cabs` : '';
        const baseFtLabel = useManualTrimFt ? manualTrimFt : uFt;
        if (trimFt > 0) lines.push({label:`${trim.label} (${(baseFtLabel+returns).toFixed(0)} lin ft${tcNote})`,cost:Math.round(cost)});
      }
      const valanceKey = gv(`mq-${prefix}-trim-valance`);
      if (valanceKey && valanceKey !== 'none' && TRIM[valanceKey]) {
        const trim = TRIM[valanceKey];
        const returns = gn(`mq-${prefix}-trim-valance-returns`, 0);
        const trimFt = useManualTrimFt ? (manualTrimFt + returns) : (uFt + returns + tcLinFtForTrim);
        const cost = trimFt * (trim.ps + trim.pi);
        trimCost += cost;
        const tcNote = (!useManualTrimFt && tcLinFtForTrim > 0) ? ` + ${tcLinFtForTrim.toFixed(1)} ft tall cabs` : '';
        const baseFtLabel = useManualTrimFt ? manualTrimFt : uFt;
        if (trimFt > 0) lines.push({label:`${trim.label} (${(baseFtLabel+returns).toFixed(0)} lin ft${tcNote})`,cost:Math.round(cost)});
      }
      lines.push(...tallCabLines);

      let specTotal=0;
      specs.forEach((s,i)=>{
        if(!specQty[prefix][i]) return;
        const supplyQty = specQty[prefix][i];
        const supplyCost = s.price * supplyQty;
        const supplyQtyLabel = s.perSqFt?`${supplyQty} sqft`:(s.perFt?`${supplyQty} ft`:(supplyQty>1?`× ${supplyQty}`:''));

        if (!s.offersInstallChoice) {
          specTotal += supplyCost;
          lines.push({label:supplyQtyLabel?`${s.label} (${supplyQtyLabel})`:s.label,cost:Math.round(supplyCost)});
          return;
        }

        const modeSel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
        const mode = modeSel ? modeSel.value : 'supply';
        if (mode !== 'install') {
          specTotal += supplyCost;
          lines.push({label:supplyQtyLabel?`${s.label} (${supplyQtyLabel}) — Supply only`:`${s.label} — Supply only`,cost:Math.round(supplyCost)});
          return;
        }

        const supplyKind = s.perFt ? 'linear' : (s.perSqFt ? 'sqft' : 'item');
        const installKind = s.installPerFt ? 'linear' : (s.installPerSqFt ? 'sqft' : 'item');
        const installQtyVal = (installKind !== supplyKind) ? (installQty[prefix][i] || 0) : supplyQty;
        const installCost = s.installPrice * installQtyVal;
        const installQtyLabel = s.installPerSqFt?`${installQtyVal} sqft`:(s.installPerFt?`${installQtyVal} ft`:(installQtyVal>1?`× ${installQtyVal}`:''));
        specTotal += supplyCost + installCost;
        lines.push({label:supplyQtyLabel?`${s.label} (${supplyQtyLabel}) — Supply`:`${s.label} — Supply`,cost:Math.round(supplyCost)});
        lines.push({label:installQtyLabel?`${s.label} (${installQtyLabel}) — Install`:`${s.label} — Install`,cost:Math.round(installCost)});
      });

      const remEl=document.getElementById(`mq-${prefix}-removal`);
      const remCost=remEl&&remEl.value==='yes'?(uFt+bFt)*removalRate:0;
      if(remCost>0) lines.push({label:'Cabinet removal',cost:Math.round(remCost)});

      const sub=uCost+bCost+specTotal+tallCabTotal+remCost+trimCost;
      const totalMult = (100 + totalAdjPct) / 100;
      const total = sub * totalMult;
      lines.push({label:'Subtotal (before tax)',cost:Math.round(total),bold:true});

      const low=Math.round(total*(window._mqRangeLow||0.95)/100)*100, high=Math.round(total*(window._mqRangeHigh||1.20)/100)*100;
      const roomLabel = roomObj ? roomObj.name : 'Cabinet';
      return {lines,sub:Math.round(total),total:Math.round(total),low,high,roomLabel,si,uFt,bFt,hasRoomAdjustment,roomAdjPct,roomName:roomLabel};
    }

    function calcCountertop(prefix) {
      // Same fix as cabinets — if the whole Countertop details section is
      // hidden (no real countertop material for this project type), don't
      // charge for anything left over in the inputs, including any
      // previously-added surfaces from before the project type was switched.
      if (prefix === 'b') {
        const ctSecEl = document.getElementById('mq-b-countertop-details-sec');
        if (ctSecEl && ctSecEl.style.display === 'none') {
          return {lines:[],sub:0,total:0,low:0,high:0};
        }
      }
      const {removalRate}=P();
      const ctSiId=prefix==='ct'?'mq-ct-si':'mq-b-ct-si';
      const lines=[]; let sub=0;

      const useCabMeasure = document.getElementById(`mq-${prefix}-use-cab`)?.checked;
      if (useCabMeasure) {
        const bFt   = gn(`mq-${prefix}-bft`, 0);
        const matId = prefix==='ct' ? 'mq-ct-ct-mat-cab' : `mq-${prefix}-ct-mat-cab`;
        const bsId  = prefix==='ct' ? 'mq-ct-cab-bs'     : `mq-${prefix}-cab-bs`;
        const coId  = prefix==='ct' ? 'mq-ct-cab-co'     : `mq-${prefix}-cab-co`;
        const cutsId= prefix==='ct' ? 'mq-ct-cab-cuts'   : `mq-${prefix}-cab-cuts`;
        const bsSubtractId = `mq-${prefix}-cab-bs-subtract`;
        const bsSidesId = `mq-${prefix}-cab-bs-sides`;
        const dwChecked = document.getElementById(`mq-${prefix}-cab-dw`)?.checked;
        const extraChecked = document.getElementById(`mq-${prefix}-cab-extra-toggle`)?.checked;
        const extraFt = extraChecked ? gn(`mq-${prefix}-cab-extra-ft`, 0) : 0;
        const totalCtFt = bFt + (dwChecked?2:0) + extraFt;
        if (totalCtFt > 0) {
          const linFt = totalCtFt;
          const sqft  = linFt * (ctDepth / 12);
          const mat   = gv(matId);
          const si    = gv(ctSiId);
          const m     = CT_MAT[mat] || Object.values(CT_MAT)[0];
          if (m) {
            const supplyCost  = m.supplyUnit  === 'lin ft' ? linFt*m.ps : sqft*m.ps;
            const installCost = si==='install' ? (m.installUnit==='lin ft' ? linFt*m.pi : sqft*m.pi) : 0;
            const bsVal = gv(bsId);
            const bsOpt = (bsVal && bsVal!=='none') ? bsOptionsFor(m)[parseInt(bsVal,10)] : null;
            // Backsplash only runs along walls — add 2 ft per side splash, then
            // net out any feet the customer flagged as islands or other runs
            // without backsplash. Mirrors the live readout in mqRefreshBsFt.
            const bsLinFt = Math.max(0, (linFt + gn(bsSidesId, 0)*2) - gn(bsSubtractId, 0));
            let bsCost = 0;
            if (bsOpt && bsLinFt > 0) {
              const heightIn = bsOpt.heightIn || 4;
              const bsSqft   = bsLinFt * (heightIn/12);
              const bsRate   = bsOpt.supplyRate!=null ? bsOpt.supplyRate : m.ps;
              const bsSupplyUnit  = bsOpt.supplyUnit  || m.supplyUnit  || 'sqft';
              const bsInstallUnit = bsOpt.installUnit || m.installUnit || 'lin ft';
              const bsSupply  = bsSupplyUnit  === 'lin ft' ? bsLinFt*bsRate : bsSqft*bsRate;
              const bsInstall = si==='install' ? (bsInstallUnit === 'lin ft' ? bsLinFt*(bsOpt.installRate||0) : bsSqft*(bsOpt.installRate||0)) : 0;
              bsCost = bsSupply + bsInstall;
            }
            const coChecked = document.getElementById(coId)?.checked;
            const cutoutCost = coChecked ? cutoutOptionsFor(m).reduce((sum,o,i)=>sum+gn(`${cutsId}-q-${i}`)*(o.rate||0),0) : 0;
            const cost = supplyCost + installCost + bsCost + cutoutCost;
            sub += cost;
            lines.push({label:`Cabinet run — ${m.label} (${linFt} lin ft, ~${Math.round(sqft*10)/10} sqft) · ${si==='install'?'Supply + install':'Supply only'}${(bsOpt&&bsLinFt>0)?` + backsplash (${bsOpt.label}, ${bsLinFt} lin ft)`:''}`, cost:Math.round(cost)});
          }
        }
      }

      Object.keys(surfs[prefix]).forEach(id=>{
        if(!document.getElementById('mqsc-'+id)) return;
        const mat=gv('mqsm-'+id);
        const siOv=gv('mqssi-'+id), si=siOv==='inherit'?gv(ctSiId):(siOv||'supply');
        const m=CT_MAT[mat]||Object.values(CT_MAT)[0];
        if (!m) return;
        const w=gn('mqsw-'+id,0), d=gn('mqsd-'+id,ctDepth);
        const sqft=(w*(d||ctDepth))/144;
        const linFt=w/12;
        const supplyCost  = m.supplyUnit  === 'lin ft' ? linFt*m.ps : sqft*m.ps;
        const installCost = si==='install' ? (m.installUnit==='lin ft' ? linFt*m.pi : sqft*m.pi) : 0;
        const bsVal = gv('mqsbs-'+id);
        const bsOpt = (bsVal && bsVal!=='none') ? bsOptionsFor(m)[parseInt(bsVal,10)] : null;
        // Backsplash only runs along walls — add 2 ft per side splash, then net
        // out any feet flagged as no-backsplash. Mirrors mqRefreshSurfBsFt.
        const bsLinFt = Math.max(0, (linFt + gn(`mqs-bs-sides-${id}`, 0)*2) - gn(`mqs-bs-subtract-${id}`, 0));
        let bsCost = 0;
        if (bsOpt && bsLinFt > 0) {
          const heightIn = bsOpt.heightIn || 4;
          const bsSqft   = bsLinFt*(heightIn/12);
          const bsRate   = bsOpt.supplyRate!=null ? bsOpt.supplyRate : m.ps;
          const bsSupplyUnit  = bsOpt.supplyUnit  || m.supplyUnit  || 'sqft';
          const bsInstallUnit = bsOpt.installUnit || m.installUnit || 'lin ft';
          const bsSupply  = bsSupplyUnit  === 'lin ft' ? bsLinFt*bsRate : bsSqft*bsRate;
          const bsInstall = si==='install' ? (bsInstallUnit === 'lin ft' ? bsLinFt*(bsOpt.installRate||0) : bsSqft*(bsOpt.installRate||0)) : 0;
          bsCost = bsSupply + bsInstall;
        }
        const cost = supplyCost+installCost+bsCost
          +(document.getElementById('mqsco-'+id)?.checked?cutoutOptionsFor(m).reduce((sum,o,i)=>sum+gn(`mqscuts-${id}-q-${i}`)*(o.rate||0),0):0);
        sub+=cost;
        lines.push({label:`${gv('mqsn-'+id)||'Surface'} — ${m.label} (${Math.round(sqft*10)/10} sqft, ${Math.round(linFt*10)/10} lin ft) · ${si==='install'?'Supply + install':'Supply only'}${(bsOpt&&bsLinFt>0)?` + backsplash (${bsOpt.label}, ${Math.round(bsLinFt*10)/10} lin ft)`:''}`,cost:Math.round(cost)});
      });

      lines.push({label:'Subtotal (before tax)',cost:Math.round(sub),bold:true});
      const total=sub;
      return {lines,sub:Math.round(sub),total:Math.round(total),low:Math.round(total*(window._mqRangeLow||0.95)/100)*100,high:Math.round(total*(window._mqRangeHigh||1.20)/100)*100};
    }

    function renderResult(rangeEl,listEl,result){
      document.getElementById(rangeEl).textContent=fmt(result.low)+' – '+fmt(result.high);
      // Real total lives right next to the range element — same id with
      // "-range" swapped for "-real" everywhere this gets called.
      const realEl = document.getElementById(rangeEl.replace('-range','-real'));
      if (realEl) realEl.textContent = fmt(result.total);
      const ul=document.getElementById(listEl);ul.innerHTML='';
      const sorted=[...result.lines].filter(l=>!l.bold).sort((a,b)=>b.cost-a.cost);
      sorted.forEach(l=>{
        const li=document.createElement('li');
        li.innerHTML=`<span class="mq-li-lbl">✓ ${l.label}</span><span style="float:right;font-weight:600;color:#166534">${fmt(l.cost)}</span>`;
        ul.appendChild(li);
      });
    }

    window.mqCalcCabinets=()=>{
      if (!mqValidateInstallQty('c')) return;
      window.mqShowLead(async lead=>{
        document.getElementById('mq-c-calc-btn').disabled=true;
        document.getElementById('mq-c-loading').classList.add('show');
        document.getElementById('mq-c-result').classList.remove('show');
        const r=calcCabinet('c');
        document.getElementById('mq-c-res-title').textContent=r.roomLabel+' cabinet estimate';
        document.getElementById('mq-c-res-sub').textContent=`${r.uFt} ft uppers · ${r.bFt} ft bases · ${r.si==='install'?'Supply + install':'Supply only'}`;
        const vanityNoteC = document.getElementById('mq-c-vanity-note');
        // Intentionally hidden from customers — pricing still reflects the
        // room adjustment (r.hasRoomAdjustment/r.roomAdjPct), this just
        // stops announcing it in the results panel.
        if (vanityNoteC) vanityNoteC.style.display = 'none';
        renderResult('mq-c-res-range','mq-c-line-items',r);
        window._mqLastEstimate = Object.assign(window._mqLastEstimate || {}, { c: { projectType: r.roomLabel + ' — Cabinets', lines: r.lines, total: r.total } });
        document.getElementById('mq-c-loading').classList.remove('show');
        document.getElementById('mq-c-result').classList.add('show');mqScrollWithOffset(document.getElementById('mq-c-result'));window.mqShowStartOverPanel();
        document.getElementById('mq-c-calc-btn').disabled=false;
        if(lead) await saveLead(data,lead,'Cabinets',r.low,r.high,r.lines,r.total);
      });
    };

    window.mqCalcCountertops=()=>{
      const hasSurfaces=Object.keys(surfs['ct']).filter(id=>document.getElementById('mqsc-'+id)).length>0;
      if(!hasSurfaces){alert('Please add at least one surface.');return;}
      window.mqShowLead(async lead=>{
        document.getElementById('mq-ct-calc-btn').disabled=true;
        document.getElementById('mq-ct-loading').classList.add('show');
        document.getElementById('mq-ct-result').classList.remove('show');
        setTimeout(async()=>{
          const r=calcCountertop('ct');
          const active=Object.keys(surfs['ct']).filter(id=>document.getElementById('mqsc-'+id)).length;
          document.getElementById('mq-ct-res-sub').textContent=`${active} surface(s)`;
          renderResult('mq-ct-res-range','mq-ct-line-items',r);
          window._mqLastEstimate = Object.assign(window._mqLastEstimate || {}, { ct: { projectType: 'Countertops', lines: r.lines, total: r.total } });
          document.getElementById('mq-ct-loading').classList.remove('show');
          document.getElementById('mq-ct-result').classList.add('show');mqScrollWithOffset(document.getElementById('mq-ct-result'));window.mqShowStartOverPanel();
          document.getElementById('mq-ct-calc-btn').disabled=false;
          if(lead) await saveLead(data,lead,'Countertops',r.low,r.high,r.lines,r.total);
        },900);
      });
    };

    window.mqCalcBoth=()=>{
      if (!mqValidateInstallQty('b')) return;
      window.mqShowLead(async lead=>{
        document.getElementById('mq-b-calc-btn').disabled=true;
        document.getElementById('mq-b-loading').classList.add('show');
        document.getElementById('mq-b-result').classList.remove('show');
        setTimeout(async()=>{
          const cab=calcCabinet('b'),ct=calcCountertop('b');
          const vanityNoteB = document.getElementById('mq-b-vanity-note');
          // Intentionally hidden from customers — pricing still reflects the
          // room adjustment (cab.hasRoomAdjustment/cab.roomAdjPct), this just
          // stops announcing it in the results panel.
          if (vanityNoteB) vanityNoteB.style.display = 'none';
          const cabRows=document.getElementById('mq-b-cab-rows');cabRows.innerHTML='';
          [...cab.lines].filter(l=>!l.bold).sort((a,b)=>b.cost-a.cost).forEach(l=>{const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">✓ ${l.label}</span><span style="float:right;font-weight:600;color:#166534">${fmt(l.cost)}</span>`;cabRows.appendChild(d);});
          const ctRows=document.getElementById('mq-b-ct-rows');ctRows.innerHTML='';
          [...ct.lines].filter(l=>!l.bold).sort((a,b)=>b.cost-a.cost).forEach(l=>{const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">✓ ${l.label}</span><span style="float:right;font-weight:600;color:#166534">${fmt(l.cost)}</span>`;ctRows.appendChild(d);});
          if(!ctRows.children.length){const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">None selected</span>`;ctRows.appendChild(d);}
          const tl=cab.low+ct.low,th=cab.high+ct.high;
          document.getElementById('mq-b-grand').textContent=fmt(tl)+' – '+fmt(th);
          const realTotalEl = document.getElementById('mq-b-grand-real');
          if (realTotalEl) realTotalEl.textContent = fmt(cab.total + ct.total);
          window._mqLastEstimate = Object.assign(window._mqLastEstimate || {}, { b: { projectType: 'Cabinets + Countertops', lines: [...cab.lines.filter(l=>!l.bold), ...ct.lines.filter(l=>!l.bold)], total: cab.total + ct.total } });
          document.getElementById('mq-b-loading').classList.remove('show');
          document.getElementById('mq-b-result').classList.add('show');mqScrollWithOffset(document.getElementById('mq-b-result'));window.mqShowStartOverPanel();
          document.getElementById('mq-b-calc-btn').disabled=false;
          if(lead) await saveLead(data,lead,'Cabinets + Countertops',tl,th,[{label:'Cabinets',header:true},...cab.lines,{label:'Countertops',header:true},...ct.lines],cab.total+ct.total);
        },1200);
      });
    };

    function addSurfaceInternal(prefix,name){
      surfCounts[prefix]++;
      const id=`s${prefix}${surfCounts[prefix]}`;
      surfs[prefix][id]=1;
      const hasCtInstall = hasCountertopInstall();
      const names=['Kitchen run','Island top','Bathroom vanity','Bar top','Custom surface'];
      const n=name||names[Math.min(surfCounts[prefix]-1,names.length-1)];
      const containerId=prefix==='ct'?'mq-ct-surfaces':'mq-'+prefix+'-ct-surfaces';
      const card=document.createElement('div');
      card.className='mq-surface-card';card.id='mqsc-'+id;
      card.innerHTML=`
        <div class="mq-surface-header">
          <div class="mq-surface-num">${surfCounts[prefix]}</div>
          <input id="mqsn-${id}" value="${n}" style="font-size:14px;font-weight:500;color:#111;background:none;border:none;outline:none;flex:1;font-family:inherit"/>
          <button class="mq-remove-btn" onclick="mqRemoveSurf('${prefix}','${id}')">Remove</button>
        </div>
        <div class="mq-grid3" style="margin-bottom:1rem">
          <div class="mq-field"><label class="mq-label">Width (inches)</label><input type="number" id="mqsw-${id}" placeholder="e.g. 120" oninput="mqCalcSurfDims('${id}')"/></div>
          <div class="mq-field"><label class="mq-label">Depth (inches)</label><input type="number" id="mqsd-${id}" placeholder="${ctDepth}" value="${ctDepth}" oninput="mqCalcSurfDims('${id}')"/></div>
          <div class="mq-field"><label class="mq-label" style="color:#16a34a">Auto-calculated</label>
            <div style="font-size:14px;color:#4b5563;padding:7px 0" id="mqsdims-${id}">Enter width & depth</div></div>
        </div>
        <div class="mq-grid2" style="margin-bottom:1rem">
          <div class="mq-field"><label class="mq-label">Material</label>
            ${pickerRow(`mqsm-${id}`, ctMatItems(), null, 'countertop')}
            <select id="mqsm-${id}" onchange="mqRefreshBsOpts('mqsm-${id}','mqsbs-${id}');mqRefreshCutoutOpts('mqsm-${id}','mqscuts-${id}');mqRefreshSurfBsFt('${id}')" style="display:none">${ctMatOpts()}</select></div>
          <div class="mq-field"><label class="mq-label">${hasCtInstall ? 'Install' : 'Supply'}</label>
            <select id="mqssi-${id}">${hasCtInstall ? `${prefix==='ct'?'':'<option value="inherit">Same as project</option>'}<option value="supply">Supply only</option><option value="install">Supply + install</option>` : '<option value="supply">Supply only</option>'}</select></div>
        </div>
        <div class="mq-divider"></div>
        <label class="mq-check-row"><input type="checkbox" id="mqsco-${id}" onchange="mqTogCuts('${id}')" style="width:auto;flex-shrink:0"/> Cutouts needed</label>
        <div id="mqscuts-${id}" style="display:none;margin-top:8px;margin-bottom:0.75rem;padding:10px 12px;background:#f9fafb;border-radius:6px"></div>
        <div class="mq-field" style="margin-bottom:0.75rem">
          <label class="mq-label">Backsplash</label>
          <select id="mqsbs-${id}" style="min-width:160px" onchange="mqRefreshSurfBsFt('${id}')"><option value="none">None</option></select>
        </div>
        <div id="mqs-bsft-block-${id}" style="display:none;margin-top:8px;padding:10px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px">
          <div style="font-size:14px;color:#166534;margin-bottom:8px">Backsplash linear footage (auto): <strong id="mqs-bsft-auto-${id}">0</strong> ft — based on the width above.</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            ${termHelpThumb(MQ_TERM_IMAGES.sidesplash,'What is a side splash?',36,false)}<label style="font-size:14px;color:#374151"><strong>Side splashes</strong> (Quantity)</label>
            <input type="number" id="mqs-bs-sides-${id}" value="0" min="0" max="10" oninput="mqRefreshSurfBsFt('${id}')" style="width:70px"/>
          </div>
          <div style="font-size:12px;color:#4b5563;margin-bottom:8px;line-height:1.5">
            A side splash is the short piece against a wall at the end of a run of countertops. Each one adds roughly 2 linear feet to your backsplash total — count how many you have. If unsure, just leave as 0.
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:14px;color:#374151;min-width:170px"><strong>No backsplash cabinets</strong> (lin ft)</label>
            <input type="number" id="mqs-bs-subtract-${id}" value="0" min="0" step="0.1" oninput="mqRefreshSurfBsFt('${id}')" style="width:70px"/>
          </div>
          <div style="font-size:13px;color:#4b5563;margin-top:6px">Have an island or a section of counter from your base cabinet run that won't have backsplash? Enter the linear feet here and we'll subtract it off.</div>
          <div style="font-size:14px;color:#166534;margin-top:8px">Backsplash footage used: <strong id="mqs-bsft-net-${id}">0</strong> ft</div>
        </div>`;
      document.getElementById(containerId)?.appendChild(card);
      window.mqRefreshBsOpts(`mqsm-${id}`, `mqsbs-${id}`);
      window.mqRefreshCutoutOpts(`mqsm-${id}`, `mqscuts-${id}`);
      window.mqRefreshSurfBsFt(id);
      mqRefreshAllPickerVisibility(prefix);
    }

    window.mqAddSurface=(prefix)=>addSurfaceInternal(prefix);
    window.mqRemoveSurf=(prefix,id)=>{const c=document.getElementById('mqsc-'+id);if(c)c.remove();delete surfs[prefix][id];};
    window.mqTogUseCab=(prefix)=>{
      const checked = document.getElementById(`mq-${prefix}-use-cab`)?.checked;
      const matDiv  = document.getElementById(`mq-${prefix}-cab-mat`);
      if(matDiv) matDiv.style.display=checked?'block':'none';
      if(checked) {
        window.mqRefreshBsOpts(`mq-${prefix}-ct-mat-cab`, `mq-${prefix}-cab-bs`);
        window.mqRefreshCutoutOpts(`mq-${prefix}-ct-mat-cab`, `mq-${prefix}-cab-cuts`);
        window.mqRefreshBsFt(prefix);
      }
    };
    window.mqCalcSurfDims=(id)=>{
      const w=parseFloat(document.getElementById(`mqsw-${id}`)?.value||0);
      const d=parseFloat(document.getElementById(`mqsd-${id}`)?.value||ctDepth);
      const el=document.getElementById(`mqsdims-${id}`);
      if(el&&w>0){
        const sqft=Math.round((w*d)/144*10)/10;
        const linFt=Math.round(w/12*10)/10;
        el.textContent=`${sqft} sqft · ${linFt} lin ft`;
        el.style.color='#16a34a';
      } else if(el){el.textContent='Enter width & depth';el.style.color='#4b5563';}
      window.mqRefreshSurfBsFt(id);
    };
    window.mqTogCabCuts=(prefix)=>{
      const coId   = prefix==='ct'?'mq-ct-cab-co':`mq-${prefix}-cab-co`;
      const cutsId = prefix==='ct'?'mq-ct-cab-cuts':`mq-${prefix}-cab-cuts`;
      const el=document.getElementById(cutsId);
      if(el) el.style.display=document.getElementById(coId)?.checked?'block':'none';
    };
    window.mqTogCabExtra=(prefix)=>{
      const checked = document.getElementById(`mq-${prefix}-cab-extra-toggle`)?.checked;
      const wrap = document.getElementById(`mq-${prefix}-cab-extra-wrap`);
      if(wrap) wrap.style.display = checked ? 'flex' : 'none';
      mqRefreshBsFt(prefix);
    };
    window.mqTogCuts=id=>{document.getElementById('mqscuts-'+id).style.display=document.getElementById('mqsco-'+id).checked?'block':'none';};
    window.mqRefreshBsOpts=(matSelectId, bsSelectId)=>{
      const matSel = document.getElementById(matSelectId);
      const bsSel  = document.getElementById(bsSelectId);
      if (!matSel || !bsSel) return;
      const m = CT_MAT[matSel.value] || Object.values(CT_MAT)[0];
      const prevVal = bsSel.value;
      bsSel.innerHTML = '<option value="none">None</option>' + bsOptsHtml(m);
      // Try to keep the same option index selected across material changes when possible
      if (prevVal !== 'none' && bsSel.querySelector(`option[value="${prevVal}"]`)) bsSel.value = prevVal;
    };
    window.mqRefreshCutoutOpts=(matSelectId, cutsContainerId)=>{
      const matSel = document.getElementById(matSelectId);
      const container = document.getElementById(cutsContainerId);
      if (!matSel || !container) return;
      const m = CT_MAT[matSel.value] || Object.values(CT_MAT)[0];
      container.innerHTML = cutoutRowsHtml(m, `${cutsContainerId}-q`);
    };
    window.mqRefreshBsFt=(prefix)=>{
      // Total countertop linear footage = base cabinets + dishwasher gap (if checked) + any additional space entered
      const baseFt = gn(`mq-${prefix}-bft`, 0);
      const dwChecked = document.getElementById(`mq-${prefix}-cab-dw`)?.checked;
      const extraChecked = document.getElementById(`mq-${prefix}-cab-extra-toggle`)?.checked;
      const extraFt = extraChecked ? gn(`mq-${prefix}-cab-extra-ft`, 0) : 0;
      const totalCtFt = baseFt + (dwChecked?2:0) + extraFt;

      const ctftEl = document.getElementById(`mq-${prefix}-cab-ctft`);
      const ctsqftEl = document.getElementById(`mq-${prefix}-cab-ctsqft`);
      if (ctftEl) ctftEl.textContent = Math.round(totalCtFt*10)/10;
      if (ctsqftEl) ctsqftEl.textContent = Math.round(totalCtFt*(ctDepth/12)*10)/10;

      const block = document.getElementById(`mq-${prefix}-cab-bsft-block`);
      if (!block) return; // only exists on the "both" tab cabinet-attached block
      const bsSel = document.getElementById(`mq-${prefix}-cab-bs`);
      const hasBs = bsSel && bsSel.value !== 'none';
      block.style.display = hasBs ? 'block' : 'none';
      if (!hasBs) return;
      const sides = gn(`mq-${prefix}-cab-bs-sides`, 0);
      const subtractFt = gn(`mq-${prefix}-cab-bs-subtract`, 0);
      const autoFt = totalCtFt + sides*2;
      const netFt = Math.max(0, autoFt - subtractFt);
      const autoEl = document.getElementById(`mq-${prefix}-cab-bsft-auto`);
      const netEl  = document.getElementById(`mq-${prefix}-cab-bsft-net`);
      if (autoEl) autoEl.textContent = autoFt;
      if (netEl)  netEl.textContent  = netFt;
    };
    window.mqRefreshSurfBsFt=(id)=>{
      const block = document.getElementById(`mqs-bsft-block-${id}`);
      if (!block) return;
      const bsSel = document.getElementById(`mqsbs-${id}`);
      const hasBs = bsSel && bsSel.value !== 'none';
      block.style.display = hasBs ? 'block' : 'none';
      if (!hasBs) return;
      const w = gn(`mqsw-${id}`, 0);
      const baseFt = Math.round((w/12)*10)/10;
      const sides = gn(`mqs-bs-sides-${id}`, 0);
      const subtractFt = gn(`mqs-bs-subtract-${id}`, 0);
      const autoFt = Math.round((baseFt + sides*2)*10)/10;
      const netFt = Math.max(0, Math.round((autoFt - subtractFt)*10)/10);
      const autoEl = document.getElementById(`mqs-bsft-auto-${id}`);
      const netEl  = document.getElementById(`mqs-bsft-net-${id}`);
      if (autoEl) autoEl.textContent = autoFt;
      if (netEl)  netEl.textContent  = netFt;
    };
    window.mqSyncCtSi=(prefix)=>{
      // Only the "both" tab has a separate countertop supply/install field to
      // sync into — default it to match the cabinet choice so people don't
      // accidentally leave it mismatched. They can still change it after.
      if (prefix === 'b') {
        const cabSi = document.getElementById('mq-b-si');
        const ctSi  = document.getElementById('mq-b-ct-si');
        if (cabSi && ctSi) ctSi.value = cabSi.value;
      }
    };

    window.mqSpecModeChosen = function(prefix, i) {
      const s = specs[i];
      if (!s || !s.offersInstallChoice) return true;
      const sel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
      if (sel && sel.value) return true;
      if (sel) {
        sel.classList.remove('mq-needs-choice');
        void sel.offsetWidth;
        sel.classList.add('mq-needs-choice');
        sel.focus();
        setTimeout(() => sel.classList.remove('mq-needs-choice'), 700);
      }
      return false;
    }

    function mqValidateInstallQty(prefix) {
      const shake = (qtyInput) => {
        if (!qtyInput) return;
        qtyInput.classList.remove('mq-needs-choice');
        void qtyInput.offsetWidth;
        qtyInput.classList.add('mq-needs-choice');
        qtyInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        qtyInput.focus();
        setTimeout(() => qtyInput.classList.remove('mq-needs-choice'), 700);
      };
      for (let i = 0; i < specs.length; i++) {
        const modeSel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
        if (!modeSel || modeSel.value !== 'install') continue;
        const row = document.getElementById(`mq-spec-installqty-${prefix}-${i}`);
        if (!row) continue;

        const supplyQty = specQty[prefix][i] || 0;
        const instQty = installQty[prefix][i] || 0;
        if (supplyQty === 0 && instQty === 0) continue;

        if (supplyQty === 0) { shake(document.getElementById(`mq-qty-${prefix}-${i}`)); return false; }
        if (instQty === 0) { shake(document.getElementById(`mq-installqty-${prefix}-${i}`)); return false; }
      }
      return true;
    }

    addSurfaceInternal('ct','Kitchen run');
    // Auto-add one starting tall cabinet card per tab so the photo picker is
    // visible immediately on load — starts at qty 0 so it doesn't silently
    // count as "added" until the customer actually wants one.
    if (Object.keys(TALL_CAB).length > 0) {
      addTallCabInternal('c');
      addTallCabInternal('b');
    }
    // Apply room-visibility filtering right away for whatever room is
    // selected by default — specialty items render unfiltered in HTML first,
    // then get filtered here so we don't need to know the room at HTML-build time.
    mqRefreshRoomVisibility('c');
    mqRefreshRoomVisibility('b');
    mqShowRoomDescription('c');
    mqShowRoomDescription('b');
    mqRefreshMeasureGuide('c');
    mqRefreshMeasureGuide('b');
    mqRefreshAllPickerVisibility('c');
    mqRefreshAllPickerVisibility('b');
    mqRefreshSectionVisibility('c');
    mqRefreshSectionVisibility('b');
  }

  // ============================================================
  // INIT
  // ============================================================
  // Rebuilds the widget from scratch using the already-loaded shop data — no
  // network refetch needed. Reuses the exact same render sequence as the
  // initial page load, so it's guaranteed to reset everything (every input,
  // the guided step flow, results panels) rather than risk missing some
  // field if this tried to reset values one at a time by hand.
  // Standalone panel below the widget (not inside it, so it survives
  // mqStartNewEstimate's full rebuild) — deliberately much more visible than
  // a small footer link: dark card, clearly separated, matching the same
  // "darkened" visual language used for done/upcoming steps.
  function mqEnsureStartOverPanel() {
    let panel = document.getElementById('mq-start-over-panel');
    if (panel) return panel;
    const container = document.getElementById('midasquote-widget');
    if (!container) return null;
    panel = document.createElement('div');
    panel.id = 'mq-start-over-panel';
    panel.style.cssText = 'display:none;max-width:900px;margin:0 auto 24px;background:#111827;border-radius:12px;padding:24px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.25)';
    panel.innerHTML = `
      <div style="color:#e5e7eb;font-size:16px;margin-bottom:14px">Want to look at a different project?</div>
      <button type="button" onclick="mqStartNewEstimate()" style="background:#2563eb;color:#fff;border:none;border-radius:10px;padding:14px 30px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit">🔄 Start a New Estimate</button>`;
    container.insertAdjacentElement('afterend', panel);
    return panel;
  }
  window.mqShowStartOverPanel = function() {
    const panel = mqEnsureStartOverPanel();
    if (panel) panel.style.display = 'block';
  };

  window.mqStartNewEstimate = function() {
    const data = window._mqFullData;
    const container = document.getElementById('midasquote-widget');
    if (!data || !container) return;
    const { shop, specs } = data;
    buildCTMAT(data);
    buildTRIM(data);
    buildTALLCAB(data);
    container.innerHTML = buildWidgetHTML(shop, specs, data);
    wireWidget(data);
    const panel = document.getElementById('mq-start-over-panel');
    if (panel) panel.style.display = 'none';
    window.mqScrollWithOffset(container);
  };

  // Mobile-only minimum text size — a lot of hint/label text throughout
  // this file is set with inline styles (not shared CSS classes), which a
  // normal media query can never override no matter what it says, since
  // inline styles always win over stylesheet rules regardless of
  // specificity. This scans for inline font sizes smaller than the mobile
  // floor and bumps just those, only on narrow screens — desktop sizes stay
  // exactly as authored. Runs once at load, then keeps re-scanning
  // automatically as new content gets added (tall cabinet cards, added
  // surfaces, a full "Start new estimate" rebuild, popups, etc.) via a
  // MutationObserver, so nothing new slips through unbumped.
  const MQ_MOBILE_FONT_FLOOR = 15;
  function mqBumpMobileFontSizes(root) {
    if (!root || window.innerWidth > 600) return;
    const walk = (node) => {
      if (!node || node.nodeType !== 1) return;
      if (node.style && node.style.fontSize) {
        const px = parseFloat(node.style.fontSize);
        if (!isNaN(px) && px < MQ_MOBILE_FONT_FLOOR) node.style.fontSize = MQ_MOBILE_FONT_FLOOR + 'px';
      }
      for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
    };
    walk(root);
  }
  function mqInitMobileFontFix() {
    mqBumpMobileFontSizes(document.body);
    const observer = new MutationObserver((mutations) => {
      if (window.innerWidth > 600) return;
      mutations.forEach(m => m.addedNodes.forEach(node => mqBumpMobileFontSizes(node)));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => mqBumpMobileFontSizes(document.body), 200);
    });
  }

  async function init() {
    const container=document.getElementById('midasquote-widget');
    if(!container){console.error('MidasQuote: Add <div id="midasquote-widget"></div> to your page.');return;}
    container.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 1rem;gap:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#1a1a1a;border-radius:50%;animation:mqSpin 0.7s linear infinite;"></div>
      <div style="font-size:14px;color:#4b5563;letter-spacing:0.01em;">Loading estimator…</div>
      <style>@keyframes mqSpin{to{transform:rotate(360deg)}}</style>
    </div>`;
    let data;
    try {
      data = await loadShopData(shopToken);
    } catch (err) {
      console.error('MidasQuote: failed to load shop data', err);
      container.innerHTML=`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2.5rem 1.5rem;text-align:center;color:#4b5563;font-size:14px;line-height:1.6">
        <div style="font-size:2rem;margin-bottom:0.75rem">⚠️</div>
        <div style="font-weight:600;color:#111;font-size:15px;margin-bottom:6px">Having trouble loading your estimate</div>
        <div style="margin-bottom:1rem">This is usually just a slow or dropped connection. Please try again.</div>
        <button onclick="this.closest('#midasquote-widget').dispatchEvent(new Event('mq-retry'))" style="background:#1a1a1a;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Try again</button>
      </div>`;
      container.addEventListener('mq-retry', () => init(), { once: true });
      return;
    }
    if(!data) {
      container.innerHTML=`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2.5rem 1.5rem;text-align:center;color:#4b5563;font-size:14px;line-height:1.6">
        <div style="font-size:2rem;margin-bottom:0.75rem">⚠️</div>
        <div style="font-weight:600;color:#111;font-size:15px;margin-bottom:6px">Estimator unavailable</div>
        <div>This quote tool isn't configured correctly. Please contact the site owner.</div>
      </div>`;
      return;
    }
    const {shop,specs}=data;

    // ── Subscription gate ──
    const activeStatuses = ['Active', 'Trial'];
    if (shop['Status'] && !activeStatuses.includes(shop['Status'])) {
      container.innerHTML=`<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:2.5rem 1.5rem;text-align:center;color:#4b5563;font-size:14px;line-height:1.6">
        <div style="font-size:2rem;margin-bottom:0.75rem">🔒</div>
        <div style="font-weight:600;color:#111;font-size:15px;margin-bottom:6px">Estimator unavailable</div>
        <div>This quoting tool is temporarily offline. Please contact the shop directly for a quote.</div>
      </div>`;
      return;
    }

    window._mqShopData=shop;
    window._mqFullData=data; // cached so mqStartNewEstimate can rebuild without refetching
    // Pro Quoter deliberately ignores each shop's own brand color — this is
    // meant to feel like its own distinct premium tool, not a re-skin of
    // whatever the customer widget looks like for that particular shop.
    injectStyles('#0f2a52');
    buildCTMAT(data);
    buildTRIM(data);
    buildTALLCAB(data);
    container.innerHTML=buildWidgetHTML(shop,specs,data);
    wireWidget(data);

    // ── Pro Quoter intro popup ──
    // Replaces the customer-facing "first time here" tips with something
    // relevant to the shop owner instead, and introduces Add to Home Screen.
    if (shop['Shop token']) {
      try {
        const storageKey = `mq_pro_intro_seen_${shop['Shop token']}`;
        if (!localStorage.getItem(storageKey)) {
          const bc = '#0f2a52';
          const popup = document.createElement('div');
          popup.id = 'mq-tips-popup';
          popup.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:mqFadeIn 0.25s ease`;
          popup.innerHTML = `
            <div style="background:#fff;border-radius:16px;max-width:400px;width:100%;padding:2rem;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.25);animation:mqSlideUp 0.3s ease">
              <div style="font-size:36px;margin-bottom:12px">💰</div>
              <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px">This is your MidasQuote Pro</div>
              <div style="font-size:14px;color:#4b5563;line-height:1.7;margin-bottom:1.5rem;text-align:left">
                <div style="margin-bottom:8px">✅ <strong>Same quoting tool</strong>, but shows your real exact numbers right alongside the customer ballpark range.</div>
                <div style="margin-bottom:8px">📋 <strong>Every line item</strong> shows its real price too, not just a checkmark.</div>
                <div>📲 <strong>Add this to your home screen</strong> so it opens like an app — no browser bar, no bookmarks to dig through.</div>
              </div>
              <button onclick="mqOpenHomeScreenModal();mqDismissTipsPopup()" style="display:block;width:100%;background:${bc};color:#fff;border:none;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;cursor:pointer;font-family:inherit;transition:opacity 0.15s;margin-bottom:8px" onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">📲 Add to home screen</button>
              <button onclick="mqDismissTipsPopup()" style="background:none;border:none;font-size:14px;color:#6b7280;cursor:pointer;font-family:inherit;padding:4px">Maybe later</button>
            </div>
            <style>
              @keyframes mqFadeIn{from{opacity:0}to{opacity:1}}
              @keyframes mqSlideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
            </style>`;
          window.mqDismissTipsPopup = function() {
            try { localStorage.setItem(storageKey, '1'); } catch(e) {}
            const p = document.getElementById('mq-tips-popup');
            if (p) { p.style.opacity='0'; p.style.transition='opacity 0.2s'; setTimeout(()=>p.remove(), 200); }
          };
          setTimeout(() => document.body.appendChild(popup), 1000);
        }
      } catch(e) { /* localStorage unavailable — skip popup */ }
    }

    // ── Add to Home Screen ──
    // A persistent small button (not just first-visit) so it's reachable any
    // time, not only the one moment the intro popup shows up. Opens a modal
    // where the shop owner picks their own device — deliberately not
    // auto-detected, so there's nothing to guess wrong. iPhone/iPad get
    // manual steps always (Apple gives websites no way to trigger this
    // programmatically, full stop). Android/Desktop Chrome get a real
    // one-tap Install button INSTEAD of instructions, if the browser has
    // signaled it's available (via the standard beforeinstallprompt event) —
    // otherwise they fall back to steps too.
    // pro.html captures this event as early as physically possible — before
    // this script even starts loading — since it can fire before an async
    // script tag finishes downloading, and missing that window means
    // missing the event entirely for the whole page load. This listener
    // here is just a fallback for the rarer case where it fires after this
    // script has already loaded. Either way, window._mqDeferredInstallPrompt
    // is the single source of truth, checked fresh wherever it's needed.
    if (typeof window._mqDeferredInstallPrompt === 'undefined') window._mqDeferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window._mqDeferredInstallPrompt = e;
    });

    const homeBtn = document.createElement('button');
    homeBtn.id = 'mq-home-screen-btn';
    homeBtn.textContent = '📲';
    homeBtn.title = 'Add to Home Screen';
    homeBtn.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:9997;width:48px;height:48px;border-radius:50%;border:none;background:#1a1a1a;color:#fff;font-size:20px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center';
    homeBtn.onclick = () => window.mqOpenHomeScreenModal();
    document.body.appendChild(homeBtn);

    window.mqOpenHomeScreenModal = function() {
      let modal = document.getElementById('mq-homescreen-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mq-homescreen-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif';
        modal.addEventListener('click', (e) => { if (e.target === modal) window.mqCloseHomeScreenModal(); });
        document.body.appendChild(modal);
      }
      modal.style.display = 'flex';
      window.mqShowHomeScreenStep('picker');
    };
    window.mqCloseHomeScreenModal = function() {
      const modal = document.getElementById('mq-homescreen-modal');
      if (modal) modal.style.display = 'none';
    };

    const MQ_HOMESCREEN_STEPS = {
      iphone: {
        title: '🍎 On iPhone / iPad',
        steps: [
          'Tap the Share icon at the bottom of Safari (the square with an arrow pointing up).',
          'Scroll down and tap "Add to Home Screen."',
          'Tap "Add" in the top corner — done!',
        ],
      },
      android: {
        title: '🤖 On Android',
        steps: [
          'Tap the ⋮ menu in the top-right corner of Chrome.',
          'Tap "Add to Home screen" (or "Install app" if you see it).',
          'Confirm — done!',
        ],
      },
      desktop: {
        title: '💻 On a computer',
        steps: [
          'Look for an install icon (usually a small ⊕ or monitor icon) in the address bar.',
          'Click it, then click "Install."',
          'It\'ll open in its own window from now on, same as any other app.',
        ],
      },
    };

    window.mqShowHomeScreenStep = function(which) {
      const modal = document.getElementById('mq-homescreen-modal');
      if (!modal) return;
      if (which === 'picker') {
        modal.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:380px;width:100%;padding:2rem;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.25)">
          <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:6px">📲 Add to Home Screen</div>
          <div style="font-size:14px;color:#4b5563;margin-bottom:1.5rem">What are you using right now?</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button onclick="mqShowHomeScreenStep('iphone')" style="padding:12px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">🍎 iPhone / iPad</button>
            <button onclick="mqShowHomeScreenStep('android')" style="padding:12px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">🤖 Android</button>
            <button onclick="mqShowHomeScreenStep('desktop')" style="padding:12px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">💻 Computer</button>
          </div>
          <button onclick="mqCloseHomeScreenModal()" style="margin-top:1.25rem;background:none;border:none;font-size:14px;color:#6b7280;cursor:pointer;font-family:inherit">Close</button>
        </div>`;
        return;
      }
      // Android/Desktop: if the browser has actually offered a real install
      // prompt, use that instead of manual steps — a genuine one-tap install.
      if ((which === 'android' || which === 'desktop') && window._mqDeferredInstallPrompt) {
        modal.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:380px;width:100%;padding:2rem;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.25)">
          <div style="font-size:36px;margin-bottom:12px">📲</div>
          <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:1.5rem">Your browser can install this directly.</div>
          <button onclick="mqTriggerRealInstall()" style="display:block;width:100%;background:#1a1a1a;color:#fff;border:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;cursor:pointer;font-family:inherit;margin-bottom:10px">Install now</button>
          <button onclick="mqShowHomeScreenStep('picker')" style="background:none;border:none;font-size:14px;color:#6b7280;cursor:pointer;font-family:inherit">Back</button>
        </div>`;
        return;
      }
      const info = MQ_HOMESCREEN_STEPS[which];
      if (!info) return;
      modal.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:380px;width:100%;padding:2rem;box-shadow:0 24px 60px rgba(0,0,0,0.25)">
        <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:1rem;text-align:center">${info.title}</div>
        <ol style="font-size:14px;color:#374151;line-height:1.8;padding-left:1.2rem;margin-bottom:1.5rem">
          ${info.steps.map(s => `<li style="margin-bottom:8px">${s}</li>`).join('')}
        </ol>
        <button onclick="mqShowHomeScreenStep('picker')" style="display:block;width:100%;background:#f3f4f6;color:#374151;border:none;font-size:14px;font-weight:600;padding:10px;border-radius:8px;cursor:pointer;font-family:inherit;margin-bottom:8px">← Choose a different device</button>
        <button onclick="mqCloseHomeScreenModal()" style="display:block;width:100%;background:none;border:none;font-size:14px;color:#6b7280;cursor:pointer;font-family:inherit">Close</button>
      </div>`;
    };

    window.mqTriggerRealInstall = async function() {
      if (!window._mqDeferredInstallPrompt) return;
      window._mqDeferredInstallPrompt.prompt();
      await window._mqDeferredInstallPrompt.userChoice;
      window._mqDeferredInstallPrompt = null;
      window.mqCloseHomeScreenModal();
    };

    // ============================================================
    // PROPOSALS — build from a completed real-number estimate,
    // pick a template (built in the Dashboard's Proposals tab),
    // tweak line items, generate a printable page, and save it to
    // a browsable history so it's never "which one did I give him."
    // ============================================================

    window.mqOpenProposalModal = async function(prefix) {
      const est = (window._mqLastEstimate || {})[prefix];
      if (!est || !est.lines || !est.lines.length) { alert('Please calculate an estimate first.'); return; }

      let modal = document.getElementById('mq-proposal-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mq-proposal-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100005;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
        document.body.appendChild(modal);
      }
      modal.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:540px;width:100%;padding:1.75rem;max-height:92vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <div style="font-size:18px;font-weight:800;color:#111">📄 Create Proposal</div>
          <button onclick="mqCloseProposalModal()" style="background:none;border:none;font-size:24px;color:#9ca3af;cursor:pointer;line-height:1">&times;</button>
        </div>
        <div id="mq-proposal-modal-body"><div style="text-align:center;padding:2rem;color:#6b7280">Loading templates...</div></div>
      </div>`;
      modal.style.display = 'flex';

      // Fetched fresh every time this opens — cheap, and avoids showing a
      // template that was just edited/deleted in the dashboard a minute ago.
      try {
        const res = await fetchWithRetry(`${CONFIG.PROXY_WORKER}/proposal-templates?shop=${encodeURIComponent(shopToken)}`, {});
        const j = await res.json();
        window._mqProposalTemplates = j.templates || [];
      } catch(e) { console.error('Failed to load proposal templates', e); window._mqProposalTemplates = []; }

      window._mqProposalState = {
        prefix,
        templateId: (window._mqProposalTemplates[0] || {}).id || null,
        customerName: '',
        customerAddress: '',
        customerPhone: '',
        jobName: '',
        description: '',
        showPrices: (window._mqProposalTemplates[0] || {}).fields ? window._mqProposalTemplates[0].fields['Show item prices'] !== false : true,
        waiveDeposit: false,
        // Editable copy — the original est.lines stays untouched so
        // reopening this modal always starts fresh from the real estimate.
        lines: est.lines.map(l => ({ label: l.label, cost: l.cost })),
      };
      mqRenderProposalModalBody();
    };

    window.mqCloseProposalModal = function() {
      const modal = document.getElementById('mq-proposal-modal');
      if (modal) modal.style.display = 'none';
    };

    function mqRenderProposalModalBody() {
      const body = document.getElementById('mq-proposal-modal-body');
      if (!body) return;
      const templates = window._mqProposalTemplates || [];
      const state = window._mqProposalState;

      if (!templates.length) {
        body.innerHTML = `<div style="text-align:center;padding:1.5rem;color:#374151;font-size:14px;line-height:1.7">
          No proposal templates yet.<br>Set one up in your dashboard's <strong>Proposals</strong> tab first, then come back here.
        </div>`;
        return;
      }

      const template = templates.find(t => t.id === state.templateId) || templates[0];
      state.templateId = template.id;
      const f = template.fields;
      const subtotal = state.lines.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);
      const taxAmt = subtotal * ((f['Tax percent'] || 0) / 100);
      const total = subtotal + taxAmt;
      const rawDepositAmt = f['Deposit type'] === 'Flat amount' ? (f['Deposit value'] || 0) : total * ((f['Deposit value'] || 0) / 100);
      const depositAmt = state.waiveDeposit ? 0 : rawDepositAmt;

      body.innerHTML = `
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Template</label>
          <select onchange="mqProposalTemplateChosen(this.value)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px">
            ${templates.map(t => `<option value="${t.id}" ${t.id===template.id?'selected':''}>${(t.fields['Template name']||'Untitled').replace(/"/g,'&quot;')}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Customer name *</label>
          <input type="text" value="${state.customerName.replace(/"/g,'&quot;')}" oninput="mqProposalFieldChanged('customerName',this.value)" placeholder="e.g. Jane Smith" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px"/>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Customer address <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
          <input type="text" value="${(state.customerAddress||'').replace(/"/g,'&quot;')}" oninput="mqProposalFieldChanged('customerAddress',this.value)" placeholder="e.g. 123 Main St, New York, NY" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px"/>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Customer phone <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
          <input type="text" value="${(state.customerPhone||'').replace(/"/g,'&quot;')}" oninput="mqProposalFieldChanged('customerPhone',this.value)" placeholder="e.g. (780) 555-1234" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px"/>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Job name <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
          <input type="text" value="${(state.jobName||'').replace(/"/g,'&quot;')}" oninput="mqProposalFieldChanged('jobName',this.value)" placeholder="e.g. Kitchen reface" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px"/>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px">Description <span style="font-weight:400;color:#9ca3af">(wherever {description} is placed in the template)</span></label>
          <textarea rows="2" oninput="mqProposalFieldChanged('description',this.value)" placeholder="e.g. Full kitchen reface, spoke to him at the counter" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;resize:vertical;font-family:inherit">${state.description.replace(/</g,'&lt;')}</textarea>
        </div>

        <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:8px">Line items — edit prices before generating</div>
          <div>
            ${state.lines.map((l, i) => `
              <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
                <input type="text" value="${(l.label||'').replace(/"/g,'&quot;')}" oninput="mqProposalLineChanged(${i},'label',this.value)" style="flex:1;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                <input type="number" value="${l.cost}" oninput="mqProposalLineChanged(${i},'cost',this.value); mqUpdateProposalSummary()" style="width:90px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px"/>
                <button onclick="mqRemoveProposalLine(${i})" style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:0 4px">✕</button>
              </div>`).join('')}
          </div>
          <button onclick="mqAddProposalLine()" style="font-size:12px;color:#2563eb;background:none;border:none;cursor:pointer;font-weight:600;padding:4px 0">+ Add a line</button>
        </div>

        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151;cursor:pointer;margin-bottom:14px">
          <input type="checkbox" ${state.showPrices?'checked':''} onchange="mqProposalFieldChanged('showPrices',this.checked)" style="width:auto"/> Show individual item prices on this proposal <span style="font-weight:400;color:#9ca3af">(just for this one — doesn't change the template's default)</span>
        </label>

        ${(f['Deposit value']||0) > 0 ? `
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151;cursor:pointer;margin-bottom:14px">
          <input type="checkbox" ${state.waiveDeposit?'checked':''} onchange="mqProposalFieldChanged('waiveDeposit',this.checked); mqRenderProposalModalBody()" style="width:auto"/> Waive the deposit for this proposal <span style="font-weight:400;color:#9ca3af">(this template normally requires one — just skip it for this one customer)</span>
        </label>` : ''}

        <div style="background:#f9fafb;border-radius:8px;padding:12px 14px;font-size:13px;color:#374151;line-height:1.8;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between"><span>Subtotal</span><strong>$<span id="mq-prop-subtotal-val">${subtotal.toFixed(2)}</span></strong></div>
          <div style="display:flex;justify-content:space-between"><span>Tax (${f['Tax percent']||0}%)</span><strong>$<span id="mq-prop-tax-val">${taxAmt.toFixed(2)}</span></strong></div>
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;border-top:1px solid #e5e7eb;margin-top:6px;padding-top:6px"><span>Total</span><span>$<span id="mq-prop-total-val">${total.toFixed(2)}</span></span></div>
          <div style="display:flex;justify-content:space-between;color:#166534;margin-top:4px"><span>Deposit ${state.waiveDeposit?'(waived)':`(${f['Deposit type']==='Flat amount'?'flat rate':((f['Deposit value']||0)+'%')})`}</span><strong>$<span id="mq-prop-deposit-val">${depositAmt.toFixed(2)}</span></strong></div>
          <div style="font-size:11px;color:#9ca3af;margin-top:6px">These only actually show on the proposal wherever this template's Body uses the matching {tokens} — set up in the dashboard.</div>
        </div>

        <button onclick="mqGenerateProposal()" style="width:100%;padding:13px;background:#1a1a1a;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">Generate Proposal →</button>
      `;
    }

    window.mqProposalTemplateChosen = function(id) {
      window._mqProposalState.templateId = id;
      const newTemplate = (window._mqProposalTemplates || []).find(t => t.id === id);
      if (newTemplate) window._mqProposalState.showPrices = newTemplate.fields['Show item prices'] !== false;
      window._mqProposalState.waiveDeposit = false;
      mqRenderProposalModalBody();
    };
    window.mqProposalFieldChanged = function(field, value) {
      window._mqProposalState[field] = value;
    };
    window.mqProposalLineChanged = function(i, field, value) {
      window._mqProposalState.lines[i][field] = field === 'cost' ? (parseFloat(value) || 0) : value;
    };

    // Recomputes subtotal/tax/total/deposit and updates just those text
    // nodes directly — deliberately NOT a full mqRenderProposalModalBody()
    // call, since replacing the whole modal body while someone's mid-keystroke
    // in the price field would yank focus out of the input on every character.
    window.mqUpdateProposalSummary = function() {
      const state = window._mqProposalState;
      const templates = window._mqProposalTemplates || [];
      const template = templates.find(t => t.id === state.templateId) || templates[0];
      if (!template) return;
      const f = template.fields;
      const subtotal = state.lines.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);
      const taxAmt = subtotal * ((f['Tax percent'] || 0) / 100);
      const total = subtotal + taxAmt;
      const rawDepositAmt = f['Deposit type'] === 'Flat amount' ? (f['Deposit value'] || 0) : total * ((f['Deposit value'] || 0) / 100);
      const depositAmt = state.waiveDeposit ? 0 : rawDepositAmt;
      const subtotalEl = document.getElementById('mq-prop-subtotal-val');
      const taxEl = document.getElementById('mq-prop-tax-val');
      const totalEl = document.getElementById('mq-prop-total-val');
      const depositEl = document.getElementById('mq-prop-deposit-val');
      if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2);
      if (taxEl) taxEl.textContent = taxAmt.toFixed(2);
      if (totalEl) totalEl.textContent = total.toFixed(2);
      if (depositEl) depositEl.textContent = depositAmt.toFixed(2);
    };
    window.mqRemoveProposalLine = function(i) {
      window._mqProposalState.lines.splice(i, 1);
      mqRenderProposalModalBody();
    };
    window.mqAddProposalLine = function() {
      window._mqProposalState.lines.push({ label: '', cost: 0 });
      mqRenderProposalModalBody();
    };

    function mqEscapeHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function mqBuildProposalItemsHtml(lines, showPrices, accent) {
      const rows = (lines||[]).map((l, i) => showPrices ? `
        <tr style="background:${i%2===0?'#ffffff':'#fafafa'}">
          <td style="padding:12px 14px;border-bottom:1px solid #eee">${mqEscapeHtml(l.label)}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;font-weight:600">$${(parseFloat(l.cost)||0).toFixed(2)}</td>
        </tr>` : `
        <tr style="background:${i%2===0?'#ffffff':'#fafafa'}"><td style="padding:12px 14px;border-bottom:1px solid #eee">${mqEscapeHtml(l.label)}</td></tr>`).join('');
      return `<table style="width:100%;border-collapse:collapse;margin:12px 0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <thead><tr style="background:${accent}">
          <th style="text-align:left;font-size:12px;color:#fff;text-transform:uppercase;letter-spacing:0.04em;padding:12px 14px;font-weight:700">Item</th>
          ${showPrices ? `<th style="text-align:right;font-size:12px;color:#fff;text-transform:uppercase;letter-spacing:0.04em;padding:12px 14px;font-weight:700">Price</th>` : ''}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    // Same list, no box — no colored header, no shading, no shadow. Item
    // name in bold, price plain, same font as the rest of the body. For
    // shops whose existing paper proposal already has its own look and
    // just needs the numbers, not another visual style layered on top.
    function mqBuildProposalItemsPlainHtml(lines, showPrices) {
      const rows = (lines||[]).map(l => showPrices ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb">
          <strong>${mqEscapeHtml(l.label)}</strong><span>$${(parseFloat(l.cost)||0).toFixed(2)}</span>
        </div>` : `
        <div style="padding:6px 0;border-bottom:1px solid #e5e7eb"><strong>${mqEscapeHtml(l.label)}</strong></div>`).join('');
      return `<div style="margin:12px 0">${rows}</div>`;
    }

    // Same as above but regular weight, not bold — for shops who'd rather
    // the item name read the same as everything else in the body.
    function mqBuildProposalItemsPlainLightHtml(lines, showPrices) {
      const rows = (lines||[]).map(l => showPrices ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb">
          <span>${mqEscapeHtml(l.label)}</span><span>$${(parseFloat(l.cost)||0).toFixed(2)}</span>
        </div>` : `
        <div style="padding:6px 0;border-bottom:1px solid #e5e7eb"><span>${mqEscapeHtml(l.label)}</span></div>`).join('');
      return `<div style="margin:12px 0">${rows}</div>`;
    }

    // A standalone "Item / Price" header row — the classic look from the
    // original styled table, but on its own, so it can sit above
    // {items_plain} or {items_plain_light} for shops who want that header
    // without the coloured box/shading the full {items} table has.
    function mqBuildItemsHeaderHtml(showPrices, accent) {
      return `<div style="display:flex;justify-content:space-between;padding-bottom:8px;border-bottom:2px solid ${accent};margin-bottom:4px">
        <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;font-weight:700">Item</span>
        ${showPrices ? `<span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;font-weight:700">Price</span>` : ''}
      </div>`;
    }

    function mqBuildSignatureLineHtml() {
      return `<div style="margin-top:50px;display:flex;gap:40px">
        <div style="flex:1"><div style="border-top:1px solid #111;padding-top:6px;font-size:12px;color:#6b7280">Customer signature</div></div>
        <div style="width:140px"><div style="border-top:1px solid #111;padding-top:6px;font-size:12px;color:#6b7280">Date</div></div>
      </div>`;
    }

    // A simple horizontal divider — placeable anywhere in the body text,
    // for shops that just want a plain line break between sections rather
    // than relying only on paragraph spacing.
    function mqBuildHrHtml() {
      return `<hr style="border:none;border-top:1px solid #d1d5db;margin:24px 0"/>`;
    }

    // A single, prominent, pre-styled summary box — subtotal/tax/total as
    // plain lines, then the deposit called out hard (solid accent-colour
    // background, white bold text) so it's genuinely impossible to miss,
    // not just another line of text sitting quietly in a paragraph. The
    // deposit row itself only shows if there's actually a deposit — a
    // template with deposit set to 0 (or waived for one proposal in Pro)
    // just gets a clean subtotal/tax/total, no dangling "$0.00" line.
    function mqBuildTotalsBoxHtml(subtotal, tax, total, deposit, accent) {
      return `<div style="background:${accent}0d;border:2px solid ${accent};border-radius:14px;padding:20px 24px;margin:24px 0">
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px;color:#374151"><span>Subtotal</span><span>$${(subtotal||0).toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px;color:#374151"><span>Tax</span><span>$${(tax||0).toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:22px;font-weight:800;color:#111;border-top:2px solid ${accent};margin-top:6px"><span>Total</span><span>$${(total||0).toFixed(2)}</span></div>
        ${(deposit||0) > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;margin-top:14px;background:${accent};border-radius:10px;color:#fff;font-size:16px;font-weight:800"><span>Deposit Due Today</span><span>$${deposit.toFixed(2)}</span></div>` : ''}
      </div>`;
    }

    // Same numbers, no box — plain lines, bold only on Total and Deposit,
    // matching the same "no extra styling layered on" philosophy as
    // {items_plain}. Same zero-deposit hiding as the box version above.
    function mqBuildTotalsPlainHtml(subtotal, tax, total, deposit) {
      return `<div style="margin:20px 0">
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px"><span>Subtotal</span><span>$${(subtotal||0).toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px"><span>Tax</span><span>$${(tax||0).toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:16px"><strong>Total</strong><strong>$${(total||0).toFixed(2)}</strong></div>
        ${(deposit||0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px"><strong>Deposit Due Today</strong><strong>$${deposit.toFixed(2)}</strong></div>` : ''}
      </div>`;
    }

    // Turns a shop owner's freeform Body text (typed in the dashboard, with
    // {tokens} scattered wherever they wanted them) into final HTML. The
    // body is plain text, not HTML — escaped and newline-converted first, so
    // whatever they wrote renders correctly. Simple markdown-style **bold**
    // is supported too, applied to their own text before token substitution
    // so it only ever touches what they actually typed. Tokens are matched
    // AFTER escaping (curly braces aren't special HTML characters, so
    // "{deposit}" survives untouched) and swapped for either a plain escaped
    // value or a pre-built HTML fragment ({items}, {totals_box}, etc.).
    // Turns one chunk of raw user text into formatted HTML — escape first
    // (safety), then line breaks, then **bold**, then {color:#hex}...{/color}
    // inline spans (color runs last since it wraps already-bolded HTML).
    // Shared by both top-level paragraphs and the inside of a {box}, so
    // formatting behaves identically whether it's inside a box or not.
    function mqFormatProposalTextChunk(text) {
      let html = mqEscapeHtml(text).replace(/\n/g, '<br>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\{color:(#[0-9a-fA-F]{3,8})\}([\s\S]*?)\{\/color\}/g, (m, hex, inner) => `<span style="color:${hex}">${inner}</span>`);
      return html;
    }

    function mqRenderProposalBodyTokens(bodyText, data) {
      // Optional fields (customer left them blank, or the shop owner never
      // asked for one) collapse their whole line rather than leaving a
      // label with nothing after it — e.g. "Job: {job_name}" with no job
      // name typed just disappears entirely, not "Job:" sitting there empty.
      const optionalEmpty = {
        '{customer_address}': !data.customerAddress,
        '{customer_phone}': !data.customerPhone,
        '{job_name}': !data.jobName,
        '{description}': !data.description,
      };
      const lines = (bodyText || '').split('\n').filter(line => {
        for (const token in optionalEmpty) {
          if (optionalEmpty[token] && line.includes(token)) return false;
        }
        return true;
      });
      const filteredText = lines.join('\n');

      // {box:#hex}...{/box} is extracted BEFORE paragraph-splitting, on the
      // raw text — a box is a block (a whole colored card), so it needs to
      // survive intact even if the shop owner put a blank line inside it,
      // rather than getting split apart into two separate paragraph divs.
      // Each match is swapped for a private placeholder (a null-byte marker
      // nobody would ever type), rendered fully now, and substituted back
      // in once the surrounding paragraph HTML is built.
      const customBlocks = {};
      let blockIndex = 0;
      const textWithPlaceholders = filteredText.replace(/\{box:(#[0-9a-fA-F]{3,8})\}([\s\S]*?)\{\/box\}/g, (match, hex, inner) => {
        const key = `\u0000BOX${blockIndex++}\u0000`;
        // Split into paragraphs so line breaks render correctly; the box
        // itself and its paragraphs are plain flowing content — no
        // page-break-avoid marking anywhere (see note below on why).
        const innerParas = inner.trim().split(/\n{2,}/).map(p => mqFormatProposalTextChunk(p)).join('<div style="height:12px"></div>');
        customBlocks[key] = `<div style="background:${hex};border-radius:10px;padding:14px 16px;margin:16px 0">${innerParas}</div>`;
        return key;
      });

      // Grouped into paragraphs (blank-line separated). Deliberately NOT
      // marked page-break-inside:avoid anywhere in this document — that was
      // tried, and turned out to be worse than the problem it solved. This
      // PDF library works by screenshotting the whole page and slicing it at
      // a fixed pixel height; the ONLY way it can "protect" something from
      // being split is to insert a blank spacer before it sized to whatever
      // space is left on the page, then start it fresh on the next page.
      // That means avoiding a split can cost an entire half-empty page —
      // often a far worse visual result than the rare, minor cost of a
      // single line occasionally landing right at a page break. So instead:
      // no avoidance anywhere, which makes a stray mid-line break possible
      // but rare, and makes a big blank gap mathematically impossible,
      // since the gap-inserting logic only ever runs for elements marked
      // avoid in the first place.
      const paragraphs = textWithPlaceholders.split(/\n{2,}/);
      const selfContainedTokens = new Set(['{items}', '{items_plain}', '{items_plain_light}', '{items_header}', '{totals_box}', '{totals_plain}', '{signature_line}', '{hr}']);
      let html = paragraphs.map(para => {
        const trimmed = para.trim();
        // A paragraph that's just a box placeholder is already a complete
        // block on its own — don't wrap it in another paragraph div too.
        if (/^\u0000BOX\d+\u0000$/.test(trimmed)) return trimmed;
        // Same idea for a paragraph that's just one of the pre-built
        // fragment tokens — {items} in particular is a whole table with its
        // OWN row-by-row breakability already built in (deliberately, so a
        // long item list can flow across pages instead of forcing the
        // entire table to stay on one page). Wrapping it in an outer
        // "never break this" div here would silently undo that.
        if (selfContainedTokens.has(trimmed)) return mqFormatProposalTextChunk(para);
        return `<div style="margin-bottom:16px">${mqFormatProposalTextChunk(para)}</div>`;
      }).join('');

      for (const [key, fragHtml] of Object.entries(customBlocks)) {
        html = html.split(key).join(fragHtml);
      }

      const replacements = {
        '{customer_name}': mqEscapeHtml(data.customerName),
        '{customer_address}': mqEscapeHtml(data.customerAddress),
        '{customer_phone}': mqEscapeHtml(data.customerPhone),
        '{job_name}': mqEscapeHtml(data.jobName),
        '{description}': mqEscapeHtml(data.description).replace(/\n/g, '<br>'),
        '{date}': mqEscapeHtml(data.date),
        '{subtotal}': '$' + (data.subtotal||0).toFixed(2),
        '{tax}': '$' + (data.tax||0).toFixed(2),
        '{total}': '$' + (data.total||0).toFixed(2),
        '{deposit}': '$' + (data.deposit||0).toFixed(2),
        '{items}': data.itemsHtml || '',
        '{items_plain}': data.itemsPlainHtml || '',
        '{items_plain_light}': data.itemsPlainLightHtml || '',
        '{items_header}': data.itemsHeaderHtml || '',
        '{signature_line}': data.signatureHtml || '',
        '{totals_box}': data.totalsBoxHtml || '',
        '{totals_plain}': data.totalsPlainHtml || '',
        '{hr}': data.hrHtml || '',
        '{break}': '<div style="height:20px"></div>',
      };
      for (const [token, val] of Object.entries(replacements)) {
        html = html.split(token).join(val);
      }
      return html;
    }

    window.mqGenerateProposal = async function() {
      const state = window._mqProposalState;
      const templates = window._mqProposalTemplates || [];
      const template = templates.find(t => t.id === state.templateId) || templates[0];
      if (!template) return;
      const f = template.fields;

      if (!state.customerName || !state.customerName.trim()) {
        alert("Please enter the customer's name before generating the proposal.");
        return;
      }

      // Opened right here, synchronously, as the very first thing — still
      // inside the original click, before any awaited network call. Browsers
      // only allow window.open() as a direct result of a user gesture; once
      // an await (or a blocking alert()) happens first, later calling
      // window.open() gets treated as unrelated to the click and blocked.
      // We write the actual content into this blank window further down,
      // once the save attempt (success or fail) is done.
      const printWin = window.open('', '_blank');
      if (!printWin) { alert('Please allow pop-ups to view/print this proposal.'); return; }
      printWin.document.write('<!DOCTYPE html><html><body style="font-family:sans-serif;color:#6b7280;padding:40px;text-align:center">Preparing your proposal...</body></html>');
      printWin.document.close();

      const subtotal = state.lines.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);
      const taxAmt = subtotal * ((f['Tax percent'] || 0) / 100);
      const total = subtotal + taxAmt;
      const rawDepositAmt = f['Deposit type'] === 'Flat amount' ? (f['Deposit value'] || 0) : total * ((f['Deposit value'] || 0) / 100);
      const depositAmt = state.waiveDeposit ? 0 : rawDepositAmt;
      const est = (window._mqLastEstimate || {})[state.prefix] || {};

      const accent = f['Accent colour'] || '#1a3a6b';
      const dateStr = new Date().toLocaleDateString();
      const itemsHtml = mqBuildProposalItemsHtml(state.lines, state.showPrices, accent);
      const itemsPlainHtml = mqBuildProposalItemsPlainHtml(state.lines, state.showPrices);
      const itemsPlainLightHtml = mqBuildProposalItemsPlainLightHtml(state.lines, state.showPrices);
      const itemsHeaderHtml = mqBuildItemsHeaderHtml(state.showPrices, accent);
      const signatureHtml = mqBuildSignatureLineHtml();
      const hrHtml = mqBuildHrHtml();
      const totalsBoxHtml = mqBuildTotalsBoxHtml(subtotal, taxAmt, total, depositAmt, accent);
      const totalsPlainHtml = mqBuildTotalsPlainHtml(subtotal, taxAmt, total, depositAmt);

      // A genuinely empty Body would otherwise silently produce a blank
      // proposal (header only, nothing else) — better to fall back to
      // something minimally usable than hand someone a blank page with no
      // indication anything's wrong.
      const bodyText = (f['Body'] && f['Body'].trim())
        ? f['Body']
        : '{job_name}\n\n{description}\n\n{items}\n\n{totals_box}\n\n{signature_line}';

      // Rendered once, here, and saved as-is (see payload.renderedBody
      // below) — this is what actually gets shown, both right now and on
      // every future reprint, so a reprint months from now is guaranteed
      // identical to what was actually handed to the customer, even if the
      // template itself gets edited or deleted afterward.
      const renderedBodyHtml = mqRenderProposalBodyTokens(bodyText, {
        customerName: state.customerName.trim(),
        customerAddress: state.customerAddress || '',
        customerPhone: state.customerPhone || '',
        jobName: state.jobName || '',
        description: state.description || '',
        date: dateStr,
        subtotal, tax: taxAmt, total, deposit: depositAmt,
        itemsHtml, itemsPlainHtml, itemsPlainLightHtml, itemsHeaderHtml, signatureHtml, hrHtml, totalsBoxHtml, totalsPlainHtml,
      });

      const payload = {
        shopToken,
        customerName: state.customerName.trim(),
        customerAddress: state.customerAddress || '',
        customerPhone: state.customerPhone || '',
        jobName: state.jobName || '',
        description: state.description || '',
        templateUsed: f['Template name'] || '',
        projectType: est.projectType || '',
        lineItems: state.lines,
        showPrices: !!state.showPrices,
        subtotal, deposit: depositAmt, tax: taxAmt, total,
        renderedBody: renderedBodyHtml,
        accentColour: accent,
      };

      let saveFailed = false;
      try {
        await fetchWithRetry(`${CONFIG.PROXY_WORKER}/save-proposal`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      } catch(e) {
        console.error('Failed to save proposal', e);
        saveFailed = true;
      }

      mqOpenProposalPrintView(printWin, {
        shop: window._mqShopData || {},
        customerName: payload.customerName,
        accent,
        renderedBodyHtml,
        saveFailed,
      });

      mqCloseProposalModal();
    };

    // Builds the actual printable page — opened in a new tab. The header
    // (logo, shop name, accent bar, date) is the one fixed part; everything
    // below it is opts.renderedBodyHtml, already fully substituted from the
    // shop owner's own freeform template text. Includes html2pdf.js so
    // there's a real, direct "Download PDF" button that works the same way
    // on a phone as it does on desktop — window.print()'s "save as PDF"
    // option is unreliable on mobile browsers, so this skips that entirely.
    function buildProposalPrintHTML(opts) {
      const shop = opts.shop || {};
      const accent = opts.accent || '#1a3a6b';
      const logo = shop['Logo URL'] ? `<img src="${shop['Logo URL']}" crossorigin="anonymous" style="max-height:60px;max-width:220px;object-fit:contain"/>` : '';
      const pdfFilename = 'proposal-' + (opts.customerName||'proposal').replace(/[^a-z0-9]/gi,'-').toLowerCase() + '.pdf';

      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Proposal — ${mqEscapeHtml(opts.customerName)}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#111; background:#f3f4f6; margin:0; padding:40px 20px; }
  .mq-proposal-wrap { max-width:720px; margin:0 auto; }
  #mq-proposal-content { background:#fff; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,0.08); padding:40px 36px; }
  @media print {
    @page { margin: 0.6in; }
    .mq-no-print { display:none; }
    body { background:#fff; padding:0; }
    #mq-proposal-content { box-shadow:none; border-radius:0; padding:0; }
  }
</style>
</head><body>
  <div class="mq-proposal-wrap">
  ${opts.saveFailed ? `<div class="mq-no-print" style="background:#fffbeb;border:1px solid #f59e0b;color:#92400e;padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px">⚠ Couldn't save this to your proposal history (connection issue) — it's not in "My Proposals," but you can still download it now.</div>` : ''}
  <div class="mq-no-print" style="margin-bottom:20px">
    <button id="mq-pdf-btn" onclick="mqDownloadProposalPdf()" style="width:100%;padding:12px;background:${accent};color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">⬇ Download PDF</button>
  </div>
  <div id="mq-proposal-content">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accent};padding-bottom:16px;margin-bottom:24px">
      <div>
        ${logo}
        <div style="font-size:18px;font-weight:800;margin-top:6px">${mqEscapeHtml(shop['Shop name'])}</div>
        <div style="font-size:12px;color:#6b7280">${mqEscapeHtml(shop['City'])}${shop['Phone']?(' · '+mqEscapeHtml(shop['Phone'])):''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:22px;font-weight:800;color:${accent}">Proposal</div>
        <div style="font-size:12px;color:#6b7280">${new Date().toLocaleDateString()}</div>
      </div>
    </div>
    ${opts.renderedBodyHtml || ''}
  </div>
  </div>
  <script>
    function mqDownloadProposalPdf() {
      const el = document.getElementById('mq-proposal-content');
      const btn = document.getElementById('mq-pdf-btn');
      if (!window.html2pdf) {
        alert('Still loading — please wait a second and try again, or use Print instead.');
        return;
      }
      const originalText = btn.textContent;
      btn.textContent = 'Preparing PDF...';
      btn.disabled = true;
      html2pdf().set({
        margin: 0.5,
        filename: '${pdfFilename}',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        // No pagebreak "avoid" config, deliberately — see the long comment
        // in mqRenderProposalBodyTokens for the full reasoning. Short
        // version: avoiding a mid-line break can only be done by inserting
        // a blank spacer that pushes content to the next page, which risks
        // a much worse half-empty page. Plain natural slicing, with no
        // avoidance rules at all, makes that kind of gap impossible.
      }).from(el).save().then(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }).catch(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        alert('Something went wrong generating the PDF — try Print instead.');
      });
    }
  <\/script>
</body></html>`;
    }

    function mqOpenProposalPrintView(printWin, opts) {
      if (!printWin || printWin.closed) { alert('Please allow pop-ups to view/print this proposal.'); return; }
      printWin.document.open(); // clears the "Preparing..." placeholder before writing the real page
      printWin.document.write(buildProposalPrintHTML(opts));
      printWin.document.close();
    }

    window.mqOpenProposalsList = async function() {
      let modal = document.getElementById('mq-proposals-list-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mq-proposals-list-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100005;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
        document.body.appendChild(modal);
      }
      modal.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:520px;width:100%;padding:1.75rem;max-height:85vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
          <div style="font-size:18px;font-weight:800;color:#111">📄 My Proposals</div>
          <button onclick="mqCloseProposalsList()" style="background:none;border:none;font-size:24px;color:#9ca3af;cursor:pointer;line-height:1">&times;</button>
        </div>
        <input type="text" id="mq-proposals-search" oninput="mqRenderProposalsListBody(this.value)" placeholder="🔍 Search by customer, job, or description" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:1rem;font-family:inherit"/>
        <div style="font-size:11px;color:#9ca3af;margin-bottom:10px;margin-top:-6px">Newest first</div>
        <div id="mq-proposals-list-body"><div style="text-align:center;padding:2rem;color:#6b7280">Loading...</div></div>
      </div>`;
      modal.style.display = 'flex';

      try {
        const res = await fetchWithRetry(`${CONFIG.PROXY_WORKER}/proposals?shop=${encodeURIComponent(shopToken)}`, {});
        const j = await res.json();
        window._mqSavedProposals = j.proposals || [];
      } catch(e) { console.error('Failed to load saved proposals', e); window._mqSavedProposals = []; }

      mqRenderProposalsListBody('');
    };

    // Filters the already-fetched list client-side (customer name, job name,
    // and description) — no need to re-hit the server for every keystroke.
    window.mqRenderProposalsListBody = function(searchTerm) {
      const body = document.getElementById('mq-proposals-list-body');
      if (!body) return;
      const term = (searchTerm || '').trim().toLowerCase();
      const all = window._mqSavedProposals || [];
      const list = term ? all.filter(p => {
        const f = p.fields;
        return (f['Customer name']||'').toLowerCase().includes(term)
          || (f['Job name']||'').toLowerCase().includes(term)
          || (f['Description']||'').toLowerCase().includes(term);
      }) : all;

      if (!all.length) {
        body.innerHTML = `<div style="text-align:center;padding:1.5rem;color:#6b7280;font-size:14px">No proposals saved yet. Create one from an estimate to see it here.</div>`;
        return;
      }
      if (!list.length) {
        body.innerHTML = `<div style="text-align:center;padding:1.5rem;color:#6b7280;font-size:14px">No proposals match "${searchTerm.replace(/</g,'&lt;')}".</div>`;
        return;
      }
      body.innerHTML = list.map(p => {
        const f = p.fields;
        const date = new Date(p.createdTime).toLocaleDateString();
        return `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin-bottom:10px;position:relative">
          <div onclick="mqReprintProposal('${p.id}')" style="cursor:pointer">
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:24px">
              <div style="font-weight:700;font-size:14px">${(f['Customer name']||'Unnamed').replace(/</g,'&lt;')}</div>
              <div style="font-size:12px;color:#9ca3af;white-space:nowrap">${date}</div>
            </div>
            ${f['Job name'] ? `<div style="font-size:13px;font-weight:600;margin-top:2px">${(f['Job name']||'').replace(/</g,'&lt;')}</div>` : ''}
            ${f['Description'] ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${(f['Description']||'').replace(/</g,'&lt;')}</div>` : ''}
            <div style="font-size:12px;color:#374151;margin-top:4px">${(f['Project type']||'').replace(/</g,'&lt;')}${f['Project type']&&f['Template used']?' · ':''}${(f['Template used']||'').replace(/</g,'&lt;')} · <strong>$${(f['Total']||0).toFixed(2)}</strong></div>
          </div>
          <button onclick="mqDeleteProposal('${p.id}',event)" title="Delete" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:2px 4px">✕</button>
        </div>`;
      }).join('');
    };

    window.mqDeleteProposal = async function(id, event) {
      if (event) event.stopPropagation(); // don't also trigger the reprint click on the card underneath
      if (!confirm('Delete this proposal? This cannot be undone.')) return;
      try {
        await fetchWithRetry(`${CONFIG.PROXY_WORKER}/delete-proposal`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopToken, proposalId: id }),
        });
        window._mqSavedProposals = (window._mqSavedProposals || []).filter(p => p.id !== id);
        const searchInput = document.getElementById('mq-proposals-search');
        mqRenderProposalsListBody(searchInput ? searchInput.value : '');
      } catch(e) {
        console.error('Failed to delete proposal', e);
        alert('Could not delete this proposal — check your connection and try again.');
      }
    };

    window.mqCloseProposalsList = function() {
      const modal = document.getElementById('mq-proposals-list-modal');
      if (modal) modal.style.display = 'none';
    };

    // Reprints from the frozen, fully-rendered snapshot saved at creation
    // time — literally the same HTML that was generated originally, not a
    // reconstruction from today's template settings (which may have since
    // changed, or been deleted entirely). This is what "saved exactly as it
    // was" actually means: nothing to reassemble, nothing that can drift.
    window.mqReprintProposal = function(id) {
      const p = (window._mqSavedProposals || []).find(x => x.id === id);
      if (!p) return;
      const f = p.fields;
      const printWin = window.open('', '_blank');
      if (!printWin) { alert('Please allow pop-ups to view/print this proposal.'); return; }
      mqOpenProposalPrintView(printWin, {
        shop: window._mqShopData || {},
        customerName: f['Customer name'] || '',
        accent: f['Accent colour'] || '#1a3a6b',
        renderedBodyHtml: f['Rendered body'] || '',
      });
    };
  }

  init();
  mqInitMobileFontFix();

})();