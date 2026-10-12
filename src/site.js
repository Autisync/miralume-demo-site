// Shared by every page: talking to the CRM's listings API, and the bits of
// page every page has. Everything shown comes from the CRM, live.

const CFG = window.SITE_CONFIG || { api: 'https://api.autisync.com/api', key: '', refreshSeconds: 10 };
const STATUS_TEXT = { available: '', viewing: '', under_offer: 'Under offer', reserved: 'Reserved', sold: 'Sold', let: 'Let agreed' };
const CLOSED = new Set(['sold', 'let']);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(path, options = {}) {
  if (!CFG.key) throw new Error('NO_KEY');
  const res = await fetch(`${CFG.api}/public/listings${path}`, {
    ...options,
    cache: 'no-store',
    headers: { 'X-Api-Key': CFG.key, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The listings service answered ${res.status}`);
  return data;
}

function money(p) {
  if (p.price === null || p.price === undefined) return 'Price on request';
  const amount = new Intl.NumberFormat('en-GB', { style: 'currency', currency: p.currency || 'EUR', maximumFractionDigits: 0 }).format(p.price);
  const per = p.listingType === 'rent' ? ` <small>/ ${esc(p.rentPeriod || 'month')}</small>` : '';
  return `${p.priceQualifier ? `<small>${esc(p.priceQualifier)}</small> ` : ''}${amount}${per}`;
}

function where(p) {
  return [p.address?.line1, p.address?.neighbourhood, p.address?.city].filter(Boolean).join(', ');
}

function beds(p) {
  if (p.bedrooms === 0) return 'Studio';
  return p.bedrooms ? `${p.bedrooms} bed${p.bedrooms === 1 ? '' : 's'}` : '';
}

function listingUrl(p) {
  return `/properties/${encodeURIComponent(p.reference)}`;
}

function setupNotice(error) {
  if (error && error.message === 'NO_KEY') {
    return `<div class="notice"><p><strong>This website is not connected to the CRM yet.</strong></p>
      <p>In the CRM open <em>Properties › Website</em>, create the website key, and add it to this site's
      environment as <code>LISTINGS_KEY</code>, then redeploy.</p></div>`;
  }
  return `<div class="notice">We could not load the listings just now (${esc(error?.message || 'unknown error')}). Trying again shortly.</div>`;
}

function chrome(active) {
  const header = document.querySelector('header.top');
  if (header) {
    header.innerHTML = `<div class="wrap">
      <a class="brand" href="/"><img src="/logo.png" alt="" width="36" height="36">Miralume Homes</a>
      <nav aria-label="Main">
        <a href="/?type=sale" ${active === 'sale' ? 'aria-current="page"' : ''}>Buy</a>
        <a href="/?type=rent" ${active === 'rent' ? 'aria-current="page"' : ''}>Rent</a>
        <a href="/#listings">All homes</a>
        <a href="/#contact">Contact</a>
      </nav>
      <a class="call" href="#contact">+44 7700 900100</a>
    </div>`;
  }
  const footer = document.querySelector('footer');
  if (footer) {
    footer.id = 'contact';
    footer.innerHTML = `<div class="wrap">
      <div><strong>Miralume Homes</strong><p>Homes to buy and rent in Lisbon, Cascais, Sintra and along the coast.</p>
        <p>Rua do Miradouro 12, 1100-000 Lisboa</p></div>
      <div><p>hello@miralume.example</p><p>+44 7700 900100</p></div>
      <div><p>Mon–Fri 9:00–19:00</p><p>Sat 10:00–14:00</p></div>
      <p class="demo">A demonstration website for a fictional agency. Every listing on it is managed in Autisync CRM and read live from it:
        change a price or a status there and it changes here. Photographs from Pexels.</p>
    </div>`;
  }
}

window.Site = { CFG, STATUS_TEXT, CLOSED, esc, api, money, where, beds, listingUrl, setupNotice, chrome };
