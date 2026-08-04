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
    { key: "support", label: "Підтримує гіпотезу", text: challenge.proponent },
    { key: "limit", label: "Послаблює гіпотезу", text: challenge.opponent },
    { key: "discriminate", label: "Критерій розмежування", text: challenge.resolver },
  ].filter((item) => typeof item.text === "string" && item.text.trim());
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
