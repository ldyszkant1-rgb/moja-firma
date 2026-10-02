import React,{useEffect,useMemo,useState} from 'react'
import logo from './assets/logo.png'
import {createInvoice,updateInvoice,deleteInvoice} from './lib/invoicesApi'
import {getJobPayments,createJobPayment,deleteJobPayment} from './lib/jobPaymentsApi'

const money=v=>Number(v||0).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł'
const today=()=>new Date().toISOString().slice(0,10)
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)}
const formatDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}):'—'
const total=j=>{const q=j?.quantities||{},r=j?.rates||{};return Number(q.mb||0)*Number(r.mb||0)+Number(q.m2||0)*Number(r.m2||0)+Number(q.kg||0)*Number(r.kg||0)}
const items=j=>{if(!j)return[];const q=j.quantities||{},r=j.rates||{};return[['Prace wentylacyjne – mb',q.mb,r.mb,'mb'],['Prace wentylacyjne – m²',q.m2,r.m2,'m²'],['Prace wentylacyjne – kg',q.kg,r.kg,'kg']].filter(x=>Number(x[1]||0)>0&&Number(x[2]||0)>0).map(x=>({name:x[0],quantity:Number(x[1]),netUnit:Number(x[2]),unit:x[3],vatRate:23}))}
const amounts=it=>(it||[]).reduce((a,x)=>{const net=Number(x.quantity||0)*Number(x.netUnit||0),vat=net*Number(x.vatRate||0)/100;a.net+=net;a.vat+=vat;a.gross+=net+vat;return a},{net:0,vat:0,gross:0})
const blankItem=()=>({name:'',quantity:1,netUnit:0,unit:'szt.',vatRate:23})
const polishAmountInWords=value=>{
 const n=Math.max(0,Math.round(Number(value||0)*100))
 const zl=Math.floor(n/100),gr=n%100
 const ones=['zero','jeden','dwa','trzy','cztery','pięć','sześć','siedem','osiem','dziewięć']
 const teens=['dziesięć','jedenaście','dwanaście','trzynaście','czternaście','piętnaście','szesnaście','siedemnaście','osiemnaście','dziewiętnaście']
 const tens=['','', 'dwadzieścia','trzydzieści','czterdzieści','pięćdziesiąt','sześćdziesiąt','siedemdziesiąt','osiemdziesiąt','dziewięćdziesiąt']
 const hundreds=['','sto','dwieście','trzysta','czterysta','pięćset','sześćset','siedemset','osiemset','dziewięćset']
 const groups=[['',''],['tysiąc','tysiące','tysięcy'],['milion','miliony','milionów']]
 const under1000=x=>{
  const out=[]
  const h=Math.floor(x/100),rest=x%100
  if(h)out.push(hundreds[h])
  if(rest>=10&&rest<20)out.push(teens[rest-10])
  else{const t=Math.floor(rest/10),o=rest%10;if(t)out.push(tens[t]);if(o)out.push(ones[o])}
  return out.join(' ')
 }
 const parts=[]
 let rest=zl,gi=0
 while(rest>0){
  const part=rest%1000
  if(part){
   let words=under1000(part)
   if(gi>0){
    const form=part===1?groups[gi][0]:(part%10>=2&&part%10<=4&&!(part%100>=12&&part%100<=14)?groups[gi][1]:groups[gi][2])
    if(!(gi===1&&part===1))words += ' '+form
    else words=groups[gi][0]
   }
   parts.unshift(words)
  }
  rest=Math.floor(rest/1000);gi++
 }
 return (parts.join(' ')||'zero')+' złotych '+String(gr).padStart(2,'0')+'/100'
}


export default function InvoicesPage({invoices=[],jobs=[],clients=[],settings={},prefillJobId=null,openInvoiceId=null,onPrefillConsumed,onOpenConsumed,onAlert,onConfirm}){
 const [edit,setEdit]=useState(null),[preview,setPreview]=useState(null),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[saving,setSaving]=useState(false)
 const [payments,setPayments]=useState([]),[paymentForm,setPaymentForm]=useState({amount:'',paidAt:today(),note:''}),[paymentSaving,setPaymentSaving]=useState(false)
 const cm=useMemo(()=>new Map(clients.map(c=>[String(c.id),c])),[clients])
 const jm=useMemo(()=>new Map(jobs.map(j=>[String(j.id),j])),[jobs])
 const company=settings?.company||{}

 const paymentStatus=x=>{
  const gross=Number(x?.grossAmount||0),paid=Number(x?.paidAmount||0)+Number(x?.vatSettledAmount||0),remaining=Math.max(0,gross-paid)
  if(paid>0&&remaining<=0.01)return 'Zapłacona'
  if(paid>0)return 'Częściowo zapłacona'
  if(x?.dueDate&&new Date(x.dueDate+'T23:59:59')<new Date()&&gross>0)return 'Przeterminowana'
  return x?.status||'Do wystawienia'
 }

 const open=job=>{
  const t=job?total(job):0
  const it=items(job)
  setEdit({
   jobId:job?.id||'',clientId:job?.clientId||'',invoiceNumber:'',
   issueDate:today(),saleDate:today(),dueDate:addDays(today(),14),
   status:'Do wystawienia',paymentMethod:'Przelew',items:it,
   netAmount:t,vatAmount:t*.23,grossAmount:t*1.23,paidAmount:0,vatSettledAmount:0,notes:''
  })
 }

 const refreshPayments=async(jobId)=>{
  if(!jobId){setPayments([]);return}
  try{
   const rows=await getJobPayments(jobId)
   setPayments(rows)
   const paid=rows.filter(p=>!edit?.id||String(p.invoiceId||'')===String(edit.id)).reduce((s,p)=>s+Number(p.amount||0),0)
   if(edit?.id)setEdit(prev=>prev?{...prev,paidAmount:paid}:prev)
  }catch(error){console.error('Nie udało się wczytać płatności faktury:',error);setPayments([])}
 }

 useEffect(()=>{
  if(!edit?.jobId){setPayments([]);return}
  getJobPayments(edit.jobId).then(rows=>{
   setPayments(rows)
   if(edit.id){
    const paid=rows.filter(p=>String(p.invoiceId||'')===String(edit.id)).reduce((s,p)=>s+Number(p.amount||0),0)
    setEdit(prev=>prev?{...prev,paidAmount:paid}:prev)
   }
  }).catch(error=>console.error('Nie udało się wczytać płatności faktury:',error))
 },[edit?.id,edit?.jobId])

 const addPayment=async()=>{
  if(!edit?.id||!edit?.jobId){onAlert?.('Najpierw zapisz fakturę, aby dodać płatność.');return}
  const amount=Number(paymentForm.amount||0)
  const remaining=Math.max(0,Number(edit.grossAmount||0)-Number(edit.paidAmount||0)-Number(edit.vatSettledAmount||0))
  if(!Number.isFinite(amount)||amount<=0){onAlert?.('Podaj prawidłową kwotę płatności.');return}
  if(amount>remaining+0.01){onAlert?.('Kwota płatności jest większa niż pozostała należność.');return}
  try{
   setPaymentSaving(true)
   await createJobPayment({jobId:edit.jobId,invoiceId:edit.id,amount,paidAt:paymentForm.paidAt||today(),note:paymentForm.note})
   setPaymentForm({amount:'',paidAt:today(),note:''})
   await refreshPayments(edit.jobId)
   window.dispatchEvent(new CustomEvent('aeroinstal-invoices-changed'))
  }catch(error){console.error('Nie udało się zapisać płatności:',error);onAlert?.('Nie udało się zapisać płatności.')}
  finally{setPaymentSaving(false)}
 }

 const removePayment=async(payment)=>{
  const confirmed=await onConfirm?.(`Usunąć płatność ${money(payment.amount)} z dnia ${formatDate(payment.paidAt)}?`)
  if(!confirmed)return
  try{
   await deleteJobPayment(payment.id)
   await refreshPayments(edit.jobId)
   window.dispatchEvent(new CustomEvent('aeroinstal-invoices-changed'))
  }catch(error){console.error('Nie udało się usunąć płatności:',error);onAlert?.('Nie udało się usunąć płatności.')}
 }

 useEffect(()=>{if(!prefillJobId||edit)return;const j=jm.get(String(prefillJobId));if(!j)return;open(j);onPrefillConsumed?.()},[prefillJobId,jm,edit])
 useEffect(()=>{if(!openInvoiceId||edit)return;const inv=invoices.find(x=>String(x.id)===String(openInvoiceId));if(!inv)return;setEdit({...inv,items:Array.isArray(inv.items)?inv.items:[]});onOpenConsumed?.()},[openInvoiceId,invoices,edit])

 const recalc=(nextItems,patch={})=>{
  const a=amounts(nextItems)
  setEdit(prev=>({...prev,...patch,items:nextItems,netAmount:a.net,vatAmount:a.vat,grossAmount:a.gross,vatSettledAmount:Math.min(Number(prev?.vatSettledAmount||0),a.vat)}))
 }

 const save=async()=>{
  if(!edit.clientId){onAlert?.('Wybierz klienta.');return}
  if(!edit.issueDate){onAlert?.('Podaj datę wystawienia.');return}
  if(!edit.saleDate){onAlert?.('Podaj datę sprzedaży.');return}
  if(!edit.dueDate){onAlert?.('Podaj termin płatności.');return}
  if(new Date(edit.saleDate+'T23:59:59')>new Date(edit.issueDate+'T23:59:59')){onAlert?.('Data sprzedaży nie może być późniejsza niż data wystawienia.');return}
  if(new Date(edit.dueDate+'T23:59:59')<new Date(edit.issueDate+'T00:00:00')){onAlert?.('Termin płatności nie może być wcześniejszy niż data wystawienia.');return}
  if(!edit.items?.length){onAlert?.('Dodaj co najmniej jedną pozycję.');return}
  if(edit.items.some(x=>!String(x.name||'').trim())){onAlert?.('Każda pozycja musi mieć opis.');return}
  if(edit.items.some(x=>Number(x.quantity||0)<=0)){onAlert?.('Ilość każdej pozycji musi być większa od zera.');return}
  if(edit.items.some(x=>Number(x.netUnit||0)<0)){onAlert?.('Cena netto nie może być ujemna.');return}
  const calculated=amounts(edit.items)
  const paid=Number(edit.paidAmount||0)
  const vatSettled=Math.min(Math.max(0,Number(edit.vatSettledAmount||0)),Math.max(0,Number(calculated.vat||0)))
  if(edit.id && paid + vatSettled > calculated.gross + 0.01){
   onAlert?.('Nie można obniżyć wartości faktury poniżej już otrzymanych wpłat i rozliczonego VAT.')
   return
  }
  setSaving(true)
  try{
   let confirmedPaid=paid
   if(edit.id && edit.jobId){
    const rows=await getJobPayments(edit.jobId)
    confirmedPaid=rows
      .filter(p=>String(p.invoiceId||'')===String(edit.id))
      .reduce((sum,p)=>sum+Number(p.amount||0),0)
    if(confirmedPaid + vatSettled > calculated.gross + 0.01){
     onAlert?.('Nie można obniżyć wartości faktury poniżej już otrzymanych wpłat i rozliczonego VAT.')
     return
    }
   }
   const vatLimit=Math.max(0,Number(calculated.vat||0))
   const normalizedEdit={...edit,netAmount:calculated.net,vatAmount:calculated.vat,grossAmount:calculated.gross,paidAmount:confirmedPaid,vatSettledAmount:Math.min(Math.max(0,Number(edit.vatSettledAmount||0)),vatLimit)}
   const x=edit.id?await updateInvoice(normalizedEdit):await createInvoice(normalizedEdit)
   setEdit(null)
   window.dispatchEvent(new CustomEvent('aeroinstal-invoices-changed',{detail:x}))
   onAlert?.('Faktura została zapisana.')
  }catch(e){console.error(e);onAlert?.('Nie udało się zapisać faktury.')}finally{setSaving(false)}
 }

 const remove=async x=>{
  let linkedPayments=[]
  if(x?.jobId){
   try{
    const rows=await getJobPayments(x.jobId)
    linkedPayments=rows.filter(p=>String(p.invoiceId||'')===String(x.id))
   }catch(e){console.error('Nie udało się sprawdzić płatności faktury:',e);onAlert?.('Nie można bezpiecznie usunąć faktury — nie udało się sprawdzić historii płatności.');return}
  }
  if(linkedPayments.length){
   onAlert?.('Nie można usunąć faktury, która ma zarejestrowane płatności. Najpierw usuń jej płatności z historii rozliczenia.')
   return
  }
  if(!(await onConfirm?.('Usunąć fakturę '+x.invoiceNumber+'?')))return
  try{await deleteInvoice(x.id);window.dispatchEvent(new CustomEvent('aeroinstal-invoices-changed',{detail:{deletedId:x.id}}))}
  catch(e){console.error(e);onAlert?.('Nie udało się usunąć faktury.')}
 }

 if(preview){
  const a=amounts(preview.items)
  const buyer=cm.get(String(preview.clientId))
  const seller=company
  const paid=Number(preview.paidAmount||0)
  const vatSettled=Number(preview.vatSettledAmount||0)
  const remaining=Math.max(0,a.gross-paid-vatSettled)
  return <div className="invoice-preview-shell">
   <div className="invoice-preview-toolbar">
    <button type="button" className="invoice-preview-close" onClick={()=>setPreview(null)}>← Wróć do edycji</button>
    <div className="invoice-preview-toolbar-title">Podgląd faktury</div>
    <button type="button" className="invoice-preview-print" onClick={()=>window.print()}>Drukuj / PDF</button>
   </div>
   <div className="invoice-preview-paper">
    <div className="invoice-document-head">
     <img src={logo} alt="Aeroinstal" className="invoice-document-logo"/>
     <div className="invoice-document-title">
      <div className="invoice-document-type">FAKTURA</div>
      <strong>{preview.invoiceNumber||'NOWA'}</strong>
     </div>
    </div>
    <div className="invoice-document-meta">
     <div><span>Data wystawienia</span><strong>{formatDate(preview.issueDate)}</strong></div>
     <div><span>Data sprzedaży</span><strong>{formatDate(preview.saleDate||preview.issueDate)}</strong></div>
     <div><span>Termin płatności</span><strong>{formatDate(preview.dueDate)}</strong></div>
     <div><span>Sposób płatności</span><strong>{preview.paymentMethod||'Przelew'}</strong></div>
    </div>
    <div className="invoice-document-parties">
     <div><span className="invoice-document-label">SPRZEDAWCA</span><strong>{seller.name||'AEROINSTAL ŁUKASZ DYSZKANT'}</strong><p>NIP: {seller.nip||'5833105866'}</p><p>{seller.address||'ul. Cicha 4A/9, 83-000 Pruszcz Gdański'}</p>{seller.email&&<p>{seller.email}</p>}</div>
     <div><span className="invoice-document-label">NABYWCA</span><strong>{buyer?.name||buyer?.shortName||'—'}</strong>{buyer?.nip&&<p>NIP: {buyer.nip}</p>}{buyer?.address&&<p>{buyer.address}</p>}{buyer?.email&&<p>{buyer.email}</p>}</div>
    </div>
    <div className="invoice-document-table">
     <div className="invoice-document-table-head"><span>Lp.</span><span>Nazwa towaru / usługi</span><span>Ilość</span><span>J.m.</span><span>Cena netto</span><span>VAT</span><span>Wartość netto</span><span>Wartość brutto</span></div>
     {(preview.items||[]).map((x,i)=>{const net=Number(x.quantity||0)*Number(x.netUnit||0),gross=net*(1+Number(x.vatRate||0)/100);return <div className="invoice-document-table-row" key={i}><span>{i+1}</span><span>{x.name||'—'}</span><span>{x.quantity??0}</span><span>{x.unit||'szt.'}</span><span>{money(net/Math.max(1,Number(x.quantity||0)))}</span><span>{Number(x.vatRate||0)}%</span><span>{money(net)}</span><span>{money(gross)}</span></div>})}
    </div>
    <div className="invoice-document-summary">
     <div className="invoice-document-summary-vat"><div><span>Razem netto</span><strong>{money(a.net)}</strong></div><div><span>VAT</span><strong>{money(a.vat)}</strong></div></div>
     <div className="invoice-document-total"><span>DO ZAPŁATY</span><strong>{money(a.gross)}</strong></div>
    </div>
    <div className="invoice-document-amount-words"><span>Kwota słownie</span><strong>{polishAmountInWords(a.gross)}</strong></div>
    <div className="invoice-document-payment">
     <div><span>Do zapłaty</span><strong>{money(remaining)}</strong></div>
     <div><span>Waluta</span><strong>{preview.currency||'PLN'}</strong></div>
     <div><span>Rachunek bankowy</span><strong>{seller.bankAccount||'—'}</strong></div>
     <div><span>Status</span><strong>{paymentStatus(preview)}</strong></div>
    </div>
    {preview.notes&&<div className="invoice-document-notes"><span>UWAGI</span><p>{preview.notes}</p></div>}
    <div className="invoice-document-signatures"><div>Osoba wystawiająca fakturę</div><div>Odbiorca / osoba upoważniona</div></div>
    <div className="invoice-document-footer">{seller.name||'AEROINSTAL ŁUKASZ DYSZKANT'} · NIP {seller.nip||'5833105866'}</div>
   </div>
  </div>
 }

 if(edit){
  const a=amounts(edit.items)
  const client=cm.get(String(edit.clientId))
  const paid=Number(edit.paidAmount||0)
  const vatSettled=Number(edit.vatSettledAmount||0)
  const remaining=Math.max(0,a.gross-paid-vatSettled)

  return <div className="invoice-editor-page">
   <div className="invoice-editor-top">
    <button type="button" className="invoice-back-button" onClick={()=>setEdit(null)}>←</button>
    <div><div className="small-label">AEROINSTAL</div><h1>{edit.id?'Edytuj fakturę':'Nowa faktura'}</h1></div>
    <div className="invoice-editor-number">{edit.invoiceNumber||'NOWA'}</div>
   </div>

   <div className="invoice-editor-card">
    <div className="invoice-editor-section">
     <div className="invoice-editor-section-title">Faktura</div>
     <div className="invoice-editor-grid invoice-editor-grid-2">
      <label className="invoice-field"><span>Numer faktury</span><input value={edit.invoiceNumber||''} placeholder="Zostanie nadany automatycznie" onChange={e=>setEdit({...edit,invoiceNumber:e.target.value})} disabled={!edit.id}/></label>
      <label className="invoice-field"><span>Status</span><select value={edit.status||'Do wystawienia'} onChange={e=>setEdit({...edit,status:e.target.value})}>{['Do wystawienia','Wystawiona','Wysłana do KSeF','Błąd KSeF'].map(s=><option key={s}>{s}</option>)}</select></label>
      <label className="invoice-field"><span>Data wystawienia</span><input type="date" value={edit.issueDate||''} onChange={e=>setEdit({...edit,issueDate:e.target.value})}/></label>
      <label className="invoice-field"><span>Data sprzedaży</span><input type="date" value={edit.saleDate||''} onChange={e=>setEdit({...edit,saleDate:e.target.value})}/></label>
      <label className="invoice-field"><span>Termin płatności</span><input type="date" value={edit.dueDate||''} onChange={e=>setEdit({...edit,dueDate:e.target.value})}/></label>
      <label className="invoice-field"><span>Sposób płatności</span><select value={edit.paymentMethod||'Przelew'} onChange={e=>setEdit({...edit,paymentMethod:e.target.value})}>{['Przelew','Gotówka','Karta','Kompensata'].map(s=><option key={s}>{s}</option>)}</select></label>
     </div>
    </div>

    <div className="invoice-editor-parties">
     <div className="invoice-party">
      <div className="invoice-party-label">Sprzedawca</div>
      <strong>{company.name||'AEROINSTAL ŁUKASZ DYSZKANT'}</strong>
      <span>NIP: {company.nip||'5833105866'}</span>
      <span>{company.address||'ul. Cicha 4A/9, 83-000 Pruszcz Gdański'}</span>
      {company.email&&<span>{company.email}</span>}
     </div>
     <div className="invoice-party invoice-party-buyer">
      <div className="invoice-party-label">Nabywca</div>
      <select value={edit.clientId||''} onChange={e=>{const c=cm.get(e.target.value);setEdit({...edit,clientId:e.target.value})}}>
       <option value="">Wybierz klienta</option>
       {clients.map(c=><option key={c.id} value={c.id}>{c.shortName||c.name}</option>)}
      </select>
      {client&&<><strong>{client.name}</strong>{client.nip&&<span>NIP: {client.nip}</span>}{client.address&&<span>{client.address}</span>}{client.email&&<span>{client.email}</span>}</>}
     </div>
    </div>

    <div className="invoice-editor-section">
     <div className="invoice-editor-section-head"><div className="invoice-editor-section-title">Realizacja</div></div>
     <select className="invoice-editor-full-select" value={edit.jobId||''} disabled={edit.id&&payments.some(p=>String(p.invoiceId||'')===String(edit.id))} onChange={e=>{const hasPayments=payments.some(p=>String(p.invoiceId||'')===String(edit.id));if(hasPayments){onAlert?.('Nie można zmienić realizacji faktury, która ma zarejestrowane płatności.');return}const j=jm.get(e.target.value);const it=items(j);recalc(it,{jobId:e.target.value,clientId:j?.clientId||edit.clientId})}}>
      <option value="">Bez powiązania z realizacją</option>
      {jobs.map(j=><option key={j.id} value={j.id}>{j.name||'Bez nazwy'}{j.location?' • '+j.location:''}</option>)}
     </select>
    </div>

    <div className="invoice-editor-section">
     <div className="invoice-editor-section-head">
      <div><div className="invoice-editor-section-title">Pozycje na fakturze</div><div className="invoice-editor-muted">Ceny netto · VAT według pozycji</div></div>
      <button type="button" className="invoice-add-button" onClick={()=>recalc([...(edit.items||[]),blankItem()])}>+ Nowa pozycja</button>
     </div>
     <div className="invoice-items-table">
      <div className="invoice-items-head"><span>Opis</span><span>Ilość</span><span>J.m.</span><span>Cena netto</span><span>VAT</span><span>Wartość netto</span><span>Wartość brutto</span><span></span></div>
      {(edit.items||[]).map((x,i)=>{
       const lineNet=Number(x.quantity||0)*Number(x.netUnit||0)
       const lineGross=lineNet*(1+Number(x.vatRate||0)/100)
       return <div className="invoice-item-row" key={i}>
        <input value={x.name||''} placeholder="Nazwa usługi / towaru" onChange={e=>{const it=[...edit.items];it[i]={...it[i],name:e.target.value};setEdit({...edit,items:it})}}/>
        <input type="number" min="0" step="0.01" value={x.quantity??0} onChange={e=>{const it=[...edit.items];it[i]={...it[i],quantity:Number(e.target.value)};recalc(it)}}/>
        <select value={x.unit||'szt.'} onChange={e=>{const it=[...edit.items];it[i]={...it[i],unit:e.target.value};setEdit({...edit,items:it})}}>{['szt.','usł.','mb','m²','kg','godz.'].map(u=><option key={u}>{u}</option>)}</select>
        <input type="number" min="0" step="0.01" value={x.netUnit??0} onChange={e=>{const it=[...edit.items];it[i]={...it[i],netUnit:Number(e.target.value)};recalc(it)}}/>
        <select value={x.vatRate??23} onChange={e=>{const it=[...edit.items];it[i]={...it[i],vatRate:Number(e.target.value)};recalc(it)}}>{[23,8,5,0].map(v=><option key={v} value={v}>{v}%</option>)}</select>
        <strong>{money(lineNet)}</strong>
        <strong>{money(lineGross)}</strong>
        <button type="button" className="invoice-remove-item" onClick={()=>recalc((edit.items||[]).filter((_,idx)=>idx!==i))}>×</button>
       </div>
      })}
     </div>
     <div className="invoice-totals">
      <div><span>Netto</span><strong>{money(a.net)}</strong></div>
      <div><span>VAT</span><strong>{money(a.vat)}</strong></div>
      <div><span>Brutto</span><strong>{money(a.gross)}</strong></div>
      <div className="invoice-total-main"><span>Do zapłaty</span><strong>{money(a.gross)}</strong></div>
     </div>
    </div>

    <div className="invoice-editor-finance-grid">
     <div className="invoice-editor-section invoice-payment-card">
      <div className="invoice-editor-section-title">Rozliczenie</div>
      <div className="invoice-finance-row"><span>Zapłacono</span><strong>{money(paid)}</strong></div>
      <label className="invoice-field"><span>VAT zapłacony wcześniej</span><input type="number" min="0" max={a.vat} step="0.01" value={vatSettled} onChange={e=>setEdit({...edit,vatSettledAmount:Math.max(0,Math.min(a.vat,Number(e.target.value)||0))})}/></label>
      <div className="invoice-finance-note">VAT rozliczony wcześniej zmniejsza należność, ale nie tworzy płatności klienta.</div>
      <div className="invoice-remaining-box"><span>Pozostało do zapłaty</span><strong>{money(remaining)}</strong></div>
      <div className="invoice-payment-history">
       <div className="invoice-editor-section-title">Historia płatności</div>
       {payments.filter(p=>edit.id?String(p.invoiceId||'')===String(edit.id):!p.invoiceId).length===0
        ? <div className="invoice-finance-note">Brak płatności przypisanych do tej faktury.</div>
        : payments.filter(p=>edit.id?String(p.invoiceId||'')===String(edit.id):!p.invoiceId).map(p=>
          <div className="invoice-payment-history-row" key={p.id}>
           <div><strong>{money(p.amount)}</strong><span>{formatDate(p.paidAt)}{p.note?' · '+p.note:''}</span></div>
           <button type="button" className="invoice-remove-item" onClick={()=>removePayment(p)}>×</button>
          </div>
         )}
      </div>
      {edit.id&&edit.jobId&&Number(edit.grossAmount||0)-Number(edit.paidAmount||0)-Number(edit.vatSettledAmount||0)>0.01&&
       <div className="invoice-add-payment">
        <div className="invoice-editor-section-title">Dodaj płatność</div>
        <div className="invoice-payment-form">
         <input type="number" min="0.01" step="0.01" placeholder="Kwota" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})}/>
         <input type="date" value={paymentForm.paidAt} onChange={e=>setPaymentForm({...paymentForm,paidAt:e.target.value})}/>
         <input type="text" placeholder="Opis płatności (opcjonalnie)" value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm,note:e.target.value})}/>
         <button type="button" className="invoice-save-button" disabled={paymentSaving} onClick={addPayment}>{paymentSaving?'Zapisywanie…':'+ Dodaj płatność'}</button>
        </div>
       </div>}
     </div>
     <div className="invoice-editor-section">
      <div className="invoice-editor-section-title">Uwagi</div>
      <textarea className="invoice-notes-area" rows="8" placeholder="Dodatkowe informacje na fakturze…" value={edit.notes||''} onChange={e=>setEdit({...edit,notes:e.target.value})}/>
     </div>
    </div>

    <div className="invoice-editor-actions">
     <button type="button" className="invoice-cancel-button" onClick={()=>setEdit(null)}>Anuluj</button>
     <button type="button" className="invoice-preview-button" onClick={()=>setPreview({...edit,items:Array.isArray(edit.items)?edit.items:[]})}>👁 Podgląd</button>
     <button type="button" className="invoice-save-button" disabled={saving} onClick={save}>{saving?'Zapisywanie…':'💾 Zapisz fakturę'}</button>
    </div>
   </div>
  </div>
 }

 const list=invoices.filter(x=>{
  const c=cm.get(String(x.clientId)),j=jm.get(String(x.jobId)),ps=paymentStatus(x)
  const t=[x.invoiceNumber,c?.shortName,c?.name,j?.name,x.status,ps].join(' ').toLowerCase()
  return(!query||t.includes(query.toLowerCase()))&&(filter==='all'||x.status===filter||ps===filter)
 })

 return <div className="sub-page">
  <div className="page-heading"><div><div className="small-label">AEROINSTAL</div><h1>Faktury</h1></div><button type="button" onClick={()=>open()} style={{minHeight:44,padding:'0 14px',border:0,borderRadius:12,background:'#168fe5',color:'#fff',fontWeight:800}}>+ Nowa faktura</button></div>
  <div className="dashboard-grid">{[['Wszystkie',invoices.length],['Do wystawienia',invoices.filter(x=>x.status==='Do wystawienia').length],['Wystawione',invoices.filter(x=>x.status==='Wystawiona').length],['Zapłacone',invoices.filter(x=>paymentStatus(x)==='Zapłacona').length]].map(([l,v])=><div className="dashboard-card" key={l}><div className="dashboard-icon">🧾</div><div><span>{l}</span><strong>{v}</strong></div></div>)}</div>
  <div className="detail-card invoice-list-tools"><input placeholder="Szukaj faktury, klienta lub realizacji…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="invoice-filter-row">{['all','Do wystawienia','Wystawiona','Częściowo zapłacona','Zapłacona','Przeterminowana','Wysłana do KSeF','Błąd KSeF'].map(x=><button type="button" key={x} onClick={()=>setFilter(x)} className={filter===x?'active':''}>{x==='all'?'Wszystkie':x}</button>)}</div></div>
  <div style={{display:'grid',gap:9}}>{list.map(x=>{const c=cm.get(String(x.clientId)),j=jm.get(String(x.jobId));return <div key={x.id} className="detail-card invoice-list-card"><button type="button" className="invoice-list-main" onClick={()=>setEdit({...x,items:Array.isArray(x.items)?x.items:[]})}><div><strong>{x.invoiceNumber}</strong><span>{c?.shortName||c?.name||'Brak klienta'}{j?.name?' • '+j.name:''}</span><small>Wystawiona: {formatDate(x.issueDate)} · Termin: {formatDate(x.dueDate)} · {paymentStatus(x)}</small></div><strong>{money(x.grossAmount)}</strong></button><button type="button" onClick={()=>remove(x)} className="invoice-list-delete">Usuń</button></div>})}</div>
  {list.length===0&&<div className="detail-card" style={{textAlign:'center',color:'#718096'}}>Brak faktur.</div>}
 </div>
}
