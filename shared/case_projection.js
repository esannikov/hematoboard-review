/** Deterministic read projections shared by every HematoBoard dashboard.
 *
 * This module never invents clinical content. It selects, counts and labels
 * fields already present in the validated case bundle.
 */

export function leadingHypothesis(bundle) {
  const hypotheses = Array.isArray(bundle?.hypotheses) ? bundle.hypotheses : [];
  if (!hypotheses.length) return null;
  return hypotheses.find((item) => item?.primary === true)
    || [...hypotheses].sort((a, b) => (a?.rank ?? 99) - (b?.rank ?? 99))[0];
}

export function hypothesisRelationCounts(bundle) {
  const result = new Map();
  for (const relation of bundle?.relations ?? []) {
    if (!result.has(relation.hypothesis_id)) {
      result.set(relation.hypothesis_id, { support: 0, refute: 0, neutral: 0 });
    }
    const counts = result.get(relation.hypothesis_id);
    const key = relation.relation === "support"
      ? "support"
      : relation.relation === "refute" ? "refute" : "neutral";
    counts[key] += 1;
  }
  return result;
}

export function relationCountsForHypothesis(bundle, hypothesisId) {
  return hypothesisRelationCounts(bundle).get(hypothesisId)
    || { support: 0, refute: 0, neutral: 0 };
}

export function hypothesisChallenge(hypothesis) {
  const challenge = hypothesis?.challenge ?? {};
  return [
    { key: "support", label: "Дані на користь", text: challenge.proponent },
    { key: "limit", label: "Обмеження гіпотези", text: challenge.opponent },
    { key: "discriminate", label: "Критерій верифікації", text: challenge.resolver },
  ].filter((item) => typeof item.text === "string" && item.text.trim());
}

function normalizedClinicalText(value) {
  return String(value || "")
    .toLocaleLowerCase("uk-UA")
    .replace(/[’']/gu, "'")
    .replace(/[^\p{L}\p{N}+-]+/gu, " ")
    .trim();
}

const HYPOTHESIS_CONCEPTS = [
  [/(?:\btfh\b|\bпткл\b|т[- ]?клітин)/iu, ["tfh", "пткл", "т клітин"]],
  [/(?:ходжк|hodgkin)/iu, ["ходжк", "hodgkin"]],
  [/(?:каслман|castleman)/iu, ["каслман", "castleman"]],
  [/(?:саркоїд|sarcoid)/iu, ["саркоїд", "sarcoid"]],
  [/(?:\bebv\b|\bhhv[- ]?8\b|вірус)/iu, ["ebv", "hhv 8", "hhv-8", "вірус"]],
  [/(?:реактив|доброякіс)/iu, ["реактив", "доброякіс"]],
  [/(?:карцином|carcinoma)/iu, ["карцином", "carcinoma"]],
  [/(?:туберкул|інфекц|tuberc)/iu, ["туберкул", "інфекц", "tuberc"]],
];

function workupScope(bundle, item) {
  const hypotheses = Array.isArray(bundle?.hypotheses) ? bundle.hypotheses : [];
  const primary = leadingHypothesis(bundle);
  const phase = normalizedClinicalText(item?.phase);
  if (/після.*підтвердж/iu.test(phase)) {
    return [{ id: "STAGING", label: "Після підтвердження", role: "стадіювання" }];
  }

  const workupText = normalizedClinicalText([item?.title, item?.action, item?.why].filter(Boolean).join(" "));
  const scopeIds = new Set();
  if (/верифікац/iu.test(phase) && primary?.id) scopeIds.add(primary.id);

  for (const hypothesis of hypotheses) {
    const hypothesisText = normalizedClinicalText([hypothesis?.label, hypothesis?.short_label].filter(Boolean).join(" "));
    const aliases = HYPOTHESIS_CONCEPTS
      .filter(([pattern]) => pattern.test(hypothesisText))
      .flatMap(([, values]) => values);
    if (aliases.some((alias) => workupText.includes(alias))) scopeIds.add(hypothesis.id);
  }

  return hypotheses
    .filter((hypothesis) => scopeIds.has(hypothesis.id))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .map((hypothesis) => ({
      id: hypothesis.id,
      label: hypothesis.short_label || hypothesis.label || hypothesis.id,
      role: hypothesis.id === primary?.id
        ? "провідна"
        : /паралель/iu.test(phase) ? "критичний диференціал" : "прямий диференціал",
    }));
}

export function workupPlan(bundle) {
  const workup = bundle?.methodology?.workup;
  if (!Array.isArray(workup)) return [];
  return workup.map((item) => ({
    id: item.id,
    title: item.title,
    action: item.action,
    why: item.why,
    refs: item.evidence_refs || [],
    status: item.status,
    tone: item.tone,
    phase: item.phase,
    scope: workupScope(bundle, item),
  }));
}

export function sourceDocumentBreakdown(bundle) {
  const counts = {};
  for (const item of bundle?.source_documents ?? []) {
    const type = item?.document_type || "other";
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}
