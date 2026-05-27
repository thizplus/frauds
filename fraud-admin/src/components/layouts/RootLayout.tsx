import { Outlet } from 'react-router'
import { Toaster } from '@/components/ui/sonner'

export function RootLayout() {
  return (
    <div className="bg-background text-foreground min-h-svh antialiased">
      <Outlet />
      <Toaster
        style={{
          fontFamily: 'Roboto, "Google Sans", "Google Sans Text", sans-serif',
        }}
        position="top-right"
        richColors
      />
    </div>
  )
}
