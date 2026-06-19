import { useState } from 'react'
import { supabase } from '../services/supabase'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [bakeryName, setBakeryName] = useState('')
  const [bakeryAddress, setBakeryAddress] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      // Validate bakery name is required
      if (!bakeryName.trim()) {
        setMessage('Bakery name is required')
        setLoading(false)
        return
      }

      const fakeEmail = `${phone}@phone.breadledger.com`
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password,
      })

      if (signUpError) {
        setMessage(signUpError.message)
        setLoading(false)
        return
      }

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            phone,
            whatsapp,
            bakery_name: bakeryName,
            bakery_address: bakeryAddress,
            is_approved: false,
          })
          .eq('id', authData.user.id)

        if (profileError) {
          setMessage('Account created but profile update failed.')
        } else {
          setMessage('Account created! Wait for admin approval.')
        }
      }
    } else {
      const email = `${phone}@phone.breadledger.com`
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setMessage('Invalid phone number or password')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="bg-amber-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🍞</span>
          </div>
          <h1 className="text-3xl font-bold text-amber-800">BreadLedger</h1>
          <p className="text-gray-500">{isSignUp ? 'Register your bakery' : 'Login with your phone number'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="tel"
            placeholder="Phone number (e.g., 07012599375)"
            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
          
          {isSignUp && (
            <>
              <input
                type="tel"
                placeholder="WhatsApp number"
                className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Bakery name * (required)"
                className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={bakeryName}
                onChange={e => setBakeryName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Bakery address"
                className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={bakeryAddress}
                onChange={e => setBakeryAddress(e.target.value)}
                required
              />
            </>
          )}
          
          <input
            type="password"
            placeholder="Password"
            className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white py-3 rounded-xl font-semibold transition-all shadow-md disabled:opacity-50"
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Register Bakery' : 'Login')}
          </button>
        </form>
        
        <div className="text-center mt-4">
          <p className="text-sm">
            {isSignUp ? 'Already registered?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignUp(!isSignUp); setMessage(''); }} className="text-amber-700 font-semibold hover:underline">
              {isSignUp ? 'Login' : 'Register your bakery'}
            </button>
          </p>
          
          {/* Forgot Password Button */}
          {!isSignUp && (
            <button 
              onClick={() => setShowForgotPassword(!showForgotPassword)}
              className="text-sm text-blue-600 hover:underline mt-2 block mx-auto"
            >
              Forgot password?
            </button>
          )}
          
          {showForgotPassword && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-gray-700">📱 Contact admin to reset your password:</p>
              <p className="text-sm font-semibold text-amber-800">WhatsApp: +2347012599375</p>
              <p className="text-xs text-gray-500 mt-1">Include your phone number when messaging.</p>
            </div>
          )}
        </div>
        
        {message && <p className="text-center text-red-500 text-sm mt-2">{message}</p>}
      </div>
    </div>
  )
}