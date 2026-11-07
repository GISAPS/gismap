// The public facade delegates to the existing tool registry. It is not a second
// action store. Tools without schemas remain available through the legacy API.
import { describeAction } from './application-manifest.js?v=0.69.9-order';

export class ActionError extends Error {
  constructor(code, message) { super(message); this.name = 'ActionError'; this.code = code; }
  toJSON() { return { name: this.name, code: this.code, message: this.message }; }
}

// The supported schema vocabulary is intentionally bounded. Fail closed if a
// registered schema uses an unsupported assertion instead of bypassing it.
const supported = new Set(['type', 'required', 'properties', 'additionalProperties', 'enum', 'const', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'items', 'minItems', 'maxItems', 'description', 'title', '$schema', '$id', 'default']);
function validate(schema, value, path = 'input') {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new ActionError('UNSUPPORTED_SCHEMA', `Unsupported schema at ${path}.`);
  for (const key of Object.keys(schema)) if (!supported.has(key)) throw new ActionError('UNSUPPORTED_SCHEMA', `Unsupported schema keyword ${key} at ${path}.`);
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const types = schema.type === undefined ? [] : [].concat(schema.type);
  if (types.length && !types.some((type) => type === actual || (type === 'integer' && actual === 'number' && Number.isInteger(value)))) throw new ActionError('INVALID_INPUT', `${path} must be ${types.join(' or ')}.`);
  if (actual === 'number' && !Number.isFinite(value)) throw new ActionError('INVALID_INPUT', `${path} must be finite.`);
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) throw new ActionError('INVALID_INPUT', `${path} is not an allowed value.`);
  if (Object.hasOwn(schema, 'const') && !Object.is(schema.const, value)) throw new ActionError('INVALID_INPUT', `${path} has an invalid value.`);
  if (actual === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) throw new ActionError('INVALID_INPUT', `${path} is outside the allowed range.`);
  if (actual === 'string' && ((schema.minLength !== undefined && [...value].length < schema.minLength) || (schema.maxLength !== undefined && [...value].length > schema.maxLength) || (schema.pattern && !new RegExp(schema.pattern).test(value)))) throw new ActionError('INVALID_INPUT', `${path} has an invalid length or format.`);
  if (actual === 'array') {
    if ((schema.minItems !== undefined && value.length < schema.minItems) || (schema.maxItems !== undefined && value.length > schema.maxItems)) throw new ActionError('INVALID_INPUT', `${path} has an invalid length.`);
    if (schema.items) value.forEach((item, i) => validate(schema.items, item, `${path}[${i}]`));
  }
  if (actual === 'object') {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) throw new ActionError('INVALID_INPUT', `${path}.${key} is required.`);
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties || {}, key)) validate(schema.properties[key], item, `${path}.${key}`);
      else if (schema.additionalProperties === false) throw new ActionError('INVALID_INPUT', `${path}.${key} is not allowed.`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validate(schema.additionalProperties, item, `${path}.${key}`);
    }
  }
}

export function createActionsApi({ runtime, state }) {
  const find = (id) => runtime.tools.list().find((tool) => tool.id === id);
  return Object.freeze({
    list: () => runtime.tools.list().map(describeAction),
    describe: (id) => { const tool = find(id); return tool ? describeAction(tool) : null; },
    async execute(request) {
      if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some((key) => !['id', 'input', 'expectedRevision'].includes(key)) || typeof request.id !== 'string') throw new ActionError('INVALID_REQUEST', 'Provide an action id, input, and optional expectedRevision.');
      const tool = find(request.id);
      if (!tool) throw new ActionError('UNKNOWN_ACTION', `Unknown action: ${request.id}`);
      if (!tool.inputSchema) throw new ActionError('UNSUPPORTED_SCHEMA', 'This action does not yet declare an input schema.');
      if (request.expectedRevision !== undefined && (!Number.isInteger(request.expectedRevision) || request.expectedRevision < 0)) throw new ActionError('INVALID_REQUEST', 'expectedRevision must be a non-negative integer.');
      if (request.expectedRevision !== undefined && request.expectedRevision !== state.snapshot().revision) throw new ActionError('REVISION_CONFLICT', 'The public state changed; inspect it and retry.');
      const input = request.input === undefined ? {} : request.input;
      validate(tool.inputSchema, input);
      // Existing validators and execution remain authoritative. The returned
      // result may contain session data; execution is explicit and in-page.
      return runtime.runTool(request.id, input);
    },
  });
}
