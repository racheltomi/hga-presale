// hybridgrading.com's entry point. The HGA pages are a marketing site, so they
// load Stimulus and their own controllers rather than ucollect's application.js.
import { Application } from "@hotwired/stimulus"
import CopyLinkController from "hybrid_grading/controllers/copy_link_controller"
import CountdownController from "hybrid_grading/controllers/countdown_controller"
import HousingController from "hybrid_grading/controllers/housing_controller"
import MenuController from "hybrid_grading/controllers/menu_controller"
import SlabController from "hybrid_grading/controllers/slab_controller"

const application = Application.start()
application.register("hybrid-grading--copy-link", CopyLinkController)
application.register("hybrid-grading--countdown", CountdownController)
application.register("hybrid-grading--housing", HousingController)
application.register("hybrid-grading--menu", MenuController)
application.register("hybrid-grading--slab", SlabController)
