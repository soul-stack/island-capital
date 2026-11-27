import { financeSummary, saleValue } from './shared/engine.mjs';
import { getMap } from './shared/maps.mjs';

const fmt = (n) => Math.round(n || 0).toLocaleString('zh-CN');
const sign = (n) => (n > 0 ? '+' : '') + fmt(n);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const stat = (label, value) =>
  '<div class="statbox"><small>' + label + '</small><strong>' + value + '</strong></div>';
const hint = (text) => '<p class="help">' + text + '</p>';
const tabs = { assets: '地产', bank: '银行', market: '股票', ledger: '账单' };

export function accountNav(page) {
  return (
    '<div class="account-nav" aria-label="资产账户">' +
    Object.entries(tabs)
      .map(
        ([id, label]) =>
          '<button data-menu="' + id + '" aria-pressed="' + (id === page) + '">' + label + '</button>',
      )
      .join('') +
    '</div>'
  );
}

export function accountTotals(f) {
  return (
    '<div class="statgrid">' +
    stat('现金', fmt(f.cash)) +
    stat('净资产', fmt(f.netWorth)) +
    stat('地产账面价值', fmt(f.propertyValue)) +
    stat('存款', fmt(f.deposit)) +
    stat('股票市值', fmt(f.stockValue)) +
    stat('未偿贷款', fmt(f.debt)) +
    '</div>'
  );
}

function tradeForm(action, operation, limit, label, unit, isActive, stock) {
  const max = Math.max(0, Math.floor(limit));
  const disabled = !isActive || max < 1;
  return (
    '<form class="order-form" data-money-form="' +
    action +
    '" data-operation="' +
    operation +
    '"' +
    (stock ? ' data-stock="' + stock + '"' : '') +
    '>' +
    '<label>' +
    label +
    '<input type="number" inputmode="numeric" name="quantity" min="1" max="' +
    max +
    '" step="1" required placeholder="最多 ' +
    fmt(max) +
    unit +
    '"' +
    (disabled ? ' disabled' : '') +
    '></label>' +
    '<button type="submit" class="secondary"' +
    (disabled ? ' disabled' : '') +
    '>' +
    label +
    '</button></form>'
  );
}
function canTransact(s, p) {
  return (
    p.id === s.players[s.turn].id &&
    !p.out &&
    ['roll', 'end', 'buy', 'shop', 'bank', 'liquidate'].includes(s.phase)
  );
}
function bank(s, p, f) {
  const active = canTransact(s, p),
    rescue = s.phase === 'liquidate';
  const feeFree = f.loanFeeRate === 0;
  return (
    accountNav('bank') +
    '<div class="statgrid">' +
    stat('随身现金', fmt(f.cash)) +
    stat('银行存款', fmt(f.deposit)) +
    stat('尚可借款', fmt(f.availableCredit)) +
    stat('未还本金与利息', fmt(f.debt)) +
    '</div>' +
    hint(
      '每轮结束存款计息 ' +
        (f.depositRate * 100).toFixed(1) +
        '%，未还借款计息 ' +
        (f.loanRate * 100).toFixed(1) +
        '%。' +
        (feeFree
          ? '当前在银行，借款免手续费。'
          : '远程借款收取本金 1% 手续费，向上取整。到地图的银行入口可免手续费。'),
    ) +
    tradeForm('bank', 'deposit', f.cash, '存入', '', active && !rescue) +
    tradeForm('bank', 'withdraw', f.deposit, '取出', '', active) +
    tradeForm('bank', 'borrow', f.availableCredit, '借款', '', active) +
    tradeForm('bank', 'repay', Math.min(f.cash, f.debt), '还款', '', active && !rescue) +
    (!active ? hint('轮到你办理业务时可提交。') : '')
  );
}
function spark(history, name) {
  const values = history.length ? history : [0];
  const hi = Math.max(...values),
    lo = Math.min(...values);
  const points = values.map((v, i) => [
    3 + (i * 144) / Math.max(1, values.length - 1),
    32 - ((v - lo) * 26) / Math.max(1, hi - lo),
  ]);
  const last = points.at(-1);
  return (
    '<svg class="stock-chart" viewBox="0 0 150 38" role="img" aria-label="' +
    esc(name) +
    '价格走势 ' +
    values.join('、') +
    '"><path d="M2 33h146" stroke="#40575b"/><polyline points="' +
    points.map((pair) => pair.join(',')).join(' ') +
    '" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="' +
    last[0] +
    '" cy="' +
    last[1] +
    '" r="2.6" fill="currentColor"/></svg>'
  );
}
function market(s, p, f) {
  const active = canTransact(s, p);
  return (
    accountNav('market') +
    '<div class="statgrid">' +
    stat('可用现金', fmt(f.cash)) +
    stat('股票市值', fmt(f.stockValue)) +
    stat('持仓浮盈亏', sign(f.unrealized)) +
    stat('累计已实现盈亏', sign(f.realized)) +
    '</div>' +
    hint(
      '买卖均为零佣金，本轮所有玩家使用同一报价。每轮结束，三只股票各受市场、行业波动及向基准价回归影响，更新一次价格。持仓成本按加权平均计算。',
    ) +
    (s.market || [])
      .map((q) => {
        const position = f.positions.find((x) => x.id === q.id) || { shares: 0, cost: 0, profit: 0 };
        const history = q.history || [q.price],
          prev = history.at(-2) ?? q.price;
        const move = q.price - prev;
        return (
          '<article class="security"><div class="quote"><div><strong>' +
          esc(q.name) +
          '</strong><small>每股 ' +
          fmt(q.price) +
          '　' +
          sign(move) +
          '</small></div>' +
          spark(history, q.name) +
          '</div>' +
          '<p class="quote-meta">持有 ' +
          fmt(position.shares) +
          ' 股 · 成本 ' +
          fmt(position.cost) +
          ' · 浮盈亏 ' +
          sign(position.profit) +
          '</p>' +
          tradeForm(
            'stock',
            'buy',
            Math.floor(f.cash / q.price),
            '买入',
            '股',
            active && s.phase !== 'liquidate',
            q.id,
          ) +
          tradeForm('stock', 'sell', position.shares, '卖出', '股', active, q.id) +
          '</article>'
        );
      })
      .join('')
  );
}
function ledger(s, p, f) {
  const rows = (s.ledger || []).filter((r) => r.playerId === p.id);
  const rounds = [
    ...new Set([
      s.round,
      Math.max(1, s.round - 1),
      ...(s.accountRounds || []).map((r) => r.round),
      ...rows.map((r) => r.round),
    ]),
  ].sort((a, b) => b - a);
  const last = f.lastStatement;
  return (
    accountNav('ledger') +
    '<div class="statgrid">' +
    stat('随身现金', fmt(f.cash)) +
    stat('可取存款', fmt(f.deposit)) +
    stat('可卖股票市值', fmt(f.stockValue)) +
    stat('可用授信', fmt(f.availableCredit)) +
    '</div>' +
    (last
      ? hint(
          '最近一次结算 · 经营款 ' +
            fmt(last.baseIncome) +
            '，存息 ' +
            fmt(last.depositInterest) +
            '，贷款利息 ' +
            fmt(last.debtInterest) +
            '。',
        )
      : '') +
    hint('逐笔列出最近 300 笔全桌流水中属于你的记录。最近三个轮次另有完整分类汇总。') +
    rounds
      .map((n, i) => {
        const entries = rows.filter((r) => r.round === n);
        const complete = s.accountRounds?.find((r) => r.round === n)?.rows.find((r) => r.playerId === p.id);
        const groups = complete?.byKind || {};
        const ops = [
          'income',
          'salary',
          'bonus',
          'interest',
          'rentReceived',
          'rentPaid',
          'payment',
          'debtInterest',
          'fee',
          'shop',
          'card',
        ];
        const earnings = ops.reduce((sum, k) => sum + (groups[k]?.amount || 0), 0);
        const invested = ['buy', 'purchase', 'upgrade', 'stockBuy'].reduce(
          (sum, k) => sum - (groups[k]?.cashDelta || 0),
          0,
        );
        const delta = complete?.cashDelta ?? entries.reduce((a, r) => a + (r.cashDelta || 0), 0);
        return (
          '<details class="bill-group"' +
          (i < 2 ? ' open' : '') +
          '><summary>第 ' +
          n +
          ' 轮 <span>现金净变动 ' +
          sign(delta) +
          '</span></summary>' +
          (complete
            ? hint(
                '经营、租税、道具及利息净额 ' +
                  sign(earnings) +
                  ' · 新购地产、升级及买股投入 ' +
                  fmt(invested) +
                  ' · 存款变动 ' +
                  sign(complete.depositDelta) +
                  ' · 借款变动 ' +
                  sign(complete.debtDelta),
              )
            : '') +
          (entries.length
            ? entries
                .slice()
                .reverse()
                .map(
                  (r) =>
                    '<div class="bill-line"><div>' +
                    esc(r.text) +
                    '<small>余额 ' +
                    fmt(r.cashAfter) +
                    (r.depositDelta ? ' · 存款 ' + sign(r.depositDelta) : '') +
                    (r.debtDelta ? ' · 负债 ' + sign(r.debtDelta) : '') +
                    '</small></div><b>' +
                    sign(r.cashDelta) +
                    '</b></div>',
                )
                .join('')
            : hint('本轮尚无流水。')) +
          '</details>'
        );
      })
      .join('')
  );
}
function liquidation(s, p, f) {
  const bill = s.bill;
  if (!bill || bill.payer !== p.id) return hint('当前没有待处理欠款。') + accountNav('ledger');
  const recipient = s.players.find((x) => x.id === bill.creditor)?.name || '公共资金';
  const map = getMap(s.mapId || 'mistport');
  const owned = map.tiles.filter((t) => s.properties[t.id]?.owner === p.id);
  return (
    '<div class="bill-notice"><strong>' +
    esc(bill.reason) +
    '</strong><small>收款方 ' +
    esc(recipient) +
    '</small></div>' +
    '<div class="statgrid">' +
    stat('应付总额', fmt(bill.amount)) +
    stat('还差现金', fmt(Math.max(0, bill.amount - p.cash))) +
    '</div>' +
    hint('资金筹足后立即付款。可决定取款、卖股、借款的金额，也可选择要出售的地产。') +
    '<div class="settle-links"><button class="secondary" data-menu="bank">取款或借款</button><button class="secondary" data-menu="market">卖出股票</button></div>' +
    owned
      .map(
        (t) =>
          '<div class="info-row"><div class="grow">' +
          esc(t.name) +
          '<small>变卖实收 ' +
          fmt(saleValue(s, t.id)) +
          '</small></div><button class="secondary" data-sell-deed="' +
          t.id +
          '">出售</button></div>',
      )
      .join('') +
    hint('自动清算依次使用存款、股票、低估值地产。全部变现仍不足时破产。') +
    '<button class="secondary dangerbtn" data-action="autoSettle">按此顺序自动清算</button>'
  );
}
export function accountDetails(page, s, p) {
  const f = financeSummary(s, p);
  const renderers = { bank, market, ledger, liquidate: liquidation };
  return { title: page === 'liquidate' ? '筹款付款' : tabs[page] + '账户', html: renderers[page](s, p, f) };
}
