# Booth setup checklist (print me)

Booth URL: `https://<your-domain>/?source=saas-north-2026-booth&kiosk=1`

## iPad (once, before the event)
- [ ] Settings → Safari → AutoFill: **Contact Info off**, Credit Cards off.
- [ ] Settings → Passwords → Password Options → AutoFill Passwords off.
- [ ] Settings → General → Keyboard: **Predictive off**, **Auto-Correction off**.
- [ ] Settings → General → Transfer or Reset iPad → Reset → **Reset Keyboard Dictionary**.
  Together with the steps above, this stops the next visitor being offered the previous visitor's name or email.
- [ ] Display: Auto-Lock **Never**, brightness high. Rotation lock on (landscape). Do Not Disturb on.
- [ ] Safari → open the booth URL → Share → **Add to Home Screen** → open it from the new icon (no Safari bars).
- [ ] Settings → Accessibility → **Guided Access** on, set a staff passcode. In the app, triple-click the top button → Start.

## Laptop
- [ ] Chrome guest window. Settings → Autofill → Addresses and Payment methods off.
- [ ] Open the booth URL → press the full-screen button (top right), or run Chrome with `--kiosk "<booth URL>"`.
- [ ] Screen sleep off.

## Verify (every morning)
- [ ] Submit a test lead (first name `TEST`, your own email) and check the result shows, the result email arrives, and the team inbox gets the lead.
- [ ] Airplane mode on → submit → footer shows **1 queued** → Airplane mode off → the queued count disappears within 30 s.
- [ ] After a result, leave the screen alone for 2 minutes → it resets for the next visitor.
- [ ] Scan the QR code with a phone → Aspen contact page opens.

## During the day
- Use venue Wi-Fi with a phone hotspot as backup. Leads are safe offline; they send when the network returns, and the emails go out then.
- If "queued" stays up while the network works, email is failing (often the daily quota): tell whoever runs the Vercel and Resend accounts. Leads are already stored.
- **Never** delete the home-screen app, clear Safari data or swap devices while the footer shows "queued".

## End of day
- [ ] Every device shows no "queued" count (connect to the hotspot and wait if needed).
- [ ] Between 18:00 and 19:00 (Toronto) the connect@ inbox gets "SaaS calculator leads: N new" with the day's Excel file. Save it to Aspen's drive.
- [ ] Need the list sooner? On a staff laptop or phone (never a booth device): open `/staff`, sign in, **Download all leads**, then **Sign out**.
- [ ] Delete local copies of the spreadsheet (personal data).
