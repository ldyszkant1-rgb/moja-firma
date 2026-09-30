import React from 'react'

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
            font-size: 11.5pt;
            line-height: 1.48;
          }
          .document { max-width: 180mm; margin: 0 auto; }
          .topbar {
            height: 7px;
            background: #168fe5;
            border-radius: 0 0 4px 4px;
            margin-bottom: 20px;
          }
          .brand {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #dbe5ee;
          }
          .brand-name {
            color: #12234f;
            font-size: 20pt;
            font-weight: 850;
            letter-spacing: .2px;
          }
          .brand-sub {
            margin-top: 4px;
            color: #64748b;
            font-size: 8.5pt;
          }
          .brand-data {
            text-align: right;
            color: #64748b;
            font-size: 8.5pt;
            line-height: 1.55;
          }
          .title-block { text-align: center; margin: 28px 0 23px; }
          .eyebrow {
            color: #168fe5;
            font-size: 8pt;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
          }
          h1 {
            margin: 5px 0 4px;
            color: #12234f;
            font-size: 22pt;
            line-height: 1.15;
          }
          .subtitle { color: #718096; font-size: 9.5pt; }
          .meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 18px;
          }
          .meta-box {
            padding: 10px 12px;
            border: 1px solid #dce5ec;
            border-radius: 8px;
            background: #f8fbfd;
          }
          .meta-label {
            display: block;
            color: #7a889b;
            font-size: 7.5pt;
            font-weight: 750;
            text-transform: uppercase;
            letter-spacing: .5px;
          }
          .meta-value { display: block; margin-top: 3px; color: #17243d; font-weight: 750; }
          .parties {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 18px 0;
          }
          .party {
            min-height: 105px;
            padding: 13px 14px;
            border: 1px solid #dce5ec;
            border-radius: 9px;
          }
          .party-label {
            color: #168fe5;
            font-size: 7.5pt;
            font-weight: 850;
            letter-spacing: .8px;
            text-transform: uppercase;
            margin-bottom: 7px;
          }
          .party-name { color: #12234f; font-weight: 800; margin-bottom: 3px; }
          .party-line { color: #526174; font-size: 9pt; }
          .party-extra { margin-top: 7px; color: #168fe5; font-size: 8pt; font-weight: 700; }
          h2 {
            margin: 22px 0 8px;
            padding-bottom: 5px;
            border-bottom: 1px solid #dce5ec;
            color: #12234f;
            font-size: 12.5pt;
          }
          p { margin: 6px 0 9px; }
          .clause { margin: 0 0 10px; }
          .clause-number { font-weight: 800; color: #168fe5; margin-right: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0 8px; }
          th {
            padding: 8px 7px;
            background: #12234f;
            color: #fff;
            font-size: 8.5pt;
            text-align: left;
          }
          td {
            padding: 8px 7px;
            border-bottom: 1px solid #e4eaf0;
            font-size: 9pt;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .strong { font-weight: 750; }
          .total {
            display: flex;
            justify-content: flex-end;
            align-items: baseline;
            gap: 14px;
            margin: 9px 0 16px;
            padding: 11px 13px;
            background: #f2f8fd;
            border: 1px solid #d8eaf7;
            border-radius: 8px;
          }
          .total span { color: #64748b; font-size: 9pt; font-weight: 700; }
          .total strong { color: #12234f; font-size: 15pt; }
          .scope {
            min-height: 48px;
            padding: 10px 12px;
            border: 1px solid #e0e7ee;
            border-radius: 7px;
            background: #fbfcfd;
            white-space: pre-wrap;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 28px;
            margin-top: 42px;
            page-break-inside: avoid;
          }
          .signature {
            min-height: 88px;
            padding-top: 42px;
            border-top: 1px solid #334155;
            text-align: center;
            color: #526174;
            font-size: 8.5pt;
          }
          .signature strong { display: block; color: #17243d; margin-bottom: 3px; }
          .signature small { color: #8a97a8; }
          .checkbox-line { margin: 8px 0; }
          .checkbox {
            display: inline-block;
            width: 13px;
            height: 13px;
            margin-right: 6px;
            vertical-align: -2px;
            border: 1px solid #8a97a8;
          }
          .remarks {
            min-height: 68px;
            padding: 10px 12px;
            border: 1px solid #dce5ec;
            border-radius: 7px;
            background: #fff;
          }
          .footer {
            margin-top: 30px;
            padding-top: 8px;
            border-top: 1px solid #e1e7ed;
            color: #8a97a8;
            font-size: 7.5pt;
            text-align: center;
          }
          .page-break { page-break-before: always; }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="document">
          ${html}
        </div>
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

function renderJobMeta(job, dateLabel, dateValue) {
  return `
    <div class="meta">
      <div class="meta-box">
        <span class="meta-label">Robota</span>
        <span class="meta-value">${escapeHtml(job?.name || '—')}</span>
      </div>
      <div class="meta-box">
        <span class="meta-label">Lokalizacja</span>
        <span class="meta-value">${escapeHtml(job?.location || '—')}</span>
      </div>
      <div class="meta-box">
        <span class="meta-label">${escapeHtml(dateLabel)}</span>
        <span class="meta-value">${escapeHtml(dateValue || '—')}</span>
      </div>
      <div class="meta-box">
        <span class="meta-label">Status roboty</span>
        <span class="meta-value">${escapeHtml(job?.status || 'W toku')}</span>
      </div>
    </div>
  `
}

function printContract(job, client, company) {
  const c = companyData(company)
  const cl = clientData(client)
  const total = Number(job?.invoiceAmount || 0) || calculateTotal(job)
  const today = formatDate(new Date())
  const rows = quantityRows(job)
  const scope = job?.scope || job?.description || 'Wykonanie robót montażowych zgodnie z ustaleniami Stron, dokumentacją techniczną oraz zakresem określonym dla danej roboty.'
  
  const html = `
    ${renderHeader(c, 'UMOWA ZLECENIE', 'dotycząca wykonania robót montażowych instalacji wentylacyjnych')}
    ${renderJobMeta(job, 'Data zawarcia', today)}

    <div class="parties">
      ${partyHtml('Zleceniodawca', cl)}
      ${partyHtml('Zleceniobiorca / Wykonawca', c)}
    </div>

    <h2>§ 1. Przedmiot umowy</h2>
    <div class="clause"><span class="clause-number">1.</span>Zleceniodawca zleca, a Zleceniobiorca przyjmuje do wykonania roboty związane z realizacją instalacji wentylacyjnej dla wskazanej poniżej roboty.</div>
    <div class="scope">${escapeHtml(scope)}</div>

    <h2>§ 2. Miejsce i zakres realizacji</h2>
    <div class="clause"><span class="clause-number">1.</span>Miejsce wykonania robót: <strong>${escapeHtml(job?.location || '—')}</strong>.</div>
    <div class="clause"><span class="clause-number">2.</span>Nazwa / oznaczenie roboty: <strong>${escapeHtml(job?.name || '—')}</strong>.</div>
    <div class="clause"><span class="clause-number">3.</span>Roboty zostaną wykonane zgodnie z ustaleniami Stron, przekazaną dokumentacją oraz zasadami prawidłowego wykonawstwa.</div>

    <h2>§ 3. Wynagrodzenie</h2>
    <table>
      <thead><tr><th>Zakres</th><th>Ilość</th><th>Stawka</th><th>Wartość</th></tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="4">Wartość zostanie ustalona na podstawie uzgodnionego zakresu robót.</td></tr>'}
      </tbody>
    </table>
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
      <div class="signature">
        <strong>Zleceniodawca</strong>
        ${escapeHtml(cl.name)}
        <br><small>data i podpis</small>
      </div>
      <div class="signature">
        <strong>Zleceniobiorca / Wykonawca</strong>
        ${escapeHtml(c.name)}
        <br><small>data i podpis</small>
      </div>
    </div>

    <div class="footer">Dokument przygotowany w aplikacji Aeroinstal • ${today}</div>
  `

  openPrintWindow('Umowa zlecenie • ' + (job?.name || 'Robota'), html)
}

function printAcceptance(job, client, company) {
  const c = companyData(company)
  const cl = clientData(client)
  const total = Number(job?.invoiceAmount || 0) || calculateTotal(job)
  const today = formatDate(job?.completedAt || new Date())
  const rows = quantityRows(job)

  const html = `
    ${renderHeader(c, 'PROTOKÓŁ ODBIORU ROBÓT', 'potwierdzenie wykonania i odbioru prac')}
    ${renderJobMeta(job, 'Data odbioru', today)}

    <div class="parties">
      ${partyHtml('Zleceniodawca / Zamawiający', cl)}
      ${partyHtml('Wykonawca', c)}
    </div>

    <h2>§ 1. Przedmiot odbioru</h2>
    <div class="clause">Strony potwierdzają, że w dniu <strong>${escapeHtml(today)}</strong> dokonano odbioru robót wykonanych w ramach zadania <strong>${escapeHtml(job?.name || '—')}</strong>, w lokalizacji <strong>${escapeHtml(job?.location || '—')}</strong>.</div>

    <h2>§ 2. Zakres i rozliczenie</h2>
    <table>
      <thead><tr><th>Zakres</th><th>Ilość</th><th>Stawka</th><th>Wartość</th></tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="4">Zakres rozliczany zgodnie z ustaleniami Stron.</td></tr>'}
      </tbody>
    </table>
    <div class="total"><span>Łączna wartość robót</span><strong>${formatMoney(total)}</strong></div>

    <h2>§ 3. Stan wykonania</h2>
    <div class="checkbox-line"><span class="checkbox"></span> Roboty wykonano zgodnie z ustalonym zakresem i odebrano bez zastrzeżeń.</div>
    <div class="checkbox-line"><span class="checkbox"></span> Roboty odebrano z zastrzeżeniami wskazanymi poniżej.</div>

    <h2>§ 4. Uwagi / usterki / ustalenia</h2>
    <div class="remarks">${escapeHtml(job?.notes?.filter?.((item) => item?.text).map((item) => item.text).join('\\n') || '')}</div>

    <h2>§ 5. Potwierdzenie</h2>
    <div class="clause">Podpisanie niniejszego protokołu potwierdza zakres i stan robót opisany powyżej. W przypadku wskazania zastrzeżeń Strony uzgadniają sposób oraz termin ich usunięcia w ramach odrębnych ustaleń.</div>

    <div class="signature-grid">
      <div class="signature">
        <strong>Zleceniodawca / Zamawiający</strong>
        ${escapeHtml(cl.name)}
        <br><small>data i podpis</small>
      </div>
      <div class="signature">
        <strong>Wykonawca</strong>
        ${escapeHtml(c.name)}
        <br><small>data i podpis</small>
      </div>
    </div>

    <div class="footer">Dokument przygotowany w aplikacji Aeroinstal • ${formatDate(new Date())}</div>
  `

  openPrintWindow('Protokół odbioru • ' + (job?.name || 'Robota'), html)
}

export default function JobDocuments({ job, clients, company }) {
  const client = (clients || []).find(
    (item) => String(item?.id) === String(job?.clientId)
  )

  return (
    <div className="detail-card">
      <div style={{ marginBottom: '12px' }}>
        <div className="small-label">DOKUMENTY</div>
        <h2 style={{ marginTop: '4px', marginBottom: '5px' }}>Dokumenty formalne</h2>
        <p style={{ margin: 0, color: '#718096', fontSize: '12px', lineHeight: 1.45 }}>
          Wydrukuj dokument w dowolnym momencie — także po wykonaniu robót i po odbiorze.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '9px' }}>
        <button
          type="button"
          className="document-button"
          style={{ width: '100%', minHeight: '50px', fontWeight: 800, fontSize: '14px' }}
          onClick={() => printContract(job, client, company)}
        >
          📄 Umowa zlecenie
        </button>

        <button
          type="button"
          className="document-button"
          style={{ width: '100%', minHeight: '50px', fontWeight: 800, fontSize: '14px' }}
          onClick={() => printAcceptance(job, client, company)}
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
          Brak przypisanego klienta — dokument nadal można wydrukować, ale dane Zleceniodawcy trzeba uzupełnić ręcznie.
        </div>
      )}
    </div>
  )
}
