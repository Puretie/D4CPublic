import Ajv2020 from 'ajv/dist/2020'
import { useEffect, useMemo, useState } from 'react'
import type { ErrorObject, ValidateFunction } from 'ajv'
import type { ChangeEvent } from 'react'
import defaultBuildGuideData from './sample-build.json'
import './App.css'

type Priority = 'required' | 'recommended' | 'optional' | 'avoid'

type ComponentRef = {
  name: string
  kind?: string
  confidence?: string
}

type GuideStep = {
  stage: string
  range: string
  title: string
  goals: string[]
  actions: string[]
  notes?: string
}

type BuildGuide = {
  schemaVersion: string
  id: string
  name: string
  class: string
  season: string
  patch: string
  archetype: string
  buildType: string
  status: string
  contentTargets: string[]
  updated?: string
  mechanics: {
    coreLoop: string
    engineTags?: string[]
    coreInteractions: Array<{
      name: string
      summary: string
      confidence: string
      priority: Priority
      refs?: ComponentRef[]
    }>
  }
  guide: {
    overview: string
    rotation: {
      summary: string
      sequence: string[]
    }
    steps: GuideStep[]
  }
  skills: {
    loadout: Array<{
      name: string
      role: string
      priority: Priority
      tags?: string[]
    }>
    specializations?: ComponentRef[]
  }
  gear: {
    statPriorities: Array<{
      stat: string
      priority: Priority
      reason?: string
    }>
    slots: Array<{
      slot: string
      priority: Priority
      item?: ComponentRef
      aspect?: ComponentRef
      notes?: string
    }>
  }
}

type LoaderTone = 'idle' | 'success' | 'warning' | 'error'

type LoaderStatus = {
  tone: LoaderTone
  message: string
  details?: string[]
}

const defaultBuildGuide = defaultBuildGuideData as BuildGuide
const defaultJsonText = JSON.stringify(defaultBuildGuideData, null, 2)
const baseUrl = import.meta.env.BASE_URL
const markUrl = `${baseUrl}planner-mark.svg`
const schemaUrl = `${baseUrl}schema/`
const schemaAssetUrl = `${baseUrl}schema/build-guide.schema.json`
const demoBuildUrl = `${baseUrl}demo-build-guide.json`

function formatValidationErrors(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).slice(0, 8).map((error) => {
    const path = error.instancePath || '/'
    const params =
      error.params && Object.keys(error.params).length > 0
        ? ` ${JSON.stringify(error.params)}`
        : ''

    return `${path} ${error.message ?? 'is invalid'}${params}`
  })
}

function App() {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '')
  const isSchemaFallbackPath = normalizedPath.endsWith('/schema')
  const [buildGuide, setBuildGuide] = useState(defaultBuildGuide)
  const [jsonText, setJsonText] = useState(defaultJsonText)
  const [validateBuildGuide, setValidateBuildGuide] =
    useState<ValidateFunction | null>(null)
  const [loaderStatus, setLoaderStatus] = useState<LoaderStatus>({
    tone: 'idle',
    message: 'Loading schema validator...',
  })

  useEffect(() => {
    if (isSchemaFallbackPath) {
      window.location.replace(`${normalizedPath}/index.html`)
    }
  }, [isSchemaFallbackPath, normalizedPath])

  useEffect(() => {
    let isCurrent = true

    async function loadSchema() {
      try {
        const response = await fetch(schemaAssetUrl, { cache: 'no-store' })

        if (!response.ok) {
          throw new Error(`Schema request failed with ${response.status}`)
        }

        const schema = (await response.json()) as object
        const ajv = new Ajv2020({ allErrors: true, strict: false })
        const validator = ajv.compile(schema)

        if (!isCurrent) {
          return
        }

        setValidateBuildGuide(() => validator)
        setLoaderStatus({
          tone: 'success',
          message: 'Schema validator ready. Paste build-guide JSON to load it.',
        })
      } catch (error) {
        if (!isCurrent) {
          return
        }

        const message = error instanceof Error ? error.message : String(error)
        setLoaderStatus({
          tone: 'error',
          message: `Could not load schema validator: ${message}`,
        })
      }
    }

    loadSchema()

    return () => {
      isCurrent = false
    }
  }, [])

  const checkpoints = useMemo(
    () => [
      {
        label: 'Content',
        value: buildGuide.contentTargets.join(' / '),
      },
      {
        label: 'Core Loop',
        value: buildGuide.mechanics.coreLoop,
      },
      {
        label: 'Status',
        value: `${buildGuide.status} / ${buildGuide.buildType}`,
      },
      {
        label: 'Patch',
        value: `${buildGuide.season} ${buildGuide.patch}`,
      },
    ],
    [buildGuide],
  )

  if (isSchemaFallbackPath) {
    return null
  }

  function loadJsonText(nextJsonText: string, sourceLabel: string) {
    if (!validateBuildGuide) {
      setLoaderStatus({
        tone: 'warning',
        message: 'Schema validator is still loading. Try again in a moment.',
      })
      return
    }

    try {
      const candidate = JSON.parse(nextJsonText) as unknown
      const isValid = validateBuildGuide(candidate)

      if (!isValid) {
        setLoaderStatus({
          tone: 'error',
          message: `${sourceLabel} did not match the build-guide schema.`,
          details: formatValidationErrors(validateBuildGuide.errors),
        })
        return
      }

      setBuildGuide(candidate as BuildGuide)
      setJsonText(JSON.stringify(candidate, null, 2))
      setLoaderStatus({
        tone: 'success',
        message: `${sourceLabel} loaded and validated.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLoaderStatus({
        tone: 'error',
        message: `${sourceLabel} is not valid JSON: ${message}`,
      })
    }
  }

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API is unavailable in this browser.')
      }

      const clipboardText = await navigator.clipboard.readText()

      if (!clipboardText.trim()) {
        throw new Error('Clipboard did not contain JSON text.')
      }

      setJsonText(clipboardText)
      loadJsonText(clipboardText, 'Clipboard JSON')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLoaderStatus({
        tone: 'warning',
        message: `Could not read clipboard: ${message}. Paste into the text area and load from text instead.`,
      })
    }
  }

  async function loadDemoBuild() {
    try {
      const response = await fetch(demoBuildUrl, { cache: 'no-store' })

      if (!response.ok) {
        throw new Error(`Demo request failed with ${response.status}`)
      }

      loadJsonText(await response.text(), 'Demo build guide')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLoaderStatus({
        tone: 'error',
        message: `Could not load demo build guide: ${message}`,
      })
    }
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    loadJsonText(await file.text(), file.name)
  }

  return (
    <main className="app-shell">
      <header className="build-header">
        <div>
          <p className="eyebrow">
            {buildGuide.class} / {buildGuide.archetype}
          </p>
          <h1>{buildGuide.name}</h1>
          <p className="overview">{buildGuide.guide.overview}</p>
          <div className="header-actions">
            <a href={schemaUrl}>View JSON schema</a>
            <a href={demoBuildUrl}>Demo JSON</a>
          </div>
        </div>
        <img className="build-mark" src={markUrl} alt="" />
      </header>

      <section className="checkpoint-strip" aria-label="Build summary">
        {checkpoints.map((checkpoint) => (
          <div className="checkpoint" key={checkpoint.label}>
            <span>{checkpoint.label}</span>
            <strong>{checkpoint.value}</strong>
          </div>
        ))}
      </section>

      <section className="loader-panel" aria-labelledby="loader-heading">
        <div className="loader-header">
          <div>
            <p className="eyebrow">JSON Loader</p>
            <h2 id="loader-heading">Paste Or Open Build JSON</h2>
          </div>
          <div className="loader-actions">
            <button
              type="button"
              onClick={pasteFromClipboard}
              disabled={!validateBuildGuide}
            >
              Paste + Load
            </button>
            <button
              type="button"
              onClick={() => loadJsonText(jsonText, 'Text area JSON')}
              disabled={!validateBuildGuide}
            >
              Load Text
            </button>
            <button
              type="button"
              onClick={loadDemoBuild}
              disabled={!validateBuildGuide}
            >
              Load Demo
            </button>
            <button
              type="button"
              onClick={() => loadJsonText(defaultJsonText, 'Bundled sample')}
              disabled={!validateBuildGuide}
            >
              Reset Sample
            </button>
            <label className="file-button">
              Open File
              <input
                type="file"
                accept="application/json,.json"
                onChange={loadFile}
                disabled={!validateBuildGuide}
              />
            </label>
          </div>
        </div>

        <textarea
          className="json-input"
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          spellCheck={false}
          aria-label="Build guide JSON"
        />

        <div className={`validation-status ${loaderStatus.tone}`} role="status">
          <p>{loaderStatus.message}</p>
          {loaderStatus.details ? (
            <ul>
              {loaderStatus.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <div className="content-grid">
        <section aria-labelledby="progression-heading">
          <div className="section-heading">
            <p>Guide</p>
            <h2 id="progression-heading">Progression Steps</h2>
          </div>

          <ol className="step-list">
            {buildGuide.guide.steps.map((step) => (
              <li className="step-card" key={`${step.stage}-${step.title}`}>
                <div className="step-kicker">
                  <span>{step.stage}</span>
                  <span>{step.range}</span>
                </div>
                <h3>{step.title}</h3>
                <ul>
                  {step.goals.map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
                <div className="step-actions">
                  {step.actions.map((action) => (
                    <p key={action}>{action}</p>
                  ))}
                </div>
                {step.notes ? <p className="step-note">{step.notes}</p> : null}
              </li>
            ))}
          </ol>
        </section>

        <aside className="side-panel" aria-labelledby="gear-heading">
          <div className="section-heading compact">
            <p>{buildGuide.schemaVersion}</p>
            <h2 id="gear-heading">Guide State</h2>
          </div>

          <div className="mini-section">
            <h3>Rotation</h3>
            <p>{buildGuide.guide.rotation.summary}</p>
          </div>

          <div className="mini-section">
            <h3>Skills</h3>
            <ul className="compact-list">
              {buildGuide.skills.loadout.map((skill) => (
                <li key={skill.name}>
                  <span>{skill.name}</span>
                  <small>{skill.role}</small>
                </li>
              ))}
            </ul>
          </div>

          <div className="mini-section">
            <h3>Gear Priorities</h3>
            <dl className="gear-list">
              {buildGuide.gear.statPriorities.map((item) => (
                <div className="gear-row" key={item.stat}>
                  <dt>{item.stat}</dt>
                  <dd>{item.reason ?? item.priority}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="updated">
            {buildGuide.updated
              ? `Updated ${buildGuide.updated}`
              : `Build ID ${buildGuide.id}`}
          </p>
        </aside>
      </div>
    </main>
  )
}

export default App
