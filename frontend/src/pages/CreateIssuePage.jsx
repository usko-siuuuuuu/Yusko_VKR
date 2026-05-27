import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createIssue } from '../api/issues'
import { getWorkTypes } from '../api/catalogs'
import { getObjectOrganizations, getObjectMembers } from '../api/objects'
import { getDocuments } from '../api/documents'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import styles from './CreateIssuePage.module.css'

export default function CreateIssuePage() {
  const { id: objectId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [workTypes, setWorkTypes] = useState([])
  const [documents, setDocuments] = useState([])
  const [subcontractors, setSubcontractors] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [foremans, setForemans] = useState([])

  // Тип замечания определяется по роли автоматически
  const issueType = user?.role === 'client_rep' ? 'type2' : 'type1'

  const [form, setForm] = useState({
    work_type_id: '',
    work_type_custom: '',
    axes: '',
    subcontractor_org_id: '',
    assignee_id: '',
    supervisor_id: '',
    planned_finish_at: '',
    description: '',
    requirements: '',
    document_id: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getWorkTypes().then(setWorkTypes)
    getDocuments({ object_id: objectId }).then(setDocuments)

    if (issueType === 'type1') {
      // supervisor выбирает подрядчика и прораба
      getObjectOrganizations(objectId)
        .then(orgs => setSubcontractors(orgs.filter(o => o.role === 'subcontractor')))
    } else {
      // client_rep выбирает supervisor'а
      client.get(`/users/by-object/${objectId}`, { params: { role: 'supervisor' } })
        .then(r => setSupervisors(r.data))
    }
  }, [objectId, issueType])

  // Когда выбран подрядчик — загружаем его прорабов
  useEffect(() => {
    if (form.subcontractor_org_id) {
      getObjectMembers(objectId).then(members => {
        const orgForemans = members.filter(
          m => m.role === 'foreman' &&
          // фильтруем по организации через users
          true // упрощённо — покажем всех foreman объекта
        )
        setForemans(orgForemans)
      })
    } else {
      setForemans([])
      setForm(f => ({ ...f, assignee_id: '' }))
    }
  }, [form.subcontractor_org_id, objectId])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.description.trim()) { setError('Заполните описание замечания'); return }
    if (!form.planned_finish_at) { setError('Укажите срок устранения'); return }
    if (!form.work_type_id && !form.work_type_custom.trim()) {
      setError('Выберите вид работ или введите вручную'); return
    }
    if (issueType === 'type2' && !form.supervisor_id) {
      setError('Выберите ответственного технадзора'); return
    }

    setLoading(true)
    try {
      const payload = {
        object_id: Number(objectId),
        issue_type: issueType,
        description: form.description,
        planned_finish_at: form.planned_finish_at,
        axes: form.axes || null,
        requirements: form.requirements || null,
        document_id: form.document_id ? Number(form.document_id) : null,
        work_type_id: form.work_type_id ? Number(form.work_type_id) : null,
        work_type_custom: form.work_type_custom || null,
      }

      if (issueType === 'type1') {
        if (form.subcontractor_org_id) payload.subcontractor_org_id = Number(form.subcontractor_org_id)
        if (form.assignee_id) payload.assignee_id = Number(form.assignee_id)
      } else {
        if (form.supervisor_id) payload.supervisor_id = Number(form.supervisor_id)
      }

      const created = await createIssue(payload)
      navigate(`/objects/${objectId}/issues/${created.id}`)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка создания замечания')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(`/objects/${objectId}/issues`)}>
        ← Назад
      </button>
      <h1 className={styles.title}>
        Новое замечание —&nbsp;
        {issueType === 'type1' ? 'Технадзор → Прораб' : 'Заказчик → Генподрядчик'}
      </h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.grid}>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Локация и вид работ</h2>

            <label className={styles.label}>
              Оси и отметка
              <input
                name="axes"
                value={form.axes}
                onChange={handleChange}
                className={styles.input}
                placeholder="напр. Ось А/1-3, отм. +3.000"
              />
            </label>

            <label className={styles.label}>
              Вид работ
              <select name="work_type_id" value={form.work_type_id} onChange={handleChange} className={styles.select}>
                <option value="">— выбрать из справочника —</option>
                {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>

            <label className={styles.label}>
              Или введите вид работ вручную
              <input
                name="work_type_custom"
                value={form.work_type_custom}
                onChange={handleChange}
                className={styles.input}
                placeholder="Свободный ввод если нет в списке"
              />
            </label>

            <label className={styles.label}>
              Срок устранения <span className={styles.required}>*</span>
              <input
                type="date"
                name="planned_finish_at"
                value={form.planned_finish_at}
                onChange={handleChange}
                className={styles.input}
                required
              />
            </label>

            <label className={styles.label}>
              Ссылка на документ
              <select name="document_id" value={form.document_id} onChange={handleChange} className={styles.select}>
                <option value="">— не указан —</option>
                {documents.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.short_name ? `${d.short_name} — ` : ''}{d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Ответственные</h2>

            {issueType === 'type1' ? (
              <>
                <label className={styles.label}>
                  Подрядная организация
                  <select
                    name="subcontractor_org_id"
                    value={form.subcontractor_org_id}
                    onChange={handleChange}
                    className={styles.select}
                  >
                    <option value="">— выберите подрядчика —</option>
                    {subcontractors.map(o => (
                      <option key={o.organization_id} value={o.organization_id}>
                        {o.organization_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.label}>
                  Ответственный прораб
                  <select
                    name="assignee_id"
                    value={form.assignee_id}
                    onChange={handleChange}
                    className={styles.select}
                    disabled={!form.subcontractor_org_id}
                  >
                    <option value="">— выберите прораба —</option>
                    {foremans.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label className={styles.label}>
                Ответственный технадзор <span className={styles.required}>*</span>
                <select
                  name="supervisor_id"
                  value={form.supervisor_id}
                  onChange={handleChange}
                  className={styles.select}
                  required
                >
                  <option value="">— выберите технадзора —</option>
                  {supervisors.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </label>
            )}

            <h2 className={styles.sectionTitle} style={{ marginTop: 24 }}>Описание</h2>

            <label className={styles.label}>
              Описание несоответствия <span className={styles.required}>*</span>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                className={styles.textarea}
                rows={4}
                placeholder="Опишите выявленное нарушение..."
                required
              />
            </label>

            <label className={styles.label}>
              Требования к устранению
              <textarea
                name="requirements"
                value={form.requirements}
                onChange={handleChange}
                className={styles.textarea}
                rows={3}
                placeholder="Что необходимо сделать..."
              />
            </label>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate(`/objects/${objectId}/issues`)}
          >
            Отмена
          </button>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Создание...' : 'Создать замечание'}
          </button>
        </div>
      </form>
    </div>
  )
}