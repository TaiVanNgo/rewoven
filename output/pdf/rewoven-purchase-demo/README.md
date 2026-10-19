# Rewoven purchasing demo pack

Nine projects from one fictional delivery company, Threadline Delivery, followed by a new request from fictional Northbank Services. Version 2 adds engineering reconstructions with architectures, data models, API examples, illustrative code, failure traces, and technical references. These are not runnable applications or verified real-world delivery records.

- upload/Historical cases: 9 case folders, 3 source documents per case (27 total).
- upload/Client input: client-brief.pdf and constraints.md (2 total). Upload these to a new chat; the default Case library already includes the historical projects.
- presenter-only: story, walkthrough, reference rubric, and evidence map. Do not upload these as AI evidence.

All names, incidents, and results are invented. This pack demonstrates a workflow, not real business demand or measured organizational impact. Existing built-in cases already hold the historical files. To recreate a case manually, upload all three files from one historical folder as one case. Do not upload the ZIP directly.

Run the repository's scripts/demo/build-pack.py with Python and reportlab to regenerate sources, PDFs, manifest, and ZIPs. It reads scripts/demo/purchase-projects.json and scripts/demo/engineering/. The PDFs use selectable text and physical page numbers. Read docs/features/purchasing-demo.md and docs/features/engineering-case-evidence.md in the repository for developer setup and verification limits.
