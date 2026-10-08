import * as React from "react"

const MOBILE_BREAKPOINT = 768
const mediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const query = window.matchMedia(mediaQuery)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(mediaQuery).matches
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
