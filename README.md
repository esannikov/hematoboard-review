# HematoBoard

<!-- markdownlint-disable MD013 MD033 MD036 -->

## Agentic AI for Traceable Hematology Review

**Research preview · clinician-in-the-loop testing · code coming soon**

[Inspect the architecture map](./diagrams/hematoboard-trace-system.svg)

HematoBoard is an experimental clinical evidence environment for studying how
agentic AI can assist the review of long, heterogeneous hematology records while
preserving provenance and clinician authority. It reconstructs scanned reports,
laboratory tables, pathology, imaging and clinical narrative as a versioned case
state. Candidate hypotheses appear beside the observations and external sources
that support, challenge or contextualize them. Missing verification remains
visible throughout the review.

The research asks whether an agentic system can make complex clinical reasoning
more inspectable: **can every material statement retain a path to its source,
its interpretive status, its unresolved alternatives and the decision that
allowed it to enter the accepted record?**

HematoBoard approaches this question through a controlled relation between
local document recognition, strict structured data, an accepted evidence
ledger, proposition-level literature review, bounded AI Agent synthesis,
deterministic projection checks and explicit clinician decisions. Each layer
produces its own artifact. Their separation preserves the difference between a
recorded observation, a source author's conclusion, external evidence, a case
interpretation, a working hypothesis and an accepted clinical revision.

## System map

<p align="center">
  <a href="diagrams/hematoboard-trace-system.svg">
    <img src="diagrams/hematoboard-trace-system.png" width="900" alt="HematoBoard architecture separating deterministic control, local model inference, agentic reasoning, the dashboard output and clinician authority">
  </a>
  <br>
  <sub><strong>Figure 1.</strong> HematoBoard controlled architecture. Blue marks deterministic control; indigo local model inference; purple AI Agent work; amber hybrid verification; teal immutable state; green clinician authority; muted blue the review surface; and coral the primary system output—the read-only HematoBoard Dashboard. Feedback paths create new receipts and revisions while preserving earlier history.</sub>
</p>

<p align="center"><a href="https://raw.githubusercontent.com/esannikov/hematoboard/main/diagrams/hematoboard-trace-system.png">Open full-size PNG</a> · <a href="https://raw.githubusercontent.com/esannikov/hematoboard/main/diagrams/hematoboard-trace-system.svg">Open scalable SVG</a></p>

The map is intentionally non-linear. Source review can reopen one bounded crop.
A reasoning candidate can generate a new evidence question. An accepted
revision begins a new hash-pinned cycle. The append-only receipt plane records
input and output hashes, privacy checks, agent results, tool actions and phase
time across these paths.

## Three working surfaces

<table>
  <tr>
    <td width="33.33%" valign="top">
      <a href="assets/research-preview/hematoboard-overview.png"><img src="assets/research-preview/hematoboard-overview.png" alt="HematoBoard patient overview"></a><br>
      <sub><strong>Figure 2. Case overview.</strong> Accepted patient state, a separate reasoning candidate, its principal limitation and the verification steps that could change the interpretation.</sub>
    </td>
    <td width="33.33%" valign="top">
      <a href="assets/research-preview/hematoboard-timeline.png"><img src="assets/research-preview/hematoboard-timeline.png" alt="HematoBoard clinical timeline"></a><br>
      <sub><strong>Figure 3. Clinical timeline.</strong> Canonical dates and source records remain connected; undated findings retain their uncertainty outside the dated sequence.</sub>
    </td>
    <td width="33.33%" valign="top">
      <a href="assets/research-preview/hematoboard-graph.png"><img src="assets/research-preview/hematoboard-graph.png" alt="HematoBoard typed evidence graph"></a><br>
      <sub><strong>Figure 4. Typed evidence graph.</strong> Supporting, challenging and contextual relations organize an inspectable clinical argument. Edge counts carry no diagnostic probability.</sub>
    </td>
  </tr>
</table>

These surfaces show the de-identified CASE-02 demonstrator in Ukrainian. The
overview presents the current case state and its candidate interpretation. The
timeline makes provenance and temporal uncertainty legible. The graph exposes
the structure of the clinical argument without compressing it into an opaque
score. Together they provide three readings of the same versioned material.

## Clinical reasoning as a provenance problem

A difficult hematology case often spans several institutions, laboratories,
modalities and episodes of care. Values appear under different reference
intervals. Narrative conclusions can outlive the evidence that originally
supported them. A later pathology report may reorganize the meaning of an
earlier imaging finding. Missing tissue, staging or molecular data can remain
clinically decisive even when the record already contains hundreds of pages.

HematoBoard treats the accepted case as a ledger of addressable observations.
Every observation has a stable identifier and may carry a document identity,
page or crop, source text, normalized value, unit, comparator, local reference
interval, effective date, verification state and privacy status. Interpretive
objects refer to those identifiers. External evidence uses its own receipts.
Candidate reasoning is stored in a separate immutable revision with a hash of
the clinical projection it received.

This separation gives the dashboard a precise role. The interface is the
primary public output of the system and a read-only projection of accepted data
and candidate reasoning. It has no authority to create a clinical fact, alter a
source receipt or record a clinician decision. A separate clinician review
surface opens proposed changes together with their supporting records. Accepted
changes create a new hash-pinned ledger revision and preserve the earlier state.

The resulting architecture is close to the entity–activity–agent logic of W3C
PROV-O, adapted to a smaller clinical contract. The central objects are source
records, structured observations, external propositions, reasoning revisions,
review actions and accepted states. Their lineage remains inspectable across
document processing, synthesis and presentation.

## Two implemented verification rules

Two runtime checks benefit from compact formal notation: exact projection
closure and reasoning freshness. Both equations describe implemented software
tests. They carry no diagnostic or prognostic score.

### Field-level projection closure

Let $O_L$ be the observation identifiers in the accepted ledger and $O_D$ the
identifiers found in the rendered document object model. The projection test
first requires identical sets:

$$
O_D = O_L
$$

For every accepted observation $o$ and every audited field $f$, the rendered
value $D(o,f)$ must equal the ledger value $L(o,f)$:

$$
\forall o \in O_L,\ \forall f \in F:\ D(o,f) = L(o,f)
$$

The runtime compares display text, numeric and textual results, units,
reference intervals, interpretations, source addresses, dates, comparators and
verification flags. It also checks the complete reasoning revision and rejects
case-specific clinical literals embedded in page code.

### Reasoning freshness

The clinical input is a canonical projection $\pi_c(B)$ of accepted bundle
$B$. Let $H$ denote SHA-256 over the canonical JSON bytes of that projection.
The reasoning revision records:

$$
h_R = H(\pi_c(B))
$$

A candidate is current when its recorded $h_R$ equals the hash recalculated
from the active clinical projection. Presentation state, prior ranking and
earlier hypotheses stay outside this input. A clinically relevant bundle change
makes the earlier candidate stale. External evidence receipts and the candidate
body remain bound by the immutable reasoning-revision hash.

### Promotion boundary and typed relations

Promotion is described as a transaction because the runtime evaluates concrete
preconditions rather than a numerical function. The requested parent revision
must still be current, eligible changes must carry a recorded clinician action,
and the source bundle hash must remain pinned. The transaction materializes and
hashes a new revision manifest, updates the current-revision pointer through an
optimistic concurrency check and preserves the parent revision. A failed
precondition leaves the reasoning revision in candidate state.

Typed clinical relations are represented directly as records. Each edge stores
a hypothesis identifier, an evidence identifier, a relation type and a
rationale. The dashboard graph is a projection of those records; the runtime
does not calculate a graph-derived probability or diagnostic score.

## One case as a controlled episode

Each case cycle is recorded as a traceable episode. The sequence establishes
the dependency of one artifact on another while allowing targeted loops for
source correction, evidence questions and revised accepted states.

1. **Register the source set.** An operator places the minimum-necessary
   documents in a private case workspace. File identity, page inventory,
   hashes, document type, dates and phase time enter the action protocol.
2. **Extract atomic observations.** Local recognition separates measurements,
   findings, source conclusions, recommendations and events while retaining
   page and word coordinates.
3. **Normalize measurements.** Structured JSON binds each result to its unit,
   comparator, local reference interval, source row, date and original literal.
4. **Establish clinical facts.** Verified observations become concise,
   source-addressed facts with explicit evidence classes and stable IDs.
5. **Broaden the candidate field.** A context-shielded AI Agent reads the
   cleaned facts without previous ranking and develops a wide differential with
   dangerous alternatives and missing data.
6. **Review external evidence.** Narrow questions guide retrieval from PubMed,
   DOI records, professional societies, classifications and permitted local
   guideline corpora. Exact propositions receive source and applicability
   receipts.
7. **Construct typed relations.** Facts connect to hypotheses through explicit
   supporting, challenging or contextual edges. Each relation records its
   rationale and source addresses.
8. **Perform critical review.** A separate pass examines contradictions,
   neglected alternatives, weak evidence, source limits, stale inputs and
   over-strong language.
9. **Create the candidate revision.** The system writes an immutable synthesis
   with its input hash, method version, hypotheses, relations, verification
   plan, critical gaps and limitations. Deterministic projection closure then
   prepares the candidate for clinician review.

The clinician can accept, correct, reject or defer proposed changes. Acceptance
creates a new ledger revision. Rejection and deferral preserve the candidate,
its evidence and the decision rationale as audit history.

### Current modules

The table documents the research architecture while the private clinical
runtime is being prepared for a later sanitized release. AI Agent names identify
bounded reasoning roles; runtime surfaces identify deterministic controls.

| Stage | Agent or runtime surface | Responsibility | Recorded result |
| --- | --- | --- | --- |
| Private intake | Case-scoped intake and inventory | Isolates source files, inventories pages, records hashes and phase time | Private source manifest and action receipt |
| Local recognition | **Apple Vision OCR** | Reads text, confidence, line geometry and word coordinates on-device | Immutable page text and coordinate map |
| Structure | Structured JSON projection | Reconstructs table rows as analyte, result, unit, comparator and reference with word receipts | Hash-pinned structured source candidate |
| Privacy | De-identification and semantic privacy audit | Removes unnecessary identifiers while preserving row IDs and source geometry | De-identified structured layer and privacy receipt |
| Source review | **Terra visual readers** with deterministic consensus | Reads bounded privacy-screened crops and replays exact word IDs into fields | Field consensus or targeted exception |
| Clinical state | Accepted evidence ledger | Stores versioned measurements, findings, dates, interpretations and provenance | Canonical `case_bundle.json` revision |
| Evidence research | Research AI Agent and source reviewer | Finds narrow external propositions and checks source meaning, licence and applicability | Proposition-level evidence receipts |
| Candidate synthesis | Controlled AI Agent protocol | Develops, grounds, reconciles and critiques hypotheses from accepted facts and reviewed evidence | Immutable reasoning revision |
| Projection | Projection and DOM closure | Builds dashboard and review views and checks every rendered field against its source artifact | Technical projection receipt |
| Presentation | **HematoBoard Dashboard** | Displays accepted state and a separate candidate across overview, timeline and graph | Read-only case projection |
| Clinical review | Clinician review application | Opens source-linked proposed changes and records the responsible clinician's action | Accept, correct, reject or defer decision |
| Promotion | Controlled state transaction | Validates unchanged inputs and materializes an approved revision atomically | New accepted state with parent hash |

## Reading difficult clinical documents

Document reconstruction is treated as measurement transfer. Apple Vision runs
locally on macOS with Ukrainian, Russian and English recognition settings. It
returns recognized strings, confidence and bounding regions. The original PDF
remains the pixel source of truth, while optimized renders and coordinate
transforms provide bounded working surfaces for verification.

Spatial structure is resolved before de-identification. A laboratory row binds
the analyte, result, unit, comparator and reference interval to one row identity.
Repeated triplet layouts and paired echocardiography grids retain their own
column logic. Strict JSON carries field bounding boxes, word IDs, page hashes
and row/column invariants. Markdown serves as a human-readable projection of
that JSON.

Recognition output remains immutable. A correction such as Cyrillic `ч` in a
sex-specific reference interval receives an append-only overlay linked to the
exact word ID, bounding box, crop, page hash, reader and timestamp. Derived
tables replay the overlay while preserving the raw recognition artifact.

Ambiguous fields can be submitted as minimum-necessary, privacy-screened crops
to two or more independent multimodal readers. Deterministic consensus checks
crop hashes, geometry manifests and exact word assignment. Agreement produces a
machine-verification receipt. Disagreement, low confidence or an incomplete
required field produces one targeted exception for review.

## From PubMed and guidelines to case evidence

External evidence enters HematoBoard as a collection of reviewable
propositions. An AI Agent formulates narrow clinical questions and discovers
candidate sources through PubMed, DOI records, professional-society sites,
official classifications and permitted local corpora. Deterministic lookup then
returns the source location used for verification.

A proposition-level receipt records one clinical statement together with its
source identity and version, page or section, evidence type, licence and
model-use status, case applicability and reviewer. A PMID, title or search rank
has discovery status until this receipt is complete. Guideline concordance,
diagnostic classification, stage and treatment indication require explicit
applicability to the case.

Prepared guideline corpora may use a case-local SQLite full-text index to locate
terms and passages. Full-text search has a retrieval role. Source interpretation
and applicability remain separate reviewed activities. Documents with
restrictive licences stay within the local workspace.

Guideline quality and reporting can be appraised with instruments such as AGREE
II. Disease-specific classifications and practice guidelines retain their
edition and date because diagnostic categories, staging definitions and
recommendations change over time.

## Agentic synthesis under bounded authority

The synthesis AI Agent receives a minimum-necessary clinical projection. Raw
PDFs, direct identifiers, interface state, prior ranking and clinician decisions
remain outside the initial breadth pass. Subsequent stages connect each material
claim to accepted observation IDs and allowed external evidence, expose
contradictions and missing data, and apply a separate safety critique.

The output is an immutable candidate revision. It records its input snapshot,
method version, hypotheses, typed relations, work-up questions, gaps,
limitations, comparison with the prior revision and audit chain. The accepted
ledger remains under controlled promotion. The clinician review surface presents
the candidate together with the evidence needed to evaluate it.

Research on human susceptibility to erroneous AI advice motivates this visible
separation of accepted state, AI Agent interpretation and clinician authority.
The design supports disagreement, abstention and revision as first-class
outcomes of the workflow.

## Privacy and cloud processing

HematoBoard uses a local-first privacy boundary organized around data
minimization, purpose limitation and traceable disclosure.

- Raw PDFs, page renders, direct identifiers and re-identification mappings stay
  in private case quarantine.
- Apple Vision performs recognition locally.
- De-identification is applied to the structured layer after table and coordinate
  relationships have been preserved.
- A cloud AI Agent receives an approved de-identified clinical projection or a
  tightly bounded crop cleared for its specific operation.
- Provider adapters remain closed until isolation and data-boundary checks pass.
- Licensed guideline text stays local when its terms restrict external model
  processing.
- Material transformations retain version, hash, operation and responsible
  human or agent identity.
- AI Agent results enter candidate state and acquire clinical authority only
  through an explicit clinician decision and controlled promotion transaction.

De-identification reduces disclosure risk while institutional, legal, security
and ethics governance remains necessary. Planned experiments will compare local
multimodal and language models for crop adjudication, evidence synthesis and
safety critique under the same receipt and projection contracts.

## Sources and methods

| Layer | Source families | Recorded control |
| --- | --- | --- |
| Patient record | Laboratory, pathology, imaging, procedures and clinical narrative | Document, page or crop, field structure, date, verification and privacy status |
| Literature | PubMed, DOI records and peer-reviewed articles | Citation, evidence type, exact proposition, applicability and retrieval receipt |
| Guidelines | Official societies, classifications, institutional or licensed local PDFs | Edition, date, page or node, licence, model-use permission and review status |
| Provenance | Versioned JSON, SHA-256, immutable revisions and typed graph relations | Input/output identity, lineage, responsible agent and projection closure |
| Human authority | Source review and final clinician decision | Append-only acceptance, correction, rejection or deferral |

## Research status

HematoBoard is in controlled clinician-in-the-loop testing with prepared,
de-identified case packages. Current evaluation concerns source reconstruction,
measurement transfer, evidence traceability, reasoning freshness, projection
closure and clinician-facing review ergonomics.

External clinical validation, prospective effectiveness evaluation, regulatory
qualification and deployment performance remain future stages. Planned studies
separate exact field transfer, provenance failures, appropriate AI Agent
abstention, correction recovery, clinician review time, decision disagreement
and usability. Each outcome retains its own interpretation and limitation.

The screenshots document a de-identified research demonstrator. Case packages,
runtime data and clinician decisions remain inside the controlled workspace.
Diagnosis, staging, treatment and clinical promotion remain the responsibility
of the treating team after review of the complete primary record.

## Code coming soon

This repository publishes the research article and its figures. Clinical case
packages, dashboard runtime data, source-review tools and clinician-acceptance
state remain within the controlled development environment.

Reusable schemas, validators and a sanitized reference pipeline are planned for
a later code release after the interfaces and privacy boundary stabilize.

## Author

**Eugene Sannikov**<br>
System architecture, provenance method, AI Agent workflow and interface research<br>
[ORCID 0009-0008-9917-8461](https://orcid.org/0009-0008-9917-8461)

Clinical development proceeds with specialist review. Collaboration in
hematology, pathology, clinical informatics, privacy, human factors and
prospective evaluation is welcome.

## References

Apple. (n.d.). *Recognizing text in images*. Apple Developer Documentation.
<https://developer.apple.com/documentation/vision/recognizing-text-in-images>

Brouwers, M. C., Kho, M. E., Browman, G. P., Burgers, J. S., Cluzeau, F.,
Feder, G., Fervers, B., Graham, I. D., Grimshaw, J., Hanna, S. E., Littlejohns,
P., Makarski, J., Zitzelsberger, L., & AGREE Next Steps Consortium. (2010).
AGREE II: Advancing guideline development, reporting and evaluation in health
care. *Journal of Clinical Epidemiology, 63*(12), 1308–1311.
<https://doi.org/10.1016/j.jclinepi.2010.07.001>

Campo, E., Jaffe, E. S., Cook, J. R., Quintanilla-Martinez, L., Swerdlow, S. H.,
Anderson, K. C., et al. (2022). The International Consensus Classification of
Mature Lymphoid Neoplasms: A report from the Clinical Advisory Committee.
*Blood, 140*(11), 1229–1253. <https://doi.org/10.1182/blood.2022015851>

d'Amore, F., Federico, M., de Leval, L., Ellin, F., Hermine, O., Kim, W. S.,
Lemonnier, F., Vermaat, J. S. P., Wulf, G., Buske, C., Dreyling, M., & Jerkeman,
M. (2025). Peripheral T- and natural killer-cell lymphomas: ESMO–EHA Clinical
Practice Guideline for diagnosis, treatment and follow-up. *Annals of Oncology,
36*(6), 626–644. <https://doi.org/10.1016/j.annonc.2025.01.023>

European Parliament & Council of the European Union. (2016). *Regulation (EU)
2016/679 (General Data Protection Regulation), Article 5*. Official Journal of
the European Union. <https://eur-lex.europa.eu/eli/reg/2016/679/oj>

Gaube, S., Suresh, H., Raue, M., Merritt, A., Berkowitz, S. J., Lermer, E.,
Coughlin, J. F., Guttag, J. V., Colak, E., & Ghassemi, M. (2021). Do as AI say:
Susceptibility in deployment of clinical decision-aids. *npj Digital Medicine,
4*, 31. <https://doi.org/10.1038/s41746-021-00385-9>

National Institute of Standards and Technology. (2015). *Secure Hash Standard
(SHS)* (FIPS PUB 180-4). <https://doi.org/10.6028/NIST.FIPS.180-4>

Vasey, B., Nagendran, M., Campbell, B., Clifton, D. A., Collins, G. S., Denaxas,
S., et al. (2022). Reporting guideline for the early-stage clinical evaluation
of decision support systems driven by artificial intelligence: DECIDE-AI.
*Nature Medicine, 28*, 924–933.
<https://doi.org/10.1038/s41591-022-01772-9>

World Health Organization. (2021). *Ethics and governance of artificial
intelligence for health: WHO guidance*. World Health Organization.
<https://www.who.int/publications/i/item/9789240029200>

World Wide Web Consortium. (2013). *PROV-O: The PROV Ontology* (W3C
Recommendation). <https://www.w3.org/TR/prov-o/>

---

HematoBoard supports structured review and clinical discussion. Final clinical
responsibility remains with the treating team after review of the complete
primary record.
