import { useEffect, useRef, useState } from 'react'
import './App.css'
import logo from './assets/logo.png'
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
   IDENTYFIKACJA URZĄDZENIA
   ===================================================== */

const DEVICE_ID_KEY = 'aeroinstal_device_id'
const DEVICE_USER_KEY = 'aeroinstal_device_user'
const DEVICE_USERS = ['Łukasz', 'Paweł']

function getOrCreateDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing

    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    localStorage.setItem(DEVICE_ID_KEY, generated)
    return generated
  } catch (error) {
    console.error('Nie udało się zapisać identyfikatora urządzenia:', error)
    return `temporary-${Date.now()}`
  }
}

function getLocalDeviceUser() {
  try {
    const saved = localStorage.getItem(DEVICE_USER_KEY)
    return DEVICE_USERS.includes(saved) ? saved : null
  } catch (error) {
    console.error('Nie udało się odczytać użytkownika urządzenia:', error)
    return null
  }
}

function saveLocalDeviceUser(user) {
  try {
    localStorage.setItem(DEVICE_USER_KEY, user)
  } catch (error) {
    console.error('Nie udało się zapisać użytkownika urządzenia:', error)
  }
}

async function getDeviceUserFromSupabase(deviceId) {
  const { data, error } = await supabase
    .from('device_users')
    .select('device_id, user_name')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (error) throw error
  return data?.user_name || null
}

async function claimDeviceInSupabase(deviceId, userName) {
  // Najpierw próbujemy utworzyć przypisanie bez .select().
  // Dzięki temu INSERT nie zależy od polityki SELECT/RLS dla zwracanych wierszy.
  const { error } = await supabase
    .from('device_users')
    .insert({
      device_id: deviceId,
      user_name: userName,
    })

  if (!error) {
    // Udany INSERT oznacza, że to urządzenie zostało właśnie przypisane.
    // Nie wykonujemy tutaj dodatkowego SELECT, dzięki czemu po wyborze
    // użytkownika aplikacja nie może zatrzymać się na ekranie ładowania.
    return userName
  }

  // Jeżeli urządzenie zostało już przypisane, zawsze respektujemy
  // przypisanie zapisane w Supabase zamiast nadpisywać je z telefonu.
  if (error.code === '23505') {
    const existingUser = await getDeviceUserFromSupabase(deviceId)
    if (existingUser && DEVICE_USERS.includes(existingUser)) {
      return existingUser
    }
  }

  throw error
}

/* =====================================================
   APP
   ===================================================== */

function App() {

  const [deviceId] = useState(() => getOrCreateDeviceId())
  const [deviceUser, setDeviceUser] = useState(() => getLocalDeviceUser())
  const [deviceLoading, setDeviceLoading] = useState(true)

  const [activePage, setActivePage] =
    useState('start')


  const [selectedJob, setSelectedJob] =
    useState(null)


  const [addingJob, setAddingJob] =
    useState(false)


  useEffect(() => {
    let cancelled = false

    const loadDeviceUser = async () => {
      try {
        const remoteUser = await getDeviceUserFromSupabase(deviceId)

        if (cancelled) return

        if (remoteUser && DEVICE_USERS.includes(remoteUser)) {
          // Supabase jest źródłem prawdy. Jeżeli urządzenie jest już
          // przypisane, nie pokazujemy ponownie wyboru użytkownika.
          saveLocalDeviceUser(remoteUser)
          setDeviceUser(remoteUser)
          setSettings((current) => ({
            ...current,
            users: {
              first: 'Łukasz',
              second: 'Paweł',
              active: remoteUser,
            },
          }))
        } else {
          // Brak przypisania w Supabase oznacza pierwsze uruchomienie
          // (albo reset urządzenia w bazie). Czyścimy ewentualny stary
          // wpis lokalny, żeby aplikacja zawsze pokazała wybór.
          try {
            localStorage.removeItem(DEVICE_USER_KEY)
          } catch (error) {
            console.error('Nie udało się wyczyścić lokalnego użytkownika urządzenia:', error)
          }
          setDeviceUser(null)
        }
      } catch (error) {
        console.error('Nie udało się sprawdzić przypisania urządzenia:', error)
      } finally {
        if (!cancelled) setDeviceLoading(false)
      }
    }

    loadDeviceUser()

    return () => {
      cancelled = true
    }
  }, [deviceId])

  const handleDeviceUserSelect = async (user) => {
    if (!DEVICE_USERS.includes(user) || !deviceId || deviceLoading) return

    try {
      setDeviceLoading(true)

      const assignedUser = await claimDeviceInSupabase(deviceId, user)

      if (!DEVICE_USERS.includes(assignedUser)) {
        throw new Error('Supabase zwrócił nieprawidłowego użytkownika urządzenia.')
      }

      saveLocalDeviceUser(assignedUser)

      setSettings((current) => ({
        ...current,
        users: {
          first: 'Łukasz',
          second: 'Paweł',
          active: assignedUser,
        },
      }))

      setDeviceUser(assignedUser)
    } catch (error) {
      console.error('Nie udało się przypisać urządzenia:', error)
      const message = error?.message
        ? `Nie udało się przypisać telefonu.\n\n${error.message}`
        : 'Nie udało się przypisać telefonu. Sprawdź konfigurację tabeli device_users w Supabase.'
      await showCustomAlert(message)
    } finally {
      setDeviceLoading(false)
    }
  }


  const [settings, setSettings] =
    useState(() => {

      try {
        const savedSettings = localStorage.getItem(
          'aeroinstal_settings'
        )
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings)
          return {
            users: {
              first: 'Łukasz',
              second: 'Paweł',
              active: deviceUser || 'Łukasz',
            },
            rates: parsed.rates || {
              mb: '100',
              m2: '220',
              kg: '',
            },
            company: parsed.company || {
              name: 'AEROINSTAL ŁUKASZ DYSZKANT',
              nip: '5833105866',
              regon: '385589939',
              address: 'ul. Cicha 4A/9, 83-000 Pruszcz Gdański',
              email: 'Aeroinstal@wp.pl',
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
          active: deviceUser || 'Łukasz',
        },
        rates: {
          mb: '100',
          m2: '220',
          kg: '',
        },
        company: {
          name: 'AEROINSTAL ŁUKASZ DYSZKANT',
          nip: '5833105866',
          regon: '385589939',
          address: 'ul. Cicha 4A/9, 83-000 Pruszcz Gdański',
          email: 'Aeroinstal@wp.pl',
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
        'aeroinstal_settings',
        JSON.stringify(settings)
      )
    } catch (error) {
      console.error('Nie udało się zapisać ustawień:', error)
    }

  }, [settings])


  /*
   * Wczytanie robót.
   */

  /*
   * Roboty są przechowywane wspólnie w Supabase.
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
          'Roboty wczytane z Supabase:',
          remoteJobs.length
        )

      } catch (error) {

        console.error(
          'Nie udało się wczytać robót z Supabase:',
          error
        )

      }

    }

    loadJobsFromSupabase()

    return () => {
      cancelled = true
    }

  }, [])


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
  }, [])


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
      console.error('Nie udało się zmienić zadania roboty:', error)
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
   * Pliki ze Storage są usuwane razem z robotą.
   */
  useEffect(() => {

    let cancelled = false

    const cleanupOldTrash = async () => {
      try {
        const trash = await getDeletedJobs()
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000

        for (const job of trash) {
          if (cancelled || !job.deletedAt) {
            continue
          }

          const deletedTime = new Date(job.deletedAt).getTime()

          if (!Number.isFinite(deletedTime) || deletedTime > cutoff) {
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
              'Nie udało się trwale usunąć starej roboty z kosza:',
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
  }, [])


  /*
   * Synchronizacja robót na żywo z Supabase.
   *
   * Supabase wysyła konkretny rekord, który się zmienił.
   * Aktualizujemy tylko tę jedną robotę zamiast pobierać
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

  }, [])

  /*
   * Nowa robota.
   */

  const [newJob, setNewJob] =
    useState({

      name: '',

      location: '',

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
        'Robota została zaktualizowana w Supabase:',
        updatedJob.name
      )

    } catch (error) {

      console.error(
        'Nie udało się zaktualizować roboty w Supabase:',
        error
      )

      showCustomAlert(
        'Robota została zmieniona lokalnie, ale nie udało się zapisać zmiany w Supabase.'
      )

    }

  }


  const deleteJob = async (jobToDelete) => {

    if (!jobToDelete?.id) {
      return
    }

    const confirmed = window.confirm(
      `Czy przenieść robotę „${jobToDelete.name || ''}” do kosza?\n\nRobota zostanie ukryta z listy, ale będzie można ją przywrócić przez 30 dni.`
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
        'Robota została przeniesiona do kosza. Możesz ją przywrócić przez 30 dni.'
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
        'Robota została przeniesiona do kosza:',
        savedDeletedJob.name
      )

      showCustomAlert(
        'Robota została przeniesiona do kosza. Możesz ją przywrócić przez 30 dni.'
      )

    } catch (error) {
      console.error(
        'Nie udało się przenieść roboty do kosza:',
        error
      )

      showCustomAlert(
        'Nie udało się przenieść roboty do kosza. Spróbuj ponownie.'
      )
    }
  }


  const restoreJobFromTrash = async (jobToRestore) => {

    if (!jobToRestore?.id) {
      return
    }

    const confirmed = window.confirm(
      `Przywrócić robotę „${jobToRestore.name || ''}” do aktywnych?`
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

      showCustomAlert('Robota została przywrócona.')
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
        'Robota została przywrócona:',
        restoredJob.name
      )

      showCustomAlert('Robota została przywrócona do aktywnych.')

    } catch (error) {
      console.error(
        'Nie udało się przywrócić roboty:',
        error
      )

      showCustomAlert(
        'Nie udało się przywrócić roboty. Spróbuj ponownie.'
      )
    }
  }


  const permanentlyDeleteJob = async (jobToDelete) => {

    if (!jobToDelete?.id) {
      return
    }

    const confirmed = window.confirm(
      `Usunąć robotę „${jobToDelete.name || ''}” na zawsze?\n\nTej operacji nie będzie można cofnąć.`
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

      showCustomAlert('Robota została trwale usunięta.')
      return
    }

    try {
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

      showCustomAlert('Robota została trwale usunięta.')

    } catch (error) {
      console.error(
        'Nie udało się trwale usunąć roboty:',
        error
      )

      showCustomAlert(
        'Nie udało się trwale usunąć roboty. Spróbuj ponownie.'
      )
    }
  }


  const createJob = async () => {

    if (
      !newJob.name.trim()
    ) {

      showCustomAlert(
        'Podaj nazwę roboty.'
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

      status: 'Planowane',

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
     * Najpierw zapisujemy robotę do Supabase.
     * Dzięki temu prawdziwym identyfikatorem roboty
     * staje się UUID z bazy.
     */
    let savedJob

    try {

      savedJob =
        await createSupabaseJob(
          job
        )

      console.log(
        'Nowa robota zapisana w Supabase:',
        savedJob
      )

    } catch (error) {

      console.error(
        'Nie udało się zapisać nowej roboty w Supabase:',
        error
      )

      showCustomAlert(
        'Nie udało się zapisać roboty w Supabase. Robota nie została utworzona.'
      )

      return

    }


    /*
     * Zachowujemy lokalne dane dokumentów,
     * zdjęć i notatek. Na tym etapie są one jeszcze
     * obsługiwane przez obecną aplikację.
     *
     * Z Supabase bierzemy UUID jako ID roboty.
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


  if (deviceLoading) {
    return (
      <div className="device-setup-overlay">
        <div className="device-setup-card">
          <div className="device-setup-icon">📱</div>
          <div className="small-label">AEROINSTAL</div>
          <h2>Sprawdzanie urządzenia</h2>
          <p>Sprawdzam, do którego użytkownika jest przypisany ten telefon.</p>
        </div>
      </div>
    )
  }

  if (!deviceUser) {
    return (
      <div className="device-setup-overlay">
        <div className="device-setup-card" role="dialog" aria-modal="true" aria-labelledby="device-setup-title">
          <div className="device-setup-icon">📱</div>
          <div className="small-label">PIERWSZE URUCHOMIENIE</div>
          <h2 id="device-setup-title">Kto korzysta z tego telefonu?</h2>
          <p>
            Wybierz użytkownika tego urządzenia. Po wyborze telefon zostanie przypisany i przy kolejnych uruchomieniach aplikacja rozpozna użytkownika automatycznie.
          </p>

          <div className="device-setup-buttons">
            <button type="button" disabled={deviceLoading} onClick={() => handleDeviceUserSelect('Łukasz')}>
              👤 Łukasz
            </button>
            <button type="button" disabled={deviceLoading} onClick={() => handleDeviceUserSelect('Paweł')}>
              👤 Paweł
            </button>
          </div>

          <div className="device-setup-device">
            {deviceLoading
              ? 'Zapisywanie przypisania urządzenia…'
              : 'Ten wybór zostanie zapisany dla tego urządzenia.'}
          </div>
        </div>
      </div>
    )
  }


  if (selectedJob) {

    return (
      <>
        <JobDetails

          job={
            selectedJob
          }

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

          alt="Aeroinstal"

        />

      </header>


      <main className="content">

        {activePage === 'start' && (

          <StartPage

            jobs={
              jobs
            }

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

          <JobsPage

            jobs={
              jobs
            }

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

        )}


        {activePage === 'finance' && (

          <FinancePage

            jobs={
              jobs
            }

            settings={
              settings
            }

          />

        )}


        {activePage === 'settings' && (

          <SettingsPage
            settings={settings}
            setSettings={setSettings}
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
  const plannedJobs = jobs.filter((job) => normalizeJobStage(job) === 'Planowane')
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
      <WeatherCard />

      <div className="dashboard-grid">
        <DashboardCard
          icon="📋"
          label="Wszystkie roboty"
          value={jobs.length}
          onClick={() => onJobs('all')}
        />

        <DashboardCard
          icon="▶"
          label="Aktywne roboty"
          value={activeJobs.length}
          onClick={() => onJobs('active')}
        />

        <DashboardCard
          icon="✓"
          label="Zakończone roboty"
          value={completedJobs.length}
          completed
          onClick={() => onJobs('completed')}
        />

        <DashboardCard
          icon="▥"
          label="Średni postęp"
          value={`${averageProgress}%`}
        />

        <div className="dashboard-value-card">
          <div className="dashboard-value-icon">💰</div>
          <div>
            <span>Łączna wartość robót</span>
            <strong>{formatMoney(totalValue)}</strong>
          </div>
        </div>
      </div>

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
            .sort(
              (a, b) => Number(b.progress || 0) - Number(a.progress || 0)
            )
            .slice(0, 5)
            .map((job) => (
              <JobCard
                key={job.id}
                job={job}
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

      <section>
        <div className="section-title">
          <h2>Planowane</h2>
          <button className="section-link" onClick={() => onJobs('planned')}>
            Wszystkie
          </button>
        </div>

        <div className="jobs">
          {plannedJobs.length === 0 && (
            <div className="detail-card">Brak planowanych robót.</div>
          )}

          {[...plannedJobs]
            .sort((a, b) => {
              const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0
              const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0
              return bDate - aDate
            })
            .slice(0, 5)
            .map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => onOpenJob(job)}
                onToggleTask={onToggleJobTask}
              />
            ))}

          {plannedJobs.length > 5 && (
            <button
              className="section-link"
              onClick={() => onJobs('planned')}
              style={{ alignSelf: 'center', padding: '8px 0' }}
            >
              Pokaż wszystkie planowane ({plannedJobs.length})
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
            Roboty
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
  'Planowane',
  'W toku',
  'Odbiór',
  'Faktura wystawiona',
  'Zakończone',
]

function normalizeJobStage(job) {
  if (job?.completed) return 'Zakończone'

  const raw = String(job?.status || '').trim().toLowerCase()

  if (raw === 'planowane' || raw === 'planned') return 'Planowane'
  if (raw === 'odbiór' || raw === 'odbior' || raw === 'oczekuje na odbiór') return 'Odbiór'
  if (raw === 'faktura' || raw === 'faktura wystawiona' || raw === 'invoice') return 'Faktura wystawiona'
  if (raw === 'zakończone' || raw === 'zakonczone' || raw === 'completed') return 'Zakończone'
  return 'W toku'
}

function getJobStageStyle(stage) {
  switch (stage) {
    case 'Planowane':
      return { background: '#f1f4f8', color: '#64748b' }
    case 'Odbiór':
      return { background: '#fff5df', color: '#b77908' }
    case 'Faktura wystawiona':
      return { background: '#eeeaff', color: '#6d4bc3' }
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
  onClick,
  onToggleTask,
}) {

  const stage = normalizeJobStage(job)
  const stageStyle = getJobStageStyle(stage)
  const tasks = Array.isArray(job.notes) ? job.notes : []
  const pendingTasks = tasks.filter((task) => !task.done)
  const visibleTasks = tasks.slice(0, 3)
  const completedTaskCount = tasks.filter((task) => task.done).length

  return (
    <div className="job-card job-card-with-tasks">
      <div className="job-card-main" onClick={onClick}>
        <div className="job-header">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: 0,
              flex: 1,
            }}
          >
            {job.mainPhoto?.url ? (
              <img
                src={job.mainPhoto.url}
                alt={job.mainPhoto.name || job.name}
                title="Zdjęcie główne"
                style={{
                  width: '58px',
                  height: '58px',
                  objectFit: 'cover',
                  borderRadius: '12px',
                  flexShrink: 0,
                  border: '1px solid #dfe7ee',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(job.mainPhoto.url, '_blank')
                }}
              />
            ) : (
              <div
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '12px',
                  flexShrink: 0,
                  border: '1px dashed #cbd7e2',
                  background: '#f5f8fb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  color: '#8190a5',
                }}
                title="Brak zdjęcia głównego"
              >
                📷
              </div>
            )}

            <div style={{ minWidth: 0, flex: 1 }}>
              <h3>{job.name}</h3>
              <span>{job.location}</span>
            </div>
          </div>

          <span
            className={stage === 'Zakończone' ? 'status completed' : 'status'}
            style={{
              ...stageStyle,
              padding: '7px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {stage === 'Zakończone' ? '✓ ZAKOŃCZONA' : `● ${stage.toUpperCase()}`}
          </span>
        </div>

        <div className="progress-section">
          <div className="progress-label">
            <span>Postęp</span>
            <strong>{job.progress}%</strong>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, Number(job.progress) || 0)
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="quantities">
          <div><span>MB</span><strong>{job.quantities?.mb || 0}</strong></div>
          <div><span>m²</span><strong>{job.quantities?.m2 || 0}</strong></div>
          <div><span>kg</span><strong>{job.quantities?.kg || 0}</strong></div>
        </div>
      </div>

      <div className="job-card-tasks">
        <div className="job-card-tasks-header">
          <div>
            <span className="job-card-tasks-label">ZADANIA</span>
            <strong>Do zrobienia na tej robocie</strong>
          </div>
          {tasks.length > 0 && (
            <span className="job-card-task-count">
              {completedTaskCount}/{tasks.length}
            </span>
          )}
        </div>

        {tasks.length === 0 && (
          <button
            type="button"
            className="job-card-add-task-hint"
            onClick={onClick}
          >
            + Dodaj zadanie w robocie
          </button>
        )}

        {visibleTasks.map((task) => (
          <div
            className={task.done ? 'job-task-row done' : 'job-task-row'}
            key={task.id}
          >
            <button
              type="button"
              className={task.done ? 'job-task-checkbox checked' : 'job-task-checkbox'}
              aria-label={task.done ? 'Oznacz jako niewykonane' : 'Oznacz jako wykonane'}
              onClick={(e) => {
                e.stopPropagation()
                onToggleTask?.(job, task.id)
              }}
            >
              {task.done ? '✓' : ''}
            </button>
            <button
              type="button"
              className="job-task-text"
              onClick={onClick}
            >
              <strong>{task.text}</strong>
              {task.date && <span>{formatDate(task.date)}</span>}
            </button>
          </div>
        ))}

        {tasks.length > 3 && (
          <button
            type="button"
            className="job-card-more-tasks"
            onClick={onClick}
          >
            Pokaż wszystkie zadania →
          </button>
        )}

        {tasks.length > 0 && pendingTasks.length === 0 && (
          <div className="job-card-all-done">✓ Wszystkie zadania wykonane</div>
        )}
      </div>

      <div className="job-footer">
        <span>Wartość</span>
        <strong>{formatMoney(calculateTotal(job))}</strong>
      </div>
    </div>
  )
}


/* =====================================================
   ROBOTY
   ===================================================== */

function JobsPage({
  jobs,
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
        requestedTab === 'invoice' ||
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

        if (filter === 'planned') return stage === 'Planowane'
        if (filter === 'active') return stage === 'W toku'
        if (filter === 'receipt') return stage === 'Odbiór'
        if (filter === 'invoice') return stage === 'Faktura wystawiona'
        if (filter === 'completed') return stage === 'Zakończone'

        return true

      }
    )


  const plannedCount = jobs.filter((job) => normalizeJobStage(job) === 'Planowane').length
  const activeCount = jobs.filter((job) => normalizeJobStage(job) === 'W toku').length
  const receiptCount = jobs.filter((job) => normalizeJobStage(job) === 'Odbiór').length
  const invoiceCount = jobs.filter((job) => normalizeJobStage(job) === 'Faktura wystawiona').length
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
            Roboty
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
          + Nowa robota
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
                Roboty są przechowywane przez 30 dni.
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
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
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
          style={filterButtonStyle(filter === 'planned')}
          onClick={() => setFilter('planned')}
        >
          Planowane
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
          style={filterButtonStyle(filter === 'invoice')}
          onClick={() => setFilter('invoice')}
        >
          Faktura
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
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: '8px',
          marginBottom: '16px',
          width: '100%',
        }}
      >
        <div className="job-summary-item">
          <strong>{jobs.length}</strong>
          <span>{jobs.length === 1 ? 'robota' : 'robót'}</span>
        </div>
        <div className="job-summary-item">
          <strong>{activeCount}</strong>
          <span>w toku</span>
        </div>
        <div className="job-summary-item">
          <strong>{plannedCount}</strong>
          <span>planowanych</span>
        </div>
        <div className="job-summary-item">
          <strong>{receiptCount}</strong>
          <span>odbiór</span>
        </div>
        <div className="job-summary-item">
          <strong>{invoiceCount}</strong>
          <span>faktur</span>
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
              onClick={() => onOpenJob(job)}
              onToggleTask={onToggleJobTask}
            />
          )
        )}

      </div>

    </div>

  )

}


/* =====================================================
   NOWA ROBOTA
   ===================================================== */

function NewJobPage({
  newJob,
  setNewJob,
  settings,
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
            NOWA ROBOTA
          </div>

          <h1>
            Dodaj robotę
          </h1>

        </div>

      </div>


      <div className="detail-card">

        <h2>
          Podstawowe informacje
        </h2>


        <div className="note-form">

          <input

            className="note-text-input"

            placeholder="Nazwa roboty"

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

            className="note-text-input"

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

        </div>

      </div>


      <div className="detail-card">

        <h2>
          Zakres roboty
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


        <div className="finance-row">

          <div>

            <strong>
              MB
            </strong>

            <small>
              {newJob.quantities.mb || 0} × stawka
            </small>

          </div>


          <input

            className="rate-input"

            type="text"

            inputMode="decimal"

            value={
              newJob.rates.mb
            }

            onChange={(e) =>
              changeRate(
                'mb',
                e.target.value
              )
            }

          />

        </div>


        <div className="finance-row">

          <div>

            <strong>
              m²
            </strong>

            <small>
              {newJob.quantities.m2 || 0} × stawka
            </small>

          </div>


          <input

            className="rate-input"

            type="text"

            inputMode="decimal"

            value={
              newJob.rates.m2
            }

            onChange={(e) =>
              changeRate(
                'm2',
                e.target.value
              )
            }

          />

        </div>


        <div className="finance-row">

          <div>

            <strong>
              kg
            </strong>

            <small>
              {newJob.quantities.kg || 0} × stawka
            </small>

          </div>


          <input

            className="rate-input"

            type="text"

            inputMode="decimal"

            value={
              newJob.rates.kg
            }

            onChange={(e) =>
              changeRate(
                'kg',
                e.target.value
              )
            }

          />

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
        Utwórz robotę
      </button>

    </div>

  )

}


/* =====================================================
   SZCZEGÓŁY ROBOTY
   ===================================================== */

function JobDetails({
  job,
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

      reminderEnabled: false,

      date: '',

      time: '',

    })


  useEffect(() => {

    setEditedJob(
      job
    )

  }, [job])
  const [paymentHistory, setPaymentHistory] = useState([])
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paidAt: getTodayString(),
    note: '',
  })
  const [paymentLoading, setPaymentLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadPayments = async () => {
      try {
        const rows = await getJobPayments(job?.id)
        if (!cancelled) setPaymentHistory(rows)
      } catch (error) {
        console.error('Nie udało się wczytać historii wpłat:', error)
      }
    }

    loadPayments()

    const unsubscribe = subscribeToJobPayments(job?.id, (payload) => {
      if (!payload) return

      if (payload.eventType === 'INSERT' && payload.new) {
        const incoming = {
          id: payload.new.id,
          jobId: payload.new.job_id,
          amount: Number(payload.new.amount || 0),
          paidAt: payload.new.paid_at || null,
          note: payload.new.note || '',
          createdAt: payload.new.created_at || null,
        }
        setPaymentHistory((current) =>
          current.some((item) => item.id === incoming.id)
            ? current
            : [...current, incoming].sort((a, b) =>
                String(a.paidAt || '').localeCompare(String(b.paidAt || ''))
              )
        )
      }

      if (payload.eventType === 'UPDATE' && payload.new) {
        const incoming = {
          id: payload.new.id,
          jobId: payload.new.job_id,
          amount: Number(payload.new.amount || 0),
          paidAt: payload.new.paid_at || null,
          note: payload.new.note || '',
          createdAt: payload.new.created_at || null,
        }
        setPaymentHistory((current) =>
          current.map((item) => item.id === incoming.id ? incoming : item)
        )
      }

      if (payload.eventType === 'DELETE' && payload.old?.id) {
        setPaymentHistory((current) =>
          current.filter((item) => item.id !== payload.old.id)
        )
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [job?.id])

  const invoiceAmountForPayment =
    Number(editedJob.invoiceAmount || 0) ||
    calculateTotal(editedJob)

  const paidAmountForPayment = calculatePaidAmount(paymentHistory)
  const remainingInvoiceAmount = Math.max(
    0,
    invoiceAmountForPayment - paidAmountForPayment
  )
  const invoicePaymentStatus =
    invoiceAmountForPayment <= 0
      ? 'Brak kwoty faktury'
      : paidAmountForPayment <= 0
        ? 'Nieopłacona'
        : paidAmountForPayment + 0.009 < invoiceAmountForPayment
          ? 'Częściowo zapłacona'
          : 'Opłacona'

  const refreshJobAfterPayment = async (nextPayments) => {
    const nextPaidAmount = calculatePaidAmount(nextPayments)
    const invoiceAmount =
      Number(editedJob.invoiceAmount || 0) ||
      calculateTotal(editedJob)

    if (invoiceAmount > 0 && nextPaidAmount + 0.009 >= invoiceAmount) {
      const completedJob = {
        ...editedJob,
        status: 'Zakończone',
        completed: true,
        completedAt: editedJob.completedAt || getTodayString(),
        paidAt:
          nextPayments
            .map((item) => item.paidAt)
            .filter(Boolean)
            .sort()
            .at(-1) || getTodayString(),
      }
      setEditedJob(completedJob)
      await onUpdate(completedJob)
    } else if (normalizeJobStage(editedJob) === 'Zakończone') {
      const openJob = {
        ...editedJob,
        status: 'Faktura wystawiona',
        completed: false,
        completedAt: null,
        paidAt: null,
      }
      setEditedJob(openJob)
      await onUpdate(openJob)
    }
  }

  const addInvoicePayment = async () => {
    const amount = parseDecimal(paymentForm.amount)

    if (invoiceAmountForPayment <= 0) {
      showCustomAlert('Najpierw wpisz kwotę faktury.')
      return
    }

    if (!amount || amount <= 0) {
      showCustomAlert('Podaj prawidłową kwotę wpłaty.')
      return
    }

    if (amount > remainingInvoiceAmount + 0.009) {
      showCustomAlert(
        `Wpłata jest za duża. Do zapłaty zostało ${formatMoney(remainingInvoiceAmount)}.`
      )
      return
    }

    try {
      setPaymentLoading(true)
      const savedPayment = await createJobPayment({
        jobId: editedJob.id,
        amount,
        paidAt: paymentForm.paidAt || getTodayString(),
        note: paymentForm.note,
      })

      const nextPayments = [...paymentHistory, savedPayment]
      setPaymentHistory(nextPayments)
      setPaymentForm({
        amount: '',
        paidAt: getTodayString(),
        note: '',
      })
      await refreshJobAfterPayment(nextPayments)
    } catch (error) {
      console.error('Nie udało się zapisać wpłaty:', error)
      showCustomAlert('Nie udało się zapisać wpłaty.')
    } finally {
      setPaymentLoading(false)
    }
  }

  const removeInvoicePayment = async (payment) => {
    const confirmed = await showCustomConfirm(
      `Usunąć wpłatę ${formatMoney(payment.amount)} z dnia ${formatDate(payment.paidAt)}?`
    )
    if (!confirmed) return

    try {
      setPaymentLoading(true)
      await deleteJobPayment(payment.id)
      const nextPayments = paymentHistory.filter((item) => item.id !== payment.id)
      setPaymentHistory(nextPayments)
      await refreshJobAfterPayment(nextPayments)
    } catch (error) {
      console.error('Nie udało się usunąć wpłaty:', error)
      showCustomAlert('Nie udało się usunąć wpłaty.')
    } finally {
      setPaymentLoading(false)
    }
  }




  const saveChanges = async () => {
    const stageBeforeSave = normalizeJobStage(editedJob)
    if (stageBeforeSave === 'Zakończone') {
      const invoiceAmount = Number(editedJob.invoiceAmount || 0) || calculateTotal(editedJob)
      const paidAmount = calculatePaidAmount(paymentHistory)
      const hasLegacyPaidAt = Boolean(editedJob.paidAt) && paymentHistory.length === 0

      if (invoiceAmount > 0 && paidAmount + 0.009 < invoiceAmount && !hasLegacyPaidAt) {
        showCustomAlert('Nie można zakończyć roboty. Faktura nie jest jeszcze w pełni opłacona.')
        return
      }
    }

    if (!editedJob.name.trim()) {

      showCustomAlert(
        'Podaj nazwę roboty.'
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

      invoiceNumber:
        String(editedJob.invoiceNumber || '').trim(),

      invoiceDate:
        editedJob.invoiceDate || null,

      invoiceAmount:
        editedJob.invoiceAmount === '' || editedJob.invoiceAmount == null
          ? null
          : parseDecimal(editedJob.invoiceAmount),

      paymentDueDate:
        editedJob.paymentDueDate || null,

      paidAt:
        normalizeJobStage(editedJob) === 'Zakończone'
          ? (editedJob.paidAt || getTodayString())
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

    if (nextStage === 'Zakończone') {
      const invoiceAmount = Number(editedJob.invoiceAmount || 0) || calculateTotal(editedJob)
      const paidAmount = calculatePaidAmount(paymentHistory)
      const hasLegacyPaidAt = Boolean(editedJob.paidAt) && paymentHistory.length === 0

      if (invoiceAmount > 0 && paidAmount + 0.009 < invoiceAmount && !hasLegacyPaidAt) {
        showCustomAlert(
          `Najpierw rozlicz całą fakturę. Pozostało do zapłaty: ${formatMoney(Math.max(0, invoiceAmount - paidAmount))}.`
        )
        return
      }
    }

    const updatedJob = {
      ...editedJob,
      status: nextStage,
      completed: nextStage === 'Zakończone',
      completedAt: nextStage === 'Zakończone'
        ? (editedJob.completedAt || today)
        : null,
      paidAt: nextStage === 'Zakończone'
        ? (editedJob.paidAt || today)
        : null,
    }

    if (nextStage === 'Odbiór' && Number(updatedJob.progress || 0) >= 100) {
      updatedJob.progress = 100
    }

    onUpdate(updatedJob)
    setEditedJob(updatedJob)
  }

  const nextStage = normalizeJobStage(editedJob) === 'Planowane'
    ? 'W toku'
    : normalizeJobStage(editedJob) === 'W toku'
      ? 'Odbiór'
      : normalizeJobStage(editedJob) === 'Odbiór'
        ? 'Faktura wystawiona'
        : normalizeJobStage(editedJob) === 'Faktura wystawiona'
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
       * roboty wraz ze wszystkimi zdjęciami.
       */

      setEditedJob(
        savedJob
      )

      /*
       * Aktualizujemy tylko stan aplikacji.
       * Nie wysyłamy ponownie całej roboty do Supabase.
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

    const confirmed =
      await showCustomConfirm(
        'Czy na pewno chcesz usunąć tę notatkę?'
      )

    if (!confirmed) {
      return
    }

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
        'Nie udało się usunąć notatki. Spróbuj ponownie.'
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
        ROBOTA
      </div>


      {editing ? (

        <div className="note-form">

          <input

            className="note-text-input job-edit-input"

            placeholder="Nazwa roboty"

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

        </div>

      ) : (

        <>

          <h1>
            {editedJob.name}
          </h1>


          <div className="job-location">
            {editedJob.location}
          </div>

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
          <h2>Etap roboty</h2>
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
                if (value === 'Zakończone') {
                  const invoiceAmount = Number(editedJob.invoiceAmount || 0) || calculateTotal(editedJob)
                  const paidAmount = calculatePaidAmount(paymentHistory)
                  const hasLegacyPaidAt = Boolean(editedJob.paidAt) && paymentHistory.length === 0

                  if (invoiceAmount > 0 && paidAmount + 0.009 < invoiceAmount && !hasLegacyPaidAt) {
                    showCustomAlert(
                      `Najpierw rozlicz całą fakturę. Pozostało do zapłaty: ${formatMoney(Math.max(0, invoiceAmount - paidAmount))}.`
                    )
                    return
                  }
                }

                setEditedJob({
                  ...editedJob,
                  status: value,
                  completed: value === 'Zakończone',
                  completedAt: value === 'Zakończone'
                    ? (editedJob.completedAt || getTodayString())
                    : null,
                  paidAt: value === 'Zakończone'
                    ? (editedJob.paidAt || getTodayString())
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

        {(normalizeJobStage(editedJob) === 'Faktura wystawiona' || normalizeJobStage(editedJob) === 'Zakończone') && (
          <div className="invoice-info-grid">
            <label>
              <span>Numer faktury</span>
              <input
                type="text"
                value={editedJob.invoiceNumber || ''}
                disabled={!editing}
                placeholder="np. FV/09/2026"
                onChange={(e) => setEditedJob({ ...editedJob, invoiceNumber: e.target.value })}
              />
            </label>
            <label>
              <span>Data faktury</span>
              <input
                type="date"
                value={editedJob.invoiceDate || ''}
                disabled={!editing}
                onChange={(e) => setEditedJob({ ...editedJob, invoiceDate: e.target.value })}
              />
            </label>
            <label>
              <span>Kwota faktury</span>
              <input
                type="text"
                inputMode="decimal"
                value={editedJob.invoiceAmount ?? ''}
                disabled={!editing}
                placeholder={String(calculateTotal(editedJob))}
                onChange={(e) => setEditedJob({ ...editedJob, invoiceAmount: e.target.value })}
              />
            </label>
            <label>
              <span>Termin płatności</span>
              <input
                type="date"
                value={editedJob.paymentDueDate || ''}
                disabled={!editing}
                onChange={(e) => setEditedJob({ ...editedJob, paymentDueDate: e.target.value })}
              />
            </label>
          </div>
        )}

        {normalizeJobStage(editedJob) === 'Zakończone' && editedJob.paidAt && (
          <div className="job-paid-info">
            ✓ Płatność otrzymana {formatDate(editedJob.paidAt)}
          </div>
        )}
      </div>



      {(normalizeJobStage(editedJob) === 'Faktura wystawiona' || normalizeJobStage(editedJob) === 'Zakończone') && (
        <div className="detail-card" style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
            <div>
              <div className="small-label">PŁATNOŚCI FAKTURY</div>
              <h2 style={{ marginBottom: '4px' }}>Historia wpłat</h2>
              <span style={{ color: '#6b7280', fontSize: '13px' }}>
                {invoicePaymentStatus}
              </span>
            </div>
            <strong style={{
              fontSize: '18px',
              color: invoicePaymentStatus === 'Opłacona' ? '#159447' : '#24345c',
              whiteSpace: 'nowrap',
            }}>
              {formatMoney(paidAmountForPayment)}
            </strong>
          </div>

          <div style={{
            height: '9px',
            background: '#edf2f6',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '10px',
          }}>
            <div style={{
              height: '100%',
              width: `${invoiceAmountForPayment > 0 ? Math.min(100, (paidAmountForPayment / invoiceAmountForPayment) * 100) : 0}%`,
              background: invoicePaymentStatus === 'Opłacona' ? '#16a34a' : '#0787e8',
              borderRadius: '999px',
            }} />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '10px',
            fontSize: '13px',
            color: '#66758f',
            marginBottom: '14px',
          }}>
            <span>Faktura: {formatMoney(invoiceAmountForPayment)}</span>
            <strong style={{ color: '#24345c' }}>
              Pozostało: {formatMoney(remainingInvoiceAmount)}
            </strong>
          </div>

          {paymentHistory.length > 0 ? (
            <div style={{ borderTop: '1px solid #e5ebf0' }}>
              {paymentHistory.map((payment) => (
                <div key={payment.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '11px 0',
                  borderBottom: '1px solid #eef2f5',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: '#24345c', fontSize: '14px' }}>
                      {formatDate(payment.paidAt)}
                    </strong>
                    {payment.note && (
                      <span style={{ display: 'block', marginTop: '2px', color: '#7a8799', fontSize: '12px' }}>
                        {payment.note}
                      </span>
                    )}
                  </div>
                  <strong style={{ color: '#159447', whiteSpace: 'nowrap' }}>
                    + {formatMoney(payment.amount)}
                  </strong>
                  <button
                    type="button"
                    className="document-remove"
                    onClick={() => removeInvoicePayment(payment)}
                    disabled={paymentLoading}
                    style={{ padding: '7px 9px', fontSize: '12px' }}
                  >
                    Usuń
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '10px 0 14px', color: '#7a8799', fontSize: '13px' }}>
              Brak zapisanych wpłat.
            </div>
          )}

          {invoicePaymentStatus !== 'Opłacona' && (
            <div style={{
              marginTop: '12px',
              paddingTop: '14px',
              borderTop: '1px solid #e5ebf0',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: '10px',
            }}>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>
                  Kwota wpłaty
                </span>
                <input
                  className="rate-input"
                  type="text"
                  inputMode="decimal"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder={String(remainingInvoiceAmount)}
                  disabled={paymentLoading}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>
                  Data wpłaty
                </span>
                <input
                  className="rate-input"
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })}
                  disabled={paymentLoading}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>
                  Opis (opcjonalnie)
                </span>
                <input
                  className="rate-input"
                  type="text"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  placeholder="np. przelew częściowy"
                  disabled={paymentLoading}
                />
              </label>
              <button
                type="button"
                className="save-button"
                onClick={addInvoicePayment}
                disabled={paymentLoading}
                style={{ gridColumn: '1 / -1' }}
              >
                {paymentLoading ? 'Zapisywanie…' : '+ Dodaj wpłatę'}
              </button>
            </div>
          )}
        </div>
      )}

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
          Zakres roboty
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


      {/* NOTATKI */}

      <div className="detail-card notes-card">

        <div className="notes-header">

          <div>
            <div className="small-label">
              ZADANIA
            </div>
            <h2>
              Zadania na tej robocie
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

          {(editedJob.notes || []).map(
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

                  <div className="note-created-at">
                    Dodano: {note.createdAt
                      ? formatCreatedAt(note.createdAt)
                      : `${formatDate(note.date || '')}${note.time ? ` • ${note.time}` : ''}`
                    }
                  </div>

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
                      onClick={() => removeNote(note.id)}
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
          {nextStage === 'Faktura wystawiona' && '▣ Oznacz: faktura wystawiona'}
          {nextStage === 'Zakończone' && '✓ Oznacz jako zapłacone'}
        </button>
      )}

      {!editing && normalizeJobStage(editedJob) !== 'Planowane' && (
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
          🗑 Usuń robotę

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
  settings,
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

    loadFinance()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
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
  }, [])


  const [allJobPayments, setAllJobPayments] = useState([])
  const [partnerSettlements, setPartnerSettlements] = useState([])
  const [partnerTransfers, setPartnerTransfers] = useState([])
  const [settlementForm, setSettlementForm] = useState({
    lukaszPaid: '',
    pawelPaid: '',
    note: '',
  })
  const [transferForm, setTransferForm] = useState({
    fromPerson: 'Paweł',
    toPerson: 'Łukasz',
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
  }, [])

  const [showForm, setShowForm] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const [editingCostId, setEditingCostId] = useState(null)

  const [editCost, setEditCost] = useState({
    category: 'ZUS',
    amount: '',
    paidBy: 'Łukasz',
    description: '',
    date: getTodayString(),
  })

  const [newCost, setNewCost] = useState({
    category: 'ZUS',
    amount: '',
    paidBy: 'Łukasz',
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
  const share = profit / 2

  // Roczne podsumowanie dla aktualnie wybranego roku.
  const yearPrefix = `${selectedYear}-`

  const completedJobsThisYear = jobs.filter(
    (job) =>
      job.completed === true &&
      job.completedAt &&
      job.completedAt.startsWith(yearPrefix)
  )

  const yearRevenue = completedJobsThisYear.reduce(
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

  const lukaszCosts = monthCosts
    .filter((cost) => cost.paidBy === 'Łukasz')
    .reduce((sum, cost) => sum + Number(cost.amount || 0), 0)

  const pawelCosts = monthCosts
    .filter((cost) => cost.paidBy === 'Paweł')
    .reduce((sum, cost) => sum + Number(cost.amount || 0), 0)

  const lukaszBalance = lukaszCosts - totalCosts / 2
  const pawelBalance = pawelCosts - totalCosts / 2

  let settlementText = 'Koszty są rozliczone po równo.'
  let settlementAmount = 0

  if (lukaszBalance > 0.01) {
    settlementText = 'Paweł oddaje Łukaszowi'
    settlementAmount = lukaszBalance
  } else if (pawelBalance > 0.01) {
    settlementText = 'Łukasz oddaje Pawłowi'
    settlementAmount = pawelBalance
  }


  const selectedSettlement = partnerSettlements.find(
    (item) => item.month === `${selectedMonthKey}-01`
  ) || null

  const priorSettlements = partnerSettlements.filter(
    (item) => item.month < `${selectedMonthKey}-01`
  )

  const previousSettlementBalance = priorSettlements.reduce(
    (sum, item) =>
      sum + (Number(item.lukaszPaid || 0) - Number(item.pawelPaid || 0)) / 2,
    0
  )

  const previousTransfersBalance = partnerTransfers
    .filter((item) => item.transferDate && item.transferDate < `${selectedMonthKey}-01`)
    .reduce(
      (sum, item) => {
        const amount = Number(item.amount || 0)
        if (item.fromPerson === 'Łukasz' && item.toPerson === 'Paweł') return sum - amount
        if (item.fromPerson === 'Paweł' && item.toPerson === 'Łukasz') return sum + amount
        return sum
      },
      0
    )

  const previousCarryoverBalance =
    previousSettlementBalance + previousTransfersBalance

  const currentLukaszPaid = selectedSettlement
    ? Number(selectedSettlement.lukaszPaid || 0)
    : parseDecimal(settlementForm.lukaszPaid)

  const currentPawelPaid = selectedSettlement
    ? Number(selectedSettlement.pawelPaid || 0)
    : parseDecimal(settlementForm.pawelPaid)

  const currentSettlementBalance =
    (currentLukaszPaid - currentPawelPaid) / 2

  const totalSettlementBalance =
    previousCarryoverBalance + currentSettlementBalance

  const settlementDirection =
    totalSettlementBalance > 0.01
      ? 'Paweł powinien oddać Łukaszowi'
      : totalSettlementBalance < -0.01
        ? 'Łukasz powinien oddać Pawłowi'
        : 'Brak wzajemnego zadłużenia'

  const saveCurrentSettlement = async (closeMonth = false) => {
    if (selectedSettlement?.closed && closeMonth) {
      showCustomAlert('Ten miesiąc jest już zamknięty.')
      return
    }

    const lukaszPaid = parseDecimal(
      selectedSettlement ? selectedSettlement.lukaszPaid : settlementForm.lukaszPaid
    )
    const pawelPaid = parseDecimal(
      selectedSettlement ? selectedSettlement.pawelPaid : settlementForm.pawelPaid
    )

    if (lukaszPaid < 0 || pawelPaid < 0) {
      showCustomAlert('Kwoty wypłat nie mogą być ujemne.')
      return
    }

    if (lukaszPaid + pawelPaid > profit + 0.01) {
      showCustomAlert('Łączne wypłaty wspólników nie mogą przekroczyć zysku miesiąca.')
      return
    }

    try {
      setSettlementSaving(true)
      const saved = await savePartnerSettlement({
        month: `${selectedMonthKey}-01`,
        profit,
        lukaszShare: share,
        pawelShare: share,
        lukaszPaid,
        pawelPaid,
        closed: closeMonth,
        note: settlementForm.note,
      })

      setPartnerSettlements((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) => item.id === saved.id ? saved : item)
          : [...current, saved]
      )

      setSettlementForm((current) => ({
        ...current,
        lukaszPaid: String(saved.lukaszPaid),
        pawelPaid: String(saved.pawelPaid),
      }))

      if (closeMonth) {
        showCustomAlert('Miesiąc został zamknięty i rozliczenie zapisane.')
      }
    } catch (error) {
      console.error('Nie udało się zapisać rozliczenia wspólników:', error)
      showCustomAlert('Nie udało się zapisać rozliczenia wspólników.')
    } finally {
      setSettlementSaving(false)
    }
  }

  const addPartnerTransfer = async () => {
    const amount = parseDecimal(transferForm.amount)
    if (!amount || amount <= 0) {
      showCustomAlert('Podaj kwotę przekazania.')
      return
    }

    try {
      setSettlementSaving(true)
      const saved = await createPartnerTransfer({
        settlementId: selectedSettlement?.id || null,
        transferDate: getTodayString(),
        fromPerson: transferForm.fromPerson,
        toPerson: transferForm.toPerson,
        amount,
        note: transferForm.note,
      })
      setPartnerTransfers((current) => [...current, saved])
      setTransferForm((current) => ({ ...current, amount: '', note: '' }))
    } catch (error) {
      console.error('Nie udało się zapisać przekazania wspólnika:', error)
      showCustomAlert('Nie udało się zapisać przekazania.')
    } finally {
      setSettlementSaving(false)
    }
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
      paidBy: 'Łukasz',
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
      paidBy: cost.paidBy || 'Łukasz',
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
      paidBy: 'Łukasz',
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

      <div className="page-heading">
        <div>
          <div className="small-label">MOJA FIRMA</div>
          <h1>Finanse</h1>
        </div>
      </div>

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

      <div
        className="finance-summary"
        style={{
          marginBottom: '14px',
        }}
      >
        <div>
          <span>Przychód</span>
          <strong>{formatMoney(revenue)}</strong>
          <small>
            {completedJobsThisMonth.length === 0
              ? 'Brak zakończonych robót'
              : `${completedJobsThisMonth.length} zakończonych robót`}
          </small>
        </div>

        <div>
          <span>Koszty</span>
          <strong>{formatMoney(totalCosts)}</strong>
          <small>{monthCosts.length} wpisów</small>
        </div>

        <div>
          <span>Zysk</span>
          <strong>{formatMoney(profit)}</strong>
          <small>Po kosztach</small>
        </div>
      </div>

      <div className="detail-card" style={{ marginBottom: '14px' }}>
        <div className="finance-cost-header">
          <div>
            <h2 style={{ marginBottom: '4px' }}>Rozliczenie</h2>
            <span>Podział kosztów po 50%</span>
          </div>
        </div>

        <div className="cost-person-summary">
          <div>
            <span>Łukasz zapłacił</span>
            <strong>{formatMoney(lukaszCosts)}</strong>
          </div>
          <div>
            <span>Paweł zapłacił</span>
            <strong>{formatMoney(pawelCosts)}</strong>
          </div>
        </div>

        <div className="settlement-card" style={{ marginTop: '12px' }}>
          <div className="settlement-icon">⚖️</div>
          <div style={{ minWidth: 0 }}>
            <span>{settlementText}</span>
            {settlementAmount > 0 ? (
              <div className="settlement-amount">
                {formatMoney(settlementAmount)}
              </div>
            ) : (
              <strong style={{ display: 'block', marginTop: '4px' }}>
                0 zł
              </strong>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: '14px',
            paddingTop: '14px',
            borderTop: '1px solid #e2e7ee',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span>Połowa zysku</span>
          <strong>{formatMoney(share)}</strong>
        </div>
      </div>


      <div className="detail-card" style={{ marginBottom: '14px' }}>
        <div className="finance-cost-header">
          <div>
            <h2 style={{ marginBottom: '4px' }}>Rozliczenie wspólników</h2>
            <span>Faktyczne wypłaty zysku 50/50 i saldo przenoszone dalej</span>
          </div>
          {selectedSettlement?.closed && (
            <span style={{
              padding: '6px 9px',
              borderRadius: '999px',
              background: '#e7f8ee',
              color: '#15803d',
              fontSize: '12px',
              fontWeight: 800,
            }}>
              Zamknięty
            </span>
          )}
        </div>

        <div className="cost-person-summary">
          <div>
            <span>Zysk do podziału</span>
            <strong>{formatMoney(profit)}</strong>
          </div>
          <div>
            <span>Po 50% na osobę</span>
            <strong>{formatMoney(share)}</strong>
          </div>
        </div>

        <div className="cost-person-summary" style={{ marginTop: '8px' }}>
          <div>
            <span>Łukasz faktycznie otrzymał</span>
            <strong>{formatMoney(currentLukaszPaid)}</strong>
          </div>
          <div>
            <span>Paweł faktycznie otrzymał</span>
            <strong>{formatMoney(currentPawelPaid)}</strong>
          </div>
        </div>

        <div style={{
          marginTop: '12px',
          padding: '13px',
          borderRadius: '14px',
          background: totalSettlementBalance > 0.01
            ? '#fff4e5'
            : totalSettlementBalance < -0.01
              ? '#eaf5ff'
              : '#e7f8ee',
        }}>
          <span style={{ display: 'block', color: '#66758f', fontSize: '12px' }}>
            Saldo po uwzględnieniu poprzednich miesięcy
          </span>
          <strong style={{ display: 'block', marginTop: '4px', color: '#24345c' }}>
            {settlementDirection}
          </strong>
          <strong style={{ display: 'block', marginTop: '3px', fontSize: '19px' }}>
            {formatMoney(Math.abs(totalSettlementBalance))}
          </strong>
          {Math.abs(previousCarryoverBalance) > 0.01 && (
            <span style={{ display: 'block', marginTop: '4px', color: '#66758f', fontSize: '12px' }}>
              Przeniesione z poprzednich miesięcy: {formatMoney(Math.abs(previousCarryoverBalance))}
            </span>
          )}
        </div>

        {!selectedSettlement?.closed && (
          <>
            <div style={{
              marginTop: '14px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
            }}>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>
                  Wypłata dla Łukasza
                </span>
                <input
                  className="rate-input"
                  type="text"
                  inputMode="decimal"
                  value={settlementForm.lukaszPaid}
                  onChange={(e) => setSettlementForm({ ...settlementForm, lukaszPaid: e.target.value })}
                  placeholder="0"
                  disabled={settlementSaving}
                />
              </label>
              <label>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>
                  Wypłata dla Pawła
                </span>
                <input
                  className="rate-input"
                  type="text"
                  inputMode="decimal"
                  value={settlementForm.pawelPaid}
                  onChange={(e) => setSettlementForm({ ...settlementForm, pawelPaid: e.target.value })}
                  placeholder="0"
                  disabled={settlementSaving}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>
                  Notatka
                </span>
                <input
                  className="rate-input"
                  type="text"
                  value={settlementForm.note}
                  onChange={(e) => setSettlementForm({ ...settlementForm, note: e.target.value })}
                  placeholder="np. wypłacone gotówką"
                  disabled={settlementSaving}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                className="save-button"
                onClick={() => saveCurrentSettlement(false)}
                disabled={settlementSaving}
              >
                Zapisz rozliczenie
              </button>
              <button
                type="button"
                className="save-button"
                onClick={() => saveCurrentSettlement(true)}
                disabled={settlementSaving}
              >
                Zamknij miesiąc
              </button>
            </div>
          </>
        )}

        <div style={{
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid #e5ebf0',
        }}>
          <strong style={{ display: 'block', color: '#24345c', marginBottom: '8px' }}>
            Oddanie pieniędzy między wspólnikami
          </strong>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
          }}>
            <label>
              <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>Od</span>
              <select
                className="rate-input"
                value={transferForm.fromPerson}
                onChange={(e) => setTransferForm({ ...transferForm, fromPerson: e.target.value })}
                disabled={settlementSaving}
              >
                <option>Łukasz</option>
                <option>Paweł</option>
              </select>
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>Do</span>
              <select
                className="rate-input"
                value={transferForm.toPerson}
                onChange={(e) => setTransferForm({ ...transferForm, toPerson: e.target.value })}
                disabled={settlementSaving}
              >
                <option>Łukasz</option>
                <option>Paweł</option>
              </select>
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>Kwota</span>
              <input
                className="rate-input"
                type="text"
                inputMode="decimal"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                placeholder="0"
                disabled={settlementSaving}
              />
            </label>
            <label>
              <span style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: '#66758f' }}>Opis</span>
              <input
                className="rate-input"
                type="text"
                value={transferForm.note}
                onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                placeholder="np. przelew"
                disabled={settlementSaving}
              />
            </label>
          </div>

          <button
            type="button"
            className="save-button"
            onClick={addPartnerTransfer}
            disabled={settlementSaving}
            style={{ marginTop: '10px' }}
          >
            + Zapisz przekazanie
          </button>

          {partnerTransfers.filter((item) => item.settlementId === selectedSettlement?.id).length > 0 && (
            <div style={{ marginTop: '10px' }}>
              {partnerTransfers
                .filter((item) => item.settlementId === selectedSettlement?.id)
                .map((item) => (
                  <div key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '9px 0',
                    borderTop: '1px solid #eef2f5',
                  }}>
                    <span style={{ fontSize: '13px', color: '#66758f' }}>
                      {item.fromPerson} → {item.toPerson}
                    </span>
                    <strong>{formatMoney(item.amount)}</strong>
                    <button
                      type="button"
                      className="document-remove"
                      onClick={async () => {
                        try {
                          await deletePartnerTransfer(item.id)
                          setPartnerTransfers((current) => current.filter((row) => row.id !== item.id))
                        } catch (error) {
                          console.error(error)
                          showCustomAlert('Nie udało się usunąć przekazania.')
                        }
                      }}
                      style={{ padding: '6px 8px', fontSize: '11px' }}
                    >
                      Usuń
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

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
                  <option value="Łukasz">Łukasz</option>
                  <option value="Paweł">Paweł</option>
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
                  <option value="Łukasz">Łukasz</option>
                  <option value="Paweł">Paweł</option>
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
            <h2 style={{ marginBottom: '4px' }}>Zakończone roboty</h2>
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
            <span>Cały wybrany rok</span>
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
            <span>Przychód</span>
            <strong>{formatMoney(yearRevenue)}</strong>
            <small>{completedJobsThisYear.length} zakończonych robót</small>
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
}) {

  const [editingRates, setEditingRates] = useState(false)

  const users = {
    first: 'Łukasz',
    second: 'Paweł',
    active: settings.users?.active || 'Łukasz',
  }

  const currentRates = settings.rates || {
    mb: 100,
    m2: 220,
    kg: 0,
  }

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
    setDraftRates({ ...settings.rates })
    setEditingRates(false)
  }

  const company = settings.company || {
    name: 'AEROINSTAL ŁUKASZ DYSZKANT',
    nip: '5833105866',
    regon: '385589939',
    address: 'ul. Cicha 4A/9, 83-000 Pruszcz Gdański',
    email: 'Aeroinstal@wp.pl',
  }

  const [showCompany, setShowCompany] = useState(false)
  const [editingCompany, setEditingCompany] = useState(false)
  const [draftCompany, setDraftCompany] = useState({ ...company })

  const openCompanyEdit = () => {
    setDraftCompany({ ...company })
    setEditingCompany(true)
  }

  const saveCompany = () => {
    if (!draftCompany.name.trim()) {
      showCustomAlert('Podaj nazwę firmy.')
      return
    }

    setSettings({
      ...settings,
      company: {
        name: draftCompany.name.trim(),
        nip: draftCompany.nip.trim(),
        regon: draftCompany.regon.trim(),
        address: draftCompany.address.trim(),
        email: draftCompany.email.trim(),
      },
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
      const [remoteJobs, remoteFinance, remoteJobPayments, remotePartnerSettlements, remotePartnerTransfers] = await Promise.all([
        getJobs(),
        getFinance(),
        getAllJobPayments(),
        getPartnerSettlements(),
        getPartnerTransfers(),
      ])

      const backup = {
        app: 'Aeroinstal',
        backupVersion: 2,
        createdAt: new Date().toISOString(),
        settings,
        jobs: Array.isArray(remoteJobs) ? remoteJobs : [],
        finance: Array.isArray(remoteFinance) ? remoteFinance : [],
        generalReminders: Array.isArray(generalReminders) ? generalReminders : [],
        jobPayments: Array.isArray(remoteJobPayments) ? remoteJobPayments : [],
        partnerSettlements: Array.isArray(remotePartnerSettlements) ? remotePartnerSettlements : [],
        partnerTransfers: Array.isArray(remotePartnerTransfers) ? remotePartnerTransfers : [],
        note: 'Kopia zawiera dane aplikacji, płatności i rozliczenia wspólników. Zdjęcia i dokumenty pozostają w Supabase Storage.',
      }

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: 'application/json;charset=utf-8' }
      )

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)

      link.href = url
      link.download = `aeroinstal-backup-${date}.json`
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
        backup.app !== 'Aeroinstal' ||
        ![1, 2].includes(backup.backupVersion) ||
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
        deleted_at: null,
      }))

      if (jobsRows.length > 0) {
        const { error: jobsError } = await supabase
          .from('jobs')
          .upsert(jobsRows, { onConflict: 'id' })

        if (jobsError) {
          throw jobsError
        }
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

      localStorage.setItem(
        'aeroinstal_settings',
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
      <div className="page-heading">
        <div>
          <div className="small-label">MOJA FIRMA</div>
          <h1>Ustawienia</h1>
        </div>
      </div>

      <div className="settings-list">
        <div className="settings-item settings-item-locked">
          <div>
            <span>👤 Użytkownicy</span>
            <div className="settings-locked-info">
              <strong>{users.first}</strong> / <strong>{users.second}</strong>
            </div>
            <div className="settings-locked-note">
              Ten telefon: <strong>{users.active}</strong>
            </div>
          </div>
          <span className="settings-lock-icon">📱</span>
        </div>

        <div
          className="settings-item"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowCompany(!showCompany)}
        >
          <div>
            <span>🏢 Firma</span>
            {!showCompany && (
              <div style={{ marginTop: '5px', fontSize: '13px', opacity: 0.7 }}>
                {company.name}
              </div>
            )}
          </div>
          <span>{showCompany ? '⌄' : '›'}</span>
        </div>

        {showCompany && (
          <div className="detail-card">
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
                  ['name', 'Nazwa firmy'],
                  ['nip', 'NIP'],
                  ['regon', 'REGON'],
                  ['address', 'Adres'],
                  ['email', 'E-mail'],
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

                <div
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
                <div><strong>{company.name}</strong></div>
                <div>NIP: {company.nip || '—'}</div>
                <div>REGON: {company.regon || '—'}</div>
                <div>{company.address || '—'}</div>
                <div>E-mail: {company.email || '—'}</div>
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
              Te stawki będą automatycznie podpowiadane przy dodawaniu nowej roboty.
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
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
          <div className="detail-card">
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
          <div className="detail-card">
            <h2>Kopia zapasowa</h2>

            <div style={{ fontSize: '13px', opacity: 0.7, lineHeight: 1.6 }}>
              Kopia zapisuje ustawienia, roboty, finanse oraz informacje o zdjęciach
              i dokumentach. Same pliki pozostają bezpiecznie w Supabase Storage.
            </div>

            <div
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

        label="Roboty"

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
