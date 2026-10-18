"""Rebuild the fictional purchasing pack with the bundled Python/reportlab runtime."""
import hashlib
import json
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "output/pdf/rewoven-purchase-demo"
UPLOAD = PACK / "upload"
PRESENTER = PACK / "presenter-only"
COMPANY = "Threadline Delivery"
DISCLAIMER = "Fictional demonstration material. All organizations, people, events, and results are invented."
PROJECTS = json.loads((Path(__file__).parent / "purchase-projects.json").read_text())
STYLES = getSampleStyleSheet()
STYLES.add(ParagraphStyle(name="PackTitle", fontName="Helvetica-Bold", fontSize=22, leading=27, textColor=colors.HexColor("#203C3A"), spaceAfter=14))
STYLES.add(ParagraphStyle(name="PackSub", fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=colors.HexColor("#28665C"), spaceBefore=15, spaceAfter=8))
STYLES.add(ParagraphStyle(name="PackBody", fontName="Helvetica", fontSize=10.5, leading=16, alignment=TA_LEFT, spaceAfter=10))
STYLES.add(ParagraphStyle(name="PackSmall", fontName="Helvetica", fontSize=8.5, leading=12, textColor=colors.HexColor("#4B615B"), spaceAfter=8))


def para(text, style="PackBody"):
    return Paragraph(escape(text), STYLES[style])


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#B9CFC6"))
    canvas.line(20 * mm, 18 * mm, 190 * mm, 18 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#4B615B"))
    canvas.drawString(20 * mm, 12 * mm, "Threadline Delivery | Fictional demo | Version 1")
    canvas.drawRightString(190 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def pdf(path, title, subtitle, pages):
    path.parent.mkdir(parents=True, exist_ok=True)
    story = []
    for i, sections in enumerate(pages):
        if i:
            story.append(PageBreak())
        story.extend([para(title if i == 0 else title + " / Review notes", "PackTitle"), para(subtitle, "PackSmall"), para(DISCLAIMER, "PackSmall")])
        for heading, paragraphs in sections:
            story.append(para(heading, "PackSub"))
            story.extend(para(p) for p in paragraphs)
        story.append(Spacer(1, 5 * mm))
    SimpleDocTemplate(str(path), pagesize=(210 * mm, 297 * mm), rightMargin=20 * mm, leftMargin=20 * mm, topMargin=17 * mm, bottomMargin=24 * mm, title=title, author=COMPANY, invariant=1).build(story, onFirstPage=footer, onLaterPages=footer)


def markdown(path, title, project, sections):
    text = f"# {title}\n\n{DISCLAIMER}\n\n**Delivery company:** {COMPANY}  \n**Client:** {project['client']} (fictional)  \n**Project:** {project['title']}  \n**Period:** {project['period']}  \n**Status:** {project['status']}  \n**Document version:** 1\n"
    for heading, paragraphs in sections:
        text += f"\n## {heading}\n\n" + "\n\n".join(paragraphs) + "\n"
    path.write_text(text)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


manifest = []
evidence_map = []
for p in PROJECTS:
    folder = UPLOAD / "Historical cases" / p["key"]
    folder.mkdir(parents=True, exist_ok=True)
    brief = folder / "project-brief.md"
    notes = folder / "implementation-notes.md"
    review = folder / "delivery-review.pdf"
    markdown(brief, p["title"] + " - Project brief", p, [
        ("Purpose and problem", [p["summary"], p["problem"]]),
        ("People and responsibilities", [p["users"]]),
        ("Agreed workflow", [p["workflow"]]),
        ("Boundaries and constraints", [p["constraints"]]),
        ("How to read this brief", ["This brief records the agreed scope or, where explicitly marked, the proposed scope. It is not by itself a delivery certificate. The implementation notes explain decisions and examples; the separate delivery review records what was actually delivered, tested, paused, or left unresolved. Read those documents together before describing a requirement as completed work."])
    ])
    markdown(notes, p["title"] + " - Implementation notes", p, [
        ("Decision and rationale", [p["decision"]]),
        ("Technical behavior", [p["detail"]]),
        ("Worked example", [p["example"]]),
        ("Verification scope", [p["test"]]),
        ("Handover material", [p["handover"]])
    ])
    pdf(review, p["title"], f"Delivery review | {p['client']} | {p['period']} | {p['status']}", [
        [("Recorded status and result", [p["result"]]), ("What happened during delivery", [p["incident"]]), ("Checks and their scope", [p["test"]])],
        [("Lesson retained by the team", [p["lesson"]]), ("Missing evidence and exclusions", [p["gap"]]), ("Handover and reuse boundary", [p["handover"]]), ("Reading this result", ["This review describes a fictional project record. A limited acceptance check is not proof of future reliability or a measured business benefit. A proposal is not a delivered feature. Where the review states that work was paused, excluded, or unmeasured, that boundary remains part of the record."])]
    ])
    sources = [{"key": key, "file": str(path.relative_to(ROOT)), "sha256": digest(path)} for key, path in [("brief", brief), ("notes", notes), ("review", review)]]
    def finding(text, source, quote, page=None):
        return {"text": text, "evidence": [{"source": source, "page": page, "quote": quote}]}
    proposal = p["key"].startswith("09")
    sections = {
        "summary": [finding(p["summary"], "brief", p["summary"])],
        "problem": [finding(p["problem"], "brief", p["problem"])],
        "approach": [finding(p["decision"], "notes", p["decision"])],
        "results": [] if proposal else [finding(p["result"], "review", p["result"], 1)],
        "lessons": [finding(p["lesson"], "review", p["lesson"], 2)],
        "gaps": [finding(p["gap"], "review", p["gap"], 2)]
    }
    manifest.append({"key": p["key"], "title": p["title"], "sources": sources, "sections": sections})
    evidence_map.append({"case": p["title"], "status": p["status"], "result": p["result"], "lesson": p["lesson"], "gap": p["gap"], "reviewFile": str(review.relative_to(PACK)), "resultPage": 1, "lessonAndGapPage": 2})

inputs = UPLOAD / "Client input"
inputs.mkdir(parents=True, exist_ok=True)
pdf(inputs / "client-brief.pdf", "Northbank branch purchasing", "New client request | Northbank Services (fictional) | Proposed work, not project history", [
    [("Why we need a tool", ["Northbank Services operates three branches. Staff currently send purchase requests in email and cannot consistently tell which version a manager approved. We want a mobile-friendly browser tool for a four-week pilot. A requester should enter line items, quantities, unit prices in VND, and a reason, then see a clear review status. This request describes work we want built; it is not evidence that Threadline Delivery has already delivered it."]),
     ("Approval rules for the pilot", ["Every submitted purchase request needs approval from its assigned branch manager. A request whose tax-inclusive total is VND 10,000,000 or more also needs finance approval after manager approval. Below VND 10,000,000, manager approval is sufficient. The server must calculate the total from line items. The requester cannot approve their own request, and a finance-stage decision must be made by someone other than the manager who approved it.", "Both decisions must apply to the same request revision. Changing line items, quantities, prices, or tax after submission invalidates earlier approvals and restarts manager review. A rejected request must clearly show its rejection and reason. Approval authorizes the request only; it does not mean an order was placed, goods arrived, or payment was made."])],
    [("Mobile use and record access", ["Branch staff sometimes lose connectivity just after pressing Send. Retrying the same submission must not create duplicate purchase requests. The tool should explain whether a request was recorded, still needs sending, or failed. The pilot does not require a full offline drafting and synchronization system.", "Requesters and branch managers should see only the requests permitted by their current branch assignments. Explicitly assigned central finance reviewers may review requests across the three branches. Copying a link or changing a branch identifier must not grant access. Northbank will provide the employee identity through existing sign-in, but responsibility for maintaining assignments still needs agreement."]),
     ("History, export, and open questions", ["For submission, edits, approvals, and rejection, retain who acted, when the server recorded the action, which request revision was involved, and the state change. Authorized reviewers need an export with an explicit scope and time range. Corrections should not erase earlier events. We have not chosen a retention duration or established any formal compliance standard.", "Please propose a small pilot plan, show which previous work informs it, explain what changes for these approval rules, and identify missing decisions. We have not agreed delegated approval, peak traffic, supplier onboarding, or integration with an accounting system. Do not assume those features are part of the pilot."])]
])
(inputs / "constraints.md").write_text("""# Northbank purchasing pilot - constraints

Fictional demonstration material. This is a new client request, not a historical project outcome.

## Delivery scope

Northbank Services asks Threadline Delivery to propose a four-week pilot for three branches. Use Next.js and PostgreSQL, the existing employee sign-in, and a mobile browser interface. These are requested constraints, not evidence that the four-week delivery is feasible. The team should identify sequencing, dependencies, and risks before committing to an estimate.

## Rules that must remain in the plan

- A manager reviews every submitted request. Finance reviews it afterwards when its tax-inclusive total is VND 10,000,000 or above; exactly VND 10,000,000 takes both stages.
- The requester cannot approve their own request. The finance reviewer must differ from the approving manager.
- A line-item, quantity, price, or tax edit invalidates existing approvals and restarts manager review for the new revision.
- Retrying the same submission after a lost response must not create another purchase request. A new intentional request is a different operation.
- Branch access must be enforced on the server. Explicitly assigned central finance reviewers may inspect and review across branches.
- Retain actor, server timestamp, action, revision, and state changes. Exports must state their authorized scope and time range.

## Explicit exclusions

No bank payments, automatic invoice posting, supplier-onboarding module, full offline synchronization, or accounting integration in this pilot. A purchase request is not proof of an order, delivery, or payment. This brief makes no compliance or tamper-proof claim.

## Questions to resolve with Northbank

Who maintains manager and finance assignments? Is delegation permitted, and for which actions? How long must records and exports be retained? What peak number of simultaneous submissions should be tested? Which rejection and resubmission behavior do staff expect? No measured approval-time improvement is supplied.
""")

PRESENTER.mkdir(parents=True, exist_ok=True)
(PRESENTER / "evidence-map.json").write_text(json.dumps(evidence_map, indent=2) + "\n")
(ROOT / "supabase/fixtures/cases.json").write_text(json.dumps(manifest, indent=2) + "\n")
(PRESENTER / "story-and-walkthrough.md").write_text("""# Threadline Delivery: turn past work into a new plan

All material is fictional. Threadline Delivery is one software delivery company; the nine cases are projects it delivered or proposed for different fictional clients. Northbank Services is a new client. The full history is not one application, and the new request is not a tenth historical case.

## What the audience should understand

Northbank needs purchasing across branches. No previous project solves everything. Office Purchasing supplies revision-bound manager review; Expense Reimbursement supplies safe retries; Branch Inventory supplies server authorization; Audit Export supplies explainable history. Invoice Matching supplies a caution about unresolved exceptions and fallback claims. Supplier Onboarding is optional discovery material. Leave and Marketing are partial matches with different authority. Purchasing Expansion is a proposal, not a finished component.

## Prepare before the five-minute presentation

Follow docs/features/purchasing-demo.md in the repository. Seed the nine projects, index all 27 source documents, and use a fresh demo session. The default Case library already includes the nine projects. Do not attach individual cases: discovering useful cases across the nine-project collection is part of the story. Keep this presenter folder out of uploads. A hosted installation must be seeded and indexed separately from local development.

If demonstrating manual case creation, upload the three documents from ONE Historical cases folder as ONE case. Repeat for other projects only in a separate rehearsal session. Never upload the ZIP directly, the answer key, or client input to Case library. The built-in cases already contain all 27 originals.

## Five-minute narrative (processing time varies)

1. First 30 seconds: explain the company and Northbank's problem. Point out that the history includes delivered work, a failed pilot, and an unimplemented proposal.
2. Next 60 seconds: upload client-brief.pdf plus constraints.md from Client input into chat. Send: Which previous projects help with this request? Explain what we can reuse, what changes, and what is still unknown.
3. Next 60 seconds: ask: What can we learn from our past projects about preventing duplicate submissions when a connection drops after Send? Then inspect sources for the purchasing revision rule and reimbursement retry defect. A broad first answer may select only some useful projects; a targeted follow-up demonstrates further discovery. Show the PDF page and original text. Explain why a different project's lesson can transfer without making the two products identical.
4. Next 45 seconds: ask: Why isn't the marketing approval workflow enough, and was the purchasing expansion actually implemented? Expect qualified comparison with original sources, not a refusal to mention partial matches.
5. Remaining time: choose Draft reuse plan, review Northbank's requirements, generate, and inspect the draft. Edit one next step to add a meeting with the finance-assignment owner, Save, reload if time permits, and Export Markdown.

Rehearse first. Live reading and model latency may exceed these allocations; do not promise a five-minute runtime. A prepared chat can support a presentation, but say when a result was prepared earlier.

## Optional uncertainty and failure prompts

- What evidence shows this will reduce approval time? Expected: no measured improvement is established.
- Can we reuse a finished two-stage purchasing component from the expansion? Expected: no implementation was recorded; discuss its design questions separately.
- Did completing the invoice cycle prove the matching automation worked? Expected: no; manual fallback completed the cycle after the pilot stopped.
- What precedent do these cases provide for quantum gate error correction? Expected: no suitable precedent, not an invented connection.

## Reference plan: a review rubric, not an exact answer

A useful plan keeps the VND 10 million inclusive threshold, manager-then-finance ordering, separate actors, approval invalidation, safe retry, branch checks, and scoped event export. It proposes state/permission design, then a small vertical slice, then threshold/revision/retry/authorization/export tests and pilot review. It cites the historical sources behind reused patterns and client sources behind new requirements.

Historical facts, possible adaptations, and questions must remain distinct. A four-week request is not a proven estimate. Do not turn the proposal into delivered work, a staging test into production reliability, a manual fallback into automation success, or an application log into a compliance guarantee. Supplier onboarding and delegation remain questions, not silently added requirements.

## Sharing with judges through Google Drive

Upload Historical cases, Client input, and this separately labelled Presenter guide to a folder you own. Share a view/download link after checking access in a signed-out browser. Judges need only the two Client input files to try the preloaded demo. The historical folders let them inspect sources or recreate cases. Do not upload server environment files, private exports, sessions, or credentials. Google Drive is a distribution folder; Rewoven does not connect to it.

The upload-only ZIP contains the 29 inputs and no presenter answers. The complete pack ZIP contains a separately labelled presenter-only folder. Judge outputs may differ; use evidence-map.json to inspect support, not to demand identical phrasing.
""")
(PACK / "README.md").write_text("""# Rewoven purchasing demo pack

Nine projects from one fictional delivery company, Threadline Delivery, followed by a new request from fictional Northbank Services.

- upload/Historical cases: 9 case folders, 3 source documents per case (27 total).
- upload/Client input: client-brief.pdf and constraints.md (2 total). Upload these to a new chat; the default Case library already includes the historical projects.
- presenter-only: story, walkthrough, reference rubric, and evidence map. Do not upload these as AI evidence.

All names, incidents, and results are invented. This pack demonstrates a workflow, not real business demand or measured organizational impact. Existing built-in cases already hold the historical files. To recreate a case manually, upload all three files from one historical folder as one case. Do not upload the ZIP directly.

Run the repository's scripts/demo/build-pack.py with Python and reportlab to regenerate sources, PDFs, manifest, and ZIPs. The PDFs use selectable text and physical page numbers. Read docs/features/purchasing-demo.md in the repository for the developer setup and recorded verification.
""")
for name, root in [("rewoven-purchasing-inputs.zip", UPLOAD), ("rewoven-purchasing-complete-pack.zip", PACK)]:
    with zipfile.ZipFile(PACK / name, "w", zipfile.ZIP_DEFLATED) as z:
        for file in sorted(root.rglob("*")):
            if file.is_file() and file.suffix != ".zip":
                z.write(file, file.relative_to(root))
print(f"Prepared {len(manifest)} cases / {sum(len(p['sources']) for p in manifest)} historical documents / 2 client inputs.")
print(f"Pack: {PACK}")
