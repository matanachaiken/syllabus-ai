'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewClassPage() {
  const [name, setName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [professor, setProfessor] = useState('')
  const [semester, setSemester] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter()

  async function handleCreate() {
    if (!name.trim()) {
      setError('Class name is required')
      return
    }

    setLoading(true)
    setError(null)

    const response = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        course_code: courseCode.trim() || null,
        professor: professor.trim() || null,
        semester: semester.trim() || null,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push(`/classes/${result.data.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Back</a>
        <h1 className="text-lg font-semibold text-gray-800">New Class</h1>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Create a class</h2>
          <p className="text-gray-500 text-sm mb-6">You'll upload your syllabus after creating the class</p>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Introduction to Biology"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Course code</label>
            <input
              type="text"
              value={courseCode}
              onChange={e => setCourseCode(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. BIO 101"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Professor</label>
            <input
              type="text"
              value={professor}
              onChange={e => setProfessor(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Dr. Smith"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <input
              type="text"
              value={semester}
              onChange={e => setSemester(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Fall 2026"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create class'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}