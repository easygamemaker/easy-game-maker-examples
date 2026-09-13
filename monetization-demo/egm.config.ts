import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: {
    name:      'Monetization Demo',
    version:   '1.0.0',
    bundleId:  'com.egm.monetization',
  },
  display: {
    width:           800,
    height:          600,
    orientation:     'landscape',
    backgroundColor: '#070d1a',
    scaling:         'fit',
  },

  // ── Monetization configuration ─────────────────────────────────────────────
  monetization: {
    admob: {
      // Replace with your real AdMob app IDs from https://admob.google.com/
      iosAppId:     'ca-app-pub-3940256099942544~1458002511',   // ← Google test ID
      androidAppId: 'ca-app-pub-3940256099942544~3347511713',   // ← Google test ID

      banner: {
        ios:     'ca-app-pub-3940256099942544/2934735716',
        android: 'ca-app-pub-3940256099942544/6300978111',
      },
      interstitial: {
        ios:     'ca-app-pub-3940256099942544/4411468910',
        android: 'ca-app-pub-3940256099942544/1033173712',
      },
      rewarded: {
        ios:     'ca-app-pub-3940256099942544/1712485313',
        android: 'ca-app-pub-3940256099942544/5224354917',
      },
    },

    iap: {
      products: [
        {
          id:          'remove_ads',
          type:        'nonConsumable',
          title:       'Remove Ads',
          description: 'Remove all ads permanently.',
          price:       1.99,
        },
        {
          id:          'coins_100',
          type:        'consumable',
          title:       '100 Coins',
          description: 'Add 100 coins to your wallet.',
          price:       0.99,
        },
        {
          id:          'coins_500',
          type:        'consumable',
          title:       '500 Coins',
          description: 'Add 500 coins — best value!',
          price:       3.99,
        },
        {
          id:          'pro_monthly',
          type:        'subscription',
          title:       'Pro Access (monthly)',
          description: 'Unlock all content every month.',
          price:       2.99,
        },
      ],
    },
  },
});
