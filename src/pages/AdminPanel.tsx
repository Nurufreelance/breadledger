import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

interface Feedback {
  id: string
  user_id: string
  phone: string
  bakery_name: string
  message: string
  status: 'pending' | 'resolved'
  created_at: string
}

export default function AdminPanel() {
  const [users, setUsers] = useState<any[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'feedback'>('users')

  // Admin password – changed to admin123ABC
  const ADMIN_PASSWORD = 'admin123ABC'

  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      fetchUsers()
      fetchFeedbacks()
    } else {
      setMessage({ text: '❌ Incorrect password', type: 'error' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  async function fetchUsers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, phone, whatsapp, bakery_name, bakery_address, is_approved, subscription_status, subscription_end_date, created_at, email')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
      setMessage({ text: '❌ Failed to load users', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function fetchFeedbacks() {
    setFeedbackLoading(true)
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setFeedbacks(data || [])
    } catch (err) {
      console.error('Error fetching feedback:', err)
    } finally {
      setFeedbackLoading(false)
    }
  }

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  async function activateUser(userId: string, months: number = 6) {
    setActionLoading(userId)
    try {
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + months)
      await supabase
        .from('profiles')
        .update({ subscription_status: true, subscription_end_date: endDate.toISOString() })
        .eq('id', userId)
      showMessage('✅ Activated successfully!', 'success')
      fetchUsers()
    } catch (err) {
      showMessage('❌ Activation failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function deactivateUser(userId: string) {
    setActionLoading(userId)
    try {
      await supabase
        .from('profiles')
        .update({ subscription_status: false, subscription_end_date: null })
        .eq('id', userId)
      showMessage('✅ Deactivated', 'success')
      fetchUsers()
    } catch (err) {
      showMessage('❌ Deactivation failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function approveUser(userId: string) {
    setActionLoading(userId)
    try {
      await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', userId)
      showMessage('✅ Bakery approved!', 'success')
      fetchUsers()
    } catch (err) {
      showMessage('❌ Approval failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // NEW: Delete User (deactivates and removes)
  async function deleteUser(userId: string, userPhone: string) {
    if (!confirm(`Are you sure you want to permanently delete user ${userPhone}? This action cannot be undone!`)) return
    
    setActionLoading(userId)
    try {
      // Step 1: Delete from profiles
      await supabase.from('profiles').delete().eq('id', userId)
      
      // Step 2: Delete from auth.users (this requires service role)
      // Note: This may not work without service role key – but we'll try
      const { error } = await supabase.auth.admin.deleteUser(userId)
      if (error) {
        console.error('Auth delete error:', error)
        // If auth delete fails, at least the profile is deleted
        showMessage('✅ Profile deleted. Auth user may need manual removal.', 'success')
      } else {
        showMessage('✅ User permanently deleted!', 'success')
      }
      fetchUsers()
    } catch (err) {
      console.error('Delete error:', err)
      showMessage('❌ Deletion failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // NEW: Resolve feedback
  async function resolveFeedback(feedbackId: string) {
    setActionLoading(feedbackId)
    try {
      await supabase
        .from('feedback')
        .update({ status: 'resolved' })
        .eq('id', feedbackId)
      showMessage('✅ Feedback resolved!', 'success')
      fetchFeedbacks()
    } catch (err) {
      showMessage('❌ Failed to resolve', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // NEW: Reset user password (temporary)
  async function resetUserPassword(userId: string) {
    setActionLoading(userId)
    try {
      const tempPassword = 'Temp123456'
      const { error } = await supabase.auth.admin.updateUserById(
        userId,
        { password: tempPassword }
      )
      if (error) throw error
      showMessage(`✅ Password reset to: ${tempPassword}`, 'success')
      alert(`User password has been reset to: ${tempPassword}\nTell them to change it after logging in.`)
      fetchUsers()
    } catch (err) {
      console.error('Password reset error:', err)
      showMessage('❌ Password reset failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="bg-amber-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Admin Access</h2>
            <p className="text-gray-500 mt-1">Enter password to continue</p>
          </div>
          {message && (
            <div className={`mb-4 p-3 rounded-lg text-center ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message.text}
            </div>
          )}
          <form onSubmit={handleAuthenticate}>
            <input
              type="password"
              placeholder="Enter admin password"
              className="w-full border border-gray-300 rounded-xl p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white py-3 rounded-xl font-semibold transition-all shadow-md"
            >
              Access Admin Panel
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-amber-700 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  const pendingApprovals = users.filter(u => !u.is_approved).length
  const pendingFeedbacks = feedbacks.filter(f => f.status === 'pending').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-amber-800">Admin Dashboard</h1>
              <p className="text-gray-500 mt-1">Manage bakers, subscriptions, and feedback</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { fetchUsers(); fetchFeedbacks(); }} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg transition">🔄 Refresh</button>
              <button onClick={() => window.location.href = '/'} className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-lg transition">← Back to Dashboard</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              activeTab === 'users' ? 'bg-amber-700 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            👥 Users {pendingApprovals > 0 && `(${pendingApprovals} pending)`}
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              activeTab === 'feedback' ? 'bg-amber-700 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            💬 Feedback {pendingFeedbacks > 0 && `(${pendingFeedbacks} new)`}
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
            {message.text}
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <>
            {pendingApprovals > 0 && (
              <div className="bg-gradient-to-r from-yellow-100 to-amber-100 border-l-4 border-yellow-500 p-4 mb-4 rounded shadow-sm">
                <p className="font-bold text-amber-800">📢 {pendingApprovals} pending approval(s)</p>
                <p className="text-sm text-amber-700">Click "Approve Bakery" for new registrations.</p>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-md p-4 mb-6">
              <p className="text-gray-600">Total registered bakers: <span className="font-bold text-amber-800 text-lg">{users.length}</span></p>
            </div>

            <div className="space-y-4">
              {users.map(user => (
                <div key={user.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-5 border border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <p><strong>📞 Phone:</strong> {user.phone || 'Not provided'}</p>
                    <p><strong>💬 WhatsApp:</strong> {user.whatsapp || 'Not provided'}</p>
                    <p className="md:col-span-2"><strong>🏪 Bakery Name:</strong> {user.bakery_name || 'Not provided'}</p>
                    <p className="md:col-span-2"><strong>📍 Address:</strong> {user.bakery_address || 'Not provided'}</p>
                    <p><strong>✅ Approved:</strong> {user.is_approved ? 'Yes' : 'No'}</p>
                    <p><strong>🔓 Subscription:</strong> {user.subscription_status ? 'Active' : 'Inactive'}</p>
                    <p><strong>📅 Expires:</strong> {user.subscription_end_date ? new Date(user.subscription_end_date).toLocaleDateString() : 'Never'}</p>
                    <p><strong>📆 Joined:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-3 mt-4 flex-wrap">
                    {!user.is_approved && (
                      <button onClick={() => approveUser(user.id)} disabled={actionLoading === user.id} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition disabled:opacity-50">
                        {actionLoading === user.id ? '...' : '✅ Approve Bakery'}
                      </button>
                    )}
                    <button onClick={() => activateUser(user.id, 6)} disabled={actionLoading === user.id} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg transition disabled:opacity-50">
                      {actionLoading === user.id ? '...' : '🔓 Activate for 6 months'}
                    </button>
                    <button onClick={() => deactivateUser(user.id)} disabled={actionLoading === user.id} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg transition disabled:opacity-50">
                      {actionLoading === user.id ? '...' : '🔒 Deactivate'}
                    </button>
                    <button onClick={() => resetUserPassword(user.id)} disabled={actionLoading === user.id} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg transition disabled:opacity-50">
                      {actionLoading === user.id ? '...' : '🔑 Reset Password'}
                    </button>
                    <button onClick={() => deleteUser(user.id, user.phone)} disabled={actionLoading === user.id} className="bg-red-700 hover:bg-red-800 text-white px-5 py-2 rounded-lg transition disabled:opacity-50">
                      {actionLoading === user.id ? '...' : '🗑️ Delete User'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* FEEDBACK TAB */}
        {activeTab === 'feedback' && (
          <>
            {feedbackLoading ? (
              <div className="text-center py-8">Loading feedback...</div>
            ) : feedbacks.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                💬 No feedback yet.
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map(fb => (
                  <div key={fb.id} className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${fb.status === 'resolved' ? 'border-green-500' : 'border-yellow-500'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p><strong>📞 Phone:</strong> {fb.phone || 'Unknown'}</p>
                        <p><strong>🏪 Bakery:</strong> {fb.bakery_name || 'Unknown'}</p>
                        <p className="mt-2 text-gray-700">{fb.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(fb.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${fb.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {fb.status === 'resolved' ? '✅ Resolved' : '⏳ Pending'}
                        </span>
                        {fb.status === 'pending' && (
                          <button
                            onClick={() => resolveFeedback(fb.id)}
                            disabled={actionLoading === fb.id}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm transition disabled:opacity-50"
                          >
                            {actionLoading === fb.id ? '...' : '✅ Resolve'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}