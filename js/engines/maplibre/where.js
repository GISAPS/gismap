// Attribute filters for data held in the browser. GISMap Online filters are SQL
// where clauses (the ArcGIS REST vocabulary: STATE = 'CA' AND POP > 1000);
// services evaluate them for ArcGIS layers, and this module evaluates the same
// clauses against GeoJSON properties for engines that draw data themselves.
// Pure: no DOM, no map SDK.
import { GisMapError } from "../../gismap-errors.js?v=0.54.0-print";

const KEYWORDS = new Set(["AND", "OR", "NOT", "IS", "NULL", "LIKE", "IN", "BETWEEN", "TRUE", "FALSE", "DATE", "TIMESTAMP"]);
const FUNCTIONS = { UPPER: (value) => (value == null ? value : String(value).toUpperCase()), LOWER: (value) => (value == null ? value : String(value).toLowerCase()) };

function invalid(where, message) {
  return new GisMapError("INVALID_SPEC", `The filter “${where}” could not be read: ${message}.`, { details: { where } });
}

function tokenize(where) {
  const tokens = [];
  const text = String(where);
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if (char === "'") {
      let value = "";
      index += 1;
      for (;;) {
        if (index >= text.length) throw invalid(where, "a quoted value is not closed");
        if (text[index] === "'" && text[index + 1] === "'") { value += "'"; index += 2; continue; }
        if (text[index] === "'") { index += 1; break; }
        value += text[index];
        index += 1;
      }
      tokens.push({ type: "string", value });
      continue;
    }
    if (char === '"' || char === "[") {
      const close = char === '"' ? '"' : "]";
      const end = text.indexOf(close, index + 1);
      if (end < 0) throw invalid(where, "a quoted field name is not closed");
      tokens.push({ type: "field", value: text.slice(index + 1, end) });
      index = end + 1;
      continue;
    }
    const number = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(text.slice(index));
    const previous = tokens.at(-1);
    if (number && (char !== "-" || !previous || previous.type === "op" || previous.type === "(" || previous.type === ",")) {
      tokens.push({ type: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const op = /^(?:<>|!=|<=|>=|=|<|>)/.exec(text.slice(index));
    if (op) { tokens.push({ type: "op", value: op[0] === "!=" ? "<>" : op[0] }); index += op[0].length; continue; }
    if ("(),".includes(char)) { tokens.push({ type: char }); index += 1; continue; }
    const word = /^[A-Za-z_][\w.]*/.exec(text.slice(index));
    if (word) {
      const upper = word[0].toUpperCase();
      tokens.push(KEYWORDS.has(upper) ? { type: "keyword", value: upper } : { type: "word", value: word[0] });
      index += word[0].length;
      continue;
    }
    throw invalid(where, `unexpected “${char}”`);
  }
  return tokens;
}

function likePattern(pattern) {
  const source = String(pattern).replace(/[.*+?^${}()|\\]/g, "\\$&").replaceAll("%", ".*").replaceAll("_", ".");
  return new RegExp(`^${source}$`, "is");
}

function compare(left, op, right) {
  if (left == null || right == null) return false;
  const numeric = typeof left === "number" || typeof right === "number" || left instanceof Date || right instanceof Date;
  // Date literals compile to UTC milliseconds. GeoJSON commonly stores ISO
  // strings; compare those to a date literal as dates, not numeric strings.
  const asNumber = (value, other) => typeof value === 'string' && other instanceof Date && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value) ? Date.parse(value) : Number(value);
  const a = numeric ? asNumber(left, right) : String(left);
  const b = numeric ? asNumber(right, left) : String(right);
  if (numeric && (Number.isNaN(a) || Number.isNaN(b))) return false;
  switch (op) {
    case "=": return a === b;
    case "<>": return a !== b;
    case "<": return a < b;
    case "<=": return a <= b;
    case ">": return a > b;
    case ">=": return a >= b;
    default: return false;
  }
}

/**
 * Compiles a where clause to (properties) => boolean. Empty, null and "1=1"
 * match everything. Field names match case-insensitively, as services do.
 * Throws GisMapError("INVALID_SPEC") for clauses it cannot read.
 */
export function compileWhere(where) {
  const text = String(where ?? "").trim();
  if (!text || /^1\s*=\s*1$/.test(text)) return () => true;
  const tokens = tokenize(text);
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];
  const isKeyword = (value) => peek()?.type === "keyword" && peek().value === value;
  const expect = (type, value) => {
    const token = next();
    if (!token || token.type !== type || (value && token.value !== value)) throw invalid(text, `expected ${value || type}`);
    return token;
  };

  const fieldGetter = (name) => {
    const lower = name.toLowerCase();
    return (properties) => {
      if (name in properties) return properties[name];
      const key = Object.keys(properties).find((candidate) => candidate.toLowerCase() === lower);
      return key === undefined ? null : properties[key];
    };
  };

  function operand() {
    const token = next();
    if (!token) throw invalid(text, "it ends too soon");
    if (token.type === "number" || token.type === "string") return () => token.value;
    if (token.type === "field") return fieldGetter(token.value);
    if (token.type === "keyword" && (token.value === "TRUE" || token.value === "FALSE")) return () => token.value === "TRUE";
    if (token.type === "keyword" && (token.value === "DATE" || token.value === "TIMESTAMP")) {
      const literal = expect("string").value;
      const time = Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(literal) ? literal.replace(" ", "T") + "Z" : literal);
      if (Number.isNaN(time)) throw invalid(text, `“${literal}” is not a date`);
      return () => new Date(time);
    }
    if (token.type === "word") {
      const fn = FUNCTIONS[token.value.toUpperCase()];
      if (fn && peek()?.type === "(") {
        next();
        const inner = operand();
        expect(")");
        return (properties) => fn(inner(properties));
      }
      return fieldGetter(token.value);
    }
    if (token.type === "(") {
      const inner = operand();
      expect(")");
      return inner;
    }
    throw invalid(text, "a value or field name is missing");
  }

  function comparison() {
    if (peek()?.type === "(") {
      // A parenthesised condition, unless it is a parenthesised value: try the condition first.
      const start = position;
      next();
      try {
        const inner = or();
        expect(")");
        return inner;
      } catch {
        position = start;
      }
    }
    const left = operand();
    if (isKeyword("IS")) {
      next();
      const negate = isKeyword("NOT") ? (next(), true) : false;
      expect("keyword", "NULL");
      return (properties) => (left(properties) == null) !== negate;
    }
    const negate = isKeyword("NOT") ? (next(), true) : false;
    if (isKeyword("LIKE")) {
      next();
      const pattern = operand();
      return (properties) => {
        const value = left(properties);
        if (value == null) return false;
        return likePattern(pattern(properties)).test(String(value)) !== negate;
      };
    }
    if (isKeyword("IN")) {
      next();
      expect("(");
      const values = [operand()];
      while (peek()?.type === ",") { next(); values.push(operand()); }
      expect(")");
      return (properties) => {
        const value = left(properties);
        if (value == null) return false;
        return values.some((item) => compare(value, "=", item(properties))) !== negate;
      };
    }
    if (isKeyword("BETWEEN")) {
      next();
      const low = operand();
      expect("keyword", "AND");
      const high = operand();
      return (properties) => {
        const value = left(properties);
        if (value == null) return false;
        return (compare(value, ">=", low(properties)) && compare(value, "<=", high(properties))) !== negate;
      };
    }
    if (negate) throw invalid(text, "NOT must come before LIKE, IN or BETWEEN here");
    const op = expect("op").value;
    const right = operand();
    return (properties) => compare(left(properties), op, right(properties));
  }

  function not() {
    if (isKeyword("NOT")) {
      next();
      const inner = not();
      return (properties) => !inner(properties);
    }
    return comparison();
  }

  function and() {
    let left = not();
    while (isKeyword("AND")) {
      next();
      const right = not();
      const previous = left;
      left = (properties) => previous(properties) && right(properties);
    }
    return left;
  }

  function or() {
    let left = and();
    while (isKeyword("OR")) {
      next();
      const right = and();
      const previous = left;
      left = (properties) => previous(properties) || right(properties);
    }
    return left;
  }

  const predicate = or();
  if (position < tokens.length) throw invalid(text, `unexpected “${tokens[position].value ?? tokens[position].type}”`);
  return (properties) => predicate(properties || {});
}
