import init from 'aphex-rust'
import Two from 'two.js'
import { Vector } from 'two.js/src/vector'

import { Shape } from 'two.js/src/shape'
import { Downloader, SvgExporter } from './export'
import {
    Hull,
    type HullCircle,
    InnerHullCircle,
    OuterHullCircle,
} from './hull'
import { PressedKeys } from './pressedKeys'

const MIN_CIRCLE_RADIUS = 10
const MAX_CIRCLE_RADIUS = 200

class Scene {
    two: Two
    rootEl: HTMLElement

    hulls: Record<string, Hull> = {}

    activeHull: Hull | null = null

    selectedHull: Hull | null = null
    selectedHullCircle: InnerHullCircle | null = null

    uncontainedCircles: Record<string, InnerHullCircle> = {}

    pressedKeys = new PressedKeys()
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
            if (this.pressedKeys.alt) {
                this.addSubractiveHullCircle(clientX, clientY)
            } else {
                this.addAdditiveHullCircle(clientX, clientY)
            }
        })

        let moveOffset: Vector | null = null
        let initialRadius: number | null = null

        // Update the mousemove event handler
        this.rootEl.addEventListener('mousemove', (event) => {
            if (!this.mouseDownPosition) {
                return
            }

            const shiftKey = this.pressedKeys.shift

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

                this.drawHull(this.activeHull!)
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
                    circleEl.classList.remove('selected')
                }

                if (this.activeHull) {
                    if (
                        !this.activeHull.hasCircle(
                            this.selectedHullCircle.id
                        ) &&
                        this.selectedHullCircle.isInside(this.activeHull)
                    ) {
                        this.activeHull.addHullCircle(this.selectedHullCircle)
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
        const id = `hull-${Object.keys(this.hulls).length}`

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

    addAdditiveHullCircle(x: number, y: number) {
        const circle = this.two.makeCircle(x, y, 50)
        const hullCircle = new InnerHullCircle(circle)
        this.addHullCircle(hullCircle)
    }

    addSubractiveHullCircle(x: number, y: number) {
        const circle = this.two.makeCircle(x, y, 50)
        const hullCircle = new OuterHullCircle(circle)
        this.addHullCircle(hullCircle)
    }

    addHullCircle(hullCircle: HullCircle) {
        if (!this.activeHull) {
            let newAciveHull = Object.values(this.hulls)[0]

            if (!newAciveHull) {
                newAciveHull = this.addHull()
            }

            this.activeHull = newAciveHull
        }

        if (
            this.activeHull.circleCount < 3 ||
            hullCircle.isInside(this.activeHull)
        ) {
            this.activeHull.addHullCircle(hullCircle)

            if (this.uncontainedCircles[hullCircle.id]) {
                delete this.uncontainedCircles[hullCircle.id]
            }
        } else {
            this.uncontainedCircles[hullCircle.id] = hullCircle
        }

        // Have to update here to get the circleEl below.
        this.two.update()

        const circleEl = document.getElementById(hullCircle.id)!

        circleEl.addEventListener('mousedown', () => {
            this.selectedHullCircle = hullCircle
            circleEl.classList.add('selected')
        })

        this.drawHull(this.activeHull)
        this.two.update()
    }

    drawHull(hull: Hull) {
        hull.erase()
        hull.draw()
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
