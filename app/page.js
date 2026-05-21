'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Loader, Mars, Venus } from 'lucide-react'
import FEMALE_MODEL from '../lib/model_parameters_female.json'
import MALE_MODEL from '../lib/model_parameters_male.json'

const FEMALE = 'female'
const MALE = 'male'
const MIN_LEN = 2
const MAX_LEN = 12
const LOADER_DEBOUNCE_MS = 120
const INITIAL_LOAD_MIN_MS = 500

const MODELS = {
  [FEMALE]: {
    model: FEMALE_MODEL,
    hiddenSize: FEMALE_MODEL.Wxh.length,
    vocabSize: FEMALE_MODEL.vocab_size,
    endTokenIndex: FEMALE_MODEL.char_to_ix['\n'],
  },
  [MALE]: {
    model: MALE_MODEL,
    hiddenSize: MALE_MODEL.Wxh.length,
    vocabSize: MALE_MODEL.vocab_size,
    endTokenIndex: MALE_MODEL.char_to_ix['\n'],
  },
}

const GENDER_OPTIONS = [
  { id: FEMALE, icon: Venus, label: 'Female' },
  { id: MALE, icon: Mars, label: 'Male' },
]

function sample(logits) {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i]
  }

  let total = 0
  const probs = new Float64Array(logits.length)
  for (let i = 0; i < logits.length; i++) {
    const p = Math.exp(logits[i] - max)
    probs[i] = p
    total += p
  }

  let pick = Math.random() * total
  let acc = 0
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i]
    if (pick <= acc) return i
  }
  return probs.length - 1
}

function step(hidden, xIndex, runtime) {
  const { model, hiddenSize } = runtime
  const nextHidden = new Float64Array(hiddenSize)

  for (let h = 0; h < hiddenSize; h++) {
    let value = model.bh[h][0] + model.Wxh[h][xIndex]
    const row = model.Whh[h]
    for (let j = 0; j < hiddenSize; j++) {
      value += row[j] * hidden[j]
    }
    nextHidden[h] = Math.tanh(value)
  }

  const logits = new Float64Array(runtime.vocabSize)
  for (let k = 0; k < runtime.vocabSize; k++) {
    let value = model.by[k][0]
    const row = model.Why[k]
    for (let j = 0; j < hiddenSize; j++) {
      value += row[j] * nextHidden[j]
    }
    logits[k] = value
  }

  return { nextHidden, logits }
}

function makeDisplayName(raw) {
  if (!raw) return ''
  return raw
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-')
}

function generate(runtime) {
  if (!runtime || runtime.endTokenIndex === undefined) return ''

  for (let attempt = 0; attempt < 80; attempt++) {
    const hidden = new Float64Array(runtime.hiddenSize)
    let xIndex = runtime.endTokenIndex
    const chars = []

    for (let t = 0; t < MAX_LEN; t++) {
      const { nextHidden, logits } = step(hidden, xIndex, runtime)
      hidden.set(nextHidden)
      xIndex = sample(logits)

      if (xIndex === runtime.endTokenIndex) break

      const nextChar = runtime.model.ix_to_char[xIndex]
      chars.push(nextChar)
      if (chars.length === MAX_LEN) break
    }

    if (chars.length >= MIN_LEN && chars.length <= MAX_LEN) {
      return makeDisplayName(chars.join(''))
    }
  }

  return ''
}

export default function Home() {
  const [name, setName] = useState('')
  const [activeGender, setActiveGender] = useState(FEMALE)
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(true)
  const copyTimeoutRef = useRef(null)
  const generationFrameRef = useRef(null)
  const generationLoaderRef = useRef(null)
  const generationRevealRef = useRef(null)
  const canCopyRef = useRef(false)
  const nameRef = useRef(name)
  const generationRunId = useRef(0)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    nameRef.current = name
    canCopyRef.current = !isGenerating && Boolean(name) && name !== 'No result'
  }, [name, isGenerating])

  const copyName = useCallback(async () => {
    if (!canCopyRef.current) return
    try {
      await navigator.clipboard.writeText(nameRef.current)
      setCopied(true)

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }

      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 1000)
    } catch (error) {
      // Clipboard API may be unavailable in some environments.
    }
  }, [])

  const generateAndSet = useCallback((runtime, options = {}) => {
    const showSpinnerForMinimum = options.showSpinnerForMinimum ?? false
    generationRunId.current += 1
    const run = generationRunId.current

    setIsGenerating(showSpinnerForMinimum ? true : false)

    const startTime = Date.now()

    if (generationFrameRef.current) {
      cancelAnimationFrame(generationFrameRef.current)
    }
    if (generationLoaderRef.current) {
      clearTimeout(generationLoaderRef.current)
      generationLoaderRef.current = null
    }
    if (generationRevealRef.current) {
      clearTimeout(generationRevealRef.current)
      generationRevealRef.current = null
    }

    generationFrameRef.current = requestAnimationFrame(() => {
      if (run !== generationRunId.current) return

      const value = generate(runtime)
      const finish = () => {
        if (run !== generationRunId.current) return

        setName(value || 'No result')
        setIsGenerating(false)

        if (generationLoaderRef.current) {
          clearTimeout(generationLoaderRef.current)
          generationLoaderRef.current = null
        }
        if (generationRevealRef.current) {
          clearTimeout(generationRevealRef.current)
          generationRevealRef.current = null
        }
      }

      if (showSpinnerForMinimum) {
        const elapsed = Date.now() - startTime
        const delay = INITIAL_LOAD_MIN_MS - elapsed
        if (delay > 0) {
          generationRevealRef.current = setTimeout(finish, delay)
          return
        }
      }

      finish()
    })

    if (!showSpinnerForMinimum) {
      generationLoaderRef.current = setTimeout(() => {
        if (run !== generationRunId.current) return
        setIsGenerating(true)
      }, LOADER_DEBOUNCE_MS)
    }
  }, [])

  useEffect(() => {
    const runtime = MODELS[activeGender]
    const activeIndex = GENDER_OPTIONS.findIndex((option) => option.id === activeGender)
    const isFirstLoad = !hasInitializedRef.current

    if (isFirstLoad) {
      generateAndSet(runtime, { showSpinnerForMinimum: true })
      hasInitializedRef.current = true
    } else {
      // On explicit gender switches, generate without the long initial spinner.
      generateAndSet(runtime)
    }

    const switchGender = (direction) => {
      const nextIndex = (activeIndex + direction + GENDER_OPTIONS.length) % GENDER_OPTIONS.length
      const nextGender = GENDER_OPTIONS[nextIndex].id
      if (nextGender === activeGender) return

      setActiveGender(nextGender)
    }

    const onKeyDown = (event) => {
      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        switchGender(-1)
        return
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault()
        switchGender(1)
        return
      }

      if (event.code === 'Enter' || event.key === 'Enter') {
        event.preventDefault()
        copyName()
        return
      }

      if (event.code !== 'Space' && event.key !== ' ') return
      event.preventDefault()
      generateAndSet(runtime)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeGender, generateAndSet])

  useEffect(() => {
    const runtime = MODELS[activeGender]
    const isInteractiveTarget = (target) => target.closest('button') !== null || target.closest('.gender-switch') !== null

    const onPointerUp = (event) => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
      if (!(event.target instanceof Element)) return
      if (isInteractiveTarget(event.target)) return

      event.preventDefault()
      generateAndSet(runtime)
    }

    window.addEventListener('pointerup', onPointerUp, { passive: false })
    return () => window.removeEventListener('pointerup', onPointerUp)
  }, [activeGender, generateAndSet])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }

      if (generationFrameRef.current) {
        cancelAnimationFrame(generationFrameRef.current)
      }

      if (generationLoaderRef.current) {
        clearTimeout(generationLoaderRef.current)
      }
      if (generationRevealRef.current) {
        clearTimeout(generationRevealRef.current)
      }
    }
  }, [])

  return (
    <main className="page">
      <h1 className="title">Orc Name Generator</h1>
      <div className="name-text" aria-live={isGenerating || name ? 'polite' : 'off'}>
        {isGenerating ? (
          <Loader className="name-loader" size={56} strokeWidth={2.2} />
        ) : (
          name || <span className="name-placeholder" aria-hidden="true">orclord</span>
        )}
      </div>
      <div className="hint">
        <span className="hint-action hint-action-desktop">
          Press <span className="hint-key">SPACE</span> to generate another
        </span>
        <span className="hint-action hint-action-touch">
          <span className="hint-key">TAP</span> to generate another
        </span>
      </div>
      <div className="gender-switch" aria-label="Name gender">
        {GENDER_OPTIONS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className={`gender-btn ${activeGender === id ? 'active' : ''}`}
            aria-label={label}
            onClick={() => setActiveGender(id)}
            title={`${label} names`}
          >
            <Icon size={32} strokeWidth={2.2} />
          </button>
        ))}
        <button
          type="button"
          className={`copy-btn ${copied ? 'active' : ''}`}
          onClick={copyName}
          title="Copy name"
          aria-label="Copy generated name"
        >
          {copied ? <Check size={28} strokeWidth={2.2} /> : <Copy size={28} strokeWidth={2.2} />}
        </button>
      </div>
    </main>
  )
}
