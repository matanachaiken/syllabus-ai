import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from './SignOutButton'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">📚 SyllabusAI</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">Your Classes</h2>
            <p className="text-gray-500 text-sm mt-1">Upload a syllabus to get started</p>
          </div>
          <Link
            href="/classes/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + New Class
          </Link>
        </div>

        {classes && classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classes.map(cls => (
              <Link
                key={cls.id}
                href={`/classes/${cls.id}`}
                className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-gray-800">{cls.name}</h3>
                {cls.course_code && (
                  <p className="text-sm text-gray-500 mt-1">{cls.course_code}</p>
                )}
                {cls.professor && (
                  <p className="text-sm text-gray-500">{cls.professor}</p>
                )}
                {cls.semester && (
                  <span className="inline-block mt-3 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                    {cls.semester}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-400 text-sm">No classes yet</p>
            <p className="text-gray-400 text-sm mt-1">Click "New Class" to add your first one</p>
          </div>
        )}
      </div>
    </div>
  )
}