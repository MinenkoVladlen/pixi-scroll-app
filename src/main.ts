import './style.css'
import {
  Application,
  Container,
  FederatedPointerEvent,
  FederatedWheelEvent,
  Graphics,
  Rectangle,
} from 'pixi.js'

const app = new Application()

await app.init({
  resizeTo: window,
  background: '#d3d3d3',
  antialias: true,
})

document.body.appendChild(app.canvas)

const fullscreenButton = document.querySelector<HTMLButtonElement>('#fullscreen-button')

fullscreenButton?.addEventListener('click', async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
  } else {
    await document.documentElement.requestFullscreen()
  }
})

const ITEMS_COUNT = 15
const GAP = 20
const LONG_SIDE = 180
const SHORT_SIDE = 100
const PADDING = 20
const FRICTION = 0.92
const MIN_VELOCITY = 0.01
const VELOCITY_TIMEOUT = 100

const list = new Container()
const items: Graphics[] = []

for (let i = 0; i < ITEMS_COUNT; i++) {
  const item = new Graphics()

  items.push(item)
  list.addChild(item)
}

app.stage.addChild(list)

app.stage.eventMode = 'static'
app.stage.hitArea = app.screen

let isDragging = false
let lastPointerPosition = 0
let lastPointerTime = 0
let velocity = 0
let scrollProgress = 0

function getPointerPosition(event: FederatedPointerEvent) {
  const isLandscape = window.innerWidth > window.innerHeight

  return isLandscape ? event.global.x : event.global.y
}

function clampListPosition(position: number) {
  const isLandscape = window.innerWidth > window.innerHeight

  const viewportSize = isLandscape ? window.innerWidth : window.innerHeight
  const contentSize = isLandscape ? list.width : list.height

  const maxPosition = PADDING
  const minPosition = Math.min(PADDING, viewportSize - PADDING - contentSize)

  return Math.min(maxPosition, Math.max(minPosition, position))
}

function updateScrollProgress() {
  const isLandscape = window.innerWidth > window.innerHeight

  const viewportSize = isLandscape ? window.innerWidth : window.innerHeight
  const contentSize = isLandscape ? list.width : list.height

  const maxPosition = PADDING
  const minPosition = Math.min(PADDING, viewportSize - PADDING - contentSize)

  const currentPosition = isLandscape ? list.x : list.y
  const scrollRange = maxPosition - minPosition

  if (scrollRange === 0) {
    scrollProgress = 0
    return
  }

  scrollProgress = (maxPosition - currentPosition) / scrollRange
}

app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
  isDragging = true
  lastPointerPosition = getPointerPosition(event)
  lastPointerTime = performance.now()
  velocity = 0
})

app.stage.on('wheel', (event: FederatedWheelEvent) => {
  const isLandscape = window.innerWidth > window.innerHeight

  const wheelDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY

  if (isLandscape) {
    list.x = clampListPosition(list.x - wheelDelta)
  } else {
    list.y = clampListPosition(list.y - wheelDelta)
  }

  updateScrollProgress()
})

app.stage.on('globalpointermove', (event: FederatedPointerEvent) => {
  if (!isDragging) {
    return
  }

  const currentPointerPosition = getPointerPosition(event)
  const currentTime = performance.now()

  const delta = currentPointerPosition - lastPointerPosition
  const deltaTime = currentTime - lastPointerTime

  if (deltaTime > 0) {
    velocity = delta / deltaTime
  }

  const isLandscape = window.innerWidth > window.innerHeight

  if (isLandscape) {
    list.x = clampListPosition(list.x + delta)
  } else {
    list.y = clampListPosition(list.y + delta)
  }

  updateScrollProgress()

  lastPointerPosition = currentPointerPosition
  lastPointerTime = currentTime
})

function stopDragging() {
  isDragging = false

  const timeSinceLastMove = performance.now() - lastPointerTime

  if (timeSinceLastMove > VELOCITY_TIMEOUT) {
    velocity = 0
  }
}
app.stage.on('pointerup', stopDragging)
app.stage.on('pointerupoutside', stopDragging)
app.stage.on('pointercancel', stopDragging)

function layout() {
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  app.stage.hitArea = new Rectangle(0, 0, screenWidth, screenHeight)

  const isLandscape = screenWidth > screenHeight

  const itemWidth = isLandscape ? SHORT_SIDE : LONG_SIDE
  const itemHeight = isLandscape ? LONG_SIDE : SHORT_SIDE

  items.forEach((item, index) => {
    item.clear()

    item.roundRect(0, 0, itemWidth, itemHeight, 12).fill('#808080')

    if (isLandscape) {
      item.x = index * (itemWidth + GAP)
      item.y = 0
    } else {
      item.x = 0
      item.y = index * (itemHeight + GAP)
    }
  })

  if (isLandscape) {
    list.y = (screenHeight - itemHeight) / 2

    const maxPosition = PADDING
    const minPosition = Math.min(PADDING, screenWidth - PADDING - list.width)

    list.x = maxPosition - scrollProgress * (maxPosition - minPosition)
  } else {
    list.x = (screenWidth - itemWidth) / 2

    const maxPosition = PADDING
    const minPosition = Math.min(PADDING, screenHeight - PADDING - list.height)

    list.y = maxPosition - scrollProgress * (maxPosition - minPosition)
  }
}

app.ticker.add((ticker) => {
  if (isDragging || Math.abs(velocity) < MIN_VELOCITY) {
    return
  }

  const isLandscape = window.innerWidth > window.innerHeight
  const currentPosition = isLandscape ? list.x : list.y

  const nextPosition = currentPosition + velocity * ticker.deltaMS
  const clampedPosition = clampListPosition(nextPosition)

  if (isLandscape) {
    list.x = clampedPosition
  } else {
    list.y = clampedPosition
  }

  updateScrollProgress()

  if (clampedPosition !== nextPosition) {
    velocity = 0
    return
  }

  velocity *= Math.pow(FRICTION, ticker.deltaMS / (1000 / 60))
})

function handleResize() {
  isDragging = false
  velocity = 0

  layout()
}

layout()

window.addEventListener('resize', handleResize)
