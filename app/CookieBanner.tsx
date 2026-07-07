'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'bedsync_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white px-4 py-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <p className="text-sm text-gray-300 leading-relaxed">
          We use cookies to keep you logged in and remember your preferences. By continuing to use BedSync, you agree to our use of cookies.
        </p>
        <button
          onClick={accept}
          className="shrink-0 bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
