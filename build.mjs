// Copies src/ to dist/ and writes dist/config.js from the environment, so the
// site needs no framework and no install step on Vercel.
//
//   LISTINGS_KEY  the publishable key from the CRM (Properties > Website). It
//                 can only read published listings and send enquiries, so it
//                 is meant to sit in a website's own code.
//   CRM_API_URL   defaults to https://api.autisync.com/api
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('src', 'dist', { recursive: true });

const config = {
  api: (process.env.CRM_API_URL || 'https://api.autisync.com/api').replace(/\/$/, ''),
  key: process.env.LISTINGS_KEY || '',
  refreshSeconds: Number(process.env.REFRESH_SECONDS || 10),
};
writeFileSync('dist/config.js', `window.SITE_CONFIG = ${JSON.stringify(config)};\n`);
console.log(`Built for ${config.api}${config.key ? '' : ' (LISTINGS_KEY is not set: the site will say so)'}`);
