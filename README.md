# HematoBoard

<!-- markdownlint-disable MD013 MD033 MD036 -->

## Agentic AI for Traceable Hematology Review

**Live Material dashboard · controlled synthesis protocol 2.0 · clinician-in-the-loop testing**

[Open the de-identified CASE006 dashboard](https://esannikov.github.io/hematoboard/?case=case006)
· [inspect the architecture map](./diagrams/hematoboard-trace-system.svg)

HematoBoard is an experimental clinical evidence environment for studying how
agentic AI can assist the review of long, heterogeneous hematology records while
preserving provenance and clinician authority. It reconstructs scanned reports,
laboratory tables, pathology, imaging and clinical narrative as a versioned case
state, responding to established concerns about completeness, conformance and
plausibility when clinical data are reused across sources (Kahn et al., 2016;
Weiskopf & Weng, 2013). Candidate hypotheses appear beside the observations and
external sources that support, challenge or contextualize them. Missing
verification remains visible throughout the review.

The research asks whether an agentic system can make complex clinical reasoning
more inspectable: **can every material statement retain a path to its source,
its interpretive status, its unresolved alternatives and the decision that
allowed it to enter the accepted record?**

HematoBoard approaches this question through one case-scoped router and a
versioned receipt state machine. Local document recognition and source review
produce a structured accepted evidence ledger. Controlled synthesis protocol
2.0 then runs four separately recorded passes—breadth, grounding,
reconciliation and independent critique—before a deterministic method check can
publish an immutable candidate. A detached projection check prepares the
read-only dashboard and clinician-review surface. Only a recorded clinician
decision can promote a new accepted revision. This separation preserves the
difference between a recorded observation, a source author's conclusion,
external evidence, a case interpretation, a working hypothesis and an accepted
clinical revision.

## System map

<p align="center">
  <a href="diagrams/hematoboard-trace-system.svg">
    <img src="diagrams/hematoboard-trace-system.png" width="900" alt="HematoBoard workflow: private document checks, one accepted case record, four recorded analysis passes, dashboard verification and clinician-only approval">
  </a>
  <br>
  <sub><strong>Figure 1.</strong> HematoBoard controlled architecture under synthesis protocol 2.0. One router resolves the CaseScope and allowed mode. Four separately hashed reasoning passes precede a fail-closed method check and immutable candidate. Projection is verified in a detached step; the Material dashboard remains read-only, and only a recorded clinician decision can create a new accepted revision.</sub>
</p>

<p align="center"><a href="https://raw.githubusercontent.com/esannikov/hematoboard-review/main/diagrams/hematoboard-trace-system.png">Open full-size PNG</a> · <a href="https://raw.githubusercontent.com/esannikov/hematoboard-review/main/diagrams/hematoboard-trace-system.svg">Open scalable SVG</a> · <a href="diagrams/manifest.json">Verify protocol and artifact hashes</a></p>

The map permits bounded feedback without creating a second source of truth.
Source review can reopen one crop; grounding can formulate a new evidence
question; an accepted revision starts a new hash-pinned cycle and makes the
earlier candidate stale. The append-only receipt plane records input and output
hashes, protocol and prompt identity, model and tool events, privacy checks and
phase time across these paths.

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

These surfaces show the current de-identified CASE006 Material demonstrator in
Ukrainian. The overview presents the accepted case state and a visibly separate
candidate interpretation. The timeline keeps dated events separate from records
without a reliable clinical date. The graph exposes typed fact-to-hypothesis
relations without compressing them into an opaque probability. Together they
provide three readings of the same hash-pinned material.

The current reference release contains 58 source-linked observations, 11
admitted external evidence records, nine explicit gaps and a 3:14 Ukrainian
audio briefing for pre-consilium review. It is pinned to reasoning revision
`RR-CASE006-3d72544bd826`; the candidate remains pending clinician review. The
exact bundle, reasoning, projection and dashboard-build hashes are recorded in
the [public artifact manifest](./diagrams/manifest.json).

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

HematoBoard treats the accepted case as a ledger of addressable observations.
Every observation has a stable identifier and may carry a document identity,
page or crop, source text, normalized value, unit, comparator, local reference
interval, effective date, verification state and privacy status. Interpretive
objects refer to those identifiers. External evidence uses its own receipts.
Candidate reasoning is stored in a separate immutable revision with a hash of
the clinical projection it received.

This separation gives the dashboard a precise role. The interface is the
primary presentation output of the system and a read-only projection of
accepted data and candidate reasoning. It has no authority to create a clinical
fact, alter a source receipt or record a clinician decision. A separate
clinician review surface opens proposed changes together with their supporting
records. Accepted changes create a new hash-pinned ledger revision and preserve
the earlier state.

Every visible patient-record address uses one case-agnostic navigation
contract: `case_id + observation_id`. In the public demonstrator it opens the
corresponding de-identified structured record. In the controlled clinical
workspace the same action opens an adjacent private viewer at the exact
hash-verified PDF page and highlights the recorded bounding box. Raw patient
PDFs never enter the public build. External `E#` and `E-CAND-*` references use
validated HTTP(S) destinations or remain inside their licensed local evidence
contour; they are never routed as patient documents.

The resulting architecture is close to the entity–activity–agent logic of W3C
PROV-O, adapted to a smaller clinical contract. The central objects are source
records, structured observations, external propositions, reasoning revisions,
review actions and accepted states. Their lineage remains inspectable across
document processing, synthesis and presentation (World Wide Web Consortium,
2013).

## Three implemented verification controls

Reasoning freshness and exact projection closure benefit from compact formal
notation. Protocol conformance is evaluated as a fail-closed receipt contract.
All three are technical controls; none carries a diagnostic or prognostic score.

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
The reasoning revision records the following value, using the standardized
SHA-256 hash function (National Institute of Standards and Technology, 2015):

$$
h_R = H(\pi_c(B))
$$

A candidate is current when its recorded $h_R$ equals the hash recalculated
from the active clinical projection. Presentation state, prior ranking and
earlier hypotheses stay outside this input. A clinically relevant bundle change
makes the earlier candidate stale. External evidence receipts and the candidate
body remain bound by the immutable reasoning-revision hash.

### Method conformance

Before synthesis begins, the method self-check validates one canonical router,
the CaseScope, protocol version, run schema and required tools. A method-verified
run must then contain four pass receipts in the declared order:
`breadth → grounding → reconciliation → critic`. Every receipt records input and
output hashes, execution identity, model-version status, prompt hash, tool
profile, budget and tool events. Grounding must include accepted and rejected
sources plus a saturation receipt. Reconciliation must account for every old
and new hypothesis without silently reassigning identifiers. The critic must
run under a distinct execution identity and leave no unresolved critical issue.

A missing receipt, broken hash, reordered pass, unsaturated search or
non-independent critic blocks candidate publication. Earlier hash-valid runs
remain readable, but protocol 2.0 labels them `legacy_unverified`; it does not
retroactively claim that the four-pass method was executed.

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

1. **Resolve one route and CaseScope.** The HematoBoard router selects the
   permitted mode and binds the case key, case identifier, bundle hash, revision
   and operation ID. Artifacts from another case fail closed.
2. **Register the source set.** An operator places the minimum-necessary
   documents in a private case workspace. File identity, page inventory,
   hashes, document type, dates and phase time enter the action protocol.
3. **Extract atomic observations.** Local recognition separates measurements,
   findings, source conclusions, recommendations and events while retaining
   page and word coordinates.
4. **Normalize measurements.** Structured JSON binds each result to its unit,
   comparator, local reference interval, source row, date and original literal.
5. **Establish the accepted ledger.** Verified observations become concise,
   source-addressed facts with explicit evidence classes and stable IDs.
6. **Pin the reasoning input.** A canonical minimum-necessary clinical
   projection receives a SHA-256 freshness hash. A second breadth projection
   removes prior hypotheses, rankings, relations, work-up, interpretations and
   external literature.
7. **Run breadth.** The first isolated pass develops a broad candidate field,
   dangerous alternatives and unresolved questions without the prior synthesis
   or evidence corpus.
8. **Run grounding.** Narrow questions guide retrieval from PubMed, DOI records,
   professional societies, classifications and permitted local guideline
   corpora. An agent receives only exact-hash corpus entries admitted for model
   context. Accepted and rejected sources, proposition mappings, applicability
   limits and the stopping condition receive receipts.
9. **Run reconciliation.** Only after grounding does the system compare the new
   candidate field with the prior revision. Every retained, added, merged,
   reranked or deactivated hypothesis is mapped explicitly.
10. **Run independent critique.** A distinct execution examines anchoring,
    premature closure, neglected alternatives, weak evidence, source limits,
    unsupported relations and over-strong language.
11. **Verify the method and publish the candidate.** The deterministic runner
    checks pass order, hashes, search saturation, critic independence and the
    complete artifact set, then writes an immutable candidate with its input
    snapshot, pass receipts, manifest and append-only audit chain.
12. **Verify a detached projection.** Static source-of-truth checks and a real
    browser DOM audit compare the accepted ledger and complete candidate against
    the rendered Material dashboard, including the universal patient-source link
    contract. Projection failure does not rewrite the already published
    candidate.
13. **Record the clinician decision.** The clinician can accept, correct, reject
    or defer proposed changes. Only acceptance or correction under an explicit
    recorded action can create a new accepted ledger revision.

### Router modes

The router exposes a small, explicit set of modes. Each mode receives one
CaseScope and cannot silently perform the authority-bearing work of another:

| Mode | Permitted work |
| --- | --- |
| `view` | Read the current accepted state and any separately published candidate. |
| `intake` | Register a new case or source set and create the initial private inventory. |
| `data_revision` | Propose source-addressed corrections to structured case data. |
| `source_review` | Verify extracted fields against the primary record and record exceptions. |
| `evidence_review` | Review external propositions, applicability, licences and source receipts. |
| `controlled_synthesis` | Execute the four-pass protocol and publish an immutable candidate after method verification. |
| `projection` | Build and verify the detached read-only dashboard projection. |
| `clinician_review` | Present proposed changes and record accept, correct, reject or defer decisions. |
| `audit` | Inspect receipts, hashes, state transitions and failures without changing clinical state. |

The declared mode is included in the routed operation. A `projection` operation,
for example, cannot promote accepted state; a `controlled_synthesis` operation
cannot record a clinician decision.

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
| Routing | HematoBoard router and CaseScope | Resolves the one permitted mode and binds every artifact to one case, bundle, revision and operation | CaseScope receipt |
| Clinical state | Accepted evidence ledger | Stores versioned measurements, findings, dates, interpretations and provenance | Canonical `case_bundle.json` revision |
| Source navigation | Universal patient-source resolver and private viewer | Resolves `case_id + observation_id`; opens a de-identified public record or an exact local PDF page and bounding box | Auditable source-open action without public PDF access |
| Breadth pass | Context-shielded synthesis execution | Builds the initial candidate field without prior reasoning or external literature | `passes/01-breadth.json` |
| Grounding pass | Research execution and source reviewer | Finds narrow external propositions, records rejected sources and proves search saturation | `passes/02-grounding.json` |
| Reconciliation pass | Controlled synthesis execution | Maps every previous and current hypothesis without identifier reassignment | `passes/03-reconciliation.json` |
| Critic pass | Independent execution | Tests alternatives, contradictions, evidence limits and language strength | `passes/04-critic.json` |
| Method gate | Deterministic protocol self-check | Verifies protocol/schema identity, pass order, hashes, saturation, independence and required files | Method-verification receipt |
| Candidate publication | Deterministic write-once publisher | Copies the complete controlled run into an immutable reasoning revision | Candidate manifest and hash-chained audit |
| Projection | Detached source and DOM closure | Builds the Material view and checks every rendered field against its source artifact | Projection receipt pinned to candidate and build hashes |
| Presentation | **HematoBoard Material Dashboard** | Displays accepted state and a separate candidate across overview, timeline, graph, data and gaps | Read-only case projection |
| Clinical review | Clinician review application | Opens source-linked proposed changes and records the responsible clinician's action | Accept, correct, reject or defer decision |
| Promotion | Controlled state transaction | Validates unchanged inputs and materializes an approved revision atomically | New accepted state with parent hash |

## Reading difficult clinical documents

Document reconstruction is treated as measurement transfer. Apple Vision runs
locally on macOS with Ukrainian, Russian and English recognition settings. It
returns recognized strings, confidence and bounding regions (Apple, n.d.). The
original PDF remains the pixel source of truth, while optimized renders and
coordinate transforms provide bounded working surfaces for verification.

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
relations, external literature and clinician decisions remain outside the
initial breadth projection. The four protocol passes then have different jobs
and different immutable receipts: breadth generates alternatives; grounding
tests them against reviewed external propositions; reconciliation compares the
grounded result with history without reusing identifiers silently; an
independent critic challenges the candidate and can block publication.

The deterministic self-check verifies the protocol and run schemas, exact pass
order, hashes, execution and prompt identity, tool events, search saturation and
critic independence. Publication copies the complete run into an immutable
candidate revision. A separate projection receipt then binds the dashboard DOM
to candidate and build hashes. Neither technical receipt changes the accepted
ledger. The clinician review surface presents the candidate together with the
evidence needed to accept, correct, reject or defer it.

Research on human susceptibility to erroneous AI advice motivates this visible
separation of accepted state, AI Agent interpretation and clinician authority
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
| Controlled synthesis | Breadth, grounding, reconciliation and independent critic | Separate pass inputs and outputs, execution identity, prompt hash, tool events, saturation and critical findings |
| Provenance | Versioned JSON, SHA-256, immutable revisions and typed graph relations | Input/output identity, lineage, responsible agent and projection closure |
| Human authority | Source review and final clinician decision | Append-only acceptance, correction, rejection or deferral |

## Research status

HematoBoard is in controlled clinician-in-the-loop testing with prepared,
de-identified case packages. Current evaluation concerns source reconstruction,
measurement transfer, evidence traceability, protocol-2.0 method conformance,
reasoning freshness, exact-hash evidence admission, patient-source navigation,
detached projection closure and clinician-facing review ergonomics. The public
Material dashboard currently presents de-identified CASE006 as an accepted
source ledger plus a separate candidate interpretation. The current release is
reasoning revision `RR-CASE006-3d72544bd826`, with 58 observations, 11 admitted
external sources and nine explicit gaps; the candidate has not been clinically
accepted.

External clinical validation, prospective effectiveness evaluation, regulatory
qualification and deployment performance remain future stages. Planned studies
separate exact field transfer, provenance failures, appropriate AI Agent
abstention, correction recovery, clinician review time, decision disagreement
and usability. This staged approach follows reporting frameworks that distinguish
early live clinical evaluation from later comparative clinical trials (Liu et
al., 2020; Vasey et al., 2022). Each outcome retains its own interpretation and
limitation.

The screenshots document a de-identified research demonstrator. Case packages,
runtime data and clinician decisions remain inside the controlled workspace.
Diagnosis, staging, treatment and clinical promotion remain the responsibility
of the treating team after review of the complete primary record.

## Public interface and controlled runtime

This repository publishes the research article, current Material screenshots,
the version-pinned architecture figure and a manifest bound to the current
CASE006 reasoning and projection receipts. The de-identified read-only
demonstrator is available at
<https://esannikov.github.io/hematoboard/?case=case006>. Clinical case packages,
private dashboard inputs, licensed guideline files, the adjacent PDF source
viewer and clinician-acceptance state remain within the controlled development
environment.

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
