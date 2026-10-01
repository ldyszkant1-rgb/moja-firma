import React,{useEffect,useMemo,useState} from 'react'
import {createInvoice,updateInvoice,deleteInvoice} from './lib/invoicesApi'

const money=v=>Number(v||0).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł'
const today=()=>new Date().toISOString().slice(0,10)
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)}
const formatDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}):'—'
const total=j=>{const q=j?.quantities||{},r=j?.rates||{};return Number(q.mb||0)*Number(r.mb||0)+Number(q.m2||0)*Number(r.m2||0)+Number(q.kg||0)*Number(r.kg||0)}
const items=j=>{if(!j)return[];const q=j.quantities||{},r=j.rates||{};return[['Prace wentylacyjne – mb',q.mb,r.mb,'mb'],['Prace wentylacyjne – m²',q.m2,r.m2,'m²'],['Prace wentylacyjne – kg',q.kg,r.kg,'kg']].filter(x=>Number(x[1]||0)>0&&Number(x[2]||0)>0).map(x=>({name:x[0],quantity:Number(x[1]),netUnit:Number(x[2]),unit:x[3],vatRate:23}))}
const amounts=it=>(it||[]).reduce((a,x)=>{const net=Number(x.quantity||0)*Number(x.netUnit||0),vat=net*Number(x.vatRate||0)/100;a.net+=net;a.vat+=vat;a.gross+=net+vat;return a},{net:0,vat:0,gross:0})
const blankItem=()=>({name:'',quantity:1,netUnit:0,unit:'szt.',vatRate:23})

export default function InvoicesPage({invoices=[],jobs=[],clients=[],settings={},prefillJobId=null,openInvoiceId=null,onPrefillConsumed,onOpenConsumed,onAlert,onConfirm}){
 const [edit,setEdit]=useState(null),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[saving,setSaving]=useState(false)
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

 useEffect(()=>{if(!prefillJobId||edit)return;const j=jm.get(String(prefillJobId));if(!j)return;open(j);onPrefillConsumed?.()},[prefillJobId,jm,edit])
 useEffect(()=>{if(!openInvoiceId||edit)return;const inv=invoices.find(x=>String(x.id)===String(openInvoiceId));if(!inv)return;setEdit({...inv,items:Array.isArray(inv.items)?inv.items:[]});onOpenConsumed?.()},[openInvoiceId,invoices,edit])

 const recalc=(nextItems,patch={})=>{
  const a=amounts(nextItems)
  setEdit(prev=>({...prev,...patch,items:nextItems,netAmount:a.net,vatAmount:a.vat,grossAmount:a.gross,vatSettledAmount:Math.min(Number(prev?.vatSettledAmount||0),a.vat)}))
 }

 const save=async()=>{
  if(!edit.clientId){onAlert?.('Wybierz klienta.');return}
  if(!edit.items?.length){onAlert?.('Dodaj co najmniej jedną pozycję.');return}
  setSaving(true)
  try{
   const vatLimit=Math.max(0,Number(edit.vatAmount||0))
   const normalizedEdit={...edit,vatSettledAmount:Math.min(Math.max(0,Number(edit.vatSettledAmount||0)),vatLimit)}
   const x=edit.id?await updateInvoice(normalizedEdit):await createInvoice(normalizedEdit)
   setEdit(null)
   window.dispatchEvent(new CustomEvent('aeroinstal-invoices-changed',{detail:x}))
   onAlert?.('Faktura została zapisana.')
  }catch(e){console.error(e);onAlert?.('Nie udało się zapisać faktury.')}finally{setSaving(false)}
 }

 const remove=async x=>{
  const hasPayments=Number(x?.paidAmount||0)>0
  const warning=hasPayments?' Faktura ma już zarejestrowane wpłaty — usunięcie faktury nie usunie historii wpłat przypisanych do realizacji.':''
  if(!(await onConfirm?.('Usunąć fakturę '+x.invoiceNumber+'?'+warning)))return
  try{await deleteInvoice(x.id);window.dispatchEvent(new CustomEvent('aeroinstal-invoices-changed',{detail:{deletedId:x.id}}))}
  catch(e){console.error(e);onAlert?.('Nie udało się usunąć faktury.')}
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
     <select className="invoice-editor-full-select" value={edit.jobId||''} onChange={e=>{const j=jm.get(e.target.value);const it=items(j);recalc(it,{jobId:e.target.value,clientId:j?.clientId||edit.clientId})}}>
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
      <div className="invoice-items-head"><span>Opis</span><span>Ilość</span><span>J.m.</span><span>Cena netto</span><span>VAT</span><span>Wartość netto</span><span></span></div>
      {(edit.items||[]).map((x,i)=>{
       const lineNet=Number(x.quantity||0)*Number(x.netUnit||0)
       return <div className="invoice-item-row" key={i}>
        <input value={x.name||''} placeholder="Nazwa usługi / towaru" onChange={e=>{const it=[...edit.items];it[i]={...it[i],name:e.target.value};setEdit({...edit,items:it})}}/>
        <input type="number" min="0" step="0.01" value={x.quantity??0} onChange={e=>{const it=[...edit.items];it[i]={...it[i],quantity:Number(e.target.value)};recalc(it)}}/>
        <select value={x.unit||'szt.'} onChange={e=>{const it=[...edit.items];it[i]={...it[i],unit:e.target.value};setEdit({...edit,items:it})}}>{['szt.','usł.','mb','m²','kg','godz.'].map(u=><option key={u}>{u}</option>)}</select>
        <input type="number" min="0" step="0.01" value={x.netUnit??0} onChange={e=>{const it=[...edit.items];it[i]={...it[i],netUnit:Number(e.target.value)};recalc(it)}}/>
        <select value={x.vatRate??23} onChange={e=>{const it=[...edit.items];it[i]={...it[i],vatRate:Number(e.target.value)};recalc(it)}}>{[23,8,5,0].map(v=><option key={v} value={v}>{v}%</option>)}</select>
        <strong>{money(lineNet)}</strong>
        <button type="button" className="invoice-remove-item" onClick={()=>recalc((edit.items||[]).filter((_,idx)=>idx!==i))}>×</button>
       </div>
      })}
     </div>
     <div className="invoice-totals">
      <div><span>Netto</span><strong>{money(a.net)}</strong></div>
      <div><span>VAT</span><strong>{money(a.vat)}</strong></div>
      <div className="invoice-total-main"><span>Do zapłaty</span><strong>{money(a.gross)}</strong></div>
     </div>
    </div>

    <div className="invoice-editor-finance-grid">
     <div className="invoice-editor-section invoice-payment-card">
      <div className="invoice-editor-section-title">Rozliczenie</div>
      <div className="invoice-finance-row"><span>Zapłacono z płatności realizacji</span><strong>{money(paid)}</strong></div>
      <label className="invoice-field"><span>VAT zapłacony wcześniej</span><input type="number" min="0" max={a.vat} step="0.01" value={vatSettled} onChange={e=>setEdit({...edit,vatSettledAmount:Math.max(0,Math.min(a.vat,Number(e.target.value)||0))})}/></label>
      <div className="invoice-finance-note">Ta kwota zmniejsza należność kontrahenta, ale nie tworzy sztucznej wpłaty w historii płatności.</div>
      <div className="invoice-remaining-box"><span>Pozostało do zapłaty</span><strong>{money(remaining)}</strong></div>
     </div>
     <div className="invoice-editor-section">
      <div className="invoice-editor-section-title">Uwagi</div>
      <textarea className="invoice-notes-area" rows="8" placeholder="Dodatkowe informacje na fakturze…" value={edit.notes||''} onChange={e=>setEdit({...edit,notes:e.target.value})}/>
     </div>
    </div>

    <div className="invoice-editor-actions">
     <button type="button" className="invoice-cancel-button" onClick={()=>setEdit(null)}>Anuluj</button>
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
