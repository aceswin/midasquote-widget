/*
 * MidasQuote Widget v3.3 — TEST BUILD (widgettest.js)
 * Adds visual thumbnails to specialty items so customers don't have to
 * guess what unfamiliar terms mean without leaving the widget.
 */

(function() {

  const CONFIG = {
    PROXY_WORKER:    'https://midasquote-airtable-proxy.jordan132001.workers.dev',
    EMAIL_WORKER:    'https://midasquote-email.jordan132001.workers.dev',
  };

  const scriptTag = document.currentScript;
  const shopToken = new URLSearchParams(scriptTag.src.split('?')[1] || '').get('shop');
  if (!shopToken) { console.error('MidasQuote: No shop token found.'); return; }
//This is the widget test file
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
    window._mqRangeLow  = (100 - (parseFloat(shop['Quote range low'])  || 10)) / 100;
    window._mqRangeHigh = (100 + (parseFloat(shop['Quote range high']) || 15)) / 100;
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
        { id:'refacing',   name:'Refacing',    adjustment:0,  description:'Love your layout, just not the look? Refacing gives your cabinets a whole new personality — new doors, drawer fronts, crown, and valance — without the cost or mess of a full remodel.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/refacing.png', measureText:"**Measure in sections:** Break your cabinets into individual runs or sections — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**For each section:** Measure the width and the height. Inches work fine — you'll convert them in the next step.\n\n**Convert to square feet:** (Width ÷ 12) × (Height ÷ 12) = square feet for that section. Already measured in feet? Just multiply Width × Height directly.\n\n**Add it all up:** Once you have the square footage for every section, add them all together for your total.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!\n\n[tip]**Don't feel like converting inches or mm to square feet?** Tap the [calc] next to the field and it'll do the conversion and add up the sections for you.[/tip]", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/refacing.png' },
        { id:'repainting', name:'Repainting',  adjustment:0,  description:'Sometimes all it takes is a fresh coat. Give your existing cabinets new color and new life, without replacing a thing.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/repainting.png', measureText:"**Measure in sections:** Break your cabinets into individual runs or sections — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**For each section:** Measure the width and the height. Inches work fine — you'll convert them in the next step.\n\n**Convert to square feet:** (Width ÷ 12) × (Height ÷ 12) = square feet for that section. Already measured in feet? Just multiply Width × Height directly.\n\n**Add it all up:** Once you have the square footage for every section, add them all together for your total.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!\n\n[tip]**Don't feel like converting inches or mm to square feet?** Tap the [calc] next to the field and it'll do the conversion and add up the sections for you.[/tip]", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/repainting.png' },
        { id:'restaining', name:'Restaining',  adjustment:0,  description:'Bring back the natural beauty of your cabinets. A fresh stain can restore that warm, rich look you fell in love with in the first place.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/restaining.png', measureText:"**Measure in sections:** Break your cabinets into individual runs or sections — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**For each section:** Measure the width and the height. Inches work fine — you'll convert them in the next step.\n\n**Convert to square feet:** (Width ÷ 12) × (Height ÷ 12) = square feet for that section. Already measured in feet? Just multiply Width × Height directly.\n\n**Add it all up:** Once you have the square footage for every section, add them all together for your total.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!\n\n[tip]**Don't feel like converting inches or mm to square feet?** Tap the [calc] next to the field and it'll do the conversion and add up the sections for you.[/tip]", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/restaining.png' },
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
    // Items flagged "Pro only" never appear here at all — same idea as a
    // Pro-only project type, just at the individual item level. They still
    // show up in MidasQuote Pro, for every project type they're tagged to.
    const specs = assignBadges(specRecords
      .filter(r => !r.fields['Pro only'])
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
          // Per-item supply/install choice — lets a shop offer some items
          // (e.g. refacing doors) supply-only even while installing
          // everything else. If not offered, offersInstallChoice is false
          // and installMode is purely a label for what the flat price above
          // already represents — it never changes the price.
          offersInstallChoice: r.fields['Offers install choice']||false,
          installPrice: r.fields['Install price']||0,
          installMode: r.fields['Install mode']||'supply',
          description: r.fields['Description']||'',
          category: r.fields['Category']||'',
        };
      }));

    return { shop, pricing:p, specs, li, hasDynamic, shopPhotos, roomTypes };
  }

  // ============================================================
  // EMAIL & LEAD
  // ============================================================
  async function saveLead(data, lead, quoteType, low, high, lines, roomType) {
    const { shop } = data;
    try {
      await fetchWithRetry(`${CONFIG.PROXY_WORKER}/save-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopToken, name: lead.name, email: lead.email, phone: lead.phone,
          quoteType, roomType: roomType||'', sessionId: _mqSessionId, low, high, lines,
        }),
      });
    } catch(e) { console.error('Lead save failed', e); }

    const lineRows = (lines||[])
      .filter(l=>l&&l.label&&(l.header||l.cost!==undefined))
      .map(l=>l.header
        ? `<tr><td colspan="2" style="padding:12px 8px 4px;font-weight:700;color:#111;font-size:14px;text-transform:uppercase;letter-spacing:0.04em">${l.label}</td></tr>`
        : `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">${l.label}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;${l.bold?'font-weight:700;color:#111':''}">${'$'}${Math.round(l.cost).toLocaleString()}</td></tr>`
      ).join('');

    if (!lead._isSkip) await sendEmail(shop['Lead notify email'], `New ${quoteType} quote lead — ${lead.name}`,
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1a1a1a">New ${quoteType} quote lead</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600" colspan="2">Customer details</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Name</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.name}</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Email</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.email}</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Phone</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.phone}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600" colspan="2">Quote breakdown</td></tr>${lineRows}
        </table>
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:14px;color:#666;margin-bottom:4px">Estimated range</div>
          <div style="font-size:28px;font-weight:700;color:#16a34a">$${low.toLocaleString()} – $${high.toLocaleString()}</div>
        </div>
      </div>`);

  if (lead.email && !lead._isSkip) {
      const customerLineRows = (lines||[]).filter(l=>l&&l.label&&!l.bold)
        .sort((a,b)=>b.cost-a.cost)
        .map(l=>`<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#444">✓ ${l.label}</td></tr>`).join('');
      await sendEmail(lead.email, `Your quote from ${shop['Shop name']}`,
        `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#1a1a1a">Your ${quoteType} quote from ${shop['Shop name']}</h2>
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px">
            <div style="font-size:14px;color:#666;margin-bottom:4px">Your estimated range</div>
            <div style="font-size:28px;font-weight:700;color:#16a34a">$${low.toLocaleString()} – $${high.toLocaleString()}</div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="padding:8px;background:#f9fafb;font-weight:600">What’s included</td></tr>${customerLineRows}
          </table>
          <p style="color:#666;font-size:14px">${shop['Disclaimer text']||'Ballpark estimate only. Contact us for a full quote.'}</p>
          <p style="color:#666;font-size:14px;margin-top:8px">⚠ Jobs outside our local delivery area may be subject to additional travel charges — your final quote will confirm the exact amount.</p>
          <p style="color:#666;font-size:14px"><strong>${shop['Shop name']}</strong><br/>${shop['Phone']||''}</p>
        </div>`);
    }
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
      #midasquote-widget{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:900px;margin:20px auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.18),0 4px 16px rgba(0,0,0,0.10)}
      @media (max-width:600px){
        #midasquote-widget{margin:0 0.07rem 2rem}
        #midasquote-widget .mq-label{font-size:15px}
        #midasquote-widget .mq-hint{font-size:15px}
        #midasquote-widget .mq-sec-title{font-size:14px}
        /* Header and tab bar both had 1.5rem of side padding meant for
           desktop — on a narrow phone that, plus the widget's own outer
           margin plus the gap between the 3 tabs, was eating into the width
           available for their actual content (the showroom button, and the
           rightmost "Countertops" tab specifically), causing both to get
           clipped right at the edge. */
        #midasquote-widget .mq-header{padding:0.85rem 0.6rem;gap:8px}
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
      #midasquote-widget .mq-logo{width:48px;height:48px;border-radius:8px;background:${bc};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;flex-shrink:0;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.28)}
      #midasquote-widget .mq-logo img{width:100%;height:100%;object-fit:cover}
      #midasquote-widget .mq-shop-name{font-size:14px;font-weight:600;color:#111}
      #midasquote-widget .mq-shop-sub{font-size:13px;color:#4b5563}
      #midasquote-widget .mq-tab-bar{display:flex;background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:10px 1.5rem;gap:8px}
      #midasquote-widget .mq-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;font-size:14px;font-weight:500;color:#4b5563;cursor:pointer;border:1px solid #e5e7eb;border-radius:8px;background:#fff;transition:all 0.15s;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.10)}
      #midasquote-widget .mq-tab.active{background:${bc};color:#fff;border-color:${bc};box-shadow:0 6px 20px rgba(0,0,0,0.30)}
      #midasquote-widget .mq-tab-icon{font-size:18px;flex-shrink:0}
      #midasquote-widget .mq-tab-label{display:flex;flex-direction:column;align-items:flex-start;gap:1px}
      #midasquote-widget .mq-tab-title{font-size:14px;font-weight:500;line-height:1}
      #midasquote-widget .mq-tab-sub{font-size:10px;opacity:0.7;line-height:1}
      #midasquote-widget .mq-tab-content{display:none;padding:1.5rem}
      #midasquote-widget .mq-tab-content.active{display:block}
      #midasquote-widget .mq-sec{background:#fff;border:1.5px solid #d1d5db;border-radius:10px;padding:1.25rem;margin-bottom:1rem;box-shadow:0 4px 14px rgba(0,0,0,0.10)}
      #midasquote-widget .mq-sec{border-left:4px solid #bfdbfe}
      #midasquote-widget .mq-step-badge{width:22px;height:22px;border-radius:50%;background:#2563eb;color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-family:inherit}
      #midasquote-widget .mq-sec-header-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;cursor:pointer}
      #midasquote-widget .mq-sec-header-row .mq-sec-title{margin-bottom:0}
      #midasquote-widget .mq-collapse-arrow{display:inline-block;transition:transform 0.2s;font-size:12px;color:#6b7280;flex-shrink:0;margin-left:8px}
      #midasquote-widget .mq-collapse-arrow.open{transform:rotate(90deg)}
      #midasquote-widget .mq-sec.mq-step-current{box-shadow:0 0 0 3px #93c5fd,0 4px 14px rgba(0,0,0,0.10);opacity:1}
      #midasquote-widget .mq-sec.mq-step-done{filter:brightness(0.8);transition:filter 0.2s}
      #midasquote-widget .mq-sec.mq-step-upcoming{filter:brightness(0.55);transition:filter 0.2s}
      #midasquote-widget .mq-sec.mq-step-current{transition:box-shadow 0.2s}
      #midasquote-widget .mq-step-footer{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:14px;border-top:1px dashed #e5e7eb}
      #midasquote-widget .mq-step-continue-btn{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
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
      #midasquote-widget .mq-spec-item.on{background:#eff6ff;border-color:#93c5fd}
      #midasquote-widget .mq-spec-name{font-size:14px;line-height:1.15;color:#111;flex:1;cursor:pointer;display:block}
      #midasquote-widget .mq-spec-category-heading{color:${bc}}
      #midasquote-widget .mq-spec-category-group{border:1.5px solid #e0e0e0;border-radius:12px;padding:12px 14px 14px;background:#fafafa;box-shadow:0 8px 20px rgba(0,0,0,0.12),0 2px 6px rgba(0,0,0,0.08)}
      #midasquote-widget .mq-spec-category-heading{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px}
      #midasquote-widget .mq-spec-category-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}
      #midasquote-widget .mq-spec-item.on .mq-spec-name{color:#1d4ed8}
      #midasquote-widget .mq-spec-thumb{width:96px;height:96px;border-radius:6px;object-fit:cover;flex-shrink:0;cursor:zoom-in;border:1px solid #e5e7eb;background:#f3f4f6}
      #midasquote-widget .mq-spec-thumb-placeholder{width:96px;height:96px;border-radius:6px;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:20px;color:#6b7280;border:1px solid #e5e7eb}
      #midasquote-widget .mq-vpicker-row{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
      #midasquote-widget .mq-vpicker-chip{flex-shrink:0;width:120px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;font-family:inherit;transition:all 0.15s}
      #midasquote-widget .mq-vpicker-chip.selected{border-color:${bc};background:${bc}0d}
      #midasquote-widget .mq-spec-mode-select{cursor:pointer}
      #midasquote-widget .mq-spec-mode-select option[value=""]{color:#9ca3af}
      @keyframes mqShakeChoice{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
      #midasquote-widget .mq-spec-mode-select.mq-needs-choice{animation:mqShakeChoice 0.4s ease;border-color:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,0.15)}
      #midasquote-widget .mq-vpicker-thumb{width:96px;height:96px;border-radius:6px;object-fit:cover;background:#f3f4f6}
      #midasquote-widget .mq-vpicker-thumb-placeholder{width:96px;height:96px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:20px;color:#6b7280}
      #midasquote-widget .mq-vpicker-label{font-size:10px;color:#374151;text-align:center;line-height:1.2;word-break:break-word;max-width:100%}
      #midasquote-widget .mq-vpicker-chip.selected .mq-vpicker-label{color:${bc};font-weight:600}
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
      #midasquote-widget .mq-tog{width:36px;height:20px;background:#d1d5db;border-radius:10px;position:relative;transition:background 0.2s;flex-shrink:0}
      #midasquote-widget .mq-tog.on{background:${bc}}
      #midasquote-widget .mq-tog::after{content:'';position:absolute;width:16px;height:16px;background:#fff;border-radius:50%;top:2px;left:2px;transition:left 0.2s}
      #midasquote-widget .mq-tog.on::after{left:18px}
      #midasquote-widget .mq-sub-sec{background:#f9fafb;border-radius:8px;padding:1rem;margin-top:0.75rem;border-left:4px solid #d1d5db}
      #midasquote-widget .mq-sub-sec.mq-sub-upper{border-left-color:#3b82f6;background:#eff6ff}
      #midasquote-widget .mq-sub-sec.mq-sub-base{border-left-color:#f59e0b;background:#fffbeb}
      #midasquote-widget .mq-sub-title{font-size:15px;font-weight:700;color:#111;margin:0 0 0.85rem;display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1px solid rgba(0,0,0,0.08)}
      #midasquote-widget .mq-calc-btn{width:100%;padding:13px;font-size:15px;font-weight:600;background:${bc};color:#fff;border:none;border-radius:8px;cursor:pointer;margin-top:0.5rem;transition:opacity 0.15s;font-family:inherit;box-shadow:0 6px 20px rgba(0,0,0,0.25)}
      #midasquote-widget .mq-calc-btn:hover{opacity:0.88}
      #midasquote-widget .mq-calc-btn:disabled{opacity:0.4;cursor:not-allowed}
      @keyframes mqCalcPulse{0%,100%{box-shadow:0 6px 20px rgba(0,0,0,0.25)}50%{box-shadow:0 0 0 7px ${bc}66,0 6px 20px rgba(0,0,0,0.25)}}
      #midasquote-widget .mq-calc-btn.mq-calc-btn-pulse{animation:mqCalcPulse 0.8s ease 2}
      #midasquote-widget .mq-calc-btn-both{background:linear-gradient(135deg,${bc},#378ADD)}
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
      #midasquote-widget .mq-combined-result{display:none;background:linear-gradient(135deg,#f0fdf4,#eff6ff);border:1px solid #86efac;border-radius:10px;padding:1.5rem;margin-top:1rem;box-shadow:0 6px 24px rgba(0,0,0,0.10)}
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
      ? sortAndBadgeItems(entries.map(([k,m])=>({value:k, label:m.label, photoUrl:m.photoUrl, icon:'🪨', price:(m.ps||0)+(m.pi||0), visibleRooms:m.visibleRooms||[]})))
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

  function pickerRow(selectId, items, extraOnChangeAttr) {
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
      return `<div class="mq-vpicker-chip${selectedClass}" data-vpicker-for="${selectId}" data-value="${it.value}" data-rooms="${roomsAttr}" onmouseenter="mqHoverPreviewShow(this,'${safePhoto}','${safeLabel}')" onmouseleave="mqHoverPreviewHide()"><div style="position:relative">${thumb}${badgeHtml}</div><span class="mq-vpicker-label">${it.label}</span><button type="button" class="mq-vpicker-select-btn" onclick="mqPickVisual('${selectId}',this)">${selectBtnLabel}</button></div>`;
    }).join('');
    return `<div class="mq-vpicker-row" id="mq-vprow-${selectId}">${chips}</div>`;
  }

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
      // Items offering a choice get a dropdown that starts on a
      // non-selectable "Choose one" placeholder — not defaulted to match
      // the project's overall setting, since the whole point here is
      // forcing an actual decision rather than letting people miss that
      // there was a choice at all. Trying to add quantity before choosing
      // shakes and highlights the dropdown instead of silently doing
      // nothing — see mqSpecModeChosen.
      const installModeHtml = s.offersInstallChoice
        ? `<select id="mq-spec-mode-${prefix}-${i}" class="mq-spec-mode-select" style="font-size:11px;padding:4px 6px;border:1.5px solid #d1d5db;border-radius:5px;margin-top:4px;width:100%;background:#fff;color:#111;font-weight:600">
            <option value="" selected disabled>Choose one</option>
            <option value="supply">Supply only</option>
            <option value="install">Supplied &amp; Installed</option>
          </select>`
        : (s.installMode === 'na' ? '' : `<div style="font-size:11px;color:#6b7280;margin-top:2px">${s.installMode === 'installed' ? 'Supplied & Installed' : 'Supply only'}</div>`);
      return `
      <div class="mq-spec-item" id="mq-sp-${prefix}-${i}" data-rooms="${roomsAttr}">
        <div class="mq-spec-top">
          <div style="position:relative;flex-shrink:0">${thumb}${badgeHtml}</div>
          <div style="flex:1;min-width:0">
            <span class="mq-spec-name" onclick="mqToggleSpec('${prefix}',${i})">${s.label}</span>
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
        </div>
      </div>`;
    };

    // No shop has assigned any categories yet — keep the exact same flat
    // layout it's always had, nothing changes for anyone who hasn't
    // adopted this.
    const hasAnyCategory = specs.some(s => (s.category||'').trim());
    if (!hasAnyCategory) return specs.map((s,i)=>buildCard(s,i)).join('');

    // Group by category, preserving first-seen order. Anything without a
    // category gets swept into a trailing "Other" group instead of showing
    // up unlabeled above the organized ones — every visible section always
    // has a heading once categories are in use at all.
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
        <div style="margin-bottom:6px"><strong>Upper cabinets:</strong> Stand at one end of the wall where your uppers will go and measure straight across to the other end. Write that number down in feet.</div>
        <div style="margin-bottom:6px"><strong>Base cabinets:</strong> Same thing — measure the total wall length where your base cabinets will sit.</div>
        <div style="margin-bottom:6px"><strong>Island cabinets:</strong> Include island cabinets if you have one.</div>
        ${cornerSection}
        <div style="background:#fffbeb;border-radius:6px;padding:8px 10px;margin-top:8px;color:#92400e;font-size:12px">💡 <strong>Don't feel like converting inches or mm?</strong> Tap the ${mqCalcIconInlineHTML()} next to the field and it'll convert it for you.</div>`;
    }
    return `
      <div style="font-weight:600;margin-bottom:8px;color:#111">📏 Quick measuring guide</div>
      <div style="margin-bottom:6px"><strong>Upper cabinets:</strong> Stand at one end of the wall where your uppers will go and measure straight across to the other end. Write that number down in feet.</div>
      <div style="margin-bottom:6px"><strong>Base cabinets:</strong> Same thing — measure the total wall length where your base cabinets will sit.</div>
      <div style="margin-bottom:6px"><strong>Not sure?</strong> Just use your best guess — this is a ballpark estimate!</div>
      <div style="margin-bottom:6px"><strong>Tip:</strong> measure in feet, not inches. If your wall is 12 feet and 6 inches wide, enter 12.5.</div>
      ${roomId !== 'bathroom' ? cornerSection : ''}
      <div style="background:#fffbeb;border-radius:6px;padding:8px 10px;margin-top:8px;color:#92400e;font-size:12px">💡 <strong>Don't feel like converting inches or mm?</strong> Tap the ${mqCalcIconInlineHTML()} next to the field and it'll convert it for you.</div>`;
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
    // [tip]...[/tip] wraps a line in the same yellow callout box the
    // built-in default guide uses for its "don't feel like converting"
    // note — lets a shop owner get that same visual treatment on their own
    // custom text, anywhere they want it, not just baked into one fixed spot.
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
    // If this is a specialty item's quantity field, and that item needs a
    // supply/install choice that hasn't been made yet, don't open the
    // calculator at all — shake the dropdown instead, same as trying to
    // type a number directly. Otherwise someone could spend a minute
    // entering all their measurements only to find out afterward they
    // still needed to make a choice first.
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
      <button type="button" onclick="mqCalcAddSection()" style="width:100%;padding:8px;border-radius:6px;border:1.5px dashed #93c5fd;background:#eff6ff;color:#1e40af;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:14px">+ Add another section</button>
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
    // On mobile, this modal's own text inputs bring up the on-screen
    // keyboard — closing it dismisses that keyboard, which shrinks the
    // viewport back to full height and can make the browser shift the
    // scroll position on its own, often enough that the field someone was
    // just filling in ends up scrolled out of view. Nudge it back into a
    // visible spot once that settles, rather than leaving it wherever the
    // browser's own adjustment happened to land.
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
    // click already fully manages toggling both directions by itself.
    return `<div class="mq-sec-header-row" onclick="event.stopPropagation();mqToggleCollapse('${key}')">
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
    const drawerConfigItems = sortAndBadgeItems(drawerConfigNames.map((n,i)=>({
      value:`${i}`, label:n, photoUrl:(shopPhotos||{})[photoKeyFor('drawer', n)]||'', icon:'🗄️',
      // Badge/sort by the "Some drawers" rate as the representative price for this config
      price: li.drawers.find(d => d['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i,'').trim()===n && /some drawers/i.test(d['Name']))?.['Rate'] || 0,
      visibleRooms: li.drawers.find(d => d['Name'].replace(/\s*—\s*(some|mostly) drawers\s*$/i,'').trim()===n)?.visibleRooms || [],
    })));

    // Same value indexing as mOpts/dOpts/hingeOpts above (dyn_0, dyn_1... when
    // the shop has real pricing data, or the legacy fallback values when not)
    // so picking a chip always sets a value the existing calc logic already understands.
    // Sorted cheapest-first with $/$$/$$$ badges so customers can tell at a
    // glance which options cost more — "None" (where it exists) always stays
    // pinned first with no badge, since it's not really a "priced" choice.
    const mItems = li.materials.length > 0
      ? sortAndBadgeItems(li.materials.map((m,i)=>{
          // li.materials only carries whichever row (uppers or bases) won
          // the earlier dedup pass — it never actually has a rateB/rateU
          // property of its own. Look up the real "bases" rate the same
          // way the price calculator does, so sorting reflects an actual
          // price instead of silently defaulting every material to 0
          // (which made them all tie and just show in whatever order
          // Airtable happened to store the rows in).
          const baseName = m._baseName || m['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim();
          const bItem = li.rawMaterials.find(r => r['Name'].replace(/\s*—\s*(uppers|bases).*$/i,'').trim() === baseName && r['Unit']?.includes('bases'));
          const priceRate = bItem ? (bItem['Rate']||0) : (m['Rate']||0);
          return {value:`dyn_${i}`, label:baseName, photoUrl:m.photoUrl, icon:'🪵', price:priceRate, visibleRooms:m.visibleRooms||[]};
        }))
      : [{value:'melamine',label:'Melamine',icon:'🪵'},{value:'plywood',label:'Plywood',icon:'🪵'}];
    const dItems = sortAndBadgeItems([{value:'none',label:'No doors',icon:'🚫'}].concat(
      li.doorStyles.length > 0
        ? li.doorStyles.map((d,i)=>({value:`dyn_${i}`, label:d['Name'], photoUrl:d.photoUrl, icon:'🚪', price:d['Rate']||0, visibleRooms:d.visibleRooms||[]}))
        : [{value:'slab',label:'Slab',icon:'🚪'},{value:'shaker',label:'Shaker',icon:'🚪'}]
    ));
    const hingeItems = li.hinges.length > 0
      ? sortAndBadgeItems(li.hinges.map((h,i)=>({value:`dyn_${i}`, label:h['Name'], photoUrl:h.photoUrl, icon:'🔧', price:h['Rate']||0, visibleRooms:h.visibleRooms||[]})))
      : [{value:'softclose',label:'Soft-close',icon:'🔧'},{value:'regular',label:'Regular',icon:'🔧'}];
    const crownItems = sortAndBadgeItems([{value:'none',label:'None',icon:'🚫'}].concat(
      Object.entries(TRIM).filter(([k,t])=>t.type==='crown').map(([k,t])=>({value:k, label:t.label, photoUrl:t.photoUrl, icon:'👑', price:(t.ps||0)+(t.pi||0), visibleRooms:t.visibleRooms||[]}))
    ));
    const valanceItems = sortAndBadgeItems([{value:'none',label:'None',icon:'🚫'}].concat(
      Object.entries(TRIM).filter(([k,t])=>t.type==='valance').map(([k,t])=>({value:k, label:t.label, photoUrl:t.photoUrl, icon:'📏', price:(t.ps||0)+(t.pi||0), visibleRooms:t.visibleRooms||[]}))
    ));

    return `
      <div class="mq-sec">
        <p class="mq-sec-title">Project basics</p>
        <div style="background:linear-gradient(135deg,#eff6ff,#f0f9ff);border:2px solid #93c5fd;border-radius:12px;padding:16px 18px">
          <label style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:#1e40af;margin-bottom:8px">
            <span style="background:#2563eb;color:#fff;border-radius:50%;width:26px;height:26px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">1</span>
            Start here — choose your project type
          </label>
          <select id="mq-${prefix}-room" onchange="mqTogVanityNote('${prefix}');mqTogDwOption('${prefix}');mqRefreshRoomVisibility('${prefix}');mqShowRoomDescription('${prefix}');mqRefreshMeasureGuide('${prefix}');mqRefreshAllPickerVisibility('${prefix}');mqOnProjectTypeChange('${prefix}')" style="font-size:15px;font-weight:600;padding:10px 12px">${(roomTypes||[]).filter(r=>!r.proOnly).map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select>
          <p class="mq-hint" id="mq-${prefix}-room-vanity-note" style="display:none;color:#1d4ed8;margin-top:8px"></p>
          <div id="mq-${prefix}-room-desc" style="display:none;margin-top:8px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:13px;color:#92400e;line-height:1.5"></div>
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
        <div style="background:linear-gradient(135deg,#eff6ff,#f0f9ff);border:2px solid #93c5fd;border-radius:12px;padding:16px 18px">
          <div class="mq-field"><label class="mq-label" style="font-size:14px;font-weight:700;color:#1e40af">${hasInstall ? 'Supply + install?' : 'Supply'}</label>
            <p class="mq-hint" style="margin-bottom:8px">${hasInstall ? "Let us know if you just need the cabinets themselves (supply only), or if you'd also like us to install them for you (supply + install)." : 'This shop offers supply only — installation is not included.'}</p>
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
            ${pickerRow(`mq-${prefix}-mat`, mItems)}
            <select id="mq-${prefix}-mat" style="display:none">${mOpts}</select></div>
          <div class="mq-field" style="margin-top:10px"><label class="mq-label">Door style</label>
            ${pickerRow(`mq-${prefix}-door`, dItems)}
            <select id="mq-${prefix}-door" onchange="mqApplyLinkedTrim('${prefix}', this.value)" style="display:none">${dOpts}</select></div>
          ${hasHinges?`<div class="mq-field" style="margin-top:10px"><label class="mq-label">Door hinges</label>
            ${pickerRow(`mq-${prefix}-hinge`, hingeItems)}
            <select id="mq-${prefix}-hinge" style="display:none">${hingeOpts}</select></div>`:''}
          <p class="mq-hint" style="margin-top:6px">These materials may not reflect our full inventory. If you don't see yours, please feel free to contact us.</p>
        </div>
        <div id="mq-${prefix}-diff" style="display:none">
          <div class="mq-sub-sec mq-sub-upper"><p class="mq-sub-title">🔼 Upper cabinets</p>
            <div class="mq-field"><label class="mq-label">Box material</label>
              ${pickerRow(`mq-${prefix}-u-mat`, mItems)}
              <select id="mq-${prefix}-u-mat" style="display:none">${mOpts}</select></div>
            <div class="mq-field" style="margin-top:10px"><label class="mq-label">Door style</label>
              ${pickerRow(`mq-${prefix}-u-door`, dItems)}
              <select id="mq-${prefix}-u-door" onchange="mqApplyLinkedTrim('${prefix}', this.value)" style="display:none">${dOpts}</select></div>
            ${hasHinges?`<div class="mq-field" style="margin-top:10px"><label class="mq-label">Door hinges</label>
              ${pickerRow(`mq-${prefix}-u-hinge`, hingeItems)}
              <select id="mq-${prefix}-u-hinge" style="display:none">${hingeOpts}</select></div>`:''}
          </div>
          <div class="mq-sub-sec mq-sub-base" style="margin-top:8px"><p class="mq-sub-title">🔽 Base cabinets</p>
            <div class="mq-field"><label class="mq-label">Box material</label>
              ${pickerRow(`mq-${prefix}-b-mat`, mItems)}
              <select id="mq-${prefix}-b-mat" style="display:none">${mOpts}</select></div>
            <div class="mq-field" style="margin-top:10px"><label class="mq-label">Door style</label>
              ${pickerRow(`mq-${prefix}-b-door`, dItems)}
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
          ${pickerRow(`mq-${prefix}-drawer-config`, drawerConfigItems)}
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
            ${pickerRow(`mq-${prefix}-trim-crown`, crownItems)}
            <select id="mq-${prefix}-trim-crown" onchange="mqTogTrimReturns('${prefix}')" style="display:none">${trimOpts('crown')}</select>
          </div>
          <div class="mq-field" id="mq-${prefix}-trim-crown-returns-wrap" style="display:none;margin-top:10px;background:#eff6ff;border:1.5px solid #93c5fd;border-radius:8px;padding:10px 12px">
            <div style="display:flex;align-items:flex-start">
              ${termHelpThumb(MQ_TERM_IMAGES.crownReturn,'What is a crown return?')}
              <div style="flex:1;min-width:0">
                <label class="mq-label" style="color:#1d4ed8;font-weight:700">Returns to wall</label>
                <input type="number" id="mq-${prefix}-trim-crown-returns" value="0" min="0" max="20"/>
                <div style="font-size:12px;color:#1d4ed8;margin-top:6px;line-height:1.5">A "return" is where the crown turns and meets the wall. Each return adds 1 linear foot to your total — count how many you have. If unsure, just leave as 0.</div>
              </div>
            </div>
          </div>
        </div>`:''}
        ${hasValance?`<div>
          <div class="mq-field"><label class="mq-label">Valance</label>
            ${pickerRow(`mq-${prefix}-trim-valance`, valanceItems)}
            <select id="mq-${prefix}-trim-valance" onchange="mqTogTrimReturns('${prefix}')" style="display:none">${trimOpts('valance')}</select>
          </div>
          <div class="mq-field" id="mq-${prefix}-trim-valance-returns-wrap" style="display:none;margin-top:10px;background:#eff6ff;border:1.5px solid #93c5fd;border-radius:8px;padding:10px 12px">
            <div style="display:flex;align-items:flex-start">
              ${termHelpThumb(MQ_TERM_IMAGES.valanceReturn,'What is a valance return?')}
              <div style="flex:1;min-width:0">
                <label class="mq-label" style="color:#1d4ed8;font-weight:700">Returns to wall</label>
                <input type="number" id="mq-${prefix}-trim-valance-returns" value="0" min="0" max="20"/>
                <div style="font-size:12px;color:#1d4ed8;margin-top:6px;line-height:1.5">A "return" is where the valance turns and meets the wall. Each return adds 1 linear foot to your total — count how many you have. If unsure, just leave as 0.</div>
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
    const logoHTML = shop['Logo URL'] ? `<img src="${shop['Logo URL']}" alt="${shop['Shop name']}"/>` : `<span>${(shop['Shop name']||'S').charAt(0)}</span>`;
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
      <div class="mq-header">
        <div class="mq-logo">${logoHTML}</div>
        <div style="flex:1">
          <div class="mq-shop-name">${shop['Shop name']||''}</div>
          <div class="mq-shop-sub">${shop['City']||''} &nbsp;·&nbsp; ${shop['Phone']||''}</div>
        </div>
        ${shop['Show showroom'] !== 'Hide' && shop['Shop token'] ? `<a href="https://widget.midasquote.com/showroom.html?shop=${shop['Shop token']}" target="_blank" style="font-size:13px;font-weight:600;color:#fff;text-decoration:none;background:${shop['Brand colour']||'#1a1a1a'};border-radius:8px;padding:7px 14px;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:6px;transition:opacity 0.15s;box-shadow:0 8px 24px rgba(0,0,0,0.30),0 2px 6px rgba(0,0,0,0.15)" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">🖼️ See our showroom</a>` : ''}
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
            <div><div class="mq-res-range-lbl">Estimated range</div><div class="mq-res-range" id="mq-c-res-range">—</div></div>
          </div>
          <ul class="mq-line-items" id="mq-c-line-items"></ul>
          <div class="mq-disclaimer">⚠ ${disc}</div>
          <div style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:6px;padding:10px 12px;margin-top:8px;font-size:13px;color:#92400e;line-height:1.5">🔧 <strong>Handles & knobs not included</strong> in this estimate unless listed as a specialty item above.</div>
          <div class="mq-travel-note">${TRAVEL_NOTE}</div>
          <div class="mq-cta-row">
            <button onclick="mqSwitchTab('both',document.querySelectorAll('.mq-tab')[0])">Get full project quote ✨</button>
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
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
            <div><div class="mq-res-range-lbl">Estimated range</div><div class="mq-res-range" id="mq-ct-res-range">—</div></div>
          </div>
          <ul class="mq-line-items" id="mq-ct-line-items"></ul>
          <div class="mq-disclaimer">⚠ Stone slabs vary by lot. Final pricing requires templating.</div>
          <div class="mq-travel-note">${TRAVEL_NOTE}</div>
          <div class="mq-cta-row">
            <button onclick="mqSwitchTab('both',document.querySelectorAll('.mq-tab')[0])">Get full project quote ✨</button>
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
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
              ${pickerRow('mq-b-ct-mat-cab', ctMatItems())}
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
            <div><div class="mq-grand-label">Total project estimate</div><div class="mq-grand-sub">Before tax · Ballpark estimate only</div></div>
            <div class="mq-grand-val" id="mq-b-grand">—</div>
          </div>
          <div class="mq-disclaimer" style="margin-top:1rem">⚠ ${disc}</div>
          <div style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:6px;padding:10px 12px;margin-top:8px;font-size:13px;color:#92400e;line-height:1.5">🔧 <strong>Handles & knobs not included</strong> in this estimate unless listed as a specialty item above.</div>
          <div class="mq-travel-note" style="margin-top:8px">${TRAVEL_NOTE}</div>
          <div class="mq-cta-row" style="margin-top:1rem">
            ${askQuestionBtn}
            <button class="mq-pri" onclick="mqShowConsultModal()">Book a consultation ↗</button>
          </div>
          ${financingHTML}
          <div class="mq-powered-by"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Powered by <a href="https://www.midasquote.com" target="_blank" rel="noopener">MidasQuote</a></div>
        </div>
      </div>

      <!-- LEAD MODAL -->
      <div class="mq-overlay" id="mq-lead-overlay">
        <div class="mq-modal">
          <p class="mq-modal-title">Almost there — one quick step</p>
          <p class="mq-modal-sub">Enter your details and we'll send you a copy of your estimate.</p>
          <div class="mq-modal-fields">
            <div class="mq-field"><label class="mq-label">Your name</label><input type="text" id="mq-lead-name" placeholder="Jane Smith"/></div>
            <div class="mq-field"><label class="mq-label">Email address</label><input type="email" id="mq-lead-email" placeholder="jane@email.com"/></div>
            <div class="mq-field"><label class="mq-label">Phone number <span style="color:#6b7280;font-weight:400">(optional)</span></label><input type="tel" id="mq-lead-phone" placeholder="(555) 000-0000"/></div>
          </div>
          <button class="mq-modal-btn" onclick="mqSubmitLead()">Show my estimate →</button>
          <button class="mq-modal-skip" onclick="mqSkipLead()">Skip for now</button>
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

    const diffOn={},specQty={},surfCounts={},surfs={},tallCabs={},tallCabCounts={};
    let pendingCb=null;
    ['c','ct','b'].forEach(p=>{diffOn[p]=false;specQty[p]=new Array(specs.length).fill(0);surfCounts[p]=0;surfs[p]={};tallCabs[p]={};tallCabCounts[p]=0;});

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
        }
      });
      // If every item in a whole category capsule just got filtered out
      // above, hide the whole capsule (heading included) — otherwise you'd
      // see an empty, orphaned category box with nothing inside it for this
      // project type.
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
        let anyVisibleSelected=false, firstVisibleChip=null;
        row.querySelectorAll('.mq-vpicker-chip').forEach(chip=>{
          let rooms=[];
          try { rooms = JSON.parse(chip.getAttribute('data-rooms')||'[]'); } catch(e) { rooms=[]; }
          const visible = !rooms.length || rooms.includes(roomId);
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
    // Scrolls so the target sits a bit below the very top of the page,
    // rather than flush against it. Many shop websites have their own
    // sticky header, which would otherwise cover part of whatever the
    // widget just scrolled to.
    function mqScrollWithOffset(el, offsetPx) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.pageYOffset - (offsetPx || 80);
      window.scrollTo({ top, behavior: 'smooth' });
    }

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
    // left in the step flow itself to scroll to at that point. Scrolling to
    // and pulsing the real button keeps the person in control of actually
    // triggering the estimate (which, on the Both tab, also kicks off the
    // lead-capture step) rather than firing it for them automatically.
    function mqHighlightCalcButton(prefix) {
      const btnId = prefix === 'c' ? 'mq-c-calc-btn' : (prefix === 'ct' ? 'mq-ct-calc-btn' : 'mq-b-calc-btn');
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      btn.classList.remove('mq-calc-btn-pulse');
      void btn.offsetWidth; // restart the animation if it's already mid-pulse
      btn.classList.add('mq-calc-btn-pulse');
      setTimeout(() => btn.classList.remove('mq-calc-btn-pulse'), 1600);
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
    document.addEventListener('click', (e) => {
      const sec = e.target.closest('#midasquote-widget .mq-sec');
      if (!sec) return;
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
      // Measuring shows for most project types — each one can have its own
      // tailored guide (set in the dashboard) — but a shop owner can flag a
      // specific project type (e.g. a flat-rate-only "Odd jobs" type) to
      // skip it entirely, since there's nothing to measure at all there.
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
      } else if (manualToggleCb && !manualToggleCb.checked && manualWrap) {
        manualWrap.style.display = 'none';
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
        // independent surface entry instead — and make that section look
        // and behave exactly like the standalone Countertops tab's own
        // "Surfaces" section (same title, same auto-added first card),
        // rather than the more sparse "Additional surfaces" add-on framing
        // that only makes sense when there IS a base cabinet run already
        // covering the main countertop.
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
          // Only fires when there's truly nothing there yet — marked so we
          // know to clean it back up if a project type WITH cabinets gets
          // picked afterward, rather than leaving a stray auto-added card
          // behind once "Use my base cabinet measurements" is back and
          // this section should go back to being genuinely empty/optional.
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

    // Resets a visual picker (Material/Door/Hinge/Crown/Valance chips) back
    // to its first option, reusing the exact same selection logic a real
    // click would trigger — so the underlying hidden select, the chip
    // highlighting, and anything wired to that select's change event all
    // update correctly, rather than re-implementing that by hand.
    function mqResetPicker(selectId) {
      const firstChip = document.querySelector(`[data-vpicker-for="${selectId}"]`);
      if (!firstChip) return;
      const btn = firstChip.querySelector('.mq-vpicker-select-btn');
      if (btn) window.mqPickVisual(selectId, btn);
    }

    // Resets literally everything in this cabinet form back to its
    // defaults — every measurement, every picker, every checkbox — so
    // switching project types always starts completely fresh rather than
    // carrying over numbers or selections that may not even make sense for
    // the newly picked type.
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

      // Tall cabinets — clear every added card entirely, not just their quantities
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

    // Only an actual project type change restarts the guided flow at step 1
    // — mqRefreshSectionVisibility itself gets called from other places too
    // (like adding a tall cabinet card), which should refresh what's showing
    // without yanking someone back to the beginning of the flow.
    window.mqOnProjectTypeChange = function(prefix) {
      _mqStepIndex[prefix] = 0;
      mqResetCabinetForm(prefix);
      // Reset every specialty item on an actual project type change — not
      // just the ones that become hidden by the room switch. An item that
      // happens to stay visible across two different project types (e.g.
      // visible everywhere) shouldn't silently keep a quantity — or a
      // supply/install choice — left over from a completely different,
      // unrelated project.
      if (specQty[prefix]) {
        Object.keys(specQty[prefix]).forEach(i => {
          specQty[prefix][i] = 0;
          const qtyInput = document.getElementById(`mq-qty-${prefix}-${i}`);
          if (qtyInput) qtyInput.value = 0;
          document.getElementById(`mq-sp-${prefix}-${i}`)?.classList.remove('on');
          const modeSel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
          if (modeSel) modeSel.selectedIndex = 0; // back to the "Choose one" placeholder
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
          const nameEl=document.getElementById('mq-lead-name');
          const emailEl=document.getElementById('mq-lead-email');
          const phoneEl=document.getElementById('mq-lead-phone');
          if(nameEl&&!nameEl.value) nameEl.value=saved.name||'';
          if(emailEl&&!emailEl.value) emailEl.value=saved.email||'';
          if(phoneEl&&!phoneEl.value) phoneEl.value=saved.phone||'';
        }
      }catch(e){}
      const overlay=document.getElementById('mq-lead-overlay');
      overlay.classList.add('show');
      // Scroll the overlay into view so it appears at the user's current position
      overlay.scrollIntoView({behavior:'smooth',block:'center'});
    };
    window.mqSkipLead=()=>{
      document.getElementById('mq-lead-overlay').classList.remove('show');
      // Treat skip the same as submit — save whatever's in the fields (even if
      // blank) so the shop owner sees all quote attempts, not just the ones
      // where the customer filled in their info. Tagged so saveLead knows to
      // skip sending emails for this one.
      const lead={name:gv('mq-lead-name'),email:gv('mq-lead-email'),phone:gv('mq-lead-phone'),_isSkip:true};
      if(pendingCb){pendingCb(lead);pendingCb=null;}
    };
    window.mqSubmitLead=async()=>{
      const lead={name:gv('mq-lead-name'),email:gv('mq-lead-email'),phone:gv('mq-lead-phone')};
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
        tallCabLines.push({label:`${tc.label} (${tcQty} × ${tcWidthIn}")`, cost: tcCost});
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
        let unitPrice = s.price;
        let modeLabel = '';
        if (s.offersInstallChoice) {
          const modeSel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
          const mode = modeSel ? modeSel.value : 'supply';
          if (mode === 'install') { unitPrice = s.installPrice; modeLabel = ' — Supplied & Installed'; }
          else { modeLabel = ' — Supply only'; }
        }
        const cost=unitPrice*specQty[prefix][i];
        specTotal+=cost;
        const qtyLabel=s.perSqFt?`${specQty[prefix][i]} sqft`:(s.perFt?`${specQty[prefix][i]} ft`:(specQty[prefix][i]>1?`× ${specQty[prefix][i]}`:''));
        lines.push({label:qtyLabel?`${s.label} (${qtyLabel})${modeLabel}`:`${s.label}${modeLabel}`,cost:Math.round(cost)});
      });

      const remEl=document.getElementById(`mq-${prefix}-removal`);
      const remCost=remEl&&remEl.value==='yes'?(uFt+bFt)*removalRate:0;
      if(remCost>0) lines.push({label:'Cabinet removal',cost:Math.round(remCost)});

      const sub=uCost+bCost+specTotal+tallCabTotal+remCost+trimCost;
      const totalMult = (100 + totalAdjPct) / 100;
      const total = sub * totalMult;
      lines.push({label:'Subtotal (before tax)',cost:Math.round(total),bold:true});

      const low=Math.round(total*(window._mqRangeLow||0.9)/100)*100, high=Math.round(total*(window._mqRangeHigh||1.15)/100)*100;
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
      return {lines,sub:Math.round(sub),total:Math.round(total),low:Math.round(total*(window._mqRangeLow||0.9)/100)*100,high:Math.round(total*(window._mqRangeHigh||1.15)/100)*100};
    }

    function renderResult(rangeEl,listEl,result){
      document.getElementById(rangeEl).textContent=fmt(result.low)+' – '+fmt(result.high);
      const ul=document.getElementById(listEl);ul.innerHTML='';
      const sorted=[...result.lines].filter(l=>!l.bold).sort((a,b)=>b.cost-a.cost);
      sorted.forEach(l=>{
        const li=document.createElement('li');
        li.innerHTML=`<span class="mq-li-lbl">✓ ${l.label}</span>`;
        ul.appendChild(li);
      });
    }

    window.mqCalcCabinets=()=>{
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
        document.getElementById('mq-c-loading').classList.remove('show');
        document.getElementById('mq-c-result').classList.add('show');mqScrollWithOffset(document.getElementById('mq-c-result'));window.mqShowStartOverPanel();
        document.getElementById('mq-c-calc-btn').disabled=false;
        if(lead) await saveLead(data,lead,'Cabinets',r.low,r.high,r.lines,r.roomLabel);
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
          document.getElementById('mq-ct-loading').classList.remove('show');
          document.getElementById('mq-ct-result').classList.add('show');mqScrollWithOffset(document.getElementById('mq-ct-result'));window.mqShowStartOverPanel();
          document.getElementById('mq-ct-calc-btn').disabled=false;
          if(lead) await saveLead(data,lead,'Countertops',r.low,r.high,r.lines);
        },900);
      });
    };

    window.mqCalcBoth=()=>{
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
          [...cab.lines].filter(l=>!l.bold).sort((a,b)=>b.cost-a.cost).forEach(l=>{const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">✓ ${l.label}</span>`;cabRows.appendChild(d);});
          const ctRows=document.getElementById('mq-b-ct-rows');ctRows.innerHTML='';
          [...ct.lines].filter(l=>!l.bold).sort((a,b)=>b.cost-a.cost).forEach(l=>{const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">✓ ${l.label}</span>`;ctRows.appendChild(d);});
          if(!ctRows.children.length){const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">None selected</span>`;ctRows.appendChild(d);}
          const tl=cab.low+ct.low,th=cab.high+ct.high;
          document.getElementById('mq-b-grand').textContent=fmt(tl)+' – '+fmt(th);
          document.getElementById('mq-b-loading').classList.remove('show');
          document.getElementById('mq-b-result').classList.add('show');mqScrollWithOffset(document.getElementById('mq-b-result'));window.mqShowStartOverPanel();
          document.getElementById('mq-b-calc-btn').disabled=false;
          if(lead) await saveLead(data,lead,'Cabinets + Countertops',tl,th,[{label:'Cabinets',header:true},...cab.lines,{label:'Countertops',header:true},...ct.lines],cab.roomLabel);
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
            ${pickerRow(`mqsm-${id}`, ctMatItems())}
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

    // Items offering a supply/install choice always start on the
    // unselectable "Choose one" placeholder — deliberately never
    // auto-defaulted to the project's overall setting, since the whole
    // point is making sure the choice actually gets made. Trying to add
    // quantity before choosing shakes and highlights the dropdown instead
    // of silently letting it through with an assumed answer.
    window.mqSpecModeChosen = function(prefix, i) {
      const s = specs[i];
      if (!s || !s.offersInstallChoice) return true; // nothing to choose for this item
      const sel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
      if (sel && sel.value) return true;
      if (sel) {
        sel.classList.remove('mq-needs-choice');
        void sel.offsetWidth; // restart the animation if it's already mid-shake
        sel.classList.add('mq-needs-choice');
        sel.focus();
        setTimeout(() => sel.classList.remove('mq-needs-choice'), 700);
      }
      return false;
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
    mqScrollWithOffset(container);
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
    injectStyles(shop['Brand colour']||'#1a1a1a');
    buildCTMAT(data);
    buildTRIM(data);
    buildTALLCAB(data);
    container.innerHTML=buildWidgetHTML(shop,specs,data);
    wireWidget(data);

    // ── First-visit tips popup ──
    // Replaces the old showroom nudge — this widget now has photos, per-project
    // measuring guides, etc. built right in, so the popup points people at
    // those instead of sending them off to a separate page. Shows once per
    // browser per shop, same as before. No longer tied to the "Show showroom"
    // setting since it's not about the showroom anymore — it's general
    // orientation for using the widget itself.
    if (shop['Shop token']) {
      try {
        const storageKey = `mq_tips_seen_${shop['Shop token']}`;
        if (!localStorage.getItem(storageKey)) {
          const bc = shop['Brand colour'] || '#1a1a1a';
          const popup = document.createElement('div');
          popup.id = 'mq-tips-popup';
          popup.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:mqFadeIn 0.25s ease`;
          popup.innerHTML = `
            <div style="background:#fff;border-radius:16px;max-width:400px;width:100%;padding:2rem;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.25);animation:mqSlideUp 0.3s ease">
              <div style="font-size:36px;margin-bottom:12px">👋</div>
              <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px">First time here?</div>
              <div style="font-size:14px;color:#4b5563;line-height:1.7;margin-bottom:1.5rem;text-align:left">
                <div style="margin-bottom:8px">✅ <strong>Choose your project type first</strong> — everything below adjusts to match it.</div>
                <div style="margin-bottom:8px">🔍 <strong>Tap or hover any photo</strong> to see it up close.</div>
                <div style="margin-bottom:8px">📏 <strong>Check the measuring guide</strong> for help getting accurate numbers.</div>
                <div><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;vertical-align:-6px;margin-right:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="2" width="16" height="20" rx="2" stroke="#1d4ed8" stroke-width="1.8"/><rect x="6.5" y="4.5" width="11" height="4" rx="0.5" fill="#1d4ed8"/><rect x="6.5" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="10.7" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="14.9" y="11" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="6.5" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="10.7" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="14.9" y="15" width="2.6" height="2.4" rx="0.4" fill="#1d4ed8"/><rect x="6.5" y="19" width="11" height="2" rx="0.4" fill="#1d4ed8"/></svg></span> <strong>Measured in inches or mm?</strong> Tap the calculator icon next to any field and it'll convert it for you.</div>
              </div>
              <button onclick="mqDismissTipsPopup()" style="display:block;width:100%;background:${bc};color:#fff;border:none;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;cursor:pointer;font-family:inherit;transition:opacity 0.15s" onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">Got it — let's start!</button>
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
  }

  init();
  mqInitMobileFontFix();

})();