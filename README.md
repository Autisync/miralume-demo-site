# Miralume Homes demo website

A small website for the fictional demo agency, Miralume Homes. Every listing
on it is read live from Autisync CRM. That is the point of the demo:

- Change a price or a status in the CRM (Available → Under offer → Sold) and
  within ten seconds the card on the site changes, with a "Price reduced" or
  "Now under offer" flag.
- Take a listing off the website in the CRM and it disappears from the site.
- Send an enquiry or book a viewing on the site and it arrives in the CRM:
  a new conversation in the Inbox, the person in Clients, a task for the
  agent, and a booked viewing under Viewings.

No framework and no install. `build.mjs` copies `src/` to `dist/` and writes
`dist/config.js` from the environment.

## Put it on Vercel (once)

1. In the CRM, open **Miralume Homes (Demo)** with the account picker, go to
   **Properties › Website** and create the website key. Copy it (it starts
   with `pk_`); it is shown once. Leave the webhook address empty.
2. In Vercel: **Add New › Project**, import the `crm-autisync-original`
   repository, and set **Root Directory** to `demo-site`. Framework preset:
   **Other** (the build settings come from `vercel.json`).
3. Under **Environment Variables** add `LISTINGS_KEY` = the key from step 1.
   Optional: `CRM_API_URL` (default `https://api.autisync.com/api`) and
   `REFRESH_SECONDS` (default 10).
4. Deploy. Then back in the CRM, **Properties › Website**, set the listing
   page address to `https://<your-project>.vercel.app/properties/{reference}`
   so "View on website" in the CRM opens the right page.

## Try it locally

```
LISTINGS_KEY=pk_... node build.mjs && npx serve dist
```
