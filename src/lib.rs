mod utils;

use geo::prelude::{ConvexHull, EuclideanDistance};
use geo::*;
use std::collections::HashMap;
use std::fmt;
use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[derive(Clone, Copy)]
struct GenCircle {
    id: i32,
    position: Point<f32>,
    radius: f32,
}

struct Scene {
    circles: HashMap<i32, GenCircle>,
}

impl Scene {
    pub fn new() -> Self {
        Self {
            circles: HashMap::new(),
        }
    }

    pub fn add_circle(&mut self, circle: GenCircle) {
        self.circles.insert(circle.id, circle);
    }

    pub fn generate(&self) -> Polygon<f32> {
        use itertools::Itertools;

        let mut points: Vec<Point<f32>> = Vec::new();

        let circles = self.circles.iter().map(|(_k, v)| v);

        for (circle_a, circle_b) in circles.tuple_combinations() {
            let circle_tangents = tangents(
                &circle_a.position,
                &circle_a.radius,
                &circle_b.position,
                &circle_b.radius,
            );

            for tangent in circle_tangents {
                match tangent {
                    Some(x) => {
                        points.push(x.0);
                        points.push(x.1);
                    }
                    None => {}
                }
            }
        }
        let hull = MultiPoint::from(points).convex_hull();
        hull
    }
}

#[derive(Copy, Clone)]
struct Tangent(Point<f32>, Point<f32>);

impl fmt::Display for Tangent {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "p1: ({},{}), p2: ({},{})",
            self.0.x(),
            self.0.y(),
            self.1.x(),
            self.1.y()
        )
    }
}

struct CircleTangents([Option<Tangent>; 4]);

impl fmt::Display for CircleTangents {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        for &tangent in self.0.iter() {
            match tangent {
                Some(x) => writeln!(f, "{}", x.to_string())?,
                None => (),
            };
        }
        Ok(())
    }
}

fn tangents(
    pos_a: &Point<f32>,
    rad_a: &f32,
    pos_b: &Point<f32>,
    rad_b: &f32,
) -> [Option<Tangent>; 4] {
    let distance = pos_a.euclidean_distance(pos_b);

    let vx = (pos_b.x() - pos_a.x()) / distance;
    let vy = (pos_b.y() - pos_a.y()) / distance;

    let mut res: [Option<Tangent>; 4] = [None; 4];
    let mut i: usize = 0;

    for sign_1 in [-1., 1.] {
        let c = (rad_a - sign_1 * rad_b) / distance;
        if c * c > 1. {
            continue;
        }

        let h = ((0.0f32).max(1.0f32 - c * c)).sqrt();

        for sign_2 in [-1., 1.] {
            let nx = vx * c - sign_2 * h * vy;
            let ny = vy * c + sign_2 * h * vx;

            let tangent = Tangent(
                (pos_a.x() + rad_a * nx, pos_a.y() + rad_a * ny).into(),
                (
                    pos_b.x() + sign_1 * rad_b * nx,
                    pos_b.y() + sign_1 * rad_b * ny,
                )
                    .into(),
            );

            res[i] = Some(tangent);
            i += 1;
        }
    }
    return res;
}

#[wasm_bindgen]
pub fn start() {
    let mut scene = Scene::new();

    let circle_a = GenCircle {
        id: 0,
        radius: 4.,
        position: (13., 10.).into(),
    };

    let circle_b = GenCircle {
        id: 1,
        radius: 3.,
        position: (20., 20.).into(),
    };

    // web_sys::console::log_1(&circle_tangents(&circle_a, &circle_b).to_string().into());

    scene.add_circle(circle_a);
    scene.add_circle(circle_b);
    scene.generate();
}

trait Draw {
    fn draw(&self) {}
}
