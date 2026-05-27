import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getSummary, getByStatus, getByWorkType, getByContractor, getTimeline } from '../api/analytics'
import { STATUS_LABELS, STATUS_COLORS } from '../utils/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import styles from './AnalyticsPage.module.css'

export default function AnalyticsPage() {
  const { id: objectId } = useParams()

  const [summary, setSummary]         = useState(null)
  const [byStatus, setByStatus]       = useState([])
  const [byWorkType, setByWorkType]   = useState([])
  const [byContractor, setByContractor] = useState([])
  const [timeline, setTimeline]       = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!objectId) return
    Promise.all([
      getSummary(objectId),
      getByStatus(objectId),
      getByWorkType(objectId),
      getByContractor(objectId),
      getTimeline(objectId, 8),
    ]).then(([s, bs, bwt, bc, tl]) => {
      setSummary(s)
      setByStatus(bs)
      setByWorkType(bwt)
      setByContractor(bc)
      setTimeline(tl)
    }).finally(() => setLoading(false))
  }, [objectId])

  if (loading) return <div style={{ padding: 40 }}>Загрузка...</div>

  const pieData = byStatus.map(item => ({
    name: STATUS_LABELS[item.status] ?? item.status,
    value: item.count,
    color: STATUS_COLORS[item.status] ?? '#6b7280',
  }))

  const openCount = summary
    ? (summary.total - (summary.closed ?? 0))
    : 0

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Аналитика</h1>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{summary?.total ?? 0}</div>
          <div className={styles.kpiLabel}>Всего замечаний</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{openCount}</div>
          <div className={styles.kpiLabel}>Открытых</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{summary?.closed ?? 0}</div>
          <div className={styles.kpiLabel}>Закрытых</div>
        </div>
        <div className={`${styles.kpiCard} ${summary?.overdue > 0 ? styles.kpiDanger : ''}`}>
          <div className={styles.kpiValue}>{summary?.overdue ?? 0}</div>
          <div className={styles.kpiLabel}>Просроченных</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>
            {summary?.avg_close_days != null ? `${summary.avg_close_days} д.` : '—'}
          </div>
          <div className={styles.kpiLabel}>Среднее время закрытия</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>
            {summary?.total > 0
              ? `${Math.round(((summary.closed ?? 0) / summary.total) * 100)}%`
              : '—'}
          </div>
          <div className={styles.kpiLabel}>Процент закрытия</div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>По статусам</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>По видам работ</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byWorkType} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="work_type_name" width={140} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Всего" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="overdue_count" name="Просрочено" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>По подрядчикам</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byContractor} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="contractor_name" width={140} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" name="Всего" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="overdue" name="Просрочено" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Динамика по неделям</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeline} margin={{ left: 0, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" name="Открыто" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="closed" name="Закрыто" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}