pub trait UnorderedEq {
    fn unordered_eq(&self, other: &Self) -> bool;
}

impl<T: PartialEq + Clone> UnorderedEq for Vec<T> {
    fn unordered_eq(&self, other: &Self) -> bool {
        if self.len() != other.len() {
            return false;
        }

        let mut match_count = 0;
        let mut other_to_check: Self = Vec::new();
        other_to_check.clone_from(other);

        for item in self {
            let index_in_other = other_to_check
                .iter()
                .position(|other_item| other_item == item);

            if let Some(index) = index_in_other {
                other_to_check.remove(index);
                match_count += 1;
            }
        }

        self.len() == match_count
    }
}

#[cfg(test)]
mod tests {
    use crate::vec::UnorderedEq;

    #[test]
    fn ordered_eq() {
        assert!(vec![0, 1].unordered_eq(&vec![0, 1]));
    }

    #[test]
    fn unordered_eq() {
        assert!(vec![2, 1, 0].unordered_eq(&vec![0, 1, 2]));
    }

    #[test]
    fn not_eq() {
        assert!(!vec![0, 1, 2].unordered_eq(&vec![3, 4, 5]));
    }

    #[test]
    fn wrong_len_not_eq() {
        assert!(!vec![0, 1].unordered_eq(&vec![0, 1, 2]));
        assert!(!vec![0, 1, 2].unordered_eq(&vec![0, 1]));
    }

    #[test]
    fn empty_eq() {
        let vec_1: Vec<usize> = vec![];
        let vec_2: Vec<usize> = vec![];
        assert!(vec_1.unordered_eq(&vec_2));
    }
}
