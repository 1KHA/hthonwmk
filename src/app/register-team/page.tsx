'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterTeamPage() {
  const router = useRouter()

  // Redirect to login page immediately when component mounts
  useEffect(() => {
    router.replace('/login')
  }, [router])

  // Return a minimal loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#620F10] mx-auto mb-4"></div>
        <p className="text-gray-600" style={{ fontFamily: 'Somar-Medium, Arial, sans-serif' }}>
          جاري إعادة التوجيه...
        </p>
      </div>
    </div>
  )
}
