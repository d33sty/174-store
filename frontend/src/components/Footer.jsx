function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    const d = digits.slice(1)
    return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`
  }
  return raw
}

export default function Footer() {
  const name = import.meta.env.VITE_OWNER_NAME
  const phone = import.meta.env.VITE_OWNER_PHONE
  const inn = import.meta.env.VITE_OWNER_INN

  if (!name && !phone && !inn) return null

  return (
    <footer className="border-t border-gray-100 bg-white mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} 174-store. Все права защищены.</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs text-gray-400">
          {name && <span>{name}</span>}
          {inn && <span>ИНН {inn}</span>}
          {phone && (
            <a href={`tel:${phone}`} className="hover:text-gray-600 transition-colors">
              {formatPhone(phone)}
            </a>
          )}
        </div>
      </div>
    </footer>
  )
}
