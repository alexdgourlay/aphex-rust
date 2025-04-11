import init from 'aphex-rust'
import Two from 'two.js'
import { Vector } from 'two.js/src/vector'

import { Shape } from 'two.js/src/shape'
import { Downloader, SvgExporter } from './export'
import { Hull, HullCircle } from './hull'

class Scene {
    two: Two
    rootEl: HTMLElement

    hulls: Record<string, Hull> = {}
    _activeHull: Hull | null = null

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

        // Update the mousemove event handler
        this.rootEl.addEventListener('mousemove', (event) => {
            if (!this.selectedHullCircle || !this.mouseDownPosition) return

            const { clientX, clientY } = event

            if (!moveOffset) {
                moveOffset = Vector.sub(
                    this.selectedHullCircle.circle.translation,
                    this.mouseDownPosition
                )
            }

            // Normal mode - move circle
            this.selectedHullCircle.circle.translation = Vector.add(
                new Vector(clientX, clientY),
                moveOffset
            )

            this.drawHull(this._activeHull!)
        })

        this.rootEl.addEventListener('mouseup', () => {
            if (this.selectedHullCircle) {
                const circleEl = document.getElementById(
                    this.selectedHullCircle.circle.id
                )
                if (circleEl) {
                    circleEl.classList.remove('active')
                }
                this.selectedHullCircle = null
            }

            moveOffset = null
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

        this._activeHull.addHullCircle(hullCircle)

        // Have to update here to get the circleEl below.
        this.two.update()

        const circleEl = document.getElementById(hullCircle.id)!

        circleEl.addEventListener('mousedown', () => {
            this.selectedHullCircle = hullCircle
            circleEl.classList.add('active')
        })

        this.drawHull(this._activeHull)
    }

    drawHull(hull: Hull) {
        hull.erase()
        hull.draw()
        this.two.update()
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
