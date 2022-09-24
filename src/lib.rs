mod utils;
mod vec;
mod scene;
mod gen_circle;

use wasm_bindgen::prelude::*;

use crate::{scene::Scene, gen_circle::GenCircle};

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;



// fn arc<T>(startPoint: Point<T>, endPoint: Point<T>, segLen: T) {

// }

// fn arc<T>(x: T, y: T, radius: T, startAngle: T, endAngle: T, segLen: T) {}


#[wasm_bindgen]
pub fn start() {
    let mut scene = Scene::new();

    scene.add_circle(GenCircle {
        id: 0,
        radius: 40.,
        position: (230., 280.).into(),
    });
    scene.add_circle(GenCircle {
        id: 1,
        radius: 30.,
        position: (120., 120.).into(),
    });
    scene.add_circle(GenCircle {
        id: 2,
        radius: 50.,
        position: (520., 120.).into(),
    });

    let hull = scene.generate();

    use std::f64;
    use wasm_bindgen::JsCast;

    let document = web_sys::window().unwrap().document().unwrap();
    let canvas = document.get_element_by_id("canvas").unwrap();
    let canvas: web_sys::HtmlCanvasElement = canvas
        .dyn_into::<web_sys::HtmlCanvasElement>()
        .map_err(|_| ())
        .unwrap();

    let context = canvas
        .get_context("2d")
        .unwrap()
        .unwrap()
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .unwrap();

    for circle in scene.circles.into_values() {
        context.begin_path();
        context
            .arc(
                circle.position.x().into(),
                circle.position.y().into(),
                circle.radius.into(),
                0.0,
                f64::consts::PI * 2.0,
            )
            .unwrap();
        context.stroke();
    }

    println!("{:?}", hull);

    for point in hull.exterior().into_iter() {
        context.begin_path();
        context
            .arc(
                point.x.into(),
                point.y.into(),
                3.,
                0.0,
                f64::consts::PI * 2.0,
            )
            .unwrap();
        context.stroke();
    }
}

