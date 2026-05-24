/**
 * 大西庫存管理系統
 * 第一版 + 點擊展開各分店庫存水位 + 異動紀錄 Tab + 新增異動表單
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { AlertTriangle, RefreshCw, ChevronDown, Warehouse, Store } from 'lucide-react'
import { supabase } from './lib/supabase'

const STORE_COLORS = {
  '大西倉庫': '#f97316', '士捷分店': '#3b82f6',
  '石牌分店': '#8b5cf6', '旗艦分店': '#10b981',
}
const COLOR_LIST = ['#f97316','#3b82f6','#8b5cf6','#10b981','#f43f5e','#06b6d4']

function getStatus(pct) {
  if (pct < 40) return { label: '嚴重不足', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', pulse: true }
  if (pct < 75) return { label: '庫存偏低', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', pulse: false }
  return { label: '正常', color: '#10b981', bg: 'rgba(16,185,129,0.12)', pulse: false }
}

const G = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' },
  input: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  label: { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 5 },
  btn: { padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' },
  btnPrimary: { padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', color: '#fff', fontWeight: 600 },
}

// ── 進度條
function StockBar({ qty, threshold, height = 6 }) {
  const pct = Math.min(100, Math.round(qty / (threshold || 1) * 100))
  const st = getStatus(pct)
  return (
    <div style={{ position: 'relative', height, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: st.color, borderRadius: 99, transition: 'width .5s ease', animation: st.pulse ? 'pulseBar 1.4s ease-in-out infinite' : 'none' }} />
    </div>
  )
}

// ── 缺貨快報
function ShortageBar({ shortage }) {
  const entries = Object.entries(shortage)
  if (!entries.length) return (
    <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#10b981' }}>
      ✅ 所有分店庫存正常
    </div>
  )
  return (
    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <AlertTriangle size={13} color="#ef4444" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '.08em' }}>分店缺貨快報</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {entries.map(([loc, items]) => (
          <div key={loc} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '5px 12px', fontSize: 12, display: 'flex', gap: 6 }}>
            <span style={{ color: STORE_COLORS[loc] || '#94a3b8', fontWeight: 600 }}>{loc}</span>
            <span style={{ color: '#64748b' }}>缺：</span>
            <span style={{ color: '#fca5a5' }}>{items.join('、')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 展開面板
function StoreBreakdown({ productName, matrix, locations }) {
  const chartData = locations.map(loc => {
    const r = matrix[productName]?.[loc]
    if (!r) return null
    return { name: loc.replace('分店','').replace('倉庫','倉'), 庫存量: r.quantity, 安全水位: r.threshold, color: STORE_COLORS[loc] || '#64748b' }
  }).filter(Boolean)

  return (
    <div style={{ animation: 'expandRow .2s ease', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '18px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, letterSpacing: '.08em' }}>各分店庫存水位</div>
          {locations.map(loc => {
            const r = matrix[productName]?.[loc]
            if (!r) return null
            const pct = Math.min(100, Math.round(r.quantity / (r.threshold || 1) * 100))
            const st = getStatus(pct)
            return (
              <div key={loc} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: STORE_COLORS[loc] || '#94a3b8', fontWeight: 500 }}>{loc}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 600, animation: st.pulse ? 'pulseBar 1.4s infinite' : 'none' }}>{st.label}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>{r.quantity}/{r.threshold}{r.unit}</span>
                  </div>
                </div>
                <StockBar qty={r.quantity} threshold={r.threshold} height={7} />
              </div>
            )
          })}
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, letterSpacing: '.08em' }}>庫存量 vs 安全水位</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="庫存量" radius={[4,4,0,0]}>{chartData.map((d,i) => <Cell key={i} fill={d.color} />)}</Bar>
              <Bar dataKey="安全水位" fill="rgba(255,255,255,0.08)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── 異動 Modal
function TxModal({ onClose, onSubmit, locations, products }) {
  const [type, setType] = useState('outbound')
  const [form, setForm] = useState({ productId: '', fromId: '', toId: '', qty: '', operator: '', note: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const warehouses = locations.filter(l => l.type === 'warehouse')
  const branches = locations.filter(l => l.type === 'branch')

  const handleSave = () => {
    if (!form.productId || !form.qty || parseInt(form.qty) < 1) { alert('請填寫品項與數量'); return }
    if (type !== 'inbound' && !form.fromId) { alert('請選擇來源'); return }
    if (type !== 'outbound' && !form.toId) { alert('請選擇目的地'); return }
    onSubmit({ type, ...form, qty: parseInt(form.qty) })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#151b27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>新增異動單</span>
          <button onClick={onClose} style={{ ...G.btn, padding: '4px 10px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 類型 */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[['inbound','進貨入倉'],['outbound','出貨領料'],['transfer','分店調貨']].map(([k,v]) => (
              <button key={k} onClick={() => setType(k)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: type===k ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${type===k?'#f97316':'rgba(255,255,255,0.08)'}`, color: type===k?'#f97316':'#64748b', fontFamily: 'inherit' }}>{v}</button>
            ))}
          </div>
          {/* 品項 */}
          <div>
            <label style={G.label}>品項 *</label>
            <select value={form.productId} onChange={e => set('productId', e.target.value)} style={G.input}>
              <option value="">請選擇品項</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {/* 來源 */}
          {type !== 'inbound' && (
            <div>
              <label style={G.label}>{type === 'transfer' ? '調出地點 *' : '來源倉庫 *'}</label>
              <select value={form.fromId} onChange={e => set('fromId', e.target.value)} style={G.input}>
                <option value="">請選擇</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          {/* 目的地 */}
          {type !== 'outbound' && (
            <div>
              <label style={G.label}>{type === 'inbound' ? '進貨至 *' : '調入分店 *'}</label>
              <select value={form.toId} onChange={e => set('toId', e.target.value)} style={G.input}>
                <option value="">請選擇</option>
                {(type === 'inbound' ? warehouses : branches).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          {/* 數量 & 人員 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={G.label}>數量 *</label>
              <input type="number" min="1" placeholder="0" value={form.qty} onChange={e => set('qty', e.target.value)} style={G.input} />
            </div>
            <div>
              <label style={G.label}>操作人員</label>
              <input placeholder="姓名" value={form.operator} onChange={e => set('operator', e.target.value)} style={G.input} />
            </div>
          </div>
          <div>
            <label style={G.label}>備註</label>
            <input placeholder="選填" value={form.note} onChange={e => set('note', e.target.value)} style={G.input} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={G.btn}>取消</button>
          <button onClick={handleSave} style={G.btnPrimary}>確認送出</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN
export default function App() {
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [transactions, setTransactions] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [showTxModal, setShowTxModal] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: locs }, { data: prods }, { data: inv }, { data: txs }] = await Promise.all([
      supabase.from('locations').select('*').eq('is_active', true).order('type'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
      supabase.from('v_inventory_summary').select('*'),
      supabase.from('transactions').select('*, products(name), from_loc:from_location(name), to_loc:to_location(name)').order('created_at', { ascending: false }).limit(50),
    ])
    setLocations(locs || [])
    setProducts(prods || [])
    setInventory(inv || [])
    setTransactions(txs || [])
    setLastFetch(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const matrix = useMemo(() => {
    const m = {}
    inventory.forEach(r => {
      if (!m[r.product_name]) m[r.product_name] = {}
      m[r.product_name][r.location_name] = r
    })
    return m
  }, [inventory])

  const productNames = useMemo(() => Object.keys(matrix), [matrix])

  const locNames = useMemo(() => {
    return [...locations].sort((a, b) => a.type === 'warehouse' ? -1 : 1).map(l => l.name)
  }, [locations])

  const stats = useMemo(() => {
    let low = 0, critical = 0
    inventory.forEach(r => {
      const p = Math.min(100, Math.round(r.quantity / (r.threshold || 1) * 100))
      if (p < 75) low++
      if (p < 40) critical++
    })
    return { low, critical }
  }, [inventory])

  const shortage = useMemo(() => {
    const map = {}
    inventory.forEach(r => {
      if (r.is_low_stock) {
        if (!map[r.location_name]) map[r.location_name] = []
        map[r.location_name].push(r.product_name)
      }
    })
    return map
  }, [inventory])

  const handleTxSubmit = async ({ type, productId, fromId, toId, qty, operator, note }) => {
    await supabase.from('transactions').insert({
      type, product_id: productId,
      from_location: type === 'inbound' ? null : fromId,
      to_location: type === 'outbound' ? null : toId,
      quantity: qty, operator: operator || null, note: note || null,
    })
    const updateInv = async (locId, delta) => {
      const { data } = await supabase.from('inventory').select('quantity').eq('location_id', locId).eq('product_id', productId).single()
      await supabase.from('inventory').upsert({ location_id: locId, product_id: productId, quantity: Math.max(0, (data?.quantity || 0) + delta), updated_at: new Date().toISOString() }, { onConflict: 'location_id,product_id' })
    }
    if (type === 'inbound' && toId) await updateInv(toId, qty)
    else if (type === 'outbound' && fromId) await updateInv(fromId, -qty)
    else if (type === 'transfer') await Promise.all([updateInv(fromId, -qty), updateInv(toId, qty)])
    load()
  }

  const tabStyle = (t) => ({
    padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
    background: tab === t ? 'rgba(249,115,22,0.15)' : 'transparent',
    border: `1px solid ${tab === t ? '#f97316' : 'transparent'}`,
    color: tab === t ? '#f97316' : '#64748b',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f1f5f9', fontFamily: "'IBM Plex Sans','Noto Sans TC',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap');
        @keyframes pulseBar{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes expandRow{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        tbody tr:hover td{background:rgba(255,255,255,0.02)!important}
        input:focus,select:focus{border-color:rgba(249,115,22,.5)!important}
        select option{background:#151b27}
      `}</style>

      {/* HEADER */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(13,17,23,0.98)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏪</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>大西庫存管理系統</div>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '.1em' }}>DAXI INVENTORY</div>
          </div>
        </div>
        <nav style={{ display: 'flex', gap: 4 }}>
          {[['overview','📦 庫存總覽'],['tx','🔄 異動紀錄']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>{l}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={load} disabled={loading} style={{ ...G.btn, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {lastFetch ? lastFetch.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '更新'}
          </button>
          <button onClick={() => setShowTxModal(true)} style={G.btnPrimary}>＋ 新增異動</button>
        </div>
      </header>

      <main style={{ padding: '22px 28px', maxWidth: 1300, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 統計卡 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: '品項數',   value: products.length,        color: '#3b82f6' },
            { label: '分店數',   value: locations.length,       color: '#8b5cf6' },
            { label: '低庫存',   value: `${stats.low} 項`,      color: stats.low > 0 ? '#f59e0b' : '#10b981' },
            { label: '嚴重缺貨', value: `${stats.critical} 項`, color: stats.critical > 0 ? '#ef4444' : '#10b981', pulse: stats.critical > 0 },
          ].map(c => (
            <div key={c.label} style={{ ...G.card, animation: c.pulse ? 'blink 2s infinite' : 'none' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* 缺貨快報 */}
        <ShortageBar shortage={shortage} />

        {/* ══ 庫存總覽 */}
        {tab === 'overview' && (
          <>
            <div style={{ fontSize: 12, color: '#475569' }}>💡 點擊品項列可展開查看各分店庫存水位</div>
            <div style={{ ...G.card, padding: 0, overflow: 'auto' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>載入中...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#475569', fontWeight: 500 }}>品項</th>
                      {locNames.map(loc => (
                        <th key={loc} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: STORE_COLORS[loc] || '#475569', fontWeight: 500 }}>
                          {loc.includes('倉庫') ? <Warehouse size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : <Store size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                          {loc}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productNames.map(name => {
                      const isExp = expanded === name
                      return (
                        <>
                          <tr key={name} onClick={() => setExpanded(isExp ? null : name)} style={{ borderBottom: isExp ? 'none' : '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: isExp ? 'rgba(249,115,22,0.04)' : 'transparent' }}>
                            <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <ChevronDown size={14} color="#475569" style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
                                {name}
                              </div>
                            </td>
                            {locNames.map(loc => {
                              const r = matrix[name]?.[loc]
                              if (!r) return <td key={loc} style={{ padding: '13px 14px', color: '#334155', fontSize: 12 }}>—</td>
                              const pct = Math.min(100, Math.round(r.quantity / (r.threshold || 1) * 100))
                              const st = getStatus(pct)
                              return (
                                <td key={loc} style={{ padding: '10px 14px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: st.color, animation: st.pulse ? 'pulseBar 1.4s infinite' : 'none', fontWeight: st.pulse ? 600 : 400 }}>{r.quantity}{r.unit}</span>
                                    <span style={{ fontSize: 10, color: '#475569' }}>{pct}%</span>
                                  </div>
                                  <StockBar qty={r.quantity} threshold={r.threshold} height={5} />
                                </td>
                              )
                            })}
                          </tr>
                          {isExp && (
                            <tr key={`${name}-exp`}>
                              <td colSpan={locNames.length + 1} style={{ padding: 0, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <StoreBreakdown productName={name} matrix={matrix} locations={locNames} />
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ══ 異動紀錄 */}
        {tab === 'tx' && (
          <div style={{ ...G.card, padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['時間','類型','品項','來源','目的地','數量','操作人員','備註'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#475569', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan="8" style={{ padding: 30, textAlign: 'center', color: '#475569', fontSize: 13 }}>尚無異動紀錄</td></tr>
                ) : transactions.map(tx => {
                  const typeMap = { inbound: ['進貨','#10b981','rgba(16,185,129,0.12)'], outbound: ['出貨','#f59e0b','rgba(245,158,11,0.12)'], transfer: ['調貨','#3b82f6','rgba(59,130,246,0.12)'] }
                  const [tLabel, tColor, tBg] = typeMap[tx.type] || ['未知','#64748b','rgba(100,116,139,0.12)']
                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {new Date(tx.created_at).toLocaleDateString('zh-TW')}<br />
                        {new Date(tx.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: tBg, color: tColor, fontWeight: 600 }}>{tLabel}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{tx.products?.name || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>{tx.from_loc?.name || '外部'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>{tx.to_loc?.name || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace' }}>×{tx.quantity}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>{tx.operator || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: '#64748b' }}>{tx.note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showTxModal && (
        <TxModal onClose={() => setShowTxModal(false)} onSubmit={handleTxSubmit} locations={locations} products={products} />
      )}
    </div>
  )
}
