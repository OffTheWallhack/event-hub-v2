import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { Layout } from './components/Layout'
import { Placeholder } from './pages/Placeholder'
import { Users } from './pages/Users'
import { Dashboard } from './pages/Dashboard'
import { EventPage } from './pages/EventPage'
import { Cartons } from './pages/Cartons'

type Ctx = { isAdmin: boolean }

const rootRoute = createRootRoute({ component: Layout })

const page = (path: string, title: string, step: number, adminOnly = false) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    beforeLoad: ({ context }) => {
      if (adminOnly && !(context as Ctx).isAdmin) throw redirect({ to: '/' })
    },
    component: () => <Placeholder title={title} step={step} />,
  })

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nastavenia',
  beforeLoad: ({ context }) => {
    if (!(context as Ctx).isAdmin) throw redirect({ to: '/' })
  },
  component: Users,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (s: Record<string, unknown>): { m?: string } =>
    typeof s.m === 'string' ? { m: s.m } : {},
  component: Dashboard,
})

const eventRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/event/$id',
  component: EventPage,
})

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  eventRoute,
  page('/todo', 'To-Do', 9),
  page('/technika', 'Technika', 5),
  createRoute({ getParentRoute: () => rootRoute, path: '/kartony', component: Cartons }),
  page('/garaz', 'Garáž', 9),
  page('/financie', 'Financie', 6, true),
  page('/export', 'Export', 7),
  usersRoute,
])

export const router = createRouter({ routeTree, context: { isAdmin: false } as Ctx })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
