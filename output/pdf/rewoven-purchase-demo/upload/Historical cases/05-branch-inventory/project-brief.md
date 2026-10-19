# Branch Inventory Request Portal - Project brief

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Hillcrest Distribution (fictional)  
**Project:** Branch Inventory Request Portal  
**Period:** March 2026  
**Status:** Delivered branch-scoped pilot  
**Document version:** 2

## Purpose and problem

Threadline Delivery built a branch inventory request portal. Branch staff saw their own records, while explicitly assigned central reviewers could inspect requests across branches.

Branch staff requested stock transfers using a shared spreadsheet. Filters were convenient for navigation but did not prevent someone from opening another branch's record. The client wanted clear branch ownership and a central review role. The project concerned internal stock-transfer requests, not purchasing new stock from suppliers or recording financial approval.

## People and responsibilities

A branch requester belonged to an active branch assignment. A branch lead reviewed local requests. A central reviewer had an explicit cross-branch assignment. A support operator could investigate an access error without granting a requester central privileges. Staff with multiple branch assignments had to choose the branch for a new request rather than inheriting the last branch used by another screen.

## Agreed workflow

The requester selected an assigned branch and submitted requested stock quantities. The server stored branch ownership on the request. List, detail, edit, and review operations all checked the active user assignment. Central review listed only records allowed by the central role. A browser-provided branch identifier was a requested scope, not evidence that the user had permission to use it.

## Boundaries and constraints

The portal used existing sign-in and PostgreSQL. Branch assignment came from an administrator-maintained table. The first release did not synchronize assignments with a corporate directory or manage staff transfers automatically. The client also retained its stock ledger outside this application. An approved transfer request did not prove that a movement had physically occurred.

## How to read this brief

This brief records the agreed scope or, where explicitly marked, the proposed scope. It is not by itself a delivery certificate. The implementation notes explain decisions and examples; the separate delivery review records what was actually delivered, tested, paused, or left unresolved. Read those documents together before describing a requirement as completed work.
