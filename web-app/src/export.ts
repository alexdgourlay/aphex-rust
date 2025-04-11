interface Exporter {
    export(element: Element): Blob
}

export class SvgExporter implements Exporter {
    export(svgElement: SVGElement) {
        // Clone the SVG to avoid modifying the original
        const clone = svgElement.cloneNode(true)

        // clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        // clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        const svgData = new XMLSerializer().serializeToString(clone)

        return new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    }
}

export class Downloader {
    exporter: Exporter

    constructor(exporter: SvgExporter) {
        this.exporter = exporter
    }

    download(element: Element, fileName: string) {
        const data = this.exporter.export(element)

        // Create a download link
        const url = URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()

        // Cleanup
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }
}
