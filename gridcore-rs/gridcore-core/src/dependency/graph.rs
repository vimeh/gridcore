use crate::types::CellAddress;
use crate::{Result, SpreadsheetError};
use petgraph::algo::toposort;
use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::visit::EdgeRef;
use std::collections::HashMap;

/// Manages dependencies between cells in a spreadsheet
#[derive(Debug, Clone)]
pub struct DependencyGraph {
    /// Directed graph where edges point from dependent to dependency
    /// E.g., if A1 contains =B1+C1, then edges are A1→B1 and A1→C1
    graph: DiGraph<CellAddress, ()>,

    /// Mapping from cell address to graph node index
    node_map: HashMap<CellAddress, NodeIndex>,
}

impl DependencyGraph {
    /// Create a new empty dependency graph
    pub fn new() -> Self {
        DependencyGraph {
            graph: DiGraph::new(),
            node_map: HashMap::new(),
        }
    }

    /// Get or create a node for the given cell address
    fn get_or_create_node(&mut self, address: CellAddress) -> NodeIndex {
        if let Some(&idx) = self.node_map.get(&address) {
            idx
        } else {
            let idx = self.graph.add_node(address);
            self.node_map.insert(address, idx);
            idx
        }
    }

    /// Add a dependency: `from` depends on `to`
    /// E.g., if A1 contains =B1+C1, call add_dependency(A1, B1) and add_dependency(A1, C1)
    pub fn add_dependency(&mut self, from: CellAddress, to: CellAddress) {
        let from_idx = self.get_or_create_node(from);
        let to_idx = self.get_or_create_node(to);
        self.graph.add_edge(from_idx, to_idx, ());
    }

    /// Remove all dependencies for a cell (when its formula changes or is deleted)
    pub fn remove_dependencies_for(&mut self, address: &CellAddress) {
        if let Some(&idx) = self.node_map.get(address) {
            // Remove all outgoing edges (dependencies)
            let edges: Vec<_> = self.graph.edges(idx).map(|e| e.id()).collect();
            for edge in edges {
                self.graph.remove_edge(edge);
            }
        }
    }

    /// Remove a cell completely from the graph
    pub fn remove_cell(&mut self, address: &CellAddress) {
        if let Some(idx) = self.node_map.remove(address) {
            self.graph.remove_node(idx);
        }
    }

    /// Get all cells that depend on the given cell (cells that reference this cell)
    pub fn get_dependents(&self, address: &CellAddress) -> Vec<CellAddress> {
        if let Some(&idx) = self.node_map.get(address) {
            // Find nodes with edges TO this node (incoming edges)
            self.graph
                .node_indices()
                .filter(|&node| self.graph.edges(node).any(|e| e.target() == idx))
                .map(|node| self.graph[node])
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Get all cells that this cell depends on (cells referenced by this cell)
    pub fn get_dependencies(&self, address: &CellAddress) -> Vec<CellAddress> {
        if let Some(&idx) = self.node_map.get(address) {
            self.graph
                .edges(idx)
                .map(|e| self.graph[e.target()])
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Get the calculation order for all cells (topological sort)
    /// Returns cells in the order they should be calculated
    pub fn get_calculation_order(&self) -> Result<Vec<CellAddress>> {
        match toposort(&self.graph, None) {
            Ok(indices) => {
                // Topological sort gives us nodes in reverse dependency order
                // since our edges point from dependent to dependency
                // We need to reverse it to get the calculation order
                let mut order: Vec<CellAddress> =
                    indices.into_iter().map(|idx| self.graph[idx]).collect();
                order.reverse();
                Ok(order)
            }
            Err(_) => Err(SpreadsheetError::CircularDependency),
        }
    }

    /// Check if adding a dependency would create a cycle
    pub fn would_create_cycle(&self, from: &CellAddress, to: &CellAddress) -> bool {
        // If 'to' doesn't exist in the graph, it can't create a cycle
        let Some(&to_idx) = self.node_map.get(to) else {
            return false;
        };

        // If 'from' doesn't exist, it can't create a cycle
        let Some(&from_idx) = self.node_map.get(from) else {
            return false;
        };

        // Check if there's already a path from 'to' to 'from'
        // If there is, adding 'from' -> 'to' would create a cycle
        petgraph::algo::has_path_connecting(&self.graph, to_idx, from_idx, None)
    }

    /// Clear all dependencies
    pub fn clear(&mut self) {
        self.graph.clear();
        self.node_map.clear();
    }

    /// Get the number of cells in the dependency graph
    pub fn len(&self) -> usize {
        self.node_map.len()
    }

    /// Check if the graph is empty
    pub fn is_empty(&self) -> bool {
        self.node_map.is_empty()
    }
}

impl Default for DependencyGraph {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dependency_graph_basic() {
        let mut graph = DependencyGraph::new();
        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);
        let c1 = CellAddress::new(2, 0);

        // A1 depends on B1 and C1
        graph.add_dependency(a1, b1);
        graph.add_dependency(a1, c1);

        let deps = graph.get_dependencies(&a1);
        assert_eq!(deps.len(), 2);
        assert!(deps.contains(&b1));
        assert!(deps.contains(&c1));

        let dependents = graph.get_dependents(&b1);
        assert_eq!(dependents.len(), 1);
        assert!(dependents.contains(&a1));
    }

    #[test]
    fn test_calculation_order() {
        let mut graph = DependencyGraph::new();
        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);
        let c1 = CellAddress::new(2, 0);

        // A1 depends on B1, B1 depends on C1
        // So calculation order should be C1, B1, A1
        graph.add_dependency(a1, b1);
        graph.add_dependency(b1, c1);

        let order = graph.get_calculation_order().unwrap();

        // Find positions in the order
        let pos_a1 = order.iter().position(|a| a == &a1).unwrap();
        let pos_b1 = order.iter().position(|a| a == &b1).unwrap();
        let pos_c1 = order.iter().position(|a| a == &c1).unwrap();

        // C1 should come before B1, and B1 before A1
        assert!(pos_c1 < pos_b1);
        assert!(pos_b1 < pos_a1);
    }

    #[test]
    fn test_circular_dependency_detection() {
        let mut graph = DependencyGraph::new();
        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);
        let c1 = CellAddress::new(2, 0);

        // Create a cycle: A1 -> B1 -> C1 -> A1
        graph.add_dependency(a1, b1);
        graph.add_dependency(b1, c1);

        // Check if adding C1 -> A1 would create a cycle
        assert!(graph.would_create_cycle(&c1, &a1));

        // Actually add it to create the cycle
        graph.add_dependency(c1, a1);

        // Calculation order should fail due to cycle
        let result = graph.get_calculation_order();
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            SpreadsheetError::CircularDependency
        ));
    }

    #[test]
    fn test_remove_dependencies() {
        let mut graph = DependencyGraph::new();
        let a1 = CellAddress::new(0, 0);
        let b1 = CellAddress::new(1, 0);
        let c1 = CellAddress::new(2, 0);

        // A1 depends on B1 and C1
        graph.add_dependency(a1, b1);
        graph.add_dependency(a1, c1);

        assert_eq!(graph.get_dependencies(&a1).len(), 2);

        // Remove dependencies for A1
        graph.remove_dependencies_for(&a1);

        assert_eq!(graph.get_dependencies(&a1).len(), 0);
        assert_eq!(graph.get_dependents(&b1).len(), 0);
        assert_eq!(graph.get_dependents(&c1).len(), 0);
    }
}
