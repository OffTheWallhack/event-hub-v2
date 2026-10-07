import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TodoList } from '../components/TodoList'
import type { VehicleOpt } from '../lib/todos'

export function Todos() {
  const { isAdmin } = useAuth()
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([])
  useEffect(() => {
    supabase.from('vehicles').select('id, name').eq('active', true).order('sort_order').then(({ data }) => setVehicles((data ?? []) as VehicleOpt[]))
  }, [])
  return (
    <section className="flex flex-col gap-4 min-w-0">
      <h1 className="display text-4xl font-bold">To-Do</h1>
      <TodoList vehicles={vehicles} isAdmin={isAdmin} />
    </section>
  )
}
