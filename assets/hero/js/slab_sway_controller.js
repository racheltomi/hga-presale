import SlabController from "hybrid_grading/controllers/slab_controller"

// HGA redesign: the live site's slab controller, plus an idle sway.
// Until someone drags it (or turns it with the arrow keys), a slab marked
// sway turns gently back and forth in 3D and floats a few pixels, so it reads
// as something you can pick up. The first touch stops the sway for good and
// hands control to the original drag behaviour, unchanged. The sway pauses
// while the slab is off screen; reduced motion viewers never get the 3D scene,
// so they never get the sway either.
const SWAY_DEGREES = 14
const SWAY_SECONDS = 6.5
const FLOAT_PIXELS = 6

export default class extends SlabController {
  static values = { sway: Boolean }

  connect() {
    super.connect()
    if (!this.swayValue || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    this.visible = true
    this.watch = new IntersectionObserver((entries) => {
      this.visible = entries.some((entry) => entry.isIntersecting)
      if (this.visible) this.spin()
      else cancelAnimationFrame(this.frame)
    })
    this.watch.observe(this.element)
  }

  disconnect() {
    this.watch?.disconnect()
    super.disconnect()
  }

  spin() {
    if (!this.swayValue || this.touched) return super.spin()
    cancelAnimationFrame(this.frame)
    if (!this.scene || this.visible === false) return

    this.swayStart ??= performance.now()
    const frame = (now) => {
      if (this.touched) return
      const phase = ((now - this.swayStart) / 1000) * (2 * Math.PI / SWAY_SECONDS)
      this.angle = Math.sin(phase) * SWAY_DEGREES
      this.scene.render(this.angle)
      this.element.style.transform = `translateY(${(-Math.sin(phase * 2) * FLOAT_PIXELS).toFixed(2)}px)`
      this.frame = requestAnimationFrame(frame)
    }
    this.frame = requestAnimationFrame(frame)
  }

  grab(event) {
    this.settle()
    super.grab(event)
  }

  nudge(event) {
    this.settle()
    super.nudge(event)
  }

  settle() {
    if (this.touched || !this.swayValue) return
    this.touched = true
    cancelAnimationFrame(this.frame)
    this.watch?.disconnect()
    this.element.style.transition = "transform .5s ease"
    this.element.style.transform = ""
    this.element.classList.add("is-touched")
  }
}
