// Integer-year timeline frames. Dates and timestamps need engine-specific date
// semantics and are intentionally not interpreted as years.
import { previewDateTimeline } from './briefing-timeline-dates.js?v=0.60.0-media1';
import { MAX_SLIDES, addSlide, createSlide, normalizeBriefing } from './briefing-document.js?v=0.70.4-sequence';

export function isYearField(field) {
  const type = String(field?.type || '').toLowerCase();
  return Boolean(/^[A-Za-z_][\w.]*$/.test(field?.name || "") && /integer|long|short/.test(type) && !/date|time/.test(type));
}

export function previewTimeline({ field, fields, records, start, end, step = 1, mode = 'interval', rolling = 2, endField = '', availableSlides = MAX_SLIDES } = {}) {
  if (!Array.isArray(fields) || !fields.some(item => item.name === field && isYearField(item))) throw new Error('Choose an integer year field from the current layer.');
  if (!Array.isArray(records)) throw new Error('Loaded features are unavailable.');
  if ([start, end, step].some(value => value === '' || value == null || !Number.isInteger(Number(value)))) throw new Error('Enter whole-number start, end, and interval years.');
  start = Number(start); end = Number(end); step = Number(step);
  if (start < 0 || end > 9999 || end < start || step < 1 || step > 10000) throw new Error('Choose years from 0 to 9999, with the end after the start and an interval of at least one year.');
  if (!['interval', 'cumulative', 'rolling', 'validity'].includes(mode)) throw new Error('Choose a supported timeline mode.');
  if (mode === 'rolling' && (!Number.isInteger(Number(rolling)) || Number(rolling) < 1 || Number(rolling) > 10000)) throw new Error('Enter a positive rolling window in years.');
  if (mode === 'validity' && (!fields.some(item => item.name === endField && isYearField(item)) || endField === field)) throw new Error('Choose a separate integer end-year field.');
  const count = Math.ceil((end - start + 1) / step);
  if (count > MAX_SLIDES || count > Math.max(0, availableSlides)) throw new Error(`${count} frames exceed the ${Math.max(0, availableSlides)} available slide slots; no slides were added.`);
  const years = records.map(record => record?.attributes?.[field]);
  const missing = years.filter(value => value == null || value === '').length;
  const invalid = years.filter(value => value != null && value !== '' && (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 9999)).length;
  const frames = Array.from({length:count}, (_, index) => {
    const from = start + index * step, to = Math.min(from + step, end + 1);
    const lower = mode === 'cumulative' ? start : mode === 'rolling' ? Math.max(start, to - Number(rolling)) : from;
    const matching = records.filter(record => {
      const year = record?.attributes?.[field], finish = record?.attributes?.[endField];
      if (typeof year !== 'number' || !Number.isInteger(year)) return false;
      return mode === 'validity' ? year < to && (finish == null || (typeof finish === 'number' && Number.isInteger(finish) && finish > lower)) : year >= lower && year < to;
    }).length;
    const label = from === to - 1 ? String(from) : `${from}–${to - 1}`;
    return { title: mode === 'cumulative' ? `${start}–${to - 1} (cumulative)` : mode === 'rolling' ? `${lower}–${to - 1} (rolling)` : label, count:matching, filter:mode === 'validity' ? {op:'year-validity', field, endField, start:lower, end:to} : {op:'year-range', field, start:lower, end:to}, intervalStart:from, intervalEnd:to };
  });
  const warnings = ['Counts are from loaded, included features only; the full dataset may differ.', 'Empty frames are retained so the timeline has no gaps.'];
  if (missing) warnings.push(`${missing} loaded features have missing years.`);
  if (invalid) warnings.push(`${invalid} loaded features have invalid or non-numeric years.`);
  return {frames, warnings, missing, invalid, recordCount:records.length};
}

export function generateTimeline({briefing, layerRef, camera, ...options} = {}) {
  const cameraPolicy = options.cameraPolicy ?? 'fit-features';
  if (!['fit-features', 'fixed'].includes(cameraPolicy)) throw new Error('Choose a supported map view policy.');
  const original = normalizeBriefing(briefing);
  if (!layerRef) throw new Error('The current layer cannot be identified for sharing.');
  if (!camera) throw new Error('A map view is needed before generating timeline slides.');
  const single = options.presentationMode === 'single-slide';
  if (original.slides.length >= MAX_SLIDES) throw new Error('No slide slots are available.');
  const preview = (options.kind === 'date' ? previewDateTimeline : previewTimeline)({...options, availableSlides: single ? MAX_SLIDES : MAX_SLIDES - original.slides.length});
  if (options.stat && (!['sum','average','min','max'].includes(options.stat) || !options.statField || !options.fields?.some(field => field.name === options.statField && /integer|long|short|double|single|float|number/i.test(field.type || '')))) throw new Error('Choose a numeric field for the selected statistic.');
  const descriptions = preview.frames.map((frame, index) => {
    if (!options.narration) return '';
    const difference = index ? frame.count - preview.frames[index - 1].count : null;
    return `Draft based on loaded features: ${frame.count} ${frame.count === 1 ? 'feature' : 'features'} in this frame.${difference == null ? '' : ` ${difference === 0 ? 'No change' : `${Math.abs(difference)} ${difference > 0 ? 'more' : 'fewer'} features`} than the previous frame.`} Verify against the complete source.`;
  });
  const addStatistic = slide => {
    if (options.stat) slide.blocks.push({id:`${slide.id}-measure`, type:'stat', stat:options.stat, field:options.statField, queryRef:null, label:`${options.stat} · ${options.statField}`});
  };
  if (single) {
    const slide = createSlide('map-narrative', {title:`Timeline · ${options.field}`, camera});
    slide.dataView = {layer:layerRef, filter:preview.frames[0].filter};
    slide.blocks.push({id:`${slide.id}-count`, type:'stat', stat:'count', field:null, queryRef:null, label:'Features'});
    addStatistic(slide);
    slide.timeline = {version:1, frames:preview.frames.map((frame,index) => ({title:frame.title, filter:frame.filter, ...(descriptions[index] ? {narrative:descriptions[index]} : {})}))};
    slide.generatedBy = {template:'timeline', version:1, group:slide.id, cameraPolicy, mode:options.mode || 'interval'};
    return {briefing:addSlide(original,slide), preview};
  }
  let result = original;
  let group = null;
  for (const [index, frame] of preview.frames.entries()) {
    const slide = createSlide('map-narrative', {title:frame.title, camera});
    slide.dataView = {layer:layerRef, filter:frame.filter};
    slide.blocks.push({id:`${slide.id}-count`, type:'stat', stat:'count', field:null, queryRef:null, label:'Features'});
    addStatistic(slide);
    if (descriptions[index]) slide.blocks.find(block => block.type === 'text').markdown = descriptions[index];
    group ||= slide.id;
    slide.generatedBy = {template:'timeline', version:1, group, cameraPolicy, intervalStart:frame.intervalStart, intervalEnd:frame.intervalEnd, mode:options.mode || 'interval'};
    result = addSlide(result, slide);
  }
  return {briefing:result, preview};
}
