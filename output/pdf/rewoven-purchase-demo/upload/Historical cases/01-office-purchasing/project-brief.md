# Office Purchasing Pilot - Project brief

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Meadow Office Services (fictional)  
**Project:** Office Purchasing Pilot  
**Period:** January 2026  
**Status:** Delivered limited pilot  
**Document version:** 1

## Purpose and problem

Threadline Delivery built a single-manager purchasing pilot for one office. Staff created purchase requests and managers approved a specific request revision.

Office staff previously emailed item lists to their manager. When a quantity changed, an old approval could remain attached to an outdated list. The client needed one place to see the requested items, the current total, and the revision that a manager had actually approved. The pilot covered office supplies only; it did not place orders or move money.

## People and responsibilities

The requester created and amended a request. The assigned office manager reviewed it. An office administrator inspected the event history and recorded a manual purchase reference after approval. The same person could not submit and approve the same request. There was one office and one approval stage; there was no finance reviewer or branch hierarchy.

## Agreed workflow

A request began as a draft with item descriptions, quantities, unit prices, and a reason. Submit created an immutable revision and moved it to awaiting manager review. The manager approved or rejected that revision. Editing submitted quantities or prices created another revision and returned the request to review. The earlier decision remained in the history but no longer authorized the edited request.

## Boundaries and constraints

The pilot used Next.js, PostgreSQL, and the client's existing employee sign-in. A server-side transition checked the requester, manager assignment, current state, and expected revision. The pilot did not include amount-based routing, offline drafts, supplier onboarding, finance approval, or purchase-order generation. These exclusions were written before implementation so that a small pilot would not be mistaken for a complete procurement platform.

## How to read this brief

This brief records the agreed scope or, where explicitly marked, the proposed scope. It is not by itself a delivery certificate. The implementation notes explain decisions and examples; the separate delivery review records what was actually delivered, tested, paused, or left unresolved. Read those documents together before describing a requirement as completed work.
