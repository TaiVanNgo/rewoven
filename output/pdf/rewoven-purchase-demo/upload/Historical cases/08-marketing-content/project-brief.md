# Marketing Content Approval Tool - Project brief

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Paperplane Media (fictional)  
**Project:** Marketing Content Approval Tool  
**Period:** May 2026  
**Status:** Delivered editorial review workflow  
**Document version:** 1

## Purpose and problem

Threadline Delivery built an editorial approval tool for marketing drafts. It supported comments, review notifications, and publication scheduling; it did not authorize purchases or financial commitments.

Editors exchanged campaign drafts through email and lost track of which comments needed a response. The client wanted a visible review queue and a notification when a draft needed attention. Content could continue changing during editorial review. The business intentionally preferred flexible collaboration over treating every text edit as a new financial authorization decision.

## People and responsibilities

An author created a draft, a reviewer commented and marked it reviewed, and an editor scheduled publication. The reviewer role described editorial responsibility. It did not carry a spending limit or branch financial authority. The publishing editor remained responsible for checking the final copy, so a reviewed marker was not presented as an immutable approval of every later character.

## Agreed workflow

Drafts moved through writing, in review, reviewed, and scheduled. Comments stayed attached to the draft, and notifications used a link back to the work item. The author could make copy edits during review. The review history recorded activity but did not freeze the exact text version or require an additional decision every time a comma or headline changed.

## Boundaries and constraints

The application managed text and scheduling metadata, not invoices or purchase totals. It used a browser editor, server notifications, and PostgreSQL. It did not include approval thresholds, a manager-and-finance chain, branch assignment enforcement, or a financial event ledger. The review workflow should be assessed in its editorial context rather than treated as a generic authorization engine.

## How to read this brief

This brief records the agreed scope or, where explicitly marked, the proposed scope. It is not by itself a delivery certificate. The implementation notes explain decisions and examples; the separate delivery review records what was actually delivered, tested, paused, or left unresolved. Read those documents together before describing a requirement as completed work.
