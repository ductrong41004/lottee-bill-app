import { useEffect, useState } from 'react'
import { createUserWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where, updateDoc } from 'firebase/firestore'
import { db, secondaryAuth, auth, col, BRANCH_PREFIX } from '../firebase'
import { POPULAR_BANKS, fetchVietQRBanks, buildVietQRUrl } from '../utils/vietqr'

export default function AdminSettings() {
  const [employees, setEmployees] = useState([])
  const [banks, setBanks] = useState(POPULAR_BANKS)
  const [form, setForm] = useState({ name: '', username: '' })
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState({ type: '', text: '' })

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })

  const [stkModal, setStkModal] = useState({
    open: false,
    emp: null,
    stk: '',
    bankCode: 'MB',
    bankName: 'MBBank',
    memo: 'Goship chuyen tien thanh toan',
    isEditing: false,
  })
  const [stkSaving, setStkSaving] = useState(false)
  const [stkMsg, setStkMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchVietQRBanks().then((list) => {
      if (list && list.length > 0) setBanks(list)
    })
  }, [])

  function openStkModal(emp) {
    setStkMsg({ type: '', text: '' })
    setStkModal({
      open: true,
      emp,
      stk: emp.stk || '',
      bankCode: emp.bankCode || 'MB',
      bankName: emp.bankName || 'MBBank',
      memo: 'Goship chuyen tien thanh toan',
      isEditing: !emp.stk,
    })
  }

  function closeStkModal() {
    setStkModal({ open: false, emp: null, stk: '', bankCode: 'MB', bankName: 'MBBank', memo: 'Goship chuyen tien thanh toan', isEditing: false })
    setStkMsg({ type: '', text: '' })
  }

  async function handleSaveStk(e) {
    e.preventDefault()
    if (!stkModal.emp) return
    const trimmedStk = (stkModal.stk || '').trim().replace(/\s+/g, '')
    const selectedBank = banks.find((b) => b.code?.toUpperCase() === (stkModal.bankCode || '').toUpperCase()) || {}
    const bankCode = (stkModal.bankCode || selectedBank.code || 'MB').toUpperCase()
    const bankName = selectedBank.shortName || selectedBank.name || bankCode

    if (!trimmedStk) {
      setStkMsg({ type: 'error', text: 'Vui lòng nhập số tài khoản.' })
      return
    }
    setStkSaving(true)
    setStkMsg({ type: '', text: '' })
    try {
      await updateDoc(doc(db, col('users'), stkModal.emp.uid), {
        stk: trimmedStk,
        bankCode,
        bankName,
      })
      setStkModal((prev) => ({
        ...prev,
        isEditing: false,
        stk: trimmedStk,
        bankCode,
        bankName,
        emp: { ...prev.emp, stk: trimmedStk, bankCode, bankName },
      }))
      setStkMsg({ type: 'success', text: 'Đã lưu STK và ngân hàng thành công!' })
    } catch (err) {
      console.error(err)
      setStkMsg({ type: 'error', text: 'Lưu STK thất bại. Vui lòng thử lại.' })
    } finally {
      setStkSaving(false)
    }
  }

  function removeVietnameseTones(str) {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
    str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
    str = str.replace(/đ/g,"d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|R|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|U|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Y|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    str = str.replace(/\u0300|\u0301|\u0309|\u0303|\u0323/g, "");
    str = str.replace(/\u02C6|\u0306|\u031B/g, "");
    return str;
  }

  useEffect(() => {
    const q = query(collection(db, col('users')), where('role', '==', 'employee'))
    return onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
    })
  }, [])

  async function handleCreateEmployee(e) {
    e.preventDefault()
    setCreateMsg({ type: '', text: '' })
    const nameTrimmed = form.name.trim()
    const usernameTrimmed = form.username.trim().toLowerCase().replace(/\s+/g, '')
    if (!nameTrimmed) {
      setCreateMsg({ type: 'error', text: 'Vui lòng nhập họ tên nhân viên.' })
      return
    }
    if (!usernameTrimmed) {
      setCreateMsg({ type: 'error', text: 'Vui lòng nhập tên đăng nhập.' })
      return
    }
    setCreating(true)
    try {
      const randomStr = Math.random().toString(36).substring(2, 6)
      const generatedEmail = `${usernameTrimmed}_${BRANCH_PREFIX || ''}${randomStr}@lottee.internal`
      const defaultPassword = '123456'

      const cred = await createUserWithEmailAndPassword(secondaryAuth, generatedEmail, defaultPassword)
      await setDoc(doc(db, col('users'), cred.user.uid), {
        name: nameTrimmed,
        username: usernameTrimmed,
        email: generatedEmail,
        role: 'employee',
        active: true,
      })
      // Lưu mapping username -> email vào collection usernames để tra cứu khi đăng nhập
      await setDoc(doc(db, col('usernames'), usernameTrimmed), {
        email: generatedEmail,
        uid: cred.user.uid,
      })
      await signOut(secondaryAuth)
      setForm({ name: '', username: '' })
      setCreateMsg({ type: 'success', text: `Đã tạo tài khoản "${usernameTrimmed}" cho nhân viên "${nameTrimmed}".` })
    } catch (err) {
      console.error('Lỗi tạo nhân viên:', err)
      setCreateMsg({ type: 'error', text: `${mapError(err.code)} (${err.code || err.message})` })
    } finally {
      setCreating(false)
    }
  }

  async function deleteEmployee(emp) {
    if (!confirm(`Xóa nhân viên "${emp.name}"? Tài khoản sẽ bị xóa khỏi danh sách và không thể đăng nhập. Hành động này không thể hoàn tác!`)) return
    try {
      await deleteDoc(doc(db, col('users'), emp.uid))
      if (emp.username) {
        await deleteDoc(doc(db, col('usernames'), emp.username))
      }
    } catch (err) {
      console.error(err)
      alert('Xóa thất bại. Vui lòng thử lại.')
    }
  }

  async function editEmployeeName(emp) {
    const newName = prompt(`Nhập tên mới cho nhân viên "${emp.name}":`, emp.name)
    if (newName === null) return
    const trimmed = newName.trim()
    if (!trimmed) {
      alert('Họ tên nhân viên không được để trống.')
      return
    }
    if (trimmed === emp.name) return
    try {
      await updateDoc(doc(db, col('users'), emp.uid), { name: trimmed })
    } catch (err) {
      console.error(err)
      alert('Đổi tên thất bại. Vui lòng thử lại.')
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwMsg({ type: '', text: '' })
    if (pwForm.next.length < 6) {
      setPwMsg({ type: 'error', text: 'Mật khẩu mới phải tối thiểu 6 ký tự.' })
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' })
      return
    }
    setPwSaving(true)
    try {
      const user = auth.currentUser
      if (!user) throw new Error('not-logged-in')
      const credential = EmailAuthProvider.credential(user.email, pwForm.current)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, pwForm.next)
      setPwMsg({ type: 'success', text: '✓ Đổi mật khẩu thành công!' })
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwMsg({ type: 'error', text: 'Mật khẩu hiện tại không đúng.' })
      } else {
        setPwMsg({ type: 'error', text: 'Đổi mật khẩu thất bại. Vui lòng thử lại.' })
      }
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="section-header"><h2>Thêm nhân viên</h2></div>
      <form className="card stack" onSubmit={handleCreateEmployee}>
        <label className="field">
          <span>Họ tên</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Văn A" required />
        </label>
        <label className="field">
          <span>Tên đăng nhập <span className="muted small">(không dấu, không khoảng trắng)</span></span>
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s+/g, '').toLowerCase() })} placeholder="vana" required />
        </label>
        {createMsg.text && (
          <div className={createMsg.type === 'error' ? 'error-text' : 'success-text'}>{createMsg.text}</div>
        )}
        <button className="btn-primary" type="submit" disabled={creating}>
          {creating ? 'Đang tạo…' : 'Tạo tài khoản'}
        </button>
      </form>

      <div className="section-header"><h2>Danh sách nhân viên</h2></div>
      <div className="card">
        <ul className="bill-list">
          {employees.map((emp) => (
            <li key={emp.uid} className="bill-row">
              <span className="bill-code">{emp.name}</span>
              <span className="muted small">Đăng nhập: <strong>{emp.username || '—'}</strong></span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  className="link-btn"
                  onClick={() => editEmployeeName(emp)}
                  style={{ color: 'var(--blue)' }}
                >
                  Sửa tên
                </button>
                <button
                  className="link-btn"
                  onClick={() => deleteEmployee(emp)}
                  style={{ color: 'var(--error)' }}
                >
                  Xóa nhân viên
                </button>
                {emp.stk ? (
                  <button
                    className="link-btn"
                    onClick={() => openStkModal(emp)}
                    style={{ color: 'var(--success)', fontWeight: 600 }}
                  >
                    Xem QR
                  </button>
                ) : (
                  <button
                    className="link-btn"
                    onClick={() => openStkModal(emp)}
                    style={{ color: '#d97706', fontWeight: 600 }}
                  >
                    Nhập STK
                  </button>
                )}
              </div>
            </li>
          ))}
          {employees.length === 0 && <li className="muted small empty">Chưa có nhân viên nào.</li>}
        </ul>
      </div>

      {/* ── Đổi mật khẩu Admin ── */}
      <div className="section-header"><h2>🔑 Đổi mật khẩu Admin</h2></div>
      <form className="card stack" onSubmit={handleChangePassword}>
        <label className="field">
          <span>Mật khẩu hiện tại</span>
          <input
            type="password"
            value={pwForm.current}
            onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
            placeholder="Nhập mật khẩu hiện tại"
            required
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span>Mật khẩu mới <span className="muted small">(tối thiểu 6 ký tự)</span></span>
          <input
            type="password"
            value={pwForm.next}
            onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
            placeholder="Nhập mật khẩu mới"
            required
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>Xác nhận mật khẩu mới</span>
          <input
            type="password"
            value={pwForm.confirm}
            onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
            placeholder="Nhập lại mật khẩu mới"
            required
            autoComplete="new-password"
          />
        </label>
        {pwMsg.text && (
          <div className={pwMsg.type === 'error' ? 'error-text' : 'success-text'}>{pwMsg.text}</div>
        )}
        <button className="btn-primary" type="submit" disabled={pwSaving}>
          {pwSaving ? 'Đang đổi…' : 'Đổi mật khẩu'}
        </button>
      </form>

      {/* ── Modal Nhập STK / Xem QR ── */}
      {stkModal.open && stkModal.emp && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={closeStkModal}
        >
          <div
            style={{
              background: '#fff', borderRadius: '18px', padding: '24px',
              width: '100%', maxWidth: '380px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--navy)' }}>
                {stkModal.isEditing ? '💳 Nhập số tài khoản' : '📷 Mã QR Nhân Viên'}
              </h3>
              <button
                onClick={closeStkModal}
                style={{
                  background: 'none', border: 'none', fontSize: '22px',
                  cursor: 'pointer', color: 'var(--ink-soft)', lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--ink-soft)' }}>
              Nhân viên: <strong style={{ color: 'var(--ink)' }}>{stkModal.emp.name}</strong>
              {stkModal.emp.username && <span> ({stkModal.emp.username})</span>}
            </p>

            {stkModal.isEditing ? (
              <form onSubmit={handleSaveStk} className="stack" style={{ gap: '14px' }}>
                <label className="field">
                  <span>Ngân hàng</span>
                  <select
                    value={stkModal.bankCode}
                    onChange={(e) => {
                      const selected = banks.find((b) => b.code === e.target.value)
                      setStkModal({
                        ...stkModal,
                        bankCode: e.target.value,
                        bankName: selected?.shortName || e.target.value,
                      })
                    }}
                    style={{
                      width: '100%', padding: '11px 12px', borderRadius: '10px',
                      border: '1.5px solid var(--line)', background: '#fff',
                      fontSize: '14px', fontWeight: '600', color: 'var(--ink)',
                    }}
                  >
                    {banks.map((b) => (
                      <option key={b.code || b.bin} value={b.code}>
                        {b.shortName || b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Số tài khoản (STK)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={stkModal.stk}
                    onChange={(e) => setStkModal({ ...stkModal, stk: e.target.value.replace(/\s+/g, '') })}
                    placeholder="Nhập STK ngân hàng..."
                    required
                    autoFocus
                  />
                </label>

                {stkMsg.text && (
                  <div className={stkMsg.type === 'error' ? 'error-text' : 'success-text'} style={{ fontSize: '13px' }}>
                    {stkMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (stkModal.emp.stk) {
                        setStkModal((prev) => ({ ...prev, isEditing: false }))
                      } else {
                        closeStkModal()
                      }
                    }}
                    style={{
                      flex: 1, padding: '11px', borderRadius: '10px',
                      border: '1.5px solid var(--line)', background: 'var(--paper)',
                      fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={stkSaving}
                    style={{ flex: 1.5, padding: '11px' }}
                  >
                    {stkSaving ? 'Đang lưu…' : 'Lưu & Tạo QR'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                {/* Thông tin STK */}
                <div style={{
                  background: '#f8fafc', padding: '14px', borderRadius: '12px',
                  border: '1px solid var(--line)', marginBottom: '16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '2px' }}>
                      Ngân hàng: <strong style={{ color: 'var(--ink)' }}>{stkModal.bankName || stkModal.bankCode}</strong>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--navy)', letterSpacing: '0.5px' }}>
                      {stkModal.stk}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                      Chủ TK: <strong style={{ color: 'var(--ink)' }}>{stkModal.emp.name}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(stkModal.stk)
                      alert(`Đã copy số tài khoản: ${stkModal.stk}`)
                    }}
                    style={{
                      padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)',
                      background: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    📋 Copy STK
                  </button>
                </div>

                {/* Cú pháp nội dung chuyển khoản */}
                <label className="field" style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--navy)' }}>
                    📝 Nội dung chuyển khoản:
                  </span>
                  <input
                    type="text"
                    value={stkModal.memo}
                    onChange={(e) => setStkModal({ ...stkModal, memo: e.target.value })}
                    placeholder="Goship chuyen tien thanh toan"
                    style={{
                      padding: '9px 12px', borderRadius: '10px',
                      border: '1.5px solid var(--line)', fontSize: '13px',
                      background: '#fff', fontWeight: '500',
                    }}
                  />
                </label>

                {/* VietQR Image Container */}
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{
                    background: '#fff', padding: '8px', borderRadius: '16px',
                    border: '1.5px solid var(--line)', display: 'inline-block',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%',
                    maxWidth: '300px', boxSizing: 'border-box',
                  }}>
                    <img
                      src={buildVietQRUrl({
                        bankCode: stkModal.bankCode || 'MB',
                        stk: stkModal.stk,
                        accountName: stkModal.emp.name,
                        addInfo: stkModal.memo || '',
                        template: 'compact',
                      })}
                      alt="VietQR Code"
                      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '10px' }}
                      loading="lazy"
                    />
                  </div>
                </div>

                {stkMsg.text && (
                  <div className={stkMsg.type === 'error' ? 'error-text' : 'success-text'} style={{ fontSize: '13px', marginBottom: '12px' }}>
                    {stkMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setStkModal((prev) => ({ ...prev, isEditing: true }))}
                    style={{
                      flex: 1, padding: '11px', borderRadius: '10px',
                      border: '1.5px solid var(--line)', background: 'var(--paper)',
                      color: 'var(--navy)', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                    }}
                  >
                    ✏️ Sửa STK
                  </button>
                  <button
                    type="button"
                    onClick={closeStkModal}
                    className="btn-primary"
                    style={{ flex: 1, padding: '11px' }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function mapError(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Email này đã được sử dụng.'
    case 'auth/invalid-email':
      return 'Email không hợp lệ.'
    case 'auth/weak-password':
      return 'Mật khẩu quá yếu (tối thiểu 6 ký tự).'
    default:
      return 'Tạo tài khoản thất bại. Vui lòng thử lại.'
  }
}
