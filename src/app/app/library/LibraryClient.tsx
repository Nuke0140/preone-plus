'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Breadcrumbs } from '@/components/preone/Breadcrumbs'
import { PageHead, KpiTile, StatusBadge } from '@/components/preone/ui'
import { TactileButton } from '@/components/preone/TactileMotion'
import { Modal } from '@/components/preone/Modal'
import { EmptyState } from '@/components/preone'
import { apiFetch, parseApiError } from '@/lib/client-api'
import { BookOpen, Plus, BookUp, BookDown, AlertTriangle, Library as LibraryIcon, PackageCheck, Clock3 } from 'lucide-react'

interface Book {
  id: string; title: string; author: string | null; isbn: string | null; category: string | null
  totalCopies: number; availableCopies: number; shelfLocation: string | null; status: string
}
interface Issue {
  id: string; status: string; issuedAt: string; dueDate: string; returnedAt: string | null; fineCents: number
  book: { id: string; title: string; author: string | null }
  student?: { id: string; admissionNo: string; firstName: string; lastName: string | null } | null
  staffUser?: { id: string; fullName: string } | null
}
interface Student { id: string; admissionNo: string; firstName: string; lastName: string | null }

const fmtINR = (cents: number) => `₹${(cents / 100).toLocaleString('en-IN')}`

export function LibraryClient({ session }: { session: any }) {
  const [tab, setTab] = useState<'catalog' | 'issues'>('catalog')
  const [books, setBooks] = useState<Book[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [stats, setStats] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')

  const [showBook, setShowBook] = useState(false)
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '', category: '', publisher: '', totalCopies: '1', shelfLocation: '' })

  const [showIssue, setShowIssue] = useState(false)
  const [issueForm, setIssueForm] = useState({ bookId: '', studentId: '', dueDate: '' })

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    const q = search ? `&search=${encodeURIComponent(search)}` : ''
    const [b, i, d] = await Promise.all([
      apiFetch<{ items: Book[] }>(`/api/v1/library/books?pageSize=200${q}`),
      apiFetch<{ items: Issue[] }>('/api/v1/library/issues?pageSize=100'),
      apiFetch<any>('/api/v1/library/books?meta=dashboard'),
    ])
    if (b.success && b.data) setBooks(b.data.items || [])
    else setError(parseApiError(b).message)
    if (i.success && i.data) setIssues(i.data.items || [])
    if (d.success && d.data) setStats(d.data)
    setLoading(false)
  }, [search])

  useEffect(() => {
    load()
    apiFetch<any>('/api/v1/students?pageSize=500').then((r) => {
      if (r.success && r.data) {
        const payload: any = r.data
        setStudents(Array.isArray(payload) ? payload : payload?.data || payload?.items || [])
      }
    })
  }, [load])

  const addBook = async () => {
    setError('')
    const r = await apiFetch('/api/v1/library/books', {
      method: 'POST',
      body: JSON.stringify({ ...bookForm, totalCopies: Number(bookForm.totalCopies) || 1 }),
    })
    if (r.success) {
      setShowBook(false)
      setBookForm({ title: '', author: '', isbn: '', category: '', publisher: '', totalCopies: '1', shelfLocation: '' })
      flash('Book added to catalog')
      load()
    } else setError(parseApiError(r).message)
  }

  const issueBook = async () => {
    setError('')
    const r = await apiFetch('/api/v1/library/issues', { method: 'POST', body: JSON.stringify(issueForm) })
    if (r.success) {
      setShowIssue(false)
      setIssueForm({ bookId: '', studentId: '', dueDate: '' })
      flash('Book issued')
      load()
    } else setError(parseApiError(r).message)
  }

  const returnBook = async (issue: Issue, lost = false) => {
    setError('')
    const r = await apiFetch(`/api/v1/library/issues/${issue.id}/return`, { method: 'POST', body: JSON.stringify({ lost }) })
    if (r.success) {
      flash(lost ? 'Marked lost & fine applied' : 'Book returned')
      load()
    } else setError(parseApiError(r).message)
  }

  const issueStatusVariant = (s: string) => s === 'ISSUED' ? 'info' : s === 'RETURNED' ? 'success' : s === 'OVERDUE' ? 'danger' : 'warning'

  const issuableBooks = books.filter((b) => b.availableCopies > 0)

  return (
    <div className="page-shell space-y-6">
      <Breadcrumbs items={[{ label: 'Home', href: '/app/home' }, { label: 'Library' }]} />
      <PageHead
        eyebrow="PreOne Plus"
        title="Library"
        description="Book catalog, issue & return workflow, and overdue fine tracking"
        backHref="/app/home"
        actions={<TactileButton variant="primary" size="md" onClick={() => setShowBook(true)}><Plus size={16} className="mr-1.5" />Add Book</TactileButton>}
      />

      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <KpiTile label="Titles" value={stats.totalTitles} icon={<LibraryIcon size={18} />} iconClass="ic-purple" />
          <KpiTile label="Copies Available" value={stats.availableCopies} icon={<PackageCheck size={18} />} iconClass="ic-green" />
          <KpiTile label="Currently Issued" value={stats.activeIssues} icon={<BookUp size={18} />} iconClass="ic-orange" />
          <KpiTile label="Overdue" value={stats.overdueIssues} icon={<Clock3 size={18} />} iconClass="ic-red" />
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        {([['catalog', 'Catalog', <BookOpen size={14} key="b" />], ['issues', 'Issues & Returns', <BookUp size={14} key="i" />]] as const).map(([k, label, icon]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-ghost'}`} style={{ border: '1px solid var(--border-default)' }}>{icon} {label}</button>
        ))}
        {tab === 'catalog' && (
          <input className="input ml-auto md:w-72" placeholder="Search title, author, ISBN…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search books" />
        )}
        {tab === 'issues' && (
          <TactileButton variant="primary" size="sm" className="ml-auto" onClick={() => setShowIssue(true)}><BookUp size={14} className="mr-1" />Issue Book</TactileButton>
        )}
      </div>

      {error && <div className="card p-3 text-sm" style={{ borderColor: 'var(--danger, #EF4444)', color: 'var(--danger, #EF4444)' }}>{error}</div>}
      {toast && <div className="card p-3 text-sm" style={{ borderColor: 'var(--success, #16A34A)', color: 'var(--success, #16A34A)' }}>{toast}</div>}

      {tab === 'catalog' && (
        <div className="card p-4 md:p-6">
          {loading ? <p className="text-sm opacity-60">Loading catalog…</p> : books.length === 0 ? (
            <EmptyState illustration="documents" eyebrow="Empty catalog" title="No books yet" description="Add your first book to start the library. Track copies, shelf location and issues." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {books.map((b) => (
                <div key={b.id} className="p-4 rounded-xl" style={{ border: '1px solid var(--border-default)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm">{b.title}</h4>
                      <p className="text-xs opacity-60">{b.author || 'Unknown author'}{b.category ? ` · ${b.category}` : ''}</p>
                      {b.isbn && <p className="text-xs opacity-40">ISBN {b.isbn}</p>}
                    </div>
                    <StatusBadge
                      label={b.availableCopies > 0 ? `${b.availableCopies}/${b.totalCopies}` : 'ALL OUT'}
                      variant={b.availableCopies > 0 ? 'success' : 'danger'}
                    />
                  </div>
                  {b.shelfLocation && <p className="text-xs opacity-60 mt-2">Shelf: {b.shelfLocation}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'issues' && (
        <div className="card p-4 md:p-6">
          {loading ? <p className="text-sm opacity-60">Loading issues…</p> : issues.length === 0 ? (
            <EmptyState illustration="documents" eyebrow="No issues" title="No books issued yet" description="Issue books to students and staff with due dates. Overdue fines are computed automatically at ₹2/day." />
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left opacity-60">
                    <th className="py-2 pr-2">Book</th>
                    <th className="py-2 pr-2">Issued To</th>
                    <th className="py-2 pr-2">Due</th>
                    <th className="py-2 pr-2">Fine</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((i) => {
                    const overdue = (i.status === 'ISSUED' || i.status === 'OVERDUE') && new Date(i.dueDate) < new Date()
                    return (
                      <tr key={i.id} className="border-t" style={{ borderColor: 'var(--border-default)' }}>
                        <td className="py-2 pr-2">
                          <span className="font-medium">{i.book.title}</span>
                          {i.book.author && <span className="opacity-50 text-xs"> · {i.book.author}</span>}
                        </td>
                        <td className="py-2 pr-2">{i.student ? `${i.student.firstName} ${i.student.lastName || ''}` : i.staffUser?.fullName || '—'}</td>
                        <td className={`py-2 pr-2 ${overdue ? 'font-semibold' : ''}`} style={overdue ? { color: 'var(--danger, #EF4444)' } : undefined}>
                          {new Date(i.dueDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 pr-2">{i.fineCents > 0 ? fmtINR(i.fineCents) : '—'}</td>
                        <td className="py-2 pr-2"><StatusBadge label={overdue && i.status === 'ISSUED' ? 'OVERDUE' : i.status} variant={issueStatusVariant(overdue && i.status === 'ISSUED' ? 'OVERDUE' : i.status) as any} /></td>
                        <td className="py-2">
                          {(i.status === 'ISSUED' || i.status === 'OVERDUE') ? (
                            <div className="flex gap-1.5">
                              <TactileButton variant="secondary" size="sm" onClick={() => returnBook(i)}><BookDown size={13} className="mr-1" />Return</TactileButton>
                              <TactileButton variant="ghost" size="sm" onClick={() => returnBook(i, true)} title="Mark lost"><AlertTriangle size={13} /></TactileButton>
                            </div>
                          ) : <span className="opacity-40 text-xs">closed</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add book modal */}
      <Modal open={showBook} onClose={() => setShowBook(false)} title="Add Book">
        <div className="space-y-3">
          <label className="text-xs block">Title *<input className="input w-full mt-1" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs block">Author<input className="input w-full mt-1" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} /></label>
            <label className="text-xs block">Category<input className="input w-full mt-1" value={bookForm.category} onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })} placeholder="Story Books" /></label>
            <label className="text-xs block">ISBN<input className="input w-full mt-1" value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} /></label>
            <label className="text-xs block">Publisher<input className="input w-full mt-1" value={bookForm.publisher} onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })} /></label>
            <label className="text-xs block">Total copies<input type="number" min={1} className="input w-full mt-1" value={bookForm.totalCopies} onChange={(e) => setBookForm({ ...bookForm, totalCopies: e.target.value })} /></label>
            <label className="text-xs block">Shelf location<input className="input w-full mt-1" value={bookForm.shelfLocation} onChange={(e) => setBookForm({ ...bookForm, shelfLocation: e.target.value })} placeholder="A-12" /></label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="secondary" size="md" onClick={() => setShowBook(false)}>Cancel</TactileButton>
            <TactileButton variant="primary" size="md" onClick={addBook} disabled={!bookForm.title}>Add Book</TactileButton>
          </div>
        </div>
      </Modal>

      {/* Issue book modal */}
      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Issue Book">
        <div className="space-y-3">
          <label className="text-xs block">Book *
            <select className="input w-full mt-1" value={issueForm.bookId} onChange={(e) => setIssueForm({ ...issueForm, bookId: e.target.value })}>
              <option value="">Select an available book…</option>
              {issuableBooks.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} available)</option>)}
            </select>
          </label>
          <label className="text-xs block">Student
            <select className="input w-full mt-1" value={issueForm.studentId} onChange={(e) => setIssueForm({ ...issueForm, studentId: e.target.value })}>
              <option value="">Select student…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName || ''} ({s.admissionNo})</option>)}
            </select>
          </label>
          <label className="text-xs block">Due date *<input type="date" className="input w-full mt-1" value={issueForm.dueDate} onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })} min={new Date().toISOString().slice(0, 10)} /></label>
          <p className="text-xs opacity-50">Limit: 3 books per student. Overdue fine: ₹2/day.</p>
          <div className="flex justify-end gap-2 pt-2">
            <TactileButton variant="secondary" size="md" onClick={() => setShowIssue(false)}>Cancel</TactileButton>
            <TactileButton variant="primary" size="md" onClick={issueBook} disabled={!issueForm.bookId || !issueForm.studentId || !issueForm.dueDate}>Issue</TactileButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
