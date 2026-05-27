# FraudChecker Admin Panel

## Tech Stack
- **Vite + React 19 + TypeScript**
- **UI: shadcn/ui** (Radix + Tailwind CSS v4)
- **Router**: react-router-dom v7
- **State**: Zustand (auth store)
- **API**: axios + JWT interceptors
- **Query**: React Query (TanStack)
- **Icons**: Lucide React
- **Theme**: next-themes (dark/light)
- **Toast**: Sonner

## Architecture: Feature-Based

```
src/
├── components/
│   ├── layouts/          ← Sidebar + PageLayout
│   └── ui/               ← shadcn/ui components
├── constants/
│   ├── api-routes.ts     ← Centralized API paths
│   ├── enums.ts          ← Status labels + styles
│   └── sidebar-data.ts   ← Sidebar navigation
├── features/
│   ├── auth/             ← Login + auth store
│   ├── dashboard/        ← Stats + KPI
│   ├── frauds/           ← Fraud list + verify + edit
│   ├── settings/         ← System settings (pricing, display, LINE, payment)
│   ├── membership/       ← Plans + subscribers
│   └── payments/         ← Slip review + payment history
├── lib/
│   ├── api-client.ts     ← axios + JWT interceptors
│   └── utils.ts          ← cn() helper
├── routes/               ← react-router config
└── theme/                ← dark/light mode
```

## Rules
- ใช้ shadcn/ui components เสมอ
- API routes centralized ใน constants/api-routes.ts
- Feature structure: service.ts → hooks.ts → types.ts → pages/ → components/
- DTO JSON tag ใช้ camelCase
- ห้าม hardcode API URLs ใน components
- Backend API: http://localhost:3000/api/v1 (Go Fiber)
