# GDPR — Atlas checklist

The app ships product controls (privacy notice, consent on claim/join, hide
profile, download-my-data, deletion mailto). **That is not full legal
compliance.** Foresight still needs org-side paperwork and process.

Public notice: `https://atlas.foresight.org/privacy` · code: `src/pages/PrivacyPage.tsx`

## Done in the product

| Control | Where |
|--------|--------|
| Privacy & data notice (Art. 13-style) | `/privacy`, account menu, profile |
| Consent checkbox before first password | Claim, join claim, create profile |
| Hide from atlas (Private) | Profile → Privacy |
| Download my data (JSON) | Profile → Privacy |
| Request deletion / other rights | Mailto → bradley@foresight.org |
| Signed-out home = aggregate pins only | `PublicAtlasPage` |
| Contact suppressed for some senior roles | `contactPrivacy.ts` |
| Passwords hashed; roster email not on public map | directory auth + sheet read |

## Still on Foresight (lookup / legal / ops)

Work these offline; a lawyer or privacy lead should sign off.

### 1. Controller & contact

- [x] Legal entity + address on `/privacy`: Foresight Institute, 50 California Street, Suite 1500, San Francisco, CA 94111 · bradley@foresight.org.
- [ ] Decide if a DPO is required (Art. 37) or document why not for this internal tool.
- [ ] Publish a monitored privacy inbox (or keep bradley@ and set a 30-day SLA).

### 2. Lawful basis documentation

- [ ] One-pager mapping each purpose → Art. 6 basis (consent for claim/create; legitimate interest for community directory).
- [ ] **Legitimate Interests Assessment (LIA)** for the directory use case (balancing test). Template ideas: [EDPB SME guide](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en).
- [ ] Keep a note of when/how consent is collected (checkbox + privacy URL + date). Product records consent only as “user completed claim/join”; consider logging `privacyAcceptedAt` on the sheet later if counsel wants stronger evidence.

### 3. Processors & transfers (Art. 28 / Ch. V)

Sign / store DPAs and note transfer tools (SCCs / adequacy):

| Processor | Role | DPA / docs to keep |
|-----------|------|--------------------|
| Google (Sheets / APIs) | Roster + RSVPs + check-ins + connections | [Cloud Data Processing Addendum](https://cloud.google.com/terms/data-processing-addendum); Workspace admins: accept CDPA under Admin → Legal and compliance |
| Vercel | Hosting + optional Web Analytics | [Vercel DPA](https://vercel.com/legal/dpa) |
| Resend (if enabled) | Magic-link / access email | Resend DPA when mail is turned on |

- [ ] Confirm sheet sharing is limited to people who need it (least privilege).
- [ ] Record that US processing may occur; SCCs / vendor terms on file.

### 4. Records & retention

- [ ] Short **Record of Processing Activities (RoPA)** — who, what, why, where, how long (Art. 30). Even a one-page table is fine for an SME-scale tool.
- [ ] Written retention rule (e.g. “delete within 30 days of verified erasure request; otherwise keep while in the community”).
- [ ] Breach register + who to call within 72 hours if something goes wrong (Art. 33).

### 5. Rights handling playbook

When someone emails a request:

1. Verify identity (roster name + email).
2. Access / export — point them at **Download my data**, or export the sheet row manually.
3. Erasure — remove RealData row **carefully** (do not scramble `passwordHash` columns for others; see `.cursor/rules/realdata-passwords.mdc`). Also clear related RSVPs / check-ins / connections if counsel requires full erase.
4. Reply within your SLA; log the request.

### 6. Optional product follow-ups

- [ ] Server-side `privacyAcceptedAt` on claim/create for an audit trail.
- [ ] Self-serve “delete my account” that wipes the row after re-auth (today: email staff).
- [ ] Include travel windows in the download by passing them into `downloadMemberDataExport`.
- [ ] If analytics ever becomes cookie-based marketing tracking, add a consent banner; current Vercel Web Analytics should stay disclosed on `/privacy`.

## What “fully compliant” would still need

Product + this checklist + counsel review. No open-source app alone is “fully GDPR compliant” without the LIA, DPAs, RoPA, and a real request/breach process.

Useful external refs:

- [EDPB — process personal data lawfully](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)
- [ICO (UK) — legitimate interests](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/legitimate-interests/) (useful structure even for EU controllers)
