import { useEffect, useState } from 'react'
import { useParams, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useObject } from '../context/ObjectContext'
import { getObject } from '../api/objects'
import styles from './ObjectPage.module.css'

export default function ObjectPage() {
  const { id } = useParams()
  const { user, signOut } = useAuth()
  const { setCurrentObject } = useObject()
  const navigate = useNavigate()
  const [obj, setObj] = useState(null)

  const ROLE_LABELS = {
    admin: 'Администратор',
    client_rep: 'Представитель заказчика',
    supervisor: 'Технадзор',
    foreman: 'Прораб',
  }

  useEffect(() => {
    getObject(id).then(data => {
      setObj(data)
      setCurrentObject(data)
    }).catch(() => navigate('/dashboard'))
  }, [id])

  const handleSignOut = () => {
    signOut()
    navigate('/login')
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div
          className={styles.logo}
          onClick={() => navigate('/dashboard')}
          title="На главную"
        >
          ← Реестр замечаний
        </div>
        {obj && <div className={styles.objectName}>{obj.name}</div>}
        <nav className={styles.nav}>
          <NavLink
            to={`/objects/${id}/issues`}
            className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}
          >
            Замечания
          </NavLink>
          <NavLink
            to={`/objects/${id}/analytics`}
            className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}
          >
            Аналитика
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}
            >
              Администрирование
            </NavLink>
          )}
        </nav>
        <div className={styles.userBlock}>
          <div className={styles.userName}>{user?.full_name}</div>
          <div className={styles.userRole}>{ROLE_LABELS[user?.role] || user?.role}</div>
          <button className={styles.signOut} onClick={handleSignOut}>Выйти</button>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}