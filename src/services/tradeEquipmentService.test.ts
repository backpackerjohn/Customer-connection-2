import { describe, it, expect } from 'vitest';
import { isRetryableGeminiError, summarizeGeminiError } from './tradeEquipmentService';

const api503 = new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand. Please try again later.","status":"UNAVAILABLE"}}');

describe('isRetryableGeminiError', () => {
  it('retries on 503 / 429 / timeouts', () => {
    expect(isRetryableGeminiError(api503)).toBe(true);
    expect(isRetryableGeminiError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).toBe(true);
    expect(isRetryableGeminiError(new Error('The operation was aborted'))).toBe(true);
  });
  it('does not retry a bad request', () => {
    expect(isRetryableGeminiError(new Error('{"error":{"code":400,"message":"Invalid JSON payload","status":"INVALID_ARGUMENT"}}'))).toBe(false);
  });
});

describe('summarizeGeminiError', () => {
  it('turns the raw API error into one readable line', () => {
    expect(summarizeGeminiError(api503)).toBe('Gemini overloaded (503)');
    expect(summarizeGeminiError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).toMatch(/429/);
    expect(summarizeGeminiError(new Error('{"error":{"code":404,"message":"models/x is not found","status":"NOT_FOUND"}}'))).toBe('Gemini 404: models/x is not found');
    expect(summarizeGeminiError(new Error('signal timed out'))).toMatch(/in time/);
    expect(summarizeGeminiError(new Error('{"error":{"code":400,"message":"Invalid value at thinking_config","status":"INVALID_ARGUMENT"}}'))).toMatch(/400.*thinking_config/);
    expect(summarizeGeminiError('something odd')).toBe('something odd');
  });
});
