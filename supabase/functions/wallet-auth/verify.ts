// ============================================================================
// Crypto.ssr — wallet signature verification (used by wallet-auth/index.ts)
//
// Plain wallets (MetaMask, Trust, recovery-phrase accounts) sign with ECDSA and
// are checked locally with ecrecover — no network, ~ms.
//
// Smart-contract wallets — Coinbase Wallet's passkey "smart wallet" and
// EIP-7702-upgraded accounts — return an ERC-1271 / ERC-6492 signature (640+
// bytes) that can only be checked with an eth_call on the chain the wallet
// signed on (Coinbase Smart Wallet binds signatures to block.chainid). That
// path trusts RPC answers, so it is limited to an allow-list of chains and only
// accepted when QUORUM independent RPC providers agree; one bad or compromised
// provider can never log anyone in.
// ============================================================================
// esm.sh (not npm:) keeps the deployed bundle well under Supabase's 5 MB limit.
import { createPublicClient, http, isAddressEqual, isHex, recoverMessageAddress } from 'https://esm.sh/viem@2.56.7';
import type { Address, Chain, Hex, PublicClient } from 'https://esm.sh/viem@2.56.7';
import { base, mainnet } from 'https://esm.sh/viem@2.56.7/chains';

export const CONTRACT_CHAINS = [8453, 1];        // Base, Ethereum — the allow-list is the attack surface
export const QUORUM = 2;                          // distinct providers that must agree
const RPC_TIMEOUT_MS = 5_000;
const CONTRACT_DEADLINE_MS = 12_000;
const HEALTH_TTL_MS = 30_000;
const MAX_SIG_HEX = 2 + 2 * 8192;                 // 8 KiB cap (real smart-wallet sigs: 640–1088 bytes)

// Optional keyed endpoint per chain (Supabase secret), tried alongside the public ones.
// Use a provider that is NOT already in the list below, or it gets two votes.
const secretUrl = (k: string) => { const v = (Deno.env.get(k) || '').trim(); return v.startsWith('https://') ? [v] : []; };

// One client per provider (no fallback transport), so each answer is an independent vote.
// Every URL is a different operator, all checked to answer the ERC-6492 eth_call (2026-10).
const ENDPOINTS: Record<number, { chain: Chain; urls: string[] }> = {
  8453: { chain: base, urls: [...secretUrl('BASE_RPC_URL'),
    'https://mainnet.base.org', 'https://base-rpc.publicnode.com', 'https://base.drpc.org',
    'https://base-mainnet.public.blastapi.io', 'https://base-public.nodies.app', 'https://base.gateway.tenderly.co'] },
  1: { chain: mainnet, urls: [...secretUrl('ETH_RPC_URL'),
    'https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org', 'https://eth-mainnet.public.blastapi.io', 'https://1rpc.io/eth'] },
};
const CLIENTS: Record<number, PublicClient[]> = Object.fromEntries(CONTRACT_CHAINS.map((id) => [id,
  ENDPOINTS[id].urls.map((url) => createPublicClient({ chain: ENDPOINTS[id].chain, transport: http(url, { timeout: RPC_TIMEOUT_MS, retryCount: 0 }) }) as PublicClient),
]));

export type Verdict =
  | { ok: true; via: 'ecdsa' }
  | { ok: true; via: 'contract'; chainId: number }
  | { ok: false; reason: 'bad_signature' | 'wrong_chain' | 'rpc_unavailable' };
type Args = { address: Address; message: string; signature: Hex };

export const parseChainId = (v: unknown): number | undefined => {
  const n = typeof v === 'string' && /^0x/i.test(v) ? parseInt(v, 16) : Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

export const sigShapeOk = (s: unknown): s is Hex =>
  typeof s === 'string' && isHex(s) && s.length % 2 === 0 && s.length >= 132 && s.length <= MAX_SIG_HEX;

// Signatures longer than 65 bytes can only come from a contract wallet.
export const isContractShaped = (s: string) => s.length > 132;

async function ecdsaOk(address: Address, message: string, signature: Hex): Promise<boolean> {
  try { return isAddressEqual(await recoverMessageAddress({ message, signature }), address); } catch { return false; }
}

// viem's http timeout stops at the response headers; bound every RPC call end to end.
function within<T>(p: Promise<T>, ms = RPC_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expire = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('rpc timeout')), ms); });
  return Promise.race([p, expire]).finally(() => clearTimeout(timer));
}

// Ask every client at once. Resolves ok as soon as `have` + new yes votes reach QUORUM,
// and not-ok as soon as the votes still out can no longer get there (so one slow
// provider doesn't hold up a decided answer). `rest` = clients that did not say yes;
// it is complete whenever yes > 0 and the result is not-ok.
// Errors and timeouts count as "no", so silence never counts as a yes.
function votes(clients: PublicClient[], ask: (c: PublicClient) => Promise<boolean>, have = 0): Promise<{ ok: boolean; yes: number; rest: PublicClient[] }> {
  return new Promise((resolve) => {
    let yes = have, pending = clients.length;
    const rest: PublicClient[] = [];
    if (yes >= QUORUM || yes + pending < QUORUM) return resolve({ ok: yes >= QUORUM, yes, rest });
    for (const client of clients) {
      within(ask(client)).then((v) => v === true, () => false).then((v) => {
        pending--;
        if (v) yes++; else rest.push(client);
        if (yes >= QUORUM) resolve({ ok: true, yes, rest });
        else if (yes + pending < QUORUM) resolve({ ok: false, yes, rest });
      });
    }
  });
}

// QUORUM providers vouch for the signature on chain `id`. viem reports RPC failures as
// `false`, and a cold or rate-limited endpoint answers `false` too — so when providers
// disagree, ask only the dissenters once more. Votes still come from distinct providers.
async function signatureOn(id: number, args: Args): Promise<boolean> {
  const ask = (c: PublicClient) => c.verifyMessage(args);
  let r = await votes(CLIENTS[id], ask);
  if (!r.ok && r.yes > 0) r = await votes(r.rest, ask, r.yes);
  return r.ok;
}

// QUORUM providers see contract code (or an EIP-7702 delegation) at `address` on chain `id`.
const deployedOn = async (id: number, address: Address) =>
  (await votes(CLIENTS[id], (c) => c.getCode({ address }).then((code) => !!code && code !== '0x'))).ok;

// The first allow-listed chain the contract signature verifies on; 'wrong_chain' if it only
// verifies on a chain that doesn't count; null if nowhere.
// A deployed account's live owner set is authoritative: if it is deployed on any allowed
// chain, only such chains count. Otherwise an ERC-6492 counterfactual deploy elsewhere
// would replay its *initial* owners — including ones the user has since removed.
async function contractChain(args: Args): Promise<number | 'wrong_chain' | null> {
  const deployed = Promise.all(CONTRACT_CHAINS.map((id) => deployedOn(id, args.address)));
  // A 65-byte signature carries no ERC-6492 deploy data, so it can only be a contract's
  // if the contract already exists: check that first and skip the eth_calls otherwise.
  const valid = isContractShaped(args.signature)
    ? Promise.all(CONTRACT_CHAINS.map((id) => signatureOn(id, args)))
    : deployed.then((d) => Promise.all(CONTRACT_CHAINS.map((id, i) => d[i] && signatureOn(id, args))));
  const work = Promise.all([valid, deployed]).then(([v, d]) => {
    const live = CONTRACT_CHAINS.filter((_, i) => d[i]);
    const allowed = live.length ? live : CONTRACT_CHAINS;
    return CONTRACT_CHAINS.find((id, i) => v[i] && allowed.includes(id)) ?? (v.some(Boolean) ? 'wrong_chain' : null);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), CONTRACT_DEADLINE_MS); });
  try { return await Promise.race([work, deadline]); }
  finally { clearTimeout(timer); }
}

// Only used to label a failure (503 vs 401): can every allow-listed chain still reach
// QUORUM providers? Cached briefly so a flood of bad signatures doesn't re-probe each time.
let health: { ok: boolean; at: number } | null = null;
async function rpcHealthy(): Promise<boolean> {
  if (health && Date.now() - health.at < HEALTH_TTL_MS) return health.ok;
  const perChain = await Promise.all(CONTRACT_CHAINS.map((id) => votes(CLIENTS[id], (c) => c.getBlockNumber().then(() => true))));
  health = { ok: perChain.every((r) => r.ok), at: Date.now() };
  return health.ok;
}

export async function verifyWalletSignature(address: Address, message: string, signature: unknown): Promise<Verdict> {
  if (!sigShapeOk(signature)) return { ok: false, reason: 'bad_signature' };
  // EOA fast path first (also right for 7702-delegated EOAs signing raw ECDSA). A failure here
  // still falls through: a deployed ERC-1271 wallet can also return a 65-byte signature.
  if (await ecdsaOk(address, message, signature)) return { ok: true, via: 'ecdsa' };
  const chainId = await contractChain({ address, message, signature });
  if (chainId === 'wrong_chain') return { ok: false, reason: 'wrong_chain' };
  if (chainId) return { ok: true, via: 'contract', chainId };
  return { ok: false, reason: (await rpcHealthy()) ? 'bad_signature' : 'rpc_unavailable' };
}
