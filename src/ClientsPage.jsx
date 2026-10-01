import { useEffect, useMemo, useState } from 'react'
import { createClient, deleteClient, updateClient } from './lib/clientsApi'
import { getAllJobPayments } from './lib/jobPaymentsApi'

const EMPTY_CLIENT = {
  name: '',
  shortName: '',
  nip: '',
  address: '',
  contactName: '',
  phone: '',
  email: '',
  notes: '',
}

function ClientForm({ value, onChange, onCancel, onSave, saving }) {
  const set = (field, next) => onChange({ ...value, [field]: next })

  return (
    <div className="client-form">
      <div className="client-form-grid">
        <label>
          <span>Pełna nazwa firmy *</span>
          <input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="Pełna nazwa prawna firmy" />
        </label>
        <label>
          <span>Nazwa skrócona</span>
          <input value={value.shortName} onChange={(e) => set('shortName', e.target.value)} placeholder="np. Cool air" />
        </label>
        <label>
          <span>NIP</span>
          <input value={value.nip} onChange={(e) => set('nip', e.target.value)} inputMode="numeric" placeholder="0000000000" />
        </label>
        <label>
          <span>Osoba kontaktowa</span>
          <input value={value.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Imię i nazwisko" />
        </label>
        <label>
          <span>Telefon</span>
          <input value={value.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="+48 ..." />
        </label>
        <label>
          <span>E-mail</span>
          <input value={value.email} onChange={(e) => set('email', e.target.value)} inputMode="email" placeholder="kontakt@firma.pl" />
        </label>
        <label>
          <span>Adres</span>
          <input value={value.address} onChange={(e) => set('address', e.target.value)} placeholder="Adres firmy" />
        </label>
      </div>

      <label className="client-form-full">
        <span>Uwagi</span>
        <textarea value={value.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Dodatkowe informacje o kliencie..." rows={3} />
      </label>

      <div className="client-form-actions">
        <button type="button" className="client-cancel-button" onClick={onCancel} disabled={saving}>Anuluj</button>
        <button type="button" className="client-save-button" onClick={onSave} disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz klienta'}
        </button>
      </div>
    </div>
  )
}

export default function ClientsPage({ clients, jobs, onRefresh, onAlert, onConfirm, onOpenJob }) {
  const [search, setSearch] = useState('')
  const [editingClient, setEditingClient] = useState(null)
  const [form, setForm] = useState(EMPTY_CLIENT)
  const [saving, setSaving] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [jobPayments, setJobPayments] = useState([])

  useEffect(() => {
    let cancelled = false
    getAllJobPayments()
      .then((payments) => {
        if (!cancelled) setJobPayments(Array.isArray(payments) ? payments : [])
      })
      .catch((error) => console.error('Nie udało się wczytać płatności klientów:', error))
    return () => { cancelled = true }
  }, [jobs])

  const visibleClients = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return clients
    return clients.filter((client) =>
      [client.name, client.shortName, client.nip, client.contactName, client.phone, client.email, client.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    )
  }, [clients, search])

  const openNew = () => {
    setEditingClient(null)
    setForm(EMPTY_CLIENT)
    setShowEditor(true)
  }

  const openEdit = (client) => {
    setEditingClient(client)
    setShowEditor(true)
    setForm({
      name: client.name || '',
      shortName: client.shortName || client.name || '',
      nip: client.nip || '',
      address: client.address || '',
      contactName: client.contactName || '',
      phone: client.phone || '',
      email: client.email || '',
      notes: client.notes || '',
    })
  }

  const save = async () => {
    if (!form.name.trim()) {
      onAlert('Podaj nazwę klienta.')
      return
    }

    try {
      setSaving(true)
      if (editingClient) {
        await updateClient({ ...editingClient, ...form })
      } else {
        await createClient(form)
      }
      setEditingClient(null)
      setForm(EMPTY_CLIENT)
      setShowEditor(false)
      await onRefresh()
      setSelectedClient(null)
    } catch (error) {
      console.error('Nie udało się zapisać klienta:', error)
      onAlert(error?.message || 'Nie udało się zapisać klienta.')
    } finally {
      setSaving(false)
    }
  }

  const openClient = (client) => {
    setSelectedClient(client)
    setShowEditor(false)
  }

  const remove = async (client) => {
    const confirmed = await onConfirm(
      `Usunąć klienta „${client.name}”?\n\nJeżeli ma powiązane realizacje, faktury lub oferty, aplikacja nie pozwoli go usunąć.`
    )
    if (!confirmed) return

    try {
      await deleteClient(client.id)
      await onRefresh()
    } catch (error) {
      console.error('Nie udało się usunąć klienta:', error)
      onAlert(error?.message || 'Nie udało się usunąć klienta.')
    }
  }

  return (
    <div className="sub-page clients-page">
      <div className="page-heading">
        <div>
          <div className="small-label">MOJA FIRMA</div>
          <h1>Klienci</h1>
        </div>
        <button type="button" className="edit-button clients-add-button" onClick={openNew}>
          + Nowy klient
        </button>
      </div>

      <div className="clients-summary">
        <div className="clients-summary-icon">👥</div>
        <div>
          <strong>{clients.length}</strong>
          <span>klientów w Aeroinstal</span>
        </div>
      </div>

      {showEditor && (
        <section className="detail-card client-editor-card">
          <div className="client-editor-heading">
            <div>
              <div className="small-label">{editingClient ? 'EDYCJA' : 'NOWY KLIENT'}</div>
              <h2>{editingClient ? editingClient.name : 'Dodaj klienta'}</h2>
            </div>
          </div>
          <ClientForm
            value={form}
            onChange={setForm}
            onCancel={() => { setEditingClient(null); setForm(EMPTY_CLIENT); setShowEditor(false) }}
            onSave={save}
            saving={saving}
          />
        </section>
      )}

      <div className="clients-search-wrap">
        <span aria-hidden="true">⌕</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj klienta, NIP, telefonu..." />
      </div>

      {selectedClient && (
        <section className="detail-card client-detail-card">
          <div className="client-detail-top">
            <button type="button" className="client-back-button" onClick={() => setSelectedClient(null)}>← Klienci</button>
            <button type="button" className="client-detail-edit" onClick={() => openEdit(selectedClient)}>Edytuj</button>
          </div>

          <div className="client-detail-identity">
            <div className="client-detail-avatar">👤</div>
            <div>
              <div className="small-label">KARTOTEKA KLIENTA</div>
              <h2>{selectedClient.shortName || selectedClient.name}</h2>
              {selectedClient.shortName && selectedClient.name && selectedClient.shortName !== selectedClient.name && (
                <div style={{ marginTop: '4px', color: '#7a8798', fontSize: '12px' }}>Pełna nazwa: {selectedClient.name}</div>
              )}
              {selectedClient.nip && <span>NIP {selectedClient.nip}</span>}
            </div>
          </div>

          <div className="client-detail-contact-grid">
            {selectedClient.contactName && <div><span>Osoba kontaktowa</span><strong>{selectedClient.contactName}</strong></div>}
            {selectedClient.phone && <div><span>Telefon</span><strong>{selectedClient.phone}</strong></div>}
            {selectedClient.email && <div><span>E-mail</span><strong>{selectedClient.email}</strong></div>}
            {selectedClient.address && <div><span>Adres</span><strong>{selectedClient.address}</strong></div>}
          </div>

          {selectedClient.notes && (
            <div className="client-detail-notes"><span>Uwagi</span><p>{selectedClient.notes}</p></div>
          )}

          {(() => {
            const clientJobs = jobs.filter((job) => String(job.clientId || '') === String(selectedClient.id))
            const totalValue = clientJobs.reduce((sum, job) => sum +
              (Number(job.quantities?.mb || 0) * Number(job.rates?.mb || 0)) +
              (Number(job.quantities?.m2 || 0) * Number(job.rates?.m2 || 0)) +
              (Number(job.quantities?.kg || 0) * Number(job.rates?.kg || 0)), 0)
            const invoiced = clientJobs.reduce((sum, job) => sum + Number(job.invoiceAmount || 0), 0)
            const paid = clientJobs.reduce((sum, job) => sum + jobPayments
              .filter((payment) => payment.jobId === job.id)
              .reduce((jobSum, payment) => jobSum + Number(payment.amount || 0), 0), 0)

            const receivable = Math.max(0, invoiced - paid)

            return (
              <>
                <div className="client-detail-stats">
                  <div><span>Realizacje</span><strong>{clientJobs.length}</strong></div>
                  <div><span>Wartość robót</span><strong>{totalValue.toLocaleString('pl-PL')} zł</strong></div>
                  <div><span>Faktury</span><strong>{invoiced.toLocaleString('pl-PL')} zł</strong></div>
                  <div><span>Zapłacono</span><strong>{paid.toLocaleString('pl-PL')} zł</strong></div>
                  <div className="client-detail-stat-receivable"><span>Do zapłaty</span><strong>{receivable.toLocaleString('pl-PL')} zł</strong></div>
                </div>

                <div className="client-detail-jobs">
                  <div className="client-detail-section-title">Realizacje klienta</div>
                  {clientJobs.length === 0 ? (
                    <div className="client-detail-empty">Brak przypisanych robót.</div>
                  ) : clientJobs.map((job) => {
                    const jobValue =
                      (Number(job.quantities?.mb || 0) * Number(job.rates?.mb || 0)) +
                      (Number(job.quantities?.m2 || 0) * Number(job.rates?.m2 || 0)) +
                      (Number(job.quantities?.kg || 0) * Number(job.rates?.kg || 0))
                    const paidForJob = jobPayments
                      .filter((payment) => payment.jobId === job.id)
                      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
                    const invoiceValue = Number(job.invoiceAmount || 0) || jobValue
                    const remainingForJob = Math.max(0, invoiceValue - paidForJob)
                    const dueDate = job.paymentDueDate ? new Date(job.paymentDueDate) : null
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const dueDay = dueDate ? new Date(dueDate) : null
                    if (dueDay) dueDay.setHours(0, 0, 0, 0)
                    const isOverdue = remainingForJob > 0 && dueDay && dueDay < today
                    const paymentLabel = remainingForJob <= 0
                      ? 'Opłacona'
                      : isOverdue
                        ? `Zaległość • termin ${dueDay.toLocaleDateString('pl-PL')}`
                        : dueDay
                          ? `Do zapłaty • termin ${dueDay.toLocaleDateString('pl-PL')}`
                          : `Do zapłaty: ${remainingForJob.toLocaleString('pl-PL')} zł`
                    return (
                      <button type="button" className="client-detail-job-row" key={job.id} onClick={() => onOpenJob(job)}>
                        <div>
                          <strong>{job.name || 'Bez nazwy'}</strong>
                          <span>{job.location || 'Brak lokalizacji'}</span>
                        </div>
                        <div className="client-detail-job-value">
                          <strong>{invoiceValue.toLocaleString('pl-PL')} zł</strong>
                          <span className={remainingForJob <= 0 ? 'client-payment-paid' : isOverdue ? 'client-payment-overdue' : 'client-payment-due'}>{paymentLabel}</span>
                        </div>
                        <span className="client-detail-job-arrow">→</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </section>
      )}

      <div className="clients-list">
        {visibleClients.length === 0 ? (
          <div className="detail-card clients-empty">
            <div className="clients-empty-icon">👤</div>
            <h2>{clients.length ? 'Brak wyników' : 'Nie masz jeszcze klientów'}</h2>
            <p>{clients.length ? 'Zmień wyszukiwaną frazę.' : 'Dodaj pierwszego klienta, aby później przypisywać do niego realizacje.'}</p>
            {!clients.length && (
              <button type="button" className="client-save-button" onClick={openNew}>+ Dodaj klienta</button>
            )}
          </div>
        ) : (
          visibleClients.map((client) => {
            const clientJobs = jobs.filter((job) => String(job.clientId || '') === String(client.id))
            return (
              <article className="client-card" key={client.id} onClick={() => openClient(client)}>
                <div className="client-card-top">
                  <div className="client-avatar">👤</div>
                  <div className="client-card-title">
                    <h2>{client.shortName || client.name}</h2>
                    <span>{client.nip ? `NIP ${client.nip}` : 'Brak NIP'}</span>
                  </div>
                  <button type="button" className="client-menu-button" onClick={(event) => { event.stopPropagation(); openEdit(client) }} aria-label="Edytuj klienta">✎</button>
                </div>

                <div className="client-card-info">
                  {client.contactName && <div><span>Kontakt</span><strong>{client.contactName}</strong></div>}
                  {client.phone && <div><span>Telefon</span><strong>{client.phone}</strong></div>}
                  {client.email && <div><span>E-mail</span><strong>{client.email}</strong></div>}
                  {client.address && <div><span>Adres</span><strong>{client.address}</strong></div>}
                </div>

                <div className="client-card-footer" onClick={(event) => event.stopPropagation()}>
                  <span>🔧 {clientJobs.length} {clientJobs.length === 1 ? 'realizacja' : clientJobs.length < 5 ? 'realizacje' : 'robót'}</span>
                  <div>
                    <button type="button" onClick={() => openEdit(client)}>Edytuj</button>
                    <button type="button" className="client-delete-button" onClick={() => remove(client)}>Usuń</button>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
