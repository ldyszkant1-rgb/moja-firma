import React, { useMemo, useState } from 'react'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatMoney(value) {
  const number = Number(value || 0)
  return number.toLocaleString('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' zł'
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('pl-PL')
}

function todayInput() {
  const date = new Date()
  return date.toISOString().slice(0, 10)
}

function calculateTotal(job) {
  const quantities = job?.quantities || {}
  const rates = job?.rates || {}

  return (
    (Number(quantities.mb) || 0) * (Number(rates.mb) || 0) +
    (Number(quantities.m2) || 0) * (Number(rates.m2) || 0) +
    (Number(quantities.kg) || 0) * (Number(rates.kg) || 0)
  )
}

function companyData(company) {
  return {
    name: company?.name || 'AEROINSTAL ŁUKASZ DYSZKANT',
    nip: company?.nip || '5833105866',
    regon: company?.regon || '385589939',
    address: company?.address || 'ul. Cicha 4A/9, 83-000 Pruszcz Gdański',
    email: company?.email || 'Aeroinstal@wp.pl',
    phone: company?.phone || '',
  }
}

function clientData(client) {
  return {
    name: client?.name || 'Klient / Zleceniodawca',
    nip: client?.nip || '',
    address: client?.address || '',
    contactName: client?.contactName || '',
    phone: client?.phone || '',
    email: client?.email || '',
  }
}

function partyHtml(title, party, extraLabel = '') {
  const lines = [
    party.name,
    party.nip ? `NIP: ${party.nip}` : '',
    party.address,
    party.contactName ? `Osoba kontaktowa: ${party.contactName}` : '',
    party.phone ? `tel.: ${party.phone}` : '',
    party.email ? party.email : '',
  ].filter(Boolean)

  return `
    <div class="party">
      <div class="party-label">${escapeHtml(title)}</div>
      <div class="party-name">${escapeHtml(lines.shift() || '')}</div>
      ${lines.map((line) => `<div class="party-line">${escapeHtml(line)}</div>`).join('')}
      ${extraLabel ? `<div class="party-extra">${escapeHtml(extraLabel)}</div>` : ''}
    </div>
  `
}

function quantityRows(job) {
  const rows = [
    ['Przewody / kanały wentylacyjne', 'mb', job?.quantities?.mb, job?.rates?.mb],
    ['Powierzchnia', 'm²', job?.quantities?.m2, job?.rates?.m2],
    ['Elementy / materiał', 'kg', job?.quantities?.kg, job?.rates?.kg],
  ]

  return rows
    .filter(([, , quantity]) => Number(quantity || 0) > 0)
    .map(([label, unit, quantity, rate]) => {
      const value = (Number(quantity) || 0) * (Number(rate) || 0)
      return `
        <tr>
          <td>${escapeHtml(label)}</td>
          <td class="center">${escapeHtml(quantity)} ${unit}</td>
          <td class="right">${formatMoney(rate)}</td>
          <td class="right strong">${formatMoney(value)}</td>
        </tr>
      `
    })
    .join('')
}

function openPrintWindow(title, html) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    window.alert('Nie udało się otworzyć dokumentu. Zezwól aplikacji na otwieranie okien i spróbuj ponownie.')
    return
  }

  printWindow.document.open()
  printWindow.document.write(`
    <!doctype html>
    <html lang="pl">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 15mm 14mm 16mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #17243d;
            background: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.48;
          }
          .document { max-width: 180mm; margin: 0 auto; }
          .topbar { height: 7px; background: #168fe5; border-radius: 0 0 4px 4px; margin-bottom: 20px; }
          .brand { display: flex; align-items: flex-start; justify-content: space-between; gap: 25px; padding-bottom: 15px; border-bottom: 1px solid #dbe5ee; }
          .brand-name { color: #12234f; font-size: 16pt; font-weight: 850; letter-spacing: .2px; }
          .brand-sub { margin-top: 4px; color: #64748b; font-size: 8pt; }
          .brand-data { text-align: right; color: #64748b; font-size: 8.5pt; line-height: 1.55; }
          .title-block { text-align: center; margin: 28px 0 23px; }
          .eyebrow { color: #168fe5; font-size: 8pt; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
          h1 { margin: 5px 0 4px; color: #12234f; font-size: 18pt; line-height: 1.15; }
          .subtitle { color: #718096; font-size: 8.5pt; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
          .meta-box { padding: 10px 12px; border: 1px solid #dce5ec; border-radius: 8px; background: #f8fbfd; }
          .meta-label { display: block; color: #7a889b; font-size: 7.5pt; font-weight: 750; text-transform: uppercase; letter-spacing: .5px; }
          .meta-value { display: block; margin-top: 3px; color: #17243d; font-weight: 750; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 18px 0; }
          .party { min-height: 105px; padding: 13px 14px; border: 1px solid #dce5ec; border-radius: 9px; }
          .party-label { color: #168fe5; font-size: 7.5pt; font-weight: 850; letter-spacing: .8px; text-transform: uppercase; margin-bottom: 7px; }
          .party-name { color: #12234f; font-weight: 800; margin-bottom: 3px; }
          .party-line { color: #526174; font-size: 9pt; }
          .party-extra { margin-top: 7px; color: #168fe5; font-size: 8pt; font-weight: 700; }
          h2 { margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #dce5ec; color: #12234f; font-size: 11pt; }
          p { margin: 6px 0 9px; }
          .clause { margin: 0 0 10px; }
          .clause-number { font-weight: 800; color: #168fe5; margin-right: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0 8px; }
          th { padding: 8px 7px; background: #12234f; color: #fff; font-size: 8.5pt; text-align: left; }
          td { padding: 8px 7px; border-bottom: 1px solid #e4eaf0; font-size: 9pt; }
          .center { text-align: center; }
          .right { text-align: right; }
          .strong { font-weight: 750; }
          .total { display: flex; justify-content: flex-end; align-items: baseline; gap: 14px; margin: 9px 0 16px; padding: 11px 13px; background: #f2f8fd; border: 1px solid #d8eaf7; border-radius: 8px; }
          .total span { color: #64748b; font-size: 9pt; font-weight: 700; }
          .total strong { color: #12234f; font-size: 12.5pt; }
          .scope { min-height: 48px; padding: 10px 12px; border: 1px solid #e0e7ee; border-radius: 7px; background: #fbfcfd; white-space: pre-wrap; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 42px; page-break-inside: avoid; }
          .signature { min-height: 88px; padding-top: 42px; border-top: 1px solid #334155; text-align: center; color: #526174; font-size: 8.5pt; }
          .signature strong { display: block; color: #17243d; margin-bottom: 3px; }
          .signature small { color: #8a97a8; }
          .checkbox-line { margin: 8px 0; }
          .checkbox { display: inline-block; width: 13px; height: 13px; margin-right: 6px; vertical-align: -2px; border: 1px solid #8a97a8; }
          .remarks { min-height: 68px; padding: 10px 12px; border: 1px solid #dce5ec; border-radius: 7px; background: #fff; white-space: pre-wrap; }
          .footer { margin-top: 30px; padding-top: 8px; border-top: 1px solid #e1e7ed; color: #8a97a8; font-size: 7.5pt; text-align: center; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="document">${html}</div>
        <script>
          window.onload = function () {
            setTimeout(function () { window.print() }, 250)
          }
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

function renderHeader(company, documentTitle, subtitle) {
  const c = companyData(company)
  return `
    <div class="topbar"></div>
    <div class="brand">
      <div>
        <div class="brand-name">${escapeHtml(c.name)}</div>
        <div class="brand-sub">Montaż i wykonawstwo instalacji wentylacyjnych</div>
      </div>
      <div class="brand-data">
        ${escapeHtml(c.address)}<br>
        NIP: ${escapeHtml(c.nip)} • REGON: ${escapeHtml(c.regon)}
        ${c.email ? `<br>${escapeHtml(c.email)}` : ''}
        ${c.phone ? `<br>tel. ${escapeHtml(c.phone)}` : ''}
      </div>
    </div>
    <div class="title-block">
      <div class="eyebrow">AEROINSTAL • DOKUMENT WYKONAWCZY</div>
      <h1>${escapeHtml(documentTitle)}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
    </div>
  `
}

function renderJobMeta(job, dateLabel, dateValue, overrides = {}) {
  const name = overrides.name ?? job?.name ?? '—'
  const location = overrides.location ?? job?.location ?? '—'
  return `
    <div class="meta">
      <div class="meta-box"><span class="meta-label">Robota</span><span class="meta-value">${escapeHtml(name)}</span></div>
      <div class="meta-box"><span class="meta-label">Lokalizacja</span><span class="meta-value">${escapeHtml(location)}</span></div>
      <div class="meta-box"><span class="meta-label">${escapeHtml(dateLabel)}</span><span class="meta-value">${escapeHtml(dateValue || '—')}</span></div>
      <div class="meta-box"><span class="meta-label">Status roboty</span><span class="meta-value">${escapeHtml(job?.status || 'W toku')}</span></div>
    </div>
  `
}

function printContract(job, client, company, draft) {
  const c = companyData(company)
  const cl = { ...clientData(client), name: draft.clientName, nip: draft.clientNip, address: draft.clientAddress }
  const total = Number(draft.amount || 0)
  const date = formatDate(draft.date)
  const rows = quantityRows(job)
  const scope = draft.scope

  const html = `
    ${renderHeader(c, 'UMOWA ZLECENIE', 'dotycząca wykonania robót montażowych instalacji wentylacyjnych')}
    ${renderJobMeta(job, 'Data zawarcia', date, draft)}
    <div class="parties">${partyHtml('Zleceniodawca', cl)}${partyHtml('Zleceniobiorca / Wykonawca', c)}</div>

    <h2>§ 1. Przedmiot umowy</h2>
    <div class="clause"><span class="clause-number">1.</span>Zleceniodawca zleca, a Zleceniobiorca przyjmuje do wykonania roboty związane z realizacją instalacji wentylacyjnej dla wskazanej poniżej roboty.</div>
    <div class="scope">${escapeHtml(scope)}</div>

    <h2>§ 2. Miejsce i zakres realizacji</h2>
    <div class="clause"><span class="clause-number">1.</span>Miejsce wykonania robót: <strong>${escapeHtml(draft.location || '—')}</strong>.</div>
    <div class="clause"><span class="clause-number">2.</span>Nazwa / oznaczenie roboty: <strong>${escapeHtml(draft.name || '—')}</strong>.</div>
    <div class="clause"><span class="clause-number">3.</span>Roboty zostaną wykonane zgodnie z ustaleniami Stron, przekazaną dokumentacją oraz zasadami prawidłowego wykonawstwa.</div>

    <h2>§ 3. Wynagrodzenie</h2>
    <table><thead><tr><th>Zakres</th><th>Ilość</th><th>Stawka</th><th>Wartość</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Wartość zostanie ustalona na podstawie uzgodnionego zakresu robót.</td></tr>'}</tbody></table>
    <div class="total"><span>Łączne wynagrodzenie / wartość robót</span><strong>${formatMoney(total)}</strong></div>
    <div class="clause"><span class="clause-number">1.</span>Ostateczne rozliczenie następuje na podstawie faktycznie wykonanych i odebranych robót, jeżeli Strony nie ustaliły inaczej na piśmie.</div>
    <div class="clause"><span class="clause-number">2.</span>Termin płatności wynagrodzenia zostanie określony na fakturze lub w odrębnym uzgodnieniu Stron.</div>

    <h2>§ 4. Wykonanie i odbiór</h2>
    <div class="clause"><span class="clause-number">1.</span>Zleceniobiorca zobowiązuje się wykonać roboty z należytą starannością oraz zgodnie z ustalonym zakresem.</div>
    <div class="clause"><span class="clause-number">2.</span>Odbiór wykonanych robót zostanie potwierdzony protokołem odbioru, podpisanym przez przedstawicieli Stron.</div>
    <div class="clause"><span class="clause-number">3.</span>Ewentualne uwagi lub usterki zostaną wpisane do protokołu odbioru wraz z uzgodnionym terminem ich usunięcia.</div>

    <h2>§ 5. Obowiązki Stron</h2>
    <div class="clause"><span class="clause-number">1.</span>Zleceniodawca zobowiązuje się zapewnić dostęp do miejsca wykonywania robót oraz przekazać informacje i materiały niezbędne do realizacji uzgodnionego zakresu.</div>
    <div class="clause"><span class="clause-number">2.</span>Zleceniobiorca zobowiązuje się do organizacji i wykonania powierzonych robót zgodnie z uzgodnieniami Stron.</div>

    <h2>§ 6. Postanowienia końcowe</h2>
    <div class="clause"><span class="clause-number">1.</span>Zmiany niniejszej umowy wymagają uzgodnienia przez obie Strony.</div>
    <div class="clause"><span class="clause-number">2.</span>W sprawach nieuregulowanych niniejszą umową zastosowanie mają przepisy prawa polskiego.</div>
    <div class="clause"><span class="clause-number">3.</span>Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron.</div>

    <div class="signature-grid">
      <div class="signature"><strong>Zleceniodawca</strong>${escapeHtml(cl.name)}<br><small>data i podpis</small></div>
      <div class="signature"><strong>Zleceniobiorca / Wykonawca</strong>${escapeHtml(c.name)}<br><small>data i podpis</small></div>
    </div>
    <div class="footer">Dokument przygotowany w aplikacji Aeroinstal • ${date}</div>
  `

  openPrintWindow('Umowa zlecenie • ' + (draft.name || 'Robota'), html)
}

function printAcceptance(job, client, company, draft) {
  const c = companyData(company)
  const cl = { ...clientData(client), name: draft.clientName, nip: draft.clientNip, address: draft.clientAddress }
  const total = Number(draft.amount || 0)
  const date = formatDate(draft.date)
  const rows = quantityRows(job)

  const html = `
    ${renderHeader(c, 'PROTOKÓŁ ODBIORU ROBÓT', 'potwierdzenie wykonania i odbioru prac')}
    ${renderJobMeta(job, 'Data odbioru', date, draft)}
    <div class="parties">${partyHtml('Zleceniodawca / Zamawiający', cl)}${partyHtml('Wykonawca', c)}</div>

    <h2>§ 1. Przedmiot odbioru</h2>
    <div class="clause">Strony potwierdzają, że w dniu <strong>${escapeHtml(date)}</strong> dokonano odbioru robót wykonanych w ramach zadania <strong>${escapeHtml(draft.name || '—')}</strong>, w lokalizacji <strong>${escapeHtml(draft.location || '—')}</strong>.</div>

    <h2>§ 2. Zakres i rozliczenie</h2>
    <table><thead><tr><th>Zakres</th><th>Ilość</th><th>Stawka</th><th>Wartość</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Zakres rozliczany zgodnie z ustaleniami Stron.</td></tr>'}</tbody></table>
    <div class="total"><span>Łączna wartość robót</span><strong>${formatMoney(total)}</strong></div>

    <h2>§ 3. Stan wykonania</h2>
    <div class="checkbox-line"><span class="checkbox"></span> Roboty wykonano zgodnie z ustalonym zakresem i odebrano bez zastrzeżeń.</div>
    <div class="checkbox-line"><span class="checkbox"></span> Roboty odebrano z zastrzeżeniami wskazanymi poniżej.</div>

    <h2>§ 4. Uwagi / usterki / ustalenia</h2>
    <div class="remarks">${escapeHtml(draft.remarks || '')}</div>

    <h2>§ 5. Potwierdzenie</h2>
    <div class="clause">Podpisanie niniejszego protokołu potwierdza zakres i stan robót opisany powyżej. W przypadku wskazania zastrzeżeń Strony uzgadniają sposób oraz termin ich usunięcia w ramach odrębnych ustaleń.</div>

    <div class="signature-grid">
      <div class="signature"><strong>Zleceniodawca / Zamawiający</strong>${escapeHtml(cl.name)}<br><small>data i podpis</small></div>
      <div class="signature"><strong>Wykonawca</strong>${escapeHtml(c.name)}<br><small>data i podpis</small></div>
    </div>
    <div class="footer">Dokument przygotowany w aplikacji Aeroinstal • ${formatDate(new Date())}</div>
  `

  openPrintWindow('Protokół odbioru • ' + (draft.name || 'Robota'), html)
}

function initialDraft(type, job, client) {
  const cl = clientData(client)
  const defaultScope = job?.scope || job?.description || 'Wykonanie robót montażowych zgodnie z ustaleniami Stron, dokumentacją techniczną oraz zakresem określonym dla danej roboty.'
  const defaultRemarks = (Array.isArray(job?.notes) ? job.notes : [])
    .filter((item) => item?.text)
    .map((item) => item.text)
    .join('\n')

  return {
    date: type === 'acceptance' ? (job?.completedAt || todayInput()) : todayInput(),
    name: job?.name || '',
    location: job?.location || '',
    clientName: cl.name || '',
    clientNip: cl.nip || '',
    clientAddress: cl.address || '',
    amount: String(Number(job?.invoiceAmount || 0) || calculateTotal(job)),
    scope: defaultScope,
    remarks: defaultRemarks,
  }
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  border: '1px solid #d7e2eb',
  borderRadius: '11px',
  background: '#fff',
  color: '#17243d',
  fontSize: '14px',
  outline: 'none',
}

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  color: '#64748b',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
}

export default function JobDocuments({ job, clients, company }) {
  const client = useMemo(
    () => (clients || []).find((item) => String(item?.id) === String(job?.clientId)),
    [clients, job?.clientId]
  )
  const [editingType, setEditingType] = useState(null)
  const [draft, setDraft] = useState(null)

  const openEditor = (type) => {
    setEditingType(type)
    setDraft(initialDraft(type, job, client))
  }

  const closeEditor = () => {
    setEditingType(null)
    setDraft(null)
  }

  const setField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  if (editingType && draft) {
    const isContract = editingType === 'contract'

    return (
      <div className="detail-card">
        <div style={{ marginBottom: '14px' }}>
          <button
            type="button"
            onClick={closeEditor}
            style={{
              border: 0,
              background: 'transparent',
              padding: '4px 0',
              color: '#68788f',
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            ← Wróć do dokumentów
          </button>

          <div className="small-label" style={{ marginTop: '13px' }}>EDYCJA DOKUMENTU</div>
          <h2 style={{ margin: '4px 0 5px' }}>
            {isContract ? 'Umowa zlecenie' : 'Protokół odbioru robót'}
          </h2>
          <p style={{ margin: 0, color: '#718096', fontSize: '12px', lineHeight: 1.45 }}>
            Sprawdź i popraw dane dokumentu przed wydrukiem. Zmiany dotyczą tego wydruku i nie zmieniają danych roboty ani kartoteki klienta.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={labelStyle}>{isContract ? 'Data zawarcia' : 'Data odbioru'}</label>
            <input type="date" value={draft.date || ''} onChange={(e) => setField('date', e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Zleceniodawca / Zamawiający</label>
            <input value={draft.clientName} onChange={(e) => setField('clientName', e.target.value)} style={inputStyle} placeholder="Nazwa firmy / osoby" />
          </div>

          <div>
            <label style={labelStyle}>NIP</label>
            <input value={draft.clientNip} onChange={(e) => setField('clientNip', e.target.value)} style={inputStyle} placeholder="NIP" />
          </div>

          <div>
            <label style={labelStyle}>Adres Zleceniodawcy</label>
            <input value={draft.clientAddress} onChange={(e) => setField('clientAddress', e.target.value)} style={inputStyle} placeholder="Adres" />
          </div>

          <div>
            <label style={labelStyle}>Nazwa roboty</label>
            <input value={draft.name} onChange={(e) => setField('name', e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Miejsce / lokalizacja</label>
            <input value={draft.location} onChange={(e) => setField('location', e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Wartość dokumentu</label>
            <input type="number" inputMode="decimal" step="0.01" value={draft.amount} onChange={(e) => setField('amount', e.target.value)} style={inputStyle} />
          </div>

          {isContract ? (
            <div>
              <label style={labelStyle}>Przedmiot / zakres umowy</label>
              <textarea value={draft.scope} onChange={(e) => setField('scope', e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} />
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Uwagi / usterki / ustalenia</label>
              <textarea value={draft.remarks} onChange={(e) => setField('remarks', e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} placeholder="Wpisz uwagi albo pozostaw puste." />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '9px', marginTop: '3px' }}>
            <button
              type="button"
              onClick={closeEditor}
              style={{
                minHeight: '50px',
                border: '1px solid #f0caca',
                borderRadius: '12px',
                background: '#fff7f7',
                color: '#b45454',
                fontWeight: 800,
                fontSize: '14px',
              }}
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => isContract ? printContract(job, client, company, draft) : printAcceptance(job, client, company, draft)}
              style={{
                minHeight: '50px',
                border: 0,
                borderRadius: '12px',
                background: '#168fe5',
                color: '#fff',
                fontWeight: 850,
                fontSize: '14px',
                boxShadow: '0 5px 12px rgba(22,143,229,.18)',
              }}
            >
              🖨️ Zapisz i drukuj
            </button>
          </div>
        </div>

        {!client && (
          <div style={{
            marginTop: '11px',
            padding: '9px 11px',
            borderRadius: '10px',
            background: '#fff8e8',
            color: '#8a6516',
            fontSize: '11px',
            lineHeight: 1.4,
          }}>
            Brak przypisanego klienta — możesz uzupełnić dane Zleceniodawcy ręcznie powyżej.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="detail-card">
      <div style={{ marginBottom: '12px' }}>
        <div className="small-label">DOKUMENTY</div>
        <h2 style={{ marginTop: '4px', marginBottom: '5px' }}>Dokumenty formalne</h2>
        <p style={{ margin: 0, color: '#718096', fontSize: '12px', lineHeight: 1.45 }}>
          Wydrukuj dokument w dowolnym momencie — najpierw możesz poprawić jego treść i dane.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '9px' }}>
        <button
          type="button"
          className="document-button"
          style={{ width: '100%', minHeight: '50px', fontWeight: 800, fontSize: '14px' }}
          onClick={() => openEditor('contract')}
        >
          📄 Umowa zlecenie
        </button>

        <button
          type="button"
          className="document-button"
          style={{ width: '100%', minHeight: '50px', fontWeight: 800, fontSize: '14px' }}
          onClick={() => openEditor('acceptance')}
        >
          📋 Protokół odbioru robót
        </button>
      </div>

      {!client && (
        <div style={{
          marginTop: '10px',
          padding: '9px 11px',
          borderRadius: '10px',
          background: '#fff8e8',
          color: '#8a6516',
          fontSize: '11px',
          lineHeight: 1.4,
        }}>
          Brak przypisanego klienta — dokument nadal można przygotować, a dane Zleceniodawcy uzupełnić przed wydrukiem.
        </div>
      )}
    </div>
  )
}
