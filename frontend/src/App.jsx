import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ObjectProvider } from './context/ObjectContext'
import PrivateRoute from './components/PrivateRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ObjectPage from './pages/ObjectPage'
import IssuesPage from './pages/IssuesPage'
import IssueDetailPage from './pages/IssueDetailPage'
import CreateIssuePage from './pages/CreateIssuePage'
import AnalyticsPage from './pages/AnalyticsPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    <AuthProvider>
      <ObjectProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/objects/:id"
              element={
                <PrivateRoute>
                  <ObjectPage />
                </PrivateRoute>
              }
            >
              <Route path="issues" element={<IssuesPage />} />
              <Route path="issues/new" element={
                <PrivateRoute allowedRoles={['supervisor', 'client_rep', 'admin']}>
                  <CreateIssuePage />
                </PrivateRoute>
              } />
              <Route path="issues/:issueId" element={<IssueDetailPage />} />
              <Route path="analytics" element={
                <PrivateRoute>
                  <AnalyticsPage />
                </PrivateRoute>
              } />
            </Route>

            <Route
              path="/admin"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminPage />
                </PrivateRoute>
              }
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ObjectProvider>
    </AuthProvider>
  )
}