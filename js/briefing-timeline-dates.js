// Calendar windows are constructed in the chosen IANA timezone and stored as UTC instants; ends are exclusive.
import { MAX_SLIDES } from './briefing-document.js?v=0.70.4-sequence';
const DAY = 86400000;
export const isDateField = field => Boolean(/^[A-Za-z_][\w.]*$/.test(field?.name || '') && /date|timestamp/i.test(field?.type || ''));
function dateInput(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Enter start and end dates as YYYY-MM-DD.');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value || +value.slice(0,4) < 100 || +value.slice(0,4) > 9998) throw new Error('Enter valid dates between years 0100 and 9998.');
  return time;
}
function advance(time, unit, amount) {
  if (unit === 'day' || unit === 'week') return time + DAY * amount * (unit === 'week' ? 7 : 1);
  const d = new Date(time), month = d.getUTCMonth() + amount * ({month:1,quarter:3,year:12}[unit]);
  const target = new Date(Date.UTC(d.getUTCFullYear(), month, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return target.getTime();
}

function zonedMidnight(civil, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
  const parts = instant => Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  const wanted = new Date(civil);
  let instant = civil;
  for (let i = 0; i < 5; i++) {
    const p = parts(instant);
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const delta = civil - represented;
    if (!delta) break;
    instant += delta;
  }
  const p = parts(instant);
  if (p.year !== wanted.getUTCFullYear() || p.month !== wanted.getUTCMonth()+1 || p.day !== wanted.getUTCDate() || p.hour !== 0 || p.minute !== 0) throw new Error('A calendar boundary does not exist at midnight in this timezone; choose another timezone or interval.');
  return instant;
}

function timeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && (/^\d{4}-\d{2}-\d{2}$/.test(value) || /(?:Z|[+-]\d{2}:\d{2})$/i.test(value))) return Date.parse(value);
  return NaN;
}
export function previewDateTimeline({field, endField = '', fields, records, start, end, step = 1, unit = 'year', mode = 'interval', rolling = 2, timeZone = 'UTC', availableSlides = MAX_SLIDES} = {}) {
  if (!fields?.some(item => item.name === field && isDateField(item))) throw new Error('Choose a date or timestamp field.');
  if (!Array.isArray(records)) throw new Error('Loaded features are unavailable.');
  if (!['day','week','month','quarter','year'].includes(unit)) throw new Error('Choose a supported calendar interval.');
  if (step === '' || !Number.isInteger(Number(step)) || Number(step) < 1 || Number(step) > 1000) throw new Error('Enter an interval between 1 and 1000.');
  if (!['interval','cumulative','rolling','validity'].includes(mode)) throw new Error('Choose a supported timeline mode.');
  if (mode === 'rolling' && (!Number.isInteger(Number(rolling)) || Number(rolling) < 1 || Number(rolling) > 1000)) throw new Error('Enter a positive rolling window.');
  if (mode === 'validity' && (!fields.some(item => item.name === endField && isDateField(item)) || field === endField)) throw new Error('Choose a separate date end field.');
  try { new Intl.DateTimeFormat('en', {timeZone}).format(); } catch { throw new Error('Enter a valid IANA timezone, such as UTC or America/Los_Angeles.'); }
  const first = dateInput(start), last = dateInput(end) + DAY;
  if (last <= first) throw new Error('End date must not precede the start date.');
  const bounds = [first];
  // Keep the original day anchor so Jan 31 -> Feb 28 -> Mar 31.
  for (let index = 1; bounds.at(-1) < last; index++) {
    if (index > MAX_SLIDES || index > Math.max(0, availableSlides)) throw new Error('The requested intervals exceed the available slide slots; no slides were added.');
    const next = advance(first, unit, index * Number(step));
    if (!Number.isFinite(next) || next <= bounds.at(-1)) throw new Error('The date interval is outside the supported range.');
    bounds.push(Math.min(next, last));
  }
  const raw = records.map(record => record?.attributes?.[field]);
  const missing = raw.filter(v => v == null || v === '').length;
  const invalid = raw.filter(v => v != null && v !== '' && !Number.isFinite(timeValue(v))).length;
  const frames = bounds.slice(0,-1).map((from,index) => {
    const to = bounds[index+1];
    const lowerCivil = mode === 'cumulative' ? first : mode === 'rolling' ? Math.max(first, advance(to,unit,-Number(rolling))) : from;
    const lower = zonedMidnight(lowerCivil, timeZone), upper = zonedMidnight(to, timeZone);
    const count = records.filter(record => {
      const begin = timeValue(record?.attributes?.[field]);
      const rawEnd = record?.attributes?.[endField];
      const finish = rawEnd == null ? Infinity : timeValue(rawEnd);
      return Number.isFinite(begin) && (mode === 'validity' ? begin < upper && finish > lower : begin >= lower && begin < upper);
    }).length;
    const label = `${new Date(mode === 'cumulative' || mode === 'rolling' ? lowerCivil : from).toISOString().slice(0,10)} – ${new Date(to-DAY).toISOString().slice(0,10)}`;
    return { title: `${label}${mode === 'cumulative' ? ' (cumulative)' : mode === 'rolling' ? ' (rolling)' : ''}`, count, filter:{op:mode === 'validity' ? 'date-validity' : 'date-range',field,...(mode === 'validity' ? {endField}:{}),start:lower,end:upper}, intervalStart:zonedMidnight(from,timeZone),intervalEnd:upper };
  });
  const warnings=[`Calendar intervals use ${timeZone}; filters store UTC instants. Counts use loaded, included features only; the complete source may differ.`,'Empty frames are retained. End dates of validity periods are exclusive; an empty end is ongoing.'];
  if (missing) warnings.push(`${missing} loaded features have missing dates.`);
  if (invalid) warnings.push(`${invalid} loaded features have invalid or timezone-ambiguous dates.`);
  // Date-only values are commonly stored as UTC midnight; local boundaries would shift day-1 events into the previous frame.
  const times = raw.map(timeValue).filter(Number.isFinite);
  if (timeZone !== 'UTC' && times.length && times.every(time => time % DAY === 0)) warnings.push(`Every loaded ${field} value is exactly midnight UTC, which usually means a date-only value. ${timeZone} boundaries would move events on the first day of a frame into the previous frame; use timeZone "UTC" for date-only data.`);
  return {frames,warnings,missing,invalid,recordCount:records.length};
}
