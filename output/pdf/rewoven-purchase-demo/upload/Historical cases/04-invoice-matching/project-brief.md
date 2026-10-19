# Invoice Matching Pilot - Project brief

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Copperline Retail (fictional)  
**Project:** Invoice Matching Pilot  
**Period:** March 2026  
**Status:** Failed pilot; manual fallback retained  
**Document version:** 2

## Purpose and problem

Threadline Delivery piloted invoice matching against purchase records. Unresolved matching errors caused the pilot to be stopped, and staff completed the cycle with the existing manual process.

Accounts staff compared supplier invoices with purchase references and received-item records. A prototype tried to match on supplier display name and a normalized purchase reference. Several references were missing or reused, and similar supplier names made an apparently convenient matching rule unsafe. The client wanted less manual reconciliation, but that benefit remained a goal rather than an observed result.

## People and responsibilities

An accounts operator imported invoice records and examined suggested matches. A reviewer checked unresolved items before any external posting process. A release owner could stop the pilot and return to the manual worksheet. The application generated a review queue only; it had no permission to post accounting entries or transfer funds automatically.

## Agreed workflow

The proposed flow imported invoices, suggested a purchase match, compared recorded amounts, and required a reviewer to accept or reject the suggestion. Ambiguous or missing matches stayed unresolved. A complete batch required each invoice to be accounted for. The manual worksheet remained available while the pilot was tested, and reconciliation discrepancies prevented the pilot batch from being treated as complete.

## Boundaries and constraints

The trial used a copied dataset and no live posting credentials. Supplier display names were not reliable identifiers. The client had not agreed a tolerance policy for differences in tax, freight, and partial deliveries. Those missing rules mattered to reconciliation. They could not safely be replaced by an arbitrary software threshold or hidden behind a single matched status.

## How to read this brief

This brief records the agreed scope or, where explicitly marked, the proposed scope. It is not by itself a delivery certificate. The implementation notes explain decisions and examples; the separate delivery review records what was actually delivered, tested, paused, or left unresolved. Read those documents together before describing a requirement as completed work.
