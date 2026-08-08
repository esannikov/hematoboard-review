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
  const structuredDates = [...new Set(
    asArray(clinical?.labs)
      .flatMap((lab) => asArray(lab?.readings))
      .map((reading) => normalizeText(reading?.date))
      .filter(Boolean),
  )].sort();
  if (structuredDates.length) {
    return structuredDates.map((date) => ({
      id: date,
      sourceKey: date,
      date,
      label: formatDate(date),
      mapped: true,
    }));
  }
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
  if (Array.isArray(lab?.readings)) {
    const byDate = new Map(lab.readings.map((reading) => [normalizeText(reading?.date), reading]));
    const series = columns.map((column) => {
      const reading = byDate.get(column.date);
      return reading
        ? {
            columnId: column.id,
            date: column.date,
            dateLabel: column.label,
            value: reading.value,
            status: reading.status || readingStatus(reading.value, reading.reference?.low, reading.reference?.high),
            reference: reading.reference || null,
            recordedFlag: reading.recorded_flag || null,
            source: reading.source || null,
          }
        : {
            columnId: column.id,
            date: column.date,
            dateLabel: column.label,
            value: undefined,
            status: "unknown",
            reference: null,
            recordedFlag: null,
            source: null,
          };
    });
    return {
      source: lab,
      name: lab?.an || lab?.name || "Показник",
      unit: lab.readings.find((reading) => normalizeText(reading?.unit))?.unit || "",
      low: undefined,
      high: undefined,
      note: lab?.note || "",
      key: lab?.key === true,
      series,
      abnormal: series.some((reading) => reading.status === "low" || reading.status === "high"),
      structured: true,
    };
  }
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

function explicitSourceReceipt(item, documents, observations) {
  const sourceDocumentId = normalizeText(item?.source_document_id);
  const sourceDocument = sourceDocumentId
    ? documents.find((documentItem) => documentItem?.id === sourceDocumentId) || null
    : null;
  const sourceObservations = sourceDocument
    ? observations
      .filter((observation) => observation?.document_id === sourceDocument.id)
      .sort((a, b) => Number(a?.page || 0) - Number(b?.page || 0) || String(a?.id).localeCompare(String(b?.id)))
    : [];
  const verifiedCount = sourceObservations.filter((observation) => observation?.verification?.human_verified === true).length;
  return {
    sourceDocument,
    sourceObservations,
    sourceVerification: sourceObservations.length
      ? {
          verified: verifiedCount,
          total: sourceObservations.length,
          complete: verifiedCount === sourceObservations.length,
        }
      : null,
    sourceStatus: normalizeText(item?.source_status) || "source_link_not_recorded",
  };
}

function projectPathology(item, index, documents, observations) {
  const recordType = pathologyRecordType(item);
  const isPhotoInterpretation = recordType === "Попередня розшифровка фото-звіту";
  const receipt = explicitSourceReceipt(item, documents, observations);
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
    ...receipt,
    conclusionHeading: isPhotoInterpretation ? "Попередня розшифровка фото-звіту" : "Висновок у джерелі",
    boundary: isPhotoInterpretation
      ? "Потребує звірки з оригінальним звітом і тканиною; це не підтверджений висновок системи."
      : "Наведено як формулювання документа; робочі гіпотези системи показано окремо.",
  };
}

function projectImaging(item, index, documents, observations) {
  const receipt = explicitSourceReceipt(item, documents, observations);

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
    ...receipt,
  };
}

export function projectClinicalState(bundle) {
  const clinical = bundle?.clinical_state && typeof bundle.clinical_state === "object"
    ? bundle.clinical_state
    : {};
  const labColumns = buildLabColumns(clinical);
  return {
    labProjection: clinical.lab_projection || null,
    labColumns,
    labs: asArray(clinical.labs).map((lab) => projectLab(lab, labColumns)),
    markers: asArray(clinical.markers),
    pathology: asArray(clinical.pathology).map((item, index) => projectPathology(
      item,
      index,
      asArray(bundle?.source_documents),
      asArray(bundle?.observations),
    )),
    imaging: asArray(clinical.imaging).map((item, index) => projectImaging(
      item,
      index,
      asArray(bundle?.source_documents),
      asArray(bundle?.observations),
    )),
    panel: asArray(clinical.panel),
  };
}
