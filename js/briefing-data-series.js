// Data-driven slides store a small declarative filter, never executable SQL.
import { MAX_SLIDES, addSlide, createSlide, normalizeBriefing } from './briefing-document.js?v=0.70.4-sequence';
import { previewFilterSeries } from './briefing-series-preview.js?v=0.60.0-media1';
import { isDateField } from './briefing-timeline-dates.js?v=0.60.0-media1';
import { isYearField } from './briefing-timeline.js?v=0.60.0-media1';

export function seriesWhere(filter, fields) {
  if (!Array.isArray(fields) || !fields.some(f => f?.name === filter?.field) ||
      !/^[A-Za-z_][\w.]*$/.test(filter?.field || '')) throw new Error('This slide has an unsupported or unknown data filter.');
  if (filter.op === 'date-range' || filter.op === 'date-validity') {
    if (!fields.some(field => field.name === filter.field && isDateField(field)) || !Number.isSafeInteger(filter.start) || !Number.isSafeInteger(filter.end) || filter.start >= filter.end || filter.start < -59011459200000 || filter.end > 253402300800000) throw new Error('This slide has an invalid date range.');
    const literal = value => `TIMESTAMP '${new Date(value).toISOString().slice(0,19).replace('T',' ')}'`;
    if (filter.op === 'date-validity') {
      if (!fields.some(field => field.name === filter.endField && isDateField(field)) || filter.field === filter.endField) throw new Error('This slide needs a date end field.');
      return `(${filter.field} < ${literal(filter.end)} AND (${filter.endField} IS NULL OR ${filter.endField} > ${literal(filter.start)}))`;
    }
    return `(${filter.field} >= ${literal(filter.start)} AND ${filter.field} < ${literal(filter.end)})`;
  }
  if (filter.op === 'year-range' || filter.op === 'year-validity') {
    if (!fields.some(field => field.name === filter.field && isYearField(field))) throw new Error('This slide needs an integer year field.');
    if (!Number.isInteger(filter.start) || !Number.isInteger(filter.end) || filter.start < 0 || filter.end > 10000 || filter.start >= filter.end) throw new Error('This slide has an invalid year range.');
    if (filter.op === 'year-validity') {
      if (!fields.some(field => field.name === filter.endField && isYearField(field)) || filter.field === filter.endField) throw new Error('This slide needs an integer end-year field.');
      return `(${filter.field} < ${filter.end} AND (${filter.endField} IS NULL OR ${filter.endField} > ${filter.start}))`;
    }
    return `(${filter.field} >= ${filter.start} AND ${filter.field} < ${filter.end})`;
  }
  if (filter.op !== 'in' || !Array.isArray(filter.values) || filter.values.length !== 1) throw new Error('This slide has an unsupported data filter.');
  const value = filter.values[0];
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) throw new Error('This slide has an invalid filter value.');
  return `${filter.field} = ${typeof value === 'number' ? value : "'" + value.replaceAll("'", "''") + "'"}`;
}

export function generateFilterSeries({ briefing, field, fields, records, layerRef, camera, cameraPolicy = 'fit-features' } = {}) {
  if (!['fit-features', 'fixed'].includes(cameraPolicy)) throw new Error('Choose a supported map view policy.');
  const original = normalizeBriefing(briefing);
  if (!layerRef) throw new Error('The current layer cannot be identified for sharing.');
  const preview = previewFilterSeries({ field, fields, records, availableSlides: MAX_SLIDES - original.slides.length });
  if (!preview.subsets.length) throw new Error('No nonempty values were found in the loaded features.');
  if (preview.subsets.length > MAX_SLIDES - original.slides.length) throw new Error('There are more subsets than available slide slots; no slides were added.');
  let result = original;
  let group = null;
  const temporal = fields.some(item => item.name === field && isDateField(item));
  for (const subset of preview.subsets) {
    seriesWhere(subset.filter, fields);
    const slide = createSlide('map-narrative', { title: subset.title, camera });
    slide.dataView = { layer: layerRef, filter: subset.filter };
    group ||= slide.id;
    slide.generatedBy = { template: 'filter-series', version: 1, group, temporal, cameraPolicy };
    result = addSlide(result, slide);
  }
  return { briefing: result, preview };
}
