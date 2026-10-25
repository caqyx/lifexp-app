// Commands the model may propose, read from schema.gen.json, and what is built
// from them: the Gemini response schema and the command list of the prompt.
//
// schema.gen.json is GENERATED from the v2 registry (every CommandSpec with
// `aiExposed: true`, its i18n description and slots, plus the AI-only
// `edit-pending`) by v2/tools/exus-schema.ts. Never edit it by hand:
//   npm run gen:exus-schema --prefix v2
// `npm run check --prefix v2` fails when it is stale.
import { Type, type Schema } from '@google/genai';
import { MAX_ACTIONS } from './config';
import schemaJson from './schema.gen.json';

export interface SchemaSlot {
  name: string;
  type: 'text' | 'entity' | 'date' | 'duration' | 'money' | 'points' | 'number' | 'enum' | 'flag' | 'ref';
  required: boolean;
  choices?: string[];
  keys?: string[];
  raw?: boolean;
  pattern?: string;
}

export interface SchemaCommand {
  id: string;
  description: string;
  risk: 'read' | 'write' | 'destructive';
  slots: SchemaSlot[];
  /** edit-pending only: also takes the slots of the pending card's command. */
  pendingSlots?: boolean;
}

export const EDIT_PENDING = 'edit-pending';

export const AI_COMMANDS: readonly SchemaCommand[] = (schemaJson as { commands: SchemaCommand[] }).commands;

const BY_ID = new Map(AI_COMMANDS.map((c) => [c.id, c]));

export function commandSpec(id: string): SchemaCommand | undefined {
  return BY_ID.get(id);
}

export function isAllowedCommand(id: string): boolean {
  return BY_ID.has(id);
}

/** Every slot name of every command: the only argument names the model may write. */
export const ARG_NAMES: readonly string[] = [...new Set(AI_COMMANDS.flatMap((c) => c.slots.map((s) => s.name)))].sort();

/**
 * Gemini structured output. Arguments are a list of {name, value} because the
 * schema dialect has no free-form object; which names fit which command is
 * told by the prompt and checked by args.ts.
 */
export function buildResponseSchema(): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      reply: { type: Type.STRING },
      actions: {
        type: Type.ARRAY,
        maxItems: String(MAX_ACTIONS),
        items: {
          type: Type.OBJECT,
          properties: {
            command: { type: Type.STRING, format: 'enum', enum: AI_COMMANDS.map((c) => c.id) },
            args: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, format: 'enum', enum: [...ARG_NAMES] },
                  value: { type: Type.STRING },
                },
                required: ['name', 'value'],
              },
            },
          },
          required: ['command', 'args'],
        },
      },
    },
    required: ['reply', 'actions'],
    propertyOrdering: ['reply', 'actions'],
  };
}

function describeSlot(s: SchemaSlot): string {
  const kind = s.choices ? s.choices.join('|') : s.type === 'flag' ? 'true|false' : s.pattern ? s.pattern : s.type;
  return `${s.name} (${kind}${s.required ? ', required' : ''})`;
}

/** One line per command for the system prompt. */
export function describeCommands(): string {
  return AI_COMMANDS.map((c) => {
    const args = c.slots.length ? ` args: ${c.slots.map(describeSlot).join(', ')}` : ' no args';
    const pending = c.pendingSlots ? ' + the fields to change, named as in the pending card\'s command' : '';
    return `- ${c.id} [${c.risk}]: ${c.description}.${args}${pending}`;
  }).join('\n');
}
