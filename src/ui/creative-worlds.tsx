import { createContext, useContext, useEffect, useRef, type CSSProperties, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode, type RefObject } from 'react'
import { gsap } from 'gsap'

type CreativeWorldKind = 'present' | 'film' | 'instrument' | 'registry'

interface PointerPosition {
  x: number
  y: number
}

const PointerContext = createContext<MutableRefObject<PointerPosition> | null>(null)

const vertexSource = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const fragmentSource = `
precision mediump float;
uniform float u_time;
uniform vec2 u_pointer;
uniform vec2 u_resolution;
uniform float u_progress;
uniform float u_mode;
varying vec2 v_uv;

float lineGlow(float value, float width) {
  return smoothstep(width, 0.0, abs(value));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 presentField(vec2 uv, vec2 pointer, float time) {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 center = vec2(aspect * 0.52, 0.48);
  vec2 q = p - center;
  float radius = length(q);
  float angle = atan(q.y, q.x);
  float rings = 0.5 + 0.5 * sin(radius * 42.0 - time * 0.48 + sin(angle * 4.0) * 0.8);
  rings *= smoothstep(1.15, 0.1, radius);
  float horizon = lineGlow(q.y + sin(q.x * 5.0 + time * 0.2) * 0.025, 0.0035);
  vec2 cursor = vec2(pointer.x * aspect, 1.0 - pointer.y) - p;
  float lens = exp(-length(cursor) * 8.0);
  float flare = pow(max(0.0, cos(atan(cursor.y, cursor.x) - time * 0.07)), 12.0) * lens;
  float grain = hash21(floor(uv * u_resolution * 0.18) + floor(time * 0.5)) * 0.025;
  vec3 ink = vec3(0.012, 0.018, 0.019);
  vec3 teal = vec3(0.04, 0.34, 0.28) * rings * 0.85;
  vec3 amber = vec3(0.74, 0.30, 0.10) * flare;
  vec3 pearl = vec3(0.72, 0.63, 0.46) * horizon * 0.48;
  return ink + teal + amber + pearl + grain;
}

vec3 instrumentField(vec2 uv, vec2 pointer, float time) {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 origin = vec2(aspect * 0.56, 0.49);
  vec2 q = p - origin;
  float radius = length(q);
  float ringA = lineGlow(radius - 0.28, 0.0025);
  float ringB = lineGlow(radius - 0.39, 0.0015);
  float ringC = lineGlow(radius - 0.53, 0.0012);
  float angle = atan(q.y, q.x);
  float ticks = 0.0;
  for (int i = 0; i < 36; i++) {
    float tickAngle = -3.1415926 + float(i) * 0.1745329;
    ticks += lineGlow(sin((angle - tickAngle) * 18.0) * 0.006, i % 3 == 0 ? 0.003 : 0.0015) * smoothstep(0.62, 0.4, radius);
  }
  vec2 cursor = vec2(pointer.x * aspect, 1.0 - pointer.y) - p;
  float reticle = lineGlow(cursor.x, 0.0017) + lineGlow(cursor.y, 0.0017);
  float pointerRing = lineGlow(length(cursor) - 0.07, 0.002);
  float sweep = lineGlow(angle - (-2.8 + u_progress * 5.6), 0.012) * smoothstep(0.66, 0.18, radius);
  float scan = lineGlow(q.y - sin(q.x * 2.0 + time * 0.1) * 0.01, 0.0012) * 0.22;
  vec3 base = vec3(0.008, 0.018, 0.017);
  vec3 steel = vec3(0.30, 0.40, 0.35) * (ringA * 0.45 + ringB * 0.28 + ringC * 0.2 + ticks * 0.5);
  vec3 orange = vec3(0.92, 0.28, 0.10) * (sweep * 0.9 + reticle * 0.14 + pointerRing * 0.22);
  return base + steel + orange + vec3(0.12, 0.20, 0.16) * scan;
}
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('Memento visual shader compile failed', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function ShaderCanvas({ mode, progress }: { mode: 'present' | 'instrument'; progress: number }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointer = useContext(PointerContext)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pointer) return
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'high-performance' })
    if (!gl) {
      canvas.dataset.fallback = 'true'
      return
    }
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_pointer;
      uniform vec2 u_resolution;
      uniform float u_progress;
      uniform float u_mode;
      varying vec2 v_uv;
      ${lineGlowSource}
      ${hashSource}
      ${presentFieldSource}
      ${instrumentFieldSource}
      void main() {
        vec3 color = u_mode < 0.5 ? presentField(v_uv, u_pointer, u_time) : instrumentField(v_uv, u_pointer, u_time);
        gl_FragColor = vec4(color, 0.96);
      }
    `)
    if (!vertex || !fragment) {
      canvas.dataset.fallback = 'true'
      return
    }
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('Memento visual shader link failed', gl.getProgramInfoLog(program))
      canvas.dataset.fallback = 'true'
      return
    }
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_position')
    const timeUniform = gl.getUniformLocation(program, 'u_time')
    const pointerUniform = gl.getUniformLocation(program, 'u_pointer')
    const resolutionUniform = gl.getUniformLocation(program, 'u_resolution')
    const progressUniform = gl.getUniformLocation(program, 'u_progress')
    const modeUniform = gl.getUniformLocation(program, 'u_mode')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame: number | null = null
    let start = performance.now()

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio))
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }

    const render = (now: number) => {
      resize()
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      gl.uniform1f(timeUniform, reduced.matches ? 0 : (now - start) / 1000)
      gl.uniform2f(pointerUniform, pointer.current.x, pointer.current.y)
      gl.uniform2f(resolutionUniform, canvas.width, canvas.height)
      gl.uniform1f(progressUniform, Math.min(1, Math.max(0, progress / 100)))
      gl.uniform1f(modeUniform, mode === 'present' ? 0 : 1)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (!reduced.matches) frame = window.requestAnimationFrame(render)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    render(performance.now())
    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    }
  }, [mode, pointer, progress])

  return <canvas ref={canvasRef} className={`world-v30-shader world-v30-shader--${mode}`} aria-hidden="true" />
}

const lineGlowSource = `float lineGlow(float value, float width) { return smoothstep(width, 0.0, abs(value)); }`
const hashSource = `float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`
const presentFieldSource = `vec3 presentField(vec2 uv, vec2 pointer, float time) { float aspect = u_resolution.x / max(u_resolution.y, 1.0); vec2 p = vec2(uv.x * aspect, uv.y); vec2 q = p - vec2(aspect * 0.52, 0.48); vec2 cursor = vec2(pointer.x * aspect, 1.0 - pointer.y) - p; float cursorDistance = length(cursor); float halo = exp(-cursorDistance * 3.8); float lens = exp(-cursorDistance * 12.0); float horizon = lineGlow(q.y - 0.51 - sin(q.x * 2.2 + time * 0.12) * 0.018, 0.0032); float horizonGlow = exp(-abs(q.y - 0.51 - sin(q.x * 2.2 + time * 0.12) * 0.018) * 8.0); float filament = lineGlow(q.y - q.x * 0.09 - 0.18, 0.0025) * smoothstep(0.95, 0.18, abs(q.x)); float grain = hash21(floor(uv * u_resolution * 0.18)) * 0.012; vec3 ink = vec3(0.012, 0.018, 0.019); vec3 teal = vec3(0.035, 0.20, 0.17) * halo * 0.62; vec3 amber = vec3(0.74, 0.30, 0.10) * lens * 0.42; vec3 pearl = vec3(0.72, 0.63, 0.46) * (horizon * 0.35 + horizonGlow * 0.018 + filament * 0.22); return ink + teal + amber + pearl + grain; }`
const instrumentFieldSource = `vec3 instrumentField(vec2 uv, vec2 pointer, float time) { float aspect = u_resolution.x / max(u_resolution.y, 1.0); vec2 p = vec2(uv.x * aspect, uv.y); vec2 origin = vec2(aspect * 0.56, 0.49); vec2 q = p - origin; float radius = length(q); float ringA = lineGlow(radius - 0.28, 0.0025); float ringB = lineGlow(radius - 0.39, 0.0015); float ringC = lineGlow(radius - 0.53, 0.0012); float angle = atan(q.y, q.x); float ticks = 0.0; for (int i = 0; i < 36; i++) { float tickAngle = -3.1415926 + float(i) * 0.1745329; float tickWidth = mod(float(i), 3.0) == 0.0 ? 0.014 : 0.008; ticks += lineGlow(sin(angle - tickAngle), tickWidth) * smoothstep(0.60, 0.51, radius) * smoothstep(0.34, 0.43, radius); } vec2 cursor = vec2(pointer.x * aspect, 1.0 - pointer.y) - p; float reticle = lineGlow(cursor.x, 0.0017) + lineGlow(cursor.y, 0.0017); float pointerRing = lineGlow(length(cursor) - 0.07, 0.002); float sweep = lineGlow(angle - (-2.8 + u_progress * 5.6), 0.012) * smoothstep(0.66, 0.18, radius); float scan = lineGlow(q.y - sin(q.x * 2.0 + time * 0.1) * 0.01, 0.0012) * 0.22; vec3 base = vec3(0.008, 0.018, 0.017); vec3 steel = vec3(0.30, 0.40, 0.35) * (ringA * 0.22 + ringB * 0.15 + ringC * 0.12 + ticks * 0.035); vec3 orange = vec3(0.92, 0.28, 0.10) * (sweep * 0.32 + reticle * 0.08 + pointerRing * 0.12); return base + steel + orange + vec3(0.12, 0.20, 0.16) * scan; }`

function WorldAtmosphere({ kind, progress, filmFocusRef }: { kind: CreativeWorldKind; progress: number; filmFocusRef: RefObject<HTMLSpanElement | null> }): ReactElement {
  if (kind === 'present') return <div className="world-v30-atmosphere"><ShaderCanvas mode="present" progress={progress} /><span className="world-v30-vignette" aria-hidden="true" /></div>
  if (kind === 'instrument') return <div className="world-v30-atmosphere"><ShaderCanvas mode="instrument" progress={progress} /><span className="world-v30-instrument-etch" aria-hidden="true" /></div>
  if (kind === 'film') return <div className="world-v30-atmosphere world-v30-atmosphere--film"><span className="film30-sheen" aria-hidden="true" /><span ref={filmFocusRef} className="film30-focus" aria-hidden="true" /><svg className="film30-arc" viewBox="0 0 900 700" preserveAspectRatio="none" aria-hidden="true"><path d="M-80 610 C260 420 520 430 980 80" /><path d="M-130 680 C250 490 610 520 1020 200" /></svg></div>
  return <div className="world-v30-atmosphere world-v30-atmosphere--registry"><span className="registry30-ink-pool" aria-hidden="true" /><svg className="registry30-thread" viewBox="0 0 900 700" preserveAspectRatio="none" aria-hidden="true"><path d="M-20 160 C190 40 280 320 520 210 S720 80 940 180" /><path d="M-60 590 C190 470 320 660 560 510 S760 430 970 560" /></svg></div>
}

export function CreativeWorld({ kind, progress = 0, children }: { kind: CreativeWorldKind; progress?: number; children: ReactNode }): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const filmFocusRef = useRef<HTMLSpanElement>(null)
  const frameRef = useRef<number | null>(null)
  const targetRef = useRef<PointerPosition>({ x: 0.5, y: 0.5 })
  const pointerRef = useRef<PointerPosition>({ x: 0.5, y: 0.5 })

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || kind !== 'film' || !filmFocusRef.current) return
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.set(filmFocusRef.current, { opacity: 0.15 })
    })
    return () => media.revert()
  }, [kind])

  const renderPointer = () => {
    const root = rootRef.current
    if (!root) {
      frameRef.current = null
      return
    }
    const current = pointerRef.current
    const target = targetRef.current
    current.x += (target.x - current.x) * 0.11
    current.y += (target.y - current.y) * 0.11
    root.style.setProperty('--pointer-x', `${current.x * root.clientWidth}px`)
    root.style.setProperty('--pointer-y', `${current.y * root.clientHeight}px`)
    if (Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001) frameRef.current = window.requestAnimationFrame(renderPointer)
    else frameRef.current = null
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    targetRef.current = { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) }
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(renderPointer)
  }

  const handlePointerLeave = () => {
    targetRef.current = { x: 0.5, y: 0.5 }
    if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(renderPointer)
    if (kind === 'film' && filmFocusRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.to(filmFocusRef.current, { opacity: 0.15, duration: 0.35, ease: 'power3.out' })
  }

  const handlePointerEnter = () => {
    if (kind === 'film' && filmFocusRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.to(filmFocusRef.current, { opacity: 0.75, duration: 0.28, ease: 'power3.out' })
  }

  return <div ref={rootRef} className={`world-v30-stage world-v30-stage--${kind}`} data-world-effect={kind} onPointerMove={handlePointerMove} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} style={{ '--pointer-x': '50%', '--pointer-y': '50%' } as CSSProperties}><PointerContext.Provider value={pointerRef}><WorldAtmosphere kind={kind} progress={progress} filmFocusRef={filmFocusRef} /><div className="world-v30-content">{children}</div></PointerContext.Provider></div>
}
