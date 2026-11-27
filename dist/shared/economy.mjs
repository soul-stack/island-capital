import { getMap } from './maps.mjs';

export const BASE_INCOME = 850;
export const DEPOSIT_RATE = 0.012;
export const LOAN_RATE = 0.025;
const listed = [
  { id: 'harbor', name: '雾港航运', base: 100, swing: 0.092 },
  { id: 'rail', name: '云轨机造', base: 140, swing: 0.076 },
  { id: 'spice', name: '赤沙商贸', base: 80, swing: 0.116 },
];
const tradePhases = ['roll', 'buy', 'shop', 'bank', 'end'];
const check = (okay, message) => {
  if (!okay) throw new Error(message);
};
const positive = (n, label) => check(Number.isSafeInteger(n) && n > 0, label + '需要正整数');
const freshMarket = () =>
  listed.map((v) => ({ id: v.id, name: v.name, price: v.base, previous: v.base, history: [v.base] }));
const person = (s, p) => (typeof p === 'string' ? s.players.find((v) => v.id === p) : p);
const mapFor = (s) => getMap(s.mapId ?? 'mistport');
const book = (s, id) => {
  const t = mapFor(s).tiles[id],
    d = s.properties[id];
  return t?.type === 'property' && d ? t.price + (d.level - 1) * Math.round((t.price * 0.55) / 50) * 50 : 0;
};
export function ensureEconomy(s) {
  s.market ??= freshMarket();
  s.ledger ??= [];
  s.ledgerSeq ??= 0;
  s.bill ??= null;
  s.lastSettlement ??= null;
  s.accountRounds ??= [];
  for (const p of s.players) {
    p.deposit ??= 0;
    p.debt ??= 0;
    p.holdings ??= {};
    p.stockProfit ??= 0;
  }
  return s;
}
export function saleValue(s, id) {
  return Math.floor(book(s, id) * 0.65);
}
function propertyValue(s, p) {
  return Object.entries(s.properties).reduce(
    (sum, [id, d]) => sum + (d.owner === p.id ? book(s, id) : 0),
    0,
  );
}
function credit(value) {
  return Math.min(9000, Math.floor((3500 + 0.25 * value) / 100) * 100);
}
export function loanLimit(s, p) {
  const v = person(s, p);
  return v && !v.out ? credit(propertyValue(s, v)) : 0;
}
export function financeSummary(s, p) {
  const v = person(s, p);
  if (!v) return null;
  const positions = (s.market ?? freshMarket()).map((q) => {
    const h = v.holdings?.[q.id],
      shares = h?.shares || 0,
      cost = h?.cost || 0,
      value = shares * q.price;
    return { id: q.id, name: q.name, shares, cost, price: q.price, value, profit: value - cost };
  });
  const stockValue = positions.reduce((a, q) => a + q.value, 0),
    stockCost = positions.reduce((a, q) => a + q.cost, 0);
  const estate = propertyValue(s, v),
    limit = v.out ? 0 : credit(estate),
    debt = v.debt ?? 0,
    deposit = v.deposit ?? 0;
  return {
    cash: v.cash,
    deposit,
    debt,
    positions,
    stockValue,
    stockCost,
    unrealized: stockValue - stockCost,
    realized: v.stockProfit ?? 0,
    propertyValue: estate,
    netWorth: v.cash + deposit + stockValue + estate - debt,
    loanLimit: limit,
    availableCredit: Math.max(0, limit - debt),
    nextBaseIncome: v.out || s.phase === 'finished' ? 0 : BASE_INCOME,
    nextSettlementRound: s.phase === 'finished' ? null : s.round,
    depositRate: DEPOSIT_RATE,
    loanRate: LOAN_RATE,
    loanFeeRate: mapFor(s).tiles[v.pos]?.type === 'bank' ? 0 : 0.01,
    lastStatement: s.lastSettlement?.rows.find((row) => row.playerId === v.id) ?? null,
    currentAccount:
      s.accountRounds?.find((r) => r.round === s.round)?.rows.find((row) => row.playerId === v.id) ?? null,
    previousAccount:
      s.accountRounds?.find((r) => r.round === s.round - 1)?.rows.find((row) => row.playerId === v.id) ??
      null,
  };
}
function aggregate(s, p, kind, amount, cashDelta, depositDelta, debtDelta) {
  let period = s.accountRounds.at(-1);
  if (!period || period.round !== s.round) {
    period = { round: s.round, rows: [] };
    s.accountRounds.push(period);
    if (s.accountRounds.length > 3) s.accountRounds.shift();
  }
  let row = period.rows.find((r) => r.playerId === p.id);
  if (!row) {
    row = { playerId: p.id, cashDelta: 0, depositDelta: 0, debtDelta: 0, byKind: {} };
    period.rows.push(row);
  }
  const bucket = (row.byKind[kind] ??= {
    count: 0,
    amount: 0,
    cashDelta: 0,
    depositDelta: 0,
    debtDelta: 0,
  });
  row.cashDelta += cashDelta;
  row.depositDelta += depositDelta;
  row.debtDelta += debtDelta;
  bucket.count++;
  bucket.amount += amount;
  bucket.cashDelta += cashDelta;
  bucket.depositDelta += depositDelta;
  bucket.debtDelta += debtDelta;
}
function post(s, p, kind, text, changes = {}, amount = changes.cash ?? 0) {
  const cashDelta = changes.cash ?? 0,
    depositDelta = changes.deposit ?? 0,
    debtDelta = changes.debt ?? 0;
  p.cash += cashDelta;
  p.deposit += depositDelta;
  p.debt += debtDelta;
  s.ledger.push({
    id: ++s.ledgerSeq,
    round: s.round,
    playerId: p.id,
    kind,
    text,
    amount,
    cashDelta,
    depositDelta,
    debtDelta,
    cashAfter: p.cash,
  });
  if (s.ledger.length > 300) s.ledger.shift();
  aggregate(s, p, kind, amount, cashDelta, depositDelta, debtDelta);
}
export function addCash(s, p, amount, kind, text) {
  check(Number.isSafeInteger(amount) && p.cash + amount >= 0, '现金变动超出可用余额');
  post(s, p, kind, text, { cash: amount });
}
function log(s, p, text, type = 'finance') {
  s.log.push({ id: ++s.eventSeq, round: s.round, playerId: p.id, type, text });
  if (s.log.length > 100) s.log.shift();
}
export function closeRound(s, rng) {
  const rows = [];
  for (const p of s.players.filter((p) => !p.out)) {
    const di = Math.floor((p.deposit * 12) / 1000),
      li = Math.ceil((p.debt * 25) / 1000);
    addCash(s, p, BASE_INCOME, 'income', '第 ' + s.round + ' 轮基础经营款');
    if (di) post(s, p, 'interest', '存款利息计入存款', { deposit: di }, di);
    if (li) post(s, p, 'debtInterest', '借款利息计入负债', { debt: li }, -li);
    rows.push({ playerId: p.id, baseIncome: BASE_INCOME, depositInterest: di, debtInterest: li });
  }
  const random = () => {
    const n = rng();
    check(n >= 0 && n < 1, '随机数无效');
    return n - 0.5;
  };
  const common = random() * 0.066;
  s.market.forEach((q, i) => {
    const t = listed[i],
      change = common + random() * t.swing * 2 + ((t.base - q.price) / t.base) * 0.074;
    q.previous = q.price;
    q.price = Math.max(
      Math.round(t.base * 0.39),
      Math.min(Math.round(t.base * 2.3), Math.round(q.price * (1 + change))),
    );
    q.history.push(q.price);
  });
  s.lastSettlement = { round: s.round, rows };
  log(
    s,
    s.players[s.turn],
    '第 ' + s.round + ' 轮结账，每位在场玩家领取 ' + BASE_INCOME + '，银行计息并公布新行情。',
    'settlement',
  );
}
function bank(s, p, op, amount) {
  positive(amount, '金额');
  if (op === 'deposit') {
    check(p.cash >= amount, '可用现金不足');
    post(s, p, 'deposit', '存入银行', { cash: -amount, deposit: amount });
  } else if (op === 'withdraw') {
    check(p.deposit >= amount, '存款余额不足');
    post(s, p, 'withdraw', '取回存款', { cash: amount, deposit: -amount });
  } else if (op === 'borrow') {
    check(amount <= Math.max(0, loanLimit(s, p) - p.debt), '超过可用借款额度');
    const fee = mapFor(s).tiles[p.pos].type === 'bank' ? 0 : Math.ceil(amount / 100);
    check(amount > fee, '借款须高于手续费');
    post(s, p, 'borrow', '借入本金', { cash: amount, debt: amount });
    if (fee) addCash(s, p, -fee, 'fee', '非银行格放款手续费');
  } else if (op === 'repay') {
    check(amount <= p.debt && amount <= p.cash, '还款额超过现金或未还借款');
    post(s, p, 'repay', '归还借款', { cash: -amount, debt: -amount });
  } else throw new Error('未知银行业务');
}
function trade(s, p, side, id, shares) {
  positive(shares, '股数');
  const q = s.market.find((q) => q.id === id);
  check(q, '请选择上市证券');
  const value = shares * q.price;
  check(Number.isSafeInteger(value), '交易金额过大');
  const h = p.holdings[id] ?? { shares: 0, cost: 0 };
  if (side === 'buy') {
    check(p.cash >= value, '现金不足以买入这些股份');
    p.holdings[id] = { shares: h.shares + shares, cost: h.cost + value };
    addCash(s, p, -value, 'stockBuy', '买入 ' + q.name + ' ' + shares + ' 股，每股 ' + q.price);
  } else if (side === 'sell') {
    check(h.shares >= shares, '持股数量不足');
    const cost = shares === h.shares ? h.cost : Math.round((h.cost * shares) / h.shares);
    p.stockProfit += value - cost;
    if (shares === h.shares) delete p.holdings[id];
    else p.holdings[id] = { shares: h.shares - shares, cost: h.cost - cost };
    addCash(
      s,
      p,
      value,
      'stockSell',
      '卖出 ' + q.name + ' ' + shares + ' 股，已实现盈亏 ' + (value - cost),
    );
  } else throw new Error('未知证券操作');
}
function sellEstate(s, p, id) {
  check(Number.isInteger(id) && s.properties[id]?.owner === p.id, '请选择自己的地产');
  const value = saleValue(s, id),
    name = mapFor(s).tiles[id].name;
  delete s.properties[id];
  addCash(s, p, value, 'sale', '变卖 ' + name);
  log(s, p, p.name + ' 变卖' + name + '，收回 ' + value + '。', 'sale');
}
function pay(s, p, bill, amount) {
  const isCard = bill.category === 'card';
  addCash(
    s,
    p,
    -amount,
    isCard ? 'card' : bill.creditor ? 'rentPaid' : 'payment',
    bill.reason + '（应付 ' + bill.amount + '，实付 ' + amount + '）',
  );
  if (bill.creditor) {
    const owner = person(s, bill.creditor);
    addCash(s, owner, amount, isCard ? 'card' : 'rentReceived', p.name + ' 支付' + bill.reason);
    log(
      s,
      p,
      p.name + ' 向' + owner.name + ' 支付' + (isCard ? bill.reason : '租金') + ' ' + amount + '。',
      isCard ? 'item' : 'rent',
    );
  }
}
export function charge(s, p, amount, reason, creditor = null, category = 'payment') {
  check(Number.isSafeInteger(amount) && amount >= 0, '应付款无效');
  if (!amount) return;
  const bill = { payer: p.id, creditor: creditor?.id ?? creditor, amount, reason, category };
  if (p.cash >= amount) {
    pay(s, p, bill, amount);
    return;
  }
  check(!s.bill && s.players[s.turn].id === p.id, '当前有待处理付款或付款人不在回合中');
  s.bill = bill;
  s.phase = 'liquidate';
  log(
    s,
    p,
    p.name + ' 应付' + reason + ' ' + amount + '，现金缺口 ' + (amount - p.cash) + '，请筹款。',
    'bill',
  );
}
function automatic(s, p, bill) {
  const gap = () => Math.max(0, bill.amount - p.cash);
  if (p.deposit && gap()) bank(s, p, 'withdraw', Math.min(gap(), p.deposit));
  const investments = s.market.filter((q) => p.holdings[q.id]?.shares).sort((a, b) => a.price - b.price);
  for (const q of investments) {
    if (!gap()) break;
    trade(s, p, 'sell', q.id, Math.min(p.holdings[q.id].shares, Math.ceil(gap() / q.price)));
  }
  const estates = Object.keys(s.properties)
    .map(Number)
    .filter((id) => s.properties[id].owner === p.id)
    .sort((a, b) => saleValue(s, a) - saleValue(s, b) || a - b);
  for (const id of estates) {
    if (!gap()) break;
    sellEstate(s, p, id);
  }
}
export function doFinance(s, p, a) {
  const bill = s.bill,
    collecting = s.phase === 'liquidate';
  check(collecting || tradePhases.includes(s.phase), '当前阶段不能办理资金业务');
  if (collecting) check(bill?.payer === p.id, '当前账单不属于此席位');
  if (a.type === 'bank') {
    check(!collecting || ['withdraw', 'borrow'].includes(a.operation), '缺款期间只能办理筹款业务');
    bank(s, p, a.operation, a.amount);
  } else if (a.type === 'stock') {
    check(!collecting || a.side === 'sell', '缺款期间只可卖出股票');
    trade(s, p, a.side, a.stock, a.shares);
  } else if (a.type === 'liquidate' && collecting) {
    if (a.operation === 'auto') automatic(s, p, bill);
    else if (a.operation === 'property') sellEstate(s, p, a.tile);
    else if (a.operation === 'deposit')
      bank(s, p, 'withdraw', a.amount ?? Math.min(p.deposit, bill.amount - p.cash));
    else if (a.operation === 'stock') trade(s, p, 'sell', a.stock, a.shares);
    else if (a.operation === 'borrow') bank(s, p, 'borrow', a.amount);
    else throw new Error('未知筹款操作');
  } else throw new Error('当前没有待处理的账单');
  if (collecting && (p.cash >= bill.amount || (a.type === 'liquidate' && a.operation === 'auto'))) {
    const paid = Math.min(p.cash, bill.amount);
    pay(s, p, bill, paid);
    s.bill = null;
    s.phase = 'end';
    if (paid < bill.amount) {
      p.out = true;
      log(s, p, p.name + ' 无法清偿余额，宣布破产。', 'bankruptcy');
    }
  }
}

export function financeBot(s, p) {
  if (s.phase === 'liquidate') {
    const need = s.bill.amount - p.cash;
    if (p.deposit) return { type: 'bank', operation: 'withdraw', amount: Math.min(need, p.deposit) };
    const q = s.market.find((q) => p.holdings[q.id]?.shares);
    if (q)
      return {
        type: 'stock',
        side: 'sell',
        stock: q.id,
        shares: Math.min(p.holdings[q.id].shares, Math.ceil(need / q.price)),
      };
    const loan = Math.ceil((need + 1) / 0.99);
    if (loan <= loanLimit(s, p) - p.debt) return { type: 'bank', operation: 'borrow', amount: loan };
    return { type: 'liquidate', operation: 'auto' };
  }
  if (s.phase === 'buy') {
    const price = mapFor(s).tiles[p.pos].price,
      need = price + 1100 - p.cash;
    if (need > 0 && p.deposit)
      return { type: 'bank', operation: 'withdraw', amount: Math.min(need, p.deposit) };
    if (need > 0) {
      const q = s.market.find((q) => p.holdings[q.id]?.shares);
      if (q)
        return {
          type: 'stock',
          side: 'sell',
          stock: q.id,
          shares: Math.min(p.holdings[q.id].shares, Math.ceil(need / q.price)),
        };
      const loan = Math.ceil((need + 1) / 0.99),
        remaining = s.maxRounds - s.round;
      if (remaining >= 6 && loan < price * 0.62 && p.debt + loan < Math.min(4600, loanLimit(s, p)))
        return { type: 'bank', operation: 'borrow', amount: loan };
    }
  }
  if (s.phase !== 'end' && s.phase !== 'bank') return null;
  const minimum = 4400;
  if (p.debt && p.cash > minimum + 100)
    return { type: 'bank', operation: 'repay', amount: Math.min(p.debt, p.cash - minimum) };
  if (p.cash < 2600 && p.deposit > 0)
    return { type: 'bank', operation: 'withdraw', amount: Math.min(3800 - p.cash, p.deposit) };
  if (p.debt) return null;
  const quotes = s.market ?? [];
  for (const q of quotes) {
    const h = p.holdings[q.id];
    if (h && h.shares * q.price > h.cost * 1.14)
      return { type: 'stock', side: 'sell', stock: q.id, shares: h.shares };
  }
  if (s.round >= 2 && p.cash > 7100 && quotes.length) {
    const q = quotes[(s.round + s.turn) % quotes.length],
      owned = p.holdings[q.id]?.shares ?? 0;
    const budget = Math.min(1300, p.cash - 6500);
    const shares = Math.floor(budget / q.price);
    if (!owned && shares > 0 && q.price <= q.history[0] * 1.18)
      return { type: 'stock', side: 'buy', stock: q.id, shares };
  }
  if (p.cash > 9600 && p.deposit < 3900)
    return { type: 'bank', operation: 'deposit', amount: Math.min(p.cash - 7200, 3900 - p.deposit) };
  return null;
}
