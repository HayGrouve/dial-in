import { PROCESSES, ROAST_LEVELS, type Coffee } from './db'
import { blobToDataUrl, compressImage } from './image'

const GEMINI_MODEL = 'gemini-3.8-flash'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    roaster: { type: 'string' },
    origin: { type: 'string' },
    region: { type: 'string' },
    producer: { type: 'string' },
    varietal: { type: 'string' },
    process: { type: 'string' },
    altitude: { type: 'string' },
    roastLevel: { type: 'string', enum: [...ROAST_LEVELS] },
    tastingNotes: { type: 'array', items: { type: 'string' } },
    bagWeightGrams: { type: 'number' },
  },
  required: ['tastingNotes'],
}

interface GeminiRawLabel {
  name?: string
  roaster?: string
  origin?: string
  region?: string
  producer?: string
  varietal?: string
  process?: string
  altitude?: string
  roastLevel?: string
  tastingNotes?: string[]
  bagWeightGrams?: number
}

const PROMPT = `These are photos of one specialty coffee bag (front, and usually back). Extract what is printed on the label.

Only report what the label shows. Leave a field out if it is not visible or not legible; never guess from general coffee knowledge.
The app is in Bulgarian. Names stay as printed; origin, process and tasting notes are written in Bulgarian.
- name: the coffee's own name as printed (e.g. "Ethiopia Guji Hambela", "Finca El Paraíso", or a blend name), without the roaster's name. Do not translate it.
- roaster: the roasting company, as printed.
- origin: the country, in Bulgarian (e.g. "Етиопия", "Колумбия", "Кения"). region: the region, district or town within it, as printed.
- producer: the farm, estate, washing station, cooperative or producer name, as printed.
- varietal: varieties as printed, comma-separated if several.
- process: in Bulgarian. Use one of ${PROCESSES.join(', ')} when it matches; otherwise translate the process into Bulgarian.
- altitude: in the form "1900 до 2100 м" or "1950 м".
- roastLevel: only if the label states a roast level or shows a marked roast scale; map it to the closest allowed value. "Filter" / "omni" / "espresso" roast labels are not roast levels.
- tastingNotes: the flavour notes in Bulgarian, each short and lowercase (e.g. "боровинка", "млечен шоколад"). Empty array if none.
- bagWeightGrams: net weight in grams (convert ounces or kilograms).`

/** Downscaled base64 JPEG, small enough to upload quickly while keeping label text legible. */
async function toImagePart(photo: Blob) {
  const jpeg = await compressImage(photo, 1600, 0.85)
  const data = (await blobToDataUrl(jpeg)).split(',')[1]
  return { inline_data: { mime_type: 'image/jpeg', data } }
}

export type ScannedFields = Partial<Pick<Coffee, 'name' | 'roaster' | 'origin' | 'region' | 'producer' | 'varietal' | 'process' | 'altitude' | 'roastLevel' | 'tastingNotes' | 'bagWeight'>>

/** Reads the bag's label from its front and/or back photo. Returns only the fields it found. */
export async function scanBag(apiKey: string, photos: Blob[]): Promise<ScannedFields> {
  const images = await Promise.all(photos.map(toImagePart))

  let response: Response
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, ...images] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          // Thinking tokens bill as output; reading a label does not need deep reasoning.
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    })
  } catch {
    throw new Error('Няма връзка. Четенето на етикета иска интернет.')
  }
  if (!response.ok) throw new Error(describeError(response.status, await response.text()))

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Етикетът не се прочете. Опитай с по-ясна снимка.')
  const label = JSON.parse(text) as GeminiRawLabel

  const str = (v?: string) => v?.trim() || undefined
  return {
    name: str(label.name),
    roaster: str(label.roaster),
    origin: str(label.origin),
    region: str(label.region),
    producer: str(label.producer),
    varietal: str(label.varietal),
    process: str(label.process),
    altitude: str(label.altitude),
    roastLevel: ROAST_LEVELS.find((r) => r === label.roastLevel),
    tastingNotes: (label.tastingNotes ?? []).map((t) => t.trim()).filter(Boolean),
    bagWeight: label.bagWeightGrams ? Math.round(label.bagWeightGrams) : undefined,
  }
}

function describeError(status: number, body: string) {
  if (status === 403 || body.includes('API_KEY_INVALID')) return 'Ключът ти за Gemini не беше приет. Провери го в Настройки.'
  if (status === 429) return 'Твърде много заявки в момента. Опитай пак след минута.'
  return `Четенето на етикета не стана (${status}). Опитай пак.`
}
