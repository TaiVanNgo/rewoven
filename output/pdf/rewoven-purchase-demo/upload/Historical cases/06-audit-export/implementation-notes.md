# Audit Export Dashboard - Implementation notes

Fictional demonstration material. All organizations, people, events, and results are invented.

**Delivery company:** Threadline Delivery  
**Client:** Finch Service Operations (fictional)  
**Project:** Audit Export Dashboard  
**Period:** April 2026  
**Status:** Delivered operational review export  
**Document version:** 1

## Decision and rationale

Application users could append new events through normal state transitions but could not edit or delete earlier events through the dashboard. Corrections were new events referencing the earlier record. The team deliberately used append-only at the application layer rather than claiming that this design alone established immutable infrastructure or formal compliance.

## Technical behavior

An event contained event_id, record_id, revision, actor_id, action, previous_state, next_state, and occurred_at. The export job also stored its requesting reviewer, scope, cutoff, and count. Access filtering applied before export. For text that began with spreadsheet formula characters, the CSV writer emitted a safe text representation so exported notes could not become active spreadsheet formulas.

## Worked example

A reviewer exported one team's request history through the recorded cutoff. A later approval created a new event but did not change the already generated file. A correction to a request reason appeared as a later correction event rather than rewriting the original event. Another team's records were absent because the reviewer did not have access to that scope.

## Verification scope

Acceptance checks compared exported rows with the selected scope and cutoff, checked actor and revision fields, tested a later event, and opened hostile-looking cell text as text. These were functional checks of the pilot exporter. They did not assess external audit standards, disaster recovery, long-term retention, or privileged-administrator tampering.

## Handover material

The retained material is an event-field checklist, cutoff example, export permission check, and safe-cell test. A future team can use these to design an explainable request history. It still needs agreement on who may export, which sensitive fields are excluded, how long records are retained, and how large exports should be delivered.
