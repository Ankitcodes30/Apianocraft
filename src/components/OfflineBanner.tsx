import React, { useEffect, useState } from 'react'

/**
 * Offline status banner component.
 * Displays a subtle indicator when device network connection is offline,
 * reassuring the user that Apianocraft PWA runs 100% client-side from cache.
 */
export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine)

  useEffect(() => {
    const handleOnline = (): void => setIsOffline(false)
    const handleOffline = (): void => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="ap-offline-banner" data-offline-banner>
      <span className="ap-offline-banner__icon">⚡</span>
      <span className="ap-offline-banner__text">
        PWA Offline Mode Active — Running 100% from local audio cache
      </span>
    </div>
  )
}
