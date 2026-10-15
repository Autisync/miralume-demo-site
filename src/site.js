// Shared by every page: talking to the CRM's listings API, and the bits of
// page every page has. Everything shown comes from the CRM, live.

const CFG = window.SITE_CONFIG || { api: 'https://api.autisync.com/api', key: '', refreshSeconds: 10 };

// Visitors in the CRM: which pages people open, how far they read, what
// they click, and enquiries and viewings booked. No cookies.
if (CFG.trackKey) {
  const t = document.createElement('script');
  t.src = `${CFG.app || 'https://app.autisync.com'}/t.js`;
  t.defer = true;
  t.setAttribute('data-site', CFG.trackKey);
  t.setAttribute('data-api', CFG.api);
  document.head.appendChild(t);
}
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

/**
 * A tour or video link as something the page can show in a frame: YouTube,
 * Vimeo, Matterport, Kuula and similar. null means open it in a new tab.
 */
function embedUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
  if (host.endsWith('youtube.com')) {
    const id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/) || [])[1];
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === 'vimeo.com') {
    const id = (u.pathname.match(/^\/(\d+)/) || [])[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === 'player.vimeo.com') return u.href;
  if (host === 'my.matterport.com' && u.searchParams.get('m')) { u.searchParams.set('play', '1'); return u.href; }
  if (['kuula.co', 'cloudpano.com', 'app.cloudpano.com', 'tour.giraffe360.com', 'momento360.com', 'roundme.com', 'teliportme.com'].includes(host)) return u.href;
  return null;
}

/** Full-screen frame for a tour or a video, over the page. */
function openMedia(url, title) {
  const embed = embedUrl(url);
  if (!embed) { window.open(url, '_blank', 'noopener'); return; }
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', title);
  box.innerHTML = `<div class="lightbox-bar"><strong>${esc(title)}</strong>
      <a href="${esc(url)}" target="_blank" rel="noopener">Open in a new tab</a>
      <button type="button" aria-label="Close">×</button></div>
    <iframe src="${esc(embed)}" title="${esc(title)}" allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  box.querySelector('button').addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(box);
  box.querySelector('button').focus();
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

window.Site = { CFG, STATUS_TEXT, CLOSED, esc, api, money, where, beds, listingUrl, setupNotice, chrome, embedUrl, openMedia };
