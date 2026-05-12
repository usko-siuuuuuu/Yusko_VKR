import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Layout.module.css'

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    signOut()
    navigate('/login')
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>Реестр замечаний</div>
        <nav className={styles.nav}>
          <NavLink to="/issues" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
            Замечания
          </NavLink>
          {user?.role !== 'foreman' && (
            <NavLink to="/analytics" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
              Аналитика
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
              Справочники
            </NavLink>
          )}
        </nav>
        <div className={styles.userBlock}>
          <div className={styles.userName}>{user?.full_name}</div>
          <div className={styles.userRole}>{user?.role}</div>
          <button className={styles.signOut} onClick={handleSignOut}>Выйти</button>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  )
}