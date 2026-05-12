import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getIssues } from '../api/issues'
import { getContractors } from '../api/catalogs'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '../utils/constants'
import styles from './IssuesPage.module.css'

export default function IssuesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [issues, setIssues] = useState([])
  const [contractors, setContractors] = useState([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    contractor_id: '',
  })

  useEffect(() => {
    getContractors().then(setContractors).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.priority) params.priority = filters.priority
    if (filters.contractor_id) params.contractor_id = filters.contractor_id

    getIssues(params)
      .then(setIssues)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filters])

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const resetFilters = () => {
    setFilters({ status: '', priority: '', contractor_id: '' })
  }

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Замечания</h1>
          {(user?.role === 'inspector' || user?.role === 'pto_engineer' || user?.role === 'admin') && (
            <button className={styles.createBtn} onClick={() => navigate('/issues/new')}>
              + Новое замечание
            </button>
          )}
        </div>

        <div className={styles.filters}>
          <select name="status" value={filters.status} onChange={handleFilterChange} className={styles.select}>
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select name="priority" value={filters.priority} onChange={handleFilterChange} className={styles.select}>
            <option value="">Все приоритеты</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select name="contractor_id" value={filters.contractor_id} onChange={handleFilterChange} className={styles.select}>
            <option value="">Все подрядчики</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {(filters.status || filters.priority || filters.contractor_id) && (
            <button className={styles.resetBtn} onClick={resetFilters}>Сбросить</button>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : issues.length === 0 ? (
          <div className={styles.empty}>Замечания не найдены</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Описание</th>
                  <th>Статус</th>
                  <th>Приоритет</th>
                  <th>Подрядчик</th>
                  <th>Срок</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id} className={styles.row} onClick={() => navigate(`/issues/${issue.id}`)}>
                    <td className={styles.number}>{issue.number}</td>
                    <td className={styles.description}>{issue.description}</td>
                    <td>
                      <span className={styles.badge} style={{ background: STATUS_COLORS[issue.status] + '20', color: STATUS_COLORS[issue.status] }}>
                        {STATUS_LABELS[issue.status]}
                      </span>
                    </td>
                    <td>
                      <span className={styles.badge} style={{ background: PRIORITY_COLORS[issue.priority] + '20', color: PRIORITY_COLORS[issue.priority] }}>
                        {PRIORITY_LABELS[issue.priority]}
                      </span>
                    </td>
                    <td>{issue.contractor?.name ?? '—'}</td>
                    <td className={issue.is_overdue ? styles.overdue : ''}>
                      {issue.planned_finish_at ? new Date(issue.planned_finish_at).toLocaleDateString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}