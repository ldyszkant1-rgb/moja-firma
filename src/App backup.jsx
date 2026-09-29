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
} from './lib/jobsApi'
import {
  getFinance,
  createFinance,
  updateFinance,
  deleteFinance,
  subscribeToFinance,
} from './lib/financeApi'
import { supabase } from './lib/supabase'


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
   APP
   ===================================================== */

function App() {

  const [activePage, setActivePage] =
    useState('start')


  const [selectedJob, setSelectedJob] =
    useState(null)


  const [addingJob, setAddingJob] =
    useState(false)


  const [settings, setSettings] =
    useState(() => {

      try {
        const savedSettings = localStorage.getItem(
          'aeroinstal_settings'
        )
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings)
          return {
            users: parsed.users || {
              first: 'Łukasz',
              second: 'Paweł',
              active: 'Łukasz',
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
          active: 'Łukasz',
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

        completed:
          typeof row.completed === 'boolean'
            ? row.completed
            : (
                row.status === 'Zakończone'
                  ? true
                  : (
                      existingJob?.completed ||
                      false
                    )
              ),

        completedAt:
          row.completed_at ??
          row.completedAt ??
          existingJob?.completedAt ??
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

      alert(
        'Robota została zmieniona lokalnie, ale nie udało się zapisać zmiany w Supabase.'
      )

    }

  }


  const deleteJob = async (jobToDelete) => {

    if (!jobToDelete?.id) {
      return
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć robotę „${jobToDelete.name || ''}”?\\n\\nTej operacji nie będzie można cofnąć.`
    )

    if (!confirmed) {
      return
    }

    /*
     * Stare roboty startowe (K6, K8, K10, K12)
     * mają numeryczne ID i nie są zapisane w Supabase.
     * Usuwamy je więc tylko lokalnie.
     */
    const isLocalSeedJob =
      typeof jobToDelete.id === 'number'

    if (isLocalSeedJob) {

      setJobs(
        (currentJobs) =>
          currentJobs.filter(
            (job) =>
              String(job.id) !==
              String(jobToDelete.id)
          )
      )

      setSelectedJob(null)

      console.log(
        'Lokalna robota startowa została usunięta:',
        jobToDelete.name
      )

      return
    }

    try {

      const filesToDelete = []

      if (jobToDelete.mainPhoto?.path) {
        filesToDelete.push(
          jobToDelete.mainPhoto.path
        )
      }

      if (jobToDelete.documents?.material?.path) {
        filesToDelete.push(
          jobToDelete.documents.material.path
        )
      }

      if (jobToDelete.documents?.assembly?.path) {
        filesToDelete.push(
          jobToDelete.documents.assembly.path
        )
      }

      for (const photo of jobToDelete.photos || []) {

        if (photo?.path) {
          filesToDelete.push(
            photo.path
          )
        }

      }

      for (const path of filesToDelete) {

        try {

          await deleteSupabaseFile(
            path
          )

        } catch (fileError) {

          console.error(
            'Nie udało się usunąć pliku ze Storage:',
            path,
            fileError
          )

        }

      }

      const { error } =
        await supabase
          .from('jobs')
          .delete()
          .eq(
            'id',
            jobToDelete.id
          )

      if (error) {
        throw error
      }

      setJobs(
        (currentJobs) =>
          currentJobs.filter(
            (job) =>
              String(job.id) !==
              String(jobToDelete.id)
          )
      )

      setSelectedJob(null)

      console.log(
        'Robota została usunięta z Supabase:',
        jobToDelete.name
      )

    } catch (error) {

      console.error(
        'Nie udało się usunąć roboty z Supabase:',
        error
      )

      alert(
        'Nie udało się usunąć roboty z Supabase. Robota nie została usunięta z aplikacji.'
      )

    }

  }

  const createJob = async () => {

    if (
      !newJob.name.trim()
    ) {

      alert(
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

      progress: 0,

      completed: false,

      completedAt: null,

      quantities: {

        mb:
          Number(
            newJob.quantities.mb
          ) || 0,

        m2:
          Number(
            newJob.quantities.m2
          ) || 0,

        kg:
          Number(
            newJob.quantities.kg
          ) || 0,

      },

      rates: {

        mb:
          Number(
            newJob.rates.mb
          ) || 0,

        m2:
          Number(
            newJob.rates.m2
          ) || 0,

        kg:
          Number(
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

      alert(
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


  if (selectedJob) {

    return (

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

    )

  }


  if (addingJob) {

    return (

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

            onAddJob={() =>
              setAddingJob(true)
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
}) {

  const activeJobs =
    jobs.filter((job) => !job.completed)

  const completedJobs =
    jobs.filter((job) => job.completed)

  const averageProgress =
    activeJobs.length > 0
      ? Math.round(
          activeJobs.reduce(
            (sum, job) => sum + Number(job.progress || 0),
            0
          ) / activeJobs.length
        )
      : 0

  const totalValue =
    jobs.reduce(
      (sum, job) => sum + calculateTotal(job),
      0
    )

  const activeValue =
    activeJobs.reduce(
      (sum, job) => sum + calculateTotal(job),
      0
    )

  const completedValue =
    completedJobs.reduce(
      (sum, job) => sum + calculateTotal(job),
      0
    )

  const allNotes =
    jobs.flatMap((job) =>
      (job.notes || []).map((note) => ({
        ...note,
        jobId: job.id,
        jobName: job.name,
      }))
    )

  const pendingNotes =
    allNotes.filter((note) => !note.done)

  const today = getTodayString()

  const overdueNotes =
    pendingNotes.filter(
      (note) => note.date && note.date < today
    )

  const latestNotes =
    [...pendingNotes]
      .sort((a, b) => {
        const aDate = a.date || '9999-12-31'
        const bDate = b.date || '9999-12-31'
        return aDate.localeCompare(bDate)
      })
      .slice(0, 4)

  const progressJobs =
    [...activeJobs]
      .sort(
        (a, b) =>
          Number(b.progress || 0) -
          Number(a.progress || 0)
      )
      .slice(0, 5)

  const recentCompleted =
    [...completedJobs]
      .sort((a, b) => {
        const aDate = a.completedAt || ''
        const bDate = b.completedAt || ''
        return bDate.localeCompare(aDate)
      })
      .slice(0, 3)

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
          <div className="dashboard-value-icon">
            💰
          </div>
          <div>
            <span>
              Łączna wartość robót
            </span>
            <strong>
              {formatMoney(totalValue)}
            </strong>
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
            <span style={{ opacity: 0.7 }}>
              W toku
            </span>
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
            <span style={{ opacity: 0.7 }}>
              Zakończone
            </span>
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
          <h2>Aktywne roboty</h2>
          <button
            className="section-link"
            onClick={onJobs}
          >
            Wszystkie
          </button>
        </div>

        <div className="jobs">
          {activeJobs.length === 0 && (
            <div className="detail-card">
              Brak aktywnych robót.
            </div>
          )}

          {progressJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onClick={() => onOpenJob(job)}
            />
          ))}

          {activeJobs.length > 5 && (
            <button
              className="section-link"
              onClick={onJobs}
              style={{
                alignSelf: 'center',
                padding: '8px 0',
              }}
            >
              Pokaż wszystkie aktywne ({activeJobs.length})
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="section-title">
          <h2>Do zrobienia</h2>

          {pendingNotes.length > 0 && (
            <span
              style={{
                fontSize: '13px',
                opacity: 0.7,
              }}
            >
              {pendingNotes.length} notatek
            </span>
          )}
        </div>

        {overdueNotes.length > 0 && (
          <div
            className="detail-card"
            style={{
              marginBottom: '10px',
              borderLeft: '4px solid #d9534f',
            }}
          >
            <strong>
              ⚠️ Zaległe: {overdueNotes.length}
            </strong>
          </div>
        )}

        <div className="notes-dashboard">
          {latestNotes.length === 0 && (
            <div className="dashboard-note">
              <div>
                <strong>
                  Brak aktywnych notatek
                </strong>
              </div>
            </div>
          )}

          {latestNotes.map((note, index) => (
            <button
              className="dashboard-note"
              key={`${note.jobId}-${index}`}
              onClick={() => {
                const job = jobs.find(
                  (item) => item.id === note.jobId
                )
                if (job) onOpenJob(job)
              }}
              style={{
                width: '100%',
                border: '0',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div className="dashboard-note-icon">
                {note.date && note.date < today ? '⚠️' : '📝'}
              </div>

              <div>
                <strong>
                  {note.text}
                </strong>

                <span>
                  {note.jobName}
                  {note.date
                    ? ` • ${formatDate(note.date)}`
                    : ''
                  }
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title">
          <h2>Ostatnio zakończone</h2>
          <button
            className="section-link"
            onClick={onJobs}
          >
            Roboty
          </button>
        </div>

        <div className="jobs">
          {recentCompleted.length === 0 && (
            <div className="detail-card">
              Brak zakończonych robót.
            </div>
          )}

          {recentCompleted.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onClick={() => onOpenJob(job)}
            />
          ))}

          {completedJobs.length > 3 && (
            <button
              className="section-link"
              onClick={onJobs}
              style={{
                alignSelf: 'center',
                padding: '8px 0',
              }}
            >
              Pokaż wszystkie zakończone ({completedJobs.length})
            </button>
          )}
        </div>
      </section>
    </>
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


/* =====================================================
   JOB CARD
   ===================================================== */

function JobCard({
  job,
  onClick,
}) {

  return (

    <button

      className="job-card"

      onClick={
        onClick
      }

      style={{
        textAlign: 'left',
        cursor: 'pointer',
      }}

    >

      <div className="job-header">

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: 0,
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
                fontSize: '25px',
              }}
              title="Brak zdjęcia głównego"
            >
              📷
            </div>

          )}

          <div style={{ minWidth: 0 }}>

          <h3>
            {job.name}
          </h3>

          <span>
            {job.location}
          </span>

          </div>

        </div>


        <span
          className={
            job.completed
              ? 'status completed'
              : 'status'
          }
        >

          {job.completed
            ? 'Zakończona'
            : 'W toku'
          }

        </span>

      </div>


      <div className="progress-section">

        <div className="progress-label">

          <span>
            Postęp
          </span>

          <strong>
            {job.progress}%
          </strong>

        </div>


        <div className="progress-bar">

          <div

            className="progress-fill"

            style={{
              width: `${job.progress}%`,
            }}

          />

        </div>

      </div>


      <div className="quantities">

        <div>

          <span>
            MB
          </span>

          <strong>
            {job.quantities?.mb || 0}
          </strong>

        </div>


        <div>

          <span>
            m²
          </span>

          <strong>
            {job.quantities?.m2 || 0}
          </strong>

        </div>


        <div>

          <span>
            kg
          </span>

          <strong>
            {job.quantities?.kg || 0}
          </strong>

        </div>

      </div>


      <div className="job-footer">

        <span>
          Wartość
        </span>

        <strong>
          {formatMoney(
            calculateTotal(job)
          )}
        </strong>

      </div>

    </button>

  )

}


/* =====================================================
   ROBOTY
   ===================================================== */

function JobsPage({
  jobs,
  onOpenJob,
  onAddJob,
}) {

  const [filter, setFilter] =
    useState('all')

  useEffect(() => {
    const handleDashboardTab = (event) => {
      const requestedTab = event.detail

      if (
        requestedTab === 'all' ||
        requestedTab === 'active' ||
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

        if (
          filter === 'active'
        )
          return !job.completed

        if (
          filter === 'completed'
        )
          return job.completed

        return true

      }
    )


  return (

    <div className="sub-page">

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

          className="edit-button"

          onClick={
            onAddJob
          }

        >
          + Nowa robota
        </button>

      </div>


      <div
        className="job-filters"
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >

        <button
          className={
            filter === 'all'
              ? 'edit-button active'
              : 'edit-button'
          }
          onClick={() =>
            setFilter('all')
          }
        >
          Wszystkie
        </button>


        <button
          className={
            filter === 'active'
              ? 'edit-button active'
              : 'edit-button'
          }
          onClick={() =>
            setFilter('active')
          }
        >
          W toku
        </button>


        <button
          className={
            filter === 'completed'
              ? 'edit-button active'
              : 'edit-button'
          }
          onClick={() =>
            setFilter('completed')
          }
        >
          Zakończone
        </button>

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

              key={
                job.id
              }

              job={
                job
              }

              onClick={() =>
                onOpenJob(job)
              }

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


  const saveChanges = () => {

    if (!editedJob.name.trim()) {

      alert(
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
          Number(
            editedJob.quantities.mb
          ) || 0,

        m2:
          Number(
            editedJob.quantities.m2
          ) || 0,

        kg:
          Number(
            editedJob.quantities.kg
          ) || 0,

      },

      rates: {

        mb:
          Number(
            editedJob.rates.mb
          ) || 0,

        m2:
          Number(
            editedJob.rates.m2
          ) || 0,

        kg:
          Number(
            editedJob.rates.kg
          ) || 0,

      },

      completed:
        editedJob.completed,

      completedAt:
        editedJob.completed
          ? editedJob.completedAt
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


  const finishJob = () => {

    const today =
      getTodayString()


    const updatedJob = {

      ...editedJob,

      completed:
        true,

      progress:
        100,

      completedAt:
        today,

    }


    onUpdate(
      updatedJob
    )

    setEditedJob(
      updatedJob
    )

  }


  const restoreJob = () => {

    const updatedJob = {

      ...editedJob,

      completed:
        false,

      completedAt:
        null,

    }


    onUpdate(
      updatedJob
    )

    setEditedJob(
      updatedJob
    )

  }


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

      alert(
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

      alert(
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
      window.prompt(
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

      alert(
        'Nie udało się wysłać zdjęcia głównego do Supabase. Spróbuj ponownie.'
      )

    }

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

      alert(
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

      alert(
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
      window.prompt(
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

      alert(
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


  const saveNote = () => {

    if (
      !newNote.text.trim()
    )
      return


    const note = {

      id:
        Date.now(),

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


    const updatedJob = {

      ...editedJob,

      notes: [

        ...(editedJob.notes || []),

        note,

      ],

    }


    setEditedJob(
      updatedJob
    )

    onUpdate(
      updatedJob
    )

    setShowNoteForm(
      false
    )

    setNewNote({

      text: '',

      reminderEnabled: false,

      date: '',

      time: '',

    })

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


  const saveEditedNote = (
    noteId
  ) => {

    if (
      !editingNoteText.trim()
    )
      return


    const updatedJob = {

      ...editedJob,

      notes:
        (editedJob.notes || [])
          .map(
            (note) =>
              String(note.id) === String(noteId)
                ? {
                    ...note,
                    text:
                      editingNoteText.trim(),
                  }
                : note
          ),

    }


    setEditedJob(
      updatedJob
    )

    onUpdate(
      updatedJob
    )

    cancelEditNote()

  }

  const toggleNoteReminder = (
    noteId
  ) => {

    const updatedJob = {

      ...editedJob,

      notes:
        (editedJob.notes || [])
          .map(
            (note) => {

              if (
                String(note.id) !== String(noteId)
              ) {
                return note
              }

              const enabled =
                !Boolean(note.reminderEnabled)

              return {
                ...note,
                reminderEnabled: enabled,
                date: enabled
                  ? (note.date || getTodayString())
                  : '',
                time: enabled
                  ? (note.time || '')
                  : '',
              }

            }
          ),

    }


    setEditedJob(
      updatedJob
    )

    onUpdate(
      updatedJob
    )

  }


  const updateNoteReminder = (
    noteId,
    field,
    value
  ) => {

    const updatedJob = {

      ...editedJob,

      notes:
        (editedJob.notes || [])
          .map(
            (note) =>
              String(note.id) === String(noteId)
                ? {
                    ...note,
                    reminderEnabled: true,
                    [field]: value,
                  }
                : note
          ),

    }


    setEditedJob(
      updatedJob
    )

    onUpdate(
      updatedJob
    )

  }


  const toggleNote = (
    noteId
  ) => {

    const updatedJob = {

      ...editedJob,

      notes:
        (editedJob.notes || [])
          .map(
            (note) =>
              String(note.id) === String(noteId)
                ? {
                    ...note,
                    done:
                      !note.done,
                  }
                : note
          ),

    }


    setEditedJob(
      updatedJob
    )

    onUpdate(
      updatedJob
    )

  }

  const removeNote = (
    noteId
  ) => {

    const updatedJob = {

      ...editedJob,

      notes:
        (editedJob.notes || [])
          .filter(
            (note) =>
              String(note.id) !== String(noteId)
          ),

    }


    setEditedJob(
      updatedJob
    )

    onUpdate(
      updatedJob
    )

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

            className="note-text-input"

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

            className="note-text-input"

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


      {/* ZDJĘCIE GŁÓWNE */}

      <div className="detail-card">

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
              Notatki
            </h2>
          </div>

          {!showNoteForm && (

            <button
              type="button"
              className="document-button note-add-button"
              onClick={addNote}
            >
              + Dodaj notatkę
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
                Zapisz notatkę
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


      {!editing && !editedJob.completed && (

        <button

          className="finish-button"

          onClick={
            finishJob
          }

        >
          ✓ Zakończ robotę
        </button>

      )}


      {!editing && editedJob.completed && (

        <button

          className="restore-button"

          onClick={
            restoreJob
          }

        >
          ↩ Przywróć do aktywnych
        </button>

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

    <div className="finance-row">

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

  const revenue = completedJobsThisMonth.reduce(
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

  const addCost = async () => {
    const amount = Number(newCost.amount)

    if (!amount || amount <= 0) {
      alert('Podaj prawidłową kwotę.')
      return
    }

    if (!newCost.date) {
      alert('Podaj datę kosztu.')
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
      alert('Nie udało się zapisać kosztu w Supabase. Koszt nie został dodany.')
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
      alert('Nie udało się usunąć kosztu z Supabase.')
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
    const amount = Number(editCost.amount)

    if (!amount || amount <= 0) {
      alert('Podaj prawidłową kwotę.')
      return
    }

    if (!editCost.date) {
      alert('Podaj datę kosztu.')
      return
    }

    const currentCost = costs.find((cost) => cost.id === editingCostId)

    if (!currentCost) {
      alert('Nie znaleziono kosztu do edycji.')
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
      alert('Nie udało się zmienić kosztu w Supabase. Zmiana nie została zapisana.')
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

      <div className="detail-card finance-cost-card">
        <div className="finance-cost-header">
          <div>
            <h2 style={{ marginBottom: '4px' }}>Koszty</h2>
            <span>{monthTitle}</span>
          </div>
          <strong>{formatMoney(totalCosts)}</strong>
        </div>

        {monthCosts.length === 0 && (
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              background: '#f6f8fb',
              marginTop: '12px',
            }}
          >
            Brak kosztów w tym miesiącu.
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginTop: '12px',
          }}
        >
          {monthCosts.map((cost) => (
            <div
              key={cost.id}
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                background: '#f6f8fb',
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
                  <strong>
                    {getCostIcon(cost.category)} {cost.category}
                  </strong>
                  <div
                    style={{
                      marginTop: '4px',
                      color: '#68758a',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {cost.description || 'Bez opisu'}
                  </div>
                  <div
                    style={{
                      marginTop: '4px',
                      color: '#68758a',
                      fontSize: '13px',
                    }}
                  >
                    {cost.paidBy} • {formatDate(cost.month)}
                  </div>
                </div>

                <strong style={{ whiteSpace: 'nowrap' }}>
                  {formatMoney(cost.amount)}
                </strong>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  marginTop: '10px',
                }}
              >
                <button
                  className="restore-button"
                  onClick={() => startEditCost(cost)}
                >
                  Zmień
                </button>
                <button
                  className="cost-delete"
                  onClick={() => removeCost(cost.id)}
                >
                  Usuń
                </button>
              </div>
            </div>
          ))}
        </div>

        {editingCostId && (
          <div className="cost-form" style={{ marginTop: '14px' }}>
            <h3>Zmień koszt</h3>

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

            <label>Kwota</label>
            <input
              type="text"
              inputMode="decimal"
              value={editCost.amount}
              onChange={(e) =>
                setEditCost({ ...editCost, amount: e.target.value })
              }
            />

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

            <label>Opis</label>
            <input
              type="text"
              value={editCost.description}
              onChange={(e) =>
                setEditCost({ ...editCost, description: e.target.value })
              }
            />

            <label>Data</label>
            <input
              type="date"
              value={editCost.date}
              onChange={(e) =>
                setEditCost({ ...editCost, date: e.target.value })
              }
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button className="add-cost-button" onClick={saveEditCost}>
                Zapisz zmianę
              </button>
              <button className="restore-button" onClick={cancelEditCost}>
                Anuluj
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <button
            className="add-cost-button"
            onClick={() => setShowForm(true)}
          >
            + Dodaj koszt
          </button>
        )}

        {showForm && (
          <div className="cost-form">
            <h3>Dodaj koszt</h3>

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

            <label>Kwota</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="np. 2800"
              value={newCost.amount}
              onChange={(e) =>
                setNewCost({ ...newCost, amount: e.target.value })
              }
            />

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

            <label>Opis</label>
            <input
              type="text"
              placeholder="Opis kosztu"
              value={newCost.description}
              onChange={(e) =>
                setNewCost({ ...newCost, description: e.target.value })
              }
            />

            <label>Data</label>
            <input
              type="date"
              value={newCost.date}
              onChange={(e) =>
                setNewCost({ ...newCost, date: e.target.value })
              }
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button className="add-cost-button" onClick={addCost}>
                Zapisz koszt
              </button>
              <button
                className="restore-button"
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

function getCostIcon(
  category
) {

  if (
    category === 'ZUS'
  ) {
    return '🏛️'
  }


  if (
    category === 'Podatek'
  ) {
    return '📄'
  }


  return '💳'

}


/* =====================================================
   USTAWIENIA
   ===================================================== */

function SettingsPage({
  settings,
  setSettings,
}) {

  const [editingUsers, setEditingUsers] = useState(false)
  const [editingRates, setEditingRates] = useState(false)

  const users = settings.users || {
    first: 'Łukasz',
    second: 'Paweł',
    active: 'Łukasz',
  }

  const [draftUsers, setDraftUsers] = useState({
    first: users.first,
    second: users.second,
    active: users.active,
  })

  const openUsers = () => {
    setDraftUsers({ ...users })
    setEditingUsers(true)
  }

  const saveUsers = () => {
    const first = draftUsers.first.trim()
    const second = draftUsers.second.trim()

    if (!first || !second) {
      alert('Podaj imiona obu użytkowników.')
      return
    }

    const active =
      draftUsers.active === first || draftUsers.active === second
        ? draftUsers.active
        : first

    setSettings({
      ...settings,
      users: { first, second, active },
    })

    setEditingUsers(false)
  }

  const cancelUsers = () => {
    setDraftUsers({ ...users })
    setEditingUsers(false)
  }

  const [draftRates, setDraftRates] = useState({
    mb: settings.rates.mb,
    m2: settings.rates.m2,
    kg: settings.rates.kg,
  })

  const openRates = () => {
    setDraftRates({ ...settings.rates })
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
      alert('Stawki muszą być liczbami większymi lub równymi 0.')
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
      alert('Podaj nazwę firmy.')
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
      alert('Musi pozostać przynajmniej jedna aktywna kategoria.')
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
      const [remoteJobs, remoteFinance] = await Promise.all([
        getJobs(),
        getFinance(),
      ])

      const backup = {
        app: 'Aeroinstal',
        backupVersion: 1,
        createdAt: new Date().toISOString(),
        settings,
        jobs: Array.isArray(remoteJobs) ? remoteJobs : [],
        finance: Array.isArray(remoteFinance) ? remoteFinance : [],
        note: 'Kopia zawiera dane aplikacji i metadane plików. Zdjęcia i dokumenty pozostają w Supabase Storage.',
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

      alert('Kopia zapasowa została utworzona.')
    } catch (error) {
      console.error('Nie udało się utworzyć kopii zapasowej:', error)
      alert('Nie udało się utworzyć kopii zapasowej. Sprawdź połączenie z bazą.')
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
        backup.backupVersion !== 1 ||
        !Array.isArray(backup.jobs) ||
        !Array.isArray(backup.finance) ||
        !backup.settings
      ) {
        throw new Error('Nieprawidłowy format kopii.')
      }

      const confirmed = window.confirm(
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
        status: job.status || null,
        progress: Number(job.progress || 0),
        completed: Boolean(job.completed),
        completed_at: job.completedAt || null,
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

      localStorage.setItem(
        'aeroinstal_settings',
        JSON.stringify(backup.settings)
      )

      alert('Kopia została przywrócona. Aplikacja zostanie odświeżona.')
      window.location.reload()
    } catch (error) {
      console.error('Nie udało się przywrócić kopii:', error)
      alert('Nie udało się przywrócić kopii. Plik może być nieprawidłowy.')
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
        <div
          className="settings-item"
          style={{ cursor: 'pointer' }}
          onClick={openUsers}
        >
          <div>
            <span>👤 Użytkownicy</span>
            {!editingUsers && (
              <div style={{ marginTop: '5px', fontSize: '13px', opacity: 0.7 }}>
                {users.first} / {users.second} · aktywny: {users.active}
              </div>
            )}
          </div>
          {!editingUsers && <span>›</span>}
        </div>

        {editingUsers && (
          <div className="detail-card">
            <h2>Użytkownicy</h2>

            <div className="note-form">
              <label>
                Użytkownik 1
                <input
                  className="note-text-input"
                  type="text"
                  value={draftUsers.first}
                  onChange={(e) => setDraftUsers({ ...draftUsers, first: e.target.value })}
                />
              </label>

              <label>
                Użytkownik 2
                <input
                  className="note-text-input"
                  type="text"
                  value={draftUsers.second}
                  onChange={(e) => setDraftUsers({ ...draftUsers, second: e.target.value })}
                />
              </label>

              <label>
                Aktualnie korzysta z aplikacji
                <select
                  className="note-text-input"
                  value={draftUsers.active}
                  onChange={(e) => setDraftUsers({ ...draftUsers, active: e.target.value })}
                >
                  <option value={draftUsers.first}>{draftUsers.first}</option>
                  <option value={draftUsers.second}>{draftUsers.second}</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button className="save-button" onClick={saveUsers}>Zapisz użytkowników</button>
              <button className="back-button" onClick={cancelUsers}>Anuluj</button>
            </div>
          </div>
        )}

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
                MB: {settings.rates.mb || '—'} zł · m²: {settings.rates.m2 || '—'} zł · kg: {settings.rates.kg || '—'} zł
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