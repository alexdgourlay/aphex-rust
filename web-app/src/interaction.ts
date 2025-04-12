import Two from 'two.js';
import { Vector } from 'two.js/src/vector';
import { Hull, HullCircle } from './hull';

export const MIN_CIRCLE_RADIUS = 10;
export const MAX_CIRCLE_RADIUS = 200;

export interface Selectable {
    select(): void;
    deselect(): void;
}

export interface Movable {
    translation: Vector;
}

export interface Resizable {
    radius: number;
}

export class InteractionManager {
    private rootEl: HTMLElement;
    private two: Two;
    
    private mouseDownPosition: Vector | null = null;
    private moveOffset: Vector | null = null;
    private initialRadius: number | null = null;
    
    private selectedHull: Hull | null = null;
    private selectedHullCircle: HullCircle | null = null;
    
    private onHullChange: ((hull: Hull) => void) | null = null;

    constructor(rootEl: HTMLElement, two: Two) {
        this.rootEl = rootEl;
        this.two = two;
        this.setupEventListeners();
    }

    public setHullChangeCallback(callback: (hull: Hull) => void) {
        this.onHullChange = callback;
    }

    public selectHull(hull: Hull) {
        this.selectedHull = hull;
    }

    public selectHullCircle(hullCircle: HullCircle) {
        this.selectedHullCircle = hullCircle;
        const circleEl = document.getElementById(hullCircle.circle.id);
        if (circleEl) {
            circleEl.classList.add('active');
        }
    }

    public deselectAll() {
        if (this.selectedHullCircle) {
            const circleEl = document.getElementById(
                this.selectedHullCircle.circle.id
            );
            if (circleEl) {
                circleEl.classList.remove('active');
            }
            this.selectedHullCircle = null;
        }

        this.selectedHull = null;
        this.moveOffset = null;
        this.initialRadius = null;
        this.mouseDownPosition = null;
    }

    private setupEventListeners() {
        this.rootEl.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.rootEl.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.rootEl.addEventListener('mousedown', this.handleMouseDown.bind(this));
    }

    private handleMouseMove(event: MouseEvent) {
        if (!this.mouseDownPosition) {
            return;
        }

        const { shiftKey } = event;
        const mousePos = new Two.Vector(event.clientX, event.clientY);

        if (this.selectedHullCircle) {
            const circle = this.selectedHullCircle.circle;

            // If shift key is pressed, resize the circle
            if (shiftKey) {
                if (!this.initialRadius) {
                    this.initialRadius = circle.radius;
                }

                const distance = this.mouseDownPosition.y - mousePos.y;
                const newRadius = this.initialRadius + distance;

                circle.radius = Math.min(
                    Math.max(newRadius, MIN_CIRCLE_RADIUS),
                    MAX_CIRCLE_RADIUS
                );
            } else {
                if (!this.moveOffset) {
                    this.moveOffset = Vector.sub(
                        circle.translation,
                        this.mouseDownPosition
                    );
                }

                // Normal mode - move circle
                circle.translation = Vector.add(mousePos, this.moveOffset);
            }

            if (this.onHullChange && this.selectedHull) {
                this.onHullChange(this.selectedHull);
            }
        } else if (this.selectedHull) {
            if (!this.moveOffset) {
                this.moveOffset = Vector.sub(
                    this.selectedHull.group.translation,
                    this.mouseDownPosition
                );
            }

            this.selectedHull.group.translation = Vector.add(
                mousePos,
                this.moveOffset
            );
        }

        this.two.update();
    }

    private handleMouseUp() {
        this.deselectAll();
    }

    private handleMouseDown(event: MouseEvent) {
        const { clientX, clientY } = event;
        this.mouseDownPosition = new Two.Vector(clientX, clientY);
    }

    // Method to register a shape for interactions
    public registerInteractiveElement(element: HTMLElement, onInteract: () => void) {
        element.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            onInteract();
        });
    }

    public destroy() {
        this.rootEl.removeEventListener('mousemove', this.handleMouseMove);
        this.rootEl.removeEventListener('mouseup', this.handleMouseUp);
        this.rootEl.removeEventListener('mousedown', this.handleMouseDown);
    }
}