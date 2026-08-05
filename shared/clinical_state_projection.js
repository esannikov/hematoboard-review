const asArray = (value) => (Array.isArray(value) ? value : []);

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatDate(value) {
  const raw = normalizeText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : raw || "Дата не вказана";
}

function labValueAt(lab, column, index) {
  const raw = lab?.v ?? lab?.value;
  if (Array.isArray(raw)) return raw[column.sourceIndex];
  if (raw && typeof raw === "object") return raw[column.sourceKey];
  return index === 0 ? raw : undefined;
}

function readingStatus(value, low, high) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (value === null || value === undefined || value === "" || Number.isNaN(numeric)) return "unknown";
  if (low !== null && low !== undefined && numeric < Number(low)) return "low";
  if (high !== null && high !== undefined && numeric > Number(high)) return "high";
  return "normal";
}

function buildLabColumns(clinical) {
  const declared = asArray(clinical?.dates)
    .map((item, index) => ({
      id: normalizeText(item?.id) || `__declared_${index}`,
      sourceKey: normalizeText(item?.id) || `__index_${index}`,
      date: normalizeText(item?.date),
      label: formatDate(item?.date),
      sourceIndex: index,
      mapped: Boolean(normalizeText(item?.date)),
    }))
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.sourceIndex - b.sourceIndex);

  const declaredKeys = new Set(declared.map((column) => column.sourceKey));
  const extraKeys = [];
  asArray(clinical?.labs).forEach((lab) => {
    const raw = lab?.v ?? lab?.value;
    const keys = Array.isArray(raw)
      ? raw.slice(declared.length).map((_, index) => `__index_${declared.length + index}`)
      : raw && typeof raw === "object"
        ? Object.keys(raw)
        : raw !== undefined && declared.length === 0 ? ["__scalar_0"] : [];
    keys.forEach((key) => {
      if (!declaredKeys.has(key) && !extraKeys.includes(key)) extraKeys.push(key);
    });
  });

  const columns = [...declared];
  extraKeys.forEach((sourceKey, index) => {
    columns.push({
      id: `__unmapped_${index}`,
      sourceKey,
      date: "",
      label: "Дата не вказана",
      sourceIndex: declared.length + index,
      mapped: false,
    });
  });
  return columns;
}

function projectLab(lab, columns) {
  const series = columns.map((column, index) => {
    const value = labValueAt(lab, column, index);
    return {
      columnId: column.id,
      date: column.date,
      dateLabel: column.label,
      value,
      status: readingStatus(value, lab?.lo, lab?.hi),
    };
  });
  return {
    source: lab,
    name: lab?.an || lab?.name || "Показник",
    unit: lab?.unit || "",
    low: lab?.lo,
    high: lab?.hi,
    note: lab?.note || "",
    key: lab?.key === true,
    series,
    abnormal: series.some((reading) => reading.status === "low" || reading.status === "high"),
  };
}

function pathologyRecordType(item) {
  const sourceText = normalizeText([
    item?.kind,
    item?.specimen,
    item?.label,
    item?.conclusion,
  ].filter(Boolean).join(" "));
  if (/агентна розшифровка фото-звіту/iu.test(sourceText)) return "Попередня розшифровка фото-звіту";
  if (/повторн(?:ий|ого) перегляд/iu.test(sourceText)) return "Повторний перегляд";
  return "Результат дослідження";
}

function conciseSpecimen(value) {
  return normalizeText(value)
    .replace(/\s*\(агентна розшифровка фото-звіту\)\s*/giu, "")
    .trim();
}

function projectPathology(item, index) {
  const recordType = pathologyRecordType(item);
  const isPhotoInterpretation = recordType === "Попередня розшифровка фото-звіту";
  return {
    source: item,
    id: item?.id || `pathology-${item?.n || index + 1}`,
    title: normalizeText(item?.kind) || "Тканинне дослідження",
    date: normalizeText(item?.date),
    dateLabel: formatDate(item?.date),
    recordType,
    specimen: normalizeText(item?.specimen),
    conciseSpecimen: conciseSpecimen(item?.specimen),
    findings: normalizeText(item?.finding),
    sourceSummary: normalizeText(item?.label),
    sourceConclusion: normalizeText(item?.conclusion),
    verdict: normalizeText(item?.verdict),
    conclusionHeading: isPhotoInterpretation ? "Попередня розшифровка фото-звіту" : "Висновок у джерелі",
    boundary: isPhotoInterpretation
      ? "Потребує звірки з оригінальним звітом і тканиною; це не підтверджений висновок системи."
      : "Наведено як формулювання документа; робочі гіпотези системи показано окремо.",
  };
}

function searchableText(value) {
  return normalizeText(value)
    .toLocaleLowerCase("uk-UA")
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
}

function imagingDocumentScore(item, documentItem, observations) {
  const itemDate = normalizeText(item?.date);
  const documentDate = normalizeText(documentItem?.document_date);
  if (!itemDate || itemDate !== documentDate || documentItem?.document_type !== "imaging") return -1;

  const needle = searchableText([
    item?.modality,
    item?.stations,
    item?.impression,
  ].filter(Boolean).join(" "));
  const haystack = searchableText([
    documentItem?.title,
    documentItem?.summary,
    ...observations.flatMap((observation) => [observation?.display, observation?.value_text]),
  ].filter(Boolean).join(" "));
  const meaningfulTokens = [...new Set(needle.split(" ").filter((token) => token.length >= 4))];
  let score = meaningfulTokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);

  const modality = searchableText(item?.modality);
  if (/\bм?скт\b|\bкт\b/u.test(modality) && /\bм?скт\b|\bкт\b/u.test(haystack)) score += 5;
  if (/узд|ультрас/u.test(modality) && /узд|ультрас/u.test(haystack)) score += 4;
  if (/вуз|лімф/u.test(needle) && /вуз|лімф/u.test(haystack)) score += 5;
  return score;
}

function projectImaging(item, index, documents, observations) {
  const observationsByDocument = new Map();
  observations.forEach((observation) => {
    const documentId = normalizeText(observation?.document_id);
    if (!documentId) return;
    if (!observationsByDocument.has(documentId)) observationsByDocument.set(documentId, []);
    observationsByDocument.get(documentId).push(observation);
  });

  const candidates = documents
    .map((documentItem) => {
      const documentObservations = observationsByDocument.get(documentItem?.id) || [];
      return {
        documentItem,
        observations: documentObservations,
        score: imagingDocumentScore(item, documentItem, documentObservations),
      };
    })
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score || String(a.documentItem?.id).localeCompare(String(b.documentItem?.id)));
  const source = candidates[0] || null;
  const sourceObservations = source
    ? [...source.observations].sort((a, b) => Number(a?.page || 0) - Number(b?.page || 0) || String(a?.id).localeCompare(String(b?.id)))
    : [];
  const verifiedCount = sourceObservations.filter((observation) => observation?.verification?.human_verified === true).length;

  return {
    source: item,
    id: item?.id || `imaging-${index + 1}`,
    date: normalizeText(item?.date),
    dateLabel: formatDate(item?.date),
    modality: normalizeText(item?.modality || item?.kind) || "Візуалізація",
    maxNode: normalizeText(item?.maxNode),
    stations: normalizeText(item?.stations),
    spleen: normalizeText(item?.spleen),
    noderads: normalizeText(item?.noderads),
    trend: normalizeText(item?.trend),
    impression: normalizeText(item?.impression || item?.finding),
    sourceDocument: source?.documentItem || null,
    sourceObservations,
    sourceVerification: sourceObservations.length
      ? {
          verified: verifiedCount,
          total: sourceObservations.length,
          complete: verifiedCount === sourceObservations.length,
        }
      : null,
  };
}

export function projectClinicalState(bundle) {
  const clinical = bundle?.clinical_state && typeof bundle.clinical_state === "object"
    ? bundle.clinical_state
    : {};
  const labColumns = buildLabColumns(clinical);
  return {
    labColumns,
    labs: asArray(clinical.labs).map((lab) => projectLab(lab, labColumns)),
    markers: asArray(clinical.markers),
    pathology: asArray(clinical.pathology).map(projectPathology),
    imaging: asArray(clinical.imaging).map((item, index) => projectImaging(
      item,
      index,
      asArray(bundle?.source_documents),
      asArray(bundle?.observations),
    )),
    panel: asArray(clinical.panel),
  };
}
