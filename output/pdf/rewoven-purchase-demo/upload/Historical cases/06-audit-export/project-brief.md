# Audit Export Dashboard - Project brief

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Finch Service Operations (fictional)  
**Project:** Audit Export Dashboard  
**Period:** April 2026  
**Status:** Delivered operational review export  
**Document version:** 2

## Purpose and problem

Threadline Delivery built an event-history export for internal reviewers. Each exported event identified its actor, server timestamp, action, record revision, and export scope.

Reviewers could see a request's final state but could not reliably explain how it reached that state. A spreadsheet download sometimes changed while a reviewer paged through it, making row counts difficult to reconcile. The client needed a bounded event-history export and a visible statement of the filters and time range used to generate it.

## People and responsibilities

A service operator performed normal request actions. An internal reviewer inspected events and requested exports. A system administrator managed access but did not rewrite application events through the dashboard. The export supported operational review. It was not described as a certified compliance record, a legally sufficient audit, or a cryptographically tamper-proof archive.

## Agreed workflow

A successful request transition wrote an event in the same transaction. A reviewer chose an authorized record scope and date range, then requested an export. The system recorded a cutoff and produced rows up to that cutoff. The download header identified the filters, generation time, cutoff, and included record count so that a reviewer could explain the result's boundaries.

## Boundaries and constraints

The pilot used PostgreSQL and CSV output. Timestamps were stored in UTC and the display timezone was labelled. Raw receipt attachments and secret tokens were excluded. The retention duration had not been approved by the client, so the application did not automatically delete old events. The project did not claim protection against a privileged database administrator changing stored data.

## How to read this brief

This brief records the agreed scope or, where explicitly marked, the proposed scope. It is not by itself a delivery certificate. The implementation notes explain decisions and examples; the separate delivery review records what was actually delivered, tested, paused, or left unresolved. Read those documents together before describing a requirement as completed work.
