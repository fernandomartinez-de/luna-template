import { supabase } from '../supabaseClient.js'

// The PIN lives in the database (app_config.app_pin_sha256), never in the app's code,
// because everything in this bundle is public. Reading it needs a signed in session.
let hashPromise = null

function loadHash() {
  if (!hashPromise) {
    hashPromise = supabase
      .from('app_config')
      .select('value')
      .eq('key', 'app_pin_sha256')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          hashPromise = null
          throw new Error(error ? error.message : 'PIN not set')
        }
        return data.value
      })
  }
  return hashPromise
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function checkPin(code) {
  const [expected, actual] = await Promise.all([loadHash(), sha256Hex(`luna-pin:${code}`)])
  return expected === actual
}
