// The model behind exusTurn, as small as the handler needs. The real client is
// gemini.ts; fake.ts exists for the Functions emulator only (select.ts).
import type { Schema } from '@google/genai';

export interface ModelTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ModelRequest {
  system: string;
  contents: ModelTurn[];
  schema: Schema;
}

export interface ModelResponse {
  /** Raw text of the answer (never sent to the client as is). */
  text: string;
  /** `text` parsed as JSON, or undefined when it is not JSON. */
  json: unknown;
  usage: { totalTokens: number };
}

export interface ModelClient {
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
