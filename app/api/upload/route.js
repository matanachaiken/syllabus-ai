import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let formData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const classId = formData.get('class_id')

  if (!file || !classId) {
    return NextResponse.json({ error: 'Missing file or class_id' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${user.id}/${classId}/${file.name}`

  const { error: storageError } = await supabase.storage
    .from('syllabi')
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

  if (storageError) {
    return NextResponse.json({ error: `Storage error: ${storageError.message}` }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('syllabi').getPublicUrl(storagePath)

  const { data: uploadRecord, error: insertError } = await supabase
    .from('uploads')
    .insert({
      user_id: user.id,
      class_id: classId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      status: 'processing',
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Fire-and-forget: trigger processing without blocking the response
  const cookie = request.headers.get('cookie') || ''
  fetch(new URL('/api/process-syllabus', request.url).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ upload_id: uploadRecord.id, class_id: classId }),
  }).catch(() => {})

  return NextResponse.json({ data: uploadRecord })
}
