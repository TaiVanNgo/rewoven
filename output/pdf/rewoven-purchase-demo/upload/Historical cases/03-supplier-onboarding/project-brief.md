# Supplier Onboarding Workspace - Project brief

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Birch Supply Cooperative (fictional)  
**Project:** Supplier Onboarding Workspace  
**Period:** February 2026  
**Status:** Delivered checklist workflow  
**Document version:** 1

## Purpose and problem

Threadline Delivery built a workspace for checking supplier documents. It distinguished an incomplete checklist, a review in progress, and a supplier accepted for the client's directory.

Purchasing staff collected supplier contact details and business documents in email threads. A filled form was sometimes mistaken for a completed review. The client needed a visible checklist with the identity of the person who checked each document. The software was intended to organize the client's own process, not certify a supplier or perform independent due diligence.

## People and responsibilities

A coordinator created a supplier record and attached document references. A reviewer recorded whether required items were present and readable. A directory administrator accepted or declined the record for internal use. A supplier could appear in the directory only after the assigned review was complete. Directory acceptance did not authorize a purchase or verify bank-account ownership.

## Agreed workflow

Records moved from collecting documents to under review and then accepted or declined. Missing items kept the checklist incomplete. Replacing a reviewed document invalidated that item's check and reopened review. The supplier directory showed both current review state and the version of the checklist used, so that a later change in required items could be explained.

## Boundaries and constraints

The workspace used PostgreSQL records and private document storage. Reviewers could access only their assigned work queue. The pilot did not automate identity checks, risk scoring, bank validation, order placement, or payment authorization. Staff still made the acceptance decision, and external documents could be wrong even when the application successfully stored and displayed them.

## How to read this brief

This brief records the agreed scope or, where explicitly marked, the proposed scope. It is not by itself a delivery certificate. The implementation notes explain decisions and examples; the separate delivery review records what was actually delivered, tested, paused, or left unresolved. Read those documents together before describing a requirement as completed work.
