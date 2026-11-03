import { Controller } from "@hotwired/stimulus"
import { countdownParts, crossedZero, remainingMs } from "hybrid_grading/countdown"

// Counts down to a pre-sale boundary (the open, or the close) in boxed
// figures, on the server's clock. The server renders each state's page, so
// when the moment passes while the page is open it reloads. A page rendered
// after its moment shows zeros and stays put.
//
// Values: until (String) — ISO 8601 instant; now (String) — the server's time
//   when it rendered the page, ISO 8601
// Targets: days, hours, minutes, seconds (seconds is optional)
export default class extends Controller {
  static values = { until: String, now: String }
  static targets = ["days", "hours", "minutes", "seconds"]

  connect() {
    this.openedAt = Date.now()
    this.remaining = this.timeLeft()
    this.write(this.remaining)

    if (this.remaining > 0) this.timer = setInterval(() => this.tick(), 1000)
  }

  disconnect() {
    clearInterval(this.timer)
  }

  tick() {
    const remaining = this.timeLeft()

    this.write(remaining)

    if (crossedZero(this.remaining, remaining)) {
      clearInterval(this.timer)
      window.location.reload()
    }

    this.remaining = remaining
  }

  timeLeft() {
    return remainingMs({
      until: Date.parse(this.untilValue),
      serverNow: Date.parse(this.nowValue),
      openedAt: this.openedAt,
      now: Date.now()
    })
  }

  write(remaining) {
    const parts = countdownParts(remaining)

    this.daysTargets.forEach((el) => this.pad(el, parts.days))
    this.hoursTargets.forEach((el) => this.pad(el, parts.hours))
    this.minutesTargets.forEach((el) => this.pad(el, parts.minutes))
    this.secondsTargets.forEach((el) => this.pad(el, parts.seconds))
  }

  pad(el, value) {
    el.textContent = String(value).padStart(2, "0")
  }
}
