import { Controller } from "@hotwired/stimulus"

// The Grade Report's share row: Copy link puts the report's link on the
// clipboard and flashes "Copied". Where the clipboard is unavailable or
// refuses, the link is selected instead, ready to copy by hand.
//
// Targets: url (the link as text, without the scheme), copied (the flash)
// Actions: copy on the Copy link button
export default class extends Controller {
  static targets = ["url", "copied"]

  copy() {
    const link = `https://${this.urlTarget.textContent.trim()}`

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => this.flash(), () => this.select())
    } else {
      this.select()
    }
  }

  flash() {
    this.copiedTarget.hidden = false
    setTimeout(() => { this.copiedTarget.hidden = true }, 1800)
  }

  select() {
    const range = document.createRange()
    const selection = window.getSelection()

    range.selectNodeContents(this.urlTarget)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}
