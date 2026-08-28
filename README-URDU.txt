GTA 6 STYLE DONATION OVERLAY — VERCEL + SUPABASE

Is project mein 2 pages hain:
  /admin   = donation control panel
  /overlay = OBS Browser Source

IMPORTANT:
Vercel sirf website host karega. Live data Supabase mein save/realtime hoga.

1) SUPABASE BANAO
- supabase.com par account/login.
- New project banao.
- SQL Editor kholo.
- is project ki public/setup.sql file ka sara code paste karke Run karo.

2) ADMIN ACCOUNT
- Supabase Dashboard -> Authentication -> Users.
- Add/Create user karo (email + password).
- Public signup band rakho, sirf apna admin user rakho.

3) SUPABASE KE 2 VALUES LO
- Project URL
- Publishable/anon key (client-side key)
Kabhi bhi service_role/secret key Vercel frontend mein mat dalna.

4) VERCEL PAR DEPLOY
- Vercel -> Add New Project -> is folder/GitHub repo ko import karo.
- Build command: npm run build
- Output directory: dist
- Environment Variables add karo:
  VITE_SUPABASE_URL = tumhara project URL
  VITE_SUPABASE_ANON_KEY = tumhara publishable/anon key
- Deploy.

5) PAGES
Deploy ke baad:
  https://YOUR-DOMAIN.vercel.app/admin
  https://YOUR-DOMAIN.vercel.app/overlay

6) OBS
OBS -> Sources -> + -> Browser
URL = https://YOUR-DOMAIN.vercel.app/overlay
Width = 1920
Height = 1080

Ab OBS overlay online rahega. Admin panel se donation add karte hi Supabase Realtime event overlay ko live update karega.

7) CUSTOM DOMAIN
Vercel mein apna domain connect kar sakte ho. Phir /admin aur /overlay usi domain par chalenge.

8) SECURITY
- Service role key kabhi frontend mein expose mat karo.
- Supabase Auth ka single admin account use karo.
- Admin page sirf login ke baad changes karta hai.
