import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ClassDetail from './ClassDetail'

export default async function ClassPage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [classResult, eventsResult, syllabusResult, uploadsResult] = await Promise.all([
    supabase.from('classes').select('*').eq('id', id).single(),
    supabase.from('events').select('*').eq('class_id', id).order('event_date'),
    supabase.from('syllabus_info').select('*').eq('class_id', id).maybeSingle(),
    supabase.from('uploads').select('*').eq('class_id', id).order('created_at', { ascending: false }),
  ])

  if (classResult.error || !classResult.data) redirect('/dashboard')

  return (
    <ClassDetail
      classData={classResult.data}
      initialEvents={eventsResult.data || []}
      initialSyllabusInfo={syllabusResult.data || null}
      initialUploads={uploadsResult.data || []}
    />
  )
}
