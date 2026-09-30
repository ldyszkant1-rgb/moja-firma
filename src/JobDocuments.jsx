import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

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


const PRINT_PREVIEW_CSS = "          @page { size: A4; margin: 8mm 10mm 9mm; }\n          * { box-sizing: border-box; }\n          html, body { background: #fff !important; }\n          body {\n            margin: 0;\n            color: #17243d;\n            background: #fff !important;\n            font-family: Arial, Helvetica, sans-serif;\n            font-size: 8.5pt;\n            line-height: 1.25;\n          }\n          .document { width: 100%; max-width: 190mm; margin: 0 auto; background: #fff; }\n          .topbar { display: none; }\n          .brand { display: flex; align-items: flex-start; justify-content: space-between; gap: 15px; padding-bottom: 7px; border-bottom: 1px solid #bfc8d2; }\n          .brand-name { color: #12234f; font-size: 13pt; font-weight: 800; letter-spacing: .1px; }\n          .brand-sub { margin-top: 2px; color: #5f6b7a; font-size: 6.8pt; }\n          .brand-data { text-align: right; color: #5f6b7a; font-size: 7pt; line-height: 1.3; }\n          .title-block { text-align: center; margin: 8px 0 8px; }\n          .eyebrow { color: #4d5b6b; font-size: 6.5pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }\n          h1 { margin: 2px 0 2px; color: #12234f; font-size: 14pt; line-height: 1.05; }\n          .subtitle { color: #5f6b7a; font-size: 7pt; }\n          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 8px; margin-bottom: 7px; }\n          .meta-box { padding: 5px 7px; border: 1px solid #cbd4de; border-radius: 4px; background: #fff !important; }\n          .meta-label { display: block; color: #697586; font-size: 6pt; font-weight: 700; text-transform: uppercase; letter-spacing: .35px; }\n          .meta-value { display: block; margin-top: 1px; color: #17243d; font-weight: 700; font-size: 8pt; }\n          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin: 7px 0; }\n          .party { min-height: 0; padding: 7px 8px; border: 1px solid #cbd4de; border-radius: 4px; background: #fff !important; }\n          .party-label { color: #4d5b6b; font-size: 6pt; font-weight: 800; letter-spacing: .55px; text-transform: uppercase; margin-bottom: 3px; }\n          .party-name { color: #12234f; font-weight: 750; margin-bottom: 1px; font-size: 8.3pt; }\n          .party-line { color: #526174; font-size: 7.2pt; line-height: 1.2; }\n          .party-extra { margin-top: 3px; color: #526174; font-size: 6.8pt; font-weight: 700; }\n          h2 { margin: 7px 0 3px; padding-bottom: 2px; border-bottom: 1px solid #cbd4de; color: #12234f; font-size: 8.8pt; }\n          p { margin: 3px 0 5px; }\n          .clause { margin: 0 0 4px; }\n          .clause-number { font-weight: 800; color: #4d5b6b; margin-right: 3px; }\n          table { width: 100%; border-collapse: collapse; margin: 4px 0 4px; }\n          th { padding: 4px 5px; background: #fff !important; color: #17243d; border-top: 1px solid #9da9b6; border-bottom: 1px solid #9da9b6; font-size: 7pt; text-align: left; }\n          td { padding: 4px 5px; border-bottom: 1px solid #d8dee5; font-size: 7.4pt; }\n          .center { text-align: center; }\n          .right { text-align: right; }\n          .strong { font-weight: 750; }\n          .total { display: flex; justify-content: flex-end; align-items: baseline; gap: 10px; margin: 4px 0 6px; padding: 5px 7px; background: #fff !important; border: 1px solid #cbd4de; border-radius: 4px; }\n          .total span { color: #526174; font-size: 7pt; font-weight: 700; }\n          .total strong { color: #12234f; font-size: 9.5pt; }\n          .scope { min-height: 28px; padding: 5px 7px; border: 1px solid #cbd4de; border-radius: 4px; background: #fff !important; white-space: pre-wrap; font-size: 7.5pt; }\n          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-top: 14px; page-break-inside: avoid; }\n          .signature { min-height: 48px; padding-top: 22px; border-top: 1px solid #334155; text-align: center; color: #526174; font-size: 7pt; }\n          .signature strong { display: block; color: #17243d; margin-bottom: 1px; }\n          .signature small { color: #6f7c8c; }\n          .checkbox-line { margin: 4px 0; font-size: 7.5pt; }\n          .checkbox { display: inline-block; width: 9px; height: 9px; margin-right: 4px; vertical-align: -1px; border: 1px solid #7b8794; }\n          .remarks { min-height: 38px; padding: 5px 7px; border: 1px solid #cbd4de; border-radius: 4px; background: #fff !important; white-space: pre-wrap; font-size: 7.5pt; }\n          .footer { margin-top: 9px; padding-top: 4px; border-top: 1px solid #d8dee5; color: #7a8695; font-size: 6pt; text-align: center; }\n          @media print {\n            html, body { background: #fff !important; }\n            .document { background: #fff !important; }\n            .no-print { display: none !important; }\n          }\n#aeroinstal-print-preview {\n  min-height: 100vh;\n  padding: 14px;\n  background: #eef2f6;\n  color: #17243d;\n  font-family: Arial, Helvetica, sans-serif;\n}\n#aeroinstal-print-preview .print-toolbar {\n  position: sticky;\n  top: 0;\n  z-index: 10;\n  display: flex;\n  justify-content: space-between;\n  gap: 10px;\n  max-width: 210mm;\n  margin: 0 auto 12px;\n  padding: 10px;\n  background: rgba(255,255,255,.96);\n  border: 1px solid #d7e2eb;\n  border-radius: 12px;\n  box-shadow: 0 4px 16px rgba(15,23,42,.08);\n}\n#aeroinstal-print-preview .print-toolbar button {\n  min-height: 42px;\n  padding: 9px 13px;\n  border-radius: 10px;\n  border: 1px solid #d7e2eb;\n  background: #fff;\n  color: #17243d;\n  font-weight: 800;\n  font-size: 13px;\n}\n#aeroinstal-print-preview .print-toolbar button.primary {\n  border: 0;\n  background: #168fe5;\n  color: #fff;\n}\n#aeroinstal-print-preview .print-sheet {\n  max-width: 210mm;\n  margin: 0 auto;\n  padding: 10mm;\n  background: #fff;\n  box-shadow: 0 5px 24px rgba(15,23,42,.10);\n}\n@media print {\n  body.aeroinstal-printing {\n    background: #fff !important;\n  }\n  body.aeroinstal-printing > * {\n    visibility: hidden !important;\n  }\n  body.aeroinstal-printing #aeroinstal-print-preview,\n  body.aeroinstal-printing #aeroinstal-print-preview * {\n    visibility: visible !important;\n  }\n  body.aeroinstal-printing #aeroinstal-print-preview {\n    position: absolute !important;\n    inset: 0 !important;\n    width: 100% !important;\n    min-height: auto !important;\n    padding: 0 !important;\n    margin: 0 !important;\n    background: #fff !important;\n  }\n  body.aeroinstal-printing #aeroinstal-print-preview .print-toolbar {\n    display: none !important;\n  }\n  body.aeroinstal-printing #aeroinstal-print-preview .print-sheet {\n    max-width: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n    box-shadow: none !important;\n  }\n}"

function openPrintWindow(title, html, onPreview) {
  if (onPreview) {
    onPreview({ title, html })
    return
  }
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
          @page { size: A4; margin: 8mm 10mm 9mm; }
          * { box-sizing: border-box; }
          html, body { background: #fff !important; }
          body {
            margin: 0;
            color: #17243d;
            background: #fff !important;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8.5pt;
            line-height: 1.25;
          }
          .document { width: 100%; max-width: 190mm; margin: 0 auto; background: #fff; }
          .topbar { display: none; }
          .brand { display: flex; align-items: flex-start; justify-content: space-between; gap: 15px; padding-bottom: 7px; border-bottom: 1px solid #bfc8d2; }
          .brand-name { color: #12234f; font-size: 13pt; font-weight: 800; letter-spacing: .1px; }
          .brand-sub { margin-top: 2px; color: #5f6b7a; font-size: 6.8pt; }
          .brand-data { text-align: right; color: #5f6b7a; font-size: 7pt; line-height: 1.3; }
          .title-block { text-align: center; margin: 8px 0 8px; }
          .eyebrow { color: #4d5b6b; font-size: 6.5pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
          h1 { margin: 2px 0 2px; color: #12234f; font-size: 14pt; line-height: 1.05; }
          .subtitle { color: #5f6b7a; font-size: 7pt; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 8px; margin-bottom: 7px; }
          .meta-box { padding: 5px 7px; border: 1px solid #cbd4de; border-radius: 4px; background: #fff !important; }
          .meta-label { display: block; color: #697586; font-size: 6pt; font-weight: 700; text-transform: uppercase; letter-spacing: .35px; }
          .meta-value { display: block; margin-top: 1px; color: #17243d; font-weight: 700; font-size: 8pt; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin: 7px 0; }
          .party { min-height: 0; padding: 7px 8px; border: 1px solid #cbd4de; border-radius: 4px; background: #fff !important; }
          .party-label { color: #4d5b6b; font-size: 6pt; font-weight: 800; letter-spacing: .55px; text-transform: uppercase; margin-bottom: 3px; }
          .party-name { color: #12234f; font-weight: 750; margin-bottom: 1px; font-size: 8.3pt; }
          .party-line { color: #526174; font-size: 7.2pt; line-height: 1.2; }
          .party-extra { margin-top: 3px; color: #526174; font-size: 6.8pt; font-weight: 700; }
          h2 { margin: 7px 0 3px; padding-bottom: 2px; border-bottom: 1px solid #cbd4de; color: #12234f; font-size: 8.8pt; }
          p { margin: 3px 0 5px; }
          .clause { margin: 0 0 4px; }
          .clause-number { font-weight: 800; color: #4d5b6b; margin-right: 3px; }
          table { width: 100%; border-collapse: collapse; margin: 4px 0 4px; }
          th { padding: 4px 5px; background: #fff !important; color: #17243d; border-top: 1px solid #9da9b6; border-bottom: 1px solid #9da9b6; font-size: 7pt; text-align: left; }
          td { padding: 4px 5px; border-bottom: 1px solid #d8dee5; font-size: 7.4pt; }
          .center { text-align: center; }
          .right { text-align: right; }
          .strong { font-weight: 750; }
          .total { display: flex; justify-content: flex-end; align-items: baseline; gap: 10px; margin: 4px 0 6px; padding: 5px 7px; background: #fff !important; border: 1px solid #cbd4de; border-radius: 4px; }
          .total span { color: #526174; font-size: 7pt; font-weight: 700; }
          .total strong { color: #12234f; font-size: 9.5pt; }
          .scope { min-height: 28px; padding: 5px 7px; border: 1px solid #cbd4de; border-radius: 4px; background: #fff !important; white-space: pre-wrap; font-size: 7.5pt; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-top: 14px; page-break-inside: avoid; }
          .signature { min-height: 48px; padding-top: 22px; border-top: 1px solid #334155; text-align: center; color: #526174; font-size: 7pt; }
          .signature strong { display: block; color: #17243d; margin-bottom: 1px; }
          .signature small { color: #6f7c8c; }
          .checkbox-line { margin: 4px 0; font-size: 7.5pt; }
          .checkbox { display: inline-block; width: 9px; height: 9px; margin-right: 4px; vertical-align: -1px; border: 1px solid #7b8794; }
          .remarks { min-height: 38px; padding: 5px 7px; border: 1px solid #cbd4de; border-radius: 4px; background: #fff !important; white-space: pre-wrap; font-size: 7.5pt; }
          .footer { margin-top: 9px; padding-top: 4px; border-top: 1px solid #d8dee5; color: #7a8695; font-size: 6pt; text-align: center; }
          @media print {
            html, body { background: #fff !important; }
            .document { background: #fff !important; }
            .no-print { display: none !important; }
          }
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

function printContract(job, client, company, draft, onPreview) {
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

  openPrintWindow('Umowa zlecenie • ' + (draft.name || 'Robota'), html, onPreview)
}

function printAcceptance(job, client, company, draft, onPreview) {
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

  openPrintWindow('Protokół odbioru • ' + (draft.name || 'Robota'), html, onPreview)
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
  const [printPreview, setPrintPreview] = useState(null)

  useEffect(() => {
    if (!printPreview) return

    document.body.classList.add('aeroinstal-printing')

    const handleAfterPrint = () => {
      document.body.classList.remove('aeroinstal-printing')
    }

    window.addEventListener('afterprint', handleAfterPrint)
    const timer = window.setTimeout(() => window.print(), 180)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
      document.body.classList.remove('aeroinstal-printing')
    }
  }, [printPreview])

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
              onClick={() => isContract ? printContract(job, client, company, draft, setPrintPreview) : printAcceptance(job, client, company, draft, setPrintPreview)}
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

  const printPreviewPortal = printPreview ? createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_PREVIEW_CSS }} />
      <div id="aeroinstal-print-preview">
        <div className="print-toolbar no-print">
          <button type="button" onClick={() => setPrintPreview(null)}>
            ← Wróć do edycji
          </button>
          <button type="button" className="primary" onClick={() => window.print()}>
            🖨️ Drukuj ponownie
          </button>
        </div>
        <div className="print-sheet">
          <div dangerouslySetInnerHTML={{ __html: printPreview.html }} />
        </div>
      </div>
    </>,
    document.body
  ) : null

  return (
    <>
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
      {printPreviewPortal}
    </>
  )
}