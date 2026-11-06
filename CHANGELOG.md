# Article revisions

## 2026-11-06 — Architecture passport and new diagram

- Added a concise system overview describing the input, patient-state authority, candidate output, code/model responsibilities and human decisions.
- Replaced the previous architecture layout with a newly composed three-phase diagram. It distinguishes code, AI model and human roles; separate patient and literature inputs; the graph reused by synthesis; independent critique; and the bounded repair loop.
- Added ten module contracts, deployment locations and eight change/recovery scenarios, preserving the distinction between implementation, per-case availability, technical verification and clinical acceptance.
- Added a structured architecture passport to the existing manifest. It describes the system without replacing the executable runtime registry.
- Generate the module table and architecture SVG/PNG from that passport with `scripts/build_architecture.py`; the publication verifier checks their agreement, module/flow identities and evidence references.
- Preserved the English and Ukrainian patient-graph illustrations and all clinical packages. No clinical synthesis was run.

## 2026-11-06 — English graph and functional overview

- Added an English presentation of the selected CASE011 graph, preserving the original Ukrainian asset, all node/edge identities, geometry, numeric values and unresolved-unit markers. Visible labels, accessible labels and tooltips are English; full source records remain unchanged.
- Expanded the overview of clinician tasks: hypothesis comparison, argument navigation, timeline/history, source inspection, reasoning narrative, decision audit, next checks and prepared briefings.
- Detailed format-aware private OCR/intake capabilities, word/crop provenance, table-field review and known completeness checks without claiming a validated recognition accuracy rate.
- Added the two patient/literature evidence trails and a concrete, explicitly limited example from the saved CASE011 hypothesis. Source linkage is distinguished from diagnostic confirmation and missing literature is explicit.
- Explained which artifacts are hash-bound at each handoff and what a hash does and does not establish. Added the corresponding labels to the architecture figure.
- Added current release-bound comparison and Reasoning captures and translation/topology checks to the publication verifier.

## 2026-11-06

- Updated the article and architecture figure to the current graph-backed workflow, with the patient graph and argument graph explained separately.
- Added source-format-specific review, explicit delegated DOCX authority, known extraction-completeness checks and clinical-time roles.
- Explained model-generated starting hypotheses, seven coverage questions, targeted source review, evidence matrices, confirmation versus priority, hypothesis continuity, workup outcomes and observation accountability.
- Updated the critic, bounded correction, current-dialogue model profile, batch budgeting and verified reuse descriptions.
- Replaced the future clinician gate with the implemented local review interface; kept public read-only access and actual unaccepted candidate status explicit.
- Added the author's selected CASE011 graph illustration unchanged. All 102 node IDs and 109 edge records were compared with the saved patient graph. No patient graph or clinical candidate was changed.
- Replaced the active screenshot references with current CASE011 browser-QA captures from release 0.2.9.50. The English demonstration is labelled historical.
- Rebuilt the manifest from the 20 public packages: seven typed patient projections, five candidate 1.4 packages, two intermediate graph-backed contracts and thirteen historical 1.1 contracts.
- Kept the missing run-bound synthesis method versions for CASE011 and CASE027 explicitly unknown after inspection. The current configured protocol and retrieval-policy versions are not substitutes for missing historical evidence.
- Added a repeatable publication verifier for asset hashes, local links, graph inventory, public-package identities and screenshot-to-QA bindings.

This documentation release does not resynthesize cases, alter the clinical runtime or backfill historical receipts. Clinical validation and regulatory qualification remain unestablished.

## 2026-08-27

Previous article snapshot, architecture method 2.5.3 and August public-case inventory. Preserved in Git history.
