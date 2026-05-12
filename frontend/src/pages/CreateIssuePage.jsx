import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { createIssue } from '../api/issues'
import { getWorkTypes, getContractors, getObjects, getLocations, getDefectCauses } from '../api/catalogs'
import styles from './CreateIssuePage.module.css'

export default function CreateIssuePage() {
  const navigate = useNavigate()

  const [objects, setObjects] = useState([])
  const [locations, setLocations] = useState([])
  const [workTypes, setWorkTypes] = useState([])
  const [contractors, setContractors] = useState([])
  const [defectCauses, setDefectCauses] = useState([])

  const [form, setForm] = useState({
    object_id: '',
    location_id: '',
    work_type_id: '',
    contractor_id: '',
    assignee_id: '',
    defect_cause_id: '',
    priority: 'normal',
    description: '',
    requirements: '',
    normative_reference: '',
    planned_finish_at: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getObjects().then((data) => {
      setObjects(data)
      if (data.length > 0) setForm((f) => ({ ...f, object_id: data[0].id }))
    })
    getWorkTypes().then(setWorkTypes)
    getContractors().then(setContractors)
    getDefectCauses().then(setDefectCauses)
  }, [])

  useEffect(() => {
    if (form.object_id) {
      getLocations(form.object_id).then(setLocations)
    }
  }, [form.object_id])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.description.trim()) { setError('Заполните описание замечания'); return }
    if (!form.work_type_id) { setError('Выберите вид работ'); return }
    if (!form.planned_finish_at) { setError('Укажите срок устранения'); return }

    setLoading(true)
    try {
      const payload = {
        object_id: Number(form.object_id),
        work_type_id: Number(form.work_type_id),
        priority: form.priority,
        description: form.description,
        requirements: form.requirements || null,
        normative_reference: form.normative_reference || null,
        planned_finish_at: form.planned_finish_at,
      }
      if (form.location_id) payload.location_id = Number(form.location_id)
      if (form.contractor_id) payload.contractor_id = Number(form.contractor_id)
      if (form.defect_cause_id) payload.defect_cause_id = Number(form.defect_cause_id)

      const created = await createIssue(payload)
      navigate(`/issues/${created.id}`)
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка создания замечания')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className={styles.page}>
        <button className={styles.back} onClick={() => navigate('/issues')}>← Назад</button>
        <h1 className={styles.title}>Новое замечание</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.grid}>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Основное</h2>

              <label className={styles.label}>
                Объект строительства
                <select name="object_id" value={form.object_id} onChange={handleChange} className={styles.select}>
                  {objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>

              <label className={styles.label}>
                Локация
                <select name="location_id" value={form.location_id} onChange={handleChange} className={styles.select}>
                  <option value="">— не указана —</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>

              <label className={styles.label}>
                Вид работ <span className={styles.required}>*</span>
                <select name="work_type_id" value={form.work_type_id} onChange={handleChange} className={styles.select} required>
                  <option value="">— выберите —</option>
                  {workTypes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>

              <label className={styles.label}>
                Подрядчик
                <select name="contractor_id" value={form.contractor_id} onChange={handleChange} className={styles.select}>
                  <option value="">— не указан —</option>
                  {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              <label className={styles.label}>
                Приоритет
                <select name="priority" value={form.priority} onChange={handleChange} className={styles.select}>
                  <option value="low">Низкий</option>
                  <option value="normal">Нормальный</option>
                  <option value="high">Высокий</option>
                  <option value="critical">Критический</option>
                </select>
              </label>

              <label className={styles.label}>
                Срок устранения <span className={styles.required}>*</span>
                <input type="date" name="planned_finish_at" value={form.planned_finish_at} onChange={handleChange} className={styles.input} required />
              </label>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Описание</h2>

              <label className={styles.label}>
                Описание несоответствия <span className={styles.required}>*</span>
                <textarea name="description" value={form.description} onChange={handleChange} className={styles.textarea} rows={4} placeholder="Опишите выявленное нарушение..." required />
              </label>

              <label className={styles.label}>
                Требования к устранению
                <textarea name="requirements" value={form.requirements} onChange={handleChange} className={styles.textarea} rows={3} placeholder="Что необходимо сделать для устранения..." />
              </label>

              <label className={styles.label}>
                Нормативное основание
                <input name="normative_reference" value={form.normative_reference} onChange={handleChange} className={styles.input} />
              </label>

              <label className={styles.label}>
                Причина дефекта
                <select name="defect_cause_id" value={form.defect_cause_id} onChange={handleChange} className={styles.select}>
                  <option value="">— не указана —</option>
                  {defectCauses.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={() => navigate('/issues')}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Создание...' : 'Создать замечание'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}