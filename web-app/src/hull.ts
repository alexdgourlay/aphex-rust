import { generate, is_circle_inside_polygon } from 'aphex-rust'
import Two from 'two.js'
import { Anchor } from 'two.js/src/anchor'
import { Group } from 'two.js/src/group'
import { Path } from 'two.js/src/path'
import { Shape } from 'two.js/src/shape'
import { Circle } from 'two.js/src/shapes/circle'

const RENDER_OPTIONS = {
    arcResolution: 128,
}

export class HullCircle {
    id: string
    className = 'hull-circle'

    circle: Circle
    hullVertices: Anchor[] = []

    constructor(circle: Circle) {
        circle.stroke = 'black'
        circle.fill = 'rgba(0, 0, 0, 0.1)'
        circle.linewidth = 2
        circle.className = this.className

        this.circle = circle
        this.id = circle.id
        this.hullVertices = []
    }

    set contained(val: boolean) {
        if (val) {
            this.circle.className = `${this.className} contained`
        } else {
            this.circle.className = this.className
        }
    }

    isInside(hull: Hull): boolean {
        if (!hull.hasPath) return false
        return is_circle_inside_polygon(this.toJsValue(), hull.toJsValue())
    }

    toJsValue() {
        return {
            id: this.id,
            x: this.circle.translation.x,
            y: this.circle.translation.y,
            radius: this.circle.radius,
        }
    }
}

export class Hull {
    id: string
    #circles: Record<string, HullCircle>
    #path: Path | null = null

    group = new Group()
    _circleLayer = new Group()
    hullLayer = new Group()

    constructor(id: string) {
        this.id = id
        this.#circles = {}

        this.group.id = this.id
        this.group.className = 'hull-group'

        this.hullLayer.id = `${this.id}-hull-layer`
        this.hullLayer.className = 'hull-layer'
        this.group.add(this.hullLayer as unknown as Shape)

        this._circleLayer.id = `${this.id}-circle-layer`
        this._circleLayer.className = 'hull-circle-layer'
        this.group.add(this._circleLayer as unknown as Shape)
    }

    #addHullPath(path: Path) {
        this.#path = path
        this.#path.id = `${this.id}-hull-path`
        this.hullLayer.add(path as unknown as Shape)
    }

    #removeHullPath() {
        if (this.#path) {
            this.hullLayer.remove(this.#path as unknown as Shape)
            this.#path = null
        }
    }

    get hasPath() {
        return this.#path !== null
    }

    get circleCount() {
        return Object.keys(this.#circles).length
    }

    addHullCircle(hullCircle: HullCircle) {
        this.#circles[hullCircle.id] = hullCircle
        this._circleLayer.add(hullCircle.circle as unknown as Shape)
    }

    removeHullCircle(circleId: string) {
        const circle = this.#circles[circleId]
        if (circle) {
            this._circleLayer.remove(circle.circle as unknown as Shape)
            delete this.#circles[circleId]
            return circle
        }
        return null
    }

    getCircle(circleId: string): HullCircle | undefined {
        return this.#circles[circleId];
    }

    hasCircle(circleId: string): boolean {
        return circleId in this.#circles;
    }

    erase() {
        this.#removeHullPath()

        for (const circle of Object.values(this.#circles)) {
            circle.hullVertices = []
        }
    }

    draw(): Path | null {
        if (Object.keys(this.#circles).length < 3) {
            return null
        }

        const tangentPoints: {
            circle_id: string
            x: number
            y: number
        }[] = generate(
            Object.values(this.#circles).map((circle) => circle.toJsValue())
        )

        if (tangentPoints.length === 0) {
            return null
        }

        const path = new Two.Path()
        path.closed = true
        path.stroke = 'rgba(255, 0, 0, 0.8)'
        path.fill = 'rgba(255, 0, 0, 0.1)'
        path.linewidth = 2
        path.className = 'hull-path'

        for (let i = 0; i < tangentPoints.length; i++) {
            const current = tangentPoints[i]

            const next = tangentPoints[(i + 1) % tangentPoints.length]

            const { circle, hullVertices: hullCircleVertices } =
                this.#circles[current.circle_id]

            if (current.circle_id === next.circle_id) {
                // Points are on the same circle, add an arc.
                // Calculate start and end angles
                const startAngle = Math.atan2(
                    current.y - circle.translation.y,
                    current.x - circle.translation.x
                )
                const endAngle = Math.atan2(
                    next.y - circle.translation.y,
                    next.x - circle.translation.x
                )

                // Calculate angle difference and decide direction
                let angleDiff = endAngle - startAngle

                if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI
                if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI

                for (let j = 0; j <= RENDER_OPTIONS.arcResolution; j++) {
                    const t = j / RENDER_OPTIONS.arcResolution
                    const angle = startAngle + angleDiff * t
                    const x =
                        circle.translation.x + circle.radius * Math.cos(angle)
                    const y =
                        circle.translation.y + circle.radius * Math.sin(angle)

                    const vertex = new Two.Anchor(x, y)

                    hullCircleVertices.push(vertex)
                    path.vertices.push(vertex)
                }
            } else {
                // Points are on different circles, add a straight line
                const vertex = new Two.Anchor(current.x, current.y)

                hullCircleVertices.push(vertex)
                path.vertices.push(vertex)
            }
        }

        this.#addHullPath(path)
        return path
    }

    toJsValue() {
        if (!this.#path) return null

        return this.#path.vertices.map((v) => ({
            x: v.x,
            y: v.y,
        }))
    }
}
