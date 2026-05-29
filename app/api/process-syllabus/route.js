export const maxDuration = 300

import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import pdfParse from 'pdf-parse'

const EVENT_TYPES = ['exam', 'assignment', 'quiz', 'other']

export async function POST(request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { upload_id, class_id } = body
  if (!upload_id || !class_id) {
    return NextResponse.json({ error: 'Missing upload_id or class_id' }, { status: 400 })
  }

  const { data: upload, error: uploadErr } = await supabase
    .from('uploads')
    .select('*')
    .eq('id', upload_id)
    .single()

  if (uploadErr || !upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  try {
    // Download PDF from Supabase Storage
    const storagePath = `${upload.user_id}/${class_id}/${upload.file_name}`
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('syllabi')
      .download(storagePath)

    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`)

    // Extract text from PDF
    const buffer = Buffer.from(await fileBlob.arrayBuffer())
    const pdfData = await pdfParse(buffer)
    const text = pdfData.text?.trim()

    if (!text) throw new Error('PDF appears to be empty or image-only')

    // Call Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Parse this syllabus and return ONLY a valid JSON object with no explanation, no markdown, no code fences. Use exactly this structure:
{
  "events": [{"title": "", "event_date": "YYYY-MM-DD", "type": "exam|assignment|quiz|other", "notes": ""}],
  "syllabus_info": {"course_description": "", "grading": {}, "policies": "", "office_hours": "", "textbooks": []}
}

Rules:
- event_date must be YYYY-MM-DD or null if the date is unknown
- type must be one of: exam, assignment, quiz, other
- grading is an object like {"Midterm": "30%", "Final": "40%"}
- textbooks is an array of strings
- Include every exam, quiz, assignment, project, and deadline you can find

Syllabus text:
${text.slice(0, 60000)}`,
        },
      ],
    })

    const raw = message.content[0]?.text || ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('Claude returned no JSON object')
    const parsed = JSON.parse(cleaned.slice(start, end + 1))

    // Insert events
    const eventsToInsert = (parsed.events || [])
      .filter(e => e.title)
      .map(e => ({
        user_id: upload.user_id,
        class_id,
        upload_id,
        title: String(e.title),
        event_date: e.event_date || null,
        type: EVENT_TYPES.includes(e.type) ? e.type : 'other',
        notes: e.notes || null,
      }))

    if (eventsToInsert.length > 0) {
      await supabase.from('events').insert(eventsToInsert)
    }

    // Insert syllabus_info
    const info = parsed.syllabus_info
    if (info) {
      await supabase.from('syllabus_info').insert({
        user_id: upload.user_id,
        class_id,
        upload_id,
        course_description: info.course_description || null,
        grading: info.grading && Object.keys(info.grading).length > 0 ? info.grading : null,
        policies: info.policies || null,
        office_hours: info.office_hours || null,
        textbooks: Array.isArray(info.textbooks) && info.textbooks.length > 0 ? info.textbooks : null,
      })
    }

    await supabase.from('uploads').update({ status: 'done' }).eq('id', upload_id)
    return NextResponse.json({ success: true, events_count: eventsToInsert.length })
  } catch (err) {
    await supabase.from('uploads').update({ status: 'error' }).eq('id', upload_id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
