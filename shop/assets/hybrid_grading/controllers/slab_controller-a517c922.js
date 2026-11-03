import { Controller } from "@hotwired/stimulus"

const DEGREES_PER_PIXEL = 0.5
const DEGREES_PER_KEY = 15
const SECONDS_PER_TURN = 12

// Turns the slab (hybrid_grading/shared/_spinning_slab) as the viewer asks:
// dragged across, it follows the pointer (drawn leftward, the front face moves
// left); with focus, the arrow keys turn it a step. A slab set to spin also
// turns on its own, a turn every SECONDS_PER_TURN, its front face moving left
// (or right, when its direction says so), while it is in sight and not held,
// carrying on from wherever it is let go; any other rests
// where it is let go, and its hint shows once it is drawn and goes once it is
// first turned.
// three.js and the scene load only once a slab is first in sight (a hidden
// one, like the pre-sale hero's HGA Poly slab until its tile is pressed,
// fetches nothing), and not at all for viewers who ask for reduced motion,
// who keep the drawn slab picture; so does anyone whose browser cannot draw
// it, and anyone whose browser takes the drawing away (short of memory, or the
// tab left in the background) until it gives it back.
export default class extends Controller {
  static targets = ["canvas"]
  static values = {
    model: String, caseFront: String, caseBack: String,
    cardFront: String, cardBack: String, cardCornerRadius: Number, labelFront: String, labelBack: String,
    spin: Boolean, direction: { type: String, default: "left" }
  }

  // A slab set to spin stays watched, so it stops turning while out of sight.
  connect() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    this.sight = new IntersectionObserver((entries) => {
      this.inSight = entries.some((entry) => entry.isIntersecting)
      if (!this.inSight) return cancelAnimationFrame(this.frame)

      if (!this.spinValue) this.sight.disconnect()
      this.drawing ??= this.draw()
      this.spin()
    })
    this.sight.observe(this.element)
  }

  async draw() {
    try {
      const { createSlabScene } = await import("hybrid_grading/slab_scene")
      this.scene = await createSlabScene(this.canvasTarget, {
        model: this.modelValue, caseFront: this.caseFrontValue, caseBack: this.caseBackValue,
        cardFront: this.cardFrontValue, cardBack: this.cardBackValue,
        labelFront: this.labelFrontValue, labelBack: this.labelBackValue
      }, this.cardCornerRadiusValue)
    } catch (error) {
      console.error("hybrid-grading--slab: could not draw the slab", error)
      return
    }
    if (!this.element.isConnected) return this.scene.dispose()

    // Front-on, as the slab picture over it shows it, so the picture fades
    // out into the drawing without the slab moving.
    this.angle = 0
    this.scene.render(this.angle)
    this.element.classList.add("is-drawn")
    this.element.tabIndex = 0
    this.spin()
  }

  disconnect() {
    cancelAnimationFrame(this.frame)
    this.sight?.disconnect()
    this.scene?.dispose()
  }

  // Turns a slab set to spin frame by frame, at its pace whatever the frame
  // rate, while it is drawn and in sight; held, it turns only as dragged.
  // The angle falls as the front face moves left (slab_scene's render turns
  // about the upright axis, a rising angle moving the front face right).
  spin() {
    cancelAnimationFrame(this.frame)
    if (!this.spinValue || !this.scene || !this.inSight) return

    const degreesPerSecond = (360 / SECONDS_PER_TURN) * (this.directionValue === "right" ? 1 : -1)
    let last = null
    const frame = (now) => {
      if (!this.grabbed) {
        this.angle += ((now - (last ?? now)) / 1000) * degreesPerSecond
        this.scene.render(this.angle)
      }
      last = now
      this.frame = requestAnimationFrame(frame)
    }
    this.frame = requestAnimationFrame(frame)
  }

  // The canvas goes blank when the browser takes its drawing away.
  lose() {
    this.element.classList.remove("is-drawn")
  }

  // Given back, the scene draws itself again (hybrid_grading/slab_scene).
  restore() {
    if (this.scene) this.element.classList.add("is-drawn")
  }

  grab(event) {
    if (!this.scene) return

    this.grabbed = { x: event.clientX, angle: this.angle }
    this.element.setPointerCapture(event.pointerId)
  }

  drag(event) {
    if (!this.grabbed) return

    this.turnTo(this.grabbed.angle + (event.clientX - this.grabbed.x) * DEGREES_PER_PIXEL)
  }

  drop() {
    this.grabbed = null
  }

  nudge(event) {
    const step = { ArrowLeft: -DEGREES_PER_KEY, ArrowRight: DEGREES_PER_KEY }[event.key]
    if (!step || !this.scene) return

    event.preventDefault()
    this.turnTo(this.angle + step)
  }

  turnTo(angle) {
    this.angle = angle
    this.scene.render(angle)
    this.element.classList.add("is-turned")
  }
}
