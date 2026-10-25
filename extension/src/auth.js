// Google sign-in -> Firebase Auth over REST (no SDK, zero dependencies).
// Flow: chrome.identity.launchWebAuthFlow (Google id_token) -> Identity Toolkit signInWithIdp
// -> idToken (1h) + refreshToken. The domain restriction is checked here AND in the Firestore rules.
import { CONFIG } from './config.js';
import { store } from './store.js';

const KEY = 'auth:session';
let mem = null;

function domainOk(email) {
  const d = (email || '').split('@')[1]?.toLowerCase();
  return CONFIG.ALLOWED_DOMAINS.includes(d);
}

function authErrorMsg(msg = '') {
  if (/did not approve|closed|cancel/i.test(msg)) return 'Sign-in cancelled.';
  if (/Only one web auth flow/i.test(msg)) return 'A sign-in window is already open. Finish or close it and try again.';
  if (/could not be loaded|Authorization page/i.test(msg)) return 'Google rejected the sign-in. Check the Client ID and redirect URI.';
  return msg || 'Sign-in failed';
}

function randomNonce() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function googleIdToken() {
  const redirect = chrome.identity.getRedirectURL(); // https://<extension-id>.chromiumapp.org/
  const nonce = randomNonce();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: CONFIG.GOOGLE_OAUTH_CLIENT_ID,
    response_type: 'id_token',
    redirect_uri: redirect,
    scope: 'openid email profile',
    nonce,
    prompt: 'select_account',
  }).toString();
  const res = await chrome.runtime.sendMessage({ type: 'risk-auth:flow', url: url.toString() });
  if (!res?.ok) throw new Error(authErrorMsg(res?.error));
  const back = res.back;
  const params = new URLSearchParams(new URL(back).hash.slice(1));
  if (params.get('error')) throw new Error(`Google: ${params.get('error')}`);
  const idt = params.get('id_token');
  if (!idt) throw new Error('Sign-in cancelled');
  return idt;
}

export async function signIn() {
  const idt = await googleIdToken();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${CONFIG.FIREBASE.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${idt}&providerId=google.com`,
      requestUri: chrome.identity.getRedirectURL(),
      returnSecureToken: true,
      returnIdpCredential: false,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Sign-in failed');
  if (!domainOk(j.email)) {
    await signOut();
    throw new Error(`Use your company e-mail (${CONFIG.ALLOWED_DOMAINS.map((d) => '@' + d).join(' or ')}).`);
  }
  mem = {
    email: j.email, name: j.displayName || j.email,
    idToken: j.idToken, refreshToken: j.refreshToken,
    exp: Date.now() + (Number(j.expiresIn) - 120) * 1000,
  };
  await store.set(KEY, mem);
  return mem;
}

export async function signOut() {
  mem = null;
  await store.remove(KEY);
}

export async function currentUser() {
  if (!mem) mem = await store.get(KEY);
  return mem ? { email: mem.email, name: mem.name } : null;
}

/** Valid idToken (auto-refreshes). */
export async function getIdToken() {
  if (!mem) mem = await store.get(KEY);
  if (!mem) throw new Error('Not authenticated');
  if (Date.now() < mem.exp) return mem.idToken;
  const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CONFIG.FIREBASE.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: mem.refreshToken }),
  });
  const j = await r.json();
  if (!r.ok) { await signOut(); throw new Error('Session expired, please sign in again'); }
  mem = { ...mem, idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + (Number(j.expires_in) - 120) * 1000 };
  await store.set(KEY, mem);
  return mem.idToken;
}
