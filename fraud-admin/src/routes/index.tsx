import { Routes, Route, Navigate } from 'react-router'
import { Suspense, lazy } from 'react'
import { RootLayout, PageLayout } from '@/components/layouts'
import { ProtectedRoute } from './ProtectedRoute'
import { Loading } from '@/components/ui/loading'
import { LoginPage } from '@/features/auth'

const AdminDashboard = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.AdminDashboard })))
const SettingsPage = lazy(() => import('@/features/settings').then((m) => ({ default: m.SettingsPage })))
const FraudListPage = lazy(() => import('@/features/frauds').then((m) => ({ default: m.FraudListPage })))
const CategoryListPage = lazy(() => import('@/features/categories').then((m) => ({ default: m.CategoryListPage })))
const MembershipPlansPage = lazy(() => import('@/features/membership').then((m) => ({ default: m.MembershipPlansPage })))
const MembershipSubscribersPage = lazy(() => import('@/features/membership').then((m) => ({ default: m.MembershipSubscribersPage })))
const UsersListPage = lazy(() => import('@/features/users').then((m) => ({ default: m.UsersListPage })))
const PaymentsPage = lazy(() => import('@/features/payments').then((m) => ({ default: m.PaymentsPage })))
const ServicePaymentsPage = lazy(() => import('@/features/service-payments').then((m) => ({ default: m.ServicePaymentsPage })))
const ServicesPage = lazy(() => import('@/features/services').then((m) => ({ default: m.ServicesPage })))
const TransactionsPage = lazy(() => import('@/features/transactions').then((m) => ({ default: m.TransactionsPage })))
const LendersPage = lazy(() => import('@/features/lenders').then((m) => ({ default: m.LendersPage })))

export default function AppRoutes() {
  return (
    <Suspense fallback={<Loading fullScreen />}>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<PageLayout />}>
              <Route path="/dashboard" element={<AdminDashboard />} />
              <Route path="/users" element={<UsersListPage />} />
              <Route path="/frauds" element={<FraudListPage />} />
              <Route path="/categories" element={<CategoryListPage />} />
              <Route path="/membership" element={<MembershipSubscribersPage />} />
              <Route path="/membership/plans" element={<MembershipPlansPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/payments/review" element={<PaymentsPage />} />
              <Route path="/service-payments" element={<ServicePaymentsPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/lenders" element={<LendersPage />} />
              <Route path="/settings/:section" element={<SettingsPage />} />
              <Route path="/settings" element={<Navigate to="/settings/quota" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
