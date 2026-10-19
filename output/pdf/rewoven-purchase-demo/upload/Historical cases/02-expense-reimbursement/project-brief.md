# Expense Reimbursement Portal - Project brief

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Seabrook Advisory (fictional)  
**Project:** Expense Reimbursement Portal  
**Period:** February 2026  
**Status:** Delivered internal pilot after retry defect repair  
**Document version:** 2

## Purpose and problem

Threadline Delivery built an expense-claim portal. Retry testing exposed duplicate claim creation, and a stable operation key plus a database constraint prevented the same operation from creating another claim.

Consultants submitted receipt details from mobile browsers. A slow response made it unclear whether the server had received a claim, so users pressed Send again or retried after reconnecting. An early prototype treated each HTTP request as a new claim. The business needed reliable recording of a claim before any separate human reimbursement process could begin.

## People and responsibilities

An employee entered the amount, reason, and receipt reference. A reviewer checked a claim and marked it ready for the payroll team's separate process. A support operator investigated unclear submissions using an operation identifier. The portal did not connect to a bank, initiate a payment, or decide whether an expense met a tax rule. Those were outside the software pilot.

## Agreed workflow

The browser created a submission identifier when the employee began sending a completed claim. The identifier stayed the same while retrying that operation. If the first attempt committed but its response was lost, a retry returned the recorded claim instead of inserting another. An intentional second claim used a new identifier, even if its amount happened to be the same.

## Boundaries and constraints

The team used a browser form, a server API, and PostgreSQL. Disabling the Send button was helpful feedback but could not enforce uniqueness across reconnects, multiple browser events, or concurrent requests. The requirement concerned duplicate claim records for the same operation, not detection of a person intentionally submitting a receipt twice with different identifiers. No offline queue was included.

## How to read this brief

This brief records the agreed scope or, where explicitly marked, the proposed scope. It is not by itself a delivery certificate. The implementation notes explain decisions and examples; the separate delivery review records what was actually delivered, tested, paused, or left unresolved. Read those documents together before describing a requirement as completed work.
