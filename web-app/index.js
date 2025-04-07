import { generate } from "aphex-rust";
import Two from "two.js";

const ARC_RESOLUTION = 128;

const canvas = document.body;

// Make an instance of two and place it on the page.
const two = new Two({
    fullscreen: true,
}).appendTo(canvas);


// Create groups for organization and layering
const hullGroup = new Two.Group();
hullGroup.id = 'hull-group';

const circlesGroup = new Two.Group();
circlesGroup.id = 'circles-group';

// Add groups to the scene (hull first, then circles for proper layering)
two.add(hullGroup);
two.add(circlesGroup);

two.update();

const genCircles = new Map();
let selectedGenCircle = null;

const drawGenCircle = (x, y, radius) => {
    const circle = two.makeCircle(x, y, radius);
    circle.stroke = "black";
    circle.fill = "rgba(0, 0, 0, 0.1)";
    circle.linewidth = 2;
    circle.className = 'gen-circle';

    // Add the circle to the circlesGroup instead of directly to the scene
    two.remove(circle); // Remove from main scene
    circlesGroup.add(circle);

    two.update();
    return circle;
}

const toWasmCircle = (genCircle) => {
    const { id, circle } = genCircle;
    return {
        id,
        x: circle.translation.x,
        y: circle.translation.y,
        radius: circle._radius
    }
}

const create = () => {
    // Clear previous hull paths
    while (hullGroup.children.length > 0) {
        hullGroup.remove(hullGroup.children[0]);
    }

    // Reset path vertices collections
    genCircles.forEach(circle => {
        circle.pathVertices = [];
    });

    const tangentPoints = generate(Array.from(genCircles.values()).map(toWasmCircle));

    if (tangentPoints.length === 0) {
        two.update();
        return;
    }

    // Create a single path for the entire hull
    const path = new Two.Path();
    path.closed = true;
    path.stroke = "rgba(255, 0, 0, 0.8)";
    path.linewidth = 2;
    path.fill = "rgba(255, 0, 0, 0.1)";
    path.vertices = [];
    path.className = 'hull-path';

    // Create a smooth approximation of the hull
    for (let i = 0; i < tangentPoints.length; i++) {
        const current = tangentPoints[i];
        const next = tangentPoints[(i + 1) % tangentPoints.length]; // Wrap around

        const genCircle = genCircles.get(current.circle_id);

        if (current.circle_id === next.circle_id) {
            // Points are on the same circle, add an arc.
            const circle = genCircle.circle;

            // Calculate start and end angles
            const startAngle = Math.atan2(current.y - circle.translation.y, current.x - circle.translation.x);
            const endAngle = Math.atan2(next.y - circle.translation.y, next.x - circle.translation.x);

            // Calculate angle difference and decide direction
            let angleDiff = endAngle - startAngle;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

            for (let j = 0; j <= ARC_RESOLUTION; j++) {
                const t = j / ARC_RESOLUTION;
                const angle = startAngle + angleDiff * t;
                const x = circle.translation.x + circle._radius * Math.cos(angle);
                const y = circle.translation.y + circle._radius * Math.sin(angle);

                const vertex = new Two.Anchor(x, y);

                genCircle.pathVertices.push(vertex);
                path.vertices.push(vertex);
            }
        } else {
            // Points are on different circles, add a straight line
            const vertex = new Two.Anchor(current.x, current.y);

            genCircle.pathVertices.push(vertex);
            path.vertices.push(vertex);
        }
    }

    // Add the path to the hull group
    hullGroup.add(path);

    two.update();
}

let initialMousePosition = null;
let initialRadius = null;
let isResizing = false;

const createGenCircle = (x, y, radius) => {
    const circle = drawGenCircle(x, y, radius);

    const genCircle = {
        id: circle.id,
        circle,
        pathVertices: []
    }

    genCircles.set(genCircle.id, genCircle);

    const circleEl = document.getElementById(circle.id);

    circleEl.addEventListener('mousedown', (event) => {
        selectedGenCircle = genCircle;
        circleEl.classList.add('active');

        // Store initial mouse position and radius for potential resizing
        initialMousePosition = new Two.Vector(event.clientX, event.clientY);
        initialRadius = circle._radius;
        isResizing = event.shiftKey;
    })

    circleEl.addEventListener('mouseup', () => {
        selectedGenCircle = null;
        circleEl.classList.remove('active');
    })

    create();
    return circle;
}


canvas.addEventListener("dblclick", ({ clientX, clientY }) => {
    createGenCircle(clientX, clientY, Math.random() * 50 + 20);
})


// Update the mousemove event handler
canvas.addEventListener("mousemove", (event) => {
    if (!selectedGenCircle) return;

    const { clientX, clientY } = event;

    if (event.shiftKey && !isResizing) {
        // User started holding shift during drag - initialize resize
        initialMousePosition = new Two.Vector(clientX, clientY);
        initialRadius = selectedGenCircle.circle._radius;
        isResizing = true;
    } else if (!event.shiftKey && isResizing) {
        // User released shift during drag - stop resizing
        isResizing = false;
    }

    if (isResizing) {
        // Resize mode - adjust circle radius
        const currentPosition = new Two.Vector(clientX, clientY);
        const deltaX = currentPosition.x - initialMousePosition.x;
        const deltaY = currentPosition.y - initialMousePosition.y;

        // Calculate distance from initial point
        const displacement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Determine direction (growing or shrinking)
        const direction = deltaX + deltaY > 0 ? -1 : 1;

        // Calculate new radius (with minimum size limit)
        const newRadius = Math.max(10, initialRadius + displacement * direction);

        // Update circle radius
        selectedGenCircle.circle.radius = newRadius;
    } else {
        // Normal mode - move circle
        selectedGenCircle.circle.translation = new Two.Vector(clientX, clientY);
    }

    // Recalculate hull with updated circle
    create();
});

// Update the mouseup handler to reset resize state
canvas.addEventListener('mouseup', () => {
    if (selectedGenCircle) {
        const circleEl = document.getElementById(selectedGenCircle.circle.id);
        if (circleEl) {
            circleEl.classList.remove('active');
        }
        selectedGenCircle = null;
        isResizing = false;
        initialMousePosition = null;
        initialRadius = null;
    }
});

// Handle keydown/keyup for starting/stopping resize during drag
document.addEventListener('keydown', (event) => {
    if (event.key === 'Shift' && selectedGenCircle && !isResizing) {
        // Start resize mode if shift is pressed during drag
        isResizing = true;
        const { clientX, clientY } = event;
        initialMousePosition = new Two.Vector(clientX, clientY);
        initialRadius = selectedGenCircle.circle._radius;
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key === 'Shift' && isResizing) {
        // Stop resize mode if shift is released
        isResizing = false;
    }
});

function downloadSVG(svgElement, filename) {
    // Clone the SVG to avoid modifying the original
    const clone = svgElement.cloneNode(true);
    
    // Add necessary namespaces
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Serialize the SVG to a string
    const svgData = new XMLSerializer().serializeToString(clone);

    // Create a Blob from the SVG string
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });

    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const downloadButton = document.createElement('button');
downloadButton.textContent = 'Download';
downloadButton.style.position = 'absolute';
downloadButton.style.top = '10px';
downloadButton.style.right = '10px';
downloadButton.style.zIndex = 1000;
downloadButton.addEventListener('click', () => {
    const svgElement = two.renderer.domElement;
    downloadSVG(svgElement, 'hull.svg');
});
document.body.appendChild(downloadButton);
