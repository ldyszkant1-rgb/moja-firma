import { useMemo, useState } from 'react'
import { calculateOfferTotal } from './lib/offersUtils'

const STATUSES = ['Nowa', 'Wysłana', 'Zaakceptowana', 'Odrzucona']

function emptyOffer(settings) {
  return {
    name: '',
    location: '',
    clientId: null,
    status: 'Nowa',
    validUntil: '',
    quantities: { mb: '', m2: '', kg: '' },
    rates: {
      mb: settings?.rates?.mb || '',
      m2: settings?.rates?.m2 || '',
      kg: settings?.rates?.kg || '',
    },
    scope: '',
    notes: '',
  }
}

function money(value) {
  return Number(value || 0).toLocaleString('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) + ' zł'
}

function statusStyle(status) {
  if (status === 'Zaakceptowana') return { background: '#dcf6e7', color: '#159447' }
  if (status === 'Odrzucona') return { background: '#ffe6e6', color: '#c63b3b' }
  if (status === 'Wysłana') return { background: '#eeeaff', color: '#6d4bc3' }
  return { background: '#e9f5ff', color: '#087fce' }
}

function printOffer(offer, client) {
  if (typeof window === 'undefined') return

  const popup = window.open('', '_blank', 'width=900,height=1100')
  if (!popup) {
    alert('Przeglądarka zablokowała okno wydruku. Zezwól na wyskakujące okna dla aplikacji.')
    return
  }

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const rows = [
    ['MB', offer.quantities?.mb, offer.rates?.mb],
    ['m²', offer.quantities?.m2, offer.rates?.m2],
    ['kg', offer.quantities?.kg, offer.rates?.kg],
  ].filter(([, quantity, rate]) => Number(quantity || 0) || Number(rate || 0))

  const scope = escapeHtml(offer.scope || '').replace(/\\n/g, '<br>')
  const notes = escapeHtml(offer.notes || '').replace(/\\n/g, '<br>')

  popup.document.write(`
    <!doctype html>
    <html lang="pl">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(offer.offerNumber || 'Oferta')} - Aeroinstal</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; color: #1f2937; background: #fff; }
          .page { max-width: 800px; margin: 0 auto; padding: 48px 52px; }
          .header { display: flex; justify-content: space-between; gap: 30px; border-bottom: 3px solid #0786e6; padding-bottom: 22px; }
          .brand { font-size: 30px; font-weight: 800; color: #0786e6; }
          .muted { color: #64748b; }
          h1 { margin: 28px 0 6px; font-size: 28px; }
          h2 { margin: 28px 0 10px; font-size: 17px; }
          .meta { text-align: right; }
          .box { background: #f5f8fb; border-radius: 10px; padding: 16px; margin-top: 18px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border-bottom: 1px solid #dce5ec; padding: 10px 8px; text-align: left; }
          th { font-size: 12px; color: #64748b; text-transform: uppercase; }
          td:last-child, th:last-child { text-align: right; }
          .total { margin-top: 20px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #1f2937; padding-top: 16px; font-size: 22px; font-weight: 800; }
          .text { line-height: 1.6; white-space: normal; }
          .footer { margin-top: 60px; padding-top: 18px; border-top: 1px solid #dce5ec; font-size: 12px; color: #64748b; }
          @media print { .page { padding: 25mm 18mm; } }
        </style>
      </head>
      <body>
        <main class="page">
          <div class="header">
            <div>
              <div class="brand">AEROINSTAL</div>
              <div class="muted">Wentylacja • Montaż • Serwis</div>
            </div>
            <div class="meta">
              <strong>${escapeHtml(offer.offerNumber || 'Oferta')}</strong><br>
              <span class="muted">Data: ${escapeHtml(new Date().toLocaleDateString('pl-PL'))}</span>
              ${offer.validUntil ? `<br><span class="muted">Ważna do: ${escapeHtml(offer.validUntil)}</span>` : ''}
            </div>
          </div>

          <h1>Oferta / wycena</h1>

          <div class="grid">
            <div class="box">
              <strong>Klient</strong><br>
              ${escapeHtml(client?.name || 'Brak danych klienta')}
              ${client?.nip ? `<br>NIP: ${escapeHtml(client.nip)}` : ''}
              ${client?.address ? `<br>${escapeHtml(client.address)}` : ''}
              ${client?.contactName ? `<br>Kontakt: ${escapeHtml(client.contactName)}` : ''}
            </div>
            <div class="box">
              <strong>Przedmiot oferty</strong><br>
              ${escapeHtml(offer.name)}<br>
              <span class="muted">${escapeHtml(offer.location || 'Brak lokalizacji')}</span>
            </div>
          </div>

          <h2>Zakres prac i wycena</h2>
          <table>
            <thead><tr><th>Pozycja</th><th>Ilość</th><th>Stawka</th><th>Wartość</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map(([unit, quantity, rate]) => `
                <tr>
                  <td>${unit}</td>
                  <td>${escapeHtml(quantity)}</td>
                  <td>${escapeHtml(rate)} zł</td>
                  <td>${money(Number(quantity || 0) * Number(rate || 0))}</td>
                </tr>
              `).join('') : '<tr><td colspan="4">Wycena ryczałtowa / brak pozycji ilościowych</td></tr>'}
            </tbody>
          </table>

          <div class="total"><span>Wartość oferty</span><span>${money(offer.total)}</span></div>

          ${scope ? `<h2>Zakres prac</h2><div class="text">${scope}</div>` : ''}
          ${notes ? `<h2>Uwagi</h2><div class="text">${notes}</div>` : ''}

          <div class="footer">
            Oferta została przygotowana przez Aeroinstal. Dokument wygenerowany z aplikacji Moja Firma.
          </div>
        </main>
        <script>
          window.addEventListener('load', () => setTimeout(() => window.print(), 250))
        </script>
      </body>
    </html>
  `)
  popup.document.close()
}

export default function OffersPage({
  offers,
  clients,
  settings,
  onCreate,
  onUpdate,
  onDelete,
  onConvertToJob,
  onAlert,
  onConfirm,
}) {
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const clientName = (id) =>
    (clients || []).find((client) => String(client.id) === String(id))?.name || ''

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (offers || []).filter((offer) => {
      if (filter !== 'all' && offer.status !== filter) return false
      if (!q) return true
      return [offer.offerNumber, offer.name, offer.location, clientName(offer.clientId)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [offers, query, filter, clients])

  const save = async () => {
    if (!editing?.name?.trim()) {
      onAlert('Podaj nazwę oferty.')
      return
    }

    const total = calculateOfferTotal(editing)
    const data = { ...editing, total }

    try {
      const saved = editing.id ? await onUpdate(data) : await onCreate(data)
      setEditing(null)
      return saved
    } catch (error) {
      console.error('Nie udało się zapisać oferty:', error)
      onAlert('Nie udało się zapisać oferty. Spróbuj ponownie.')
    }
  }

  const change = (field, value) => setEditing((current) => ({ ...current, [field]: value }))
  const changeNested = (group, field, value) =>
    setEditing((current) => ({
      ...current,
      [group]: { ...current[group], [field]: value },
    }))

  if (editing) {
    const total = calculateOfferTotal(editing)

    return (
      <div className="sub-page" style={{ paddingBottom: '130px' }}>
        <div className="details-top">
          <button className="back-button" type="button" onClick={() => setEditing(null)}>← Wróć</button>
        </div>

        <div className="page-heading">
          <div>
            <div className="small-label">{editing.id ? 'EDYCJA OFERTY' : 'NOWA OFERTA'}</div>
            <h1>{editing.id ? editing.offerNumber || 'Oferta' : 'Dodaj ofertę'}</h1>
          </div>
        </div>

        <div className="detail-card">
          <h2>Podstawowe informacje</h2>
          <div className="note-form new-job-basic-form">
            <input className="job-new-input" placeholder="Nazwa oferty / roboty" value={editing.name || ''} onChange={(e) => change('name', e.target.value)} />
            <input className="job-new-input" placeholder="Lokalizacja / statek" value={editing.location || ''} onChange={(e) => change('location', e.target.value)} />
            <select className="job-new-input" value={editing.clientId || ''} onChange={(e) => change('clientId', e.target.value || null)}>
              <option value="">Klient — opcjonalnie</option>
              {(clients || []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
            <select className="job-new-input" value={editing.status || 'Nowa'} onChange={(e) => change('status', e.target.value)}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
            <label style={{ display: 'grid', gap: 6 }}>
              <strong>Ważna do</strong>
              <input className="job-new-input" type="date" value={editing.validUntil || ''} onChange={(e) => change('validUntil', e.target.value)} />
            </label>
          </div>
        </div>

        <div className="detail-card">
          <h2>Zakres i wycena</h2>
          <div className="detail-quantities">
            {[
              ['mb', 'MB'],
              ['m2', 'm²'],
              ['kg', 'kg'],
            ].map(([key, label]) => (
              <div className="quantity-box" key={key}>
                <span>{label}</span>
                <input type="text" inputMode="decimal" placeholder="Ilość" value={editing.quantities?.[key] ?? ''} onChange={(e) => changeNested('quantities', key, e.target.value)} />
                <small style={{ opacity: 0.6 }}>stawka</small>
                <input type="text" inputMode="decimal" placeholder="zł" value={editing.rates?.[key] ?? ''} onChange={(e) => changeNested('rates', key, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="offer-total-box">
            <span>Wartość oferty</span>
            <strong>{money(total)}</strong>
          </div>

          <label style={{ display: 'grid', gap: 6, marginTop: 16 }}>
            <strong>Zakres prac</strong>
            <textarea className="note-text-input" rows="4" placeholder="Co obejmuje wycena..." value={editing.scope || ''} onChange={(e) => change('scope', e.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
            <strong>Uwagi</strong>
            <textarea className="note-text-input" rows="3" placeholder="Dodatkowe informacje..." value={editing.notes || ''} onChange={(e) => change('notes', e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button type="button" className="save-button" onClick={save}>Zapisz ofertę</button>
          <button type="button" className="back-button" onClick={() => setEditing(null)}>Anuluj</button>
        </div>
      </div>
    )
  }

  return (
    <div className="sub-page" style={{ paddingBottom: '130px' }}>
      <div className="page-heading">
        <div>
          <div className="small-label">MOJA FIRMA</div>
          <h1>Oferty / Wyceny</h1>
        </div>
        <button type="button" className="edit-button" onClick={() => setEditing(emptyOffer(settings))}>+ Nowa oferta</button>
      </div>

      <div className="offers-summary-grid">
        {[
          ['Wszystkie', offers.length],
          ['Nowe', offers.filter((offer) => offer.status === 'Nowa').length],
          ['Wysłane', offers.filter((offer) => offer.status === 'Wysłana').length],
          ['Zaakceptowane', offers.filter((offer) => offer.status === 'Zaakceptowana').length],
        ].map(([label, value]) => (
          <button
            type="button"
            key={label}
            className={filter === (label === 'Wszystkie' ? 'all' : label === 'Nowe' ? 'Nowa' : label === 'Wysłane' ? 'Wysłana' : 'Zaakceptowana') ? 'offer-summary-card active' : 'offer-summary-card'}
            onClick={() => setFilter(label === 'Wszystkie' ? 'all' : label === 'Nowe' ? 'Nowa' : label === 'Wysłane' ? 'Wysłana' : 'Zaakceptowana')}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>

      <div className="detail-card">
        <div style={{ display: 'grid', gap: 10 }}>
          <input className="job-new-input" placeholder="Szukaj oferty, klienta, lokalizacji..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {['all', ...STATUSES].map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  flex: '0 0 auto',
                  borderRadius: 999,
                  border: filter === value ? '1px solid #0786e6' : '1px solid #dce5ec',
                  background: filter === value ? '#0786e6' : '#fff',
                  color: filter === value ? '#fff' : '#24345c',
                  padding: '9px 13px',
                  fontWeight: 700,
                }}
              >
                {value === 'all' ? 'Wszystkie' : value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="jobs">
        {filtered.length === 0 && <div className="detail-card">Brak ofert w tej kategorii.</div>}

        {filtered.map((offer) => {
          const name = clientName(offer.clientId)
          return (
            <article className="job-card" key={offer.id}>
              <button type="button" className="job-card-main" onClick={() => setEditing(offer)}>
                <div className="job-card-topline">
                  <div className="job-card-identity">
                    <span className="job-card-photo job-card-photo-empty" aria-hidden="true">📄</span>
                    <span className="job-card-identity-text">
                      <strong>{offer.name}</strong>
                      <span>{offer.location || 'Brak lokalizacji'}</span>
                      {name && <small className="job-card-client-name">👤 {name}</small>}
                    </span>
                  </div>
                  <span className="status" style={statusStyle(offer.status)}>
                    ● {offer.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 14, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, opacity: .65 }}>{offer.offerNumber || 'Oferta'}</span>
                  <strong style={{ fontSize: 19 }}>{money(offer.total)}</strong>
                </div>
              </button>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 16px 16px' }}>
                <button type="button" className="edit-button" onClick={() => setEditing(offer)}>Edytuj</button>
                <button
                  type="button"
                  className="edit-button"
                  onClick={() => printOffer(offer, (clients || []).find((client) => String(client.id) === String(offer.clientId)))}
                >
                  📄 PDF / Drukuj
                </button>
                {offer.status === 'Zaakceptowana' && !offer.convertedJobId && (
                  <button type="button" className="save-button" onClick={() => onConvertToJob(offer)}>Utwórz robotę</button>
                )}
                {offer.convertedJobId && <span style={{ alignSelf: 'center', fontSize: 13, color: '#159447', fontWeight: 700 }}>✓ Robota utworzona</span>}
                <button
                  type="button"
                  className="back-button"
                  onClick={async () => {
                    const ok = await onConfirm(`Usunąć ofertę „${offer.name}”?`)
                    if (!ok) return
                    try {
                      await onDelete(offer.id)
                    } catch (error) {
                      console.error(error)
                      onAlert('Nie udało się usunąć oferty.')
                    }
                  }}
                >
                  Usuń
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
