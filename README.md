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
projection, then places candidate hypotheses beside the observations and external
sources that support, challenge or contextualize them.

The research asks whether an agentic system can make complex clinical reasoning
inspectable: **can every material statement retain a path to its source, its
interpretive status, its unresolved alternatives and the review action that
allowed it to enter a candidate record?**

The system is being tested in clinical conditions as a research workflow.
Completed clinical validation, regulatory qualification and evidence of improved
patient outcomes belong to later stages. Every public case is a de-identified
candidate projection awaiting clinician judgement.

## Why a hematology record resists review

A difficult hematology case spans several institutions, laboratories, modalities
and episodes of care. Values arrive under different reference intervals, which
must stay distinct from clinical decision limits and keep their analytical
context (Ozarda et al., 2018). Narrative conclusions outlive the evidence that
first supported them. A later pathology report can reorganize the meaning of an
earlier imaging finding. Contemporary hematologic classifications combine
morphology, immunophenotype, clinical context and molecular findings, and each
revision can move entities and diagnostic criteria (Alaggio et al., 2022; Campo
et al., 2022). Missing tissue, staging or molecular data stays clinically
decisive even when the record already runs to hundreds of pages.

Two failure modes make this more than a document problem. Diagnostic error
concentrates in cognitive patterns: anchoring on the first plausible story,
closing the differential early, discounting the alternative that must not be
missed (Croskerry, 2003; National Academies of Sciences, Engineering, and
Medicine, 2015). A large share of laboratory error also sits outside the
analyser, in the pre- and post-analytical phases where a sample, a unit or a
transcription goes wrong (Plebani, 2006). A review system that only summarizes
faster reproduces both.

Language models can carry clinical knowledge and answer medical questions at a
high level (Singhal et al., 2023), while the same models generate fluent
statements unsupported by their input (Ji et al., 2023). For clinical review this
sets the design constraint directly: the value of a model claim depends on
whether a reader can trace it back to a source, an unresolved gap or an explicit
alternative. HematoBoard is built around that trace rather than around answer
quality.

## How the system is organized

HematoBoard has two operational layers. A private human-operated workbench owns
document intake, local recognition, source review and exact-span
de-identification. The runtime receives only the approved source layer and routes
it through one case-scoped executable. Controlled synthesis method 2.5.3 records
breadth, grounding, reconciliation and independent critique as separate method
receipts, produced by two primary model turns followed by an independent critic
turn. The controller adds hashes, identities and state transitions and invents no
clinical claims. Its output is an immutable candidate for review; clinical
authority stays with a recorded clinician decision.

<p align="center">
  <a href="diagrams/hematoboard-trace-system.svg">
    <img src="diagrams/hematoboard-trace-system.png" width="900" alt="HematoBoard workflow: private source review, G2-approved clinical facts, controlled synthesis receipts, independent critique, dashboard QA and a separate clinician gate">
  </a>
  <br>
  <sub><strong>Figure 1.</strong> HematoBoard architecture under method 2.5.3. The private workbench prepares a G2-approved source layer; one operator entrypoint advances exact StepSpec transitions. Breadth, grounding, reconciliation and critique stay separately inspectable even when grounding, reconciliation and the draft share one primary model turn. Projection QA is detached, the dashboard is read-only, and clinician acceptance sits behind its own gate.</sub>
</p>

<p align="center"><a href="https://raw.githubusercontent.com/esannikov/hematoboard-review/main/diagrams/hematoboard-trace-system.png">Open full-size PNG</a> · <a href="https://raw.githubusercontent.com/esannikov/hematoboard-review/main/diagrams/hematoboard-trace-system.svg">Open scalable SVG</a> · <a href="diagrams/manifest.json">Verify protocol and artifact hashes</a></p>

The map allows bounded repair without creating a second clinical authority.
Source review can reopen one crop; a named evidence gap can trigger one targeted
retrieval or one extra breadth pass; the critic can block finalization. Every
transition is journaled and bound to one case. Older artifacts stay readable, and
a new clinical input starts a new hash-pinned cycle instead of editing the old
one.

The architecture rests on four established bodies of work: hematologic
classification as a versioned integration of morphology, phenotype, clinical
context and genomics (Alaggio et al., 2022; Campo et al., 2022); formal clinical
data-quality assessment for records reused across sources (Kahn et al., 2016;
Weiskopf & Weng, 2013); provenance as explicit relations
among entities, activities and responsible agents (World Wide Web Consortium,
2013); and staged evaluation of AI decision-support systems before any claim of
clinical utility (Liu et al., 2020; Vasey et al., 2022). Findability,
accessibility, interoperability and reuse of research data supply the identity
discipline for the artifacts themselves (Wilkinson et al., 2016).

### Vocabulary

Eight terms carry most of the article.

| Term | Meaning |
| --- | --- |
| **CaseScope** | The boundary of one case. Every artifact, hash and action belongs to exactly one case; material from another case fails closed. |
| **G1 / G2 / G4** | Human review gates. G1 approves the raw recognition layer, G2 approves the de-identified structured record, G4 checks extracted fields against the primary document. |
| **Source record** | One addressable unit of an original document: its identity, page or order, literal text and hash. |
| **Clinical fact** | One normalized value bound to its unit, comparator, reference interval, date status and the source record it came from. |
| **Clinical snapshot** | The minimum-necessary set of approved facts handed to reasoning. Its SHA-256 pins exactly what the model saw. |
| **Receipt** | An immutable record of one performed action: what ran, on which bytes, with which result and under whose identity. |
| **Candidate** | A finished reasoning revision that passed every technical check and awaits a clinician decision. |
| **Projection** | The read-only dashboard build. It renders approved facts and the candidate and can never write back. |

## One measurement end to end

The path of a single laboratory row shows how the parts connect. The example is
illustrative and carries no patient data.

1. **On the page.** A laboratory table lists an elevated lactate dehydrogenase
   result with its local reference interval. Recognition keeps the literal
   string, the word coordinates and the page hash.
2. **At G1.** A human reader confirms that the row was read correctly. A misread
   character receives an append-only overlay bound to the exact word; the raw
   recognition layer stays untouched.
3. **In structure.** The row becomes a clinical fact: analyte, value, unit,
   comparator, local reference interval, sample date and the source record
   address. The literal source text stays beside the normalized value.
4. **Through G2.** Identifier spans in the document header are removed from the
   derived JSON and Markdown, and a reviewer approves the de-identified record.
   The clinical row itself is never deleted, and the raw PDF stays in private
   quarantine.
5. **In the snapshot.** The fact enters the clinical snapshot, whose hash pins
   the reasoning input. Any later change that reaches this snapshot marks the
   earlier candidate stale.
6. **In reasoning.** Blind breadth opens the value in several directions at once:
   an aggressive lymphoproliferative process under *must not miss*, a parallel
   process under *second process*, a hemolysed sample under *data artifact*.
   Grounding retrieves evidence for the questions that separate them, and
   reconciliation turns each direction into a ranked hypothesis, a workup action
   or a named gap.
7. **On the dashboard.** The rendered cell shows the value, its unit, its
   reference interval, its date and a link to the source record, plus the typed
   edges that connect it to hypotheses. The projection test asserts that this
   rendered value equals the ledger value, character for character.

## What the clinician sees

<table>
  <tr>
    <td width="33.33%" valign="top">
      <a href="assets/research-preview/hematoboard-overview.png"><img src="assets/research-preview/hematoboard-overview.png" alt="HematoBoard patient overview"></a><br>
      <sub><strong>Figure 2. Case overview.</strong> G2-approved patient facts, a separately labelled reasoning candidate, its limitations and the verification steps that could change the interpretation.</sub>
    </td>
    <td width="33.33%" valign="top">
      <a href="assets/research-preview/hematoboard-timeline.png"><img src="assets/research-preview/hematoboard-timeline.png" alt="HematoBoard clinical timeline"></a><br>
      <sub><strong>Figure 3. Clinical timeline.</strong> Source-record dates stay connected to the case history; records without a confirmed clinical date stay outside the dated sequence.</sub>
    </td>
    <td width="33.33%" valign="top">
      <a href="assets/research-preview/hematoboard-graph.png"><img src="assets/research-preview/hematoboard-graph.png" alt="HematoBoard typed evidence graph"></a><br>
      <sub><strong>Figure 4. Typed evidence graph.</strong> Supporting, challenging and contextual relations organize an inspectable clinical argument. Edge counts carry no diagnostic probability.</sub>
    </td>
  </tr>
</table>

The screenshots show the English CASE001 projection, a translated presentation of
a Ukrainian package in which no clinical claim, hash or status changes. The
Ukrainian release indexes a set of de-identified candidate dashboards around one
current reference package, an authorized protocol replay carrying an independent
critic pass and detached projection QA. Exact hashes for the published release
live in the [public artifact manifest](./diagrams/manifest.json).

## How provenance is stored

The approved source layer is a collection of addressable objects: source records,
clinical facts and measurement series. Each keeps its document identity, literal
text, normalized value and privacy lineage. Interpretive objects refer to those
identifiers instead of restating them. External evidence carries its own
retrieval and source-identity receipts. Candidate reasoning lives in a separate
immutable revision that stores the hash of the exact snapshot it received.

This separation gives the dashboard a precise role. The interface is the primary
presentation output of the system and a read-only projection of approved facts
and candidate reasoning. It has no authority to create a clinical fact, alter a
source receipt or record a clinician decision.

Every visible patient-record action resolves inside one CaseScope. In the public
demonstrator it opens the corresponding de-identified structured record; in the
private workbench it opens the source PDF, page image, recognition layer and
geometry behind that record. Raw patient documents never enter the public build,
and external references are never routed as patient documents.

The result follows the entity–activity–agent logic of W3C PROV-O, adapted to a
smaller clinical contract. Source records, structured observations, external
propositions, reasoning revisions, review actions and candidate states each keep
their lineage across document processing, synthesis and presentation (World Wide
Web Consortium, 2013).

## Three implemented verification controls

Two of the controls are stated as formulas; the third is a fail-closed receipt
contract. All three are technical: none carries a diagnostic or prognostic score.

### Field-level projection closure

Let $O_L$ be the identifiers in the approved clinical layer and $O_D$ the
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

The comparison covers display text, values, units, reference intervals, source
addresses, dates and verification flags. It also checks the complete reasoning
revision and rejects case-specific clinical text hardcoded into page code, so a
dashboard cannot look correct while the ledger says otherwise.

### Reasoning freshness

The reasoning input is a canonical minimum-necessary snapshot $C$ of the approved
records, facts and signals. Let $H$ denote SHA-256 over its canonical JSON bytes
(National Institute of Standards and Technology, 2015). The reasoning revision
records:

$$
h_R = H(C)
$$

A candidate is current while its recorded $h_R$ still equals the hash
recalculated from the approved layer. Interface state, prior ranking and earlier
hypotheses stay outside this input, so presentation changes cannot silently
refresh a candidate, and a clinically relevant change to the record makes the
earlier candidate stale on the spot.

### Method conformance

Before synthesis begins, a self-check validates the router, the CaseScope, the
method version, the schema set and the active tools. Method 2.5.3 keeps four
stages separately inspectable (breadth, grounding, reconciliation, independent
critique) and packs them into three model turns: blind breadth; grounding,
reconciliation and draft; independent critique. The controller writes a separate
receipt per stage and verifies the hashes that bind them.

Breadth closes against seven coverage sectors, so the differential cannot narrow
before it has been opened:

| Sector | Question it forces |
| --- | --- |
| Unifying explanation | What single process would explain the whole picture? |
| Close alternative | What neighbouring entity fits almost as well? |
| Different mechanism | What unrelated mechanism produces the same findings? |
| Reversible or treatable cause | What would be correctable if found now? |
| Must not miss | What is dangerous enough to exclude explicitly? |
| Second process | What if two processes run at once? |
| Data artifact | What if the finding is an error of sampling, units or transfer? |

Every breadth candidate must reach an executed evidence query before grounding
closes. Each ranked hypothesis needs patient-specific support or a neutral
relation, plus an evidence-backed workup action or a named critical gap. The
critic runs under a distinct execution identity and must leave zero unresolved
critical or high findings. A missing receipt, a broken hash, an uncovered sector
or a non-independent critic blocks finalization.

### Candidate boundary and typed relations

The production boundary ends at a technically verified candidate: immutable,
hash-bound to its clinical input and to its critic, and carrying an explicit
clinician status.

Typed clinical relations are stored as records. Each edge holds a hypothesis
identifier, an evidence identifier, a relation type and a rationale. The
dashboard graph projects those records, and the runtime calculates no
graph-derived probability or diagnostic score.

## One case as a controlled episode

Each cycle is recorded as a traceable episode in which one artifact depends on
the previous one, with targeted loops for source correction, evidence questions
and revised candidates.

1. **Resolve the route.** The workflow entrypoint binds the case identifier, the
   clinical-input hash, the reasoning run and the next allowed action. Artifacts
   from another case fail closed.
2. **Register the source set.** An operator places the minimum-necessary
   documents in a private case workspace. File identity, page inventory and
   hashes enter the action protocol.
3. **Extract atomic observations.** Native text or local recognition separates
   measurements, findings, conclusions and events while preserving page and word
   coordinates.
4. **Normalize measurements.** Each result is bound to its unit, comparator,
   local reference interval, source row, date and original literal.
5. **Close source review.** Approved records become source-addressed facts.
   Privacy and retention receipts stay separate from clinical reasoning.
6. **Pin the reasoning input.** The clinical snapshot receives its freshness
   hash. Blind breadth input excludes prior hypotheses, rankings, relations,
   workup and literature.
7. **Run breadth.** The first primary turn opens the candidate field and closes
   all seven coverage sectors.
8. **Run grounding.** Narrow questions drive retrieval from PubMed, DOI records,
   professional societies, classifications and permitted local corpora.
   Deterministic triage keeps the diagnostic-priority results, with source
   hashes and rights attached.
9. **Reconcile and draft.** In the same turn, the model maps every breadth
   candidate to a hypothesis, a workup action or a gap, and returns one exact
   draft. The controller adds only deterministic identities and timing.
10. **Run independent critique.** A distinct execution examines anchoring,
    premature closure, neglected alternatives, weak evidence and over-strong
    language.
11. **Finalize.** The controller checks state, hashes, retrieval coverage,
    relation closure and critic independence, then writes the immutable candidate
    and its journal entries.
12. **Verify a detached projection.** Static checks and real-browser QA bind the
    rendered dashboard to the exact candidate and CaseScope. A projection failure
    cannot rewrite the candidate.
13. **Stop at the human gate.** The published output is a candidate. Accept,
    correct, reject and defer belong to a recorded clinician action.

### One entry point, one mode

Every operation is resolved before it begins: one case, one registered step, one
mode. A mode cannot borrow the authority of another. A projection run cannot
create a clinical fact, synthesis cannot record a clinician decision, and an
audit run cannot change clinical state at all. The controller never calls a model
implicitly; a model turn happens only where the registered step says so.

### Who does what

| Layer | May do | Can never do |
| --- | --- | --- |
| Private workbench (human operator) | Intake, recognition review, de-identification, G1/G2/G4 receipts | Send raw documents or identifiers outward |
| Deterministic clinical core | Build source records, facts, series and the snapshot hash | Infer a value, date, reference interval or diagnosis |
| Router and controller | Resolve the case and next step, write hashes, identities and journal entries | Call a model on its own or approve a conclusion |
| Breadth agent (turn 1) | Open the differential across seven sectors | See prior ranking, literature or interface state |
| Grounding and draft agent (turn 2) | Execute evidence queries, reconcile, draft the candidate | Add a claim without a source, workup or gap trace |
| Independent critic (turn 3) | Attack closure, evidence strength and clinical language | Edit the candidate it reviews |
| Projection and QA | Build and verify the read-only dashboard | Rewrite a candidate or a source fact |
| Clinician | Accept, correct, reject or defer | Be replaced by any technical pass |

## Reading difficult clinical documents

Document reconstruction is treated as measurement transfer, with its own error
rate. Optical recognition of clinical forms is a long-studied pipeline problem
where layout, handwriting and scan quality set the achievable accuracy
(Rasmussen et al., 2012). Apple Vision runs locally with Ukrainian, Russian and
English recognition settings and returns recognized strings, confidence and
bounding regions (Apple, n.d.). The original PDF stays the pixel source of truth.

Spatial structure is resolved before de-identification. A laboratory row binds
its analyte, result, unit, comparator and reference interval to one row identity,
and the stored JSON carries the bounding boxes, word IDs and page hashes that
prove it. Direct identifiers are then removed by exact page-scoped span
operations in derived files; deleting a whole mixed clinical line is forbidden,
because that is how a measurement disappears silently.

Recognition output stays immutable. A misread character in a reference interval
receives an append-only overlay linked to the exact word, crop, page hash, reader
and timestamp. Derived tables replay the overlay while the raw artifact remains
as it was.

Selected table, figure or scan-layout pages receive an explicit visual-semantic
review inside the primary grounding turn. A secondary visual reader is allowed
only after the first reviewer names a concrete ambiguity in a cell, arrow,
caption or footnote. Disagreement or incomplete coverage opens one targeted
exception; the whole intake is never restarted for it.

## From PubMed and guidelines to case evidence

External evidence enters HematoBoard as reviewable propositions. An AI Agent
formulates narrow clinical questions and discovers candidate sources through
PubMed, DOI records, professional-society sites, official classifications and
permitted local corpora; deterministic lookup then returns the exact source
location used for verification. Retrieval-grounded clinical answering improves
factuality and lets a reader check the citation behind a statement, which is why
grounding is a separate recorded stage here rather than a prompt instruction
(Zakka et al., 2024).

A proposition-level receipt records one clinical statement together with its
source identity and version, page or section, evidence type, licence and case
applicability. A PMID, a title or a search rank holds discovery status until that
receipt is complete. Guideline concordance, diagnostic classification, staging
and treatment indication each require explicit applicability to the case at hand.

Corpus admission is fail-closed. A source can enter agent context only when its
exact bytes match the admission manifest and the corpus permits agent use.
Licensed guideline documents supplied with institutional permission stay in a
separate local contour and require an exact-hash authorization receipt for each
route. Evidence retrieved there still arrives unverified and pending clinician
review.

Guideline quality and reporting can be appraised with instruments such as AGREE
II (Brouwers et al., 2010). Classifications and practice guidelines keep their
edition and date, because diagnostic categories, staging definitions and
recommendations change between revisions (Alaggio et al., 2022; Campo et al.,
2022; d’Amore et al., 2025).

## Where clinical authority sits

Clinicians over-trust confident automated advice, and the effect grows when the
advice is fluent and the underlying reasoning is invisible (Cabitza et al., 2017;
Gaube et al., 2021; Goddard et al., 2012). A system that hides its uncertainty
therefore creates a new error mode while removing an old one. HematoBoard answers
this by keeping three things visibly apart: what the source says, what the AI
Agent proposes, and what a clinician decided. Disagreement, abstention and
revision are first-class outcomes of the workflow rather than failures of it,
consistent with calls for clinically grounded, safety-aware evaluation across the
machine-learning lifecycle (Wiens et al., 2019).

The same separation is what regulation now expects from high-risk clinical AI:
oversight has to be built into the system so that a person can understand its
limits, monitor its output and disregard it (European Parliament & Council of the
European Union, 2024, Art. 14). A candidate that arrives with its sources, its
gaps and its rejected alternatives is what makes that oversight possible in
practice.

## Privacy and cloud processing

HematoBoard uses a local-first privacy boundary organized around data
minimization, purpose limitation and traceable disclosure (European Parliament &
Council of the European Union, 2016).

- Raw documents, page renders, direct identifiers and re-identification mappings
  stay in private case quarantine.
- Apple Vision performs recognition locally on the operator machine.
- De-identification removes exact identifier spans from derived files after table
  and coordinate relationships are preserved.
- A cloud AI Agent receives an approved de-identified snapshot or a tightly
  bounded crop cleared for its specific operation.
- Licensed guideline text stays local when its terms restrict external model
  processing.
- Material transformations retain version, hash, operation and responsible human
  or agent identity.
- AI Agent results stay candidates. Clinical authority requires a recorded
  clinician decision.

De-identification reduces disclosure risk while institutional, legal, security
and ethics governance stays necessary. Clinical-text de-identification is a
measurable information-extraction task with documented residual errors, short of
an absolute guarantee of anonymity (Meystre et al., 2010; Uzuner et al., 2007).
Planned experiments will compare local multimodal and language models for crop
adjudication, evidence synthesis and safety critique under the same receipt and
projection contracts, following the governance principles for AI in health set
out by the World Health Organization (2021).

## Research status

HematoBoard is being evaluated in clinical conditions with prepared,
de-identified case packages. Current evaluation concerns source reconstruction,
measurement transfer, evidence traceability, method conformance, reasoning
freshness, patient-source navigation, projection closure and clinician-facing
review ergonomics.

Public packages, schemas, hashes and release manifests pass the current release
validator. Historical cases preserve the receipts and parser behavior under which
they were produced; a later rule never retroactively re-labels them.

External clinical validation, prospective effectiveness evaluation, regulatory
qualification and deployment performance remain future stages. Planned studies
separate exact field transfer, provenance failures, appropriate AI Agent
abstention, correction recovery, clinician review time, decision disagreement and
usability. This staged approach follows reporting frameworks that distinguish
early live clinical evaluation from later comparative trials (Liu et al., 2020;
Vasey et al., 2022). Each outcome keeps its own interpretation and limitation.

Raw source packages, private runtime data and clinician decisions stay inside the
controlled workspace. Diagnosis, staging, treatment and clinical promotion remain
the responsibility of the treating team after review of the complete primary
record.

## Public interface and controlled runtime

This repository publishes the research article, English dashboard screenshots,
the version-pinned architecture figure and a manifest bound to method 2.5.3, the
current public package and the exact screenshot assets. The English demonstrator
is available at <https://esannikov.github.io/hematoboard-en/?case=case001>; the
current Ukrainian case set is available at
<https://esannikov.github.io/hematoboard/?case=case011-v2>. Private clinical
source packages, raw source files, licensed guideline files and clinician
decision state stay within the controlled development environment.

Reusable schemas, validators and a sanitized reference pipeline are planned for a
later code release after the interfaces and privacy boundary stabilize.

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

Croskerry, P. (2003). The importance of cognitive errors in diagnosis and
strategies to minimize them. *Academic Medicine, 78*(8), 775–780.
<https://doi.org/10.1097/00001888-200308000-00003>

d’Amore, F., Federico, M., de Leval, L., Ellin, F., Hermine, O., Kim, W. S.,
Lemonnier, F., Vermaat, J. S. P., Wulf, G., Buske, C., Dreyling, M., & Jerkeman,
M. (2025). Peripheral T- and natural killer-cell lymphomas: ESMO–EHA Clinical
Practice Guideline for diagnosis, treatment and follow-up. *Annals of Oncology,
36*(6), 626–644. <https://doi.org/10.1016/j.annonc.2025.01.023>

European Parliament, & Council of the European Union. (2016). *Regulation (EU)
2016/679 (General Data Protection Regulation), Article 5*. Official Journal of
the European Union. <https://eur-lex.europa.eu/eli/reg/2016/679/oj>

European Parliament, & Council of the European Union. (2024). *Regulation (EU)
2024/1689 laying down harmonised rules on artificial intelligence (Artificial
Intelligence Act), Article 14*. Official Journal of the European Union.
<https://eur-lex.europa.eu/eli/reg/2024/1689/oj>

Gaube, S., Suresh, H., Raue, M., Merritt, A., Berkowitz, S. J., Lermer, E.,
Coughlin, J. F., Guttag, J. V., Colak, E., & Ghassemi, M. (2021). Do as AI say:
Susceptibility in deployment of clinical decision-aids. *npj Digital Medicine,
4*(1), Article 31. <https://doi.org/10.1038/s41746-021-00385-9>

Goddard, K., Roudsari, A., & Wyatt, J. C. (2012). Automation bias: A systematic
review of frequency, effect mediators, and mitigators. *Journal of the American
Medical Informatics Association, 19*(1), 121–127.
<https://doi.org/10.1136/amiajnl-2011-000089>

Ji, Z., Lee, N., Frieske, R., Yu, T., Su, D., Xu, Y., Ishii, E., Bang, Y. J.,
Madotto, A., & Fung, P. (2023). Survey of hallucination in natural language
generation. *ACM Computing Surveys, 55*(12), Article 248.
<https://doi.org/10.1145/3571730>

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

National Academies of Sciences, Engineering, and Medicine. (2015). *Improving
diagnosis in health care*. The National Academies Press.
<https://doi.org/10.17226/21794>

National Institute of Standards and Technology. (2015). *Secure Hash Standard
(SHS)* (FIPS PUB 180-4). <https://doi.org/10.6028/NIST.FIPS.180-4>

Ozarda, Y., Sikaris, K., Streichert, T., & Macri, J. (2018). Distinguishing
reference intervals and clinical decision limits: A review by the IFCC
Committee on Reference Intervals and Decision Limits. *Critical Reviews in
Clinical Laboratory Sciences, 55*(6), 420–431.
<https://doi.org/10.1080/10408363.2018.1482256>

Plebani, M. (2006). Errors in clinical laboratories or errors in laboratory
medicine? *Clinical Chemistry and Laboratory Medicine, 44*(6), 750–759.
<https://doi.org/10.1515/CCLM.2006.123>

Rasmussen, L. V., Peissig, P. L., McCarty, C. A., & Starren, J. (2012).
Development of an optical character recognition pipeline for handwritten form
fields from an electronic health record. *Journal of the American Medical
Informatics Association, 19*(e1), e90–e95.
<https://doi.org/10.1136/amiajnl-2011-000182>

Singhal, K., Azizi, S., Tu, T., Mahdavi, S. S., Wei, J., Chung, H. W., Scales,
N., Tanwani, A., Cole-Lewis, H., Pfohl, S., Payne, P., Seneviratne, M., Gamble,
P., Kelly, C., Babiker, A., Schärli, N., Chowdhery, A., Mansfield, P., Demner-
Fushman, D., … Natarajan, V. (2023). Large language models encode clinical
knowledge. *Nature, 620*(7972), 172–180.
<https://doi.org/10.1038/s41586-023-06291-2>

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

Wilkinson, M. D., Dumontier, M., Aalbersberg, I. J., Appleton, G., Axton, M.,
Baak, A., Blomberg, N., Boiten, J.-W., da Silva Santos, L. B., Bourne, P. E.,
Bouwman, J., Brookes, A. J., Clark, T., Crosas, M., Dillo, I., Dumon, O.,
Edmunds, S., Evelo, C. T., Finkers, R., … Mons, B. (2016). The FAIR Guiding
Principles for scientific data management and stewardship. *Scientific Data, 3*,
Article 160018. <https://doi.org/10.1038/sdata.2016.18>

World Health Organization. (2021). *Ethics and governance of artificial
intelligence for health: WHO guidance*.
<https://www.who.int/publications/i/item/9789240029200>

World Wide Web Consortium. (2013). *PROV-O: The PROV Ontology* (W3C
Recommendation). <https://www.w3.org/TR/prov-o/>

Zakka, C., Shad, R., Chaurasia, A., Dalal, A. R., Kim, J. L., Moor, M., Fong,
R., Phillips, C., Alexander, K., Ashley, E., Boyd, J., Boyd, K., Hirsch, K.,
Langlotz, C., Lee, R., Melia, J., Nelson, J., Sallam, K., Tullis, S., …
Hiesinger, W. (2024). Almanac — Retrieval-augmented language models for clinical
medicine. *NEJM AI, 1*(2). <https://doi.org/10.1056/AIoa2300068>

---

HematoBoard supports structured review and clinical discussion. Final clinical
responsibility remains with the treating team after review of the complete
primary record.
