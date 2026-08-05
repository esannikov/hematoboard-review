import {
  leadingHypothesis,
  hypothesisChallenge,
  relationCountsForHypothesis,
  sourceDocumentBreakdown,
  workupPlan as projectedWorkupPlan,
} from "./shared/case_projection.js?v=20260805workupclarity1";
import { projectClinicalState } from "./shared/clinical_state_projection.js?v=20260805imagingdetail1";

// The case registry is data, not code: methodology/active_cases.json is the
// validated routing manifest. Adding a case never requires editing this file.
const CASE_MANIFEST_URL = "active_cases.json";
const IS_PUBLIC_STATIC_DEMO = window.location.hostname.endsWith(".github.io");
let CASES = {};

async function loadCaseManifest() {
  let response;
  try {
    response = await fetch(CASE_MANIFEST_URL, { cache: "no-store" });
  } catch {
    throw new ManifestError("network", "Маніфест кейсів недоступний: немає відповіді від сервера.");
  }
  if (!response.ok) throw new ManifestError("http", `Маніфест кейсів недоступний (HTTP ${response.status}).`);
  let manifest;
  try {
    manifest = await response.json();
  } catch {
    throw new ManifestError("malformed", "Маніфест кейсів пошкоджений: це не валідний JSON.");
  }
  if (!manifest || !Array.isArray(manifest.cases) || !manifest.cases.length) {
    throw new ManifestError("malformed", "Маніфест кейсів не містить жодного кейсу.");
  }
  const active = manifest.cases.filter((entry) => entry && entry.status === "active");
  if (!active.length) throw new ManifestError("malformed", "У маніфесті немає жодного активного кейсу.");
  CASES = Object.fromEntries(
    active.map((entry) => [
      entry.key,
      {
        caseId: entry.case_id,
        label: entry.label,
        bundle: entry.bundle,
        latest: entry.latest ?? null,
        latestRole: entry.latest_role ?? null,
        replay: entry.replay ?? null,
        replayRole: entry.replay_role ?? null,
        reasoningCandidate: entry.reasoning_candidate ?? null,
        default: entry.default === true,
      },
    ]),
  );
}

function defaultCaseKey() {
  return Object.keys(CASES).find((key) => CASES[key].default) || Object.keys(CASES)[0];
}

class ManifestError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

const PRIMARY_VIEWS = [
  ["overview", "Огляд"],
  ["timeline", "Історія"],
  ["graph", "Граф гіпотез"],
];

const DATA_VIEWS = [
  ["state", "Повні дані"],
  ["evidence", "Джерела"],
];

const METHOD_VIEWS = [
  ["agent", "Агент"],
];

const OPTIONAL_METHOD_VIEWS = [
  ["replay", "Докази в часі"],
  ["protocol", "Протокол AI дебатів"],
];

const LEGACY_VIEW_REDIRECTS = { consilium: "graph", multimodal: "state" };
const VIEW_LABELS = Object.fromEntries([
  ...PRIMARY_VIEWS,
  ...DATA_VIEWS,
  ...METHOD_VIEWS,
  ...OPTIONAL_METHOD_VIEWS,
  ["consilium", "Консиліум"],
  ["multimodal", "Узгодженість доказів"],
  ["packet", "Бриф для консиліуму"],
  ["bodymap", "Локалізація"],
]);
const state = {
  caseKey: "case02",
  view: "overview",
  bundle: null,
  latestRun: null,
  replay: null,
  reasoningCandidate: null,
  reviewableObservationIds: new Set(),
};
const timelineCursorByCase = new Map();
const timelineZoomByCase = new Map();
const timelineEventByCase = new Map();
let activeViewCleanup = null;

const PANEL_TEXT_UA = new Map([
  ["Hgb", "Гемоглобін (Hb)"],
  ["RBC", "Еритроцити"],
  ["Ht", "Гематокрит"],
  ["MCV", "Середній об’єм еритроцита (MCV)"],
  ["MCH", "Середній вміст гемоглобіну в еритроциті (MCH)"],
  ["MCHC", "Середня концентрація гемоглобіну (MCHC)"],
  ["RDW-CV", "Ширина розподілу еритроцитів (RDW-CV)"],
  ["PLT", "Тромбоцити"],
  ["WBC", "Лейкоцити"],
  ["Neu", "Нейтрофіли"],
  ["Lymph", "Лімфоцити"],
  ["Mono", "Моноцити"],
  ["Iron (serum)", "Сироваткове залізо"],
  ["ALT", "АЛТ"],
  ["AST", "АСТ"],
  ["Total cholesterol", "Загальний холестерин"],
  ["g/L", "г/л"],
  ["fL", "фл"],
  ["pg", "пг"],
  ["mm/h", "мм/год"],
  ["ng/mL", "нг/мл"],
  ["µmol/L", "мкмоль/л"],
  ["U/L", "Од/л"],
  ["mmol/L", "ммоль/л"],
  ["Δ +55 — major rise; source of recovery unknown (transfusion? iron?)", "Зростання на 55 г/л; причина відновлення не записана — переливання крові чи препарати заліза"],
  ["microcytic at both points", "Мікроцитоз в обох точках"],
  ["hypochromic", "Гіпохромія"],
  ["persistently high anisocytosis", "Стійко підвищений анізоцитоз"],
  ["upper limit at A — reactive thrombocytosis fits iron deficiency / blood loss", "На верхній межі в першій точці; реактивний тромбоцитоз узгоджується з дефіцитом заліза або крововтратою"],
  ["monocytes at/above ceiling at both points — worth an absolute count + smear", "Моноцити на верхній межі або вище в обох точках; доцільні абсолютна кількість і мазок крові"],
  ["Δ +52 — marked systemic inflammatory signal at B", "Зростання на 52 мм/год — виражений системний запальний сигнал у другій точці"],
  ["rose ~14× — but ferritin is an acute-phase reactant; the rise may be inflammation, not repletion", "Зріс приблизно у 14 разів, але як білок гострої фази може відображати запалення, а не відновлення запасів заліза"],
  ["still LOW at B despite normal-range ferritin — the core dissociation", "Залишається нижче референсу в другій точці попри феритин у межах референсу — ключова розбіжність"],
  ["Iron studies", "Показники обміну заліза"],
  ["Ferritin", "Феритин"],
  ["Serum iron", "Сироваткове залізо"],
  ["Transferrin / TIBC", "Трансферин / загальна залізозв’язувальна здатність"],
  ["TSAT", "Насичення трансферину (TSAT)"],
  ["sTfR", "Розчинний рецептор трансферину (sTfR)"],
  ["iron stores (acute-phase reactant — unreliable when inflamed)", "Запаси заліза: феритин є білком гострої фази й може бути ненадійним при запаленні"],
  ["circulating iron (present at B only)", "Циркулююче залізо; визначено лише у другій точці"],
  ["iron transport capacity", "Здатність крові переносити залізо"],
  ["transferrin saturation — key to separate IDA from AI", "Допомагає відрізнити залізодефіцитну анемію від анемії запалення"],
  ["soluble transferrin receptor — not an acute-phase reactant; the discriminator", "Не є білком гострої фази; допомагає розрізнити дефіцит заліза й анемію запалення"],
  ["Inflammation", "Запалення"],
  ["ESR", "ШОЕ"],
  ["CRP", "С-реактивний білок"],
  ["erythrocyte sedimentation rate", "Швидкість осідання еритроцитів"],
  ["C-reactive protein — confirms the inflammatory state", "Підтверджує наявність запального процесу"],
  ["Production / hemolysis", "Кровотворення / гемоліз"],
  ["Reticulocytes", "Ретикулоцити"],
  ["LDH", "ЛДГ"],
  ["Haptoglobin", "Гаптоглобін"],
  ["Bilirubin (total)", "Білірубін загальний"],
  ["marrow response — is production adequate?", "Відповідь кісткового мозку: чи достатнє утворення еритроцитів"],
  ["turnover / hemolysis / tumour burden", "Клітинний обмін, гемоліз або пухлинне навантаження"],
  ["hemolysis screen", "Перевірка на гемоліз"],
  ["Nutritional", "Нутритивні чинники"],
  ["Vitamin B12", "Вітамін B12"],
  ["Folate", "Фолат"],
  ["macrocytic causes", "Макроцитарні причини анемії"],
  ["Onco-heme", "Онкогематологічні перевірки"],
  ["Peripheral smear (described)", "Мазок периферичної крові з описом"],
  ["SPEP / immunofixation", "Електрофорез білків сироватки / імунофіксація"],
  ["Free light chains", "Вільні легкі ланцюги"],
  ["morphology by a hematologist (only a handwritten “aniso/poikilo +++” note exists)", "Морфологічна оцінка гематологом; наявна лише рукописна примітка «анізо/пойкіло +++»"],
  ["paraprotein screen (age 87)", "Перевірка на парапротеїн з урахуванням віку"],
  ["plasma-cell dyscrasia screen", "Перевірка на плазмоклітинне захворювання"],
  ["Procedures", "Процедури"],
  ["FOBT / FIT", "Аналіз калу на приховану кров (FOBT / FIT)"],
  ["Colonoscopy / EGD", "Колоноскопія / езофагогастродуоденоскопія"],
  ["occult GI blood loss", "Прихована шлунково-кишкова крововтрата"],
  ["source of chronic blood loss in elderly IDA", "Пошук джерела хронічної крововтрати при залізодефіцитній анемії"],
]);

function meaningfulText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return /^(?:null|undefined)$/iu.test(text) ? "" : text;
}

function displayText(value) {
  // Clinical and source text is rendered verbatim. Localisation belongs in
  // typed UI-label maps, never in a global replacement pass over evidence.
  return meaningfulText(value);
}

function panelText(value) {
  const text = String(value ?? "");
  return PANEL_TEXT_UA.get(text) || displayText(text);
}

const content = document.getElementById("content");
const statusLine = document.getElementById("bundle-status");
const caseSelect = document.getElementById("case-select");
const footerContract = document.getElementById("footer-contract");
const primaryNav = document.getElementById("primary-nav");
const dataNav = document.getElementById("data-nav");
const methodNav = document.getElementById("method-nav");
const dataNavMenu = document.getElementById("data-nav-menu");
const methodNavMenu = document.getElementById("method-nav-menu");
const packetNavAction = document.getElementById("packet-nav-action");
const clinicHome = document.getElementById("clinic-home");
const brandHome = document.getElementById("brand-home");

function viewUrl(view) {
  const params = new URLSearchParams({
    case: state.caseKey,
    view,
    ui: document.documentElement.dataset.ui || "carbon",
  });
  return `?${params}`;
}

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = displayText(options.text);
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    });
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === undefined || child === null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function textValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map(textValue).join(" · ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${textValue(item)}`)
      .join(" · ");
  }
  return displayText(value);
}

function clipped(value, length = 46) {
  const text = textValue(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

// Clip at a word boundary — never cut mid-word (reads as a whole short phrase).
function wordClip(value, maxLen = 46) {
  const t = displayText(String(value));
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const i = cut.lastIndexOf(" ");
  const base = i > maxLen * 0.55 ? cut.slice(0, i) : cut;
  return `${base.replace(/[\s,;:.–—-]+$/, "")}…`;
}

// Single label registry: internal enum values → clinical Ukrainian labels
// (never show raw enums to a clinician). Namespaces stay separate on purpose:
// the same token can mean different things in different contexts
// (e.g. "critical" as a fact flag vs as a hypothesis status).
const LABELS = {
  enum: {
    declared_deidentified: "задекларовано",
    declared_deidentified_canonical_text_only: "знеособлено в доступному тексті",
    source_verified_candidate_clinical_review: "джерело звірено · клінічна перевірка відкрита",
    candidate_unverified: "кандидатний покажчик · не перевірено",
    context_only: "лише контекст",
    present: "наявна", audited: "перевірено", discordant: "розбіжність між методами",
    high_signal_partial: "сильний сигнал (частково)", partial: "частковий сигнал",
    missing: "відсутня", not_used_clean: "не застосовувалась",
    decisive: "вирішальна", high: "висока", moderate: "помірна", parallel: "паралельна", urgent: "термінова",
    candidate: "кандидатний висновок", critical: "критичний", gap: "прогалина",
    neoplasm: "неопластичний", "non-diagnostic": "недіагностично", partial_refute: "частково спростовує",
    reactive: "реактивний", refute: "спростовує", suspicious: "підозрілий", support: "підтримує", neutral: "нейтрально",
    laboratory: "Лабораторний документ", imaging: "Візуалізація", pathology: "Патоморфологія та ІГХ",
    consultation: "Консультація", procedure: "Процедура", hospital_record: "Клінічний запис", other: "Інший документ",
  },
  enumTone: {
    present: "evidence", audited: "evidence", discordant: "critical", high_signal_partial: "candidate",
    partial: "candidate", decisive: "critical", high: "candidate", urgent: "critical",
    candidate: "candidate", critical: "critical", gap: "critical", neoplasm: "critical",
    "non-diagnostic": "candidate", partial_refute: "candidate", reactive: "evidence",
    refute: "candidate", suspicious: "candidate",
  },
  hypothesisStatus: {
    leading: "провідна робоча гіпотеза",
    "leading-provisional": "потребує верифікації",
    critical: "провідна лінія",
    supported: "підтримано матеріалами",
    open: "потребує перевірки",
    watch: "перевірити",
    safety: "критичний диференціал",
    "must-resolve": "потребує верифікації",
    "must-not-miss": "критичний диференціал",
    weak: "можливий варіант із меншою ймовірністю",
    downgraded: "можливий варіант із меншою ймовірністю",
    possible_lower: "можливий варіант із меншою ймовірністю",
    unlikely: "малоймовірний варіант",
    attention: "потребує окремої перевірки",
    must_not_miss: "критичний диференціал",
    refuted: "послаблено",
    "refuted-by-course": "послаблено перебігом",
    "less-likely-not-excluded": "менш імовірний, не виключений",
    "possible-reactive-background": "можливий самостійний процес або реактивний фон",
    "parallel-check": "окрема паралельна перевірка",
    "low-probability": "низька ймовірність",
    "low-probability-not-excluded": "низька ймовірність, не виключено",
    "largely-excluded": "значною мірою виключено",
    excluded: "виключено",
  },
  sourceType: {
    case: "джерельний пакет",
    patient: "дані кейсу",
    pmid: "публікація PubMed",
    guideline: "настанова · попередній слід",
    gap: "прогалина доказів",
    local: "локальне джерело",
  },
  verification: {
    local_recorded: ["локальний запис", ""],
    metadata_verified: ["метадані звірено", "evidence"],
    content_verified: ["зміст звірено", "evidence"],
    page_verified: ["сторінку звірено", "evidence"],
    context_only: ["лише контекст", "candidate"],
    candidate: ["кандидат на перевірку", "candidate"],
    gap: ["прогалина доказів", "critical"],
  },
};
function enumLabel(value) {
  if (value === true) return "виконано";
  if (value === false) return "не виконано";
  if (value === null || value === undefined || value === "") return "—";
  const k = String(value);
  return LABELS.enum[k] || LABELS.enum[k.toLowerCase()] || displayText(k);
}
function enumTone(value) {
  return LABELS.enumTone[String(value).toLowerCase()] || "";
}
function verificationLabel(level) {
  return LABELS.verification[level] || [level || "—", ""];
}

// Wrap into up to N lines by words (for SVG labels — no mid-word cuts).
function wrapLines(value, maxChars, maxLines = 2) {
  const words = displayText(String(value)).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  const shown = lines.join(" ");
  const full = displayText(String(value));
  if (shown.length < full.length && lines.length) {
    lines[lines.length - 1] = wordClip(`${lines[lines.length - 1]} ${full.slice(shown.length).trim()}`, maxChars);
  }
  return lines;
}

function sectionHeader(label, title, copy = "") {
  const heading = element("div", { className: "section-head" });
  const left = element("div", { className: "section-title-group" });
  left.append(element("h3", { text: title }));
  if (copy) left.append(element("p", { className: "section-copy", text: copy }));
  heading.append(left);
  if (label) heading.append(element("span", { className: "section-label", text: label }));
  return heading;
}

function section(label, title, copy = "") {
  const node = element("section", { className: "content-section" });
  node.append(sectionHeader(label, title, copy));
  return node;
}

function viewHeader(title, intro, contextLabel = state.bundle?.case?.id || "Кейс") {
  const wrapper = element("header", { className: "view-header" });
  const copy = element("div");
  copy.append(
    element("h2", { text: title }),
    element("p", { className: "view-intro", text: intro }),
  );
  wrapper.append(copy, element("span", { className: "view-context", text: contextLabel }));
  return wrapper;
}

function statusTag(label, tone = "") {
  return element("span", {
    className: "status-tag",
    text: label,
    attrs: tone ? { "data-tone": tone } : {},
  });
}

function chip(label) {
  return element("span", { className: "chip", text: label });
}

// Patient-data chip: the internal fact id remains in the data graph, never in
// the clinician-facing label or tooltip.
function dataChip(ref) {
  const fact = factById(ref);
  return element("span", {
    className: "chip fact",
    text: fact ? fact.label : "Пов’язаний факт недоступний",
    attrs: fact ? { title: fact.detail || fact.label } : {},
  });
}

function sourceDisplayTitle(source) {
  if (!["case", "patient", "local"].includes(source?.type)) return clinicianNarrative(source?.ref || "Джерело доказу");
  const date = `${source?.citation || ""} ${source?.ref || ""}`.match(/\b(?:\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})\b/)?.[0];
  const labels = {
    case: "Пакет клінічного випадку",
    patient: "Клінічний документ",
    local: "Локальний клінічний документ",
  };
  return `${labels[source.type]}${date ? ` · ${date}` : ""}`;
}

function evidencePublicationKind(source) {
  const citation = displayText(source?.citation || source?.ref || "");
  if (/clinical practice guideline|\bguidelines?\b/iu.test(citation)) return "Настанова";
  if (/classification/iu.test(citation)) return "Класифікація";
  if (/consensus|diagnostic criteria/iu.test(citation)) return "Консенсус";
  if (/recommendations?/iu.test(citation)) return "Рекомендації";
  return source?.type === "pmid" ? "Стаття" : sourceTypeLabel(source || {});
}

function evidencePublicationTitle(source) {
  const citation = displayText(source?.citation || source?.ref || "Джерело доказу").trim();
  const journalBoundary = citation.match(/^(.+?)(?:[.?]\s+(?:Ann(?:als)?\b|Blood\b|Leukemia\b|J\s+Clin\b|Br\s+J\b|Cytometry\b|Semin\b|Cancer\b|Hum\s+Pathol\b))/iu);
  return (journalBoundary?.[1] || citation).replace(/[.;]+$/u, "").trim();
}

function evidencePublicationYear(source) {
  return displayText(source?.citation || source?.ref || "").match(/\b(?:19|20)\d{2}\b/u)?.[0] || "";
}

// Evidence chip: source type is carried by text and a restrained semantic tone.
// Decorative Unicode symbols are deliberately avoided in the clinical UI.
function evidenceChip(ref) {
  const source = sourceById(ref);
  if (!source) return element("span", { className: "chip", text: String(ref) });
  const map = {
    pmid: ["chip evi", "Стаття · "],
    guideline: ["chip guideline", "Настанова · "],
    gap: ["chip gap", "Прогалина · "],
    patient: ["chip fact", ""],
    case: ["chip fact", ""],
    local: ["chip", ""],
  };
  const [cls, icon] = map[source.type] || ["chip", ""];
  // guideline: its name is the essence; pmid/other: a short gist of the citation.
  const gist = source.type === "guideline"
    ? source.ref
    : ["case", "patient", "local"].includes(source.type)
      ? sourceDisplayTitle(source)
      : wordClip(source.citation || source.ref, 50);
  const tooltip = source.type === "guideline" ? guidelineCitation(source) : source.citation || "";
  const linkable = source.source_uri && /^https?:/.test(source.source_uri);
  if (linkable) {
    return element("a", {
      className: `${cls} chip-link`,
      text: `${icon}${gist}`,
      attrs: { href: source.source_uri, target: "_blank", rel: "noopener", title: tooltip },
    });
  }
  return element("span", { className: cls, text: `${icon}${gist}`, attrs: { title: tooltip } });
}

// Stable source locator used across clinician-facing projections.
// E# is an address in bundle.sources, never an evidence grade or graph weight.
function evidenceIndex(ref, options = {}) {
  const source = sourceById(ref);
  const label = String(ref || "").trim();
  // Only canonical E# locators belong in the clinician-facing index system.
  // Legacy/local storage identifiers (for example SRC-T015-CONSULT) remain
  // resolvable in the bundle but must never leak into the visible dashboard.
  if (!/^E\d+$/u.test(label)) return null;
  const title = source
    ? `Доказове джерело ${label}: ${source.type === "guideline" ? source.ref : source.citation || source.ref}`
    : `Доказове джерело ${label}`;
  const attrs = { title, "aria-label": title };
  if (source && options.link !== false) attrs.href = `${viewUrl("evidence")}#source-${encodeURIComponent(label)}`;
  return element(source && options.link !== false ? "a" : "span", {
    className: `evidence-index${source && options.link !== false ? " focus-ring" : ""}`,
    text: label,
    attrs,
  });
}

// Bold known clinical markers/abbreviations inside a plain string (→ HTML).
function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
}
const MARKER_RE = /\b(TFH|PTCL|CHL|AITL|MGRS|LCDD|MIDD|PGNMID|PD-?1|CD279|CD\d+[a-z]?|BCL6|CXCL13|ICOS|MUM1|PAX5|Ki-?67|TCR|TRBC1|TRB|TRG|MGPT|EBER|EBV|HHV-?8|LANA-?1|ALK|TP63|DUSP22|PET-?CT|LDH|NodeRADS|sIL-2R|IgA|IgG|IgM|C3|C1q|PAS|KDIGO|NCCN|IKMG|RPS)\b/g;
function highlightMarkers(text) {
  return escapeHtml(displayText(text)).replace(MARKER_RE, "<b>$1</b>");
}

const CLINICAL_EMPHASIS_RE = /(Звіт №[^:]{1,80}(?=:)|не підтверджує|свідчить на користь|лімфом[\p{L}\p{M}-]* Ходжкіна|нодальн[\p{L}\p{M}-]+ [^.;]{0,90}лімфом[\p{L}\p{M}-]*|периферичн[\p{L}\p{M}-]+ Т-клітинн[\p{L}\p{M}-]+ лімфом[\p{L}\p{M}-]*|ALK-позитивн[\p{L}\p{M}-]+ ALCL|LCDD\/MIDD|нефротичн[\p{L}\p{M}-]+ протеїнур[\p{L}\p{M}-]*|монотиповість|ультраструктур[\p{L}\p{M}-]* депозит[\p{L}\p{M}-]*|провідн[\p{L}\p{M}-]+ робоч[\p{L}\p{M}-]+ гіпотез[\p{L}\p{M}-]*|з меншою ймовірністю|не автономн[\p{L}\p{M}-]+ діагноз[\p{L}\p{M}-]*|не доведен[\p{L}\p{M}-]*)/giu;

function highlightClinicalSummary(text) {
  return escapeHtml(displayText(text))
    .replace(CLINICAL_EMPHASIS_RE, "<strong>$1</strong>")
    .replace(MARKER_RE, "<b>$1</b>");
}

function summaryGroupKey(sentence) {
  if (/(?:\bотже\b|\bтепер\b|системна задача|найсильніший.{0,30}вузол|джерельний висновок|залишається.{0,40}ймовірн|не доведен)/iu.test(sentence)) return "conclusion";
  if (/(?:звіт|біопс|ІГХ|імуногістохім|дослідж|показує|свідчить|CRP|феритин|депозит|\d{2}\.\d{2}\.\d{4})/iu.test(sentence)) return "evidence";
  return "context";
}

function clinicalSummary(text) {
  const sentences = displayText(text || "")
    .split(/(?<=[.!?])\s+(?=[А-ЯA-ZІЇЄҐ0-9])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (!sentences.length) return emptyState("Клінічне резюме не записано.");

  const groups = { context: [], evidence: [], conclusion: [] };
  sentences.forEach((sentence) => groups[summaryGroupKey(sentence)].push(sentence));
  const labels = {
    context: "Вихідна рамка",
    evidence: "Ключові дані",
    conclusion: "Поточна інтерпретація",
  };
  const wrapper = element("div", { className: "clinical-summary" });
  for (const key of ["context", "evidence", "conclusion"]) {
    if (!groups[key].length) continue;
    const block = element("section", { className: "clinical-summary-block", attrs: { "data-kind": key } });
    block.append(element("p", { className: "clinical-summary-label", text: labels[key] }));
    const copy = element("div", { className: "clinical-summary-copy" });
    groups[key].forEach((sentence) => {
      const paragraph = element("p");
      paragraph.innerHTML = highlightClinicalSummary(sentence);
      copy.append(paragraph);
    });
    block.append(copy);
    wrapper.append(block);
  }
  return wrapper;
}

function sentenceFragments(text) {
  return displayText(text || "")
    .split(/(?<=;)\s+|(?<=[.!?])\s+(?=[А-ЯA-ZІЇЄҐ0-9])|(?<=,)\s+(?=та\s+паралельно\b)/iu)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
}

function discriminatingLabel(fragment) {
  if (/(?:оригінальн|скелець|парафінов|експертн).{0,80}(?:перегляд|блок)/iu.test(fragment)) return "Перегляд матеріалу";
  if (/(?:не дозволяє оцінити|ексцизійн|біопсі|репрезентативн)/iu.test(fragment)) return "Достатність матеріалу";
  if (/(?:ЛДГ|ПЕТ-КТ|Lugano|поширеност|стадіюван)/iu.test(fragment)) return "Оцінка поширеності";
  if (/(?:морфолог|імуногістохім|TFH-маркер|PD1|CD279|ICOS|CXCL13|CD10|BCL6)/iu.test(fragment)) return "Морфологія та панель";
  if (/(?:Ходжкін|EBER|HHV-?8|LANA|Castleman|інфекційн)/iu.test(fragment)) return "Паралельні виключення";
  if (/(?:TRB|TRG|TRBC1|клональн|молекулярн)/iu.test(fragment)) return "Підтвердження клональності";
  if (/(?:кістковий мозок|за показаннями)/iu.test(fragment)) return "За показаннями";
  return "Наступна перевірка";
}

function discriminatingTone(label) {
  if (["Перегляд матеріалу", "Достатність матеріалу", "Морфологія та панель"].includes(label)) return "evidence";
  if (label === "Паралельні виключення") return "miss";
  if (label === "Підтвердження клональності") return "support";
  if (label === "Оцінка поширеності") return "caution";
  return "neutral";
}

function discriminatingStatus(tone) {
  const labels = {
    evidence: "Основна верифікація",
    miss: "Паралельна перевірка",
    support: "Уточнення типу",
    caution: "Після верифікації",
    neutral: "За показаннями",
  };
  return labels[tone] || labels.neutral;
}

function discriminatingSteps(text, className = "decision-steps") {
  const list = element("ol", { className });
  const fragments = sentenceFragments(text || "Розрізняльний крок не записано.");
  fragments.forEach((fragment, index) => {
    const label = discriminatingLabel(fragment);
    const tone = discriminatingTone(label);
    const copy = element("div");
    copy.append(
      element("span", { className: "decision-step-status", text: discriminatingStatus(tone) }),
      element("strong", { text: label }),
    );
    const body = element("p");
    body.innerHTML = highlightMarkers(fragment);
    copy.append(body);
    list.append(element("li", { className: "decision-step", attrs: { "data-tone": tone } }, [
      element("span", { className: "decision-step-index", text: String(index + 1).padStart(2, "0") }),
      copy,
    ]));
  });
  return list;
}

function consiliumQuestionFragments(text) {
  const wrapper = element("div", { className: "consilium-question-fragments" });
  const fragments = sentenceFragments(text || "Питання консиліуму не записано.");
  fragments.forEach((fragment) => {
    const isQuestion = /[?]$/.test(fragment);
    const item = element("article", { className: "consilium-question-fragment", attrs: { "data-kind": isQuestion ? "question" : "context" } });
    item.append(element("p", { text: fragment }));
    wrapper.append(item);
  });
  return wrapper;
}

const PACKAGE_CATEGORY_LABELS = {
  hx: "анамнез", clinical: "клініка", timeline: "хронологія", marker: "маркери", markers: "маркери",
  imaging: "візуалізація", path: "морфологія", pathology: "морфологія", lab: "лабораторія", labs: "лабораторія",
  consult: "консультації", marrow: "кістковий мозок", treatment_history: "історія лікування",
  source_interpretation: "інтерпретації джерел", source_quality: "якість джерел", gap: "прогалини",
  case: "пакет кейсу", patient: "дані кейсу", pmid: "PubMed", guideline: "настанови", local: "локальні джерела",
  case_fact: "факти кейсу", external_evidence: "зовнішні докази", case_interpretation: "інтерпретація кейсу",
  support: "підтримують", refute: "послаблюють", neutral: "нейтральні",
};

function packageBreakdown(items, field) {
  const counts = new Map();
  (items || []).forEach((item) => {
    const key = item?.[field] || "other";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([key, count]) => `${PACKAGE_CATEGORY_LABELS[key] || enumLabel(key)} ${count}`)
    .join(" · ") || "не записано";
}

function packageNomenclature(bundle) {
  const ledger = element("div", { className: "package-ledger" });
  const entries = [
    ["Події", bundle.timeline || [], "domain", "Датована клінічна історія"],
    ["Факти", bundle.facts || [], "domain", "Нормалізовані спостереження"],
    ["Джерела", bundle.sources || [], "type", "Походження зовнішніх і кейсових доказів"],
    ["Твердження", bundle.claims || [], "kind", "Атомарні тези з відомим типом"],
    ["Гіпотези", bundle.hypotheses || [], null, "Ранжований диференціал"],
    ["Зв’язки", bundle.relations || [], "relation", "Підтримка, послаблення або нейтральність"],
  ];
  entries.forEach(([label, items, field, description]) => {
    const item = element("article", { className: "package-ledger-item" });
    const head = element("div");
    head.append(element("h4", { text: label }), element("strong", { text: items.length }));
    item.append(head, element("p", { text: description }));
    if (field) item.append(element("small", { text: packageBreakdown(items, field) }));
    ledger.append(item);
  });
  return ledger;
}

// Structured "discriminating step" card (clinical panel parity).
function discriminatingCard(text) {
  const card = element("aside", { className: "disc-card" });
  card.append(
    element("h3", { text: "План уточнення діагнозу" }),
    element("p", { className: "disc-intro", text: "Послідовність збережено з пакета кейсу; текстова мітка на кожній картці пояснює роль кроку незалежно від кольору." }),
    discriminatingSteps(text),
  );
  return card;
}

// "How to read this consilium" explainer with the evidence legend.
function consiliumLegend() {
  const box = section("Орієнтир", "Як читати цей консиліум");
  box.classList.add("legend-box");
  const grid = element("div", { className: "consilium-legend-grid" });
  const ranking = element("article", { className: "consilium-legend-item" });
  ranking.append(
    element("span", { className: "consilium-legend-index", text: "01" }),
    element("h4", { text: "Ранжування" }),
    element("p", { text: "Позиції не зводяться до одного переможця: окремо видно провідну гіпотезу, альтернативи й те, що не можна пропустити." }),
  );
  const challenge = element("article", { className: "consilium-legend-item" });
  challenge.append(
    element("span", { className: "consilium-legend-index", text: "02" }),
    element("h4", { text: "Раунд заперечень" }),
    element("p", { text: "Для кожної позиції показано аргумент прихильника, найсильніше заперечення і тест, що вирішує суперечку." }),
  );
  const evidence = element("article", { className: "consilium-legend-item" });
  evidence.append(
    element("span", { className: "consilium-legend-index", text: "03" }),
    element("h4", { text: "Доказова опора" }),
    element("p", { text: "Кожна теза спирається на простежене джерело або явно позначену прогалину." }),
    element("div", { className: "consilium-legend-chips" }, [
      element("span", { className: "chip evi", text: "PubMed" }),
      element("span", { className: "chip guideline", text: "Настанова" }),
      element("span", { className: "chip gap", text: "Прогалина" }),
    ]),
  );
  grid.append(ranking, challenge, evidence);
  box.append(grid);
  return box;
}

// Left-accent tone for a hypothesis card (by rank/status).
function hypothesisTone(status, rank) {
  if (rank === 1 || ["leading", "leading-provisional"].includes(status)) return "lead";
  if (["critical", "must-resolve", "must-not-miss", "must_not_miss", "safety"].includes(status)) return "critical";
  if (["excluded", "largely-excluded"].includes(status)) return "muted";
  return "";
}

function graphHypothesisRole(item) {
  const status = String(item?.status || "").toLowerCase();
  if (item?.rank === 1 || ["leading", "leading-provisional"].includes(status)) return "Провідна";
  if (["must-not-miss", "must_not_miss", "safety"].includes(status)) return "Критичний диференціал";
  if (["critical", "must-resolve"].includes(status)) return "Потребує вирішення";
  if (status === "downgraded") return "Альтернатива";
  if (status === "parallel-check") return "Паралельна перевірка";
  if (status.includes("low-probability")) return "Низька ймовірність";
  if (["excluded", "largely-excluded"].includes(status)) return "Послаблена";
  return "Робоча гіпотеза";
}

function emptyState(message) {
  return element("p", { className: "empty-state", text: message });
}

function definitionList(items, className = "metadata") {
  const list = element("dl", { className });
  for (const [label, value] of items) {
    const item = element("div");
    item.append(element("dt", { text: label }), element("dd", { text: textValue(value) }));
    list.append(item);
  }
  return list;
}

function metadataField(label, value, className = "") {
  const field = element("div", { className: `governance-field ${className}`.trim() });
  field.append(element("dt", { text: label }), element("dd", { text: textValue(value) }));
  return field;
}

function deidentificationLabel(value) {
  const labels = {
    working_deidentified: "робоче знеособлення підтверджено",
    declared_deidentified: "знеособлення задекларовано",
    declared_deidentified_canonical_text_only: "доступний канонічний текст знеособлено",
    minimum_necessary_clinical_projection: "мінімально необхідний знеособлений клінічний набір",
    deidentified: "знеособлено",
  };
  return labels[String(value || "").toLowerCase()] || displayText(value || "статус не записано");
}

function clinicianNarrative(value) {
  return textValue(value)
    .replace(/Для\s+T\d{3}\s+первинну консультацію/gu, "Первинну консультацію")
    .replace(/Для\s+T\d{3}\s+використано\s+data\/source_extracts\/[^;]+;/gu, "Для датованої консультації використано локальний знеособлений структурований витяг;")
    .replace(/\bT\d{3}\b/gu, "датована подія")
    .replace(/\bdata\/source_extracts\/[^\s;,]+/gu, "локальний знеособлений структурований витяг")
    .replace(/\bdata\/[^\s;,]+_labs\.csv\b/gu, "структурований лабораторний набір");
}

function governanceSummary(bundle) {
  const wrapper = element("dl", { className: "governance-layout" });
  const core = element("div", { className: "governance-core" }, [
    metadataField("Кейс", bundle.case.id),
    metadataField("Сформовано", bundle.case.generated),
    metadataField("Версія контракту", bundle.schema_version),
  ]);
  const detail = element("div", { className: "governance-detail" });
  detail.append(
    metadataField("Джерело", clinicianNarrative(bundle.case.source), "governance-source"),
    element("div", { className: "governance-deidentification" }, [
      metadataField("Статус деідентифікації", deidentificationLabel(bundle.deidentification.status)),
      metadataField(
        "Вилучені категорії",
        bundle.deidentification.categories_removed.length
          ? bundle.deidentification.categories_removed.join(", ")
          : "Не зафіксовано для попереднього кейсу.",
      ),
    ]),
  );
  wrapper.append(core, detail);
  return wrapper;
}

function sourceById(id) {
  return state.bundle.sources.find((source) => source.id === id);
}

function claimById(id) {
  return (state.bundle.claims || []).find((claim) => claim.id === id);
}

function claimLayer(claim) {
  const layers = {
    case_fact: ["Дані з кейсу", "evidence"],
    external_evidence: ["Висновок із настанови або статті", "evidence"],
    source_interpretation: ["Висновок із настанови або статті", "candidate"],
    case_interpretation: ["Пояснення для цього кейсу", "candidate"],
    gap: ["Прогалина", "critical"],
  };
  return layers[claim?.kind] || ["Твердження", ""];
}

function factById(id) {
  return state.bundle.facts.find((fact) => fact.id === id);
}

function hypothesisById(id) {
  return state.bundle.hypotheses.find((hypothesis) => hypothesis.id === id);
}

function hypothesesSupportedBy(source) {
  const explicit = (source.supports || [])
    .map((id) => claimById(id))
    .filter(Boolean)
    .flatMap((claim) => claim.hypothesis_refs || [])
    .map((id) => hypothesisById(id))
    .filter(Boolean);
  if (explicit.length) return explicit;
  return state.bundle.hypotheses.filter((hypothesis) => (hypothesis.evidence_refs || []).includes(source.id));
}

function decodedDataRef(ref) {
  const fact = factById(ref);
  return fact ? `Знахідка ${ref}: ${fact.label}` : String(ref);
}

function decodedSourceRef(ref) {
  const source = sourceById(ref);
  return source ? `${source.ref}: ${source.citation}` : String(ref);
}

function hypothesisStatus(value) {
  return LABELS.hypothesisStatus[value] || value || "потребує перевірки";
}

function sourceTypeLabel(source) {
  return LABELS.sourceType[source.type] || source.type;
}

function sourceStatusChips(source) {
  const row = element("div", { className: "chip-row" });
  const claim = (source.supports || []).map((id) => claimById(id)).find(Boolean);
  const level = claim?.verification?.level;
  if (level && LABELS.verification[level]) {
    const [label, tone] = verificationLabel(level);
    row.append(statusTag(label, tone));
    return row;
  }
  if (source.type === "pmid") {
    row.append(statusTag("публікація", "evidence"));
  } else if (source.type === "guideline") {
    return null;
  } else if (source.type === "gap") {
    row.append(statusTag("прогалина доказів", "critical"));
  } else {
    row.append(statusTag(sourceTypeLabel(source), ""));
  }
  return row;
}

// Explain what a "guideline trace" is and what each status chip means (for clinicians).
function guidelineExplainer() {
  const box = element("aside", { className: "explainer" });
  box.innerHTML =
    '<b>Як читати покажчик.</b> У записі <b>NCCN Hodgkin v2.2026 (HODG-1A, p.9)</b> зазначено назву й версію настанови, індекс розділу <b>HODG-1A</b> та сторінку PDF <b>9</b>. Це точне місце, яке треба відкрити в оригінальному документі й звірити перед клінічним використанням. Фіолетові чіпи нижче є такими покажчиками; повторюваний статусний чіп прибрано.';
  return box;
}

function guidelineCitation(source) {
  const exactPointer = displayText(source.ref || "").trim();
  if (source.human_verified === true && /(?:\bp\.|\bPDF\b|\bCh\.|Practice Point)/i.test(exactPointer)) {
    return exactPointer;
  }
  let text = displayText(source.citation || "");
  text = text
    .replace(/^Кандидатний локальний слід настанови\.?\s*/i, "")
    .replace(/;?\s*потрібна перевірка джерела\/?клініцистом\.?$/i, "")
    .trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Теза прив’язана до вказаного розділу та сторінки настанови.";
}

function guidelineList(limit = Infinity) {
  const guidelines = state.bundle.sources.filter((source) => source.type === "guideline").slice(0, limit);
  if (!guidelines.length) return emptyState("У пакеті немає попередніх слідів із настанов для цього кейсу.");
  const list = element("div", { className: "source-list" });
  guidelines.forEach((source) => {
    const item = element("article", {
      className: "source-item",
      attrs: { id: `source-${source.id}` },
    });
    item.append(
      element("div", { className: "guideline-pointer" }, [evidenceIndex(source.id, { link: false }), evidenceChip(source.id)]),
      element("p", { className: "src-cite", text: guidelineCitation(source) }),
    );
    const linked = hypothesesSupportedBy(source);
    if (linked.length) {
      const wrap = element("div", { className: "src-linked" });
      wrap.append(element("span", { className: "src-linked-label", text: "Гіпотези" }));
      linked.forEach((h) => wrap.append(element("span", { className: "chip", text: `#${h.rank} ${h.label}` })));
      item.append(wrap);
    }
    list.append(item);
  });
  return list;
}

function recommendationPlanForCase(bundle) {
  // Canonical source: the validated case bundle. The renderer never authors
  // case-specific clinical content — it only maps contract fields to view props.
  const canonical = projectedWorkupPlan(bundle);
  if (canonical.length) return canonical;
  const missing = (bundle.clinical_state?.panel || []).flatMap((group) =>
    (group.items || []).filter((item) => item.present === false).map((item) => ({ ...item, group: group.group })),
  );
  return missing.map((item) => ({
    title: item.t || item.test || item.name || item.group || "Незаповнена перевірка",
    action: item.action || item.why || item.group || "Точний спосіб виконання не записано.",
    why: item.interpretive_limit || item.note || "Результат має бути зіставлений із провідною та альтернативними гіпотезами.",
    refs: item.evidence_refs || item.source_refs || [],
    status: item.disc === "critical" || item.disc === "decisive" ? "Обов’язкова перевірка" : enumLabel(item.disc || "Не виконано"),
    tone: item.disc === "critical" || item.disc === "decisive" ? "danger" : "caution",
    phase: item.phase || (item.disc === "critical" || item.disc === "decisive" ? "Для верифікації діагнозу" : "Додаткові дані"),
  }));
}

function overviewPlanPhases(bundle) {
  const grouped = new Map();
  recommendationPlanForCase(bundle).forEach((item) => {
    const phase = item.phase || "Наступні перевірки";
    if (!grouped.has(phase)) grouped.set(phase, []);
    grouped.get(phase).push(item);
  });
  const list = element("ol", { className: "overview-plan-phases" });
  [...grouped.entries()].forEach(([phase, items], index) => {
    const parallel = items.some((item) => item.tone === "miss" || /не пропустити/iu.test(item.status || ""));
    const deferred = /після/iu.test(phase);
    const firstPriority = index === 0 && !deferred;
    const timing = firstPriority ? "Першочергово" : parallel ? "Паралельно" : deferred ? "Після підтвердження" : "Наступний етап";
    const details = element("div", { className: "overview-plan-items" });
    items.forEach((item) => {
      const action = displayText(item.action || "Спосіб виконання не записано в пакеті.");
      const why = displayText(item.why || "Клінічне обґрунтування не записано в пакеті.");
      const sourceRefs = [...new Set(item.refs || [])].filter((ref) => sourceById(ref));
      const children = [
        element("div", { className: "overview-plan-item-head" }, [
          element("strong", { text: item.title }),
          element("div", {
            className: "overview-plan-scope",
            attrs: { "aria-label": "Діагностичне охоплення кроку" },
          }, (item.scope || []).map((scope) => element("span", {
            className: "overview-plan-scope-chip",
            text: scope.id === "STAGING" ? `${scope.label} · ${scope.role}` : `${scope.id} · ${scope.role}`,
            attrs: { "data-role": scope.role, title: scope.label },
          }))),
        ]),
        element("div", { className: "overview-plan-field" }, [
          element("span", { text: "Що зробити" }),
          element("p", { text: action }),
        ]),
        element("div", { className: "overview-plan-field overview-plan-why" }, [
          element("span", { text: "Навіщо" }),
          element("p", { text: why }),
        ]),
      ];
      if (sourceRefs.length) {
        children.push(element("div", { className: "overview-plan-source-block" }, [
          element("span", { className: "overview-plan-source-label", text: "Підстава" }),
          element("div", {
            className: "overview-plan-sources",
            attrs: { "aria-label": "Настанови та статті для цього кроку" },
          }, sourceRefs.map((ref) => {
            const source = sourceById(ref);
            const title = evidencePublicationTitle(source);
            const year = evidencePublicationYear(source);
            const content = [
              evidenceIndex(ref, { link: false }),
              element("span", { className: "overview-plan-source-copy" }, [
                element("span", { className: "overview-plan-source-meta" }, [
                  element("span", { className: "overview-plan-source-kind", text: evidencePublicationKind(source) }),
                  ...(year ? [element("span", { className: "overview-plan-source-year", text: year })] : []),
                ]),
                element("span", { className: "overview-plan-source-title", text: title }),
              ]),
            ];
            const attrs = source?.source_uri?.startsWith("http")
              ? { href: source.source_uri, target: "_blank", rel: "noopener", title: source.citation || title }
              : { title: source?.citation || title };
            return element(source?.source_uri?.startsWith("http") ? "a" : "div", {
              className: "overview-plan-source focus-ring",
              attrs,
            }, content);
          })),
        ]));
      }
      details.append(element("div", { className: "overview-plan-item" }, children));
    });
    list.append(element("li", {
      attrs: { "data-state": firstPriority ? "priority-one" : parallel ? "parallel" : deferred ? "deferred" : "primary" },
    }, [
      element("div", { className: "overview-plan-step" }, [
        element("span", { className: "overview-plan-index", text: String(index + 1).padStart(2, "0") }),
        element("span", { className: "overview-plan-timing", text: timing }),
      ]),
      element("div", {}, [
        element("strong", { className: "overview-plan-phase-title", text: phase }),
        details,
        element("small", { text: `${items.length} ${items.length === 1 ? "перевірка" : items.length < 5 ? "перевірки" : "перевірок"}` }),
      ]),
    ]));
  });
  return list;
}

function overviewSourceBreakdown(bundle) {
  const labels = {
    consultation: "Консультативні висновки",
    laboratory: "Лабораторні протоколи",
    imaging: "Протоколи візуалізації",
    pathology: "Патоморфологія та ІГХ",
    procedure: "Діагностичні процедури",
    other: "Інша клінічна документація",
  };
  const order = ["consultation", "laboratory", "imaging", "pathology", "procedure", "other"];
  const counts = sourceDocumentBreakdown(bundle);
  const breakdown = element("span", { className: "overview-source-breakdown", attrs: { "aria-label": "Склад первинної документації" } });
  order.filter((type) => counts[type]).forEach((type) => {
    breakdown.append(element("span", { className: "overview-source-type" }, [
      element("span", { text: labels[type] }),
      element("b", { text: counts[type] }),
    ]));
  });
  return breakdown;
}

function overviewClinicalBrief(bundle) {
  return bundle.case.overview_brief || bundle.case.demographics || "Клінічний профіль не записано у пакеті.";
}

function overviewCaseCode(bundle) {
  const raw = String(bundle.case.id || "КЕЙС");
  const number = raw.match(/\d+/)?.[0];
  return number ? `CASE-${number.padStart(2, "0")}` : raw.replace(/[^A-Za-z0-9А-Яа-яІіЇїЄєҐґ-]/gu, "");
}

function isCandidateOnlyBundle(bundle) {
  return bundle?.provenance?.ingest_release_status === "candidate_only";
}

function agentSynthesisLabel() {
  return element("span", {
    className: "ai-presence-label",
    attrs: {
      title: "Попередній синтез сформовано агентним контуром із канонічного пакета; його має перевірити лікар.",
      "aria-label": "Агентний синтез, потребує перевірки лікарем",
    },
  }, [
    element("span", { className: "ai-presence-icon", text: "ШІ", attrs: { "aria-hidden": "true" } }),
    element("span", { text: "Агентний синтез · перевіряє лікар" }),
  ]);
}

function overviewBriefItems(bundle) {
  const fragments = sentenceFragments(overviewClinicalBrief(bundle));
  if (!fragments.length) return [];
  const values = fragments.length <= 3
    ? fragments
    : [fragments[0], fragments[1], fragments.slice(2).join(" ")];
  const labels = ["Пацієнт", "Клінічний перебіг", "Попередній контекст"];
  return values.map((value, index) => ({ label: labels[index] || "Контекст", value }));
}

function overviewLeadRationale(lead, bundle) {
  const fragments = sentenceFragments(lead?.stance || bundle.case.signal || "");
  if (!fragments.length) return "Обґрунтування не записано.";
  let boundaryIndex = fragments.findIndex((fragment, index) => index > 0 && /^(?:Водночас|Однак|Проте|Але|Попри)\b/iu.test(fragment));
  if (boundaryIndex < 0 && fragments.length > 2) boundaryIndex = fragments.length - 1;
  return boundaryIndex < 0 ? fragments.join(" ") : fragments.slice(0, boundaryIndex).join(" ");
}

function overviewArgumentCopy(item, lead) {
  const text = String(item?.text || "").trim();
  if (item?.key === "support") {
    const decisiveFacts = (lead?.data_refs || [])
      .map((ref) => factById(ref))
      .filter(Boolean)
      .slice(0, 2)
      .map((fact) => fact.label || fact.detail)
      .filter(Boolean);
    return {
      signal: decisiveFacts.join(" · ") || text,
      detail: decisiveFacts.length ? text : "",
    };
  }

  const separator = item?.key === "discriminate" ? "→" : ";";
  const separatorIndex = text.indexOf(separator);
  if (separatorIndex < 0) return { signal: text, detail: "" };
  const signal = text.slice(0, separatorIndex).trim().replace(/[.;:]+$/u, "");
  const remainder = text.slice(separatorIndex + separator.length).trim();
  const detail = remainder ? `${remainder.charAt(0).toLocaleUpperCase("uk-UA")}${remainder.slice(1)}` : "";
  return {
    signal: signal ? `${signal}.` : text,
    detail,
  };
}

function overviewCompositionBar(counts) {
  const segments = [
    ...Array(counts.support).fill("support"),
    ...Array(counts.refute).fill("refute"),
    ...Array(counts.neutral).fill("neutral"),
  ];
  return element("span", {
    className: "overview-composition",
    attrs: {
      role: "img",
      "aria-label": `Свідчать на користь: ${counts.support}; суперечать: ${counts.refute}; нейтральні: ${counts.neutral}`,
    },
  }, segments.map((tone) => element("i", { className: tone, attrs: { "aria-hidden": "true" } })));
}

function overviewDifferentialRank(bundle, hypotheses) {
  const section = element("section", {
    className: "overview-differential-rank",
    attrs: { "aria-labelledby": "overview-differential-title" },
  });
  section.append(element("header", { className: "overview-differential-head" }, [
    element("div", {}, [
      element("h4", { text: "Диференційний ряд", attrs: { id: "overview-differential-title" } }),
      element("p", { text: "Склад зв’язків із даними кейсу; це не оцінка ймовірності." }),
    ]),
    element("div", { className: "overview-composition-legend", attrs: { "aria-label": "Позначення зв’язків" } }, [
      element("span", { className: "support", text: "свідчить на користь" }),
      element("span", { className: "refute", text: "суперечить" }),
      element("span", { className: "neutral", text: "нейтрально" }),
    ]),
  ]));
  const rows = element("div", { className: "overview-differential-list" });
  hypotheses.forEach((hypothesis) => {
    const counts = relationCountsForHypothesis(bundle, hypothesis.id);
    rows.append(element("div", { className: "overview-differential-row" }, [
      element("span", { className: "overview-differential-number", text: hypothesis.id || "—" }),
      element("strong", { className: "overview-differential-label", text: hypothesis.short_label || hypothesis.label }),
      overviewCompositionBar(counts),
      element("span", {
        className: "overview-differential-counts",
        attrs: { title: "На користь · суперечить · нейтрально", "aria-label": `На користь: ${counts.support}; суперечить: ${counts.refute}; нейтрально: ${counts.neutral}` },
      }, [
        element("span", { className: "support", text: `+${counts.support}`, attrs: { "aria-hidden": "true" } }),
        element("span", { className: "refute", text: `−${counts.refute}`, attrs: { "aria-hidden": "true" } }),
        element("span", { className: "neutral", text: `·${counts.neutral}`, attrs: { "aria-hidden": "true" } }),
      ]),
    ]));
  });
  section.append(rows);
  return section;
}

function renderOverview() {
  const bundle = state.bundle;
  const hypotheses = [...bundle.hypotheses].sort((a, b) => a.rank - b.rank);
  const lead = leadingHypothesis(bundle) || hypotheses[0];
  const timeline = [...(bundle.timeline || [])];
  const firstDate = timeline[0]?.date || "—";
  const lastDate = timeline.at(-1)?.date || bundle.case.generated || "—";
  const fragment = document.createDocumentFragment();
  const briefHeader = element("header", { className: "overview-brief-header" });
  const briefTitle = element("div", { className: "overview-brief-title" }, [
    element("p", { className: "overview-eyebrow", text: "Поточний стан кейсу" }),
    element("h2", { text: "Клінічний огляд" }),
    element("span", { className: "view-context", text: overviewCaseCode(bundle) }),
  ]);
  const briefFacts = element("dl", { className: "overview-brief-facts" });
  overviewBriefItems(bundle).forEach((item) => {
    briefFacts.append(element("div", {}, [
      element("dt", { text: item.label }),
      element("dd", { text: item.value }),
    ]));
  });
  briefHeader.append(briefTitle, briefFacts);
  fragment.append(briefHeader);

  const sourceDocumentCount = bundle.source_documents?.length || 0;
  const observationCount = bundle.observations?.length || 0;
  const packageSummary = element("aside", { className: "overview-package-summary", attrs: { "aria-label": "Коротко про пакет даних" } }, [
    element("span", { className: "overview-package-stat overview-package-sources" }, [
      element("small", { text: "Клінічні документи" }),
      element("strong", { text: `Усього: ${sourceDocumentCount || bundle.sources.length}` }),
      overviewSourceBreakdown(bundle),
    ]),
    element("span", { className: "overview-package-stat" }, [element("small", { text: "Структуровано" }), element("strong", { text: `${observationCount || bundle.facts.length} спостережень` })]),
    element("span", { className: "overview-package-stat" }, [element("small", { text: "Період" }), element("strong", { text: `${firstDate} — ${lastDate}` })]),
    element("span", { className: "overview-package-state", text: "Знеособлений пакет" }),
    element("a", { className: "focus-ring", text: "Походження даних →", attrs: { href: viewUrl("evidence") } }),
  ]);
  fragment.append(packageSummary);

  const deck = element("section", { className: "overview-command-deck" });
  const commandMain = element("div", { className: "overview-command-main" });
  const candidateOnly = isCandidateOnlyBundle(bundle);
  const assessment = element("div", {
    className: `overview-primary-assessment${candidateOnly ? " ai-presence-surface" : ""}`,
  });
  const assessmentHead = element("div", { className: "overview-section-head" });
  const assessmentTitle = element("div");
  assessmentTitle.append(
    element("p", { className: "overview-assessment-label", text: "Провідна попередня гіпотеза" }),
    element("h3", { className: "overview-primary-title", text: lead?.short_label || lead?.label || "Робоча гіпотеза не сформована", attrs: lead?.label ? { title: lead.label } : {} }),
  );
  if (candidateOnly) assessmentTitle.append(agentSynthesisLabel());
  assessmentHead.append(assessmentTitle);
  const assessmentCopy = element("div");
  const leadRationale = overviewLeadRationale(lead, bundle);
  const rationale = element("div", { className: "overview-rationale" }, [
    element("div", {}, [
      element("h4", { text: "Клініко-морфологічне обґрунтування" }),
      element("p", { text: leadRationale }),
    ]),
  ]);
  assessmentCopy.append(rationale);
  const challenge = hypothesisChallenge(lead);
  if (challenge.length) {
    assessmentCopy.append(element("div", {
      className: "overview-argument-grid",
      attrs: { "aria-label": "Клінічна аргументація провідної гіпотези" },
    }, challenge.map((item) => {
      const copy = overviewArgumentCopy(item, lead);
      return element("section", {
        className: "overview-argument-card",
        attrs: { "data-argument": item.key },
      }, [
        element("h4", { text: item.label }),
        element("p", { className: "overview-argument-signal", text: copy.signal }),
        ...(copy.detail ? [element("p", { className: "overview-argument-detail", text: copy.detail })] : []),
      ]);
    })));
  }
  assessment.append(assessmentHead, assessmentCopy);
  assessment.append(overviewDifferentialRank(bundle, hypotheses));
  assessment.append(element("a", { className: "overview-text-link focus-ring", text: "Переглянути факти та зв’язки на графі →", attrs: { href: viewUrl("graph") } }));

  const decision = element("aside", { className: "overview-decision-gate" });
  decision.append(
    element("div", { className: "overview-decision-heading" }, [
      element("h3", { text: "План діагностичної верифікації" }),
      element("p", { text: "Перші кроки перевіряють провідну гіпотезу та прямий морфологічний диференціал; паралельні — критичні альтернативи. Стадіювання починається лише після тканинного підтвердження. Чіпи біля кожного кроку показують його діагностичну роль." }),
    ]),
    overviewPlanPhases(bundle),
  );
  decision.append(element("a", { className: "overview-text-link focus-ring", text: "Повний план досліджень і матеріалів →", attrs: { href: viewUrl("state") } }));
  commandMain.append(assessment, decision);
  deck.append(commandMain);
  fragment.append(deck);

  const workspace = element("div", { className: "overview-workspace single-column" });
  const workspaceMain = element("div", { className: "overview-workspace-main" });
  const balance = element("section", { className: "overview-panel" });
  const balanceHead = element("div", { className: "overview-panel-head" });
  const balanceTitle = element("div");
  balanceTitle.append(element("h3", { text: "Критерій переходу від гіпотези до висновку" }), element("p", { className: "overview-panel-copy", text: "Що має з’явитися у репрезентативному матеріалі — і що змусить змінити напрям." }));
  balanceHead.append(balanceTitle);
  if (bundle.relations.length) balanceHead.append(element("a", { className: "overview-text-link focus-ring", text: "Дивитися граф →", attrs: { href: viewUrl("graph") } }));
  const criteria = element("div", { className: "overview-verification-criteria" }, [
    element("article", { attrs: { "data-kind": "confirm" } }, [
      element("h4", { text: "Підтвердить напрям" }),
      element("p", { text: lead?.confirms || "Критерій підтвердження не записано." }),
    ]),
    element("article", { attrs: { "data-kind": "refute" } }, [
      element("h4", { text: "Змусить змінити напрям" }),
      element("p", { text: lead?.refutes || "Критерій спростування не записано." }),
    ]),
  ]);
  balance.append(balanceHead, criteria);
  workspaceMain.append(balance);
  workspace.append(workspaceMain);
  fragment.append(workspace);
  return fragment;
}

function timelineDomainLabel(value) {
  const labels = {
    hx: "анамнез",
    clinical: "клінічна подія",
    marker: "лабораторія",
    labs: "лабораторія",
    lab: "лабораторія",
    pathology: "патоморфологія",
    path: "патоморфологія",
    imaging: "візуалізація",
    consult: "консультація",
    treatment_history: "попереднє лікування",
    marrow: "кістковий мозок",
  };
  return labels[String(value || "").toLowerCase()] || displayText(value || "подія");
}

const SPINE_DAY = 24 * 60 * 60 * 1000;
const SPINE_ANATOMY_IMAGE = "assets/anatomy-reference.png";
const SPINE_ANATOMY_SOURCE = "https://www.nicepng.com/png/detail/71-715709_black-and-white-download-products-browse-by-anatomy.png";
const SPINE_GROUPS = [
  { id: "clinical", label: "Перебіг", description: "Симптоми, огляд і зміни клінічного стану", match: ["clinical", "hx"] },
  { id: "laboratory", label: "Аналізи / маркери", description: "Лабораторні показники та датовані маркери", match: ["lab", "labs", "marker"] },
  { id: "imaging", label: "Візуалізація", description: "УЗД, КТ, МРТ, ПЕТ/КТ та описана динаміка", match: ["imaging"] },
  { id: "pathology", label: "Тканини / ІГХ", description: "Цитологія, біопсії, морфологія та імуногістохімія", match: ["path", "pathology", "marrow"] },
  { id: "consult", label: "Консультації", description: "Позиції спеціалістів і зафіксовані питання", match: ["consult"] },
  { id: "treatment", label: "Лікування", description: "Втручання й лікувальні події, якщо вони є в пакеті", match: ["treatment", "treatment_history"] },
];

function spineParseTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw;
  const time = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
}

function spineClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function spineLongDate(time) {
  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(time));
}

function spineShortDate(time) {
  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(time));
}

function spineMonthDate(time) {
  return new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(time));
}

function spineRawDate(value) {
  const raw = String(value || "—").trim();
  const time = spineParseTime(value);
  if (time === null) return raw;
  return /^\d{4}-\d{2}$/.test(raw) ? spineMonthDate(time) : spineShortDate(time);
}

function spineCursorDate(time, events, style = "long") {
  const monthEvent = events.find((event) => event.time === time && /^\d{4}-\d{2}$/.test(String(event.date || "")));
  if (monthEvent) return spineMonthDate(time);
  return style === "short" ? spineShortDate(time) : spineLongDate(time);
}

function spineCursorDateTime(time, events) {
  const monthEvent = events.find((event) => event.time === time && /^\d{4}-\d{2}$/.test(String(event.date || "")));
  return monthEvent?.date || new Date(time).toISOString().slice(0, 10);
}

function spineDocumentTypeLabel(documentItem) {
  const labels = {
    laboratory: "лабораторний бланк",
    imaging: "опис візуалізації",
    pathology: "патоморфологічний документ",
    consultation: "висновок консультації",
    procedure: "опис процедури",
    hospital_record: "медичний запис",
    other: "клінічний документ",
  };
  return labels[documentItem?.document_type] || "клінічний документ";
}

function spineDocumentFocus(documentItem, observations = []) {
  const rawSummary = meaningfulText(documentItem?.summary);
  const summary = rawSummary
    .replace(/^(?:лабораторний бланк|лабораторний документ)\s*:\s*/iu, "")
    .replace(/[.;]\s*$/u, "")
    .trim();
  const firstSentence = summary.split(/\.\s+/u)[0]?.trim() || "";
  const procedure = observations.find((observation) => (
    observation?.kind === "procedure"
    && observation?.display
    && String(observation.display).toLowerCase() !== "procedure"
  ));
  let focus = procedure?.display || "";
  if (!focus && documentItem?.document_type === "consultation") {
    focus = firstSentence.split(/\s+на тлі(?:\s|$)/iu)[0];
  }
  if (!focus && documentItem?.document_type === "pathology" && /^гастроскоп/iu.test(firstSentence)) {
    focus = firstSentence.split(/\s+описує\b/iu)[0];
  }
  if (!focus) focus = firstSentence || enumLabel(documentItem?.document_type || "Клінічний документ");
  focus = focus.replace(/[.:;]\s*$/u, "").trim();
  focus = focus.charAt(0).toUpperCase() + focus.slice(1);
  return wordClip(focus, 78);
}

const SPINE_DOMAIN_BY_DOCUMENT_TYPE = {
  laboratory: "lab",
  imaging: "imaging",
  pathology: "path",
  consultation: "consult",
  procedure: "clinical",
  hospital_record: "clinical",
  other: "clinical",
};

const SPINE_DOMAIN_BY_OBSERVATION_KIND = {
  measurement: "lab",
  imaging_finding: "imaging",
  pathology_finding: "path",
  diagnostic_interpretation: "path",
  negative_finding: "path",
  recommendation: "consult",
  procedure: "clinical",
  clinical_note: "clinical",
  gap: "clinical",
};

const SPINE_KIND_LABEL = {
  clinical_note: "Клінічні відомості",
  measurement: "Показники",
  imaging_finding: "Знахідки візуалізації",
  pathology_finding: "Морфологія та ІГХ",
  diagnostic_interpretation: "Висновки джерела",
  procedure: "Процедури",
  recommendation: "Рекомендації",
  negative_finding: "Негативні знахідки",
  gap: "Потребує перевірки",
};

function spineObservationValue(observation) {
  return observation?.value_text
    || (observation?.value_number !== null && observation?.value_number !== undefined
      ? `${observation.value_number}${observation.unit ? ` ${observation.unit}` : ""}`
      : "");
}

function spineObservationMissingDetail(observation) {
  return !spineObservationValue(observation)
    && !observation?.reference_range
    && !observation?.interpretation;
}

function spineObservationPriority(observation) {
  const interpretation = observationInterpretation(observation);
  const abnormal = /підвищ|знижен|вище|нижче|потребує|нечитаб|review/iu.test(interpretation);
  const kindWeights = {
    gap: 100,
    diagnostic_interpretation: 70,
    pathology_finding: 64,
    imaging_finding: 58,
    measurement: 50,
    procedure: 46,
    recommendation: 42,
    negative_finding: 36,
    clinical_note: 30,
  };
  return (kindWeights[observation?.kind] || 20)
    + (abnormal ? 35 : 0)
    + (/\bNILM\b/iu.test(`${spineObservationValue(observation)} ${interpretation}`) ? 30 : 0)
    + (spineObservationMissingDetail(observation) ? 18 : 0);
}

function spineObservationClinicalInterpretation(observation) {
  const raw = observation?.interpretation || observation?.assertion_status || "";
  if (["candidate_source_fragment", "recorded", "source_reported"].includes(raw)) return "";
  return observationInterpretation(observation);
}

function spineObservationRecord(observation) {
  const rawLabel = String(observation?.display || "").trim();
  const missingLabel = !rawLabel || rawLabel.toLowerCase() === "measurement";
  const value = spineObservationValue(observation);
  const interpretation = observation?.interpretation
    ? observationInterpretation(observation)
    : "";
  const missingDetail = spineObservationMissingDetail(observation);
  const humanVerified = observation?.verification?.human_verified === true;
  const notes = [];
  if (missingLabel) notes.push("Назву показника потрібно звірити з джерельним документом.");
  if (missingDetail) notes.push("У структурованому витягу збережена лише назва; результат потрібно звірити з первинним документом.");
  return {
    label: missingLabel ? "Кількісний показник без назви у витягу" : rawLabel,
    value,
    reference: observation?.reference_range ? `Референс: ${observation.reference_range}` : "",
    interpretation,
    note: notes.join(" "),
    attention: missingLabel || missingDetail || /підвищ|знижен|вище|нижче|потребує|нечитаб/iu.test(interpretation),
    missingDetail,
    priority: spineObservationPriority(observation),
    observationId: observation?.id || "",
    documentId: observation?.document_id || "",
    effectiveAt: observation?.effective_at || "",
    page: observation?.page || observation?.source_address?.page || "",
    humanVerified,
  };
}

function spineObservationSections(uniqueObservations) {
  const byKind = uniqueObservations.reduce((result, observation) => {
      const kind = observation.kind || "clinical_note";
      if (!result[kind]) result[kind] = [];
      result[kind].push(spineObservationRecord(observation));
      return result;
    }, {});
  return Object.entries(byKind).map(([kind, items]) => ({
      title: SPINE_KIND_LABEL[kind] || enumLabel(kind),
      tone: kind === "gap" || items.some((item) => item.attention) ? "attention" : "context",
      items: items.sort((a, b) => b.priority - a.priority),
    }));
}

function spineObservationSentence(observation) {
  const label = String(observation?.display || "Спостереження").trim();
  const value = spineObservationValue(observation);
  const interpretation = spineObservationClinicalInterpretation(observation);
  const detail = [value, interpretation].filter(Boolean).filter((item, index, items) => items.indexOf(item) === index).join(" · ");
  if (detail) return `${label}: ${detail}`;
  if (spineObservationMissingDetail(observation)) return `${label}: результат у структурованому витягу неповний`;
  return label;
}

function spineObservationGroupSummary(observations) {
  return [...observations]
    .sort((a, b) => spineObservationPriority(b) - spineObservationPriority(a))
    .slice(0, 4)
    .map(spineObservationSentence)
    .join(". ");
}

function spineObservationGroupFocus(documentItem, observations, splitFromDocumentDate) {
  if (!splitFromDocumentDate) return spineDocumentFocus(documentItem, observations);
  const primary = [...observations].sort((a, b) => spineObservationPriority(b) - spineObservationPriority(a))[0];
  if (!primary) return spineDocumentFocus(documentItem, observations);
  const label = String(primary.display || "Клінічний результат").trim();
  const value = spineObservationValue(primary);
  const interpretation = spineObservationClinicalInterpretation(primary);
  const conciseValue = /\bNILM\b/iu.test(value) ? "NILM" : (value.length <= 36 ? value : "");
  const suffixValue = interpretation || conciseValue;
  const suffix = suffixValue ? ` — ${suffixValue}` : "";
  return wordClip(`${label}${suffix}`, 78);
}

function spineObservationGroupDomain(documentItem, observations, splitFromDocumentDate) {
  if (!splitFromDocumentDate) return SPINE_DOMAIN_BY_DOCUMENT_TYPE[documentItem?.document_type] || "clinical";
  const scores = new Map();
  observations.forEach((observation) => {
    const domain = SPINE_DOMAIN_BY_OBSERVATION_KIND[observation?.kind] || "clinical";
    scores.set(domain, (scores.get(domain) || 0) + spineObservationPriority(observation));
  });
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "clinical";
}

function spineDocumentObservations(documentItem, observations) {
  const refs = new Set(documentItem?.observation_refs || []);
  return observations.filter((observation) => refs.has(observation.id));
}

function spineCandidateEvents(bundle) {
  const documents = Array.isArray(bundle.source_documents) ? bundle.source_documents : [];
  const observations = Array.isArray(bundle.observations) ? bundle.observations : [];
  if (!documents.length || !observations.length) return [];
  return documents.flatMap((documentItem, documentIndex) => {
    const uniqueObservations = spineDocumentObservations(documentItem, observations);
    if (!uniqueObservations.length) return [];
    const byDate = new Map();
    uniqueObservations.forEach((observation) => {
      const eventDate = observation.effective_at || documentItem.document_date || null;
      if (!eventDate) return;
      if (!byDate.has(eventDate)) byDate.set(eventDate, []);
      byDate.get(eventDate).push(observation);
    });
    const mixedDates = byDate.size > 1;
    return [...byDate.entries()].map(([eventDate, eventObservations], groupIndex) => {
      const splitFromDocumentDate = eventDate !== documentItem.document_date;
      const domain = spineObservationGroupDomain(documentItem, eventObservations, splitFromDocumentDate);
      const focus = spineObservationGroupFocus(documentItem, eventObservations, splitFromDocumentDate);
      const summary = mixedDates
        ? spineObservationGroupSummary(eventObservations)
        : (documentItem.summary || spineObservationGroupSummary(eventObservations));
      const sourcePages = [...new Set(eventObservations.map((observation) => observation.page || observation.source_address?.page).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
      const allHumanVerified = eventObservations.every((observation) => observation?.verification?.human_verified === true);
      const needsAttention = eventObservations.some((observation) => observation.kind === "gap" || spineObservationMissingDetail(observation));
      return {
        id: `CP-${eventDate}-${domain}-${documentIndex + 1}-${groupIndex + 1}`,
        date: eventDate,
        domain,
        label: focus,
        summary,
        status: needsAttention ? "attention" : "candidate",
        detail_meta: [],
        detail_sections: spineObservationSections(eventObservations),
        anatomy_zone_ids: spineCandidateAnatomyZoneIds(documentItem, eventObservations, focus),
        source_note: "Повний документ і точні фрагменти зберігаються у приватному джерельному шарі.",
        review_state: allHumanVerified ? "verified" : "candidate",
        source_pages: sourcePages,
        _sourceDocumentIds: [documentItem.id],
        _observationIds: eventObservations.map((observation) => observation.id),
        _candidateProjection: true,
      };
    });
  });
}

function spineMergeMeta(primary = [], secondary = []) {
  const seenLabels = new Set();
  return [...primary, ...secondary].filter((item) => {
    if (!item?.label || !item?.value || seenLabels.has(item.label)) return false;
    seenLabels.add(item.label);
    return true;
  });
}

function spineMergeSections(primary = [], secondary = []) {
  const merged = [];
  [...primary, ...secondary].forEach((sectionItem) => {
    if (!sectionItem?.title || !Array.isArray(sectionItem.items)) return;
    const existing = merged.find((item) => item.title === sectionItem.title && item.tone === sectionItem.tone);
    if (!existing) {
      merged.push({ ...sectionItem, items: [...new Map(sectionItem.items.filter(Boolean).map((item) => [item.observationId || JSON.stringify(item), item])).values()] });
      return;
    }
    existing.items = [...new Map([...existing.items, ...sectionItem.items].filter(Boolean).map((item) => [item.observationId || JSON.stringify(item), item])).values()];
  });
  return merged;
}

function spinePrepareEvents(bundle) {
  const canonicalEvents = (bundle.timeline || []).map((event) => ({ ...event }));
  const candidateEvents = spineCandidateEvents(bundle);
  const candidatesByLaneDate = new Map();
  candidateEvents.forEach((candidate) => {
    const key = `${candidate.date}|${spineGroup(candidate)}`;
    if (!candidatesByLaneDate.has(key)) candidatesByLaneDate.set(key, []);
    candidatesByLaneDate.get(key).push(candidate);
  });
  candidatesByLaneDate.forEach((candidates, key) => {
    const existing = canonicalEvents.find((event) => `${event.date}|${spineGroup(event)}` === key);
    let matched = null;
    if (existing && candidates.length === 1) matched = candidates[0];
    if (existing && candidates.length > 1) {
      const existingZones = new Set(spineInferEventAnatomy(existing, []).map((zone) => zone.id));
      matched = candidates
        .map((candidate) => ({
          candidate,
          score: (candidate.anatomy_zone_ids || []).filter((id) => existingZones.has(id)).length,
        }))
        .sort((a, b) => b.score - a.score)[0];
      matched = matched?.score > 0 ? matched.candidate : null;
    }
    if (existing && matched) {
      existing.detail_meta = spineMergeMeta(existing.detail_meta, matched.detail_meta);
      existing.detail_sections = spineMergeSections(existing.detail_sections, matched.detail_sections);
      existing.source_note = [...new Set([existing.source_note, matched.source_note].filter(Boolean))].join(" ");
      const existingZoneIds = spineInferEventAnatomy(existing, []).map((zone) => zone.id);
      existing.anatomy_zone_ids = [...new Set([...existingZoneIds, ...(matched.anatomy_zone_ids || [])])];
      existing._sourceDocumentIds = [...new Set([...(existing._sourceDocumentIds || []), ...(matched._sourceDocumentIds || [])])];
      existing._observationIds = [...new Set([...(existing._observationIds || []), ...(matched._observationIds || [])])];
      existing.source_pages = [...new Set([...(existing.source_pages || []), ...(matched.source_pages || [])])].sort((a, b) => Number(a) - Number(b));
      existing.review_state = existing.review_state === "verified" && matched.review_state === "verified" ? "verified" : "candidate";
      existing._candidateProjection = true;
    }
    candidates.filter((candidate) => candidate !== matched).forEach((candidate) => canonicalEvents.push(candidate));
  });
  return canonicalEvents
    .map((event, index) => ({ ...event, index, time: spineParseTime(event.date) }))
    .filter((event) => event.time !== null)
    .sort((a, b) => a.time - b.time || a.index - b.index);
}

function spineBounds(events) {
  const rawMin = events[0].time;
  const rawMax = events.at(-1).time;
  const padding = Math.max(8 * SPINE_DAY, (rawMax - rawMin) * 0.035);
  const min = rawMin - padding;
  const max = rawMax + padding;
  return { min, max, span: Math.max(SPINE_DAY, max - min) };
}

function spinePosition(time, bounds, start = 110, end = 992) {
  return start + ((time - bounds.min) / bounds.span) * (end - start);
}

function spineSelectedEvent(events, time, preferredEventId = null) {
  const preferred = preferredEventId ? events.find((event) => event.id === preferredEventId) : null;
  if (preferred && preferred.time === time) return preferred;
  return [...events].reverse().find((event) => event.time <= time) || events[0];
}

function spineLatest(items, time) {
  return (items || [])
    .map((item) => ({ ...item, _time: spineParseTime(item.date || item.observed_at) }))
    .filter((item) => item._time !== null && item._time <= time)
    .sort((a, b) => a._time - b._time)
    .at(-1) || null;
}

function spineGroup(event) {
  return SPINE_GROUPS.find((group) => group.match.includes(String(event.domain || "").toLowerCase()))?.id || "clinical";
}

function spineMonths(bounds) {
  const dates = [];
  const cursor = new Date(bounds.min);
  cursor.setUTCDate(1);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor.getTime() < bounds.max && dates.length < 48) {
    dates.push(cursor.getTime());
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const step = dates.length > 18 ? 3 : dates.length > 11 ? 2 : 1;
  return dates.filter((_, index) => index % step === 0);
}

function spineMonthLabel(time) {
  return new Intl.DateTimeFormat("uk-UA", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(time));
}

function spineStatus(event) {
  const labels = {
    attention: "потребує уваги",
    critical: "критична подія",
    watch: "під спостереженням",
    "leading-provisional": "робоча гіпотеза",
    "must-not-miss": "критичний диференціал",
    must_not_miss: "критичний диференціал",
  };
  return labels[event?.flag] || timelineDomainLabel(event?.domain);
}

function spineSetScrubbing(target, active) {
  document.documentElement.classList.toggle("clinical-spine-scrubbing", active);
  target?.classList.toggle("is-scrubbing", active);
}

const SPINE_ANATOMY_ZONES = [
  { id: "tonsil", label: "Мигдалик", x: 294, y: 92, lx: 106, ly: 82, pattern: /мигдал|tonsil/iu },
  { id: "neck", label: "Шия", x: 320, y: 136, lx: 510, ly: 126, pattern: /ши(?:я|ї)(?:\s|$)|ший(?:н|ов)|потилич|надключич|cervical\s+(?:lymph|node)|neck/iu },
  { id: "breast", label: "Молочні залози", x: 320, y: 184, lx: 106, ly: 180, pattern: /молочн.{0,18}залоз|мамограф|breast/iu },
  { id: "axillary", label: "Пахвові вузли", x: 400, y: 205, lx: 510, ly: 198, pattern: /пахвов|пахвах|аксил|axill/iu },
  { id: "spleen", label: "Селезінка", x: 270, y: 278, lx: 106, ly: 270, pattern: /селез|spleen|splenic/iu },
  { id: "stomach", label: "Шлунок", x: 330, y: 270, lx: 510, ly: 265, pattern: /шлунк|гастроскоп|антрум|gastr/iu },
  { id: "abdominal", label: "Черевні вузли", x: 335, y: 314, lx: 510, ly: 306, pattern: /епігастр|черев|abdom/iu },
  { id: "pelvis", label: "Органи малого таза", x: 320, y: 350, lx: 510, ly: 346, pattern: /яєчник|матк|ендометр|ендоцерв|гінеколог|трансвагін|малого таза|кольпоскоп/iu },
  { id: "iliac", label: "Клубові вузли", x: 270, y: 378, lx: 106, ly: 371, pattern: /клуб|iliac/iu },
  { id: "inguinal", label: "Пахвинні вузли", x: 350, y: 408, lx: 510, ly: 414, pattern: /пахвин|пахов|inguin/iu },
];

function spineTextValues(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(spineTextValues);
  if (typeof value === "object") return Object.values(value).flatMap(spineTextValues);
  return [String(value)];
}

function spineCandidateAnatomyZoneIds(documentItem, observations, focus) {
  const type = String(documentItem?.document_type || "").toLowerCase();
  if (type === "laboratory" || type === "other") return [];
  const allowedKinds = {
    consultation: ["imaging_finding", "procedure"],
    imaging: ["imaging_finding", "negative_finding", "procedure"],
    pathology: ["pathology_finding", "procedure", "diagnostic_interpretation"],
    procedure: ["procedure", "imaging_finding"],
    hospital_record: ["procedure", "imaging_finding", "pathology_finding"],
  }[type] || [];
  const values = [focus];
  observations
    .filter((observation) => allowedKinds.includes(observation.kind))
    .forEach((observation) => values.push(observation.display, observation.value_text));
  if (type === "imaging") values.push(documentItem.summary);
  const text = spineTextValues(values).join(" ");
  return SPINE_ANATOMY_ZONES.filter((zone) => zone.pattern.test(text)).map((zone) => zone.id);
}

function spineInferEventAnatomy(event, imaging) {
  const domain = String(event?.domain || "").toLowerCase();
  if (!["imaging", "clinical", "hx", "path", "pathology", "marrow"].includes(domain)) return [];
  const eventDate = spineRawDate(event?.date);
  const sameDateImaging = domain === "imaging"
    ? (imaging || []).filter((item) => spineRawDate(item.date) === eventDate)
    : [];
  // Anamnesis summaries may mention a later site (for example, “згодом ...”).
  // On a dated state, project only the location named in the event label.
  const values = ["clinical", "hx"].includes(domain)
    ? [event?.label]
    : [event?.label, event?.summary, event?.detail_meta, event?.detail_sections, sameDateImaging];
  const text = spineTextValues(values).join(" ");
  return SPINE_ANATOMY_ZONES.filter((zone) => zone.pattern.test(text));
}

function spineEventAnatomy(event, imaging) {
  if (Object.prototype.hasOwnProperty.call(event || {}, "anatomy_zone_ids")) {
    const ids = new Set(event.anatomy_zone_ids || []);
    return SPINE_ANATOMY_ZONES.filter((zone) => ids.has(zone.id));
  }
  return spineInferEventAnatomy(event, imaging);
}

function spineAnatomy(zones) {
  const root = svgElement("svg", {
    className: `clinical-spine-anatomy${zones.length ? "" : " is-context-only"}`,
    attrs: {
      viewBox: "0 0 620 700",
      role: "img",
      "aria-label": zones.length
        ? "Анатомічна локалізація, прямо записана для обраної події"
        : "Контекстна анатомічна схема без локалізації для обраної події",
    },
  });
  root.append(svgElement("image", {
    className: "clinical-spine-anatomy-image",
    attrs: { href: SPINE_ANATOMY_IMAGE, x: 170, y: 20, width: 280, height: 646, preserveAspectRatio: "xMidYMid meet", "data-source-page": SPINE_ANATOMY_SOURCE },
  }));
  zones.forEach((zone) => {
    const right = zone.lx > zone.x;
    root.append(svgElement("g", {
      className: "clinical-spine-site is-active",
    }, [
      svgElement("line", { className: "clinical-spine-site-line", attrs: { x1: zone.x, y1: zone.y, x2: right ? zone.lx - 8 : zone.lx + 8, y2: zone.ly } }),
      svgElement("circle", { attrs: { cx: zone.x, cy: zone.y, r: 10 } }),
      svgElement("text", { attrs: { x: zone.lx, y: zone.ly + 4, "text-anchor": right ? "start" : "end" }, text: zone.label }),
    ]));
  });
  return root;
}

function spineDetailRecord(item, options = {}) {
  const record = typeof item === "string"
    ? (() => {
      const [label, ...details] = item.split(" · ").filter(Boolean);
      return { label, note: details.join(" · ") };
    })()
    : item;
  const auditRecord = options.audit !== false;
  const values = [
    record?.value ? element("span", { className: "clinical-spine-detail-value", text: record.value }) : null,
    record?.reference ? element("span", { text: record.reference }) : null,
    record?.interpretation ? element("span", { className: record.attention ? "is-attention" : "", text: record.interpretation }) : null,
  ].filter(Boolean);
  const attrs = {};
  if (auditRecord && record?.observationId) {
    attrs["data-observation-id"] = record.observationId;
    attrs["data-source-document-id"] = record.documentId;
    attrs["data-effective-at"] = record.effectiveAt;
    attrs["data-page"] = record.page;
    attrs["data-human-verified"] = String(record.humanVerified === true);
  }
  const sourceReceipt = record?.observationId && options.showSource !== false
    ? element("small", {
      className: "clinical-spine-source-receipt",
      text: `Джерело · сторінка ${record.page || "не вказана"} · ${record.humanVerified ? "звірено лікарем" : "очікує звірки лікарем"}`,
    })
    : null;
  return element("li", {
    className: [
      "clinical-spine-detail-record",
      record?.attention ? "is-attention" : "",
      record?.missingDetail ? "is-missing-detail" : "",
    ].filter(Boolean).join(" "),
    attrs,
  }, [
    element("strong", { text: record?.label || "Спостереження" }),
    values.length ? element("div", { className: "clinical-spine-detail-values" }, values) : null,
    record?.note ? element("p", { text: record.note }) : null,
    sourceReceipt,
  ]);
}

function spineDetailGrid(sections, options = {}) {
  return element("div", { className: "clinical-spine-detail-grid" }, sections.map((sectionItem) => (
    element("section", {
      className: "clinical-spine-detail-card",
      attrs: { "data-tone": sectionItem.tone || "context" },
    }, [
      element("h4", { text: sectionItem.title }),
      element("ul", {}, sectionItem.items.map((item) => spineDetailRecord(item, options))),
    ])
  )));
}

function spineKeySections(sections, limit = 6) {
  const ranked = sections
    .flatMap((sectionItem) => sectionItem.items.map((item) => ({ sectionItem, item })))
    .sort((a, b) => (b.item?.priority || 0) - (a.item?.priority || 0))
    .slice(0, limit);
  const selected = new Set(ranked.map(({ item }) => item?.observationId || item));
  return sections
    .map((sectionItem) => ({
      ...sectionItem,
      items: sectionItem.items.filter((item) => selected.has(item?.observationId || item)),
    }))
    .filter((sectionItem) => sectionItem.items.length);
}

function observationReviewUrl(observationId, documentId) {
  const params = new URLSearchParams({
    case: state.caseKey,
    ui: document.documentElement.dataset.ui || "carbon",
    mode: "recognition",
    filter: "all",
  });
  if (observationId) params.set("observation", observationId);
  if (documentId) params.set("document", documentId);
  return `/clinician/?${params}`;
}

function reviewableObservationId(observationIds = []) {
  return observationIds.find((id) => state.reviewableObservationIds.has(id)) || null;
}

function spineEventProvenance(event) {
  const observationCount = event?._observationIds?.length || 0;
  if (!observationCount) return null;
  const documentCount = event?._sourceDocumentIds?.length || 1;
  const pages = event?.source_pages?.length ? ` · с. ${event.source_pages.join(", ")}` : "";
  const verified = event?.review_state === "verified";
  const children = [
    element("div", { className: "clinical-spine-provenance-facts" }, [
      element("span", { text: `${observationCount} ${observationCount === 1 ? "спостереження" : "спостережень"}` }),
      element("span", { text: `${documentCount} ${documentCount === 1 ? "документ" : "документи"}${pages}` }),
      element("span", {
        className: verified ? "is-verified" : "is-candidate",
        text: verified ? "Звірено лікарем" : "Очікує звірки лікарем",
      }),
    ]),
  ];
  const reviewObservationId = reviewableObservationId(event?._observationIds);
  if (!IS_PUBLIC_STATIC_DEMO && reviewObservationId) {
    children.push(element("a", {
      className: "clinical-spine-review-link focus-ring",
      text: "Звірити з PDF →",
      attrs: { href: observationReviewUrl(reviewObservationId, event?._sourceDocumentIds?.[0]) },
    }));
  }
  return element("div", { className: "clinical-spine-provenance" }, children);
}

function spineEventBrief(event) {
  const headings = {
    hx: "Клінічні відомості",
    clinical: "Клінічні відомості",
    imaging: "Результат дослідження",
    path: "Матеріал і результат",
    pathology: "Матеріал і результат",
    lab: "Результати аналізу",
    marker: "Результати аналізу",
    consult: "Висновок консультації",
  };
  const parts = (meaningfulText(event?.summary) || "Окремий опис події у пакеті не записано.")
    .split(/;\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
  return element("section", { className: "clinical-spine-event-brief" }, [
    element("h4", { text: headings[String(event?.domain || "").toLowerCase()] || "Відомості події" }),
    element("ul", {}, parts.map((part) => element("li", { text: part }))),
  ]);
}

function spineEventReadout(event) {
  const eventTitle = event?.label || "Подія без назви";
  const title = element("h3", { className: eventTitle.length > 55 ? "is-long" : "", text: eventTitle });
  const summary = element("p", {
    className: "clinical-spine-event-summary",
    text: meaningfulText(event?.summary) || "Окремий опис події у пакеті не записано.",
  });
  const nodes = [title];
  const provenance = spineEventProvenance(event);
  if (provenance) nodes.push(provenance);
  const sections = Array.isArray(event?.detail_sections)
    ? event.detail_sections.filter((sectionItem) => sectionItem?.title && Array.isArray(sectionItem.items) && sectionItem.items.length)
    : [];
  nodes.push(sections.length ? summary : spineEventBrief(event));
  if (sections.length) {
    const recordCount = sections.reduce((total, sectionItem) => total + sectionItem.items.length, 0);
    if (recordCount > 8) {
      nodes.push(element("p", { className: "clinical-spine-section-label", text: "Ключові дані" }));
      nodes.push(spineDetailGrid(spineKeySections(sections), { audit: false, showSource: false }));
      nodes.push(element("details", { className: "clinical-spine-all-data" }, [
        element("summary", { text: `Усі дані події (${recordCount})` }),
        spineDetailGrid(sections),
      ]));
    } else {
      nodes.push(spineDetailGrid(sections));
    }
  }
  return nodes;
}

function spineUndatedDocuments(bundle) {
  const documents = Array.isArray(bundle?.source_documents) ? bundle.source_documents : [];
  const observations = Array.isArray(bundle?.observations) ? bundle.observations : [];
  return documents
    .filter((documentItem) => !documentItem.document_date)
    .map((documentItem) => {
      const documentObservations = spineDocumentObservations(documentItem, observations);
      const focus = spineDocumentFocus(documentItem, documentObservations);
      const pages = [...new Set(documentObservations.map((observation) => observation.page || observation.source_address?.page).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
      return {
        id: documentItem.id,
        label: focus,
        summary: documentItem.summary || spineObservationGroupSummary(documentObservations),
        detail_sections: spineObservationSections(documentObservations),
        source_pages: pages,
        review_state: documentObservations.length && documentObservations.every((observation) => observation?.verification?.human_verified === true) ? "verified" : "candidate",
        _sourceDocumentIds: [documentItem.id],
        _observationIds: documentObservations.map((observation) => observation.id),
      };
    })
    .filter((documentItem) => documentItem._observationIds.length);
}

function spineUndatedPanel(bundle) {
  const documents = spineUndatedDocuments(bundle);
  if (!documents.length) return null;
  return element("details", {
    className: "clinical-spine-undated",
    attrs: { "data-undated-count": documents.length },
  }, [
    element("summary", {}, [
      element("span", {}, [
        element("strong", { text: "Документи без підтвердженої дати" }),
        element("small", { text: "Не розміщені на часовій шкалі, доки дата не буде звірена." }),
      ]),
      element("b", { text: documents.length }),
    ]),
    element("div", { className: "clinical-spine-undated-list" }, documents.map((documentItem) => (
      element("details", {
        className: "clinical-spine-undated-item",
        attrs: { "data-source-document-id": documentItem.id },
      }, [
        element("summary", {}, [
          element("span", {}, [
            element("strong", { text: documentItem.label }),
            element("small", { text: `${documentItem._observationIds.length} структурованих спостережень` }),
          ]),
          element("i", { text: "+" }),
        ]),
        element("div", { className: "clinical-spine-undated-body" }, [
          element("p", { text: documentItem.summary }),
          spineEventProvenance(documentItem),
          spineDetailGrid(documentItem.detail_sections),
        ]),
      ])
    ))),
  ]);
}

function spinePlayheadPath(x) {
  return `M ${x - 7} 16 H ${x + 7} L ${x} 27 Z`;
}

function spineBuildTrack(events, bounds, onPreview, onCommit) {
  const groups = SPINE_GROUPS.filter((group) => events.some((event) => spineGroup(event) === group.id));
  const rowHeight = 29;
  const height = 34 + Math.max(1, groups.length) * rowHeight;
  const layoutStart = 8;
  let layoutWidth = 1000;
  let layoutEnd = 992;
  let activeTime = events.at(-1).time;
  let activeEventId = null;
  const position = (time) => spinePosition(time, bounds, layoutStart, layoutEnd);
  const laneVisualPositions = (laneEvents) => {
    const ordered = [...laneEvents].sort((a, b) => a.time - b.time || a.index - b.index);
    const minimumGap = 30;
    const points = ordered.map((event) => ({ event, x: position(event.time) }));
    for (let index = 1; index < points.length; index += 1) {
      points[index].x = Math.max(points[index].x, points[index - 1].x + minimumGap);
    }
    if (points.at(-1)?.x > layoutEnd) {
      points.at(-1).x = layoutEnd;
      for (let index = points.length - 2; index >= 0; index -= 1) {
        points[index].x = Math.min(points[index].x, points[index + 1].x - minimumGap);
      }
    }
    if (points[0]?.x < layoutStart) {
      const shift = layoutStart - points[0].x;
      points.forEach((point) => { point.x += shift; });
    }
    return new Map(points.map((point) => [point.event.id, point.x]));
  };
  const root = svgElement("svg", {
    className: "clinical-spine-track",
    attrs: {
      viewBox: `0 0 ${layoutWidth} ${height}`,
      preserveAspectRatio: "xMinYMid meet",
      role: "group",
      "aria-label": "Клінічні події на спільній часовій осі. Жовтий курсор можна перетягувати.",
    },
  });
  const monthNodes = [];
  spineMonths(bounds).forEach((time) => {
    const x = position(time);
    const tick = svgElement("line", { className: "clinical-spine-month-tick", attrs: { x1: x, y1: 19, x2: x, y2: height } });
    const label = svgElement("text", { className: "clinical-spine-month-label", attrs: { x, y: 12, "text-anchor": "middle" }, text: spineMonthLabel(time) });
    monthNodes.push({ time, tick, label });
    root.append(tick, label);
  });
  const nodes = new Map();
  const rowNodes = [];
  const clipNodes = [];
  groups.forEach((group, rowIndex) => {
    const y = 34 + rowIndex * rowHeight;
    const band = svgElement("rect", { className: rowIndex % 2 ? "clinical-spine-track-band is-alt" : "clinical-spine-track-band", attrs: { x: 0, y: y - 11, width: layoutWidth, height: 25 } });
    const line = svgElement("line", { className: "clinical-spine-track-line", attrs: { x1: layoutStart, y1: y + 12, x2: layoutEnd, y2: y + 12 } });
    rowNodes.push({ band, line });
    root.append(band, line);
    const laneEvents = events.filter((event) => spineGroup(event) === group.id);
    const visualPositions = laneVisualPositions(laneEvents);
    laneEvents.forEach((event) => {
      const x = visualPositions.get(event.id) ?? position(event.time);
      const anchor = x > layoutStart + (layoutEnd - layoutStart) * 0.78 ? "end" : "start";
      const hitRect = svgElement("rect", { className: "clinical-spine-clip-hit", attrs: { x: x - 13, y: y - 12, width: 26, height: 26, rx: 6 } });
      const rect = svgElement("rect", { className: "clinical-spine-clip-mark", attrs: { x: x - 6, y: y - 7, width: 12, height: 15, rx: 0 } });
      const clipLabel = svgElement("text", { className: "clinical-spine-clip-label", attrs: { x: anchor === "end" ? x - 13 : x + 13, y: y + 3, "text-anchor": anchor }, text: wordClip(event.label || "Подія", 25) });
      const clipNode = svgElement("g", {
        className: ["clinical-spine-clip", event.flag ? `is-${event.flag}` : ""].filter(Boolean).join(" "),
        attrs: { tabindex: "0", role: "button", "aria-label": `${spineRawDate(event.date)} — ${event.label || "подія"}`, "data-event-id": event.id },
      }, [hitRect, rect, clipLabel]);
      const activate = () => onCommit(event.time, event.id);
      clipNode.addEventListener("click", activate);
      clipNode.addEventListener("keydown", (eventKey) => {
        if (!["Enter", " "].includes(eventKey.key)) return;
        eventKey.preventDefault();
        activate();
      });
      nodes.set(event.id, clipNode);
      clipNodes.push({ event, groupId: group.id, hitRect, rect, label: clipLabel });
      root.append(clipNode);
    });
  });
  const playhead = svgElement("line", { className: "clinical-spine-playhead-line", attrs: { y1: 18, y2: height } });
  const playheadHead = svgElement("path", { className: "clinical-spine-playhead-head" });
  root.append(playhead, playheadHead);

  let activePointer = null;
  let pendingTime = events.at(-1).time;
  const timeFromPointer = (pointerEvent) => {
    const matrix = root.getScreenCTM();
    if (!matrix) return pendingTime;
    const screenPoint = root.createSVGPoint();
    screenPoint.x = pointerEvent.clientX;
    screenPoint.y = pointerEvent.clientY;
    const point = screenPoint.matrixTransform(matrix.inverse());
    return bounds.min + spineClamp((point.x - layoutStart) / (layoutEnd - layoutStart), 0, 1) * bounds.span;
  };
  const preview = (pointerEvent) => {
    pendingTime = timeFromPointer(pointerEvent);
    onPreview(pendingTime);
  };
  root.addEventListener("pointerdown", (pointerEvent) => {
    if (pointerEvent.button !== 0 || pointerEvent.target.closest?.(".clinical-spine-clip")) return;
    pointerEvent.preventDefault();
    activePointer = pointerEvent.pointerId;
    spineSetScrubbing(root, true);
    root.setPointerCapture(activePointer);
    preview(pointerEvent);
  });
  root.addEventListener("pointermove", (pointerEvent) => {
    if (pointerEvent.pointerId !== activePointer) return;
    pointerEvent.preventDefault();
    preview(pointerEvent);
  });
  const commit = (pointerEvent) => {
    if (pointerEvent.pointerId !== activePointer) return;
    pointerEvent.preventDefault();
    preview(pointerEvent);
    if (root.hasPointerCapture(activePointer)) root.releasePointerCapture(activePointer);
    activePointer = null;
    spineSetScrubbing(root, false);
    onCommit(pendingTime);
  };
  root.addEventListener("pointerup", commit);
  root.addEventListener("pointercancel", commit);
  root.addEventListener("lostpointercapture", () => {
    if (activePointer === null) return;
    activePointer = null;
    spineSetScrubbing(root, false);
  });

  return {
    node: root,
    height,
    update(time, preferredEventId = null) {
      activeTime = time;
      activeEventId = preferredEventId;
      const x = position(time);
      playhead.setAttribute("x1", x);
      playhead.setAttribute("x2", x);
      playheadHead.setAttribute("d", spinePlayheadPath(x));
      const selected = spineSelectedEvent(events, time, preferredEventId)?.id;
      nodes.forEach((node, id) => node.classList.toggle("is-selected", id === selected));
    },
    resize() {
      const box = root.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const nextWidth = Math.max(760, (box.width * height) / box.height);
      if (Math.abs(nextWidth - layoutWidth) < 0.5) return;
      layoutWidth = nextWidth;
      layoutEnd = layoutWidth - 8;
      root.setAttribute("viewBox", `0 0 ${layoutWidth} ${height}`);
      monthNodes.forEach(({ time, tick, label }) => {
        const x = position(time);
        tick.setAttribute("x1", x);
        tick.setAttribute("x2", x);
        label.setAttribute("x", x);
      });
      rowNodes.forEach(({ band, line }) => {
        band.setAttribute("width", layoutWidth);
        line.setAttribute("x1", layoutStart);
        line.setAttribute("x2", layoutEnd);
      });
      const visualPositions = new Map();
      groups.forEach((group) => {
        const laneEvents = events.filter((event) => spineGroup(event) === group.id);
        laneVisualPositions(laneEvents).forEach((x, id) => visualPositions.set(id, x));
      });
      clipNodes.forEach(({ event, hitRect, rect, label }) => {
        const x = visualPositions.get(event.id) ?? position(event.time);
        const alignEnd = x > layoutStart + (layoutEnd - layoutStart) * 0.78;
        hitRect.setAttribute("x", x - 13);
        rect.setAttribute("x", x - 6);
        label.setAttribute("x", alignEnd ? x - 13 : x + 13);
        label.setAttribute("text-anchor", alignEnd ? "end" : "start");
      });
      this.update(activeTime, activeEventId);
    },
    lanes: groups.map((group, rowIndex) => ({
      ...group,
      count: events.filter((event) => spineGroup(event) === group.id).length,
      top: 23 + rowIndex * rowHeight,
    })),
    screenX(time) {
      const matrix = root.getScreenCTM();
      if (!matrix) return null;
      const point = root.createSVGPoint();
      point.x = position(time);
      point.y = 18;
      return point.matrixTransform(matrix).x;
    },
    destroy() {
      activePointer = null;
      spineSetScrubbing(root, false);
    },
  };
}

function renderTimeline() {
  const events = spinePrepareEvents(state.bundle);
  if (!events.length) {
    const empty = section("Час", "Перебіг у документах");
    empty.append(emptyState("У bundle немає нормалізованих подій."));
    return empty;
  }

  const bounds = spineBounds(events);
  const clinical = state.bundle.clinical_state || {};
  let currentTime = spineClamp(timelineCursorByCase.get(state.caseKey) ?? events.at(-1).time, bounds.min, bounds.max);
  let selectedEventId = timelineEventByCase.get(state.caseKey) || null;
  if (!events.some((event) => event.id === selectedEventId && event.time === currentTime)) {
    selectedEventId = spineSelectedEvent(events, currentTime)?.id || null;
  }
  let zoomPercent = spineClamp(timelineZoomByCase.get(state.caseKey) ?? 100, 100, 400);
  let renderFrame = null;
  let labelLayoutFrame = null;
  let labelLayoutTime = currentTime;
  let timelineCanvas = null;
  let timelineScroll = null;
  let timelineResizeObserver = null;

  const root = element("section", { className: "clinical-spine-workspace", attrs: { "aria-labelledby": "clinical-spine-title" } });
  root.append(element("h2", { className: "sr-only", text: "Історія хвороби", attrs: { id: "clinical-spine-title" } }));
  const anatomy = element("div", { className: "clinical-spine-visual" });
  const timeReadout = element("div", { className: "clinical-spine-time" });
  const eventReadout = element("article", { className: "clinical-spine-event" });
  const eventScrollRange = element("input", {
    className: "clinical-spine-event-scroll-range",
    attrs: {
      type: "range",
      min: "0",
      max: "1",
      step: "1",
      value: "0",
      "aria-label": "Прокручування повного запису",
      hidden: "",
    },
  });
  const eventShell = element("div", { className: "clinical-spine-event-shell" }, [eventReadout, eventScrollRange]);
  const monitor = element("div", { className: "clinical-spine-monitor" }, [
    anatomy,
    element("div", { className: "clinical-spine-readout" }, [timeReadout, eventShell]),
  ]);

  const transportStatus = element("span", { className: "clinical-spine-transport-status" });
  const floatingLabel = element("output", {
    className: "clinical-spine-floating-label",
    attrs: { "aria-live": "polite", "aria-atomic": "true" },
  });
  const range = element("input", {
    className: "clinical-spine-range",
    attrs: { type: "range", min: "0", max: "1000", step: "1", "aria-label": "Часовий курсор перебігу хвороби" },
  });
  const rangeDate = element("output", { className: "clinical-spine-range-date" });
  const zoom = element("input", {
    className: "clinical-spine-zoom-range",
    attrs: { type: "range", min: "100", max: "400", step: "10", value: zoomPercent, "aria-label": "Масштаб часової шкали" },
  });
  const zoomValue = element("output", { className: "clinical-spine-zoom-value", text: `${zoomPercent}%` });
  const zoomControl = element("label", { className: "clinical-spine-zoom-control" }, [
    element("span", { text: "Масштаб часу" }),
    zoom,
    zoomValue,
  ]);
  const timelineHead = element("div", { className: "clinical-spine-timeline-head" }, [transportStatus, zoomControl]);

  function scheduleFloatingLabel(time) {
    labelLayoutTime = time;
    if (labelLayoutFrame) return;
    labelLayoutFrame = requestAnimationFrame(() => {
      labelLayoutFrame = null;
      if (!timelineCanvas) return;
      const screenX = track.screenX(labelLayoutTime);
      if (!Number.isFinite(screenX)) return;
      const canvasBox = timelineCanvas.getBoundingClientRect();
      const localX = spineClamp(screenX - canvasBox.left, 0, canvasBox.width);
      const ratio = canvasBox.width ? localX / canvasBox.width : 0.5;
      floatingLabel.style.setProperty("--spine-label-x", `${Math.round(localX * 10) / 10}px`);
      floatingLabel.dataset.align = ratio < 0.22 ? "start" : ratio > 0.78 ? "end" : "center";
    });
  }

  function updateControls(time) {
    const normalized = spineClamp(time, bounds.min, bounds.max);
    const active = spineSelectedEvent(events, normalized, selectedEventId);
    const rangeProgress = ((normalized - bounds.min) / bounds.span) * 100;
    range.value = String(Math.round(rangeProgress * 10));
    range.style.setProperty("--range-progress", `${rangeProgress}%`);
    range.setAttribute("aria-valuetext", spineCursorDate(normalized, events));
    rangeDate.textContent = spineCursorDate(normalized, events, "short");
    transportStatus.textContent = spineCursorDate(normalized, events);
    scheduleFloatingLabel(normalized);
    floatingLabel.textContent = wordClip(active?.label || "Подія без назви", 46);
    floatingLabel.title = active?.label || "Подія без назви";
    track.update(normalized, active?.id || null);
  }

  function syncEventScrollControl() {
    const maxScroll = Math.max(0, eventReadout.scrollHeight - eventReadout.clientHeight);
    const isDetailed = eventReadout.classList.contains("has-details");
    eventScrollRange.hidden = !isDetailed || maxScroll < 2;
    eventScrollRange.max = String(Math.max(1, Math.ceil(maxScroll)));
    eventScrollRange.value = String(Math.min(maxScroll, Math.round(eventReadout.scrollTop)));
    const percent = maxScroll ? Math.round((eventReadout.scrollTop / maxScroll) * 100) : 0;
    eventScrollRange.setAttribute("aria-valuetext", `${percent}% запису`);
  }

  function renderState(time) {
    const active = spineSelectedEvent(events, time, selectedEventId);
    const hasDetails = Array.isArray(active?.detail_sections) && active.detail_sections.length > 0;
    const anatomyZones = spineEventAnatomy(active, clinical.imaging);
    const hasAnatomy = anatomyZones.length > 0;
    monitor.classList.toggle("has-anatomy", hasAnatomy);
    anatomy.classList.toggle("has-event-anatomy", hasAnatomy);
    anatomy.replaceChildren(spineAnatomy(anatomyZones));
    timeReadout.replaceChildren(
      element("time", { text: spineCursorDate(time, events), attrs: { datetime: spineCursorDateTime(time, events) } }),
      element("span", {
        text: spineStatus(active) === timelineDomainLabel(active?.domain)
          ? timelineDomainLabel(active?.domain)
          : `${timelineDomainLabel(active?.domain)} · ${spineStatus(active)}`,
      }),
    );
    eventReadout.classList.toggle("has-details", hasDetails);
    eventShell.classList.toggle("has-details", hasDetails);
    eventReadout.dataset.eventId = active?.id || "";
    eventReadout.dataset.eventDate = active?.date || "";
    eventReadout.replaceChildren(...spineEventReadout(active));
    eventReadout.scrollTop = 0;
    requestAnimationFrame(syncEventScrollControl);
  }

  function requestSeek(time, immediate = false, eventId = null) {
    currentTime = spineClamp(time, bounds.min, bounds.max);
    const preferred = eventId ? events.find((event) => event.id === eventId && event.time === currentTime) : null;
    selectedEventId = preferred?.id || spineSelectedEvent(events, currentTime)?.id || null;
    if (preferred) timelineEventByCase.set(state.caseKey, selectedEventId);
    else timelineEventByCase.delete(state.caseKey);
    timelineCursorByCase.set(state.caseKey, currentTime);
    updateControls(currentTime);
    if (immediate) {
      if (renderFrame) cancelAnimationFrame(renderFrame);
      renderFrame = null;
      renderState(currentTime);
      return;
    }
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      renderState(currentTime);
    });
  }

  const track = spineBuildTrack(
    events,
    bounds,
    (time) => requestSeek(time),
    (time, eventId) => requestSeek(time, true, eventId),
  );
  timelineCanvas = element("div", { className: "clinical-spine-timeline-canvas" }, [floatingLabel, track.node]);
  timelineScroll = element("div", { className: "clinical-spine-timeline-scroll" }, [
    timelineCanvas,
  ]);
  const laneRail = element("div", { className: "clinical-spine-lane-rail", attrs: { "aria-label": "Категорії клінічних подій" } });
  track.lanes.forEach((lane) => {
    const item = element("div", {
      className: "clinical-spine-lane",
      attrs: { title: lane.description, "aria-label": `${lane.label}: ${lane.count}. ${lane.description}` },
    }, [
      element("span", { text: lane.label }),
      element("strong", { text: lane.count }),
    ]);
    item.style.top = `${32 + lane.top}px`;
    laneRail.append(item);
  });
  const timelineStage = element("div", { className: "clinical-spine-timeline-stage" }, [laneRail, timelineScroll]);
  timelineStage.style.setProperty("--spine-track-height", `${track.height}px`);
  timelineStage.style.setProperty("--spine-stage-height", `${track.height + 40}px`);
  const scrubber = element("div", { className: "clinical-spine-scrubber" }, [
    element("span", { text: "Часовий курсор" }),
    range,
    rangeDate,
  ]);
  const transport = element("div", { className: "clinical-spine-transport" }, [timelineHead, timelineStage, scrubber]);
  root.append(monitor, transport);
  const undatedPanel = spineUndatedPanel(state.bundle);
  if (undatedPanel) root.append(undatedPanel);
  if ("ResizeObserver" in window) {
    timelineResizeObserver = new ResizeObserver(() => {
      track.resize();
      scheduleFloatingLabel(currentTime);
    });
    timelineResizeObserver.observe(timelineCanvas);
  }

  function applyZoom(value, centerCursor = true) {
    zoomPercent = spineClamp(Number(value), 100, 400);
    timelineZoomByCase.set(state.caseKey, zoomPercent);
    zoom.value = String(zoomPercent);
    zoom.style.setProperty("--range-progress", `${((zoomPercent - 100) / 300) * 100}%`);
    zoomValue.textContent = `${zoomPercent}%`;
    zoom.setAttribute("aria-valuetext", `${zoomPercent}%`);
    timelineCanvas.style.width = `${zoomPercent}%`;
    requestAnimationFrame(() => {
      track.resize();
      if (!centerCursor) {
        scheduleFloatingLabel(currentTime);
        return;
      }
      const viewport = timelineScroll.getBoundingClientRect();
      const cursorX = track.screenX(currentTime);
      if (Number.isFinite(cursorX)) timelineScroll.scrollLeft += cursorX - viewport.left - viewport.width / 2;
      scheduleFloatingLabel(currentTime);
    });
  }

  applyZoom(zoomPercent, true);
  zoom.addEventListener("input", () => applyZoom(zoom.value));
  eventReadout.addEventListener("scroll", syncEventScrollControl, { passive: true });
  eventScrollRange.addEventListener("input", () => {
    eventReadout.scrollTop = Number(eventScrollRange.value);
  });
  eventScrollRange.addEventListener("pointerdown", () => {
    spineSetScrubbing(eventScrollRange, true);
    const stop = () => spineSetScrubbing(eventScrollRange, false);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  });
  range.addEventListener("input", () => requestSeek(bounds.min + (Number(range.value) / 1000) * bounds.span));
  range.addEventListener("change", () => requestSeek(bounds.min + (Number(range.value) / 1000) * bounds.span, true));
  range.addEventListener("pointerdown", () => {
    spineSetScrubbing(range, true);
    const stop = () => spineSetScrubbing(range, false);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  });

  updateControls(currentTime);
  renderState(currentTime);
  activeViewCleanup = () => {
    if (renderFrame) cancelAnimationFrame(renderFrame);
    if (labelLayoutFrame) cancelAnimationFrame(labelLayoutFrame);
    timelineResizeObserver?.disconnect();
    track.destroy();
    spineSetScrubbing(range, false);
    spineSetScrubbing(eventScrollRange, false);
  };
  return root;
}

function renderConsilium() {
  const fragment = document.createDocumentFragment();
  fragment.append(
    viewHeader(
      "Консиліум гіпотез",
      "Робочі гіпотези, аргументи за і проти та критерії верифікації.",
    ),
  );
  const question = section("", "Клінічне питання");
  question.append(consiliumQuestionFragments(state.bundle.methodology.question));
  question.append(element("a", { className: "overview-text-link focus-ring consilium-plan-link", text: "План перевірок →", attrs: { href: viewUrl("state") } }));
  fragment.append(question);

  const positions = section("", "Робочі гіпотези");
  const list = element("div", { className: "hypothesis-list" });
  [...state.bundle.hypotheses]
    .sort((a, b) => a.rank - b.rank)
    .forEach((hypothesis) => {
      const article = element("details", {
        className: "hypothesis",
        attrs: {
          "data-tone": hypothesisTone(hypothesis.status, hypothesis.rank),
          ...(hypothesis.rank === 1 ? { open: "" } : {}),
        },
      });
      const head = element("div", { className: "hypothesis-head" });
      head.append(
        element("span", { className: "rank", text: `#${hypothesis.rank}` }),
        element("div", {}, [
          element("h3", { text: hypothesis.label }),
          element("p", { text: hypothesis.stance || "Позицію не описано." }),
        ]),
        statusTag(hypothesisStatus(hypothesis.status), hypothesis.rank <= 2 ? "evidence" : ""),
      );
      const summary = element("summary", { className: "hypothesis-summary" }, [
        head,
        element("span", { className: "hypothesis-toggle", attrs: { "aria-hidden": "true" } }),
      ]);
      article.append(summary);

      if (hypothesis.data_refs.length) {
        const row = element("div", { className: "chip-row", attrs: { "aria-label": "Дані пацієнта" } });
        hypothesis.data_refs.forEach((ref) => row.append(dataChip(ref)));
        article.append(element("p", { className: "chip-label", text: "Дані пацієнта" }), row);
      }
      if (hypothesis.evidence_refs.length) {
        const row = element("div", { className: "chip-row", attrs: { "aria-label": "Докази" } });
        hypothesis.evidence_refs.forEach((ref) => row.append(evidenceChip(ref)));
        article.append(element("p", { className: "chip-label", text: "Докази" }), row);
      }
      if (hypothesis.confirms)
        article.append(
          element("p", { className: "cr confirm" }, [
            element("b", { text: "✓ Підтверджує: " }),
            element("span", { text: hypothesis.confirms }),
          ]),
        );
      if (hypothesis.refutes)
        article.append(
          element("p", { className: "cr refute" }, [
            element("b", { text: "✗ Спростувало б: " }),
            element("span", { text: hypothesis.refutes }),
          ]),
        );

      const challengeEntries = Object.entries(hypothesis.challenge || {}).filter(([, value]) => value);
      if (challengeEntries.length) {
        const details = element("details", { className: "challenge" });
        details.append(element("summary", { text: "Раунд заперечень" }));
        const labels = { proponent: "Позиція", opponent: "Заперечення", resolver: "Що розв’язує" };
        const grid = element("div", { className: "challenge-grid" });
        challengeEntries.forEach(([key, value]) => {
          grid.append(element("div", {}, [element("h4", { text: labels[key] || key }), element("p", { text: value })]));
        });
        details.append(grid);
        article.append(details);
      }
      list.append(article);
    });
  positions.append(list);
  fragment.append(positions);
  return fragment;
}


function renderConclusionStructureMap({ lead, facts, sourceClaims, fallbackSources, interpretation }) {
  const sources = sourceClaims.length ? sourceClaims : fallbackSources;
  const root = element("section", { className: "conclusion-map", attrs: { "aria-label": "Послідовність формування робочого висновку" } });
  const head = element("div", { className: "conclusion-map-head" });
  head.append(
    element("div", {}, [
      element("p", { className: "section-kicker", text: "Шлях до робочого висновку" }),
      element("h3", { text: "Як система пояснює поточний напрям" }),
    ]),
    element("p", { className: "conclusion-map-intro", text: "Оберіть етап або переміщуйте повзунок. Деталі з’являються праворуч: від даних цього кейсу й настанов до пояснення та робочої гіпотези." }),
  );

  const canvas = element("div", { className: "conclusion-map-canvas", attrs: { "aria-label": "Дані з кейсу та висновки настанов і статей формують пояснення для цього кейсу, з якого виходить робоча гіпотеза" } });
  const paths = svgElement("svg", { className: "conclusion-map-paths", attrs: { viewBox: "0 0 1000 340", preserveAspectRatio: "none", "aria-hidden": "true" } });
  [
    "M 238 88 C 370 88, 405 150, 495 170",
    "M 238 252 C 370 252, 405 190, 495 170",
    "M 625 170 C 710 170, 748 170, 818 170",
  ].forEach((d) => paths.append(svgElement("path", { attrs: { d } })));
  canvas.append(paths);

  const territories = [
    ["facts", "01", "Дані з кейсу", "Що зафіксовано в медичних матеріалах"],
    ["sources", "02", "Настанови й статті", "Що про це кажуть зовнішні джерела"],
    ["interpretation", "03", "Інтерпретація", "Що це означає саме для цього кейсу"],
    ["hypothesis", "04", "Робоча гіпотеза", "Який напрям перевіряємо далі"],
  ];
  const territoryButtons = [];
  territories.forEach(([id, number, title, meta]) => {
    const button = element("button", {
      className: `conclusion-territory ${id} focus-ring`,
      attrs: { type: "button", "data-stage": id, "aria-current": "false" },
    }, [
      element("span", { className: "conclusion-territory-number", text: number }),
      element("span", { className: "conclusion-territory-copy" }, [
        element("strong", { text: title }),
        element("small", { text: meta }),
      ]),
    ]);
    canvas.append(button);
    territoryButtons.push(button);
  });

  const rail = element("div", { className: "conclusion-map-rail" });
  const stageOutput = element("p", { className: "conclusion-map-stage", attrs: { "aria-live": "polite" } });
  const range = element("input", {
    className: "conclusion-map-range focus-ring",
    attrs: { type: "range", min: "0", max: "4", value: "0", step: "1", "aria-label": "Етап формування робочого висновку" },
  });
  const ticks = element("div", { className: "conclusion-map-ticks", attrs: { "aria-hidden": "true" } });
  ["Огляд", "Дані кейсу", "Настанови й статті", "Пояснення", "Гіпотеза"].forEach((label, index) => ticks.append(element("span", { text: `${String(index).padStart(2, "0")} · ${label}` })));
  rail.append(stageOutput, range, ticks);

  const focus = element("article", { className: "conclusion-map-focus", attrs: { "aria-live": "polite" } });
  const mapColumn = element("div", { className: "conclusion-map-controls" });
  mapColumn.append(canvas, rail);
  const workspace = element("div", { className: "conclusion-map-workspace" });
  workspace.append(mapColumn, focus);
  root.append(head, workspace);

  const stageDefinitions = [
    {
      key: "overview",
      label: "00 · Огляд шляху",
      title: "Чотири кроки до робочого висновку",
      copy: "Система спочатку відокремлює дані, записані в цьому кейсі, від загальних висновків настанов і статей. Далі вона пояснює, як ці два шари стосуються саме цього кейсу, і формує робочу гіпотезу для наступної перевірки.",
      build: (body) => {
        const list = element("dl", { className: "conclusion-map-summary" });
        [
          ["Дані кейсу", facts.length ? `${facts.length} записів із пакета` : "не виділено"],
          ["Настанови й статті", sources.length ? `${sources.length} пов’язаних висновків` : "не пов’язано"],
          ["Пояснення для кейсу", interpretation ? "сформовано окремо" : "ще не сформовано"],
          ["Робоча гіпотеза", `напрям #${lead.rank}`],
        ].forEach(([term, value]) => {
          const row = element("div", {});
          row.append(element("dt", { text: term }), element("dd", { text: value }));
          list.append(row);
        });
        body.append(list);
      },
    },
    {
      key: "facts",
      label: "01 · Дані з кейсу",
      title: "Що записано в медичних матеріалах",
      copy: "Це знеособлені результати досліджень, описи матеріалів і події перебігу. Кожен запис походить із пакета цього кейсу. Дані описують клінічну картину та ще не є діагностичним висновком.",
      build: (body) => {
        const list = element("div", { className: "conclusion-map-detail-list" });
        if (!facts.length) list.append(emptyState("Для цієї гіпотези не відібрано пов’язаних даних із кейсу."));
        facts.slice(0, 4).forEach((fact) => list.append(element("article", { className: "conclusion-map-detail" }, [element("span", { text: fact.id }), element("strong", { text: fact.label }), element("p", { text: fact.detail })])));
        if (facts.length > 4) list.append(element("p", { className: "conclusion-map-more", text: `Ще ${facts.length - 4} записів із кейсу — у детальному реєстрі нижче.` }));
        body.append(list);
      },
    },
    {
      key: "sources",
      label: "02 · Настанови й статті",
      title: "Що з цього приводу кажуть зовнішні джерела",
      copy: "Тут зібрані висновки з клінічних настанов і наукових статей: аргументи за і проти та критерії діагностичної верифікації. Джерело задає загальне правило; застосування до цього кейсу показано на наступному етапі.",
      build: (body) => {
        const list = element("div", { className: "conclusion-map-detail-list" });
        if (!sources.length) list.append(emptyState("Для цієї гіпотези не вказано пов’язаних висновків із настанов або статей."));
        sources.slice(0, 3).forEach((source) => {
          const card = element("article", { className: "conclusion-map-detail" });
          const text = source.text || source.citation || source.ref || "Висновок із зовнішнього джерела";
          card.append(element("strong", { text }));
          if (source.source_refs?.length) {
            const refs = element("div", { className: "provenance-source-row" });
            source.source_refs.forEach((id) => refs.append(evidenceChip(id)));
            card.append(refs);
          } else if (source.id) card.append(evidenceChip(source.id));
          list.append(card);
        });
        if (sources.length > 3) list.append(element("p", { className: "conclusion-map-more", text: `Ще ${sources.length - 3} висновків із джерел — у детальному реєстрі нижче.` }));
        body.append(list);
      },
    },
    {
      key: "interpretation",
      label: "03 · Пояснення для цього кейсу",
      title: interpretation ? "Що означає це поєднання саме тут" : "Інтерпретацію ще потрібно сформувати",
      copy: interpretation?.text || "У пакеті немає окремої інтерпретації, яка пов’язує факти конкретного кейсу з положеннями зовнішніх джерел. Такий висновок не можна підміняти самими посиланнями.",
      build: (body) => {
        if (interpretation?.limitations) body.append(element("p", { className: "conclusion-map-boundary", text: `Межа висновку: ${interpretation.limitations}` }));
      },
    },
    {
      key: "hypothesis",
      label: "04 · Робоча гіпотеза",
      title: lead.label,
      copy: lead.stance || "Поточне обґрунтування не внесено до пакета.",
      build: (body) => {
        const checks = element("div", { className: "conclusion-map-checks" });
        checks.append(
          element("div", {}, [element("span", { text: "Зміцнить напрям" }), element("p", { text: lead.confirms || "Критерій не записано." })]),
          element("div", {}, [element("span", { text: "Змусить переглянути" }), element("p", { text: lead.refutes || "Критерій не записано." })]),
        );
        body.append(checks);
      },
    },
  ];

  function setStage(index) {
    const stage = stageDefinitions[index];
    root.dataset.stage = stage.key;
    range.value = String(index);
    stageOutput.textContent = stage.label;
    territoryButtons.forEach((button) => button.setAttribute("aria-current", String(button.dataset.stage === stage.key)));
    focus.replaceChildren(
      element("p", { className: "conclusion-map-focus-label", text: stage.label }),
      element("h4", { text: stage.title }),
      element("p", { className: "conclusion-map-focus-copy", text: stage.copy }),
    );
    stage.build(focus);
  }

  range.addEventListener("input", () => setStage(Number(range.value)));
  territoryButtons.forEach((button) => button.addEventListener("click", () => setStage(stageDefinitions.findIndex((stage) => stage.key === button.dataset.stage))));
  setStage(0);
  return root;
}

function renderProvenance() {
  const bundle = state.bundle;
  const lead = bundle.hypotheses.find((hypothesis) => hypothesis.primary) || [...bundle.hypotheses].sort((a, b) => a.rank - b.rank)[0];
  const leadClaimRefs = lead?.claim_refs || [];
  const interpretation = leadClaimRefs.map((id) => claimById(id)).find((claim) => claim?.kind === "case_interpretation");
  const facts = (interpretation?.fact_refs?.length ? interpretation.fact_refs : lead?.data_refs || [])
    .map((id) => factById(id))
    .filter(Boolean);
  const sourceClaims = (interpretation?.claim_refs?.length ? interpretation.claim_refs : leadClaimRefs)
    .map((id) => claimById(id))
    .filter((claim) => claim && ["external_evidence", "source_interpretation"].includes(claim.kind));
  const fallbackSources = (lead?.evidence_refs || []).map((id) => sourceById(id)).filter(Boolean);

  const fragment = document.createDocumentFragment();
  fragment.append(
    viewHeader(
      "Структура робочого висновку",
      "Ця сторінка показує шлях від даних, записаних у медичних матеріалах, до робочої гіпотези. Вона окремо показує, що відомо про кейс, що кажуть настанови й статті, як це пояснено для цього кейсу та що ще потрібно перевірити.",
    ),
  );

  const map = section(
    "Перевірювані деталі",
    lead ? `Повний ланцюг для напряму #${lead.rank}` : "Провідну гіпотезу не сформовано",
    "Для перевірки або друку тут розкладено чотири частини: дані з кейсу, настанови й статті, пояснення для цього кейсу та робоча гіпотеза.",
  );
  if (!lead) {
    map.append(emptyState("У пакеті немає ранжованої гіпотези, для якої можна побудувати карту походження."));
    fragment.append(map);
    return fragment;
  }

  fragment.append(renderConclusionStructureMap({ lead, facts, sourceClaims, fallbackSources, interpretation }));

  const diagram = element("div", { className: "provenance-diagram" });
  const inputs = element("section", { className: "provenance-inputs", attrs: { "aria-label": "Вхідні шари" } });
  const factsColumn = element("div", { className: "provenance-column provenance-facts" });
  factsColumn.append(element("p", { className: "provenance-step", text: "1 · Дані з кейсу" }));
  factsColumn.append(element("p", { className: "provenance-subcopy", text: "Знеособлені результати досліджень, описи матеріалів і події перебігу, записані в пакеті цього кейсу." }));
  const factsList = element("div", { className: "provenance-card-list" });
  if (facts.length) {
    facts.forEach((fact) => {
      const card = element("article", { className: "provenance-card" });
      card.append(element("span", { className: "provenance-id", text: fact.id }), element("strong", { text: fact.label }), element("p", { text: fact.detail }));
      factsList.append(card);
    });
  } else {
    factsList.append(emptyState("У цьому пакеті немає окремо пов’язаних даних для провідної гіпотези."));
  }
  factsColumn.append(factsList);

  const sourcesColumn = element("div", { className: "provenance-column provenance-sources" });
  sourcesColumn.append(element("p", { className: "provenance-step", text: "2 · Настанови й статті" }));
  sourcesColumn.append(element("p", { className: "provenance-subcopy", text: "Висновки з настанов і наукових статей: загальні правила, з якими система зіставляє дані кейсу." }));
  const sourcesList = element("div", { className: "provenance-card-list" });
  if (sourceClaims.length) {
    sourceClaims.forEach((claim) => {
      const card = element("article", { className: "provenance-card" });
      const [label, tone] = claimLayer(claim);
      card.append(statusTag(label, tone), element("p", { text: claim.text }));
      if (claim.source_refs?.length) {
        const refs = element("div", { className: "provenance-source-row" });
        claim.source_refs.forEach((id) => refs.append(evidenceChip(id)));
        card.append(refs);
      }
      sourcesList.append(card);
    });
  } else if (fallbackSources.length) {
    fallbackSources.forEach((source) => {
      const card = element("article", { className: "provenance-card" });
      card.append(element("strong", { text: source.ref }), element("p", { text: source.citation }), evidenceChip(source.id));
      sourcesList.append(card);
    });
  } else {
    sourcesList.append(emptyState("Для цієї позиції не вказано простежуваних джерел."));
  }
  sourcesColumn.append(sourcesList);
  inputs.append(factsColumn, sourcesColumn);

  const interpretationColumn = element("section", { className: "provenance-interpretation", attrs: { "aria-label": "Пояснення для цього кейсу" } });
  interpretationColumn.append(element("p", { className: "provenance-step", text: "3 · Пояснення для цього кейсу" }));
  if (interpretation) {
    interpretationColumn.append(
      element("h4", { text: "Що означає поєднання цих даних саме для цього кейсу" }),
      element("p", { className: "provenance-interpretation-copy", text: interpretation.text }),
      element("p", { className: "provenance-limit", text: `Межа: ${interpretation.limitations}` }),
    );
  } else {
    interpretationColumn.append(
      element("h4", { text: "Потрібна окрема інтерпретація про кейс" }),
      element("p", { className: "provenance-interpretation-copy", text: "У цьому пакеті поки немає окремого пояснення, яке прямо пов’язує дані кейсу з висновками настанов і статей. Доступні матеріали збережено для перевірки, а робочий висновок про конкретний кейс ще не сформовано." }),
    );
  }

  const hypothesisColumn = element("section", { className: "provenance-hypothesis", attrs: { "aria-label": "Провідна робоча гіпотеза" } });
  hypothesisColumn.append(
    statusTag("Найбільш імовірна", "critical"),
    element("p", { className: "provenance-step", text: `4 · Робоча гіпотеза #${lead.rank}` }),
    element("h4", { text: lead.label }),
    element("p", { text: lead.stance }),
  );
  const joinFlow = element("div", { className: "provenance-flow", attrs: { "aria-hidden": "true" } });
  joinFlow.append(element("span", { text: "зіставлення" }), element("strong", { text: "→" }));
  const rankFlow = element("div", { className: "provenance-flow", attrs: { "aria-hidden": "true" } });
  rankFlow.append(element("span", { text: "ранжування" }), element("strong", { text: "→" }));
  diagram.append(inputs, joinFlow, interpretationColumn, rankFlow, hypothesisColumn);
  const auditDisclosure = element("details", { className: "provenance-audit-disclosure" });
  auditDisclosure.append(element("summary", { text: "Відкрити повний структурований реєстр" }), diagram);
  map.append(auditDisclosure);
  fragment.append(map);

  const boundary = section("Перевірка висновку", "Що зміцнить або перегляне цей напрям");
  const ledger = element("div", { className: "provenance-ledger" });
  [
    ["Що підтвердить напрям", lead.confirms || "Критерій підтвердження не записано."],
    ["Що змусить переглянути напрям", lead.refutes || "Критерій перегляду не записано."],
    ["Джерела та повний ланцюг", "Відкрийте вкладку «Джерела», щоб звірити статус кожного положення, точне посилання та його межу застосування."],
  ].forEach(([title, copy], index) => {
    const item = element("article", { className: "provenance-ledger-item" });
    item.append(element("span", { className: "provenance-ledger-number", text: String(index + 1).padStart(2, "0") }), element("h4", { text: title }), element("p", { text: copy }));
    if (index === 2) item.append(element("a", { className: "overview-text-link focus-ring", text: "Відкрити джерела →", attrs: { href: viewUrl("evidence") } }));
    ledger.append(item);
  });
  boundary.append(ledger);
  fragment.append(boundary);
  return fragment;
}

function sourceRegistryKind(source) {
  if (["case", "patient", "local"].includes(source?.type)) return "primary";
  if (["guideline", "pmid", "gap"].includes(source?.type)) return source.type;
  return "other";
}

function sourceRegistryType(source) {
  const labels = {
    primary: "Первинне",
    guideline: "Настанова",
    pmid: "PubMed",
    gap: "Прогалина",
    other: "Інше",
  };
  return labels[sourceRegistryKind(source)] || sourceTypeLabel(source);
}

function sourceRegistryStatus(source) {
  const claim = (source.supports || []).map((id) => claimById(id)).find(Boolean);
  const level = claim?.verification?.level;
  if (level && LABELS.verification[level]) {
    const [label, tone] = verificationLabel(level);
    return statusTag(label, tone);
  }
  const status = String(source.status || "").toLowerCase();
  if (source.type === "gap" || /gap|unverified/.test(status)) return statusTag("потребує джерела", "critical");
  if (/reviewed_for_deidentification/.test(status)) return statusTag("знеособлення звірено", "evidence");
  if (/source_verified/.test(status)) return statusTag("джерело звірено", "evidence");
  if (/traced/.test(status)) return statusTag("простежено", "evidence");
  if (/context_only/.test(status)) return statusTag("лише контекст", "candidate");
  if (/candidate/.test(status)) return statusTag("кандидат на перевірку", "candidate");
  if (/local_source/.test(status)) return statusTag("локальне джерело", "");
  return statusTag("статус не уточнено", "candidate");
}

function sourceRegistryId(source) {
  return String(source?.id || "—").replace(/^SRC-T\d+-/u, "SRC-LOCAL-");
}

function sourceRegistry() {
  const sources = state.bundle.sources || [];
  const registry = section(
    "Каталог",
    `Реєстр джерел · ${sources.length}`,
    "Фільтр змінює лише видимий тип джерел. Ідентифікатор, статус, повне цитування та кількість пов’язаних тверджень залишаються в одному рядку.",
  );
  registry.classList.add("source-registry-section");

  const filters = [
    ["all", "Усі"],
    ["primary", "Первинні"],
    ["guideline", "Настанови"],
    ["pmid", "PubMed"],
    ["gap", "Прогалини"],
  ];
  const counts = new Map(filters.map(([key]) => [key, key === "all" ? sources.length : sources.filter((source) => sourceRegistryKind(source) === key).length]));
  const toolbar = element("div", { className: "source-registry-toolbar", attrs: { role: "toolbar", "aria-label": "Фільтр джерел за типом" } });
  filters.forEach(([key, label], index) => toolbar.append(element("button", {
    className: "source-filter-button focus-ring",
    text: `${label} · ${counts.get(key)}`,
    attrs: { type: "button", "data-source-filter": key, "aria-pressed": index === 0 ? "true" : "false" },
  })));
  const resultCount = element("span", {
    className: "source-registry-count",
    text: `Показано ${sources.length} із ${sources.length}`,
    attrs: { "aria-live": "polite" },
  });
  toolbar.append(resultCount);
  registry.append(toolbar);

  const rows = sources.map((source) => {
    const citation = source.type === "guideline" ? guidelineCitation(source) : displayText(source.citation || source.ref || "Цитування не записано.");
    const displayId = sourceRegistryId(source);
    const idControl = source.source_uri?.startsWith("http")
      ? element("a", { className: "source-registry-id focus-ring", text: displayId, attrs: { href: source.source_uri, target: "_blank", rel: "noopener" } })
      : element("strong", { className: "source-registry-id", text: displayId });
    return {
      attrs: {
        id: `source-${source.id}`,
        "data-source-row": "",
        "data-source-kind": sourceRegistryKind(source),
      },
      cells: [
        idControl,
        sourceRegistryType(source),
        sourceRegistryStatus(source),
        element("p", { className: "source-registry-citation", text: citation }),
        element("span", {
          className: "source-support-count",
          text: String((source.supports || []).length || "—"),
          attrs: { title: `${(source.supports || []).length} пов’язаних тверджень` },
        }),
      ],
    };
  });
  const registryTable = table(["ID", "Тип", "Статус", "Цитування", "Підтримує"], rows, "source-registry-table");
  registry.append(registryTable);

  const applyFilter = (selected) => {
    let visible = 0;
    registryTable.querySelectorAll("[data-source-row]").forEach((row) => {
      row.hidden = selected !== "all" && row.dataset.sourceKind !== selected;
      if (!row.hidden) visible += 1;
    });
    toolbar.querySelectorAll("[data-source-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.sourceFilter === selected));
    });
    resultCount.textContent = `Показано ${visible} із ${sources.length}`;
  };
  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-source-filter]");
    if (button) applyFilter(button.dataset.sourceFilter);
  });
  return registry;
}

function renderEvidence() {
  const fragment = document.createDocumentFragment();
  fragment.append(
    viewHeader(
      "Джерела",
      "Каталог публікацій, настанов і первинних документів, на яких ґрунтуються гіпотези. Клінічні прогалини та повний реєстр спостережень доступні в розділі «Повні дані».",
    ),
  );
  fragment.append(sourceRegistry());

  const claims = state.bundle.claims || [];
  if (claims.length) {
    const chain = element("details", { className: "content-section source-chain-disclosure" });
    chain.append(element("summary", { className: "source-chain-summary" }, [
      element("div", {}, [
        element("h3", { text: "Як джерела переходять у робочу гіпотезу" }),
        element("p", { text: `${claims.length} перевірюваних тверджень · відкрийте для повного ланцюга` }),
      ]),
      element("span", { className: "source-disclosure-toggle", attrs: { "aria-hidden": "true" } }),
    ]));
    const list = element("div", { className: "source-list" });
    claims.forEach((claim, index) => {
      const item = element("details", {
        className: "source-item source-claim",
        attrs: claim.kind === "case_interpretation" || (index === 0 && !claims.some((candidate) => candidate.kind === "case_interpretation")) ? { open: "" } : {},
      });
      const [layerLabel, layerTone] = claimLayer(claim);
      const level = claim.verification?.level || "candidate";
      const [levelLabel, levelTone] = verificationLabel(level);
      item.append(element("summary", { className: "source-claim-summary" }, [
        element("span", { className: "source-claim-state" }, [statusTag(layerLabel, layerTone), statusTag(levelLabel, levelTone)]),
        element("h4", { className: "src-head", text: claim.text }),
        element("span", { className: "source-disclosure-toggle", attrs: { "aria-hidden": "true" } }),
      ]));
      const itemBody = element("div", { className: "source-item-body" });
      const refs = element("div", { className: "src-linked" });
      if (claim.fact_refs?.length) {
        refs.append(element("span", { className: "src-linked-label", text: "Дані кейсу" }));
        claim.fact_refs.forEach((id) => refs.append(dataChip(id)));
      }
      if (claim.source_refs?.length) {
        refs.append(element("span", { className: "src-linked-label", text: "Настанови й статті" }));
        claim.source_refs.forEach((id) => refs.append(evidenceChip(id)));
      }
      if (claim.claim_refs?.length) {
        refs.append(element("span", { className: "src-linked-label", text: "Висновки джерел" }));
        claim.claim_refs.forEach((id) => {
          const linked = claimById(id);
          if (linked) refs.append(element("span", { className: "chip", text: linked.text }));
        });
      }
      if (claim.hypothesis_refs?.length) {
        refs.append(element("span", { className: "src-linked-label", text: "Гіпотези" }));
        claim.hypothesis_refs.forEach((id) => {
          const hypothesis = hypothesisById(id);
          if (hypothesis) refs.append(element("span", { className: "chip", text: `#${hypothesis.rank} ${hypothesis.label}` }));
        });
      }
      if (refs.childNodes.length) itemBody.append(refs);
      itemBody.append(element("p", { className: "src-cite", text: `Межа: ${claim.limitations}` }));
      item.append(itemBody);
      list.append(item);
    });
    chain.append(list);
    fragment.append(chain);
  }
  return fragment;
}

function stateDataChip(label, value = "", tone = "") {
  return element("span", {
    className: "state-data-chip",
    text: value ? `${label}: ${textValue(value)}` : label,
    attrs: tone ? { "data-tone": tone } : {},
  });
}

function stateDetailGrid(items) {
  const grid = element("dl", { className: "state-detail-grid" });
  items.filter(([, value]) => value !== undefined && value !== null && value !== "").forEach(([label, value, tone = ""]) => {
    const field = element("div", { attrs: tone ? { "data-tone": tone } : {} });
    field.append(element("dt", { text: label }), element("dd", { text: textValue(value) }));
    grid.append(field);
  });
  return grid;
}

function stateNarrative(text) {
  const paragraph = element("p", { className: "state-narrative" });
  paragraph.innerHTML = highlightMarkers(text || "Деталі не записані.");
  return paragraph;
}

function imagingTone(item) {
  return /(?:прогрес|↑↑|NodeRADS\s*[45])/iu.test([
    item?.trend,
    item?.impression,
    item?.noderads,
  ].filter(Boolean).join(" ")) ? "critical" : "candidate";
}

function imagingSourceFindings(item) {
  if (!item.sourceObservations?.length) {
    return element("p", {
      className: "imaging-source-empty",
      text: "Окремі джерельні знахідки для цього дослідження не структуровано.",
    });
  }
  const list = element("ul", { className: "imaging-source-findings" });
  item.sourceObservations.forEach((observation) => {
    const value = observationValue(observation);
    const interpretation = observationInterpretation(observation);
    list.append(element("li", {}, [
      element("div", { className: "imaging-finding-main" }, [
        element("strong", { text: localizedObservationDisplay(observation.display) }),
        value !== "—" ? element("p", { text: value }) : null,
      ]),
      element("div", { className: "imaging-finding-meta" }, [
        interpretation ? element("span", { text: interpretation }) : null,
        observation.page ? element("span", { text: `стор. ${observation.page}` }) : null,
      ]),
    ]));
  });
  return list;
}

function imagingSourceStatus(item) {
  const status = item.sourceVerification;
  if (!status) return stateDataChip("Джерельні поля", "не структуровано");
  return status.complete
    ? stateDataChip("Звірено лікарем", `${status.verified} із ${status.total}`, "evidence")
    : stateDataChip("Потребує звірки", `${status.total - status.verified} із ${status.total}`, "candidate");
}

const OBSERVATION_GROUPS = [
  { id: "tissue", label: "Тканини та ІГХ", documentTypes: ["pathology"], fallbackKinds: ["pathology_finding"] },
  { id: "imaging", label: "Візуалізація та поширеність", documentTypes: ["imaging"], fallbackKinds: ["imaging_finding"] },
  { id: "laboratory", label: "Аналізи та маркери", documentTypes: ["laboratory"], fallbackKinds: ["measurement", "negative_finding"] },
  { id: "consultation", label: "Консультації та висновки", documentTypes: ["consultation"], fallbackKinds: ["clinical_note", "recommendation", "diagnostic_interpretation"] },
  { id: "course", label: "Перебіг і процедури", documentTypes: ["procedure", "hospital_record", "other"], fallbackKinds: ["procedure"] },
];

const OBSERVATION_KIND_LABELS = {
  clinical_note: "Клінічний запис",
  measurement: "Показник",
  imaging_finding: "Знахідка візуалізації",
  pathology_finding: "Тканинна знахідка",
  diagnostic_interpretation: "Висновок документа",
  procedure: "Процедура",
  recommendation: "Рекомендація",
  negative_finding: "Негативна знахідка",
  gap: "Неповні або ненадійні дані",
};

function observationGroup(observation, documentItem) {
  return OBSERVATION_GROUPS.find((group) => group.documentTypes.includes(documentItem?.document_type))
    || OBSERVATION_GROUPS.find((group) => group.fallbackKinds.includes(observation.kind))
    || OBSERVATION_GROUPS.at(-1);
}

function observationValue(observation) {
  if (observation.value_number !== null && observation.value_number !== undefined) {
    return `${observation.value_number}${observation.unit ? ` ${observation.unit}` : ""}`;
  }
  return observation.value_text || "—";
}

function observationNeedsAttention(observation) {
  if (observation.kind === "gap") return true;
  const text = [observation.display, observation.value_text, observation.interpretation, observation.assertion_status]
    .filter(Boolean)
    .join(" ");
  return /підвищ|знижен|вище|нижче|підозр|атип|прогрес|нерепрезент|ненадійн|нечитабель|потребує|не підтвердж|розбіж|поза референс/iu.test(text);
}

function observationInterpretation(observation) {
  const labels = {
    candidate_source_interpretation: "попередній висновок документа",
    candidate_source_recommendation: "рекомендація документа",
    review_required: "потребує перевірки джерела",
    source_reported: "зафіксовано в документі",
    source_reported_suspicious: "підозріла знахідка за документом",
    above_reported_reference: "вище наведеного референсу",
    below_reported_reference: "нижче наведеного референсу",
    recorded: "зафіксовано в документі",
    candidate_source_fragment: "структуровано з документа",
  };
  const value = observation.interpretation || observation.assertion_status || "";
  return labels[value] || value;
}

function observationSourceLabel(documentItem) {
  if (!documentItem) return "джерельний документ";
  const type = enumLabel(documentItem.document_type || "other");
  const date = spineRawDate(documentItem.document_date || "дата не записана");
  return `${type} · ${date}`;
}

function observationSourceCell(observation, documentItem) {
  const source = element("div", { className: "observation-source-address" }, [
    element("span", { className: "observation-source-page", text: `Сторінка ${observation.page || "не вказана"}` }),
    element("span", { className: "observation-source-document", text: observationSourceLabel(documentItem) }),
  ]);
  if (!IS_PUBLIC_STATIC_DEMO && state.reviewableObservationIds.has(observation.id)) {
    source.append(element("a", {
      className: "observation-source-review-link focus-ring",
      text: "Звірити з PDF →",
      attrs: { href: observationReviewUrl(observation.id, documentItem?.id) },
    }));
  }
  return source;
}

function observationContext(observations, documents) {
  const documentsById = new Map(documents.map((item) => [item.id, item]));
  const records = observations.map((observation) => {
    const documentItem = documentsById.get(observation.document_id);
    const group = observationGroup(observation, documentItem);
    return {
      observation,
      documentItem,
      group,
      attention: observationNeedsAttention(observation),
    };
  });
  const grouped = OBSERVATION_GROUPS.map((group) => {
    const groupRecords = records.filter((record) => record.group.id === group.id);
    const documentIds = new Set(groupRecords.map((record) => record.documentItem?.id).filter(Boolean));
    return {
      ...group,
      records: groupRecords,
      documentCount: documentIds.size,
      attentionCount: groupRecords.filter((record) => record.attention).length,
    };
  }).filter((group) => group.records.length);

  return { records, grouped };
}

function localizedObservationDisplay(value) {
  const display = String(value || "Клінічне спостереження").trim();
  return display
    .replace(/^Source-reported\s+/iu, "Зафіксовано у джерелі: ")
    .replace(/^source_reported\s+/iu, "Зафіксовано у джерелі: ");
}

function observationRegistry(context) {
  const disclosure = element("details", { className: "observation-registry" });
  disclosure.append(element("summary", { className: "observation-registry-summary" }, [
    element("div", {}, [
      element("strong", { text: `Повний реєстр · ${context.records.length} записів` }),
      element("span", { text: "Пошук, фільтри та адреса кожного джерела" }),
    ]),
    element("span", { className: "source-disclosure-toggle", attrs: { "aria-hidden": "true" } }),
  ]));

  const body = element("div", { className: "observation-registry-body" });
  const searchId = `observation-search-${state.caseKey}`;
  const filterId = `observation-filter-${state.caseKey}`;
  const search = element("input", {
    className: "observation-search",
    attrs: { id: searchId, type: "search", placeholder: "Наприклад: Ki-67, селезінка, 2026-06", autocomplete: "off" },
  });
  const filter = element("select", { className: "observation-filter", attrs: { id: filterId } }, [
    element("option", { text: "Усі тематичні блоки", attrs: { value: "all" } }),
    element("option", { text: "Лише записи, що потребують уваги", attrs: { value: "attention" } }),
    ...context.grouped.map((group) => element("option", { text: group.label, attrs: { value: group.id } })),
  ]);
  const resultCount = element("span", { className: "observation-result-count", text: `Показано ${context.records.length} із ${context.records.length}`, attrs: { "aria-live": "polite" } });
  body.append(element("div", { className: "observation-registry-controls" }, [
    element("label", { className: "observation-control" }, [element("span", { text: "Пошук у реєстрі" }), search]),
    element("label", { className: "observation-control" }, [element("span", { text: "Відбір даних" }), filter]),
    resultCount,
  ]));

  const rows = context.records
    .sort((a, b) => String(a.observation.effective_at || a.documentItem?.document_date || "9999-99-99")
      .localeCompare(String(b.observation.effective_at || b.documentItem?.document_date || "9999-99-99")))
    .map((record) => {
      const { observation, documentItem, group, attention } = record;
      const searchText = [group.label, observation.display, observationValue(observation), observationInterpretation(observation), observation.effective_at, observationSourceLabel(documentItem)]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("uk-UA");
      return {
        attrs: {
          "data-observation-row": "",
          "data-observation-id": observation.id,
          "data-group": group.id,
          "data-attention": String(attention),
          "data-search": searchText,
          ...(attention ? { "data-tone": "critical" } : {}),
        },
        cells: [
          spineRawDate(observation.effective_at || documentItem?.document_date || "дата не записана"),
          stateDataChip(group.label, "", attention ? "critical" : "evidence"),
          element("div", { className: "observation-registry-finding" }, [
            element("strong", { text: observation.display || "Клінічне спостереження" }),
            element("span", { text: OBSERVATION_KIND_LABELS[observation.kind] || enumLabel(observation.kind) }),
          ]),
          element("div", { className: "observation-registry-value" }, [
            element("strong", { text: observationValue(observation) }),
            observation.reference_range ? element("span", { text: `Референс: ${observation.reference_range}` }) : null,
          ]),
          observationInterpretation(observation) || "—",
          observationSourceCell(observation, documentItem),
        ],
      };
    });
  const registryTable = table(["Дата", "Тематичний блок", "Спостереження", "Значення", "Інтерпретація", "Джерело"], rows, "observation-registry-table");
  body.append(registryTable);

  const applyFilters = () => {
    const query = search.value.trim().toLocaleLowerCase("uk-UA");
    const selected = filter.value;
    let visible = 0;
    registryTable.querySelectorAll("[data-observation-row]").forEach((row) => {
      const matchesText = !query || row.dataset.search.includes(query);
      const matchesGroup = selected === "all"
        || (selected === "attention" ? row.dataset.attention === "true" : row.dataset.group === selected);
      row.hidden = !(matchesText && matchesGroup);
      if (!row.hidden) visible += 1;
    });
    resultCount.textContent = `Показано ${visible} із ${context.records.length}`;
  };
  search.addEventListener("input", applyFilters);
  filter.addEventListener("change", applyFilters);
  disclosure.append(body);
  return disclosure;
}

function labReadingCell(reading) {
  const statusLabel = reading.status === "low" ? "нижче референсу" : reading.status === "high" ? "вище референсу" : "";
  const chip = element("span", {
    className: "lab-value-chip",
    attrs: {
      "data-status": reading.status,
      title: [reading.dateLabel, statusLabel].filter(Boolean).join(" · "),
      "aria-label": [textValue(reading.value), statusLabel].filter(Boolean).join(", "),
    },
  });
  chip.append(element("strong", { text: textValue(reading.value) }));
  if (statusLabel) chip.append(element("em", { text: reading.status === "low" ? "нижче" : "вище" }));
  return chip;
}

function labNameCell(lab, abnormal) {
  const wrapper = element("div", { className: "lab-name" });
  wrapper.append(element("strong", { text: panelText(lab.name || "Показник") }));
  if (abnormal) wrapper.append(element("span", { text: "є значення поза референсом" }));
  else if (lab.key) wrapper.append(element("span", { className: "is-key", text: "ключовий показник" }));
  return wrapper;
}

function table(headers, rows, className = "") {
  const wrapper = element("div", { className: `data-table-wrap ${className ? `${className}-wrap` : ""}`.trim() });
  const tableNode = element("table", { className: `data-table ${className}`.trim() });
  const head = element("thead");
  const headRow = element("tr");
  headers.forEach((header) => headRow.append(element("th", { text: header, attrs: { scope: "col" } })));
  head.append(headRow);
  const body = element("tbody");
  rows.forEach((row) => {
    const cells = Array.isArray(row) ? row : row.cells;
    const tr = element("tr", { attrs: Array.isArray(row) ? {} : row.attrs || {} });
    cells.forEach((cell) => {
      const td = element("td");
      td.append(cell instanceof Node ? cell : document.createTextNode(textValue(cell)));
      tr.append(td);
    });
    body.append(tr);
  });
  tableNode.append(head, body);
  wrapper.append(tableNode);
  return wrapper;
}

function renderState() {
  const fragment = document.createDocumentFragment();
  const candidateDocuments = Array.isArray(state.bundle.source_documents) ? state.bundle.source_documents : [];
  const candidateObservations = Array.isArray(state.bundle.observations) ? state.bundle.observations : [];
  const sourceObservationContext = candidateDocuments.length && candidateObservations.length
    ? observationContext(candidateObservations, candidateDocuments)
    : null;
  fragment.append(
    viewHeader(
      "Дослідження та прогалини",
      "Повні датовані результати згруповано за типом дослідження. Кожне джерельне спостереження доступне в реєстрі без автоматичного ранжування клінічної важливості.",
    ),
  );
  const clinical = projectClinicalState(state.bundle);
  const coverage = element("dl", { className: "state-coverage", attrs: { "aria-label": "Покриття структурованих досліджень" } });
  [
    ["Лабораторія", clinical.labs.length],
    ["Тканинні дослідження", clinical.pathology.length],
    ["Візуалізація", clinical.imaging.length],
    ["Групи перевірок", clinical.panel.length],
    ...(candidateDocuments.length ? [["Документи", candidateDocuments.length]] : []),
    ...(candidateObservations.length ? [["Структуровані спостереження", candidateObservations.length]] : []),
  ].forEach(([label, value]) => coverage.append(element("div", {}, [element("dt", { text: label }), element("dd", { text: value || "немає" })])));
  fragment.append(coverage);

  if (clinical.labs.length) {
    const labs = section(
      "Кількісні дані",
      "Лабораторні показники",
      "Кожна колонка — окрема дата з канонічного пакета кейсу. Внутрішні ключі часових точок у таблиці не показуються.",
    );
    const labRows = clinical.labs.map((lab) => {
      return {
        attrs: { ...(lab.abnormal ? { "data-tone": "critical" } : {}), ...(lab.key ? { "data-key": "true" } : {}) },
        cells: [
          labNameCell(lab, lab.abnormal),
          ...lab.series.map(labReadingCell),
          panelText(lab.unit),
          lab.low !== undefined || lab.high !== undefined ? `${textValue(lab.low)}–${textValue(lab.high)}` : "—",
          panelText(lab.note),
        ],
      };
    });
    const labTable = table(
      ["Показник", ...clinical.labColumns.map((column) => column.label), "Одиниця", "Референс", "Примітка"],
      labRows,
      "lab-table",
    );
    labTable.setAttribute("role", "region");
    labTable.setAttribute("aria-label", "Лабораторні показники за датами");
    labTable.tabIndex = 0;
    labTable.querySelector(".lab-table")?.style.setProperty("--lab-date-columns", clinical.labColumns.length);
    labs.append(labTable);
    fragment.append(labs);
  }

  if (clinical.markers?.length) {
    const markers = section("Датовані значення", "Маркери та спеціальні дослідження");
    const markerRows = clinical.markers.map((marker) => {
      const flag = String(marker.flag || "").toUpperCase();
      const tone = flag === "HIGH" ? "critical" : flag === "GAP" ? "miss" : flag === "POS" ? "caution" : "evidence";
      const status = flag === "HIGH" ? "вище референсу" : flag === "GAP" ? "не виконано" : flag === "POS" ? "позитивний" : "у межах референсу";
      return {
        attrs: { "data-tone": tone },
        cells: [
          element("strong", { text: panelText(marker.an) }),
          marker.date && marker.date !== "—"
            ? element("time", { text: spineRawDate(marker.date), attrs: { datetime: marker.date } })
            : "не записано",
          element("div", { className: "marker-value-cell" }, [
            element("strong", { text: panelText(marker.v || "—") }),
            marker.unit ? element("span", { text: panelText(marker.unit) }) : null,
          ]),
          marker.ref || "—",
          stateDataChip(status, "", tone),
          panelText(marker.note || "—"),
        ],
      };
    });
    markers.append(table(["Маркер", "Дата", "Значення", "Референс", "Стан", "Клінічна примітка"], markerRows, "marker-table"));
    fragment.append(markers);
  }

  if (clinical.pathology.length) {
    const pathology = section(
      "Тканини",
      "Тканинні дослідження та ІГХ",
      "Хронологія досліджень, повторних переглядів і попередніх розшифровок. Формулювання документів відокремлено від робочих гіпотез системи.",
    );
    const list = element("div", { className: "state-list pathology-list" });
    clinical.pathology.forEach((item, index) => {
      const tone = enumTone(item.verdict);
      const summaryMeta = element("div", { className: "state-summary-chips" }, [
        item.date ? stateDataChip("Дата", item.dateLabel) : null,
        stateDataChip("Тип запису", item.recordType),
        item.conciseSpecimen ? stateDataChip("Матеріал", item.conciseSpecimen) : null,
        item.verdict ? stateDataChip(enumLabel(item.verdict), "", tone) : null,
      ]);
      const detail = element("details", {
        className: "state-item",
        attrs: { ...(index === clinical.pathology.length - 1 ? { open: "" } : {}), ...(tone ? { "data-tone": tone } : {}) },
      });
      detail.append(
        element("summary", { className: "state-item-summary" }, [
          element("div", {}, [
            element("h3", { text: item.title }),
            summaryMeta,
          ]),
          element("span", { className: "source-disclosure-toggle", attrs: { "aria-hidden": "true" } }),
        ]),
        element("div", { className: "state-item-body pathology-record-body" }, [
          element("section", { className: "pathology-source-layer" }, [
            element("h4", { text: "Знахідки у документі" }),
            stateNarrative(item.findings || "Знахідки не структуровано."),
          ]),
          element("section", { className: "pathology-source-layer pathology-source-conclusion" }, [
            element("div", { className: "pathology-source-heading" }, [
              element("h4", { text: item.conclusionHeading }),
              stateDataChip("Джерельний рівень", "не гіпотеза системи"),
            ]),
            item.sourceSummary ? element("strong", { className: "pathology-source-summary", text: item.sourceSummary }) : null,
            stateNarrative(item.sourceConclusion || "Висновок у джерелі не структуровано."),
            element("p", { className: "pathology-boundary", text: item.boundary }),
          ]),
          stateDetailGrid([["Дата", item.dateLabel], ["Тип запису", item.recordType], ["Дослідження", item.title], ["Матеріал у джерелі", item.specimen]]),
        ]),
      );
      list.append(detail);
    });
    pathology.append(list);
    fragment.append(pathology);
  }

  if (clinical.imaging.length) {
    const imaging = section(
      "Візуалізація",
      "Динаміка уражень",
      "Хронологія зіставляє поширення, контрольні вимірювання та стан селезінки. Нижче кожне дослідження розкрито до окремих знахідок із джерельного документа.",
    );
    const comparisonRows = clinical.imaging.map((item) => {
      const tone = imagingTone(item);
      return {
        attrs: { "data-tone": tone },
        cells: [
          element("time", { text: item.dateLabel, attrs: item.date ? { datetime: item.date } : {} }),
          element("div", { className: "imaging-study-cell" }, [
            element("strong", { text: item.modality }),
            item.noderads ? stateDataChip("NodeRADS", item.noderads, tone) : null,
          ]),
          stateDataChip(item.trend || "динаміку не зазначено", "", tone),
          item.stations || "—",
          item.maxNode || "—",
          item.spleen || "—",
          item.impression || "Висновок не структуровано.",
        ],
      };
    });
    const comparison = table(
      ["Дата", "Дослідження", "Динаміка", "Поширення", "Найбільший вузол", "Селезінка", "Короткий результат"],
      comparisonRows,
      "imaging-comparison-table",
    );
    comparison.setAttribute("role", "region");
    comparison.setAttribute("aria-label", "Хронологія візуалізації та динаміки уражень");
    comparison.tabIndex = 0;
    imaging.append(comparison);

    imaging.append(element("div", { className: "imaging-detail-heading" }, [
      element("h4", { text: "Детальні протоколи" }),
      element("p", { text: "Розкрийте дослідження, щоб переглянути параметри та структуровані знахідки з відповідного документа." }),
    ]));
    const list = element("div", { className: "state-list" });
    clinical.imaging.forEach((item, index) => {
      const tone = imagingTone(item);
      const summaryMeta = element("div", { className: "state-summary-chips" }, [
        stateDataChip("Дата", item.dateLabel),
        item.maxNode ? stateDataChip("Макс. вузол", item.maxNode, tone) : null,
        item.noderads ? stateDataChip("NodeRADS", item.noderads, tone) : null,
      ]);
      const detail = element("details", {
        className: "state-item",
        attrs: { ...(index === clinical.imaging.length - 1 ? { open: "" } : {}), "data-tone": tone },
      });
      detail.append(
        element("summary", { className: "state-item-summary" }, [
          element("div", {}, [
            element("h3", { text: item.modality || item.kind || "Візуалізація" }),
            summaryMeta,
          ]),
          element("span", { className: "source-disclosure-toggle", attrs: { "aria-hidden": "true" } }),
        ]),
        element("div", { className: "state-item-body imaging-record-body" }, [
          element("section", { className: "imaging-result-layer" }, [
            element("div", { className: "imaging-layer-heading" }, [
              element("h4", { text: "Результат дослідження" }),
              stateDataChip("Рівень", "дані кейсу"),
            ]),
            stateNarrative(item.impression || item.trend || "Результат не структуровано."),
            stateDetailGrid([
              ["Оцінка динаміки", item.trend || "не зазначено", tone],
              ["Локалізації", item.stations || "не описано"],
              ["Найбільший описаний вузол", item.maxNode || "не вказано"],
              ["Селезінка", item.spleen && item.spleen !== "—" ? item.spleen : "не описано"],
              ["NodeRADS", item.noderads || "не зазначено", item.noderads ? tone : ""],
              ["Дата дослідження", item.dateLabel],
            ]),
          ]),
          element("section", { className: "imaging-source-layer" }, [
            element("div", { className: "imaging-layer-heading" }, [
              element("h4", { text: "Знахідки, перенесені з документа" }),
              imagingSourceStatus(item),
            ]),
            item.sourceDocument?.summary
              ? element("p", { className: "imaging-document-summary", text: item.sourceDocument.summary })
              : null,
            imagingSourceFindings(item),
            item.sourceDocument
              ? element("p", {
                  className: "imaging-source-boundary",
                  text: `Джерело: ${observationSourceLabel(item.sourceDocument)}${item.sourceDocument.page_count ? ` · ${item.sourceDocument.page_count} стор.` : ""} Структуроване перенесення не є робочою гіпотезою; незвірені поля потребують перевірки за оригіналом.`,
                })
              : null,
          ]),
        ]),
      );
      list.append(detail);
    });
    imaging.append(list);
    fragment.append(imaging);
  }

  if (sourceObservationContext) {
    const registry = section(
      "Повний доступ",
      "Повний реєстр джерельних даних",
      "Реєстр згорнуто за замовчуванням. Він містить усі структуровані спостереження, їхні значення, інтерпретації та адреси сторінок без персональних даних.",
    );
    registry.append(observationRegistry(sourceObservationContext));
    fragment.append(registry);
  }

  const panel = section("Спершу прогалини", "Очікувана панель і прогалини");
  if (!clinical.panel.length) panel.append(emptyState("Очікувана панель не визначена."));
  else {
    const list = element("div", { className: "state-list" });
    clinical.panel.forEach((group) => {
      const completed = group.items.filter((item) => item.present === true).length;
      const urgentMissing = group.items.filter((item) => item.present !== true && ["critical", "decisive", "urgent"].includes(String(item.disc))).length;
      const article = element("details", { className: "state-item state-panel-group", attrs: urgentMissing ? { "data-tone": "critical" } : {} });
      article.append(element("summary", { className: "state-item-summary" }, [
        element("div", {}, [
          element("h3", { text: panelText(group.group) }),
          element("div", { className: "state-summary-chips" }, [
            stateDataChip("Виконано", `${completed} із ${group.items.length}`, completed === group.items.length ? "evidence" : "candidate"),
            urgentMissing ? stateDataChip("Критично відкриті", urgentMissing, "critical") : null,
          ]),
        ]),
        element("span", { className: "source-disclosure-toggle", attrs: { "aria-hidden": "true" } }),
      ]));
      const rows = group.items.map((item) => {
        const significanceTone = enumTone(item.disc);
        const missingTone = item.present === true ? "evidence" : significanceTone === "critical" ? "critical" : "candidate";
        return {
          attrs: { "data-tone": missingTone },
          cells: [
            element("strong", { text: panelText(item.t || item.test || item.name) }),
            stateDataChip(item.present === true ? "виконано" : "не виконано", "", missingTone),
            panelText(item.why || item.note),
            stateDataChip(enumLabel(item.disc), "", significanceTone),
          ],
        };
      });
      article.append(element("div", { className: "state-item-body" }, [table(["Дослідження", "Статус", "Навіщо", "Значущість"], rows, "panel-table")]));
      list.append(article);
    });
    panel.append(list);
  }
  fragment.append(panel);
  return fragment;
}

function renderPacket() {
  const bundle = state.bundle;
  const hypotheses = [...bundle.hypotheses].sort((a, b) => a.rank - b.rank);
  const lead = hypotheses[0];
  const recommendations = recommendationPlanForCase(bundle);
  const groupedRecommendations = recommendations.reduce((groups, item) => {
    const key = item.phase || "Додаткові дані";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
  const fragment = document.createDocumentFragment();
  fragment.append(
    viewHeader(
      "Пакет для консиліуму",
      "Стислий знімок кейсу для обговорення й друку: поточна клінічна рамка, ранжований диференціал, ключові докази та план перевірок. Детальна історія, граф і раунди заперечень залишаються у відповідних вкладках.",
      `${bundle.case.id} · Бриф консиліуму`,
    ),
  );
  const action = element("button", { className: "action-button packet-print-action focus-ring", text: "Друкувати або зберегти PDF", attrs: { type: "button" } });
  action.addEventListener("click", () => window.print());
  fragment.append(action);

  const cover = element("section", { className: "packet-cover" });
  const coverMain = element("div", { className: "packet-cover-main" });
  coverMain.append(
    element("p", { className: "packet-kicker", text: "Поточна клінічна рамка" }),
    element("h3", { className: "packet-lead-title", text: lead?.label || "Провідну робочу гіпотезу не сформовано" }),
    element("p", { className: "packet-lead-copy", text: lead?.stance || bundle.case.signal || "Клінічне резюме не записано." }),
  );
  const keySignals = element("div", { className: "packet-signal-list", attrs: { "aria-label": "Ключові клінічні дані" } });
  const leadDataRefs = lead?.data_refs?.length ? lead.data_refs : bundle.facts.slice(0, 4).map((fact) => fact.id);
  leadDataRefs.slice(0, 4).forEach((ref) => keySignals.append(element("span", { text: factById(ref)?.label || ref })));
  coverMain.append(keySignals);

  const decision = element("aside", { className: "packet-decision" });
  decision.append(
    element("p", { className: "packet-kicker", text: "Ключовий крок" }),
    element("h3", { text: "Діагностична верифікація" }),
    element("p", { text: bundle.case.discriminating_step || "Ключовий крок не записано." }),
  );
  cover.append(coverMain, decision);
  fragment.append(cover);

  const meta = element("dl", { className: "packet-meta" });
  [
    ["Кейс", bundle.case.id],
    ["Сформовано", bundle.case.generated],
    ["Документи", `${bundle.source_documents?.length || 0} клінічних документів`],
    ["Знеособлення", deidentificationLabel(bundle.deidentification?.status)],
    ["Версія контракту", bundle.schema_version],
  ].forEach(([label, value]) => {
    const row = element("div");
    row.append(element("dt", { text: label }), element("dd", { text: textValue(value) }));
    meta.append(row);
  });
  fragment.append(meta);

  const clinical = element("section", { className: "packet-section" });
  clinical.append(
    element("div", { className: "packet-section-head" }, [
      element("div", {}, [element("p", { className: "packet-kicker", text: "Клінічна суть" }), element("h3", { text: "Що потрібно винести на обговорення" })]),
    ]),
    element("div", { className: "packet-clinical-grid" }, [
      element("div", {}, [element("h4", { text: "Клінічна картина" }), element("p", { text: bundle.case.demographics || "Не записано." })]),
      element("div", {}, [element("h4", { text: "Стан доказів" }), clinicalSummary(bundle.case.signal)]),
    ]),
  );
  fragment.append(clinical);

  const differential = element("section", { className: "packet-section" });
  differential.append(
    element("div", { className: "packet-section-head" }, [
      element("div", {}, [element("p", { className: "packet-kicker", text: "Ранжований диференціал" }), element("h3", { text: "Гіпотези для рішення консиліуму" })]),
      element("span", { className: "packet-count", text: `${Math.min(hypotheses.length, 3)} з ${hypotheses.length}` }),
    ]),
  );
  const differentialList = element("ol", { className: "packet-differential" });
  hypotheses.slice(0, 3).forEach((hypothesis) => {
    const tone = hypothesis.rank === 1 ? "danger" : hypothesis.status === "must-not-miss" || hypothesis.status === "must_not_miss" ? "miss" : "caution";
    const item = element("li", { attrs: { "data-tone": tone } });
    const copy = element("div");
    copy.append(
      element("p", { className: "packet-hypothesis-status", text: hypothesisStatus(hypothesis.status) }),
      element("h4", { text: hypothesis.label }),
      element("p", { text: hypothesis.stance || "Позицію не описано." }),
    );
    const refs = element("div", { className: "packet-evidence-row" });
    (hypothesis.evidence_refs || []).slice(0, 4).forEach((ref) => refs.append(evidenceChip(ref)));
    if (refs.children.length) copy.append(refs);
    item.append(element("span", { className: `packet-rank ${tone}`, text: String(hypothesis.rank).padStart(2, "0") }), copy);
    differentialList.append(item);
  });
  differential.append(differentialList);
  if (hypotheses.length > 3) {
    differential.append(
      element("p", {
        className: "packet-continuation",
        text: `Ще ${hypotheses.length - 3} позицій із повними зв’язками доступні на графі гіпотез.`,
      }),
    );
  }
  fragment.append(differential);

  const gapSection = element("section", { className: "packet-section packet-gaps" });
  gapSection.append(
    element("div", { className: "packet-section-head" }, [
      element("div", {}, [
        element("p", { className: "packet-kicker text-danger-700", text: "Відкриті перевірки" }),
        element("h3", { text: "Що ще потрібно з’ясувати" }),
        element("p", { className: "packet-section-copy", text: "Кожен пункт пояснює матеріал або метод, клінічне питання та доказову опору. Це порядок обговорення, а не готове призначення." }),
      ]),
      element("span", { className: "packet-count danger", text: `${recommendations.length} відкритих` }),
    ]),
  );
  if (!recommendations.length) {
    gapSection.append(emptyState("Критичних відкритих перевірок у структурованому пакеті не записано."));
  } else {
    groupedRecommendations.forEach((items, phase) => {
      const group = element("div", { className: "packet-gap-group" });
      group.append(element("h4", { text: phase }));
      const list = element("ol", { className: "packet-gap-list" });
      items.forEach((item, index) => {
        const row = element("li");
        const copy = element("div");
        copy.append(
          element("div", { className: "packet-gap-title-row" }, [
            element("h5", { text: item.title }),
            element("span", { className: `packet-gap-status ${item.tone}`, text: item.status }),
          ]),
          element("p", { className: "packet-gap-action", text: item.action }),
          element("p", { className: "packet-gap-why" }, [element("b", { text: "Клінічне питання: " }), element("span", { text: item.why })]),
        );
        const evidence = element("div", { className: "packet-evidence-row" });
        if (item.refs.length) item.refs.forEach((ref) => evidence.append(evidenceChip(ref)));
        else evidence.append(element("span", { className: "chip gap", text: "◇ Джерело не прив’язане" }));
        copy.append(evidence);
        row.append(element("span", { className: "packet-gap-index", text: String(index + 1).padStart(2, "0") }), copy);
        list.append(row);
      });
      group.append(list);
      gapSection.append(group);
    });
  }
  fragment.append(gapSection);

  const sources = element("section", { className: "packet-section packet-source-footer" });
  sources.append(
    element("div", {}, [element("p", { className: "packet-kicker", text: "Доказова опора" }), element("h3", { text: "Ключові джерела" })]),
    element("div", { className: "packet-source-list" }),
  );
  const sourceList = sources.lastElementChild;
  bundle.sources.filter((source) => source.type === "guideline" || source.type === "pmid").slice(0, 6).forEach((source) => {
    const row = element("div");
    row.append(source.type === "guideline" ? evidenceChip(source.id) : evidenceChip(source.id), element("p", { text: source.type === "guideline" ? guidelineCitation(source) : source.citation }));
    sourceList.append(row);
  });
  if (!sourceList.children.length) sourceList.append(emptyState("Прив’язані настанови або публікації PubMed відсутні."));
  sources.append(element("p", { className: "packet-boundary", text: clinicianNarrative(bundle.case.governance || "Підтримка клінічного рішення. Остаточний висновок формує клінічна команда.") }));
  fragment.append(sources);
  return fragment;
}

function renderBodyMap() {
  const fragment = document.createDocumentFragment();
  fragment.append(
    viewHeader(
      "Локалізація ураження й матеріалів",
      "Панель показує лише анатомічні локалізації, прямо зафіксовані у структурованому пакеті. Вона не домальовує координати, поширеність або системне ураження без джерельних даних.",
    ),
  );

  const pathology = Array.isArray(state.bundle.clinical_state?.pathology)
    ? state.bundle.clinical_state.pathology
    : [];
  const specimens = [...new Set(pathology.map((item) => item.specimen).filter(Boolean))];
  const overview = section("Покриття", "Органи та матеріали");
  overview.append(
    specimens.length
      ? table(
          ["Локалізація", "Кількість структурованих записів"],
          specimens.map((specimen) => [specimen, pathology.filter((item) => item.specimen === specimen).length]),
        )
      : emptyState("Структуровані анатомічні локалізації у пакеті не записані."),
  );
  fragment.append(overview);

  const material = section("Джерельні спостереження", "Матеріали та висновки");
  material.append(
    pathology.length
      ? table(
          ["Дата", "Матеріал", "Дослідження", "Знахідка", "Межа висновку"],
          pathology.map((item) => [item.date, item.specimen, item.kind, item.finding, item.conclusion]),
        )
      : emptyState("Патоморфологічний шар для цього кейсу відсутній."),
  );
  fragment.append(material);

  const boundary = section("Межа інтерпретації", "Що ця панель не стверджує");
  boundary.append(
    element("ul", {}, [
      element("li", { text: "Відсутність органа у переліку не означає відсутність ураження." }),
      element("li", { text: "Кількість записів не є мірою тяжкості або поширеності." }),
      element("li", { text: "Графічна карта тіла не будується без структурованих координат і валідованої анатомічної моделі." }),
    ]),
  );
  fragment.append(boundary);
  return fragment;
}

// SVG має окремий DOM-простір: className для HTML тут не працює надійно.
// Підтримує старий короткий запис атрибутів і розширений запис як у element().
function svgElement(tag, options = {}, children = []) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  const attrs = options.attrs || options;
  if (options.className) node.setAttribute("class", options.className);
  if (options.text !== undefined) node.textContent = displayText(options.text);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "attrs" || key === "className" || key === "text" || value === undefined || value === null) return;
    node.setAttribute(key, String(value));
  });
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === undefined || child === null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function renderGraph() {
  const fragment = document.createDocumentFragment();
  const compactHeader = element("header", { className: "graph-compact-header" }, [
    element("div", { className: "graph-heading-copy" }, [
      element("p", { className: "graph-header-kicker", text: "Клінічне обґрунтування" }),
      element("h2", { text: "Граф гіпотез" }),
      element("p", { text: "Оберіть гіпотезу або знахідку, щоб простежити пов’язані дані." }),
    ]),
  ]);
  fragment.append(compactHeader);
  const graphSection = element("section", {
    className: "content-section graph-section",
    attrs: { "aria-label": "Зв’язки вибраної гіпотези" },
  });
  if (!state.bundle.relations.length) {
    graphSection.append(emptyState("Для цього bundle немає типізованих зв’язків графа."));
    fragment.append(graphSection);
    return fragment;
  }

  const layout = element("div", { className: "graph-layout" });
  const canvas = element("div", { className: "graph-canvas" });
  const stageBar = element("div", { className: "graph-stage-bar" });
  const focusStatus = element("p", { className: "graph-focus-status", text: "Вузол не вибрано" });
  const legend = element("div", { className: "graph-legend", attrs: { "aria-label": "Позначення зв’язків" } });
  [
    ["support", "підтримує"],
    ["refute", "суперечить"],
    ["neutral", "нейтральний зв’язок"],
  ].forEach(([tone, label]) => {
    legend.append(element("span", { className: "graph-legend-item" }, [
      element("i", { className: `graph-legend-line ${tone}`, attrs: { "aria-hidden": "true" } }),
      element("span", { text: label }),
    ]));
  });
  stageBar.append(focusStatus, legend);
  const stage = element("div", { className: "graph-stage", attrs: { "aria-label": "Інтерактивний граф" } });
  const detail = element("aside", { className: "graph-detail", attrs: { "aria-live": "polite" } });
  const graphHeight = Math.max(520, Math.max(state.bundle.facts.length * 58, state.bundle.hypotheses.length * 86) + 118);
  const svg = svgElement("svg", { viewBox: `0 0 980 ${graphHeight}`, role: "group", "aria-label": "Граф клінічних знахідок і робочих гіпотез" });
  const height = Number(svg.getAttribute("viewBox").split(" ")[3]);
  const findingsHeading = svgElement("text", { class: "graph-column-label", x: "24", y: "38" });
  findingsHeading.textContent = "ЗНАХІДКИ";
  const hypothesesHeading = svgElement("text", { class: "graph-column-label", x: "620", y: "38" });
  hypothesesHeading.textContent = "ГІПОТЕЗИ";
  svg.append(findingsHeading, hypothesesHeading);
  const factY = new Map();
  const hypothesisY = new Map();
  state.bundle.facts.forEach((fact, index) => factY.set(fact.id, 82 + index * ((height - 128) / Math.max(1, state.bundle.facts.length - 1))));
  state.bundle.hypotheses.forEach((hypothesis, index) => hypothesisY.set(hypothesis.id, 94 + index * ((height - 150) / Math.max(1, state.bundle.hypotheses.length - 1))));

  state.bundle.relations.forEach((relation, index) => {
    const y1 = factY.get(relation.fact_id);
    const y2 = hypothesisY.get(relation.hypothesis_id);
    if (y1 === undefined || y2 === undefined) return;
    const edge = svgElement("path", {
      class: "graph-edge",
      d: `M 370 ${y1} C 470 ${y1}, 520 ${y2}, 620 ${y2}`,
      "data-fact": relation.fact_id,
      "data-hypothesis": relation.hypothesis_id,
      "data-relation": relation.relation,
      id: `edge-${index}`,
    });
    svg.append(edge);
  });

  function renderReasoningPath(hypothesis) {
    const path = (state.bundle.methodology.reasoning_paths || []).find((item) => item.hypothesis_id === hypothesis.id);
    if (!path) return emptyState("Для цієї гіпотези ще не записано окремий шлях клінічного обґрунтування.");
    const interpretation = claimById(path.interpretation_claim_id);
    const disclosure = element("details", {
      className: `graph-reasoning-path ${path.display_depth === "compact" ? "is-compact" : "is-full"}`,
      attrs: path.display_depth === "full" ? { open: "" } : {},
    });
    disclosure.append(element("summary", {}, [
      element("span", { text: "Шлях клінічного обґрунтування" }),
      element("small", { text: "кандидат · потребує перевірки лікарем" }),
    ]));

    const body = element("div", { className: "graph-reasoning-body" });
    if (interpretation) {
      body.append(
        element("p", { className: "graph-reasoning-label", text: "Синтез для цього кейсу" }),
        element("p", { className: "graph-reasoning-interpretation", text: interpretation.text }),
      );
    }

    const facts = element("section", { className: "graph-reasoning-layer" });
    facts.append(element("h4", { text: "Факти кейсу" }));
    const factList = element("div", { className: "graph-reasoning-facts" });
    path.fact_claim_refs.forEach((claimId) => {
      const claim = claimById(claimId);
      const fact = claim?.fact_refs?.map((id) => factById(id)).find(Boolean);
      if (fact) factList.append(element("span", { text: fact.label }));
    });
    facts.append(factList);

    const sources = element("section", { className: "graph-reasoning-layer" });
    sources.append(element("h4", { text: "Положення джерел" }));
    const sourceList = element("div", { className: "graph-reasoning-sources" });
    path.source_claim_refs.forEach((claimId) => {
      const claim = claimById(claimId);
      if (!claim) return;
      const row = element("article", {});
      row.append(element("p", { text: claim.text }));
      if (claim.source_refs?.length) {
        const refs = element("div", { className: "provenance-source-row" });
        claim.source_refs.forEach((id) => refs.append(evidenceChip(id)));
        row.append(refs);
      }
      sourceList.append(row);
    });
    sources.append(sourceList);

    const judgement = element("dl", { className: "graph-reasoning-judgement" });
    [
      ["Застосовність", path.applicability],
      ["Межа висновку", path.limitations],
      ["Що перевіряє гіпотезу", path.verification_step],
    ].forEach(([label, value]) => {
      judgement.append(element("div", {}, [element("dt", { text: label }), element("dd", { text: value })]));
    });
    body.append(facts, sources, judgement);
    disclosure.append(body);
    return disclosure;
  }

  function setDetail(kind, item) {
    detail.replaceChildren();
    const connections = state.bundle.relations.filter((relation) =>
      kind === "fact" ? relation.fact_id === item.id : relation.hypothesis_id === item.id,
    );
    const hypothesisRole = kind === "hypothesis" ? graphHypothesisRole(item) : "";
    const detailKind = kind === "fact" ? "Клінічна знахідка" : `${hypothesisRole} · ранг №${item.rank}`;
    focusStatus.textContent = `${kind === "fact" ? "Вибрана знахідка" : "Вибрана гіпотеза"}: ${kind === "fact" ? item.label : `№${item.rank} ${item.short_label || item.label}`}`;
    focusStatus.title = focusStatus.textContent;
    detail.append(
      element("p", { className: "graph-detail-kicker", text: detailKind }),
      element("h3", { className: "graph-detail-title", text: item.label }),
      element("p", { className: "graph-detail-label", text: kind === "fact" ? "Що зафіксовано" : "Поточна оцінка" }),
      element("p", { className: "graph-detail-copy", text: kind === "fact" ? item.detail : item.stance }),
    );
    const relOrder = { support: 0, neutral: 1, refute: 2 };
    const relWord = { support: "підтримує", refute: "суперечить", neutral: "нейтрально" };
    const relationCounts = kind === "hypothesis"
      ? relationCountsForHypothesis(state.bundle, item.id)
      : connections.reduce((counts, relation) => {
        counts[relation.relation] = (counts[relation.relation] || 0) + 1;
        return counts;
      }, { support: 0, refute: 0, neutral: 0 });
    const metrics = element("dl", { className: "graph-detail-metrics" });
    [
      ["support", "Підтримують"],
      ["refute", "Суперечать"],
      ["neutral", "Нейтральні"],
    ].forEach(([tone, label]) => {
      metrics.append(element("div", { attrs: { "data-relation": tone } }, [
        element("dt", { text: label }),
        element("dd", { text: relationCounts[tone] }),
      ]));
    });
    detail.append(metrics, element("p", { className: "graph-detail-label graph-detail-relations-label", text: "Пов’язані дані" }));
    const list = element("ul", { className: "relation-list" });
    connections
      .slice()
      .sort((a, b) => (relOrder[a.relation] ?? 1) - (relOrder[b.relation] ?? 1))
      .forEach((relation) => {
        const counterpart = kind === "fact" ? hypothesisById(relation.hypothesis_id) : factById(relation.fact_id);
        const li = element("li", { className: "rel-item" });
        li.append(
          element("span", { className: `rel-tag ${relation.relation}`, text: relWord[relation.relation] || relation.relation }),
          element("span", { className: "rel-text", text: counterpart ? counterpart.label : "невідомий вузол" }),
        );
        list.append(li);
      });
    detail.append(list);
    if (kind === "hypothesis") detail.append(renderReasoningPath(item));
    svg.querySelectorAll(".graph-edge").forEach((edge) => {
      edge.classList.toggle("is-active", kind === "fact" ? edge.dataset.fact === item.id : edge.dataset.hypothesis === item.id);
    });
    svg.querySelectorAll(".graph-node").forEach((node) => {
      const connected = connections.some((relation) =>
        node.dataset.kind === "fact" ? relation.fact_id === node.dataset.id : relation.hypothesis_id === node.dataset.id,
      );
      node.classList.toggle("is-dim", node.dataset.id !== item.id && !connected);
      node.classList.toggle("is-active-node", node.dataset.id === item.id);
      node.setAttribute("aria-pressed", String(node.dataset.id === item.id));
    });
  }

  function compactHypothesisLabel(item) {
    // Short labels live in the validated bundle (hypothesis.short_label);
    // the renderer only falls back to clipping the full clinical label.
    return item.short_label || wordClip(item.label, 38);
  }

  function interactiveGroup(kind, item, x, y, width) {
    const group = svgElement("g", {
      class: "graph-node",
      transform: `translate(${x} ${y})`,
      tabindex: "0",
      role: "button",
      "aria-label": `${kind === "fact" ? "Клінічна знахідка" : "Робоча гіпотеза"} ${kind === "fact" ? item.id : `номер ${item.rank}`}: ${item.label}`,
      "data-kind": kind,
      "data-id": item.id,
      "data-rank": kind === "hypothesis" ? item.rank : undefined,
      "data-linchpin": kind === "fact" && item.linchpin ? "true" : undefined,
      "aria-pressed": "false",
    });
    if (kind === "fact") {
      group.append(
        svgElement("rect", { class: "finding-surface", x: "-346", y: "-24", width: "328", height: "48", rx: "0" }),
        svgElement("rect", { class: "finding-accent", x: "-346", y: "-24", width: "3", height: "48", rx: "0" }),
        svgElement("circle", { class: "finding-port", cx: "0", cy: "0", r: item.linchpin ? "8" : "6" }),
      );
    } else {
      group.setAttribute("data-tone", hypothesisTone(item.status, item.rank));
      group.append(
        svgElement("rect", { class: "node-selection-ring", x: "-3", y: "-35", width: String(width + 6), height: "70", rx: "0" }),
        svgElement("rect", { class: "node-surface", x: "0", y: "-32", width, height: "64", rx: "0" }),
        svgElement("rect", { class: "node-tone-bar", x: "0", y: "-32", width: "1", height: "64", rx: "0" }),
        svgElement("rect", { class: "node-rank-badge", x: "16", y: "-19", width: "38", height: "38", rx: "0" }),
      );
    }
    if (kind === "fact") {
      const labelLines = wrapLines(item.label, 40, 2);
      labelLines.forEach((line, index) => {
        const text = svgElement("text", { x: "-326", y: String((labelLines.length === 2 ? -6 : 4) + index * 15), "text-anchor": "start", class: "node-label finding-label" });
        text.textContent = line;
        group.append(text);
      });
    } else {
      const code = svgElement("text", { class: "node-rank", x: "35", y: "5", "text-anchor": "middle" });
      code.textContent = `#${item.rank}`;
      const role = svgElement("text", { class: "node-status-label", x: "70", y: "-8" });
      role.textContent = graphHypothesisRole(item);
      const label = svgElement("text", { class: "node-label hypothesis-short-label", x: "70", y: "13" });
      label.textContent = compactHypothesisLabel(item);
      group.append(code, role, label);
    }
    const activate = () => setDetail(kind, item);
    group.addEventListener("click", activate);
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
    return group;
  }

  state.bundle.facts.forEach((fact) => svg.append(interactiveGroup("fact", fact, 370, factY.get(fact.id), 328)));
  state.bundle.hypotheses.forEach((hypothesis) => svg.append(interactiveGroup("hypothesis", hypothesis, 620, hypothesisY.get(hypothesis.id), 328)));
  stage.append(svg);
  canvas.append(stageBar, stage);
  layout.append(canvas, detail);
  graphSection.append(layout);
  fragment.append(graphSection);
  setDetail("hypothesis", [...state.bundle.hypotheses].sort((a, b) => a.rank - b.rank)[0]);
  return fragment;
}

function agentGate(label, value, stateName, detail) {
  const row = element("div", { className: "agent-gate", attrs: { "data-state": stateName } });
  row.append(
    element("div", {}, [element("strong", { text: label }), element("span", { text: value })]),
    element("p", { text: detail }),
  );
  return row;
}

function renderAgentAnswer(target, payload) {
  const answer = payload.answer;
  const result = element("section", { className: "agent-answer", attrs: { "aria-live": "polite" } });
  result.append(
    element("div", { className: "agent-answer-head" }, [
      element("div", {}, [
        element("div", { className: "agent-answer-title" }, [
          element("h3", { text: answer.headline }),
          statusTag("робоча гіпотеза · кандидат", "candidate"),
        ]),
        element("p", { text: answer.summary }),
      ]),
      statusTag("контрольний результат", "evidence"),
    ]),
  );
  const columns = element("div", { className: "agent-evidence-columns" });
  const sections = [
    ["Підтримують", answer.support || [], "support"],
    ["Послаблюють або суперечать", answer.refute || [], "critical"],
  ];
  sections.forEach(([title, items, tone]) => {
    const block = element("section", { className: "agent-evidence-block", attrs: { "data-tone": tone } });
    block.append(element("h4", { text: title }));
    const list = element("ul");
    if (items.length) items.forEach((item) => list.append(element("li", { text: item.label })));
    else list.append(element("li", { className: "agent-empty-evidence", text: "Типізовані зв’язки цього напряму у графі не записані." }));
    block.append(list);
    columns.append(block);
  });
  result.append(columns);

  const next = element("div", { className: "agent-next-check" });
  next.append(element("h4", { text: "Наступна перевірка" }), element("p", { text: answer.next_check }));
  result.append(next);

  if ((answer.uncertainties || []).length) {
    const uncertainty = element("details", { className: "agent-uncertainty" });
    uncertainty.append(element("summary", { text: `Невизначеність · ${answer.uncertainties.length}` }));
    const list = element("ul");
    answer.uncertainties.forEach((item) => list.append(element("li", { text: item })));
    uncertainty.append(list);
    result.append(uncertainty);
  }
  if ((payload.source_chips || []).length) {
    const sources = element("div", { className: "agent-source-strip" });
    sources.append(element("strong", { text: "Джерельні шари" }));
    payload.source_chips.forEach((item) => sources.append(element("span", { text: item.label })));
    result.append(sources);
  }
  target.replaceChildren(result);
}

function candidateRelationCounts(revision, hypothesisId) {
  const counts = { support: 0, refute: 0, neutral: 0 };
  (revision.relations || []).forEach((relation) => {
    if (relation?.hypothesis_id === hypothesisId && Object.hasOwn(counts, relation.relation)) {
      counts[relation.relation] += 1;
    }
  });
  return counts;
}

function renderReasoningCandidate(candidate) {
  const section = element("section", { className: "reasoning-candidate" });
  if (!candidate || candidate.status === "absent") return section;
  if (candidate.status !== "ok") {
    section.append(
      element("div", { className: "reasoning-candidate-error" }, [
        element("strong", { text: "Кандидатний синтез не пройшов перевірку" }),
        element("p", { text: candidate.detail || "Стан ревізії невідомий; її не можна показувати як перевірений артефакт." }),
      ]),
    );
    return section;
  }

  const revision = candidate.revision;
  const hypotheses = [...(revision.hypotheses || [])].sort((a, b) => Number(a.rank) - Number(b.rank));
  const lead = hypotheses[0];
  const head = element("header", { className: "reasoning-candidate-head" });
  head.append(
    element("div", {}, [
      element("p", { className: "reasoning-candidate-kicker", text: "Свіжа кандидатна ревізія" }),
      element("h2", { text: `Синтез гіпотез ${overviewCaseCode(state.bundle)}` }),
      element("p", { text: revision.reason }),
    ]),
    element("div", { className: "reasoning-candidate-status" }, [
      statusTag("очікує рішення лікаря", "candidate"),
      element("code", { text: revision.reasoning_revision_id }),
    ]),
  );
  section.append(head);

  if (lead) {
    const counts = candidateRelationCounts(revision, lead.id);
    section.append(
      element("article", { className: "reasoning-lead" }, [
        element("div", { className: "reasoning-rank", text: `01 · ${lead.id}` }),
        element("div", {}, [
          element("p", { className: "reasoning-role", text: lead.clinical_role }),
          element("h3", { text: lead.label }),
          element("p", { text: lead.rationale }),
          element("div", { className: "reasoning-counts" }, [
            element("span", { text: `${counts.support} підтримують` }),
            element("span", { text: `${counts.refute} суперечать` }),
            element("span", { text: `${counts.neutral} нейтральні` }),
          ]),
        ]),
      ]),
    );
  }

  const ranked = element("details", { className: "reasoning-disclosure", attrs: { open: "" } });
  ranked.append(element("summary", { text: `Ранжований диференціал · ${hypotheses.length}` }));
  const hypothesisList = element("ol", { className: "reasoning-hypothesis-list" });
  hypotheses.forEach((hypothesis) => {
    const counts = candidateRelationCounts(revision, hypothesis.id);
    const item = element("li");
    item.append(
      element("span", { className: "reasoning-rank", text: String(hypothesis.rank).padStart(2, "0") }),
      element("div", {}, [
        element("strong", { text: hypothesis.label }),
        element("p", { text: hypothesis.clinical_role }),
      ]),
      element("span", {
        className: "reasoning-mini-counts",
        text: `+${counts.support} · −${counts.refute} · ${counts.neutral} нейтр.`,
      }),
    );
    hypothesisList.append(item);
  });
  ranked.append(hypothesisList);
  section.append(ranked);

  const workup = element("details", { className: "reasoning-disclosure", attrs: { open: "" } });
  workup.append(element("summary", { text: `Діагностична верифікація · ${(revision.workup || []).length}` }));
  const workupList = element("div", { className: "reasoning-workup-list" });
  (revision.workup || []).forEach((item) => {
    const priority = item.priority === "critical" ? "критично" : item.priority === "high" ? "високий пріоритет" : "за показаннями";
    workupList.append(
      element("article", { attrs: { "data-priority": item.priority } }, [
        element("div", {}, [element("strong", { text: item.id }), element("span", { text: priority })]),
        element("h3", { text: item.title }),
        element("p", { text: item.rationale }),
      ]),
    );
  });
  workup.append(workupList);
  section.append(workup);

  const gaps = element("details", { className: "reasoning-disclosure reasoning-gaps" });
  gaps.append(element("summary", { text: `Незакриті клінічні прогалини · ${(revision.critical_gaps || []).length}` }));
  const gapList = element("ul");
  (revision.critical_gaps || []).forEach((gap) => gapList.append(element("li", { text: gap })));
  gaps.append(gapList);
  section.append(gaps);

  section.append(
    element("p", {
      className: "reasoning-candidate-boundary",
      text: "Ця ревізія не змінює прийняті гіпотези, клінічний стан або журнал рішень. Для перенесення потрібне окреме рішення лікаря й нова канонічна ревізія.",
    }),
  );
  return section;
}

async function renderAgent() {
  const fragment = document.createDocumentFragment();
  fragment.append(
    viewHeader(
      "Контрольований розбір",
      "Поставте питання до знеособленого графа. Локальний режим показує записані зв’язки без виклику моделі й без зміни картки пацієнта.",
    ),
  );

  const controller = new AbortController();
  activeViewCleanup = () => controller.abort();
  let health = null;
  if (!IS_PUBLIC_STATIC_DEMO) {
    try {
      let probeAgentApi = true;
      const runtime = await fetch("/health/ready", { cache: "no-store", signal: controller.signal });
      if (runtime.ok) {
        const runtimeStatus = await runtime.json();
        probeAgentApi = runtimeStatus?.agent_api !== false;
      }
      if (probeAgentApi) {
        const response = await fetch(`/api/agent/health?caseKey=${encodeURIComponent(state.caseKey)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) health = await response.json();
      }
    } catch (error) {
      if (error?.name === "AbortError") throw error;
    }
  }

  const workspace = element("section", { className: "agent-workspace", attrs: { "data-connected": String(Boolean(health)) } });
  const main = element("div", { className: "agent-main" });
  const mode = element("div", { className: "agent-mode-line" });
  mode.append(
    statusTag(health ? "контроль готовий" : "сервер не підключено", health ? "support" : "critical"),
    element("span", { text: `Читає мінімально необхідну проєкцію ${overviewCaseCode(state.bundle)}; кандидатний синтез не змінює прийняту картину.` }),
  );
  main.append(mode);

  const form = element("form", { className: "agent-composer" });
  const label = element("label", { attrs: { for: "agent-question" } });
  label.append(
    element("strong", { text: "Запит до графа доказів" }),
    element("span", { text: "Відповідь буде кандидатом для перевірки, а не діагнозом." }),
  );
  const textarea = element("textarea", {
    className: "agent-question",
    attrs: {
      id: "agent-question",
      rows: "4",
      maxlength: "1200",
      placeholder: "Наприклад: які факти підтримують провідну гіпотезу і чого бракує для її верифікації?",
      disabled: health ? null : "disabled",
    },
  });
  const suggestions = element("div", { className: "agent-suggestions", attrs: { "aria-label": "Приклади запитів" } });
  [
    "Що підтримує провідну гіпотезу?",
    "Які суперечні дані записані?",
    "Який наступний крок верифікації?",
  ].forEach((question) => {
    const button = element("button", { text: question, attrs: { type: "button", disabled: health ? null : "disabled" } });
    button.addEventListener("click", () => {
      textarea.value = question;
      textarea.focus();
    });
    suggestions.append(button);
  });
  const actions = element("div", { className: "agent-composer-actions" });
  const formStatus = element("p", {
    className: "agent-form-status",
    text: health ? "Готово до локального запиту." : "Відкрийте цю сторінку через локальний AgentEngine server, щоб активувати форму.",
    attrs: { "aria-live": "polite" },
  });
  const submit = element("button", {
    className: "agent-submit focus-ring",
    text: "Перевірити по графу",
    attrs: { type: "submit", disabled: health ? null : "disabled" },
  });
  actions.append(formStatus, submit);
  form.append(label, textarea, suggestions, actions);
  main.append(form);

  const answerHost = element("div", { className: "agent-answer-host" });
  answerHost.append(
    element("section", { className: "agent-empty" }, [
      element("h3", { text: "Результат з’явиться тут" }),
      element("p", { text: "Система розкладе провідну гіпотезу на записані підтримувальні, суперечні та невизначені зв’язки й покаже наступну перевірку." }),
    ]),
  );
  main.append(answerHost);
  main.append(renderReasoningCandidate(state.reasoningCandidate));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = textarea.value.trim();
    if (!question) {
      formStatus.textContent = "Сформулюйте запит перед запуском.";
      textarea.focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = "Перевіряю…";
    formStatus.textContent = "Будую контрольну проєкцію з поточної ревізії кейсу…";
    try {
      const response = await fetch("/api/agent/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseKey: state.caseKey, question }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "AgentEngine відхилив запит.");
      renderAgentAnswer(answerHost, payload);
      formStatus.textContent = "Контрольний результат побудовано; картку пацієнта не змінено.";
    } catch (error) {
      if (error?.name === "AbortError") return;
      formStatus.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      submit.disabled = false;
      submit.textContent = "Перевірити по графу";
    }
  });

  const rail = element("aside", { className: "agent-gates", attrs: { "aria-label": "Шлюзи AgentEngine" } });
  rail.append(element("h3", { text: "Що доступно зараз" }));
  if (health) {
    const review = health.graph_review || {};
    rail.append(
      agentGate("Локальний контроль", "Готовий", "ready", "Читає типізований граф, не викликає зовнішню модель і не створює клінічних рішень."),
      agentGate(
        "Звірка графа",
        Number.isInteger(review.clinician_decisions) ? `${review.clinician_decisions} рішень лікаря` : "Потребує перевірки",
        review.clinician_decisions ? "review" : "ready",
        Number.isInteger(review.safe_syncs) ? `${review.safe_syncs} технічних розбіжностей можна синхронізувати без зміни клінічного змісту.` : "Пакет звірки ще не завантажено.",
      ),
      agentGate(
        "Codex",
        health.codex?.activation === "ready" ? "Готовий" : "Запуск закритий",
        health.codex?.activation === "ready" ? "ready" : "blocked",
        health.codex?.activation === "ready"
          ? "OAuth підключено, ізоляційні шлюзи пройдено."
          : health.codex?.managed_oauth === "connected"
            ? "OAuth підключено; модель не запускається до обмеження читання файлів і тестів інструментів."
            : "OAuth недоступний; модель не запускається.",
      ),
    );
  } else {
    rail.append(agentGate("Локальний сервер", "Не підключено", "blocked", "Статична сторінка може показувати кейс, але для контрольованого запиту потрібен loopback AgentEngine server."));
  }
  if (state.reasoningCandidate?.status === "ok") {
    rail.append(
      agentGate(
        "Кандидатний синтез",
        "Свіжий і цілісний",
        "review",
        `${state.reasoningCandidate.revision.hypotheses?.length || 0} гіпотез; рішення лікаря ще не записано.`,
      ),
    );
  } else if (state.reasoningCandidate && state.reasoningCandidate.status !== "absent") {
    rail.append(agentGate("Кандидатний синтез", "Недоступний", "blocked", state.reasoningCandidate.detail || "Артефакт не пройшов перевірку."));
  }
  rail.append(
    element("div", { className: "agent-boundary" }, [
      element("strong", { text: "Незмінна межа" }),
      element("p", { text: "Жодна відповідь агента не змінює картку пацієнта автоматично. Прийняття потребує окремої дії лікаря й нової ревізії." }),
    ]),
  );

  workspace.append(main, rail);
  fragment.append(workspace);
  return fragment;
}

// Typed run loading: the UI must distinguish "no run yet" from "run is
// corrupted", "pointer is broken" and "bytes do not match the pinned hash".
// Collapsing every failure into null would lie about the evidence base state.
async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadReviewableObservationIds(caseId, signal) {
  if (IS_PUBLIC_STATIC_DEMO || caseId !== "CASE-02") return new Set();
  try {
    const response = await fetch(`/api/v1/cases/${encodeURIComponent(caseId)}/recognition-workspace`, {
      cache: "no-store",
      signal,
    });
    if (!response.ok) return new Set();
    const workspace = await response.json();
    const items = Array.isArray(workspace?.items) ? workspace.items : [];
    return new Set(
      items
        .filter((item) => typeof item?.observation_id === "string" && item.observation_id && item.crop_url)
        .map((item) => item.observation_id),
    );
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return new Set();
  }
}

async function loadReasoningCandidate(bundleText, signal) {
  const config = CASES[state.caseKey];
  if (!config?.reasoningCandidate) return { status: "absent" };
  let pointerResponse;
  try {
    pointerResponse = await fetch(config.reasoningCandidate, { cache: "no-store", signal });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return { status: "network-error", detail: "Сервер не відповів під час читання вказівника кандидатного синтезу." };
  }
  if (!pointerResponse.ok) return { status: "pointer-missing", detail: `Вказівник кандидатного синтезу недоступний (HTTP ${pointerResponse.status}).` };
  let pointer;
  try {
    pointer = await pointerResponse.json();
  } catch {
    return { status: "pointer-invalid", detail: "Вказівник кандидатного синтезу не є валідним JSON." };
  }
  if (
    pointer?.schema_version !== "hematoboard.reasoning-run-pointer/1.0.0"
    || typeof pointer.revision_path !== "string"
    || !pointer.revision_path
  ) {
    return { status: "pointer-invalid", detail: "Вказівник не містить підтримуваної схеми або revision_path." };
  }
  const revisionUrl = new URL(pointer.revision_path, new URL(config.reasoningCandidate, document.baseURI));
  let revisionResponse;
  try {
    revisionResponse = await fetch(revisionUrl, { cache: "no-store", signal });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return { status: "network-error", detail: "Сервер не відповів під час читання кандидатної ревізії." };
  }
  if (!revisionResponse.ok) return { status: "revision-missing", detail: `Кандидатна ревізія недоступна (HTTP ${revisionResponse.status}).` };
  const revisionText = await revisionResponse.text();
  const actualRevisionHash = await sha256Hex(revisionText);
  if (
    actualRevisionHash !== null
    && typeof pointer.revision_sha256 === "string"
    && actualRevisionHash !== pointer.revision_sha256.toLowerCase()
  ) {
    return { status: "hash-mismatch", detail: "Хеш кандидатної ревізії не збігається з незмінним вказівником." };
  }
  let revision;
  try {
    revision = JSON.parse(revisionText);
  } catch {
    return { status: "revision-invalid", detail: "Кандидатна ревізія не є валідним JSON." };
  }
  if (
    revision?.schema_version !== "hematoboard.reasoning-revision/1.0.0"
    || revision.case_id !== state.bundle?.case?.id
    || revision.status !== "candidate"
    || revision.run_id !== pointer.run_id
    || revision.reasoning_revision_id !== pointer.reasoning_revision_id
  ) {
    return { status: "revision-invalid", detail: "Ідентичність кандидатної ревізії не відповідає активному кейсу або її вказівнику." };
  }
  const actualBundleHash = await sha256Hex(bundleText);
  if (
    actualBundleHash !== null
    && typeof revision.input?.bundle_sha256 === "string"
    && actualBundleHash !== revision.input.bundle_sha256.toLowerCase()
  ) {
    return { status: "stale", detail: "Кандидатний синтез побудовано для іншої версії пакета; його не показано як актуальний." };
  }
  return {
    status: "ok",
    pointer,
    revision,
    hashState: actualRevisionHash === null ? "unverified" : "verified",
  };
}

async function loadLatestRun() {
  const config = CASES[state.caseKey];
  if (!config?.latest) return { status: "absent" };
  let pointerResponse;
  try {
    pointerResponse = await fetch(config.latest, { cache: "no-store" });
  } catch {
    return { status: "network-error", detail: "Немає відповіді від сервера під час читання вказівника запуску." };
  }
  if (!pointerResponse.ok) return { status: "absent" };
  let pointer;
  try {
    pointer = await pointerResponse.json();
  } catch {
    return { status: "pointer-invalid", detail: "Вказівник запуску пошкоджений: це не валідний JSON." };
  }
  if (!pointer || typeof pointer.path !== "string" || !pointer.path) {
    return { status: "pointer-invalid", detail: "Вказівник запуску не містить шляху до run.json." };
  }
  const base = config.latest.slice(0, config.latest.lastIndexOf("/") + 1);
  let runResponse;
  let bundleText = null;
  try {
    const [runResult, bundleResult] = await Promise.all([
      fetch(`${base}${pointer.path}`, { cache: "no-store" }),
      fetch(config.bundle, { cache: "no-store" }),
    ]);
    runResponse = runResult;
    if (bundleResult.ok) bundleText = await bundleResult.text();
  } catch {
    return { status: "network-error", detail: "Немає відповіді від сервера під час читання run.json." };
  }
  if (!runResponse.ok) return { status: "run-missing", detail: `Файл запуску недоступний (HTTP ${runResponse.status}).` };
  const runText = await runResponse.text();
  let run;
  try {
    run = JSON.parse(runText);
  } catch {
    return { status: "run-invalid", detail: "run.json пошкоджений: це не валідний JSON." };
  }
  let hashState = "unverified";
  if (typeof pointer.run_sha256 === "string" && pointer.run_sha256) {
    const actual = await sha256Hex(runText);
    if (actual === null) hashState = "unverified";
    else if (actual !== pointer.run_sha256.toLowerCase()) {
      return { status: "hash-mismatch", detail: "Байтовий хеш run.json не збігається з вказівником. Запуск міг бути змінений після публікації.", pointer, run };
    } else hashState = "verified";
  }
  const declaredInputHash = run.input_hashes?.case_bundle_sha256;
  const currentBundleHash = bundleText === null ? null : await sha256Hex(bundleText);
  const bundleHashState = currentBundleHash === null
    ? "unverified"
    : typeof declaredInputHash === "string" && declaredInputHash.toLowerCase() === currentBundleHash
      ? "current"
      : "historical";
  if (config.latestRole === "current_run" && bundleHashState !== "current") {
    return {
      status: "stale",
      detail: "Запуск позначено поточним, але його вхідний пакет не збігається з активним case_bundle.json.",
      pointer,
      run,
    };
  }
  if (config.latestRole !== "current_run" && config.latestRole !== "historical_snapshot") {
    return { status: "role-invalid", detail: "Роль запуску не визначена активним реєстром кейсів." };
  }
  return {
    status: "ok",
    pointer,
    run,
    hashState,
    bundleHashState,
    artifactRole: config.latestRole,
  };
}

function protocolRounds(run) {
  const list = element("div", { className: "protocol-list" });
  const stageNames = ["intake", "positions", "challenge", "evidence", "safety", "synthesis"];
  (run.rounds || []).forEach((round, roundIndex) => {
    const entries = round.entries || [];
    const stage = stageNames[Math.min(Number(round.round) || roundIndex, stageNames.length - 1)];
    const isSynthesis = stage === "synthesis";
    const article = element("article", {
      className: "protocol-round",
      attrs: { "data-stage": stage },
    });
    const head = element("header", { className: "protocol-round-head" });
    head.append(
      element("span", { className: "round-index", text: String(Number(round.round) + 1).padStart(2, "0") }),
      element("div", { className: "round-title" }, [
        element("p", { className: "round-kicker", text: `Етап ${Number(round.round) + 1} із ${run.rounds.length}` }),
        element("h3", { text: round.title }),
      ]),
      element("span", { className: "round-count", text: isSynthesis ? "Фінальний синтез" : `${entries.length} ${entries.length === 1 ? "позиція" : entries.length < 5 ? "позиції" : "позицій"}` }),
    );
    article.append(head);
    if (round.takeaway) article.append(element("p", { className: "round-takeaway", text: round.takeaway }));

    const entryList = element("div", { className: "protocol-entry-list" });
    entries.forEach((entry) => {
      const detail = element("details", {
        className: `protocol-entry${isSynthesis ? " protocol-entry-final" : ""}`,
        attrs: entries.length === 1 ? { open: "" } : {},
      });
      const summary = element("summary", { className: "protocol-entry-head" });
      const summaryCopy = element("span", { className: "protocol-summary-wrap" });
      if (isSynthesis) summaryCopy.append(element("span", { className: "protocol-final-label", text: "Фінальний висновок" }));
      summaryCopy.append(element("span", { className: "protocol-summary", text: entry.summary || "Позиція без короткого резюме." }));
      summary.append(
        element("span", { className: "protocol-role", text: entry.role || "Учасник" }),
        summaryCopy,
        element("span", { className: "entry-toggle", attrs: { "aria-hidden": "true" }, text: "+" }),
      );
      detail.append(summary);

      const analysis = element("dl", { className: "protocol-analysis" });
      for (const [key, label] of [["seen", "Що враховано"], ["reasoning", "Як витлумачено"], ["challenge", "Ключове заперечення"], ["impact", "Що змінилося"]]) {
        if (!entry[key]) continue;
        const item = element("div", { className: "protocol-analysis-item", attrs: { "data-kind": key } });
        item.append(element("dt", { text: label }), element("dd", { text: entry[key] }));
        analysis.append(item);
      }
      detail.append(analysis);

      if (Array.isArray(entry.evidence_refs) && entry.evidence_refs.length) {
        const refs = element("div", { className: "protocol-refs" });
        refs.append(element("span", { className: "protocol-refs-label", text: "Опорні дані" }));
        entry.evidence_refs.forEach((ref) => {
          if (factById(ref)) refs.append(dataChip(ref));
          else if (sourceById(ref)) refs.append(evidenceChip(ref));
          else {
            const hypothesis = hypothesisById(ref);
            refs.append(element("span", {
              className: "chip",
              text: hypothesis ? hypothesis.label : displayText(ref),
              attrs: { title: String(ref) },
            }));
          }
        });
        detail.append(refs);
      }
      entryList.append(detail);
    });
    article.append(entryList);
    list.append(article);
  });
  return list;
}

const RUN_STATE_MESSAGES = {
  absent: "Незмінний запуск ще не створено для цього кейсу. Доступний лише статичний методологічний знімок із пакета.",
  "pointer-invalid": "Вказівник на запуск пошкоджений. Це не те саме, що відсутність запуску: перевірте цілісність runs/latest.json локальним валідатором.",
  "run-missing": "Вказівник посилається на файл запуску, який недоступний. Запуск міг бути видалений або не опублікований повністю.",
  "run-invalid": "Файл запуску пошкоджений і не може бути прочитаний. Не використовуйте цей запуск як доказову основу.",
  "network-error": "Сервер не відповів під час завантаження запуску. Стан доказової бази невідомий — перевірте локальний HTTP-сервер.",
  "hash-mismatch": "Хеш завантаженого запуску не збігається зі значенням у вказівнику. Вміст запуску міг бути змінений після публікації — протокол не показується.",
  stale: "Запуск не відповідає активній версії пакета й не може вважатися поточним.",
  "role-invalid": "Реєстр не визначає, чи цей запуск поточний, чи історичний. Протокол приховано.",
};

// Replay loading mirrors the same honesty rules as run loading: absent,
// invalid and stale are different states and are named differently.
async function loadReplay() {
  const config = CASES[state.caseKey];
  if (!config?.replay) return { status: "absent" };
  const fetchText = async (url) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return response.text();
  };
  let replayText;
  let bundleText;
  try {
    [replayText, bundleText] = await Promise.all([fetchText(config.replay), fetchText(config.bundle)]);
  } catch {
    return { status: "network-error", detail: "Немає відповіді від сервера під час читання replay-артефакту." };
  }
  if (replayText === null) return { status: "absent" };
  let replay;
  try {
    replay = JSON.parse(replayText);
  } catch {
    return { status: "replay-invalid", detail: "replay.json пошкоджений: це не валідний JSON." };
  }
  if (bundleText !== null && typeof replay.bundle_sha256 === "string") {
    const actual = await sha256Hex(bundleText);
    if (actual !== null && actual !== replay.bundle_sha256.toLowerCase()) {
      return { status: "stale", detail: "replay.json застарілий: пакет кейсу змінився після генерації артефакту. Регенеруйте scripts/replay_case.py.", replay };
    }
    let bundle;
    try {
      bundle = JSON.parse(bundleText);
    } catch {
      return { status: "bundle-invalid", detail: "case_bundle.json пошкоджений: CaseScope часової проєкції не можна перевірити." };
    }
    const scope = replay.case_scope;
    const revisionId = typeof bundle.bundle_revision === "object"
      ? bundle.bundle_revision?.id
      : bundle.bundle_revision;
    if (
      config.replayRole !== "current_projection"
      || replay.artifact_role !== "current_projection"
      || !scope
      || scope.schema_version !== "hematoboard.case-scope/1.0.0"
      || scope.case_key !== state.caseKey
      || scope.case_id !== config.caseId
      || scope.bundle_sha256 !== replay.bundle_sha256
      || scope.revision_id !== (revisionId || bundle.schema_version || "revision-not-recorded")
      || scope.operation_id !== "replay"
    ) {
      return { status: "scope-mismatch", detail: "CaseScope часової проєкції не відповідає активному кейсу; артефакт приховано." };
    }
  }
  return { status: "ok", replay };
}

function renderReplay() {
  const fragment = document.createDocumentFragment();
  fragment.append(
    viewHeader(
      "Докази в часі",
      "Які факти були доступні на кожну дату та коли вони почали розмежовувати провідні гіпотези.",
      "Реплей доказів",
    ),
  );
  const loaded = state.replay;
  if (!loaded || loaded.status !== "ok") {
    const messages = {
      absent: "Для цього кейсу часовий реплей не згенеровано (немає датованих фактів або replay-артефакту).",
      "replay-invalid": "Артефакт реплею пошкоджений.",
      "network-error": "Сервер не відповів під час завантаження реплею.",
      stale: "Реплей застарілий відносно поточного пакета кейсу.",
      "bundle-invalid": "Поточний пакет кейсу пошкоджений; прив'язку реплею перевірити неможливо.",
      "scope-mismatch": "Реплей належить іншому кейсу або іншій ревізії пакета.",
    };
    fragment.append(
      element("div", { className: loaded && loaded.status !== "absent" ? "error-panel" : "empty-state" }, [
        element("p", { text: messages[loaded?.status] || messages.absent }),
        loaded?.detail ? element("p", { text: loaded.detail }) : null,
      ]),
    );
    return fragment;
  }
  const replay = loaded.replay;
  const finalHypothesis = hypothesisById(replay.final_hypothesis);
  const runnerUp = state.bundle.hypotheses.find((h) => h.rank === 2);

  const explainer = element("aside", { className: "explainer" });
  explainer.append(element("p", { text: "Зрізи сформовано лише з датованих фактів, зафіксованих у поточному пакеті." }));
  const auditDetails = element("details", { className: "replay-audit-details" });
  auditDetails.append(
    element("summary", { text: "Методика побудови" }),
    element("div", {}, [
      element("p", { text: replay.method }),
      element("p", { text: replay.date_map_note || "" }),
    ]),
  );
  if (replay.facts_undated?.length) {
    auditDetails.querySelector("div").append(element("p", { text: `Факти без дати виключено зі зрізів: ${replay.facts_undated.join(", ")}.` }));
  }
  fragment.append(explainer, auditDetails);

  // Trajectory: support/refute bars for the final pair over the cutoffs.
  const trajectory = section(
    "Траєкторія підтримки",
    `${finalHypothesis?.short_label || finalHypothesis?.label || replay.final_hypothesis} проти ${runnerUp?.short_label || runnerUp?.label || "другої за рангом"}`,
    "Стовпці — кількість фактів «за» станом на дату; червоні риски — факти «проти». Маркер ◆ — фінальна гіпотеза строго лідирує.",
  );
  const pairIds = [replay.final_hypothesis, runnerUp?.id].filter(Boolean);
  const maxSupport = Math.max(
    4,
    ...replay.cutoffs.flatMap((c) => c.standings.filter((s) => pairIds.includes(s.id)).map((s) => s.support)),
  );
  const slot = 104;
  const chartHeight = 190;
  const baseY = 158;
  const width = slot * replay.cutoffs.length + 40;
  const svg = svgElement("svg", { class: "replay-svg", viewBox: `0 0 ${width} ${chartHeight + 56}`, role: "img", "aria-label": "Траєкторія підтримки фінальної пари гіпотез" });

  // Window shading from milestones with from/to dates.
  (replay.milestones || []).forEach((milestone) => {
    if (!milestone.from || !milestone.to) return;
    const fromIdx = replay.cutoffs.findIndex((c) => c.date >= milestone.from);
    const toIdx = replay.cutoffs.findIndex((c) => c.date >= milestone.to);
    if (fromIdx < 0) return;
    const endIdx = toIdx < 0 ? replay.cutoffs.length - 1 : toIdx;
    svg.append(svgElement("rect", {
      class: `replay-window ${milestone.kind === "fault_line_window" ? "fault" : "pair"}`,
      x: String(20 + fromIdx * slot - 8),
      y: "6",
      width: String((endIdx - fromIdx + 1) * slot - 8),
      height: String(baseY - 6),
      rx: "0",
    }));
  });

  replay.cutoffs.forEach((cutoff, index) => {
    const x = 20 + index * slot;
    pairIds.forEach((hid, pairIndex) => {
      const standing = cutoff.standings.find((s) => s.id === hid) || { support: 0, refute: 0 };
      const barHeight = Math.max(3, (standing.support / maxSupport) * (baseY - 20));
      const barX = x + pairIndex * 34;
      svg.append(svgElement("rect", {
        class: `replay-bar ${pairIndex === 0 ? "final" : "runner"}`,
        x: String(barX), y: String(baseY - barHeight), width: "26", height: String(barHeight), rx: "0",
      }));
      if (standing.refute > 0) {
        svg.append(svgElement("line", {
          class: "replay-refute-tick",
          x1: String(barX + 3), x2: String(barX + 23), y1: String(baseY + 7), y2: String(baseY + 7),
        }));
      }
    });
    if (cutoff.final_leads) {
      const marker = svgElement("text", { class: "replay-lead-marker", x: String(x + 22), y: "18", "text-anchor": "middle" });
      marker.textContent = "◆";
      svg.append(marker);
    }
    const label = svgElement("text", { class: "replay-date-label", x: String(x + 22), y: String(baseY + 30), "text-anchor": "middle" });
    label.textContent = spineRawDate(cutoff.date);
    svg.append(label);
  });
  const baseline = svgElement("line", { class: "replay-baseline", x1: "14", x2: String(width - 14), y1: String(baseY), y2: String(baseY) });
  svg.append(baseline);
  trajectory.append(svg);
  const legend = element("div", { className: "replay-legend" });
  legend.append(
    element("span", { className: "replay-legend-item final" }, [element("i"), document.createTextNode(finalHypothesis?.short_label || replay.final_hypothesis)]),
    runnerUp ? element("span", { className: "replay-legend-item runner" }, [element("i"), document.createTextNode(runnerUp.short_label || `#${runnerUp.rank}`)]) : null,
    element("span", { className: "replay-legend-item pair" }, [element("i"), document.createTextNode("вікно нерозділеної пари")]),
    element("span", { className: "replay-legend-item fault" }, [element("i"), document.createTextNode("вікно розбіжності потоків")]),
  );
  trajectory.append(legend);
  fragment.append(trajectory);

  const cutoffsSection = section("Зрізи за датами", "Що було доступне станом на кожну дату", "Кожен зріз перераховано з тих самих заморожених зв'язків графа — без майбутніх фактів.");
  const cutoffList = element("div", { className: "protocol-list" });
  replay.cutoffs.forEach((cutoff, index) => {
    const detail = element("details", { className: "protocol-entry", attrs: index === replay.cutoffs.length - 1 ? { open: "" } : {} });
    const summary = element("summary", { className: "protocol-entry-head" });
    const summaryCopy = element("span", { className: "protocol-summary-wrap" });
    summaryCopy.append(element("span", { className: "protocol-summary", text: cutoff.label }));
    const leaderNames = cutoff.leaders.map((id) => {
      const hypothesis = hypothesisById(id);
      return hypothesis?.short_label || hypothesis?.label || id;
    });
    summary.append(
      element("span", { className: "protocol-role", text: cutoff.date }),
      summaryCopy,
      element("span", { className: "entry-toggle", attrs: { "aria-hidden": "true" }, text: "+" }),
    );
    detail.append(summary);
    const body = element("div", { className: "protocol-analysis" });
    body.append(element("p", { className: "replay-leaders-line", text: cutoff.leaders.length ? `Лідери зрізу: ${leaderNames.join(" · ")}` : "Лідера ще немає (доказів замало)." }));
    if (cutoff.facts_entered.length) {
      const entered = element("div", { className: "protocol-refs" });
      entered.append(element("span", { className: "protocol-refs-label", text: "Нові факти зрізу" }));
      cutoff.facts_entered.forEach((factId) => entered.append(dataChip(factId)));
      body.append(entered);
    }
    const rows = cutoff.standings
      .filter((s) => s.support > 0 || s.refute > 0)
      .sort((a, b) => b.support - a.support || a.refute - b.refute)
      .map((s) => {
        const hypothesis = hypothesisById(s.id);
        return [hypothesis?.short_label || hypothesis?.label || s.id, `за ${s.support}`, `проти ${s.refute}`];
      });
    if (rows.length) body.append(table(["Гіпотеза", "Підтримка", "Спростування"], rows));
    detail.append(body);
    cutoffList.append(detail);
  });
  cutoffsSection.append(cutoffList);
  fragment.append(cutoffsSection);

  return fragment;
}

async function renderReplayAsync() {
  if (!state.replay) state.replay = await loadReplay();
  return renderReplay();
}

async function renderProtocol() {
  const isHistorical = CASES[state.caseKey]?.latestRole === "historical_snapshot";
  const fragment = document.createDocumentFragment();
  fragment.append(
    viewHeader(
      isHistorical ? "Історичний протокол агентних дебатів" : "Протокол агентних дебатів",
      isHistorical
        ? "Архівний операторський запис попередньої версії пакета. Він доступний для аудиту походження, але не є поточним синтезом і не змінює активну клінічну картину."
        : "Операторський відтворюваний запис: які підготовлені позиції, заперечення та синтез модератора закладено у прогін. У цій версії немає самостійного запуску мовної моделі.",
      isHistorical ? "Історичний артефакт" : "Агентні дебати",
    ),
  );
  state.latestRun = await loadLatestRun();
  const audit = section("Відтворюваність", "Дані для перевірки запуску", "Ідентифікатори й хеші прив'язують протокол до знімків входу. Повна перевірка байтових хешів виконується локальним валідатором, а не лише цим статичним переглядом.");
  if (state.latestRun.status !== "ok") {
    const message = RUN_STATE_MESSAGES[state.latestRun.status] || RUN_STATE_MESSAGES.absent;
    const detail = state.latestRun.detail;
    audit.append(
      element("div", { className: state.latestRun.status === "absent" ? "empty-state" : "error-panel" }, [
        element("p", { text: message }),
        detail ? element("p", { text: detail }) : null,
      ]),
    );
  } else {
    const { pointer, run, hashState, bundleHashState, artifactRole } = state.latestRun;
    const hashLabel = hashState === "verified"
      ? "байтовий хеш run.json перевірено у браузері — збігається"
      : "хеш не перевірено в браузері (недоступний WebCrypto або відсутній очікуваний хеш) — звірте локальним валідатором";
    audit.append(
      definitionList([
        ["Ідентифікатор запуску", pointer.run_id],
        ["Режим", run.mode === "operator_offline" ? "операторський офлайн" : run.mode],
        ["Створено", run.created_at],
        ["Хеш пакета кейсу", run.input_hashes?.case_bundle_sha256?.slice(0, 16) || "—"],
        ["Хеш початкових даних дебатів", run.input_hashes?.debate_seed_sha256?.slice(0, 16) || "—"],
        ["Хеш набору ролей", run.input_hashes?.role_bundle_sha256?.slice(0, 16) || "—"],
        ["Статус відносно активного пакета", artifactRole === "historical_snapshot" || bundleHashState === "historical" ? "історичний знімок — не поточний синтез" : "поточна прив'язка"],
        ["Цілісність", hashLabel],
      ]),
    );
    const rounds = section(`${run.rounds?.length || 0} етапів`, "Як змінювався висновок", "Спочатку перегляньте підсумки етапів. Натисніть на позицію учасника, щоб відкрити аргументи та ключові дані.");
    rounds.append(run.rounds?.length ? protocolRounds(run) : emptyState("Раунди не записані."));
    fragment.append(rounds);

    const safety = section("Безпека", "Обмеження запуску");
    safety.append(element("ul", {}, (run.safety?.flags || []).map((flag) => element("li", { text: flag }))));
    fragment.append(safety);
    fragment.append(audit);
    return fragment;
  }
  fragment.append(audit);

  const legacyDebate = state.bundle.methodology.debate || {};
  const snapshot = section("Попередній знімок", "Статичний протокол у пакеті кейсу");
  if (Array.isArray(legacyDebate.rounds)) {
    snapshot.append(element("ol", {}, legacyDebate.rounds.map((round) => element("li", { text: typeof round === "string" ? round : textValue(round) }))));
  } else snapshot.append(emptyState("Статичний протокол відсутній."));
  fragment.append(snapshot);
  return fragment;
}

const RENDERERS = {
  overview: renderOverview,
  timeline: renderTimeline,
  consilium: renderConsilium,
  evidence: renderEvidence,
  state: renderState,
  packet: renderPacket,
  graph: renderGraph,
  bodymap: renderBodyMap,
  replay: renderReplayAsync,
  protocol: renderProtocol,
  agent: renderAgent,
};

function buildNavigation(target, views) {
  target.replaceChildren();
  views.forEach(([id, label]) => {
    const button = element("button", {
      className: "route-button",
      text: label,
      attrs: { type: "button", "data-view": id },
    });
    button.addEventListener("click", () => {
      target.closest("details")?.removeAttribute("open");
      setView(id, true);
    });
    target.append(button);
  });
}

function availableOptionalMethodViews(bundle) {
  return OPTIONAL_METHOD_VIEWS.filter(([id]) => {
    if (id === "replay") return Boolean(CASES[state.caseKey]?.replay);
    if (id === "protocol") return Boolean(CASES[state.caseKey]?.latest);
    return true;
  });
}

function buildPrimaryNavigation() {
  const methodViews = [...METHOD_VIEWS, ...availableOptionalMethodViews(state.bundle)];
  buildNavigation(primaryNav, PRIMARY_VIEWS);
  buildNavigation(dataNav, DATA_VIEWS);
  if (!IS_PUBLIC_STATIC_DEMO) {
    const reviewUrl = new URL("/clinician/", window.location.origin);
    reviewUrl.searchParams.set("case", state.caseKey);
    reviewUrl.searchParams.set("ui", document.documentElement.dataset.ui || "carbon");
    primaryNav.append(element("a", {
      className: "route-button clinician-review-route focus-ring",
      text: "Перевірка",
      attrs: { href: reviewUrl.href, title: "Відкрити контрольовану перевірку лікаря" },
    }));
  }
  buildNavigation(methodNav, methodViews);
  methodNavMenu?.toggleAttribute("hidden", methodViews.length === 0);
  const availableIds = new Set([...PRIMARY_VIEWS, ...DATA_VIEWS, ["packet", "Бриф для консиліуму"], ...methodViews].map(([id]) => id));
  state.view = normalizeView(state.view);
  if (!availableIds.has(state.view)) state.view = "overview";
}

function normalizeView(view) {
  const known = VIEW_LABELS[view] ? view : "overview";
  return LEGACY_VIEW_REDIRECTS[known] || known;
}

function setupRouteMenus() {
  const menus = [dataNavMenu, methodNavMenu].filter(Boolean);
  menus.forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      menus.forEach((candidate) => {
        if (candidate !== menu) candidate.removeAttribute("open");
      });
    });
  });
  document.addEventListener("click", (event) => {
    if (menus.some((menu) => menu.contains(event.target))) return;
    menus.forEach((menu) => menu.removeAttribute("open"));
  });
}

function syncNavigation() {
  let activeButton = null;
  document.querySelectorAll(".route-button").forEach((button) => {
    if (button.dataset.view === state.view) {
      button.setAttribute("aria-current", "page");
      activeButton = button;
    }
    else button.removeAttribute("aria-current");
  });
  [dataNavMenu, methodNavMenu].forEach((menu) => {
    if (!menu) return;
    const containsCurrent = Boolean(menu.querySelector('[aria-current="page"]'));
    menu.classList.toggle("contains-current", containsCurrent);
  });
  if (!activeButton || !window.matchMedia("(max-width: 820px)").matches) return;
  requestAnimationFrame(() => {
    const scroller = activeButton.closest(".route-cluster-primary") || activeButton.closest(".route-nav");
    if (!scroller) return;
    const viewport = scroller.getBoundingClientRect();
    const active = activeButton.getBoundingClientRect();
    if (active.left >= viewport.left && active.right <= viewport.right) return;
    const centered = scroller.scrollLeft + active.left - viewport.left - (viewport.width - active.width) / 2;
    scroller.scrollTo({ left: Math.max(0, centered), behavior: "auto" });
  });
}

function updateUrl(push = false) {
  const url = new URL(window.location.href);
  url.searchParams.set("case", state.caseKey);
  url.searchParams.set("view", state.view);
  history[push ? "pushState" : "replaceState"]({}, "", url);
  const homeUrl = new URL(url);
  homeUrl.searchParams.set("view", "overview");
  brandHome.href = homeUrl;
}

function revealLocationTarget() {
  const targetId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (!targetId) return;
  const target = document.getElementById(targetId);
  if (!target) return;
  let disclosure = target.closest("details");
  while (disclosure) {
    disclosure.open = true;
    disclosure = disclosure.parentElement?.closest("details") || null;
  }
  requestAnimationFrame(() => target.scrollIntoView({ block: "center", behavior: "auto" }));
}

async function renderCurrent({ focus = false } = {}) {
  activeViewCleanup?.();
  activeViewCleanup = null;
  syncNavigation();
  content.replaceChildren(element("p", { className: "empty-state", text: "Підготовка поверхні…" }));
  try {
    const renderer = RENDERERS[state.view] || renderOverview;
    const view = await renderer();
    content.dataset.view = state.view;
    content.replaceChildren(view);
    document.title = `${overviewCaseCode(state.bundle)} · ${VIEW_LABELS[state.view]} · HematoBoard AI`;
    revealLocationTarget();
    if (focus) content.focus({ preventScroll: true });
  } catch (error) {
    content.replaceChildren(
      element("section", { className: "error-panel" }, [
        element("h2", { text: "Поверхню не вдалося побудувати" }),
        element("p", { text: error instanceof Error ? error.message : String(error) }),
      ]),
    );
  }
}

let caseLoadToken = 0;
let caseLoadAbort = null;

async function loadCase(caseKey, { push = false, focus = false } = {}) {
  const token = ++caseLoadToken;
  caseLoadAbort?.abort();
  const controller = new AbortController();
  caseLoadAbort = controller;
  state.caseKey = CASES[caseKey] ? caseKey : defaultCaseKey();
  state.reasoningCandidate = null;
  caseSelect.value = state.caseKey;
  statusLine.dataset.state = "loading";
  statusLine.textContent = "Завантаження й перевірка пакета кейсу…";
  try {
    const response = await fetch(CASES[state.caseKey].bundle, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new CaseLoadError("http", `Пакет кейсу недоступний (HTTP ${response.status}).`);
    const bundleText = await response.text();
    let bundle;
    try {
      bundle = JSON.parse(bundleText);
    } catch {
      throw new CaseLoadError("malformed", "Пакет кейсу пошкоджений: це не валідний JSON. Перевірте case_bundle.json валідатором.");
    }
    if (!["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0"].includes(bundle.schema_version)) {
      throw new CaseLoadError("schema", `Непідтримувана версія контракту: ${bundle.schema_version}.`);
    }
    if (bundle?.case?.id !== CASES[state.caseKey].caseId) {
      throw new CaseLoadError(
        "case-mismatch",
        `Маніфест очікує ${CASES[state.caseKey].caseId}, але завантажений пакет належить ${bundle?.case?.id || "невідомому кейсу"}.`,
      );
    }
    if (token !== caseLoadToken) return; // a newer case selection superseded this load
    state.bundle = bundle;
    state.latestRun = null;
    state.replay = null;
    state.reviewableObservationIds = new Set();
    const [reasoningCandidate, reviewableObservationIds] = await Promise.all([
      loadReasoningCandidate(bundleText, controller.signal),
      loadReviewableObservationIds(bundle.case.id, controller.signal),
    ]);
    if (token !== caseLoadToken) return;
    state.reasoningCandidate = reasoningCandidate;
    state.reviewableObservationIds = reviewableObservationIds;
    buildPrimaryNavigation();
    statusLine.dataset.state = "ready";
    statusLine.textContent = `Пакет завантажено · контракт ${bundle.schema_version} · ${bundle.case.generated || bundle.bundle_id}`;
    const provenanceHash = bundle.provenance.legacy_sha256 || bundle.provenance.source_sha256;
    footerContract.textContent = provenanceHash
      ? `пакет ${bundle.bundle_id} · джерело ${provenanceHash.slice(0, 12)}`
      : `пакет ${bundle.bundle_id}`;
    updateUrl(push);
    await renderCurrent({ focus });
  } catch (error) {
    if (error?.name === "AbortError" || token !== caseLoadToken) return;
    statusLine.dataset.state = "error";
    const typed = error instanceof CaseLoadError ? error : new CaseLoadError("network", "Пакет кейсу не завантажено: сервер не відповідає. Запустіть локальний HTTP-сервер із кореня workbench.");
    statusLine.textContent = typed.message;
    content.replaceChildren(element("section", { className: "error-panel" }, [element("h2", { text: "Пакет кейсу недоступний" }), element("p", { text: typed.message })]));
  }
}

class CaseLoadError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

function setView(view, push = false) {
  state.view = normalizeView(view);
  updateUrl(push);
  renderCurrent({ focus: true });
}

async function boot() {
  try {
    await loadCaseManifest();
  } catch (error) {
    statusLine.dataset.state = "error";
    statusLine.textContent = error instanceof Error ? error.message : String(error);
    content.replaceChildren(
      element("section", { className: "error-panel" }, [
        element("h2", { text: "Маніфест кейсів недоступний" }),
        element("p", { text: error instanceof Error ? error.message : String(error) }),
        element("p", { text: "Перевірте methodology/active_cases.json командою validate-manifest у workbench/scripts/medai_contract.py." }),
      ]),
    );
    return;
  }
  Object.entries(CASES).forEach(([key, config]) => {
    caseSelect.append(element("option", { text: config.label, attrs: { value: key } }));
  });
  buildNavigation(primaryNav, PRIMARY_VIEWS);
  buildNavigation(dataNav, DATA_VIEWS);
  buildNavigation(methodNav, []);
  setupRouteMenus();
  packetNavAction.addEventListener("click", () => setView("packet", true));
  clinicHome.addEventListener("click", () => setView("overview", true));

  function handleCaseSelection() {
    const nextCase = caseSelect.value;
    if (!CASES[nextCase] || nextCase === state.caseKey) return;
    loadCase(nextCase, { push: true, focus: true });
  }

  caseSelect.addEventListener("input", handleCaseSelection);
  caseSelect.addEventListener("change", handleCaseSelection);
  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search);
    state.view = normalizeView(params.get("view"));
    loadCase(params.get("case") || defaultCaseKey(), { push: false, focus: true });
  });
  window.addEventListener("hashchange", revealLocationTarget);

  const initial = new URLSearchParams(window.location.search);
  state.view = normalizeView(initial.get("view"));
  loadCase(initial.get("case") || defaultCaseKey());
}

boot();
