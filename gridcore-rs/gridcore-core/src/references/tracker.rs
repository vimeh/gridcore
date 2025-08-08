use super::parser::ReferenceParser;
use crate::dependency::DependencyGraph;
use crate::formula::Expr;
use crate::types::CellAddress;
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

/// Tracks references and their dependencies across the spreadsheet
pub struct ReferenceTracker {
    parser: ReferenceParser,
    /// Map from cell address to the cells it references
    pub(crate) forward_dependencies: HashMap<CellAddress, HashSet<CellAddress>>,
    /// Map from cell address to cells that reference it
    pub(crate) reverse_dependencies: HashMap<CellAddress, HashSet<CellAddress>>,
}

impl ReferenceTracker {
    pub fn new() -> Self {
        Self {
            parser: ReferenceParser::new(),
            forward_dependencies: HashMap::new(),
            reverse_dependencies: HashMap::new(),
        }
    }

    /// Update dependencies for a cell based on its formula
    pub fn update_dependencies(&mut self, cell: &CellAddress, expr: &Expr) {
        // Remove old dependencies
        self.remove_dependencies(cell);

        // Extract new dependencies
        let dependencies = self.parser.extract_from_expr(expr);

        // Add to forward dependencies
        if !dependencies.is_empty() {
            self.forward_dependencies
                .insert(cell.clone(), dependencies.clone());

            // Update reverse dependencies
            for dep in dependencies {
                self.reverse_dependencies
                    .entry(dep)
                    .or_insert_with(HashSet::new)
                    .insert(cell.clone());
            }
        }
    }

    /// Remove all dependencies for a cell
    pub fn remove_dependencies(&mut self, cell: &CellAddress) {
        // Remove from forward dependencies
        if let Some(deps) = self.forward_dependencies.remove(cell) {
            // Update reverse dependencies
            for dep in deps {
                if let Some(reverse_deps) = self.reverse_dependencies.get_mut(&dep) {
                    reverse_deps.remove(cell);
                    if reverse_deps.is_empty() {
                        self.reverse_dependencies.remove(&dep);
                    }
                }
            }
        }
    }

    /// Get all cells that depend on the given cell
    pub fn get_dependents(&self, cell: &CellAddress) -> HashSet<CellAddress> {
        self.reverse_dependencies
            .get(cell)
            .cloned()
            .unwrap_or_default()
    }

    /// Get all cells that the given cell depends on
    pub fn get_dependencies(&self, cell: &CellAddress) -> HashSet<CellAddress> {
        self.forward_dependencies
            .get(cell)
            .cloned()
            .unwrap_or_default()
    }

    /// Check if adding a dependency would create a cycle
    pub fn would_create_cycle(&self, from: &CellAddress, to: &CellAddress) -> bool {
        if from == to {
            return true;
        }

        let mut visited = HashSet::new();
        let mut stack = vec![to.clone()];

        while let Some(current) = stack.pop() {
            if current == *from {
                return true;
            }

            if visited.insert(current.clone()) {
                if let Some(deps) = self.forward_dependencies.get(&current) {
                    stack.extend(deps.iter().cloned());
                }
            }
        }

        false
    }

    /// Get all cells affected by changes to the given cells (transitive closure)
    pub fn get_affected_cells(&self, changed_cells: &HashSet<CellAddress>) -> Vec<CellAddress> {
        let mut affected = HashSet::new();
        let mut to_process: Vec<_> = changed_cells.iter().cloned().collect();

        while let Some(cell) = to_process.pop() {
            if affected.insert(cell.clone()) {
                if let Some(dependents) = self.reverse_dependencies.get(&cell) {
                    for dependent in dependents {
                        if !affected.contains(dependent) {
                            to_process.push(dependent.clone());
                        }
                    }
                }
            }
        }

        // Sort by dependency order (topological sort)
        self.topological_sort(affected)
    }

    /// Perform topological sort on cells based on dependencies
    fn topological_sort(&self, cells: HashSet<CellAddress>) -> Vec<CellAddress> {
        let mut sorted = Vec::new();
        let mut visited = HashSet::new();
        let mut visiting = HashSet::new();

        for cell in &cells {
            if !visited.contains(cell) {
                self.dfs_topological(cell, &cells, &mut visited, &mut visiting, &mut sorted);
            }
        }

        sorted
    }

    fn dfs_topological(
        &self,
        cell: &CellAddress,
        cells: &HashSet<CellAddress>,
        visited: &mut HashSet<CellAddress>,
        visiting: &mut HashSet<CellAddress>,
        sorted: &mut Vec<CellAddress>,
    ) {
        if visited.contains(cell) {
            return;
        }

        visiting.insert(cell.clone());

        if let Some(deps) = self.forward_dependencies.get(cell) {
            for dep in deps {
                if cells.contains(dep) && !visited.contains(dep) {
                    self.dfs_topological(dep, cells, visited, visiting, sorted);
                }
            }
        }

        visiting.remove(cell);
        visited.insert(cell.clone());
        sorted.push(cell.clone());
    }

    /// Integrate with existing dependency graph
    pub fn sync_with_dependency_graph(&self, graph: &Rc<RefCell<DependencyGraph>>) {
        let mut graph = graph.borrow_mut();

        // Clear and rebuild based on current tracking
        for (from, to_set) in &self.forward_dependencies {
            for to in to_set {
                graph.add_dependency(from.clone(), to.clone());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cycle_detection() {
        let mut tracker = ReferenceTracker::new();

        // A1 -> B1
        tracker.forward_dependencies.insert(
            CellAddress::new(0, 0),
            vec![CellAddress::new(1, 0)].into_iter().collect(),
        );

        // B1 -> C1
        tracker.forward_dependencies.insert(
            CellAddress::new(1, 0),
            vec![CellAddress::new(2, 0)].into_iter().collect(),
        );

        // Check if C1 -> A1 would create cycle (yes)
        assert!(tracker.would_create_cycle(&CellAddress::new(2, 0), &CellAddress::new(0, 0)));

        // Check if C1 -> D1 would create cycle (no)
        assert!(!tracker.would_create_cycle(&CellAddress::new(2, 0), &CellAddress::new(3, 0)));
    }

    #[test]
    fn test_affected_cells() {
        let mut tracker = ReferenceTracker::new();

        // A1 -> B1
        tracker.forward_dependencies.insert(
            CellAddress::new(0, 0),
            vec![CellAddress::new(1, 0)].into_iter().collect(),
        );
        tracker.reverse_dependencies.insert(
            CellAddress::new(1, 0),
            vec![CellAddress::new(0, 0)].into_iter().collect(),
        );

        // B1 -> C1
        tracker.forward_dependencies.insert(
            CellAddress::new(1, 0),
            vec![CellAddress::new(2, 0)].into_iter().collect(),
        );
        tracker.reverse_dependencies.insert(
            CellAddress::new(2, 0),
            vec![CellAddress::new(1, 0)].into_iter().collect(),
        );

        // Get cells affected by changing B1
        let changed = vec![CellAddress::new(1, 0)].into_iter().collect();
        let affected = tracker.get_affected_cells(&changed);

        assert_eq!(affected.len(), 2); // B1 and A1
        assert!(affected.contains(&CellAddress::new(0, 0)));
        assert!(affected.contains(&CellAddress::new(1, 0)));
    }
}
