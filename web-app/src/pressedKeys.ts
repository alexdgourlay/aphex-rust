export class PressedKeys {
    private pressedKeys: Set<string> = new Set()

    constructor() {
        window.addEventListener('keydown', this.handleKeyDown.bind(this))
        window.addEventListener('keyup', this.handleKeyUp.bind(this))
        // Clear keys when window loses focus
        window.addEventListener('blur', this.clearKeys.bind(this))
    }

    private handleKeyDown(event: KeyboardEvent): void {
        this.pressedKeys.add(event.key.toLowerCase())
    }

    private handleKeyUp(event: KeyboardEvent): void {
        this.pressedKeys.delete(event.key.toLowerCase())
    }

    private clearKeys(): void {
        this.pressedKeys.clear()
    }

    isPressed(key: string): boolean {
        return this.pressedKeys.has(key.toLowerCase())
    }

    // Helper getters for common modifier keys
    get shift(): boolean {
        return this.pressedKeys.has('shift')
    }

    get ctrl(): boolean {
        return this.pressedKeys.has('control')
    }

    get alt(): boolean {
        return this.pressedKeys.has('alt')
    }
}
