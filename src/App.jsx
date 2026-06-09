/**
 * 大西庫存管理系統
 * 老闆端：庫存總覽 + 異動紀錄 + 進貨審核
 * 員工端：進貨購物車
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { AlertTriangle, RefreshCw, ChevronDown, Warehouse, Store, ShoppingCart, Plus, Check } from 'lucide-react'
import { supabase } from './lib/supabase'

const STORE_COLORS = {
  '大西倉庫': '#f97316', '士捷分店': '#3b82f6',
  '石牌分店': '#8b5cf6', '旗艦分店': '#10b981',
}

function getStatus(pct) {
  if (pct < 40) return { label: '嚴重不足', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', pulse: true }
  if (pct < 75) return { label: '庫存偏低', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', pulse: false }
  return { label: '正常', color: '#10b981', bg: 'rgba(16,185,129,0.12)', pulse: false }
}

const G = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' },
  input: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
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
    return { name: loc.replace('分店', '').replace('倉庫', '倉'), 庫存量: r.quantity, 安全水位: r.threshold, color: STORE_COLORS[loc] || '#64748b' }
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
              <Bar dataKey="庫存量" radius={[4, 4, 0, 0]}>{chartData.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
              <Bar dataKey="安全水位" fill="rgba(255,255,255,0.08)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── 異動 Modal（老闆用）
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
          <div style={{ display: 'flex', gap: 8 }}>
            {[['inbound', '進貨入倉'], ['outbound', '出貨領料'], ['transfer', '分店調貨']].map(([k, v]) => (
              <button key={k} onClick={() => setType(k)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: type === k ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${type === k ? '#f97316' : 'rgba(255,255,255,0.08)'}`, color: type === k ? '#f97316' : '#64748b', fontFamily: 'inherit' }}>{v}</button>
            ))}
          </div>
          <div>
            <label style={G.label}>品項 *</label>
            <select value={form.productId} onChange={e => set('productId', e.target.value)} style={G.input}>
              <option value="">請選擇品項</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {type !== 'inbound' && (
            <div>
              <label style={G.label}>{type === 'transfer' ? '調出地點 *' : '來源倉庫 *'}</label>
              <select value={form.fromId} onChange={e => set('fromId', e.target.value)} style={G.input}>
                <option value="">請選擇</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          {type !== 'outbound' && (
            <div>
              <label style={G.label}>{type === 'inbound' ? '進貨至 *' : '調入分店 *'}</label>
              <select value={form.toId} onChange={e => set('toId', e.target.value)} style={G.input}>
                <option value="">請選擇</option>
                {(type === 'inbound' ? warehouses : branches).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
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

// ── 員工：商品卡片
function ProductCard({ product, cartQty, onAdd, onRemove, stockInfo }) {
  const pct = stockInfo ? Math.min(100, Math.round(stockInfo.quantity / (stockInfo.threshold || 1) * 100)) : null
  const st = pct !== null ? getStatus(pct) : null
  return (
    <div style={{ ...G.card, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', minHeight: 140 }}>
      {st && (
        <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, padding: '2px 7px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 600 }}>
          {st.label}
        </span>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, paddingRight: 70, lineHeight: 1.4 }}>{product.name}</div>
      {stockInfo ? (
        <>
          <div style={{ fontSize: 11, color: '#64748b' }}>倉庫現有：{stockInfo.quantity}{stockInfo.unit}</div>
          <StockBar qty={stockInfo.quantity} threshold={stockInfo.threshold} height={4} />
        </>
      ) : (
        <div style={{ fontSize: 11, color: '#334155' }}>庫存資料未設定</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
        {cartQty > 0 ? (
          <>
            <button onClick={onRemove} style={{ ...G.btn, padding: '5px 13px', fontSize: 18, lineHeight: 1, flex: 1 }}>−</button>
            <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', minWidth: 30, textAlign: 'center', color: '#f97316' }}>{cartQty}</span>
            <button onClick={onAdd} style={{ ...G.btnPrimary, padding: '5px 13px', fontSize: 18, lineHeight: 1, flex: 1 }}>＋</button>
          </>
        ) : (
          <button onClick={onAdd} style={{ ...G.btnPrimary, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px' }}>
            <Plus size={14} /> 加入
          </button>
        )}
      </div>
    </div>
  )
}

// ── 員工：購物車面板
function CartPanel({ cart, onQtyChange, onRemove, locations, onSubmit, submitting }) {
  const [operator, setOperator] = useState('')
  const [toId, setToId] = useState('')
  const [note, setNote] = useState('')
  const total = cart.reduce((s, i) => s + i.qty, 0)
  const canSubmit = cart.length > 0 && operator.trim() && toId && !submitting

  const handleClick = () => {
    if (!canSubmit) return
    onSubmit({ cart, operator: operator.trim(), toId, note })
  }

  return (
    <div style={{ width: 268, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 78 }}>
      <div style={{ ...G.card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingCart size={16} color="#f97316" />
          <span style={{ fontWeight: 700, fontSize: 15 }}>進貨清單</span>
          {total > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 12, padding: '2px 10px', borderRadius: 99, background: 'rgba(249,115,22,0.18)', color: '#f97316', fontWeight: 700 }}>
              {total} 件
            </span>
          )}
        </div>

        {cart.length === 0 ? (
          <div style={{ fontSize: 13, color: '#475569', textAlign: 'center', padding: '28px 0' }}>
            點選商品加入清單
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
            {cart.map(item => (
              <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.3 }}>{item.productName}</span>
                <button onClick={() => onQtyChange(item.productId, item.qty - 1)} style={{ ...G.btn, padding: '2px 8px', fontSize: 14, minWidth: 28 }}>−</button>
                <span style={{ fontSize: 14, fontFamily: 'monospace', minWidth: 22, textAlign: 'center', color: '#f97316', fontWeight: 700 }}>{item.qty}</span>
                <button onClick={() => onQtyChange(item.productId, item.qty + 1)} style={{ ...G.btn, padding: '2px 8px', fontSize: 14, minWidth: 28 }}>＋</button>
                <button onClick={() => onRemove(item.productId)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: '2px 4px', lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '2px 0' }} />

        <div>
          <label style={G.label}>送達地點 *</label>
          <select value={toId} onChange={e => setToId(e.target.value)} style={G.input}>
            <option value="">請選擇地點</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label style={G.label}>你的名字 *</label>
          <input placeholder="操作員工姓名" value={operator} onChange={e => setOperator(e.target.value)} style={G.input} />
        </div>
        <div>
          <label style={G.label}>備註（選填）</label>
          <input placeholder="例如：緊急補貨" value={note} onChange={e => setNote(e.target.value)} style={G.input} />
        </div>

        <button
          onClick={handleClick}
          disabled={!canSubmit}
          style={{
            ...G.btnPrimary, width: '100%', textAlign: 'center',
            padding: '11px', fontSize: 14,
            opacity: canSubmit ? 1 : 0.4,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? '送出中...' : '✓ 送出進貨申請'}
        </button>
      </div>
    </div>
  )
}

// ── 員工主畫面
function EmployeeView({ products, inventory, locations, cart, setCart }) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const warehouseNames = useMemo(
    () => new Set(locations.filter(l => l.type === 'warehouse').map(l => l.name)),
    [locations]
  )

  const stockByName = useMemo(() => {
    const map = {}
    inventory.forEach(r => { if (warehouseNames.has(r.location_name)) map[r.product_name] = r })
    return map
  }, [inventory, warehouseNames])

  const cartMap = useMemo(() => {
    const m = {}
    cart.forEach(i => { m[i.productId] = i.qty })
    return m
  }, [cart])

  const addToCart = (product) => setCart(prev => {
    const ex = prev.find(i => i.productId === product.id)
    if (ex) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i)
    return [...prev, { productId: product.id, productName: product.name, qty: 1 }]
  })

  const removeOnce = (product) => setCart(prev => {
    const ex = prev.find(i => i.productId === product.id)
    if (!ex) return prev
    if (ex.qty <= 1) return prev.filter(i => i.productId !== product.id)
    return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty - 1 } : i)
  })

  const setQty = (productId, qty) => setCart(prev =>
    qty <= 0
      ? prev.filter(i => i.productId !== productId)
      : prev.map(i => i.productId === productId ? { ...i, qty } : i)
  )

  const handleSubmit = async ({ cart, operator, toId, note }) => {
    setSubmitting(true)
    try {
      const { data: order, error } = await supabase
        .from('purchase_orders')
        .insert({ status: 'pending', operator, note: note || null, to_location: toId })
        .select()
        .single()
      if (error) throw error
      await supabase.from('purchase_order_items').insert(
        cart.map(i => ({ order_id: order.id, product_id: i.productId, quantity: i.qty }))
      )
      setCart([])
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 5000)
    } catch (e) {
      alert('送出失敗：' + e.message)
    }
    setSubmitting(false)
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {submitted && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '13px 18px', marginBottom: 16, color: '#10b981', fontSize: 14, fontWeight: 600 }}>
            ✅ 進貨申請已送出！請等待老闆在老闆端確認。
          </div>
        )}
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>
          點選品項的「加入」按鈕，加入右側清單，填好名字後送出
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))', gap: 12 }}>
          {products.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              cartQty={cartMap[p.id] || 0}
              onAdd={() => addToCart(p)}
              onRemove={() => removeOnce(p)}
              stockInfo={stockByName[p.name]}
            />
          ))}
        </div>
      </div>
      <CartPanel
        cart={cart}
        onQtyChange={setQty}
        onRemove={pid => setCart(prev => prev.filter(i => i.productId !== pid))}
        locations={locations}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  )
}

// ── 老闆：進貨申請 Tab
function PurchaseOrdersTab({ orders, onApprove, onReject }) {
  const pending = orders.filter(o => o.status === 'pending')
  const done = orders.filter(o => o.status !== 'pending')

  const OrderCard = ({ order }) => {
    const statusMap = {
      pending: ['待審核', '#f59e0b', 'rgba(245,158,11,0.12)'],
      approved: ['已核准', '#10b981', 'rgba(16,185,129,0.12)'],
      rejected: ['已拒絕', '#ef4444', 'rgba(239,68,68,0.12)'],
    }
    const [sLabel, sColor, sBg] = statusMap[order.status] || ['未知', '#64748b', 'rgba(100,116,139,0.12)']

    return (
      <div style={{ ...G.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {order.operator} 的進貨申請
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {new Date(order.created_at).toLocaleDateString('zh-TW')}
              {' '}
              {new Date(order.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
              {order.to_loc?.name && (
                <span style={{ color: '#f97316', marginLeft: 8 }}>→ {order.to_loc.name}</span>
              )}
            </div>
            {order.note && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>備註：{order.note}</div>
            )}
          </div>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: sBg, color: sColor, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {sLabel}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: order.status === 'pending' ? 14 : 0 }}>
          {order.items?.map(item => (
            <div key={item.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '5px 13px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{item.products?.name || '未知品項'}</span>
              <span style={{ color: '#f97316', fontFamily: 'monospace', fontWeight: 700 }}>×{item.quantity}</span>
            </div>
          ))}
        </div>

        {order.status === 'pending' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onApprove(order)} style={{ ...G.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px' }}>
              <Check size={14} /> 核准並入庫
            </button>
            <button onClick={() => onReject(order.id)} style={{ ...G.btn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}>
              拒絕
            </button>
          </div>
        )}
      </div>
    )
  }

  if (orders.length === 0) return (
    <div style={{ ...G.card, textAlign: 'center', padding: '44px 20px', color: '#475569', fontSize: 14 }}>
      目前沒有進貨申請
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {pending.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 10, fontWeight: 600, letterSpacing: '.06em' }}>
            待審核 ({pending.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 10, letterSpacing: '.06em' }}>
            已處理 ({done.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {done.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 老闆密碼 Modal
function PinModal({ onClose, onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const check = () => {
    if (pin === (import.meta.env.VITE_BOSS_PIN || '1234')) {
      onSuccess()
    } else {
      setError(true)
      setPin('')
      setTimeout(() => setError(false), 800)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#151b27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 32, width: 300, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', animation: error ? 'shakeX .4s ease' : 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>老闆端密碼</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>輸入密碼進入管理介面</div>
        </div>
        <input
          type="password"
          placeholder="••••"
          value={pin}
          onChange={e => { setPin(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && check()}
          autoFocus
          style={{ ...G.input, textAlign: 'center', fontSize: 22, letterSpacing: '0.4em', marginBottom: error ? 4 : 14, border: error ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)' }}
        />
        {error && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginBottom: 10 }}>密碼錯誤，請再試一次</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...G.btn, flex: 1 }}>取消</button>
          <button onClick={check} style={{ ...G.btnPrimary, flex: 1 }}>確認</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN
export default function App() {
  const [mode, setMode] = useState('employee')
  const [bossUnlocked, setBossUnlocked] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])
  const [inventory, setInventory] = useState([])
  const [transactions, setTransactions] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [showTxModal, setShowTxModal] = useState(false)
  const [lastFetch, setLastFetch] = useState(null)
  const [cart, setCart] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: locs }, { data: prods }, { data: inv }, { data: txs }, { data: orders }] = await Promise.all([
      supabase.from('locations').select('*').eq('is_active', true).order('type'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
      supabase.from('v_inventory_summary').select('*'),
      supabase.from('transactions').select('*, products(name), from_loc:from_location(name), to_loc:to_location(name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('purchase_orders').select('*, to_loc:to_location(name), items:purchase_order_items(*, products(name))').order('created_at', { ascending: false }).limit(50),
    ])
    setLocations(locs || [])
    setProducts(prods || [])
    setInventory(inv || [])
    setTransactions(txs || [])
    setPurchaseOrders(orders || [])
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

  const pendingCount = useMemo(() => purchaseOrders.filter(o => o.status === 'pending').length, [purchaseOrders])

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

  const handleApproveOrder = async (order) => {
    for (const item of order.items || []) {
      const { data } = await supabase.from('inventory').select('quantity')
        .eq('location_id', order.to_location).eq('product_id', item.product_id).single()
      await supabase.from('inventory').upsert({
        location_id: order.to_location, product_id: item.product_id,
        quantity: Math.max(0, (data?.quantity || 0) + item.quantity),
        updated_at: new Date().toISOString()
      }, { onConflict: 'location_id,product_id' })
      await supabase.from('transactions').insert({
        type: 'inbound', product_id: item.product_id,
        from_location: null, to_location: order.to_location,
        quantity: item.quantity, operator: order.operator,
        note: `進貨申請核准（申請人：${order.operator}）`,
      })
    }
    await supabase.from('purchase_orders').update({ status: 'approved' }).eq('id', order.id)
    load()
  }

  const handleRejectOrder = async (orderId) => {
    await supabase.from('purchase_orders').update({ status: 'rejected' }).eq('id', orderId)
    load()
  }

  const tabStyle = (t) => ({
    padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
    background: tab === t ? 'rgba(249,115,22,0.15)' : 'transparent',
    border: `1px solid ${tab === t ? '#f97316' : 'transparent'}`,
    color: tab === t ? '#f97316' : '#64748b',
    position: 'relative',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f1f5f9', fontFamily: "'IBM Plex Sans','Noto Sans TC',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap');
        @keyframes pulseBar{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes expandRow{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shakeX{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
        tbody tr:hover td{background:rgba(255,255,255,0.02)!important}
        input:focus,select:focus{border-color:rgba(249,115,22,.5)!important}
        select option{background:#151b27}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:99px}
      `}</style>

      {/* HEADER */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(13,17,23,0.98)', position: 'sticky', top: 0, zIndex: 50 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏪</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>大西庫存管理系統</div>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '.1em' }}>DAXI INVENTORY</div>
          </div>
        </div>

        {/* 模式切換 */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, gap: 2 }}>
          <button onClick={() => { setMode('employee'); setBossUnlocked(false) }} style={{
            padding: '5px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: mode === 'employee' ? 'rgba(249,115,22,0.2)' : 'transparent',
            border: `1px solid ${mode === 'employee' ? '#f97316' : 'transparent'}`,
            color: mode === 'employee' ? '#f97316' : '#64748b',
            transition: 'all .15s',
          }}>📦 員工進貨</button>
          <button onClick={() => bossUnlocked ? setMode('boss') : setShowPinModal(true)} style={{
            padding: '5px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: mode === 'boss' ? 'rgba(249,115,22,0.2)' : 'transparent',
            border: `1px solid ${mode === 'boss' ? '#f97316' : 'transparent'}`,
            color: mode === 'boss' ? '#f97316' : '#64748b',
            transition: 'all .15s',
          }}>🔒 老闆端</button>
        </div>

        {/* 右側按鈕 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mode === 'boss' && (
            <nav style={{ display: 'flex', gap: 4, marginRight: 8 }}>
              {[['overview', '📦 庫存總覽'], ['tx', '🔄 異動紀錄'], ['orders', '📋 進貨申請']].map(([t, l]) => (
                <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
                  {l}
                  {t === 'orders' && pendingCount > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 99, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          )}
          <button onClick={load} disabled={loading} style={{ ...G.btn, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {lastFetch ? lastFetch.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '更新'}
          </button>
          {mode === 'boss' && (
            <button onClick={() => setShowTxModal(true)} style={G.btnPrimary}>＋ 新增異動</button>
          )}
        </div>
      </header>

      <main style={{ padding: '22px 28px', maxWidth: 1300, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ══ 員工端 */}
        {mode === 'employee' && (
          <EmployeeView
            products={products}
            inventory={inventory}
            locations={locations}
            cart={cart}
            setCart={setCart}
          />
        )}

        {/* ══ 老闆端 */}
        {mode === 'boss' && (
          <>
            {/* 統計卡 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                { label: '品項數', value: products.length, color: '#3b82f6' },
                { label: '分店數', value: locations.length, color: '#8b5cf6' },
                { label: '低庫存', value: `${stats.low} 項`, color: stats.low > 0 ? '#f59e0b' : '#10b981' },
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

            {/* 庫存總覽 */}
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

            {/* 異動紀錄 */}
            {tab === 'tx' && (
              <div style={{ ...G.card, padding: 0, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['時間', '類型', '品項', '來源', '目的地', '數量', '操作人員', '備註'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#475569', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr><td colSpan="8" style={{ padding: 30, textAlign: 'center', color: '#475569', fontSize: 13 }}>尚無異動紀錄</td></tr>
                    ) : transactions.map(tx => {
                      const typeMap = { inbound: ['進貨', '#10b981', 'rgba(16,185,129,0.12)'], outbound: ['出貨', '#f59e0b', 'rgba(245,158,11,0.12)'], transfer: ['調貨', '#3b82f6', 'rgba(59,130,246,0.12)'] }
                      const [tLabel, tColor, tBg] = typeMap[tx.type] || ['未知', '#64748b', 'rgba(100,116,139,0.12)']
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

            {/* 進貨申請 */}
            {tab === 'orders' && (
              <PurchaseOrdersTab
                orders={purchaseOrders}
                onApprove={handleApproveOrder}
                onReject={handleRejectOrder}
              />
            )}
          </>
        )}
      </main>

      {showTxModal && (
        <TxModal onClose={() => setShowTxModal(false)} onSubmit={handleTxSubmit} locations={locations} products={products} />
      )}
      {showPinModal && (
        <PinModal
          onClose={() => setShowPinModal(false)}
          onSuccess={() => { setBossUnlocked(true); setMode('boss'); setShowPinModal(false) }}
        />
      )}
    </div>
  )
}
