import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getIssues } from '../api/issues'
import { getObjectOrganizations } from '../api/objects'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABELS, STATUS_COLORS, ISSUE_TYPE_LABELS } from '../utils/constants'
import styles from './IssuesPage.module.css'

export default function IssuesPage() {
  const { id: objectId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [issues, setIssues] = useState([])
  const [subcontractors, setSubcontractors] = useState([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    status: '',
    issue_type: '',
    subcontractor_org_id: '',
  })

  useEffect(() => {
    // Загружаем подрядные организации объекта для фильтра
    getObjectOrganizations(objectId)
      .then(orgs => setSubcontractors(orgs.filter(o => o.role === 'subcontractor')))
      .catch(() => {})
  }, [objectId])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.issue_type) params.issue_type = filters.issue_type
    if (filters.subcontractor_org_id) params.subcontractor_org_id = filters.subcontractor_org_id

    getIssues(objectId, params)
      .then(setIssues)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [objectId, filters])

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const resetFilters = () => {
    setFilters({ status: '', issue_type: '', subcontractor_org_id: '' })
  }

  const canCreate = ['supervisor', 'client_rep', 'admin'].includes(user?.role)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Замечания</h1>
        {canCreate && (
          <button
            className={styles.createBtn}
            onClick={() => navigate(`/objects/${objectId}/issues/new`)}
          >
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

        {user?.role !== 'client_rep' && (
          <select name="issue_type" value={filters.issue_type} onChange={handleFilterChange} className={styles.select}>
            <option value="">Все типы</option>
            <option value="type1">Тип 1 — Технадзор → Прораб</option>
            <option value="type2">Тип 2 — Заказчик → Генподрядчик</option>
          </select>
        )}

        {user?.role !== 'foreman' && user?.role !== 'client_rep' && (
          <select name="subcontractor_org_id" value={filters.subcontractor_org_id} onChange={handleFilterChange} className={styles.select}>
            <option value="">Все подрядчики</option>
            {subcontractors.map(o => (
              <option key={o.organization_id} value={o.organization_id}>{o.organization_name}</option>
            ))}
          </select>
        )}

        {(filters.status || filters.issue_type || filters.subcontractor_org_id) && (
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
                <th>Тип</th>
                <th>Описание</th>
                <th>Статус</th>
                <th>Подрядчик</th>
                <th>Срок</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => (
                <tr
                  key={issue.id}
                  className={styles.row}
                  onClick={() => navigate(`/objects/${objectId}/issues/${issue.id}`)}
                >
                  <td className={styles.number}>{issue.number}</td>
                  <td>
                    <span className={styles.typeBadge}>
                      {issue.issue_type === 'type1' ? 'Тип 1' : 'Тип 2'}
                    </span>
                  </td>
                  <td className={styles.description}>{issue.description}</td>
                  <td>
                    <div>
                      <span
                        className={styles.badge}
                        style={{
                          background: STATUS_COLORS[issue.status] + '20',
                          color: STATUS_COLORS[issue.status],
                        }}
                      >
                        {STATUS_LABELS[issue.status]}
                      </span>
                      {issue.is_overdue && (
                        <span className={styles.overdueBadge}>Просрочено</span>
                      )}
                    </div>
                  </td>
                  <td>{issue.subcontractor_name ?? '—'}</td>
                  <td className={issue.is_overdue ? styles.overdueDate : ''}>
                    {issue.planned_finish_at
                      ? new Date(issue.planned_finish_at).toLocaleDateString('ru-RU')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}