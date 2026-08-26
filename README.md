# HematoBoard

<!-- markdownlint-disable MD013 MD033 MD036 -->

## Agentic AI for Traceable Hematology Review

**Live clinical dashboard · controlled synthesis method 2.5.3 · clinical-condition testing**

[Open the English CASE001 projection](https://esannikov.github.io/hematoboard-en/?case=case001)
· [open the current Ukrainian case set](https://esannikov.github.io/hematoboard/?case=case011-v2)
· [inspect the architecture map](./diagrams/hematoboard-trace-system.svg)

HematoBoard is an experimental clinical evidence environment for studying how
agentic AI can assist the review of long, heterogeneous hematology records while
preserving provenance and clinician authority. It reconstructs scanned reports,
laboratory tables, pathology, imaging and clinical narrative as a versioned case
projection, responding to established concerns about completeness, conformance and
plausibility when clinical data are reused across sources (Kahn et al., 2016;
Weiskopf & Weng, 2013). Candidate hypotheses appear beside the observations and
external sources that support, challenge or contextualize them. Missing
verification remains visible throughout the review.

The system is being tested in clinical conditions as a research workflow. This
is not completed clinical validation, regulatory qualification or evidence of
improved patient outcomes. Every public case remains a de-identified candidate
projection; no public case currently carries a recorded clinician acceptance.

The research asks whether an agentic system can make complex clinical reasoning
more inspectable: **can every material statement retain a path to its source,
its interpretive status, its unresolved alternatives and the review action that
allowed it to enter a candidate record?**

HematoBoard now has two explicit operational layers. A private human-operated
workbench owns PDF/photo intake, local OCR, source review and exact-span
de-identification. The V2 runtime receives only the approved source layer and
routes it through one CaseScope-aware executable. Controlled synthesis method
2.5.3 records breadth, grounding, reconciliation and independent critique as
separate method receipts. In the normal route these receipts are produced by
two primary model turns followed by a separate critic turn; the controller
adds hashes, identities and state transitions without inventing clinical
claims. The result is an immutable candidate for review, not an accepted
diagnosis. The active V2 clinician write surface is not yet wired, so
`clinician_accepted` remains false until a future recorded clinician action.

## System map

<p align="center">
  <a href="diagrams/hematoboard-trace-system.svg">
    <img src="diagrams/hematoboard-trace-system.png" width="900" alt="HematoBoard workflow: private source review, G2-approved clinical facts, controlled synthesis receipts, independent critique, dashboard QA and a separate future clinician gate">
  </a>
  <br>
  <sub><strong>Figure 1.</strong> Current HematoBoard architecture under method 2.5.3. The private workbench prepares a G2-approved source layer; one V2 operator entrypoint advances exact StepSpec transitions. Breadth, grounding, reconciliation and critique remain separately inspectable even when grounding, reconciliation and the draft share one primary model turn. Projection QA is detached, the dashboard is read-only, and clinician acceptance remains a separate future gate.</sub>
</p>

<p align="center"><a href="https://raw.githubusercontent.com/esannikov/hematoboard-review/main/diagrams/hematoboard-trace-system.png">Open full-size PNG</a> · <a href="https://raw.githubusercontent.com/esannikov/hematoboard-review/main/diagrams/hematoboard-trace-system.svg">Open scalable SVG</a> · <a href="diagrams/manifest.json">Verify protocol and artifact hashes</a></p>

The map permits bounded repair without creating a second clinical authority.
Source review can reopen one crop; a named evidence gap can trigger one targeted
retrieval or second-breadth action; an independent critic can block finalization.
Runtime transitions are journaled, case-scoped and serialized by an operating-
system lease. Older artifacts remain readable, while a new clinical input must
start a new hash-pinned dependent cycle.

The architecture draws on four established bodies of work: hematologic
classification as a versioned integration of morphology, phenotype, clinical
context and genomics (Alaggio et al., 2022; Campo et al., 2022); formal clinical
data-quality assessment (Kahn et al., 2016); provenance as explicit relations
among entities, activities and responsible agents (World Wide Web Consortium,
2013); and staged evaluation of AI decision-support systems before claims of
clinical utility (Liu et al., 2020; Vasey et al., 2022). HematoBoard translates
these foundations into case-level controls that remain inspectable by a
clinician.

## Three working surfaces

<table>
  <tr>
    <td width="33.33%" valign="top">
      <a href="assets/research-preview/hematoboard-overview.png"><img src="assets/research-preview/hematoboard-overview.png" alt="HematoBoard patient overview"></a><br>
      <sub><strong>Figure 2. Case overview.</strong> G2-approved patient facts, a separately labelled reasoning candidate, its limitations and the verification steps that could change the interpretation.</sub>
    </td>
    <td width="33.33%" valign="top">
      <a href="assets/research-preview/hematoboard-timeline.png"><img src="assets/research-preview/hematoboard-timeline.png" alt="HematoBoard clinical timeline"></a><br>
      <sub><strong>Figure 3. Clinical timeline.</strong> Source-record dates remain connected to the case history; records without a confirmed clinical date stay outside the dated sequence.</sub>
    </td>
    <td width="33.33%" valign="top">
      <a href="assets/research-preview/hematoboard-graph.png"><img src="assets/research-preview/hematoboard-graph.png" alt="HematoBoard typed evidence graph"></a><br>
      <sub><strong>Figure 4. Typed evidence graph.</strong> Supporting, challenging and contextual relations organize an inspectable clinical argument. Edge counts carry no diagnostic probability.</sub>
    </td>
  </tr>
</table>

These screenshots show the presentation-only English CASE001 projection. The
English copy preserves case identity, candidate hash, ranking, relations,
workup, gaps, sources and clinician status from its Ukrainian package; only
visible interface and clinical prose are translated. It demonstrates the same
shared dashboard shell used by the public Ukrainian case set. CASE001 is a
historical candidate used here only to document the English presentation; it
is not the method-2.5.3 reference case.

The current Ukrainian release indexes 15 de-identified candidate dashboards.
The featured current reference package, CASE011-V2, is an explicitly authorized
protocol replay of CASE011. It contains 61 source records, 183 normalized facts,
six external sources, six clinical entities, five workup actions and four
critical gaps. Its independent critic and projection QA passed; the candidate
remains unaccepted by a clinician. Exact method, candidate, package, QA, UI and
screenshot hashes are recorded in the [public artifact manifest](./diagrams/manifest.json).

## Clinical reasoning as a provenance problem

A difficult hematology case often spans several institutions, laboratories,
modalities and episodes of care. Values appear under different reference
intervals, which must remain distinct from clinical decision limits and retain
their analytical context (Ozarda et al., 2018). Narrative conclusions can
outlive the evidence that originally supported them. A later pathology report
may reorganize the meaning of an earlier imaging finding. Contemporary
hematologic classifications explicitly combine morphology, immunophenotype,
clinical context and molecular findings, while revisions can change entities
and diagnostic criteria (Alaggio et al., 2022; Campo et al.,
2022). Missing tissue, staging or molecular data can therefore remain
clinically decisive even when the record already contains hundreds of pages.

HematoBoard treats the approved source layer as a collection of addressable
source records, clinical facts and measurement series. Each object retains the
available document identity, source order or page, literal text, normalized
value, unit, comparator, reference-range text, date status and privacy lineage.
Interpretive objects refer to those identifiers. External evidence uses its own
retrieval and source-identity receipts. Candidate reasoning is stored in a
separate immutable revision with a hash of the exact clinical projection it
received.

This separation gives the dashboard a precise role. The interface is the
primary presentation output of the system and a read-only projection of
G2-approved facts and candidate reasoning. It has no authority to create a
clinical fact, alter a source receipt or record a clinician decision. The active
V2 runtime can materialize a derived versioned object read model, but that
store is not a second clinical authority. A clinician decision schema exists;
the active write surface and promotion transaction are not yet wired.

Every visible patient-record action is resolved within one CaseScope. In the
public demonstrator it opens the corresponding de-identified structured source
record. In the private workbench, source review remains bound to the source PDF,
page image, OCR layer, geometry and exact hashes. Raw patient PDFs never enter
the public build. External `E-CAND-*` references use validated HTTP(S)
destinations or remain inside their licensed local evidence contour; they are
never routed as patient documents.

The resulting architecture is close to the entity–activity–agent logic of W3C
PROV-O, adapted to a smaller clinical contract. The central objects are source
records, structured observations, external propositions, reasoning revisions,
review actions and candidate states. Their lineage remains inspectable across
document processing, synthesis and presentation (World Wide Web Consortium,
2013).

## Three implemented verification controls

Reasoning freshness and exact projection closure benefit from compact formal
notation. Protocol conformance is evaluated as a fail-closed receipt contract.
All three are technical controls; none carries a diagnostic or prognostic score.

### Field-level projection closure

Let $O_L$ be the identifiers in the G2-approved clinical layer and $O_D$ the
identifiers found in the rendered document object model. The projection test
first requires identical sets:

$$
O_D = O_L
$$

For every approved fact $o$ and every audited field $f$, the rendered
value $D(o,f)$ must equal the ledger value $L(o,f)$:

$$
\forall o \in O_L,\ \forall f \in F:\ D(o,f) = L(o,f)
$$

The runtime compares display text, numeric and textual results, units,
reference intervals, interpretations, source addresses, dates, comparators and
verification flags. It also checks the complete reasoning revision and rejects
case-specific clinical literals embedded in page code.

### Reasoning freshness

The clinical input is a canonical minimum-necessary snapshot $C$ of the
approved source records, normalized facts and signals. Let $H$ denote SHA-256
over its canonical JSON bytes. The reasoning revision records the following
value, using the standardized
SHA-256 hash function (National Institute of Standards and Technology, 2015):

$$
h_R = H(C)
$$

A candidate is current when its recorded $h_R$ equals the hash recalculated
from the active clinical projection. Presentation state, prior ranking and
earlier hypotheses stay outside this input. A clinically relevant bundle change
makes the earlier candidate stale. External evidence receipts and the candidate
body remain bound by the immutable reasoning-revision hash.

### Method conformance

Before synthesis begins, the method self-check validates one canonical router,
CaseScope, method version, schema set and active tools. Method 2.5.3 separates
four inspectable stages: breadth, grounding, reconciliation and independent
critique. They are not four routine model sessions. The normal route uses one
primary turn for blind breadth, one primary turn for evidence grounding,
reconciliation and the exact candidate draft, then one independent critic
turn. The controller materializes separate receipts and verifies exact hashes.

Every breadth candidate must belong to at least one of seven coverage sectors
and must reach an executed evidence query before grounding closes. Each ranked
diagnostic hypothesis needs patient-specific support or a neutral relation and
an evidence-backed workup or critical-gap trace. The critic uses a distinct
execution identity and leaves zero unresolved critical or high findings. A
missing receipt, broken hash, uncovered branch or non-independent critic blocks
finalization.

### Candidate boundary and typed relations

The active production boundary ends at a technically verified candidate. The
candidate is immutable, hash-bound to its clinical input and independent critic,
and explicitly marked `clinician_accepted=false`. A future clinician decision
surface may accept, correct, reject or defer a proposal, but that write path is
not active in V2 today.

Typed clinical relations are represented directly as records. Each edge stores
a hypothesis identifier, an evidence identifier, a relation type and a
rationale. The dashboard graph is a projection of those records; the runtime
does not calculate a graph-derived probability or diagnostic score.

## One case as a controlled episode

Each case cycle is recorded as a traceable episode. The sequence establishes
the dependency of one artifact on another while allowing targeted loops for
source correction, evidence questions and revised candidate states.

1. **Resolve one route and CaseScope.** `workflow-status` selects the registered
   StepSpec and binds the case identifier, clinical-input hash, reasoning run
   and next allowed action. Artifacts from another case fail closed.
2. **Register the source set.** An operator places the minimum-necessary
   documents in a private case workspace. File identity, page inventory,
   hashes, document type, dates and phase time enter the action protocol.
3. **Extract atomic observations.** Native DOCX text or local Apple Vision OCR
   separates measurements, findings, source conclusions, recommendations and
   events while preserving available page and word coordinates.
4. **Normalize measurements.** Structured JSON binds each result to its unit,
   comparator, local reference interval, source row, date and original literal.
5. **Close G2 source review.** Approved records become source-addressed facts
   and signals. Human or explicitly delegated technical privacy/retention
   receipts remain separate from clinical reasoning.
6. **Pin the reasoning input.** A canonical minimum-necessary clinical
   snapshot receives a SHA-256 freshness hash. Blind breadth input excludes
   prior hypotheses, rankings, relations, work-up and external literature.
7. **Run breadth.** The first isolated primary turn develops a broad candidate
   field and closes seven coverage sectors, including dangerous alternatives,
   reversible conditions, second processes and data artifacts.
8. **Run grounding.** Narrow questions guide retrieval from PubMed, DOI records,
   professional societies, classifications and permitted local guideline
   corpora. Fast deterministic triage selects up to three diagnostic-priority
   results per question; exact source hashes, page metadata, rights and visual-
   review requirements stay attached.
9. **Run reconciliation and draft.** In the same second primary turn, the model
   reconciles every breadth candidate, maps sources to workup or gaps and
   returns one exact candidate draft. The controller adds only deterministic
   identities, hashes and timing.
10. **Run independent critique.** A distinct execution examines anchoring,
    premature closure, neglected alternatives, weak evidence, source limits,
    unsupported relations and over-strong language.
11. **Finalize the candidate.** The deterministic controller checks registered
    state, exact hashes, retrieval coverage, relation closure, critic
    independence and the complete artifact set, then writes an immutable
    candidate and append-only runtime journal.
12. **Verify a detached projection.** Static source-of-truth checks and real-
    browser QA bind the rendered dashboard to the exact candidate, shared UI
    fingerprint and CaseScope. Projection failure cannot rewrite the candidate.
13. **Stop at the human gate.** The public and active V2 outputs remain
    candidates. Clinician accept/correct/reject/defer semantics are specified,
    but the active write surface is not yet wired.

### Router modes

The router exposes a small, explicit set of modes. Each mode receives one
CaseScope and cannot silently perform the authority-bearing work of another:

| Mode | Permitted work |
| --- | --- |
| `view` | Read approved source facts and any separately published candidate. |
| `intake` | Register a new case or source set and create the initial private inventory. |
| `data_revision` | Propose source-addressed corrections to structured case data. |
| `source_review` | Verify extracted fields against the primary record and record exceptions. |
| `evidence_review` | Review external propositions, applicability, licences and source receipts. |
| `controlled_synthesis` | Execute method 2.5.3 and finalize an immutable candidate after independent critique. |
| `projection` | Build and verify the detached read-only dashboard projection. |
| `clinician_review` | Present the future human decision gate; active V2 decision writing is not yet wired. |
| `audit` | Inspect receipts, hashes, state transitions and failures without changing clinical state. |

The intent is resolved before an operation begins. Active V2 mutations then use
`advance/resume` and the exact StepSpec returned by `workflow-status`. A
`projection` action cannot create clinical authority; synthesis cannot record a
clinician decision.

### Current modules

The table documents the research architecture while the private clinical
runtime is being prepared for a later sanitized release. AI Agent names identify
bounded reasoning roles; runtime surfaces identify deterministic controls.

| Stage | Agent or runtime surface | Responsibility | Recorded result |
| --- | --- | --- | --- |
| Private intake | Human-operated workbench | Isolates PDF/photo sources and writes case-scoped G1/G2/G4 action receipts | Private source inventory and review packs |
| Local recognition | Native DOCX text or **Apple Vision OCR** | Preserves literal text, page order and available geometry on-device | Approved OCR/native-text layer |
| Structure | V2 deterministic clinical core | Produces SourceRecords, ClinicalFacts, measurement series and source-preserving unit resolution | Exact clinical snapshot and SHA-256 |
| Privacy | Operator exact-span overlay and residual scan | Removes direct identifiers only from derived Markdown/JSON without altering the raw PDF | Versioned de-identification and retention receipts |
| Routing | `workflow-status → advance/resume` | Resolves one CaseScope and one registered StepSpec; never calls a model implicitly | Typed workflow response and command key |
| Run safety | Journal, case lease and immutable command receipts | Serializes mutations, supports exact replay and separates crash recovery from clinical work | Hash-chained events and request/completion receipts |
| Blind breadth | Primary Sol turn 1 | Builds alternatives across seven coverage sectors without prior ranking or literature | Initial breadth result or one named repeat gap |
| Targeted breadth | Conditional primary Sol turn | Runs only for a named uncovered sector; a routine third breadth pass is forbidden | Immutable second-breadth receipt |
| Grounding and draft | Primary Sol turn 2 | Executes exact evidence queries, reconciles every breadth candidate and returns the candidate draft | Grounding/reconciliation traces and candidate hash |
| Critic | Independent Sol execution | Tests closure, dangerous alternatives, evidence strength, workup necessity and clinical language | Critic receipt with zero unresolved critical/high findings |
| Candidate finalization | Deterministic V2 controller | Validates relations, evidence identity, coverage and critic binding | Immutable candidate synthesis |
| Projection | Candidate projection builder | Builds graph, timeline, data, gaps and source traces without changing source facts | Immutable candidate dashboard projection |
| Browser QA | Full or data-only QA profile | Binds case, candidate, projection, shared UI and screenshots; checks console and overflow | Detached QA receipt |
| Presentation | Shared V1 clinical shell | Displays candidate-only overview, timeline, graph, data, gaps and reasoning | Public de-identified read-only package |
| Derived objects | Versioned batch read model | Materializes reusable object versions after G2, candidate and QA checks | Derived `current.json`; no clinician authority |
| Clinician gate | Specified but not wired | Reserves accept/correct/reject/defer for a recorded human action | `clinician_accepted=false` in all current public cases |

## Reading difficult clinical documents

Document reconstruction is treated as measurement transfer. Apple Vision runs
locally on macOS with Ukrainian, Russian and English recognition settings. It
returns recognized strings, confidence and bounding regions (Apple, n.d.). The
original PDF remains the pixel source of truth, while optimized renders and
coordinate transforms provide bounded working surfaces for verification.

Spatial structure is resolved before de-identification. A laboratory row binds
the analyte, result, unit, comparator and reference interval to one row identity.
Strict JSON carries field bounding boxes, word IDs, page hashes and row/column
invariants. The raw PDF and OCR stay immutable in private quarantine. Direct
identifiers are removed by exact page-scoped span operations in derived JSON
and Markdown; deleting an entire mixed clinical line is forbidden.

Recognition output remains immutable. A correction such as Cyrillic `ч` in a
sex-specific reference interval receives an append-only overlay linked to the
exact word ID, bounding box, crop, page hash, reader and timestamp. Derived
tables replay the overlay while preserving the raw recognition artifact.

Selected table, figure or scan-layout pages receive an explicit visual-semantic
review inside the primary grounding turn. A secondary visual reader is allowed
only after the primary reviewer names a concrete ambiguity in a cell, arrow,
caption or footnote. Disagreement, low confidence or incomplete source coverage
opens one targeted exception rather than restarting the whole intake.

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

Corpus admission is fail-closed. A source can enter agent context only when its
exact bytes match the admission manifest and `agent_context_allowed=true`.
Licensed NCCN documents supplied with institutional permission remain in a
separate local contour and require an exact-hash operator authorization receipt
for each agent route. Retrieval from that contour still produces candidate
evidence with `human_verified=false` and `clinician_review_pending=true`; the
clinician judges its case applicability together with the complete synthesis
package.

Guideline quality and reporting can be appraised with instruments such as AGREE
II (Brouwers et al., 2010). Disease-specific classifications and practice
guidelines retain their edition and date because diagnostic categories,
staging definitions and recommendations change over time (Alaggio et al., 2022;
Campo et al., 2022; d’Amore et al., 2025).

## Agentic synthesis under bounded authority

The canonical HematoBoard router resolves one CaseScope before an agent receives
data. Raw PDFs, direct identifiers, interface state, prior ranking, prior
relations, external literature and clinician decisions remain outside blind
breadth. Breadth, grounding, reconciliation and critique have different jobs
and separate receipts, but the normal route uses three model turns rather than
four: blind breadth; combined grounding/reconciliation/draft; independent
critique. A second breadth or repair turn is allowed only for a named finding.

The deterministic controller verifies the method and run schemas, registered
state, exact hashes, execution identity, retrieval coverage, candidate
relations and critic independence. Finalization copies the draft into an
immutable candidate. A separate QA receipt binds projection, candidate, shared
UI and screenshots. Neither technical receipt creates an accepted diagnosis.
The future clinician gate remains a separate human-authority layer.

Research on human susceptibility to erroneous AI advice motivates this visible
separation of source facts, AI Agent interpretation and clinician authority
(Cabitza et al., 2017; Gaube et al., 2021). The design supports disagreement,
abstention and revision as first-class outcomes of the workflow, consistent
with calls for clinically grounded, safety-aware evaluation throughout the
machine-learning lifecycle (Wiens et al., 2019).

## Privacy and cloud processing

HematoBoard uses a local-first privacy boundary organized around data
minimization, purpose limitation and traceable disclosure (European Parliament
& Council of the European Union, 2016).

- Raw PDFs, page renders, direct identifiers and re-identification mappings stay
  in private case quarantine.
- Apple Vision performs recognition locally.
- De-identification removes exact identifier spans only from derived structured
  JSON and Markdown after table and coordinate relationships are preserved.
- A cloud AI Agent receives an approved de-identified clinical projection or a
  tightly bounded crop cleared for its specific operation.
- Only the minimum-necessary G2-approved layer can enter synthesis or critique.
- Licensed guideline text stays local when its terms restrict external model
  processing.
- Material transformations retain version, hash, operation and responsible
  human or agent identity.
- AI Agent results remain candidates. Clinical authority would require a
  separate recorded clinician decision; that active V2 write path is not wired.

De-identification reduces disclosure risk while institutional, legal, security
and ethics governance remains necessary. Clinical-text de-identification is a
measurable information-extraction task with documented residual errors rather
than an absolute guarantee of anonymity (Meystre et al., 2010; Uzuner et al.,
2007). Planned experiments will compare local multimodal and language models
for crop adjudication, evidence synthesis and safety critique under the same
receipt and projection contracts, following the broader governance principles
for AI in health set out by the World Health Organization (2021).

## Sources and methods

| Layer | Source families | Recorded control |
| --- | --- | --- |
| Patient record | Laboratory, pathology, imaging, procedures and clinical narrative | Document, page or crop, field structure, date, verification and privacy status |
| Literature | PubMed, DOI records and peer-reviewed articles | Citation, evidence type, exact proposition, applicability and retrieval receipt |
| Guidelines | Official societies, classifications, institutional or licensed local PDFs | Edition, date, page or node, licence, model-use permission and review status |
| Controlled synthesis | Breadth, grounding, reconciliation and independent critic | Separate method receipts, execution identity, exact queries, retrieval coverage, candidate hash and critical findings |
| Provenance | Versioned JSON, SHA-256, immutable revisions and typed graph relations | Input/output identity, lineage, responsible agent and projection closure |
| Human authority | Source review and future final clinician decision | Recorded G1/G2/G4 receipts today; clinician acceptance remains unwired |

## Research status

HematoBoard is being evaluated in clinical conditions with prepared,
de-identified case packages. Current evaluation concerns source reconstruction,
measurement transfer, evidence traceability, method-2.5.3 conformance, reasoning
freshness, exact-hash evidence admission, patient-source navigation, projection
closure and clinician-facing review ergonomics.

The public Ukrainian release currently indexes 15 de-identified candidate
dashboards. Their packages, schemas, hashes and release manifests pass the
current public release validator; all retain `clinician_accepted=false`.
Historical cases preserve the receipts and parser behavior under which they
were produced and are not silently presented as retrovalidated under every new
rule. The current CASE011-V2 reference package is a user-authorized protocol
replay with an independent critic PASS and detached browser QA, not a confirmed
diagnosis.

External clinical validation, prospective effectiveness evaluation, regulatory
qualification and deployment performance remain future stages. Planned studies
separate exact field transfer, provenance failures, appropriate AI Agent
abstention, correction recovery, clinician review time, decision disagreement
and usability. This staged approach follows reporting frameworks that distinguish
early live clinical evaluation from later comparative clinical trials (Liu et
al., 2020; Vasey et al., 2022). Each outcome retains its own interpretation and
limitation.

The screenshots document a de-identified, presentation-only English projection
of CASE001. Raw source packages, private runtime data and clinician decisions
remain inside the controlled workspace.
Diagnosis, staging, treatment and clinical promotion remain the responsibility
of the treating team after review of the complete primary record.

## Public interface and controlled runtime

This repository publishes the research article, English dashboard screenshots,
the version-pinned architecture figure and a manifest bound to method 2.5.3,
the current CASE011-V2 public package and the exact screenshot assets. The
English presentation-only demonstrator is available at
<https://esannikov.github.io/hematoboard-en/?case=case001>; the current
Ukrainian case set is available at
<https://esannikov.github.io/hematoboard/?case=case011-v2>. Private clinical
source packages, raw source files, licensed guideline files and any future
clinician-acceptance state remain within the controlled development environment.

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

Alaggio, R., Amador, C., Anagnostopoulos, I., Attygalle, A. D., Araujo, I. B.
O., Berti, E., Bhagat, G., Borges, A. M., Boyer, D., Calaminici, M., Chadburn,
A., Chan, J. K. C., Cheuk, W., Chng, W.-J., Choi, J. K., Chuang, S.-S.,
Coupland, S. E., Czader, M., Dave, S. S., … Xiao, W. (2022). The 5th edition
of the World Health Organization classification of haematolymphoid tumours:
Lymphoid neoplasms. *Leukemia, 36*(7), 1720–1748.
<https://doi.org/10.1038/s41375-022-01620-2>

Apple. (n.d.). *Recognizing text in images*. Apple Developer Documentation.
Retrieved August 8, 2026, from
<https://developer.apple.com/documentation/vision/recognizing-text-in-images>

Brouwers, M. C., Kho, M. E., Browman, G. P., Burgers, J. S., Cluzeau, F.,
Feder, G., Fervers, B., Graham, I. D., Grimshaw, J., Hanna, S. E., Littlejohns,
P., Makarski, J., Zitzelsberger, L., & AGREE Next Steps Consortium. (2010).
AGREE II: Advancing guideline development, reporting and evaluation in health
care. *Journal of Clinical Epidemiology, 63*(12), 1308–1311.
<https://doi.org/10.1016/j.jclinepi.2010.07.001>

Cabitza, F., Rasoini, R., & Gensini, G. F. (2017). Unintended consequences of
machine learning in medicine. *JAMA, 318*(6), 517–518.
<https://doi.org/10.1001/jama.2017.7797>

Campo, E., Jaffe, E. S., Cook, J. R., Quintanilla-Martinez, L., Swerdlow, S.
H., Anderson, K. C., Brousset, P., Cerroni, L., de Leval, L., Dirnhofer, S.,
Dogan, A., Feldman, A. L., Fend, F., Friedberg, J. W., Gaulard, P., Ghia, P.,
Horwitz, S. M., King, R. L., Salles, G., … Zelenetz, A. D. (2022). The
international consensus classification of mature lymphoid neoplasms: A report
from the Clinical Advisory Committee. *Blood, 140*(11), 1229–1253.
<https://doi.org/10.1182/blood.2022015851>

d’Amore, F., Federico, M., de Leval, L., Ellin, F., Hermine, O., Kim, W. S.,
Lemonnier, F., Vermaat, J. S. P., Wulf, G., Buske, C., Dreyling, M., & Jerkeman,
M. (2025). Peripheral T- and natural killer-cell lymphomas: ESMO–EHA Clinical
Practice Guideline for diagnosis, treatment and follow-up. *Annals of Oncology,
36*(6), 626–644. <https://doi.org/10.1016/j.annonc.2025.01.023>

European Parliament, & Council of the European Union. (2016). *Regulation (EU)
2016/679 (General Data Protection Regulation), Article 5*. Official Journal of
the European Union. <https://eur-lex.europa.eu/eli/reg/2016/679/oj>

Gaube, S., Suresh, H., Raue, M., Merritt, A., Berkowitz, S. J., Lermer, E.,
Coughlin, J. F., Guttag, J. V., Colak, E., & Ghassemi, M. (2021). Do as AI say:
Susceptibility in deployment of clinical decision-aids. *npj Digital Medicine,
4*(1), Article 31. <https://doi.org/10.1038/s41746-021-00385-9>

Kahn, M. G., Callahan, T. J., Barnard, J., Bauck, A. E., Brown, J., Davidson,
B. N., Estiri, H., Goerg, C., Holve, E., Johnson, S. G., Liaw, S.-T.,
Hamilton-Lopez, M., Meeker, D., Ong, T. C., Ryan, P., Shang, N., Weiskopf, N.
G., Weng, C., Zozus, M. N., & Schilling, L. (2016). A harmonized data quality
assessment terminology and framework for the secondary use of electronic
health record data. *eGEMs (Generating Evidence & Methods to Improve Patient
Outcomes), 4*(1), 18. <https://doi.org/10.13063/2327-9214.1244>

Liu, X., Cruz Rivera, S., Moher, D., Calvert, M. J., Denniston, A. K., &
SPIRIT-AI and CONSORT-AI Working Group. (2020). Reporting guidelines for
clinical trial reports for interventions involving artificial intelligence:
The CONSORT-AI extension. *Nature Medicine, 26*(9), 1364–1374.
<https://doi.org/10.1038/s41591-020-1034-x>

Meystre, S. M., Friedlin, F. J., South, B. R., Shen, S., & Samore, M. H.
(2010). Automatic de-identification of textual documents in the electronic
health record: A review of recent research. *BMC Medical Research Methodology,
10*, Article 70. <https://doi.org/10.1186/1471-2288-10-70>

National Institute of Standards and Technology. (2015). *Secure Hash Standard
(SHS)* (FIPS PUB 180-4). <https://doi.org/10.6028/NIST.FIPS.180-4>

Ozarda, Y., Sikaris, K., Streichert, T., & Macri, J. (2018). Distinguishing
reference intervals and clinical decision limits: A review by the IFCC
Committee on Reference Intervals and Decision Limits. *Critical Reviews in
Clinical Laboratory Sciences, 55*(6), 420–431.
<https://doi.org/10.1080/10408363.2018.1482256>

Uzuner, O., Luo, Y., & Szolovits, P. (2007). Evaluating the state-of-the-art in
automatic de-identification. *Journal of the American Medical Informatics
Association, 14*(5), 550–563. <https://doi.org/10.1197/jamia.M2444>

Vasey, B., Nagendran, M., Campbell, B., Clifton, D. A., Collins, G. S., Denaxas,
S., Denniston, A. K., Faes, L., Geerts, B., Ibrahim, M., Liu, X., Mateen, B. A.,
Mathur, P., McCradden, M. D., Morgan, L., Ordish, J., Rogers, C., Saria, S.,
Ting, D. S. W., … DECIDE-AI Expert Group. (2022). Reporting guideline for the
early-stage clinical evaluation of decision support systems driven by
artificial intelligence: DECIDE-AI. *Nature Medicine, 28*(5), 924–933.
<https://doi.org/10.1038/s41591-022-01772-9>

Weiskopf, N. G., & Weng, C. (2013). Methods and dimensions of electronic health
record data quality assessment: Enabling reuse for clinical research. *Journal
of the American Medical Informatics Association, 20*(1), 144–151.
<https://doi.org/10.1136/amiajnl-2011-000681>

Wiens, J., Saria, S., Sendak, M., Ghassemi, M., Liu, V. X., Doshi-Velez, F.,
Jung, K., Heller, K., Kale, D., Saeed, M., Ossorio, P. N., Thadaney-Israni, S.,
& Goldenberg, A. (2019). Do no harm: A roadmap for responsible machine
learning for health care. *Nature Medicine, 25*(9), 1337–1340.
<https://doi.org/10.1038/s41591-019-0548-6>

World Health Organization. (2021). *Ethics and governance of artificial
intelligence for health: WHO guidance*.
<https://www.who.int/publications/i/item/9789240029200>

World Wide Web Consortium. (2013). *PROV-O: The PROV Ontology* (W3C
Recommendation). <https://www.w3.org/TR/prov-o/>

---

HematoBoard supports structured review and clinical discussion. Final clinical
responsibility remains with the treating team after review of the complete
primary record.
