import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getIssue, getIssueHistory, changeStatus } from '../api/issues'
import { getAttachments, uploadAttachment, getDownloadUrl, deleteAttachment } from '../api/attachments'
import { useAuth } from '../context/AuthContext'
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, ROLE_LABELS } from '../utils/constants'
import styles from './IssueDetailPage.module.css'

const TRANSITIONS = {
  created:     { inspector: ['issued', 'rejected'], pto_engineer: ['issued', 'rejected'], admin: ['issued', 'rejected'] },
  issued:      { foreman: ['in_progress'], admin: ['in_progress', 'rejected'] },
  in_progress: { foreman: ['on_review'], admin: ['on_review', 'rejected'] },
  on_review:   { inspector: ['closed', 'rework'], pto_engineer: ['closed', 'rework'], admin: ['closed', 'rework', 'rejected'] },
  rework:      { foreman: ['in_progress'], admin: ['in_progress', 'rejected'] },
}

function getAllowedTransitions(status, role) {
  return TRANSITIONS[status]?.[role] ?? []
}

export default function IssueDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [issue, setIssue] = useState(null)
  const [history, setHistory] = useState([])
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)

  const [statusComment, setStatusComment] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)

  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    Promise.all([
      getIssue(id),
      getIssueHistory(id),
      getAttachments(id),
    ]).then(([issueData, historyData, attachmentsData]) => {
      setIssue(issueData)
      setHistory(historyData)
      setAttachments(attachmentsData)
    }).finally(() => setLoading(false))
  }, [id])

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'rework' && !statusComment.trim()) {
      alert('При возврате на доработку необходимо указать причину')
      return
    }
    setStatusLoading(true)
    try {
      const updated = await changeStatus(id, newStatus, statusComment)
      setIssue(updated)
      setStatusComment('')
      const newHistory = await getIssueHistory(id)
      setHistory(newHistory)
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка смены статуса')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadAttachment(id, file)
      const updated = await getAttachments(id)
      setAttachments(updated)
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
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
    } catch {
      alert('Ошибка удаления')
    }
  }

  if (loading) return <Layout><div style={{ padding: 40 }}>Загрузка...</div></Layout>
  if (!issue) return <Layout><div style={{ padding: 40 }}>Замечание не найдено</div></Layout>

  const allowedTransitions = getAllowedTransitions(issue.status, user?.role)

  return (
    <Layout>
      <div className={styles.page}>
        <button className={styles.back} onClick={() => navigate('/issues')}>← Назад</button>

        <div className={styles.header}>
          <div>
            <h1 className={styles.number}>{issue.number}</h1>
            <p className={styles.description}>{issue.description}</p>
          </div>
          <div className={styles.badges}>
            <span className={styles.badge} style={{ background: STATUS_COLORS[issue.status] + '20', color: STATUS_COLORS[issue.status] }}>
              {STATUS_LABELS[issue.status]}
            </span>
            <span className={styles.badge} style={{ background: PRIORITY_COLORS[issue.priority] + '20', color: PRIORITY_COLORS[issue.priority] }}>
              {PRIORITY_LABELS[issue.priority]}
            </span>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Детали</h2>
            <div className={styles.fields}>
              <div className={styles.field}><span>Подрядчик</span><span>{issue.contractor?.name ?? '—'}</span></div>
              <div className={styles.field}><span>Вид работ</span><span>{issue.work_type?.name ?? '—'}</span></div>
              <div className={styles.field}><span>Локация</span><span>{issue.location?.name ?? '—'}</span></div>
              <div className={styles.field}><span>Автор</span><span>{issue.author?.full_name ?? '—'}</span></div>
              <div className={styles.field}><span>Исполнитель</span><span>{issue.assignee?.full_name ?? '—'}</span></div>
              <div className={styles.field}><span>Срок устранения</span><span>{issue.planned_finish_at ? new Date(issue.planned_finish_at).toLocaleDateString('ru-RU') : '—'}</span></div>
              <div className={styles.field}><span>Нормативное основание</span><span>{issue.normative_reference ?? '—'}</span></div>
              <div className={styles.field}><span>Создано</span><span>{new Date(issue.created_at).toLocaleString('ru-RU')}</span></div>
            </div>
            {issue.requirements && (
              <div className={styles.requirements}>
                <div className={styles.reqLabel}>Требования к устранению</div>
                <div>{issue.requirements}</div>
              </div>
            )}
          </div>

          <div className={styles.rightCol}>
            {allowedTransitions.length > 0 && (
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>Сменить статус</h2>
                {(allowedTransitions.includes('rework')) && (
                  <textarea
                    className={styles.commentInput}
                    placeholder="Комментарий (обязателен при возврате на доработку)"
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    rows={3}
                  />
                )}
                <div className={styles.transitionBtns}>
                  {allowedTransitions.map((s) => (
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
                  {attachments.map((a) => (
                    <div key={a.id} className={styles.attachItem}>
                      <span className={styles.attachName}>{a.original_filename}</span>
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

        <div className={styles.card} style={{ marginTop: 24 }}>
          <h2 className={styles.cardTitle}>История статусов</h2>
          <div className={styles.timeline}>
            {history.map((h, i) => (
              <div key={i} className={styles.timelineItem}>
                <div className={styles.timelineDot} style={{ background: STATUS_COLORS[h.new_status] }} />
                <div className={styles.timelineContent}>
                  <div className={styles.timelineStatus}>
                    {h.old_status ? `${STATUS_LABELS[h.old_status]} → ` : ''}{STATUS_LABELS[h.new_status]}
                  </div>
                  <div className={styles.timelineMeta}>
                    {h.changed_by_user?.full_name ?? '—'} · {new Date(h.changed_at).toLocaleString('ru-RU')}
                  </div>
                  {h.comment && <div className={styles.timelineComment}>{h.comment}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}