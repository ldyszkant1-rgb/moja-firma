import { supabase } from './supabase'

const STORAGE_BUCKET = 'aeroinstal-files'

function normalizeJobStatus(status, completed) {
  if (completed) return 'Zakończone'

  const raw = String(status || '').trim().toLowerCase()

  if (raw === 'planowane' || raw === 'planned') {
    return 'Planowane'
  }

  if (
    raw === 'odbiór' ||
    raw === 'odbior' ||
    raw === 'oczekuje na odbiór'
  ) {
    return 'Odbiór'
  }

  if (
    raw === 'faktura' ||
    raw === 'faktura wystawiona' ||
    raw === 'invoice'
  ) {
    return 'Faktura wystawiona'
  }

  if (
    raw === 'zakończone' ||
    raw === 'zakonczone' ||
    raw === 'completed'
  ) {
    return 'Zakończone'
  }

  return 'W toku'
}


/* =========================================================
   LICZBY DZIESIĘTNE
   Obsługuje:
   12,5
   12.5
   1 234,56
   1 234.56
========================================================= */

function parseDecimal(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return 0
  }

  let normalized = String(value)
    .trim()
    .replace(/\s/g, '')

  if (
    normalized.includes(',') &&
    normalized.includes('.')
  ) {
    normalized = normalized
      .replace(/\./g, '')
      .replace(',', '.')
  } else {
    normalized = normalized.replace(',', '.')
  }

  const number = Number(normalized)

  return Number.isFinite(number)
    ? number
    : 0
}


/* =========================================================
   SUPABASE → APLIKACJA
========================================================= */

function mapSupabaseJobToAppJob(job) {
  return {
    id: job.id,

    name: job.name || '',

    location: job.location || '',

    clientId: job.client_id || null,

    assignedEmployeeIds:
      Array.isArray(job.assigned_employee_ids)
        ? job.assigned_employee_ids
        : [],

    assignedTeamId:
      job.assigned_team_id || null,

    plannedStartDate:
      job.planned_start_date || null,

    plannedEndDate:
      job.planned_end_date || null,

    priority: ['normal', 'high', 'urgent'].includes(job.priority)
      ? job.priority
      : 'normal',

    status: normalizeJobStatus(
      job.status,
      job.completed
    ),

    progress: Number(job.progress || 0),

    quantities: {
      mb: parseDecimal(job.quantity_mb),
      m2: parseDecimal(job.quantity_m2),
      kg: parseDecimal(job.quantity_kg),
    },

    rates: {
      mb: parseDecimal(job.rate_mb),
      m2: parseDecimal(job.rate_m2),
      kg: parseDecimal(job.rate_kg),
    },

    completed: Boolean(job.completed),

    invoiceNumber:
      job.invoice_number || '',

    invoiceDate:
      job.invoice_date || null,

    invoiceAmount:
      job.invoice_amount == null
        ? null
        : Number(job.invoice_amount),

    paymentDueDate:
      job.payment_due_date || null,

    paidAt:
      job.paid_at || null,

    completedAt:
      job.completed_at || null,

    documents:
      job.documents || {
        material: null,
        assembly: null,
      },

    notes:
      Array.isArray(job.notes)
        ? job.notes
        : [],

    photos:
      Array.isArray(job.photos)
        ? job.photos
        : [],

    mainPhoto:
      job.main_photo || null,

    createdAt:
      job.created_at || null,

    deletedAt:
      job.deleted_at || null,
  }
}


/* =========================================================
   APLIKACJA → SUPABASE
========================================================= */

function mapAppJobToSupabaseJob(job) {
  return {
    name:
      job.name || '',

    location:
      job.location || '',

    client_id:
      job.clientId || null,

    assigned_employee_ids:
      Array.isArray(job.assignedEmployeeIds)
        ? job.assignedEmployeeIds
        : [],

    assigned_team_id:
      job.assignedTeamId || null,

    planned_start_date:
      job.plannedStartDate || null,

    planned_end_date:
      job.plannedEndDate || null,

    priority:
      ['normal', 'high', 'urgent'].includes(job.priority)
        ? job.priority
        : 'normal',

    status:
      normalizeJobStatus(
        job.status,
        job.completed
      ),

    progress:
      Number(job.progress || 0),

    completed:
      Boolean(job.completed),

    completed_at:
      job.completedAt || null,

    // Dane faktury nie są zapisywane w jobs — źródłem prawdy jest public.invoices.\n
    quantity_mb:
      parseDecimal(
        job.quantities?.mb
      ),

    quantity_m2:
      parseDecimal(
        job.quantities?.m2
      ),

    quantity_kg:
      parseDecimal(
        job.quantities?.kg
      ),

    rate_mb:
      parseDecimal(
        job.rates?.mb
      ),

    rate_m2:
      parseDecimal(
        job.rates?.m2
      ),

    rate_kg:
      parseDecimal(
        job.rates?.kg
      ),

    documents:
      job.documents || {
        material: null,
        assembly: null,
      },

    notes:
      Array.isArray(job.notes)
        ? job.notes
        : [],

    photos:
      Array.isArray(job.photos)
        ? job.photos
        : [],

    main_photo:
      job.mainPhoto || null,
  }
}


/* =========================================================
   POBIERANIE ROBÓT
========================================================= */

export async function getJobs() {
  const {
    data,
    error,
  } =
    await supabase
      .from('jobs')
      .select('*')
      .is(
        'deleted_at',
        null
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )

  if (error) {
    console.error(
      'Błąd pobierania robót:',
      error
    )

    throw error
  }

  return (
    data || []
  ).map(
    mapSupabaseJobToAppJob
  )
}


/* =========================================================
   POBIERANIE KOSZA
========================================================= */

export async function getDeletedJobs() {
  const {
    data,
    error,
  } =
    await supabase
      .from('jobs')
      .select('*')
      .not(
        'deleted_at',
        'is',
        null
      )
      .order(
        'deleted_at',
        {
          ascending: false,
        }
      )

  if (error) {
    console.error(
      'Błąd pobierania kosza:',
      error
    )

    throw error
  }

  return (
    data || []
  ).map(
    mapSupabaseJobToAppJob
  )
}


/* =========================================================
   TWORZENIE ROBOTY
========================================================= */

export async function createSupabaseJob(
  job
) {
  const payload =
    mapAppJobToSupabaseJob(
      job
    )

  console.log(
    'Tworzenie roboty:',
    payload
  )

  const {
    data,
    error,
  } =
    await supabase
      .from('jobs')
      .insert(
        payload
      )
      .select()
      .single()

  if (error) {
    console.error(
      'Błąd dodawania roboty do Supabase:',
      error
    )

    throw error
  }

  return mapSupabaseJobToAppJob(
    data
  )
}


/* =========================================================
   AKTUALIZACJA ROBOTY
========================================================= */

export async function updateSupabaseJob(
  job
) {
  if (!job?.id) {
    throw new Error(
      'Brak ID roboty podczas aktualizacji.'
    )
  }

  const payload =
    mapAppJobToSupabaseJob(
      job
    )

  console.log(
    'Aktualizacja roboty:',
    job.id,
    payload
  )

  const {
    data,
    error,
  } =
    await supabase
      .from('jobs')
      .update(
        payload
      )
      .eq(
        'id',
        job.id
      )
      .is(
        'deleted_at',
        null
      )
      .select()
      .single()

  if (error) {
    console.error(
      'Błąd aktualizacji roboty w Supabase:',
      error
    )

    throw error
  }

  return mapSupabaseJobToAppJob(
    data
  )
}


/* =========================================================
   PRZENIESIENIE DO KOSZA
========================================================= */

export async function softDeleteSupabaseJob(
  id
) {
  if (!id) {
    throw new Error(
      'Brak ID roboty podczas przenoszenia do kosza.'
    )
  }

  const {
    data,
    error,
  } =
    await supabase
      .from('jobs')
      .update({
        deleted_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        id
      )
      .is(
        'deleted_at',
        null
      )
      .select('*')
      .single()

  if (error) {
    console.error(
      'Błąd przenoszenia roboty do kosza:',
      error
    )

    throw error
  }

  return mapSupabaseJobToAppJob(
    data
  )
}


/* =========================================================
   PRZYWRACANIE Z KOSZA
========================================================= */

export async function restoreSupabaseJob(
  id
) {
  if (!id) {
    throw new Error(
      'Brak ID roboty podczas przywracania.'
    )
  }

  const {
    data,
    error,
  } =
    await supabase
      .from('jobs')
      .update({
        deleted_at: null,
      })
      .eq(
        'id',
        id
      )
      .not(
        'deleted_at',
        'is',
        null
      )
      .select('*')
      .single()

  if (error) {
    console.error(
      'Błąd przywracania roboty:',
      error
    )

    throw error
  }

  return mapSupabaseJobToAppJob(
    data
  )
}


/* =========================================================
   TRWAŁE USUWANIE
========================================================= */

export async function hardDeleteSupabaseJob(
  id
) {
  if (!id) {
    throw new Error(
      'Brak ID roboty podczas trwałego usuwania.'
    )
  }

  const {
    error,
  } =
    await supabase
      .from('jobs')
      .delete()
      .eq(
        'id',
        id
      )

  if (error) {
    console.error(
      'Błąd trwałego usuwania roboty:',
      error
    )

    throw error
  }

  return true
}


/* =========================================================
   DODAWANIE ZDJĘCIA
========================================================= */

export async function appendSupabaseJobPhoto(
  jobId,
  photo
) {
  if (!jobId) {
    throw new Error(
      'Brak ID roboty.'
    )
  }

  if (!photo) {
    throw new Error(
      'Brak danych zdjęcia.'
    )
  }

  const {
    data: currentJob,
    error: readError,
  } =
    await supabase
      .from('jobs')
      .select('photos')
      .eq(
        'id',
        jobId
      )
      .single()

  if (readError) {
    console.error(
      'appendSupabaseJobPhoto - odczyt:',
      readError
    )

    throw readError
  }

  const currentPhotos =
    Array.isArray(
      currentJob?.photos
    )
      ? currentJob.photos
      : []

  const updatedPhotos = [
    ...currentPhotos,
    photo,
  ]

  const {
    data,
    error,
  } =
    await supabase
      .from('jobs')
      .update({
        photos:
          updatedPhotos,
      })
      .eq(
        'id',
        jobId
      )
      .select('*')
      .single()

  if (error) {
    console.error(
      'appendSupabaseJobPhoto - zapis:',
      error
    )

    throw error
  }

  return mapSupabaseJobToAppJob(
    data
  )
}


/* =========================================================
   DODAWANIE NOTATKI
========================================================= */

export async function appendSupabaseJobNote(
  jobId,
  note
) {
  if (!jobId) {
    throw new Error(
      'Brak ID roboty podczas dodawania notatki.'
    )
  }

  if (!note) {
    throw new Error(
      'Brak danych notatki.'
    )
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'append_job_note',
      {
        p_job_id:
          jobId,

        p_note:
          note,
      }
    )

  if (error) {
    console.error(
      'Błąd atomowego dodawania notatki:',
      error
    )

    throw error
  }

  return mapSupabaseJobToAppJob(
    data
  )
}


/* =========================================================
   EDYCJA NOTATKI
========================================================= */

export async function updateSupabaseJobNote(
  jobId,
  noteId,
  patch
) {
  if (!jobId) {
    throw new Error(
      'Brak ID roboty podczas zmiany notatki.'
    )
  }

  if (!noteId) {
    throw new Error(
      'Brak ID notatki.'
    )
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      'update_job_note',
      {
        p_job_id:
          jobId,

        p_note_id:
          String(noteId),

        p_patch:
          patch || {},
      }
    )

  if (error) {
    console.error(
      'Błąd aktualizacji notatki:',
      error
    )

    throw error
  }

  return mapSupabaseJobToAppJob(
    data
  )
}


/* =========================================================
   USUWANIE NOTATKI
========================================================= */

export async function deleteSupabaseJobNote(
  jobId,
  noteId
) {
  if (!jobId) {
    throw new Error(
      'Brak ID roboty podczas usuwania notatki.'
    )
  }

  if (!noteId) {
    throw new Error(
      'Brak ID notatki.'
    )
  }

  const { data: currentJob, error: fetchError } =
    await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

  if (fetchError) {
    console.error('Błąd pobierania roboty przed usunięciem notatki:', fetchError)
    throw fetchError
  }

  const currentNotes = Array.isArray(currentJob.notes) ? currentJob.notes : []
  const nextNotes = currentNotes.filter(
    (item) => String(item?.id) !== String(noteId)
  )

  const { data, error } =
    await supabase
      .from('jobs')
      .update({ notes: nextNotes })
      .eq('id', jobId)
      .select()
      .single()

  if (error) {
    console.error('Błąd usuwania notatki:', error)
    throw error
  }

  return mapSupabaseJobToAppJob(data)
}


/* =========================================================
   NAZWA PLIKU
========================================================= */

function sanitizeFileName(name) {
  return String(
    name || 'plik'
  )
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    )
}


/* =========================================================
   UPLOAD PLIKU DO STORAGE
========================================================= */

export async function uploadSupabaseFile(
  jobId,
  folder,
  file
) {
  if (!jobId) {
    throw new Error(
      'Brak ID roboty.'
    )
  }

  if (!file) {
    throw new Error(
      'Brak pliku do wysłania.'
    )
  }

  const safeName =
    sanitizeFileName(
      file.name
    )

  const path =
    `jobs/${jobId}/${folder}/` +
    `${Date.now()}-${safeName}`

  const {
    error: uploadError,
  } =
    await supabase.storage
      .from(
        STORAGE_BUCKET
      )
      .upload(
        path,
        file,
        {
          cacheControl:
            '3600',

          upsert:
            false,

          contentType:
            file.type ||
            'application/octet-stream',
        }
      )

  if (uploadError) {
    console.error(
      'Błąd wysyłania pliku do Storage:',
      uploadError
    )

    throw uploadError
  }

  const { data } =
    supabase.storage
      .from(
        STORAGE_BUCKET
      )
      .getPublicUrl(
        path
      )

  return {
    path,

    url:
      data.publicUrl,
  }
}


/* =========================================================
   USUWANIE PLIKU ZE STORAGE
========================================================= */

export async function deleteSupabaseFile(
  path
) {
  if (!path) {
    return
  }

  const {
    error,
  } =
    await supabase.storage
      .from(
        STORAGE_BUCKET
      )
      .remove([
        path,
      ])

  if (error) {
    console.error(
      'Błąd usuwania pliku ze Storage:',
      error
    )

    throw error
  }
}


/* =========================================================
   KOMPATYBILNOŚĆ
========================================================= */

export async function deleteSupabaseJob(
  id
) {
  return hardDeleteSupabaseJob(
    id
  )
}