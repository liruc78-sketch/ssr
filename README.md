# Archived: legacy single-file site

`legacy-site.html` is the old single-file Crypto.ssr site, kept for reference only.
It was taken off GitHub Pages on 2026-10-20. The copy here is byte-identical to
`main@e3fa57d:legacy-site.html`.

Why it was retired: since the 2026-10-05 security rebuild (Supabase Auth, own-row RLS,
money writes only via RPCs / edge functions) it can't work for members. It still wrote
the stale `localStorage.tw_user_session` key that made signed-in users see a 0 balance.
With the admin's JWT it could also write `portfolios.usd_balance` straight from the
client and create "demo" wallet users.

Do not put this file back on `main`. `main` is served as-is by GitHub Pages, so any
copy there is live on www.cryptossr.com. On `main`, `/legacy-site.html` is now a stub
that clears the key and redirects to `/`.
