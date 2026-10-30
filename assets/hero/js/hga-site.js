// HGA redesign entry: the live site's Stimulus app with the slab controller
// swapped for the idle sway version (same identifier, so markup is unchanged).
import { Application } from "@hotwired/stimulus"
import SlabSwayController from "hga/slab_sway_controller"

const application = Application.start()
application.register("hybrid-grading--slab", SlabSwayController)
