import React, { useEffect, useRef, useState } from 'react'
import './App.css'
import AuthPage from './AuthPage'
import logo from './assets/logo.png'
import ClientsPage from './ClientsPage'
import OffersPage from './OffersPage'
import InvoicesPage from './InvoicesPage'
import JobDocuments from './JobDocuments'
import { getOffers, createOffer, updateOffer, deleteOffer, subscribeToOffers } from './lib/offersApi'
import { getClients, subscribeToClients } from './lib/clientsApi'
import {
  createSupabaseJob,
  updateSupabaseJob,
  getJobs,
  uploadSupabaseFile,
  deleteSupabaseFile,
  appendSupabaseJobPhoto,
  appendSupabaseJobNote,
  updateSupabaseJobNote,
  deleteSupabaseJobNote,
  getDeletedJobs,
  softDeleteSupabaseJob,
  restoreSupabaseJob,
  hardDeleteSupabaseJob,
} from './lib/jobsApi'
import {
  getJobCosts,
  createJobCost,
  updateJobCost,
  deleteJobCost,
} from './lib/jobCostsApi'
import {
  getFinance,
  createFinance,
  updateFinance,
  deleteFinance,
  subscribeToFinance,
} from './lib/financeApi'
import {
  getJobPayments,
  getAllJobPayments,
  createJobPayment,
  deleteJobPayment,
  subscribeToJobPayments,
  calculatePaidAmount,
} from './lib/jobPaymentsApi'
import {
  getPartnerSettlements,
  savePartnerSettlement,
  getPartnerTransfers,
  createPartnerTransfer,
  deletePartnerTransfer,
  subscribeToPartnerSettlements,
} from './lib/partnerSettlementApi'
import { supabase } from './lib/supabase'
import { getInvoices, subscribeToInvoices } from './lib/invoicesApi'
import {
  DEVICE_USERS,
  getOrCreateDeviceId,
  getLocalDeviceUser,
  saveLocalDeviceUser,
  isAnonymousSession,
  ensureLegacyAnonymousSession,
  claimDeviceInSupabase,
} from './lib/deviceAuth'


/* =====================================================
   LICZBY DZIESIĘTNE
   ===================================================== */

function parseDecimal(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 0

  let normalized = String(value).trim().replace(/\s/g, '')

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = normalized.replace(',', '.')
  }

  const number = Number(normalized)
  return Number.isFinite(number) ? number : 0
}


/* =====================================================
   DANE STARTOWE
   ===================================================== */

const defaultJobs = [
  {
    id: 1,
    name: 'K6',
    location: 'Statek X',
    progress: 65,
    completed: false,
    completedAt: null,

    quantities: {
      mb: 300,
      m2: 20,
      kg: 0,
    },

    rates: {
      mb: 100,
      m2: 220,
      kg: 0,
    },

    documents: {
      material: null,
      assembly: null,
    },

    notes: [],
    photos: [],
    mainPhoto: null,
  },

  {
    id: 2,
    name: 'K8',
    location: 'Statek Y',
    progress: 40,
    completed: false,
    completedAt: null,

    quantities: {
      mb: 180,
      m2: 12,
      kg: 0,
    },

    rates: {
      mb: 100,
      m2: 220,
      kg: 0,
    },

    documents: {
      material: null,
      assembly: null,
    },

    notes: [],
    photos: [],
    mainPhoto: null,
  },

  {
    id: 3,
    name: 'K10',
    location: 'Hala montażowa',
    progress: 15,
    completed: false,
    completedAt: null,

    quantities: {
      mb: 120,
      m2: 0,
      kg: 0,
    },

    rates: {
      mb: 100,
      m2: 220,
      kg: 0,
    },

    documents: {
      material: null,
      assembly: null,
    },

    notes: [],
    photos: [],
    mainPhoto: null,
  },

  {
    id: 4,
    name: 'K12',
    location: 'Statek Z',
    progress: 100,
    completed: true,
    completedAt: '2026-09-05',

    quantities: {
      mb: 250,
      m2: 30,
      kg: 0,
    },

    rates: {
      mb: 100,
      m2: 220,
      kg: 0,
    },

    documents: {
      material: null,
      assembly: null,
    },

    notes: [],
    photos: [],
    mainPhoto: null,
  },
]


/* =====================================================
   WŁASNE KOMUNIKATY / POTWIERDZENIA
   Zastępują brzydkie komunikaty przeglądarki.
   ===================================================== */

let appDialogResolver = null

function normalizeDialogMessage(message) {
  return String(message ?? '').replace(/\\n/g, '\n')
}

function openAppDialog(config) {
  if (appDialogResolver) {
    appDialogResolver(config.type === 'confirm' ? false : null)
    appDialogResolver = null
  }

  return new Promise((resolve) => {
    appDialogResolver = resolve

    window.dispatchEvent(
      new CustomEvent('aeroinstal-app-dialog', {
        detail: config,
      })
    )
  })
}

function showCustomAlert(message) {
  return openAppDialog({
    type: 'alert',
    title: 'Komunikat',
    message: normalizeDialogMessage(message),
  })
}

function showCustomConfirm(message) {
  return openAppDialog({
    type: 'confirm',
    title: 'Potwierdzenie',
    message: normalizeDialogMessage(message),
  })
}

function showCustomPrompt(message, defaultValue = '') {
  return openAppDialog({
    type: 'prompt',
    title: 'Edytuj nazwę',
    message: normalizeDialogMessage(message),
    defaultValue: defaultValue ?? '',
  })
}

function AppDialogHost() {
  const [dialog, setDialog] = useState(null)
  const [promptValue, setPromptValue] = useState('')

  useEffect(() => {
    const handleDialog = (event) => {
      const nextDialog = event.detail
      if (!nextDialog) return

      setPromptValue(nextDialog.defaultValue || '')
      setDialog(nextDialog)
    }

    window.addEventListener(
      'aeroinstal-app-dialog',
      handleDialog
    )

    return () => {
      window.removeEventListener(
        'aeroinstal-app-dialog',
        handleDialog
      )
    }
  }, [])

  if (!dialog) {
    return null
  }

  const finish = (value) => {
    const resolver = appDialogResolver
    appDialogResolver = null
    setDialog(null)

    if (resolver) {
      resolver(value)
    }
  }

  const isConfirm = dialog.type === 'confirm'
  const isPrompt = dialog.type === 'prompt'

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && isConfirm) {
          finish(false)
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(8, 23, 48, 0.48)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        style={{
          width: '100%',
          maxWidth: '430px',
          background: '#ffffff',
          borderRadius: '26px',
          boxShadow: '0 24px 70px rgba(0, 25, 60, 0.28)',
          overflow: 'hidden',
          border: '1px solid rgba(15, 48, 90, 0.08)',
        }}
      >
        <div style={{ padding: '26px 24px 20px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isConfirm
                ? '#fff4df'
                : isPrompt
                  ? '#eaf5ff'
                  : '#eaf7f0',
              fontSize: '25px',
              marginBottom: '16px',
            }}
          >
            {isConfirm ? '⚠️' : isPrompt ? '✏️' : '✓'}
          </div>

          <div
            id="app-dialog-title"
            style={{
              color: '#12234f',
              fontSize: '23px',
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: '10px',
            }}
          >
            {dialog.title}
          </div>

          <div
            style={{
              color: '#64748b',
              fontSize: '16px',
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
            }}
          >
            {dialog.message}
          </div>

          {isPrompt && (
            <input
              autoFocus
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  finish(promptValue.trim())
                }
                if (event.key === 'Escape') {
                  finish(null)
                }
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                marginTop: '18px',
                padding: '14px 16px',
                borderRadius: '14px',
                border: '1px solid #d7e1eb',
                outline: 'none',
                fontSize: '16px',
                color: '#12234f',
                background: '#f8fbfe',
              }}
            />
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isConfirm || isPrompt ? '1fr 1fr' : '1fr',
            gap: '10px',
            padding: '0 24px 24px',
          }}
        >
          {isConfirm && (
            <button
              type="button"
              onClick={() => finish(false)}
              style={{
                minHeight: '50px',
                borderRadius: '15px',
                border: '1px solid #d7e1eb',
                background: '#f5f8fb',
                color: '#526174',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Anuluj
            </button>
          )}

          {isPrompt && (
            <button
              type="button"
              onClick={() => finish(null)}
              style={{
                minHeight: '50px',
                borderRadius: '15px',
                border: '1px solid #d7e1eb',
                background: '#f5f8fb',
                color: '#526174',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Anuluj
            </button>
          )}

          <button
            type="button"
            autoFocus={!isPrompt}
            onClick={() =>
              finish(
                isConfirm
                  ? true
                  : isPrompt
                    ? promptValue.trim()
                    : true
              )
            }
            style={{
              minHeight: '50px',
              borderRadius: '15px',
              border: 'none',
              background: isConfirm ? '#dc3545' : '#168fe5',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {isConfirm ? 'Usuń' : isPrompt ? 'Zapisz' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}


/* =====================================================
   APP
   ===================================================== */

class JobsErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Błąd zakładki Realizacje:', error, info)
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || String(this.state.error)
      return (
        <div className="sub-page" style={{ padding: '24px 16px 140px' }}>
          <div className="detail-card" style={{ border: '1px solid #f0caca', background: '#fff8f8' }}>
            <div className="small-label" style={{ color: '#c43d3d' }}>BŁĄD ZAKŁADKI REALIZACJE</div>
            <h2 style={{ marginTop: '8px', color: '#12234f' }}>Aplikacja napotkała błąd</h2>
            <p style={{ color: '#657491', lineHeight: 1.5 }}>Zamiast białego ekranu pokazuję teraz dokładny komunikat.</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#ffffff', border: '1px solid #eadede', borderRadius: '12px', padding: '12px', color: '#8b2525', fontSize: '12px' }}>{message}</pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {

  const [deviceId] = useState(() => getOrCreateDeviceId())
  const [deviceUser, setDeviceUser] = useState(() => getLocalDeviceUser())
  const [deviceLoading, setDeviceLoading] = useState(true)
  const [deviceAuthError, setDeviceAuthError] = useState(null)
  const [authSession, setAuthSession] = useState(null)
  const [organizationMembers, setOrganizationMembers] = useState([])
  const [authChecked, setAuthChecked] = useState(false)
  const [authOrganizationId, setAuthOrganizationId] = useState(null)
  const [authOrganizationChecked, setAuthOrganizationChecked] = useState(false)
  const [authRecovery, setAuthRecovery] = useState(false)

  // Dane aplikacji mogą być pobierane dopiero po zakończeniu weryfikacji
  // sesji oraz starego przypisania urządzenia. Wcześniej deviceUser może być
  // odczytany z localStorage, ale sesja Supabase nie jest jeszcze gotowa,
  // więc RLS zwróci pustą listę. To powodowało wyzerowanie Start/Realizacje.
  const dataAccessReady =
    authChecked &&
    authOrganizationChecked &&
    (
      Boolean(authSession) ||
      (!deviceLoading && Boolean(deviceUser))
    )

  useEffect(() => {
    let mounted = true

    const applySession = async (session, recovery = false) => {
      const permanentSession = session && !isAnonymousSession(session) ? session : null

      setAuthSession(permanentSession)
      setAuthRecovery(recovery)
      setAuthChecked(true)

      if (!permanentSession) {
        setAuthOrganizationId(null)
        setAuthOrganizationChecked(true)
        return
      }

      const { data: membership, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .limit(1)
        .maybeSingle()

      if (!mounted) return

      if (error) {
        console.error('Nie udało się pobrać firmy użytkownika:', error)
      }

      setAuthOrganizationId(membership?.organization_id || null)
      setAuthOrganizationChecked(true)
    }

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return
        return applySession(data.session || null, false)
      })
      .catch((error) => {
        console.error('Nie udało się sprawdzić sesji logowania:', error)
        if (mounted) {
          setAuthSession(null)
          setAuthChecked(true)
          setAuthOrganizationId(null)
          setAuthOrganizationChecked(true)
        }
      })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      void applySession(session || null, _event === 'PASSWORD_RECOVERY')
    })

    return () => {
      mounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  const [activePage, setActivePage] =
    useState('start')

  const [clients, setClients] = useState([])

  const [offers, setOffers] = useState([])

  const [invoices, setInvoices] = useState([])
  const [invoiceJobToCreate, setInvoiceJobToCreate] = useState(null)
  const [invoiceToOpen, setInvoiceToOpen] = useState(null)

  // Płatności są potrzebne również na Dashboardzie. FinancePage ma własny stan,
  // ale Dashboard renderuje się bezpośrednio w App, więc pobieramy je tutaj.
  const [dashboardJobPayments, setDashboardJobPayments] = useState([])

  useEffect(() => {
    let cancelled = false

    const loadDashboardPayments = async () => {
      if (!dataAccessReady) return
      try {
        const remotePayments = await getAllJobPayments()
        if (!cancelled) {
          setDashboardJobPayments(Array.isArray(remotePayments) ? remotePayments : [])
        }
      } catch (error) {
        console.error('Nie udało się wczytać płatności dla Dashboardu:', error)
      }
    }

    loadDashboardPayments()

    return () => {
      cancelled = true
    }
  }, [dataAccessReady])

  useEffect(() => {
    let cancelled = false
    const loadOffers = async () => {
      try {
        const remoteOffers = await getOffers()
        if (!cancelled) setOffers(Array.isArray(remoteOffers) ? remoteOffers : [])
      } catch (error) {
        console.error('Nie udało się wczytać ofert:', error)
      }
    }
    if (!dataAccessReady) return () => { cancelled = true }
    loadOffers()
    const unsubscribe = subscribeToOffers((payload) => {
      if (payload.eventType === 'DELETE' && payload.old?.id) {
        setOffers((current) => current.filter((offer) => String(offer.id) !== String(payload.old.id)))
        return
      }
      if (!payload.new?.id) return
      getOffers().then((fresh) => setOffers(fresh)).catch((error) => console.error('Nie udało się odświeżyć ofert:', error))
    })
    return () => { cancelled = true; unsubscribe() }
  }, [dataAccessReady])

  useEffect(() => {
    let cancelled = false
    const loadInvoices = async () => {
      try {
        const remote = await getInvoices()
        if (!cancelled) setInvoices(Array.isArray(remote) ? remote : [])
      } catch (error) {
        console.error('Nie udało się wczytać faktur:', error)
      }
    }
    if (!dataAccessReady) return () => { cancelled = true }
    loadInvoices()
    const unsubscribe = subscribeToInvoices((payload) => {
      if (payload.eventType === 'DELETE' && payload.old?.id) {
        setInvoices((current) => current.filter((item) => String(item.id) !== String(payload.old.id)))
        return
      }
      loadInvoices()
    })
    const handleLocalChange = () => loadInvoices()
    window.addEventListener('aeroinstal-invoices-changed', handleLocalChange)
    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('aeroinstal-invoices-changed', handleLocalChange)
    }
  }, [dataAccessReady])

  const loadClients = async () => {
    try {
      const remoteClients = await getClients()
      setClients(Array.isArray(remoteClients) ? remoteClients : [])
    } catch (error) {
      console.error('Nie udało się wczytać klientów:', error)
    }
  }


  const [selectedJob, setSelectedJob] =
    useState(null)


  const [addingJob, setAddingJob] =
    useState(false)





  useEffect(() => {
    let cancelled = false

    const loadDeviceUser = async () => {
      const localUser = getLocalDeviceUser()

      try {
        if (!localUser || !DEVICE_USERS.includes(localUser)) {
          setDeviceUser(null)
          return
        }

        await ensureLegacyAnonymousSession()

        const assignedUser = await claimDeviceInSupabase(deviceId, localUser)

        if (cancelled) return

        saveLocalDeviceUser(assignedUser)
        setDeviceAuthError(null)
        setDeviceUser(assignedUser)

        // Po udanym przypisaniu urządzenia wymuś pierwszy odczyt Realizacji
        // z aktywną sesją Supabase. Nie czekamy tutaj na kolejność renderów
        // ani na zmianę flagi dataAccessReady — to eliminuje sytuację,
        // w której ekran Start/Realizacje zostaje pusty po pierwszym wejściu.
        try {
          const initialJobs = await getJobs()
          if (!cancelled && Array.isArray(initialJobs)) {
            setJobs(initialJobs)
          }
        } catch (jobsError) {
          console.error('Nie udało się od razu wczytać realizacji po autoryzacji:', jobsError)
        }

        // Nie przeładowujemy aplikacji po przypisaniu urządzenia.
        // Kolejny render uruchomi ładowanie danych dopiero po zakończeniu
        // deviceLoading, dzięki czemu RLS ma już właściwą sesję anonimową.
      } catch (error) {
        console.error('Nie udało się uwierzytelnić urządzenia Aeroinstal:', error)
        if (!cancelled) setDeviceAuthError(error?.message || 'Nie udało się zweryfikować tego urządzenia.')

        try {
          const { data } = await supabase.auth.getSession()
          if (isAnonymousSession(data?.session)) {
            await supabase.auth.signOut()
          }
        } catch (signOutError) {
          console.error('Nie udało się wyczyścić sesji urządzenia:', signOutError)
        }

        if (!cancelled) {
          setDeviceUser(null)
        }
      } finally {
        if (!cancelled) setDeviceLoading(false)
      }
    }

    loadDeviceUser()
    return () => { cancelled = true }
  }, [deviceId])

  const retryLegacyDeviceAuthentication = async () => {
    setDeviceAuthError(null)
    setDeviceLoading(true)
    try {
      const localUser = getLocalDeviceUser()
      if (!localUser) throw new Error('Brak zapisanego użytkownika starego urządzenia.')
      const assignedUser = await claimDeviceInSupabase(deviceId, localUser)
      saveLocalDeviceUser(assignedUser)
      setDeviceUser(assignedUser)
    } catch (error) {
      setDeviceAuthError(error?.message || 'Nie udało się zweryfikować tego urządzenia.')
    } finally {
      setDeviceLoading(false)
    }
  }

  const handleDeviceUserSelect = async (user) => {
    if (!DEVICE_USERS.includes(user) || !deviceId || deviceLoading) return

    try {
      setDeviceLoading(true)
      const assignedUser = await claimDeviceInSupabase(deviceId, user)

      if (!DEVICE_USERS.includes(assignedUser)) {
        throw new Error('Nieprawidłowe przypisanie użytkownika urządzenia.')
      }

      saveLocalDeviceUser(assignedUser)
      setDeviceUser(assignedUser)
    } catch (error) {
      console.error('Nie udało się przypisać urządzenia:', error)
      await showCustomAlert(
        error?.message
          ? `Nie udało się przypisać telefonu.\\n\\n${error.message}`
          : 'Nie udało się przypisać telefonu.'
      )
    } finally {
      setDeviceLoading(false)
    }
  }

  const [settings, setSettings] =
    useState(() => {

      try {
        const savedSettings =
          localStorage.getItem('moja_firma_settings') ||
          localStorage.getItem('aeroinstal_settings')
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings)
          return {
            users: {
              first: 'Łukasz',
              second: 'Paweł',
              active: deviceUser || '',
            },
            rates: parsed.rates || {
              mb: '100',
              m2: '220',
              kg: '',
            },
            company: {
              shortName: parsed.company?.shortName || '',
              name: parsed.company?.name || '',
              nip: parsed.company?.nip || '',
              regon: parsed.company?.regon || '',
              address: parsed.company?.address || '',
              email: parsed.company?.email || '',
              bankAccount: parsed.company?.bankAccount || '',
            },
            categories: parsed.categories || [
              { name: 'ZUS', enabled: true },
              { name: 'Podatek', enabled: true },
              { name: 'Inne', enabled: true },
            ],
          }
        }
      } catch (error) {
        console.error('Nie udało się wczytać ustawień:', error)
      }

      return {
        users: {
          first: 'Łukasz',
          second: 'Paweł',
          active: deviceUser || '',
        },
        rates: {
          mb: '100',
          m2: '220',
          kg: '',
        },
        company: {
          shortName: '',
          name: '',
          nip: '',
          regon: '',
          address: '',
          email: '',
          bankAccount: '',
        },
        categories: [
          { name: 'ZUS', enabled: true },
          { name: 'Podatek', enabled: true },
          { name: 'Inne', enabled: true },
        ],
      }
    })


  useEffect(() => {

    try {
      localStorage.setItem(
        'moja_firma_settings',
        JSON.stringify(settings)
      )
    } catch (error) {
      console.error('Nie udało się zapisać ustawień:', error)
    }

  }, [settings])


  useEffect(() => {
    let cancelled = false

    if (!dataAccessReady) return () => { cancelled = true }

    const load = async () => {
      try {
        const remoteClients = await getClients()
        if (!cancelled) setClients(Array.isArray(remoteClients) ? remoteClients : [])
      } catch (error) {
        console.error('Nie udało się wczytać klientów:', error)
      }
    }

    load()

    const unsubscribe = subscribeToClients((payload) => {
      if (payload.eventType === 'DELETE' && payload.old?.id) {
        setClients((current) => current.filter((client) => client.id !== payload.old.id))
        return
      }

      if (!payload.new?.id) return
      const incoming = {
        id: payload.new.id,
        name: payload.new.name || '',
        shortName: payload.new.short_name || payload.new.name || '',
        nip: payload.new.nip || '',
        address: payload.new.address || '',
        contactName: payload.new.contact_name || '',
        phone: payload.new.phone || '',
        email: payload.new.email || '',
        notes: payload.new.notes || '',
        organizationId: payload.new.organization_id || null,
        createdAt: payload.new.created_at || null,
        updatedAt: payload.new.updated_at || null,
      }

      setClients((current) => {
        const exists = current.some((client) => client.id === incoming.id)
        if (exists) return current.map((client) => client.id === incoming.id ? incoming : client)
        return [...current, incoming].sort((a, b) => a.name.localeCompare(b.name, 'pl'))
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [dataAccessReady])


  /*
   * Wczytanie robót.
   */

  /*
   * Realizacje są przechowywane wspólnie w Supabase.
   *
   * LocalStorage nie jest źródłem danych robót, ponieważ każdy
   * telefon/komputer ma własną pamięć lokalną. Korzystanie z niej
   * jako dodatkowego źródła powodowało różne listy robót na
   * urządzeniach oraz duplikaty.
   */
  const [jobs, setJobs] =
    useState([])

  const [deletedJobs, setDeletedJobs] =
    useState([])

  const [generalReminders, setGeneralReminders] =
    useState([])

  const [generalRemindersLoading, setGeneralRemindersLoading] =
    useState(true)


  /*
   * Wczytanie robót z Supabase po uruchomieniu aplikacji.
   *
   * Supabase jest jedynym źródłem prawdy dla listy robót.
   * Nie dokładamy żadnych starych lokalnych rekordów.
   */
  useEffect(() => {

    let cancelled = false
    if (!dataAccessReady) return () => { cancelled = true }

    const loadJobsFromSupabase = async () => {

      try {

        const remoteJobs = await getJobs()

        if (
          cancelled ||
          !Array.isArray(remoteJobs)
        ) {
          return
        }

        setJobs(remoteJobs)

        try {
          const remoteDeletedJobs = await getDeletedJobs()
          if (!cancelled) {
            setDeletedJobs(remoteDeletedJobs)
          }
        } catch (trashError) {
          console.error(
            'Nie udało się wczytać kosza z Supabase:',
            trashError
          )
        }

        console.log(
          'Realizacje wczytane z Supabase:',
          remoteJobs.length
        )

      } catch (error) {

        console.error(
          'Nie udało się wczytać robót z Supabase:',
          error
        )

      }

    }

    if (!dataAccessReady) return () => { cancelled = true }
    loadJobsFromSupabase()

    return () => {
      cancelled = true
    }

  }, [dataAccessReady])


  /*
   * Wczytanie ogólnych przypomnień z Supabase.
   */
  useEffect(() => {

    let cancelled = false

    const loadGeneralReminders = async () => {
      try {
        const { data, error } = await supabase
          .from('general_reminders')
          .select('*')
          .order('done', { ascending: true })
          .order('date', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false })

        if (error) throw error

        if (!cancelled) {
          setGeneralReminders(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('Nie udało się wczytać ogólnych przypomnień:', error)
      } finally {
        if (!cancelled) setGeneralRemindersLoading(false)
      }
    }

    if (!dataAccessReady) return () => { cancelled = true }
    loadGeneralReminders()

    const channel = supabase
      .channel('aeroinstal-general-reminders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'general_reminders',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id
            if (!deletedId) return
            setGeneralReminders((current) =>
              current.filter((item) => String(item.id) !== String(deletedId))
            )
            return
          }

          if (!payload.new?.id) return

          setGeneralReminders((current) => {
            const exists = current.some(
              (item) => String(item.id) === String(payload.new.id)
            )

            if (!exists) return [payload.new, ...current]

            return current.map((item) =>
              String(item.id) === String(payload.new.id)
                ? payload.new
                : item
            )
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [dataAccessReady])


  const addGeneralReminder = async ({ text, date }) => {
    const cleanText = String(text || '').trim()
    if (!cleanText) return

    const optimisticId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`

    const optimisticReminder = {
      id: optimisticId,
      text: cleanText,
      date: date || null,
      time: null,
      done: false,
      created_at: new Date().toISOString(),
    }

    setGeneralReminders((current) => [optimisticReminder, ...current])

    try {
      const { data, error } = await supabase
        .from('general_reminders')
        .insert({
          text: cleanText,
          date: date || null,
          done: false,
        })
        .select()
        .single()

      if (error) throw error

      setGeneralReminders((current) => [
        data,
        ...current.filter((item) => String(item.id) !== String(optimisticId)),
      ])
    } catch (error) {
      console.error('Nie udało się dodać przypomnienia:', error)
      setGeneralReminders((current) =>
        current.filter((item) => String(item.id) !== String(optimisticId))
      )
      showCustomAlert('Nie udało się dodać przypomnienia. Spróbuj ponownie.')
    }
  }


  const toggleGeneralReminder = async (reminder) => {
    const nextDone = !Boolean(reminder.done)

    setGeneralReminders((current) =>
      current.map((item) =>
        String(item.id) === String(reminder.id)
          ? { ...item, done: nextDone }
          : item
      )
    )

    try {
      const { data, error } = await supabase
        .from('general_reminders')
        .update({ done: nextDone })
        .eq('id', reminder.id)
        .select()
        .single()

      if (error) throw error

      setGeneralReminders((current) =>
        current.map((item) =>
          String(item.id) === String(reminder.id) ? data : item
        )
      )
    } catch (error) {
      console.error('Nie udało się zmienić przypomnienia:', error)
      setGeneralReminders((current) =>
        current.map((item) =>
          String(item.id) === String(reminder.id)
            ? { ...item, done: Boolean(reminder.done) }
            : item
        )
      )
      showCustomAlert('Nie udało się zmienić przypomnienia. Spróbuj ponownie.')
    }
  }


  const deleteGeneralReminder = async (reminder) => {
    const confirmed = await showCustomConfirm(
      `Usunąć przypomnienie „${reminder.text || ''}”?`
    )

    if (!confirmed) return

    const previous = generalReminders

    setGeneralReminders((current) =>
      current.filter((item) => String(item.id) !== String(reminder.id))
    )

    try {
      const { error } = await supabase
        .from('general_reminders')
        .delete()
        .eq('id', reminder.id)

      if (error) throw error
    } catch (error) {
      console.error('Nie udało się usunąć przypomnienia:', error)
      setGeneralReminders(previous)
      showCustomAlert('Nie udało się usunąć przypomnienia. Spróbuj ponownie.')
    }
  }


  const toggleJobTask = async (job, noteId) => {
    const note = (job?.notes || []).find(
      (item) => String(item.id) === String(noteId)
    )

    if (!note) return

    const updatedJob = {
      ...job,
      notes: (job.notes || []).map((item) =>
        String(item.id) === String(noteId)
          ? { ...item, done: !Boolean(item.done) }
          : item
      ),
    }

    setJobs((currentJobs) =>
      currentJobs.map((item) =>
        String(item.id) === String(job.id) ? updatedJob : item
      )
    )

    setSelectedJob((current) =>
      current && String(current.id) === String(job.id)
        ? updatedJob
        : current
    )

    try {
      await updateSupabaseJob(updatedJob)
    } catch (error) {
      console.error('Nie udało się zmienić zadania realizacje:', error)
      setJobs((currentJobs) =>
        currentJobs.map((item) =>
          String(item.id) === String(job.id) ? job : item
        )
      )
      setSelectedJob((current) =>
        current && String(current.id) === String(job.id) ? job : current
      )
      showCustomAlert('Nie udało się zmienić zadania. Spróbuj ponownie.')
    }
  }


  /*
   * Automatyczne czyszczenie kosza po 30 dniach.
   * Pliki ze Storage są usuwane razem z realizacją.
   */
  useEffect(() => {

    let cancelled = false

    const cleanupOldTrash = async () => {
      try {
        const trash = await getDeletedJobs()
        const [trashInvoices, trashPayments] = await Promise.all([
          getInvoices(),
          getAllJobPayments(),
        ])
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000

        for (const job of trash) {
          if (cancelled || !job.deletedAt) {
            continue
          }

          const deletedTime = new Date(job.deletedAt).getTime()

          if (!Number.isFinite(deletedTime) || deletedTime > cutoff) {
            continue
          }

          const linkedInvoices = trashInvoices.filter(
            (invoice) => String(invoice.jobId || '') === String(job.id)
          )
          const linkedPayments = trashPayments.filter(
            (payment) => String(payment.jobId || '') === String(job.id)
          )

          // Nie usuwamy automatycznie realizacji, która ma historię finansową.
          // Dzięki temu 30-dniowe czyszczenie kosza nie może osierocić faktur
          // ani płatności ani usunąć plików potrzebnych do ich dalszej obsługi.
          if (linkedInvoices.length || linkedPayments.length) {
            console.warn(
              'Pominięto automatyczne trwałe usunięcie realizacji z historią finansową:',
              job.id
            )
            continue
          }

          const filesToDelete = []

          if (job.mainPhoto?.path) {
            filesToDelete.push(job.mainPhoto.path)
          }
          if (job.documents?.material?.path) {
            filesToDelete.push(job.documents.material.path)
          }
          if (job.documents?.assembly?.path) {
            filesToDelete.push(job.documents.assembly.path)
          }
          for (const photo of job.photos || []) {
            if (photo?.path) {
              filesToDelete.push(photo.path)
            }
          }

          for (const path of filesToDelete) {
            try {
              await deleteSupabaseFile(path)
            } catch (fileError) {
              console.error(
                'Nie udało się usunąć starego pliku z kosza:',
                path,
                fileError
              )
            }
          }

          try {
            await hardDeleteSupabaseJob(job.id)
          } catch (deleteError) {
            console.error(
              'Nie udało się trwale usunąć starej realizacje z kosza:',
              job.id,
              deleteError
            )
          }
        }

        if (!cancelled) {
          const remainingTrash = await getDeletedJobs()
          setDeletedJobs(remainingTrash)
        }
      } catch (error) {
        console.error(
          'Nie udało się wyczyścić starego kosza:',
          error
        )
      }
    }

    cleanupOldTrash()

    return () => {
      cancelled = true
    }
  }, [dataAccessReady])


  /*
   * Synchronizacja robót na żywo z Supabase.
   *
   * Supabase wysyła konkretny rekord, który się zmienił.
   * Aktualizujemy tylko tę jedną realizację zamiast pobierać
   * całą tabelę ponownie. Dzięki temu aplikacja nie robi
   * niepotrzebnego przeładowania listy i powinna działać
   * płynniej na telefonie.
   */
  useEffect(() => {

    const normalizeRealtimeJob = (row, existingJob = null) => {

      if (!row || !row.id) {
        return null
      }

      const quantities =
        row.quantities ||
        existingJob?.quantities || {
          mb: 0,
          m2: 0,
          kg: 0,
        }

      const rates =
        row.rates ||
        existingJob?.rates || {
          mb: 0,
          m2: 0,
          kg: 0,
        }

      return {
        ...(existingJob || {}),
        ...row,

        id: row.id,

        name:
          row.name ??
          existingJob?.name ??
          '',

        location:
          row.location ??
          existingJob?.location ??
          'Brak lokalizacji',

        progress:
          Number(
            row.progress ??
            existingJob?.progress ??
            0
          ),

        status:
          row.status ||
          (row.completed ? 'Zakończone' : existingJob?.status || 'W toku'),

        completed:
          typeof row.completed === 'boolean'
            ? row.completed
            : normalizeJobStage({ status: row.status, completed: existingJob?.completed }) === 'Zakończone',

        completedAt:
          row.completed_at ??
          row.completedAt ??
          existingJob?.completedAt ??
          null,

        invoiceNumber:
          row.invoice_number ??
          row.invoiceNumber ??
          existingJob?.invoiceNumber ??
          '',

        invoiceDate:
          row.invoice_date ??
          row.invoiceDate ??
          existingJob?.invoiceDate ??
          null,

        invoiceAmount:
          row.invoice_amount ??
          row.invoiceAmount ??
          existingJob?.invoiceAmount ??
          null,

        paymentDueDate:
          row.payment_due_date ??
          row.paymentDueDate ??
          existingJob?.paymentDueDate ??
          null,

        paidAt:
          row.paid_at ??
          row.paidAt ??
          existingJob?.paidAt ??
          null,

        deletedAt:
          row.deleted_at ??
          row.deletedAt ??
          existingJob?.deletedAt ??
          null,

        quantities: {
          mb:
            Number(
              quantities.mb ??
              quantities.MB ??
              0
            ),

          m2:
            Number(
              quantities.m2 ??
              quantities.M2 ??
              0
            ),

          kg:
            Number(
              quantities.kg ??
              quantities.KG ??
              0
            ),
        },

        rates: {
          mb:
            Number(
              rates.mb ??
              rates.MB ??
              0
            ),

          m2:
            Number(
              rates.m2 ??
              rates.M2 ??
              0
            ),

          kg:
            Number(
              rates.kg ??
              rates.KG ??
              0
            ),
        },

        documents:
          row.documents ||
          existingJob?.documents || {
            material: null,
            assembly: null,
          },

        notes:
          Array.isArray(row.notes)
            ? row.notes
            : (existingJob?.notes || []),

        photos:
          Array.isArray(row.photos)
            ? row.photos
            : (existingJob?.photos || []),

        mainPhoto:
          row.mainPhoto ??
          row.main_photo ??
          existingJob?.mainPhoto ??
          null,
      }

    }


    const channel =
      supabase
        .channel('aeroinstal-jobs-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
          },
          (payload) => {

            console.log(
              'Supabase Realtime jobs event:',
              payload.eventType,
              payload.new || payload.old
            )


            if (
              payload.eventType === 'DELETE'
            ) {

              const deletedId =
                payload.old?.id

              if (!deletedId) {
                return
              }

              setJobs(
                (currentJobs) =>
                  currentJobs.filter(
                    (job) =>
                      String(job.id) !==
                      String(deletedId)
                  )
              )

              setSelectedJob(
                (currentSelectedJob) =>
                  currentSelectedJob &&
                  String(currentSelectedJob.id) ===
                    String(deletedId)
                    ? null
                    : currentSelectedJob
              )

              return

            }


            if (!payload.new?.id) {
              return
            }


            if (payload.new?.deleted_at) {
              const realtimeDeletedJob = normalizeRealtimeJob(
                payload.new,
                null
              )

              setJobs((currentJobs) =>
                currentJobs.filter(
                  (job) => String(job.id) !== String(payload.new.id)
                )
              )

              setDeletedJobs((currentTrash) => {
                const exists = currentTrash.some(
                  (job) => String(job.id) === String(realtimeDeletedJob.id)
                )

                if (!exists) {
                  return [realtimeDeletedJob, ...currentTrash]
                }

                return currentTrash.map((job) =>
                  String(job.id) === String(realtimeDeletedJob.id)
                    ? realtimeDeletedJob
                    : job
                )
              })

              setSelectedJob((currentSelectedJob) =>
                currentSelectedJob &&
                String(currentSelectedJob.id) === String(payload.new.id)
                  ? null
                  : currentSelectedJob
              )

              return
            }

            setDeletedJobs((currentTrash) =>
              currentTrash.filter(
                (job) => String(job.id) !== String(payload.new?.id)
              )
            )

            setJobs(
              (currentJobs) => {

                const existingJob =
                  currentJobs.find(
                    (job) =>
                      String(job.id) ===
                      String(payload.new.id)
                  ) || null

                const realtimeJob =
                  normalizeRealtimeJob(
                    payload.new,
                    existingJob
                  )

                if (!realtimeJob) {
                  return currentJobs
                }

                const exists =
                  Boolean(existingJob)

                if (!exists) {
                  return [
                    ...currentJobs,
                    realtimeJob,
                  ]
                }

                return currentJobs.map(
                  (job) =>
                    String(job.id) ===
                    String(realtimeJob.id)
                      ? realtimeJob
                      : job
                )

              }
            )


            setSelectedJob(
              (currentSelectedJob) => {

                if (
                  !currentSelectedJob ||
                  String(currentSelectedJob.id) !==
                    String(payload.new.id)
                ) {
                  return currentSelectedJob
                }

                return normalizeRealtimeJob(
                  payload.new,
                  currentSelectedJob
                )

              }
            )

          }
        )
        .subscribe((status) => {

          console.log(
            'Supabase Realtime jobs:',
            status
          )

        })


    return () => {

      supabase.removeChannel(channel)

    }

  }, [dataAccessReady])

  /*
   * Nowa realizacja.
   */

  const [newJob, setNewJob] =
    useState({

      name: '',

      location: '',

      clientId: null,

      priority: 'normal',

      quantities: {
        mb: '',
        m2: '',
        kg: '',
      },

      rates: {
        mb: settings.rates.mb,
        m2: settings.rates.m2,
        kg: settings.rates.kg,
      },

    })


  const updateJob = async (
    updatedJob,
    options = {}
  ) => {

    const {
      skipSupabase = false,
    } = options

    setJobs(
      (currentJobs) =>
        currentJobs.map(
          (job) =>
            String(job.id) ===
            String(updatedJob.id)
              ? updatedJob
              : job
        )
    )

    setSelectedJob(
      updatedJob
    )

    if (skipSupabase) {
      return
    }

    try {

      await updateSupabaseJob(
        updatedJob
      )

      console.log(
        'Realizacja została zaktualizowana w Supabase:',
        updatedJob.name
      )

    } catch (error) {

      console.error(
        'Nie udało się zaktualizować realizacje w Supabase:',
        error
      )

      showCustomAlert(
        'Realizacja została zmieniona lokalnie, ale nie udało się zapisać zmiany w Supabase.'
      )

    }

  }


  const deleteJob = async (jobToDelete) => {

    if (!jobToDelete?.id) {
      return
    }

    const confirmed = await showCustomConfirm(
      `Czy przenieść realizację „${jobToDelete.name || ''}” do kosza?\n\nRealizacja zostanie ukryta z listy. Zwykłe realizacje są automatycznie czyszczone po 30 dniach, natomiast realizacje z fakturą lub płatnościami pozostają zachowane.`
    )

    if (!confirmed) {
      return
    }

    const isLocalSeedJob =
      typeof jobToDelete.id === 'number'

    if (isLocalSeedJob) {
      setJobs((currentJobs) =>
        currentJobs.filter(
          (job) => String(job.id) !== String(jobToDelete.id)
        )
      )

      setDeletedJobs((currentTrash) => [
        {
          ...jobToDelete,
          deletedAt: new Date().toISOString(),
        },
        ...currentTrash,
      ])

      setSelectedJob(null)

      showCustomAlert(
        'Realizacja została przeniesiona do kosza. Możesz ją przywrócić przez 30 dni.'
      )

      return
    }

    try {
      const savedDeletedJob =
        await softDeleteSupabaseJob(jobToDelete.id)

      setJobs((currentJobs) =>
        currentJobs.filter(
          (job) => String(job.id) !== String(jobToDelete.id)
        )
      )

      setDeletedJobs((currentTrash) => [
        savedDeletedJob,
        ...currentTrash.filter(
          (job) => String(job.id) !== String(savedDeletedJob.id)
        ),
      ])

      setSelectedJob(null)

      console.log(
        'Realizacja została przeniesiona do kosza:',
        savedDeletedJob.name
      )

      showCustomAlert(
        'Realizacja została przeniesiona do kosza. Możesz ją przywrócić przez 30 dni.'
      )

    } catch (error) {
      console.error(
        'Nie udało się przenieść realizacje do kosza:',
        error
      )

      showCustomAlert(
        'Nie udało się przenieść realizacje do kosza. Spróbuj ponownie.'
      )
    }
  }


  const restoreJobFromTrash = async (jobToRestore) => {

    if (!jobToRestore?.id) {
      return
    }

    const confirmed = await showCustomConfirm(
      `Przywrócić realizację „${jobToRestore.name || ''}” do aktywnych?`
    )

    if (!confirmed) {
      return
    }

    const isLocalSeedJob =
      typeof jobToRestore.id === 'number'

    if (isLocalSeedJob) {
      const restoredJob = {
        ...jobToRestore,
        deletedAt: null,
      }

      setDeletedJobs((currentTrash) =>
        currentTrash.filter(
          (job) => String(job.id) !== String(jobToRestore.id)
        )
      )

      setJobs((currentJobs) => [
        restoredJob,
        ...currentJobs,
      ])

      showCustomAlert('Realizacja została przywrócona.')
      return
    }

    try {
      const restoredJob =
        await restoreSupabaseJob(jobToRestore.id)

      setDeletedJobs((currentTrash) =>
        currentTrash.filter(
          (job) => String(job.id) !== String(jobToRestore.id)
        )
      )

      setJobs((currentJobs) => [
        restoredJob,
        ...currentJobs.filter(
          (job) => String(job.id) !== String(restoredJob.id)
        ),
      ])

      console.log(
        'Realizacja została przywrócona:',
        restoredJob.name
      )

      showCustomAlert('Realizacja została przywrócona do aktywnych.')

    } catch (error) {
      console.error(
        'Nie udało się przywrócić realizacje:',
        error
      )

      showCustomAlert(
        'Nie udało się przywrócić realizacje. Spróbuj ponownie.'
      )
    }
  }


  const permanentlyDeleteJob = async (jobToDelete) => {

    if (!jobToDelete?.id) {
      return
    }

    const confirmed = await showCustomConfirm(
      `Usunąć realizację „${jobToDelete.name || ''}” na zawsze?\n\nTej operacji nie będzie można cofnąć. Realizacje z fakturą lub historią płatności nie można trwale usunąć.`
    )

    if (!confirmed) {
      return
    }

    const isLocalSeedJob =
      typeof jobToDelete.id === 'number'

    if (isLocalSeedJob) {
      setDeletedJobs((currentTrash) =>
        currentTrash.filter(
          (job) => String(job.id) !== String(jobToDelete.id)
        )
      )

      showCustomAlert('Realizacja została trwale usunięta.')
      return
    }

    try {
      const [jobPayments, allInvoices] = await Promise.all([
        getJobPayments(jobToDelete.id),
        getInvoices(),
      ])
      const linkedPayments = jobPayments.filter(
        (payment) => String(payment.jobId || '') === String(jobToDelete.id)
      )
      const linkedInvoices = allInvoices.filter(
        (invoice) => String(invoice.jobId || '') === String(jobToDelete.id)
      )

      if (linkedInvoices.length || linkedPayments.length) {
        showCustomAlert(
          'Nie można trwale usunąć tej realizacji. Jest powiązana z fakturą lub historią płatności. Najpierw usuń lub rozlicz te powiązania.'
        )
        return
      }

      const filesToDelete = []

      if (jobToDelete.mainPhoto?.path) {
        filesToDelete.push(jobToDelete.mainPhoto.path)
      }

      if (jobToDelete.documents?.material?.path) {
        filesToDelete.push(jobToDelete.documents.material.path)
      }

      if (jobToDelete.documents?.assembly?.path) {
        filesToDelete.push(jobToDelete.documents.assembly.path)
      }

      for (const photo of jobToDelete.photos || []) {
        if (photo?.path) {
          filesToDelete.push(photo.path)
        }
      }

      for (const path of filesToDelete) {
        try {
          await deleteSupabaseFile(path)
        } catch (fileError) {
          console.error(
            'Nie udało się usunąć pliku ze Storage:',
            path,
            fileError
          )
        }
      }

      await hardDeleteSupabaseJob(jobToDelete.id)

      setDeletedJobs((currentTrash) =>
        currentTrash.filter(
          (job) => String(job.id) !== String(jobToDelete.id)
        )
      )

      showCustomAlert('Realizacja została trwale usunięta.')

    } catch (error) {
      console.error(
        'Nie udało się trwale usunąć realizacje:',
        error
      )

      showCustomAlert(
        'Nie udało się trwale usunąć realizacje. Spróbuj ponownie.'
      )
    }
  }



  const openInvoiceCreatorForJob = (job) => {
    if (!job?.id) return
    setSelectedJob(null)
    setInvoiceToOpen(null)
    setInvoiceJobToCreate(job.id)
    setActivePage('invoices')
  }

  const openInvoiceFromJob = (invoice) => {
    if (!invoice?.id) return
    setSelectedJob(null)
    setInvoiceJobToCreate(null)
    setInvoiceToOpen(invoice.id)
    setActivePage('invoices')
  }

  const handleCreateOffer = async (draft) => {
    const saved = await createOffer({
      ...draft,
      total: (
        (parseDecimal(draft.quantities?.mb) * parseDecimal(draft.rates?.mb)) +
        (parseDecimal(draft.quantities?.m2) * parseDecimal(draft.rates?.m2)) +
        (parseDecimal(draft.quantities?.kg) * parseDecimal(draft.rates?.kg))
      ),
    })
    setOffers((current) => [saved, ...current.filter((offer) => String(offer.id) !== String(saved.id))])
    return saved
  }

  const handleUpdateOffer = async (draft) => {
    const saved = await updateOffer(draft)
    setOffers((current) => current.map((offer) => String(offer.id) === String(saved.id) ? saved : offer))
    return saved
  }

  const handleDeleteOffer = async (id) => {
    await deleteOffer(id)
    setOffers((current) => current.filter((offer) => String(offer.id) !== String(id)))
  }

  const handleConvertOfferToJob = async (offer) => {
    if (!offer?.id || offer.convertedJobId) return

    const job = {
      id: Date.now(),
      name: offer.name || '',
      location: offer.location || 'Brak lokalizacji',
      clientId: offer.clientId || null,
      priority: 'normal',
      status: 'W toku',
      progress: 0,
      completed: false,
      completedAt: null,
      invoiceNumber: '',
      invoiceDate: null,
      invoiceAmount: null,
      paymentDueDate: null,
      paidAt: null,
      quantities: {
        mb: Number(offer.quantities?.mb || 0),
        m2: Number(offer.quantities?.m2 || 0),
        kg: Number(offer.quantities?.kg || 0),
      },
      rates: {
        mb: Number(offer.rates?.mb || 0),
        m2: Number(offer.rates?.m2 || 0),
        kg: Number(offer.rates?.kg || 0),
      },
      documents: { material: null, assembly: null },
      notes: offer.scope || offer.notes ? [{
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        text: [offer.scope, offer.notes].filter(Boolean).join('\\n\\n'),
        done: false,
        createdAt: new Date().toISOString(),
      }] : [],
      photos: [],
      mainPhoto: null,
    }

    let savedJob = null

    try {
      savedJob = await createSupabaseJob(job)
      const savedOffer = await updateOffer({
        ...offer,
        convertedJobId: savedJob.id,
      })

      setJobs((current) => [savedJob, ...current])
      setOffers((current) => current.map((item) => String(item.id) === String(savedOffer.id) ? savedOffer : item))
      showCustomAlert('Oferta została zamieniona na realizację. Realizacja trafiła do realizacji.')
    } catch (error) {
      // Jeżeli realizacja została utworzona, ale aktualizacja oferty się nie udała,
      // usuwamy osieroconą realizację. Na tym etapie nie ma jeszcze faktury ani płatności.
      if (savedJob?.id) {
        try {
          await hardDeleteSupabaseJob(savedJob.id)
        } catch (rollbackError) {
          console.error('Nie udało się wycofać osieroconej realizacji po błędzie konwersji oferty:', rollbackError)
        }
      }

      console.error('Nie udało się utworzyć realizacje z oferty:', error)
      showCustomAlert('Nie udało się utworzyć realizacje z oferty. Spróbuj ponownie.')
    }
  }


  const createJob = async () => {

    if (
      !newJob.name.trim()
    ) {

      showCustomAlert(
        'Podaj nazwę realizacje.'
      )

      return

    }


    const job = {

      id: Date.now(),

      name:
        newJob.name.trim(),

      location:
        newJob.location.trim() ||
        'Brak lokalizacji',

      clientId:
        newJob.clientId || null,

      priority:
        newJob.priority || 'normal',

      status: 'W toku',

      progress: 0,

      completed: false,

      completedAt: null,

      invoiceNumber: '',

      invoiceDate: null,

      invoiceAmount: null,

      paymentDueDate: null,

      paidAt: null,

      quantities: {

        mb:
          parseDecimal(
            newJob.quantities.mb
          ) || 0,

        m2:
          parseDecimal(
            newJob.quantities.m2
          ) || 0,

        kg:
          parseDecimal(
            newJob.quantities.kg
          ) || 0,

      },

      rates: {

        mb:
          parseDecimal(
            newJob.rates.mb
          ) || 0,

        m2:
          parseDecimal(
            newJob.rates.m2
          ) || 0,

        kg:
          parseDecimal(
            newJob.rates.kg
          ) || 0,

      },

      documents: {

        material: null,

        assembly: null,

      },

      notes: [],

      photos: [],

      mainPhoto: null,

    }


    /*
     * Najpierw zapisujemy realizację do Supabase.
     * Dzięki temu prawdziwym identyfikatorem realizacje
     * staje się UUID z bazy.
     */
    let savedJob

    try {

      savedJob =
        await createSupabaseJob(
          job
        )

      console.log(
        'Nowa realizacja zapisana w Supabase:',
        savedJob
      )

    } catch (error) {

      console.error(
        'Nie udało się zapisać nowej realizacje w Supabase:',
        error
      )

      showCustomAlert(
        'Nie udało się zapisać realizacje w Supabase. Realizacja nie została utworzona.'
      )

      return

    }


    /*
     * Zachowujemy lokalne dane dokumentów,
     * zdjęć i notatek. Na tym etapie są one jeszcze
     * obsługiwane przez obecną aplikację.
     *
     * Z Supabase bierzemy UUID jako ID realizacje.
     */
    const finalJob = {

      ...job,

      id:
        savedJob.id,

    }


    setJobs(
      (currentJobs) => [

        ...currentJobs,

        finalJob,

      ]
    )


    setNewJob({

      name: '',

      location: '',

      clientId: null,

      quantities: {

        mb: '',
        m2: '',
        kg: '',

      },

      rates: {

        mb: settings.rates.mb,
        m2: settings.rates.m2,
        kg: settings.rates.kg,

      },

    })


    setAddingJob(false)

    setActivePage('jobs')

  }




  useEffect(() => {
    if (!dataAccessReady) return

    let cancelled = false

    const loadOrganizationContext = async () => {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id,name,short_name,nip,regon,address,email,bank_account')
          .maybeSingle()
        if (error) throw error
        if (cancelled || !data) return

        setSettings((current) => {
          const localCompany = current.company || {}
          const restoredCompany = {
            shortName: data.short_name || data.name || localCompany.shortName || '',
            name: data.name || localCompany.name || '',
            nip: data.nip || localCompany.nip || '',
            regon: data.regon || localCompany.regon || '',
            address: data.address || localCompany.address || '',
            email: data.email || localCompany.email || authSession?.user?.email || '',
            bankAccount: data.bank_account || localCompany.bankAccount || '',
          }

          // Jeżeli migracja organizacji nie przeniosła jeszcze któregoś pola,
          // zachowujemy istniejące dane z lokalnych ustawień zamiast je wyzerować.
          return {
            ...current,
            company: restoredCompany,
          }
        })
      } catch (error) {
        console.error('Nie udało się wczytać firmy zalogowanego użytkownika:', error)
      }
    }

    const loadOrganizationMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('organization_members')
          .select('user_id,organization_id,role,display_name,email,created_at')
          .order('created_at', { ascending: true })
        if (error) throw error
        if (!cancelled) setOrganizationMembers(data || [])
      } catch (error) {
        console.error('Nie udało się wczytać członków firmy:', error)
        if (!cancelled) setOrganizationMembers([])
      }
    }

    loadOrganizationContext()
    loadOrganizationMembers()

    return () => { cancelled = true }
  }, [dataAccessReady, authSession])

  if (!authChecked || !authOrganizationChecked || (!authSession && deviceLoading)) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f9fd', color: '#68758a' }}>
        Sprawdzam dostęp…
      </div>
    )
  }

if (!authSession && !deviceUser && deviceAuthError && getLocalDeviceUser()) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#f4f8fc' }}>
        <div style={{ width: '100%', maxWidth: '520px', background: '#fff', borderRadius: '24px', padding: '28px', boxShadow: '0 18px 55px rgba(15, 48, 90, 0.12)', border: '1px solid #e4ebf2' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', color: '#168fe5', marginBottom: '8px' }}>AEROINSTAL</div>
          <h2 style={{ margin: '0 0 10px', color: '#12234f' }}>Przywracanie starego urządzenia</h2>
          <p style={{ color: '#64748b', lineHeight: 1.55, marginTop: 0 }}>Telefon ma zapisany dostęp Łukasza, ale serwer nie rozpoznał jego identyfikatora.</p>
          <div style={{ margin: '18px 0', padding: '14px', borderRadius: '14px', background: '#f6f9fc', border: '1px solid #dce6ef', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '13px', color: '#334155' }}>{deviceId}</div>
          <div style={{ marginBottom: '18px', padding: '13px 14px', borderRadius: '12px', background: '#fff7ed', color: '#9a3412', fontSize: '14px', lineHeight: 1.45 }}>{deviceAuthError}</div>
          <button type="button" onClick={retryLegacyDeviceAuthentication} disabled={deviceLoading} style={{ width: '100%', minHeight: '50px', border: 'none', borderRadius: '14px', background: '#168fe5', color: '#fff', fontWeight: 800, fontSize: '16px' }}>{deviceLoading ? 'Sprawdzam…' : 'Spróbuj ponownie'}</button>
        </div>
      </div>
    )
  }

  if (!authSession && !deviceUser) {
    return <AuthPage />
  }

if (authSession && !authOrganizationId) {

    return <AuthPage session={authSession} recovery={authRecovery} />
  }

  if (selectedJob) {
return (
      <>
        <JobDetails

          job={
            selectedJob
          }

          clients={clients}

          company={settings.company}
          invoices={invoices}
          onCreateInvoice={openInvoiceCreatorForJob}
          onOpenInvoice={openInvoiceFromJob}

          onBack={() =>
            setSelectedJob(null)
          }

          onUpdate={
            updateJob
          }

          onDelete={
            deleteJob
          }

        />
      </>
    )

  }


  if (addingJob) {

    return (
      <>
        <NewJobPage

          newJob={
            newJob
          }

          setNewJob={
            setNewJob
          }

          settings={
            settings
          }

          clients={clients}

          onBack={() =>
            setAddingJob(false)
          }

          onCreate={
            createJob
          }

        />
      </>
    )

  }


  return (

    <div className="app">

      <header className="main-header">

        <img

          src={logo}

          className="app-logo"

          alt={settings.company?.shortName || 'Moja Firma'}

          title={settings.company?.shortName || 'Moja Firma'}

        />

      </header>


      <main className="content">

        {activePage === 'start' && (

          <StartPage

            jobs={
              jobs
            }

            invoices={invoices}

            allJobPayments={dashboardJobPayments}

            onOpenFinance={() => setActivePage('finance')}

            clients={clients}

            onOpenJob={
              setSelectedJob
            }

            generalReminders={generalReminders}

            generalRemindersLoading={generalRemindersLoading}

            onAddGeneralReminder={addGeneralReminder}

            onToggleGeneralReminder={toggleGeneralReminder}

            onDeleteGeneralReminder={deleteGeneralReminder}

            onToggleJobTask={toggleJobTask}

            onJobs={(tab) => {
              setActivePage('jobs')
              window.setTimeout(() => {
                window.dispatchEvent(
                  new CustomEvent('aeroinstal-open-jobs-tab', {
                    detail: tab || 'all',
                  })
                )
              }, 0)
            }}

          />

        )}


        {activePage === 'jobs' && (

          <JobsErrorBoundary>
            <JobsPage

            jobs={
              jobs
            }

            clients={
              clients
            }

            invoices={invoices}

            onOpenJob={
              setSelectedJob
            }

            onToggleJobTask={toggleJobTask}

            onAddJob={() =>
              setAddingJob(true)
            }

            deletedJobs={
              deletedJobs
            }

            onRestoreJob={
              restoreJobFromTrash
            }

            onPermanentDeleteJob={
              permanentlyDeleteJob
            }

          />
          </JobsErrorBoundary>

        )}


        {activePage === 'offers' && (
          <OffersPage
            offers={offers}
            clients={clients}
            settings={settings}
            onCreate={handleCreateOffer}
            onUpdate={handleUpdateOffer}
            onDelete={handleDeleteOffer}
            onConvertToJob={handleConvertOfferToJob}
            onAlert={showCustomAlert}
            onConfirm={showCustomConfirm}
          />
        )}


        {activePage === 'clients' && (

          <ClientsPage
            clients={clients}
            settings={settings}
            jobs={jobs}
            onRefresh={loadClients}
            onAlert={showCustomAlert}
            onConfirm={showCustomConfirm}
            onOpenJob={setSelectedJob}
          />

        )}


        {activePage === 'invoices' && (
          <InvoicesPage
            invoices={invoices}
            jobs={jobs}
            clients={clients}
            settings={settings}
            prefillJobId={invoiceJobToCreate}
            openInvoiceId={invoiceToOpen}
            onPrefillConsumed={() => setInvoiceJobToCreate(null)}
            onOpenConsumed={() => setInvoiceToOpen(null)}
            onAlert={showCustomAlert}
            onConfirm={showCustomConfirm}
          />
        )}

        {activePage === 'finance' && (

          <FinancePage
            jobs={jobs}
            organizationMembers={organizationMembers}
            dataAccessReady={dataAccessReady}
            settings={settings}
            clients={clients}
            invoices={invoices}
            onOpenJob={setSelectedJob}
            onOpenJobs={(tab = 'all') => {
              setSelectedJob(null)
              setInvoiceJobToCreate(null)
              setInvoiceToOpen(null)
              setActivePage('jobs')
              window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent('aeroinstal-open-jobs-tab', { detail: tab }))
              }, 0)
            }}
            onOpenInvoices={() => {
              setSelectedJob(null)
              setInvoiceJobToCreate(null)
              setInvoiceToOpen(null)
              setActivePage('invoices')
            }}
            onOpenInvoice={(invoiceId) => {
              if (!invoiceId) return
              setSelectedJob(null)
              setInvoiceJobToCreate(null)
              setInvoiceToOpen(invoiceId)
              setActivePage('invoices')
            }}
          />

        )}


        {activePage === 'settings' && (

          <SettingsPage
            settings={settings}
            setSettings={setSettings}
            authSession={authSession}
          />

        )}

      </main>


      <BottomNavigation

        activePage={
          activePage
        }

        onChange={
          setActivePage
        }

      />

    </div>

  )

}


/* =====================================================
   START
   ===================================================== */

function StartPage({
  jobs,
  invoices = [],
  allJobPayments = [],
  onOpenJob,
  onJobs,
  generalReminders,
  generalRemindersLoading,
  onAddGeneralReminder,
  onToggleGeneralReminder,
  onDeleteGeneralReminder,
  onToggleJobTask,
}) {

  const activeJobs = jobs.filter((job) => normalizeJobStage(job) === 'W toku')
  const completedJobs = jobs.filter((job) => normalizeJobStage(job) === 'Zakończone')

  const averageProgress =
    activeJobs.length > 0
      ? Math.round(
          activeJobs.reduce(
            (sum, job) => sum + Number(job.progress || 0),
            0
          ) / activeJobs.length
        )
      : 0

  const totalValue = jobs.reduce(
    (sum, job) => sum + calculateTotal(job),
    0
  )

  const activeValue = activeJobs.reduce(
    (sum, job) => sum + calculateTotal(job),
    0
  )

  const completedValue = completedJobs.reduce(
    (sum, job) => sum + calculateTotal(job),
    0
  )

  const today = getTodayString()

  const dashboardInvoiceIds = new Set(
    invoices
      .filter((invoice) => invoice.status !== 'Anulowana')
      .map((invoice) => String(invoice.id))
  )

  const dashboardPaidByInvoice = new Map()

  invoices.forEach((invoice) => {
    const assigned = allJobPayments
      .filter((payment) => String(payment.invoiceId || '') === String(invoice.id))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

    dashboardPaidByInvoice.set(String(invoice.id), Math.max(0, assigned))
  })

  const dashboardInvoicesByJob = new Map()
  invoices.forEach((invoice) => {
    if (!invoice.jobId || invoice.status === 'Anulowana') return
    const key = String(invoice.jobId)
    const current = dashboardInvoicesByJob.get(key) || []
    current.push(invoice)
    dashboardInvoicesByJob.set(key, current)
  })

  dashboardInvoicesByJob.forEach((jobInvoices, jobId) => {
    const unassigned = allJobPayments
      .filter((payment) =>
        String(payment.jobId) === String(jobId) &&
        !payment.invoiceId
      )
      .sort((a, b) => String(a.paidAt || '').localeCompare(String(b.paidAt || '')))

    let remaining = unassigned.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    )

    const sorted = [...jobInvoices].sort((a, b) => {
      const dateCompare = String(a.issueDate || '').localeCompare(String(b.issueDate || ''))
      if (dateCompare !== 0) return dateCompare
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    })

    sorted.forEach((invoice) => {
      const gross = Math.max(0, Number(invoice.grossAmount || 0))
      const already = Math.min(
        gross,
        Math.max(0, Number(dashboardPaidByInvoice.get(String(invoice.id)) || 0))
      )
      const legacy = Math.min(
        Math.max(0, gross - already),
        Math.max(0, remaining)
      )
      dashboardPaidByInvoice.set(String(invoice.id), already + legacy)
      remaining = Math.max(0, remaining - legacy)
    })
  })

  const dashboardReceivables = invoices
    .filter((invoice) =>
      invoice.status !== 'Anulowana' &&
      invoice.status !== 'Do wystawienia' &&
      invoice.issueDate
    )
    .map((invoice) => {
      const net = Math.max(0, Number(invoice.netAmount || 0))
      const paid = Math.min(
        net,
        Math.max(0, Number(dashboardPaidByInvoice.get(String(invoice.id)) || 0))
      )
      const remaining = Math.max(0, net - paid)
      return {
        invoice,
        remaining,
        overdue: Boolean(
          remaining > 0.01 &&
          invoice.dueDate &&
          invoice.dueDate < today
        ),
      }
    })
    .filter((item) => item.remaining > 0.01)

  const dashboardReceivablesNet = dashboardReceivables.reduce(
    (sum, item) => sum + item.remaining,
    0
  )

  const dashboardOverdueNet = dashboardReceivables
    .filter((item) => item.overdue)
    .reduce((sum, item) => sum + item.remaining, 0)

  const dashboardMonthPrefix = today.slice(0, 7)
  const dashboardMonthReceived = allJobPayments
    .filter((payment) => payment.paidAt?.startsWith(dashboardMonthPrefix))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

  const dashboardOpenInvoices = dashboardReceivables.length

  const pendingGeneral = (generalReminders || []).filter(
    (item) => !item.done
  )

  const overdueGeneral = pendingGeneral.filter(
    (item) => item.date && item.date < today
  )

  const visibleGeneral = [
    ...pendingGeneral,
    ...(generalReminders || []).filter((item) => item.done),
  ].slice(0, 5)

  return (
    <>
      <section>
        <div className="section-title">
          <h2>Wartość robót</h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '10px',
            marginBottom: '20px',
          }}
        >
          <div className="detail-card" style={{ margin: 0 }}>
            <span style={{ opacity: 0.7 }}>W toku</span>
            <strong
              style={{
                display: 'block',
                fontSize: '20px',
                marginTop: '5px',
              }}
            >
              {formatMoney(activeValue)}
            </strong>
          </div>

          <div className="detail-card" style={{ margin: 0 }}>
            <span style={{ opacity: 0.7 }}>Zakończone</span>
            <strong
              style={{
                display: 'block',
                fontSize: '20px',
                marginTop: '5px',
              }}
            >
              {formatMoney(completedValue)}
            </strong>
          </div>
        </div>
      </section>

      <section className="dashboard-today-section">
        <div className="dashboard-today-header">
          <div>
            <div className="small-label">DZISIAJ</div>
            <h2>Do zrobienia</h2>
          </div>
          <span className="dashboard-today-count">
            {pendingGeneral.length + activeJobs.reduce((sum, job) => sum + (Array.isArray(job.notes) ? job.notes.filter((task) => task && !task.done).length : 0), 0)}
          </span>
        </div>

        <div className="dashboard-today-list">
          {[
            ...pendingGeneral.map((reminder) => ({
              id: `general-${reminder.id}`,
              type: 'general',
              text: reminder.text,
              date: reminder.date,
              overdue: Boolean(reminder.date && reminder.date < today),
              job: null,
              taskId: null,
            })),
            ...activeJobs.flatMap((job) =>
              (Array.isArray(job.notes) ? job.notes : [])
                .filter((task) => task && !task.done)
                .map((task) => ({
                  id: `task-${job.id}-${task.id}`,
                  type: 'job',
                  text: task.text,
                  date: task.date,
                  overdue: Boolean(task.date && task.date < today),
                  job,
                  taskId: task.id,
                }))
            ),
          ]
            .sort((a, b) => {
              if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
              if (!a.date && b.date) return 1
              if (a.date && !b.date) return -1
              return String(a.date || '').localeCompare(String(b.date || ''))
            })
            .slice(0, 8)
            .map((item) => (
              <div className={`dashboard-today-row${item.overdue ? ' dashboard-today-row-overdue' : ''}`} key={item.id}>
                <button
                  type="button"
                  className="dashboard-today-check"
                  onClick={() => {
                    if (item.type === 'general') {
                      onToggleGeneralReminder(
                        pendingGeneral.find((reminder) => String(reminder.id) === String(item.id.replace('general-', '')))
                      )
                    } else {
                      onToggleJobTask?.(item.job, item.taskId)
                    }
                  }}
                  aria-label="Oznacz jako wykonane"
                >
                  {item.overdue ? '!' : '✓'}
                </button>

                <button
                  type="button"
                  className="dashboard-today-main"
                  onClick={() => item.job ? onOpenJob(item.job) : document.querySelector('.general-reminders-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  <strong>{item.text || 'Bez nazwy zadania'}</strong>
                  <span>
                    {item.job
                      ? `🔧 ${item.job.name}`
                      : '🔔 Ogólne przypomnienie'}
                    {item.date ? ` • ${item.overdue ? 'zaległe • ' : ''}${formatDate(item.date)}` : ''}
                  </span>
                </button>

                <span className={item.type === 'job' ? 'dashboard-today-type dashboard-today-type-job' : 'dashboard-today-type'}>
                  {item.type === 'job' ? 'REALIZACJA' : 'OGÓLNE'}
                </span>
              </div>
            ))}

          {pendingGeneral.length === 0 && activeJobs.every((job) => !(Array.isArray(job.notes) ? job.notes : []).some((task) => task && !task.done)) && (
            <div className="dashboard-today-empty">
              <span>✓</span>
              <strong>Na dziś wszystko zrobione</strong>
              <small>Brak otwartych zadań i przypomnień.</small>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="section-title">
          <h2>W toku</h2>
          <button className="section-link" onClick={() => onJobs('active')}>
            Wszystkie
          </button>
        </div>

        <div className="jobs">
          {activeJobs.length === 0 && (
            <div className="detail-card">Brak robót w toku.</div>
          )}

          {[...activeJobs]
            .sort((a, b) => {
              const priorityOrder = {
                urgent: 3,
                high: 2,
                normal: 1,
              }

              const aPriority = priorityOrder[String(a.priority || 'normal').toLowerCase()] || 1
              const bPriority = priorityOrder[String(b.priority || 'normal').toLowerCase()] || 1

              if (bPriority !== aPriority) {
                return bPriority - aPriority
              }

              return Number(b.progress || 0) - Number(a.progress || 0)
            })
            .slice(0, 5)
            .map((job) => (
              <JobCard
                key={job.id}
                job={job}
                invoices={invoices}
                onClick={() => onOpenJob(job)}
                onToggleTask={onToggleJobTask}
              />
            ))}

          {activeJobs.length > 5 && (
            <button
              className="section-link"
              onClick={() => onJobs('active')}
              style={{ alignSelf: 'center', padding: '8px 0' }}
            >
              Pokaż wszystkie w toku ({activeJobs.length})
            </button>
          )}
        </div>
      </section>

      <section className="general-reminders-section">
        <div className="section-title">
          <div>
            <div className="small-label">OGÓLNE</div>
            <h2>Przypomnienia</h2>
          </div>
          <span className="general-reminders-count">
            {pendingGeneral.length}
          </span>
        </div>

        {overdueGeneral.length > 0 && (
          <div className="general-reminders-alert">
            <span>!</span>
            <strong>Zaległe: {overdueGeneral.length}</strong>
          </div>
        )}

        <div className="general-reminders-card">
          <div className="general-reminders-list">
            {generalRemindersLoading && (
              <div className="general-reminder-empty">Wczytywanie…</div>
            )}

            {!generalRemindersLoading && visibleGeneral.length === 0 && (
              <div className="general-reminder-empty">
                <span className="general-reminder-empty-icon">✓</span>
                <strong>Brak ogólnych przypomnień</strong>
                <span>Dodaj rzecz, o której nie chcesz zapomnieć.</span>
              </div>
            )}

            {visibleGeneral.map((reminder) => {
              const overdue =
                !reminder.done && reminder.date && reminder.date < today

              return (
                <div
                  className={
                    reminder.done
                      ? 'general-reminder-row done'
                      : overdue
                        ? 'general-reminder-row overdue'
                        : 'general-reminder-row'
                  }
                  key={reminder.id}
                >
                  <button
                    type="button"
                    className={
                      reminder.done
                        ? 'general-reminder-checkbox checked'
                        : 'general-reminder-checkbox'
                    }
                    aria-label={
                      reminder.done
                        ? 'Oznacz jako niewykonane'
                        : 'Oznacz jako wykonane'
                    }
                    onClick={() => onToggleGeneralReminder(reminder)}
                  >
                    {reminder.done ? '✓' : ''}
                  </button>

                  <button
                    type="button"
                    className="general-reminder-main"
                    onClick={() => onToggleGeneralReminder(reminder)}
                  >
                    <strong>{reminder.text}</strong>
                    {reminder.date && (
                      <span>
                        {overdue ? 'Zaległe • ' : ''}
                        {formatDate(reminder.date)}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="general-reminder-delete"
                    aria-label="Usuń przypomnienie"
                    onClick={() => onDeleteGeneralReminder(reminder)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>

          <GeneralReminderForm onAdd={onAddGeneralReminder} />
        </div>
      </section>

      <section>
        <div className="section-title">
          <h2>Ostatnio zakończone</h2>
          <button className="section-link" onClick={onJobs}>
            Realizacje
          </button>
        </div>

        <div className="jobs">
          {completedJobs.length === 0 && (
            <div className="detail-card">
              Brak zakończonych robót.
            </div>
          )}

          {[...completedJobs]
            .sort((a, b) =>
              String(b.completedAt || '').localeCompare(
                String(a.completedAt || '')
              )
            )
            .slice(0, 3)
            .map((job) => (
              <JobCard
                key={job.id}
                job={job}
                invoices={invoices}
                onClick={() => onOpenJob(job)}
                onToggleTask={onToggleJobTask}
              />
            ))}
        </div>
      </section>
    </>
  )
}


function GeneralReminderForm({ onAdd }) {
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const [open, setOpen] = useState(false)

  const submit = async () => {
    if (!text.trim()) return
    await onAdd({ text, date })
    setText('')
    setDate('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        className="general-reminder-add-button"
        onClick={() => setOpen(true)}
      >
        <span>＋</span>
        Dodaj przypomnienie
      </button>
    )
  }

  return (
    <div className="general-reminder-form">
      <div className="general-reminder-form-title">Nowe przypomnienie</div>
      <input
        type="text"
        className="general-reminder-input"
        placeholder="Co trzeba zrobić?"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
      />
      <div className="general-reminder-date-row">
        <input
          type="date"
          className="general-reminder-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          type="button"
          className="general-reminder-cancel"
          onClick={() => {
            setOpen(false)
            setText('')
            setDate('')
          }}
        >
          Anuluj
        </button>
        <button
          type="button"
          className="general-reminder-save"
          disabled={!text.trim()}
          onClick={submit}
        >
          ✓ Zapisz
        </button>
      </div>
    </div>
  )
}


/* =====================================================
   WEATHER
   ===================================================== */

function WeatherCard() {

  const [weather, setWeather] =
    useState(null)


  const [weatherError, setWeatherError] =
    useState(false)


  useEffect(() => {

    const loadWeather =
      async () => {

        try {

          const response =
            await fetch(

              'https://api.open-meteo.com/v1/forecast?latitude=54.3520&longitude=18.6466&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FWarsaw&forecast_days=5'

            )


          if (
            !response.ok
          ) {

            throw new Error(
              'Weather error'
            )

          }


          const data =
            await response.json()


          setWeather(
            data
          )


        } catch (error) {

          console.error(
            error
          )

          setWeatherError(
            true
          )

        }

      }


    loadWeather()

  }, [])


  const today =
    getTodayString()


  return (

    <div className="weather-card">

      <div className="weather-main">

        <span className="weather-icon">

          {weather
            ? getWeatherIcon(
                weather.current.weather_code
              )
            : '🌤️'
          }

        </span>


        <strong>

          {weather

            ? `${Math.round(
                weather.current.temperature_2m
              )}°C`

            : '--'

          }

        </strong>

      </div>


      <div className="weather-location">

        <strong>
          Gdańsk
        </strong>

        <span>

          {weather

            ? getWeatherDescription(
                weather.current.weather_code
              )

            : weatherError
              ? 'Brak danych'
              : 'Pobieranie...'

          }

        </span>

      </div>


      <div className="weather-date">

        <strong>
          Dzisiaj
        </strong>

        <span>
          {formatWeatherDate(
            today
          )}
        </span>

      </div>


      {weather && (

        <div className="weather-forecast">

          {weather.daily.time.map(
            (date, index) => (

              <div
                className="forecast-day"
                key={
                  date
                }
              >

                <span>
                  {index === 0
                    ? 'Dziś'
                    : getDayName(date)
                  }
                </span>


                <span className="forecast-icon">

                  {getWeatherIcon(
                    weather.daily.weather_code[index]
                  )}

                </span>


                <strong>
                  {Math.round(
                    weather.daily.temperature_2m_max[index]
                  )}°
                </strong>


                <small>
                  {Math.round(
                    weather.daily.temperature_2m_min[index]
                  )}°
                </small>

              </div>

            )
          )}

        </div>

      )}

    </div>

  )

}


function getWeatherIcon(code) {

  if (
    code === 0
  )
    return '☀️'

  if (
    code === 1 ||
    code === 2
  )
    return '🌤️'

  if (
    code === 3
  )
    return '☁️'

  if (
    code === 45 ||
    code === 48
  )
    return '🌫️'

  if (
    code >= 51 &&
    code <= 57
  )
    return '🌦️'

  if (
    code >= 61 &&
    code <= 67
  )
    return '🌧️'

  if (
    code >= 71 &&
    code <= 77
  )
    return '❄️'

  if (
    code >= 80 &&
    code <= 82
  )
    return '🌦️'

  if (
    code >= 85 &&
    code <= 86
  )
    return '🌨️'

  if (
    code >= 95
  )
    return '⛈️'

  return '🌤️'

}


function getWeatherDescription(code) {

  if (
    code === 0
  )
    return 'Bezchmurnie'

  if (
    code === 1
  )
    return 'Przeważnie słonecznie'

  if (
    code === 2
  )
    return 'Częściowe zachmurzenie'

  if (
    code === 3
  )
    return 'Pochmurno'

  if (
    code === 45 ||
    code === 48
  )
    return 'Mgła'

  if (
    code >= 51 &&
    code <= 57
  )
    return 'Mżawka'

  if (
    code >= 61 &&
    code <= 67
  )
    return 'Deszcz'

  if (
    code >= 71 &&
    code <= 77
  )
    return 'Śnieg'

  if (
    code >= 80 &&
    code <= 82
  )
    return 'Przelotny deszcz'

  if (
    code >= 85 &&
    code <= 86
  )
    return 'Przelotny śnieg'

  if (
    code >= 95
  )
    return 'Burza'

  return 'Zmiennie'

}


function getDayName(date) {

  const days = [
    'Nd',
    'Pon',
    'Wt',
    'Śr',
    'Czw',
    'Pt',
    'Sob',
  ]


  return days[
    new Date(
      `${date}T12:00:00`
    ).getDay()
  ]

}


function formatWeatherDate(date) {

  const parts =
    date.split('-')


  if (
    parts.length !== 3
  )
    return date


  return (
    `${parts[2]}.` +
    `${parts[1]}.` +
    `${parts[0]}`
  )

}



/* =====================================================
   DASHBOARD CARD
   ===================================================== */

function DashboardCard({
  icon,
  label,
  value,
  completed,
  onClick,
}) {

  return (

    <button
      type="button"
      className="dashboard-card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        width: '100%',
        border: 'none',
        font: 'inherit',
      }}
    >

      <div
        className={
          completed
            ? 'dashboard-icon completed'
            : 'dashboard-icon'
        }
      >
        {icon}
      </div>


      <div>

        <span>
          {label}
        </span>


        <strong>
          {value}
        </strong>

      </div>

    </button>

  )

}


const JOB_STAGES = [
  'W toku',
  'Odbiór',
  'Zakończone',
]

function normalizeJobStage(job) {
  if (job?.completed) return 'Zakończone'

  const raw = String(job?.status || '').trim().toLowerCase()

  if (raw === 'planowane' || raw === 'planned') return 'W toku'
  if (raw === 'odbiór' || raw === 'odbior' || raw === 'oczekuje na odbiór') return 'Odbiór'
  if (raw === 'faktura' || raw === 'faktura wystawiona' || raw === 'invoice') return 'Zakończone'
  if (raw === 'zakończone' || raw === 'zakonczone' || raw === 'completed') return 'Zakończone'
  return 'W toku'
}

function getJobStageStyle(stage) {
  switch (stage) {
    case 'Odbiór':
      return { background: '#fff5df', color: '#b77908' }
    case 'Zakończone':
      return { background: '#dcf6e7', color: '#159447' }
    default:
      return { background: '#e9f5ff', color: '#087fce' }
  }
}

/* =====================================================
   JOB CARD
   ===================================================== */

function JobCard({
  job,
  clientName,
  invoices = [],
  onClick,
  onToggleTask,
}) {

  const stage = normalizeJobStage(job)
  const stageStyle = getJobStageStyle(stage)
  const tasks = (Array.isArray(job.notes) ? job.notes : []).filter(Boolean)
  const pendingTasks = tasks.filter((task) => !task.done)
  const completedTaskCount = tasks.filter((task) => task.done).length
  const today = getTodayString()
  const taskPriorityOrder = { urgent: 3, high: 2, normal: 1 }

  const sortTasks = (a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) {
      return a.done ? 1 : -1
    }

    const priorityA = taskPriorityOrder[String(a.priority || 'normal').toLowerCase()] || 1
    const priorityB = taskPriorityOrder[String(b.priority || 'normal').toLowerCase()] || 1

    if (priorityA !== priorityB) {
      return priorityB - priorityA
    }

    const dateA = a.reminderEnabled && a.date ? a.date : ''
    const dateB = b.reminderEnabled && b.date ? b.date : ''
    const overdueA = !a.done && dateA && dateA < today ? 1 : 0
    const overdueB = !b.done && dateB && dateB < today ? 1 : 0

    if (overdueA !== overdueB) {
      return overdueB - overdueA
    }

    if (dateA !== dateB) {
      if (!dateA) return 1
      if (!dateB) return -1
      return dateA.localeCompare(dateB)
    }

    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  }

  const sortedTasks = [...tasks].sort(sortTasks)
  const visibleTasks = sortedTasks.filter((task) => !task.done).slice(0, 3)
  const completedTasks = sortedTasks.filter((task) => task.done)
  const extraCompletedTasks = Math.max(0, completedTasks.length - Math.max(0, 3 - visibleTasks.length))
  const totalValue = calculateTotal(job)
  const progress = Math.max(0, Math.min(100, Number(job.progress) || 0))
  const linkedInvoice = (invoices || []).find(
    (invoice) => String(invoice.jobId) === String(job.id)
  )
  const invoicePaid = Number(linkedInvoice?.paidAmount || 0)
  const invoiceVatSettled = Number(linkedInvoice?.vatSettledAmount || 0)
  const invoiceGross = Number(linkedInvoice?.grossAmount || 0)
  const invoiceSettledTotal = invoicePaid + invoiceVatSettled
  const invoiceRemaining = Math.max(0, invoiceGross - invoiceSettledTotal)
  const invoiceStatusLabel = linkedInvoice
    ? invoiceRemaining <= 0.01
      ? 'Zapłacona'
      : invoicePaid > 0
        ? 'Częściowo zapłacona'
        : linkedInvoice.status || 'Wystawiona'
    : 'Brak faktury'


  return (
    <article className="job-card job-card-with-tasks">
      <button type="button" className="job-card-main" onClick={onClick}>
        <div className="job-card-topline">
          <div className="job-card-identity">
            {job.mainPhoto?.url ? (
              <img
                className="job-card-photo"
                src={job.mainPhoto.url}
                alt={job.mainPhoto.name || job.name}
                title="Zdjęcie główne"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(job.mainPhoto.url, '_blank')
                }}
              />
            ) : (
              <span className="job-card-photo job-card-photo-empty" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="9.5" r="1.5" />
                  <path d="m5 17 4.5-4.5 3.2 3.2 2.2-2.2L19 17" />
                </svg>
              </span>
            )}

            <span className="job-card-identity-text">
              <strong>{job.name}</strong>
              <span>{job.location || 'Brak lokalizacji'}</span>
              {clientName && <small className="job-card-client-name">👤 {clientName}</small>}
            </span>
          </div>

          <span
            className={stage === 'Zakończone' ? 'status completed' : 'status'}
            style={stageStyle}
          >
            <span aria-hidden="true">{stage === 'Zakończone' ? '✓' : '●'}</span>
            {stage === 'Zakończone' ? 'ZAKOŃCZONA' : stage.toUpperCase()}
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '5px',
              fontSize: '11px',
              fontWeight: 800,
              color: job.priority === 'urgent' ? '#b42318' : job.priority === 'high' ? '#9a6800' : '#21804a',
              background: job.priority === 'urgent' ? '#fff0ee' : job.priority === 'high' ? '#fff8e8' : '#edf9f1',
              borderRadius: '999px',
              padding: '4px 8px',
            }}
          >
            {job.priority === 'urgent' ? '🔴 PILNY' : job.priority === 'high' ? '🟠 WYSOKI' : '🟢 NORMALNY'}
          </span>
        </div>

        <div className="job-card-progress">
          <div className="job-card-progress-label">
            <span>Postęp realizacji</span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="job-card-metrics">
          <div>
            <span>MB</span>
            <strong>{job.quantities?.mb || 0}</strong>
          </div>
          <div>
            <span>m²</span>
            <strong>{job.quantities?.m2 || 0}</strong>
          </div>
          <div>
            <span>kg</span>
            <strong>{job.quantities?.kg || 0}</strong>
          </div>
          <div className="job-card-value">
            <span>Wartość</span>
            <strong>{formatMoney(totalValue)}</strong>
          </div>
        </div>

        <div className="job-card-invoice-summary" style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '12px', background: linkedInvoice ? '#f6f9fc' : '#fafafa', border: '1px solid #e5ebf1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#718096', textTransform: 'uppercase' }}>Faktura</span>
            <strong style={{ display: 'block', marginTop: '2px', overflowWrap: 'anywhere' }}>{linkedInvoice?.invoiceNumber || 'Brak faktury'}</strong>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <strong style={{ display: 'block', fontSize: '13px', color: linkedInvoice && invoiceRemaining <= 0.01 ? '#159447' : '#24345c' }}>{linkedInvoice ? formatMoney(invoiceGross) : '—'}</strong>
            <span style={{ display: 'block', fontSize: '11px', color: linkedInvoice && invoiceRemaining > 0.01 ? '#b77908' : '#718096', marginTop: '2px' }}>{invoiceStatusLabel}</span>
          </div>
        </div>


      </button>

      <section className="job-card-tasks" aria-label="Zadania">
        <div className="job-card-tasks-header">
          <div>
            <span className="job-card-tasks-label">ZADANIA</span>
            <strong>
              {pendingTasks.length > 0
                ? `${pendingTasks.length} ${pendingTasks.length === 1 ? 'zadanie do wykonania' : 'zadań do wykonania'}`
                : tasks.length > 0
                  ? 'Wszystkie zadania wykonane'
                  : 'Brak zadań'}
            </strong>
          </div>

          {tasks.length > 0 && (
            <span className="job-card-task-count">
              {completedTaskCount}/{tasks.length}
            </span>
          )}
        </div>

        {tasks.length === 0 ? (
          <button
            type="button"
            className="job-card-add-task-hint"
            onClick={onClick}
          >
            + Dodaj zadanie
          </button>
        ) : (
          <>
            {visibleTasks.map((task) => (
              <div className="job-task-row" key={task.id}>
                <button
                  type="button"
                  className="job-task-checkbox"
                  aria-label="Oznacz jako wykonane"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleTask?.(job, task.id)
                  }}
                />
                <button
                  type="button"
                  className="job-task-text"
                  onClick={onClick}
                >
                  <strong>{task.text}</strong>
                  {(task.assignee || task.priority === 'high' || task.priority === 'urgent') && (
                    <span style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '3px' }}>
                      {task.assignee && <span>👤 {task.assignee}</span>}
                      {task.priority === 'urgent' && <span style={{ color: '#b42318', fontWeight: 800 }}>🔴 pilne</span>}
                      {task.priority === 'high' && <span style={{ color: '#9a6800', fontWeight: 800 }}>🟠 wysoki</span>}
                    </span>
                  )}
                  {task.date && <span>{formatDate(task.date)}</span>}
                </button>
              </div>
            ))}

            {extraCompletedTasks > 0 && (
              <div className="job-card-completed-summary">
                + {extraCompletedTasks} wykonanych
              </div>
            )}

            {(tasks.length > visibleTasks.length || pendingTasks.length === 0) && (
              <button
                type="button"
                className="job-card-more-tasks"
                onClick={onClick}
              >
                {pendingTasks.length === 0 ? 'Zobacz wszystkie zadania →' : 'Pokaż wszystkie zadania →'}
              </button>
            )}
          </>
        )}
      </section>

      <button type="button" className="job-card-open-link" onClick={onClick}>
        <span>Otwórz szczegóły realizacje</span>
        <span aria-hidden="true">→</span>
      </button>
    </article>
  )
}


/* =====================================================
   REALIZACJE
   ===================================================== */

function JobsPage({
  jobs,
  clients,
  invoices = [],
  onOpenJob,
  onToggleJobTask,
  onAddJob,
  deletedJobs,
  onRestoreJob,
  onPermanentDeleteJob,
}) {

  const [filter, setFilter] =
    useState('all')

  const [showTrash, setShowTrash] =
    useState(false)

  useEffect(() => {
    const handleDashboardTab = (event) => {
      const requestedTab = event.detail

      if (
        requestedTab === 'all' ||
        requestedTab === 'planned' ||
        requestedTab === 'active' ||
        requestedTab === 'receipt' ||
        requestedTab === 'completed'
      ) {
        setFilter(requestedTab)
      }
    }

    window.addEventListener(
      'aeroinstal-open-jobs-tab',
      handleDashboardTab
    )

    return () => {
      window.removeEventListener(
        'aeroinstal-open-jobs-tab',
        handleDashboardTab
      )
    }
  }, [])


  const filteredJobs =
    jobs.filter(
      (job) => {

        const stage = normalizeJobStage(job)

        if (filter === 'active') return stage === 'W toku'
        if (filter === 'receipt') return stage === 'Odbiór'
        if (filter === 'completed') return stage === 'Zakończone'

        return true

      }
    )

  const activeCount = jobs.filter((job) => normalizeJobStage(job) === 'W toku').length
  const receiptCount = jobs.filter((job) => normalizeJobStage(job) === 'Odbiór').length
  const completedCount = jobs.filter((job) => normalizeJobStage(job) === 'Zakończone').length


  const filterButtonStyle = (active) => ({
    flex: 1,
    minWidth: 0,
    padding: '11px 10px',
    borderRadius: '999px',
    border: active
      ? '1px solid #0786e6'
      : '1px solid #dce5ec',
    background: active
      ? '#0786e6'
      : '#ffffff',
    color: active
      ? '#ffffff'
      : '#24345c',
    fontSize: '15px',
    fontWeight: 700,
    boxShadow: active
      ? '0 5px 12px rgba(7,134,230,0.18)'
      : 'none',
  })


  return (

    <div
      className="sub-page"
      style={{
        paddingBottom: '130px',
      }}
    >

      <div className="page-heading">

        <div>

          <div className="small-label">
            MOJA FIRMA
          </div>

          <h1>
            Realizacje
          </h1>

        </div>


        <button
          type="button"
          className="edit-button"
          onClick={onAddJob}
          style={{
            padding: '11px 17px',
            borderRadius: '999px',
            fontSize: '15px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          + Nowa realizacja
        </button>

      </div>


      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => setShowTrash((value) => !value)}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#168fe5',
            fontSize: '14px',
            fontWeight: 700,
            padding: '6px 2px',
            cursor: 'pointer',
          }}
        >
          🗑️ {showTrash ? 'Ukryj kosz' : `Kosz${deletedJobs?.length ? ` (${deletedJobs.length})` : ''}`}
        </button>
      </div>

      {showTrash && (
        <div
          style={{
            marginBottom: '18px',
            padding: '16px',
            borderRadius: '20px',
            background: '#ffffff',
            border: '1px solid #dce5ec',
            boxShadow: '0 6px 18px rgba(18,35,79,0.06)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}
          >
            <div>
              <div
                style={{
                  color: '#12234f',
                  fontSize: '18px',
                  fontWeight: 800,
                }}
              >
                🗑️ Kosz
              </div>
              <div
                style={{
                  color: '#657491',
                  fontSize: '13px',
                  marginTop: '3px',
                }}
              >
                Realizacje są przechowywane przez 30 dni.
              </div>
            </div>
          </div>

          {(!deletedJobs || deletedJobs.length === 0) && (
            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                background: '#f7f9fb',
                color: '#657491',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              Kosz jest pusty.
            </div>
          )}

          {(deletedJobs || []).map((job) => (
            <div
              key={job.id}
              style={{
                padding: '14px 0',
                borderTop: '1px solid #edf1f5',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: '#12234f',
                      fontSize: '16px',
                      fontWeight: 800,
                    }}
                  >
                    {job.name}
                  </div>
                  <div
                    style={{
                      color: '#657491',
                      fontSize: '13px',
                      marginTop: '2px',
                    }}
                  >
                    {job.location || 'Brak lokalizacji'}
                  </div>
                  <div
                    style={{
                      color: '#9aa7b8',
                      fontSize: '12px',
                      marginTop: '5px',
                    }}
                  >
                    Usunięto:{' '}
                    {job.deletedAt
                      ? new Date(job.deletedAt).toLocaleDateString('pl-PL')
                      : '—'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '7px',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onRestoreJob(job)}
                    style={{
                      border: '1px solid #cfe7da',
                      background: '#eefaf3',
                      color: '#168a4b',
                      borderRadius: '12px',
                      padding: '9px 11px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    ↩ Przywróć
                  </button>
                  <button
                    type="button"
                    onClick={() => onPermanentDeleteJob(job)}
                    style={{
                      border: '1px solid #f1d0d0',
                      background: '#fff5f5',
                      color: '#c43d3d',
                      borderRadius: '12px',
                      padding: '9px 11px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Usuń na zawsze
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="job-filters"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '8px',
          marginBottom: '10px',
          width: '100%',
        }}
      >

        <button
          type="button"
          style={filterButtonStyle(filter === 'all')}
          onClick={() => setFilter('all')}
        >
          Wszystkie
        </button>


        <button
          type="button"
          style={filterButtonStyle(filter === 'active')}
          onClick={() => setFilter('active')}
        >
          W toku
        </button>

        <button
          type="button"
          style={filterButtonStyle(filter === 'receipt')}
          onClick={() => setFilter('receipt')}
        >
          Odbiór
        </button>

        <button
          type="button"
          style={filterButtonStyle(filter === 'completed')}
          onClick={() => setFilter('completed')}
        >
          Zakończone
        </button>

      </div>


      <div
        className="job-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: '8px',
          marginBottom: '16px',
          width: '100%',
        }}
      >
        <div className="job-summary-item">
          <strong>{jobs.length}</strong>
          <span>{jobs.length === 1 ? 'realizacja' : 'robót'}</span>
        </div>
        <div className="job-summary-item">
          <strong>{activeCount}</strong>
          <span>w toku</span>
        </div>
        <div className="job-summary-item">
          <strong>{receiptCount}</strong>
          <span>odbiór</span>
        </div>
        <div className="job-summary-item">
          <strong>{completedCount}</strong>
          <span>zakończonych</span>
        </div>
      </div>


      <div className="jobs">

        {filteredJobs.length === 0 && (

          <div className="detail-card">
            Brak robót w tej kategorii.
          </div>

        )}


        {filteredJobs.map(
          (job) => (
            <JobCard
              key={job.id}
              job={job}
              clientName={(clients || []).find((client) => String(client.id) === String(job.clientId || ''))?.shortName || (clients || []).find((client) => String(client.id) === String(job.clientId || ''))?.name || ''}
              onClick={() => onOpenJob(job)}
              onToggleTask={onToggleJobTask}
              invoices={invoices}
            />
          )
        )}

      </div>

    </div>

  )

}


/* =====================================================
   NOWA REALIZACJA
   ===================================================== */

function NewJobPage({
  newJob,
  setNewJob,
  settings,
  clients,
  onBack,
  onCreate,
}) {

  useEffect(() => {
    setNewJob((current) => ({
      ...current,
      rates: {
        mb: settings.rates.mb,
        m2: settings.rates.m2,
        kg: settings.rates.kg,
      },
    }))
  }, [])

  const total =

    (Number(
      newJob.quantities.mb
    ) || 0) *

      (Number(
        newJob.rates.mb
      ) || 0)

    +

    (Number(
      newJob.quantities.m2
    ) || 0) *

      (Number(
        newJob.rates.m2
      ) || 0)

    +

    (Number(
      newJob.quantities.kg
    ) || 0) *

      (Number(
        newJob.rates.kg
      ) || 0)


  const change = (
    field,
    value
  ) => {

    setNewJob({

      ...newJob,

      [field]:
        value,

    })

  }


  const changeQuantity = (
    field,
    value
  ) => {

    setNewJob({

      ...newJob,

      quantities: {

        ...newJob.quantities,

        [field]:
          value,

      },

    })

  }


  const changeRate = (
    field,
    value
  ) => {

    setNewJob({

      ...newJob,

      rates: {

        ...newJob.rates,

        [field]:
          value,

      },

    })

  }


  return (

    <div className="sub-page">

      <div className="details-top">

        <button

          className="back-button"

          onClick={
            onBack
          }

        >
          ← Wróć
        </button>

      </div>


      <div className="page-heading">

        <div>

          <div className="small-label">
            NOWA REALIZACJA
          </div>

          <h1>
            Dodaj realizację
          </h1>

        </div>

      </div>


      <div className="detail-card">

        <h2>
          Podstawowe informacje
        </h2>


        <div className="note-form new-job-basic-form">

          <input

            className="job-new-input"

            placeholder="Nazwa realizacje"

            value={
              newJob.name
            }

            onChange={(e) =>
              change(
                'name',
                e.target.value
              )
            }

          />


          <input

            className="job-new-input"

            placeholder="Lokalizacja / statek"

            value={
              newJob.location
            }

            onChange={(e) =>
              change(
                'location',
                e.target.value
              )
            }

          />

          <select
            className="job-new-input"
            value={newJob.clientId || ''}
            onChange={(e) => change('clientId', e.target.value || null)}
          >
            <option value="">Klient — opcjonalnie</option>
            {(clients || []).map((client) => (
              <option key={client.id} value={client.id}>{client.shortName || client.name}</option>
            ))}
          </select>

          <select
            className="job-new-input"
            value={newJob.priority || 'normal'}
            onChange={(e) => change('priority', e.target.value)}
          >
            <option value="normal">🟢 Normalny priorytet</option>
            <option value="high">🟠 Wysoki priorytet</option>
            <option value="urgent">🔴 Pilny priorytet</option>
          </select>

        </div>

      </div>


      <div className="detail-card">

        <h2>
          Zakres realizacje
        </h2>


        <div className="detail-quantities">

          <div className="quantity-box">

            <span>
              MB
            </span>

            <input

              type="text"

              inputMode="decimal"

              value={
                newJob.quantities.mb
              }

              onChange={(e) =>
                changeQuantity(
                  'mb',
                  e.target.value
                )
              }

            />

          </div>


          <div className="quantity-box">

            <span>
              m²
            </span>

            <input

              type="text"

              inputMode="decimal"

              value={
                newJob.quantities.m2
              }

              onChange={(e) =>
                changeQuantity(
                  'm2',
                  e.target.value
                )
              }

            />

          </div>


          <div className="quantity-box">

            <span>
              kg
            </span>

            <input

              type="text"

              inputMode="decimal"

              value={
                newJob.quantities.kg
              }

              onChange={(e) =>
                changeQuantity(
                  'kg',
                  e.target.value
                )
              }

            />

          </div>

        </div>

      </div>


      <div className="detail-card">

        <h2>
          Stawki
        </h2>


        <div className="finance-row new-job-rate-row">

          <div className="new-job-rate-heading">

            <strong>
              MB
            </strong>

            <small>
              {newJob.quantities.mb || 0} MB
            </small>

          </div>


          <div className="new-job-rate-input-wrap">

            <input
              className="rate-input"
              type="text"
              inputMode="decimal"
              value={newJob.rates.mb}
              onChange={(e) =>
                changeRate(
                  'mb',
                  e.target.value
                )
              }
            />

            <span className="new-job-rate-unit">
              zł / MB
            </span>

          </div>


          <div className="new-job-rate-total">
            <span>Wartość</span>
            <strong>
              {formatMoney(
                (Number(newJob.quantities.mb) || 0) *
                (Number(newJob.rates.mb) || 0)
              )}
            </strong>
          </div>

        </div>


        <div className="finance-row new-job-rate-row">

          <div className="new-job-rate-heading">

            <strong>
              m²
            </strong>

            <small>
              {newJob.quantities.m2 || 0} m²
            </small>

          </div>


          <div className="new-job-rate-input-wrap">

            <input
              className="rate-input"
              type="text"
              inputMode="decimal"
              value={newJob.rates.m2}
              onChange={(e) =>
                changeRate(
                  'm2',
                  e.target.value
                )
              }
            />

            <span className="new-job-rate-unit">
              zł / m²
            </span>

          </div>


          <div className="new-job-rate-total">
            <span>Wartość</span>
            <strong>
              {formatMoney(
                (Number(newJob.quantities.m2) || 0) *
                (Number(newJob.rates.m2) || 0)
              )}
            </strong>
          </div>

        </div>


        <div className="finance-row new-job-rate-row">

          <div className="new-job-rate-heading">

            <strong>
              kg
            </strong>

            <small>
              {newJob.quantities.kg || 0} kg
            </small>

          </div>


          <div className="new-job-rate-input-wrap">

            <input
              className="rate-input"
              type="text"
              inputMode="decimal"
              value={newJob.rates.kg}
              onChange={(e) =>
                changeRate(
                  'kg',
                  e.target.value
                )
              }
            />

            <span className="new-job-rate-unit">
              zł / kg
            </span>

          </div>


          <div className="new-job-rate-total">
            <span>Wartość</span>
            <strong>
              {formatMoney(
                (Number(newJob.quantities.kg) || 0) *
                (Number(newJob.rates.kg) || 0)
              )}
            </strong>
          </div>

        </div>


        <div className="job-footer">

          <span>
            Łączna wartość
          </span>

          <strong>
            {formatMoney(
              total
            )}
          </strong>

        </div>

      </div>


      <button

        className="save-button"

        onClick={
          onCreate
        }

      >
        Utwórz realizację
      </button>

    </div>

  )

}


/* =====================================================
   SZCZEGÓŁY REALIZACJE
   ===================================================== */

function JobDetails({
  job,
  clients,
  company,
  invoices = [],
  onCreateInvoice,
  onOpenInvoice,
  onBack,
  onUpdate,
  onDelete,
}) {

  const [editedJob, setEditedJob] =
    useState(job)


  const [editing, setEditing] =
    useState(false)


  const materialInputRef =
    useRef(null)


  const assemblyInputRef =
    useRef(null)


  const photoInputRef =
    useRef(null)


  const mainPhotoInputRef =
    useRef(null)


  const [showNoteForm, setShowNoteForm] =
    useState(false)


  const [editingNoteId, setEditingNoteId] =
    useState(null)


  const [editingNoteText, setEditingNoteText] =
    useState('')


  const [newNote, setNewNote] =
    useState({

      text: '',

      assignee: '',

      priority: 'normal',

      reminderEnabled: false,

      date: '',

      time: '',

    })


  useEffect(() => {

    setEditedJob(
      job
    )

  }, [job])

  const linkedInvoice = (invoices || []).find(
    (invoice) => String(invoice.jobId) === String(job.id)
  ) || null
  const [jobCosts, setJobCosts] = useState([])
  const [showCostForm, setShowCostForm] = useState(false)
  const [editingCostId, setEditingCostId] = useState(null)
  const [costForm, setCostForm] = useState({
    costType: 'material',
    description: '',
    quantity: '1',
    unit: 'szt.',
    unitCost: '',
    costDate: getTodayString(),
  })

  useEffect(() => {
    let cancelled = false
    getJobCosts(job.id)
      .then((costs) => {
        if (!cancelled) setJobCosts(costs)
      })
      .catch((error) => console.error('Nie udało się wczytać kosztów realizacji:', error))
    return () => { cancelled = true }
  }, [job.id])

  const totalJobCosts = jobCosts.reduce(
    (sum, cost) => sum + Number(cost.totalCost || 0),
    0
  )
  const jobRevenue = calculateTotal(editedJob)
  const jobProfit = jobRevenue - totalJobCosts

  const resetCostForm = () => {
    setCostForm({
      costType: 'material',
      description: '',
      quantity: '1',
      unit: 'szt.',
      unitCost: '',
      costDate: getTodayString(),
    })
    setEditingCostId(null)
    setShowCostForm(false)
  }

  const saveJobCost = async () => {
    const description = String(costForm.description || '').trim()
    const quantity = parseDecimal(costForm.quantity)
    const unitCost = parseDecimal(costForm.unitCost)

    if (!description) {
      showCustomAlert('Podaj nazwę kosztu.')
      return
    }
    if (quantity <= 0 || unitCost < 0) {
      showCustomAlert('Podaj prawidłową ilość i koszt jednostkowy.')
      return
    }

    try {
      const payload = {
        id: editingCostId || undefined,
        jobId: editedJob.id,
        costType: costForm.costType,
        description,
        quantity,
        unit: costForm.unit || 'szt.',
        unitCost,
        costDate: costForm.costDate || null,
      }

      const saved = editingCostId
        ? await updateJobCost(payload)
        : await createJobCost(payload)

      setJobCosts((current) =>
        editingCostId
          ? current.map((item) => String(item.id) === String(saved.id) ? saved : item)
          : [saved, ...current]
      )
      resetCostForm()
    } catch (error) {
      console.error('Nie udało się zapisać kosztu realizacji:', error)
      showCustomAlert('Nie udało się zapisać kosztu. Spróbuj ponownie.')
    }
  }

  const startEditJobCost = (cost) => {
    setEditingCostId(cost.id)
    setCostForm({
      costType: cost.costType || 'other',
      description: cost.description || '',
      quantity: String(cost.quantity ?? 1),
      unit: cost.unit || 'szt.',
      unitCost: String(cost.unitCost ?? 0),
      costDate: cost.costDate || '',
    })
    setShowCostForm(true)
  }

  const removeJobCost = async (cost) => {
    const confirmed = await showCustomConfirm('Usunąć ten koszt z realizacji?')
    if (!confirmed) return

    try {
      await deleteJobCost(cost.id)
      setJobCosts((current) => current.filter((item) => String(item.id) !== String(cost.id)))
    } catch (error) {
      console.error('Nie udało się usunąć kosztu realizacji:', error)
      showCustomAlert('Nie udało się usunąć kosztu. Spróbuj ponownie.')
    }
  }

  const saveChanges = async () => {
    if (!editedJob.name.trim()) {

      showCustomAlert(
        'Podaj nazwę realizacje.'
      )

      return

    }


    const updatedJob = {

      ...editedJob,

      name:
        editedJob.name.trim(),

      location:
        editedJob.location.trim() ||
        'Brak lokalizacji',

      progress:
        Math.min(
          100,
          Math.max(
            0,
            Number(
              editedJob.progress
            ) || 0
          )
        ),

      quantities: {

        mb:
          parseDecimal(
            editedJob.quantities.mb
          ) || 0,

        m2:
          parseDecimal(
            editedJob.quantities.m2
          ) || 0,

        kg:
          parseDecimal(
            editedJob.quantities.kg
          ) || 0,

      },

      rates: {

        mb:
          parseDecimal(
            editedJob.rates.mb
          ) || 0,

        m2:
          parseDecimal(
            editedJob.rates.m2
          ) || 0,

        kg:
          parseDecimal(
            editedJob.rates.kg
          ) || 0,

      },

      status:
        normalizeJobStage(editedJob),

      completed:
        normalizeJobStage(editedJob) === 'Zakończone',

      completedAt:
        normalizeJobStage(editedJob) === 'Zakończone'
          ? (editedJob.completedAt || getTodayString())
          : null,

    }


    onUpdate(
      updatedJob
    )

    setEditedJob(
      updatedJob
    )

    setEditing(
      false
    )

  }


  const changeStage = async (nextStage) => {
    const today = getTodayString()
    const isCompleted = nextStage === 'Zakończone'

    const updatedJob = {
      ...editedJob,
      status: nextStage,
      completed: isCompleted,
      completedAt: isCompleted
        ? (editedJob.completedAt || today)
        : null,
      // Zamknięta realizacja musi mieć pełny postęp.
      // Dzięki temu etap i procent postępu nie mogą się wzajemnie wykluczać.
      progress: isCompleted
        ? 100
        : Math.min(100, Math.max(0, Number(editedJob.progress || 0))),
    }

    onUpdate(updatedJob)
    setEditedJob(updatedJob)
  }

  const nextStage = normalizeJobStage(editedJob) === 'W toku'
      ? 'Odbiór'
      : normalizeJobStage(editedJob) === 'Odbiór'
        ? 'Zakończone'
        : null

  const updateQuantity = (
    field,
    value
  ) => {

    setEditedJob({

      ...editedJob,

      quantities: {

        ...editedJob.quantities,

        [field]:
          value,

      },

    })

  }


  const updateRate = (
    field,
    value
  ) => {

    setEditedJob({

      ...editedJob,

      rates: {

        ...editedJob.rates,

        [field]:
          value,

      },

    })

  }


  const addDocument = async (
    type,
    file
  ) => {

    if (!file)
      return

    try {

      const oldDocument =
        editedJob.documents?.[type] || null

      const uploadedDocument =
        await uploadSupabaseFile(
          editedJob.id,
          `documents/${type}`,
          file
        )

      const document = {
        name: file.name,
        type: file.type,
        size: file.size,
        url: uploadedDocument.url,
        path: uploadedDocument.path,
      }

      if (oldDocument?.path) {
        try {
          await deleteSupabaseFile(oldDocument.path)
        } catch (error) {
          console.error(
            'Nie udało się usunąć poprzedniego dokumentu ze Storage:',
            error
          )
        }
      }

      const updatedJob = {
        ...editedJob,

        documents: {
          ...editedJob.documents,

          [type]:
            document,

        },

      }

      setEditedJob(
        updatedJob
      )

      onUpdate(
        updatedJob
      )

    } catch (error) {

      console.error(
        'Nie udało się wysłać dokumentu do Supabase Storage:',
        error
      )

      showCustomAlert(
        'Nie udało się wysłać dokumentu do Supabase. Spróbuj ponownie.'
      )

    }

  }


  const removeDocument = async (
    type
  ) => {

    const document =
      editedJob.documents?.[type]

    if (!document)
      return

    try {

      if (document.path) {
        await deleteSupabaseFile(
          document.path
        )
      }

      const updatedJob = {

        ...editedJob,

        documents: {

          ...editedJob.documents,

          [type]:
            null,

        },

      }

      setEditedJob(
        updatedJob
      )

      onUpdate(
        updatedJob
      )

    } catch (error) {

      console.error(
        'Nie udało się usunąć dokumentu ze Storage:',
        error
      )

      showCustomAlert(
        'Nie udało się usunąć dokumentu. Spróbuj ponownie.'
      )

    }

  }


  const renameDocument = async (
    type
  ) => {

    const document =
      editedJob.documents?.[type]

    if (!document)
      return

    const newName =
      await showCustomPrompt(
        'Nowa nazwa pliku:',
        document.name
      )

    if (
      !newName ||
      !newName.trim()
    )
      return

    const updatedJob = {

      ...editedJob,

      documents: {

        ...editedJob.documents,

        [type]: {

          ...document,

          name:
            newName.trim(),

        },

      },

    }

    setEditedJob(
      updatedJob
    )

    onUpdate(
      updatedJob
    )

  }


  const addMainPhoto = async (
    file
  ) => {

    if (!file)
      return

    try {

      const oldMainPhoto =
        editedJob.mainPhoto || null

      const uploadedPhoto =
        await uploadSupabaseFile(
          editedJob.id,
          'main',
          file
        )

      const mainPhoto = {

        name:
          file.name,

        type:
          file.type,

        size:
          file.size,

        url:
          uploadedPhoto.url,

        path:
          uploadedPhoto.path,

      }

      if (oldMainPhoto?.path) {
        try {
          await deleteSupabaseFile(
            oldMainPhoto.path
          )
        } catch (error) {
          console.error(
            'Nie udało się usunąć poprzedniego zdjęcia głównego ze Storage:',
            error
          )
        }
      }

      const updatedJob = {

        ...editedJob,

        mainPhoto,

      }

      setEditedJob(
        updatedJob
      )

      onUpdate(
        updatedJob
      )

    } catch (error) {

      console.error(
        'Nie udało się wysłać zdjęcia głównego do Supabase Storage:',
        error
      )

      showCustomAlert(
        'Nie udało się wysłać zdjęcia głównego do Supabase. Spróbuj ponownie.'
      )

    }

  }


  const handleMainPhotoPaste = async (event) => {
    const items = Array.from(event.clipboardData?.items || [])

    const imageItem = items.find(
      (item) =>
        item.type &&
        item.type.startsWith('image/')
    )

    if (!imageItem) {
      return
    }

    const file = imageItem.getAsFile()

    if (!file) {
      return
    }

    event.preventDefault()

    await addMainPhoto(file)
  }


  const removeMainPhoto = async () => {

    const mainPhoto =
      editedJob.mainPhoto

    if (!mainPhoto)
      return

    try {

      if (mainPhoto.path) {
        await deleteSupabaseFile(
          mainPhoto.path
        )
      }

      const updatedJob = {

        ...editedJob,

        mainPhoto: null,

      }

      setEditedJob(
        updatedJob
      )

      onUpdate(
        updatedJob
      )

    } catch (error) {

      console.error(
        'Nie udało się usunąć zdjęcia głównego ze Storage:',
        error
      )

      showCustomAlert(
        'Nie udało się usunąć zdjęcia głównego. Spróbuj ponownie.'
      )

    }

  }


  const addPhoto = async (
    file
  ) => {

    if (!file)
      return

    try {

      const uploadedPhoto =
        await uploadSupabaseFile(
          editedJob.id,
          'photos',
          file
        )

      const photo = {

        id:
          typeof crypto !== 'undefined' &&
          crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,

        name:
          file.name,

        type:
          file.type,

        size:
          file.size,

        url:
          uploadedPhoto.url,

        path:
          uploadedPhoto.path,

      }

      /*
       * Zdjęcie jest dopisywane atomowo
       * przez funkcję Supabase.
       *
       * Nie zapisujemy tutaj całego editedJob,
       * dzięki czemu dwóch użytkowników nie może
       * nadpisać sobie wzajemnie zdjęć.
       */

      const savedJob =
        await appendSupabaseJobPhoto(
          editedJob.id,
          photo
        )

      /*
       * Supabase zwraca pełną, aktualną wersję
       * realizacje wraz ze wszystkimi zdjęciami.
       */

      setEditedJob(
        savedJob
      )

      /*
       * Aktualizujemy tylko stan aplikacji.
       * Nie wysyłamy ponownie całej realizacje do Supabase.
       */

      onUpdate(
        savedJob,
        {
          skipSupabase: true,
        }
      )

    } catch (error) {

      console.error(
        'Nie udało się wysłać zdjęcia do Supabase Storage:',
        error
      )

      showCustomAlert(
        'Nie udało się wysłać zdjęcia do Supabase. Spróbuj ponownie.'
      )

    }

  }


  const renamePhoto = async (
    photoId
  ) => {

    const photo =
      (editedJob.photos || [])
        .find(
          (item) =>
            String(item.id) === String(photoId)
        )

    if (!photo)
      return

    const newName =
      await showCustomPrompt(
        'Nowa nazwa pliku:',
        photo.name
      )

    if (
      !newName ||
      !newName.trim()
    )
      return

    const updatedJob = {

      ...editedJob,

      photos:
        (editedJob.photos || [])
          .map(
            (item) =>

              String(item.id) === String(photoId)

                ? {
                    ...item,
                    name:
                      newName.trim(),
                  }

                : item

          ),

    }

    setEditedJob(
      updatedJob
    )

    onUpdate(
      updatedJob
    )

  }


  const removePhoto = async (
    photoId
  ) => {

    const photo =
      (editedJob.photos || [])
        .find(
          (item) =>
            String(item.id) === String(photoId)
        )

    if (!photo)
      return

    try {

      if (photo.path) {
        await deleteSupabaseFile(
          photo.path
        )
      }

      const updatedJob = {

        ...editedJob,

        photos:
          (editedJob.photos || [])
            .filter(
              (item) =>
                String(item.id) !== String(photoId)
            ),

      }

      setEditedJob(
        updatedJob
      )

      onUpdate(
        updatedJob
      )

    } catch (error) {

      console.error(
        'Nie udało się usunąć zdjęcia ze Storage:',
        error
      )

      showCustomAlert(
        'Nie udało się usunąć zdjęcia. Spróbuj ponownie.'
      )

    }

  }


  const addNote = () => {

    setNewNote({

      text: '',

      assignee: '',

      priority: 'normal',

      reminderEnabled: false,

      date: '',

      time: '',

    })

    setShowNoteForm(
      true
    )

  }


  const saveNote = async () => {

    if (!newNote.text.trim()) {
      return
    }

    const note = {
      id:
        typeof crypto !== 'undefined' &&
        crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,

      text:
        newNote.text.trim(),

      assignee:
        newNote.assignee || '',

      priority:
        newNote.priority || 'normal',

      done:
        false,

      createdAt:
        new Date().toISOString(),

      reminderEnabled:
        Boolean(newNote.reminderEnabled),

      date:
        newNote.reminderEnabled
          ? (newNote.date || getTodayString())
          : '',

      time:
        newNote.reminderEnabled
          ? (newNote.time || '')
          : '',
    }

    try {
      const savedJob =
        await appendSupabaseJobNote(
          editedJob.id,
          note
        )

      setEditedJob(savedJob)

      onUpdate(savedJob, {
        skipSupabase: true,
      })

      setShowNoteForm(false)

      setNewNote({
        text: '',
        assignee: '',
        priority: 'normal',
        reminderEnabled: false,
        date: '',
        time: '',
      })
    } catch (error) {
      console.error(
        'Nie udało się zapisać notatki w Supabase:',
        error
      )

      showCustomAlert(
        'Nie udało się zapisać notatki. Spróbuj ponownie.'
      )
    }
  }


  const startEditNote = (
    note
  ) => {

    setEditingNoteId(
      note.id
    )

    setEditingNoteText(
      note.text || ''
    )

  }


  const cancelEditNote = () => {

    setEditingNoteId(
      null
    )

    setEditingNoteText(
      ''
    )

  }


  const saveEditedNote = async (
    noteId
  ) => {

    if (!editingNoteText.trim()) {
      return
    }

    try {
      const savedJob =
        await updateSupabaseJobNote(
          editedJob.id,
          noteId,
          {
            text: editingNoteText.trim(),
          }
        )

      setEditedJob(savedJob)

      onUpdate(savedJob, {
        skipSupabase: true,
      })

      cancelEditNote()
    } catch (error) {
      console.error(
        'Nie udało się zmienić notatki w Supabase:',
        error
      )

      showCustomAlert(
        'Nie udało się zmienić notatki. Spróbuj ponownie.'
      )
    }
  }

  const toggleNoteReminder = async (
    noteId
  ) => {

    const note =
      (editedJob.notes || []).find(
        (item) =>
          String(item.id) === String(noteId)
      )

    if (!note) {
      return
    }

    const enabled =
      !Boolean(note.reminderEnabled)

    const patch = {
      reminderEnabled: enabled,
      date: enabled
        ? (note.date || getTodayString())
        : '',
      time: enabled
        ? (note.time || '')
        : '',
    }

    try {
      const savedJob =
        await updateSupabaseJobNote(
          editedJob.id,
          noteId,
          patch
        )

      setEditedJob(savedJob)

      onUpdate(savedJob, {
        skipSupabase: true,
      })
    } catch (error) {
      console.error(
        'Nie udało się zmienić przypomnienia notatki:',
        error
      )

      showCustomAlert(
        'Nie udało się zmienić przypomnienia. Spróbuj ponownie.'
      )
    }
  }


  const updateNoteReminder = async (
    noteId,
    field,
    value
  ) => {

    try {
      const savedJob =
        await updateSupabaseJobNote(
          editedJob.id,
          noteId,
          {
            reminderEnabled: true,
            [field]: value,
          }
        )

      setEditedJob(savedJob)

      onUpdate(savedJob, {
        skipSupabase: true,
      })
    } catch (error) {
      console.error(
        'Nie udało się zmienić terminu przypomnienia:',
        error
      )

      showCustomAlert(
        'Nie udało się zmienić terminu przypomnienia. Spróbuj ponownie.'
      )
    }
  }


  const toggleNote = async (
    noteId
  ) => {

    const note =
      (editedJob.notes || []).find(
        (item) =>
          String(item.id) === String(noteId)
      )

    if (!note) {
      return
    }

    try {
      const savedJob =
        await updateSupabaseJobNote(
          editedJob.id,
          noteId,
          {
            done: !Boolean(note.done),
          }
        )

      setEditedJob(savedJob)

      onUpdate(savedJob, {
        skipSupabase: true,
      })
    } catch (error) {
      console.error(
        'Nie udało się zmienić statusu notatki:',
        error
      )

      showCustomAlert(
        'Nie udało się zmienić statusu notatki. Spróbuj ponownie.'
      )
    }
  }

  const removeNote = async (
    noteId
  ) => {
    if (!noteId || !editedJob?.id) return

    // Usuwamy od razu — bez zależności od okna potwierdzenia,
    // które na telefonie mogło blokować dalsze wykonanie.
    try {
      const savedJob =
        await deleteSupabaseJobNote(
          editedJob.id,
          noteId
        )

      setEditedJob(savedJob)

      onUpdate(savedJob, {
        skipSupabase: true,
      })
    } catch (error) {
      console.error(
        'Nie udało się usunąć notatki z Supabase:',
        error
      )

      showCustomAlert(
        'Nie udało się usunąć zadania. Spróbuj ponownie.'
      )
    }
  }


  return (

    <div className="sub-page">

      <div className="details-top">

        <button

          className="back-button"

          onClick={
            onBack
          }

        >
          ← Wróć
        </button>


        <button

          className="edit-button"

          onClick={() =>
            setEditing(
              !editing
            )
          }

        >
          {editing
            ? 'Anuluj'
            : 'Edytuj'
          }

        </button>

      </div>


      <div className="small-label">
        REALIZACJA
      </div>


      {editing ? (

        <div className="note-form">

          <input

            className="note-text-input job-edit-input"

            placeholder="Nazwa realizacje"

            value={
              editedJob.name
            }

            onChange={(e) =>
              setEditedJob({

                ...editedJob,

                name:
                  e.target.value,

              })
            }

          />


          <input

            className="note-text-input job-edit-input"

            placeholder="Lokalizacja / statek"

            value={
              editedJob.location
            }

            onChange={(e) =>
              setEditedJob({

                ...editedJob,

                location:
                  e.target.value,

              })
            }

          />

          <select
            className="note-text-input job-edit-input"
            value={editedJob.clientId || ''}
            onChange={(e) =>
              setEditedJob({
                ...editedJob,
                clientId: e.target.value || null,
              })
            }
          >
            <option value="">Klient — brak przypisania</option>
            {(clients || []).map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>

          <select
            className="note-text-input job-edit-input"
            value={editedJob.priority || 'normal'}
            onChange={(e) =>
              setEditedJob({
                ...editedJob,
                priority: e.target.value,
              })
            }
          >
            <option value="normal">🟢 Normalny priorytet</option>
            <option value="high">🟠 Wysoki priorytet</option>
            <option value="urgent">🔴 Pilny priorytet</option>
          </select>

        </div>

      ) : (

        <>

          <h1>
            {editedJob.name}
          </h1>


          <div className="job-location">
            {editedJob.location}
          </div>

          {editedJob.clientId && (
            <div className="job-client-detail">
              👤 {(clients || []).find((client) => String(client.id) === String(editedJob.clientId))?.shortName || (clients || []).find((client) => String(client.id) === String(editedJob.clientId))?.name || 'Klient'}
            </div>
          )}

        </>

      )}


      {editedJob.completed &&
        editedJob.completedAt && (

          <div className="completed-date">

            Zakończona{' '}

            {formatDate(
              editedJob.completedAt
            )}

          </div>

        )
      }


      {/* ETAP I ROZLICZENIE */}

      <div className="detail-card job-stage-card">
        <div className="detail-title">
          <h2>Etap realizacje</h2>
          <span
            className="job-stage-pill"
            style={getJobStageStyle(normalizeJobStage(editedJob))}
          >
            {normalizeJobStage(editedJob)}
          </span>
        </div>

        {editing ? (
          <label className="job-stage-select-label">
            <span>Aktualny etap</span>
            <select
              value={normalizeJobStage(editedJob)}
              onChange={(e) => {
                const value = e.target.value
                setEditedJob({
                  ...editedJob,
                  status: value,
                  completed: value === 'Zakończone',
                  completedAt: value === 'Zakończone'
                    ? (editedJob.completedAt || getTodayString())
                    : null,
                })
              }}
            >
              {JOB_STAGES.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="job-stage-steps">
            {JOB_STAGES.map((stage, index) => (
              <div
                key={stage}
                className={index <= JOB_STAGES.indexOf(normalizeJobStage(editedJob)) ? 'job-stage-step active' : 'job-stage-step'}
              >
                <span>{index + 1}</span>
                <strong>{stage}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="detail-card" style={{ marginTop: '14px' }}>
        <div className="detail-title">
          <div>
            <div className="small-label">FAKTURA</div>
            <h2 style={{ marginBottom: '4px' }}>{linkedInvoice?.invoiceNumber || 'Brak faktury'}</h2>
          </div>
          {linkedInvoice && (
            <span style={{ fontSize: '12px', fontWeight: 800, color: (Number(linkedInvoice.paidAmount || 0) + Number(linkedInvoice.vatSettledAmount || 0)) >= Number(linkedInvoice.grossAmount || 0) - 0.01 ? '#159447' : '#b77908' }}>
              {(Number(linkedInvoice.paidAmount || 0) + Number(linkedInvoice.vatSettledAmount || 0)) >= Number(linkedInvoice.grossAmount || 0) - 0.01
                ? 'Zapłacona'
                : (Number(linkedInvoice.paidAmount || 0) + Number(linkedInvoice.vatSettledAmount || 0)) > 0
                  ? 'Częściowo zapłacona'
                  : linkedInvoice.status || 'Wystawiona'}
            </span>
          )}
        </div>
        {linkedInvoice ? (
          <>
            {(() => {
              const invoiceNet = Math.max(0, Number(linkedInvoice.netAmount || 0))
              const invoiceVat = Math.max(0, Number(linkedInvoice.vatAmount || 0))
              const invoiceGross = Math.max(0, Number(linkedInvoice.grossAmount || 0))
              const invoicePaid = Math.min(invoiceGross, Math.max(0, Number(linkedInvoice.paidAmount || 0)))
              const vatSettled = Math.min(invoiceVat, Math.max(0, Number(linkedInvoice.vatSettledAmount || 0)))
              const netPaid = Math.min(invoiceNet, invoicePaid)
              const remainingNet = Math.max(0, invoiceNet - netPaid)

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#718096', fontWeight: 800, textTransform: 'uppercase' }}>Netto</span>
                      <strong>{formatMoney(invoiceNet)}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#718096', fontWeight: 800, textTransform: 'uppercase' }}>Brutto</span>
                      <strong>{formatMoney(invoiceGross)}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#718096', fontWeight: 800, textTransform: 'uppercase' }}>Otrzymano</span>
                      <strong>{formatMoney(netPaid)}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', color: '#718096', fontWeight: 800, textTransform: 'uppercase' }}>VAT rozliczony</span>
                      <strong>{formatMoney(vatSettled)}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '14px', background: remainingNet > 0.01 ? '#fff8e8' : '#edf9f1', border: remainingNet > 0.01 ? '1px solid #f0d58a' : '1px solid #b9e3c7' }}>
                    <span style={{ display: 'block', fontSize: '11px', color: '#718096', fontWeight: 800, textTransform: 'uppercase' }}>Do odzyskania netto</span>
                    <strong style={{ display: 'block', marginTop: '4px', fontSize: '22px', color: remainingNet > 0.01 ? '#9a6800' : '#159447' }}>
                      {formatMoney(remainingNet)}
                    </strong>
                    <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#718096' }}>
                      Termin płatności: {linkedInvoice.dueDate ? formatDate(linkedInvoice.dueDate) : '—'}
                    </span>
                  </div>

                  <button type="button" className="document-button" style={{ marginTop: '12px', width: '100%' }} onClick={() => onOpenInvoice?.(linkedInvoice)}>
                    🧾 Otwórz fakturę i rozliczenie
                  </button>
                </>
              )
            })()}
          </>
        ) : (
          <>
            <p style={{ margin: '8px 0 12px', color: '#68758a', lineHeight: 1.5 }}>
              Obsługa faktury i płatności znajduje się w zakładce Faktury.
            </p>
            {(normalizeJobStage(editedJob) === 'Odbiór' || normalizeJobStage(editedJob) === 'Zakończone') && (
              <button type="button" className="save-button" style={{ width: '100%' }} onClick={() => onCreateInvoice?.(editedJob)}>
                ＋ Utwórz fakturę
              </button>
            )}
          </>
        )}
      </div>

      {/* ZDJĘCIE GŁÓWNE */}

      <div
        className="detail-card"
        tabIndex={0}
        onPaste={handleMainPhotoPaste}
      >

        <h2>
          Zdjęcie główne
        </h2>

        {editedJob.mainPhoto?.url ? (

          <div>

            <img
              src={editedJob.mainPhoto.url}
              alt={editedJob.mainPhoto.name || editedJob.name}
              style={{
                width: '100%',
                maxHeight: '260px',
                objectFit: 'cover',
                borderRadius: '16px',
                display: 'block',
                border: '1px solid #dfe7ee',
                cursor: 'pointer',
              }}
              title="Kliknij, aby zobaczyć zdjęcie"
              onClick={() =>
                window.open(
                  editedJob.mainPhoto.url,
                  '_blank'
                )
              }
            />

            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginTop: '8px',
                flexWrap: 'wrap',
              }}
            >

              <button
                className="document-button"
                onClick={() =>
                  mainPhotoInputRef.current.click()
                }
              >
                📷 Zmień zdjęcie
              </button>

              <button
                className="document-remove"
                onClick={removeMainPhoto}
              >
                Usuń zdjęcie główne
              </button>

            </div>

          </div>

        ) : (

          <button
            className="document-button"
            onClick={() =>
              mainPhotoInputRef.current.click()
            }
          >
            📷 Dodaj zdjęcie główne
          </button>

        )}

        <input
          ref={mainPhotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            addMainPhoto(
              e.target.files[0]
            )
            e.target.value = ''
          }}
        />

      </div>


      {/* POSTĘP */}

      <div className="detail-card">

        <div className="detail-title">

          <h2>
            Postęp
          </h2>


          <strong>
            {editedJob.progress}%
          </strong>

        </div>


        <div className="progress-bar large-progress">

          <div

            className="progress-fill"

            style={{
              width:
                `${editedJob.progress}%`,
            }}

          />

        </div>


        {editing && (

          <>

            <div

              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginTop: '12px',
              }}

            >

              <button
                type="button"
                onClick={() =>
                  setEditedJob({
                    ...editedJob,
                    progress: Math.max(0, Number(editedJob.progress || 0) - 1),
                  })
                }
                style={{
                  width: '42px',
                  height: '42px',
                  fontSize: '22px',
                  fontWeight: '700',
                }}
              >
                −
              </button>

              <input
                type="number"
                min="0"
                max="100"
                value={editedJob.progress}
                onChange={(e) => {
                  const value = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  setEditedJob({
                    ...editedJob,
                    progress: value,
                  });
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'center',
                  fontSize: '18px',
                  fontWeight: '700',
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setEditedJob({
                    ...editedJob,
                    progress: Math.min(100, Number(editedJob.progress || 0) + 1),
                  })
                }
                style={{
                  width: '42px',
                  height: '42px',
                  fontSize: '22px',
                  fontWeight: '700',
                }}
              >
                +
              </button>

            </div>

            <div
              style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                marginTop: '10px',
              }}
            >

              {[0, 25, 50, 75, 100].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setEditedJob({
                      ...editedJob,
                      progress: value,
                    })
                  }
                  style={{
                    flex: '1 1 54px',
                    minWidth: '54px',
                  }}
                >
                  {value}%
                </button>
              ))}

            </div>

          </>

        )}

      </div>


      {/* ZAKRES */}

      <div className="detail-card">

        <h2>
          Zakres realizacje
        </h2>


        <div className="detail-quantities">

          <div className="quantity-box">

            <span>
              MB
            </span>


            {editing ? (

              <input

                type="text"

                inputMode="decimal"

                value={
                  editedJob.quantities.mb
                }

                onChange={(e) =>
                  updateQuantity(
                    'mb',
                    e.target.value
                  )
                }

              />

            ) : (

              <strong>
                {editedJob.quantities.mb}
              </strong>

            )}

          </div>


          <div className="quantity-box">

            <span>
              m²
            </span>


            {editing ? (

              <input

                type="text"

                inputMode="decimal"

                value={
                  editedJob.quantities.m2
                }

                onChange={(e) =>
                  updateQuantity(
                    'm2',
                    e.target.value
                  )
                }

              />

            ) : (

              <strong>
                {editedJob.quantities.m2}
              </strong>

            )}

          </div>


          <div className="quantity-box">

            <span>
              kg
            </span>


            {editing ? (

              <input

                type="text"

                inputMode="decimal"

                value={
                  editedJob.quantities.kg
                }

                onChange={(e) =>
                  updateQuantity(
                    'kg',
                    e.target.value
                  )
                }

              />

            ) : (

              <strong>
                {editedJob.quantities.kg}
              </strong>

            )}

          </div>

        </div>

      </div>


      {/* STAWKI */}

      <div className="detail-card">

        <h2>
          Stawki i wartość
        </h2>


        <FinanceRow

          label="MB"

          quantity={
            editedJob.quantities.mb
          }

          rate={
            editedJob.rates.mb
          }

          editing={
            editing
          }

          onChange={(value) =>
            updateRate(
              'mb',
              value
            )
          }

        />


        <FinanceRow

          label="m²"

          quantity={
            editedJob.quantities.m2
          }

          rate={
            editedJob.rates.m2
          }

          editing={
            editing
          }

          onChange={(value) =>
            updateRate(
              'm2',
              value
            )
          }

        />


        <FinanceRow

          label="kg"

          quantity={
            editedJob.quantities.kg
          }

          rate={
            editedJob.rates.kg
          }

          editing={
            editing
          }

          onChange={(value) =>
            updateRate(
              'kg',
              value
            )
          }

        />


        <div className="job-footer">

          <span>
            Łączna wartość
          </span>

          <strong>
            {formatMoney(
              calculateTotal(
                editedJob
              )
            )}
          </strong>

        </div>

      </div>


      <JobDocuments
        job={editedJob}
        clients={clients}
        company={company}
      />

      {/* DOKUMENTACJA */}

      <div className="detail-card">

        <h2>
          Dokumentacja
        </h2>


        <DocumentRow

          title="Rysunek materiałowy"

          document={
            editedJob.documents?.material
          }

          inputRef={
            materialInputRef
          }

          onAdd={(file) =>
            addDocument(
              'material',
              file
            )
          }

        />


        {editedJob.documents?.material && (

          <button

            className="document-open"

            onClick={() =>
              renameDocument(
                'material'
              )
            }

          >
            ✎ Zmień nazwę
          </button>

        )}


        {editedJob.documents?.material && (

          <button

            className="document-remove"

            onClick={() =>
              removeDocument(
                'material'
              )
            }

          >
            Usuń dokument materiałowy
          </button>

        )}


        <DocumentRow

          title="Rysunek montażowy"

          document={
            editedJob.documents?.assembly
          }

          inputRef={
            assemblyInputRef
          }

          onAdd={(file) =>
            addDocument(
              'assembly',
              file
            )
          }

        />


        {editedJob.documents?.assembly && (

          <button

            className="document-open"

            onClick={() =>
              renameDocument(
                'assembly'
              )
            }

          >
            ✎ Zmień nazwę
          </button>

        )}


        {editedJob.documents?.assembly && (

          <button

            className="document-remove"

            onClick={() =>
              removeDocument(
                'assembly'
              )
            }

          >
            Usuń dokument montażowy
          </button>

        )}

      </div>


      {/* ZDJĘCIA */}

      <div className="detail-card">

        <h2>
          Zdjęcia
        </h2>


        <div className="photo-buttons">

          <button

            className="document-button"

            onClick={() =>
              photoInputRef.current.click()
            }

          >
            📷 Zrób / dodaj zdjęcie
          </button>


          <input

            ref={
              photoInputRef
            }

            type="file"

            accept="image/*"

            capture="environment"

            hidden

            onChange={(e) => {

              addPhoto(
                e.target.files[0]
              )

              e.target.value = ''

            }}

          />

        </div>


        <div className="photos-grid">

          {(editedJob.photos || [])
            .length === 0 && (

              <div className="empty-notes">

                Brak zdjęć.

              </div>

            )}


          {(editedJob.photos || [])
            .map(
              (photo) => (

                <div

                  className="photo-item"

                  key={
                    photo.id
                  }

                >

                  <img

                    src={
                      photo.url
                    }

                    alt={
                      photo.name
                    }

                    title="Kliknij, aby zobaczyć zdjęcie"

                    onClick={() =>
                      window.open(
                        photo.url,
                        '_blank'
                      )
                    }

                  />


                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      marginTop: '6px',
                    }}
                  >

                    <a

                      href={
                        photo.url
                      }

                      download={
                        photo.name || 'zdjecie'
                      }

                      className="document-button"

                      style={{
                        flex: 1,
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}

                      onClick={(e) =>
                        e.stopPropagation()
                      }

                    >
                      ↓ Pobierz
                    </a>


                    <button

                      className="document-button"

                      onClick={() =>
                        renamePhoto(
                          photo.id
                        )
                      }

                    >
                      ✎
                    </button>


                    <button

                      className="photo-remove"

                      onClick={() =>
                        removePhoto(
                          photo.id
                        )
                      }

                    >
                      ×
                    </button>

                  </div>

                </div>

              )
            )}

        </div>

      </div>


      {/* KOSZTY REALIZACJI */}
      <div className="detail-card">
        <div className="notes-header">
          <div>
            <div className="small-label">KOSZTY</div>
            <h2>Koszty tej realizacji</h2>
          </div>
          {!showCostForm && (
            <button type="button" className="document-button" onClick={() => setShowCostForm(true)}>+ Dodaj koszt</button>
          )}
        </div>

        {showCostForm && (
          <div className="note-form note-form-modern">
            <select className="note-text-input" value={costForm.costType} onChange={(e) => setCostForm({ ...costForm, costType: e.target.value })}>
              <option value="material">Materiał</option>
              <option value="hours">Robocizna / godziny</option>
              <option value="other">Inny koszt</option>
            </select>

            <input className="note-text-input" type="text" placeholder="Np. kanał, materiał, transport..." value={costForm.description} onChange={(e) => setCostForm({ ...costForm, description: e.target.value })} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <input className="note-text-input" inputMode="decimal" placeholder="Ilość" value={costForm.quantity} onChange={(e) => setCostForm({ ...costForm, quantity: e.target.value })} />
              <input className="note-text-input" placeholder="Jednostka" value={costForm.unit} onChange={(e) => setCostForm({ ...costForm, unit: e.target.value })} />
              <input className="note-text-input" inputMode="decimal" placeholder="Cena jedn." value={costForm.unitCost} onChange={(e) => setCostForm({ ...costForm, unitCost: e.target.value })} />
            </div>

            <input className="note-date-input" type="date" value={costForm.costDate} onChange={(e) => setCostForm({ ...costForm, costDate: e.target.value })} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', fontWeight: 800 }}>
              Razem: {formatMoney(parseDecimal(costForm.quantity) * parseDecimal(costForm.unitCost))}
            </div>

            <div className="note-form-actions">
              <button className="save-button" onClick={saveJobCost}>{editingCostId ? 'Zapisz koszt' : 'Dodaj koszt'}</button>
              <button className="restore-button" onClick={resetCostForm}>Anuluj</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '14px 0' }}>
          <div className="finance-kpi-card"><small>WARTOŚĆ</small><strong>{formatMoney(jobRevenue)}</strong></div>
          <div className="finance-kpi-card"><small>KOSZTY</small><strong>{formatMoney(totalJobCosts)}</strong></div>
          <div className="finance-kpi-card"><small>ZYSK</small><strong>{formatMoney(jobProfit)}</strong></div>
        </div>

        {jobCosts.length === 0 ? (
          <div className="empty-notes">Brak kosztów przypisanych do tej realizacji.</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {jobCosts.map((cost) => (
              <div key={cost.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center', padding: '12px', border: '1px solid #e7edf4', borderRadius: '12px' }}>
                <div>
                  <strong>{cost.description}</strong>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#718096' }}>
                    {cost.costType === 'material' ? 'Materiał' : cost.costType === 'hours' ? 'Robocizna' : 'Inny koszt'}
                    {' • '}{cost.quantity} {cost.unit} × {formatMoney(cost.unitCost)}
                    {cost.costDate ? ' • ' + formatDate(cost.costDate) : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>{formatMoney(cost.totalCost)}</strong>
                  <button type="button" className="note-action-button note-edit-button" onClick={() => startEditJobCost(cost)}>✎</button>
                  <button type="button" className="note-action-button note-delete-button" onClick={() => removeJobCost(cost)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* NOTATKI */}

      <div className="detail-card notes-card">

        <div className="notes-header">

          <div>
            <div className="small-label">
              ZADANIA
            </div>
            <h2>
              Zadania na tej realizacji
            </h2>
          </div>

          {!showNoteForm && (

            <button
              type="button"
              className="document-button note-add-button"
              onClick={addNote}
            >
              + Dodaj zadanie
            </button>

          )}

        </div>


        {showNoteForm && (

          <div className="note-form note-form-modern">

            <input
              className="note-text-input"
              type="text"
              placeholder="Co trzeba zrobić?"
              value={newNote.text}
              autoFocus
              onChange={(e) =>
                setNewNote({
                  ...newNote,
                  text: e.target.value,
                })
              }
            />


            <div className="note-reminder-toggle-row">

              <button
                type="button"
                className={
                  newNote.reminderEnabled
                    ? 'note-reminder-button active'
                    : 'note-reminder-button'
                }
                onClick={() => {
                  const enabled = !newNote.reminderEnabled
                  setNewNote({
                    ...newNote,
                    reminderEnabled: enabled,
                    date: enabled
                      ? (newNote.date || getTodayString())
                      : '',
                    time: enabled
                      ? (newNote.time || '')
                      : '',
                  })
                }}
              >
                <span className="note-bell-icon">
                  {newNote.reminderEnabled ? '🔔' : '🔕'}
                </span>
                <span>
                  {newNote.reminderEnabled
                    ? 'Przypomnienie włączone'
                    : 'Przypomnij'}
                </span>
              </button>

            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginTop: '10px',
              }}
            >
              <label
                style={{
                  display: 'grid',
                  gap: '5px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#718096' }}>
                  ODPOWIEDZIALNY
                </span>
                <select
                  className="note-text-input"
                  value={newNote.assignee || ''}
                  onChange={(e) =>
                    setNewNote({
                      ...newNote,
                      assignee: e.target.value,
                    })
                  }
                >
                  <option value="">Nieprzypisane</option>
                  {DEVICE_USERS.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
              </label>

              <label
                style={{
                  display: 'grid',
                  gap: '5px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#718096' }}>
                  PRIORYTET
                </span>
                <select
                  className="note-text-input"
                  value={newNote.priority || 'normal'}
                  onChange={(e) =>
                    setNewNote({
                      ...newNote,
                      priority: e.target.value,
                    })
                  }
                >
                  <option value="normal">Normalny</option>
                  <option value="high">Wysoki</option>
                  <option value="urgent">Pilny</option>
                </select>
              </label>
            </div>


            {newNote.reminderEnabled && (

              <div className="note-reminder-fields">

                <label>
                  <span>Data</span>
                  <input
                    className="note-date-input"
                    type="date"
                    value={newNote.date}
                    onChange={(e) =>
                      setNewNote({
                        ...newNote,
                        date: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>Godzina</span>
                  <input
                    className="note-time-input"
                    type="time"
                    value={newNote.time}
                    onChange={(e) =>
                      setNewNote({
                        ...newNote,
                        time: e.target.value,
                      })
                    }
                  />
                </label>

              </div>

            )}


            <div className="note-form-actions">

              <button
                className="save-button"
                onClick={saveNote}
                disabled={!newNote.text.trim()}
              >
                Zapisz zadanie
              </button>

              <button
                className="restore-button"
                onClick={() => setShowNoteForm(false)}
              >
                Anuluj
              </button>

            </div>

          </div>

        )}


        <div className="notes-list notes-list-modern">

          {[...(editedJob.notes || [])]
            .sort((a, b) => {
              if (Boolean(a.done) !== Boolean(b.done)) {
                return a.done ? 1 : -1
              }

              const priorityOrder = { urgent: 3, high: 2, normal: 1 }
              const priorityA = priorityOrder[String(a.priority || 'normal').toLowerCase()] || 1
              const priorityB = priorityOrder[String(b.priority || 'normal').toLowerCase()] || 1

              if (priorityA !== priorityB) return priorityB - priorityA

              const dateA = a.reminderEnabled && a.date ? a.date : ''
              const dateB = b.reminderEnabled && b.date ? b.date : ''
              const today = getTodayString()
              const overdueA = !a.done && dateA && dateA < today ? 1 : 0
              const overdueB = !b.done && dateB && dateB < today ? 1 : 0

              if (overdueA !== overdueB) return overdueB - overdueA
              if (dateA !== dateB) {
                if (!dateA) return 1
                if (!dateB) return -1
                return dateA.localeCompare(dateB)
              }

              return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
            })
            .map(
            (note) => (

              <div
                className={
                  note.done
                    ? 'note-item note-item-modern note-done'
                    : 'note-item note-item-modern'
                }
                key={note.id}
              >

                <button
                  type="button"
                  className={
                    note.done
                      ? 'note-checkbox checked'
                      : 'note-checkbox'
                  }
                  aria-label={
                    note.done
                      ? 'Oznacz jako niewykonane'
                      : 'Oznacz jako wykonane'
                  }
                  onClick={() => toggleNote(note.id)}
                >
                  {note.done ? '✓' : ''}
                </button>

                <div className="note-content">

                  {String(editingNoteId) === String(note.id) ? (

                    <div className="note-edit-box">

                      <input
                        className="note-text-input note-edit-input"
                        type="text"
                        value={editingNoteText}
                        autoFocus
                        onChange={(e) =>
                          setEditingNoteText(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveEditedNote(note.id)
                          }

                          if (e.key === 'Escape') {
                            cancelEditNote()
                          }
                        }}
                      />

                      <div className="note-edit-actions">
                        <button
                          type="button"
                          className="note-save-edit"
                          onClick={() => saveEditedNote(note.id)}
                        >
                          ✓ Zapisz
                        </button>

                        <button
                          type="button"
                          className="note-cancel-edit"
                          onClick={cancelEditNote}
                        >
                          Anuluj
                        </button>
                      </div>

                    </div>

                  ) : (

                    <div className="note-text-line">
                      <strong>{note.text}</strong>
                    </div>

                  )}

                  {(note.assignee || note.priority === 'high' || note.priority === 'urgent') && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '7px',
                        flexWrap: 'wrap',
                        marginTop: '5px',
                      }}
                    >
                      {note.assignee && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#087fce',
                          background: '#e9f5ff',
                          borderRadius: '999px',
                          padding: '4px 8px',
                        }}>
                          👤 {note.assignee}
                        </span>
                      )}
                      {note.priority === 'urgent' && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#b42318',
                          background: '#fff0ee',
                          borderRadius: '999px',
                          padding: '4px 8px',
                        }}>
                          🔴 PILNE
                        </span>
                      )}
                      {note.priority === 'high' && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#9a6800',
                          background: '#fff8e8',
                          borderRadius: '999px',
                          padding: '4px 8px',
                        }}>
                          🟠 WYSOKI
                        </span>
                      )}
                    </div>
                  )}

                  <div className="note-created-at">
                    Dodano: {note.createdAt
                      ? formatCreatedAt(note.createdAt)
                      : `${formatDate(note.date || '')}${note.time ? ` • ${note.time}` : ''}`
                    }
                  </div>

                  {note.reminderEnabled && note.date && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '7px',
                        padding: '5px 9px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: note.date < getTodayString() && !note.done
                          ? '#b42318'
                          : note.date === getTodayString() && !note.done
                            ? '#9a6800'
                            : '#68758a',
                        background: note.date < getTodayString() && !note.done
                          ? '#fff0ee'
                          : note.date === getTodayString() && !note.done
                            ? '#fff8e8'
                            : '#f1f5f9',
                      }}
                    >
                      {note.date < getTodayString() && !note.done
                        ? '⚠ PO TERMINIE'
                        : note.date === getTodayString() && !note.done
                          ? '📅 DZISIAJ'
                          : ('📅 ' + formatDate(note.date) + (note.time ? ' • ' + note.time : ''))}
                    </div>
                  )}

                  {note.reminderEnabled && (

                    <div className="note-reminder-details">

                      <div className="note-reminder-heading">
                        <span className="note-bell-circle">🔔</span>
                        <span>Przypomnienie</span>
                      </div>

                      <div className="note-reminder-fields">
                        <label>
                          <span>Data</span>
                          <input
                            className="note-date-input"
                            type="date"
                            value={note.date || ''}
                            onChange={(e) =>
                              updateNoteReminder(
                                note.id,
                                'date',
                                e.target.value
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>Godzina <em>opcjonalnie</em></span>
                          <input
                            className="note-time-input"
                            type="time"
                            value={note.time || ''}
                            onChange={(e) =>
                              updateNoteReminder(
                                note.id,
                                'time',
                                e.target.value
                              )
                            }
                          />
                        </label>
                      </div>

                    </div>

                  )}

                  <div className="note-actions">

                    {String(editingNoteId) !== String(note.id) && (
                      <button
                        type="button"
                        className="note-action-button note-edit-button"
                        onClick={() => startEditNote(note)}
                      >
                        ✎ Edytuj
                      </button>
                    )}

                    <button
                      type="button"
                      className={
                        note.reminderEnabled
                          ? 'note-action-button note-item-reminder active'
                          : 'note-action-button note-item-reminder'
                      }
                      onClick={() => toggleNoteReminder(note.id)}
                    >
                      <span>{note.reminderEnabled ? '🔔' : '🔕'}</span>
                      <span>
                        {note.reminderEnabled
                          ? 'Wyłącz przypomnienie'
                          : 'Przypomnij'}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="note-action-button note-delete-button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        removeNote(note.id)
                      }}
                    >
                      🗑 Usuń
                    </button>

                  </div>

                </div>

              </div>
            )
          )}

          {(editedJob.notes || []).length === 0 && (
            <div className="empty-notes">
              Brak notatek. Dodaj pierwsze zadanie.
            </div>
          )}

        </div>

      </div>

      {editing && (

        <button

          className="save-button"

          onClick={
            saveChanges
          }

        >
          Zapisz zmiany
        </button>

      )}


      {!editing && nextStage && (
        <button
          className="finish-button"
          onClick={() => changeStage(nextStage)}
        >
          {nextStage === 'W toku' && '▶ Rozpocznij realizację'}
          {nextStage === 'Odbiór' && '✓ Przejdź do odbioru'}
          {nextStage === 'Zakończone' && '✓ Zakończ realizację'}
        </button>
      )}

      {!editing && (
        <div className="job-stage-actions">
          <span>Aktualny etap: <strong>{normalizeJobStage(editedJob)}</strong></span>
          <button
            type="button"
            className="restore-button"
            onClick={() => {
              const stages = JOB_STAGES
              const currentIndex = stages.indexOf(normalizeJobStage(editedJob))
              const previousStage = currentIndex > 0 ? stages[currentIndex - 1] : null
              if (previousStage) changeStage(previousStage)
            }}
          >
            ← Cofnij etap
          </button>
        </div>
      )}

      {!editing && (

        <button

          className="document-remove"

          onClick={() =>
            onDelete(editedJob)
          }

          style={{
            width: '100%',
            marginTop: '12px',
            padding: '14px',
            fontSize: '15px',
          }}

        >
          🗑 Usuń realizację

        </button>

      )}

    </div>

  )

}


/* =====================================================
   FINANCE ROW
   ===================================================== */

function FinanceRow({
  label,
  quantity,
  rate,
  editing,
  onChange,
}) {

  const value =
    (Number(quantity) || 0) *
    (Number(rate) || 0)


  return (

    <div className={editing ? "finance-row finance-row-editing" : "finance-row"}>

      <div>

        <strong>
          {label}
        </strong>

        <small>
          {quantity} × {rate} zł
        </small>

      </div>


      {editing ? (

        <input

          className="rate-input"

          type="text"

          inputMode="decimal"

          value={
            rate
          }

          onChange={(e) =>
            onChange(
              e.target.value
            )
          }

        />

      ) : (

        <strong>
          {formatMoney(
            value
          )}
        </strong>

      )}

    </div>

  )

}


/* =====================================================
   DOKUMENT
   ===================================================== */

function DocumentRow({
  title,
  document,
  inputRef,
  onAdd,
}) {

  return (

    <div className="document-row">

      <div>

        <strong>
          {title}
        </strong>


        {document && (

          <div className="document-info">

            <span>
              {document.name}
            </span>


            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                marginTop: '6px',
              }}
            >

              <button

                className="document-open"

                onClick={() =>
                  window.open(
                    document.url,
                    '_blank'
                  )
                }

              >
                Podgląd
              </button>


              <a

                href={
                  document.url
                }

                download={
                  document.name || 'dokument'
                }

                className="document-open"

                style={{
                  textDecoration: 'none',
                }}

              >
                ↓ Pobierz
              </a>

            </div>

          </div>

        )}

      </div>


      <button

        className="document-button"

        onClick={() =>
          inputRef.current.click()
        }

      >
        + Dodaj dokument
      </button>


      <input

        ref={
          inputRef
        }

        type="file"

        accept=".pdf,.jpg,.jpeg,.png"

        hidden

        onChange={(e) => {

          onAdd(
            e.target.files[0]
          )

          e.target.value = ''

        }}

      />

    </div>

  )

}


/* =====================================================
   FINANSE
   ===================================================== */

function FinancePage({
  jobs,
  organizationMembers = [],
  dataAccessReady = false,
  settings,
  clients = [],
  invoices = [],
  onOpenJob,
  onOpenInvoice,
  onOpenJobs,
  onOpenInvoices,
}) {

  const categoryOptions =
    (settings?.categories || [
      { name: 'ZUS', enabled: true },
      { name: 'Podatek', enabled: true },
      { name: 'Inne', enabled: true },
    ]).filter((category) => category.enabled !== false)

  const safeCategoryOptions =
    categoryOptions.length > 0
      ? categoryOptions
      : [{ name: 'Inne', enabled: true }]
  const partnerNames = organizationMembers
    .map((member) => String(member.display_name || member.email || '').trim())
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index)

  const partnerOne = partnerNames[0] || ''
  const partnerTwo = partnerNames[1] || ''
  const hasPartnerSettlement = Boolean(partnerOne && partnerTwo)

  const today = new Date()
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const [selectedMonthKey, setSelectedMonthKey] =
    useState(currentMonthKey)

  const [costs, setCosts] = useState([])

  useEffect(() => {
    let cancelled = false

    const loadFinance = async () => {
      try {
        const remoteCosts = await getFinance()
        if (!cancelled) setCosts(remoteCosts)
      } catch (error) {
        console.error('Nie udało się wczytać finansów z Supabase:', error)
      }
    }

    if (!dataAccessReady) return () => { cancelled = true }
    loadFinance()

    return () => {
      cancelled = true
    }
  }, [dataAccessReady])

  useEffect(() => {
    if (!dataAccessReady) return undefined
    const unsubscribe = subscribeToFinance((payload) => {
      if (!payload) return

      const mapCost = (row) => ({
        id: row.id,
        type: row.type,
        amount: Number(row.amount || 0),
        category: row.category || null,
        month: row.month || null,
        description: row.description || '',
        paidBy: row.paid_by || null,
        createdAt: row.created_at || null,
      })

      if (payload.eventType === 'INSERT' && payload.new) {
        const incoming = mapCost(payload.new)
        setCosts((currentCosts) =>
          currentCosts.some((cost) => cost.id === incoming.id)
            ? currentCosts
            : [incoming, ...currentCosts]
        )
      }

      if (payload.eventType === 'UPDATE' && payload.new) {
        const incoming = mapCost(payload.new)
        setCosts((currentCosts) =>
          currentCosts.map((cost) =>
            cost.id === incoming.id ? incoming : cost
          )
        )
      }

      if (payload.eventType === 'DELETE' && payload.old?.id) {
        setCosts((currentCosts) =>
          currentCosts.filter((cost) => cost.id !== payload.old.id)
        )
      }
    })

    return unsubscribe
  }, [dataAccessReady])


  const [allJobPayments, setAllJobPayments] = useState([])
  const [partnerSettlements, setPartnerSettlements] = useState([])
  const [partnerTransfers, setPartnerTransfers] = useState([])
  const [settlementForm, setSettlementForm] = useState({
    lukaszPaid: '',
    pawelPaid: '',
    note: '',
  })
  const [transferForm, setTransferForm] = useState({
    fromPerson: partnerTwo,
    toPerson: partnerOne,
    amount: '',
    note: '',
  })
  const [settlementSaving, setSettlementSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadPaymentAndSettlementData = async () => {
      try {
        const [payments, settlements, transfers] = await Promise.all([
          getAllJobPayments(),
          getPartnerSettlements(),
          getPartnerTransfers(),
        ])

        if (!cancelled) {
          setAllJobPayments(payments)
          setPartnerSettlements(settlements)
          setPartnerTransfers(transfers)
        }
      } catch (error) {
        console.error('Nie udało się wczytać płatności lub rozliczeń wspólników:', error)
      }
    }

    if (!dataAccessReady) return () => { cancelled = true }
    loadPaymentAndSettlementData()

    const unsubscribePayments = supabase
      .channel('aeroinstal-finance-job-payments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_payments' },
        (payload) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            setAllJobPayments((current) => current.filter((item) => item.id !== payload.old.id))
            return
          }
          if (payload.new?.id) {
            const incoming = {
              id: payload.new.id,
              jobId: payload.new.job_id,
              invoiceId: payload.new.invoice_id || null,
              amount: Number(payload.new.amount || 0),
              paidAt: payload.new.paid_at || null,
              note: payload.new.note || '',
              createdAt: payload.new.created_at || null,
            }
            setAllJobPayments((current) =>
              current.some((item) => item.id === incoming.id)
                ? current.map((item) => item.id === incoming.id ? incoming : item)
                : [...current, incoming]
            )
          }
        }
      )
      .subscribe()

    const unsubscribeSettlements = subscribeToPartnerSettlements((event) => {
      const { type, payload } = event || {}
      if (type === 'settlement') {
        if (payload.eventType === 'DELETE' && payload.old?.id) {
          setPartnerSettlements((current) => current.filter((item) => item.id !== payload.old.id))
        } else if (payload.new?.id) {
          const row = payload.new
          const incoming = {
            id: row.id,
            month: row.month,
            profit: Number(row.profit || 0),
            lukaszShare: Number(row.lukasz_share || 0),
            pawelShare: Number(row.pawel_share || 0),
            lukaszPaid: Number(row.lukasz_paid || 0),
            pawelPaid: Number(row.pawel_paid || 0),
            closed: Boolean(row.closed),
            closedAt: row.closed_at || null,
            note: row.note || '',
          }
          setPartnerSettlements((current) =>
            current.some((item) => item.id === incoming.id)
              ? current.map((item) => item.id === incoming.id ? incoming : item)
              : [...current, incoming]
          )
        }
      }

      if (type === 'transfer') {
        if (payload.eventType === 'DELETE' && payload.old?.id) {
          setPartnerTransfers((current) => current.filter((item) => item.id !== payload.old.id))
        } else if (payload.new?.id) {
          const row = payload.new
          const incoming = {
            id: row.id,
            settlementId: row.settlement_id || null,
            transferDate: row.transfer_date,
            fromPerson: row.from_person,
            toPerson: row.to_person,
            amount: Number(row.amount || 0),
            note: row.note || '',
          }
          setPartnerTransfers((current) =>
            current.some((item) => item.id === incoming.id)
              ? current.map((item) => item.id === incoming.id ? incoming : item)
              : [...current, incoming]
          )
        }
      }
    })

    return () => {
      cancelled = true
      supabase.removeChannel(unsubscribePayments)
      unsubscribeSettlements()
    }
  }, [dataAccessReady])

  const [showForm, setShowForm] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const [editingCostId, setEditingCostId] = useState(null)

  const [editCost, setEditCost] = useState({
    category: 'ZUS',
    amount: '',
    paidBy: partnerOne,
    description: '',
    date: getTodayString(),
  })

  const [newCost, setNewCost] = useState({
    category: 'ZUS',
    amount: '',
    paidBy: partnerOne,
    description: '',
    date: getTodayString(),
  })

  const changeMonth = (direction) => {
    const [year, month] = selectedMonthKey.split('-').map(Number)
    const date = new Date(year, month - 1 + direction, 1)
    const nextKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonthKey(nextKey)
  }

  const [selectedYear, selectedMonthNumber] = selectedMonthKey.split('-').map(Number)
  const monthName = new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
  }).format(new Date(selectedYear, selectedMonthNumber - 1, 1))
  const monthTitle = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${selectedYear}`

  const completedJobsThisMonth = jobs.filter(
    (job) =>
      job.completed === true &&
      job.completedAt &&
      job.completedAt.startsWith(selectedMonthKey)
  )

  const monthPayments = allJobPayments.filter(
    (payment) =>
      payment.paidAt &&
      payment.paidAt.startsWith(selectedMonthKey)
  )

  const jobsWithPaymentHistory = new Set(
    allJobPayments.map((payment) => String(payment.jobId))
  )

  const legacyCompletedJobsThisMonth = completedJobsThisMonth.filter(
    (job) => !jobsWithPaymentHistory.has(String(job.id))
  )

  const revenue =
    monthPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    ) +
    legacyCompletedJobsThisMonth.reduce(
      (sum, job) => sum + calculateTotal(job),
      0
    )

  // Dla otrzymanych płatności netto wyliczamy z powiązanej faktury.
  // Brutto pozostaje faktycznie otrzymaną kwotą. Dla starszych wpisów,
  // które nie mają danych VAT, netto = brutto, aby nie wymyślać stawki VAT.
  const getReceivedNetAmount = (payment) => {
    const amount = Math.max(0, Number(payment.amount || 0))
    const invoice = payment.invoiceId
      ? invoices.find((item) => String(item.id) === String(payment.invoiceId))
      : null

    if (invoice) {
      const gross = Math.max(0, Number(invoice.grossAmount || 0))
      const net = Math.max(0, Number(invoice.netAmount || 0))
      if (gross > 0 && net >= 0) {
        return Math.min(amount, amount * (net / gross))
      }
    }

    const jobInvoices = invoices.filter(
      (invoice) => String(invoice.jobId || '') === String(payment.jobId || '')
    )
    if (jobInvoices.length === 1) {
      const invoice = jobInvoices[0]
      const gross = Math.max(0, Number(invoice.grossAmount || 0))
      const net = Math.max(0, Number(invoice.netAmount || 0))
      if (gross > 0 && net >= 0) {
        return Math.min(amount, amount * (net / gross))
      }
    }

    return amount
  }

  const monthRevenueGross = revenue
  const monthRevenueNet =
    monthPayments.reduce(
      (sum, payment) => sum + getReceivedNetAmount(payment),
      0
    ) +
    legacyCompletedJobsThisMonth.reduce(
      (sum, job) => sum + calculateTotal(job),
      0
    )

  const monthCosts = costs.filter(
    (cost) =>
      cost.month &&
      cost.month.startsWith(selectedMonthKey) &&
      cost.type !== 'revenue'
  )

  const totalCosts = monthCosts.reduce(
    (sum, cost) => sum + Number(cost.amount || 0),
    0
  )

  const profit = revenue - totalCosts
  const share = hasPartnerSettlement ? profit / 2 : 0

  // Roczne podsumowanie dla aktualnie wybranego roku.
  const yearPrefix = `${selectedYear}-`

  const completedJobsThisYear = jobs.filter(
    (job) =>
      job.completed === true &&
      job.completedAt &&
      job.completedAt.startsWith(yearPrefix)
  )

  const yearPayments = allJobPayments.filter(
    (payment) =>
      payment.paidAt &&
      payment.paidAt.startsWith(yearPrefix)
  )

  const jobsWithAnyPaymentHistoryThisYear = new Set(
    allJobPayments.map((payment) => String(payment.jobId))
  )

  const legacyCompletedJobsThisYear = completedJobsThisYear.filter(
    (job) => !jobsWithAnyPaymentHistoryThisYear.has(String(job.id))
  )

  const yearRevenue =
    yearPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    ) +
    legacyCompletedJobsThisYear.reduce(
      (sum, job) => sum + calculateTotal(job),
      0
    )

  const yearCostsList = costs.filter(
    (cost) =>
      cost.month &&
      cost.month.startsWith(yearPrefix) &&
      cost.type !== 'revenue'
  )

  const yearCosts = yearCostsList.reduce(
    (sum, cost) => sum + Number(cost.amount || 0),
    0
  )

  const yearProfit = yearRevenue - yearCosts


  /*
   * FINANSE — PROSTA LOGIKA ROZLICZENIA
   *
   * 1. Przychód = faktycznie otrzymane pieniądze.
   * 2. Przychód dzielimy 50/50 — niezależnie od tego, kto zapłacił koszt.
   * 3. Koszty są osobno. Różnica w kosztach między wspólnikami tworzy saldo,
   *    które automatycznie przechodzi na kolejne miesiące.
   * 4. Oddanie pieniędzy zapisujemy jako transfer. Przy pełnym rozliczeniu
   *    aplikacja sama wylicza kwotę — użytkownik tylko potwierdza.
   */

  const partnerOneCosts = monthCosts
    .filter((cost) => cost.paidBy === partnerOne)
    .reduce((sum, cost) => sum + Number(cost.amount || 0), 0)

  const partnerTwoCosts = monthCosts
    .filter((cost) => cost.paidBy === partnerTwo)
    .reduce((sum, cost) => sum + Number(cost.amount || 0), 0)

  // Każdy z dwóch rozliczanych wspólników ponosi połowę każdego kosztu.
  const currentCostBalance = (partnerOneCosts - partnerTwoCosts) / 2

  const selectedMonthEnd = `${selectedMonthKey}-31`

  const costsThroughSelectedMonth = costs.filter(
    (cost) =>
      cost.month &&
      cost.month.startsWith('20') &&
      cost.month <= selectedMonthEnd &&
      cost.type !== 'revenue'
  )

  const historicalCostBalance = costsThroughSelectedMonth.reduce(
    (sum, cost) => {
      const amount = Number(cost.amount || 0)
      if (cost.paidBy === partnerOne) return sum + amount / 2
      if (cost.paidBy === partnerTwo) return sum - amount / 2
      return sum
    },
    0
  )

  const transfersThroughSelectedMonth = partnerTransfers
    .filter(
      (item) =>
        item.transferDate &&
        item.transferDate <= selectedMonthEnd
    )
    .reduce(
      (sum, item) => {
        const amount = Number(item.amount || 0)

        if (item.fromPerson === partnerTwo && item.toPerson === partnerOne) {
          return sum - amount
        }

        if (item.fromPerson === partnerOne && item.toPerson === partnerTwo) {
          return sum + amount
        }

        return sum
      },
      0
    )

  const partnerCostBalance = historicalCostBalance + transfersThroughSelectedMonth

  const balanceDirection =
    partnerCostBalance > 0.01
      ? partnerTwo + ' oddaje ' + partnerOne
      : partnerCostBalance < -0.01
        ? partnerOne + ' oddaje ' + partnerTwo
        : 'Brak salda między wspólnikami'

  const balanceAmount = Math.abs(partnerCostBalance)

  const previousCostBalance =
    costs
      .filter(
        (cost) =>
          cost.month &&
          cost.month < `${selectedMonthKey}-01` &&
          cost.type !== 'revenue'
      )
      .reduce(
        (sum, cost) => {
          const amount = Number(cost.amount || 0)
          if (cost.paidBy === partnerOne) return sum + amount / 2
          if (cost.paidBy === partnerTwo) return sum - amount / 2
          return sum
        },
        0
      ) +
    partnerTransfers
      .filter(
        (item) =>
          item.transferDate &&
          item.transferDate < `${selectedMonthKey}-01`
      )
      .reduce(
        (sum, item) => {
          const amount = Number(item.amount || 0)
          if (item.fromPerson === partnerTwo && item.toPerson === partnerOne) return sum - amount
          if (item.fromPerson === partnerOne && item.toPerson === partnerTwo) return sum + amount
          return sum
        },
        0
      )

  /*
   * NALEŻNOŚCI — faktury są źródłem prawdy dla wystawionych dokumentów.
   *
   * Dla faktur powiązanych z realizacją wpłaty nadal pozostają w job_payments
   * (to księga faktycznie otrzymanej gotówki), a kwota faktury i termin
   * pochodzą z public.invoices. Jeżeli na jednej realizacji istnieje więcej
   * niż jedna faktura, wpłaty z poziomu realizacje rozdzielamy chronologicznie
   * między faktury, żeby nie policzyć tej samej wpłaty kilka razy.
   *
   * Stare realizacje bez rekordu invoices zachowują dotychczasowy fallback
   * oparty o legacy payment_due_date / invoice_amount.
   */
  const invoicesByJob = new Map()
  invoices.forEach((invoice) => {
    if (!invoice.jobId) return
    const key = String(invoice.jobId)
    const current = invoicesByJob.get(key) || []
    current.push(invoice)
    invoicesByJob.set(key, current)
  })

  const allocatedPaymentsByInvoice = new Map()

  invoices.forEach((invoice) => {
    const assignedPaid = allJobPayments
      .filter((payment) => String(payment.invoiceId || '') === String(invoice.id))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    allocatedPaymentsByInvoice.set(String(invoice.id), Math.max(0, assignedPaid))
  })

  invoicesByJob.forEach((jobInvoices, jobId) => {
    const unassignedPayments = allJobPayments
      .filter((payment) =>
        String(payment.jobId) === String(jobId) &&
        !payment.invoiceId
      )
      .sort((a, b) => String(a.paidAt || '').localeCompare(String(b.paidAt || '')))

    let remainingPayments = unassignedPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    )

    const sortedInvoices = [...jobInvoices].sort((a, b) => {
      const dateCompare = String(a.issueDate || '').localeCompare(String(b.issueDate || ''))
      if (dateCompare !== 0) return dateCompare
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    })

    sortedInvoices.forEach((invoice) => {
      const gross = Math.max(0, Number(invoice.grossAmount || 0))
      const alreadyAssigned = Math.min(
        gross,
        Math.max(0, Number(allocatedPaymentsByInvoice.get(String(invoice.id)) || 0))
      )
      const available = Math.max(0, gross - alreadyAssigned)
      const legacyAllocated = Math.min(available, Math.max(0, remainingPayments))
      allocatedPaymentsByInvoice.set(
        String(invoice.id),
        alreadyAssigned + legacyAllocated
      )
      remainingPayments = Math.max(0, remainingPayments - legacyAllocated)
    })
  })

  const invoiceReceivables = invoices
    .filter((invoice) => invoice.status !== 'Anulowana')
    .map((invoice) => {
      const gross = Math.max(0, Number(invoice.grossAmount || 0))
      const net = Math.max(0, Number(invoice.netAmount || 0))
      const vat = Math.max(0, Number(invoice.vatAmount || (gross - net)))
      const paid = invoice.jobId
        ? (allocatedPaymentsByInvoice.get(String(invoice.id)) ?? 0)
        : Math.min(gross, Math.max(0, Number(invoice.paidAmount || 0)))

      // Należność pokazujemy w dwóch wartościach:
      // BRUTTO = ile klient ma jeszcze faktycznie zapłacić,
      // NETTO = kwota bez VAT,
      // VAT = część pozostałej należności przypadająca na VAT.
      // Dzięki temu użytkownik od razu widzi, ile pieniędzy jest jego,
      // a ile stanowi VAT.
      const remaining = Math.max(0, gross - paid)
      const netRatio = gross > 0 ? Math.min(1, net / gross) : 1
      const remainingNet = Math.min(remaining, remaining * netRatio)
      const remainingVat = Math.max(0, remaining - remainingNet)
      const dueDate = invoice.dueDate || null
      const invoiceIssued = Boolean(invoice.issueDate) && invoice.status !== 'Do wystawienia'
      const isOverdue = invoiceIssued && remaining > 0.01 && dueDate && dueDate < getTodayString()
      const job = invoice.jobId
        ? jobs.find((item) => String(item.id) === String(invoice.jobId))
        : null
      const client = clients.find((item) => String(item.id) === String(invoice.clientId))
      return {
        id: `invoice-${invoice.id}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber || 'Bez numeru',
        job: job || {
          id: `invoice-${invoice.id}`,
          name: invoice.invoiceNumber || 'Faktura',
          location: '',
        },
        invoiceValue: gross,
        paid,
        remaining,
        remainingNet,
        remainingVat,
        dueDate,
        invoiceIssued,
        isOverdue,
        clientName: client?.shortName || client?.name || 'Bez przypisanego klienta',
      }
    })
    .filter((item) => item.invoiceIssued && item.remaining > 0.01)

  const legacyReceivables = jobs
    .filter((job) => !invoicesByJob.has(String(job.id)))
    .map((job) => {
      const jobValue = calculateTotal(job)
      const invoiceValue = Number(job.invoiceAmount || 0) || jobValue
      const paid = allJobPayments
        .filter((payment) => payment.jobId === job.id)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      const remaining = Math.max(0, invoiceValue - paid)
      const remainingNet = remaining
      const remainingVat = 0
      const dueDate = job.paymentDueDate || null
      const invoiceIssued = Boolean(dueDate)
      const isOverdue = invoiceIssued && remaining > 0 && dueDate < getTodayString()
      const client = clients.find((item) => String(item.id) === String(job.clientId))
      return {
        id: `legacy-job-${job.id}`,
        invoiceId: null,
        invoiceNumber: job.invoiceNumber || 'Faktura legacy',
        job,
        invoiceValue,
        paid,
        remaining,
        remainingNet,
        remainingVat,
        dueDate,
        invoiceIssued,
        isOverdue,
        clientName: client?.shortName || client?.name || 'Bez przypisanego klienta',
      }
    })
    .filter((item) => item.invoiceIssued && item.remaining > 0.01)

  const receivables = [...invoiceReceivables, ...legacyReceivables]
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })

  const totalReceivables = receivables.reduce((sum, item) => sum + item.remaining, 0)
  const totalReceivablesNet = receivables.reduce((sum, item) => sum + Number(item.remainingNet || 0), 0)
  const totalReceivablesVat = receivables.reduce((sum, item) => sum + Number(item.remainingVat || 0), 0)
  const overdueReceivables = receivables.filter((item) => item.isOverdue).reduce((sum, item) => sum + item.remaining, 0)

  const invoicesToIssue = invoices.filter((invoice) => invoice.status === 'Do wystawienia').length
  const partiallyPaidReceivables = receivables.filter((item) => item.paid > 0.01 && item.remaining > 0.01).length

  const splitAmount = share

  // Spływ płatności liczymy w tej samej bazie co należności:
  // netto. Dzięki temu wpłata brutto nie może sztucznie zawyżyć wskaźnika
  // ponad wartość netto faktury.
  const totalPaidNetFromInvoices = invoices.reduce((sum, invoice) => {
    if (invoice.status === 'Anulowana' || invoice.status === 'Do wystawienia') {
      return sum
    }

    const net = Math.max(0, Number(invoice.netAmount || 0))
    const paid = invoice.jobId
      ? (allocatedPaymentsByInvoice.get(String(invoice.id)) ?? 0)
      : Number(invoice.paidAmount || 0)

    return sum + Math.min(net, Math.max(0, paid))
  }, 0)

  const legacyPaidNet = jobs
    .filter((job) => !invoicesByJob.has(String(job.id)))
    .reduce((sum, job) => {
      const invoiceValue = Math.max(
        0,
        Number(job.invoiceAmount || 0) || calculateTotal(job)
      )
      const paid = allJobPayments
        .filter((payment) => String(payment.jobId) === String(job.id))
        .reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0)

      return sum + Math.min(invoiceValue, Math.max(0, paid))
    }, 0)

  const totalPaidNet = totalPaidNetFromInvoices + legacyPaidNet
  const totalPaymentExpected = totalPaidNet + totalReceivables

  const paymentCollectionPercent = totalPaymentExpected > 0
    ? Math.min(
        100,
        Math.max(
          0,
          (totalPaidNet / totalPaymentExpected) * 100
        )
      )
    : 0

  const monthAlerts = [
    overdueReceivables > 0
      ? {
          type: 'danger',
          icon: '🔴',
          title: 'Zaległe płatności',
          text: `Do odzyskania: ${formatMoney(overdueReceivables)}`,
          action: 'receivables',
        }
      : null,
    receivables.length > 0 && overdueReceivables <= 0
      ? {
          type: 'warning',
          icon: '🟠',
          title: 'Oczekujące płatności',
          text: `Do otrzymania: ${formatMoney(totalReceivables)}`,
          action: 'receivables',
        }
      : null,
    completedJobsThisMonth.length > 0 && monthPayments.length === 0
      ? {
          type: 'warning',
          icon: '🟠',
          title: 'Brak zaksięgowanych płatności',
          text: `${completedJobsThisMonth.length} zakończonych robót w tym miesiącu`,
          action: 'jobs',
        }
      : null,
    hasPartnerSettlement && Math.abs(partnerCostBalance) > 0.01
      ? {
          type: 'info',
          icon: '🔵',
          title: 'Nierozliczone koszty wspólników',
          text: `${balanceDirection}: ${formatMoney(balanceAmount)}`,
          action: 'partner',
        }
      : null,
  ].filter(Boolean)

  const trendMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(selectedYear, selectedMonthNumber - 1 - (5 - index), 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('pl-PL', { month: 'short' })
      .format(date)
      .replace('.', '')

    const trendPayments = allJobPayments
      .filter((payment) => payment.paidAt?.startsWith(key))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

    const trendJobsWithPaymentHistory = new Set(
      allJobPayments.map((payment) => String(payment.jobId))
    )

    const trendLegacyCompletedJobs = jobs.filter(
      (job) =>
        job.completed === true &&
        job.completedAt?.startsWith(key) &&
        !trendJobsWithPaymentHistory.has(String(job.id))
    )

    const trendRevenue =
      trendPayments +
      trendLegacyCompletedJobs.reduce(
        (sum, job) => sum + calculateTotal(job),
        0
      )

    const monthCostValue = costs
      .filter((cost) => cost.month?.startsWith(key) && cost.type !== 'revenue')
      .reduce((sum, cost) => sum + Number(cost.amount || 0), 0)

    return {
      key,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      revenue: trendRevenue,
      costs: monthCostValue,
      profit: trendRevenue - monthCostValue,
    }
  })

  const trendMax = Math.max(
    1,
    ...trendMonths.flatMap((item) => [item.revenue, item.costs])
  )

  const recordPartnerTransfer = async (amount) => {
    const safeAmount = Number(amount || 0)

    if (!safeAmount || safeAmount <= 0 || Math.abs(partnerCostBalance) <= 0.01) {
      return
    }

    if (selectedMonthKey !== currentMonthKey) {
      await showCustomAlert(
        'Rozliczenie pieniędzy między wspólnikami zapisujemy w bieżącym miesiącu. Przejdź do bieżącego miesiąca i zatwierdź rozliczenie.'
      )
      return
    }

    const fromPerson = partnerCostBalance > 0 ? partnerTwo : partnerOne
    const toPerson = partnerCostBalance > 0 ? partnerOne : partnerTwo

    if (safeAmount > Math.abs(partnerCostBalance) + 0.01) {
      await showCustomAlert(
        `Kwota nie może być większa niż aktualne saldo: ${formatMoney(Math.abs(partnerCostBalance))}.`
      )
      return
    }

    try {
      setSettlementSaving(true)

      const saved = await createPartnerTransfer({
        settlementId: null,
        transferDate: getTodayString(),
        fromPerson,
        toPerson,
        amount: safeAmount,
        note: safeAmount >= Math.abs(partnerCostBalance) - 0.01
          ? 'Pełne rozliczenie salda kosztów'
          : 'Częściowe rozliczenie salda kosztów',
      })

      setPartnerTransfers((current) => [...current, saved])

      await showCustomAlert(
        safeAmount >= Math.abs(partnerCostBalance) - 0.01
          ? `Saldo zostało rozliczone: ${formatMoney(safeAmount)}.`
          : `Zapisano częściową spłatę: ${formatMoney(safeAmount)}.`
      )
    } catch (error) {
      console.error('Nie udało się zapisać rozliczenia salda:', error)
      await showCustomAlert('Nie udało się zapisać rozliczenia salda.')
    } finally {
      setSettlementSaving(false)
    }
  }

  const confirmFullPartnerSettlement = async () => {
    if (Math.abs(partnerCostBalance) <= 0.01) return

    const confirmed = await showCustomConfirm(
      `${balanceDirection} ${formatMoney(balanceAmount)}.\\n\\nCzy potwierdzasz, że pieniądze zostały oddane?`
    )

    if (!confirmed) return

    await recordPartnerTransfer(balanceAmount)
  }

  const confirmPartialPartnerSettlement = async () => {
    if (Math.abs(partnerCostBalance) <= 0.01) return

    const value = await showCustomPrompt(
      `Aktualne saldo: ${formatMoney(balanceAmount)}.\\n\\nPodaj kwotę częściowej spłaty.`,
      ''
    )

    if (value === null || value === '') return

    const amount = parseDecimal(value)

    if (!amount || amount <= 0) {
      await showCustomAlert('Podaj prawidłową kwotę.')
      return
    }

    await recordPartnerTransfer(amount)
  }

  const addCost = async () => {
    const amount = parseDecimal(newCost.amount)

    if (!amount || amount <= 0) {
      showCustomAlert('Podaj prawidłową kwotę.')
      return
    }

    if (!newCost.date) {
      showCustomAlert('Podaj datę kosztu.')
      return
    }

    const cost = {
      type: 'cost',
      amount,
      category: newCost.category,
      month: newCost.date,
      description: newCost.description.trim(),
      paidBy: newCost.paidBy,
    }

    try {
      const savedCost = await createFinance(cost)
      setCosts((currentCosts) =>
        currentCosts.some((item) => item.id === savedCost.id)
          ? currentCosts
          : [savedCost, ...currentCosts]
      )
    } catch (error) {
      console.error('Nie udało się zapisać kosztu w Supabase:', error)
      showCustomAlert('Nie udało się zapisać kosztu w Supabase. Koszt nie został dodany.')
      return
    }

    setNewCost({
      category: 'ZUS',
      amount: '',
      paidBy: partnerOne,
      description: '',
      date: getTodayString(),
    })

    setShowForm(false)
  }

  const removeCost = async (costId) => {
    try {
      await deleteFinance(costId)
      setCosts((currentCosts) =>
        currentCosts.filter((cost) => cost.id !== costId)
      )
    } catch (error) {
      console.error('Nie udało się usunąć kosztu z Supabase:', error)
      showCustomAlert('Nie udało się usunąć kosztu z Supabase.')
    }
  }

  const startEditCost = (cost) => {
    setEditingCostId(cost.id)
    setEditCost({
      category: cost.category || 'ZUS',
      amount: String(cost.amount ?? ''),
      paidBy: cost.paidBy || partnerOne,
      description: cost.description || '',
      date: cost.month || getTodayString(),
    })
    setShowForm(false)
  }

  const cancelEditCost = () => {
    setEditingCostId(null)
    setEditCost({
      category: 'ZUS',
      amount: '',
      paidBy: partnerOne,
      description: '',
      date: getTodayString(),
    })
  }

  const saveEditCost = async () => {
    const amount = parseDecimal(editCost.amount)

    if (!amount || amount <= 0) {
      showCustomAlert('Podaj prawidłową kwotę.')
      return
    }

    if (!editCost.date) {
      showCustomAlert('Podaj datę kosztu.')
      return
    }

    const currentCost = costs.find((cost) => cost.id === editingCostId)

    if (!currentCost) {
      showCustomAlert('Nie znaleziono kosztu do edycji.')
      cancelEditCost()
      return
    }

    const updatedCost = {
      ...currentCost,
      type: 'cost',
      amount,
      category: editCost.category,
      month: editCost.date,
      description: editCost.description.trim(),
      paidBy: editCost.paidBy,
    }

    try {
      const savedCost = await updateFinance(updatedCost)
      setCosts((currentCosts) =>
        currentCosts.map((cost) =>
          cost.id === savedCost.id ? savedCost : cost
        )
      )
      cancelEditCost()
    } catch (error) {
      console.error('Nie udało się zmienić kosztu w Supabase:', error)
      showCustomAlert('Nie udało się zmienić kosztu w Supabase. Zmiana nie została zapisana.')
    }
  }

  return (
    <div className="sub-page">

      <div className="page-heading finance-page-heading">
        <div>
          <div className="small-label">{settings?.company?.shortName || 'Twoja firma'}</div>
          <h1>Finanse</h1>
          <div className="finance-page-subtitle">Kontrola pieniędzy, należności i kosztów</div>
        </div>

        {!showForm && !editingCostId && (
          <button
            type="button"
            className="finance-header-add-button"
            onClick={() => setShowForm(true)}
          >
            <span aria-hidden="true">+</span>
            Dodaj koszt
          </button>
        )}
      </div>

      <section className="detail-card receivables-card">
        <div className="receivables-header">
          <div>
            <div className="small-label">NALEŻNOŚCI</div>
            <h2>Do odzyskania</h2>
          </div>
          <div className="receivables-total" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <strong>{formatMoney(totalReceivablesNet)} netto</strong>
            <span style={{ fontSize: '14px', opacity: 0.72 }}>{formatMoney(totalReceivablesVat)} VAT</span>
            <span style={{ fontSize: '17px', fontWeight: 800 }}>{formatMoney(totalReceivables)} brutto</span>
          </div>
        </div>
        <div className="receivables-summary">
          <span>{receivables.length} {receivables.length === 1 ? 'nieopłacona należność' : 'nieopłacone należności'} • netto + VAT + brutto</span>
          {overdueReceivables > 0 && <strong>🔴 Zaległe: {formatMoney(overdueReceivables)}</strong>}
        </div>
        {receivables.length > 0 ? (
          <div className="receivables-list">
            {receivables.map((item) => {
              const dueLabel = item.isOverdue
                ? 'Zaległość • ' + new Date(item.dueDate).toLocaleDateString('pl-PL')
                : 'Termin • ' + new Date(item.dueDate).toLocaleDateString('pl-PL')
              return (
                <button type="button" className="receivable-row" key={item.id} onClick={() => item.invoiceId ? onOpenInvoice?.(item.invoiceId) : onOpenJob?.(item.job)}>
                  <div className="receivable-main">
                    <strong>{item.invoiceNumber || item.job.name || 'Bez nazwy'}</strong>
                    <span>{item.clientName}</span>
                  </div>
                  <div className="receivable-amount">
                    <strong>{formatMoney(item.remainingNet)} netto</strong>
                    <span style={{ display: 'block', fontSize: '12px', opacity: 0.72 }}>{formatMoney(item.remainingVat)} VAT • {formatMoney(item.remaining)} brutto</span>
                    <span className={item.isOverdue ? 'client-payment-overdue' : 'client-payment-due'}>
                      {item.isOverdue ? dueLabel + ' • ' + Math.max(1, Math.ceil((new Date(getTodayString()) - new Date(item.dueDate)) / 86400000)) + ' dni' : dueLabel}
                    </span>
                  </div>
                  <span className="receivable-arrow">→</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="receivables-empty">🎉 Wszystkie należności są rozliczone.</div>
        )}
      </section>

      <div
        className="detail-card"
        style={{
          padding: '14px 18px',
          marginBottom: '14px',
          position: 'relative',
          overflow: 'visible',
          zIndex: 50,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <button
            className="restore-button"
            onClick={() => changeMonth(-1)}
            aria-label="Poprzedni miesiąc"
            style={{ fontSize: '20px', minWidth: '46px' }}
          >
            ‹
          </button>

          <button
            onClick={() => setShowMonthPicker((value) => !value)}
            aria-expanded={showMonthPicker}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '19px',
              fontWeight: 700,
              color: '#1f2937',
              cursor: 'pointer',
              padding: '8px 10px',
              borderRadius: '10px',
            }}
          >
            {monthTitle} <span style={{ fontSize: '14px' }}>⌄</span>
          </button>

          <button
            className="restore-button"
            onClick={() => changeMonth(1)}
            aria-label="Następny miesiąc"
            style={{ fontSize: '20px', minWidth: '46px' }}
          >
            ›
          </button>
        </div>

        {showMonthPicker && (() => {
          const monthNames = Array.from({ length: 12 }, (_, index) =>
            new Intl.DateTimeFormat('pl-PL', { month: 'long' }).format(
              new Date(2026, index, 1)
            )
          )

          const currentYear = today.getFullYear()

          // Pokazujemy również lata bez żadnych danych, żeby można było
          // swobodnie przejść wstecz i zacząć prowadzić historię finansów.
          const dataYears = [
            ...Array.from({ length: 11 }, (_, index) => currentYear - index),
            ...costs
              .map((cost) => cost.month?.slice(0, 4))
              .filter(Boolean)
              .map(Number),
            ...jobs
              .map((job) => job.completedAt?.slice(0, 4))
              .filter(Boolean)
              .map(Number),
          ]

          const years = [...new Set(dataYears)]
            .filter((year) => Number.isFinite(year) && year <= currentYear)
            .sort((a, b) => b - a)

          return (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% - 2px)',
                right: '12px',
                left: '12px',
                zIndex: 1000,
                background: '#fff',
                border: '1px solid #dfe5ec',
                borderRadius: '16px',
                boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
                padding: '10px',
                maxHeight: '360px',
                overflowY: 'auto',
              }}
            >
              {years.map((year) => {
                const yearSelected = String(year) === String(selectedYear)
                return (
                  <div key={year} style={{ marginBottom: '6px' }}>
                    <button
                      onClick={() => {
                        if (!yearSelected) {
                          setSelectedMonthKey(`${year}-${String(selectedMonthNumber).padStart(2, '0')}`)
                        }
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: yearSelected ? '#eef4fb' : 'transparent',
                        borderRadius: '10px',
                        padding: '9px 10px',
                        textAlign: 'left',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#1f2937',
                        cursor: 'pointer',
                      }}
                    >
                      {year}
                    </button>

                    {yearSelected && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '6px',
                          padding: '7px 4px 4px',
                        }}
                      >
                        {monthNames.map((name, index) => {
                          const monthNumber = index + 1
                          const monthKey = `${year}-${String(monthNumber).padStart(2, '0')}`
                          const isSelected = monthKey === selectedMonthKey

                          return (
                            <button
                              key={monthKey}
                              onClick={() => {
                                setSelectedMonthKey(monthKey)
                                setShowMonthPicker(false)
                              }}
                              style={{
                                border: 'none',
                                background: isSelected ? '#1f5f8b' : '#f6f8fb',
                                color: isSelected ? '#fff' : '#273444',
                                borderRadius: '9px',
                                padding: '9px 5px',
                                fontSize: '13px',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                              }}
                            >
                              {name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      <section className="finance-command-center">
        <div className="finance-kpi-grid">
          <div className="finance-kpi-card finance-kpi-revenue">
            <span>OTRZYMANE</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              <div>
                <small style={{ display: 'block', fontWeight: 800, opacity: 0.72 }}>NETTO</small>
                <strong>{formatMoney(monthRevenueNet)}</strong>
              </div>
              <div>
                <small style={{ display: 'block', fontWeight: 800, opacity: 0.72 }}>BRUTTO</small>
                <strong>{formatMoney(monthRevenueGross)}</strong>
              </div>
            </div>
            <small>Faktycznie otrzymane pieniądze</small>
          </div>
          <div className="finance-kpi-card">
            <span>KOSZTY</span>
            <strong>{formatMoney(totalCosts)}</strong>
            <small>{monthCosts.length} wpisów w miesiącu</small>
          </div>
          <div className="finance-kpi-card finance-kpi-profit">
            <span>ZYSK</span>
            <strong>{formatMoney(profit)}</strong>
            <small>Przychód minus koszty</small>
          </div>
          <div className="finance-kpi-card finance-kpi-split">
            <span>DO PODZIAŁU 50/50</span>
            <strong>{formatMoney(splitAmount)}</strong>
            <small>Na osobę</small>
          </div>
        </div>

        <div className="finance-quick-actions">
          <button type="button" className="finance-quick-action finance-quick-action-primary" onClick={() => setShowForm(true)}>
            <span>＋</span>
            <div><strong>Dodaj koszt</strong><small>Zapisz nowy wydatek</small></div>
          </button>
          <button type="button" className="finance-quick-action" onClick={() => onOpenInvoices?.()}>
            <span>🧾</span>
            <div><strong>Faktury</strong><small>{invoicesToIssue} do wystawienia</small></div>
          </button>
          <button type="button" className="finance-quick-action" onClick={() => onOpenJobs?.('active')}>
            <span>🔧</span>
            <div><strong>Realizacje</strong><small>{partiallyPaidReceivables} częściowo opłaconych</small></div>
          </button>
        </div>

        <div className="finance-command-grid">
          <div className="finance-command-card">
            <div className="finance-command-card-header">
              <div>
                <div className="finance-overview-label">PŁATNOŚCI</div>
                <h2>Gotówka i należności</h2>
              </div>
              <span className="finance-command-icon">💰</span>
            </div>

            <div className="finance-payment-row">
              <span>Otrzymane w miesiącu</span>
              <strong>{formatMoney(monthPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))}</strong>
            </div>
            <div className="finance-payment-row">
              <span>Do otrzymania</span>
              <strong className="finance-warning-value">{formatMoney(totalReceivables)}</strong>
            </div>

            <div className="finance-payment-progress">
              <div className="finance-payment-progress-label">
                <span>Ogólny poziom spływu płatności netto</span>
                <strong>{Math.round(paymentCollectionPercent)}%</strong>
              </div>
              <div className="finance-payment-progress-track">
                <div
                  className="finance-payment-progress-fill"
                  style={{ width: `${paymentCollectionPercent}%` }}
                />
              </div>
            </div>
          </div>

          {hasPartnerSettlement && (
          <div className="finance-command-card">
            <div className="finance-command-card-header">
              <div>
                <div className="finance-overview-label">WSPÓLNICY</div>
                <h2>Podział i koszty</h2>
              </div>
              <span className="finance-command-icon">👥</span>
            </div>

            <div className="finance-partner-mini-grid">
              <div>
                <span>{partnerOne}</span>
                <strong>{formatMoney(splitAmount)}</strong>
              </div>
              <div>
                <span>{partnerTwo}</span>
                <strong>{formatMoney(splitAmount)}</strong>
              </div>
            </div>

            <div className="finance-payment-row finance-payment-row-border">
              <span>Saldo kosztów</span>
              <strong className={partnerCostBalance > 0.01 || partnerCostBalance < -0.01 ? 'finance-warning-value' : 'finance-success-value'}>
                {Math.abs(partnerCostBalance) > 0.01 ? formatMoney(balanceAmount) : 'Rozliczone'}
              </strong>
            </div>
          </div>

          )}
        </div>

        <div className="finance-command-grid finance-command-grid-bottom">
          <div className="finance-command-card">
            <div className="finance-command-card-header">
              <div>
                <div className="finance-overview-label">TREND</div>
                <h2>Ostatnie 6 miesięcy</h2>
              </div>
            </div>

            <div className="finance-trend-chart">
              {trendMonths.map((item) => (
                <div className="finance-trend-column" key={item.key}>
                  <div className="finance-trend-bars">
                    <div
                      className="finance-trend-bar finance-trend-bar-revenue"
                      style={{ height: `${Math.max(6, (item.revenue / trendMax) * 100)}%` }}
                      title={`Otrzymane: ${formatMoney(item.revenue)}`}
                    />
                    <div
                      className="finance-trend-bar finance-trend-bar-costs"
                      style={{ height: `${Math.max(4, (item.costs / trendMax) * 100)}%` }}
                      title={`Koszty: ${formatMoney(item.costs)}`}
                    />
                  </div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="finance-trend-legend">
              <span><i className="finance-trend-dot finance-trend-dot-revenue" /> Otrzymane</span>
              <span><i className="finance-trend-dot finance-trend-dot-costs" /> Koszty</span>
            </div>
          </div>

          <div className="finance-command-card">
            <div className="finance-command-card-header">
              <div>
                <div className="finance-overview-label">WYMAGA UWAGI</div>
                <h2>Najważniejsze działania</h2>
              </div>
              <span className="finance-command-icon">⚠️</span>
            </div>

            {monthAlerts.length === 0 ? (
              <div className="finance-alert-empty">
                <span>✓</span>
                <div>
                  <strong>Wszystko rozliczone</strong>
                  <small>Brak pilnych spraw finansowych.</small>
                </div>
              </div>
            ) : (
              <div className="finance-alert-list">
                {monthAlerts.map((alert, index) => (
                  <div className={`finance-alert-item finance-alert-${alert.type}`} key={`${alert.title}-${index}`}>
                    <span className="finance-alert-icon">{alert.icon}</span>
                    <div>
                      <strong>{alert.title}</strong>
                      <small>{alert.text}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="finance-year-summary">
        <div className="finance-year-summary-header">
          <div>
            <div className="finance-overview-label">PODSUMOWANIE ROKU</div>
            <h2>Rok {selectedYear}</h2>
          </div>
          <span className="finance-year-summary-badge">Bieżący rok</span>
        </div>
        <div className="finance-year-summary-grid">
          <div>
            <span>Otrzymane netto</span>
            <strong>{formatMoney(
              yearPayments.reduce((sum, payment) => sum + getReceivedNetAmount(payment), 0) +
              legacyCompletedJobsThisYear.reduce((sum, job) => sum + calculateTotal(job), 0)
            )}</strong>
          </div>
          <div>
            <span>Otrzymane brutto</span>
            <strong>{formatMoney(yearRevenue)}</strong>
          </div>
          <div><span>Koszty</span><strong>{formatMoney(yearCosts)}</strong></div>
          <div><span>Zysk</span><strong className={yearProfit >= 0 ? 'finance-year-positive' : 'finance-year-negative'}>{formatMoney(yearProfit)}</strong></div>
          <div><span>Należności do zapłaty</span><strong className={totalReceivables > 0.01 ? 'finance-year-warning' : 'finance-year-positive'}>{formatMoney(totalReceivables)}</strong></div>
        </div>
      </section>

      {hasPartnerSettlement && (
      <div className="finance-partner-card">
        <div className="finance-partner-card-header">
          <div>
            <div className="finance-overview-label">SALDO WSPÓLNIKÓW</div>
            <h2>Rozliczenie kosztów</h2>
            <p>Saldo przechodzi automatycznie na kolejne miesiące.</p>
          </div>

          {Math.abs(partnerCostBalance) <= 0.01 && (
            <span className="finance-status-ok">Rozliczone</span>
          )}
        </div>

        <div className={
          `finance-balance-box ${
            partnerCostBalance > 0.01
              ? 'is-lukasz-creditor'
              : partnerCostBalance < -0.01
                ? 'is-pawel-creditor'
                : 'is-settled'
          }`
        }>
          <span className="finance-balance-caption">Aktualne saldo</span>

          {Math.abs(partnerCostBalance) > 0.01 ? (
            <>
              <strong className="finance-balance-direction">{balanceDirection}</strong>
              <strong className="finance-balance-amount">{formatMoney(balanceAmount)}</strong>
            </>
          ) : (
            <strong className="finance-balance-direction">Nikt nikomu nic nie jest winien</strong>
          )}

          {Math.abs(previousCostBalance) > 0.01 && (
            <span className="finance-balance-note">
              Z poprzednich miesięcy: {formatMoney(Math.abs(previousCostBalance))}
            </span>
          )}
        </div>

        {Math.abs(partnerCostBalance) > 0.01 && (
          <div className="finance-settlement-actions">
            <button
              type="button"
              className="finance-settle-button"
              onClick={confirmFullPartnerSettlement}
              disabled={settlementSaving}
            >
              ✓ Rozlicz {formatMoney(balanceAmount)}
            </button>

            <button
              type="button"
              className="finance-partial-settle-button"
              onClick={confirmPartialPartnerSettlement}
              disabled={settlementSaving}
            >
              Rozlicz część
            </button>
          </div>
        )}

        <div className="finance-partner-explanation">
          <span>Jak to działa?</span>
          <p>
            Każdy koszt dzielimy po 50/50. Jeśli jedna osoba zapłaci więcej, druga oddaje jej tylko swoją połowę tego kosztu.
            Przykład: przy koszcie 2000 zł zapłaconym przez jednego wspólnika, drugi oddaje 1000 zł. Nierozliczone saldo przechodzi dalej.
          </p>
        </div>
      </div>

      )}

      <div className="detail-card finance-cost-card">
        <div className="finance-cost-header finance-cost-header-modern">
          <div className="finance-cost-title-wrap">
            <div className="finance-cost-title-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 4h10M7 8h10M7 12h6M5 20h14V4H5v16Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2>Koszty</h2>
              <span>{monthTitle}</span>
            </div>
          </div>
          <strong className="finance-cost-total">{formatMoney(totalCosts)}</strong>
        </div>

        {monthCosts.length === 0 ? (
          <div className="cost-empty-state">
            <div className="cost-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <strong>Brak kosztów</strong>
              <span>Nie dodano jeszcze kosztów w tym miesiącu.</span>
            </div>
          </div>
        ) : (
          <div className="cost-table">
            <div className="cost-table-header" aria-hidden="true">
              <span>Kategoria</span>
              <span>Opis</span>
              <span>Data</span>
              <span>Zapłacił</span>
              <span className="cost-table-header-amount">Kwota</span>
              <span></span>
            </div>

            <div className="cost-table-body">
              {monthCosts.map((cost) => (
                <div
                  key={cost.id}
                  className={`cost-table-row ${editingCostId === cost.id ? 'cost-table-row-editing' : ''}`}
                >
                  <div className="cost-category-cell">
                    <CostIcon category={cost.category} />
                    <div>
                      <strong>{cost.category || 'Inne'}</strong>
                      <span className="cost-mobile-date">{formatDate(cost.month)}</span>
                    </div>
                  </div>

                  <div className="cost-description-cell">
                    <span>{cost.description || 'Bez opisu'}</span>
                  </div>

                  <div className="cost-date-cell">
                    {formatDate(cost.month)}
                  </div>

                  <div className="cost-payer-cell">
                    <span>{cost.paidBy || '—'}</span>
                  </div>

                  <div className="cost-amount-cell">
                    {formatMoney(cost.amount)}
                  </div>

                  <div className="cost-actions">
                    <button
                      type="button"
                      className="cost-edit-button"
                      onClick={() => startEditCost(cost)}
                      aria-label={`Zmień koszt ${cost.category || 'Inne'} ${formatMoney(cost.amount)}`}
                      title="Zmień"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="cost-delete-button"
                      onClick={() => removeCost(cost.id)}
                      aria-label={`Usuń koszt ${cost.category || 'Inne'} ${formatMoney(cost.amount)}`}
                      title="Usuń"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 7h14M10 11v6M14 11v6M9 7V4h6v3M7 7l1 14h8l1-14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {editingCostId && (
          <div className="cost-form cost-form-modern" style={{ marginTop: '14px' }}>
            <div className="cost-form-header">
              <span className="cost-form-header-icon cost-form-header-icon-edit" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h3>Zmień koszt</h3>
                <p>Edytuj wybrany wydatek</p>
              </div>
            </div>

            <div className="cost-form-grid">
              <div className="cost-form-field">
                <label>Kategoria</label>
                <select
                  value={editCost.category}
                  onChange={(e) =>
                    setEditCost({ ...editCost, category: e.target.value })
                  }
                >
                  {safeCategoryOptions.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cost-form-field">
                <label>Kwota</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editCost.amount}
                  onChange={(e) =>
                    setEditCost({ ...editCost, amount: e.target.value })
                  }
                />
              </div>

              <div className="cost-form-field">
                <label>Kto zapłacił</label>
                <select
                  value={editCost.paidBy}
                  onChange={(e) =>
                    setEditCost({ ...editCost, paidBy: e.target.value })
                  }
                >
                  <option value={partnerOne}>{partnerOne}</option>
                  <option value={partnerTwo}>{partnerTwo}</option>
                </select>
              </div>

              <div className="cost-form-field cost-form-field-wide">
                <label>Opis</label>
                <input
                  type="text"
                  value={editCost.description}
                  onChange={(e) =>
                    setEditCost({ ...editCost, description: e.target.value })
                  }
                />
              </div>

              <div className="cost-form-field">
                <label>Data</label>
                <input
                  type="date"
                  value={editCost.date}
                  onChange={(e) =>
                    setEditCost({ ...editCost, date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="cost-form-actions cost-form-actions-modern">
              <button className="cost-save-button" onClick={saveEditCost}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Zapisz zmiany</span>
              </button>
              <button className="cost-cancel-button" onClick={cancelEditCost}>
                Anuluj
              </button>
            </div>
          </div>
        )}

        {!showForm && !editingCostId && (
          <button
            type="button"
            className="cost-add-button cost-add-button-modern"
            onClick={() => setShowForm(true)}
          >
            <span className="cost-add-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span>Dodaj koszt</span>
          </button>
        )}

        {showForm && (
          <div className="cost-form cost-form-modern">
            <div className="cost-form-header">
              <span className="cost-form-header-icon cost-form-header-icon-add" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h3>Dodaj koszt</h3>
                <p>Wprowadź nowy wydatek w firmie</p>
              </div>
            </div>

            <div className="cost-form-grid">
              <div className="cost-form-field">
                <label>Kategoria</label>
                <select
                  value={newCost.category}
                  onChange={(e) =>
                    setNewCost({ ...newCost, category: e.target.value })
                  }
                >
                  {safeCategoryOptions.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cost-form-field">
                <label>Kwota</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="np. 2800,00"
                  value={newCost.amount}
                  onChange={(e) =>
                    setNewCost({ ...newCost, amount: e.target.value })
                  }
                />
              </div>

              <div className="cost-form-field">
                <label>Kto zapłacił</label>
                <select
                  value={newCost.paidBy}
                  onChange={(e) =>
                    setNewCost({ ...newCost, paidBy: e.target.value })
                  }
                >
                  <option value={partnerOne}>{partnerOne}</option>
                  <option value={partnerTwo}>{partnerTwo}</option>
                </select>
              </div>

              <div className="cost-form-field cost-form-field-wide">
                <label>Opis</label>
                <input
                  type="text"
                  placeholder="Opis kosztu (opcjonalnie)"
                  value={newCost.description}
                  onChange={(e) =>
                    setNewCost({ ...newCost, description: e.target.value })
                  }
                />
              </div>

              <div className="cost-form-field">
                <label>Data</label>
                <input
                  type="date"
                  value={newCost.date}
                  onChange={(e) =>
                    setNewCost({ ...newCost, date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="cost-form-actions cost-form-actions-modern">
              <button className="cost-save-button" onClick={addCost}>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
                <span>Dodaj koszt</span>
              </button>
              <button
                className="cost-cancel-button"
                onClick={() => setShowForm(false)}
              >
                Anuluj
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="detail-card" style={{ marginTop: '14px' }}>
        <div className="finance-cost-header">
          <div>
            <h2 style={{ marginBottom: '4px' }}>Zakończone realizacje</h2>
            <span>Przychód w {monthTitle}</span>
          </div>
          <strong>{formatMoney(revenue)}</strong>
        </div>

        {completedJobsThisMonth.length === 0 ? (
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              background: '#f6f8fb',
              marginTop: '12px',
            }}
          >
            Brak zakończonych robót w tym miesiącu.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '12px',
            }}
          >
            {completedJobsThisMonth.map((job) => (
              <div
                key={job.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: '#f6f8fb',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{job.name}</strong>
                  <div
                    style={{
                      marginTop: '3px',
                      color: '#68758a',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {job.location}
                  </div>
                </div>
                <strong style={{ whiteSpace: 'nowrap' }}>
                  {formatMoney(calculateTotal(job))}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="detail-card"
        style={{
          marginTop: '14px',
          marginBottom: '14px',
        }}
      >
        <button
          type="button"
          onClick={() => setShowHistory((value) => !value)}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div>
            <h2 style={{ marginBottom: '4px' }}>Historia finansów</h2>
            <span>
              Wszystkie zapisane koszty — od najnowszych
            </span>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 700 }}>
            {showHistory ? '⌃' : '⌄'}
          </span>
        </button>

        {showHistory && (
          <div style={{ marginTop: '14px' }}>
            {costs.length === 0 ? (
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#f7f9fc',
                  color: '#68758a',
                }}
              >
                Brak zapisanych kosztów.
              </div>
            ) : (
              [...costs]
                .filter((cost) => cost.type !== 'revenue')
                .sort((a, b) =>
                  String(b.month || '').localeCompare(String(a.month || ''))
                )
                .map((cost) => (
                  <div
                    key={cost.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr auto',
                      gap: '10px',
                      alignItems: 'center',
                      padding: '11px 0',
                      borderBottom: '1px solid #edf0f4',
                    }}
                  >
                    <span style={{ color: '#68758a', fontSize: '13px' }}>
                      {cost.month
                        ? new Date(`${cost.month}T00:00:00`).toLocaleDateString('pl-PL')
                        : '—'}
                    </span>

                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block' }}>
                        {cost.category || 'Inne'}
                      </strong>
                      <span
                        style={{
                          color: '#68758a',
                          fontSize: '13px',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {cost.description || `Zapłacił: ${cost.paidBy || '—'}`}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ display: 'block', whiteSpace: 'nowrap' }}>
                        {formatMoney(Number(cost.amount || 0))}
                      </strong>
                      <span style={{ color: '#68758a', fontSize: '12px' }}>
                        {cost.paidBy || '—'}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      <div
        className="detail-card"
        style={{
          marginTop: '14px',
          marginBottom: '24px',
        }}
      >
        <div className="finance-cost-header">
          <div>
            <h2 style={{ marginBottom: '4px' }}>Podsumowanie {selectedYear}</h2>
            <span>Otrzymane płatności i koszty</span>
          </div>
        </div>

        <div
          className="finance-summary"
          style={{
            marginTop: '12px',
            marginBottom: 0,
          }}
        >
          <div>
            <span>Otrzymane</span>
            <strong>{formatMoney(yearRevenue)}</strong>
            <small>{yearPayments.length} płatności</small>
          </div>

          <div>
            <span>Koszty</span>
            <strong>{formatMoney(yearCosts)}</strong>
            <small>{yearCostsList.length} wpisów</small>
          </div>

          <div>
            <span>Zysk</span>
            <strong>{formatMoney(yearProfit)}</strong>
            <small>Po kosztach</small>
          </div>
        </div>
      </div>

    </div>
  )
}


/* =====================================================
   IKONA KOSZTU
   ===================================================== */

function CostIcon({ category }) {
  const normalized = String(category || '').toLowerCase()

  let type = 'other'

  if (normalized.includes('zus')) type = 'zus'
  else if (normalized.includes('podatek')) type = 'tax'
  else if (normalized.includes('paliw')) type = 'fuel'
  else if (normalized.includes('mater')) type = 'material'

  if (type === 'zus') {
    return (
      <span className="cost-icon cost-icon-zus" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5 20h14M7 20V9h10v11M4 9h16M9 9V6h6v3M8 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  if (type === 'tax') {
    return (
      <span className="cost-icon cost-icon-tax" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 3.5h9l3 3V20.5H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14.5 3.5v4h3.5M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  if (type === 'fuel') {
    return (
      <span className="cost-icon cost-icon-fuel" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 20V5.5A1.5 1.5 0 0 1 7.5 4h6A1.5 1.5 0 0 1 15 5.5V20M5 20h12M8 7h5M18 8v8.5a1.5 1.5 0 0 0 3 0V12l-2-2M18 7l2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  if (type === 'material') {
    return (
      <span className="cost-icon cost-icon-material" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="m4 8 8-4 8 4-8 4-8-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M4 8v8l8 4 8-4V8M12 12v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  return (
    <span className="cost-icon cost-icon-other" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 3.5h9l3 3V20.5H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14.5 3.5v4h3.5M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}


/* =====================================================
   USTAWIENIA
   ===================================================== */

function SettingsPage({
  settings,
  setSettings,
  authSession,
}) {

  const [editingRates, setEditingRates] = useState(false)

  const currentRates = settings.rates || {
    mb: 100,
    m2: 220,
    kg: 0,
  }

  const [accessDiagnostic, setAccessDiagnostic] = useState(null)

  useEffect(() => {
    let cancelled = false

    const runAccessDiagnostic = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError

        const { data: memberships, error: membershipError } = await supabase
          .from('organization_members')
          .select('organization_id,role,display_name')

        const { data: visibleJobs, error: jobsError } = await supabase
          .from('jobs')
          .select('id,organization_id,deleted_at')
          .limit(50)

        if (!cancelled) {
          setAccessDiagnostic({
            userId: userData?.user?.id || null,
            email: userData?.user?.email || null,
            anonymous: Boolean(userData?.user?.is_anonymous),
            memberships: memberships || [],
            membershipError: membershipError?.message || null,
            jobsCount: Array.isArray(visibleJobs) ? visibleJobs.length : null,
            jobsSampleOrganizationId: visibleJobs?.[0]?.organization_id || null,
            jobsActiveCount: Array.isArray(visibleJobs)
              ? visibleJobs.filter((job) => !job.deleted_at).length
              : null,
            jobsError: jobsError?.message || null,
          })
        }
      } catch (error) {
        if (!cancelled) setAccessDiagnostic({ error: error?.message || String(error) })
      }
    }

    runAccessDiagnostic()

    return () => { cancelled = true }
  }, [authSession?.user?.id])

  const [draftRates, setDraftRates] = useState({
    mb: currentRates.mb ?? 0,
    m2: currentRates.m2 ?? 0,
    kg: currentRates.kg ?? 0,
  })

  const openRates = () => {
    setDraftRates({ ...currentRates })
    setEditingRates(true)
  }

  const saveRates = () => {
    const clean = (value) => {
      const normalized = String(value ?? '').replace(',', '.').trim()
      if (normalized === '') return ''
      const number = Number(normalized)
      return Number.isFinite(number) && number >= 0 ? String(number) : null
    }

    const mb = clean(draftRates.mb)
    const m2 = clean(draftRates.m2)
    const kg = clean(draftRates.kg)

    if (mb === null || m2 === null || kg === null) {
      showCustomAlert('Stawki muszą być liczbami większymi lub równymi 0.')
      return
    }

    setSettings({
      ...settings,
      rates: { mb, m2, kg },
    })
    setEditingRates(false)
  }

  const cancelRates = () => {
    setDraftRates({ ...currentRates })
    setEditingRates(false)
  }

  const company = {
    shortName: settings.company?.shortName || '',
    name: settings.company?.name || '',
    nip: settings.company?.nip || '',
    regon: settings.company?.regon || '',
    address: settings.company?.address || '',
    email: settings.company?.email || '',
    bankAccount: settings.company?.bankAccount || '',
  }

  const [showCompany, setShowCompany] = useState(false)
  const [editingCompany, setEditingCompany] = useState(false)
  const [draftCompany, setDraftCompany] = useState({ ...company })

  const openCompanyEdit = () => {
    setDraftCompany({ ...company })
    setEditingCompany(true)
  }

  const saveCompany = async () => {
    if (!draftCompany.name.trim()) {
      showCustomAlert('Podaj nazwę firmy.')
      return
    }

    const nextCompany = {
      shortName: draftCompany.shortName?.trim() || draftCompany.name.trim(),
      name: draftCompany.name.trim(),
      nip: draftCompany.nip.trim(),
      regon: draftCompany.regon.trim(),
      address: draftCompany.address.trim(),
      email: draftCompany.email.trim(),
      bankAccount: draftCompany.bankAccount?.trim() || '',
    }

    if (authSession) {
      try {
        const { data: organization, error: organizationError } = await supabase
          .from('organizations')
          .select('id')
          .maybeSingle()

        if (organizationError) throw organizationError
        if (!organization?.id) throw new Error('Nie znaleziono organizacji użytkownika.')

        const { error: updateError } = await supabase
          .from('organizations')
          .update({
            name: nextCompany.name,
            short_name: nextCompany.shortName,
            nip: nextCompany.nip || null,
            regon: nextCompany.regon || null,
            address: nextCompany.address || null,
            email: nextCompany.email || null,
            bank_account: nextCompany.bankAccount || null,
          })
          .eq('id', organization.id)

        if (updateError) throw updateError
      } catch (error) {
        console.error('Nie udało się zapisać danych firmy w Supabase:', error)
        await showCustomAlert('Nie udało się zapisać danych firmy. Spróbuj ponownie.')
        return
      }
    }

    setSettings({
      ...settings,
      company: nextCompany,
    })

    setEditingCompany(false)
  }

  const cancelCompanyEdit = () => {
    setDraftCompany({ ...company })
    setEditingCompany(false)
  }

  const [showBackup, setShowBackup] = useState(false)
  const [backupInputKey, setBackupInputKey] = useState(0)

  const defaultCategories = [
    { name: 'ZUS', enabled: true },
    { name: 'Podatek', enabled: true },
    { name: 'Inne', enabled: true },
  ]

  const categories = Array.isArray(settings.categories) && settings.categories.length > 0
    ? settings.categories
    : defaultCategories

  const [showCategories, setShowCategories] = useState(false)

  const toggleCategory = (name) => {
    const current = categories.find((category) => category.name === name)
    if (!current) return

    const enabledCount = categories.filter((category) => category.enabled !== false).length

    if (current.enabled !== false && enabledCount <= 1) {
      showCustomAlert('Musi pozostać przynajmniej jedna aktywna kategoria.')
      return
    }

    setSettings({
      ...settings,
      categories: categories.map((category) =>
        category.name === name
          ? { ...category, enabled: !category.enabled }
          : category
      ),
    })
  }

  const exportBackup = async () => {
    try {
      const [remoteJobs, remoteDeletedJobs, remoteOffers, remoteInvoices, remoteFinance, remoteJobPayments, remotePartnerSettlements, remotePartnerTransfers, remoteClients] = await Promise.all([
        getJobs(),
        getDeletedJobs(),
        getOffers(),
        getInvoices(),
        getFinance(),
        getAllJobPayments(),
        getPartnerSettlements(),
        getPartnerTransfers(),
        getClients(),
      ])

      const backup = {
        app: 'Moja Firma',
        backupVersion: 5,
        createdAt: new Date().toISOString(),
        settings,
        jobs: [
          ...(Array.isArray(remoteJobs) ? remoteJobs : []),
          ...(Array.isArray(remoteDeletedJobs) ? remoteDeletedJobs : []),
        ],
        offers: Array.isArray(remoteOffers) ? remoteOffers : [],
        clients: Array.isArray(remoteClients) ? remoteClients : [],
        invoices: Array.isArray(remoteInvoices) ? remoteInvoices : [],
        finance: Array.isArray(remoteFinance) ? remoteFinance : [],
        generalReminders: Array.isArray(generalReminders) ? generalReminders : [],
        jobPayments: Array.isArray(remoteJobPayments) ? remoteJobPayments : [],
        partnerSettlements: Array.isArray(remotePartnerSettlements) ? remotePartnerSettlements : [],
        partnerTransfers: Array.isArray(remotePartnerTransfers) ? remotePartnerTransfers : [],
        note: 'Kopia zawiera dane aplikacji, klientów, płatności i rozliczenia wspólników. Zdjęcia i dokumenty pozostają w Supabase Storage.',
      }

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: 'application/json;charset=utf-8' }
      )

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)

      link.href = url
      link.download = `moja-firma-backup-${date}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      showCustomAlert('Kopia zapasowa została utworzona.')
    } catch (error) {
      console.error('Nie udało się utworzyć kopii zapasowej:', error)
      showCustomAlert('Nie udało się utworzyć kopii zapasowej. Sprawdź połączenie z bazą.')
    }
  }

  const importBackup = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const backup = JSON.parse(raw)

      if (
        !backup ||
        !['Moja Firma', 'Aeroinstal'].includes(backup.app) ||
        ![1, 2, 3, 4, 5].includes(backup.backupVersion) ||
        !Array.isArray(backup.jobs) ||
        !Array.isArray(backup.finance) ||
        !backup.settings
      ) {
        throw new Error('Nieprawidłowy format kopii.')
      }

      const confirmed = await showCustomConfirm(
        'Przywrócić dane z tej kopii? Istniejące rekordy o tych samych ID zostaną zaktualizowane.'
      )

      if (!confirmed) {
        setBackupInputKey((value) => value + 1)
        return
      }

      const jobsRows = backup.jobs.map((job) => ({
        id: job.id,
        name: job.name,
        location: job.location || null,
        status: job.status || (job.completed ? 'Zakończone' : 'W toku'),
        progress: Number(job.progress || 0),
        completed: Boolean(job.completed),
        completed_at: job.completedAt || null,
        invoice_number: job.invoiceNumber || null,
        invoice_date: job.invoiceDate || null,
        invoice_amount: job.invoiceAmount == null ? null : Number(job.invoiceAmount),
        payment_due_date: job.paymentDueDate || null,
        paid_at: job.paidAt || null,
        quantity_mb: Number(job.quantities?.mb || 0),
        quantity_m2: Number(job.quantities?.m2 || 0),
        quantity_kg: Number(job.quantities?.kg || 0),
        rate_mb: Number(job.rates?.mb || 0),
        rate_m2: Number(job.rates?.m2 || 0),
        rate_kg: Number(job.rates?.kg || 0),
        documents: job.documents || { material: null, assembly: null },
        notes: Array.isArray(job.notes) ? job.notes : [],
        photos: Array.isArray(job.photos) ? job.photos : [],
        main_photo: job.mainPhoto || null,
        deleted_at: job.deletedAt || null,
      }))

      if (jobsRows.length > 0) {
        const { error: jobsError } = await supabase
          .from('jobs')
          .upsert(jobsRows, { onConflict: 'id' })

        if (jobsError) {
          throw jobsError
        }
      }

      const offerRows = (backup.offers || []).map((offer) => ({
        id: offer.id,
        organization_id: offer.organizationId || authOrganizationId,
        client_id: offer.clientId || null,
        offer_number: offer.offerNumber || null,
        name: offer.name || '',
        location: offer.location || null,
        status: offer.status || 'Nowa',
        valid_until: offer.validUntil || null,
        quantity_mb: Number(offer.quantities?.mb || 0),
        quantity_m2: Number(offer.quantities?.m2 || 0),
        quantity_kg: Number(offer.quantities?.kg || 0),
        rate_mb: Number(offer.rates?.mb || 0),
        rate_m2: Number(offer.rates?.m2 || 0),
        rate_kg: Number(offer.rates?.kg || 0),
        scope: offer.scope || null,
        notes: offer.notes || null,
        total: Number(offer.total || 0),
        source_job_id: offer.sourceJobId || null,
        converted_job_id: offer.convertedJobId || null,
        created_at: offer.createdAt || undefined,
        updated_at: offer.updatedAt || undefined,
      }))

      if (offerRows.length > 0) {
        const { error: offerError } = await supabase
          .from('offers')
          .upsert(offerRows, { onConflict: 'id' })

        if (offerError) throw offerError
      }

      const clientRows = (backup.clients || []).map((item) => ({
        id: item.id,
        organization_id: item.organizationId || authOrganizationId,
        name: item.name || '',
        nip: item.nip || null,
        address: item.address || null,
        contact_name: item.contactName || null,
        phone: item.phone || null,
        email: item.email || null,
        notes: item.notes || null,
        short_name: item.shortName || null,
        created_at: item.createdAt || undefined,
        updated_at: item.updatedAt || undefined,
      }))

      if (clientRows.length > 0) {
        const { error: clientError } = await supabase
          .from('clients')
          .upsert(clientRows, { onConflict: 'id' })
        if (clientError) throw clientError
      }

      const invoiceRows = (backup.invoices || []).map((item) => ({
        id: item.id,
        organization_id: item.organizationId || authOrganizationId,
        job_id: item.jobId || null,
        client_id: item.clientId || null,
        invoice_number: item.invoiceNumber || '',
        issue_date: item.issueDate || getTodayString(),
        sale_date: item.saleDate || null,
        due_date: item.dueDate || null,
        status: item.status || 'Do wystawienia',
        payment_method: item.paymentMethod || 'Przelew',
        currency: item.currency || 'PLN',
        net_amount: Number(item.netAmount || 0),
        vat_amount: Number(item.vatAmount || 0),
        gross_amount: Number(item.grossAmount || 0),
        paid_amount: Number(item.paidAmount || 0),
        vat_settled_amount: Number(item.vatSettledAmount || 0),
        items: Array.isArray(item.items) ? item.items : [],
        notes: item.notes || null,
        ksef_status: item.ksefStatus || null,
        ksef_number: item.ksefNumber || null,
        ksef_id: item.ksefId || null,
        ksef_sent_at: item.ksefSentAt || null,
        ksef_error: item.ksefError || null,
        created_at: item.createdAt || undefined,
        updated_at: item.updatedAt || undefined,
      }))

      if (invoiceRows.length > 0) {
        const { error: invoiceError } = await supabase
          .from('invoices')
          .upsert(invoiceRows, { onConflict: 'id' })
        if (invoiceError) throw invoiceError
      }

      const financeRows = backup.finance.map((item) => ({
        id: item.id,
        type: item.type,
        amount: Number(item.amount || 0),
        category: item.category || null,
        month: item.month,
        description: item.description || null,
        paid_by: item.paidBy || null,
        created_at: item.createdAt || undefined,
      }))

      if (financeRows.length > 0) {
        const { error: financeError } = await supabase
          .from('finance')
          .upsert(financeRows, { onConflict: 'id' })

        if (financeError) {
          throw financeError
        }
      }

      const paymentRows = (backup.jobPayments || []).map((item) => ({
        id: item.id,
        job_id: item.jobId,
        invoice_id: item.invoiceId || null,
        amount: Number(item.amount || 0),
        paid_at: item.paidAt || getTodayString(),
        note: item.note || null,
        created_at: item.createdAt || undefined,
      }))

      if (paymentRows.length > 0) {
        const { error: paymentError } = await supabase
          .from('job_payments')
          .upsert(paymentRows, { onConflict: 'id' })
        if (paymentError) throw paymentError
      }

      const settlementRows = (backup.partnerSettlements || []).map((item) => ({
        id: item.id,
        month: item.month,
        profit: Number(item.profit || 0),
        lukasz_share: Number(item.lukaszShare || 0),
        pawel_share: Number(item.pawelShare || 0),
        lukasz_paid: Number(item.lukaszPaid || 0),
        pawel_paid: Number(item.pawelPaid || 0),
        closed: Boolean(item.closed),
        closed_at: item.closedAt || null,
        note: item.note || null,
        created_at: item.createdAt || undefined,
        updated_at: item.updatedAt || undefined,
      }))

      if (settlementRows.length > 0) {
        const { error: settlementError } = await supabase
          .from('partner_settlements')
          .upsert(settlementRows, { onConflict: 'id' })
        if (settlementError) throw settlementError
      }

      const transferRows = (backup.partnerTransfers || []).map((item) => ({
        id: item.id,
        settlement_id: item.settlementId || null,
        transfer_date: item.transferDate || getTodayString(),
        from_person: item.fromPerson,
        to_person: item.toPerson,
        amount: Number(item.amount || 0),
        note: item.note || null,
        created_at: item.createdAt || undefined,
      }))

      if (transferRows.length > 0) {
        const { error: transferError } = await supabase
          .from('partner_transfers')
          .upsert(transferRows, { onConflict: 'id' })
        if (transferError) throw transferError
      }

      if (Array.isArray(backup.generalReminders) && backup.generalReminders.length > 0) {
        const reminderRows = backup.generalReminders.map((item) => ({
          id: item.id,
          text: item.text || '',
          date: item.date || null,
          time: item.time || null,
          done: Boolean(item.done),
          created_at: item.createdAt || item.created_at || undefined,
        }))

        const { error: reminderError } = await supabase
          .from('general_reminders')
          .upsert(reminderRows, { onConflict: 'id' })

        if (reminderError) throw reminderError
      }

      localStorage.setItem(
        'moja_firma_settings',
        JSON.stringify(backup.settings)
      )

      showCustomAlert('Kopia została przywrócona. Aplikacja zostanie odświeżona.')
      window.location.reload()
    } catch (error) {
      console.error('Nie udało się przywrócić kopii:', error)
      showCustomAlert('Nie udało się przywrócić kopii. Plik może być nieprawidłowy.')
      setBackupInputKey((value) => value + 1)
    }
  }

  return (
    <>
      <div className="page-heading settings-page-heading">
        <div>
          <div className="small-label">MOJA FIRMA</div>
          <h1>Ustawienia</h1>
        </div>
      </div>

      <div className="settings-list settings-page">
        <div className="detail-card settings-detail-card" style={{ border: '1px solid #d7e7f5', background: '#f8fbff' }}>
            <h2 style={{ marginTop: 0 }}>Diagnostyka dostępu</h2>
            {!accessDiagnostic && <div style={{ fontSize: '13px', opacity: 0.7 }}>Sprawdzam sesję i dostęp do danych…</div>}
            {accessDiagnostic?.error && <pre style={{ whiteSpace: 'pre-wrap', color: '#a22', fontSize: '12px' }}>{accessDiagnostic.error}</pre>}
            {accessDiagnostic && !accessDiagnostic.error && (
              <div style={{ fontSize: '12px', lineHeight: 1.7, wordBreak: 'break-word' }}>
                <div><strong>user id:</strong> {accessDiagnostic.userId || 'brak'}</div>
                <div><strong>email:</strong> {accessDiagnostic.email || 'brak'}</div>
                <div><strong>anonymous:</strong> {String(accessDiagnostic.anonymous)}</div>
                <div><strong>organizacje:</strong> {accessDiagnostic.memberships.length}</div>
                <div><strong>jobs widoczne:</strong> {accessDiagnostic.jobsCount ?? 'brak'}</div>
                {accessDiagnostic.jobsActiveCount != null && (
                  <div><strong>jobs aktywne:</strong> {accessDiagnostic.jobsActiveCount}</div>
                )}
                {accessDiagnostic.jobsSampleOrganizationId && (
                  <div><strong>org pierwszej roboty:</strong> {accessDiagnostic.jobsSampleOrganizationId}</div>
                )}
                {accessDiagnostic.membershipError && <div style={{ color: '#a22' }}><strong>membership error:</strong> {accessDiagnostic.membershipError}</div>}
                {accessDiagnostic.jobsError && <div style={{ color: '#a22' }}><strong>jobs error:</strong> {accessDiagnostic.jobsError}</div>}
                {accessDiagnostic.memberships.map((item, index) => (
                  <div key={index}>{item.organization_id} · {item.role} · {item.display_name || ''}</div>
                ))}
              </div>
            )}
          </div>
        <div className="settings-item settings-item-locked settings-section-user">
          <div>
            <span>👤 Użytkownik</span>
            {authSession ? (
              <>
                <div className="settings-locked-info">
                  <strong>{authSession.user?.user_metadata?.display_name || authSession.user?.email || 'Zalogowany użytkownik'}</strong>
                </div>
                <div className="settings-locked-note">
                  {authSession.user?.email || 'Konto firmowe'}
                </div>
              </>
            ) : (
              <>
                <div className="settings-locked-info">
                  <strong>Zalogowany użytkownik</strong>
                </div>
                <div className="settings-locked-note">
                  Konto firmowe
                </div>
              </>
            )}
          </div>
          <span className="settings-lock-icon">{authSession ? '🔐' : '📱'}</span>
        </div>

        {authSession && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
            <button
              type="button"
              className="back-button"
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.reload()
              }}
            >
              Wyloguj się
            </button>
          </div>
        )}

        <TeamSettings authSession={authSession} />

        <div
          className="settings-item settings-section-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowCompany(!showCompany)}
        >
          <div>
            <span>🏢 Firma</span>
            {!showCompany && (
              <div style={{ marginTop: '5px', fontSize: '13px', opacity: 0.7 }}>
                {company.shortName || 'Twoja firma'}
              </div>
            )}
          </div>
          <span>{showCompany ? '⌄' : '›'}</span>
        </div>

        {showCompany && (
          <div className="detail-card settings-detail-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <h2 style={{ margin: 0 }}>Dane firmy</h2>

              {!editingCompany && (
                <button
                  className="edit-button"
                  onClick={openCompanyEdit}
                >
                  Zmień
                </button>
              )}
            </div>

            {editingCompany ? (
              <div
                style={{
                  display: 'grid',
                  gap: '10px',
                  marginTop: '14px',
                }}
              >
                {[
                  ['shortName', 'Nazwa skrócona'],
                  ['name', 'Pełna nazwa firmy'],
                  ['nip', 'NIP'],
                  ['regon', 'REGON'],
                  ['address', 'Adres'],
                  ['email', 'E-mail'],
                  ['bankAccount', 'Numer rachunku bankowego'],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    style={{
                      display: 'grid',
                      gap: '5px',
                    }}
                  >
                    <strong>{label}</strong>
                    <input
                      className="note-text-input"
                      type={key === 'email' ? 'email' : 'text'}
                      value={draftCompany[key] || ''}
                      onChange={(e) =>
                        setDraftCompany({
                          ...draftCompany,
                          [key]: e.target.value,
                        })
                      }
                    />
                  </label>
                ))}

                <div className="settings-form-actions"
                  style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '4px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    className="save-button"
                    onClick={saveCompany}
                  >
                    Zapisz
                  </button>

                  <button
                    className="back-button"
                    onClick={cancelCompanyEdit}
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  lineHeight: 1.8,
                  marginTop: '14px',
                }}
              >
                <div><strong>{company.shortName || 'Twoja firma'}</strong></div>
                <div style={{ marginTop: '4px' }}>Pełna nazwa: {company.name || '—'}</div>
                <div>NIP: {company.nip || '—'}</div>
                <div>REGON: {company.regon || '—'}</div>
                <div>{company.address || '—'}</div>
                <div>E-mail: {company.email || '—'}</div>
                <div>Rachunek: {company.bankAccount || '—'}</div>
              </div>
            )}
          </div>
        )}

        <div
          className="settings-item"
          style={{ cursor: 'pointer' }}
          onClick={openRates}
        >
          <div>
            <span>💰 Domyślne stawki</span>
            {!editingRates && (
              <div style={{ marginTop: '5px', fontSize: '13px', opacity: 0.7 }}>
                MB: {currentRates.mb || '—'} zł · m²: {currentRates.m2 || '—'} zł · kg: {currentRates.kg || '—'} zł
              </div>
            )}
          </div>
          {!editingRates && <span>›</span>}
        </div>

        {editingRates && (
          <div className="detail-card">
            <h2>Domyślne stawki</h2>

            <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
              {[
                ['mb', 'MB', 'zł / mb'],
                ['m2', 'm²', 'zł / m²'],
                ['kg', 'kg', 'zł / kg'],
              ].map(([key, label, unit]) => (
                <label
                  key={key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  <span>
                    <strong>{label}</strong>
                    <small style={{ display: 'block', opacity: 0.6 }}>
                      {unit}
                    </small>
                  </span>
                  <input
                    className="note-text-input"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={draftRates[key]}
                    onChange={(e) =>
                      setDraftRates({
                        ...draftRates,
                        [key]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>

            <div
              style={{
                marginTop: '12px',
                fontSize: '13px',
                opacity: 0.65,
              }}
            >
              Te stawki będą automatycznie podpowiadane przy dodawaniu nowej realizacje.
            </div>

            <div className="settings-form-actions" style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button className="save-button" onClick={saveRates}>Zapisz stawki</button>
              <button className="back-button" onClick={cancelRates}>Anuluj</button>
            </div>
          </div>
        )}

        <div
          className="settings-item"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowCategories(!showCategories)}
        >
          <div>
            <span>📊 Kategorie kosztów</span>
            {!showCategories && (
              <div style={{ marginTop: '5px', fontSize: '13px', opacity: 0.7 }}>
                ZUS, Podatek, Inne
              </div>
            )}
          </div>
          <span>{showCategories ? '⌄' : '›'}</span>
        </div>

        {showCategories && (
          <div className="detail-card settings-detail-card">
            <h2>Kategorie kosztów</h2>

            <div style={{ fontSize: '13px', opacity: 0.7, lineHeight: 1.6 }}>
              Wybierz, które kategorie mają być dostępne przy dodawaniu kosztów.
              Istniejące koszty nie zostaną usunięte po wyłączeniu kategorii.
            </div>

            <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
              {categories.map((category) => (
                <div
                  key={category.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                  }}
                >
                  <strong>{category.name}</strong>

                  <button
                    type="button"
                    className={category.enabled !== false ? 'save-button' : 'back-button'}
                    onClick={() => toggleCategory(category.name)}
                    style={{ minWidth: '105px' }}
                  >
                    {category.enabled !== false ? 'Aktywna' : 'Wyłączona'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '12px', fontSize: '12px', opacity: 0.55 }}>
              Kategorie są zgodne z obecnym modułem finansowym. Paliwo nie jest kategorią kosztu.
            </div>
          </div>
        )}

        <div
          className="settings-item"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowBackup(!showBackup)}
        >
          <div>
            <span>💾 Kopia zapasowa</span>
            {!showBackup && (
              <div style={{ marginTop: '5px', fontSize: '13px', opacity: 0.7 }}>
                Eksport i przywracanie danych
              </div>
            )}
          </div>
          <span>{showBackup ? '⌄' : '›'}</span>
        </div>

        {showBackup && (
          <div className="detail-card settings-detail-card">
            <h2>Kopia zapasowa</h2>

            <div style={{ fontSize: '13px', opacity: 0.7, lineHeight: 1.6 }}>
              Kopia zapisuje ustawienia, realizacje, finanse oraz informacje o zdjęciach
              i dokumentach. Same pliki pozostają bezpiecznie w Supabase Storage.
            </div>

            <div className="settings-backup-actions"
              style={{
                display: 'grid',
                gap: '10px',
                marginTop: '14px',
              }}
            >
              <button
                className="save-button"
                onClick={exportBackup}
              >
                ↓ Eksportuj kopię
              </button>

              <label
                className="back-button"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                ↑ Przywróć z kopii
                <input
                  key={backupInputKey}
                  type="file"
                  accept=".json,application/json"
                  onChange={importBackup}
                  hidden
                />
              </label>
            </div>

            <div
              style={{
                marginTop: '12px',
                fontSize: '12px',
                opacity: 0.55,
              }}
            >
              Zalecam robić kopię po większych zmianach w aplikacji.
            </div>
          </div>
        )}
      </div>

      <AppDialogHost />
    </>
  )
}


function TeamSettings({ authSession }) {
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('employee')
  const [showTeam, setShowTeam] = useState(false)

  const currentUserId = authSession?.user?.id

  const loadTeam = async () => {
    setLoading(true)
    try {
      const [{ data: memberRows, error: memberError }, { data: inviteRows, error: inviteError }] = await Promise.all([
        supabase.from('organization_members').select('user_id,organization_id,role,display_name,email,created_at').order('created_at', { ascending: true }),
        supabase.from('organization_invitations').select('id,email,role,status,expires_at,created_at').order('created_at', { ascending: false }),
      ])
      if (memberError) throw memberError
      if (inviteError) throw inviteError
      setMembers(memberRows || [])
      setInvitations(inviteRows || [])
    } catch (error) {
      console.error('Nie udało się wczytać zespołu:', error)
      await showCustomAlert('Nie udało się wczytać listy pracowników.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authSession) return
    loadTeam()
  }, [authSession?.user?.id])

  const currentMember = members.find((member) => member.user_id === currentUserId)
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin'

  const sendInvite = async (event) => {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      await showCustomAlert('Podaj prawidłowy adres e-mail pracownika.')
      return
    }

    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('organization-invitations', {
        body: { action: 'send', email: cleanEmail, role },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setEmail('')
      await loadTeam()
      await showCustomAlert(
        data?.existingUser
          ? 'To konto już istniało. Użytkownik został dodany do firmy i może zalogować się swoim dotychczasowym kontem.'
          : 'Zaproszenie zostało wysłane.'
      )
    } catch (error) {
      console.error('Nie udało się wysłać zaproszenia:', error)
      await showCustomAlert(error?.message || 'Nie udało się wysłać zaproszenia.')
    } finally {
      setSending(false)
    }
  }

  const changeRole = async (member, nextRole) => {
    if (member.user_id === currentUserId || member.role === 'owner') return
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: nextRole })
        .eq('user_id', member.user_id)
      if (error) throw error
      await loadTeam()
    } catch (error) {
      console.error('Nie udało się zmienić roli:', error)
      await showCustomAlert('Nie udało się zmienić roli pracownika.')
    }
  }

  const removeMember = async (member) => {
    if (member.user_id === currentUserId || member.role === 'owner') return
    const confirmed = await showCustomConfirm(
      `Usunąć użytkownika ${member.email || member.display_name || 'pracownika'} z firmy?`
    )
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', member.user_id)
      if (error) throw error
      await loadTeam()
    } catch (error) {
      console.error('Nie udało się usunąć pracownika:', error)
      await showCustomAlert('Nie udało się usunąć pracownika.')
    }
  }

  const revokeInvite = async (invite) => {
    if (invite.status !== 'pending') return
    const confirmed = await showCustomConfirm(`Anulować zaproszenie dla ${invite.email}?`)
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('organization_invitations')
        .update({ status: 'revoked' })
        .eq('id', invite.id)
      if (error) throw error
      await loadTeam()
    } catch (error) {
      console.error('Nie udało się anulować zaproszenia:', error)
      await showCustomAlert('Nie udało się anulować zaproszenia.')
    }
  }

  if (!authSession) return null

  return (
    <>
      <div
        className="settings-item settings-section-row"
        style={{ cursor: 'pointer' }}
        onClick={() => setShowTeam(!showTeam)}
      >
        <div>
          <span>👥 Pracownicy i dostęp</span>
          {!showTeam && (
            <div style={{ marginTop: '5px', fontSize: '13px', opacity: 0.7 }}>
              {members.length} {members.length === 1 ? 'użytkownik' : 'użytkowników'}
            </div>
          )}
        </div>
        <span>{showTeam ? '⌄' : '›'}</span>
      </div>

      {showTeam && (
        <div className="detail-card settings-detail-card">
          <h2>Pracownicy i dostęp</h2>
          <div style={{ fontSize: '13px', opacity: 0.7, lineHeight: 1.6 }}>
            Dodawaj pracowników do swojej firmy i określaj, czy mają dostęp administratora, czy tylko dostęp pracownika.
          </div>

          {canManage && (
            <form onSubmit={sendInvite} style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
              <strong>Dodaj pracownika</strong>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="pracownik@firma.pl"
                style={settingsInputStyle}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
                <select value={role} onChange={(event) => setRole(event.target.value)} style={settingsInputStyle}>
                  <option value="employee">Pracownik</option>
                  <option value="admin">Administrator</option>
                </select>
                <button className="save-button" type="submit" disabled={sending}>
                  {sending ? 'Wysyłanie…' : 'Wyślij zaproszenie'}
                </button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
            <strong>Zespół</strong>
            {loading && <div style={{ fontSize: '13px', opacity: 0.65 }}>Wczytywanie…</div>}
            {!loading && members.map((member) => (
              <div key={member.user_id} style={teamRowStyle}>
                <div style={{ minWidth: 0 }}>
                  <strong>{member.display_name || member.email || 'Użytkownik'}</strong>
                  <div style={{ fontSize: '12px', opacity: 0.65, marginTop: 3 }}>
                    {member.email || 'Brak e-maila'} · {member.role === 'owner' ? 'Właściciel' : member.role === 'admin' ? 'Administrator' : 'Pracownik'}
                  </div>
                </div>
                {canManage && member.user_id !== currentUserId && member.role !== 'owner' && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    <select
                      value={member.role}
                      onChange={(event) => changeRole(member, event.target.value)}
                      style={{ ...settingsInputStyle, minHeight: '38px', padding: '7px 10px', width: 'auto' }}
                    >
                      <option value="employee">Pracownik</option>
                      <option value="admin">Administrator</option>
                    </select>
                    <button type="button" className="back-button" onClick={() => removeMember(member)}>
                      Usuń
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {canManage && (
            <div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
              <strong>Zaproszenia</strong>
              {invitations.length === 0 && (
                <div style={{ fontSize: '13px', opacity: 0.65 }}>Brak zaproszeń.</div>
              )}
              {invitations.map((invite) => (
                <div key={invite.id} style={teamRowStyle}>
                  <div>
                    <strong>{invite.email}</strong>
                    <div style={{ fontSize: '12px', opacity: 0.65, marginTop: 3 }}>
                      {invite.role === 'admin' ? 'Administrator' : 'Pracownik'} · {invite.status === 'pending' ? 'Oczekuje' : invite.status === 'accepted' ? 'Zaakceptowane' : invite.status === 'revoked' ? 'Anulowane' : 'Wygasłe'}
                    </div>
                  </div>
                  {invite.status === 'pending' && (
                    <button type="button" className="back-button" onClick={() => revokeInvite(invite)}>
                      Anuluj
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '14px', fontSize: '12px', opacity: 0.55, lineHeight: 1.5 }}>
            Właściciel ma pełny dostęp. Administrator zarządza pracownikami, ale nie może przejąć właścicielstwa. Pracownik nie zarządza kontami ani ustawieniami firmy.
          </div>
        </div>
      )}
    </>
  )
}

const settingsInputStyle = {
  width: '100%',
  minHeight: '46px',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid #d7e1eb',
  background: '#f8fbfe',
  color: '#12234f',
  fontSize: '14px',
}

const teamRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '12px 0',
  borderBottom: '1px solid rgba(0,0,0,0.07)',
}

/* =====================================================
   DOLNE MENU
   ===================================================== */

function BottomNavigation({
  activePage,
  onChange,
}) {

  return (

    <nav className="bottom-navigation">

      <NavButton

        icon="⌂"

        label="Start"

        active={
          activePage === 'start'
        }

        onClick={() =>
          onChange(
            'start'
          )
        }

      />


      <NavButton

        icon="🔧"

        label="Realizacje"

        active={
          activePage === 'jobs'
        }

        onClick={() =>
          onChange(
            'jobs'
          )
        }

      />


      <NavButton

        icon="📄"

        label="Oferty"

        active={
          activePage === 'offers'
        }

        onClick={() =>
          onChange(
            'offers'
          )
        }

      />


      <NavButton

        icon="👥"

        label="Klienci"

        active={
          activePage === 'clients'
        }

        onClick={() =>
          onChange(
            'clients'
          )
        }

      />


            <NavButton

        icon="🧾"

        label="Faktury"

        active={
          activePage === 'invoices'
        }

        onClick={() =>
          onChange(
            'invoices'
          )
        }

      />


      <NavButton

        icon="▥"

        label="Finanse"

        active={
          activePage === 'finance'
        }

        onClick={() =>
          onChange(
            'finance'
          )
        }

      />


      <NavButton

        icon="⚙"

        label="Ustawienia"

        active={
          activePage === 'settings'
        }

        onClick={() =>
          onChange(
            'settings'
          )
        }

      />

    </nav>

  )

}


/* =====================================================
   PRZYCISK MENU
   ===================================================== */

function NavButton({
  icon,
  label,
  active,
  onClick,
}) {

  return (

    <button

      className={
        active
          ? 'nav-item active'
          : 'nav-item'
      }

      onClick={
        onClick
      }

    >

      <span>
        {icon}
      </span>


      <small>
        {label}
      </small>

    </button>

  )

}


/* =====================================================
   OBLICZENIA
   ===================================================== */

function calculateTotal(
  job
) {

  return (

    (Number(
      job.quantities?.mb
    ) || 0) *

      (Number(
        job.rates?.mb
      ) || 0)

    +

    (Number(
      job.quantities?.m2
    ) || 0) *

      (Number(
        job.rates?.m2
      ) || 0)

    +

    (Number(
      job.quantities?.kg
    ) || 0) *

      (Number(
        job.rates?.kg
      ) || 0)

  )

}


/* =====================================================
   DZISIEJSZA DATA
   ===================================================== */

function getCurrentTimeString() {

  const now =
    new Date()


  const hours =
    String(
      now.getHours()
    ).padStart(
      2,
      '0'
    )


  const minutes =
    String(
      now.getMinutes()
    ).padStart(
      2,
      '0'
    )


  return (
    `${hours}:${minutes}`
  )

}


function getTodayString() {

  const now =
    new Date()


  const year =
    now.getFullYear()


  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      '0'
    )


  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    )


  return (
    `${year}-${month}-${day}`
  )

}


/* =====================================================
   PIENIĄDZE
   ===================================================== */

function formatMoney(
  value
) {

  return (

    Number(
      value || 0
    )
      .toLocaleString(
        'pl-PL'
      )

    +

    ' zł'

  )

}


/* =====================================================
   DATA
   ===================================================== */

function formatCreatedAt(
  value
) {

  if (!value) {
    return ''
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return ''
  }

  return (
    `${String(date.getDate()).padStart(2, '0')}.` +
    `${String(date.getMonth() + 1).padStart(2, '0')}.` +
    `${date.getFullYear()} • ` +
    `${String(date.getHours()).padStart(2, '0')}:` +
    `${String(date.getMinutes()).padStart(2, '0')}`
  )

}


function formatDate(
  date
) {

  if (
    !date
  ) {
    return ''
  }


  const parts =
    date.split('-')


  if (
    parts.length !== 3
  ) {
    return date
  }


  return (

    `${parts[2]}.` +

    `${parts[1]}.` +

    `${parts[0]}`

  )

}


export default App