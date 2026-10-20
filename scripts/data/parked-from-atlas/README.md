# Senior Fellows & Prize Winners — contact suppressed

**Policy (Lydia, Oct 2026):** These people stay **on** the public Atlas so the
community can see who they are, but **contact / booking fields are never
served** in the public API. Cold outreach to senior members is the concern;
hiding the whole profile was too strong.

**How it works:** `CONTACT_SUPPRESSED_ROLES` in `server/role-types.js`
(`Senior Fellow`, `Prize Winner`) → `redactPublicContactFields` strips
`contactUrlOrHandle`, `calendarEmail`, and `availabilityUrl` before
`/api/database`. A confirmed `https://foresight.org/people/…` link is kept
so the Profile button can match the institute site. The UI shows:

> Contact info is not shown for this person. They have either not added it
> yet, or do not want to be contacted at this time — we ask the community to
> respect that.

That same copy is used for **anyone** who has not added contact info yet.

**To show contact later for a role:** remove it from `CONTACT_SUPPRESSED_ROLES`
and redeploy. Sheet rows are never deleted.

## People from Lydia’s invite list (canonical)

### Prize Winners
- B.L. Feringa
- Ben Dichter Consulting, LLC DBA CatalystNeuro
- Lorrie F Cranor
- Nicola Marzari
- Pardis Emami Naeini
- Yuvraj Agarwal
- *(also on sheet as Prize Winner: Ben Moskowitz, Erin Magennis, Jellyfish DAO…, Martina Marrali, Vishwa I Goohya)*

### Senior Fellows
- Adam Brown
- Anders Sandberg
- Brad Templeton
- Chiara Marletto
- Christine Peterson
- Clarice D. Aiello
- Creon Levit
- David A Leigh
- Dr Robert Meagly
- Gregory Fahy
- Karl Pfleger
- Lee Cronin
- Mark Miller
- Martin Edelstein
- Morgan Levine
- Richard Mallah
- Robin D Hanson
- Samo Burja
- Zooko Wilcox

## Note on “line 289”

The line-number cut in an invite spreadsheet was approximate. Treat the set as
**role-based** (above), not a literal People-sheet row range.
