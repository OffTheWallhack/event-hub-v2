import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { Layout } from './components/Layout'
import { Placeholder } from './pages/Placeholder'
import { Users } from './pages/Users'
import { Dashboard } from './pages/Dashboard'
import { EventPage } from './pages/EventPage'
import { Cartons } from './pages/Cartons'
import { EquipmentPage } from './pages/EquipmentPage'
import { Finance } from './pages/Finance'
import { ExportPage } from './pages/ExportPage'
import { Todos } from './pages/Todos'
import { Garage } from './pages/Garage'

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
  createRoute({ getParentRoute: () => rootRoute, path: '/todo', component: Todos }),
  createRoute({ getParentRoute: () => rootRoute, path: '/technika', component: EquipmentPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/kartony', component: Cartons }),
  createRoute({ getParentRoute: () => rootRoute, path: '/garaz', component: Garage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/financie',
    beforeLoad: ({ context }) => { if (!(context as Ctx).isAdmin) throw redirect({ to: '/' }) },
    component: Finance,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/export', component: ExportPage }),
  usersRoute,
])

export const router = createRouter({ routeTree, context: { isAdmin: false } as Ctx })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
