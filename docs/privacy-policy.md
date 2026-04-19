# Privacy Policy — Salesforce Themer

**Last updated:** 2026-04-19
**Effective date:** 2026-04-19

> _This is the source-of-truth markdown. The published HTML version lives at_
> _**https://connectry.io/themer/privacy** (canonical URL referenced from the_
> _Chrome Web Store listing). Update both together._

---

## TL;DR — What you actually need to know

- We collect **anonymous usage counts** (how many people open the popup, which preset themes are popular, etc.) so we can build the right things. **No personal data, no Salesforce data, no DOM snapshots.**
- We do **NOT** read, send, or store anything from your Salesforce org. Themes apply locally in your browser.
- The diagnostic scanner only runs when you click "Scan & report" or open the diagnostics panel yourself. Scan reports are only sent if you choose to email them to us.
- Custom themes you build live in your own Chrome storage. They sync across your devices via Google's Chrome sync (not us).
- Want out? Uninstall the extension. Anonymous data isn't tied to anything that can identify you.

If that's all you needed, you can stop here. The full version is below.

---

## 1. Who we are

**Connectry** ("we", "us", "our") publishes the Salesforce Themer browser extension for Google Chrome.

- **Product:** Salesforce Themer
- **Publisher:** Connectry, Inc. — a Delaware corporation (EIN 41-4071270)
- **Contact:** privacy@connectry.io
- **General feedback:** feedback@connectry.io
- **Website:** https://connectry.io

This policy describes what data the Salesforce Themer extension collects, why, where it goes, and your rights. It is written in plain English on purpose. If anything here is unclear, email us and we'll fix the wording.

## 2. What we collect

We split data collection into three buckets so you can see exactly what happens in each.

### 2.1 Anonymous usage telemetry (always on)

When you use the extension, we receive a small number of **anonymous aggregate events** so we can understand which features matter and which themes are popular. Each event contains:

- A randomly-generated **anonymous install ID** (a UUID stored in your browser's local extension storage). This ID is not linked to your name, email, IP address, Salesforce username, or any other identifier we hold.
- The **event name** (e.g. `popup_opened`, `theme_applied`, `builder_opened`).
- The **theme ID** of the preset you applied (only the preset name from a fixed list — e.g. `sakura`, `connectry-dark`. Custom theme IDs you create are collapsed to the literal string `'custom'` so we never receive theme names you've chosen).
- A **page-type category** for diagnostic scans (e.g. `lightning`, `setup`, `records`) — never a URL, never an org hostname.
- **Aggregate counts** from the diagnostic scanner: how many tokens were unrecognised, total component count, coverage percentage. These are integers, not the names of the tokens or components.
- Your **extension version** (e.g. `2.7.73`) and **browser user agent** so we can reproduce bugs on the right setup.
- An `install_type` flag of `dev` or `store` so we can separate our own development clicks from real users.

We do **not** collect: your name, email, IP address, Salesforce username, Salesforce org hostname, Salesforce data, custom theme contents, screenshots, DOM snapshots, or any cookies.

The full set of event names is available on request. The current list (subject to additions) is: `popup_opened`, `studio_opened`, `heartbeat`, `theme_applied`, `studio_tab_opened`, `builder_opened`, `upgrade_viewed`, `scan_run`, `feedback_clicked`.

### 2.2 Data you actively send to us (opt-in only)

When you click **"Scan & report"** in the beta banner, the diagnostic scanner runs on the current Salesforce page. The scanner inspects the page's DOM locally inside your browser to find unrecognised CSS tokens and components. **Nothing is sent automatically.** A formatted report is generated in the panel; you can copy it and email it to us if you want help fixing a coverage gap. Sending is your explicit choice.

When you click **"Send feedback"**, we open a pre-filled email in your default mail client. Anything you write or paste into that email is, of course, sent to us by you.

### 2.3 Data that stays on your device

The following data is stored locally on your device and **never sent to us**:

- Your active theme selection
- Custom themes you build (until you opt to publish them — a future Pro feature with separate consent)
- Per-org theme overrides (Pro feature)
- Effects preferences (volume, scope)
- Any local settings or preferences

If you sign in to Chrome and have Chrome Sync enabled, Google may sync these settings between your devices via Chrome's storage.sync API. That's a Chrome service, governed by Google's privacy policy. We don't see it.

## 3. Why we collect it

Anonymous usage telemetry helps us answer questions like:

- How many people are actively using the extension this week?
- Which preset themes are popular and which can we retire?
- How many users discover the diagnostic scanner?
- How often does the diagnostic find coverage gaps, and on what page types?
- Which Pro features should we prioritise based on intent signals (e.g. how often the Builder tab opens)?

Without this signal, we'd be building blind. With it, we can ship the right things.

## 4. Legal basis (GDPR)

For users in the European Economic Area (EEA) and the United Kingdom:

- **Anonymous usage telemetry** is processed under the **legitimate interest** basis (Art. 6(1)(f) GDPR). We have assessed that the processing has minimal impact on you (no PII, no profiling) and is necessary to operate and improve the product.
- **Data you actively email us** (feedback, scan reports) is processed under your **consent** (Art. 6(1)(a) GDPR), which you express by sending the email.

You can object to legitimate-interest processing at any time by contacting privacy@connectry.io.

## 5. Who we share it with

We share data with the following service providers:

- **Supabase Inc.** (project hosted in the US, Americas region) — hosts the database where anonymous events are stored. Supabase processes data on our behalf under their Data Processing Addendum and standard sub-processor agreements.
- **Google Chrome Web Store** — receives standard install/uninstall counts via Google's own analytics. Governed by Google's privacy policy.

We do **NOT** sell or rent any data. We do **NOT** share data with advertisers or marketing networks. There are no third-party trackers, no ad pixels, no analytics SDKs (e.g. Google Analytics, Mixpanel, Segment) embedded in the extension.

## 6. International transfers

Our Supabase project is hosted in the **United States (Americas region)**. If you are located in the European Economic Area, the United Kingdom, or another jurisdiction with cross-border transfer restrictions, the anonymous telemetry events your install generates are transferred to and processed in the United States.

We rely on the **European Commission's Standard Contractual Clauses** (and equivalent UK addendum) as incorporated into Supabase's Data Processing Addendum as the legal basis for these transfers. Because the data is anonymous and contains no personal identifiers, the practical privacy impact of these transfers is minimal.

## 7. How long we keep it

- **Anonymous usage events:** retained indefinitely in aggregated form. Because there is no identifier linking events back to you, deletion of individual records on request is not technically possible.
- **Emails you send to us** (feedback, scan reports): retained for as long as needed to respond and resolve the issue, then archived for up to 24 months for product-improvement reference. You can request deletion at any time.

## 8. Your rights

Depending on where you live (GDPR for EEA/UK; CCPA for California; similar laws elsewhere), you have rights including:

- **Access** — ask us what data we hold about you (note: anonymous telemetry is, by definition, not linked to you, so we can't surface "your" records).
- **Deletion** — ask us to delete personal data we hold (e.g. emails you've sent us).
- **Objection** — opt out of legitimate-interest processing.
- **Portability** — receive a copy of personal data in a structured format.
- **Lodge a complaint** with your local data protection authority if you're not satisfied with our response.

To exercise any of these rights, email **privacy@connectry.io**. We aim to respond within 30 days.

To stop telemetry collection, **uninstall the extension**. Removing it stops all data collection immediately. (We do not currently expose an in-extension opt-out toggle for telemetry; one will be added in a future release.)

## 9. Children's privacy

The extension is not directed at children under 16, and we do not knowingly collect data from children. If you believe a child has used the extension and you want their associated email correspondence deleted, contact us at privacy@connectry.io.

## 10. Security

- The anonymous install ID is generated client-side and stored in your browser's local extension storage. It is not derived from any identifying information.
- Telemetry events are sent over HTTPS to our Supabase backend.
- Your custom themes never leave your browser unless you explicitly choose to publish them (future Pro feature with a separate consent step).
- We follow standard secure-development practices (code review, dependency scanning, least-privilege access on the backend).

No system is perfectly secure. If you discover a security issue, please report it to **security@connectry.io** instead of opening a public issue.

## 11. Changes to this policy

We will update this policy when our practices change. The "Last updated" date at the top reflects the most recent revision. Material changes will also be announced in the extension's release notes for the version that ships them. Continued use of the extension after a policy update means you accept the revised policy.

## 12. Contact

- **Privacy questions, data requests:** privacy@connectry.io
- **Security disclosures:** security@connectry.io
- **General feedback / bug reports:** feedback@connectry.io
- **Postal address:**
  Connectry, Inc.
  c/o Legalinc Corporate Services Inc.
  131 Continental Dr, Suite 305
  Newark, DE 19713
  United States

---

_Salesforce, Lightning, and related marks are trademarks of Salesforce, Inc. Connectry is not affiliated with or endorsed by Salesforce, Inc._
