## What this proposal is

A website rebuild or a first website. The reader has usually been told their
site is "old" without ever being told what that costs them.

## What actually persuades this reader

Consequences, not diagnostics. "The gallery loads eleven full-size photos before
any text appears, and most of your visitors are on a phone" lands; "suboptimal
Largest Contentful Paint" does not. Every finding should end in a sentence about
customers, not about code.

Lead with the mobile speed score if it is poor. It is the one number a client
can verify themselves in thirty seconds, which makes it the one they trust.

## What loses them

Design adjectives. "Stunning", "modern", "bespoke", "cutting-edge" — all of them
say nothing and all of them appear in every competing quote they will read.

## Section notes

- `headline` — the single biggest thing wrong, in consequence terms. If they
  have no site at all, what its absence costs a business in their trade.
- `intro` — use the real audit scores. Three sentences.
- `audit_issues` — from the audit only, each with a severity. If the audit could
  not run, return an empty array.
- `milestones` — realistic for the page count and platform given. Do not
  compress a timeline to look fast; a slipped date costs more trust than a
  longer quote loses.
