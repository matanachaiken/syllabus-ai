'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

const EVENT_TYPES = ['exam', 'assignment', 'quiz', 'other']

const TYPE_STYLES = {
  exam: 'bg-red-50 text-red-600',
  assignment: 'bg-blue-50 text-blue-600',
  quiz: 'bg-purple-50 text-purple-600',
  other: 'bg-gray-100 text-gray-600',
}

const STATUS_STYLES = {
  done: 'bg-green-50 text-green-600',
  processing: 'bg-yellow-50 text-yellow-600',
  error: 'bg-red-50 text-red-600',
}

function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Group events by month/year
function groupEventsByMonth(events) {
  const groups = {}
  const noDate = []

  events.forEach(ev => {
    if (!ev.event_date) {
      noDate.push(ev)
      return
    }
    const d = new Date(ev.event_date + 'T12:00:00')
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(ev)
  })

  const sorted = Object.entries(groups).sort((a, b) => {
    const da = new Date(a[1][0].event_date)
    const db = new Date(b[1][0].event_date)
    return da - db
  })

  if (noDate.length > 0) sorted.push(['No Date', noDate])
  return sorted
}

export default function ClassDetail({ classData, initialEvents, initialSyllabusInfo, initialUploads }) {
  const supabase = createClient()

  const [classInfo, setClassInfo] = useState(classData)
  const [events, setEvents] = useState(initialEvents)
  const [syllabusInfo, setSyllabusInfo] = useState(initialSyllabusInfo)
  const [uploads, setUploads] = useState(initialUploads)
  const [activeTab, setActiveTab] = useState('upload')

  // Class editing
  const [editingClass, setEditingClass] = useState(false)
  const [classEdit, setClassEdit] = useState({
    name: classData.name,
    course_code: classData.course_code || '',
    professor: classData.professor || '',
    semester: classData.semester || '',
  })
  const [savingClass, setSavingClass] = useState(false)

  // Upload
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  // Event inline editing
  const [editingEventId, setEditingEventId] = useState(null)
  const [eventEdit, setEventEdit] = useState({})
  const [savingEvent, setSavingEvent] = useState(false)

  // Adding a new event
  const [addingEvent, setAddingEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', event_date: '', type: 'other', notes: '' })
  const [savingNew, setSavingNew] = useState(false)

  // ── Polling: refresh uploads every 3s while any are processing ──
  useEffect(() => {
    if (!uploads.some(u => u.status === 'processing')) return

    const interval = setInterval(async () => {
      const { data: fresh } = await supabase
        .from('uploads')
        .select('*')
        .eq('class_id', classInfo.id)
        .order('created_at', { ascending: false })

      if (!fresh) return
      setUploads(fresh)

      if (!fresh.some(u => u.status === 'processing')) {
        const [evRes, siRes] = await Promise.all([
          supabase.from('events').select('*').eq('class_id', classInfo.id).order('event_date'),
          supabase.from('syllabus_info').select('*').eq('class_id', classInfo.id).maybeSingle(),
        ])
        if (evRes.data) setEvents(evRes.data)
        if (siRes.data !== undefined) setSyllabusInfo(siRes.data)
        setActiveTab('events')
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [uploads])

  // ── Class editing ──
  async function saveClassEdit() {
    setSavingClass(true)
    const { data, error } = await supabase
      .from('classes')
      .update({
        name: classEdit.name.trim(),
        course_code: classEdit.course_code.trim() || null,
        professor: classEdit.professor.trim() || null,
        semester: classEdit.semester.trim() || null,
      })
      .eq('id', classInfo.id)
      .select()
      .single()
    setSavingClass(false)
    if (!error && data) {
      setClassInfo(data)
      setEditingClass(false)
    }
  }

  // ── Upload ──
  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    setUploadError(null)

    const form = new FormData()
    form.append('file', selectedFile)
    form.append('class_id', classInfo.id)

    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const result = await res.json()

    setUploading(false)

    if (!res.ok) {
      setUploadError(result.error || 'Upload failed')
      return
    }

    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploads(prev => [result.data, ...prev])
  }

  // ── Event editing ──
  function startEditEvent(ev) {
    setEditingEventId(ev.id)
    setEventEdit({ title: ev.title, event_date: ev.event_date || '', type: ev.type || 'other', notes: ev.notes || '' })
  }

  async function saveEventEdit() {
    setSavingEvent(true)
    const { data, error } = await supabase
      .from('events')
      .update(eventEdit)
      .eq('id', editingEventId)
      .select()
      .single()
    setSavingEvent(false)
    if (!error && data) {
      setEvents(events.map(e => e.id === editingEventId ? data : e))
      setEditingEventId(null)
    }
  }

  // ── Delete event ──
  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (!error) setEvents(events.filter(e => e.id !== id))
  }

  // ── Add event ──
  async function addEvent() {
    if (!newEvent.title.trim()) return
    setSavingNew(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        class_id: classInfo.id,
        title: newEvent.title.trim(),
        event_date: newEvent.event_date || null,
        type: newEvent.type,
        notes: newEvent.notes || null,
      })
      .select()
      .single()
    setSavingNew(false)
    if (!error && data) {
      setEvents(prev => [...prev, data].sort((a, b) => {
        if (!a.event_date) return 1
        if (!b.event_date) return -1
        return a.event_date.localeCompare(b.event_date)
      }))
      setNewEvent({ title: '', event_date: '', type: 'other', notes: '' })
      setAddingEvent(false)
    }
  }

  const isProcessing = uploads.some(u => u.status === 'processing')
  const groupedEvents = groupEventsByMonth(events)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Nav ── */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium truncate">{classInfo.name}</span>
      </nav>

      {/* ── Class header ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {editingClass ? (
            <div className="flex flex-col gap-3 max-w-lg">
              <input
                value={classEdit.name}
                onChange={e => setClassEdit({ ...classEdit, name: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Class name"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={classEdit.course_code}
                  onChange={e => setClassEdit({ ...classEdit, course_code: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Course code"
                />
                <input
                  value={classEdit.professor}
                  onChange={e => setClassEdit({ ...classEdit, professor: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Professor"
                />
                <input
                  value={classEdit.semester}
                  onChange={e => setClassEdit({ ...classEdit, semester: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Semester"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveClassEdit}
                  disabled={savingClass || !classEdit.name.trim()}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingClass ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingClass(false)}
                  className="border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-800">{classInfo.name}</h1>
                <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-gray-500">
                  {classInfo.course_code && <span>{classInfo.course_code}</span>}
                  {classInfo.professor && <span>{classInfo.professor}</span>}
                  {classInfo.semester && (
                    <span className="text-blue-600 font-medium">{classInfo.semester}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setClassEdit({
                    name: classInfo.name,
                    course_code: classInfo.course_code || '',
                    professor: classInfo.professor || '',
                    semester: classInfo.semester || '',
                  })
                  setEditingClass(true)
                }}
                className="text-sm text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 shrink-0"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 flex gap-1">
          {[
            { id: 'upload', label: isProcessing ? 'Upload ●' : 'Upload' },
            { id: 'events', label: `Events${events.length > 0 ? ` (${events.length})` : ''}` },
            { id: 'syllabus', label: 'Syllabus Info' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ════ Upload Tab ════ */}
        {activeTab === 'upload' && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Upload Syllabus PDF</h2>
              <p className="text-sm text-gray-500 mb-6">
                Claude will extract all events, grading, office hours, and policies.
              </p>

              {uploadError && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
                  {uploadError}
                </div>
              )}

              {uploading ? (
                <div className="text-center py-8">
                  <div className="inline-block w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm font-medium text-gray-700">Uploading & processing with Claude…</p>
                  <p className="text-xs text-gray-400 mt-1">This can take up to 60 seconds</p>
                </div>
              ) : (
                <>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    {selectedFile ? (
                      <>
                        <p className="text-sm font-medium text-gray-700">{selectedFile.name}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">Click to select a PDF</p>
                    )}
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile}
                    className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Upload &amp; Process
                  </button>
                </>
              )}
            </div>

            {/* Upload history */}
            {uploads.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Upload History</h3>
                <div className="space-y-2">
                  {uploads.map(u => (
                    <div
                      key={u.id}
                      className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm text-gray-800">{u.file_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmt(u.created_at?.slice(0, 10))}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.status === 'processing' && (
                          <div className="w-3.5 h-3.5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                        )}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[u.status] || STATUS_STYLES.error}`}>
                          {u.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ Events Tab ════ */}
        {activeTab === 'events' && (
          <div>
            {events.length === 0 && !addingEvent ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-400 text-sm">No events yet</p>
                <p className="text-gray-400 text-sm mt-1">Upload a syllabus or add an event manually</p>
                <div className="flex justify-center gap-3 mt-4">
                  <button onClick={() => setActiveTab('upload')} className="text-blue-600 text-sm hover:underline">
                    Upload syllabus →
                  </button>
                  <button onClick={() => setAddingEvent(true)} className="text-blue-600 text-sm hover:underline">
                    Add event →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Grouped events */}
                {groupedEvents.map(([monthLabel, monthEvents]) => (
                  <div key={monthLabel}>
                    {/* Month header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                        {monthLabel}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">{monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Events in this month */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-2/5">Title</th>
                            <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                            <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                            <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</th>
                            <th className="px-5 py-3 w-24"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {monthEvents.map(ev => (
                            <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                              {editingEventId === ev.id ? (
                                <>
                                  <td className="px-5 py-3">
                                    <input
                                      value={eventEdit.title}
                                      onChange={e => setEventEdit({ ...eventEdit, title: e.target.value })}
                                      className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="px-5 py-3">
                                    <input
                                      type="date"
                                      value={eventEdit.event_date}
                                      onChange={e => setEventEdit({ ...eventEdit, event_date: e.target.value })}
                                      className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="px-5 py-3">
                                    <select
                                      value={eventEdit.type}
                                      onChange={e => setEventEdit({ ...eventEdit, type: e.target.value })}
                                      className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                      {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-5 py-3">
                                    <input
                                      value={eventEdit.notes}
                                      onChange={e => setEventEdit({ ...eventEdit, notes: e.target.value })}
                                      className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="Optional"
                                    />
                                  </td>
                                  <td className="px-5 py-3">
                                    <div className="flex gap-2 justify-end">
                                      <button onClick={saveEventEdit} disabled={savingEvent} className="text-blue-600 hover:underline disabled:opacity-50">
                                        {savingEvent ? 'Saving…' : 'Save'}
                                      </button>
                                      <button onClick={() => setEditingEventId(null)} className="text-gray-400 hover:text-gray-600">
                                        Cancel
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-5 py-4 font-medium text-gray-800">{ev.title}</td>
                                  <td className="px-5 py-4 text-gray-600">{fmt(ev.event_date)}</td>
                                  <td className="px-5 py-4">
                                    <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${TYPE_STYLES[ev.type] || TYPE_STYLES.other}`}>
                                      {ev.type}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 text-gray-500 max-w-xs truncate">{ev.notes || '—'}</td>
                                  <td className="px-5 py-4">
                                    <div className="flex gap-3 justify-end">
                                      <button onClick={() => startEditEvent(ev)} className="text-gray-400 hover:text-blue-600 transition-colors">
                                        Edit
                                      </button>
                                      <button onClick={() => deleteEvent(ev.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Add event row */}
                {addingEvent && (
                  <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="bg-blue-50">
                          <td className="px-5 py-3 w-2/5">
                            <input
                              autoFocus
                              value={newEvent.title}
                              onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                              className="w-full border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Event title"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <input
                              type="date"
                              value={newEvent.event_date}
                              onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                              className="border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <select
                              value={newEvent.type}
                              onChange={e => setNewEvent({ ...newEvent, type: e.target.value })}
                              className="border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-3">
                            <input
                              value={newEvent.notes}
                              onChange={e => setNewEvent({ ...newEvent, notes: e.target.value })}
                              className="w-full border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Optional"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex gap-2 justify-end">
                              <button onClick={addEvent} disabled={savingNew || !newEvent.title.trim()} className="text-blue-600 hover:underline disabled:opacity-50">
                                {savingNew ? 'Adding…' : 'Add'}
                              </button>
                              <button onClick={() => setAddingEvent(false)} className="text-gray-400 hover:text-gray-600">
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {!addingEvent && (
                  <button onClick={() => setAddingEvent(true)} className="text-sm text-blue-600 hover:underline">
                    + Add event
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ Syllabus Info Tab ════ */}
        {activeTab === 'syllabus' && (
          <>
            {!syllabusInfo ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-400 text-sm">No syllabus info extracted yet</p>
                <button onClick={() => setActiveTab('upload')} className="mt-4 text-blue-600 text-sm hover:underline">
                  Upload syllabus →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {syllabusInfo.course_description && (
                  <InfoSection title="Course Description">
                    <p className="text-sm text-gray-600 leading-relaxed">{syllabusInfo.course_description}</p>
                  </InfoSection>
                )}
                {syllabusInfo.grading && Object.keys(syllabusInfo.grading).length > 0 && (
                  <InfoSection title="Grading">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                      {Object.entries(syllabusInfo.grading).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-sm border-b border-gray-100 pb-1">
                          <span className="text-gray-600">{k}</span>
                          <span className="font-medium text-gray-800">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </InfoSection>
                )}
                {syllabusInfo.office_hours && (
                  <InfoSection title="Office Hours">
                    <p className="text-sm text-gray-600">{syllabusInfo.office_hours}</p>
                  </InfoSection>
                )}
                {syllabusInfo.policies && (
                  <InfoSection title="Policies">
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{syllabusInfo.policies}</p>
                  </InfoSection>
                )}
                {syllabusInfo.textbooks && syllabusInfo.textbooks.length > 0 && (
                  <InfoSection title="Textbooks">
                    <ul className="space-y-1 list-disc list-inside">
                      {syllabusInfo.textbooks.map((b, i) => (
                        <li key={i} className="text-sm text-gray-600">
                          {typeof b === 'string' ? b : JSON.stringify(b)}
                        </li>
                      ))}
                    </ul>
                  </InfoSection>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function InfoSection({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}