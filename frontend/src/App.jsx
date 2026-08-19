import { Routes, Route, Navigate } from 'react-router-dom'
import { WorkspacesPage }        from './pages/WorkspacesPage'
import { WorkspaceDetailPage }   from './pages/WorkspaceDetailPage'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { EnvironmentDetailPage } from './pages/EnvironmentDetailPage'

export default function App() {
  return (
    <Routes>
      <Route path="/"                              element={<WorkspacesPage />} />
      <Route path="/workspaces/:workspaceId"       element={<WorkspaceDetailPage />} />
      <Route path="/applications/:appId"           element={<ApplicationDetailPage />} />
      <Route path="/environments/:envId"           element={<EnvironmentDetailPage />} />
      <Route path="*"                              element={<Navigate to="/" replace />} />
    </Routes>
  )
}
