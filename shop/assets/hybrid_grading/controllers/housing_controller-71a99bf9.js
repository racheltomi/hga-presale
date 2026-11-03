import { Controller } from "@hotwired/stimulus"

// The pre-sale hero's price tiles pick the housing its slab spins in
// (hybrid_grading/pages/presale): pressed, a tile shows its housing's slab
// and hides the other's. A hidden slab is never drawn, so HGA Poly's fetches
// nothing until its tile is first pressed (hybrid-grading--slab).
export default class extends Controller {
  static targets = ["tile", "slab"]

  show({ currentTarget }) {
    const { housing } = currentTarget.dataset

    this.tileTargets.forEach((tile) => tile.setAttribute("aria-pressed", tile.dataset.housing === housing))
    this.slabTargets.forEach((slab) => { slab.hidden = slab.dataset.housing !== housing })
  }
}
