// BR-SUB-008: auto-saves the current page's form fields to the server every 10 seconds
// and queues failed saves in localStorage so a dropped connection doesn't lose them.
const AUTOSAVE_INTERVAL_MS = 10000
const AUTOSAVE_ENDPOINT = '/draft/autosave'
const PENDING_STORAGE_KEY = 'app-draft-autosave-pending'

function collectFormFields(form) {
  const fields = {}

  new FormData(form).forEach((value, key) => {
    const asString = typeof value === 'string' ? value : value.name
    const previous = fields[key]

    if (previous === undefined) {
      fields[key] = asString
      return
    }

    fields[key] = Array.isArray(previous)
      ? [...previous, asString]
      : [previous, asString]
  })

  return fields
}

function readPending() {
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_STORAGE_KEY)) || []
  } catch {
    return []
  }
}

function writePending(entries) {
  window.localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(entries))
}

async function send(entry) {
  const response = await window.fetch(AUTOSAVE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    keepalive: true
  })

  if (!response.ok) {
    throw new Error(`Autosave failed with status ${response.status}`)
  }
}

export async function flushPendingAutosaves() {
  const entries = readPending()
  if (entries.length === 0) {
    return
  }
  writePending([])

  for (const entry of entries) {
    try {
      await send(entry)
    } catch {
      writePending([...readPending(), entry])
    }
  }
}

async function saveNow(form) {
  const entry = {
    path: window.location.pathname,
    fields: collectFormFields(form)
  }

  try {
    await send(entry)
  } catch {
    writePending([...readPending(), entry])
  }
}

export function initialiseDraftAutosave() {
  const form = document.querySelector('main form')
  if (!form) {
    return
  }

  let timer
  const scheduleSave = () => {
    clearTimeout(timer)
    timer = setTimeout(() => saveNow(form), AUTOSAVE_INTERVAL_MS)
  }

  form.addEventListener('input', scheduleSave)
  form.addEventListener('change', scheduleSave)
  window.addEventListener('online', flushPendingAutosaves)

  flushPendingAutosaves()
}
