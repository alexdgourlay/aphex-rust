mod utils;

use std::collections::HashMap;

use geo::{euclidean_distance::EuclideanDistance, prelude::ConvexHull, MultiPoint, Point};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Clone, Debug, Deserialize)]
struct Coord {
    x: f32,
    y: f32,
}


#[derive(Copy, Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CircleType {
    Inner,
    Outer,
}

#[derive(Clone, Debug, Deserialize)]
struct Circle {
    pub id: String,
    pub circle_type: CircleType,
    pub x: f32,
    pub y: f32,
    pub radius: f32,
}

#[wasm_bindgen]
#[derive(Clone, Debug, PartialEq, Serialize)]
struct TangentPoint {
    circle_id: String,
    x: f32,
    y: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Tangent(TangentPoint, TangentPoint);

impl Circle {
    fn intersects_line_segment(&self, p1: &Coord, p2: &Coord) -> bool {
        let circle_center = Point::new(self.x, self.y);

        // Vector from point 1 to point 2
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;

        // Length of the line segment squared
        let length_squared = dx * dx + dy * dy;

        // Calculate the closest point on the line segment to the circle center
        let mut t = ((self.x - p1.x) * dx + (self.y - p1.y) * dy) / length_squared;
        t = t.max(0.0).min(1.0); // Clamp to [0,1] for line segment

        let closest_x = p1.x + t * dx;
        let closest_y = p1.y + t * dy;

        let closest_point = Point::new(closest_x, closest_y);

        // Check if the closest point is within the circle radius
        let distance = circle_center.euclidean_distance(&closest_point);

        distance <= self.radius
    }

    fn common_tangents(&self, other: &Self) -> [Option<Tangent>; 4] {
        let position = Point::new(self.x, self.y);
        let other_position = Point::new(other.x, other.y);

        let distance = position.euclidean_distance(&other_position);

        let vx = (other.x - self.x) / distance;
        let vy = (other.y - self.y) / distance;

        let mut res: [Option<Tangent>; 4] = [const { None }; 4];
        let mut i: usize = 0;

        for sign_1 in [-1., 1.] {
            let c = (self.radius - sign_1 * other.radius) / distance;
            if c * c > 1. {
                continue;
            }

            let h = ((0.0f32).max(1.0f32 - c * c)).sqrt();

            for sign_2 in [-1., 1.] {
                let nx = vx * c - sign_2 * h * vy;
                let ny = vy * c + sign_2 * h * vx;

                let tangent = Tangent(
                    TangentPoint {
                        x: self.x + self.radius * nx,
                        y: self.y + self.radius * ny,
                        circle_id: self.id.clone(),
                    },
                    TangentPoint {
                        x: other.x + sign_1 * other.radius * nx,
                        y: other.y + sign_1 * other.radius * ny,
                        circle_id: other.id.clone(),
                    },
                );

                res[i] = Some(tangent);
                i += 1;
            }
        }
        return res;
    }

    fn is_contained_by(&self, other: &Self) -> bool {
        let position = Point::new(self.x, self.y);
        let other_position = Point::new(other.x, other.y);
        let distance = position.euclidean_distance(&other_position);
        distance + self.radius <= other.radius
    }
}

// TODO: find a better way of identifying points.
fn to_identifier_string(point: &Point<f32>) -> String {
    format!("{:},{:}", point.x(), point.y())
}

#[wasm_bindgen]
pub fn generate(circles_js: Box<[JsValue]>) -> Box<[JsValue]> {
    use itertools::Itertools;

    let circles: Vec<Circle> = circles_js
        .iter()
        .map(
            |circle| match serde_wasm_bindgen::from_value(circle.clone()) {
                Ok(c) => c,
                Err(e) => {
                    console_log!("Error deserializing: {:?}", e);
                    panic!("Deserialization error");
                }
            },
        )
        .collect();

    let mut points = Vec::new();
    let mut points_set: HashMap<String, TangentPoint> = HashMap::new();

    let non_enclosed_circles: Vec<Circle> = circles
        .iter()
        .filter(|circle_a| {
            circles.iter().all(|circle_b| {
                // Keep circle_a if it's not contained by any other circle (circle_b)
                circle_a.id == circle_b.id || !circle_a.is_contained_by(circle_b)
            })
        })
        .cloned()
        .collect();

    for (circle_a, circle_b) in non_enclosed_circles.into_iter().tuple_combinations() {
        let circle_tangents = circle_a.common_tangents(&circle_b);

        for tangent in circle_tangents {
            if let Some(tangent) = tangent {
                for tangent_point in [tangent.0, tangent.1] {
                    let point = Point::new(tangent_point.x, tangent_point.y);
                    let point_string = to_identifier_string(&point);

                    points.push(point);
                    points_set.insert(point_string, tangent_point.clone());
                }
            }
        }
    }

    let hull = MultiPoint::from(points).convex_hull();

    let tangent_point_hull: Vec<JsValue> = hull
        .exterior()
        .into_iter()
        .map(|coord| {
            let point = Point::new(coord.x, coord.y);
            let point_string = to_identifier_string(&point);
            let tangent_point = points_set.get(&point_string).unwrap().clone();
            serde_wasm_bindgen::to_value(&tangent_point).unwrap()
        })
        .collect();

    tangent_point_hull.into_boxed_slice()
}

// Function to check if a point is inside a polygon using ray casting algorithm
fn is_point_in_polygon(point: &Point<f32>, polygon: &[Coord]) -> bool {
    if polygon.len() < 3 {
        return false;
    }

    let mut inside = false;
    let x = point.x();
    let y = point.y();

    for i in 0..polygon.len() {
        let j = if i == 0 { polygon.len() - 1 } else { i - 1 };

        let xi = polygon[i].x;
        let yi = polygon[i].y;
        let xj = polygon[j].x;
        let yj = polygon[j].y;

        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if intersect {
            inside = !inside;
        }
    }

    inside
}
fn circle_intersects_polygon(circle: &Circle, polygon: &[Coord]) -> (bool, Option<Vec<Coord>>) {
    if polygon.len() < 3 {
        return (true, None);
    }

    // Check if circle center is inside the polygon
    let circle_center = Point::new(circle.x, circle.y);
    if is_point_in_polygon(&circle_center, polygon) {
        return (true, None);
    }

    // Check if circle intersects with any polygon edge
    for i in 0..polygon.len() {
        let j = (i + 1) % polygon.len();

        let v1 = &polygon[i];
        let v2 = &polygon[j];

        if circle.intersects_line_segment(v1, v2) {
            let segment = vec![v1.clone(), v2.clone()];
            return (true, Some(segment));
        }
    }

    (false, None)
}

#[wasm_bindgen]
pub fn is_circle_inside_polygon(circle_js: JsValue, polygon_path_js: JsValue) -> bool {
    let circle: Circle = serde_wasm_bindgen::from_value(circle_js).unwrap_throw();
    let hull_path: Vec<Coord> = serde_wasm_bindgen::from_value(polygon_path_js).unwrap_throw();

    let (intersects, _) = circle_intersects_polygon(&circle, &hull_path);
    intersects
}

#[wasm_bindgen]
pub fn circle_intersecting_segment(circle_js: JsValue, polygon_path_js: JsValue)  {
    let circle: Circle = serde_wasm_bindgen::from_value(circle_js).unwrap_throw();
    let hull_path: Vec<Coord> = serde_wasm_bindgen::from_value(polygon_path_js).unwrap_throw();

    let (_, segment) = circle_intersects_polygon(&circle, &hull_path);
}
