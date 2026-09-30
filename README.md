# SPRS Score Calculator

A free, interactive tool for estimating your **SPRS score** (Supplier Performance Risk System, the Pentagon's cybersecurity scoreboard) against all 110 NIST SP 800-171 Rev. 2 security requirements, weighted exactly the way the DoD assessment methodology scores them.

**Live calculator:** https://nehemiah313.github.io/sprs-score-calculator/

## What it does

- Check off each of the 110 requirements as Implemented, Not Implemented, Partial (where allowed), or Not Applicable
- Watch your live SPRS score, starting at 110
- See whether you clear the **conditional gate** (score of 88+, only 1-point items open, never-deferrable six closed)
- Get your gaps in **MAPS priority order**: never-deferrable first, then 5-point, 3-point, 1-point controls
- Export your gap list as CSV or a Markdown summary
- Your answers never leave your browser (localStorage only, nothing uploaded)

## The dataset

The calculator runs on a machine-readable dataset of all 110 requirements:

- [`data/nist-800-171-controls.json`](data/nist-800-171-controls.json): full dataset with requirement text, weights, family names, never-deferrable flags, and special scoring rules
- [`data/nist-800-171-controls.csv`](data/nist-800-171-controls.csv): the same data as CSV

Requirement text is quoted from NIST SP 800-171 Rev. 2 (public domain). Weights follow the DoD NIST SP 800-171 Assessment Methodology v1.2.1:

- 42 requirements at 5 points, 14 at 3 points, 51 at 1 point
- 3.5.3 (MFA) and 3.13.11 (FIPS-validated encryption): minus 5 if absent, minus 3 if partially implemented
- 3.12.4 (the System Security Plan): no point value, but without an SSP no assessment can be completed
- Floor of -203, ceiling of 110. POA&M items do not change the score.

Free to reuse under MIT. If you build on the dataset, a link back is appreciated.

## Scoring notes

- A POA&M does not change your score. The score reflects what is implemented today.
- Partial implementation scores as not implemented, except 3.5.3 and 3.13.11.
- Controls marked Not Applicable with documented justification subtract nothing.
- Conditional status under 32 CFR 170.21 needs a score of 88 or higher AND every open POA&M item worth 1 point (3.13.11 at minus 3 may be deferred). Six requirements can never sit on a POA&M: 3.1.20, 3.1.22, 3.10.3, 3.10.4, 3.10.5, 3.12.4.

This tool estimates. It is not legal advice and does not replace a real assessment.

## Built by

**Neo Harvard**, CEO of [AI Tech Pros](https://aitechpros.ai). SPRS and CMMC readiness for defense contractors. Part of the [MAPS framework](https://github.com/nehemiah313/maps-framework) family: Map, Assess, Prioritize, Sustain.

## Lead capture

At the top of `app.js`:

```js
const REPORT_INBOX = "n.harvard@aitechpros.ai";
```

When set, a "Get your score reviewed" form appears under the gap list. The visitor enters their work email (and optional company); their full MAPS-prioritized summary downloads immediately, and their mail app opens with a pre-addressed review request to the inbox carrying a results summary (company, email, estimated score, open-gap count, never-deferrable-open count, top gaps). The visitor hits Send in their own mail app, so the lead arrives from their real address with no backend service involved. The visitor's email and company are remembered in localStorage (`sprs-lead-v1`) so returning visitors do not retype them. Set the constant to `""` to hide the form entirely.

Privacy copy on the page states results are sent to AI Tech Pros for follow-up and the address is never sold.
