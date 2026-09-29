import { supabase } from './supabase'


/* =========================
   LICZBY DZIESIĘTNE
========================= */

function parseDecimal(value) {

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {

    return 0

  }

  let normalized =
    String(value)
      .trim()
      .replace(/\s/g, '')

  /*
   * Obsługa:
   *
   * 123,45
   * 1.234,56
   * 123.45
   * 1234.56
   */

  if (
    normalized.includes(',') &&
    normalized.includes('.')
  ) {

    normalized =
      normalized
        .replace(/\./g, '')
        .replace(',', '.')

  } else {

    normalized =
      normalized.replace(',', '.')

  }

  const number =
    Number(normalized)

  return Number.isFinite(number)
    ? number
    : 0

}


/* =========================
   SUPABASE → APP
========================= */

function mapSupabaseFinanceToApp(
  item
) {

  return {

    id:
      item.id,

    category:
      item.category || null,

    amount:
      parseDecimal(
        item.amount
      ),

    paidBy:
      item.paid_by || null,

    description:
      item.description || '',

    /*
     * App.jsx używa pola "month".
     * Supabase również przechowuje
     * miesiąc w polu "month".
     */

    month:
      item.month || null,

    /*
     * Zachowujemy również "date"
     * dla zgodności ze starszą
     * częścią kodu.
     */

    date:
      item.month || null,

    type:
      item.type || 'cost',

    createdAt:
      item.created_at || null,

  }

}


/* =========================
   APP → SUPABASE
========================= */

function mapAppFinanceToSupabase(
  item
) {

  const sourceDate =
    item.month ||
    item.date ||
    null

  let month =
    null

  if (sourceDate) {

    const value =
      String(sourceDate)

    if (
      value.length >= 7
    ) {

      month =
        `${value.slice(0, 7)}-01`

    }

  }

  return {

    type:
      item.type || 'cost',

    amount:
      parseDecimal(
        item.amount
      ),

    category:
      item.category || null,

    month,

    description:
      item.description
        ? String(
            item.description
          ).trim()
        : null,

    paid_by:
      item.paidBy || null,

  }

}


/* =========================
   POBIERANIE WSZYSTKICH
========================= */

export async function getFinance() {

  const {
    data,
    error,
  } =
    await supabase

      .from('finance')

      .select('*')

      .order(
        'month',
        {
          ascending: false,
        }
      )

      .order(
        'created_at',
        {
          ascending: false,
        }
      )

  if (error) {

    console.error(
      'Błąd pobierania finansów:',
      error
    )

    throw error

  }

  return (
    data || []
  ).map(
    mapSupabaseFinanceToApp
  )

}


/* =========================
   POBIERANIE DLA MIESIĄCA
========================= */

export async function getFinanceForMonth(
  month
) {

  if (!month) {

    return []

  }

  const monthDate =
    String(month).length === 7

      ? `${month}-01`

      : String(month).slice(0, 7) +
        '-01'

  const {
    data,
    error,
  } =
    await supabase

      .from('finance')

      .select('*')

      .eq(
        'month',
        monthDate
      )

      .order(
        'created_at',
        {
          ascending: false,
        }
      )

  if (error) {

    console.error(
      'Błąd pobierania finansów dla miesiąca:',
      error
    )

    throw error

  }

  return (
    data || []
  ).map(
    mapSupabaseFinanceToApp
  )

}


/* =========================
   DODAWANIE KOSZTU
========================= */

export async function createFinance(
  item
) {

  const payload =
    mapAppFinanceToSupabase(
      item
    )

  console.log(
    'Wysyłanie kosztu do Supabase:',
    payload
  )

  if (!payload.month) {

    throw new Error(
      'Brak daty/miesiąca kosztu.'
    )

  }

  const {
    data,
    error,
  } =
    await supabase

      .from('finance')

      .insert(
        payload
      )

      .select()

      .single()

  if (error) {

    console.error(
      'Błąd dodawania wpisu finansowego:',
      error
    )

    throw error

  }

  return mapSupabaseFinanceToApp(
    data
  )

}


/* =========================
   AKTUALIZACJA KOSZTU
========================= */

export async function updateFinance(
  item
) {

  if (!item?.id) {

    throw new Error(
      'Brak ID wpisu finansowego podczas aktualizacji.'
    )

  }

  const payload =
    mapAppFinanceToSupabase(
      item
    )

  console.log(
    'Aktualizacja kosztu w Supabase:',
    item.id,
    payload
  )

  if (!payload.month) {

    throw new Error(
      'Brak daty/miesiąca kosztu.'
    )

  }

  const {
    data,
    error,
  } =
    await supabase

      .from('finance')

      .update(
        payload
      )

      .eq(
        'id',
        item.id
      )

      .select()

      .single()

  if (error) {

    console.error(
      'Błąd aktualizacji wpisu finansowego:',
      error
    )

    throw error

  }

  return mapSupabaseFinanceToApp(
    data
  )

}


/* =========================
   USUWANIE KOSZTU
========================= */

export async function deleteFinance(
  id
) {

  if (!id) {

    throw new Error(
      'Brak ID wpisu finansowego podczas usuwania.'
    )

  }

  const {
    error,
  } =
    await supabase

      .from('finance')

      .delete()

      .eq(
        'id',
        id
      )

  if (error) {

    console.error(
      'Błąd usuwania kosztu z Supabase:',
      error
    )

    throw error

  }

  return true

}


/* =========================
   REALTIME
========================= */

export function subscribeToFinance(
  callback
) {

  const channel =
    supabase

      .channel(
        'finance-realtime'
      )

      .on(

        'postgres_changes',

        {
          event: '*',
          schema: 'public',
          table: 'finance',
        },

        (payload) => {

          callback(
            payload
          )

        }

      )

      .subscribe(
        (status) => {

          console.log(
            'Realtime finance:',
            status
          )

        }
      )

  return () => {

    supabase.removeChannel(
      channel
    )

  }

}