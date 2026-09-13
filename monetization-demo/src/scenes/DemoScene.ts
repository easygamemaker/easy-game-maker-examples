import {
  Scene, Group, RectShape, Text, type SceneParams, type App,
} from 'easy-game-maker';
import { AdManager, IAPManager } from 'easy-game-maker';

const W = 800, H = 600;

function btn(
  scene: Scene | Group, label: string, x: number, y: number,
  color: string, onClick: () => void,
): void {
  const bg = new RectShape({ x, y, width: 220, height: 48, fill: color });
  bg.anchorX = 0.5; bg.anchorY = 0.5;
  (scene as Scene).add(bg);
  const t = new Text({ text: label, x, y, fontSize: 14, color: '#fff' });
  t.anchorX = 0.5; t.anchorY = 0.5;
  (scene as Scene).add(t);

  (scene as Scene)['_app' as never] && void 0; // type shim
  const app: App = (scene as unknown as { _app: App })._app;
  app.input.on('pointerdown', (e: { x: number; y: number }) => {
    if (Math.abs(e.x - x) < 110 && Math.abs(e.y - y) < 24) onClick();
  });
}

export class DemoScene extends Scene {
  private _app!: App;
  private _ads!:  AdManager;
  private _iap!:  IAPManager;
  private _coins  = 250;
  private _adsOn  = true;
  private _statusText!: Text;
  private _coinsText!:  Text;

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app  = params?.['app'] as App;

    this._ads = new AdManager(this._app);
    this._iap = new IAPManager(this._app, [
      { id: 'remove_ads', type: 'nonConsumable', title: 'Remove Ads',    price: 1.99 },
      { id: 'coins_100',  type: 'consumable',    title: '100 Coins',     price: 0.99 },
      { id: 'coins_500',  type: 'consumable',    title: '500 Coins',     price: 3.99 },
      { id: 'pro_monthly',type: 'subscription',  title: 'Pro (monthly)', price: 2.99 },
    ]);
    await this._iap.init();

    this._build();
  }

  private _setStatus(msg: string, color = '#94a3b8'): void {
    if (this._statusText) {
      this._statusText.text  = msg;
      this._statusText.color = color;
    }
  }

  private _build(): void {
    // Background
    const bg = new RectShape({ x: 0, y: 0, width: W, height: H, fill: '#070d1a' });
    bg.anchorX = 0; bg.anchorY = 0;
    this.add(bg);

    // Grid lines
    for (let i = 1; i < 10; i++) {
      const v = new RectShape({ x: i * 80, y: 0, width: 1, height: H, fill: '#ffffff08' });
      v.anchorX = 0; v.anchorY = 0; this.add(v);
    }

    // Title
    const title = new Text({ text: 'EGM Monetization Demo', x: W / 2, y: 40, fontSize: 26, color: '#f1f5f9' });
    title.anchorX = 0.5; title.anchorY = 0.5; this.add(title);

    const sub = new Text({ text: 'Open simulator — click buttons to test Ads & IAP', x: W / 2, y: 68, fontSize: 12, color: '#475569' });
    sub.anchorX = 0.5; sub.anchorY = 0.5; this.add(sub);

    // Coins display
    this._coinsText = new Text({ text: `Coins: ${this._coins}`, x: W / 2, y: 108, fontSize: 18, color: '#f59e0b' });
    this._coinsText.anchorX = 0.5; this._coinsText.anchorY = 0.5; this.add(this._coinsText);

    // Status line
    this._statusText = new Text({ text: 'Ready', x: W / 2, y: 140, fontSize: 13, color: '#94a3b8' });
    this._statusText.anchorX = 0.5; this._statusText.anchorY = 0.5; this.add(this._statusText);

    // ── SECTION: Ads ──────────────────────────────────────────────────────────
    const adsLabel = new Text({ text: 'ADVERTISING  (AdMob)', x: 80, y: 188, fontSize: 11, color: '#3b82f6' });
    adsLabel.anchorX = 0; adsLabel.anchorY = 0.5; this.add(adsLabel);
    const adsDivider = new RectShape({ x: 0, y: 198, width: W, height: 1, fill: '#1e3a5f' });
    adsDivider.anchorX = 0; adsDivider.anchorY = 0; this.add(adsDivider);

    // Banner toggle
    this._app.input.on('pointerdown', (e: { x: number; y: number }) => {
      if (Math.abs(e.x - 200) < 110 && Math.abs(e.y - 232) < 24) {
        if (this._ads.isBannerVisible) { this._ads.hideBanner(); this._setStatus('Banner hidden.'); }
        else { this._ads.showBanner('bottom'); this._setStatus('Banner shown at bottom.', '#3b82f6'); }
      }
    });
    const bannerBg = new RectShape({ x: 200, y: 232, width: 220, height: 48, fill: '#1e3a5f' });
    bannerBg.anchorX = 0.5; bannerBg.anchorY = 0.5; this.add(bannerBg);
    const bannerT  = new Text({ text: 'Toggle Banner Ad', x: 200, y: 232, fontSize: 14, color: '#60a5fa' });
    bannerT.anchorX = 0.5; bannerT.anchorY = 0.5; this.add(bannerT);

    // Interstitial
    this._app.input.on('pointerdown', async (e: { x: number; y: number }) => {
      if (Math.abs(e.x - 500) < 110 && Math.abs(e.y - 232) < 24) {
        this._setStatus('Showing interstitial...', '#f59e0b');
        await this._ads.showInterstitial();
        this._setStatus('Interstitial dismissed.', '#4ade80');
      }
    });
    const intBg = new RectShape({ x: 500, y: 232, width: 220, height: 48, fill: '#1e3a5f' });
    intBg.anchorX = 0.5; intBg.anchorY = 0.5; this.add(intBg);
    const intT = new Text({ text: 'Show Interstitial', x: 500, y: 232, fontSize: 14, color: '#60a5fa' });
    intT.anchorX = 0.5; intT.anchorY = 0.5; this.add(intT);

    // Rewarded
    this._app.input.on('pointerdown', async (e: { x: number; y: number }) => {
      if (Math.abs(e.x - 350) < 110 && Math.abs(e.y - 296) < 24) {
        this._setStatus('Showing rewarded ad...', '#f59e0b');
        const result = await this._ads.showRewarded();
        if (result.earned) {
          this._coins += (result.amount ?? 50);
          this._coinsText.text = `Coins: ${this._coins}`;
          this._setStatus(`Reward earned! +${result.amount ?? 50} coins`, '#4ade80');
        } else {
          this._setStatus('Ad skipped — no reward.', '#ef4444');
        }
      }
    });
    const rwdBg = new RectShape({ x: 350, y: 296, width: 220, height: 48, fill: '#064e3b' });
    rwdBg.anchorX = 0.5; rwdBg.anchorY = 0.5; this.add(rwdBg);
    const rwdT = new Text({ text: 'Watch Rewarded Ad (+50 coins)', x: 350, y: 296, fontSize: 13, color: '#34d399' });
    rwdT.anchorX = 0.5; rwdT.anchorY = 0.5; this.add(rwdT);

    // ── SECTION: IAP ──────────────────────────────────────────────────────────
    const iapLabel = new Text({ text: 'IN-APP PURCHASES  (StoreKit / Play Billing)', x: 80, y: 356, fontSize: 11, color: '#10b981' });
    iapLabel.anchorX = 0; iapLabel.anchorY = 0.5; this.add(iapLabel);
    const iapDivider = new RectShape({ x: 0, y: 366, width: W, height: 1, fill: '#064e3b' });
    iapDivider.anchorX = 0; iapDivider.anchorY = 0; this.add(iapDivider);

    const iapItems = [
      { id: 'remove_ads', label: 'Remove Ads  $1.99',    x: 150 },
      { id: 'coins_100',  label: '100 Coins  $0.99',     x: 380 },
      { id: 'coins_500',  label: '500 Coins  $3.99',     x: 610 },
    ];

    iapItems.forEach(({ id, label, x }) => {
      this._app.input.on('pointerdown', async (e: { x: number; y: number }) => {
        if (Math.abs(e.x - x) < 100 && Math.abs(e.y - 404) < 24) {
          this._setStatus(`Purchasing ${id}...`, '#f59e0b');
          const result = await this._iap.purchase(id);
          if (result.success) {
            if (id === 'remove_ads') { this._adsOn = false; this._ads.hideBanner(); this._setStatus('Ads removed! Enjoy the game.', '#4ade80'); }
            else if (id === 'coins_100') { this._coins += 100; this._coinsText.text = `Coins: ${this._coins}`; this._setStatus('+100 coins added!', '#4ade80'); }
            else if (id === 'coins_500') { this._coins += 500; this._coinsText.text = `Coins: ${this._coins}`; this._setStatus('+500 coins added!', '#4ade80'); }
          } else {
            this._setStatus(`Cancelled: ${result.error}`, '#ef4444');
          }
        }
      });
      const ibg = new RectShape({ x, y: 404, width: 200, height: 48, fill: '#064e3b' });
      ibg.anchorX = 0.5; ibg.anchorY = 0.5; this.add(ibg);
      const it = new Text({ text: label, x, y: 404, fontSize: 13, color: '#34d399' });
      it.anchorX = 0.5; it.anchorY = 0.5; this.add(it);
    });

    // Subscription
    this._app.input.on('pointerdown', async (e: { x: number; y: number }) => {
      if (Math.abs(e.x - 350) < 140 && Math.abs(e.y - 466) < 24) {
        this._setStatus('Starting subscription...', '#f59e0b');
        const result = await this._iap.purchase('pro_monthly');
        this._setStatus(result.success ? 'Pro activated! $2.99/month' : `Cancelled: ${result.error}`, result.success ? '#4ade80' : '#ef4444');
      }
    });
    const subBg = new RectShape({ x: 350, y: 466, width: 280, height: 48, fill: '#1c1c3a' });
    subBg.anchorX = 0.5; subBg.anchorY = 0.5; this.add(subBg);
    const subT = new Text({ text: 'Subscribe: Pro Monthly  $2.99', x: 350, y: 466, fontSize: 13, color: '#a78bfa' });
    subT.anchorX = 0.5; subT.anchorY = 0.5; this.add(subT);

    // Restore
    this._app.input.on('pointerdown', async (e: { x: number; y: number }) => {
      if (Math.abs(e.x - 350) < 100 && Math.abs(e.y - 530) < 18) {
        this._setStatus('Restoring purchases...', '#f59e0b');
        const restored = await this._iap.restorePurchases();
        this._setStatus(restored.length ? `Restored: ${restored.join(', ')}` : 'Nothing to restore.', '#94a3b8');
      }
    });
    const restoreT = new Text({ text: 'Restore Purchases', x: 350, y: 530, fontSize: 13, color: '#6b7280' });
    restoreT.anchorX = 0.5; restoreT.anchorY = 0.5; this.add(restoreT);

    // Footer
    const footer = new Text({ text: 'All payments are simulated in the simulator. Real transactions require App Store / Play Store.', x: W / 2, y: 572, fontSize: 10, color: '#374151' });
    footer.anchorX = 0.5; footer.anchorY = 0.5; this.add(footer);
  }
}
