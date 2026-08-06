// Groups client_form_types rows by client_id into a Map<clientId, Set<formTypeId>> — used
// wherever the global form_types catalog needs filtering down to what a specific client
// actually tracks (dashboard, clients list, search, client detail/checklist).
export async function fetchClientFormTypeMap(supabase: any, clientIds?: string[]): Promise<Map<string, Set<string>>> {
  let query = supabase.from('client_form_types').select('client_id, form_type_id')
  if (clientIds) query = query.in('client_id', clientIds)
  const { data } = await query
  const map = new Map<string, Set<string>>()
  for (const row of data || []) {
    if (!map.has(row.client_id)) map.set(row.client_id, new Set())
    map.get(row.client_id)!.add(row.form_type_id)
  }
  return map
}
