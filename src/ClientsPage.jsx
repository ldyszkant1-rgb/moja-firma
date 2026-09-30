import { useMemo, useState } from 'react'
import { createClient, deleteClient, updateClient } from './lib/clientsApi'

const EMPTY_CLIENT = {
  name: '',
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
          <span>Nazwa firmy *</span>
          <input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="np. Stocznia XYZ" />
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

export default function ClientsPage({ clients, jobs, onRefresh, onAlert, onConfirm }) {
  const [search, setSearch] = useState('')
  const [editingClient, setEditingClient] = useState(null)
  const [form, setForm] = useState(EMPTY_CLIENT)
  const [saving, setSaving] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  const visibleClients = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return clients
    return clients.filter((client) =>
      [client.name, client.nip, client.contactName, client.phone, client.email, client.address]
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
    } catch (error) {
      console.error('Nie udało się zapisać klienta:', error)
      onAlert(error?.message || 'Nie udało się zapisać klienta.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (client) => {
    const confirmed = await onConfirm(
      `Usunąć klienta „${client.name}”?\n\nJeżeli ma przypisane roboty, aplikacja nie pozwoli go usunąć.`
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

      <div className="clients-list">
        {visibleClients.length === 0 ? (
          <div className="detail-card clients-empty">
            <div className="clients-empty-icon">👤</div>
            <h2>{clients.length ? 'Brak wyników' : 'Nie masz jeszcze klientów'}</h2>
            <p>{clients.length ? 'Zmień wyszukiwaną frazę.' : 'Dodaj pierwszego klienta, aby później przypisywać do niego roboty.'}</p>
            {!clients.length && (
              <button type="button" className="client-save-button" onClick={openNew}>+ Dodaj klienta</button>
            )}
          </div>
        ) : (
          visibleClients.map((client) => {
            const clientJobs = jobs.filter((job) => String(job.clientId || '') === String(client.id))
            return (
              <article className="client-card" key={client.id}>
                <div className="client-card-top">
                  <div className="client-avatar">👤</div>
                  <div className="client-card-title">
                    <h2>{client.name}</h2>
                    <span>{client.nip ? `NIP ${client.nip}` : 'Brak NIP'}</span>
                  </div>
                  <button type="button" className="client-menu-button" onClick={() => openEdit(client)} aria-label="Edytuj klienta">✎</button>
                </div>

                <div className="client-card-info">
                  {client.contactName && <div><span>Kontakt</span><strong>{client.contactName}</strong></div>}
                  {client.phone && <div><span>Telefon</span><strong>{client.phone}</strong></div>}
                  {client.email && <div><span>E-mail</span><strong>{client.email}</strong></div>}
                  {client.address && <div><span>Adres</span><strong>{client.address}</strong></div>}
                </div>

                <div className="client-card-footer">
                  <span>🔧 {clientJobs.length} {clientJobs.length === 1 ? 'robota' : clientJobs.length < 5 ? 'roboty' : 'robót'}</span>
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
