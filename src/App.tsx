import { useEffect, useState } from 'react'
import { supabase } from './services/supabase'
import Login from './pages/Login'
import AdminPanel from './pages/AdminPanel'
import MainApp from './pages/MainApp'

function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
        if (session.user.email === '07012599375@phone.breadledger.com') {
          setIsAdmin(true)
        }
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
        if (session.user.email === '07012599375@phone.breadledger.com') {
          setIsAdmin(true)
        }
      } else {
        setProfile(null)
        setIsAdmin(false)
        setLoading(false)
      }
    })
    return () => listener?.subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-amber-50 flex items-center justify-center">Loading...</div>
  if (!session) return <Login />

  if (isAdmin && window.location.hash === '#admin') {
    return <AdminPanel />
  }

  const isExpired = !profile?.subscription_status || 
    (profile.subscription_end_date && new Date(profile.subscription_end_date) < new Date())

  if (isExpired) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 text-center max-w-md">
          <span className="text-6xl">🔒</span>
          <h2 className="text-2xl font-bold mt-4">Subscription Expired</h2>
          <p className="text-gray-600 mt-2">Your access to BreadLedger has ended.</p>
          <div className="bg-amber-100 p-4 rounded-xl my-4">
            <p className="font-semibold">Contact to renew:</p>
            <p className="text-lg">📞 07012599375</p>
            <p className="text-lg">💬 WhatsApp: +2347012599375</p>
            <p className="text-sm">Email: nuruabuhassan2@gmail.com</p>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="w-full bg-gray-200 py-2 rounded-xl">Logout</button>
        </div>
      </div>
    )
  }

  return <MainApp userId={session.user.id} isAdmin={isAdmin} />
}

export default App