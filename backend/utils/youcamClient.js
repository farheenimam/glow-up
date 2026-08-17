import axios from 'axios'

// Thin wrapper around the real YouCam API (Perfect Corp) V2. Every function
// here is the ONLY place the real API key is read from process.env — routes
// never touch it directly.
//
// Docs: https://yce.perfectcorp.com/document/index.html
//       https://docs.perfectcorp.com/reference/ai_face_swap (same request
//       shape is used across V2 tasks: file registration -> presigned PUT ->
//       task creation -> polling)
//
// Confirmed from the docs (verify against your dashboard's API Playground
// for the exact feature slugs your hackathon key has access to):
//   - V2 has NO separate token-exchange endpoint. There is no id_token / RSA
//     signing step. Every request just carries the raw key:
//       Authorization: Bearer YOUR_API_KEY
//   - Base URL is the yce-api-01 host, NOT the yce.perfectcorp.com dashboard
//     host.
//   - Every AI feature (skin-analysis, cloth, hair-style, makeup-vto, ...)
//     follows the same 4-step flow:
//       1. POST /s2s/v2.0/file/{ai-task}   { files: [{ content_type, file_name, file_size }] }
//          -> { file_id, requests: [{ url, method }] } per file
//       2. PUT the raw file bytes straight to that presigned URL (not to
//          our API host — it's typically a signed S3 URL)
//       3. POST /s2s/v2.0/task/{ai-task}   { request_id, payload: { file_sets: { src_ids, ref_ids }, actions: [...] } }
//          -> { task_id }
//       4. GET  /s2s/v2.0/task/{ai-task}/{task_id}  (poll until status is
//          terminal) -> nested result payload

const BASE_URL = process.env.YOUCAM_API_BASE_URL || 'https://yce-api-01.makeupar.com'

// Up to 4 separate YouCam keys/accounts so a batch of outfit renders can be
// spread across separate quota buckets instead of serializing against one
// key's rate limit — YOUCAM_API_KEY is slot 0 (always required), the rest
// are optional (YOUCAM_API_KEY_2/3/4). Any unset slot silently falls back
// to slot 0's key rather than throwing, so this works fine with just one
// key configured — rotation is a bonus when you have more, not a
// requirement.
const API_KEYS = [
  process.env.YOUCAM_API_KEY,
  process.env.YOUCAM_API_KEY_2,
  process.env.YOUCAM_API_KEY_3,
  process.env.YOUCAM_API_KEY_4
]

const warnedMissingSlots = new Set()

function keyForSlot(keyIndex = 0) {
  const slot = Number.isInteger(keyIndex) ? ((keyIndex % API_KEYS.length) + API_KEYS.length) % API_KEYS.length : 0
  const key = API_KEYS[slot]
  if (key && !key.startsWith('REPLACE_WITH')) return key

  if (!warnedMissingSlots.has(slot) && slot !== 0) {
    warnedMissingSlots.add(slot)
    console.warn(`[youcamClient] YOUCAM_API_KEY_${slot + 1} is not configured — falling back to YOUCAM_API_KEY for this request`)
  }
  return API_KEYS[0]
}

function assertConfigured(keyIndex = 0) {
  const key = keyForSlot(keyIndex)
  if (!key || key.startsWith('REPLACE_WITH')) {
    const err = new Error('YOUCAM_API_KEY is not configured on the backend')
    err.code = 'YOUCAM_NOT_CONFIGURED'
    throw err
  }
}

function client(keyIndex = 0) {
  assertConfigured(keyIndex)
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${keyForSlot(keyIndex)}` },
    timeout: 60000
  })
}

// --- Step 1 + 2: register a file with YouCam, then upload the actual bytes
// straight to the presigned URL it hands back. -----------------------------
async function uploadFile(aiTask, buffer, mimeType, fileName) {
  const { data } = await client().post(`/s2s/v2.0/file/${aiTask}`, {
    files: [{ content_type: mimeType, file_name: fileName, file_size: buffer.length }]
  })

  // The wrapper shape has drifted across YouCam's own docs/examples
  // (`result.files[]` in some, `files[]` in others, `data.files[]` in
  // others) — accept all three so a dashboard-schema tweak doesn't
  // silently break uploads.
  const fileInfo = data?.result?.files?.[0] ?? data?.files?.[0] ?? data?.data?.files?.[0]
  if (!fileInfo?.file_id) {
    // Log the raw response so we can see exactly what YouCam sent back
    // instead of guessing blind.
    console.error(`[youcamClient] raw file-registration response for "${aiTask}":`, JSON.stringify(data))
    const err = new Error(`YouCam file registration for "${aiTask}" did not return a file_id`)
    err.code = 'YOUCAM_UPLOAD_FAILED'
    throw err
  }

  const uploadReq = fileInfo.requests?.[0]
  if (!uploadReq?.url) {
    const err = new Error(`YouCam file registration for "${aiTask}" did not return an upload URL`)
    err.code = 'YOUCAM_UPLOAD_FAILED'
    throw err
  }

  // This PUT goes to the presigned URL itself (usually S3), NOT to the
  // YouCam API host — no Authorization header here on purpose.
  await axios.request({
    url: uploadReq.url,
    method: uploadReq.method || 'PUT',
    data: buffer,
    headers: { 'Content-Type': mimeType },
    maxBodyLength: Infinity
  })

  return fileInfo.file_id
}

// --- Step 3: create the task once the source (and optional reference)
// file(s) are uploaded. -----------------------------------------------------
async function createTask(aiTask, { srcIds, refIds, actions = [{ id: 0 }] }) {
  // NOTE: confirmed against the live API's own 400 error body — this
  // endpoint wants `src_file_id` (singular) and `dst_actions`. Trying the
  // FLAT shape (no `payload` wrapper) since the nested version produced the
  // identical error, matching the flat style seen in the working
  // image-to-image curl request.
  const body = {
    request_id: 1,
    src_file_id: srcIds?.[0],
    dst_actions: actions
  }
  if (refIds?.length) body.ref_file_id = refIds[0]

  console.error(`[youcamClient] task-creation request body for "${aiTask}":`, JSON.stringify(body))

  let data
  try {
    ;({ data } = await client().post(`/s2s/v2.0/task/${aiTask}`, body))
  } catch (err) {
    console.error(`[youcamClient] task-creation HTTP error for "${aiTask}":`, JSON.stringify(err?.response?.data ?? err.message))
    throw err
  }

  const taskId = data?.result?.task_id ?? data?.data?.task_id ?? data?.task_id
  if (!taskId) {
    console.error(`[youcamClient] raw task-creation response for "${aiTask}":`, JSON.stringify(data))
    const err = new Error(`YouCam task creation for "${aiTask}" did not return a task_id`)
    err.code = 'YOUCAM_TASK_CREATE_FAILED'
    throw err
  }
  return taskId
}

// --- Step 4: poll until the task reaches a terminal state. -----------------
async function pollTask(aiTask, taskId, { intervalMs = 2000, timeoutMs = 45000 } = {}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const { data } = await client().get(`/s2s/v2.0/task/${aiTask}/${taskId}`)

    // Observed response wrapping is double-nested: { status, data: { data: { task_status, results } } }
    // — fall back through the plausible shapes rather than assuming one.
    const inner = data?.data?.data ?? data?.data ?? data?.result ?? data
    const status = inner?.task_status ?? inner?.status

    if (status === 'success' || status === 'done' || status === 'Done') {
      return inner?.results ?? inner
    }
    if (status === 'failed' || status === 'error' || status === 'Failed') {
      const err = new Error(`YouCam "${aiTask}" task failed`)
      err.code = 'YOUCAM_TASK_FAILED'
      throw err
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  const err = new Error(`YouCam "${aiTask}" task timed out waiting for a result`)
  err.code = 'YOUCAM_TASK_TIMEOUT'
  throw err
}

// --- AI Image Generator (text-to-image AND image-to-image) --------------
// This is a DIFFERENT task from the file-registration flow above. Confirmed
// against the API Playground (https://yce.perfectcorp.com/api-console/en/
// api-playground/ai-image-generator/):
//   - Endpoint: POST /s2s/v2.0/task/text-to-image/youcam
//     Poll:     GET  /s2s/v2.0/task/text-to-image/youcam/{task_id}
//   - No separate /file upload/registration step for the source image —
//     the request body takes real, publicly-fetchable image URLs directly
//     via "src_file_urls". Supplying src_file_urls turns the same endpoint
//     into image-to-image (edits that photo); omitting it is text-to-image.
//   - Body: { src_file_urls: string[], model, prompt, size, negative_prompt }
//   - Poll response is double-nested, matching the shape observed on every
//     other V2 task in this file:
//       { status: 200, data: { error, task_status, results: { url } } }
const IMAGE_GEN_TASK = 'image-to-image/youcam'
const DEFAULT_IMAGE_MODEL = 'youcam-image-v2'
const DEFAULT_IMAGE_SIZE = '1664*928'

// YouCam rejects the whole request with a 400 ("prompt is longer than the
// maximum allowed length") past a certain length — hit in practice around
// ~900 chars when the fallback prompt builder pasted in Agent 3's full
// 80-150 word visual paragraph verbatim. There's no documented exact limit,
// so this is a conservative hard cap enforced right before the API call —
// a last-line safety net regardless of which caller built the prompt (LLM
// or the deterministic fallback). Cuts at the last full sentence/clause
// under the limit rather than mid-word.
const MAX_PROMPT_CHARS = 700

function capPromptLength(prompt, maxChars = MAX_PROMPT_CHARS) {
  if (!prompt || prompt.length <= maxChars) return prompt
  const slice = prompt.slice(0, maxChars)
  const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(', '))
  const trimmed = lastBreak > maxChars * 0.6 ? slice.slice(0, lastBreak + 1) : slice
  return `${trimmed.trim()}.`
}

export async function generateImageEdit({
  imageUrl,
  prompt,
  negativePrompt,
  size = DEFAULT_IMAGE_SIZE,
  model = DEFAULT_IMAGE_MODEL,
  // Which of the up to 4 YouCam keys/accounts to run this render on — see
  // keyForSlot() above. Defaults to the primary key.
  keyIndex = 0
}) {
  if (!imageUrl) {
    const err = new Error('generateImageEdit needs a publicly reachable imageUrl for src_file_urls')
    err.code = 'YOUCAM_IMAGE_URL_MISSING'
    throw err
  }
  if (!prompt) {
    const err = new Error('generateImageEdit needs a prompt')
    err.code = 'YOUCAM_PROMPT_MISSING'
    throw err
  }

  const cappedPrompt = capPromptLength(prompt)
  const cappedNegativePrompt = capPromptLength(negativePrompt || '', 300)
  if (cappedPrompt.length !== prompt.length) {
    console.warn(`[youcamClient] prompt was ${prompt.length} chars — trimmed to ${cappedPrompt.length} to stay under YouCam's length limit`)
  }

  const { data: createData } = await client(keyIndex).post(`/s2s/v2.0/task/${IMAGE_GEN_TASK}`, {
    src_file_urls: [imageUrl],
    model,
    prompt: cappedPrompt,
    size,
    negative_prompt: cappedNegativePrompt
  })

  // Same schema drift caveat as uploadFile()/createTask() above — accept
  // either the flat or double-nested shape.
  const taskId = createData?.data?.task_id ?? createData?.data?.data?.task_id ?? createData?.task_id
  if (!taskId) {
    const err = new Error('YouCam AI Image Generator task creation did not return a task_id')
    err.code = 'YOUCAM_TASK_CREATE_FAILED'
    throw err
  }

  const results = await pollImageGenTask(taskId, { keyIndex })
  const url = results?.url ?? results?.results?.url
  if (!url) {
    const err = new Error('YouCam AI Image Generator task finished without a result url')
    err.code = 'YOUCAM_IMAGE_GEN_NO_URL'
    throw err
  }
  return { imageUrl: url }
}

async function pollImageGenTask(taskId, { intervalMs = 2000, timeoutMs = 60000, keyIndex = 0 } = {}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const { data } = await client(keyIndex).get(`/s2s/v2.0/task/${IMAGE_GEN_TASK}/${taskId}`)

    const inner = data?.data?.data ?? data?.data ?? data?.result ?? data
    const status = inner?.task_status ?? inner?.status

    if (status === 'success' || status === 'done' || status === 'Done') {
      return inner?.results ?? inner
    }
    if (status === 'failed' || status === 'error' || status === 'Failed') {
      const err = new Error(`YouCam AI Image Generator task failed${inner?.error ? `: ${inner.error}` : ''}`)
      err.code = 'YOUCAM_TASK_FAILED'
      throw err
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  const err = new Error('YouCam AI Image Generator task timed out waiting for a result')
  err.code = 'YOUCAM_TASK_TIMEOUT'
  throw err
}

// --- Skin AI -----------------------------------------------------------
// Concern list confirmed from the real docs
// (docs.perfectcorp.com/reference/ai_skin_analysis) — dst_actions for this
// task is an array of concern-name STRINGS, not the generic {id:0} action
// objects other tasks use. SD and HD concerns cannot be mixed in one call;
// this is the SD set.
const SKIN_CONCERNS = [
  'wrinkle', 'droopy_upper_eyelid', 'droopy_lower_eyelid', 'firmness',
  'acne', 'moisture', 'eye_bag', 'dark_circle_v2', 'age_spot', 'radiance',
  'redness', 'oiliness', 'pore', 'texture'
]

// NOTE: Skin AI does not return body shape — that field doesn't exist in
// this response. Body shape is collected as an honest user self-select
// elsewhere in the app (see PersonalizeStep.jsx) rather than invented here.
export async function analyzeSkin(photoBuffer, mimeType) {
  const fileId = await uploadFile('skin-analysis', photoBuffer, mimeType, 'subject.jpg')
  const taskId = await createTask('skin-analysis', { srcIds: [fileId], actions: SKIN_CONCERNS })
  const result = await pollTask('skin-analysis', taskId)

  // Dump the raw result once so the actual field names for concern scores
  // are visible in the terminal — this endpoint returns per-concern scores
  // (wrinkle/pore/acne/etc.), not the undertone/tone fields below, which
  // are almost certainly wrong and need to be replaced once you see the
  // real shape.
  console.error('[youcamClient] raw skin-analysis poll result:', JSON.stringify(result))

  return {
    undertone: result?.undertone,
    tone: result?.tone,
    top_concern: result?.top_concern ?? result?.concerns?.[0],
    raw: result
  }
}

// --- Apparel Virtual Try-On ("cloth") -----------------------------------
// The real cloth task needs an actual reference garment PHOTO uploaded as
// ref_ids, not just a catalog string. This app's current garment catalog
// (see recommendationEngine.js) is illustrative and has no real garment
// images yet (README "Known gaps"), so this throws a clear, honest error
// instead of silently pretending a garmentId string is a valid reference.
export async function generateApparelTryOn({ photoBuffer, mimeType, garmentImageBuffer, garmentMimeType }) {
  if (!garmentImageBuffer) {
    const err = new Error(
      'Apparel VTO needs a real garment reference photo to send as ref_ids — the current catalog only has illustrative garment IDs, no images. Add a real garment photo per SKU to enable this.'
    )
    err.code = 'YOUCAM_GARMENT_IMAGE_MISSING'
    throw err
  }

  const srcId = await uploadFile('cloth', photoBuffer, mimeType, 'subject.jpg')
  const refId = await uploadFile('cloth', garmentImageBuffer, garmentMimeType || 'image/jpeg', 'garment.jpg')
  const taskId = await createTask('cloth', { srcIds: [srcId], refIds: [refId] })
  const result = await pollTask('cloth', taskId)

  return { image_url: result?.image_url ?? result?.url ?? result?.results?.[0]?.url }
}