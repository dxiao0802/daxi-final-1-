/**
 * 大西庫存管理系統
 * 老闆端：庫存總覽 + 異動紀錄 + 進貨審核
 * 員工端：進貨購物車
 */
import { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react'
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

// ── i18n
const LangContext = createContext('zh')
const useLang = () => useContext(LangContext)

const T = {
  zh: {
    appName: '大西庫存管理系統',
    statusCritical: '嚴重不足', statusLow: '庫存偏低', statusOk: '正常',
    allOk: '✅ 所有分店庫存正常',
    shortageTitle: '分店缺貨快報', shortageMissing: '缺：',
    breakdownTitle: '各分店庫存水位', breakdownChart: '庫存量 vs 安全水位',
    stockQty: '庫存量', safeLevel: '安全水位',
    txTitle: '新增異動單',
    txInbound: '進貨入倉', txOutbound: '出貨領料', txTransfer: '分店調貨',
    product: '品項 *', selectProduct: '請選擇品項',
    fromWarehouse: '來源倉庫 *', fromTransfer: '調出地點 *',
    toInbound: '進貨至 *', toTransfer: '調入分店 *',
    select: '請選擇',
    qty: '數量 *', operator: '操作人員', namePh: '姓名',
    note: '備註', optional: '選填',
    cancel: '取消', confirm: '確認送出',
    stockLabel: '庫存', notSet: '未設定', addBtn: '加入',
    submitted: '✅ 進貨申請已送出！請等待老闆在老闆端確認。',
    cartTitle: '進貨清單',
    cartCount: (n) => `已選 ${n} 項`,
    viewCart: '查看清單 →',
    destination: '送達地點 *', selectDest: '請選擇地點',
    yourName: '你的名字 *', empNamePh: '操作員工姓名',
    noteOptional: '備註（選填）', notePh: '例如：緊急補貨',
    submitting: '送出中...', submitBtn: '✓ 送出進貨申請',
    orderTitle: (op) => `${op} 的進貨申請`,
    orderNoteLabel: '備註：',
    statusPending: '待審核', statusApproved: '已核准', statusRejected: '已拒絕', statusUnknown: '未知',
    pendingSection: (n) => `待審核 (${n})`,
    doneSection: (n) => `已處理 (${n})`,
    unknownProduct: '未知品項',
    approve: '核准並入庫', reject: '拒絕',
    noOrders: '目前沒有進貨申請',
    pinTitle: '老闆端密碼', pinSub: '輸入密碼進入管理介面',
    pinError: '密碼錯誤，請再試一次',
    empMode: '員工進貨', bossMode: '老闆端',
    tabOverview: '庫存總覽', tabTx: '異動紀錄', tabOrders: '進貨申請',
    statProducts: '品項數', statLocations: '分店數', statLow: '低庫存', statCritical: '嚴重缺貨',
    statUnit: '項',
    tip: '💡 點擊品項列可展開查看各分店庫存水位',
    loading: '載入中...',
    txHeaders: ['時間', '類型', '品項', '來源', '目的地', '數量', '操作人員', '備註'],
    noTx: '尚無異動紀錄',
    txInboundLabel: '進貨', txOutboundLabel: '出貨', txTransferLabel: '調貨',
    external: '外部', refresh: '更新', addTx: '新增異動',
    alertProductQty: '請填寫品項與數量',
    alertFrom: '請選擇來源', alertTo: '請選擇目的地',
    submitFail: '送出失敗：',
    approveNote: (op) => `進貨申請核准（申請人：${op}）`,
    langBtn: 'Tiếng Việt',
  },
  vi: {
    appName: 'Kho Đại Tây',
    statusCritical: 'Hết hàng', statusLow: 'Hàng ít', statusOk: 'Đủ hàng',
    allOk: '✅ Tất cả chi nhánh đủ hàng',
    shortageTitle: 'BÁO THIẾU HÀNG', shortageMissing: 'Thiếu:',
    breakdownTitle: 'Tồn kho chi nhánh', breakdownChart: 'Tồn kho vs Mức an toàn',
    stockQty: 'Tồn kho', safeLevel: 'Mức an toàn',
    txTitle: 'Thêm giao dịch',
    txInbound: 'Nhập kho', txOutbound: 'Xuất hàng', txTransfer: 'Điều chuyển',
    product: 'Sản phẩm *', selectProduct: 'Chọn sản phẩm',
    fromWarehouse: 'Kho nguồn *', fromTransfer: 'Địa điểm xuất *',
    toInbound: 'Nhập vào *', toTransfer: 'Chi nhánh nhận *',
    select: 'Chọn',
    qty: 'Số lượng *', operator: 'Người thực hiện', namePh: 'Tên',
    note: 'Ghi chú', optional: 'Tuỳ chọn',
    cancel: 'Hủy', confirm: 'Xác nhận',
    stockLabel: 'Kho', notSet: 'Chưa cài', addBtn: 'Thêm',
    submitted: '✅ Đã gửi yêu cầu! Chờ xác nhận từ quản lý.',
    cartTitle: 'Danh sách nhập',
    cartCount: (n) => `Đã chọn ${n} món`,
    viewCart: 'Xem danh sách →',
    destination: 'Địa điểm giao *', selectDest: 'Chọn địa điểm',
    yourName: 'Tên của bạn *', empNamePh: 'Tên nhân viên',
    noteOptional: 'Ghi chú (tuỳ chọn)', notePh: 'Ví dụ: Nhập gấp',
    submitting: 'Đang gửi...', submitBtn: '✓ Gửi yêu cầu nhập hàng',
    orderTitle: (op) => `Yêu cầu nhập hàng của ${op}`,
    orderNoteLabel: 'Ghi chú:',
    statusPending: 'Chờ duyệt', statusApproved: 'Đã duyệt', statusRejected: 'Đã từ chối', statusUnknown: 'Không rõ',
    pendingSection: (n) => `Chờ duyệt (${n})`,
    doneSection: (n) => `Đã xử lý (${n})`,
    unknownProduct: 'Sản phẩm không rõ',
    approve: 'Duyệt & nhập kho', reject: 'Từ chối',
    noOrders: 'Hiện chưa có yêu cầu nhập hàng',
    pinTitle: 'Mật khẩu quản lý', pinSub: 'Nhập mật khẩu để vào trang quản lý',
    pinError: 'Sai mật khẩu, thử lại',
    empMode: 'Nhân viên', bossMode: 'Quản lý',
    tabOverview: 'Tổng quan', tabTx: 'Lịch sử', tabOrders: 'Yêu cầu',
    statProducts: 'Sản phẩm', statLocations: 'Chi nhánh', statLow: 'Hàng ít', statCritical: 'Thiếu nghiêm trọng',
    statUnit: 'mặt',
    tip: '💡 Nhấn vào hàng để xem mức tồn kho chi nhánh',
    loading: 'Đang tải...',
    txHeaders: ['Thời gian', 'Loại', 'Sản phẩm', 'Nguồn', 'Đích', 'Số lượng', 'Nhân viên', 'Ghi chú'],
    noTx: 'Chưa có lịch sử giao dịch',
    txInboundLabel: 'Nhập hàng', txOutboundLabel: 'Xuất hàng', txTransferLabel: 'Điều chuyển',
    external: 'Bên ngoài', refresh: 'Cập nhật', addTx: 'Thêm giao dịch',
    alertProductQty: 'Vui lòng nhập sản phẩm và số lượng',
    alertFrom: 'Vui lòng chọn nguồn', alertTo: 'Vui lòng chọn đích',
    submitFail: 'Gửi thất bại:',
    approveNote: (op) => `Duyệt yêu cầu nhập hàng (người nộp: ${op})`,
    langBtn: '中文',
  }
}

function useIsMobile() {
  const [v, setV] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setV(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return v
}

function getStatus(pct) {
  if (pct < 40) return { key: 'critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', pulse: true }
  if (pct < 75) return { key: 'low', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', pulse: false }
  return { key: 'ok', color: '#10b981', bg: 'rgba(16,185,129,0.12)', pulse: false }
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
  const lang = useLang()
  const t = T[lang]
  const entries = Object.entries(shortage)
  if (!entries.length) return (
    <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#10b981' }}>
      {t.allOk}
    </div>
  )
  return (
    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <AlertTriangle size={13} color="#ef4444" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '.08em' }}>{t.shortageTitle}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {entries.map(([loc, items]) => (
          <div key={loc} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: '5px 12px', fontSize: 12, display: 'flex', gap: 6 }}>
            <span style={{ color: STORE_COLORS[loc] || '#94a3b8', fontWeight: 600 }}>{loc}</span>
            <span style={{ color: '#64748b' }}>{t.shortageMissing}</span>
            <span style={{ color: '#fca5a5' }}>{items.join('、')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 展開面板
function StoreBreakdown({ productName, matrix, locations }) {
  const lang = useLang()
  const t = T[lang]
  const chartData = locations.map(loc => {
    const r = matrix[productName]?.[loc]
    if (!r) return null
    return { name: loc.replace('分店', '').replace('倉庫', '倉'), stockQty: r.quantity, safeLevel: r.threshold, color: STORE_COLORS[loc] || '#64748b' }
  }).filter(Boolean)

  return (
    <div style={{ animation: 'expandRow .2s ease', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '18px 20px' }}>
      <div className="breakdown-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, letterSpacing: '.08em' }}>{t.breakdownTitle}</div>
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
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 600, animation: st.pulse ? 'pulseBar 1.4s infinite' : 'none' }}>{t['status' + st.key.charAt(0).toUpperCase() + st.key.slice(1)]}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>{r.quantity}/{r.threshold}{r.unit}</span>
                  </div>
                </div>
                <StockBar qty={r.quantity} threshold={r.threshold} height={7} />
              </div>
            )
          })}
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, letterSpacing: '.08em' }}>{t.breakdownChart}</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="stockQty" name={t.stockQty} radius={[4, 4, 0, 0]}>{chartData.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
              <Bar dataKey="safeLevel" name={t.safeLevel} fill="rgba(255,255,255,0.08)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ── 異動 Modal（老闆用）
function TxModal({ onClose, onSubmit, locations, products }) {
  const lang = useLang()
  const t = T[lang]
  const [type, setType] = useState('outbound')
  const [form, setForm] = useState({ productId: '', fromId: '', toId: '', qty: '', operator: '', note: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const warehouses = locations.filter(l => l.type === 'warehouse')
  const branches = locations.filter(l => l.type === 'branch')

  const handleSave = () => {
    if (!form.productId || !form.qty || parseInt(form.qty) < 1) { alert(t.alertProductQty); return }
    if (type !== 'inbound' && !form.fromId) { alert(t.alertFrom); return }
    if (type !== 'outbound' && !form.toId) { alert(t.alertTo); return }
    onSubmit({ type, ...form, qty: parseInt(form.qty) })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#151b27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{t.txTitle}</span>
          <button onClick={onClose} style={{ ...G.btn, padding: '4px 10px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['inbound', t.txInbound], ['outbound', t.txOutbound], ['transfer', t.txTransfer]].map(([k, v]) => (
              <button key={k} onClick={() => setType(k)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: type === k ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${type === k ? '#f97316' : 'rgba(255,255,255,0.08)'}`, color: type === k ? '#f97316' : '#64748b', fontFamily: 'inherit' }}>{v}</button>
            ))}
          </div>
          <div>
            <label style={G.label}>{t.product}</label>
            <select value={form.productId} onChange={e => set('productId', e.target.value)} style={G.input}>
              <option value="">{t.selectProduct}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {type !== 'inbound' && (
            <div>
              <label style={G.label}>{type === 'transfer' ? t.fromTransfer : t.fromWarehouse}</label>
              <select value={form.fromId} onChange={e => set('fromId', e.target.value)} style={G.input}>
                <option value="">{t.select}</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          {type !== 'outbound' && (
            <div>
              <label style={G.label}>{type === 'inbound' ? t.toInbound : t.toTransfer}</label>
              <select value={form.toId} onChange={e => set('toId', e.target.value)} style={G.input}>
                <option value="">{t.select}</option>
                {(type === 'inbound' ? warehouses : branches).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={G.label}>{t.qty}</label>
              <input type="number" min="1" placeholder="0" value={form.qty} onChange={e => set('qty', e.target.value)} style={G.input} />
            </div>
            <div>
              <label style={G.label}>{t.operator}</label>
              <input placeholder={t.namePh} value={form.operator} onChange={e => set('operator', e.target.value)} style={G.input} />
            </div>
          </div>
          <div>
            <label style={G.label}>{t.note}</label>
            <input placeholder={t.optional} value={form.note} onChange={e => set('note', e.target.value)} style={G.input} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={G.btn}>{t.cancel}</button>
          <button onClick={handleSave} style={G.btnPrimary}>{t.confirm}</button>
        </div>
      </div>
    </div>
  )
}

const CARD_COLORS = ['#f97316','#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16','#a855f7']

// 品項中越對照
const PRODUCT_VI = {
  '大腸':         'Lòng heo',
  '魷魚':         'Mực',
  '蚵仔':         'Hàu',
  '麵線':         'Mì sợi',
  '750 杯':       'Ly 750',
  '750 蓋':       'Nắp 750',
  '520 杯':       'Ly 520',
  '520 蓋':       'Nắp 520',
  '390 杯':       'Ly 390',
  '390 蓋':       'Nắp 390',
  '雞排':         'Gà chiên',
  '雞翅':         'Cánh gà',
  '豆付':         'Đậu hũ',
  '泡菜':         'Kim chi',
  '8 兩紙袋':     'Túi giấy 8 lạng',
  '6 兩紙袋':     'Túi giấy 6 lạng',
  '4 兩紙袋':     'Túi giấy 4 lạng',
  '西瓜汁':       'Nước dưa hấu',
  '冰塊':         'Đá viên',
  '蔬菜泥':       'Rau xay',
  '豬血糕醬':     'Sốt tiết hấp',
  '大豬':         'Heo lớn',
  '小豬':         'Heo nhỏ',
  '透明大麵線袋': 'Túi mì lớn',
  '一袋杯紅':     'Túi ly đỏ',
  '購物袋':       'Túi xách',
  '香菜':         'Ngò rí',
}

// ── 員工：商品卡片
function ProductCard({ product, cartQty, onAdd, onRemove, stockInfo }) {
  const lang = useLang()
  const t = T[lang]
  const color = CARD_COLORS[product.name.charCodeAt(0) % CARD_COLORS.length]
  const pct = stockInfo ? Math.min(100, Math.round(stockInfo.quantity / (stockInfo.threshold || 1) * 100)) : null
  const st = pct !== null ? getStatus(pct) : null
  const viName = PRODUCT_VI[product.name]

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '18px 12px 10px', position: 'relative' }}>
        {st && (
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, padding: '2px 6px', borderRadius: 99, background: st.bg, color: st.color, fontWeight: 700 }}>
            {t['status' + st.key.charAt(0).toUpperCase() + st.key.slice(1)]}
          </span>
        )}
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: `linear-gradient(135deg,${color}cc,${color}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', fontWeight: 800, letterSpacing: '-0.02em', boxShadow: `0 4px 16px ${color}44` }}>
          {product.name.slice(0, 2)}
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '0 10px 4px', lineHeight: 1.4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{product.name}</div>
        {viName && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{viName}</div>}
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#475569', paddingBottom: 12 }}>
        {stockInfo ? `${t.stockLabel} ${stockInfo.quantity}${stockInfo.unit}` : t.notSet}
      </div>
      <div style={{ marginTop: 'auto' }}>
        {cartQty === 0 ? (
          <button onClick={onAdd} style={{ width: '100%', background: color, color: '#fff', border: 'none', padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Plus size={14} /> {t.addBtn}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={onRemove} style={{ flex: 1, padding: '10px', fontSize: 18, background: 'none', border: 'none', color: '#f1f5f9', cursor: 'pointer', lineHeight: 1 }}>−</button>
            <span style={{ fontSize: 17, fontWeight: 700, color, minWidth: 32, textAlign: 'center', fontFamily: 'monospace' }}>{cartQty}</span>
            <button onClick={onAdd} style={{ flex: 1, padding: '10px', fontSize: 18, background: 'none', border: 'none', color: '#f1f5f9', cursor: 'pointer', lineHeight: 1 }}>＋</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 員工主畫面
function EmployeeView({ products, inventory, locations, cart, setCart }) {
  const lang = useLang()
  const t = T[lang]
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const [operator, setOperator] = useState('')
  const [toId, setToId] = useState('')
  const [note, setNote] = useState('')

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
    const m = {}; cart.forEach(i => { m[i.productId] = i.qty }); return m
  }, [cart])

  const cartTotal = cart.reduce((s, i) => s + i.qty, 0)
  const canSubmit = cart.length > 0 && operator.trim() && toId && !submitting

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
    qty <= 0 ? prev.filter(i => i.productId !== productId)
             : prev.map(i => i.productId === productId ? { ...i, qty } : i)
  )

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const { data: order, error } = await supabase
        .from('purchase_orders')
        .insert({ status: 'pending', operator, note: note || null, to_location: toId })
        .select().single()
      if (error) throw error
      await supabase.from('purchase_order_items').insert(
        cart.map(i => ({ order_id: order.id, product_id: i.productId, quantity: i.qty }))
      )
      setCart([]); setShowSheet(false); setOperator(''); setToId(''); setNote('')
      setSubmitted(true); setTimeout(() => setSubmitted(false), 5000)
    } catch (e) { alert(t.submitFail + e.message) }
    setSubmitting(false)
  }

  return (
    <div style={{ paddingBottom: cartTotal > 0 ? 76 : 0 }}>
      {submitted && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '13px 18px', marginBottom: 16, color: '#10b981', fontSize: 14, fontWeight: 600 }}>
          {t.submitted}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12 }}>
        {products.map(p => (
          <ProductCard key={p.id} product={p} cartQty={cartMap[p.id] || 0}
            onAdd={() => addToCart(p)} onRemove={() => removeOnce(p)}
            stockInfo={stockByName[p.name]} />
        ))}
      </div>

      {/* 底部 Bar */}
      {cartTotal > 0 && (
        <div onClick={() => setShowSheet(true)} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(135deg,#f97316,#ea580c)', padding: '14px 20px', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 -4px 20px rgba(249,115,22,0.4)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>{cartTotal}</div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t.cartCount(cartTotal)}</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{t.viewCart}</span>
        </div>
      )}

      {/* 結帳抽屜 */}
      {showSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => setShowSheet(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#151b27', borderRadius: '20px 20px 0 0', padding: '16px 20px 36px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{t.cartTitle}</span>
              <span style={{ fontSize: 13, color: '#f97316', fontWeight: 600 }}>{cartTotal} {lang === 'zh' ? '項' : 'món'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {cart.map(item => (
                <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{item.productName}</span>
                  <button onClick={() => setQty(item.productId, item.qty - 1)} style={{ ...G.btn, padding: '3px 10px', fontSize: 15, minWidth: 30 }}>−</button>
                  <span style={{ fontSize: 15, fontFamily: 'monospace', minWidth: 24, textAlign: 'center', color: '#f97316', fontWeight: 700 }}>{item.qty}</span>
                  <button onClick={() => setQty(item.productId, item.qty + 1)} style={{ ...G.btn, padding: '3px 10px', fontSize: 15, minWidth: 30 }}>＋</button>
                  <button onClick={() => setCart(prev => prev.filter(i => i.productId !== item.productId))} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: '3px 6px' }}>✕</button>
                </div>
              ))}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', margin: '0 0 14px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={G.label}>{t.destination}</label>
                <select value={toId} onChange={e => setToId(e.target.value)} style={G.input}>
                  <option value="">{t.selectDest}</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label style={G.label}>{t.yourName}</label>
                <input placeholder={t.empNamePh} value={operator} onChange={e => setOperator(e.target.value)} style={G.input} />
              </div>
              <div>
                <label style={G.label}>{t.noteOptional}</label>
                <input placeholder={t.notePh} value={note} onChange={e => setNote(e.target.value)} style={G.input} />
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit} style={{ ...G.btnPrimary, width: '100%', textAlign: 'center', padding: 14, fontSize: 15, opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
                {submitting ? t.submitting : t.submitBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 老闆：進貨申請 Tab
function PurchaseOrdersTab({ orders, onApprove, onReject }) {
  const lang = useLang()
  const t = T[lang]
  const pending = orders.filter(o => o.status === 'pending')
  const done = orders.filter(o => o.status !== 'pending')

  const statusMap = {
    pending: [t.statusPending, '#f59e0b', 'rgba(245,158,11,0.12)'],
    approved: [t.statusApproved, '#10b981', 'rgba(16,185,129,0.12)'],
    rejected: [t.statusRejected, '#ef4444', 'rgba(239,68,68,0.12)'],
  }

  const OrderCard = ({ order }) => {
    const [sLabel, sColor, sBg] = statusMap[order.status] || [t.statusUnknown, '#64748b', 'rgba(100,116,139,0.12)']
    return (
      <div style={{ ...G.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {t.orderTitle(order.operator)}
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
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{t.orderNoteLabel}{order.note}</div>
            )}
          </div>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: sBg, color: sColor, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {sLabel}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: order.status === 'pending' ? 14 : 0 }}>
          {order.items?.map(item => (
            <div key={item.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '5px 13px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{item.products?.name || t.unknownProduct}</span>
              <span style={{ color: '#f97316', fontFamily: 'monospace', fontWeight: 700 }}>×{item.quantity}</span>
            </div>
          ))}
        </div>

        {order.status === 'pending' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onApprove(order)} style={{ ...G.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px' }}>
              <Check size={14} /> {t.approve}
            </button>
            <button onClick={() => onReject(order.id)} style={{ ...G.btn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}>
              {t.reject}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (orders.length === 0) return (
    <div style={{ ...G.card, textAlign: 'center', padding: '44px 20px', color: '#475569', fontSize: 14 }}>
      {t.noOrders}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {pending.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 10, fontWeight: 600, letterSpacing: '.06em' }}>
            {t.pendingSection(pending.length)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(o => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 10, letterSpacing: '.06em' }}>
            {t.doneSection(done.length)}
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
  const lang = useLang()
  const t = T[lang]
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
          <div style={{ fontSize: 16, fontWeight: 700 }}>{t.pinTitle}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{t.pinSub}</div>
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
        {error && <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginBottom: 10 }}>{t.pinError}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...G.btn, flex: 1 }}>{t.cancel}</button>
          <button onClick={check} style={{ ...G.btnPrimary, flex: 1 }}>{t.confirm}</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN
export default function App() {
  const isMobile = useIsMobile()
  const [lang, setLang] = useState('zh')
  const t = T[lang]
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
        note: t.approveNote(order.operator),
      })
    }
    await supabase.from('purchase_orders').update({ status: 'approved' }).eq('id', order.id)
    load()
  }

  const handleRejectOrder = async (orderId) => {
    await supabase.from('purchase_orders').update({ status: 'rejected' }).eq('id', orderId)
    load()
  }

  const tabStyle = (tb) => ({
    padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
    background: tab === tb ? 'rgba(249,115,22,0.15)' : 'transparent',
    border: `1px solid ${tab === tb ? '#f97316' : 'transparent'}`,
    color: tab === tb ? '#f97316' : '#64748b',
    position: 'relative',
  })

  return (
    <LangContext.Provider value={lang}>
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
          @media(max-width:767px){
            .hdr{height:auto!important;padding:8px 12px!important;flex-wrap:wrap!important;gap:8px!important;}
            .hdr-logo{flex:1!important;}
            .hdr-sub{display:none!important;}
            .hdr-mode-text{display:none!important;}
            .hdr-right-boss{flex:1 0 100%!important;justify-content:space-between!important;}
            .hdr-time-txt{display:none!important;}
            .hdr-new-text{display:none!important;}
            .main-cnt{padding:14px 12px!important;}
            .stats-grid{grid-template-columns:repeat(2,1fr)!important;}
            .breakdown-grid{grid-template-columns:1fr!important;}
          }
        `}</style>

        {/* HEADER */}
        <header className="hdr" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(13,17,23,0.98)', position: 'sticky', top: 0, zIndex: 50 }}>
          {/* Logo */}
          <div className="hdr-logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🏪</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t.appName}</div>
              <div className="hdr-sub" style={{ fontSize: 9, color: '#475569', letterSpacing: '.1em' }}>DAXI INVENTORY</div>
            </div>
          </div>

          {/* 模式切換 */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, gap: 2, flexShrink: 0 }}>
            <button onClick={() => { setMode('employee'); setBossUnlocked(false) }} style={{
              padding: '5px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              background: mode === 'employee' ? 'rgba(249,115,22,0.2)' : 'transparent',
              border: `1px solid ${mode === 'employee' ? '#f97316' : 'transparent'}`,
              color: mode === 'employee' ? '#f97316' : '#64748b', transition: 'all .15s',
            }}>📦 <span className="hdr-mode-text">{t.empMode}</span></button>
            <button onClick={() => bossUnlocked ? setMode('boss') : setShowPinModal(true)} style={{
              padding: '5px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              background: mode === 'boss' ? 'rgba(249,115,22,0.2)' : 'transparent',
              border: `1px solid ${mode === 'boss' ? '#f97316' : 'transparent'}`,
              color: mode === 'boss' ? '#f97316' : '#64748b', transition: 'all .15s',
            }}>🔒 <span className="hdr-mode-text">{t.bossMode}</span></button>
          </div>

          {/* 右側按鈕 */}
          <div className={`hdr-right${mode === 'boss' ? ' hdr-right-boss' : ''}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {mode === 'boss' && (
              <nav style={{ display: 'flex', gap: 4, overflowX: 'auto', marginRight: 8 }}>
                {[['overview', '📦', t.tabOverview], ['tx', '🔄', t.tabTx], ['orders', '📋', t.tabOrders]].map(([tb, icon, label]) => (
                  <button key={tb} onClick={() => setTab(tb)} style={tabStyle(tb)}>
                    {icon} <span className="hdr-mode-text">{label}</span>
                    {tb === 'orders' && pendingCount > 0 && (
                      <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 99, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {pendingCount}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            )}
            {/* 語言切換 */}
            <button
              onClick={() => setLang(l => l === 'zh' ? 'vi' : 'zh')}
              style={{ ...G.btn, fontSize: 11, padding: '5px 10px', flexShrink: 0, color: '#f97316', borderColor: 'rgba(249,115,22,0.3)' }}
            >
              🌐 {t.langBtn}
            </button>
            <button onClick={load} disabled={loading} style={{ ...G.btn, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexShrink: 0 }}>
              <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              <span className="hdr-time-txt">{lastFetch ? lastFetch.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : t.refresh}</span>
            </button>
            {mode === 'boss' && (
              <button onClick={() => setShowTxModal(true)} style={{ ...G.btnPrimary, flexShrink: 0 }}>
                ＋ <span className="hdr-new-text">{t.addTx}</span>
              </button>
            )}
          </div>
        </header>

        <main className="main-cnt" style={{ padding: '22px 28px', maxWidth: 1300, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

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
              <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {[
                  { label: t.statProducts, value: products.length, color: '#3b82f6' },
                  { label: t.statLocations, value: locations.length, color: '#8b5cf6' },
                  { label: t.statLow, value: `${stats.low} ${t.statUnit}`, color: stats.low > 0 ? '#f59e0b' : '#10b981' },
                  { label: t.statCritical, value: `${stats.critical} ${t.statUnit}`, color: stats.critical > 0 ? '#ef4444' : '#10b981', pulse: stats.critical > 0 },
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
                  <div style={{ fontSize: 12, color: '#475569' }}>{t.tip}</div>
                  <div style={{ ...G.card, padding: 0, overflow: 'auto' }}>
                    {loading ? (
                      <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>{t.loading}</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#475569', fontWeight: 500 }}>{t.statProducts}</th>
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
                        {t.txHeaders.map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#475569', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr><td colSpan="8" style={{ padding: 30, textAlign: 'center', color: '#475569', fontSize: 13 }}>{t.noTx}</td></tr>
                      ) : transactions.map(tx => {
                        const typeMap = {
                          inbound: [t.txInboundLabel, '#10b981', 'rgba(16,185,129,0.12)'],
                          outbound: [t.txOutboundLabel, '#f59e0b', 'rgba(245,158,11,0.12)'],
                          transfer: [t.txTransferLabel, '#3b82f6', 'rgba(59,130,246,0.12)'],
                        }
                        const [tLabel, tColor, tBg] = typeMap[tx.type] || [t.statusUnknown, '#64748b', 'rgba(100,116,139,0.12)']
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
                            <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>{tx.from_loc?.name || t.external}</td>
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
    </LangContext.Provider>
  )
}
