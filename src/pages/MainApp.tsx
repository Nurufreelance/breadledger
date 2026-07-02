import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import Modal from '../components/Modal'
import ReceiptModal from '../components/ReceiptModal'

interface Customer {
  id: string
  name: string
  phone: string
  address: string
  balance: number
}

interface CartItem {
  productId: string
  productName: string
  price: number
  quantity: number
}

interface Transaction {
  id: string
  customerId: string
  customer_name: string  // ✅ Match database column name
  items: string
  total_amount: number   // ✅ Match database column name
  paid: number
  balance_after: number  // ✅ Match database column name
  date_time: string      // ✅ Match database column name
  type: 'sale' | 'return'
}

interface Profile {
  bakery_name: string
  phone: string
}

const PRICE_PRESETS = [100, 200, 300, 400, 500, 700, 1000, 1200, 1500, 2000]

const getFormattedDateTime = (): string => {
  const now = new Date()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayName = days[now.getDay()]
  const day = now.getDate()
  const month = months[now.getMonth()]
  const year = now.getFullYear()
  let hours = now.getHours()
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${dayName}, ${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`
}

function MainApp({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<Transaction | null>(null)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' })

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState(0)

  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null)
  const [customerTransactions, setCustomerTransactions] = useState<Transaction[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const [newReturn, setNewReturn] = useState({ customerId: '', price: 100, quantity: 1 })

  // Feedback state
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  const fetchProfile = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('bakery_name, phone')
      .eq('id', userId)
      .single()
    if (!error && data) {
      setProfile(data)
    }
  }, [userId])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      await fetchProfile()
      
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (customersError) throw customersError
      setCustomers(customersData || [])

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date_time', { ascending: false })
      if (transactionsError) throw transactionsError
      setTransactions(transactionsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, fetchProfile])

  useEffect(() => {
    if (!userId) return
    fetchData()
  }, [userId, fetchData])

  async function handleAddCustomer() {
    if (!newCustomer.name) return alert('Customer name is required')
    const { data, error } = await supabase
      .from('customers')
      .insert({ user_id: userId, name: newCustomer.name.trim(), phone: newCustomer.phone, address: newCustomer.address, balance: 0 })
      .select()
      .single()
    if (error) {
      console.error(error)
      alert('Failed to add customer')
      return
    }
    setCustomers([data, ...customers])
    setNewCustomer({ name: '', phone: '', address: '' })
    setIsAddCustomerOpen(false)
  }

  const getCartTotal = () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  
  const getDiscountedTotal = () => {
    const subtotal = getCartTotal()
    if (discountValue <= 0) return Number(subtotal) || 0
    if (discountType === 'percentage') {
      const discountAmount = (subtotal * discountValue) / 100
      return Number(subtotal - discountAmount) || 0
    } else {
      return Number(subtotal - discountValue) || 0
    }
  }

  async function handleSubmitFeedback() {
    if (!feedbackMessage.trim()) {
      alert('Please write your feedback message')
      return
    }

    setFeedbackSending(true)
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: userId,
          phone: profile?.phone || 'Unknown',
          bakery_name: profile?.bakery_name || 'Unknown',
          message: feedbackMessage.trim(),
          status: 'pending',
        })

      if (error) throw error

      setFeedbackSuccess(true)
      setFeedbackMessage('')
      setTimeout(() => {
        setIsFeedbackOpen(false)
        setFeedbackSuccess(false)
      }, 2000)
    } catch (err) {
      console.error('Feedback error:', err)
      alert('Failed to send feedback. Please try again.')
    } finally {
      setFeedbackSending(false)
    }
  }

  async function handleRecordSale() {
    console.log('=== SALE STARTED ===')
    console.log('selectedCustomerId:', selectedCustomerId)
    console.log('cartItems:', cartItems)
    console.log('userId:', userId)
    
    try {
      if (!selectedCustomerId) {
        alert('Please select a customer')
        return
      }
      if (cartItems.length === 0) {
        alert('Add at least one item to cart')
        return
      }

      const customer = customers.find(c => c.id === selectedCustomerId)
      if (!customer) {
        alert('Customer not found')
        return
      }

      const totalAmount = Number(getDiscountedTotal()) || 0
      const paidNum = Number(parseInt(paidAmount)) || 0
      const newBalance = Number(customer.balance) + (totalAmount - paidNum)
      
      console.log('totalAmount:', totalAmount)
      console.log('paidNum:', paidNum)
      console.log('newBalance:', newBalance)
      
      let itemsString = cartItems.map(item => `₦${item.price}×${item.quantity}`).join(', ')
      if (discountValue > 0) {
        itemsString += ` (Discount: ${discountType === 'percentage' ? `${discountValue}%` : `₦${discountValue}`})`
      }

      const currentDateTime = getFormattedDateTime()

      const insertData = {
        user_id: userId,
        customer_id: selectedCustomerId,
        customer_name: customer.name,
        items: itemsString,
        total_amount: Number(totalAmount),
        paid: Number(paidNum),
        balance_after: Number(newBalance),
        date_time: currentDateTime,
        type: 'sale',
      }
      
      console.log('Inserting data:', insertData)

      const { data: newTransaction, error: txError } = await supabase
        .from('transactions')
        .insert(insertData)
        .select()
        .single()

      if (txError) {
        console.error('Transaction error:', txError)
        alert('Failed to record sale: ' + txError.message)
        return
      }

      console.log('Transaction saved:', newTransaction)

      await supabase.from('customers').update({ balance: newBalance }).eq('id', selectedCustomerId)

      setTransactions([newTransaction, ...transactions])
      setCustomers(customers.map(c => c.id === selectedCustomerId ? { ...c, balance: newBalance } : c))
      setCartItems([])
      setSelectedCustomerId('')
      setPaidAmount('')
      setDiscountValue(0)
      setDiscountType('percentage')
      setIsCartOpen(false)
      
    } catch (err) {
      console.error('SALE ERROR:', err)
      alert('An unexpected error occurred: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  async function handleReturn() {
    const { customerId, price, quantity } = newReturn
    if (!customerId || quantity <= 0) return alert('Select customer and valid quantity')
    const amount = price * quantity
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return
    const newBalance = customer.balance - amount
    const currentDateTime = getFormattedDateTime()
    const { data: returnTx, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        customer_id: customerId,
        customer_name: customer.name,
        items: `Return: ₦${price}×${quantity}`,
        total_amount: -amount,
        paid: 0,
        balance_after: newBalance,
        date_time: currentDateTime,
        type: 'return',
      })
      .select()
      .single()
    if (txError) {
      alert('Failed to record return')
      return
    }
    await supabase.from('customers').update({ balance: newBalance }).eq('id', customerId)
    setTransactions([returnTx, ...transactions])
    setCustomers(customers.map(c => c.id === customerId ? { ...c, balance: newBalance } : c))
    setNewReturn({ customerId: '', price: 100, quantity: 1 })
    setIsReturnOpen(false)
  }

  async function fetchCustomerHistory(customer: Customer) {
    setHistoryLoading(true)
    setSelectedCustomerForHistory(customer)
    setShowHistoryModal(true)
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('user_id', userId)
      .order('date_time', { ascending: false })
    
    if (!error && data) {
      setCustomerTransactions(data)
    } else {
      setCustomerTransactions([])
    }
    setHistoryLoading(false)
  }

  const getFilteredTransactions = () => {
    if (!selectedMonth) return customerTransactions
    return customerTransactions.filter(t => {
      if (!t.date_time) return false
      try {
        const transactionDate = new Date(t.date_time)
        const monthYear = transactionDate.toLocaleString('default', { month: 'long', year: 'numeric' })
        return monthYear === selectedMonth
      } catch {
        return false
      }
    })
  }

  const getUniqueMonths = () => {
    const months = new Set<string>()
    customerTransactions.forEach(t => {
      if (t.date_time) {
        try {
          const date = new Date(t.date_time)
          months.add(date.toLocaleString('default', { month: 'long', year: 'numeric' }))
        } catch {}
      }
    })
    return Array.from(months).sort().reverse()
  }

  const addToCart = (price: number) => {
    const existing = cartItems.find(item => item.price === price)
    if (existing) {
      setCartItems(cartItems.map(item => item.price === price ? { ...item, quantity: item.quantity + 1 } : item))
    } else {
      setCartItems([...cartItems, { productId: `price-${price}`, productName: `₦${price} bread`, price, quantity: 1 }])
    }
  }

  const updateQuantity = (price: number, newQuantity: number) => {
    if (newQuantity <= 0) setCartItems(cartItems.filter(item => item.price !== price))
    else setCartItems(cartItems.map(item => item.price === price ? { ...item, quantity: newQuantity } : item))
  }

  const clearCart = () => {
    setCartItems([])
    setSelectedCustomerId('')
    setPaidAmount('')
    setDiscountValue(0)
    setDiscountType('percentage')
  }

  const filteredCustomers = customers.filter(c =>
    searchTerm === '' || 
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (c.phone && c.phone.includes(searchTerm)) || 
    (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase())))
  
  const filteredTransactions = transactions.filter(t =>
    searchTerm === '' || 
    (t.customer_name && t.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (t.items && t.items.toLowerCase().includes(searchTerm.toLowerCase())))

  const todaySales = transactions
    .filter(t => t.type === 'sale' && t.date_time && t.date_time.includes(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })))
    .reduce((sum, t) => sum + (t.total_amount || 0), 0)
  
  const totalDebt = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0)
  const customerCount = customers.length

  if (loading) return <div className="min-h-screen bg-amber-50 flex items-center justify-center">Loading your bakery data...</div>

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-amber-800 shadow-md sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>🍞</span> BreadLedger
              </h1>
              {profile?.bakery_name && (
                <p className="text-amber-200 text-sm mt-1">🏪 {profile.bakery_name}</p>
              )}
            </div>
            <div className="flex gap-2 items-center">
              {isAdmin && (
                <button 
                  onClick={() => window.location.href = '/#admin'} 
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
                >
                  Admin Panel
                </button>
              )}
              <button 
                onClick={() => setIsFeedbackOpen(true)} 
                className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
              >
                💬 Feedback
              </button>
              <button 
                onClick={() => supabase.auth.signOut()} 
                className="bg-amber-700 hover:bg-amber-900 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 pb-20 pt-4">
        <div className="grid grid-cols-1 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow p-4 border-l-8 border-amber-600">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Today's Sales</span>
              <span className="text-2xl font-bold text-amber-800">₦{todaySales}</span>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border-l-8 border-red-500">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Total Debt</span>
              <span className="text-2xl font-bold text-red-600">₦{totalDebt}</span>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border-l-8 border-green-600">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Customers</span>
              <span className="text-2xl font-bold text-green-700">{customerCount}</span>
            </div>
          </div>
        </div>

        <div className="relative mb-6">
          <input type="text" placeholder="🔍 Search customer or transaction..." className="w-full border border-amber-300 rounded-xl px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 text-xl">✕</button>}
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-bold text-amber-900 mb-3">👥 Customers</h2>
          <div className="space-y-3">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-800">{customer.name}</p>
                  <p className="text-sm text-gray-500">{customer.phone}</p>
                  {customer.balance > 0 && <p className="text-sm text-red-500 font-medium">Owes ₦{customer.balance}</p>}
                  {customer.balance < 0 && <p className="text-sm text-green-600 font-medium">Credit: ₦{-customer.balance}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap">debt</span>
                  <button 
                    onClick={() => fetchCustomerHistory(customer)}
                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full transition whitespace-nowrap"
                  >
                    📋 History
                  </button>
                </div>
              </div>
            ))}
            {filteredCustomers.length === 0 && <p className="text-center text-gray-500 py-4">No customers found</p>}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-amber-900 mb-3">📋 Recent Transactions</h2>
          <div className="space-y-3">
            {filteredTransactions.slice(0, 10).map(t => (
              <div key={t.id} className={`bg-white rounded-xl shadow p-4 ${t.type === 'return' ? 'border-l-4 border-red-400' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{t.customer_name}</p>
                    <p className="text-sm text-gray-600">{t.items}</p>
                    <p className="text-xs text-gray-400">{t.date_time}</p>
                    {t.type === 'return' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full mt-1 inline-block">Return</span>}
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${t.type === 'return' ? 'text-red-600' : 'text-amber-800'}`}>
                      {t.type === 'return' ? '-' : ''}₦{Math.abs(t.total_amount)}
                    </p>
                    {t.type === 'sale' && <p className="text-sm text-green-600">Paid: ₦{t.paid}</p>}
                  </div>
                </div>
                <button onClick={() => setSelectedReceipt(t)} className="mt-3 w-full bg-amber-100 text-amber-800 py-2 rounded-lg text-sm font-medium">🧾 View Receipt</button>
              </div>
            ))}
            {filteredTransactions.length === 0 && <p className="text-center text-gray-500 py-4">No transactions yet</p>}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-amber-200 p-3 flex gap-3 shadow-lg">
        <button onClick={() => setIsAddCustomerOpen(true)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold text-base">+ New Customer</button>
        <button onClick={() => setIsCartOpen(true)} className="flex-1 bg-amber-700 text-white py-3 rounded-xl font-semibold text-base">🛒 Add Sale</button>
        <button onClick={() => setIsReturnOpen(true)} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold text-base">↩️ Return</button>
      </div>

      {/* Add Customer Modal */}
      <Modal isOpen={isAddCustomerOpen} onClose={() => setIsAddCustomerOpen(false)} title="Add Customer">
        <div className="space-y-4">
          <input type="text" placeholder="Full name" className="w-full border rounded-xl p-3 text-base" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
          <input type="tel" placeholder="Phone number" className="w-full border rounded-xl p-3 text-base" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
          <input type="text" placeholder="Address" className="w-full border rounded-xl p-3 text-base" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} />
          <button onClick={handleAddCustomer} className="w-full bg-amber-700 text-white py-3 rounded-xl font-semibold">Save Customer</button>
        </div>
      </Modal>

      {/* Cart Modal */}
      <Modal isOpen={isCartOpen} onClose={() => { clearCart(); setIsCartOpen(false); }} title="Sell Bread">
        <div className="max-h-[70vh] overflow-y-auto space-y-4">
          <div><h3 className="font-semibold text-gray-700 mb-2">Select bread price:</h3><div className="grid grid-cols-2 gap-2">{PRICE_PRESETS.map(price => <button key={price} onClick={() => addToCart(price)} className="bg-amber-100 hover:bg-amber-200 p-3 rounded-xl text-center font-bold text-amber-800">₦{price}</button>)}</div></div>
          
          {cartItems.length > 0 && (<div><h3 className="font-semibold text-gray-700 mb-2">Your cart:</h3><div className="space-y-2">{cartItems.map(item => (<div key={item.productId} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg"><span className="font-medium">₦{item.price}</span><div className="flex items-center gap-2"><button onClick={() => updateQuantity(item.price, item.quantity - 1)} className="bg-gray-300 px-2 py-1 rounded">-</button><span className="w-8 text-center">{item.quantity}</span><button onClick={() => updateQuantity(item.price, item.quantity + 1)} className="bg-gray-300 px-2 py-1 rounded">+</button></div><span>₦{item.price * item.quantity}</span></div>))}</div><div className="text-right font-bold text-lg mt-2">Subtotal: ₦{getCartTotal()}</div></div>)}

          {cartItems.length > 0 && (
            <div className="border-t border-amber-200 pt-3 mt-2">
              <h3 className="font-semibold text-gray-700 mb-2">💰 Discount</h3>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setDiscountType('percentage')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${discountType === 'percentage' ? 'bg-amber-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>%</button>
                <button onClick={() => setDiscountType('fixed')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${discountType === 'fixed' ? 'bg-amber-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>₦</button>
              </div>
              <div className="flex gap-2">
                <input type="number" placeholder={discountType === 'percentage' ? 'Discount %' : 'Discount amount'} className="flex-1 border rounded-xl p-2 text-base" value={discountValue || ''} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} min="0" />
                {discountValue > 0 && (<button onClick={() => setDiscountValue(0)} className="bg-gray-200 hover:bg-gray-300 px-3 rounded-xl text-sm">✕</button>)}
              </div>
              {discountValue > 0 && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg text-center">
                  <p className="text-sm">Subtotal: ₦{getCartTotal()} → <strong>Total: ₦{getDiscountedTotal()}</strong></p>
                </div>
              )}
            </div>
          )}

          <div><h3 className="font-semibold text-gray-700 mb-2">Select customer:</h3><select className="w-full border rounded-xl p-3 text-base" value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}><option value="">-- Choose customer --</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><input type="number" placeholder="Amount paid today (₦)" className="w-full border rounded-xl p-3 text-base" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} /></div>
          
          <button onClick={handleRecordSale} className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold">Complete Sale (₦{getDiscountedTotal()})</button>
          <button onClick={clearCart} className="w-full text-gray-500 py-2 text-sm">Clear cart</button>
        </div>
      </Modal>

      {/* Return Modal */}
      <Modal isOpen={isReturnOpen} onClose={() => setIsReturnOpen(false)} title="Record Return">
        <div className="space-y-4">
          <select className="w-full border rounded-xl p-3 text-base" value={newReturn.customerId} onChange={e => setNewReturn({...newReturn, customerId: e.target.value})}><option value="">Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="w-full border rounded-xl p-3 text-base" value={newReturn.price} onChange={e => setNewReturn({...newReturn, price: parseInt(e.target.value)})}>{PRICE_PRESETS.map(p => <option key={p} value={p}>₦{p} bread</option>)}</select>
          <input type="number" placeholder="Quantity returned" className="w-full border rounded-xl p-3 text-base" value={newReturn.quantity} onChange={e => setNewReturn({...newReturn, quantity: parseInt(e.target.value) || 0})} />
          <button onClick={handleReturn} className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold">Record Return</button>
        </div>
      </Modal>

      {/* Customer History Modal */}
      {showHistoryModal && selectedCustomerForHistory && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-black bg-opacity-60" onClick={() => setShowHistoryModal(false)}></div>
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-amber-800">📋 {selectedCustomerForHistory.name}</h2>
                <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
              <p className="text-gray-600 mb-2">Phone: {selectedCustomerForHistory.phone}</p>
              <p className="text-gray-600 mb-4">
                Current Balance:{' '}
                <span className={selectedCustomerForHistory.balance > 0 ? 'text-red-600 font-bold' : selectedCustomerForHistory.balance < 0 ? 'text-green-600 font-bold' : ''}>
                  {selectedCustomerForHistory.balance > 0 
                    ? `Owes ₦${selectedCustomerForHistory.balance.toLocaleString()}` 
                    : selectedCustomerForHistory.balance < 0 
                      ? `Credit: ₦${Math.abs(selectedCustomerForHistory.balance).toLocaleString()}` 
                      : 'Fully Paid'}
                </span>
              </p>

              {customerTransactions.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by month:</label>
                  <select className="border rounded-xl p-2 w-full md:w-auto" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                    <option value="">All transactions</option>
                    {getUniqueMonths().map(month => (<option key={month} value={month}>{month}</option>))}
                  </select>
                  {selectedMonth && (<button onClick={() => setSelectedMonth('')} className="ml-2 text-sm text-blue-600 hover:text-blue-800">Clear</button>)}
                </div>
              )}

              {historyLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : customerTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No transactions found.</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {getFilteredTransactions().map(t => {
                          const overpaid = t.type === 'sale' && t.paid > t.total_amount ? t.paid - t.total_amount : 0
                          const underpaid = t.type === 'sale' && t.total_amount > t.paid ? t.total_amount - t.paid : 0
                          return (
                            <tr key={t.id} className={t.type === 'return' ? 'bg-red-50' : ''}>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {t.date_time || 'No date recorded'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{t.items}</td>
                              <td className="px-4 py-3 text-sm font-medium text-amber-800">
                                ₦{Math.abs(t.total_amount).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                ₦{t.paid.toLocaleString()}
                                {overpaid > 0 && <div className="text-xs text-green-500">(Overpaid ₦{overpaid.toLocaleString()})</div>}
                                {underpaid > 0 && <div className="text-xs text-red-500">(Owes ₦{underpaid.toLocaleString()})</div>}
                              </td>
                              <td className={`px-4 py-3 text-sm font-medium ${t.balance_after > 0 ? 'text-red-600' : t.balance_after < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                                {t.balance_after > 0 
                                  ? `Owes ₦${t.balance_after.toLocaleString()}` 
                                  : t.balance_after < 0 
                                    ? `Credit: ₦${Math.abs(t.balance_after).toLocaleString()}` 
                                    : 'Fully Paid'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs ${t.type === 'return' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {t.type === 'return' ? 'Return' : 'Sale'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {selectedMonth && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                      <p className="font-semibold">Summary for {selectedMonth}:</p>
                      <p>Total Sales: ₦{getFilteredTransactions().filter(t => t.type === 'sale').reduce((sum, t) => sum + t.total_amount, 0).toLocaleString()}</p>
                      <p>Total Paid: ₦{getFilteredTransactions().filter(t => t.type === 'sale').reduce((sum, t) => sum + t.paid, 0).toLocaleString()}</p>
                      <p>Returns: ₦{getFilteredTransactions().filter(t => t.type === 'return').reduce((sum, t) => sum + Math.abs(t.total_amount), 0).toLocaleString()}</p>
                    </div>
                  )}
                </>
              )}
              <button onClick={() => setShowHistoryModal(false)} className="mt-4 w-full bg-gray-200 hover:bg-gray-300 py-2 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      <Modal isOpen={isFeedbackOpen} onClose={() => { setIsFeedbackOpen(false); setFeedbackMessage(''); setFeedbackSuccess(false); }} title="💬 Send Feedback">
        <div className="space-y-4">
          {feedbackSuccess ? (
            <div className="text-center py-4">
              <span className="text-4xl">✅</span>
              <p className="text-green-600 font-semibold mt-2">Thank you for your feedback!</p>
              <p className="text-sm text-gray-500">We'll review it and get back to you.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">Have a complaint, suggestion, or advice? Let us know how we can serve you better.</p>
              <textarea
                placeholder="Write your message here..."
                className="w-full border rounded-xl p-3 text-base min-h-[120px] focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={feedbackMessage}
                onChange={e => setFeedbackMessage(e.target.value)}
                disabled={feedbackSending}
              />
              <button
                onClick={handleSubmitFeedback}
                disabled={feedbackSending || !feedbackMessage.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50"
              >
                {feedbackSending ? 'Sending...' : 'Submit Feedback'}
              </button>
              <p className="text-xs text-gray-400 text-center">We value your feedback and will respond within 24 hours.</p>
            </>
          )}
        </div>
      </Modal>

    {/* Receipt Modal */}
{selectedReceipt && (
  <ReceiptModal 
    isOpen={!!selectedReceipt} 
    onClose={() => setSelectedReceipt(null)} 
    transaction={{
      id: selectedReceipt.id,
      bakeryName: profile?.bakery_name || '',
      customerName: selectedReceipt.customer_name,  // ✅ Use customer_name (from database)
      items: selectedReceipt.items,
      totalAmount: Number(selectedReceipt.total_amount) || 0,  // ✅ Use total_amount (from database)
      paid: Number(selectedReceipt.paid) || 0,
      balanceAfter: Number(selectedReceipt.balance_after) || 0,
      dateTime: selectedReceipt.date_time || 'No date recorded',
      type: selectedReceipt.type,
    }} 
  />
)}     
    </div>
  )
}

export default MainApp