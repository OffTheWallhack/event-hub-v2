import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TodoList } from '../components/TodoList'
import { CalendarBox } from '../components/CalendarBox'
import { PageHeader } from '../components/ui'
import { GARAGE_VEHICLES, type VehicleOpt } from '../lib/todos'

export function Todos() {
  const { isAdmin } = useAuth()
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([])
  useEffect(() => {
    supabase.from('vehicles').select('id, name').eq('active', true).order('sort_order').then(({ data }) => setVehicles(((data ?? []) as VehicleOpt[]).filter((v) => GARAGE_VEHICLES.includes(v.name))))
  }, [])
  return (
    <div className="page">
      <PageHeader title="To-Do" />
      <TodoList vehicles={vehicles} isAdmin={isAdmin} />
      {isAdmin && <CalendarBox />}
    </div>
  )
}
