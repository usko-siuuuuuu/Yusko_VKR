import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import LoginPage from './pages/LoginPage'
import IssuesPage from './pages/IssuesPage'
import IssueDetailPage from './pages/IssueDetailPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AdminPage from './pages/AdminPage'
import CreateIssuePage from './pages/CreateIssuePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/issues"
            element={<PrivateRoute><IssuesPage /></PrivateRoute>}
          />
          <Route
            path="/issues/new"
            element={
              <PrivateRoute allowedRoles={['inspector', 'pto_engineer', 'admin']}>
                <CreateIssuePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/issues/:id"
            element={<PrivateRoute><IssueDetailPage /></PrivateRoute>}
          />
          <Route
            path="/analytics"
            element={
              <PrivateRoute allowedRoles={['inspector','pto_engineer','client_rep','project_manager','admin']}>
                <AnalyticsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminPage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/issues" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}