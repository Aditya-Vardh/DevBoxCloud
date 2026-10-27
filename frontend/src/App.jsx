import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { WorkspacesPage }        from './pages/WorkspacesPage'
import { WorkspaceDetailPage }   from './pages/WorkspaceDetailPage'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { EnvironmentDetailPage } from './pages/EnvironmentDetailPage'
import { LandingPage }           from './pages/LandingPage'
import { InvitePage }            from './pages/InvitePage'

export default function App() {
  return (
    <Routes>
      {/* Public pages — no shell */}
      <Route path="/"           element={<LandingPage />} />
      <Route path="/invite/:code" element={<InvitePage />} />

      {/* App pages — with persistent nav shell */}
      <Route path="/workspaces" element={<AppShell><WorkspacesPage /></AppShell>} />
      <Route path="/workspaces/:workspaceId" element={<AppShell><WorkspaceDetailPage /></AppShell>} />
      <Route path="/environments/:envId"     element={<AppShell><EnvironmentDetailPage /></AppShell>} />
      <Route path="/applications/:appId"     element={<AppShell><ApplicationDetailPage /></AppShell>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
