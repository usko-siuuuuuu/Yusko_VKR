import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getObjects } from '../api/objects'
import client from '../api/client'
import styles from './DashboardPage.module.css'

const ROLE_LABELS = {
  admin: 'Администратор',
  client_rep: 'Представитель заказчика',
  supervisor: 'Технадзор',
  foreman: 'Прораб',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [objects, setObjects] = useState([])
  const [loading, setLoading] = useState(true)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    getObjects()
      .then(setObjects)
      .finally(() => setLoading(false))
  }, [])

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) return
    setPasswordLoading(true)
    setPasswordMsg(null)
    try {
      await client.patch(`/users/${user.id}/password`, null, {
        params: { old_password: oldPassword, new_password: newPassword }
      })
      setPasswordMsg({ type: 'success', text: 'Пароль успешно изменён' })
      setOldPassword('')
      setNewPassword('')
    } catch (e) {
      setPasswordMsg({
        type: 'error',
        text: e.response?.data?.detail || 'Ошибка смены пароля'
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.greeting}>Добро пожаловать, {user?.full_name}</h1>
          <p className={styles.role}>{ROLE_LABELS[user?.role] || user?.role}</p>
        </div>
        {user?.role === 'admin' && (
          <button className={styles.adminBtn} onClick={() => navigate('/admin')}>
            ⚙ Администрирование
        </button>
      )}
    </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Мои объекты</h2>
        {loading ? (
          <p className={styles.empty}>Загрузка...</p>
        ) : objects.length === 0 ? (
          <div className={styles.emptyBlock}>
            <p>Вы пока не привязаны ни к одному объекту.</p>
            <p>Обратитесь к администратору.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {objects.map(obj => (
              <div
                key={obj.id}
                className={styles.card}
                onClick={() => navigate(`/objects/${obj.id}`)}
              >
                <div className={styles.cardPhoto}>
                  {obj.photo_key
                    ? <img src={`/api/objects/${obj.id}/photo`} alt={obj.name} />
                    : <div className={styles.cardPhotoPlaceholder}>📷</div>
                  }
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardName}>{obj.name}</h3>
                  {obj.description && (
                    <p className={styles.cardDesc}>{obj.description}</p>
                  )}
                  {(obj.date_start || obj.date_end) && (
                    <p className={styles.cardDates}>
                      {[obj.date_start, obj.date_end].filter(Boolean).join(' — ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Смена пароля</h2>
        <div className={styles.passwordForm}>
          <input
            className={styles.input}
            type="password"
            placeholder="Текущий пароль"
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Новый пароль"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <button
            className={styles.btn}
            onClick={handleChangePassword}
            disabled={passwordLoading || !oldPassword || !newPassword}
          >
            {passwordLoading ? 'Сохранение...' : 'Сменить пароль'}
          </button>
          {passwordMsg && (
            <p className={passwordMsg.type === 'success' ? styles.success : styles.error}>
              {passwordMsg.text}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}