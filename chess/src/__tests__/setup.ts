import { vi } from 'vitest';

// Silence fetch network calls during tests (asset loading, audio loading).
const mockResponse = {
  ok: false,
  status: 404,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  blob: () => Promise.resolve(new Blob()),
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
} as Response;

vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
  state: 'running',
  resume: vi.fn().mockResolvedValue(undefined),
  destination: {},
  createBufferSource: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
  createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn() })),
  decodeAudioData: vi.fn().mockResolvedValue({}),
  close: vi.fn(),
})));
