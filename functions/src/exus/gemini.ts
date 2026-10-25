// The real model: one generateContent call with structured JSON output.
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { MAX_OUTPUT_TOKENS, MODEL_NAME, THINKING_LEVEL } from './config';
import { parseJson, type ModelClient, type ModelRequest, type ModelResponse } from './model';

/** The one SDK method used; injectable so tests can see the exact request. */
export type GenerateContent = (params: GenerateContentParameters) => Promise<GenerateContentResponse>;

export class GeminiModelClient implements ModelClient {
  private readonly generateContent: GenerateContent;

  constructor(apiKey: string, generateContent?: GenerateContent) {
    if (generateContent) {
      this.generateContent = generateContent;
    } else {
      const ai = new GoogleGenAI({ apiKey });
      this.generateContent = (params) => ai.models.generateContent(params);
    }
  }

  async generate({ system, contents, schema }: ModelRequest): Promise<ModelResponse> {
    const response = await this.generateContent({
      model: MODEL_NAME,
      contents: contents.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseSchema: schema,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        candidateCount: 1,
        thinkingConfig: { thinkingLevel: THINKING_LEVEL },
      },
    });
    const text = response.text ?? '';
    return { text, json: parseJson(text), usage: { totalTokens: totalTokens(response) } };
  }
}

/** Everything billed for the call; thought tokens included when present. */
function totalTokens(response: GenerateContentResponse): number {
  const u = response.usageMetadata;
  if (!u) return 0;
  if (typeof u.totalTokenCount === 'number') return u.totalTokenCount;
  return (u.promptTokenCount ?? 0) + (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
}
