import { Controller } from "@hotwired/stimulus"

// The phone nav: the Menu button opens and closes the site nav.
export default class extends Controller {
  static targets = ["nav", "button"]

  toggle() {
    const open = this.navTarget.classList.toggle("open")

    this.buttonTarget.setAttribute("aria-expanded", String(open))
  }
}
