// Commands the model may propose, and the response schema built from them.
//
// SEAM FOR 5b-2: this hand-written list stands in for `schema.gen.json`, which
// will be generated from the v2 registry (v2/src/domain/exus/commands.ts,
// every CommandSpec with `aiExposed: true`) together with per-command argument
// schemas. Until then the list mirrors the aiExposed ids by hand and arguments
// are free name -> text pairs, read on the client by the same slot recognizers
// as a typed command or the form card. Replace AI_COMMANDS and
// buildResponseSchema() and nothing else has to change.
import { Type, type Schema } from '@google/genai';
import { MAX_ACTIONS } from './config';

export interface AiCommand {
  id: string;
  /** One line for the system prompt. */
  summary: string;
}

export const AI_COMMANDS: readonly AiCommand[] = [
  { id: 'today', summary: 'show today: points, limit, balance, tasks due' },
  { id: 'create-task', summary: 'create a task (text, due, size S/M/L)' },
  { id: 'complete-task', summary: 'mark an open task done' },
  { id: 'tasks', summary: 'list open tasks' },
  { id: 'edit-task', summary: 'change a task' },
  { id: 'delete-task', summary: 'delete a task' },
  { id: 'create-goal', summary: 'create a goal (points or money)' },
  { id: 'deposit-goal', summary: 'put money or points into a goal' },
  { id: 'goals', summary: 'list goals' },
  { id: 'edit-goal', summary: 'change a goal' },
  { id: 'delete-goal', summary: 'delete a goal' },
  { id: 'add-money', summary: 'record income in Money' },
  { id: 'remove-money', summary: 'record an expense in Money' },
  { id: 'balance', summary: 'show the Money balance' },
  { id: 'create-category', summary: 'create a Money category' },
  { id: 'delete-transaction', summary: 'delete a Money transaction' },
  { id: 'complete-chore', summary: 'log a done chore' },
  { id: 'chores', summary: 'list chores and unsettled points' },
  { id: 'settle-chores', summary: 'settle chore points into Money' },
  { id: 'log-activity', summary: 'log an activity for points' },
  { id: 'streak', summary: 'show the streak' },
  { id: 'stats', summary: 'show statistics' },
  { id: 'what-now', summary: 'suggest what to do next' },
  { id: 'create-note', summary: 'create a note' },
  { id: 'archive-note', summary: 'archive a note' },
  { id: 'find-note', summary: 'search notes' },
  { id: 'daily-limit', summary: 'show or change the daily points limit' },
  { id: 'go', summary: 'open a screen' },
  { id: 'lend', summary: 'record money lent to someone' },
  { id: 'borrow', summary: 'record money borrowed from someone' },
  { id: 'repay', summary: 'record a loan repayment' },
  { id: 'loans', summary: 'list loans' },
  { id: 'money-limit', summary: 'set the monthly spending limit' },
  { id: 'create-chore', summary: 'define a new chore' },
  { id: 'delete-chore', summary: 'delete a chore definition' },
  { id: 'delete-chore-entry', summary: 'delete a logged chore' },
  { id: 'delete-activity', summary: 'delete a logged activity' },
  { id: 'report-bug', summary: 'send a bug report' },
];

const ALLOWED = new Set(AI_COMMANDS.map((c) => c.id));

export function isAllowedCommand(id: string): boolean {
  return ALLOWED.has(id);
}

/**
 * Gemini structured output. Arguments are a list of {name, value} because the
 * schema dialect has no free-form object; output.ts turns them into an object.
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
                properties: { name: { type: Type.STRING }, value: { type: Type.STRING } },
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
