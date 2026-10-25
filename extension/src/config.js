// Central configuration — Risk Savings Tracker (portfolio demo)
// All brands, hosts and people in this repository are FICTIONAL.
// Firebase values are public project identifiers, not secrets; real protection
// lives in firebase/firestore.rules. Never commit a filled-in copy of this file.

export const CONFIG = {
  // 'demo' = local fictional data, no network | 'firebase' = production backend
  MODE: 'demo',

  FIREBASE: {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    projectId: 'YOUR_FIREBASE_PROJECT_ID',
  },
  // OAuth client ("Web application" type) from the same Google Cloud project
  GOOGLE_OAUTH_CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',

  ALLOWED_DOMAINS: ['example.com'],

  // Optional free CoinGecko demo key. Without it the public API is used.
  COINGECKO_DEMO_KEY: '',
};

// Each brand runs its own back office. The panel detects the brand from the host it is opened on.
// In the demo, back offices are simulated on *.localhost (see demo-site/).
export const BRANDS = [
  { id: 'kestrel', name: 'Kestrel Bet', short: 'KB', logo: 'assets/logos/kestrel.svg',
    colors: { primary: '#38BDF8', bg: '#0B1622', surface: '#132233', text: '#FFFFFF' },
    currencies: ['EUR'], hosts: ['kestrel.localhost'], active: true },
  { id: 'lynx', name: 'Lynx Casino', short: 'LX', logo: 'assets/logos/lynx.svg',
    colors: { primary: '#A78BFA', bg: '#140F22', surface: '#201833', text: '#FFFFFF' },
    currencies: ['BRL'], hosts: ['lynx.localhost'], active: true },
  { id: 'orca', name: 'Orca Slots', short: 'OS', logo: 'assets/logos/orca.svg',
    colors: { primary: '#2DD4BF', bg: '#08191A', surface: '#0F2828', text: '#FFFFFF' },
    currencies: ['BRL', 'EUR'], hosts: ['orca.localhost'], active: true },
  { id: 'vega', name: 'Vega Play', short: 'VP', logo: 'assets/logos/vega.svg',
    colors: { primary: '#FBBF24', bg: '#1A1408', surface: '#2A2010', text: '#FFFFFF' },
    currencies: ['BRL', 'EUR'], hosts: ['vega.localhost'], active: true },
  { id: 'nimbus', name: 'Nimbus Crypto', short: 'NC', logo: 'assets/logos/nimbus.svg',
    colors: { primary: '#F472B6', bg: '#1C0B16', surface: '#2B1222', text: '#FFFFFF' },
    currencies: ['CRYPTO'], hosts: ['nimbus.localhost'], active: true },
  { id: 'mosaic', name: 'Mosaic Games', short: 'MG', logo: 'assets/logos/mosaic.svg',
    colors: { primary: '#FB923C', bg: '#1A1009', surface: '#2A1A0F', text: '#FFFFFF' },
    currencies: ['BRL', 'EUR'], hosts: [], active: false }, // launching soon
];

export const REASONS = [
  { id: 'multi_acc', label: 'Multi-accounting', color: '#4F8EF7' },
  { id: 'ip_share', label: 'Shared IP', color: '#F5A524' },
  { id: 'bonus_abuser', label: 'Bonus abuse', color: '#A855F7' },
  { id: 'fraud', label: 'Fraudulent activity', color: '#EF4444' },
];

// Supported cryptocurrencies (id = CoinGecko identifier)
export const CRYPTOS = [
  { symbol: 'USDT', id: 'tether' },
  { symbol: 'USDC', id: 'usd-coin' },
  { symbol: 'BTC', id: 'bitcoin' },
  { symbol: 'ETH', id: 'ethereum' },
  { symbol: 'LTC', id: 'litecoin' },
  { symbol: 'TRX', id: 'tron' },
  { symbol: 'BNB', id: 'binancecoin' },
  { symbol: 'SOL', id: 'solana' },
  { symbol: 'XRP', id: 'ripple' },
  { symbol: 'DOGE', id: 'dogecoin' },
];

export const LOCALE = 'en-GB';

export const brandById = (id) => BRANDS.find((b) => b.id === id);
export const reasonById = (id) => REASONS.find((r) => r.id === id);
