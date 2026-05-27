import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUsers, createUser, updateUser } from '../api/users'
import { getOrganizations, createOrganization, updateOrganization } from '../api/organizations'
import { getObjects, createObject, getObjectMembers, addObjectMember, removeObjectMember, getObjectOrganizations, addObjectOrganization } from '../api/objects'
import { getDocuments, createDocument, updateDocument } from '../api/documents'
import client from '../api/client'
import styles from './AdminPage.module.css'

const ROLE_OPTIONS = [
  { value: 'client_rep', label: 'Представитель заказчика' },
  { value: 'supervisor', label: 'Технадзор' },
  { value: 'foreman',    label: 'Прораб' },
]
const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]))

const ORG_TYPE_OPTIONS = [
  { value: 'customer',           label: 'Заказчик' },
  { value: 'general_contractor', label: 'Генподрядчик' },
  { value: 'subcontractor',      label: 'Подрядная организация' },
]
const ORG_TYPE_LABELS = Object.fromEntries(ORG_TYPE_OPTIONS.map(o => [o.value, o.label]))

const DOC_TYPE_OPTIONS = [
  { value: 'normative', label: 'Нормативный (общий)' },
  { value: 'project',   label: 'Проектный (привязан к объекту)' },
]

export default function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('organizations')

  // --- Данные ---
  const [organizations, setOrganizations] = useState([])
  const [users, setUsers]                 = useState([])
  const [objects, setObjects]             = useState([])
  const [workTypes, setWorkTypes]         = useState([])
  const [documents, setDocuments]         = useState([])

  // --- Выбранный объект для управления участниками ---
  const [selectedObject, setSelectedObject]         = useState(null)
  const [objectMembers, setObjectMembers]           = useState([])
  const [objectOrgs, setObjectOrgs]                 = useState([])

  // --- Модалки ---
  const [modal, setModal] = useState(null) // 'createUser' | 'createOrg' | 'createObject' | 'createDoc' | 'password' | 'addMember' | 'addOrgToObject'

  // --- Формы ---
  const [newUser, setNewUser]     = useState({ full_name: '', email: '', password: '', role: 'supervisor', position: ROLE_LABELS['supervisor'], organization_id: '', object_ids: [] })
  const [newOrg, setNewOrg]       = useState({ name: '', type: 'customer' })
  const [newObject, setNewObject] = useState({ name: '', description: '', date_start: '', date_end: '' })
  const [newDoc, setNewDoc]       = useState({ name: '', short_name: '', doc_type: 'normative', object_id: '' })
  const [newName, setNewName]     = useState('')
  const [passwordTarget, setPasswordTarget] = useState(null)
  const [newPassword, setNewPassword]       = useState('')
  const [addMemberUserId, setAddMemberUserId]   = useState('')
  const [addOrgData, setAddOrgData]             = useState({ organization_id: '', role: 'subcontractor' })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = () => {
    getOrganizations({ active_only: false }).then(setOrganizations)
    getUsers().then(setUsers)
    getObjects().then(setObjects)
    client.get('/work-types', { params: { active_only: false } }).then(r => setWorkTypes(r.data))
    getDocuments().then(setDocuments)
  }

  const loadObjectDetails = async (obj) => {
    setSelectedObject(obj)
    const [members, orgs] = await Promise.all([
      getObjectMembers(obj.id),
      getObjectOrganizations(obj.id),
    ])
    setObjectMembers(members)
    setObjectOrgs(orgs)
  }

  const closeModal = () => {
    setModal(null)
    setNewUser({ full_name: '', email: '', password: '', role: 'supervisor', position: '', organization_id: '', object_ids: [] })
    setNewOrg({ name: '', type: 'customer' })
    setNewObject({ name: '', description: '', date_start: '', date_end: '' })
    setNewDoc({ name: '', short_name: '', doc_type: 'normative', object_id: '' })
    setNewName('')
    setNewPassword('')
    setAddMemberUserId('')
    setAddOrgData({ organization_id: '', role: 'subcontractor' })
  }

  // ── Организации ────────────────────────────────────────────────────────────

  const handleCreateOrg = async () => {
    if (!newOrg.name.trim()) return
    setSaving(true)
    try {
      const res = await createOrganization(newOrg)
      setOrganizations(prev => [...prev, res])
      closeModal()
    } catch (e) { alert(e.response?.data?.detail || 'Ошибка') }
    finally { setSaving(false) }
  }

  const handleToggleOrg = async (org) => {
    try {
      const res = await updateOrganization(org.id, { is_active: !org.is_active })
      setOrganizations(prev => prev.map(o => o.id === res.id ? res : o))
    } catch { alert('Ошибка') }
  }

  // ── Пользователи ───────────────────────────────────────────────────────────

  const handleCreateUser = async () => {
    if (!newUser.full_name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      alert('Заполните все обязательные поля'); return
    }
    setSaving(true)
    try {
      const payload = {
        ...newUser,
        organization_id: newUser.organization_id ? Number(newUser.organization_id) : null,
        object_ids: newUser.object_ids.map(Number),
      }
      const res = await createUser(payload)
      setUsers(prev => [...prev, res])
      closeModal()
    } catch (e) { alert(e.response?.data?.detail || 'Ошибка') }
    finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!newPassword.trim()) return
    setSaving(true)
    try {
      const res = await updateUser(passwordTarget.id, { password: newPassword })
      setUsers(prev => prev.map(u => u.id === res.id ? res : u))
      closeModal()
    } catch { alert('Ошибка') }
    finally { setSaving(false) }
  }

  const handleToggleUser = async (user) => {
    try {
      const res = await updateUser(user.id, { is_active: !user.is_active })
      setUsers(prev => prev.map(u => u.id === res.id ? res : u))
    } catch { alert('Ошибка') }
  }

  // ── Объекты ────────────────────────────────────────────────────────────────

  const handleCreateObject = async () => {
    if (!newObject.name.trim()) return
    setSaving(true)
    try {
      const res = await createObject(newObject)
      setObjects(prev => [...prev, res])
      closeModal()
    } catch (e) { alert(e.response?.data?.detail || 'Ошибка') }
    finally { setSaving(false) }
  }

  const handleAddMember = async () => {
    if (!addMemberUserId) return
    setSaving(true)
    try {
      await addObjectMember(selectedObject.id, Number(addMemberUserId))
      const members = await getObjectMembers(selectedObject.id)
      setObjectMembers(members)
      closeModal()
    } catch (e) { alert(e.response?.data?.detail || 'Ошибка') }
    finally { setSaving(false) }
  }

  const handleRemoveMember = async (userId) => {
    if (!confirm('Убрать участника с объекта?')) return
    try {
      await removeObjectMember(selectedObject.id, userId)
      setObjectMembers(prev => prev.filter(m => m.user_id !== userId))
    } catch { alert('Ошибка') }
  }

  const handleRemoveOrgFromObject = async (orgId) => {
    if (!confirm('Убрать организацию с объекта?')) return
    try {
      await client.delete(`/objects/${selectedObject.id}/organizations/${orgId}`)
      setObjectOrgs(prev => prev.filter(o => o.organization_id !== orgId))
    } catch { alert('Ошибка') }
  }

  const handleAddOrgToObject = async () => {
    if (!addOrgData.organization_id) return
    setSaving(true)
    try {
      await addObjectOrganization(selectedObject.id, {
        organization_id: Number(addOrgData.organization_id),
        role: addOrgData.role,
      })
      const orgs = await getObjectOrganizations(selectedObject.id)
      setObjectOrgs(orgs)
      closeModal()
    } catch (e) { alert(e.response?.data?.detail || 'Ошибка') }
    finally { setSaving(false) }
  }

  // ── Виды работ ─────────────────────────────────────────────────────────────

  const handleCreateWorkType = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await client.post('/work-types', { name: newName }).then(r => r.data)
      setWorkTypes(prev => [...prev, res])
      setNewName('')
    } catch { alert('Ошибка') }
    finally { setSaving(false) }
  }

  const handleToggleWorkType = async (item) => {
    try {
      if (item.is_active) {
        await client.delete(`/work-types/${item.id}`)
        setWorkTypes(prev => prev.map(i => i.id === item.id ? { ...i, is_active: false } : i))
      } else {
        const res = await client.patch(`/work-types/${item.id}`, { is_active: true }).then(r => r.data)
        setWorkTypes(prev => prev.map(i => i.id === item.id ? res : i))
      }
    } catch { alert('Ошибка') }
  }

  // ── Документы ──────────────────────────────────────────────────────────────

  const handleCreateDoc = async () => {
    if (!newDoc.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...newDoc,
        object_id: newDoc.object_id ? Number(newDoc.object_id) : null,
      }
      const res = await createDocument(payload)
      setDocuments(prev => [...prev, res])
      closeModal()
    } catch (e) { alert(e.response?.data?.detail || 'Ошибка') }
    finally { setSaving(false) }
  }

  const handleToggleDoc = async (doc) => {
    try {
      const res = await updateDocument(doc.id, { is_active: !doc.is_active })
      setDocuments(prev => prev.map(d => d.id === res.id ? res : d))
    } catch { alert('Ошибка') }
  }

  // ── Рендер ─────────────────────────────────────────────────────────────────

  const TABS = [
    { key: 'organizations', label: 'Организации' },
    { key: 'users',         label: 'Пользователи' },
    { key: 'objects',       label: 'Объекты' },
    { key: 'work_types',    label: 'Виды работ' },
    { key: 'documents',     label: 'Документы' },
  ]

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Администрирование</h1>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={tab === t.key ? `${styles.tab} ${styles.activeTab}` : styles.tab}
            onClick={() => { setTab(t.key); setSelectedObject(null) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ОРГАНИЗАЦИИ ── */}
      {tab === 'organizations' && (
        <>
          <div className={styles.toolbar}>
            <button className={styles.createBtn} onClick={() => setModal('createOrg')}>
              + Добавить организацию
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ID</th><th>Название</th><th>Тип</th><th>Статус</th><th>Действие</th></tr></thead>
              <tbody>
                {organizations.map(org => (
                  <tr key={org.id} className={!org.is_active ? styles.inactive : ''}>
                    <td>{org.id}</td>
                    <td>{org.name}</td>
                    <td><span className={styles.typeBadge}>{ORG_TYPE_LABELS[org.type] || org.type}</span></td>
                    <td><span className={org.is_active ? styles.activeStatus : styles.deactiveStatus}>{org.is_active ? 'Активна' : 'Деактивирована'}</span></td>
                    <td><button className={styles.toggleBtn} onClick={() => handleToggleOrg(org)}>{org.is_active ? 'Деактивировать' : 'Активировать'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ПОЛЬЗОВАТЕЛИ ── */}
      {tab === 'users' && (
        <>
          <div className={styles.toolbar}>
            <button className={styles.createBtn} onClick={() => setModal('createUser')}>
              + Добавить пользователя
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ID</th><th>Имя</th><th>Email</th><th>Должность</th><th>Организация</th><th>Статус</th><th>Действия</th></tr></thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className={!user.is_active ? styles.inactive : ''}>
                    <td>{user.id}</td>
                    <td>{user.full_name}</td>
                    <td className={styles.emailCell}>{user.email}</td>
                    <td><span className={styles.roleBadge}>{ROLE_LABELS[user.role] || user.role}</span></td>
                    <td>{organizations.find(o => o.id === user.organization_id)?.name || '—'}</td>
                    <td><span className={user.is_active ? styles.activeStatus : styles.deactiveStatus}>{user.is_active ? 'Активен' : 'Деактивирован'}</span></td>
                    <td className={styles.actionsCell}>
                      <button className={styles.toggleBtn} onClick={() => { setPasswordTarget(user); setModal('password') }}>Пароль</button>
                      {user.role !== 'admin' && (
                        <button className={styles.toggleBtn} onClick={() => handleToggleUser(user)}>{user.is_active ? 'Деактивировать' : 'Активировать'}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ОБЪЕКТЫ ── */}
      {tab === 'objects' && !selectedObject && (
        <>
          <div className={styles.toolbar}>
            <button className={styles.createBtn} onClick={() => setModal('createObject')}>+ Создать объект</button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ID</th><th>Название</th><th>Сроки</th><th>Статус</th><th>Действие</th></tr></thead>
              <tbody>
                {objects.map(obj => (
                  <tr key={obj.id}>
                    <td>{obj.id}</td>
                    <td className={styles.objectName}>{obj.name}</td>
                    <td>{[obj.date_start, obj.date_end].filter(Boolean).join(' — ') || '—'}</td>
                    <td><span className={obj.is_active ? styles.activeStatus : styles.deactiveStatus}>{obj.is_active ? 'Активен' : 'Деактивирован'}</span></td>
                    <td><button className={styles.toggleBtn} onClick={() => loadObjectDetails(obj)}>Управление</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ОБЪЕКТ: УПРАВЛЕНИЕ ── */}
      {tab === 'objects' && selectedObject && (
        <div className={styles.objectDetail}>
          <button className={styles.backBtn} onClick={() => setSelectedObject(null)}>← Назад к списку</button>
          <h2 className={styles.objectTitle}>{selectedObject.name}</h2>

          <div className={styles.twoCol}>
            <div>
              <div className={styles.subHeader}>
                <h3>Организации на объекте</h3>
                <button className={styles.smallBtn} onClick={() => setModal('addOrgToObject')}>+ Добавить</button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Организация</th><th>Роль</th><th>Действие</th></tr></thead>
                  <tbody>
                    {objectOrgs.map(o => (
                      <tr key={o.id}>
                        <td>{o.organization_name}</td>
                        <td><span className={styles.typeBadge}>{ORG_TYPE_LABELS[o.role] || o.role}</span></td>
                        <td>
                          <button
                            className={styles.toggleBtn}
                            onClick={() => handleRemoveOrgFromObject(o.organization_id)}
                          >
                            Убрать
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className={styles.subHeader}>
                <h3>Участники объекта</h3>
                <button className={styles.smallBtn} onClick={() => setModal('addMember')}>+ Добавить</button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Имя</th><th>Роль</th><th>Действие</th></tr></thead>
                  <tbody>
                    {objectMembers.map(m => (
                      <tr key={m.id}>
                        <td>{m.full_name}</td>
                        <td><span className={styles.roleBadge}>{ROLE_LABELS[m.role] || m.role}</span></td>
                        <td><button className={styles.toggleBtn} onClick={() => handleRemoveMember(m.user_id)}>Убрать</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ВИДЫ РАБОТ ── */}
      {tab === 'work_types' && (
        <>
          <div className={styles.toolbar}>
            <input
              className={styles.input}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Название нового вида работ"
              onKeyDown={e => e.key === 'Enter' && handleCreateWorkType()}
            />
            <button className={styles.createBtn} onClick={handleCreateWorkType} disabled={!newName.trim() || saving}>
              Добавить
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ID</th><th>Название</th><th>Статус</th><th>Действие</th></tr></thead>
              <tbody>
                {workTypes.map(item => (
                  <tr key={item.id} className={!item.is_active ? styles.inactive : ''}>
                    <td>{item.id}</td>
                    <td>{item.name}</td>
                    <td><span className={item.is_active ? styles.activeStatus : styles.deactiveStatus}>{item.is_active ? 'Активен' : 'Деактивирован'}</span></td>
                    <td><button className={styles.toggleBtn} onClick={() => handleToggleWorkType(item)}>{item.is_active ? 'Деактивировать' : 'Активировать'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ДОКУМЕНТЫ ── */}
      {tab === 'documents' && (
        <>
          <div className={styles.toolbar}>
            <button className={styles.createBtn} onClick={() => setModal('createDoc')}>+ Добавить документ</button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ID</th><th>Название</th><th>Краткое</th><th>Тип</th><th>Объект</th><th>Статус</th><th>Действие</th></tr></thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} className={!doc.is_active ? styles.inactive : ''}>
                    <td>{doc.id}</td>
                    <td>{doc.name}</td>
                    <td>{doc.short_name || '—'}</td>
                    <td><span className={styles.typeBadge}>{doc.doc_type === 'normative' ? 'Нормативный' : 'Проектный'}</span></td>
                    <td>{objects.find(o => o.id === doc.object_id)?.name || (doc.object_id ? `#${doc.object_id}` : 'Общий')}</td>
                    <td><span className={doc.is_active ? styles.activeStatus : styles.deactiveStatus}>{doc.is_active ? 'Активен' : 'Деактивирован'}</span></td>
                    <td><button className={styles.toggleBtn} onClick={() => handleToggleDoc(doc)}>{doc.is_active ? 'Деактивировать' : 'Активировать'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══ МОДАЛКИ ══ */}

      {modal && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>

            {/* Создать организацию */}
            {modal === 'createOrg' && (
              <>
                <h2 className={styles.modalTitle}>Новая организация</h2>
                <label className={styles.label}>Название *</label>
                <input className={styles.input} value={newOrg.name} onChange={e => setNewOrg(p => ({ ...p, name: e.target.value }))} placeholder="ООО «СтройГрупп»" />
                <label className={styles.label}>Тип *</label>
                <select className={styles.input} value={newOrg.type} onChange={e => setNewOrg(p => ({ ...p, type: e.target.value }))}>
                  {ORG_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Отмена</button>
                  <button className={styles.createBtn} onClick={handleCreateOrg} disabled={saving}>Создать</button>
                </div>
              </>
            )}

            {/* Создать пользователя */}
            {modal === 'createUser' && (
              <>
                <h2 className={styles.modalTitle}>Новый пользователь</h2>
                <label className={styles.label}>ФИО *</label>
                <input className={styles.input} value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} placeholder="Иванов Иван Иванович" />
                <label className={styles.label}>Email (логин) *</label>
                <input className={styles.input} type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="ivanov@example.com" />
                <label className={styles.label}>Пароль *</label>
                <input className={styles.input} type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
                <label className={styles.label}>Должность *</label>
                <select className={styles.input} value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value, position: ROLE_LABELS[e.target.value] || '' }))}>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <select className={styles.input} value={newUser.organization_id} onChange={e => setNewUser(p => ({ ...p, organization_id: e.target.value }))}>
                  <option value="">— не указана —</option>
                  {organizations.filter(o => o.is_active).map(o => <option key={o.id} value={o.id}>{o.name} ({ORG_TYPE_LABELS[o.type]})</option>)}
                </select>
                <label className={styles.label}>Привязать к объектам</label>
                <select
                  className={styles.input}
                  multiple
                  value={newUser.object_ids.map(String)}
                  onChange={e => setNewUser(p => ({ ...p, object_ids: Array.from(e.target.selectedOptions, o => o.value) }))}
                  size={Math.min(objects.length + 1, 4)}
                >
                  {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <p className={styles.hint}>Удерживайте Ctrl для выбора нескольких объектов</p>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Отмена</button>
                  <button className={styles.createBtn} onClick={handleCreateUser} disabled={saving}>Создать</button>
                </div>
              </>
            )}

            {/* Смена пароля */}
            {modal === 'password' && (
              <>
                <h2 className={styles.modalTitle}>Смена пароля</h2>
                <p className={styles.modalSubtitle}>{passwordTarget?.full_name}</p>
                <label className={styles.label}>Новый пароль</label>
                <input className={styles.input} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus />
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Отмена</button>
                  <button className={styles.createBtn} onClick={handleChangePassword} disabled={saving || !newPassword.trim()}>Сохранить</button>
                </div>
              </>
            )}

            {/* Создать объект */}
            {modal === 'createObject' && (
              <>
                <h2 className={styles.modalTitle}>Новый объект</h2>
                <label className={styles.label}>Название *</label>
                <input className={styles.input} value={newObject.name} onChange={e => setNewObject(p => ({ ...p, name: e.target.value }))} placeholder="ЖК «Северный парк», корп. 4" />
                <label className={styles.label}>Описание</label>
                <input className={styles.input} value={newObject.description} onChange={e => setNewObject(p => ({ ...p, description: e.target.value }))} placeholder="Краткое описание объекта" />
                <label className={styles.label}>Дата начала</label>
                <input className={styles.input} value={newObject.date_start} onChange={e => setNewObject(p => ({ ...p, date_start: e.target.value }))} placeholder="04.2025" />
                <label className={styles.label}>Дата окончания</label>
                <input className={styles.input} value={newObject.date_end} onChange={e => setNewObject(p => ({ ...p, date_end: e.target.value }))} placeholder="12.2026" />
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Отмена</button>
                  <button className={styles.createBtn} onClick={handleCreateObject} disabled={saving}>Создать</button>
                </div>
              </>
            )}

            {/* Добавить организацию к объекту */}
            {modal === 'addOrgToObject' && (
              <>
                <h2 className={styles.modalTitle}>Добавить организацию</h2>
                <label className={styles.label}>Организация</label>
                <select className={styles.input} value={addOrgData.organization_id} onChange={e => setAddOrgData(p => ({ ...p, organization_id: e.target.value }))}>
                  <option value="">— выберите —</option>
                  {organizations.filter(o => o.is_active).map(o => <option key={o.id} value={o.id}>{o.name} ({ORG_TYPE_LABELS[o.type]})</option>)}
                </select>
                <label className={styles.label}>Роль на объекте</label>
                <select className={styles.input} value={addOrgData.role} onChange={e => setAddOrgData(p => ({ ...p, role: e.target.value }))}>
                  {ORG_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Отмена</button>
                  <button className={styles.createBtn} onClick={handleAddOrgToObject} disabled={saving}>Добавить</button>
                </div>
              </>
            )}

            {/* Добавить участника */}
            {modal === 'addMember' && (
              <>
                <h2 className={styles.modalTitle}>Добавить участника</h2>
                <label className={styles.label}>Пользователь</label>
                <select className={styles.input} value={addMemberUserId} onChange={e => setAddMemberUserId(e.target.value)}>
                  <option value="">— выберите —</option>
                  {users.filter(u => u.is_active && !objectMembers.find(m => m.user_id === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({ROLE_LABELS[u.role] || u.role})</option>
                  ))}
                </select>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Отмена</button>
                  <button className={styles.createBtn} onClick={handleAddMember} disabled={saving || !addMemberUserId}>Добавить</button>
                </div>
              </>
            )}

            {/* Создать документ */}
            {modal === 'createDoc' && (
              <>
                <h2 className={styles.modalTitle}>Новый документ</h2>
                <label className={styles.label}>Название *</label>
                <input className={styles.input} value={newDoc.name} onChange={e => setNewDoc(p => ({ ...p, name: e.target.value }))} placeholder="СП 426.1325800.2020" />
                <label className={styles.label}>Краткое название</label>
                <input className={styles.input} value={newDoc.short_name} onChange={e => setNewDoc(p => ({ ...p, short_name: e.target.value }))} placeholder="СП 426" />
                <label className={styles.label}>Тип</label>
                <select className={styles.input} value={newDoc.doc_type} onChange={e => setNewDoc(p => ({ ...p, doc_type: e.target.value, object_id: '' }))}>
                  {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {newDoc.doc_type === 'project' && (
                  <>
                    <label className={styles.label}>Объект *</label>
                    <select className={styles.input} value={newDoc.object_id} onChange={e => setNewDoc(p => ({ ...p, object_id: e.target.value }))}>
                      <option value="">— выберите объект —</option>
                      {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </>
                )}
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Отмена</button>
                  <button className={styles.createBtn} onClick={handleCreateDoc} disabled={saving}>Создать</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}