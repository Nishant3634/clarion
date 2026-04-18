import { useAuth } from '../context/AuthContext'
import LoginPage from '../pages/LoginPage'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#0D1F23',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid #1E3A42',
        borderTop: '2px solid #2DD4BF',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // Allow access even without auth — app works offline with localStorage
  if (!user) return <LoginPage />
  return <>{children}</>
}
