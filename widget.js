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

  // A UK (or any non-North-American) shop can pick their own currency
  // symbol on the dashboard's Shop Info tab — everywhere on the widget
  // that used to show a hardcoded "$" now reads it from here instead,
  // falling back to "$" for shops that haven't set one. window._mqShopData
  // isn't populated until loadShopData() resolves, so this only returns
  // the shop's real symbol once quote data has actually loaded — every
  // caller here only runs after that point anyway.
  function CUR() { return (window._mqShopData && window._mqShopData['Currency symbol']) || '$'; }

  // Standard loan amortization: monthly payment for a given principal, APR
  // (as a percent, e.g. 9.9), and term in months. 0% APR falls back to a
  // straight-line principal/months split rather than dividing by zero.
  function mqCalcMonthlyPayment(principal, aprPct, months) {
    if (!principal || principal <= 0 || !months || months <= 0) return 0;
    const r = (aprPct || 0) / 100 / 12;
    if (r <= 0) return principal / months;
    return principal * r / (1 - Math.pow(1 + r, -months));
  }

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
    window._mqRangeLow  = (100 - (parseFloat(shop['Quote range low'])  || 5)) / 100;
    window._mqRangeHigh = (100 + (parseFloat(shop['Quote range high']) || 20)) / 100;
    shop._recordId = shopRecord.id;

    // Parse the shop's saved product photos (same JSON field the dashboard's
    // My Products tab and showroom page already read) so the widget can show
    // real thumbnails instead of just text labels for unfamiliar terms.
    let shopPhotos = {};
    try { shopPhotos = shop['Photos'] ? JSON.parse(shop['Photos']) : {}; } catch(e) { shopPhotos = {}; }
    let shopFeatured = {};
    try { shopFeatured = shop['Featured items'] ? JSON.parse(shop['Featured items']) : {}; } catch(e) { shopFeatured = {}; }
    const shopBadgeLabel = (shop['Badge label'] || '').trim() || 'Best seller';
    window._mqBadgeLabel = shopBadgeLabel;
    const shopBadgeColor = /^#[0-9a-fA-F]{6}$/.test(shop['Badge color']) ? shop['Badge color'] : '#f59e0b';
    window._mqBadgeColor = shopBadgeColor;

    // Room types — fully editable/addable by the shop now, each with its own
    // price adjustment %. Falls back to the original fixed 6 rooms (with
    // Bathroom's -5% preserved as a working example) for every shop that
    // hasn't touched this new setting yet, so nothing changes for anyone
    // until they actively configure it.
    let roomTypes = [];
    try { roomTypes = shop['Room types'] ? JSON.parse(shop['Room types']) : []; } catch(e) { roomTypes = []; }
    if (!Array.isArray(roomTypes) || !roomTypes.length) {
      roomTypes = [
        // measureImage deliberately blank for these 6 (was previously
        // pointing at stale, pre-gallery filenames like "kitchen1.jpg" that
        // don't match the current default set — fixed so this rarely-hit
        // fallback, used only when a shop has never saved ANY Room types at
        // all, renders the same current default gallery as everywhere else
        // via MQ_DEFAULT_MEASURE_IMAGES below instead of an outdated photo).
        { id:'kitchen', name:'Kitchen',        adjustment:0,  description:'The kitchen is where life happens — let\'s build one you\'ll love spending time in. Pick your cabinets, doors, and finishes, and watch your dream kitchen take shape.', active:true, coverImage:'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/kitchen.jpg', measureImage:'' },
        { id:'bathroom',name:'Bathroom',       adjustment:-5, description:'Turn your bathroom into a personal retreat. Choose the vanity and finishes that make getting ready each morning feel a little more special.', active:true, coverImage:'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/bathroom.jpg', measureImage:'' },
        { id:'laundry', name:'Laundry room',   adjustment:0,  description:'Even the laundry room deserves some love. Add smart, good-looking storage that makes everyday chores feel a lot less like chores.', active:true, coverImage:'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/laundry.jpg', measureImage:'' },
        { id:'garage',  name:'Garage',         adjustment:0,  description:'From tools to hobbies to overflow storage — give your garage the organized, great-looking upgrade it\'s been waiting for.', active:true, coverImage:'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/garage.jpg', measureImage:'' },
        { id:'commercial', name:'Commercial',  adjustment:0,  description:'Make a great first impression. Get cabinetry built to fit your business, whether it\'s a sleek office or a welcoming retail space.', active:true, coverImage:'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/commercial.jpg', measureImage:'' },
        { id:'other',   name:'Other',          adjustment:0,  description:'Got a project that doesn\'t quite fit the mold? We love a good challenge — let\'s bring your vision to life.', active:true, coverImage:'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/other.jpg', measureImage:'' },
        { id:'refacing',   name:'Refacing',    adjustment:0,  description:'Love your layout, just not the look? Refacing gives your cabinets a whole new personality — new doors, drawer fronts, crown, and valance — without the cost or mess of a full remodel.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/refacing.jpg', measureText:"[tip]**Skip the math** — tap the [calc] next to the field and enter each section's width and height in whatever unit is easiest (feet, inches, or mm). We'll convert and total the square footage for you automatically, no matter how many sections you have.[/tip]\n\n**Measure in sections:** Break your cabinets into individual runs — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/refacing.jpg' },
        { id:'repainting', name:'Repainting',  adjustment:0,  description:'Sometimes all it takes is a fresh coat. Give your existing cabinets new color and new life, without replacing a thing.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/repainting.jpg', measureText:"[tip]**Skip the math** — tap the [calc] next to the field and enter each section's width and height in whatever unit is easiest (feet, inches, or mm). We'll convert and total the square footage for you automatically, no matter how many sections you have.[/tip]\n\n**Measure in sections:** Break your cabinets into individual runs — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/repainting.jpg' },
        { id:'restaining', name:'Restaining',  adjustment:0,  description:'Bring back the natural beauty of your cabinets. A fresh stain can restore that warm, rich look you fell in love with in the first place.', active:true, coverImage:'https://aceswin.github.io/midasquote-widget/cover-images/restaining.jpg', measureText:"[tip]**Skip the math** — tap the [calc] next to the field and enter each section's width and height in whatever unit is easiest (feet, inches, or mm). We'll convert and total the square footage for you automatically, no matter how many sections you have.[/tip]\n\n**Measure in sections:** Break your cabinets into individual runs — it's much easier to get an accurate total this way than trying to measure everything at once.\n\n**Not sure?** Just use your best guess — this is a ballpark estimate!", measureImage:'https://aceswin.github.io/midasquote-widget/measure-guides/restaining.jpg' },
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

    // Specialty item category display order, per project type — e.g.
    // "Shelving" before "Pullouts" for Kitchen, but the other way around for
    // Bathroom. { [roomId]: [categoryName, ...] }. Categories not listed for
    // a given room just keep whatever order they'd otherwise render in — see
    // mqReorderSpecCategoryGroups, which applies this every time the
    // customer switches project type.
    try { window._mqSpecCategoryOrder = shop['Specialty category order'] ? JSON.parse(shop['Specialty category order']) : {}; } catch(e) { window._mqSpecCategoryOrder = {}; }

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
    li.materials.forEach(m => { m.photoUrl = shopPhotos[photoKeyFor('material', m._baseName || m['Name'])] || ''; m.featured = shopFeatured[photoKeyFor('material', m._baseName || m['Name'])] || false; m.visibleRooms = effectiveVisibleRooms(parseVisibleRooms(m), 'material'); });
    li.doorStyles.forEach(d => { d.photoUrl = shopPhotos[photoKeyFor('door', d['Name'])] || ''; d.featured = shopFeatured[photoKeyFor('door', d['Name'])] || false; d.visibleRooms = effectiveVisibleRooms(parseVisibleRooms(d), 'door'); });
    li.hinges.forEach(h => { h.photoUrl = shopPhotos[photoKeyFor('hinge', h['Name'])] || ''; h.featured = shopFeatured[photoKeyFor('hinge', h['Name'])] || false; h.visibleRooms = effectiveVisibleRooms(parseVisibleRooms(h), 'hinge'); });
    li.drawers.forEach(dr => { dr.photoUrl = shopPhotos[photoKeyFor('drawer', dr['Name'])] || ''; dr.featured = shopFeatured[photoKeyFor('drawer', dr['Name'])] || false; dr.visibleRooms = effectiveVisibleRooms(parseVisibleRooms(dr), 'drawer'); });

    const localZone = sorted.find(r=>r.fields['Category']==='zone'&&r.fields['Name']?.toLowerCase().includes('local'));
    li.localRadius = localZone?.['Rate'] || 15;

    const hasDynamic = li.materials.length > 0;

    const specRecords = payload.specialty || [];
    // Items flagged "Pro only" never appear here at all — same idea as a
    // Pro-only project type, just at the individual item level. They still
    // show up in MidasQuote Pro, for every project type they're tagged to.
    const specsRaw = specRecords
      .filter(r => !r.fields['Pro only'])
      .map(r=>{
        const visibleRooms = effectiveVisibleRooms(parseVisibleRooms(r.fields), 'specialty');
        // Optional variants (e.g. a "Crown Molding" item offered in
        // Maple/Oak/MDF) — each variant carries its own label/price/photo/
        // featured flag, but shares everything else on the parent item
        // (category, project-type visibility, per-linear/sq-ft pricing
        // method, supply/install choice). An item with no Variants field
        // or an empty array behaves exactly as it always has — this is
        // fully backward compatible with every existing specialty item.
        let variants = [];
        try { variants = r.fields['Variants'] ? JSON.parse(r.fields['Variants']) : []; } catch(e) { variants = []; }
        if (!Array.isArray(variants)) variants = [];
        // Variant photos are NOT stored in the Variants JSON itself — they're
        // managed in the dashboard's Products tab (My Products → Specialty
        // Items), using the exact same shop-wide photo map every other
        // product photo already uses, keyed 'spec_<itemId>_v<variantId>'.
        // Each variant carries its own stable `id` (assigned by the
        // dashboard the moment it's created) rather than relying on its
        // position in the array, so a variant's photo stays correctly
        // matched to it even after some other variant earlier in the list
        // gets removed and everything after it shifts down.
        variants = variants.map((v, vi) => {
          const vid = (v && v.id) || ('i' + vi);
          return {
            label: ((v && v.label) || '').trim(),
            price: (v && v.price) || 0,
            // Min price is per-variant too (not shared like everything else
            // on the item) — "Maple" and "Painted MDF" doors can easily
            // want different floors. Install minimum stays item-level; only
            // supply price/min vary per variant (see mqPickSpecVariant).
            min: (v && v.min) || 0,
            photoUrl: shopPhotos['spec_' + r.id + '_v' + vid] || '',
            // Best-seller marking for specialty item variants now goes
            // exclusively through My Products (shopFeatured, the same
            // shop-wide map every other product type's badge already reads)
            // — the variant's own former `featured` field is no longer
            // written to by the dashboard and is ignored here even if old
            // data still has it set, so there's exactly one place to check
            // this shop's best-sellers instead of two that can disagree.
            featured: !!shopFeatured['spec_' + r.id + '_v' + vid],
          };
        }).filter(v => v.label);
        // $/$$/$$$ badges assigned per-item across just that item's own
        // variants — reuses the exact same ranking function used for the
        // door/material picker and the main specialty-item badges below,
        // just scoped to one item's variant list instead of a category.
        if (variants.length) assignBadges(variants);
        // Before any variant is explicitly picked, the card shows the
        // first variant's price/photo — same convention the door/material
        // picker already uses (defaults to index 0, customer can change it).
        const defaultVariant = variants[0] || null;
        return {
          id:r.id,
          label:r.fields['Item name']||r.fields['Special Items'],
          price: defaultVariant ? defaultVariant.price : (r.fields['Price']||0),
          // Badges reflect the item's real total cost (supply + install
          // combined), not just the supply price — otherwise two items with
          // identical install pricing but very different supply costs (e.g.
          // an MDF vs. a rift oak refacing door) end up looking like the
          // same price tier. This never touches the actual `price` field
          // used for real math above — it's purely for sorting into $/$$/$$$.
          badgePrice:(defaultVariant ? defaultVariant.price : (r.fields['Price']||0))+(r.fields['Install price']||0),
          perFt:r.fields['Per linear foot']||false,
          perSqFt:r.fields['Per square foot']||false,
          // Per-order floor for size-based items (e.g. a tiny door still
          // takes a full sheet and the same labor as a bigger one) — only
          // meaningful when perFt/perSqFt is set, same as the dashboard only
          // shows the field then. Supply and install each get their own.
          minPrice: defaultVariant ? (defaultVariant.min||0) : (r.fields['Minimum price']||0),
          installMinPrice: r.fields['Install minimum price']||0,
          photoUrl: defaultVariant ? defaultVariant.photoUrl : (shopPhotos['spec_' + r.id] || ''),
          featured: defaultVariant ? defaultVariant.featured : (shopFeatured['spec_' + r.id] || false),
          // The currently-active variant's own name (e.g. "Oak") — kept
          // separate from `label` (which stays the parent item's name, e.g.
          // "Crown Molding", so the card heading/lightbox/hover-preview
          // never changes) but folded into the line-item text at quote time
          // below so the final estimate/lead actually says which option was
          // picked, not just the generic item name.
          variantLabel: defaultVariant ? defaultVariant.label : '',
          variants,
          visibleRooms, // empty array = visible for every room (backward compatible default)
          // Per-item supply/install choice — lets a shop offer some items
          // (e.g. refacing doors) supply-only even while installing
          // everything else. If not offered, offersInstallChoice is false
          // and installMode is purely a label for what the flat price above
          // already represents — it never changes the price.
          offersInstallChoice: r.fields['Offers install choice']||false,
          installPrice: r.fields['Install price']||0,
          installMode: r.fields['Install mode']||'supply',
          // Install can be priced differently from supply (e.g. $54.95/sqft
          // to supply a door, but a flat $16.80/door to install it) — these
          // three describe install's own pricing method independently.
          installPerFt: r.fields['Install per linear foot']||false,
          installPerSqFt: r.fields['Install per square foot']||false,
          installQtyLabel: r.fields['Install quantity label']||'',
          description: r.fields['Description']||'',
          category: r.fields['Category']||'',
        };
      });
    // Badge PER CATEGORY, not across the whole specialty items catalog at
    // once — otherwise one pricier (or cheaper) category elsewhere skews
    // every OTHER category's items toward looking artificially uniform by
    // comparison, hiding a real cheapest-to-priciest spread that exists
    // within a given category on its own (e.g. Doors judged against
    // Hardware's price range instead of just other Doors).
    [...new Set(specsRaw.map(s => s.category || ''))].forEach(cat => {
      assignBadges(specsRaw.filter(s => (s.category||'') === cat));
    });
    const specs = specsRaw;

    return { shop, pricing:p, specs, li, hasDynamic, shopPhotos, shopFeatured, roomTypes };
  }

  // ============================================================
  // EMAIL & LEAD
  // ============================================================
  async function saveLead(data, lead, quoteType, low, high, lines, roomType, total, prefix) {
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
        : `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">${l.label}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;${l.bold?'font-weight:700;color:#111':''}">${CUR()}${Math.round(l.cost).toLocaleString()}</td></tr>`
      ).join('');

    if (!lead._isSkip || shop['Notify on every estimate'] === 'Yes') await sendEmail(shop['Lead notify email'], `New ${quoteType} quote lead — ${lead.name || 'Anonymous visitor'}`,
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1a1a1a">New ${quoteType} quote lead</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600" colspan="2">Customer details</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Name</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.name || 'Not provided'}</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Email</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.email || 'Not provided'}</td></tr>
          <tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666">Phone</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${lead.phone || 'Not provided'}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600" colspan="2">Quote breakdown</td></tr>${lineRows}
        </table>
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:14px;color:#666;margin-bottom:4px">Estimated range</div>
          <div style="font-size:28px;font-weight:700;color:#16a34a">${CUR()}${low.toLocaleString()} – ${CUR()}${high.toLocaleString()}</div>
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
            <div style="font-size:14px;color:#666;margin-bottom:4px">${mqShouldShowRange(prefix) ? 'Your estimated range' : 'Your estimate'}</div>
            <div style="font-size:28px;font-weight:700;color:#16a34a">${mqFmtPrice(prefix, low, high, total)}</div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="padding:8px;background:#f9fafb;font-weight:600">What’s included</td></tr>${customerLineRows}
          </table>
          <p style="color:#666;font-size:14px">${shop['Disclaimer text'] || (mqShouldShowRange(prefix) ? 'Ballpark estimate only. Contact us for a full quote.' : 'This quote is not final — please contact us for final numbers.')}</p>
          <p style="color:#666;font-size:14px;margin-top:8px">⚠ Jobs outside our local delivery area may be subject to additional travel charges — your final quote will confirm the exact amount.</p>
          <p style="color:#666;font-size:14px"><strong>${shop['Shop name']}</strong><br/>${shop['Phone']||''}</p>
        </div>`);
    }
  }

  // Wraps saveLead so the lead actually saved reflects the customer's WHOLE
  // quote — everything already committed to the multi-project-type cart,
  // plus whatever's currently on the tab they just hit Calculate on —
  // instead of only ever saving that one tab's result and silently
  // dropping everything built before it. Same signature as saveLead
  // itself, so every call site only needs the function name swapped.
  async function mqSaveLeadWithCart(data, lead, quoteType, low, high, lines, roomType, total, prefix) {
    const cart = window._mqQuoteCart || [];
    if (!cart.length) {
      return saveLead(data, lead, quoteType, low, high, lines, roomType, total, prefix);
    }
    const cartLow = cart.reduce((s,e) => s + (e.low||0), 0);
    const cartHigh = cart.reduce((s,e) => s + (e.high||0), 0);
    const cartTotal = cart.reduce((s,e) => s + (e.total||0), 0);
    const combinedLines = [
      ...cart.flatMap(e => [{label: e.label, header: true}, ...e.lines.filter(l => !l.bold)]),
      {label: quoteType, header: true},
      ...lines.filter(l => !l.bold),
    ];
    const combinedLabel = [...cart.map(e => e.label), roomType || quoteType].join(' + ');
    return saveLead(
      data, lead, combinedLabel,
      cartLow + low, cartHigh + high,
      combinedLines, combinedLabel,
      cartTotal + total, prefix
    );
  }

  async function sendEmail(to, subject, html) {
    if (!CONFIG.EMAIL_WORKER||!to) return;
    try { await fetch(CONFIG.EMAIL_WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,subject,html})}); }
    catch(e) { console.error('Email failed',e); }
  }

  // ============================================================
  // STYLES
  // ============================================================
  // Small hex color helpers — used so the 4 new customizable box colors
  // (focal ring, box border, box background, box text) can each have a
  // sensible default automatically derived from the shop's one Brand
  // colour, without the shop owner having to set anything themselves,
  // while still being fully overridable individually.
  function mqHexToRgb(hex) {
    hex = (hex || '#000000').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16) || 0;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  function mqRgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  }
  function mqLightenHex(hex, pct) {
    const { r, g, b } = mqHexToRgb(hex);
    return mqRgbToHex(r + (255 - r) * pct, g + (255 - g) * pct, b + (255 - b) * pct);
  }
  function mqDarkenHex(hex, pct) {
    const { r, g, b } = mqHexToRgb(hex);
    return mqRgbToHex(r * (1 - pct), g * (1 - pct), b * (1 - pct));
  }

  function injectStyles(bc, focalColor, boxBorder, boxBg, boxText) {
    // Defaults to MidasQuote's original blue scheme — not derived from the
    // shop's brand colour. These 4 fields are a genuinely separate,
    // optional customization; leaving them alone gets you the same
    // polished look every shop started with, regardless of what Brand
    // colour is set to elsewhere.
    //
    // Two genuinely different blues in the original design, not one:
    // focalColor (#2563eb, richer/darker) is just the step-number badge and
    // the Continue button. boxBorder (#93c5fd, lighter) is both the box's
    // own border AND the glowing ring around the current step — those two
    // always matched each other, which is the "layered double border" look.
    const boxBgIsCustom = !!boxBg;
    focalColor = focalColor || '#2563eb';
    boxBorder = boxBorder || '#93c5fd';
    boxBg = boxBg || '#eff6ff';
    boxText = boxText || '#1e40af';
    window._mqFocalColor = focalColor;
    window._mqBoxBorder = boxBorder;
    window._mqBoxBg = boxBg;
    window._mqBoxText = boxText;
    // Only run the auto-gradient math when they've actually set a custom
    // background — the original default already has its own two hand-picked
    // gradient stops (#eff6ff → #f0f9ff), no need to recompute those.
    const boxBgStop2 = boxBgIsCustom ? mqLightenHex(boxBg, 0.3) : '#f0f9ff';
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
        /* A wide/wide-aspect logo plus the shop name plus the showroom
           button can add up to more than a phone screen's width — rather
           than let the button get shoved past the edge (clipped by the
           widget's own overflow:hidden), let the row wrap so the button
           drops to its own line, still pinned to the right via margin-left:auto below. */
        #midasquote-widget .mq-header{padding:0.85rem 0.6rem;gap:8px;flex-wrap:wrap}
        #midasquote-widget .mq-logo-real{max-width:140px}
        #midasquote-widget .mq-logo-real img{max-width:140px}
        #midasquote-widget .mq-tab-bar{padding:8px 0.5rem;gap:5px}
        #midasquote-widget .mq-tab{padding:9px 6px;font-size:12.5px}
        /* The measuring guide image is a wide landscape infographic — on a
           narrow phone, the box's own 16px side padding eats into already
           limited width. Bleeding the image past just that padding (not the
           whole page) gives it noticeably more room without a full custom
           per-viewport reflow. */
        #midasquote-widget .mq-measure-guide-img{width:calc(100% + 32px)!important;max-width:calc(100% + 32px)!important;margin-left:-16px!important;margin-right:-16px!important}
        #midasquote-widget .mq-measure-carousel{width:calc(100% + 32px)!important;margin-left:-16px!important;margin-right:-16px!important}
      }
      #midasquote-widget .mq-measure-carousel-track::-webkit-scrollbar{display:none}
      #midasquote-widget .mq-header{display:flex;align-items:center;padding:1rem 1.5rem;border-bottom:1px solid #e5e7eb;gap:12px}
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
      #midasquote-widget .mq-sec{background:#fff;border:1.5px solid #d1d5db;border-radius:10px;padding:10px;margin-bottom:1rem;box-shadow:0 4px 14px rgba(0,0,0,0.10)}
      #midasquote-widget .mq-sec{border-left:4px solid ${boxBorder}}
      #midasquote-widget .mq-step-badge{width:22px;height:22px;border-radius:50%;background:${focalColor};color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-family:inherit}
      #midasquote-widget .mq-sec-header-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;cursor:pointer}
      #midasquote-widget .mq-sec-header-row .mq-sec-title{margin-bottom:0}
      #midasquote-widget .mq-collapse-arrow{display:inline-block;transition:transform 0.2s;font-size:12px;color:#6b7280;flex-shrink:0;margin-left:8px}
      #midasquote-widget .mq-collapse-arrow.open{transform:rotate(90deg)}
      #midasquote-widget .mq-sec.mq-step-current{box-shadow:0 0 0 3px ${boxBorder},0 4px 14px rgba(0,0,0,0.10);opacity:1}
      #midasquote-widget .mq-sec.mq-step-done{filter:brightness(0.8);transition:filter 0.2s}
      #midasquote-widget .mq-sec.mq-step-upcoming{filter:brightness(0.55);transition:filter 0.2s}
      #midasquote-widget .mq-sec.mq-step-current{transition:box-shadow 0.2s}
      #midasquote-widget .mq-step-footer{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:14px;border-top:1px dashed #e5e7eb}
      #midasquote-widget .mq-step-continue-btn{background:${focalColor};color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
      #midasquote-widget .mq-step-back-btn{background:none;border:none;color:#4b5563;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;padding:9px 4px}
      #midasquote-widget .mq-step-done-badge{color:#16a34a;font-size:13px;font-weight:700}
      #midasquote-widget .mq-focal-box{background:linear-gradient(135deg,${boxBg},${boxBgStop2});border:2px solid ${boxBorder};border-radius:12px;padding:16px 18px}
      #midasquote-widget .mq-focal-box-label{color:${boxText}!important}
      #midasquote-widget .mq-sec-title{font-size:14px;font-weight:800;color:#1f2937;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1rem}
      #midasquote-widget .mq-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
      #midasquote-widget .mq-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
      #midasquote-widget .mq-field{flex-direction:column;gap:5px;min-width:0}
      #midasquote-widget .mq-label{font-size:15px;color:#374151;margin-bottom:4px}
      #midasquote-widget .mq-hint{font-size:14px;color:#4b5563;margin-top:2px;line-height:1.5}
      #midasquote-widget .mq-qty-ctrl input{width:36px!important;padding:2px 4px!important;box-shadow:none!important;border-radius:4px!important}
      #midasquote-widget .mq-qty-ctrl input.mq-linft-input{width:73px!important}
      #midasquote-widget input[type=number]::-webkit-inner-spin-button,#midasquote-widget input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
      #midasquote-widget input[type=number]{-moz-appearance:textfield}
      #midasquote-widget input:focus,#midasquote-widget select:focus{outline:none;border-color:${bc};box-shadow:0 6px 20px rgba(0,0,0,0.30)}
      #midasquote-widget select,#midasquote-widget input{font-size:16px;font-family:inherit;width:100%}
      #midasquote-widget input{text-indent:8px}
      #midasquote-widget .mq-qty-ctrl input{text-indent:0}
      #midasquote-widget .mq-spec-grid{display:block}
      #midasquote-widget .mq-spec-item{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;transition:all 0.15s;flex:0 0 280px;min-width:0}
      #midasquote-widget .mq-spec-top{display:flex;align-items:flex-start;gap:8px}
      #midasquote-widget .mq-spec-bottom{display:flex;flex-direction:column;align-items:flex-start;gap:3px}
      #midasquote-widget .mq-spec-item.on{background:#eff6ff;border-color:#93c5fd}
      #midasquote-widget .mq-spec-name{font-size:14px;line-height:1.15;color:#111;flex:1;display:block}
      #midasquote-widget .mq-spec-category-heading{color:${bc}}
      #midasquote-widget .mq-spec-category-group{border:1.5px solid #e0e0e0;border-radius:12px;padding:12px 14px 14px;background:#fafafa;box-shadow:0 8px 20px rgba(0,0,0,0.12),0 2px 6px rgba(0,0,0,0.08)}
      #midasquote-widget .mq-spec-category-heading{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px}
      #midasquote-widget .mq-spec-item.on .mq-spec-name{color:#1d4ed8}
      #midasquote-widget .mq-spec-thumb{width:116px;height:116px;border-radius:6px;object-fit:contain;flex-shrink:0;cursor:zoom-in;border:1px solid #e5e7eb;background:#f3f4f6}
      #midasquote-widget .mq-spec-thumb-placeholder{width:116px;height:116px;border-radius:6px;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:20px;color:#6b7280;border:1px solid #e5e7eb}
      #midasquote-widget .mq-vpicker-row{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
      #midasquote-widget .mq-vpicker-row::-webkit-scrollbar{display:none}
      #midasquote-widget .mq-vpicker-wrap{position:relative}
      #midasquote-widget .mq-vpicker-arrow{position:absolute;top:50%;right:4px;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;display:none;align-items:center;justify-content:center;background:#fff;box-shadow:0 3px 12px rgba(0,0,0,0.28),0 0 0 1px rgba(0,0,0,0.06);font-size:22px;font-weight:700;color:#111;border:none;cursor:pointer;z-index:2}
      #midasquote-widget .mq-vpicker-arrow:hover{background:#f3f4f6;transform:translateY(-50%) scale(1.06)}
      #midasquote-widget .mq-vpicker-arrow.show{display:flex}
      #midasquote-widget .mq-vpicker-arrow-left{right:auto;left:4px}
      @media (hover:none) and (pointer:coarse){
        /* Touch devices already scroll great with a thumb — the click
           arrows are a desktop-only convenience, not needed (and would
           just sit in the way of the swipe gesture) on phones/tablets. */
        #midasquote-widget .mq-vpicker-arrow{display:none!important}
        /* Specialty items are the exception — their cards don't give as
           obvious a "there's more" visual hint as the photo picker chips
           do, so customers on mobile had no way to tell more items were
           off-screen. Re-enable just the "more to scroll" arrow (still only
           shown via .show, exactly like desktop — i.e. only when there's
           real overflow left to scroll to) for specialty item rows only. */
        #midasquote-widget .mq-spec-scroll-wrap .mq-vpicker-arrow.show{display:flex!important}
      }
      #midasquote-widget .mq-vpicker-chip{flex-shrink:0;width:130px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;font-family:inherit;transition:all 0.15s}
      #midasquote-widget .mq-vpicker-chip.selected{border-color:${bc}}
      #midasquote-widget .mq-spec-mode-select{cursor:pointer}
      #midasquote-widget .mq-spec-mode-select option[value=""]{color:#9ca3af}
      @keyframes mqShakeChoice{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
      #midasquote-widget .mq-spec-mode-select.mq-needs-choice{animation:mqShakeChoice 0.4s ease;border-color:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,0.15)}
      #midasquote-widget input.mq-needs-choice{animation:mqShakeChoice 0.4s ease;border-color:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,0.15)}
      #midasquote-widget .mq-vpicker-thumb{width:116px;height:116px;border-radius:6px;object-fit:contain;background:#f3f4f6}
      #midasquote-widget .mq-vpicker-thumb-placeholder{width:116px;height:116px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:20px;color:#6b7280}
      #midasquote-widget .mq-vpicker-label{font-size:10px;color:#374151;text-align:center;line-height:1.2;word-break:break-word;max-width:100%}
      #midasquote-widget .mq-vpicker-chip.selected .mq-vpicker-label{color:${bc};font-weight:600}
      #midasquote-widget .mq-vpicker-group-note{font-size:9px;color:#16a34a;text-align:center;line-height:1.25;margin-top:2px;max-width:100%}
      #midasquote-widget .mq-vpicker-select-btn{margin-top:5px;font-size:10px;font-weight:600;padding:4px 10px;border-radius:12px;border:1px solid #d1d5db;background:#fff;color:#374151;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all 0.15s}
      #midasquote-widget .mq-vpicker-chip.selected .mq-vpicker-select-btn{background:${bc};border-color:${bc};color:#fff}
      #midasquote-widget .mq-vpicker-chip.mq-suggested{box-shadow:0 0 0 2px #bbf7d0}
      #midasquote-widget .mq-vpicker-thumb{cursor:zoom-in}
      #midasquote-widget .mq-vpicker-thumb-placeholder{cursor:default}
      #midasquote-widget .mq-vpicker-badge{position:absolute;top:-6px;right:-6px;font-size:9px;font-weight:700;padding:2px 5px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.25);pointer-events:none}
      #midasquote-widget .mq-vpicker-featured-badge{position:absolute;top:-6px;left:-6px;font-size:8px;font-weight:700;padding:2px 5px;border-radius:8px;background:#f59e0b;color:#fff;border:1px solid rgba(255,255,255,0.7);box-shadow:0 1px 3px rgba(0,0,0,0.25);pointer-events:none;white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis}
      /* A specialty item's own variant picker (e.g. Maple/Oak/MDF under one
         "Crown Molding" item) is a row of plain text pill buttons, NOT photo
         chips — the card already shows one big photo up top (.mq-spec-thumb)
         that swaps to match whichever variant is picked, so giving each pill
         its own smaller photo too was pure visual duplication (and cramped,
         inside a 280px-wide card). A pill is directly clickable to select it
         — no separate photo + name + "Select" button stack needed when
         there's no photo on the pill itself. */
      #midasquote-widget .mq-spec-variant-picker.mq-vpicker-row{gap:6px;padding:4px 2px 4px;flex:1;min-width:0}
      #midasquote-widget .mq-vpicker-variant-chip{flex-shrink:0;display:flex;align-items:center;gap:4px;padding:7px 12px;border:1.5px solid #e5e7eb;border-radius:999px;background:#fff;font-family:inherit;font-size:12px;color:#374151;cursor:pointer;transition:all 0.15s;white-space:nowrap}
      #midasquote-widget .mq-vpicker-variant-chip:hover{border-color:#d1d5db;background:#f9fafb}
      #midasquote-widget .mq-vpicker-variant-chip.selected{border-color:${bc};background:${bc};color:#fff}
      #midasquote-widget .mq-vpicker-variant-star{font-size:10px}
      #midasquote-widget .mq-vpicker-variant-tier{font-size:10px;opacity:0.7}
      /* The round scroll arrows every other picker uses are absolutely
         positioned right over the row's own edge — fine for wide photo
         chips, but there's no scroll position where that doesn't land on
         top of SOME pill's text in this slimmer picker (padding out a
         gutter only helped at the very start/end of the scrollable range,
         not mid-scroll, where the arrow still floats over whatever pill
         happens to be at the edge). Real fix for variant pickers
         specifically: the arrows are genuine flex siblings of the scroll
         row (see mqVariantScrollWrap), not absolutely positioned over it —
         each has its own reserved column of space to the left/right of the
         pills, so there's no scroll position where either arrow can ever
         sit on top of pill text. Reuses the exact same ids/classes
         mqUpdatePickerArrow/mqScrollPickerRow already toggle and click, so
         no JS changes were needed, only where the buttons render. */
      #midasquote-widget .mq-vpicker-arrow-inline{display:none;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;border:1px solid #d1d5db;background:#fff;font-size:13px;font-weight:700;color:#374151;cursor:pointer;font-family:inherit;padding:0;flex-shrink:0}
      #midasquote-widget .mq-vpicker-arrow-inline.show{display:inline-flex}
      #midasquote-widget .mq-vpicker-arrow-inline:hover{background:#f3f4f6}
      /* Sticky estimate bar — appears after the first real Calculate, then
         tracks live as the customer swaps items. Fixed to the viewport
         (not just the widget), since the widget can sit inside a much
         longer page. */
      /* These 3 modals live on document.body now (see mqSetupModalOverlays),
         not nested inside #midasquote-widget, so they can't rely on any of
         the widget's own scoped CSS — this is a small, self-contained copy
         of just what they need, under their own dedicated classes so
         nothing here can collide with the widget's internal styling or the
         host page's own CSS.
         z-index must beat #mq-sticky-bar (z-index:999999, position:fixed) —
         same fix as mqEnsureCalcModal — or the sticky bar renders on top of
         and covers these popups (Ask a question / Book a consultation /
         quick email / lead capture / demo locked). */
      .mq-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000010;align-items:center;justify-content:center;padding:1rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
      .mq-overlay.show{display:flex}
      .mq-modal{background:#f8faff;border-radius:12px;padding:1.5rem;width:90%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.18);position:relative;margin:auto;box-sizing:border-box}
      .mq-modal *{box-sizing:border-box}
      .mq-modal-title{font-size:16px;font-weight:600;color:#111;margin:0 0 4px}
      .mq-modal-sub{font-size:14px;color:#4b5563;margin:0 0 1.25rem;line-height:1.5}
      .mq-modal-fields{display:flex;flex-direction:column;gap:10px;margin-bottom:1.25rem}
      .mq-modal-field{display:flex;flex-direction:column;gap:5px}
      .mq-modal-field label{font-size:15px;color:#374151}
      .mq-modal-field input{font-size:16px;font-family:inherit;width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;background:#fff}
      .mq-modal-field input:focus{outline:none;border-color:${bc};box-shadow:0 6px 20px rgba(0,0,0,0.30)}
      .mq-modal-btn{width:100%;padding:11px;font-size:14px;font-weight:600;background:${bc};color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit}
      .mq-modal-skip{width:100%;padding:8px;font-size:14px;color:#4b5563;background:none;border:none;cursor:pointer;margin-top:6px;font-family:inherit}
      .mq-modal-copy-btn{flex-shrink:0;padding:6px 12px;font-size:13px;font-weight:600;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#111;cursor:pointer;font-family:inherit}
      #mq-sticky-bar{position:fixed;left:0;right:0;bottom:0;z-index:999999;background:linear-gradient(135deg,#161616 0%,#2b2b2b 100%);border-top:1px solid rgba(255,255,255,0.08);box-shadow:0 -10px 30px rgba(0,0,0,0.35);padding:10px 14px 12px;display:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:mqStickyIn 0.35s cubic-bezier(.2,.8,.2,1)}
      #mq-sticky-bar.show{display:block}
      @keyframes mqStickyIn{from{transform:translateY(100%)}to{transform:translateY(0)}}
      /* Background/border stay full-bleed on the outer bar, but the actual
         content centers within a max-width column — same width the results
         panel itself uses, so wide desktop screens don't stretch the price
         and buttons apart to the far edges. */
      #mq-sticky-inner{position:relative;max-width:900px;width:100%;margin:0 auto}
      #mq-sticky-close{position:absolute;top:-11px;right:10px;width:24px;height:24px;border-radius:50%;background:#fff;color:#1a1a1a;border:2px solid #1a1a1a;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);padding:0}
      #mq-sticky-main{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      #mq-sticky-content{flex:1;min-width:0}
      #mq-sticky-label{font-size:13px;font-weight:600;color:rgba(255,255,255,0.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
      #mq-sticky-price-wrap{position:relative;display:inline-block}
      #mq-sticky-price{font-size:19px;font-weight:800;color:#fff;display:inline-block;transition:color 0.3s;text-shadow:0 1px 2px rgba(0,0,0,0.3)}
      #mq-sticky-price.pulse{animation:mqPricePulse 0.6s ease}
      @keyframes mqPricePulse{0%{transform:scale(1)}35%{transform:scale(1.14)}100%{transform:scale(1)}}
      .mq-sticky-delta{position:absolute;left:50%;top:-4px;transform:translateX(-50%);font-size:12px;font-weight:800;white-space:nowrap;opacity:0;pointer-events:none}
      .mq-sticky-delta.show{animation:mqDeltaFloat 1.2s ease forwards}
      @keyframes mqDeltaFloat{0%{opacity:0;transform:translate(-50%,4px) scale(0.8)}20%{opacity:1;transform:translate(-50%,-6px) scale(1.05)}100%{opacity:0;transform:translate(-50%,-30px) scale(1)}}
      #mq-sticky-ctas{display:flex;gap:6px;flex-shrink:0}
      #mq-sticky-ctas button{font-size:12px;font-weight:600;padding:9px 10px;border-radius:8px;white-space:nowrap;cursor:pointer;font-family:inherit;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.08);color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.2)}
      #mq-sticky-ctas button.mq-pri{border-color:transparent;font-weight:700}
      #mq-sticky-financing{margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,0.14);text-align:center}
      #mq-sticky-financing-main{font-size:12px;font-weight:700;color:#fbbf24;letter-spacing:0.01em;display:flex;align-items:center;justify-content:center;gap:6px}
      #mq-sticky-financing-disclaimer{font-size:10px;font-weight:400;color:rgba(255,255,255,0.55);font-style:italic;margin-top:3px}
      @media (max-width:420px){
        #mq-sticky-label{display:block;white-space:normal;overflow:visible;text-overflow:clip;flex-basis:100%}
        #mq-sticky-content{flex:1 1 100%}
        #mq-sticky-ctas{flex:1 1 100%;margin-top:4px}
        #mq-sticky-ctas button{flex:1;padding:9px 8px;font-size:11px}
      }
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
      #midasquote-widget .mq-empty-calc-msg{font-size:13px;font-weight:600;color:#b91c1c;background:#fef2f2;border:1.5px solid #fca5a5;border-radius:6px;padding:10px 12px;margin-top:10px;line-height:1.5;text-align:center}
      #midasquote-widget .mq-calc-btn.mq-needs-choice{animation:mqShakeChoice 0.4s ease;box-shadow:0 0 0 3px rgba(220,38,38,0.25)}
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
      #midasquote-widget .mq-financing-box{padding:0;background:#f0fdf4;border-radius:12px;margin-top:0.75rem;border:1.5px solid #4ade80;overflow:hidden;box-shadow:0 4px 16px rgba(134,239,172,0.35)}
      #midasquote-widget .mq-financing-box-topstrip{background:#bbf7d0;padding:0.55rem 1.25rem}
      #midasquote-widget .mq-financing-box-label{font-size:14px;font-weight:700;color:#166534}
      #midasquote-widget .mq-financing-box-body{padding:0.9rem 1.25rem}
      #midasquote-widget .mq-financing-box-val{font-size:18px;font-weight:700;color:#166534}
      #midasquote-widget .mq-financing-box-sub{font-size:11px;color:#6b7280;margin-top:6px;font-style:italic}
      .mq-lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:100000;align-items:center;justify-content:center;padding:1.5rem;cursor:zoom-out;flex-direction:column;gap:0.75rem;overscroll-behavior:contain}
      .mq-hover-preview{display:none;position:fixed;z-index:100001;background:#fff;border-radius:10px;padding:8px;box-shadow:0 12px 32px rgba(0,0,0,0.28);pointer-events:none}
      .mq-hover-preview.show{display:block}
      .mq-hover-preview img{display:block;max-width:180px;max-height:180px;border-radius:6px;object-fit:contain}
      .mq-hover-preview .mq-hp-label{font-size:12px;color:#374151;text-align:center;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:180px}
      .mq-lightbox.show{display:flex}
      .mq-lightbox-track-wrap{width:100%;max-width:100%}
      .mq-lightbox-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;width:100%;overscroll-behavior-x:contain;touch-action:pan-x}
      .mq-lightbox-track::-webkit-scrollbar{display:none}
      .mq-lightbox-slide{flex:0 0 100%;scroll-snap-align:center;display:flex;align-items:center;justify-content:center;min-width:0}
      .mq-lightbox img{max-width:100%;max-height:75vh;object-fit:contain;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
      .mq-lightbox-label{color:#fff;font-size:14px;font-weight:500;text-align:center}
      .mq-lightbox-hint{color:rgba(255,255,255,0.45);font-size:12px}
      .mq-lightbox-nav{position:fixed;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;display:none;align-items:center;justify-content:center;background:rgba(255,255,255,0.95);box-shadow:0 3px 14px rgba(0,0,0,0.35);font-size:26px;font-weight:700;color:#111;border:none;cursor:pointer;z-index:100002}
      .mq-lightbox-nav.show{display:flex}
      .mq-lightbox-nav-left{left:18px}
      .mq-lightbox-nav-right{right:18px}
      @media (max-width:520px){
        .mq-lightbox-nav{width:40px;height:40px;font-size:22px}
        .mq-lightbox-nav-left{left:8px}
        .mq-lightbox-nav-right{right:8px}
      }
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
    const { li, pricing, shopPhotos, shopFeatured } = data;
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
          let addonOptions = [];
          try { addonOptions = item['Addon options'] ? JSON.parse(item['Addon options']) : []; } catch(e) { addonOptions = []; }
          if (Array.isArray(addonOptions)) {
            addonOptions = addonOptions.map(a => ({ ...a, photoUrl: (shopPhotos||{})['addon_'+a.id] || '' }));
          }
          CT_MAT[`ct_${i}`] = {
            label:       item['Name'],
            ps:          item['Rate']||0,
            pi:          item['Install rate']||0,
            // Per-counter floor — if a small counter's real sqft/lin ft math
            // comes out under this, the minimum wins instead (see
            // calcCountertop). 0/undefined means no minimum, same as always.
            min:         item['Minimum price']||0,
            installMin:  item['Install minimum price']||0,
            supplyUnit:  (unitParts[0]||'sqft').trim(),
            installUnit: (unitParts[1]||'sqft').trim(),
            bsOptions:   Array.isArray(bsOptions) ? bsOptions : [],
            cutoutOptions: Array.isArray(cutoutOptions) ? cutoutOptions : [],
            addonOptions: Array.isArray(addonOptions) ? addonOptions : [],
            photoUrl:    (shopPhotos||{})[photoKeyFor('countertop', item['Name'])] || '',
            featured:    (shopFeatured||{})[photoKeyFor('countertop', item['Name'])] || false,
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
    const { li, shopPhotos, shopFeatured } = data;
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
        featured:    (shopFeatured||{})[photoKeyFor(`trim_${type}`, item['Name'])] || false,
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
    const { li, shopPhotos, shopFeatured } = data;
    TALL_CAB = {};
    (li.tallCabItems || []).filter(item => item['Active'] !== false).forEach((item, i) => {
      TALL_CAB[`tc_${i}`] = {
        label: item['Name'],
        basePrice: item['Rate'] || 0,
        photoUrl: (shopPhotos||{})[photoKeyFor('tall_cabinet', item['Name'])] || '',
        featured: (shopFeatured||{})[photoKeyFor('tall_cabinet', item['Name'])] || false,
        visibleRooms: effectiveVisibleRooms(parseVisibleRooms(item), 'tall_cabinet'),
      };
    });
  }

  function tallCabOpts() {
    return `<option value="none">None</option>` + Object.entries(TALL_CAB).map(([k,t]) => `<option value="${k}">${t.label}</option>`).join('');
  }

  function tallCabItems() {
    return sortAndBadgeItems([{value:'none', label:'None', icon:'🚫'}].concat(
      Object.entries(TALL_CAB).map(([k,t])=>({value:k, label:t.label, photoUrl:t.photoUrl, featured:t.featured||false, icon:'🏛️', price:t.basePrice||0, visibleRooms:t.visibleRooms||[]}))
    ));
  }

  function ctMatOpts() {
    // Must match ctMatItems()'s sorted/grouped order exactly — otherwise the
    // browser's default-selected option (always the first one in the list)
    // doesn't match whichever chip the visual picker highlights as selected,
    // and anything reading the material before a chip gets manually clicked
    // (e.g. the edge/addon lookup, or Calculate if clicked immediately)
    // would use the wrong material.
    const items = ctMatItems();
    return items.length
      ? items.map(it => `<option value="${it.value}">${it.label}</option>`).join('')
      : `<option value="lam">Laminate</option>`;
  }

  function ctMatItems() {
    const entries = Object.entries(CT_MAT);
    return entries.length
      ? sortBadgeAndGroupItems([{value:'none',label:'None',icon:'🚫'}].concat(
          entries.map(([k,m])=>({value:k, label:m.label, photoUrl:m.photoUrl, featured:m.featured||false, icon:'🪨', price:(m.ps||0)+(m.pi||0), visibleRooms:m.visibleRooms||[], groupName:m.groupName||'', groupOrder:m.groupOrder||0, groupDesc:m.groupDesc||''}))
        ))
      : [{value:'none', label:'None', icon:'🚫'}, {value:'lam', label:'Laminate', icon:'🪨'}];
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

  // Optional 3rd/4th args let this open as part of a related set (currently
  // just the measuring-guide carousel) — pass an array of {src,label} plus
  // the starting index, and the lightbox shows nav arrows/swipe to move
  // through the rest without closing. Every other call site is untouched:
  // omit those args and it behaves exactly as a single, non-navigable photo.
  // The image(s) sit in a genuine horizontally-scrollable track (same
  // mechanism as every other scroll row in the widget) rather than a manual
  // touchstart/touchend measurement — that approach never actually tracked
  // the finger during the drag, only jumped at the very end, and let the
  // gesture leak through to scroll the page underneath. A real scroll
  // container fixes both: the browser handles finger-tracking, momentum,
  // and snap natively, and consumes the touch itself instead of leaking it.
  window.mqPhotoLightbox = function(src, label, images, index) {
    let lb = document.getElementById('mq-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'mq-lightbox';
      lb.className = 'mq-lightbox';
      lb.innerHTML = `
        <div class="mq-lightbox-track-wrap"><div class="mq-lightbox-track" id="mq-lightbox-track"></div></div>
        <div class="mq-lightbox-label" id="mq-lightbox-label"></div>
        <div class="mq-lightbox-hint">Tap anywhere to close</div>
        <button type="button" class="mq-lightbox-nav mq-lightbox-nav-left" id="mq-lightbox-prev" aria-label="Previous image">‹</button>
        <button type="button" class="mq-lightbox-nav mq-lightbox-nav-right" id="mq-lightbox-next" aria-label="Next image">›</button>`;
      // Appended to document.body (not the widget container) so position:fixed
      // can't be broken by a transformed ancestor somewhere in the host page —
      // same fix already used for the hover preview.
      document.body.appendChild(lb);
      // A real drag/swipe never fires a native click afterward (the browser
      // suppresses it once a touch sequence has scrolled), so this still
      // closes correctly on a genuine tap without needing to special-case
      // the track — swiping through images just naturally won't trigger it.
      lb.addEventListener('click', (e) => {
        if (e.target.closest('.mq-lightbox-nav')) return; // nav buttons handle their own clicks
        lb.classList.remove('show');
      });
      document.getElementById('mq-lightbox-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        mqLightboxScrollBy(-1);
      });
      document.getElementById('mq-lightbox-next').addEventListener('click', (e) => {
        e.stopPropagation();
        mqLightboxScrollBy(1);
      });
      const trackEl = document.getElementById('mq-lightbox-track');
      let scrollTimer;
      trackEl.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(mqLightboxSyncFromScroll, 100);
      });
    }
    const track = document.getElementById('mq-lightbox-track');
    const imgList = (images && images.length > 1) ? images : [{ src, label }];
    const startIdx = (images && images.length > 1) ? (index || 0) : 0;
    // Same lightbox element is reused for every single open, so its scroll
    // position is a leftover from whatever was viewed last unless something
    // actively resets it. Setting scrollLeft (or reading clientWidth to
    // compute it) while still display:none doesn't reliably work — a hidden
    // element has no real layout, so browsers can ignore the read/write
    // entirely, leaving the OLD scroll position intact even after the
    // innerHTML underneath it has been replaced. Showing the lightbox FIRST
    // fixes that: reading a layout property like clientWidth forces the
    // browser to compute real layout synchronously the moment it's read, so
    // no requestAnimationFrame delay is needed either — that delay was its
    // own separate bug (a second tap landing in the gap before the first
    // tap's deferred position calc had run). Keeps the original image order
    // intact (no rotation) so swiping right from the 3rd of 5 naturally
    // reveals the 4th and 5th, with the 1st and 2nd still back to the left —
    // rotating to put whatever was tapped at index 0 broke that natural
    // spatial relationship.
    lb.classList.add('show');
    track.innerHTML = imgList.map(item => `<div class="mq-lightbox-slide"><img src="${item.src}"/></div>`).join('');
    const targetLeft = startIdx * track.clientWidth;
    track.scrollLeft = targetLeft;
    lb._images = imgList;
    document.getElementById('mq-lightbox-prev').classList.toggle('show', imgList.length > 1);
    document.getElementById('mq-lightbox-next').classList.toggle('show', imgList.length > 1);
    document.getElementById('mq-lightbox-label').textContent = imgList[startIdx] ? imgList[startIdx].label : (label||'');
    // Some mobile browsers don't reliably commit a scrollLeft set made in
    // the same tick as the display:none→flex change above — the box model
    // reads as laid out (clientWidth is accurate), but the actual scroll
    // position can still lag and settle back to wherever it was before,
    // which surfaces as "reopen the first image, it shows the second" after
    // having swiped around a previous session. Desktop doesn't show this,
    // which is exactly what made it look fixed there. A token guards the
    // deferred re-check so it can only ever apply to the MOST RECENT open —
    // if a second tap happens before this fires, the stale check just no-ops
    // instead of clobbering the newer call's position (the exact race the
    // old unconditional requestAnimationFrame version had).
    const openToken = ++mqLightboxOpenToken;
    lb._openToken = openToken;
    requestAnimationFrame(() => {
      if (lb._openToken !== openToken) return; // a newer open has already taken over
      if (track.scrollLeft !== targetLeft) track.scrollLeft = targetLeft;
    });
  };
  let mqLightboxOpenToken = 0;
  // Keeps the caption in sync as the person swipes — debounced so it only
  // updates once the scroll has actually settled, not on every intermediate
  // frame of the drag.
  function mqLightboxSyncFromScroll() {
    const lb = document.getElementById('mq-lightbox');
    const track = document.getElementById('mq-lightbox-track');
    if (!lb || !track || !lb._images) return;
    const idx = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const item = lb._images[idx];
    if (item) document.getElementById('mq-lightbox-label').textContent = item.label || '';
  }
  // Desktop-click / arrow-tap navigation — only these buttons ever trigger
  // an image change on their own; everything else is left to natural
  // swipe/scroll.
  function mqLightboxScrollBy(direction) {
    const lb = document.getElementById('mq-lightbox');
    const track = document.getElementById('mq-lightbox-track');
    if (!lb || !track || !lb._images) return;
    const total = lb._images.length;
    const curIdx = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const nextIdx = ((curIdx + direction) % total + total) % total; // wraps both directions
    track.scrollTo({ left: nextIdx * track.clientWidth, behavior: 'smooth' });
  }
  // Any group of photo thumbnails (door styles, materials, specialty items,
  // etc.) can register its image list here under a key, then open the
  // lightbox already wired to swipe/click through the rest of that same
  // group — same mechanism the measuring-guide carousel uses, just reached
  // via a lookup instead of passing the array through an inline onclick.
  window._mqLightboxGroups = window._mqLightboxGroups || {};
  window.mqPhotoLightboxFromGroup = function(groupKey, index) {
    const images = window._mqLightboxGroups[groupKey];
    if (!images || !images.length) return;
    const item = images[index];
    if (!item) return;
    mqPhotoLightbox(item.src, item.label, images, index);
  };
  // Picker rows (doors, materials, crown, valance, etc.) are different from
  // specialty items: a "collection" filter (e.g. Shaker vs Slab) only ever
  // hides non-matching chips via style.display — the row itself, and the
  // registration above, still has every collection's photos together. So
  // opening straight from that registration let swiping "bleed" from one
  // collection into another that was merely hidden, not actually gone. This
  // instead rebuilds the list from whatever chips are ACTUALLY visible on
  // screen at the moment of the tap, so the lightbox only ever contains
  // what the person can currently see and pick from.
  window.mqPhotoLightboxFromPickerChip = function(selectId, itemValue) {
    const row = document.getElementById(`mq-vprow-${selectId}`);
    if (!row) return;
    const images = [];
    let startIndex = 0;
    row.querySelectorAll('.mq-vpicker-chip').forEach(chip => {
      if (chip.style.display === 'none') return; // filtered out by the current collection (or room/door match)
      const img = chip.querySelector('.mq-vpicker-thumb');
      if (!img) return; // no photo on this chip (placeholder icon) — nothing to show in the lightbox
      if (chip.getAttribute('data-value') === itemValue) startIndex = images.length;
      const labelEl = chip.querySelector('.mq-vpicker-label');
      images.push({ src: img.src, label: labelEl ? labelEl.textContent : '' });
    });
    if (!images.length) return;
    mqPhotoLightbox(images[startIndex].src, images[startIndex].label, images, startIndex);
  };
  // Same underlying issue as the picker-chip fix above, but for specialty
  // items: a category's items can each be scoped to different room types
  // (visibleRooms) — an item not eligible for the currently-selected room
  // gets hidden via style.display, not removed, so the static per-category
  // registration built at render time still has every room's items mixed
  // together. Rebuilds from whatever cards are actually visible right now.
  window.mqPhotoLightboxFromSpecItem = function(groupKey, itemId) {
    const row = document.getElementById(`mq-vprow-${groupKey}`);
    if (!row) return;
    const images = [];
    let startIndex = 0;
    row.querySelectorAll('.mq-spec-item').forEach(card => {
      if (card.style.display === 'none') return; // filtered out by the current room
      const img = card.querySelector('.mq-spec-thumb');
      if (!img) return; // no photo on this card (placeholder star icon)
      if (card.id === itemId) startIndex = images.length;
      const nameEl = card.querySelector('.mq-spec-name');
      images.push({ src: img.src, label: nameEl ? nameEl.textContent : '' });
    });
    if (!images.length) return;
    mqPhotoLightbox(images[startIndex].src, images[startIndex].label, images, startIndex);
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
    const priceOf = it => (it.badgePrice != null ? it.badgePrice : it.price);
    const sorted = [...realItems].sort((a,b)=>priceOf(a)-priceOf(b));
    const allEqual = sorted.every(it => priceOf(it) === priceOf(sorted[0]));
    if (allEqual) { sorted.forEach(it => it.badge = CUR()); return sorted; }
    const n = sorted.length;
    if (n === 2) { sorted[0].badge=CUR(); sorted[1].badge=CUR().repeat(3); }
    else if (n === 3) { sorted[0].badge=CUR(); sorted[1].badge=CUR().repeat(2); sorted[2].badge=CUR().repeat(3); }
    else {
      const min = priceOf(sorted[0]), max = priceOf(sorted[n-1]), range = max-min;
      const b1 = min + range/3, b2 = min + 2*range/3;
      sorted.forEach(it => { const p = priceOf(it); it.badge = p<=b1 ? CUR() : (p<=b2 ? CUR().repeat(2) : CUR().repeat(3)); });
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
  // exact same so the chip can show a quick reassurance note. Re-badges
  // each group's own members (and the ungrouped bucket) scoped to just
  // themselves, rather than leaving the badges from the earlier whole-list
  // pass — a group that happens to sit entirely at the cheap (or pricey)
  // end of the full list's range would otherwise show every item with the
  // same badge, hiding a real cheapest-to-priciest spread within that
  // specific group. No-op if nothing's grouped.
  function applyItemGrouping(items) {
    if (!items.some(it => it.groupName)) return items;
    const groupNames = [...new Set(items.filter(it => it.groupName).map(it => it.groupName))];
    const groups = groupNames.map(name => {
      const members = assignBadges(items.filter(it => it.groupName === name)).sort((a,b) => a.price - b.price);
      const allSamePrice = members.length > 1 && members.every(m => m.price === members[0].price);
      if (allSamePrice) members.forEach(m => m.samePriceNote = true);
      const order = members.find(m => m.groupOrder)?.groupOrder || 0;
      return { order, members };
    }).sort((a,b) => a.order - b.order);
    const ungrouped = assignBadges(items.filter(it => !it.groupName)).sort((a,b) => a.price - b.price);
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

  function pickerRow(selectId, items, extraOnChangeAttr, category, startUnselected) {
    const hasAnyGroup = items.some(it => it.groupName);
    // Preserves cluster order already established by sortBadgeAndGroupItems —
    // groups are contiguous in `items`, so first-seen order here is correct.
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
      // Default to showing just the first collection until the customer
      // picks a different one — set here (during render) so the very first
      // visibility pass picks it up, same as any other default selection.
      window._mqGroupFilter = window._mqGroupFilter || {};
      window._mqGroupFilter[selectId] = groupNames[0];
    }
    const boxBorderColor = window._mqBoxBorder || '#93c5fd';
    const boxBgColor = window._mqBoxBg || '#eff6ff';
    const boxTextColor = window._mqBoxText || '#1e40af';
    const chips = items.map((it,i)=>{
      const safePhoto = (it.photoUrl||'').replace(/'/g,"\\'");
      const safeLabel = (it.label||'').replace(/'/g,"\\'");
      const thumb = it.photoUrl
        ? `<img class="mq-vpicker-thumb" src="${it.photoUrl}" alt="${it.label}" onclick="event.stopPropagation();mqPhotoLightboxFromPickerChip('${selectId}','${(it.value||'').replace(/'/g,"\\'")}')" onerror="this.outerHTML='<div class=\\'mq-vpicker-thumb-placeholder\\'>${it.icon||'🎨'}</div>'"/>`
        : `<div class="mq-vpicker-thumb-placeholder">${it.icon||'🎨'}</div>`;
      const badgeHtml = it.badge ? `<span class="mq-vpicker-badge mq-vpicker-badge-${it.badge.length}">${it.badge}</span>` : '';
      const featuredBadgeHtml = it.featured ? `<span class="mq-vpicker-featured-badge" style="background:${window._mqBadgeColor||'#f59e0b'}">🏆 ${(window._mqBadgeLabel||'Best seller').replace(/</g,'&lt;')}</span>` : '';
      const selectedClass = (i===0 && !startUnselected) ? ' selected' : '';
      const selectBtnLabel = (i===0 && !startUnselected) ? '✓ Selected' : 'Select';
      const roomsAttr = JSON.stringify(it.visibleRooms||[]).replace(/"/g,'&quot;');
      const doorsAttr = JSON.stringify(it.linkedDoors||[]).replace(/"/g,'&quot;');
      const groupNote = it.samePriceNote ? `<span class="mq-vpicker-group-note">✓ Same price as other ${(it.groupName||'').replace(/'/g,"\\'")} options</span>` : '';
      // "none"/"no doors" always stays visible no matter which collection is
      // picked — it's an opt-out, not a style choice. Real ungrouped items
      // fall into the "Other" bucket instead.
      const groupAttr = it.value==='none' ? '__always__' : (it.groupName || (hasAnyGroup ? '__other__' : ''));
      return `<div class="mq-vpicker-chip${selectedClass}" data-vpicker-for="${selectId}" data-value="${it.value}" data-rooms="${roomsAttr}" data-doors="${doorsAttr}" data-group="${groupAttr}" onmouseenter="mqHoverPreviewShow(this,'${safePhoto}','${safeLabel}')" onmouseleave="mqHoverPreviewHide()"><div style="position:relative">${thumb}${badgeHtml}${featuredBadgeHtml}</div><span class="mq-vpicker-label">${it.label}</span>${groupNote}<button type="button" class="mq-vpicker-select-btn" onclick="mqPickVisual('${selectId}',this)">${selectBtnLabel}</button></div>`;
    }).join('');
    const vpickerWrap = `<div class="mq-vpicker-wrap"><button type="button" class="mq-vpicker-arrow mq-vpicker-arrow-left" id="mq-vparrow-left-${selectId}" onclick="mqScrollPickerRow('${selectId}',-1)" aria-label="Scroll left">‹</button><div class="mq-vpicker-row" id="mq-vprow-${selectId}" ${startUnselected?'data-no-auto-select="1"':''} onscroll="mqUpdatePickerArrow('${selectId}')">${chips}</div><button type="button" class="mq-vpicker-arrow" id="mq-vparrow-${selectId}" onclick="mqScrollPickerRow('${selectId}',1)" aria-label="Scroll right">›</button></div>`;
    if (!hasAnyGroup) return vpickerWrap;
    // Trying items nested inside the same collection box, rather than as a
    // separate block below it — reads as one unified "pick your style"
    // unit instead of two disconnected pieces.
    return `
      <div style="margin-bottom:10px;background:${boxBgColor};border:1.5px solid ${boxBorderColor};border-radius:10px;padding:12px 14px">
        <label style="font-size:14px;font-weight:700;color:${boxTextColor};display:flex;align-items:center;gap:6px;margin-bottom:8px">🗂️ ${pickerLabel}</label>
        <select id="mq-groupselect-${selectId}" onchange="mqFilterPickerByGroup('${selectId}',this.value,this.selectedOptions[0]?this.selectedOptions[0].dataset.desc:'',this.selectedOptions[0]?this.selectedOptions[0].dataset.count:'')" style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #d1d5db;font-size:14px;font-family:inherit;background:#fff">
          ${groupNames.map(g=>`<option value="${g.replace(/"/g,'&quot;')}" data-desc="${groupDescOf(g).replace(/"/g,'&quot;')}" data-count="${countOf(g)}">${g}</option>`).join('')}
          ${hasOtherBucket ? `<option value="__other__" data-desc="" data-count="${countOf('__other__')}">Other</option>` : ''}
        </select>
        <div id="mq-groupcount-${selectId}" style="font-size:12px;font-weight:600;color:${boxTextColor};margin-top:8px">${countNote(groupNames[0])}</div>
        <div id="mq-groupdesc-${selectId}" style="font-size:12px;color:#6b7280;margin:4px 0 10px;line-height:1.5">${groupDescOf(groupNames[0])}</div>
        ${vpickerWrap}
      </div>`;
  }

  // Shows a "more to scroll" arrow over the right (and now left) edge of a
  // picker row whenever its chips overflow the visible width and haven't
  // been scrolled all the way in that direction yet. Doubles as the visual
  // cue for mobile (where several chips routinely don't fit on screen) and
  // as the show/hide toggle for the clickable desktop arrows below.
  window.mqUpdatePickerArrow = function(selectId) {
    const row = document.getElementById(`mq-vprow-${selectId}`);
    const arrow = document.getElementById(`mq-vparrow-${selectId}`);
    const leftArrow = document.getElementById(`mq-vparrow-left-${selectId}`);
    if (!row || !arrow) return;
    const hasOverflow = row.scrollWidth > row.clientWidth + 4;
    const nearEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
    const nearStart = row.scrollLeft <= 4;
    arrow.classList.toggle('show', hasOverflow && !nearEnd);
    if (leftArrow) leftArrow.classList.toggle('show', hasOverflow && !nearStart);
  };
  // Desktop-only click-to-scroll — the row itself still scrolls fine with
  // a trackpad/mouse-wheel, this is just a faster, more obvious way to
  // move through a long row of chips without hunting for the scrollbar.
  window.mqScrollPickerRow = function(selectId, direction) {
    const row = document.getElementById(`mq-vprow-${selectId}`);
    if (!row) return;
    row.scrollBy({ left: row.clientWidth * 0.85 * direction, behavior: 'smooth' });
  };
  window.mqUpdateAllPickerArrows = function() {
    // Deferred a frame — scrollWidth/clientWidth need real layout to have
    // happened, which isn't guaranteed yet if this runs synchronously
    // right after an innerHTML swap.
    requestAnimationFrame(() => {
      document.querySelectorAll('.mq-vpicker-row[id]').forEach(row => {
        window.mqUpdatePickerArrow(row.id.replace(/^mq-vprow-/, ''));
        // mqBindAutoPeek(row); // spin preview disabled for now — code kept intact below in case it's wanted back later
      });
    });
  };
  window.addEventListener('resize', () => window.mqUpdateAllPickerArrows());

  // A brief, one-time "spin and settle" preview — a genuine multi-lap spin
  // (fast at first, easing to a stop), not a scrollLeft hack. Manually
  // driving scrollLeft frame-by-frame fought with the browser's own scroll
  // handling (especially scroll-snap on the measuring-guide carousel) and
  // looked glitchy — so instead this clones the row's content a few times
  // into a purely visual, non-interactive overlay and animates it with one
  // native CSS transition. No scroll state ever touched, nothing to fight,
  // and traveling an exact multiple of one full "lap" means it lands back
  // precisely at the start with no separate return step needed. Purely a
  // "hey, there's more here" cue; never repeats once played for a given row.
  function mqAutoPeekRow(row) {
    if (!row) return;
    const hasOverflow = row.scrollWidth > row.clientWidth + 4;
    if (!hasOverflow) return;
    const children = Array.from(row.children);
    if (!children.length) return;

    setTimeout(() => {
      // Works for both the picker rows (.mq-vpicker-wrap) and the measuring-
      // guide carousel (.mq-measure-carousel) without needing to know either
      // class name — in both cases the row/track's direct parent is exactly
      // the position:relative box the overlay needs to sit inside.
      const wrap = row.parentElement;
      if (!wrap) return;
      const setWidth = row.scrollWidth; // width of exactly one full lap
      const LAPS = 1; // one gentle pass through, same timeframe as before — less motion, easier on the eyes

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#fff;z-index:3;pointer-events:none;border-radius:inherit';
      const track = document.createElement('div');
      track.style.cssText = 'display:flex;gap:8px;will-change:transform';
      // One extra copy of the set at the end so there's always real content
      // sliding into view right up until the moment it stops, then strip
      // every id from the clones so nothing collides with the real,
      // interactive row still sitting underneath, untouched.
      for (let lap = 0; lap <= LAPS; lap++) {
        children.forEach(child => {
          const clone = child.cloneNode(true);
          clone.removeAttribute('id');
          clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
          track.appendChild(clone);
        });
      }
      overlay.appendChild(track);
      wrap.appendChild(overlay);

      requestAnimationFrame(() => {
        track.style.transition = 'transform 2.835s cubic-bezier(0.1,0.7,0.25,1)';
        requestAnimationFrame(() => {
          track.style.transform = `translateX(-${setWidth * LAPS}px)`;
        });
      });
      track.addEventListener('transitionend', () => { overlay.remove(); }, { once: true });
    }, 450); // brief pause after coming into view before the spin starts
  }
  // Only plays once a row actually scrolls into view (no point animating
  // something off-screen the person hasn't reached yet), and only ever
  // once per row — re-renders that touch the same row won't replay it.
  function mqBindAutoPeek(row) {
    if (!row || row.dataset.peekBound) return;
    row.dataset.peekBound = '1';
    const target = row.closest('.mq-vpicker-wrap') || row;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          mqAutoPeekRow(row);
          observer.disconnect();
        }
      });
    }, { threshold: 0.4 });
    observer.observe(target);
  }

  // A much smaller, one-time nudge — just partway toward the 2nd image and
  // back, not a spin through everything. Used specifically for the
  // measuring-guide carousel, since it's important people notice there's
  // more than one image without the fuller spin effect (unplugged above)
  // being disorienting. Temporarily turns off scroll-snap for the moment
  // it's nudging, since snap fighting a programmatic scroll mid-flight is
  // exactly what made the full spin glitchy — restored once fully settled.
  function mqNudgeCarousel(track) {
    if (!track || track.dataset.nudged) return;
    const hasOverflow = track.scrollWidth > track.clientWidth + 4;
    if (!hasOverflow) return; // no real layout yet (e.g. still inside a collapsed section) — don't mark
                              // as done, so a later real attempt (once it's actually visible) can still fire
    track.dataset.nudged = '1';
    setTimeout(() => {
      const originalSnap = track.style.scrollSnapType;
      track.style.scrollSnapType = 'none';
      const nudgeDistance = track.clientWidth * 0.4; // partway toward the 2nd slide, not all the way
      track.scrollTo({ left: nudgeDistance, behavior: 'smooth' });
      setTimeout(() => {
        track.scrollTo({ left: 0, behavior: 'smooth' });
        setTimeout(() => {
          track.style.scrollSnapType = originalSnap || 'x mandatory';
        }, 500); // enough time for the return scroll to finish before restoring snap
      }, 550); // brief pause at the nudge point before returning
    }, 500); // brief pause after coming into view before nudging
  }
  function mqBindCarouselNudge(track) {
    if (!track || track.dataset.nudgeBound) return;
    track.dataset.nudgeBound = '1';
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          mqNudgeCarousel(track);
          observer.disconnect();
        }
      });
    }, { threshold: 0.4 });
    observer.observe(track);
  }

  // Fires when the "Pick a collection" dropdown changes — updates which
  // collection is active, refreshes its description text, and re-runs the
  // existing room-visibility pass, which also checks this filter (see
  // mqRefreshAllPickerVisibility).
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

  // Wraps any horizontal row of content (not just the main material/door/etc
  // pickers) in the exact same scroll-row + clickable-arrow structure —
  // reused here for specialty items (and for a specialty item's own variant
  // picker, when it has one) so they get the same desktop arrows and mobile
  // swipe behavior for free, with zero duplicated CSS or JS.
  function mqHscrollWrap(rowId, extraClass, innerHtml) {
    // mq-spec-scroll-wrap marks this as a specialty-items-style row — see
    // the touch-device media query below, which re-enables the "more
    // items" arrow just for these rows.
    // A specialty item's own variant picker (mq-spec-variant-picker) is
    // much narrower than the main photo/material picker — the round,
    // absolutely-positioned arrow the wide picker uses floats right over
    // the row's own edge, and at this width there's no scroll position
    // where that doesn't land on top of some chip's badge/label (confirmed
    // visually — see mq-spec-variant-wrap below for the fix). So this one
    // context gets an extra wrap class making both arrows real flex
    // siblings with their own reserved column instead, reusing the exact
    // same ids/classes mqUpdatePickerArrow/mqScrollPickerRow already
    // toggle and click — no JS logic changes needed, only CSS.
    const narrowVariantPicker = extraClass === 'mq-spec-variant-picker';
    const wrapClass = `mq-vpicker-wrap mq-spec-scroll-wrap${narrowVariantPicker ? ' mq-spec-variant-wrap' : ''}`;
    return `<div class="${wrapClass}"><button type="button" class="mq-vpicker-arrow mq-vpicker-arrow-left" id="mq-vparrow-left-${rowId}" onclick="mqScrollPickerRow('${rowId}',-1)" aria-label="Scroll left">‹</button><div class="mq-vpicker-row${extraClass?' '+extraClass:''}" id="mq-vprow-${rowId}" onscroll="mqUpdatePickerArrow('${rowId}')">${innerHtml}</div><button type="button" class="mq-vpicker-arrow" id="mq-vparrow-${rowId}" onclick="mqScrollPickerRow('${rowId}',1)" aria-label="Scroll right">›</button></div>`;
  }
  // A specialty item's own variant picker needs its scroll arrows to never
  // overlap a pill's text — at this narrow width there's no scroll position
  // where an absolutely-positioned round arrow (fine for the wide photo
  // pickers) doesn't land on top of some pill's label. Arrows here are real
  // flex siblings of the scroll row instead, each with its own reserved
  // column, so they can never sit on top of pill text at any scroll offset.
  // Reuses the exact same ids/classes mqUpdatePickerArrow/mqScrollPickerRow
  // already toggle and click — no JS logic needed changing, only where the
  // two arrow buttons live in the markup.
  function mqVariantScrollWrap(rowId, innerHtml) {
    return `<div class="mq-vpicker-wrap mq-spec-variant-picker" style="display:flex;align-items:center;gap:4px">
      <button type="button" class="mq-vpicker-arrow-inline mq-vpicker-arrow-left" id="mq-vparrow-left-${rowId}" onclick="mqScrollPickerRow('${rowId}',-1)" aria-label="Scroll left">‹</button>
      <div class="mq-vpicker-row mq-spec-variant-picker" id="mq-vprow-${rowId}" onscroll="mqUpdatePickerArrow('${rowId}')">${innerHtml}</div>
      <button type="button" class="mq-vpicker-arrow-inline" id="mq-vparrow-${rowId}" onclick="mqScrollPickerRow('${rowId}',1)" aria-label="Scroll right">›</button>
    </div>`;
  }
  // Builds the thumbnail+badges markup for one specialty item's current
  // "active" photo/badge/featured state — shared between specHTML's initial
  // render and mqPickSpecVariant's live update after the customer picks a
  // different variant, so there's only ever one implementation of this to
  // keep in sync. groupKey/itemDomId are only used to wire up the
  // tap-to-enlarge lightbox click handler.
  function mqSpecVisualHTML(s, groupKey, itemDomId) {
    const safePhoto = (s.photoUrl||'').replace(/'/g,"\\'");
    const safeLabel = (s.label||'').replace(/'/g,"\\'");
    const thumb = s.photoUrl
      ? `<img class="mq-spec-thumb" src="${s.photoUrl}" alt="${s.label}" onclick="event.stopPropagation();mqPhotoLightboxFromSpecItem('${groupKey}','${itemDomId}')" onmouseenter="mqHoverPreviewShow(this,'${safePhoto}','${safeLabel}')" onmouseleave="mqHoverPreviewHide()" onerror="this.outerHTML='<div class=\\'mq-spec-thumb-placeholder\\'>⭐</div>'"/>`
      : `<div class="mq-spec-thumb-placeholder">⭐</div>`;
    const badgeHtml = s.badge ? `<span class="mq-vpicker-badge mq-vpicker-badge-${s.badge.length}" style="position:absolute;top:-6px;right:-6px">${s.badge}</span>` : '';
    const featuredBadgeHtml = s.featured ? `<span class="mq-vpicker-featured-badge" style="background:${window._mqBadgeColor||'#f59e0b'}">🏆 ${(window._mqBadgeLabel||'Best seller').replace(/</g,'&lt;')}</span>` : '';
    return `${thumb}${badgeHtml}${featuredBadgeHtml}`;
  }
  // Builds one chip in a specialty item's variant picker (e.g. Maple/Oak/MDF
  // under one "Crown Molding" item) — deliberately much simpler than the
  // full material/door mq-vpicker-chip (no room/collection filtering, no
  // hidden <select> to keep in sync), but reuses the exact same visual
  // classes so it looks and slides identically.
  function mqSpecVariantChipHTML(s, prefix, i, v, vi, selected) {
    const safeLabel = (v.label||'').replace(/</g,'&lt;');
    const starHtml = v.featured ? `<span class="mq-vpicker-variant-star" title="${(window._mqBadgeLabel||'Best seller').replace(/"/g,'&quot;')}">🏆</span>` : '';
    return `<button type="button" class="mq-vpicker-variant-chip${selected?' selected':''}" onclick="mqPickSpecVariant('${prefix}',${i},${vi})">${starHtml}${safeLabel}</button>`;
  }
  function specHTML(specs, prefix) {
    if (!specs.length) return '<p style="font-size:14px;color:#4b5563">No specialty items configured yet.</p>';

    const buildCard = (s,i,groupKey,groupIndex) => {
      const itemDomId = `mq-sp-${prefix}-${i}`;
      const roomsAttr = JSON.stringify(s.visibleRooms||[]).replace(/"/g,'&quot;');
      // Variant picker (e.g. Maple/Oak/MDF under one "Crown Molding" item) —
      // renders as a scrollable chip row (same as the door/material picker,
      // arrows only appear once it actually overflows) and defaults to the
      // first variant, same convention as every other picker in the widget.
      // Selecting a different chip is handled entirely by mqPickSpecVariant,
      // which mutates this same `s` object's price/photo/badge in place —
      // so the existing quantity controls and calcCabinet's pricing loop
      // below need zero changes to work correctly with whichever variant is
      // currently active.
      const variantPickerHtml = (s.variants && s.variants.length) ? `
        <div class="mq-spec-variant-row" id="mq-spec-variants-${prefix}-${i}">
          ${mqVariantScrollWrap(`${prefix}-specvariant-${i}`,
            s.variants.map((v,vi) => mqSpecVariantChipHTML(s, prefix, i, v, vi, vi===0)).join(''))}
        </div>` : '';
      // Items offering a choice get a dropdown that starts on a
      // non-selectable "Choose one" placeholder — not defaulted to match
      // the project's overall setting, since the whole point here is
      // forcing an actual decision rather than letting people miss that
      // there was a choice at all. Trying to add quantity before choosing
      // shakes and highlights the dropdown instead of silently doing
      // nothing — see mqSpecModeChosen.
      // Install can be priced by a totally different method than supply
      // (e.g. $54.95/sqft to supply a door, but a flat $16.80/door to
      // install it) — when that's the case, picking "Supplied & Installed"
      // needs to ask for whatever quantity install actually needs, since
      // reusing the supply quantity (45 sqft) against a per-door rate would
      // massively overcharge. specUnitKind normalizes each side down to
      // 'linear' | 'sqft' | 'item' so they're comparable.
      const specUnitKind = (perFt, perSqFt) => perFt ? 'linear' : (perSqFt ? 'sqft' : 'item');
      const installDiffers = s.offersInstallChoice && specUnitKind(s.perFt, s.perSqFt) !== specUnitKind(s.installPerFt, s.installPerSqFt);
      // The actual supply/install CHOICE control (a real decision the
      // customer has to make) sits under the photo, left-aligned to match
      // the image's own width, above the variant pills — its own visually
      // distinct row rather than crammed into the description column, so
      // the image/dropdown/pills all line up cleanly down the left side of
      // the card. An item that only ever has ONE install mode (nothing to
      // choose) keeps its plain-text label inline with the description
      // instead — there's no decision to make, so it doesn't need the same
      // visual prominence.
      const installChoiceDropdownHtml = s.offersInstallChoice
        ? `<select id="mq-spec-mode-${prefix}-${i}" class="mq-spec-mode-select" style="font-size:11px;padding:4px 6px;border:1.5px solid #d1d5db;border-radius:5px;width:100%;background:#fff;color:#111;font-weight:600" onchange="mqSpecModeChanged('${prefix}',${i})">
            <option value="" selected disabled>Choose one</option>
            <option value="supply">Supply only</option>
            <option value="install">Supplied &amp; Installed</option>
          </select>`
        : '';
      const installModeLabelHtml = (!s.offersInstallChoice && s.installMode !== 'na')
        ? `<div style="font-size:11px;color:#6b7280;margin-top:10px">${s.installMode === 'installed' ? 'Supplied & Installed' : 'Supply only'}</div>`
        : '';
      const installQtyRowHtml = installDiffers ? `
        <div id="mq-spec-installqty-${prefix}-${i}" style="display:none;margin-top:6px;padding-top:6px;border-top:1px dashed #e5e7eb">
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${s.installQtyLabel || 'How many of these need to be installed?'}</div>
          <div class="mq-qty-ctrl">
            <button class="mq-qty-btn" onclick="mqAdjInstallQty('${prefix}',${i},-1)">−</button>
            <input type="text" inputmode="${s.installPerFt||s.installPerSqFt?'decimal':'numeric'}" pattern="${s.installPerFt||s.installPerSqFt?'[0-9]*\\.?[0-9]*':'[0-9]*'}" id="mq-installqty-${prefix}-${i}" value="0" style="width:36px;text-align:center;font-size:16px;font-weight:500;border:1px solid #d1d5db;border-radius:4px;padding:2px 4px;font-family:inherit;box-shadow:none" oninput="mqSetInstallQty('${prefix}',${i},this.value)" onclick="this.select()"/>
            <button class="mq-qty-btn" onclick="mqAdjInstallQty('${prefix}',${i},1)">+</button>
            ${s.installPerSqFt ? calcBtn(`mq-installqty-${prefix}-${i}`,'sqft',s.label) : (s.installPerFt ? calcBtn(`mq-installqty-${prefix}-${i}`,'linear',s.label) : '')}
          </div>
          <span style="font-size:11px;font-weight:600;color:#6b7280">${s.installPerSqFt ? 'square feet' : (s.installPerFt ? 'linear feet' : 'quantity')}</span>
        </div>` : '';
      return `
      <div class="mq-spec-item" id="${itemDomId}" data-rooms="${roomsAttr}">
        <div class="mq-spec-top">
          <div style="position:relative;flex-shrink:0" id="mq-spec-visual-${prefix}-${i}" data-group-key="${groupKey}">${mqSpecVisualHTML(s, groupKey, itemDomId)}</div>
          <div style="flex:1;min-width:0">
            <span class="mq-spec-name">${s.label}</span>
            ${s.description ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;line-height:1.3">${s.description}</div>` : ''}
            ${installModeLabelHtml}
          </div>
        </div>
        ${installChoiceDropdownHtml ? `<div style="width:100%" id="mq-spec-modewrap-${prefix}-${i}">${installChoiceDropdownHtml}</div>` : ''}
        ${variantPickerHtml}
        <div class="mq-spec-bottom">
          <div class="mq-qty-ctrl">
            <button class="mq-qty-btn" onclick="mqAdjQty('${prefix}',${i},-1)">−</button>
            <input type="text" inputmode="${(s.perSqFt||s.perFt)?'decimal':'numeric'}" pattern="${(s.perSqFt||s.perFt)?'[0-9]*\\.?[0-9]*':'[0-9]*'}" id="mq-qty-${prefix}-${i}" value="0" style="width:36px;text-align:center;font-size:16px;font-weight:500;border:1px solid #d1d5db;border-radius:4px;padding:2px 4px;font-family:inherit;box-shadow:none" oninput="mqSetQty('${prefix}',${i},this.value)" onclick="this.select()"/>
            <button class="mq-qty-btn" onclick="mqAdjQty('${prefix}',${i},1)">+</button>
            ${s.perSqFt ? calcBtn(`mq-qty-${prefix}-${i}`,'sqft',s.label) : (s.perFt ? calcBtn(`mq-qty-${prefix}-${i}`,'linear',s.label) : '')}
          </div>
          <span style="font-size:11px;font-weight:600;color:#6b7280">${s.perSqFt ? 'square feet' : (s.perFt ? 'linear feet' : 'quantity')}</span>
          ${installQtyRowHtml}
        </div>
      </div>`;
    };

    // No shop has assigned any categories yet — keep the exact same flat
    // layout it's always had, nothing changes for anyone who hasn't
    // adopted this.
    const hasAnyCategory = specs.some(s => (s.category||'').trim());
    if (!hasAnyCategory) {
      const flatKey = `${prefix}-spec-flat`;
      const photoSpecs = specs.filter(s => s.photoUrl);
      window._mqLightboxGroups[flatKey] = photoSpecs.map(s => ({ src: s.photoUrl, label: s.label }));
      return mqHscrollWrap(flatKey, 'mq-spec-flat-items', specs.map((s,i)=>buildCard(s,i,flatKey,photoSpecs.indexOf(s))).join(''));
    }

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
    // Cheapest-to-priciest within each group — same total-cost metric the
    // $/$$/$$$ badge already uses, so ordering and badge always agree with
    // each other rather than one being sorted and the other left however
    // Airtable happened to return the rows.
    const badgePriceOf = idx => { const s = specs[idx]; return s.badgePrice != null ? s.badgePrice : s.price; };
    Object.values(groups).forEach(idxs => idxs.sort((a,b) => badgePriceOf(a) - badgePriceOf(b)));

    return order.map((cat, gi) => {
      const label = cat === '__other__' ? 'Other' : cat;
      const catKey = `${prefix}-spec-cat-${gi}`;
      const catSpecs = groups[cat].map(i => specs[i]);
      const photoSpecs = catSpecs.filter(s => s.photoUrl);
      window._mqLightboxGroups[catKey] = photoSpecs.map(s => ({ src: s.photoUrl, label: s.label }));
      const cardsHtml = groups[cat].map(i => buildCard(specs[i], i, catKey, photoSpecs.indexOf(specs[i]))).join('');
      // data-cat carries the raw category key (not the display label) so
      // mqReorderSpecCategoryGroups can match this group against a shop's
      // saved per-project-type order regardless of how "Other" is worded —
      // it's the same __other__ sentinel used to build `groups` above.
      const catAttr = cat.replace(/"/g,'&quot;');
      return `<div class="mq-spec-category-group" data-cat="${catAttr}" style="margin:${gi===0?'0':'14px'} 0 0">
        <div class="mq-spec-category-heading">${label}</div>
        ${mqHscrollWrap(catKey, 'mq-spec-category-items', cardsHtml)}
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
      <img src="https://raw.githubusercontent.com/aceswin/midasquote-widget/main/measure-guides/corner-cabinets.jpg" alt="How to measure corner cabinets" onclick="mqPhotoLightbox('https://raw.githubusercontent.com/aceswin/midasquote-widget/main/measure-guides/corner-cabinets.jpg','How to measure corner cabinets')" onerror="this.style.display='none'" style="width:100%;max-width:280px;height:auto;border-radius:6px;margin-top:8px;cursor:zoom-in;display:block"/>
    </div>`;
    if (roomId === 'kitchen') {
      return `
        <div style="font-weight:600;margin-bottom:18px;color:#111">📏 Quick measuring guide</div>
        <div style="background:#fffbeb;border-radius:6px;padding:8px 10px;margin-bottom:10px;color:#92400e;font-size:12px">💡 <strong>All cabinet measurements will get converted into linear feet with the ${mqCalcIconInlineHTML()} calculator.</strong> When you're ready, use the calculator to easily add in multiple sections and automatically convert inches/mm to feet.</div>
        <div style="margin-bottom:6px"><strong>Upper cabinets:</strong> A section for every wall run where uppers will go.</div>
        <div style="margin-bottom:6px"><strong>Base cabinets:</strong> Same idea — a section for every run of base cabinets.</div>
        <div style="margin-bottom:6px"><strong>Island cabinets:</strong> Add these in with your base cabinets — measure the island as another section under Base cabinets, not on its own.</div>
        ${cornerSection}`;
    }
    return `
      <div style="font-weight:600;margin-bottom:18px;color:#111">📏 Quick measuring guide</div>
      <div style="background:#fffbeb;border-radius:6px;padding:8px 10px;margin-bottom:10px;color:#92400e;font-size:12px">💡 <strong>All cabinet measurements will get converted into linear feet with the ${mqCalcIconInlineHTML()} calculator.</strong> When you're ready, use the calculator to easily add in multiple sections and automatically convert inches/mm to feet.</div>
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
    html = html.replace(/\[corner-img\]/g, '<img src="https://raw.githubusercontent.com/aceswin/midasquote-widget/main/measure-guides/corner-cabinets.jpg" alt="How to measure corner cabinets" onclick="mqPhotoLightbox(\'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/measure-guides/corner-cabinets.jpg\',\'How to measure corner cabinets\')" onerror="this.style.display=\'none\'" style="width:100%;max-width:280px;height:auto;border-radius:6px;margin-top:8px;cursor:zoom-in;display:block"/>');
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
  let _mqCalcUnit = 'in'; // 'ft', 'in', or 'mm'
  let _mqCalcSections = []; // linear: [{val}]  ·  sqft: [{w,h}]
  let _mqCalcFieldLabel = ''; // shown in the modal so it's clear which field this fills in
  // Remembers the sections entered for each field (keyed by targetId), so
  // closing the calculator and reopening it later — even without ever
  // clicking "Use this total" — picks back up where it left off instead of
  // starting blank. Only restored if the field's current value still
  // matches what those sections would add up to; if it's changed since
  // (typed over directly, adjusted with the +/- steppers, etc.) the old
  // breakdown no longer reflects reality, so it starts fresh instead.
  let _mqCalcSavedSections = {};

  function mqCalcToFeet(val, unit) {
    const n = parseFloat(val) || 0;
    if (unit === 'ft') return n;
    return unit === 'mm' ? n / 304.8 : n / 12;
  }

  // Same idea as mqCalcToFeet, but for fields that store inches instead of
  // feet (e.g. tall cabinet width, a single surface's width/depth) — lets
  // those fields reuse the exact same ft/in/mm calculator, just landing the
  // total in inches instead of feet.
  function mqCalcToInches(val, unit) {
    const n = parseFloat(val) || 0;
    if (unit === 'in') return n;
    return unit === 'mm' ? n / 25.4 : n * 12;
  }

  function mqCalcComputeTotalFor(sections, mode, unit) {
    if (mode === 'linear' || mode === 'inches') {
      const totalUnits = sections.reduce((sum, s) => sum + (parseFloat(s.val) || 0), 0);
      return mode === 'inches' ? mqCalcToInches(totalUnits, unit) : mqCalcToFeet(totalUnits, unit);
    }
    return sections.reduce((sum, s) => sum + mqCalcToFeet(s.w, unit) * mqCalcToFeet(s.h, unit), 0);
  }

  function mqEnsureCalcModal() {
    let modal = document.getElementById('mq-measure-calc');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'mq-measure-calc';
    // z-index must beat #mq-sticky-bar (z-index:999999, position:fixed) —
    // same fix as the proposal modals in widgetpro.js — or the sticky bar
    // renders on top of and covers the bottom of this modal.
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1000010;display:none;align-items:center;justify-content:center;padding:1rem;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
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
    const saved = _mqCalcSavedSections[targetId];
    const targetEl = document.getElementById(targetId);
    let restored = false;
    if (saved && saved.mode === mode && targetEl) {
      const savedTotal = mqCalcComputeTotalFor(saved.sections, saved.mode, saved.unit);
      const roundedSavedTotal = targetId.startsWith('mq-qty-') ? Math.round(savedTotal*10)/10 : Math.round(savedTotal*100)/100;
      const currentVal = parseFloat(targetEl.value) || 0;
      if (Math.abs(roundedSavedTotal - currentVal) < 0.01) {
        _mqCalcSections = saved.sections.map(s => ({ ...s })); // copy, not the same reference
        _mqCalcUnit = saved.unit;
        restored = true;
      }
    }
    if (!restored) {
      _mqCalcSections = (mode === 'linear' || mode === 'inches') ? [{ val: '' }] : [{ w: '', h: '' }];
    }
    mqEnsureCalcModal().style.display = 'flex';
    mqRenderCalc();
    // No need to collapse the sticky bar's breakdown here — the modal's
    // z-index (see mqEnsureCalcModal) already puts it above #mq-sticky-bar,
    // so it just renders on top regardless of the breakdown's state.
  };

  window.mqCloseMeasureCalc = function() {
    if (_mqCalcTargetId) {
      _mqCalcSavedSections[_mqCalcTargetId] = { mode: _mqCalcMode, unit: _mqCalcUnit, sections: _mqCalcSections.map(s => ({ ...s })) };
    }
    const modal = document.getElementById('mq-measure-calc');
    if (modal) modal.style.display = 'none';
  };

  window.mqCalcSetUnit = function(unit) {
    _mqCalcUnit = unit;
    mqRenderCalc();
  };

  window.mqCalcAddSection = function() {
    _mqCalcSections.push((_mqCalcMode === 'linear' || _mqCalcMode === 'inches') ? { val: '' } : { w: '', h: '' });
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
    return mqCalcComputeTotalFor(_mqCalcSections, _mqCalcMode, _mqCalcUnit);
  }

  function mqRenderCalcTotal() {
    const totalEl = document.getElementById('mq-calc-total');
    if (!totalEl) return;
    const total = mqCalcComputeTotal();
    totalEl.textContent = _mqCalcMode === 'linear' ? `${total.toFixed(2)} linear ft` : _mqCalcMode === 'inches' ? `${total.toFixed(2)} in` : `${total.toFixed(2)} sq ft`;
  }

  function mqRenderCalc() {
    const card = document.getElementById('mq-calc-card');
    if (!card) return;
    const unitLabel = _mqCalcUnit === 'mm' ? 'mm' : (_mqCalcUnit === 'ft' ? 'feet' : 'inches');
    const rows = _mqCalcSections.map((s, idx) => (_mqCalcMode === 'linear' || _mqCalcMode === 'inches') ? `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        ${_mqCalcMode === 'linear' ? `<span style="font-size:13px;color:#4b5563;width:64px;flex-shrink:0">Section ${idx + 1}</span>` : ''}
        <input type="number" value="${s.val}" placeholder="0" oninput="mqCalcUpdateSection(${idx},'val',this.value)" style="flex:1;font-size:16px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit"/>
        <span style="font-size:13px;color:#4b5563;width:44px">${unitLabel}</span>
        ${_mqCalcMode === 'linear' && _mqCalcSections.length > 1 ? `<button type="button" onclick="mqCalcRemoveSection(${idx})" style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:0 4px">✕</button>` : (_mqCalcMode === 'linear' ? '<span style="width:20px;flex-shrink:0"></span>' : '')}
      </div>` : `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:13px;color:#4b5563;width:64px;flex-shrink:0">Section ${idx + 1}</span>
        <input type="number" value="${s.w}" placeholder="Width" oninput="mqCalcUpdateSection(${idx},'w',this.value)" style="flex:1;min-width:0;font-size:16px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit"/>
        <span style="font-size:12px;color:#6b7280;flex-shrink:0">×</span>
        <input type="number" value="${s.h}" placeholder="Height" oninput="mqCalcUpdateSection(${idx},'h',this.value)" style="flex:1;min-width:0;font-size:16px;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit"/>
        <span style="font-size:13px;color:#4b5563;width:44px">${unitLabel}</span>
        ${_mqCalcSections.length > 1 ? `<button type="button" onclick="mqCalcRemoveSection(${idx})" style="background:none;border:none;color:#dc2626;font-size:16px;cursor:pointer;padding:0 4px">✕</button>` : '<span style="width:20px;flex-shrink:0"></span>'}
      </div>`
    ).join('');

    card.innerHTML = `
      <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:4px">${_mqCalcMode === 'sqft' ? '📐 Square footage calculator' : '📏 Measurement calculator'}${_mqCalcFieldLabel ? ` <span style="font-weight:600;color:#2563eb">(${_mqCalcFieldLabel})</span>` : ''}</div>
      <div style="font-size:13px;color:#4b5563;margin-bottom:14px">${_mqCalcMode === 'linear' ? "Measure each section, and we'll add them all up and convert to feet for you." : _mqCalcMode === 'inches' ? "Enter the measurement in whatever unit is easiest, and we'll convert it to inches for you." : "Measure the width and height of each section, and we'll convert and total the square footage for you."}</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button type="button" onclick="mqCalcSetUnit('ft')" style="flex:1;padding:8px;border-radius:6px;border:1.5px solid ${_mqCalcUnit === 'ft' ? '#1a1a1a' : '#d1d5db'};background:${_mqCalcUnit === 'ft' ? '#1a1a1a' : '#fff'};color:${_mqCalcUnit === 'ft' ? '#fff' : '#374151'};font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Feet</button>
        <button type="button" onclick="mqCalcSetUnit('in')" style="flex:1;padding:8px;border-radius:6px;border:1.5px solid ${_mqCalcUnit === 'in' ? '#1a1a1a' : '#d1d5db'};background:${_mqCalcUnit === 'in' ? '#1a1a1a' : '#fff'};color:${_mqCalcUnit === 'in' ? '#fff' : '#374151'};font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Inches</button>
        <button type="button" onclick="mqCalcSetUnit('mm')" style="flex:1;padding:8px;border-radius:6px;border:1.5px solid ${_mqCalcUnit === 'mm' ? '#1a1a1a' : '#d1d5db'};background:${_mqCalcUnit === 'mm' ? '#1a1a1a' : '#fff'};color:${_mqCalcUnit === 'mm' ? '#fff' : '#374151'};font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Millimeters</button>
      </div>
      <div id="mq-calc-rows">${rows}</div>
      ${_mqCalcMode !== 'inches' ? `<button type="button" onclick="mqCalcAddSection()" style="width:100%;padding:8px;border-radius:6px;border:1.5px dashed #93c5fd;background:#eff6ff;color:#1e40af;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:14px">+ Add another section</button>` : ''}
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
    // Specialty item qty fields (per linear/sq ft), and inches-mode fields
    // (tall cabinet width, a surface's width/depth — cabinetry is normally
    // measured to the nearest fraction of an inch, not two decimals), keep
    // one decimal place; everything else (uft/bft/trim) supports full
    // decimals.
    const total = (_mqCalcTargetId && _mqCalcTargetId.startsWith('mq-qty-')) || _mqCalcMode === 'inches'
      ? Math.round(rawTotal * 10) / 10
      : Math.round(rawTotal * 100) / 100;
    const targetEl = document.getElementById(_mqCalcTargetId);
    if (targetEl) {
      targetEl.value = total;
      // Fire both events — some target fields listen for 'input' (live
      // recalculation as you type), others for 'change'. Covers either.
      targetEl.dispatchEvent(new Event('input', { bubbles: true }));
      targetEl.dispatchEvent(new Event('change', { bubbles: true }));
      if (targetEl.classList.contains('mq-linft-input') && window.mqAutoSizeLinFtInput) window.mqAutoSizeLinFtInput(targetEl);
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
  function collapsibleHeader(key, title, startOpen) {
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
        <span id="mq-${key}-label" style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">${startOpen ? 'Close' : 'Open'}</span>
        <span class="mq-collapse-arrow${startOpen ? ' open' : ''}" id="mq-${key}-arrow">▶</span>
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
    const { li, hasDynamic, shopPhotos, shopFeatured, roomTypes } = data;
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
        value:`${i}`, label:n, photoUrl:(shopPhotos||{})[photoKeyFor('drawer', n)]||'', featured:(shopFeatured||{})[photoKeyFor('drawer', n)]||false, icon:'🗄️',
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
          return {value:`dyn_${i}`, label:baseName, photoUrl:m.photoUrl, featured:m.featured||false, icon:'🪵', price:priceRate, visibleRooms:m.visibleRooms||[], groupName:(m['Group name']||'').trim(), groupOrder:m['Group sort order']||0, groupDesc:m['Group description']||''};
        }))
      : [{value:'melamine',label:'Melamine',icon:'🪵'},{value:'plywood',label:'Plywood',icon:'🪵'}];
    const dItems = sortBadgeAndGroupItems([{value:'none',label:'No doors',icon:'🚫'}].concat(
      li.doorStyles.length > 0
        ? li.doorStyles.map((d,i)=>({value:`dyn_${i}`, label:d['Name'], photoUrl:d.photoUrl, featured:d.featured||false, icon:'🚪', price:d['Rate']||0, visibleRooms:d.visibleRooms||[], groupName:(d['Group name']||'').trim(), groupOrder:d['Group sort order']||0, groupDesc:d['Group description']||''}))
        : [{value:'slab',label:'Slab',icon:'🚪'},{value:'shaker',label:'Shaker',icon:'🚪'}]
    ));
    const hingeItems = li.hinges.length > 0
      ? sortAndBadgeItems(li.hinges.map((h,i)=>({value:`dyn_${i}`, label:h['Name'], photoUrl:h.photoUrl, featured:h.featured||false, icon:'🔧', price:h['Rate']||0, visibleRooms:h.visibleRooms||[]})))
      : [{value:'softclose',label:'Soft-close',icon:'🔧'},{value:'regular',label:'Regular',icon:'🔧'}];
    const crownItems = sortBadgeAndGroupItems([{value:'none',label:'None',icon:'🚫'}].concat(
      Object.entries(TRIM).filter(([k,t])=>t.type==='crown').map(([k,t])=>({value:k, label:t.label, photoUrl:t.photoUrl, featured:t.featured||false, icon:'👑', price:(t.ps||0)+(t.pi||0), visibleRooms:t.visibleRooms||[], groupName:t.groupName||'', groupOrder:t.groupOrder||0, groupDesc:t.groupDesc||'', linkedDoors:t.linkedDoors||[]}))
    ));
    const valanceItems = sortBadgeAndGroupItems([{value:'none',label:'None',icon:'🚫'}].concat(
      Object.entries(TRIM).filter(([k,t])=>t.type==='valance').map(([k,t])=>({value:k, label:t.label, photoUrl:t.photoUrl, featured:t.featured||false, icon:'📏', price:(t.ps||0)+(t.pi||0), visibleRooms:t.visibleRooms||[], groupName:t.groupName||'', groupOrder:t.groupOrder||0, groupDesc:t.groupDesc||'', linkedDoors:t.linkedDoors||[]}))
    ));

    return `
      <div class="mq-sec">
        <p class="mq-sec-title">Project basics</p>
        <div class="mq-focal-box">
          <label class="mq-focal-box-label" style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;margin-bottom:8px">
            <span class="mq-step-badge" style="width:26px;height:26px;font-size:14px">1</span>
            ${data.shop['Project type title'] || 'Start here — choose your project type'}
          </label>
          <select id="mq-${prefix}-room" onfocus="window._mqPrevRoomId=window._mqPrevRoomId||{};window._mqPrevRoomId['${prefix}']=this.value" onchange="mqCommitCurrentConfig('${prefix}');mqTogVanityNote('${prefix}');mqTogDwOption('${prefix}');mqRefreshRoomVisibility('${prefix}');mqShowRoomDescription('${prefix}');mqRefreshMeasureGuide('${prefix}');mqRefreshAllPickerVisibility('${prefix}');mqOnProjectTypeChange('${prefix}')" style="font-size:15px;font-weight:600;padding:10px 12px">${(roomTypes||[]).filter(r=>!r.proOnly).map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</select>
          <p class="mq-hint mq-focal-box-label" style="display:block;margin-top:8px;font-weight:500">${data.shop['Project type hint'] || 'After calculating your first quote, you can continue adding other project types.'}</p>
          <p class="mq-hint mq-focal-box-label" id="mq-${prefix}-room-vanity-note" style="display:none;margin-top:8px"></p>
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
        <div class="mq-focal-box">
          <div class="mq-field"><label class="mq-label mq-focal-box-label" style="font-size:14px;font-weight:700">${hasInstall ? 'Supply + install?' : 'Supply'}</label>
            <p class="mq-hint mq-focal-box-label" style="margin-bottom:8px">${hasInstall ? "Let us know if you just need the cabinets themselves (supply only), or if you'd also like us to install them for you (supply + install)." : 'This shop offers supply only — installation is not included.'}</p>
            <select id="mq-${prefix}-si" onchange="mqSyncCtSi('${prefix}')">${hasInstall ? '<option value="supply">Supply only</option><option value="install">Supply + install</option>' : '<option value="supply">Supply only</option>'}</select></div>
          <div class="mq-field" style="margin-top:0.75rem"><label class="mq-label mq-focal-box-label" style="font-size:14px;font-weight:700;margin-bottom:8px;display:block">Remove existing cabinets?</label>
            <select id="mq-${prefix}-removal"><option value="no">No removal needed</option><option value="yes">Yes — remove & dispose</option></select></div>
        </div>
      </div>
      <div class="mq-sec" id="mq-${prefix}-cabinet-measurements-sec">
        <p class="mq-sec-title">Cabinet measurements</p>
        ${Object.keys(TALL_CAB).length > 0 ? `<div style="background:#f0fdf4;border:2px solid #4ade80;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:13px;color:#166534;line-height:1.5">📐 <strong>Note:</strong> Do not include tall cabinets (eg. Pantry cabinet, Tall oven unit, etc.) in your linear foot measurements. Add them in the tall cabinets section.</div>` : ''}
        <div class="mq-grid3">
          <div class="mq-field"><label class="mq-label" style="display:block;margin-bottom:8px">Upper cabinets (lin ft)</label>
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap"><div class="mq-qty-ctrl"><button class="mq-qty-btn" type="button" style="display:none" onmousedown="mqLinFtHoldStart('${prefix}','u',-0.5,event)" onmouseup="mqLinFtHoldStop()" onmouseleave="mqLinFtHoldStop()" ontouchstart="mqLinFtHoldStart('${prefix}','u',-0.5,event)" ontouchend="mqLinFtHoldStop()">−</button><div style="position:relative;display:inline-block"><input type="number" class="mq-linft-input" id="mq-${prefix}-uft" value="0" min="0" max="60" step="0.5" onclick="this.select()" style="text-align:center;padding-right:26px"/><span style="position:absolute;right:6px;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:15px;font-weight:600;pointer-events:none">ft</span></div><button class="mq-qty-btn" type="button" style="display:none" onmousedown="mqLinFtHoldStart('${prefix}','u',0.5,event)" onmouseup="mqLinFtHoldStop()" onmouseleave="mqLinFtHoldStop()" ontouchstart="mqLinFtHoldStart('${prefix}','u',0.5,event)" ontouchend="mqLinFtHoldStop()">+</button></div>${calcBtn(`mq-${prefix}-uft`,'linear','Upper cabinets')}</div>
            <div style="font-size:13px;color:#2563eb;font-weight:700;margin-top:4px">👉 Use the calculator to add up your sections & convert inches/mm to linear feet.</div>
          </div>
          <div class="mq-field"><label class="mq-label" style="display:block;margin-bottom:8px">Base cabinets (lin ft)</label>
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap"><div class="mq-qty-ctrl"><button class="mq-qty-btn" type="button" style="display:none" onmousedown="mqLinFtHoldStart('${prefix}','b',-0.5,event)" onmouseup="mqLinFtHoldStop()" onmouseleave="mqLinFtHoldStop()" ontouchstart="mqLinFtHoldStart('${prefix}','b',-0.5,event)" ontouchend="mqLinFtHoldStop()">−</button><div style="position:relative;display:inline-block"><input type="number" class="mq-linft-input" id="mq-${prefix}-bft" value="0" min="0" max="60" step="0.5" oninput="mqRefreshBsFt('${prefix}')" onclick="this.select()" style="text-align:center;padding-right:26px"/><span style="position:absolute;right:6px;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:15px;font-weight:600;pointer-events:none">ft</span></div><button class="mq-qty-btn" type="button" style="display:none" onmousedown="mqLinFtHoldStart('${prefix}','b',0.5,event)" onmouseup="mqLinFtHoldStop()" onmouseleave="mqLinFtHoldStop()" ontouchstart="mqLinFtHoldStart('${prefix}','b',0.5,event)" ontouchend="mqLinFtHoldStop()">+</button></div>${calcBtn(`mq-${prefix}-bft`,'linear','Base cabinets')}</div>
            <div style="font-size:13px;color:#2563eb;font-weight:700;margin-top:4px">👉 Use the calculator to add up your sections & convert inches/mm to linear feet.</div>
          </div>
          <div class="mq-field"><label class="mq-label" style="display:block;margin-bottom:8px">Height (uppers)</label>
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
          🗄️ <strong>Mostly drawers</strong> means that, aside from your sink and corner cabinets, 50% or more of your base cabinets are full drawer banks. 🗄️ <strong>Some drawers</strong> means fewer than that — most are a standard door with just one drawer on top.
        </div>
        <div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap;justify-content:flex-start">
          <div style="flex:0 1 150px;text-align:center">
            <img src="https://widget.midasquote.com/drawer-guide/mostly-drawers.png" alt="Full drawer bank example" style="width:100%;max-width:150px;border-radius:8px;border:1px solid #e5e7eb;display:block;margin:0 auto;cursor:zoom-in" onclick="mqPhotoLightbox('https://widget.midasquote.com/drawer-guide/mostly-drawers.png','Full drawer bank example')" onerror="this.style.display='none'"/>
            <div style="font-size:11px;color:#6b7280;margin-top:6px;line-height:1.4">Most bases look like this → pick <strong>Mostly drawers</strong></div>
          </div>
          <div style="flex:0 1 150px;text-align:center">
            <img src="https://widget.midasquote.com/drawer-guide/some-drawers.png" alt="Standard door with one top drawer example" style="width:100%;max-width:150px;border-radius:8px;border:1px solid #e5e7eb;display:block;margin:0 auto;cursor:zoom-in" onclick="mqPhotoLightbox('https://widget.midasquote.com/drawer-guide/some-drawers.png','Standard door with one top drawer example')" onerror="this.style.display='none'"/>
            <div style="font-size:11px;color:#6b7280;margin-top:6px;line-height:1.4">Most bases look like this → pick <strong>Some drawers</strong></div>
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
          <input type="checkbox" id="mq-${prefix}-trim-use-cab" onchange="mqTogTrimUseCab('${prefix}')" style="margin-top:2px;width:16px;height:16px;flex-shrink:0;accent-color:#1a1a1a"/>
          <span style="font-size:14px;font-weight:500;line-height:1.4">Use my upper cabinet measurements</span>
        </label>
        <div id="mq-${prefix}-trim-body" style="display:none">
        <label id="mq-${prefix}-trim-manual-toggle-wrap" style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-bottom:10px;background:#f9fafb;border-radius:6px;padding:8px 10px">
          <input type="checkbox" id="mq-${prefix}-trim-manual-toggle" onchange="mqTogTrimManualFt('${prefix}')" style="width:16px;height:16px;flex-shrink:0;accent-color:#1a1a1a"/>
          Don't use upper cabinet linear footage — enter it myself
        </label>
        <div id="mq-${prefix}-trim-manual-wrap" style="display:none;margin-bottom:10px;align-items:center;gap:8px">
          <label style="font-size:14px;color:#374151">Linear feet</label>
          <input type="number" id="mq-${prefix}-trim-manual-ft" value="0" min="0" step="0.5" style="width:90px"/>
          ${calcBtn(`mq-${prefix}-trim-manual-ft`,'linear','Crown & valance')}
        </div>
        ${hasCrown?`<div id="mq-${prefix}-crown-field-wrap" style="margin-bottom:8px">
          <div class="mq-field"><label class="mq-label">Crown moulding</label>
            ${pickerRow(`mq-${prefix}-trim-crown`, crownItems, null, 'trim_crown')}
            <select id="mq-${prefix}-trim-crown" onchange="mqTogTrimReturns('${prefix}')" style="display:none">${trimOpts('crown')}</select>
          </div>
        </div>`:''}
        ${hasValance?`<div id="mq-${prefix}-valance-field-wrap">
          <div class="mq-field"><label class="mq-label">Valance</label>
            ${pickerRow(`mq-${prefix}-trim-valance`, valanceItems, null, 'trim_valance')}
            <select id="mq-${prefix}-trim-valance" onchange="mqTogTrimReturns('${prefix}')" style="display:none">${trimOpts('valance')}</select>
          </div>
        </div>`:''}
        </div>
      </div>`:''}
      <div class="mq-sec" id="mq-${prefix}-specialty-sec" onclick="mqOpenIfClosed('${prefix}-specialty')">
        ${collapsibleHeader(`${prefix}-specialty`, 'Details & Selections')}
        <div style="font-size:13px;color:#4b5563;margin-bottom:10px;line-height:1.5">
          ⭐ Optional extras and upgrades — browse and add anything you'd like. Items are priced as either flat rate, per square foot, or per linear foot. Some items may be supply only, supply + install only, or offer a choice of either.
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
    crownReturn:   'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/term-images/crown-return.png',
    valanceReturn: 'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/term-images/valance-return.png',
    sidesplash:    'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/term-images/sidesplash.png',
  };
  function termHelpThumb(imgUrl, label, size = 48, showCaption = true) {
    const safeLabel = label.replace(/'/g, "\\'");
    return `<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;margin-right:8px">
      <img src="${imgUrl}" alt="${label}" onclick="event.stopPropagation();mqPhotoLightbox('${imgUrl}','${safeLabel}')" onerror="this.parentElement.style.display='none'" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:6px;cursor:zoom-in;border:1px solid #93c5fd"/>
      ${showCaption ? '<span style="font-size:9px;font-weight:800;color:#1d4ed8;margin-top:3px;white-space:nowrap">Click to view</span>' : ''}
    </div>`;
  }

  // A function, not a precomputed const — CUR() needs to read the shop's
  // currency symbol, which isn't loaded yet when this file first parses.
  function priceLegendHTML() { return `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:1rem;font-size:13px;color:#4b5563;line-height:1.6">
      Options below are listed <strong>cheapest to most expensive</strong>. Tap any photo to see it up close.
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px;align-items:center">
        <span style="display:inline-flex;align-items:center;gap:5px"><span class="mq-vpicker-badge mq-vpicker-badge-1" style="position:static;display:inline-block">${CUR()}</span> Budget-friendly</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span class="mq-vpicker-badge mq-vpicker-badge-2" style="position:static;display:inline-block">${CUR().repeat(2)}</span> Mid-range</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span class="mq-vpicker-badge mq-vpicker-badge-3" style="position:static;display:inline-block">${CUR().repeat(3)}</span> Premium</span>
      </div>
    </div>`; }

  function buildWidgetHTML(shop, specs, data) {
    const hasCtInstall = hasCountertopInstall();
    const bcSafe = (shop['Brand colour']||'#1a1a1a').replace(/'/g,"\\'");
    const letterSafe = ((shop['Shop name']||'S').charAt(0)||'S').replace(/'/g,"\\'").replace(/"/g,'&quot;');
    const logoHTML = shop['Logo URL'] ? `<div class="mq-logo-real"><img src="${shop['Logo URL']}" alt="${shop['Shop name']}" onerror="mqHandleLogoError(this,'${bcSafe}','${letterSafe}')"/></div>` : `<div class="mq-logo"><span>${(shop['Shop name']||'S').charAt(0)}</span></div>`;
    const disc = shop['Disclaimer text'] || 'Ballpark estimate only. Contact us for a full quote.';
    // Only the default wording gets swapped out for project types with the
    // range toggled off — a shop's own custom disclaimer is left exactly as
    // they wrote it, regardless of that setting.
    window._mqUsingDefaultDisclaimer = !(shop['Disclaimer text']||'').trim();
    const financingOn = shop['Offers financing'] === 'Yes';
    const financingHTML = financingOn
      ? `<div class="mq-financing-note">💳 Financing available</div>`
      : '';
    const financingLink = (shop['Financing link'] || '').trim();
    const askQuestionBtn = (financingOn && financingLink)
      ? `<button onclick="window.open('${financingLink}','_blank')">Get pre-approved ↗</button>`
      : `<button onclick="mqShowConsultModal()">Ask a question ↗</button>`;
    window._mqAskQuestionBtn = askQuestionBtn;
    window._mqFinancingOn = financingOn;
    // Optional monthly-payment estimate: only kicks in once the shop has
    // entered BOTH an interest rate and a term — a shop that's just turned
    // financing on without either still gets the plain badge, no number.
    const financingAPRRaw = parseFloat(shop['Financing APR']);
    const financingTermRaw = parseInt(shop['Financing term months'], 10);
    const financingHasTerms = financingOn && !isNaN(financingAPRRaw) && financingAPRRaw >= 0 && !isNaN(financingTermRaw) && financingTermRaw > 0;
    window._mqFinancingAPR = financingHasTerms ? financingAPRRaw : null;
    window._mqFinancingTermMonths = financingHasTerms ? financingTermRaw : null;

    return `
      <div class="mq-header">
        ${logoHTML}
        <div style="flex:1">
          <div class="mq-shop-name">${shop['Shop name']||''}</div>
          <div class="mq-shop-sub">${shop['City']||''} &nbsp;·&nbsp; ${shop['Phone']||''}</div>
        </div>
        ${shop['Show showroom'] !== 'Hide' && shop['Shop token'] ? `<a href="https://widget.midasquote.com/showroom.html?shop=${shop['Shop token']}" target="_blank" style="font-size:13px;font-weight:600;color:#fff;text-decoration:none;background:${shop['Brand colour']||'#1a1a1a'};border-radius:8px;padding:7px 14px;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:6px;transition:opacity 0.15s;box-shadow:0 8px 24px rgba(0,0,0,0.30),0 2px 6px rgba(0,0,0,0.15);margin-left:auto" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">🖼️ See our showroom</a>` : ''}
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
        ${priceLegendHTML()}
        ${cabinetForm('c', specs, data)}
        <button class="mq-calc-btn" id="mq-c-calc-btn" onclick="mqCalcCabinets()">Calculate cabinet estimate</button>
        <div class="mq-empty-calc-msg" id="mq-c-empty-calc-msg" style="display:none">No selections have been made, or no linear feet was entered — please double-check before calculating.</div>
        <div class="mq-loading" id="mq-c-loading">Building your estimate...</div>
        <div class="mq-result" id="mq-c-result">
          <div class="mq-res-hdr">
            <div><p class="mq-res-title" id="mq-c-res-title">Cabinet estimate</p><p class="mq-res-sub" id="mq-c-res-sub">—</p><p class="mq-hint" id="mq-c-vanity-note" style="display:none;color:#1d4ed8"></p></div>
            <div><div class="mq-res-range-lbl" id="mq-c-res-range-lbl">Estimated range</div><div class="mq-res-range" id="mq-c-res-range">—</div></div>
          </div>
          <ul class="mq-line-items" id="mq-c-line-items"></ul>
          <div class="mq-financing-box" id="mq-c-financing-box" style="display:none">
            <div class="mq-financing-box-topstrip">
              <div class="mq-financing-box-label">💳 Financing available</div>
            </div>
            <div class="mq-financing-box-body">
              <div class="mq-financing-box-val" id="mq-c-financing-val">—</div>
              <div class="mq-financing-box-sub">*Estimated payment only — subject to approval and final terms.</div>
            </div>
          </div>
          <div class="mq-disclaimer" id="mq-c-disclaimer">⚠ ${disc}</div>
          <div style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:6px;padding:10px 12px;margin-top:8px;font-size:13px;color:#92400e;line-height:1.5">🔧 <strong>Handles & knobs not included</strong> in this estimate unless listed as a specialty item above.</div>
          <div class="mq-travel-note">${TRAVEL_NOTE}</div>
          <div class="mq-cta-row">
            <button onclick="mqSwitchTab('both',document.querySelectorAll('.mq-tab')[0])">Get full project quote ✨</button>
          </div>
          <div class="mq-powered-by"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Powered by <a href="https://www.midasquote.com" target="_blank" rel="noopener">MidasQuote</a></div>
        </div>
      </div>

      <!-- COUNTERTOP TAB -->
      <div class="mq-tab-content" id="mq-tab-countertops">
        ${priceLegendHTML()}
        <div class="mq-sec">
          <p class="mq-sec-title">Countertop surfaces</p>
          <div id="mq-ct-surfaces"></div>
          <button class="mq-add-surface-btn" onclick="mqAddSurface('ct')">+ Add another surface</button>
          <p class="mq-hint" style="margin-top:10px">These materials may not reflect our full inventory. If you don't see yours, please feel free to contact us.</p>
        </div>
        <button class="mq-calc-btn" id="mq-ct-calc-btn" onclick="mqCalcCountertops()">Calculate countertop estimate</button>
        <div class="mq-empty-calc-msg" id="mq-ct-empty-calc-msg" style="display:none">No selections have been made, or no linear feet was entered — please double-check before calculating.</div>
        <div class="mq-loading" id="mq-ct-loading">Building your estimate...</div>
        <div class="mq-result" id="mq-ct-result">
          <div class="mq-res-hdr">
            <div><p class="mq-res-title">Countertop estimate</p><p class="mq-res-sub" id="mq-ct-res-sub">—</p></div>
            <div><div class="mq-res-range-lbl">Estimated range</div><div class="mq-res-range" id="mq-ct-res-range">—</div></div>
          </div>
          <ul class="mq-line-items" id="mq-ct-line-items"></ul>
          <div class="mq-financing-box" id="mq-ct-financing-box" style="display:none">
            <div class="mq-financing-box-topstrip">
              <div class="mq-financing-box-label">💳 Financing available</div>
            </div>
            <div class="mq-financing-box-body">
              <div class="mq-financing-box-val" id="mq-ct-financing-val">—</div>
              <div class="mq-financing-box-sub">*Estimated payment only — subject to approval and final terms.</div>
            </div>
          </div>
          <div class="mq-disclaimer">⚠ Stone slabs vary by lot. Final pricing requires templating.</div>
          <div class="mq-travel-note">${TRAVEL_NOTE}</div>
          <div class="mq-cta-row">
            <button onclick="mqSwitchTab('both',document.querySelectorAll('.mq-tab')[0])">Get full project quote ✨</button>
          </div>
          <div class="mq-powered-by"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Powered by <a href="https://www.midasquote.com" target="_blank" rel="noopener">MidasQuote</a></div>
        </div>
      </div>

      <!-- BOTH TAB -->
      <div class="mq-tab-content active" id="mq-tab-both">
        ${priceLegendHTML()}
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
            <input type="checkbox" id="mq-b-use-cab" checked onchange="mqTogUseCab('b')" style="margin-top:2px;width:16px;height:16px;flex-shrink:0;accent-color:#1a1a1a"/>
            <span style="font-size:14px;font-weight:500;line-height:1.4">Use my base cabinet measurements <span style="font-weight:400;color:#6b7280">(assumes standard depth counter)</span></span>
          </label>
          <div id="mq-b-cab-mat" style="display:block;margin-top:0.75rem">
            <div class="mq-field" style="margin-bottom:0.75rem"><label class="mq-label">Countertop material</label>
              ${pickerRow('mq-b-ct-mat-cab', ctMatItems(), null, 'countertop')}
              <select id="mq-b-ct-mat-cab" onchange="mqRefreshBsOpts('mq-b-ct-mat-cab','mq-b-cab-bs');mqRefreshCutoutOpts('mq-b-ct-mat-cab','mq-b-cab-cuts');mqRefreshCtAddons('mq-b-ct-mat-cab','mq-b-cab-edge','mq-b-cab-addons');mqRefreshBsFt('b')" style="display:none">${ctMatOpts()}</select></div>
            <div id="mq-b-cab-edge"></div>
            <div id="mq-b-cab-addons"></div>
            <div style="background:#f9fafb;border-radius:6px;padding:10px 12px;margin-bottom:0.75rem">
            <div id="mq-b-cab-dw-wrap">
                <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-bottom:8px">
                  <input type="checkbox" id="mq-b-cab-dw" onchange="mqRefreshBsFt('b')" style="width:16px;height:16px;flex-shrink:0;accent-color:#1a1a1a"/> Add extra space for a dishwasher <span style="color:#6b7280;font-weight:400">(+24")</span>
                </label>
              </div>
              <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
                <input type="checkbox" id="mq-b-cab-extra-toggle" onchange="mqTogCabExtra('b')" style="width:16px;height:16px;flex-shrink:0;accent-color:#1a1a1a"/> Add additional counter space
              </label>
              <div id="mq-b-cab-extra-wrap" style="display:none;margin-top:8px;align-items:center;gap:8px">
                <label style="font-size:14px;color:#374151">Additional space (feet)</label>
                <input type="number" id="mq-b-cab-extra-ft" value="0" min="0" step="0.5" oninput="mqRefreshBsFt('b')" style="width:80px"/>
                ${calcBtn('mq-b-cab-extra-ft', 'linear', 'Additional counter space')}
              </div>
              <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-top:8px">
                <input type="checkbox" id="mq-b-cab-co" onchange="mqTogCabCuts('b')" style="width:16px;height:16px;flex-shrink:0;accent-color:#1a1a1a"/> Cutouts needed (sink, etc.)
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
              <div style="font-size:14px;color:#166534;margin-top:8px">Backsplash footage used: <strong id="mq-b-cab-bsft-net">0</strong> ft</div>
            </div>
          </div>
        </div>
        <div class="mq-sec"><p class="mq-sec-title" id="mq-b-ct-surfaces-title">Additional countertop surfaces</p>
          <div id="mq-b-ct-surfaces"></div>
          <button class="mq-add-surface-btn" onclick="mqAddSurface('b')">+ Add another surface</button>
        </div>
        </div>
        <button class="mq-calc-btn mq-calc-btn-both" id="mq-b-calc-btn" onclick="mqCalcBoth()">Calculate full project estimate ✨</button>
        <div class="mq-empty-calc-msg" id="mq-b-empty-calc-msg" style="display:none">No selections have been made, or no linear feet was entered — please double-check before calculating.</div>
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
            <div><div class="mq-grand-label">Total project estimate</div><div class="mq-grand-sub" id="mq-b-grand-sub">Before tax · Ballpark estimate only</div></div>
            <div class="mq-grand-val" id="mq-b-grand">—</div>
          </div>
          <div class="mq-financing-box" id="mq-b-financing-box" style="display:none">
            <div class="mq-financing-box-topstrip">
              <div class="mq-financing-box-label">💳 Financing available</div>
            </div>
            <div class="mq-financing-box-body">
              <div class="mq-financing-box-val" id="mq-b-financing-val">—</div>
              <div class="mq-financing-box-sub">*Estimated payment only — subject to approval and final terms.</div>
            </div>
          </div>
          <div class="mq-disclaimer" id="mq-b-disclaimer" style="margin-top:1rem">⚠ ${disc}</div>
          <div style="background:#fffbeb;border:1.5px solid #f59e0b;border-radius:6px;padding:10px 12px;margin-top:8px;font-size:13px;color:#92400e;line-height:1.5">🔧 <strong>Handles & knobs not included</strong> in this estimate unless listed as a specialty item above.</div>
          <div class="mq-travel-note" style="margin-top:8px">${TRAVEL_NOTE}</div>
          <div class="mq-powered-by"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Powered by <a href="https://www.midasquote.com" target="_blank" rel="noopener">MidasQuote</a></div>
        </div>
      </div>`;
  }

  // ============================================================
  // WIRE LOGIC
  // ============================================================
  function wireWidget(data) {
    const { shop, pricing, specs, li, hasDynamic, shopPhotos } = data;
    // Exposed globally so the sticky estimate bar (which lives outside this
    // closure — wireWidget runs fresh on every render/new estimate) can call
    // the exact same pure calculation functions Calculate itself uses, for
    // live updates as the customer tweaks anything. Safe to reference here
    // even though calcCabinet/calcCountertop are defined further down in
    // this function's body — function declarations are fully hoisted
    // within their enclosing scope, so they're already callable by this point.
    window._mqCalcCabinet = calcCabinet;
    window._mqCalcCountertop = calcCountertop;

    // Seed the "room being left" tracker from each room dropdown's actual
    // starting value, right after it's in the DOM — don't rely solely on the
    // dropdown's onfocus handler to populate this. mqCommitCurrentConfig
    // needs to know the PREVIOUS room whenever the dropdown changes, so it
    // can price the project type being left correctly instead of the one
    // just switched to. Normally onfocus (which always fires before a real
    // click/tap opens a native select) sets this in time. But if the very
    // first project-type switch of a session ever happens without a prior
    // focus event on the dropdown, this would otherwise still be undefined,
    // mqCommitCurrentConfig would skip the rewind, and the committed entry
    // would silently get tagged with the NEW room's id instead of the old
    // one — which mqOnProjectTypeChange then mistakes for an existing cart
    // entry for the new room and deletes, dropping the first project type
    // from the cart with no error. Seeding it here (re-run on every full
    // widget render, including mqStartNewEstimate) closes that gap.
    window._mqPrevRoomId = window._mqPrevRoomId || {};
    ['b', 'c'].forEach(p => {
      const roomEl = document.getElementById(`mq-${p}-room`);
      if (roomEl) window._mqPrevRoomId[p] = roomEl.value;
    });

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
    // Edge profiles (single-select per counter, always priced per linear
    // foot) vs stackable addons (any pricing method, own quantity each) —
    // both live in the same 'Addon options' list, split by the isEdge flag.
    function edgeOptionsFor(m) {
      return (m && Array.isArray(m.addonOptions) ? m.addonOptions : []).filter(a => a.isEdge);
    }
    function addonOptionsFor(m) {
      return (m && Array.isArray(m.addonOptions) ? m.addonOptions : []).filter(a => !a.isEdge);
    }
    // Shared by both countertop paths (standalone Surfaces cards and the
    // cabinet-tied "Both" tab flow) — each just passes in its own already-
    // computed linFt/sqft/depth so the actual edge/addon math stays in one
    // place. Edges are always linear-foot priced: counter linear feet plus
    // 2 returns' worth of depth, approximating the sides we can't otherwise
    // measure per-surface. Addons use whichever pricing method was set and
    // are stackable by quantity.
    function ctAddonsCost(m, edgeSelectId, addonIdPrefix, linFt, sqft, depthIn) {
      let cost = 0;
      const labelParts = [];
      const edgeVal = gv(edgeSelectId);
      if (edgeVal && edgeVal !== 'none') {
        const edge = edgeOptionsFor(m)[parseInt(edgeVal, 10)];
        if (edge) {
          const edgeLinFt = linFt + 2 * ((depthIn || ctDepth) / 12);
          cost += (edge.rate||0) * edgeLinFt;
          labelParts.push(`${edge.label} edge`);
        }
      }
      addonOptionsFor(m).forEach((a,i) => {
        if (!document.getElementById(`${addonIdPrefix}-${i}`)?.checked) return;
        const qty = gn(`${addonIdPrefix}-qty-${i}`, 1);
        const unitCost = a.pricingType==='flat' ? (a.rate||0) : a.pricingType==='sqft' ? (a.rate||0)*sqft : (a.rate||0)*linFt;
        cost += unitCost * qty;
        labelParts.push(qty>1 ? `${a.label} ×${qty}` : a.label);
      });
      return { cost, labelParts };
    }
    function bsOptsHtml(m) {
      return bsOptionsFor(m).map((o,i)=>`<option value="${i}">${(o.label||'Backsplash').replace(/"/g,'&quot;')}</option>`).join('');
    }
    function cutoutRowsHtml(m, idPrefix) {
      return cutoutOptionsFor(m).map((o,i)=>
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <label style="font-size:14px;color:#4b5563;min-width:110px">${(o.label||'Cutout').replace(/"/g,'&quot;')}</label>
          <div class="mq-qty-ctrl">
            <button class="mq-qty-btn" type="button" onclick="mqAdjCutoutQty('${idPrefix}',${i},-1)">−</button>
            <input type="text" inputmode="numeric" pattern="[0-9]*" id="${idPrefix}-${i}" value="0" style="width:36px;text-align:center;font-size:16px;font-weight:500;border:1px solid #d1d5db;border-radius:4px;padding:2px 4px;font-family:inherit;box-shadow:none" onclick="this.select()"/>
            <button class="mq-qty-btn" type="button" onclick="mqAdjCutoutQty('${idPrefix}',${i},1)">+</button>
          </div>
        </div>`
      ).join('');
    }
    window.mqAdjCutoutQty = function(idPrefix, i, delta) {
      const input = document.getElementById(`${idPrefix}-${i}`);
      if (!input) return;
      const next = Math.max(0, Math.min(10, (parseInt(input.value,10)||0) + delta));
      input.value = next;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    // Edge profile — single-select, defaults to a $0 "Standard edge" when a
    // material has no edge options configured (or none at all), so this is
    // fully invisible/no-op for any shop that hasn't touched the feature.
    // Rendered as photo chips (like every other picker in the widget) with a
    // hidden input tracking the actual chosen value for the price calc.
    function edgeSelectHtml(m, containerId) {
      const edges = edgeOptionsFor(m);
      if (!edges.length) return '';
      const items = sortAndBadgeItems([{value:'none', label:'Standard', icon:'🚫', photoUrl:(shopPhotos||{})['addon_standard_edge']||''}].concat(
        edges.map((e,i)=>({value:String(i), label:e.label||'Edge', photoUrl:e.photoUrl, icon:'📐', price:e.rate||0}))
      ));
      const opts = items.map(it=>`<option value="${it.value}">${it.label}</option>`).join('');
      return `<div class="mq-field" style="margin-bottom:0.75rem"><label class="mq-label">Edge</label>
        ${pickerRow(`${containerId}-sel`, items)}
        <select id="${containerId}-sel" style="display:none">${opts}</select>
      </div>`;
    }
    // Addons — stackable, own quantity each, any pricing method. Same card
    // shape as the edge chips (56px thumbnail) and the same +/- quantity
    // control style used by specialty items, so quantity sits right next to
    // the item instead of stretched across the full row width.
    function addonRowsHtml(m, idPrefix) {
      const addons = addonOptionsFor(m);
      if (!addons.length) return '';
      const photoAddons = addons.filter(a => a.photoUrl);
      window._mqLightboxGroups[idPrefix] = photoAddons.map(a => ({ src: a.photoUrl, label: a.label }));
      return `<div style="margin-bottom:0.75rem"><label class="mq-label" style="display:block;margin-bottom:6px">Add-ons</label>
        <div style="display:flex;flex-direction:column;gap:8px">
        ${addons.map((a,i)=>{
          const safePhoto = (a.photoUrl||'').replace(/'/g,"\\'");
          const safeLabel = (a.label||'').replace(/'/g,"\\'");
          const thumb = a.photoUrl
            ? `<img src="${a.photoUrl}" alt="${(a.label||'').replace(/"/g,'&quot;')}" onclick="event.stopPropagation();mqPhotoLightboxFromGroup('${idPrefix}',${photoAddons.indexOf(a)})" onmouseenter="mqHoverPreviewShow(this,'${safePhoto}','${safeLabel}')" onmouseleave="mqHoverPreviewHide()" style="width:56px;height:56px;object-fit:contain;border-radius:6px;background:#f3f4f6;flex-shrink:0;cursor:zoom-in"/>`
            : `<div style="width:56px;height:56px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">➕</div>`;
          return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px;border:1px solid #e5e7eb;border-radius:8px">
            ${thumb}
            <div style="flex:1;min-width:0">
              <label style="display:flex;align-items:center;gap:6px;font-size:14px;color:#374151;font-weight:600;cursor:pointer">
                <input type="checkbox" id="${idPrefix}-${i}" onchange="document.getElementById('${idPrefix}-qtywrap-${i}').style.display=this.checked?'flex':'none'" style="width:16px;height:16px;flex-shrink:0;accent-color:#1a1a1a"/>
                ${(a.label||'Addon').replace(/"/g,'&quot;')}
              </label>
              <div class="mq-qty-ctrl" id="${idPrefix}-qtywrap-${i}" style="display:none;margin-top:6px">
                <button class="mq-qty-btn" type="button" onclick="mqAdjAddonQty('${idPrefix}',${i},-1)">−</button>
                <input type="text" inputmode="numeric" pattern="[0-9]*" id="${idPrefix}-qty-${i}" value="1" style="width:36px;text-align:center;font-size:16px;font-weight:500;border:1px solid #d1d5db;border-radius:4px;padding:2px 4px;font-family:inherit;box-shadow:none" onclick="this.select()"/>
                <button class="mq-qty-btn" type="button" onclick="mqAdjAddonQty('${idPrefix}',${i},1)">+</button>
              </div>
            </div>
          </div>`;
        }).join('')}
        </div>
      </div>`;
    }
    window.mqAdjAddonQty = function(idPrefix, i, delta) {
      const input = document.getElementById(`${idPrefix}-qty-${i}`);
      if (!input) return;
      input.value = Math.max(1, (parseInt(input.value,10)||1) + delta);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const ctDepth  = 25.5;

    const diffOn={},specQty={},installQty={},specVariant={},surfCounts={},surfs={},tallCabs={},tallCabCounts={};
    let pendingCb=null;
    // specVariant tracks which variant index is currently active for each
    // specialty item with variants (0 = the default, same convention as
    // every other picker in the widget). Positional, same as specQty/
    // installQty above — index i lines up with specs[i].
    ['c','ct','b'].forEach(p=>{diffOn[p]=false;specQty[p]=new Array(specs.length).fill(0);installQty[p]=new Array(specs.length).fill(0);specVariant[p]=new Array(specs.length).fill(0);surfCounts[p]=0;surfs[p]={};tallCabs[p]={};tallCabCounts[p]=0;});

    function fmt(n){return CUR() +Math.round(n).toLocaleString();}
    function gv(id){const e=document.getElementById(id);return e?e.value:'';}
    function gn(id,d=0){const v=parseFloat(gv(id));return isNaN(v)?d:v;}

    window._mqActiveTabPrefix = window._mqActiveTabPrefix || 'b';
    window.mqSwitchTab=(id,el)=>{
      const newPrefix = id === 'both' ? 'b' : (id === 'countertops' ? 'ct' : 'c');
      if (newPrefix !== window._mqActiveTabPrefix) {
        const committed = mqCommitCurrentConfig(window._mqActiveTabPrefix);
        if (committed) {
          // Reset the tab being left too, since it's now folded into the
          // cart — otherwise switching back to it later would show stale,
          // already-counted selections still sitting in the form.
          if (window._mqActiveTabPrefix === 'ct') mqResetCountertopStandalone('ct');
          else mqResetCabinetForm(window._mqActiveTabPrefix);
        }
      }
      window._mqActiveTabPrefix = newPrefix;
      document.querySelectorAll('.mq-tab-content').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.mq-tab').forEach(t=>t.classList.remove('active'));
      document.getElementById('mq-tab-'+id).classList.add('active');
      el.classList.add('active');
      if (id === 'cabinets') { mqRenumberSteps('c'); window.mqUpdateStepFocus('c'); }
      else if (id === 'both') { window.mqTogUseCab('b'); mqRenumberSteps('b'); window.mqUpdateStepFocus('b'); }
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
      mqReorderSpecCategoryGroups(prefix, roomId);
    };

    // All of a shop's specialty categories are built into the page once, up
    // front, covering every project type at the same time — switching
    // project types only ever shows/hides individual items and their parent
    // category capsules above (mqRefreshRoomVisibility), it never re-renders
    // them. So a per-project-type category order can't be baked in at build
    // time the way item order can; instead this physically re-stacks the
    // already-built category capsules in the DOM every time the customer
    // switches project type, according to that room's saved order (falling
    // back to whatever order they'd otherwise be in for any category that
    // room hasn't customized). Margins are re-applied by actual visible
    // position rather than left as originally rendered, so a category that's
    // hidden entirely for this room never leaves a stray gap above whichever
    // capsule now comes first.
    window.mqReorderSpecCategoryGroups = function(prefix, roomId) {
      const specBody = document.getElementById(`mq-${prefix}-specialty-body`);
      const grid = specBody ? specBody.querySelector('.mq-spec-grid') : null;
      if (!grid) return;
      const groups = [...grid.children].filter(el => el.classList.contains('mq-spec-category-group'));
      if (groups.length > 1) {
        const roomOrder = (window._mqSpecCategoryOrder || {})[roomId] || [];
        if (roomOrder.length) {
          const pos = new Map(roomOrder.map((c, i) => [c, i]));
          // Anything not explicitly placed for this room keeps its current
          // relative order, sorted in after everything that IS placed.
          groups
            .map((g, i) => ({ g, p: pos.has(g.dataset.cat) ? pos.get(g.dataset.cat) : (1000 + i) }))
            .sort((a, b) => a.p - b.p)
            .forEach(({ g }) => grid.appendChild(g));
        }
      }
      let seenVisible = false;
      [...grid.children].filter(el => el.classList.contains('mq-spec-category-group')).forEach(g => {
        if (g.style.display === 'none') return;
        g.style.margin = (seenVisible ? '14px' : '0') + ' 0 0';
        seenVisible = true;
      });
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
    kitchen: 'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/kitchen.jpg',
    bathroom: 'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/bathroom.jpg',
    laundry: 'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/laundry.jpg',
    garage: 'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/garage.jpg',
    commercial: 'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/commercial.jpg',
    other: 'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/cover-images/other.jpg',
    // These three live on a different domain (aceswin.github.io vs
    // raw.githubusercontent.com) — a pre-existing inconsistency, kept as-is
    // and just mirrored here so there's finally a real fallback for them.
    refacing: 'https://aceswin.github.io/midasquote-widget/cover-images/refacing.jpg',
    repainting: 'https://aceswin.github.io/midasquote-widget/cover-images/repainting.jpg',
    restaining: 'https://aceswin.github.io/midasquote-widget/cover-images/restaining.jpg',
  };
  const MQ_MEASURE_IMAGE_BASE = 'https://raw.githubusercontent.com/aceswin/midasquote-widget/main/measure-guides/';
  const MQ_DEFAULT_MEASURE_IMAGE_SET = ['how-to-measure1.jpg', 'how-to-measure.jpg', 'things-to-remember.jpg', 'island.jpg', 'corner-cabinets.jpg'].map(f => MQ_MEASURE_IMAGE_BASE + f);
  const MQ_DEFAULT_MEASURE_IMAGES = {
    kitchen: MQ_DEFAULT_MEASURE_IMAGE_SET,
    bathroom: [MQ_MEASURE_IMAGE_BASE + 'bathroom11.jpg'],
    laundry: MQ_DEFAULT_MEASURE_IMAGE_SET,
    garage: MQ_DEFAULT_MEASURE_IMAGE_SET,
    commercial: MQ_DEFAULT_MEASURE_IMAGE_SET,
    other: MQ_DEFAULT_MEASURE_IMAGE_SET,
    // Same domain inconsistency as the cover images above — these three
    // live on aceswin.github.io, not raw.githubusercontent.com. Kept as-is,
    // just finally given a real fallback entry here.
    refacing: ['https://aceswin.github.io/midasquote-widget/measure-guides/refacing.jpg'],
    repainting: ['https://aceswin.github.io/midasquote-widget/measure-guides/repainting.jpg'],
    restaining: ['https://aceswin.github.io/midasquote-widget/measure-guides/restaining.jpg'],
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
    if (name.includes('refacing')) return 'refacing';
    if (name.includes('repainting')) return 'repainting';
    if (name.includes('restaining')) return 'restaining';
    if (name.includes('other')) return 'other';
    return null;
  }

  window.mqShowRoomDescription=(prefix)=>{
      const descEl = document.getElementById(`mq-${prefix}-room-desc`);
      if (!descEl) return;
      const roomId = gv(`mq-${prefix}-room`);
      const room = (window._mqRoomTypes||[]).find(r=>r.id===roomId);
      const desc = room ? (room.description||'').trim() : '';
      // Free Demo tier never shows a shop's own cover photo, even if one is
      // still saved on the room — always the standard library image instead.
      const coverImg = room ? ((!window._mqIsDemoPlan && (room.coverImage||'').trim()) || MQ_DEFAULT_COVER_IMAGES[mqDefaultImageKey(room)] || '') : '';
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
    // Lets a shop drop a video link into the exact same "measure guide
    // image" field(s) they already use for photos, in whatever order they
    // like — no separate upload path, no separate field, nothing new in
    // the dashboard. Returns null for a plain image URL; otherwise
    // {embedSrc} for a provider embeddable via iframe, or {directFile:true}
    // for a direct video file link (rendered with a native <video> tag
    // instead). Deliberately only recognizes a handful of well-known
    // providers with clean, stable embed URLs — anything else just stays a
    // plain image URL (and if it isn't actually one, the existing
    // onerror-hide behavior already covers that failure gracefully).
    function mqVideoEmbedInfo(url) {
      if (!url) return null;
      const u = String(url).trim();
      let m;
      if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i))) {
        return { embedSrc: `https://www.youtube.com/embed/${m[1]}` };
      }
      if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i))) {
        return { embedSrc: `https://player.vimeo.com/video/${m[1]}` };
      }
      if ((m = u.match(/loom\.com\/share\/([a-zA-Z0-9]+)/i))) {
        return { embedSrc: `https://www.loom.com/embed/${m[1]}` };
      }
      if (/\.(mp4|webm|mov|m4v)(\?.*)?(#.*)?$/i.test(u)) {
        return { directFile: true };
      }
      return null;
    }
    // Builds a 16:9 video slide — an iframe for an embeddable provider, or
    // a native <video> for a direct file link. Used both inside the
    // carousel and for the single-item (no-carousel) case.
    function mqBuildVideoEmbedEl(video, originalUrl) {
      const holder = document.createElement('div');
      holder.style.cssText = 'position:relative;width:100%;padding-top:56.25%;background:#000;border-radius:6px;overflow:hidden';
      if (video.directFile) {
        const v = document.createElement('video');
        v.src = originalUrl;
        v.controls = true;
        v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000';
        holder.appendChild(v);
      } else {
        const iframe = document.createElement('iframe');
        iframe.src = video.embedSrc;
        iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.loading = 'lazy';
        holder.appendChild(iframe);
      }
      return holder;
    }
    // Builds a swipeable image carousel for the measuring guide — only ever
    // called when there's more than one image, so the plain single-image
    // path in mqRefreshMeasureGuide is completely untouched for every shop
    // that hasn't added extra images. A video URL in the mix gets its own
    // embedded-player slide instead of an <img> — see mqVideoEmbedInfo.
    function mqBuildMeasureCarousel(images, room) {
      const outer = document.createElement('div');

      const wrap = document.createElement('div');
      wrap.className = 'mq-measure-carousel';
      wrap.style.cssText = 'position:relative;margin-bottom:4px';

      const track = document.createElement('div');
      track.className = 'mq-measure-carousel-track';
      track.style.cssText = 'display:flex;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;border-radius:6px;scrollbar-width:none';

      // Each slide may be a photo or a video link — classify once up front so
      // the lightbox (which only ever makes sense for photos) gets a
      // photos-only array with correctly remapped indices.
      const videoInfos = images.map(src => mqVideoEmbedInfo(src));
      const hasVideo = videoInfos.some(Boolean);
      const photoIndexMap = {}; // slide index -> index within lightboxImages
      const lightboxImages = [];
      images.forEach((src, i) => {
        if (videoInfos[i]) return;
        photoIndexMap[i] = lightboxImages.length;
        lightboxImages.push({
          src,
          label: room && room.name ? `${room.name} — measuring guide (${i+1}/${images.length})` : `Measuring guide (${i+1}/${images.length})`
        });
      });
      images.forEach((src, i) => {
        const slide = document.createElement('div');
        slide.style.cssText = 'flex:0 0 100%;scroll-snap-align:center;min-width:0';
        const video = videoInfos[i];
        if (video) {
          slide.appendChild(mqBuildVideoEmbedEl(video, src));
        } else {
          const img = document.createElement('img');
          img.src = src;
          img.style.cssText = 'width:100%;height:auto;max-height:480px;object-fit:contain;display:block;cursor:zoom-in;border-radius:6px';
          img.onerror = () => { slide.style.display = 'none'; };
          const lbIdx = photoIndexMap[i];
          img.onclick = () => mqPhotoLightbox(lightboxImages[lbIdx].src, lightboxImages[lbIdx].label, lightboxImages, lbIdx);
          slide.appendChild(img);
        }
        track.appendChild(slide);
      });
      wrap.appendChild(track);

      const dots = document.createElement('div');
      dots.style.cssText = 'display:flex;justify-content:center;gap:6px;margin-top:8px';
      const dotEls = images.map((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to image ${i+1}`);
        dot.style.cssText = `width:7px;height:7px;border-radius:50%;border:none;padding:0;cursor:pointer;background:${i===0?'#2563eb':'#d1d5db'};transition:background 0.15s;flex-shrink:0`;
        dot.onclick = () => { track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' }); };
        dots.appendChild(dot);
        return dot;
      });

      if (images.length > 1) {
        const arrowStyle = 'position:absolute;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,0.92);box-shadow:0 2px 8px rgba(0,0,0,0.22);font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#111;z-index:1';
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button'; prevBtn.innerHTML = '‹'; prevBtn.setAttribute('aria-label','Previous image');
        prevBtn.style.cssText = arrowStyle + ';left:6px';
        prevBtn.onclick = () => { track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' }); };
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button'; nextBtn.innerHTML = '›'; nextBtn.setAttribute('aria-label','Next image');
        nextBtn.style.cssText = arrowStyle + ';right:6px';
        nextBtn.onclick = () => { track.scrollBy({ left: track.clientWidth, behavior: 'smooth' }); };
        wrap.appendChild(prevBtn);
        wrap.appendChild(nextBtn);
      }

      // Debounced so this fires once per swipe/scroll settle, not on every
      // intermediate scroll event.
      let scrollTimer;
      track.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          const idx = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
          dotEls.forEach((d,i) => { d.style.background = i===idx ? '#2563eb' : '#d1d5db'; });
        }, 80);
      });

      outer.appendChild(wrap);
      outer.appendChild(dots);
      const caption = document.createElement('div');
      caption.textContent = hasVideo
        ? `Swipe for more (${images.length})`
        : `🔍 Tap to enlarge · Swipe for more (${images.length} photos)`;
      caption.style.cssText = 'text-align:center;font-size:12px;font-weight:700;color:#2563eb;margin-top:6px;margin-bottom:10px';
      outer.appendChild(caption);
      // mqBindAutoPeek(track); // full spin preview disabled for now — code kept intact above in case it's wanted back later
      mqBindCarouselNudge(track); // instead: a small one-time nudge, just to make sure people notice there's more than one image
      return outer;
    }
    window.mqRefreshMeasureGuide=(prefix)=>{
      const guideEl = document.getElementById(`mq-${prefix}-measure-guide`);
      if (!guideEl) return;
      const roomId = gv(`mq-${prefix}-room`);
      const room = (window._mqRoomTypes||[]).find(r=>r.id===roomId);
      const customText = room ? (room.measureText||'').trim() : '';
      // Free Demo tier: same rule as the cover image above — a Demo shop's
      // own measure-guide photos/videos, even if still saved, never show;
      // this forces the library-default fallback below unconditionally.
      // Custom measuring TEXT still works (it's typed, not an upload, so it
      // costs nothing and isn't part of what Demo restricts).
      const customPrimary = (room && !window._mqIsDemoPlan) ? (room.measureImage||'').trim() : '';
      // Extra images are entirely opt-in — a shop that's never touched this
      // just has an empty/absent array.
      const customExtra = (room && !window._mqIsDemoPlan && Array.isArray(room.measureImages)) ? room.measureImages.map(u=>(u||'').trim()).filter(Boolean) : [];
      // A shop that's customized ANYTHING (even just adding extra images with
      // no primary set) gets exactly what they set, no default mixed in. Only
      // a shop that's never touched either field falls back to the full
      // default set for that room type — which may be several images, not
      // just one, now that most rooms ship with a small default gallery.
      const allImages = customPrimary
        ? [customPrimary, ...customExtra]
        : (customExtra.length ? customExtra : (room ? (MQ_DEFAULT_MEASURE_IMAGES[mqDefaultImageKey(room)] || []) : []));
      guideEl.innerHTML = ''; // clear before rebuilding
      if (allImages.length > 1) {
        guideEl.appendChild(mqBuildMeasureCarousel(allImages, room));
      } else if (allImages.length === 1) {
        const singleVideo = mqVideoEmbedInfo(allImages[0]);
        if (singleVideo) {
          // A lone video link gets the embedded player directly — no
          // lightbox/zoom affordance, since there's nothing to zoom into.
          guideEl.appendChild(mqBuildVideoEmbedEl(singleVideo, allImages[0]));
        } else {
        const img = document.createElement('img');
        img.src = allImages[0];
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
        img.onclick = () => mqPhotoLightbox(allImages[0], room && room.name ? `${room.name} — measuring guide` : 'Measuring guide');
        guideEl.appendChild(img);
        const caption = document.createElement('div');
        caption.textContent = '🔍 Tap to enlarge';
        caption.style.cssText = 'text-align:center;font-size:12px;font-weight:700;color:#2563eb;margin-bottom:10px';
        guideEl.appendChild(caption);
        }
      }
      if (!customText) {
        const defaultBody = document.createElement('div');
        defaultBody.innerHTML = defaultMeasureGuideHTML(roomId);
        guideEl.appendChild(defaultBody);
        return;
      }
      const title = document.createElement('div');
      title.style.cssText = 'font-weight:600;margin-bottom:18px;color:#111';
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
      if (prefix === 'c' || prefix === 'b') {
        const roomId = gv(`mq-${prefix}-room`);
        // Crown/valance are the only picker rows where a door-style match
        // matters — everything else ignores currentDoorName entirely.
        const doorKey = gv(`mq-${prefix}-door`);
        let currentDoorName = '';
        if (doorKey && doorKey !== 'none') {
          const doorItem = (li.doorStyles||[])[parseInt(doorKey.replace('dyn_',''),10)];
          currentDoorName = doorItem ? doorItem['Name'] : '';
        }
        const scope = document.getElementById(prefix==='c' ? 'mq-tab-cabinets' : 'mq-tab-both');
        if (scope) {
          // First pass, crown/valance only: hide any "Pick a collection"
          // option whose group has zero members eligible for the current
          // door — otherwise a customer can land on a group like "Maple
          // crowns" that shows completely empty once an MDF door filters
          // every member out. Done as its own separate pass (not folded
          // into the chip-visibility loop below) so switching away from an
          // invalidated group here doesn't recursively re-enter this same
          // function via mqFilterPickerByGroup.
          scope.querySelectorAll('.mq-vpicker-row').forEach(row=>{
            const rowSelectId = row.id.replace(/^mq-vprow-/, '');
            if (!(rowSelectId.endsWith('-trim-crown') || rowSelectId.endsWith('-trim-valance'))) return;
            const groupHasDoorEligibleMember = {};
            row.querySelectorAll('.mq-vpicker-chip').forEach(chip=>{
              if (chip.getAttribute('data-value') === 'none') return;
              const chipGroup = chip.getAttribute('data-group');
              if (!chipGroup) return;
              let rooms=[];
              try { rooms = JSON.parse(chip.getAttribute('data-rooms')||'[]'); } catch(e) { rooms=[]; }
              const roomOk = !rooms.length || rooms.includes(roomId);
              let doors=[];
              try { doors = JSON.parse(chip.getAttribute('data-doors')||'[]'); } catch(e) { doors=[]; }
              const doorOk = !doors.length || !currentDoorName || doors.includes(currentDoorName);
              if (roomOk && doorOk) groupHasDoorEligibleMember[chipGroup] = true;
            });
            const selectEl = document.getElementById(`mq-groupselect-${rowSelectId}`);
            if (!selectEl) return;
            let currentValueStillValid = false;
            [...selectEl.options].forEach(opt => {
              if (opt.value === '__other__') { opt.hidden = false; opt.disabled = false; if (opt.value === selectEl.value) currentValueStillValid = true; return; }
              const hasEligible = !!groupHasDoorEligibleMember[opt.value];
              opt.hidden = !hasEligible;
              opt.disabled = !hasEligible;
              if (hasEligible && opt.value === selectEl.value) currentValueStillValid = true;
            });
            if (!currentValueStillValid) {
              const firstValidOption = [...selectEl.options].find(o => !o.hidden);
              if (firstValidOption) {
                selectEl.value = firstValidOption.value;
                window._mqGroupFilter = window._mqGroupFilter || {};
                window._mqGroupFilter[rowSelectId] = firstValidOption.value;
                const descEl = document.getElementById(`mq-groupdesc-${rowSelectId}`);
                if (descEl) descEl.textContent = firstValidOption.dataset.desc || '';
                const countEl = document.getElementById(`mq-groupcount-${rowSelectId}`);
                if (countEl) {
                  const total = row.querySelectorAll('.mq-vpicker-chip[data-value]:not([data-value="none"])').length;
                  countEl.textContent = `Showing ${firstValidOption.dataset.count||0} of ${total} total — pick a different collection above to see the rest`;
                }
              }
            }
          });
          // null = shop has no such field at all; true/false set below once
          // that row is actually processed — used after the loop to decide
          // whether to collapse the whole Crown moulding/valance section.
          let crownHasRealOptions = null, valanceHasRealOptions = null;
          scope.querySelectorAll('.mq-vpicker-row').forEach(row=>{
            const rowSelectId = row.id.replace(/^mq-vprow-/, '');
            const isTrimRow = rowSelectId.endsWith('-trim-crown') || rowSelectId.endsWith('-trim-valance');
            const groupFilter = (window._mqGroupFilter||{})[rowSelectId];
            let anyVisibleSelected=false, firstVisibleChip=null, selectedHiddenByGroupOnly=false, anyRealVisible=false;
            row.querySelectorAll('.mq-vpicker-chip').forEach(chip=>{
              let rooms=[];
              try { rooms = JSON.parse(chip.getAttribute('data-rooms')||'[]'); } catch(e) { rooms=[]; }
              const roomOk = !rooms.length || rooms.includes(roomId);
              const chipGroup = chip.getAttribute('data-group');
              const groupOk = !groupFilter || chipGroup === groupFilter || chipGroup === '__always__';
              // "None" stays available regardless of door — it's an opt-out,
              // not a style tied to a particular door. An item with no
              // linkedDoors at all (never touched since this feature
              // shipped) also stays visible for everything, rather than
              // suddenly disappearing for shops who haven't reviewed it yet.
              let doorOk = true;
              if (isTrimRow && chip.getAttribute('data-value') !== 'none') {
                let doors=[];
                try { doors = JSON.parse(chip.getAttribute('data-doors')||'[]'); } catch(e) { doors=[]; }
                doorOk = !doors.length || !currentDoorName || doors.includes(currentDoorName);
              }
              const visible = roomOk && groupOk && doorOk;
              chip.style.display = visible ? '' : 'none';
              if (visible && !firstVisibleChip) firstVisibleChip = chip;
              if (visible && chip.classList.contains('selected')) anyVisibleSelected = true;
              if (visible && chip.getAttribute('data-value') !== 'none') anyRealVisible = true;
              // The actual selection should persist across a collection
              // switch even though it's momentarily out of view — only a
              // room change (a genuinely unavailable item) should force a
              // new pick, never just browsing a different group.
              if (!visible && roomOk && !groupOk && chip.classList.contains('selected')) selectedHiddenByGroupOnly = true;
            });
            // A door style with nothing linked for this field means there's
            // no real choice to make at all — hide the whole field (label
            // included) rather than showing a picker with just "None" in
            // it. Tracked so the outer section below can also collapse if
            // BOTH crown and valance end up with nothing.
            if (isTrimRow) {
              const isCrown = rowSelectId.endsWith('-trim-crown');
              const wrapEl = document.getElementById(isCrown ? `mq-${prefix}-crown-field-wrap` : `mq-${prefix}-valance-field-wrap`);
              if (wrapEl) wrapEl.style.display = anyRealVisible ? '' : 'none';
              if (isCrown) crownHasRealOptions = anyRealVisible; else valanceHasRealOptions = anyRealVisible;
            }
            if (!anyVisibleSelected && firstVisibleChip && !row.dataset.noAutoSelect && !selectedHiddenByGroupOnly) {
              const selectId = firstVisibleChip.getAttribute('data-vpicker-for');
              const btn = firstVisibleChip.querySelector('.mq-vpicker-select-btn');
              if (selectId && btn) window.mqPickVisual(selectId, btn);
            }
          });
          // If this shop has crown and/or valance configured at all, but
          // neither one has a single real option for the currently selected
          // door, there's nothing left in this section worth showing —
          // collapse the whole "Crown moulding / valance" step away, same
          // as any other section that ends up with zero real choices.
          const trimSec = document.getElementById(`mq-${prefix}-trim-sec`);
          if (trimSec && (crownHasRealOptions !== null || valanceHasRealOptions !== null)) {
            const anyTrimAvailable = crownHasRealOptions === true || valanceHasRealOptions === true;
            trimSec.style.display = anyTrimAvailable ? '' : 'none';
            if (window.mqRenumberSteps) window.mqRenumberSteps(prefix);
          }
        }
      }
      // Runs for every tab/prefix, not just Cabinets/Both — a picker's chips
      // can overflow on the standalone Countertops tab too, and that tab has
      // no room selector to have triggered this function via the branch above.
      window.mqUpdateAllPickerArrows();
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
      // Marks that this section has been opened at least once — lets the
      // bottom-of-page auto-open below (mqInitBottomBounceAutoOpen) tell
      // "still closed because it's never been looked at" apart from "was
      // opened, then deliberately closed again," so it only ever forces
      // open a section nobody has seen yet, never one someone chose to
      // close back up.
      if (opening) body.dataset.mqEverOpened = '1';
      // Anything with a scroll-row (specialty items, doors, materials, etc.)
      // inside a section that was just display:none couldn't have had a real
      // scrollWidth/clientWidth to measure — both read as 0 while hidden, so
      // the arrow-overflow check always came back false. Now that it's
      // actually laid out, re-check so the arrows catch up.
      if (opening && window.mqUpdateAllPickerArrows) window.mqUpdateAllPickerArrows();
      // Same underlying issue for the measuring-guide carousel's nudge — it's
      // built while "How to measure" is still collapsed, so its
      // IntersectionObserver has nothing to intersect with yet. Rather than
      // hope the observer catches the display:none→block transition on its
      // own, explicitly give it a real chance to fire now that it's visible.
      if (opening) {
        requestAnimationFrame(() => {
          body.querySelectorAll('.mq-measure-carousel-track').forEach(track => mqNudgeCarousel(track));
        });
      }
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
    // Used for step Continue/Back — puts the section's TOP edge a bit above
    // the viewport's vertical center (not the section's own midpoint at
    // center, which is what scrollIntoView({block:'center'}) does and
    // pushes a tall section's top well above center). Landing the top just
    // above center keeps this consistent with the scroll-spy's centerline
    // trigger regardless of how tall or short the section is.
    function mqScrollTopNearCenter(el, aboveCenterPx) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const top = rect.top + window.pageYOffset - (viewportCenter - (aboveCenterPx == null ? 80 : aboveCenterPx));
      window.scrollTo({ top, behavior: 'smooth' });
    }
    // Used right after Calculate — rather than anchoring the TOP of the
    // results panel to the viewport (which is where a short vs. long
    // breakdown ends up landing at wildly different spots depending on how
    // many items were selected), this anchors the BOTTOM instead: the
    // "Powered by MidasQuote" line always ends up sitting a fixed few
    // pixels above the sticky bar, no matter how tall the breakdown is.
    // Keeps the brand line reliably visible every single time.
    //
    // Retries and re-measures rather than trusting a single calculation —
    // there are several things that can still shift the layout right around
    // this moment (the lead-capture modal closing, the body padding
    // settling, the browser's own scroll-anchoring fighting an explicit
    // scroll), so this keeps nudging toward the target and re-checking
    // until it actually lands there, instead of assuming one shot got it
    // right.
    // Scrolls a freshly-generated estimate into view so its price (and the
    // financing box right under it, when shown) lands near the TOP of the
    // screen. This used to anchor on the "Powered by" footer instead,
    // aligning it just above the sticky bar — but that broke once the
    // financing box made results panels taller: on a short/mobile viewport,
    // pinning the footer near the bottom pushed the price itself off the
    // top of the screen. Anchoring on the price/total block's own top edge
    // is robust regardless of how tall the rest of the panel grows.
    function mqScrollResultsIntoView(prefix) {
      const resultId = prefix === 'c' ? 'mq-c-result' : prefix === 'ct' ? 'mq-ct-result' : 'mq-b-result';
      const anchorSelector = prefix === 'b' ? '.mq-grand-total' : '.mq-res-hdr';
      let attempts = 0;
      function tryScroll() {
        attempts++;
        const resultEl = document.getElementById(resultId);
        const anchorEl = resultEl ? resultEl.querySelector(anchorSelector) : null;
        if (!anchorEl) return;
        const topGap = 16; // small breathing room above the price block
        const rect = anchorEl.getBoundingClientRect();
        const scrollAmount = rect.top - topGap;
        if (Math.abs(scrollAmount) <= 2 || attempts >= 12) return; // close enough, or give up cleanly
        window.scrollBy({ top: scrollAmount, behavior: attempts === 1 ? 'smooth' : 'auto' });
        setTimeout(tryScroll, attempts === 1 ? 450 : 120);
      }
      mqAdjustWidgetBottomPadding(() => {
        requestAnimationFrame(() => { setTimeout(tryScroll, 50); });
      });
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
      mqObserveSectionsForScrollSpy();
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
      void btn.offsetWidth; // restart the animation if it's already mid-pulse
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
      if (next) mqScrollTopNearCenter(next);
    };

    window.mqStepBack = function(prefix) {
      _mqStepIndex[prefix] = Math.max((_mqStepIndex[prefix] || 0) - 1, 0);
      window.mqUpdateStepFocus(prefix);
      const sections = mqGetVisibleSections(prefix);
      const cur = sections[_mqStepIndex[prefix]];
      if (cur) mqScrollTopNearCenter(cur);
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
    }

    document.addEventListener('click', (e) => {
      const sec = e.target.closest('#midasquote-widget .mq-sec');
      if (!sec) return;
      mqJumpToSectionIfNeeded(sec);
    });

    // Scrolling counts as "arriving" at a section too, not just clicking
    // Continue or tapping into it — a shrunk-viewport IntersectionObserver
    // (top and bottom both pulled in 50%) leaves only a thin trigger line
    // at the exact vertical center of the screen; whichever section is
    // crossing that line becomes the current step, reusing the exact same
    // logic a click already runs. Re-observing is cheap and safe to repeat
    // (observing an already-observed element is a no-op), so this just gets
    // called again anywhere section visibility/DOM already gets refreshed,
    // rather than needing a separate mutation-tracking setup.
    let _mqScrollSpyObserver = null;
    function mqObserveSectionsForScrollSpy() {
      if (!_mqScrollSpyObserver) {
        _mqScrollSpyObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => { if (entry.isIntersecting) mqJumpToSectionIfNeeded(entry.target); });
        }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
      }
      document.querySelectorAll('#midasquote-widget .mq-sec').forEach(sec => _mqScrollSpyObserver.observe(sec));
    }

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

      const drawSec = document.getElementById(`mq-${prefix}-drawers-sec`);
      if (drawSec) drawSec.style.display = rowHasReal(`mq-${prefix}-drawer-config`) ? '' : 'none';

      const tcSec = document.getElementById(`mq-${prefix}-tallcabs-sec`);
      if (tcSec) {
        // Checked against the shop's master tall-cabinet list (TALL_CAB)
        // rather than whatever cards happen to be rendered right now —
        // cards are cleared and rebuilt on every project-type switch
        // (mqResetCabinetForm empties #mq-${prefix}-tallcabs, and nothing
        // re-adds a starter card afterward), so between switches there can
        // legitimately be zero cards on screen even though this room fully
        // supports tall cabinets. Checking rendered cards for that state
        // used to hide the whole section — including its "+ Add a tall
        // cabinet" button — with no way back short of a page refresh.
        const anyReal = Object.values(TALL_CAB).some(t => !t.visibleRooms || !t.visibleRooms.length || t.visibleRooms.includes(roomId));
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
        if (surfTitle) surfTitle.textContent = cabActive ? 'Additional countertop surfaces' : 'Countertop surfaces';
        if (!cabActive && surfContainer && !surfContainer.children.length) {
          // Only fires when there's truly nothing there yet — marked so we
          // know to clean it back up if a project type WITH cabinets gets
          // picked afterward, rather than leaving a stray auto-added card
          // behind once "Use my base cabinet measurements" is back and
          // this section should go back to being genuinely empty/optional.
          addSurfaceInternal('b');
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
      // Re-seed one empty starter card for whichever room we're on now —
      // same as the very first page load — so the section looks the same
      // as it did on load instead of sitting empty with just the "+ Add a
      // tall cabinet" button until the customer clicks it themselves.
      // addTallCabInternal calls mqRefreshAllPickerVisibility/mqRefreshSectionVisibility
      // itself, so the new card's Type picker is already filtered correctly
      // for the room now selected.
      if (Object.keys(TALL_CAB).length > 0) addTallCabInternal(prefix);

      const useCabTrimCb = document.getElementById(`mq-${prefix}-trim-use-cab`);
      if (useCabTrimCb) useCabTrimCb.checked = false;
      mqResetPicker(`mq-${prefix}-trim-crown`);
      mqResetPicker(`mq-${prefix}-trim-valance`);
      const crownReturns = document.getElementById(`mq-${prefix}-trim-crown-returns`);
      if (crownReturns) crownReturns.value = 0;
      const valanceReturns = document.getElementById(`mq-${prefix}-trim-valance-returns`);
      if (valanceReturns) valanceReturns.value = 0;
      // Manual crown/valance linear footage ("Don't use upper cabinet
      // linear footage — enter it myself") is a plain number input with no
      // dependency on the crown/valance style pickers above, so nothing
      // above ever touched it — it silently carried its old value into
      // whichever project type came next. Reset directly (not via
      // mqTogTrimManualFt) since that helper also flips trim-use-cab, which
      // useCabTrimCb above already sets deliberately.
      const trimManualToggle = document.getElementById(`mq-${prefix}-trim-manual-toggle`);
      if (trimManualToggle) trimManualToggle.checked = false;
      const trimManualFt = document.getElementById(`mq-${prefix}-trim-manual-ft`);
      if (trimManualFt) trimManualFt.value = 0;
      const trimManualWrap = document.getElementById(`mq-${prefix}-trim-manual-wrap`);
      if (trimManualWrap) trimManualWrap.style.display = 'none';
      window.mqTogTrimReturns(prefix);

      const removalEl = document.getElementById(`mq-${prefix}-removal`);
      if (removalEl) removalEl.selectedIndex = 0;

      if (prefix === 'b') {
        const useCabCt = document.getElementById('mq-b-use-cab');
        if (useCabCt) useCabCt.checked = true;
        window.mqTogUseCab('b');
        // Countertop material, backsplash, dishwasher/extra-space toggles,
        // and cutouts were never reset here — mqResetCountertopStandalone
        // covers this exact same set of fields for the standalone
        // Countertops tab ('ct'), but this Both-tab countertop section uses
        // its own id scheme (mq-b-cab-*/mq-b-ct-mat-cab) and was never
        // wired into any reset path, so switching project types (or
        // hitting "Reset quote," which calls this same function) silently
        // carried the countertop material, backsplash, and additional
        // counter space over from whichever project type was set up last.
        mqResetPicker('mq-b-ct-mat-cab');
        const ctBs = document.getElementById('mq-b-cab-bs');
        if (ctBs) ctBs.selectedIndex = 0;
        const ctDw = document.getElementById('mq-b-cab-dw');
        if (ctDw) ctDw.checked = false;
        const ctCo = document.getElementById('mq-b-cab-co');
        if (ctCo && ctCo.checked) { ctCo.checked = false; ctCo.dispatchEvent(new Event('change')); }
        const ctExtraToggle = document.getElementById('mq-b-cab-extra-toggle');
        if (ctExtraToggle && ctExtraToggle.checked) { ctExtraToggle.checked = false; ctExtraToggle.dispatchEvent(new Event('change')); }
        const ctExtraFt = document.getElementById('mq-b-cab-extra-ft');
        if (ctExtraFt) ctExtraFt.value = 0;
        const ctSurfaces = document.getElementById('mq-b-ct-surfaces');
        if (ctSurfaces) { ctSurfaces.innerHTML = ''; ctSurfaces.dataset.autoAdded = 'false'; }
        const ctSi = document.getElementById('mq-b-ct-si');
        if (ctSi) ctSi.selectedIndex = 0;
      }

      window.mqRefreshAllPickerVisibility(prefix);
      window.mqRefreshBsFt(prefix);
    }

    // Countertop-specific fields the function above doesn't already cover
    // for the STANDALONE Countertops tab — its cabinet-measurement fields
    // (like uft/bft) are shared with the cabinet form by id and so already
    // get reset there; these are unique to the "use cabinet measurements"
    // countertop path plus any added surfaces (islands, peninsulas, etc.).
    function mqResetCountertopStandalone(prefix) {
      const siEl = document.getElementById(`mq-${prefix}-si`);
      if (siEl) siEl.selectedIndex = 0;
      mqResetPicker(`mq-${prefix}-ct-mat-cab`);
      const bsEl = document.getElementById(`mq-${prefix}-cab-bs`);
      if (bsEl) bsEl.selectedIndex = 0;
      const coEl = document.getElementById(`mq-${prefix}-cab-co`);
      if (coEl && coEl.checked) { coEl.checked = false; coEl.dispatchEvent(new Event('change')); }
      const dwEl = document.getElementById(`mq-${prefix}-cab-dw`);
      if (dwEl) dwEl.checked = false;
      const extraToggleEl = document.getElementById(`mq-${prefix}-cab-extra-toggle`);
      if (extraToggleEl && extraToggleEl.checked) { extraToggleEl.checked = false; extraToggleEl.dispatchEvent(new Event('change')); }
      const extraFtEl = document.getElementById(`mq-${prefix}-cab-extra-ft`);
      if (extraFtEl) extraFtEl.value = 0;
      const edgeSelEl = document.getElementById(`mq-${prefix}-cab-edge-sel`);
      if (edgeSelEl) edgeSelEl.selectedIndex = 0;
      const surfacesContainer = document.getElementById(`mq-${prefix}-surfaces`);
      if (surfacesContainer) { surfacesContainer.innerHTML = ''; surfacesContainer.dataset.autoAdded = 'false'; }
      if (surfs[prefix]) surfs[prefix] = {};
    }

    // ===================== Snapshot / restore a project type's form state =====================
    // Lets someone switch BACK to a project type they already committed to
    // the cart and pick up exactly where they left off, instead of it
    // resetting to blank and any new number just tacking on as a second,
    // duplicate entry alongside the original.

    // Restores one field's value — using the same visual-chip mechanism a
    // real click on a picker row uses (so the visible selection AND any
    // onchange-triggered follow-up logic both stay correct), or a direct
    // value/checked assignment for plain inputs that have no picker UI.
    function mqRestoreFieldValue(id, value) {
      const el = document.getElementById(id);
      if (!el || value === undefined) return;
      if (el.tagName === 'SELECT') {
        const chips = document.querySelectorAll(`[data-vpicker-for="${id}"]`);
        const chip = [...chips].find(c => c.getAttribute('data-value') === value);
        const btn = chip ? chip.querySelector('.mq-vpicker-select-btn') : null;
        if (btn) { window.mqPickVisual(id, btn); return; }
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.type === 'checkbox') {
        if (el.checked !== value) { el.checked = value; el.dispatchEvent(new Event('change', { bubbles: true })); }
      } else {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Captures everything about the CURRENT form for `prefix` needed to put
    // it back exactly as it was later — every plain input/select value,
    // whether upper/base are split, every specialty item's quantity, and
    // each tall cabinet card's type/width/quantity (those are dynamically
    // built elements, not simple fields, so they need their own handling
    // rather than falling out of the generic field capture below).
    function mqSnapshotFormState(prefix) {
      const fields = {};
      document.querySelectorAll(`[id^="mq-${prefix}-"]`).forEach(el => {
        if (el.id === `mq-${prefix}-room`) return; // being switched away from — not part of "the config"
        if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          fields[el.id] = (el.type === 'checkbox') ? el.checked : el.value;
        }
      });
      // Specialty items' supply/install mode selector uses a different id
      // shape (mq-spec-mode-PREFIX-i, not mq-PREFIX-spec-mode-i) so it
      // doesn't fall under the generic query above — captured separately.
      document.querySelectorAll(`[id^="mq-spec-mode-${prefix}-"]`).forEach(el => {
        fields[el.id] = el.value;
      });
      const tallCabSnaps = [];
      Object.keys(tallCabs[prefix] || {}).forEach(id => {
        const qty = tallCabs[prefix][id];
        if (!qty) return; // an empty, just-added card isn't worth restoring
        const typeEl = document.getElementById(`mq-tc-type-${id}`);
        const widthEl = document.getElementById(`mq-tc-width-${id}`);
        tallCabSnaps.push({ type: typeEl ? typeEl.value : 'none', width: widthEl ? widthEl.value : '24', qty });
      });
      // Additional countertop surface cards ("+ Add another surface") are
      // also dynamically built, not simple fields — same reason as tall
      // cabinets above. Each card's every input/select is captured, scoped
      // to that card's own DOM subtree (#mqsc-ID) so there's no risk of
      // pulling in another surface's fields. The card's own id (e.g. "sb2")
      // gets swapped out for a placeholder in each field's id so the
      // captured shape can be replayed onto whatever NEW id the card gets
      // when it's recreated on restore (surface ids are a running counter,
      // so a restored card never reuses its original id).
      const surfaceSnaps = [];
      Object.keys(surfs[prefix] || {}).forEach(id => {
        const card = document.getElementById(`mqsc-${id}`);
        if (!card) return;
        const surfFields = [];
        card.querySelectorAll('input, select').forEach(el => {
          if (!el.id) return;
          surfFields.push({
            template: el.id.split(id).join('§'),
            value: (el.type === 'checkbox') ? el.checked : el.value,
          });
        });
        surfaceSnaps.push(surfFields);
      });
      return {
        fields,
        diffOn: !!diffOn[prefix],
        specQty: [...(specQty[prefix] || [])],
        installQty: [...(installQty[prefix] || [])],
        specVariant: [...(specVariant[prefix] || [])],
        tallCabs: tallCabSnaps,
        surfaces: surfaceSnaps,
      };
    }

    // Applies a snapshot captured above back onto the (already freshly
    // reset) form for `prefix`.
    function mqRestoreFormState(prefix, snapshot) {
      if (!snapshot) return;
      // Split upper/base first — it changes which fields are even visible
      // before the rest of the values get restored into them.
      if (!!diffOn[prefix] !== !!snapshot.diffOn) window.mqTogDiff(prefix);
      Object.keys(snapshot.fields).forEach(id => mqRestoreFieldValue(id, snapshot.fields[id]));
      // Specialty items: restore the underlying tracking data directly,
      // bypassing mqSetQty's "a mode must already be chosen" guard — this
      // is known-valid prior state being put back, not new input that
      // still needs validating — then keep the visible quantity box and
      // "on" highlight in sync by hand.
      (snapshot.specQty || []).forEach((qty, i) => {
        if (!qty || !specQty[prefix]) return;
        specQty[prefix][i] = qty;
        const el = document.getElementById(`mq-qty-${prefix}-${i}`);
        if (el) el.value = qty;
        document.getElementById(`mq-sp-${prefix}-${i}`)?.classList.toggle('on', qty > 0);
      });
      (snapshot.installQty || []).forEach((qty, i) => {
        if (!qty || !installQty[prefix]) return;
        installQty[prefix][i] = qty;
        const el = document.getElementById(`mq-installqty-${prefix}-${i}`);
        if (el) el.value = qty;
      });
      // Specialty item variants: only worth restoring anything other than
      // the default (index 0), since mqPickSpecVariant already applies the
      // full price/photo/badge/UI update in one call — no separate manual
      // sync needed like specQty/installQty above.
      (snapshot.specVariant || []).forEach((vi, i) => {
        if (!vi || !specs[i] || !specs[i].variants || !specs[i].variants[vi]) return;
        window.mqPickSpecVariant(prefix, i, vi);
      });
      // Tall cabinets are dynamically-created cards, not simple fields —
      // the reset that already ran before this cleared any old ones, so
      // recreate one fresh card per saved cabinet, then set it to match.
      (snapshot.tallCabs || []).forEach(tc => {
        addTallCabInternal(prefix);
        const newId = `tc${prefix}${tallCabCounts[prefix]}`;
        mqRestoreFieldValue(`mq-tc-type-${newId}`, tc.type);
        const widthEl = document.getElementById(`mq-tc-width-${newId}`);
        if (widthEl) widthEl.value = tc.width;
        tallCabs[prefix][newId] = tc.qty;
        const qtyEl = document.getElementById(`mq-tc-qty-${newId}`);
        if (qtyEl) qtyEl.textContent = tc.qty;
      });
      // Additional countertop surfaces: recreate one fresh card per saved
      // surface, then replay its captured fields onto the new card's own
      // id. The material field has to go first — its onchange cascade is
      // what (re)builds the edge/addon/cutout sub-fields inside the card,
      // so every other captured field for those needs that structure to
      // already exist before it can find its element by id.
      (snapshot.surfaces || []).forEach(surfFields => {
        addSurfaceInternal(prefix);
        const newId = `s${prefix}${surfCounts[prefix]}`;
        const matField = surfFields.find(f => f.template.startsWith('mqsm-'));
        const restoreOne = f => mqRestoreFieldValue(f.template.split('§').join(newId), f.value);
        if (matField) restoreOne(matField);
        surfFields.filter(f => f !== matField).forEach(restoreOne);
        window.mqRefreshSurfBsFt(newId);
      });
      mqRefreshAllPickerVisibility(prefix);
      mqRefreshBsFt(prefix);
    }
    // ===================== end snapshot / restore =====================

    // ===================== Multi-project-type quote cart =====================
    // Lets a customer configure one project type, then switch to a totally
    // different one (or a different tab entirely) and keep building toward
    // one combined quote, instead of losing what they already priced out.
    window._mqQuoteCart = window._mqQuoteCart || [];

    // Captures whatever is currently configured on `prefix` into the running
    // cart, if it amounts to anything real — called right before that tab's
    // form gets reset, whether that's from switching project type within it
    // or switching away to a different tab. Returns true if it committed
    // something, so callers can tell whether the cart actually changed.
    window.mqCommitCurrentConfig = function(prefix) {
      const roomEl = (prefix === 'b' || prefix === 'c') ? document.getElementById(`mq-${prefix}-room`) : null;
      const actualValue = roomEl ? roomEl.value : null;

      try {
        if (!window._mqCalcCabinet || !window._mqCalcCountertop) return false;

        // calcCabinet/calcCountertop and mqShouldShowRange all read the room
        // dropdown's CURRENT live value to decide which project type's price
        // adjustments (and range/no-range setting) apply — but by the time
        // this runs (called from inside the room dropdown's own onchange),
        // the dropdown has already switched to the NEW room. Without
        // correcting for this, whatever's being committed would silently get
        // priced using the NEW project type's percentages instead of the one
        // actually being left. Temporarily rewind the dropdown to its
        // previous value for the whole calculation, then restore it to the
        // actual new selection once done.
        const prevRoomId = (window._mqPrevRoomId || {})[prefix];
        const needsRewind = !!(roomEl && prevRoomId != null && prevRoomId !== actualValue);
        if (needsRewind) roomEl.value = prevRoomId;

        let result, label, showRange, formSnapshot, roomId;
        try {
          if (prefix === 'b') {
            const cab = window._mqCalcCabinet('b');
            const ct = window._mqCalcCountertop('b');
            const low = (cab.low||0) + (ct.low||0), high = (cab.high||0) + (ct.high||0), total = (cab.total||0) + (ct.total||0);
            if (low <= 0 && high <= 0 && total <= 0) return false;
            result = { low, high, total, lines: [...cab.lines.filter(l=>!l.bold), ...ct.lines.filter(l=>!l.bold)] };
            label = cab.roomLabel || 'Cabinets + Countertops';
          } else if (prefix === 'ct') {
            const r = window._mqCalcCountertop('ct');
            if ((r.low||0) <= 0 && (r.high||0) <= 0 && (r.total||0) <= 0) return false;
            result = r;
            label = 'Countertops';
          } else {
            const r = window._mqCalcCabinet('c');
            if ((r.low||0) <= 0 && (r.high||0) <= 0 && (r.total||0) <= 0) return false;
            result = r;
            label = r.roomLabel || 'Cabinets';
          }
          showRange = mqShouldShowRange(prefix);
          roomId = roomEl ? roomEl.value : null;
          formSnapshot = mqSnapshotFormState(prefix);
        } finally {
          if (needsRewind) roomEl.value = actualValue;
        }

        window._mqQuoteCart.push({
          id: 'cart_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          label, prefix, roomId, formSnapshot,
          showRange,
          low: result.low, high: result.high, total: result.total,
          lines: result.lines,
        });
        // The value just committed above is now a real cart entry — clear
        // the live preview immediately rather than waiting for the next
        // debounced recalc, or the breakdown would briefly double-count it
        // as both the new entry AND the stale still-showing preview.
        window._mqLivePreview = null;
        mqRenderQuoteCart();
        return true;
      } finally {
        // ALWAYS keep this in sync with the dropdown's actual current value,
        // regardless of whether a commit happened — this is what the NEXT
        // switch rewinds to, so it must reflect reality even on a switch
        // that had nothing to commit. A native <select> that already has
        // focus does NOT refire the 'focus' event on later selections, so
        // relying on that alone (the original approach) went stale after
        // the very first switch — every switch after that would silently
        // rewind to the wrong room, corrupting both the price (wrong
        // room's adjustment %) and the label on every entry from then on.
        if (roomEl) {
          window._mqPrevRoomId = window._mqPrevRoomId || {};
          window._mqPrevRoomId[prefix] = actualValue;
        }
      }
    }

    window.mqRemoveFromQuoteCart = function(cartId) {
      window._mqQuoteCart = (window._mqQuoteCart || []).filter(e => e.id !== cartId);
      mqRenderQuoteCart();
    };

    window.mqRenderQuoteCart = function() {
      const cart = window._mqQuoteCart || [];
      const preview = window._mqLivePreview || null;
      // Combined for display/total purposes only — the live preview is
      // never added to the real cart array itself, so a room that never
      // ends up with any value never gets committed just for being looked
      // at, and switching away from an empty tab correctly commits nothing.
      const allEntries = preview ? [...cart, preview] : cart;

      const buildRows = (textColor, mutedColor) => allEntries.map(entry => {
        const priceText = entry.showRange ? fmtRange(entry.low, entry.high) : (CUR() + Math.round(entry.total).toLocaleString());
        const isPreview = !entry.id; // committed entries always have an id; the live preview never does
        const removeBtn = isPreview ? '' : `<button type="button" onclick="mqRemoveFromQuoteCart('${entry.id}')" title="Remove" style="background:none;border:none;color:${mutedColor};cursor:pointer;font-size:13px;padding:0 2px;line-height:1">✕</button>`;
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;font-size:13.5px;color:${textColor}${isPreview ? ';font-style:italic;opacity:0.85' : ''}">
          <span>${entry.label}</span>
          <span style="display:flex;align-items:center;gap:8px">
            <strong>${priceText}</strong>
            ${removeBtn}
          </span>
        </div>`;
      }).join('');

      const totalLow = allEntries.reduce((s,e) => s + (e.low||0), 0);
      const totalHigh = allEntries.reduce((s,e) => s + (e.high||0), 0);
      const totalExact = allEntries.reduce((s,e) => s + (e.total||0), 0);
      // If every entry (committed AND the live preview) is on a no-range
      // project type, show one clean combined number. If even one has a
      // range, fall back to a combined range — mixing a bare number with
      // ranged entries would be misleading either way, so a combined range
      // is the safer default once more than one project type is involved.
      const allNoRange = allEntries.length > 0 && allEntries.every(e => !e.showRange);
      const totalText = allNoRange ? (CUR() + Math.round(totalExact).toLocaleString()) : fmtRange(totalLow, totalHigh);

      // The sticky bar is created lazily (only once a Calculate has ever
      // run), so these elements may not exist yet the first time this runs
      // — that's fine, mqShowStickyBar re-triggers this once they do.
      const stickyToggle = document.getElementById('mq-sticky-breakdown-toggle');
      const stickyBreakdown = document.getElementById('mq-sticky-breakdown');
      const stickyPrice = document.getElementById('mq-sticky-price');
      if (stickyToggle) stickyToggle.style.display = allEntries.length ? 'inline' : 'none';
      if (stickyBreakdown) {
        if (!allEntries.length) {
          stickyBreakdown.style.display = 'none';
          stickyBreakdown.innerHTML = '';
          // Nothing in the breakdown to show a total in, so the top-left
          // price is the only number on screen — keep it visible.
          if (stickyPrice) stickyPrice.style.display = 'inline-block';
        } else {
          stickyBreakdown.style.display = 'block';
          if (stickyToggle) stickyToggle.textContent = '▴ Hide breakdown';
          // The breakdown's own Total row (below) shows the same number as
          // the top-left price — once the breakdown is open that would be
          // a duplicate, so hide the top-left one and let the Total row do
          // the job as the one visible total. mqToggleStickyBreakdown keeps
          // this in sync if the customer manually collapses the panel.
          if (stickyPrice) stickyPrice.style.display = 'none';
          stickyBreakdown.innerHTML = buildRows('rgba(255,255,255,0.92)', 'rgba(255,255,255,0.5)')
            + `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0 0;margin-top:6px;border-top:1px solid rgba(255,255,255,0.25);color:#fff"><span style="font-size:13.5px;font-weight:700">Total</span><span style="font-size:20px;font-weight:800">${totalText}</span></div>`
            + `<div style="display:flex;align-items:center;justify-content:space-between;padding-top:6px"><button type="button" onclick="mqScrollToTop()" style="background:none;border:none;font-size:11px;color:rgba(255,255,255,0.6);text-decoration:underline;cursor:pointer;font-family:inherit;padding:0">↑ Back to top</button><button type="button" onclick="mqResetEntireQuote()" style="background:none;border:none;font-size:11px;color:rgba(255,255,255,0.6);text-decoration:underline;cursor:pointer;font-family:inherit;padding:0">↺ Reset quote</button></div>`;
        }
        mqAdjustWidgetBottomPadding();
      }
    }

    // "Back to top" link on the sticky bar's breakdown, next to Reset quote.
    // Jumps to the active tab's project-type picker (Project basics, step
    // 1) when that tab has one — Cabinets and Both both do; Countertops
    // doesn't, so it falls back to the top of that tab's own content.
    // Reuses mqScrollWithOffset so a shop site's own sticky header doesn't
    // cover the landing spot.
    window.mqScrollToTop = function() {
      const prefix = window._mqActiveTabPrefix || 'b';
      const tabId = prefix === 'b' ? 'mq-tab-both' : (prefix === 'ct' ? 'mq-tab-countertops' : 'mq-tab-cabinets');
      const target = document.getElementById(`mq-${prefix}-room`) || document.getElementById(tabId) || document.getElementById('midasquote-widget');
      mqScrollWithOffset(target, 80);
    };

    // Clears the whole running quote and resets every tab's form back to
    // its starting state, so the customer can start completely over.
    window.mqResetEntireQuote = function() {
      if ((window._mqQuoteCart||[]).length && !confirm('Clear your whole quote and start over?')) return;
      window._mqQuoteCart = [];
      window._mqLivePreview = null;
      mqRenderQuoteCart();
      mqResetCabinetForm('c');
      mqResetCabinetForm('b');
      mqResetCountertopStandalone('ct');
      const sticky = document.getElementById('mq-sticky-bar');
      if (sticky) sticky.classList.remove('show');
    };
    // ===================== end quote cart =====================

    // Only an actual project type change restarts the guided flow at step 1
    // — mqRefreshSectionVisibility itself gets called from other places too
    // (like adding a tall cabinet card), which should refresh what's showing
    // without yanking someone back to the beginning of the flow.
    window.mqOnProjectTypeChange = function(prefix) {
      // mqCommitCurrentConfig already ran for this switch — it's the FIRST
      // thing in the room dropdown's onchange, specifically so it captures
      // the old room's full state (including specialty items) before
      // mqRefreshRoomVisibility gets a chance to zero out anything not
      // visible in the new room. Calling it again here would just find an
      // already-reset form with nothing left to commit.
      _mqStepIndex[prefix] = 0;

      // If the project type being switched TO already has a committed cart
      // entry, pull it back out and restore exactly what was configured
      // instead of resetting to blank — otherwise typing in a new number
      // here would just tack on as a second, duplicate entry rather than
      // actually editing the original one.
      const newRoomId = gv(`mq-${prefix}-room`);
      const existingIdx = (window._mqQuoteCart||[]).findIndex(e => e.prefix === prefix && e.roomId != null && e.roomId === newRoomId);
      const restoreSnapshot = existingIdx >= 0 ? window._mqQuoteCart[existingIdx].formSnapshot : null;
      if (existingIdx >= 0) {
        window._mqQuoteCart.splice(existingIdx, 1);
        mqRenderQuoteCart();
      }

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
          if (installQty[prefix]) installQty[prefix][i] = 0;
          const installQtyInput = document.getElementById(`mq-installqty-${prefix}-${i}`);
          if (installQtyInput) installQtyInput.value = 0;
          const installQtyRow = document.getElementById(`mq-spec-installqty-${prefix}-${i}`);
          if (installQtyRow) installQtyRow.style.display = 'none';
          // A variant choice made under a completely different, unrelated
          // project type shouldn't silently carry over either — back to
          // the default (first) variant, same reasoning as qty/mode above.
          if (specVariant[prefix] && specVariant[prefix][i] !== 0 && specs[i] && specs[i].variants && specs[i].variants.length) {
            window.mqPickSpecVariant(prefix, i, 0);
          }
        });
      }
      mqRefreshSectionVisibility(prefix);
      if (restoreSnapshot) mqRestoreFormState(prefix, restoreSnapshot);
      mqRefreshBallparkWording(prefix);
      if (window._mqStickyPrefix === prefix) mqUpdateLivePreview(prefix);
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
    function mqMarkSuggestedChip(selectId, matchKeys) {
      document.querySelectorAll(`[data-vpicker-for="${selectId}"]`).forEach(c => c.classList.remove('mq-suggested'));
      const keys = Array.isArray(matchKeys) ? matchKeys : (matchKeys ? [matchKeys] : []);
      keys.forEach(matchKey => {
        const chip = document.querySelector(`[data-vpicker-for="${selectId}"][data-value="${matchKey}"]`);
        if (chip) chip.classList.add('mq-suggested');
      });
    }

    window.mqApplyLinkedTrim=(prefix, doorKey)=>{
      const crownSelect=document.getElementById(`mq-${prefix}-trim-crown`);
      const valanceSelect=document.getElementById(`mq-${prefix}-trim-valance`);
      if(!crownSelect && !valanceSelect) return; // shop has no trim styles configured
      // Crown/valance visibility is now driven entirely by which doors
      // they're linked to (see mqRefreshAllPickerVisibility's door-linkage
      // check) — switching doors just needs to re-run that filter. If the
      // customer's current pick no longer applies to the new door, that
      // same function's existing auto-select-fallback picks a valid
      // replacement automatically, same as it already does for room changes.
      window.mqRefreshAllPickerVisibility(prefix);
      mqTogTrimReturns(prefix);

      // Small confirmation note above both fields — not a suggestion among
      // alternatives anymore (everything shown IS already matched to this
      // door), just a quick reassurance that what's showing was narrowed
      // down deliberately, not just however it happened to be listed.
      const note = document.getElementById(`mq-${prefix}-trim-auto-note`);
      if (note) {
        const doorItem = doorKey && doorKey !== 'none' ? (li.doorStyles||[])[parseInt(doorKey.replace('dyn_',''),10)] : null;
        const doorName = doorItem ? doorItem['Name'] : '';
        const crownWrap = document.getElementById(`mq-${prefix}-crown-field-wrap`);
        const valanceWrap = document.getElementById(`mq-${prefix}-valance-field-wrap`);
        const crownShowing = crownWrap && crownWrap.style.display !== 'none';
        const valanceShowing = valanceWrap && valanceWrap.style.display !== 'none';
        if (doorName && (crownShowing || valanceShowing)) {
          const parts = [];
          if (crownShowing) parts.push('crown');
          if (valanceShowing) parts.push('valance');
          const partsText = parts.join(' & ');
          note.textContent = `✅ ${partsText.charAt(0).toUpperCase()+partsText.slice(1)} options below are matched to your ${doorName} door style`;
          note.style.display = 'block';
        } else {
          note.style.display = 'none';
        }
      }
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
      if(el) { el.value=specQty[prefix][i]; el.dispatchEvent(new Event('input', { bubbles: true })); }
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

    // Handles a click on one variant chip (e.g. picking "Oak" under a
    // "Crown Molding" item). Mutates the same `s` object specs[i] already
    // points at — its price/photoUrl/badge/featured now reflect the chosen
    // variant — so calcCabinet's pricing loop and the quantity controls
    // below need no awareness that variants exist at all; they just keep
    // reading s.price like they always have. Only the visual thumb/badge
    // block and the picker's own selected-chip highlight need a DOM update.
    window.mqPickSpecVariant = function(prefix, i, vi) {
      const s = specs[i];
      const v = s && s.variants && s.variants[vi];
      if (!v) return;
      specVariant[prefix][i] = vi;
      s.price = v.price || 0;
      s.minPrice = v.min || 0;
      s.photoUrl = v.photoUrl || '';
      s.featured = !!v.featured;
      s.badge = v.badge || '';
      s.variantLabel = v.label || '';
      const visual = document.getElementById(`mq-spec-visual-${prefix}-${i}`);
      if (visual) visual.innerHTML = mqSpecVisualHTML(s, visual.dataset.groupKey || '', `mq-sp-${prefix}-${i}`);
      const row = document.getElementById(`mq-spec-variants-${prefix}-${i}`);
      if (row) {
        row.querySelectorAll('.mq-vpicker-variant-chip').forEach((chip, idx) => {
          chip.classList.toggle('selected', idx === vi);
        });
      }
    };

    // Shows/hides the extra install-quantity row (only rendered at all when
    // install's pricing method differs from supply's — see installDiffers
    // above) based on whether "Supplied & Installed" is the actual chosen
    // mode. Wired to the mode <select>'s onchange.
    window.mqSpecModeChanged = function(prefix, i) {
      const row = document.getElementById(`mq-spec-installqty-${prefix}-${i}`);
      if (!row) return; // this item's install method matches supply's — nothing extra to ask
      const sel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
      row.style.display = (sel && sel.value === 'install') ? 'block' : 'none';
    };
    window.mqAdjInstallQty=(prefix,i,d)=>{
      const allowDecimal = specs[i] && (specs[i].installPerFt || specs[i].installPerSqFt);
      let next = Math.max(0, (installQty[prefix][i]||0) + d);
      if (allowDecimal) next = Math.round(next * 10) / 10;
      installQty[prefix][i]=next;
      const el=document.getElementById(`mq-installqty-${prefix}-${i}`);
      if(el) { el.value=installQty[prefix][i]; el.dispatchEvent(new Event('input', { bubbles: true })); }
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
            <div style="display:flex;align-items:center">
              <input type="number" id="mq-tc-width-${id}" value="24" min="12" max="48" onblur="mqValidateTallCabWidth('${id}')" style="width:100px"/>
              ${calcBtn(`mq-tc-width-${id}`, 'inches', 'Tall cabinet width')}
            </div>
            <div id="mq-tc-width-note-${id}" style="display:none;font-size:11px;font-weight:600;color:#dc2626;margin-top:3px">Must be 12" or wider.</div>
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
    // Reverts to 12" and shows a brief note if someone types anything
    // narrower — the min attribute alone doesn't actually stop manual
    // typing, it only affects the native spinner arrows.
    window.mqValidateTallCabWidth = function(id) {
      const input = document.getElementById(`mq-tc-width-${id}`);
      const note = document.getElementById(`mq-tc-width-note-${id}`);
      if (!input) return;
      const val = parseFloat(input.value);
      if (isNaN(val) || val < 12) {
        input.value = 12;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (note) {
          note.style.display = 'block';
          clearTimeout(note._mqHideTimer);
          note._mqHideTimer = setTimeout(() => { note.style.display = 'none'; }, 4000);
        }
      }
    };
    window.mqRemoveTallCab=(prefix,id)=>{
      document.getElementById(`mq-tc-card-${id}`)?.remove();
      delete tallCabs[prefix][id];
      renumberTallCabs(prefix);
    };
    window.mqAdjTallCabQty=(prefix,id,d)=>{
      tallCabs[prefix][id]=Math.max(0,(tallCabs[prefix][id]||0)+d);
      const el=document.getElementById(`mq-tc-qty-${id}`);
      if(el) el.textContent=tallCabs[prefix][id];
      mqScheduleLiveRecalc();
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
      // No scrolling needed — this is now a body-level position:fixed
      // overlay, so it already appears centered in whatever the current
      // viewport is, wherever the customer happens to be scrolled to.
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
    // Free Demo tier: quoting itself is now locked (not just watermarked) —
    // an expired-trial shop can still be browsed/configured so the widget
    // doesn't look broken on the shop's site, but hitting any Calculate
    // button shows this instead of the lead-capture step, so no lead is
    // ever captured and no numbers are ever revealed for a Demo shop.
    window.mqShowDemoLockedModal=()=>{
      document.getElementById('mq-demo-locked-overlay')?.classList.add('show');
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
      if(bFt>0) lines.push({label:`Base cabinets — ${bMat.label} / ${bDoorLabel} (${bFt} lin ft)`,cost:Math.round(bMatCost-(drawerRate*bFt))});
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
        // A tiny order can still cost the shop full price to make (a small
        // door takes a full sheet and the same labor as a bigger one) — the
        // minimum only applies to size-based items (perFt/perSqFt), same as
        // the dashboard only shows the field then.
        let supplyCost = s.price * supplyQty;
        if ((s.perFt || s.perSqFt) && s.minPrice > 0) supplyCost = Math.max(supplyCost, s.minPrice);
        const supplyQtyLabel = s.perSqFt?`${supplyQty} sqft`:(s.perFt?`${supplyQty} ft`:(supplyQty>1?`× ${supplyQty}`:''));
        // Fold the currently-picked variant's own name into the line-item
        // text (e.g. "Crown Molding — Oak") so the actual quote/lead always
        // says which option was chosen — items with no variants are
        // completely unaffected (itemLabel === s.label).
        const itemLabel = s.variantLabel ? `${s.label} — ${s.variantLabel}` : s.label;

        if (!s.offersInstallChoice) {
          specTotal += supplyCost;
          lines.push({label:supplyQtyLabel?`${itemLabel} (${supplyQtyLabel})`:itemLabel,cost:Math.round(supplyCost)});
          return;
        }

        const modeSel = document.getElementById(`mq-spec-mode-${prefix}-${i}`);
        const mode = modeSel ? modeSel.value : 'supply';
        if (mode !== 'install') {
          specTotal += supplyCost;
          lines.push({label:supplyQtyLabel?`${itemLabel} (${supplyQtyLabel}) — Supply only`:`${itemLabel} — Supply only`,cost:Math.round(supplyCost)});
          return;
        }

        // Install price is its own rate, never a replacement for supply —
        // "6 sqft supply + 12 sqft install" means both get charged and
        // added together, not one overriding the other. Two separate line
        // items too, so the customer can actually see the math instead of
        // one merged, unexplained number.
        const supplyKind = s.perFt ? 'linear' : (s.perSqFt ? 'sqft' : 'item');
        const installKind = s.installPerFt ? 'linear' : (s.installPerSqFt ? 'sqft' : 'item');
        const installQtyVal = (installKind !== supplyKind) ? (installQty[prefix][i] || 0) : supplyQty;
        let installCost = s.installPrice * installQtyVal;
        if ((s.installPerFt || s.installPerSqFt) && s.installMinPrice > 0 && installQtyVal > 0) installCost = Math.max(installCost, s.installMinPrice);
        const installQtyLabel = s.installPerSqFt?`${installQtyVal} sqft`:(s.installPerFt?`${installQtyVal} ft`:(installQtyVal>1?`× ${installQtyVal}`:''));
        specTotal += supplyCost + installCost;
        lines.push({label:supplyQtyLabel?`${itemLabel} (${supplyQtyLabel}) — Supply`:`${itemLabel} — Supply`,cost:Math.round(supplyCost)});
        lines.push({label:installQtyLabel?`${itemLabel} (${installQtyLabel}) — Install`:`${itemLabel} — Install`,cost:Math.round(installCost)});
      });

      const remEl=document.getElementById(`mq-${prefix}-removal`);
      const remCost=remEl&&remEl.value==='yes'?(uFt+bFt)*removalRate:0;
      if(remCost>0) lines.push({label:'Cabinet removal',cost:Math.round(remCost)});

      const sub=uCost+bCost+specTotal+tallCabTotal+remCost+trimCost;
      const totalMult = (100 + totalAdjPct) / 100;
      const total = sub * totalMult;
      lines.push({label:'Subtotal (before tax)',cost:Math.round(total),bold:true});

      const low=Math.round(total*(window._mqRangeLow||0.95)/10)*10, high=Math.round(total*(window._mqRangeHigh||1.20)/10)*10;
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

      // Minimum charges pool PER MATERIAL, across every counter/run using
      // that material in this one project type (the cabinet-run measure
      // block below and every surface in the loop after it) — not per
      // individual counter. e.g. three small counters in the same quote,
      // same material, $100/lin ft install and a $150 minimum: their real
      // install costs add up first, and the $150 floor is only applied
      // once to that combined total if it's still short — not three
      // separate $150 minimums. A different project type (a separate call
      // to calcCountertop) starts its own pool from zero, same as before.
      const minPools = {};
      function poolFor(matKey, m) {
        if (!minPools[matKey]) minPools[matKey] = { m, rawSupply:0, rawInstall:0, hasSupply:false, hasInstall:false };
        return minPools[matKey];
      }

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
          const m     = mat === 'none' ? null : (CT_MAT[mat] || null);
          if (m) {
            // Real (unclamped) cost for this run — the minimum, if any, is
            // applied once at the end against this material's pooled total
            // across every counter/run in this project type, not here.
            const supplyCost = m.supplyUnit  === 'lin ft' ? linFt*m.ps : sqft*m.ps;
            const installCost = si==='install' ? (m.installUnit==='lin ft' ? linFt*m.pi : sqft*m.pi) : 0;
            const pool = poolFor(mat, m);
            pool.rawSupply += supplyCost; pool.hasSupply = true;
            if (si==='install') { pool.rawInstall += installCost; pool.hasInstall = true; }
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
            const addonsRes = ctAddonsCost(m, `mq-${prefix}-cab-edge-sel`, `mq-${prefix}-cab-addons-a`, linFt, sqft, ctDepth);
            const cost = supplyCost + installCost + bsCost + cutoutCost + addonsRes.cost;
            sub += cost;
            lines.push({label:`Cabinet run — ${m.label} (${linFt} lin ft, ~${Math.round(sqft*10)/10} sqft) · ${si==='install'?'Supply + install':'Supply only'}${(bsOpt&&bsLinFt>0)?` + backsplash (${bsOpt.label}, ${bsLinFt} lin ft)`:''}${addonsRes.labelParts.length?` + ${addonsRes.labelParts.join(', ')}`:''}`, cost:Math.round(cost)});
          }
        }
      }

      Object.keys(surfs[prefix]).forEach(id=>{
        if(!document.getElementById('mqsc-'+id)) return;
        const mat=gv('mqsm-'+id);
        if (mat === 'none') return; // customer explicitly chose no countertop for this surface
        const siOv=gv('mqssi-'+id), si=siOv==='inherit'?gv(ctSiId):(siOv||'supply');
        const m=CT_MAT[mat]||null;
        if (!m) return;
        const w=gn('mqsw-'+id,0), d=gn('mqsd-'+id,ctDepth);
        const sqft=(w*(d||ctDepth))/144;
        const linFt=w/12;
        // Real (unclamped) cost for this surface — pooled into this
        // material's running total below, same as the cabinet-run block
        // above, so the minimum (if any) applies once across every counter
        // of this material rather than per surface. Only pooled once the
        // customer has actually entered a size (w > 0) — a surface card
        // added but still at its default 0 width shouldn't nudge the pool
        // toward a minimum charge for a counter that isn't really there yet.
        const supplyCost = m.supplyUnit  === 'lin ft' ? linFt*m.ps : sqft*m.ps;
        const installCost = si==='install' ? (m.installUnit==='lin ft' ? linFt*m.pi : sqft*m.pi) : 0;
        if (w > 0) {
          const pool = poolFor(mat, m);
          pool.rawSupply += supplyCost; pool.hasSupply = true;
          if (si==='install') { pool.rawInstall += installCost; pool.hasInstall = true; }
        }
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
        const addonsRes = ctAddonsCost(m, `mqs-edge-${id}-sel`, `mqs-addons-${id}-a`, linFt, sqft, d||ctDepth);
        const totalCost = cost + addonsRes.cost;
        sub+=totalCost;
        lines.push({label:`${gv('mqsn-'+id)||'Surface'} — ${m.label} (${Math.round(sqft*10)/10} sqft, ${Math.round(linFt*10)/10} lin ft) · ${si==='install'?'Supply + install':'Supply only'}${(bsOpt&&bsLinFt>0)?` + backsplash (${bsOpt.label}, ${Math.round(bsLinFt*10)/10} lin ft)`:''}${addonsRes.labelParts.length?` + ${addonsRes.labelParts.join(', ')}`:''}`,cost:Math.round(totalCost)});
      });

      // Settle every material's minimum against its pooled total from
      // every counter/run above — every real counter's own line already
      // shows its true cost, so this only adds a line (and the difference
      // to sub) when the combined total across that material's counters
      // still falls short of the shop's minimum.
      Object.values(minPools).forEach(pool => {
        if (pool.hasSupply && pool.m.min > 0 && pool.rawSupply < pool.m.min) {
          const adj = pool.m.min - pool.rawSupply;
          sub += adj;
          lines.push({label:`${pool.m.label} — minimum charge (supply)`, cost:Math.round(adj)});
        }
        if (pool.hasInstall && pool.m.installMin > 0 && pool.rawInstall < pool.m.installMin) {
          const adj = pool.m.installMin - pool.rawInstall;
          sub += adj;
          lines.push({label:`${pool.m.label} — minimum charge (install)`, cost:Math.round(adj)});
        }
      });

      lines.push({label:'Subtotal (before tax)',cost:Math.round(sub),bold:true});
      const total=sub;
      return {lines,sub:Math.round(sub),total:Math.round(total),low:Math.round(total*(window._mqRangeLow||0.95)/10)*10,high:Math.round(total*(window._mqRangeHigh||1.20)/10)*10};
    }

    function renderResult(rangeEl,listEl,result,prefix){
      mqRefreshBallparkWording(prefix);
      document.getElementById(rangeEl).textContent=mqFmtPrice(prefix, result.low, result.high, result.total);
      const ul=document.getElementById(listEl);ul.innerHTML='';
      const sorted=[...result.lines].filter(l=>!l.bold).sort((a,b)=>b.cost-a.cost);
      sorted.forEach(l=>{
        const li=document.createElement('li');
        li.innerHTML=`<span class="mq-li-lbl">✓ ${l.label}</span>`;
        ul.appendChild(li);
      });
    }
    // Refreshes the full results breakdown for whichever tab is currently
    // showing one — reuses the exact same calc + render logic Calculate
    // itself uses, just skipping the lead popup/loading spinner/scroll.
    // Only touches a tab's results panel if it's actually visible (no point
    // silently rebuilding a hidden panel on every keystroke elsewhere), and
    // returns the new range so the sticky bar can stay in sync off the same
    // single calculation pass rather than computing everything twice.
    window._mqRefreshResultsPanel = function(prefix) {
      if (prefix === 'c') {
        const panel = document.getElementById('mq-c-result');
        if (!panel || !panel.classList.contains('show')) return null;
        const r = calcCabinet('c');
        const titleEl = document.getElementById('mq-c-res-title');
        if (titleEl) titleEl.textContent = r.roomLabel + ' cabinet estimate';
        const subEl = document.getElementById('mq-c-res-sub');
        if (subEl) subEl.textContent = `${r.uFt} ft uppers · ${r.bFt} ft bases · ${r.si==='install'?'Supply + install':'Supply only'}`;
        renderResult('mq-c-res-range','mq-c-line-items', r, 'c');
        mqUpdateFinancingBox('c', r.low, r.high, r.total);
        return { low: r.low, high: r.high, total: r.total, label: r.roomLabel };
      }
      if (prefix === 'ct') {
        const panel = document.getElementById('mq-ct-result');
        if (!panel || !panel.classList.contains('show')) return null;
        const r = calcCountertop('ct');
        const active = Object.keys(surfs['ct']).filter(id => document.getElementById('mqsc-'+id)).length;
        const subEl = document.getElementById('mq-ct-res-sub');
        if (subEl) subEl.textContent = `${active} surface(s)`;
        renderResult('mq-ct-res-range','mq-ct-line-items', r, 'ct');
        mqUpdateFinancingBox('ct', r.low, r.high, r.total);
        return { low: r.low, high: r.high, total: r.total, label: 'Countertops' };
      }
      if (prefix === 'b') {
        const panel = document.getElementById('mq-b-result');
        if (!panel || !panel.classList.contains('show')) return null;
        const cab = calcCabinet('b'), ct = calcCountertop('b');
        const cabRows = document.getElementById('mq-b-cab-rows');
        if (cabRows) {
          cabRows.innerHTML = '';
          [...cab.lines].filter(l=>!l.bold).sort((a,b)=>b.cost-a.cost).forEach(l=>{const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">✓ ${l.label}</span>`;cabRows.appendChild(d);});
        }
        const ctRows = document.getElementById('mq-b-ct-rows');
        if (ctRows) {
          ctRows.innerHTML = '';
          [...ct.lines].filter(l=>!l.bold).sort((a,b)=>b.cost-a.cost).forEach(l=>{const d=document.createElement('div');d.className='mq-combined-row';d.innerHTML=`<span class="mq-clbl">✓ ${l.label}</span>`;ctRows.appendChild(d);});
          if (!ctRows.children.length) { const d=document.createElement('div'); d.className='mq-combined-row'; d.innerHTML=`<span class="mq-clbl">None selected</span>`; ctRows.appendChild(d); }
        }
        const tl = cab.low+ct.low, th = cab.high+ct.high, totalB = cab.total+ct.total;
        const grandEl = document.getElementById('mq-b-grand');
        if (grandEl) { mqRefreshBallparkWording('b'); grandEl.textContent = mqFmtPrice('b', tl, th, totalB); }
        mqUpdateFinancingBox('b', tl, th, totalB);
        return { low: tl, high: th, total: totalB, label: cab.roomLabel || 'Cabinets + Countertops' };
      }
      return null;
    };

    window.mqCalcCabinets=()=>{
      if (window._mqIsDemoPlan) { window.mqShowDemoLockedModal(); return; }
      if (!mqValidateInstallQty('c')) return;
      if (!mqValidateNotEmpty('c', calcCabinet('c'))) return;
      window.mqShowLead(async lead=>{
        window._mqLeadEmail = (lead && !lead._isSkip && lead.email) ? lead.email : (window._mqLeadEmail || '');
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
        renderResult('mq-c-res-range','mq-c-line-items',r,'c');
        mqUpdateFinancingBox('c', r.low, r.high, r.total);
        window.mqShowStickyBar('c', r.low, r.high, r.total);
        document.getElementById('mq-c-loading').classList.remove('show');
        document.getElementById('mq-c-result').classList.add('show');mqScrollResultsIntoView('c');
        document.getElementById('mq-c-calc-btn').disabled=false;
        if(lead) await mqSaveLeadWithCart(data,lead,'Cabinets',r.low,r.high,r.lines,r.roomLabel,r.total,'c');
      });
    };

    window.mqCalcCountertops=()=>{
      if (window._mqIsDemoPlan) { window.mqShowDemoLockedModal(); return; }
      const hasSurfaces=Object.keys(surfs['ct']).filter(id=>document.getElementById('mqsc-'+id)).length>0;
      if(!hasSurfaces){alert('Please add at least one surface.');return;}
      if (!mqValidateNotEmpty('ct', calcCountertop('ct'))) return;
      window.mqShowLead(async lead=>{
        window._mqLeadEmail = (lead && !lead._isSkip && lead.email) ? lead.email : (window._mqLeadEmail || '');
        document.getElementById('mq-ct-calc-btn').disabled=true;
        document.getElementById('mq-ct-loading').classList.add('show');
        document.getElementById('mq-ct-result').classList.remove('show');
        setTimeout(async()=>{
          const r=calcCountertop('ct');
          const active=Object.keys(surfs['ct']).filter(id=>document.getElementById('mqsc-'+id)).length;
          document.getElementById('mq-ct-res-sub').textContent=`${active} surface(s)`;
          renderResult('mq-ct-res-range','mq-ct-line-items',r,'ct');
          mqUpdateFinancingBox('ct', r.low, r.high, r.total);
          window.mqShowStickyBar('ct', r.low, r.high, r.total);
          document.getElementById('mq-ct-loading').classList.remove('show');
          document.getElementById('mq-ct-result').classList.add('show');mqScrollResultsIntoView('ct');
          document.getElementById('mq-ct-calc-btn').disabled=false;
          if(lead) await mqSaveLeadWithCart(data,lead,'Countertops',r.low,r.high,r.lines,'',r.total,'ct');
        },900);
      });
    };

    window.mqCalcBoth=()=>{
      if (window._mqIsDemoPlan) { window.mqShowDemoLockedModal(); return; }
      if (!mqValidateInstallQty('b')) return;
      const dryCab=calcCabinet('b'), dryCt=calcCountertop('b');
      if (!mqValidateNotEmpty('b', { low: dryCab.low+dryCt.low, high: dryCab.high+dryCt.high })) return;
      window.mqShowLead(async lead=>{
        window._mqLeadEmail = (lead && !lead._isSkip && lead.email) ? lead.email : (window._mqLeadEmail || '');
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
          const tl=cab.low+ct.low,th=cab.high+ct.high,totalB=cab.total+ct.total;
          mqRefreshBallparkWording('b');
          document.getElementById('mq-b-grand').textContent=mqFmtPrice('b', tl, th, totalB);
          mqUpdateFinancingBox('b', tl, th, totalB);
          window.mqShowStickyBar('b', tl, th, totalB);
          document.getElementById('mq-b-loading').classList.remove('show');
          document.getElementById('mq-b-result').classList.add('show');mqScrollResultsIntoView('b');
          document.getElementById('mq-b-calc-btn').disabled=false;
          if(lead) await mqSaveLeadWithCart(data,lead,'Cabinets + Countertops',tl,th,[{label:'Cabinets',header:true},...cab.lines,{label:'Countertops',header:true},...ct.lines],cab.roomLabel,totalB,'b');
        },1200);
      });
    };

    function addSurfaceInternal(prefix,name){
      surfCounts[prefix]++;
      const id=`s${prefix}${surfCounts[prefix]}`;
      surfs[prefix][id]=1;
      const hasCtInstall = hasCountertopInstall();
      const n=name||`Surface ${surfCounts[prefix]}`;
      const containerId=prefix==='ct'?'mq-ct-surfaces':'mq-'+prefix+'-ct-surfaces';
      const card=document.createElement('div');
      card.className='mq-surface-card';card.id='mqsc-'+id;
      card.innerHTML=`
        <div class="mq-surface-header">
          <div class="mq-surface-num">${surfCounts[prefix]}</div>
          <input id="mqsn-${id}" value="${n}" style="font-size:16px;font-weight:500;color:#111;background:none;border:none;outline:none;flex:1;font-family:inherit"/>
          <button class="mq-remove-btn" onclick="mqRemoveSurf('${prefix}','${id}')">Remove</button>
        </div>
        <div class="mq-grid3" style="margin-bottom:1rem">
          <div class="mq-field"><label class="mq-label">Width (inches)</label><div style="display:flex;align-items:center"><input type="number" id="mqsw-${id}" placeholder="e.g. 120" oninput="mqCalcSurfDims('${id}')" style="flex:1;min-width:0"/>${calcBtn(`mqsw-${id}`, 'inches', 'Surface width')}</div></div>
          <div class="mq-field"><label class="mq-label">Depth (inches)</label><div style="display:flex;align-items:center"><input type="number" id="mqsd-${id}" placeholder="${ctDepth}" value="${ctDepth}" oninput="mqCalcSurfDims('${id}')" style="flex:1;min-width:0"/>${calcBtn(`mqsd-${id}`, 'inches', 'Surface depth')}</div></div>
          <div class="mq-field"><label class="mq-label" style="color:#16a34a">Auto-calculated</label>
            <div style="font-size:14px;color:#4b5563;padding:7px 0" id="mqsdims-${id}">Enter width & depth</div></div>
        </div>
        <div class="mq-field" style="margin-bottom:0.75rem"><label class="mq-label">${hasCtInstall ? 'Install' : 'Supply'}</label>
          <select id="mqssi-${id}" style="width:100%;min-width:160px;box-sizing:border-box">${hasCtInstall ? `${prefix==='ct'?'':'<option value="inherit">Same as project</option>'}<option value="supply">Supply only</option><option value="install">Supply + install</option>` : '<option value="supply">Supply only</option>'}</select></div>
        <div class="mq-field" style="margin-bottom:1rem"><label class="mq-label">Material</label>
          ${pickerRow(`mqsm-${id}`, ctMatItems(), null, 'countertop')}
          <select id="mqsm-${id}" onchange="mqRefreshBsOpts('mqsm-${id}','mqsbs-${id}');mqRefreshCutoutOpts('mqsm-${id}','mqscuts-${id}');mqRefreshCtAddons('mqsm-${id}','mqs-edge-${id}','mqs-addons-${id}');mqRefreshSurfBsFt('${id}')" style="display:none">${ctMatOpts()}</select></div>
        <div id="mqs-edge-${id}"></div>
        <div id="mqs-addons-${id}"></div>
        <div class="mq-divider"></div>
        <label class="mq-check-row"><input type="checkbox" id="mqsco-${id}" onchange="mqTogCuts('${id}')" style="width:16px;height:16px;flex-shrink:0;accent-color:#1a1a1a"/> Cutouts needed (sink, etc.)</label>
        <div id="mqscuts-${id}" style="display:none;margin-top:8px;margin-bottom:0.75rem;padding:10px 12px;background:#f9fafb;border-radius:6px"></div>
        <div class="mq-field" style="margin-bottom:0.75rem">
          <label class="mq-label">Backsplash</label>
          <select id="mqsbs-${id}" style="min-width:160px" onchange="mqRefreshSurfBsFt('${id}')"><option value="none">None</option></select>
        </div>
        <div id="mqs-bsft-block-${id}" style="display:none;margin-top:8px;padding:10px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px">
          <div style="font-size:14px;color:#166534;margin-bottom:8px">Backsplash linear footage (auto): <strong id="mqs-bsft-auto-${id}">0</strong> ft — based on the width above.</div>
          <div style="font-size:14px;color:#166534;margin-top:8px">Backsplash footage used: <strong id="mqs-bsft-net-${id}">0</strong> ft</div>
        </div>`;
      document.getElementById(containerId)?.appendChild(card);
      window.mqRefreshBsOpts(`mqsm-${id}`, `mqsbs-${id}`);
      window.mqRefreshCutoutOpts(`mqsm-${id}`, `mqscuts-${id}`);
      window.mqRefreshCtAddons(`mqsm-${id}`, `mqs-edge-${id}`, `mqs-addons-${id}`);
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
        window.mqRefreshCtAddons(`mq-${prefix}-ct-mat-cab`, `mq-${prefix}-cab-edge`, `mq-${prefix}-cab-addons`);
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
      if (matSel.value === 'none') { bsSel.innerHTML = '<option value="none">None</option>'; return; }
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
      if (matSel.value === 'none') { container.innerHTML = ''; return; }
      const m = CT_MAT[matSel.value] || Object.values(CT_MAT)[0];
      container.innerHTML = cutoutRowsHtml(m, `${cutsContainerId}-q`);
    };
    window.mqRefreshCtAddons=(matSelectId, edgeContainerId, addonContainerId)=>{
      const matSel = document.getElementById(matSelectId);
      const edgeEl = document.getElementById(edgeContainerId);
      const addonEl = document.getElementById(addonContainerId);
      if (!matSel) return;
      if (matSel.value === 'none') { if (edgeEl) edgeEl.innerHTML = ''; if (addonEl) addonEl.innerHTML = ''; return; }
      const m = CT_MAT[matSel.value] || Object.values(CT_MAT)[0];
      if (edgeEl) edgeEl.innerHTML = edgeSelectHtml(m, edgeContainerId);
      if (addonEl) addonEl.innerHTML = addonRowsHtml(m, `${addonContainerId}-a`);
      window.mqUpdateAllPickerArrows();
    };
    // Grows/shrinks the linear feet input to match its current value —
    // starts small for "0", widens as the number gets longer (two digits,
    // a decimal point, etc). Sets a CSS variable rather than the width
    // property directly — the base CSS rule (itself !important, needed to
    // beat the global qty-ctrl input rule) reads its width FROM this
    // variable, so there's no cascade/specificity battle to win at all;
    // the !important rule never changes, just what value it points to.
    // Exposed on window (not a plain local function) because it's called
    // from an inline oninput="" HTML attribute, which runs in the global
    // scope, not inside this closure — a local function here would never
    // actually be reachable.
    window.mqAutoSizeLinFtInput = function(input) {
      if (!input) return;
      const len = String(input.value ?? '0').length;
      const width = Math.min(96, Math.max(46, 34 + len * 12));
      input.style.setProperty('--mq-linft-w', width + 'px');
      // Some mobile browsers don't reliably re-layout a number input just
      // from a style/variable change — reading a layout property right
      // after forces a synchronous reflow instead of leaving it deferred.
      void input.offsetWidth;
    };
    window.mqAdjLinFt=(prefix, which, delta)=>{
      const input = document.getElementById(`mq-${prefix}-${which}ft`);
      if (!input) return;
      let next = Math.max(0, Math.min(60, (parseFloat(input.value)||0) + delta));
      next = Math.round(next * 10) / 10; // keep to one decimal — avoids floating-point drift
      input.value = next;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // Called directly here too, not just left to the dispatched event
      // reaching the inline oninput="" handler — one less thing that has
      // to work correctly on every mobile browser for the resize to happen.
      if (window.mqAutoSizeLinFtInput) window.mqAutoSizeLinFtInput(input);
    };
    // Holding a +/- button down repeats mqAdjLinFt automatically instead of
    // needing dozens of individual taps to reach a bigger number. A normal
    // quick tap still just fires once — the repeat only kicks in after a
    // short hold, and speeds up the longer it's held.
    let _mqLinFtHoldTimer = null, _mqLinFtHoldInterval = null, _mqLinFtHoldTicks = 0;
    window.mqLinFtHoldStart = function(prefix, which, delta, evt) {
      if (evt && evt.cancelable) evt.preventDefault(); // stop touch from also firing a synthetic click/mousedown
      window.mqLinFtHoldStop();
      mqAdjLinFt(prefix, which, delta); // fires once immediately, covers a normal tap
      _mqLinFtHoldTicks = 0;
      _mqLinFtHoldTimer = setTimeout(() => {
        _mqLinFtHoldInterval = setInterval(() => {
          mqAdjLinFt(prefix, which, delta);
          _mqLinFtHoldTicks++;
          // Speeds up the longer it's held — starts a bit deliberate, ramps
          // up for someone genuinely holding through a big number.
          if (_mqLinFtHoldTicks === 8 || _mqLinFtHoldTicks === 20) {
            clearInterval(_mqLinFtHoldInterval);
            _mqLinFtHoldInterval = setInterval(() => mqAdjLinFt(prefix, which, delta), _mqLinFtHoldTicks < 20 ? 60 : 30);
          }
        }, 110);
      }, 400);
    };
    window.mqLinFtHoldStop = function() {
      clearTimeout(_mqLinFtHoldTimer);
      clearInterval(_mqLinFtHoldInterval);
      _mqLinFtHoldTimer = null;
      _mqLinFtHoldInterval = null;
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

    // Blocks generating the estimate if a specialty item set to "Supplied &
    // Installed" is missing either quantity it needs — the main supply
    // quantity, or (when install's method differs from supply's) the
    // separate install quantity. Catches both directions: forgetting
    // install (price would silently be $0) and forgetting supply (the
    // whole item would silently drop out of the estimate entirely, since
    // that's the field that gates whether the item counts as selected at
    // all — easy to miss since the install field now sits right below it).
    // Shakes/focuses whichever field needs attention, same pattern as
    // mqSpecModeChosen.
    // Blocks Calculate if the resulting estimate would be $0 — nothing
    // meaningful was actually selected (every picker left on "None"/"No
    // doors", zero linear feet, etc). Shakes the Calculate button itself
    // rather than a specific field, since there's no single thing to point
    // to — the whole form is effectively empty.
    function mqValidateNotEmpty(prefix, result) {
      if ((result.low||0) > 0 || (result.high||0) > 0) return true;
      // Distinguish "truly nothing selected" from "picked doors/crown/etc
      // but never entered linear feet" — the second is a very easy mistake
      // (measurements are the very last step) and deserves a more specific
      // nudge than a blanket "nothing selected" message, which reads as
      // wrong when the person can see their own door/trim choices sitting
      // right there on screen.
      const cabSecEl = document.getElementById(`mq-${prefix}-cabinet-measurements-sec`);
      const cabSectionActive = !cabSecEl || cabSecEl.style.display !== 'none';
      const uFt = cabSectionActive ? gn(`mq-${prefix}-uft`,0) : 0;
      const bFt = cabSectionActive ? gn(`mq-${prefix}-bft`,0) : 0;
      const manualTrimFt = document.getElementById(`mq-${prefix}-trim-manual-toggle`)?.checked ? gn(`mq-${prefix}-trim-manual-ft`,0) : 0;
      const hasAnyLinearFeet = (uFt + bFt + manualTrimFt) > 0;
      const doorSel = diffOn[prefix]
        ? (gv(`mq-${prefix}-u-door`) || gv(`mq-${prefix}-b-door`))
        : gv(`mq-${prefix}-door`);
      const hasDoorSelection = doorSel && doorSel !== 'none';
      const crownSel = gv(`mq-${prefix}-trim-crown`);
      const valanceSel = gv(`mq-${prefix}-trim-valance`);
      const hasTrimSelection = (crownSel && crownSel !== 'none') || (valanceSel && valanceSel !== 'none');
      const hasCabinetSelectionButNoFeet = cabSectionActive && !hasAnyLinearFeet && (hasDoorSelection || hasTrimSelection);

      const btn = document.getElementById(`mq-${prefix}-calc-btn`);
      if (btn) {
        btn.classList.remove('mq-needs-choice');
        void btn.offsetWidth;
        btn.classList.add('mq-needs-choice');
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => btn.classList.remove('mq-needs-choice'), 700);
      }
      const msgEl = document.getElementById(`mq-${prefix}-empty-calc-msg`);
      if (msgEl) {
        msgEl.textContent = hasCabinetSelectionButNoFeet
          ? "Looks like you've made selections, but no linear feet was entered for cabinets — please add your measurements before calculating."
          : "No selections have been made, or no linear feet was entered — please double-check before calculating.";
        msgEl.style.display = 'block';
        clearTimeout(msgEl._mqHideTimer);
        msgEl._mqHideTimer = setTimeout(() => { msgEl.style.display = 'none'; }, 5000);
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
        if (!row) continue; // methods match — no separate field, nothing extra to check

        const supplyQty = specQty[prefix][i] || 0;
        const instQty = installQty[prefix][i] || 0;
        if (supplyQty === 0 && instQty === 0) continue; // genuinely not selected at all

        if (supplyQty === 0) { shake(document.getElementById(`mq-qty-${prefix}-${i}`)); return false; }
        if (instQty === 0) { shake(document.getElementById(`mq-installqty-${prefix}-${i}`)); return false; }
      }
      return true;
    }

    addSurfaceInternal('ct');
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
  // Free-Demo-tier watermark — a faint repeating "DEMO" pattern stamped over
  // the whole widget, non-interactive (pointer-events:none, so it never
  // blocks clicks) and kept well below the lightbox/modal z-index range
  // (100000+) so it never bleeds into an enlarged photo. Re-injected after
  // every full container rebuild (initial load and mqStartNewEstimate both
  // wipe the container's innerHTML, which would otherwise remove it).
  function mqInjectDemoWatermark(container) {
    if (!container || container.querySelector('.mq-demo-watermark')) return;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    const wm = document.createElement('div');
    wm.className = 'mq-demo-watermark';
    wm.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:9000;overflow:hidden;" +
      "background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='190' height='190'%3E%3Ctext x='0' y='110' font-family='Arial,sans-serif' font-size='32' font-weight='800' letter-spacing='2' fill='rgba(17,17,17,0.07)' transform='rotate(-28 95 95)'%3EDEMO%3C/text%3E%3C/svg%3E\");" +
      "background-repeat:repeat";
    container.appendChild(wm);
  }

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
    if (window._mqIsDemoPlan) mqInjectDemoWatermark(container);
    // Fresh estimate — nothing calculated yet, so hide any leftover sticky
    // bar from before and let it re-earn its spot once they Calculate again.
    window._mqStickyPrefix = null;
    window._mqStickyDismissed = false;
    window._mqStickyLast = null;
    const stickyBar = document.getElementById('mq-sticky-bar');
    if (stickyBar) stickyBar.classList.remove('show');
    mqAdjustWidgetBottomPadding();
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

  // ── Auto-open sections that scrolling alone never reaches ──
  // The guided-flow scroll-spy (mqObserveSectionsForScrollSpy, inside
  // wireWidget) opens each section as it crosses the exact vertical center
  // of the screen while scrolling. That works for most sections, but one
  // sitting near the very bottom of the page can end up parked in the
  // lower half of the viewport WITHOUT ever actually crossing that center
  // line, if the page runs out of room to scroll before it gets there —
  // there's nothing further to scroll to, so the trigger line never
  // reaches it. Left alone, that section just stays closed with no way for
  // scrolling to open it.
  //
  // This catches that specific case: whenever the page hits the bottom of
  // its scrollable range, look for a section that's (a) still collapsed,
  // (b) has never been opened before — mqToggleCollapse marks that, so a
  // section someone deliberately closed again is left alone — and (c) is
  // currently sitting in the bottom half of the viewport. Opens just the
  // first (topmost) one that matches, one at a time. If opening it reveals
  // another lower down, the same check runs again the next time scrolling
  // reaches the (now taller) bottom of the page, so it can cascade through
  // several in a row without ever opening more than one at once.
  function mqCheckBottomBounceAutoOpen() {
    const doc = document.documentElement;
    const atBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 4;
    if (!atBottom) return;
    const midpoint = window.innerHeight / 2;
    const sections = document.querySelectorAll('#midasquote-widget .mq-sec');
    for (const sec of sections) {
      const body = sec.querySelector('[id$="-body"]');
      if (!body || body.style.display !== 'none') continue; // already open, nothing to do
      if (body.dataset.mqEverOpened) continue; // was opened before, closed on purpose — leave it
      const rect = sec.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue; // not actually on screen
      if (rect.top < midpoint) continue; // only ones sitting below the middle of the screen
      const key = body.id.replace(/^mq-/, '').replace(/-body$/, '');
      window.mqToggleCollapse(key);
      return; // one at a time — the next bottom-bounce picks up any further ones
    }
  }
  function mqInitBottomBounceAutoOpen() {
    let scrollTimer;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(mqCheckBottomBounceAutoOpen, 150);
    }, { passive: true });
  }

  // ── Sticky estimate bar ──
  // Appears the first time a real Calculate completes (lead capture and
  // all — this never re-triggers that, it only reads the already-computed
  // numbers). From then on, tracks live as the customer tweaks anything,
  // by calling the same pure calcCabinet/calcCountertop functions Calculate
  // itself uses — no popups, no re-saving a lead, just silent re-math.
  window._mqStickyPrefix = null;
  window._mqStickyDismissed = false;
  window._mqStickyLast = null;
  // Moved out of the widget's own nested container and onto document.body
  // directly — same reasoning as the sticky bar. If anything on the host
  // page (a transform, filter, etc. on some ancestor) breaks position:fixed
  // for elements nested inside the widget, appending straight to body
  // sidesteps that entirely, so these reliably center in the current
  // viewport with zero scrolling ever needed to reach them.
  function mqSetupModalOverlays() {
    if (document.getElementById('mq-lead-overlay')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="mq-overlay" id="mq-lead-overlay">
        <div class="mq-modal">
          <p class="mq-modal-title">Almost there — one quick step</p>
          <p class="mq-modal-sub">Enter your details and we'll send you a copy of your estimate.</p>
          <div class="mq-modal-fields">
            <div class="mq-modal-field"><label>Your name</label><input type="text" id="mq-lead-name" placeholder="Jane Smith"/></div>
            <div class="mq-modal-field"><label>Email address</label><input type="email" id="mq-lead-email" placeholder="jane@email.com"/></div>
            <div class="mq-modal-field"><label>Phone number <span style="color:#6b7280;font-weight:400">(optional)</span></label><input type="tel" id="mq-lead-phone" placeholder="(555) 000-0000"/></div>
          </div>
          <button class="mq-modal-btn" onclick="mqSubmitLead()">Show my estimate →</button>
          <button class="mq-modal-skip" onclick="mqSkipLead()">Skip for now</button>
        </div>
      </div>
      <div class="mq-overlay" id="mq-consult-email-overlay">
        <div class="mq-modal">
          <p class="mq-modal-title">Get in touch</p>
          <p class="mq-modal-sub">Send your question or consultation request to:</p>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:1.25rem;display:flex;align-items:center;justify-content:space-between;gap:10px">
            <span id="mq-consult-email-display" style="font-size:14px;font-weight:600;color:#111;word-break:break-all">—</span>
            <button class="mq-modal-copy-btn" id="mq-consult-email-copy-btn" onclick="mqCopyConsultEmail()">Copy</button>
          </div>
          <button class="mq-modal-btn" onclick="mqOpenConsultMailto()">Open in email app ↗</button>
          <button class="mq-modal-skip" onclick="document.getElementById('mq-consult-email-overlay').classList.remove('show')">Close</button>
        </div>
      </div>
      <div class="mq-overlay" id="mq-quick-email-overlay">
        <div class="mq-modal">
          <p class="mq-modal-title">Where should we send it?</p>
          <p class="mq-modal-sub">Enter your email and we'll send your current estimate.</p>
          <div class="mq-modal-fields">
            <div class="mq-modal-field"><label>Email address</label><input type="email" id="mq-quick-email-input" placeholder="jane@email.com" onkeydown="if(event.key==='Enter')mqSubmitQuickEmail()"/></div>
          </div>
          <button class="mq-modal-btn" onclick="mqSubmitQuickEmail()">Send it →</button>
          <button class="mq-modal-skip" onclick="document.getElementById('mq-quick-email-overlay').classList.remove('show')">Cancel</button>
        </div>
      </div>
      <div class="mq-overlay" id="mq-demo-locked-overlay">
        <div class="mq-modal">
          <p class="mq-modal-title">⚡ Quoting isn't available right now</p>
          <p class="mq-modal-sub">This shop's free trial has ended, so this tool can't generate estimates at the moment. If this is your business, upgrade to a paid plan from your dashboard to turn quoting back on.</p>
          <button class="mq-modal-skip" onclick="document.getElementById('mq-demo-locked-overlay').classList.remove('show')">Close</button>
        </div>
      </div>`;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
  }
  function mqSetupStickyBar() {
    if (document.getElementById('mq-sticky-bar')) return;
    const accent = window._mqFocalColor || '#fbbf24';
    const bar = document.createElement('div');
    bar.id = 'mq-sticky-bar';
    bar.style.borderTop = `2px solid ${accent}`;
    bar.innerHTML = `
      <div id="mq-sticky-inner">
        <div id="mq-sticky-main">
          <div id="mq-sticky-content">
            <div id="mq-sticky-label">Swap items to change your estimate in real time</div>
            <div id="mq-sticky-price-wrap"><span id="mq-sticky-price">—</span> <button id="mq-sticky-breakdown-toggle" onclick="mqToggleStickyBreakdown()" style="display:none;background:none;border:none;padding:0;margin-left:9px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.85);text-decoration:underline;cursor:pointer;font-family:inherit;vertical-align:middle">▾ Breakdown</button> <button id="mq-sticky-email-link" onclick="mqEmailMyQuote()" style="background:none;border:none;padding:0;margin-left:9px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.65);text-decoration:underline;cursor:pointer;font-family:inherit;vertical-align:middle">📧 Email me a copy</button></div>
          </div>
          <div id="mq-sticky-ctas">
            ${window._mqAskQuestionBtn || `<button onclick="mqShowConsultModal()">Ask a question ↗</button>`}
            <button class="mq-pri" style="background:${accent};color:#fff" onclick="mqShowConsultModal()">Book a consultation ↗</button>
          </div>
        </div>
        <div id="mq-sticky-breakdown" style="display:none;padding:0 16px 12px;font-size:12.5px;color:rgba(255,255,255,0.9)"></div>
        ${window._mqFinancingOn ? `<div id="mq-sticky-financing"><div id="mq-sticky-financing-main">💳 Financing available<span id="mq-sticky-financing-payment"></span></div><div id="mq-sticky-financing-disclaimer" style="display:none">*Estimated amount only</div></div>` : ''}
      </div>`;
    document.body.appendChild(bar);
    window.addEventListener('resize', mqAdjustWidgetBottomPadding);
  }
  window.mqToggleStickyBreakdown = function() {
    const panel = document.getElementById('mq-sticky-breakdown');
    const toggle = document.getElementById('mq-sticky-breakdown-toggle');
    const price = document.getElementById('mq-sticky-price');
    if (!panel) return;
    const opening = panel.style.display === 'none';
    panel.style.display = opening ? 'block' : 'none';
    // Keep the top-left price and the breakdown's own Total row mutually
    // exclusive — collapsing the breakdown by hand should bring the price
    // back, same as when there's nothing to show a breakdown for at all.
    if (price) price.style.display = opening ? 'none' : 'inline-block';
    if (toggle) toggle.textContent = opening ? '▴ Hide breakdown' : '▾ Breakdown';
    mqAdjustWidgetBottomPadding();
  };
  // The bar is position:fixed, so it never pushes page content out of the
  // way on its own — without this, it silently sits on top of whatever's
  // scrolled to the bottom (financing note, "Powered by" footer, etc.),
  // hiding it completely rather than just overlapping it. Pads the page's
  // own body rather than the widget's container — the widget lives inside
  // a host page (Shopify/Webflow/etc) whose own CSS can interfere with
  // padding on an inner element in ways that aren't predictable from here,
  // but body is reliably the actual scrollable area almost everywhere.
  let _mqOrigBodyPaddingBottom = null;
  function mqAdjustWidgetBottomPadding(afterApply) {
    requestAnimationFrame(() => {
      const bar = document.getElementById('mq-sticky-bar');
      if (_mqOrigBodyPaddingBottom === null) {
        _mqOrigBodyPaddingBottom = document.body.style.paddingBottom || '';
      }
      if (bar && bar.classList.contains('show')) {
        document.body.style.paddingBottom = (bar.offsetHeight + 24) + 'px';
      } else {
        document.body.style.paddingBottom = _mqOrigBodyPaddingBottom;
      }
      if (typeof afterApply === 'function') afterApply();
    });
  }
  // "Email me a copy" — lives next to the sticky bar's price. Reuses the
  // exact same live calc functions and email-sending pattern already used
  // for the automatic post-Calculate email, just triggered on demand with
  // whatever the customer's current numbers are right now. If they skipped
  // giving an email the first time, this asks just for an email (not the
  // full name/phone form again) before sending.
  function mqCurrentLiveResult() {
    const prefix = window._mqStickyPrefix;
    if (!prefix || !window._mqCalcCabinet || !window._mqCalcCountertop) return null;
    if (prefix === 'b') {
      const cab = window._mqCalcCabinet('b'), ct = window._mqCalcCountertop('b');
      return {
        prefix, low: cab.low + ct.low, high: cab.high + ct.high, total: cab.total + ct.total,
        lines: [{label:'Cabinets',header:true}, ...cab.lines.filter(l=>!l.bold), {label:'Countertops',header:true}, ...ct.lines.filter(l=>!l.bold)],
        quoteType: 'Cabinets + Countertops', roomLabel: cab.roomLabel,
      };
    }
    if (prefix === 'ct') {
      const r = window._mqCalcCountertop('ct');
      return { prefix, low: r.low, high: r.high, total: r.total, lines: r.lines, quoteType: 'Countertops', roomLabel: '' };
    }
    const r = window._mqCalcCabinet('c');
    return { prefix, low: r.low, high: r.high, total: r.total, lines: r.lines, quoteType: 'Cabinets', roomLabel: r.roomLabel };
  }
  // Goes through the exact same saveLead used for the automatic post-
  // Calculate email — creates/updates the Airtable lead record, notifies
  // the shop (subject to their "notify on every estimate" setting), and
  // emails the customer their current numbers, all in one call rather than
  // duplicating that logic separately here.
  async function mqSendQuoteCopy(email) {
    const linkEl = document.getElementById('mq-sticky-email-link');
    const result = mqCurrentLiveResult();
    const data = window._mqFullData;
    if (!result || !data) return;
    if (linkEl) linkEl.textContent = 'Sending...';
    try {
      await mqSaveLeadWithCart(data, { name:'', email, phone:'', _isSkip:false }, result.quoteType, result.low, result.high, result.lines, result.roomLabel, result.total, result.prefix);
    } catch(e) { console.error('Email me a copy failed', e); }
    if (linkEl) {
      linkEl.textContent = '✓ Sent!';
      setTimeout(() => { linkEl.textContent = '📧 Email me a copy'; }, 2500);
    }
  }
  window.mqEmailMyQuote = async function() {
    if (window._mqLeadEmail) {
      await mqSendQuoteCopy(window._mqLeadEmail);
    } else {
      const overlay = document.getElementById('mq-quick-email-overlay');
      if (overlay) overlay.classList.add('show');
    }
  };
  window.mqSubmitQuickEmail = async function() {
    const input = document.getElementById('mq-quick-email-input');
    const email = (input && input.value || '').trim();
    if (!email || !email.includes('@')) { if (input) input.focus(); return; }
    window._mqLeadEmail = email;
    document.getElementById('mq-quick-email-overlay').classList.remove('show');
    await mqSendQuoteCopy(email);
  };
  window.mqCloseStickyBar = function() {
    window._mqStickyDismissed = true;
    const bar = document.getElementById('mq-sticky-bar');
    if (bar) bar.classList.remove('show');
    mqAdjustWidgetBottomPadding();
  };
  // Called right after a real Calculate finishes for any tab — reveals the
  // bar (unless the customer already dismissed it this session) and marks
  // that tab as the one live updates should keep tracking.
  window.mqShowStickyBar = function(prefix, low, high, total) {
    window._mqStickyPrefix = prefix;
    mqSetupStickyBar();
    mqUpdateLivePreview(prefix);
    mqSetStickyPrice(prefix, low, high, total, false);
    if (!window._mqStickyDismissed) {
      const bar = document.getElementById('mq-sticky-bar');
      if (bar) bar.classList.add('show');
    }
    mqAdjustWidgetBottomPadding();
  };
  // The standalone Countertops tab isn't tied to any project type selection
  // at all, so there's nothing to check a toggle against — it always shows
  // a range. Cabinets and Both are both tied to a selected room, so they
  // respect that room's own showRange setting (defaulting to true/range,
  // same as it's always behaved, for any room that's never touched this).
  function mqShouldShowRange(prefix) {
    if (prefix === 'ct') return true;
    // Inlined rather than calling gv() — gv is scoped inside a different,
    // inner function and isn't reachable from every place this needs to
    // run (this is exactly what threw "gv is not defined" from inside the
    // saveLead email-building code, which lives outside that scope).
    const roomEl = document.getElementById(`mq-${prefix}-room`);
    const roomId = roomEl ? roomEl.value : '';
    const room = (window._mqRoomTypes||[]).find(r => r.id === roomId);
    return !room || room.showRange !== false;
  }
  function fmtRange(low, high) {
    const f = n => CUR() + Math.round(n).toLocaleString();
    return `${f(low)} – ${f(high)}`;
  }
  // Single entry point for every place a price gets shown to a customer —
  // shows the usual ballpark range, or the exact clean total with no spread
  // at all, depending on the selected project type's own preference.
  function mqFmtPrice(prefix, low, high, total) {
    return mqShouldShowRange(prefix) ? fmtRange(low, high) : (CUR() + Math.round(total).toLocaleString());
  }
  // Formats the financing monthly-payment text for a results panel, mirroring
  // mqFmtPrice's own range-vs-single-number logic so the payment box always
  // matches whatever basis (range or one clean total) the price above it is
  // using. Returns null when financing has no rate/term set, or the basis is
  // $0 (nothing calculated yet).
  function mqFinancingPaymentText(prefix, low, high, total) {
    if (window._mqFinancingAPR == null || window._mqFinancingTermMonths == null) return null;
    const showRange = mqShouldShowRange(prefix);
    const basisLow = showRange ? low : total;
    const basisHigh = showRange ? high : total;
    if (!(basisLow > 0) && !(basisHigh > 0)) return null;
    const payLow = Math.round(mqCalcMonthlyPayment(basisLow, window._mqFinancingAPR, window._mqFinancingTermMonths));
    const payHigh = Math.round(mqCalcMonthlyPayment(basisHigh, window._mqFinancingAPR, window._mqFinancingTermMonths));
    return payLow === payHigh
      ? `${CUR()}${payHigh.toLocaleString()}/mo`
      : `${CUR()}${payLow.toLocaleString()}/mo – ${CUR()}${payHigh.toLocaleString()}/mo`;
  }
  // Shows/hides and fills in the big financing box under a results panel's
  // total (mq-${prefix}-financing-box) — used by both the "Calculate" flows
  // and the silent live-refresh path, so it always tracks whatever's
  // currently displayed as that panel's total.
  function mqUpdateFinancingBox(prefix, low, high, total) {
    const box = document.getElementById(`mq-${prefix}-financing-box`);
    if (!box) return;
    if (!window._mqFinancingOn) { box.style.display = 'none'; return; }
    const payText = mqFinancingPaymentText(prefix, low, high, total);
    if (!payText) { box.style.display = 'none'; return; }
    const valEl = document.getElementById(`mq-${prefix}-financing-val`);
    if (valEl) valEl.textContent = `as low as ${payText}*`;
    // Block, not flex — the box is a simple top-strip + body stack (a
    // little "card" look: the label sits in its own colored strip up top,
    // the price + fine print sit in the body below it).
    box.style.display = 'block';
  }
  // Swaps out every "ballpark"/"estimated range" phrase for wording that's
  // actually true once a project type has the range toggled off — saying
  // "estimated range" or "ballpark estimate only" next to a single clean
  // number would be misleading, since there's no range being shown at all.
  // Only ever touches the DEFAULT disclaimer text — a shop's own custom
  // disclaimer is left exactly as they wrote it either way.
  window.mqRefreshBallparkWording = function(prefix) {
    const showRange = mqShouldShowRange(prefix);
    const rangeLbl = document.getElementById(`mq-${prefix}-res-range-lbl`);
    if (rangeLbl) rangeLbl.textContent = showRange ? 'Estimated range' : 'Your quote';
    const grandSub = document.getElementById(`mq-${prefix}-grand-sub`);
    if (grandSub) grandSub.textContent = showRange ? 'Before tax · Ballpark estimate only' : 'Before tax · This quote is not final';
    if (window._mqUsingDefaultDisclaimer) {
      const discEl = document.getElementById(`mq-${prefix}-disclaimer`);
      if (discEl) discEl.textContent = '⚠ ' + (showRange
        ? 'Ballpark estimate only. Contact us for a full quote.'
        : 'This quote is not final — please contact us for final numbers.');
    }
  };
  // animate=true is the "something fun happens" part — a quick pulse on the
  // number plus a floating +/-$ delta, so a customer actually notices their
  // tweak moved the price instead of the number just silently changing.
  function mqSetStickyPrice(prefix, low, high, total, animate) {
    const el = document.getElementById('mq-sticky-price');
    if (!el) return;
    // The sticky bar should reflect the customer's WHOLE quote, not just
    // whatever's live on the currently active tab — otherwise switching
    // project types (which commits the old config to the cart, then resets
    // the form to blank) makes the price look like it dropped to zero,
    // even though nothing was actually lost. Combine the cart's running
    // total with whatever's live right now before ever displaying it.
    const cart = window._mqQuoteCart || [];
    const cartLow = cart.reduce((s,e) => s + (e.low||0), 0);
    const cartHigh = cart.reduce((s,e) => s + (e.high||0), 0);
    const cartTotal = cart.reduce((s,e) => s + (e.total||0), 0);
    const combinedLow = cartLow + low, combinedHigh = cartHigh + high, combinedTotal = cartTotal + total;
    // Range display follows the same rule the cart panel itself uses: only
    // collapse to one clean number if EVERY contributor — every committed
    // cart entry plus whatever's live now — is actually set to no-range.
    const allNoRange = cart.every(e => !e.showRange) && !mqShouldShowRange(prefix);
    const prev = window._mqStickyLast;
    el.textContent = allNoRange ? (CUR() + Math.round(combinedTotal).toLocaleString()) : fmtRange(combinedLow, combinedHigh);
    // Financing monthly-payment estimate, recomputed off the same combined
    // low/high/total used for the price above — stays in sync with it as
    // the customer edits their quote.
    const financingPayEl = document.getElementById('mq-sticky-financing-payment');
    const financingDisclaimerEl = document.getElementById('mq-sticky-financing-disclaimer');
    if (financingPayEl) {
      if (window._mqFinancingAPR != null && window._mqFinancingTermMonths != null) {
        const payBasisLow = allNoRange ? combinedTotal : combinedLow;
        const payBasisHigh = allNoRange ? combinedTotal : combinedHigh;
        if (payBasisLow > 0 || payBasisHigh > 0) {
          const payLow = Math.round(mqCalcMonthlyPayment(payBasisLow, window._mqFinancingAPR, window._mqFinancingTermMonths));
          const payHigh = Math.round(mqCalcMonthlyPayment(payBasisHigh, window._mqFinancingAPR, window._mqFinancingTermMonths));
          const payText = payLow === payHigh
            ? `${CUR()}${payHigh.toLocaleString()}/mo`
            : `${CUR()}${payLow.toLocaleString()}/mo – ${CUR()}${payHigh.toLocaleString()}/mo`;
          financingPayEl.textContent = ` · as low as ${payText}*`;
          financingPayEl.title = 'Estimated payment only — subject to approval and final terms.';
          if (financingDisclaimerEl) financingDisclaimerEl.style.display = 'block';
        } else {
          financingPayEl.textContent = '';
          if (financingDisclaimerEl) financingDisclaimerEl.style.display = 'none';
        }
      } else {
        financingPayEl.textContent = '';
        if (financingDisclaimerEl) financingDisclaimerEl.style.display = 'none';
      }
    }
    if (animate && prev) {
      const prevMid = (prev.low + prev.high) / 2;
      const newMid = (combinedLow + combinedHigh) / 2;
      const delta = Math.round(newMid - prevMid);
      if (Math.abs(delta) >= 1) {
        el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
        const wrap = document.getElementById('mq-sticky-price-wrap');
        if (wrap) {
          const badge = document.createElement('span');
          badge.className = 'mq-sticky-delta show';
          badge.style.color = delta > 0 ? '#16a34a' : '#dc2626';
          badge.textContent = (delta > 0 ? '+' : '−') + CUR() + Math.abs(delta).toLocaleString();
          wrap.appendChild(badge);
          setTimeout(() => badge.remove(), 1300);
        }
      }
    }
    window._mqStickyLast = { low: combinedLow, high: combinedHigh };
  }
  // Silently re-runs the same math Calculate uses, for whichever tab is
  // currently being tracked — no lead popup, no scrolling, no saving
  // anything, just fresh numbers.
  // Shows whichever project type is CURRENTLY active as its own live line
  // in the breakdown — even at $0 right after switching to it — updating
  // as the customer types. Never added to the real cart array itself; this
  // is purely a display-layer preview of what WOULD get committed if they
  // switched away right now. Accepts an already-computed range to avoid a
  // redundant recalculation when the caller already has one on hand.
  function mqUpdateLivePreview(prefix, precomputedRange) {
    let range = precomputedRange;
    if (!range) {
      if (!window._mqCalcCabinet || !window._mqCalcCountertop) return;
      if (prefix === 'b') {
        const cab = window._mqCalcCabinet('b'), ct = window._mqCalcCountertop('b');
        range = { low: cab.low + ct.low, high: cab.high + ct.high, total: cab.total + ct.total, label: cab.roomLabel || 'Cabinets + Countertops' };
      } else if (prefix === 'ct') {
        const r = window._mqCalcCountertop('ct');
        range = { low: r.low, high: r.high, total: r.total, label: 'Countertops' };
      } else {
        const r = window._mqCalcCabinet('c');
        range = { low: r.low, high: r.high, total: r.total, label: r.roomLabel };
      }
    }
    window._mqLivePreview = { label: range.label, prefix, low: range.low, high: range.high, total: range.total, showRange: mqShouldShowRange(prefix) };
    mqRenderQuoteCart();
  }

  function mqLiveRecalcSticky() {
    const prefix = window._mqStickyPrefix;
    if (!prefix || window._mqStickyDismissed) return;
    try {
      // Refreshes the full breakdown (line items, totals, everything) if
      // that tab's results panel is on screen, and hands back the new
      // range so the sticky bar updates off the exact same calculation —
      // no separate/duplicate math, both pieces always agree.
      let range = window._mqRefreshResultsPanel ? window._mqRefreshResultsPanel(prefix) : null;
      if (!range && window._mqCalcCabinet && window._mqCalcCountertop) {
        if (prefix === 'b') {
          const cab = window._mqCalcCabinet('b'), ct = window._mqCalcCountertop('b');
          range = { low: cab.low + ct.low, high: cab.high + ct.high, total: cab.total + ct.total, label: cab.roomLabel || 'Cabinets + Countertops' };
        } else if (prefix === 'ct') {
          const r = window._mqCalcCountertop('ct');
          range = { low: r.low, high: r.high, total: r.total, label: 'Countertops' };
        } else {
          const r = window._mqCalcCabinet('c');
          range = { low: r.low, high: r.high, total: r.total, label: r.roomLabel };
        }
      }
      if (range) {
        mqSetStickyPrice(prefix, range.low, range.high, range.total, true);
        mqUpdateLivePreview(prefix, range);
      }
    } catch (e) { /* mid-edit DOM state can briefly be inconsistent — just skip this tick */ }
  }
  let _mqStickyDebounce = null;
  function mqScheduleLiveRecalc() {
    if (!window._mqStickyPrefix || window._mqStickyDismissed) return;
    clearTimeout(_mqStickyDebounce);
    _mqStickyDebounce = setTimeout(mqLiveRecalcSticky, 250);
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
    // Free Demo tier: full quoting still works, but the widget carries a
    // visible watermark and always shows MidasQuote's own library photos
    // instead of any the shop uploaded/linked — see mqInjectDemoWatermark,
    // mqShowRoomDescription, and mqRefreshMeasureGuide.
    window._mqIsDemoPlan = (shop['Plan']||'') === 'Demo';
    injectStyles(
      shop['Brand colour']||'#1a1a1a',
      shop['Focal colour'],
      shop['Box border colour'],
      shop['Box background colour'],
      shop['Box text colour']
    );
    buildCTMAT(data);
    buildTRIM(data);
    buildTALLCAB(data);
    container.innerHTML=buildWidgetHTML(shop,specs,data);
    wireWidget(data);
    if (window._mqIsDemoPlan) mqInjectDemoWatermark(container);
    mqSetupModalOverlays();
    mqSetupStickyBar();
    // Delegated so it automatically covers every input/select/checkbox in
    // the widget, including ones added later (surface cards, tall cabinet
    // rows, etc.) — no need to individually wire each one.
    container.addEventListener('input', mqScheduleLiveRecalc);
    container.addEventListener('change', mqScheduleLiveRecalc);

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
  mqInitBottomBounceAutoOpen();


})();