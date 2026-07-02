interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: {
    id: string
    bakeryName: string
    customerName: string
    items: string
    totalAmount: number
    paid: number
    balanceAfter: number
    dateTime: string
    type: 'sale' | 'return'
  }
}

export default function ReceiptModal({ isOpen, onClose, transaction }: ReceiptModalProps) {
  if (!isOpen) return null

  // Ensure all values are numbers
  const totalAmount = Number(transaction.totalAmount) || 0
  const paid = Number(transaction.paid) || 0
  const balanceAfter = Number(transaction.balanceAfter) || 0

  const isReturn = transaction.type === 'return'

  // Calculate the difference
  const difference = totalAmount - paid

  // Determine status based on actual calculation
  let statusMessage = ''
  let statusColor = 'text-gray-700'
  let balanceMessage = ''
  let balanceColor = 'text-gray-700'

  if (isReturn) {
    statusMessage = `🔄 Return – ₦${Math.abs(totalAmount).toLocaleString()} refunded`
    statusColor = 'text-red-600'
    balanceMessage = `Refund: ₦${Math.abs(totalAmount).toLocaleString()}`
    balanceColor = 'text-red-600'
  } else if (totalAmount === 0) {
    statusMessage = '⚠️ No payment recorded'
    statusColor = 'text-gray-500'
    balanceMessage = 'No balance'
    balanceColor = 'text-gray-500'
  } else if (difference > 0) {
    // Customer owes money (paid less than total)
    statusMessage = `⚠️ Owes: ₦${difference.toLocaleString()}`
    statusColor = 'text-red-600'
    balanceMessage = `Owes: ₦${difference.toLocaleString()}`
    balanceColor = 'text-red-600'
  } else if (difference < 0) {
    // Customer overpaid (paid more than total)
    const credit = Math.abs(difference)
    statusMessage = `✅ Overpaid – Credit: ₦${credit.toLocaleString()}`
    statusColor = 'text-green-600'
    balanceMessage = `Credit: ₦${credit.toLocaleString()}`
    balanceColor = 'text-green-600'
  } else {
    // Exactly paid
    statusMessage = '✅ Fully Paid'
    statusColor = 'text-green-600'
    balanceMessage = 'Fully Paid'
    balanceColor = 'text-green-600'
  }

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-content')
    if (!printContent) return
    const originalContents = document.body.innerHTML
    document.body.innerHTML = printContent.innerHTML
    window.print()
    document.body.innerHTML = originalContents
    window.location.reload()
  }

  const handleShare = () => {
    const receiptText = `🍞 BREADLEDGER RECEIPT 🍞
${transaction.bakeryName ? `🏪 ${transaction.bakeryName}` : ''}
─────────────────────
${isReturn ? '🔄 RETURN RECEIPT' : '🧾 SALE RECEIPT'}
─────────────────────
Customer: ${transaction.customerName || 'Unknown'}
Date: ${transaction.dateTime || 'No date recorded'}
─────────────────────
Items:
${transaction.items ? transaction.items.split(',').map(item => `  • ${item.trim()}`).join('\n') : '  No items'}
─────────────────────
${isReturn ? `Refund Amount: ₦${Math.abs(totalAmount).toLocaleString()}` : `Total Amount: ₦${totalAmount.toLocaleString()}`}
${!isReturn ? `Amount Paid: ₦${paid.toLocaleString()}` : ''}
─────────────────────
Status: ${statusMessage}
Customer Balance: ${balanceMessage}
─────────────────────
Receipt #: ${transaction.id.slice(-8)}
🍞 Thank you for your patronage! 🍞`

    if (navigator.share) {
      navigator.share({
        title: 'BreadLedger Receipt',
        text: receiptText,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(receiptText)
      alert('✅ Receipt copied to clipboard!')
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm" onClick={onClose}></div>
        <div className="relative bg-gradient-to-br from-white to-amber-50 rounded-2xl shadow-2xl max-w-md w-full p-6 border-t-8 border-amber-600">
          <div id="receipt-content" className="text-center">
            <div className="flex justify-center mb-3">
              <div className="bg-amber-100 rounded-full p-3 shadow-md">
                <span className="text-4xl">🍞</span>
              </div>
            </div>
            <h2 className="text-3xl font-extrabold text-amber-800">BreadLedger</h2>
            {transaction.bakeryName && (
              <p className="text-sm text-amber-600 font-medium mt-1">{transaction.bakeryName}</p>
            )}
            <p className="text-xs text-gray-500 mb-2">Official Receipt</p>
            
            {/* Return Badge */}
            {isReturn && (
              <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full mb-2">
                🔄 RETURN
              </span>
            )}
            
            <p className="text-md font-bold text-gray-700 bg-amber-100 inline-block px-4 py-1 rounded-full my-2 shadow-sm">
              📅 {transaction.dateTime || 'No date recorded'}
            </p>
            
            <p className="text-lg font-semibold mt-2 text-gray-800">
              Customer: {transaction.customerName || 'Unknown'}
            </p>
            
            <div className="bg-white rounded-xl p-3 my-3 shadow-inner border border-gray-100">
              <p className="font-bold text-left text-gray-700 mb-2">📋 Items:</p>
              <div className="text-left text-md space-y-1 mt-1">
                {transaction.items ? transaction.items.split(',').map((item, idx) => (
                  <p key={idx} className="border-b border-dashed border-gray-200 pb-1 text-gray-600">• {item.trim()}</p>
                )) : <p className="text-gray-400">No items</p>}
              </div>
            </div>
            
            <div className="space-y-2 text-left bg-amber-50 p-3 rounded-xl">
              {isReturn ? (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Refund Amount:</span>
                  <span className="font-bold text-red-600 text-lg">₦{Math.abs(totalAmount).toLocaleString()}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Total Amount:</span>
                    <span className="font-bold text-amber-800 text-lg">₦{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Amount Paid:</span>
                    <span className="font-bold text-green-700 text-lg">₦{paid.toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center border-t border-amber-200 pt-2 mt-2">
                <span className="font-semibold text-gray-700">Status:</span>
                <span className={`font-bold text-lg ${statusColor}`}>
                  {statusMessage}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-700">Customer Balance:</span>
                <span className={`font-bold text-lg ${balanceColor}`}>
                  {balanceMessage}
                </span>
              </div>
            </div>
            
            <hr className="my-4 border-dashed border-amber-200" />
            <p className="text-xs text-gray-400">Receipt #{transaction.id.slice(-8)}</p>
            <p className="text-sm text-amber-700 mt-2 font-medium">🍞 Thank you for your patronage! 🍞</p>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button onClick={handlePrint} className="flex-1 bg-amber-700 hover:bg-amber-800 text-white font-bold py-3 rounded-xl text-lg transition">🖨️ Print</button>
            <button onClick={handleShare} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-lg transition">📤 Share</button>
            <button onClick={onClose} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl text-lg transition">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}