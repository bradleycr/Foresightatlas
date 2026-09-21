# Claim-invite email template

Sent from **Lydia** (Program Manager, Events & Fellowship) as a fun launch
announcement — not a routine admin email.

Mail-merge from the generated package (gitignored, do not commit):

```bash
CLAIM_BASE_URL=https://atlas.foresight.org pnpm claim:package
```

Use **`claim-links-mail-merge.csv`** — only unclaimed people who have a roster
email. Headers: **Full name, Role, Title, Email, Claim link**.

People without email are in **`claim-links-manual-outreach.csv`** (DM / skip).

Links are **one-time**: they stop working once the person sets a password.

---

## Subject

```
Some fun news — meet The Foresight Atlas 🗺️
```

## Body

```
Hi {{Full name}},

Fun news — we've built an internal tool for the Foresight community: The
Foresight Atlas. It's a living map and directory of our grantees, fellows,
and node community (Berlin, SF, Global), plus programming, RSVPs, and
check-ins for node events.

You're already on it! Set your password with this one-time link, just for
you:
{{Claim link}}

Once you're in, you can:
- Find yourself (and everyone else) on the map
- See what's happening at Berlin, SF, and Global programming — and RSVP
- Check in when you're at a node in person
- Edit your own city, project, links, and photo any time

One thing to know: to get everyone set up quickly, we pulled your name,
role, and project description from the Foresight website and other public
sources. If anything's off or missing — city, project title, links, focus
areas, anything at all — just sign in and update it directly on your
profile. Consider it yours to keep current from here.

Prefer not to appear on the atlas? After you sign in, open your profile and
set visibility to Private — that hides you from the map and directory right
away (you can still use the tool). If you'd rather be removed entirely,
just reply to this email and say you'd like your profile deleted, and we'll
take care of it.

Questions, or trouble signing in? Just reply to this email.

Excited for you to check it out!

Lydia
Foresight Institute
```

---

## Shorter variant (optional)

```
Subject: Meet The Foresight Atlas — you're already on it

Hi {{Full name}},

Fun news — we've launched an internal tool for the Foresight community: The
Foresight Atlas, a living map + directory of grantees, fellows, and our
nodes (Berlin, SF, Global), with programming, RSVPs, and check-ins.

You're already on it. Set your password with this one-time link:
{{Claim link}}

We pulled your info from the Foresight website to get you started — if
anything's off, just edit it yourself once you're signed in.

Prefer to stay off the map? Sign in → Profile → set visibility to Private.
Want to be deleted entirely? Reply to this email and ask us to remove you.

Reply if you hit any snags!

Lydia
```

---

## Notes

- Sender: **Lydia La Roux** (Program Manager, Events & Fellowship) — reads
  as a team launch, not an admin/IT notice.
- Prefer sending in small batches (not one giant blast) so replies/bounces
  are easy to track.
- **Opt-out:** Private = self-serve hide from map/directory (row stays;
  they can still log in). Full delete = reply to Lydia / staff removes the
  RealData row by hand.
- If someone lost their link or it expired (claim links don't expire but do
  go dead once claimed), regenerate with:
  ```bash
  pnpm claim:links -- "Full Name"   # single person, or use --role / --csv above
  ```
- For an already-claimed member who forgot their password, use
  `pnpm reset:link -- "Full Name"` instead (see `docs/README.md`). That flow
  still routes replies to Bradley by default (`atlasPasswordResetMailto` in
  `src/utils/checkInAuth.ts`) — update `SUPPORT_EMAIL` there if Lydia should
  own resets going forward too.
