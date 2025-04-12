import init from 'aphex-rust'
import Two from 'two.js'
import { Vector } from 'two.js/src/vector'

import { Shape } from 'two.js/src/shape'
import { Downloader, SvgExporter } from './export'
import { Hull, HullCircle } from './hull'

const MIN_CIRCLE_RADIUS = 10
const MAX_CIRCLE_RADIUS = 200

class Scene {
    two: Two
    rootEl: HTMLElement

    hulls: Record<string, Hull> = {}
    _activeHull: Hull | null = null

    selectedHull: Hull | null = null
    selectedHullCircle: HullCircle | null = null

    mouseDownPosition: Vector | null = null

    constructor(rootEl: HTMLElement) {
        this.rootEl = rootEl

        this.two = new Two({
            fullscreen: true,
        }).appendTo(rootEl)

        this.addEventListeners()
    }

    get svgElement(): SVGElement {
        return this.two.renderer.domElement
    }

    addEventListeners() {
        this.rootEl.addEventListener('dblclick', ({ clientX, clientY }) => {
            this.addHullCircle(clientX, clientY)
        })

        let moveOffset: Vector | null = null
        let initialRadius: number | null = null

        // Update the mousemove event handler
        this.rootEl.addEventListener('mousemove', (event) => {
            if (!this.mouseDownPosition) {
                return
            }

            const { shiftKey } = event

            const mousePos = new Two.Vector(event.clientX, event.clientY)

            if (this.selectedHullCircle) {
                const circle = this.selectedHullCircle.circle

                // If shift key is pressed, resize the circle
                if (shiftKey) {
                    if (!initialRadius) {
                        initialRadius = circle.radius
                    }

                    const distance = this.mouseDownPosition.y - mousePos.y
                    const newRadius = initialRadius + distance

                    circle.radius = Math.min(
                        Math.max(newRadius, MIN_CIRCLE_RADIUS),
                        MAX_CIRCLE_RADIUS
                    )
                } else {
                    if (!moveOffset) {
                        moveOffset = Vector.sub(
                            circle.translation,
                            this.mouseDownPosition
                        )
                    }

                    // Normal mode - move circle
                    circle.translation = Vector.add(mousePos, moveOffset)
                }

                this.drawHull(this._activeHull!)
            } else if (this.selectedHull) {
                if (!moveOffset) {
                    moveOffset = Vector.sub(
                        this.selectedHull.group.translation,
                        this.mouseDownPosition
                    )
                }

                this.selectedHull.group.translation = Vector.add(
                    mousePos,
                    moveOffset
                )
            }

            this.two.update()
        })

        this.rootEl.addEventListener('mouseup', () => {
            if (this.selectedHullCircle) {
                const circleEl = document.getElementById(
                    this.selectedHullCircle.circle.id
                )
                if (circleEl) {
                    circleEl.classList.remove('active')
                }

                if (this._activeHull) {
                    if (
                        !this._activeHull.hasCircle(this.selectedHullCircle.id) &&
                        this.selectedHullCircle.isInside(this._activeHull)
                    ) {
                        this._activeHull.addHullCircle(this.selectedHullCircle)
                    }
                }

                this.selectedHullCircle = null
            }

            this.selectedHull = null

            moveOffset = null
            initialRadius = null
            this.mouseDownPosition = null
        })

        this.rootEl.addEventListener('mousedown', (event) => {
            const { clientX, clientY } = event
            this.mouseDownPosition = new Two.Vector(clientX, clientY)
        })
    }

    addHull() {
        const id = `hull-${Object.keys(this.hulls).length + 1}`

        const hull = new Hull(id)

        this.hulls[id] = hull
        this.two.add(hull.group as unknown as Shape)

        this.two.update()

        let hullLayerEl = document.getElementById(hull.hullLayer.id)

        if (hullLayerEl) {
            hullLayerEl.addEventListener('mousedown', () => {
                this.selectedHull = hull
            })
        }

        return hull
    }

    addHullCircle(x: number, y: number) {
        const circle = this.two.makeCircle(x, y, 50)

        const hullCircle = new HullCircle(circle)

        if (!this._activeHull) {
            let newAciveHull = Object.values(this.hulls)[0]

            if (!newAciveHull) {
                newAciveHull = this.addHull()
            }

            this._activeHull = newAciveHull
        }

        if (
            this._activeHull.circleCount < 3 ||
            hullCircle.isInside(this._activeHull)
        ) {
            this._activeHull.addHullCircle(hullCircle)
        }

        // Have to update here to get the circleEl below.
        this.two.update()

        const circleEl = document.getElementById(hullCircle.id)!

        circleEl.addEventListener('mousedown', () => {
            this.selectedHullCircle = hullCircle
            circleEl.classList.add('active')
        })

        this.drawHull(this._activeHull)
        this.two.update()
    }

    drawHull(hull: Hull) {
        hull.erase()
        hull.draw()
    }

    // Add this new method to check if circle should be moved to active hull
    checkCircleActiveHullMembership(circle: HullCircle) {
        // If there's no active hull, nothing to do
        if (!this._activeHull) return

        // Find which hull the circle currently belongs to
        let currentHull: Hull | null = null
        for (const hull of Object.values(this.hulls)) {
            if (hull.hasCircle(circle.id)) {
                currentHull = hull
                break
            }
        }

        // If circle doesn't belong to any hull or already belongs to active hull, nothing to do
        if (!currentHull || currentHull === this._activeHull) return

        // Check if the circle is now inside the active hull
        if (circle.isInside(this._activeHull)) {
            // Circle has moved into the active hull, so move it there
            currentHull.removeHullCircle(circle.id)
            this._activeHull.addHullCircle(circle)

            // Update both hulls
            this.drawHull(currentHull)
            this.drawHull(this._activeHull)

            // Update the display
            this.two.update()
        }
    }
}

init().then(() => {
    const scene = new Scene(document.body)

    const svgDownloader = new Downloader(new SvgExporter())

    const downloadButton = document.createElement('button')
    downloadButton.innerText = 'Download SVG'
    downloadButton.style.position = 'absolute'
    downloadButton.style.top = '10px'
    downloadButton.style.right = '10px'
    downloadButton.style.zIndex = '1000'
    downloadButton.addEventListener('click', () => {
        svgDownloader.download(scene.svgElement, 'hull.svg')
    })
    // document.body.appendChild(downloadButton);
})
