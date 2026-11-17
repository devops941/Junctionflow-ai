import pandas as pd
from app.models.dataset import ColumnMapping, ValidationReport


class ValidationResult(tuple):
    """
    Subclass of tuple (report, df) to support both:
    1. Unpacking: report, cleaned_df = validate_dataframe(...)
    2. Direct dict-like access: result.get(...)
    """
    def __new__(cls, report: ValidationReport, df: pd.DataFrame):
        return super().__new__(cls, (report, df))

    @property
    def report(self) -> ValidationReport:
        return self[0]

    @property
    def df(self) -> pd.DataFrame:
        return self[1]

    def get(self, key, default=None):
        data = self[0].model_dump()
        if key == "duplicate_count" and "duplicate_rows" in data:
            return data["duplicate_rows"]
        if key == "negative_count" and "out_of_range" in data:
            return data["out_of_range"].get("vehicle_count_negative", 0)
        return data.get(key, default)

    def __getitem__(self, item):
        if isinstance(item, str):
            return self.get(item)
        return super().__getitem__(item)


def validate_dataframe(df: pd.DataFrame, cm: ColumnMapping | None = None) -> ValidationResult:
    if cm is None:
        cm = ColumnMapping()

    errors, warnings = [], []
    total_rows = len(df)

    # Check required columns exist
    required_map = {
        cm.timestamp: "timestamp",
        cm.junction_id: "junction_id",
        cm.vehicle_count: "vehicle_count",
    }
    missing = [col for col in required_map if col not in df.columns]
    if missing:
        report = ValidationReport(
            total_rows=total_rows, valid_rows=0, invalid_rows=total_rows,
            missing_required=missing, errors=[f"Missing required columns: {missing}"],
        )
        return ValidationResult(report, pd.DataFrame())

    # Drop rows with missing required values
    before = len(df)
    df = df.dropna(subset=list(required_map.keys()))
    dropped_null = before - len(df)
    if dropped_null:
        warnings.append(f"Dropped {dropped_null} rows with null required values")

    # Parse timestamp with robust format detection and coercion
    try:
        parsed_ts = pd.to_datetime(df[cm.timestamp], errors="coerce", format="mixed")
        invalid_ts_count = int(parsed_ts.isna().sum())
        
        if invalid_ts_count == len(df) and len(df) > 0:
            errors.append(f"Cannot parse timestamp column '{cm.timestamp}': all values are invalid dates.")
            report = ValidationReport(
                total_rows=total_rows, valid_rows=0, invalid_rows=total_rows, errors=errors,
            )
            return ValidationResult(report, pd.DataFrame())
        elif invalid_ts_count > 0:
            warnings.append(f"Dropped {invalid_ts_count} rows with unparseable timestamp format")
            valid_mask = parsed_ts.notna()
            df = df.loc[valid_mask].copy()
            df[cm.timestamp] = parsed_ts.loc[valid_mask]
        else:
            df[cm.timestamp] = parsed_ts
    except Exception as e:
        errors.append(f"Cannot parse timestamp column '{cm.timestamp}': {e}")
        report = ValidationReport(
            total_rows=total_rows, valid_rows=0, invalid_rows=total_rows, errors=errors,
        )
        return ValidationResult(report, pd.DataFrame())

    # Validate vehicle_count
    out_of_range = {}
    df[cm.vehicle_count] = pd.to_numeric(df[cm.vehicle_count], errors="coerce")
    neg_mask = df[cm.vehicle_count] < 0
    neg_count = int(neg_mask.sum())
    if neg_count:
        out_of_range["vehicle_count_negative"] = neg_count
        warnings.append(f"{neg_count} rows with negative vehicle_count — clamped to 0")
        df.loc[neg_mask, cm.vehicle_count] = 0

    nan_count = int(df[cm.vehicle_count].isna().sum())
    if nan_count:
        warnings.append(f"Dropped {nan_count} rows where vehicle_count is non-numeric")
        df = df.dropna(subset=[cm.vehicle_count])

    df[cm.vehicle_count] = df[cm.vehicle_count].astype(int)

    # Check duplicates
    dup_mask = df.duplicated(subset=[cm.timestamp, cm.junction_id], keep="first")
    dup_count = int(dup_mask.sum())
    if dup_count:
        warnings.append(f"Dropped {dup_count} duplicate (timestamp, junction_id) rows")
        df = df[~dup_mask]

    valid_rows = len(df)
    report = ValidationReport(
        total_rows=total_rows,
        valid_rows=valid_rows,
        invalid_rows=total_rows - valid_rows,
        duplicate_rows=dup_count,
        out_of_range=out_of_range,
        warnings=warnings,
        errors=errors,
    )
    return ValidationResult(report, df)
