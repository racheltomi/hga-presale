// Time left until a moment, as the whole days, hours, minutes and seconds a
// countdown shows. Zero everywhere once the moment has passed.
export function countdownParts(msRemaining) {
  const total = Math.max(0, Math.floor(msRemaining / 1000))

  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60
  }
}

// Milliseconds left until `until` on the server's clock: the server's time
// when it rendered the page, advanced by how long the page has been open. The
// visitor's clock is read only for elapsed time, since it may be set wrong and
// the server's clock is the one that decides which state the page shows.
export function remainingMs({ until, serverNow, openedAt, now }) {
  return until - (serverNow + (now - openedAt))
}

// True when the time left went from above zero to zero or below between two
// readings: the moment has passed while the page was open.
export function crossedZero(before, after) {
  return before > 0 && after <= 0
}
