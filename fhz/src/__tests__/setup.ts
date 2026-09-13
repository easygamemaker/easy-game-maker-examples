import { vi } from 'vitest';

// Silence network calls during tests (loadTexture, SoundManager all use fetch).
// Smoke tests verify that scenes don't crash — not that assets load successfully.
const mockResponse = {
  ok: false,
  status: 404,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  blob: () => Promise.resolve(new Blob()),
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
} as Response;

vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

// Suppress AudioContext-related errors in happy-dom
vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
  state: 'running',
  resume: vi.fn().mockResolvedValue(undefined),
  destination: {},
  createBufferSource: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
  createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn() })),
  decodeAudioData: vi.fn().mockResolvedValue({}),
  close: vi.fn(),
})));
