# 4-minute demo script (two presenters)

**0:00 Presenter 1 - the problem (30 s).** "In a flood, calls, texts and chat groups all pile up. Nobody can see who needs what first."

**0:30 P1 - open the app on a phone (30 s).** Show the live map. "Red is critical, green is lower. Squares are volunteers." Point to the stats row and the shortage forecast.

**1:00 P2 - report from a second phone (45 s).** Type: "5 log chhat par fase hain, bachche bhi hain, turant". Tap Analyse with AI: it fills rescue, severity 5, vulnerable. Set location, submit. P1's phone updates live without refresh. Say: "Two devices, one shared picture."

**1:45 P2 - no app needed (30 s).** Send the same kind of text by SMS/WhatsApp to the Twilio number (or show the curl command from the README if no number). It appears as a ranked need with the "sms" tag.

**2:15 P1 - coordinator (60 s).** Log in with the coordinator PIN. Tap Auto-match: dashed lines connect volunteers to needs by priority, distance and skill. Open a need, tap Navigate, show Google Maps routing. Show the stock shortage alert.

**3:15 P2 - the AI and honesty (30 s).** "Naive Bayes trained on 80,000 labelled English and Hinglish requests: category 88.5 percent, severity 99.5 percent within one level. Data is synthetic today; the pipeline takes real crisis datasets."

**3:45 Both - close (15 s).** "Installable on any phone, role-based, works over SMS. ReliefGrid: the right help, in the right place, sooner."

## Likely judge questions
- Is the data real? No, synthetic; here is how real data plugs in (real_data.csv).
- What if there is no internet? The app shell opens offline; reports by SMS still work. Offline sync is on the roadmap.
- Why not a deep-learning model? Fast, explainable, runs on the phone with no API cost. Transformers are the next step once real data is in.
- Security? Role PINs enforced server-side, input validation, rate limits. Per-person accounts are next.
