import type { App, PointerEvent2D } from 'easy-game-maker';

export class SoundManager {
  private readonly _app: App;
  private _bgKey: string | null = null;
  private readonly _loaded = new Set<string>();
  private _gestureReceived = false;
  private readonly _pendingPlay: Array<() => void> = [];

  constructor(app: App) {
    this._app = app;
    this._checkAudioState();
  }

  private _audioCtx(): AudioContext | null {
    return (this._app.audio as unknown as { ctx: AudioContext | null }).ctx;
  }

  private _checkAudioState(): void {
    const ctx = this._audioCtx();
    if (!ctx || ctx.state === 'running') {
      this._gestureReceived = true;
      return;
    }
    // Wait for first user gesture to unlock AudioContext
    this._app.input.once<PointerEvent2D>('pointerdown', () => {
      void ctx.resume().then(() => {
        this._gestureReceived = true;
        const pending = this._pendingPlay.splice(0);
        for (const fn of pending) fn();
      });
    });
  }

  private async _ensure(path: string): Promise<boolean> {
    if (this._loaded.has(path)) return true;
    try {
      const res = await fetch(path);
      if (!res.ok) return false;
      const buf = await res.arrayBuffer();
      await this._app.audio.loadBuffer(path, buf);
      this._loaded.add(path);
      return true;
    } catch { return false; }
  }

  private _doPlay(path: string, opts: { loop?: boolean; volume?: number }): void {
    // Re-check state at play time — context might have become running between construction and here
    if (!this._gestureReceived) {
      const ctx = this._audioCtx();
      if (ctx?.state === 'running') this._gestureReceived = true;
    }

    const play = () => this._app.audio.play(path, opts);
    if (this._gestureReceived) {
      play();
    } else {
      this._pendingPlay.push(play);
    }
  }

  playMusic(path: string): void {
    if (this._bgKey === path) return;
    this.stopMusic();
    this._bgKey = path;
    void this._ensure(path).then((ok) => {
      if (!ok || this._bgKey !== path) return;
      this._doPlay(path, { loop: true, volume: 0.4 });
    });
  }

  stopMusic(): void {
    if (this._bgKey) {
      this._app.audio.stop(this._bgKey);
      this._bgKey = null;
    }
  }

  play(path: string, volume = 0.8): void {
    void this._ensure(path).then((ok) => {
      if (ok) this._doPlay(path, { volume });
    });
  }

  pullCatapult(): void    { this.play('assets/audio/geral/puxando.ogg', 0.7); }
  releaseCatapult(): void { this.play('assets/audio/geral/soltar.ogg', 0.7); }
  collision(): void       { this.play('assets/audio/geral/colisao.ogg', 0.8); }
  success(): void         { this.play('assets/audio/geral/sucesso.ogg'); }
  failed(): void          { this.play('assets/audio/geral/falhou.ogg'); }
  special(): void         { this.play('assets/audio/geral/especial.ogg'); }
  zombie(): void          { this.play('assets/audio/geral/zumbi-correndo.ogg', 0.5); }
  button(): void          { this.play('assets/audio/geral/botao.ogg', 0.6); }
}
