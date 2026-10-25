// Which model a turn uses. The fake is chosen ONLY when the Functions emulator
// says so (it sets FUNCTIONS_EMULATOR=true; Cloud Functions never does), and
// the key is read only for the real client, so the emulator needs no secret.
import { createFakeModelClient, isFunctionsEmulator } from './fake';
import { GeminiModelClient } from './gemini';
import type { ModelClient } from './model';

export function selectModelClient(env: NodeJS.ProcessEnv, apiKey: () => string): ModelClient {
  if (isFunctionsEmulator(env)) return createFakeModelClient(env);
  return new GeminiModelClient(apiKey());
}
