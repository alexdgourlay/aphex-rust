use geo::{prelude::ConvexHull, MultiPoint, Point, Polygon};
use std::collections::HashMap;

use crate::gen_circle::GenCircle;

pub struct Scene {
    pub circles: HashMap<i32, GenCircle>,
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
            let circle_tangents = circle_a.tangents(circle_b);

            for tangent in circle_tangents {
                if let Some(tangent) = tangent {
                    points.push(tangent.0);
                    points.push(tangent.1);
                }
            }
        }

        let hull = MultiPoint::from(points).convex_hull();
        hull
    }
}
