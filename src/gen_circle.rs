use geo::{prelude::EuclideanDistance, Point};

#[derive(Clone, Copy)]
pub struct GenCircle {
    pub id: i32,
    pub position: Point<f32>,
    pub radius: f32,
}

impl GenCircle {
    pub fn tangents(&self, other: &Self) -> [Option<Tangent>; 4] {
        let distance = self.position.euclidean_distance(&other.position);

        let vx = (other.position.x() - self.position.x()) / distance;
        let vy = (other.position.y() - self.position.y()) / distance;

        let mut res: [Option<Tangent>; 4] = [None; 4];
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
                    (
                        self.position.x() + self.radius * nx,
                        self.position.y() + self.radius * ny,
                    )
                        .into(),
                    (
                        other.position.x() + sign_1 * other.radius * nx,
                        other.position.y() + sign_1 * other.radius * ny,
                    )
                        .into(),
                );

                res[i] = Some(tangent);
                i += 1;
            }
        }
        return res;
    }
}

#[derive(Copy, Clone, Debug, PartialEq)]
pub struct Tangent(pub Point<f32>, pub Point<f32>);

#[cfg(test)]
mod tests {
    use super::{GenCircle, Tangent};
    use crate::vec::UnorderedEq;
    use geo::Point;

    #[test]
    // Nested circles have no common tangents.
    fn no_tangents_for_nested_circles() {
        let co_position = Point::new(0., 0.);
        let circle_a = GenCircle {
            id: 0,
            position: co_position,
            radius: 1.,
        };
        let circle_b = GenCircle {
            id: 1,
            position: co_position,
            radius: 2.,
        };

        assert!(circle_a
            .tangents(&circle_b)
            .to_vec()
            .unordered_eq(&vec![None, None, None, None]));
    }

    #[test]
    // Intersecting circles have 2 common tangents.
    fn two_tangents_for_intersecting_circles() {
        let circle_a = GenCircle {
            id: 0,
            position: (0., 0.).into(),
            radius: 1.,
        };
        let circle_b = GenCircle {
            id: 1,
            position: (1.5, 0.).into(),
            radius: 1.,
        };

        assert!(circle_a.tangents(&circle_b).to_vec().unordered_eq(&vec![
            Some(Tangent((0., -1.).into(), (1.5, -1.).into())),
            Some(Tangent((0., 1.).into(), (1.5, 1.).into())),
            None,
            None
        ]));
    }
}
