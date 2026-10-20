# ReliefGrid – installable disaster relief coordination app

Live needs, volunteers and stock on a real map, shared in real time between everyone who opens it.

## Run locally
    node server.js        # needs Node 18+, no npm install
    open http://localhost:3000

## Deploy (free, ~5 min) so phones can install it
Push this folder to GitHub, then create a "Web Service" on Render.com / Railway / Fly.io:
build command: (none) · start command: `node server.js`. You get an https URL.
Open the URL on a phone: Android Chrome -> menu -> "Install app"; iPhone Safari -> Share -> "Add to Home Screen".
(Set a persistent disk and env DB_FILE=/data/data.json so data survives restarts.)

## Environment variables (set these before going live)
COORD_PIN, VOL_PIN (logins), SECRET (signs login tokens), DB_FILE, DEFAULT_LAT / DEFAULT_LNG (map centre for SMS reports with no location).
Defaults are coord123 / vol123 for testing only.

## Roles
Public: report a need, view the map. Volunteer (VOL_PIN): see contact numbers, resolve needs, register volunteers.
Coordinator (COORD_PIN): everything, plus stock, auto-matching and deleting. The server enforces this, not just the UI.

## SMS and WhatsApp reporting
In Twilio, set the incoming-message webhook of your number (or WhatsApp sandbox) to `https://YOUR-URL/api/sms` (HTTP POST).
A text like "5 log chhat par fase hain bachche bhi hain 28.61,77.21" becomes a ranked need and the sender gets an auto-reply.
Without coordinates the need is flagged "needs location" at the default map centre. Needs a Twilio account (trial is free).

## Maps
Leaflet + OpenStreetMap (street) and Esri (satellite), no API key needed. Every need has "Open in Google Maps" and
"Apple Maps" navigation links. To use Google Maps tiles instead, add your own Maps JavaScript API key.

## AI/ML
`python3 train.py` generates 80,000 synthetic English/Hinglish requests, merges the real HumAID tweets in `humaid/` and trains
three Naive Bayes models (written to `public/model.json`, run in the browser and on the server):
- category (medical/food/water/shelter/rescue), severity (1-5), and "actionable request?" (flags sympathy/news so a human reviews it; nothing is ever dropped).
Results: category on the real HumAID test split 87.2% (synthetic-only model: 38.5%), on synthetic test 87.0%; severity 70.7% exact; actionable-vs-not on real test 87.4%.
HumAID mapping: injured_or_dead -> medical, displaced/evacuations -> shelter, missing_or_found -> rescue, requests_or_urgent_needs -> keyword-assigned type; sympathy/not_humanitarian/other/caution = not actionable.
Caveats: HumAID is English news-style tweets about past disasters, and part of the label mapping is keyword-derived, so 87.2% is optimistic for real help requests. Severity is still synthetic only.

## Known limits (be upfront with judges)
PINs are shared secrets, not per-person accounts; writes need a connection (the app shell works offline), JSON-file storage suits a demo, not thousands of concurrent users.
