use super::{
    CellRange, FillDirection, FillOperation, FillResult, FormulaAdjuster, PatternDetector,
    PatternType,
};
use crate::ports::RepositoryPort;
use crate::types::{CellAddress, CellValue};
use crate::utils::object_pool::global::CELL_VALUE_VEC_POOL;
use crate::{Result, SpreadsheetError};
use std::sync::Arc;

pub struct FillEngine {
    cell_repository: Arc<dyn RepositoryPort>,
    detectors: Vec<Box<dyn PatternDetector>>,
    formula_adjuster: Option<Box<dyn FormulaAdjuster>>,
}

impl FillEngine {
    pub fn new(cell_repository: Arc<dyn RepositoryPort>) -> Self {
        use super::patterns::{
            CopyPatternDetector, DatePatternDetector, ExponentialPatternDetector,
            LinearPatternDetector, TextPatternDetector,
        };

        let mut detectors: Vec<Box<dyn PatternDetector>> = vec![
            Box::new(LinearPatternDetector::new()),
            Box::new(ExponentialPatternDetector::new()),
            Box::new(DatePatternDetector::new()),
            Box::new(TextPatternDetector::new()),
            Box::new(CopyPatternDetector::new()), // Fallback
        ];

        // Sort by priority (highest first)
        detectors.sort_by_key(|d| std::cmp::Reverse(d.priority()));

        Self {
            cell_repository,
            detectors,
            formula_adjuster: None,
        }
    }

    pub fn with_formula_adjuster(mut self, adjuster: Box<dyn FormulaAdjuster>) -> Self {
        self.formula_adjuster = Some(adjuster);
        self
    }

    pub fn fill(&self, operation: &FillOperation) -> Result<FillResult> {
        // Get source values
        let source_values = self.get_source_values(&operation.source_range)?;

        if source_values.is_empty() {
            return Err(SpreadsheetError::InvalidOperation(
                "No source values found for fill operation".to_string(),
            ));
        }

        // Detect pattern if not specified
        let pattern = if let Some(ref p) = operation.pattern {
            p.clone()
        } else {
            self.detect_pattern(&source_values)?
        };

        // Generate target values
        let generated_values = self.generate_values(
            &source_values,
            &pattern,
            &operation.source_range,
            &operation.target_range,
            operation.direction,
        )?;

        // Adjust formulas if needed
        let adjusted_formulas = if self.formula_adjuster.is_some() {
            self.adjust_formulas(
                &operation.source_range,
                &operation.target_range,
                operation.direction,
            )?
        } else {
            vec![]
        };

        Ok(FillResult {
            affected_cells: generated_values,
            formulas_adjusted: adjusted_formulas,
        })
    }

    pub fn preview(&self, operation: &FillOperation) -> Result<Vec<(CellAddress, CellValue)>> {
        let source_values = self.get_source_values(&operation.source_range)?;

        if source_values.is_empty() {
            return Ok(vec![]);
        }

        let pattern = if let Some(ref p) = operation.pattern {
            p.clone()
        } else {
            self.detect_pattern(&source_values)?
        };

        self.generate_values(
            &source_values,
            &pattern,
            &operation.source_range,
            &operation.target_range,
            operation.direction,
        )
    }

    fn get_source_values(&self, range: &CellRange) -> Result<Vec<CellValue>> {
        // Use pooled vector for better performance
        let cell_count = range.iter_cells().count();
        let mut values = CELL_VALUE_VEC_POOL.get();
        values.reserve(cell_count);

        for addr in range.iter_cells() {
            if let Some(cell) = self.cell_repository.get(&addr) {
                values.push(cell.get_computed_value());
            } else {
                values.push(CellValue::Empty);
            }
        }

        // Take ownership from the pool to return
        Ok(values.take())
    }

    fn detect_pattern(&self, values: &[CellValue]) -> Result<PatternType> {
        // Try each detector in priority order
        for detector in &self.detectors {
            if detector.can_handle(values)
                && let Some(pattern) = detector.detect(values)
            {
                return Ok(pattern);
            }
        }

        // Default to copy pattern if no pattern detected
        Ok(PatternType::Copy)
    }

    fn generate_values(
        &self,
        source_values: &[CellValue],
        pattern: &PatternType,
        _source_range: &CellRange,
        target_range: &CellRange,
        direction: FillDirection,
    ) -> Result<Vec<(CellAddress, CellValue)>> {
        let target_count = target_range.iter_cells().count();
        let mut result = Vec::with_capacity(target_count);

        match pattern {
            PatternType::Linear { slope } => {
                self.generate_linear_values(
                    source_values,
                    *slope,
                    target_range,
                    direction,
                    &mut result,
                )?;
            }
            PatternType::Exponential { rate } => {
                self.generate_exponential_values(
                    source_values,
                    *rate,
                    target_range,
                    direction,
                    &mut result,
                )?;
            }
            PatternType::Copy => {
                self.generate_copy_values(source_values, target_range, direction, &mut result)?;
            }
            PatternType::Text | PatternType::Date { .. } | PatternType::Custom { .. } => {
                // TODO: Implement other pattern types
                self.generate_copy_values(source_values, target_range, direction, &mut result)?;
            }
        }

        Ok(result)
    }

    fn generate_linear_values(
        &self,
        source_values: &[CellValue],
        slope: f64,
        target_range: &CellRange,
        _direction: FillDirection,
        result: &mut Vec<(CellAddress, CellValue)>,
    ) -> Result<()> {
        // Get the last numeric value from source
        let last_value = source_values
            .iter()
            .rev()
            .find_map(|v| match v {
                CellValue::Number(n) => Some(*n),
                _ => None,
            })
            .ok_or_else(|| {
                SpreadsheetError::InvalidOperation("No numeric value found".to_string())
            })?;

        let mut current_value = last_value;

        for addr in target_range.iter_cells() {
            current_value += slope;
            result.push((addr, CellValue::Number(current_value)));
        }

        Ok(())
    }

    fn generate_exponential_values(
        &self,
        source_values: &[CellValue],
        rate: f64,
        target_range: &CellRange,
        _direction: FillDirection,
        result: &mut Vec<(CellAddress, CellValue)>,
    ) -> Result<()> {
        // Get the last numeric value from source
        let last_value = source_values
            .iter()
            .rev()
            .find_map(|v| match v {
                CellValue::Number(n) => Some(*n),
                _ => None,
            })
            .ok_or_else(|| {
                SpreadsheetError::InvalidOperation("No numeric value found".to_string())
            })?;

        let mut current_value = last_value;

        for addr in target_range.iter_cells() {
            current_value *= rate;
            result.push((addr, CellValue::Number(current_value)));
        }

        Ok(())
    }

    fn generate_copy_values(
        &self,
        source_values: &[CellValue],
        target_range: &CellRange,
        _direction: FillDirection,
        result: &mut Vec<(CellAddress, CellValue)>,
    ) -> Result<()> {
        let source_len = source_values.len();

        for (index, addr) in target_range.iter_cells().enumerate() {
            result.push((addr, source_values[index % source_len].clone()));
        }

        Ok(())
    }

    fn adjust_formulas(
        &self,
        source_range: &CellRange,
        target_range: &CellRange,
        direction: FillDirection,
    ) -> Result<Vec<(CellAddress, String)>> {
        let adjuster = self.formula_adjuster.as_ref().ok_or_else(|| {
            SpreadsheetError::InvalidOperation("No formula adjuster configured".to_string())
        })?;

        let source_count = source_range.iter_cells().count();
        let target_count = target_range.iter_cells().count();
        let mut adjusted = Vec::with_capacity(source_count * target_count);

        // For each source cell with a formula
        for source_addr in source_range.iter_cells() {
            if let Some(cell) = self.cell_repository.get(&source_addr)
                && let Some(ref formula) = cell.formula_text
            {
                // Generate adjusted formulas for each target cell
                for target_addr in target_range.iter_cells() {
                    let adjusted_formula = adjuster.adjust_formula(
                        formula,
                        &source_addr,
                        &target_addr,
                        direction,
                    )?;
                    adjusted.push((target_addr, adjusted_formula));
                }
            }
        }

        Ok(adjusted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::RepositoryAdapter;
    use crate::domain::Cell;

    #[test]
    fn test_fill_engine_creation() {
        let repo = Arc::new(RepositoryAdapter::new_empty());
        let engine = FillEngine::new(repo);
        assert!(!engine.detectors.is_empty());
    }

    #[test]
    fn test_get_source_values_empty_range() {
        let repo = Arc::new(RepositoryAdapter::new_empty());
        let engine = FillEngine::new(repo);

        let range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(2, 0));
        let values = engine.get_source_values(&range).unwrap();

        assert_eq!(values.len(), 3);
        assert!(values.iter().all(|v| matches!(v, CellValue::Empty)));
    }

    #[test]
    fn test_copy_pattern_generation() {
        // Create a repository with some values
        let repo = Arc::new(RepositoryAdapter::new_empty());
        let cell1 = Cell::new(CellValue::Number(1.0));
        let cell2 = Cell::new(CellValue::Number(2.0));
        repo.set(&CellAddress::new(0, 0), cell1).unwrap();
        repo.set(&CellAddress::new(1, 0), cell2).unwrap();

        let engine = FillEngine::new(repo.clone());

        // Test the copy pattern detection
        let range = CellRange::new(CellAddress::new(0, 0), CellAddress::new(1, 0));
        let values = engine.get_source_values(&range).unwrap();
        assert_eq!(values.len(), 2);
        assert_eq!(values[0], CellValue::Number(1.0));
        assert_eq!(values[1], CellValue::Number(2.0));
    }
}
