import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getIssue, getIssueHistory, changeStatus, updateIssue } from '../api/issues'
import { getAttachments, uploadAttachment, getDownloadUrl, deleteAttachment } from '../api/attachments'
import { getObjectMembers, getObjectOrganizations } from '../api/objects'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABELS, STATUS_COLORS } from '../utils/constants'
import styles from './IssueDetailPage.module.css'

// Машина состояний (зеркало бэкенда)
const TRANSITIONS = {
  type1: {
    issued:               { foreman: ['in_progress'], admin: ['in_progress', 'closed', 'rework'] },
    in_progress:          { foreman: ['on_review_supervisor'], admin: ['on_review_supervisor', 'closed', 'rework'] },
    on_review_supervisor: { supervisor: ['closed', 'rework'], admin: ['closed', 'rework'] },
    rework:               { foreman: ['in_progress'], admin: ['in_progress'] },
  },
  type2: {
    issued:               { supervisor: ['in_progress'], admin: ['in_progress'] },
    in_progress:          { foreman: ['on_review_supervisor'], admin: ['on_review_supervisor'] },
    on_review_supervisor: { supervisor: ['on_review_client', 'rework'], admin: ['on_review_client', 'rework'] },
    on_review_client:     { client_rep: ['closed', 'rework'], admin: ['closed', 'rework'] },
    rework:               { foreman: ['in_progress'], supervisor: ['in_progress'], admin: ['in_progress'] },
  },
}

function getAllowedTransitions(issueType, status, role) {
  return TRANSITIONS[issueType]?.[status]?.[role] ?? []
}

export default function IssueDetailPage() {
  const { id: objectId, issueId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [issue, setIssue] = useState(null)
  const [history, setHistory] = useState([])
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)

  const [statusComment, setStatusComment] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Для дозаполнения supervisor'ом (тип 2)
  const [subcontractors, setSubcontractors] = useState([])
  const [foremans, setForemans] = useState([])
  const [assignForm, setAssignForm] = useState({ subcontractor_org_id: '', assignee_id: '' })
  const [assignLoading, setAssignLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      getIssue(issueId),
      getIssueHistory(issueId),
      getAttachments(issueId),
    ]).then(([issueData, historyData, attachmentsData]) => {
      setIssue(issueData)
      setHistory(historyData)
      setAttachments(attachmentsData)
    }).finally(() => setLoading(false))
  }, [issueId])

  // Загружаем данные для дозаполнения (supervisor + тип2 + ещё не назначен прораб)
  useEffect(() => {
    if (issue?.issue_type === 'type2' && user?.role === 'supervisor' && !issue.assignee_id) {
      getObjectOrganizations(objectId)
        .then(orgs => setSubcontractors(orgs.filter(o => o.role === 'subcontractor')))
    }
  }, [issue, user, objectId])

  useEffect(() => {
    if (assignForm.subcontractor_org_id) {
      getObjectMembers(objectId).then(members => {
        setForemans(members.filter(m => m.role === 'foreman'))
      })
    }
  }, [assignForm.subcontractor_org_id, objectId])

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'rework' && !statusComment.trim()) {
      alert('При возврате на доработку необходимо указать причину')
      return
    }
    setStatusLoading(true)
    try {
      const updated = await changeStatus(issueId, newStatus, statusComment)
      setIssue(updated)
      setStatusComment('')
      const newHistory = await getIssueHistory(issueId)
      setHistory(newHistory)
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка смены статуса')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!assignForm.subcontractor_org_id || !assignForm.assignee_id) {
      alert('Выберите подрядчика и прораба')
      return
    }
    setAssignLoading(true)
    try {
      const updated = await updateIssue(issueId, {
        subcontractor_org_id: Number(assignForm.subcontractor_org_id),
        assignee_id: Number(assignForm.assignee_id),
      })
      setIssue(updated)
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка назначения')
    } finally {
      setAssignLoading(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadAttachment(issueId, file)
      setAttachments(await getAttachments(issueId))
    } catch {
      alert('Ошибка загрузки файла')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDownload = async (attachmentId) => {
    try {
      const { url } = await getDownloadUrl(attachmentId)
      window.open(url, '_blank')
    } catch {
      alert('Ошибка получения ссылки')
    }
  }

  const handleDelete = async (attachmentId) => {
    if (!confirm('Удалить вложение?')) return
    try {
      await deleteAttachment(attachmentId)
      setAttachments(prev => prev.filter(a => a.id !== attachmentId))
    } catch {
      alert('Ошибка удаления')
    }
  }

  if (loading) return <div style={{ padding: 40 }}>Загрузка...</div>
  if (!issue) return <div style={{ padding: 40 }}>Замечание не найдено</div>

  const allowedTransitions = getAllowedTransitions(issue.issue_type, issue.status, user?.role)
  const needsAssign = issue.issue_type === 'type2' && user?.role === 'supervisor' && !issue.assignee_id

  // Заказчик видит статус in_progress вместо внутренних статусов
  const displayStatus = user?.role === 'client_rep' && ['in_progress', 'on_review_supervisor', 'rework'].includes(issue.status)
    ? 'in_progress'
    : issue.status

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(`/objects/${objectId}/issues`)}>
        ← Назад
      </button>

      <div className={styles.header}>
        <div>
          <div className={styles.meta}>
            <h1 className={styles.number}>{issue.number}</h1>
            <span className={styles.typeBadge}>
              {issue.issue_type === 'type1' ? 'Тип 1' : 'Тип 2'}
            </span>
          </div>
          <p className={styles.description}>{issue.description}</p>
        </div>
        <span
          className={styles.statusBadge}
          style={{
            background: STATUS_COLORS[displayStatus] + '20',
            color: STATUS_COLORS[displayStatus],
          }}
        >
          {STATUS_LABELS[displayStatus]}
          {issue.is_overdue && ' • Просрочено'}
        </span>
      </div>

      <div className={styles.grid}>
        <div className={styles.leftCol}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Детали</h2>
            <div className={styles.fields}>
              <div className={styles.field}><span>Оси / отметка</span><span>{issue.axes ?? '—'}</span></div>
              <div className={styles.field}>
                <span>Вид работ</span>
                <span>{issue.work_type_name ?? issue.work_type_custom ?? '—'}</span>
              </div>
              <div className={styles.field}>
                <span>Срок устранения</span>
                <span className={issue.is_overdue ? styles.overdueText : ''}>
                  {issue.planned_finish_at ? new Date(issue.planned_finish_at).toLocaleDateString('ru-RU') : '—'}
                </span>
              </div>
              <div className={styles.field}><span>Автор</span><span>{issue.author_name ?? '—'}</span></div>
              {issue.issue_type === 'type2' && (
                <div className={styles.field}><span>Технадзор</span><span>{issue.supervisor_name ?? '—'}</span></div>
              )}
              <div className={styles.field}><span>Прораб</span><span>{issue.assignee_name ?? '—'}</span></div>
              {user?.role !== 'client_rep' && (
                <div className={styles.field}><span>Подрядчик</span><span>{issue.subcontractor_name ?? '—'}</span></div>
              )}
              {issue.document_name && (
                <div className={styles.field}><span>Документ</span><span>{issue.document_name}</span></div>
              )}
              <div className={styles.field}><span>Создано</span><span>{new Date(issue.created_at).toLocaleString('ru-RU')}</span></div>
            </div>
            {issue.requirements && (
              <div className={styles.requirements}>
                <div className={styles.reqLabel}>Требования к устранению</div>
                <div>{issue.requirements}</div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.rightCol}>
          {/* Дозаполнение supervisor'ом для тип 2 */}
          {needsAssign && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Назначить исполнителя</h2>
              <p className={styles.hint}>Выберите подрядчика и прораба для этого замечания</p>
              <label className={styles.label}>
                Подрядная организация
                <select
                  className={styles.select}
                  value={assignForm.subcontractor_org_id}
                  onChange={e => setAssignForm(f => ({ ...f, subcontractor_org_id: e.target.value, assignee_id: '' }))}
                >
                  <option value="">— выберите —</option>
                  {subcontractors.map(o => (
                    <option key={o.organization_id} value={o.organization_id}>{o.organization_name}</option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                Прораб
                <select
                  className={styles.select}
                  value={assignForm.assignee_id}
                  onChange={e => setAssignForm(f => ({ ...f, assignee_id: e.target.value }))}
                  disabled={!assignForm.subcontractor_org_id}
                >
                  <option value="">— выберите —</option>
                  {foremans.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
                  ))}
                </select>
              </label>
              <button
                className={styles.assignBtn}
                onClick={handleAssign}
                disabled={assignLoading}
              >
                {assignLoading ? 'Сохранение...' : 'Назначить и передать прорабу'}
              </button>
            </div>
          )}

          {/* Смена статуса */}
          {allowedTransitions.length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Сменить статус</h2>
              <textarea
                className={styles.commentInput}
                placeholder="Комментарий (обязателен при возврате на доработку)"
                value={statusComment}
                onChange={e => setStatusComment(e.target.value)}
                rows={3}
              />
              <div className={styles.transitionBtns}>
                {allowedTransitions.map(s => (
                  <button
                    key={s}
                    className={styles.transBtn}
                    style={{ background: STATUS_COLORS[s], color: '#fff' }}
                    onClick={() => handleStatusChange(s)}
                    disabled={statusLoading}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Вложения */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Вложения ({attachments.length})</h2>
            <label className={styles.uploadBtn}>
              {uploading ? 'Загрузка...' : '+ Добавить файл'}
              <input type="file" hidden onChange={handleUpload} accept="image/*,.pdf,.mp4,.mov" />
            </label>
            {attachments.length === 0 ? (
              <div className={styles.noAttachments}>Нет вложений</div>
            ) : (
              <div className={styles.attachList}>
                {attachments.map(a => (
                  <div key={a.id} className={styles.attachItem}>
                    <span className={styles.attachName}>{a.file_name}</span>
                    <div className={styles.attachActions}>
                      <button onClick={() => handleDownload(a.id)}>↓</button>
                      <button onClick={() => handleDelete(a.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* История статусов */}
      <div className={styles.card} style={{ marginTop: 24 }}>
        <h2 className={styles.cardTitle}>История</h2>
        <div className={styles.timeline}>
          {history.map((h, i) => (
            <div key={i} className={styles.timelineItem}>
              <div
                className={styles.timelineDot}
                style={{ background: STATUS_COLORS[h.new_status] ?? '#6b7280' }}
              />
              <div className={styles.timelineContent}>
                <div className={styles.timelineStatus}>
                  {h.old_status ? `${STATUS_LABELS[h.old_status] ?? h.old_status} → ` : ''}
                  {STATUS_LABELS[h.new_status] ?? h.new_status}
                </div>
                <div className={styles.timelineMeta}>
                  {h.changed_by_name ?? '—'} · {new Date(h.changed_at).toLocaleString('ru-RU')}
                </div>
                {h.comment && <div className={styles.timelineComment}>{h.comment}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}