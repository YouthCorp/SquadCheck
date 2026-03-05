import Anthropic from '@anthropic-ai/sdk';
import { SIGNAL_CONFIG, SignalStage, SIGNAL_STAGES } from './signal-config';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export interface ClaudeClassificationResult {
  stage: SignalStage;
  recoveryScore: number;
  confidence: number;
}

const SYSTEM_PROMPT = `You are a football injury analyst. Given a news article snippet about a player,
classify whether it contains a positive return-from-injury signal.

Respond ONLY with a JSON object (no markdown, no explanation) in this exact format:
{
  "stage": "<one of: partial_training|full_training|available|expected_to_start|none>",
  "recoveryScore": <number 0.0-1.0>,
  "confidence": <number 0.0-1.0>
}

Stage meanings:
- partial_training: player doing light/individual training only
- full_training: player back in full squad training
- available: player confirmed fit/available for selection
- expected_to_start: player expected or confirmed to start the match
- none: no positive return signal found (negative news, unrelated, or ambiguous)

recoveryScore reflects how close the player is to playing (0=not returning, 1=definitely playing).
confidence reflects how certain you are about your classification.`;

/**
 * Classifies an article snippet using Claude API (Haiku model for cost efficiency).
 * Returns null if Claude cannot determine a signal or the stage is "none".
 */
export async function classifyWithClaude(
  snippet: string,
  playerName: string,
  teamName: string,
): Promise<ClaudeClassificationResult | null> {
  const client = getClient();

  const userMessage = `Player: ${playerName} (${teamName})

Article snippet:
"${snippet.slice(0, 400)}"

Does this article contain a positive injury return signal for this player?`;

  let rawText = '';
  try {
    const message = await client.messages.create({
      model: SIGNAL_CONFIG.claude.MODEL,
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = message.content[0];
    if (content.type !== 'text') return null;
    rawText = content.text.trim();

    // Strip markdown code fences if Claude wraps the JSON (e.g. ```json ... ```)
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = fenceMatch ? fenceMatch[1].trim() : rawText;

    const parsed = JSON.parse(jsonText) as {
      stage: string;
      recoveryScore: number;
      confidence: number;
    };

    // Validate stage value
    if (parsed.stage === 'none') return null;
    if (!SIGNAL_STAGES.includes(parsed.stage as SignalStage)) return null;

    // Validate numeric fields
    const recoveryScore = Math.max(0, Math.min(1, Number(parsed.recoveryScore)));
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence)));

    if (isNaN(recoveryScore) || isNaN(confidence)) return null;

    return {
      stage: parsed.stage as SignalStage,
      recoveryScore,
      confidence,
    };
  } catch (err) {
    console.warn('[ClaudeClassifier] Classification failed:', (err as Error).message, rawText);
    return null;
  }
}
