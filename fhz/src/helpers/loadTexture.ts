import type { WebGLRenderer, Texture } from 'easy-game-maker';

const _cache = new Map<string, Promise<Texture>>();

export async function loadTexture(renderer: WebGLRenderer, url: string): Promise<Texture> {
  const cached = _cache.get(url);
  if (cached) return cached;

  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load texture: ${url}`);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    return renderer.uploadTexture(url, bitmap);
  })();

  _cache.set(url, promise);
  return promise;
}

export function clearTextureCache(): void {
  _cache.clear();
}
