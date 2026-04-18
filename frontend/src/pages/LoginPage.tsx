import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleEmailAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null); setMessage(null); setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) setError(error.message)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D1F23',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Sora', sans-serif"
    }}>
      <div style={{
        maxWidth: 420,
        width: '100%',
        background: '#112830',
        border: '1px solid #1E3A42',
        borderRadius: 20,
        padding: '40px 36px',
        boxSizing: 'border-box'
      }}>
        
        {/* LOGO ROW */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#2DD4BF" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: 20, color: '#E8F4F8', letterSpacing: '-0.02em' }}>
            Clarion
          </span>
        </div>

        {/* HEADING */}
        <h1 style={{ fontWeight: 600, fontSize: 24, color: '#E8F4F8', marginBottom: 4 }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p style={{ fontWeight: 300, fontSize: 13, color: '#90A4AE', marginBottom: 28 }}>
          {mode === 'login' ? 'Sign in to your Clarion workspace' : 'Start managing complaints smarter'}
        </p>

        {/* MODE TOGGLE */}
        <div style={{ background: '#163038', borderRadius: 10, padding: 4, display: 'flex', marginBottom: 24 }}>
          <button 
            onClick={() => { setMode('login'); setError(null); setMessage(null); }}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
              fontFamily: "'Sora', sans-serif", fontWeight: 500, fontSize: 13, cursor: 'pointer',
              transition: 'all 150ms ease',
              background: mode === 'login' ? '#2DD4BF' : 'transparent',
              color: mode === 'login' ? '#0D1F23' : '#90A4AE'
            }}
          >
            Sign In
          </button>
          <button 
            onClick={() => { setMode('signup'); setError(null); setMessage(null); }}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
              fontFamily: "'Sora', sans-serif", fontWeight: 500, fontSize: 13, cursor: 'pointer',
              transition: 'all 150ms ease',
              background: mode === 'signup' ? '#2DD4BF' : 'transparent',
              color: mode === 'signup' ? '#0D1F23' : '#90A4AE'
            }}
          >
            Sign Up
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleEmailAuth}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ 
              display: 'block', textTransform: 'uppercase', fontWeight: 500, fontSize: 11, 
              letterSpacing: '0.07em', color: '#90A4AE', marginBottom: 7 
            }}>
              EMAIL
            </label>
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%', background: '#0D1F23', border: '1px solid #1E3A42', boxSizing: 'border-box',
                borderRadius: 9, padding: '11px 14px', fontFamily: "'Sora', sans-serif",
                fontSize: 14, color: '#E8F4F8', outline: 'none', transition: 'border-color 150ms ease'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2DD4BF'}
              onBlur={(e) => e.target.style.borderColor = '#1E3A42'}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ 
              display: 'block', textTransform: 'uppercase', fontWeight: 500, fontSize: 11, 
              letterSpacing: '0.07em', color: '#90A4AE', marginBottom: 7 
            }}>
              PASSWORD
            </label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
              style={{
                width: '100%', background: '#0D1F23', border: '1px solid #1E3A42', boxSizing: 'border-box',
                borderRadius: 9, padding: '11px 14px', fontFamily: "'Sora', sans-serif",
                fontSize: 14, color: '#E8F4F8', outline: 'none', transition: 'border-color 150ms ease'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2DD4BF'}
              onBlur={(e) => e.target.style.borderColor = '#1E3A42'}
            />
          </div>

          {error && (
            <div style={{
              background: '#3B1A1A', border: '1px solid #EF5350', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#EF5350'
            }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{
              background: '#1B3A2A', border: '1px solid #4CAF50', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#4CAF50'
            }}>
              {message}
            </div>
          )}

          <button 
            type="button"
            onClick={() => handleEmailAuth()}
            disabled={loading}
            style={{
              width: '100%', borderRadius: 9, padding: 13, border: 'none',
              fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 150ms ease', marginBottom: 14,
              background: loading ? '#1E3A42' : '#2DD4BF',
              color: loading ? '#546E7A' : '#0D1F23'
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* DIVIDER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: '#1E3A42' }} />
          <span style={{ fontSize: 11, color: '#546E7A' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#1E3A42' }} />
        </div>

        {/* GOOGLE BUTTON */}
        <button 
          onClick={handleGoogleLogin}
          style={{
            width: '100%', background: 'transparent', border: '1px solid #1E3A42',
            borderRadius: 9, padding: 12, fontFamily: "'Sora', sans-serif", fontWeight: 500, 
            fontSize: 14, color: '#E8F4F8', cursor: 'pointer', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 150ms ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#2DD4BF'
            e.currentTarget.style.color = '#2DD4BF'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#1E3A42'
            e.currentTarget.style.color = '#E8F4F8'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.443 2.043.957 4.962l3.007 2.332c.708-2.127 2.692-3.714 5.036-3.714z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

      </div>
    </div>
  )
}
