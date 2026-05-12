import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import {
  getWorkTypes, getContractors, getDefectCauses,
} from '../api/catalogs'
import client from '../api/client'
import styles from './AdminPage.module.css'

export default function AdminPage() {
  const [tab, setTab] = useState('work_types')

  const [workTypes, setWorkTypes] = useState([])
  const [contractors, setContractors] = useState([])
  const [defectCauses, setDefectCauses] = useState([])

  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getWorkTypes(false).then(setWorkTypes)
    getContractors(false).then(setContractors)
    getDefectCauses(false).then(setDefectCauses)
  }, [])

  const currentList = tab === 'work_types' ? workTypes : tab === 'contractors' ? contractors : defectCauses

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      if (tab === 'work_types') {
        const res = await client.post('/work-types', { name: newName }).then(r => r.data)
        setWorkTypes(prev => [...prev, res])
      } else if (tab === 'contractors') {
        const res = await client.post('/contractors', { name: newName }).then(r => r.data)
        setContractors(prev => [...prev, res])
      } else {
        const res = await client.post('/defect-causes', { name: newName }).then(r => r.data)
        setDefectCauses(prev => [...prev, res])
      }
      setNewName('')
    } catch {
      alert('Ошибка создания')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (item) => {
    try {
      if (tab === 'work_types') {
        if (item.is_active) {
          await client.delete(`/work-types/${item.id}`)
          setWorkTypes(prev => prev.map(i => i.id === item.id ? { ...i, is_active: false } : i))
        } else {
          const res = await client.patch(`/work-types/${item.id}`, { is_active: true }).then(r => r.data)
          setWorkTypes(prev => prev.map(i => i.id === item.id ? res : i))
        }
      } else if (tab === 'contractors') {
        if (item.is_active) {
          await client.delete(`/contractors/${item.id}`)
          setContractors(prev => prev.map(i => i.id === item.id ? { ...i, is_active: false } : i))
        } else {
          const res = await client.patch(`/contractors/${item.id}`, { is_active: true }).then(r => r.data)
          setContractors(prev => prev.map(i => i.id === item.id ? res : i))
        }
      } else {
        if (item.is_active) {
          await client.delete(`/defect-causes/${item.id}`)
          setDefectCauses(prev => prev.map(i => i.id === item.id ? { ...i, is_active: false } : i))
        } else {
          const res = await client.patch(`/defect-causes/${item.id}`, { is_active: true }).then(r => r.data)
          setDefectCauses(prev => prev.map(i => i.id === item.id ? res : i))
        }
      }
    } catch {
      alert('Ошибка обновления')
    }
  }

  return (
    <Layout>
      <div className={styles.page}>
        <h1 className={styles.title}>Справочники</h1>

        <div className={styles.tabs}>
          <button className={tab === 'work_types' ? `${styles.tab} ${styles.activeTab}` : styles.tab} onClick={() => setTab('work_types')}>
            Виды работ
          </button>
          <button className={tab === 'contractors' ? `${styles.tab} ${styles.activeTab}` : styles.tab} onClick={() => setTab('contractors')}>
            Подрядчики
          </button>
          <button className={tab === 'defect_causes' ? `${styles.tab} ${styles.activeTab}` : styles.tab} onClick={() => setTab('defect_causes')}>
            Причины дефектов
          </button>
        </div>

        <div className={styles.createRow}>
          <input
            className={styles.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название новой записи"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button className={styles.createBtn} onClick={handleCreate} disabled={loading || !newName.trim()}>
            Добавить
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {currentList.map((item) => (
                <tr key={item.id} className={!item.is_active ? styles.inactive : ''}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>
                    <span className={item.is_active ? styles.active : styles.deactive}>
                      {item.is_active ? 'Активен' : 'Деактивирован'}
                    </span>
                  </td>
                  <td>
                    <button className={styles.toggleBtn} onClick={() => handleToggle(item)}>
                      {item.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}